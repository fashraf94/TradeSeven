// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomFlow.words.jsdom.test.jsx
//
// Film Room D2 item 7 — THE AGENT'S WORDS ON THE FRONT (D2 spec §1, §8, §9; DW-1, DW-2, DW-9, DW-10), through the real
// shell: the line under its swap pin's fact, bound to the record's `lines[i].text` in the `debrief` document and to the
// swap's tape row key, dated; the panel's three states; the one read — only where the front shows and the words are on
// for the owner, never on the tape view, never under 'off', never for a non-admitted owner; the verdict the flow holds.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.setConfig({ testTimeout: 30_000 });
import React, { act } from 'react';

const flags = vi.hoisted(() => ({ flow: 'allowlist', cards: 'off', debrief: 'allowlist' }));
vi.mock('../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_ROOM_FLOW_MODE() { return flags.flow; },
  get FILM_ROOM_CARDS_MODE() { return flags.cards; },
  get FILM_ROOM_DEBRIEF_MODE() { return flags.debrief; },
}));

import FilmRoomScreenV2 from './FilmRoomScreenV2.jsx';
import { resetFilmRoomVerdicts } from '../../utils/filmRoomGate';
import { mounter, sep23Tape, sep23Series, clone, battleOf, readersOf, NOW, sweepFlow, flowCopyDefects, sweepWords, quoteDefects, debriefWordsDefects, SPEC_DEBRIEF_NOT_YET } from './__fixtures__/filmRoomHarness';

const m = mounter();
beforeEach(() => { flags.flow = 'allowlist'; flags.cards = 'off'; flags.debrief = 'allowlist'; resetFilmRoomVerdicts(); globalThis.localStorage.clear(); m.setup(); });
afterEach(() => m.teardown());

const D = sep23Tape.etDate;
const KEY = Object.fromEntries(sep23Tape.actions.map((a, i) => [`action:${i}`, a.key]));   // 0 MSFT→CRWD (stall), 1 DE→PLTR (the agent's), 2 ETN→PANW
const WRITTEN_AT = '2026-09-24T03:45:12.000Z';                                            // 11:45 PM EDT on Sep 23
const recordOf = (lines, over = {}) => ({
  version: 1, battleId: sep23Tape.battleId, etDate: D, ownerId: 'owner-1', attributionAgentId: 'agent-1', archetype: 'momentum',
  status: 'written', reason: null, writtenAt: WRITTEN_AT, digestVersion: 1, digestHash: 'h', tapeWrittenAt: sep23Tape.writtenAt,
  model: 'claude-sonnet-5-5', usage: { input: 1, output: 1 }, costUsd: 0.000012, attempts: 1, lines, dropped: [], ...over,
});
const LINE_AGENT = { key: KEY['action:1'], label: 's2', text: 'PLTR held into the check, so DE went out on my plan.' };
const LINE_STALL = { key: KEY['action:0'], label: 's1', text: "That wasn't my call: the stall rule took MSFT." };

/** Readers with the debrief reader: `answer` is what it resolves (a record → ready; null → missing; 'error'). */
function wordsReaders(answer, tapes = { [D]: sep23Tape }) {
  const r = readersOf(tapes, sep23Series);
  r.readDebrief = async (battleId, etDate) => {
    r.calls.push(['debrief', battleId, etDate]);
    if (answer === 'error') return { status: 'error', record: null };
    const rec = typeof answer === 'function' ? answer(etDate) : answer;
    return rec ? { status: 'ready', record: rec } : { status: 'missing', record: null };
  };
  return r;
}
const api = (verdict = true) => {
  const calls = [];
  return {
    calls,
    readVerdict: async (id, o) => { calls.push([id, o]); return verdict; },
    readCounter: async () => ({ ok: true, status: 200, body: { cards: [], attributionAgentId: 'agent-1' } }),
    postCard: async () => ({ ok: false, status: 400, body: { error: 'x' } }),
    newOpId: () => 'op_1',
  };
};
const screen = ({ battle = battleOf(sep23Tape, { ownerId: 'owner-1' }), readers, cardsApi = api(), nowMs = NOW } = {}) => (
  <FilmRoomScreenV2 battle={battle} onBack={() => {}} viewerId="viewer-1" readers={readers} nowMs={nowMs} cardsApi={cardsApi} />
);
async function open(props) { m.render(screen(props)); await m.flush(); }
const onFront = () => Boolean(m.q('[data-view="flow"] [data-flow-front]'));
const debriefReads = (r) => r.calls.filter((c) => c[0] === 'debrief');
const words = () => m.qa('[data-flow-said="agent-words"]');
const notYet = () => m.qa('[data-flow-debrief-notyet]');
const panelMember = () => m.q('[data-flow-panel]')?.getAttribute('data-flow-panel-member');
/** Select a member: its group's pin, then the stepper's "Next" until the panel is that member's (a merged group opens on its first). */
const selectMember = (member) => {
  m.click(m.qa('[data-flow-pin]').find((x) => x.getAttribute('data-flow-pin-members').split(' ').includes(member)));
  for (let k = 0; k < 6 && panelMember() !== member; k += 1) m.click(m.buttons('Next')[0]);
};
const allDefects = (record) => {
  const docs = { tape: sep23Tape, battle: battleOf(sep23Tape, { ownerId: 'owner-1' }), debrief: record };
  return [...sweepFlow(m.container, docs), ...flowCopyDefects(m.container), ...sweepWords(m.container, docs), ...quoteDefects(m.container, docs), ...debriefWordsDefects(m.container, docs)];
};

