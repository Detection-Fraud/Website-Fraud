import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rmdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  mintLegacyCleanupToken,
  mintLegacyUploadDescriptor,
  verifyLegacyReportPhoto,
} from "./legacy-upload-capability";

test("report accepts only an existing upload signed for its PIC and purpose", async () => {
  const originalSecret = process.env.AUTH_SECRET;
  const originalUploadDir = process.env.UPLOAD_DIR;
  const directory = await mkdtemp(path.join(tmpdir(), "report-upload-contract-"));
  const publicId = `${randomUUID()}.jpg`;
  const filePath = path.join(directory, publicId);
  process.env.AUTH_SECRET = "focused-upload-contract-test-secret";
  process.env.UPLOAD_DIR = directory;

  try {
    await writeFile(filePath, Buffer.from([0xff, 0xd8, 0xff]));
    const context = { purpose: "EVIDENCE", mode: "CREATE" } as const;
    const photo = {
      publicId,
      imageUrl: `/uploads/${publicId}`,
      descriptor: mintLegacyUploadDescriptor(publicId, "pic-1", context),
      cleanupToken: mintLegacyCleanupToken(publicId, "pic-1"),
    };

    assert.equal(await verifyLegacyReportPhoto(photo, "pic-1", context), true);
    assert.equal(await verifyLegacyReportPhoto(photo, "pic-2", context), false);
    assert.equal(await verifyLegacyReportPhoto(photo, "pic-1", {
      purpose: "EVIDENCE", mode: "REPLACEMENT", reportId: randomUUID(),
    }), false);
    assert.equal(await verifyLegacyReportPhoto({
      ...photo,
      imageUrl: `/uploads/${randomUUID()}.jpg`,
    }, "pic-1", context), false);
    await unlink(filePath);
    assert.equal(await verifyLegacyReportPhoto(photo, "pic-1", context), false);
  } finally {
    if (originalSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = originalSecret;
    if (originalUploadDir === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = originalUploadDir;
    await unlink(filePath).catch(() => undefined);
    await rmdir(directory);
  }
});
