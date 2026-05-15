import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const session = await auth();
    const user = session?.user;

    if (!user) {
      return NextResponse.json(errorResponse("Unauthorized", 401), {
        status: 401,
      });
    }

    const { searchParams } = new URL(req.url);
    const regionId = searchParams.get("regionId");

    if (!regionId) {
      return NextResponse.json(errorResponse("regionId diperlukan", 400), {
        status: 400,
      });
    }

    const branches = await prisma.branch.findMany({
      where: { regionId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(
      successResponse(branches, "Berhasil mengambil data kantor cabang"),
      { status: 200 },
    );
  } catch (error) {
    console.log("ERROR GET /api/reports/filter-options/kancab", error);
    return NextResponse.json(errorResponse("Internal Server Error"), {
      status: 500,
    });
  }
}
