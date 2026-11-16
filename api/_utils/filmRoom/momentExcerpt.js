// api/_utils/filmRoom/momentExcerpt.js
//
// Film Room C2 item 2 — THE MOMENT EXCERPT (Build C spec §6, as Amendment C amends it): the bounded, attributed,
// READ-ONLY projection of one game moment, or of one card, that the Practice Field's drafting call reads. Its one
// importer is `api/_utils/practiceField/draftingPrompt.js` (contract V2 Amendment B item 6; the one-door census's named
// exception, CC-1) — which the Practice Field's T1b + T1d writes; until then nothing but this module's tests calls it.
//
//   excerptOf(db, { uid, attributionAgentId, battleId, etDate, moment })   one game moment
//   excerptOfCard(db, { uid, attributionAgentId, entryId })                one card, through its filed source
//
// Each answers `{ excerpt, refs }` or null.
//
// THE OWNER ONLY, SILENTLY (CC-5): an answer needs the tape day's `ownerId` to be the caller's, the battle's to be the
// caller's, and the battle's ATTRIBUTION agent (a casual clone's parent, by the clone document the caller owns — the
// platform's resolver's rule, pinned to it by test; the battle's own agent otherwise) to be the one named; for a card,
// the entry under that agent must be the caller's. Anything else — a missing day, another owner's day, another agent, an
// unreadable read, a malformed argument — is null: no fields, and nothing that tells one null from another (no reason,
// no log).
//
// THE DAY CHECK (CC-4): the moment must be exactly one the day's stored tags hold, by the ONE implementation the card
// route applies (sourceDay.js); for a card, against what it was filed under — coverage, the exact moment, the situation
// version, the archetype. A card whose source no longer passes gives null, never a guess.
//
// LABELS, NEVER IDS (CC-3): `excerpt` names the battle, the idea and the card only as `b1`, `i1`, `c1`; `refs` maps
// each label present to its real id, for the server's own resolution (contract V2 §5.1) — never for a prompt.
//
// EVERY FIELD CARRIES ITS PROVENANCE, from its one named source, and nothing else is carried:
//   { value, class }                      a value: `recorded` for what the tape (or the directory) holds — a number's
//                                         class is the tape's own declaration for its path (`numberClasses`), so a
//                                         series bar carries the series document's `market`; `derived` for a count
//                                         the Film Room computes;
//   { text, by, at, class: 'quoted' }     someone's words (CC-2): `by` the speaker — `agent`, `player` or `platform` —
//                                         and `at` the time the record holds for the words, or null. One speaker per
//                                         quotation; speakers are never joined.
// A field whose source the tape (or its record) does not hold is ABSENT — no sector, idea, count, cause or verdict is
// added. A quoted text over its bound is not carried (never cut): EXCERPT_BOUNDS, every one at most 500 code points
// (Amendment D W-06). `recurrences` (the counter's, for a Watch card) is not carried in version 1: it needs a window of
// tape days, a read this module may not make (build report, rulings).
//
// BOUNDED READS ONLY, plain document gets (never a transaction, a query or a collection scan): the tape day; the battle;
// the owner's clone document when the battle is a casual clone's; the idea's one hypothesis version; the sold symbol's
// one series document; and for a card, its one `plays` entry. READ-ONLY BY CONSTRUCTION: no write call of any kind in
// this module or anything it imports (momentExcerpt.test.js's write gate, the C1 census script's pattern).
//
// MOMENT_EXCERPT_VERSION = 1 describes today's BaggerBomb tape (CC-6); the trader game's launch set moves it to 2.

import { judgeDay, judgeFiledDay, readDayWith } from './sourceDay.js';
import { battleRef, tapeRef } from '../filmTape/tapeSources.js';
import { SERIES_SUBCOLLECTION, NON_CHECK_STATES, classOfNumber } from '../../../src/constants/filmTape.js';
import { isCasualCloneId } from '../../../src/constants/leagueTournament.js';
import { SITUATION_QUESTIONS } from '../../../src/data/situationQuestions.js';
import { routeOf } from '../../../src/data/cardStages.js';
import { isEtDate } from '../../../src/utils/tapeSchedule.js';
import { sectorOf, boundedText, IDEA_STATEMENT_MAX } from '../../../src/utils/filmRoomSubject.js';

/** CC-6: the excerpt's shape version — today's BaggerBomb tape. */
export const MOMENT_EXCERPT_VERSION = 1;

