import React, { useMemo } from 'react';
import {
  Globe,
  MonitorPlay,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Code2,
  ImageIcon,
} from 'lucide-react';
import { ToolViewProps } from './types';
import {
  extractBrowserOperation,
  formatTimestamp,
  getToolTitle,
} from './utils';
import { safeJsonParse } from '@/components/thread/utils';
import { Card, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ImageLoader } from './shared/ImageLoader';
import { JsonViewer } from './shared/JsonViewer';

interface BrowserHeaderProps {
  isConnected: boolean;
  onRefresh?: () => void;
  viewToggle?: React.ReactNode;
}

export const BrowserHeader: React.FC<BrowserHeaderProps> = ({ isConnected, onRefresh, viewToggle }) => {
  return (
    <div className={`flex items-center justify-between px-3 md:px-4 h-14 border-b border-black/[0.08] dark:border-white/[0.08] bg-[#f8f8f7]/80 dark:bg-[#1a1a1b]/80 backdrop-blur-md sticky top-0 z-10`}>
      <div className="flex items-center gap-3 flex-1">
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-white dark:bg-[#272728] border border-black/[0.05] dark:border-white/[0.05] shadow-sm max-w-[400px] flex-1">
          <Globe className={`w-3.5 h-3.5 ${isConnected ? 'text-blue-500' : 'text-zinc-400'}`} />
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate">
            {isConnected ? 'browser.talos.ai' : 'No connection'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white dark:bg-[#272728] border border-black/[0.05] dark:border-white/[0.05] shadow-sm">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-400'}`}></div>
          <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
            {isConnected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>

        <div className="h-4 w-[1px] bg-black/[0.08] dark:border-white/[0.08]"></div>

        <div className="flex items-center gap-2">
          {isConnected && onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              className="h-8 w-8 p-0 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] rounded-full"
              title="Refresh browser view"
            >
              <RefreshCw className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
            </Button>
          )}
          {viewToggle && (
            <div className="scale-90">
              {viewToggle}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export function BrowserToolView({
  toolCall,
  toolResult,
  assistantTimestamp,
  toolTimestamp,
  isSuccess = true,
  isStreaming = false,
  agentStatus = 'idle',
  messages = [],
  viewToggle,
}: ToolViewProps) {
  const [showContext, setShowContext] = React.useState(false);
  const [imageLoading, setImageLoading] = React.useState(true);
  const [imageError, setImageError] = React.useState(false);
  const isRunning = isStreaming || agentStatus === 'running';

  const [progress, setProgress] = React.useState(100);

  React.useEffect(() => {
    if (isRunning) {
      setProgress(0);
      const timer = setInterval(() => {
        setProgress((prevProgress) => {
          if (prevProgress >= 95) {
            clearInterval(timer);
            return prevProgress;
          }
          return prevProgress + 2;
        });
      }, 500);
      return () => clearInterval(timer);
    } else {
      setProgress(100);
    }
  }, [isRunning]);

  const screenshotUrl = toolResult?.output?.image_url || null;
  const screenshotBase64 = toolResult?.output?.screenshot_base64 || null;
  React.useEffect(() => {
    if (screenshotUrl || screenshotBase64) {
      setImageLoading(true);
      setImageError(false);
    }
  }, [screenshotUrl, screenshotBase64]);

  if (!toolCall) {
    console.warn('BrowserToolView: toolCall is undefined. Tool views should use structured props.');
    return null;
  }

  const name = toolCall.function_name.replace(/_/g, '-').toLowerCase();
  const operation = extractBrowserOperation(name);
  const toolTitle = getToolTitle(name);

  const url = toolCall.arguments?.url || toolCall.arguments?.target_url || null;
  const parameters = toolCall.arguments || null;

  let browserStateMessageId: string | undefined;
  let screenshotUrlFinal: string | null = screenshotUrl;
  let screenshotBase64Final: string | null = screenshotBase64;
  let result: Record<string, any> | null = null;

  if (toolResult?.output) {
    const output = toolResult.output;
    
    if (typeof output === 'object' && output !== null) {
      if (output.image_url) {
        screenshotUrlFinal = output.image_url;
      }
      if (output.message_id) {
        browserStateMessageId = output.message_id;
      }
      result = Object.fromEntries(
        Object.entries(output).filter(([k]) => k !== 'message_id')
      ) as Record<string, any>;
    } else if (typeof output === 'string') {
      result = { message: output };
    }
  }

  if (!screenshotUrlFinal && !screenshotBase64Final && browserStateMessageId && messages.length > 0) {
    const browserStateMessage = messages.find(
      (msg) =>
        (msg.type as string) === 'browser_state' &&
        msg.message_id === browserStateMessageId,
    );

    if (browserStateMessage) {
      const browserStateContent = safeJsonParse<{
        screenshot_base64?: string;
        image_url?: string;
      }>(
        browserStateMessage.content,
        {},
      );
      screenshotBase64Final = browserStateContent?.screenshot_base64 || null;
      screenshotUrlFinal = browserStateContent?.image_url || null;
    }
  }

  const handleImageLoad = () => {
    setImageLoading(false);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageLoading(false);
    setImageError(true);
  };

  const renderScreenshot = () => {
    if (screenshotUrlFinal) {
      return (
        <div className="flex items-center justify-center w-full h-full min-h-[600px] relative p-4" style={{ minHeight: '600px' }}>
          {imageLoading && (
            <ImageLoader />
          )}
          <Card className={`p-0 overflow-hidden relative border ${imageLoading ? 'hidden' : 'block'}`}>
            <img
              src={screenshotUrlFinal}
              alt="Browser Screenshot"
              className="max-w-full max-h-full object-contain"
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
          </Card>
          {imageError && !imageLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
              <div className="text-center text-zinc-500 dark:text-zinc-400">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                <p>Failed to load screenshot</p>
              </div>
            </div>
          )}
        </div>
      );
    } else if (screenshotBase64Final) {
      return (
        <div className="flex items-center justify-center w-full h-full min-h-[600px] relative p-4" style={{ minHeight: '600px' }}>
          {imageLoading && (
            <ImageLoader />
          )}
          <Card className={`overflow-hidden border ${imageLoading ? 'hidden' : 'block'}`}>
            <img
              src={`data:image/jpeg;base64,${screenshotBase64Final}`}
              alt="Browser Screenshot"
              className="max-w-full max-h-full object-contain"
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
          </Card>
          {imageError && !imageLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
              <div className="text-center text-zinc-500 dark:text-zinc-400">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                <p>Failed to load screenshot</p>
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
      <div className="flex-1 overflow-hidden relative">
        <div className="flex-1 flex h-full items-center overflow-scroll bg-white dark:bg-zinc-950">
          {showContext && (result || parameters) ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {parameters && <JsonViewer
                data={parameters}
                title="INPUT"
                defaultExpanded={true}
              />}
              {result && <JsonViewer
                data={result}
                title="OUTPUT"
                defaultExpanded={true}
              />}
            </div>
          )
          :(screenshotUrlFinal || screenshotBase64Final) ? (
            renderScreenshot()
          ) : (
            <div className="p-8 flex flex-col items-center justify-center w-full bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-zinc-900 text-zinc-700 dark:text-zinc-400 min-h-600">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 bg-gradient-to-b from-purple-100 to-purple-50 shadow-inner dark:from-purple-800/40 dark:to-purple-900/60">
                <MonitorPlay className="h-10 w-10 text-purple-400 dark:text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
                {isRunning ? 'Browser action in progress' : 'Browser action completed'}
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 text-center">
                {isRunning 
                  ? 'Switch to the Browser tab to see the live browser view.'
                  : 'Screenshot will appear here when available.'}
              </p>
              {url && (
                <div className="mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-shadow"
                    asChild
                  >
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5 mr-2" />
                      Visit URL
                    </a>
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}