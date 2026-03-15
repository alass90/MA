"""
Talos Deploy Tool — Website & App Generation + Deployment
============================================================
Copyright (c) 2026 Talos Team. All rights reserved.

Compatible avec l'architecture Talos existante :
  - AsyncSandbox (daytona_sdk)
  - Commandes shell via tmux sessions + execute_session_command
  - Fichiers via sandbox.fs (upload_file, download_file, list_files)
  - Preview URLs via sandbox.get_preview_link(port)
  - Workspace path : /workspace

Calqué sur le pattern de sb_shell_tool.py et sb_files_tool.py.

3 niveaux :
  Level 1 — Preview live (URL temporaire Daytona)
  Level 2 — Déploiement Vercel (URL permanente)
  Level 3 — Full-stack (Vercel + Supabase DB)
"""

import os
import json
import hashlib
import asyncio
import secrets
import time
import re
import logging
from pathlib import Path
from typing import Optional
from dataclasses import dataclass
from enum import Enum

import aiohttp
from daytona_sdk import AsyncSandbox, SessionExecuteRequest

from core.sandbox.tool_base import SandboxToolsBase
from core.agentpress.tool import ToolResult, openapi_schema, tool_metadata
from core.agentpress.thread_manager import ThreadManager

logger = logging.getLogger("[TalosDeployTool]")


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
VERCEL_API_URL = "https://api.vercel.com"
VERCEL_TOKEN = os.getenv("VERCEL_TOKEN")
VERCEL_TEAM_ID = os.getenv("VERCEL_TEAM_ID")

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

IGNORE_PATTERNS = {
    "node_modules", ".git", "__pycache__", ".next", ".venv",
    "venv", ".env", ".env.local", "dist", "build", ".cache",
    ".DS_Store", "thumbs.db",
}

FRAMEWORK_SIGNATURES = {
    "next.config.js": "nextjs",
    "next.config.mjs": "nextjs",
    "next.config.ts": "nextjs",
    "nuxt.config.js": "nuxtjs",
    "nuxt.config.ts": "nuxtjs",
    "svelte.config.js": "svelte",
    "vite.config.js": "vite",
    "vite.config.ts": "vite",
    "angular.json": "angular",
    "gatsby-config.js": "gatsby",
    "astro.config.mjs": "astro",
    "remix.config.js": "remix",
}


# ---------------------------------------------------------------------------
# Data Classes
# ---------------------------------------------------------------------------
class DeployLevel(Enum):
    PREVIEW = "preview"
    VERCEL = "vercel"
    FULLSTACK = "fullstack"


@dataclass
class DeployResult:
    success: bool
    level: DeployLevel
    url: str = ""
    deployment_id: str = ""
    project_name: str = ""
    framework: str = ""
    error: str = ""
    database_url: str = ""
    database_provider: str = ""


@dataclass
class ProjectFile:
    path: str
    content: bytes
    sha: str = ""

    def __post_init__(self):
        if not self.sha:
            self.sha = hashlib.sha1(self.content).hexdigest()


