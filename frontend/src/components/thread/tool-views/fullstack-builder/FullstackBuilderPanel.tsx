import React, { useState, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { listSandboxFiles, getSandboxFileContent, FileInfo } from '@/lib/api/sandbox';
import { Loader2, Folder, File as FileIcon, Terminal, RefreshCw, ExternalLink, Activity, X } from 'lucide-react';
import { CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useFullstackBuilderStore } from '@/stores/use-fullstack-builder-store';

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

  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden shadow-2xl relative z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border border-l-4 border-l-blue-500 shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <Activity className="w-5 h-5 text-blue-500" />
          <CardTitle className="text-base font-semibold truncate flex items-center gap-2">
            Builder: <span className="font-mono text-sm bg-muted px-2 py-0.5 rounded text-foreground">{projectName || 'App'}</span>
          </CardTitle>
          {framework && (
            <Badge variant="outline" className="ml-2 font-mono text-[10px] uppercase tracking-wider">{framework}</Badge>
          )}
          {isWorking && (
            <Badge variant="outline" className="ml-2 h-5 text-[10px] uppercase tracking-wider animate-pulse border-blue-200 text-blue-600 bg-blue-50 dark:bg-blue-900/30">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Working
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          {previewUrl && (
            <div className="flex items-center gap-1.5 border-r border-border pr-3">
              <button onClick={reloadIframe} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors" title="Reload Preview">
                <RefreshCw className="w-4 h-4" />
              </button>
              <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors" title="Open in New Tab">
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}
          <button onClick={closePanel} className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded text-muted-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content Area - Split Pane */}
      <div className="flex-1 flex flex-col w-full bg-background min-h-0" style={{ contain: 'strict' }}>
        <PanelGroup direction="horizontal" className="h-full w-full">
          {/* File Tree Panel */}
          <Panel defaultSize={20} minSize={15} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/20 text-xs font-semibold shrink-0 h-9">
              <span className="uppercase tracking-wider text-muted-foreground">Explorer</span>
              <button onClick={() => loadFiles('/workspace')} className="hover:text-primary transition-colors">
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTree ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 bg-muted/5 py-2 custom-scrollbar">
              {renderTree()}
            </div>
          </Panel>

          <PanelResizeHandle className="w-[3px] bg-border hover:bg-primary/50 transition-colors cursor-col-resize shrink-0" />

          {/* Editor Panel */}
          <Panel defaultSize={40} minSize={20} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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

          <PanelResizeHandle className="w-[3px] bg-border hover:bg-primary/50 transition-colors cursor-col-resize shrink-0" />

          {/* Preview Panel */}
          <Panel defaultSize={40} minSize={20} style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/20 text-xs font-semibold shrink-0 h-9">
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-muted-foreground"><Terminal className="w-3.5 h-3.5"/> Preview</span>
            </div>
            <div className="flex-1 bg-white relative min-h-0">
              {previewUrl ? (
                <iframe
                  id="preview-iframe"
                  src={previewUrl}
                  className="w-full h-full border-0 absolute inset-0"
                  allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
                  allowFullScreen
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4 border border-border">
                    <Terminal className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-base font-semibold text-foreground">No preview available</p>
                  <p className="text-sm text-muted-foreground mt-2 max-w-[250px]">The preview will appear here once the development server starts running.</p>
                </div>
              )}
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
