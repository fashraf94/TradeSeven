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
//           exit price as the front's fact line formats it, and the agent's OWN recorded words at the check before it
//           and at the check after it, each marked as said by the agent at that check;
//   refs    each label's tape row key — the prompt never sees it.
// LABELS, NEVER IDS: no id of any kind, no directive or other player-written text, no plan, meeting, card, ledger,
// moment excerpt, replay path or old nightly review. A quotation is the agent's rationale or hypothesis, each at most
// 500 code points, carried WHOLE or not at all: one over its bound, or holding an identifier (Build C CE-1 — an id the
// day knows, or any shape the platform mints, through src/utils/promptBoundText.js), is left out, never cut. A symbol
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

/** Every id the day knows — the tape's and the battle's — for the quotation policy (CE-1 item 1). */
export function knownIdsOf(tape, battle, extra = []) {
  const ids = [tape?.battleId, tape?.ownerId, tape?.agentId, battle?.id, battle?.agentBattleId, battle?.ownerId, battle?.agentId, ...extra];
  return [...new Set(ids.filter((v) => typeof v === 'string' && v))];
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
function quoteOf(v, knownIds, names) {
  const text = promptQuoteText(v, DIGEST_QUOTE_MAX, knownIds);
  if (text === null || !text.trim() || INVISIBLE_OR_CONTROL.test(text)) return null;
  const plain = unmaskedText(text);
  return names.some((re) => re.test(text) || re.test(plain)) ? null : text;
}

/** The agent's words at one check, as the digest carries them — each text whole or left out; null when none is carried. */
function saidAt(tape, check, knownIds, names) {
  if (!check) return null;
  const row = rationaleRowOf(tape, check.c);
  if (!row) return null;
  const rationale = quoteOf(row.rationale, knownIds, names);
  const hypothesis = quoteOf(row.hypothesis, knownIds, names);
  if (rationale === null && hypothesis === null) return null;
  return {
    saidBy: DIGEST_SAID_BY,
    at: etClock(check.c.at),
    ...(rationale !== null ? { rationale } : {}),
    ...(hypothesis !== null ? { hypothesis } : {}),
  };
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
  const known = knownIdsOf(tape, battle, knownIds);
  const names = namesOf(battle);
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
    const before = [...checks].reverse().find((x) => x.t <= p.t) ?? null;
    const after = checks.find((x) => x.t > p.t) ?? null;
    // a check with no strict instant between the two neighbours (by tickSeq), or one we cannot place against them at
    // all: neither neighbour is surely the check before or after — no words rather than another check's (M5)
    const seqOf = (x) => (Number.isInteger(x?.c?.tickSeq) ? x.c.tickSeq : null);
    const lo = before ? seqOf(before) : -Infinity;
    const hi = after ? seqOf(after) : Infinity;
    const unsure = untimed.length > 0 && (lo === null || hi === null || untimed.some((s) => s === null || (s > lo && s < hi)));
    const saidBefore = unsure ? null : saidAt(tape, before, known, names);
    const saidAfter = unsure ? null : saidAt(tape, after, known, names);
    return {
      label,
      time: etClock(a.at),
      maker: FILM_ROOM_COPY.debrief.makers[makerKeyOf(a)],
      ...(tickerOk(a.symbolOut) ? { sold: a.symbolOut } : {}),
      ...(tickerOk(a.symbolIn) ? { bought: a.symbolIn } : {}),
      ...(price ? { soldAt: fmtPrice(price.value) } : {}),
      ...(saidBefore ? { before: saidBefore } : {}),
      ...(saidAfter ? { after: saidAfter } : {}),
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
