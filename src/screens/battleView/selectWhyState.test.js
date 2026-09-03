// src/screens/battleView/selectWhyState.test.js
//
// Phase A (A2) — the Why? state of a piece at the last check. The order of the
// branches IS the rule (hazard 2): `downgraded` beats `decision`. The mutation
// row below is the one that fails if the downgraded branch is removed — and
// ONLY that row: the HOLD and SWAP rows carry `downgraded: false` and keep
// passing, so a green run with the branch deleted is impossible and a red
// run points at exactly the missing branch.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';
import {
  selectWhyState,
  emphasizeSymbol,
  selectTradesForSymbol,
  guardrailForcedExit,
  splitSentences,
  extractSentences,
  namesSymbol,
  symbolPattern,
  deriveTierPrices,
  renderMotive,
  isEngineAuthoredMotive,
  ENGINE_MOTIVE_PREFIXES,
  SWAP_FAILED_PREFIX,
  GUARDRAIL_SOURCE_PREFIX,
  GUARDRAIL_FORCED_EXIT,
  WHY_KIND,
} from './selectWhyState';

const LAST = '2026-09-01T16:47:00.000Z'; // 12:47 PM ET
const TS = '2026-09-01T16:47:02.000Z';   // the same tick, two seconds later (>=)

const RATIONALE_SWAP = 'SLB has lost its bid and DVN is showing the stronger tape; swapping SLB for DVN to keep the energy exposure with the leader.';
const RATIONALE_HOLD = 'Held SLB through the 12:45 bar — bust-tier distance widened on the reversal, no confirmation on the second bullish trigger, so the position stays as sized.';

