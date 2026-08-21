import MonthPicker from "@/components/ui/month-picker";
import { Banner } from "@/hooks/useBanners";
import { useSearchPic } from "@/hooks/useSearchPic";
import { api } from "@/lib/api";
import { PicSearchResult } from "@/types/pic.types";
import {
  Autocomplete,
  Button,
  DateValue,
  EmptyState,
  FieldError,
  Form,
  Input,
  Key,
  Label,
  ListBox,
  ListBoxItem,
  Modal,
  SearchField,
  TextField,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { useState } from "react";
import { FiSave } from "react-icons/fi";
import { PiUploadSimple } from "react-icons/pi";
import BannerPreviewCard from "./BannerPreviewCard";

interface BannerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: BannerFormData) => void;
  isLoading?: boolean;
  banner?: Banner | null; // null = mode tambah, Banner = mode edit
}

export interface BannerFormData {
  imageUrl: string;
  name: string;
  role: string;
  unit: string;
  period: string;
  order: number;
}

const BULAN_INDO = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function formatPeriod(dateValue: DateValue | null): string {
  if (!dateValue) return "";

  const month = dateValue.month;
  const year = dateValue.year;
  return `${BULAN_INDO[month - 1]} ${year}`;
}

function parsePeriod(period: string | undefined): DateValue | null {
  if (!period) return null;
  const parts = period.split(" ");
  if (parts.length !== 2) return null;
  const monthName = parts[0];
  const year = parseInt(parts[1], 10);
  if (isNaN(year)) return null;

  const monthIndex = BULAN_INDO.indexOf(monthName);
  if (monthIndex === -1) return null;

  const monthStr = String(monthIndex + 1).padStart(2, "0");
  try {
    return parseDate(`${year}-${monthStr}-01`);
  } catch (e) {
    return null;
  }
}

