#!/usr/bin/env node
// scripts/experiments/tf-setup-golden-baseline-check.mjs
//
// Measured Trend Evidence, slice 1 (P3) — the CROSS-REVISION golden baseline
// check (V3 build prompt §4.3, resolution point 6).
//
// Within one revision, golden.test.js can only prove that the golden-verdict
// fixture, the baseline's last entry and SEMANTICS_ID agree with each other.
// It cannot see a golden regenerated under the SAME id, because the test and
// the fixture change together. This script reads the baseline, the golden and
// thresholds.js at a base ref (via `git show`) and at the working tree, and
// fails when:
//   - the golden bytes changed but the last semanticsId did not;
//   - any historical baseline entry was rewritten or removed;
//   - the last entry's sha does not match the golden at the same ref;
//   - SEMANTICS_ID changed without a new entry;
//   - THRESHOLDS_HASH changed without a new SETUP_VERSION.
// When the base ref carries none of the three files, the run is an INITIAL
// BASELINE CREATION: it says so, verifies the working tree's own integrity,
// and makes no historical claim.
//
// It runs in slice 1's final checks against the merge-base with origin/main;
// its output goes into the build report and the PR. Wiring it into CI is a
// separate one-line task (it edits .github/workflows/tests.yml).
//
// USAGE (repo root):
//   node scripts/experiments/tf-setup-golden-baseline-check.mjs --base <ref> [--json]
//
// Read-only: `git show` and file reads; the only write is a temp copy of
// thresholds.js at the base ref so it can be imported, deleted afterwards.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, '..', '..');

export const PATHS = Object.freeze({
  baseline: 'api/_utils/setupEvaluator/__fixtures__/goldenBaseline.json',
  golden: 'api/_utils/setupEvaluator/__fixtures__/goldenVerdicts.json',
  thresholds: 'api/_utils/setupEvaluator/thresholds.js',
});

// ---------------------------------------------------------------- canonical bytes

/** Sorted-key, 2-space, LF JSON with a trailing LF: the bytes the baseline hashes, whatever the checkout's line endings. */
export function canonicalJson(value) {
  const sort = (v) => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort(v[k])]));
    return v;
  };
  return `${JSON.stringify(sort(value), null, 2)}\n`;
}

