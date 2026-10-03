// scripts/build2-discovery-counts.mjs
//
// Phase 0 — Cockpit Build 2 discovery, Part B: counts from round 3's raw outputs
// (docs/audits/20261002_DECLARATIONS_WORDING_ROUND3.md). READ-ONLY.
//
// DATA comes only from the git-ignored raw folder experiments/declarations-wording/raw/round3/:
//   sample.json   the 193 recorded checks (request bytes incl. the live context, battle metadata)
//   s2.json       the 40 synthetic-directive checks (B9 only)
//   calls/*.json  the 1,318 round-3 records (main: 1A, 1A-C, 1A-CF x 2 reps; S2: 1A-C, 1A-CF x 2 reps)
//   results.json  read once, as the cross-check that the kept rows below are round 3's own
// One source file is read as TEXT: scripts/declarations-wording-experiment.mjs, to prove the
// per-check universe builder copied below is round 3's, byte for byte (that script cannot be
// imported — it dispatches a command at load). No Firestore, no network, no API key, no clock in
// the output, no write unless --json=<path> is passed. Same inputs → byte-identical output.
//
// KEPT ROWS: the calls validator (api/_utils/callRecords/validate.js captureDeclarations) called
// exactly as round 3's analyze3 calls it — horizon bound to the check's own instants, universe =
// the battle roster as read on 2026-10-02 plus every held and bench name the check's prompt
// showed. Raw tool input is used only where a count says raw (B2, B4).
//
// PER BATTLE-DAY: a battle-day is a battle's sampled checks on one ET day (round 3 sampled every
// recoverable check). The value is the mean of the two reps; the line gives mean · median ·
// min–max across battle-days, the median being round 3's (the lower middle value).
//
// USAGE (repo root): node scripts/build2-discovery-counts.mjs [--json=<path>]

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { captureDeclarations } from '../api/_utils/callRecords/validate.js';
import { bindHorizon } from '../api/_utils/callRecords/horizon.js';
import { validateTradeToolResult } from '../api/_utils/agentEvalToolResultValidation.js';
import { getAllowlist } from '../src/data/archetypeAdjustments.js';

// ---------------------------------------------------------------- inputs

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'experiments', 'declarations-wording', 'raw', 'round3');
const EXPERIMENT_SCRIPT = path.join(ROOT, 'scripts', 'declarations-wording-experiment.mjs');

/** Primary arm first; the other two are the "where cheap" columns. */
const ARMS = Object.freeze(['1A-C', '1A', '1A-CF']);
const PRIMARY = '1A-C';
const REPS = Object.freeze([1, 2]);
const MAX_EXAMPLES = 8;
const EXAMPLE_SEED = 20261003;

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const stop = (m) => { throw new Error(`STOP — ${m}`); };

const s = readJson(path.join(RAW, 'sample.json'));
const s2 = readJson(path.join(RAW, 's2.json'));
const r3 = readJson(path.join(RAW, 'results.json'));
const meta = s.battlesMeta;

const records = new Map();
const callFiles = readdirSync(path.join(RAW, 'calls')).sort();
const callsDigest = createHash('sha256');
for (const f of callFiles) {
  const bytes = readFileSync(path.join(RAW, 'calls', f));
  callsDigest.update(`${f}\n${sha256(bytes)}\n`);
  const r = JSON.parse(bytes.toString('utf8'));
  const key = `${r.arm}|${r.rep}|${r.battleId}|${r.evalId}|${r.s2 ? 's2' : 'main'}`;
  if (records.has(key)) stop(`${f} repeats ${key}`);
  if (r.customId !== `${r.arm}__${r.rep}__${r.battleId}__${r.evalId}${r.s2 ? '__s2' : ''}`) stop(`${f} carries another record's customId`);
  records.set(key, r);
}
const recordOf = (arm, rep, c, sub = 'main') => records.get(`${arm}|${rep}|${c.battleId}|${c.evalId}|${sub}`) ?? null;
for (const arm of ARMS) for (const rep of REPS) for (const c of s.sample) if (!recordOf(arm, rep, c)) stop(`no ${arm} rep ${rep} record for ${c.battleId}:${c.evalId}`);

// ---------------------------------------------------------------- round 3's universe builder (verbatim)

const BENCH_PRESENT = 'BENCH (available for swap):';

/**
 * The held and bench symbols a recorded live context shows (its ACTIVE POSITIONS and BENCH CSVs,
 * read by their Symbol column). Production judges fork options against the universe frozen at
 * each check's model seam (callRecords/observe.js:102-104); the replay has only the battle's END
 * state, so a check's universe is that roster plus every name its own prompt showed (review L2-1).
 */
function promptSymbols(live) {
  const out = new Set();
  for (const header of ['ACTIVE POSITIONS:', BENCH_PRESENT]) {
    const i = live.indexOf(`${header}\n`);
    if (i < 0) continue;
    const lines = live.slice(i).split('\n\n')[0].split('\n');
    const col = (lines[1] || '').split(',').indexOf('Symbol');
    if (col < 0) continue;
    for (const line of lines.slice(2)) { const sym = (line.split(',')[col] || '').trim(); if (sym) out.add(sym); }
  }
  return out;
}

/** Prove the copy above is round 3's builder and that round 3 validated with exactly this universe. */
function assertUniverseBuilderIsRound3s() {
  const lf = (t) => t.replace(/\r\n/g, '\n');
  const src = lf(readFileSync(EXPERIMENT_SCRIPT, 'utf8'));
  const start = src.indexOf('function promptSymbols(live) {');
  const end = src.indexOf('\n}\n', start);
  if (start < 0 || end < 0) stop('promptSymbols is no longer in the experiment script');
  if (src.slice(start, end + 2) !== lf(promptSymbols.toString())) stop("this script's promptSymbols is not round 3's, byte for byte");
  if (!src.includes(`const BENCH_PRESENT = '${BENCH_PRESENT}';`)) stop("BENCH_PRESENT differs from round 3's");
  const r3Validate = "const validate = validateWith((c) => [...new Set([...meta[c.battleId].universe, ...promptSymbols(c.request.messages[2].content)])]);";
  if (!src.includes(r3Validate)) stop("round 3's analyze3 no longer validates with roster ∪ promptSymbols");
  return { experimentScriptSha256: sha256(Buffer.from(src, 'utf8')) };
}
const builderProof = assertUniverseBuilderIsRound3s();

// ---------------------------------------------------------------- per-check context

const live = (c) => c.request.messages[2].content;

/** One CSV block's Symbol column (ACTIVE POSITIONS or BENCH), in order. */
function csvSymbols(text, header) {
  const i = text.indexOf(`${header}\n`);
  if (i < 0) return [];
  const lines = text.slice(i).split('\n\n')[0].split('\n');
  const cols = (lines[1] || '').split(',');
  const col = cols.indexOf('Symbol');
  if (col < 0) return [];
  return lines.slice(2).map((l) => (l.split(',')[col] || '').trim()).filter(Boolean);
}

const ctxCache = new Map();
function ctxOf(c) {
  const k = `${c.battleId}|${c.evalId}`;
  if (!ctxCache.has(k)) {
    const text = live(c);
    const held = new Set(csvSymbols(text, 'ACTIVE POSITIONS:'));
    const bench = new Set(csvSymbols(text, BENCH_PRESENT));
    const universe = [...new Set([...meta[c.battleId].universe, ...promptSymbols(text)])];
    ctxCache.set(k, {
      held, bench, universe, U: new Set(universe),
      resolveHorizon: bindHorizon({ promptBuiltAtMs: c.promptBuiltAtMs, mintedAtMs: c.mintedAtMs, battleExpiresAtMs: meta[c.battleId].battleExpiresAtMs }),
    });
  }
  return ctxCache.get(k);
}

const evalSeqOf = (evalId) => { const m = /^eval_(\d+)$/.exec(evalId); return m ? Number(m[1]) : null; };
const battleDayKey = (c) => `${c.battleId}|${c.day}`;

/** One analyzed model call: its record, its kept rows, its trade validity. */
const analyzedCache = new Map();
function A(arm, rep, c) {
  const k = `${arm}|${rep}|${c.battleId}|${c.evalId}`;
  if (analyzedCache.has(k)) return analyzedCache.get(k);
  const r = recordOf(arm, rep, c);
  const input = r.toolUseInput ?? null;
  const ctx = ctxOf(c);
  const v = captureDeclarations(input?.declarations, { universe: ctx.universe, resolveHorizon: ctx.resolveHorizon });
  const validated = v.validation.validated;
  const x = {
    arm, rep, c, r, input, ctx, v,
    phase: v.phase,
    shots: validated?.calledShots ?? [],
    keptWatching: validated?.watching ?? [],
    calls: v.validation.calls,
    tradeValid: input ? validateTradeToolResult(input).valid : false,
  };
  analyzedCache.set(k, x);
  return x;
}
const callsOf = (arm) => s.sample.flatMap((c) => REPS.map((rep) => A(arm, rep, c)));

// ---------------------------------------------------------------- helpers

const inc = (o, k, by = 1) => { o[k] = (o[k] || 0) + by; return o; };
const sortedEntries = (o) => Object.entries(o).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
const pctStr = (n, d) => (d ? `${((100 * n) / d).toFixed(1)} %` : 'n/a');
const frac = (n, d) => `${n} / ${d} (${pctStr(n, d)})`;
const num = (x, dp = 2) => {
  if (x == null || !Number.isFinite(x)) return 'n/a';
  const t = Number(x).toFixed(dp);
  return t.includes('.') ? t.replace(/0+$/, '').replace(/\.$/, '') : t;
};
const lowerMedian = (xs) => { const a = [...xs].sort((p, q) => p - q); return a.length ? a[Math.min(a.length - 1, Math.max(0, Math.ceil(0.5 * a.length) - 1))] : null; };
const mean = (xs) => (xs.length ? xs.reduce((p, q) => p + q, 0) / xs.length : null);

/** mulberry32, as the experiment uses it. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const salt = (label) => [...label].reduce((sum, ch, i) => (sum + ch.charCodeAt(0) * (i + 1)) % 1_000_000, 0);
/** Up to MAX_EXAMPLES, seeded per count; primary arm first, then the others, each labelled. */
function pickExamples(label, byArm) {
  const out = [];
  for (const arm of ARMS) {
    if (out.length >= MAX_EXAMPLES) break;
    const pool = byArm[arm] ?? [];
    for (const e of shuffle(pool, rng(EXAMPLE_SEED + salt(`${label}|${arm}`)))) {
      if (out.length >= MAX_EXAMPLES) break;
      out.push({ arm, ...e });
    }
  }
  return out;
}

