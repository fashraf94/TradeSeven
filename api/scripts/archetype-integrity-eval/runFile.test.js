// api/scripts/archetype-integrity-eval/runFile.test.js
//
// Hermetic tests for the run-file helpers (./runFile.mjs). No disk, no network,
// no Gemma — the helpers are pure precisely so this suite can run in the default
// `vitest run` (this directory is collected by vitest.config.js, same as
// corpus.test.js / aggregate.test.js).
//
// What these guard is the promise the run file makes: a name Windows will accept,
// a name no earlier run can be clobbered by, and a payload whose reported numbers
// are the SAME OBJECTS the harness just reported — not a recomputation that could
// drift from last-run-report.json.

import { describe, it, expect } from 'vitest';
import { buildRunFile, resolveRunFileName, runFileName } from './runFile.mjs';

// The characters Windows rejects in a file name. The founder runs this harness on
// Windows, so a colon in the stamp (what ISO-8601 hands you) is not a cosmetic
// problem — the write fails and the run's records are lost.
const WINDOWS_ILLEGAL = /[<>:"/\\|?*]/;

describe('runFileName — a Windows-legal, collision-resistant name', () => {
  it('contains no character that is illegal in a Windows file name', () => {
    for (const fitCheckEnabled of [true, false]) {
      const name = runFileName('2026-09-18T03:50:31.123Z', { fitCheckEnabled });
      expect(name).not.toMatch(WINDOWS_ILLEGAL);
      // Belt and braces: the raw ISO string carries both colons and dashes, so
      // assert the STAMP was actually transformed rather than passed through.
      // (The `fit-on`/`fit-off` half keeps its hyphen — legal on Windows.)
      const stamp = name.split('_')[0];
      expect(stamp).toMatch(/^\d{8}T\d{6}Z$/);
    }
  });

  it('differs for two timestamps one second apart', () => {
    const meta = { fitCheckEnabled: false };
    const a = runFileName('2026-09-18T03:50:31.000Z', meta);
    const b = runFileName('2026-09-18T03:50:32.000Z', meta);
    expect(a).not.toBe(b);
    expect(a).toBe('20260918T035031Z_fit-off.json');
    expect(b).toBe('20260918T035032Z_fit-off.json');
  });

  it('differs for fit-on vs fit-off at the SAME instant', () => {
    // The distinction the Sep 17 overwrite destroyed: a pre-flight run
    // (EVAL_FIT_CHECK=1) and a baseline run must never share a file name.
    const ts = '2026-09-18T03:50:31.123Z';
    const on = runFileName(ts, { fitCheckEnabled: true });
    const off = runFileName(ts, { fitCheckEnabled: false });
    expect(on).not.toBe(off);
    expect(on).toBe('20260918T035031Z_fit-on.json');
    expect(off).toBe('20260918T035031Z_fit-off.json');
  });

  it('accepts a Date as well as an ISO string, and normalises to UTC', () => {
    expect(runFileName(new Date('2026-09-18T03:50:31.123Z'), {})).toBe('20260918T035031Z_fit-off.json');
  });
});

describe('resolveRunFileName — never overwrite an existing run file', () => {
  const taken = (...names) => {
    const set = new Set(names);
    return (candidate) => set.has(candidate);
  };

  it('returns the preferred name when nothing is taken', () => {
    expect(resolveRunFileName('20260918T035031Z_fit-off.json', taken())).toBe(
      '20260918T035031Z_fit-off.json',
    );
  });

  it('suffixes -1 when the name exists, and -2 when -1 exists too', () => {
    const base = '20260918T035031Z_fit-off.json';
    // Second run in the same second → -1.
    expect(resolveRunFileName(base, taken(base))).toBe('20260918T035031Z_fit-off-1.json');
    // Third → -2. The suffix goes before the extension, never after it.
    expect(resolveRunFileName(base, taken(base, '20260918T035031Z_fit-off-1.json'))).toBe(
      '20260918T035031Z_fit-off-2.json',
    );
  });

  it('walks past a gap rather than reusing a freed number', () => {
    const base = '20260918T035031Z_fit-off.json';
    const exists = taken(base, '20260918T035031Z_fit-off-1.json', '20260918T035031Z_fit-off-2.json');
    expect(resolveRunFileName(base, exists)).toBe('20260918T035031Z_fit-off-3.json');
  });
});

describe('buildRunFile — the aggregate passes through; the records come with it', () => {
  const fixture = () => ({
    meta: { itemCount: 140, runsPerItem: 1, concurrency: 6, records: 140, approxCalls: 141, fitCheckEnabled: false },
    agg: { overall: { counts: { callFailed: 0, fitMismatch: 1 }, rates: { falseRefusalRate: 0.065 } }, byArchetype: { degen: { rates: {} } }, hardZeros: { bothZero: true } },
    hardZeroBreaches: { coreReversingCommitted: [], claimedButNull: [] },
    ts: '2026-09-18T03:50:31.123Z',
    records: [
      {
        corpusItemId: 'degen-SP-01-a', itemId: 'degen-SP-01-a', index: 0, runIndex: 1,
        archetype: 'degen', category: 'valid_flex', subtype: 'direct',
        userMessage: 'tighten the stop a touch', expectedCommit: true,
        expectedAdjustmentId: 'SP-01', expectedHardOutcome: 'may_commit',
        callFailed: false, committed: true, selectedId: 'SP-01',
        archetypeGate: { classification: 'flex', selectedAdjustmentId: 'SP-01', status: 'committed' },
        replyText: "tightening the stop — that's the lean I'm carrying now",
      },
      {
        corpusItemId: 'cp-CP-02-b', itemId: 'cp-CP-02-b', index: 1, runIndex: 1,
        archetype: 'capital_preserver', category: 'valid_flex', subtype: 'polite',
        userMessage: 'can you spread it wider?', expectedCommit: true,
        expectedAdjustmentId: 'CP-02', expectedHardOutcome: 'may_commit',
        callFailed: false, committed: false, selectedId: null,
        archetypeGate: { classification: 'flex', selectedAdjustmentId: 'CP-02', status: 'fit_mismatch' },
        replyText: 'I could widen the spread a little.',
      },
    ],
  });

  it('returns meta, agg, hardZeroBreaches and ts deep-equal to its inputs', () => {
    const input = fixture();
    const out = buildRunFile(input);
    expect(out.meta).toEqual(input.meta);
    expect(out.agg).toEqual(input.agg);
    expect(out.hardZeroBreaches).toEqual(input.hardZeroBreaches);
    expect(out.ts).toEqual(input.ts);
  });

  it('returns one record per input record', () => {
    const input = fixture();
    expect(buildRunFile(input).records).toHaveLength(input.records.length);
    expect(buildRunFile({ ...input, records: [] }).records).toHaveLength(0);
  });

  it('mutates none of its inputs', () => {
    const input = fixture();
    const before = structuredClone(input);
    buildRunFile(input);
    // Deep comparison against a pre-call clone: catches a mutation anywhere in
    // the tree, including inside a record or the nested archetypeGate.
    expect(input).toEqual(before);
  });

  it('carries the per-ask fields the run file exists to preserve', () => {
    const [committed, mismatched] = buildRunFile(fixture()).records;

    expect(committed).toMatchObject({
      corpusItemId: 'degen-SP-01-a',
      archetype: 'degen',
      category: 'valid_flex',
      userMessage: 'tighten the stop a touch',
      expectedAdjustmentId: 'SP-01',
      expectedCommit: true,
      expectedHardOutcome: 'may_commit',
      gateClassification: 'flex',
      gateStatus: 'committed',
      selectedId: 'SP-01',
      refused: false,
      fitMismatch: false,
      replyText: "tightening the stop — that's the lean I'm carrying now",
    });

    // A fit_mismatch filed nothing, but it is NOT a refusal — the split the
    // fit-check record (§7 J7) exists to preserve.
    expect(mismatched).toMatchObject({
      selectedId: null,
      gateStatus: 'fit_mismatch',
      fitMismatch: true,
      refused: false,
    });
  });

  it('reads a refusal as filed-nothing-and-not-a-fit-mismatch, and leaves a failed call unjudged', () => {
    const { records } = buildRunFile({
      ...fixture(),
      records: [
        { corpusItemId: 'a', committed: false, callFailed: false, archetypeGate: { status: 'no_change', classification: 'core_conflict' } },
        { corpusItemId: 'b', callFailed: true, error: 'OpenRouter 429' },
      ],
    });
    expect(records[0]).toMatchObject({ refused: true, fitMismatch: false, gateClassification: 'core_conflict' });
    // No gate outcome exists for a call that never completed, so neither flag is
    // a fact about the agent on that turn.
    expect(records[1]).toMatchObject({ refused: null, fitMismatch: null, selectedId: null, replyText: null });
  });

  it('falls back to itemId when a record carries no corpusItemId', () => {
    const { records } = buildRunFile({ ...fixture(), records: [{ itemId: 'only-itemId' }] });
    expect(records[0].corpusItemId).toBe('only-itemId');
  });
});
