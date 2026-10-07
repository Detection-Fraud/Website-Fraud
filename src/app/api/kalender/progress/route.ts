import { handleApiError, requireAuth } from "@/lib/api/auth-guard";
import { resolveScope } from "@/lib/api/unit-scope";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const session = await requireAuth();
    const user = session.user;
    const { searchParams } = new URL(req.url);
    const monthParam = searchParams.get("month");
    const yearParam = searchParams.get("year");
    const month = Number(monthParam);
    const year = Number(yearParam);

    if (!monthParam || !Number.isInteger(month) || month < 0 || month > 11) {
      return NextResponse.json(
        errorResponse("Parameter month tidak valid (0-11)", 400),
        { status: 400 },
      );
    }
    if (!yearParam || !Number.isInteger(year) || year < 2020 || year > 2100) {
      return NextResponse.json(
        errorResponse("Parameter year tidak valid", 400),
        { status: 400 },
      );
    }

    const quarterStartMonth = Math.floor(month / 3) * 3;
    const startDate = new Date(year, quarterStartMonth, 1);
    const endDate = new Date(year, quarterStartMonth + 3, 1);
    const unitFilter =
      user.role === "PIC"
        ? { unitId: user.unitId ?? "BLOCKED" }
        : (
            await resolveScope(user, {
              kanwilId: "ALL",
              kancabId: "ALL",
              divisiId: "ALL",
            })
          ).whereClause;

    const progress = await prisma.activityReport.groupBy({
      by: ["programId"],
      where: {
        ...unitFilter,
        programId: { not: null },
        status: "APPROVED",
        tanggalKegiatan: { gte: startDate, lt: endDate },
      },
      _count: { id: true },
    });

    return NextResponse.json(
      successResponse(
        progress.flatMap((item) =>
          item.programId
            ? [{ programId: item.programId, approvedCount: item._count.id }]
            : [],
        ),
        "Successfully fetched quarterly progress",
        200,
      ),
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error, "GET /api/kalender/progress");
  }
}
