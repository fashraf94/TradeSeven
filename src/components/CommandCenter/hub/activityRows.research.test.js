// src/components/CommandCenter/hub/activityRows.research.test.js
//
// Command Center core spec V1.2, Amendment E V1.1 §3.3 — Activity's research rows, from the research reader's records only:
// "Research opened" (createdAt, the question clipped as its sub), "Research concluded" and "Idea saved from research"
// (endedAt). An abandoned investigation has its opened row only; a record of another origin yields none; each row carries its
// session id; the rows sit under the same cutoff and order rules as every other kind.

import { describe, expect, it } from 'vitest';
import { HUB_COPY as COPY } from './hubCopy';
import { ACTIVITY_KINDS, RESEARCH_QUESTION_CLIP, activitySectionOf, deriveActivity } from './activityRows';
import { SHARED_RESEARCH_ORIGIN as MODEL_ORIGIN, TERMINAL_REASONS } from '../../../../api/_utils/researchRecords/model.js';

const NOW = Date.UTC(2026, 10, 14, 18, 0);
const iso = (ms) => new Date(ms).toISOString();
const HOUR = 3600 * 1000;

const record = (sessionId, over = {}) => ({
  id: `sr_${sessionId}`, origin: 'shared_research', state: 'open', host: { collection: 'sharedResearchSessions', id: sessionId },
  question: 'Which grid suppliers earn from the switchgear backlog?', createdAt: iso(NOW - 5 * HOUR), endedAt: null, terminalReason: null, findings: [], ...over,
});
const rows = (research, over = {}) => deriveActivity({ battles: [], live: [], rowsById: new Map(), research, nowMs: NOW, ...over }).rows;
const ids = (list) => list.map((r) => r.id);

describe('the three rows (amendment §3.3)', () => {
  it('an open investigation: its opened row, at createdAt, with the question as its sub and the session id', () => {
    const [row] = rows([record('s1')]);
    expect(row).toMatchObject({ id: 'research.opened:s1', kind: ACTIVITY_KINDS.RESEARCH, text: COPY.activity.researchOpened, sub: 'Which grid suppliers earn from the switchgear backlog?', sessionId: 's1', ms: NOW - 5 * HOUR });
    expect(row.battleId).toBeUndefined();
  });

  it('a concluded investigation: opened at createdAt and concluded at endedAt', () => {
    const list = rows([record('s1', { state: 'completed', terminalReason: 'concluded', endedAt: iso(NOW - HOUR) })]);
    expect(ids(list)).toEqual(['research.concluded:s1', 'research.opened:s1']);
    expect(list[0]).toMatchObject({ text: COPY.activity.researchConcluded, ms: NOW - HOUR, sessionId: 's1', sub: '' });
  });

  it('an investigation saved as an idea: opened, and "Idea saved from research" at endedAt', () => {
    const list = rows([record('s1', { state: 'completed', terminalReason: 'saved_to_list', endedAt: iso(NOW - HOUR) })]);
    expect(ids(list)).toEqual(['research.saved:s1', 'research.opened:s1']);
    expect(list[0]).toMatchObject({ text: COPY.activity.ideaFromResearch, sessionId: 's1' });
  });

  it('an abandoned investigation has its opened row only', () => {
    expect(ids(rows([record('s1', { state: 'abandoned', terminalReason: 'user_close', endedAt: iso(NOW - HOUR) })]))).toEqual(['research.opened:s1']);
  });

  it('the terminal reasons are the record model\'s own words', () => {
    expect(TERMINAL_REASONS.concluded).toBe('concluded');
    expect(TERMINAL_REASONS.savedToList).toBe('saved_to_list');
    // the rows' origin is the model's: a record written with the model's own origin word has its rows
    expect(ids(rows([record('s9', { origin: MODEL_ORIGIN })]))).toEqual(['research.opened:s9']);
  });

  it('a record of another origin yields no row, even with a host and times', () => {
    expect(rows([record('s1', { origin: 'screener' }), record('s2', { origin: 'signaldrop', terminalReason: 'saved_to_list', endedAt: iso(NOW - HOUR) })])).toEqual([]);
  });

  it('nothing is invented: no session id, no readable createdAt or endedAt → no row for it', () => {
    expect(rows([record('s1', { host: null })])).toEqual([]);
    expect(rows([record('s1', { createdAt: 'not a time' })])).toEqual([]);
    expect(ids(rows([record('s1', { terminalReason: 'concluded', endedAt: null })]))).toEqual(['research.opened:s1']);
  });

  it('a long question is clipped with an ellipsis; a missing one leaves no sub', () => {
    const long = 'Which '.padEnd(200, 'x');
    const [row] = rows([record('s1', { question: long })]);
    expect(row.sub.length).toBeLessThanOrEqual(RESEARCH_QUESTION_CLIP);
    expect(row.sub.endsWith('…')).toBe(true);
    expect(rows([record('s2', { question: undefined })])[0].sub).toBe('');
  });

  it('the clip counts code points, never splitting a surrogate pair, and a kept newline reads as one space (review C8)', () => {
    const emojiAtCut = `${'a'.repeat(RESEARCH_QUESTION_CLIP - 2)}😀tail of the question`;
    const [row] = rows([record('s1', { question: emojiAtCut })]);
    expect(row.sub).toBe(`${'a'.repeat(RESEARCH_QUESTION_CLIP - 2)}😀…`);
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(row.sub)).toBe(false);
    const [nl] = rows([record('s2', { question: 'Which grid\nsuppliers   earn?' })]);
    expect(nl.sub).toBe('Which grid suppliers earn?');
  });

  it('no research input (null, the reader not admitted or still out) is no rows, and changes nothing else', () => {
    expect(rows(null)).toEqual([]);
    expect(rows(undefined)).toEqual([]);
  });
});

