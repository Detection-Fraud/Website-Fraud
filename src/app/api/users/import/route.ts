import { ApiError, requireAdmin } from "@/lib/api/auth-guard";
import { errorResponse } from "@/lib/response";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    await requireAdmin();
    return NextResponse.json(
      errorResponse("Import User legacy dinonaktifkan; gunakan API import Employee resmi", 410),
      { status: 410 },
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(errorResponse(error.message, error.status), { status: error.status });
    }
    return NextResponse.json(errorResponse("INTERNAL_ERROR", 500), { status: 500 });
  }
}
