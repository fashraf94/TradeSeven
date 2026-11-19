// api/_utils/practiceField/corporateActionSequences.ordered.test.js
//
// Practice Field T1a-2b-3, final fix (Astra's round-2 confirmation, docs/audits/20261119_ASTRA_CONFIRMATION_T1A2B3_ROUND2.md)
// — S-6's ORDERED histories, through the same checks as corporateActionSequences.test.js (I-1 to I-5 after every close, and
// the independent oracle, __testsupport__/caOracle.js):
//   · her independent generator, rebuilt from her description (seeds 19112000–19112031: D01's and D02's classes, with her
//     controls) — her harness was not attached;
//   · the ordered generator (generateWide with `ordered`): one chain of ordered events on one id per history — C03's order,
//     D01's correction and re-date in one close, D02's pending founder split met by same-id vendor rows — beside every
//     random event of the wide generator; each shape must be REACHED on one id, not only written.
// (Its own file so it runs beside the other sequence file, not after it.)

import { describe, it, expect } from 'vitest';
import { generateWide, generateAstraR2, run, installSequenceHooks } from './__testsupport__/caSequences.js';

installSequenceHooks();

describe('S-6 — Astra round 2: her independent generator (seeds 19112000–19112031), rebuilt from her description', () => {
  it.each(Array.from({ length: 32 }, (_, k) => 19112000 + k))('seed %i', async (seed) => {
    await run(generateAstraR2(seed));
  }, 60_000);
});

// (The final soak's failing seeds, kept: SOAK-R3-1 — 1911201905, 1911200342 — and SOAK-R3-2 — 1911205903, 1911202882.)
describe('S-6 — the final soak\'s failing histories, as fixed seeds', () => {
  it.each([1911201905, 1911200342, 1911205903, 1911202882])('ordered seed %i', async (seed) => {
    await run(generateWide(seed, { ordered: true }));
  }, 120_000);
});

const ORDERED = Array.from({ length: 60 }, (_, k) => 1911190000 + k);
const shapes = { c03: 0, d01: 0, d02: 0 };
describe('S-6 — the ordered generator: C03, D01 and D02 on one id, through every check', () => {
  it.each(ORDERED)('ordered seed %i', async (seed) => {
    const { inputs } = await run(generateWide(seed, { ordered: true }));
    for (const [k, v] of Object.entries(inputs.shapes())) shapes[k] += v;
  }, 120_000);
  it('each ordered shape was reached on one id at least three times', () => {
    for (const k of ['c03', 'd01', 'd02']) expect(shapes[k], k).toBeGreaterThanOrEqual(3);
  });
});
