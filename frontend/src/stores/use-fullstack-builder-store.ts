import { create } from 'zustand';

interface FullstackBuilderState {
  isOpen: boolean;
  projectPath?: string;
  framework?: string;
  projectName?: string;
  previewUrl?: string;

  openPanel: (data?: {
    projectPath?: string;
    framework?: string;
    projectName?: string;
    previewUrl?: string;
  }) => void;
  closePanel: () => void;
  setPreviewUrl: (url: string) => void;
  // Used to inject a prompt into the chat input from the IDE panel
  pendingChatMessage: string | null;
  setPendingChatMessage: (msg: string) => void;
  clearPendingChatMessage: () => void;
}

export const useFullstackBuilderStore = create<FullstackBuilderState>((set) => ({
  isOpen: false,
  projectPath: undefined,
  framework: undefined,
  projectName: undefined,
  previewUrl: undefined,

  openPanel: (data) =>
    set((state) => ({
      isOpen: true,
      ...data,
    })),

  closePanel: () =>
    set({
      isOpen: false,
      projectPath: undefined,
      framework: undefined,
      projectName: undefined,
      previewUrl: undefined,
    }),

  setPreviewUrl: (url) => set({ previewUrl: url }),

  pendingChatMessage: null,
  setPendingChatMessage: (msg) => set({ pendingChatMessage: msg }),
  clearPendingChatMessage: () => set({ pendingChatMessage: null }),
}));
