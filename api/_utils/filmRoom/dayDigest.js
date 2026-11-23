// api/_utils/filmRoom/dayDigest.js
//
// Film Room D2 — THE DAY DIGEST (D2 spec §2; ruling DW-3, the founder's FD-2): what the model reads, and nothing else.
// Pure, read-only, Node-clean. It turns one tape day and its battle into `{ digest, refs }`, or null when the day
// cannot be read:
//   digest  the day (final or not — the front's own predicate; on a final day the result word, and the two finals only
//           where the front's key shows both), the archetype's DISPLAY name (never the agent's own name: the player
//           chose it), and at most eight swaps, chosen as the front chooses its pins (the agent's swaps first, then the
//           others, each group in time order) and listed in time order — each with its label (s1, s2, … in time
//           order), its ET clock, its maker in the copy table's words (facts, never the agent's), its symbols, its
//           exit price as the front's fact line formats it, and the agent's OWN recorded words (Build D Amendment E
//           DE-10, as Amendment F DF-9 defines it) — `atSwap`, at the check where the swap ran (the check whose
//           tickSeq is the action's), and `before`, at the nearest lower check that recorded eligible words (a check
//           without words is skipped, never taken as the nearest); an action with no tickSeq falls back to time:
//           `before` is the latest timed check at or before its instant with eligible words, no `atSwap`, and the
//           review's M5 (DE-14) still leaves the words out when an untimed check may lie between — each marked as said
//           by the agent at that check;
//   refs    each label's tape row key — the prompt never sees it.
// LABELS, NEVER IDS: no id of any kind, no directive or other player-written text, no plan, meeting, card, ledger,
// moment excerpt, replay path or old nightly review. A quotation is the agent's rationale or hypothesis, each at most
// 500 code points, carried WHOLE or not at all: one over its bound, holding an identifier (Build C CE-1 — an id the
// day knows, every opaque reference its tape holds included (Amendment F DF-3), or any shape the platform mints,
// through src/utils/promptBoundText.js), or echoing the player's own words (Amendment F DF-2: a run of five words, or
// the whole of a shorter player text, shared with any player-written or player-editable text of the same tape day —
// read for that test only, never carried), is left out, never cut. A symbol
// is carried only as a ticker (the symbol directory's shape). A swap with no strict instant, or with no row key to bind
// its words to, is not in the digest.
//
// The digest never imports the moment excerpt (api/_utils/filmRoom/momentExcerpt.js): only the census's named exception
// may (Build C CC-1; oneDoor.census.test.js holds the `debrief` model path to it).
//
// BUILD_RULES §4: it reads the front's own modules — the predicate, the maker key and the pin orders
// (src/screens/filmRoomV2/filmRoomFlow.js), the clock and the price format (filmRoomModel.js), the copy table
// (filmRoomCopy.js) — plus the strict instant parser and the quotation policy (src/utils/filmRoomSubject.js,
// src/utils/promptBoundText.js) and the archetype's display name (src/data/archetypeDisplay.js). Each is Node-clean;
// dayDigest.test.js's UNMOCKED import of this module is their dependency-surface guard.

import { readsAsFinal, keyOf, allPinsOf, comparePinsByPriority, comparePinsByTime, makerKeyOf } from '../../../src/screens/filmRoomV2/filmRoomFlow.js';
import { etClock, fmtPrice, fmtPoints, numberAt } from '../../../src/screens/filmRoomV2/filmRoomModel.js';
import { FILM_ROOM_COPY } from '../../../src/screens/filmRoomV2/filmRoomCopy.js';
import { instantMs, promptQuoteText } from '../../../src/utils/filmRoomSubject.js';
import { tickerOk, unmaskedText } from '../../../src/utils/promptBoundText.js';
import { getArchetypeDisplayName, ARCHETYPE_DISPLAY_NAMES } from '../../../src/data/archetypeDisplay.js';
import { stableStringify, canonicalContentHash } from '../canonicalHash.js';

/** The digest's shape version (§2). The record stamps it beside the digest's hash. */
export const DAY_DIGEST_VERSION = 1;
/** DW-2: at most eight swaps a day get a line. */
export const DIGEST_SWAP_LIMIT = 8;
/** §2: each quotation — a rationale, a hypothesis — at most 500 code points, whole or not at all. */
export const DIGEST_QUOTE_MAX = 500;
/** How the digest marks the agent's recorded words: said by the agent, at its check. */
export const DIGEST_SAID_BY = 'the agent, in its own recorded words at the time';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' && v ? v : null);
const RESULTS = Object.freeze(['win', 'loss', 'draw']);

