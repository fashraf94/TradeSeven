// api/_utils/sharedResearch/method.js
//
// Shared Research — THE METHOD (spec §6.8, R4; Amendment A §A4, KB-1).
//
// `baseline@v0` is the interim research method, versioned as a prompt asset.
// Its text is §5 of the voice rulebook (docs/design/SHADOW_VOICE_RULES_V1.md
// "Baseline method v0"), byte for byte — prompt.honesty.test.js pins the two
// equal, so a change to either fails until both move together. METHOD and
// METHOD_SOURCE are the baseline and stay as they were.
//
// KB-1 adds the knowledge base's accepted method, for ONE kind of
// investigation: the one a player starts from their own words (founder ruling
// R-KB-1). It reaches this module only through the KB loader's authorized
// entry points and the audience function, called here and nowhere else in
// Shared Research, each with one argument (the KB boundary test pins it):
//
//   selectMethod          once per investigation: own words asks the loader
//                         for this consumer's method; a refusal is the
//                         baseline with the refusal recorded; story and drop
//                         are the baseline by rule (no refusal)
//   effectiveMethodFor    every turn: a KB stamp is re-loaded for the current
//                         player; a refusal runs that turn on the baseline. A
//                         baseline stamp is never upgraded (R-KB-7)
//   methodStampOf         the stamp a session records, once
//
// Neither function throws, and neither reads SHARED_RESEARCH_MODE or the
// Shared Research gate: the method's audience is its own check (R-KB-2). The
// uid each one is given is the gate's verified uid (the route passes it).
//
// What leaves the loader is whitelisted field by field (kbMethodOf): the
// package's provenance never reaches a session, an exchange or a log (R-KB-3).

import { createHash } from 'node:crypto';
import { authorizedMethodFor, loadAuthorizedMethod, KB_REFUSALS } from '../kb/loader.js';
import { inAudienceFor } from '../kb/audience.js';

const TEXT = `Baseline method v0 — baseline, not a KB package; replaced by an accepted package by id and version.

Follow the chain one link at a time: observation → problem → product → who pays → which company earns → why it might matter.

What each link needs as evidence:
- Observation: the player's words or the story, as given. It is where the work starts, never evidence.
- Problem: a source that names the problem the observation points at.
- Product: a source that names a product or service that addresses that problem.
- Who pays: a source that names the buyers.
- Which company earns: a source that ties the product to a named company that owns, supplies, sells, buys or competes with it.
- Why it might matter: a disclosed figure (a segment's share of revenue, a customer's share, disclosed terms), or the plain statement that it is not disclosed.

Questions to ask of a relationship: does the company own the product, supply it, buy it, partner on it, or compete with it? Which source says so, and is it the company's own filing or someone else's report?

Questions to ask of significance: what share of the company's revenue or of its segment does it represent? Is that revenue concentrated in a few customers? Are the terms disclosed?

Questions to ask of counter-evidence: would a move in the whole sector explain the same thing? Is this a single source? Is the source the vendor's own report about itself?`;

/** The method a session records (`method`) and a next action cites (`kb` / `baseline@v0`). */
export const METHOD = Object.freeze({ id: 'baseline', version: 'v0', text: TEXT });
/** The `kb` source a next-action finding cites. */
export const METHOD_SOURCE = Object.freeze({ recordKind: 'kb', recordId: `${METHOD.id}@${METHOD.version}`, label: 'Baseline method v0' });

/** The one consumer KB-1 asks the loader for: the investigation started from the player's own words (R-KB-1). */
export const OBSERVATION_CONSUMER = 'shared_research.observation';

const sha256Hex = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

/**
 * The baseline as an effective method. `sha256` is computed once, here, from
 * METHOD.text; method.test.js pins its value (the KB chat's comparison uses it).
 */
export const BASELINE = Object.freeze({
  id: METHOD.id, version: METHOD.version, sha256: sha256Hex(METHOD.text), source: 'baseline', text: METHOD.text, sourceRef: METHOD_SOURCE,
});