# ---------------------------------------------------------------------------
# Sandbox Helper — Matches sb_shell_tool (tmux sessions) + sb_files_tool (fs API)
# ---------------------------------------------------------------------------
class SandboxExec:
    """
    Couche d'abstraction pour le deploy tool.

    Commandes shell → même pattern que sb_shell_tool :
      sandbox.process.create_session(session_id)
      sandbox.process.execute_session_command(session_id, SessionExecuteRequest)
      sandbox.process.get_session_command_logs(session_id)

    Fichiers → même pattern que sb_files_tool :
      sandbox.fs.download_file(path)  → lire
      sandbox.fs.upload_file(content, path)  → écrire
      sandbox.fs.list_files(path)  → lister
      sandbox.fs.create_folder(path, mode)  → créer dossier
    """

    DEPLOY_SESSION_ID = "talos-deploy-session"
    _session_created: set = set()  # Track created sessions

    @classmethod
    async def _ensure_session(cls, sandbox: AsyncSandbox, session_id: str = None):
        """Crée la session si elle n'existe pas encore."""
        sid = session_id or cls.DEPLOY_SESSION_ID
        if sid not in cls._session_created:
            try:
                await sandbox.process.create_session(sid)
                cls._session_created.add(sid)
            except Exception:
                # Session already exists — c'est OK
                cls._session_created.add(sid)

    @classmethod
    async def run(
        cls,
        sandbox: AsyncSandbox,
        command: str,
        cwd: str = "/home/daytona",
        timeout: int = 30,
    ) -> dict:
        """
        Exécute une commande shell via session Daytona (comme sb_shell_tool).
        Retourne {"exit_code": int, "output": str}
        """
        await cls._ensure_session(sandbox)

        try:
            result = await sandbox.process.execute_session_command(
                cls.DEPLOY_SESSION_ID,
                SessionExecuteRequest(
                    command=command,
                    var_async=False,
                    cwd=cwd,
                ),
                timeout=timeout,
            )

            # Extraire l'output (le SDK peut varier selon la version)
            output = ""
            if hasattr(result, 'output'):
                output = result.output
            elif hasattr(result, 'result'):
                output = result.result
            else:
                output = str(result)

            exit_code = getattr(result, 'exit_code', 0)

            return {"exit_code": exit_code, "output": output}

        except Exception as e:
            logger.warning(f"[SandboxExec] Command failed: {str(e)[:200]}")
            return {"exit_code": 1, "output": str(e)}

    @classmethod
    async def run_background(
        cls,
        sandbox: AsyncSandbox,
        command: str,
        cwd: str = "/home/daytona",
        session_id: str = None,
    ) -> None:
        """
        Lance une commande en arrière-plan via une session dédiée.
        Utilise var_async=True (même pattern que start_supervisord_session).
        """
        sid = session_id or f"deploy-bg-{int(time.time())}"
        await cls._ensure_session(sandbox, sid)

        try:
            await sandbox.process.execute_session_command(
                sid,
                SessionExecuteRequest(
                    command=command,
                    var_async=True,  # Non-bloquant — comme supervisord
                    cwd=cwd,
                ),
            )
        except Exception as e:
            logger.warning(f"[SandboxExec] Background failed: {e}")

    @classmethod
    async def read_file(cls, sandbox: AsyncSandbox, path: str) -> bytes:
        """
        Lit un fichier via sandbox.fs.download_file()
        (même API que sb_files_tool).
        """
        content = await sandbox.fs.download_file(path)
        if isinstance(content, str):
            return content.encode("utf-8")
        return content

    @classmethod
    async def write_file(cls, sandbox: AsyncSandbox, path: str, content: bytes) -> None:
        """Écrit un fichier via sandbox.fs.upload_file() (comme sb_files_tool)."""
        await sandbox.fs.upload_file(content, path)

    @classmethod
    async def list_files(cls, sandbox: AsyncSandbox, path: str) -> list:
        """Liste les fichiers via sandbox.fs.list_files() (comme sb_files_tool)."""
        return await sandbox.fs.list_files(path)


