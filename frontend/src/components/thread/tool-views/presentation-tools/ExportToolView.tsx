import React, { useState, useMemo } from 'react';
import {
  Presentation,
  FileText,
  Download,
  CheckCircle,
  AlertTriangle,
  Loader2,
  LucideIcon,
} from 'lucide-react';
import { ToolViewProps } from '../types';
import {
  getToolTitle,
} from '../utils';
import { downloadPresentation, DownloadFormat } from '../utils/presentation-utils';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Markdown } from '@/components/ui/markdown';
import { FileAttachment } from '../../file-attachment';
import { useAuth } from '@/components/AuthProvider';

interface ExportToolViewProps extends ToolViewProps {
  onFileClick?: (filePath: string) => void;
}

type ExportFormat = 'pptx' | 'pdf';

interface FormatConfig {
  icon: LucideIcon;
  iconColor: string;
  badgeColor: string;
  noteBgColor: string;
  noteBorderColor: string;
  noteTextColor: string;
  defaultExtension: string;
  fileProperty: string;
  downloadFormat: DownloadFormat;
}

// Shared color scheme for all export formats
const exportColors = {
  iconColor: 'text-blue-500 dark:text-blue-400',
  badgeColor: 'bg-gradient-to-b from-blue-200 to-blue-100 text-blue-700 dark:from-blue-800/50 dark:to-blue-900/60 dark:text-blue-300',
  noteBgColor: 'bg-blue-50 dark:bg-blue-900/20',
  noteBorderColor: 'border-blue-200 dark:border-blue-800',
  noteTextColor: 'text-blue-800 dark:text-blue-200',
};

const formatConfigs: Record<ExportFormat, FormatConfig> = {
  pptx: {
    icon: Presentation,
    iconColor: exportColors.iconColor,
    badgeColor: exportColors.badgeColor,
    noteBgColor: exportColors.noteBgColor,
    noteBorderColor: exportColors.noteBorderColor,
    noteTextColor: exportColors.noteTextColor,
    defaultExtension: '.pptx',
    fileProperty: 'pptx_file',
    downloadFormat: DownloadFormat.PPTX,
  },
  pdf: {
    icon: FileText,
    iconColor: exportColors.iconColor,
    badgeColor: exportColors.badgeColor,
    noteBgColor: exportColors.noteBgColor,
    noteBorderColor: exportColors.noteBorderColor,
    noteTextColor: exportColors.noteTextColor,
    defaultExtension: '.pdf',
    fileProperty: 'pdf_file',
    downloadFormat: DownloadFormat.PDF,
  },
};

