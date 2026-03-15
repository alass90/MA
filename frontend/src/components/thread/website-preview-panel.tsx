'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import {
  Eye,
  Code2,
  FolderOpen,
  Database,
  Settings,
  Github,
  Share2,
  Upload,
  Monitor,
  Smartphone,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  FileText,
  Check,
  Download,
  History,
  Sun,
  Moon,
  Maximize2,
  Minimize2,
  Globe,
  FileCode,
  Layout,
  Terminal,
  Search,
  MessageSquare,
  ChevronDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDirectoryQuery, useFileContentQuery } from '@/hooks/files/use-file-queries';
import { useProjectExport } from '@/hooks/files/use-project-export';
import { FileInfo } from '@/lib/api/sandbox';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════
// TYPES & THEMES
// ═══════════════════════════════════════════════════════════════

interface WebsitePreviewPanelProps {
  isOpen: boolean;
  onClose: () => void;
  previewUrl?: string;
  projectPath?: string;
  framework?: string;
  deploymentId?: string;
  projectName?: string;
  databaseUrl?: string;
  databaseProvider?: string;
  threadId?: string;
  projectId?: string;
  onPublish?: () => Promise<void>;
  onEdit?: () => void;
  agentStatus?: string;
  project?: any;
  toolCalls?: any[];
}

// ═══════════════════════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════════════════════

