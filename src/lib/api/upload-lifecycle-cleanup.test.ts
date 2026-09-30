import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  capturePersistedOldCleanup,
  captureProgramBudayaOwner,
  cleanupPersistedOldUploadAfterCommit,
  createServerOwnedUploadContext,
  mintCleanupToken,
  mintUploadDescriptor,
  rollbackVerifiedNewUpload,
  UploadLifecycleError,
  verifyNewUpload,
  type UploadLifecyclePrismaClient,
  acquireUploadLifecycleLocks,
  withUploadLifecycleTransaction,
} from "./upload-lifecycle";
import { resolveUploadReference } from "./upload-storage";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const UNIT_ID = "22222222-2222-4222-8222-222222222222";
const FILE_NAME = "44444444-4444-4444-8444-444444444444.jpg";
const fileKey = `reports/${UNIT_ID}/2026/09/${FILE_NAME}`;

function txWithReferences(references: Record<string, unknown[]> = {}) {
  return {
    $executeRaw: async () => 1,
    activityPhoto: { findMany: async () => references.activityPhoto ?? [] },
    programCategory: { findMany: async () => references.programCategory ?? [] },
    programBudaya: {
      findMany: async () => references.programBudaya ?? [],
      findUnique: async () => ({
        id: USER_ID,
        bannerUrl: `/uploads/${fileKey}`,
      }),
    },
    loginBanner: { findMany: async () => references.loginBanner ?? [] },
    picImportantInformation: {
      findMany: async () => references.picImportantInformation ?? [],
    },
  } as never;
}

function clientFor(tx: unknown): UploadLifecyclePrismaClient {
  return { $transaction: async (callback) => callback(tx as never) };
}

class Barrier {
  promise: Promise<void>;
  private resolve!: () => void;

  constructor() {
    this.promise = new Promise<void>((resolve) => {
      this.resolve = resolve;
    });
  }

  open() {
    this.resolve();
  }
}

class FileMutex {
  private held = false;
  private queue: Array<(release: () => void) => void> = [];

  acquire(): Promise<() => void> {
    if (!this.held) {
      this.held = true;
      return Promise.resolve(() => this.release());
    }

    return new Promise((resolve) => this.queue.push(resolve));
  }

  private release() {
    const next = this.queue.shift();
    if (next) {
      next(() => this.release());
      return;
    }
    this.held = false;
  }
}

function createLockingClient(state: {
  references: {
    programBudaya: unknown[];
    programCategory: unknown[];
  };
  lockAcquired: Barrier;
  mutex: FileMutex;
  lockAttempted?: Barrier;
  referenceCheckStarted?: Barrier;
  continueReferenceCheck?: Barrier;
}) {
  return {
    $transaction: async <T>(callback: (tx: never) => Promise<T>) => {
      let release: (() => void) | undefined;
      const tx = {
        $executeRaw: async () => {
          state.lockAttempted?.open();
          if (!release) release = await state.mutex.acquire();
          state.lockAcquired.open();
          return 1;
        },
        activityPhoto: {
          findMany: async () => {
            state.referenceCheckStarted?.open();
            await state.continueReferenceCheck?.promise;
            return [];
          },
        },
        programCategory: {
          findMany: async () => state.references.programCategory,
        },
        programBudaya: {
          findMany: async () => state.references.programBudaya,
          findUnique: async () => ({
            id: USER_ID,
            bannerUrl: `/uploads/${fileKey}`,
          }),
        },
        loginBanner: { findMany: async () => [] },
        picImportantInformation: { findMany: async () => [] },
      };

      try {
        return await callback(tx as never);
      } finally {
        release?.();
      }
    },
  } as UploadLifecyclePrismaClient;
}

