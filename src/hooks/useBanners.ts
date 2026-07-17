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
}

export function useBanners() {
  const queryClient = useQueryClient();

  const useGetBanners = () => {
    return useQuery<Banner[]>({
      queryKey: ["banners"],
      queryFn: () => api.get("/banners").then((res) => res.data.data),
      staleTime: 5 * 60 * 1000,
    });
  };

  const useGetAllBanners = () => {
    return useQuery<Banner[]>({
      queryKey: ["banners", "all"],
      queryFn: () =>
        api
          .get("/banners", { params: { all: "true" } })
          .then((res) => res.data.data),
      staleTime: 5 * 60 * 1000,
    });
  };

  const useCreateBanner = () => {
    return useMutation({
      mutationFn: (data: Omit<Banner, "id" | "isActive">) =>
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
      mutationFn: ({ id, ...data }: Partial<Banner> & { id: string }) =>
        api.patch(`/banners/${id}`, data),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["banners"] });
      },
    });
  };

  const useDeleteBanner = () => {
    return useMutation({
      mutationFn: (id: string) => api.delete(`/banners/${id}`),
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["banners"],
        });
      },
    });
  };

  const useReorderBanners = () => {
    return useMutation({
      mutationFn: (ids: string[]) => api.post("/banners/reorder", { ids }),
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
