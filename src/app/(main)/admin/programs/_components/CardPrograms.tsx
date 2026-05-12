import { ProgramBudaya } from "@generated/prisma";
import { Button, Card, Chip } from "@heroui/react";
import { BiBookOpen, BiCheckCircle, BiPowerOff } from "react-icons/bi";
import { BsCircleFill } from "react-icons/bs";
import { FiCalendar, FiEdit2, FiTarget } from "react-icons/fi";

interface CardProgramsProps {
  programs: ProgramBudaya[];
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
      <div className="flex justify-center items-center py-20 text-slate-400">
        Tidak ada data program budaya
      </div>
    );
  }
  const colorThemes = [
    { border: "border-sky-600", bg: "bg-sky-600/20", text: "text-sky-600" },
    {
      border: "border-green-600",
      bg: "bg-green-600/20",
      text: "text-green-600",
    },
    {
      border: "border-amber-600",
      bg: "bg-amber-600/20",
      text: "text-amber-600",
    },
    {
      border: "border-orange-500",
      bg: "bg-orange-500/20",
      text: "text-orange-500",
    },
    { border: "border-blue-500", bg: "bg-blue-500/20", text: "text-blue-500" },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {programs.map((program, i) => {
        const isActive = program.isActive;
        const theme = colorThemes[i % colorThemes.length];
        return (
          <div key={program.id}>
            <Card
              className={`border-t-5 transition-all shadow-sm hover:shadow-md ${isActive ? theme.border : "border-slate-300 opacity-75"}`}
            >
              <div className="flex flex-row justify-between items-start gap-3 mb-1.5">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${isActive ? theme.bg : "bg-slate-200"}`}
                >
                  <BiBookOpen
                    className={`w-5 h-5 ${isActive ? theme.text : "text-slate-500"}`}
                  />
                </div>
                <div>
                  <Chip
                    variant="soft"
                    color={isActive ? "success" : "danger"}
                    size="md"
                  >
                    <BsCircleFill className="w-1 h-1" />
                    <Chip.Label>
                      {isActive ? "Aktif" : "Tidak Aktif"}
                    </Chip.Label>
                  </Chip>
                </div>
              </div>
              <Card.Header>
                <Card.Title className="text-sm text-slate-800 font-bold mb-3.5">
                  {program.name}
                </Card.Title>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-500 text-xs">
                    <FiTarget className="w-3 h-3" />
                    <span>
                      Target :{" "}
                      <strong className="text-slate-700">
                        {program.frequency} laporan
                      </strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500 text-xs">
                    <FiCalendar />
                    <span>
                      Periode :{" "}
                      <strong className="text-slate-700">
                        {new Date(program.startDate).toLocaleDateString(
                          "id-ID",
                          { month: "short", year: "numeric" },
                        )}{" "}
                        -{" "}
                        {new Date(program.endDate).toLocaleDateString("id-ID", {
                          month: "short",
                          year: "numeric",
                        })}
                      </strong>
                    </span>
                  </div>
                </div>
              </Card.Header>

              <Card.Footer className="grid grid-cols-2 gap-2">
                <div>
                  <Button
                    fullWidth
                    size="sm"
                    className="rounded-xl border border-[#bae6fd] text-[#0284c7] font-semibold hover:bg-sky-50 transition-colors text-xs"
                    variant="outline"
                    onClick={() => onEdit?.(program)}
                  >
                    <FiEdit2 className="w-3 h-3" />
                    Edit
                  </Button>
                </div>
                <div>
                  <Button
                    fullWidth
                    size="sm"
                    className={`rounded-xl font-semibold transition-colors text-xs ${
                      isActive
                        ? "border-[#fee2e2] text-red-500 hover:bg-red-50"
                        : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                    }`}
                    variant="outline"
                    onClick={() => onToggleStatus?.(program)}
                  >
                    {isActive ? (
                      <>
                        <BiPowerOff className="w-3 h-3" />
                        Nonaktifkan
                      </>
                    ) : (
                      <>
                        <BiCheckCircle className="w-3 h-3" />
                        Aktifkan
                      </>
                    )}
                  </Button>
                </div>
              </Card.Footer>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