/**
 * Amendment F DF-3 (Astra's F3): every opaque reference the tape day holds — `actions[].key`, `checks[].evalId`,
 * `checks[].tickId`, `checks[].runId` and `rationale[].evalId`.
 */
export function tapeRefsOf(tape) {
  const rows = (k) => (Array.isArray(tape?.[k]) ? tape[k] : []).filter(isObj);
  return [
    ...rows('actions').map((a) => a.key),
    ...rows('checks').flatMap((c) => [c.evalId, c.tickId, c.runId]),
    ...rows('rationale').map((r) => r.evalId),
  ].filter((v) => typeof v === 'string' && v);
}

/**
 * Every id the day knows — the tape's and the battle's, and every opaque reference the tape holds (DF-3) — THE
 * inventory: the pass builds it once and hands the same list to the digest's quotation policy (CE-1 item 1) and to
 * check 6 (debriefChecks.js).
 */
export function knownIdsOf(tape, battle, extra = []) {
  const ids = [tape?.battleId, tape?.ownerId, tape?.agentId, battle?.id, battle?.agentBattleId, battle?.ownerId, battle?.agentId, ...tapeRefsOf(tape), ...extra];
  return [...new Set(ids.filter((v) => typeof v === 'string' && v))];
}

/**
 * Amendment F DF-2 (Astra's F2) — the player-written or player-editable text the tape day holds: the directives'
 * `playerText`, `canonicalText` and `retainedDirectiveText`, and every text field of `meetings[]` (an owner can edit the
 * meeting history — Build C CD-16). Read for the overlap test only: none of it is ever carried. The agent's reply is
 * the agent's own, not listed.
 */
export function playerTextsOf(tape) {
  const out = [];
  for (const d of Array.isArray(tape?.directives) ? tape.directives : []) {
    if (isObj(d)) for (const k of ['playerText', 'canonicalText', 'retainedDirectiveText']) if (typeof d[k] === 'string') out.push(d[k]);
  }
  const strings = (v) => { if (typeof v === 'string') out.push(v); else if (Array.isArray(v)) v.forEach(strings); else if (isObj(v)) Object.values(v).forEach(strings); };
  for (const m of Array.isArray(tape?.meetings) ? tape.meetings : []) if (isObj(m)) strings(m);
  return out;
}

/**
 * DF-2's comparison form: NFKC, lower case, punctuation removed — words, a word being a run of letters, marks and
 * digits. A text is read TWO ways, and a run shared under either is an echo (the fix round's review, M-1 to M-3, and its
 * refuter's regression):
 *   literal    the invisible characters and every punctuation mark removed — DF-2's letter ("pre-market" is
 *              "premarket", "U.S." is "us", "Ig\u00ADnore" is "ignore"); a symbol or a space separates words
 *   separated  every apostrophe-like mark removed ("don't" is "dont"); every other character — punctuation, a symbol
 *              (a backtick, "$", "~", "|", an emoji), a space, an invisible character — separates words
 * Under each reading a text of under three words gives no run. Both readings remove the apostrophe's look-alikes
 * first, before NFKC (which turns an acute accent "´" into a space and a combining mark).
 */
