'use client';

import { useState, useCallback } from 'react';
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
  Table,
  MoreVertical,
  Download,
  History,
  Sun,
  Moon,
  X,
  Edit3,
  Maximize2,
  Minimize2,
  Globe,
  Layout,
  Terminal,
} from 'lucide-react';
import { TalosCodePanel } from '@/components/artifacts/TalosCodePanel';
import { TalosTerminal } from '@/components/artifacts/TalosTerminal';
import { usePreviewPanelStore } from '@/stores/use-preview-panel-store';

// —————————————————————————————————————————————————————————————————————————————————————
// TYPES
// —————————————————————————————————————————————————————————————————————————————————————

interface Tab {
  id: 'preview' | 'code' | 'files' | 'db' | 'settings' | 'workspace' | 'terminal';
  label: string;
  icon: React.ReactNode;
}

interface FileItem {
  name: string;
  type: 'file' | 'folder';
  size?: string;
  active?: boolean;
  children?: FileItem[];
}

interface Version {
  id: string;
  label: string;
  time: string;
  active: boolean;
}

interface Theme {
  bg: string;
  surface: string;
  surfaceHover: string;
  surfaceActive: string;
  border: string;
  borderHover: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textDim: string;
  accent: string;
  accentBg: string;
  accentText: string;
  success: string;
  badge: string;
  codeGutter: string;
  codeBg: string;
  urlBar: string;
  toggleBg: string;
  toggleActive: string;
  folderColor: string;
  fileActive: string;
  fileActiveBorder: string;
  menuBg: string;
  menuBorder: string;
  menuHover: string;
}

interface WebsitePreviewPanelProps {
  threadId?: string;
  projectId?: string;
  sandboxId?: string;
  initialFiles?: Record<string, any>;
  onPublish?: () => Promise<void>;
  isOpen?: boolean;
  onClose?: () => void;
  previewUrl?: string;
  databaseUrl?: string;
  databaseProvider?: string;
  framework?: string;
  projectName?: string;
}

// —————————————————————————————————————————————————————————————————————————————————————
// THEME SYSTEM
// —————————————————————————————————————————————————————————————————————————————————————

const themes: Record<'dark' | 'light', Theme> = {
  dark: {
    bg: '#0a0a0a',
    surface: '#111111',
    surfaceHover: 'rgba(255,255,255,0.05)',
    surfaceActive: 'rgba(255,255,255,0.1)',
    border: '#1f1f1f',
    borderHover: '#2a2a2a',
    text: '#ffffff',
    textSecondary: '#a1a1aa',
    textMuted: '#52525b',
    textDim: '#3f3f46',
    accent: '#ffffff',
    accentBg: '#ffffff',
    accentText: '#000000',
    success: '#10b981',
    badge: 'rgba(255,255,255,0.1)',
    codeGutter: '#1f1f1f',
    codeBg: '#0a0a0a',
    urlBar: '#18181b',
    toggleBg: '#18181b',
    toggleActive: '#27272a',
    folderColor: '#fbbf24',
    fileActive: 'rgba(255,255,255,0.06)',
    fileActiveBorder: '#fff',
    menuBg: '#111111',
    menuBorder: '#1f1f1f',
    menuHover: '#1f1f1f',
  },
  light: {
    bg: '#f9fafb',
    surface: '#ffffff',
    surfaceHover: 'rgba(0,0,0,0.02)',
    surfaceActive: 'rgba(0,0,0,0.04)',
    border: '#e5e7eb',
    borderHover: '#d1d5db',
    text: '#111827',
    textSecondary: '#4b5563',
    textMuted: '#9ca3af',
    textDim: '#d1d5db',
    accent: '#000000',
    accentBg: '#000000',
    accentText: '#ffffff',
    success: '#10b981',
    badge: 'rgba(0,0,0,0.05)',
    codeGutter: '#e5e7eb',
    codeBg: '#ffffff',
    urlBar: '#f3f4f6',
    toggleBg: '#f3f4f6',
    toggleActive: '#ffffff',
    folderColor: '#fbbf24',
    fileActive: 'rgba(0,0,0,0.05)',
    fileActiveBorder: '#000000',
    menuBg: '#ffffff',
    menuBorder: '#e5e7eb',
    menuHover: '#f3f4f6',
  },
};

