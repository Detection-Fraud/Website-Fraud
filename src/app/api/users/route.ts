import { handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import { errorResponse, successResponse } from "@/lib/response";
import { createOrLinkUser, listPicUsers } from "@/lib/user-management";
import { createUserSchema } from "@/schemas/user.schema";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const params = req.nextUrl.searchParams;

    const result = await listPicUsers({
      unitId: params.get("unitId") ?? undefined,
      search: params.get("search") ?? undefined,
      page: Number(params.get("page") ?? 1),
      limit: Number(params.get("limit") ?? 10),
    });

    return NextResponse.json(
      successResponse(result, "Berhasil mengambil data user"),
    );
  } catch (error) {
    return handleApiError(error, "GET /api/users");
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const parsed = createUserSchema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json(
        errorResponse(parsed.error.issues[0]?.message ?? "Validasi gagal", 400),
        { status: 400 },
      );
    }

    const user = await createOrLinkUser(parsed.data);

    return NextResponse.json(
      successResponse(user, "User berhasil dibuat/ditautkan"),
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, "POST /api/users");
  }
}
