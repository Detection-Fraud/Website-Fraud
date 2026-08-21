import { useFormDetectionLogic } from "@/hooks/useFormDetectionLogic";
import { ProgramBudaya, ProgramCategory } from "@generated/prisma";
import {
  Button,
  Card,
  Chip,
  Form,
  Input,
  Label,
  ListBox,
  Select,
  TextArea,
  TextField,
} from "@heroui/react";
import CalendarPicker from "../../../../../components/ui/calendar-picker";

export interface InitialData {
  activityName?: string;
  programId?: string;
  tanggalKegiatan?: string;
  lokasi?: string;
  description?: string;
}

import { useReportSubmission } from "@/hooks/useReportSubmission";
import { useMemo } from "react";
import { FiCheckCircle, FiInfo } from "react-icons/fi";

interface PropTypes {
  programs: ProgramBudaya[];
  initialData?: InitialData;
  reportId?: string;
}
export default function FormDetection({
  programs,
  initialData,
  reportId,
}: PropTypes) {
  const { state, actions } = useReportSubmission(reportId);
  const {
    loadingText,
    adaGambarIdle,
    adaGambarFraud,
    adaGambarLoading,
    semuaLulus,
    totalGambar,
  } = state;

  const { handleCheckFraud, tanganiSubmitFinal } = actions;
  const {
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
  } = useFormDetectionLogic({
    initialData,
    tanganiSubmitFinal,
    programs,
  });

  const safePrograms = Array.isArray(programs) ? programs : [];

  const availablePrograms = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return safePrograms.filter((program) => {
      // Filter out if program is disabled/inactive (except when editing existing report)
      if (!program.isActive && initialData?.programId !== program.id)
        return false;
      // Keep if it's the currently edited program
      if (initialData?.programId === program.id) return true;
      // Filter out if end date has passed
      const endDate = new Date(program.endDate);
      endDate.setHours(0, 0, 0, 0);
      return today <= endDate;
    });
  }, [safePrograms, initialData?.programId]);

  const uniqueCategories = useMemo(() => {
    const categoryMap = new Map();
    availablePrograms.forEach(
      (p: ProgramBudaya & { category?: ProgramCategory }) => {
        if (p.category && p.categoryId) {
          categoryMap.set(p.categoryId, p.category);
        }
      },
    );
    return Array.from(categoryMap.values());
  }, [availablePrograms]);

  // Ambil data program yang sedang terpilih (jika ada)
  const activeSelectedProgram = safePrograms.find(
    (p) => p.id === selectedProgramId,
  );

  return (
    <Card variant="default" className="shadow-sm">
      <Card.Header className="pt-5">
        <Card.Title className="font-semibold text-gray-900 text-lg">
          Informasi Laporan
        </Card.Title>
      </Card.Header>

      <Card.Content className="pt-2 pb-5">
        {/* Komponen Form HeroUI membungkus input dan tombol submit */}
        <Form
          validationBehavior="native"
          onSubmit={handleFormSubmit}
          className="w-full flex flex-col gap-5"
        >
          <TextField
            name="activityName"
            isRequired
            className="w-full"
            defaultValue={initialData?.activityName}
          >
            <Label className="text-sm font-medium">Nama Kegiatan</Label>
            <Input
              placeholder="Contoh: Sosialisasi Bulog"
              className="mt-1"
              autoComplete="off"
            />
          </TextField>

          {/* Select: controlled via value/onChange (HeroUI v3 pattern) */}
          <div className="w-full flex flex-col gap-1">
            <Label className="text-sm font-semibold text-slate-700" isRequired>
              Kategori Program
            </Label>
            <Select
              placeholder="Pilih Kategori Program"
              className="mt-1"
              value={selectedCategoryId as string}
              onChange={(value) => setSelectedCategoryId(value as string)}
              aria-label="Kategori Program"
              isRequired
            >
              <Select.Trigger className="bg-white border border-slate-200 shadow-xs">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {uniqueCategories.map((cat: ProgramCategory) => (
                    <ListBox.Item key={cat.id} id={cat.id} textValue={cat.name}>
                      <div className="flex items-center gap-2">
                        {cat.color && (
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                        )}
                        <span>{cat.name}</span>
                      </div>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>

          {selectedCategoryId && (
            <div className="w-full space-y-2">
              {/* KASUS 1: 1 Program Aktif -> Auto-Assign Display */}
              {programsInCategory.length === 1 && activeSelectedProgram && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-800">
                    <FiCheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                    <div>
                      <p className="text-xs text-emerald-600 font-medium">
                        Program Budaya Terhubung:
                      </p>
                      <p className="text-sm font-bold">
                        {activeSelectedProgram.name}
                      </p>
                    </div>
                  </div>
                  <Chip color="success" variant="soft" className="text-xs">
                    <Chip.Label>Auto-Assign</Chip.Label>
                  </Chip>
                </div>
              )}

              {/* KASUS 2: > 1 Program Aktif -> Fallback Select Dropdown */}
              {programsInCategory.length > 1 && (
                <div className="w-full flex flex-col gap-1">
                  <Label
                    className="text-sm font-semibold text-slate-700"
                    isRequired
                  >
                    Pilih Program Budaya Specific
                  </Label>
                  <Select
                    placeholder="Pilih Program Budaya"
                    className="mt-1"
                    isRequired
                    name="programId"
                    value={selectedProgramId as string}
                    onChange={(value) => setSelectedProgramId(value as string)}
                    aria-label="Program Budaya"
                  >
                    <Select.Trigger className="bg-white border border-slate-200 shadow-xs">
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {programsInCategory.map((program: ProgramBudaya) => (
                          <ListBox.Item
                            key={program.id}
                            id={program.id}
                            textValue={program.name}
                          >
                            {program.name}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
              )}

              {/* KASUS 3: 0 Program Aktif -> Warning Alert */}
              {programsInCategory.length === 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-amber-800 text-xs font-medium">
                  <FiInfo className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Tidak ada program budaya aktif pada kategori ini untuk
                    periode saat ini.
                  </span>
                </div>
              )}
            </div>
          )}
          {/* DatePicker: value disimpan di state */}
          <div className="w-full flex flex-col gap-1">
            <Label className="text-sm font-medium" isRequired>
              Tanggal Kegiatan
            </Label>
            <CalendarPicker
              value={selectedDate}
              onChange={setSelectedDate}
              isDisabled={isDateDisabled}
              minValue={minDate}
              isRequired
              maxValue={maxDate}
            />
          </div>

          <TextField
            name="lokasi"
            isRequired
            className="w-full"
            defaultValue={initialData?.lokasi}
          >
            <Label className="text-sm font-medium">Lokasi</Label>
            <Input
              placeholder="Contoh: Kantor Cabang Jakarta Selatan"
              type="text"
              autoComplete="off"
              className="mt-1"
            />
          </TextField>

          <TextField
            name="description"
            isRequired
            className="w-full"
            defaultValue={initialData?.description}
          >
            <Label className="text-sm font-medium">Deskripsi</Label>
            <TextArea
              placeholder="Kegiatan ini dilaksanakan dengan tujuan..."
              autoComplete="off"
              className="mt-1 h-32 w-full"
            />
          </TextField>

          {/* Teks Animasi Loading */}
          {loadingText && (
            <p className="text-xs font-semibold text-blue-600 animate-pulse text-center mt-2 bg-blue-50 py-2 rounded-lg">
              ⏳ {loadingText}
            </p>
          )}

          {/* AREA TOMBOL */}
          <div className="mt-2 grid grid-cols-2 gap-3 w-full">
            {/* Tombol Check AI */}
            <Button
              type="button"
              onPress={handleCheckFraud}
              variant="primary"
              isDisabled={
                !adaGambarIdle || adaGambarLoading || totalGambar === 0
              }
              className="w-full font-semibold"
            >
              Cek AI
            </Button>

            {/* Tombol Submit Final */}
            <Button
              type="submit" // Akan memicu handleSubmit() di tag <Form> atas
              variant={semuaLulus ? "primary" : "secondary"}
              isDisabled={
                !semuaLulus ||
                adaGambarFraud ||
                adaGambarLoading ||
                totalGambar === 0
              }
              className="w-full font-semibold shadow-sm"
            >
              Submit
            </Button>
          </div>
        </Form>
      </Card.Content>
    </Card>
  );
}
