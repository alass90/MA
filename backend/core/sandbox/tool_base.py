"""
SandboxToolsBase — E2B-backed base class for all Talos sandbox tools.
Replaces the Daytona AsyncSandbox with e2b_code_interpreter.AsyncSandbox.
"""

from typing import Optional
import uuid
import asyncio

from core.agentpress.thread_manager import ThreadManager
from core.agentpress.tool import Tool
from e2b_code_interpreter import AsyncSandbox
from core.sandbox.sandbox import get_or_start_sandbox, create_sandbox, delete_sandbox
from core.utils.logger import logger
from core.utils.files_utils import clean_path
from core.utils.config import config


class SandboxToolsBase(Tool):
    """Base class for all sandbox tools — E2B edition."""

    def __init__(self, project_id: str, thread_manager: Optional[ThreadManager] = None):
        super().__init__()
        self.project_id = project_id
        self.thread_manager = thread_manager
        self.workspace_path = "/workspace"
        self._sandbox: Optional[AsyncSandbox] = None
        self._sandbox_id: Optional[str] = None
        self._sandbox_pass: Optional[str] = None
        self._sandbox_url: Optional[str] = None

    async def _ensure_sandbox(self) -> AsyncSandbox:
        """
        Ensure a valid E2B sandbox instance exists for this project.
        If no sandbox is recorded in Supabase, creates one lazily and persists metadata.
        """
        if self._sandbox is not None:
            return self._sandbox

        try:
            client = await self.thread_manager.db.client

            project = await client.table('projects').select('*').eq('project_id', self.project_id).execute()
            if not project.data or len(project.data) == 0:
                raise ValueError(f"Project {self.project_id} not found")

            project_data = project.data[0]
            sandbox_info = project_data.get('sandbox') or {}

            if not sandbox_info.get('id'):
                logger.debug(f"No sandbox recorded for project {self.project_id}; creating lazily via E2B")
                sandbox_pass = str(uuid.uuid4())
                sandbox_obj = await create_sandbox(sandbox_pass, self.project_id)
                sandbox_id = sandbox_obj.sandbox_id

                logger.info(f"Waiting 2 seconds for E2B sandbox {sandbox_id} to initialize...")
                await asyncio.sleep(2)

                # E2B exposes ports via get_host(port) — returns a public URL
                try:
                    website_url = sandbox_obj.get_host(8080)
                    vnc_url = sandbox_obj.get_host(6080)
                    token = None  # E2B doesn't use VNC tokens
                except Exception:
                    logger.warning("Could not get preview URLs for E2B sandbox", exc_info=True)
                    website_url = None
                    vnc_url = None
                    token = None

                update_result = await client.table('projects').update({
                    'sandbox': {
                        'id': sandbox_id,
                        'pass': sandbox_pass,
                        'vnc_preview': vnc_url,
                        'sandbox_url': website_url,
                        'token': token,
                    }
                }).eq('project_id', self.project_id).execute()

                if not update_result.data:
                    try:
                        await delete_sandbox(sandbox_id)
                    except Exception:
                        logger.error(f"Failed to delete sandbox {sandbox_id} after DB update failure", exc_info=True)
                    raise Exception("Database update failed when storing sandbox metadata")

                # Update project cache
                try:
                    from core.runtime_cache import set_cached_project_metadata
                    await set_cached_project_metadata(self.project_id, {
                        'id': sandbox_id,
                        'pass': sandbox_pass,
                        'vnc_preview': vnc_url,
                        'sandbox_url': website_url,
                        'token': token,
                    })
                except Exception as cache_error:
                    logger.warning(f"Failed to update project cache: {cache_error}")

                self._sandbox_id = sandbox_id
                self._sandbox_pass = sandbox_pass
                self._sandbox_url = website_url
                self._sandbox = sandbox_obj

            else:
                self._sandbox_id = sandbox_info['id']
                self._sandbox_pass = sandbox_info.get('pass')
                self._sandbox_url = sandbox_info.get('sandbox_url')
                
                try:
                    self._sandbox = await get_or_start_sandbox(self._sandbox_id)
                except Exception as resume_err:
                    logger.warning(f"Failed to resume sandbox {self._sandbox_id} (likely expired or deleted): {resume_err}")
                    logger.info("Purging stale sandbox metadata to force fresh creation...")
                    
                    # 1. Clear database
                    await client.table('projects').update({'sandbox': {}}).eq('project_id', self.project_id).execute()
                    
                    # 2. Clear project cache
                    try:
                        from core.runtime_cache import set_cached_project_metadata
                        await set_cached_project_metadata(self.project_id, {})
                    except Exception:
                        pass
                        
                    # 3. Recursive retry (will trigger the creation flow above)
                    self._sandbox = None
                    self._sandbox_id = None
                    return await self._ensure_sandbox()

        except Exception as e:
            logger.error(f"Error retrieving/creating E2B sandbox for project {self.project_id}: {e}")
            raise e

        return self._sandbox

    @property
    def sandbox(self) -> AsyncSandbox:
        if self._sandbox is None:
            raise RuntimeError("Sandbox not initialized. Call _ensure_sandbox() first.")
        return self._sandbox

    @property
    def sandbox_id(self) -> str:
        if self._sandbox_id is None:
            raise RuntimeError("Sandbox ID not initialized. Call _ensure_sandbox() first.")
        return self._sandbox_id

    @property
    def sandbox_url(self) -> str:
        if self._sandbox_url is None:
            raise RuntimeError("Sandbox URL not initialized. Call _ensure_sandbox() first.")
        return self._sandbox_url

    def clean_path(self, path: str) -> str:
        cleaned_path = clean_path(path, self.workspace_path)
        logger.debug(f"Cleaned path: {path} -> {cleaned_path}")
        return cleaned_path

    async def get_preview_url(self, port: int) -> str:
        """Get a public preview URL for the given port — E2B equivalent of get_preview_link."""
        await self._ensure_sandbox()
        return self.sandbox.get_host(port)