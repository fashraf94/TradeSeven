// scripts/census-film-room-b1.mjs
//
// Film Room B1 — the READ-ONLY census for the shared contract's acceptance A
// and B (build prompt §2; report docs/audits/20261012_BUILD_FILM_ROOM_B1.md).
// It runs the new tagger (api/_utils/filmTape/tapeTags.js) IN MEMORY over
// every stored tape day, reading the tape, the battle and — for a battle with
// a tempo dial — the day's ticks, and prints COUNTS ONLY: owners and battles
// are labelled by order of appearance, never by id.
//
//   A. On the 9 Oct tape day the weak holding (ACN) is tagged `stalled` before
//      the platform's stagnation exit at 15:01 ET.
//   B. Every recorded stagnation exit on a taped day is preceded by a `stalled`
//      tag for that holding — the exits, those preceded, the mismatches, and
//      each mismatch's reason class (never hidden).
//
// It also counts what the build report needs: the evidence stamp on each check
// state (no_trigger above all), tiered days whose battle has no opponent (T1),
// the meetings the writer would copy and the leg symbols they would add to the
// candle pass (T2: the EODHD calls), meetings filed on a later day than
// created, timelines the validated reading would change (W2), closed-out days
// whose notes still say a candle pass is coming (W1), and notes in the pre-W4
// wording (W4) — the last three are what the founder's refresh will change.
//
// READ-ONLY BY CONSTRUCTION, behind the same write-grep gate the Practice
// Field discovery used (docs/audits/20261010_PHASE0_PRACTICE_FIELD_DISCOVERY.md
// §0.2): before anything else main() greps this file and the tagger it runs for
// a Firestore write call and refuses to run on any match (exit 3). Every
// Firestore access is a get, a query or a getAll; plain objects and arrays
// only (the gate would read a Map's or a Set's mutators as writes). The gate
// reads this file and the tagger; the other local modules the script loads
// (the tape writer's pure helpers, the registry, the constants) are handed
// plain data only — the Firestore handle is created inside main() from a
// dynamic import and never leaves it, so no imported module can write through it.
// scripts/census-film-room-b1.test.js runs the same gate and the core on
// fixture days. Credentials load only inside main(): the same lookup the
// growth replay uses (scripts/experiments/growth-replay/growthReplay.js
// loadEnv / serviceAccount) — the environment, then this tree's .env.local,
// then the primary checkout's; values are never printed.
//
// USAGE (repo root; the founder or a session with the credential):
//   node scripts/census-film-room-b1.mjs [--json <path>]

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tagTapeDay, tagInputs, tagDay, unpricedHeld } from '../api/_utils/filmTape/tapeTags.js';
import { buildMeetings } from '../api/_utils/filmTape/tapeAssemble.js';
import { symbolPlan } from '../api/_utils/filmTape/candleInputs.js';
import { modernNotes } from '../api/_utils/filmTape/tapeNotes.js';
import { etDayBounds, withinCandleWindow, toMs } from '../api/_utils/filmTape/tapeTime.js';
import { tradingTimeline } from '../src/utils/tapeSchedule.js';
import { TEMPO_DIAL_ENABLED } from '../src/config/featureFlags.js';
import { AWAITING_CANDLES_NOTE } from '../src/constants/filmTape.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

// ── the gate ────────────────────────────────────────────────────────────────

const join = (...parts) => parts.join('');
/** The discovery's §0.2 grep, as a pattern (its tokens assembled, so this line never matches itself). */
export const WRITE_PATTERN = new RegExp(`\\.(set|update|delete|add|create)\\s*\\(|${join('run', 'Transaction')}|\\.batch\\(|${join('bulk', 'Writer')}|${join('write', 'Batch')}|${join('Field', 'Value')}|${join('recursive', 'Delete')}`);
/** The files the gate reads: this script and the tagger it runs over production data. */
export const GATED_FILES = Object.freeze(['scripts/census-film-room-b1.mjs', 'api/_utils/filmTape/tapeTags.js']);
/** `[line, text]` for every line of `source` the pattern matches. */
export const writeCallsIn = (source) => String(source).split(/\r?\n/).map((text, i) => [i + 1, text]).filter(([, text]) => WRITE_PATTERN.test(text));

