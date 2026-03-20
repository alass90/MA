import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

/**
 * POST /api/sandbox/[sandboxId]/presentation/save
 * Save updated presentation metadata and modified slide HTML files
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sandboxId: string }> }
) {
  try {
    const { sandboxId } = await params;
    const body = await request.json();
    const { presentationPath, slides } = body;

    if (!presentationPath || !slides || !Array.isArray(slides)) {
      return Response.json(
        { error: 'Missing required fields: presentationPath and slides array' },
        { status: 400 }
      );
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

    // 1. Save modified slide HTML files
    for (const slide of slides) {
      if (slide.htmlContent) {
        const fileResponse = await fetch(`${backendUrl}/sandboxes/${sandboxId}/file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: slide.path,
            content: slide.htmlContent
          }),
        });

        if (!fileResponse.ok) {
          const error = await fileResponse.text();
          console.error(`[API] Failed to save slide ${slide.id}:`, error);
          throw new Error(`Failed to save slide ${slide.id}`);
        }
      }
    }

    // 2. Prepare metadata.json content
    // We only save the fields required by our system
    const metadata = {
      presentation_name: presentationPath.split('/').pop(),
      title: body.title || 'Presentation',
      description: body.description || '',
      slides: {} as Record<string, any>,
      updated_at: new Date().toISOString()
    };

    slides.forEach((slide, index) => {
      metadata.slides[String(index + 1)] = {
        title: slide.title,
        filename: slide.path.split('/').pop(),
        file_path: slide.path,
        preview_url: `/workspace${slide.path}`,
        notes: slide.notes || '',
        created_at: slide.created_at || new Date().toISOString()
      };
    });

    // 3. Write metadata.json back to sandbox
    const metadataPath = `${presentationPath}/metadata.json`;
    const metaResponse = await fetch(`${backendUrl}/sandboxes/${sandboxId}/file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: metadataPath,
        content: JSON.stringify(metadata, null, 2)
      }),
    });

    if (!metaResponse.ok) {
      const error = await metaResponse.text();
      console.error(`[API] Failed to save metadata:`, error);
      throw new Error('Failed to save presentation metadata');
    }

    return Response.json({ success: true, path: presentationPath });
  } catch (error) {
    console.error('[API] Error in presentation save route:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
