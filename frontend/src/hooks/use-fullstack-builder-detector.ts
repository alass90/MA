import { useEffect } from 'react';
import { useFullstackBuilderStore } from '@/stores/use-fullstack-builder-store';
import { UnifiedMessage } from '@/components/thread/types';

/**
 * Hook to detect fullstack builder tool calls and automatically open the IDE panel
 */
export function useFullstackBuilderDetector(messages: UnifiedMessage[] | undefined, agentStatus: string) {
  const { openPanel, setPreviewUrl, isOpen } = useFullstackBuilderStore();

  useEffect(() => {
    if (!messages || messages.length === 0) return;

    // Look for recent fullstack builder tool calls/results
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];

      // Parse metadata
      let parsedMetadata: any;
      try {
        parsedMetadata = typeof message.metadata === 'string' ? JSON.parse(message.metadata) : message.metadata;
      } catch {
        continue;
      }

      // Check if this is a tool message or a tool result
      if (parsedMetadata?.tool_calls || parsedMetadata?.tool_call_metadata) {
        
        // Handle streaming/pending tool calls (from assistant message)
        if (parsedMetadata.tool_calls) {
          for (const tc of parsedMetadata.tool_calls) {
            const toolName = tc.function?.name;
            if (toolName === 'sb_fullstack_tool' || toolName === 'manage_fullstack_project') {
              if (!isOpen) {
                try {
                  const args = typeof tc.function.arguments === 'string' 
                    ? JSON.parse(tc.function.arguments) 
                    : tc.function.arguments;
                    
                  openPanel({
                    projectPath: args.project_name || '',
                    framework: args.framework || '',
                    projectName: args.project_name || 'Fullstack App',
                  });
                } catch {
                  openPanel();
                }
              }
              return;
            }
          }
        }

        // Handle completed tool calls (from tool message)
        if (message.type === 'tool' && parsedMetadata.tool_call_metadata) {
          const toolName = parsedMetadata.tool_call_metadata.name;
          if (toolName === 'sb_fullstack_tool' || toolName === 'manage_fullstack_project') {
            if (!isOpen) {
               openPanel();
            }
            
            // Try to extract preview URL from output
            const toolResultStr = typeof parsedMetadata.tool_result_metadata?.output === 'string' 
              ? parsedMetadata.tool_result_metadata.output 
              : JSON.stringify(parsedMetadata.tool_result_metadata?.output || '');
              
            if (toolResultStr) {
              const urlMatch = toolResultStr.match(/https?:\/\/[^\s"'<>]+/);
              if (urlMatch) {
                setPreviewUrl(urlMatch[0]);
              }
            }
            return;
          }
        }
      }
    }
  }, [messages, agentStatus, openPanel, setPreviewUrl, isOpen]);
}
