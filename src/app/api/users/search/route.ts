import { handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { searchActivePics, searchPicCandidates } from "@/lib/user-management";
import { Prisma, Role } from "@generated/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const params = req.nextUrl.searchParams;

    const input = {
      query: params.get("q") ?? "",
      unitId: params.get("unitId") ?? undefined,
    };

    const result =
      params.get("role") === "PIC"
        ? await searchActivePics(input)
        : await searchPicCandidates(input);

    return NextResponse.json(successResponse(result, "Hasil pencarian user"));
  } catch (error) {
    return handleApiError(error, "GET /api/users/search");
  }
}
