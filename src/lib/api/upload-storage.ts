import { lstat, realpath, stat } from "node:fs/promises";
import path from "node:path";

const UPLOADS_PREFIX = "/uploads/";
const DEFAULT_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const BANNER_NAMESPACES = new Set(["programs", "categories", "login"]);
const IMPORTANT_INFORMATION_EXTENSIONS = new Set([".jpg", ".png"]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type UploadStorageKeyKind =
  | "legacy-flat"
  | "report"
  | "banner-programs"
  | "banner-categories"
  | "banner-login"
  | "important-information";

export type UploadReferenceClassification =
  | {
      kind: "local";
      storageKey: string;
      source: UploadStorageKeyKind;
    }
  | {
      kind: "external-http";
      url: string;
    }
  | {
      kind: "unsafe";
      reason: string;
    };

export type LocalUploadResolution =
  | {
      kind: "local";
      storageKey: string;
      source: UploadStorageKeyKind;
      filePath: string;
      exists: true;
      isRegularFile: true;
    }
  | {
      kind: "missing";
      storageKey: string;
      source: UploadStorageKeyKind;
    }
  | {
      kind: "unsafe";
      reason: string;
    }
  | {
      kind: "error";
      reason: "upload-root" | "filesystem";
    };

type CanonicalRootResult =
  | { kind: "ok"; root: string }
  | { kind: "missing" }
  | { kind: "error" };

function getConfiguredUploadDirectory(): string {
  return path.resolve(process.env.UPLOAD_DIR || DEFAULT_UPLOAD_DIR);
}

function isUnsafeComponent(component: string): boolean {
  return (
    component.length === 0 ||
    component === "." ||
    component === ".." ||
    component.includes("\\") ||
    component.includes("\0") ||
    component.includes("%") ||
    component.includes(":") ||
    path.posix.isAbsolute(component) ||
    path.win32.isAbsolute(component) ||
    /^[a-zA-Z]:/.test(component)
  );
}

function splitStorageKey(storageKey: string): string[] | null {
  if (
    typeof storageKey !== "string" ||
    storageKey.length === 0 ||
    storageKey.startsWith("/") ||
    storageKey.endsWith("/")
  ) {
    return null;
  }

  const segments = storageKey.split("/");
  return segments.some(isUnsafeComponent) ? null : segments;
}

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function isUuidFile(value: string, extensions: Set<string>): boolean {
  const extension = path.posix.extname(value).toLowerCase();
  if (!extensions.has(extension)) return false;
  return isUuid(value.slice(0, -extension.length));
}

function isValidYear(value: string): boolean {
  return /^\d{4}$/.test(value);
}

function isValidMonth(value: string): boolean {
  return /^(?:0[1-9]|1[0-2])$/.test(value);
}

export function classifyStorageKey(
  storageKey: string,
): UploadStorageKeyKind | null {
  const segments = splitStorageKey(storageKey);
  if (!segments) return null;

  if (segments.length === 1) return "legacy-flat";

  if (
    segments.length === 2 &&
    segments[0] === "important-information" &&
    isUuidFile(segments[1], IMPORTANT_INFORMATION_EXTENSIONS)
  ) {
    return "important-information";
  }

  if (
    segments.length === 3 &&
    segments[0] === "banners" &&
    BANNER_NAMESPACES.has(segments[1]) &&
    isUuidFile(segments[2], new Set([".jpg"]))
  ) {
    return `banner-${segments[1]}` as UploadStorageKeyKind;
  }

  if (
    segments.length === 5 &&
    segments[0] === "reports" &&
    isUuid(segments[1]) &&
    isValidYear(segments[2]) &&
    isValidMonth(segments[3]) &&
    isUuidFile(segments[4], new Set([".jpg"]))
  ) {
    return "report";
  }

  return null;
}

export function classifyUploadReference(
  reference: string,
): UploadReferenceClassification {
  if (typeof reference !== "string" || reference.length === 0) {
    return { kind: "unsafe", reason: "Invalid upload reference" };
  }

  if (/^https?:\/\//i.test(reference)) {
    try {
      const parsed = new URL(reference);
      if (!parsed.hostname) {
        return { kind: "unsafe", reason: "Invalid external URL" };
      }
      return { kind: "external-http", url: reference };
    } catch {
      return { kind: "unsafe", reason: "Invalid external URL" };
    }
  }

  if (!reference.startsWith(UPLOADS_PREFIX)) {
    return { kind: "unsafe", reason: "Unsupported upload reference" };
  }

  const storageKey = reference.slice(UPLOADS_PREFIX.length);
  const source = classifyStorageKey(storageKey);
  if (!source) {
    return { kind: "unsafe", reason: "Invalid storage key" };
  }

  return { kind: "local", storageKey, source };
}

export function storageKeyToPublicUrl(verifiedStorageKey: string): string {
  if (!classifyStorageKey(verifiedStorageKey)) {
    throw new Error("Invalid storage key");
  }

  return `${UPLOADS_PREFIX}${verifiedStorageKey}`;
}

async function getCanonicalUploadRoot(): Promise<CanonicalRootResult> {
  const configuredRoot = getConfiguredUploadDirectory();

  try {
    const canonicalRoot = await realpath(configuredRoot);
    const rootInfo = await stat(canonicalRoot);

    if (!rootInfo.isDirectory()) return { kind: "error" };
    return { kind: "ok", root: canonicalRoot };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return { kind: "missing" };
    }
    return { kind: "error" };
  }
}

