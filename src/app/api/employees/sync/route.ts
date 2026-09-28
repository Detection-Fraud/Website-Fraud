import { requireAdmin, ApiError } from "@/lib/api/auth-guard";
import {
  getLatestEmployeePentahoSync,
  startEmployeePentahoSync,
} from "@/lib/employee-sync-orchestrator";
import { PentahoServiceError } from "@/lib/pentaho-service";
import { errorResponse, successResponse } from "@/lib/response";
import {
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

export async function POST() {
  try {
    const session = await requireAdmin();
    const result = await startEmployeePentahoSync({
      id: session.user.id,
      name: session.user.name ?? session.user.username ?? "Admin",
    });

    if (
      result.status === "FAILED" &&
      result.errorMessage === "PENTAHO_EXECUTE_REJECTED"
    ) {
      return NextResponse.json(
        errorResponse("Layanan Pentaho tidak tersedia", 502),
        { status: 502 },
      );
    }

    const data = publicStatus(result);
    const status = result.disposition === "STARTED" ? 202 : 200;

    return NextResponse.json(
      successResponse(
        data,
        result.disposition === "STARTED"
          ? "Sinkronisasi Employee dimulai"
          : result.disposition === "OTHER_CHANNEL_ACTIVE"
            ? "Sinkronisasi Employee sedang berjalan melalui import Excel"
            : "Sinkronisasi Employee yang sedang berjalan digunakan kembali",
        status,
      ),
      { status },
    );
  } catch (error) {
    return errorResponseFor(error);
  }
}

export async function GET() {
  try {
    await requireAdmin();
    const result = await getLatestEmployeePentahoSync();
    const data = result === null ? null : publicStatus(result);

    return NextResponse.json(
      successResponse(data, "Status sinkronisasi Employee berhasil diambil", 200),
      { status: 200 },
    );
  } catch (error) {
    return errorResponseFor(error);
  }
}