// ── the core (pure) ─────────────────────────────────────────────────────────

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const rows = (v) => (Array.isArray(v) ? v.filter(isObj) : []);
const bump = (o, k, by = 1) => { o[k] = (o[k] ?? 0) + by; };
const ET_CLOCK = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });
const etClock = (at) => (toMs(at) === null ? null : ET_CLOCK.format(new Date(toMs(at))));
const ET_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
const etDate = (at) => (toMs(at) === null ? null : ET_DATE.format(new Date(toMs(at))));
const CLOSE_SECTIONS = ['checks', 'actions', 'directives', 'plans', 'calls', 'rationale', 'evidence'];

/** `agentBattles/{battleId}/tape/{etDate}` → its ids, or null for any other shape. */
export function tapeIdsOf(p) {
  const m = /^agentBattles\/([^/]+)\/tape\/(\d{4}-\d{2}-\d{2})$/.exec(String(p));
  return m ? { battleId: m[1], etDate: m[2] } : null;
}

/** An exit's stint: the checks after the last swap that brought its symbol in (or the day's start), before the exit. */
function stintRows(trace, actions, exit) {
  const exitMs = toMs(exit.at);
  const ins = rows(actions).filter((a) => a.symbolIn === exit.symbol && toMs(a.at) !== null && toMs(a.at) < exitMs).map((a) => toMs(a.at));
  const since = ins.length ? Math.max(...ins) : -Infinity;
  return trace.filter((t) => t.symbol === exit.symbol && toMs(t.at) !== null && toMs(t.at) < exitMs && toMs(t.at) > since);
}

/**
 * The census over plain documents.
 *
 * @param {object} p
 * @param {{ path: string, data: object }[]} p.tapes      every stored tape document, with its path
 * @param {Record<string, object>} p.battles              battle documents by id
 * @param {Record<string, object[]>} [p.ticks]            the day's ticks by `${battleId}|${etDate}` (battles with a dial)
 * @param {boolean} p.dialEnabled                         the dial flag the tagger runs with (the writer's)
 * @param {number} p.nowMs
 * @param {{ etDate: string, symbol: string, etClock: string }} [p.acceptanceA]
 */
