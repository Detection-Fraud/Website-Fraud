import Dropzone from "@/components/ui/Dropzone";
import { useProgramCategoryQuery } from "@/hooks/useProgramCategoryQuery";
import { useUploadMutation } from "@/hooks/useUploadMutation";
import { ProgramBudaya, ProgramCategory } from "@generated/prisma";
import {
  Button,
  Description,
  FieldError,
  FieldGroup,
  Fieldset,
  Form,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Surface,
  TextArea,
  TextField,
} from "@heroui/react";
import Image from "next/image";
import { useMemo, useState } from "react";
import {
  FiCalendar,
  FiFolder,
  FiGrid,
  FiLayers,
  FiTarget,
  FiX,
} from "react-icons/fi";

const TW_OPTIONS = [
  { key: "1", label: "TW I", range: "Jan – Mar" },
  { key: "2", label: "TW II", range: "Apr – Jun" },
  { key: "3", label: "TW III", range: "Jul – Sep" },
  { key: "4", label: "TW IV", range: "Okt – Des" },
] as const;

const TW_DATE_RANGES: Record<number, { startMonth: number; endMonth: number }> =
  {
    1: { startMonth: 0, endMonth: 2 },
    2: { startMonth: 3, endMonth: 5 },
    3: { startMonth: 6, endMonth: 8 },
    4: { startMonth: 9, endMonth: 11 },
  };

function computeTwDates(tw: number, year: number) {
  const range = TW_DATE_RANGES[tw];
  if (!range) return null;
  const startDate = new Date(year, range.startMonth, 1);
  const endDate = new Date(year, range.endMonth + 1, 0);
  return { startDate, endDate };
}

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = [
  { key: String(currentYear), label: String(currentYear) },
  { key: String(currentYear + 1), label: String(currentYear + 1) },
];

interface ModalFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isLoading?: boolean;
  program?: ProgramBudaya | null;
}