describe('the branches, in order', () => {
  it('MUTATION ROW — downgraded === true wins over the decision: `Argued for a swap · held by a guardrail`', () => {
    // A swap the model argued for, downgraded to HOLD by a guardrail. The
    // rationale still argues the swap. Rendered under "Held" it would put the
    // agent's words beside the wrong verb.
    const evaluation = { evalId: 'eval_005', timestamp: TS, decision: 'HOLD', downgraded: true, rationale: RATIONALE_SWAP, symbolOut: null, symbolIn: null };
    const s = selectWhyState(evaluation, 'SLB', LAST);
    expect(s.kind).toBe(WHY_KIND.DOWNGRADED);
    expect(s.label).toBe('Argued for a swap · held by a guardrail');
    expect(s.label).toBe(COPY.downgradedLabel);
    expect(s.rationale).toBe(RATIONALE_SWAP);
    expect(s.footer).toBe('The agent\'s own words · the system held it');
    expect(s.label).not.toBe('Held');
  });

  it('downgraded beats SWAP too — a downgraded entry is never rendered as a swap', () => {
    const evaluation = { timestamp: TS, decision: 'SWAP', downgraded: true, rationale: RATIONALE_SWAP, symbolOut: 'SLB', symbolIn: 'DVN' };
    expect(selectWhyState(evaluation, 'SLB', LAST).kind).toBe(WHY_KIND.DOWNGRADED);
  });

  it('MUTATION ROW (D-66) — a downgrade whose validationErrors[0] starts `Swap execution failed` is the FOURTH state: `Argued for a swap · it did not go through`', () => {
    // executeSwapServer threw (agent-evaluate.js: `validationErrors.push(`Swap
    // execution failed: ${swapErr.message}`)`, then `downgraded = true`). No
    // guardrail held anything; the guardrail label would over-claim.
    const evaluation = {
      evalId: 'eval_021', timestamp: TS, decision: 'HOLD', downgraded: true, rationale: RATIONALE_SWAP,
      validationErrors: ['Swap execution failed: EODHD price unavailable for DVN'],
    };
    const s = selectWhyState(evaluation, 'SLB', LAST);
    expect(s.kind).toBe(WHY_KIND.FAILED);
    expect(s.label).toBe('Argued for a swap · it did not go through');
    expect(s.label).toBe(COPY.failedLabel);
    expect(s.footer).toBe('The agent\'s own words · the position stayed as it was');
    expect(s.footer).toBe(COPY.failedFooter);
    expect(s.rationale).toBe(RATIONALE_SWAP);
    expect(s.label).not.toBe(COPY.downgradedLabel);
  });

  it('the prefix is read on validationErrors[0] only — a guardrail downgrade keeps the guardrail label whatever else the array carries', () => {
    const guardrail = { timestamp: TS, decision: 'HOLD', downgraded: true, rationale: RATIONALE_SWAP, validationErrors: ['ANTI-THRASH: SLB was swapped in 41 minutes ago'] };
    expect(selectWhyState(guardrail, 'SLB', LAST).kind).toBe(WHY_KIND.DOWNGRADED);
    const later = { ...guardrail, validationErrors: ['ANTI-THRASH: SLB was swapped in 41 minutes ago', 'Swap execution failed: x'] };
    expect(selectWhyState(later, 'SLB', LAST).kind).toBe(WHY_KIND.DOWNGRADED);
    const none = { ...guardrail, validationErrors: [] };
    expect(selectWhyState(none, 'SLB', LAST).kind).toBe(WHY_KIND.DOWNGRADED);
    const absent = { ...guardrail, validationErrors: undefined };
    expect(selectWhyState(absent, 'SLB', LAST).kind).toBe(WHY_KIND.DOWNGRADED);
  });

  it('TRIPWIRE — the prefix is the one the cron writes (agent-evaluate.js), read from its source: a reworded server string reds this row, never silently reverts the state', () => {
    // Reading api/ is permitted (BUILD_RULES §1 fences edits, not reads); the
    // A4 review (L5-N3) asked for a src-side pin on the server wording.
    const cron = readFileSync(new URL('../../../api/cron/agent-evaluate.js', import.meta.url), 'utf8');
    expect(cron).toContain('validationErrors.push(`' + SWAP_FAILED_PREFIX + ': ${swapErr.message}`)');
    expect(SWAP_FAILED_PREFIX).toBe('Swap execution failed');
  });

  it('the failure prefix without `downgraded` is not the fourth state — the flag is still the gate', () => {
    const odd = { timestamp: TS, decision: 'HOLD', downgraded: false, rationale: RATIONALE_HOLD, validationErrors: ['Swap execution failed: x'] };
    expect(selectWhyState(odd, 'SLB', LAST).kind).toBe(WHY_KIND.HELD);
  });

  it('MUTATION ROW (D-70) — three persisted conjuncts make the FIFTH state: `A guardrail called for a swap · it did not go through`', () => {
    // applyGuardrails returned SWAP with a forced_exit override; the cron
    // OVERWROTE the rationale with its own text (agent-evaluate.js ~2114-2125)
    // and the replacement was then rejected. The agent argued nothing here.
    const evaluation = {
      evalId: 'eval_031', timestamp: TS, decision: 'HOLD', downgraded: true,
      rationale: 'Guardrail override (guardrail_stopLoss): SLB breached the -8% stop; forcing exit to DVN.',
      symbolOut: null, symbolIn: null,
      guardrailSourceNote: 'guardrail_stopLoss',
      guardrailOverrides: [{ type: 'stopLoss', symbol: 'SLB', metric: 'pnlPct', threshold: 8, actual: -8.4, action: 'forced_exit', replacementSymbol: 'DVN' }],
      validationErrors: ['Replacement DVN is distressed'],
    };
    const s = selectWhyState(evaluation, 'SLB', LAST);
    expect(s.kind).toBe(WHY_KIND.GUARDRAIL_FAILED);
    expect(s.label).toBe('A guardrail called for a swap · it did not go through');
    expect(s.label).toBe(COPY.guardrailForcedFailedLabel);
    expect(s.footer).toBe('The guardrail\'s reason · the position stayed as it was');
    expect(s.footer).toBe(COPY.guardrailForcedFailedFooter);
    // Never the agent's words: the fourth state's footer would credit the agent
    // with an argument the cron overwrote (A4 handover item 21).
    expect(s.footer).not.toBe(COPY.failedFooter);
    expect(s.label).not.toBe(COPY.failedLabel);
    expect(s.label).not.toBe(COPY.downgradedLabel);
    // The pair comes from the OVERRIDE: the entry's own symbolOut/symbolIn are
    // null on a downgraded HOLD (agent-evaluate.js ~2634-2635).
    expect(s.symbolOut).toBe('SLB');
    expect(s.symbolIn).toBe('DVN');
    // Verbatim EXCEPT the provenance parenthetical, which D-80 translates —
    // the sentence the guardrail wrote, in words a player can read.
    expect(s.rationale).toBe('Guardrail override (stop-loss): SLB breached the -8% stop; forcing exit to DVN.');
    expect(s.rationale).toBe(renderMotive(evaluation.rationale));
    expect(s.rationale).not.toContain('guardrail_');
  });

  it('D-70 — the fifth state also wins when the forced swap THREW (both gates match; the guardrail is the subject)', () => {
    const evaluation = {
      timestamp: TS, decision: 'HOLD', downgraded: true,
      rationale: 'Guardrail override (guardrail_trailingStop): forcing exit.',
      guardrailSourceNote: 'guardrail_trailingStop',
      guardrailOverrides: [{ symbol: 'SLB', action: 'forced_exit', replacementSymbol: 'DVN' }],
      validationErrors: ['Swap execution failed: EODHD price unavailable for DVN'],
    };
    expect(selectWhyState(evaluation, 'SLB', LAST).kind).toBe(WHY_KIND.GUARDRAIL_FAILED);
  });

  it('D-70 — each conjunct is load-bearing: drop any one and the state falls back to the fourth or the second', () => {
    const full = {
      timestamp: TS, decision: 'HOLD', downgraded: true, rationale: RATIONALE_SWAP,
      guardrailSourceNote: 'guardrail_stopLoss',
      guardrailOverrides: [{ symbol: 'SLB', action: 'forced_exit', replacementSymbol: 'DVN' }],
      validationErrors: ['Swap execution failed: x'],
    };
    expect(selectWhyState(full, 'SLB', LAST).kind).toBe(WHY_KIND.GUARDRAIL_FAILED);
    // (1) not downgraded → the entry is a real decision, not a downgrade at all.
    expect(selectWhyState({ ...full, downgraded: false, decision: 'HOLD' }, 'SLB', LAST).kind).toBe(WHY_KIND.HELD);
    // (2) no guardrail_ sourceNote → the fourth state (the agent's own words).
    expect(selectWhyState({ ...full, guardrailSourceNote: null }, 'SLB', LAST).kind).toBe(WHY_KIND.FAILED);
    expect(selectWhyState({ ...full, guardrailSourceNote: 'risk_manager' }, 'SLB', LAST).kind).toBe(WHY_KIND.FAILED);
    // (3) no forced_exit override → the fourth state.
    expect(selectWhyState({ ...full, guardrailOverrides: [] }, 'SLB', LAST).kind).toBe(WHY_KIND.FAILED);
    expect(selectWhyState({ ...full, guardrailOverrides: undefined }, 'SLB', LAST).kind).toBe(WHY_KIND.FAILED);
  });

  it('MUTATION ROW (D-70, the third conjunct) — a `reinforced_haiku` swap that failed keeps the FOURTH state: those ARE the agent\'s words', () => {
    // agentGuardrails.js ~468-497: the reinforced branch stamps the SAME
    // `guardrail_${forcedType}` sourceNote while the rationale stays the
    // agent's argument. Gating on the sourceNote alone would silently retitle
    // the agent's own swap as the guardrail's.
    const reinforced = {
      timestamp: TS, decision: 'HOLD', downgraded: true, rationale: RATIONALE_SWAP,
      guardrailSourceNote: 'guardrail_stopLoss',
      guardrailOverrides: [{ symbol: 'SLB', action: 'reinforced_haiku', replacementSymbol: 'DVN' }],
      validationErrors: ['Swap execution failed: EODHD price unavailable for DVN'],
    };
    const s = selectWhyState(reinforced, 'SLB', LAST);
    expect(s.kind).toBe(WHY_KIND.FAILED);
    expect(s.footer).toBe(COPY.failedFooter);
    // …and a reinforced swap that a guardrail simply held keeps the second.
    expect(selectWhyState({ ...reinforced, validationErrors: [] }, 'SLB', LAST).kind).toBe(WHY_KIND.DOWNGRADED);
  });

  it('D-70 — guardrailForcedExit() is the gate, exported so one rule answers for the panel and the tape', () => {
    expect(GUARDRAIL_SOURCE_PREFIX).toBe('guardrail_');
    expect(GUARDRAIL_FORCED_EXIT).toBe('forced_exit');
    expect(guardrailForcedExit({ guardrailSourceNote: 'guardrail_stopLoss', guardrailOverrides: [{ action: 'forced_exit', symbol: 'SLB' }] })).toEqual({ action: 'forced_exit', symbol: 'SLB' });
    expect(guardrailForcedExit({ guardrailSourceNote: 'guardrail_max_sector_weight', guardrailOverrides: [{ action: 'blocked_swap' }] })).toBeNull();
    expect(guardrailForcedExit({})).toBeNull();
    expect(guardrailForcedExit(null)).toBeNull();
  });

  it('TRIPWIRE (D-70) — the sourceNote prefix and the forced_exit action are the ones agentGuardrails.js writes, read from its source', () => {
    const guardrails = readFileSync(new URL('../../../api/_utils/agentGuardrails.js', import.meta.url), 'utf8');
    expect(guardrails).toContain('sourceNote: `' + GUARDRAIL_SOURCE_PREFIX + '${forcedType}`');
    expect(guardrails).toContain("action: '" + GUARDRAIL_FORCED_EXIT + "'");
    // The reinforced branch that shares the prefix — the reason for conjunct 3.
    expect(guardrails).toContain("action: 'reinforced_haiku'");
  });

  it('HOLD → `Held`, the rationale carried verbatim, no footer', () => {
    const evaluation = { timestamp: TS, decision: 'HOLD', downgraded: false, rationale: RATIONALE_HOLD };
    const s = selectWhyState(evaluation, 'SLB', LAST);
    expect(s.kind).toBe(WHY_KIND.HELD);
    expect(s.label).toBe('Held');
    expect(s.rationale).toBe(RATIONALE_HOLD);
    expect(s.footer).toBeNull();
  });

  it('SWAP → `Swapped · OUT → IN` from symbolOut / symbolIn', () => {
    const evaluation = { timestamp: TS, decision: 'SWAP', downgraded: false, rationale: RATIONALE_SWAP, symbolOut: 'SLB', symbolIn: 'DVN' };
    const s = selectWhyState(evaluation, 'SLB', LAST);
    expect(s.kind).toBe(WHY_KIND.SWAPPED);
    expect(s.label).toBe('Swapped · SLB → DVN');
    expect(s.symbolOut).toBe('SLB');
    expect(s.symbolIn).toBe('DVN');
    expect(s.rationale).toBe(RATIONALE_SWAP);
  });

  it('a PROPOSAL held the position at the check — rendered as Held (autopilot launch; unreachable today)', () => {
    const evaluation = { timestamp: TS, decision: 'PROPOSAL', downgraded: false, rationale: RATIONALE_SWAP };
    expect(selectWhyState(evaluation, 'SLB', LAST).kind).toBe(WHY_KIND.HELD);
  });

  it('a blank or missing rationale renders no words — never a placeholder sentence', () => {
    expect(selectWhyState({ timestamp: TS, decision: 'HOLD', rationale: '   ' }, 'SLB', LAST).rationale).toBeNull();
    expect(selectWhyState({ timestamp: TS, decision: 'HOLD' }, 'SLB', LAST).rationale).toBeNull();
  });

  it('an engine-outage tick (haikuError stamped) is the ABSENCE state, never `Held` with the system\'s placeholder words (F12)', () => {
    const outage = {
      timestamp: TS, decision: 'HOLD', downgraded: false,
      rationale: 'Haiku call failed — defaulting to HOLD',
      haikuError: { failureClass: 'timeout', message: 'The operation was aborted', timestamp: TS, evalId: 'eval_009' },
    };
    const s = selectWhyState(outage, 'SLB', LAST);
    expect(s.kind).toBe(WHY_KIND.ABSENT);
    // D-65 (A4.0): the more specific absence — the fact is on the entry, and
    // only a TIMEOUT class earns the timeout words (review L1-F1).
    expect(s.label).toBe('No decision recorded at this check · the evaluation timed out');
    expect(s.label).toBe(COPY.noDecisionOutage);
    expect(s.rationale).toBeNull();
    // D-69 (A2.0): every OTHER persisted class (agentEvalTransport.js
    // classifyHaikuFailure / agent-evaluate.js) is an absence with the
    // CLASS-NEUTRAL line — true of every class, and never "timed out".
    for (const failureClass of ['budget_skipped', 'truncated_response', '429', '529', '500', 'APIConnectionError', 'unknown', undefined]) {
      const other = { ...outage, rationale: 'Evaluation skipped — cron budget too low to start Haiku call. Defaulting to HOLD.', haikuError: { failureClass } };
      expect(selectWhyState(other, 'SLB', LAST).kind).toBe(WHY_KIND.ABSENT);
      expect(selectWhyState(other, 'SLB', LAST).label).toBe(COPY.noDecisionIncomplete);
      expect(selectWhyState(other, 'SLB', LAST).label).toBe('No decision recorded at this check · the evaluation did not complete');
      expect(selectWhyState(other, 'SLB', LAST).label).not.toContain('timed out');
      expect(selectWhyState(other, 'SLB', LAST).rationale).toBeNull();
    }
    // MUTATION ROW (D-69): the timeout keeps the MORE SPECIFIC line. Collapsing
    // the two branches into one string fails here whichever string survives.
    expect(COPY.noDecisionOutage).not.toBe(COPY.noDecisionIncomplete);
    // haikuError null (the success shape) is a real decision.
    expect(selectWhyState({ ...outage, haikuError: null, rationale: RATIONALE_HOLD }, 'SLB', LAST).kind).toBe(WHY_KIND.HELD);
  });
});