describe('the line (§1): under the swap pin\'s fact, the agent\'s words, quoted and dated', () => {
  it('the opening pin — the agent\'s own swap — shows its line: bound to the record\'s lines[i].text in the `debrief` document, the agent\'s mark beside it, dated "Sep 23"; every oracle clean', async () => {
    const record = recordOf([LINE_STALL, LINE_AGENT]);
    await open({ readers: wordsReaders(record) });
    expect(onFront()).toBe(true);
    expect(panelMember()).toBe('action:1');
    const [w] = words();
    expect(words()).toHaveLength(1);
    const q = w.querySelector('[data-quote-path]');
    expect([q.getAttribute('data-quote-path'), q.getAttribute('data-quote-doc'), q.textContent]).toEqual(['lines[1].text', 'debrief', LINE_AGENT.text]);
    expect(w.querySelector('[data-agent-mark]')).toBeTruthy();
    expect(w.querySelector('[data-flow-debrief-date] [data-time]').textContent).toBe('Sep 23');
    // the attribution is kept for assistive technology — "the agent" at the record's own instant — and hidden visually
    expect(w.querySelector('[data-quote-attribution]').textContent).toBe('— the agent · 11:45 PM');
    expect(allDefects(record)).toEqual([]);
  });
  it('the review\'s P2: never clamped — shown nowhere else, the whole line is the player\'s to read (no clamp, no hidden end)', async () => {
    await open({ readers: wordsReaders(recordOf([LINE_AGENT])) });
    const q = words()[0].querySelector('[data-quote-path]');
    expect(q.hasAttribute('data-collapsed')).toBe(false);
    expect(q.style.webkitLineClamp || q.style.WebkitLineClamp || '').toBe('');
    expect(m.buttons('Read more')).toHaveLength(0);
  });
  it('it sits between the fact line and the link "Open this on the full tape"', async () => {
    await open({ readers: wordsReaders(recordOf([LINE_AGENT])) });
    const panel = m.q('[data-flow-panel]');
    const order = [...panel.querySelectorAll('[data-flow-fact], [data-flow-said="agent-words"], [data-flow-pin-link]')].map((el) => (el.hasAttribute('data-flow-fact') ? 'fact' : el.hasAttribute('data-flow-pin-link') ? 'link' : 'words'));
    expect(order).toEqual(['fact', 'words', 'link']);
  });
  it('each swap shows ITS OWN line: the stall rule\'s swap its line, the agent\'s swap its line — never the other\'s', async () => {
    const record = recordOf([LINE_STALL, LINE_AGENT]);
    await open({ readers: wordsReaders(record) });
    selectMember('action:0');
    expect(panelMember()).toBe('action:0');
    expect(words().map((w) => w.querySelector('[data-quote-path]').textContent)).toEqual([LINE_STALL.text]);
    expect(allDefects(record)).toEqual([]);
  });
  it('a swap the record has no line for: nothing beyond its fact line', async () => {
    await open({ readers: wordsReaders(recordOf([LINE_AGENT])) });
    selectMember('action:0');
    expect([words().length, notYet().length]).toEqual([0, 0]);
  });
  it('a directive pin never shows the words — not even a line that names its key (DW-2)', async () => {
    const dKey = sep23Tape.directives[0].key;
    await open({ readers: wordsReaders(recordOf([LINE_AGENT, { key: dKey, label: 's9', text: 'A directive line.' }])) });
    selectMember('directive:0');
    expect(panelMember()).toBe('directive:0');
    expect([words().length, notYet().length]).toEqual([0, 0]);
  });
  it('a record line whose key the tape no longer holds is not shown', async () => {
    await open({ readers: wordsReaders(recordOf([{ ...LINE_AGENT, key: 'swap:2026-09-23T18:00:05.000Z|DE|XYZ' }])) });
    expect(words()).toHaveLength(0);
  });
  it('a record of another battle or another day is never shown', async () => {
    await open({ readers: wordsReaders(recordOf([LINE_AGENT], { battleId: 'b-other' })) });
    expect(words()).toHaveLength(0);
    m.teardown(); m.setup();
    await open({ readers: wordsReaders(recordOf([LINE_AGENT], { etDate: '2026-09-22' })) });
    expect(words()).toHaveLength(0);
  });
  it('Astra\'s F1 (Amendment F DF-1): a record whose owner is not the tape\'s is never shown — still one read', async () => {
    const r = wordsReaders(recordOf([LINE_AGENT], { ownerId: 'owner-previous' }));
    await open({ readers: r });
    expect([words().length, debriefReads(r).length]).toEqual([0, 1]);
    m.teardown(); m.setup();
    // the control: the same record stamped with the tape's owner shows its line
    await open({ readers: wordsReaders(recordOf([LINE_AGENT], { ownerId: sep23Tape.ownerId })) });
    expect(words()).toHaveLength(1);
  });
});