# ---------------------------------------------------------------------------
# Level 1 — Preview Live dans le Sandbox Daytona
# ---------------------------------------------------------------------------
class TalosPreviewTool:
    """
    Lance un serveur de dev dans le sandbox Daytona et retourne
    l'URL publique via sandbox.get_preview_link(port).

    URL format : https://{port}-{sandbox_id}.preview.daytona.works
    Accessible publiquement car sandbox.public = True.
    """

    PREVIEW_COMMANDS = {
        "nextjs": {
            "install": "npm install",
            "dev": "npm run dev -- --port {port}",
            "port": 3000,
        },
        "vite": {
            "install": "npm install",
            "dev": "npm run dev -- --port {port} --host 0.0.0.0",
            "port": 5173,
        },
        "react-cra": {
            "install": "npm install",
            "dev": "PORT={port} npm start",
            "port": 3000,
        },
        "static": {
            "install": None,
            "dev": "python3 -m http.server {port}",
            "port": 8080,
        },
        "python-flask": {
            "install": "pip install -r requirements.txt",
            "dev": "python app.py",
            "port": 5000,
        },
        "python-fastapi": {
            "install": "pip install -r requirements.txt",
            "dev": "uvicorn main:app --host 0.0.0.0 --port {port}",
            "port": 8000,
        },
    }

    async def preview(
        self,
        sandbox: AsyncSandbox,
        project_path: str,
        framework: str = None,
    ) -> DeployResult:
        try:
            if not framework:
                framework = await self._detect_framework(sandbox, project_path)

            config = self.PREVIEW_COMMANDS.get(framework, self.PREVIEW_COMMANDS["static"])
            port = config["port"]

            # Install dependencies
            if config["install"]:
                logger.info(f"[Deploy] Installing deps for {framework}...")
                result = await SandboxExec.run(
                    sandbox, config["install"], cwd=project_path, timeout=120
                )
                if result["exit_code"] != 0:
                    logger.warning(f"Install warning: {result['output'][:300]}")

            # Start dev server in background
            dev_cmd = config["dev"].format(port=port)
            logger.info(f"[Deploy] Starting: {dev_cmd}")

            await SandboxExec.run_background(
                sandbox, dev_cmd, cwd=project_path,
                session_id=f"dev-server-{port}"
            )

            # Wait for server
            await self._wait_for_server(sandbox, port, project_path)

            # Get public URL from Daytona
            preview_link = await sandbox.get_preview_link(port)
            raw_url = preview_link.url if hasattr(preview_link, 'url') else str(preview_link)

            # Add query parameter to instruct frontend to add X-Daytona-Skip-Preview-Warning header
            # The iframe will handle this on the frontend side
            url = f"{raw_url}#skip-warning" if raw_url else raw_url

            logger.info(f"[Deploy] Preview live: {url}")

            return DeployResult(
                success=True,
                level=DeployLevel.PREVIEW,
                url=url,
                framework=framework,
                project_name=Path(project_path).name,
            )

        except Exception as e:
            logger.error(f"[Deploy] Preview failed: {e}")
            return DeployResult(success=False, level=DeployLevel.PREVIEW, error=str(e))

    async def _detect_framework(self, sandbox: AsyncSandbox, project_path: str) -> str:
        """Auto-detect project framework."""

        for config_file, fw in FRAMEWORK_SIGNATURES.items():
            r = await SandboxExec.run(
                sandbox, f"test -f {project_path}/{config_file} && echo found", timeout=5
            )
            if "found" in r["output"]:
                return fw

        # Check package.json
        r = await SandboxExec.run(
            sandbox, f"cat {project_path}/package.json 2>/dev/null", timeout=5
        )
        if r["output"] and r["exit_code"] == 0:
            try:
                pkg = json.loads(r["output"])
                deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
                if "next" in deps: return "nextjs"
                if "vite" in deps: return "vite"
                if "react-scripts" in deps: return "react-cra"
            except (json.JSONDecodeError, ValueError):
                pass

        # Check Python
        r = await SandboxExec.run(
            sandbox, f"cat {project_path}/requirements.txt 2>/dev/null", timeout=5
        )
        if r["output"] and r["exit_code"] == 0:
            content = r["output"].lower()
            if "fastapi" in content or "uvicorn" in content: return "python-fastapi"
            if "flask" in content: return "python-flask"

        # Static fallback
        r = await SandboxExec.run(
            sandbox, f"test -f {project_path}/index.html && echo found", timeout=5
        )
        if "found" in r["output"]:
            return "static"

        return "static"

    async def _wait_for_server(
        self, sandbox: AsyncSandbox, port: int, cwd: str, timeout: int = 30
    ):
        for i in range(timeout):
            r = await SandboxExec.run(
                sandbox,
                f"curl -s -o /dev/null -w '%{{http_code}}' http://localhost:{port}/ 2>/dev/null || echo down",
                timeout=5,
            )
            code = r["output"].strip()
            if code not in ("down", "000", "", "0"):
                logger.info(f"[Deploy] Server ready on :{port} after {i+1}s")
                return
            await asyncio.sleep(1)

        logger.warning(f"[Deploy] Server may not be ready after {timeout}s")


