import { isProgramUploadOpen } from "@/lib/program-period";
import { useReportStore } from "@/store/useReportStore";
import { InitialData, ReportFormData } from "@/types/report.types";
import { ProgramBudaya, ProgramCategory } from "@generated/prisma";
import type { Key } from "@heroui/react";
import { parseDate, type DateValue } from "@internationalized/date";
import { useEffect, useMemo, useState } from "react";

export type ProgramWithCategory = ProgramBudaya & {
  category?: ProgramCategory | null;
};

interface UseFormDetectionLogicProps {
  initialData?: InitialData;
  programs: ProgramWithCategory[];
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

  useEffect(() => {
    if (!initialData?.programId) return;

    const initialProgram = programs.find(
      (program) => program.id === initialData.programId,
    );
    if (initialProgram) setSelectedCategoryId(initialProgram.categoryId);
  }, [initialData?.programId, programs]);

  const programsInCategory = useMemo(() => {
    if (!selectedCategoryId) return [];

    const safePrograms = Array.isArray(programs) ? programs : [];
    return safePrograms.filter((program) => {
      if (program.categoryId !== selectedCategoryId) return false;

      if (initialData?.programId === program.id) return true;

      return isProgramUploadOpen(program);
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

  const [selectedDate, setSelectedDate] = useState<DateValue | null>(() => {
    if (initialData?.tanggalKegiatan) {
      try {
        const dateString = new Date(initialData.tanggalKegiatan)
          .toISOString()
          .split("T")[0];
        return parseDate(dateString);
      } catch {
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

  const selectedCategory = useMemo(() => {
    const programList = Array.isArray(programs) ? programs : [];
    const prog = programList.find((p) => p.id === selectedProgramId);
    return prog?.category || null;
  }, [selectedProgramId, programs]);

  const isNoAiMode =
    selectedCategory?.targetUnit === "PARTISIPASI_PERSEN" &&
    selectedCategory.evidenceMode === "PHOTO_WITHOUT_AI" &&
    selectedCategory.scoreInputMode === "DIRECT_ADMIN";

  const setIsNoAiMode = useReportStore((s) => s.setIsNoAiMode);
  useEffect(() => {
    setIsNoAiMode(Boolean(isNoAiMode));
  }, [isNoAiMode, setIsNoAiMode]);

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

    isNoAiMode,
    selectedCategory,
  };
}