describe('absence — a truthful state, on the `>=` join only', () => {
  it('an entry OLDER than lastScoredAt is an early-return tick: `No decision recorded at this check`', () => {
    const stale = { timestamp: '2026-09-01T16:32:01.000Z', decision: 'HOLD', rationale: RATIONALE_HOLD };
    const s = selectWhyState(stale, 'SLB', LAST);
    expect(s.kind).toBe(WHY_KIND.ABSENT);
    expect(s.label).toBe(COPY.noDecision);
    expect(s.label).toBe('No decision recorded at this check');
    expect(s.rationale).toBeNull();
  });

  it('every OTHER absence keeps the plain label — the outage words belong to a haikuError entry only (D-65)', () => {
    const stale = { timestamp: '2026-09-01T16:32:01.000Z', decision: 'HOLD', rationale: RATIONALE_HOLD, haikuError: { failureClass: 'transport' } };
    // A stale outage entry is not the LATEST check's absence: the plain label.
    expect(selectWhyState(stale, 'SLB', LAST).label).toBe(COPY.noDecision);
    expect(selectWhyState(null, 'SLB', LAST).label).toBe(COPY.noDecision);
    expect(selectWhyState({ decision: 'HOLD' }, 'SLB', LAST).label).toBe(COPY.noDecision);
    expect(COPY.noDecisionOutage.startsWith(COPY.noDecision)).toBe(true);
    expect(COPY.noDecisionIncomplete.startsWith(COPY.noDecision)).toBe(true);
  });

  it('an entry EQUAL to lastScoredAt belongs to the check (>=, never ===)', () => {
    const s = selectWhyState({ timestamp: LAST, decision: 'HOLD', rationale: RATIONALE_HOLD }, 'SLB', LAST);
    expect(s.kind).toBe(WHY_KIND.HELD);
  });

  it('no entry at all → absent', () => {
    expect(selectWhyState(null, 'SLB', LAST).kind).toBe(WHY_KIND.ABSENT);
    expect(selectWhyState(undefined, 'SLB', LAST).kind).toBe(WHY_KIND.ABSENT);
  });

  it('an entry with no parseable timestamp cannot be joined → absent', () => {
    expect(selectWhyState({ decision: 'HOLD', rationale: RATIONALE_HOLD }, 'SLB', LAST).kind).toBe(WHY_KIND.ABSENT);
  });

  it('the header still names the check in the absence state', () => {
    expect(selectWhyState(null, 'SLB', LAST).header).toBe('At the 12:45 PM check');
  });
});