# ---------------------------------------------------------------------------
# Level 2 — Vercel Persistent Deployment
# ---------------------------------------------------------------------------
class TalosVercelDeployTool:
    """
    Collecte les fichiers depuis le sandbox Daytona,
    upload vers Vercel, crée un déploiement permanent.
    """

    def __init__(self, token: str = None, team_id: str = None):
        self.token = token or VERCEL_TOKEN
        self.team_id = team_id or VERCEL_TEAM_ID
        if not self.token:
            raise ValueError("VERCEL_TOKEN required")

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}

    def _team_q(self) -> str:
        return f"?teamId={self.team_id}" if self.team_id else ""

    async def deploy(
        self,
        sandbox: AsyncSandbox,
        project_path: str,
        project_name: str = None,
        framework: str = None,
        env_vars: dict = None,
    ) -> DeployResult:
        try:
            # 1 — Collect files
            logger.info("[Deploy] Collecting files from sandbox...")
            files = await self._collect_files(sandbox, project_path)
            if not files:
                return DeployResult(success=False, level=DeployLevel.VERCEL, error="No files found")

            logger.info(f"[Deploy] Collected {len(files)} files")

            # 2 — Detect framework
            if not framework:
                framework = self._detect_framework_from_files(files)

            # 3 — Project name
            if not project_name:
                project_name = f"talos-{int(time.time())}"
            project_name = self._sanitize_name(project_name)

            # 4 — Upload files to Vercel
            logger.info("[Deploy] Uploading to Vercel...")
            await self._upload_files(files)

            # 5 — Create deployment
            logger.info("[Deploy] Creating deployment...")
            deployment = await self._create_deployment(files, project_name, framework, env_vars)

            deployment_id = deployment.get("id", "")

            # 6 — Wait for READY
            deploy_url = ""
            if deployment_id:
                deploy_url = await self._wait_for_ready(deployment_id)

            if not deploy_url:
                deploy_url = f"https://{deployment.get('url', '')}"

            logger.info(f"[Deploy] Live at: {deploy_url}")

            return DeployResult(
                success=True,
                level=DeployLevel.VERCEL,
                url=deploy_url,
                deployment_id=deployment_id,
                project_name=project_name,
                framework=framework or "other",
            )

        except Exception as e:
            logger.error(f"[Deploy] Vercel failed: {e}")
            return DeployResult(success=False, level=DeployLevel.VERCEL, error=str(e))

    async def _collect_files(
        self, sandbox: AsyncSandbox, project_path: str
    ) -> list[ProjectFile]:
        """
        Collect project files using Daytona fs API (like sb_files_tool).
        Uses sandbox.fs.list_files for discovery + sandbox.fs.download_file for content.
        Falls back to 'find' via shell if fs.list_files doesn't support recursive.
        """
        files = []

        # Get file list via shell find (more reliable for recursive + filtering)
        r = await SandboxExec.run(
            sandbox,
            f"find {project_path} -type f "
            f"-not -path '*/node_modules/*' "
            f"-not -path '*/.git/*' "
            f"-not -path '*/__pycache__/*' "
            f"-not -path '*/.next/*' "
            f"-not -path '*/dist/*' "
            f"-not -path '*/.env*' "
            f"-not -path '*/.venv/*' "
            f"-not -name '.DS_Store' "
            f"-not -name '*.pyc' "
            f"2>/dev/null",
            timeout=30,
        )

        if not r["output"] or r["exit_code"] != 0:
            logger.warning("[Deploy] No files found or find command failed")
            return []

        paths = [p.strip() for p in r["output"].strip().split("\n") if p.strip()]
        logger.info(f"[Deploy] Found {len(paths)} files to collect")

        # Read each file via Daytona fs API (like sb_files_tool)
        for abs_path in paths:
            rel_path = abs_path.replace(f"{project_path}/", "").lstrip("/")

            # Double-check ignore patterns
            if any(part in IGNORE_PATTERNS for part in rel_path.split("/")):
                continue

            try:
                # Use sandbox.fs.download_file — same as sb_files_tool
                content = await SandboxExec.read_file(sandbox, abs_path)

                if len(content) > MAX_FILE_SIZE:
                    logger.warning(f"[Deploy] Skipping large: {rel_path} ({len(content)}B)")
                    continue

                files.append(ProjectFile(path=rel_path, content=content))

            except Exception as e:
                logger.debug(f"[Deploy] Skip {rel_path}: {e}")

        return files

    async def _upload_files(self, files: list[ProjectFile]) -> None:
        """Upload files to Vercel (POST /v2/files)."""
        semaphore = asyncio.Semaphore(10)

        async with aiohttp.ClientSession() as session:
            async def upload_one(f: ProjectFile):
                async with semaphore:
                    url = f"{VERCEL_API_URL}/v2/files{self._team_q()}"
                    headers = {
                        "Authorization": f"Bearer {self.token}",
                        "Content-Type": "application/octet-stream",
                        "x-vercel-digest": f.sha,
                        "x-vercel-size": str(len(f.content)),
                    }
                    async with session.post(url, headers=headers, data=f.content) as resp:
                        if resp.status not in (200, 409):
                            text = await resp.text()
                            logger.warning(f"Upload {f.path}: {resp.status} {text[:200]}")

            await asyncio.gather(*[upload_one(f) for f in files])

    async def _create_deployment(
        self, files, project_name, framework=None, env_vars=None
    ) -> dict:
        """Create Vercel deployment (POST /v13/deployments)."""
        body = {
            "name": project_name,
            "files": [
                {"file": f.path, "sha": f.sha, "size": len(f.content)}
                for f in files
            ],
            "projectSettings": {},
        }

        if framework and framework != "static":
            body["projectSettings"]["framework"] = framework

        if framework == "static":
            body["projectSettings"]["buildCommand"] = ""
            body["projectSettings"]["outputDirectory"] = "."

        if env_vars:
            body["env"] = env_vars

        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{VERCEL_API_URL}/v13/deployments{self._team_q()}",
                headers=self._headers(),
                json=body,
            ) as resp:
                data = await resp.json()
                if resp.status not in (200, 201):
                    raise RuntimeError(
                        f"Deploy failed: {data.get('error', {}).get('message', str(data))}"
                    )
                return data

    async def _wait_for_ready(self, deployment_id: str, timeout: int = 300) -> str:
        """Poll until deployment is READY."""
        url = f"{VERCEL_API_URL}/v13/deployments/{deployment_id}{self._team_q()}"

        async with aiohttp.ClientSession() as session:
            for _ in range(timeout // 5):
                async with session.get(url, headers=self._headers()) as resp:
                    data = await resp.json()
                    state = data.get("readyState", data.get("state", ""))

                    if state == "READY":
                        u = data.get("url", "")
                        return f"https://{u}" if u and not u.startswith("http") else u

                    if state in ("ERROR", "CANCELED"):
                        raise RuntimeError(f"Deploy {state}: {data.get('errorMessage', '')}")

                await asyncio.sleep(5)

        raise TimeoutError(f"Deploy not READY in {timeout}s")

    def _detect_framework_from_files(self, files: list[ProjectFile]) -> str:
        file_names = {f.path.split("/")[-1] for f in files}

        for cfg, fw in FRAMEWORK_SIGNATURES.items():
            if cfg in file_names:
                return fw

        for f in files:
            if f.path == "package.json" or f.path.endswith("/package.json"):
                try:
                    pkg = json.loads(f.content.decode("utf-8"))
                    deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
                    if "next" in deps: return "nextjs"
                    if "vite" in deps: return "vite"
                    if "react-scripts" in deps: return "vite"
                    if "svelte" in deps: return "svelte"
                    if "astro" in deps: return "astro"
                except (json.JSONDecodeError, UnicodeDecodeError):
                    pass

        if any(f.path == "index.html" for f in files):
            return "static"

        return "static"

    @staticmethod
    def _sanitize_name(name: str) -> str:
        name = name.lower().strip()
        name = re.sub(r"[^a-z0-9\-]", "-", name)
        name = re.sub(r"-+", "-", name).strip("-")
        return name[:100] or "talos-project"


# ---------------------------------------------------------------------------
# Level 3 — Full-Stack with Supabase DB
# ---------------------------------------------------------------------------
class TalosFullStackDeployTool:
    """
    Crée une DB Supabase + déploie sur Vercel.
    Utilise votre Supabase existant (même infra que le reste de Talos).
    """

    def __init__(self, vercel_tool: TalosVercelDeployTool):
        self.vercel_tool = vercel_tool
        self.supabase_token = os.getenv("SUPABASE_SERVICE_TOKEN")
        self.supabase_org_id = os.getenv("SUPABASE_ORG_ID")

    async def deploy_fullstack(
        self,
        sandbox: AsyncSandbox,
        project_path: str,
        project_name: str = None,
        db_schema_path: str = None,
        env_vars: dict = None,
    ) -> DeployResult:
        try:
            env_vars = env_vars or {}

            # 1 — Create Supabase project
            logger.info("[Deploy] Creating Supabase project...")
            db_info = await self._create_supabase_project(project_name)

            if not db_info.get("url"):
                return DeployResult(
                    success=False,
                    level=DeployLevel.FULLSTACK,
                    error=f"DB creation failed: {db_info.get('error', 'unknown')}",
                )

            # Inject DB env vars
            env_vars["DATABASE_URL"] = db_info["url"]
            env_vars["NEXT_PUBLIC_SUPABASE_URL"] = db_info.get("api_url", "")
            env_vars["NEXT_PUBLIC_SUPABASE_ANON_KEY"] = db_info.get("anon_key", "")
            env_vars["SUPABASE_SERVICE_ROLE_KEY"] = db_info.get("service_key", "")

            # 2 — Run migrations
            if db_schema_path:
                logger.info("[Deploy] Running migrations...")
                r = await SandboxExec.run(
                    sandbox,
                    f"DATABASE_URL='{db_info['url']}' "
                    f"npx prisma migrate deploy 2>/dev/null || "
                    f"npx prisma db push 2>/dev/null || "
                    f"psql '{db_info['url']}' -f {db_schema_path} 2>/dev/null || "
                    f"echo 'Migration: no compatible tool found'",
                    cwd=project_path,
                    timeout=60,
                )
                logger.info(f"[Deploy] Migration: {r['output'][:300]}")

            # 3 — Deploy to Vercel
            result = await self.vercel_tool.deploy(
                sandbox=sandbox,
                project_path=project_path,
                project_name=project_name,
                env_vars=env_vars,
            )

            result.level = DeployLevel.FULLSTACK
            result.database_url = db_info.get("url", "")
            result.database_provider = "supabase"

            return result

        except Exception as e:
            logger.error(f"[Deploy] Fullstack failed: {e}")
            return DeployResult(success=False, level=DeployLevel.FULLSTACK, error=str(e))

    async def _create_supabase_project(self, name: str = None) -> dict:
        if not self.supabase_token:
            return {"error": "SUPABASE_SERVICE_TOKEN not set"}

        project_name = name or f"talos-db-{int(time.time())}"
        db_password = secrets.token_urlsafe(24)

        headers = {
            "Authorization": f"Bearer {self.supabase_token}",
            "Content-Type": "application/json",
        }
        body = {
            "name": project_name,
            "organization_id": self.supabase_org_id,
            "plan": "free",
            "region": "eu-west-1",
            "db_pass": db_password,
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.supabase.com/v1/projects",
                headers=headers,
                json=body,
            ) as resp:
                if resp.status not in (200, 201):
                    text = await resp.text()
                    return {"error": f"Supabase {resp.status}: {text[:300]}"}

                data = await resp.json()
                project_ref = data.get("ref", data.get("id", ""))
                db_host = f"db.{project_ref}.supabase.co"
                api_url = f"https://{project_ref}.supabase.co"

                # Poll for API keys
                anon_key = ""
                service_key = ""
                for _ in range(60):
                    keys_url = f"https://api.supabase.com/v1/projects/{project_ref}/api-keys"
                    async with session.get(keys_url, headers=headers) as kr:
                        if kr.status == 200:
                            keys = await kr.json()
                            for k in keys:
                                if k.get("name") == "anon":
                                    anon_key = k.get("api_key", "")
                                if k.get("name") == "service_role":
                                    service_key = k.get("api_key", "")
                            if anon_key:
                                break
                    await asyncio.sleep(3)

                return {
                    "url": f"postgresql://postgres:{db_password}@{db_host}:5432/postgres",
                    "api_url": api_url,
                    "anon_key": anon_key,
                    "service_key": service_key,
                    "project_ref": project_ref,
                }


# ---------------------------------------------------------------------------
# Unified Entry Point
# ---------------------------------------------------------------------------
@tool_metadata(
    display_name="Deploy Website",
    description="Deploy websites and web applications from the sandbox to live URLs",
    icon="Rocket",
    color="bg-purple-100 dark:bg-purple-800/50",
    is_core=False,
    weight=30,
    visible=True
)
class TalosDeployTool(SandboxToolsBase):
    """
    Point d'entrée unifié. Enregistré dans le ToolRegistry comme "deploy_app".

    L'agent appelle :
      deploy_app(action="preview", project_path="/home/daytona/my-site")
      deploy_app(action="deploy", project_path="/home/daytona/my-app", name="portfolio")
      deploy_app(action="fullstack", project_path="/home/daytona/my-saas")
    """

    def __init__(self, project_id: str, thread_manager: ThreadManager):
        super().__init__(project_id, thread_manager)
        self.preview_tool = TalosPreviewTool()
        self.vercel_tool = TalosVercelDeployTool() if VERCEL_TOKEN else None
        self.fullstack_tool = (
            TalosFullStackDeployTool(self.vercel_tool) if self.vercel_tool else None
        )

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "deploy_app",
            "description": (
                "Deploy a website or web application created in the sandbox. "
                "action='preview' for temporary live URL, "
                "action='deploy' for permanent Vercel URL, "
                "action='fullstack' for app + Supabase database. "
                "Agent must create project files first using sb_shell_tool/sb_files_tool."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["preview", "deploy", "fullstack"],
                        "description": "preview=temp URL, deploy=Vercel permanent, fullstack=Vercel+DB",
                    },
                    "project_path": {
                        "type": "string",
                        "description": "Project root path in sandbox (e.g. /home/daytona/my-app)",
                    },
                    "name": {
                        "type": "string",
                        "description": "Project name for URL. Auto-generated if omitted.",
                    },
                    "framework": {
                        "type": "string",
                        "enum": ["nextjs", "vite", "react-cra", "static", "svelte",
                                 "nuxtjs", "astro", "remix", "python-flask", "python-fastapi"],
                        "description": "Override auto-detection.",
                    },
                    "env_vars": {
                        "type": "object",
                        "description": "Environment variables to inject as key-value pairs.",
                        "additionalProperties": {
                            "type": "string"
                        }
                    },
                    "db_schema": {
                        "type": "string",
                        "description": "Path to SQL schema for fullstack migrations.",
                    },
                },
                "required": ["action", "project_path"],
            },
        }
    })
    async def deploy_app(
        self,
        action: str = "preview",
        project_path: str = "/home/daytona/project",
        name: str = None,
        framework: str = None,
        env_vars: dict = None,
        db_schema: str = None,
    ) -> ToolResult:
        """Execute the deployment based on the selected action."""

        # Ensure sandbox is available
        await self._ensure_sandbox()

        # Execute the deployment
        result: DeployResult = None

        if action == "preview":
            result = await self.preview_tool.preview(self.sandbox, project_path, framework)

        elif action == "deploy":
            if not self.vercel_tool:
                result = DeployResult(
                    success=False, level=DeployLevel.VERCEL,
                    error="VERCEL_TOKEN not configured",
                )
            else:
                result = await self.vercel_tool.deploy(
                    self.sandbox, project_path, name, framework, env_vars,
                )

        elif action == "fullstack":
            if not self.fullstack_tool:
                result = DeployResult(
                    success=False, level=DeployLevel.FULLSTACK,
                    error="VERCEL_TOKEN + SUPABASE_SERVICE_TOKEN required",
                )
            else:
                result = await self.fullstack_tool.deploy_fullstack(
                    self.sandbox, project_path, name, db_schema, env_vars,
                )
        else:
            result = DeployResult(
                success=False, level=DeployLevel.PREVIEW,
                error=f"Unknown action: {action}",
            )

        # Convert DeployResult to ToolResult
        if result.success:
            # Create a rich output with deployment information
            output_dict = {
                "success": True,
                "level": result.level.value,
                "url": result.url,
                "message": "Deployment successful!",
            }

            if result.project_name:
                output_dict["project_name"] = result.project_name
            if result.framework:
                output_dict["framework"] = result.framework
            if result.deployment_id:
                output_dict["deployment_id"] = result.deployment_id
            if result.database_url:
                output_dict["database_url"] = result.database_url
                output_dict["database_provider"] = result.database_provider

            # Create a human-readable message
            message = f"✅ Deployment successful!\n\n"
            message += f"🌐 Live URL: {result.url}\n"
            if result.project_name:
                message += f"📦 Project: {result.project_name}\n"
            if result.framework:
                message += f"⚙️ Framework: {result.framework}\n"
            if result.deployment_id:
                message += f"🔑 Deployment ID: {result.deployment_id}\n"
            if result.database_url:
                message += f"🗄️ Database: {result.database_provider}\n"

            output_dict["formatted_message"] = message

            return self.success_response(output_dict)
        else:
            return self.fail_response(f"❌ Deployment failed: {result.error}")
