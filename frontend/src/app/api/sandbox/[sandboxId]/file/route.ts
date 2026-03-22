import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

/**
 * GET /api/sandbox/[sandboxId]/file
 * Get the content of a specific file in the sandbox
 *
 * Query params:
 * - path: File path in the sandbox (required)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sandboxId: string }> }
) {
  try {
    const { sandboxId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const filePath = searchParams.get('path');

    if (!filePath) {
      return Response.json(
        { error: 'Missing required parameter: path' },
        { status: 400 }
      );
    }

    // Get backend URL from environment
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

    // Get the authorization header from the incoming request
    const authHeader = request.headers.get('Authorization');

    // Call backend API to get file content
    // Backend endpoint is /sandboxes/{id}/files/content
    const response = await fetch(`${backendUrl}/sandboxes/${sandboxId}/files/content?path=${encodeURIComponent(filePath)}`, {
      method: 'GET',
      headers: authHeader ? { 'Authorization': authHeader } : {},
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[API] Failed to get sandbox file:`, error);
      return Response.json(
        { error: 'Failed to get sandbox file' },
        { status: response.status }
      );
    }

    // Backend returns the file content as binary
    const content = await response.text();

    if (searchParams.get('raw') === 'true') {
      return new Response(content, {
        headers: { 
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache'
        },
      });
    }

    return Response.json({ content, path: filePath });
  } catch (error) {
    console.error('[API] Error in sandbox file route:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sandbox/[sandboxId]/file
 * Write a single file to the sandbox
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sandboxId: string }> }
) {
  try {
    const { sandboxId } = await params;
    const body = await request.json();
    const { path, content } = body;

    if (!path) {
      return Response.json(
        { error: 'Missing required field: path' },
        { status: 400 }
      );
    }

    // Get backend URL from environment
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

    // Call backend API to write file
    const response = await fetch(`${backendUrl}/sandboxes/${sandboxId}/file`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path, content }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[API] Failed to write sandbox file:`, error);
      return Response.json(
        { error: 'Failed to write sandbox file' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    console.error('[API] Error in sandbox file POST route:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
