import React, { useState } from 'react';
import {
  FileDiff,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Loader2,
  Code,
  Eye,
  File,
  Copy,
  Check,
  Minus,
  Plus,
  Maximize2,
} from 'lucide-react';
import {
  extractFilePath,
  extractFileContent,
  extractStreamingFileContent,
  formatTimestamp,
  getToolTitle,
  normalizeContentToString,
} from '../utils';
import {
  MarkdownRenderer,
  processUnicodeContent,
} from '@/components/file-renderers/authenticated-markdown-renderer';
import { CsvRenderer } from '@/components/file-renderers/csv-renderer';
import { XlsxRenderer } from '@/components/file-renderers/xlsx-renderer';
import { useTheme } from 'next-themes';
import { constructHtmlPreviewUrl } from '@/lib/utils/url';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  extractFileEditData,
  generateLineDiff,
  calculateDiffStats,
  LineDiff,
  DiffStats,
  getLanguageFromFileName,
  getOperationType,
  getOperationConfigs,
  getFileIcon,
  processFilePath,
  getFileName,
  getFileExtension,
  isFileType,
  hasLanguageHighlighting,
  splitContentIntoLines,
  type FileOperation,
  type OperationConfig,
} from './_utils';
import { ToolViewProps } from '../types';
import { GenericToolView } from '../GenericToolView';
import { LoadingState } from '../shared/LoadingState';
import { toast } from 'sonner';
import ReactDiffViewer from 'react-diff-viewer-continued';

