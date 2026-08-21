import { ProgramBudayaWithCategory } from "@/hooks/useProgramQuery";
import { ProgramBudaya } from "@generated/prisma";
import { FiGrid } from "react-icons/fi";
import { ProgramCardItem } from "./cards/ProgramCardItem";

interface CardProgramsProps {
  programs: ProgramBudayaWithCategory[];
  onEdit?: (program: ProgramBudaya) => void;
  onToggleStatus?: (program: ProgramBudaya) => void;
}

export default function CardPrograms({
  programs,
  onEdit,
  onToggleStatus,
}: CardProgramsProps) {
  if (!programs || programs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-2 text-zinc-400">
        <FiGrid className="w-8 h-8 opacity-30" />
        <p className="text-sm">Tidak ada data program budaya</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {programs.map((program) => (
        <ProgramCardItem
          key={program.id}
          program={program}
          onEdit={onEdit}
          onToggleStatus={onToggleStatus}
        />
      ))}
    </div>
  );
}
