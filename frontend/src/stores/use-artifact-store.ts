import { create } from 'zustand';

export type ArtifactType = 'doc' | 'sheet';

export interface ArtifactData {
  id: string;
  type: ArtifactType;
  title: string;
  content: string; // HTML for docs, CSV/XLSX path for sheets
  format?: 'doc' | 'docx' | 'xlsx' | 'csv' | 'txt' | 'markdown';
  sandboxId: string;
  path?: string; // Path in the sandbox
  metadata?: Record<string, any>;
}

interface ArtifactState {
  isOpen: boolean;
  activeArtifact: ArtifactData | null;
  
  // Actions
  openArtifact: (data: ArtifactData) => void;
  closeArtifact: () => void;
  toggleArtifact: () => void;
  setOpen: (open: boolean) => void;
}

/**
 * Store for managing the state of the Artifact Workspace (Documents & Spreadsheets)
 * This store allows different parts of the UI to "push" an artifact to the sidebar.
 */
export const useArtifactStore = create<ArtifactState>((set) => ({
  isOpen: false,
  activeArtifact: null,
  
  openArtifact: (data) => set({ 
    isOpen: true, 
    activeArtifact: data 
  }),
  
  closeArtifact: () => set({ 
    isOpen: false 
  }),
  
  toggleArtifact: () => set((state) => ({ 
    isOpen: !state.isOpen 
  })),
  
  setOpen: (open) => set({ 
    isOpen: open 
  }),
}));