export default function BannerFormModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  banner,
}: BannerFormModalProps) {
  const isEditMode = !!banner;

  const {
    query: picQuery,
    results: picResults,
    isLoading: isPicSearching,
    selectedPic,
    setQuery: setPicQuery,
    setSelectedPic,
    clearSelected: clearPicSelected,
  } = useSearchPic({ role: "PIC" });

  const [periodDate, setPeriodDate] = useState<DateValue | null>(null);
  const [jabatan, setJabatan] = useState("");
  const [picNameState, setPicNameState] = useState("");
  const [selectedUnitName, setSelectedUnitName] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const periodText = formatPeriod(periodDate);

  // Reset state saat modal dibuka/ditutup
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevBanner, setPrevBanner] = useState(banner);

  if (isOpen !== prevIsOpen || banner !== prevBanner) {
    setPrevIsOpen(isOpen);
    setPrevBanner(banner);

    if (isOpen && banner) {
      // Mode edit — prefill data
      setJabatan(banner.role);
      setSelectedUnitName(banner.unit);
      setPicNameState(banner.name);
      setPeriodDate(parsePeriod(banner.period));
      setImagePreview(banner.imageUrl);
      setUploadedUrl(banner.imageUrl);
      setUploadError(null);
      setPicQuery(banner.name);
    } else if (isOpen && !banner) {
      // Mode tambah — reset
      setPeriodDate(null);
      setJabatan("");
      setSelectedUnitName("");
      setPicNameState("");
      setImagePreview(null);
      setUploadedUrl("");
      setUploadError(null);
      clearPicSelected();
    }
  }

  /**
   * Handler upload gambar via /api/upload
   * Menggunakan FormData agar sesuai dengan endpoint yang sudah ada
   */
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validasi client-side (sebagai UX, backend tetap validasi ulang)
    if (!["image/jpeg", "image/png", "image/jpg"].includes(file.type)) {
      setUploadError("Format file harus JPG or PNG");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError("Ukuran file maksimal 2MB");
      return;
    }

    // Preview lokal
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Upload ke server
    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await api.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setUploadedUrl(response.data.url);
    } catch (err) {
      console.error("Upload gagal:", err);
      setUploadError("Upload gagal. Coba lagi.");
      setImagePreview(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handlePicSelected = (key: Key | null) => {
    if (!key) {
      setSelectedPic(null);
      setPicNameState("");
      setSelectedUnitName("");
      return;
    }

    const found = picResults.find((r: PicSearchResult) => r.id === String(key));
    setSelectedPic(found ?? null);

    if (found) {
      setPicNameState(found.name);
      if (found.unit) {
        setSelectedUnitName(found.unit.name);
      }
    }
  };

  /**
   * Handler submit form
   */
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!uploadedUrl) {
      setUploadError("Foto banner wajib diupload");
      return;
    }

    if (!picNameState) {
      setUploadError("Mohon pilih PIC terlebih dahulu");
      return;
    }

    onSubmit({
      imageUrl: uploadedUrl,
      name: picNameState,
      role: jabatan,
      unit: selectedUnitName,
      period: periodText,
      order: banner?.order ?? 0,
    });
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Backdrop variant="blur">
        <Modal.Container placement="center">
          <Modal.Dialog className="max-w-3xl w-full">
            <Modal.CloseTrigger />

            <Modal.Header className="pb-2">
              <Modal.Heading className="text-xl font-bold text-slate-800">
                {isEditMode ? "Edit Banner" : "Tambah Banner"}
              </Modal.Heading>
              <p className="text-sm text-slate-500 mt-0.5">
                Data akan tampil di carousel halaman login
              </p>
            </Modal.Header>

            <Modal.Body>
              <Form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Kolom kiri */}
                  <div className="space-y-4">
                    <MonthPicker
                      value={periodDate}
                      onChange={(value) => setPeriodDate(value)}
                      label="Bulan"
                      isRequired
                    />

                    <div className="flex flex-col gap-1.5">
                      <Autocomplete
                        value={selectedPic?.id ?? null}
                        onChange={handlePicSelected}
                        allowsEmptyCollection
                        selectionMode="single"
                        placeholder="Nama Lengkap"
                        aria-label="Cari nama PIC"
                        className={"w-full"}
                      >
                        <Label className="text-xs font-medium text-slate-700">
                          Nama PIC
                        </Label>
                        <Autocomplete.Trigger>
                          <Autocomplete.Value>
                            {({
                              defaultChildren,
                              isPlaceholder,
                              state,
                            }: any) => {
                              if (
                                state.selectedItems.length === 0 &&
                                picNameState
                              ) {
                                return picNameState;
                              }
                              return defaultChildren;
                            }}
                          </Autocomplete.Value>
                          <Autocomplete.ClearButton />
                          <Autocomplete.Indicator />
                        </Autocomplete.Trigger>

                        <Autocomplete.Popover>
                          <Autocomplete.Filter
                            inputValue={picQuery}
                            onInputChange={(val) => {
                              setPicQuery(val);
                              if (selectedPic && val !== selectedPic.name) {
                                setSelectedPic(null);
                                setPicNameState("");
                                setSelectedUnitName("");
                              }
                            }}
                          >
                            <SearchField
                              autoFocus
                              name="search-pic"
                              variant="secondary"
                              className={"w-full"}
                            >
                              <SearchField.Group>
                                <SearchField.SearchIcon />
                                <SearchField.Input placeholder="Cari nama PIC..." />
                                <SearchField.ClearButton />
                              </SearchField.Group>
                            </SearchField>

                            <ListBox
                              renderEmptyState={() => (
                                <EmptyState>
                                  {isPicSearching
                                    ? "Mencari..."
                                    : picQuery.length < 2
                                      ? "Ketik nama untuk mencari"
                                      : "PIC tidak ditemukan"}
                                </EmptyState>
                              )}
                            >
                              {picResults.map((pic: PicSearchResult) => (
                                <ListBoxItem
                                  key={pic.id}
                                  textValue={pic.name}
                                  id={pic.id}
                                >
                                  <div className="flex flex-col">
                                    <span className="font-medium">
                                      {pic.name}
                                    </span>
                                    {pic.unit && (
                                      <span className="text-xs text-slate-400">
                                        {pic.unit.name}
                                      </span>
                                    )}
                                  </div>
                                </ListBoxItem>
                              ))}
                            </ListBox>
                          </Autocomplete.Filter>
                        </Autocomplete.Popover>
                      </Autocomplete>

                      {picQuery.length > 0 && picQuery.length < 2 && (
                        <p className="text-xs text-slate-400">
                          Ketik minimal 2 karakter untuk mencari
                        </p>
                      )}
                    </div>

                    {/* UNIT / WILAYAH (Read-Only) */}
                    <TextField
                      isReadOnly
                      name="unit"
                      value={selectedUnitName}
                      className="w-full"
                    >
                      <Label className="text-xs font-medium text-slate-700">
                        Unit / Wilayah
                      </Label>
                      <Input
                        placeholder="Terisi otomatis setelah memilih PIC"
                        variant="secondary"
                        className="bg-slate-50 cursor-not-allowed opacity-80"
                      />
                    </TextField>

                    {/* Jabatan */}
                    <TextField
                      isRequired
                      name="jabatan"
                      value={jabatan}
                      onChange={(value) => setJabatan(value)}
                      validate={(value) => {
                        if (!value) return "Jabatan wajib diisi";
                        if (value.length < 2)
                          return "Jabatan minimal 2 karakter";
                        return null;
                      }}
                    >
                      <Label>Jabatan</Label>
                      <Input
                        placeholder="Contoh: Koordinator Distribusi"
                        variant="secondary"
                      />
                      <FieldError />
                    </TextField>

                    {/* FOTO PIC (UPLOAD) */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">
                        Foto PIC
                      </Label>

                      <label
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
                          uploadError
                            ? "border-red-300 bg-red-50"
                            : "border-slate-200 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/30"
                        }`}
                      >
                        <PiUploadSimple className="w-5 h-5 text-slate-400 shrink-0" />
                        <span className="text-sm text-slate-500">
                          {isUploading
                            ? "Mengupload..."
                            : uploadedUrl
                              ? "Klik untuk ganti foto"
                              : "Klik untuk upload foto"}
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png"
                          onChange={handleFileSelect}
                          className="hidden"
                          disabled={isUploading}
                        />
                      </label>

                      <p className="text-xs text-slate-400">
                        Format: JPG, PNG. Disarankan foto portrait.
                      </p>

                      {uploadError && (
                        <p className="text-red-500 text-xs">{uploadError}</p>
                      )}
                    </div>
                  </div>

                  {/* Kolom kanan */}
                  <div>
                    <BannerPreviewCard
                      imageUrl={imagePreview}
                      name={picNameState}
                      role={jabatan}
                      unit={selectedUnitName}
                      period={periodText}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={onClose}
                    isDisabled={isLoading || isUploading}
                  >
                    Batal
                  </Button>

                  <Button
                    type="submit"
                    variant="primary"
                    isPending={isLoading || isUploading}
                    isDisabled={isUploading}
                  >
                    <FiSave className="w-4 h-4" />
                    {isLoading
                      ? "Menyimpan"
                      : isEditMode
                        ? "Simpan Perubahan"
                        : "Tambah Banner"}
                  </Button>
                </div>
              </Form>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