describe('the states (§1)', () => {
  it('no record yet, before the next run: every swap pin says "Your agent\'s words arrive by the next morning." — a directive pin nothing', async () => {
    const before = Date.parse('2026-09-24T03:00:00.000Z');   // the tape written 02:15:30; the run at 03:45
    await open({ readers: wordsReaders(null), nowMs: before });
    expect(notYet().map((p) => p.textContent)).toEqual([SPEC_DEBRIEF_NOT_YET]);
    selectMember('action:0');
    expect(notYet()).toHaveLength(1);
    selectMember('directive:0');
    expect(notYet()).toHaveLength(0);
    expect(allDefects(null)).toEqual([]);
  });
  it('the window: up to the run plus 30 minutes; at run + 30 minutes, nothing', async () => {
    // a minute before the cutoff (DF-10's timer hides the line AT the cutoff on a page left open, so the mount is given
    // room: the millisecond before it, as this row once read, now lapses while the page renders)
    await open({ readers: wordsReaders(null), nowMs: Date.parse('2026-09-24T04:14:00.000Z') });
    expect(notYet()).toHaveLength(1);
    m.teardown(); m.setup();
    await open({ readers: wordsReaders(null), nowMs: Date.parse('2026-09-24T04:15:00.000Z') });
    expect(notYet()).toHaveLength(0);
  });
  it('Amendment F DF-10 (Astra §9): on a page left open, the line expires AT its cutoff — a display-only timer; no read more', async () => {
    const cutoff = Date.parse('2026-09-24T04:15:00.000Z');   // the 03:45 UTC run + 30 minutes
    // only setTimeout is faked, and it still advances with real time (so the harness's flush runs): the jump to the
    // cutoff is ours, the page's own clock never moves
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
    try {
      const r = wordsReaders(null);
      await open({ readers: r, nowMs: cutoff - 60_000 });
      expect(notYet()).toHaveLength(1);
      await act(async () => { vi.advanceTimersByTime(50_000); });
      expect(notYet()).toHaveLength(1);                       // not before its cutoff
      await act(async () => { vi.advanceTimersByTime(10_500); });
      expect(notYet()).toHaveLength(0);                       // gone at it, on the same mounted page
      selectMember('action:0');
      expect(notYet()).toHaveLength(0);                       // and on every swap pin
      expect(debriefReads(r)).toHaveLength(1);                // the one read, nothing more
      expect(allDefects(null)).toEqual([]);
    } finally { vi.useRealTimers(); }
  });
  it('DF-10: a page left open with a cutoff far ahead keeps the line, and leaving the screen clears its timer', async () => {
    const r = wordsReaders(null);
    await open({ readers: r, nowMs: Date.parse('2026-09-24T03:00:00.000Z') });
    await act(async () => { await new Promise((res) => setTimeout(res, 200)); });
    expect([notYet().length, debriefReads(r).length]).toEqual([1, 1]);
    const cleared = vi.spyOn(globalThis, 'clearTimeout');
    try {
      m.teardown(); m.setup();
      expect(cleared).toHaveBeenCalled();
    } finally { cleared.mockRestore(); }
  });
  it('no record after the next run: nothing beyond the fact line', async () => {
    await open({ readers: wordsReaders(null) });   // NOW is Oct 8
    expect([words().length, notYet().length]).toEqual([0, 0]);
  });
  it('a record that is `nothing` or `failed`: nothing beyond the fact line — whatever lines it might carry', async () => {
    await open({ readers: wordsReaders(recordOf([LINE_AGENT], { status: 'nothing', reason: 'no_lines' })) });
    expect(words()).toHaveLength(0);
    m.teardown(); m.setup();
    await open({ readers: wordsReaders(recordOf([LINE_AGENT], { status: 'failed', reason: 'parse' })) });
    expect([words().length, notYet().length]).toEqual([0, 0]);
  });
  it('a read that fails (not denied, not missing): nothing — never the not-yet line', async () => {
    await open({ readers: wordsReaders('error'), nowMs: Date.parse('2026-09-24T03:00:00.000Z') });
    expect([words().length, notYet().length]).toEqual([0, 0]);
  });
});

