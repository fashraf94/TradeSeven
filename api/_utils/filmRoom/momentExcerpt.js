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
// when the battle is a casual clone's, the owner's clone document and the parent agent it names (the platform
// resolver's ownership guard); the one hypothesis version the battle carried (CD-8: named by the battle's own frozen
// carriage, from the battle document already read — no other lookup); the sold symbol's one series document; and for a
// card, its one `plays` entry. Every instant carried or compared is a strict ISO 8601 date-time on a real calendar
// (filmRoomSubject.js instantMs / instantText — CE-3). READ-ONLY BY CONSTRUCTION: no write call of any kind in
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
import { sectorOf, IDEA_STATEMENT_MAX, carriedIdeaOf, ideaFrom, instantText, instantMs, promptQuoteText, subjectKnownIds } from '../../../src/utils/filmRoomSubject.js';
import { tickerOk, situationIdOk, cardRouteOk, exitReasonOk, exitMechanismOk } from '../../../src/utils/promptBoundText.js';

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
/**
 * An instant carried into `excerpt`: a strict ISO 8601 date-time only (the shared rule) — never a looser string (§2 review
 * L1-1). Every time the excerpt COMPARES — the exit against the bars, every tie-break by time — is read
 * by the same strict parser, instantMs (CE-3): a time it refuses is no time, and nothing is inferred from it.
 */
const instantOrNull = instantText;
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
 * CE-4 — A TIE THE RULES DON'T SETTLE MEANS NOTHING IS SAID (Astra's C2-F4). Every selection below first finds the
 * candidates that tie at its selecting key (each `{ row, i }`, its stored row and index); then:
 *   oneOf       the tied candidates are compared on EVERY field the excerpt would take from them (`pick`: their raw
 *               stored values). Identical candidates count as one — the first of them in storage order answers, and
 *               every field it gives is the same for each (a number's class is its path's, whatever the index). Any
 *               disagreement leaves the tie unsettled: null, and the field — with every field that depends on it — is
 *               absent. A conflict never falls back to a neighbouring row.
 *   earliestBy  a tie the rules break by TIME (the filing, the sale) is broken only when EVERY tied candidate holds a
 *               strict instant (CE-3): the earliest instant's candidates, then oneOf. One without a strict time leaves
 *               the whole tie to oneOf — a time the parser refuses is never read as "later".
 * Array order is never a rule: a permutation of the stored rows never changes an answer.
 */
const tieKey = (values) => JSON.stringify(values, (_, x) => (x === undefined ? null : x));
function oneOf(tied, pick) {
  if (!tied.length) return null;
  const key = tieKey(pick(tied[0].row));
  return tied.every((t) => tieKey(pick(t.row)) === key) ? tied[0] : null;
}
function earliestBy(tied, timeOf, pick) {
  if (tied.length < 2) return oneOf(tied, pick);
  const ms = tied.map((t) => instantMs(timeOf(t.row)));
  if (ms.some((x) => x === null)) return oneOf(tied, pick);
  const first = Math.min(...ms);
  return oneOf(tied.filter((_, j) => ms[j] === first), pick);
}
/** A section's rows that `keep` admits, each with its stored index. */
const candidatesOf = (list, keep) => (Array.isArray(list) ? list : []).map((row, i) => ({ row, i })).filter(({ row }) => keep(row));

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
    if (!parent || isCasualCloneId(parent) || !idOk(parent)) return null;
    // the platform's async resolver's guard (casualClone.js resolveAttributionAgentId, review CONFIRMED-1): the parent
    // must be the clone owner's own agent — a clone naming another owner's agent attributes to no one here (§2 review L1-7)
    const parentDoc = await readDoc(db.collection(EXCERPT_PATHS.agents).doc(parent));
    if (!isObj(parentDoc) || parentDoc.ownerId !== uid) return null;
    target = parent;
  }
  return target === attributionAgentId ? { tape, battle } : null;
}

