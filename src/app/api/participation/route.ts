import {
  ApiError,
  handleApiError,
  requireAdmin,
} from "@/lib/api/auth-guard";
import {
  commitParticipationWorkbook,
  previewParticipationWorkbook,
} from "@/lib/participation-workbook/service";
import { errorResponse, successResponse } from "@/lib/response";
import { participationFilterSchema } from "@/schemas/participation.schema";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

const correctionMetadataSchema = z
  .object({
    unitCode: z.string().trim().min(1, "Kode Unit wajib diisi"),
    overwrite: z.literal(true),
    reason: z
      .string()
      .trim()
      .min(1, "Alasan koreksi wajib diisi")
      .max(500, "Alasan koreksi maksimal 500 karakter"),
    expectedUpdatedAt: z.string().datetime("Versi data tidak valid"),
  })
  .strict();

const commitFormSchema = participationFilterSchema.extend({
  corrections: z.array(correctionMetadataSchema).default([]),
});

const MAX_PARTICIPATION_WORKBOOK_BYTES = 2 * 1024 * 1024;

function getRequiredFile(value: FormDataEntryValue | null): File {
  if (!(value instanceof File)) {
    throw new ApiError("File Excel wajib diunggah", 400);
  }

  if (
    value.type !==
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" &&
    !value.name.toLowerCase().endsWith(".xlsx")
  ) {
    throw new ApiError("File harus berformat XLSX", 400);
  }

  if (value.size > MAX_PARTICIPATION_WORKBOOK_BYTES) {
    throw new ApiError("File maksimal 2MB", 400);
  }

  return value;
}

function parseCorrections(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") {
    return [];
  }

  let decoded: unknown;

  try {
    decoded = JSON.parse(value);
  } catch {
    throw new ApiError("Corrections harus berupa JSON yang valid", 400);
  }

  const parsed = commitFormSchema.shape.corrections.safeParse(decoded);

  if (!parsed.success) {
    throw new ApiError(parsed.error.issues[0].message, 400);
  }

  return parsed.data;
}

type ParsedMultipartRequest =
  | { ok: false; error: Response }
  | {
      ok: true;
      file: File;
      data: z.infer<typeof commitFormSchema>;
    };

async function parseMultipartRequest(
  req: NextRequest,
): Promise<ParsedMultipartRequest> {
  let formData: FormData;

  try {
    formData = await req.formData();
  } catch {
    throw new ApiError("Payload multipart tidak valid", 400);
  }
  const file = getRequiredFile(formData.get("file"));

  const parsed = commitFormSchema.safeParse({
    categoryId: formData.get("categoryId"),
    tw: formData.get("tw"),
    year: formData.get("year"),
    corrections:
      formData.get("corrections") === null
        ? []
        : parseCorrections(formData.get("corrections")),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: NextResponse.json(
        errorResponse(parsed.error.issues[0].message, 400),
        { status: 400 },
      ),
    };
  }

  return {
    ok: true,
    file,
    data: parsed.data,
  };
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const session = await requireAdmin();
    const action = new URL(req.url).searchParams.get("action");

    if (action !== "preview" && action !== "commit") {
      return NextResponse.json(
        errorResponse(
          "Action tidak valid. Gunakan ?action=preview atau ?action=commit",
          400,
        ),
        { status: 400 },
      );
    }

    const parsedRequest = await parseMultipartRequest(req);

    if (!parsedRequest.ok) {
      return parsedRequest.error;
    }

    const buffer = Buffer.from(await parsedRequest.file.arrayBuffer());
    const { categoryId, tw, year } = parsedRequest.data;

    if (action === "preview") {
      const preview = await previewParticipationWorkbook({
        buffer,
        categoryId,
        tw,
        year,
      });

      return NextResponse.json(
        successResponse(preview, "Preview partisipasi berhasil"),
      );
    }

    const result = await commitParticipationWorkbook({
      buffer,
      categoryId,
      tw,
      year,
      corrections: parsedRequest.data.corrections,
      actorId: session.user.id,
      actorName: session.user.name,
    });

    return NextResponse.json(
      successResponse(result, "Import partisipasi berhasil"),
    );
  } catch (error) {
    return handleApiError(error, "POST /api/participation");
  }
}