export function computeB1Census({ tapes, battles, ticks = {}, dialEnabled, nowMs, acceptanceA = { etDate: '2026-10-09', symbol: 'ACN', etClock: '15:01' } }) {
  const out = {
    tapes: { total: 0, invalidPath: 0, byCloseStatus: {}, writtenTiered: 0, battlesTaped: 0, owners: 0, days: 0 },
    tags: { tagged: 0, unavailable: 0, unavailableReasons: {}, coverage: {}, items: 0, unknownArchetypes: {}, dialBases: {} },
    B: { exits: 0, preceded: 0, notPreceded: 0, unknown: 0, mismatchClass: {}, mismatchFlags: {} },
    A: { etDate: acceptanceA.etDate, symbol: acceptanceA.symbol, exitsFound: [], verdict: 'NOT_FOUND' },
    evidence: { byState: {} },
    T1: { tieredNoOpponent: 0, tieredNoOpponentWithZeroLastCheck: 0 },
    T2: { meetings: 0, byStatus: {}, legs: 0, tapesWithNewSymbols: 0, newSymbolsPerTape: 0, newSymbolDayPairs: 0, perMeeting: [], filedLaterDay: {}, refreshExpires: 0, refreshRequeues: 0, notCopiedNotes: 0 },
    W1: { terminalWithAwaitingNote: 0 },
    W2: { battlesWithDroppedEntries: 0, ofThemTaped: 0 },
    W4: { tapesWithOldWording: 0 },
  };
  const ownerLabel = {};
  const battleLabel = {};
  const label = (map, id, prefix) => { if (!(id in map)) map[id] = `${prefix} #${Object.keys(map).length + 1}`; return map[id]; };
  const valid = [];
  for (const t of tapes) {
    out.tapes.total += 1;
    const ids = tapeIdsOf(t.path);
    if (!ids || !isObj(t.data)) { out.tapes.invalidPath += 1; continue; }
    bump(out.tapes.byCloseStatus, t.data.passes?.close?.status ?? 'none');
    valid.push({ ...ids, data: t.data });
  }
  valid.sort((a, b) => (a.etDate < b.etDate ? -1 : a.etDate > b.etDate ? 1 : (a.battleId < b.battleId ? -1 : 1)));
  const days = {};
  // the candle symbol set of each day, across every tape (the candle pass memoises a symbol per day across tapes)
  const daySymbols = {};
  const written = valid.filter((v) => v.data.passes?.close?.status === 'written' && Array.isArray(v.data.checks));
  for (const v of written) {
    daySymbols[v.etDate] = daySymbols[v.etDate] ?? {};
    for (const e of symbolPlan({ ...v.data, meetings: [] })) daySymbols[v.etDate][e.symbol] = true;
  }
  const newPairs = {};
  const seedByBattle = {};
  for (const v of written) {
    const { battleId, data: tape } = v;
    const battle = battles[battleId] ? { id: battleId, ...battles[battleId] } : null;
    out.tapes.writtenTiered += 1;
    days[v.etDate] = true;
    label(battleLabel, battleId, 'battle');
    if (tape.ownerId) label(ownerLabel, tape.ownerId, 'owner');
    if (!battle) { bump(out.tags.unavailableReasons, 'battle document unreadable'); out.tags.unavailable += 1; continue; }

    // evidence stamp per check state
    let prevAt = null;
    for (const c of rows(tape.checks)) {
      const s = out.evidence.byState[c.state] ?? (out.evidence.byState[c.state] = { checks: 0, withEvidence: 0, withHeldPx: 0, heldWithoutPx: 0 });
      s.checks += 1;
      const held = Object.keys(isObj(c.risk) ? c.risk : {});
      const unpriced = unpricedHeld(c, { actions: tape.actions, prevAt });
      if (isObj(c.evidence)) s.withEvidence += 1;
      if (held.length && !unpriced.length) s.withHeldPx += 1;
      if (unpriced.length) s.heldWithoutPx += 1;
      if (c.at) prevAt = c.at;
    }

    // T1
    if (!isObj(battle.opponent)) {
      out.T1.tieredNoOpponent += 1;
      if (tape.score?.lastCheck?.opponent === 0) out.T1.tieredNoOpponentWithZeroLastCheck += 1;
    }

    // tags, as the close pass would write them over this stored day
    const dayTicks = ticks[`${battleId}|${v.etDate}`] ?? [];
    const { tags, coverage } = tagTapeDay({ battle, ticks: dayTicks, doc: tape, dialEnabled });
    bump(out.tags.coverage, coverage.status);
    if (tags.items === null) {
      out.tags.unavailable += 1;
      bump(out.tags.unavailableReasons, coverage.note);
      const arch = battle.agentContext?.archetype ?? '(none)';
      if (/unknown archetype|no archetype/.test(coverage.note)) bump(out.tags.unknownArchetypes, String(arch));
    } else {
      out.tags.tagged += 1;
      out.tags.items += tags.items.length;
      for (const pc of tags.inputs.perCheck) bump(out.tags.dialBases, pc.basis);
    }

    // B, with a trace and the overnight-seeded rerun for the classes
    const inputsR = tagInputs({ battle, checks: tape.checks, ticks: dayTicks, dialEnabled });
    const trace = [];
    let seeded = null;
    if (inputsR.ok) {
      tagDay({ inputs: inputsR.inputs, checks: tape.checks, actions: tape.actions, trace });
      const prev = seedByBattle[battleId];
      seeded = tagDay({ inputs: inputsR.inputs, checks: tape.checks, actions: tape.actions, seed: prev?.closing ?? null });
      // the seeded chain: this day's seeded closing carries to the next taped day of the battle
      seedByBattle[battleId] = { etDate: v.etDate, closing: seeded.closing };
    }
    for (const x of tags.exits ?? []) {
      out.B.exits += 1;
      if (x.precededByTag === true) { out.B.preceded += 1; continue; }
      if (x.precededByTag === null) { out.B.unknown += 1; bump(out.B.mismatchClass, 'tagger_unavailable'); continue; }
      out.B.notPreceded += 1;
      const stint = stintRows(trace, tape.actions, x);
      const exitMs = toMs(x.at);
      const sinceIn = Math.max(-Infinity, ...rows(tape.actions).filter((a) => a.symbolIn === x.symbol && toMs(a.at) !== null && toMs(a.at) < exitMs).map((a) => toMs(a.at)));
      const flags = {
        // a tag of the holding in its stint, but before a reset of its count: the run that ended in the exit had none
        tag_before_reset: (tags.items ?? []).some((it) => it.symbol === x.symbol && toMs(it.at) > sinceIn && toMs(it.at) < exitMs),
        count_carried_overnight: Boolean(seeded?.exits?.find((s) => s.at === x.at && s.symbol === x.symbol)?.precededByTag),
        no_price_pause: stint.some((r) => r.px === null),
        winner_basis: stint.some((r) => !r.fired && r.px !== null && r.chg !== null && r.count >= r.liveAt && r.chg / 100 >= r.winnerThreshold),
      };
      for (const [k, on] of Object.entries(flags)) if (on) bump(out.B.mismatchFlags, k);
      const cls = flags.count_carried_overnight ? 'count_carried_overnight' : flags.no_price_pause ? 'no_price_pause' : flags.winner_basis ? 'winner_basis' : 'other';
      bump(out.B.mismatchClass, cls);
    }

    // A
    if (v.etDate === acceptanceA.etDate) {
      for (const x of (tags.exits ?? []).filter((e) => e.symbol === acceptanceA.symbol)) {
        const items = (tags.items ?? []).filter((i) => i.symbol === acceptanceA.symbol).map((i) => ({ at: etClock(i.at), count: i.count, threshold: i.effectiveTicksThreshold }));
        const walk = trace.filter((r) => r.symbol === acceptanceA.symbol).map((r) => ({ at: etClock(r.at), px: r.px === null ? 'none' : 'priced', count: r.count, liveAt: r.liveAt, fired: r.fired, reset: r.reset }));
        out.A.exitsFound.push({ battle: battleLabel[battleId], exitAt: etClock(x.at), precededByTag: x.precededByTag, items, walk });
      }
    }

    // T2 — the meetings the writer copies for this day, and the leg symbols the candle pass would add
    const bounds = etDayBounds(v.etDate);
    const meetings = buildMeetings({ battle, bounds });
    if (meetings.coverage.note) out.T2.notCopiedNotes += 1;
    // what T2 ADDS: the leg symbols against the day's set without any meeting (a stored day may or may not carry them yet)
    const plan = {};
    for (const e of symbolPlan({ ...tape, meetings: [] })) plan[e.symbol] = true;
    let added = 0;
    for (const m of meetings.rows) {
      out.T2.meetings += 1;
      bump(out.T2.byStatus, m.status);
      let mine = 0;
      for (const leg of m.legs) {
        out.T2.legs += 1;
        for (const s of [leg.symbolOut, leg.symbolIn]) {
          if (typeof s !== 'string' || plan[s]) continue;
          plan[s] = true;
          added += 1;
          mine += 1;
          if (!daySymbols[v.etDate][s] && !newPairs[`${s}|${v.etDate}`]) { newPairs[`${s}|${v.etDate}`] = true; out.T2.newSymbolDayPairs += 1; }
        }
      }
      out.T2.perMeeting.push({ battle: battleLabel[battleId], etDate: v.etDate, status: m.status, legs: m.legs.length, newSymbols: mine });
    }
    if (added) {
      out.T2.tapesWithNewSymbols += 1;
      out.T2.newSymbolsPerTape += added;
      const c = tape.passes?.candles;
      if (c?.status === 'written' && !withinCandleWindow(v.etDate, nowMs)) out.T2.refreshExpires += 1;
      if (withinCandleWindow(v.etDate, nowMs) && ['written', 'partial', 'failed'].includes(c?.status)) out.T2.refreshRequeues += 1;
    }

    // W1
    if (['expired', 'exhausted'].includes(tape.passes?.candles?.status)
      && ['replay', 'series'].some((s) => String(tape.coverage?.[s]?.note ?? '').split('; ').some((part) => part === AWAITING_CANDLES_NOTE || part.includes('awaiting the next candle pass')))) out.W1.terminalWithAwaitingNote += 1;

    // W4
    const texts = CLOSE_SECTIONS.flatMap((s) => [tape.coverage?.[s]?.note, ...(Array.isArray(tape.coverage?.[s]?.caveats) ? tape.coverage[s].caveats : [])]).filter((x) => typeof x === 'string');
    if (texts.some((x) => modernNotes(x) !== x)) out.W4.tapesWithOldWording += 1;
  }

  // meetings filed on a later ET day than created, across every taped battle's whole history
  for (const id of Object.keys(battleLabel)) {
    for (const m of rows(battles[id]?.gameplanMeetingHistory)) {
      const created = etDate(m.createdAt);
      const resolved = etDate(m.resolvedAt);
      if (created && resolved && resolved > created) bump(out.T2.filedLaterDay, String(m.status));
    }
  }

  // W2
  const tapedBattles = {};
  for (const v of valid) tapedBattles[v.battleId] = true;
  for (const [id, b] of Object.entries(battles)) {
    const timeline = b?.timing?.tradingDays;
    const read = tradingTimeline(b);
    if (Array.isArray(timeline) && read && read.length !== timeline.length) {
      out.W2.battlesWithDroppedEntries += 1;
      if (tapedBattles[id]) out.W2.ofThemTaped += 1;
    }
  }

  out.tapes.battlesTaped = Object.keys(battleLabel).length;
  out.tapes.owners = Object.keys(ownerLabel).length;
  out.tapes.days = Object.keys(days).length;
  // every stagnation exit of the holding that day gets its own verdict; the named one is the one at the named minute
  for (const e of out.A.exitsFound) e.verdict = e.precededByTag === true ? 'PASS' : 'FAIL';
  const named = out.A.exitsFound.filter((e) => e.exitAt === acceptanceA.etClock);
  out.A.verdict = named.length ? (named.every((e) => e.verdict === 'PASS') ? 'PASS' : 'FAIL') : (out.A.exitsFound.length ? `NOT_AT_${acceptanceA.etClock.replace(':', '')}` : 'NOT_FOUND');
  return out;
}

