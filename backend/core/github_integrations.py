from fastapi import APIRouter, Request, HTTPException, Query, Depends
from fastapi.responses import RedirectResponse, HTMLResponse
import httpx
import urllib.parse
from typing import Optional, Dict, Any, List

from core.utils.config import config
from core.utils.logger import logger
from core.services.supabase import DBConnection
from core.utils.auth_utils import get_user_id_from_stream_auth

router = APIRouter(prefix="/github", tags=["GitHub Integration"])

@router.get("/connect")
async def github_connect(request: Request, token: str = Query(...)):
    """Redirects to GitHub OAuth authorization. Expects JWT token in query string param 'token'."""
    try:
        user_id = await get_user_id_from_stream_auth(request, token=token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Unauthorized: {str(e)}")

    client_id = config.GITHUB_CLIENT_ID
    if not client_id:
        raise HTTPException(status_code=500, detail="GITHUB_CLIENT_ID is not configured on the server")

    # We use the JWT token as state so we can securely identify the user in the callback
    state = token
    github_auth_url = "https://github.com/login/oauth/authorize"
    params = {
        "client_id": client_id,
        "scope": "repo",
        "state": state
    }
    url = f"{github_auth_url}?{urllib.parse.urlencode(params)}"
    return RedirectResponse(url)


@router.get("/callback")
async def github_callback(request: Request, code: str = Query(...), state: str = Query(...)):
    """Handles the GitHub OAuth callback, exchanging code for access token and saving to DB."""
    try:
        user_id = await get_user_id_from_stream_auth(request, token=state)
    except Exception as e:
        # Instead of generic 401, return a friendly error script
        return HTMLResponse("""
            <script>
                window.opener.postMessage({type: 'github-integration-error', message: 'Authentication failed during callback'}, '*');
                window.close();
            </script>
        """)

    client_id = config.GITHUB_CLIENT_ID
    client_secret = config.GITHUB_CLIENT_SECRET
    
    if not client_id or not client_secret:
        return HTMLResponse("""
            <script>
                window.opener.postMessage({type: 'github-integration-error', message: 'Server not configured for GitHub OAuth'}, '*');
                window.close();
            </script>
        """)

    # Exchange code for token
    token_url = "https://github.com/login/oauth/access_token"
    data = {
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code
    }
    headers = {"Accept": "application/json"}
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(token_url, data=data, headers=headers)
            response.raise_for_status()
            token_data = response.json()
            
            if "error" in token_data:
                logger.error(f"GitHub OAuth error: {token_data}")
                raise Exception(token_data.get("error_description", "Unknown error"))
                
            access_token = token_data.get("access_token")
            if not access_token:
                raise Exception("No access token returned")
                
        except Exception as e:
            logger.error(f"Failed to exchange GitHub code: {e}")
            return HTMLResponse(f"""
                <script>
                    window.opener.postMessage({{type: 'github-integration-error', message: 'Failed to obtain access token'}}, '*');
                    window.close();
                </script>
            """)

    # Save to Supabase
    try:
        db = DBConnection()
        supabase_client = await db.client
        
        # Upsert the token
        await supabase_client.table("github_oauth_tokens").upsert({
            "user_id": user_id,
            "access_token": access_token
        }).execute()
        
    except Exception as e:
        logger.error(f"Failed to save GitHub token to db: {e}")
        return HTMLResponse("""
            <script>
                window.opener.postMessage({type: 'github-integration-error', message: 'Failed to save integration data'}, '*');
                window.close();
            </script>
        """)

    # Success! Close popup and notify frontend
    return HTMLResponse("""
        <script>
            window.opener.postMessage({type: 'github-integration-success'}, '*');
            window.close();
        </script>
    """)

# Helper to get the github token for a user
async def get_github_access_token(user_id: str) -> Optional[str]:
    try:
        db = DBConnection()
        supabase_client = await db.client
        result = await supabase_client.table("github_oauth_tokens").select("access_token").eq("user_id", user_id).execute()
        
        if result.data and len(result.data) > 0:
            return result.data[0]["access_token"]
        return None
    except Exception as e:
        logger.error(f"Failed to fetch GitHub token for user {user_id}: {e}")
        return None

from pydantic import BaseModel

class PushRequest(BaseModel):
    sandbox_id: str
    repo_name: str
    is_private: bool = False

@router.post("/push")
async def push_to_github(
    payload: PushRequest,
    user_id: str = Depends(get_user_id_from_stream_auth)
):
    """Creates a new repository and pushes the sandbox code using git CLI."""
    access_token = await get_github_access_token(user_id)
    if not access_token:
        raise HTTPException(status_code=400, detail="Missing GitHub integration. Please connect your GitHub account first.")
        
    # 1. Verify token and get username
    async with httpx.AsyncClient() as client:
        user_resp = await client.get(
            "https://api.github.com/user",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github.v3+json"
            }
        )
        if user_resp.status_code != 200:
            raise HTTPException(status_code=401, detail="GitHub token is invalid or expired. Please reconnect.")
        
        github_user = user_resp.json()
        username = github_user.get("login")
        
    # 2. Create the repository
    async with httpx.AsyncClient() as client:
        create_resp = await client.post(
            "https://api.github.com/user/repos",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github.v3+json"
            },
            json={
                "name": payload.repo_name,
                "private": payload.is_private,
                "auto_init": False
            }
        )
        # 422 usually means repo already exists, which we can tolerate if we push to it securely
        if create_resp.status_code not in (201, 422):
            logger.error(f"GitHub repo creation failed: {create_resp.text}")
            raise HTTPException(status_code=500, detail="Failed to create GitHub repository")
            
    github_url = f"https://github.com/{username}/{payload.repo_name}"
    
    # 3. Use Daytona Sandbox to push the code
    try:
        from core.sandbox.sandbox import daytona
        from daytona_sdk import SessionExecuteRequest
        import uuid
        
        sandbox = await daytona.get(payload.sandbox_id)
        session_id = f"git-push-{uuid.uuid4().hex[:8]}"
        await sandbox.process.create_session(session_id)
        
        # Git commands sequence
        commands = [
            "git init",
            "git config --global user.email 'bot@talosai.com'",
            "git config --global user.name 'TalosAI Bot'",
            "git add .",
            "git commit -m 'Initial commit from TalosAI 🚀' || echo 'Nothing to commit'",
            "git branch -M main",
            f"git remote remove origin || true",
            f"git remote add origin https://oauth2:{access_token}@github.com/{username}/{payload.repo_name}.git",
            "git push -u origin main --force"
        ]
        
        for cmd in commands:
            req = SessionExecuteRequest(
                command=cmd,
                var_async=False,
                cwd="/workspace"
            )
            resp = await sandbox.process.execute_session_command(session_id, req)
            if resp.exit_code != 0 and cmd.startswith("git push"):
                raise Exception(f"Failed to push code (exit {resp.exit_code})")
                
        # Clean up session
        await sandbox.process.delete_session(session_id)
        
    except Exception as e:
        logger.error(f"Failed to push to GitHub sandbox {payload.sandbox_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        
    return {
        "success": True,
        "url": github_url,
        "message": "Project pushed to GitHub successfully"
    }

@router.get("/status")
async def github_status(user_id: str = Depends(get_user_id_from_stream_auth)):
    """Check if the user has connected their GitHub account."""
    access_token = await get_github_access_token(user_id)
    return {"connected": bool(access_token)}


# ============================================================================
# Database Inspector & Migration Endpoints
# SECURITY: Service role key NEVER leaves the backend.
# The agent calls POST /db/migrate with a JWT — the backend executes the SQL.
# ============================================================================

import re as _re

# Tables that should never be shown to users (internal / sensitive)
HIDDEN_TABLES = {
    'schema_migrations', 'spatial_ref_sys',
    'github_oauth_tokens',   # contains user OAuth tokens
    'users', 'sessions',     # Supabase auth internals
    '_supabase_migrations',
}

class MigrateRequest(BaseModel):
    sql: str

class ProvisionRequest(BaseModel):
    project_name: str
    region: str = "regions/aws-us-east-1"

@router.post("/db/provision")
async def provision_project_database(
    payload: ProvisionRequest,
    user_id: str = Depends(get_user_id_from_stream_auth)
):
    """
    Provision a dedicated TiDB Cloud Serverless cluster for a project.
    Each client project gets its own isolated database — completely separate from TalosAI's Supabase.
    Returns connection credentials that the agent injects into the project's .env file.
    """
    try:
        from core.services.tidb_cloud import create_serverless_cluster
        
        logger.info(f"Provisioning TiDB cluster for user {user_id}, project: {payload.project_name}")
        cluster_info = await create_serverless_cluster(
            project_name=payload.project_name,
            region=payload.region,
        )
        
        logger.info(f"TiDB cluster provisioned: {cluster_info.get('cluster_id')}")
        return {
            "success": True,
            "provider": "tidb_cloud",
            "cluster_id": cluster_info["cluster_id"],
            "cluster_name": cluster_info["cluster_name"],
            "host": cluster_info["host"],
            "port": cluster_info["port"],
            "username": cluster_info["username"],
            "password": cluster_info["password"],
            "database": cluster_info["database"],
            "connection_string": cluster_info["connection_string"],
            # Env vars to inject into the project's .env file
            "env_vars": {
                "DB_HOST": cluster_info["host"],
                "DB_PORT": str(cluster_info["port"]),
                "DB_USER": cluster_info["username"],
                "DB_PASSWORD": cluster_info["password"],
                "DB_NAME": cluster_info["database"],
                "DATABASE_URL": cluster_info["connection_string"],
            },
            "message": f"✅ TiDB Cloud Serverless cluster '{cluster_info['cluster_name']}' created. Add the env_vars to your project's .env file."
        }
    except Exception as e:
        logger.error(f"Failed to provision TiDB cluster: {e}")
        raise HTTPException(status_code=500, detail=f"Database provisioning failed: {str(e)}")



async def get_sandbox_db_connection(sandbox_id: Optional[str]) -> Optional[Dict[str, Any]]:
    """
    DISCOVERER: Reads .env from the sandbox to find the project's database.
    This allows the IDE Database Viewer to automatically connect to 
    the project's dedicated TiDB cluster if one was provisioned.
    """
    if not sandbox_id:
        return None
        
    try:
        from core.sandbox.sandbox import daytona
        sandbox = await daytona.get(sandbox_id)
        env_paths = ["app/.env", "app/.env.local", ".env", ".env.local"]
        for path in env_paths:
            try:
                content = await sandbox.filesystem.read_file(path)
                if not content: continue
                
                # Parse .env (simple key=value)
                env = {}
                for line in content.splitlines():
                    if '=' in line and not line.strip().startswith('#'):
                        k, v = line.strip().split('=', 1)
                        env[k.strip()] = v.strip()
                
                if "DATABASE_URL" in env:
                    url = env["DATABASE_URL"]
                    if "tidbcloud.com" in url or url.startswith("mysql"):
                        # Extract components from connection string or use discrete vars
                        return {
                            "provider": "tidb",
                            "host": env.get("DB_HOST", url.split('@')[-1].split(':')[0] if '@' in url else ""),
                            "username": env.get("DB_USER", url.split('://')[-1].split(':')[0] if '://' in url else ""),
                            "password": env.get("DB_PASSWORD", url.split(':')[-1].split('@')[0] if '@' in url else ""),
                            "port": int(env.get("DB_PORT", 4000)),
                            "database": env.get("DB_NAME", "test"),
                            "url": url
                        }
            except:
                continue
        return None
    except Exception as e:
        logger.error(f"Failed to discover sandbox DB: {e}")
        return None


async def execute_migration(
    payload: MigrateRequest,
    sandbox_id: Optional[str] = Query(None),
    user_id: str = Depends(get_user_id_from_stream_auth)
):
    """
    SECURE MIGRATION PROXY — Routes SQL to the correct DB (Supabase or TiDB).
    If sandbox_id is provided, it attempts to use the project's own DB first.
    """
    sql = payload.sql.strip()
    if len(sql) > 50_000:
        raise HTTPException(status_code=400, detail="SQL too large (max 50KB)")

    # Block dangerous operations
    FORBIDDEN = [
        r'\bDROP\s+DATABASE\b', r'\bDROP\s+SCHEMA\b',
        r'\bALTER\s+SYSTEM\b',
        r'\bCOPY\b.*\bTO\b.*\bPROGRAM\b',
        r'\b(pg_read_file|pg_write_file|lo_export)\b',
    ]
    for pattern in FORBIDDEN:
        if _re.search(pattern, sql.upper()):
            raise HTTPException(status_code=400, detail=f"Forbidden SQL operation: {pattern}")

    # ROUTING: Try to use project-specific DB if sandbox_id available
    if sandbox_id:
        conn = await get_sandbox_db_connection(sandbox_id)
        if conn and conn["provider"] == "tidb":
            try:
                import pymysql
                # Use pymysql for direct migration execution on TiDB
                connection = pymysql.connect(
                    host=conn["host"],
                    port=conn["port"],
                    user=conn["username"],
                    password=conn["password"],
                    database=conn["database"],
                    ssl={'rejectUnauthorized': True}
                )
                try:
                    with connection.cursor() as cursor:
                        # Split by semicolon for multiple statements (basic)
                        statements = [s.strip() for s in sql.split(';') if s.strip()]
                        for s in statements:
                            cursor.execute(s)
                    connection.commit()
                    return {
                        "success": True,
                        "provider": "tidb",
                        "message": "Migration executed on TiDB Cloud"
                    }
                finally:
                    connection.close()
            except Exception as e:
                logger.error(f"TiDB migration failed: {e}")
                raise HTTPException(status_code=500, detail=f"TiDB Migration failed: {str(e)}")

    # FALLBACK: Use Supabase (platform DB)
    try:
        db = DBConnection()
        client = await db.client
        result = await client.rpc('exec_sql', {'query': sql}).execute()
        return {
            "success": True,
            "provider": "supabase",
            "message": "Migration executed on Supabase",
            "rows_affected": len(result.data) if result.data else 0
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Migration failed for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Migration failed: {str(e)}")


@router.get("/db/tables")
async def list_db_tables(
    sandbox_id: Optional[str] = Query(None),
    user_id: str = Depends(get_user_id_from_stream_auth)
):
    """List user-facing tables (sensitive/internal tables filtered out)."""
    
    # ROUTING: Try project-specific DB first
    if sandbox_id:
        conn = await get_sandbox_db_connection(sandbox_id)
        if conn and conn["provider"] == "tidb":
            from core.services.tidb_cloud import list_tables as tidb_list_tables
            try:
                tables = await tidb_list_tables(conn)
                return {"tables": sorted(tables), "provider": "tidb"}
            except Exception as e:
                logger.error(f"Failed to list TiDB tables: {e}")
                # Don't fail completely, try falling back or returning error
                raise HTTPException(status_code=500, detail=f"TiDB error: {str(e)}")

    # FALLBACK: Supabase
    try:
        db = DBConnection()
        client = await db.client
        result = await client.rpc(
            'exec_sql',
            {'query': """
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                ORDER BY table_name;
            """}
        ).execute()
        all_tables = [row['table_name'] for row in (result.data or [])] if result.data else []
    except Exception:
        try:
            db = DBConnection()
            client = await db.client
            result = await client.from_('pg_catalog.pg_tables').select('tablename').eq('schemaname', 'public').execute()
            all_tables = [row['tablename'] for row in (result.data or [])]
        except Exception as e:
            logger.error(f"Failed to list DB tables: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    user_tables = [
        t for t in all_tables
        if t not in HIDDEN_TABLES
        and not t.startswith('_')
        and not t.startswith('auth_')
    ]
    return {"tables": sorted(user_tables), "provider": "supabase"}


@router.get("/db/table/{table_name}")
async def get_table_data(
    table_name: str,
    page: int = 0,
    page_size: int = 50,
    sandbox_id: Optional[str] = Query(None),
    user_id: str = Depends(get_user_id_from_stream_auth)
):
    """Get rows from a specific table with pagination."""
    if not _re.match(r'^[a-zA-Z0-9_]+$', table_name):
        raise HTTPException(status_code=400, detail="Invalid table name")
    
    # Block access to sensitive tables even via direct API calls
    if table_name in HIDDEN_TABLES:
        raise HTTPException(status_code=403, detail="Access to this table is restricted")
    
    # ROUTING: Try project-specific DB first
    if sandbox_id:
        conn = await get_sandbox_db_connection(sandbox_id)
        if conn and conn["provider"] == "tidb":
            from core.services.tidb_cloud import fetch_table_data as tidb_fetch_data
            try:
                data = await tidb_fetch_data(conn, table_name, page, page_size)
                return {**data, "provider": "tidb"}
            except Exception as e:
                logger.error(f"TiDB data fetch failed: {e}")
                raise HTTPException(status_code=500, detail=f"TiDB error: {str(e)}")

    # FALLBACK: Supabase
    try:
        db = DBConnection()
        client = await db.client
        
        offset = page * page_size
        result = await (
            client.table(table_name)
            .select('*', count='exact')
            .range(offset, offset + page_size - 1)
            .execute()
        )
        
        rows = result.data or []
        count = result.count or 0
        columns = list(rows[0].keys()) if rows else []
        
        return {
            "rows": rows,
            "columns": columns,
            "count": count,
            "page": page,
            "page_size": page_size,
            "provider": "supabase"
        }
        
    except Exception as e:
        logger.error(f"Failed to query table {table_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