export function canonicalSha256(value) {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

/** 'tf-setup-v1/sem-3' → 3; anything else → null. */
export function semanticsSeq(id) {
  const m = typeof id === 'string' ? /\/sem-(\d+)$/.exec(id) : null;
  return m ? Number(m[1]) : null;
}

/** 'tf-setup-v2/sem-1' → { version: 2, seq: 1 }; the history is ordered by (version, seq), so a new setupVersion may restart at sem-1 (review TE5-8). */
export function semanticsOrder(id) {
  const m = typeof id === 'string' ? /^tf-setup-v(\d+)\/sem-(\d+)$/.exec(id) : null;
  return m ? { version: Number(m[1]), seq: Number(m[2]) } : null;
}

const orderFollows = (a, b) => a && b && (b.version > a.version || (b.version === a.version && b.seq > a.seq));

// ---------------------------------------------------------------- the rules

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

/**
 * In-revision integrity of one side: the baseline is a non-empty append-only
 * history whose LAST entry names the golden's canonical sha and the module's
 * SEMANTICS_ID; ids unique and strictly increasing; recordedAt ISO and
 * non-decreasing; every entry carries a note.
 */
export function checkBaselineIntegrity({ baseline, goldenSha, semanticsId }, label = 'head') {
  const failures = [];
  if (!Array.isArray(baseline) || baseline.length === 0) return [`${label}: goldenBaseline.json is not a non-empty array`];
  baseline.forEach((e, i) => {
    if (!e || typeof e !== 'object') { failures.push(`${label}: entry ${i} is not an object`); return; }
    if (semanticsOrder(e.semanticsId) === null) failures.push(`${label}: entry ${i} semanticsId ${JSON.stringify(e.semanticsId)} is not tf-setup-v<n>/sem-<n>`);
    if (typeof e.goldenSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(e.goldenSha256)) failures.push(`${label}: entry ${i} goldenSha256 is not a sha256 hex`);
    if (typeof e.recordedAt !== 'string' || !ISO_RE.test(e.recordedAt)) failures.push(`${label}: entry ${i} recordedAt is not an ISO instant`);
    if (typeof e.note !== 'string' || !e.note.trim()) failures.push(`${label}: entry ${i} has no note`);
  });
  const ids = baseline.map((e) => e?.semanticsId);
  if (new Set(ids).size !== ids.length) failures.push(`${label}: semanticsIds are not unique`);
  for (let i = 1; i < baseline.length; i++) {
    const a = semanticsOrder(baseline[i - 1]?.semanticsId); const b = semanticsOrder(baseline[i]?.semanticsId);
    if (a && b && !orderFollows(a, b)) failures.push(`${label}: entry ${i} (${ids[i]}) does not follow ${ids[i - 1]} (ordered by setupVersion, then sem)`);
    if (typeof baseline[i - 1]?.recordedAt === 'string' && typeof baseline[i]?.recordedAt === 'string' && baseline[i].recordedAt < baseline[i - 1].recordedAt) failures.push(`${label}: entry ${i} recordedAt precedes entry ${i - 1}`);
  }
  const last = baseline[baseline.length - 1];
  if (last?.goldenSha256 !== goldenSha) failures.push(`${label}: the last entry's goldenSha256 (${String(last?.goldenSha256).slice(0, 12)}…) does not match the golden's canonical sha (${String(goldenSha).slice(0, 12)}…)`);
  if (last?.semanticsId !== semanticsId) failures.push(`${label}: the last entry's semanticsId (${last?.semanticsId}) is not the module's SEMANTICS_ID (${semanticsId})`);
  return failures;
}

const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The cross-revision comparison. Each side is null (absent) or
 * `{ baseline, goldenSha, semanticsId, thresholdsHash, setupVersion }`.
 * Pure: no git, no files — the CLI loads the sides, tests feed fixtures.
 */
export function compareRevisions({ base, head }) {
  if (!head) throw new Error('compareRevisions: head is required');
  if (base === null || base === undefined) {
    const failures = checkBaselineIntegrity(head, 'head');
    return { mode: 'initial', ok: failures.length === 0, failures, notes: ['initial baseline creation: the base ref carries no evaluator baseline; only the working tree\'s own integrity is verified and no historical comparison is claimed'] };
  }
  const failures = [...checkBaselineIntegrity(base, 'base'), ...checkBaselineIntegrity(head, 'head')];
  const notes = [];
  const bl = Array.isArray(base.baseline) ? base.baseline : [];
  const hl = Array.isArray(head.baseline) ? head.baseline : [];
  // Append-only history: every base entry must be present, unchanged, at the same index.
  if (hl.length < bl.length) failures.push(`history: ${bl.length - hl.length} base entr${bl.length - hl.length === 1 ? 'y was' : 'ies were'} removed`);
  for (let i = 0; i < Math.min(bl.length, hl.length); i++) {
    if (!deepEqual(bl[i], hl[i])) failures.push(`history: entry ${i} (${bl[i]?.semanticsId}) was rewritten`);
  }
  const grew = hl.length > bl.length;
  const goldenChanged = head.goldenSha !== base.goldenSha;
  const idChanged = head.semanticsId !== base.semanticsId;
  if (goldenChanged && !idChanged) failures.push(`golden: the golden bytes changed (${base.goldenSha.slice(0, 12)}… → ${head.goldenSha.slice(0, 12)}…) but SEMANTICS_ID is still ${head.semanticsId}`);
  if (goldenChanged && !grew) failures.push('golden: the golden bytes changed but no baseline entry was appended');
  if (idChanged && !grew) failures.push(`semantics: SEMANTICS_ID changed (${base.semanticsId} → ${head.semanticsId}) without a new baseline entry`);
  if (idChanged && grew && hl[hl.length - 1]?.semanticsId !== head.semanticsId) failures.push('semantics: the appended entry does not carry the new SEMANTICS_ID');
  if (head.thresholdsHash !== base.thresholdsHash && head.setupVersion === base.setupVersion) failures.push(`thresholds: THRESHOLDS_HASH changed (${base.thresholdsHash} → ${head.thresholdsHash}) without a new SETUP_VERSION (still ${head.setupVersion})`);
  if (!goldenChanged && !idChanged) notes.push('golden and semantics unchanged against the base');
  if (goldenChanged && idChanged && grew) notes.push(`golden changed under a new semantics id ${head.semanticsId} with a new baseline entry`);
  if (head.thresholdsHash !== base.thresholdsHash) notes.push(`thresholds changed: ${base.setupVersion}/${base.thresholdsHash} → ${head.setupVersion}/${head.thresholdsHash}`);
  return { mode: 'compare', ok: failures.length === 0, failures, notes };
}

// ---------------------------------------------------------------- loading a side

function gitShow(ref, relPath) {
  try {
    return execFileSync('git', ['show', `${ref}:${relPath}`], { cwd: PROJECT_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return null;
  }
}

async function importThresholdsText(text, tag) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'tf-setup-baseline-'));
  const file = path.join(dir, `thresholds.${tag}.mjs`);
  try {
    writeFileSync(file, text);
    const mod = await import(pathToFileURL(file).href);
    return { semanticsId: mod.SEMANTICS_ID, thresholdsHash: mod.THRESHOLDS_HASH, setupVersion: mod.SETUP_VERSION };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The side at `ref` (null = the working tree). Returns null when the base carries none of the files; throws when it carries some but not all. */
export async function loadSide(ref) {
  const read = (rel) => (ref === null ? (() => { try { return readFileSync(path.join(PROJECT_ROOT, rel), 'utf8'); } catch { return null; } })() : gitShow(ref, rel));
  const texts = { baseline: read(PATHS.baseline), golden: read(PATHS.golden), thresholds: read(PATHS.thresholds) };
  const present = Object.entries(texts).filter(([, t]) => t !== null).map(([k]) => k);
  if (present.length === 0) return null;
  if (present.length < 3) throw new Error(`${ref ?? 'working tree'}: only ${present.join(', ')} present of baseline, golden, thresholds — an inconsistent revision`);
  const baseline = JSON.parse(texts.baseline);
  const golden = JSON.parse(texts.golden);
  const ids = ref === null
    ? await import(pathToFileURL(path.join(PROJECT_ROOT, PATHS.thresholds)).href).then((m) => ({ semanticsId: m.SEMANTICS_ID, thresholdsHash: m.THRESHOLDS_HASH, setupVersion: m.SETUP_VERSION }))
    : await importThresholdsText(texts.thresholds, String(ref).replace(/[^A-Za-z0-9]/g, '_').slice(0, 24));
  return { baseline, goldenSha: canonicalSha256(golden), ...ids };
}

function resolveRef(ref) {
  try { return execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], { cwd: PROJECT_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; }
}

// ---------------------------------------------------------------- CLI

async function main(argv) {
  const args = argv.slice(2);
  const baseIdx = args.indexOf('--base');
  const base = baseIdx >= 0 ? args[baseIdx + 1] : null;
  const asJson = args.includes('--json');
  if (!base) {
    console.error('usage: node scripts/experiments/tf-setup-golden-baseline-check.mjs --base <ref> [--json]');
    return 2;
  }
  const baseSha = resolveRef(base);
  if (!baseSha) { console.error(`STOP: base ref ${base} does not resolve to a commit`); return 2; }
  const headSha = resolveRef('HEAD');
  const baseSide = await loadSide(base);
  const headSide = await loadSide(null);
  if (!headSide) { console.error('STOP: the working tree carries no evaluator baseline, golden or thresholds'); return 2; }
  const result = compareRevisions({ base: baseSide, head: headSide });
  const out = {
    base: { ref: base, sha: baseSha, present: baseSide !== null, semanticsId: baseSide?.semanticsId ?? null, goldenSha256: baseSide?.goldenSha ?? null, thresholdsHash: baseSide?.thresholdsHash ?? null, setupVersion: baseSide?.setupVersion ?? null, entries: baseSide?.baseline.length ?? 0 },
    head: { sha: headSha, semanticsId: headSide.semanticsId, goldenSha256: headSide.goldenSha, thresholdsHash: headSide.thresholdsHash, setupVersion: headSide.setupVersion, entries: headSide.baseline.length },
    ...result,
  };
  if (asJson) console.log(JSON.stringify(out, null, 1));
  else {
    console.log(`tf-setup golden baseline check — mode: ${result.mode}${result.mode === 'initial' ? ' (initial baseline creation)' : ''}`);
    console.log(`  base ${base} = ${baseSha}: ${baseSide ? `${baseSide.semanticsId}, golden ${baseSide.goldenSha.slice(0, 12)}…, thresholds ${baseSide.setupVersion}/${baseSide.thresholdsHash}, ${baseSide.baseline.length} entr${baseSide.baseline.length === 1 ? 'y' : 'ies'}` : 'no evaluator baseline, golden or thresholds'}`);
    console.log(`  head (working tree, HEAD ${headSha}): ${headSide.semanticsId}, golden ${headSide.goldenSha.slice(0, 12)}…, thresholds ${headSide.setupVersion}/${headSide.thresholdsHash}, ${headSide.baseline.length} entr${headSide.baseline.length === 1 ? 'y' : 'ies'}`);
    for (const n of result.notes) console.log(`  note: ${n}`);
    for (const f of result.failures) console.log(`  FAIL: ${f}`);
    console.log(`  result: ${result.ok ? 'PASS' : 'FAIL'}`);
  }
  return result.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main(process.argv).then((code) => process.exit(code), (err) => { console.error(`STOP: ${err?.message || err}`); process.exit(2); });
}