/** The census as text: counts only, labels by order. */
export function renderB1Census(r) {
  const kv = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}: ${n}`).join(' · ') || '—';
  const L = [];
  L.push('# Film Room B1 census (read-only)');
  L.push(`tapes: ${r.tapes.total} (close status: ${kv(r.tapes.byCloseStatus)}; invalid paths ${r.tapes.invalidPath}) · written tiered days: ${r.tapes.writtenTiered} · battles: ${r.tapes.battlesTaped} · owners: ${r.tapes.owners} · ET days: ${r.tapes.days}`);
  L.push(`tags: tagged ${r.tags.tagged} · unavailable ${r.tags.unavailable} · items ${r.tags.items} · coverage.tags ${kv(r.tags.coverage)} · dial bases ${kv(r.tags.dialBases)}`);
  L.push(`tags unavailable reasons: ${kv(r.tags.unavailableReasons)}`);
  L.push(`archetypes the registry does not know: ${kv(r.tags.unknownArchetypes)}`);
  L.push('');
  L.push(`## A — ${r.A.etDate}, ${r.A.symbol}: ${r.A.verdict}`);
  for (const e of r.A.exitsFound) {
    L.push(`- ${e.battle}: stagnation exit at ${e.exitAt} ET · precededByTag ${e.precededByTag} · ${e.verdict}`);
    L.push(`  tags: ${e.items.map((i) => `${i.at} (count ${i.count} / ${i.threshold})`).join(', ') || 'none'}`);
    L.push(`  walk: ${e.walk.map((w) => `${w.at} ${w.px === 'none' ? 'no price' : `c${w.count}`}${w.reset ? ' reset' : ''}${w.fired ? ' fired' : ''}`).join(' · ')}`);
  }
  L.push('');
  L.push(`## B — exits ${r.B.exits} · preceded ${r.B.preceded} · not preceded ${r.B.notPreceded} · unknown (tagger unavailable) ${r.B.unknown}`);
  L.push(`mismatch classes (primary): ${kv(r.B.mismatchClass)}`);
  L.push(`mismatch flags (any): ${kv(r.B.mismatchFlags)}`);
  L.push('');
  L.push('## the evidence stamp by check state (checks · with an evidence stamp · every held stock priced · some held stock unpriced)');
  for (const [s, v] of Object.entries(r.evidence.byState).sort()) L.push(`- ${s}: ${v.checks} · ${v.withEvidence} · ${v.withHeldPx} · ${v.heldWithoutPx}`);
  L.push('');
  L.push(`## T1 — written tiered days whose battle has no opponent: ${r.T1.tieredNoOpponent} (of them, a stored last-check opponent of 0: ${r.T1.tieredNoOpponentWithZeroLastCheck})`);
  L.push(`## T2 — meetings the writer copies: ${r.T2.meetings} (${kv(r.T2.byStatus)}) · legs ${r.T2.legs} · days with a new leg symbol ${r.T2.tapesWithNewSymbols} · new symbols summed per day ${r.T2.newSymbolsPerTape} · new (symbol, day) EODHD requests ${r.T2.newSymbolDayPairs} (${r.T2.newSymbolDayPairs * 5} units)`);
  L.push(`   on the refresh: written candle passes outside the window that would expire ${r.T2.refreshExpires} · passes inside it that would be re-queued ${r.T2.refreshRequeues} · days whose meeting coverage names something not copied ${r.T2.notCopiedNotes}`);
  L.push(`   meetings resolved on a later ET day than created (whole histories): ${kv(r.T2.filedLaterDay)}`);
  for (const m of r.T2.perMeeting) L.push(`   - ${m.battle} ${m.etDate}: ${m.status} · legs ${m.legs} · new symbols ${m.newSymbols}`);
  L.push(`## W1 — closed-out days still saying a candle pass is coming: ${r.W1.terminalWithAwaitingNote}`);
  L.push(`## W2 — battles whose timeline the validated reading changes: ${r.W2.battlesWithDroppedEntries} (taped: ${r.W2.ofThemTaped})`);
  L.push(`## W4 — written days with a note in the pre-W4 wording: ${r.W4.tapesWithOldWording}`);
  return L.join('\n');
}

