import assert from "node:assert/strict";
import { access, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import sharp from "sharp";

let storage: typeof import("./important-information-storage");
let testUploadDir: string;

before(async () => {
  testUploadDir = await mkdtemp(path.join(tmpdir(), "test-important-info-"));
  process.env.UPLOAD_DIR = testUploadDir;
  storage = await import("./important-information-storage");
});

after(async () => {
  if (testUploadDir) {
    await rm(testUploadDir, { recursive: true, force: true });
  }
});

test("stores valid PNG and returns dimensions and safe URL", async () => {
  const pngBuffer = await sharp({
    create: {
      width: 400,
      height: 200,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    .png()
    .toBuffer();

  const file = new File([pngBuffer], "banner.png", { type: "image/png" });
  const result = await storage.validateAndStoreImportantInformationImage(file);

  assert.equal(result.width, 400);
  assert.equal(result.height, 200);
  assert.match(
    result.imageUrl,
    /^\/uploads\/important-information\/[0-9a-f-]{36}\.png$/,
  );

  const storedFiles = await readdir(path.join(testUploadDir, "important-information"));
  assert.deepEqual(storedFiles, [result.imageUrl.split("/").pop()]);

  // Test rollback / delete
  await storage.rollbackImportantInformationImage(result.imageUrl);
  await storage.deleteImportantInformationImage(result.imageUrl); // idempotent ENOENT
});

test("stores valid JPEG and returns dimensions and safe URL", async () => {
  const jpegBuffer = await sharp({
    create: {
      width: 600,
      height: 300,
      channels: 3,
      background: { r: 0, g: 255, b: 0 },
    },
  })
    .jpeg()
    .toBuffer();

  const file = new File([jpegBuffer], "banner.jpg", { type: "image/jpeg" });
  const result = await storage.validateAndStoreImportantInformationImage(file);

  assert.equal(result.width, 600);
  assert.equal(result.height, 300);
  assert.match(
    result.imageUrl,
    /^\/uploads\/important-information\/[0-9a-f-]{36}\.jpg$/,
  );

  await storage.deleteImportantInformationImage(result.imageUrl);
});

test("rejects files exceeding MAX_IMAGE_BYTES", async () => {
  const largeBuffer = Buffer.alloc(storage.MAX_IMAGE_BYTES + 10);
  const file = new File([largeBuffer], "large.png", { type: "image/png" });

  await assert.rejects(
    () => storage.validateAndStoreImportantInformationImage(file),
    (err: unknown) => {
      assert.ok(err instanceof storage.ImportantInformationStorageError);
      assert.equal(err.code, "size");
      return true;
    },
  );
});

test("rejects invalid MIME type", async () => {
  const file = new File(["dummy text"], "dummy.txt", { type: "text/plain" });

  await assert.rejects(
    () => storage.validateAndStoreImportantInformationImage(file),
    (err: unknown) => {
      assert.ok(err instanceof storage.ImportantInformationStorageError);
      assert.equal(err.code, "validation");
      return true;
    },
  );
});

test("rejects unsupported image MIME values before reading bytes", async () => {
  let read = false;
  const file = new File(["dummy"], "image.jpg", { type: "image/jpg" });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => {
      read = true;
      return new ArrayBuffer(0);
    },
  });

  await assert.rejects(
    () => storage.validateAndStoreImportantInformationImage(file),
    (err: unknown) => {
      assert.ok(err instanceof storage.ImportantInformationStorageError);
      assert.equal(err.code, "validation");
      return true;
    },
  );
  assert.equal(read, false);
});

test("rejects MIME and signature mismatch", async () => {
  const file = new File(["not a png"], "fake.png", { type: "image/png" });

  await assert.rejects(
    () => storage.validateAndStoreImportantInformationImage(file),
    (err: unknown) => {
      assert.ok(err instanceof storage.ImportantInformationStorageError);
      assert.equal(err.code, "validation");
      return true;
    },
  );
});

test("rejects corrupt image bytes", async () => {
  const corruptPng = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00,
  ]);
  const file = new File([corruptPng], "corrupt.png", { type: "image/png" });

  await assert.rejects(
    () => storage.validateAndStoreImportantInformationImage(file),
    (err: unknown) => {
      assert.ok(err instanceof storage.ImportantInformationStorageError);
      assert.equal(err.code, "decode");
      return true;
    },
  );
});

test("rejects invalid image path deletion / traversal attempts", async () => {
  await assert.rejects(
    () =>
      storage.deleteImportantInformationImage(
        "/uploads/important-information/../../../etc/passwd",
      ),
    (err: unknown) => {
      assert.ok(err instanceof storage.ImportantInformationStorageError);
      assert.equal(err.code, "validation");
      return true;
    },
  );

  await assert.rejects(
    () =>
      storage.deleteImportantInformationImage("https://example.com/banner.png"),
    (err: unknown) => {
      assert.ok(err instanceof storage.ImportantInformationStorageError);
      assert.equal(err.code, "validation");
      return true;
    },
  );

  const namespaceDir = path.join(testUploadDir, "important-information");
  await rm(namespaceDir, { recursive: true, force: true });
  await storage.deleteImportantInformationImage(
    "/uploads/important-information/00000000-0000-0000-0000-000000000000.png",
  );
  await assert.rejects(
    () => access(namespaceDir),
    /ENOENT/,
  );
});

test("rejects decoded images above the input pixel limit", async () => {
  const oversizedImage = await sharp({
    create: {
      width: 10_001,
      height: 4_000,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .png()
    .toBuffer();
  const file = new File([oversizedImage], "too-large.png", {
    type: "image/png",
  });

  await assert.rejects(
    () => storage.validateAndStoreImportantInformationImage(file),
    (err: unknown) => {
      assert.ok(err instanceof storage.ImportantInformationStorageError);
      assert.equal(err.code, "decode");
      return true;
    },
  );
});