describe('the header names the CHECK (lastScoredAt), never the piece', () => {
  it('`At the {t} check` from the scoring stamp, even when the entry is seconds later', () => {
    const s = selectWhyState({ timestamp: '2026-09-01T16:47:59.000Z', decision: 'HOLD' }, 'SLB', LAST);
    expect(s.header).toBe('At the 12:45 PM check');
    expect(s.checkedAt).toBe(LAST);
  });

  it('falls back to the entry timestamp when there is no scoring stamp', () => {
    const s = selectWhyState({ timestamp: TS, decision: 'HOLD' }, 'SLB', null);
    expect(s.header).toBe('At the 12:45 PM check');
  });

  it('book-level (no symbol) selects the same state with symbol null', () => {
    const s = selectWhyState({ timestamp: TS, decision: 'HOLD', rationale: RATIONALE_HOLD }, null, LAST);
    expect(s.symbol).toBeNull();
    expect(s.kind).toBe(WHY_KIND.HELD);
  });
});

describe('emphasizeSymbol — whole-word occurrences only, text never altered', () => {
  it('marks each whole-word occurrence', () => {
    const segs = emphasizeSymbol('Held SLB; SLB stays. SLBX is not SLB.', 'SLB');
    expect(segs.map((s) => s.text).join('')).toBe('Held SLB; SLB stays. SLBX is not SLB.');
    expect(segs.filter((s) => s.emphasized).map((s) => s.text)).toEqual(['SLB', 'SLB', 'SLB']);
  });

  it('a symbol with a regex metacharacter (BRK.B) is matched literally', () => {
    const segs = emphasizeSymbol('BRK.B held; BRKXB not.', 'BRK.B');
    expect(segs.filter((s) => s.emphasized).map((s) => s.text)).toEqual(['BRK.B']);
  });

  it('no symbol → one unemphasised segment; no text → nothing', () => {
    expect(emphasizeSymbol('words', null)).toEqual([{ text: 'words', emphasized: false }]);
    expect(emphasizeSymbol('', 'SLB')).toEqual([]);
    expect(emphasizeSymbol(null, 'SLB')).toEqual([]);
  });
});

