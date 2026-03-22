import React from 'react';
import { Clock } from 'lucide-react';
import { UnifiedMessage, ParsedMetadata } from '@/components/thread/types';
import { safeJsonParse, getToolIcon, getUserFriendlyToolName } from '@/components/thread/utils';
import { ComposioUrlDetector } from '@/components/thread/content/composio-url-detector';
import { renderAttachments } from '@/components/thread/content/ThreadContent';
import { TaskCompletedFeedback } from '@/components/thread/tool-views/shared/TaskCompletedFeedback';
import { PromptExamples } from '@/components/shared/prompt-examples';
import type { Project } from '@/lib/api/threads';
import { ActivityLog, ActivityStep } from '@/components/thread/ActivityLog';

export interface AssistantMessageRendererProps {
  message: UnifiedMessage;
  onToolClick: (assistantMessageId: string | null, toolName: string) => void;
  onFileClick?: (filePath?: string, filePathList?: string[]) => void;
  sandboxId?: string;
  project?: Project;
  isLatestMessage?: boolean;
  t?: (key: string) => string;
  threadId?: string;
  onPromptFill?: (message: string) => void;
  storageUrls?: Record<string, string>;
  supabasePaths?: Record<string, string>;
  toolResults?: Record<string, any>;
}

import { GenericToolView } from '@/components/thread/tool-views/GenericToolView';

/**
 * Normalizes an array value that might be a string, array, or other type
 */
function normalizeArrayValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }
  
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
      }
    } catch {
      // If parsing fails, treat as comma-separated string
      return value.split(',').map(a => a.trim()).filter(a => a.length > 0);
    }
  }
  
  return [];
}

/**
 * Normalizes attachments value (can be string, array, or empty)
 */
function normalizeAttachments(attachments: unknown): string[] {
  if (Array.isArray(attachments)) {
    return attachments;
  }
  
  if (typeof attachments === 'string') {
    return attachments.split(',').map(a => a.trim()).filter(a => a.length > 0);
  }
  
  return [];
}

/**
 * Extracts a display parameter from tool call arguments
 */
function getToolCallDisplayParam(toolCall: { arguments?: Record<string, any> }): string {
  const args = toolCall.arguments || {};
  return args.file_path || args.command || args.query || args.url || args.path || args.filename || '';
}

/**
 * Renders an "ask" tool call
 */
function renderAskToolCall(
  toolCall: { arguments?: Record<string, any> },
  index: number,
  props: AssistantMessageRendererProps
): React.ReactNode {
  const { onFileClick, sandboxId, project, isLatestMessage, t, onPromptFill, storageUrls, supabasePaths } = props;
  const askText = toolCall.arguments?.text || '';
  const attachments = normalizeAttachments(toolCall.arguments?.attachments);
  const followUpAnswers = normalizeArrayValue(toolCall.arguments?.follow_up_answers);

  return (
    <div key={`ask-${index}`} className="space-y-3">
      <ComposioUrlDetector 
        content={askText} 
        className="text-base prose prose-base dark:prose-invert chat-markdown max-w-none break-words [&>:first-child]:mt-0 prose-headings:mt-3" 
      />
      {renderAttachments(attachments, onFileClick, sandboxId, project, storageUrls, supabasePaths)}
      {isLatestMessage && (
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-orange-500 flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            {t ? t('thread.waitingForUserResponse') : 'Kortix will proceed to work autonomously after you answer.'}
          </p>
        </div>
      )}
      {isLatestMessage && followUpAnswers.length > 0 && (
        <PromptExamples
          prompts={followUpAnswers.slice(0, 4).map(answer => ({ text: answer }))}
          onPromptClick={(answer) => onPromptFill?.(answer)}
          variant="text"
          showTitle={true}
          title={t ? t('thread.sampleAnswers') : 'Sample answers'}
        />
      )}
    </div>
  );
}

/**
 * Renders a "complete" tool call
 */
function renderCompleteToolCall(
  toolCall: { arguments?: Record<string, any> },
  index: number,
  props: AssistantMessageRendererProps
): React.ReactNode {
  const { onFileClick, sandboxId, project, isLatestMessage, t, onPromptFill, threadId, message, storageUrls, supabasePaths } = props;
  const completeText = toolCall.arguments?.text || '';
  const attachments = normalizeAttachments(toolCall.arguments?.attachments);
  const followUpPrompts = normalizeArrayValue(toolCall.arguments?.follow_up_prompts);

  return (
    <div key={`complete-${index}`} className="space-y-3">
      <ComposioUrlDetector 
        content={completeText} 
        className="text-base prose prose-base dark:prose-invert chat-markdown max-w-none break-words [&>:first-child]:mt-0 prose-headings:mt-3" 
      />
      {renderAttachments(attachments, onFileClick, sandboxId, project, storageUrls, supabasePaths)}
      <TaskCompletedFeedback
        taskSummary={completeText}
        followUpPrompts={isLatestMessage && followUpPrompts.length > 0 ? followUpPrompts : undefined}
        onFollowUpClick={(prompt) => onPromptFill?.(prompt)}
        samplePromptsTitle={t ? t('thread.samplePrompts') : 'Sample prompts'}
        threadId={threadId}
        messageId={message.message_id}
      />
    </div>
  );
}

/**
 * Helper to extract a summary from tool results (e.g. "18 results")
 */
