'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  MoreHorizontal,
  Trash2,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Folder,
  Loader2
} from "lucide-react"
import { toast } from "sonner"
import { usePathname, useRouter } from "next/navigation"
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import Link from "next/link"
import { ShareModal } from "./share-modal"
import { DeleteConfirmationDialog } from "@/components/thread/DeleteConfirmationDialog"
import { useDeleteOperation } from '@/stores/delete-operation-store'
import { ThreadWithProject, GroupedThreads, groupThreadsByDate } from '@/hooks/sidebar/use-sidebar';
import { useDeleteMultipleThreads, useDeleteThread, useProjects } from '@/hooks/sidebar/use-sidebar';
import { projectKeys, threadKeys } from '@/hooks/threads/keys';
import { useThreadAgentStatuses } from '@/hooks/threads';
import { useThreads } from '@/hooks/threads/use-threads';
import { useTranslations } from 'next-intl';

// Component for individual thread item
const ThreadItem: React.FC<{
  thread: ThreadWithProject;
  isActive: boolean;
  isThreadLoading: boolean;
  isSelected: boolean;
  selectedThreads: Set<string>;
  loadingThreadId: string | null;
  pathname: string | null;
  isMobile: boolean;
  isAgentRunning?: boolean;
  isMultiSelectMode?: boolean;
  handleThreadClick: (e: React.MouseEvent<HTMLAnchorElement>, threadId: string, url: string) => void;
  toggleThreadSelection: (threadId: string, e?: React.MouseEvent) => void;
  handleDeleteThread: (threadId: string, threadName: string) => void;
  setSelectedItem: (item: { threadId: string; projectId: string } | null) => void;
  setShowShareModal: (show: boolean) => void;
}> = ({
  thread,
  isActive,
  isThreadLoading,
  isSelected,
  isMultiSelectMode,
  handleThreadClick,
  handleDeleteThread,
  setSelectedItem,
  setShowShareModal,
}) => {
    return (
      <SidebarMenuItem className="group/menu-item relative">
        <SidebarMenuButton
          asChild
          isActive={isActive}
          className={cn(
            "h-[36px] px-4 rounded-[10px] transition-colors",
            isActive ? "bg-muted/50 font-medium" : "text-muted-foreground/80 hover:bg-muted/30 hover:text-foreground"
          )}
        >
          <Link
            href={thread.url}
            onClick={(e) => handleThreadClick(e, thread.threadId, thread.url)}
            prefetch={false}
          >
            <span className="flex-1 truncate text-[14px]">
              {thread.projectName}
            </span>
          </Link>
        </SidebarMenuButton>

        <div className={cn(
          "absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/menu-item:opacity-100 transition-opacity",
          isActive && "opacity-100"
        )}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="p-1 rounded-md hover:bg-accent text-muted-foreground"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <MoreHorizontal className="size-[18px]" strokeWidth={2} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedItem({ threadId: thread.threadId, projectId: thread.projectId });
                  setShowShareModal(true);
                }}
              >
                <MoreHorizontal className="mr-2 size-[18px]" strokeWidth={2} />
                Share
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.open(thread.url, '_blank');
                }}
              >
                <ExternalLink className="mr-2 size-[18px]" strokeWidth={2} />
                Open in new tab
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDeleteThread(thread.threadId, thread.projectName);
                }}
              >
                <Trash2 className="mr-2 size-[18px]" strokeWidth={2} />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarMenuItem>
    );
  };

