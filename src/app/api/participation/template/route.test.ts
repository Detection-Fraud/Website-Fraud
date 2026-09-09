import assert from "node:assert/strict";
import { before, beforeEach, describe, it, mock } from "node:test";
import { NextRequest } from "next/server";

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
      role: "ADMIN",
    },
  }),
);

const buildParticipationTemplateMock = mock.fn<
  (...args: any[]) => Promise<ArrayBuffer>
>(async () => new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer);

let nextAuthError: TestApiError | null = null;
let nextTemplateError: TestApiError | null = null;

mock.module("@/lib/api/auth-guard", {
  namedExports: {
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
    buildParticipationTemplate: buildParticipationTemplateMock,
  },
});

let GET: typeof import("./route")["GET"];

before(async () => {
  ({ GET } = await import("./route"));
});

beforeEach(() => {
  requireAdminMock.mock.resetCalls();
  buildParticipationTemplateMock.mock.resetCalls();

  nextAuthError = null;
  nextTemplateError = null;

  requireAdminMock.mock.mockImplementation(async () => {
    if (nextAuthError) {
      throw nextAuthError;
    }

    return {
      user: {
        id: "admin-1",
        role: "ADMIN",
      },
    };
  });

  buildParticipationTemplateMock.mock.mockImplementation(async () => {
    if (nextTemplateError) {
      throw nextTemplateError;
    }

    return new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer;
  });
});

function request(
  query = "?categoryId=22222222-2222-4222-8222-222222222222&tw=2&year=2026",
) {
  return new NextRequest(
    `http://localhost/api/participation/template${query}`,
  );
}

describe("GET /api/participation/template", () => {
  it("Admin receives XLSX binary with the validated filter", async () => {
    const response = await GET(request());

    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get("Content-Type"),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    assert.equal(
      response.headers.get("Content-Disposition"),
      'attachment; filename="Template_Partisipasi_TW2_2026.xlsx"',
    );
    assert.deepEqual(
      Array.from(new Uint8Array(await response.arrayBuffer())),
      [0x50, 0x4b, 0x03, 0x04],
    );
    assert.deepEqual(
      buildParticipationTemplateMock.mock.calls[0]?.arguments[0],
      {
        categoryId: "22222222-2222-4222-8222-222222222222",
        tw: 2,
        year: 2026,
      },
    );
  });

  it("rejects an invalid filter with 400 before template generation", async () => {
    const response = await GET(
      request("?categoryId=not-a-uuid&tw=9&year=2026"),
    );

    assert.equal(response.status, 400);
    assert.equal(buildParticipationTemplateMock.mock.callCount(), 0);
  });

  for (const [label, status, message] of [
    ["PIC", 403, "Hanya Admin yang dapat mengakses"],
    ["VIEWER", 403, "Hanya Admin yang dapat mengakses"],
    ["unauthenticated", 401, "Unauthorized"],
  ] as const) {
    it(`${label} is rejected before template generation`, async () => {
      nextAuthError = new TestApiError(message, status);

      const response = await GET(request());

      assert.equal(response.status, status);
      assert.equal(buildParticipationTemplateMock.mock.callCount(), 0);
    });
  }

  it("returns a service error through the current API error contract", async () => {
    nextTemplateError = new TestApiError(
      "Kategori tidak tersedia untuk import Excel",
      422,
    );

    const response = await GET(request());
    const json = await response.json();

    assert.equal(response.status, 422);
    assert.equal(json.status, 422);
    assert.equal(json.error, true);
    assert.equal(
      json.message,
      "Kategori tidak tersedia untuk import Excel",
    );
    assert.equal(buildParticipationTemplateMock.mock.callCount(), 1);
  });
});
