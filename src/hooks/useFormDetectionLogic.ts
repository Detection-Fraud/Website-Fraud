import { InitialData, ReportFormData } from "@/types/report.types";
import { ProgramBudaya } from "@generated/prisma";
import type { Key } from "@heroui/react";
import { parseDate, type DateValue } from "@internationalized/date";
import { useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "./useCurrentUser";

interface UseFormDetectionLogicProps {
  initialData?: InitialData;
  programs: ProgramBudaya[];
  tanganiSubmitFinal: (formData: ReportFormData) => void;
}

export function useFormDetectionLogic({
  initialData,
  programs,
  tanganiSubmitFinal,
}: UseFormDetectionLogicProps) {
  const [selectedProgramId, setSelectedProgramId] = useState<Key | null>(
    initialData?.programId || null,
  );

  const [selectedCategoryId, setSelectedCategoryId] = useState<Key | null>();

  const programsInCategory = useMemo(() => {
    if (!selectedCategoryId) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const safePrograms = Array.isArray(programs) ? programs : [];
    return safePrograms.filter((program: any) => {
      if (program.categoryId !== selectedCategoryId) return false;

      if (initialData?.programId === program.id) return true;

      // Filter jika program sudah lewat endDate
      const endDate = new Date(program.endDate);
      endDate.setHours(0, 0, 0, 0);
      return today <= endDate;
    });
  }, [selectedCategoryId, programs, initialData]);

  useEffect(() => {
    if (!selectedCategoryId) return;

    if (programsInCategory.length === 1) {
      setSelectedProgramId(programsInCategory[0].id);
    } else {
      setSelectedProgramId(null);
    }
  }, [selectedCategoryId, programsInCategory]);

  const { user } = useCurrentUser();

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

  const { minDate, maxDate, isDateDisabled } = useMemo(() => {
    if (!selectedProgramId) {
      return {
        minDate: undefined,
        maxDate: undefined,
        isDateDisabled: true,
      };
    }
    const programList = Array.isArray(programs) ? programs : [];
    const program = programList.find((p) => p.id === selectedProgramId);
    if (!program) {
      return { minDate: undefined, maxDate: undefined, isDateDisabled: true };
    }

    const startString = new Date(program.startDate).toISOString().split("T")[0];
    const endString = new Date(program.endDate).toISOString().split("T")[0];

    const start = parseDate(startString);
    const end = parseDate(endString);
    return {
      minDate: start,
      maxDate: end,
      isDateDisabled: false,
    };
  }, [selectedProgramId, programs]);

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
      description: nativeData.description || "",
    };

    tanganiSubmitFinal(formData);
  };

  return {
    selectedProgramId,
    setSelectedProgramId,
    selectedCategoryId,
    setSelectedCategoryId,
    programsInCategory,
    selectedDate,
    setSelectedDate,
    handleFormSubmit,

    minDate,
    maxDate,
    isDateDisabled,
  };
}
