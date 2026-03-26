'use client';

import { Project } from '@/lib/api/threads';
import { getUserFriendlyToolName } from '@/components/thread/utils';
import { cn } from '@/lib/utils';
import React, { memo, useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiMessageType } from '@/components/thread/types';
import { CircleDashed, X, ChevronLeft, ChevronRight, Computer, Minimize2, Globe, Wrench, CheckCircle } from 'lucide-react';
import { useIsMobile } from '@/hooks/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ToolView } from './tool-views/wrapper';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { HealthCheckedVncIframe } from './HealthCheckedVncIframe';
import { BrowserHeader } from './tool-views/BrowserToolView';
import { useTranslations } from 'next-intl';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useDocumentModalStore } from '@/stores/use-document-modal-store';


// ============================================================================
// Types & Interfaces
// ============================================================================

import { ToolCallData, ToolResultData } from './tool-views/types';

/**
 * Structured tool call input - data comes directly from metadata
 */
export interface ToolCallInput {
  toolCall: ToolCallData;
  toolResult?: ToolResultData;
  assistantTimestamp?: string;
  toolTimestamp?: string;
  isSuccess?: boolean;
  messages?: ApiMessageType[];
}

interface ToolCallSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  toolCalls: ToolCallInput[];
  currentIndex: number;
  onNavigate: (newIndex: number) => void;
  externalNavigateToIndex?: number;
  messages?: ApiMessageType[];
  agentStatus: string;
  project?: Project;
  renderAssistantMessage?: (
    assistantContent?: string,
    toolContent?: string,
  ) => React.ReactNode;
  renderToolResult?: (
    toolContent?: string,
    isSuccess?: boolean,
  ) => React.ReactNode;
  isLoading?: boolean;
  agentName?: string;
  onFileClick?: (filePath: string) => void;
  disableInitialAnimation?: boolean;
  compact?: boolean;
  streamingText?: string; // Live streaming content from assistant message
  sandboxId?: string | null;
  initialView?: ViewType;
  onViewChange?: (view: ViewType) => void;
}

interface ToolCallSnapshot {
  id: string;
  toolCall: ToolCallInput;
  index: number;
  timestamp: number;
}

type NavigationMode = 'live' | 'manual';
type ViewType = 'tools' | 'browser';

// ============================================================================
// Constants
// ============================================================================

const FLOATING_LAYOUT_ID = 'tool-panel-float';
const CONTENT_LAYOUT_ID = 'tool-panel-content';

// ============================================================================
// Sub-components
// ============================================================================

interface ViewToggleProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const ViewToggle = memo(function ViewToggle({ currentView, onViewChange }: ViewToggleProps) {
  return (
    <div className="relative flex items-center gap-1 bg-muted rounded-3xl px-1 py-1">
      <motion.div
        className="absolute h-7 w-7 bg-white rounded-xl shadow-sm"
        initial={false}
        animate={{
          x: currentView === 'tools' ? 0 : 32,
        }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 30
        }}
      />

      <Button
        size="sm"
        onClick={() => onViewChange('tools')}
        className={`relative z-10 h-7 w-7 p-0 rounded-xl bg-transparent hover:bg-transparent shadow-none ${currentView === 'tools'
          ? 'text-black'
          : 'text-gray-500 dark:text-gray-400'
          }`}
        title="Switch to Tool View"
      >
        <Wrench className="h-3.5 w-3.5" />
      </Button>

      <Button
        size="sm"
        onClick={() => onViewChange('browser')}
        className={`relative z-10 h-7 w-7 p-0 rounded-xl bg-transparent hover:bg-transparent shadow-none ${currentView === 'browser'
          ? 'text-black'
          : 'text-gray-500 dark:text-gray-400'
          }`}
        title="Switch to Browser View"
      >
        <Globe className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
});

ViewToggle.displayName = 'ViewToggle';

// ============================================================================

interface PanelHeaderProps {
  agentName?: string;
  onClose: () => void;
  isStreaming?: boolean;
  variant?: 'drawer' | 'desktop' | 'motion';
  showMinimize?: boolean;
  layoutId?: string;
  statusText?: string;
}

