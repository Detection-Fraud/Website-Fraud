import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  const user = session?.user;

  if (!session || user?.role !== "ADMIN") {
    return NextResponse.json(errorResponse("Forbidden", 403), { status: 403 });
  }

  const q = req.nextUrl.searchParams.get("q") ?? "";
  const unitId = req.nextUrl.searchParams.get("unitId") ?? "";

  if (q.trim().length < 2) {
    return NextResponse.json(errorResponse("Query minimal 2 karakter", 400), {
      status: 400,
    });
  }

  try {
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
    console.error("[GET /api/users/search] Error:", error);
    return NextResponse.json(errorResponse("Internal server error", 500), {
      status: 500,
    });
  }
}
