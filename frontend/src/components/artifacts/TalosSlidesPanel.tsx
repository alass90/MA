'use client';

/**
 * TalosSlidesPanel.tsx
 * ─────────────────────────────────────────────────────────────
 * Viewer/Editor de présentation Talos — converti depuis le
 * design de référence (talos-slide-editor.html).
 *
 * Stack : React + Tailwind CSS (pas de lib externe)
 * Layout : 3 colonnes (strip 172px | stage flex-1 | panel 244px)
 *          + topbar 48px + notes 100px en bas
 *
 * Intégration :
 *   - Slides HTML servies via /api/sandbox/[id]/file?path=&raw=true
 *   - metadata.json → ordre + titres + notes
 *   - Sauvegarde via POST /api/sandbox/[id]/presentation/save
 *   - Ouverture pilotée par use-presentation-panel-store (Zustand)
 * ─────────────────────────────────────────────────────────────
 */

import React, { useEffect, useRef, useState, useCallback, DragEvent } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Type, 
  Save, 
  Maximize2, 
  Minimize2, 
  X, 
  Plus, 
  Trash2, 
  Copy,
  Monitor,
  GripVertical,
  Check,
  Bold,
  Italic,
  Underline,
  Loader2,
  Settings2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────

export interface SlideMetadata {
  id: string;
  index: number;
  title: string;
  path: string;
  notes?: string;
}

export interface PresentationMetadata {
  title: string;
  theme?: string;
  slides: Record<string, any>; // Backend format is a map or array
}

interface TalosSlidesPanelProps {
  sandboxId: string;
  presentationPath: string; // e.g. "/workspace/presentations/my-deck"
  onClose?: () => void;
}

type EditMode = "view" | "edit";

// ─── Palette de couleurs (référence design) ───────────────────

const BG_SWATCHES = [
  "#ffffff", "#010101", "#1a1a2e", "#0f0f23",
  "#f5f4f2", "#ede9ff", "#e8f4ed", "#fff7ed",
  "#fef2f2", "#e6f1fb",
];

const ACCENT_SWATCHES = [
  "#5B4FE8", "#010101", "#e24b4a", "#1D9E75",
  "#BA7517", "#185FA5", "#D4537E", "#D85A30",
  "#639922", "#888780",
];

// ─── Composant principal ──────────────────────────────────────