async function withRoot<T>(callback: (root: string) => Promise<T>) {
  const previous = process.env.UPLOAD_DIR;
  const root = await mkdtemp(path.join(tmpdir(), "upload-lifecycle-cleanup-"));
  process.env.UPLOAD_DIR = root;
  try {
    return await callback(root);
  } finally {
    if (previous === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = previous;
    await rm(root, { recursive: true, force: true });
  }
}

function newUpload() {
  process.env.AUTH_SECRET = "packet-d-secret";
  const context = createServerOwnedUploadContext({
    userId: USER_ID,
    purpose: "EVIDENCE",
    mode: "CREATE",
    publicId: fileKey,
    unitId: UNIT_ID,
  });
  const descriptor = mintUploadDescriptor(context).descriptor;
  const cleanup = mintCleanupToken(context);
  return verifyNewUpload(descriptor, cleanup, context);
}

test("rollback deletes an unreferenced exact managed file", async () => {
  await withRoot(async (root) => {
    const filePath = path.join(root, ...fileKey.split("/"));
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, "new");

    const outcome = await rollbackVerifiedNewUpload(
      clientFor(txWithReferences()),
      newUpload(),
    );

    assert.equal(outcome.kind, "deleted");
    await assert.rejects(() => readFile(filePath));
  });
});

test("rollback retains a referenced file and rejects forged phase handles", async () => {
  await withRoot(async () => {
    const tx = txWithReferences({
      activityPhoto: [
        {
          id: 1,
          reportId: "report",
          imageUrl: `/uploads/${fileKey}`,
          publicId: null,
        },
      ],
    });
    const outcome = await rollbackVerifiedNewUpload(clientFor(tx), newUpload());

    assert.equal(outcome.kind, "retained");
    await assert.rejects(
      () =>
        rollbackVerifiedNewUpload(clientFor(tx), {
          __phase: "persisted-old-cleanup",
        } as never),
      UploadLifecycleError,
    );
    await assert.rejects(
      () =>
        cleanupPersistedOldUploadAfterCommit(clientFor(tx), {
          __phase: "verified-new-upload",
        } as never),
      UploadLifecycleError,
    );
  });
});

test("post-commit cleanup retains files referenced by every supported media field", async () => {
  await withRoot(async (root) => {
    const cases: Array<{
      field: string;
      references: Record<string, unknown[]>;
    }> = [
      {
        field: "ActivityPhoto.imageUrl",
        references: {
          activityPhoto: [
            {
              id: 1,
              reportId: "report",
              imageUrl: `/uploads/${fileKey}`,
              publicId: null,
            },
          ],
        },
      },
      {
        field: "ActivityPhoto.publicId",
        references: {
          activityPhoto: [
            {
              id: 2,
              reportId: "report",
              imageUrl: "https://example.test/photo.jpg",
              publicId: fileKey,
            },
          ],
        },
      },
      {
        field: "ProgramCategory.bannerUrl",
        references: {
          programCategory: [
            {
              id: "category",
              bannerUrl: `/uploads/${fileKey}`,
            },
          ],
        },
      },
      {
        field: "ProgramBudaya.bannerUrl",
        references: {
          programBudaya: [
            {
              id: "program",
              bannerUrl: `/uploads/${fileKey}`,
            },
          ],
        },
      },
      {
        field: "LoginBanner.imageUrl",
        references: {
          loginBanner: [
            {
              id: "banner",
              imageUrl: `/uploads/${fileKey}`,
            },
          ],
        },
      },
      {
        field: "PicImportantInformation.imageUrl",
        references: {
          picImportantInformation: [
            {
              id: "information",
              imageUrl: `/uploads/${fileKey}`,
            },
          ],
        },
      },
    ];

    const filePath = path.join(root, ...fileKey.split("/"));

    for (const { field, references } of cases) {
      const database = txWithReferences(references);
      const lifecycle = await acquireUploadLifecycleLocks(database, {
        entities: [{ model: "ProgramBudaya", id: USER_ID }],
        fileKeys: [fileKey],
      });
      const owner = await captureProgramBudayaOwner(lifecycle, {
        id: USER_ID,
      });
      const cleanup = capturePersistedOldCleanup(lifecycle, owner);

      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, field);

      const outcome = await cleanupPersistedOldUploadAfterCommit(
        clientFor(database),
        cleanup,
      );

      assert.deepEqual(outcome, { kind: "retained", fileKey }, field);
      assert.equal(await readFile(filePath, "utf8"), field, field);
    }
  });
});

