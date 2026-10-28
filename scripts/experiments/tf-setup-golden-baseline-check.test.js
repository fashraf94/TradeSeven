// scripts/experiments/tf-setup-golden-baseline-check.test.js
//
// Measured Trend Evidence, slice 1 (P3) — the cross-revision baseline check's
// rejection cases on CONTROLLED FIXTURES (founder's start instruction, 28 Oct
// 2026: "test the cross-revision rejection cases using controlled fixtures.
// Do not claim a historical comparison passed without an earlier baseline").
// Pure: compareRevisions never touches git or files.

import { describe, it, expect } from 'vitest';
import { canonicalJson, canonicalSha256, semanticsSeq, semanticsOrder, checkBaselineIntegrity, compareRevisions } from './tf-setup-golden-baseline-check.mjs';

const golden1 = { entry: { a: { verdict: 'valid', checks: [{ id: 'x', result: true }] } }, semanticsId: 'tf-setup-v1/sem-1' };
const golden2 = { entry: { a: { verdict: 'invalid', checks: [{ id: 'x', result: false }] } }, semanticsId: 'tf-setup-v1/sem-2' };
const sha1 = canonicalSha256(golden1);
const sha2 = canonicalSha256(golden2);
const e1 = { semanticsId: 'tf-setup-v1/sem-1', goldenSha256: sha1, recordedAt: '2026-10-28T12:00:00.000Z', note: 'initial: C1 pattern-scoped (FD-P3-1)' };
const e2 = { semanticsId: 'tf-setup-v1/sem-2', goldenSha256: sha2, recordedAt: '2026-11-01T12:00:00.000Z', note: 'a calculation change' };
const side = (baseline, goldenSha, semanticsId, thresholdsHash = '26f3f411b566', setupVersion = 'tf-setup-v1') => ({ baseline, goldenSha, semanticsId, thresholdsHash, setupVersion });
const base = side([e1], sha1, 'tf-setup-v1/sem-1');

describe('canonical bytes', () => {
  it('sorted keys, 2-space indent, LF, trailing newline; CRLF and key order never change the sha', () => {
    const text = canonicalJson({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: null } });
    expect(text).toBe('{\n  "a": {\n    "c": null,\n    "d": [\n      3,\n      {\n        "y": 2,\n        "z": 1\n      }\n    ]\n  },\n  "b": 1\n}\n');
    expect(canonicalSha256({ b: 1, a: 2 })).toBe(canonicalSha256({ a: 2, b: 1 }));
    expect(canonicalSha256(JSON.parse(text.replace(/\n/g, '\r\n')))).toBe(canonicalSha256(JSON.parse(text)));
    expect(canonicalSha256({ a: 1 })).not.toBe(canonicalSha256({ a: 2 }));
  });
  it('semanticsSeq reads the sem-<n> suffix; semanticsOrder reads (version, seq)', () => {
    expect(semanticsSeq('tf-setup-v1/sem-1')).toBe(1);
    expect(semanticsSeq('tf-setup-v2/sem-12')).toBe(12);
    expect(semanticsSeq('tf-setup-v1')).toBeNull();
    expect(semanticsSeq(null)).toBeNull();
    expect(semanticsOrder('tf-setup-v2/sem-1')).toEqual({ version: 2, seq: 1 });
    expect(semanticsOrder('v2/sem-1')).toBeNull();
  });
  it('the history is ordered by setupVersion then sem, so a new version may restart at sem-1 (review TE5-8)', () => {
    const v2 = { ...e2, semanticsId: 'tf-setup-v2/sem-1' };
    expect(checkBaselineIntegrity(side([e1, v2], sha2, 'tf-setup-v2/sem-1'))).toEqual([]);
    const back = { ...e2, semanticsId: 'tf-setup-v1/sem-2', recordedAt: '2026-12-01T00:00:00.000Z' };
    expect(checkBaselineIntegrity(side([e1, v2, { ...back, goldenSha256: sha1 }], sha1, 'tf-setup-v1/sem-2')).join(' ')).toMatch(/does not follow tf-setup-v2\/sem-1/);
  });
});

