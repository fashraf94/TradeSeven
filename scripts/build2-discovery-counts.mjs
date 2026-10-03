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
// CODE comes from the repo at HEAD: the calls validator, the horizon resolver, the trade
// validator, and the TF / CN menus (getAllowlist) that B9 classifies. One source file is read as
// TEXT: scripts/declarations-wording-experiment.mjs, to prove the per-check universe builder
// copied below is round 3's, byte for byte (that script cannot be imported — it dispatches a
// command at load). No Firestore, no network, no API key, no clock in the output. The only write
// is the optional --json=<path>, which refuses any path inside the raw folder. Same inputs →
// byte-identical output.
//
// KEPT ROWS: the calls validator (api/_utils/callRecords/validate.js captureDeclarations) called
// exactly as round 3's analyze3 calls it — horizon bound to the check's own instants, universe =
// the battle roster as read on 2026-10-02 plus every held and bench name the check's prompt
// showed. Raw tool input is used only where a count says raw (B2, B4), and those counts' examples
// are raw tool fields; every other example is a kept row.
//
// UNITS: a "model call" is one replayed model response (193 checks × 2 reps = 386 per arm); a
// "called shot" is one kept calledShots row (it would mint one call record).
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

/** The optional JSON output path; never inside the raw folder (the raw files feed committed pins). */
const jsonArg = process.argv.find((a) => a.startsWith('--json='));
const JSON_OUT = jsonArg ? path.resolve(jsonArg.slice('--json='.length)) : null;
if (JSON_OUT) {
  // Inside = a relative path whose first segment is not `..` (a file NAMED `..x` is inside; review L5-4).
  const rel = path.relative(path.resolve(ROOT, 'experiments', 'declarations-wording', 'raw'), JSON_OUT);
  if (!path.isAbsolute(rel) && rel.split(/[\\/]/)[0] !== '..') stop(`--json must not point inside the raw folder (${JSON_OUT})`);
}

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
const callsDigestHex = callsDigest.digest('hex');

/**
 * Round 3's raw files as recorded: the SHA-256 of each JSON file, and of the calls as a digest of
 * every record's file name and hash. Every count below is defined over exactly these bytes, so any
 * other bytes stop the script — a count check alone passes a same-count swap (review V6-2). The
 * cross-check against results.json then proves the CODE (the kept-row pipeline) reproduces round 3.
 */
const RAW_PINS = Object.freeze({
  'sample.json': 'fd8cd0c4990581c9ddaf34b54cc1af2306273315de75f279552b62a857cace2b',
  's2.json': '404fc7fd3adf847ef2195516c1472d126f02546439b2d9061d810a51137273de',
  'results.json': '934a37e584c4d996f7854eb239bfa32ef85e20acfeaa85f79077b245cc18e556',
  'calls/': 'db5e8352a233f0ba9a90751d7ff76013ead02b54be4670b61b4546179aa9616c',
});
const rawHashes = {
  'sample.json': sha256(readFileSync(path.join(RAW, 'sample.json'))),
  's2.json': sha256(readFileSync(path.join(RAW, 's2.json'))),
  'results.json': sha256(readFileSync(path.join(RAW, 'results.json'))),
  'calls/': callsDigestHex,
};
const rawMismatch = Object.keys(RAW_PINS).filter((k) => rawHashes[k] !== RAW_PINS[k]);
if (rawMismatch.length) stop(`the raw folder is not round 3's as recorded: ${rawMismatch.map((k) => `${k} ${rawHashes[k].slice(0, 16)}…, expected ${RAW_PINS[k].slice(0, 16)}…`).join('; ')}`);

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

/**
 * The experiment script as round 3 was analyzed with it (SHA-256 of its LF-normalized text). Any
 * edit to it stops this script: the proofs below read its text, and a substring test alone would
 * pass with the analyze3 line commented out (review L5-3).
 */
const EXPERIMENT_SCRIPT_SHA256 = '1cc9504cc287d2daab0e98b30e482dcad65368a5a146f6ba5a059e79ba67e0dd';