/** A source label's cap (researchRecords/model.js SOURCE_LABEL_MAX_LEN). */
const LABEL_MAX = 120;
const HEX64 = /^[0-9a-f]{64}$/;
const isText = (v) => typeof v === 'string' && v.length > 0;

/** `<id>@<version>`. */
export const methodKeyOf = (m) => `${m?.id}@${m?.version}`;

/**
 * The `kb` source a next action cites for a KB method: `Method · <title> v<version>`.
 * With no title in hand (see citedSourceOf) the label names the id instead.
 */
export function kbSourceRefOf({ id, version, title = null }) {
  const label = `Method · ${isText(title) ? title : id} v${version}`;
  return Object.freeze({ recordKind: 'kb', recordId: `${id}@${version}`, label: label.length <= LABEL_MAX ? label : label.slice(0, LABEL_MAX).trimEnd() });
}

/** A loader answer this module can use: ok, with the fields a method needs, each a string. */
function isOkAnswer(r) {
  const m = r?.ok === true ? r.method : null;
  return m !== null && typeof m === 'object' && isText(m.id) && isText(m.version) && typeof m.sha256 === 'string' && HEX64.test(m.sha256)
    && isText(m.title) && isText(m.text) && isText(m.acceptedAt);
}
/** A refusal's reason: one of the loader's ten, else `corrupt` (an answer this module cannot read). */
const refusalOf = (r) => (r?.ok === false && KB_REFUSALS.includes(r.reason) ? r.reason : 'corrupt');

/** The KB method as Shared Research holds it: the loader's own fields, whitelisted — never a spread (R-KB-3). */
function kbMethodOf(m) {
  return Object.freeze({
    id: m.id, version: m.version, sha256: m.sha256, source: 'kb', text: m.text,
    title: m.title, acceptedAt: m.acceptedAt, sourceRef: kbSourceRefOf(m),
  });
}

/**
 * The stamp a session records once (Amendment A §A4.2): which method it
 * selected, for which consumer, when, and — for a baseline that stands in for
 * a refused KB method — why. `fallbackReason` is written only when given.
 */
export function methodStampOf(method, { consumer = null, selectedAt, fallbackReason = null } = {}) {
  const stamp = {
    id: method.id, version: method.version, sha256: method.sha256, source: method.source === 'kb' ? 'kb' : 'baseline',
    consumer: isText(consumer) ? consumer : null, selectedAt: typeof selectedAt === 'string' ? selectedAt : null,
  };
  if (isText(fallbackReason)) stamp.fallbackReason = fallbackReason;
  return stamp;
}

/**
 * Select an investigation's method, once.
 *   own words (`observation`)  the loader's method for OBSERVATION_CONSUMER and
 *                              this player; a refusal → the baseline, the
 *                              refusal as `fallbackReason`
 *   any other entry            the baseline, by rule (no `fallbackReason`)
 * Never throws (a request that is not an object, or throws when read, is the
 * baseline: `corrupt` when it could not be read).
 * @returns {{ method: object, stamp: object }}
 */
export function selectMethod(request) {
  let entryKind;
  let uid;
  let nowIso;
  try {
    ({ entryKind, uid, nowIso } = request ?? {});
  } catch {
    return { method: BASELINE, stamp: methodStampOf(BASELINE, { selectedAt: new Date().toISOString(), fallbackReason: 'corrupt' }) };
  }
  const selectedAt = typeof nowIso === 'string' ? nowIso : new Date().toISOString();
  if (entryKind !== 'observation') return { method: BASELINE, stamp: methodStampOf(BASELINE, { selectedAt }) };
  let reason;
  try {
    const r = authorizedMethodFor({ consumer: OBSERVATION_CONSUMER, inAudience: inAudienceFor(uid) });
    if (isOkAnswer(r)) {
      const method = kbMethodOf(r.method);
      return { method, stamp: methodStampOf(method, { consumer: OBSERVATION_CONSUMER, selectedAt }) };
    }
    reason = refusalOf(r);
  } catch {
    reason = 'corrupt';
  }
  return { method: BASELINE, stamp: methodStampOf(BASELINE, { consumer: OBSERVATION_CONSUMER, selectedAt, fallbackReason: reason }) };
}

