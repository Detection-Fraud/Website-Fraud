import { Prisma } from "@generated/prisma";

export const IMPORTANT_INFORMATION_ORDER_LOCK_KEY =
  "important-information:global-order";

type ImportantInformationTransaction = Prisma.TransactionClient;

export async function lockImportantInformationOrder(
  tx: ImportantInformationTransaction,
): Promise<void> {
  await tx.$queryRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${IMPORTANT_INFORMATION_ORDER_LOCK_KEY}))::text`,
  );
}

export async function getImportantInformationOrderState(
  tx: ImportantInformationTransaction,
) {
  const state = await tx.picImportantInformationOrderState.findUnique({
    where: { id: "global" },
    select: { id: true, revision: true, updatedAt: true },
  });
  if (!state) throw new Error("Order state Informasi Penting tidak ditemukan");
  return state;
}

export function sortImportantInformation<
  T extends {
    order: number;
    createdAt: Date | string;
    id: string;
  },
>(items: T[]): T[] {
  return [...items].sort(
    (left, right) =>
      left.order - right.order ||
      new Date(left.createdAt).getTime() -
        new Date(right.createdAt).getTime() ||
      left.id.localeCompare(right.id),
  );
}
