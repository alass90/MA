import React, { useState } from 'react';
import {
  Terminal,
  CheckCircle,
  AlertTriangle,
  CircleDashed,
  Code,
  Clock,
  ArrowRight,
  TerminalIcon,
  Loader2,
  Copy,
  Check,
} from 'lucide-react';
import { ToolViewProps } from '../types';
import { formatTimestamp, getToolTitle } from '../utils';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from "@/components/ui/scroll-area";
import { LoadingState } from '../shared/LoadingState';
import { extractCommandData } from './_utils';

export function CommandToolView({
  toolCall,
  toolResult,
  assistantTimestamp,
  toolTimestamp,
  isSuccess = true,
  isStreaming = false,
}: ToolViewProps) {
  const { resolvedTheme } = useTheme();
  const isDarkTheme = resolvedTheme === 'dark';
  const [showFullOutput, setShowFullOutput] = useState(true);
  const [copied, setCopied] = useState(false);

  const {
    command,
    output,
    exitCode,
    sessionName,
    cwd,
    completed,
    success: actualIsSuccess,
    timestamp: actualToolTimestamp,
  } = extractCommandData(
    toolCall,
    toolResult,
    isSuccess,
    toolTimestamp,
    assistantTimestamp
  );
  
  const actualAssistantTimestamp = assistantTimestamp;
  const name = toolCall.function_name.replace(/_/g, '-');

  const displayText = name === 'check-command-output' ? sessionName : command;
  const displayLabel = name === 'check-command-output' ? 'Session' : 'Command';
  const displayPrefix = name === 'check-command-output' ? 'tmux:' : '$';

  const toolTitle = getToolTitle(name);

  // Check if this is a non-blocking command with just a status message
  const isNonBlockingCommand = React.useMemo(() => {
    if (!output) return false;

    // Check if output contains typical non-blocking command messages
    const nonBlockingPatterns = [
      'Command sent to tmux session',
      'Use check_command_output to view results',
      'Session still running',
      'completed: false'
    ];

    return nonBlockingPatterns.some(pattern =>
      output.toLowerCase().includes(pattern.toLowerCase())
    );
  }, [output]);

  // Check if there's actual command output to display
  const hasActualOutput = React.useMemo(() => {
    if (!output) return false;

    // If it's a non-blocking command, don't show output section
    if (isNonBlockingCommand) return false;

    // Check if output contains actual command results (not just status messages)
    const actualOutputPatterns = [
      'root@',
      'COMMAND_DONE_',
      'Count:',
      'date:',
      'ls:',
      'pwd:'
    ];

    return actualOutputPatterns.some(pattern =>
      output.includes(pattern)
    ) || output.trim().length > 50; // Arbitrary threshold for "substantial" output
  }, [output, isNonBlockingCommand]);

  const formattedOutput = React.useMemo(() => {
    if (!output || !hasActualOutput) return [];
    let processedOutput = output;

    // Handle case where output is already an object
    if (typeof output === 'object' && output !== null) {
      try {
        processedOutput = JSON.stringify(output, null, 2);
      } catch (e) {
        processedOutput = String(output);
      }
    } else if (typeof output === 'string') {
      // Try to parse as JSON first
      try {
        if (output.trim().startsWith('{') || output.trim().startsWith('[')) {
          const parsed = JSON.parse(output);
          if (parsed && typeof parsed === 'object') {
            // If it's a complex object, stringify it nicely
            processedOutput = JSON.stringify(parsed, null, 2);
          } else {
            processedOutput = String(parsed);
          }
        } else {
          processedOutput = output;
        }
      } catch (e) {
        // If parsing fails, use as plain text
        processedOutput = output;
      }
    } else {
      processedOutput = String(output);
    }

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
  }, [output, hasActualOutput]);

  const hasMoreLines = formattedOutput.length > 10;
  const previewLines = formattedOutput.slice(0, 10);
  const linesToShow = showFullOutput ? formattedOutput : previewLines;
  
  // Add empty lines for natural scrolling
  const emptyLines = Array.from({ length: 30 }, () => '');

  const handleCopy = () => {
    const fullText = `${displayPrefix} ${command}\n${output || ''}`;
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
                actualIsSuccess
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
              )}
            >
              {actualIsSuccess ? (
                <CheckCircle className="h-3 w-3 mr-1" />
              ) : (
                <AlertTriangle className="h-3 w-3 mr-1" />
              )}
              {actualIsSuccess ? 'Completed' : 'Failed'}
            </Badge>
          )}

          {isStreaming && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <Loader2 className="h-3 w-3 animate-spin text-blue-600 dark:text-blue-400" />
              <span className="text-[10px] font-medium text-blue-700 dark:text-blue-300">
                {name === 'check-command-output' ? 'Checking output' : 'Executing command'}
              </span>
            </div>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
          {toolTitle}
        </div>
      </div>

      <div className="p-0 h-full flex-1 overflow-hidden relative">
        {isStreaming ? (
          <div className="h-full flex flex-col overflow-hidden">
            <div className="flex-1 overflow-hidden p-4">
              <div className="h-full bg-zinc-50 dark:bg-[#1a1a1b] rounded-xl border border-black/10 dark:border-white/5 overflow-hidden flex flex-col relative group">
                <div className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="p-4 font-mono text-[13px] leading-relaxed">
                      {command && (
                        <div className="mb-2">
                          <span className="text-purple-600 dark:text-[#d38aea] font-semibold">root@talos:~ $ </span>
                          <span className="text-zinc-900 dark:text-zinc-100">{command}</span>
                          {isStreaming && <span className="inline-block w-2 h-4 bg-zinc-400 dark:bg-zinc-500 animate-pulse ml-1 align-middle" />}
                        </div>
                      )}
                      
                      {!command && (
                        <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500 italic">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Initializing terminal...</span>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </div>
          </div>
        ) : displayText ? (
          <div className="h-full flex flex-col overflow-hidden p-4">
            <div className="flex-1 bg-white dark:bg-[#1a1a1b] rounded-xl border border-black/10 dark:border-white/10 shadow-sm dark:shadow-lg overflow-hidden flex flex-col relative group font-sans">
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

              <div className="flex-1 overflow-hidden font-mono">
                <ScrollArea className="h-full">
                  <div className="p-4 text-[13px] leading-relaxed">
                    {/* Command Line */}
                    <div className="mb-3">
                      <span className="text-purple-600 dark:text-[#d38aea] font-semibold">root@talos:~ $ </span>
                      <span className="text-zinc-900 dark:text-zinc-100">{command}</span>
                    </div>

                    {/* Output Content */}
                    {formattedOutput.length > 0 ? (
                      <div className="text-zinc-700 dark:text-zinc-300">
                        {formattedOutput.map((line, idx) => (
                          <div key={idx} className="min-h-[1.5em] whitespace-pre-wrap break-words">
                            {line}
                          </div>
                        ))}
                        
                        {/* Status Message if non-blocking */}
                        {isNonBlockingCommand && output && formattedOutput.length === 0 && (
                          <div className="text-blue-600 dark:text-blue-400 italic opacity-80 mt-2">
                            # {output}
                          </div>
                        )}

                        {/* Empty lines for scrolling */}
                        {emptyLines.map((_, idx) => (
                          <div key={`empty-${idx}`} className="h-[1.5em]" />
                        ))}
                      </div>
                    ) : isNonBlockingCommand && output ? (
                      <div className="text-blue-600 dark:text-blue-400 italic opacity-80">
                        # {output}
                      </div>
                    ) : (
                      <div className="text-zinc-400 dark:text-zinc-500 italic opacity-60">
                        # No output received
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-12 px-6 bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-zinc-900">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 bg-gradient-to-b from-zinc-100 to-zinc-50 shadow-inner dark:from-zinc-800/40 dark:to-zinc-900/60">
              <Terminal className="h-10 w-10 text-zinc-400 dark:text-zinc-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
              {name === 'check-command-output' ? 'No Session Found' : 'No Command Found'}
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center max-w-md">
              {name === 'check-command-output'
                ? 'No session name was detected. Please provide a valid session name to check.'
                : 'No command was detected. Please provide a valid command to execute.'
              }
            </p>
          </div>
        )}
      </div>

      <div className="px-4 py-2 h-10 bg-gradient-to-r from-zinc-50/90 to-zinc-100/90 dark:from-zinc-900/90 dark:to-zinc-800/90 backdrop-blur-sm border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center gap-4">
        <div className="h-full flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          {!isStreaming && displayText && (
            <Badge variant="outline" className="h-6 py-0.5 bg-zinc-50 dark:bg-zinc-900">
              <Terminal className="h-3 w-3 mr-1" />
              {displayLabel}
            </Badge>
          )}
        </div>

        <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
          <Clock className="h-3.5 w-3.5" />
          {actualToolTimestamp && !isStreaming
            ? formatTimestamp(actualToolTimestamp)
            : actualAssistantTimestamp
              ? formatTimestamp(actualAssistantTimestamp)
              : ''}
        </div>
      </div>
    </div>
  );
}
