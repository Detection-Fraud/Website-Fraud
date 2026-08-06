"use client";

import Dropzone from "@/components/ui/Dropzone";
import { CategoryWithStats } from "@/hooks/useCategoryList";
import { useCategoryMutation } from "@/hooks/useCategoryMutation";
import { useUploadMutation } from "@/hooks/useUploadMutation";
import {
  Button,
  ColorArea,
  ColorPicker,
  ColorSlider,
  ColorSwatch,
  ColorSwatchPicker,
  Form,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  TextField,
  parseColor,
} from "@heroui/react";
import { useEffect, useState } from "react";
import { FiTrash2 } from "react-icons/fi";

interface ModalFormCategoryProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: CategoryWithStats | null;
}

export default function ModalFormCategory({
  isOpen,
  onClose,
  initialData,
}: ModalFormCategoryProps) {
  const { createCategory, updateCategory, isCreating, isUpdating } =
    useCategoryMutation();
  const { uploadFile, isUploading } = useUploadMutation();

  const isEdit = !!initialData;
  const [color, setColor] = useState(() => parseColor("#3b82f6"));
  const [targetUnit, setTargetUnit] = useState<string>("KEGIATAN");
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setColor(parseColor(initialData.color || "#3b82f6"));
      setTargetUnit(initialData.targetUnit || "KEGIATAN");
      setBannerUrl(initialData.bannerUrl || null);
      setImagePreview(initialData.bannerUrl || null);
    } else {
      setColor(parseColor("#3b82f6"));
      setTargetUnit("KEGIATAN");
      setBannerUrl(null);
      setImagePreview(null);
    }
  }, [initialData, isOpen]);

  const handleBannerUpload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    // Preview lokal instan
    setImagePreview(URL.createObjectURL(file));

    try {
      const res = await uploadFile(file);
      setBannerUrl(res.url);
    } catch (err) {
      setImagePreview(initialData?.bannerUrl || null);
    }
  };

  const handleRemoveBanner = () => {
    setBannerUrl(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const payload = {
      name: formData.get("name") as string,
      color: color.toString("hex"),
      bannerUrl: bannerUrl,
      targetUnit: targetUnit as "KEGIATAN" | "PARTISIPASI_PERSEN",
      defaultFrequency: Number(formData.get("defaultFrequency") || 1),
    };

    try {
      if (isEdit && initialData) {
        await updateCategory({ id: initialData.id, data: payload });
      } else {
        await createCategory(payload);
      }
      onClose();
    } catch (err) {
      // Handled by mutation toast
    }
  };

  const isPartisipasi = targetUnit === "PARTISIPASI_PERSEN";
  const isLoading = isCreating || isUpdating || isUploading;
  return (
    <Modal>
      <Modal.Backdrop
        isOpen={isOpen}
        onOpenChange={onClose}
        className="backdrop-blur-sm"
      >
        <Modal.Container scroll="outside">
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Modal.Header className="flex flex-col gap-1">
              <Modal.Heading className="text-lg font-bold text-foreground">
                {isEdit ? "Edit Kategori Program" : "Tambah Kategori Program"}
              </Modal.Heading>
              <p className="text-xs text-muted">
                {isEdit
                  ? "Perbarui atribut master kategori program budaya."
                  : "Buat template kategori baru untuk program budaya."}
              </p>
            </Modal.Header>

            <Form validationBehavior="native" onSubmit={handleSubmit}>
              <Modal.Body className="space-y-4 py-2">
                {/* Nama kategori */}
                <TextField
                  name="name"
                  isRequired
                  defaultValue={initialData?.name ?? ""}
                >
                  <Label className="text-xs font-semibold text-slate-700">
                    Nama Kategori
                  </Label>
                  <Input
                    placeholder="Contoh: DONITA, MAKNYOS"
                    autoComplete="off"
                    className={"mt-1"}
                  />
                </TextField>

                {/* WARNA IDENTITAS */}
                <div className="flex flex-col gap-1">
                  <Label className="text-xs font-semibold text-slate-700">
                    Warna Identitas
                  </Label>
                  <ColorPicker value={color} onChange={setColor}>
                    <ColorPicker.Trigger className={"flex items-center gap-2"}>
                      <ColorSwatch size="lg" />
                      <Label className="font-mono text-xs uppercase text-slate-600">
                        {color.toString("hex")}
                      </Label>
                    </ColorPicker.Trigger>
                    <ColorPicker.Popover className={"gap-2 p-3"}>
                      <ColorArea
                        aria-label="Color Area"
                        className={"max-w-full"}
                        colorSpace="hsb"
                        xChannel="saturation"
                        yChannel="brightness"
                      >
                        <ColorArea.Thumb />
                      </ColorArea>
                      <ColorSlider
                        aria-label="Hue"
                        channel="hue"
                        className={"gap-1 px-1"}
                        colorSpace="hsb"
                      >
                        <ColorSlider.Track>
                          <ColorSlider.Thumb />
                        </ColorSlider.Track>
                      </ColorSlider>
                      <ColorSwatchPicker
                        className={"justify-center pt-2"}
                        size="xs"
                      >
                        {[
                          "#3b82f6",
                          "#ef4444",
                          "#10b981",
                          "#f59e0b",
                          "#8b5cf6",
                          "#ec4899",
                          "#06b6d4",
                          "#6366f1",
                        ].map((preset) => (
                          <ColorSwatchPicker.Item key={preset} color={preset}>
                            <ColorSwatchPicker.Swatch />
                          </ColorSwatchPicker.Item>
                        ))}
                      </ColorSwatchPicker>
                    </ColorPicker.Popover>
                  </ColorPicker>
                </div>

                {/* BANNER UPLOAD FILE */}
                <div className="flex flex-col gap-1">
                  <Label className="text-xe font-semibold text-slate-700">
                    Gambar Banner (Opsional)
                  </Label>
                  {imagePreview ? (
                    <div className="relative group rounded-xl overflow-hidden border border-slate-200 h-32 bg-slate-100 flex items-center justify-center">
                      <img
                        src={imagePreview}
                        alt="Banner Preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          variant="danger"
                          type="button"
                          onPress={handleRemoveBanner}
                          isDisabled={isLoading}
                        >
                          <FiTrash2 className="w-4 h-4 mr-1" />
                          Hapus Foto
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Dropzone
                      variant="compact"
                      multiple={false}
                      maxSizeMb={2}
                      label="Klik atau drop gambar banner di sini"
                      onFileSelected={handleBannerUpload}
                      isDisabled={isLoading}
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* TARGET unit */}
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs font-semibold text-slate-700">
                      Satuan Target
                    </Label>
                    <Select
                      value={targetUnit}
                      onChange={(val) => setTargetUnit(String(val))}
                      className={"mt-1"}
                      aria-label="Satuan Target"
                    >
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>

                      <Select.Popover>
                        <ListBox>
                          <ListBox.Item id={"KEGIATAN"} textValue="KEGIATAN">
                            Kegiatan (Jumlah)
                          </ListBox.Item>
                          <ListBox.Item
                            id="PARTISIPASI_PERSEN"
                            textValue="PARTISIPASI_PERSEN"
                          >
                            Partisipasi (%)
                          </ListBox.Item>
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>

                  {/* Default Frequency */}
                  {isPartisipasi ? (
                    <>
                      <input type="hidden" name="defaultFrequency" value="1" />
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs font-semibold text-slate-700">
                          Default Frekuensi / TW
                        </Label>
                        <div className="mt-1 h-10 flex items-center px-3 rounded-lg bg-slate-50 border border-slate-200">
                          <span className="text-xs text-slate-400 italic">
                            Tidak digunakan — data Partisipasi diimport via
                            Excel
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <TextField
                      name="defaultFrequency"
                      isRequired
                      defaultValue={String(initialData?.defaultFrequency ?? 1)}
                    >
                      <Label className="text-xs font-semibold text-slate-700">
                        Default Frekuensi / TW
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        placeholder="1"
                        className="mt-1"
                      />
                    </TextField>
                  )}
                </div>
              </Modal.Body>

              <Modal.Footer className="mt-4 flex items-center justify-end gap-2">
                <Button
                  variant="secondary"
                  type="button"
                  onPress={onClose}
                  isDisabled={isLoading}
                >
                  Batal
                </Button>
                <Button type="submit" isDisabled={isLoading}>
                  {isLoading
                    ? "Menyimpan"
                    : isEdit
                      ? "Simpan Perubahan"
                      : "Tambah Kategori"}
                </Button>
              </Modal.Footer>
            </Form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
