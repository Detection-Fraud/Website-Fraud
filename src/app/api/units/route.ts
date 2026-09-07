import { handleApiError, requireAuth } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import { successResponse } from "@/lib/response";
import { Prisma } from "@generated/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedUnitIds } from "@/lib/api/unit-scope";
import { z } from "zod";

const unitsQuerySchema = z.object({
  type: z.enum(["DIVISI", "KANTOR_WILAYAH", "KANTOR_CABANG"]).optional(),
  parentId: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    const parsed = unitsQuerySchema.safeParse({
      type: request.nextUrl.searchParams.get("type") ?? undefined,
      parentId: request.nextUrl.searchParams.get("parentId") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          status: 400,
          error: true,
          message: parsed.error.issues[0]?.message ?? "Filter unit tidak valid",
          data: null,
        },
        { status: 400 },
      );
    }

    const authorizedUnitIds = await getAuthorizedUnitIds(session.user);

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type");
    const parentId = searchParams.get("parentId");

    const where: Prisma.UnitWhereInput = {
      ...(parsed.data.type ? { type: parsed.data.type } : {}),
      ...(parsed.data.parentId ? { parentId: parsed.data.parentId } : {}),
      ...(authorizedUnitIds ? { id: { in: authorizedUnitIds } } : {}),
    };
    if (type) where.type = type as any;
    if (parentId) where.parentId = parentId;

    const units = await prisma.unit.findMany({
      where,
      include: {
        children:
          parsed.data.type === "KANTOR_WILAYAH"
            ? {
                select: { id: true, name: true, type: true },
                orderBy: { name: "asc" },
              }
            : false,
        parent: {
          select: { id: true, name: true },
        },
        _count: {
          select: {
            users: {
              where: {
                role: "PIC",
                authProvider: "SSO",
                isActive: true,
              },
            },
          },
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