export function ExportToolView({
  toolCall,
  toolResult,
  assistantTimestamp,
  toolTimestamp,
  isSuccess = true,
  isStreaming = false,
  onFileClick,
  project,
}: ExportToolViewProps) {
  // All hooks must be called unconditionally at the top
  // Auth for file downloads
  const { session } = useAuth();
  
  // Download state
  const [isDownloading, setIsDownloading] = useState(false);

  // Determine format from function name (handle undefined case)
  const name = toolCall?.function_name?.replace(/_/g, '-').toLowerCase() || 'export-to-pptx';
  const format: ExportFormat = name.includes('pdf') ? 'pdf' : 'pptx';
  const config = formatConfigs[format];

  // Extract the export data from tool result (must be before early return)
  const {
    presentationName,
    filePath,
    downloadUrl,
    totalSlides,
    storedLocally,
    message,
    note
  } = useMemo(() => {
    if (toolResult?.output) {
      try {
        const output = toolResult.output;
        const parsed = typeof output === 'string' 
          ? JSON.parse(output) 
          : output;
        return {
          presentationName: parsed.presentation_name || toolCall?.arguments?.presentation_name,
          filePath: parsed[config.fileProperty] || parsed.pptx_file || parsed.pdf_file,
          downloadUrl: parsed.download_url,
          totalSlides: parsed.total_slides,
          storedLocally: parsed.stored_locally,
          message: parsed.message,
          note: parsed.note
        };
      } catch (e) {
        console.error('Error parsing tool result:', e);
        // Fallback: try to extract from arguments
        return {
          presentationName: toolCall?.arguments?.presentation_name,
        };
      }
    }
    // Fallback: extract from arguments
    return {
      presentationName: toolCall?.arguments?.presentation_name,
    };
  }, [toolResult, config.fileProperty, toolCall?.arguments]);

  // Defensive check - handle cases where toolCall might be undefined
  if (!toolCall) {
    console.warn('ExportToolView: toolCall is undefined. Tool views should use structured props.');
    return null;
  }

  const IconComponent = config.icon;

  // Download handlers
  const handleDownload = async (downloadFormat: DownloadFormat) => {
    if (!project?.sandbox?.sandbox_url || !presentationName) return;

    setIsDownloading(true);
    try {
      await downloadPresentation(
        downloadFormat,
        project.sandbox.sandbox_url, 
        `/workspace/presentations/${presentationName}`, 
        presentationName
      );
    } catch (error) {
      console.error(`Error downloading ${downloadFormat}:`, error);
      toast.error(`Failed to download ${downloadFormat}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDownloading(false);
    }
  };

  // Handle direct file download for stored files
  // Uses backend API which auto-starts sandbox if needed
  const handleDirectDownload = async () => {
    if (!downloadUrl || !project?.sandbox?.id) return;
    
    try {
      setIsDownloading(true);
      
      // Extract filename from downloadUrl
      const filename = downloadUrl.split('/').pop() || `presentation${config.defaultExtension}`;
      
      // Use backend file endpoint which handles sandbox startup automatically
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/sandboxes/${project.sandbox.id}/files/content?path=${encodeURIComponent(downloadUrl)}`,
        { headers }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success(`Downloaded ${filename}`, {
        duration: 3000,
      });
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-transparent">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-zinc-50/50 dark:bg-zinc-900/50">
        <div className="flex items-center gap-2">
          {(!isStreaming || isSuccess) && (
            <Badge
              variant="secondary"
              className={cn(
                "text-[10px] h-4 px-1 leading-none border-none",
                isSuccess
                  ? config.badgeColor
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
              )}
            >
              {isSuccess ? (
                <CheckCircle className="h-3 w-3 mr-1" />
              ) : (
                <AlertTriangle className="h-3 w-3 mr-1" />
              )}
              {isSuccess ? 'Completed' : 'Failed'}
            </Badge>
          )}

          {isStreaming && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <Loader2 className="h-3 w-3 animate-spin text-blue-600 dark:text-blue-400" />
              <span className="text-[10px] font-medium text-blue-700 dark:text-blue-300">Exporting</span>
            </div>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
          {getToolTitle(name)}
        </div>
      </div>

      <CardContent className="p-0 flex-1 overflow-hidden relative">
        <ScrollArea className="h-full w-full">
          <div className="p-4 space-y-4">
            {/* Export Info */}
            {(presentationName || totalSlides) && (
              <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2 mb-3">
                  <FileText className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200">Export Details</h3>
                </div>
                <div className="space-y-2 text-sm">
                  {presentationName && (
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-700 dark:text-gray-300">Presentation:</span>
                      <span className="text-gray-900 dark:text-gray-100">{presentationName}</span>
                    </div>
                  )}
                  {totalSlides && (
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-700 dark:text-gray-300">Slides:</span>
                      <span className="text-gray-900 dark:text-gray-100">{totalSlides} slide{totalSlides !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                  {storedLocally !== undefined && (
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-700 dark:text-gray-300">Storage:</span>
                      <span className="text-gray-900 dark:text-gray-100">
                        {storedLocally ? 'Stored locally for repeated downloads' : 'Direct download only'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              {storedLocally && downloadUrl ? (
                // Direct download button for stored files
                <Button 
                  variant="outline" 
                  size="sm"
                  className="border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-950"
                  onClick={handleDirectDownload}
                  disabled={isDownloading}
                  title={`Download stored ${format.toUpperCase()} file`}
                >
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Download {format.toUpperCase()}
                </Button>
              ) : (
                // Direct download button for conversion
                <Button 
                  variant="outline" 
                  size="sm"
                  className="border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-950"
                  onClick={() => handleDownload(config.downloadFormat)}
                  disabled={isDownloading}
                  title={`Download presentation as ${format.toUpperCase()}`}
                >
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Download {format.toUpperCase()}
                </Button>
              )}
            </div>

            {/* Message */}
            {message && (
              <div className="space-y-2">
                <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                  <Markdown className="text-sm prose prose-sm dark:prose-invert chat-markdown max-w-none [&>:first-child]:mt-0 prose-headings:mt-3">
                    {message}
                  </Markdown>
                </div>
              </div>
            )}


            {/* File Attachment for stored files */}
            {filePath && storedLocally && (
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <IconComponent className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200">Exported File</h3>
                </div>
                <div className="grid gap-2">
                  <FileAttachment
                    filepath={filePath}
                    onClick={onFileClick}
                    sandboxId={project?.sandbox_id}
                    project={project}
                    className="bg-white/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700"
                  />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </div>
  );
}

// Export convenience wrappers
export function ExportToPptxToolView(props: ExportToolViewProps) {
  // Create modified toolCall with correct function_name
  const modifiedToolCall = props.toolCall ? {
    ...props.toolCall,
    function_name: 'export_to_pptx'
  } : props.toolCall;
  return <ExportToolView {...props} toolCall={modifiedToolCall} />;
}

export function ExportToPdfToolView(props: ExportToolViewProps) {
  // Create modified toolCall with correct function_name
  const modifiedToolCall = props.toolCall ? {
    ...props.toolCall,
    function_name: 'export_to_pdf'
  } : props.toolCall;
  return <ExportToolView {...props} toolCall={modifiedToolCall} />;
}

