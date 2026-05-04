import { create } from "zustand";

interface LayoutStore {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
}

export const useLayoutStore = create<LayoutStore>((set) => ({
  isSidebarOpen: true, // Default terbuka
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
}));
