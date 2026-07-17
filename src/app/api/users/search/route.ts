import { handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const q = req.nextUrl.searchParams.get("q") ?? "";
    const unitId = req.nextUrl.searchParams.get("unitId") ?? "";
    const role = req.nextUrl.searchParams.get("role") ?? "VIEWER";

    if (q.trim().length < 2) {
      return NextResponse.json(errorResponse("Query minimal 2 karakter", 400), {
        status: 400,
      });
    }

    const where: any = {
      role,
      name: { contains: q, mode: "insensitive" },
      isActive: true,
    };

    if (role === "VIEWER") {
      if (unitId && unitId !== "ALL") {
        where.unitId = unitId;
      } else {
        where.unitId = null;
      }
    } else if (role === "PIC") {
      where.unitId = { not: null };
      if (unitId && unitId !== "ALL") {
        where.unitId = unitId;
      }
    }


    const users = await prisma.user.findMany({
      where,
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