/**
 * The idea (spec §6; Amendment D CD-8, Amendment E CE-5): the label, the version and the version's statement as the
 * player's words at the version's own `createdAt` — the idea the BATTLE carried (its frozen carriage, on the battle
 * document ownedDayOf already read: no other lookup, and never the day's calls), its version document read once, then
 * read by the ONE reading the screen's subject line shares (filmRoomSubject.js ideaFrom): the carried number
 * `recorded`; the document only when it is the caller's and agrees with the carriage's list, version and content hash
 * (another owner's or a contradicting one: no idea at all; one missing or that cannot be read, or a statement over its
 * bound or holding an id: the idea without its statement). No carriage (a tournament battle has none): no idea.
 */
async function ideaOf(db, uid, battle, knownIds) {
  const ref = carriedIdeaOf(battle);
  if (!ref || !idOk(ref.watchlistId)) return null;
  const P = EXCERPT_PATHS;
  const doc = await readDoc(db.collection(P.ideaLists).doc(ref.watchlistId).collection(P.ideaVersions).doc(P.ideaVersionDocId(ref.hypothesisVersion)));
  const found = ideaFrom(battle, doc, uid, knownIds);
  if (!found) return null;
  const idea = { label: EXCERPT_LABELS.idea };
  if (found.version) idea.version = found.version;
  if (found.statement) idea.statement = quote(found.statement, 'player', found.statementAt);
  return { idea, watchlistId: ref.watchlistId };
}

/**
 * The agent's words at the moment's first check, or the nearest earlier one (by the rows' recorded tickSeq; a row with
 * none is no candidate). Rows tied at that tickSeq that disagree on the words or their time: no rationale (CE-4) — never
 * the next-nearest row.
 */
function rationaleOf(tape, m, knownIds) {
  if (!Number.isInteger(m.fromTickSeq)) return null;
  const rows = candidatesOf(tape.rationale, (r) => isObj(r) && Number.isInteger(r.tickSeq) && r.tickSeq <= m.fromTickSeq);
  if (!rows.length) return null;
  const nearest = Math.max(...rows.map((c) => c.row.tickSeq));
  const hit = oneOf(rows.filter((c) => c.row.tickSeq === nearest), (r) => [r.hypothesis, r.rationale, r.at]);
  if (!hit) return null;
  const row = hit.row;
  const at = instantOrNull(row.at);
  const hypothesis = promptQuoteText(row.hypothesis, EXCERPT_BOUNDS.hypothesis, knownIds);
  const rationale = promptQuoteText(row.rationale, EXCERPT_BOUNDS.rationale, knownIds);
  if (!hypothesis && !rationale) return null;
  return { ...(hypothesis ? { hypothesis: quote(hypothesis, 'agent', at) } : {}), ...(rationale ? { rationale: quote(rationale, 'agent', at) } : {}) };
}

/**
 * The directive heard at a check inside the moment — the earliest heard (CD-7), then the earliest filed, by strict
 * instants only (CE-3, CE-4): the player's words and the platform's canonical text, each its own quotation at the
 * filing's time. A tie still standing, whose candidates disagree: no directive.
 */
function directiveOf(tape, m, knownIds) {
  if (!Number.isInteger(m.fromTickSeq) || !Number.isInteger(m.toTickSeq)) return null;
  const rows = candidatesOf(tape.directives, (d) => isObj(d) && isObj(d.heard) && Number.isInteger(d.heard.tickSeq) && d.heard.tickSeq >= m.fromTickSeq && d.heard.tickSeq <= m.toTickSeq);
  if (!rows.length) return null;
  const heard = Math.min(...rows.map((c) => c.row.heard.tickSeq));
  const hit = earliestBy(rows.filter((c) => c.row.heard.tickSeq === heard), (r) => r.filedAt, (r) => [r.playerText, r.canonicalText, r.filedAt]);
  if (!hit) return null;
  const row = hit.row;
  const at = instantOrNull(row.filedAt);
  const playerText = promptQuoteText(row.playerText, EXCERPT_BOUNDS.playerText, knownIds);
  const canonicalText = promptQuoteText(row.canonicalText, EXCERPT_BOUNDS.canonicalText, knownIds);
  if (!playerText && !canonicalText) return null;
  return { ...(playerText ? { playerText: quote(playerText, 'player', at) } : {}), ...(canonicalText ? { canonicalText: quote(canonicalText, 'platform', at) } : {}) };
}

