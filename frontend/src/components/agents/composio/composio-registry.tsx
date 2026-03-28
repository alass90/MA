import React, { useState, useMemo, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Search, X, Settings, Loader2, Server, Lock, ChevronDown, CheckCircle2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useComposioCategories, useComposioToolkitsInfinite } from '@/hooks/composio/use-composio';
import { useComposioProfiles } from '@/hooks/composio/use-composio-profiles';
import { useAgent } from '@/hooks/agents/use-agents';
import { useUpdateAgentMCPs } from '@/hooks/agents/use-update-agent-mcps';
import { ComposioConnector } from './composio-connector';
import { ComposioToolsManager } from './composio-tools-manager';
import type { ComposioToolkit, ComposioProfile } from '@/hooks/composio/utils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { CustomMCPDialog } from '../mcp/custom-mcp-dialog';

const CATEGORY_EMOJIS: Record<string, string> = {
  'popular': '🔥',
  'productivity': '📊',
  'crm': '👥',
  'marketing': '📢',
  'analytics': '📈',
  'communication': '💬',
  'project-management': '📋',
  'scheduling': '📅',
};

interface ConnectedApp {
  toolkit: ComposioToolkit;
  profile: ComposioProfile;
  mcpConfig: {
    name: string;
    type: string;
    config: Record<string, any>;
    enabledTools: string[];
  };
}

interface ComposioRegistryProps {
  onToolsSelected?: (profileId: string, selectedTools: string[], appName: string, appSlug: string) => void;
  onAppSelected?: (app: ComposioToolkit) => void;
  mode?: 'full' | 'profile-only';
  onClose?: () => void;
  showAgentSelector?: boolean;
  selectedAgentId?: string;
  onAgentChange?: (agentId: string | undefined) => void;
  initialSelectedApp?: string | null;
  isBlocked?: boolean;
  onBlockedClick?: () => void;
}

const getAgentConnectedApps = (
  agent: any,
  profiles: ComposioProfile[],
  toolkits: ComposioToolkit[]
): ConnectedApp[] => {
  if (!agent?.custom_mcps || !profiles?.length || !toolkits?.length) return [];

  const connectedApps: ConnectedApp[] = [];

  agent.custom_mcps.forEach((mcpConfig: any) => {
    if (mcpConfig.config?.profile_id) {
      const profile = profiles.find(p => p.profile_id === mcpConfig.config.profile_id);
      const toolkit = toolkits.find(t => t.slug === profile?.toolkit_slug);
      if (profile && toolkit) {
        connectedApps.push({
          toolkit,
          profile,
          mcpConfig
        });
      }
    }
  });

  return connectedApps;
};

const isAppConnectedToAgent = (
  agent: any,
  appSlug: string,
  profiles: ComposioProfile[]
): boolean => {
  if (!agent?.custom_mcps) return false;

  return agent.custom_mcps.some((mcpConfig: any) => {
    if (mcpConfig.config?.profile_id) {
      const profile = profiles.find(p => p.profile_id === mcpConfig.config.profile_id);
      return profile?.toolkit_slug === appSlug;
    }
    return false;
  });
};

const AppCardSkeleton = () => (
  <div className="border border-border/50 rounded-xl p-4">
    <div className="flex items-center gap-3 mb-3">
      <Skeleton className="w-10 h-10 rounded-lg" />
      <div className="flex-1">
        <Skeleton className="w-3/4 h-4 mb-2" />
        <Skeleton className="w-full h-3" />
      </div>
    </div>
    <div className="flex flex-wrap gap-1 mb-3">
      <Skeleton className="w-16 h-5" />
      <Skeleton className="w-20 h-5" />
    </div>
    <div className="flex justify-between items-center">
      <Skeleton className="w-24 h-6" />
      <Skeleton className="w-20 h-8" />
    </div>
  </div>
);

