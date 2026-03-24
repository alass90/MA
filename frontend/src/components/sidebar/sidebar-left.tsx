'use client';

import * as React from 'react';
import Link from 'next/link';
import { MessageCircle, Menu, Plus, PanelLeftOpen, PanelLeftClose, PanelLeft, Search, X, Library, Folder, FolderOpen, ChevronRight } from 'lucide-react';
import { NavAgents } from '@/components/sidebar/nav-agents';
import { NavUserWithTeams } from '@/components/sidebar/nav-user-with-teams';
import { KortixLogo } from '@/components/sidebar/kortix-logo';
import { siteConfig } from '@/lib/home';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuAction,
  useSidebar,
} from '@/components/ui/sidebar';
import { Switch } from '@/components/ui/switch';
import { useProjects } from '@/hooks/sidebar/use-sidebar';
import { NewAgentDialog } from '@/components/agents/new-agent-dialog';
import { ThreadSearchModal } from '@/components/sidebar/thread-search-modal';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/utils';
import { cn } from '@/lib/utils';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAdminRole } from '@/hooks/admin';
import posthog from 'posthog-js';
import { useDocumentModalStore } from '@/stores/use-document-modal-store';
import { isLocalMode } from '@/lib/config';
import { useAccountState, accountStateSelectors } from '@/hooks/billing';

import { getPlanIcon } from '@/components/billing/plan-utils';
import { Kbd } from '../ui/kbd';
import { useTranslations } from 'next-intl';
import { KbdGroup } from '../ui/kbd';
import { NotificationDropdown } from '../notifications/notification-dropdown';


function UserProfileSection({ user }: { user: any }) {
  const { data: accountState } = useAccountState({ enabled: true });
  const { state } = useSidebar();
  const isLocal = isLocalMode();
  const planName = accountStateSelectors.planName(accountState);

  // Return the enhanced user object with plan info for NavUserWithTeams
  const enhancedUser = {
    ...user,
    planName,
    planIcon: getPlanIcon(planName, isLocal)
  };

  return <NavUserWithTeams user={enhancedUser} />;
}

