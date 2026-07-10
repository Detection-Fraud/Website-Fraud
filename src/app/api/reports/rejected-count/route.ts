import { handleApiError, requireAuth } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import { successResponse } from "@/lib/response";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await requireAuth();

    if (session.user.role !== "PIC") {
      return NextResponse.json(successResponse({ count: 0 }));
    }

    const count = await prisma.activityReport.count({
      where: {
        unitId: session.user.unitId,
        status: "REJECTED",
      },
    });

    return NextResponse.json(
      successResponse({
        count,
      }),
    );
  } catch (error) {
    return handleApiError(error, "GET /api/reports/rejected-count");
  }
}
