import { handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import { successResponse } from "@/lib/response";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

  const searchParams = req.nextUrl.searchParams;
  const unitId = searchParams.get("unitId");
  const search = searchParams.get("search") || "";
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const limit = Math.max(1, Number(searchParams.get("limit") || "10"));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    role: "PIC",
    ...(unitId && unitId !== "ALL" ? { unitId } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { username: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        unitId: true,
        isActive: true,
        unit: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

    return NextResponse.json(
      successResponse(
        {
          users,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        },
        "Berhasil mengambil data user",
        200,
      ),
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error, "GET /api/users");
  }
}
