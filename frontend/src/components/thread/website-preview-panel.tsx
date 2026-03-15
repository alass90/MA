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
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface Tab {
  id: 'preview' | 'code' | 'files' | 'db' | 'settings';
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
}

// ═══════════════════════════════════════════════════════════════
// THEME SYSTEM
// ═══════════════════════════════════════════════════════════════

const themes: Record<'dark' | 'light', Theme> = {
  dark: {
    bg: '#010101',
    surface: '#0a0a0a',
    surfaceHover: 'rgba(255,255,255,0.03)',
    surfaceActive: 'rgba(255,255,255,0.06)',
    border: '#1a1a1a',
    borderHover: '#333',
    text: '#fff',
    textSecondary: '#9ca3af',
    textMuted: '#4b5563',
    textDim: '#616160',
    accent: '#fff',
    accentBg: '#fff',
    accentText: '#010101',
    success: '#10b981',
    badge: 'rgba(0,0,0,0.8)',
    codeGutter: '#333',
    codeBg: '#0a0a0a',
    urlBar: '#111',
    toggleBg: '#111',
    toggleActive: '#2a2a2a',
    folderColor: '#fbbf24',
    fileActive: 'rgba(255,255,255,0.06)',
    fileActiveBorder: '#fff',
    menuBg: '#111',
    menuBorder: '#222',
    menuHover: '#1a1a1a',
  },
  light: {
    bg: '#ffffff',
    surface: '#f9fafb',
    surfaceHover: 'rgba(0,0,0,0.02)',
    surfaceActive: 'rgba(0,0,0,0.04)',
    border: '#e5e7eb',
    borderHover: '#d1d5db',
    text: '#111827',
    textSecondary: '#6b7280',
    textMuted: '#9ca3af',
    textDim: '#9ca3af',
    accent: '#111827',
    accentBg: '#111827',
    accentText: '#fff',
    success: '#059669',
    badge: 'rgba(255,255,255,0.9)',
    codeGutter: '#d1d5db',
    codeBg: '#f9fafb',
    urlBar: '#f3f4f6',
    toggleBg: '#f3f4f6',
    toggleActive: '#e5e7eb',
    folderColor: '#d97706',
    fileActive: 'rgba(0,0,0,0.04)',
    fileActiveBorder: '#111827',
    menuBg: '#fff',
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

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export const WebsitePreviewPanel: React.FC<WebsitePreviewPanelProps> = ({
  isOpen,
  onClose,
  previewUrl,
  projectPath,
  framework,
  deploymentId,
  projectName,
  databaseUrl,
  databaseProvider,
  threadId,
  projectId,
  onPublish,
}) => {
  const [activeTab, setActiveTab] = useState<
    'preview' | 'code' | 'files' | 'db' | 'settings'
  >('preview');
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [mode, setMode] = useState<'dark' | 'light'>('dark');
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
      if (onPublish) {
        // Call the provided publish callback
        await onPublish();
      }

      setIsPublishing(false);
      setIsPublished(true);
      setTimeout(() => setIsPublished(false), 3000);
    } catch (error) {
      console.error('Error publishing:', error);
      setIsPublishing(false);
      // Could show an error toast here
    }
  };

  const closeMore = useCallback(() => setMoreOpen(false), []);

  if (!isOpen) return null;

  return (
    <div
      onClick={() => moreOpen && closeMore()}
      style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: theme.bg,
        color: theme.text,
        fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
        overflow: 'hidden',
        transition: 'background 0.3s, color 0.3s',
        position: 'relative',
      }}
    >
      {/* ── TOP BAR ─────────────────────────────────────── */}
      {!isFullscreen && (
        <div
          style={{
            height: '48px',
            minHeight: '48px',
            borderBottom: `1px solid ${theme.border}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 6px',
            gap: '2px',
            transition: 'border-color 0.3s',
          }}
        >
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '1px', flex: 1 }}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 12px',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12.5px',
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  color: activeTab === tab.id ? theme.text : theme.textDim,
                  background: activeTab === tab.id ? theme.surfaceActive : 'transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div
            style={{ width: '1px', height: '20px', background: theme.border, margin: '0 4px' }}
          />

          {/* Right actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'relative' }}>
            {/* Theme toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMode(mode === 'dark' ? 'light' : 'dark');
              }}
              style={{
                padding: '6px',
                border: 'none',
                borderRadius: '6px',
                background: 'transparent',
                color: theme.textSecondary,
                cursor: 'pointer',
                display: 'flex',
                transition: 'color 0.15s',
              }}
              title={mode === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {mode === 'dark' ? (
                <Sun className="w-[15px] h-[15px]" />
              ) : (
                <Moon className="w-[15px] h-[15px]" />
              )}
            </button>

            {/* More menu button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMoreOpen(!moreOpen);
              }}
              style={{
                padding: '6px',
                border: 'none',
                borderRadius: '6px',
                background: moreOpen ? theme.surfaceActive : 'transparent',
                color: theme.textSecondary,
                cursor: 'pointer',
                display: 'flex',
                transition: 'all 0.15s',
              }}
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* More dropdown */}
            {moreOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  top: '40px',
                  right: '0px',
                  width: '220px',
                  background: theme.menuBg,
                  border: `1px solid ${theme.menuBorder}`,
                  borderRadius: '10px',
                  padding: '6px',
                  zIndex: 100,
                  boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
                }}
              >
                {[
                  {
                    icon: <Download className="w-[15px] h-[15px]" />,
                    label: 'Download as ZIP',
                    action: () => {
                      closeMore();
                    },
                  },
                  {
                    icon: <History className="w-[15px] h-[15px]" />,
                    label: 'Version history',
                    action: () => {
                      closeMore();
                      setShowVersions(true);
                    },
                  },
                ].map((item, i) => (
                  <button
                    key={i}
                    onClick={item.action}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      padding: '10px 12px',
                      border: 'none',
                      borderRadius: '7px',
                      background: 'transparent',
                      color: theme.text,
                      cursor: 'pointer',
                      fontSize: '13px',
                      textAlign: 'left',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLButtonElement).style.background = theme.menuHover)
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')
                    }
                  >
                    <span style={{ color: theme.textSecondary, display: 'flex' }}>
                      {item.icon}
                    </span>
                    {item.label}
                  </button>
                ))}
                <div style={{ height: '1px', background: theme.menuBorder, margin: '4px 8px' }} />
                {[
                  {
                    icon: <ExternalLink className="w-[15px] h-[15px]" />,
                    label: 'Open in new tab',
                    action: () => {
                      closeMore();
                      if (previewUrl) window.open(previewUrl, '_blank');
                    },
                  },
                  {
                    icon: <Settings className="w-[15px] h-[15px]" />,
                    label: 'Project settings',
                    action: () => {
                      closeMore();
                      setActiveTab('settings');
                    },
                  },
                ].map((item, i) => (
                  <button
                    key={i}
                    onClick={item.action}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      padding: '10px 12px',
                      border: 'none',
                      borderRadius: '7px',
                      background: 'transparent',
                      color: theme.text,
                      cursor: 'pointer',
                      fontSize: '13px',
                      textAlign: 'left',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLButtonElement).style.background = theme.menuHover)
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')
                    }
                  >
                    <span style={{ color: theme.textSecondary, display: 'flex' }}>
                      {item.icon}
                    </span>
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            <div
              style={{ width: '1px', height: '20px', background: theme.border, margin: '0 2px' }}
            />

            {/* GitHub */}
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 10px',
                border: `1px solid ${theme.border}`,
                borderRadius: '6px',
                background: 'transparent',
                color: theme.textSecondary,
                cursor: 'pointer',
                fontSize: '12px',
                transition: 'all 0.15s',
              }}
            >
              <Github className="w-[15px] h-[15px]" />
              <span>GitHub</span>
            </button>

            {/* Share */}
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 10px',
                border: `1px solid ${theme.border}`,
                borderRadius: '6px',
                background: 'transparent',
                color: theme.textSecondary,
                cursor: 'pointer',
                fontSize: '12px',
                transition: 'all 0.15s',
              }}
            >
              <Share2 className="w-[15px] h-[15px]" />
              <span>Share</span>
            </button>

            {/* Publish */}
            <button
              onClick={handlePublish}
              disabled={isPublishing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 14px',
                border: 'none',
                borderRadius: '6px',
                background: isPublished
                  ? theme.success
                  : isPublishing
                    ? theme.surface
                    : theme.accentBg,
                color: isPublished ? '#fff' : isPublishing ? theme.textMuted : theme.accentText,
                cursor: isPublishing ? 'wait' : 'pointer',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.02em',
                transition: 'all 0.3s ease',
              }}
            >
              {isPublished ? (
                <Check className="w-[15px] h-[15px]" />
              ) : (
                <Upload className="w-[15px] h-[15px]" />
              )}
              <span>
                {isPublished ? 'Published!' : isPublishing ? 'Publishing...' : 'Publish'}
              </span>
            </button>

            {/* Close panel */}
            <button
              onClick={onClose}
              style={{
                padding: '5px',
                border: 'none',
                borderRadius: '6px',
                marginLeft: '2px',
                background: 'transparent',
                color: theme.textMuted,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = theme.surfaceActive;
                (e.currentTarget as HTMLButtonElement).style.color = theme.text;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                (e.currentTarget as HTMLButtonElement).style.color = theme.textMuted;
              }}
              title="Close preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── BROWSER BAR ─────────────────────────────────── */}
      {activeTab === 'preview' && (
        <div
          style={{
            height: '40px',
            minHeight: '40px',
            borderBottom: `1px solid ${theme.border}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            gap: '8px',
            transition: 'border-color 0.3s',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: '2px',
              background: theme.toggleBg,
              borderRadius: '6px',
              padding: '2px',
            }}
          >
            {[
              { id: 'desktop' as const, icon: <Monitor className="w-[15px] h-[15px]" /> },
              { id: 'mobile' as const, icon: <Smartphone className="w-[15px] h-[15px]" /> },
            ].map(({ id, icon }) => (
              <button
                key={id}
                onClick={() => setViewport(id)}
                style={{
                  padding: '4px 8px',
                  border: 'none',
                  borderRadius: '4px',
                  background: viewport === id ? theme.toggleActive : 'transparent',
                  color: viewport === id ? theme.text : theme.textMuted,
                  cursor: 'pointer',
                  display: 'flex',
                  transition: 'all 0.15s',
                }}
              >
                {icon}
              </button>
            ))}
          </div>

          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: theme.urlBar,
              borderRadius: '6px',
              padding: '4px 12px',
              fontSize: '12px',
            }}
          >
            <Globe className="w-3 h-3" style={{ color: theme.textMuted }} />
            <span style={{ color: theme.textMuted, fontFamily: 'monospace' }}>
              {previewUrl || '/'}
            </span>
          </div>

          <button
            onClick={() => setIframeKey((k) => k + 1)}
            style={{
              padding: '4px',
              border: 'none',
              background: 'transparent',
              color: theme.textMuted,
              cursor: 'pointer',
              display: 'flex',
            }}
          >
            <RefreshCw className="w-[14px] h-[14px]" />
          </button>

          <button
            onClick={() => previewUrl && window.open(previewUrl, '_blank')}
            style={{
              padding: '4px',
              border: 'none',
              background: 'transparent',
              color: theme.textMuted,
              cursor: 'pointer',
              display: 'flex',
            }}
          >
            <ExternalLink className="w-[14px] h-[14px]" />
          </button>

          <div
            style={{ width: '1px', height: '18px', background: theme.border, margin: '0 4px' }}
          />

          {/* Edit button */}
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              border: `1px solid ${theme.border}`,
              borderRadius: '6px',
              background: 'transparent',
              color: theme.textSecondary,
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = theme.borderHover;
              (e.currentTarget as HTMLButtonElement).style.color = theme.text;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = theme.border;
              (e.currentTarget as HTMLButtonElement).style.color = theme.textSecondary;
            }}
          >
            <Edit3 className="w-[14px] h-[14px]" />
            <span>Edit</span>
          </button>

          {/* Fullscreen */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            style={{
              padding: '4px',
              border: 'none',
              background: 'transparent',
              color: theme.textMuted,
              cursor: 'pointer',
              display: 'flex',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = theme.text)}
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.color = theme.textMuted)
            }
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-[15px] h-[15px]" />
            ) : (
              <Maximize2 className="w-[15px] h-[15px]" />
            )}
          </button>
        </div>
      )}

      {/* ── CONTENT ──────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {activeTab === 'preview' && (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              background: theme.surface,
              padding: viewport === 'mobile' ? '24px' : '0',
              transition: 'all 0.3s ease',
            }}
          >
            <div
              style={{
                width: viewport === 'mobile' ? '375px' : '100%',
                height: viewport === 'mobile' ? 'calc(100% - 48px)' : '100%',
                borderRadius: viewport === 'mobile' ? '24px' : '0',
                overflow: 'hidden',
                border: viewport === 'mobile' ? `3px solid ${theme.border}` : 'none',
                boxShadow:
                  viewport === 'mobile' ? '0 20px 60px rgba(0,0,0,0.25)' : 'none',
                transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                background: '#010101',
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
                    gap: '16px',
                    background:
                      'linear-gradient(160deg, #010101 0%, #0a0a1a 50%, #010101 100%)',
                    color: '#fff',
                    textAlign: 'center',
                    padding: '40px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '10px',
                      letterSpacing: '4px',
                      color: '#616160',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                    }}
                  >
                    Talos AI
                  </div>
                  <div
                    style={{
                      fontSize: viewport === 'mobile' ? '28px' : '52px',
                      fontWeight: 900,
                      letterSpacing: '-0.04em',
                      lineHeight: 1.05,
                    }}
                  >
                    FROM INTENT
                    <br />
                    TO ACTION
                  </div>
                  <div
                    style={{
                      fontSize: '14px',
                      color: '#616160',
                      maxWidth: '420px',
                      lineHeight: 1.6,
                      marginTop: '4px',
                    }}
                  >
                    The autonomous AI agent that turns your intent into real-world results
                  </div>
                  <div
                    style={{
                      marginTop: '24px',
                      padding: '11px 32px',
                      background: '#fff',
                      color: '#010101',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '13px',
                      letterSpacing: '0.02em',
                    }}
                  >
                    Get Started
                  </div>
                </div>
              )}

              <div
                style={{
                  position: 'absolute',
                  bottom: '16px',
                  right: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(0,0,0,0.75)',
                  backdropFilter: 'blur(12px)',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  color: '#9ca3af',
                  fontWeight: 500,
                }}
              >
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span style={{ fontSize: '8px', fontWeight: 900, color: '#010101' }}>T</span>
                </div>
                Made with Talos
              </div>
            </div>
          </div>
        )}

        {activeTab === 'code' && (
          <CodeViewer code={MOCK_CODE} filename="src/app/page.tsx" theme={theme} />
        )}

        {activeTab === 'files' && (
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
