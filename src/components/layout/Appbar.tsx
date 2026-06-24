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
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
      <div>
        <h1 className="font-semibold text-base sm:text-lg">
          {title || "Dashboard Kantor Wilayah"}
        </h1>
        <p className="text-xs text-muted">
          {description || "List laporan bulanan yang telah di kirim"}
        </p>
      </div>
      <div>
        {showAddButton && (
          <Button
            onClick={onAdd}
            variant="primary"
            size="md"
            className={"px-4 sm:px-6 rounded-xl w-full sm:w-auto"}
          >
            <IoMdAdd />
            {textAddButton || "Buat Laporan"}
          </Button>
        )}
      </div>
    </div>
  );
}