/** CC-3: the opaque local labels — the only names the battle, the idea and the card have in `excerpt`. */
export const EXCERPT_LABELS = Object.freeze({ battle: 'b1', idea: 'i1', card: 'c1' });

/** CC-2: the three speakers a quotation may name. */
export const QUOTE_SPEAKERS = Object.freeze(['agent', 'player', 'platform']);

/** CC-2: each quoted field's bound, in code points — every one at most 500 (W-06). */
export const EXCERPT_BOUNDS = Object.freeze({
  statement: IDEA_STATEMENT_MAX,
  hypothesis: 500,
  rationale: 500,
  playerText: 400,
  canonicalText: 400,
  diagnosis: 400,
  note: 280,
});

/** The documents this module reads by path — each pinned by test to its owner's own constant. */
export const EXCERPT_PATHS = Object.freeze({
  agents: 'agents',
  plays: 'plays',
  ideaLists: 'watchlists',
  ideaVersions: 'hypothesisVersions',
  ideaVersionDocId: (n) => `v${n}`,
});

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' && v ? v : null);
const ID = /^[A-Za-z0-9_-]{1,200}$/;
/** A path id: the forge-id class, never a reserved `__id__` (the card endpoint's own rule). */
const idOk = (v) => typeof v === 'string' && ID.test(v) && !/^__.*__$/.test(v);
const TICKER = /^[A-Z0-9][A-Z0-9.-]{0,11}$/;
const msOf = (v) => { if (typeof v !== 'string') return null; const ms = Date.parse(v); return Number.isFinite(ms) ? ms : null; };
const instantOrNull = (v) => (msOf(v) !== null ? v : null);
const seqOk = (v) => v === null || (Number.isInteger(v) && v >= 0);

/** A plain document get — the only read this module makes (never a transaction). */
const READ = Object.freeze({ get: (ref) => ref.get() });
const dataOf = (snap) => (snap && snap.exists ? (typeof snap.data === 'function' ? snap.data() : snap.data) : null);
/** One document, or null — a failed read is null here, never an answer about the record. */
async function readDoc(ref) {
  try {
    return dataOf(await ref.get());
  } catch {
    return null;
  }
}

const recorded = (value) => ({ value, class: 'recorded' });
const quote = (text, by, at) => ({ text, by, at, class: 'quoted' });
/** A number with the class the document itself declares for its path, or nothing (a number no declaration classes is not carried). */
const classed = (value, declaration, path) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const cls = classOfNumber(declaration, path);
  return cls ? { value, class: cls } : null;
};
const momentArgOk = (m) => isObj(m) && str(m.situationId) && str(m.symbol) && seqOk(m.fromTickSeq ?? null) && seqOk(m.toTickSeq ?? null);
const momentArg = (m) => ({ situationId: m.situationId, symbol: m.symbol, fromTickSeq: m.fromTickSeq ?? null, toTickSeq: m.toTickSeq ?? null });

/**
 * CC-5 — the day, only when it is the caller's and the battle's attribution agent is the one named: `{ tape }` or null.
 * The attribution is the platform's resolver's rule (casualClone.js resolveRecordTargetId, which this read-only module
 * cannot import — its file writes; momentExcerpt.test.js pins this rule to it): a casual clone's battle attributes to
 * the parent its clone document names, read only when the clone document is the caller's own; a clone that resolves to
 * no parent attributes to no one here — nothing is ever answered under a clone (RK-1).
 */
async function ownedDayOf(db, { uid, attributionAgentId, battleId, etDate }) {
  let tape;
  try {
    tape = await readDayWith(READ, db, battleId, etDate);
  } catch {
    return null;
  }
  if (!isObj(tape) || tape.ownerId !== uid || tape.battleId !== battleId || tape.etDate !== etDate) return null;
  const battle = await readDoc(battleRef(db, battleId));
  if (!isObj(battle) || battle.ownerId !== uid || !idOk(battle.agentId)) return null;
  let target = battle.agentId;
  if (isCasualCloneId(target)) {
    const clone = await readDoc(db.collection(EXCERPT_PATHS.agents).doc(target));
    const parent = isObj(clone) && clone.ownerId === uid ? str(clone.rankedAgentId) : null;
    if (!parent || isCasualCloneId(parent)) return null;
    target = parent;
  }
  return target === attributionAgentId ? { tape } : null;
}