describe('selectTradesForSymbol — the piece\'s trades today, engine text verbatim', () => {
  const TRADES = [
    { symbolOut: 'MU', symbolIn: 'SLB', swappedOutAt: '2026-09-01T15:02:00.000Z', exitReason: 'haiku_decision', rationale: 'MU rolled over; SLB leads energy.', lockedPoints: 3 },
    { symbolOut: 'CRM', symbolIn: 'NOW', swappedOutAt: '2026-09-01T15:32:00.000Z', exitReason: 'haiku_decision', rationale: 'unrelated' },
    { symbolOut: 'SLB', symbolIn: 'XOM', swappedOutAt: '2026-09-01T16:17:00.000Z', exitReason: 'guardrail_stop_loss', rationale: null },
  ];

  it('includes swaps in and out of the piece, oldest first, with time / symbols / the agent\'s words', () => {
    const rows = selectTradesForSymbol(TRADES, 'SLB');
    expect(rows.map((r) => `${r.symbolOut}→${r.symbolIn}`)).toEqual(['MU→SLB', 'SLB→XOM']);
    expect(rows[0]).toEqual({
      at: '2026-09-01T15:02:00.000Z', symbolOut: 'MU', symbolIn: 'SLB',
      rationale: 'MU rolled over; SLB leads energy.',
      // The model wrote this one, so there is no author line (review L5-F2).
      footer: null,
    });
    expect(rows[1].rationale).toBeNull();
  });

  it('MUTATION ROW (review L5-F2) — an ENGINE-authored swap reason is labelled here too', () => {
    // `This piece today` renders the SAME field the tape's trade card does.
    // Before this, one of the two surfaces named the author and the other did
    // not — the same sentence, two different claims about who wrote it.
    const forced = [{
      symbolOut: 'SLB', symbolIn: 'DVN', swappedOutAt: '2026-09-01T17:31:00.000Z',
      rationale: 'Guardrail override (guardrail_stopLoss): stop-loss breached on SLB. Forcing exit → DVN.',
    }];
    expect(selectTradesForSymbol(forced, 'SLB')[0].footer).toBe(COPY.motiveSystem);
    expect(selectTradesForSymbol(forced, 'SLB')[0].footer).toBe('The system\'s reason');
  });

  it('never surfaces the machinery-provenance code (exitReason) — the attribution class hazard 12 keeps off the screen (F10)', () => {
    for (const row of selectTradesForSymbol(TRADES, 'SLB')) {
      expect(row).not.toHaveProperty('exitReason');
      expect(JSON.stringify(row)).not.toMatch(/haiku_decision|guardrail_/);
    }
  });

  it('nothing for a piece with no trades, or with no trades array', () => {
    expect(selectTradesForSymbol(TRADES, 'NVDA')).toEqual([]);
    expect(selectTradesForSymbol(undefined, 'SLB')).toEqual([]);
    expect(selectTradesForSymbol(TRADES, null)).toEqual([]);
  });

  it('the copy line is the receipt\'s own time and symbols', () => {
    expect(COPY.tradeLine('2026-09-01T15:02:00.000Z', 'MU', 'SLB')).toBe('11:02 AM · MU → SLB');
    expect(COPY.tradeLine(null, 'MU', 'SLB')).toBe('MU → SLB');
  });
});