const ProjectFileTree: React.FC<{
  items: FileInfo[];
  depth?: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  sandboxId?: string;
}> = ({ items, depth = 0, selectedPath, onSelect, sandboxId }) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const sortedItems = [...items].sort((a, b) => {
    if (a.is_dir === b.is_dir) return a.name.localeCompare(b.name);
    return a.is_dir ? -1 : 1;
  });

  return (
    <div className="flex flex-col">
      {sortedItems.map((item) => {
        const isActive = selectedPath === item.path;
        return (
          <div key={item.path}>
            <div
              onClick={() => {
                if (item.is_dir) {
                  setExpanded((p) => ({ ...p, [item.path]: !p[item.path] }));
                } else {
                  onSelect(item.path);
                }
              }}
              className={cn(
                "group flex items-center gap-2 px-4 py-1.5 cursor-pointer text-sm transition-colors",
                isActive ? "bg-accent/10 border-l-2 border-primary text-primary" : "text-muted-foreground hover:bg-accent/5 hover:text-foreground border-l-2 border-transparent"
              )}
              style={{ paddingLeft: `${16 + depth * 16}px` }}
            >
              {item.is_dir ? (
                <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", expanded[item.path] && "rotate-90")} />
              ) : (
                <div className="w-3.5" />
              )}
              {item.is_dir ? (
                <FolderOpen className="w-4 h-4 text-amber-500/80" />
              ) : (
                <FileCode className="w-4 h-4 text-blue-500/80" />
              )}
              <span className="truncate font-medium">{item.name}</span>
            </div>
            {item.is_dir && expanded[item.path] && (
              <SubdirTree 
                path={item.path} 
                depth={depth + 1} 
                selectedPath={selectedPath} 
                onSelect={onSelect} 
                sandboxId={sandboxId}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

const SubdirTree: React.FC<{ 
  path: string; 
  depth: number; 
  selectedPath: string | null; 
  onSelect: (path: string) => void;
  sandboxId?: string;
}> = ({ path, depth, selectedPath, onSelect, sandboxId }) => {
  const { data: items, isLoading } = useDirectoryQuery(sandboxId, path);
  if (isLoading || !items) return null;
  return <ProjectFileTree items={items} depth={depth} selectedPath={selectedPath} onSelect={onSelect} sandboxId={sandboxId} />;
};

const CodeViewer: React.FC<{ code: string; filename: string }> = ({ code, filename }) => {
  const lines = code.split('\n');
  return (
    <div className="h-full overflow-hidden flex flex-col bg-[#0d0d0d]">
      <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between bg-black/20">
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <FileText className="w-3.5 h-3.5" />
          <span>{filename}</span>
        </div>
      </div>
      <div className="flex-1 overflow-auto custom-scrollbar">
        <pre className="p-4 font-mono text-[13px] leading-relaxed select-text">
          {lines.map((line, i) => (
            <div key={i} className="flex group">
              <span className="w-10 text-right pr-4 text-white/20 select-none">{i + 1}</span>
              <code className="text-white/80">{line || '\u00A0'}</code>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export const WebsitePreviewPanel: React.FC<WebsitePreviewPanelProps> = ({
  isOpen,
  onClose,
  previewUrl,
  projectPath,
  framework,
  projectName,
  threadId,
  projectId,
  onPublish,
  onEdit,
  agentStatus,
  project,
  toolCalls,
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'console' | 'db' | 'files' | 'settings'>('preview');
  const previewRef = useRef<HTMLDivElement>(null);
  const [isCopied, setIsCopied] = useState(false);
  const { theme: globalTheme, setTheme } = useTheme();
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(projectPath || null);

  // Sync mode with global theme
  const mode = (globalTheme === 'dark' || globalTheme === 'system') ? 'dark' : 'light';

  const handleRefresh = useCallback(() => {
    setIframeKey(prev => prev + 1);
  }, []);

  const handleOpenExternal = useCallback(() => {
    if (previewUrl) {
      window.open(previewUrl, '_blank');
    }
  }, [previewUrl]);

  const handleShare = useCallback(() => {
    if (previewUrl) {
      navigator.clipboard.writeText(previewUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  }, [previewUrl]);

  const handleFullscreen = useCallback(() => {
    if (!previewRef.current) return;
    if (!document.fullscreenElement) {
      previewRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const terminalLogs = useMemo(() => {
    if (!toolCalls) return [];
    
    return toolCalls
      .filter((tc: any) => {
        const name = tc.toolCall?.function_name?.toLowerCase() || '';
        return name.includes('command') || 
               name.includes('bash') || 
               name.includes('sh') || 
               name.includes('terminal') ||
               name.includes('npm');
      })
      .map((tc: any) => {
        const args = tc.toolCall?.arguments || {};
        const command = args.command || args.code || args.script || 'Executing...';
        const output = tc.toolResult?.output || '';
        const isError = tc.toolResult?.success === false;
        const timestamp = tc.toolTimestamp || tc.assistantTimestamp;
        
        return {
          command,
          output,
          isError,
          timestamp: timestamp ? new Date(timestamp).toLocaleTimeString() : '',
        };
      });
  }, [toolCalls]);

  const sandboxId = threadId;

  const { data: rootFiles, isLoading: isLoadingFiles } = useDirectoryQuery(
    isOpen ? sandboxId : undefined,
    ''
  );

  const { data: fileContent, isLoading: isLoadingContent } = useFileContentQuery(
    isOpen && selectedFilePath ? sandboxId : undefined,
    selectedFilePath || undefined
  );

  const { exportAsZip, isExporting } = useProjectExport(sandboxId || undefined);

  const handleDownloadZip = useCallback(() => {
    exportAsZip(projectName || 'talos-project');
  }, [exportAsZip, projectName]);

  const handlePublish = async () => {
    if (!onPublish || isPublishing) return;
    setIsPublishing(true);
    try {
      await onPublish();
      setIsPublished(true);
      setTimeout(() => setIsPublished(false), 3000);
    } catch (error) {
      console.error('Publish failed:', error);
    } finally {
      setIsPublishing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={cn(
      "w-full h-screen flex flex-col transition-all duration-300 ease-in-out border-l border-border/50",
      mode === 'dark' ? "bg-[#0A0A0A] text-white" : "bg-white text-slate-900"
    )}>
      {/* ── MANUS TOP BAR ─────────────────────────────────────── */}
      <div className="h-12 border-b border-border/40 flex items-center justify-between px-4 z-10">
        <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md p-1 rounded-xl border border-white/5">
          {[
            { id: 'preview', icon: Eye, label: 'Preview' },
            { id: 'code', icon: Code2, label: 'Code' },
            { id: 'console', icon: Terminal, label: 'Console' },
            { id: 'db', icon: Database, label: 'Database' },
            { id: 'files', icon: FolderOpen, label: 'Files' },
            { id: 'settings', icon: Settings, label: 'Settings' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all",
                activeTab === tab.id 
                  ? "text-white" 
                  : "text-white/40 hover:text-white/70"
              )}
            >
              {activeTab === tab.id && (
                <motion.div 
                  layoutId="active-tab"
                  className="absolute inset-0 bg-white/10 rounded-lg border border-white/10"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <tab.icon className="w-3.5 h-3.5 relative z-10" />
              <span className="relative z-10">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => project?.repo_url && window.open(project.repo_url, '_blank')}
            className={cn(
              "p-2 text-muted-foreground hover:text-foreground transition-colors",
              !project?.repo_url && "opacity-30 cursor-not-allowed"
            )}
            title={project?.repo_url ? "View on GitHub" : "No repository connected"}
          >
            <Github className="w-4 h-4" />
          </button>
          <button 
            onClick={handleShare}
            className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-all flex items-center gap-2 rounded-full border border-transparent hover:border-border"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{isCopied ? 'Copied' : 'Share'}</span>
          </button>
          <button
            onClick={handlePublish}
            disabled={isPublishing}
            className={cn(
              "px-4 py-1.5 text-xs font-bold rounded-full transition-all flex items-center gap-2 shadow-sm",
              isPublished 
                ? "bg-green-500 text-white" 
                : "bg-foreground text-background hover:opacity-90 active:scale-95"
            )}
          >
            {isPublished ? <Check className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
            <span>{isPublished ? 'Published' : isPublishing ? 'Publishing...' : 'Publish'}</span>
          </button>
        </div>
      </div>

      {/* ── MANUS CONTROL BAR ─────────────────────────────────── */}
      <div className="h-11 border-b border-border/30 flex items-center justify-between px-4 bg-muted/10">
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setViewport('desktop')}
            className={cn("p-1.5 rounded-md transition-colors", viewport === 'desktop' ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50")}
          >
            <Monitor className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setViewport('mobile')}
            className={cn("p-1.5 rounded-md transition-colors", viewport === 'mobile' ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50")}
          >
            <Smartphone className="w-4 h-4" />
          </button>
        </div>

        {/* Centered Address Bar - Bolt inspired glassmorphism */}
        <div className="flex-1 max-w-xl mx-8">
          <div className="relative group">
            <div className="h-7 w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-full flex items-center px-4 gap-3 text-[11px] text-white/50 transition-all group-hover:bg-white/10 group-hover:border-white/20">
              <div className="flex items-center gap-1.5 opacity-60">
                 <Globe className="w-3 h-3" />
                 <span className="text-[10px] font-bold tracking-tight uppercase opacity-40">https://</span>
              </div>
              <span className="flex-1 truncate select-all font-mono tracking-tight text-white/80">{projectName || 'project'}.talos.run{selectedFilePath ? `/${selectedFilePath}` : ''}</span>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={handleRefresh}
                  className="p-1 hover:text-white transition-all hover:bg-white/10 rounded-md"
                  title="Refresh Preview"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
                <div className="w-px h-3 bg-white/10" />
                <button 
                  onClick={handleOpenExternal}
                  className="p-1 hover:text-white transition-all hover:bg-white/10 rounded-md"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button 
            onClick={onEdit}
            className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-2 rounded-md hover:bg-muted/50 transition-all active:scale-95"
          >
            <Layout className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
          <button 
            onClick={handleDownloadZip}
            disabled={isExporting}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-md transition-colors disabled:opacity-50"
            title="Download Project"
          >
            <Download className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-border/40 mx-1" />
          <button 
            onClick={handleFullscreen}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-md transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ── CONTENT AREA ──────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Files Panel (Always slightly visible or switchable) */}
        {activeTab === 'files' && (
          <div className="w-64 border-r border-border/40 overflow-auto bg-muted/5 custom-scrollbar">
            <div className="p-3 border-b border-border/20 text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60">
              Project Files
            </div>
            {isLoadingFiles ? (
              <div className="p-4 flex flex-col gap-2">
                {[1,2,3,4,5].map(i => <div key={i} className="h-4 w-full bg-muted/40 animate-pulse rounded" />)}
              </div>
            ) : (
              <ProjectFileTree 
                items={rootFiles || []} 
                selectedPath={selectedFilePath} 
                onSelect={(path) => {
                  setSelectedFilePath(path);
                  setActiveTab('code');
                }} 
                sandboxId={sandboxId}
              />
            )}
          </div>
        )}

        {/* Main Workspace */}
        <div ref={previewRef} className="flex-1 flex flex-col bg-background/30 h-full relative overflow-hidden">
          {activeTab === 'preview' && (
            <div className={cn(
              "flex-1 flex items-center justify-center p-8 bg-[#111] overflow-auto transition-all",
              viewport === 'mobile' ? "px-10" : "p-0",
              isFullscreen && "p-0 bg-black"
            )}>
               <div className={cn(
                "bg-white shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] transition-all duration-700 overflow-hidden relative",
                viewport === 'mobile' 
                  ? "w-[320px] h-[640px] rounded-[3rem] border-[10px] border-[#1a1a1b] ring-1 ring-white/10" 
                  : (isFullscreen ? "w-full h-full rounded-none" : "w-full h-full rounded-xl border border-white/5")
              )}>
                {/* iPhone Notch for Mobile View */}
                {viewport === 'mobile' && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-[#1a1a1b] rounded-b-2xl z-20 flex items-center justify-center">
                    <div className="w-8 h-1 bg-white/10 rounded-full" />
                  </div>
                )}
                {previewUrl ? (
                  <iframe 
                    key={iframeKey}
                    src={previewUrl} 
                    className="w-full h-full border-none"
                    title="Preview"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-6 p-12 text-center bg-[#0a0a0a]">
                     <div className="relative">
                        <motion.div 
                          animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.3, 0.1] }}
                          transition={{ duration: 3, repeat: Infinity }}
                          className="w-40 h-40 bg-blue-500 rounded-full absolute -top-4 -left-4 blur-3xl opacity-20" 
                        />
                        <div className="w-32 h-32 bg-white/5 border border-white/10 backdrop-blur-3xl rounded-3xl flex items-center justify-center relative">
                           <Layout className="w-12 h-12 text-white/20" />
                        </div>
                     </div>
                     <div className="space-y-2 z-10">
                        <h3 className="text-xl font-bold text-white/90">Preview Engine Room</h3>
                        <p className="text-sm text-white/40 max-w-sm leading-relaxed">We are distilling your digital creation. It will manifest here in a heartbeat.</p>
                     </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'code' && (
            <div className="flex-1">
              {isLoadingContent ? (
                 <div className="h-full flex flex-col bg-[#0d0d0d] gap-4 p-6">
                    <div className="h-6 w-1/3 bg-white/5 animate-pulse rounded" />
                    <div className="h-full w-full bg-white/5 animate-pulse rounded" />
                 </div>
              ) : selectedFilePath && fileContent ? (
                <CodeViewer code={fileContent} filename={selectedFilePath} />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-4">
                   <div className="w-16 h-16 rounded-2xl border border-dashed border-border flex items-center justify-center">
                      <Code2 className="w-8 h-8 opacity-20" />
                   </div>
                   <div className="text-center">
                     <p className="text-sm font-medium">No file selected</p>
                     <p className="text-xs opacity-60 mt-1">Select a file from the explorer to view its source</p>
                   </div>
                   <button 
                    onClick={() => setActiveTab('files')}
                    className="mt-2 px-6 py-2 bg-foreground text-background rounded-full text-xs font-bold"
                   >
                     Browse Files
                   </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'console' && (
            <div className="flex-1 flex flex-col bg-[#050505] text-white font-mono text-[11px] overflow-auto custom-scrollbar">
               <div className="flex items-center gap-2 px-6 py-4 border-b border-white/5 sticky top-0 bg-[#050505] z-10">
                  <Terminal className="w-4 h-4 text-primary" />
                  <span className="font-bold text-white/40 uppercase tracking-[0.2em]">Deployment Stream</span>
                  <div className="ml-auto flex items-center gap-2">
                     <div className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        agentStatus === 'running' ? "bg-green-500 animate-pulse" : "bg-white/20"
                     )} />
                     <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">
                        {agentStatus === 'running' ? 'Active' : 'Idle'}
                     </span>
                  </div>
               </div>
               <div className="p-6 space-y-4">
                  {terminalLogs.length > 0 ? (
                    terminalLogs.map((log: any, i: number) => (
                      <div key={i} className="space-y-1.5">
                        <div className="flex items-center gap-2 text-white/30">
                          <span className="text-[9px] opacity-50">[{log.timestamp}]</span>
                          <span className="text-blue-400 font-bold">$ {log.command}</span>
                        </div>
                        {log.output && (
                          <div className={cn(
                            "pl-4 whitespace-pre-wrap leading-relaxed border-l border-white/5 ml-1.5",
                            log.isError ? "text-red-400" : "text-white/60"
                          )}>
                            {log.output}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center pt-24 space-y-4 opacity-20">
                       <Terminal className="w-12 h-12" />
                       <p className="text-xs font-bold uppercase tracking-widest">No terminal output observed</p>
                    </div>
                  )}
                  {agentStatus === 'running' && (
                    <div className="flex items-center gap-2 text-primary animate-pulse italic">
                       <span>_</span>
                    </div>
                  )}
               </div>
            </div>
          )}

          {activeTab === 'db' && (
            <div className="flex-1 p-8 bg-black/40 backdrop-blur-sm overflow-auto custom-scrollbar">
               <div className="max-w-2xl mx-auto space-y-8">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
                        <Database className="w-6 h-6 text-blue-500" />
                     </div>
                     <div>
                        <h2 className="text-xl font-bold">Database Hub</h2>
                        <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Resource Management</p>
                     </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                     <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                        <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Connection Info</div>
                        <div className="space-y-3">
                           <div>
                              <div className="text-xs text-white/50 mb-1">Provider</div>
                              <div className="px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 text-xs font-mono">SQLite (Internal)</div>
                           </div>
                           <div>
                              <div className="text-xs text-white/50 mb-1">Status</div>
                              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/5 text-green-500 rounded-lg border border-green-500/10 text-xs font-bold">
                                 <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                 CONNECTED
                              </div>
                           </div>
                        </div>
                     </div>
                     <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                        <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Active Tables</div>
                        <div className="space-y-2">
                           {['users', 'posts', 'comments', 'settings'].map(table => (
                              <div key={table} className="flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-0">
                                 <span className="font-mono text-white/60">{table}</span>
                                 <span className="text-[10px] opacity-30">AUTO</span>
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="flex-1 p-12 bg-black/20 overflow-auto custom-scrollbar">
               <div className="max-w-xl mx-auto space-y-12">
                  <div className="space-y-6">
                     <div className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] border-b border-white/10 pb-3">Project Architecture</div>
                     <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                        <div className="space-y-1">
                           <div className="text-xs text-white/40">Framework</div>
                           <div className="text-sm font-bold">{framework || 'Detecting...'}</div>
                        </div>
                        <div className="space-y-1">
                           <div className="text-xs text-white/40">Environment</div>
                           <div className="text-sm font-bold">Standard Sandbox</div>
                        </div>
                        <div className="space-y-1">
                           <div className="text-xs text-white/40">Deployment</div>
                           <div className="text-sm font-bold text-blue-400">talos-preview-1.run</div>
                        </div>
                        <div className="space-y-1">
                           <div className="text-xs text-white/40">Node Version</div>
                           <div className="text-sm font-bold font-mono text-white/60">v20.11.0</div>
                        </div>
                     </div>
                  </div>
                  
                  <div className="pt-6 border-t border-white/5">
                     <button className="w-full py-3 bg-white text-black rounded-xl font-bold text-xs hover:bg-white/90 transition-all active:scale-95 shadow-xl">
                        Open Project Settings
                     </button>
                  </div>
               </div>
            </div>
          )}
        </div>
      </div>

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <div className="h-8 border-t border-border/20 flex items-center justify-between px-4 text-[10px] font-medium text-muted-foreground bg-muted/5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span>Sandbox ID: {sandboxId?.slice(0, 8) || 'local'}</span>
          </div>
          {framework && (
             <div className="flex items-center gap-1.5">
                <div className="px-1.5 py-0.5 bg-muted rounded">
                  {framework}
                </div>
             </div>
          )}
        </div>
        <div className="flex items-center gap-3">
            {project?.repo_url && (
              <a
                href={project.repo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors group relative"
                title="View on GitHub"
              >
                <Github className="w-4 h-4 text-white/40 group-hover:text-white" />
              </a>
            )}
           <span className="opacity-40">Made with Talos</span>
        </div>
      </div>
    </div>
  );
};