/** Per battle-day: valueOf(analyzedCall) summed per rep, the two reps averaged, then across battle-days. */
function perBattleDay(arm, valueOf) {
  const days = new Map();
  for (const c of s.sample) {
    const k = battleDayKey(c);
    if (!days.has(k)) days.set(k, { archetype: c.archetype, sum: { 1: 0, 2: 0 } });
    for (const rep of REPS) days.get(k).sum[rep] += valueOf(A(arm, rep, c));
  }
  const summarize = (rows) => {
    const vals = rows.map((d) => (d.sum[1] + d.sum[2]) / 2);
    return {
      battleDays: rows.length, mean: mean(vals), median: lowerMedian(vals),
      min: vals.length ? Math.min(...vals) : null, max: vals.length ? Math.max(...vals) : null,
      withAny: rows.filter((d) => d.sum[1] + d.sum[2] > 0).length,
    };
  };
  const all = [...days.values()];
  return {
    all: summarize(all),
    momentum_chaser: summarize(all.filter((d) => d.archetype === 'momentum_chaser')),
    contrarian: summarize(all.filter((d) => d.archetype === 'contrarian')),
  };
}
const bdStr = (b) => `${num(b.mean)} · ${num(b.median)} · ${num(b.min)}–${num(b.max)}`;
const bdLine = (pb) => `all ${pb.all.battleDays}: ${bdStr(pb.all)} (≥ 1 on ${pb.all.withAny} of ${pb.all.battleDays}) · MC ${pb.momentum_chaser.battleDays}: ${bdStr(pb.momentum_chaser)} · CN ${pb.contrarian.battleDays}: ${bdStr(pb.contrarian)}`;

const fmtRow = (row) => `\`${row.symbol}\` ${row.direction} · ${row.slot}${row.counterpart ? ` (counterpart ${row.counterpart})` : ''} · ${row.condition.side} ${row.condition.level} · \`${row.horizonPhrase}\` · ${row.defaultAction} — "${row.said}"`;
const checkLabel = (x) => `${x.c.battleId.slice(0, 5)}… ${x.c.evalId} · ${x.c.archetype} · rep ${x.rep}${x.tradeValid ? '' : ' · trade result INVALID (production would mint nothing)'}`;

// ---------------------------------------------------------------- cross-check against round 3

/** The kept-row pipeline must reproduce round 3's own published per-arm numbers, or nothing is reported. */
function crossCheckRound3() {
  const rows = [];
  for (const arm of ARMS) {
    const pub = r3.perArm[arm];
    let declaring = 0; const kindMix = {}; const horizonMix = {}; const removals = {}; const perDeclaring = [];
    const pacing = new Map();
    for (const c of s.sample) {
      const k = battleDayKey(c);
      if (!pacing.has(k)) pacing.set(k, { battleId: c.battleId, day: c.day, declaring: { 1: 0, 2: 0 }, minted: { 1: 0, 2: 0 } });
      for (const rep of REPS) {
        const x = A(arm, rep, c);
        for (const rm of x.v.validation.removed) inc(removals, `${rm.source}:${rm.reason}`);
        if (x.phase !== 'expected') continue;
        declaring += 1; perDeclaring.push(x.calls.length);
        pacing.get(k).declaring[rep] += 1; pacing.get(k).minted[rep] += x.calls.length;
        for (const call of x.calls) { inc(kindMix, call.kind); inc(horizonMix, call.source === 'fork' ? 'next_check' : call.row.horizonPhrase); }
        if (x.keptWatching.length) inc(kindMix, 'watching', x.keptWatching.length);
        if (x.v.validation.validated.playerAsk) inc(kindMix, 'playerAsk');
      }
    }
    const same = (a, b) => JSON.stringify(Object.fromEntries(Object.entries(a).sort())) === JSON.stringify(Object.fromEntries(Object.entries(b).sort()));
    const pubPacing = new Map(pub.pacingRows.map((p) => [`${p.battleId}|${p.day}`, p]));
    const pacingSame = [...pacing.entries()].every(([k, p]) => {
      const q = pubPacing.get(k);
      return q && JSON.stringify(q.declaring) === JSON.stringify(p.declaring) && JSON.stringify(q.minted) === JSON.stringify(p.minted);
    }) && pubPacing.size === pacing.size;
    const checks = {
      declaringCalls: declaring === pub.declaringCalls,
      callsPerDeclaringCall: mean(perDeclaring) === pub.callsPerDeclaringCall,
      kindMix: same(kindMix, pub.kindMix),
      horizonMix: same(horizonMix, pub.horizonMix),
      removals: same(removals, pub.removals),
      pacingRows: pacingSame,
    };
    if (!Object.values(checks).every(Boolean)) stop(`kept rows for ${arm} do not reproduce round 3's results.json: ${JSON.stringify(checks)}`);
    rows.push({ arm, declaringCalls: declaring, calls: s.sample.length * REPS.length, kindMix, horizonMix, removals, checks });
  }
  return rows;
}

// ---------------------------------------------------------------- B1 Crossroads Tier 1

/**
 * Per call, the slots whose kept called-shot rows name ≥ 2 different INCOMING symbols. Incoming =
 * an entry row's symbol, or an exit row's counterpart. `universeOnly` drops incoming names outside
 * the check's universe (TBD, N/A …; see B5); `notHeld` also drops incoming names the check showed
 * as HELD (an entry row on a held name — see B7 — brings nothing in). Each qualifying slot reports
 * its row mix (entry-only · exit-only · mixed) and whether ≥ 2 of its incoming names share one
 * swap-out in the universe (an entry row's counterpart, or an exit row's own symbol).
 */
function crossroadsSlots(x, { universeOnly, notHeld = false }) {
  const bySlot = new Map();
  for (const row of x.shots) {
    const incoming = row.direction === 'entry' ? row.symbol : (row.counterpart ?? null);
    const outgoing = row.direction === 'entry' ? (row.counterpart ?? null) : row.symbol;
    if (!incoming) continue;
    if (universeOnly && !x.ctx.U.has(incoming)) continue;
    if (notHeld && x.ctx.held.has(incoming)) continue;
    if (!bySlot.has(row.slot)) bySlot.set(row.slot, []);
    bySlot.get(row.slot).push({ row, incoming, outgoing });
  }
  const out = [];
  for (const slot of [...bySlot.keys()].sort()) {
    const list = bySlot.get(slot);
    if (new Set(list.map((e) => e.incoming)).size < 2) continue;
    const dirs = new Set(list.map((e) => e.row.direction));
    const mix = dirs.size === 2 ? 'mixed' : dirs.has('entry') ? 'entry-only' : 'exit-only';
    const byOut = new Map();
    for (const e of list) if (e.outgoing && x.ctx.U.has(e.outgoing)) { if (!byOut.has(e.outgoing)) byOut.set(e.outgoing, new Set()); byOut.get(e.outgoing).add(e.incoming); }
    out.push({ slot, mix, sameSwapOut: [...byOut.values()].some((set) => set.size >= 2), rows: list.map((e) => e.row) });
  }
  return out;
}

function b1() {
  const perArm = {}; const strictByArm = {}; const heldOnlyByArm = {};
  const tally = (calls, opts) => {
    const mix = {}; let sameOut = 0; let slots = 0; let hits = 0; let invalidAmongHits = 0;
    for (const x of calls) {
      const q = crossroadsSlots(x, opts);
      if (!q.length) continue;
      hits += 1; if (!x.tradeValid) invalidAmongHits += 1;
      for (const sl of q) { slots += 1; inc(mix, sl.mix); if (sl.sameSwapOut) sameOut += 1; }
    }
    return { hits, slots, mix, sameSwapOutSlots: sameOut, invalidAmongHits };
  };
  const exampleOf = (x, q) => ({ where: checkLabel(x), slots: q.map((sl) => ({ slot: sl.slot, mix: sl.mix, sameSwapOut: sl.sameSwapOut, rows: sl.rows.map((row) => `${fmtRow(row)}${x.ctx.held.has(row.direction === 'entry' ? row.symbol : row.counterpart) ? ' **[incoming name is held]**' : ''}`) })) });
  for (const arm of ARMS) {
    const calls = callsOf(arm);
    strictByArm[arm] = []; heldOnlyByArm[arm] = [];
    for (const x of calls) {
      const strict = crossroadsSlots(x, { universeOnly: true, notHeld: true });
      if (strict.length) { strictByArm[arm].push(exampleOf(x, strict)); continue; }
      const loose = crossroadsSlots(x, { universeOnly: true });
      if (loose.length) heldOnlyByArm[arm].push(exampleOf(x, loose));
    }
    perArm[arm] = {
      calls: calls.length, withShots: calls.filter((x) => x.shots.length > 0).length, multiShot: calls.filter((x) => x.shots.length >= 2).length,
      asDefined: tally(calls, { universeOnly: true }),
      unfiltered: tally(calls, { universeOnly: false }),
      notHeld: tally(calls, { universeOnly: true, notHeld: true }),
      perBattleDay: perBattleDay(arm, (x) => (crossroadsSlots(x, { universeOnly: true }).length ? 1 : 0)),
      perBattleDayNotHeld: perBattleDay(arm, (x) => (crossroadsSlots(x, { universeOnly: true, notHeld: true }).length ? 1 : 0)),
    };
  }
  const strictExamples = pickExamples('B1-not-held', strictByArm);
  const fill = pickExamples('B1-held', heldOnlyByArm).slice(0, Math.max(0, MAX_EXAMPLES - strictExamples.length));
  return { perArm, examples: [...strictExamples.map((e) => ({ ...e, variant: 'qualifies with held names excluded' })), ...fill.map((e) => ({ ...e, variant: 'qualifies only because a held name counts as incoming' }))] };
}

// ---------------------------------------------------------------- B2 anticipationCandidates (raw)

const SCHEMA_CANDIDATE_KEYS = Object.freeze(['symbol', 'direction', 'signalSummary', 'threshold', 'rationale', 'signalSource']);
const TIER_WORD = /\b(star|core|support)\b/i;

