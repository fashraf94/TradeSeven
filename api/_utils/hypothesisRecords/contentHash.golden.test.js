// api/_utils/hypothesisRecords/contentHash.golden.test.js
//
// The Research Record Extension (7 Nov 2026) — THE CONTENT HASH IS UNCHANGED
// for every existing idea version. Two rows:
//   · every version (or carried sibling) stored in a frozen fixture — a JSON
//     capture holding all eight content fields and a contentHash — still
//     re-hashes to the hash main wrote;
//   · the case list (__fixtures__/contentHashCases.js), built through
//     buildVersionDoc / buildSaveVersion, hashes to the values CAPTURED BY
//     RUNNING THAT SAME FILE AGAINST MAIN'S model.js (an LF `git archive` of
//     d503dd07, the case file copied in at its own path) — so the new
//     evidence-ref canonical form leaves every researchWork-only version where
//     it was.
// And the new kinds are covered canonically: a ref's key order never moves the
// hash, a new-kind ref is part of the hashed content, and its canonical form is
// pinned here from this build.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { CONTENT_FIELDS, contentHashOf, buildVersionDoc } from './model.js';
import { CONTENT_HASH_CASES } from './__fixtures__/contentHashCases.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIRS = [resolve(HERE, '../__fixtures__'), resolve(HERE, '__fixtures__')];

// Captured on main d503dd07 (see the header). Never recaptured on a branch.
const MAIN_HASHES = {
  'deploy fixture v1 (manual, swing, no refs)': '5ac60029ebc8adbfdc9f1169eb445934e793e199ad8f4695063517d4c7ba5e80',
  'deploy fixture v2': 'eeb78560c8c3469defa2e585f68f105ac4845906ca984b17205bcaae18035dab',
  'deploy fixture v3, screener / longterm': '784ed4136ec84d141638bb8e37b36adb68b06c80949c89efe46a93826a72c899',
  'save v1, paste session, cites its dialogue record': '303fc9a05e7eeab3a0d109155e271fd40a2842dc3e2657e6711757630984b5b3',
  'save v1, theme session, no research record': 'a9489439ed40dd296e717fde489fa191e403b4ec4badf96c0ba8350e9496b0ce',
  'player version, conditions and three research refs, published': 'b362ba8af77dba8f6defe10b89ec75110469d6e81630f047f5fcf574cdab4cf2',
  'the same refs written id-first (key order never moves the hash)': 'b362ba8af77dba8f6defe10b89ec75110469d6e81630f047f5fcf574cdab4cf2',
  'unicode statement, unspecified / default, theme': 'a3988e269a12d23c10a6d4f29ffea6ff69d495c3dec1f3471e94988e69294d11',
  'intraday horizon': '6744460c05e1d31dbbeeab65ed95b88f165bbb3c79b0e53d35a6f4877701cd6f',
};

/** Every object in a JSON value that carries all eight content fields and a contentHash: a stored version or a carried sibling. */
function storedVersionsIn(value, path = '$', out = []) {
  if (Array.isArray(value)) value.forEach((v, i) => storedVersionsIn(v, `${path}[${i}]`, out));
  else if (value && typeof value === 'object') {
    if (typeof value.contentHash === 'string' && CONTENT_FIELDS.every((k) => Object.hasOwn(value, k))) out.push({ path, version: value });
    for (const [k, v] of Object.entries(value)) storedVersionsIn(v, `${path}.${k}`, out);
  }
  return out;
}
const jsonFixtures = FIXTURE_DIRS.flatMap((dir) => {
  let names = [];
  try { names = readdirSync(dir).filter((n) => n.endsWith('.json')); } catch { /* no such folder */ }
  return names.map((n) => join(dir, n));
});
const STORED = jsonFixtures.flatMap((file) => storedVersionsIn(JSON.parse(readFileSync(file, 'utf8'))).map((s) => ({ ...s, file })));

