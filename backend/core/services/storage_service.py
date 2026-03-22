import os
import mimetypes
from datetime import datetime
from core.utils.logger import logger
from core.services.supabase import DBConnection
from core.sandbox.sandbox import get_or_start_sandbox

async def upload_generated_file_to_supabase(sandbox_id: str, file_path: str, bucket_name: str = "file-uploads") -> str:
    """
    Downloads a file from a Daytona sandbox and uploads it to Supabase Storage.
        tuple: (signed_url, storage_path) or (None, None) if the upload failed.
    """
    try:
        # 1. Get the sandbox
        sandbox = await get_or_start_sandbox(sandbox_id)
        
        # 2. Download the file content from the sandbox
        logger.debug(f"Downloading file {file_path} from sandbox {sandbox_id}")
        try:
            file_content = await sandbox.fs.download_file(file_path)
        except Exception as e:
            logger.warning(f"Failed to download file {file_path} from sandbox {sandbox_id}: {str(e)}")
            return None, None
        
        # 3. Determine content type based on extension
        content_type, _ = mimetypes.guess_type(file_path)
        if not content_type:
            # Fallback for common types if guess_type fails
            ext = os.path.splitext(file_path)[1].lower()
            if ext == '.pdf':
                content_type = 'application/pdf'
            elif ext == '.docx':
                content_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            elif ext == '.xlsx':
                content_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            else:
                content_type = "application/octet-stream"
            
        # 4. Generate a unique path for Supabase Storage
        # Folder structure: {sandbox_id}/{timestamp}_{filename}
        # This ensures uniqueness even if the same file name is used across different messages
        filename = os.path.basename(file_path)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        unique_path = f"{sandbox_id}/{timestamp}_{filename}"
        
        # 5. Get Supabase client and upload
        db = DBConnection()
        client = await db.client
        
        logger.debug(f"Uploading snapshot of {file_path} to Supabase bucket '{bucket_name}' as '{unique_path}'")
        
        # Uploading to Supabase Storage
        # We use the service role client which bypasses RLS for uploads if configured
        await client.storage.from_(bucket_name).upload(
            unique_path,
            file_content,
            {"content-type": content_type}
        )
        
        # 6. Generate a signed URL (private access)
        # 1 hour expiry as requested
        expires_in = 3600 
        signed_url_resp = await client.storage.from_(bucket_name).create_signed_url(unique_path, expires_in)
        
        # In supabase-py 2.x, resp is a dict like {'signedURL': '...'}
        signed_url = signed_url_resp.get('signedURL', None)
        
        if not signed_url:
            logger.warning(f"Failed to generate signed URL for {unique_path}")
            return None, None

        logger.info(f"Successfully created Private Snapshot for {filename}: {unique_path}")
        return signed_url, unique_path
        
    except Exception as e:
        logger.error(f"Error in upload_generated_file_to_supabase: {str(e)}")
        # We catch all errors to ensure the main agent loop continues even if snapshotting fails
        return None, None

async def get_snapshot_signed_url(storage_path: str, bucket_name: str = "file-uploads", expires_in: int = 3600) -> str:
    """
    Generates a new signed URL for an existing snapshot in Supabase Storage.
    
    Args:
        storage_path: The unique path in the storage bucket
        bucket_name: The name of the Supabase Storage bucket
        expires_in: Expiry time in seconds (default 1 hour)
        
    Returns:
        str: The new signed URL, or None if generation failed.
    """
    try:
        db = DBConnection()
        client = await db.client
        
        resp = await client.storage.from_(bucket_name).create_signed_url(storage_path, expires_in)
        return resp.get('signedURL', None)
    except Exception as e:
        logger.error(f"Error generating fresh signed URL for {storage_path}: {str(e)}")
        return None