function b2() {
  const perArm = {}; const exByArm = {};
  for (const arm of ARMS) {
    const calls = callsOf(arm);
    const keySets = {}; const directions = {}; const extraKeys = {}; const tierWordIn = {}; const symbolShownAs = {};
    let candidates = 0; let callsWith = 0; let twoPlusEntry = 0; let twoPlusEntryBench = 0; let twoPlusEntrySameTierWord = 0; let withTierWord = 0; let slotKeyed = 0;
    let invalidAmongCallsWith = 0;
    exByArm[arm] = [];
    for (const x of calls) {
      const list = Array.isArray(x.input?.anticipationCandidates) ? x.input.anticipationCandidates : [];
      if (!list.length) continue;
      callsWith += 1;
      if (!x.tradeValid) invalidAmongCallsWith += 1;
      const entryTier = new Map();
      const entrySyms = new Set();
      for (const cand of list) {
        candidates += 1;
        if (!cand || typeof cand !== 'object' || Array.isArray(cand)) { inc(keySets, `(${Array.isArray(cand) ? 'array' : typeof cand})`); continue; }
        inc(keySets, Object.keys(cand).sort().join(','));
        inc(directions, String(cand.direction));
        inc(symbolShownAs, `${cand.direction} · ${x.ctx.held.has(cand.symbol) ? 'held' : x.ctx.bench.has(cand.symbol) ? 'bench' : 'neither'}`);
        for (const key of Object.keys(cand)) if (!SCHEMA_CANDIDATE_KEYS.includes(key)) inc(extraKeys, key);
        if (['slot', 'tier', 'targetTier', 'targetSlot'].some((key) => key in cand)) slotKeyed += 1;
        const text = ['signalSummary', 'threshold', 'rationale'].map((f) => (typeof cand[f] === 'string' ? cand[f] : '')).join(' ');
        const m = TIER_WORD.exec(text);
        if (m) { withTierWord += 1; inc(tierWordIn, `${cand.direction}:${m[1].toLowerCase()}`); }
        if (cand.direction === 'potential_entry' && typeof cand.symbol === 'string') {
          entrySyms.add(cand.symbol);
          if (m) { const t = m[1].toLowerCase(); if (!entryTier.has(t)) entryTier.set(t, new Set()); entryTier.get(t).add(cand.symbol); }
        }
      }
      const sameTier = [...entryTier.values()].some((set) => set.size >= 2);
      if (entrySyms.size >= 2) twoPlusEntry += 1;
      if ([...entrySyms].filter((sym) => x.ctx.bench.has(sym)).length >= 2) twoPlusEntryBench += 1;
      if (sameTier) {
        twoPlusEntrySameTierWord += 1;
        exByArm[arm].push({ where: checkLabel(x), candidates: list.filter((cand) => cand?.direction === 'potential_entry').map((cand) => ({ symbol: cand.symbol, signalSummary: cand.signalSummary ?? null, threshold: cand.threshold ?? null })) });
      }
    }
    perArm[arm] = {
      calls: calls.length, callsWith, candidates, keySets, directions, symbolShownAs, extraKeys, slotKeyed, withTierWord, tierWordIn,
      twoPlusEntry, twoPlusEntryBench, twoPlusEntrySameTierWord, invalidAmongCallsWith,
      perBattleDay: perBattleDay(arm, (x) => {
        const list = Array.isArray(x.input?.anticipationCandidates) ? x.input.anticipationCandidates : [];
        return new Set(list.filter((cand) => cand?.direction === 'potential_entry' && typeof cand.symbol === 'string').map((cand) => cand.symbol)).size >= 2 ? 1 : 0;
      }),
    };
  }
  return { perArm, examples: pickExamples('B2', exByArm) };
}

// ---------------------------------------------------------------- B3 prose alternatives in `said`

const TICK = '[A-Z][A-Z0-9]{0,5}(?:\\.[A-Z])?';
const ALT_SEP = '(?:\\s*\\/\\s*|\\s*,\\s*(?:or\\s+)?|\\s+or\\s+)';
const ALT_RUN = new RegExp(`(?<![A-Za-z0-9$.])${TICK}(?:${ALT_SEP}${TICK})+(?![A-Za-z0-9])`, 'g');
const ALT_SPLIT = /\s*\/\s*|\s*,\s*(?:or\s+)?|\s+or\s+/;

/** The alternative groups a sentence names: runs joined by "or" or "/" (a comma-only run is a list, not alternatives), ≥ 2 distinct universe tickers. */
function alternativeGroups(said, U) {
  const groups = [];
  for (const m of said.matchAll(ALT_RUN)) {
    if (!/\/|\sor\s/.test(m[0])) continue;
    const names = [...new Set(m[0].split(ALT_SPLIT).map((t) => t.trim()).filter((t) => U.has(t)))];
    if (names.length >= 2) groups.push({ text: m[0], names });
  }
  return groups;
}

function b3() {
  const perArm = {}; const exByArm = {};
  for (const arm of ARMS) {
    const calls = callsOf(arm);
    let rows = 0; let hitRows = 0; let counterpartIn = 0; let counterpartOther = 0; let counterpartAbsent = 0; let symbolIn = 0;
    const callsHit = new Set(); const groupTexts = {}; let invalidAmongHitRows = 0;
    exByArm[arm] = [];
    for (const x of calls) {
      for (const row of x.shots) {
        rows += 1;
        const groups = alternativeGroups(row.said, x.ctx.U);
        if (!groups.length) continue;
        hitRows += 1; callsHit.add(x);
        if (!x.tradeValid) invalidAmongHitRows += 1;
        const named = new Set(groups.flatMap((g) => g.names));
        if (!row.counterpart) counterpartAbsent += 1;
        else if (named.has(row.counterpart)) counterpartIn += 1;
        else counterpartOther += 1;
        if (named.has(row.symbol)) symbolIn += 1;
        for (const g of groups) inc(groupTexts, g.text);
        exByArm[arm].push({ where: checkLabel(x), row: fmtRow(row), groups: groups.map((g) => g.names.join(' | ')), counterpart: row.counterpart ?? null });
      }
    }
    perArm[arm] = {
      calls: calls.length, rows, hitRows, callsHit: callsHit.size, counterpartIn, counterpartOther, counterpartAbsent, symbolIn,
      invalidAmongHitRows, groupTexts,
      perBattleDay: perBattleDay(arm, (x) => x.shots.filter((row) => alternativeGroups(row.said, x.ctx.U).length > 0).length),
    };
  }
  return { perArm, examples: pickExamples('B3', exByArm) };
}

// ---------------------------------------------------------------- B4 stray top-level keys (raw)

const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

function b4() {
  const perArm = {}; const exByArm = {};
  for (const arm of ARMS) {
    const calls = callsOf(arm);
    const present = { watching: 0, fork: 0, playerAsk: 0 }; const valueTypes = { watching: {}, fork: {}, playerAsk: {} };
    let anyOfThree = 0; let nonEmptyWatching = 0; const elementTypes = {}; let elements = 0; let elementsInUniverse = 0;
    let sumTW = 0; let interDW = 0; let interAC = 0; let interEither = 0;
    let callsOverlapDW = 0; let callsSubsetDW = 0; let callsOverlapAC = 0; let callsDeclNullTWNonEmpty = 0;
    const keptDeclWatchingCalls = calls.filter((x) => x.keptWatching.length > 0).length;
    const keptDeclWatchingSymbols = calls.reduce((n, x) => n + x.keptWatching.length, 0);
    const nonNullForks = []; const nonNullAsks = [];
    exByArm[arm] = [];
    for (const x of calls) {
      const input = x.input ?? {};
      let any = false;
      for (const key of ['watching', 'fork', 'playerAsk']) {
        if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
        any = true; present[key] += 1; inc(valueTypes[key], typeOf(input[key]));
      }
      if (any) anyOfThree += 1;
      if (input.fork != null) nonNullForks.push(input.fork);
      if (input.playerAsk != null) nonNullAsks.push(input.playerAsk);
      const tw = input.watching;
      if (!Array.isArray(tw) || !tw.length) continue;
      nonEmptyWatching += 1;
      for (const el of tw) { elements += 1; inc(elementTypes, typeOf(el)); if (typeof el === 'string' && x.ctx.U.has(el)) elementsInUniverse += 1; }
      const TW = new Set(tw.filter((el) => typeof el === 'string'));
      const DW = new Set(x.keptWatching);
      const AC = new Set((Array.isArray(input.anticipationCandidates) ? input.anticipationCandidates : []).map((cand) => cand?.symbol).filter((sym) => typeof sym === 'string'));
      const inDW = [...TW].filter((sym) => DW.has(sym)).length;
      const inAC = [...TW].filter((sym) => AC.has(sym)).length;
      sumTW += TW.size; interDW += inDW; interAC += inAC; interEither += [...TW].filter((sym) => DW.has(sym) || AC.has(sym)).length;
      if (inDW > 0) callsOverlapDW += 1;
      if (TW.size > 0 && inDW === TW.size) callsSubsetDW += 1;
      if (inAC > 0) callsOverlapAC += 1;
      if (input.declarations == null) callsDeclNullTWNonEmpty += 1;
      exByArm[arm].push({ where: checkLabel(x), topLevelWatching: tw, declarationsWatching: x.keptWatching, anticipationSymbols: [...AC], declarationsBlock: input.declarations == null ? 'null/absent' : typeOf(input.declarations) });
    }
    perArm[arm] = {
      calls: calls.length, present, valueTypes, anyOfThree, nonEmptyWatching, elementTypes, elements, elementsInUniverse,
      symbolOverlap: { topLevelSymbols: sumTW, inDeclarationsWatching: interDW, inAnticipation: interAC, inEither: interEither },
      callsOverlapDW, callsSubsetDW, callsOverlapAC, callsDeclNullTWNonEmpty, keptDeclWatchingCalls, keptDeclWatchingSymbols,
      nonNullForks: nonNullForks.length, nonNullAsks: nonNullAsks.length, nonNullAskShapes: nonNullAsks.reduce((o, v) => inc(o, typeOf(v) === 'object' ? Object.keys(v).sort().join(',') : typeOf(v)), {}),
      perBattleDay: perBattleDay(arm, (x) => (Array.isArray(x.input?.watching) && x.input.watching.length ? 1 : 0)),
    };
  }
  return { perArm, examples: pickExamples('B4', exByArm) };
}

// ---------------------------------------------------------------- B5 counterpart quality

function counterpartClass(row, ctx) {
  const cp = row.counterpart;
  if (!cp) return 'absent';
  if (!ctx.U.has(cp)) return 'not in universe';
  if (ctx.held.has(cp)) return 'held';
  if (ctx.bench.has(cp)) return 'bench (shown)';
  return 'universe, not shown';
}