describe('the read (§9, DW-10): exactly one, only where the front shows and the words are on for the owner', () => {
  it('one getDoc of agentBattles/{id}/debriefs/{etDate} for the day — selecting pins and opening the tape read nothing more', async () => {
    const r = wordsReaders(recordOf([LINE_AGENT]));
    await open({ readers: r });
    selectMember('action:0'); selectMember('directive:0');
    m.click(m.q('[data-flow-door]')); await m.flush();
    expect(m.q('[data-flow-front]')).toBeNull();
    m.click(m.tab('Study')); await m.flush();
    m.click(m.q('header button')); await m.flush();   // "Game flow": back to the front — the record is kept
    expect(onFront()).toBe(true);
    expect(debriefReads(r)).toEqual([['debrief', sep23Tape.battleId, D]]);
  });
  it('another day: its own one read; back to the first day, none more', async () => {
    const D0 = '2026-09-22';
    const t0 = { ...clone(sep23Tape), etDate: D0, isFinalDay: false };
    t0.battle.status = 'active';
    const r = wordsReaders((d) => recordOf([LINE_AGENT], { etDate: d }), { [D]: sep23Tape, [D0]: t0 });
    await open({ readers: r, battle: battleOf(sep23Tape, { ownerId: 'owner-1', timing: { tradingDays: [D0, D] } }) });
    m.click(m.qa('[data-region="day-picker"] button')[0]); await m.flush();
    m.click(m.qa('[data-region="day-picker"] button')[1]); await m.flush();
    expect(debriefReads(r).map((c) => c[2])).toEqual([D, D0]);
  });
  it("the words 'off': no read, no line, no not-yet line — and the verdict asked as D1 asks it", async () => {
    flags.debrief = 'off';
    const r = wordsReaders(recordOf([LINE_AGENT]));
    const a = api(true);
    await open({ readers: r, cardsApi: a, nowMs: Date.parse('2026-09-24T03:00:00.000Z') });
    expect(onFront()).toBe(true);
    expect([debriefReads(r).length, words().length, notYet().length, a.calls.length]).toEqual([0, 0, 0, 1]);
  });
  it("'allowlist' and the owner NOT admitted (the flow 'on', so the front shows): no read, no words", async () => {
    flags.flow = 'on';
    const r = wordsReaders(recordOf([LINE_AGENT]));
    const a = api(false);
    await open({ readers: r, cardsApi: a });
    expect(onFront()).toBe(true);
    expect([debriefReads(r).length, words().length, a.calls.length]).toEqual([0, 0, 1]);
  });
  it("the flow 'on', the words 'allowlist': the verdict is asked (once) for the words; admitted — one read and the line", async () => {
    flags.flow = 'on';
    const r = wordsReaders(recordOf([LINE_AGENT]));
    const a = api(true);
    await open({ readers: r, cardsApi: a });
    expect([a.calls.length, debriefReads(r).length, words().length]).toEqual([1, 1, 1]);
    expect(a.calls[0]).toEqual([sep23Tape.battleId, { ownerId: 'owner-1' }]);
  });
  it("the flow 'on', the words 'on': no verdict asked at all; one read", async () => {
    flags.flow = 'on'; flags.debrief = 'on';
    const r = wordsReaders(recordOf([LINE_AGENT]));
    const a = api(true);
    await open({ readers: r, cardsApi: a });
    expect([a.calls.length, debriefReads(r).length, words().length]).toEqual([0, 1, 1]);
  });
  it("the flow 'off': no front, so no words, no read, and no verdict asked — whatever the words' mode", async () => {
    flags.flow = 'off'; flags.debrief = 'on';
    const r = wordsReaders(recordOf([LINE_AGENT]));
    const a = api(true);
    await open({ readers: r, cardsApi: a });
    expect(onFront()).toBe(false);
    expect([a.calls.length, debriefReads(r).length]).toEqual([0, 0]);
  });
  it('while the verdict is on its way (the flow \'on\', the words \'allowlist\'): the front shows, nothing is read; the yes then reads once', async () => {
    flags.flow = 'on';
    const r = wordsReaders(recordOf([LINE_AGENT]));
    let answer;
    const a = { ...api(true), readVerdict: () => new Promise((res) => { answer = res; }) };
    await open({ readers: r, cardsApi: a });
    expect([onFront(), debriefReads(r).length, words().length]).toEqual([true, 0, 0]);
    answer(true); await m.flush();
    expect([debriefReads(r).length, words().length]).toEqual([1, 1]);
  });
  it('the verdict belongs to one identity (DD-3): refreshed to another owner, still pending — no words shown', async () => {
    flags.flow = 'on';
    const r = wordsReaders(recordOf([LINE_AGENT]));
    let answerB;
    const a = { ...api(true), readVerdict: (id, o) => (o?.ownerId === 'owner-b' ? new Promise((res) => { answerB = res; }) : Promise.resolve(true)) };
    await open({ readers: r, cardsApi: a, battle: battleOf(sep23Tape, { ownerId: 'owner-1' }) });
    expect(words()).toHaveLength(1);
    m.render(screen({ readers: r, cardsApi: a, battle: battleOf(sep23Tape, { ownerId: 'owner-b' }) }));
    await m.flush();
    expect(words()).toHaveLength(0);
    answerB(false); await m.flush();
    expect(words()).toHaveLength(0);
  });
  it('the review\'s Q2: the read belongs to the identity (DD-3) — a refreshed owner, admitted, reads its own record once', async () => {
    flags.flow = 'on'; flags.debrief = 'on';
    const r = wordsReaders(recordOf([LINE_AGENT]));
    await open({ readers: r, battle: battleOf(sep23Tape, { ownerId: 'owner-1' }) });
    m.render(screen({ readers: r, battle: battleOf(sep23Tape, { ownerId: 'owner-b' }) }));
    await m.flush();
    expect(debriefReads(r)).toHaveLength(2);
  });
  it('a screen opened at a moment never shows the front — and never reads the words', async () => {
    const r = wordsReaders(recordOf([LINE_AGENT]));
    m.render(<FilmRoomScreenV2 battle={battleOf(sep23Tape, { ownerId: 'owner-1' })} onBack={() => {}} viewerId="viewer-1" readers={r} nowMs={NOW} cardsApi={api(true)} openAt={{ battleId: sep23Tape.battleId, etDate: D, moment: { battleId: sep23Tape.battleId, etDate: D, situationId: 'stalled', symbol: 'MSFT', fromTickSeq: 8, toTickSeq: 9 } }} onOpenAtUsed={() => {}} />);
    await m.flush();
    expect([onFront(), debriefReads(r).length]).toEqual([false, 0]);
  });
});

