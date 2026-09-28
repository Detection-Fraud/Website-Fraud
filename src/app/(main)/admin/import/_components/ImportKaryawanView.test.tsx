import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const source = readFileSync(
  resolve(process.cwd(), "src/app/(main)/admin/import/_components/ImportKaryawanView.tsx"),
  "utf8",
);

test("employee intake page source keeps shared status and both tab-panel contracts", () => {
  const sharedStatusIndex = source.indexOf("<SharedRunStatus");
  const tabListIndex = source.indexOf('role="tablist" aria-label="Pilih jalur import karyawan"');
  assert.notEqual(sharedStatusIndex, -1, "shared status view is present");
  assert.notEqual(tabListIndex, -1, "accessible tab list is present");
  assert.ok(sharedStatusIndex < tabListIndex, "shared status appears before the intake tabs");

  assert.match(source, /role="tab" id="employee-import-tab-pentaho" aria-controls="employee-import-panel-pentaho"[^>]*>[\s\S]*Sinkronisasi Pentaho/);
  assert.match(source, /role="tab" id="employee-import-tab-excel" aria-controls="employee-import-panel-excel"[^>]*>[\s\S]*Import Excel/);
  assert.match(source, /id="employee-import-panel-pentaho" role="tabpanel" aria-labelledby="employee-import-tab-pentaho"/);
  assert.match(source, /id="employee-import-panel-excel" role="tabpanel" aria-labelledby="employee-import-tab-excel"/);
  assert.match(source, /template resmi dengan 14 kolom data karyawan[\s\S]*Metadata pembuatan dan perubahan diisi otomatis oleh sistem/);
});
