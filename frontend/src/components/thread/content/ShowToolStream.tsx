import React, { useEffect, useRef, useState } from 'react';
import { getToolIcon, getUserFriendlyToolName, extractPrimaryParam } from '@/components/thread/utils';
import { ActivityLog, ActivityStep } from '../ActivityLog';

// Define tool categories for different streaming behaviors
const STREAMABLE_TOOLS = {
    FILE_OPERATIONS: new Set(['Creating File', 'Rewriting File', 'AI File Edit', 'Editing Text', 'Editing File', 'Deleting File']),
    COMMAND_TOOLS: new Set(['Executing Command', 'Checking Command Output', 'Terminating Command', 'Listing Commands']),
    BROWSER_TOOLS: new Set(['Navigating to Page', 'Performing Action', 'Extracting Content', 'Taking Screenshot']),
    WEB_TOOLS: new Set(['Searching Web', 'Crawling Website', 'Scraping Website']),
    OTHER_STREAMABLE: new Set(['Calling data provider', 'Getting endpoints', 'Creating Tasks', 'Updating Tasks', 'Viewing Image', 'Creating Presentation Outline', 'Creating Presentation', 'Exposing Port', 'Getting Agent Config', 'Searching MCP Servers', 'Creating Credential Profile', 'Connecting Credential Profile', 'Checking Profile Connection', 'Configuring Profile For Agent', 'Getting Credential Profiles'])
};

const isStreamableTool = (toolName: string) => {
    return Object.values(STREAMABLE_TOOLS).some(toolSet => toolSet.has(toolName));
};

interface ShowToolStreamProps {
    content: string;
    messageId?: string | null;
    onToolClick?: (messageId: string | null, toolName: string) => void;
    showExpanded?: boolean; 
    startTime?: number; 
}

export const ShowToolStream: React.FC<ShowToolStreamProps> = ({
    content,
    messageId,
    onToolClick,
    showExpanded = false,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

    // Extract tool name
    let rawToolName: string | null = null;
    try {
      const parsed = JSON.parse(content);
      rawToolName = parsed.function?.name || parsed.tool_name;
    } catch (e) {
      const match = content.match(/(?:function|tool)[_\-]?name["']?\s*[:=]\s*["']?([^"'\s]+)/i);
      if (match) rawToolName = match[1];
    }
    
    const toolName = getUserFriendlyToolName(rawToolName || '');
    const paramDisplay = extractPrimaryParam(rawToolName || '', content);

    // Extract streaming content
    const streamingContent = React.useMemo(() => {
        if (!content) return { html: '', plainText: '' };
        try {
            const parsed = JSON.parse(content);
            const toolKey = toolName || '';
            
            // File operations
            if (STREAMABLE_TOOLS.FILE_OPERATIONS.has(toolKey)) {
                const c = parsed.code_edit || parsed.file_contents || (parsed.arguments ? (typeof parsed.arguments === 'string' ? JSON.parse(parsed.arguments).code_edit || JSON.parse(parsed.arguments).file_contents : parsed.arguments.code_edit || parsed.arguments.file_contents) : null);
                if (c) return { html: c, plainText: c };
            }
            // Command tools
            if (STREAMABLE_TOOLS.COMMAND_TOOLS.has(toolKey)) {
                const cmd = parsed.command || parsed.arguments?.command;
                if (cmd) return { html: `<strong>command:</strong> ${cmd}`, plainText: `command: ${cmd}` };
            }
            // Browser/Web
            if (STREAMABLE_TOOLS.BROWSER_TOOLS.has(toolKey) || STREAMABLE_TOOLS.WEB_TOOLS.has(toolKey)) {
                const val = parsed.url || parsed.action || parsed.instruction || parsed.query;
                if (val) return { html: val, plainText: val };
            }
            
            return { html: parsed.content || content, plainText: parsed.content || content };
        } catch (e) {
            return { html: content, plainText: content };
        }
    }, [content, toolName]);

    useEffect(() => {
        if (containerRef.current && shouldAutoScroll) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [content, shouldAutoScroll]);

    if (!toolName) return null;

    const step: ActivityStep = {
        id: messageId || 'streaming',
        type: 'thinking',
        name: toolName,
        iconName: rawToolName || undefined,
        parameter: paramDisplay || undefined,
        messageId: messageId || undefined,
        toolName: rawToolName || undefined,
        isStreaming: true,
        content: isStreamableTool(toolName) ? (
            <div 
                ref={containerRef}
                className="max-h-[300px] overflow-y-auto scrollbar-none text-[12px] font-mono whitespace-pre-wrap p-2 bg-zinc-50 dark:bg-zinc-900/50 rounded border border-zinc-100 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400"
            >
                {streamingContent.plainText}
            </div>
        ) : null
    };

    return <ActivityLog steps={[step]} onToolLogClick={onToolClick} className="my-2" />;
};
 