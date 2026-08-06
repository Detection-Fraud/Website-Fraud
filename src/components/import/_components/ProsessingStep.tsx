import { ProgressBar } from "@heroui/react";
import { FiDatabase } from "react-icons/fi";

interface ProsessingStepProps {
  progress: number;
  processedCount: number;
  totalCount: number;
  title?: string;
  entityName?: string;
}

export default function ProsessingStep({
  progress,
  processedCount,
  totalCount,
  title = "Mengimpor Data Karyawan...",
  entityName = "karyawan",
}: ProsessingStepProps) {
  return (
    <div className="py-20 flex flex-col items-center justify-center text-center">
      <div className="w-20 h-20 rounded-2xl mb-6 bg-linear-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-xl shadow-blue-300/40 animate-pulse">
        <FiDatabase size={36} className="text-white" />
      </div>

      <h2 className="text-xl font-bold text-gray-800">{title}</h2>
      <p className="text-sm text-gray-500 mt-1 max-w-xs">
        Sedang menyimpan{" "}
        <span className="font-semibold text-gray-700">
          {totalCount} {entityName}
        </span>{" "}
        ke database. Jangan tutup halaman ini.
      </p>

      <div className="w-full max-w-md mt-8 space-y-2">
        <ProgressBar
          aria-label={`Progress import ${entityName}`}
          value={progress}
          minValue={0}
          maxValue={100}
          color="accent"
          size="md"
          className={"w-full"}
        >
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>

        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-500">
            {processedCount} / {totalCount} record
          </span>
          <span className="font-semibold text-blue-600">{progress}%</span>
        </div>
      </div>
    </div>
  );
}