test(
  "temporary rollback and persistence races preserve the file-lock winner",
  { timeout: 10_000 },
  async () => {
    await withRoot(async (root) => {
      for (const winner of ["rollback", "persistence"] as const) {
        const filePath = path.join(root, ...fileKey.split("/"));
        await mkdir(path.dirname(filePath), { recursive: true });
        await writeFile(filePath, winner);

        const mutex = new FileMutex();
        const state = {
          references: {
            programBudaya: [] as unknown[],
            programCategory: [] as unknown[],
          },
        };

        if (winner === "rollback") {
          const referenceCheckStarted = new Barrier();
          const continueReferenceCheck = new Barrier();
          const writerAttempted = new Barrier();

          const rollbackPromise = rollbackVerifiedNewUpload(
            createLockingClient({
              ...state,
              mutex,
              lockAcquired: new Barrier(),
              referenceCheckStarted,
              continueReferenceCheck,
            }),
            newUpload(),
          );

          await referenceCheckStarted.promise;

          const writerPromise = withUploadLifecycleTransaction(
            createLockingClient({
              ...state,
              mutex,
              lockAcquired: new Barrier(),
              lockAttempted: writerAttempted,
            }),
            {
              entities: [{ model: "ProgramCategory", id: "category" }],
              fileKeys: [fileKey],
            },
            async () => {
              const resolved = await resolveUploadReference(
                `/uploads/${fileKey}`,
              );
              if (resolved.kind !== "local") {
                throw new Error("WRITER_FILE_MISSING");
              }

              state.references.programCategory.push({
                id: "category",
                bannerUrl: `/uploads/${fileKey}`,
              });
            },
          );

          await writerAttempted.promise;
          continueReferenceCheck.open();

          assert.equal((await rollbackPromise).kind, "deleted");
          await assert.rejects(writerPromise, /WRITER_FILE_MISSING/);
          assert.equal(state.references.programCategory.length, 0);
          await assert.rejects(() => readFile(filePath));
        } else {
          const persistenceCommitted = new Barrier();
          const rollbackAttempted = new Barrier();

          const writerPromise = withUploadLifecycleTransaction(
            createLockingClient({
              ...state,
              mutex,
              lockAcquired: new Barrier(),
            }),
            {
              entities: [{ model: "ProgramCategory", id: "category" }],
              fileKeys: [fileKey],
            },
            async () => {
              const resolved = await resolveUploadReference(
                `/uploads/${fileKey}`,
              );
              assert.equal(resolved.kind, "local");

              state.references.programCategory.push({
                id: "category",
                bannerUrl: `/uploads/${fileKey}`,
              });
              persistenceCommitted.open();
              await rollbackAttempted.promise;
            },
          );

          await persistenceCommitted.promise;

          const rollbackPromise = rollbackVerifiedNewUpload(
            createLockingClient({
              ...state,
              mutex,
              lockAcquired: new Barrier(),
              lockAttempted: rollbackAttempted,
            }),
            newUpload(),
          );

          await rollbackAttempted.promise;
          await writerPromise;

          assert.equal((await rollbackPromise).kind, "retained");
          assert.equal(await readFile(filePath, "utf8"), winner);
          assert.equal(state.references.programCategory.length, 1);
        }
      }
    });
  },
);

test("post-commit cleanup is inspectable when deletion fails", async () => {
  await withRoot(async (root) => {
    const tx = txWithReferences();
    const lifecycle = await acquireUploadLifecycleLocks(tx, {
      entities: [{ model: "ProgramBudaya", id: USER_ID }],
      fileKeys: [fileKey],
    });
    const owner = await captureProgramBudayaOwner(lifecycle, { id: USER_ID });
    const cleanup = capturePersistedOldCleanup(lifecycle, owner);
    const directoryPath = path.join(root, ...fileKey.split("/"));
    await mkdir(directoryPath, { recursive: true });

    const outcome = await cleanupPersistedOldUploadAfterCommit(
      clientFor(tx),
      cleanup,
    );

    assert.equal(outcome.kind, "failed");
  });
});

