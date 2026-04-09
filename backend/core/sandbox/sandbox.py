"""
Talos Sandbox — E2B Code Interpreter Backend
=============================================
Replaces Daytona SDK with E2B Code Interpreter SDK.

E2B provides:
- Fast sandboxes (<150ms warmup)
- Native IPython kernel (Jupyter-style) via sandbox.notebook
- Filesystem R/W via sandbox.filesystem
- Process execution via sandbox.commands
- Persistent per-session environment
"""

from e2b_code_interpreter import AsyncSandbox
from dotenv import load_dotenv
from core.utils.logger import logger
from core.utils.config import config
from typing import Optional

load_dotenv()

E2B_API_KEY = config.E2B_API_KEY
E2B_TEMPLATE_ID = getattr(config, "E2B_TEMPLATE_ID", None) or "talos-sandbox-v1"

if E2B_API_KEY:
    logger.debug("E2B sandbox configured successfully")
else:
    logger.warning("No E2B_API_KEY found in environment variables — sandbox will be unavailable")


async def create_sandbox(password: str, project_id: Optional[str] = None) -> AsyncSandbox:
    """Create a new E2B sandbox with all required environment variables."""

    logger.info("Creating new E2B sandbox environment")

    env_vars = {
        "CHROME_PERSISTENT_SESSION": "true",
        "RESOLUTION": "1048x768x24",
        "RESOLUTION_WIDTH": "1048",
        "RESOLUTION_HEIGHT": "768",
        "VNC_PASSWORD": password,
        "ANONYMIZED_TELEMETRY": "false",
        "SUPABASE_URL": config.SUPABASE_URL or "",
        "SUPABASE_ANON_KEY": config.SUPABASE_ANON_KEY or "",
    }

    sandbox = await AsyncSandbox.create(
        template=E2B_TEMPLATE_ID,
        api_key=E2B_API_KEY,
        envs=env_vars,
        timeout=3600,  # 1h default lifetime
        metadata={"project_id": project_id or ""},
    )

    logger.info(f"E2B sandbox created with ID: {sandbox.sandbox_id}")
    return sandbox


async def get_or_start_sandbox(sandbox_id: str) -> AsyncSandbox:
    """Reconnect to an existing E2B sandbox by its ID."""
    logger.info(f"Reconnecting to E2B sandbox: {sandbox_id}")
    try:
        sandbox = await AsyncSandbox.connect(
            sandbox_id=sandbox_id,
            api_key=E2B_API_KEY,
        )
        logger.info(f"E2B sandbox {sandbox_id} reconnected successfully")
        return sandbox
    except Exception as e:
        logger.error(f"Error reconnecting to E2B sandbox {sandbox_id}: {e}")
        raise e


async def delete_sandbox(sandbox_id: str) -> bool:
    """Close/kill an E2B sandbox."""
    logger.info(f"Closing E2B sandbox: {sandbox_id}")
    try:
        sandbox = await AsyncSandbox.connect(
            sandbox_id=sandbox_id,
            api_key=E2B_API_KEY,
        )
        await sandbox.close()
        logger.info(f"E2B sandbox {sandbox_id} closed successfully")
        return True
    except Exception as e:
        logger.error(f"Error closing E2B sandbox {sandbox_id}: {e}")
        raise e
