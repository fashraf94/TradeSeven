// api/_utils/practiceField/corporateActionLateAsks.equivalence.test.js
//
// Practice Field T1a-2b-4, fix round — THE BATTERY'S LAST SURVIVOR, SETTLED BY TEST (the founder: "kill each, or prove with a
// test that it changes nothing stored"). Of the battery's two survivors, FR2 is now killed (the fourth refuter's EQ-1 row in
// corporateActionLateAsks.refuter.test.js). NL2c cannot be killed: its spot is reached, and its mutant gives the same
// answer every time. So this row proves it changes nothing stored.
//
//   NL2c  step 3's received-sum fallback for an id NOT in `paidDividends` → 0. Every posting that moves money is a
//         `cash_dividend` adjustment of an id already paid when it posted (a late entitlement makes its id paid; a ruled
//         correction or a late_basis is posted only for a paid id; a share-basis ruled correction posts $0), and the paid
//         set never shrinks. So where the fallback runs, nothing non-zero was ever posted for the id: the sum is $0.
//
// The row runs a corpus of histories three ways: under a PROBE copy of the real `adjustments.js` (behaviour unchanged,
// counting how often the spot is reached and how often the sum is not $0), under the NL2c mutant, and — as the control —
// under a copy that adds one cent there. It requires the spot reached, the sum always $0, every stored document of every
// history identical under the mutant, and the cent caught. Each copy marks itself when loaded, and the row checks the
// mark: the copy, not the real module, is what ran.
//
// The default corpus is small (it runs in every suite and in the battery); PF_EQUIV_CORPUS=full runs every fixed late
// history, the kept soak seeds, the 36 shape seeds, the 18 refuter-shape seeds, the probe seeds and the final soak's seeds
// (90 histories: the report's run).
//
// Where the anchor is missing the rows skip. That is deliberate: in the mutation battery the NL2c mutant removes the
// anchor, and a row that failed on a missing anchor would count as a false kill of it. (So a reformatted line skips here
// too; the report's battery lists NL2c as a survivor, which is where a lost anchor would show.)

import { describe, it, expect, vi, afterAll } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(HERE, 'adjustments.js'), 'utf8');
const FROM = '      const receivedCents = d ? d.cents : postedAdjustments(cur()).filter((a) => a.actionId === p.actionId).reduce((n, a) => n + toCents(a.amountUsd || 0), 0);';
const PROBE = '      const receivedCents = d ? d.cents : ((s) => { globalThis.__pfEquiv.reached += 1; if (s !== 0) globalThis.__pfEquiv.differs += 1; return s; })(postedAdjustments(cur()).filter((a) => a.actionId === p.actionId).reduce((n, a) => n + toCents(a.amountUsd || 0), 0));';
const MUTANT = '      const receivedCents = d ? d.cents : 0;';
const CONTROL = FROM.replace('.reduce((n, a) => n + toCents(a.amountUsd || 0), 0);', '.reduce((n, a) => n + toCents(a.amountUsd || 0), 0) + 1;');
const present = SOURCE.split(FROM).length - 1 === 1;
const FULL = process.env.PF_EQUIV_CORPUS === 'full';

