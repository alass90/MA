import os
import json
import asyncio
import logging
import traceback
from typing import Optional
from daytona_sdk import SessionExecuteRequest

from core.sandbox.tool_base import SandboxToolsBase
from core.agentpress.tool import ToolResult, openapi_schema, tool_metadata
from core.agentpress.thread_manager import ThreadManager

logger = logging.getLogger("[SandboxFullstackTool]")

@tool_metadata(
    display_name="Fullstack Builder",
    description="Tool to scaffold, build, and run fullstack web applications inside the workspace with a live preview.",
    icon="Layers",
    color="bg-purple-100 dark:bg-purple-800/50",
    is_core=False,
    weight=25,
    visible=True
)
class SandboxFullstackTool(SandboxToolsBase):
    """Tool for managing Bolt-like fullstack projects in the Daytona sandbox."""

    def __init__(self, project_id: str, thread_manager: ThreadManager):
        super().__init__(project_id, thread_manager)
        self.dev_session_id = "talos-dev-server"
        self._dev_port = None
        self._project_folder = None

    async def _execute_blocking(self, command: str, cwd: str, timeout: int = 120) -> ToolResult:
        """Helper to run a blocking command via process session"""
        await self._ensure_sandbox()
        session_id = f"cmd-{os.urandom(4).hex()}"
        try:
            await self.sandbox.process.create_session(session_id)
            result = await self.sandbox.process.execute_session_command(
                session_id,
                SessionExecuteRequest(command=command, cwd=cwd, var_async=False),
                timeout=timeout,
            )
            # Handle SDK variations
            output = ""
            if hasattr(result, 'output'):
                output = result.output
            elif hasattr(result, 'result'):
                output = result.result
            else:
                output = str(result)
            
            exit_code = getattr(result, 'exit_code', 0)
            if exit_code != 0:
                logger.warning(f"Command failed ({exit_code}): {output}")
                return self.fail_response(f"Command failed with exit code {exit_code}:\n{output}")
            return self.success_response(f"Command successful:\n{output}")
        except Exception as e:
            return self.fail_response(f"Execution error: {str(e)}\n{traceback.format_exc()}")
        finally:
            # Cleanup session
            try:
                await self.sandbox.process.delete_session(session_id)
            except Exception:
                pass

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "manage_fullstack_project",
            "description": "Manage fullstack project lifecycle (scaffold, start server, restart server, get preview URL) in the Daytona sandbox.",
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["scaffold", "start_server", "restart_server", "get_url"],
                        "description": "The action to perform: scaffold (creates a new project and installs deps), start_server (runs dev server in background), restart_server (restarts the dev server), get_url (returns the preview URL)."
                    },
                    "framework": {
                        "type": "string",
                        "enum": ["vite-react", "nextjs", "static"],
                        "description": "The framework to use. Required for 'scaffold' and 'start_server'."
                    },
                    "project_name": {
                        "type": "string",
                        "description": "The directory name for the project (relative to workspace). Defaults to '.'. Used to know where to run commands."
                    }
                },
                "required": ["action"]
            }
        }
    })
    async def manage_fullstack_project(
        self,
        action: str,
        framework: str = "vite-react",
        project_name: str = "."
    ) -> ToolResult:
        try:
            await self._ensure_sandbox()
            
            cwd = self.workspace_path
            if project_name and project_name != ".":
                cwd = f"{self.workspace_path}/{project_name}"

            if action == "scaffold":
                return await self._action_scaffold(framework, project_name, cwd)
            elif action in ["start_server", "restart_server"]:
                return await self._action_start_server(framework, cwd)
            elif action == "get_url":
                return await self._action_get_url()
            else:
                return self.fail_response(f"Unknown action: {action}")
                
        except Exception as e:
            logger.error(f"[FullstackTool] Error managing project: {e}")
            return self.fail_response(f"Error: {str(e)}\n{traceback.format_exc()}")
            
    async def _action_scaffold(self, framework: str, project_name: str, target_cwd: str) -> ToolResult:
        """Create a new project from scratch using the specified framework"""
        cwd = self.workspace_path  # Run from root so it creates the folder
        if framework == "vite-react":
            cmd = f"npx -y create-vite@latest {project_name} --template react-ts && cd {project_name} && npm install"
        elif framework == "nextjs":
            cmd = f"npx -y create-next-app@latest {project_name} --typescript --tailwind --eslint --app --src-dir --import-alias '@/*' --use-npm && cd {project_name} && npm install"
        elif framework == "static":
            cmd = f"mkdir -p {project_name} && echo '<h1>Hello World</h1>' > {project_name}/index.html"
        else:
            return self.fail_response(f"Unsupported framework: {framework}")
            
        logger.info(f"[FullstackTool] Scaffolding {framework} at {project_name}...")
        res = await self._execute_blocking(cmd, cwd=cwd, timeout=300)
        
        if res.success:
            return self.success_response(f"Successfully scaffolded {framework} project in {project_name}. You must now call manage_fullstack_project with action='start_server' to run it.")
        return res
        
    async def _action_start_server(self, framework: str, cwd: str) -> ToolResult:
        """Start or restart the background dev server"""
        # Cleanup existing session if it exists
        try:
            await self.sandbox.process.delete_session(self.dev_session_id)
        except Exception:
            pass
            
        await asyncio.sleep(1)  # small pause to free up ports
            
        port = 3000
        cmd = ""
        if framework == "vite-react":
            port = 5173
            cmd = f"npm run dev -- --host 0.0.0.0 --port {port}"
        elif framework == "nextjs":
            port = 3000
            cmd = f"npm run dev -- -p {port}"
        elif framework == "static":
            port = 8080
            cmd = f"python3 -m http.server {port}"
        else:
            return self.fail_response(f"Unsupported framework: {framework}")
            
        self._dev_port = port
        self._project_folder = cwd

        # Recreate session
        try:
            await self.sandbox.process.create_session(self.dev_session_id)
        except Exception:
            pass
            
        logger.info(f"[FullstackTool] Starting dev server: {cmd} in {cwd}")
        
        # Run non-blocking
        await self.sandbox.process.execute_session_command(
            self.dev_session_id,
            SessionExecuteRequest(command=cmd, cwd=cwd, var_async=True)
        )
        
        # Allow server to boot up
        await asyncio.sleep(3)
        
        url_resp = await self._action_get_url()
        if not url_resp.success:
            return url_resp
            
        return self.success_response(f"Dev server started for {framework}.\nPreview info:\n{url_resp.output}")
        
    async def _action_get_url(self) -> ToolResult:
        """Returns the Daytona preview URL for the currently running server"""
        if not self._dev_port:
            return self.fail_response("No dev server is currently known to be running (port unknown). Did you call start_server?")
            
        try:
            preview_link = await self.sandbox.get_preview_link(self._dev_port)
            url = preview_link.url if hasattr(preview_link, 'url') else str(preview_link)
            
            # The preview URL with instruction to frontend to avoid Daytona's security warning
            clean_url = f"{url}#skip-warning" if url else url
            return self.success_response(json.dumps({
                "port": self._dev_port,
                "url": clean_url,
                "project_dir": self._project_folder
            }))
        except Exception as e:
            return self.fail_response(f"Failed to get preview URL: {e}")
