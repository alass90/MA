'use client';

import { Button } from "@/components/ui/button"
import { 
  FolderOpen, 
  Upload, 
  Monitor, 
  Copy, 
  Check, 
  Package, 
  ChevronDown, 
  Pencil, 
  Trash2,
  Code2,
  Palette
} from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useState, useRef, KeyboardEvent } from "react"
import { Input } from "@/components/ui/input"
import { useUpdateProject, useDeleteProject } from "@/hooks/threads/use-project";
import { Skeleton } from "@/components/ui/skeleton"
import { useIsMobile } from "@/hooks/utils"
import { cn } from "@/lib/utils"
import { ShareModal } from "@/components/sidebar/share-modal"
import { useQueryClient } from "@tanstack/react-query";
import { projectKeys } from "@/hooks/threads/keys";
import { threadKeys } from "@/hooks/threads/keys";
import { useFullstackBuilderStore } from "@/stores/use-fullstack-builder-store";
import { useDesignerStore } from "@/stores/use-designer-store";
import { DeleteConfirmationDialog } from "./DeleteConfirmationDialog";

interface ThreadSiteHeaderProps {
  threadId?: string;
  projectId?: string;
  projectName: string;
  onViewFiles: () => void;
  onToggleSidePanel: () => void;
  onToggleDeliverables?: () => void;
  onProjectRenamed?: (newName: string) => void;
  isMobileView?: boolean;
  variant?: 'default' | 'shared';
}

