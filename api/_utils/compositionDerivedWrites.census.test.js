// api/_utils/compositionDerivedWrites.census.test.js
//
// Composition PR 4 — B1-EXT part 3: the CI DERIVED-WRITE census. Every writer
// that persists composition-DERIVED state must do (a) in-tx descriptor
// validation OR (b) full-source-tuple stamping with reader-side rejection —
// the decide.js splice pattern, generalized. This suite proves:
//   1. every censused derived writer's declared mechanism TOKENS are live in
//      its source (a deleted guard fails here, not in production);
//   1b. the wiring is CALL-SHAPED and ORDERED (§2 pass-2 L2-2: an import
//      statement alone must never satisfy the census — the writer-census
//      precedent's call-shape/position legs, applied here): declared call
//      sites exist verbatim, pin-before-commit ordering holds, and the raw
//      pre-splice write shapes are ABSENT (deleting the guarded call while
//      keeping the import fails on both axes);
//   2. the census is COMPLETE over the composition writer universe: every
//      writer class the A46 census names is classified here — derived or
//      explicitly excluded with a reason — so a NEW writer cannot slip the
//      question "how does this survive a generation flip?".

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const CENSUS = JSON.parse(readFileSync(resolve(HERE, 'compositionDerivedWritesCensus.json'), 'utf8'));
const WRITER_CENSUS = JSON.parse(readFileSync(resolve(HERE, 'compositionWriterCensus.json'), 'utf8'));

const read = (f) => readFileSync(resolve(REPO, f), 'utf8');

describe('B1-EXT part 3 — the derived-write census', () => {
  it('every derived writer carries its declared mechanism tokens in source (the wiring proof)', () => {
    for (const row of CENSUS.derivedWriters) {
      const src = read(row.file);
      for (const token of row.tokens) {
        expect(src.includes(token), `${row.file} lost its declared mechanism token '${token}' (${row.mechanism})`).toBe(true);
      }
    }
  });

  it('call-shaped + ordered wiring: declared call sites exist, pin precedes commit, raw pre-splice write shapes are absent (L2-2 — an import alone cannot pass)', () => {
    for (const row of CENSUS.derivedWriters) {
      const src = read(row.file);
      for (const call of row.callTokens ?? []) {
        expect(src.includes(call), `${row.file}: guarded CALL SITE '${call}' missing — the mechanism is imported but not invoked`).toBe(true);
      }
      for (const [before, after] of row.order ?? []) {
        const iBefore = src.indexOf(before);
        const iAfter = src.indexOf(after);
        expect(iBefore, `${row.file}: '${before}' missing`).toBeGreaterThan(-1);
        expect(iAfter, `${row.file}: '${after}' missing`).toBeGreaterThan(-1);
        expect(iBefore, `${row.file}: '${before}' must precede '${after}' (pin-before-commit)`).toBeLessThan(iAfter);
      }
      for (const raw of row.forbidden ?? []) {
        expect(src.includes(raw), `${row.file}: raw write shape '${raw}' present — the guarded call was bypassed`).toBe(false);
      }
    }
    // The two chokepoint rows MUST carry the strengthened legs — a census
    // edit that drops them regresses to token-presence and fails here.
    for (const file of ['api/agent/decide.js', 'api/_utils/agentBattleService.js']) {
      const row = CENSUS.derivedWriters.find((r) => r.file === file);
      expect((row.callTokens ?? []).length, `${file} row lost its callTokens leg`).toBeGreaterThan(0);
      expect((row.order ?? []).length, `${file} row lost its order leg`).toBeGreaterThan(0);
      expect((row.forbidden ?? []).length, `${file} row lost its forbidden leg`).toBeGreaterThan(0);
    }
  });

  it('the census is COMPLETE: every A46-censused composition writer class is classified derived or excluded', () => {
    const classified = new Set([
      ...CENSUS.derivedWriters.map((r) => r.file),
      ...CENSUS.excluded.map((r) => r.file.split('#')[0]),
    ]);
    const universe = new Set([
      ...(WRITER_CENSUS.fencedTransactionalUtils ?? []),
      ...(WRITER_CENSUS.backgroundLoops ?? []).map((l) => l.file),
      ...(WRITER_CENSUS.adminCliScripts ?? []).map((l) => l.file),
      'api/agent/decide.js',
      'api/_utils/agentBattleService.js',
      'src/services/seedDefaultTraits.js',
    ]);
    const unclassified = [...universe].filter((f) => !classified.has(f));
    expect(unclassified, 'composition writer class(es) not classified in the derived-write census — decide: derived (name the mechanism) or excluded (name the reason)').toEqual([]);
  });

  it('every exclusion states a reason (no silent waivers)', () => {
    for (const row of CENSUS.excluded) {
      expect(typeof row.reason === 'string' && row.reason.length > 20, `${row.file} exclusion needs a substantive reason`).toBe(true);
    }
  });
});
