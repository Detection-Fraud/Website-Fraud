import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const user = session?.user;

    if (!user) {
      return NextResponse.json(errorResponse("unauthorized", 401), {
        status: 401,
      });
    }

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
          select: { users: { where: { role: "PIC" } } },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(
      successResponse(units, "berhasil mengambil data unit"),
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("ERROR GET /api/units:", error);
    return NextResponse.json(errorResponse("gagal mengambil data unit", 500), {
      status: 500,
    });
  }
}
