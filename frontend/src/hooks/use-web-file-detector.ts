import { useEffect, useRef } from 'react';
import { UnifiedMessage } from '@/components/thread/types';
import { usePreviewPanelStore } from '@/stores/use-preview-panel-store';

/**
 * Hook to detect web file creation and automatically switch from Computer panel to Preview panel
 * Implements Manus.ai-style auto-preview behavior
 */
export function useWebFileDetector(
  messages: UnifiedMessage[],
  sandboxId: string | null,
  setComputerPanelOpen: (open: boolean) => void,
  agentStatus?: string
) {
  const { openPanel: openPreviewPanel } = usePreviewPanelStore();
  const lastProcessedMessageId = useRef<string | null>(null);

  useEffect(() => {
    console.log('[WebFileDetector] Effect triggered:', {
      sandboxId,
      agentStatus,
      messagesCount: messages.length,
    });

    if (!sandboxId) {
      console.log('[WebFileDetector] No sandboxId, skipping');
      return;
    }
    // Don't skip on idle - we want to detect completed tool calls
    // even after agent has finished

    // Get last tool message
    const toolMessages = messages.filter(m => m.type === 'tool');
    console.log('[WebFileDetector] Tool messages found:', toolMessages.length);
    if (toolMessages.length === 0) return;

    const lastToolMsg = toolMessages[toolMessages.length - 1];
    console.log('[WebFileDetector] Last tool message:', {
      message_id: lastToolMsg.message_id,
      type: lastToolMsg.type,
      metadata: lastToolMsg.metadata,
    });

    // Avoid processing the same message multiple times
    if (lastToolMsg.message_id === lastProcessedMessageId.current) {
      return;
    }

    try {
      // Parse metadata (it's a JSON string)
      const metadata = typeof lastToolMsg.metadata === 'string'
        ? JSON.parse(lastToolMsg.metadata)
        : lastToolMsg.metadata;

      console.log('[WebFileDetector] Parsed metadata:', metadata);

      const functionName = metadata?.function_name;
      console.log('[WebFileDetector] Function name:', functionName);

      // Only process file creation
      if (functionName !== 'create_file') {
        console.log('[WebFileDetector] Not a create_file, skipping');
        return;
      }

      // Get file path from result.output (backend format)
      const result = metadata?.result;
      console.log('[WebFileDetector] Result:', result);

      if (!result || !result.success) {
        console.log('[WebFileDetector] No successful result, skipping');
        return;
      }

      // The file path is in result.output.file_path (structured data from backend)
      const output = result.output || {};
      console.log('[WebFileDetector] Output:', output);

      // Extract file path directly from structured output
      const filePath = output.file_path || '';
      console.log('[WebFileDetector] File path:', filePath);

      // Check if this is a web file
      if (isWebFile(filePath)) {
        console.log('[WebFileDetector] ✅ Detected web file:', filePath);

        // Mark as processed
        lastProcessedMessageId.current = lastToolMsg.message_id;

        // Close Computer panel
        setComputerPanelOpen(false);

        // Build preview URL (Daytona port 8080)
        const previewUrl = buildPreviewUrl(sandboxId, filePath);

        // Open Preview panel
        openPreviewPanel({
          url: previewUrl,
          level: 'preview',
          projectPath: filePath,
          framework: detectFramework(filePath),
          projectName: extractProjectName(filePath),
        });
      }
    } catch (e) {
      console.error('[WebFileDetector] Error processing message:', e);
    }
  }, [messages, sandboxId, agentStatus, setComputerPanelOpen, openPreviewPanel]);
}

/**
 * Check if file is a web-renderable file
 */
function isWebFile(filePath: string): boolean {
  const webExtensions = [
    '.html',
    '.htm',
    '.jsx',
    '.tsx',
    '.vue',
    '.svelte',
  ];

  const lowerPath = filePath.toLowerCase();
  return webExtensions.some(ext => lowerPath.endsWith(ext));
}

/**
 * Build Daytona preview URL
 */
function buildPreviewUrl(sandboxId: string, filePath: string): string {
  // Remove leading slash if present
  const normalizedPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;

  // Daytona preview URL format: https://8080-{sandboxId}.daytonaproxy.net/{filePath}
  return `https://8080-${sandboxId}.daytonaproxy01.net/${normalizedPath}`;
}

/**
 * Detect framework from file path
 */
function detectFramework(filePath: string): string | undefined {
  if (filePath.endsWith('.vue')) return 'vue';
  if (filePath.endsWith('.svelte')) return 'svelte';
  if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
    // Could be React, Next.js, etc. - default to 'react'
    return 'react';
  }
  if (filePath.endsWith('.html') || filePath.endsWith('.htm')) return 'static';

  return undefined;
}

/**
 * Extract project name from file path
 */
function extractProjectName(filePath: string): string {
  const parts = filePath.split('/');
  // If file is in a subdirectory, use the directory name
  if (parts.length > 1) {
    return parts[parts.length - 2];
  }
  // Otherwise use the filename without extension
  const filename = parts[parts.length - 1];
  return filename.replace(/\.[^/.]+$/, '');
}
