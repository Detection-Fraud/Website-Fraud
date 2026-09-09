import assert from "node:assert/strict";
import { before, beforeEach, describe, it, mock } from "node:test";
import { NextRequest } from "next/server";

import {
  generateParticipationWorkbook,
  serializeParticipationWorkbook,
} from "@/lib/participation-workbook";

class TestApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

const requireAdminMock = mock.fn<(...args: any[]) => Promise<any>>(
  async () => ({
    user: {
      id: "admin-1",
      name: "Admin Test",
      role: "ADMIN",
    },
  }),
);

const previewParticipationWorkbookMock = mock.fn<
  (...args: any[]) => Promise<any>
>(async () => ({
  stats: {
    total: 1,
    first: 1,
    unchanged: 0,
    correction: 0,
    empty: 0,
    error: 0,
  },
  rows: [
    {
      id: 0,
      sheetKey: "SUMMARY",
      rowNumber: 2,
      unitCode: "UNIT-A",
      unitId: "unit-a",
      unitName: "Unit A",
      participantCount: 80,
      headcount: 100,
      percentage: 80,
      existingParticipantCount: null,
      existingPercentage: null,
      expectedUpdatedAt: null,
      warning: null,
      status: "FIRST",
    },
  ],
}));

const commitParticipationWorkbookMock = mock.fn<
  (...args: any[]) => Promise<any>
>(async () => ({
  created: 1,
  updated: 0,
  skipped: 0,
  rows: [
    {
      unitCode: "UNIT-A",
      unitId: "unit-a",
      status: "FIRST",
      participantCount: 80,
      percentage: 80,
      warning: null,
    },
  ],
}));

let nextAuthError: TestApiError | null = null;
let nextPreviewError: TestApiError | null = null;
let nextCommitError: TestApiError | null = null;

mock.module("@/lib/api/auth-guard", {
  namedExports: {
    ApiError: TestApiError,
    requireAdmin: requireAdminMock,
    handleApiError: (error: unknown) => {
      if (error instanceof TestApiError) {
        return Response.json(
          {
            status: error.status,
            error: true,
            message: error.message,
            data: null,
          },
          { status: error.status },
        );
      }

      return Response.json(
        {
          status: 500,
          error: true,
          message: "internal",
          data: null,
        },
        { status: 500 },
      );
    },
  },
});

mock.module("@/lib/participation-workbook/service", {
  namedExports: {
    previewParticipationWorkbook: previewParticipationWorkbookMock,
    commitParticipationWorkbook: commitParticipationWorkbookMock,
  },
});

let POST: typeof import("./route")["POST"];

before(async () => {
  ({ POST } = await import("./route"));
});

beforeEach(() => {
  requireAdminMock.mock.resetCalls();
  previewParticipationWorkbookMock.mock.resetCalls();
  commitParticipationWorkbookMock.mock.resetCalls();

  nextAuthError = null;
  nextPreviewError = null;
  nextCommitError = null;

  requireAdminMock.mock.mockImplementation(async () => {
    if (nextAuthError) {
      throw nextAuthError;
    }

    return {
      user: {
        id: "admin-1",
        name: "Admin Test",
        role: "ADMIN",
      },
    };
  });

  previewParticipationWorkbookMock.mock.mockImplementation(async () => {
    if (nextPreviewError) {
      throw nextPreviewError;
    }

    return {
      stats: {
        total: 1,
        first: 1,
        unchanged: 0,
        correction: 0,
        empty: 0,
        error: 0,
      },
      rows: [
        {
          id: 0,
          sheetKey: "SUMMARY",
          rowNumber: 2,
          unitCode: "UNIT-A",
          unitId: "unit-a",
          unitName: "Unit A",
          participantCount: 80,
          headcount: 100,
          percentage: 80,
          existingParticipantCount: null,
          existingPercentage: null,
          expectedUpdatedAt: null,
          warning: null,
          status: "FIRST",
        },
      ],
    };
  });

  commitParticipationWorkbookMock.mock.mockImplementation(async () => {
    if (nextCommitError) {
      throw nextCommitError;
    }

    return {
      created: 1,
      updated: 0,
      skipped: 0,
      rows: [
        {
          unitCode: "UNIT-A",
          unitId: "unit-a",
          status: "FIRST",
          participantCount: 80,
          percentage: 80,
          warning: null,
        },
      ],
    };
  });
});

const filter = {
  categoryId: "22222222-2222-4222-8222-222222222222",
  tw: 1,
  year: 2026,
};

async function workbookBytes() {
  const workbook = generateParticipationWorkbook({
    summary: [
      {
        unitCode: "UNIT-A",
        unitName: "Unit A",
        parentUnitName: null,
        headcount: 100,
        participantCount: 80,
        percentage: 80,
      },
    ],
    kanwil: [],
    kancab: [],
    divisi: [],
  });

  return serializeParticipationWorkbook(workbook);
}