function b5() {
  const perArm = {}; const exByArm = {};
  for (const arm of ARMS) {
    const calls = callsOf(arm);
    let rows = 0; let withCp = 0; let outside = 0; const outsideValues = {}; const byDirection = { entry: {}, exit: {} };
    const callsOutside = new Set(); let invalidAmongOutside = 0;
    exByArm[arm] = [];
    for (const x of calls) for (const row of x.shots) {
      rows += 1;
      const cls = counterpartClass(row, x.ctx);
      inc(byDirection[row.direction], cls);
      if (cls === 'absent') continue;
      withCp += 1;
      if (cls !== 'not in universe') continue;
      outside += 1; inc(outsideValues, row.counterpart); callsOutside.add(x);
      if (!x.tradeValid) invalidAmongOutside += 1;
      exByArm[arm].push({ where: checkLabel(x), row: fmtRow(row) });
    }
    perArm[arm] = {
      calls: calls.length, rows, withCounterpart: withCp, outside, outsideValues, byDirection, callsOutside: callsOutside.size, invalidAmongOutside,
      perBattleDay: perBattleDay(arm, (x) => x.shots.filter((row) => counterpartClass(row, x.ctx) === 'not in universe').length),
    };
  }
  return { perArm, examples: pickExamples('B5', exByArm) };
}

// ---------------------------------------------------------------- B6 repeats across consecutive sampled checks

const LEVEL_TOLERANCE = 0.01;
const sameCall = (a, b) => a.symbol === b.symbol && a.direction === b.direction && a.slot === b.slot && a.condition.side === b.condition.side
  && Number.isFinite(a.condition.level) && Number.isFinite(b.condition.level) && b.condition.level !== 0
  && Math.abs(a.condition.level - b.condition.level) <= LEVEL_TOLERANCE * Math.abs(b.condition.level);

/** Each battle's sampled checks in time order, with the previous sampled check of the same battle. */
function battlePairs() {
  const byBattle = new Map();
  for (const c of s.sample) { if (!byBattle.has(c.battleId)) byBattle.set(c.battleId, []); byBattle.get(c.battleId).push(c); }
  const pairs = [];
  for (const bid of [...byBattle.keys()].sort()) {
    const list = byBattle.get(bid).sort((a, b) => a.ms - b.ms || evalSeqOf(a.evalId) - evalSeqOf(b.evalId));
    for (let i = 1; i < list.length; i += 1) {
      const prev = list[i - 1]; const cur = list[i];
      const gap = evalSeqOf(cur.evalId) - evalSeqOf(prev.evalId);
      pairs.push({ prev, cur, gap, sameDay: prev.day === cur.day, minutes: (cur.ms - prev.ms) / 60_000 });
    }
  }
  return { pairs, battles: byBattle.size };
}

function b6() {
  const { pairs, battles } = battlePairs();
  const gaps = {}; let consecutive = 0; let crossDay = 0;
  for (const p of pairs) { inc(gaps, p.gap >= 5 ? '5+' : String(p.gap)); if (p.gap === 1) consecutive += 1; if (!p.sameDay) crossDay += 1; }
  const prevOf = new Map(pairs.map((p) => [`${p.cur.battleId}|${p.cur.evalId}`, p]));
  const perArm = {}; const exByArm = {};
  for (const arm of ARMS) {
    let rowsWithPrev = 0; let repeated = 0; let callsWithRows = 0; let callsRepeating = 0;
    let rowsConsec = 0; let repeatedConsec = 0; let invalidAmongRepeating = 0;
    exByArm[arm] = [];
    for (const p of pairs) for (const rep of REPS) {
      const x = A(arm, rep, p.cur); const xp = A(arm, rep, p.prev);
      if (!x.shots.length) continue;
      callsWithRows += 1;
      let any = false;
      for (const row of x.shots) {
        rowsWithPrev += 1; if (p.gap === 1) rowsConsec += 1;
        const match = xp.shots.find((q) => sameCall(row, q));
        if (!match) continue;
        repeated += 1; if (p.gap === 1) repeatedConsec += 1; any = true;
        exByArm[arm].push({ where: `${checkLabel(x)} · previous sampled check ${p.prev.evalId} (eval gap ${p.gap}, ${num(p.minutes, 0)} min${p.sameDay ? '' : ', across days'})`, previous: fmtRow(match), current: fmtRow(row) });
      }
      if (any) { callsRepeating += 1; if (!x.tradeValid) invalidAmongRepeating += 1; }
    }
    perArm[arm] = {
      pairs: pairs.length * REPS.length, callsWithRows, callsRepeating, rowsWithPrev, repeated, rowsConsec, repeatedConsec, invalidAmongRepeating,
      perBattleDay: perBattleDay(arm, (x) => {
        const p = prevOf.get(`${x.c.battleId}|${x.c.evalId}`);
        if (!p) return 0;
        const xp = A(arm, x.rep, p.prev);
        return x.shots.filter((row) => xp.shots.some((q) => sameCall(row, q))).length;
      }),
    };
  }
  return { checks: s.sample.length, battles, pairsPerRep: pairs.length, consecutive, crossDay, gaps, perArm, examples: pickExamples('B6', exByArm) };
}

// ---------------------------------------------------------------- B7 mix

const heldOrBench = (row, ctx) => (ctx.held.has(row.symbol) ? 'held' : ctx.bench.has(row.symbol) ? 'bench' : 'neither');

function b7() {
  const perArm = {}; const exByArm = {};
  for (const arm of ARMS) {
    const calls = callsOf(arm);
    const byArchetype = {};
    exByArm[arm] = [];
    for (const x of calls) for (const row of x.shots) if (row.direction === 'entry' && x.ctx.held.has(row.symbol)) exByArm[arm].push({ where: checkLabel(x), row: fmtRow(row) });
    const tab = (arch) => (byArchetype[arch] ??= { rows: 0, direction: {}, symbol: {}, defaultAction: {}, dirBySymbol: {}, dirByDefault: {}, kind: {} });
    let callsWithEntry = 0; let callsWithExit = 0;
    for (const x of calls) {
      if (x.shots.some((row) => row.direction === 'entry')) callsWithEntry += 1;
      if (x.shots.some((row) => row.direction === 'exit')) callsWithExit += 1;
      for (const row of x.shots) for (const arch of ['all', x.c.archetype]) {
        const t = tab(arch);
        const hb = heldOrBench(row, x.ctx);
        t.rows += 1; inc(t.direction, row.direction); inc(t.symbol, hb); inc(t.defaultAction, row.defaultAction);
        inc(t.dirBySymbol, `${row.direction} · ${hb}`); inc(t.dirByDefault, `${row.direction} · ${row.defaultAction}`);
        inc(t.kind, row.direction === 'entry' ? 'called_shot (entry)' : row.defaultAction === 'act' ? 'confirmation (exit · act)' : 'called_shot (exit · hold)');
      }
    }
    perArm[arm] = {
      calls: calls.length, callsWithEntry, callsWithExit, byArchetype,
      perBattleDay: {
        entry: perBattleDay(arm, (x) => x.shots.filter((row) => row.direction === 'entry').length),
        exit: perBattleDay(arm, (x) => x.shots.filter((row) => row.direction === 'exit').length),
        entryOnHeld: perBattleDay(arm, (x) => x.shots.filter((row) => row.direction === 'entry' && x.ctx.held.has(row.symbol)).length),
      },
    };
  }
  return { perArm, examples: pickExamples('B7', exByArm) };
}

// ---------------------------------------------------------------- B8 research-objective seeds

/** An exit row with no usable counterpart: absent, outside the universe, a held name, or a universe name the check's bench did not show. */
const noUsableCounterpart = (row, ctx) => row.direction === 'exit' && counterpartClass(row, ctx) !== 'bench (shown)';

function b8() {
  const perArm = {}; const exByArm = {};
  for (const arm of ARMS) {
    const calls = callsOf(arm);
    let exitRows = 0; let seeds = 0; const why = {}; const callsSeed = new Set(); let invalidAmongSeedCalls = 0;
    exByArm[arm] = [];
    for (const x of calls) {
      let any = false;
      for (const row of x.shots) {
        if (row.direction !== 'exit') continue;
        exitRows += 1;
        if (!noUsableCounterpart(row, x.ctx)) continue;
        seeds += 1; any = true; inc(why, counterpartClass(row, x.ctx));
        exByArm[arm].push({ where: checkLabel(x), row: fmtRow(row), why: counterpartClass(row, x.ctx) });
      }
      if (any) { callsSeed.add(x); if (!x.tradeValid) invalidAmongSeedCalls += 1; }
    }
    perArm[arm] = {
      calls: calls.length, exitRows, seeds, why, callsSeed: callsSeed.size, invalidAmongSeedCalls,
      perBattleDay: perBattleDay(arm, (x) => x.shots.filter((row) => noUsableCounterpart(row, x.ctx)).length),
      perBattleDayCalls: perBattleDay(arm, (x) => (x.shots.some((row) => noUsableCounterpart(row, x.ctx)) ? 1 : 0)),
      narrow: perBattleDay(arm, (x) => x.shots.filter((row) => row.direction === 'exit' && ['absent', 'not in universe'].includes(counterpartClass(row, x.ctx))).length),
    };
  }
  return { perArm, examples: pickExamples('B8', exByArm) };
}

// ---------------------------------------------------------------- B9 Tier 3 feasibility (bench-row fields)

/**
 * The bench rows a recorded live context shows, parsed from its three blocks:
 *   BENCH (available for swap):  Symbol,Sector,$Current,Daily%,ATR%,Status
 *   BENCH TECHNICAL CONTEXT:     per name — Trend, Momentum, Levels, Recent action, Volatility, Volume, Relative strength, Composite
 *   FUNDAMENTALS … BENCH:        per name — PE (sect med), P/B, rev growth, mcap, EPS rev 30d, beat rate, surprise pctl
 */
