import { handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextResponse } from "next/server";
import { z } from "zod";

const bannerSchema = z.object({
  imageUrl: z.string().min(1, "URL gambar wajib diisi"),
  name: z.string().min(2, "Nama minimal 2 karakter"),
  role: z.string().min(2, "Role/Jabatan wajib diisi"),
  unit: z.string().min(2, "Unit kerja wajib diisi"),
  period: z.string().min(2, "Periode wajib diisi"),
  order: z.number().int().default(0),
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const showAll = searchParams.get("all") === "true";

    const whereClause = showAll ? {} : { isActive: true };

    const banners = await prisma.loginBanner.findMany({
      where: whereClause,
      orderBy: { order: "asc" },
    });

    return NextResponse.json(successResponse(banners));
  } catch (error) {
    return handleApiError(error, "GET /api/banners");
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();

    const body = await req.json();
    const parsed = bannerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        errorResponse(parsed.error.issues[0].message, 400),
      );
    }

    const banner = await prisma.loginBanner.create({
      data: {
        ...parsed.data,
        isActive: true,
      },
    });

    return NextResponse.json(
      successResponse(banner, "Banner berhasil ditambahkan"),
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, "POST /api/banners");
  }
}
