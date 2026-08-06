import { Button } from "@heroui/react";
import { IoMdAdd } from "react-icons/io";

interface PropTypes {
  onAdd?: () => void;
  showAddButton?: boolean;
  title?: string;
  description?: string;
  textAddButton?: string;
}
export default function AppBar({
  onAdd,
  showAddButton = true,
  title,
  description,
  textAddButton = "Buat Laporan",
}: PropTypes) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2">
      <div>
        <div className="inline-flex items-center gap-2 mb-1">
          <span className="inline-block w-2 h-7 rounded-full bg-linear-to-b from-blue-600 to-indigo-700 shrink-0 shadow-xs" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h1>
        </div>
        {description && (
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 ml-3.5">
            {description}
          </p>
        )}
      </div>
      <div>
        {showAddButton && (
          <Button
            onClick={onAdd}
            variant="primary"
            size="md"
            className="px-5 sm:px-6 rounded-xl w-full sm:w-auto active:scale-[0.98] transition-transform duration-150 shadow-xs"
          >
            <IoMdAdd />
            {textAddButton || "Buat Laporan"}
          </Button>
        )}
      </div>
    </div>
  );
}