function benchRows(text) {
  const i = text.indexOf(`${BENCH_PRESENT}\n`);
  if (i < 0) return [];
  const csv = text.slice(i).split('\n\n')[0].split('\n');
  const cols = csv[1].split(',');
  if (cols.join(',') !== 'Symbol,Sector,$Current,Daily%,ATR%,Status') stop(`unexpected bench header: ${csv[1]}`);
  const rows = csv.slice(2).map((line) => {
    const f = line.split(',');
    return { symbol: f[0], sector: f[1], price: Number(f[2].replace('$', '')), dailyPct: parseFloat(f[3]), atrPct: parseFloat(f[4]), status: f.slice(5).join(','), tech: {}, fund: {} };
  });
  const bySym = new Map(rows.map((r) => [r.symbol, r]));
  const ti = text.indexOf('\n\nBENCH TECHNICAL CONTEXT:\n');
  const fi = text.indexOf('\n\nFUNDAMENTALS (held + bench');
  if (ti >= 0) {
    const block = text.slice(ti + 2, fi > ti ? fi : undefined);
    for (const entry of block.split('\n\n').slice(1)) {
      const lines = entry.split('\n');
      const sym = lines[0].split(' ')[0];
      const r = bySym.get(sym);
      if (!r) continue;
      for (const line of lines.slice(1)) {
        const m = /^ {2}([A-Za-z ]+): (.*)$/.exec(line);
        if (!m) continue;
        const [, key, val] = m;
        r.tech[key] = val;
        if (key === 'Trend') {
          const t = /short=(\w+), intermediate=(\w+), long=(\w+)/.exec(val); if (t) Object.assign(r, { trendShort: t[1], trendInter: t[2], trendLong: t[3] });
          const p = /sma200_position=([+-]?[\d.]+)%/.exec(val); if (p) r.sma200 = Number(p[1]);
        }
        if (key === 'Momentum') { const d = /divergence=(\w+)/.exec(val); if (d) r.divergence = d[1]; const rsi = /RSI=([\d.]+)/.exec(val); if (rsi) r.rsi = Number(rsi[1]); }
        if (key === 'Composite') { const c = /technicalScore=(\d+), technicalRank=(\d+)/.exec(val); if (c) { r.techScore = Number(c[1]); r.techRank = Number(c[2]); } }
        if (key === 'Volume') { const v = /RVOL=([\d.]+)/.exec(val); if (v) r.rvol = Number(v[1]); const tier = /^(\w+) tier/.exec(val); if (tier) r.volumeTier = tier[1]; }
        if (key === 'Relative strength') { const rs = /rsPercentile=(\d+)/.exec(val); if (rs) r.rsPct = Number(rs[1]); const srs = /sector RS=(\d+)/.exec(val); if (srs) r.sectorRs = Number(srs[1]); }
      }
    }
  }
  if (fi >= 0) {
    const fblock = text.slice(fi + 2).split('\n\nTRIGGER')[0];
    const bi = fblock.indexOf('\nBENCH:\n');
    if (bi >= 0) {
      for (const line of fblock.slice(bi + 8).split('\n')) {
        const m = /^(\S+) \([^)]*\): (.*)$/.exec(line);
        if (!m || !bySym.has(m[1])) continue;
        const r = bySym.get(m[1]);
        for (const part of m[2].split(' | ')) {
          const kv = /^([A-Za-z/ 0-9]+)=(\S+)/.exec(part);
          if (kv) r.fund[kv[1].trim()] = kv[2];
        }
        if (r.fund['rev growth'] != null) r.revGrowth = parseFloat(r.fund['rev growth']);
        if (r.fund['EPS rev 30d'] != null) r.epsRev = parseFloat(r.fund['EPS rev 30d']);
        if (r.fund['beat rate'] != null) r.beatRate = parseFloat(r.fund['beat rate']);
        if (r.fund.mcap != null) r.mcap = r.fund.mcap;
      }
    }
  }
  return rows;
}

/** Field coverage over every bench row of the 188 bench-bearing main-sample contexts. */
function fieldCoverage() {
  const fields = {
    'Sector (CSV)': (r) => !!r.sector, 'Daily% (CSV)': (r) => Number.isFinite(r.dailyPct), 'ATR% (CSV)': (r) => Number.isFinite(r.atrPct), 'Status (CSV)': (r) => !!r.status,
    'Trend short/intermediate/long': (r) => !!r.trendShort, sma200_position: (r) => Number.isFinite(r.sma200), 'Momentum divergence': (r) => !!r.divergence,
    'Momentum RSI': (r) => Number.isFinite(r.rsi), Levels: (r) => 'Levels' in r.tech, 'Recent action': (r) => 'Recent action' in r.tech,
    'Volatility (BB %B, ATR regime)': (r) => 'Volatility' in r.tech, 'Volume (tier, RVOL)': (r) => Number.isFinite(r.rvol), 'Relative strength (rsPercentile, sector RS)': (r) => Number.isFinite(r.rsPct),
    'Composite technicalScore/technicalRank': (r) => Number.isFinite(r.techScore), 'mcap (fundamentals)': (r) => !!r.mcap, 'rev growth': (r) => Number.isFinite(r.revGrowth),
    'EPS rev 30d': (r) => Number.isFinite(r.epsRev), 'beat rate': (r) => Number.isFinite(r.beatRate), 'surprise pctl': (r) => 'surprise pctl' in r.fund, PE: (r) => 'PE' in r.fund, 'P/B': (r) => 'P/B' in r.fund,
  };
  let rows = 0; let contexts = 0; let locked = 0; const have = {}; const mcap = {}; const divergence = {}; const statusKinds = {};
  for (const c of s.sample) {
    const list = benchRows(live(c));
    if (!list.length) continue;
    contexts += 1;
    for (const r of list) {
      rows += 1;
      if (r.status !== 'available') locked += 1;
      inc(statusKinds, r.status === 'available' ? 'available' : r.status.startsWith('locked until') ? 'locked until …' : r.status);
      for (const [name, has] of Object.entries(fields)) if (has(r)) inc(have, name);
      inc(mcap, r.mcap ?? '(none)'); inc(divergence, r.divergence ?? '(none)');
    }
  }
  return { contexts, rows, locked, statusKinds, coverage: Object.fromEntries(Object.keys(fields).map((k) => [k, have[k] || 0])), mcap, divergence };
}

/**
 * The B9 classification of every canonical directive on the TF and CN menus, by the criteria the
 * report states before any count: NOT — the directive is not a criterion on bench names (exit
 * timing, stops, sizing, the agent's own trade history); FEASIBLE — an entry criterion that a
 * field on (essentially) every bench row measures directly, needing only a threshold or cut on it;
 * PARTIAL — an entry criterion where a row field covers only part of it, covers only a minority of
 * rows, or is only a proxy. The `fields` text cites the recorded row format (see benchRows).
 */
const CLASSES = Object.freeze({
  'TF-01': { cls: 'partial', fields: '"extended / late-stage": Trend line `sma200_position` (every row). "fresh breakout": no field (no breakout date; `Levels` resistance distance on some rows only).' },
  'TF-02': { cls: 'partial', fields: '"confirmation": `Volume` tier/RVOL and MACD exist only on detail rows; `Trend` short/intermediate/long and `divergence` (every row) bear on it only indirectly.' },
  'TF-03': { cls: 'partial', fields: '"sector": CSV `Sector` (every row). "strongest": no sector-strength field on bench rows (`sector RS` on detail rows only); no sector ranking anywhere in the prompt.' },
  'TF-04': { cls: 'not', fields: 'Rotation timing for held winners — not a bench-name criterion.' },
  'TF-05': { cls: 'not', fields: 'Position size — no size field on any held or bench row.' },
  'TF-06': { cls: 'partial', fields: '"low-liquidity / thin": no volume or dollar-volume field on most rows; `mcap` class (fundamentals, every row) is a proxy; `Volume` tier/RVOL on detail rows only.' },
  'TF-07': { cls: 'feasible', fields: '"own technicals": `Composite` technicalScore / technicalRank (every row).' },
  'TF-08': { cls: 'not', fields: 'The agent\'s own failed breakouts (its history, `CLOSED TRADES THIS BATTLE` on some checks) — no per-name breakout-failure field; `Recent action` is one bar\'s pattern on some rows.' },
  'CN-01': { cls: 'partial', fields: '"oversold depth": `RSI` only on detail rows; `sma200_position` (every row) measures distance below the 200-day.' },
  'CN-02': { cls: 'partial', fields: '"turn / stabilization": `divergence` and `Trend` short vs intermediate (every row) are proxies; `Recent action` on some rows; no field names a turn.' },
  'CN-03': { cls: 'not', fields: 'The stop on held names — not a bench-name criterion.' },
  'CN-04': { cls: 'feasible', fields: '"out-of-favor / lagging": `sma200_position` and `Composite` technicalScore (every row).' },
  'CN-05': { cls: 'not', fields: 'Profit-taking on held names into resistance (held `Levels`) — not a bench-name criterion.' },
  'CN-06': { cls: 'feasible', fields: '"fundamental reason": the FUNDAMENTALS row — rev growth, EPS rev 30d, beat rate, surprise pctl, PE vs sector median (every row).' },
  'CN-07': { cls: 'not', fields: 'Position size — no size field on any held or bench row.' },
  'CN-08': { cls: 'not', fields: 'Patience before trimming held names — not a bench-name criterion.' },
});

/**
 * The B9 readings: the field reading of each directive whose class is feasible, or partial with a
 * field-decidable part. Each reading is the most literal one the field allows, with its open
 * parameter shown at three values. They are COUNTING READINGS, not proposed filters.
 */
