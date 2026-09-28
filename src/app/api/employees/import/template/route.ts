import { authorizeEmployeeImport, employeeImportErrorResponse } from "@/lib/employee-import-http";
import { createEmployeeImportTemplate } from "@/lib/employee-excel-import";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const authorization = await authorizeEmployeeImport(request);
    if ("response" in authorization) return authorization.response;
    const content = await createEmployeeImportTemplate();
    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="Template_Employee_Pentaho.xlsx"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return employeeImportErrorResponse(error, "GET /api/employees/import/template");
  }
}
