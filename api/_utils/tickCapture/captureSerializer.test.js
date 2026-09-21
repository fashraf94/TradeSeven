// api/_utils/tickCapture/captureSerializer.test.js
//
// C-3, the privacy boundary — UNIT rows. The end-to-end sentinel rows live in
// api/cron/agent-evaluate.tickCapture.flagOn.test.js; these prove the
// mechanism itself, so a failure names the rule rather than the tick.
//
// Every row is MUTATION-CHECKED: the comment on each says what defect it
// fails under, and the "anti-vacuous" rows assert the positive control so a
// rule that admitted nothing at all could not pass the suite.

import { describe, it, expect } from 'vitest';
import {
  PERMANENT_FIELD_KINDS, ENUM_LISTS, admitEnum, admitId, admitNumber, admitSymbol,
  buildUniverse, findFreeText, sanitizePermanentDocument,
} from './captureSerializer.js';
import { CHECK_STATUSES, EXIT_REASONS, STAGES } from './captureConfig.js';

const UNIVERSE = buildUniverse({ heldSymbols: ['NVDA', 'KO'], benchSymbols: ['AMD'], candidateSymbols: ['JPM'] });

describe('the universe is the tick\'s own held ∪ bench ∪ rendered-candidate sets', () => {
  it('admits a symbol the tick held, benched or rendered', () => {
    for (const sym of ['NVDA', 'KO', 'AMD', 'JPM']) expect(admitSymbol(sym, UNIVERSE)).toBe(sym);
  });

  it('REFUSES a well-formed ticker the tick never held, benched or rendered', () => {
    // Fails if admitSymbol drops the universe test and keeps only the regex:
    // a symbol the tick never saw could be model free text wearing a ticker's
    // shape, and the permanent record is exactly where that must not land.
    expect(admitSymbol('TSLA', UNIVERSE)).toBeNull();
    expect(admitSymbol('AAPL', UNIVERSE)).toBeNull();
  });

  it('REFUSES a non-ticker string even when it is in the set', () => {
    const loose = buildUniverse({ heldSymbols: ['sell everything now'] });
    expect(admitSymbol('sell everything now', loose)).toBeNull();
  });

  it('an empty universe admits nothing', () => {
    expect(admitSymbol('NVDA', new Set())).toBeNull();
  });
});

describe('enums, ids and numbers', () => {
  it('admits a member and refuses a non-member', () => {
    expect(admitEnum('completed', EXIT_REASONS)).toBe('completed');
    expect(admitEnum('finished', EXIT_REASONS)).toBeNull();
    expect(admitEnum('evaluated', CHECK_STATUSES)).toBe('evaluated');
    expect(admitEnum('passed', CHECK_STATUSES)).toBeNull(); // C-6: "passed" is a RESULT, never a status
  });

  it('an id is bounded and whitespace-free — a sentence is not an id', () => {
    expect(admitId('battle-tick-1:7')).toBe('battle-tick-1:7');
    expect(admitId('invalid_tool_result')).toBe('invalid_tool_result');
    expect(admitId('Rotating KO into AMD because the semis lead')).toBeNull();
    expect(admitId('x'.repeat(121))).toBeNull();
  });

  it('a number must be finite', () => {
    expect(admitNumber(0)).toBe(0);
    expect(admitNumber(-1.25)).toBe(-1.25);
    expect(admitNumber(NaN)).toBeNull();
    expect(admitNumber(Infinity)).toBeNull();
    expect(admitNumber('7')).toBeNull();
  });

  it('every enum kind named in the field table resolves to a real list', () => {
    // Fails if a path declares `enum:TYPO` — leafOk would then reject every
    // value at that path silently, and the field would quietly always be null.
    for (const [path, kind] of Object.entries(PERMANENT_FIELD_KINDS)) {
      if (typeof kind === 'string' && kind.startsWith('enum:')) {
        expect(Array.isArray(ENUM_LISTS[kind.slice(5)]), `${path} names ${kind}`).toBe(true);
      }
    }
  });
});

