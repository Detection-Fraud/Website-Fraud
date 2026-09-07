import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_INPUT_PIXELS = 40_000_000;
export const IMPORTANT_INFORMATION_NAMESPACE = "important-information";
const UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");

const IMAGE_URL_PREFIX = `/uploads/${IMPORTANT_INFORMATION_NAMESPACE}/`;

function isContained(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export type ImportantInformationStoredImage = {
  imageUrl: string;
  width: number;
  height: number;
};

export type ImportantInformationStorageErrorCode =
  | "validation"
  | "size"
  | "decode";

export class ImportantInformationStorageError extends Error {
  constructor(
    public readonly code: ImportantInformationStorageErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ImportantInformationStorageError";
  }
}

export async function validateAndStoreImportantInformationImage(
  file: File,
): Promise<ImportantInformationStoredImage> {
  if (file.size > MAX_IMAGE_BYTES)
    throw new ImportantInformationStorageError(
      "size",
      "Ukuran gambar melebihi batas",
    );
  const format =
    file.type === "image/jpeg"
      ? "jpeg"
      : file.type === "image/png"
        ? "png"
        : null;
  if (!format)
    throw new ImportantInformationStorageError(
      "validation",
      "MIME gambar tidak valid",
    );
  const bytes = Buffer.from(await file.arrayBuffer());
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes
    .subarray(0, 8)
    .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if ((format === "jpeg" && !jpeg) || (format === "png" && !png))
    throw new ImportantInformationStorageError(
      "validation",
      "Signature gambar tidak valid",
    );
  let createdImageUrl: string | undefined;
  try {
    const input = sharp(bytes, {
      limitInputPixels: MAX_INPUT_PIXELS,
      failOn: "error",
    });
    const metadata = await input.metadata();
    if (
      metadata.format !== format ||
      !metadata.width ||
      !metadata.height ||
      metadata.width * metadata.height > MAX_INPUT_PIXELS
    )
      throw new Error("decode");
    const normalized =
      format === "jpeg"
        ? await input.rotate().jpeg().toBuffer({ resolveWithObject: true })
        : await input.rotate().png().toBuffer({ resolveWithObject: true });
    if (normalized.info.width <= 0 || normalized.info.height <= 0)
      throw new Error("dimensions");
    const name = `${randomUUID()}.${format === "jpeg" ? "jpg" : "png"}`;
    const directory = path.resolve(UPLOAD_DIR, IMPORTANT_INFORMATION_NAMESPACE);
    const target = path.resolve(directory, name);
    if (!isContained(directory, target))
      throw new Error("path");
    const imageUrl = `${IMAGE_URL_PREFIX}${name}`;
    createdImageUrl = imageUrl;
    await mkdir(directory, { recursive: true });
    await writeFile(target, normalized.data);
    return {
      imageUrl,
      width: normalized.info.width,
      height: normalized.info.height,
    };
  } catch (error) {
    if (createdImageUrl) await removeImageFile(createdImageUrl);
    if (error instanceof ImportantInformationStorageError) throw error;
    throw new ImportantInformationStorageError(
      "decode",
      "Gambar tidak dapat didecode",
    );
  }
}

function resolveImportantInformationImagePath(imageUrl: string): string {
  const filename = imageUrl.startsWith(IMAGE_URL_PREFIX)
    ? imageUrl.slice(IMAGE_URL_PREFIX.length)
    : "";
  if (!/^[0-9a-f-]{36}\.(jpg|png)$/.test(filename))
    throw new ImportantInformationStorageError(
      "validation",
      "Lokasi gambar tidak valid",
    );
  const root = path.resolve(UPLOAD_DIR, IMPORTANT_INFORMATION_NAMESPACE);
  const target = path.resolve(root, filename);
  if (!isContained(root, target))
    throw new ImportantInformationStorageError(
      "validation",
      "Lokasi gambar tidak valid",
    );
  return target;
}

async function removeImageFile(imageUrl: string): Promise<void> {
  const target = resolveImportantInformationImagePath(imageUrl);
  try {
    await unlink(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    console.error("[important-information-storage] cleanup failed", error);
  }
}

export async function deleteImportantInformationImage(
  imageUrl: string,
): Promise<void> {
  await removeImageFile(imageUrl);
}
export async function rollbackImportantInformationImage(
  imageUrl: string,
): Promise<void> {
  await removeImageFile(imageUrl);
}
