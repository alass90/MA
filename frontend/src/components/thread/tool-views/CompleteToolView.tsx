import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ListChecks,
  Sparkles,
  Trophy,
  Paperclip,
} from 'lucide-react';
import { ToolViewProps } from './types';
import {
  formatTimestamp,
  getToolTitle,
  getFileIconAndColor,
} from './utils';
import { cn } from '@/lib/utils';
import { CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from '@/components/ui/progress';
import { Markdown } from '@/components/ui/markdown';
import { FileAttachment } from '../file-attachment';
import { TaskCompletedFeedback } from './shared/TaskCompletedFeedback';

interface CompleteToolViewProps extends ToolViewProps {
  onFileClick?: (filePath: string) => void;
}

export function CompleteToolView({
  toolCall,
  toolResult,
  assistantTimestamp,
  toolTimestamp,
  isSuccess = true,
  isStreaming = false,
  onFileClick,
  project,
}: CompleteToolViewProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (isStreaming) {
      const timer = setInterval(() => {
        setProgress((prevProgress) => {
          if (prevProgress >= 95) {
            clearInterval(timer);
            return prevProgress;
          }
          return prevProgress + 5;
        });
      }, 300);
      return () => clearInterval(timer);
    } else {
      setProgress(100);
    }
  }, [isStreaming]);

  if (!toolCall) {
    console.warn('CompleteToolView: toolCall is undefined. Tool views should use structured props.');
    return null;
  }

  const name = toolCall.function_name.replace(/_/g, '-').toLowerCase();
  const text = toolCall.arguments?.text || null;
  const attachments = toolCall.arguments?.attachments 
    ? (Array.isArray(toolCall.arguments.attachments) 
        ? toolCall.arguments.attachments 
        : typeof toolCall.arguments.attachments === 'string'
          ? toolCall.arguments.attachments.split(',').map(a => a.trim()).filter(a => a.length > 0)
          : [])
    : null;
  const follow_up_prompts = toolCall.arguments?.follow_up_prompts
    ? (Array.isArray(toolCall.arguments.follow_up_prompts)
        ? toolCall.arguments.follow_up_prompts.filter((p: string) => p && p.trim().length > 0)
        : [])
    : null;

  let resultText: string | null = null;
  let tasksCompleted: string[] | null = null;

  if (toolResult?.output) {
    const output = toolResult.output;
    if (typeof output === 'string') {
      resultText = output;
    } else if (typeof output === 'object' && output !== null) {
      if (output.text) {
        resultText = output.text;
      }
      if (output.tasks_completed && Array.isArray(output.tasks_completed)) {
        tasksCompleted = output.tasks_completed;
      }
    }
  }

  const actualIsSuccess = toolResult?.success !== undefined ? toolResult.success : isSuccess;

  const isImageFile = (filePath: string): boolean => {
    const filename = filePath.split('/').pop() || '';
    return filename.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i) !== null;
  };

  const isPreviewableFile = (filePath: string): boolean => {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    return ext === 'html' || ext === 'htm' || ext === 'md' || ext === 'markdown' || ext === 'csv' || ext === 'tsv';
  };

  const toolTitle = getToolTitle(name) || 'Task Complete';

  const handleFileClick = (filePath: string) => {
    if (onFileClick) {
      onFileClick(filePath);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
      <div className="flex-1 overflow-hidden relative">
        <ScrollArea className="h-full w-full">
          <div className="p-4 space-y-6">
            {!isStreaming && actualIsSuccess && !text && !attachments && !resultText && !tasksCompleted && (
              <div className="flex justify-center">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-800/40 dark:to-emerald-900/60 flex items-center justify-center">
                    <Trophy className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="absolute -top-1 -right-1">
                    <Sparkles className="h-5 w-5 text-yellow-500 animate-pulse" />
                  </div>
                </div>
              </div>
            )}

            {(text || resultText) && (
              <div className="space-y-2">
                <div className="bg-muted/50 rounded-2xl p-4 border border-border">
                  <Markdown className="text-sm prose prose-sm dark:prose-invert chat-markdown max-w-none [&>:first-child]:mt-0 prose-headings:mt-3">
                    {text || resultText || ''}
                  </Markdown>
                  {isStreaming && (
                    <span className="inline-block h-4 w-0.5 bg-primary ml-1 -mb-1 animate-pulse" />
                  )}
                </div>
              </div>
            )}

            {attachments && attachments.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Paperclip className="h-4 w-4" />
                  Files ({attachments.length})
                </div>

                <div className={cn(
                  "grid gap-3",
                  attachments.length === 1 ? "grid-cols-1" :
                    attachments.length > 4 ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3" :
                      "grid-cols-1 sm:grid-cols-2"
                )}>
                  {attachments
                    .sort((a, b) => {
                      const aIsImage = isImageFile(a);
                      const bIsImage = isImageFile(b);
                      const aIsPreviewable = isPreviewableFile(a);
                      const bIsPreviewable = isPreviewableFile(b);

                      if (aIsImage && !bIsImage) return -1;
                      if (!aIsImage && bIsImage) return 1;
                      if (aIsPreviewable && !bIsPreviewable) return -1;
                      if (!aIsPreviewable && bIsPreviewable) return 1;
                      return 0;
                    })
                    .map((attachment, index) => {
                      const isImage = isImageFile(attachment);
                      const isPreviewable = isPreviewableFile(attachment);
                      const shouldSpanFull = (attachments!.length % 2 === 1 &&
                        attachments!.length > 1 &&
                        index === attachments!.length - 1);

                      return (
                        <div
                          key={index}
                          className={cn(
                            "relative group",
                            isImage ? "flex items-center justify-center h-full" : "",
                            isPreviewable ? "w-full" : ""
                          )}
                          style={(shouldSpanFull || isPreviewable) ? { gridColumn: '1 / -1' } : undefined}
                        >
                          <FileAttachment
                            filepath={attachment}
                            onClick={handleFileClick}
                            sandboxId={project?.sandbox?.id}
                            showPreview={true}
                            className={cn(
                              "w-full",
                              isImage ? "h-auto min-h-[54px]" :
                                isPreviewable ? "min-h-[240px] max-h-[400px] overflow-auto" : "h-[54px]"
                            )}
                            customStyle={
                              isImage ? {
                                width: '100%',
                                height: 'auto',
                                '--attachment-height': shouldSpanFull ? '240px' : '180px'
                              } as React.CSSProperties :
                                isPreviewable ? {
                                  gridColumn: '1 / -1'
                                } :
                                  shouldSpanFull ? {
                                    gridColumn: '1 / -1'
                                  } : {
                                    width: '100%'
                                  }
                            }
                            collapsed={false}
                            project={project}
                          />
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : null}

            {tasksCompleted && tasksCompleted.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <ListChecks className="h-4 w-4" />
                  Tasks Completed
                </div>
                <div className="space-y-2">
                  {tasksCompleted.map((task, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg border border-border/50"
                    >
                      <div className="mt-1 flex-shrink-0">
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Markdown className="text-sm prose prose-sm dark:prose-invert chat-markdown max-w-none [&>:first-child]:mt-0 [&>:last-child]:mb-0">
                          {task}
                        </Markdown>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isStreaming && !text && !resultText && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Completing task...
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {progress}%
                  </span>
                </div>
                <Progress value={progress} className="h-1" />
              </div>
            )}

            {!text && !attachments && !resultText && !tasksCompleted && !isStreaming && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Task Completed
                </h3>
                <p className="text-sm text-muted-foreground">
                  No additional details provided
                </p>
              </div>
            )}

            {!isStreaming && actualIsSuccess && (
              <TaskCompletedFeedback
                taskSummary={text || resultText}
                followUpPrompts={follow_up_prompts && follow_up_prompts.length > 0 ? follow_up_prompts : undefined}
                onFollowUpClick={(prompt) => {
                  console.log('Follow-up clicked:', prompt);
                }}
              />
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}