import { handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import { errorResponse, successResponse } from "@/lib/response";
import { assignPic } from "@/lib/user-management";
import { promoteUserSchema } from "@/schemas/user.schema";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    await requireAdmin();

    const parsed = promoteUserSchema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json(
        errorResponse(parsed.error.issues[0]?.message ?? "Validasi gagal", 400),
        { status: 400 },
      );
    }

    const user = await assignPic((await params).id, parsed.data.unitId);

    return NextResponse.json(successResponse(user, "PIC berhasil ditetapkan"));
  } catch (error) {
    return handleApiError(error, "PATCH /api/users/[id]/promote");
  }
}
