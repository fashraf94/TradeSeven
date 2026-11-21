// api/_utils/practiceField/corporateActionLateAsks.equivalence.test.js
//
// Practice Field T1a-2b-4, fix round — THE BATTERY'S TWO SURVIVORS, SETTLED BY TEST (the founder: "kill each, or prove with a
// test that it changes nothing stored"). Neither can be killed: each mutates code the ruling made unreachable. So this
// row proves each changes nothing stored. It runs a corpus of histories three ways — a PROBE copy of the real
// `adjustments.js` (its behaviour unchanged, counting how often each spot is reached and how often the mutant's answer
// would differ), and a copy with each mutant applied — and requires every stored document of every history to be
// identical, and the mutant's answer never to differ where the spot is reached.
//
//   NL2c  step 3's received-sum fallback for an UNPAID id → 0. Every posted late entitlement or ruled correction makes its
//         id a paid dividend (`paidDividends`), so the fallback only runs where nothing was posted: the sum is always 0.
//   FR2   `shareDoubtOn`'s same-date ordering of share-basis rows (RFX-2) → any same-date row holds. Since L-5, two
//         share-basis ids of one date are recorded as one ambiguity before any doubt check, so the ordering is never
//         consulted.
//
// The default corpus is small (it runs in every suite and in the battery); PF_EQUIV_CORPUS=full runs every fixed late
// history, the kept soak seeds, the 36 shape seeds, the 18 refuter-shape seeds and the probe seeds (the report's run).
// Where the battery has mutated the very line a spot needs, that spot is skipped: this row never stands in for a kill.

import { describe, it, expect, vi, afterAll } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(HERE, 'adjustments.js'), 'utf8');
const SPOTS = {
  NL2c: {
    from: '      const receivedCents = d ? d.cents : postedAdjustments(cur()).filter((a) => a.actionId === p.actionId).reduce((n, a) => n + toCents(a.amountUsd || 0), 0);',
    probe: '      const receivedCents = d ? d.cents : ((s) => { globalThis.__pfEquiv.NL2c.reached += 1; if (s !== 0) globalThis.__pfEquiv.NL2c.differs += 1; return s; })(postedAdjustments(cur()).filter((a) => a.actionId === p.actionId).reduce((n, a) => n + toCents(a.amountUsd || 0), 0));',
    mutant: '      const receivedCents = d ? d.cents : 0;',
  },
  FR2: {
    from: '(r.effectiveDate === d && (!selfShare || String(r.actionId) < String(selfId)))',
    probe: '(r.effectiveDate === d && (!selfShare || ((o) => { globalThis.__pfEquiv.FR2.reached += 1; if (!o) globalThis.__pfEquiv.FR2.differs += 1; return o; })(String(r.actionId) < String(selfId))))',
    mutant: '(r.effectiveDate === d)',
  },
};
const present = Object.fromEntries(Object.entries(SPOTS).map(([k, s]) => [k, SOURCE.split(s.from).length - 1 === 1]));
const FULL = process.env.PF_EQUIV_CORPUS === 'full';

const dir = mkdtempSync(join(tmpdir(), 'pf-equivalence-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
/** A copy of adjustments.js with `edits` spliced in, its relative imports pointing back at the real modules. */
function moduleWith(name, edits) {
  let src = SOURCE;
  for (const [from, to] of edits) {
    const i = src.indexOf(from);
    src = src.slice(0, i) + to + src.slice(i + from.length);
  }
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

/** Every stored document of every history in the corpus, with `adjustments.js` replaced by the module at `url`. */
async function storedUnder(url) {
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
    restore();
    quiet.mockRestore();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.doUnmock('./adjustments.js');
    vi.resetModules();
  }
}

describe('the battery\'s two survivors change nothing stored (NL2c, FR2)', () => {
  let probe = null;
  const counts = () => globalThis.__pfEquiv;
  async function probeRun() {
    if (probe) return probe;
    globalThis.__pfEquiv = { NL2c: { reached: 0, differs: 0 }, FR2: { reached: 0, differs: 0 } };
    const edits = Object.entries(SPOTS).filter(([k]) => present[k]).map(([, s]) => [s.from, s.probe]);
    probe = { stored: await storedUnder(moduleWith('probe', edits)), counts: structuredClone(counts()) };
    return probe;
  }

  it.skipIf(!present.NL2c)('NL2c: the received-sum fallback is reached and always sums to $0; with it replaced by 0, every stored document of every history is identical', async () => {
    const p = await probeRun();
    console.log(`NL2c over ${p.stored.length} histories: reached ${p.counts.NL2c.reached}, differs ${p.counts.NL2c.differs}`);
    expect(p.counts.NL2c.reached, 'the corpus reaches the spot').toBeGreaterThan(0);
    expect(p.counts.NL2c.differs, 'the fallback never sums to anything but $0').toBe(0);
    const mutant = await storedUnder(moduleWith('NL2c', [[SPOTS.NL2c.from, SPOTS.NL2c.mutant]]));
    expect(mutant.length).toBe(p.stored.length);
    mutant.forEach((m, i) => expect(m === p.stored[i], `history ${i}: a stored document differs under NL2c`).toBe(true));
  }, 900_000);

  it.skipIf(!present.NL2c)('control: a change at the same spot that does move money is seen — the comparison can fail', async () => {
    const p = await probeRun();
    // (A cent "received" more, under the same corpus: either the harness's own oracle refuses the history — I-6 sees the
    // wrong net — or a stored proposal differs. Either shows the swapped module really runs.)
    let refused = null;
    let moved = null;
    try { moved = await storedUnder(moduleWith('control', [[SPOTS.NL2c.from, SPOTS.NL2c.from.replace('.reduce((n, a) => n + toCents(a.amountUsd || 0), 0);', '.reduce((n, a) => n + toCents(a.amountUsd || 0), 0) + 1;')]])); } catch (e) { refused = String(e?.message || e); }
    expect(refused !== null || moved.some((m, i) => m !== p.stored[i]), 'the change is seen').toBe(true);
  }, 900_000);

  it.skipIf(!present.FR2)('FR2: the same-date ordering never decides a doubt (its two forms never disagree); with it removed, every stored document of every history is identical', async () => {
    const p = await probeRun();
    console.log(`FR2 over ${p.stored.length} histories: reached ${p.counts.FR2.reached}, differs ${p.counts.FR2.differs}`);
    expect(p.counts.FR2.differs, 'the mutant\'s predicate never disagrees with the code\'s').toBe(0);
    const mutant = await storedUnder(moduleWith('FR2', [[SPOTS.FR2.from, SPOTS.FR2.mutant]]));
    expect(mutant.length).toBe(p.stored.length);
    mutant.forEach((m, i) => expect(m === p.stored[i], `history ${i}: a stored document differs under FR2`).toBe(true));
  }, 900_000);
});
