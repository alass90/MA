import React, { useState } from 'react';
import {
    Terminal,
    CheckCircle,
    AlertTriangle,
    CircleDashed,
    Clock,
    TerminalIcon,
    Play,
    Square,
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

interface CheckCommandOutputData {
    sessionName: string | null;
    output: string | null;
    status: string | null;
    success: boolean;
    timestamp?: string;
}

import { ToolCallData, ToolResultData } from '../types';

function extractCheckCommandOutputData(
    toolCall: ToolCallData,
    toolResult?: ToolResultData,
    isSuccess: boolean = true,
    toolTimestamp?: string,
    assistantTimestamp?: string
): CheckCommandOutputData {
    // Extract session_name from toolCall.arguments (from metadata)
    const args = toolCall.arguments || {};
    const sessionName: string | null = args.session_name || args.sessionName || null;
    
    // Extract output from toolResult.output (from metadata)
    let output: string | null = null;
    let status: string | null = null;
    let actualIsSuccess = isSuccess;
    const actualTimestamp = toolTimestamp || assistantTimestamp;

    if (toolResult?.output) {
        if (typeof toolResult.output === 'object' && toolResult.output !== null) {
            const outputObj = toolResult.output as any;
            output = outputObj.output || outputObj.stdout || null;
            status = outputObj.status || null;
        } else if (typeof toolResult.output === 'string') {
            output = toolResult.output;
        }
        
        if (toolResult.success !== undefined) {
            actualIsSuccess = toolResult.success;
        }
    }

    return {
        sessionName,
        output,
        status,
        success: actualIsSuccess,
        timestamp: actualTimestamp,
    };
}

// OLD FUNCTION REMOVED - Use structured version above
const extractCheckCommandOutputData_OLD = (
    assistantContent: any,
    toolContent: any,
    isSuccess: boolean,
    toolTimestamp?: string,
    assistantTimestamp?: string
): CheckCommandOutputData => {
    // Parse content to extract data
    const parseContent = (content: any): any => {
        if (typeof content === 'string') {
            try {
                return JSON.parse(content);
            } catch (e) {
                return content;
            }
        }
        return content;
    };

    // Try to extract from tool content first (most likely to have the result)
    const toolParsed = parseContent(toolContent);
    let sessionName: string | null = null;
    let output: string | null = null;
    let status: string | null = null;
    let actualIsSuccess = isSuccess;
    const actualTimestamp = toolTimestamp || assistantTimestamp;

    if (toolParsed && typeof toolParsed === 'object') {
        // First, try to extract directly from tool_execution (the actual format being used)
        if (toolParsed.tool_execution && toolParsed.tool_execution.result) {
            const result = toolParsed.tool_execution.result;
            const args = toolParsed.tool_execution.arguments || {};
            
            if (result.output && typeof result.output === 'object') {
                sessionName = result.output.session_name || args.session_name || null;
                output = result.output.output || null;
                status = result.output.status || null;
            } else if (typeof result.output === 'string') {
                output = result.output;
                sessionName = args.session_name || null;
            }
            
            actualIsSuccess = result.success !== undefined ? result.success : actualIsSuccess;
        }
        // Handle the case where content is a JSON string
        else if (toolParsed.content && typeof toolParsed.content === 'string') {
            try {
                const contentParsed = JSON.parse(toolParsed.content);
                if (contentParsed.tool_execution) {
                    const toolExecution = contentParsed.tool_execution;

                    if (toolExecution.result && toolExecution.result.output) {
                        if (typeof toolExecution.result.output === 'object') {
                            // This is the nested format: { output: { output: "...", session_name: "...", status: "..." } }
                            const nestedOutput = toolExecution.result.output;
                            output = nestedOutput.output || null;
                            sessionName = nestedOutput.session_name || null;
                            status = nestedOutput.status || null;
                        } else if (typeof toolExecution.result.output === 'string') {
                            // Direct string output
                            output = toolExecution.result.output;
                        }
                        actualIsSuccess = toolExecution.result.success !== undefined ? toolExecution.result.success : actualIsSuccess;
                    }

                    // Extract session name from arguments if not found in output
                    if (!sessionName && toolExecution.arguments) {
                        sessionName = toolExecution.arguments.session_name || null;
                    }
                }
            } catch (e) {
                console.error('Failed to parse toolContent.content:', e);
            }
        }
    }

    // Fallback to assistant content if no data found in tool content
    if (!output && !sessionName) {
        const assistantParsed = parseContent(assistantContent);

        if (assistantParsed && typeof assistantParsed === 'object') {
            // Check for frontend_content first
            if (assistantParsed.frontend_content && assistantParsed.frontend_content.tool_execution) {
                const toolExecution = assistantParsed.frontend_content.tool_execution;

                if (toolExecution.result && toolExecution.result.output) {
                    if (typeof toolExecution.result.output === 'object') {
                        const nestedOutput = toolExecution.result.output;
                        output = nestedOutput.output || null;
                        sessionName = nestedOutput.session_name || null;
                        status = nestedOutput.status || null;
                    } else if (typeof toolExecution.result.output === 'string') {
                        output = toolExecution.result.output;
                    }
                }

                if (!sessionName && toolExecution.arguments) {
                    sessionName = toolExecution.arguments.session_name || null;
                }
            }
            // Fallback to content.content structure
            else if (assistantParsed.content && typeof assistantParsed.content === 'object') {
                if (assistantParsed.content.content && typeof assistantParsed.content.content === 'string') {
                    try {
                        const contentParsed = JSON.parse(assistantParsed.content.content);
                        if (contentParsed.tool_execution) {
                            const toolExecution = contentParsed.tool_execution;

                            if (toolExecution.result && toolExecution.result.output) {
                                if (typeof toolExecution.result.output === 'object') {
                                    const nestedOutput = toolExecution.result.output;
                                    output = nestedOutput.output || null;
                                    sessionName = nestedOutput.session_name || null;
                                    status = nestedOutput.status || null;
                                } else if (typeof toolExecution.result.output === 'string') {
                                    output = toolExecution.result.output;
                                }
                            }

                            if (!sessionName && toolExecution.arguments) {
                                sessionName = toolExecution.arguments.session_name || null;
                            }
                        }
                    } catch (e) {
                        console.error('Failed to parse assistant content.content:', e);
                    }
                }
            }
        }
    }

    return {
        sessionName,
        output,
        status,
        success: actualIsSuccess,
        timestamp: actualTimestamp
    };
}

export function CheckCommandOutputToolView({
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
        sessionName,
        output,
        status,
        success: actualIsSuccess,
        timestamp: actualTimestamp
    } = extractCheckCommandOutputData(
        toolCall,
        toolResult,
        isSuccess,
        toolTimestamp,
        assistantTimestamp
    );

    const name = toolCall.function_name.replace(/_/g, '-').toLowerCase();
    const toolTitle = getToolTitle(name);

    const formattedOutput = React.useMemo(() => {
        if (!output) return [];

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

        // Clean up escape sequences
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
        const fullText = `session: ${sessionName}\n${output || ''}`;
        navigator.clipboard.writeText(fullText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const isSessionRunning = status?.includes('still running') || status?.includes('running');

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
                            {actualIsSuccess ? 'Output retrieved successfully' : 'Failed to retrieve output'}
                        </Badge>
                    )}
                    
                    {isStreaming && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                            <Loader2 className="h-3 w-3 animate-spin text-blue-600 dark:text-blue-400" />
                            <span className="text-[10px] font-medium text-blue-700 dark:text-blue-300">Checking output</span>
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
                        <div className="flex-1 bg-zinc-50 dark:bg-[#1a1a1b] rounded-xl border border-black/10 dark:border-white/5 overflow-hidden flex flex-col relative">
                            <div className="flex-1 overflow-hidden">
                                <ScrollArea className="h-full">
                                    <div className="p-4 font-mono text-[13px] leading-relaxed">
                                        <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500 italic">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            <span>Retrieving output for session: {sessionName}...</span>
                                        </div>
                                    </div>
                                </ScrollArea>
                            </div>
                        </div>
                    </div>
                ) : sessionName ? (
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
                                        {/* Session Info as terminal prompt/comment */}
                                        <div className="mb-3">
                                            <span className="text-purple-600 dark:text-[#d38aea] font-semibold">root@talos:~ $ </span>
                                            <span className="text-zinc-500 dark:text-zinc-400 italic"># checking output for session: </span>
                                            <span className="text-zinc-900 dark:text-zinc-100">{sessionName}</span>
                                        </div>

                                        {/* Output Content */}
                                        {formattedOutput.length > 0 ? (
                                            <div className="text-zinc-700 dark:text-zinc-300">
                                                {formattedOutput.map((line, index) => (
                                                    <div key={index} className="min-h-[1.5em] whitespace-pre-wrap break-all overflow-visible">
                                                        {line}
                                                    </div>
                                                ))}
                                                
                                                {/* Status message */}
                                                {status && (
                                                    <div className="mt-4 py-2 px-3 bg-zinc-100 dark:bg-zinc-800 rounded border border-black/5 dark:border-white/5 text-zinc-600 dark:text-zinc-400 text-[12px]">
                                                        <span className="text-blue-600 dark:text-blue-400 font-semibold mr-2">STATUS:</span>
                                                        {status}
                                                    </div>
                                                )}

                                                {/* Empty lines for scrolling */}
                                                {emptyLines.map((_, idx) => (
                                                    <div key={`empty-${idx}`} className="h-[1.5em]" />
                                                ))}
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
                            No Session Found
                        </h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center max-w-md">
                            No session name was detected. Please provide a valid session name to check.
                        </p>
                    </div>
                )}
            </div>

            <div className="px-4 py-2 h-10 bg-gradient-to-r from-zinc-50/90 to-zinc-100/90 dark:from-zinc-900/90 dark:to-zinc-800/90 backdrop-blur-sm border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center gap-4">
                <div className="h-full flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                    {!isStreaming && sessionName && (
                        <Badge variant="outline" className="h-6 py-0.5 bg-zinc-50 dark:bg-zinc-900">
                            <Terminal className="h-3 w-3 mr-1" />
                            Session
                        </Badge>
                    )}
                </div>

                <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" />
                    {actualTimestamp && !isStreaming
                        ? formatTimestamp(actualTimestamp)
                        : ''}
                </div>
            </div>
        </div>
    );
} 