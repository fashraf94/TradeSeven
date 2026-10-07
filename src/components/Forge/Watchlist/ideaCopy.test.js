// src/components/Forge/Watchlist/ideaCopy.test.js
//
// Pilot P1a — the panel's words against the blessed language tables
// (docs/specs/MODE_TRUTH_LANGUAGE_TABLES_V1.md): table C's five lines are
// shipped VERBATIM (read from the spec file, compared byte for byte), the
// placeholders are filled only from the record, and nothing the panel says
// uses table E's forbidden vocabulary.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  LIFECYCLE_LINES, fillLine, ideaSymbolOf, windowTextOf, formatIdeaDate,
  STATUS_LABELS, ACTION_LABELS, HORIZON_LABELS, HORIZON_SOURCE_LABELS, PANEL_COPY,
} from './ideaCopy';
import { HYPOTHESIS_STATUSES, HORIZON_ENUMS, HORIZON_SOURCES, PLAYER_ACTIONS } from '../../../constants/hypothesisRecords';

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
  it('the spec\'s table C has exactly the five rows the panel ships', () => {
    expect(Object.keys(C)).toEqual([
      '`review_due` (horizon elapsed)', '`review_due` (battle ended, `unspecified`)', '`invalidated`', 'reaffirmation', 'deploy of a due version attempted',
    ]);
  });
  it('each shipped line equals its table row byte for byte', () => {
    expect(LIFECYCLE_LINES.reviewDueHorizon).toBe(C['`review_due` (horizon elapsed)']);
    expect(LIFECYCLE_LINES.reviewDueBattleEnded).toBe(C['`review_due` (battle ended, `unspecified`)']);
    expect(LIFECYCLE_LINES.invalidated).toBe(C['`invalidated`']);
    expect(LIFECYCLE_LINES.reaffirmed).toBe(C.reaffirmation);
    expect(LIFECYCLE_LINES.dueDeploy).toBe(C['deploy of a due version attempted']);
    expect(Object.keys(LIFECYCLE_LINES)).toHaveLength(5);
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
  it('[SYM]: ONLY the version\'s own condition symbols (one to three), else null — never the parent list\'s tickers (review L1-2 / L4-6)', () => {
    const cond = (symbol) => ({ symbol, side: 'above', level: 1, basis: 'daily_close' });
    expect(ideaSymbolOf({ activation: [cond('NVDA')], invalidation: [cond('NVDA')] })).toBe('NVDA');
    expect(ideaSymbolOf({ activation: [cond('NVDA'), cond('AMD')], invalidation: [] })).toBe('NVDA / AMD');
    expect(ideaSymbolOf({ activation: ['A', 'B', 'C', 'D'].map(cond), invalidation: [] })).toBeNull();
    expect(ideaSymbolOf({ activation: [], invalidation: [] })).toBeNull();
    expect(ideaSymbolOf({})).toBeNull();
    // A second argument (a list's tickers) is not a source at all.
    expect(ideaSymbolOf({ activation: [], invalidation: [] }, [{ symbol: 'IWM' }])).toBeNull();
    expect(ideaSymbolOf.length).toBe(1);
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
  ];
  it('no string matches a forbidden term', () => {
    const hits = ALL.flatMap((s) => FORBIDDEN.filter((re) => re.test(s)).map((re) => `${re} in "${s}"`));
    expect(hits).toEqual([]);
  });
});
