import { createInflateRaw } from "node:zlib";
import { createHash, randomUUID } from "node:crypto";
import { SAML, ValidateInResponseTo, type Profile } from "@node-saml/node-saml";
import { parseDomFromString } from "@node-saml/node-saml/lib/xml";
import jwt from "jsonwebtoken";
import { getSsoBaseUrl } from "./saml-transport";
import { saml } from "./saml";

export const SAML_PERSISTENT_NAME_ID_FORMAT =
  "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent";

const SAML_LOGOUT_CONTEXT_MAX_AGE_SECONDS = 24 * 60 * 60;
const REJECTED_LOGOUT_REPLAY_CAPACITY = 4096;

const rejectedLogoutContextUses = new Map<string, number>();

export function claimRejectedLogoutContextToken(
  token: string,
  expiresAt: number,
  now = Math.floor(Date.now() / 1000),
): "claimed" | "replay" | "full" {
  for (const [hash, expiry] of rejectedLogoutContextUses) {
    if (expiry <= now) rejectedLogoutContextUses.delete(hash);
  }

  const hash = createHash("sha256").update(token).digest("hex");
  if (rejectedLogoutContextUses.has(hash)) return "replay";
  if (rejectedLogoutContextUses.size >= REJECTED_LOGOUT_REPLAY_CAPACITY)
    return "full";

  rejectedLogoutContextUses.set(hash, expiresAt);
  return "claimed";
}

export type SamlLogoutProfile = {
  issuer: string;
  nameID: string;
  nameIDFormat: string;
  sessionIndex?: string;
};

export type SamlLogoutContext = SamlLogoutProfile & {
  purpose: "saml-logout-context";
  nip: string;
  exp: number;
};

function getExpectations() {
  const issuer = process.env.SAML_IDP_ISSUER?.trim();
  const nameIDFormat =
    process.env.SAML_NAME_ID_FORMAT?.trim() || SAML_PERSISTENT_NAME_ID_FORMAT;

  if (!issuer) {
    throw new Error("SAML_IDP_ISSUER is required");
  }

  return { issuer, nameIDFormat };
}