export function SiteHeader({
  threadId,
  projectId,
  projectName,
  onViewFiles,
  onToggleSidePanel,
  onToggleDeliverables,
  onProjectRenamed,
  isMobileView,
  variant = 'default',
}: ThreadSiteHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(projectName)
  const inputRef = useRef<HTMLInputElement>(null)
  const isSharedVariant = variant === 'shared'
  const [showShareModal, setShowShareModal] = useState(false);
  const [showKnowledgeBase, setShowKnowledgeBase] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();
  const { isOpen: isFullstackOpen, openPanel: openFullstack, closePanel: closeFullstack } = useFullstackBuilderStore();
  const { isOpen: isDesignerOpen, togglePanel: toggleDesigner } = useDesignerStore();

  const toggleFullstack = () => {
    if (isFullstackOpen) {
      closeFullstack();
    } else {
      openFullstack();
    }
  };

  const isMobile = useIsMobile() || isMobileView
  const updateProjectMutation = useUpdateProject()
  const deleteProjectMutation = useDeleteProject()

  const openShareModal = () => {
    setShowShareModal(true)
  }

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("Share link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy link");
    }
  };

  const handleDeleteProject = async () => {
    if (!projectId) return;
    try {
      await deleteProjectMutation.mutateAsync({ projectId });
      router.push('/dashboard');
    } catch (error) {
      console.error('Failed to delete project:', error);
    } finally {
      setShowDeleteDialog(false);
    }
  };

  const startEditing = () => {
    setEditName(projectName);
    setIsEditing(true);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditName(projectName);
  };

  const saveNewName = async () => {
    if (editName.trim() === '') {
      setEditName(projectName);
      setIsEditing(false);
      return;
    }

    if (editName !== projectName) {
      try {
        if (!projectId) {
          toast.error('Cannot rename: Project ID is missing');
          setEditName(projectName);
          setIsEditing(false);
          return;
        }

        const updatedProject = await updateProjectMutation.mutateAsync({
          projectId,
          data: { name: editName }
        })
        if (updatedProject) {
          onProjectRenamed?.(editName);
          queryClient.invalidateQueries({ queryKey: threadKeys.project(projectId) });
        } else {
          throw new Error('Failed to update project');
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to rename project';
        console.error('Failed to rename project:', errorMessage);
        toast.error(errorMessage);
        setEditName(projectName);
      }
    }

    setIsEditing(false)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      saveNewName();
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  return (
    <>
      <header className={cn(
        "bg-background sticky top-0 flex h-14 shrink-0 items-center gap-2 z-20 w-full px-6 chat-header",
        isMobile && "px-4"
      )}>
        <div className="chat-header-content flex flex-1 items-center gap-2">
          {variant === 'shared' ? (
            <div className="flex items-center gap-2 max-w-[500px]">
              <h2 data-v-2b360a7a="" className="text-[14px] leading-[24px] font-normal text-[#1d1d1f] dark:text-[#f5f5f7] truncate font-['PingFang_SC','Microsoft_YaHei','SimHei',sans-serif]">
                {projectName}
              </h2>
              <span className="text-[10px] uppercase tracking-wider font-bold bg-[#8e8e93]/10 text-[#8e8e93] px-2 py-0.5 rounded-full shrink-0">
                Shared
              </span>
            </div>
          ) : isEditing ? (
            <Input
              ref={inputRef}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={saveNewName}
              className="h-8 w-auto min-w-[180px] text-[14px] leading-[24px] font-normal text-[#1d1d1f] dark:text-[#f5f5f7] bg-transparent border-none focus-visible:ring-0 p-0 font-['PingFang_SC','Microsoft_YaHei','SimHei',sans-serif]"
              maxLength={50}
            />
          ) : !projectName || projectName === 'Project' ? (
            <Skeleton className="h-5 w-32" />
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div
                  className={cn(
                    "flex items-center gap-1 cursor-pointer group hover:opacity-80 transition-opacity"
                  )}
                >
                  <h2 data-v-2b360a7a="" className="text-[14px] leading-[24px] font-normal text-[#1d1d1f] dark:text-[#f5f5f7] transition-colors truncate max-w-[400px] font-['PingFang_SC','Microsoft_YaHei','SimHei',sans-serif]">
                    {projectName}
                  </h2>
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="1em" 
                    height="1em" 
                    viewBox="0 0 1024 1024" 
                    className="menu-arrow ml-0.5 mt-0.5 text-[#1d1d1f] dark:text-[#f5f5f7] h-3 w-3 opacity-60 group-hover:opacity-100 transition-opacity fill-current"
                  >
                    <path d="M482.95936 717.33248a36.864 36.864 0 0 0 52.0192-0.08192l285.696-285.696a36.864 36.864 0 1 0-52.10112-52.10112l-259.72736 259.6864-261.69344-259.80928a36.864 36.864 0 1 0-51.93728 52.34688l287.744 285.65504z" />
                  </svg>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={startEditing} className="gap-2">
                  <Pencil className="h-4 w-4" />
                  <span>Edit Name</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setShowDeleteDialog(true)} 
                  className="gap-2 text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex items-center gap-1 pr-4">
          {/* Show all buttons on both mobile and desktop - responsive tooltips */}
          <TooltipProvider>
            {variant === 'shared' ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    onClick={copyShareLink}
                    className="h-9 px-3 cursor-pointer gap-2"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side={isMobile ? "bottom" : "bottom"}>
                  <p>Copy share link</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button
                variant="ghost"
                onClick={openShareModal}
                className="h-9 px-3 cursor-pointer gap-2"
              >
                <Upload className="h-4 w-4" />
                <span>Share</span>
              </Button>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onViewFiles()}
                  className="h-9 w-9 cursor-pointer"
                >
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side={isMobile ? "bottom" : "bottom"}>
                <p>View Files in Task</p>
              </TooltipContent>
            </Tooltip>            

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleDesigner}
                  className="h-9 w-9 cursor-pointer"
                >
                  <Palette className={cn("h-4 w-4", isDesignerOpen ? "text-purple-500" : "")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side={isMobile ? "bottom" : "bottom"}>
                <p>Toggle Designer Canvas</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleFullstack}
                  className="h-9 w-9 cursor-pointer"
                >
                  <Code2 className={cn("h-4 w-4", isFullstackOpen ? "text-primary" : "")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side={isMobile ? "bottom" : "bottom"}>
                <p>Toggle IDE Workspace</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleDeliverables}
                  className="h-9 w-9 cursor-pointer"
                >
                  <Package className={cn("h-4 w-4", onToggleDeliverables ? "text-primary" : "")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side={isMobile ? "bottom" : "bottom"}>
                <p>View Generated Files (Deliverables)</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleSidePanel}
                  className="h-9 w-9 cursor-pointer"
                >
                  <Monitor className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side={isMobile ? "bottom" : "bottom"}>
                <p>Toggle Computer Preview (CMD+I)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </header>
      {variant === 'default' && threadId && projectId && (
        <ShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          threadId={threadId}
          projectId={projectId}
        />
      )}
      <DeleteConfirmationDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDeleteProject}
        threadName={projectName}
        isDeleting={deleteProjectMutation.isPending}
      />
    </>
  )
}