function isContained(root: string, target: string): boolean {
  const relative = path.relative(root, target);

  return (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function missingResult(
  storageKey: string,
  source: UploadStorageKeyKind,
): LocalUploadResolution {
  return { kind: "missing", storageKey, source };
}

async function resolveLocalStorageKey(
  storageKey: string,
  source: UploadStorageKeyKind,
  root: string,
): Promise<LocalUploadResolution> {
  const segments = splitStorageKey(storageKey);
  if (!segments) return { kind: "unsafe", reason: "Invalid storage key" };

  let currentPath = root;

  for (const segment of segments) {
    const nextPath = path.join(currentPath, segment);

    if (!isContained(root, nextPath)) {
      return { kind: "unsafe", reason: "Path escapes upload root" };
    }

    try {
      const canonicalPath = await realpath(nextPath);
      if (!isContained(root, canonicalPath)) {
        return { kind: "unsafe", reason: "Path escapes upload root" };
      }
      currentPath = canonicalPath;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      if (code === "ENOENT" || code === "ENOTDIR") {
        try {
          const entry = await lstat(nextPath);
          if (entry.isSymbolicLink()) {
            return { kind: "unsafe", reason: "Unresolvable link" };
          }
        } catch (entryError) {
          const entryCode = (entryError as NodeJS.ErrnoException).code;
          if (entryCode !== "ENOENT" && entryCode !== "ENOTDIR") {
            return { kind: "error", reason: "filesystem" };
          }
        }

        return missingResult(storageKey, source);
      }

      return { kind: "error", reason: "filesystem" };
    }
  }

  try {
    const fileInfo = await stat(currentPath);
    if (!fileInfo.isFile()) return missingResult(storageKey, source);

    return {
      kind: "local",
      storageKey,
      source,
      filePath: currentPath,
      exists: true,
      isRegularFile: true,
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return missingResult(storageKey, source);
    }
    return { kind: "error", reason: "filesystem" };
  }
}

async function resolveLocalReference(
  storageKey: string,
  source: UploadStorageKeyKind,
): Promise<LocalUploadResolution> {
  const root = await getCanonicalUploadRoot();

  if (root.kind === "missing") return missingResult(storageKey, source);
  if (root.kind === "error") {
    return { kind: "error", reason: "upload-root" };
  }

  return resolveLocalStorageKey(storageKey, source, root.root);
}

export async function resolveUploadReference(
  reference: string,
): Promise<LocalUploadResolution | { kind: "external-http"; url: string }> {
  const classification = classifyUploadReference(reference);

  if (classification.kind === "external-http") return classification;
  if (classification.kind === "unsafe") return classification;

  return resolveLocalReference(
    classification.storageKey,
    classification.source,
  );
}

export async function resolvePublicUploadPath(
  slug: readonly string[],
): Promise<LocalUploadResolution> {
  if (!Array.isArray(slug)) {
    return { kind: "unsafe", reason: "Invalid upload path" };
  }

  const storageKey = slug.join("/");
  const source = classifyStorageKey(storageKey);
  if (!source) return { kind: "unsafe", reason: "Invalid storage key" };

  return resolveLocalReference(storageKey, source);
}