describe('sanitizePermanentDocument — default deny, and the body catches what it refuses', () => {
  const base = () => ({
    schemaVersion: 1,
    tickId: 'battle-1:3',
    battleId: 'battle-1',
    tickSeq: 3,
    capturedAt: '2026-09-09T15:00:00.000Z',
    stageReached: 'finalized',
    exitReason: 'completed',
    decision: { final: 'SWAP', finalSymbolOut: 'KO', finalSymbolIn: 'AMD' },
  });

  it('anti-vacuous: a well-formed document passes through UNCHANGED with nothing rejected', () => {
    const { doc, rejected } = sanitizePermanentDocument(base(), { universe: UNIVERSE });
    expect(rejected).toEqual([]);
    expect(doc).toEqual(base());
    expect(findFreeText(doc, { universe: UNIVERSE })).toEqual([]);
  });

  it('a NON-UNIVERSE symbol is nulled on the record and lands in the reject list', () => {
    const input = base();
    input.decision.finalSymbolIn = 'TSLA'; // held by nobody this tick
    const { doc, rejected } = sanitizePermanentDocument(input, { universe: UNIVERSE });
    expect(doc.decision.finalSymbolIn).toBeNull();
    expect(rejected).toEqual([{ path: 'decision.finalSymbolIn', value: 'TSLA', reason: 'not_symbol' }]);
  });

  it('FREE TEXT at a declared field is nulled and rejected, never written', () => {
    const input = base();
    input.decision.final = 'I think we should rotate out of KO today';
    const { doc, rejected } = sanitizePermanentDocument(input, { universe: UNIVERSE });
    expect(doc.decision.final).toBeNull();
    expect(rejected[0].path).toBe('decision.final');
    expect(rejected[0].value).toBe('I think we should rotate out of KO today');
  });

  it('an UNDECLARED path is rejected — the default is deny, so a forgotten field cannot leak', () => {
    // Fails if kindFor() returns a permissive default for an unknown path.
    const input = { ...base(), rationale: 'KO has gone dead money while the semis keep leading' };
    const { doc, rejected } = sanitizePermanentDocument(input, { universe: UNIVERSE });
    expect(doc.rationale).toBeNull();
    expect(rejected.map((r) => r.reason)).toContain('undeclared_path');
  });

  it('a MAP KEY that is not a bounded identifier is dropped whole — a key is structure, never data', () => {
    const input = base();
    input.manifest = { vintages: { 'KO — the support slot I am rotating out of': 12 } };
    const { doc, rejected } = sanitizePermanentDocument(input, { universe: UNIVERSE });
    expect(doc.manifest.vintages).toEqual({});
    expect(rejected.some((r) => r.reason === 'key_not_id')).toBe(true);
  });

  it('`undefined` never reaches a write — Firestore rejects it (the harness asserts this too)', () => {
    const input = { ...base(), evalId: undefined };
    const { doc, rejected } = sanitizePermanentDocument(input, { universe: UNIVERSE });
    expect(doc.evalId).toBeNull();
    expect(rejected.some((r) => r.reason === 'undefined')).toBe(true);
  });

  it('wildcards resolve for arrays and for map values at any depth', () => {
    const input = {
      ...base(),
      actions: [{ actionId: 'battle-1:3:1', n: 1, kind: 'swap', source: 'haiku', symbolOut: 'KO', symbolIn: 'AMD', committed: true }],
      checks: { lock: { status: 'evaluated', result: 'passed', stage: 'decision_resolved', symbolOut: 'KO' } },
      controls: { standingLeanIds: ['TF-02'], standingLeanTextHashes: ['a'.repeat(64)] },
    };
    const { rejected } = sanitizePermanentDocument(input, { universe: UNIVERSE });
    expect(rejected).toEqual([]);
  });

  it('a hash field takes ONLY a sha256 hex digest — it is not a second text channel', () => {
    const input = { ...base(), controls: { directiveTextHash: 'Require stronger confirmation before entering' } };
    const { doc, rejected } = sanitizePermanentDocument(input, { universe: UNIVERSE });
    expect(doc.controls.directiveTextHash).toBeNull();
    expect(rejected[0].reason).toBe('not_hash');
    // anti-vacuous: a real digest passes
    const ok = sanitizePermanentDocument({ ...base(), controls: { directiveTextHash: 'f'.repeat(64) } }, { universe: UNIVERSE });
    expect(ok.rejected).toEqual([]);
  });

  it('a timestamp field takes only an ISO instant', () => {
    const bad = sanitizePermanentDocument({ ...base(), capturedAt: 'just now' }, { universe: UNIVERSE });
    expect(bad.doc.capturedAt).toBeNull();
    expect(bad.rejected[0].reason).toBe('not_timestamp');
  });
});

describe('findFreeText — the independent re-check the writer also runs', () => {
  it('reports nothing on a sanitized document and reports the path on an unsanitized one', () => {
    const dirty = { exitReason: 'completed', decision: { final: 'rotate the support slot' } };
    expect(findFreeText(dirty, { universe: UNIVERSE })).toEqual(['decision.final']);
    const { doc } = sanitizePermanentDocument(dirty, { universe: UNIVERSE });
    expect(findFreeText(doc, { universe: UNIVERSE })).toEqual([]);
  });

  it('every STAGE and EXIT_REASON the config declares is admissible at its own field', () => {
    for (const stage of STAGES) {
      expect(findFreeText({ stageReached: stage }, { universe: UNIVERSE })).toEqual([]);
    }
    for (const reason of EXIT_REASONS) {
      expect(findFreeText({ exitReason: reason }, { universe: UNIVERSE })).toEqual([]);
    }
  });
});
