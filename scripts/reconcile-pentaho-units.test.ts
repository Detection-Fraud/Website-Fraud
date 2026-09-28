import assert from "node:assert/strict";
import test from "node:test";
import {
  CANONICAL_LHOKSEUMAWE_ORG,
  CENTRAL_SOURCE_ALIASES,
  PENTAHO_SOURCE_SYSTEM,
  buildMappingPlan,
  externalUnitCodeForUnit,
} from "../src/lib/pentaho-unit-mapping";

test("Lhokseumawe canonical source code is D00C00", () => {
  assert.equal(CANONICAL_LHOKSEUMAWE_ORG, "D00C00");
});

test("regional Unit derives WILAYAH code", () => {
  assert.equal(
    externalUnitCodeForUnit({
      id: "kanwil-01",
      type: "KANTOR_WILAYAH",
      kodeDolog: "01",
      kodeSubdolog: "00",
      kodeOrg: "A01000",
    }),
    "WILAYAH:01:00",
  );

  assert.equal(
    externalUnitCodeForUnit({
      id: "kancab-01-01",
      type: "KANTOR_CABANG",
      kodeDolog: "01",
      kodeSubdolog: "01",
      kodeOrg: "E00C00",
    }),
    "WILAYAH:01:01",
  );
});

test("central Unit derives DIVISI code", () => {
  assert.equal(
    externalUnitCodeForUnit({
      id: "divisi-e00",
      type: "DIVISI",
      kodeDolog: "00",
      kodeSubdolog: "00",
      kodeOrg: "E00000",
    }),
    "DIVISI:E00000",
  );
});

test("all six approved aliases remain separate source mappings", () => {
  const aliases = Object.keys(CENTRAL_SOURCE_ALIASES);

  assert.deepEqual(aliases, [
    "DIVISI:E10000",
    "DIVISI:E20000",
    "DIVISI:E30000",
    "DIVISI:E40000",
    "DIVISI:E50000",
    "DIVISI:EA0000",
  ]);

  assert.ok(
    aliases.every((alias) => CENTRAL_SOURCE_ALIASES[alias] === "DIVISI:E00000"),
  );
});

test("mapping plan preserves aliases and uses PENTAHO source system", () => {
  const units = [
    {
      id: "e00",
      type: "DIVISI" as const,
      kodeDolog: "00",
      kodeSubdolog: "00",
      kodeOrg: "E00000",
    },
    {
      id: "regional",
      type: "KANTOR_WILAYAH" as const,
      kodeDolog: "01",
      kodeSubdolog: "00",
      kodeOrg: "E01000",
    },
  ];

  const mappings = buildMappingPlan(units);
  const aliasRows = mappings.filter((mapping) =>
    Object.prototype.hasOwnProperty.call(
      CENTRAL_SOURCE_ALIASES,
      mapping.externalUnitCode,
    ),
  );

  assert.equal(aliasRows.length, 6);
  assert.ok(
    aliasRows.every(
      (mapping) =>
        mapping.sourceSystem === PENTAHO_SOURCE_SYSTEM &&
        mapping.targetUnitId === "e00",
    ),
  );
});

test("mapping plan rejects duplicate regional identity", () => {
  assert.throws(
    () =>
      buildMappingPlan([
        {
          id: "first",
          type: "KANTOR_CABANG",
          kodeDolog: "01",
          kodeSubdolog: "01",
          kodeOrg: "A",
        },
        {
          id: "second",
          type: "KANTOR_CABANG",
          kodeDolog: "01",
          kodeSubdolog: "01",
          kodeOrg: "B",
        },
        {
          id: "e00",
          type: "DIVISI",
          kodeDolog: "00",
          kodeSubdolog: "00",
          kodeOrg: "E00000",
        },
      ]),
    /Ambiguous externalUnitCode/,
  );
});

test("KODE_GUDANG cannot create a Unit mapping", () => {
  const mapping = externalUnitCodeForUnit({
    id: "warehouse-source",
    type: "KANTOR_CABANG",
    kodeDolog: "01",
    kodeSubdolog: "02",
    kodeOrg: "E01020",
  });

  assert.equal(mapping, "WILAYAH:01:02");
  assert.equal(mapping.includes("GUDANG"), false);
});