export function NavAgents() {
  const t = useTranslations('sidebar');
  const { isMobile, state, setOpenMobile } = useSidebar()
  const [loadingThreadId, setLoadingThreadId] = useState<string | null>(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState<{ threadId: string, projectId: string } | null>(null)
  const pathname = usePathname()
  const router = useRouter()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [threadToDelete, setThreadToDelete] = useState<{ id: string; name: string } | null>(null)
  const isNavigatingRef = useRef(false)
  const { performDelete } = useDeleteOperation();
  const isPerformingActionRef = useRef(false);
  const queryClient = useQueryClient();

  const [selectedThreads, setSelectedThreads] = useState<Set<string>>(new Set());
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [totalToDelete, setTotalToDelete] = useState(0);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageLimit = 20;
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const {
    data: threadsResponse,
    isLoading: isThreadsLoading,
    isFetching: isThreadsFetching,
    error: threadsError
  } = useThreads({
    page: currentPage,
    limit: pageLimit,
  });

  const { mutate: deleteThreadMutation, isPending: isDeletingSingle } = useDeleteThread();
  const {
    mutate: deleteMultipleThreadsMutation,
    isPending: isDeletingMultiple
  } = useDeleteMultipleThreads();

  const currentThreads = threadsResponse?.threads || [];

  const previousTotalRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (threadsResponse?.pagination) {
      const currentTotal = threadsResponse.pagination.total;
      if (previousTotalRef.current !== undefined &&
        currentTotal < previousTotalRef.current &&
        currentPage > 1) {
        setCurrentPage(1);
      }
      previousTotalRef.current = currentTotal;
    }
  }, [threadsResponse?.pagination, currentPage]);

  const combinedThreads: ThreadWithProject[] = useMemo(() => {
    if (currentThreads.length === 0) return [];
    
    const processed: ThreadWithProject[] = [];
    for (const thread of currentThreads) {
      const projectId = thread.project_id;
      const project = thread.project;
      if (!projectId) continue;
      
      const displayName = project?.name || 'Unnamed Project';
      const iconName = project?.icon_name;
      
      processed.push({
        threadId: thread.thread_id,
        projectId: projectId,
        projectName: displayName,
        url: `/projects/${projectId}/thread/${thread.thread_id}`,
        updatedAt: thread.updated_at || project?.updated_at || new Date().toISOString(),
        iconName: iconName,
      });
    }
    return processed.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [currentThreads]);

  const groupedThreads: GroupedThreads = groupThreadsByDate(combinedThreads);

  const pagination = threadsResponse?.pagination;
  const totalPages = pagination?.pages || 1;
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  const handlePreviousPage = () => {
    if (canGoPrevious) {
      setCurrentPage(prev => prev - 1);
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNextPage = () => {
    if (canGoNext) {
      setCurrentPage(prev => prev + 1);
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const threadIds = combinedThreads.map(thread => thread.threadId);
  const agentStatusMap = useThreadAgentStatuses(threadIds);

  const handleDeletionProgress = (completed: number, total: number) => {
    const percentage = (completed / total) * 100;
    setDeleteProgress(percentage);
  };

  useEffect(() => {
    const handleProjectUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail) {
        const { projectId } = customEvent.detail;
        queryClient.invalidateQueries({ queryKey: projectKeys.details(projectId) });
        queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      }
    };
    window.addEventListener('project-updated', handleProjectUpdate as EventListener);
    return () => window.removeEventListener('project-updated', handleProjectUpdate as EventListener);
  }, [queryClient]);

  useEffect(() => {
    setLoadingThreadId(null);
  }, [pathname]);

  useEffect(() => {
    const handleNavigationComplete = () => {
      document.body.style.pointerEvents = 'auto';
      isNavigatingRef.current = false;
    };
    window.addEventListener("popstate", handleNavigationComplete);
    return () => {
      window.removeEventListener('popstate', handleNavigationComplete);
      document.body.style.pointerEvents = "auto";
    };
  }, []);

  useEffect(() => {
    isNavigatingRef.current = false;
    document.body.style.pointerEvents = 'auto';
  }, [pathname]);

  const handleThreadClick = (e: React.MouseEvent<HTMLAnchorElement>, threadId: string, url: string) => {
    if (selectedThreads.has(threadId)) {
        e.preventDefault();
        return;
    }
    if (!e.metaKey) {
      setLoadingThreadId(threadId);
    }
    if (isMobile) {
      setOpenMobile(false);
    }
  }

  const toggleThreadSelection = (threadId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setSelectedThreads(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(threadId)) {
        newSelection.delete(threadId);
      } else {
        newSelection.add(threadId);
      }
      setIsMultiSelectMode(newSelection.size > 0);
      return newSelection;
    });
  };

  const handleDeleteThread = async (threadId: string, threadName: string) => {
    setThreadToDelete({ id: threadId, name: threadName });
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!threadToDelete || isPerformingActionRef.current) return;
    isPerformingActionRef.current = true;
    setIsDeleteDialogOpen(false);

    if (threadToDelete.id !== "multiple") {
      const threadId = threadToDelete.id;
      const isActive = pathname?.includes(threadId);
      const currentThread = currentThreads.find(t => t.thread_id === threadId);
      const sandboxId = currentThread?.project?.sandbox?.id;

      await performDelete(
        threadId,
        isActive,
        async () => {
          deleteThreadMutation(
            { threadId, sandboxId },
            {
              onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: threadKeys.lists() });
                toast.success('Conversation deleted successfully');
              },
              onSettled: () => {
                setThreadToDelete(null);
                isPerformingActionRef.current = false;
              }
            }
          );
        },
        () => {
          setThreadToDelete(null);
          isPerformingActionRef.current = false;
        },
      );
    } else {
      // Multi-delete logic
      const threadIdsToDelete = Array.from(selectedThreads);
      const isActiveThreadIncluded = threadIdsToDelete.some(id => pathname?.includes(id));
      toast.info(`Deleting ${threadIdsToDelete.length} conversations...`);

      try {
        if (isActiveThreadIncluded) {
          isNavigatingRef.current = true;
          document.body.style.pointerEvents = 'none';
          router.push('/dashboard');
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        deleteMultipleThreadsMutation(
          {
            threadIds: threadIdsToDelete,
            threadSandboxMap: Object.fromEntries(
              threadIdsToDelete.map(id => {
                const ct = currentThreads.find(t => t.thread_id === id);
                return [id, ct?.project?.sandbox?.id || ''];
              }).filter(([, sid]) => sid)
            ),
            onProgress: handleDeletionProgress
          },
          {
            onSuccess: (data) => {
              queryClient.invalidateQueries({ queryKey: threadKeys.lists() });
              toast.success(`Successfully deleted ${data.successful.length} conversations`);
              setSelectedThreads(new Set());
              setIsMultiSelectMode(false);
            },
            onSettled: () => {
              setThreadToDelete(null);
              isPerformingActionRef.current = false;
              setDeleteProgress(0);
              setTotalToDelete(0);
            }
          }
        );
      } catch (err) {
        console.error(err);
        isPerformingActionRef.current = false;
      }
    }
  };

  const isInitialLoading = (isThreadsLoading) && combinedThreads.length === 0;

  return (
    <>
      <SidebarMenu 
        className="overflow-y-auto max-h-[calc(100vh-280px)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] pb-16" 
        ref={scrollContainerRef}
      >
        {(state !== 'collapsed' || isMobile) && (
          <>
            {isInitialLoading ? (
              <div className="space-y-1">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={`skeleton-${index}`} className="flex items-center gap-3 px-2 py-2">
                    <div className="h-[36px] w-[36px] bg-muted/10 border-[1.5px] border-border rounded-[10px] animate-pulse"></div>
                    <div className="h-4 bg-muted rounded flex-1 animate-pulse"></div>
                    <div className="h-3 w-8 bg-muted rounded animate-pulse"></div>
                  </div>
                ))}
              </div>
            ) : combinedThreads.length > 0 ? (
              <>
                {Object.entries(groupedThreads).map(([dateGroup, threadsInGroup]) => (
                  <div key={dateGroup} className="space-y-1">
                    {threadsInGroup.map((thread) => {
                      const isActive = pathname?.includes(thread.threadId) || false;
                      const isSelected = selectedThreads.has(thread.threadId);
                      const isAgentRunning = agentStatusMap.get(thread.threadId) || false;

                      return (
                        <ThreadItem
                          key={`thread-${thread.threadId}`}
                          thread={thread}
                          isActive={isActive}
                          isThreadLoading={loadingThreadId === thread.threadId}
                          isSelected={isSelected}
                          selectedThreads={selectedThreads}
                          loadingThreadId={loadingThreadId}
                          pathname={pathname}
                          isMobile={isMobile}
                          isAgentRunning={isAgentRunning}
                          isMultiSelectMode={isMultiSelectMode}
                          handleThreadClick={handleThreadClick}
                          toggleThreadSelection={toggleThreadSelection}
                          handleDeleteThread={handleDeleteThread}
                          setSelectedItem={setSelectedItem}
                          setShowShareModal={setShowShareModal}
                        />
                      );
                    })}
                  </div>
                ))}

                {pagination && totalPages > 1 && (
                  <div className="px-2 py-2">
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={handlePreviousPage}
                        disabled={!canGoPrevious || isThreadsFetching}
                        className={cn("p-1.5 text-xs transition-opacity", canGoPrevious && !isThreadsFetching ? "text-muted-foreground hover:text-foreground opacity-70 hover:opacity-100" : "text-muted-foreground/30 cursor-not-allowed")}
                      >
                        <ChevronLeft className="size-[18px]" strokeWidth={2} />
                      </button>
                      <span className="text-xs text-muted-foreground/70 flex items-center gap-1">
                        {isThreadsFetching && <Loader2 className="h-3 w-3 animate-spin" />}
                        {currentPage}/{totalPages}
                      </span>
                      <button
                        onClick={handleNextPage}
                        disabled={!canGoNext || isThreadsFetching}
                        className={cn("p-1.5 text-xs transition-opacity", canGoNext && !isThreadsFetching ? "text-muted-foreground hover:text-foreground opacity-70 hover:opacity-100" : "text-muted-foreground/30 cursor-not-allowed")}
                      >
                        <ChevronRight className="size-[18px]" strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="py-2 pl-2.5 text-sm text-muted-foreground">
                {t('noConversations')}
              </div>
            )}
          </>
        )}
      </SidebarMenu>

      {(isDeletingSingle || isDeletingMultiple) && totalToDelete > 0 && (
        <div className="mt-2 px-2">
          <div className="text-xs text-muted-foreground mb-1">
            Deleting {deleteProgress > 0 ? `(${Math.floor(deleteProgress)}%)` : '...'}
          </div>
          <div className="w-full bg-secondary h-1 rounded-full overflow-hidden">
            <div className="bg-primary h-1 transition-all duration-300 ease-in-out" style={{ width: `${deleteProgress}%` }} />
          </div>
        </div>
      )}

      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        threadId={selectedItem?.threadId}
        projectId={selectedItem?.projectId}
      />

      {threadToDelete && (
        <DeleteConfirmationDialog
          isOpen={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
          onConfirm={confirmDelete}
          threadName={threadToDelete.name}
          isDeleting={isDeletingSingle || isDeletingMultiple}
        />
      )}
    </>
  );
}