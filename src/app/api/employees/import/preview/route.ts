import { authorizeEmployeeImport, employeeImportErrorResponse, readEmployeeImportForm } from "@/lib/employee-import-http";
import { previewEmployeeImport } from "@/lib/employee-excel-import";
import { successResponse } from "@/lib/response";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const authorization = await authorizeEmployeeImport(request);
    if ("response" in authorization) return authorization.response;
    const { file, bytes } = await readEmployeeImportForm(request, ["file"]);
    const result = await previewEmployeeImport(authorization.session.user.id, file.name, bytes);
    return NextResponse.json(successResponse(result, "Preview import Employee berhasil", 200));
  } catch (error) {
    return employeeImportErrorResponse(error, "POST /api/employees/import/preview");
  }
}
