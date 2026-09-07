import { Prisma } from "@generated/prisma";

export function decimalFromNumber(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

export function decimalToNumber(value: Prisma.Decimal | null): number | null {
  return value === null ? null : value.toNumber();
}

export function decimalEqualsNumber(
  value: Prisma.Decimal | null,
  expected: number,
): boolean {
  return value !== null && value.eq(new Prisma.Decimal(expected));
}
