import { useEffect } from 'react';
import { usePreviewPanelStore } from '@/stores/use-preview-panel-store';
import { UnifiedMessage } from '@/components/thread/types';

/**
 * Hook to detect deployment tool calls and automatically open the preview panel
 */
export function useDeploymentDetector(messages: UnifiedMessage[] | undefined, projectId?: string) {
  const { openPanel } = usePreviewPanelStore();

  useEffect(() => {
    if (!messages || messages.length === 0) return;

    // Look for the most recent deploy_app tool result
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];

      // Parse metadata (it's a JSON string)
      let parsedMetadata: any;
      try {
        parsedMetadata = typeof message.metadata === 'string' ? JSON.parse(message.metadata) : message.metadata;
      } catch {
        continue;
      }

      // Check if this is a tool result message from deploy_app
      if (message.type === 'tool' && parsedMetadata?.tool_call_metadata) {
        const toolCallData = parsedMetadata.tool_call_metadata;

        // Check if the tool name is deploy_app
        if (toolCallData.name === 'deploy_app') {
          const toolResult = parsedMetadata.tool_result_metadata;

          // Check if the tool result contains deployment information
          if (toolResult?.output) {
            try {
              let output: any;

              // Parse output if it's a string
              if (typeof toolResult.output === 'string') {
                try {
                  output = JSON.parse(toolResult.output);
                } catch {
                  // If it's not JSON, skip this message
                  continue;
                }
              } else {
                output = toolResult.output;
              }

              // Check if this is a successful deployment
              if (output.success && output.url) {
                // Extract sandbox ID from project output if available
                const sandboxId = output.sandbox_id || projectId;

                openPanel({
                  url: output.url,
                  level: output.level || 'preview',
                  projectName: output.project_name,
                  framework: output.framework,
                  deploymentId: output.deployment_id,
                  databaseUrl: output.database_url,
                  databaseProvider: output.database_provider,
                  projectPath: toolCallData.input?.project_path,
                  sandboxId,
                });

                // Stop after finding the first deployment
                break;
              }
            } catch (error) {
              console.error('Error parsing deployment info:', error);
            }
          }
        }
      }
    }
  }, [messages, openPanel, projectId]);
}