const READINGS = Object.freeze([
  { id: 'TF-01', cls: 'partial', part: '"extended / late-stage" ← sma200_position (distance above the 200-day)', variants: [10, 20, 30].map((t) => ({ label: `sma200_position ≤ +${t}%`, pass: (r) => Number.isFinite(r.sma200) && r.sma200 <= t })) },
  { id: 'TF-03', cls: 'partial', part: '"sector" ← Sector (CSV); "strongest" has no row field — the bounds are the largest and the smallest one-sector group', sector: true },
  { id: 'TF-06', cls: 'partial', part: '"low-liquidity / thin" ← mcap class (fundamentals; a proxy) — volume/RVOL only on detail rows', variants: [{ label: 'mcap = large', pass: (r) => r.mcap === 'large' }, { label: 'mcap ∈ {large, mid}', pass: (r) => r.mcap === 'large' || r.mcap === 'mid' }, { label: 'RVOL ≥ 1.0 (rows carrying RVOL only)', pass: (r) => Number.isFinite(r.rvol) && r.rvol >= 1 }] },
  { id: 'TF-07', cls: 'feasible', part: '"the stock\'s own technicals" ← Composite technicalScore', variants: [70, 80, 90].map((t) => ({ label: `technicalScore ≥ ${t}`, pass: (r) => Number.isFinite(r.techScore) && r.techScore >= t })) },
  { id: 'CN-01', cls: 'partial', part: '"oversold depth" ← RSI (detail rows only); sma200_position (every row) as distance below the 200-day', variants: [{ label: 'RSI ≤ 30 (rows carrying RSI only)', pass: (r) => Number.isFinite(r.rsi) && r.rsi <= 30 }, { label: 'sma200_position < 0', pass: (r) => Number.isFinite(r.sma200) && r.sma200 < 0 }, { label: 'sma200_position ≤ −10%', pass: (r) => Number.isFinite(r.sma200) && r.sma200 <= -10 }] },
  { id: 'CN-02', cls: 'partial', part: '"technical turn / stabilization" ← Momentum divergence (every row); Trend short vs intermediate (every row)', variants: [{ label: 'divergence = bullish', pass: (r) => r.divergence === 'bullish' }, { label: 'trend short = up while intermediate = down', pass: (r) => r.trendShort === 'up' && r.trendInter === 'down' }, { label: 'either of the two', pass: (r) => r.divergence === 'bullish' || (r.trendShort === 'up' && r.trendInter === 'down') }] },
  { id: 'CN-04', cls: 'feasible', part: '"out-of-favor / lagging" ← sma200_position and Composite technicalScore', variants: [{ label: 'sma200_position < 0', pass: (r) => Number.isFinite(r.sma200) && r.sma200 < 0 }, { label: 'technicalScore ≤ 70', pass: (r) => Number.isFinite(r.techScore) && r.techScore <= 70 }, { label: 'technicalScore ≤ 60', pass: (r) => Number.isFinite(r.techScore) && r.techScore <= 60 }] },
  { id: 'CN-06', cls: 'feasible', part: '"a stronger fundamental reason" ← the FUNDAMENTALS row (rev growth, EPS rev 30d, beat rate)', variants: [{ label: 'rev growth > 0', pass: (r) => Number.isFinite(r.revGrowth) && r.revGrowth > 0 }, { label: 'EPS rev 30d > 0', pass: (r) => Number.isFinite(r.epsRev) && r.epsRev > 0 }, { label: 'beat rate ≥ 75%', pass: (r) => Number.isFinite(r.beatRate) && r.beatRate >= 75 }] },
]);

function b9() {
  const coverage = fieldCoverage();
  const menus = {
    momentum_chaser: getAllowlist('momentum_chaser').map((a) => ({ id: a.id, text: a.canonical })),
    contrarian: getAllowlist('contrarian').map((a) => ({ id: a.id, text: a.canonical })),
  };
  const s2Bench = s2.checks.map((c) => ({ c, rows: benchRows(c.request.messages[2].content) }));
  const stat = (xs) => ({ mean: mean(xs), median: lowerMedian(xs), min: xs.length ? Math.min(...xs) : null, max: xs.length ? Math.max(...xs) : null });
  const benchSizes = stat(s2Bench.map((b) => b.rows.length));
  const readings = [];
  for (const rd of READINGS) {
    const archetype = rd.id.startsWith('TF') ? 'momentum_chaser' : 'contrarian';
    const checks = s2Bench.filter((b) => b.c.archetype === archetype);
    if (rd.sector) {
      const largest = checks.map((b) => Math.max(...Object.values(b.rows.reduce((o, r) => inc(o, r.sector), {}))));
      const smallest = checks.map((b) => Math.min(...Object.values(b.rows.reduce((o, r) => inc(o, r.sector), {}))));
      const sectors = checks.map((b) => new Set(b.rows.map((r) => r.sector)).size);
      readings.push({ ...rd, archetype, checks: checks.length, sectorBounds: { sectorsOnBench: stat(sectors), largestGroup: stat(largest), smallestGroup: stat(smallest) } });
      continue;
    }
    readings.push({
      ...rd, archetype, checks: checks.length,
      results: rd.variants.map((v) => {
        const passes = checks.map((b) => b.rows.filter(v.pass).length);
        return { label: v.label, pass: stat(passes), zeroChecks: passes.filter((n) => n === 0).length, allChecks: checks.filter((b, i) => passes[i] === b.rows.length).length };
      }),
    });
  }
  // Each S2 check under ITS OWN drawn directive's reading (first variant), where one exists.
  const ownDirective = s2Bench.map(({ c, rows }) => {
    const rd = READINGS.find((x) => x.id === c.directive.adjustmentId);
    let reading = '—'; let passing = null;
    if (rd?.sector) { const groups = rows.reduce((o, r) => inc(o, r.sector), {}); reading = 'one sector (largest–smallest group)'; passing = `${Math.max(...Object.values(groups))}–${Math.min(...Object.values(groups))}`; }
    else if (rd) { reading = rd.variants[0].label; passing = String(rows.filter(rd.variants[0].pass).length); }
    return { battle: `${c.battleId.slice(0, 5)}…`, evalId: c.evalId, archetype: c.archetype, directive: c.directive.adjustmentId, bench: rows.length, locked: rows.filter((r) => r.status !== 'available').length, reading, passing };
  });
  return { coverage, menus, s2Checks: s2.checks.length, s2ByArchetype: s2.checks.reduce((o, c) => inc(o, c.archetype), {}), benchSizes, readings, ownDirective };
}

// ---------------------------------------------------------------- B10 calls per declaring call

/** The B10 buckets, in print order (an object would put the integer-like keys first). */
const B10_BUCKETS = Object.freeze(['0 (watching / playerAsk only)', '1', '2', '3', '4+']);
const bucketOf = (n) => (n === 0 ? B10_BUCKETS[0] : n >= 4 ? '4+' : String(n));
const bucketLine = (o) => B10_BUCKETS.map((b) => `${b.startsWith('0') ? '0' : b}: ${o[b] || 0}`).join(' · ');

function b10() {
  const perArm = {}; const exByArm = {};
  for (const arm of ARMS) {
    const dist = {}; const byRep = { 1: {}, 2: {} };
    let declaring = 0; let max = 0;
    const byArchetype = {};
    exByArm[arm] = [];
    for (const x of callsOf(arm)) {
      if (x.phase !== 'expected') continue;
      declaring += 1;
      const n = x.calls.length; max = Math.max(max, n);
      if (n >= 4) exByArm[arm].push({ where: checkLabel(x), rows: x.shots.map(fmtRow) });
      const bucket = bucketOf(n);
      inc(dist, bucket); inc(byRep[x.rep], bucket);
      inc((byArchetype[x.c.archetype] ??= {}), bucket);
    }
    perArm[arm] = {
      calls: s.sample.length * REPS.length, declaring, dist, byRep, byArchetype, max,
      perBattleDay: perBattleDay(arm, (x) => (x.phase === 'expected' ? x.calls.length : 0)),
      declaringPerBattleDay: perBattleDay(arm, (x) => (x.phase === 'expected' ? 1 : 0)),
    };
  }
  return { perArm, examples: pickExamples('B10', exByArm) };
}

// ---------------------------------------------------------------- run

const cross = crossCheckRound3();
const out = {
  inputs: {
    sampleSha256: sha256(readFileSync(path.join(RAW, 'sample.json'))),
    s2Sha256: sha256(readFileSync(path.join(RAW, 's2.json'))),
    resultsSha256: sha256(readFileSync(path.join(RAW, 'results.json'))),
    callFiles: callFiles.length, callsDigest: callsDigest.digest('hex'),
    universeBuilder: builderProof,
    checks: s.sample.length, battles: new Set(s.sample.map((c) => c.battleId)).size,
    battleDays: new Set(s.sample.map(battleDayKey)).size,
    byArchetype: s.sample.reduce((o, c) => inc(o, c.archetype), {}),
    tradeInvalidCalls: Object.fromEntries(ARMS.map((arm) => [arm, callsOf(arm).filter((x) => !x.tradeValid).length])),
  },
  crossCheck: cross,
  B1: b1(), B2: b2(), B3: b3(), B4: b4(), B5: b5(), B6: b6(), B7: b7(), B8: b8(), B9: b9(), B10: b10(),
};

// ---------------------------------------------------------------- markdown

const L = [];
const p = (line = '') => L.push(line);
const armHead = `| Measure | ${ARMS.map((a) => (a === PRIMARY ? `**${a}** (primary)` : a)).join(' | ')} |`;
const armSep = `|---|${ARMS.map(() => '---').join('|')}|`;
const armRow = (label, f) => p(`| ${label} | ${ARMS.map((a) => f(a)).join(' | ')} |`);
const examples = (list, render) => { if (!list.length) { p('_No example exists in any arm._'); return; } list.forEach((e, i) => render(e, i + 1)); };
const mixStr = (o) => (Object.keys(o).length ? sortedEntries(o).map(([k, v]) => `${k} ${v}`).join(', ') : '—');

p('<!-- generated by scripts/build2-discovery-counts.mjs — do not edit by hand -->');
p('### Inputs and the cross-check');
p();
p(`- Raw folder: \`experiments/declarations-wording/raw/round3/\` — \`sample.json\` SHA-256 \`${out.inputs.sampleSha256.slice(0, 16)}…\`, \`s2.json\` \`${out.inputs.s2Sha256.slice(0, 16)}…\`, \`results.json\` \`${out.inputs.resultsSha256.slice(0, 16)}…\`, ${out.inputs.callFiles} call records (digest \`${out.inputs.callsDigest.slice(0, 16)}…\`).`);
p(`- Main sample: ${out.inputs.checks} checks, ${out.inputs.battles} battles, ${out.inputs.battleDays} battle-days (${mixStr(out.inputs.byArchetype)}); ${s.sample.length * REPS.length} calls per arm (2 reps).`);
p(`- Universe builder: this script's \`promptSymbols\` equals round 3's byte for byte, and round 3's \`analyze3\` validated with roster ∪ \`promptSymbols\` (asserted against \`scripts/declarations-wording-experiment.mjs\` at SHA-256 \`${builderProof.experimentScriptSha256.slice(0, 16)}…\`, LF-normalized).`);
p(`- **Kept rows reproduce round 3's published counts exactly** (declaring calls, minted calls per declaring call, kind mix, horizon mix, removals, per battle-day pacing): ${cross.map((c) => `${c.arm} ${c.declaringCalls} / ${c.calls} declaring`).join(' · ')}. The script stops before printing anything if any of these differs.`);
p(`- Trade-invalid calls (production captures declarations only on a valid trade result): ${ARMS.map((a) => `${a} ${out.inputs.tradeInvalidCalls[a]}`).join(' · ')} of 386. Counts below include them, as round 3's declaration measures do; each count states how many of its hits sit on such a call.`);
p();