export default function ModalForm({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  program,
}: ModalFormProps) {
  const { data: categories = [], isLoading: isLoadingCategories } =
    useProgramCategoryQuery("KEGIATAN");

  const [selectedTw, setSelectedTw] = useState<string | null>(
    program?.tw != null ? String(program.tw) : null,
  );
  const [selectedYear, setSelectedYear] = useState<string>(
    program?.startDate
      ? String(new Date(program.startDate).getFullYear())
      : String(currentYear),
  );
  const [bannerUrl, setBannerUrl] = useState<string | null>(
    program?.bannerUrl ?? null,
  );

  const [frequencyValue, setFrequencyValue] = useState<string>(
    program?.frequency?.toString() ?? "1",
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    program?.categoryId ?? null,
  );

  // Sync state saat modal dibuka/ditutup atau program diubah
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevProgram, setPrevProgram] = useState(program);

  if (isOpen !== prevIsOpen || program !== prevProgram) {
    setPrevIsOpen(isOpen);
    setPrevProgram(program);

    setBannerUrl(program?.bannerUrl ?? null);
    setSelectedCategoryId(program?.categoryId ?? null);
    setFrequencyValue(program?.frequency?.toString() ?? "1");

    if (isOpen && program) {
      setSelectedTw(program.tw != null ? String(program.tw) : null);
      setSelectedYear(
        program.startDate
          ? String(new Date(program.startDate).getFullYear())
          : String(currentYear),
      );
    } else if (isOpen && !program) {
      setSelectedTw(null);
      setSelectedYear(String(currentYear));
    }
  }

  const { uploadFile, isUploading } = useUploadMutation();

  const handleBannerUpload = async (file: File) => {
    if (!file) return;
    try {
      const res = await uploadFile(file);
      setBannerUrl(res.url);
    } catch (err) {
      console.error("Gagal mengunggah banner", err);
    }
  };

  const selectedCategory = useMemo(() => {
    return categories.find((c: ProgramCategory) => c.id === selectedCategoryId);
  }, [categories, selectedCategoryId]);

  const handleCategoryChange = (key: React.Key | null) => {
    const catId = key ? String(key) : null;
    setSelectedCategoryId(catId);

    if (!program && catId) {
      const cat = categories.find((c: ProgramCategory) => c.id === catId);
      if (cat && cat.defaultFrequency != null) {
        setFrequencyValue(String(cat.defaultFrequency));
      }
    }
  };

  const computedDates = useMemo(() => {
    if (!selectedTw) return null;
    return computeTwDates(Number(selectedTw), Number(selectedYear));
  }, [selectedTw, selectedYear]);

  const formatDateId = (d: Date) =>
    d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  return (
    <Modal isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Backdrop variant="blur">
        <Modal.Container placement="center">
          <Modal.Dialog className="max-w-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden transition-all">
            <Modal.CloseTrigger />

            <Modal.Header className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-zinc-900">
              <div className="flex items-center gap-3">
                <Modal.Icon className="p-2.5 rounded-xl bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-slate-200">
                  <FiLayers className="size-5" />
                </Modal.Icon>
                <div>
                  <Modal.Heading className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {program ? "Edit Program Budaya" : "Tambah Program Budaya"}
                  </Modal.Heading>
                  <Description className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    {program
                      ? "Perbarui parameter, target frekuensi, dan jadwal pelaksanaan program"
                      : "Tambahkan sub-program budaya baru untuk Triwulan aktif"}
                  </Description>
                </div>
              </div>
            </Modal.Header>

            <Modal.Body className="px-6 py-5">
              <Surface
                variant="default"
                className="bg-transparent shadow-none p-0"
              >
                <Form onSubmit={onSubmit} className="space-y-5">
                  <Fieldset className="space-y-4">
                    <FieldGroup className="space-y-4">
                      {/* Baris 1: Nama Program (Full width) */}
                      <TextField
                        isRequired
                        name="name"
                        defaultValue={program?.name || ""}
                        validate={(v) =>
                          !v
                            ? "Nama program wajib diisi"
                            : v.length < 3
                              ? "Minimal 3 karakter"
                              : null
                        }
                      >
                        <Label className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                          Nama Program
                        </Label>
                        <Input
                          placeholder="Contoh: DONITA TW I 2026"
                          variant="secondary"
                          className="h-10 text-sm"
                        />
                        <FieldError className="text-xs text-red-500" />
                      </TextField>

                      {/* Baris 2: Kategori Induk & Target Frekuensi (2 Kolom Seimbang) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Kategori Induk */}
                        <div className="space-y-1">
                          <Select
                            aria-label="Pilih Kategori"
                            value={selectedCategoryId || ""}
                            onChange={handleCategoryChange}
                            placeholder={
                              isLoadingCategories
                                ? "Memuat kategori..."
                                : "Pilih kategori"
                            }
                            variant="secondary"
                            className="w-full"
                          >
                            <Label className="text-xs font-medium text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                              <FiFolder className="w-3.5 h-3.5 text-slate-400" />
                              Kategori Induk
                            </Label>
                            <Select.Trigger className="h-10 text-sm">
                              <Select.Value />
                              <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                              <ListBox>
                                {categories.map((cat: ProgramCategory) => (
                                  <ListBox.Item
                                    key={cat.id}
                                    id={cat.id}
                                    textValue={cat.name}
                                  >
                                    {cat.name}
                                    <ListBox.ItemIndicator />
                                  </ListBox.Item>
                                ))}
                              </ListBox>
                            </Select.Popover>
                            <Description className="text-[11px] text-slate-400">
                              Induk pilar kategori program
                            </Description>
                          </Select>
                          <input
                            type="hidden"
                            name="categoryId"
                            value={selectedCategoryId ?? ""}
                          />
                        </div>

                        {/* Target Frekuensi */}
                        <TextField
                          isRequired
                          name="frequency"
                          value={frequencyValue}
                          onChange={setFrequencyValue}
                          validate={(value) => {
                            const num = Number(value);
                            if (Number.isNaN(num)) return "Harus berupa angka";
                            if (num < 1) return "Minimal 1 target";
                            return null;
                          }}
                        >
                          <Label className="text-xs font-medium text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                            <FiTarget className="w-3.5 h-3.5 text-slate-400" />
                            Target Frekuensi (per TW)
                          </Label>
                          <Input
                            placeholder="Contoh: 24"
                            variant="secondary"
                            type="number"
                            min={1}
                            className="h-10 text-sm"
                          />
                          <Description className="text-[11px] text-slate-400">
                            {selectedCategory?.defaultFrequency != null
                              ? `Bawaan kategori: ${selectedCategory.defaultFrequency} laporan / TW`
                              : "Target jumlah laporan dalam 1 TW"}
                          </Description>
                          <FieldError className="text-xs text-red-500" />
                        </TextField>
                      </div>

                      {/* Baris 3: Jadwal & Periode Triwulan Card */}
                      <div className="rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/50 p-4 sm:p-4.5 space-y-3.5">
                        {/* Card Header & Year Selector */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60 dark:border-zinc-800/80">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50">
                              <FiCalendar className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                                Jadwal & Periode Pelaksanaan
                              </h4>
                              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                                Tanggal mulai dan selesai dihitung otomatis dari Triwulan
                              </p>
                            </div>
                          </div>

                          {/* Tahun Selector */}
                          <div className="flex items-center gap-2 self-start sm:self-auto">
                            <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">
                              Tahun:
                            </span>
                            <Select
                              aria-label="Pilih Tahun"
                              name="year"
                              value={selectedYear}
                              onChange={(val) =>
                                setSelectedYear(
                                  val ? String(val) : String(currentYear),
                                )
                              }
                              variant="secondary"
                              className="w-28"
                            >
                              <Select.Trigger className="h-8 text-xs font-semibold">
                                <Select.Value />
                                <Select.Indicator />
                              </Select.Trigger>
                              <Select.Popover>
                                <ListBox>
                                  {YEAR_OPTIONS.map((y) => (
                                    <ListBox.Item
                                      key={y.key}
                                      id={y.key}
                                      textValue={y.label}
                                    >
                                      {y.label}
                                      <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                  ))}
                                </ListBox>
                              </Select.Popover>
                            </Select>
                          </div>
                        </div>

                        {/* Triwulan Segmented Pills */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                              <FiGrid className="w-3.5 h-3.5 text-slate-400" />
                              Pilih Triwulan <span className="text-red-500">*</span>
                            </Label>
                            {!selectedTw && (
                              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                                Wajib dipilih
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            {TW_OPTIONS.map((tw) => {
                              const isSelected = selectedTw === tw.key;
                              return (
                                <button
                                  key={tw.key}
                                  type="button"
                                  onClick={() => setSelectedTw(tw.key)}
                                  className={`group relative flex flex-col items-center justify-center py-2.5 px-2 rounded-xl text-center border transition-all cursor-pointer select-none active:scale-[0.98] ${
                                    isSelected
                                      ? "bg-slate-900 text-white border-slate-900 shadow-sm dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100 ring-2 ring-slate-900/10 dark:ring-zinc-100/20"
                                      : "bg-white dark:bg-zinc-900/90 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-slate-50/80 dark:hover:bg-zinc-800/60"
                                  }`}
                                >
                                  <span className="text-xs font-bold tracking-tight">
                                    {tw.label}
                                  </span>
                                  <span
                                    className={`text-[10.5px] mt-0.5 font-medium ${
                                      isSelected
                                        ? "text-slate-300 dark:text-zinc-600"
                                        : "text-slate-400 dark:text-zinc-400"
                                    }`}
                                  >
                                    {tw.range}
                                  </span>
                                  {isSelected && (
                                    <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-emerald-400 dark:bg-emerald-600" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Live Computed Date Range Preview */}
                        {computedDates ? (
                          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/50 text-blue-900 dark:text-blue-200 text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <FiCalendar className="size-4 text-blue-600 dark:text-blue-400 shrink-0" />
                              <div className="truncate">
                                <span className="text-blue-700 dark:text-blue-300 font-normal">
                                  Rentang Pelaksanaan:{" "}
                                </span>
                                <span className="font-semibold text-blue-950 dark:text-blue-100">
                                  {formatDateId(computedDates.startDate)} –{" "}
                                  {formatDateId(computedDates.endDate)}
                                </span>
                              </div>
                            </div>
                            <span className="hidden sm:inline-block shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100/90 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                              3 Bulan Penuh
                            </span>
                          </div>
                        ) : (
                          <div className="px-3.5 py-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-dashed border-amber-200 dark:border-amber-900/40 text-amber-700 dark:text-amber-400 text-xs text-center">
                            Pilih salah satu Triwulan di atas untuk mengaktifkan rentang tanggal otomatis
                          </div>
                        )}

                        {/* Hidden inputs untuk FormData submission */}
                        <input
                          type="hidden"
                          name="tw"
                          value={selectedTw ?? ""}
                        />
                        {computedDates && (
                          <>
                            <input
                              type="hidden"
                              name="startDate"
                              value={computedDates.startDate.toISOString()}
                            />
                            <input
                              type="hidden"
                              name="endDate"
                              value={computedDates.endDate.toISOString()}
                            />
                          </>
                        )}
                      </div>

                      {/* Baris 4: Deskripsi (Full width) */}
                      <TextField
                        name="description"
                        defaultValue={program?.description || ""}
                      >
                        <Label className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                          Deskripsi / Catatan Program
                        </Label>
                        <TextArea
                          placeholder="Catatan tujuan atau mekanisme pelaksanaan program..."
                          rows={2}
                          className="text-sm resize-none"
                          variant="secondary"
                        />
                      </TextField>

                      {/* Baris 5: Banner Poster Kegiatan */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-slate-700 dark:text-zinc-300 flex items-center justify-between">
                          <span>Poster / Banner Kegiatan</span>
                          <span className="text-[11px] text-slate-400 font-normal">
                            (Opsional — fallback ke banner pilar)
                          </span>
                        </Label>

                        {bannerUrl ? (
                          <div className="relative w-full h-28 rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-800 group">
                            <Image
                              src={bannerUrl}
                              alt="Banner Preview"
                              fill
                              unoptimized
                              className="object-cover"
                            />
                            <Button
                              type="button"
                              isIconOnly
                              onClick={() => setBannerUrl(null)}
                              className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white text-xs transition-colors"
                            >
                              <FiX className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <Dropzone
                            variant="compact"
                            maxSizeMb={3}
                            isDisabled={isUploading}
                            label={
                              isUploading
                                ? "Mengunggah..."
                                : "Klik atau seret poster ke sini"
                            }
                            onFileSelected={(files) =>
                              handleBannerUpload(files[0])
                            }
                          />
                        )}

                        <input
                          type="hidden"
                          name="bannerUrl"
                          value={bannerUrl ?? ""}
                        />
                      </div>
                    </FieldGroup>

                    <Fieldset.Actions className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-zinc-900">
                      <Button
                        type="button"
                        variant="secondary"
                        onPress={onClose}
                        isDisabled={isLoading}
                        className="px-4 h-9 text-xs font-medium"
                      >
                        Batal
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        isPending={isLoading}
                        isDisabled={!selectedTw}
                        className="px-5 h-9 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900"
                      >
                        {isLoading
                          ? "Menyimpan..."
                          : program
                            ? "Perbarui Program"
                            : "Simpan Program"}
                      </Button>
                    </Fieldset.Actions>
                  </Fieldset>
                </Form>
              </Surface>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
