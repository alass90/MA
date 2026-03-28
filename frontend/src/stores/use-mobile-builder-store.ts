import { create } from 'zustand';

interface MobileBuilderState {
  isOpen: boolean;
  projectPath?: string;
  projectName?: string;
  webPreviewUrl?: string;
  expoUrl?: string;
  qrData?: string;
  isGenerating: boolean;

  openPanel: (data?: {
    projectPath?: string;
    projectName?: string;
    webPreviewUrl?: string;
    expoUrl?: string;
    qrData?: string;
  }) => void;
  closePanel: () => void;
  setPreviewUrls: (urls: { webPreviewUrl?: string; expoUrl?: string; qrData?: string }) => void;
  setIsGenerating: (val: boolean) => void;
  pendingChatMessage: string | null;
  setPendingChatMessage: (msg: string) => void;
  clearPendingChatMessage: () => void;
}

export const useMobileBuilderStore = create<MobileBuilderState>((set) => ({
  isOpen: false,
  projectPath: undefined,
  projectName: undefined,
  webPreviewUrl: undefined,
  expoUrl: undefined,
  qrData: undefined,
  isGenerating: false,

  openPanel: (data) =>
    set((state) => ({
      isOpen: true,
      ...data,
    })),

  closePanel: () =>
    set({
      isOpen: false,
      projectPath: undefined,
      projectName: undefined,
      webPreviewUrl: undefined,
      expoUrl: undefined,
      qrData: undefined,
      isGenerating: false,
    }),

  setPreviewUrls: (urls) => set(urls),
  setIsGenerating: (val) => set({ isGenerating: val }),

  pendingChatMessage: null,
  setPendingChatMessage: (msg) => set({ pendingChatMessage: msg }),
  clearPendingChatMessage: () => set({ pendingChatMessage: null }),
}));