// B1
p('### B1 — Crossroads Tier 1: one slot, two or more incoming names');
p();
p('Incoming = an entry row\'s `symbol`, or an exit row\'s `counterpart`; only names in the check\'s universe count (the unfiltered figure is shown beside). "Same swap-out" = two incoming names for the same outgoing name (an entry row\'s `counterpart`, or an exit row\'s own `symbol`).');
p();
p(armHead); p(armSep);
armRow('Calls with ≥ 1 qualifying slot (per call; as defined)', (a) => frac(out.B1.perArm[a].asDefined.hits, out.B1.perArm[a].calls));
armRow('…of calls with ≥ 2 kept called shots', (a) => frac(out.B1.perArm[a].asDefined.hits, out.B1.perArm[a].multiShot));
armRow('…without the universe filter', (a) => frac(out.B1.perArm[a].unfiltered.hits, out.B1.perArm[a].calls));
armRow('Qualifying slots, by row mix', (a) => `${out.B1.perArm[a].asDefined.slots}: ${mixStr(out.B1.perArm[a].asDefined.mix)}`);
armRow('…of which ≥ 2 incoming names share one swap-out', (a) => frac(out.B1.perArm[a].asDefined.sameSwapOutSlots, out.B1.perArm[a].asDefined.slots));
armRow('**With held names excluded from "incoming"** (per call)', (a) => frac(out.B1.perArm[a].notHeld.hits, out.B1.perArm[a].calls));
armRow('…qualifying slots, by row mix · sharing one swap-out', (a) => `${out.B1.perArm[a].notHeld.slots}: ${mixStr(out.B1.perArm[a].notHeld.mix)} · ${out.B1.perArm[a].notHeld.sameSwapOutSlots}`);
armRow('Hits on a trade-invalid call (as defined · held excluded)', (a) => `${out.B1.perArm[a].asDefined.invalidAmongHits} · ${out.B1.perArm[a].notHeld.invalidAmongHits}`);
armRow('Per battle-day (qualifying calls, as defined)', (a) => bdLine(out.B1.perArm[a].perBattleDay));
armRow('Per battle-day (qualifying calls, held excluded)', (a) => bdLine(out.B1.perArm[a].perBattleDayNotHeld));
p();
p('Examples (verbatim kept rows of the qualifying slot; held-excluded hits first):');
p();
examples(out.B1.examples, (e, i) => { p(`${i}. [${e.arm}] ${e.where} — ${e.variant}`); for (const sl of e.slots) { p(`   - slot **${sl.slot}** (${sl.mix}${sl.sameSwapOut ? ', same swap-out' : ''})`); for (const r of sl.rows) p(`     - ${r}`); } });
p();

// B2
p('### B2 — Tier 2: `anticipationCandidates` (raw tool input)');
p();
p(armHead); p(armSep);
armRow('Calls with ≥ 1 candidate (per call)', (a) => frac(out.B2.perArm[a].callsWith, out.B2.perArm[a].calls));
armRow('Candidates', (a) => String(out.B2.perArm[a].candidates));
armRow('Key sets (sorted keys: count)', (a) => mixStr(out.B2.perArm[a].keySets));
armRow('`direction` values', (a) => mixStr(out.B2.perArm[a].directions));
armRow('`direction` × the symbol as the prompt showed it', (a) => mixStr(out.B2.perArm[a].symbolShownAs));
armRow('Keys outside the schema\'s six', (a) => mixStr(out.B2.perArm[a].extraKeys));
armRow('Candidates carrying a `slot`/`tier`-named key', (a) => String(out.B2.perArm[a].slotKeyed));
armRow('Candidates whose text names a tier word (star/core/support)', (a) => `${frac(out.B2.perArm[a].withTierWord, out.B2.perArm[a].candidates)}: ${mixStr(out.B2.perArm[a].tierWordIn)}`);
armRow('Calls with ≥ 2 distinct `potential_entry` symbols', (a) => frac(out.B2.perArm[a].twoPlusEntry, out.B2.perArm[a].calls));
armRow('…of which ≥ 2 are names the check\'s bench showed (any could take any slot)', (a) => frac(out.B2.perArm[a].twoPlusEntryBench, out.B2.perArm[a].calls));
armRow('…of which ≥ 2 name the same tier word', (a) => frac(out.B2.perArm[a].twoPlusEntrySameTierWord, out.B2.perArm[a].calls));
armRow('Calls with candidates on a trade-invalid result', (a) => String(out.B2.perArm[a].invalidAmongCallsWith));
armRow('Per battle-day (calls with ≥ 2 entry candidates)', (a) => bdLine(out.B2.perArm[a].perBattleDay));
p();
p('Examples (calls whose `potential_entry` candidates name the same tier word; verbatim `signalSummary` and `threshold`):');
p();
examples(out.B2.examples, (e, i) => { p(`${i}. [${e.arm}] ${e.where}`); for (const cand of e.candidates) p(`   - \`${cand.symbol}\` — "${cand.signalSummary}" / "${cand.threshold}"`); });
p();

// B3
p('### B3 — Prose alternatives in a kept `said` ("X or Y", "X/Y")');
p();
p('A run of tickers joined by "or" or "/" (commas allowed inside; a comma-only list is not counted), with ≥ 2 distinct names in the check\'s universe. Lexical.');
p();
p(armHead); p(armSep);
armRow('Kept called-shot rows naming alternatives', (a) => frac(out.B3.perArm[a].hitRows, out.B3.perArm[a].rows));
armRow('Calls with ≥ 1 such row (per call)', (a) => frac(out.B3.perArm[a].callsHit, out.B3.perArm[a].calls));
armRow('Typed `counterpart` is one of the named alternatives', (a) => frac(out.B3.perArm[a].counterpartIn, out.B3.perArm[a].hitRows));
armRow('Typed `counterpart` present but not among them', (a) => frac(out.B3.perArm[a].counterpartOther, out.B3.perArm[a].hitRows));
armRow('No typed `counterpart`', (a) => frac(out.B3.perArm[a].counterpartAbsent, out.B3.perArm[a].hitRows));
armRow('The row\'s own `symbol` is one of them', (a) => frac(out.B3.perArm[a].symbolIn, out.B3.perArm[a].hitRows));
armRow('Hit rows on a trade-invalid call', (a) => String(out.B3.perArm[a].invalidAmongHitRows));
armRow('Per battle-day (hit rows)', (a) => bdLine(out.B3.perArm[a].perBattleDay));
p();
p('Examples:');
p();
examples(out.B3.examples, (e, i) => { p(`${i}. [${e.arm}] ${e.where} — alternatives ${e.groups.map((g) => `{${g}}`).join(' ')}`); p(`   - ${e.row}`); });
p();

// B4
p('### B4 — Stray top-level `watching` / `fork` / `playerAsk` (raw tool input)');
p();
p(armHead); p(armSep);
armRow('Calls with any of the three at top level (per call)', (a) => frac(out.B4.perArm[a].anyOfThree, out.B4.perArm[a].calls));
for (const key of ['watching', 'fork', 'playerAsk']) armRow(`Top-level \`${key}\` present · value types`, (a) => `${frac(out.B4.perArm[a].present[key], out.B4.perArm[a].calls)} · ${mixStr(out.B4.perArm[a].valueTypes[key])}`);
armRow('Top-level `watching` non-empty (of all calls)', (a) => frac(out.B4.perArm[a].nonEmptyWatching, out.B4.perArm[a].calls));
armRow('…of calls where it is present', (a) => frac(out.B4.perArm[a].nonEmptyWatching, out.B4.perArm[a].present.watching));
armRow('Element types · elements in the check\'s universe', (a) => `${mixStr(out.B4.perArm[a].elementTypes)} · ${frac(out.B4.perArm[a].elementsInUniverse, out.B4.perArm[a].elements)}`);
armRow('For comparison: calls with a non-empty KEPT `declarations.watching` · its symbols', (a) => `${frac(out.B4.perArm[a].keptDeclWatchingCalls, out.B4.perArm[a].calls)} · ${out.B4.perArm[a].keptDeclWatchingSymbols}`);
armRow('Top-level symbols also in kept `declarations.watching`', (a) => frac(out.B4.perArm[a].symbolOverlap.inDeclarationsWatching, out.B4.perArm[a].symbolOverlap.topLevelSymbols));
armRow('Top-level symbols also among `anticipationCandidates`', (a) => frac(out.B4.perArm[a].symbolOverlap.inAnticipation, out.B4.perArm[a].symbolOverlap.topLevelSymbols));
armRow('Top-level symbols in either', (a) => frac(out.B4.perArm[a].symbolOverlap.inEither, out.B4.perArm[a].symbolOverlap.topLevelSymbols));
armRow('Calls (non-empty top-level) overlapping `declarations.watching` · wholly inside it', (a) => `${frac(out.B4.perArm[a].callsOverlapDW, out.B4.perArm[a].nonEmptyWatching)} · ${frac(out.B4.perArm[a].callsSubsetDW, out.B4.perArm[a].nonEmptyWatching)}`);
armRow('Calls (non-empty top-level) overlapping `anticipationCandidates`', (a) => frac(out.B4.perArm[a].callsOverlapAC, out.B4.perArm[a].nonEmptyWatching));
armRow('Calls with non-empty top-level `watching` and a null/absent `declarations` block', (a) => frac(out.B4.perArm[a].callsDeclNullTWNonEmpty, out.B4.perArm[a].nonEmptyWatching));
armRow('Non-null top-level `fork` · `playerAsk` (shapes)', (a) => `${out.B4.perArm[a].nonNullForks} · ${out.B4.perArm[a].nonNullAsks} (${mixStr(out.B4.perArm[a].nonNullAskShapes)})`);
armRow('Per battle-day (calls with non-empty top-level `watching`)', (a) => bdLine(out.B4.perArm[a].perBattleDay));
p();
p('Examples (verbatim top-level `watching` beside the kept `declarations.watching` and the candidate symbols):');
p();
examples(out.B4.examples, (e, i) => p(`${i}. [${e.arm}] ${e.where} — top-level ${JSON.stringify(e.topLevelWatching)} · declarations.watching ${JSON.stringify(e.declarationsWatching)} · anticipationCandidates ${JSON.stringify(e.anticipationSymbols)} · declarations block ${e.declarationsBlock}`));
p();

