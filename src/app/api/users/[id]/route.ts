import { handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import { successResponse } from "@/lib/response";
import { demoteUser } from "@/lib/user-management";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  _req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    await requireAdmin();

    const user = await demoteUser((await params).id);

    return NextResponse.json(
      successResponse(user, "User diturunkan menjadi VIEWER dan dinonaktifkan"),
    );
  } catch (error) {
    return handleApiError(error, "DELETE /api/users/[id]");
  }
}
