// src/components/Forge/Watchlist/researchLine.test.js
//
// Pilot P2 — the Forge's research line (ideaCopy.js): the build prompt's
// approve-by-default copy, verbatim; only the stages a record HAS, in pipeline
// order, every number from the record (BUILD_RULES §9); a null stage is never
// shown as 0; the state said only when the research did not complete; no
// table-E vocabulary.

import { describe, it, expect } from 'vitest';
import {
  RESEARCH_COPY, STAGE_LABELS, DIALOGUE_SHORTLIST_LABEL, RESEARCH_LINES_MAX, researchLineOf, researchStateOf, researchLinesOf,
} from './ideaCopy';
import { RESEARCH_STAGES } from '../../../constants/researchRecords';

const nulls = Object.fromEntries(RESEARCH_STAGES.map((k) => [k, null]));
const summary = (origin, stages, state = 'completed', id = `id-${origin}`) => ({ researchWorkId: id, origin, stages: { ...nulls, ...stages }, state });

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
  it('a word for every stage', () => {
    expect(Object.keys(STAGE_LABELS).sort()).toEqual([...RESEARCH_STAGES].sort());
  });
});

describe('researchLineOf — present stages only, in pipeline order, from the record', () => {
  it('screener: "[n] screened · [n] matched · [n] returned · [n] kept"', () => {
    expect(researchLineOf(summary('screener', { universeSize: 503, matchedPreLimit: 41, shortlisted: 25, eligible: 25 })))
      .toBe('Researched with your agent: 503 screened · 41 matched · 25 returned · 25 kept');
  });
  it('dialogue: the shortlist is its candidates', () => {
    expect(researchLineOf(summary('signaldrop', { shortlisted: 6, selectedForInvestigation: 4, eligible: 4 })))
      .toBe(`Researched with your agent: 6 ${DIALOGUE_SHORTLIST_LABEL} · 4 selected · 4 kept`);
    expect(researchLineOf(summary('theme', { shortlisted: 3, selectedForInvestigation: 3, eligible: 0 })))
      .toBe('Researched with your agent: 3 candidates · 3 selected · 0 kept');
  });
  it('analysis: selected · investigated — nothing it does not have', () => {
    expect(researchLineOf(summary('analysis', { selectedForInvestigation: 12, investigationsCompleted: 10 }, 'open')))
      .toBe('Researched with your agent: 12 selected · 10 investigated');
  });
  it('a null stage is never shown — not as 0, not at all; a record with none has no line (manual)', () => {
    expect(researchLineOf(summary('manual', {}))).toBeNull();
    expect(researchLineOf(summary('screener', { universeSize: 0, matchedPreLimit: 0, shortlisted: 0, eligible: 0 })))
      .toBe('Researched with your agent: 0 screened · 0 matched · 0 returned · 0 kept'); // a zero the record HOLDS is shown
    expect(researchLineOf({ origin: 'screener', stages: { universeSize: 'x', eligible: -1, shortlisted: 2.5 } })).toBeNull();
    expect(researchLineOf(null)).toBeNull();
  });
});

describe('researchStateOf and researchLinesOf', () => {
  it('open → still open; abandoned or failed → ended early; completed → nothing', () => {
    expect(researchStateOf({ state: 'open' })).toBe('Research still open');
    expect(researchStateOf({ state: 'abandoned' })).toBe('Research ended early');
    expect(researchStateOf({ state: 'failed' })).toBe('Research ended early');
    expect(researchStateOf({ state: 'completed' })).toBeNull();
  });
  it('one entry per record that has a line, in the server\'s order (newest first), at most three', () => {
    const list = [
      summary('analysis', { selectedForInvestigation: 2, investigationsCompleted: 1 }, 'open', 'a1'),
      summary('manual', {}, 'completed', 'm1'),
      summary('screener', { universeSize: 6, matchedPreLimit: 4, shortlisted: 3, eligible: 2 }, 'completed', 's1'),
      summary('analysis', { selectedForInvestigation: 2, investigationsCompleted: 2 }, 'open', 'a2'),
      summary('analysis', { selectedForInvestigation: 3, investigationsCompleted: 3 }, 'open', 'a3'),
    ];
    const lines = researchLinesOf(list);
    expect(lines.map((l) => l.id)).toEqual(['a1', 's1', 'a2']);
    expect(lines).toHaveLength(RESEARCH_LINES_MAX);
    expect(lines[0]).toEqual({ id: 'a1', line: 'Researched with your agent: 2 selected · 1 investigated', state: 'Research still open' });
    expect(researchLinesOf(undefined)).toEqual([]);
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
