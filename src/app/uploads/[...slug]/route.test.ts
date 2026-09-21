import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { NextRequest } from "next/server";

import { GET } from "./route";

const UNIT_ID = "11111111-1111-4111-8111-111111111111";
const PHOTO_ID = "8f211111-1111-4111-8111-111111111111";

let uploadRoot: string;
const previousUploadDir = process.env.UPLOAD_DIR;

before(async () => {
  uploadRoot = await mkdtemp(path.join(tmpdir(), "upload-route-test-"));
  process.env.UPLOAD_DIR = uploadRoot;

  const files = new Map([
    [`${PHOTO_ID}.jpg`, "legacy"],
    [`${PHOTO_ID}.jpeg`, "legacy-jpeg"],
    [`${PHOTO_ID}.gif`, "legacy-gif"],
    [`${PHOTO_ID}.webp`, "legacy-webp"],
    [`reports/${UNIT_ID}/2026/09/${PHOTO_ID}.jpg`, "report"],
    [`banners/programs/${PHOTO_ID}.jpg`, "program"],
    [`banners/categories/${PHOTO_ID}.jpg`, "category"],
    [`banners/login/${PHOTO_ID}.jpg`, "login"],
    [`important-information/${PHOTO_ID}.png`, "important"],
  ]);

  for (const [relativePath, contents] of files) {
    const filePath = path.join(uploadRoot, ...relativePath.split("/"));
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, contents);
  }
});

after(async () => {
  if (previousUploadDir === undefined) delete process.env.UPLOAD_DIR;
  else process.env.UPLOAD_DIR = previousUploadDir;
  await rm(uploadRoot, { recursive: true, force: true });
});

function request() {
  return new NextRequest("http://localhost/uploads/test");
}

async function get(slug: string[]) {
  return GET(request(), {
    params: Promise.resolve({ slug }),
  });
}

test("serves legacy and every locked nested namespace", async () => {
  const cases = [
    { slug: [`${PHOTO_ID}.jpg`], body: "legacy", type: "image/jpeg" },
    {
      slug: ["reports", UNIT_ID, "2026", "09", `${PHOTO_ID}.jpg`],
      body: "report",
      type: "image/jpeg",
    },
    {
      slug: ["banners", "programs", `${PHOTO_ID}.jpg`],
      body: "program",
      type: "image/jpeg",
    },
    {
      slug: ["banners", "categories", `${PHOTO_ID}.jpg`],
      body: "category",
      type: "image/jpeg",
    },
    {
      slug: ["banners", "login", `${PHOTO_ID}.jpg`],
      body: "login",
      type: "image/jpeg",
    },
    {
      slug: ["important-information", `${PHOTO_ID}.png`],
      body: "important",
      type: "image/png",
    },
  ];

  for (const item of cases) {
    const response = await get(item.slug);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), item.body);
    assert.equal(response.headers.get("Content-Type"), item.type);
    assert.equal(
      response.headers.get("Content-Length"),
      String(item.body.length),
    );
    assert.equal(
      response.headers.get("Cache-Control"),
      "public, max-age=31536000, immutable",
    );
  }
});

test("preserves existing legacy MIME mappings", async () => {
  const cases = [
    { extension: "jpeg", body: "legacy-jpeg", type: "image/jpeg" },
    { extension: "gif", body: "legacy-gif", type: "image/gif" },
    { extension: "webp", body: "legacy-webp", type: "image/webp" },
  ];

  for (const item of cases) {
    const response = await get([`${PHOTO_ID}.${item.extension}`]);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), item.body);
    assert.equal(response.headers.get("Content-Type"), item.type);
  }
});

test("returns 404 for missing and directory targets", async () => {
  const missing = await get([`${PHOTO_ID}-missing.jpg`]);
  assert.equal(missing.status, 404);

  await mkdir(
    path.join(
      uploadRoot,
      "important-information",
      "00000000-0000-4000-8000-000000000098.jpg",
    ),
    { recursive: true },
  );
  const directory = await get([
    "important-information",
    "00000000-0000-4000-8000-000000000098.jpg",
  ]);
  assert.equal(directory.status, 404);
});

test("returns 403 for unsafe or unknown references", async () => {
  const cases = [
    // Next.js decodes /uploads/%2e%2e/secret.txt before invoking GET.
    ["..", "secret.txt"],
    ["..\\secret.txt"],
    ["/etc/passwd"],
    ["\\etc\\passwd"],
    ["unknown", "secret.txt"],
  ];

  for (const slug of cases) {
    const response = await get(slug);
    assert.equal(response.status, 403);
    assert.equal(await response.text(), "Forbidden");
  }
});

test("returns generic 500 for invalid configured upload root without disclosure", async () => {
  const previous = process.env.UPLOAD_DIR;
  const rootFile = path.join(uploadRoot, "not-a-directory");
  await writeFile(rootFile, "root-file");
  process.env.UPLOAD_DIR = rootFile;

  try {
    const response = await get([`${PHOTO_ID}.jpg`]);
    const body = await response.text();

    assert.equal(response.status, 500);
    assert.equal(body, "Internal Server Error");
    assert.equal(body.includes(rootFile), false);
  } finally {
    process.env.UPLOAD_DIR = previous;
  }
});

test("unsafe route requests never return outside sentinel bytes", async () => {
  const outside = path.join(
    uploadRoot,
    "..",
    "upload-route-outside-secret.txt",
  );
  await writeFile(outside, "outside-sentinel");

  try {
    const response = await get(["..", path.basename(outside)]);
    const body = await response.text();

    assert.equal(response.status, 403);
    assert.equal(body.includes("outside-sentinel"), false);
  } finally {
    await rm(outside, { force: true });
  }
});
