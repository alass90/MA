"""
TiDB Cloud Management API Service
==================================
Provisions a dedicated TiDB Cloud Serverless cluster per project.
Each client project gets its own isolated database — completely separate from TalosAI's internal Supabase.

Architecture:
  TalosAI Supabase  ← internal platform data (users, threads, etc.)
  TiDB Cloud        ← one cluster per client project (isolated, secure)

Auth: HTTP Digest Authentication with public_key:private_key
API:  https://api.tidbcloud.com (v1beta / v1beta1)
"""

import httpx
from httpx import DigestAuth
import pymysql
import pymysql.cursors
from typing import Optional, List, Dict, Any
from core.utils.config import config
from core.utils.logger import logger

TIDB_API_BASE = "https://api.tidbcloud.com"


def _get_auth() -> DigestAuth:
    """Returns HTTP Digest Auth using TiDB Cloud API keys."""
    public_key = config.TIDB_CLOUD_PUBLIC_KEY
    private_key = config.TIDB_CLOUD_PRIVATE_KEY
    if not public_key or not private_key:
        raise ValueError("TIDB_CLOUD_PUBLIC_KEY and TIDB_CLOUD_PRIVATE_KEY must be set in .env")
    return DigestAuth(public_key, private_key)


async def list_projects() -> List[Dict[str, Any]]:
    """List all TiDB Cloud projects in the account."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{TIDB_API_BASE}/api/v1beta/projects",
                auth=_get_auth()
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("items", [])
    except Exception as e:
        logger.error(f"Failed to list TiDB projects: {e}")
        return []


async def get_default_project_id() -> str:
    """Get the first available TiDB Cloud project ID."""
    try:
        projects = await list_projects()
        if not projects:
            raise ValueError("No TiDB Cloud projects found. Please create one at tidbcloud.com")
        return str(projects[0]["id"])
    except Exception as e:
        logger.error(f"Failed to get default TiDB project: {e}")
        return ""


async def create_serverless_cluster(
    project_name: str,
    region: str = "regions/aws-us-east-1",
    spending_limit_monthly_usd: int = 5  # $5/month max by default
) -> Dict[str, Any]:
    """
    Create a new TiDB Cloud Serverless cluster for a project.
    Returns cluster info including connection details.
    """
    try:
        project_id = await get_default_project_id()
        
        # Sanitize cluster name: only alphanumeric and hyphens, max 64 chars
        # Using string filter to avoid re.sub linter issues
        safe_name = "".join(c if (c.isalnum() or c == '-') else '-' for c in project_name)[:60]
        cluster_name = f"talos-{safe_name.lower()}"
        
        payload = {
            "cluster": {
                "displayName": cluster_name,
                "region": {
                    "name": region
                },
                "spendingLimit": {
                    "monthly": spending_limit_monthly_usd * 100  # in cents
                }
            }
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{TIDB_API_BASE}/api/v1beta1/clusters",
                auth=_get_auth(),
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if resp.status_code not in (200, 201):
                logger.error(f"TiDB cluster creation failed: {resp.status_code} {resp.text}")
                return {}
            
            cluster_data = resp.json()
            logger.info(f"TiDB cluster created: {cluster_data}")
            
            cluster_id = cluster_data.get("clusterId") or cluster_data.get("id", "")
            status = cluster_data.get("status", {})
            conn_strings = status.get("connectionStrings", {}).get("defaultUser", {})
            
            host = conn_strings.get("host", "")
            username = conn_strings.get("user", "")
            password = conn_strings.get("password", "")
            port = 4000
            
            return {
                "cluster_id": cluster_id,
                "cluster_name": cluster_name,
                "project_id": project_id,
                "host": host,
                "port": port,
                "username": username,
                "password": password,
                "database": "test",
                "connection_string": f"mysql+pymysql://{username}:{password}@{host}:{port}/test?ssl=true",
                "jdbc_url": f"jdbc:mysql://{host}:{port}/test?ssl=true&user={username}&password={password}",
            }
    except Exception as e:
        logger.error(f"Failed to create TiDB cluster: {e}")
        return {}


async def get_cluster(cluster_id: str, project_id: Optional[str] = None) -> Dict[str, Any]:
    """Get cluster info and connection details."""
    try:
        if not project_id:
            project_id = await get_default_project_id()
        
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{TIDB_API_BASE}/api/v1beta1/clusters/{cluster_id}",
                auth=_get_auth()
            )
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        logger.error(f"Failed to get TiDB cluster: {e}")
        return {}


async def delete_cluster(cluster_id: str) -> bool:
    """Delete a TiDB Cloud cluster (used when a project is deleted)."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.delete(
                f"{TIDB_API_BASE}/api/v1beta1/clusters/{cluster_id}",
                auth=_get_auth()
            )
            return resp.status_code in (200, 204)
    except Exception as e:
        logger.error(f"Failed to delete TiDB cluster: {e}")
        return False


async def list_tables(conn_info: Dict[str, Any]) -> List[str]:
    """List all tables in the TiDB cluster."""
    try:
        connection = pymysql.connect(
            host=conn_info["host"],
            port=conn_info.get("port", 4000),
            user=conn_info["username"],
            password=conn_info["password"],
            database=conn_info.get("database", "test"),
            cursorclass=pymysql.cursors.DictCursor,
            ssl={'rejectUnauthorized': True}
        )
        try:
            with connection.cursor() as cursor:
                cursor.execute("SHOW TABLES")
                rows = cursor.fetchall()
                # Extract the first column from each row (result of SHOW TABLES)
                return [str(list(row.values())[0]) for row in rows]
        finally:
            connection.close()
    except Exception as e:
        logger.error(f"Failed to list TiDB tables: {e}")
        return []


async def fetch_table_data(
    conn_info: Dict[str, Any],
    table_name: str,
    page: int = 0,
    page_size: int = 50
) -> Dict[str, Any]:
    """Fetch rows from a specific TiDB table with pagination."""
    try:
        connection = pymysql.connect(
            host=conn_info["host"],
            port=conn_info.get("port", 4000),
            user=conn_info["username"],
            password=conn_info["password"],
            database=conn_info.get("database", "test"),
            cursorclass=pymysql.cursors.DictCursor,
            ssl={'rejectUnauthorized': True}
        )
        try:
            with connection.cursor() as cursor:
                # 1. Total count
                cursor.execute(f"SELECT COUNT(*) as total FROM `{table_name}`")
                res = cursor.fetchone()
                total = res["total"] if res else 0
                
                # 2. Page data
                offset = page * page_size
                cursor.execute(f"SELECT * FROM `{table_name}` LIMIT {page_size} OFFSET {offset}")
                rows = cursor.fetchall()
                
                # 3. Columns
                columns = [col[0] for col in cursor.description] if cursor.description else []
                
                return {
                    "rows": rows,
                    "columns": columns,
                    "count": total
                }
        finally:
            connection.close()
    except Exception as e:
        logger.error(f"Failed to fetch TiDB table data: {e}")
        return {"rows": [], "columns": [], "count": 0}


async def get_cluster_connection_string(cluster_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve the connection details for an existing cluster.
    Used to restore credentials after sandbox restart.
    """
    try:
        cluster = await get_cluster(cluster_id)
        status = cluster.get("status", {})
        conn = status.get("connectionStrings", {}).get("defaultUser", {})
        host = conn.get("host", "")
        username = conn.get("user", "")
        port = 4000
        return {
            "host": host,
            "port": port,
            "username": username,
            "database": "test",
        }
    except Exception as e:
        logger.error(f"Failed to get TiDB cluster connection: {e}")
        return None
