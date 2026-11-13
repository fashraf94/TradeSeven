// api/_utils/kb/loader.js
//
// KB-0 — THE KB METHOD LOADER (Shared Research spec V1.2, Amendment A §A3).
// A knowledge-base method reaches the app as a committed package
// (packages/index.js) and is checked against its recorded hashes on EVERY
// read. Nothing here reads a file, the network, a database or the
// environment: the package bytes are static imports, so the function bundle
// carries them, and the founder's on-disk knowledge base and the Hermes queue
// are never consulted.
//
// THE TEN CHECKS run in this order; the first failure is the answer:
//
//    1 missing               a package with this id and version (both non-empty
//                            strings), with its export, acceptance wrapper and
//                            register wrapper
//    2 schema                the export's schema is fantasytrades.kb-method-package/1,
//                            with the title the answer reports
//    3 identity              the export's id and version equal the request
//    4 not_accepted          status 'accepted', acceptance.decision 'accept' with
//                            its date, no test_only
//    5 corrupt               SHA-256 of method_text equals content_hash.value and
//                            acceptance.content_sha256 (algorithm sha256)
//    6 acceptance_mismatch   SHA-256 of the acceptance text equals the export's
//                            acceptance.evidence_sha256; the parsed record's id,
//                            version, decision 'accept', content_sha256 and date
//                            agree with the export
//    7 register_mismatch     SHA-256 of the register text equals the verified
//                            record's source_register.sha256
//    8 not_authorized        an authorization entry for this id and version whose
//                            sha256 and acceptanceSha256 equal the verified hashes
//    9 scope                 the entry's consumers include the caller's consumer
//   10 audience              the entry's audience is known and inAudience says true
//
// Every hash is recomputed here; no file's claim about its own hash is
// trusted. Every field is read ONCE: what is checked or hashed is what is
// answered. The release's own `production_app_use_authorized: false` is
// content status, neither permission nor refusal: app use is the
// authorization entry (authorizations.js), and that list ships empty.
//
// NEVER THROWS. An unexpected exception inside checks 1–7 answers `corrupt`;
// inside checks 8–10 it answers the refusal of the check that raised it (a
// throwing audience function is `audience`). The caller falls back to the
// baseline method and records the reason.
//
// PROVENANCE STAYS HERE (founder ruling R-KB-3). The two authorized entry
// points answer exactly eight fields; verifyPackage and verifyParts answer
// seven. The export's source, review, acceptance and exporter blocks, the
// acceptance record and the register never leave this module: they hold local
// file paths. Nothing under src/ imports api/_utils/kb/ (boundary.test.js).
//
// IMPORTS, pinned by boundary.test.js: node:crypto, ./packages/index.js and
// ./authorizations.js. Nothing else.

import { createHash } from 'node:crypto';
import { KB_PACKAGES } from './packages/index.js';
import { KB_APP_USE } from './authorizations.js';

/** The one package schema this loader reads. */
export const KB_PACKAGE_SCHEMA = 'fantasytrades.kb-method-package/1';

/** The audiences an authorization entry may name (audience.js answers for each). */
export const KB_AUDIENCES = Object.freeze(['allowlist', 'all']);

/** The ten refusals, in check order. */
export const KB_REFUSALS = Object.freeze([
  'missing',
  'schema',
  'identity',
  'not_accepted',
  'corrupt',
  'acceptance_mismatch',
  'register_mismatch',
  'not_authorized',
  'scope',
  'audience',
]);

const HEX64 = /^[0-9a-f]{64}$/;
const ISO_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,9})?(Z|[+-](\d{2}):(\d{2}))$/;
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const ENTRY_KEYS = new Set([
  'id', 'version', 'sha256', 'acceptanceSha256', 'consumers', 'audience',
  'newSessions', 'authorizedAt', 'authorizedBy', 'evidenceRef',
]);

const refuse = (reason) => Object.freeze({ ok: false, reason });
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;

/**
 * SHA-256 of a well-formed string's UTF-8 bytes, else null. (UTF-8 encodes a
 * lone surrogate as U+FFFD, so two different strings would share one hash.)
 */