const TABS: Tab[] = [
  { id: 'preview', label: 'Preview', icon: <Eye className="w-[15px] h-[15px]" /> },
  { id: 'code', label: 'Code', icon: <Code2 className="w-[15px] h-[15px]" /> },
  { id: 'files', label: 'Files', icon: <FolderOpen className="w-[15px] h-[15px]" /> },
  { id: 'db', label: 'Database', icon: <Database className="w-[15px] h-[15px]" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-[15px] h-[15px]" /> },
];

const MOCK_FILES: FileItem[] = [
  { name: 'package.json', type: 'file', size: '1.2 KB' },
  { name: 'next.config.js', type: 'file', size: '0.4 KB' },
  { name: 'tailwind.config.js', type: 'file', size: '0.8 KB' },
  {
    name: 'src',
    type: 'folder',
    children: [
      {
        name: 'app',
        type: 'folder',
        children: [
          { name: 'page.tsx', type: 'file', size: '2.1 KB', active: true },
          { name: 'layout.tsx', type: 'file', size: '1.0 KB' },
          { name: 'globals.css', type: 'file', size: '3.2 KB' },
        ],
      },
      {
        name: 'components',
        type: 'folder',
        children: [
          { name: 'Hero.tsx', type: 'file', size: '1.8 KB' },
          { name: 'Navbar.tsx', type: 'file', size: '1.2 KB' },
          { name: 'Footer.tsx', type: 'file', size: '0.9 KB' },
        ],
      },
    ],
  },
  {
    name: 'public',
    type: 'folder',
    children: [{ name: 'favicon.ico', type: 'file', size: '4.1 KB' }],
  },
];

const MOCK_CODE = `// src/app/page.tsx
// Talos Generated — Next.js 15 + Tailwind

const Hero = ({ title, subtitle }) => (
  <section className='min-h-[80vh] flex flex-col items-center justify-center'>
    <span className='text-xs tracking-[3px] text-gray-500 uppercase'>
      Talos AI
    </span>
    <h1 className='text-6xl font-black tracking-tight mt-4'>
      {title}
    </h1>
    <p className='text-gray-500 mt-6 max-w-md text-center'>
      {subtitle}
    </p>
    <button className='mt-8 px-8 py-3 bg-white text-black rounded-lg
      font-bold text-sm tracking-wide'>
      Get Started
    </button>
  </section>
)

export default function Home() {
  return (
    <main className='min-h-screen bg-[#010101] text-white'>
      <Hero
        title="FROM INTENT TO ACTION"
        subtitle="The autonomous AI agent that turns your ideas into reality"
      />
    </main>
  )
}`;

const MOCK_VERSIONS: Version[] = [
  { id: 'v3', label: 'Current version', time: 'Just now', active: true },
  { id: 'v2', label: 'Added pricing section', time: '2 min ago', active: false },
  { id: 'v1', label: 'Initial generation', time: '5 min ago', active: false },
];

// —————————————————————————————————————————————————————————————————————————————————————
// SUB-COMPONENTS
// —————————————————————————————————————————————————————————————————————————————————————

interface FileTreeProps {
  items: FileItem[];
  depth?: number;
  theme: Theme;
}

const FileTree: React.FC<FileTreeProps> = ({ items, depth = 0, theme }) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <div>
      {items.map((item) => (
        <div key={item.name}>
          <div
            onClick={() =>
              item.type === 'folder' &&
              setExpanded((p) => ({ ...p, [item.name]: !p[item.name] }))
            }
            style={{
              padding: '6px 12px',
              paddingLeft: `${16 + depth * 16}px`,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: item.type === 'folder' ? 'pointer' : 'default',
              fontSize: '13px',
              color: item.active ? theme.text : theme.textSecondary,
              background: item.active ? theme.fileActive : 'transparent',
              borderLeft: item.active
                ? `2px solid ${theme.fileActiveBorder}`
                : '2px solid transparent',
              transition: 'all 0.15s ease',
            }}
          >
            {item.type === 'folder' && (
              <span
                style={{
                  transform: expanded[item.name] ? 'rotate(90deg)' : 'rotate(0)',
                  transition: 'transform 0.15s',
                  display: 'flex',
                }}
              >
                <ChevronRight className="w-3 h-3" />
              </span>
            )}
            <span
              style={{
                display: 'flex',
                color: item.type === 'folder' ? theme.folderColor : theme.textMuted,
              }}
            >
              {item.type === 'folder' ? (
                <FolderOpen className="w-[14px] h-[14px]" />
              ) : (
                <FileText className="w-[14px] h-[14px]" />
              )}
            </span>
            <span style={{ flex: 1, fontFamily: "'JetBrains Mono', 'SF Mono', monospace" }}>
              {item.name}
            </span>
            {item.size && (
              <span style={{ fontSize: '11px', color: theme.textMuted }}>{item.size}</span>
            )}
          </div>
          {item.type === 'folder' && expanded[item.name] && item.children && (
            <FileTree items={item.children} depth={depth + 1} theme={theme} />
          )}
        </div>
      ))}
    </div>
  );
};

