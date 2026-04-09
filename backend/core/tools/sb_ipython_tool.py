"""
SandboxIPythonTool — Kimi-style IPython / Jupyter Kernel for Talos
===================================================================
This is the E2B-native equivalent of Kimi's `mshtools-ipython`.

Key capabilities:
- Persistent Python kernel (variables survive between calls)
- Inline matplotlib charts (returned as base64 images in the response)
- Auto-restart on crash
- Full pandas / numpy / scipy support out of the box
"""

import asyncio
import base64
import json
from typing import Optional

from core.agentpress.tool import ToolResult, openapi_schema, tool_metadata
from core.sandbox.tool_base import SandboxToolsBase
from core.agentpress.thread_manager import ThreadManager
from core.utils.logger import logger


@tool_metadata(
    display_name="Python (IPython)",
    description="Execute Python code in a persistent Jupyter-style kernel. Variables, imports, and figures persist between calls.",
    icon="Code2",
    color="bg-yellow-100 dark:bg-yellow-800/50",
    is_core=True,
    weight=15,
    visible=True
)
class SandboxIPythonTool(SandboxToolsBase):
    """
    Persistent IPython kernel backed by E2B's native Jupyter support.

    Equivalent to Kimi's `mshtools-ipython` tool.
    Each project gets ONE kernel that lives for the duration of the conversation.
    Charts are returned inline as base64-encoded PNG data URIs.
    """

    def __init__(self, project_id: str, thread_manager: ThreadManager):
        super().__init__(project_id, thread_manager)

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "execute_python",
            "description": (
                "Execute Python code in a persistent IPython/Jupyter kernel. "
                "Variables, imports, and figures survive between calls — just like a Jupyter Notebook.\n\n"
                "Use this for:\n"
                "- Data analysis (pandas, numpy, scipy)\n"
                "- Chart generation (matplotlib, seaborn, plotly)\n"
                "- Long computations that benefit from cached results\n"
                "- Any Python code that needs to run in a REPL-style loop\n\n"
                "Charts generated with matplotlib will be returned as base64 images in the response."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "code": {
                        "type": "string",
                        "description": "Python code to execute in the persistent kernel."
                    },
                    "restart": {
                        "type": "boolean",
                        "description": "If true, restart the kernel before executing (clears all variables). Default false.",
                        "default": False
                    }
                },
                "required": ["code"]
            }
        }
    })
    async def execute_python(self, code: str, restart: bool = False) -> ToolResult:
        try:
            await self._ensure_sandbox()

            if restart:
                await self.sandbox.commands.run("pkill -f jupyter || true")
                logger.info("[IPython] Kernel restarted via process kill")

            logger.debug(f"[IPython] Executing: {code[:120]}{'...' if len(code) > 120 else ''}")

            # IPython Simulation: Pre-parse magic commands (!shell) common in LLM outputs
            cleaned_lines = []
            output_parts = []
            
            for line in code.split("\n"):
                stripped = line.strip()
                if stripped.startswith("!") and not stripped.startswith("!="):
                    shell_cmd = stripped[1:].strip()
                    logger.debug(f"[IPython Magic] Running shell: {shell_cmd}")
                    cmd_res = await self.sandbox.commands.run(shell_cmd)
                    if cmd_res.stdout:
                        output_parts.append(cmd_res.stdout)
                    if cmd_res.stderr:
                        output_parts.append("[stderr]: " + cmd_res.stderr)
                elif stripped.startswith("%"):
                    logger.debug(f"[IPython Magic] Ignoring unsupported magic: {stripped}")
                else:
                    cleaned_lines.append(line)
                    
            cleaned_code = "\n".join(cleaned_lines)
            
            # Text output starts with magic shell outputs (if any)
            images = []

            if cleaned_code.strip():
                # E2B Code Interpreter: run_code returns Execution object natively
                try:
                    execution = await asyncio.wait_for(
                        self.sandbox.run_code(cleaned_code),
                        timeout=120
                    )
                except asyncio.TimeoutError:
                    return self.fail_response("IPython execution timed out after 120 seconds. Code was running indefinitely.")

                if hasattr(execution, 'logs'):
                    if execution.logs.stdout:
                        output_parts.append("\n".join(execution.logs.stdout))
                    if execution.logs.stderr:
                        output_parts.append("[stderr]: " + "\n".join(execution.logs.stderr))

                if execution.text and execution.text.strip() not in "\n".join(output_parts):
                    output_parts.append(execution.text)

                for result in (getattr(execution, 'results', []) or []):
                    if hasattr(result, 'png') and getattr(result, 'png'):
                        images.append({
                            "type": "image/png",
                            "data": result.png,
                            "url": f"data:image/png;base64,{result.png}"
                        })

                if execution.error:
                    return self.fail_response(json.dumps({
                        "error": execution.error.name,
                        "traceback": execution.error.traceback,
                        "output": "\n".join(output_parts).strip(),
                    }))

            text_output = "\n".join(output_parts).strip()

            return self.success_response(json.dumps({
                "output": text_output or "(no output)",
                "images": images,
                "image_count": len(images),
            }))

        except Exception as e:
            logger.error(f"[IPython] Execution error: {e}", exc_info=True)
            return self.fail_response(f"IPython execution error: {str(e)}")
