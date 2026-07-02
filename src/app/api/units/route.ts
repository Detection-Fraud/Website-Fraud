import { handleApiError, requireAuth } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type");
    const parentId = searchParams.get("parentId");

    let where: any = {};
    if (type) where.type = type;
    if (parentId) where.parentId = parentId;

    const units = await prisma.unit.findMany({
      where,
      include: {
        children:
          type === "KANTOR_WILAYAH"
            ? {
                select: { id: true, name: true, type: true },
                orderBy: { name: "asc" },
              }
            : false,
        parent: {
          select: { id: true, name: true },
        },
        _count: {
          select: { users: { where: { role: "PIC", isActive: true } } },
        },
      },
      orderBy: [{ kodeDolog: "asc" }, { name: "asc" }],
    });

    const formattedUnits = units.map((u) => {
      if (u.type === "KANTOR_WILAYAH" && u.kodeDolog && u.kodeDolog !== "00") {
        return {
          ...u,
          name: `${parseInt(u.kodeDolog, 10)}. ${u.name.replace("KANTOR WILAYAH ", "Kanwil ")}`,
        };
      }
      return u;
    });

    return NextResponse.json(
      successResponse(formattedUnits, "berhasil mengambil data unit"),
      {
        status: 200,
      },
    );
  } catch (error) {
    return handleApiError(error, "GET /api/units");
  }
}
