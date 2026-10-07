import { useFormDetectionLogic, type ProgramWithCategory } from "@/hooks/useFormDetectionLogic";
import { useReportSubmission } from "@/hooks/useReportSubmission";
import { isProgramUploadOpen } from "@/lib/program-period";
import ModalConfirmAction from "@/components/ui/ModalConfirmAction";
import type { ReportFormData } from "@/types/report.types";
import { ProgramCategory } from "@generated/prisma";
import {
  Button,
  Card,
  Chip,
  Form,
  Input,
  Label,
  ListBox,
  Select,
  Spinner,
  TextArea,
  TextField,
} from "@heroui/react";
import CalendarPicker from "../../../../../components/ui/calendar-picker";
import { useMemo, useState } from "react";
import { FiCheckCircle, FiInfo } from "react-icons/fi";

export interface InitialData {
  activityName?: string;
  programId?: string;
  tanggalKegiatan?: string;
  lokasi?: string;
  description?: string;
  updatedAt?: string;
}

interface PropTypes {
  programs: ProgramWithCategory[];
  initialData?: InitialData;
  reportId?: string;
}
export default function FormDetection({
  programs,
  initialData,
  reportId,
}: PropTypes) {
  const { state, actions } = useReportSubmission(reportId, undefined, initialData?.updatedAt);
  const {
    loadingText,
    isSubmitting,
    adaGambarIdle,
    adaGambarFraud,
    adaGambarLoading,
    semuaLulus,
    totalGambar,
  } = state;

  const { handleCheckFraud, tanganiSubmitFinal } = actions;
  const [pendingSubmission, setPendingSubmission] =
    useState<ReportFormData | null>(null);
  const requestSubmitConfirmation = (formData: ReportFormData) => {
    setPendingSubmission(formData);
  };
  const confirmSubmit = () => {
    if (!pendingSubmission) return;
    const formData = pendingSubmission;
    setPendingSubmission(null);
    tanganiSubmitFinal(formData);
  };
  const cancelSubmit = () => setPendingSubmission(null);

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
    isNoAiMode,
  } = useFormDetectionLogic({
    initialData,
    tanganiSubmitFinal: requestSubmitConfirmation,
    programs,
  });

  const safePrograms = Array.isArray(programs) ? programs : [];

  const availablePrograms = useMemo(() => {
    return safePrograms.filter((program) => {
      if (initialData?.programId === program.id) return true;
      return isProgramUploadOpen(program);
    });
  }, [safePrograms, initialData?.programId]);

  const uniqueCategories = useMemo(() => {
    const categoryMap = new Map();
    availablePrograms.forEach(
      (p: ProgramWithCategory) => {
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
  const pendingProgramName = safePrograms.find(
    (program) => program.id === pendingSubmission?.programId,
  )?.name;
  const pendingDateLabel = pendingSubmission?.tanggalKegiatan
    ? new Intl.DateTimeFormat("id-ID", {
        dateStyle: "long",
        timeZone: "UTC",
      }).format(new Date(`${pendingSubmission.tanggalKegiatan}T00:00:00Z`))
    : "-";

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
                        {programsInCategory.map((program: ProgramWithCategory) => (
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
            {!isNoAiMode ? (
              <>
                <Button
                  type="button"
                  onPress={handleCheckFraud}
                  variant="primary"
                  isDisabled={
                    isSubmitting || !adaGambarIdle || adaGambarLoading || totalGambar === 0
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
                    isSubmitting ||
                    !semuaLulus ||
                    adaGambarFraud ||
                    adaGambarLoading ||
                    totalGambar === 0
                  }
                  className="w-full font-semibold shadow-sm"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Spinner size="sm" /> Mengirim...
                    </span>
                  ) : (
                    "Submit"
                  )}
                </Button>
              </>
            ) : (
              <Button
                type="submit"
                variant="primary"
                isDisabled={
                  isSubmitting || totalGambar < 1 || totalGambar > 2 || isDateDisabled
                }
                className="col-span-2 w-full font-semibold shadow-sm"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Spinner size="sm" /> Mengirim...
                  </span>
                ) : (
                  "Kirim Bukti Foto (Siap diunggah)"
                )}
              </Button>
            )}
          </div>
        </Form>
      </Card.Content>
      <ModalConfirmAction
        isOpen={pendingSubmission !== null}
        onClose={cancelSubmit}
        onConfirm={confirmSubmit}
        title="Konfirmasi Submit Laporan"
        confirmText="Ya, Submit Laporan"
        isLoading={isSubmitting}
        description={
          <div className="space-y-4">
            <p className="text-sm leading-6 text-slate-600">
              Periksa kembali ringkasan sebelum laporan dikirim.
            </p>

            <section
              aria-label="Nama kegiatan"
              className="rounded-r-lg border-l-4 border-blue-600 bg-blue-50/70 px-4 py-3"
            >
              <p className="text-xs font-semibold text-blue-800">
                Nama kegiatan
              </p>
              <p className="mt-1 break-words text-base font-semibold leading-6 text-slate-900">
                {pendingSubmission?.activityName || "-"}
              </p>
            </section>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg bg-slate-50 px-4 py-3 text-sm sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-xs font-medium text-slate-600">
                  Program budaya
                </dt>
                <dd className="mt-1 break-words font-medium text-slate-800">
                  {pendingProgramName ?? "-"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-600">
                  Tanggal kegiatan
                </dt>
                <dd className="mt-1 font-medium text-slate-800">
                  {pendingDateLabel}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-medium text-slate-600">Lokasi</dt>
                <dd className="mt-1 break-words font-medium text-slate-800">
                  {pendingSubmission?.lokasi || "-"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-600">
                  Bukti foto
                </dt>
                <dd className="mt-1 font-medium text-slate-800">
                  {totalGambar} foto
                </dd>
              </div>
            </dl>

            <section aria-labelledby="submit-description-heading">
              <h3
                id="submit-description-heading"
                className="text-xs font-semibold text-slate-600"
              >
                Deskripsi
              </h3>
              <div
                role="region"
                aria-labelledby="submit-description-heading"
                tabIndex={0}
                className="mt-1 max-h-28 overflow-y-auto overscroll-contain whitespace-pre-wrap break-words rounded-md border border-slate-200 px-3 py-2 text-sm leading-5 text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                {pendingSubmission?.description || "-"}
              </div>
            </section>
          </div>
        }
      />
    </Card>
  );
}
