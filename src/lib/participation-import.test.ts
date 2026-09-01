import assert from "node:assert/strict";
import test from "node:test";
import { parseParticipationPercentage } from "./participation-import";

test("menerima integer lengkap 0 sampai 100", () => {
  for (const input of [0, 80, 100, "0", "80", "100"]) {
    assert.deepEqual(parseParticipationPercentage(input), {
      ok: true,
      value: Number(input),
    });
  }
});

test("menolak angka ambigu dan di luar rentang tanpa truncation", () => {
  for (const input of [
    -1,
    101,
    80.5,
    "80.5",
    "80abc",
    "80%",
    "1e2",
    "",
    "   ",
    null,
    undefined,
    Infinity,
    NaN,
    {},
  ]) {
    assert.equal(parseParticipationPercentage(input).ok, false);
  }
});