/** The day's one carried idea: the distinct `calls[].hypothesisRef` the day's calls name — exactly one, or none (two is ambiguous: none is guessed). */
function carriedIdeaOf(tape) {
  const calls = Array.isArray(tape.calls) ? tape.calls : [];
  const found = [];
  calls.forEach((c, i) => {
    const r = isObj(c) && isObj(c.hypothesisRef) ? c.hypothesisRef : null;
    if (!r || !str(r.watchlistId) || !Number.isInteger(r.hypothesisVersion) || r.hypothesisVersion < 1) return;
    if (!found.some((f) => f.watchlistId === r.watchlistId && f.hypothesisVersion === r.hypothesisVersion)) found.push({ watchlistId: r.watchlistId, hypothesisVersion: r.hypothesisVersion, i });
  });
  return found.length === 1 ? found[0] : null;
}

/**
 * The idea (spec §6): the label, the version (the tape's own class for `calls[].hypothesisRef.hypothesisVersion`), and
 * the version's statement as the player's words at the version's own `createdAt` — read once, only when the version is
 * the caller's (`userId`) and the one the ref names. A version that is another owner's: no idea at all. One that cannot
 * be read, or a statement over its bound: the idea without its statement.
 */
async function ideaOf(db, uid, tape) {
  const ref = carriedIdeaOf(tape);
  if (!ref || !idOk(ref.watchlistId)) return null;
  const P = EXCERPT_PATHS;
  const doc = await readDoc(db.collection(P.ideaLists).doc(ref.watchlistId).collection(P.ideaVersions).doc(P.ideaVersionDocId(ref.hypothesisVersion)));
  if (isObj(doc) && (doc.userId !== uid || doc.watchlistId !== ref.watchlistId || doc.version !== ref.hypothesisVersion)) return null;
  const idea = { label: EXCERPT_LABELS.idea };
  const version = classed(ref.hypothesisVersion, tape.numberClasses, ['calls', ref.i, 'hypothesisRef', 'hypothesisVersion']);
  if (version) idea.version = version;
  const statement = isObj(doc) ? boundedText(doc.statement, EXCERPT_BOUNDS.statement) : null;
  if (statement) idea.statement = quote(statement, 'player', instantOrNull(doc.createdAt));
  return { idea, watchlistId: ref.watchlistId };
}

/** The agent's words at the moment's first check, or the nearest earlier one (by the rows' recorded tickSeq; a row with none is no candidate). */
function rationaleOf(tape, m) {
  if (!Number.isInteger(m.fromTickSeq)) return null;
  let row = null;
  for (const r of Array.isArray(tape.rationale) ? tape.rationale : []) {
    if (!isObj(r) || !Number.isInteger(r.tickSeq) || r.tickSeq > m.fromTickSeq) continue;
    if (!row || r.tickSeq > row.tickSeq) row = r;
  }
  if (!row) return null;
  const at = instantOrNull(row.at);
  const hypothesis = boundedText(row.hypothesis, EXCERPT_BOUNDS.hypothesis);
  const rationale = boundedText(row.rationale, EXCERPT_BOUNDS.rationale);
  if (!hypothesis && !rationale) return null;
  return { ...(hypothesis ? { hypothesis: quote(hypothesis, 'agent', at) } : {}), ...(rationale ? { rationale: quote(rationale, 'agent', at) } : {}) };
}

/** The directive heard at a check inside the moment (the earliest heard, then the earliest filed): the player's words and the platform's canonical text, each its own quotation at the filing's time. */
function directiveOf(tape, m) {
  if (!Number.isInteger(m.fromTickSeq) || !Number.isInteger(m.toTickSeq)) return null;
  const rows = (Array.isArray(tape.directives) ? tape.directives : []).filter((d) => isObj(d) && isObj(d.heard) && Number.isInteger(d.heard.tickSeq) && d.heard.tickSeq >= m.fromTickSeq && d.heard.tickSeq <= m.toTickSeq);
  if (!rows.length) return null;
  const row = rows.reduce((a, b) => (b.heard.tickSeq < a.heard.tickSeq || (b.heard.tickSeq === a.heard.tickSeq && (msOf(b.filedAt) ?? Infinity) < (msOf(a.filedAt) ?? Infinity)) ? b : a));
  const at = instantOrNull(row.filedAt);
  const playerText = boundedText(row.playerText, EXCERPT_BOUNDS.playerText);
  const canonicalText = boundedText(row.canonicalText, EXCERPT_BOUNDS.canonicalText);
  if (!playerText && !canonicalText) return null;
  return { ...(playerText ? { playerText: quote(playerText, 'player', at) } : {}), ...(canonicalText ? { canonicalText: quote(canonicalText, 'platform', at) } : {}) };
}