// B5
p('### B5 — Counterparts outside the check\'s universe');
p();
p(armHead); p(armSep);
armRow('Kept called-shot rows with a `counterpart`', (a) => frac(out.B5.perArm[a].withCounterpart, out.B5.perArm[a].rows));
armRow('…outside the check\'s universe', (a) => frac(out.B5.perArm[a].outside, out.B5.perArm[a].withCounterpart));
armRow('Calls with ≥ 1 such row (per call)', (a) => frac(out.B5.perArm[a].callsOutside, out.B5.perArm[a].calls));
armRow('Every value outside the universe (count)', (a) => mixStr(out.B5.perArm[a].outsideValues));
armRow('Exit rows: counterpart class', (a) => mixStr(out.B5.perArm[a].byDirection.exit));
armRow('Entry rows: counterpart class', (a) => mixStr(out.B5.perArm[a].byDirection.entry));
armRow('Outside-universe rows on a trade-invalid call', (a) => String(out.B5.perArm[a].invalidAmongOutside));
armRow('Per battle-day (outside-universe rows)', (a) => bdLine(out.B5.perArm[a].perBattleDay));
p();
p('Examples:');
p();
examples(out.B5.examples, (e, i) => p(`${i}. [${e.arm}] ${e.where} — ${e.row}`));
p();

// B6
const b6o = out.B6;
p('### B6 — Repeats: a kept call matching the previous sampled check\'s');
p();
p(`Match = same \`symbol\`, \`direction\`, \`slot\` and \`side\`, level within ${LEVEL_TOLERANCE * 100} % of the previous level; each rep against the same rep. **Sampled checks:** ${b6o.checks} in ${b6o.battles} battles give ${b6o.pairsPerRep} (previous, current) pairs per rep; **${b6o.consecutive} of ${b6o.pairsPerRep} are consecutive evaluations** (eval number + 1); eval gaps: ${mixStr(b6o.gaps)}; ${b6o.crossDay} pairs cross an ET day.`);
p();
p(armHead); p(armSep);
armRow('Calls with kept rows and a previous sampled check', (a) => String(b6o.perArm[a].callsWithRows));
armRow('…with ≥ 1 repeated call (per call)', (a) => frac(b6o.perArm[a].callsRepeating, b6o.perArm[a].callsWithRows));
armRow('Kept rows that repeat the previous check\'s', (a) => frac(b6o.perArm[a].repeated, b6o.perArm[a].rowsWithPrev));
armRow('…on consecutive-evaluation pairs only', (a) => frac(b6o.perArm[a].repeatedConsec, b6o.perArm[a].rowsConsec));
armRow('Repeating calls on a trade-invalid result', (a) => String(b6o.perArm[a].invalidAmongRepeating));
armRow('Per battle-day (repeated rows)', (a) => bdLine(b6o.perArm[a].perBattleDay));
p();
p('Examples (previous → current, verbatim):');
p();
examples(b6o.examples, (e, i) => { p(`${i}. [${e.arm}] ${e.where}`); p(`   - previous: ${e.previous}`); p(`   - current: ${e.current}`); });
p();

// B7
p('### B7 — Mix of kept called-shot rows');
p();
for (const arm of ARMS) {
  const x = out.B7.perArm[arm];
  p(`**${arm}${arm === PRIMARY ? ' (primary)' : ''}** — calls with ≥ 1 entry row ${frac(x.callsWithEntry, x.calls)}; with ≥ 1 exit row ${frac(x.callsWithExit, x.calls)}.`);
  p();
  p('| Archetype | Rows | Direction | Symbol (shown in the prompt as) | Default | Direction × symbol | Kind (contract mapping) |');
  p('|---|---|---|---|---|---|---|');
  for (const arch of ['all', 'momentum_chaser', 'contrarian']) {
    const t = x.byArchetype[arch];
    if (!t) { p(`| ${arch} | 0 | — | — | — | — | — |`); continue; }
    p(`| ${arch} | ${t.rows} | ${mixStr(t.direction)} | ${mixStr(t.symbol)} | ${mixStr(t.defaultAction)} | ${mixStr(t.dirBySymbol)} | ${mixStr(t.kind)} |`);
  }
  p();
  p(`Per battle-day — entry rows: ${bdLine(x.perBattleDay.entry)}; exit rows: ${bdLine(x.perBattleDay.exit)}; entry rows on a held symbol: ${bdLine(x.perBattleDay.entryOnHeld)}.`);
  p();
}
p('Examples (entry rows whose symbol the check showed as HELD — "entry · held" above):');
p();
examples(out.B7.examples, (e, i) => p(`${i}. [${e.arm}] ${e.where} — ${e.row}`));
p();

// B8
p('### B8 — Research-objective seeds: exit calls with no usable counterpart');
p();
p('No usable counterpart = the `counterpart` is absent, outside the universe, a held name, or a universe name the check\'s bench did not show. "Narrow" counts only absent or outside-the-universe.');
p();
p(armHead); p(armSep);
armRow('Kept exit rows with no usable counterpart', (a) => frac(out.B8.perArm[a].seeds, out.B8.perArm[a].exitRows));
armRow('…why', (a) => mixStr(out.B8.perArm[a].why));
armRow('Calls with ≥ 1 such row (per call)', (a) => frac(out.B8.perArm[a].callsSeed, out.B8.perArm[a].calls));
armRow('Seed calls on a trade-invalid result', (a) => String(out.B8.perArm[a].invalidAmongSeedCalls));
armRow('**Per battle-day (seed rows)**', (a) => bdLine(out.B8.perArm[a].perBattleDay));
armRow('Per battle-day (calls with ≥ 1 seed)', (a) => bdLine(out.B8.perArm[a].perBattleDayCalls));
armRow('Per battle-day (narrow: absent or outside the universe)', (a) => bdLine(out.B8.perArm[a].narrow));
p();
p('Examples:');
p();
examples(out.B8.examples, (e, i) => p(`${i}. [${e.arm}] ${e.where} — ${e.why} — ${e.row}`));
p();

// B9
const b9o = out.B9;
p('### B9 — Tier 3 feasibility: bench-row fields, and the 40 S2 checks');
p();
p(`**Field coverage** over every bench row the ${b9o.coverage.contexts} bench-bearing main-sample contexts show (${b9o.coverage.rows} rows; status ${mixStr(b9o.coverage.statusKinds)}):`);
p();
p('| Field | Rows carrying it |');
p('|---|---|');
for (const [k, v] of Object.entries(b9o.coverage.coverage)) p(`| ${k} | ${frac(v, b9o.coverage.rows)} |`);
p();
p(`mcap classes: ${mixStr(b9o.coverage.mcap)}. Momentum divergence: ${mixStr(b9o.coverage.divergence)}.`);
p();
p('**Every canonical directive on the two menus** (`getAllowlist`, `src/data/archetypeAdjustments.js`), classified by the stated criteria:');
p();
p('| Id | Canonical text | Class | Bench-row fields (recorded row format) |');
p('|---|---|---|---|');
for (const arch of ['momentum_chaser', 'contrarian']) for (const d of b9o.menus[arch]) {
  const k = CLASSES[d.id];
  if (!k) stop(`${d.id} has no B9 class`);
  p(`| ${d.id} | ${d.text} | ${k.cls} | ${k.fields} |`);
}
p();
p(`**The 40 S2 checks** (${mixStr(b9o.s2ByArchetype)}): bench size ${num(b9o.benchSizes.mean)} · ${num(b9o.benchSizes.median)} · ${b9o.benchSizes.min}–${b9o.benchSizes.max} names. Pass counts are over every bench name shown (locked names included), for the checks of the directive's own archetype; mean · median · min–max per check.`);
p();
p('| Directive | Class | Field-decidable part | Reading (counting only, not a proposal) | Checks | Names passing | Checks with 0 · with all |');
p('|---|---|---|---|---|---|---|');
for (const rd of b9o.readings) {
  if (rd.sectorBounds) {
    const sb = rd.sectorBounds;
    p(`| ${rd.id} | ${rd.cls} | ${rd.part} | keep one sector | ${rd.checks} | largest group ${num(sb.largestGroup.mean)} · ${num(sb.largestGroup.median)} · ${sb.largestGroup.min}–${sb.largestGroup.max}; smallest ${num(sb.smallestGroup.mean)} · ${num(sb.smallestGroup.median)} · ${sb.smallestGroup.min}–${sb.smallestGroup.max} (sectors on the bench ${num(sb.sectorsOnBench.mean)} · ${num(sb.sectorsOnBench.median)} · ${sb.sectorsOnBench.min}–${sb.sectorsOnBench.max}) | — |`);
    continue;
  }
  rd.results.forEach((res, i) => p(`| ${i === 0 ? rd.id : ''} | ${i === 0 ? rd.cls : ''} | ${i === 0 ? rd.part : ''} | ${res.label} | ${rd.checks} | ${num(res.pass.mean)} · ${num(res.pass.median)} · ${res.pass.min}–${res.pass.max} | ${res.zeroChecks} · ${res.allChecks} |`));
}
p();
p('Each S2 check under its own drawn directive\'s first reading (— = no field-decidable part):');
p();
p('| Battle | evalId | Archetype | Directive | Bench (locked) | Reading | Passing |');
p('|---|---|---|---|---|---|---|');
for (const r of b9o.ownDirective) p(`| \`${r.battle}\` | ${r.evalId} | ${r.archetype} | ${r.directive} | ${r.bench} (${r.locked}) | ${r.reading} | ${r.passing ?? '—'} |`);
p();

// B10
p('### B10 — Minted calls per declaring call');
p();
p(armHead); p(armSep);
armRow('Declaring calls (per call)', (a) => frac(out.B10.perArm[a].declaring, out.B10.perArm[a].calls));
for (const bucket of B10_BUCKETS) armRow(`…with ${bucket} minted`, (a) => frac(out.B10.perArm[a].dist[bucket] || 0, out.B10.perArm[a].declaring));
armRow('Largest', (a) => String(out.B10.perArm[a].max));
armRow('Rep 1 / rep 2', (a) => REPS.map((rep) => `rep ${rep} — ${bucketLine(out.B10.perArm[a].byRep[rep])}`).join('; '));
armRow('By archetype', (a) => Object.keys(out.B10.perArm[a].byArchetype).sort().map((k) => `${k} — ${bucketLine(out.B10.perArm[a].byArchetype[k])}`).join('; '));
armRow('Per battle-day (minted calls)', (a) => bdLine(out.B10.perArm[a].perBattleDay));
armRow('Per battle-day (declaring calls)', (a) => bdLine(out.B10.perArm[a].declaringPerBattleDay));
p();
p('Examples (declaring calls with 4 or more minted calls; their kept rows):');
p();
examples(out.B10.examples, (e, i) => { p(`${i}. [${e.arm}] ${e.where}`); for (const r of e.rows) p(`   - ${r}`); });
p();

const markdown = `${L.join('\n')}\n`;
process.stdout.write(markdown);
const jsonArg = process.argv.find((a) => a.startsWith('--json='));
if (jsonArg) writeFileSync(jsonArg.slice('--json='.length), `${JSON.stringify(out, null, 1)}\n`);
