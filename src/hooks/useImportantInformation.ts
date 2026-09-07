import { api } from "@/lib/api";
import type {
  AdminImportantInformationList,
  ImportantInformationItem,
  ImportantInformationReorderInput,
  PicImportantInformationList,
} from "@/types/important-information";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const importantInformationKeys = {
  admin: ["important-information", "admin"] as const,
  pic: ["important-information", "pic"] as const,
};

type ImportantInformationAxiosError = {
  message?: string;
  response?: {
    status?: number;
    data?: {
      message?: string;
      errors?: { code?: string; currentRevision?: number };
    };
  };
};

export type ImportantInformationError = {
  message: string;
  status?: number;
  code?: "ORDER_CONFLICT";
  currentRevision?: number;
};

function createImportantInformationFormData(
  altText: string,
  file?: File,
): FormData {
  const formData = new FormData();
  formData.append("altText", altText);
  if (file) formData.append("file", file);
  return formData;
}

export function getImportantInformationError(
  error: unknown,
): ImportantInformationError {
  const candidate = error as ImportantInformationAxiosError;
  const details = candidate.response?.data?.errors;
  const code = details?.code === "ORDER_CONFLICT" ? details.code : undefined;
  return {
    message:
      candidate.response?.data?.message ??
      candidate.message ??
      "Terjadi kesalahan pada Informasi Penting",
    status: candidate.response?.status,
    code,
    currentRevision: details?.currentRevision,
  };
}

function invalidateImportantInformation(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  void queryClient.invalidateQueries({
    queryKey: importantInformationKeys.admin,
  });
  void queryClient.invalidateQueries({
    queryKey: importantInformationKeys.pic,
  });
}

export function useAdminImportantInformation() {
  return useQuery<AdminImportantInformationList>({
    queryKey: importantInformationKeys.admin,
    queryFn: () =>
      api
        .get<AdminImportantInformationList>("/admin/important-information")
        .then((response) => response.data),
  });
}

export function usePicImportantInformation() {
  return useQuery<PicImportantInformationList>({
    queryKey: importantInformationKeys.pic,
    queryFn: () =>
      api
        .get<PicImportantInformationList>("/pic/important-information")
        .then((response) => response.data),
  });
}

export function useCreateImportantInformation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ altText, file }: { altText: string; file: File }) => {
      const formData = createImportantInformationFormData(altText, file);
      return api
        .post<ImportantInformationItem>(
          "/admin/important-information",
          formData,
        )
        .then((response) => response.data);
    },
    onSuccess: () => {
      invalidateImportantInformation(queryClient);
    },
  });
}

export function useUpdateImportantInformation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      altText,
      file,
    }: {
      id: string;
      altText: string;
      file?: File;
    }) => {
      const formData = createImportantInformationFormData(altText, file);
      return api
        .patch<ImportantInformationItem>(
          `/admin/important-information/${id}`,
          formData,
        )
        .then((response) => response.data);
    },
    onSuccess: () => {
      invalidateImportantInformation(queryClient);
    },
  });
}

export function useDeleteImportantInformation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api
        .delete<{
          items: ImportantInformationItem[];
          revision: number;
        }>(`/admin/important-information/${id}`)
        .then((response) => response.data),
    onSuccess: () => {
      invalidateImportantInformation(queryClient);
    },
  });
}

export function useSetImportantInformationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api
        .patch<ImportantInformationItem>(
          `/admin/important-information/${id}/status`,
          { isActive },
        )
        .then((response) => response.data),
    onSuccess: () => {
      invalidateImportantInformation(queryClient);
    },
  });
}

export function useReorderImportantInformation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ImportantInformationReorderInput) =>
      api
        .put<AdminImportantInformationList>(
          "/admin/important-information/reorder",
          input,
        )
        .then((response) => response.data),
    onSuccess: (data) => {
      queryClient.setQueryData(importantInformationKeys.admin, data);
      invalidateImportantInformation(queryClient);
    },
  });
}
