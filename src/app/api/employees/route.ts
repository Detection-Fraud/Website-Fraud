import { handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import { listEmployeesForManagement } from "@/lib/user-management";
import { listEmployeesQuerySchema } from "@/schemas/employee.schema";
import { errorResponse, successResponse } from "@/lib/response";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const rawParams = Object.fromEntries(req.nextUrl.searchParams.entries());

    const parsed = listEmployeesQuerySchema.safeParse(rawParams);

    if (!parsed.success) {
      return NextResponse.json(errorResponse("Validasi parameter gagal", 400), {
        status: 400,
      });
    }

    const result = await listEmployeesForManagement(parsed.data);

    return NextResponse.json(
      successResponse(result, "Berhasil mengambil data Employee"),
    );
  } catch (error) {
    return handleApiError(error, "GET /api/employees");
  }
}
