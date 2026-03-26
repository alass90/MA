import { create } from 'zustand';

export interface DesignElement {
  id: string;
  sandboxId: string;
  filePath: string;
  directUrl?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  opacity: number;
  name: string;
  locked: boolean;
}

interface DesignerState {
  isOpen: boolean;
  elements: DesignElement[];
  
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  
  addElement: (element: Omit<DesignElement, 'id'>) => void;
  updateElement: (id: string, updates: Partial<DesignElement>) => void;
  setElements: (elements: DesignElement[] | ((prev: DesignElement[]) => DesignElement[])) => void;
  clearElements: () => void;
}

export const useDesignerStore = create<DesignerState>((set) => ({
  isOpen: false,
  elements: [],

  openPanel: () => set({ isOpen: true }),
  closePanel: () => set({ isOpen: false }),
  togglePanel: () => set((state) => ({ isOpen: !state.isOpen })),

  addElement: (element) => set((state) => {
    const id = `design-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return {
      elements: [...state.elements, { ...element, id }]
    };
  }),

  updateElement: (id, updates) => set((state) => ({
    elements: state.elements.map(el => 
      el.id === id ? { ...el, ...updates } : el
    )
  })),

  setElements: (elements) => set((state) => ({
    elements: typeof elements === 'function' ? elements(state.elements) : elements
  })),

  clearElements: () => set({ elements: [] })
}));