/** The gameplan meeting whose life holds the moment — created at or before its first check, resolved (or expired) at or after its last; the earliest. */
function meetingOf(tape, m) {
  const fromMs = msOf(m.from);
  const toMs = msOf(m.to);
  if (fromMs === null || toMs === null) return null;
  const rows = (Array.isArray(tape.meetings) ? tape.meetings : []).filter((r) => {
    if (!isObj(r)) return false;
    const start = msOf(r.createdAt);
    const end = msOf(r.resolvedAt) ?? msOf(r.expiresAt);
    return start !== null && end !== null && start <= fromMs && end >= toMs;
  });
  if (!rows.length) return null;
  const row = rows.reduce((a, b) => (msOf(b.createdAt) < msOf(a.createdAt) ? b : a));
  const out = {};
  if (str(row.status)) out.outcome = recorded(row.status);
  const legs = (Array.isArray(row.legs) ? row.legs : [])
    .map((l) => (isObj(l) ? { ...(str(l.symbolOut) ? { symbolOut: l.symbolOut } : {}), ...(str(l.symbolIn) ? { symbolIn: l.symbolIn } : {}) } : {}))
    .filter((l) => Object.keys(l).length > 0);
  if (legs.length) out.legs = recorded(legs);
  const diagnosis = boundedText(row.diagnosis, EXCERPT_BOUNDS.diagnosis);
  if (diagnosis) out.diagnosis = quote(diagnosis, 'platform', instantOrNull(row.createdAt));
  return Object.keys(out).length ? out : null;
}

/**
 * The `actions[]` row that ends the run: a sale of the moment's symbol at the moment's last check, or at the first check
 * the day ran after it (its recorded tickSeq) — the holding left the book there. A sale later than that is not this
 * run's end; a row with no recorded tickSeq is not matched (no guess).
 */
function exitRowOf(tape, m) {
  if (!Number.isInteger(m.toTickSeq)) return null;
  const ran = (Array.isArray(tape.checks) ? tape.checks : []).filter((c) => isObj(c) && Number.isInteger(c.tickSeq) && !NON_CHECK_STATES.includes(c.state)).map((c) => c.tickSeq);
  const later = ran.filter((s) => s > m.toTickSeq);
  const next = later.length ? Math.min(...later) : null;
  const ends = [m.toTickSeq, ...(next === null ? [] : [next])];
  const actions = Array.isArray(tape.actions) ? tape.actions : [];
  let best = null;
  actions.forEach((a, i) => {
    if (!isObj(a) || a.symbolOut !== m.symbol || !ends.includes(a.tickSeq)) return;
    if (!best || a.tickSeq < best.row.tickSeq || (a.tickSeq === best.row.tickSeq && (msOf(a.at) ?? Infinity) < (msOf(best.row.at) ?? Infinity))) best = { row: a, i };
  });
  return best;
}

function exitOf(tape, hit) {
  const { row, i } = hit;
  const out = {};
  if (str(row.mechanism)) out.mechanism = recorded(row.mechanism);
  if (str(row.exitReason)) out.exitReason = recorded(row.exitReason);
  if (str(row.symbolOut)) out.sold = recorded(row.symbolOut);
  if (str(row.symbolIn)) out.bought = recorded(row.symbolIn);
  const price = classed(row.exitPrice, tape.numberClasses, ['actions', i, 'exitPrice']);
  if (price) out.exitPrice = price;
  return Object.keys(out).length ? out : null;
}

/**
 * After the exit: the sold symbol's own series document for the day (read once, only the caller's), its bars that START
 * after the exit's instant — the last one's close and time, with the series document's own class for a bar (its
 * `numberClasses`), and how many there are (derived). Absent when the series holds none.
 */
