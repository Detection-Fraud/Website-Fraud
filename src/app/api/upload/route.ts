import { errorResponse } from "@/lib/response";
import { v2 as cloudinary } from "cloudinary";
import { error } from "console";
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

    return NextResponse.json(
      {
        message: "Upload Berhasil",
        url: (uploadResult as any).secure_url,
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
