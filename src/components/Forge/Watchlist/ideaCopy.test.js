// src/components/Forge/Watchlist/ideaCopy.test.js
//
// Pilot P1a — the panel's words against the blessed language tables
// (docs/specs/MODE_TRUTH_LANGUAGE_TABLES_V1.md): table C's lines are shipped
// VERBATIM (read from the spec file, compared byte for byte), the
// placeholders are filled only from the record, and nothing the panel says
// uses table E's forbidden vocabulary.
//
// Pilot P1b (P1b acceptance row 9): table C V1.1 adds the two [LIST] review
// rows (founder ruling B3) — seven rows, each pinned here against the spec;
// the due-deploy line the deploy endpoint answers with is the SAME string
// (src/constants/hypothesisRecords.js DUE_DEPLOY_LINE, re-exported as
// LIFECYCLE_LINES.dueDeploy); and the §E sweep covers the server-side
// player strings P1b adds (the refusal and the race message).
//
// Pilot P1c (acceptance row 6): table C V1.2 (founder rulings E1–E3) adds
// five rows — the deploy station's due-idea title ([SYM] and [LIST]), the
// success screen's line, the review card's honest line ([AGENT]) and the
// void line — and a labels table (the screen's three buttons, the card's
// labels). Every one is pinned here against the spec byte for byte, the
// [SYM]/[LIST] rule decides the title, and the §E sweep covers them all.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  LIFECYCLE_LINES, fillLine, ideaSymbolOf, ideaListOf, windowTextOf, formatIdeaDate,
  STATUS_LABELS, ACTION_LABELS, HORIZON_LABELS, HORIZON_SOURCE_LABELS, PANEL_COPY,
  DUE_DEPLOY_ACTIONS, REVIEW_CARD_LABELS, dueDeployTitleFor, deployVoidedLineFor, lifecycleLineFor, countedOfText,
} from './ideaCopy';
import {
  HYPOTHESIS_STATUSES, HORIZON_ENUMS, HORIZON_SOURCES, PLAYER_ACTIONS, DUE_DEPLOY_LINE, CARRIAGE_RACE_MESSAGE, DEPLOY_REFUSAL_CODE,
  REVIEW_HONEST_LINE,
} from '../../../constants/hypothesisRecords';

const HERE = dirname(fileURLToPath(import.meta.url));
const TABLES = readFileSync(resolve(HERE, '../../../../docs/specs/MODE_TRUTH_LANGUAGE_TABLES_V1.md'), 'utf8').replace(/\r\n/g, '\n');

/** Table C's rows: { state/event cell → the quoted player line }. */
function tableC() {
  const section = TABLES.slice(TABLES.indexOf('## C. Hypothesis lifecycle'), TABLES.indexOf('## D.'));
  const rows = {};
  for (const line of section.split('\n')) {
    const m = /^\| (.+?) \| "(.+)" \|$/.exec(line);
    if (m) rows[m[1]] = m[2];
  }
  return rows;
}