async function afterExitOf(db, uid, battleId, etDate, row) {
  const symbol = typeof row.symbolOut === 'string' && TICKER.test(row.symbolOut) ? row.symbolOut : null;
  const exitMs = msOf(row.at);
  if (!symbol || exitMs === null) return null;
  const series = await readDoc(tapeRef(db, battleId, etDate).collection(SERIES_SUBCOLLECTION).doc(symbol));
  if (!isObj(series) || series.ownerId !== uid || series.symbol !== symbol || !Array.isArray(series.bars)) return null;
  const after = [];
  series.bars.forEach((b, k) => { if (isObj(b) && msOf(b.t) !== null && msOf(b.t) > exitMs && typeof b.c === 'number' && Number.isFinite(b.c)) after.push({ b, k }); });
  if (!after.length) return null;
  const last = after.reduce((x, y) => (msOf(y.b.t) > msOf(x.b.t) ? y : x));
  const close = classed(last.b.c, series.numberClasses, ['bars', last.k, 'c']);
  if (!close) return null;
  return { close, closeAt: { value: last.b.t, class: close.class }, barsAfter: { value: after.length, class: 'derived' } };
}

/**
 * The count: `stalled`'s at the moment's last check — on the recorded basis the live rule's own record at that check
 * (`checks[].stagnation[sym].ticks`), on the recomputed basis the tagger's item there (`tags.items[].count`) — each with
 * its path's declared class (recorded, derived). Any other situation: its own item's count. Never a neighbouring check's.
 */
function countOf(tape, m) {
  if (!Number.isInteger(m.toTickSeq)) return null;
  const basis = isObj(tape.tags?.inputs?.holdingBasis) ? tape.tags.inputs.holdingBasis[m.symbol] : undefined;
  if (m.situationId === 'stalled' && basis === 'recorded') {
    const checks = Array.isArray(tape.checks) ? tape.checks : [];
    const k = checks.findIndex((c) => isObj(c) && c.tickSeq === m.toTickSeq);
    const rec = k >= 0 && isObj(checks[k].stagnation) ? checks[k].stagnation[m.symbol] : null;
    return isObj(rec) && Number.isInteger(rec.ticks) ? classed(rec.ticks, tape.numberClasses, ['checks', k, 'stagnation', m.symbol, 'ticks']) : null;
  }
  const items = Array.isArray(tape.tags?.items) ? tape.tags.items : [];
  const i = items.findIndex((it) => isObj(it) && it.situationId === m.situationId && it.symbol === m.symbol && it.tickSeq === m.toTickSeq);
  return i >= 0 && Number.isInteger(items[i].count) ? classed(items[i].count, tape.numberClasses, ['tags', 'items', i, 'count']) : null;
}

/** The card (spec §6, CC-2): its label, the question's text on the menu at its stored version, the route, the filed instant, and the note as the player's words. */
function cardOf(entry) {
  const card = { label: EXCERPT_LABELS.card };
  const q = SITUATION_QUESTIONS.find((x) => x.id === entry.questionId && x.situationId === entry.situationId && x.version === entry.questionVersion);
  if (q && str(q.text)) card.question = recorded(q.text);
  const route = str(entry.route) ? routeOf(entry.route) : null;
  if (str(route)) card.route = recorded(route);
  const filed = instantOrNull(entry.createdAt);
  if (filed) card.filed = recorded(filed);
  const note = boundedText(entry.note, EXCERPT_BOUNDS.note);
  return { card, note: note ? { text: note, at: filed } : null };
}