const APOSTROPHES = /['’‘‛ʼ′‵´]/gu;   // never the backtick: used as a quoting mark, it separates words
const prepared = (text) => String(text).replace(APOSTROPHES, '').normalize('NFKC').toLowerCase();
const wordsLiteral = (text) => prepared(text).replace(/[\p{Default_Ignorable_Code_Point}\p{Cf}]/gu, '').replace(/\p{P}/gu, '').split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
const wordsSeparated = (text) => prepared(text).replace(/[\p{Default_Ignorable_Code_Point}\p{Cf}]/gu, ' ').split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
const overlapReadingsOf = (text) => [wordsLiteral(text), wordsSeparated(text)];
/** DF-2: the run is five words. */
export const ECHO_RUN_WORDS = 5;
/** DF-2: a player text under three words is never matched. */
export const ECHO_MIN_WORDS = 3;
/**
 * The runs a quotation may not share with the player's texts: each player text's every run of five words, or the whole
 * text when it is shorter (three or four words); a text under three words gives none.
 */
export function playerRunsOf(texts) {
  const runs = [];
  for (const t of texts) {
    for (const w of overlapReadingsOf(t)) {
      if (w.length < ECHO_MIN_WORDS) continue;
      const n = Math.min(ECHO_RUN_WORDS, w.length);
      for (let i = 0; i + n <= w.length; i += 1) runs.push(w.slice(i, i + n));
    }
  }
  return runs;
}
/** Does `text` share one of `runs`, word for word, under either reading? */
export function echoesPlayer(text, runs) {
  if (!runs.length) return false;
  const joined = overlapReadingsOf(text).map((w) => ` ${w.join(' ')} `);
  return runs.some((r) => { const run = ` ${r.join(' ')} `; return joined.some((j) => j.includes(run)); });
}

/** The archetype's code, the subtitle's rule (FilmRoomScreenV2 headerParts): the battle's, else the tape's; never 'unknown'. */
export function archetypeCodeOf(tape, battle) {
  return [battle?.agentContext?.archetype, battle?.archetype, tape?.archetype].find((a) => typeof a === 'string' && a && a.toLowerCase() !== 'unknown') ?? null;
}

/**
 * The archetype's DISPLAY name the digest and the prompt carry — only for a code the app's own table knows
 * (ARCHETYPE_DISPLAY_NAMES): the review's M1 — an agent document's `archetype` is written by the client, so any other
 * string is text a player could have chosen (DW-3), and getArchetypeDisplayName's humanized fallback would carry it
 * into the system text. An unknown code is no name at all (the prompt then says "the agent").
 */
export function archetypeDisplayOf(code) {
  return typeof code === 'string' && Object.prototype.hasOwnProperty.call(ARCHETYPE_DISPLAY_NAMES, code) ? getArchetypeDisplayName(code) : null;
}

/**
 * The day's checks with a strict instant, in the writer's order at an instant — time, then tickSeq, then the array's
 * place (the review's M5: the array's order alone let two checks at one instant trade places).
 */
function timedChecks(tape) {
  const seqKey = (c) => (Number.isInteger(c?.tickSeq) ? c.tickSeq : Infinity);
  return (Array.isArray(tape.checks) ? tape.checks : [])
    .map((c, i) => ({ c, i, t: instantMs(c?.at) }))
    .filter((x) => x.t !== null)
    .sort((a, b) => (a.t - b.t) || (seqKey(a.c) - seqKey(b.c)) || (a.i - b.i));
}

/**
 * The tickSeqs of the day's checks that hold NO strict instant — a gap row the writer mints for a check that ran and
 * left no record, or a looser time. Such a check may sit between a swap and the timed check the digest would take as
 * its neighbour; then that neighbour's words are not "the check before" (or after) — the review's M5: never an older
 * check's words in its place.
 */
function untimedSeqs(tape) {
  return (Array.isArray(tape.checks) ? tape.checks : []).filter((c) => instantMs(c?.at) === null).map((c) => (Number.isInteger(c?.tickSeq) ? c.tickSeq : null));
}

/**
 * The rationale row recorded at check `c`: the same tickSeq, else the same evaluation id — and an evaluation-id match
 * only for a row whose own tickSeq does not name another check (the review's M4).
 */
function rationaleRowOf(tape, c) {
  const rows = Array.isArray(tape.rationale) ? tape.rationale : [];
  if (Number.isInteger(c?.tickSeq)) {
    const bySeq = rows.find((r) => Number.isInteger(r?.tickSeq) && r.tickSeq === c.tickSeq);
    if (bySeq) return bySeq;
  }
  const evalId = str(c?.evalId);
  const sameCheck = (r) => !Number.isInteger(r?.tickSeq) || !Number.isInteger(c?.tickSeq) || r.tickSeq === c.tickSeq;
  return evalId ? rows.find((r) => str(r?.evalId) === evalId && sameCheck(r)) ?? null : null;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/**
 * DW-3 — the agent's own display name is player-written text (the player chose it), and the agent's recorded words can
 * carry it (its evaluation prompt opens "You are {name}" — the review's M2): a quotation that holds the name, as a whole
 * word in any case, as written or unmasked, is left out whole, like one that holds an id.
 */
// a run of spaces, hyphens or dashes between a name's words matches any such run (the refuter's M2: "QUINZEL   MARROWBY",
// "Quinzel-Marrowby")
const NAME_JOIN = /[\s\-‐-―]+/u;
const NAME_JOIN_RE = '[\\s\\-\\u2010-\\u2015]+';
/**
 * The platform's own default name (agentBattleService.js snapshots `agentData.name || 'Agent'`), which no player chose:
 * leaving out every quotation that says "agent" would drop words for nothing (the refuter's N4).
 */
export const PLATFORM_DEFAULT_AGENT_NAME = 'Agent';
function namesOf(battle) {
  const name = typeof battle?.agentContext?.agentName === 'string' ? battle.agentContext.agentName.trim() : '';
  if (!name || name.toLowerCase() === PLATFORM_DEFAULT_AGENT_NAME.toLowerCase()) return [];
  const words = name.split(NAME_JOIN).filter(Boolean).map(escapeRe);
  return words.length ? [new RegExp(`(?<![\\p{L}\\p{N}])${words.join(NAME_JOIN_RE)}(?![\\p{L}\\p{N}])`, 'iu')] : [];
}
/** A format or default-ignorable character: a direction override, an invisible joiner or space (the review's P1). */
const INVISIBLE_OR_CONTROL = /[\p{Cf}\p{Default_Ignorable_Code_Point}]/u;
/**
 * A quotation the digest may carry: within the bound, no id (CE-1), not blank (the review's M6), no player-chosen name,
 * and nothing invisible or directional — a right-to-left override would reach the model as text the reader never sees
 * (the review's P1; the checks drop a line that copies one).
 */
function quoteOf(v, policy) {
  const text = promptQuoteText(v, DIGEST_QUOTE_MAX, policy.knownIds);
  if (text === null || !text.trim() || INVISIBLE_OR_CONTROL.test(text)) return null;
  const plain = unmaskedText(text);
  if (policy.names.some((re) => re.test(text) || re.test(plain))) return null;
  // DF-2: a quotation that shares a run of the player's own words is left out whole
  return echoesPlayer(text, policy.playerRuns) ? null : text;
}

/** The eligible words recorded at check `c` — each text whole or left out; null when none is eligible. */
function eligibleWordsAt(tape, c, policy) {
  const row = rationaleRowOf(tape, c);
  if (!row) return null;
  const rationale = quoteOf(row.rationale, policy);
  const hypothesis = quoteOf(row.hypothesis, policy);
  if (rationale === null && hypothesis === null) return null;
  return { ...(rationale !== null ? { rationale } : {}), ...(hypothesis !== null ? { hypothesis } : {}) };
}

/** The agent's words at one check, as the digest carries them — only a check with a strict instant (its clock); null when none. */
function saidAt(tape, c, policy) {
  if (!c || instantMs(c.at) === null) return null;
  const words = eligibleWordsAt(tape, c, policy);
  return words ? { saidBy: DIGEST_SAID_BY, at: etClock(c.at), ...words } : null;
}

/**
 * DF-9 — a swap's two quotations: `{ before, atSwap }`, each a carried quotation or null.
 *   With a tickSeq: `atSwap` is the eligible words of the check whose tickSeq is the action's; `before` the nearest
 *   LOWER check by tickSeq (the writer's order — reliably ordered, whatever the instants) that has eligible words, a
 *   check without them skipped. When that nearest worded check has no strict instant, it has no clock to say, and an
 *   older check's words never stand in for it: no `before`. Nor when a check with NO tickSeq but eligible words may lie
 *   between that check and the swap — at an instant after it and at or before the swap's, or at no strict instant at
 *   all (the fix round's review, M-4: the writer absorbs a lost tick's evaluation as an entry-only row with no
 *   tickSeq, and its words, not the older check's, are the words before the swap).
 *   With no tickSeq (the time fallback): `before` is the latest timed check at or before the swap's instant with
 *   eligible words; no `atSwap`; and DE-14's conservative rule (the review's M5) stands — when a check with no strict
 *   instant may lie between that check and the first timed check after the swap (by tickSeq), or cannot be placed at
 *   all, the words are left out rather than another check's taken.
 */
function quotationsOf(tape, a, swapT, checks, untimed, policy) {
  const all = (Array.isArray(tape.checks) ? tape.checks : []).filter(isObj);
  if (Number.isInteger(a.tickSeq)) {
    const own = all.find((c) => c.tickSeq === a.tickSeq) ?? null;
    const lower = all.filter((c) => Number.isInteger(c.tickSeq) && c.tickSeq < a.tickSeq).sort((x, y) => y.tickSeq - x.tickSeq);
    const worded = lower.find((c) => eligibleWordsAt(tape, c, policy) !== null) ?? null;
    const wordedT = worded ? instantMs(worded.at) : null;
    const between = all.some((c) => !Number.isInteger(c.tickSeq) && eligibleWordsAt(tape, c, policy) !== null
      && (instantMs(c.at) === null || (instantMs(c.at) <= swapT && (wordedT === null || instantMs(c.at) >= wordedT))));
    return { before: worded && !between ? saidAt(tape, worded, policy) : null, atSwap: own ? saidAt(tape, own, policy) : null };
  }
  const before = [...checks].reverse().find((x) => x.t <= swapT && eligibleWordsAt(tape, x.c, policy) !== null) ?? null;
  const next = checks.find((x) => x.t > swapT) ?? null;
  const seqOf = (x) => (Number.isInteger(x?.c?.tickSeq) ? x.c.tickSeq : null);
  const lo = before ? seqOf(before) : -Infinity;
  const hi = next ? seqOf(next) : Infinity;
  const unsure = untimed.length > 0 && (lo === null || hi === null || untimed.some((s) => s === null || (s > lo && s < hi)));
  return { before: unsure || !before ? null : saidAt(tape, before.c, policy), atSwap: null };
}

/** The day: final or not by the front's own predicate; on a final day the result word, and both finals where the key shows both. */
function dayOf(tape, battle) {
  if (!readsAsFinal(tape, battle)) return { final: false };
  const result = tape.battle?.result?.value;
  const key = keyOf(tape, battle);
  return {
    final: true,
    ...(RESULTS.includes(result) ? { result } : {}),
    ...(key.you && key.cpu ? { finals: { you: fmtPoints(key.you.value), cpu: fmtPoints(key.cpu.value) } } : {}),
  };
}

/**
 * The day digest (§2) of one written tape day.
 * @param {object} p
 * @param {object} p.tape     the day's tape document
 * @param {object} [p.battle] the battle document (DB-2's evidence for a tape written before `isFinalDay`; the archetype)
 * @param {string[]} [p.knownIds] more ids the caller knows (an attribution agent) — the day's own are always known
 * @returns {{ digest: object, refs: Object<string, string> } | null}
 */
export function buildDayDigest({ tape, battle = null, knownIds = [] } = {}) {
  if (!isObj(tape) || !Array.isArray(tape.checks) || !Array.isArray(tape.actions)) return null;
  // the quotation policy: every id the day knows (DF-3), the agent's chosen name (DW-3), the player's runs (DF-2)
  const policy = { knownIds: knownIdsOf(tape, battle, knownIds), names: namesOf(battle), playerRuns: playerRunsOf(playerTextsOf(tape)) };
  const code = archetypeCodeOf(tape, battle);
  // the front's pins, its swaps only: a strict instant and a row key to bind the words to; chosen by the front's priority
  const swapPins = allPinsOf(tape).filter((p) => p.src === 'action' && p.t !== null && str(tape.actions[p.index]?.key));
  const chosen = [...swapPins].sort(comparePinsByPriority).slice(0, DIGEST_SWAP_LIMIT).sort(comparePinsByTime);
  const checks = timedChecks(tape);
  const untimed = untimedSeqs(tape);
  const refs = {};
  const swaps = chosen.map((p, k) => {
    const a = tape.actions[p.index];
    const label = `s${k + 1}`;
    refs[label] = a.key;
    const price = numberAt(tape, ['actions', p.index, 'exitPrice']);
    const { before, atSwap } = quotationsOf(tape, a, p.t, checks, untimed, policy);
    return {
      label,
      time: etClock(a.at),
      maker: FILM_ROOM_COPY.debrief.makers[makerKeyOf(a)],
      ...(tickerOk(a.symbolOut) ? { sold: a.symbolOut } : {}),
      ...(tickerOk(a.symbolIn) ? { bought: a.symbolIn } : {}),
      ...(price ? { soldAt: fmtPrice(price.value) } : {}),
      ...(before ? { before } : {}),
      ...(atSwap ? { atSwap } : {}),
    };
  });
  return {
    digest: {
      day: dayOf(tape, battle),
      archetype: archetypeDisplayOf(code),
      swaps,
    },
    refs,
  };
}

/** The digest's canonical JSON — sorted keys at every level (canonicalHash.js stableStringify): the bytes the hash and the prompt read. */
export const canonicalDigestJson = (digest) => stableStringify(digest);
/** §6 `digestHash`: the SHA-256 (hex) of the digest's canonical JSON. */
export const digestHashOf = (digest) => canonicalContentHash(digest);