const UnifiedDiffView: React.FC<{ oldCode: string; newCode: string }> = ({ oldCode, newCode }) => (
  <ReactDiffViewer
    oldValue={oldCode}
    newValue={newCode}
    splitView={false}
    hideLineNumbers={false}
    showDiffOnly={false}
    useDarkTheme={document.documentElement.classList.contains('dark')}
    styles={{
      variables: {
        dark: {
          diffViewerColor: '#d4d4d8',
          diffViewerBackground: '#09090b',
          addedBackground: '#14532d',
          addedColor: '#d1fae5',
          removedBackground: '#7f1d1d',
          removedColor: '#fee2e2',
          wordAddedBackground: '#166534',
          wordRemovedBackground: '#991b1b',
          addedGutterBackground: '#18181b',
          removedGutterBackground: '#18181b',
          gutterBackground: '#18181b',
          gutterColor: '#52525b',
        },
        light: {
          diffViewerColor: '#3f3f46',
          diffViewerBackground: '#ffffff',
          addedBackground: '#dcfce7',
          addedColor: '#14532d',
          removedBackground: '#fee2e2',
          removedColor: '#7f1d1d',
          wordAddedBackground: '#bbf7d0',
          wordRemovedBackground: '#fecaca',
          addedGutterBackground: '#fafafa',
          removedGutterBackground: '#fafafa',
          gutterBackground: '#fafafa',
          gutterColor: '#a1a1aa',
        },
      },
      diffContainer: {
        backgroundColor: 'transparent',
        border: 'none',
      },
      line: {
        fontSize: '15px',
        lineHeight: '26px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      },
      gutter: {
        fontSize: '12px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      },
    }}
  />
);

const ErrorState: React.FC<{ message?: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center h-full py-12 px-6 bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-zinc-900">
    <div className="text-center w-full max-w-xs">
      <AlertTriangle className="h-16 w-16 mx-auto mb-6 text-amber-500" />
      <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
        Invalid File Edit
      </h3>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {message || "Could not extract the file changes from the tool result."}
      </p>
    </div>
  </div>
);

export function FileEditToolView({
  toolCall,
  toolResult,
  assistantTimestamp,
  toolTimestamp,
  isSuccess = true,
  isStreaming = false,
  project,
  onFileClick,
}: ToolViewProps): JSX.Element {
  const { resolvedTheme } = useTheme();
  const isDarkTheme = resolvedTheme === 'dark';
  
  // Extract from structured metadata
  const name = toolCall.function_name.replace(/_/g, '-').toLowerCase();
  
  // Add copy functionality state
  const [isCopyingContent, setIsCopyingContent] = useState(false);

  // Copy functions
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.error('Failed to copy text: ', err);
      return false;
    }
  };

  const handleCopyContent = async () => {
    if (!updatedContent) return;

    setIsCopyingContent(true);
    const success = await copyToClipboard(updatedContent);
    if (success) {
      toast.success('File content copied to clipboard');
    } else {
      toast.error('Failed to copy file content');
    }
    setTimeout(() => setIsCopyingContent(false), 500);
  };

  const operation = getOperationType(name, toolCall.arguments);
  const configs = getOperationConfigs();
  const config = configs[operation] || configs['edit']; // fallback to edit config
  const Icon = FileDiff; // Always use FileDiff for edit operations

  const {
    filePath,
    originalContent,
    updatedContent,
    actualIsSuccess,
    actualToolTimestamp,
    errorMessage,
  } = extractFileEditData(
    toolCall,
    toolResult,
    isSuccess,
    toolTimestamp,
    assistantTimestamp
  );

  const toolTitle = getToolTitle(name);
  const processedFilePath = processFilePath(filePath);
  const fileName = getFileName(processedFilePath);
  const fileExtension = getFileExtension(fileName);

  const isMarkdown = isFileType.markdown(fileExtension);
  const isHtml = isFileType.html(fileExtension);
  const isCsv = isFileType.csv(fileExtension);
  const isXlsx = isFileType.xlsx(fileExtension);

  const language = getLanguageFromFileName(fileName);
  const hasHighlighting = hasLanguageHighlighting(language);
  const contentLines = splitContentIntoLines(updatedContent);

  const htmlPreviewUrl =
    isHtml && project?.sandbox?.sandbox_url && processedFilePath
      ? constructHtmlPreviewUrl(project.sandbox.sandbox_url, processedFilePath)
      : undefined;

  const FileIcon = getFileIcon(fileName);

  const lineDiff = originalContent && updatedContent ? generateLineDiff(originalContent, updatedContent) : [];
  const stats: DiffStats = calculateDiffStats(lineDiff);

  const shouldShowError = !isStreaming && (!actualIsSuccess || (actualIsSuccess && (originalContent === null || updatedContent === null)));

  if (!isStreaming && !processedFilePath && !updatedContent) {
    return (
      <GenericToolView
        toolCall={toolCall}
        toolResult={toolResult}
        assistantTimestamp={assistantTimestamp}
        toolTimestamp={toolTimestamp}
        isSuccess={isSuccess}
        isStreaming={isStreaming}
      />
    );
  }

  const renderFilePreview = () => {
    if (!updatedContent) {
      return (
        <div className="flex items-center justify-center h-full p-12">
          <div className="text-center">
            <FileIcon className="h-12 w-12 mx-auto mb-4 text-zinc-400" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No content to preview</p>
          </div>
        </div>
      );
    }

    if (isHtml && htmlPreviewUrl) {
      return (
        <div className="flex flex-col h-[calc(100vh-16rem)]">
          <iframe
            src={htmlPreviewUrl}
            title={`HTML Preview of ${fileName}`}
            className="flex-grow border-0"
            sandbox="allow-same-origin allow-scripts"
          />
        </div>
      );
    }

    if (isMarkdown) {
      return (
        <div className="p-6 prose dark:prose-invert prose-zinc max-w-none prose-headings:font-semibold">
          <MarkdownRenderer
            content={processUnicodeContent(updatedContent)}
            project={project}
            basePath={processedFilePath || undefined}
          />
        </div>
      );
    }

    if (isCsv) {
      return (
        <div className="p-6 flex flex-col">
          <div className="flex-1 min-h-[400px] w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
            <CsvRenderer content={processUnicodeContent(updatedContent)} />
          </div>
        </div>
      );
    }

    if (isXlsx) {
      return (
        <div className="p-6 flex flex-col">
          <div className="flex-1 min-h-[400px] w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
            <XlsxRenderer 
              content={updatedContent}
              filePath={processedFilePath}
              fileName={fileName}
              project={project}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="p-6">
        <div className='w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6'>
          <div className="text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words">
            {processUnicodeContent(updatedContent)}
          </div>
        </div>
      </div>
    );
  };

  const renderSourceCode = () => {
    if (!updatedContent) {
      return (
        <div className="flex items-center justify-center h-full p-12">
          <div className="text-center">
            <FileIcon className="h-12 w-12 mx-auto mb-4 text-zinc-400" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No source code to display</p>
          </div>
        </div>
      );
    }

    // Always use file-lines rendering for consistency (same as Create File)
    const contentLines = updatedContent.split('\n');
    // Add empty lines to fill viewport
    const emptyLines = Array(50).fill('');
    const allLines = [...contentLines, ...emptyLines];
    
    return (
      <div className="p-6">
        <div className="min-w-full table">
          {allLines.map((line, idx) => (
            <div
              key={idx}
              className="table-row transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
            >
              <div className="table-cell text-right pr-4 pl-4 py-0.5 text-xs text-zinc-400 dark:text-zinc-600 select-none w-14 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                {idx + 1}
              </div>
              <div className="table-cell pl-4 py-0.5 pr-4 text-[15px] leading-relaxed whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                {line || ' '}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-transparent">
      <Tabs defaultValue="preview" className="w-full h-full flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-zinc-50/50 dark:bg-zinc-900/50">
          <TabsList className="h-8 bg-muted/50 border border-border/50 p-0.5 gap-0.5">
            <TabsTrigger
              value="code"
              className="px-3 py-1 text-xs"
            >
              <Code className="h-3.5 w-3.5 mr-1.5" />
              Source
            </TabsTrigger>
            <TabsTrigger
              value="preview"
              className="px-3 py-1 text-xs"
            >
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              Preview
            </TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-1.5 ">
            {updatedContent && !isStreaming && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopyContent}
                disabled={isCopyingContent}
                className="h-8 w-8"
              >
                {isCopyingContent ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            )}
            {isHtml && htmlPreviewUrl && !isStreaming && (
              <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                <a href={htmlPreviewUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
            {processedFilePath && onFileClick && !isStreaming && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onFileClick(processedFilePath)}
                className="h-8 w-8"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <CardContent className="p-0 h-full flex-1 overflow-hidden relative">
          <TabsContent value="code" className="flex-1 h-full mt-0 p-0 overflow-hidden">
            <ScrollArea className="h-full w-full min-h-0">
              {isStreaming && !updatedContent ? (
                <LoadingState
                  icon={FileDiff}
                  iconColor="text-blue-500 dark:text-blue-400"
                  bgColor="bg-gradient-to-b from-blue-100 to-blue-50 shadow-inner dark:from-blue-800/40 dark:to-blue-900/60 dark:shadow-blue-950/20"
                  title="Applying File Edit"
                  filePath={processedFilePath || 'Processing file...'}
                  subtitle="Please wait while the file is being modified"
                  showProgress={false}
                />
              ) : shouldShowError ? (
                <ErrorState message={errorMessage} />
              ) : (
                renderSourceCode()
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="preview" className="w-full flex-1 h-full mt-0 p-0 overflow-hidden">
            <ScrollArea className="h-full w-full min-h-0">
              {isStreaming && !updatedContent ? (
                <LoadingState
                  icon={FileDiff}
                  iconColor="text-blue-500 dark:text-blue-400"
                  bgColor="bg-gradient-to-b from-blue-100 to-blue-50 shadow-inner dark:from-blue-800/40 dark:to-blue-900/60 dark:shadow-blue-950/20"
                  title="Applying File Edit"
                  filePath={processedFilePath || 'Processing file...'}
                  subtitle="Please wait while the file is being modified"
                  showProgress={false}
                />
              ) : shouldShowError ? (
                <ErrorState message={errorMessage} />
              ) : (
                renderFilePreview()
              )}
              {isStreaming && updatedContent && (
                <div className="sticky bottom-4 right-4 float-right mr-4 mb-4">
                  <Badge className="bg-blue-500/90 text-white border-none shadow-lg animate-pulse">
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    Streaming...
                  </Badge>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </CardContent>

        <div className="px-4 py-2 h-10 bg-gradient-to-r from-zinc-50/90 to-zinc-100/90 dark:from-zinc-900/90 dark:to-zinc-800/90 backdrop-blur-sm border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center gap-4">
          <div className="h-full flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <Badge variant="outline" className="py-0.5 h-6">
              <FileIcon className="h-3 w-3" />
              {hasHighlighting ? language.toUpperCase() : fileExtension.toUpperCase() || 'TEXT'}
            </Badge>
          </div>

          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {actualToolTimestamp && !isStreaming
              ? formatTimestamp(actualToolTimestamp)
              : assistantTimestamp
                ? formatTimestamp(assistantTimestamp)
                : ''}
          </div>
        </div>
      </Tabs>
    </div>
  );
}