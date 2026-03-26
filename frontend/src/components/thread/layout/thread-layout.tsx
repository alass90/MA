import React, { useState, useEffect, useRef, memo, useMemo } from 'react';
import * as ResizablePrimitive from 'react-resizable-panels';
import { SiteHeader } from '@/components/thread/thread-site-header';
import { FileViewerModal } from '@/components/thread/file-viewer-modal';
import { ToolCallSidePanel } from '@/components/thread/tool-call-side-panel';
import { FileViewerPanel } from '@/components/thread/FileViewerPanel';
import { FullstackBuilderPanel } from '@/components/thread/tool-views/fullstack-builder/FullstackBuilderPanel';
import { Project } from '@/lib/api/threads';
import { ApiMessageType } from '@/components/thread/types';
import { ToolCallInput } from '@/components/thread/tool-call-side-panel';
import { useIsMobile } from '@/hooks/utils';
import { cn } from '@/lib/utils';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';

interface ThreadLayoutProps {
  children: React.ReactNode;
  threadId: string;
  projectName: string;
  projectId: string;
  project: Project | null;
  sandboxId: string | null;
  isSidePanelOpen: boolean;
  onToggleSidePanel: () => void;
  onProjectRenamed?: (newName: string) => void;
  onViewFiles: (filePath?: string, filePathList?: string[]) => void;
  fileViewerOpen: boolean;
  setFileViewerOpen: (open: boolean) => void;
  fileToView: string | null;
  filePathList?: string[];
  toolCalls: ToolCallInput[];
  messages: ApiMessageType[];
  externalNavIndex?: number;
  agentStatus: 'idle' | 'running' | 'connecting' | 'error';
  currentToolIndex: number;
  onSidePanelNavigate: (index: number) => void;
  onSidePanelClose: () => void;
  renderToolResult: (toolContent?: string, isSuccess?: boolean) => React.ReactNode;
  onToggleDeliverables?: () => void;
  isLoading: boolean;
  isMobile: boolean;
  initialLoadCompleted: boolean;
  agentName?: string;
  disableInitialAnimation?: boolean;
  compact?: boolean;
  variant?: 'default' | 'shared';
  chatInput?: React.ReactNode;
  leftSidebarState?: 'collapsed' | 'expanded';
  streamingTextContent?: string; // Live streaming content from assistant (includes text + XML)
  streamingToolCall?: any; // Live streaming tool call with arguments
  // File viewer panel props
  isFileViewerPanelOpen?: boolean;
  onCloseFileViewerPanel?: () => void;
  renderAssistantMessage?: (props: any) => React.ReactNode;
  storageToView?: string | null;
  // Fullstack Builder IDE props
  isFullstackBuilderOpen?: boolean;
  onCloseFullstackBuilder?: () => void;
}

