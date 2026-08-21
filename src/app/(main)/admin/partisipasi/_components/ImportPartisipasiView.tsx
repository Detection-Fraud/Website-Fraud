"use client";

import FinishStep from "@/components/import/_components/FinishStep";
import ImportStepper from "@/components/import/_components/ImportStepper";
import ProsessingStep from "@/components/import/_components/ProsessingStep";
import UploadFileStep from "@/components/import/_components/UploadFileStep";
import AppBar from "@/components/layout/Appbar";
import { useCategoryList } from "@/hooks/useCategoryList";
import { useImportPartisipasi } from "@/hooks/useImportPartisipasi";
import { Button, Card, Label, ListBox, Select } from "@heroui/react";
import { FiDownload } from "react-icons/fi";
import { MdOutlineApartment, MdOutlinePercent } from "react-icons/md";
import PreviewPartisipasiStep from "./PreviewPartisipasiStep";

const PARTISIPASI_REQUIRED_COLUMNS = [
  {
    icon: <MdOutlineApartment size={16} className="text-blue-500" />,
    label: "Unit Kerja (Kode / Nama Unit)",
  },
  {
    icon: <MdOutlinePercent size={16} className="text-green-500" />,
    label: "Persentase Partisipasi (%)",
  },
];

export default function ImportPartisipasiView() {
  const { categories } = useCategoryList();
  const partisipasiCategories =
    categories?.filter((c: any) => c.targetUnit === "PARTISIPASI_PERSEN") ?? [];

  const {
    step,
    file,
    categoryId,
    tw,
    year,
    previewRows,
    stats,
    importResult,
    isLoading,
    errorMsg,
    setCategoryId,
    setTw,
    handlePreview,
    handleProsesImport,
    handleReset,
  } = useImportPartisipasi();

  const handleDownloadTemplate = () => {
    if (!categoryId) return;
    window.open(
      `/api/participation/template?categoryId=${categoryId}&tw=${tw}&year=${year}`,
      "_blank",
    );
  };

  return (
    <main className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <AppBar
          title="Import Persentase Partisipasi"
          description="Upload data persentase partisipasi per unit kerja untuk program budaya tipe partisipasi"
          showAddButton={false}
        />
        <Button
          variant="tertiary"
          size="md"
          onPress={handleDownloadTemplate}
          isDisabled={!categoryId}
          className={"shrink-0 font-medium"}
        >
          <FiDownload size={16} />
          Unduh Template Excel
        </Button>
      </div>

      <ImportStepper currentStep={step} />

      {step === 1 && (
        <div className="space-y-5">
          {/* FORM FILTER KATEGORI, TW, TAHUN */}
          <Card className="p-6 rounded-2xl bg-white shadow-sm border border-gray-100 space-y-4">
            <h3 className="font-bold text-gray-800 text-sm tracking-wide">
              Target Data Import
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                  Kategori Program Budaya
                </Label>
                <Select
                  className="w-full"
                  placeholder="Pilih Kategori Partisipasi"
                  value={categoryId || null}
                  onChange={(val) => setCategoryId((val as string) || "")}
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {partisipasiCategories.map((c: any) => (
                        <ListBox.Item key={c.id} id={c.id} textValue={c.name}>
                          {c.name}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                  Triwulan (TW)
                </Label>
                <Select
                  className="w-full"
                  value={String(tw)}
                  onChange={(val) => setTw(Number(val) || 1)}
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="1" textValue="TW I (Triwulan 1)">
                        TW I (Triwulan 1)
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item id="2" textValue="TW II (Triwulan 2)">
                        TW II (Triwulan 2)
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item id="3" textValue="TW III (Triwulan 3)">
                        TW III (Triwulan 3)
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item id="4" textValue="TW IV (Triwulan 4)">
                        TW IV (Triwulan 4)
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Import akan dicatat untuk tahun{" "}
              <span className="font-semibold text-gray-600">{year}</span>.
            </p>
          </Card>

          {/* REUSE UploadFileStep */}
          <UploadFileStep
            onFileSelect={handlePreview}
            isLoading={isLoading}
            isDisabled={!categoryId}
            errorMsg={errorMsg}
            requiredColumns={PARTISIPASI_REQUIRED_COLUMNS}
          />
        </div>
      )}

      {step === 2 && (
        <PreviewPartisipasiStep
          rows={previewRows}
          stats={stats}
          fileName={file?.name}
          onBack={handleReset}
          onProsessImport={handleProsesImport}
        />
      )}

      {step === 3 && (
        <ProsessingStep
          progress={100}
          processedCount={stats.matched + stats.conflict}
          totalCount={stats.matched + stats.conflict}
          title="Mengimpor Data Partisipasi..."
          entityName="data partisipasi"
        />
      )}

      {step === 4 && (
        <FinishStep
          result={
            importResult
              ? {
                  created: importResult.created,
                  updated: importResult.updated,
                  skipped: importResult.skipped,
                }
              : null
          }
          stats={{
            total: stats.total,
            error: stats.error,
          }}
          onReset={handleReset}
          description="Data persentase partisipasi telah berhasil disimpan ke database BULOG"
          actionText="Lihat Data Partisipasi"
          actionHref="/admin/reports"
        />
      )}
    </main>
  );
}