function required(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing SAML ${field}`);
  }

  return value.trim();
}

export function extractLogoutProfile(profile: Profile): SamlLogoutProfile {
  const expectations = getExpectations();

  const issuer = required(profile.issuer, "issuer");
  const nameID = required(profile.nameID, "NameID");
  const nameIDFormat = required(profile.nameIDFormat, "NameID format");

  if (issuer !== expectations.issuer) {
    throw new Error("SAML issuer mismatch");
  }

  if (nameIDFormat !== expectations.nameIDFormat) {
    throw new Error("SAML NameID format mismatch");
  }

  const sessionIndex =
    typeof profile.sessionIndex === "string" && profile.sessionIndex.trim()
      ? profile.sessionIndex.trim()
      : undefined;

  return {
    issuer,
    nameID,
    nameIDFormat,
    ...(sessionIndex ? { sessionIndex } : {}),
  };
}

export function createLogoutContextToken(input: {
  nip: string;
  profile: SamlLogoutProfile;
}): string {
  const expectations = getExpectations();

  const nip = required(input.nip, "NIP");
  const issuer = required(input.profile.issuer, "issuer");
  const nameID = required(input.profile.nameID, "NameID");
  const nameIDFormat = required(input.profile.nameIDFormat, "NameID format");

  if (
    issuer !== expectations.issuer ||
    nameIDFormat !== expectations.nameIDFormat
  ) {
    throw new Error("Invalid SAML logout profile");
  }

  const exp =
    Math.floor(Date.now() / 1000) + SAML_LOGOUT_CONTEXT_MAX_AGE_SECONDS;

  return jwt.sign(
    {
      purpose: "saml-logout-context",
      jti: randomUUID(),
      nip,
      issuer,
      nameID,
      nameIDFormat,
      ...(input.profile.sessionIndex
        ? { sessionIndex: input.profile.sessionIndex }
        : {}),
      exp,
    },
    process.env.SSO_JWT_SECRET?.trim() || "",
    { algorithm: "HS256" },
  );
}

export function verifyLogoutContextToken(token: string): SamlLogoutContext {
  const secret = process.env.SSO_JWT_SECRET?.trim();

  if (!secret || !token.trim()) {
    throw new Error("Invalid SAML logout context");
  }

  const decoded = jwt.verify(token, secret, {
    algorithms: ["HS256"],
  });

  if (
    typeof decoded !== "object" ||
    decoded === null ||
    decoded.purpose !== "saml-logout-context" ||
    typeof decoded.nip !== "string" ||
    typeof decoded.issuer !== "string" ||
    typeof decoded.nameID !== "string" ||
    typeof decoded.nameIDFormat !== "string" ||
    typeof decoded.exp !== "number"
  ) {
    throw new Error("Invalid SAML logout context");
  }

  const expectations = getExpectations();

  if (
    decoded.issuer.trim() !== expectations.issuer ||
    decoded.nameIDFormat.trim() !== expectations.nameIDFormat ||
    !decoded.nip.trim() ||
    !decoded.nameID.trim() ||
    decoded.exp <= Math.floor(Date.now() / 1000)
  ) {
    throw new Error("Invalid SAML logout context");
  }

  if (
    decoded.sessionIndex !== undefined &&
    (typeof decoded.sessionIndex !== "string" || !decoded.sessionIndex.trim())
  ) {
    throw new Error("Invalid SAML logout context");
  }

  return {
    purpose: "saml-logout-context",
    nip: decoded.nip.trim(),
    issuer: decoded.issuer.trim(),
    nameID: decoded.nameID.trim(),
    nameIDFormat: decoded.nameIDFormat.trim(),
    ...(typeof decoded.sessionIndex === "string" && decoded.sessionIndex.trim()
      ? { sessionIndex: decoded.sessionIndex.trim() }
      : {}),
    exp: decoded.exp,
  };
}

export function renewLogoutContextToken(input: {
  token: string;
  expectedNip: string;
  authJwtExp: number;
  nowEpochSeconds?: number;
}): { token: string; exp: number } | null {
  const secret = process.env.SSO_JWT_SECRET?.trim();

  if (!secret || !input.token.trim()) {
    return null;
  }

  const now =
    input.nowEpochSeconds === undefined
      ? Math.floor(Date.now() / 1000)
      : input.nowEpochSeconds;
  const expectedNip = input.expectedNip.trim();

  if (
    !expectedNip ||
    !Number.isInteger(now) ||
    !Number.isInteger(input.authJwtExp) ||
    input.authJwtExp <= now + 60
  ) {
    return null;
  }

  let decoded: jwt.JwtPayload;

  try {
    const verified = jwt.verify(input.token, secret, {
      algorithms: ["HS256"],
      ignoreExpiration: true,
    });

    if (typeof verified !== "object" || verified === null) {
      return null;
    }

    decoded = verified;
  } catch {
    return null;
  }

  if (
    decoded.purpose !== "saml-logout-context" ||
    typeof decoded.nip !== "string" ||
    typeof decoded.issuer !== "string" ||
    typeof decoded.nameID !== "string" ||
    typeof decoded.nameIDFormat !== "string" ||
    typeof decoded.exp !== "number" ||
    !Number.isInteger(decoded.exp)
  ) {
    return null;
  }

  let expectations: ReturnType<typeof getExpectations>;

  try {
    expectations = getExpectations();
  } catch {
    return null;
  }

  if (
    decoded.issuer.trim() !== expectations.issuer ||
    decoded.nameIDFormat.trim() !== expectations.nameIDFormat ||
    decoded.nip.trim() !== expectedNip ||
    !decoded.nip.trim() ||
    !decoded.nameID.trim()
  ) {
    return null;
  }

  if (
    decoded.sessionIndex !== undefined &&
    (typeof decoded.sessionIndex !== "string" || !decoded.sessionIndex.trim())
  ) {
    return null;
  }

  if (decoded.exp <= now + 60) {
    return null;
  }

  const exp = Math.min(
    input.authJwtExp,
    now + SAML_LOGOUT_CONTEXT_MAX_AGE_SECONDS,
  );

  if (exp <= now + 60) {
    return null;
  }

  return {
    token: jwt.sign(
      {
        purpose: "saml-logout-context",
        nip: decoded.nip.trim(),
        issuer: decoded.issuer.trim(),
        nameID: decoded.nameID.trim(),
        nameIDFormat: decoded.nameIDFormat.trim(),
        ...(typeof decoded.sessionIndex === "string" &&
        decoded.sessionIndex.trim()
          ? { sessionIndex: decoded.sessionIndex.trim() }
          : {}),
        exp,
      },
      secret,
      { algorithm: "HS256" },
    ),
    exp,
  };
}

const REDIRECT_QUERY_MAX_BYTES = 16 * 1024;
const FORM_BODY_MAX_BYTES = 256 * 1024;
const LOGOUT_XML_MAX_BYTES = 64 * 1024;
const RSA_SHA256_REDIRECT_ALGORITHM =
  "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
const SAML_PROTOCOL_NAMESPACE = "urn:oasis:names:tc:SAML:2.0:protocol";
const SAML_ASSERTION_NAMESPACE = "urn:oasis:names:tc:SAML:2.0:assertion";
const XML_SIGNATURE_NAMESPACE = "http://www.w3.org/2000/09/xmldsig#";
const FORM_CONTENT_TYPE = "application/x-www-form-urlencoded";
const ISSUE_INSTANT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/;

export type SamlLogoutMessage = {
  messageType: "SAMLRequest" | "SAMLResponse";
  id: string;
  inResponseTo?: string;
  destination: string;
  issueInstant: string;
  issuer: string;
  relayState?: string;
  nameID?: string;
  nameIDFormat?: string;
  sessionIndex?: string;
  responseSuccess?: boolean;
};

export type SamlLogoutValidator = Pick<
  SAML,
  "validateRedirectAsync" | "validatePostResponseAsync"
>;

// Root LogoutResponse POST validation must skip Node-SAML's generic InResponseTo
// check; the SLS route performs the live lookup and one-time consume after all
// signature, semantic, and RelayState checks. Keep the shared login/Redirect
// singleton's ValidateInResponseTo.always policy unchanged.
const postLogoutResponseValidator = new SAML({
  ...saml.options,
  validateInResponseTo: ValidateInResponseTo.never,
  cacheProvider: saml.cacheProvider,
});

export class UnsupportedSamlLogoutRequestPostError extends Error {
  constructor() {
    super("SAML LogoutRequest POST binding is unsupported");
    this.name = "UnsupportedSamlLogoutRequestPostError";
  }
}

export class InvalidSamlLogoutResponsePostError extends Error {
  constructor() {
    super("Invalid SAML LogoutResponse POST message");
    this.name = "InvalidSamlLogoutResponsePostError";
  }
}

type ParsedRedirect = {
  messageType: "SAMLRequest" | "SAMLResponse";
  fields: Record<string, string>;
  relayState?: string;
};

function invalidSamlMessage(): Error {
  return new Error("Invalid SAML logout message");
}

function decodeStrictComponent(value: string, formEncoded: boolean): string {
  try {
    return decodeURIComponent(formEncoded ? value.replace(/\+/g, " ") : value);
  } catch {
    throw invalidSamlMessage();
  }
}

function parseStrictPairs(
  raw: string,
  allowedKeys: readonly string[],
  formEncoded: boolean,
): Record<string, string> {
  if (!raw) throw invalidSamlMessage();

  const fields: Record<string, string> = Object.create(null);

  for (const segment of raw.split("&")) {
    if (!segment) throw invalidSamlMessage();

    const separator = segment.indexOf("=");
    if (separator <= 0) throw invalidSamlMessage();

    const rawKey = segment.slice(0, separator);
    const rawValue = segment.slice(separator + 1);
    const key = decodeStrictComponent(rawKey, formEncoded);

    if (
      !allowedKeys.includes(key) ||
      rawKey !== key ||
      Object.prototype.hasOwnProperty.call(fields, key)
    ) {
      throw invalidSamlMessage();
    }

    fields[key] = decodeStrictComponent(rawValue, formEncoded);
  }

  return fields;
}

function decodeCanonicalBase64(value: string, maximumBytes: number): Buffer {
  if (
    !value ||
    value.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value,
    )
  ) {
    throw invalidSamlMessage();
  }

  const decoded = Buffer.from(value, "base64");

  if (decoded.length > maximumBytes || decoded.toString("base64") !== value) {
    throw invalidSamlMessage();
  }

  return decoded;
}

function parseRedirectQuery(rawQuery: string): ParsedRedirect {
  const query = rawQuery.startsWith("?") ? rawQuery.slice(1) : rawQuery;

  if (Buffer.byteLength(query, "utf8") > REDIRECT_QUERY_MAX_BYTES) {
    throw invalidSamlMessage();
  }

  const fields = parseStrictPairs(
    query,
    ["SAMLRequest", "SAMLResponse", "RelayState", "SigAlg", "Signature"],
    false,
  );
  const hasRequest = Object.hasOwn(fields, "SAMLRequest");
  const hasResponse = Object.hasOwn(fields, "SAMLResponse");
  const messageType = hasRequest
    ? "SAMLRequest"
    : hasResponse
      ? "SAMLResponse"
      : null;

  if (
    !messageType ||
    (hasRequest && hasResponse) ||
    !fields[messageType] ||
    !fields.SigAlg ||
    !fields.Signature ||
    fields.SigAlg !== RSA_SHA256_REDIRECT_ALGORITHM
  ) {
    throw invalidSamlMessage();
  }

  const expectedOrder = [
    messageType,
    ...(Object.hasOwn(fields, "RelayState") ? ["RelayState"] : []),
    "SigAlg",
    "Signature",
  ];
  const actualOrder = query
    .split("&")
    .map((segment) => segment.slice(0, segment.indexOf("=")));

  if (
    actualOrder.length !== expectedOrder.length ||
    actualOrder.some((key, index) => key !== expectedOrder[index])
  ) {
    throw invalidSamlMessage();
  }

  const rawSegments = query.split("&");
  const messageSegment = rawSegments[0];
  const relaySegment = Object.hasOwn(fields, "RelayState")
    ? rawSegments[1]
    : "";
  if (
    messageSegment.includes("RelayState") ||
    messageSegment.includes("SigAlg") ||
    relaySegment.includes("SigAlg")
  ) {
    throw invalidSamlMessage();
  }

  // Require canonical percent encoding so Node-SAML's non-anchored raw-query
  // token search cannot select an alias or a differently encoded field name.
  for (const key of expectedOrder) {
    const segment = query.split("&")[expectedOrder.indexOf(key)];
    const rawValue = segment.slice(segment.indexOf("=") + 1);
    if (encodeURIComponent(fields[key]) !== rawValue) {
      throw invalidSamlMessage();
    }
  }

  decodeCanonicalBase64(fields[messageType], LOGOUT_XML_MAX_BYTES);
  decodeCanonicalBase64(fields.Signature, 1024);

  return {
    messageType,
    fields,
    ...(Object.hasOwn(fields, "RelayState")
      ? { relayState: fields.RelayState }
      : {}),
  };
}

async function inflateRedirectXmlBounded(compressed: Buffer): Promise<Buffer> {
  const inflater = createInflateRaw({ chunkSize: 1024 });
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  try {
    inflater.end(compressed);

    for await (const chunk of inflater) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.length;

      if (totalBytes > LOGOUT_XML_MAX_BYTES) {
        inflater.destroy();
        throw invalidSamlMessage();
      }

      chunks.push(buffer);
    }
  } catch {
    throw invalidSamlMessage();
  }

  return Buffer.concat(chunks, totalBytes);
}

function directChildren(
  parent: Element,
  localName: string,
  namespace: string,
): Element[] {
  const result: Element[] = [];

  for (
    let child = parent.firstChild;
    child;
    child = child.nextSibling
  ) {
    if (child.nodeType !== 1) continue;

    const element = child as Element;
    if (element.localName === localName && element.namespaceURI === namespace) {
      result.push(element);
    }
  }

  return result;
}

function exactlyOneDirectChild(
  parent: Element,
  localName: string,
  namespace: string,
): Element {
  const matches = directChildren(parent, localName, namespace);
  if (matches.length !== 1) throw invalidSamlMessage();
  return matches[0];
}

function readNonblankText(element: Element): string {
  const value = element.textContent?.trim();
  if (!value) throw invalidSamlMessage();
  return value;
}

function parseSamlIssueInstant(value: string): number | null {
  const match = ISSUE_INSTANT_PATTERN.exec(value);
  if (!match) return null;

  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    zone,
    ,
    zoneHourText,
    zoneMinuteText,
  ] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (
    year === 0 ||
    month < 1 ||
    month > 12 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return null;
  }

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  if (day < 1 || day > daysInMonth[month - 1]) return null;

  if (zone !== "Z") {
    const zoneHour = Number(zoneHourText);
    const zoneMinute = Number(zoneMinuteText);
    if (
      zoneHour > 14 ||
      zoneMinute > 59 ||
      (zoneHour === 14 && zoneMinute !== 0)
    ) {
      return null;
    }
  }

  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

function expectedLogoutValues() {
  const issuer = process.env.SAML_IDP_ISSUER?.trim();
  if (!issuer) throw invalidSamlMessage();

  let destination: string;
  try {
    destination = `${getSsoBaseUrl()}/api/auth/sso/sls`;
  } catch {
    throw invalidSamlMessage();
  }

  return { issuer, destination };
}

async function inspectLogoutXml(
  xmlBytes: Buffer,
  messageType: "SAMLRequest" | "SAMLResponse",
  requireRootSignature = false,
  nowEpochMs = Date.now(),
): Promise<SamlLogoutMessage> {
  if (xmlBytes.length === 0 || xmlBytes.length > LOGOUT_XML_MAX_BYTES) {
    throw invalidSamlMessage();
  }

  const xml = new TextDecoder("utf-8", { fatal: true }).decode(xmlBytes);
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) throw invalidSamlMessage();

  let document: Document;
  try {
    document = await parseDomFromString(xml);
  } catch {
    throw invalidSamlMessage();
  }

  if (document.doctype) throw invalidSamlMessage();

  const root = document.documentElement;
  const rootName =
    messageType === "SAMLRequest" ? "LogoutRequest" : "LogoutResponse";
  if (
    !root ||
    root.localName !== rootName ||
    root.namespaceURI !== SAML_PROTOCOL_NAMESPACE
  ) {
    throw invalidSamlMessage();
  }

  const id = root.getAttribute("ID")?.trim();
  const destination = root.getAttribute("Destination");
  const issueInstant = root.getAttribute("IssueInstant");
  const version = root.getAttribute("Version");
  const inResponseTo = root.getAttribute("InResponseTo")?.trim() || undefined;
  const expectations = expectedLogoutValues();

  if (
    !id ||
    !destination ||
    destination !== expectations.destination ||
    !issueInstant ||
    version !== "2.0"
  ) {
    throw invalidSamlMessage();
  }

  const issueInstantMs = parseSamlIssueInstant(issueInstant);
  if (
    issueInstantMs === null ||
    issueInstantMs < nowEpochMs - 5 * 60 * 1000 ||
    issueInstantMs > nowEpochMs + 30 * 1000
  ) {
    throw invalidSamlMessage();
  }

  const issuer = readNonblankText(
    exactlyOneDirectChild(root, "Issuer", SAML_ASSERTION_NAMESPACE),
  );
  if (issuer !== expectations.issuer) throw invalidSamlMessage();

  if (messageType === "SAMLRequest") {
    const nameIDElement = exactlyOneDirectChild(
      root,
      "NameID",
      SAML_ASSERTION_NAMESPACE,
    );
    const nameID = readNonblankText(nameIDElement);
    const nameIDFormat = nameIDElement.getAttribute("Format")?.trim();
    if (!nameIDFormat || nameIDFormat !== SAML_PERSISTENT_NAME_ID_FORMAT) {
      throw invalidSamlMessage();
    }

    const sessionIndexes = directChildren(
      root,
      "SessionIndex",
      SAML_PROTOCOL_NAMESPACE,
    );
    if (sessionIndexes.length > 1) throw invalidSamlMessage();
    const sessionIndex = sessionIndexes[0]
      ? readNonblankText(sessionIndexes[0])
      : undefined;

    return {
      messageType,
      id,
      destination,
      issueInstant,
      issuer,
      nameID,
      nameIDFormat,
      ...(sessionIndex ? { sessionIndex } : {}),
    };
  }

  if (!inResponseTo) throw invalidSamlMessage();

  const statuses = directChildren(root, "Status", SAML_PROTOCOL_NAMESPACE);
  if (statuses.length !== 1) throw invalidSamlMessage();
  const statusCode = exactlyOneDirectChild(
    statuses[0],
    "StatusCode",
    SAML_PROTOCOL_NAMESPACE,
  );
  const statusValue = statusCode.getAttribute("Value")?.trim();
  if (
    !statusValue?.startsWith("urn:oasis:names:tc:SAML:2.0:status:")
  )
    throw invalidSamlMessage();

  if (requireRootSignature) {
    const signatures = directChildren(
      root,
      "Signature",
      XML_SIGNATURE_NAMESPACE,
    );
    if (signatures.length !== 1) throw invalidSamlMessage();
  }

  return {
    messageType,
    id,
    inResponseTo,
    destination,
    issueInstant,
    issuer,
    responseSuccess:
      statusValue === "urn:oasis:names:tc:SAML:2.0:status:Success",
  };
}

export async function validateRedirectLogoutMessage(
  rawQuery: string,
  validator: SamlLogoutValidator = saml,
): Promise<SamlLogoutMessage> {
  const parsed = parseRedirectQuery(rawQuery);
  const messageBytes = decodeCanonicalBase64(
    parsed.fields[parsed.messageType],
    LOGOUT_XML_MAX_BYTES,
  );
  const xmlBytes = await inflateRedirectXmlBounded(messageBytes);
  const message = await inspectLogoutXml(xmlBytes, parsed.messageType);

  try {
    const originalQuery = rawQuery.startsWith("?")
      ? rawQuery.slice(1)
      : rawQuery;

    if (
      parsed.messageType === "SAMLResponse" &&
      message.responseSuccess === false
    ) {
      // Node-SAML's validateRedirectAsync rejects non-success status before it
      // verifies the query signature. Our strict XML checks above establish
      // issuer, destination, timestamp, status and response shape; use its
      // own raw-query signature verifier for this signed failure response.
      const redirectSignatureValidator = validator as unknown as {
        hasValidSignatureForRedirect(
          container: Record<string, string>,
          originalQuery: string,
        ): Promise<boolean | void>;
      };
      await redirectSignatureValidator.hasValidSignatureForRedirect(
        parsed.fields,
        originalQuery,
      );
    } else {
      const validated = await validator.validateRedirectAsync(
        parsed.fields as Parameters<SAML["validateRedirectAsync"]>[0],
        originalQuery,
      );
      if (
        !validated.loggedOut ||
        (parsed.messageType === "SAMLRequest" && !validated.profile)
      ) {
        throw invalidSamlMessage();
      }

      if (parsed.messageType === "SAMLRequest") {
        const profile = validated.profile;
        if (
          !profile ||
          profile.ID !== message.id ||
          profile.issuer !== message.issuer ||
          profile.nameID !== message.nameID ||
          profile.nameIDFormat !== message.nameIDFormat ||
          (profile.sessionIndex ?? undefined) !== message.sessionIndex
        ) {
          throw invalidSamlMessage();
        }
      }
    }
  } catch {
    throw invalidSamlMessage();
  }

  return {
    ...message,
    ...(parsed.relayState !== undefined
      ? { relayState: parsed.relayState }
      : {}),
  };
}

async function readBoundedRequestBody(request: Request): Promise<Buffer> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^(?:0|[1-9][0-9]*)$/.test(contentLength)) throw invalidSamlMessage();
    const declaredLength = Number(contentLength);
    if (
      !Number.isSafeInteger(declaredLength) ||
      declaredLength > FORM_BODY_MAX_BYTES
    ) {
      throw invalidSamlMessage();
    }
  }

  if (!request.body) throw invalidSamlMessage();

  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > FORM_BODY_MAX_BYTES) {
        await reader.cancel();
        throw invalidSamlMessage();
      }
      chunks.push(Buffer.from(value));
    }
  } catch {
    throw invalidSamlMessage();
  } finally {
    reader.releaseLock();
  }

  if (contentLength !== null && totalBytes !== Number(contentLength)) {
    throw invalidSamlMessage();
  }

  return Buffer.concat(chunks, totalBytes);
}

export async function validatePostLogoutResponse(
  request: Request,
  validator: SamlLogoutValidator = postLogoutResponseValidator,
): Promise<SamlLogoutMessage & { messageType: "SAMLResponse" }> {
  const contentType = request.headers.get("content-type")?.trim().toLowerCase();
  if (contentType !== FORM_CONTENT_TYPE) throw invalidSamlMessage();

  const body = await readBoundedRequestBody(request);
  let form: string;
  try {
    form = new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    throw invalidSamlMessage();
  }

  let fields: Record<string, string>;
  try {
    fields = parseStrictPairs(
      form,
      ["SAMLRequest", "SAMLResponse", "RelayState"],
      true,
    );
  } catch {
    const parts = form.split("&");
    const keys = parts.map((part) =>
      part.slice(0, part.indexOf("=") < 0 ? part.length : part.indexOf("=")),
    );
    const recognizedResponseShape =
      keys.filter((key) => key === "SAMLResponse").length === 1 &&
      keys.every((key) => key === "SAMLResponse" || key === "RelayState") &&
      new Set(keys).size === keys.length;
    if (recognizedResponseShape) throw new InvalidSamlLogoutResponsePostError();
    throw invalidSamlMessage();
  }
  if (Object.hasOwn(fields, "SAMLRequest")) {
    if (Object.hasOwn(fields, "SAMLResponse")) throw invalidSamlMessage();
    throw new UnsupportedSamlLogoutRequestPostError();
  }
  if (!fields.SAMLResponse) throw new InvalidSamlLogoutResponsePostError();

  try {
    const xmlBytes = decodeCanonicalBase64(
      fields.SAMLResponse,
      LOGOUT_XML_MAX_BYTES,
    );
    const message = await inspectLogoutXml(xmlBytes, "SAMLResponse", true);
    const validated = await validator.validatePostResponseAsync({
      SAMLResponse: fields.SAMLResponse,
    });
    if (!validated.loggedOut || validated.profile !== null) {
      throw new Error("Rejected SAML response");
    }

    return {
      ...message,
      messageType: "SAMLResponse",
      ...(Object.hasOwn(fields, "RelayState")
        ? { relayState: fields.RelayState }
        : {}),
    };
  } catch {
    throw new InvalidSamlLogoutResponsePostError();
  }
}