interface CodeViewerProps {
  code: string;
  filename: string;
  theme: Theme;
}

const CodeViewer: React.FC<CodeViewerProps> = ({ code, filename, theme }) => {
  const lines = code.split('\n');

  return (
    <div style={{ height: '100%', overflow: 'auto', background: theme.codeBg }}>
      <div
        style={{
          padding: '10px 16px',
          borderBottom: `1px solid ${theme.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
          color: theme.textSecondary,
        }}
      >
        <FileText className="w-[15px] h-[15px]" />
        <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{filename}</span>
        <span
          style={{
            marginLeft: 'auto',
            background: theme.toggleBg,
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '10px',
          }}
        >
          TSX
        </span>
      </div>
      <pre
        style={{
          margin: 0,
          padding: '16px 0',
          fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
          fontSize: '13px',
          lineHeight: 1.7,
        }}
      >
        {lines.map((line, i) => (
          <div key={i} style={{ display: 'flex', paddingRight: '16px' }}>
            <span
              style={{
                width: '48px',
                textAlign: 'right',
                paddingRight: '16px',
                color: theme.codeGutter,
                userSelect: 'none',
                flexShrink: 0,
              }}
            >
              {i + 1}
            </span>
            <code style={{ color: theme.text }}>{line || '\u00A0'}</code>
          </div>
        ))}
      </pre>
    </div>
  );
};

interface DBPanelProps {
  connected: boolean;
  theme: Theme;
  databaseProvider?: string;
}

const DBPanel: React.FC<DBPanelProps> = ({ connected, theme, databaseProvider }) => (
  <div
    style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
      color: theme.textSecondary,
    }}
  >
    {connected ? (
      <>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '8px', color: theme.success }}
        >
          <Check className="w-4 h-4" />
          <span style={{ fontSize: '14px', fontWeight: 500 }}>
            {databaseProvider || 'Supabase'} Connected
          </span>
        </div>
        <div
          style={{
            background: theme.surface,
            borderRadius: '8px',
            padding: '20px',
            width: '90%',
            maxWidth: '500px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px',
              fontSize: '13px',
              color: theme.textSecondary,
            }}
          >
            <Table className="w-4 h-4" />
            <span>Tables</span>
          </div>
          {['users', 'projects', 'tasks', 'sessions'].map((tbl) => (
            <div
              key={tbl}
              style={{
                padding: '8px 12px',
                fontSize: '13px',
                color: theme.text,
                fontFamily: 'monospace',
                borderBottom: `1px solid ${theme.border}`,
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>{tbl}</span>
              <span style={{ color: theme.textMuted, fontSize: '11px' }}>0 rows</span>
            </div>
          ))}
        </div>
      </>
    ) : (
      <>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: theme.surface,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Database className="w-5 h-5" />
        </div>
        <p style={{ fontSize: '14px' }}>No database connected</p>
        <button
          style={{
            padding: '8px 20px',
            background: theme.accentBg,
            color: theme.accentText,
            border: 'none',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Connect Supabase
        </button>
      </>
    )}
  </div>
);

interface SettingsPanelProps {
  theme: Theme;
  framework?: string;
  projectName?: string;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ theme, framework, projectName }) => {
  const settings = [
    { label: 'Framework', value: framework || 'Next.js 15' },
    { label: 'Node', value: 'v20.11.0' },
    { label: 'Package Manager', value: 'npm' },
    { label: 'Build Command', value: 'npm run build' },
    { label: 'Output Directory', value: '.next' },
    {
      label: 'Domain',
      value: projectName ? `${projectName}.vercel.app` : 'talos-project.vercel.app',
    },
  ];

  return (
    <div style={{ padding: '24px', color: theme.textSecondary, fontSize: '13px' }}>
      <h3 style={{ color: theme.text, fontSize: '15px', marginBottom: '20px', fontWeight: 600 }}>
        Project Configuration
      </h3>
      {settings.map(({ label, value }) => (
        <div
          key={label}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '10px 0',
            borderBottom: `1px solid ${theme.border}`,
          }}
        >
          <span>{label}</span>
          <span style={{ color: theme.text, fontFamily: 'monospace', fontSize: '12px' }}>
            {value}
          </span>
        </div>
      ))}
    </div>
  );
};

interface VersionHistoryProps {
  theme: Theme;
  onClose: () => void;
}

const VersionHistory: React.FC<VersionHistoryProps> = ({ theme, onClose }) => (
  <div
    style={{
      position: 'absolute',
      top: 0,
      right: 0,
      width: '320px',
      height: '100%',
      background: theme.bg,
      borderLeft: `1px solid ${theme.border}`,
      zIndex: 50,
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '-8px 0 30px rgba(0,0,0,0.2)',
    }}
  >
    <div
      style={{
        padding: '16px 20px',
        borderBottom: `1px solid ${theme.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <span style={{ fontSize: '14px', fontWeight: 600, color: theme.text }}>
        Version History
      </span>
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          color: theme.textSecondary,
          cursor: 'pointer',
          fontSize: '18px',
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
    <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
      {MOCK_VERSIONS.map((v) => (
        <div
          key={v.id}
          style={{
            padding: '12px 14px',
            borderRadius: '8px',
            marginBottom: '6px',
            background: v.active ? theme.surfaceActive : 'transparent',
            border: v.active ? `1px solid ${theme.border}` : '1px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: v.active ? theme.success : theme.textMuted,
              }}
            />
            <span
              style={{
                fontSize: '13px',
                color: theme.text,
                fontWeight: v.active ? 600 : 400,
              }}
            >
              {v.label}
            </span>
          </div>
          <div
            style={{
              fontSize: '11px',
              color: theme.textMuted,
              marginTop: '4px',
              paddingLeft: '16px',
            }}
          >
            {v.time}
          </div>
        </div>
      ))}
    </div>
    <div
      style={{
        padding: '12px 16px',
        borderTop: `1px solid ${theme.border}`,
        fontSize: '11px',
        color: theme.textMuted,
      }}
    >
      Restore any version by clicking on it
    </div>
  </div>
);

// —————————————————————————————————————————————————————————————————————————————————————
// MAIN COMPONENT
// —————————————————————————————————————————————————————————————————————————————————————

export const WebsitePreviewPanel: React.FC<WebsitePreviewPanelProps> = ({
  threadId,
  projectId,
  sandboxId: propsSandboxId,
  onPublish,
  isOpen = true,
  onClose,
  previewUrl,
  databaseUrl,
  databaseProvider,
  framework,
  projectName,
  initialFiles,
}) => {
  const { deployment } = usePreviewPanelStore();
  const sandboxId = propsSandboxId || deployment?.sandboxId;
  const isProject = !!(sandboxId || initialFiles);

  const [activeTab, setActiveTab] = useState<
    'preview' | 'code' | 'files' | 'db' | 'settings' | 'workspace' | 'terminal'
  >(isProject ? 'workspace' : 'preview');
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [mode, setMode] = useState<'dark' | 'light'>('light');
  const [moreOpen, setMoreOpen] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  const theme = themes[mode];

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      if (onPublish) await onPublish();
      setIsPublishing(false);
      setIsPublished(true);
      setTimeout(() => setIsPublished(false), 3000);
    } catch (error) {
      console.error('Error publishing:', error);
      setIsPublishing(false);
    }
  };

  const closeMore = useCallback(() => setMoreOpen(false), []);

  if (!isOpen) return null;

  return (
    <div
      onClick={() => moreOpen && closeMore()}
      style={{
        width: isFullscreen ? '100vw' : '100%',
        height: isFullscreen ? '100vh' : '100%',
        position: isFullscreen ? 'fixed' : 'relative',
        top: 0,
        left: 0,
        zIndex: isFullscreen ? 1000 : 'auto',
        display: 'flex',
        flexDirection: 'column',
        background: isFullscreen ? theme.bg : '#f8f8f7',
        padding: isFullscreen ? '0' : '0 12px 12px 12px',
        transition: 'all 0.3s ease',
      }}
    >
      {/* —— TOP BAR (BOLT CLONE) —————————————————————————————————— */}
      <div
        style={{
          height: '56px',
          minHeight: '56px',
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
          gap: '8px',
          zIndex: 100,
          background: isFullscreen ? '#ffffff' : 'transparent',
          borderBottom: isFullscreen ? '1px solid #e5e7eb' : 'none',
          marginBottom: isFullscreen ? '0' : '0',
        }}
      >
        {/* Left: View Toggles (Gray Pill) */}
        <div
          style={{
            display: 'flex',
            gap: '2px',
            background: '#f3f4f6',
            padding: '3px',
            borderRadius: '8px',
            border: '1px solid #e1e4e8',
          }}
        >
          {(isProject
            ? [
                { id: 'workspace', icon: <Eye className="w-4 h-4" />, label: 'Preview' },
                { id: 'code_view', icon: <Code2 className="w-4 h-4" />, label: 'Code' },
                { id: 'terminal', icon: <Terminal className="w-4 h-4" />, label: 'Terminal' },
                { id: 'settings', icon: <Settings className="w-4 h-4" />, label: 'Settings' },
              ]
            : TABS
          ).map((tab: Tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                color: activeTab === tab.id ? '#3b82f6' : '#6b7280',
                background: activeTab === tab.id ? '#ffffff' : 'transparent',
                boxShadow: activeTab === tab.id ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                transition: 'all 0.1s ease',
              }}
              title={tab.label}
            >
              {tab.icon}
            </button>
          ))}
        </div>

        {/* Center: Address Bar */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              width: '100%',
              maxWidth: '640px',
              height: '32px',
              background: '#f3f4f6',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              padding: '0 12px',
              fontSize: '13px',
              color: '#4b5563',
            }}
          >
            <div style={{ opacity: 0.7 }}>/</div>
          </div>
        </div>

        {/* Right Action Strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={() => setIframeKey((k) => k + 1)}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6b7280',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => previewUrl && window.open(previewUrl, '_blank')}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6b7280',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            <ExternalLink className="w-4 h-4" />
          </button>

          <button
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6b7280',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
            }}
            onClick={() => setViewport(v => v === 'desktop' ? 'mobile' : 'desktop')}
          >
            <Smartphone className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6b7280',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          <div style={{ width: '1px', height: '16px', background: '#e5e7eb', margin: '0 2px' }} />

          <button
            style={{
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              color: '#111827',
              cursor: 'pointer',
            }}
          >
            <Github className="w-5 h-5" />
          </button>

          <button
            style={{
              padding: '0 12px',
              height: '32px',
              borderRadius: '8px',
              background: '#f3f4f6',
              border: 'none',
              color: '#374151',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            Share
          </button>

          <button
            onClick={handlePublish}
            disabled={isPublishing}
            style={{
              padding: '0 16px',
              height: '32px',
              borderRadius: '8px',
              background: '#000000',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 700,
            }}
          >
            {isPublishing ? '...' : 'Publish'}
          </button>

          
          <button
            onClick={onClose}
            style={{
              marginLeft: '8px',
              color: '#9ca3af',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* —— CONTENT AREA (FLOATING CARD) ——————————————————————————— */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: theme.bg,
          color: theme.text,
          overflow: 'hidden',
          borderRadius: isFullscreen ? '0' : '22px',
          border: isFullscreen ? 'none' : '1px solid rgba(0,0,0,0.08)',
          boxShadow: isFullscreen ? 'none' : '0px 0px 8px 0px rgba(0,0,0,0.02), 0 10px 40px rgba(0,0,0,0.06)',
          position: 'relative',
          marginTop: isFullscreen ? '0' : '8px',
        }}
      >
        {activeTab === 'preview' && (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              padding: viewport === 'mobile' ? '24px' : '0',
              background: '#ffffff',
            }}
          >
            <div
              style={{
                width: viewport === 'mobile' ? '375px' : '100%',
                height: viewport === 'mobile' ? 'calc(100% - 48px)' : '100%',
                borderRadius: viewport === 'mobile' ? '24px' : '0',
                overflow: 'hidden',
                border: viewport === 'mobile' ? `3px solid ${theme.border}` : 'none',
                boxShadow: viewport === 'mobile' ? '0 20px 60px rgba(0,0,0,0.1)' : 'none',
                background: '#ffffff',
                position: 'relative',
              }}
            >
              {previewUrl ? (
                <iframe
                  key={iframeKey}
                  src={previewUrl}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                  }}
                  title="Website Preview"
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    color: '#374151',
                    textAlign: 'center',
                    background: '#ffffff',
                  }}
                >
                  <div style={{ fontSize: '15px', fontWeight: 500 }}>
                    Start prompting (or editing) to see magic happen :)
                  </div>
                </div>
              )}

              {/* MADE IN BOLT BADGE (CLONE) */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '16px',
                  right: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#ffffff',
                  padding: '6px 14px',
                  borderRadius: '12px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
                  fontSize: '12px',
                  color: '#111827',
                  fontWeight: 700,
                  border: '1px solid #e5e7eb',
                }}
              >
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                </div>
                Made in Bolt
              </div>
            </div>
          </div>
        )}

        {activeTab === 'workspace' && isProject && (
          <TalosCodePanel
            sandboxId={sandboxId || 'mock-sandbox'}
            theme={mode}
            previewUrl={previewUrl}
            initialFiles={initialFiles}
          />
        )}

        {activeTab === 'terminal' && sandboxId && (
          <TalosTerminal
            sandboxId={sandboxId}
            theme={mode}
          />
        )}

        {(activeTab === 'code' || (activeTab === 'workspace' && !sandboxId)) && (
          <CodeViewer code={MOCK_CODE} filename="src/app/page.tsx" theme={theme} />
        )}

        {(activeTab === 'files' || (activeTab === 'workspace' && !sandboxId)) && (
          <div style={{ height: '100%', overflow: 'auto', background: theme.surface, paddingTop: '8px' }}>
            <FileTree items={MOCK_FILES} theme={theme} />
          </div>
        )}

        {activeTab === 'db' && (
          <DBPanel
            connected={!!databaseUrl}
            theme={theme}
            databaseProvider={databaseProvider}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsPanel theme={theme} framework={framework} projectName={projectName} />
        )}

        {/* Version history slide-over */}
        {showVersions && <VersionHistory theme={theme} onClose={() => setShowVersions(false)} />}
      </div>
    </div>
  );
};