export const ThreadLayout = memo(function ThreadLayout({
  children,
  threadId,
  projectName,
  projectId,
  project,
  sandboxId,
  isSidePanelOpen,
  onToggleSidePanel,
  onProjectRenamed,
  onViewFiles,
  fileViewerOpen,
  setFileViewerOpen,
  fileToView,
  filePathList,
  toolCalls,
  messages,
  externalNavIndex,
  agentStatus,
  currentToolIndex,
  onSidePanelNavigate,
  onSidePanelClose,
  renderAssistantMessage,
  renderToolResult,
  isLoading,
  isMobile,
  initialLoadCompleted,
  agentName,
  disableInitialAnimation = false,
  compact = false,
  variant = 'default',
  chatInput,
  leftSidebarState = 'collapsed',
  streamingTextContent,
  streamingToolCall,
  isFileViewerPanelOpen,
  onCloseFileViewerPanel,
  onToggleDeliverables,
  storageToView,
  isFullstackBuilderOpen = false,
  onCloseFullstackBuilder,
}: ThreadLayoutProps) {
  const isActuallyMobile = useIsMobile();

  // Track when panel should be visible
  const shouldShowPanel = (isSidePanelOpen || isFileViewerPanelOpen || isFullstackBuilderOpen) && initialLoadCompleted;

  // Extract streaming tool arguments as JSON string (what FileOperationToolView expects)
  const streamingToolArgsJson = React.useMemo(() => {
    if (!streamingToolCall) return undefined;

    try {
      // metadata is a JSON string, parse it first
      const metadata = typeof streamingToolCall.metadata === 'string'
        ? JSON.parse(streamingToolCall.metadata)
        : streamingToolCall.metadata;

      // Get the arguments from metadata.tool_calls[0].arguments
      const args = metadata?.tool_calls?.[0]?.arguments;

      if (!args) return undefined;

      // Arguments is already a JSON string (might be escaped, unescape if needed)
      const argsStr = typeof args === 'string' ? args : JSON.stringify(args);
      return argsStr;
    } catch (e) {
      return undefined;
    }
  }, [streamingToolCall]);

  // Refs for panel APIs to control sizes programmatically
  const mainPanelRef = useRef<ResizablePrimitive.ImperativePanelHandle>(null);
  const sidePanelRef = useRef<ResizablePrimitive.ImperativePanelHandle>(null);

  // Update sizes when panel visibility changes with smooth animation
  useEffect(() => {
    if (shouldShowPanel) {
      // Open panel smoothly - use larger size for Builder or File Viewer
      const targetSize = isFullstackBuilderOpen ? 70 : isFileViewerPanelOpen ? 65 : 40;
      const mainSize = 100 - targetSize;
      
      requestAnimationFrame(() => {
        sidePanelRef.current?.resize(targetSize);
        mainPanelRef.current?.resize(mainSize);
      });
    } else {
      // Close panel - resize smoothly, content disappears immediately
      const timeout = setTimeout(() => {
        sidePanelRef.current?.resize(0);
        mainPanelRef.current?.resize(100);
      }, 0);
      return () => clearTimeout(timeout);
    }
  }, [shouldShowPanel, isFileViewerPanelOpen, isFullstackBuilderOpen]);

  // Compact mode for embedded use
  if (compact) {
    return (
      <>
        <div className="relative h-full">
          {/* Main content - always full width */}
          <div className="flex flex-col h-full overflow-hidden">
            {children}
          </div>

          {/* Preview Panel OR Tool Call Side Panel - Full replacement overlay for compact */}
          {isFullstackBuilderOpen && onCloseFullstackBuilder ? (
            <div className="absolute inset-0 bg-background z-40">
              <FullstackBuilderPanel
                sandboxId={sandboxId || undefined}
                agentStatus={agentStatus}
              />
            </div>
          ) : isFileViewerPanelOpen ? (
            <div className="absolute inset-0 bg-background z-40">
              <FileViewerPanel
                sandboxId={sandboxId || ''}
                filePath={fileToView || ''}
                storageUrl={storageToView || undefined}
                onClose={onCloseFileViewerPanel || (() => {})}
              />
            </div>
          ) : isSidePanelOpen && initialLoadCompleted && (
            <div className="absolute inset-0 bg-background z-40">
              <ToolCallSidePanel
                isOpen={true}
                onClose={onSidePanelClose}
                toolCalls={toolCalls}
                messages={messages}
                externalNavigateToIndex={externalNavIndex}
                agentStatus={agentStatus}
                currentIndex={currentToolIndex}
                onNavigate={onSidePanelNavigate}
                project={project || undefined}
                renderAssistantMessage={renderAssistantMessage}
                renderToolResult={renderToolResult}
                isLoading={!initialLoadCompleted || isLoading}
                onFileClick={onViewFiles}
                agentName={agentName}
                disableInitialAnimation={disableInitialAnimation}
                compact={true}
                streamingText={streamingToolArgsJson}
                sandboxId={sandboxId}
              />
            </div>
          )}

          {/* File Viewer Modal */}
          {sandboxId && (
            <FileViewerModal
              open={fileViewerOpen}
              onOpenChange={setFileViewerOpen}
              sandboxId={sandboxId}
              initialFilePath={fileToView}
              projectId={projectId}
              filePathList={filePathList}
            />
          )}
        </div>
      </>
    );
  }

  // Full layout mode
  // Use ResizablePanelGroup for desktop, regular flex for mobile
  if (isActuallyMobile) {
    return (
      <div className="flex h-screen">
        <div className="flex flex-col flex-1 overflow-hidden relative">
          <SiteHeader
            threadId={threadId}
            projectName={projectName}
            projectId={projectId}
            onViewFiles={onViewFiles}
            onToggleSidePanel={onToggleSidePanel}
            onToggleDeliverables={onToggleDeliverables}
            onProjectRenamed={onProjectRenamed}
            isMobileView={isMobile}
            variant={variant}
          />

          <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
            {children}
          </div>

          {/* ChatInput - positioned at bottom for mobile */}
          {chatInput && (
            <div className="flex-shrink-0 relative z-10 bg-gradient-to-b from-background via-background/90 to-transparent px-4">
              <div className="mx-auto max-w-[748px] w-full">
                {chatInput}
              </div>
            </div>
          )}
        </div>

        <ToolCallSidePanel
          isOpen={isSidePanelOpen && initialLoadCompleted}
          onClose={onSidePanelClose}
          toolCalls={toolCalls}
          messages={messages}
          externalNavigateToIndex={externalNavIndex}
          agentStatus={agentStatus}
          currentIndex={currentToolIndex}
          onNavigate={onSidePanelNavigate}
          project={project || undefined}
          renderAssistantMessage={renderAssistantMessage}
          renderToolResult={renderToolResult}
          isLoading={!initialLoadCompleted || isLoading}
          onFileClick={onViewFiles}
          agentName={agentName}
          disableInitialAnimation={disableInitialAnimation}
          streamingText={streamingToolArgsJson}
          sandboxId={sandboxId}
        />

        {sandboxId && (
          <FileViewerModal
            open={fileViewerOpen}
            onOpenChange={setFileViewerOpen}
            sandboxId={sandboxId}
            initialFilePath={fileToView}
            projectId={projectId}
            filePathList={filePathList}
          />
        )}

        {/* File Viewer Panel Overlay for Mobile Layout */}
        {isFullstackBuilderOpen && onCloseFullstackBuilder && (
          <div className="absolute inset-0 bg-background z-[100]">
            <FullstackBuilderPanel
              sandboxId={sandboxId || undefined}
              agentStatus={agentStatus}
            />
          </div>
        )}

        {isFileViewerPanelOpen && (
          <div className="absolute inset-0 bg-background z-[100]">
            <FileViewerPanel
              sandboxId={sandboxId || ''}
              filePath={fileToView || ''}
              storageUrl={storageToView || undefined}
              onClose={onCloseFileViewerPanel || (() => {})}
            />
          </div>
        )}
      </div>
    );
  }

  // Desktop layout with resizable panels
  return (
    <div className="flex h-screen bg-background text-foreground">
      <ResizablePanelGroup
        direction="horizontal"
        className="h-screen bg-background"
        style={{ transition: 'none' }}
      >
        {/* Main content panel */}
        <ResizablePanel
          ref={mainPanelRef}
          defaultSize={shouldShowPanel ? 60 : 100}
          minSize={shouldShowPanel ? 30 : 100}
          maxSize={shouldShowPanel ? 95 : 100}
          className="flex flex-col overflow-hidden relative bg-background"
        >
          <SiteHeader
            threadId={threadId}
            projectName={projectName}
            projectId={projectId}
            onViewFiles={onViewFiles}
            onToggleSidePanel={onToggleSidePanel}
            onToggleDeliverables={onToggleDeliverables}
            onProjectRenamed={onProjectRenamed}
            isMobileView={isMobile}
            variant={variant}
          />

          <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
            {children}
          </div>

          {/* ChatInput - positioned at bottom of main content panel */}
          {chatInput && (
            <div className="flex-shrink-0 relative z-10 bg-gradient-to-b from-background via-background/90 to-transparent px-4">
              <div className="mx-auto max-w-[748px] w-full">
                {chatInput}
              </div>
            </div>
          )}
        </ResizablePanel>

        {/* Resizable handle - always render */}
        <ResizableHandle
          className="z-20 w-1 bg-transparent hover:bg-black/5 transition-colors"
        />

        {/* Side panel - always render but control size */}
        <ResizablePanel
          ref={sidePanelRef}
          defaultSize={shouldShowPanel ? (isFullstackBuilderOpen ? 70 : isFileViewerPanelOpen ? 65 : 40) : 0}
          minSize={shouldShowPanel ? 20 : 0}
          maxSize={shouldShowPanel ? 85 : 0}
          collapsible={true}
          className={cn(
            "relative bg-background",
            // Match ChatInput horizontal spacing: px-4
            shouldShowPanel ? (
            isFullstackBuilderOpen ? "p-3 pl-0" : 
              isFileViewerPanelOpen ? "p-0" : "px-4 pb-5 pt-4"
            ) : "px-0",
            !shouldShowPanel ? "hidden" : ""
          )}
        >
          {isFullstackBuilderOpen && onCloseFullstackBuilder ? (
            <FullstackBuilderPanel
              sandboxId={sandboxId || undefined}
              agentStatus={agentStatus}
            />
          ) : isFileViewerPanelOpen ? (
            <FileViewerPanel
              sandboxId={sandboxId || ''}
              filePath={fileToView || ''}
              storageUrl={storageToView}
              onClose={onCloseFileViewerPanel || (() => {})}
            />
          ) : (
            <ToolCallSidePanel
              isOpen={isSidePanelOpen && initialLoadCompleted}
              onClose={onSidePanelClose}
              toolCalls={toolCalls}
              messages={messages}
              externalNavigateToIndex={externalNavIndex}
              agentStatus={agentStatus}
              currentIndex={currentToolIndex}
              onNavigate={onSidePanelNavigate}
              project={project || undefined}
              renderAssistantMessage={renderAssistantMessage}
              renderToolResult={renderToolResult}
              isLoading={!initialLoadCompleted || isLoading}
              onFileClick={onViewFiles}
              agentName={agentName}
              disableInitialAnimation={disableInitialAnimation}
              streamingText={streamingToolArgsJson}
              sandboxId={sandboxId}
            />
          )}
        </ResizablePanel>
      </ResizablePanelGroup>

      <FileViewerModal
        open={fileViewerOpen}
        onOpenChange={setFileViewerOpen}
        sandboxId={sandboxId || ''}
        initialFilePath={fileToView}
        projectId={projectId}
        filePathList={filePathList}
      />

    </div>
  );
});
