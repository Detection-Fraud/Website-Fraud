export type ParticipationPercentageResult =
  | { ok: true; value: number }
  | { ok: false; reason: "empty" | "invalid" };

export function parseParticipationPercentage(
  input: unknown,
): ParticipationPercentageResult {
  if (input === null || input === undefined) {
    return { ok: false, reason: "empty" };
  }

  if (typeof input === "string") {
    const value = input.trim();
    if (value === "") return { ok: false, reason: "empty" };
    if (!/^\d+$/.test(value)) return { ok: false, reason: "invalid" };
    const number = Number(value);
    return Number.isFinite(number) && Number.isInteger(number) && number <= 100
      ? { ok: true, value: number }
      : { ok: false, reason: "invalid" };
  }

  if (typeof input !== "number") return { ok: false, reason: "invalid" };
  return Number.isFinite(input) && Number.isInteger(input) && input >= 0 && input <= 100
    ? { ok: true, value: input }
    : { ok: false, reason: "invalid" };
}
