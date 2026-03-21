from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from core.services.storage_service import get_snapshot_signed_url
from core.utils.logger import logger

router = APIRouter(prefix="/storage", tags=["storage"])

class RefreshUrlRequest(BaseModel):
    supabase_path: str

@router.post("/refresh-url")
async def refresh_url(request: RefreshUrlRequest):
    """
    Generates a new 1-hour signed URL for a private snapshot.
    This is used by the frontend to refresh expired links.
    """
    if not request.supabase_path:
        raise HTTPException(status_code=400, detail="Missing supabase_path")
    
    logger.debug(f"Refreshing signed URL for snapshot: {request.supabase_path}")
    
    signed_url = await get_snapshot_signed_url(request.supabase_path)
    if not signed_url:
        logger.warning(f"Failed to refresh signed URL for: {request.supabase_path}")
        raise HTTPException(status_code=404, detail="Failed to generate signed URL. File might not exist or storage is unavailable.")
    
    return {"signed_url": signed_url}
