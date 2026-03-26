'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Palette,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid,
  Layers,
  Sparkles,
  Wand2,
  ExternalLink,
  Lock,
  Unlock,
  X,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Toggle } from '@/components/ui/toggle';
import { useImageContent } from '@/hooks/files';
import { useDesignerStore, DesignElement } from '@/stores/use-designer-store';

interface DesignerPanelProps {
  sandboxId?: string;
  agentStatus?: string;
}

function DesignElementImage({ 
  element,
  isSelected
}: { 
  element: DesignElement;
  isSelected: boolean;
}) {
  const [imageError, setImageError] = useState(false);
  
  const { data: imageUrl, isLoading, error } = useImageContent(
    element.sandboxId,
    element.filePath,
    { 
      enabled: !element.directUrl && !imageError
    }
  );

  const finalUrl = element.directUrl || imageUrl;

  if (!element.directUrl && isLoading && !finalUrl) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-muted/50 animate-pulse rounded-lg">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!finalUrl || imageError || (!element.directUrl && error)) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full bg-muted/50 rounded-lg">
        <AlertTriangle className="h-8 w-8 text-muted-foreground mb-2" />
        <span className="text-xs text-muted-foreground text-center px-2">
          {element.name}
        </span>
      </div>
    );
  }

  return (
    <img
      src={finalUrl}
      alt={element.name}
      className="w-full h-full object-contain"
      style={{ borderRadius: 'inherit' }}
      draggable={false}
      onError={() => setImageError(true)}
      loading="eager"
    />
  );
}

