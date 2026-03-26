import { useEffect, useRef } from 'react';
import { useDesignerStore } from '@/stores/use-designer-store';
import { UnifiedMessage } from '@/components/thread/types';
import { extractDesignerData } from '@/components/thread/tool-views/designer-tool/_utils';

/**
 * Hook to detect designer tool calls and automatically open the Designer Canvas
 */
export function useDesignerDetector(messages: UnifiedMessage[] | undefined, sandboxId: string | null) {
  const { openPanel, addElement, elements } = useDesignerStore();
  const processedMessageIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!messages || messages.length === 0) return;

    messages.forEach((message) => {
      // Skip already processed messages to avoid duplicates
      if (message.message_id && processedMessageIds.current.has(message.message_id)) return;

      let parsedMetadata: any;
      try {
        parsedMetadata = typeof message.metadata === 'string' ? JSON.parse(message.metadata) : message.metadata;
      } catch {
        return;
      }

      if (!parsedMetadata) return;

      const isDesignerTool = (name: string) => name === 'designer_create_or_edit';

      // 1. Check for tool calls in assistant messages (to open panel early)
      if (parsedMetadata.tool_calls) {
        for (const tc of parsedMetadata.tool_calls) {
          if (isDesignerTool(tc.function?.name)) {
            openPanel();
          }
        }
      }

      // 2. Check for completed tool results
      if (message.type === 'tool' && parsedMetadata.tool_call_metadata) {
        const toolName = parsedMetadata.tool_call_metadata.name;
        
        if (isDesignerTool(toolName)) {
          // Open panel if not already open
          openPanel();

          // Extract designer data using the existing utility
          const designerData = extractDesignerData(
            parsedMetadata.tool_call_metadata,
            parsedMetadata.tool_result_metadata,
            parsedMetadata.tool_result_metadata?.success ?? true
          );

          if (designerData.generatedImagePath && designerData.actualIsSuccess) {
            let relativePath = designerData.generatedImagePath;
            if (relativePath.startsWith('/workspace/')) {
              relativePath = relativePath.substring('/workspace/'.length);
            } else if (relativePath.startsWith('/')) {
              relativePath = relativePath.substring(1);
            }

            // Check if this element already exists in the store to avoid duplicates
            const currentSandboxId = designerData.sandbox_id || sandboxId || '';
            const exists = elements.some(el => 
              el.filePath === relativePath && 
              (el.sandboxId === currentSandboxId || !el.sandboxId || !currentSandboxId)
            );

            if (!exists) {
              addElement({
                sandboxId: currentSandboxId,
                filePath: relativePath,
                directUrl: designerData.designUrl,
                x: 100 + (elements.length * 40),
                y: 100 + (elements.length * 40),
                width: designerData.width || 400,
                height: designerData.height || 400,
                rotation: 0,
                zIndex: elements.length,
                opacity: 100,
                name: relativePath.split('/').pop() || 'design',
                locked: false,
              });
            }
          }
          
          // Mark as processed
          if (message.message_id) {
            processedMessageIds.current.add(message.message_id);
          }
        }
      }
    });
  }, [messages, sandboxId, elements, openPanel, addElement]);
}
