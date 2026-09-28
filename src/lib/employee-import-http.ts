import { ApiError, requireAdmin } from "@/lib/api/auth-guard";
import { checkRateLimit, rateLimitResponse } from "@/lib/api/rate-limit";
import { errorResponse } from "@/lib/response";
import { EMPLOYEE_IMPORT_MAX_FILE_BYTES, EmployeeImportError } from "@/lib/employee-excel-import";
import { NextResponse, type NextRequest } from "next/server";

const MAX_MULTIPART_OVERHEAD = 64 * 1024;

type EmployeeImportAuthorization =
  | { readonly response: Response }
  | { readonly session: Awaited<ReturnType<typeof requireAdmin>> };

async function readBoundedBody(request: NextRequest, maxBytes: number): Promise<Uint8Array> {
  if (!request.body) throw new EmployeeImportError("INVALID_FILE");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new EmployeeImportError("FILE_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), totalBytes);
  return new Uint8Array(body);
}

export async function authorizeEmployeeImport(
  request: NextRequest,
): Promise<EmployeeImportAuthorization> {
  const session = await requireAdmin();
  const rate = checkRateLimit(request, {
    keyPrefix: "employee-excel-import",
    clientIdentity: session.user.id,
    max: 5,
    windowMs: 60_000,
  });
  if (!rate.success) return { response: rateLimitResponse(rate.resetAt) } as const;
  return { session } as const;
}

export async function readEmployeeImportForm(
  request: NextRequest,
  allowedFields: readonly string[],
) {
  const maxBodyBytes = EMPLOYEE_IMPORT_MAX_FILE_BYTES + MAX_MULTIPART_OVERHEAD;
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null && (!/^\d+$/.test(declaredLength) || !Number.isSafeInteger(Number(declaredLength)) || Number(declaredLength) > maxBodyBytes)) {
    throw new EmployeeImportError("FILE_TOO_LARGE");
  }
  const boundedBody = await readBoundedBody(request, maxBodyBytes);
  const boundedBodyArrayBuffer = boundedBody.buffer.slice(
    boundedBody.byteOffset,
    boundedBody.byteOffset + boundedBody.byteLength,
  ) as ArrayBuffer;
  const boundedRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: boundedBodyArrayBuffer,
    signal: request.signal,
  });
  const form = await boundedRequest.formData();
  const keys = [...form.keys()];
  if (keys.length !== allowedFields.length || allowedFields.some((field) => keys.filter((key) => key === field).length !== 1) || keys.some((key) => !allowedFields.includes(key))) {
    throw new EmployeeImportError("INVALID_FILE");
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw new EmployeeImportError("INVALID_FILE");
  if (file.size > EMPLOYEE_IMPORT_MAX_FILE_BYTES) throw new EmployeeImportError("FILE_TOO_LARGE");
  return { form, file, bytes: Buffer.from(await file.arrayBuffer()) };
}

export function employeeImportErrorResponse(error: unknown, route: string): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(errorResponse(error.message, error.status), { status: error.status });
  }
  if (error instanceof EmployeeImportError) {
    const status = error.code === "FILE_TOO_LARGE" ? 413
      : error.code === "INVALID_FILE" || error.code === "INVALID_WORKBOOK" || error.code === "INVALID_SNAPSHOT" || error.code === "CONFIRMATION_REQUIRED" ? 400
        : error.code === "COMMIT_FAILED" ? 500 : 409;
    if (status === 500) console.error(`[${route}] ${error.code}`);
    return NextResponse.json(errorResponse(error.code, status), { status });
  }
  console.error(`[${route}] INTERNAL_ERROR`);
  return NextResponse.json(errorResponse("INTERNAL_ERROR", 500), { status: 500 });
}
