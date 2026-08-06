import { ImportResult } from "@/types/import.types";
import { Button, Card } from "@heroui/react";
import { useRouter } from "next/navigation";
import {
  FiArrowRight,
  FiCheckCircle,
  FiDatabase,
  FiRotateCcw,
} from "react-icons/fi";
import { MdOutlineCheckCircle, MdOutlineTimerOff } from "react-icons/md";

interface FinishStepProps {
  result: ImportResult | null;
  stats: {
    total: number;
    error: number;
  };
  onReset: () => void;
  description?: string;
  actionText?: string;
  actionHref?: string;
}

export default function SelesaiStep({
  result,
  stats,
  onReset,
  description = "Data karyawan telah berhasil ditambahkan ke database BULOG",
  actionText = "Lihat User Management",
  actionHref = "/admin/management",
}: FinishStepProps) {
  const router = useRouter();

  const berhasilCount = result ? result.created + result.updated : 0;
  const dilewatiCount = stats.error;
  const totalCount = stats.total;

  const summaryItems = [
    {
      label: "Berhasil Diimport",
      value: berhasilCount,
      icon: <MdOutlineCheckCircle size={22} className="text-green-500" />,
      bgClass: "bg-green-50",
      valueClass: "text-green-700",
    },
    {
      label: "Gagal / Dilewati",
      value: dilewatiCount,
      icon: <MdOutlineTimerOff size={22} className="text-red-400" />,
      bgClass: "bg-red-50",
      valueClass: "text-red-700",
    },
    {
      label: "Total Diproses",
      value: totalCount,
      icon: <FiDatabase size={22} className="text-blue-500" />,
      bgClass: "bg-blue-50",
      valueClass: "text-blue-700",
    },
  ];

  return (
    <div className="space-y-5">
      <Card className="bg-green-50 border border-gray-200 rounded-2xl p-8">
        <Card.Content className="p-0 flex flex-col text-center items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-green-500 flex items-center justify-center shadow-lg shadow-green-300/40">
            <FiCheckCircle size={32} className="text-white" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              Import Berhasil!
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {description.split("berhasil").length > 1 ? (
                <>
                  {description.split("berhasil")[0]}
                  <span className="text-green-600 font-medium">berhasil</span>
                  {description.split("berhasil")[1]}
                </>
              ) : (
                description
              )}
            </p>
          </div>
        </Card.Content>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {summaryItems.map((item) => (
          <Card
            key={item.label}
            className={`${item.bgClass} border-0 rounded-2xl p-5`}
          >
            <Card.Content className="p-0 flex items-center gap-4">
              <div className="shrink-0">{item.icon}</div>
              <div>
                <p className="text-xs text-gray-500 font-medium">
                  {item.label}
                </p>
                <p
                  className={`text-3xl font-bold text-center ${item.valueClass}`}
                >
                  {item.value}
                </p>
              </div>
            </Card.Content>
          </Card>
        ))}
      </div>

      {result && result.deactivated !== undefined && result.deactivated > 0 && (
        <p className="text-xs text-center text-gray-400">
          + {result.deactivated} pengguna SSO lama dinonaktifkan karena tidak
          ditemukan di file ini.
        </p>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" size="md" onPress={onReset}>
          <FiRotateCcw size={14} />
          Import File Lain
        </Button>

        <Button
          variant="primary"
          size="md"
          onPress={() => router.push(actionHref)}
        >
          {actionText}
          <FiArrowRight size={14} />
        </Button>
      </div>
    </div>
  );
}
