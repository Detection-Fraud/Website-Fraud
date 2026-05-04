import { useState } from "react";
import type { Key } from "@heroui/react";
import { parseDate, type DateValue } from "@internationalized/date";
import { InitialData, ReportFormData } from "@/types/report.types";

interface UseFormDetectionLogicProps {
  initialData?: InitialData;
  tanganiSubmitFinal: (formData: ReportFormData) => void;
}

export function useFormDetectionLogic({
  initialData,
  tanganiSubmitFinal,
}: UseFormDetectionLogicProps) {
  const [selectedProgramId, setSelectedProgramId] = useState<Key | null>(
    initialData?.programId || null,
  );

  const [selectedDate, setSelectedDate] = useState<DateValue | null>(() => {
    if (initialData?.tanggalKegiatan) {
      try {
        const dateString = new Date(initialData.tanggalKegiatan)
          .toISOString()
          .split("T")[0];
        return parseDate(dateString);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nativeData = Object.fromEntries(
      new FormData(e.currentTarget),
    ) as Record<string, string>;

    const formData: ReportFormData = {
      activityName: nativeData.activityName || "",
      programId: selectedProgramId ? String(selectedProgramId) : "",
      tanggalKegiatan: selectedDate ? selectedDate.toString() : "",
      lokasi: nativeData.lokasi || "",
      picKegiatan: nativeData.picKegiatan || "",
      description: nativeData.description || "",
    };

    tanganiSubmitFinal(formData);
  };

  return {
    selectedProgramId,
    setSelectedProgramId,
    selectedDate,
    setSelectedDate,
    handleFormSubmit,
  };
}
