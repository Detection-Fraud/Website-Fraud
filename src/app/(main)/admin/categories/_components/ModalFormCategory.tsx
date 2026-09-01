"use client";

import Dropzone from "@/components/ui/Dropzone";
import { CategoryWithStats } from "@/hooks/useCategoryList";
import { useCategoryMutation } from "@/hooks/useCategoryMutation";
import { useUploadMutation } from "@/hooks/useUploadMutation";
import {
  CATEGORY_CAPABILITY_PRESETS,
  getCategoryCapabilityPreset,
  getCategoryCapabilityPresetForForm,
} from "@/lib/category-capability-presets";
import {
  Button,
  ColorArea,
  ColorPicker,
  ColorSlider,
  ColorSwatch,
  ColorSwatchPicker,
  Description,
  Form,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  TextField,
  parseColor,
} from "@heroui/react";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const [capabilityPresetId, setCapabilityPresetId] = useState<string>(
    CATEGORY_CAPABILITY_PRESETS[0].id,
  );
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const previewObjectUrlRef = useRef<string | null>(null);

  const revokePreviewObjectUrl = useCallback(() => {
    const objectUrl = previewObjectUrlRef.current;
    if (objectUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(objectUrl);
    }
    previewObjectUrlRef.current = null;
  }, []);

  useEffect(() => {
    revokePreviewObjectUrl();
    if (initialData) {
      setColor(parseColor(initialData.color || "#3b82f6"));
      setBannerUrl(initialData.bannerUrl || null);
      setImagePreview(initialData.bannerUrl || null);
      const persistedPreset = getCategoryCapabilityPreset({
        targetUnit: initialData.targetUnit,
        evidenceMode: initialData.evidenceMode,
        scoreInputMode: initialData.scoreInputMode,
      });
      setCapabilityPresetId(
        persistedPreset.isSelectable
          ? persistedPreset.id
          : CATEGORY_CAPABILITY_PRESETS[0].id,
      );
    } else {
      setColor(parseColor("#3b82f6"));
      setBannerUrl(null);
      setImagePreview(null);
      setCapabilityPresetId(CATEGORY_CAPABILITY_PRESETS[0].id);
    }
  }, [initialData, isOpen, revokePreviewObjectUrl]);

  useEffect(() => {
    return revokePreviewObjectUrl;
  }, [revokePreviewObjectUrl]);

  const handleBannerUpload = async (files: File[]) => {
    if (bannerUrl || imagePreview) return;
    const file = files[0];
    if (!file) return;

    revokePreviewObjectUrl();

    // Preview lokal instan
    const objectUrl = URL.createObjectURL(file);
    previewObjectUrlRef.current = objectUrl;
    setImagePreview(objectUrl);

    try {
      const res = await uploadFile(file);
      revokePreviewObjectUrl();
      setBannerUrl(res.url);
      setImagePreview(res.url);
    } catch {
      revokePreviewObjectUrl();
      setBannerUrl(null);
      setImagePreview(null);
    }
  };

  const handleRemoveBanner = () => {
    revokePreviewObjectUrl();
    setBannerUrl(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const capabilityPreset = getCategoryCapabilityPresetForForm(
      capabilityPresetId,
    );

    const payload = {
      name: formData.get("name") as string,
      color: color.toString("hex"),
      bannerUrl,
      targetUnit: capabilityPreset.targetUnit,
      evidenceMode: capabilityPreset.evidenceMode,
      scoreInputMode: capabilityPreset.scoreInputMode,
      defaultFrequency: Number(formData.get("defaultFrequency") || 1),
    };

    try {
      if (isEdit && initialData) {
        await updateCategory({ id: initialData.id, data: payload });
      } else {
        await createCategory(payload);
      }
      onClose();
    } catch {
      // Handled by mutation toast
    }
  };

  const isLoading = isCreating || isUpdating || isUploading;
  const selectedCapabilityPreset =
    getCategoryCapabilityPresetForForm(capabilityPresetId);
  const isPartisipasi =
    selectedCapabilityPreset.targetUnit === "PARTISIPASI_PERSEN";

  return (
    <Modal>
      <Modal.Backdrop
        isOpen={isOpen}
        onOpenChange={onClose}
        className="backdrop-blur-sm"
      >
        <Modal.Container scroll="inside">
          <Modal.Dialog className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-full flex-col sm:max-w-2xl">
            <Modal.CloseTrigger />
            <Modal.Header className="flex shrink-0 flex-col gap-1">
              <Modal.Heading className="text-lg font-bold text-foreground">
                {isEdit ? "Edit Kategori Program" : "Tambah Kategori Program"}
              </Modal.Heading>
              <p className="text-xs text-muted">
                {isEdit
                  ? "Perbarui atribut master kategori program budaya."
                  : "Buat template kategori baru untuk program budaya."}
              </p>
            </Modal.Header>

            <Form
              validationBehavior="native"
              onSubmit={handleSubmit}
              className="contents"
            >
              <Modal.Body className="min-h-0 flex-1 space-y-4 overflow-y-auto py-2">
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
                    placeholder="Contoh: DONITA, MAKNYOS, TOGA"
                    autoComplete="off"
                    className="mt-1"
                  />
                </TextField>

                {/* WARNA IDENTITAS */}
                <div className="flex flex-col gap-1">
                  <Label className="text-xs font-semibold text-slate-700">
                    Warna Identitas
                  </Label>
                  <ColorPicker value={color} onChange={setColor}>
                    <ColorPicker.Trigger className="flex items-center gap-2">
                      <ColorSwatch size="lg" />
                      <Label className="font-mono text-xs uppercase text-slate-600">
                        {color.toString("hex")}
                      </Label>
                    </ColorPicker.Trigger>
                    <ColorPicker.Popover className="gap-2 p-3">
                      <ColorArea
                        aria-label="Color Area"
                        className="max-w-full"
                        colorSpace="hsb"
                        xChannel="saturation"
                        yChannel="brightness"
                      >
                        <ColorArea.Thumb />
                      </ColorArea>
                      <ColorSlider
                        aria-label="Hue"
                        channel="hue"
                        className="gap-1 px-1"
                        colorSpace="hsb"
                      >
                        <ColorSlider.Track>
                          <ColorSlider.Thumb />
                        </ColorSlider.Track>
                      </ColorSlider>
                      <ColorSwatchPicker
                        className="justify-center pt-2"
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
                  <Label className="text-xs font-semibold text-slate-700">
                    Gambar Banner (Opsional)
                  </Label>
                  {bannerUrl || imagePreview ? (
                    <>
                      <div className="flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                        <img
                          src={imagePreview ?? bannerUrl ?? ""}
                          alt="Banner Preview"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="flex items-center justify-end pt-2">
                        <Button
                          size="sm"
                          variant="danger"
                          type="button"
                          aria-label="Hapus banner"
                          onPress={handleRemoveBanner}
                          isDisabled={isLoading}
                        >
                          <FiTrash2 className="mr-1 h-4 w-4" />
                          Hapus banner
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Dropzone
                      variant="normal"
                      multiple={false}
                      maxSizeMb={2}
                      label="Unggah banner"
                      onFileSelected={handleBannerUpload}
                      isDisabled={isLoading}
                    />
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* CAPABILITY PRESET */}
                  <div className="col-span-2 flex flex-col gap-1">
                    <Label className="text-xs font-semibold text-slate-700">
                      Preset Kapabilitas
                    </Label>
                    <Select
                      value={capabilityPresetId}
                      onChange={(value) => setCapabilityPresetId(String(value))}
                      isDisabled={
                        Boolean(initialData?.locks.capability) || isLoading
                      }
                      aria-label="Preset kapabilitas kategori"
                      className="w-full"
                    >
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {CATEGORY_CAPABILITY_PRESETS.map((preset) => (
                            <ListBox.Item
                              key={preset.id}
                              id={preset.id}
                              textValue={preset.title}
                            >
                              <div className="flex min-w-0 flex-col gap-0.5">
                                <ListBox.ItemIndicator />
                                <span className="font-medium">
                                  {preset.title}
                                </span>
                                <span className="text-xs text-muted">
                                  {preset.description}
                                </span>
                              </div>
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                      {initialData?.locks.capability && (
                        <Description role="status" className="text-xs text-muted">
                          Kapabilitas tidak dapat diubah karena kategori sudah
                          digunakan.
                        </Description>
                      )}
                    </Select>
                  </div>

                  {/* DEFAULT FREQUENCY */}
                  {selectedCapabilityPreset.showFrequency && isPartisipasi ? (
                    <>
                      <input type="hidden" name="defaultFrequency" value="1" />
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs font-semibold text-slate-700">
                          Kuota bukti
                        </Label>
                        <div className="mt-1 h-10 flex items-center px-3 rounded-lg bg-slate-50 border border-slate-200">
                          <span className="text-xs text-slate-400 italic">
                            Kuota bukti per unit: 1 per triwulan
                          </span>
                        </div>
                      </div>
                    </>
                  ) : selectedCapabilityPreset.showFrequency ? (
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
                  ) : (
                    <input type="hidden" name="defaultFrequency" value="1" />
                  )}
                </div>

              </Modal.Body>

              <Modal.Footer className="mt-4 flex shrink-0 flex-col-reverse items-stretch gap-2 border-t border-slate-200 bg-slate-50/80 sm:flex-row sm:items-center sm:justify-end">
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