function sha256Hex(text) {
  if (typeof text !== 'string' || LONE_SURROGATE.test(text)) return null;
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Both are the same hash (null, or anything that is not a string, never matches). */
const sameHash = (a, b) => typeof a === 'string' && a === b;

/**
 * An ISO instant naming a real calendar time (Date.parse alone takes
 * February 30 and 24:00). Never throws.
 */
function isIsoInstant(s) {
  const m = typeof s === 'string' ? ISO_INSTANT.exec(s) : null;
  if (!m) return false;
  const [y, mo, d, h, mi, se] = m.slice(1, 7).map(Number);
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth || h > 23 || mi > 59 || se > 59) return false;
  if (m[9] !== undefined && (Number(m[9]) > 23 || Number(m[10]) > 59)) return false;
  return Number.isFinite(Date.parse(s));
}

function parseObject(text) {
  try {
    const value = JSON.parse(text);
    return isObject(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * The dependencies, defaulted, each read only by the check that needs it (so
 * a throwing `authorizations` is check 8's refusal, never check 1's). A
 * non-object `deps` reads as none given.
 */
function packagesOf(deps) {
  const given = isObject(deps) ? deps.packages : undefined;
  return given === undefined ? KB_PACKAGES : given;
}
function authorizationsOf(deps) {
  const given = isObject(deps) ? deps.authorizations : undefined;
  const list = given === undefined ? KB_APP_USE : given;
  return Array.isArray(list) ? list : [];
}

/**
 * Checks 2–7 on parts already present. Throws only on hostile input; the
 * callers turn that into `corrupt`.
 */
function checkParts(id, version, exp, acceptanceText, registerText) {
  // Each export field is read once, here.
  const schema = exp.schema;
  const expId = exp.id;
  const expVersion = exp.version;
  const status = exp.status;
  const testOnly = exp.test_only;
  const title = exp.title;
  const text = exp.method_text;
  const ch = isObject(exp.content_hash) ? exp.content_hash : {};
  const algorithm = ch.algorithm;
  const contentValue = ch.value;
  const acc = isObject(exp.acceptance) ? exp.acceptance : {};
  const decision = acc.decision;
  const acceptedAt = acc.date;
  const accContentSha256 = acc.content_sha256;
  const evidenceSha256 = acc.evidence_sha256;

  // Check 2 — the schema, with the title the answer reports.
  if (schema !== KB_PACKAGE_SCHEMA || !isNonEmptyString(title)) return refuse('schema');

  // Check 3 — the export is the method that was asked for.
  if (expId !== id || expVersion !== version) return refuse('identity');

  // Check 4 — accepted content, with its acceptance date, not a test fixture.
  if (status !== 'accepted' || decision !== 'accept' || !isNonEmptyString(acceptedAt) || (testOnly !== undefined && testOnly !== false)) return refuse('not_accepted');

  // Check 5 — the method text is the text the export and its acceptance name.
  const methodSha256 = sha256Hex(text);
  if (algorithm !== 'sha256' || !sameHash(methodSha256, contentValue) || !sameHash(methodSha256, accContentSha256)) return refuse('corrupt');

  // Check 6 — the acceptance record is the one the export binds, and agrees with it.
  const acceptanceSha256 = sha256Hex(acceptanceText);
  const record = parseObject(acceptanceText);
  if (!sameHash(acceptanceSha256, evidenceSha256) || record === null || record.id !== expId || record.version !== expVersion || record.decision !== 'accept' || record.content_sha256 !== methodSha256 || record.date !== acceptedAt) return refuse('acceptance_mismatch');

  // Check 7 — the source register is the one the verified record binds.
  if (!sameHash(sha256Hex(registerText), record?.source_register?.sha256)) return refuse('register_mismatch');

  return Object.freeze({
    ok: true,
    method: Object.freeze({
      id: expId,
      version: expVersion,
      sha256: methodSha256,
      acceptanceSha256,
      title,
      text,
      acceptedAt,
    }),
  });
}

/**
 * Checks 2–7 on given parts (the import script uses it). A part that is not
 * there answers `missing`, as check 1 does for a package.
 *
 * @param {{ id: string, version: string, exportJson: object, acceptanceText: string, registerText: string }} parts
 * @returns {{ ok: true, method: { id, version, sha256, acceptanceSha256, title, text, acceptedAt } } | { ok: false, reason: string }}
 */
export function verifyParts(parts) {
  try {
    const { id, version, exportJson, acceptanceText, registerText } = isObject(parts) ? parts : {};
    if (!isNonEmptyString(id) || !isNonEmptyString(version) || !isObject(exportJson) || typeof acceptanceText !== 'string' || typeof registerText !== 'string') return refuse('missing');
    return checkParts(id, version, exportJson, acceptanceText, registerText);
  } catch {
    return refuse('corrupt');
  }
}

/**
 * Checks 1–7: the committed package for this id and version is the accepted one.
 *
 * @param {{ id: string, version: string }} request
 * @param {{ packages?: object[], authorizations?: object[] }} [deps]  for tests
 * @returns {{ ok: true, method: { id, version, sha256, acceptanceSha256, title, text, acceptedAt } } | { ok: false, reason: string }}
 */
export function verifyPackage(request, deps) {
  try {
    const { id, version } = isObject(request) ? request : {};
    const packages = packagesOf(deps);

    // Check 1 — the package is committed, with all three of its parts.
    const row = isNonEmptyString(id) && isNonEmptyString(version) && Array.isArray(packages) ? packages.find((p) => isObject(p) && p.id === id && p.version === version) : undefined;
    const exportJson = row?.exportJson;
    const acceptanceText = row?.acceptance?.text;
    const registerText = row?.register?.text;
    if (!row || !isObject(exportJson) || typeof acceptanceText !== 'string' || typeof registerText !== 'string') return refuse('missing');

    return checkParts(id, version, exportJson, acceptanceText, registerText);
  } catch {
    return refuse('corrupt');
  }
}

/**
 * A one-time copy of an authorization entry's OWN DATA fields, or null when
 * it is not a plain object made only of known keys held as plain data (no
 * getter, no inherited field, no symbol key, no hole in `consumers`). Checks
 * 8–10 judge and use the copy, so nothing can change between two reads.
 * Never throws.
 */
function entrySnapshot(entry) {
  try {
    if (!isObject(entry)) return null;
    const proto = Object.getPrototypeOf(entry);
    if (proto !== Object.prototype && proto !== null) return null;
    const copy = Object.create(null); // the copy inherits nothing either
    for (const key of Reflect.ownKeys(entry)) {
      if (typeof key !== 'string' || !ENTRY_KEYS.has(key)) return null;
      const d = Object.getOwnPropertyDescriptor(entry, key);
      if (!d || !('value' in d)) return null;
      copy[key] = d.value;
    }
    if (Array.isArray(copy.consumers)) {
      const consumers = [];
      const length = copy.consumers.length;
      for (let i = 0; i < length; i += 1) {
        const d = Object.getOwnPropertyDescriptor(copy.consumers, i);
        if (!d || !('value' in d)) return null;
        consumers.push(d.value);
      }
      copy.consumers = Object.freeze(consumers);
    }
    return Object.freeze(copy);
  } catch {
    return null;
  }
}

/**
 * The entry's shape (on a snapshot) apart from its audience, which check 10
 * judges: an entry whose one fault is an unknown audience is not ignored, it
 * answers `audience`. Never throws.
 */
function isEntryShape(snap) {
  try {
    return snap !== null
      && isNonEmptyString(snap.id)
      && isNonEmptyString(snap.version)
      && typeof snap.sha256 === 'string' && HEX64.test(snap.sha256)
      && typeof snap.acceptanceSha256 === 'string' && HEX64.test(snap.acceptanceSha256)
      && Array.isArray(snap.consumers) && snap.consumers.length > 0 && snap.consumers.every(isNonEmptyString)
      && (snap.newSessions === undefined || typeof snap.newSessions === 'boolean')
      && isIsoInstant(snap.authorizedAt)
      && isNonEmptyString(snap.authorizedBy)
      && isNonEmptyString(snap.evidenceRef);
  } catch {
    return false;
  }
}

/**
 * Is this a well-formed authorization entry (authorizations.js gives the
 * shape)? Never throws.
 *
 * @param {unknown} entry
 * @returns {boolean}
 */
export function isAuthorizationEntry(entry) {
  try {
    const snap = entrySnapshot(entry);
    return isEntryShape(snap) && KB_AUDIENCES.includes(snap.audience);
  } catch {
    return false;
  }
}

/** The well-formed (audience apart) snapshots of a list's entries. */
const shapedSnapshots = (list) => list.map(entrySnapshot).filter(isEntryShape);

/**
 * Checks 8–10 on a package that passed checks 1–7. `candidates` are entry
 * snapshots: every shaped entry of the list (loadAuthorizedMethod), or the one
 * entry authorizedMethodFor offered. `readConsumer` and `readInAudience` read
 * the request inside the check that needs each.
 */
function authorize(v, candidatesOf, readConsumer, readInAudience) {
  // Check 8 — an entry authorizes exactly these verified bytes.
  let matches;
  try {
    matches = candidatesOf().filter((e) => e.id === v.id && e.version === v.version && e.sha256 === v.sha256 && e.acceptanceSha256 === v.acceptanceSha256);
    if (matches.length === 0) return refuse('not_authorized');
  } catch {
    return refuse('not_authorized');
  }

  // Check 9 — for this consumer (one entry: two would make the audience ambiguous).
  let entry;
  let consumer;
  try {
    consumer = readConsumer();
    const forConsumer = isNonEmptyString(consumer) ? matches.filter((e) => e.consumers.includes(consumer)) : [];
    if (forConsumer.length !== 1) return refuse(forConsumer.length === 0 ? 'scope' : 'not_authorized');
    entry = forConsumer[0];
  } catch {
    return refuse('scope');
  }

  // Check 10 — a known audience, and this player is in it (only a synchronous `true` admits).
  const audience = entry.audience;
  try {
    const inAudience = readInAudience();
    const answer = typeof inAudience === 'function' && KB_AUDIENCES.includes(audience) ? inAudience(audience) : false;
    if (answer !== null && (typeof answer === 'object' || typeof answer === 'function') && typeof answer.then === 'function') answer.then(undefined, () => {});
    if (!KB_AUDIENCES.includes(audience) || answer !== true) return refuse('audience');
  } catch {
    return refuse('audience');
  }

  return Object.freeze({
    ok: true,
    method: Object.freeze({
      id: v.id,
      version: v.version,
      sha256: v.sha256,
      title: v.title,
      text: v.text,
      acceptedAt: v.acceptedAt,
      consumer,
      audience,
    }),
  });
}

/**
 * Checks 1–10, for a method a session already holds. An entry with
 * `newSessions: false` still serves here: a session that holds that version
 * keeps it.
 *
 * @param {{ id: string, version: string, consumer: string, inAudience: (audience: string) => boolean }} request
 * @param {{ packages?: object[], authorizations?: object[] }} [deps]  for tests
 * @returns {{ ok: true, method: { id, version, sha256, title, text, acceptedAt, consumer, audience } } | { ok: false, reason: string }}
 */
export function loadAuthorizedMethod(request, deps) {
  const verified = verifyPackage(request, deps);
  if (!verified.ok) return verified;
  return authorize(
    verified.method,
    () => shapedSnapshots(authorizationsOf(deps)),
    () => request.consumer,
    () => request.inAudience,
  );
}

/**
 * The one entry for this consumer that takes new sessions, then checks 1–10
 * ON THAT ENTRY (never on another entry for the same version). None, or more
 * than one, answers `not_authorized`.
 *
 * @param {{ consumer: string, inAudience: (audience: string) => boolean }} request
 * @param {{ packages?: object[], authorizations?: object[] }} [deps]  for tests
 * @returns {{ ok: true, method: { id, version, sha256, title, text, acceptedAt, consumer, audience } } | { ok: false, reason: string }}
 */
export function authorizedMethodFor(request, deps) {
  let offered;
  let consumer;
  try {
    consumer = isObject(request) ? request.consumer : undefined;
    if (!isNonEmptyString(consumer)) return refuse('not_authorized');
    const forNewSessions = shapedSnapshots(authorizationsOf(deps)).filter((e) => e.consumers.includes(consumer) && e.newSessions !== false);
    if (forNewSessions.length !== 1) return refuse('not_authorized');
    offered = forNewSessions[0];
  } catch {
    return refuse('not_authorized');
  }
  const verified = verifyPackage({ id: offered.id, version: offered.version }, deps);
  if (!verified.ok) return verified;
  return authorize(verified.method, () => [offered], () => consumer, () => request.inAudience);
}
