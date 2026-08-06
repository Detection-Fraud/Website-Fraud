"use client";

import AppBar from "@/components/layout/Appbar";
import { useImportKaryawan } from "@/hooks/useImportKaryawan";
import { Button } from "@heroui/react";
import { FiDownload } from "react-icons/fi";
import FinishStep from "../../../../components/import/_components/FinishStep";
import ImportStepper from "../../../../components/import/_components/ImportStepper";
import PreviewDatStep from "../../../../components/import/_components/PreviewDataStep";
import ProsessingStep from "../../../../components/import/_components/ProsessingStep";
import UploadFileStep from "../../../../components/import/_components/UploadFileStep";

export default function ImportKaryawanPage() {
  const {
    step,
    file,
    previewRows,
    stats,
    importResult,
    isLoading,
    errorMsg,
    importProgress,
    processCount,
    handleFileSelect,
    handleProsesImport,
    handleReset,
  } = useImportKaryawan();
  return (
    <main className="space-y-5 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <AppBar
          title="Import Data Karyawan"
          description="Upload file Excel/CSV untuk menambahkan data karyawan secara massal ke database"
          showAddButton={false}
        />
        <Button
          variant="outline"
          size="md"
          onPress={() => window.open("/api/users/import/template", "_blank")}
          className="shrink-0"
        >
          <FiDownload size={14} />
          Unduh Template
        </Button>
      </div>

      <ImportStepper currentStep={step} />

      {step === 1 && (
        <UploadFileStep
          onFileSelect={handleFileSelect}
          isLoading={isLoading}
          errorMsg={errorMsg}
        />
      )}

      {step === 2 && (
        <PreviewDatStep
          rows={previewRows}
          stats={stats}
          fileName={file?.name}
          isLoading={isLoading}
          errorMsg={errorMsg}
          onBack={handleReset}
          onProsessImport={handleProsesImport}
        />
      )}

      {step === 3 && (
        <ProsessingStep
          progress={importProgress}
          processedCount={processCount}
          totalCount={stats.total}
        />
      )}

      {step === 4 && (
        <FinishStep result={importResult} stats={stats} onReset={handleReset} />
      )}
    </main>
  );
}
