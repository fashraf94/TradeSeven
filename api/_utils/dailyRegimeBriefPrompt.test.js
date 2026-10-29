// api/_utils/dailyRegimeBriefPrompt.test.js
//
// DRB stale fix (Oct 29 2026) — the prompt builder's bounds. In peak earnings weeks every >$25B report reached the prompt and
// the model was told to list each one, so its answer ran past the 2,500-token cap and the day was lost
// (docs/audits/20261028_PHASE0_DRB_DISCOVERY.md §3 Q2). Pinned here: at most 8 earnings this week and 5 next week reach the
// prompt, ranked priority list first and then by market cap, with a "+K more not listed" count; the names it counts never
// reach the prompt; the macro calendar renders as before; and the instructions ask for the most important events up to 10,
// with the guard against invented events kept.

import { describe, expect, it } from 'vitest';
import {
  DAILY_REGIME_BRIEF_TOOL,
  KEY_EVENTS_LIMIT,
  NEXT_WEEK_EARNINGS_LIMIT,
  THIS_WEEK_EARNINGS_LIMIT,
  buildDailyRegimeBriefPrompt,
  selectEarnings,
} from './dailyRegimeBriefPrompt.js';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

/** `n` earnings rows Mon Oct 26 → Fri Oct 30 2026, the shape fetchEarningsCalendarEODHD returns; caps fall with the index. */
function earningsWeek(n, { firstDate = 26, prefix = 'T' } = {}) {
  return Array.from({ length: n }, (_, i) => {
    const d = firstDate + (i % 5);
    return {
      date: `2026-10-${String(d).padStart(2, '0')}`,
      day: DAYS[i % 5],
      timing: i % 2 ? 'AMC' : 'BMO',
      symbol: `${prefix}${String(i).padStart(2, '0')}`,
      name: `${prefix} Company ${i}`,
      significance: 'high',
      marketCap: 30e9 + (n - i) * 10e9,
      priorityRank: null,
    };
  });
}

const MACRO = [
  { date: '2026-10-27', day: 'Tuesday', time: '10:00 AM ET', event: 'Consumer Confidence (October)', impact: 'medium' },
  { date: '2026-10-28', day: 'Wednesday', time: '2:00 PM ET', event: 'FOMC rate decision', impact: 'high' },
  { date: '2026-10-29', day: 'Thursday', time: '8:30 AM ET', event: 'GDP Q3 2026 advance estimate', impact: 'high' },
  { date: '2026-10-29', day: 'Thursday', time: '8:30 AM ET', event: 'Initial Jobless Claims', impact: 'medium' },
  { date: '2026-10-30', day: 'Friday', time: '8:30 AM ET', event: 'PCE (September)', impact: 'high' },
];

const build = (over = {}) => buildDailyRegimeBriefPrompt({
  marketContext: { regime: 'Risk-on' },
  technicalLeaders: ['NVDA'],
  technicalLaggards: ['XOM'],
  thisWeekEvents: MACRO,
  nextWeekEvents: [],
  thisWeekEarnings: [],
  nextWeekEarnings: [],
  forDate: '2026-10-26',
  ...over,
});

/** The lines of one `=== … ===` section of the user prompt. */
function section(userPrompt, heading) {
  const start = userPrompt.indexOf(`=== ${heading}`);
  expect(start, heading).toBeGreaterThanOrEqual(0);
  const body = userPrompt.slice(userPrompt.indexOf('\n', start) + 1);
  const end = body.search(/\n\n/);
  return (end === -1 ? body : body.slice(0, end)).split('\n');
}

