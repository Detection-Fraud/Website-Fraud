import { authorizeEmployeeImport, employeeImportErrorResponse, readEmployeeImportForm } from "@/lib/employee-import-http";
import { commitEmployeeImport, EmployeeImportError } from "@/lib/employee-excel-import";
import { successResponse } from "@/lib/response";
import { employeeImportCommitSchema, employeeImportRunResponseSchema } from "@/schemas/employee-import.schema";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const authorization = await authorizeEmployeeImport(request);
    if ("response" in authorization) return authorization.response;
    const { form, file, bytes } = await readEmployeeImportForm(request, ["file", "previewToken", "confirmFullSnapshot"]);
    const input = employeeImportCommitSchema.safeParse({
      previewToken: form.get("previewToken"),
      confirmFullSnapshot: form.get("confirmFullSnapshot"),
    });
    if (!input.success) {
      const invalidConfirmation = form.get("confirmFullSnapshot") !== "true";
      throw new EmployeeImportError(invalidConfirmation ? "CONFIRMATION_REQUIRED" : "PREVIEW_INVALID");
    }
    const result = await commitEmployeeImport(authorization.session.user.id, input.data.previewToken, file.name, bytes);
    const safe = employeeImportRunResponseSchema.parse(result);
    return NextResponse.json(successResponse(safe, "Import snapshot Employee berhasil", 200));
  } catch (error) {
    return employeeImportErrorResponse(error, "POST /api/employees/import/commit");
  }
}