const dir = mkdtempSync(join(tmpdir(), 'pf-equivalence-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
/** A copy of adjustments.js with FROM replaced by `to`, marking itself loaded, its relative imports pointing back at the real modules. */
function moduleWith(name, to) {
  const i = SOURCE.indexOf(FROM);
  let src = `globalThis.__pfEquivLoaded = ${JSON.stringify(name)};\n${SOURCE.slice(0, i)}${to}${SOURCE.slice(i + FROM.length)}`;
  src = src.replace(/from '(\.\.?\/[^']+)'/g, (_, rel) => `from '${pathToFileURL(join(HERE, rel)).href}'`);
  const file = join(dir, `adjustments.${name}.js`);
  writeFileSync(file, src);
  return pathToFileURL(file).href;
}

/** The corpus: plans built from a freshly imported harness. */
function corpus(seq) {
  const plans = [seq.ASTRA_T2E[0], seq.ASTRA_T2E[1], seq.FIXED_LATE.find((p) => p.seed === 'astra-T2D-03'), seq.generateLate(2119990000, { shapes: true }), seq.generateLate(2120990000, { refuter: true })];
  if (!FULL) return plans;
  return [
    ...seq.FIXED_LATE, ...seq.ASTRA_T2E,
    ...seq.LATE_SOAK_SEEDS.map((s) => seq.generateLate(s)),
    ...Array.from({ length: 36 }, (_, k) => seq.generateLate(2119990000 + k, { shapes: true })),
    ...Array.from({ length: 18 }, (_, k) => seq.generateLate(2120990000 + k, { refuter: true })),
    ...[2121900008, 2121900051, 2121900062, 2121900069, 2121900154, 2121900278].map((s) => seq.generateLate(s, { refuter: true })),
    ...[2120005408, 2120005580].map((s) => seq.generateLate(s, { shapes: true })),
  ];
}

/** Every stored document of every history in the corpus, with `adjustments.js` replaced by the copy `name`. */
async function storedUnder(name, to) {
  const url = moduleWith(name, to);
  globalThis.__pfEquivLoaded = null;
  vi.resetModules();
  vi.doMock('./adjustments.js', () => import(url));
  const mode = await import('./mode.js');
  const seq = await import('./__testsupport__/caSequences.js');
  const restore = mode.setPracticeFieldModeForTests('on');
  vi.stubEnv('EODHD_API_KEY', '');
  vi.stubGlobal('fetch', async () => { throw new Error('offline'); });
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const out = [];
    for (const plan of corpus(seq)) {
      const { store } = await seq.run(plan);
      out.push(JSON.stringify([...store.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([path, entry]) => [path, entry.data])));
    }
    return out;
  } finally {
    const loaded = globalThis.__pfEquivLoaded;
    restore();
    quiet.mockRestore();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.doUnmock('./adjustments.js');
    vi.resetModules();
    expect(loaded, `the ${name} copy is the module that ran`).toBe(name);
  }
}

describe.skipIf(!present)('the battery\'s last survivor changes nothing stored (NL2c)', () => {
  let probe = null;
  async function probeRun() {
    if (probe) return probe;
    globalThis.__pfEquiv = { reached: 0, differs: 0 };
    probe = { stored: await storedUnder('probe', PROBE), counts: { ...globalThis.__pfEquiv } };
    return probe;
  }

  it('NL2c: the received-sum fallback is reached and always sums to $0; with it replaced by 0, every stored document of every history is identical', async () => {
    const p = await probeRun();
    console.log(`NL2c over ${p.stored.length} histories: reached ${p.counts.reached}, differs ${p.counts.differs}`);
    expect(p.counts.reached, 'the corpus reaches the spot').toBeGreaterThan(0);
    expect(p.counts.differs, 'the fallback never sums to anything but $0').toBe(0);
    const mutant = await storedUnder('NL2c', MUTANT);
    expect(mutant.length).toBe(p.stored.length);
    mutant.forEach((m, i) => expect(m === p.stored[i], `history ${i}: a stored document differs under NL2c`).toBe(true));
  }, 900_000);

  it('control: one cent more at the same spot is caught — the harness\'s I-6 refuses the history, or a stored document differs', async () => {
    const p = await probeRun();
    let refused = null;
    let moved = null;
    try { moved = await storedUnder('control', CONTROL); } catch (e) { refused = String(e?.message || e); }
    // (CHANGED — T1a-2b-4 final fix: the oracle now checks every posting's net at the close that posted it, before any excuse
    // — Astra's test-only gap — so I-7's net at posting refuses the cent first; I-6 refused it before. Either is the wrong net.)
    if (refused !== null) expect(refused, 'refused for the wrong net (I-7 at posting, or I-6), not by anything else').toMatch(/ I-7 \(net at posting\) | I-6 /);
    else expect(moved.some((m, i) => m !== p.stored[i]), 'a stored document differs').toBe(true);
  }, 900_000);
});