/*
 * NO MEETING (Build C Amendment D, CD-16): the excerpt carries no `meeting` field. The tape copies its meetings from the
 * battle's gameplan meeting history, which the battle's OWNER may update (firestore.rules, the agentBattles update
 * allowlist) — so an outcome, legs or a "platform" diagnosis could be words the owner wrote, carried into a model call
 * as recorded facts and as the platform's speech. Every other field comes from a server-written record. The block can
 * return in a later excerpt version, once meetings are server-written. The tape's meetings are not read here at all.
 */

/**
 * The `actions[]` row that ends the run: a sale of the moment's symbol at the moment's last check, or at the first check
 * the day ran after it (its recorded tickSeq) — the holding left the book there. A sale later than that is not this
 * run's end; a row with no recorded tickSeq is not matched (no guess). Of sales at the same check, the earliest by strict
 * instant (CE-3); a tie still standing whose sales disagree is no exit — and so no afterExit — never the next check's
 * sale (CE-4).
 */
function exitRowOf(tape, m) {
  if (!Number.isInteger(m.toTickSeq)) return null;
  const ran = (Array.isArray(tape.checks) ? tape.checks : []).filter((c) => isObj(c) && Number.isInteger(c.tickSeq) && !NON_CHECK_STATES.includes(c.state)).map((c) => c.tickSeq);
  const later = ran.filter((s) => s > m.toTickSeq);
  const next = later.length ? Math.min(...later) : null;
  const ends = [m.toTickSeq, ...(next === null ? [] : [next])];
  const sales = candidatesOf(tape.actions, (a) => isObj(a) && a.symbolOut === m.symbol && ends.includes(a.tickSeq));
  if (!sales.length) return null;
  const at = Math.min(...sales.map((c) => c.row.tickSeq));
  return earliestBy(sales.filter((c) => c.row.tickSeq === at), (r) => r.at, (r) => [r.mechanism, r.exitReason, r.symbolOut, r.symbolIn, r.exitPrice, r.at]);
}

function exitOf(tape, hit) {
  const { row, i } = hit;
  const out = {};
  // CE-1: each recorded word inside its own domain — the writer's table of reasons and mechanisms (its `unrecorded`
  // sentinel for a missing reason is no mechanism: a missing part is absent, §2 review L1-4) and the ticker shape
  if (exitMechanismOk(row.mechanism)) out.mechanism = recorded(row.mechanism);
  if (exitReasonOk(row.exitReason)) out.exitReason = recorded(row.exitReason);
  if (tickerOk(row.symbolOut)) out.sold = recorded(row.symbolOut);
  if (tickerOk(row.symbolIn)) out.bought = recorded(row.symbolIn);
  const price = classed(row.exitPrice, tape.numberClasses, ['actions', i, 'exitPrice']);
  if (price) out.exitPrice = price;
  return Object.keys(out).length ? out : null;
}

/**
 * After the exit: the sold symbol's own series document for the day (read once, only the caller's), its bars that START
 * after the exit's STRICT instant (CE-3: an exit with no strict instant has no afterExit — its tickSeq places it among the
 * checks, never among the bars) — the last one's close, and that bar's own recorded time, its START (`bars[].t`, the
 * beginning of its 10-minute bucket: named `barStart`, never the close's instant — §2 review L1-5), each with the
 * series document's own class for a bar (its `numberClasses`), and how many there are (derived). Absent when none.
 * A bar is a row with a strict start after the exit; CE-4: `barsAfter` counts DISTINCT starts (an identical duplicate
 * counts once), and rows at the latest start that disagree — or whose close is no classed number — give no afterExit,
 * never an earlier bar's.
 */