describe('the earnings lists are capped (the actual fix)', () => {
  it('the limits are the ruling\'s: 8 this week, 5 next week, and up to 10 key events', () => {
    expect(THIS_WEEK_EARNINGS_LIMIT).toBe(8);
    expect(NEXT_WEEK_EARNINGS_LIMIT).toBe(5);
    expect(KEY_EVENTS_LIMIT).toBe(10);
  });

  it('a 50-event week renders at most 8 + 5 earnings, each list closed by its "+K more not listed" count', () => {
    const { userPrompt, earningsListed } = build({ thisWeekEarnings: earningsWeek(50), nextWeekEarnings: earningsWeek(20, { firstDate: 2, prefix: 'N' }).map((e) => ({ ...e, date: e.date.replace('2026-10-', '2026-11-') })) });
    const thisWeek = section(userPrompt, 'EARNINGS — THIS WEEK');
    const nextWeek = section(userPrompt, 'EARNINGS — NEXT WEEK');
    expect(thisWeek).toHaveLength(9);
    expect(thisWeek.slice(0, 8).every((l) => /^- 2026-10-\d\d \(\w{3}\) (AMC|BMO) — T\d\d \(T Company \d+\)$/.test(l))).toBe(true);
    expect(thisWeek[8]).toBe('- +42 more not listed');
    expect(nextWeek).toHaveLength(6);
    expect(nextWeek.slice(0, 5).every((l) => /^- 2026-11-\d\d \(\w{3}\) (AMC|BMO) — N\d\d$/.test(l))).toBe(true);
    expect(nextWeek[5]).toBe('- +15 more not listed');
    expect(earningsListed).toEqual({ thisWeek: 8, nextWeek: 5 });
  });

  it('the names the count stands for never reach the prompt', () => {
    const { userPrompt } = build({ thisWeekEarnings: earningsWeek(50) });
    for (let i = 8; i < 50; i += 1) expect(userPrompt).not.toContain(`T${String(i).padStart(2, '0')}`);
    for (let i = 0; i < 8; i += 1) expect(userPrompt).toContain(`T${String(i).padStart(2, '0')}`);
  });

  it('a week at or under the cap lists every report and adds no count line', () => {
    for (const n of [0, 1, 8]) {
      const { userPrompt, earningsListed } = build({ thisWeekEarnings: earningsWeek(n), nextWeekEarnings: earningsWeek(Math.min(n, 5), { prefix: 'N' }) });
      expect(userPrompt).not.toMatch(/more not listed/);
      expect(earningsListed).toEqual({ thisWeek: n, nextWeek: Math.min(n, 5) });
      if (n === 0) expect(section(userPrompt, 'EARNINGS — THIS WEEK')).toEqual(['(none)']);
      else expect(section(userPrompt, 'EARNINGS — THIS WEEK')).toHaveLength(n);
    }
    expect(build({ thisWeekEarnings: earningsWeek(9) }).userPrompt).toMatch(/\n- \+1 more not listed\n/);
  });

  it('only high-significance rows count, in the list and in the "+K more"', () => {
    const rows = [...earningsWeek(10), ...earningsWeek(5, { prefix: 'L' }).map((e) => ({ ...e, significance: 'medium', marketCap: 5e12 }))];
    const { userPrompt } = build({ thisWeekEarnings: rows });
    expect(userPrompt).not.toMatch(/L0\d/);
    expect(section(userPrompt, 'EARNINGS — THIS WEEK')[8]).toBe('- +2 more not listed');
  });
});