const PanelHeader = memo(function PanelHeader({
  agentName,
  onClose,
  isStreaming = false,
  variant = 'desktop',
  showMinimize = false,
  layoutId,
  statusText,
}: PanelHeaderProps) {
  const title = "Talos's Computer";

  if (variant === 'drawer') {
    return (
      <DrawerHeader className="pb-2">
        <div className="flex items-center justify-between">
          <DrawerTitle className="text-lg font-medium">
            {title}
          </DrawerTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
            title="Minimize to floating preview"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
        </div>
      </DrawerHeader>
    );
  }

  if (variant === 'motion') {
    return (
      <div className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="ml-2">
              <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                {title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isStreaming && (
              <div className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 flex items-center gap-1.5">
                <CircleDashed className="h-3 w-3 animate-spin" />
                <span>Running</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
              title="Minimize to floating preview"
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-4 pl-4 pr-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
            {title}
          </h2>
          {statusText && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">
              {statusText}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isStreaming && (
            <Badge variant="outline" className="gap-1.5 p-2 rounded-3xl border-none bg-transparent">
              <CircleDashed className="h-3 w-3 animate-spin text-blue-500" />
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
            title={showMinimize ? "Minimize to floating preview" : "Close"}
          >
            {showMinimize ? <Minimize2 className="h-4 w-4" /> : <X className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
});

PanelHeader.displayName = 'PanelHeader';

// ============================================================================

interface NavigationControlsProps {
  displayIndex: number;
  displayTotalCalls: number;
  safeInternalIndex: number;
  latestIndex: number;
  isLiveMode: boolean;
  agentStatus: string;
  onPrevious: () => void;
  onNext: () => void;
  onSliderChange: (value: number[]) => void;
  onJumpToLatest: () => void;
  footerLabel?: string;
  isStreaming?: boolean;
}

const NavigationControls = memo(function NavigationControls({
  displayIndex,
  displayTotalCalls,
  safeInternalIndex,
  latestIndex,
  isLiveMode,
  agentStatus,
  onPrevious,
  onNext,
  onSliderChange,
  onJumpToLatest,
  isMobile = false,
}: NavigationControlsProps & { isMobile?: boolean }) {
  const timestamp = "Live"; // Fallback if no timestamp is found
  // Note: timestamps are handled in snapshots, but for simplicity we use "live" logic from snippet

  if (isMobile) {
    return (
      <div className="px-4 py-3 bg-[var(--background-menu-white)] border-t border-[var(--border-main)] flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onPrevious}
              disabled={displayIndex <= 0}
              className="h-8 w-8 text-[var(--icon-secondary)] hover:text-[var(--icon-blue)]"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNext}
              disabled={safeInternalIndex >= latestIndex}
              className="h-8 w-8 text-[var(--icon-secondary)] hover:text-[var(--icon-blue)]"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-1 text-sm">
             <div className="h-[8px] w-[8px] rounded-full bg-[var(--text-tertiary)]"></div>
             <span className="text-[var(--text-tertiary)]">{isLiveMode ? 'live' : `${displayIndex + 1}/${displayTotalCalls}`}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-auto flex w-full items-center gap-2 px-4 h-[44px] relative bg-[var(--background-menu-white)]">
      <div className="flex items-center" dir="ltr">
        <button
          type="button"
          onClick={onPrevious}
          disabled={displayIndex <= 0}
          className="flex items-center justify-center w-[24px] h-[24px] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-blue)] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-skip-back" aria-hidden="true"><path d="M17.971 4.285A2 2 0 0 1 21 6v12a2 2 0 0 1-3.029 1.715l-9.997-5.998a2 2 0 0 1-.003-3.432z"></path><path d="M3 20V4"></path></svg>
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={safeInternalIndex >= latestIndex}
          className="flex items-center justify-center w-[24px] h-[24px] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-blue)] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-skip-forward" aria-hidden="true"><path d="M21 4v16"></path><path d="M6.029 4.285A2 2 0 0 0 3 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z"></path></svg>
        </button>
      </div>

      <div className="flex-1 relative flex items-center group touch-none select-none">
        <Slider
          min={0}
          max={Math.max(0, displayTotalCalls - 1)}
          step={1}
          value={[safeInternalIndex]}
          onValueChange={onSliderChange}
          className="flex-1 [&>span:first-child]:h-1 [&>span:first-child]:bg-[var(--fill-tsp-gray-dark)] [&>span:first-child>span]:bg-[var(--text-blue)] [&>span:first-child>span]:h-1 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:bg-[var(--text-blue)] [&_[role=slider]]:border-2 [&_[role=slider]]:border-[var(--fill-input-chat)] [&_[role=slider]]:shadow-sm"
        />
        {/* Tooltip purely visual for now as in snippet */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 rounded bg-[var(--text-blue)] px-[10px] h-[28px] text-xs text-[var(--text-white)] hidden transition-opacity group-hover:flex items-center whitespace-nowrap">
          {isLiveMode ? 'Latest' : `Action ${safeInternalIndex + 1}`}
        </div>
      </div>

      <div 
        className="flex items-center gap-1 text-sm ms-[2px] cursor-pointer hover:opacity-80 transition-opacity"
        onClick={onJumpToLatest}
      >
        <div className={cn(
          "h-[8px] w-[8px] rounded-full",
          isLiveMode ? "bg-[var(--text-blue)]" : "bg-[var(--text-tertiary)]"
        )}></div>
        <span className={cn(
          "text-[13px] font-medium",
          isLiveMode ? "text-[var(--text-blue)]" : "text-[var(--text-tertiary)]"
        )}>live</span>
      </div>
    </div>
  );
});

NavigationControls.displayName = 'NavigationControls';

// ============================================================================

interface EmptyStateProps {
  t: (key: string) => string;
}

const EmptyState = memo(function EmptyState({ t }: EmptyStateProps) {
  return (
    <div className="flex-1 overflow-hidden flex flex-col sm:pl-3 sm:py-3 sm:pr-4">
      <div className="flex-1 bg-white dark:bg-[#272728] rounded-[22px] border border-black/[0.08] dark:border-white/[0.08] shadow-[0px_0px_8px_0px_rgba(0,0,0,0.02)] overflow-hidden flex flex-col items-center justify-center p-8">
        <div className="flex flex-col items-center space-y-6 max-w-sm text-center">
          <div className="relative">
            <div className="w-20 h-20 bg-[#f8f8f7] dark:bg-[#1a1a1b] rounded-full flex items-center justify-center border border-black/[0.05] dark:border-white/[0.05]">
              <Computer className="h-10 w-10 text-zinc-300 dark:text-zinc-600" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-white dark:bg-[#272728] rounded-full flex items-center justify-center border border-black/[0.08] dark:border-white/[0.08] shadow-sm">
              <div className="w-2.5 h-2.5 bg-zinc-300 dark:bg-zinc-600 rounded-full animate-pulse"></div>
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              {t('noActionsYet')}
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {t('workerActionsDescription')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});

EmptyState.displayName = 'EmptyState';

// ============================================================================

interface LoadingStateProps {
  agentName?: string;
  onClose: () => void;
  isMobile: boolean;
}

const LoadingState = memo(function LoadingState({ agentName, onClose, isMobile }: LoadingStateProps) {
  const content = (
    <>
      <PanelHeader
        agentName={agentName}
        onClose={onClose}
        variant={isMobile ? 'drawer' : 'desktop'}
        statusText="Initializing session..."
      />

      <div className="flex-1 overflow-hidden flex flex-col sm:pl-3 sm:py-3 sm:pr-4">
        <div className="flex-1 bg-white dark:bg-[#272728] rounded-[22px] overflow-hidden p-6 space-y-6">
          <div className="h-9 flex items-center px-6 bg-[#f8f8f7] dark:bg-[#1a1a1b] rounded-t-[22px] -mt-6 -mx-6 flex items-center">
            <Skeleton className="h-3 w-32" />
          </div>
          
          <div className="space-y-4 pt-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        </div>
      </div>

      <div className="h-12 px-4 bg-transparent border-t border-black/[0.04] dark:border-white/[0.04] flex justify-between items-center gap-4">
        <div className="items-center gap-2 flex-1 hidden sm:flex">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="flex items-center gap-2 flex-1 sm:flex-none justify-between sm:justify-end">
           <Skeleton className="h-3 w-12" />
           <div className="flex gap-1">
             <Skeleton className="h-7 w-7 rounded-lg" />
             <Skeleton className="h-7 w-7 rounded-lg" />
           </div>
        </div>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <DrawerContent className="h-[85vh]">
        {content}
      </DrawerContent>
    );
  }

  return (
    <div className="fixed inset-0 z-30 pointer-events-none">
      <div className="p-4 h-full flex items-stretch justify-end pointer-events-auto">
        <div className="border border-black/[0.08] dark:border-white/[0.08] rounded-3xl flex flex-col shadow-[0px_12px_44px_rgba(0,0,0,0.1),0px_0px_1px_rgba(0,0,0,0.18)] dark:shadow-[0px_12px_44px_rgba(0,0,0,0.3),0px_0px_1px_rgba(255,255,255,0.15)] bg-white dark:bg-[#1a1a1b] w-[90%] sm:w-[450px] md:w-[500px] lg:w-[550px] xl:w-[650px] overflow-hidden">
          {content}
        </div>
      </div>
    </div>
  );
});

LoadingState.displayName = 'LoadingState';

// ============================================================================
// Main Component
// ============================================================================

export const ToolCallSidePanel = memo(function ToolCallSidePanel({
  isOpen,
  onClose,
  toolCalls,
  currentIndex,
  onNavigate,
  messages,
  agentStatus,
  project,
  isLoading = false,
  externalNavigateToIndex,
  agentName,
  onFileClick,
  disableInitialAnimation,
  compact = false,
  streamingText,
  sandboxId,
  initialView,
  onViewChange,
}: ToolCallSidePanelProps) {
  const t = useTranslations('thread');
  const [dots, setDots] = useState('');
  const [internalIndex, setInternalIndex] = useState(0);
  const [navigationMode, setNavigationMode] = useState<NavigationMode>('live');
  const [toolCallSnapshots, setToolCallSnapshots] = useState<ToolCallSnapshot[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentView, setCurrentView] = useState<ViewType>(initialView || 'tools');
  const currentViewRef = useRef(currentView);
  const [vncRefreshKey, setVncRefreshKey] = useState(0);

  const isMobile = useIsMobile();
  const { isOpen: isDocumentModalOpen } = useDocumentModalStore();
  const sandbox = project?.sandbox;

  useEffect(() => {
    currentViewRef.current = currentView;
    if (onViewChange) {
      onViewChange(currentView);
    }
  }, [currentView, onViewChange]);

  // Sync with initialView prop when it changes externally
  useEffect(() => {
    if (initialView && initialView !== currentView) {
      setCurrentView(initialView);
    }
  }, [initialView]);

  const handleVncRefresh = useCallback(() => {
    setVncRefreshKey(prev => prev + 1);
  }, []);

  const persistentVncIframe = useMemo(() => {
    if (!sandbox || !sandbox.vnc_preview || !sandbox.pass || !sandbox.id) return null;

    return (
      <div>
        <HealthCheckedVncIframe
          key={vncRefreshKey}
          sandbox={{
            id: sandbox.id,
            vnc_preview: sandbox.vnc_preview,
            pass: sandbox.pass
          }}
        />
      </div>
    );
  }, [sandbox, vncRefreshKey]);

  const isBrowserTool = useCallback((toolName: string | undefined): boolean => {
    if (!toolName) return false;
    const lowerName = toolName.toLowerCase();
    return [
      'browser-navigate-to',
      'browser-act',
      'browser-extract-content',
      'browser-screenshot'
    ].includes(lowerName);
  }, []);

  // Initialize view to browser if browser action is in progress when panel opens
  useEffect(() => {
    if (!isInitialized && toolCallSnapshots.length > 0) {
      const streamingSnapshot = toolCallSnapshots.find(snapshot =>
        snapshot.toolCall.toolResult === undefined // No result = streaming
      );

      if (streamingSnapshot) {
        const toolName = streamingSnapshot.toolCall.toolCall?.function_name?.replace(/_/g, '-');
        const isStreamingBrowserTool = isBrowserTool(toolName);

        if (isStreamingBrowserTool) {
          setCurrentView('browser');
        }
      } else if (agentStatus === 'running') {
        // Check if any browser tool exists in snapshots
        const hasBrowserTool = toolCallSnapshots.some(snapshot => {
          const toolName = snapshot.toolCall.toolCall?.function_name?.replace(/_/g, '-');
          return isBrowserTool(toolName);
        });

        if (hasBrowserTool) {
          setCurrentView('browser');
        }
      }
    }
  }, [toolCallSnapshots, isInitialized, isBrowserTool, agentStatus]);

  // Handle view toggle visibility and auto-switching logic
  useEffect(() => {
    const safeIndex = Math.min(internalIndex, Math.max(0, toolCallSnapshots.length - 1));
    const currentSnapshot = toolCallSnapshots[safeIndex];
    const isCurrentSnapshotBrowserTool = isBrowserTool(currentSnapshot?.toolCall.toolCall?.function_name?.replace(/_/g, '-'));

    if (agentStatus === 'idle') {
      if (!isCurrentSnapshotBrowserTool && currentViewRef.current === 'browser') {
        setCurrentView('tools');
      }
      if (isCurrentSnapshotBrowserTool && currentViewRef.current === 'tools' && safeIndex === toolCallSnapshots.length - 1) {
        setCurrentView('browser');
      }
    } else if (agentStatus === 'running') {
      const streamingSnapshot = toolCallSnapshots.find(snapshot =>
        snapshot.toolCall.toolResult === undefined // No result = streaming
      );

      if (streamingSnapshot) {
        const toolName = streamingSnapshot.toolCall.toolCall?.function_name?.replace(/_/g, '-');
        const isStreamingBrowserTool = isBrowserTool(toolName);

        // Always switch to browser view when browser action is in progress
        if (isStreamingBrowserTool) {
          setCurrentView('browser');
        }

        if (!isStreamingBrowserTool && currentViewRef.current === 'browser') {
          setCurrentView('tools');
        }
      }
    }
  }, [toolCallSnapshots, internalIndex, isBrowserTool, agentStatus]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const newSnapshots = useMemo(() => {
    return toolCalls.map((toolCall, index) => ({
      id: `${index}-${toolCall.assistantTimestamp || Date.now()}`,
      toolCall,
      index,
      timestamp: Date.now(),
    }));
  }, [toolCalls]);

  useEffect(() => {
    const hadSnapshots = toolCallSnapshots.length > 0;
    const hasNewSnapshots = newSnapshots.length > toolCallSnapshots.length;
    setToolCallSnapshots(newSnapshots);

    // Check if a new browser tool call started and switch to browser view
    if (hasNewSnapshots && agentStatus === 'running') {
      const newSnapshot = newSnapshots[newSnapshots.length - 1];
      const toolName = newSnapshot?.toolCall.toolCall?.function_name?.replace(/_/g, '-');
      const isNewBrowserTool = isBrowserTool(toolName);

      // If it's a browser tool and doesn't have a result yet (streaming), switch to browser view
      if (isNewBrowserTool && newSnapshot.toolCall.toolResult === undefined) {
        setCurrentView('browser');
      }
    }

    if (!isInitialized && newSnapshots.length > 0) {
      const completedCount = newSnapshots.filter(s =>
        s.toolCall.toolResult !== undefined // Has result = completed
      ).length;

      if (completedCount > 0) {
        let lastCompletedIndex = -1;
        for (let i = newSnapshots.length - 1; i >= 0; i--) {
          const snapshot = newSnapshots[i];
          if (snapshot.toolCall.toolResult !== undefined) {
            lastCompletedIndex = i;
            break;
          }
        }
        setInternalIndex(Math.max(0, lastCompletedIndex));
      } else {
        setInternalIndex(Math.max(0, newSnapshots.length - 1));
      }
      setIsInitialized(true);
    } else if (hasNewSnapshots && navigationMode === 'live') {
      setInternalIndex(newSnapshots.length - 1);
    } else if (hasNewSnapshots && navigationMode === 'manual') {
      const wasAtLatest = internalIndex === toolCallSnapshots.length - 1;
      const latestSnapshot = newSnapshots[newSnapshots.length - 1];
      const latestToolName = latestSnapshot?.toolCall.toolCall?.function_name?.replace(/_/g, '-').toLowerCase();
      const isLatestFileOp = latestToolName && ['create-file', 'edit-file', 'full-file-rewrite', 'read-file', 'delete-file'].includes(latestToolName);

      // Auto-jump to latest if: was at latest OR new tool is a file operation
      if ((wasAtLatest || isLatestFileOp) && agentStatus === 'running') {
        console.log('[TOOL PANEL] Auto-jumping to latest:', { wasAtLatest, isLatestFileOp, latestToolName });
        setNavigationMode('live');
        setInternalIndex(newSnapshots.length - 1);
      }
    }
  }, [toolCalls, navigationMode, toolCallSnapshots.length, isInitialized, internalIndex, agentStatus, newSnapshots, isBrowserTool]);

  useEffect(() => {
    if ((!isInitialized || navigationMode === 'manual') && toolCallSnapshots.length > 0) {
      setInternalIndex(Math.min(currentIndex, toolCallSnapshots.length - 1));
    }
  }, [currentIndex, toolCallSnapshots.length, isInitialized, navigationMode]);

  const { safeInternalIndex, currentSnapshot, currentToolCall, totalCalls, latestIndex, completedToolCalls, totalCompletedCalls } = useMemo(() => {
    const safeIndex = Math.min(internalIndex, Math.max(0, toolCallSnapshots.length - 1));
    const snapshot = toolCallSnapshots[safeIndex];
    const toolCall = snapshot?.toolCall;
    const total = toolCallSnapshots.length;
    const latest = Math.max(0, total - 1);

    const completed = toolCallSnapshots.filter(snapshot =>
      snapshot.toolCall.toolResult !== undefined // Has result = completed
    );
    const completedCount = completed.length;

    return {
      safeInternalIndex: safeIndex,
      currentSnapshot: snapshot,
      currentToolCall: toolCall,
      totalCalls: total,
      latestIndex: latest,
      completedToolCalls: completed,
      totalCompletedCalls: completedCount
    };
  }, [internalIndex, toolCallSnapshots]);

  let displayToolCall = currentToolCall;
  let displayIndex = safeInternalIndex;
  const displayTotalCalls = totalCalls;

  const isCurrentToolStreaming = currentToolCall?.toolResult === undefined;

  // Check if current streaming tool is a file operation
  const currentToolName = currentToolCall?.toolCall?.function_name?.replace(/_/g, '-').toLowerCase();
  const isFileOperation = currentToolName && ['create-file', 'edit-file', 'full-file-rewrite', 'read-file', 'delete-file'].includes(currentToolName);

  console.log('[TOOL PANEL] Current tool:', {
    currentToolName,
    isFileOperation,
    isCurrentToolStreaming,
    totalCompletedCalls,
    safeInternalIndex,
    totalCalls
  });

  // Only fallback to last completed if NOT a file operation (file ops should stream)
  if (isCurrentToolStreaming && totalCompletedCalls > 0 && !isFileOperation) {
    const lastCompletedSnapshot = completedToolCalls[completedToolCalls.length - 1];
    // Ensure the snapshot has a valid toolCall before using it
    if (lastCompletedSnapshot?.toolCall?.toolCall) {
      displayToolCall = lastCompletedSnapshot.toolCall;
      displayIndex = completedToolCalls.length - 1;
      console.log('[TOOL PANEL] Falling back to last completed tool');
    }
  }

  const isStreaming = displayToolCall?.toolResult === undefined;

  const getActualSuccess = (toolCall: ToolCallInput): boolean => {
    // Check if we have a result object with success field
    if (toolCall?.toolResult?.success !== undefined) {
      return toolCall.toolResult.success;
    }
    // Fallback to isSuccess
    return toolCall?.isSuccess ?? true;
  };

  const isSuccess = isStreaming ? true : getActualSuccess(displayToolCall);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.error('Failed to copy text: ', err);
      return false;
    }
  }, []);

  const handleCopyContent = useCallback(async () => {
    const toolResult = displayToolCall?.toolResult;
    if (!toolResult) return;

    let fileContent = '';

    // Extract from structured result
    if (typeof toolResult.output === 'string') {
      fileContent = toolResult.output;
    } else if (toolResult.output) {
      fileContent = JSON.stringify(toolResult.output, null, 2);
    } else {
      fileContent = JSON.stringify(toolResult, null, 2);
    }

    const success = await copyToClipboard(fileContent);
    if (success) {
      toast.success('File content copied to clipboard');
    } else {
      toast.error('Failed to copy file content');
    }
  }, [displayToolCall?.toolResult, copyToClipboard]);

  const internalNavigate = useCallback((newIndex: number, source: string = 'internal') => {
    if (newIndex < 0 || newIndex >= totalCalls) return;

    const isNavigatingToLatest = newIndex === totalCalls - 1;
    setInternalIndex(newIndex);

    if (isNavigatingToLatest) {
      setNavigationMode('live');
    } else {
      setNavigationMode('manual');
    }

    if (source === 'user_explicit') {
      onNavigate(newIndex);
    }
  }, [totalCalls, onNavigate]);

  const isLiveMode = navigationMode === 'live';
  const pointerIndex = isLiveMode ? latestIndex : safeInternalIndex;

  const navigateToPrevious = useCallback(() => {
    if (pointerIndex > 0) {
      setNavigationMode('manual');
      internalNavigate(pointerIndex - 1, 'user_explicit');
    }
  }, [pointerIndex, internalNavigate]);

  const navigateToNext = useCallback(() => {
    if (pointerIndex < latestIndex) {
      const nextIndex = pointerIndex + 1;
      setNavigationMode(nextIndex === latestIndex ? 'live' : 'manual');
      internalNavigate(nextIndex, 'user_explicit');
    }
  }, [pointerIndex, latestIndex, internalNavigate]);

  const jumpToLive = useCallback(() => {
    setNavigationMode('live');
    setInternalIndex(latestIndex);
    internalNavigate(latestIndex, 'user_explicit');
  }, [latestIndex, internalNavigate]);

  const jumpToLatest = useCallback(() => {
    setNavigationMode('manual');
    setInternalIndex(latestIndex);
    internalNavigate(latestIndex, 'user_explicit');
  }, [latestIndex, internalNavigate]);

  const handleSliderChange = useCallback(([newValue]: [number]) => {
    const bounded = Math.max(0, Math.min(newValue, latestIndex));
    setNavigationMode(bounded === latestIndex ? 'live' : 'manual');
    internalNavigate(bounded, 'user_explicit');
  }, [latestIndex, internalNavigate]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isDocumentModalOpen) return;

      if ((event.metaKey || event.ctrlKey) && event.key === 'i') {
        event.preventDefault();
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose, isDocumentModalOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleSidebarToggle = (event: CustomEvent) => {
      if (event.detail.expanded) {
        handleClose();
      }
    };

    window.addEventListener(
      'sidebar-left-toggled',
      handleSidebarToggle as EventListener,
    );
    return () =>
      window.removeEventListener(
        'sidebar-left-toggled',
        handleSidebarToggle as EventListener,
      );
  }, [isOpen, handleClose]);

  useEffect(() => {
    if (externalNavigateToIndex !== undefined && externalNavigateToIndex >= 0 && externalNavigateToIndex < totalCalls) {
      internalNavigate(externalNavigateToIndex, 'external_click');
    }
  }, [externalNavigateToIndex, totalCalls, internalNavigate]);

  useEffect(() => {
    if (!isStreaming) return;
    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev === '...') return '';
        return prev + '.';
      });
    }, 500);

    return () => clearInterval(interval);
  }, [isStreaming]);

  if (!isOpen) {
    return null;
  }

  if (isLoading) {
    return <LoadingState agentName={agentName} onClose={handleClose} isMobile={isMobile} />;
  }

  const renderContent = () => {
    if (!displayToolCall && toolCallSnapshots.length === 0) {
      return (
        <div className="flex flex-col h-full">
          {!isMobile && (
            <PanelHeader
              agentName={agentName}
              onClose={handleClose}
            />
          )}
          <EmptyState t={t} />
        </div>
      );
    }

    if (!displayToolCall && toolCallSnapshots.length > 0) {
      const firstStreamingTool = toolCallSnapshots.find(s => s.toolCall.toolResult === undefined);
      if (firstStreamingTool && totalCompletedCalls === 0) {
        const toolName = firstStreamingTool.toolCall.toolCall?.function_name?.replace(/_/g, '-') || 'Tool';
        const userFriendlyName = getUserFriendlyToolName(toolName);
        
        return (
          <div className="flex flex-col h-full">
            {!isMobile && (
              <PanelHeader
                agentName={agentName}
                onClose={handleClose}
                isStreaming={true}
                statusText={`Talos is starting ${userFriendlyName}...`}
              />
            )}
            
            <div className="flex-1 overflow-hidden flex flex-col sm:px-4 sm:py-3">
              <div className="flex-1 bg-[var(--background-gray-main)] border border-[var(--border-dark)] dark:border-black/30 shadow-[0px_4px_32px_0px_rgba(0,0,0,0.04)] rounded-[12px] overflow-hidden flex flex-col">
                <div className="h-[36px] flex items-center px-3 w-full bg-[var(--background-gray-main)] border-b border-[var(--border-main)] rounded-t-lg shadow-[inset_0px_1px_0px_0px_#FFFFFF] dark:shadow-[inset_0px_1px_0px_0px_#FFFFFF15]">
                  <div className="flex-1 flex items-center justify-center">
                    <div className="max-w-[250px] truncate text-[var(--text-tertiary)] text-sm font-medium text-center">
                      {userFriendlyName}
                    </div>
                  </div>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center p-8">
                <div className="flex flex-col items-center space-y-6 max-w-sm text-center">
                  <div className="relative">
                    <div className="w-20 h-20 bg-blue-50/50 dark:bg-blue-900/10 rounded-full flex items-center justify-center border border-blue-100 dark:border-blue-900/20">
                      <CircleDashed className="h-10 w-10 text-blue-500 dark:text-blue-400 animate-spin" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                      Task in progress
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      {userFriendlyName} is currently executing. Results will appear here shortly.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <NavigationControls
              displayIndex={displayIndex}
              displayTotalCalls={displayTotalCalls}
              safeInternalIndex={safeInternalIndex}
              latestIndex={latestIndex}
              isLiveMode={isLiveMode}
              agentStatus={agentStatus}
              onPrevious={navigateToPrevious}
              onNext={navigateToNext}
              onSliderChange={handleSliderChange}
              onJumpToLatest={jumpToLatest}
              isMobile={isMobile}
            />
          </div>
        </div>
      );
      }

      return (
        <div className="flex flex-col h-full">
          {!isMobile && (
            <PanelHeader
              agentName={agentName}
              onClose={handleClose}
            />
          )}
          <div className="flex-1 p-4 overflow-auto">
            <div className="space-y-4">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-20 w-full rounded-md" />
            </div>
          </div>
        </div>
      );
    }

    // Ensure displayToolCall and toolCall exist before rendering
    if (!displayToolCall || !displayToolCall.toolCall) {
      return (
        <div className="flex flex-col h-full">
          {!isMobile && (
            <PanelHeader
              agentName={agentName}
              onClose={handleClose}
            />
          )}
          <div className="flex-1 p-4 overflow-auto">
            <div className="space-y-4">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-20 w-full rounded-md" />
            </div>
          </div>
        </div>
      );
    }

    // Pass structured data directly from metadata - NO CONTENT PARSING
    const toolView = (
      <ToolView
        toolCall={displayToolCall.toolCall}
        toolResult={displayToolCall.toolResult}
        assistantTimestamp={displayToolCall.assistantTimestamp}
        toolTimestamp={displayToolCall.toolTimestamp}
        isSuccess={isSuccess}
        isStreaming={isStreaming}
        project={project}
        messages={messages}
        agentStatus={agentStatus}
        currentIndex={displayIndex}
        totalCalls={displayTotalCalls}
        onFileClick={onFileClick}
        viewToggle={<ViewToggle currentView={currentView} onViewChange={setCurrentView} />}
        streamingText={isStreaming ? streamingText : undefined}
        sandboxId={sandboxId}
      />
    );

    const toolName = displayToolCall.toolCall?.function_name?.replace(/_/g, '-') || 'tool';
    const userFriendlyName = getUserFriendlyToolName(toolName);
    const args = displayToolCall.toolCall?.arguments || {};
    const contextText = args.url || args.target_url || args.path || args.filepath || args.filename || userFriendlyName;

    const statusText = isStreaming 
      ? `Talos is using ${userFriendlyName} | Executing...`
      : `Talos is using ${userFriendlyName} | Ready`;
    const capsuleHeader = (
      <div className="h-[36px] flex items-center px-3 w-full bg-[var(--background-gray-main)] border-b border-[var(--border-main)] rounded-t-lg shadow-[inset_0px_1px_0px_0px_#FFFFFF] dark:shadow-[inset_0px_1px_0px_0px_#FFFFFF15]">
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-[250px] truncate text-[var(--text-tertiary)] text-sm font-medium text-center">
            {contextText}
          </div>
        </div>
      </div>
    );

    return (
      <div className="flex flex-col h-full">
        {!isMobile && (
          <PanelHeader
            agentName={agentName}
            onClose={handleClose}
            isStreaming={isStreaming}
            variant="desktop"
            statusText={statusText}
          />
        )}

        <div className="flex-1 overflow-hidden flex flex-col sm:px-4 sm:py-3">
          <div className="flex-1 bg-[var(--background-gray-main)] border border-[var(--border-dark)] dark:border-black/30 shadow-[0px_4px_32px_0px_rgba(0,0,0,0.04)] rounded-[12px] overflow-hidden flex flex-col">
            {capsuleHeader}
            <div className="flex-1 overflow-hidden flex flex-col">
            {persistentVncIframe && (
              <div className={`${currentView === 'browser' ? 'h-full flex flex-col' : 'hidden'}`}>
                <BrowserHeader isConnected={true} onRefresh={handleVncRefresh} viewToggle={<ViewToggle currentView={currentView} onViewChange={setCurrentView} />} />
                <div className="flex-1 overflow-hidden grid items-center">
                  {persistentVncIframe}
                </div>
              </div>
            )}

            {!persistentVncIframe && currentView === 'browser' && (
              <div className="h-full flex flex-col">
                <BrowserHeader isConnected={false} viewToggle={<ViewToggle currentView={currentView} onViewChange={setCurrentView} />} />

                <div className="flex-1 flex flex-col items-center justify-center p-8">
                  <div className="flex flex-col items-center space-y-4 max-w-sm text-center">
                    <div className="w-16 h-16 bg-white dark:bg-[#1a1a1b] rounded-full flex items-center justify-center border border-black/[0.08] dark:border-white/[0.08]">
                      <Globe className="h-8 w-8 text-zinc-400 dark:text-zinc-500" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                        Browser not available
                      </h3>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                        No active browser session available. The browser will appear here when a sandbox is created and Browser tools are used.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentView === 'tools' && toolView}
            </div>
          </div>
        </div>

        <NavigationControls
          displayIndex={displayIndex}
          displayTotalCalls={displayTotalCalls}
          safeInternalIndex={safeInternalIndex}
          latestIndex={latestIndex}
          isLiveMode={isLiveMode}
          agentStatus={agentStatus}
          onPrevious={navigateToPrevious}
          onNext={navigateToNext}
          onSliderChange={handleSliderChange}
          onJumpToLatest={jumpToLatest}
          isMobile={isMobile}
        />
      </div>
    );
  };

  // Mobile version - use drawer
  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="h-[85vh]">
          <PanelHeader
            agentName={agentName}
            onClose={handleClose}
            variant="drawer"
          />

          <div className="flex-1 flex flex-col overflow-hidden">
            {renderContent()}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop version
  // When compact=true, use fixed overlay positioning
  // When compact=false, assume it's inside a ResizablePanel and fill the container
  if (compact) {
    return (
      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.div
            key="sidepanel"
            layoutId={FLOATING_LAYOUT_ID}
            initial={disableInitialAnimation ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              opacity: { duration: disableInitialAnimation ? 0 : 0.15 },
              layout: {
                type: "spring",
                stiffness: 400,
                damping: 35
              }
            }}
            className="m-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)] border border-black/[0.08] dark:border-white/[0.08] rounded-3xl flex flex-col z-30 shadow-[0px_12px_44px_rgba(0,0,0,0.1),0px_0px_1px_rgba(0,0,0,0.18)] dark:shadow-[0px_12px_44px_rgba(0,0,0,0.3),0px_0px_1px_rgba(255,255,255,0.15)]"
            style={{
              overflow: 'hidden',
            }}
          >
            <div className="flex-1 flex flex-col overflow-hidden">
              {renderContent()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // Desktop version inside ResizablePanel - fill container
  if (!isOpen) {
    return null;
  }

  return (
    <motion.div
      key="sidepanel-resizable"
      initial={disableInitialAnimation ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        opacity: {
          duration: disableInitialAnimation ? 0 : 0.2,
          ease: [0.4, 0, 0.2, 1]
        }
      }}
      className="h-full w-full flex flex-col bg-card overflow-hidden rounded-3xl border border-black/[0.08] dark:border-white/[0.08] shadow-[0px_12px_44px_rgba(0,0,0,0.1),0px_0px_1px_rgba(0,0,0,0.18)] dark:shadow-[0px_12px_44px_rgba(0,0,0,0.3),0px_0px_1px_rgba(255,255,255,0.15)]"
    >
      <div className="flex-1 flex flex-col overflow-hidden">
        {renderContent()}
      </div>
    </motion.div>
  );
});
