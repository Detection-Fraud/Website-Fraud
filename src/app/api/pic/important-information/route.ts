import { handleApiError, requirePic } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import { successResponse } from "@/lib/response";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await requirePic();
    const rows = await prisma.picImportantInformation.findMany({
      where: { isActive: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        imageUrl: true,
        altText: true,
        width: true,
        height: true,
        order: true,
      },
    });
    return NextResponse.json(successResponse({ items: rows }, "Berhasil"));
  } catch (error) {
    return handleApiError(error, "GET /api/pic/important-information");
  }
}
