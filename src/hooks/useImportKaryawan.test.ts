import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildEmployeeImportCommitFormData,
  buildEmployeeImportPreviewFormData,
  confirmsNewSuccessfulEmployeeExcelRun,
  getEmployeeExcelRecoveryAction,
  getEmployeeImportErrorMessage,
  isEmployeeSyncRunActive,
  isAmbiguousEmployeeImportCommitError,
  shouldAdvanceEmployeePentahoRun,
} from "./useImportKaryawan";
import type { EmployeeSyncStatusResponse } from "@/schemas/employee-sync.schema";

const pentahoRunning: EmployeeSyncStatusResponse = {
  runId: "02020202-0202-4202-8202-020202020202",
  sourceSystem: "PENTAHO",
  channel: "PENTAHO",
  status: "RUNNING",
  phase: "PENTAHO_RUNNING",
  startedAt: "2026-09-28T00:00:00.000Z",
  completedAt: null,
  deadlineAt: "2026-09-28T00:30:00.000Z",
  receivedCount: 0,
  processedCount: 0,
  missingCount: 0,
  deactivatedCount: 0,
  errorMessage: null,
  canStart: false,
};

describe("employee intake UI contract helpers", () => {
  it("blocks both channels while any source run is active but advances only Pentaho", () => {
    const excelRunning = { ...pentahoRunning, channel: "EXCEL_IMPORT" as const };
    assert.equal(isEmployeeSyncRunActive(pentahoRunning), true);
    assert.equal(isEmployeeSyncRunActive(excelRunning), true);
    assert.equal(shouldAdvanceEmployeePentahoRun(pentahoRunning), true);
    assert.equal(shouldAdvanceEmployeePentahoRun(excelRunning), false);
    assert.equal(shouldAdvanceEmployeePentahoRun({ ...pentahoRunning, status: "SUCCEEDED" }), false);
    assert.equal(isEmployeeSyncRunActive(null), false);
  });

  it("builds preview and commit multipart forms without sending parsed rows", () => {
    const file = new File(["workbook-bytes"], "snapshot.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const preview = buildEmployeeImportPreviewFormData(file);
    assert.equal(preview.get("file") instanceof File, true);
    assert.equal((preview.get("file") as File).name, "snapshot.xlsx");
    assert.equal(preview.has("rows"), false);

    const commit = buildEmployeeImportCommitFormData(file, "opaque-preview-token");
    assert.equal((commit.get("file") as File).name, "snapshot.xlsx");
    assert.equal(commit.get("previewToken"), "opaque-preview-token");
    assert.equal(commit.get("confirmFullSnapshot"), "true");
    assert.equal(commit.has("rows"), false);
  });

  it("maps expired/conflicting actions and never exposes arbitrary server text", () => {
    assert.match(getEmployeeImportErrorMessage({ response: { status: 409 } }, "commit"), /preview baru/);
    assert.match(getEmployeeImportErrorMessage({ response: { status: 409 } }, "start"), /Proses snapshot lain sedang berjalan/);
    assert.match(getEmployeeImportErrorMessage({ response: { status: 413 } }, "preview"), /25 MiB/);
    const internal = Object.assign(new Error("db password leaked"), {
      response: { status: 500 },
    });
    assert.doesNotMatch(getEmployeeImportErrorMessage(internal, "commit"), /password|leaked/);
  });

  it("refreshes data only for an ambiguous failure confirmed as a new successful Excel run", () => {
    assert.equal(isAmbiguousEmployeeImportCommitError(new Error("connection lost")), true);
    assert.equal(isAmbiguousEmployeeImportCommitError({ response: { status: 408 } }), true);
    assert.equal(isAmbiguousEmployeeImportCommitError({ response: { status: 502 } }), true);
    assert.equal(isAmbiguousEmployeeImportCommitError({ response: { status: 409 } }), false);
    assert.equal(isAmbiguousEmployeeImportCommitError({ response: { status: 413 } }), false);

    const succeededExcel = { ...pentahoRunning, runId: "03030303-0303-4303-8303-030303030303", channel: "EXCEL_IMPORT" as const, status: "SUCCEEDED" as const };
    assert.equal(confirmsNewSuccessfulEmployeeExcelRun(succeededExcel, pentahoRunning.runId), true);
    assert.equal(confirmsNewSuccessfulEmployeeExcelRun(succeededExcel, succeededExcel.runId), false);
    assert.equal(confirmsNewSuccessfulEmployeeExcelRun({ ...succeededExcel, channel: "PENTAHO" }, pentahoRunning.runId), false);
    assert.equal(confirmsNewSuccessfulEmployeeExcelRun({ ...succeededExcel, status: "FAILED" }, pentahoRunning.runId), false);
  });

  it("follows a candidate Excel run until success or failure without guessing", () => {
    const runningExcel = { ...pentahoRunning, channel: "EXCEL_IMPORT" as const };
    const succeededExcel = { ...runningExcel, status: "SUCCEEDED" as const };
    const failedExcel = { ...runningExcel, status: "FAILED" as const };
    const candidateId = runningExcel.runId;

    assert.equal(getEmployeeExcelRecoveryAction(runningExcel, candidateId), "POLL");
    assert.equal(getEmployeeExcelRecoveryAction(succeededExcel, candidateId), "INVALIDATE");
    assert.equal(getEmployeeExcelRecoveryAction(failedExcel, candidateId), "STOP");
    assert.equal(getEmployeeExcelRecoveryAction({ ...succeededExcel, runId: "04040404-0404-4404-8404-040404040404" }, candidateId), "STOP");
  });
});
