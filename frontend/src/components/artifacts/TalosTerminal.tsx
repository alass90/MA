import React, { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, Loader2, Send, XCircle } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { backendApi } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface TalosTerminalProps {
  sandboxId: string;
  theme?: string;
}

interface HistoryItem {
  type: 'cmd' | 'out' | 'err';
  content: string;
  timestamp: Date;
}

export function TalosTerminal({ sandboxId, theme }: TalosTerminalProps) {
  const [history, setHistory] = useState<HistoryItem[]>([
    { type: 'out', content: 'Connected to Daytona Sandbox. Welcome to Talos OS.', timestamp: new Date() }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [history, isLoading]);

  // Focus input on click anywhere in terminal
  const handleTerminalClick = () => {
    inputRef.current?.focus();
  };

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const cmd = input.trim();
    setInput('');
    setHistory(prev => [...prev, { type: 'cmd', content: cmd, timestamp: new Date() }]);
    setIsLoading(true);

    try {
      const response = await backendApi.post(`/sandboxes/${sandboxId}/terminal/execute`, {
        command: cmd
      });

      if (response.success && response.data) {
        setHistory(prev => [...prev, { type: 'out', content: response.data.output || 'Command executed.', timestamp: new Date() }]);
      } else {
        setHistory(prev => [...prev, { type: 'err', content: response.error?.message || 'Error executing command', timestamp: new Date() }]);
      }
    } catch (err: any) {
      setHistory(prev => [...prev, { type: 'err', content: 'Connection failure: Unable to reach sandbox.', timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className={cn(
        "flex flex-col h-full font-mono text-[13px] leading-relaxed select-text cursor-text transition-all duration-300",
        theme === 'dark' ? "bg-[#0d0d0d] text-[#e6e6e6]" : "bg-[#f8f9fa] text-[#1a1a1b]"
      )}
      onClick={handleTerminalClick}
    >
      <div className={cn(
        "flex items-center justify-between px-4 py-2 border-b",
        theme === 'dark' ? "border-white/5 bg-white/5" : "border-black/5 bg-black/5"
      )}>
        <div className="flex items-center gap-2">
          <TerminalIcon className={cn("w-4 h-4", theme === 'dark' ? "text-[#d38aea]" : "text-[#8e44ad]")} />
          <span className={cn(
            "text-[10px] font-bold uppercase tracking-[0.2em]",
            theme === 'dark' ? "text-white/40" : "text-black/40"
          )}>
            Daytona Terminal
          </span>
        </div>
        {isLoading && (
          <div className="flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin opacity-50" />
            <span className="text-[9px] font-medium opacity-40 uppercase">Syncing...</span>
          </div>
        )}
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-6 pb-20">
          {history.map((item, i) => (
            <div key={i} className="mb-4 animate-in fade-in slide-in-from-left-1 duration-300">
              {item.type === 'cmd' && (
                <div className="flex gap-3 items-start">
                  <span className={cn("font-bold shrink-0 mt-0.5", theme === 'dark' ? "text-[#d38aea]" : "text-[#8e44ad]")}>
                    root@talos:~ $
                  </span>
                  <span className="font-medium break-all">{item.content}</span>
                </div>
              )}
              {item.type === 'out' && (
                <div className={cn(
                  "mt-1 whitespace-pre-wrap rounded-lg p-3",
                  theme === 'dark' ? "bg-white/5 text-zinc-300 border border-white/5" : "bg-black/5 text-zinc-700 border border-black/5"
                )}>
                  {item.content}
                </div>
              )}
              {item.type === 'err' && (
                <div className="flex gap-2 items-center mt-2 px-3 py-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400">
                  <XCircle className="w-3 h-3 shrink-0" />
                  <span className="text-[12px] font-medium italic">{item.content}</span>
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-zinc-500 animate-pulse ml-1 mt-2">
              <span className={cn("font-bold", theme === 'dark' ? "text-[#d38aea]" : "text-[#8e44ad]")}>root@talos:~ $</span>
              <div className="w-2 h-4 bg-current animate-pulse opacity-50" />
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className={cn(
        "p-4 border-t transition-colors",
        theme === 'dark' ? "border-white/5 bg-white/5 focus-within:bg-white/10" : "border-black/5 bg-black/5 focus-within:bg-black/10"
      )}>
        <form onSubmit={handleExecute} className="flex gap-3 items-center">
          <span className={cn("font-bold shrink-0", theme === 'dark' ? "text-[#d38aea]" : "text-[#8e44ad]")}>
            root@talos:~ $
          </span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            className={cn(
              "flex-1 bg-transparent border-none outline-none font-mono text-[14px] placeholder:opacity-30",
              theme === 'dark' ? "text-white" : "text-black"
            )}
            placeholder="Type a command or 'help'..."
            autoFocus
          />
          <button 
            type="submit" 
            disabled={isLoading || !input.trim()} 
            className={cn(
              "p-2 rounded-lg transition-all active:scale-95 disabled:opacity-30",
              theme === 'dark' ? "hover:bg-white/10 text-[#d38aea]" : "hover:bg-black/10 text-[#8e44ad]"
            )}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