export function DesignerPanel({
  sandboxId,
  agentStatus,
}: DesignerPanelProps) {
  const { 
    isOpen, 
    closePanel, 
    elements, 
    updateElement, 
    setElements 
  } = useDesignerStore();
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedElement, setDraggedElement] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [elementStart, setElementStart] = useState({ x: 0, y: 0 });
  const [canvasScale, setCanvasScale] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [canvasOffsetStart, setCanvasOffsetStart] = useState({ x: 0, y: 0 });
  
  const gridSize = 20;
  const isWorking = agentStatus === 'running';

  if (!isOpen) return null;

  const snapToGridValue = (value: number) => {
    if (!snapToGrid) return value;
    return Math.round(value / gridSize) * gridSize;
  };

  const handleElementMouseDown = (e: React.MouseEvent, elementId: string) => {
    e.stopPropagation();
    const element = elements.find(el => el.id === elementId);
    if (!element || element.locked) return;

    setSelectedElement(elementId);
    setDraggedElement(elementId);
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setElementStart({ x: element.x, y: element.y });
    e.preventDefault();
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains('canvas-content')) {
      if (e.button === 0 || e.button === 1) {
        setIsPanning(true);
        setPanStart({ x: e.clientX, y: e.clientY });
        setCanvasOffsetStart({ ...canvasOffset });
        e.preventDefault();
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && draggedElement) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;

      updateElement(draggedElement, {
        x: snapToGridValue(elementStart.x + deltaX / canvasScale),
        y: snapToGridValue(elementStart.y + deltaY / canvasScale),
      });
    } else if (isPanning) {
      const deltaX = e.clientX - panStart.x;
      const deltaY = e.clientY - panStart.y;

      setCanvasOffset({
        x: canvasOffsetStart.x + deltaX,
        y: canvasOffsetStart.y + deltaY,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggedElement(null);
    setIsPanning(false);
  };

  const handleZoomIn = () => setCanvasScale(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setCanvasScale(prev => Math.max(prev - 0.1, 0.5));
  const handleResetView = () => {
    setCanvasScale(1);
    setCanvasOffset({ x: 0, y: 0 });
  };

  const handleDownload = () => {
    const element = elements.find(el => el.id === selectedElement);
    if (element?.directUrl || element?.filePath) {
      const link = document.createElement('a');
      link.href = element.directUrl || `/api/sandbox/${element.sandboxId}/file?path=${encodeURIComponent(element.filePath)}`;
      link.download = element.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden relative z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0 bg-muted/10">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-purple-500 rounded-lg">
            <Palette className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight">Designer Canvas</h2>
            <div className="flex items-center gap-2 mt-0.5">
               {isWorking ? (
                <Badge variant="outline" className="h-4 text-[9px] uppercase tracking-wider animate-pulse border-purple-100 text-purple-600 bg-purple-50/30 px-1">
                   Processing
                </Badge>
               ) : (
                <span className="text-[10px] text-muted-foreground font-medium">Ready to design</span>
               )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <TooltipProvider>
            <div className="flex items-center bg-muted/40 p-0.5 rounded-lg border border-border/30">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleZoomOut} className="h-8 w-8 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom Out</TooltipContent>
              </Tooltip>

              <span className="text-[11px] font-bold px-1 min-w-[40px] text-center text-zinc-500">
                {Math.round(canvasScale * 100)}%
              </span>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleZoomIn} className="h-8 w-8 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom In</TooltipContent>
              </Tooltip>

              <div className="w-[1px] h-4 bg-zinc-200 dark:bg-zinc-800 mx-1" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleResetView} className="h-8 w-8 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset View</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>

          <div className="w-px h-4 bg-border/40 mx-1" />
          
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50" onClick={closePanel}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Canvas Area */}
        <div 
          ref={canvasRef}
          className={cn(
            "flex-1 relative overflow-hidden bg-zinc-50 dark:bg-zinc-950",
            isPanning && "cursor-grab active:cursor-grabbing"
          )}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {showGrid && (
            <div className="absolute inset-0 pointer-events-none opacity-20"
              style={{
                backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent ${gridSize - 1}px, currentColor ${gridSize}px),
                                  repeating-linear-gradient(90deg, transparent, transparent ${gridSize - 1}px, currentColor ${gridSize}px)`,
                backgroundSize: `${gridSize}px ${gridSize}px`,
              }}
            />
          )}

          <div
            className="absolute canvas-content"
            style={{
              transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasScale})`,
              transformOrigin: '0 0',
              width: '5000px',
              height: '5000px',
            }}
          >
            {elements.map((element) => (
              <div
                key={element.id}
                className={cn(
                  "absolute cursor-move select-none rounded-lg group shadow-sm hover:shadow-md transition-shadow",
                  element.locked && "cursor-not-allowed opacity-70"
                )}
                style={{
                  left: `${element.x}px`,
                  top: `${element.y}px`,
                  width: `${element.width}px`,
                  height: `${element.height}px`,
                  transform: `rotate(${element.rotation}deg)`,
                  zIndex: selectedElement === element.id ? 999 : element.zIndex + 10,
                  opacity: element.opacity / 100,
                  boxSizing: 'border-box',
                  outline: selectedElement === element.id ? '2px solid rgb(168 85 247)' : '1px solid rgba(0,0,0,0.05)',
                  outlineOffset: '2px',
                }}
                onMouseDown={(e) => handleElementMouseDown(e, element.id)}
                onClick={() => setSelectedElement(element.id)}
              >
                <DesignElementImage
                  element={element}
                  isSelected={selectedElement === element.id}
                />
                
                {selectedElement === element.id && !element.locked && (
                  <>
                    <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-purple-500 rounded-sm cursor-nw-resize z-10" />
                    <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-purple-500 rounded-sm cursor-ne-resize z-10" />
                    <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-purple-500 rounded-sm cursor-sw-resize z-10" />
                    <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-purple-500 rounded-sm cursor-se-resize z-10" />
                  </>
                )}
                
                <div className="absolute -top-6 left-0 px-2 py-0.5 bg-purple-500 text-white text-[10px] font-bold rounded-t opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                   {element.name}
                </div>
              </div>
            ))}

            {elements.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ width: '100vw', height: '100vh', left: -canvasOffset.x/canvasScale, top: -canvasOffset.y/canvasScale }}>
                <div className="w-20 h-20 rounded-3xl bg-purple-50 dark:bg-purple-900/10 flex items-center justify-center mb-6 border border-purple-100 dark:border-purple-900/20">
                   <Sparkles className="w-10 h-10 text-purple-400" />
                </div>
                <h3 className="text-xl font-bold tracking-tight mb-2">Empty Canvas</h3>
                <p className="text-sm text-muted-foreground max-w-xs text-center">
                  Use the designer tool to generate designs. They will appear here automatically.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Controls */}
        <div className="w-72 border-l bg-background flex flex-col shrink-0">
          <div className="p-4 border-b flex items-center justify-between bg-muted/5">
             <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
               <Layers className="w-3.5 h-3.5" />
               Properties
             </h3>
             <Toggle 
              size="sm" 
              pressed={showGrid} 
              onPressedChange={setShowGrid}
              className="h-7 w-7 rounded-md"
             >
                <Grid className="w-3.5 h-3.5" />
             </Toggle>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
            {selectedElement && elements.find(el => el.id === selectedElement) ? (() => {
               const element = elements.find(el => el.id === selectedElement)!;
               return (
                <div className="space-y-6">
                  {/* Position & Size */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground">X Position</label>
                        <input 
                          type="number" 
                          value={Math.round(element.x)} 
                          onChange={e => updateElement(element.id, { x: Number(e.target.value) })}
                          className="w-full bg-muted/40 border-0 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground">Y Position</label>
                        <input 
                          type="number" 
                          value={Math.round(element.y)} 
                          onChange={e => updateElement(element.id, { y: Number(e.target.value) })}
                          className="w-full bg-muted/40 border-0 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground">Width</label>
                        <input 
                          type="number" 
                          value={Math.round(element.width)} 
                          onChange={e => updateElement(element.id, { width: Number(e.target.value) })}
                          className="w-full bg-muted/40 border-0 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground">Height</label>
                        <input 
                          type="number" 
                          value={Math.round(element.height)} 
                          onChange={e => updateElement(element.id, { height: Number(e.target.value) })}
                          className="w-full bg-muted/40 border-0 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Appearance */}
                  <div className="space-y-4 pt-2">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground">Rotation</label>
                        <span className="text-[11px] font-mono bg-muted px-1.5 py-0.5 rounded">{element.rotation}°</span>
                      </div>
                      <Slider
                        value={[element.rotation]}
                        onValueChange={([v]) => updateElement(element.id, { rotation: v })}
                        min={-180}
                        max={180}
                        step={1}
                        className="py-1"
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground">Opacity</label>
                        <span className="text-[11px] font-mono bg-muted px-1.5 py-0.5 rounded">{element.opacity}%</span>
                      </div>
                      <Slider
                        value={[element.opacity]}
                        onValueChange={([v]) => updateElement(element.id, { opacity: v })}
                        min={0}
                        max={100}
                        step={1}
                        className="py-1"
                      />
                    </div>
                  </div>

                  <div className="pt-4 flex flex-col gap-2">
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-9 rounded-lg" onClick={handleDownload}>
                      <Download className="w-4 h-4" /> Download Design
                    </Button>
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-9 rounded-lg" onClick={() => {
                        const url = element.directUrl || `/api/sandbox/${element.sandboxId}/file?path=${encodeURIComponent(element.filePath)}`;
                        window.open(url, '_blank');
                    }}>
                      <ExternalLink className="w-4 h-4" /> Open Original
                    </Button>
                    <div className="pt-2">
                       <Button 
                        variant={element.locked ? "secondary" : "ghost"} 
                        size="sm" 
                        className={cn("w-full justify-between h-9 rounded-lg px-3", element.locked && "bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800")}
                        onClick={() => updateElement(element.id, { locked: !element.locked })}
                       >
                         <span className="text-xs font-semibold">{element.locked ? "Locked" : "Unlocked"}</span>
                         {element.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                       </Button>
                    </div>
                  </div>
                </div>
               );
            })() : (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 opacity-40 py-12">
                 <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-4">
                    <Layers className="w-6 h-6" />
                 </div>
                 <p className="text-xs font-medium">Select an artboard on the canvas to edit its properties</p>
              </div>
            )}
          </div>

          {/* Elements List Footer */}
          <div className="p-4 border-t bg-muted/5 max-h-48 flex flex-col">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Artboards ({elements.length})</h4>
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
              {elements.map((el, i) => (
                <div 
                  key={el.id}
                  onClick={() => setSelectedElement(el.id)}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all border",
                    selectedElement === el.id ? "bg-purple-50 border-purple-200 dark:bg-purple-900/20" : "hover:bg-muted border-transparent"
                  )}
                >
                  <div className="w-8 h-8 rounded bg-white flex items-center justify-center border shrink-0 overflow-hidden">
                     <DesignElementImage element={el} isSelected={false} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs truncate font-medium", selectedElement === el.id ? "text-purple-700" : "text-foreground")}>
                      {el.name}
                    </p>
                    <p className="text-[9px] text-muted-foreground">{el.width} × {el.height}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
