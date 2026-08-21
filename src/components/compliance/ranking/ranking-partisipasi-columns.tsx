import { TableColumn } from "@/components/layout/DataTable";
import { ParticipationRankingItem } from "@/types/participation.types";
import { Chip } from "@heroui/react";

export function buildPartisipasiColumns(
  categories: Array<{ id: string; name: string }>,
): TableColumn[] {
  return [
    { key: "rank", label: "RANK" },
    { key: "unitName", label: "UNIT KERJA" },
    { key: "unitType", label: "TIPE" },
    ...categories.map((cat) => ({
      key: `cat_${cat.id}`,
      label: cat.name,
    })),
    { key: "averagePercentage", label: "RATA-RATA" },
  ];
}

export function renderPartisipasiCell(
  item: ParticipationRankingItem,
  columnKey: string,
) {
  if (columnKey === "rank") {
    const rankStyle =
      item.rank === 1
        ? "bg-amber-100 text-amber-800 border border-amber-300"
        : item.rank === 2
          ? "bg-slate-100 text-slate-700 border border-slate-300"
          : item.rank === 3
            ? "bg-amber-900/10 text-amber-900 border border-amber-900/20"
            : "text-gray-500 font-medium bg-gray-50";

    return (
      <span
        className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${rankStyle}`}
      >
        #{item.rank}
      </span>
    );
  }

  if (columnKey === "unitName") {
    return (
      <div className="min-w-40 max-w-64 whitespace-normal">
        <p className="font-semibold text-slate-800 text-sm">{item.unitName}</p>
      </div>
    );
  }

  if (columnKey === "unitType") {
    return (
      <span className="text-xs text-gray-500 font-medium">{item.unitType}</span>
    );
  }

  if (columnKey.startsWith("cat_")) {
    const catId = columnKey.replace("cat_", "");
    const catData = item.categories.find((c) => c.categoryId === catId);
    if (!catData) return <span className="text-slate-300 text-xs">-</span>;
    const color =
      catData.percentage >= 80
        ? "success"
        : catData.percentage >= 50
          ? "warning"
          : "danger";
    return (
      <Chip variant="soft" color={color} size="sm">
        {catData.percentage}%
      </Chip>
    );
  }

  if (columnKey === "averagePercentage") {
    if (!item.hasData)
      return <span className="text-xs italic text-gray-400">-</span>;
    const avg = item.averagePercentage ?? 0;
    const color = avg >= 80 ? "success" : avg >= 50 ? "warning" : "danger";
    return (
      <Chip variant="soft" color={color} size="sm">
        {avg}%
      </Chip>
    );
  }

  return null;
}
