'use client';

import React, { useMemo } from 'react';
import { UnifiedMessage, ParsedMetadata } from '@/components/thread/types';
import { safeJsonParse } from '@/components/thread/utils';
import { FileAttachmentGrid } from './file-attachment';
import { Project } from '@/lib/api/threads';
import { Package, FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DeliverablesViewProps {
    messages: UnifiedMessage[];
    project?: Project;
    onFileClick?: (path: string, filePathList?: string[]) => void;
    sandboxId?: string | null;
}

interface Deliverable {
    path: string;
    storageUrl: string;
    messageId: string;
    timestamp: string;
    toolName: string;
    supabasePath?: string;
}

export function DeliverablesView({ messages, project, onFileClick, sandboxId }: DeliverablesViewProps) {
    // Extract all deliverables from tool results
    const deliverables = useMemo(() => {
        const items: Deliverable[] = [];
        messages.forEach(msg => {
            if (msg.type === 'tool') {
                const metadata = safeJsonParse<any>(msg.metadata, {});
                if (metadata.storage_url && metadata.snapshot_path) {
                    items.push({
                        path: metadata.snapshot_path,
                        storageUrl: metadata.storage_url,
                        messageId: msg.message_id,
                        timestamp: msg.created_at,
                        toolName: metadata.tool_name || 'file_tool',
                        supabasePath: metadata.supabase_path
                    });
                }
            }
        });
        // Sort by timestamp descending
        return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [messages]);

    if (deliverables.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-muted/30">
                <div className="w-16 h-16 bg-background rounded-full flex items-center justify-center border border-border mb-4">
                    <Package className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">No deliverables yet</h3>
                <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                    Agent-generated files (PDFs, reports, benchmarks, etc.) will appear here for instant access.
                </p>
            </div>
        );
    }

    // Group items by path to show only the latest version of each file if multiple snapshots exist
    // Actually, maybe showing all versions is better? Let's show unique paths for now to keep it clean.
    const uniqueDeliverables = useMemo(() => {
        const map = new Map<string, Deliverable>();
        deliverables.forEach(d => {
            if (!map.has(d.path)) {
                map.set(d.path, d);
            }
        });
        return Array.from(map.values());
    }, [deliverables]);

    const paths = uniqueDeliverables.map(d => d.path);
    const storageUrlsMap = uniqueDeliverables.reduce((acc, d) => {
        acc[d.path] = d.storageUrl;
        return acc;
    }, {} as Record<string, string>);
    
    const supabasePathsMap = uniqueDeliverables.reduce((acc, d) => {
        if (d.supabasePath) {
            acc[d.path] = d.supabasePath;
        }
        return acc;
    }, {} as Record<string, string>);

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
            <div className="p-4 border-b bg-muted/20">
                <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Package className="h-4 w-4 text-primary" />
                        Project Deliverables
                    </h3>
                    <span className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded-full border">
                        {uniqueDeliverables.length} files
                    </span>
                </div>
                <p className="text-xs text-muted-foreground">
                    Instant access to all files generated during this session.
                </p>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-4">
                    <FileAttachmentGrid
                        attachments={paths}
                        storageUrls={storageUrlsMap}
                        supabasePaths={supabasePathsMap}
                        onFileClick={onFileClick}
                        sandboxId={sandboxId || undefined}
                        project={project}
                        showPreviews={true}
                        standalone={true} // Use standalone for better grid layout in narrow side panel
                    />
                </div>
            </ScrollArea>
        </div>
    );
}
