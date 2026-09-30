import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { before, mock, test } from "node:test";
import { NextRequest } from "next/server";
import type { resolveUploadReference } from "@/lib/api/upload-storage";

type TestRole = "ADMIN" | "PIC" | "VIEWER";
type TestSession = {
  user: { id: string; role: TestRole; unitId: string | null; unitName?: string };
};
type ExportPhoto = {
  id: number;
  imageUrl: string;
  report: {
    activityName: string;
    tanggalKegiatan: Date;
    createdBy: { name: string };
    program: { name: string };
  };
};
type UploadReferenceResolution = Awaited<ReturnType<typeof resolveUploadReference>>;

const authMock = mock.fn(async (): Promise<TestSession> => ({ user: { id: "pic", role: "PIC", unitId: "unit-1", unitName: "Unit" } }));
const photosMock = mock.fn(async (): Promise<ExportPhoto[]> => []);
const unitMock = mock.fn(async () => ({ name: "Unit" }));
const categoryMock = mock.fn(async (args: { where: { id: string }; select: { name: true } }) => {
  void args;
  return { name: "Category" };
});
const picWhereMock = mock.fn((unit: string, program: string) => {
  void unit;
  void program;
  return {};
});
const adminWhereMock = mock.fn(async (filters: unknown) => ({ where: filters, labelUnitId: "unit-1" }));
const unitIdMock = mock.fn(() => "unit-1");
const resolverMock = mock.fn(async (url: string): Promise<UploadReferenceResolution> => {
  void url;
  return { kind: "missing", storageKey: "x", source: "legacy-flat" };
});
const readFileMock = mock.fn(async () => Buffer.from("image"));

class FakePDFDocument extends EventEmitter {
  static last: FakePDFDocument | undefined;
  readonly images: unknown[] = [];
  readonly texts: unknown[][] = [];
  constructor() { super(); FakePDFDocument.last = this; }
  image(value: unknown) { this.images.push(value); return this; }
  text(...args: unknown[]) { this.texts.push(args); return this; }
  end() { this.emit("data", Buffer.from("pdf")); this.emit("end"); }
  destroy(error?: Error) { if (error) this.emit("error", error); }
  addPage() { return this; } font() { return this; } fontSize() { return this; }
  fillColor() { return this; } strokeColor() { return this; } lineWidth() { return this; }
  moveTo() { return this; } lineTo() { return this; } stroke() { return this; }
  roundedRect() { return this; } rect() { return this; } fill() { return this; }
}

class TestApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

mock.module("@/lib/api/auth-guard", { namedExports: {
  requireAuth: authMock,
  ApiError: TestApiError,
  handleApiError: (error: unknown) =>
    Response.json({}, {
      status: error instanceof TestApiError ? error.status : 500,
    }),
} });
mock.module("@/lib/api/collage", { namedExports: {
  picCollageExportQuerySchema: { safeParse: (data: unknown) => ({ success: true, data }) },
  adminCollageExportQuerySchema: { safeParse: (data: unknown) => ({ success: true, data }) },
  buildPicCollagePhotoWhere: picWhereMock, buildAdminCollagePhotoWhere: adminWhereMock, getExactPicUnitId: unitIdMock,
} });
mock.module("@/lib/api/upload-storage", { namedExports: { resolveUploadReference: resolverMock } });
mock.module("@/lib/prisma", { namedExports: { prisma: { activityPhoto: { findMany: photosMock }, unit: { findUnique: unitMock }, programCategory: { findUnique: categoryMock } } } });
mock.module("fs/promises", { namedExports: { readFile: readFileMock } });
mock.module("pdfkit", { defaultExport: FakePDFDocument });

let GET: (request: NextRequest) => Promise<Response>;

before(async () => {
  ({ GET } = await import("./route"));
});
const nested = "/uploads/reports/11111111-1111-4111-8111-111111111111/2026/09/file.jpg";
const photo = (imageUrl: string) => ({ id: 1, imageUrl, report: { activityName: "A", tanggalKegiatan: new Date("2026-09-01"), createdBy: { name: "PIC" }, program: { name: "P" } } });
const request = (query = "programId=ALL") =>
  new NextRequest(`http://localhost/api/reports/export-collage?${query}`);

test("PIC reads nested and legacy-flat references", async () => {
  photosMock.mock.mockImplementationOnce(async () => [photo(nested), photo("/uploads/legacy.jpg")]);
  resolverMock.mock.mockImplementation(async (url) => ({ kind: "local", storageKey: url.slice(9), source: url === nested ? "report" : "legacy-flat", filePath: "C:\\safe\\photo.jpg", exists: true, isRegularFile: true }));
  const response = await GET(request()); await response.arrayBuffer();
  assert.equal(response.status, 200); assert.equal(readFileMock.mock.calls.length, 2);
  assert.deepEqual(picWhereMock.mock.calls[0].arguments, ["unit-1", "ALL"]);
});

test("missing, unsafe, and external references render unavailable without readFile/fetch", async () => {
  readFileMock.mock.resetCalls();
  photosMock.mock.mockImplementationOnce(async () => [photo("/uploads/missing.jpg"), photo("/uploads/../secret.jpg"), photo("https://cdn.example.test/x.jpg")]);
  resolverMock.mock.mockImplementation(async (url) => url.startsWith("https://") ? { kind: "external-http", url } : url.includes("missing") ? { kind: "missing", storageKey: "missing.jpg", source: "legacy-flat" } : { kind: "unsafe", reason: "traversal" });
  const response = await GET(request()); await response.arrayBuffer();
  assert.equal(response.status, 200); assert.equal(readFileMock.mock.calls.length, 0);
  const pdf = FakePDFDocument.last;
  assert.ok(pdf);
  assert.equal(pdf.texts.filter((args) => args.includes("Foto tidak tersedia")).length, 3);
});

test("ADMIN preserves filter arguments and unauthorized VIEWER receives 403", async () => {
  authMock.mock.mockImplementationOnce(async () => ({ user: { id: "admin", role: "ADMIN", unitId: null } }));
  photosMock.mock.mockImplementationOnce(async () => [photo(nested)]);
  resolverMock.mock.mockImplementationOnce(async () => ({
    kind: "missing",
    storageKey: "x",
    source: "legacy-flat",
  }));
  const adminResponse = await GET(request("programId=ALL&categoryId=cat-1")); await adminResponse.arrayBuffer();
  assert.equal(adminResponse.status, 200); assert.deepEqual(adminWhereMock.mock.calls[0].arguments[0], { programId: "ALL", categoryId: "cat-1" });
  assert.deepEqual(categoryMock.mock.calls[0].arguments[0], { where: { id: "cat-1" }, select: { name: true } });

  authMock.mock.mockImplementationOnce(async () => ({ user: { id: "viewer", role: "VIEWER", unitId: "unit-1" } }));
  photosMock.mock.resetCalls();
  const viewerResponse = await GET(request());
  assert.equal(viewerResponse.status, 403); assert.equal(photosMock.mock.calls.length, 0);
});
