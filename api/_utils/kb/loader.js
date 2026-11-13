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
//    1 missing               a package with this id and version, with its export,
//                            acceptance wrapper and register wrapper
//    2 schema                the export's schema is fantasytrades.kb-method-package/1
//                            (and it carries the title and acceptance date the
//                            answer reports)
//    3 identity              the export's id and version equal the request
//    4 not_accepted          status 'accepted', acceptance.decision 'accept', no test_only
//    5 corrupt               SHA-256 of method_text equals content_hash.value and
//                            acceptance.content_sha256 (algorithm sha256)
//    6 acceptance_mismatch   SHA-256 of the acceptance text equals the export's
//                            acceptance.evidence_sha256; the parsed record's id,
//                            version, decision 'accept' and content_sha256 agree
//    7 register_mismatch     SHA-256 of the register text equals the verified
//                            record's source_register.sha256
//    8 not_authorized        an authorization entry for this id and version whose
//                            sha256 and acceptanceSha256 equal the verified hashes
//    9 scope                 the entry's consumers include the caller's consumer
//   10 audience              the entry's audience is known and inAudience says true
//
// Every hash is recomputed here; no file's claim about its own hash is
// trusted. The release's own `production_app_use_authorized: false` is content
// status, neither permission nor refusal: app use is the authorization entry
// (authorizations.js), and that list ships empty.
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
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;
const ENTRY_KEYS = new Set([
  'id', 'version', 'sha256', 'acceptanceSha256', 'consumers', 'audience',
  'newSessions', 'authorizedAt', 'authorizedBy', 'evidenceRef',
]);

const refuse = (reason) => Object.freeze({ ok: false, reason });
const sha256Hex = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;

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
  // Check 2 — the schema, and the two fields the answer reports.
  if (exp.schema !== KB_PACKAGE_SCHEMA || !isNonEmptyString(exp.title) || !isNonEmptyString(exp.acceptance?.date)) return refuse('schema');

  // Check 3 — the export is the method that was asked for.
  if (exp.id !== id || exp.version !== version) return refuse('identity');

  // Check 4 — accepted content, not a test fixture.
  if (exp.status !== 'accepted' || exp.acceptance.decision !== 'accept' || (exp.test_only !== undefined && exp.test_only !== false)) return refuse('not_accepted');

  // Check 5 — the method text is the text the export and its acceptance name.
  const methodSha256 = sha256Hex(exp.method_text);
  if (exp.content_hash?.algorithm !== 'sha256' || methodSha256 !== exp.content_hash.value || methodSha256 !== exp.acceptance.content_sha256) return refuse('corrupt');

  // Check 6 — the acceptance record is the one the export binds, and agrees with it.
  const acceptanceSha256 = sha256Hex(acceptanceText);
  const record = parseObject(acceptanceText);
  if (acceptanceSha256 !== exp.acceptance.evidence_sha256 || record === null || record.id !== exp.id || record.version !== exp.version || record.decision !== 'accept' || record.content_sha256 !== methodSha256) return refuse('acceptance_mismatch');

  // Check 7 — the source register is the one the verified record binds.
  if (sha256Hex(registerText) !== record?.source_register?.sha256) return refuse('register_mismatch');

  return Object.freeze({
    ok: true,
    method: Object.freeze({
      id: exp.id,
      version: exp.version,
      sha256: methodSha256,
      acceptanceSha256,
      title: exp.title,
      text: exp.method_text,
      acceptedAt: exp.acceptance.date,
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
    if (!isObject(exportJson) || typeof acceptanceText !== 'string' || typeof registerText !== 'string') return refuse('missing');
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
    const row = Array.isArray(packages) ? packages.find((p) => isObject(p) && p.id === id && p.version === version) : undefined;
    if (!row || !isObject(row.exportJson) || typeof row.acceptance?.text !== 'string' || typeof row.register?.text !== 'string') return refuse('missing');

    return checkParts(id, version, row.exportJson, row.acceptance.text, row.register.text);
  } catch {
    return refuse('corrupt');
  }
}

/**
 * The entry's shape apart from its audience, which check 10 judges (so an
 * unknown audience answers `audience`, not `not_authorized`). Never throws.
 */
function isEntryShape(entry) {
  try {
    return isObject(entry)
      && Object.keys(entry).every((k) => ENTRY_KEYS.has(k))
      && isNonEmptyString(entry.id)
      && isNonEmptyString(entry.version)
      && typeof entry.sha256 === 'string' && HEX64.test(entry.sha256)
      && typeof entry.acceptanceSha256 === 'string' && HEX64.test(entry.acceptanceSha256)
      && Array.isArray(entry.consumers) && entry.consumers.length > 0 && entry.consumers.every(isNonEmptyString)
      && (entry.newSessions === undefined || typeof entry.newSessions === 'boolean')
      && typeof entry.authorizedAt === 'string' && ISO_INSTANT.test(entry.authorizedAt) && Number.isFinite(Date.parse(entry.authorizedAt))
      && isNonEmptyString(entry.authorizedBy)
      && isNonEmptyString(entry.evidenceRef);
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
    return isEntryShape(entry) && KB_AUDIENCES.includes(entry.audience);
  } catch {
    return false;
  }
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
  const v = verified.method;

  // Check 8 — an entry authorizes exactly these verified bytes.
  let matches;
  try {
    matches = authorizationsOf(deps).filter((e) => isEntryShape(e)
      && e.id === v.id && e.version === v.version && e.sha256 === v.sha256 && e.acceptanceSha256 === v.acceptanceSha256);
    if (matches.length === 0) return refuse('not_authorized');
  } catch {
    return refuse('not_authorized');
  }

  // Check 9 — for this consumer (one entry: two would make the audience ambiguous).
  let entry;
  let consumer;
  try {
    consumer = request.consumer;
    const forConsumer = matches.filter((e) => e.consumers.includes(consumer));
    if (forConsumer.length !== 1) return refuse(forConsumer.length === 0 ? 'scope' : 'not_authorized');
    entry = forConsumer[0];
  } catch {
    return refuse('scope');
  }

  // Check 10 — a known audience, and this player is in it.
  let audience;
  try {
    audience = entry.audience;
    const inAudience = request.inAudience;
    if (!KB_AUDIENCES.includes(audience) || typeof inAudience !== 'function' || inAudience(audience) !== true) return refuse('audience');
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
 * The one entry for this consumer that takes new sessions, then checks 1–10.
 * None, or more than one, answers `not_authorized`.
 *
 * @param {{ consumer: string, inAudience: (audience: string) => boolean }} request
 * @param {{ packages?: object[], authorizations?: object[] }} [deps]  for tests
 * @returns {{ ok: true, method: { id, version, sha256, title, text, acceptedAt, consumer, audience } } | { ok: false, reason: string }}
 */
export function authorizedMethodFor(request, deps) {
  try {
    const { consumer, inAudience } = isObject(request) ? request : {};
    const offered = authorizationsOf(deps).filter((e) => isEntryShape(e)
      && e.consumers.includes(consumer) && e.newSessions !== false);
    if (offered.length !== 1) return refuse('not_authorized');
    return loadAuthorizedMethod({ id: offered[0].id, version: offered[0].version, consumer, inAudience }, deps);
  } catch {
    return refuse('not_authorized');
  }
}