describe('splitSentences — verbatim, and numbers survive (A2.1)', () => {
  it('splits on `. ! ?` followed by whitespace or the end', () => {
    expect(splitSentences('One. Two! Three?')).toEqual(['One.', 'Two!', 'Three?']);
    expect(splitSentences('No terminator')).toEqual(['No terminator']);
    expect(splitSentences('Trailing space. ')).toEqual(['Trailing space.']);
  });

  it('MUTATION ROW — a decimal is not a sentence boundary; these paragraphs are full of numbers', () => {
    const text = 'SLB is down 8.4% from entry (-1.05x ATR). DVN is up 2.1%.';
    expect(splitSentences(text)).toEqual([
      'SLB is down 8.4% from entry (-1.05x ATR).',
      'DVN is up 2.1%.',
    ]);
  });

  it('VERBATIM — the pieces reassemble the original, punctuation and all', () => {
    const text = RATIONALE_SWAP + ' ' + RATIONALE_HOLD;
    expect(splitSentences(text).join(' ')).toBe(text);
  });

  it('an ellipsis or a run of terminators is ONE boundary, not several empties', () => {
    expect(splitSentences('Waiting... Then acting.')).toEqual(['Waiting...', 'Then acting.']);
    expect(splitSentences('Really?! Yes.')).toEqual(['Really?!', 'Yes.']);
  });

  it('the empty cases return [] — never [""]', () => {
    expect(splitSentences('')).toEqual([]);
    expect(splitSentences('   ')).toEqual([]);
    expect(splitSentences(null)).toEqual([]);
    expect(splitSentences(undefined)).toEqual([]);
    expect(splitSentences(42)).toEqual([]);
  });
});

describe('extractSentences — the sentences that name the piece (A2.1, D-75)', () => {
  const PARAGRAPH = 'CF is the weakest name in the book. SLB held its bid through the 12:45 bar. MOS remains the hedge and SLB stays as sized.';

  it('returns only the naming sentences, in order, verbatim', () => {
    expect(extractSentences(PARAGRAPH, 'SLB')).toEqual([
      'SLB held its bid through the 12:45 bar.',
      'MOS remains the hedge and SLB stays as sized.',
    ]);
    expect(extractSentences(PARAGRAPH, 'CF')).toEqual(['CF is the weakest name in the book.']);
  });

  it('the empty case is [] — a paragraph that never names the piece', () => {
    expect(extractSentences(PARAGRAPH, 'NVDA')).toEqual([]);
    expect(extractSentences('', 'SLB')).toEqual([]);
    expect(extractSentences(null, 'SLB')).toEqual([]);
    expect(extractSentences(PARAGRAPH, null)).toEqual([]);
    expect(extractSentences(PARAGRAPH, '')).toEqual([]);
  });

  it('THE ONE SYMBOL RULE — the same prefix rule the emphasis pass uses (BUILD_RULES §9)', () => {
    // A captured non-alphanumeric prefix, no lookbehind (Safari < 16.4).
    expect(namesSymbol('$SLB is bid.', 'SLB')).toBe(true);
    expect(namesSymbol('(SLB) is bid.', 'SLB')).toBe(true);
    expect(namesSymbol('SLB is bid.', 'SLB')).toBe(true);
    // …and the shipped caveats, kept deliberately.
    expect(namesSymbol('slb is bid.', 'SLB')).toBe(false);   // case-sensitive
    expect(namesSymbol('SLBX is bid.', 'SLB')).toBe(false);  // whole word
    expect(namesSymbol('XSLB is bid.', 'SLB')).toBe(false);
    // The extractor and the emphasiser cannot disagree about "names it": both
    // consume symbolPattern(). A sentence the extractor keeps has something for
    // the emphasiser to mark.
    for (const sentence of extractSentences(PARAGRAPH, 'SLB')) {
      expect(emphasizeSymbol(sentence, 'SLB').some((seg) => seg.emphasized)).toBe(true);
    }
    expect(symbolPattern('SLB')).toBeInstanceOf(RegExp);
    expect(symbolPattern('')).toBeNull();
    expect(symbolPattern(null)).toBeNull();
  });

  it('a symbol with regex metacharacters is escaped, not interpreted', () => {
    expect(namesSymbol('BRK.B is flat.', 'BRK.B')).toBe(true);
    expect(namesSymbol('BRKXB is flat.', 'BRK.B')).toBe(false);
  });

  it('a fresh matcher per call — a global regex\'s lastIndex never leaks between sentences', () => {
    const text = 'SLB one. SLB two. SLB three.';
    expect(extractSentences(text, 'SLB')).toHaveLength(3);
    expect(extractSentences(text, 'SLB')).toHaveLength(3);
  });
});