const ConnectedAppSkeleton = () => (
  <div className="border border-border/50 rounded-2xl p-4">
    <div className="flex items-start gap-3 mb-3">
      <Skeleton className="w-10 h-10 rounded-lg" />
      <div className="flex-1">
        <Skeleton className="w-3/4 h-4 mb-2" />
        <Skeleton className="w-full h-3" />
      </div>
      <Skeleton className="w-8 h-8 rounded" />
    </div>
    <div className="flex justify-between items-center">
      <Skeleton className="w-32 h-4" />
    </div>
  </div>
);

const ConnectedAppCard = ({
  connectedApp,
  onToggleTools,
  onConfigure,
  onManageTools,
  isUpdating
}: {
  connectedApp: ConnectedApp;
  onToggleTools: (profileId: string, enabled: boolean) => void;
  onConfigure: (app: ComposioToolkit, profile: ComposioProfile) => void;
  onManageTools: (connectedApp: ConnectedApp) => void;
  isUpdating: boolean;
}) => {
  const { toolkit, profile, mcpConfig } = connectedApp;
  const hasEnabledTools = mcpConfig.enabledTools && mcpConfig.enabledTools.length > 0;

  return (
    <Card
      className="p-5 flex flex-col transition-all duration-300 gap-3 relative border-border/40 shadow-sm hover:shadow-md hover:border-primary/20 group"
      onClick={() => onManageTools(connectedApp)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="w-[48px] h-[48px] rounded-2xl border border-border/50 bg-background flex items-center justify-center relative shadow-sm overflow-hidden group-hover:scale-105 transition-transform">
          {toolkit.logo ? (
            <img src={toolkit.logo} alt={toolkit.name} className="w-6 h-6 object-contain" />
          ) : (
            <div className="w-full h-full bg-primary/5 flex items-center justify-center">
              <span className="text-primary text-lg font-bold">{toolkit.name.charAt(0)}</span>
            </div>
          )}
        </div>
        <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20 border-none px-2 py-0.5 text-[10px] font-bold uppercase rounded-md flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Connected
        </Badge>
      </div>

      <div className="space-y-1">
        <h3 className="font-bold text-base leading-tight text-foreground">{toolkit.name}</h3>
        <div className="flex gap-2">
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-medium bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 border-none rounded-md">
            {toolkit.categories?.[0] || 'App'}
          </Badge>
          <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-medium border-border/40 text-muted-foreground rounded-md">
            {profile.profile_name}
          </Badge>
        </div>
      </div>

      <p className="text-xs text-muted-foreground flex-1 line-clamp-2 leading-relaxed mb-4">
        {hasEnabledTools ? `${mcpConfig.enabledTools.length} tools currently enabled for your tasks.` : 'Connected to your workspace. Enable tools to start using it.'}
      </p>

      <div className="flex gap-2 mt-auto">
        <Button
          variant="default"
          size="sm"
          className="flex-1 h-9 rounded-lg font-bold text-xs shadow-sm"
          onClick={(e) => {
            e.stopPropagation();
            onManageTools(connectedApp);
          }}
          disabled={isUpdating}
        >
          Manage Tools
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9 px-3 rounded-lg border-border/40"
          onClick={(e) => {
            e.stopPropagation();
            onConfigure(toolkit, profile);
          }}
          disabled={isUpdating}
        >
          <Settings className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
    </Card>
  );
};

const AppCard = ({ app, profiles, onConnect, onConfigure, isConnectedToAgent, currentAgentId, mode, isBlocked, onBlockedClick }: {
  app: ComposioToolkit;
  profiles: ComposioProfile[];
  onConnect: () => void;
  onConfigure: (profile: ComposioProfile) => void;
  isConnectedToAgent: boolean;
  currentAgentId?: string;
  mode?: 'full' | 'profile-only';
  isBlocked?: boolean;
  onBlockedClick?: () => void;
}) => {
  const connectedProfiles = profiles.filter(p => p.is_connected);
  const canConnect = mode === 'profile-only' ? true : (!isConnectedToAgent && currentAgentId);

  const getStatusInfo = () => {
    if (isBlocked) {
      return { text: 'Upgrade', color: 'text-primary', showLock: true };
    }
    if (isConnectedToAgent) {
      return { text: 'Connected', color: 'text-blue-600 dark:text-blue-400', showCheck: true };
    }
    return null;
  };

  const status = getStatusInfo();

  const handleClick = () => {
    if (isBlocked && onBlockedClick) {
      onBlockedClick();
      return;
    }
    if (!canConnect) return;
    if (connectedProfiles.length > 0) {
      onConfigure(connectedProfiles[0]);
    } else {
      onConnect();
    }
  };

  return (
    <Card
      className={cn(
        "p-5 flex flex-col transition-all duration-300 gap-3 relative border-border/40 shadow-sm",
        isBlocked ? "hover:bg-muted cursor-pointer hover:border-primary/40" : (canConnect ? "hover:bg-muted/50 cursor-pointer hover:border-primary/30" : "opacity-60 cursor-not-allowed")
      )}
      onClick={handleClick}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="w-[48px] h-[48px] rounded-2xl border border-border/50 bg-background flex items-center justify-center relative shadow-sm overflow-hidden group-hover:scale-105 transition-transform">
          {app.logo ? (
            <img src={app.logo} alt={app.name} className="w-6 h-6 object-contain" />
          ) : (
            <span className="text-foreground text-lg font-bold">{app.name.charAt(0)}</span>
          )}
        </div>
        {status && (
          <div className={cn("text-[10px] font-bold uppercase tracking-wider flex items-center gap-1", status.color)}>
            {status.showCheck && <CheckCircle2 className="w-3 h-3" />}
            {status.showLock && <Lock className="w-3 h-3" />}
            {status.text}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <h3 className="font-bold text-base leading-tight text-foreground">{app.name}</h3>
        {/* Category Badge below Title as per screenshot */}
        <div className="flex">
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-medium bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 border-none rounded-md">
            {app.categories?.[0] || 'App'}
          </Badge>
        </div>
      </div>

      <p className="text-xs text-muted-foreground flex-1 line-clamp-2 leading-relaxed mb-4">
        {app.description || `Builds user interfaces and interactive web pages with seamless connectivity.`}
      </p>

      <Button
        variant={status?.text === 'Connected' ? "outline" : "default"}
        size="sm"
        className={cn(
          "w-full h-9 rounded-lg font-bold text-xs transition-all",
          isBlocked ? "border-primary text-primary hover:bg-primary hover:text-white" : ""
        )}
        disabled={!canConnect && !isBlocked}
      >
        {isBlocked ? (
          <>
            <Lock className="h-3.5 w-3.5 mr-2" />
            Upgrade
          </>
        ) : status?.text === 'Connected' ? (
          "Settings"
        ) : (
          <>
            <span className="text-lg font-light mr-1.5">+</span> Add App
          </>
        )}
      </Button>
    </Card>
  );
};

export const ComposioRegistry: React.FC<ComposioRegistryProps> = ({
  onToolsSelected,
  onAppSelected,
  mode = 'full',
  onClose,
  showAgentSelector = false,
  selectedAgentId,
  onAgentChange,
  initialSelectedApp,
  isBlocked = false,
  onBlockedClick,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedApp, setSelectedApp] = useState<ComposioToolkit | null>(null);
  const [showConnector, setShowConnector] = useState(false);
  const [showConnectedApps, setShowConnectedApps] = useState(true);
  const [showToolsManager, setShowToolsManager] = useState(false);
  const [selectedConnectedApp, setSelectedConnectedApp] = useState<ConnectedApp | null>(null);
  const [showCustomMCPDialog, setShowCustomMCPDialog] = useState(false);

  const [internalSelectedAgentId, setInternalSelectedAgentId] = useState<string | undefined>(selectedAgentId);
  const queryClient = useQueryClient();

  const { data: categoriesData, isLoading: isLoadingCategories } = useComposioCategories();
  const {
    data: toolkitsInfiniteData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isError
  } = useComposioToolkitsInfinite(search, selectedCategory);
  const { data: profiles, isLoading: isLoadingProfiles } = useComposioProfiles();

  const allToolkits = useMemo(() => {
    if (!toolkitsInfiniteData?.pages) return [];
    return toolkitsInfiniteData.pages.flatMap(page => page.toolkits || []);
  }, [toolkitsInfiniteData]);

  const currentAgentId = selectedAgentId ?? internalSelectedAgentId;
  const { data: agent, isLoading: isLoadingAgent } = useAgent(currentAgentId || '');
  const { mutate: updateAgent, isPending: isUpdatingAgent } = useUpdateAgentMCPs(); // Use the MCP-specific hook

  const handleAgentSelect = (agentId: string | undefined) => {
    if (onAgentChange) {
      onAgentChange(agentId);
    } else {
      setInternalSelectedAgentId(agentId);
    }
  };

  const profilesByToolkit = useMemo(() => {
    const grouped: Record<string, ComposioProfile[]> = {};
    profiles?.forEach(profile => {
      if (profile.is_connected) {
        if (!grouped[profile.toolkit_slug]) {
          grouped[profile.toolkit_slug] = [];
        }
        grouped[profile.toolkit_slug].push(profile);
      }
    });
    return grouped;
  }, [profiles]);

  const connectedApps = useMemo(() => {
    if (!currentAgentId || !agent) return [];
    return getAgentConnectedApps(agent, profiles || [], allToolkits);
  }, [agent, profiles, allToolkits, currentAgentId]);

  const isLoadingConnectedApps = currentAgentId && (isLoadingAgent || isLoadingProfiles || isLoading);

  const filteredToolkits = useMemo(() => {
    if (!allToolkits) return [];
    return allToolkits;
  }, [allToolkits]);

  // Handle initial app selection
  useEffect(() => {
    if (initialSelectedApp && allToolkits.length > 0 && !selectedApp) {
      const appToSelect = allToolkits.find(
        toolkit => toolkit.slug?.toLowerCase() === initialSelectedApp.toLowerCase()
      );
      if (appToSelect) {
        setSelectedApp(appToSelect);
        setShowConnector(true);
        setShowConnectedApps(false);
      }
    }
  }, [initialSelectedApp, allToolkits, selectedApp]);

  const handleConnect = (app: ComposioToolkit) => {
    if (mode !== 'profile-only' && !currentAgentId && showAgentSelector) {
      toast.error('Please select an agent first');
      return;
    }
    setSelectedApp(app);
    setShowConnector(true);
  };

  const handleConfigure = (app: ComposioToolkit, profile: ComposioProfile) => {
    if (mode !== 'profile-only' && !currentAgentId) {
      toast.error('Please select an agent first');
      return;
    }
    setSelectedApp(app);
    setShowConnector(true);
  };

  const handleToggleTools = (profileId: string, enabled: boolean) => {
    if (!currentAgentId || !agent) return;

    const updatedCustomMcps = agent.custom_mcps?.map((mcpConfig: any) => {
      if (mcpConfig.config?.profile_id === profileId) {
        return {
          ...mcpConfig,
          enabledTools: enabled ? mcpConfig.enabledTools || [] : []
        };
      }
      return mcpConfig;
    }) || [];

    updateAgent({
      agentId: currentAgentId,
      custom_mcps: updatedCustomMcps
    }, {
      onSuccess: () => {
        toast.success(enabled ? 'Tools enabled' : 'Tools disabled');
      },
      onError: (error: any) => {
        toast.error(error.message || 'Failed to update tools');
      }
    });
  };

  const handleManageTools = (connectedApp: ConnectedApp) => {
    setSelectedConnectedApp(connectedApp);
    setShowToolsManager(true);
  };

  const handleConnectionComplete = (profileId: string, appName: string, appSlug: string) => {
    setShowConnector(false);
    queryClient.invalidateQueries({ queryKey: ['composio', 'profiles'] });

    if (currentAgentId) {
      queryClient.invalidateQueries({ queryKey: ['agents', 'detail', currentAgentId] });
    }

    if (onToolsSelected) {
      onToolsSelected(profileId, [], appName, appSlug);
    }
  };

  const handleCustomMCPSave = async (customConfig: any): Promise<void> => {
    if (!currentAgentId) {
      throw new Error('Please select an agent first');
    }

    // Create MCP configuration for agent
    const mcpConfig = {
      name: customConfig.name || 'Custom MCP',
      type: customConfig.type || 'sse',
      config: customConfig.config || {},
      enabledTools: customConfig.enabledTools || [],
    };

    // Get current custom MCPs from agent
    const currentCustomMcps = agent?.custom_mcps || [];
    const updatedCustomMcps = [...currentCustomMcps, mcpConfig];

    // Return a promise that resolves/rejects based on the mutation result
    return new Promise((resolve, reject) => {
      updateAgent({
        agentId: currentAgentId,
        custom_mcps: updatedCustomMcps,
        replace_mcps: true  // Use replace mode to ensure proper updates
      }, {
        onSuccess: () => {
          toast.success(`Custom MCP "${customConfig.name}" added successfully`);
          queryClient.invalidateQueries({ queryKey: ['agents', 'detail', currentAgentId] });
          resolve();
        },
        onError: (error: any) => {
          reject(new Error(error.message || 'Failed to add custom MCP'));
        }
      });
    });
  };

  const [activeTab, setActiveTab] = useState<'catalog' | 'installed'>('catalog');
  const categories = categoriesData?.categories || [];

  return (
    <div className="h-full w-full bg-background flex flex-col overflow-hidden">
      {/* Header with Title and Tabs */}
      <div className="flex-shrink-0 px-8 pt-8 pb-4">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Integrations</h2>
            <Badge className="bg-blue-600/10 text-blue-600 hover:bg-blue-600/20 border-none px-2 py-0.5 text-[10px] font-bold uppercase rounded-md">New</Badge>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search integrations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 border-border/40 bg-muted/20 rounded-xl"
              />
            </div>
            <Button variant="outline" className="h-10 gap-2 rounded-xl border-border/40 text-xs font-semibold px-4">
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
              Most Relevant
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="bg-transparent border-b rounded-none w-full justify-start h-auto p-0 gap-8">
            <TabsTrigger 
              value="catalog" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-4 text-sm font-semibold transition-all"
            >
              Catalog
            </TabsTrigger>
            <TabsTrigger 
              value="installed" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-4 text-sm font-semibold transition-all"
            >
              Installed Integrations
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {activeTab === 'catalog' ? (
          <div className="flex-1 min-h-0 flex flex-col">
            {/* Horizontal Filter Pills */}
            <div className="flex-shrink-0 px-8 py-4 flex items-center gap-2 overflow-x-auto no-scrollbar">
              <Button
                variant={selectedCategory === '' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedCategory('')}
                className={cn(
                  "rounded-full px-4 h-8 text-xs font-bold transition-all",
                  selectedCategory === '' ? "bg-zinc-900 text-white shadow-md" : "text-muted-foreground hover:bg-muted"
                )}
              >
                All
              </Button>
              {isLoadingCategories ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-20 rounded-full" />
                ))
              ) : (
                categories.map((category) => (
                  <Button
                    key={category.id}
                    variant={selectedCategory === category.id ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setSelectedCategory(category.id)}
                    className={cn(
                      "rounded-full px-4 h-8 text-xs font-bold transition-all whitespace-nowrap",
                      selectedCategory === category.id ? "bg-zinc-900 text-white shadow-md" : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {category.name}
                  </Button>
                ))
              )}
            </div>

            <ScrollArea className="flex-1 min-h-0 px-8 pb-8">
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <AppCardSkeleton key={i} />
                  ))}
                </div>
              ) : filteredToolkits.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-20 h-20 rounded-3xl bg-muted/30 flex items-center justify-center mb-6 border border-dashed border-border/50">
                    <Search className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-foreground">No integrations found</h3>
                  <p className="text-muted-foreground max-w-xs leading-relaxed">
                    {search ? `We couldn't find any results for "${search}". Try checking your spelling or using different keywords.` : 'This category seems empty right now.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredToolkits.map((app) => (
                      <AppCard
                        key={app.slug}
                        app={app}
                        profiles={profilesByToolkit[app.slug] || []}
                        onConnect={() => handleConnect(app)}
                        onConfigure={(profile) => handleConfigure(app, profile)}
                        isConnectedToAgent={isAppConnectedToAgent(agent, app.slug, profiles || [])}
                        currentAgentId={currentAgentId}
                        mode={mode}
                        isBlocked={isBlocked}
                        onBlockedClick={onBlockedClick}
                      />
                    ))}
                  </div>
                  {hasNextPage && (
                    <div className="flex justify-center pt-4">
                      <Button
                        variant="outline"
                        onClick={() => fetchNextPage()}
                        disabled={isFetchingNextPage}
                        className="rounded-xl border-border/40 px-8 h-10 font-bold text-xs"
                      >
                        {isFetchingNextPage ? (
                          <>
                            <Loader2 className="animate-spin h-3.5 w-3.5 mr-2" />
                            Loading...
                          </>
                        ) : (
                          'See More'
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col p-8 bg-muted/5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                Active Connections
              </h3>
              {mode !== 'profile-only' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCustomMCPDialog(true)}
                  className="rounded-xl border-border/40 h-9 font-bold text-xs px-4"
                >
                  <Server className="h-3.5 w-3.5 mr-2" />
                  Custom MCP
                </Button>
              )}
            </div>
            
            <ScrollArea className="flex-1 min-h-0">
              {isLoadingConnectedApps ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {Array.from({ length: 4 }).map((_, i) => <ConnectedAppSkeleton key={i} />)}
                </div>
              ) : connectedApps.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {connectedApps.map((connectedApp) => (
                    <ConnectedAppCard
                      key={connectedApp.profile.profile_id}
                      connectedApp={connectedApp}
                      onToggleTools={handleToggleTools}
                      onConfigure={handleConfigure}
                      onManageTools={handleManageTools}
                      isUpdating={isUpdatingAgent}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-border/30 rounded-3xl">
                  <div className="w-20 h-20 rounded-3xl bg-muted/20 flex items-center justify-center mb-6">
                    <Server className="h-10 w-10 text-muted-foreground/30" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">No integrations connected yet</h3>
                  <p className="text-muted-foreground max-w-xs mt-2 text-sm">
                    Start by browsing the catalog to connect your favorite tools and supercharge your AI.
                  </p>
                  <Button 
                    variant="link" 
                    onClick={() => setActiveTab('catalog')}
                    className="mt-4 font-bold text-blue-600"
                  >
                    Browse Catalog →
                  </Button>
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </div>
      {selectedApp && (
        <ComposioConnector
          app={selectedApp}
          agentId={currentAgentId}
          open={showConnector}
          onOpenChange={setShowConnector}
          onComplete={handleConnectionComplete}
          mode={mode}
        />
      )}

      {selectedConnectedApp && currentAgentId && (
        <ComposioToolsManager
          agentId={currentAgentId}
          open={showToolsManager}
          onOpenChange={setShowToolsManager}
          profileId={selectedConnectedApp.profile.profile_id}
          profileInfo={{
            profile_id: selectedConnectedApp.profile.profile_id,
            profile_name: selectedConnectedApp.profile.profile_name,
            toolkit_name: selectedConnectedApp.toolkit.name,
            toolkit_slug: selectedConnectedApp.toolkit.slug,
          }}
          appLogo={selectedConnectedApp.toolkit.logo}
          onToolsUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ['agents', 'detail', currentAgentId] });
          }}
        />
      )}
      <CustomMCPDialog
        open={showCustomMCPDialog}
        onOpenChange={setShowCustomMCPDialog}
        onSave={handleCustomMCPSave}
      />
    </div>
  );
}; 