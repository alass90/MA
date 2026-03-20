import React, { useState, useEffect } from 'react';
import {
  Terminal,
  CheckCircle,
  AlertTriangle,
  CircleDashed,
  Clock,
  Loader2,
  ArrowRight,
  TerminalIcon,
  Power,
  StopCircle,
  Copy,
  Check,
} from 'lucide-react';
import { ToolViewProps } from '../types';
import { formatTimestamp, getToolTitle } from '../utils';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from "@/components/ui/scroll-area";
import { extractCommandData } from './_utils';

export function TerminateCommandToolView({
  toolCall,
  toolResult,
  assistantTimestamp,
  toolTimestamp,
  isSuccess = true,
  isStreaming = false,
}: ToolViewProps) {
  const { resolvedTheme } = useTheme();
  const isDarkTheme = resolvedTheme === 'dark';
  const [progress, setProgress] = useState(0);
  const [showFullOutput, setShowFullOutput] = useState(true);
  const [copied, setCopied] = useState(false);

  const {
    sessionName,
    output,
    success: actualIsSuccess,
    timestamp: actualToolTimestamp,
  } = extractCommandData(
    toolCall,
    toolResult,
    isSuccess,
    toolTimestamp,
    assistantTimestamp
  );

  // Extract session_name from toolCall.arguments (from metadata)
  const finalSessionName = sessionName || toolCall.arguments?.session_name || null;

  const name = toolCall.function_name.replace(/_/g, '-').toLowerCase();
  const toolTitle = getToolTitle(name) || 'Terminate Session';

  const terminationSuccess = React.useMemo(() => {
    if (!output) return false;

    const outputLower = output.toLowerCase();
    if (outputLower.includes('does not exist')) return false;
    if (outputLower.includes('terminated') || outputLower.includes('killed')) return true;

    return actualIsSuccess;
  }, [output, actualIsSuccess]);

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

  const formattedOutput = React.useMemo(() => {
    if (!output) return [];
    let processedOutput = output;
    try {
      if (typeof output === 'string' && (output.trim().startsWith('{') || output.trim().startsWith('{'))) {
        const parsed = JSON.parse(output);
        if (parsed && typeof parsed === 'object' && parsed.output) {
          processedOutput = parsed.output;
        }
      }
    } catch (e) {
    }

    processedOutput = String(processedOutput);
    processedOutput = processedOutput.replace(/\\\\/g, '\\');

    processedOutput = processedOutput
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'");

    processedOutput = processedOutput.replace(/\\u([0-9a-fA-F]{4})/g, (_match, group) => {
      return String.fromCharCode(parseInt(group, 16));
    });
    return processedOutput.split('\n');
  }, [output]);

    const hasMoreLines = formattedOutput.length > 10;
    const previewLines = formattedOutput.slice(0, 10);
    const linesToShow = showFullOutput ? formattedOutput : previewLines;
    
    // Add empty lines for natural scrolling
    const emptyLines = Array.from({ length: 30 }, () => '');

  const handleCopy = () => {
    const fullText = `terminating session: ${finalSessionName}\n${output || ''}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-transparent">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-zinc-50/50 dark:bg-zinc-900/50">
        <div className="flex items-center gap-2">
          {!isStreaming && (
            <Badge
              variant="secondary"
              className={cn(
                "text-[10px] h-4 px-1 leading-none border-none",
                terminationSuccess
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
              )}
            >
              {terminationSuccess ? (
                <CheckCircle className="h-3 w-3 mr-1" />
              ) : (
                <AlertTriangle className="h-3 w-3 mr-1" />
              )}
              {terminationSuccess ? 'Session terminated' : 'Termination failed'}
            </Badge>
          )}

          {isStreaming && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <Loader2 className="h-3 w-3 animate-spin text-blue-600 dark:text-blue-400" />
              <span className="text-[10px] font-medium text-blue-700 dark:text-blue-300">Terminating</span>
            </div>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
          {toolTitle}
        </div>
      </div>

      <div className="p-0 h-full flex-1 overflow-hidden relative">
        {isStreaming ? (
          <div className="h-full flex flex-col overflow-hidden p-4">
            <div className="flex-1 bg-[#1a1a1b] rounded-xl border border-black/10 dark:border-white/5 overflow-hidden flex flex-col relative">
              <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="p-4 font-mono text-[13px] leading-relaxed">
                    <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500 italic">
                      <Loader2 className="h-3 w-3 animate-spin text-red-500" />
                      <span>Terminating session: {finalSessionName || '...'}</span>
                    </div>
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
        ) : finalSessionName ? (
          <div className="h-full flex flex-col overflow-hidden p-4">
            <div className="flex-1 bg-white dark:bg-[#1a1a1b] rounded-xl border border-black/10 dark:border-white/10 shadow-sm dark:shadow-lg overflow-hidden flex flex-col relative group">
              {/* Terminal Header/Controls */}
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button
                  onClick={handleCopy}
                  className="p-1.5 rounded-md bg-zinc-100/80 hover:bg-zinc-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors border border-black/5 dark:border-white/5"
                  title="Copy to clipboard"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>

              <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="p-4 font-mono text-[13px] leading-relaxed">
                    {/* Termination Line as terminal prompt/comment */}
                    <div className="mb-3 text-zinc-100">
                      <span className="text-purple-600 dark:text-[#d38aea] font-semibold">root@talos:~ $ </span>
                      <span className="text-zinc-500 dark:text-zinc-400 italic"># terminating session: </span>
                      <span className="text-zinc-900 dark:text-zinc-100">{finalSessionName}</span>
                    </div>

                    {/* Result Content */}
                    <div className="text-zinc-700 dark:text-zinc-300">
                      {output ? (
                        <div className="space-y-1">
                          {formattedOutput.map((line, index) => (
                            <div key={index} className="min-h-[1.5em] whitespace-pre-wrap break-all overflow-visible">
                              {line || ' '}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-zinc-400 dark:text-zinc-500 italic opacity-60">
                          # No output received
                        </div>
                      )}

                      <div className={cn(
                        "mt-6 py-2 px-3 rounded border text-[12px]",
                        terminationSuccess 
                          ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" 
                          : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-500/20"
                      )}>
                        <span className="font-semibold mr-2">{terminationSuccess ? "SUCCESS:" : "FAILED:"}</span>
                        {terminationSuccess ? "Session has been terminated." : "Failed to terminate session."}
                      </div>

                      {/* Empty lines for scrolling */}
                      {emptyLines.map((_, idx) => (
                        <div key={`empty-${idx}`} className="h-[1.5em]" />
                      ))}
                    </div>
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-12 px-6 bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-zinc-900">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 bg-gradient-to-b from-zinc-100 to-zinc-50 shadow-inner dark:from-zinc-800/40 dark:to-zinc-900/60">
              <StopCircle className="h-10 w-10 text-zinc-400 dark:text-zinc-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
              No Session Found
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center max-w-md">
              No session name was detected. Please provide a valid session to terminate.
            </p>
          </div>
        )}
      </div>

      <div className="px-4 py-2 h-10 bg-gradient-to-r from-zinc-50/90 to-zinc-100/90 dark:from-zinc-900/90 dark:to-zinc-800/90 backdrop-blur-sm border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center gap-4">
        <div className="h-full flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          {!isStreaming && finalSessionName && (
            <Badge variant="outline" className="h-6 py-0.5 bg-zinc-50 dark:bg-zinc-900">
              <StopCircle className="h-3 w-3 mr-1" />
              Terminate
            </Badge>
          )}
        </div>

        <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
          <Clock className="h-3.5 w-3.5" />
          {actualToolTimestamp && !isStreaming
            ? formatTimestamp(actualToolTimestamp)
            : assistantTimestamp
              ? formatTimestamp(assistantTimestamp)
              : ''}
        </div>
      </div>
    </div>
  );
} 