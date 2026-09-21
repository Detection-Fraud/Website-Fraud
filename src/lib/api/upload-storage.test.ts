import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  classifyStorageKey,
  classifyUploadReference,
  resolvePublicUploadPath,
  resolveUploadReference,
  storageKeyToPublicUrl,
} from "./upload-storage";

const REPORT_UNIT_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_FILE = "8f211111-1111-4111-8111-111111111111.jpg";

async function withUploadRoot<T>(callback: (root: string) => Promise<T>) {
  const previousUploadDir = process.env.UPLOAD_DIR;
  const root = await mkdtemp(path.join(tmpdir(), "upload-storage-test-"));
  process.env.UPLOAD_DIR = root;

  try {
    return await callback(root);
  } finally {
    if (previousUploadDir === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = previousUploadDir;
    await rm(root, { recursive: true, force: true });
  }
}

async function writeFixture(root: string, key: string, content = "fixture") {
  const filePath = path.join(root, ...key.split("/"));
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content);
  return filePath;
}

function assertLocal(
  result: Awaited<ReturnType<typeof resolveUploadReference>>,
) {
  assert.equal(result.kind, "local");
  if (result.kind !== "local") throw new Error("Expected local resolution");
  assert.equal(result.exists, true);
  assert.equal(result.isRegularFile, true);
  return result;
}

test("legacy flat file resolves", async () => {
  await withUploadRoot(async (root) => {
    const key = "historical-banner-final.jpg";
    const expectedPath = await writeFixture(root, key, "legacy");
    const result = assertLocal(await resolvePublicUploadPath([key]));

    assert.equal(result.source, "legacy-flat");
    assert.equal(result.filePath, expectedPath);
    assert.equal(await readFile(result.filePath, "utf8"), "legacy");
  });
});

test("Important Information path resolves", async () => {
  await withUploadRoot(async (root) => {
    const key =
      "important-information/92ef0000-0000-4000-8000-000000000001.png";
    await writeFixture(root, key);
    const result = assertLocal(await resolveUploadReference(`/uploads/${key}`));

    assert.equal(result.source, "important-information");
  });
});

test("Important Information rejects non-UUID filenames", () => {
  assert.equal(
    classifyStorageKey("important-information/admin-draft.png"),
    null,
  );
});

test("all local public URL forms resolve through the shared API", async () => {
  await withUploadRoot(async (root) => {
    const keys = [
      REPORT_FILE,
      `reports/${REPORT_UNIT_ID}/2026/09/${REPORT_FILE}`,
      `banners/programs/${REPORT_FILE}`,
      `banners/categories/${REPORT_FILE}`,
      `banners/login/${REPORT_FILE}`,
    ];

    for (const key of keys) {
      await writeFixture(root, key);
      const result = assertLocal(
        await resolveUploadReference(`/uploads/${key}`),
      );
      assert.equal(result.storageKey, key);
    }
  });
});

test("nested report path resolves", async () => {
  await withUploadRoot(async (root) => {
    const key = `reports/${REPORT_UNIT_ID}/2026/09/${REPORT_FILE}`;
    await writeFixture(root, key);
    const result = assertLocal(
      await resolvePublicUploadPath([
        "reports",
        REPORT_UNIT_ID,
        "2026",
        "09",
        REPORT_FILE,
      ]),
    );

    assert.equal(result.source, "report");
    assert.equal(result.storageKey, key);
  });
});

test("program, category, and login banner paths resolve", async () => {
  await withUploadRoot(async (root) => {
    for (const namespace of ["programs", "categories", "login"] as const) {
      const key = `banners/${namespace}/${REPORT_FILE}`;
      await writeFixture(root, key);
      const result = assertLocal(
        await resolvePublicUploadPath(["banners", namespace, REPORT_FILE]),
      );

      assert.equal(result.source, `banner-${namespace}`);
    }
  });
});

test("missing file and missing upload root are classified as missing", async () => {
  await withUploadRoot(async (root) => {
    const missing = await resolvePublicUploadPath(["missing.jpg"]);
    assert.equal(missing.kind, "missing");

    process.env.UPLOAD_DIR = path.join(root, "missing-root");
    const missingRoot = await resolvePublicUploadPath(["missing.jpg"]);
    assert.equal(missingRoot.kind, "missing");
  });
});

test("traversal and unsafe path forms are rejected", async () => {
  await withUploadRoot(async () => {
    const references = [
      "/uploads/../secret.txt",
      "/uploads/%2e%2e/secret.txt",
      "/uploads/%2fetc%2fpasswd",
      "/uploads/..\\secret.txt",
      "/uploads/photo.jpg\0.txt",
      "/uploads/C:/Windows/win.ini",
      "/uploads/\\\\server\\share\\secret.txt",
      "/uploads/../../uploads-private/secret.txt",
      "file:///etc/passwd",
      "data:text/plain,secret",
      "//example.com/secret.jpg",
    ];

    for (const reference of references) {
      const result = await resolveUploadReference(reference);
      assert.equal(result.kind, "unsafe", reference);
    }
  });
});