describe('table C, verbatim', () => {
  const C = tableC();
  it('the spec\'s table C has exactly the rows the panel ships (V1\'s five, table C V1.1\'s two [LIST] rows, table C V1.2\'s five rows and its nine labels)', () => {
    expect(Object.keys(C)).toEqual([
      '`review_due` (horizon elapsed)', '`review_due` (battle ended, `unspecified`)', '`invalidated`', 'reaffirmation', 'deploy of a due version attempted',
      '`review_due` (horizon elapsed), `[LIST]`', '`review_due` (battle ended, `unspecified`), `[LIST]`',
      'deploy with a due idea — the screen before it', 'deploy with a due idea — the screen before it, `[LIST]`',
      'deploy with a due idea — the success screen after it', 'the review card', '`ready` again (`deploy_voided`)',
      'the screen before the deploy, button 1', 'the screen before the deploy, button 2', 'the screen before the deploy, button 3',
      'the review card, the list-versus-market difference', 'the review card, the difference\'s unit (percentage points)',
      'the review card, the per-name table (collapsed)',
      'the review card, a name, the list or the market with no price for the window (none in the feed, not priced within the budget, or a failed fetch)',
      'the review card, the list\'s figure when it counts fewer than all of the list\'s names',
      'the review card, the carrying battles', 'the review card, a voided battle\'s mark',
    ]);
  });
  it('each shipped line equals its table row byte for byte', () => {
    expect(LIFECYCLE_LINES.reviewDueHorizon).toBe(C['`review_due` (horizon elapsed)']);
    expect(LIFECYCLE_LINES.reviewDueBattleEnded).toBe(C['`review_due` (battle ended, `unspecified`)']);
    expect(LIFECYCLE_LINES.invalidated).toBe(C['`invalidated`']);
    expect(LIFECYCLE_LINES.reaffirmed).toBe(C.reaffirmation);
    expect(LIFECYCLE_LINES.dueDeploy).toBe(C['deploy of a due version attempted']);
    expect(LIFECYCLE_LINES.reviewDueHorizonList).toBe(C['`review_due` (horizon elapsed), `[LIST]`']);
    expect(LIFECYCLE_LINES.reviewDueBattleEndedList).toBe(C['`review_due` (battle ended, `unspecified`), `[LIST]`']);
    // Table C V1.2 (Pilot P1c).
    expect(LIFECYCLE_LINES.dueDeployTitle).toBe(C['deploy with a due idea — the screen before it']);
    expect(LIFECYCLE_LINES.dueDeployTitleList).toBe(C['deploy with a due idea — the screen before it, `[LIST]`']);
    expect(LIFECYCLE_LINES.deployRanWithout).toBe(C['deploy with a due idea — the success screen after it']);
    expect(LIFECYCLE_LINES.reviewHonest).toBe(C['the review card']);
    expect(LIFECYCLE_LINES.deployVoided).toBe(C['`ready` again (`deploy_voided`)']);
    expect(Object.keys(LIFECYCLE_LINES)).toHaveLength(12);
  });
  it('table C V1.2\'s labels: the screen\'s three buttons in their order, and the review card\'s labels, byte for byte', () => {
    expect(DUE_DEPLOY_ACTIONS.map((a) => a.label)).toEqual([
      C['the screen before the deploy, button 1'], C['the screen before the deploy, button 2'], C['the screen before the deploy, button 3'],
    ]);
    expect(DUE_DEPLOY_ACTIONS.map((a) => a.id)).toEqual(['reaffirm', 'retire', 'without']);
    expect(REVIEW_CARD_LABELS).toEqual({
      difference: C['the review card, the list-versus-market difference'],
      points: C['the review card, the difference\'s unit (percentage points)'],
      names: C['the review card, the per-name table (collapsed)'],
      noData: C['the review card, a name, the list or the market with no price for the window (none in the feed, not priced within the budget, or a failed fetch)'],
      countedOf: C['the review card, the list\'s figure when it counts fewer than all of the list\'s names'],
      battles: C['the review card, the carrying battles'],
      voided: C['the review card, a voided battle\'s mark'],
    });
  });
  it('the list figure\'s [n] of [N] (review L4-3): only when it counts fewer than all of the list\'s names', () => {
    expect(countedOfText(10, 25)).toBe('10 of 25');
    expect(countedOfText(0, 3)).toBe('0 of 3');
    expect(countedOfText(3, 3)).toBeNull();
    expect(countedOfText(undefined, 3)).toBeNull();
    expect(countedOfText(2.5, 3)).toBeNull();
    expect(countedOfText(1, undefined)).toBeNull();
    expect(countedOfText(1, 2.5)).toBeNull();
  });
  it('the review card\'s honest line is ONE string, the server\'s and the Forge\'s (the review route fills it)', () => {
    expect(REVIEW_HONEST_LINE).toBe(C['the review card']);
    expect(LIFECYCLE_LINES.reviewHonest).toBe(REVIEW_HONEST_LINE);
  });
  it('the V1.2 title rows are the V1.1 pair\'s shape: the [LIST] row is the [SYM] row with [SYM] → [LIST] and nothing else', () => {
    expect(LIFECYCLE_LINES.dueDeployTitleList).toBe(LIFECYCLE_LINES.dueDeployTitle.replace('[SYM]', '[LIST]'));
  });
  it('the table C V1.2 note is dated and the header and footer name the version (V1.6)', () => {
    expect(TABLES).toContain('**Table C V1.2 — 16 Oct 2026 (founder rulings E1–E3, Pilot P1c; pilot spec Amendment E):**');
    expect(TABLES).toContain('**V1.6 — 16 Oct 2026:** table C gains its V1.2');
    expect(TABLES).toContain('*V1.6 — 16 Oct 2026: table C V1.2, the due-idea deploy lines, the review card\'s line and labels, and the void line (founder rulings E1–E3).*');
  });
  it('the [LIST] rows are the V1 rows with [SYM] → [LIST] and nothing else (B3: "the existing rows stay unchanged")', () => {
    expect(LIFECYCLE_LINES.reviewDueHorizonList).toBe(LIFECYCLE_LINES.reviewDueHorizon.replace('[SYM]', '[LIST]'));
    expect(LIFECYCLE_LINES.reviewDueBattleEndedList).toBe(LIFECYCLE_LINES.reviewDueBattleEnded.replace('[SYM]', '[LIST]'));
  });
  it('the deploy refusal answers with the SAME due-deploy string the Forge ships (one source — BUILD_RULES §9)', () => {
    expect(DUE_DEPLOY_LINE).toBe(C['deploy of a due version attempted']);
    expect(LIFECYCLE_LINES.dueDeploy).toBe(DUE_DEPLOY_LINE);
    expect(DEPLOY_REFUSAL_CODE).toBe('hypothesis_review_due');
  });
  it('the table C V1.1 note is dated and the header names the version (V1.5)', () => {
    expect(TABLES).toContain('**Table C V1.1 — 8 Oct 2026 (founder ruling B3, Pilot P1b):**');
    expect(TABLES).toContain('**V1.5 — 8 Oct 2026:** table C gains its V1.1');
  });
});