describe('the off path: the words off for the owner — the front is D1\'s', () => {
  // the review's C6: this compares the words 'off' with the words on and nothing to show — the words add nothing else to
  // the front. It is no comparison with D1's own front: that is D1's suites' (moved only by the debrief 'off' pin) and
  // the review's base-tree differential
  it("the same front, byte for byte, whether the words are 'off' or on with nothing to show for this owner's day", async () => {
    flags.debrief = 'off';
    await open({ readers: wordsReaders(recordOf([LINE_AGENT])) });
    const off = m.container.innerHTML.replace(/_r_\w+_|«r\w+»/g, 'ID');
    m.teardown(); m.setup(); resetFilmRoomVerdicts();
    flags.debrief = 'allowlist';
    await open({ readers: wordsReaders(null) });   // on, but no record and past the run: nothing added
    expect(m.container.innerHTML.replace(/_r_\w+_|«r\w+»/g, 'ID')).toBe(off);
  });
});

describe('the harness oracle bites (debriefWordsDefects)', () => {
  it('a line moved to another swap\'s panel, a record of another day, a forged date — each a defect', async () => {
    const record = recordOf([LINE_AGENT]);
    await open({ readers: wordsReaders(record) });
    expect(debriefWordsDefects(m.container, { tape: sep23Tape, debrief: record })).toEqual([]);
    expect(debriefWordsDefects(m.container, { tape: sep23Tape, debrief: { ...record, lines: [{ ...LINE_AGENT, key: KEY['action:0'] }] } })).toContain("lines[0].text: its key is not this swap's row key");
    expect(debriefWordsDefects(m.container, { tape: sep23Tape, debrief: { ...record, etDate: '2026-09-22' } })).toContain("lines[0].text: not a written record of this tape's day");
    act(() => { m.q('[data-flow-debrief-date] [data-time]').textContent = 'Sep 24'; });
    expect(debriefWordsDefects(m.container, { tape: sep23Tape, debrief: record })).toContain('lines[0].text: dated “Sep 24”, the record says “Sep 23”');
  });
});

