import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

interface FileItem {
  name: string;
  type: 'file' | 'folder';
  path: string;
  size?: number;
  children?: FileItem[];
}

/**
 * GET /api/sandbox/[sandboxId]/files
 * Get the file tree for a sandbox
 *
 * Query params:
 * - path: Optional path to list files from (default: root)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sandboxId: string }> }
) {
  try {
    const { sandboxId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path') || '/workspace';

    // Get backend URL from environment
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

    // Call backend API to get sandbox files
    const response = await fetch(`${backendUrl}/sandboxes/${sandboxId}/files?path=${encodeURIComponent(path)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[API] Failed to get sandbox files:`, error);
      return Response.json(
        { error: 'Failed to get sandbox files' },
        { status: response.status }
      );
    }

    const data = await response.json();
    // Backend returns { files: [...] }, extract the files array
    const files = data.files || [];
    return Response.json(files);
  } catch (error) {
    console.error('[API] Error in sandbox files route:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