describe('in-revision integrity (checkBaselineIntegrity)', () => {
  it('passes a consistent one-entry history', () => {
    expect(checkBaselineIntegrity(base)).toEqual([]);
  });
  it('two entries recorded at the same instant are in order (recordedAt is non-decreasing, not strictly increasing; review TE3-12)', () => {
    expect(checkBaselineIntegrity(side([e1, { ...e2, recordedAt: e1.recordedAt }], sha2, 'tf-setup-v1/sem-2'))).toEqual([]);
  });
  it('fails when the last sha or id does not match the module', () => {
    expect(checkBaselineIntegrity(side([e1], sha2, 'tf-setup-v1/sem-1')).join(' ')).toMatch(/does not match the golden's canonical sha/);
    expect(checkBaselineIntegrity(side([e1], sha1, 'tf-setup-v1/sem-2')).join(' ')).toMatch(/is not the module's SEMANTICS_ID/);
  });
  it('fails on duplicate, out-of-order or malformed ids, a non-ISO recordedAt, a missing note, or an empty history', () => {
    expect(checkBaselineIntegrity(side([e1, { ...e2, semanticsId: 'tf-setup-v1/sem-1' }], sha2, 'tf-setup-v1/sem-1')).join(' ')).toMatch(/not unique/);
    expect(checkBaselineIntegrity(side([e2, e1], sha1, 'tf-setup-v1/sem-1')).join(' ')).toMatch(/does not follow/);
    expect(checkBaselineIntegrity(side([{ ...e1, semanticsId: 'sem1' }], sha1, 'sem1')).join(' ')).toMatch(/is not tf-setup-v<n>\/sem-<n>/);
    expect(checkBaselineIntegrity(side([{ ...e1, recordedAt: 'yesterday' }], sha1, 'tf-setup-v1/sem-1')).join(' ')).toMatch(/not an ISO instant/);
    expect(checkBaselineIntegrity(side([{ ...e1, note: '' }], sha1, 'tf-setup-v1/sem-1')).join(' ')).toMatch(/has no note/);
    expect(checkBaselineIntegrity(side([e1, { ...e2, recordedAt: '2026-10-01T00:00:00Z' }], sha2, 'tf-setup-v1/sem-2')).join(' ')).toMatch(/recordedAt precedes/);
    expect(checkBaselineIntegrity(side([], sha1, 'tf-setup-v1/sem-1')).join(' ')).toMatch(/not a non-empty array/);
  });
});

describe('cross-revision (compareRevisions)', () => {
  it('initial baseline creation: no base → mode initial, the head verified on its own, no historical claim', () => {
    const r = compareRevisions({ base: null, head: base });
    expect(r).toMatchObject({ mode: 'initial', ok: true, failures: [] });
    expect(r.notes.join(' ')).toMatch(/initial baseline creation/);
    expect(r.notes.join(' ')).toMatch(/no historical comparison is claimed/);
    const bad = compareRevisions({ base: null, head: side([e1], sha2, 'tf-setup-v1/sem-1') });
    expect(bad).toMatchObject({ mode: 'initial', ok: false });
  });
  it('unchanged: passes with a note', () => {
    const r = compareRevisions({ base, head: base });
    expect(r).toMatchObject({ mode: 'compare', ok: true, failures: [] });
    expect(r.notes.join(' ')).toMatch(/unchanged against the base/);
  });
  it('REJECTS a changed golden under an unchanged id (even with the baseline rewritten to match)', () => {
    const regenerated = side([{ ...e1, goldenSha256: sha2 }], sha2, 'tf-setup-v1/sem-1');
    const r = compareRevisions({ base, head: regenerated });
    expect(r.ok).toBe(false);
    expect(r.failures.join(' ')).toMatch(/golden bytes changed .* but SEMANTICS_ID is still tf-setup-v1\/sem-1/);
    expect(r.failures.join(' ')).toMatch(/entry 0 \(tf-setup-v1\/sem-1\) was rewritten/);
    expect(r.failures.join(' ')).toMatch(/no baseline entry was appended/);
  });
  it('REJECTS a changed golden under an unchanged id when the head\'s own integrity still holds only by a rewritten entry', () => {
    const r = compareRevisions({ base, head: side([{ ...e1, goldenSha256: sha2 }], sha2, 'tf-setup-v1/sem-1') });
    expect(checkBaselineIntegrity(side([{ ...e1, goldenSha256: sha2 }], sha2, 'tf-setup-v1/sem-1'))).toEqual([]); // in-revision alone would pass…
    expect(r.ok).toBe(false); // …the cross-revision check does not
  });
  it('ACCEPTS a changed golden under a new id with an appended entry', () => {
    const r = compareRevisions({ base, head: side([e1, e2], sha2, 'tf-setup-v1/sem-2') });
    expect(r).toMatchObject({ ok: true, failures: [] });
    expect(r.notes.join(' ')).toMatch(/new semantics id tf-setup-v1\/sem-2 with a new baseline entry/);
  });
  it('REJECTS a rewritten historical entry', () => {
    const r = compareRevisions({ base, head: side([{ ...e1, note: 'edited' }, e2], sha2, 'tf-setup-v1/sem-2') });
    expect(r.ok).toBe(false);
    expect(r.failures.join(' ')).toMatch(/entry 0 \(tf-setup-v1\/sem-1\) was rewritten/);
  });
  it('REJECTS a removed historical entry', () => {
    const twoEntryBase = side([e1, e2], sha2, 'tf-setup-v1/sem-2');
    const r = compareRevisions({ base: twoEntryBase, head: side([e2], sha2, 'tf-setup-v1/sem-2') });
    expect(r.ok).toBe(false);
    expect(r.failures.join(' ')).toMatch(/1 base entry was removed/);
  });
  it('REJECTS a sha mismatch at either ref', () => {
    const badBase = compareRevisions({ base: side([e1], sha2, 'tf-setup-v1/sem-1'), head: base });
    expect(badBase.failures.join(' ')).toMatch(/base: the last entry's goldenSha256 .* does not match/);
    const badHead = compareRevisions({ base, head: side([e1, e2], sha1, 'tf-setup-v1/sem-2') });
    expect(badHead.failures.join(' ')).toMatch(/head: the last entry's goldenSha256 .* does not match/);
  });
  it('REJECTS an id change without a new entry', () => {
    const r = compareRevisions({ base, head: side([e1], sha1, 'tf-setup-v1/sem-2') });
    expect(r.ok).toBe(false);
    expect(r.failures.join(' ')).toMatch(/SEMANTICS_ID changed \(tf-setup-v1\/sem-1 → tf-setup-v1\/sem-2\) without a new baseline entry/);
  });
  it('REJECTS an appended entry that does not carry the new id', () => {
    const r = compareRevisions({ base, head: side([e1, { ...e2, semanticsId: 'tf-setup-v1/sem-3' }], sha2, 'tf-setup-v1/sem-2') });
    expect(r.ok).toBe(false);
    expect(r.failures.join(' ')).toMatch(/the appended entry does not carry the new SEMANTICS_ID|is not the module's SEMANTICS_ID/);
  });
  it('REJECTS a thresholds-hash change without a new SETUP_VERSION, and accepts one with it', () => {
    const r = compareRevisions({ base, head: side([e1], sha1, 'tf-setup-v1/sem-1', 'deadbeef0000', 'tf-setup-v1') });
    expect(r.ok).toBe(false);
    expect(r.failures.join(' ')).toMatch(/THRESHOLDS_HASH changed \(26f3f411b566 → deadbeef0000\) without a new SETUP_VERSION/);
    const ok = compareRevisions({ base, head: side([e1], sha1, 'tf-setup-v1/sem-1', 'deadbeef0000', 'tf-setup-v2') });
    expect(ok.ok).toBe(true);
    expect(ok.notes.join(' ')).toMatch(/thresholds changed/);
  });
  it('a missing head throws', () => {
    expect(() => compareRevisions({ base, head: null })).toThrow(/head is required/);
  });
});