function FloatingMobileMenuButton() {
  const { setOpenMobile, openMobile, setOpen } = useSidebar();
  const isMobile = useIsMobile();

  if (!isMobile || openMobile) return null;

  return (
    <div className="fixed top-6 left-4 z-50">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={() => {
              setOpen(true);
              setOpenMobile(true);
            }}
            size="icon"
            className="h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all duration-200 hover:scale-105 active:scale-95 touch-manipulation"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Open menu
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function SidebarLeft({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const t = useTranslations('sidebar');
  const { state, setOpen, setOpenMobile } = useSidebar();
  const isMobile = useIsMobile();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [showEnterpriseCard, setShowEnterpriseCard] = useState(true);
  const [user, setUser] = useState<{
    name: string;
    email: string;
    avatar: string;
    isAdmin?: boolean;
  }>({
    name: 'Loading...',
    email: 'loading@example.com',
    avatar: '',
    isAdmin: false,
  });

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showNewAgentDialog, setShowNewAgentDialog] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const { isOpen: isDocumentModalOpen } = useDocumentModalStore();
  const { data: projects = [] } = useProjects();
  const [showAllProjects, setShowAllProjects] = useState(true);


  // Logout handler
  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [pathname, searchParams, isMobile, setOpenMobile]);


  // Use React Query hook for admin role instead of direct fetch
  const { data: adminRoleData } = useAdminRole();
  const isAdmin = adminRoleData?.isAdmin ?? false;

  useEffect(() => {
    const fetchUserData = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUser({
          name:
            data.user.user_metadata?.name ||
            data.user.email?.split('@')[0] ||
            'User',
          email: data.user.email || '',
          avatar: data.user.user_metadata?.avatar_url || '', // User avatar (different from agent avatar)
          isAdmin: isAdmin, // Use React Query cached value
        });
      }
    };

    fetchUserData();
  }, [isAdmin]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isDocumentModalOpen) return;

      // CMD+B to toggle sidebar
      if ((event.metaKey || event.ctrlKey) && event.key === 'b') {
        event.preventDefault();
        setOpen(!state.startsWith('expanded'));
        window.dispatchEvent(
          new CustomEvent('sidebar-left-toggled', {
            detail: { expanded: !state.startsWith('expanded') },
          }),
        );
      }

      // CMD+K to open search modal
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setShowSearchModal(true);
      }

      // CMD+J to open new chat
      if ((event.metaKey || event.ctrlKey) && event.key === 'j') {
        event.preventDefault();
        posthog.capture('new_task_clicked', { source: 'keyboard_shortcut' });
        router.push('/dashboard');
        if (isMobile) {
          setOpenMobile(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, setOpen, isDocumentModalOpen, router, isMobile, setOpenMobile]);




  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border/50 bg-background [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']"
      {...props}
    >
      <SidebarHeader className={cn("px-6 pt-7 overflow-hidden group-data-[collapsible=icon]:px-[8px] group-data-[collapsible=icon]:py-[12px] group-data-[collapsible=icon]:h-[56px] group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:items-center")}>
        <div className={cn("flex h-[32px] items-center justify-between min-w-[200px] group-data-[collapsible=icon]:min-w-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:h-full")}>
          <div className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:size-[32px] group-data-[collapsible=icon]:mx-[2px]">
            {state === 'collapsed' ? (
              <div className="relative flex items-center justify-center w-full group/logo">
                <Link href="/dashboard" onClick={() => isMobile && setOpenMobile(false)}>
                  <KortixLogo size={24} className="flex-shrink-0 opacity-100 group-hover/logo:opacity-0 transition-opacity" />
                </Link>
                <Tooltip delayDuration={2000}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 absolute opacity-0 group-hover/logo:opacity-100 transition-opacity"
                      onClick={() => setOpen(true)}
                    >
                      <PanelLeftOpen className="size-[18px]" strokeWidth={2} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Expand sidebar (CMD+B)</TooltipContent>
                </Tooltip>
              </div>
            ) : (
              <div className="relative flex items-center justify-center w-fit">
                <Link href="/dashboard" onClick={() => isMobile && setOpenMobile(false)}>
                  <KortixLogo size={18} className="flex-shrink-0" />
                </Link>
              </div>
            )}

          </div>
          <div className="flex items-center gap-1 group-data-[collapsible=icon]:hidden">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                if (isMobile) {
                  setOpenMobile(false);
                } else {
                  setOpen(false);
                }
              }}
            >
              <PanelLeft className="size-[18px]" strokeWidth={2} />
            </Button>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="[&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                className="w-full justify-start gap-3 h-[36px] px-4 rounded-[10px] border border-border/50 hover:bg-muted/50 transition-colors group-data-[collapsible=icon]:!px-0 group-data-[collapsible=icon]:!justify-center"
                asChild
              >
                <Link
                  href="/dashboard"
                  className="flex items-center gap-3 group-data-[collapsible=icon]:gap-0"
                  onClick={() => {
                    posthog.capture('new_task_clicked');
                    if (isMobile) setOpenMobile(false);
                  }}
                >
                  <Plus className="size-[18px]" strokeWidth={1.5} />
                  <span className="text-[14px] group-data-[collapsible=icon]:hidden">{t('newChat')}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="-mt-2">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setShowSearchModal(true)}
                  className="hover:text-foreground h-10 px-4 group-data-[collapsible=icon]:!px-0 group-data-[collapsible=icon]:!justify-center"
                >
                  <Search className="size-[18px]" strokeWidth={2} />
                  <span className="text-[14px] group-data-[collapsible=icon]:hidden">Search</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton className="hover:text-foreground h-[36px] px-4 group-data-[collapsible=icon]:!px-0 group-data-[collapsible=icon]:!justify-center">
                  <FolderOpen className="size-[18px]" strokeWidth={2} />
                  <span className="text-[14px] group-data-[collapsible=icon]:hidden">Library</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="flex items-center justify-between pr-2">
            <span className="uppercase tracking-wider font-semibold text-[11px] text-muted-foreground/70 pl-2">Projects</span>
            <button 
              className="p-1 rounded-md hover:bg-muted/50 text-muted-foreground/70 transition-colors"
              onClick={() => {
                // Future: open new project dialog
                toast.info("Create new project");
              }}
            >
              <Plus className="size-[18px]" strokeWidth={2} />
            </button>
          </SidebarGroupLabel>
          <SidebarGroupContent className="mt-1">
            <SidebarMenu>
              {projects.slice(0, 5).map((project) => (
                <SidebarMenuItem key={project.id}>
                  <SidebarMenuButton
                    asChild
                    className="text-muted-foreground hover:text-foreground h-[36px] px-4 group"
                  >
                    <Link href={`/projects/${project.id}`}>
                      <Folder className="h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                      <span className="text-[14px]">{project.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-2 flex-1 overflow-hidden">
          <SidebarGroupLabel className="uppercase tracking-wider font-semibold text-[11px] text-muted-foreground/70 pl-2 mb-1">
            Chats
          </SidebarGroupLabel>
          <div className="px-1 overflow-hidden h-full">
            <NavAgents />
          </div>
        </SidebarGroup>
      </SidebarContent>

      {/* Enterprise Demo Card - Only show when expanded */}
      {/* {
        state !== 'collapsed' && showEnterpriseCard && (
          <div className="absolute bottom-[86px] left-6 right-6 z-10">
            <div className="rounded-2xl p-5 backdrop-blur-[12px] border-[1.5px] bg-gradient-to-br from-white/25 to-gray-300/25 dark:from-gray-600/25 dark:to-gray-800/25 border-gray-300/50 dark:border-gray-600/50">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4" />
                <span className="text-sm font-medium text-foreground">Enterprise Demo</span>

                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowEnterpriseCard(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Request custom AI Workers implementation
              </p>
              <KortixProcessModal>
                <Button size="sm" className="w-full text-xs h-8">
                  Learn More
                </Button>
              </KortixProcessModal>
            </div>
          </div>
        )
      } */}

      <div className={cn("pb-4", state === 'collapsed' ? "px-2 flex justify-center" : "px-6")}>
        <UserProfileSection user={user} />
      </div>
      <SidebarRail />
      <NewAgentDialog
        open={showNewAgentDialog}
        onOpenChange={setShowNewAgentDialog}
      />
      <ThreadSearchModal
        open={showSearchModal}
        onOpenChange={setShowSearchModal}
      />
    </Sidebar>
  );
}

// Export the floating button so it can be used in the layout
export { FloatingMobileMenuButton };
