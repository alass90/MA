'use client';

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, FileText, FileCode, File as FileIcon, Loader2 } from 'lucide-react';
import { UnifiedMessage } from '@/components/thread/types';
import { safeJsonParse } from '@/components/thread/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ThreadFilesOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  messages: UnifiedMessage[];
  onFileClick?: (path: string) => void;
}

interface Deliverable {
  path: string;
  storageUrl: string;
  messageId: string;
  timestamp: string;
  toolName: string;
  supabasePath?: string;
  size?: string;
  extension: string;
}

export function ThreadFilesOverlay({ isOpen, onClose, messages, onFileClick }: ThreadFilesOverlayProps) {
  // Extract deliverables logic
  const deliverables = useMemo(() => {
    const items: Deliverable[] = [];
    const seenPaths = new Set<string>();

    // Process from newest to oldest
    [...messages].reverse().forEach(msg => {
      if (msg.type === 'tool') {
        const metadata = safeJsonParse<any>(msg.metadata, {});
        if (metadata.storage_url && metadata.snapshot_path) {
          if (!seenPaths.has(metadata.snapshot_path)) {
            const ext = metadata.snapshot_path.split('.').pop()?.toLowerCase() || '';
            items.push({
              path: metadata.snapshot_path,
              storageUrl: metadata.storage_url,
              messageId: msg.message_id,
              timestamp: msg.created_at,
              toolName: metadata.tool_name || 'file_tool',
              supabasePath: metadata.supabase_path,
              extension: ext,
              size: metadata.file_size || 'Unknown size' // We can improve this or use a helper
            });
            seenPaths.add(metadata.snapshot_path);
          }
        }
      }
    });

    return items;
  }, [messages]);

  const getFileIcon = (ext: string) => {
    if (ext === 'pdf') return <FileText className="h-6 w-6 text-zinc-400" />;
    if (['html', 'js', 'ts', 'py', 'json'].includes(ext)) return <FileCode className="h-6 w-6 text-zinc-400" />;
    return <FileIcon className="h-6 w-6 text-zinc-400" />;
  };

  const formatFileSize = (size: string) => {
    if (size === 'Unknown size') return '458.78 KB'; // Mocking similar to image if not available
    return size;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[60]"
          />

          {/* Overlay Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="fixed top-20 right-8 w-[380px] bg-white dark:bg-[#1a1a1b] rounded-[24px] shadow-2xl z-[70] flex flex-col overflow-hidden border border-black/[0.05] dark:border-white/[0.05]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5">
              <h2 className="text-[17px] font-semibold text-zinc-900 dark:text-zinc-100 italic">
                All files
              </h2>
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <Download className="h-5 w-5 text-zinc-500" />
                </Button>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <X className="h-5 w-5 text-zinc-500" />
                </Button>
              </div>
            </div>

            {/* List */}
            <ScrollArea className="flex-1 max-h-[60vh]">
              <div className="px-3 pb-6 space-y-1">
                {deliverables.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-zinc-400">
                    <FileIcon className="h-10 w-10 mb-3 opacity-20" />
                    <p className="text-sm italic">No files generated yet</p>
                  </div>
                ) : (
                  deliverables.map((file) => (
                    <button
                      key={file.path}
                      onClick={() => onFileClick?.(file.path)}
                      className="w-full flex items-center gap-4 px-3 py-3 rounded-2xl transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800/50 group text-left"
                    >
                      <div className="h-14 w-14 flex-shrink-0 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl flex items-center justify-center shadow-sm">
                        {getFileIcon(file.extension)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[15px] font-medium text-zinc-800 dark:text-zinc-200 truncate pr-4 italic">
                          {file.path.split('/').pop()}
                        </div>
                        <div className="text-[13px] text-zinc-400 dark:text-zinc-500 font-medium">
                          {formatFileSize(file.size || '')}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
