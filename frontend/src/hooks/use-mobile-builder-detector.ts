import { useEffect } from 'react';
import { useMobileBuilderStore } from '@/stores/use-mobile-builder-store';
import { UnifiedMessage } from '@/components/thread/types';

/**
 * Hook to detect mobile builder tool calls and automatically open the Mobile Builder panel
 */
export function useMobileBuilderDetector(messages: UnifiedMessage[] | undefined, agentStatus: string) {
  const { openPanel, setPreviewUrls, setIsGenerating, isOpen } = useMobileBuilderStore();

  useEffect(() => {
    if (!messages || messages.length === 0) return;

    // Track generating state from agentStatus
    setIsGenerating(agentStatus === 'running');

    // Look for recent mobile builder tool calls/results
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
            if (toolName === 'sb_mobile_tool' || toolName === 'manage_mobile_project') {
              if (!isOpen) {
                try {
                  const args = typeof tc.function.arguments === 'string' 
                    ? JSON.parse(tc.function.arguments) 
                    : tc.function.arguments;
                    
                  openPanel({
                    projectPath: args.project_name || '',
                    projectName: args.project_name || 'Mobile App',
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
          if (toolName === 'sb_mobile_tool' || toolName === 'manage_mobile_project') {
            if (!isOpen) {
               openPanel();
            }
            
            // Try to extract preview URLs from output
            const toolResultStr = typeof parsedMetadata.tool_result_metadata?.output === 'string' 
              ? parsedMetadata.tool_result_metadata.output 
              : JSON.stringify(parsedMetadata.tool_result_metadata?.output || '');
              
            if (toolResultStr) {
              try {
                // The output is JSON with web_url, expo_url, qr_data
                const parsed = JSON.parse(toolResultStr);
                if (parsed.web_url || parsed.expo_url) {
                  setPreviewUrls({
                    webPreviewUrl: parsed.web_url,
                    expoUrl: parsed.expo_url,
                    qrData: parsed.qr_data || parsed.expo_url,
                  });
                }
              } catch {
                // Fallback: look for regular URL
                const urlMatch = toolResultStr.match(/https?:\/\/[^\s"'<>]+/);
                if (urlMatch) {
                  setPreviewUrls({ webPreviewUrl: urlMatch[0] });
                }
              }
            }
            return;
          }
        }
      }
    }
  }, [messages, agentStatus, openPanel, setPreviewUrls, setIsGenerating, isOpen]);
}