/**
 * The method THIS turn runs on (Amendment A §A4.1).
 *   a `kb` stamp                    re-loaded for this player: ok → that method
 *                                   (the loader pins its id and version; other
 *                                   bytes under that name run and are recorded
 *                                   by hash — founder question FQ-3); a refusal
 *                                   → the baseline, `refusal` set
 *   a `baseline` stamp, or none,    the baseline, `refusal: null` — never
 *   or one with no `source`         upgraded (R-KB-7)
 * Never throws (a stamp that throws when read is the baseline, `corrupt`).
 * @returns {{ method: object, refusal: string|null }}
 */
export function effectiveMethodFor(request) {
  try {
    const { stamp, uid } = request ?? {};
    if (stamp?.source !== 'kb') return { method: BASELINE, refusal: null };
    const { id, version, consumer } = stamp;
    const r = loadAuthorizedMethod({ id, version, consumer, inAudience: inAudienceFor(uid) });
    return isOkAnswer(r) ? { method: kbMethodOf(r.method), refusal: null } : { method: BASELINE, refusal: refusalOf(r) };
  } catch {
    return { method: BASELINE, refusal: 'corrupt' };
  }
}

/**
 * The source the opening's next action cites for an own-words investigation:
 * the method its FRAME exchange ran on (`ran`, that exchange's `method`), since
 * the opening's next action is written from the frame. A baseline frame, or a
 * frame exchange with no method, cites the baseline. A KB frame cites that
 * method; its title — the label's — is re-read through the loader, and when
 * the loader no longer answers with those bytes (revoked between the frame and
 * the open) the label names the method's id instead. It never cites the
 * baseline for a frame that ran on a KB method. Never throws (a frame method or
 * a stamp that throws when read cites the baseline: nothing readable says KB).
 */
export function citedSourceOf(request) {
  try {
    const { ran, stamp = null, uid } = request ?? {};
    if (ran?.source !== 'kb' || !isText(ran.id) || !isText(ran.version)) return BASELINE.sourceRef;
    const { id, version, sha256 } = ran;
    const { method } = effectiveMethodFor({ stamp: { id, version, source: 'kb', consumer: stamp?.consumer ?? OBSERVATION_CONSUMER }, uid });
    return method.source === 'kb' && method.id === id && method.version === version && method.sha256 === sha256 ? method.sourceRef : kbSourceRefOf({ id, version });
  } catch {
    return BASELINE.sourceRef;
  }
}

/** What an exchange records of the method its turn ran on. */
export const methodRefOf = (m) => ({ id: m.id, version: m.version, sha256: m.sha256, source: m.source === 'kb' ? 'kb' : 'baseline' });

// ── a method's markers (the method_example_as_fact check, stepSchema.js) ────────

/**
 * The markers of a method's own register: the source ids it cites and its
 * worked example. Keyed by `<id>@<version>` AND that version's sha256, so other
 * bytes under the same version carry none. A method with no markers runs no
 * `method_example_as_fact` check.
 */
const MARKERS = Object.freeze({
  'KB-IDEA-EVALUATION-001@0.1': Object.freeze({
    sha256: 'b0688fb33cdd5b16835a5a70f7fcef7ca79d00facced233d1529d26b4e77854e',
    citations: Object.freeze(['A0', 'C1', 'E1', 'M1', 'V1', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'I1', 'I2', 'I3', 'I4', 'I5', 'I6']),
    // `aliases`: the company's own name, which a retrieval-backed finding may use for the example's exemption only.
    example: Object.freeze({ names: Object.freeze(['NVDA']), dates: Object.freeze(['October 30', 'Oct. 30', 'Oct 30']), aliases: Object.freeze(['Nvidia']) }),
  }),
});

/** The markers for this method's exact bytes, or null. */
export function methodMarkersFor(method) {
  const m = method?.source === 'kb' ? MARKERS[methodKeyOf(method)] : undefined;
  return m && m.sha256 === method.sha256 ? m : null;
}
