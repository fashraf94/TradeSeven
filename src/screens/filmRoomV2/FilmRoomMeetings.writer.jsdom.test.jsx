// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomMeetings.writer.jsdom.test.jsx
//
// Film Room B2.1 A1 — STUDY'S MEETINGS (Build B spec §3 T2; acceptance H;
// Amendment J RJ-1), on tapes the REAL close and candle passes write: each
// meeting with its created, deadline and resolved instants, its outcome and
// who resolved it, its legs, and its diagnosis as an R7 quotation credited
// "— the platform" at the meeting's createdAt; a day with none says so in one
// line under its coverage line; a tape with no meetings section says THAT. The
// check strip's run of "plan pending · awaiting approval" checks is a door to
// its meeting when the INSTANTS match — never the day alone.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the REAL passes, never mocked;
// only the writer flag is mocked on (spreading the real module).

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import React from 'react';

vi.mock('../../config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return true; },
}));

import FilmRoomScreenV2 from './FilmRoomScreenV2';
import { meetingOfRun, checkRuns, meetingAnchor } from './filmRoomModel';
import { sep23Day, sep23Bars, buildTapeDay, SEP23, SEP23_NIGHT, SEP23_MORNING } from '../../../api/_utils/filmTape/__fixtures__/screenFixtures.js';
import { sessionRows } from '../../../api/_utils/filmTape/__fixtures__/tapeBars.js';
import {
  mounter, battleOf, readersOf, NOW, sep23Tape, clone, sweepNumbers, sweepWords, sweepSigns, quoteDefects, storedNoteDefects,
} from './__fixtures__/filmRoomHarness';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

const m = mounter();
beforeEach(() => { globalThis.localStorage.clear(); m.setup(); });
afterEach(() => m.teardown());

// The fixture day's checks: 14:15:20Z plan created, 14:30:20Z–15:45:20Z six checks "plan pending · awaiting approval".
const DIAGNOSIS_1 = '3 consecutive losing trades. Last 3 swaps all resulted in negative points.';
const DIAGNOSIS_2 = 'Technology sector dragging performance (2.1% loss, 40% of total negative P&L).';
const MEETING_1 = {
  id: 'gpm_a1', createdAt: `${SEP23}T14:15:10.000Z`, diagnosis: DIAGNOSIS_1, opportunity: 'Technology has momentum.',
  proposedAction: 'rotate_sector', fromSector: null, toSectors: ['Technology'],
  suggestedSwaps: [{ symbolOut: 'INTC', symbolIn: 'ORCL', rationale: 'INTC down 1.2%, ORCL (Technology) has tech score 71.' }],
  status: 'approved', expiresAt: `${SEP23}T16:15:00.000Z`, resolvedAt: `${SEP23}T15:52:00.000Z`, resolvedBy: 'coach',
};
const MEETING_2 = {
  id: 'gpm_a2', createdAt: `${SEP23}T17:20:00.000Z`, diagnosis: DIAGNOSIS_2, opportunity: 'Industrials has momentum.',
  proposedAction: 'rotate_sector', fromSector: 'Technology', toSectors: ['Technology'],
  suggestedSwaps: [{ symbolOut: 'AMD', symbolIn: 'ORCL', rationale: 'AMD down 2.1%.' }],
  status: 'rejected', expiresAt: `${SEP23}T20:00:00.000Z`, resolvedAt: `${SEP23}T17:31:00.000Z`, resolvedBy: 'coach',
};
const ROSTER = Object.freeze({ star: [{ symbol: 'INTC' }, { symbol: 'AMD' }], core: [], support: [], bench: { stocks: [{ symbol: 'ORCL' }], crypto: null } });

async function writtenDay(history, battleId) {
  const fx = await sep23Day({ battleId });
  fx.battle.portfolio = { ...fx.battle.portfolio, ...ROSTER };
  fx.battle.gameplanMeetingHistory = history;
  const bars = { ...sep23Bars(), ORCL: sessionRows(SEP23, () => 181.2, { volume: 1500 }) };
  const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const out = await buildTapeDay(fx, { night: SEP23_NIGHT, morning: SEP23_MORNING, bars });
  errSpy.mockRestore();
  return out;
}
let both;
let lateOnly;
beforeAll(async () => {
  both = await writtenDay([MEETING_1, MEETING_2], 'b-meet-a1');
  lateOnly = await writtenDay([MEETING_2], 'b-meet-a1-late');
});