/** Prove the copy above is round 3's builder and that round 3 validated with exactly this universe. */
function assertUniverseBuilderIsRound3s() {
  const lf = (t) => t.replace(/\r\n/g, '\n');
  const src = lf(readFileSync(EXPERIMENT_SCRIPT, 'utf8'));
  const srcSha256 = sha256(Buffer.from(src, 'utf8'));
  if (srcSha256 !== EXPERIMENT_SCRIPT_SHA256) stop(`the experiment script is not the one round 3 was analyzed with (SHA-256 ${srcSha256.slice(0, 16)}…, expected ${EXPERIMENT_SCRIPT_SHA256.slice(0, 16)}…)`);
  const start = src.indexOf('function promptSymbols(live) {');
  const end = src.indexOf('\n}\n', start);
  if (start < 0 || end < 0) stop('promptSymbols is no longer in the experiment script');
  if (src.slice(start, end + 2) !== lf(promptSymbols.toString())) stop("this script's promptSymbols is not round 3's, byte for byte");
  if (!src.includes(`const BENCH_PRESENT = '${BENCH_PRESENT}';`)) stop("BENCH_PRESENT differs from round 3's");
  const r3Validate = "const validate = validateWith((c) => [...new Set([...meta[c.battleId].universe, ...promptSymbols(c.request.messages[2].content)])]);";
  // A line of its own, not behind `//`. (A `/* */` block would still pass this; the SHA-256 pin
  // above is what holds the analyze3 line in place — review V6-4.)
  if (!src.split('\n').some((line) => line.trim() === r3Validate)) stop("round 3's analyze3 no longer validates with roster ∪ promptSymbols");
  return { experimentScriptSha256: srcSha256 };
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
    // A bench row's Status is 'available' or 'locked until …' (a cooldown the swap refuses,
    // api/_utils/agentSwapExecution.js:59-62; rendered at agentEvalPromptAssembly.js:1505-1511).
    const benchAvailable = new Set(benchRows(text).filter((r) => r.status === 'available').map((r) => r.symbol));
    const universe = [...new Set([...meta[c.battleId].universe, ...promptSymbols(text)])];
    ctxCache.set(k, {
      held, bench, benchAvailable, universe, U: new Set(universe),
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

/**
 * The kept-row pipeline must reproduce round 3's own published numbers, or nothing is reported.
 * INPUTS: the sampled checks, the S2 checks, and the main, S2 and total record counts. COUNTS, per
 * arm: model calls, declaring calls, minted calls per declaring call, kind mix, horizon mix,
 * removals, per battle-day pacing (checks, declaring, minted), round 3's per-archetype battle-day
 * statistics (mean, lower median, min, max — which pins the median convention), and the total kept
 * called shots, counted from the rows every section reads, which must equal the rows behind the
 * calls compared here. ROWS: round 3's five example blocks per arm must equal the kept blocks for
 * the same check and rep, field for field, and every shot round 3 sampled (said.random20,
 * said.sample) must be a kept row with the same symbol, horizon and sentence. What this cannot
 * exercise, and the report says so: round 3 has no fork (the universe only judges forks) and no
 * horizon-based removal, so neither the universe nor the horizon binding moves any number compared
 * here; and a field edited on a row round 3 neither counted by value nor sampled is invisible to
 * it (the raw pins above catch any such edit).
 */
function crossCheckRound3() {
  // The inputs themselves: the sample, the S2 set and the record counts round 3 reports (review L5-2, L5-5).
  const mainRecords = [...records.keys()].filter((k) => k.endsWith('|main')).length;
  const inputs = {
    checksSampled: s.sample.length === r3.checksSampled && s.sample.length === r3.checksComplete,
    s2Checks: s2.checks.length === r3.s2Checks && s2.checks.length === r3.s2Complete,
    mainRecords: mainRecords === r3.callsReturned.main,
    s2Records: records.size - mainRecords === r3.callsReturned.s2,
    recordFiles: callFiles.length === r3.submitted,
  };
  if (!Object.values(inputs).every(Boolean)) stop(`the raw inputs are not the set round 3 analyzed: ${JSON.stringify(inputs)}`);
  const rows = [];
  for (const arm of ARMS) {
    const pub = r3.perArm[arm];
    let declaring = 0; const kindMix = {}; const horizonMix = {}; const removals = {}; const perDeclaring = [];
    let shots = 0; let rowsMatchCalls = true;
    const pacing = new Map();
    for (const c of s.sample) {
      const k = battleDayKey(c);
      if (!pacing.has(k)) pacing.set(k, { battleId: c.battleId, day: c.day, checks: 0, declaring: { 1: 0, 2: 0 }, minted: { 1: 0, 2: 0 } });
      pacing.get(k).checks += 1;
      for (const rep of REPS) {
        const x = A(arm, rep, c);
        // The rows every section counts (x.shots) must BE the rows behind the calls compared below (review L5-1).
        const shotRows = x.calls.filter((call) => call.source === 'calledShots').map((call) => call.row);
        if (JSON.stringify(x.shots) !== JSON.stringify(shotRows)) rowsMatchCalls = false;
        shots += x.shots.length;
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
      return q && q.checks === p.checks && JSON.stringify(q.declaring) === JSON.stringify(p.declaring) && JSON.stringify(q.minted) === JSON.stringify(p.minted);
    }) && pubPacing.size === pacing.size;
    // Round 3's own per-archetype battle-day statistics — this anchors the lower-median convention too (review L5-6).
    const close = (a, b) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-9;
    const statSame = (mine, theirs) => !!theirs && close(mine.mean, theirs.mean) && close(mine.median, theirs.median) && close(mine.min, theirs.min) && close(mine.max, theirs.max);
    const mineByArch = {
      checksPerBattleDay: perBattleDay(arm, () => 1),
      declaringChecks: perBattleDay(arm, (x) => (x.phase === 'expected' ? 1 : 0)),
      mintedCalls: perBattleDay(arm, (x) => (x.phase === 'expected' ? x.calls.length : 0)),
    };
    const archetypeStats = Object.keys(pub.pacingByArchetype).length === 2 && Object.entries(pub.pacingByArchetype).every(([arch, theirs]) => (
      mineByArch.checksPerBattleDay[arch]?.battleDays === theirs.battleDays
      && ['checksPerBattleDay', 'declaringChecks', 'mintedCalls'].every((m) => statSame(mineByArch[m][arch], theirs[m]))
    ));
    // The all-archetype summary that leads every per-battle-day line, against round 3's own pacing rows (review V6-3).
    const rowStats = (vals) => ({ mean: mean(vals), median: lowerMedian(vals), min: Math.min(...vals), max: Math.max(...vals) });
    const allStats = mineByArch.mintedCalls.all.battleDays === pub.pacingRows.length
      && statSame(mineByArch.checksPerBattleDay.all, rowStats(pub.pacingRows.map((p) => p.checks)))
      && statSame(mineByArch.declaringChecks.all, rowStats(pub.pacingRows.map((p) => (p.declaring[1] + p.declaring[2]) / 2)))
      && statSame(mineByArch.mintedCalls.all, rowStats(pub.pacingRows.map((p) => (p.minted[1] + p.minted[2]) / 2)));
    // Row level: round 3's example blocks and sampled shots against the kept rows here.
    const byCheck = new Map(s.sample.map((c) => [`${c.battleId}:${c.evalId}`, c]));
    const keptFor = (check, rep) => { const c = byCheck.get(check); return c ? A(arm, rep, c) : null; };
    const exampleBlocks = pub.examples.length;
    const blocksEqual = pub.examples.every((e) => {
      const x = keptFor(e.check, e.rep);
      return x && JSON.stringify(x.v.validation.validated) === JSON.stringify(e.declarations);
    });
    const sampledShots = [...pub.said.random20, ...pub.said.sample];
    const shotsFound = sampledShots.every((l) => {
      const x = keptFor(l.check, l.rep);
      return x && x.shots.some((row) => row.symbol === l.symbol && row.horizonPhrase === l.horizonPhrase && row.said === l.said);
    });
    const checks = {
      modelCalls: pub.calls === s.sample.length * REPS.length,
      declaringCalls: declaring === pub.declaringCalls,
      callsPerDeclaringCall: mean(perDeclaring) === pub.callsPerDeclaringCall,
      kindMix: same(kindMix, pub.kindMix),
      horizonMix: same(horizonMix, pub.horizonMix),
      removals: same(removals, pub.removals),
      pacingRows: pacingSame,
      archetypeStats,
      allStats,
      keptShots: shots === pub.said.shots,
      rowsMatchCalls,
      exampleBlocks: exampleBlocks > 0 && blocksEqual,
      sampledShots: sampledShots.length > 0 && shotsFound,
    };
    if (!Object.values(checks).every(Boolean)) stop(`kept rows for ${arm} do not reproduce round 3's results.json: ${JSON.stringify(checks)}`);
    rows.push({ arm, declaringCalls: declaring, calls: s.sample.length * REPS.length, shots, exampleBlocks, sampledShots: sampledShots.length, kindMix, horizonMix, removals, checks });
  }
  return { inputs, rows };
}

// ---------------------------------------------------------------- B1 Crossroads Tier 1

/**
 * Per call, the slots whose kept called-shot rows name ≥ 2 different INCOMING symbols. Incoming =
 * an entry row's symbol, or an exit row's counterpart. `universeOnly` drops incoming names outside
 * the check's universe (TBD, N/A …; see B5); `notHeld` also drops incoming names the check showed
 * as HELD (an entry row on a held name — see B7 — brings nothing in); `literal` keeps only the
 * brief's two shapes — ≥ 2 different entry symbols, or ≥ 2 exit rows with different counterparts —
 * so a "mixed" slot (one entry symbol plus one exit counterpart) qualifies only without it. Each
 * qualifying slot reports its row mix (entry-only · exit-only · mixed) and whether ≥ 2 of its
 * incoming names share one swap-out in the universe (an entry row's counterpart, or an exit row's
 * own symbol).
 */
function crossroadsSlots(x, { universeOnly, notHeld = false, literal = false }) {
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
    const sameDirection = ['entry', 'exit'].some((d) => new Set(list.filter((e) => e.row.direction === d).map((e) => e.incoming)).size >= 2);
    if (literal && !sameDirection) continue;
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
      literal: tally(calls, { universeOnly: true, literal: true }),
      notHeld: tally(calls, { universeOnly: true, notHeld: true }),
      notHeldLiteral: tally(calls, { universeOnly: true, notHeld: true, literal: true }),
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
/** Any use of the word — reported for transparency only: it also catches "support $489", "core thesis". */
const TIER_WORD_ANY = /\b(star|core|support)\b/i;
/**
 * A tier used AS a tier (the review's rule, L3-1): the word directly followed by a tier noun
 * ("Support tier", "Core-tier", "Star slot", "Core candidate"), or a CAPITALISED tier name after a
 * preposition ("into Core", "to Support") that is not a price-level phrase ("Support at $…").
 */
const TIER_AS_TIER_A = /\b(star|core|support)\b(?=[\s-]*(tier|slot|position|spot|role|holding|multiplier|candidate|rotation|swap|upgrade|exposure|conviction)\b)/gi;
const TIER_AS_TIER_B = /\b(?:into|to|for|in|from|out of|as|of|at)\s+(?:the\s+|a\s+)?(Star|Core|Support)\b(?!\s*(?:level|levels|at|\$|zone|line|area|of|band))/g;
/** The tiers a candidate's text names as tiers, in text order (lower-case). */
function tiersNamed(text) {
  return [
    ...[...text.matchAll(TIER_AS_TIER_A)].map((m) => ({ i: m.index, w: m[1].toLowerCase() })),
    ...[...text.matchAll(TIER_AS_TIER_B)].map((m) => ({ i: m.index, w: m[1].toLowerCase() })),
  ].sort((a, b) => a.i - b.i).map((u) => u.w);
}
const candidateText = (cand) => ['signalSummary', 'threshold', 'rationale'].map((f) => (typeof cand[f] === 'string' ? cand[f] : '')).join(' ');
const entryCandidates = (x) => (Array.isArray(x.input?.anticipationCandidates) ? x.input.anticipationCandidates : [])
  .filter((cand) => cand && cand.direction === 'potential_entry' && typeof cand.symbol === 'string');
/** ≥ 2 distinct potential_entry symbols the check's bench showed (optionally only the unlocked ones). */
const twoBenchEntries = (x, availableOnly = false) => new Set(entryCandidates(x).map((cand) => cand.symbol)
  .filter((sym) => (availableOnly ? x.ctx.benchAvailable.has(sym) : x.ctx.bench.has(sym)))).size >= 2;

function b2() {
  const perArm = {}; const exByArm = {};
  for (const arm of ARMS) {
    const calls = callsOf(arm);
    const keySets = {}; const directions = {}; const extraKeys = {}; const tierAsTierIn = {}; const symbolShownAs = {};
    const presence = {}; const fieldTypes = {}; const signalSources = {};
    let candidates = 0; let callsWith = 0; let twoPlusEntry = 0; let twoPlusEntryBench = 0; let twoPlusEntryAvailable = 0;
    let sameTierBench = 0; let withTierWordAny = 0; let withTierAsTier = 0; let slotKeyed = 0; let invalidAmongCallsWith = 0;
    // Trade-invalid model calls among each measure's hits (L3-5: every measure states its own).
    const invalidAmong = { twoPlusEntry: 0, twoPlusEntryBench: 0, twoPlusEntryAvailable: 0, sameTierBench: 0 };
    let nonArrayValues = 0; let nonArrayInvalid = 0;
    exByArm[arm] = [];
    for (const x of calls) {
      const raw = x.input?.anticipationCandidates;
      inc(presence, raw === undefined ? 'key absent' : Array.isArray(raw) ? (raw.length ? 'non-empty array' : 'empty array') : typeOf(raw));
      if (raw != null && !Array.isArray(raw)) { nonArrayValues += 1; if (!x.tradeValid) nonArrayInvalid += 1; }
      const list = Array.isArray(raw) ? raw : [];
      if (!list.length) continue;
      callsWith += 1;
      if (!x.tradeValid) invalidAmongCallsWith += 1;
      const benchTier = new Map();
      const entrySyms = new Set();
      for (const cand of list) {
        candidates += 1;
        if (!cand || typeof cand !== 'object' || Array.isArray(cand)) { inc(keySets, `(${Array.isArray(cand) ? 'array' : typeof cand})`); continue; }
        inc(keySets, Object.keys(cand).sort().join(','));
        for (const [key, value] of Object.entries(cand)) inc(fieldTypes, `${key}: ${typeOf(value)}`);
        if (typeof cand.signalSource === 'string') inc(signalSources, cand.signalSource);
        inc(directions, String(cand.direction));
        inc(symbolShownAs, `${cand.direction} · ${x.ctx.held.has(cand.symbol) ? 'held' : x.ctx.bench.has(cand.symbol) ? 'bench' : 'neither'}`);
        for (const key of Object.keys(cand)) if (!SCHEMA_CANDIDATE_KEYS.includes(key)) inc(extraKeys, key);
        if (['slot', 'tier', 'targetTier', 'targetSlot'].some((key) => key in cand)) slotKeyed += 1;
        const text = candidateText(cand);
        if (TIER_WORD_ANY.test(text)) withTierWordAny += 1;
        const named = tiersNamed(text);
        if (named.length) { withTierAsTier += 1; inc(tierAsTierIn, `${cand.direction}:${named[0]}`); }
        if (cand.direction === 'potential_entry' && typeof cand.symbol === 'string') {
          entrySyms.add(cand.symbol);
          if (named.length && x.ctx.bench.has(cand.symbol)) { if (!benchTier.has(named[0])) benchTier.set(named[0], new Set()); benchTier.get(named[0]).add(cand.symbol); }
        }
      }
      if (entrySyms.size >= 2) { twoPlusEntry += 1; if (!x.tradeValid) invalidAmong.twoPlusEntry += 1; }
      if (twoBenchEntries(x)) { twoPlusEntryBench += 1; if (!x.tradeValid) invalidAmong.twoPlusEntryBench += 1; }
      if (twoBenchEntries(x, true)) { twoPlusEntryAvailable += 1; if (!x.tradeValid) invalidAmong.twoPlusEntryAvailable += 1; }
      if ([...benchTier.values()].some((set) => set.size >= 2)) {
        sameTierBench += 1; if (!x.tradeValid) invalidAmong.sameTierBench += 1;
        exByArm[arm].push({ where: checkLabel(x), candidates: entryCandidates(x).filter((cand) => x.ctx.bench.has(cand.symbol)).map((cand) => ({ symbol: cand.symbol, signalSummary: cand.signalSummary ?? null, threshold: cand.threshold ?? null })) });
      }
    }
    perArm[arm] = {
      calls: calls.length, callsWith, candidates, presence, keySets, fieldTypes, signalSources, directions, symbolShownAs, extraKeys, slotKeyed,
      withTierWordAny, withTierAsTier, tierAsTierIn, twoPlusEntry, twoPlusEntryBench, twoPlusEntryAvailable, sameTierBench, invalidAmongCallsWith,
      invalidAmong, nonArrayValues, nonArrayInvalid,
      perBattleDay: perBattleDay(arm, (x) => (twoBenchEntries(x) ? 1 : 0)),
      perBattleDayAvailable: perBattleDay(arm, (x) => (twoBenchEntries(x, true) ? 1 : 0)),
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
    let callsOverlapDW = 0; let callsSubsetDW = 0; let callsOverlapAC = 0; let callsDeclNullTWNonEmpty = 0; let invalidAmongNonEmpty = 0; let invalidAmongAny = 0;
    const keptDeclWatchingCalls = calls.filter((x) => x.keptWatching.length > 0).length;
    const keptDeclWatchingSymbols = calls.reduce((n, x) => n + x.keptWatching.length, 0);
    // Do the two lists ever share a model call? (If never, the symbol overlap is zero by construction.)
    const callsWithBothLists = calls.filter((x) => x.keptWatching.length > 0 && Array.isArray(x.input?.watching) && x.input.watching.length > 0).length;
    const nonNullForks = []; const nonNullAsks = [];
    exByArm[arm] = [];
    for (const x of calls) {
      const input = x.input ?? {};
      let any = false;
      for (const key of ['watching', 'fork', 'playerAsk']) {
        if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
        any = true; present[key] += 1; inc(valueTypes[key], typeOf(input[key]));
      }
      if (any) { anyOfThree += 1; if (!x.tradeValid) invalidAmongAny += 1; }
      if (input.fork != null) nonNullForks.push(input.fork);
      if (input.playerAsk != null) nonNullAsks.push(input.playerAsk);
      const tw = input.watching;
      if (!Array.isArray(tw) || !tw.length) continue;
      nonEmptyWatching += 1;
      if (!x.tradeValid) invalidAmongNonEmpty += 1;
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
      callsOverlapDW, callsSubsetDW, callsOverlapAC, callsDeclNullTWNonEmpty, keptDeclWatchingCalls, keptDeclWatchingSymbols, callsWithBothLists, invalidAmongNonEmpty, invalidAmongAny,
      nonNullForks: nonNullForks.length, nonNullAsks: nonNullAsks.length, nonNullAskShapes: nonNullAsks.reduce((o, v) => inc(o, typeOf(v) === 'object' ? Object.keys(v).sort().join(',') : typeOf(v)), {}),
      perBattleDay: perBattleDay(arm, (x) => (Array.isArray(x.input?.watching) && x.input.watching.length ? 1 : 0)),
    };
  }
  return { perArm, examples: pickExamples('B4', exByArm) };
}

// ---------------------------------------------------------------- B5 counterpart quality

/** Where a row's typed counterpart stands at its own check. Locked bench names are a class of their own: the swap refuses them. */
function counterpartClass(row, ctx) {
  const cp = row.counterpart;
  if (!cp) return 'absent';
  if (!ctx.U.has(cp)) return 'not in universe';
  if (cp === row.symbol) return 'own symbol';
  if (ctx.held.has(cp)) return 'held';
  if (ctx.benchAvailable.has(cp)) return 'bench (available)';
  if (ctx.bench.has(cp)) return 'bench (locked)';
  return 'universe, not shown';
}

function b5() {
  const perArm = {}; const exByArm = {};
  for (const arm of ARMS) {
    const calls = callsOf(arm);
    let rows = 0; let withCp = 0; let outside = 0; const outsideValues = {}; const byDirection = { entry: {}, exit: {} };
    // On an exit the counterpart is the replacement; on an entry it is the held name the entry would replace.
    const outsideValuesByDirection = { entry: {}, exit: {} };
    const callsOutside = new Set(); let invalidAmongOutside = 0;
    exByArm[arm] = [];
    for (const x of calls) for (const row of x.shots) {
      rows += 1;
      const cls = counterpartClass(row, x.ctx);
      inc(byDirection[row.direction], cls);
      if (cls === 'absent') continue;
      withCp += 1;
      if (cls !== 'not in universe') continue;
      outside += 1; inc(outsideValues, row.counterpart); inc(outsideValuesByDirection[row.direction], row.counterpart); callsOutside.add(x);
      if (!x.tradeValid) invalidAmongOutside += 1;
      exByArm[arm].push({ where: checkLabel(x), row: fmtRow(row) });
    }
    perArm[arm] = {
      calls: calls.length, rows, withCounterpart: withCp, outside, outsideValues, outsideValuesByDirection, byDirection, callsOutside: callsOutside.size, invalidAmongOutside,
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
    let callsWithEntry = 0; let callsWithExit = 0; let invalidRows = 0; const entryOnHeldSide = {};
    for (const x of calls) {
      if (x.shots.some((row) => row.direction === 'entry')) callsWithEntry += 1;
      if (x.shots.some((row) => row.direction === 'exit')) callsWithExit += 1;
      if (!x.tradeValid) invalidRows += x.shots.length;
      for (const row of x.shots) if (row.direction === 'entry' && x.ctx.held.has(row.symbol)) inc(entryOnHeldSide, row.condition.side);
      for (const row of x.shots) for (const arch of ['all', x.c.archetype]) {
        const t = tab(arch);
        const hb = heldOrBench(row, x.ctx);
        t.rows += 1; inc(t.direction, row.direction); inc(t.symbol, hb); inc(t.defaultAction, row.defaultAction);
        inc(t.dirBySymbol, `${row.direction} · ${hb}`); inc(t.dirByDefault, `${row.direction} · ${row.defaultAction}`);
        inc(t.kind, row.direction === 'entry' ? 'called_shot (entry)' : row.defaultAction === 'act' ? 'confirmation (exit · act)' : 'called_shot (exit · hold)');
      }
    }
    perArm[arm] = {
      calls: calls.length, callsWithEntry, callsWithExit, invalidRows, byArchetype, entryOnHeldSide,
      perBattleDay: {
        entry: perBattleDay(arm, (x) => x.shots.filter((row) => row.direction === 'entry').length),
        exit: perBattleDay(arm, (x) => x.shots.filter((row) => row.direction === 'exit').length),
        held: perBattleDay(arm, (x) => x.shots.filter((row) => heldOrBench(row, x.ctx) === 'held').length),
        bench: perBattleDay(arm, (x) => x.shots.filter((row) => heldOrBench(row, x.ctx) === 'bench').length),
        entryOnHeld: perBattleDay(arm, (x) => x.shots.filter((row) => row.direction === 'entry' && x.ctx.held.has(row.symbol)).length),
        entryOnBench: perBattleDay(arm, (x) => x.shots.filter((row) => row.direction === 'entry' && !x.ctx.held.has(row.symbol) && x.ctx.bench.has(row.symbol)).length),
        act: perBattleDay(arm, (x) => x.shots.filter((row) => row.defaultAction === 'act').length),
        hold: perBattleDay(arm, (x) => x.shots.filter((row) => row.defaultAction === 'hold').length),
      },
    };
  }
  return { perArm, examples: pickExamples('B7', exByArm) };
}

// ---------------------------------------------------------------- B8 research-objective seeds

/**
 * An exit row with no usable counterpart: absent, outside the universe, its own symbol, a held
 * name, a bench name locked by a cooldown (the swap refuses it), or a universe name the check's
 * bench did not show. Usable = a bench name the check showed as available.
 */
const noUsableCounterpart = (row, ctx) => row.direction === 'exit' && counterpartClass(row, ctx) !== 'bench (available)';

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
    // 'Unknown' is the renderer's fallback when the asset carries no sector
    // (agentEvalPromptAssembly.js:1503, `asset.sector || 'Unknown'`): no sector, not a sector.
    // A locked name's row shows it; the same prompt's technical header (`asset.sector ||
    // ranking?.sectorName`, :1550, :1579) and fundamentals header (`ranking.sectorName`,
    // fundamentalsRender.js:116) carry the name's sector — `sector` resolves to the first real one.
    const sectorCsv = f[1] && f[1] !== 'Unknown' ? f[1] : null;
    return { symbol: f[0], sectorCsv, sector: sectorCsv, sectorRaw: f[1], price: Number(f[2].replace('$', '')), dailyPct: parseFloat(f[3]), atrPct: parseFloat(f[4]), status: f.slice(5).join(','), tech: {}, fund: {} };
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
      const head = /^\S+ \((.*)\):$/.exec(lines[0]);
      if (head && head[1] !== 'Unknown') { r.sectorTech = head[1]; r.sector ??= head[1]; }
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
        const m = /^(\S+) \(([^)]*)\): (.*)$/.exec(line);
        if (!m || !bySym.has(m[1])) continue;
        const r = bySym.get(m[1]);
        const fundSector = m[2].split(' / ')[0];
        if (fundSector) { r.sectorFund = fundSector; r.sector ??= fundSector; }
        for (const part of m[3].split(' | ')) {
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
    'Sector (CSV; the \'Unknown\' fallback counts as missing)': (r) => !!r.sectorCsv,
    'Sector (CSV, else the technical or fundamentals header)': (r) => !!r.sector,
    'Daily% (CSV; a missing change renders as 0)': (r) => Number.isFinite(r.dailyPct), 'ATR% (CSV; a missing ATR renders as 2.5)': (r) => Number.isFinite(r.atrPct), 'Status (CSV)': (r) => !!r.status,
    'Trend short/intermediate/long': (r) => !!r.trendShort, sma200_position: (r) => Number.isFinite(r.sma200), 'Momentum divergence': (r) => !!r.divergence,
    'Momentum RSI': (r) => Number.isFinite(r.rsi), Levels: (r) => 'Levels' in r.tech, 'Recent action': (r) => 'Recent action' in r.tech,
    'Volatility (BB %B, ATR regime)': (r) => 'Volatility' in r.tech, 'Volume (tier, RVOL)': (r) => Number.isFinite(r.rvol), 'Relative strength (rsPercentile, sector RS)': (r) => Number.isFinite(r.rsPct),
    'Composite technicalScore/technicalRank': (r) => Number.isFinite(r.techScore), 'mcap (fundamentals)': (r) => !!r.mcap, 'rev growth': (r) => Number.isFinite(r.revGrowth),
    'EPS rev 30d': (r) => Number.isFinite(r.epsRev), 'beat rate': (r) => Number.isFinite(r.beatRate), 'surprise pctl': (r) => 'surprise pctl' in r.fund, PE: (r) => 'PE' in r.fund, 'P/B': (r) => 'P/B' in r.fund,
  };
  let rows = 0; let contexts = 0; let locked = 0; const have = {}; const mcap = {}; const divergence = {}; const statusKinds = {};
  // Values a renderer fallback also produces (agentEvalPromptAssembly.js:1501-1502) — real or fallback, indistinguishable.
  let dailyZero = 0; let atrFallbackValue = 0;
  // The three sector sources, where two are present, must name the same sector.
  let sectorSourcesDisagree = 0; let sectorFromHeaderOnly = 0; let sectorFromHeaderOnlyLocked = 0;
  for (const c of s.sample) {
    const list = benchRows(live(c));
    if (!list.length) continue;
    contexts += 1;
    for (const r of list) {
      rows += 1;
      if (r.dailyPct === 0) dailyZero += 1;
      if (r.atrPct === 2.5) atrFallbackValue += 1;
      const named = [r.sectorCsv, r.sectorTech, r.sectorFund].filter(Boolean);
      if (new Set(named).size > 1) sectorSourcesDisagree += 1;
      if (!r.sectorCsv && r.sector) { sectorFromHeaderOnly += 1; if (r.status !== 'available') sectorFromHeaderOnlyLocked += 1; }
      if (r.status !== 'available') locked += 1;
      inc(statusKinds, r.status === 'available' ? 'available' : r.status.startsWith('locked until') ? 'locked until …' : r.status);
      for (const [name, has] of Object.entries(fields)) if (has(r)) inc(have, name);
      inc(mcap, r.mcap ?? '(none)'); inc(divergence, r.divergence ?? '(none)');
    }
  }
  return {
    contexts, rows, locked, statusKinds, coverage: Object.fromEntries(Object.keys(fields).map((k) => [k, have[k] || 0])), mcap, divergence,
    dailyZero, atrFallbackValue, sectorSourcesDisagree, sectorFromHeaderOnly, sectorFromHeaderOnlyLocked,
  };
}

/**
 * The B9 classification of every canonical directive on the TF and CN menus, by the criteria the
 * report states: NOT — the directive is not a criterion on bench names (exit timing, stops,
 * sizing, the agent's own trade history); FEASIBLE — an entry criterion that a field on at least
 * 98 % of bench rows measures directly, needing only a threshold or cut on it; PARTIAL — an entry
 * criterion where the direct measure is on a minority of rows, or a row field covers only part of
 * it, or only a proxy exists. The `fields` text cites the recorded row format (see benchRows);
 * each [[field]] token is replaced at render time by that field's measured share of bench rows.
 */
const CLASSES = Object.freeze({
  'TF-01': { cls: 'partial', fields: '"extended / late-stage": Trend line `sma200_position` ([[sma200_position]]). "fresh breakout": no field (no breakout date; `Levels` resistance distance on [[Levels]]).' },
  'TF-02': { cls: 'partial', fields: '"confirmation": `Volume` tier/RVOL and MACD only on detail rows ([[Volume (tier, RVOL)]]); `Trend` short/intermediate/long ([[Trend short/intermediate/long]]) and `divergence` ([[Momentum divergence]]) bear on it only indirectly.' },
  'TF-03': { cls: 'partial', fields: '"sector": CSV `Sector` ([[Sector (CSV; the \'Unknown\' fallback counts as missing)]]); a locked name\'s CSV row shows "Unknown", and its technical and fundamentals headers carry the sector ([[Sector (CSV, else the technical or fundamentals header)]]). "strongest": no sector-strength field (`sector RS` only on detail rows, [[Relative strength (rsPercentile, sector RS)]]); no sector ranking anywhere in the prompt.' },
  'TF-04': { cls: 'not', fields: 'Rotation timing for held winners — not a bench-name criterion.' },
  'TF-05': { cls: 'not', fields: 'Position size — no size field on any held or bench row.' },
  'TF-06': { cls: 'partial', fields: '"low-liquidity / thin": no volume or dollar-volume field on most rows (`Volume` tier/RVOL on [[Volume (tier, RVOL)]]); `mcap` class ([[mcap (fundamentals)]]) is a proxy.' },
  'TF-07': { cls: 'feasible', fields: '"own technicals" (read entry-side: "before acting"): `Composite` technicalScore / technicalRank ([[Composite technicalScore/technicalRank]]).' },
  'TF-08': { cls: 'not', fields: 'The agent\'s own failed breakouts (its history, `CLOSED TRADES THIS BATTLE` on some checks) — no per-name breakout-failure field; `Recent action` is one bar\'s pattern ([[Recent action]]).' },
  'CN-01': { cls: 'partial', fields: '"oversold depth": `RSI` only on detail rows ([[Momentum RSI]]); `sma200_position` ([[sma200_position]]) is a proxy (distance below the 200-day).' },
  'CN-02': { cls: 'partial', fields: '"turn / stabilization": `divergence` ([[Momentum divergence]]) and `Trend` short vs intermediate ([[Trend short/intermediate/long]]) are proxies; `Recent action` ([[Recent action]]); no field names a turn.' },
  'CN-03': { cls: 'not', fields: 'The stop on held names — not a bench-name criterion.' },
  'CN-04': { cls: 'partial', fields: '"out-of-favor / lagging": the direct measure, relative strength (`rsPercentile`, `sector RS`), only on detail rows ([[Relative strength (rsPercentile, sector RS)]]); `sma200_position` ([[sma200_position]]) and `Composite` technicalScore ([[Composite technicalScore/technicalRank]]) are proxies.' },
  'CN-05': { cls: 'not', fields: 'Profit-taking on held names into resistance (held `Levels`) — not a bench-name criterion.' },
  'CN-06': { cls: 'feasible', fields: '"fundamental reason": the FUNDAMENTALS row — rev growth ([[rev growth]]), EPS rev 30d ([[EPS rev 30d]]), beat rate ([[beat rate]]), surprise pctl ([[surprise pctl]]), PE vs sector median ([[PE]]).' },
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
  { id: 'TF-03', cls: 'partial', part: '"sector" ← Sector (the CSV, else the technical or fundamentals header — a locked name\'s CSV row shows "Unknown"); "strongest" has no row field — the bounds are the largest and the smallest one-sector group', sector: true },
  { id: 'TF-06', cls: 'partial', part: '"low-liquidity / thin" ← mcap class (fundamentals; a proxy) — volume/RVOL only on detail rows', variants: [{ label: 'mcap = large', pass: (r) => r.mcap === 'large' }, { label: 'mcap ∈ {large, mid}', pass: (r) => r.mcap === 'large' || r.mcap === 'mid' }, { label: 'RVOL ≥ 1.0 (rows carrying RVOL only)', pass: (r) => Number.isFinite(r.rvol) && r.rvol >= 1 }] },
  { id: 'TF-07', cls: 'feasible', part: '"the stock\'s own technicals" ← Composite technicalScore', variants: [70, 80, 90].map((t) => ({ label: `technicalScore ≥ ${t}`, pass: (r) => Number.isFinite(r.techScore) && r.techScore >= t })) },
  { id: 'CN-01', cls: 'partial', part: '"oversold depth" ← RSI (detail rows only); sma200_position (every row) as distance below the 200-day', variants: [{ label: 'RSI ≤ 30 (rows carrying RSI only)', pass: (r) => Number.isFinite(r.rsi) && r.rsi <= 30 }, { label: 'sma200_position < 0', pass: (r) => Number.isFinite(r.sma200) && r.sma200 < 0 }, { label: 'sma200_position ≤ −10%', pass: (r) => Number.isFinite(r.sma200) && r.sma200 <= -10 }] },
  { id: 'CN-02', cls: 'partial', part: '"technical turn / stabilization" ← Momentum divergence (every row); Trend short vs intermediate (every row)', variants: [{ label: 'divergence = bullish', pass: (r) => r.divergence === 'bullish' }, { label: 'trend short = up while intermediate = down', pass: (r) => r.trendShort === 'up' && r.trendInter === 'down' }, { label: 'either of the two', pass: (r) => r.divergence === 'bullish' || (r.trendShort === 'up' && r.trendInter === 'down') }] },
  { id: 'CN-04', cls: 'partial', part: '"out-of-favor / lagging" ← proxies on (almost) every row: sma200_position and Composite technicalScore (relative strength, the direct measure, is on detail rows only)', variants: [{ label: 'sma200_position < 0', pass: (r) => Number.isFinite(r.sma200) && r.sma200 < 0 }, { label: 'technicalScore ≤ 70', pass: (r) => Number.isFinite(r.techScore) && r.techScore <= 70 }, { label: 'technicalScore ≤ 60', pass: (r) => Number.isFinite(r.techScore) && r.techScore <= 60 }] },
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
      const groupsOf = (b) => b.rows.filter((r) => r.sector).reduce((o, r) => inc(o, r.sector), {});
      const largest = checks.map((b) => Math.max(...Object.values(groupsOf(b))));
      const smallest = checks.map((b) => Math.min(...Object.values(groupsOf(b))));
      const sectors = checks.map((b) => Object.keys(groupsOf(b)).length);
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
    if (rd?.sector) { const groups = rows.filter((r) => r.sector).reduce((o, r) => inc(o, r.sector), {}); reading = 'one sector (largest–smallest group)'; passing = `${Math.max(...Object.values(groups))}–${Math.min(...Object.values(groups))}`; }
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
    let declaring = 0; let max = 0; let invalidAmongDeclaring = 0;
    const byArchetype = {};
    exByArm[arm] = [];
    for (const x of callsOf(arm)) {
      if (x.phase !== 'expected') continue;
      declaring += 1;
      const n = x.calls.length; max = Math.max(max, n);
      if (!x.tradeValid) invalidAmongDeclaring += 1;
      if (n >= 4) exByArm[arm].push({ where: checkLabel(x), rows: x.shots.map(fmtRow) });
      const bucket = bucketOf(n);
      inc(dist, bucket); inc(byRep[x.rep], bucket);
      inc((byArchetype[x.c.archetype] ??= {}), bucket);
    }
    // The same counts per CHECK (the brief's unit): a check declares when either rep's kept block is
    // non-empty. Two reps give two counts, so both combinations are shown — the rep with more minted
    // calls, and the declaring rep with fewer (L3-10).
    const perCheck = { declaring: 0, both: 0, larger: {}, smallerDeclaring: {} };
    for (const c of s.sample) {
      const counts = REPS.map((rep) => A(arm, rep, c)).filter((x) => x.phase === 'expected').map((x) => x.calls.length);
      if (!counts.length) continue;
      perCheck.declaring += 1; if (counts.length === REPS.length) perCheck.both += 1;
      inc(perCheck.larger, bucketOf(Math.max(...counts))); inc(perCheck.smallerDeclaring, bucketOf(Math.min(...counts)));
    }
    // Every distribution must account for every declaring call / check, whatever the bucket rule (review L5-7).
    // Over the PRINTED buckets only: a bucket key outside B10_BUCKETS would never print (review V6-1).
    const total = (o) => B10_BUCKETS.reduce((a, b) => a + (o[b] || 0), 0);
    const sums = [
      ['all', total(dist), declaring],
      ['by rep', total(byRep[1]) + total(byRep[2]), declaring],
      ['by archetype', Object.values(byArchetype).reduce((n, o) => n + total(o), 0), declaring],
      ['per check (more)', total(perCheck.larger), perCheck.declaring],
      ['per check (fewer)', total(perCheck.smallerDeclaring), perCheck.declaring],
    ].filter(([, got, want]) => got !== want);
    if (sums.length) stop(`B10 buckets for ${arm} do not sum to their totals: ${JSON.stringify(sums)}`);
    perArm[arm] = {
      calls: s.sample.length * REPS.length, declaring, invalidAmongDeclaring, dist, byRep, byArchetype, max, perCheck,
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
    sampleSha256: rawHashes['sample.json'],
    s2Sha256: rawHashes['s2.json'],
    resultsSha256: rawHashes['results.json'],
    callFiles: callFiles.length, callsDigest: rawHashes['calls/'],
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

const MODEL_CALLS = s.sample.length * REPS.length;
p('<!-- generated by scripts/build2-discovery-counts.mjs — do not edit by hand -->');
p('### Inputs and the cross-check');
p();
p(`- Raw folder: \`experiments/declarations-wording/raw/round3/\` — \`sample.json\` SHA-256 \`${out.inputs.sampleSha256.slice(0, 16)}…\`, \`s2.json\` \`${out.inputs.s2Sha256.slice(0, 16)}…\`, \`results.json\` \`${out.inputs.resultsSha256.slice(0, 16)}…\`, ${out.inputs.callFiles} call records (digest \`${out.inputs.callsDigest.slice(0, 16)}…\`). All four are pinned: the script stops on any other bytes.`);
p(`- Main sample: ${out.inputs.checks} checks, ${out.inputs.battles} battles, ${out.inputs.battleDays} battle-days (${mixStr(out.inputs.byArchetype)}); **${MODEL_CALLS} model calls per arm** (each check × 2 reps). A **called shot** is one kept \`calledShots\` row — it would mint one call record.`);
p(`- Universe builder: this script's \`promptSymbols\` equals round 3's byte for byte, and round 3's \`analyze3\` validated with roster ∪ \`promptSymbols\` (asserted against \`scripts/declarations-wording-experiment.mjs\` at SHA-256 \`${builderProof.experimentScriptSha256.slice(0, 16)}…\`, LF-normalized).`);
p(`- **Kept rows reproduce round 3's \`results.json\` exactly.** Inputs: ${s.sample.length} sampled checks, ${s2.checks.length} S2 checks, and the main, S2 and total record counts. Counts, per arm: model calls, declaring model calls, minted calls per declaring call, kind mix, horizon mix, removals, per battle-day pacing (checks, declaring, minted), round 3's per-archetype battle-day mean, median, min and max (so the median convention is round 3's), the all-archetype figures against round 3's own pacing rows, and total kept called shots (${cross.rows.map((c) => `${c.arm} ${c.shots}`).join(' · ')}), counted from the rows every section reads, which equal the rows behind round 3's calls. Rows: round 3's example blocks equal the kept blocks field for field, and every shot round 3 sampled is a kept row with the same symbol, horizon and sentence (${cross.rows.map((c) => `${c.arm} ${c.exampleBlocks} blocks + ${c.sampledShots} shots`).join(' · ')}). The script stops before printing anything if any of these differs. **Not exercised by round 3's data:** the universe (it judges only forks, and no fork was offered) and the horizon binding (no row was removed for a horizon reason) — the universe builder is asserted by its text instead.`);
p(`- Trade-invalid model calls (production captures declarations only on a valid trade result): ${ARMS.map((a) => `${a} ${out.inputs.tradeInvalidCalls[a]}`).join(' · ')} of ${MODEL_CALLS}. Counts over model output include them, as round 3's declaration measures do, and each states how many of its hits sit on one. B9 counts prompts, not model output.`);
p();

// B1
p('### B1 — Crossroads Tier 1: one slot, two or more incoming names');
p();
p('Incoming = an entry row\'s `symbol`, or an exit row\'s `counterpart`; only names in the check\'s universe count. **As defined** includes *mixed* slots (one entry symbol plus one exit counterpart in the same slot); **brief-literal** keeps only the brief\'s two shapes — ≥ 2 different entry symbols, or ≥ 2 exit rows with different counterparts. "Same swap-out" = two incoming names for the same outgoing name in the universe (an entry row\'s `counterpart`, or an exit row\'s own `symbol`).');
p();
p(armHead); p(armSep);
armRow('Model calls with ≥ 1 qualifying slot — as defined (mixed included)', (a) => frac(out.B1.perArm[a].asDefined.hits, out.B1.perArm[a].calls));
armRow('…of model calls with ≥ 2 kept called shots', (a) => frac(out.B1.perArm[a].asDefined.hits, out.B1.perArm[a].multiShot));
armRow('…brief-literal (mixed slots left out)', (a) => frac(out.B1.perArm[a].literal.hits, out.B1.perArm[a].calls));
armRow('…without the universe filter', (a) => frac(out.B1.perArm[a].unfiltered.hits, out.B1.perArm[a].calls));
armRow('Qualifying slots (as defined), by row mix', (a) => `${out.B1.perArm[a].asDefined.slots}: ${mixStr(out.B1.perArm[a].asDefined.mix)}`);
armRow('…of which ≥ 2 incoming names share one swap-out', (a) => frac(out.B1.perArm[a].asDefined.sameSwapOutSlots, out.B1.perArm[a].asDefined.slots));
armRow('**Held names excluded from "incoming"** — model calls: as defined · brief-literal', (a) => `${frac(out.B1.perArm[a].notHeld.hits, out.B1.perArm[a].calls)} · ${frac(out.B1.perArm[a].notHeldLiteral.hits, out.B1.perArm[a].calls)}`);
armRow('…qualifying slots (held excluded), by row mix · sharing one swap-out', (a) => `${out.B1.perArm[a].notHeld.slots}: ${mixStr(out.B1.perArm[a].notHeld.mix)} · ${out.B1.perArm[a].notHeld.sameSwapOutSlots}`);
armRow('Hits on a trade-invalid model call (as defined · brief-literal · unfiltered · held excluded · held excluded, brief-literal)', (a) => ['asDefined', 'literal', 'unfiltered', 'notHeld', 'notHeldLiteral'].map((k) => out.B1.perArm[a][k].invalidAmongHits).join(' · '));
armRow('Per battle-day (qualifying model calls, as defined)', (a) => bdLine(out.B1.perArm[a].perBattleDay));
armRow('Per battle-day (qualifying model calls, held excluded)', (a) => bdLine(out.B1.perArm[a].perBattleDayNotHeld));
p();
p('Examples (verbatim kept rows of the qualifying slot; held-excluded hits first):');
p();
examples(out.B1.examples, (e, i) => { p(`${i}. [${e.arm}] ${e.where} — ${e.variant}`); for (const sl of e.slots) { p(`   - slot **${sl.slot}** (${sl.mix}${sl.sameSwapOut ? ', same swap-out' : ''})`); for (const r of sl.rows) p(`     - ${r}`); } });
p();

// B2
p('### B2 — Tier 2: `anticipationCandidates` (raw tool input)');
p();
p('The schema\'s candidate is `{ symbol, direction, signalSummary, threshold, rationale?, signalSource? }`, with no slot or tier field (`api/_utils/agentEvalToolSchema.js:157-192`); the schema\'s own `threshold` example ends "…I would rotate it into Core." (`:180`). A swap\'s incoming name takes the outgoing name\'s tier and position, so the slot a candidate would fill is set by the held name it replaces; a cooldown ("locked until …") name and a stock↔crypto swap are refused (`api/_utils/agentSwapExecution.js:35-41`, `:59-73`, `:302-303`). **Names a tier as a tier** = a lexical rule: the word followed by a tier noun ("Support tier", "Core-tier", "Star slot") or a capitalised tier name after a preposition ("into Core"), not a price-level phrase ("support $489.56"); the plain-word count is shown beside it.');
const nonArray = ARMS.filter((a) => out.B2.perArm[a].nonArrayValues > 0);
if (nonArray.length) p(`A non-array \`anticipationCandidates\` value (${nonArray.map((a) => `${a} ${out.B2.perArm[a].nonArrayValues}, ${out.B2.perArm[a].nonArrayInvalid} of them on a trade-invalid model call`).join('; ')}) is not read as candidates.`);
p();
p(armHead); p(armSep);
armRow('`anticipationCandidates` on a model call', (a) => mixStr(out.B2.perArm[a].presence));
armRow('Model calls with ≥ 1 candidate', (a) => frac(out.B2.perArm[a].callsWith, out.B2.perArm[a].calls));
armRow('Candidates', (a) => String(out.B2.perArm[a].candidates));
armRow('Key sets (sorted keys: count)', (a) => mixStr(out.B2.perArm[a].keySets));
armRow('Field types', (a) => mixStr(out.B2.perArm[a].fieldTypes));
armRow('`signalSource` values', (a) => mixStr(out.B2.perArm[a].signalSources));
armRow('`direction` values', (a) => mixStr(out.B2.perArm[a].directions));
armRow('`direction` × the symbol as the prompt showed it', (a) => mixStr(out.B2.perArm[a].symbolShownAs));
armRow('Keys outside the schema\'s six', (a) => mixStr(out.B2.perArm[a].extraKeys));
armRow('Candidates carrying a `slot`/`tier`-named key', (a) => String(out.B2.perArm[a].slotKeyed));
armRow('Candidates whose text names a tier as a tier (direction : first tier named)', (a) => `${frac(out.B2.perArm[a].withTierAsTier, out.B2.perArm[a].candidates)}: ${mixStr(out.B2.perArm[a].tierAsTierIn)}`);
armRow('…for comparison: any use of the words star / core / support', (a) => frac(out.B2.perArm[a].withTierWordAny, out.B2.perArm[a].candidates));
armRow('Model calls with ≥ 2 distinct `potential_entry` symbols', (a) => frac(out.B2.perArm[a].twoPlusEntry, out.B2.perArm[a].calls));
armRow('…≥ 2 of them bench names the check showed (the slot follows the outgoing name)', (a) => frac(out.B2.perArm[a].twoPlusEntryBench, out.B2.perArm[a].calls));
armRow('…≥ 2 of them bench names shown as available (not locked)', (a) => frac(out.B2.perArm[a].twoPlusEntryAvailable, out.B2.perArm[a].calls));
armRow('…≥ 2 bench entry candidates whose text names the same tier as a tier', (a) => frac(out.B2.perArm[a].sameTierBench, out.B2.perArm[a].calls));
armRow('Trade-invalid model calls among: ≥ 1 candidate · ≥ 2 entry · ≥ 2 bench · ≥ 2 available bench · same tier', (a) => {
  const x = out.B2.perArm[a];
  return [x.invalidAmongCallsWith, x.invalidAmong.twoPlusEntry, x.invalidAmong.twoPlusEntryBench, x.invalidAmong.twoPlusEntryAvailable, x.invalidAmong.sameTierBench].join(' · ');
});
armRow('Per battle-day (≥ 2 bench entry candidates)', (a) => bdLine(out.B2.perArm[a].perBattleDay));
armRow('Per battle-day (≥ 2 available bench entry candidates)', (a) => bdLine(out.B2.perArm[a].perBattleDayAvailable));
p();
p('Examples (model calls with ≥ 2 bench entry candidates whose text names the same tier as a tier; raw `signalSummary` and `threshold`, verbatim):');
p();
examples(out.B2.examples, (e, i) => { p(`${i}. [${e.arm}] ${e.where}`); for (const cand of e.candidates) p(`   - \`${cand.symbol}\` — "${cand.signalSummary}" / "${cand.threshold}"`); });
p();

// B3
p('### B3 — Prose alternatives in a kept `said` ("X or Y", "X/Y")');
p();
p('A run of tickers joined by "or" or "/" (commas allowed inside; a comma-only list is not counted), with ≥ 2 distinct names in the check\'s universe. Lexical.');
p();
p(armHead); p(armSep);
armRow('Kept called shots naming alternatives', (a) => frac(out.B3.perArm[a].hitRows, out.B3.perArm[a].rows));
armRow('Model calls with ≥ 1 such called shot', (a) => frac(out.B3.perArm[a].callsHit, out.B3.perArm[a].calls));
armRow('Typed `counterpart` is one of the named alternatives', (a) => frac(out.B3.perArm[a].counterpartIn, out.B3.perArm[a].hitRows));
armRow('Typed `counterpart` present but not among them', (a) => frac(out.B3.perArm[a].counterpartOther, out.B3.perArm[a].hitRows));
armRow('No typed `counterpart`', (a) => frac(out.B3.perArm[a].counterpartAbsent, out.B3.perArm[a].hitRows));
armRow('The called shot\'s own `symbol` is one of them', (a) => frac(out.B3.perArm[a].symbolIn, out.B3.perArm[a].hitRows));
armRow('Hit called shots on a trade-invalid model call', (a) => String(out.B3.perArm[a].invalidAmongHitRows));
armRow('Per battle-day (hit called shots)', (a) => bdLine(out.B3.perArm[a].perBattleDay));
p();
p('Examples:');
p();
examples(out.B3.examples, (e, i) => { p(`${i}. [${e.arm}] ${e.where} — alternatives ${e.groups.map((g) => `{${g}}`).join(' ')}`); p(`   - ${e.row}`); });
p();

// B4
p('### B4 — Stray top-level `watching` / `fork` / `playerAsk` (raw tool input)');
p();
p(armHead); p(armSep);
armRow('Model calls with any of the three at top level', (a) => frac(out.B4.perArm[a].anyOfThree, out.B4.perArm[a].calls));
for (const key of ['watching', 'fork', 'playerAsk']) armRow(`Top-level \`${key}\` present · value types`, (a) => `${frac(out.B4.perArm[a].present[key], out.B4.perArm[a].calls)} · ${mixStr(out.B4.perArm[a].valueTypes[key])}`);
armRow('Top-level `watching` non-empty (of all model calls)', (a) => frac(out.B4.perArm[a].nonEmptyWatching, out.B4.perArm[a].calls));
armRow('…of model calls where it is present', (a) => frac(out.B4.perArm[a].nonEmptyWatching, out.B4.perArm[a].present.watching));
armRow('Element types · elements in the check\'s universe', (a) => `${mixStr(out.B4.perArm[a].elementTypes)} · ${frac(out.B4.perArm[a].elementsInUniverse, out.B4.perArm[a].elements)}`);
armRow('For comparison: model calls with a non-empty KEPT `declarations.watching` · its symbols', (a) => `${frac(out.B4.perArm[a].keptDeclWatchingCalls, out.B4.perArm[a].calls)} · ${out.B4.perArm[a].keptDeclWatchingSymbols}`);
armRow('Model calls carrying both lists (0 = the overlap below is zero by construction)', (a) => String(out.B4.perArm[a].callsWithBothLists));
armRow('Top-level symbols also in kept `declarations.watching`', (a) => frac(out.B4.perArm[a].symbolOverlap.inDeclarationsWatching, out.B4.perArm[a].symbolOverlap.topLevelSymbols));
armRow('Top-level symbols also among `anticipationCandidates`', (a) => frac(out.B4.perArm[a].symbolOverlap.inAnticipation, out.B4.perArm[a].symbolOverlap.topLevelSymbols));
armRow('Top-level symbols in either', (a) => frac(out.B4.perArm[a].symbolOverlap.inEither, out.B4.perArm[a].symbolOverlap.topLevelSymbols));
armRow('Model calls (non-empty top-level) overlapping `anticipationCandidates`', (a) => frac(out.B4.perArm[a].callsOverlapAC, out.B4.perArm[a].nonEmptyWatching));
armRow('Model calls with non-empty top-level `watching` and a null/absent `declarations` block', (a) => frac(out.B4.perArm[a].callsDeclNullTWNonEmpty, out.B4.perArm[a].nonEmptyWatching));
armRow('Trade-invalid model calls among: any of the three · non-empty top-level `watching`', (a) => `${out.B4.perArm[a].invalidAmongAny} · ${out.B4.perArm[a].invalidAmongNonEmpty}`);
armRow('Non-null top-level `fork` · `playerAsk` (shapes)', (a) => `${out.B4.perArm[a].nonNullForks} · ${out.B4.perArm[a].nonNullAsks} (${mixStr(out.B4.perArm[a].nonNullAskShapes)})`);
armRow('Per battle-day (model calls with non-empty top-level `watching`)', (a) => bdLine(out.B4.perArm[a].perBattleDay));
p();
p('Examples (raw top-level `watching`, verbatim, beside the kept `declarations.watching` and the candidate symbols):');
p();
examples(out.B4.examples, (e, i) => p(`${i}. [${e.arm}] ${e.where} — top-level ${JSON.stringify(e.topLevelWatching)} · declarations.watching ${JSON.stringify(e.declarationsWatching)} · anticipationCandidates ${JSON.stringify(e.anticipationSymbols)} · declarations block ${e.declarationsBlock}`));
p();

// B5
p('### B5 — Counterparts outside the check\'s universe');
p();
p('A counterpart\'s class at its own check: absent · not in universe · own symbol · held · bench (available) · bench (locked — a cooldown name, which the swap refuses) · universe, not shown.');
p();
p(armHead); p(armSep);
armRow('Kept called shots with a `counterpart`', (a) => frac(out.B5.perArm[a].withCounterpart, out.B5.perArm[a].rows));
armRow('…outside the check\'s universe', (a) => frac(out.B5.perArm[a].outside, out.B5.perArm[a].withCounterpart));
armRow('Model calls with ≥ 1 such called shot', (a) => frac(out.B5.perArm[a].callsOutside, out.B5.perArm[a].calls));
armRow('Every value outside the universe (count)', (a) => mixStr(out.B5.perArm[a].outsideValues));
armRow('…on exit called shots (the replacement) · on entry called shots (the held name it would replace)', (a) => `${mixStr(out.B5.perArm[a].outsideValuesByDirection.exit)} · ${mixStr(out.B5.perArm[a].outsideValuesByDirection.entry)}`);
armRow('Exit called shots: counterpart class', (a) => mixStr(out.B5.perArm[a].byDirection.exit));
armRow('Entry called shots: counterpart class', (a) => mixStr(out.B5.perArm[a].byDirection.entry));
armRow('Outside-universe called shots on a trade-invalid model call', (a) => String(out.B5.perArm[a].invalidAmongOutside));
armRow('Per battle-day (outside-universe called shots)', (a) => bdLine(out.B5.perArm[a].perBattleDay));
p();
p('Examples:');
p();
examples(out.B5.examples, (e, i) => p(`${i}. [${e.arm}] ${e.where} — ${e.row}`));
p();

// B6
const b6o = out.B6;
p('### B6 — Repeats: a kept called shot matching the previous sampled check\'s');
p();
p(`Match = same \`symbol\`, \`direction\`, \`slot\` and \`side\`, level within ${LEVEL_TOLERANCE * 100} % of the previous level; each rep against the same rep. **Sampled checks:** ${b6o.checks} in ${b6o.battles} battles give ${b6o.pairsPerRep} (previous, current) pairs per rep; **${b6o.consecutive} of ${b6o.pairsPerRep} are consecutive evaluations** (eval number + 1); eval gaps: ${mixStr(b6o.gaps)}; ${b6o.crossDay} pairs cross an ET day.`);
p();
p(armHead); p(armSep);
armRow('Model calls with kept called shots and a previous sampled check', (a) => String(b6o.perArm[a].callsWithRows));
armRow('…with ≥ 1 repeated called shot', (a) => frac(b6o.perArm[a].callsRepeating, b6o.perArm[a].callsWithRows));
armRow('Kept called shots that repeat the previous check\'s', (a) => frac(b6o.perArm[a].repeated, b6o.perArm[a].rowsWithPrev));
armRow('…on consecutive-evaluation pairs only', (a) => frac(b6o.perArm[a].repeatedConsec, b6o.perArm[a].rowsConsec));
armRow('Repeating model calls on a trade-invalid result', (a) => String(b6o.perArm[a].invalidAmongRepeating));
armRow('Per battle-day (repeated called shots)', (a) => bdLine(b6o.perArm[a].perBattleDay));
p();
p('Examples (previous → current, verbatim):');
p();
examples(b6o.examples, (e, i) => { p(`${i}. [${e.arm}] ${e.where}`); p(`   - previous: ${e.previous}`); p(`   - current: ${e.current}`); });
p();

// B7
p('### B7 — Mix of kept called shots');
p();
for (const arm of ARMS) {
  const x = out.B7.perArm[arm];
  p(`**${arm}${arm === PRIMARY ? ' (primary)' : ''}** — model calls with ≥ 1 entry called shot ${frac(x.callsWithEntry, x.calls)}; with ≥ 1 exit called shot ${frac(x.callsWithExit, x.calls)}; entry called shots on a held symbol, by condition side: ${mixStr(x.entryOnHeldSide)}; called shots on a trade-invalid model call: ${x.invalidRows}.`);
  p();
  p('| Archetype | Called shots | Direction | Symbol (shown in the prompt as) | Default | Direction × symbol | Kind (contract mapping) |');
  p('|---|---|---|---|---|---|---|');
  for (const arch of ['all', 'momentum_chaser', 'contrarian']) {
    const t = x.byArchetype[arch];
    if (!t) { p(`| ${arch} | 0 | — | — | — | — | — |`); continue; }
    p(`| ${arch} | ${t.rows} | ${mixStr(t.direction)} | ${mixStr(t.symbol)} | ${mixStr(t.defaultAction)} | ${mixStr(t.dirBySymbol)} | ${mixStr(t.kind)} |`);
  }
  p();
  p(`Per battle-day — entry: ${bdLine(x.perBattleDay.entry)}; exit: ${bdLine(x.perBattleDay.exit)}; held symbol: ${bdLine(x.perBattleDay.held)}; bench symbol: ${bdLine(x.perBattleDay.bench)}; entry on a held symbol: ${bdLine(x.perBattleDay.entryOnHeld)}; entry on a bench symbol: ${bdLine(x.perBattleDay.entryOnBench)}; act: ${bdLine(x.perBattleDay.act)}; hold: ${bdLine(x.perBattleDay.hold)}.`);
  p();
}
p('Examples (entry called shots whose symbol the check showed as HELD — "entry · held" above):');
p();
examples(out.B7.examples, (e, i) => p(`${i}. [${e.arm}] ${e.where} — ${e.row}`));
p();

// B8
p('### B8 — Research-objective seeds: exit called shots with no usable counterpart');
p();
p('**Usable** = a bench name the check showed as available. No usable counterpart = absent, outside the universe, the called shot\'s own symbol, a held name, a bench name locked by a cooldown (the swap refuses it, `api/_utils/agentSwapExecution.js:59-62`), or a universe name the check\'s bench did not show. "Narrow" counts only absent or outside the universe.');
p();
p(armHead); p(armSep);
armRow('Kept exit called shots with no usable counterpart', (a) => frac(out.B8.perArm[a].seeds, out.B8.perArm[a].exitRows));
armRow('…why', (a) => mixStr(out.B8.perArm[a].why));
armRow('Model calls with ≥ 1 such called shot', (a) => frac(out.B8.perArm[a].callsSeed, out.B8.perArm[a].calls));
armRow('Seed model calls on a trade-invalid result', (a) => String(out.B8.perArm[a].invalidAmongSeedCalls));
armRow('**Per battle-day (seed called shots)**', (a) => bdLine(out.B8.perArm[a].perBattleDay));
armRow('Per battle-day (model calls with ≥ 1 seed)', (a) => bdLine(out.B8.perArm[a].perBattleDayCalls));
armRow('Per battle-day (narrow: absent or outside the universe)', (a) => bdLine(out.B8.perArm[a].narrow));
p();
p('Examples:');
p();
examples(out.B8.examples, (e, i) => p(`${i}. [${e.arm}] ${e.where} — ${e.why} — ${e.row}`));
p();

// B9
const b9o = out.B9;
const withCoverage = (text) => text.replace(/\[\[([^\]]+)\]\]/g, (_, key) => {
  const v = b9o.coverage.coverage[key];
  if (v == null) stop(`B9 class text names an unknown coverage field: ${key}`);
  return `${pctStr(v, b9o.coverage.rows)} of rows`;
});
p(`### B9 — Tier 3 feasibility: bench-row fields, and the ${b9o.s2Checks} S2 checks`);
p();
p(`**Field coverage** over every bench row the ${b9o.coverage.contexts} bench-bearing main-sample contexts show (${b9o.coverage.rows} rows; status ${mixStr(b9o.coverage.statusKinds)}):`);
p();
p('| Field | Rows carrying it |');
p('|---|---|');
for (const [k, v] of Object.entries(b9o.coverage.coverage)) p(`| ${k} | ${frac(v, b9o.coverage.rows)} |`);
p();
p(`mcap classes: ${mixStr(b9o.coverage.mcap)}. Momentum divergence: ${mixStr(b9o.coverage.divergence)}.`);
p();
p(`Sector: the three sources (CSV, technical header, fundamentals header) disagree on ${b9o.coverage.sectorSourcesDisagree} rows; ${b9o.coverage.sectorFromHeaderOnly} rows (${b9o.coverage.sectorFromHeaderOnlyLocked} of them locked) carry their sector only in a header. Daily% and ATR% are never missing because the renderer writes 0 and 2.5 for a missing value (\`agentEvalPromptAssembly.js:1501-1502\`): ${b9o.coverage.dailyZero} rows show a 0.00 % change and ${b9o.coverage.atrFallbackValue} an ATR of 2.5 % — real or fallback, which the row cannot tell apart. No reading below uses either field.`);
p();
p('**Criteria.** *Not* — the directive is not a criterion on bench names (exit timing, stops, sizing, the agent\'s own trade history). *Feasible* — an entry criterion that a field on at least 98 % of bench rows measures directly, needing only a threshold or cut on it. *Partial* — the direct measure is on a minority of rows, or a field covers only part of the criterion, or only a proxy exists.');
p();
p('**Every canonical directive on the two menus** (`getAllowlist`, `src/data/archetypeAdjustments.js`), classified by those criteria:');
p();
p('| Id | Canonical text | Class | Bench-row fields (recorded row format; share of the bench rows carrying each) |');
p('|---|---|---|---|');
for (const arch of ['momentum_chaser', 'contrarian']) for (const d of b9o.menus[arch]) {
  const k = CLASSES[d.id];
  if (!k) stop(`${d.id} has no B9 class`);
  p(`| ${d.id} | ${d.text} | ${k.cls} | ${withCoverage(k.fields)} |`);
}
p();
p(`Classes: ${mixStr(Object.values(CLASSES).reduce((o, k) => inc(o, k.cls), {}))}.`);
p();
p(`**The ${b9o.s2Checks} S2 checks** (${mixStr(b9o.s2ByArchetype)}): bench size ${num(b9o.benchSizes.mean)} · ${num(b9o.benchSizes.median)} · ${b9o.benchSizes.min}–${b9o.benchSizes.max} names. Pass counts are over every bench name shown (locked names included), for the checks of the directive's own archetype; mean · median · min–max per check.`);
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
p('### B10 — Minted calls per declaring model call');
p();
p('A declaring model call is one rep of a check whose kept block is non-empty (each rep counts on its own). A minted call is one call record; in round 3 every one comes from a kept called shot (no fork was offered).');
p();
p(armHead); p(armSep);
armRow('Declaring model calls (of all model calls)', (a) => frac(out.B10.perArm[a].declaring, out.B10.perArm[a].calls));
for (const bucket of B10_BUCKETS) armRow(`…with ${bucket} minted`, (a) => frac(out.B10.perArm[a].dist[bucket] || 0, out.B10.perArm[a].declaring));
armRow('Largest', (a) => String(out.B10.perArm[a].max));
armRow('Rep 1 / rep 2', (a) => REPS.map((rep) => `rep ${rep} — ${bucketLine(out.B10.perArm[a].byRep[rep])}`).join('; '));
armRow('By archetype', (a) => Object.keys(out.B10.perArm[a].byArchetype).sort().map((k) => `${k} — ${bucketLine(out.B10.perArm[a].byArchetype[k])}`).join('; '));
armRow('Declaring model calls on a trade-invalid result', (a) => String(out.B10.perArm[a].invalidAmongDeclaring));
armRow('Per check: checks declaring in ≥ 1 rep', (a) => `${frac(out.B10.perArm[a].perCheck.declaring, s.sample.length)}; in both reps ${out.B10.perArm[a].perCheck.both}`);
armRow('…minted calls per declaring check (two reps, two ways to combine them)', (a) => `rep with more — ${bucketLine(out.B10.perArm[a].perCheck.larger)}; declaring rep with fewer — ${bucketLine(out.B10.perArm[a].perCheck.smallerDeclaring)}`);
armRow('Per battle-day (minted calls)', (a) => bdLine(out.B10.perArm[a].perBattleDay));
armRow('Per battle-day (declaring model calls)', (a) => bdLine(out.B10.perArm[a].declaringPerBattleDay));
p();
p('Examples (declaring model calls with 4 or more minted calls; their kept called shots):');
p();
examples(out.B10.examples, (e, i) => { p(`${i}. [${e.arm}] ${e.where}`); for (const r of e.rows) p(`   - ${r}`); });
p();

const markdown = `${L.join('\n')}\n`;
process.stdout.write(markdown);
if (JSON_OUT) writeFileSync(JSON_OUT, `${JSON.stringify(out, null, 1)}\n`);
