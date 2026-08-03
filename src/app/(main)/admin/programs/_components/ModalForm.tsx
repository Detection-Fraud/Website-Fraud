import CalendarPicker from "@/app/(main)/pic/_components/calendar-picker";
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
import { DateValue, parseDate } from "@internationalized/date";
import Image from "next/image";
import { useMemo, useState } from "react";
import { FiCalendar, FiFolder, FiGrid, FiTarget, FiX } from "react-icons/fi";

const TW_OPTIONS = [
  { key: "1", label: "TW I", range: "Jan – Mar" },
  { key: "2", label: "TW II", range: "Apr – Jun" },
  { key: "3", label: "TW III", range: "Jul – Sep" },
  { key: "4", label: "TW IV", range: "Okt – Des" },
] as const;

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
    useProgramCategoryQuery();

  const [startValue, setStartValue] = useState<DateValue | null>(null);
  const [endValue, setEndValue] = useState<DateValue | null>(null);

  const [bannerUrl, setBannerUrl] = useState<string | null>(
    program?.bannerUrl ?? null,
  );

  // updated start
  // Updated: Tambah state controlled untuk frequencyValue dan selectedCategoryId
  const [frequencyValue, setFrequencyValue] = useState<string>(
    program?.frequency?.toString() ?? "1",
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    program?.categoryId ?? null,
  );
  // updated end

  const isInvalidDate = endValue && startValue ? endValue < startValue : false;

  // Sync state saat modal dibuka/ditutup atau program diubah
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevProgram, setPrevProgram] = useState(program);

  if (isOpen !== prevIsOpen || program !== prevProgram) {
    setPrevIsOpen(isOpen);
    setPrevProgram(program);

    setBannerUrl(program?.bannerUrl ?? null);

    // updated start
    // Updated: Sync state categoryId dan frequencyValue saat modal opened / program changed
    setSelectedCategoryId(program?.categoryId ?? null);
    setFrequencyValue(program?.frequency?.toString() ?? "1");
    // updated end

    if (isOpen && program) {
      try {
        if (program.startDate) {
          const dateOnly = new Date(program.startDate)
            .toISOString()
            .split("T")[0];
          setStartValue(parseDate(dateOnly));
        }
        if (program.endDate) {
          const dateOnly = new Date(program.endDate)
            .toISOString()
            .split("T")[0];
          setEndValue(parseDate(dateOnly));
        }
      } catch (e) {
        console.error("Gagal parsing tanggal", e);
      }
    } else if (isOpen && !program) {
      setStartValue(null);
      setEndValue(null);
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

  // updated start
  // Updated: Helper kategori terpilih untuk deskripsi hint & smart sync
  const selectedCategory = useMemo(() => {
    return categories.find((c: ProgramCategory) => c.id === selectedCategoryId);
  }, [categories, selectedCategoryId]);

  // Updated: Handler smart sync default frequency saat kategori dipilih (mode Create)
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
  // updated end

  const durationText = useMemo(() => {
    if (!startValue || !endValue || isInvalidDate) return null;
    const start = new Date(startValue.toString());
    const end = new Date(endValue.toString());
    const diffDays = Math.ceil(
      Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );
    const diffMonths = Math.round(diffDays / 30);
    return `${diffDays} Hari (~${diffMonths} Bulan)`;
  }, [startValue, endValue, isInvalidDate]);

  return (
    <Modal isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Backdrop variant="blur">
        <Modal.Container placement="center">
          <Modal.Dialog className="max-w-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden transition-all">
            <Modal.CloseTrigger />

            <Modal.Header className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-zinc-900">
              <div className="flex items-center gap-3">
                <Modal.Icon className="p-2.5 rounded-xl bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-slate-200">
                  <FiFolder className="size-5" />
                </Modal.Icon>
                <div>
                  <Modal.Heading className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {program ? "Edit Program Budaya" : "Tambah Program Budaya"}
                  </Modal.Heading>
                  <Description className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    {program
                      ? "Perbarui parameter dan frekuensi program budaya"
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
                      {/* Baris 1: Nama Program (full width) */}
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

                      {/* Baris 2: Kategori | TW | Frekuensi — 3 kolom */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* Kategori Induk */}
                        {/* updated start */}
                        {/* Updated: Controlled Select Kategori dengan selectedKey & onSelectionChange */}
                        <Select
                          name="categoryId"
                          value={selectedCategoryId}
                          onChange={handleCategoryChange}
                          placeholder={
                            isLoadingCategories ? "Memuat..." : "Pilih kategori"
                          }
                          variant="secondary"
                          className="w-full"
                        >
                          {/* updated end */}
                          <Label className="text-xs font-medium text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                            <FiFolder className="w-3.5 h-3.5 text-slate-400" />
                            Kategori
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
                            Induk kategori program
                          </Description>
                        </Select>

                        {/* Triwulan — BARU */}
                        <Select
                          name="tw"
                          defaultSelectedKey={
                            program?.tw != null ? String(program.tw) : undefined
                          }
                          placeholder="Pilih TW"
                          variant="secondary"
                          className="w-full"
                        >
                          <Label className="text-xs font-medium text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                            <FiGrid className="w-3.5 h-3.5 text-slate-400" />
                            Triwulan
                          </Label>
                          <Select.Trigger className="h-10 text-sm">
                            <Select.Value />
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox>
                              {TW_OPTIONS.map((tw) => (
                                <ListBox.Item
                                  key={tw.key}
                                  id={tw.key}
                                  textValue={`${tw.label} (${tw.range})`}
                                >
                                  <div className="flex items-center justify-between w-full gap-4">
                                    <span className="font-medium">
                                      {tw.label}
                                    </span>
                                    <span className="text-xs text-slate-400">
                                      {tw.range}
                                    </span>
                                  </div>
                                  <ListBox.ItemIndicator />
                                </ListBox.Item>
                              ))}
                            </ListBox>
                          </Select.Popover>
                          <Description className="text-[11px] text-slate-400">
                            Opsional jika berlaku sepanjang tahun
                          </Description>
                        </Select>

                        {/* Target Frekuensi */}
                        {/* updated start */}
                        {/* Updated: Controlled TextField Target dengan value, onChange & hint defaultFrequency */}
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
                            Target (per TW)
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
                              : "Target laporan dalam 1 TW"}
                          </Description>
                          <FieldError className="text-xs text-red-500" />
                        </TextField>
                        {/* updated end */}
                      </div>

                      {/* Baris 3: Deskripsi (full width) */}
                      <TextField
                        name="description"
                        defaultValue={program?.description || ""}
                      >
                        <Label className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                          Deskripsi / Catatan
                        </Label>
                        <TextArea
                          placeholder="Catatan pelaksanaan program..."
                          rows={2}
                          className="text-sm resize-none"
                          variant="secondary"
                        />
                      </TextField>

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

                      {/* Section Periode Pelaksanaan */}
                      <div className="pt-2 border-t border-slate-100 dark:border-zinc-900">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                            <FiCalendar className="w-3.5 h-3.5 text-slate-400" />
                            Periode Pelaksanaan
                          </span>
                          {durationText && (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                              {durationText}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <CalendarPicker
                            name="startDate"
                            value={startValue}
                            onChange={(val) => setStartValue(val)}
                            label="Tanggal Mulai"
                            isRequired
                            variant="secondary"
                          />
                          <CalendarPicker
                            name="endDate"
                            value={endValue}
                            onChange={(val) => setEndValue(val)}
                            label="Tanggal Berakhir"
                            isRequired
                            variant="secondary"
                            isInvalid={isInvalidDate}
                          />
                        </div>
                        {isInvalidDate && (
                          <p className="text-xs text-red-500 mt-1 font-medium">
                            Tanggal selesai harus setelah tanggal mulai.
                          </p>
                        )}
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
