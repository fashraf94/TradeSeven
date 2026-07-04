// scripts/calibration/export-agent-battles.test.js
// Knob Calibration — export helper units (no Firestore; the DB code is guarded
// behind the CLI entrypoint, so importing this module touches no firebase-admin).
import { describe, it, expect } from 'vitest';
import { serialize, parseArgs, applyDateWindow } from './export-agent-battles.js';

describe('serialize', () => {
  it('converts Firestore Timestamps (anything with toDate) to ISO, recursively', () => {
    const ts = { toDate: () => new Date('2026-04-01T13:30:00.000Z') };
    const doc = {
      createdAt: ts,
      agentContext: { archetype: 'degen' },
      trades: [{ exitReason: 'stagnation', swappedOutAt: '2026-04-01T14:00:00.000Z', at: ts }],
      scoreState: { tradeCount: 7 },
    };
    const out = serialize(doc);
    expect(out.createdAt).toBe('2026-04-01T13:30:00.000Z');
    expect(out.trades[0].at).toBe('2026-04-01T13:30:00.000Z');
    expect(out.trades[0].exitReason).toBe('stagnation'); // plain values untouched
    expect(out.agentContext.archetype).toBe('degen');
    expect(out.scoreState.tradeCount).toBe(7);
  });
  it('passes null/primitives through', () => {
    expect(serialize(null)).toBeNull();
    expect(serialize(5)).toBe(5);
    expect(serialize('x')).toBe('x');
  });
});

describe('parseArgs', () => {
  it('defaults to completed status and honors flags', () => {
    expect(parseArgs(['node', 's']).status).toBe('completed');
    const f = parseArgs(['node', 's', '--status', 'all', '--from', '2026-03-01', '--to', '2026-06-01', '--out', 'b.json', '--limit', '50']);
    expect(f).toMatchObject({ status: 'all', from: '2026-03-01', to: '2026-06-01', out: 'b.json', limit: 50 });
  });
});

describe('applyDateWindow (client-side, ISO createdAt)', () => {
  const battles = [
    { id: 'a', createdAt: '2026-02-01T00:00:00.000Z' },
    { id: 'b', createdAt: '2026-04-15T00:00:00.000Z' },
    { id: 'c', createdAt: '2026-07-01T00:00:00.000Z' },
    { id: 'd' }, // no createdAt → excluded when a window is set
  ];
  it('filters inclusively by from/to', () => {
    const w = applyDateWindow(battles, { from: '2026-03-01', to: '2026-06-01' });
    expect(w.map((b) => b.id)).toEqual(['b']);
  });
  it('is a no-op with no window', () => {
    expect(applyDateWindow(battles, {})).toHaveLength(4);
  });
});
