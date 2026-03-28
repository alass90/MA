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

logger = logging.getLogger("[SandboxMobileTool]")

@tool_metadata(
    display_name="Mobile App Builder",
    description="Scaffold, build, and run mobile applications (React Native / Expo) with live preview on your phone",
    icon="Smartphone",
    color="bg-emerald-100 dark:bg-emerald-800/50",
    is_core=False,
    weight=26,
    visible=True
)
class SandboxMobileTool(SandboxToolsBase):
    """Tool for managing Expo/React Native mobile projects in the Daytona sandbox."""

    def __init__(self, project_id: str, thread_manager: ThreadManager):
        super().__init__(project_id, thread_manager)
        self.dev_session_id = "talos-mobile-dev"
        self._dev_port = None
        self._project_folder = None
        self._expo_url = None

    async def _execute_blocking(self, command: str, cwd: str, timeout: int = 120) -> ToolResult:
        """Helper to run a blocking command via process session"""
        await self._ensure_sandbox()
        session_id = f"mob-{os.urandom(4).hex()}"
        try:
            await self.sandbox.process.create_session(session_id)
            result = await self.sandbox.process.execute_session_command(
                session_id,
                SessionExecuteRequest(command=command, cwd=cwd, var_async=False),
                timeout=timeout,
            )
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
            try:
                await self.sandbox.process.delete_session(session_id)
            except Exception:
                pass

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "manage_mobile_project",
            "description": "Manage mobile app project lifecycle (scaffold, start server, restart server, get preview URL) using Expo/React Native in the Daytona sandbox. Creates apps that can be previewed on real phones via Expo Go.",
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["scaffold", "start_server", "restart_server", "get_url"],
                        "description": "The action to perform: scaffold (creates a new Expo project and installs deps), start_server (runs Expo dev server with web and tunnel), restart_server (restarts the dev server), get_url (returns the preview URLs)."
                    },
                    "project_name": {
                        "type": "string",
                        "description": "The directory name for the project (relative to workspace). Defaults to 'mobile-app'."
                    }
                },
                "required": ["action"]
            }
        }
    })
    async def manage_mobile_project(
        self,
        action: str,
        project_name: str = "mobile-app"
    ) -> ToolResult:
        try:
            await self._ensure_sandbox()
            
            cwd = self.workspace_path
            if project_name and project_name != ".":
                cwd = f"{self.workspace_path}/{project_name}"

            if action == "scaffold":
                return await self._action_scaffold(project_name, cwd)
            elif action in ["start_server", "restart_server"]:
                return await self._action_start_server(cwd)
            elif action == "get_url":
                return await self._action_get_url()
            else:
                return self.fail_response(f"Unknown action: {action}")
                
        except Exception as e:
            logger.error(f"[MobileTool] Error managing project: {e}")
            return self.fail_response(f"Error: {str(e)}\n{traceback.format_exc()}")
            
    async def _action_scaffold(self, project_name: str, target_cwd: str) -> ToolResult:
        """Create a new Expo project with TypeScript template"""
        cwd = self.workspace_path
        
        # Install expo-cli globally first, then create the project
        cmd = (
            f"npx -y create-expo-app@latest {project_name} --template blank-typescript "
            f"&& cd {project_name} "
            f"&& npx expo install react-native-web react-dom @expo/metro-runtime"
        )
            
        logger.info(f"[MobileTool] Scaffolding Expo project at {project_name}...")
        res = await self._execute_blocking(cmd, cwd=cwd, timeout=300)
        
        if res.success:
            return self.success_response(
                f"Successfully scaffolded Expo project in {project_name}. "
                f"You must now call manage_mobile_project with action='start_server' to run it."
            )
        return res
        
    async def _action_start_server(self, cwd: str) -> ToolResult:
        """Start or restart the Expo dev server with web + tunnel"""
        # Cleanup existing session if it exists
        try:
            await self.sandbox.process.delete_session(self.dev_session_id)
        except Exception:
            pass
            
        await asyncio.sleep(1)
            
        # Expo web port
        port = 8081
        self._dev_port = port
        self._project_folder = cwd
        
        # Start Expo with web support and tunnel for QR code
        # --non-interactive prevents prompts
        cmd = f"npx expo start --web --tunnel --port {port} --non-interactive"

        # Recreate session
        try:
            await self.sandbox.process.create_session(self.dev_session_id)
        except Exception:
            pass
            
        logger.info(f"[MobileTool] Starting Expo dev server: {cmd} in {cwd}")
        
        # Run non-blocking
        await self.sandbox.process.execute_session_command(
            self.dev_session_id,
            SessionExecuteRequest(command=cmd, cwd=cwd, var_async=True)
        )
        
        # Allow server to boot up - Expo needs more time than Vite
        await asyncio.sleep(8)
        
        # Try to get the tunnel URL from logs
        expo_url = await self._extract_expo_tunnel_url()
        
        url_resp = await self._action_get_url()
        if not url_resp.success:
            return url_resp
            
        return self.success_response(
            f"Expo dev server started with web + tunnel mode.\n"
            f"Preview info:\n{url_resp.output}"
        )

    async def _extract_expo_tunnel_url(self) -> Optional[str]:
        """Extract the Expo tunnel URL from the dev server logs"""
        try:
            # Read session logs to find the tunnel URL
            session_id = f"tunnel-check-{os.urandom(4).hex()}"
            await self.sandbox.process.create_session(session_id)
            
            # Check tmux output for the tunnel URL  
            result = await self.sandbox.process.execute_session_command(
                session_id,
                SessionExecuteRequest(
                    command=f"tmux capture-pane -t {self.dev_session_id} -p -S - -E - 2>/dev/null || echo 'no-session'",
                    cwd=self.workspace_path,
                    var_async=False
                ),
                timeout=10,
            )
            
            output = ""
            if hasattr(result, 'output'):
                output = result.output
            elif hasattr(result, 'result'):
                output = result.result
            
            await self.sandbox.process.delete_session(session_id)
            
            # Look for tunnel URL pattern: exp://...
            import re
            tunnel_match = re.search(r'(exp://[^\s]+)', output)
            if tunnel_match:
                self._expo_url = tunnel_match.group(1)
                return self._expo_url
                
            # Also look for an expo.dev tunnel URL
            tunnel_match2 = re.search(r'(https?://[^\s]*\.exp\.direct[^\s]*)', output)
            if tunnel_match2:
                self._expo_url = tunnel_match2.group(1)
                return self._expo_url
                
            return None
        except Exception as e:
            logger.warning(f"[MobileTool] Could not extract tunnel URL: {e}")
            return None
        
    async def _action_get_url(self) -> ToolResult:
        """Returns the Daytona preview URL + Expo tunnel URL for QR code"""
        if not self._dev_port:
            return self.fail_response(
                "No dev server is currently known to be running (port unknown). "
                "Did you call start_server?"
            )
            
        try:
            preview_link = await self.sandbox.get_preview_link(self._dev_port)
            url = preview_link.url if hasattr(preview_link, 'url') else str(preview_link)
            
            clean_url = f"{url}#skip-warning" if url else url
            
            # If we don't have a tunnel URL yet, try to extract it
            if not self._expo_url:
                await self._extract_expo_tunnel_url()
            
            return self.success_response(json.dumps({
                "port": self._dev_port,
                "web_url": clean_url,
                "expo_url": self._expo_url or "",
                "qr_data": self._expo_url or clean_url,
                "project_dir": self._project_folder,
                "type": "mobile"
            }))
        except Exception as e:
            return self.fail_response(f"Failed to get preview URL: {e}")
