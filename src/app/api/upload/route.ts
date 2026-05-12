import { errorResponse } from "@/lib/response";
import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(errorResponse("File wajib diisi", 400), {
        status: 400,
      });
    }

    const MAX_SIZE_BYTES = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        errorResponse(`File maksimal ${MAX_SIZE_BYTES}MB`, 400),
        { status: 400 },
      );
    }

    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/jpg"];
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(errorResponse(`Tipe file tidak didukung`, 400), {
        status: 400,
      });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: "fraud-detection" },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
      );

      uploadStream.end(buffer);
    });

    const result = uploadResult as any;

    return NextResponse.json(
      {
        message: "Upload Berhasil",
        url: result.secure_url,
        publicId: result.public_id, // Simpan untuk keperluan delete di Cloudinary
        originalName: file.name,
      },
      { status: 200 },
    );
  } catch (e) {
    console.log(e);
    return NextResponse.json(errorResponse("Internal Server Error"), {
      status: 500,
    });
  }
}
