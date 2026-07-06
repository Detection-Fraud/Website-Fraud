import { useFormDetectionLogic } from "@/hooks/useFormDetectionLogic";
import { ReportFormData } from "@/types/report.types";
import { ProgramBudaya } from "@generated/prisma";
import {
  Button,
  Card,
  Form,
  Input,
  Label,
  ListBox,
  Select,
  TextArea,
  TextField,
} from "@heroui/react";
import CalendarPicker from "../../_components/calendar-picker";

export interface InitialData {
  activityName?: string;
  programId?: string;
  tanggalKegiatan?: string;
  lokasi?: string;
  picKegiatan?: string;
  description?: string;
}

interface PropTypes {
  loadingText: string;
  handleCheckFraud: () => void;
  tanganiSubmitFinal: (formData: ReportFormData) => void;
  adaGambarIdle: boolean;
  adaGambarFraud: boolean;
  adaGambarLoading: boolean;
  semuaLulus: boolean;
  totalGambar: number;
  programs: ProgramBudaya[];

  initialData?: InitialData;
}
export default function FormDetection({
  loadingText,
  handleCheckFraud,
  tanganiSubmitFinal,
  adaGambarIdle,
  adaGambarFraud,
  adaGambarLoading,
  semuaLulus,
  totalGambar,
  programs,
  initialData,
}: PropTypes) {
  const {
    selectedProgramId,
    setSelectedProgramId,
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const availablePrograms = programs.filter((program) => {
    // Keep if it's the currently edited program
    if (initialData?.programId === program.id) return true;
    // Filter out if end date has passed
    const endDate = new Date(program.endDate);
    endDate.setHours(0, 0, 0, 0);
    return today <= endDate;
  });

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
            <Label className="text-sm font-medium">Program Budaya</Label>
            <Select
              placeholder="Pilih Program Budaya"
              className="mt-1"
              name="programId"
              value={selectedProgramId}
              onChange={(value) => setSelectedProgramId(value)}
              aria-label="Program Budaya"
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {availablePrograms.map((program) => (
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

          {/* DatePicker: value disimpan di state */}
          <div className="w-full flex flex-col gap-1">
            <Label className="text-sm font-medium">Tanggal Kegiatan</Label>
            <CalendarPicker
              value={selectedDate}
              onChange={setSelectedDate}
              isDisabled={isDateDisabled}
              minValue={minDate}
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