async function open(tape, series, label) {
  m.teardown(); m.setup(); globalThis.localStorage.clear();
  m.render(<FilmRoomScreenV2 battle={battleOf(tape)} onBack={() => {}} viewerId="viewer-1" readers={readersOf({ [tape.etDate]: tape }, series)} nowMs={NOW} />);
  await m.flush();
  if (label !== 'Glance') { m.click(m.tab(label)); await m.flush(); }
}
const docsOf = (day) => ({ tape: day.tape, battle: battleOf(day.tape), ...Object.fromEntries((day.series || []).map((s) => [`series:${s.symbol}`, s])) });
const clean = (docs, where) => {
  expect(sweepNumbers(m.container, docs), where).toEqual([]);
  expect(sweepWords(m.container, docs), where).toEqual([]);
  expect(sweepSigns(m.container), where).toEqual([]);
  expect(quoteDefects(m.container, docs), where).toEqual([]);
  expect(storedNoteDefects(m.container, docs), where).toEqual([]);
};

describe('the writer\'s meetings (the precondition)', () => {
  it('both meetings are on the tape, in creation order, with their legs and words', () => {
    expect(both.tape.meetings.map((x) => [x.status, x.resolvedBy, x.legs, x.diagnosis])).toEqual([
      ['approved', 'coach', [{ symbolOut: 'INTC', symbolIn: 'ORCL' }], DIAGNOSIS_1],
      ['rejected', 'coach', [{ symbolOut: 'AMD', symbolIn: 'ORCL' }], DIAGNOSIS_2],
    ]);
    expect(both.tape.coverage.meetings).toMatchObject({ status: 'complete', note: null });
  });
});

describe('acceptance H — a meeting renders with its legs, outcome and instants, and its words as a quotation', () => {
  it('Study: each meeting card — created, deadline (as recorded) and resolved; the outcome and its resolver as stored; the legs; the diagnosis quoted, credited "the platform" at createdAt', async () => {
    await open(both.tape, both.series, 'Study');
    const sec = m.q('#meetings');
    expect(sec).not.toBeNull();
    expect(sec.querySelector('[data-coverage]').getAttribute('data-coverage')).toBe('complete');
    const cards = m.qa('[data-meeting-card]');
    expect(cards.map((c) => c.id)).toEqual(['meeting-1', 'meeting-2']);
    const first = cards[0].textContent;
    expect(first).toContain('Meeting · 10:15 AM');
    expect(first).toContain('approved');
    expect(first).toContain('resolved by coach');
    expect(first).toContain('Created10:15 AM');
    expect(first).toContain('Deadline, as recorded12:15 PM');
    expect(first).toContain('Resolved11:52 AM');
    expect(cards[0].querySelector('[data-meeting-legs]').textContent).toBe('INTC → ORCL');
    expect(cards[0].querySelector('[data-meeting-outcome]').getAttribute('data-meeting-outcome')).toBe('approved');
    expect(cards[1].querySelector('[data-meeting-outcome]').getAttribute('data-meeting-outcome')).toBe('rejected');
    const q = cards[0].querySelector('[data-quotation="platform"]');
    expect(q.querySelector('[data-quote-path]').getAttribute('data-quote-path')).toBe('meetings[0].diagnosis');
    expect(q.querySelector('[data-quote-path]').textContent).toBe(DIAGNOSIS_1);
    expect(q.querySelector('[data-quote-attribution]').textContent).toBe('— the platform · 10:15 AM');
    clean(docsOf(both), 'Study');
  });

  it('the diagnosis\'s numbers are exempt only as the bound quotation: the same words outside it are stray digits (the mutant: the diagnosis rendered outside a quotation)', async () => {
    await open(both.tape, both.series, 'Study');
    const docs = docsOf(both);
    expect(sweepNumbers(m.container, docs)).toEqual([]);
    const p = document.createElement('p');
    p.textContent = DIAGNOSIS_1;
    m.q('#meetings').appendChild(p);
    expect(sweepNumbers(m.container, docs).some((d) => d.startsWith('stray digit'))).toBe(true);
  });

  it('nothing says whether a proposal was right: no verdict word in the section (the own-voice sweep), and no score or price inside it', async () => {
    await open(both.tape, both.series, 'Study');
    const sec = m.q('#meetings');
    expect(sweepWords(sec, docsOf(both))).toEqual([]);
    expect(sec.querySelectorAll('[data-num], [data-num-aggregate]')).toHaveLength(0);
    for (const w of ['right', 'wrong', 'correct', 'should']) expect(sec.textContent.toLowerCase()).not.toMatch(new RegExp(`\\b${w}\\b`));
  });

  it('a day with no meetings says so in one line, under its coverage line (R1) — the committed Sep-23 fixture', async () => {
    await open(sep23Tape, [], 'Study');
    const sec = m.q('#meetings');
    expect(sec.querySelector('[data-coverage]').getAttribute('data-coverage')).toBe('complete');
    expect(sec.textContent).toContain('No gameplan meeting was created this day.');
    expect(sec.querySelectorAll('[data-meeting-card]')).toHaveLength(0);
  });

  it('a tape with no meetings section (written before they were taped): the absence, said as one — no coverage line, no "no meeting" claim (R14)', async () => {
    const t = clone(sep23Tape);
    delete t.meetings;
    delete t.coverage.meetings;
    await open(t, [], 'Study');
    const sec = m.q('#meetings');
    expect(sec.textContent).toContain("This day's tape has no meetings section.");
    expect(sec.querySelector('[data-coverage]')).toBeNull();
    expect(sec.textContent).not.toContain('No gameplan meeting was created this day.');
  });

  it('a partial section: its stored reason, verbatim, on the coverage line', async () => {
    const t = clone(both.tape);
    t.coverage.meetings = { ...t.coverage.meetings, status: 'partial', note: "1 leg symbol outside the battle's portfolio and bench not copied" };
    t.meetings[0].legs = [{ symbolOut: 'INTC', symbolIn: null }];
    await open(t, both.series, 'Study');
    const sec = m.q('#meetings');
    expect(sec.querySelector('[data-coverage]').getAttribute('data-coverage')).toBe('partial');
    expect(sec.querySelector('[data-stored-note="coverage.meetings.note"]').textContent).toBe("1 leg symbol outside the battle's portfolio and bench not copied");
    expect(m.q('[data-meeting-legs="0"]').textContent).toBe('INTC → not copied');
  });
});