describe('deriveTierPrices — arithmetic on two persisted values (A2.1, ruling 1)', () => {
  it('is the levels cron\'s own formula: baseline × (1 ± threshold/100)', () => {
    const p = deriveTierPrices(145, 3.2);
    expect(p.bagger).toBeCloseTo(149.64, 10);
    expect(p.bust).toBeCloseTo(140.36, 10);
  });

  it('is the exact INVERSE of the percent the row renders beside it', () => {
    // The row's number is thresholdPriceChange in percent of the baseline; at
    // the bagger price it is exactly +baseATR, at the bust price exactly
    // -baseATR. If these two ever disagreed the panel would contradict the row.
    const baseline = 34.1;
    const baseATR = 2.75;
    const { bagger, bust } = deriveTierPrices(baseline, baseATR);
    expect(((bagger - baseline) / baseline) * 100).toBeCloseTo(baseATR, 10);
    expect(((bust - baseline) / baseline) * 100).toBeCloseTo(-baseATR, 10);
  });

  it('MUTATION ROW — null, never an estimate, when either input is missing or non-positive', () => {
    expect(deriveTierPrices(null, 3.2)).toBeNull();
    expect(deriveTierPrices(145, null)).toBeNull();
    expect(deriveTierPrices(0, 3.2)).toBeNull();
    expect(deriveTierPrices(145, 0)).toBeNull();
    expect(deriveTierPrices(-145, 3.2)).toBeNull();
    expect(deriveTierPrices(145, -3.2)).toBeNull();
    expect(deriveTierPrices(NaN, 3.2)).toBeNull();
    expect(deriveTierPrices(145, Infinity)).toBeNull();
    expect(deriveTierPrices('145', 3.2)).toBeNull();
    expect(deriveTierPrices(undefined, undefined)).toBeNull();
  });

  it('a SHORT gets no lines — the inversion has no persisted example to check against', () => {
    expect(deriveTierPrices(145, 3.2, 'short')).toBeNull();
    expect(deriveTierPrices(145, 3.2, 'long')).not.toBeNull();
    expect(deriveTierPrices(145, 3.2, null)).not.toBeNull();
  });
});

describe('the state carries the tick\'s triggers (A2.1, D-78)', () => {
  it('types only, from the persisted array', () => {
    const s = selectWhyState({ timestamp: TS, decision: 'HOLD', rationale: RATIONALE_HOLD, triggers: ['price_drop', 'news_catalyst'] }, 'SLB', LAST);
    expect(s.triggers).toEqual(['price_drop', 'news_catalyst']);
    expect(COPY.wokenBy(s.triggers)).toBe('Woken by a price drop');
  });

  it('null when there are none, and on an absence with no entry at all', () => {
    expect(selectWhyState({ timestamp: TS, decision: 'HOLD', rationale: RATIONALE_HOLD }, 'SLB', LAST).triggers).toBeNull();
    expect(selectWhyState({ timestamp: TS, decision: 'HOLD', rationale: RATIONALE_HOLD, triggers: [] }, 'SLB', LAST).triggers).toBeNull();
    expect(selectWhyState(null, 'SLB', LAST).triggers).toBeNull();
  });

  it('carried on an OUTAGE entry too — why it ran and that it recorded nothing are both true', () => {
    const s = selectWhyState({ timestamp: TS, decision: 'HOLD', triggers: ['price_drop'], haikuError: { failureClass: 'timeout' } }, 'SLB', LAST);
    expect(s.kind).toBe(WHY_KIND.ABSENT);
    expect(s.triggers).toEqual(['price_drop']);
  });

  it('ALL NINE persisted types have their ruled sentence (D-81)', () => {
    expect(COPY.wokenBy(['price_drop'])).toBe('Woken by a price drop');
    expect(COPY.wokenBy(['forced_open'])).toBe('Woken by the first check of the battle');
    expect(COPY.wokenBy(['forced_close'])).toBe('Woken by the final hour');
    // `near`, not `nearing`: the addendum's one edit to the handover's
    // proposals — a piece's distance to a tier is a STATE, and `nearing` is a
    // motion this surface cannot see.
    expect(COPY.wokenBy(['threshold_proximity'])).toBe('Woken by a piece near a scoring tier');
    expect(COPY.wokenBy(['bench_outperformance'])).toBe('Woken by a bench name outrunning the book');
    expect(COPY.wokenBy(['vwap_deviation'])).toBe('Woken by a move away from the day\'s average price');
    expect(COPY.wokenBy(['bandwidth_squeeze'])).toBe('Woken by a volatility squeeze');
    expect(COPY.wokenBy(['nr7_contraction'])).toBe('Woken by a narrow-range day');
    expect(COPY.wokenBy(['news_catalyst'])).toBe('Woken by a news story on a piece');
    expect(Object.keys(COPY.wokenByType)).toHaveLength(9);
  });

  it('MUTATION ROW — an UNKNOWN type still renders nothing, never a raw type string (D-78)', () => {
    // The gate is the only writer; a tenth type added there arrives here
    // unruled and SILENT until it has its own sentence.
    for (const type of ['made_up', 'earnings_gap', 'sector_rotation', '']) {
      expect(COPY.wokenBy([type])).toBeNull();
    }
    expect(COPY.wokenBy([])).toBeNull();
    expect(COPY.wokenBy(null)).toBeNull();
    expect(COPY.wokenBy('price_drop')).toBeNull();
    // …and no sentence is ever a raw type.
    for (const [type, sentence] of Object.entries(COPY.wokenByType)) {
      expect(sentence).not.toContain(type);
      expect(sentence).not.toContain('_');
      expect(sentence.startsWith('Woken by ')).toBe(true);
    }
  });

  it('TRIPWIRE — the trigger TYPES are the ones the gate writes, read from its source', () => {
    const gate = readFileSync(new URL('../../../api/_utils/agentTriggerGate.js', import.meta.url), 'utf8');
    // Every type this copy module rules on must still exist in the gate.
    for (const type of Object.keys(COPY.wokenByType)) {
      expect(gate).toContain(`type: '${type}'`);
    }
    // …and the cron persists the TYPE, not the gate's detail string.
    const cron = readFileSync(new URL('../../../api/cron/agent-evaluate.js', import.meta.url), 'utf8');
    expect(cron).toContain('triggers: triggers.map(t => t.type)');
  });
});

