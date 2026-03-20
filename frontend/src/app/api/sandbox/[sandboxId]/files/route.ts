import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

/**
 * GET /api/sandbox/[sandboxId]/files
 * Get all files in the sandbox workspace recursively
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sandboxId: string }> }
) {
  try {
    const { sandboxId } = await params;

    // Get backend URL from environment
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

    // Call backend API to get all workspace files
    const response = await fetch(`${backendUrl}/sandboxes/${sandboxId}/workspace-files`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[API] Failed to get sandbox workspace files:`, error);
      return Response.json(
        { error: 'Failed to get sandbox workspace files' },
        { status: response.status }
      );
    }

    const files = await response.json();
    return Response.json(files);
  } catch (error) {
    console.error('[API] Error in sandbox workspace files route:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
