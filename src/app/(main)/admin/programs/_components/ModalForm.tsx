"use client";

import { useProgramCategoryQuery } from "@/hooks/useProgramCategoryQuery";
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
import { parseDate, type DateValue } from "@internationalized/date";
import { useEffect, useMemo, useState } from "react";
import { FiFolder, FiLayers, FiTarget } from "react-icons/fi";
import ProgramBannerField from "./form/ProgramBannerField";
import ProgramPeriodFields from "./form/ProgramPeriodFields";

function toCalendarDate(value?: Date | string | null) {
  if (!value) return null;
  return parseDate(new Date(value).toISOString().slice(0, 10));
}

interface ModalFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
  isLoading?: boolean;
  program?: ProgramBudaya | null;
}

export default function ModalForm({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  program,
}: ModalFormProps) {
  const { data: categories = [], isLoading: isLoadingCategories } =
    useProgramCategoryQuery("KEGIATAN");

  const [selectedTw, setSelectedTw] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<DateValue | null>(null);
  const [endDate, setEndDate] = useState<DateValue | null>(null);
  const [uploadDeadline, setUploadDeadline] = useState<DateValue | null>(null);
  const [frequencyValue, setFrequencyValue] = useState("1");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [isBannerUploading, setIsBannerUploading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setSelectedTw(program?.tw != null ? String(program.tw) : null);
    setStartDate(toCalendarDate(program?.startDate));
    setEndDate(toCalendarDate(program?.endDate));
    setUploadDeadline(toCalendarDate(program?.uploadDeadline));
    setFrequencyValue(program?.frequency?.toString() ?? "1");
    setSelectedCategoryId(program?.categoryId ?? null);
  }, [isOpen, program]);

  const selectedCategory = useMemo(
    () =>
      categories.find(
        (category: ProgramCategory) => category.id === selectedCategoryId,
      ),
    [categories, selectedCategoryId],
  );

  const periodError = useMemo(() => {
    if (!startDate || !endDate || !uploadDeadline) return null;
    if (startDate.compare(endDate) > 0) {
      return "Tanggal selesai harus sesudah tanggal mulai";
    }
    if (startDate.year !== endDate.year) {
      return "Periode kegiatan harus satu tahun";
    }
    if (endDate.compare(uploadDeadline) > 0) {
      return "Deadline upload harus sesudah tanggal selesai";
    }
    return null;
  }, [endDate, startDate, uploadDeadline]);

  const handleCategoryChange = (key: React.Key | null) => {
    const categoryId = key ? String(key) : null;
    setSelectedCategoryId(categoryId);

    if (!program && categoryId) {
      const category = categories.find(
        (item: ProgramCategory) => item.id === categoryId,
      );
      if (category?.defaultFrequency != null) {
        setFrequencyValue(String(category.defaultFrequency));
      }
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(new FormData(event.currentTarget));
  };

  const submitDisabled =
    isLoading ||
    isBannerUploading ||
    !selectedTw ||
    !startDate ||
    !endDate ||
    !uploadDeadline ||
    Boolean(periodError);

  return (
    <Modal isOpen={isOpen} onOpenChange={onClose}>
        <Modal.Backdrop variant="blur">
          <Modal.Container placement="center" scroll="inside" size="lg">
            <Modal.Dialog className="border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
              <Modal.CloseTrigger />
              <Modal.Header className="border-b border-slate-100 px-6 py-5 dark:border-zinc-900">
                <div className="flex items-center gap-3">
                  <Modal.Icon className="rounded-xl bg-slate-100 p-2.5 text-slate-700 dark:bg-zinc-900 dark:text-zinc-200">
                    <FiLayers className="size-5" />
                  </Modal.Icon>
                  <div>
                    <Modal.Heading className="text-base font-semibold">
                      {program ? "Edit Program Budaya" : "Tambah Program Budaya"}
                    </Modal.Heading>
                    <Description className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                      Atur target, periode kegiatan, dan batas upload laporan.
                    </Description>
                  </div>
                </div>
              </Modal.Header>

              <Modal.Body className="px-2 py-3">
                <Surface className="bg-transparent p-0 shadow-none" variant="default">
                  <Form className="space-y-3" onSubmit={handleSubmit}>
                    <Fieldset className="space-y-4">
                      <FieldGroup className="space-y-4">
                        <TextField
                          isRequired
                          defaultValue={program?.name ?? ""}
                          name="name"
                          validate={(value) =>
                            value.trim().length < 3
                              ? "Nama program minimal 3 karakter"
                              : null
                          }
                        >
                          <Label>Nama program</Label>
                          <Input
                            className="h-11"
                            placeholder="Contoh: DONITA TW I 2026"
                            variant="secondary"
                          />
                          <FieldError />
                        </TextField>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <Select
                            aria-label="Kategori induk"
                            className="w-full"
                            isRequired
                            onChange={handleCategoryChange}
                            placeholder={
                              isLoadingCategories
                                ? "Memuat kategori..."
                                : "Pilih kategori"
                            }
                            value={selectedCategoryId ?? ""}
                            variant="secondary"
                          >
                            <Label>
                              <span className="flex items-center gap-1.5">
                                <FiFolder className="size-4" /> Kategori induk
                              </span>
                            </Label>
                            <Select.Trigger className="h-11 items-center">
                              <Select.Value />
                              <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                              <ListBox>
                                {categories.map((category: ProgramCategory) => (
                                  <ListBox.Item
                                    id={category.id}
                                    key={category.id}
                                    textValue={category.name}
                                  >
                                    {category.name}
                                    <ListBox.ItemIndicator />
                                  </ListBox.Item>
                                ))}
                              </ListBox>
                            </Select.Popover>
                            <Description>Induk pilar program budaya.</Description>
                          </Select>
                          <input
                            name="categoryId"
                            type="hidden"
                            value={selectedCategoryId ?? ""}
                          />

                          <TextField
                            isRequired
                            name="frequency"
                            onChange={setFrequencyValue}
                            validate={(value) =>
                              Number(value) >= 1 ? null : "Minimal 1 target"
                            }
                            value={frequencyValue}
                          >
                            <Label>
                              <span className="flex items-center gap-1.5">
                                <FiTarget className="size-4" /> Target frekuensi
                              </span>
                            </Label>
                            <Input
                              className="h-11"
                              min={1}
                              type="number"
                              variant="secondary"
                            />
                            <Description>
                              {selectedCategory?.defaultFrequency != null
                                ? `Bawaan kategori: ${selectedCategory.defaultFrequency} laporan per TW.`
                                : "Jumlah laporan yang ditargetkan per TW."}
                            </Description>
                            <FieldError />
                          </TextField>
                        </div>

                        <ProgramPeriodFields
                          endDate={endDate}
                          onEndDateChange={setEndDate}
                          onStartDateChange={setStartDate}
                          onTwChange={setSelectedTw}
                          onUploadDeadlineChange={setUploadDeadline}
                          periodError={periodError}
                          selectedTw={selectedTw}
                          startDate={startDate}
                          uploadDeadline={uploadDeadline}
                        />

                        <TextField
                          defaultValue={program?.description ?? ""}
                          name="description"
                        >
                          <Label>Deskripsi atau catatan program</Label>
                          <TextArea
                            placeholder="Catatan tujuan atau mekanisme pelaksanaan program..."
                            rows={2}
                            variant="secondary"
                          />
                        </TextField>

                        <ProgramBannerField
                          initialBannerUrl={program?.bannerUrl}
                          isOpen={isOpen}
                          onUploadingChange={setIsBannerUploading}
                        />
                      </FieldGroup>

                      <Fieldset.Actions className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-zinc-900">
                        <Button
                          isDisabled={isLoading}
                          onPress={onClose}
                          type="button"
                          variant="secondary"
                        >
                          Batal
                        </Button>
                        <Button
                          isDisabled={submitDisabled}
                          isPending={isLoading}
                          type="submit"
                          variant="primary"
                        >
                          {program ? "Perbarui program" : "Simpan program"}
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