describe('renderMotive — the provenance code, translated or dropped (D-80, ruling 1)', () => {
  const forced = (token) => `Guardrail override (${token}): stop-loss at 8% breached on GILD (-9.24%). Forcing exit → MOS.`;

  it('translates each of the three ruled types into its words', () => {
    expect(renderMotive(forced('guardrail_stopLoss')))
      .toBe('Guardrail override (stop-loss): stop-loss at 8% breached on GILD (-9.24%). Forcing exit → MOS.');
    expect(renderMotive(forced('guardrail_trailingStop')))
      .toBe('Guardrail override (trailing stop): stop-loss at 8% breached on GILD (-9.24%). Forcing exit → MOS.');
    expect(renderMotive(forced('guardrail_profitTarget')))
      .toBe('Guardrail override (profit target): stop-loss at 8% breached on GILD (-9.24%). Forcing exit → MOS.');
  });

  it('drops the parenthetical for any other token, including the cron\'s own `hard` fallback', () => {
    expect(renderMotive(forced('guardrail_max_sector_weight')))
      .toBe('Guardrail override: stop-loss at 8% breached on GILD (-9.24%). Forcing exit → MOS.');
    expect(renderMotive(forced('hard')))
      .toBe('Guardrail override: stop-loss at 8% breached on GILD (-9.24%). Forcing exit → MOS.');
    expect(renderMotive(forced('guardrail_somethingRuledLater')))
      .toBe('Guardrail override: stop-loss at 8% breached on GILD (-9.24%). Forcing exit → MOS.');
  });

  it('NO `_`-joined code survives, whichever branch runs', () => {
    for (const token of ['guardrail_stopLoss', 'guardrail_trailingStop', 'guardrail_profitTarget', 'guardrail_max_sector_weight', 'guardrail_future_thing']) {
      expect(renderMotive(forced(token))).not.toContain('_');
    }
  });

  it('touches ONLY the anchored parenthetical — the engine\'s numbers and the R11 stamp survive', () => {
    const statusMessage = 'Guardrail override: stop-loss at 8% breached on GILD (-9.24%). Forcing exit → MOS.';
    expect(renderMotive(statusMessage)).toBe(statusMessage);
    const r11 = 'Deterministic guardrail enforcement during gameplan suppression (R11).';
    expect(renderMotive(r11)).toBe(r11);
    const risk = 'Risk manager: drawdown -7.2% (below the cut threshold), rotating GILD → MOS.';
    expect(renderMotive(risk)).toBe(risk);
  });

  it('leaves the model\'s own words alone, and trims exactly as the panel does', () => {
    const agent = 'GILD (stopLoss territory, by my read) has stalled at the 200-day.';
    expect(renderMotive(agent)).toBe(agent);
    expect(renderMotive(`  ${agent}\n`)).toBe(agent);
    expect(renderMotive('   ')).toBeNull();
    expect(renderMotive(null)).toBeNull();
    expect(renderMotive(42)).toBeNull();
  });

  it('MUTATION — the anchor is an ENGINE motive prefix, so only an engine sentence can be rewritten', () => {
    // The rule has no separate authorship conjunct, deliberately: one that
    // could never fire is not a guard. This row is what keeps that true — if
    // `Guardrail override` stops being an engine prefix, the translation is
    // silently rewriting prose it has no licence to touch.
    expect(ENGINE_MOTIVE_PREFIXES).toContain('Guardrail override');
    expect(isEngineAuthoredMotive(forced('guardrail_stopLoss'))).toBe(true);
    expect(isEngineAuthoredMotive(renderMotive(forced('guardrail_stopLoss')))).toBe(true);
    // …and the translation cannot change whose words a sentence is.
    expect(isEngineAuthoredMotive(renderMotive(forced('hard')))).toBe(true);
  });

  it('the panel and the trades list render the SAME translated text (BUILD_RULES §9)', () => {
    const rationale = forced('guardrail_stopLoss');
    const state = selectWhyState(
      { timestamp: TS, decision: 'SWAP', symbolOut: 'GILD', symbolIn: 'MOS', rationale },
      'GILD',
      LAST,
    );
    const [trade] = selectTradesForSymbol(
      [{ symbolOut: 'GILD', symbolIn: 'MOS', swappedOutAt: TS, rationale, source: 'guardrail' }],
      'GILD',
    );
    expect(state.rationale).toBe(renderMotive(rationale));
    expect(trade.rationale).toBe(state.rationale);
    expect(state.footer).toBe(COPY.motiveSystem);
    expect(trade.footer).toBe(COPY.motiveSystem);
  });
});
