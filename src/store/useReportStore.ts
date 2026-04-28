import { create } from "zustand";

interface ImageFile {
  id: string;
  file: File;
  previewUrl: string;
  status: "IDLE" | "LOADING" | "LULUS" | "FRAUD";
  fraudRefUrl?: string | null;
}

interface ReportStore {
  step: number;
  images: ImageFile[];
  setStep: (step: number) => void;
  addImages: (images: ImageFile[]) => void;
  removeImage: (id: string) => void;
  updateImageStatus: (
    id: string,
    status: ImageFile["status"],
    refUrl?: string | null,
  ) => void;
  resetStore: () => void;
}

export const useReportStore = create<ReportStore>((set) => ({
  step: 1,
  images: [],

  setStep: (newStep) => set({ step: newStep }),

  addImages: (newImages) =>
    set((state) => ({
      images: [...state.images, ...newImages],
    })),

  removeImage: (idToRemove) =>
    set((state) => {
      const imgToDelete = state.images.find((img) => img.id === idToRemove);
      if (imgToDelete?.previewUrl) {
        URL.revokeObjectURL(imgToDelete.previewUrl);
      }
      return { images: state.images.filter((img) => img.id !== idToRemove) };
    }),

  updateImageStatus: (id, newStatus, refUrl = null) =>
    set((state) => ({
      images: state.images.map((img) =>
        img.id === id
          ? { ...img, status: newStatus, fraudRefUrl: refUrl }
          : img,
      ),
    })),

  resetStore: () =>
    set((state) => {
      state.images.forEach((img) => {
        if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
      });
      return { step: 1, images: [] };
    }),
}));
