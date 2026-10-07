// src/components/Forge/Watchlist/researchLine.test.js
//
// Pilot P2 — the Forge's research line (ideaCopy.js): the build prompt's
// approve-by-default copy, verbatim; each origin's own stages, in pipeline
// order, every number from the record (BUILD_RULES §9); a null stage is never
// shown as 0; a record no model turn completed is never "researched with your
// agent" (reviews R4-1 / R1-3); the list's own research is never pushed out by
// analysis sessions (R4-1 / R1-4); a record whose subject is another list
// lends this list nothing (R4-4 / R1-1); the "no research" line only when it
// is literally true (R4-7); no table-E vocabulary.

import { describe, it, expect } from 'vitest';
import {
  RESEARCH_COPY, STAGE_LABELS, LINE_STAGES, DIALOGUE_SHORTLIST_LABEL, RESEARCH_LINES_MAX,
  researchLineOf, researchStateOf, researchLinesOf, noResearchRecorded,
} from './ideaCopy';
import { RESEARCH_STAGES, RESEARCH_ORIGINS, STAGES_BY_ORIGIN } from '../../../constants/researchRecords';

const nulls = Object.fromEntries(RESEARCH_STAGES.map((k) => [k, null]));
const summary = (origin, stages, { state = 'completed', id = `id-${origin}`, completions = 1, watchlistId = 'wl-1' } = {}) => ({
  researchWorkId: id, origin, watchlistId, stages: { ...nulls, ...stages }, completions, state,
});

describe('the copy, as the build prompt gives it', () => {
  it('lead, states, the player-marked label and the empty line', () => {
    expect(RESEARCH_COPY).toEqual({
      lead: 'Researched with your agent:',
      stillOpen: 'Research still open',
      endedEarly: 'Research ended early',
      playerMarked: 'You marked this researched.',
      none: 'No research recorded for this idea yet.',
    });
  });
  it('a word for every stage; each origin\'s line shows only stages that origin has', () => {
    expect(Object.keys(STAGE_LABELS).sort()).toEqual([...RESEARCH_STAGES].sort());
    expect(Object.keys(LINE_STAGES).sort()).toEqual([...RESEARCH_ORIGINS].sort());
    for (const origin of RESEARCH_ORIGINS) {
      for (const k of LINE_STAGES[origin]) expect(STAGES_BY_ORIGIN[origin], `${origin}.${k}`).toContain(k);
    }
  });
});

describe('researchLineOf — the origin\'s stages that the record holds, in pipeline order', () => {
  it('screener: "[n] screened · [n] matched · [n] returned · [n] kept"', () => {
    expect(researchLineOf(summary('screener', { universeSize: 503, matchedPreLimit: 41, shortlisted: 25, eligible: 25 })))
      .toBe('Researched with your agent: 503 screened · 41 matched · 25 returned · 25 kept');
  });
  it('dialogue: the approved example exactly — "[n] candidates · [n] kept" (the record keeps its selection; the line does not repeat it)', () => {
    expect(researchLineOf(summary('signaldrop', { shortlisted: 6, selectedForInvestigation: 4, eligible: 4 })))
      .toBe(`Researched with your agent: 6 ${DIALOGUE_SHORTLIST_LABEL} · 4 kept`);
    expect(researchLineOf(summary('theme', { shortlisted: 3, selectedForInvestigation: 3, eligible: 0 })))
      .toBe('Researched with your agent: 3 candidates · 0 kept');
  });
  it('analysis: the set and the members with data — never "investigated"', () => {
    expect(researchLineOf(summary('analysis', { selectedForInvestigation: 12, investigationsCompleted: 10 }, { state: 'open' })))
      .toBe('Researched with your agent: 12 in the set · 10 with data');
  });
  it('no line when there is nothing researched WITH the agent: zero completed model turns, a manual record, a screener record with no recorded screen', () => {
    expect(researchLineOf(summary('analysis', { selectedForInvestigation: 3, investigationsCompleted: 2 }, { completions: 0 }))).toBeNull();
    expect(researchLineOf(summary('analysis', { selectedForInvestigation: 3, investigationsCompleted: 2 }, { completions: null }))).toBeNull();
    expect(researchLineOf(summary('manual', {}))).toBeNull();
    expect(researchLineOf(summary('screener', { universeSize: 0, matchedPreLimit: 0, shortlisted: 0, eligible: 3 }))).toBeNull();
  });
  it('a null or malformed stage is never shown — not as 0, not at all', () => {
    expect(researchLineOf(summary('screener', { universeSize: 6, matchedPreLimit: null, shortlisted: 2.5, eligible: 'x' })))
      .toBe('Researched with your agent: 6 screened');
    expect(researchLineOf(null)).toBeNull();
  });
});

