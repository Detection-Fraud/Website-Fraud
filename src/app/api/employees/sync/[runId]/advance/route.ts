import { ApiError, requireAdmin } from "@/lib/api/auth-guard";
import { advanceEmployeePentahoSync } from "@/lib/employee-sync-orchestrator";
import { PentahoServiceError } from "@/lib/pentaho-service";
import { errorResponse, successResponse } from "@/lib/response";
import {
  employeeSyncRunIdSchema,
  employeeSyncStatusSchema,
  type EmployeeSyncStatusResponse,
} from "@/schemas/employee-sync.schema";
import { NextResponse } from "next/server";

function publicStatus(value: unknown): EmployeeSyncStatusResponse {
  if (typeof value !== "object" || value === null) {
    return employeeSyncStatusSchema.parse(value);
  }
  const status = value as Record<string, unknown>;
  return employeeSyncStatusSchema.parse({
    runId: status.runId,
    sourceSystem: status.sourceSystem,
    channel: status.channel,
    status: status.status,
    phase: status.phase,
    startedAt: status.startedAt,
    completedAt: status.completedAt,
    deadlineAt: status.deadlineAt,
    receivedCount: status.receivedCount,
    processedCount: status.processedCount,
    missingCount: status.missingCount,
    deactivatedCount: status.deactivatedCount,
    errorMessage: status.errorMessage,
    canStart: status.canStart,
  });
}

function errorResponseFor(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(errorResponse(error.message, error.status), {
      status: error.status,
    });
  }

  if (error instanceof Error && error.message === "EMPLOYEE_SYNC_RUN_NOT_FOUND") {
    return NextResponse.json(
      errorResponse("Run sinkronisasi tidak ditemukan", 404),
      { status: 404 },
    );
  }

  if (
    error instanceof Error &&
    error.message === "EMPLOYEE_SYNC_RUN_SOURCE_MISMATCH"
  ) {
    return NextResponse.json(
      errorResponse("Run sinkronisasi tidak ditemukan", 404),
      { status: 404 },
    );
  }

  if (
    error instanceof Error &&
    error.message === "EMPLOYEE_SYNC_RUN_CHANNEL_MISMATCH"
  ) {
    return NextResponse.json(
      errorResponse("Run sinkronisasi tidak dapat diproses melalui kanal ini", 409),
      { status: 409 },
    );
  }

  if (error instanceof PentahoServiceError) {
    const status = error.code === "TIMEOUT" ? 504 : 502;
    return NextResponse.json(
      errorResponse(
        status === 504
          ? "Layanan Pentaho tidak merespons tepat waktu"
          : "Layanan Pentaho tidak tersedia",
        status,
      ),
      { status },
    );
  }

  return NextResponse.json(
    errorResponse("Terjadi kesalahan internal pada server", 500),
    { status: 500 },

  );
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  let runId: string | undefined;

  try {
    await requireAdmin();
    ({ runId } = await params);
    const parsed = employeeSyncRunIdSchema.safeParse(runId);

    if (!parsed.success) {
      return NextResponse.json(errorResponse("Run ID tidak valid", 400), {
        status: 400,
      });
    }

    const result = await advanceEmployeePentahoSync(parsed.data);
    const status = result.status === "RUNNING" ? 202 : 200;
    return NextResponse.json(
      successResponse(publicStatus(result), "Status sinkronisasi Employee diperbarui", status),
      { status },
    );
  } catch (error) {
    return errorResponseFor(error);
  }
}