async function multipartRequest(
  action: "preview" | "commit",
  options: {
    categoryId?: string;
    tw?: string;
    year?: string;
    corrections?: unknown[];
    includeFile?: boolean;
    fileName?: string;
    fileType?: string;
  } = {},
) {
  const form = new FormData();

  if (options.includeFile !== false) {
    form.set(
      "file",
      new File([await workbookBytes()], options.fileName ?? "data.xlsx", {
        type:
          options.fileType ??
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
  }

  form.set("categoryId", options.categoryId ?? filter.categoryId);
  form.set("tw", options.tw ?? String(filter.tw));
  form.set("year", options.year ?? String(filter.year));

  if (options.corrections) {
    form.set("corrections", JSON.stringify(options.corrections));
  }

  return new NextRequest(
    `http://localhost/api/participation?action=${action}`,
    {
      method: "POST",
      body: form,
    },
  );
}

async function responseBody(response: Response) {
  return response.json() as Promise<{
    status: number;
    error: boolean;
    message: string;
    data: any;
  }>;
}

describe("POST /api/participation", () => {
  it("Admin preview accepts the current multipart workbook contract", async () => {
    const response = await POST(await multipartRequest("preview"));
    const json = await responseBody(response);

    assert.equal(response.status, 200);
    assert.equal(json.status, 200);
    assert.equal(json.error, false);
    assert.equal(json.data.rows[0].status, "FIRST");
    assert.equal(json.data.rows[0].unitCode, "UNIT-A");

    const call =
      previewParticipationWorkbookMock.mock.calls[0]?.arguments[0];

    assert.equal(Buffer.isBuffer(call.buffer), true);
    assert.deepEqual(
      {
        categoryId: call.categoryId,
        tw: call.tw,
        year: call.year,
      },
      filter,
    );
  });

  it("Admin FIRST commit succeeds with empty corrections", async () => {
    const response = await POST(await multipartRequest("commit"));
    const json = await responseBody(response);

    assert.equal(response.status, 200);
    assert.equal(json.status, 200);
    assert.equal(json.error, false);
    assert.equal(json.data.created, 1);
    assert.equal(json.data.rows[0].status, "FIRST");

    const call =
      commitParticipationWorkbookMock.mock.calls[0]?.arguments[0];

    assert.deepEqual(call.corrections, []);
    assert.equal(call.actorId, "admin-1");
    assert.equal(call.actorName, "Admin Test");
    assert.equal(Buffer.isBuffer(call.buffer), true);
  });

  it("Admin correction commit forwards current unitCode metadata", async () => {
    const corrections = [
      {
        unitCode: "UNIT-A",
        overwrite: true,
        reason: "Verified correction",
        expectedUpdatedAt: "2026-09-02T00:00:00.000Z",
      },
    ];

    commitParticipationWorkbookMock.mock.mockImplementationOnce(async () => ({
      created: 0,
      updated: 1,
      skipped: 0,
      rows: [
        {
          unitCode: "UNIT-A",
          unitId: "unit-a",
          status: "CORRECTION",
          participantCount: 81,
          percentage: 81,
          warning: null,
          auditId: "audit-1",
        },
      ],
    }));

    const response = await POST(
      await multipartRequest("commit", { corrections }),
    );
    const json = await responseBody(response);

    assert.equal(response.status, 200);
    assert.equal(json.status, 200);
    assert.equal(json.error, false);
    assert.equal(json.data.updated, 1);
    assert.equal(json.data.rows[0].status, "CORRECTION");

    const call =
      commitParticipationWorkbookMock.mock.calls[0]?.arguments[0];

    assert.deepEqual(call.corrections, corrections);
  });

  it("rejects correction metadata that uses unitId instead of unitCode", async () => {
    const response = await POST(
      await multipartRequest("commit", {
        corrections: [
          {
            unitId: "unit-a",
            overwrite: true,
            reason: "Invalid identity field",
            expectedUpdatedAt: "2026-09-02T00:00:00.000Z",
          },
        ],
      }),
    );
    const json = await responseBody(response);

    assert.equal(response.status, 400);
    assert.equal(json.error, true);
    assert.equal(commitParticipationWorkbookMock.mock.callCount(), 0);
  });

  it("rejects malformed corrections JSON before service work", async () => {
    const form = new FormData();

    form.set(
      "file",
      new File([await workbookBytes()], "data.xlsx", {
        type:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    form.set("categoryId", filter.categoryId);
    form.set("tw", String(filter.tw));
    form.set("year", String(filter.year));
    form.set("corrections", "{invalid-json");

    const response = await POST(
      new NextRequest("http://localhost/api/participation?action=commit", {
        method: "POST",
        body: form,
      }),
    );
    const json = await responseBody(response);

    assert.equal(response.status, 400);
    assert.equal(json.error, true);
    assert.equal(commitParticipationWorkbookMock.mock.callCount(), 0);
  });

  for (const [label, status] of [
    ["PIC", 403],
    ["VIEWER", 403],
    ["unauthenticated", 401],
  ] as const) {
    it(`${label} is rejected before workbook/service work`, async () => {
      nextAuthError = new TestApiError(
        status === 401
          ? "Unauthorized"
          : "Hanya Admin yang dapat mengakses",
        status,
      );

      const response = await POST(await multipartRequest("preview"));
      const json = await responseBody(response);

      assert.equal(response.status, status);
      assert.equal(json.status, status);
      assert.equal(json.error, true);
      assert.equal(previewParticipationWorkbookMock.mock.callCount(), 0);
      assert.equal(commitParticipationWorkbookMock.mock.callCount(), 0);
    });
  }

  it("invalid multipart filter returns 400 before service work", async () => {
    const response = await POST(
      await multipartRequest("preview", {
        categoryId: "not-a-uuid",
        tw: "9",
        year: "2026",
      }),
    );
    const json = await responseBody(response);

    assert.equal(response.status, 400);
    assert.equal(json.error, true);
    assert.equal(previewParticipationWorkbookMock.mock.callCount(), 0);
  });

  it("invalid action returns 400 before multipart parsing", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/participation?action=nope", {
        method: "POST",
      }),
    );
    const json = await responseBody(response);

    assert.equal(response.status, 400);
    assert.equal(json.error, true);
    assert.equal(previewParticipationWorkbookMock.mock.callCount(), 0);
    assert.equal(commitParticipationWorkbookMock.mock.callCount(), 0);
  });

  it("missing file returns 400 before service work", async () => {
    const response = await POST(
      await multipartRequest("preview", { includeFile: false }),
    );
    const json = await responseBody(response);

    assert.equal(response.status, 400);
    assert.equal(json.error, true);
    assert.equal(previewParticipationWorkbookMock.mock.callCount(), 0);
  });

  it("non-XLSX file returns 400 before service work", async () => {
    const response = await POST(
      await multipartRequest("preview", {
        fileName: "data.csv",
        fileType: "text/csv",
      }),
    );
    const json = await responseBody(response);

    assert.equal(response.status, 400);
    assert.equal(json.error, true);
    assert.equal(previewParticipationWorkbookMock.mock.callCount(), 0);
  });

  it("rejects an oversized XLSX before reading it or invoking the service", async () => {
    const form = new FormData();
    const file = new File(
      [new Uint8Array(2 * 1024 * 1024 + 1)],
      "oversized.xlsx",
      {
        type:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    );
    Object.defineProperty(file, "arrayBuffer", {
      value: mock.fn(async () => {
        throw new Error("arrayBuffer must not be called");
      }),
    });
    form.set("file", file);
    form.set("categoryId", filter.categoryId);
    form.set("tw", String(filter.tw));
    form.set("year", String(filter.year));

    const response = await POST(
      new NextRequest("http://localhost/api/participation?action=preview", {
        method: "POST",
        body: form,
      }),
    );
    const json = await responseBody(response);

    assert.equal(response.status, 400);
    assert.equal(json.error, true);
    assert.equal(json.message, "File maksimal 2MB");
    assert.equal(previewParticipationWorkbookMock.mock.callCount(), 0);
    assert.equal(commitParticipationWorkbookMock.mock.callCount(), 0);
  });

  it("propagates a current preview service error through the route contract", async () => {
    nextPreviewError = new TestApiError(
      "Kategori tidak tersedia untuk import Excel",
      422,
    );

    const response = await POST(await multipartRequest("preview"));
    const json = await responseBody(response);

    assert.equal(response.status, 422);
    assert.equal(json.status, 422);
    assert.equal(json.error, true);
    assert.equal(
      json.message,
      "Kategori tidak tersedia untuk import Excel",
    );
    assert.equal(previewParticipationWorkbookMock.mock.callCount(), 1);
  });

  it("propagates a current commit service error through the route contract", async () => {
    nextCommitError = new TestApiError(
      "Import partisipasi gagal",
      422,
    );

    const response = await POST(await multipartRequest("commit"));
    const json = await responseBody(response);

    assert.equal(response.status, 422);
    assert.equal(json.status, 422);
    assert.equal(json.error, true);
    assert.equal(json.message, "Import partisipasi gagal");
    assert.equal(commitParticipationWorkbookMock.mock.callCount(), 1);
  });
});
