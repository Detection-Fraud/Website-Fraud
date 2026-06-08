import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json(errorResponse("Forbidden", 403), { status: 403 });
  }

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
}


