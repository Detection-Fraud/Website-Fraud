import assert from "node:assert/strict";
import { test } from "node:test";
import type { ComplianceExportUnit } from "./compliance-export-order";
import { groupComplianceUnits } from "./compliance-export-order";

function unit(overrides: Partial<ComplianceExportUnit>): ComplianceExportUnit {
  return {
    id: "base",
    name: "Base",
    type: "DIVISI",
    wilayah: "Kantor Pusat",
    parentId: null,
    kodeDolog: "00",
    kodeSubdolog: "00",
    kodeOrg: "E00000",
    ...overrides,
  };
}

function unitOrder(units: ComplianceExportUnit[]) {
  return groupComplianceUnits(units).map((group) => ({
    root: group.root?.id ?? null,
    children: group.children.map(({ id }) => id),
  }));
}

test("groups and sorts units by canonical codes independent of input order", () => {
  const units = [
    unit({ id: "d2", name: "Divisi 2", type: "DIVISI", kodeOrg: "E02000" }),
    unit({ id: "b2", name: "Cabang 2", type: "KANTOR_CABANG", parentId: "w2", kodeDolog: "02", kodeSubdolog: "02", kodeOrg: "SAME" }),
    unit({ id: "w10", name: "Kanwil 10", type: "KANTOR_WILAYAH", kodeDolog: "10", kodeSubdolog: "00", kodeOrg: "SAME" }),
    unit({ id: "b1", name: "Cabang 1", type: "KANTOR_CABANG", parentId: "w2", kodeDolog: "02", kodeSubdolog: "01", kodeOrg: "SAME" }),
    unit({ id: "w2", name: "Kanwil 2", type: "KANTOR_WILAYAH", kodeDolog: "02", kodeSubdolog: "00", kodeOrg: "SAME" }),
    unit({ id: "orphan2", name: "Cabang Orphan 2", type: "KANTOR_CABANG", parentId: "missing", kodeDolog: "03", kodeSubdolog: "02" }),
    unit({ id: "orphan1", name: "Cabang Orphan 1", type: "KANTOR_CABANG", parentId: "missing", kodeDolog: "03", kodeSubdolog: "01" }),
    unit({ id: "d1", name: "Divisi 1", type: "DIVISI", kodeOrg: "E01000" }),
  ];

  const expected = [
    { root: "w2", children: ["b1", "b2"] },
    { root: "w10", children: [] },
    { root: null, children: ["orphan1", "orphan2"] },
    { root: "d1", children: [] },
    { root: "d2", children: [] },
  ];

  assert.deepEqual(unitOrder(units), expected);
  assert.deepEqual(unitOrder([...units].reverse()), expected);
});

test("breaks identical unit codes by name and then ID", () => {
  const units = [
    unit({ id: "z", name: "Same", type: "DIVISI", kodeOrg: "E01000" }),
    unit({ id: "b", name: "Alpha", type: "DIVISI", kodeOrg: "E01000" }),
    unit({ id: "a", name: "Alpha", type: "DIVISI", kodeOrg: "E01000" }),
  ];

  assert.deepEqual(unitOrder(units), [
    { root: "a", children: [] },
    { root: "b", children: [] },
    { root: "z", children: [] },
  ]);
});

test("breaks identical Kancab codes and names by ID within their Kanwil", () => {
  const units = [
    unit({ id: "child-z", name: "Same", type: "KANTOR_CABANG", parentId: "kanwil", kodeDolog: "01", kodeSubdolog: "02" }),
    unit({ id: "kanwil", name: "Kanwil", type: "KANTOR_WILAYAH", kodeDolog: "01" }),
    unit({ id: "child-a", name: "Same", type: "KANTOR_CABANG", parentId: "kanwil", kodeDolog: "01", kodeSubdolog: "02" }),
  ];

  assert.deepEqual(unitOrder(units), [
    { root: "kanwil", children: ["child-a", "child-z"] },
  ]);
});