function getToolResultSummary(toolName: string, result: any): string | undefined {
  if (!result) return undefined;
  
  const toolNameLower = toolName.toLowerCase();
  
  // Handle web search results
  if (toolNameLower.includes('search') || toolNameLower.includes('crawl')) {
    try {
      const parsed = typeof result === 'string' ? JSON.parse(result) : result;
      // Many search tools return an object with a results array or total_results
      const results = parsed.results || (Array.isArray(parsed) ? parsed : null);
      if (Array.isArray(results)) {
        return `${results.length} results`;
      }
      if (parsed.total_results) {
        return `${parsed.total_results} results`;
      }
    } catch (e) {
      // Fallback
    }
  }
  
  // Handle file operations
  if (toolNameLower.includes('create-file') || toolNameLower.includes('write-file')) {
    return 'File created';
  }
  if (toolNameLower.includes('edit-file') || toolNameLower.includes('str-replace')) {
    return 'File updated';
  }
  
  // Handle shell commands
  if (toolNameLower.includes('execute-command')) {
    return 'Command executed';
  }

  return undefined;
}

/**
 * Renders a group of assistant messages as a single unit following the Kimi pattern:
 * - Chronological order is preserved.
 * - Consecutive regular tool calls are grouped into a single ActivityLog.
 * - Text content and interactive tools (ask/complete) are rendered in their natural positions.
 */
export function renderGroupedAssistantMessages(
  messages: UnifiedMessage[],
  props: Omit<AssistantMessageRendererProps, 'message'>
): React.ReactNode {
  const contentParts: React.ReactNode[] = [];
  const allAttachments: string[] = [];
  let currentToolBuffer: ActivityStep[] = [];
  
  // Helper to flush buffered tool calls into an ActivityLog
  const flushToolBuffer = (key: string) => {
    if (currentToolBuffer.length > 0) {
      contentParts.push(
        <ActivityLog 
          key={`activity-log-${key}`} 
          steps={[...currentToolBuffer]} 
          onToolLogClick={props.onToolClick}
          className="mb-4" 
        />
      );
      currentToolBuffer = [];
    }
  };

  messages.forEach((message, msgIndex) => {
    if (message.role !== 'assistant' && message.type !== 'assistant') return;
    
    const metadata = safeJsonParse<ParsedMetadata>(message.metadata, {});
    const toolCalls = metadata.tool_calls || [];
    const textContent = metadata.text_content?.trim();
    const attachments = normalizeAttachments(metadata.attachments);
    if (attachments.length > 0) {
      allAttachments.push(...attachments);
    }

    // 1. Render text content of this message
    if (textContent) {
      flushToolBuffer(`before-text-${msgIndex}`);
      contentParts.push(
        <ComposioUrlDetector 
          key={`text-${msgIndex}`} 
          content={textContent} 
          className="text-base prose prose-base dark:prose-invert chat-markdown max-w-none break-words mb-4 last:mb-0" 
        />
      );
    }
    
    // 2. Process tool calls
    toolCalls.forEach((tc, tcIndex) => {
      const toolName = tc.function_name.replace(/_/g, '-');
      
      // Normalize arguments
      let normalizedArguments: Record<string, any> = {};
      if (tc.arguments) {
        if (typeof tc.arguments === 'object' && tc.arguments !== null) {
          normalizedArguments = tc.arguments;
        } else if (typeof tc.arguments === 'string') {
          try {
            normalizedArguments = JSON.parse(tc.arguments);
          } catch {
            normalizedArguments = {};
          }
        }
      }
      
      const normalizedTC = { ...tc, arguments: normalizedArguments };
      const msgProps = { ...props, message };
      
      if (toolName === 'ask' || toolName === 'complete') {
        flushToolBuffer(`before-interactive-${msgIndex}-${tcIndex}`);
        if (toolName === 'ask') {
          contentParts.push(renderAskToolCall(normalizedTC, tcIndex, msgProps));
        } else {
          contentParts.push(renderCompleteToolCall(normalizedTC, tcIndex, msgProps));
        }
      } else {
        // Collect into activity log buffer
        const result = props.toolResults?.[tc.call_id];
        const extra = getToolResultSummary(toolName, result);
        
        let stepContent = null;
        if (result) {
          const mockToolResult = {
            output: typeof result === 'string' ? safeJsonParse(result, result) : result,
            status: 'success'
          };
          stepContent = (
            <div className="max-h-[400px] overflow-hidden">
              <GenericToolView 
                toolCall={normalizedTC} 
                toolResult={mockToolResult as any}
                isStreaming={false}
              />
            </div>
          );
        }

        currentToolBuffer.push({
          id: tc.call_id || `tool-${msgIndex}-${tcIndex}`,
          type: 'default',
          name: getUserFriendlyToolName(toolName),
          iconName: tc.function_name,
          parameter: getToolCallDisplayParam(normalizedTC),
          extra: extra,
          content: stepContent,
          messageId: message.message_id,
          toolName: tc.function_name
        });
      }
    });
  });

  // Final flush
  flushToolBuffer('final');

  // Render top-level attachments last
  const uniqueAttachments = Array.from(new Set(allAttachments));
  if (uniqueAttachments.length > 0) {
    contentParts.push(
      <div key="metadata-attachments" className="mt-4 text-sm">
        <div className="text-xs font-medium text-muted-foreground mb-2">Attachments</div>
        {renderAttachments(
          uniqueAttachments, 
          props.onFileClick, 
          props.sandboxId, 
          props.project, 
          props.storageUrls, 
          props.supabasePaths
        )}
      </div>
    );
  }
  
  return contentParts.length > 0 ? contentParts : null;
}

/**
 * Renders assistant message content from metadata
 */
export function renderAssistantMessage(props: AssistantMessageRendererProps): React.ReactNode {
  return renderGroupedAssistantMessages([props.message], props);
}