describe('the fix round\'s review, the record lens (R-2, R-3, R-5)', () => {
  const BEFORE_RUN = Date.parse('2026-09-24T03:00:00.000Z');
  it('R-2 (DF-1): no not-yet promise for a tape the pass will skip — one that names another owner or another battle', async () => {
    await open({ readers: wordsReaders(null), nowMs: BEFORE_RUN });
    expect(notYet()).toHaveLength(1);   // the control: this battle's own tape
    for (const tape of [{ ...clone(sep23Tape), ownerId: 'owner-previous' }, { ...clone(sep23Tape), battleId: 'b-other' }]) {
      m.teardown(); m.setup();
      const r = wordsReaders(null, { [D]: tape });
      await open({ readers: r, nowMs: BEFORE_RUN });
      expect([notYet().length, words().length], JSON.stringify([tape.ownerId, tape.battleId])).toEqual([0, 0]);
    }
  });
  it('R-3 (DF-10): a read that lands after the cutoff never commits the line — not even for one frame', async () => {
    const cutoff = Date.parse('2026-09-24T04:15:00.000Z');
    // the clock too: the screen measures how long the page has been open with Date.now
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'], shouldAdvanceTime: true });
    const seen = [];
    let release;
    try {
      const r = wordsReaders(null);
      const plain = r.readDebrief;
      r.readDebrief = (...a) => new Promise((res) => { release = () => res(plain(...a)); });
      await open({ readers: r, nowMs: cutoff - 30_000 });
      const mo = new MutationObserver(() => { if (notYet().length) seen.push('line'); });
      mo.observe(m.container, { childList: true, subtree: true });
      await act(async () => { vi.advanceTimersByTime(31_000); });
      await act(async () => { release(); });
      await m.flush();
      mo.disconnect();
      expect([seen, notYet().length, debriefReads(r).length]).toEqual([[], 0, 1]);
    } finally { vi.useRealTimers(); }
  });
  it('R-5 (DF-1): a record and a tape that both lack the battle id show no line', async () => {
    const tape = clone(sep23Tape);
    delete tape.battleId;
    const rec = recordOf([LINE_AGENT]);
    delete rec.battleId;
    await open({ readers: wordsReaders(rec, { [D]: tape }) });
    expect(words()).toHaveLength(0);
  });
});