async function afterExitOf(db, uid, battleId, etDate, row) {
  const symbol = tickerOk(row.symbolOut) ? row.symbolOut : null;
  const exitMs = instantMs(row.at);
  if (!symbol || exitMs === null) return null;
  const series = await readDoc(tapeRef(db, battleId, etDate).collection(SERIES_SUBCOLLECTION).doc(symbol));
  if (!isObj(series) || series.ownerId !== uid || series.symbol !== symbol || !Array.isArray(series.bars)) return null;
  const after = candidatesOf(series.bars, (b) => isObj(b) && instantMs(b.t) !== null && instantMs(b.t) > exitMs);
  if (!after.length) return null;
  const starts = new Set(after.map((c) => instantMs(c.row.t)));
  const latest = Math.max(...starts);
  const last = oneOf(after.filter((c) => instantMs(c.row.t) === latest), (b) => [b.t, b.c]);
  if (!last) return null;
  const close = classed(last.row.c, series.numberClasses, ['bars', last.i, 'c']);
  if (!close) return null;
  return { close, barStart: { value: last.row.t, class: close.class }, barsAfter: { value: starts.size, class: 'derived' } };
}

/**
 * The count: `stalled`'s at the moment's last check — on the recorded basis the live rule's own record at that check
 * (`checks[].stagnation[sym].ticks`), on the recomputed basis the tagger's item there (`tags.items[].count`) — each with
 * its path's declared class (recorded, derived). Any other situation: its own item's count. Never a neighbouring check's.
 * CE-4: checks (or items) at that last check that disagree on the count give no count.
 */
function countOf(tape, m) {
  if (!Number.isInteger(m.toTickSeq)) return null;
  const basis = isObj(tape.tags?.inputs?.holdingBasis) ? tape.tags.inputs.holdingBasis[m.symbol] : undefined;
  if (m.situationId === 'stalled' && basis === 'recorded') {
    const recOf = (c) => (isObj(c.stagnation) && isObj(c.stagnation[m.symbol]) ? c.stagnation[m.symbol] : null);
    const hit = oneOf(candidatesOf(tape.checks, (c) => isObj(c) && c.tickSeq === m.toTickSeq), (c) => [recOf(c)?.ticks]);
    const rec = hit ? recOf(hit.row) : null;
    return isObj(rec) && Number.isInteger(rec.ticks) ? classed(rec.ticks, tape.numberClasses, ['checks', hit.i, 'stagnation', m.symbol, 'ticks']) : null;
  }
  const hit = oneOf(candidatesOf(tape.tags?.items, (it) => isObj(it) && it.situationId === m.situationId && it.symbol === m.symbol && it.tickSeq === m.toTickSeq), (it) => [it.count]);
  return hit && Number.isInteger(hit.row.count) ? classed(hit.row.count, tape.numberClasses, ['tags', 'items', hit.i, 'count']) : null;
}

/**
 * The card (spec §6, CC-2): its label, the question's text on the menu at its stored version, the route and the filed
 * instant — and, apart from it, the note as the player's words: CD-14, the note's ONE home is `inputQuote` (W-06's one
 * quotation per input is the shape's, not the assembler's to remember); `card` carries no note.
 */
function cardOf(entry, knownIds) {
  const card = { label: EXCERPT_LABELS.card };
  const q = SITUATION_QUESTIONS.find((x) => x.id === entry.questionId && x.situationId === entry.situationId && x.version === entry.questionVersion);
  if (q && str(q.text)) card.question = recorded(q.text);
  const route = str(entry.route) ? routeOf(entry.route) : null;
  if (cardRouteOk(route)) card.route = recorded(route);   // CE-1: a route outside CARD_ROUTES is absent
  const filed = instantOrNull(entry.createdAt);
  if (filed) card.filed = recorded(filed);
  const note = promptQuoteText(entry.note, EXCERPT_BOUNDS.note, knownIds);
  return { card, note: note ? { text: note, at: filed } : null };
}

/**
 * CE-1 — the ids this excerpt KNOWS: a quotation holding any of them is left out whole (the policy's item 1; the shapes
 * the platform mints are its item 2, promptBoundText.js) — by the ONE rule the screen's subject line uses too
 * (filmRoomSubject.js subjectKnownIds): the owner's uid, the battle, the battle's own agent, the attribution agent, and
 * for a card its entry, its agent, its op id, its nomination's book and id. The idea's list joins in ideaFrom.
 */
