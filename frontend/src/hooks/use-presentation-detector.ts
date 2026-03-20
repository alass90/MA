import { useEffect } from 'react';
import { usePresentationPanelStore } from '@/stores/use-presentation-panel-store';
import { UnifiedMessage } from '@/components/thread/types';

/**
 * Hook to detect presentation-related tool calls and automatically open the TalosSlidesPanel
 */
export function usePresentationDetector(messages: UnifiedMessage[] | undefined, sandboxId?: string | null) {
  const { openPanel } = usePresentationPanelStore();

  useEffect(() => {
    if (!messages || messages.length === 0 || !sandboxId) return;

    // Look for the most recent presentation tool call
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];

      // Parse metadata
      let parsedMetadata: any;
      try {
        parsedMetadata = typeof message.metadata === 'string' ? JSON.parse(message.metadata) : message.metadata;
      } catch {
        continue;
      }

      // Check for tool results
      if (message.type === 'tool' && parsedMetadata?.tool_call_metadata) {
        const toolCallData = parsedMetadata.tool_call_metadata;
        const toolName = toolCallData.name;

        // Presentation tool calls
        if (toolName === 'create_slide' || toolName === 'load_template_design' || toolName === 'list_slides') {
          const toolResult = parsedMetadata.tool_result_metadata;
          
          if (toolResult?.output) {
            try {
              const output = typeof toolResult.output === 'string' 
                ? JSON.parse(toolResult.output) 
                : toolResult.output;
              
              if (output.presentation_path) {
                // Determine absolute presentation path if it's relative
                let fullPath = output.presentation_path;
                if (!fullPath.startsWith('/workspace')) {
                    if (fullPath.startsWith('/')) {
                        fullPath = `/workspace${fullPath}`;
                    } else {
                        fullPath = `/workspace/${fullPath}`;
                    }
                }
                
                openPanel(sandboxId, fullPath);
                // Stop after finding the first relevant tool call
                break;
              }
            } catch (err) {
              console.error('Error parsing presentation output:', err);
            }
          }
        }
      }
    }
  }, [messages, sandboxId, openPanel]);
}
