'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  RefreshCw,
  ExternalLink,
  X,
  Smartphone,
  Copy,
  Check,
  Wifi,
  Share2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useMobileBuilderStore } from '@/stores/use-mobile-builder-store';
import { QRCodeSVG } from 'qrcode.react';

/* ============================================================
   Phone Frame Component — iPhone 15 style
   ============================================================ */
function PhoneFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div className="relative">
        {/* Outer phone body */}
        <div
          className="relative bg-zinc-950 rounded-[3rem] p-[10px] shadow-2xl"
          style={{ width: 320, height: 650 }}
        >
          {/* Dynamic Island */}
          <div className="absolute top-[14px] left-1/2 -translate-x-1/2 z-30 w-[100px] h-[28px] bg-black rounded-full" />

          {/* Status bar */}
          <div className="absolute top-[14px] left-[30px] right-[30px] z-20 flex justify-between items-center px-4 pt-[6px]">
            <span className="text-white text-[11px] font-semibold">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <div className="flex items-center gap-1" />
          </div>

          {/* Screen */}
          <div className="w-full h-full bg-white rounded-[2.3rem] overflow-hidden relative">
            {children}
          </div>

          {/* Bottom bar / Home indicator */}
          <div className="absolute bottom-[8px] left-1/2 -translate-x-1/2 w-[120px] h-[4px] bg-zinc-600 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Generating Animation 
   ============================================================ */
function GeneratingOverlay() {
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-sm">
      <div className="relative w-16 h-16 mb-6">
        {/* Pulsing rings */}
        <div className="absolute inset-0 rounded-full border-2 border-emerald-400/30 animate-ping" />
        <div className="absolute inset-2 rounded-full border-2 border-emerald-400/50 animate-ping" style={{ animationDelay: '0.3s' }} />
        <div className="absolute inset-0 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <Smartphone className="w-7 h-7 text-emerald-400 animate-pulse" />
        </div>
      </div>
      <p className="text-white font-semibold text-sm">Building your app...</p>
      <p className="text-white/50 text-xs mt-1">This may take a moment</p>
    </div>
  );
}

/* ============================================================
   Main Panel
   ============================================================ */
interface MobileBuilderPanelProps {
  sandboxId?: string;
  agentStatus?: string;
}

export function MobileBuilderPanel({
  sandboxId,
  agentStatus,
}: MobileBuilderPanelProps) {
  const {
    isOpen,
    closePanel,
    webPreviewUrl,
    expoUrl,
    qrData,
    projectName,
    isGenerating,
  } = useMobileBuilderStore();

  const [iframeSrc, setIframeSrc] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  const isWorking = agentStatus === 'running';

  // Update iframe when preview URL changes
  useEffect(() => {
    if (webPreviewUrl) {
      setIframeSrc(webPreviewUrl);
    }
  }, [webPreviewUrl]);

  const handleRefresh = useCallback(() => {
    if (iframeSrc) {
      const url = iframeSrc;
      setIframeSrc('');
      setTimeout(() => setIframeSrc(url), 100);
    }
  }, [iframeSrc]);

  const handleCopyUrl = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    } catch {}
  }, []);

  const handleCopyExpoUrl = useCallback(async () => {
    if (!expoUrl) return;
    try {
      await navigator.clipboard.writeText(expoUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [expoUrl]);

  if (!isOpen) return null;

  const displayQrData = qrData || expoUrl || webPreviewUrl;

  return (
    <div className="h-full w-full bg-background flex flex-col overflow-hidden border-l border-border/30">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border/30 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Smartphone className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground leading-none">
              {projectName || 'Mobile App'}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              {isWorking ? (
                <Badge className="bg-amber-500/10 text-amber-600 border-none px-1.5 py-0 text-[9px] font-bold rounded-md flex items-center gap-1">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  Generating
                </Badge>
              ) : webPreviewUrl ? (
                <Badge className="bg-emerald-500/10 text-emerald-600 border-none px-1.5 py-0 text-[9px] font-bold rounded-md flex items-center gap-1">
                  <Wifi className="w-2.5 h-2.5" />
                  Live
                </Badge>
              ) : (
                <Badge className="bg-zinc-500/10 text-zinc-500 border-none px-1.5 py-0 text-[9px] font-bold rounded-md">
                  Waiting
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-lg"
                  onClick={handleRefresh}
                  disabled={!iframeSrc}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh preview</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-lg"
                  onClick={() => webPreviewUrl && window.open(webPreviewUrl, '_blank')}
                  disabled={!webPreviewUrl}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open in new tab</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 rounded-lg hover:bg-red-500/10 hover:text-red-500"
            onClick={closePanel}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Phone Preview — Center */}
        <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-900 dark:to-zinc-950 relative p-6">
          {(isWorking && !webPreviewUrl) && <GeneratingOverlay />}

          <PhoneFrame>
            {iframeSrc ? (
              <iframe
                src={iframeSrc}
                className="w-full h-full border-0"
                title="Mobile App Preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                allow="clipboard-write"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-900 px-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-4">
                  <Smartphone className="w-7 h-7 text-emerald-500" />
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">No preview yet</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Ask the AI to build a mobile app and the preview will appear here automatically.
                </p>
              </div>
            )}
          </PhoneFrame>
        </div>

        {/* Right Sidebar — QR Code & Info */}
        <div className="w-[280px] flex-shrink-0 border-l border-border/30 bg-background flex flex-col p-5 gap-6 overflow-y-auto">
          {/* QR Code Section */}
          <div>
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">
              Preview on your phone
            </h4>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-border/40 p-5 flex items-center justify-center shadow-sm">
              {displayQrData ? (
                <QRCodeSVG
                  value={displayQrData}
                  size={180}
                  bgColor="transparent"
                  fgColor="currentColor"
                  className="text-foreground"
                  level="M"
                  includeMargin={false}
                />
              ) : (
                <div className="w-[180px] h-[180px] flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-xl bg-muted/40 flex items-center justify-center mx-auto mb-2">
                      <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                    </div>
                    <p className="text-[10px] text-muted-foreground">Waiting for server...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* URL */}
          {(expoUrl || webPreviewUrl) && (
            <div>
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                Preview URL
              </h4>
              <div
                className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2 border border-border/30 cursor-pointer hover:bg-muted/50 transition-colors group"
                onClick={() => handleCopyUrl(expoUrl || webPreviewUrl || '')}
              >
                <span className="text-xs text-muted-foreground truncate flex-1 font-mono">
                  {(expoUrl || webPreviewUrl || '').slice(0, 35)}...
                </span>
                {urlCopied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
            </div>
          )}

          {/* Expo Go Info */}
          <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-4 border border-amber-200/40 dark:border-amber-800/20">
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-md bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Smartphone className="w-3 h-3 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-400 mb-0.5">
                  Expo Go Required
                </p>
                <p className="text-[10px] text-amber-700/70 dark:text-amber-500/60 leading-relaxed">
                  Some features aren&apos;t available in the browser. For the full experience, preview your app on your phone using the Expo Go app.
                </p>
              </div>
            </div>
          </div>

          {/* Share Button */}
          {webPreviewUrl && (
            <Button
              variant="outline"
              size="sm"
              className="w-full h-9 rounded-xl border-border/40 font-bold text-xs gap-2"
              onClick={handleCopyExpoUrl}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  Share Preview Link
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
