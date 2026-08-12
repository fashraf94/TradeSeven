// api/_utils/mandateDecisionTool.test.js
// Spec 1 §3.4 — decision tool schema + input normalization.

import { describe, it, expect } from 'vitest';
import {
  effectiveVerbs,
  EXIT_MODE_VERBS,
  buildMandateDecisionTool,
  normalizeDecisionInput,
  MANDATE_DECISION_TOOL_NAME,
} from './mandateDecisionTool.js';

describe('buildMandateDecisionTool', () => {
  it('names the tool and freezes the verb enum from the vintage verb set', () => {
    const tool = buildMandateDecisionTool(['BUY', 'SELL', 'HOLD']);
    expect(tool.name).toBe(MANDATE_DECISION_TOOL_NAME);
    expect(tool.input_schema.properties.verb.enum).toEqual(['BUY', 'SELL', 'HOLD']);
    expect(tool.input_schema.required).toContain('verb');
  });
});

describe('normalizeDecisionInput', () => {
  it('accepts a well-formed BUY', () => {
    const r = normalizeDecisionInput({ verb: 'buy', ticker: 'aapl', sizeUsd: 5000, conviction: 80, rationale: 'x' });
    expect(r.ok).toBe(true);
    expect(r.decision).toMatchObject({ verb: 'BUY', ticker: 'AAPL', sizeUsd: 5000, conviction: 80 });
  });

  it('HOLD needs no ticker or size', () => {
    const r = normalizeDecisionInput({ verb: 'HOLD', rationale: 'nothing to do' });
    expect(r.ok).toBe(true);
    expect(r.decision.ticker).toBe(null);
    expect(r.decision.sizeUsd).toBe(null);
  });

  it('SELL requires a ticker but not a size (full exit)', () => {
    expect(normalizeDecisionInput({ verb: 'SELL', ticker: 'AAPL', rationale: 'x' }).ok).toBe(true);
    expect(normalizeDecisionInput({ verb: 'SELL', rationale: 'x' })).toEqual({ ok: false, reason: 'missing_ticker' });
  });

  it('rejects bad verbs, missing tickers, and non-positive sizes', () => {
    expect(normalizeDecisionInput({ verb: 'YOLO', rationale: 'x' })).toEqual({ ok: false, reason: 'bad_verb' });
    expect(normalizeDecisionInput({ verb: 'BUY', ticker: 'AAPL', sizeUsd: 0, rationale: 'x' })).toEqual({ ok: false, reason: 'bad_size' });
    expect(normalizeDecisionInput({ verb: 'BUY', ticker: 'AAPL', sizeUsd: -10, rationale: 'x' })).toEqual({ ok: false, reason: 'bad_size' });
  });
});

describe('effectiveVerbs — exit-only tool restriction (§6.4/I2)', () => {
  it('full mode passes the vintage verbs through', () => {
    expect(effectiveVerbs(['BUY', 'SELL', 'TRIM', 'ADD', 'HOLD'], { quarantined: false }))
      .toEqual(['BUY', 'SELL', 'TRIM', 'ADD', 'HOLD']);
  });
  it('quarantined mode intersects with SELL/TRIM/HOLD — the model cannot even emit an entry', () => {
    expect(effectiveVerbs(['BUY', 'SELL', 'TRIM', 'ADD', 'HOLD'], { quarantined: true }))
      .toEqual(['SELL', 'TRIM', 'HOLD']);
    expect(EXIT_MODE_VERBS).toEqual(['SELL', 'TRIM', 'HOLD']);
  });
  it('a degenerate vintage verb set still yields HOLD (never an empty tool)', () => {
    expect(effectiveVerbs(['BUY', 'ADD'], { quarantined: true })).toEqual(['HOLD']);
  });
});
