export type EmployeeSyncStatus = {
  runId: string;
  sourceSystem: string;
  channel: "PENTAHO" | "EXCEL_IMPORT";
  status: "RUNNING" | "SUCCEEDED" | "FAILED";
  phase: "TRIGGERING" | "PENTAHO_RUNNING" | "VALIDATING" | "RECONCILING" | "COMPLETED" | null;
  startedAt: string;
  completedAt: string | null;
  deadlineAt: string | null;
  receivedCount: number;
  processedCount: number;
  missingCount: number;
  deactivatedCount: number;
  errorMessage: string | null;
  canStart: boolean;
};

export type EmployeeSyncStartResult = EmployeeSyncStatus & {
  disposition: "STARTED" | "REUSED" | "OTHER_CHANNEL_ACTIVE";
};