export function TalosSlidesPanel({
  sandboxId,
  presentationPath,
  onClose,
}: TalosSlidesPanelProps) {
  // ── States ────────────────────────────────────────────────
  const [slides, setSlides] = useState<SlideMetadata[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [cur, setCur] = useState(0);
  const [editMode, setEditMode] = useState<EditMode>("view");
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [dragSrc, setDragSrc] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [scale, setScale] = useState(1);

  // Couleurs éditables par slide (simulées pour le moment)
  const [slideBg, setSlideBg] = useState<Record<string, string>>({});
  const [slideAc, setSlideAc] = useState<Record<string, string>>({});

  // Refs
  const stageRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const htmlCache = useRef<Record<string, string>>({}); // slidePath -> htmlContent

  const currentSlide = slides[cur] ?? null;

  // ── Helpers API ───────────────────────────────────────────
  const getFileUrl = (path: string, raw = false) => 
    `/api/sandbox/${sandboxId}/file?path=${encodeURIComponent(path)}${raw ? "&raw=true" : ""}`;

  const loadMetadata = useCallback(async () => {
    try {
      setIsLoading(true);
      const metadataPath = `${presentationPath}/metadata.json`;
      const response = await fetch(getFileUrl(metadataPath));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      let metaData: any;
      if (typeof data.content === 'string') {
        metaData = JSON.parse(data.content);
      } else {
        metaData = data;
      }
      setMeta(metaData);

      // Convert map/array to sorted array
      const slidesArray: SlideMetadata[] = Object.entries(metaData.slides || {})
        .map(([key, value]: [string, any]) => ({
          id: value.id || `slide-${key}`,
          index: parseInt(key) - 1,
          title: value.title || `Slide ${key}`,
          path: value.file_path || value.path,
          notes: value.notes || "",
        }))
        .sort((a, b) => a.index - b.index);

      setSlides(slidesArray);
      
      // Init notes
      const initialNotes: Record<string, string> = {};
      slidesArray.forEach(s => { initialNotes[s.id] = s.notes || ""; });
      setNotes(initialNotes);

    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur chargement");
      toast.error("Impossible de charger la présentation");
    } finally {
      setIsLoading(false);
    }
  }, [sandboxId, presentationPath]);

  useEffect(() => { loadMetadata(); }, [loadMetadata]);

  // ── Auto-scale ResizeObserver ─────────────────────────────
  useEffect(() => {
    const compute = () => {
      if (!stageRef.current) return;
      const { width, height } = stageRef.current.getBoundingClientRect();
      // Design reference padding: 48px
      const calculatedScale = Math.min((width - 48) / 1920, (height - 48) / 1080);
      setScale(calculatedScale);
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (stageRef.current) ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, [isFullscreen, isLoading]);

  // ── Navigation clavier ────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const typing = document.activeElement &&
        (document.activeElement.isContentEditable ||
         ["TEXTAREA", "INPUT"].includes((document.activeElement as HTMLElement).tagName));
      
      if (e.key === "Escape" && isFullscreen) { setIsFullscreen(false); return; }
      
      if (!typing) {
        if (e.key === "ArrowRight" || e.key === "ArrowDown")
          setCur(i => Math.min(i + 1, slides.length - 1));
        if (e.key === "ArrowLeft" || e.key === "ArrowUp")
          setCur(i => Math.max(i - 1, 0));
        if (e.key === "f") setIsFullscreen(f => !f);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [slides.length, isFullscreen]);

  // ── Edit inline ───────────────────────────────────────────
  const enableEditing = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    doc.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6,p,span,li,td,th").forEach(el => {
      el.contentEditable = "true";
      el.style.outline = "none";
      el.style.cursor = "text";
      el.addEventListener("focus", () => {
        el.style.boxShadow = "0 0 0 2px rgba(91,79,232,.5)";
        el.style.borderRadius = "2px";
      });
      el.addEventListener("blur", () => {
        el.style.boxShadow = "";
        if (currentSlide) {
          htmlCache.current[currentSlide.path] = doc.documentElement.outerHTML;
          setIsDirty(true);
        }
      });
    });
  }, [currentSlide]);

  const disableEditing = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    doc.querySelectorAll<HTMLElement>("[contenteditable]").forEach(el => {
      el.contentEditable = "false";
      el.style.cursor = "";
      el.style.boxShadow = "";
    });
  }, []);

  useEffect(() => {
    if (editMode === "edit") enableEditing();
    else disableEditing();
  }, [editMode, currentSlide, enableEditing, disableEditing]);

  // ── Drag & drop ───────────────────────────────────────────
  const onDragStart = (e: DragEvent, i: number) => {
    setDragSrc(i);
    setCur(i);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (e: DragEvent, i: number) => { 
    e.preventDefault(); 
    setDragOver(i); 
  };
  const onDrop = (e: DragEvent, to: number) => {
    e.preventDefault();
    if (dragSrc === null || dragSrc === to) { 
      setDragSrc(null); 
      setDragOver(null); 
      return; 
    }
    const next = [...slides];
    const [moved] = next.splice(dragSrc, 1);
    next.splice(to, 0, moved);
    setSlides(next.map((s, i) => ({ ...s, index: i })));
    setCur(to);
    setDragSrc(null);
    setDragOver(null);
    setIsDirty(true);
  };

  // ── Save ──────────────────────────────────────────────────
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        presentationPath,
        title: meta?.title || "Presentation",
        slides: slides.map((s, idx) => ({
          ...s,
          index: idx,
          notes: notes[s.id] || s.notes || "",
          htmlContent: htmlCache.current[s.path] || null // Send content only if cached/modified
        }))
      };

      const response = await fetch(`/api/sandbox/${sandboxId}/presentation/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) throw new Error("Save failed");
      
      setIsDirty(false);
      toast.success("Présentation sauvegardée");
    } catch (e) {
      console.error("[TalosSlidesPanel] save error:", e);
      toast.error("Erreur de sauvegarde");
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Loading / Error ──────────────────────────────────────

  if (isLoading) return (
    <div className="fixed inset-0 z-[1000] bg-background flex items-center justify-center gap-3">
      <div className="w-2 h-2 rounded-full bg-[#5B4FE8] animate-pulse" />
      <span className="text-xs text-muted-foreground">Chargement de la présentation...</span>
    </div>
  );

  if (error) return (
    <div className="fixed inset-0 z-[1000] bg-background flex items-center justify-center text-destructive text-xs">
      {error}
    </div>
  );

  // ─── Mode plein écran ──────────────────────────────────────

  if (isFullscreen) return (
    <div className="fixed inset-0 bg-black z-[2000] flex items-center justify-center">
      <iframe
        src={getFileUrl(currentSlide?.path || "", true)}
        className="w-screen border-none"
        style={{ height: "56.25vw", maxHeight: "100vh", maxWidth: "177.78vh" }}
        title="fullscreen"
        sandbox="allow-scripts allow-same-origin"
      />
      {/* Controls Overlay */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-md rounded-3xl px-4 py-2 border border-white/10">
        <button
          onClick={() => setCur(i => Math.max(i - 1, 0))}
          className="text-white/65 hover:text-white text-sm bg-transparent border-none cursor-pointer px-1"
        >←</button>
        <span className="text-white/50 font-mono text-[10px] min-w-[36px] text-center">
          {cur + 1} / {slides.length}
        </span>
        <button
          onClick={() => setCur(i => Math.min(i + 1, slides.length - 1))}
          className="text-white/65 hover:text-white text-sm bg-transparent border-none cursor-pointer px-1"
        >→</button>
      </div>
      <button
        onClick={() => setIsFullscreen(false)}
        className="fixed top-4 right-4 bg-white/15 hover:bg-white/25 text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer border-none backdrop-blur-md transition-colors"
      >
        ✕ Exit
      </button>
    </div>
  );

  // ─── Mode normal (Structure 3 colonnes) ────────────────────

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col w-full h-full bg-background text-foreground overflow-hidden font-sans border-t border-border">
      
      {/* ── 1. Topbar (48px) ── */}
      <div className="flex items-center h-12 min-h-[48px] border-b border-border bg-card/10 backdrop-blur-xl px-4 gap-0 shrink-0">
        {/* Brand */}
        <div className="text-[13px] font-black tracking-[3px] pr-4 border-r border-border shrink-0 text-primary">
          TALOS
        </div>

        {/* Presentation Title */}
        <div
          contentEditable
          suppressContentEditableWarning
          className="text-[11px] text-muted-foreground px-4 flex-1 overflow-hidden whitespace-nowrap text-ellipsis cursor-text focus:outline-none focus:text-foreground italic"
        >
          {meta?.title || "Sans titre"}
        </div>

        {/* View/Edit Mode Toggles */}
        <div className="flex gap-1 px-3 border-l border-r border-border shrink-0 h-full items-center">
          {(["view", "edit"] as EditMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setEditMode(mode)}
              className={cn(
                "text-[10px] uppercase tracking-widest font-bold px-3 py-1.5 rounded transition-all border-none cursor-pointer",
                editMode === mode 
                  ? "bg-[#5B4FE8]/10 text-[#5B4FE8]" 
                  : "bg-transparent text-muted-foreground hover:bg-muted"
              )}
            >
              {mode}
            </button>
          ))}
          <button
            onClick={() => setIsFullscreen(true)}
            className="text-[10px] uppercase tracking-widest font-bold px-3 py-1.5 rounded bg-transparent text-muted-foreground hover:bg-muted cursor-pointer transition-all border-none"
          >
            Present
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3 pl-4 shrink-0">
          {isDirty && (
            <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
          )}
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 text-[10px] font-bold px-3 border-border bg-transparent hover:bg-muted transition-all uppercase tracking-wider"
          >
            Export .pptx
          </Button>
          {isDirty && (
            <Button
              onClick={handleSave}
              disabled={isSaving}
              size="sm"
              className="h-7 text-[10px] font-bold px-4 rounded bg-primary text-primary-foreground hover:opacity-90 transition-all uppercase tracking-widest"
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── 2. Middle Section (Strip | Stage | Panel) ── */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* ── Strip gauche (172px) ── */}
        <div className="w-[172px] shrink-0 border-r border-border bg-sidebar/30 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1">
            <div className="p-2.5 space-y-3">
              {slides.map((slide, i) => (
                <div
                  key={slide.id}
                  draggable
                  onDragStart={e => onDragStart(e, i)}
                  onDragOver={e => onDragOver(e, i)}
                  onDrop={e => onDrop(e, i)}
                  onClick={() => setCur(i)}
                  className={cn(
                    "cursor-pointer rounded-md border-2 transition-all group relative overflow-hidden bg-card/20",
                    i === cur ? "border-[#5B4FE8] ring-4 ring-[#5B4FE8]/10" : "border-transparent hover:border-border",
                    dragSrc === i && "opacity-30 border-dashed"
                  )}
                >
                  <div className="aspect-video relative overflow-hidden">
                    <iframe
                      src={getFileUrl(slide.path, true)}
                      className="w-full h-full pointer-events-none origin-top-left"
                      style={{ 
                        width: 560, height: 315, 
                        transform: "scale(0.3)", 
                        border: "none" 
                      }}
                      sandbox="allow-scripts allow-same-origin"
                    />
                    <div className="absolute top-1 left-1 bg-black/40 backdrop-blur-sm text-[8px] font-mono px-1 rounded text-white min-w-[16px] text-center">
                      {String(i + 1).padStart(2, '0')}
                    </div>
                  </div>
                  <div className="px-2 py-1.5 border-t border-border flex items-center justify-between">
                    <span className="text-[9px] font-medium text-muted-foreground truncate flex-1 pr-2">
                       {slide.title}
                    </span>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        if (slides.length <= 1) return;
                        const next = slides.filter((_, j) => j !== i).map((s, j) => ({ ...s, index: j }));
                        setSlides(next);
                        setCur(Math.min(cur, next.length - 1));
                        setIsDirty(true);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              ))}
              <Button 
                variant="outline"
                className="w-full aspect-video border-dashed border-border bg-transparent hover:bg-muted text-muted-foreground/50 flex flex-col gap-1 rounded-md h-auto py-4"
              >
                <Plus className="w-4 h-4" />
                <span className="text-[9px] uppercase tracking-widest font-bold">Add Slide</span>
              </Button>
            </div>
          </ScrollArea>
        </div>

        {/* ── Canvas (Stage) flex-1 ── */}
        <div ref={stageRef} className="flex-1 bg-muted/40 relative flex items-center justify-center overflow-hidden p-6 group">
          {/* Zoom Indicator */}
          <div className="absolute top-4 left-4 text-[10px] font-mono text-muted-foreground/40 pointer-events-none">
            {Math.round(scale * 100)}% ZOOM
          </div>

          {/* Presentation Button Floating */}
          <Button 
            onClick={() => setIsFullscreen(true)}
            variant="secondary"
            className="absolute top-4 right-4 h-8 gap-2 bg-background/50 backdrop-blur hover:bg-background border border-border shadow-sm opacity-0 group-hover:opacity-100 transition-all z-20"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Present</span>
          </Button>

          {/* Actual Stage */}
          <div
            className="rounded shadow-2xl overflow-hidden ring-1 ring-border bg-white"
            style={{
              width: 1920 * scale,
              height: 1080 * scale,
              position: 'relative'
            }}
          >
            {currentSlide && (
              <iframe
                ref={iframeRef}
                srcDoc={htmlCache.current[currentSlide.path] || ''}
                src={!htmlCache.current[currentSlide.path] ? getFileUrl(currentSlide.path, true) : undefined}
                className="border-none w-full h-full block"
                style={{ 
                  transform: `scale(${scale})`, 
                  transformOrigin: '0 0',
                  width: 1920,
                  height: 1080
                }}
                sandbox="allow-scripts allow-same-origin"
                onLoad={() => {
                  if (editMode === "edit") enableEditing();
                }}
              />
            )}
            
            {/* Editor Badge */}
            {editMode === "edit" && (
              <div className="absolute top-3 left-3 bg-[#5B4FE8] text-white px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg pointer-events-none z-10">
                Editing Mode
              </div>
            )}
          </div>

          {/* Floating Navigation Bar */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center bg-background/80 backdrop-blur-md rounded-full px-4 py-2 border border-border shadow-xl opacity-0 hover:opacity-100 focus-within:opacity-100 transition-all z-30">
            <button
               onClick={() => setCur(i => Math.max(i - 1, 0))}
               disabled={cur === 0}
               className="text-foreground/50 hover:text-foreground hover:bg-muted p-1 rounded-full disabled:opacity-20 transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="px-4 text-[10px] font-mono font-bold text-foreground/40 whitespace-nowrap">
               {cur + 1} / {slides.length}
            </div>
            <button
               onClick={() => setCur(i => Math.min(i + 1, slides.length - 1))}
               disabled={cur === slides.length - 1}
               className="text-foreground/50 hover:text-foreground hover:bg-muted p-1 rounded-full disabled:opacity-20 transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Right Panel (244px) ── */}
        <div className="w-[244px] shrink-0 border-l border-border bg-card/20 flex flex-col overflow-y-auto">
          {/* Background Colors Swatches */}
          <div className="p-4 border-b border-border">
            <div className="text-[9px] font-bold uppercase tracking-[2px] text-muted-foreground/60 mb-3">Background</div>
            <div className="grid grid-cols-5 gap-2">
              {BG_SWATCHES.map(color => (
                <div
                  key={color}
                  onClick={() => {
                    setSlideBg(prev => ({ ...prev, [currentSlide.id]: color }));
                    setIsDirty(true);
                  }}
                  className={cn(
                    "aspect-square rounded shadow-sm cursor-pointer border-2 transition-transform hover:scale-110",
                    slideBg[currentSlide?.id] === color ? "border-primary" : "border-transparent"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Accent Color Swatches */}
          <div className="p-4 border-b border-border">
            <div className="text-[9px] font-bold uppercase tracking-[2px] text-muted-foreground/60 mb-3">Accent</div>
            <div className="grid grid-cols-5 gap-2">
              {ACCENT_SWATCHES.map(color => (
                <div
                  key={color}
                  onClick={() => {
                    setSlideAc(prev => ({ ...prev, [currentSlide.id]: color }));
                    setIsDirty(true);
                  }}
                  className={cn(
                    "aspect-square rounded-full shadow-sm cursor-pointer border-2 transition-transform hover:scale-110",
                    slideAc[currentSlide?.id] === color ? "border-primary" : "border-transparent"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Text Formatting Controls */}
          <div className="p-4 border-b border-border space-y-4">
            <div className="text-[9px] font-bold uppercase tracking-[2px] text-muted-foreground/60">Format Text</div>
            <div className="grid grid-cols-3 gap-1">
              {[
                { icon: Bold, cmd: "bold" },
                { icon: Italic, cmd: "italic" },
                { icon: Underline, cmd: "underline" },
              ].map(({ icon: Icon, cmd }) => (
                <Button
                  key={cmd}
                  variant="outline"
                  size="sm"
                  className="h-8 border-border bg-transparent hover:bg-muted"
                  onClick={() => {
                     iframeRef.current?.contentDocument?.execCommand(cmd);
                     setIsDirty(true);
                  }}
                >
                  <Icon className="w-3.5 h-3.5" />
                </Button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground italic leading-relaxed">
              Enable "Edit" mode and select text on the stage to apply formatting.
            </p>
          </div>

          {/* Slide Actions (Duplicate/Delete) */}
          <div className="p-4 border-b border-border space-y-3">
            <div className="text-[9px] font-bold uppercase tracking-[2px] text-muted-foreground/60">Options</div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 h-8 text-[10px] font-bold border-border bg-transparent hover:bg-muted"
              >
                Duplicate
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                className="flex-1 h-8 text-[10px] font-bold"
                onClick={() => {
                  if (slides.length <= 1) return;
                  const next = slides.filter((_, j) => j !== cur).map((s, j) => ({ ...s, index: j }));
                  setSlides(next);
                  setCur(Math.min(cur, next.length - 1));
                  setIsDirty(true);
                }}
              >
                Delete
              </Button>
            </div>
          </div>

          {/* Keyboard Shortcuts Hint */}
          <div className="flex-1 p-4 bg-muted/20">
            <div className="text-[9px] font-bold uppercase tracking-[2px] text-muted-foreground/40 mb-3">Shortcuts</div>
            <div className="space-y-2 text-[10px] text-muted-foreground/60 font-medium">
              <div className="flex justify-between"><span>Next / Prev</span> <Badge variant="secondary" className="px-1 py-0 h-4 text-[8px] font-mono">← →</Badge></div>
              <div className="flex justify-between"><span>Fullscreen</span> <Badge variant="secondary" className="px-1 py-0 h-4 text-[8px] font-mono">F</Badge></div>
              <div className="flex justify-between"><span>Exit Fullscreen</span> <Badge variant="secondary" className="px-1 py-0 h-4 text-[8px] font-mono">ESC</Badge></div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Bottom Notes (100px) ── */}
      <div className="h-[100px] shrink-0 border-t border-border bg-card/10 backdrop-blur-xl flex px-4 py-2.5 gap-4">
        <div className="text-[9px] font-black uppercase tracking-[3px] text-muted-foreground/40 pt-1 shrink-0">
          Speaker Notes
        </div>
        <Textarea 
          placeholder="Type speaker notes here..."
          value={notes[currentSlide?.id] || ""}
          className="flex-1 h-full bg-transparent border-none focus-visible:ring-0 text-[12px] p-0 resize-none font-sans leading-relaxed scrollbar-hide text-foreground"
          onChange={e => {
            if (!currentSlide) return;
            setNotes(prev => ({ ...prev, [currentSlide.id]: e.target.value }));
            setIsDirty(true);
          }}
        />
      </div>
      
    </div>
  );
}
