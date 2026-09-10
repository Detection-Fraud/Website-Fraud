import { handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import { applyEmployeeAdminAction } from "@/lib/user-management";
import { employeeAdminActionSchema } from "@/schemas/user.schema";
import { errorResponse, successResponse } from "@/lib/response";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const employeeIdSchema = z.string().uuid("Employee ID tidak valid");

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> },
) {
  try {
    const session = await requireAdmin();
    const { employeeId } = await params;
    const employeeIdResult = employeeIdSchema.safeParse(employeeId);

    if (!employeeIdResult.success) {
      return NextResponse.json(
        errorResponse(employeeIdResult.error.issues[0]?.message ?? "Employee ID tidak valid", 400),
        { status: 400 },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(errorResponse("Body JSON tidak valid", 400), {
        status: 400,
      });
    }

    const parsed = employeeAdminActionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        errorResponse(parsed.error.issues[0]?.message ?? "Validasi gagal", 400),
        { status: 400 },
      );
    }

    const user = await applyEmployeeAdminAction(
      employeeIdResult.data,
      session.user.id,
      parsed.data,
    );

    return NextResponse.json(
      successResponse(user, "Akun Employee berhasil diperbarui"),
    );
  } catch (error) {
    return handleApiError(error, "PATCH /api/employees/[employeeId]/account");
  }
}
