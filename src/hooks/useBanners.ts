import { api } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface Banner {
  id: string;
  imageUrl: string;
  name: string;
  role: string;
  unit: string;
  period: string;
  order: number;
  isActive: boolean;
  updatedAt: string;
}

export interface BannerPage {
  items: Banner[];
  total: number;
  activeCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface BannerWriteData {
  imageUrl: string;
  name: string;
  role: string;
  unit: string;
  period: string;
  order: number;
  isActive?: boolean;
  bannerState?: "NONE" | "UNCHANGED" | "REPLACED" | "REMOVED";
  publicId?: string;
  descriptor?: string;
  cleanupToken?: string;
  expectedUpdatedAt?: string;
}

export function useBanners() {
  const queryClient = useQueryClient();

  const useGetBanners = () => {
    return useQuery<Banner[]>({
      queryKey: ["banners"],
      queryFn: () => api.get("/banners").then((res) => res.data),
      staleTime: 5 * 60 * 1000,
    });
  };

  const useGetAllBanners = (page = 1, pageSize = 100) => {
    return useQuery<BannerPage>({
      queryKey: ["banners", "all", page, pageSize],
      queryFn: async () => {
        const res = await api.get("/banners", {
          params: { all: "true", page, pageSize },
        });
        const data = res.data as BannerPage | Banner[];

        if (!Array.isArray(data)) return data;

        const total = data.length;
        return {
          items: data.slice((page - 1) * pageSize, page * pageSize),
          total,
          activeCount: data.filter((banner) => banner.isActive).length,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        };
      },
      staleTime: 5 * 60 * 1000,
    });
  };

  const useCreateBanner = () => {
    return useMutation({
      mutationFn: (data: BannerWriteData) =>
        api.post("/banners", data),
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["banners"],
        });
      },
    });
  };

  const useUpdateBanner = () => {
    return useMutation({
      mutationFn: ({ id, ...data }: Partial<BannerWriteData> & { id: string }) =>
        api.patch(`/banners/${id}`, data),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["banners"] });
      },
    });
  };

  const useDeleteBanner = () => {
    return useMutation({
      mutationFn: ({ id, expectedUpdatedAt }: { id: string; expectedUpdatedAt?: string }) =>
        api.delete(`/banners/${id}`, { data: { expectedUpdatedAt } }),
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["banners"],
        });
      },
    });
  };

  const useReorderBanners = () => {
    return useMutation({
      mutationFn: ({
        id,
        direction,
        expectedUpdatedAt,
      }: {
        id: string;
        direction: "up" | "down";
        expectedUpdatedAt: string;
      }) =>
        api.post("/banners/reorder", { id, direction, expectedUpdatedAt }),
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["banners"],
        });
      },
    });
  };

  return {
    useGetBanners,
    useGetAllBanners,
    useCreateBanner,
    useUpdateBanner,
    useDeleteBanner,

    useReorderBanners,
  };
}