const knownIdsOf = ({ uid, battleId, battle, attributionAgentId, watchlistId, entry }) => subjectKnownIds({ ownerId: uid, battleId, battleAgentId: isObj(battle) ? battle.agentId : null, attributionAgentId, watchlistId, card: entry });

/** The excerpt itself, from the day the checks passed, its moment, and (for a card) the entry. */
async function buildExcerpt(db, { uid, attributionAgentId, battleId, etDate, tape, battle, day, entry = null }) {
  const m = day.moment;
  // the idea's list is known to every quotation, not the statement alone (CE-1 item 1)
  const knownIds = knownIdsOf({ uid, battleId, battle, attributionAgentId, watchlistId: carriedIdeaOf(battle)?.watchlistId ?? null, entry });
  const excerpt = { excerptVersion: MOMENT_EXCERPT_VERSION, battle: EXCERPT_LABELS.battle };
  const refs = { [EXCERPT_LABELS.battle]: battleId };
  // CE-1: the moment's own recorded words, each inside its domain — a symbol of the ticker shape, a registered situation
  if (tickerOk(m.symbol)) excerpt.symbol = recorded(m.symbol);
  if (situationIdOk(m.situationId)) excerpt.situationId = recorded(m.situationId);
  const items = Array.isArray(tape.tags?.items) ? tape.tags.items : [];
  const first = items.findIndex((it) => isObj(it) && it.situationId === m.situationId && it.symbol === m.symbol && it.tickSeq === m.fromTickSeq && it.version === day.situationVersion);
  const version = first >= 0 ? classed(day.situationVersion, tape.numberClasses, ['tags', 'items', first, 'version']) : null;
  if (version) excerpt.situationVersion = version;
  if (instantOrNull(m.from)) excerpt.from = recorded(m.from);
  if (instantOrNull(m.to)) excerpt.to = recorded(m.to);
  excerpt.checks = { value: m.checks, class: 'derived' };
  const sector = sectorOf(m.symbol);
  if (sector) excerpt.sector = recorded(sector);
  const idea = await ideaOf(db, uid, battle, knownIds);
  if (idea) { excerpt.idea = idea.idea; refs[EXCERPT_LABELS.idea] = idea.watchlistId; }
  const rationale = rationaleOf(tape, m, knownIds);
  if (rationale) excerpt.rationale = rationale;
  const directive = directiveOf(tape, m, knownIds);
  if (directive) excerpt.directive = directive;
  const hit = exitRowOf(tape, m);
  const exit = hit ? exitOf(tape, hit) : null;
  if (exit) excerpt.exit = exit;
  const afterExit = hit ? await afterExitOf(db, uid, battleId, etDate, hit.row) : null;
  if (afterExit) excerpt.afterExit = afterExit;
  const count = countOf(tape, m);
  if (count) excerpt.count = count;
  if (entry) {
    const { card, note } = cardOf(entry, knownIds);
    // CC-2, CD-14: the card's one quoted excerpt, the input's — its only home
    if (note) excerpt.inputQuote = quote(note.text, 'player', note.at);
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
export async function excerptOf(db, args) {
  // CE-6: the argument checked before it is read — null, an array, a string: the same null as any malformed argument
  if (!isObj(args)) return null;
  const { uid, attributionAgentId, battleId, etDate, moment } = args;
  if (!idOk(uid) || !idOk(attributionAgentId) || !idOk(battleId) || !isEtDate(etDate) || !momentArgOk(moment)) return null;
  const owned = await ownedDayOf(db, { uid, attributionAgentId, battleId, etDate });
  if (!owned) return null;
  const day = judgeDay(owned.tape, uid, momentArg(moment));
  if (!day.ok) return null;
  return buildExcerpt(db, { uid, attributionAgentId, battleId, etDate, tape: owned.tape, battle: owned.battle, day });
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
export async function excerptOfCard(db, args) {
  if (!isObj(args)) return null;   // CE-6, as excerptOf
  const { uid, attributionAgentId, entryId } = args;
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
  return buildExcerpt(db, { uid, attributionAgentId, battleId: src.battleId, etDate: src.etDate, tape: owned.tape, battle: owned.battle, day, entry });
}
