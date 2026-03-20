import { create } from 'zustand';

interface DeploymentInfo {
  url: string;
  level: 'preview' | 'vercel' | 'fullstack';
  projectName?: string;
  framework?: string;
  deploymentId?: string;
  databaseUrl?: string;
  databaseProvider?: string;
  projectPath?: string;
  sandboxId?: string;
}

interface PreviewPanelState {
  isOpen: boolean;
  deployment: DeploymentInfo | null;
  openPanel: (deployment: DeploymentInfo) => void;
  closePanel: () => void;
  togglePanel: () => void;
  setOpen: (open: boolean) => void;
}

export const usePreviewPanelStore = create<PreviewPanelState>((set) => ({
  isOpen: false,
  deployment: null,
  openPanel: (deployment) => set({ isOpen: true, deployment }),
  closePanel: () => set({ isOpen: false }),
  togglePanel: () => set((state) => ({ isOpen: !state.isOpen })),
  setOpen: (open) => set({ isOpen: open }),
}));
