import assert from "node:assert/strict";
import { test } from "node:test";
import {
  averageCompliancePercent,
  calculateProgramCompliancePercent,
  classifyCompliancePercent,
} from "./compliance-metrics";

test("caps each program at 120 percent before averaging at full precision", () => {
  const percentages = [
    calculateProgramCompliancePercent(1, 1),
    calculateProgramCompliancePercent(0, 3),
    calculateProgramCompliancePercent(3, 1),
  ];

  assert.deepEqual(percentages, [100, 0, 120]);
  assert.equal(averageCompliancePercent(percentages), 220 / 3);
});

test("returns zero for a missing denominator and empty average", () => {
  assert.equal(calculateProgramCompliancePercent(5, 0), 0);
  assert.equal(averageCompliancePercent([]), 0);
});

test("classifies exact compliance thresholds using full precision", () => {
  assert.equal(classifyCompliancePercent(50), "ON_TRACK");
  assert.equal(classifyCompliancePercent(49.999), "WATCH");
  assert.equal(classifyCompliancePercent(25), "WATCH");
  assert.equal(classifyCompliancePercent(24.999), "AT_RISK");
});
