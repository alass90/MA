import React from 'react';
import {
  Palette,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Wand2,
  Edit3,
  ImageIcon,
  Sparkles,
} from 'lucide-react';
import { ToolViewProps } from '../types';
import {
  formatTimestamp,
  getToolTitle,
} from '../utils';
import { extractImageEditGenerateData } from './_utils';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileAttachment } from '../../file-attachment';

interface ImageEditGenerateToolViewProps extends ToolViewProps {
  onFileClick?: (filePath: string) => void;
}

export function ImageEditGenerateToolView({
  toolCall,
  toolResult,
  assistantTimestamp,
  toolTimestamp,
  isSuccess = true,
  isStreaming = false,
  onFileClick,
  project,
}: ImageEditGenerateToolViewProps) {
  // Defensive check - ensure toolCall is defined
  if (!toolCall) {
    console.warn('ImageEditGenerateToolView: toolCall is undefined. Tool views should use structured props.');
    return (
      <Card className="gap-0 flex border shadow-none border-t border-b-0 border-x-0 p-0 rounded-none flex-col h-full overflow-hidden bg-card">
        <CardHeader className="h-14 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-sm border-b p-2 px-4">
          <CardTitle className="text-base font-medium text-zinc-900 dark:text-zinc-100">
            Image Tool Error
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            This tool view requires structured metadata. Please update the component to use toolCall and toolResult props.
          </p>
        </CardContent>
      </Card>
    );
  }

  const {
    mode,
    prompt,
    imagePath,
    generatedImagePath,
    status,
    error,
    actualIsSuccess,
    actualToolTimestamp,
    actualAssistantTimestamp
  } = extractImageEditGenerateData(
    toolCall,
    toolResult,
    isSuccess,
    toolTimestamp,
    assistantTimestamp
  );

  const toolTitle = getToolTitle(toolCall.function_name.replace(/_/g, '-')) || 'Image Generation';

  const handleFileClick = (filePath: string) => {
    if (onFileClick) {
      onFileClick(filePath);
    }
  };

  const getModeIcon = () => {
    if (mode === 'generate') {
      return <Sparkles className="w-5 h-5 text-purple-500 dark:text-purple-400" />;
    } else if (mode === 'edit') {
      return <Edit3 className="w-5 h-5 text-purple-500 dark:text-purple-400" />;
    }
    return <Palette className="w-5 h-5 text-purple-500 dark:text-purple-400" />;
  };

  const getModeText = () => {
    if (mode === 'generate') return 'Image Generation';
    if (mode === 'edit') return 'Image Editing';
    return 'Image Tool';
  };

  const getDisplayPrompt = () => {
    if (!prompt) return 'No prompt provided';
    return prompt.length > 100 ? `${prompt.substring(0, 100)}...` : prompt;
  };

  // Collect all images to display
  const imagesToDisplay: string[] = [];
  if (imagePath) imagesToDisplay.push(imagePath);
  if (generatedImagePath && generatedImagePath !== imagePath) {
    imagesToDisplay.push(generatedImagePath);
  }
  
  // Debug logging (can be removed in production)
  if (process.env.NODE_ENV === 'development') {
    console.log('ImageEditGenerateToolView data:', {
      mode,
      prompt,
      imagePath,
      generatedImagePath,
      imagesToDisplay,
      status,
      error,
      actualIsSuccess,
      isStreaming,
      toolCall: toolCall?.function_name,
      toolResult: toolResult ? { success: toolResult.success, hasOutput: !!toolResult.output } : null
    });
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-transparent">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-zinc-50/50 dark:bg-zinc-900/50">
        <div className="flex items-center gap-2">
          {mode && (
            <Badge variant="outline" className="text-[10px] h-4 px-1 leading-none uppercase tracking-wider font-bold">
              {mode}
            </Badge>
          )}
          {isStreaming ? (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
              <Loader2 className="h-3 w-3 animate-spin text-purple-600 dark:text-purple-400" />
              <span className="text-[10px] font-medium text-purple-700 dark:text-purple-300">Processing</span>
            </div>
          ) : (
            <Badge
              variant="secondary"
              className={cn(
                "text-[10px] h-4 px-1 leading-none border-none",
                actualIsSuccess
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
              )}
            >
              {actualIsSuccess ? 'Ready' : 'Failed'}
            </Badge>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
          {toolTitle}
        </div>
      </div>

      <CardContent className="p-0 flex-1 overflow-hidden relative">
        <ScrollArea className="h-full w-full">
          <div className="p-4 space-y-6">
            {/* Error Message */}
            {error && (
              <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Error</span>
                </div>
                <p className="text-sm text-red-600 dark:text-red-300 mt-1">{error}</p>
              </div>
            )}

            {/* Generated Images */}
            {imagesToDisplay.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <ImageIcon className="h-4 w-4" />
                  {mode === 'generate' ? 'Generated Image' : 'Images'} ({imagesToDisplay.length})
                </div>

                <div className={cn(
                  "grid gap-4",
                  imagesToDisplay.length === 1 ? "grid-cols-1" :
                    imagesToDisplay.length > 4 ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3" :
                      "grid-cols-1 sm:grid-cols-2"
                )}>
                  {imagesToDisplay.map((imgPath, index) => {
                    const isInputImage = imgPath === imagePath && mode === 'edit' && index === 0;
                    const isGeneratedImage = imgPath === generatedImagePath;
                    
                    return (
                      <div
                        key={`${imgPath}-${index}`}
                        className="relative group rounded-lg overflow-hidden border border-border bg-muted/20"
                      >
                        {/* Image Label */}
                        {imagesToDisplay.length > 1 && (
                          <div className="absolute top-2 left-2 z-10">
                            <Badge 
                              variant="secondary" 
                              className="text-xs bg-black/70 text-white border-0 backdrop-blur-sm"
                            >
                              {isInputImage ? 'Input' : isGeneratedImage ? 'Generated' : `Image ${index + 1}`}
                            </Badge>
                          </div>
                        )}
                        
                        <FileAttachment
                          filepath={imgPath}
                          onClick={handleFileClick}
                          sandboxId={project?.sandbox?.id}
                          showPreview={true}
                          className="w-full"
                          customStyle={{
                            width: '100%',
                            height: 'auto',
                            maxHeight: '600px',
                            '--attachment-height': '600px',
                            gridColumn: '1 / -1'
                          } as React.CSSProperties}
                          collapsed={false}
                          project={project}
                          standalone={true}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-b from-purple-100 to-purple-50 shadow-inner dark:from-purple-800/40 dark:to-purple-900/60 flex items-center justify-center mb-6">
                  {isStreaming ? (
                    <Loader2 className="h-10 w-10 text-purple-500 dark:text-purple-400 animate-spin" />
                  ) : mode === 'generate' ? (
                    <Sparkles className="h-10 w-10 text-purple-500 dark:text-purple-400" />
                  ) : (
                    <Edit3 className="h-10 w-10 text-purple-500 dark:text-purple-400" />
                  )}
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {isStreaming 
                    ? (mode === 'generate' ? 'Generating Image...' : 'Editing Image...')
                    : (mode === 'generate' ? 'Image Generation' : 'Image Editing')}
                </h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  {isStreaming 
                    ? 'Please wait while the image is being processed.'
                    : actualIsSuccess 
                      ? (status || 'Processing completed')
                      : (error || 'No image generated')}
                </p>
                {prompt && (
                  <div className="mt-4 p-3 rounded-lg bg-muted/50 border max-w-md w-full">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Prompt:</p>
                    <p className="text-sm text-foreground break-words">{prompt}</p>
                  </div>
                )}
              </div>
            )}

            {/* Prompt Details */}
            {prompt && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Wand2 className="h-4 w-4" />
                  Prompt
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-sm text-foreground break-words">{prompt}</p>
                </div>
              </div>
            )}

            {/* Status Message */}
            {status && status !== prompt && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  Status
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-sm text-foreground break-words">{status}</p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>

      <div className="px-4 py-2 h-10 bg-gradient-to-r from-zinc-50/90 to-zinc-100/90 dark:from-zinc-900/90 dark:to-zinc-800/90 backdrop-blur-sm border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center gap-4">
        <div className="h-full flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Badge className="h-6 py-0.5" variant="outline">
            <Palette className="h-3 w-3" />
            Image Tool
          </Badge>
        </div>

        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          {actualAssistantTimestamp ? formatTimestamp(actualAssistantTimestamp) : ''}
        </div>
      </div>
    </div>
  );
}
