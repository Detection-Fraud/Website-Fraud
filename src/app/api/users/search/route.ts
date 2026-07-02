import { handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

  const q = req.nextUrl.searchParams.get("q") ?? "";
  const unitId = req.nextUrl.searchParams.get("unitId") ?? "";

  if (q.trim().length < 2) {
    return NextResponse.json(errorResponse("Query minimal 2 karakter", 400), {
      status: 400,
    });
  }


    // User di sistem berawal sebagai VIEWER, lalu dipromote jadi PIC
    // saat Admin assign ke unit kerja tertentu.
    // Exclude user yang sudah punya unitId (sudah jadi PIC di unit lain)
    const users = await prisma.user.findMany({
      where: {
        role: "VIEWER",
        name: { contains: q, mode: "insensitive" },

        ...(unitId && unitId !== "ALL" ? { unitId } : { unitId: null }),
      },
      take: 10,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        username: true, // NIP
        unitId: true,
        unit: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    return NextResponse.json(successResponse(users, "Hasil pencarian user"), {
      status: 200,
    });
  } catch (error) {
    return handleApiError(error, "GET /api/users/search");
  }
}