describe('placeholders are filled from the record, never invented', () => {
  it('a full fill replaces every slot', () => {
    expect(fillLine(LIFECYCLE_LINES.reviewDueHorizon, { sym: 'NVDA', window: 'Swing, 10 trading sessions' }))
      .toBe("Your NVDA idea reached its time-frame (Swing, 10 trading sessions). Nothing was sold and nothing was deleted — it's flagged for your review. Reaffirm it to make a fresh version, or retire it.");
    expect(fillLine(LIFECYCLE_LINES.invalidated, { sym: 'NVDA', condition: 'close_below_slow' }))
      .toBe("Your NVDA idea hit its invalidation: close_below_slow. That's recorded on the idea itself — what happens next is your call.");
  });
  it('a missing value → null (the line is not rendered), never a blank or a guess', () => {
    expect(fillLine(LIFECYCLE_LINES.reviewDueHorizon, { sym: 'NVDA', window: null })).toBeNull();
    expect(fillLine(LIFECYCLE_LINES.reviewDueBattleEnded, { sym: '  ' })).toBeNull();
    expect(fillLine(LIFECYCLE_LINES.invalidated, { sym: 'NVDA' })).toBeNull();
  });
  it('a line with no placeholder is returned unchanged', () => {
    expect(fillLine(LIFECYCLE_LINES.reaffirmed)).toBe(LIFECYCLE_LINES.reaffirmed);
  });
  it('[AGENT] (table C V1.2): the frozen agent name, else no line', () => {
    expect(fillLine(LIFECYCLE_LINES.reviewHonest, { agent: 'Shadow' }))
      .toBe("Shadow doesn't act on your ideas yet. This shows how the names did over the idea's time-frame — not what the agent did with it.");
    expect(fillLine(LIFECYCLE_LINES.reviewHonest, {})).toBeNull();
    expect(fillLine(LIFECYCLE_LINES.reviewHonest, { agent: ' ' })).toBeNull();
  });
  it('the due-deploy screen\'s title (E1): [SYM] when the idea names one symbol, else the FROZEN [LIST]; neither → null; only for a due version', () => {
    const due = { status: 'review_due', stateReason: 'horizon_elapsed', horizonEnum: 'swing', activation: [], invalidation: [] };
    const cond = (symbol) => ({ symbol, side: 'above', level: 1, basis: 'daily_close' });
    expect(dueDeployTitleFor(due, { name: 'Chips', tickers: ['NVDA'] })).toBe('Your NVDA idea reached its time-frame.');
    expect(dueDeployTitleFor(due, { name: 'AI capex', tickers: ['NVDA', 'AMD'] })).toBe('Your AI capex idea reached its time-frame.');
    expect(dueDeployTitleFor({ ...due, activation: [cond('AMD')] }, { name: 'AI capex', tickers: ['NVDA', 'AMD'] })).toBe('Your AMD idea reached its time-frame.');
    expect(dueDeployTitleFor(due, null)).toBeNull();
    expect(dueDeployTitleFor(due, { name: '  ', tickers: ['NVDA', 'AMD'] })).toBeNull();
    expect(dueDeployTitleFor({ ...due, status: 'activated' }, { name: 'Chips', tickers: ['NVDA'] })).toBeNull();
    expect(dueDeployTitleFor(null)).toBeNull();
  });
  it('"reached its time-frame" is claimed only when one elapsed (review L4-1): a battle-ended open-ended idea gets table C\'s own line for that state (the Forge\'s, word for word); a clock-fault version (B5) and any other reason get none', () => {
    const ended = { status: 'review_due', stateReason: 'battle_ended', horizonEnum: 'unspecified', activation: [], invalidation: [] };
    const list = { name: 'AI capex', tickers: ['NVDA', 'AMD'] };
    expect(dueDeployTitleFor(ended, list)).toBe("The battle ended with your AI capex idea still open-ended. It's flagged for review — reaffirm or retire when you're ready.");
    expect(dueDeployTitleFor(ended, list)).toBe(lifecycleLineFor(ended, list));
    expect(dueDeployTitleFor(ended, { name: 'Chips', tickers: ['NVDA'] })).toBe("The battle ended with your NVDA idea still open-ended. It's flagged for review — reaffirm or retire when you're ready.");
    expect(dueDeployTitleFor({ ...ended, horizonEnum: 'swing', reviewClockFault: 'calendar_unavailable' }, list)).toBeNull();
    expect(dueDeployTitleFor({ ...ended, stateReason: undefined }, list)).toBeNull();
  });
  it('the void line (E3): only for a version the review pass returned to ready as deploy_voided', () => {
    expect(deployVoidedLineFor({ status: 'ready', stateReason: 'deploy_voided' })).toBe("That battle never ran, so your idea is back to Ready. Its clock hasn't started.");
    expect(deployVoidedLineFor({ status: 'ready', stateReason: 'reaffirmed' })).toBeNull();
    expect(deployVoidedLineFor({ status: 'activated', stateReason: 'deploy_voided' })).toBeNull();
    expect(deployVoidedLineFor(null)).toBeNull();
  });
  it('[SYM] (founder ruling B3): ONLY when the idea names exactly one symbol — its own conditions, else a ONE-ticker frozen snapshot — never the live list (review L1-2 / L4-6)', () => {
    const cond = (symbol) => ({ symbol, side: 'above', level: 1, basis: 'daily_close' });
    const one = { name: 'Chips', tickers: ['NVDA'] };
    const many = { name: 'AI capex', tickers: ['NVDA', 'AMD', 'PLTR'] };
    // Its own conditions decide when it has any.
    expect(ideaSymbolOf({ activation: [cond('NVDA')], invalidation: [cond('NVDA')] })).toBe('NVDA');
    expect(ideaSymbolOf({ activation: [cond('NVDA')], invalidation: [] }, many)).toBe('NVDA');
    expect(ideaSymbolOf({ activation: [cond('NVDA'), cond('AMD')], invalidation: [] })).toBeNull();
    expect(ideaSymbolOf({ activation: [cond('NVDA'), cond('AMD')], invalidation: [] }, one)).toBeNull(); // the idea names two
    // No conditions: the frozen snapshot, exactly one ticker.
    expect(ideaSymbolOf({ activation: [], invalidation: [] }, one)).toBe('NVDA');
    expect(ideaSymbolOf({ activation: [], invalidation: [] }, { name: 'x', tickers: ['NVDA', 'NVDA'] })).toBe('NVDA');
    expect(ideaSymbolOf({ activation: [], invalidation: [] }, many)).toBeNull();
    expect(ideaSymbolOf({ activation: [], invalidation: [] }, { name: 'x', tickers: [] })).toBeNull();
    expect(ideaSymbolOf({ activation: [], invalidation: [] })).toBeNull();
    expect(ideaSymbolOf({})).toBeNull();
    // A list's live tickers in the old shape are not a source.
    expect(ideaSymbolOf({ activation: [], invalidation: [] }, [{ symbol: 'IWM' }])).toBeNull();
  });
  it('I01 (mutation lens) — a blank condition symbol is no symbol: the frozen one-ticker snapshot decides', () => {
    expect(ideaSymbolOf({ activation: [{ symbol: '  ', side: 'above', level: 1, basis: 'daily_close' }], invalidation: [] }, { name: 'Chips', tickers: ['NVDA'] })).toBe('NVDA');
  });
  it('[LIST] (founder ruling B3): the frozen list NAME, else null', () => {
    expect(ideaListOf({ name: 'AI capex', tickers: ['NVDA', 'AMD'] })).toBe('AI capex');
    expect(ideaListOf({ name: '  ', tickers: [] })).toBeNull();
    expect(ideaListOf(null)).toBeNull();
    expect(ideaListOf()).toBeNull();
    expect(fillLine(LIFECYCLE_LINES.reviewDueBattleEndedList, { list: 'AI capex' }))
      .toBe("The battle ended with your AI capex idea still open-ended. It's flagged for review — reaffirm or retire when you're ready.");
    expect(fillLine(LIFECYCLE_LINES.reviewDueHorizonList, { list: 'AI capex', window: null })).toBeNull();
  });
  it('[window]: the companion §6 window for the recorded enum; null for unspecified', () => {
    expect(windowTextOf('intraday')).toBe('Intraday, 2 trading sessions');
    expect(windowTextOf('swing')).toBe('Swing, 10 trading sessions');
    expect(windowTextOf('positional')).toBe('Positional, 30 trading sessions');
    expect(windowTextOf('longterm')).toBe('Long-term, 60 trading sessions');
    expect(windowTextOf('unspecified')).toBeNull();
  });
  it('dates render on the market calendar, deterministic on any machine', () => {
    expect(formatIdeaDate('2026-10-08T02:00:00.000Z')).toBe('Oct 7, 2026');
    expect(formatIdeaDate(null)).toBeNull();
    expect(formatIdeaDate('not a date')).toBeNull();
  });
});

