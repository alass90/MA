"""
SandboxShellTool — E2B Edition
Replaces Daytona's tmux-based session execution with E2B commands API.

E2B API:
  - sandbox.commands.run(cmd, ...)       → blocking execution → result.stdout / result.exit_code
  - await sandbox.commands.start(cmd, ...) → non-blocking → BackgroundCommand object
  - cmd.wait()                           → wait for background command
  - cmd.kill()                           → terminate background command
"""

import asyncio
import os
from typing import Optional, Dict
from core.agentpress.tool import ToolResult, openapi_schema, tool_metadata
from core.sandbox.tool_base import SandboxToolsBase
from core.agentpress.thread_manager import ThreadManager
from core.utils.logger import logger


@tool_metadata(
    display_name="Terminal & Commands",
    description="Run commands, install packages, and execute scripts in your workspace",
    icon="Terminal",
    color="bg-gray-100 dark:bg-gray-800/50",
    is_core=True,
    weight=20,
    visible=True
)
class SandboxShellTool(SandboxToolsBase):
    """Tool for executing shell commands in an E2B sandbox."""

    def __init__(self, project_id: str, thread_manager: ThreadManager):
        super().__init__(project_id, thread_manager)
        # Map session_name → E2B background command handle
        self._bg_commands: Dict[str, object] = {}

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "execute_command",
            "description": (
                "Execute a shell command in the workspace directory. "
                "Two modes:\n"
                "(1) BLOCKING (blocking=true): Runs synchronously, waits for completion, returns full output. "
                "Use this for quick operations (installs, file ops, builds < 5min).\n"
                "(2) NON-BLOCKING (blocking=false, default): Runs in the background. "
                "Returns a session_name you can pass to check_command_output. "
                "Use this for long-running servers (npm run dev, watch processes, etc)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "The shell command to execute. Commands can be chained with &&, ||, and |."
                    },
                    "folder": {
                        "type": "string",
                        "description": "Optional subdirectory of /workspace to execute in (e.g. 'my-app')."
                    },
                    "session_name": {
                        "type": "string",
                        "description": "Optional name used to track a NON-BLOCKING command for later status checks."
                    },
                    "blocking": {
                        "type": "boolean",
                        "description": "If true, wait for command completion before returning (default false).",
                        "default": False
                    },
                    "timeout": {
                        "type": "integer",
                        "description": "Timeout in seconds for blocking commands (default 60).",
                        "default": 60
                    }
                },
                "required": ["command"]
            }
        }
    })
    async def execute_command(
        self,
        command: str,
        folder: Optional[str] = None,
        session_name: Optional[str] = None,
        blocking: bool = False,
        timeout: int = 60
    ) -> ToolResult:
        try:
            await self._ensure_sandbox()

            cwd = self.workspace_path
            if folder:
                cwd = os.path.normpath(f"{self.workspace_path}/{folder.strip('/')}")
                if not cwd.startswith(self.workspace_path):
                    return self.fail_response("Invalid folder path — must be within /workspace")

            if not session_name:
                import uuid
                session_name = f"session_{str(uuid.uuid4())[:8]}"

            if blocking:
                try:
                    result = await self.sandbox.commands.run(
                        command,
                        cwd=cwd,
                        timeout=timeout,
                    )
                except TimeoutError:
                    return self.fail_response(f"Command timed out after {timeout}s: {command[:100]}")
                return self.success_response({
                    "output": (result.stdout or "") + (result.stderr or ""),
                    "exit_code": result.exit_code,
                    "cwd": cwd,
                    "completed": True,
                })
            else:
                # Non-blocking — store the handle keyed by session_name
                cmd_handle = await self.sandbox.commands.start(
                    command,
                    cwd=cwd,
                )
                self._bg_commands[session_name] = cmd_handle
                return self.success_response({
                    "session_name": session_name,
                    "cwd": cwd,
                    "message": f"Command started in background as '{session_name}'. Use check_command_output to monitor.",
                    "completed": False,
                })

        except Exception as e:
            return self.fail_response(f"Error executing command: {str(e)}")

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "check_command_output",
            "description": (
                "Check the output of a NON-BLOCKING command. "
                "Only use this for commands launched with blocking=false."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "session_name": {
                        "type": "string",
                        "description": "The session_name returned by execute_command."
                    },
                    "kill_session": {
                        "type": "boolean",
                        "description": "If true, kill the background command after reading output.",
                        "default": False
                    }
                },
                "required": ["session_name"]
            }
        }
    })
    async def check_command_output(
        self,
        session_name: str,
        kill_session: bool = False
    ) -> ToolResult:
        try:
            await self._ensure_sandbox()

            cmd = self._bg_commands.get(session_name)
            if cmd is None:
                return self.fail_response(f"No background command found for session '{session_name}'.")

            # Collect buffered output
            result = await cmd.wait()
            stdout = result.stdout or ""
            stderr = result.stderr or ""
            if isinstance(stdout, bytes):
                stdout = stdout.decode('utf-8', errors='replace')
            if isinstance(stderr, bytes):
                stderr = stderr.decode('utf-8', errors='replace')

            if kill_session:
                try:
                    await cmd.kill()
                except Exception:
                    pass
                del self._bg_commands[session_name]

            return self.success_response({
                "output": stdout + stderr,
                "session_name": session_name,
                "status": "killed" if kill_session else "running",
            })

        except Exception as e:
            return self.fail_response(f"Error checking command output: {str(e)}")

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "terminate_command",
            "description": "Terminate a running background command.",
            "parameters": {
                "type": "object",
                "properties": {
                    "session_name": {
                        "type": "string",
                        "description": "The session_name of the command to terminate."
                    }
                },
                "required": ["session_name"]
            }
        }
    })
    async def terminate_command(self, session_name: str) -> ToolResult:
        try:
            cmd = self._bg_commands.get(session_name)
            if cmd is None:
                return self.fail_response(f"No background command found for '{session_name}'.")
            await cmd.kill()
            del self._bg_commands[session_name]
            return self.success_response({"message": f"Command '{session_name}' terminated."})
        except Exception as e:
            return self.fail_response(f"Error terminating command: {str(e)}")

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "list_commands",
            "description": "List all active background commands.",
            "parameters": {
                "type": "object", 
                "properties": {},
                "required": []
            }
        }
    })
    async def list_commands(self) -> ToolResult:
        sessions = list(self._bg_commands.keys())
        return self.success_response({
            "message": f"Found {len(sessions)} active background commands.",
            "sessions": sessions,
        })