test("decoded Next.js route components remain unsafe", async () => {
  await withUploadRoot(async () => {
    const decodedSlugs = [
      ["..", "secret.txt"],
      ["/etc/passwd"],
      ["\\etc\\passwd"],
    ];

    for (const slug of decodedSlugs) {
      const result = await resolvePublicUploadPath(slug);
      assert.equal(result.kind, "unsafe", JSON.stringify(slug));
    }
  });
});

test("unknown namespace and malformed structured keys are rejected", async () => {
  const invalidKeys = [
    "staging/export.csv",
    `reports/${REPORT_UNIT_ID}/2026/9/${REPORT_FILE}`,
    `reports/${REPORT_UNIT_ID}/2026/13/${REPORT_FILE}`,
    `reports/${REPORT_UNIT_ID}/2026/09/${REPORT_FILE}/extra`,
    "banners/other/banner.jpg",
  ];

  for (const key of invalidKeys) {
    assert.equal(classifyStorageKey(key), null, key);
  }
});

test("directory target is not resolved as a regular file", async () => {
  await withUploadRoot(async (root) => {
    await mkdir(
      path.join(
        root,
        "important-information",
        "00000000-0000-4000-8000-000000000098.jpg",
      ),
      {
        recursive: true,
      },
    );

    const result = await resolvePublicUploadPath([
      "important-information",
      "00000000-0000-4000-8000-000000000098.jpg",
    ]);

    assert.equal(result.kind, "missing");
  });
});

test("HTTP and HTTPS references are classified without filesystem resolution", async () => {
  assert.deepEqual(classifyUploadReference("http://example.test/a.jpg"), {
    kind: "external-http",
    url: "http://example.test/a.jpg",
  });
  assert.deepEqual(classifyUploadReference("https://example.test/a.jpg"), {
    kind: "external-http",
    url: "https://example.test/a.jpg",
  });
});

test("storageKeyToPublicUrl creates only canonical upload URLs", () => {
  const key = `reports/${REPORT_UNIT_ID}/2026/09/${REPORT_FILE}`;
  assert.equal(storageKeyToPublicUrl(key), `/uploads/${key}`);
  assert.throws(() => storageKeyToPublicUrl("../secret.jpg"));
  assert.throws(() => storageKeyToPublicUrl("unknown/secret.jpg"));
});

async function createDirectoryJunction(
  target: string,
  linkPath: string,
  t: { skip: (message?: string) => void },
) {
  try {
    await symlink(target, linkPath, "junction");
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EPERM" || code === "EACCES" || code === "ENOSYS") {
      t.skip(`directory junction unavailable: ${code}`);
      return false;
    }
    throw error;
  }
}

async function createFileSymlink(
  target: string,
  linkPath: string,
  t: { skip: (message?: string) => void },
) {
  try {
    await symlink(target, linkPath, "file");
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EPERM" || code === "EACCES" || code === "ENOSYS") {
      t.skip(`file symlink unavailable: ${code}`);
      return false;
    }
    throw error;
  }
}

test("configured upload-root junction remains supported", async (t) => {
  await withUploadRoot(async (root) => {
    const realRoot = path.join(root, "real-root");
    const configuredRoot = path.join(root, "configured-root");
    const key = `banners/programs/${REPORT_FILE}`;
    await writeFixture(realRoot, key, "root-junction");
    if (!(await createDirectoryJunction(realRoot, configuredRoot, t))) return;

    process.env.UPLOAD_DIR = configuredRoot;
    const result = assertLocal(
      await resolvePublicUploadPath(["banners", "programs", REPORT_FILE]),
    );

    assert.equal(await readFile(result.filePath, "utf8"), "root-junction");
    assert.equal(path.resolve(result.filePath), result.filePath);
  });
});

test("descendant junction escaping to a sibling-prefix directory is rejected", async (t) => {
  await withUploadRoot(async (root) => {
    const siblingRoot = `${root}-private`;
    const linkPath = path.join(root, "reports", REPORT_UNIT_ID, "2026");
    const key = `reports/${REPORT_UNIT_ID}/2026/09/${REPORT_FILE}`;

    await writeFixture(siblingRoot, "09/unused.txt", "outside");
    await writeFixture(siblingRoot, `09/${REPORT_FILE}`, "outside-sentinel");
    await mkdir(path.dirname(linkPath), { recursive: true });
    if (!(await createDirectoryJunction(siblingRoot, linkPath, t))) {
      await rm(siblingRoot, { recursive: true, force: true });
      return;
    }

    try {
      const result = await resolvePublicUploadPath(key.split("/"));
      assert.equal(result.kind, "unsafe");
    } finally {
      await rm(siblingRoot, { recursive: true, force: true });
    }
  });
});

test("descendant file symlink escape is rejected", async (t) => {
  await withUploadRoot(async (root) => {
    const outsideFile = path.join(root, "outside-secret.jpg");
    const linkPath = path.join(
      root,
      "important-information",
      "00000000-0000-4000-8000-000000000099.jpg",
    );

    await writeFile(outsideFile, "outside-sentinel");
    await mkdir(path.dirname(linkPath), { recursive: true });
    if (!(await createFileSymlink(outsideFile, linkPath, t))) return;

    const result = await resolvePublicUploadPath([
      "important-information",
      "00000000-0000-4000-8000-000000000099.jpg",
    ]);

    assert.equal(result.kind, "unsafe");
  });
});