describe('the "awaiting approval" run links to its meeting when the INSTANTS match', () => {
  it('meetingOfRun: inside the meeting\'s life (created ≤ the run\'s first check ≤ resolved, else the deadline); never by the day alone', () => {
    const run = checkRuns(both.tape).find((r) => r.group === 'gameplan_pending');
    expect(run).toMatchObject({ from: `${SEP23}T14:30:20.000Z`, to: `${SEP23}T15:45:20.000Z` });
    expect(meetingOfRun(both.tape, run)).toBe(0);
    expect(meetingOfRun(lateOnly.tape, run)).toBeNull();   // the same day, a later meeting: no link
    const t = clone(both.tape);
    t.meetings[0].resolvedAt = `${SEP23}T14:30:19.000Z`;   // resolved a second before the run's first check
    expect(meetingOfRun(t, run)).toBeNull();
    t.meetings[0].resolvedAt = null;                         // no resolution recorded: the stored deadline bounds it
    expect(meetingOfRun(t, run)).toBe(0);
    t.meetings[0].expiresAt = null;                          // nothing bounds its life: no match
    expect(meetingOfRun(t, run)).toBeNull();
    expect(meetingOfRun(both.tape, checkRuns(both.tape).find((r) => r.group === 'completed'))).toBeNull();
  });

  it('Glance: the run carries "Its meeting"; it opens Study at that meeting\'s card', async () => {
    await open(both.tape, both.series, 'Glance');
    const link = m.q('[data-run="gameplan_pending"] [data-run-meeting]');
    expect(link.getAttribute('data-run-meeting')).toBe('0');
    expect(link.textContent).toBe('Its meeting');
    expect(m.qa('[data-run-meeting]')).toHaveLength(1);
    clean(docsOf(both), 'Glance');
    m.click(link.querySelector('button'));
    await m.flush();
    expect(m.tab('Study').getAttribute('aria-selected')).toBe('true');
    expect(m.q(`#${meetingAnchor(0)}`)).not.toBeNull();
    // A8 (A2F2-5): the door changed the depth — the meeting's card takes the focus, never the page
    expect(document.activeElement).toBe(m.q(`#${meetingAnchor(0)}`));
  });

  it('the same day whose only meeting came after the run: no link (the mutant: a match by date alone)', async () => {
    await open(lateOnly.tape, lateOnly.series, 'Glance');
    expect(m.q('[data-run="gameplan_pending"]')).not.toBeNull();
    expect(m.qa('[data-run-meeting]')).toHaveLength(0);
  });
});
