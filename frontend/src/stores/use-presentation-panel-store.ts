import { create } from 'zustand';

interface PresentationPanelState {
  isOpen: boolean;
  sandboxId: string | null;
  presentationPath: string | null;
  openPanel: (sandboxId: string, presentationPath: string) => void;
  closePanel: () => void;
}

/**
 * Store for managing the state of the TalosSlidesPanel (full-page presentation overlay)
 */
export const usePresentationPanelStore = create<PresentationPanelState>((set) => ({
  isOpen: false,
  sandboxId: null,
  presentationPath: null,
  openPanel: (sandboxId, presentationPath) => set({ 
    isOpen: true, 
    sandboxId, 
    presentationPath 
  }),
  closePanel: () => set({ 
    isOpen: false,
    // We keep the sandboxId and presentationPath to allow reopening or state persistence if needed
  }),
}));