describe('ranking: the priority list first, then market cap, then the list\'s own order', () => {
  // priorityRank: the symbol's position in the fetcher's priority list (null when it is not on it).
  const row = (symbol, marketCap, priorityRank, date = '2026-10-28') => ({ date, day: 'Wednesday', timing: 'AMC', symbol, name: symbol, significance: 'high', marketCap, priorityRank });

  it('priority names lead, largest first; a null cap (a backstop row) sits last among them; then everyone else by cap', () => {
    const rows = [row('SMALLPRI', 40e9, 30), row('V', 600e9, null), row('BIGPRI', 3e12, 50), row('NULLPRI', null, 0), row('MID', 90e9, null)];
    expect(selectEarnings(rows, 8).listed.map((e) => e.symbol)).toEqual(['BIGPRI', 'SMALLPRI', 'NULLPRI', 'V', 'MID']);
  });

  it('the cut keeps the most important: a $600B non-priority name loses to any priority name when the list is full', () => {
    const rows = [row('V', 600e9, null), ...Array.from({ length: 8 }, (_, i) => row(`P${i}`, 50e9 + i, 40 + i))];
    const { listed, more } = selectEarnings(rows, 8);
    expect(listed.map((e) => e.symbol)).not.toContain('V');
    expect(more).toBe(1);
  });

  it('the real feed sends no market cap: every row is a backstop row, and the priority list\'s order decides — not the date', () => {
    // Positions in the fetcher's list: AAPL 0, MSFT 1, GOOGL 2, AMZN 4, META 5, JPM 20, LLY 44, XOM 99, KBH 120.
    const rows = [row('KBH', null, 120, '2026-10-27'), row('XOM', null, 99, '2026-10-27'), row('LLY', null, 44, '2026-10-27'), row('JPM', null, 20, '2026-10-27'),
      row('META', null, 5, '2026-10-29'), row('AMZN', null, 4, '2026-10-30'), row('GOOGL', null, 2, '2026-10-29'), row('MSFT', null, 1, '2026-10-29'), row('AAPL', null, 0, '2026-10-30')];
    expect(selectEarnings(rows, 8).listed.map((e) => e.symbol)).toEqual(['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'JPM', 'LLY', 'XOM']);
    expect(selectEarnings(rows, 8).more).toBe(1);
  });

  it('ties fall back to date, then symbol, so the order never depends on the feed\'s order', () => {
    const a = [row('BBB', 50e9, null, '2026-10-29'), row('AAA', 50e9, null, '2026-10-29'), row('CCC', 50e9, null, '2026-10-27')];
    expect(selectEarnings(a, 8).listed.map((e) => e.symbol)).toEqual(['CCC', 'AAA', 'BBB']);
    expect(selectEarnings([...a].reverse(), 8).listed.map((e) => e.symbol)).toEqual(['CCC', 'AAA', 'BBB']);
  });

  it('a malformed priorityRank reads as not on the list', () => {
    const rows = [row('NEG', null, -1), row('STR', null, '3'), row('FRAC', null, 1.5), row('OK', null, 7)];
    expect(selectEarnings(rows, 8).listed.map((e) => e.symbol)).toEqual(['OK', 'FRAC', 'NEG', 'STR']);
  });

  it('is defensive: no array, junk rows, rows without ranking fields', () => {
    expect(selectEarnings(undefined, 8)).toEqual({ listed: [], more: 0 });
    expect(selectEarnings([null, 1, 'x', { significance: 'high' }], 8).listed).toEqual([{ significance: 'high' }]);
    expect(() => build({ thisWeekEarnings: [null, { significance: 'high' }] })).not.toThrow();
  });

  it('does not reorder or mutate the caller\'s array', () => {
    const rows = [row('A', 1e11, false), row('B', 2e11, false)];
    const copy = JSON.parse(JSON.stringify(rows));
    selectEarnings(rows, 1);
    expect(rows).toEqual(copy);
  });
});

describe('the macro calendar renders as before (it is already bounded)', () => {
  it('this week in full, next week\'s first five', () => {
    const next = Array.from({ length: 7 }, (_, i) => ({ date: `2026-11-0${i + 2}`, day: 'Monday', event: `Next ${i}`, impact: 'high' }));
    const { userPrompt } = build({ nextWeekEvents: next });
    expect(section(userPrompt, 'ECONOMIC CALENDAR — THIS WEEK')).toEqual([
      '- 2026-10-27 (Tue) 10:00 AM ET — Consumer Confidence (October)',
      '- 2026-10-28 (Wed) 2:00 PM ET — FOMC rate decision [HIGH]',
      '- 2026-10-29 (Thu) 8:30 AM ET — GDP Q3 2026 advance estimate [HIGH]',
      '- 2026-10-29 (Thu) 8:30 AM ET — Initial Jobless Claims',
      '- 2026-10-30 (Fri) 8:30 AM ET — PCE (September) [HIGH]',
    ]);
    expect(section(userPrompt, 'ECONOMIC CALENDAR — NEXT WEEK')).toHaveLength(5);
  });
});

describe('the instructions: the most important events, up to 10, and still none invented', () => {
  const { systemPrompt } = build();
  const keyEventsDescription = DAILY_REGIME_BRIEF_TOOL.input_schema.properties.keyEvents.description;
  const whyDescription = DAILY_REGIME_BRIEF_TOOL.input_schema.properties.keyEvents.items.properties.whyItMatters.description;

  it('the old "list every event" orders are gone', () => {
    for (const text of [systemPrompt, keyEventsDescription]) {
      expect(text).not.toMatch(/If (it|the calendar) (has|shows) 5,? return 5/i);
      expect(text).not.toMatch(/do not omit|invent, omit/i);
      expect(text).not.toMatch(/Render every/i);
    }
    expect(systemPrompt).not.toMatch(/not curate, select/i);
  });

  it('asks for the most important events up to 10, in the schema and in the system prompt alike', () => {
    expect(keyEventsDescription).toMatch(/most important events .* up to 10\b/);
    expect(systemPrompt).toMatch(/most important events, up to 10\b/);
  });

  it('keeps the guard: only listed lines, never invented, and the count line is not an event', () => {
    for (const text of [systemPrompt, keyEventsDescription]) {
      expect(text).toMatch(/do not invent/i);
      expect(text).toMatch(/\+K more not listed" line is a count, not an event/);
    }
    expect(systemPrompt).toMatch(/must appear verbatim as a listed line of the calendar/);
    expect(systemPrompt).toMatch(/copy the eventDate verbatim/);
  });

  it('tightens whyItMatters to ~90 characters', () => {
    expect(whyDescription).toMatch(/~90 characters max/);
    expect(whyDescription).not.toMatch(/140/);
    expect(systemPrompt).toMatch(/~90 characters/);
  });

  it('the tool schema keeps its three required fields and their order (brief, keyEvents, themes)', () => {
    expect(DAILY_REGIME_BRIEF_TOOL.name).toBe('submit_daily_regime_brief');
    expect(DAILY_REGIME_BRIEF_TOOL.input_schema.required).toEqual(['brief', 'keyEvents', 'themes']);
    expect(Object.keys(DAILY_REGIME_BRIEF_TOOL.input_schema.properties)).toEqual(['brief', 'keyEvents', 'themes']);
  });
});