describe('researchStateOf', () => {
  it('open → still open; abandoned or failed → ended early; completed → nothing', () => {
    expect(researchStateOf({ state: 'open' })).toBe('Research still open');
    expect(researchStateOf({ state: 'abandoned' })).toBe('Research ended early');
    expect(researchStateOf({ state: 'failed' })).toBe('Research ended early');
    expect(researchStateOf({ state: 'completed' })).toBeNull();
  });
});

describe('researchLinesOf — the list\'s own research first, then at most its newest worked analysis', () => {
  const screener = summary('screener', { universeSize: 6, matchedPreLimit: 4, shortlisted: 3, eligible: 2 }, { id: 's1' });
  const analysis = (id, completions = 1) => summary('analysis', { selectedForInvestigation: 3, investigationsCompleted: 2 }, { id, completions, state: 'open' });
  it('any number of analysis opens never pushes the list\'s own research out', () => {
    // The server's order: own research first, then analysis newest first.
    const lines = researchLinesOf([screener, analysis('a3'), analysis('a2'), analysis('a1')], { watchlistId: 'wl-1' });
    expect(lines.map((l) => l.id)).toEqual(['s1', 'a3']);
    expect(lines).toHaveLength(RESEARCH_LINES_MAX);
    expect(lines[1]).toEqual({ id: 'a3', line: 'Researched with your agent: 3 in the set · 2 with data', state: 'Research still open' });
  });
  it('opened-and-left analysis sessions (no completed turn) make no line; the newest WORKED one does', () => {
    expect(researchLinesOf([screener, analysis('a3', 0), analysis('a2', 2), analysis('a1')], { watchlistId: 'wl-1' }).map((l) => l.id)).toEqual(['s1', 'a2']);
    expect(researchLinesOf([analysis('a3', 0), analysis('a2', 0)], { watchlistId: 'wl-1' })).toEqual([]);
  });
  it('a record whose subject is ANOTHER list lends this list nothing', () => {
    expect(researchLinesOf([{ ...screener, watchlistId: 'wl-0' }], { watchlistId: 'wl-1' })).toEqual([]);
  });
  it('no research at all → no lines', () => {
    expect(researchLinesOf(undefined)).toEqual([]);
    expect(researchLinesOf(null, { watchlistId: 'wl-1' })).toEqual([]);
  });
});

describe('noResearchRecorded — only when literally true, about an idea that exists', () => {
  const draft = { version: 1, status: 'draft', stateReason: 'player_authored' };
  it('the server answered with NO record for the list, and a current version exists', () => {
    expect(noResearchRecorded([], draft)).toBe(true);
  });
  it('not when the answer did not carry research at all (unknown is never "none")', () => {
    expect(noResearchRecorded(null, draft)).toBe(false);
    expect(noResearchRecorded(undefined, draft)).toBe(false);
  });
  it('not when the list has any record (a manual list has its own), not without an idea, not beside a dialogue-researched version', () => {
    expect(noResearchRecorded([summary('manual', {})], draft)).toBe(false);
    expect(noResearchRecorded([], null)).toBe(false);
    expect(noResearchRecorded([], { version: 1, status: 'researched', stateReason: 'dialogue_completed' })).toBe(false);
  });
});

describe('table E — forbidden vocabulary appears nowhere in the research words', () => {
  const FORBIDDEN = [
    /\bhedge/i, /\btrim/i, /\bpartial/i, /\bscale (in|out)\b/i, /take some off/i, /cash position/i, /move to cash/i,
    /sit in cash/i, /wait for the market to/i, /probably|likely fine/i, /guaranteed/i, /can'?t lose/i,
  ];
  it('no string matches a forbidden term', () => {
    const all = [...Object.values(RESEARCH_COPY), ...Object.values(STAGE_LABELS), DIALOGUE_SHORTLIST_LABEL];
    expect(all.flatMap((s) => FORBIDDEN.filter((re) => re.test(s)).map((re) => `${re} in "${s}"`))).toEqual([]);
  });
});
