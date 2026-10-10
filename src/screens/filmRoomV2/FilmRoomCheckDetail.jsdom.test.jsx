// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomCheckDetail.jsdom.test.jsx
//
// Film Room A2 item 6 — CHECK DETAIL (Amendment E BA-44; V1.2 BA-7, BA-8;
// F3). Mounted from the A1 passes' own Sep-23-shaped tape: a tapped check
// shows its time, its state, its decision, its recorded risk decisions, its
// scores and its evidence stamp — every number marked by its own path's class.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import CheckDetail from './FilmRoomCheckDetail';
import { mounter, sep23Tape, clone, sweepNumbers, sweepWords, sweepSigns } from './__fixtures__/filmRoomHarness';

const m = mounter();
beforeEach(() => m.setup());
afterEach(() => m.teardown());

const swapIdx = sep23Tape.checks.findIndex((c) => c.decision?.final === 'SWAP');
const ruleIdx = sep23Tape.checks.findIndex((c) => c.risk?.MSFT?.action === 'SWAP_OUT');
const failIdx = sep23Tape.checks.findIndex((c) => c.decision?.holdKind === 'default_failure');

describe('BA-44 — a check\'s record', () => {
  it('its time, state and decision; its scores and every evidence stamp, each number by its own path', () => {
    m.render(<CheckDetail tape={sep23Tape} index={swapIdx} />);
    const text = m.container.textContent;
    expect(text).toContain('Check at 2:00 PM');
    expect(text).toContain('completed · SWAP');
    expect(text).toContain('SWAP');
    expect(m.q(`[data-num="checks[${swapIdx}].scores.total"]`)).toBeTruthy();
    expect(m.q(`[data-num="checks[${swapIdx}].scores.active"]`)).toBeTruthy();
    const syms = Object.keys(sep23Tape.checks[swapIdx].evidence);
    expect(syms.length).toBeGreaterThan(3);
    for (const s of syms) {
      expect(m.q(`[data-evidence="${swapIdx}:${s}"]`), s).toBeTruthy();
      for (const f of ['px', 'chg', 'atrX', 'vwapDev', 'bbPct']) expect(m.q(`[data-num="checks[${swapIdx}].evidence.${s}.${f}"]`), `${s}.${f}`).toBeTruthy();
    }
    expect(text).toContain("Recorded at the check · what the agent was given · the platform's quote");
    expect(sweepNumbers(m.container, { tape: sep23Tape })).toEqual([]);
    expect(sweepSigns(m.container)).toEqual([]);
    expect(sweepWords(m.container, { tape: sep23Tape })).toEqual([]);
  });

  it('BA-7: each symbol\'s recorded risk decision — "Risk decision recorded: HOLD", or the action with its reason', () => {
    m.render(<CheckDetail tape={sep23Tape} index={ruleIdx} />);
    const rows = m.qa(`[data-risk-rows="${ruleIdx}"] > span`).map((s) => s.textContent);
    expect(rows).toContain('MSFT · Risk decision recorded: SWAP_OUT · stagnation');
    expect(rows).toContain('AMD · Risk decision recorded: HOLD');
    expect(rows).toHaveLength(Object.keys(sep23Tape.checks[ruleIdx].risk).length);
  });

  it('a check with no risk record says "No risk decision recorded" — never HOLD, never blank', () => {
    const t = clone(sep23Tape);
    t.checks[3].risk = null;
    m.render(<CheckDetail tape={t} index={3} />);
    expect(m.q('[data-risk-rows="3"]').textContent).toBe('No risk decision recorded');
  });

  it('F3: a default hold is the platform\'s record of the check — no agent words, no invented failure', () => {
    m.render(<CheckDetail tape={sep23Tape} index={failIdx} />);
    const text = m.container.textContent;
    expect(text).toContain('no usable model result · the system held by default');
    expect(m.q('[data-default-hold-note]').textContent).toContain("the decision was not the model's");
    expect(text).not.toMatch(/Haiku call failed|model call failed|timed out/i);
    expect(text).toContain('No evidence stamp recorded for this check.');
  });

  it('the "protections" note is never repeated inside the detail — the hosting section carries it once', () => {
    m.render(<CheckDetail tape={sep23Tape} index={ruleIdx} />);
    expect(m.container.textContent).not.toContain('This does not show which protections were armed or checked.');
  });
});