test("cleanup-wins deletes first and writer rejects missing file before commit", async () => {
  await withRoot(async (root) => {
    process.env.AUTH_SECRET = "packet-d-race-secret";
    const filePath = path.join(root, ...fileKey.split("/"));
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, "race");

    const setup = txWithReferences();
    const setupLifecycle = await acquireUploadLifecycleLocks(setup, {
      entities: [{ model: "ProgramBudaya", id: USER_ID }],
      fileKeys: [fileKey],
    });
    const cleanup = capturePersistedOldCleanup(
      setupLifecycle,
      await captureProgramBudayaOwner(setupLifecycle, { id: USER_ID }),
    );

    const mutex = new FileMutex();
    const state = {
      references: {
        programBudaya: [] as unknown[],
        programCategory: [] as unknown[],
      },
    };
    const cleanupAcquired = new Barrier();
    const writerAcquired = new Barrier();
    const cleanupClient = createLockingClient({
      ...state,
      mutex,
      lockAcquired: cleanupAcquired,
    });
    const writerClient = createLockingClient({
      ...state,
      mutex,
      lockAcquired: writerAcquired,
    });

    const cleanupPromise = cleanupPersistedOldUploadAfterCommit(
      cleanupClient,
      cleanup,
    );
    await cleanupAcquired.promise;

    const writerPromise = withUploadLifecycleTransaction(
      writerClient,
      { entities: [], fileKeys: [fileKey] },
      async () => {
        const resolved = await resolveUploadReference(`/uploads/${fileKey}`);
        if (resolved.kind !== "local") {
          throw new Error("WRITER_FILE_MISSING");
        }
        state.references.programBudaya.push({
          id: USER_ID,
          bannerUrl: `/uploads/${fileKey}`,
        });
      },
    );

    assert.equal((await cleanupPromise).kind, "deleted");
    await assert.rejects(writerPromise, /WRITER_FILE_MISSING/);
    assert.equal(state.references.programBudaya.length, 0);
    await assert.rejects(() => readFile(filePath));
  });
});

test("cross-entity writer wins and cleanup retains the ProgramCategory reference", async () => {
  await withRoot(async (root) => {
    process.env.AUTH_SECRET = "packet-d-race-secret";
    const filePath = path.join(root, ...fileKey.split("/"));
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, "race");

    const setup = txWithReferences();
    const setupLifecycle = await acquireUploadLifecycleLocks(setup, {
      entities: [{ model: "ProgramBudaya", id: USER_ID }],
      fileKeys: [fileKey],
    });
    const cleanup = capturePersistedOldCleanup(
      setupLifecycle,
      await captureProgramBudayaOwner(setupLifecycle, { id: USER_ID }),
    );

    const mutex = new FileMutex();
    const writerCommitted = new Barrier();
    const cleanupAttempted = new Barrier();
    const state = {
      references: {
        programBudaya: [] as unknown[],
        programCategory: [] as unknown[],
      },
    };
    const writerClient = createLockingClient({
      ...state,
      mutex,
      lockAcquired: new Barrier(),
    });
    const cleanupClient = createLockingClient({
      ...state,
      mutex,
      lockAcquired: new Barrier(),
      lockAttempted: cleanupAttempted,
    });

    const writerPromise = withUploadLifecycleTransaction(
      writerClient,
      {
        entities: [{ model: "ProgramCategory", id: "category" }],
        fileKeys: [fileKey],
      },
      async () => {
        const resolved = await resolveUploadReference(`/uploads/${fileKey}`);
        assert.equal(resolved.kind, "local");
        state.references.programCategory.push({
          id: "category",
          bannerUrl: `/uploads/${fileKey}`,
        });
        writerCommitted.open();
        await cleanupAttempted.promise;
      },
    );

    await writerCommitted.promise;
    const cleanupPromise = cleanupPersistedOldUploadAfterCommit(
      cleanupClient,
      cleanup,
    );
    await cleanupAttempted.promise;

    await writerPromise;
    assert.equal((await cleanupPromise).kind, "retained");
    assert.equal(await readFile(filePath, "utf8"), "race");
    assert.equal(state.references.programCategory.length, 1);
  });
});