/** The excerpt itself, from the day the checks passed, its moment, and (for a card) the entry. */
async function buildExcerpt(db, { uid, battleId, etDate, tape, day, entry = null }) {
  const m = day.moment;
  const excerpt = { excerptVersion: MOMENT_EXCERPT_VERSION, battle: EXCERPT_LABELS.battle };
  const refs = { [EXCERPT_LABELS.battle]: battleId };
  excerpt.symbol = recorded(m.symbol);
  excerpt.situationId = recorded(m.situationId);
  const items = Array.isArray(tape.tags?.items) ? tape.tags.items : [];
  const first = items.findIndex((it) => isObj(it) && it.situationId === m.situationId && it.symbol === m.symbol && it.tickSeq === m.fromTickSeq && it.version === day.situationVersion);
  const version = first >= 0 ? classed(day.situationVersion, tape.numberClasses, ['tags', 'items', first, 'version']) : null;
  if (version) excerpt.situationVersion = version;
  if (instantOrNull(m.from)) excerpt.from = recorded(m.from);
  if (instantOrNull(m.to)) excerpt.to = recorded(m.to);
  excerpt.checks = { value: m.checks, class: 'derived' };
  const sector = sectorOf(m.symbol);
  if (sector) excerpt.sector = recorded(sector);
  const idea = await ideaOf(db, uid, tape);
  if (idea) { excerpt.idea = idea.idea; refs[EXCERPT_LABELS.idea] = idea.watchlistId; }
  const rationale = rationaleOf(tape, m);
  if (rationale) excerpt.rationale = rationale;
  const directive = directiveOf(tape, m);
  if (directive) excerpt.directive = directive;
  const meeting = meetingOf(tape, m);
  if (meeting) excerpt.meeting = meeting;
  const hit = exitRowOf(tape, m);
  const exit = hit ? exitOf(tape, hit) : null;
  if (exit) excerpt.exit = exit;
  const afterExit = hit ? await afterExitOf(db, uid, battleId, etDate, hit.row) : null;
  if (afterExit) excerpt.afterExit = afterExit;
  const count = countOf(tape, m);
  if (count) excerpt.count = count;
  if (entry) {
    const { card, note } = cardOf(entry);
    if (note) {
      card.note = quote(note.text, 'player', note.at);
      // CC-2: the card's one quoted excerpt, named as the input's — the same words, in a field of its own
      excerpt.inputQuote = quote(note.text, 'player', note.at);
    }
    excerpt.card = card;
    refs[EXCERPT_LABELS.card] = entry.entryId;
  }
  return { excerpt, refs };
}

/**
 * One game moment's excerpt — `{ excerpt, refs }`, or null (CC-5: not the caller's, not this agent's, not one of the
 * day's stored moments, unreadable, or a malformed argument — one answer for all).
 *
 * @param {object} db  the Admin SDK's Firestore (read only)
 * @param {{ uid: string, attributionAgentId: string, battleId: string, etDate: string,
 *           moment: { situationId: string, symbol: string, fromTickSeq: number|null, toTickSeq: number|null } }} p
 * @returns {Promise<{ excerpt: object, refs: object }|null>}
 */
export async function excerptOf(db, { uid, attributionAgentId, battleId, etDate, moment } = {}) {
  if (!idOk(uid) || !idOk(attributionAgentId) || !idOk(battleId) || !isEtDate(etDate) || !momentArgOk(moment)) return null;
  const owned = await ownedDayOf(db, { uid, attributionAgentId, battleId, etDate });
  if (!owned) return null;
  const day = judgeDay(owned.tape, uid, momentArg(moment));
  if (!day.ok) return null;
  return buildExcerpt(db, { uid, battleId, etDate, tape: owned.tape, day });
}

/**
 * One card's excerpt — through its filed source: the entry `agents/{attributionAgentId}/plays/{entryId}` (the caller's,
 * under that agent), the day it was filed from (the caller's, attributed to that agent), and the day check against what
 * it was filed under (CC-4). `{ excerpt, refs }`, or null — a card whose source changed included.
 *
 * @param {object} db  the Admin SDK's Firestore (read only)
 * @param {{ uid: string, attributionAgentId: string, entryId: string }} p
 * @returns {Promise<{ excerpt: object, refs: object }|null>}
 */
export async function excerptOfCard(db, { uid, attributionAgentId, entryId } = {}) {
  if (!idOk(uid) || !idOk(attributionAgentId) || !idOk(entryId)) return null;
  const P = EXCERPT_PATHS;
  const entry = await readDoc(db.collection(P.agents).doc(attributionAgentId).collection(P.plays).doc(entryId));
  if (!isObj(entry) || entry.ownerId !== uid || entry.agentId !== attributionAgentId || entry.entryId !== entryId) return null;
  const src = isObj(entry.source) ? entry.source : null;
  if (!src || !idOk(src.battleId) || !isEtDate(src.etDate)) return null;
  const moment = { situationId: entry.situationId, symbol: src.symbol, fromTickSeq: src.fromTickSeq ?? null, toTickSeq: src.toTickSeq ?? null };
  if (!momentArgOk(moment)) return null;
  const owned = await ownedDayOf(db, { uid, attributionAgentId, battleId: src.battleId, etDate: src.etDate });
  if (!owned) return null;
  const day = judgeFiledDay(owned.tape, uid, { moment, archetypeCodeId: entry.archetypeCodeId, situationVersion: entry.situationVersion });
  if (!day.ok) return null;
  return buildExcerpt(db, { uid, battleId: src.battleId, etDate: src.etDate, tape: owned.tape, day, entry });
}
