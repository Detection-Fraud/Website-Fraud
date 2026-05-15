import { StatusType } from "@/types/status.types";
import { toast } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function useApproval() {
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();

  const updateStatus = async (
    id: string,
    status: StatusType,
    notes?: string,
  ) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/reports/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status, notes }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update status");
      }

      toast.success(data.message || "Status updated successfully");

      router.push("/admin/approval");
      router.refresh();

      return true;
    } catch (error: unknown) {
      console.error(error);
      toast.danger(
        error instanceof Error ? error.message : "Failed to update status",
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    return await updateStatus(id, "APPROVED");
  };

  const handleReject = async (id: string, notes: string) => {
    return await updateStatus(id, "REJECTED", notes);
  };

  return {
    isLoading,
    handleApprove,
    handleReject,
  };
}
