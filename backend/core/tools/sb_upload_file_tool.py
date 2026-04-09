import os
import uuid
import mimetypes
import structlog
from datetime import datetime, timedelta
from typing import Optional
from pathlib import Path
 
from core.agentpress.tool import ToolResult, openapi_schema, tool_metadata
from core.sandbox.tool_base import SandboxToolsBase
from core.agentpress.thread_manager import ThreadManager
from core.utils.logger import logger
from core.utils.config import config
 
 
@tool_metadata(
    display_name="File Upload",
    description="Upload files to cloud storage and share them with secure links",
    icon="Upload",
    color="bg-teal-100 dark:bg-teal-800/50",
    weight=230,
    visible=True
)
class SandboxUploadFileTool(SandboxToolsBase):
 
    def __init__(self, project_id: str, thread_manager: ThreadManager):
        super().__init__(project_id, thread_manager)
        from core.utils.db_helpers import get_initialized_db
        self.db = get_initialized_db()
 
    # ─────────────────────────────────────────────
    # HELPERS
    # ─────────────────────────────────────────────
 
    def _clean_file_path(self, file_path: str) -> str:
        """Normalise le chemin relatif au workspace."""
        # Supprimer /workspace/ ou workspace/ en préfixe
        path = file_path.strip()
        for prefix in ["/workspace/", "workspace/", "/workspace"]:
            if path.startswith(prefix):
                path = path[len(prefix):]
        return path.lstrip("/")
 
    def _format_file_size(self, size_bytes: int) -> str:
        for unit in ["B", "KB", "MB", "GB"]:
            if size_bytes < 1024.0:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.1f} TB"
 
    def _guess_content_type(self, filename: str) -> str:
        content_type, _ = mimetypes.guess_type(filename)
        if content_type:
            return content_type
        ext = Path(filename).suffix.lower()
        fallbacks = {
            ".pdf":  "application/pdf",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            ".csv":  "text/csv",
            ".json": "application/json",
            ".png":  "image/png",
            ".jpg":  "image/jpeg",
            ".jpeg": "image/jpeg",
            ".mp3":  "audio/mpeg",
            ".mp4":  "video/mp4",
            ".zip":  "application/zip",
        }
        return fallbacks.get(ext, "application/octet-stream")
 
    async def _get_current_account_id(self) -> str:
        """Récupère l'account_id depuis le contexte d'exécution."""
        try:
            context_vars = structlog.contextvars.get_contextvars()
            thread_id = context_vars.get("thread_id")
            if not thread_id:
                logger.warning("[UploadTool] No thread_id in context — using 'default'")
                return "default"
            from core.utils.auth_utils import get_account_id_from_thread
            return await get_account_id_from_thread(thread_id, self.db)
        except Exception as e:
            logger.warning(f"[UploadTool] Could not resolve account_id: {e}")
            return "default"
 
    async def _track_upload(
        self,
        client,
        account_id: str,
        storage_path: str,
        bucket_name: str,
        original_filename: str,
        file_size: int,
        content_type: str,
        signed_url: str,
        url_expires_at: datetime,
    ):
        """Trace l'upload en base de données (non-bloquant sur erreur)."""
        try:
            context_vars = structlog.contextvars.get_contextvars()
            thread_id = context_vars.get("thread_id")
            agent_id = None
            user_id = None
 
            if thread_id:
                try:
                    thread_result = (
                        await client.table("threads")
                        .select("agent_id")
                        .eq("thread_id", thread_id)
                        .execute()
                    )
                    if thread_result.data:
                        agent_id = thread_result.data[0].get("agent_id")
                except Exception:
                    pass
 
            try:
                account_result = (
                    await client.table("basejump.account_user")
                    .select("user_id")
                    .eq("account_id", account_id)
                    .limit(1)
                    .execute()
                )
                if account_result.data:
                    user_id = account_result.data[0].get("user_id")
            except Exception:
                pass
 
            upload_data = {
                "project_id": self.project_id,
                "thread_id": thread_id,
                "agent_id": agent_id,
                "account_id": account_id,
                "user_id": user_id,
                "bucket_name": bucket_name,
                "storage_path": storage_path,
                "original_filename": original_filename,
                "file_size": file_size,
                "content_type": content_type,
                "signed_url": signed_url,
                "url_expires_at": url_expires_at.isoformat(),
                "metadata": {
                    "uploaded_from": "sandbox",
                    "tool": "upload_file",
                    "secure_upload": True,
                },
            }
            await client.table("file_uploads").insert(upload_data).execute()
 
        except Exception as e:
            # Non-bloquant — l'upload a réussi même si le tracking échoue
            logger.warning(f"[UploadTool] Failed to track upload in DB: {e}")
 
    # ─────────────────────────────────────────────
    # TOOL
    # ─────────────────────────────────────────────
 
    @openapi_schema({
        "type": "function",
        "function": {
            "name": "upload_file",
            "description": (
                "Upload a file from the sandbox workspace to private cloud storage (Supabase). "
                "Returns a secure signed URL valid for 24 hours. "
                "Use this when the user asks to share, download, or export a file. "
                "File path must be relative to /workspace (e.g. 'output/report.pdf')."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": (
                            "Path to the file in the sandbox, relative to /workspace. "
                            "Examples: 'output/report.pdf', 'data/results.csv', 'chart.png'"
                        ),
                    },
                    "custom_filename": {
                        "type": "string",
                        "description": (
                            "Optional custom filename for the uploaded file. "
                            "If not provided, uses original filename with timestamp."
                        ),
                    },
                },
                "required": ["file_path"],
            },
        }
    })
    async def upload_file(
        self,
        file_path: str,
        custom_filename: Optional[str] = None,
    ) -> ToolResult:
        try:
            await self._ensure_sandbox()
 
            # ── 1. Résoudre le chemin
            clean = self._clean_file_path(file_path)
            full_path = f"{self.workspace_path}/{clean}"
 
            # ── 2. Lire le fichier via l'API E2B correcte
            try:
                file_content = await self.sandbox.filesystem.read(full_path)
            except Exception:
                return self.fail_response(
                    f"File '{clean}' not found in /workspace. "
                    f"Make sure it exists before uploading."
                )
 
            # Normaliser en bytes
            if isinstance(file_content, str):
                file_bytes = file_content.encode("utf-8")
            else:
                file_bytes = file_content
 
            # ── 3. Vérifier la taille (50 MB max)
            file_size = len(file_bytes)
            if file_size > 50 * 1024 * 1024:
                return self.fail_response(
                    f"File '{clean}' is too large "
                    f"({self._format_file_size(file_size)}). Maximum is 50 MB."
                )
 
            if file_size == 0:
                return self.fail_response(f"File '{clean}' is empty — nothing to upload.")
 
            # ── 4. Préparer les métadonnées
            original_filename = os.path.basename(clean)
            file_extension = Path(original_filename).suffix.lower()
            content_type = self._guess_content_type(original_filename)
 
            if custom_filename:
                storage_filename = custom_filename
            else:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                unique_id = str(uuid.uuid4())[:8]
                name_base = Path(original_filename).stem
                storage_filename = f"{name_base}_{timestamp}_{unique_id}{file_extension}"
 
            # ── 5. Résoudre l'account_id
            account_id = await self._get_current_account_id()
            storage_path = f"{account_id}/{storage_filename}"
            bucket_name = "file-uploads"
 
            # ── 6. Upload vers Supabase Storage
            try:
                client = await self.db.client
 
                await client.storage.from_(bucket_name).upload(
                    storage_path,
                    file_bytes,
                    {"content-type": content_type},
                )
 
                # Générer une URL signée (24h)
                expires_in = 24 * 60 * 60
                signed_url_response = await client.storage.from_(bucket_name).create_signed_url(
                    storage_path,
                    expires_in,
                )
 
                signed_url = signed_url_response.get("signedURL")
                if not signed_url:
                    return self.fail_response(
                        "Upload succeeded but failed to generate secure access URL."
                    )
 
                url_expires_at = datetime.now() + timedelta(seconds=expires_in)
 
            except Exception as e:
                logger.error(f"[UploadTool] Supabase upload failed: {e}")
                return self.fail_response(f"Failed to upload to secure storage: {str(e)}")
 
            # ── 7. Tracker en base (non-bloquant)
            await self._track_upload(
                client,
                account_id,
                storage_path,
                bucket_name,
                original_filename,
                file_size,
                content_type,
                signed_url,
                url_expires_at,
            )
 
            # ── 8. Retourner le résultat
            return self.success_response({
                "message": (
                    f"File '{original_filename}' uploaded successfully. "
                    f"Size: {self._format_file_size(file_size)}. "
                    f"URL expires: {url_expires_at.strftime('%Y-%m-%d %H:%M UTC')}."
                ),
                "download_url": signed_url,
                "original_filename": original_filename,
                "file_size": self._format_file_size(file_size),
                "content_type": content_type,
                "expires_at": url_expires_at.isoformat(),
                "storage_path": f"{bucket_name}/{storage_path}",
            })
 
        except Exception as e:
            logger.error(f"[UploadTool] Unexpected error: {e}", exc_info=True)
            return self.fail_response(f"Unexpected error during file upload: {str(e)}")