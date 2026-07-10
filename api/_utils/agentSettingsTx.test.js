// api/_utils/agentSettingsTx.test.js
//
// Release 2 (spec changelog #7) — the settingsRev increment invariant,
// tested AT ITS SINGLE HOME (/code-review Phase-5: every endpoint test
// asserted only `settingsRev toBeDefined()` against a fake storing the raw
// sentinel, so `increment(0)` — or a literal, or serverTimestamp() — kept
// the whole suite green while shipping the exact staleness failure this
// helper's header warns about).
//
// BUILD_RULES §4 dependency-surface guard: the REAL firebase-admin
// FieldValue is imported (sentinel equality via its own .isEqual) — never
// mock it here.

import { describe, it, expect } from 'vitest';
import { FieldValue } from 'firebase-admin/firestore';
import { txUpdateAgentSettings } from './agentSettingsTx.js';

describe('txUpdateAgentSettings — the ONE home of the settingsRev discipline', () => {
  const capture = () => {
    const calls = [];
    return { tx: { update: (ref, fields) => calls.push({ ref, fields }) }, calls };
  };

  it('merges settingsRev: FieldValue.increment(1) — the REAL +1 sentinel, not a lookalike', () => {
    const { tx, calls } = capture();
    const ref = { id: 'agent-1' };
    txUpdateAgentSettings(tx, ref, { equippedTraits: [], updatedAt: 't' });
    expect(calls).toHaveLength(1);
    expect(calls[0].ref).toBe(ref);
    const rev = calls[0].fields.settingsRev;
    // Sentinel equality through firebase-admin's own comparator: increment(1)
    // matches; increment(0), a literal, and serverTimestamp() all fail.
    expect(rev.isEqual(FieldValue.increment(1))).toBe(true);
    expect(rev.isEqual(FieldValue.increment(0))).toBe(false);
    expect(rev.isEqual(FieldValue.serverTimestamp())).toBe(false);
  });

  it('caller fields ride through untouched (incl. dotted paths) and can never shadow the increment', () => {
    const { tx, calls } = capture();
    txUpdateAgentSettings(tx, {}, { 'dials.tempo': 'measured', updatedAt: 'now', settingsRev: 999 });
    const fields = calls[0].fields;
    expect(fields['dials.tempo']).toBe('measured');
    expect(fields.updatedAt).toBe('now');
    // The increment is spread LAST — a caller-passed settingsRev loses.
    expect(fields.settingsRev.isEqual(FieldValue.increment(1))).toBe(true);
  });
});