describe('the same cutoff and order as every other kind', () => {
  const done = (id, ms) => ({ id, ownerId: 'uid-A', status: 'completed', completedAt: iso(ms), activatedAt: iso(ms - HOUR) });

  it('nothing older than the oldest completed game of the window', () => {
    const list = rows([record('old', { createdAt: iso(NOW - 48 * HOUR) }), record('new', { createdAt: iso(NOW - HOUR) })], { battles: [done('g1', NOW - 24 * HOUR)] });
    expect(ids(list).filter((id) => id.startsWith('research.'))).toEqual(['research.opened:new']);
  });

  it('newest first across kinds; at an equal time the kind order puts research last', () => {
    const at = NOW - 2 * HOUR;
    const list = rows([record('s1', { createdAt: iso(at) })], { battles: [done('g1', at)] });
    // the game's deploy (an hour earlier) is older than the window's oldest completion, so the cutoff leaves it out
    expect(ids(list)).toEqual(['completed:g1', 'research.opened:s1']);
  });

  it('at one time, the kind order is completed, deployed, loadout, idea, huddle, research — research after the idea and plan rows (review B11)', () => {
    const at = NOW - 3 * HOUR;
    const list = deriveActivity({
      battles: [], live: [], rowsById: new Map(), nowMs: NOW,
      research: [record('s1', { createdAt: iso(at) })],
      idea: { listId: 'wl-1', listName: 'Grid builders', version: 1, createdAt: iso(at), stateChangedAt: null, status: null, statusLabel: null },
      huddle: [{ id: 'huddle-plan:uid-A:2026-11-14', ms: at, kind: 'confirmed', etDate: '2026-11-14' }],
    }).rows;
    expect(ids(list)).toEqual(['idea.created:wl-1:v1', 'huddle-plan:uid-A:2026-11-14', 'research.opened:s1']);
  });

  it('each id once, through the section builder too (the hub\'s path)', () => {
    const section = activitySectionOf({ battles: [], live: [], rowsById: new Map(), research: [record('s1'), record('s1')], nowMs: NOW });
    expect(section.status).toBe('ready');
    expect(ids(section.rows)).toEqual(['research.opened:s1']);
    expect(section.rows[0].sessionId).toBe('s1');
    expect(section.rows[0].at).toMatch(/ ET$/);
  });
});
