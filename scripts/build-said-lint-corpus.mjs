// scripts/build-said-lint-corpus.mjs
//
// Cockpit Build 1a — THE LINT CORPUS (spec docs/COCKPIT_BUILD1A_SPEC_V1_2.md
// §4; Astra B1R2-12/13). Derives api/_utils/callRecords/__fixtures__/saidLintCorpus.json
// from the declarations-wording experiment's LOCAL round-2 raw records
// (experiments/declarations-wording/raw/round2/ — git-ignored, on the
// founder's machine only): one row per MINTED CALLED SHOT of arms D and D2,
// over the checks complete in every arm × rep (the experiment's own
// population: scripts/declarations-wording-experiment.mjs analyze()),
// `{ arm, rep, check, said, basis, flagged, terms }` — AGENT TEXT ONLY, no
// player text. The labels are computed by the SHIPPING rule
// (api/_utils/callRecords/copy.js saidFlagsRound2, verbatim from the
// experiment) and cross-checked against the experiment's published counts
// (D 23 of 167, D2 60 of 314): a mismatch aborts, nothing is written.
//
// If the raw folder is absent this script STOPS (exit 2). Read-only against
// the raw folder; the only file it writes is the corpus.
//
// USAGE (repo root): node scripts/build-said-lint-corpus.mjs

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureDeclarations } from '../api/_utils/callRecords/validate.js';
import { bindHorizon } from '../api/_utils/callRecords/horizon.js';
import { saidFlagsRound2 } from '../api/_utils/callRecords/copy.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW_DIR = path.join(ROOT, 'experiments', 'declarations-wording', 'raw', 'round2');
const CALLS_DIR = path.join(RAW_DIR, 'calls');
const OUT = path.join(ROOT, 'api', '_utils', 'callRecords', '__fixtures__', 'saidLintCorpus.json');

/** The experiment's published round-2 counts (results.md "`said` inconsistency (called shots)"). */
const EXPECTED = { D: { shots: 167, flagged: 23 }, D2: { shots: 314, flagged: 60 } };
const ARMS = ['D', 'D2'];
const RUN_ARMS = ['A', 'D', 'D2'];
const REPS = [1, 2];

if (!existsSync(RAW_DIR) || !existsSync(CALLS_DIR) || !existsSync(path.join(RAW_DIR, 'sample.json'))) {
  console.error(`STOP: the raw round-2 folder is absent (${RAW_DIR}); the corpus cannot be derived here.`);
  process.exit(2);
}

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const sample = readJson(path.join(RAW_DIR, 'sample.json'));
const results = existsSync(path.join(RAW_DIR, 'results.json')) ? readJson(path.join(RAW_DIR, 'results.json')) : null;

const recs = new Map();
for (const f of readdirSync(CALLS_DIR)) {
  const r = readJson(path.join(CALLS_DIR, f));
  recs.set(`${r.arm}|${r.rep}|${r.battleId}|${r.evalId}`, r);
}
const get = (arm, rep, c) => recs.get(`${arm}|${rep}|${c.battleId}|${c.evalId}`) ?? null;
// The experiment's paired population: checks with every one of the arm × rep calls present.
const complete = sample.sample.filter((c) => RUN_ARMS.every((a) => REPS.every((rep) => get(a, rep, c))));

const meta = sample.battlesMeta;
const validate = (c, input) => captureDeclarations(input?.declarations, {
  universe: meta[c.battleId].universe,
  resolveHorizon: bindHorizon({ promptBuiltAtMs: c.promptBuiltAtMs, mintedAtMs: c.mintedAtMs, battleExpiresAtMs: meta[c.battleId].battleExpiresAtMs }),
});

const rows = [];
const counts = {};
for (const arm of ARMS) {
  let shots = 0;
  let flagged = 0;
  for (const c of complete) {
    for (const rep of REPS) {
      const r = get(arm, rep, c);
      const v = validate(c, r.toolUseInput);
      if (v.phase !== 'expected') continue;
      for (const call of v.validation.calls) {
        if (call.source !== 'calledShots') continue;
        const terms = saidFlagsRound2(call.row);
        shots += 1;
        if (terms.length) flagged += 1;
        rows.push({
          arm, rep, check: `${c.battleId}:${c.evalId}`,
          said: call.row.said, basis: call.horizon.basis, flagged: terms.length > 0, terms,
        });
      }
    }
  }
  counts[arm] = { shots, flagged };
}

for (const arm of ARMS) {
  const got = counts[arm];
  const want = EXPECTED[arm];
  if (got.shots !== want.shots || got.flagged !== want.flagged) {
    console.error(`STOP: arm ${arm} counts ${JSON.stringify(got)} do not match the experiment's ${JSON.stringify(want)}; nothing written.`);
    process.exit(2);
  }
}

const corpus = {
  provenance: {
    source: 'experiments/declarations-wording/raw/round2 (git-ignored; local to the founder\'s machine)',
    run: { seed: sample.seed, sampleCreatedAt: sample.createdAt, analyzedAt: results?.analyzedAt ?? null, round: results?.round ?? 2 },
    population: `minted called shots of arms D and D2 over the ${complete.length} checks complete in every arm × rep (${complete.length * REPS.length} calls per arm)`,
    rule: 'round-2 lexical rule — scripts/declarations-wording-experiment.mjs:376-397, verbatim in api/_utils/callRecords/copy.js (saidFlagsRound2)',
    text: 'agent text only (the declared `said`); no player text',
    builtBy: 'scripts/build-said-lint-corpus.mjs',
  },
  counts,
  rows,
};
const json = `${JSON.stringify(corpus, null, 2)}\n`;
writeFileSync(OUT, json);
console.log(`wrote ${OUT}: ${rows.length} rows; counts ${JSON.stringify(counts)}; sha256 ${createHash('sha256').update(json).digest('hex')}`);