describe('every existing version keeps its content hash, byte for byte', () => {
  it('the fixture scan is alive: it finds the deploy golden\'s stored versions', () => {
    expect(STORED.length).toBeGreaterThanOrEqual(10);
    expect(new Set(STORED.map((s) => s.version.contentHash))).toEqual(new Set([MAIN_HASHES['deploy fixture v1 (manual, swing, no refs)'], MAIN_HASHES['deploy fixture v2']]));
  });
  it.each(STORED.map((s) => [`${s.file.split(/[\\/]/).pop()} ${s.path}`, s]))('%s re-hashes to the hash main stored', (_, s) => {
    expect(contentHashOf(s.version)).toBe(s.version.contentHash);
  });
  it('every case hashes to main\'s capture (one golden per case, none skipped)', () => {
    expect(Object.keys(CONTENT_HASH_CASES)).toEqual(Object.keys(MAIN_HASHES));
    const now = Object.fromEntries(Object.entries(CONTENT_HASH_CASES).map(([name, build]) => [name, build().contentHash]));
    expect(now).toEqual(MAIN_HASHES);
  });
  it('a stored hash still verifies after the version is re-read with Firestore\'s alphabetized keys', () => {
    for (const build of Object.values(CONTENT_HASH_CASES)) {
      const v = build();
      const alphabetized = JSON.parse(JSON.stringify(v, (k, val) => (val && typeof val === 'object' && !Array.isArray(val)
        ? Object.fromEntries(Object.keys(val).sort().map((key) => [key, val[key]])) : val)));
      expect(contentHashOf(alphabetized)).toBe(v.contentHash);
    }
  });
});

describe('the new evidence-ref kinds are hashed canonically', () => {
  const NOW = '2026-11-07T14:00:00.000Z';
  const UUID = '6f1c2b0e-8a7d-4c3b-9e21-0a5d4f3e2b1c';
  const versionWith = (evidenceRefs) => buildVersionDoc({
    version: 1, watchlistId: 'wl-1', userId: 'u-1', opId: 'op-1', opFingerprint: 'f'.repeat(64), createdAt: NOW,
    content: { statement: 'Networking is next', horizonEnum: 'swing', horizonSource: 'player', activation: [], invalidation: [], evidenceRefs, publishedAt: null, origin: 'shared_research' },
    status: 'draft', stateSource: 'player', stateReason: 'player_authored',
  });
  const item = { kind: 'evidenceItem', recordKind: 'symbolDayEvidence', recordId: '2026-11-06_AVGO', itemId: 'news-77' };
  const exch = { kind: 'exchange', hostCollection: 'sharedResearchSessions', hostId: 's-1', exchangeId: UUID };
  it('stored in the canonical key order, whatever order the server built them in', () => {
    const v = versionWith([{ itemId: 'news-77', recordId: '2026-11-06_AVGO', recordKind: 'symbolDayEvidence', kind: 'evidenceItem' }, { exchangeId: UUID, hostId: 's-1', hostCollection: 'sharedResearchSessions', kind: 'exchange' }]);
    expect(v.evidenceRefs.map(Object.keys)).toEqual([['kind', 'recordKind', 'recordId', 'itemId'], ['kind', 'hostCollection', 'hostId', 'exchangeId']]);
    expect(v.contentHash).toBe(versionWith([item, exch]).contentHash);
  });
  it('a new-kind ref is PART of the hashed content: adding, dropping or changing one moves the hash', () => {
    const base = versionWith([item, exch]).contentHash;
    expect(versionWith([item]).contentHash).not.toBe(base);
    expect(versionWith([exch, item]).contentHash).not.toBe(base); // order is meaning (the array is not sorted)
    expect(versionWith([{ ...item, itemId: null }, exch]).contentHash).not.toBe(base);
    expect(versionWith([item, { ...exch, hostId: 's-2' }]).contentHash).not.toBe(base);
  });
  it('the canonical form, pinned from this build (a later change to it is a schema change)', () => {
    expect(versionWith([item, exch]).contentHash).toBe('4e1a55c9f0bafc2d48bb55b66f1de4d4c5045105a02d1f9eb2fe3adae3fb2fff');
  });
});
