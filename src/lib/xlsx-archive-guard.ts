import { inflateRawSync } from "node:zlib";

const MAX_ZIP_ENTRIES = 256;
export class XlsxArchiveError extends Error {
  constructor() { super("INVALID_WORKBOOK"); this.name = "XlsxArchiveError"; }
}

const CRC32_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(bytes: Buffer): number {
  let value = 0xffffffff;
  for (const byte of bytes) value = CRC32_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

export function validateWorksheetRowBounds(xml: string, maxRows: number): void {
  let rowCount = 0;
  let highestRow = 0;
  for (const match of xml.matchAll(/<(?:[A-Za-z0-9_]+:)?row\b([^>]*)>/gi)) {
    rowCount += 1;
    const rowIndex = /(?:^|\s)r\s*=\s*["'](\d+)["']/i.exec(match[1] ?? "");
    if (rowIndex) highestRow = Math.max(highestRow, Number(rowIndex[1]));
    if (rowCount > maxRows + 1 || highestRow > maxRows + 1) {
      throw new XlsxArchiveError();
    }
  }
}

export function validateXlsxArchive(buffer: Buffer, limits: { maxRows: number; maxFileBytes: number; maxEntryBytes: number; maxTotalBytes: number }): void {
  if (buffer.length < 22 || buffer.length > limits.maxFileBytes) {
    throw new XlsxArchiveError();
  }
  let eocd = -1;
  const min = Math.max(0, buffer.length - 65_557);
  for (let i = buffer.length - 22; i >= min; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new XlsxArchiveError();
  const disk = buffer.readUInt16LE(eocd + 4);
  const centralDisk = buffer.readUInt16LE(eocd + 6);
  const diskEntries = buffer.readUInt16LE(eocd + 8);
  const entryCount = buffer.readUInt16LE(eocd + 10);
  const centralSize = buffer.readUInt32LE(eocd + 12);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  const commentLength = buffer.readUInt16LE(eocd + 20);
  if (disk !== 0 || centralDisk !== 0 || diskEntries !== entryCount || entryCount === 0 || entryCount > MAX_ZIP_ENTRIES ||
    entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff ||
    eocd + 22 + commentLength !== buffer.length || centralOffset + centralSize > eocd) {
    throw new XlsxArchiveError();
  }

  let offset = centralOffset;
  let expandedTotal = 0;
  const names = new Set<string>();
  const required = new Set(["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels"]);
  for (let index = 0; index < entryCount; index++) {
    if (offset + 46 > eocd || buffer.readUInt32LE(offset) !== 0x02014b50) throw new XlsxArchiveError();
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const crc = buffer.readUInt32LE(offset + 16);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const entryCommentLength = buffer.readUInt16LE(offset + 32);
    const startDisk = buffer.readUInt16LE(offset + 34);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const recordEnd = offset + 46 + nameLength + extraLength + entryCommentLength;
    if (recordEnd > eocd || startDisk !== 0 || (flags & 1) !== 0 || (method !== 0 && method !== 8) ||
      compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff ||
      uncompressedSize > limits.maxEntryBytes || compressedSize > limits.maxFileBytes) {
      throw new XlsxArchiveError();
    }
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    if (!name || name.startsWith("/") || name.includes("\\") || name.split("/").includes("..") || names.has(name)) {
      throw new XlsxArchiveError();
    }
    names.add(name);
    required.delete(name);
    expandedTotal += uncompressedSize;
    if (expandedTotal > limits.maxTotalBytes) throw new XlsxArchiveError();
    if (localOffset + 30 > centralOffset || buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new XlsxArchiveError();
    const localFlags = buffer.readUInt16LE(localOffset + 6);
    const localMethod = buffer.readUInt16LE(localOffset + 8);
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const localName = buffer.subarray(localOffset + 30, localOffset + 30 + localNameLength).toString("utf8");
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (localName !== name || localFlags !== flags || localMethod !== method || dataEnd > centralOffset) throw new XlsxArchiveError();
    let inflated: Buffer;
    try {
      const compressed = buffer.subarray(dataStart, dataEnd);
      inflated = method === 0 ? compressed : inflateRawSync(compressed, { maxOutputLength: limits.maxEntryBytes });
    } catch {
      throw new XlsxArchiveError();
    }
    if (inflated.length !== uncompressedSize || crc32(inflated) !== crc) throw new XlsxArchiveError();
    if (name.endsWith(".xml") || name.endsWith(".rels")) {
      const xml = inflated.toString("utf8");
      if (inflated.includes(0) || /<!\s*(DOCTYPE|ENTITY)\b/i.test(xml) || /TargetMode\s*=\s*["']External["']/i.test(xml)) {
        throw new XlsxArchiveError();
      }
      if (/^xl\/worksheets\/.*\.xml$/i.test(name)) {
        validateWorksheetRowBounds(xml, limits.maxRows);
        if (/<(?:[A-Za-z0-9_]+:)?f(?:\s|>)/i.test(xml)) throw new XlsxArchiveError();
      }
    }
    offset = recordEnd;
  }
  if (offset !== centralOffset + centralSize || required.size > 0 || names.has("xl/vbaProject.bin") || [...names].some((name) => name.startsWith("xl/externalLinks/"))) {
    throw new XlsxArchiveError();
  }
}

