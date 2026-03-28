import React, { useState, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { listSandboxFiles, getSandboxFileContent, FileInfo } from '@/lib/api/sandbox';
import { 
  Loader2, 
  Folder, 
  File as FileIcon, 
  Terminal, 
  RefreshCw, 
  ExternalLink, 
  Activity, 
  X, 
  Monitor, 
  Smartphone, 
  History, 
  Database, 
  Settings, 
  Github, 
  Share2, 
  Send as Publish, 
  MoreHorizontal, 
  Home, 
  Maximize2,
  Code2
} from 'lucide-react';
import { CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { GithubPushModal } from './GithubPushModal';
import { DatabaseViewer } from './DatabaseViewer';
import { useFullstackBuilderStore } from '@/stores/use-fullstack-builder-store';

const ShareIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 1024 1024" fill="currentColor" className={className}>
    <path d="M386.218667 247.850667c0-102.4 120.405333-157.397333 197.76-90.282667l304.426666 264.32a119.466667 119.466667 0 0 1 1.365334 179.285333l-304.469334 272.170667c-76.970667 68.778667-199.082667 14.122667-199.082666-89.088v-89.173333c-33.024 2.261333-59.306667 6.826667-83.2 15.36-30.592 10.88-61.866667 29.952-98.602667 67.712a76.8 76.8 0 0 1-131.84-53.504c0-98.645333 24.106667-190.976 83.712-261.888 55.253333-65.792 133.973333-104.789333 229.930667-117.845334V247.850667z m147.413333-32.256c-27.648-23.978667-70.613333-4.352-70.613333 32.256v126.208l-0.256 4.309333c-2.218667 21.504-20.437333 38.186667-42.410667 40.021333l-17.194667 1.706667c-173.994667 20.949333-253.824 136.405333-253.824 304.554667 86.997333-89.557333 163.925333-105.386667 270.933334-107.861334a42.026667 42.026667 0 0 1 42.752 42.24v125.226667c0 34.56 38.272 53.845333 65.706666 35.925333l5.376-4.096 304.426667-272.213333a42.666667 42.666667 0 0 0 2.986667-60.714667l-3.413334-3.285333-304.469333-264.277333z" />
  </svg>
);

interface FullstackBuilderPanelProps {
  sandboxId?: string;
  agentStatus?: string;
}

export function FullstackBuilderPanel({
  sandboxId,
  agentStatus,
}: FullstackBuilderPanelProps) {
  const { 
    isOpen, 
    closePanel, 
    previewUrl, 
    projectName, 
    framework 
  } = useFullstackBuilderStore();

  const [files, setFiles] = useState<FileInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(['/workspace']));
  const [viewMode, setViewMode] = useState<'preview' | 'code' | 'database'>('preview');
  const [responsiveMode, setResponsiveMode] = useState<'desktop' | 'mobile'>('desktop');
  const [isGithubModalOpen, setIsGithubModalOpen] = useState(false);

  const isWorking = agentStatus === 'running';

  // Read sandbox files if we have a sandboxId
  const loadFiles = useCallback(async (dirPath: string = '/workspace') => {
    if (!sandboxId) return;
    setIsLoadingTree(true);
    try {
      const result = await listSandboxFiles(sandboxId, dirPath);
      // Sort: dirs first, then alphabetical
      result.sort((a, b) => {
        if (a.is_dir && !b.is_dir) return -1;
        if (!a.is_dir && b.is_dir) return 1;
        return a.name.localeCompare(b.name);
      });
      setFiles(prev => {
        const filtered = prev.filter(f => !f.path.startsWith(dirPath + '/') || f.path === dirPath);
        return [...filtered, ...result.filter(f => f.path !== dirPath)];
      });
    } catch (e) {
      console.error('Failed to load file tree', e);
    } finally {
      setIsLoadingTree(false);
    }
  }, [sandboxId]);

  // Load files when panel opens or agent finishes
  useEffect(() => {
    if (isOpen && sandboxId && !isWorking) {
      loadFiles('/workspace');
    }
  }, [isOpen, sandboxId, isWorking, loadFiles]);

  const toggleDir = (path: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
        loadFiles(path);
      }
      return next;
    });
  };

  const handleFileClick = async (file: FileInfo) => {
    if (file.is_dir) {
      toggleDir(file.path);
      return;
    }
    
    setSelectedFile(file.path);
    setIsLoadingContent(true);
    try {
      if (!sandboxId) return;
      const content = await getSandboxFileContent(sandboxId, file.path);
      if (typeof content === 'string') {
        setFileContent(content);
      } else {
        setFileContent('// Binary file cannot be displayed');
      }
    } catch (e) {
      setFileContent('// Error loading file content');
    } finally {
      setIsLoadingContent(false);
    }
  };

  const reloadIframe = () => {
    const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement;
    if (iframe) {
      iframe.src = iframe.src;
    }
  };

  const getLanguage = (filename: string) => {
    if (filename.endsWith('.ts') || filename.endsWith('.tsx')) return 'typescript';
    if (filename.endsWith('.js') || filename.endsWith('.jsx')) return 'javascript';
    if (filename.endsWith('.css')) return 'css';
    if (filename.endsWith('.html')) return 'html';
    if (filename.endsWith('.json')) return 'json';
    if (filename.endsWith('.md')) return 'markdown';
    return 'plaintext';
  };

  const renderTree = (parentPath: string = '/workspace', level: number = 0) => {
    const children = files.filter(f => {
      const parts = f.path.split('/');
      const parentParts = parentPath === '/workspace' ? ['workspace'] : parentPath.split('/').filter(Boolean);
      return f.path.startsWith(parentPath === '/workspace' ? '/workspace/' : parentPath + '/') && parts.length === parentParts.length + 1;
    });

    if (children.length === 0 && level === 0 && !isLoadingTree) {
      return <div className="p-4 text-xs text-muted-foreground text-center">No files found.</div>;
    }

    return children.map(file => (
      <div key={file.path}>
        <div 
          className={`flex items-center py-1.5 px-2 cursor-pointer hover:bg-muted text-[13px] ${selectedFile === file.path ? 'bg-primary/10 text-primary font-medium' : ''}`}
          style={{ paddingLeft: `${Math.max(0.5, level * 0.75 + 0.5)}rem` }}
          onClick={() => handleFileClick(file)}
        >
          {file.is_dir ? <Folder className="w-4 h-4 mr-1.5 text-blue-400" /> : <FileIcon className="w-4 h-4 mr-1.5 text-slate-400" />}
          <span className="truncate">{file.name}</span>
        </div>
        {file.is_dir && expandedDirs.has(file.path) && (
          <div>{renderTree(file.path, level + 1)}</div>
        )}
      </div>
    ));
  };

  const renderGlobalHeader = () => (
    <div className="flex items-center justify-between px-4 py-2 shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center bg-muted/30 p-0.5 rounded-lg border border-border/20 shadow-sm">
          <Button 
            variant="ghost" 
            size="sm" 
            className={cn(
              "h-8 gap-2 rounded-md text-[11px] font-bold px-3 transition-all",
              viewMode === 'preview' ? "bg-white text-foreground shadow-sm ring-1 ring-border/10" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
            onClick={() => setViewMode('preview')}
          >
            <Monitor className="w-3.5 h-3.5" />
            Preview
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className={cn(
              "h-8 gap-2 rounded-md text-[11px] font-bold px-3 transition-all",
              viewMode === 'code' ? "bg-white text-foreground shadow-sm ring-1 ring-border/10" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
            onClick={() => setViewMode('code')}
          >
            <Code2 className="w-3.5 h-3.5" />
            Code
          </Button>
        </div>
        
        <div className="flex items-center bg-muted/30 p-0.5 rounded-lg border border-border/20 shadow-sm">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={cn(
                    "h-7 w-7 rounded-md transition-all",
                    viewMode === 'code' ? "bg-white text-foreground shadow-sm ring-1 ring-border/10" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                  onClick={() => setViewMode('code')}
                >
                  <Code2 className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Code</TooltipContent>
            </Tooltip>
            {/* History, Folder, Settings buttons with neutral hover */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all">
                  <History className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>History</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={cn(
                    "h-7 w-7 rounded-md transition-all",
                    viewMode === 'database' ? "bg-white text-foreground shadow-sm ring-1 ring-border/10" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                  onClick={() => setViewMode('database')}
                >
                  <Database className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Database</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all">
                  <Folder className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Files</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all">
                  <Settings className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Settings</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground" onClick={() => setIsGithubModalOpen(true)}>
          <Github className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8 gap-2 rounded-lg text-xs font-medium border border-border/40 px-3">
          <ShareIcon className="w-3.5 h-3.5" />
          Share
        </Button>
        <Button variant="default" size="sm" className="h-8 rounded-lg text-xs font-semibold px-4 bg-zinc-900 hover:bg-zinc-800 text-white border-0" onClick={() => setIsGithubModalOpen(true)}>
          Publish
        </Button>
        <div className="w-px h-4 bg-border/40 mx-1" />
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50" onClick={closePanel}>
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  const renderSimulatorBar = () => (
    <div className="flex items-center justify-between px-4 h-11 border-b border-border/30 bg-background/50">
      <div className="flex items-center gap-1 bg-muted/30 p-0.5 rounded-lg border border-border/20 shadow-sm">
        <Button 
          variant="ghost" 
          size="icon" 
          className={cn(
            "h-7 w-7 rounded-md transition-all",
            responsiveMode === 'desktop' ? "bg-white text-foreground shadow-sm ring-1 ring-border/10" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          )}
          onClick={() => setResponsiveMode('desktop')}
        >
          <Monitor className="w-3.5 h-3.5" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className={cn(
            "h-7 w-7 rounded-md transition-all",
            responsiveMode === 'mobile' ? "bg-white text-foreground shadow-sm ring-1 ring-border/10" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          )}
          onClick={() => setResponsiveMode('mobile')}
        >
          <Smartphone className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="flex items-center gap-2 bg-muted/40 hover:bg-muted/60 transition-colors px-3 py-1 rounded-full border border-border/40 w-full max-w-md mx-auto group">
        <Home className="w-3 h-3 text-muted-foreground cursor-pointer hover:text-foreground" />
        <div className="flex-1 flex justify-center text-[10px] font-mono text-muted-foreground/80 overflow-hidden">
          <span className="truncate">{previewUrl ? new URL(previewUrl).pathname : '/'}</span>
        </div>
        <div className="flex items-center gap-2">
          <ExternalLink className="w-3 h-3 text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => window.open(previewUrl, '_blank')} />
          <RefreshCw className={`w-3 h-3 text-muted-foreground cursor-pointer hover:text-foreground ${isLoadingTree ? 'animate-spin' : ''}`} onClick={reloadIframe} />
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {isWorking && (
          <Badge variant="outline" className="h-6 text-[9px] uppercase tracking-wider animate-pulse border-blue-100 text-blue-600 bg-blue-50/30">
            <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" /> Working
          </Badge>
        )}
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 gap-1.5 rounded-lg text-[10px] font-bold border border-border/40 px-2.5 bg-background shadow-sm"
          onClick={() => setViewMode('code')}
        >
          <Code2 className="w-3 h-3" />
          Edit
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7 rounded-lg text-muted-foreground border border-border/40 bg-background shadow-sm"
          onClick={() => window.open(previewUrl, '_blank')}
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full w-full bg-muted/5 overflow-hidden relative z-50">
      {renderGlobalHeader()}
      
      <div className="flex-1 flex flex-col w-full bg-background min-h-0 rounded-3xl border border-border/40 shadow-2xl mb-2 mx-1 mt-1 overflow-hidden" style={{ contain: 'strict' }}>
        {viewMode !== 'database' && renderSimulatorBar()}
        <PanelGroup direction="horizontal" className="h-full w-full">
          {viewMode === 'code' && (
            <>
              <Panel defaultSize={20} minSize={15} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/20 text-xs font-semibold shrink-0 h-9">
                  <span className="uppercase tracking-wider text-muted-foreground">Explorer</span>
                  <button onClick={() => loadFiles('/workspace')} className="hover:text-primary transition-colors">
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTree ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto min-h-0 bg-muted/5 py-2 custom-scrollbar border-r border-border">
                  {renderTree()}
                </div>
              </Panel>
              <PanelResizeHandle className="w-[3px] bg-border/50 hover:bg-primary/50 transition-colors cursor-col-resize shrink-0" />
              
              <Panel defaultSize={80} minSize={20} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div className="flex items-center px-3 py-1.5 border-b border-border bg-muted/20 text-xs font-semibold shrink-0 h-9">
                  <span className="truncate">{selectedFile || 'Editor'}</span>
                  {isLoadingContent && <Loader2 className="w-3.5 h-3.5 ml-2 animate-spin text-muted-foreground" />}
                </div>
                <div className="flex-1 bg-editor min-h-0 relative">
                  {selectedFile ? (
                    <Editor
                      height="100%"
                      language={getLanguage(selectedFile)}
                      theme="vs-dark"
                      value={fileContent}
                      options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        fontSize: 13,
                        wordWrap: 'on',
                        scrollBeyondLastLine: false,
                        padding: { top: 16, bottom: 16 },
                      }}
                      loading={<div className="flex items-center justify-center h-full text-sm text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2"/>Loading editor...</div>}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                      Select a file from the tree to view its contents
                    </div>
                  )}
                </div>
              </Panel>
            </>
          )}

          {viewMode === 'preview' && (
            <Panel defaultSize={100} minSize={20} style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
              <div className="flex-1 bg-muted/5 relative min-h-0 flex items-center justify-center p-4 overflow-hidden">
                <div className={cn(
                  "bg-white shadow-xl border border-border/40 transition-all duration-300 relative",
                  responsiveMode === 'desktop' ? "w-full h-full rounded-[24px] overflow-hidden" : "w-[375px] h-[667px] rounded-[32px] border-[8px] border-zinc-900 p-0 shadow-2xl shrink-0"
                )}>
                  {previewUrl ? (
                    <iframe
                      id="preview-iframe"
                      src={previewUrl}
                      className="w-full h-full border-0"
                      allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
                      allowFullScreen
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4 border border-border">
                        <Terminal className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <p className="text-base font-semibold text-foreground">No preview available</p>
                    </div>
                  )}
                  {responsiveMode === 'mobile' && (
                    <div className="absolute top-1/2 -right-3 w-1 h-12 bg-zinc-900 rounded-r-lg" />
                  )}
                </div>
              </div>
            </Panel>
          )}

          {viewMode === 'database' && (
            <Panel defaultSize={100} minSize={20} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <DatabaseViewer projectId={sandboxId} />
            </Panel>
          )}
        </PanelGroup>
      </div>

      <GithubPushModal 
        isOpen={isGithubModalOpen} 
        onOpenChange={setIsGithubModalOpen} 
        sandboxId={sandboxId}
        defaultRepoName={projectName || 'talos-ai-project'}
      />
    </div>
  );
}
