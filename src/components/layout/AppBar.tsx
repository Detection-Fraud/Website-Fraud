import { Button } from "@heroui/react";
import { IoMdAdd } from "react-icons/io";

interface PropTypes {
  onAdd?: () => void;
  showAddButton?: boolean;
  title?: string;
  description?: string;
}
export default function AppBar({
  onAdd,
  showAddButton = true,
  title,
  description,
}: PropTypes) {
  return (
    <div className="flex flex-row justify-between items-center">
      <div>
        <h1 className="font-semibold text-lg">
          {title || "Dashboard Kantor Wilayah"}
        </h1>
        <p className="text-sm text-muted">
          {description || "List laporan bulanan yang telah di kirim"}
        </p>
      </div>
      <div>
        {showAddButton && (
          <Button
            onClick={onAdd}
            variant="primary"
            size="lg"
            className={"px-6 rounded-xl"}
        >
          <IoMdAdd />
          Buat Laporan
        </Button>
        )}
      </div>
    </div>
  );
}
