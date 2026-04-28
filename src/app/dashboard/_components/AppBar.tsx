import { Button } from "@heroui/react";
import { IoMdAdd } from "react-icons/io";

interface PropTypes {
  onAdd: () => void;
}
export default function AppBar({ onAdd }: PropTypes) {
  return (
    <div className="flex flex-row justify-between items-center">
      <div>
        <h1 className="font-semibold text-lg">Dashboard Kantor Wilayah</h1>
        <p className="text-sm text-muted">
          List laporan bulanan yang telah di kirim
        </p>
      </div>
      <div>
        <Button
          onClick={onAdd}
          variant="primary"
          size="lg"
          className={"px-6 rounded-xl"}
        >
          <IoMdAdd />
          Buat Laporan
        </Button>
      </div>
    </div>
  );
}