describe('labels cover the vocabulary exactly', () => {
  it('a label for every status, horizon, horizon source and action', () => {
    expect(Object.keys(STATUS_LABELS).sort()).toEqual([...HYPOTHESIS_STATUSES].sort());
    expect(Object.keys(HORIZON_LABELS).sort()).toEqual([...HORIZON_ENUMS].sort());
    expect(Object.keys(HORIZON_SOURCE_LABELS).sort()).toEqual([...HORIZON_SOURCES].sort());
    expect(Object.keys(ACTION_LABELS).sort()).toEqual([...PLAYER_ACTIONS].sort());
  });
});

describe('table E — forbidden vocabulary appears nowhere the panel speaks', () => {
  const FORBIDDEN = [
    /\bhedge/i, /\btrim/i, /\bpartial/i, /\bscale (in|out)\b/i, /take some off/i, /cash position/i, /move to cash/i,
    /sit in cash/i, /wait for the market to/i, /probably|likely fine/i, /guaranteed/i, /can'?t lose/i,
  ];
  const ALL = [
    ...Object.values(LIFECYCLE_LINES), ...Object.values(STATUS_LABELS), ...Object.values(ACTION_LABELS),
    ...Object.values(HORIZON_LABELS), ...Object.values(HORIZON_SOURCE_LABELS), ...Object.values(PANEL_COPY),
    // Pilot P1b — the server's player-facing deploy strings (the refusal and the race).
    DUE_DEPLOY_LINE, CARRIAGE_RACE_MESSAGE,
    // Pilot P1c — table C V1.2's labels (its lines are in LIFECYCLE_LINES above).
    ...DUE_DEPLOY_ACTIONS.map((a) => a.label), ...Object.values(REVIEW_CARD_LABELS), REVIEW_HONEST_LINE,
  ];
  it('no string matches a forbidden term', () => {
    const hits = ALL.flatMap((s) => FORBIDDEN.filter((re) => re.test(s)).map((re) => `${re} in "${s}"`));
    expect(hits).toEqual([]);
  });
});