// ── main (credentials and reads live only here) ─────────────────────────────

function parseEnvText(text) {
  const out = {};
  for (const line of String(text).split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

/** The growth replay's lookup order: the environment, this tree's .env.local, then the primary checkout's. */
function loadEnv() {
  const files = [path.join(REPO, '.env.local')];
  const parts = REPO.split(path.sep);
  const i = parts.lastIndexOf('worktrees');
  if (i >= 1 && parts[i - 1] === '.claude') files.push(path.join(parts.slice(0, i - 1).join(path.sep) || path.sep, '.env.local'));
  const env = {};
  for (const f of files) {
    if (!existsSync(f)) continue;
    for (const [k, v] of Object.entries(parseEnvText(readFileSync(f, 'utf8')))) if (env[k] === undefined) env[k] = v;
  }
  for (const [k, v] of Object.entries(process.env)) if (v) env[k] = v;
  return env;
}

function stop(message, code = 2) {
  console.error(`STOP: ${message}`);
  process.exit(code);
}

export function parseArgs(argv) {
  const out = { json: null };
  for (let i = 0; i < argv.length; i += 1) if (argv[i] === '--json') { out.json = argv[i + 1] ?? null; i += 1; }
  return out;
}

async function main() {
  // THE GATE, before anything else: no credential is read and no read is made if it trips.
  for (const rel of GATED_FILES) {
    const hits = writeCallsIn(readFileSync(path.join(REPO, rel), 'utf8'));
    if (hits.length) stop(`write-grep gate: ${rel} has ${hits.length} line(s) matching a write call (${hits.map(([n]) => n).join(', ')}) — refusing to run`, 3);
  }
  console.log(`[census-b1] gate: ${GATED_FILES.join(', ')} — no write call`);
  const args = parseArgs(process.argv.slice(2));
  const env = loadEnv();
  let sa = null;
  try { sa = env.FIREBASE_ADMIN_CREDENTIALS ? JSON.parse(env.FIREBASE_ADMIN_CREDENTIALS) : null; } catch { sa = null; }
  if (!sa && env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    sa = { project_id: env.FIREBASE_PROJECT_ID, client_email: env.FIREBASE_CLIENT_EMAIL, private_key: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') };
  }
  if (!sa || typeof sa.private_key !== 'string') stop('no Firebase service account (checked the environment, this tree\'s .env.local, then the primary checkout\'s; value not printed)');
  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const db = getFirestore(initializeApp({ credential: cert(sa) }, 'census-film-room-b1'));
  console.log(`[census-b1] Firestore project_id: ${sa.project_id}`);

  const tapeSnap = await db.collectionGroup('tape').get();
  const tapes = tapeSnap.docs.map((d) => ({ path: d.ref.path, data: d.data() }));
  console.log(`[census-b1] tapes read: ${tapes.length}`);
  const battleIds = [...new Set(tapes.map((t) => tapeIdsOf(t.path)?.battleId).filter(Boolean))].sort();
  const battles = {};
  const FIELDS = ['agentContext', 'controlEpochLog', 'opponent', 'gameMode', 'timing', 'gameplanMeetingHistory', 'gameplanMeeting', 'status', 'activatedAt', 'createdAt', 'completedAt'];
  for (let k = 0; k < battleIds.length; k += 100) {
    const refs = battleIds.slice(k, k + 100).map((id) => db.collection('agentBattles').doc(id));
    const snaps = await db.getAll(...refs, { fieldMask: FIELDS });
    for (const s of snaps) if (s.exists) battles[s.id] = s.data();
  }
  console.log(`[census-b1] battles read: ${Object.keys(battles).length}`);
  const ticks = {};
  for (const t of tapes) {
    const ids = tapeIdsOf(t.path);
    const b = ids ? battles[ids.battleId] : null;
    if (!b || b.agentContext?.dials?.tempo == null || t.data?.passes?.close?.status !== 'written') continue;
    const bounds = etDayBounds(ids.etDate);
    const q = await db.collection('agentBattles').doc(ids.battleId).collection('ticks')
      .where('capturedAt', '>=', bounds.startIso).where('capturedAt', '<', bounds.endIso).select('tickSeq', 'controls').get();
    ticks[`${ids.battleId}|${ids.etDate}`] = q.docs.map((d) => d.data());
  }
  console.log(`[census-b1] tick days read (battles with a dial): ${Object.keys(ticks).length}`);
  const result = computeB1Census({ tapes, battles, ticks, dialEnabled: TEMPO_DIAL_ENABLED, nowMs: Date.now() });
  console.log(renderB1Census(result));
  if (args.json) writeFileSync(args.json, `${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((err) => { console.error(`[census-b1] failed: ${String(err?.message || err).replace(/-----BEGIN[\s\S]*?-----END[^-]*-----/g, '[REDACTED]')}`); process.exit(1); });
}
