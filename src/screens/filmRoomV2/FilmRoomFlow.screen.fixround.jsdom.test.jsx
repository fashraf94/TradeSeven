// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomFlow.screen.fixround.jsdom.test.jsx
//
// Film Room D1 fix round — the SHELL's rows (build report §11): Astra's D1 review §1 findings in the shell as rows,
// each of which FAILED at the reviewed head 368dc113 (run in an LF git archive before any code change) — F3, F4 (its
// jsdom half; the browser half is §11's browser checks), F5, F10, F11, F12 — the controls of those reproductions that
// pass at both heads (DA-12's, the untouched admission, F10's and F11's other endings), said so in their names, and the
// rulings' and the review's own rows (Build D Amendment B; build report §11), some of which also pass at 368dc113.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Whole-screen mounts with several flushes per row: the sibling suites' bound (FilmRoomScreenV2.reads, review A2V4-14).
vi.setConfig({ testTimeout: 30_000 });
import React, { act } from 'react';

const flags = vi.hoisted(() => ({ flow: 'on', cards: 'off' }));
vi.mock('../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_ROOM_FLOW_MODE() { return flags.flow; },
  get FILM_ROOM_CARDS_MODE() { return flags.cards; },
}));

import FilmRoomScreenV2 from './FilmRoomScreenV2.jsx';
import { readFilmRoomVerdict, resetFilmRoomVerdicts } from '../../utils/filmRoomGate';
import { hasSeenFirstOpen } from './filmRoomSeen';
import { mounter, sep23Tape, sep23Series, clone, battleOf, readersOf, NOW } from './__fixtures__/filmRoomHarness';

const m = mounter();
beforeEach(() => { flags.flow = 'on'; flags.cards = 'off'; resetFilmRoomVerdicts(); globalThis.localStorage.clear(); m.setup(); });
afterEach(() => m.teardown());

const D = sep23Tape.etDate;
const D0 = '2026-09-22';
const api = (over = {}) => {
  const calls = { verdict: [] };
  return {
    calls,
    readVerdict: async (id, o) => { calls.verdict.push([id, o]); return over.verdict ?? true; },
    readCounter: async () => ({ ok: true, status: 200, body: { cards: [], attributionAgentId: 'agent-1' } }),
    postCard: async () => ({ ok: false, status: 400, body: { error: 'x' } }),
    newOpId: () => 'op_1',
    ...over.fns,
  };
};
/** A verdict held until the row answers it: `answer(v)` resolves it, `fail()` rejects it. */
const heldApi = () => {
  const h = {};
  h.api = { ...api(), readVerdict: () => new Promise((res, rej) => { h.answer = res; h.fail = rej; }) };
  return h;
};
const screen = ({ battle = battleOf(sep23Tape, { ownerId: 'owner-1' }), readers = readersOf({ [D]: sep23Tape }, sep23Series), cardsApi = api(), openAt = null, onBack = () => {} } = {}) => (
  <FilmRoomScreenV2 battle={battle} onBack={onBack} viewerId="viewer-1" readers={readers} nowMs={NOW} cardsApi={cardsApi} openAt={openAt} onOpenAtUsed={() => {}} />
);
async function open(props) { m.render(screen(props)); await m.flush(); }
const onFront = () => Boolean(m.q('[data-view="flow"] [data-flow-front]'));
const onTape = () => Boolean(m.q('[role="tablist"]')) && !m.q('[data-flow-front]');
const backLabel = () => m.q('header button').textContent;
const chips = () => m.qa('[data-region="day-picker"] button');
const notice = () => m.q('[data-region="first-open"]');
const pointer = (type) => (typeof PointerEvent === 'function' ? new PointerEvent(type, { bubbles: true, cancelable: true }) : new MouseEvent(type, { bubbles: true, cancelable: true }));
const MOMENT = { battleId: sep23Tape.battleId, etDate: D, situationId: 'stalled', symbol: 'MSFT', fromTickSeq: 8, toTickSeq: 9 };

describe('item 6 — F3: the first-open mark (DB-3)', () => {
  it("F3: opened at a VALID moment under 'allowlist' — the notice it shows is marked seen (that tape is settled from the first paint)", async () => {
    flags.flow = 'allowlist';
    await open({ openAt: { battleId: sep23Tape.battleId, etDate: D, moment: MOMENT } });
    expect(onTape()).toBe(true);
    expect(notice()).toBeTruthy();
    expect(hasSeenFirstOpen('viewer-1')).toBe(true);
  });
  it("F3: opened at a REJECTED moment (another battle's) under 'allowlist' — marked seen too", async () => {
    flags.flow = 'allowlist';
    await open({ openAt: { battleId: 'someone-else', etDate: D, moment: { situationId: 'stalled', symbol: 'X', fromTickSeq: 1, toTickSeq: 2 } } });
    expect(onTape()).toBe(true);
    expect(notice()).toBeTruthy();
    expect(hasSeenFirstOpen('viewer-1')).toBe(true);
  });
  it('F3: "Got it" while the verdict is on its way, then the verdict DENIED — marked seen; a remount shows no notice', async () => {
    flags.flow = 'allowlist';
    const h = heldApi();
    await open({ cardsApi: h.api });
    expect(notice()).toBeTruthy();
    m.click(m.buttons('Got it')[0]); await m.flush();
    h.answer(false); await m.flush();
    expect(onTape()).toBe(true);
    expect(hasSeenFirstOpen('viewer-1')).toBe(true);
    m.teardown(); m.setup();
    await open({ cardsApi: api({ verdict: false }) });
    expect(notice()).toBeNull();
  });
  it('F3: "Got it", then the verdict request FAILS — marked seen', async () => {
    flags.flow = 'allowlist';
    const h = heldApi();
    await open({ cardsApi: h.api });
    m.click(m.buttons('Got it')[0]); await m.flush();
    h.fail(new Error('network')); await m.flush();
    expect(hasSeenFirstOpen('viewer-1')).toBe(true);
  });
  it('F3: "Got it", then the verdict TIMES OUT — the real reader, answered by the timeout branch\'s own value — marked seen', async () => {
    flags.flow = 'allowlist';
    let late;
    // filmRoomGate.js requestFilmRoomVerdict: at FILM_ROOM_VERDICT_TIMEOUT_MS the race resolves { ok: false, allowlisted: false }
    const cardsApi = { ...api(), readVerdict: (id, o) => readFilmRoomVerdict(id, { ...o, request: () => new Promise((r) => { late = () => r({ ok: false, allowlisted: false }); }) }) };
    await open({ cardsApi });
    m.click(m.buttons('Got it')[0]); await m.flush();
    late(); await m.flush();
    expect(onTape()).toBe(true);
    expect(hasSeenFirstOpen('viewer-1')).toBe(true);
  });
  it("DA-12's control (passes at both heads): under 'allowlist', a viewer who leaves without interacting while the verdict is pending is not marked", async () => {
    flags.flow = 'allowlist';
    const h = heldApi();
    await open({ cardsApi: h.api });
    expect(notice()).toBeTruthy();
    m.teardown(); m.setup();
    expect(hasSeenFirstOpen('viewer-1')).toBe(false);
  });
});

describe('item 6 — F4: a gesture in progress keeps the tape (DB-4; the browser half in §11)', () => {
  it('F4: a POINTER-DOWN on Study before the verdict lands keeps the tape — the admission takes nothing from under the gesture', async () => {
    flags.flow = 'allowlist';
    const h = heldApi();
    await open({ cardsApi: h.api });
    act(() => { m.tab('Study').dispatchEvent(pointer('pointerdown')); });
    h.answer(true); await m.flush();
    expect(onTape()).toBe(true);
  });
  it('F4: a SPACE key-down on Study before the verdict lands keeps the tape', async () => {
    flags.flow = 'allowlist';
    const h = heldApi();
    await open({ cardsApi: h.api });
    act(() => { m.tab('Study').dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true })); });
    h.answer(true); await m.flush();
    expect(onTape()).toBe(true);
  });
  it('F4: a FOCUS move onto a tape control before the verdict lands keeps the tape, and the focus', async () => {
    flags.flow = 'allowlist';
    const h = heldApi();
    await open({ cardsApi: h.api });
    act(() => { m.tab('Study').focus(); });
    h.answer(true); await m.flush();
    expect(onTape()).toBe(true);
    expect(document.activeElement).toBe(m.tab('Study'));
  });
  it('an untouched page (passes at both heads): the admission opens the front', async () => {
    flags.flow = 'allowlist';
    const h = heldApi();
    await open({ cardsApi: h.api });
    expect(onTape()).toBe(true);
    h.answer(true); await m.flush();
    expect(onFront()).toBe(true);
  });
});

describe('item 6 — F12: the flow\'s answer belongs to one battle and one owner (DB-12)', () => {
  it('F12: the same mounted battle id, its owner refreshed from A to B — the front never stands on A\'s answer while B\'s is on its way', async () => {
    flags.flow = 'allowlist';
    let answerB;
    const cardsApi = { ...api(), readVerdict: (id, o) => (o?.ownerId === 'owner-b' ? new Promise((r) => { answerB = r; }) : Promise.resolve(true)) };
    const readers = readersOf({ [D]: sep23Tape }, sep23Series);
    await open({ battle: battleOf(sep23Tape, { ownerId: 'owner-a' }), readers, cardsApi });
    expect(onFront()).toBe(true);
    m.render(screen({ battle: battleOf(sep23Tape, { ownerId: 'owner-b' }), readers, cardsApi }));
    expect(onFront()).toBe(false);   // the first paint after the refresh
    await m.flush();
    expect(onFront()).toBe(false);
    answerB(false); await m.flush();
    expect(onFront()).toBe(false);
  });
  it('F12: a missing owner, then a known one, on an unchanged battle id — pending again until the known owner\'s answer', async () => {
    flags.flow = 'allowlist';
    let answerB;
    const cardsApi = { ...api(), readVerdict: (id, o) => (o?.ownerId === 'owner-b' ? new Promise((r) => { answerB = r; }) : Promise.resolve(true)) };
    const readers = readersOf({ [D]: sep23Tape }, sep23Series);
    await open({ battle: battleOf(sep23Tape), readers, cardsApi });
    expect(onFront()).toBe(true);
    m.render(screen({ battle: battleOf(sep23Tape, { ownerId: 'owner-b' }), readers, cardsApi }));
    expect(onFront()).toBe(false);
    await m.flush();
    expect(onFront()).toBe(false);
    answerB(true); await m.flush();
    expect(onFront()).toBe(true);
  });
});

describe('item 6 — DB-3 / DB-4 / DB-12, beside the reproductions', () => {
  /** Count the seen-map's writes: every localStorage.setItem of the first-open key. */
  function countWrites() {
    const set = Storage.prototype.setItem;
    const calls = [];
    Storage.prototype.setItem = function setItem(k, v) { if (k === 'ft.filmRoom.v2.firstOpenSeen') calls.push(v); return set.call(this, k, v); };
    return { calls, undo: () => { Storage.prototype.setItem = set; } };
  }
  it("DB-3 under 'off': the first paint writes the mark once, as on main — \"Got it\" then writes nothing more", async () => {
    flags.flow = 'off';
    const w = countWrites();
    try {
      await open();
      expect(w.calls).toHaveLength(1);
      m.click(m.buttons('Got it')[0]); await m.flush();
      expect(notice()).toBeNull();
      expect(w.calls).toHaveLength(1);
    } finally { w.undo(); }
  });
  it("DB-3: \"Got it\" pressed while the verdict is on its way, then ADMITTED — marked at the dismissal; the press kept the tape (DB-4); no notice on a remount", async () => {
    flags.flow = 'allowlist';
    const h = heldApi();
    await open({ cardsApi: h.api });
    const gotIt = m.buttons('Got it')[0];
    act(() => { gotIt.dispatchEvent(pointer('pointerdown')); });   // a press, as a browser sends one
    m.click(gotIt); await m.flush();
    expect(hasSeenFirstOpen('viewer-1')).toBe(true);
    h.answer(true); await m.flush();
    expect(onTape()).toBe(true);
    m.teardown(); m.setup();
    flags.flow = 'off';
    await open();
    expect(notice()).toBeNull();
  });
  it('DB-4: the gesture held from its pointer-down, its click then runs once on the element still there — Study opens', async () => {
    flags.flow = 'allowlist';
    const h = heldApi();
    await open({ cardsApi: h.api });
    const study = m.tab('Study');
    act(() => { study.dispatchEvent(pointer('pointerdown')); });
    h.answer(true); await m.flush();
    expect(study.isConnected).toBe(true);
    m.click(study); await m.flush();
    expect(onTape()).toBe(true);
    expect(m.tab('Study').getAttribute('aria-selected')).toBe('true');
  });
  it('DB-4: a gesture after the front has shown holds nothing — the front stays until a door', async () => {
    flags.flow = 'allowlist';
    const h = heldApi();
    await open({ cardsApi: h.api });
    h.answer(true); await m.flush();
    expect(onFront()).toBe(true);
    act(() => { m.q('[data-flow-front]').dispatchEvent(pointer('pointerdown')); });
    act(() => { m.q('[data-flow-door]').focus(); });
    await m.flush();
    expect(onFront()).toBe(true);
  });
  it("DB-12: owner A's answer arriving AFTER the refresh to B is never B's — still pending until B's own", async () => {
    flags.flow = 'allowlist';
    const answers = {};
    const cardsApi = { ...api(), readVerdict: (id, o) => new Promise((r) => { answers[o?.ownerId ?? 'none'] = r; }) };
    const readers = readersOf({ [D]: sep23Tape }, sep23Series);
    await open({ battle: battleOf(sep23Tape, { ownerId: 'owner-a' }), readers, cardsApi });
    m.render(screen({ battle: battleOf(sep23Tape, { ownerId: 'owner-b' }), readers, cardsApi }));
    await m.flush();
    answers['owner-a'](true); await m.flush();
    expect(onFront()).toBe(false);
    answers['owner-b'](true); await m.flush();
    expect(onFront()).toBe(true);
  });
});

describe('item 7 — F10 / F11: the doors (DB-10, DB-11)', () => {
  /** Readers whose reads of `held` days wait until released; `fail` days reject. Every call recorded. */
  function heldReaders(tapes, held = [], fail = []) {
    const waiting = {};
    const answer = (d) => (tapes[d] ? { status: 'ready', tape: tapes[d] } : { status: 'missing', tape: null });
    return {
      release: (d) => waiting[d]?.(),
      readTape: (b, d) => {
        if (fail.includes(d)) return Promise.reject(new Error('read failed'));
        return held.includes(d) ? new Promise((r) => { waiting[d] = () => r(answer(d)); }) : Promise.resolve(answer(d));
      },
      readSeries: async () => ({ status: 'ready', series: [] }),
    };
  }
  const early = () => { const t = clone(sep23Tape); t.etDate = D0; t.isFinalDay = false; t.battle = { status: 'active', completedAt: null, final: null, result: { value: null, basis: 'not_completed' }, completionMessage: null }; return t; };
  const twoDays = (readers, onBack = () => {}) => open({ battle: battleOf(sep23Tape, { ownerId: 'owner-1', timing: { tradingDays: [D0, D] } }), readers, onBack });

  it('F10: front → tape → a day with NO tape — the back control is main\'s ("Dashboard"), and one press leaves', async () => {
    let backs = 0;
    await twoDays(heldReaders({ [D]: sep23Tape }), () => { backs += 1; });
    expect(onFront()).toBe(true);
    m.click(m.q('[data-flow-door]')); await m.flush();
    expect(backLabel()).toBe('‹ Game flow');
    m.click(chips()[0]); await m.flush();
    expect(m.q('[data-state="missing"]')).toBeTruthy();
    expect(backLabel()).toBe('‹ Dashboard');
    m.click(m.q('header button')); await m.flush();
    expect(backs).toBe(1);
  });
  it('F10: front → tape → a day whose read FAILS — main\'s back control', async () => {
    await twoDays(heldReaders({ [D]: sep23Tape }, [], [D0]));
    m.click(m.q('[data-flow-door]')); await m.flush();
    m.click(chips()[0]); await m.flush();
    expect(m.q('[data-state="error"]')).toBeTruthy();
    expect(backLabel()).toBe('‹ Dashboard');
  });
  it('F10\'s guard (passes at both heads): "Game flow" pressed while the day is read, then a miss — main\'s back control, one press leaves', async () => {
    let backs = 0;
    const r = heldReaders({ [D]: sep23Tape }, [D0]);
    await twoDays(r, () => { backs += 1; });
    m.click(m.q('[data-flow-door]')); await m.flush();
    m.click(chips()[0]); await m.flush();
    expect(backLabel()).toBe('‹ Game flow');
    m.click(m.q('header button')); await m.flush();
    r.release(D0); await m.flush();
    expect(m.q('[data-state="missing"]')).toBeTruthy();
    expect(backLabel()).toBe('‹ Dashboard');
    m.click(m.q('header button')); await m.flush();
    expect(backs).toBe(1);
  });
  it('F11: "Game flow" pressed while a written day is read, then the player focuses a day chip — the late door never takes that focus', async () => {
    const r = heldReaders({ [D0]: early(), [D]: sep23Tape }, [D0]);
    await twoDays(r);
    m.click(m.q('[data-flow-door]')); await m.flush();
    m.click(chips()[0]); await m.flush();
    m.click(m.q('header button')); await m.flush();
    const chip = chips()[1];
    act(() => { chip.focus(); });
    r.release(D0); await m.flush();
    expect(onFront()).toBe(true);
    expect(document.activeElement).toBe(chip);
  });
  it('F11, the other ending (passes at both heads): the focus left where "Game flow" put it — the door takes it once the day is read', async () => {
    const r = heldReaders({ [D0]: early(), [D]: sep23Tape }, [D0]);
    await twoDays(r);
    m.click(m.q('[data-flow-door]')); await m.flush();
    m.click(chips()[0]); await m.flush();
    m.click(m.q('header button')); await m.flush();
    r.release(D0); await m.flush();
    expect(onFront()).toBe(true);
    expect(document.activeElement).toBe(m.q('[data-flow-door]'));
  });
});

describe('item 7 — DB-10 / DB-11, beside the reproductions', () => {
  const unwritten = () => { const t = clone(sep23Tape); t.etDate = D0; delete t.checks; t.passes.close.status = 'error'; return t; };
  const twoDaysWith = (tapes) => open({ battle: battleOf(sep23Tape, { ownerId: 'owner-1', timing: { tradingDays: [D0, D] } }), readers: readersOf(tapes, sep23Series) });
  it('DB-10: a day whose tape document holds no written day (the close pass failed) — main\'s back control', async () => {
    await twoDaysWith({ [D0]: unwritten(), [D]: sep23Tape });
    m.click(m.q('[data-flow-door]')); await m.flush();
    m.click(chips()[0]); await m.flush();
    expect(m.q('[data-state="not-written"]')).toBeTruthy();
    expect(backLabel()).toBe('‹ Dashboard');
  });
  it('DB-10: back on the written day after the miss — "Game flow" again, and it returns to that day\'s front with the door focused', async () => {
    await twoDaysWith({ [D]: sep23Tape });
    m.click(m.q('[data-flow-door]')); await m.flush();
    m.click(chips()[0]); await m.flush();
    expect(backLabel()).toBe('‹ Dashboard');
    m.click(chips()[1]); await m.flush();
    expect(onTape()).toBe(true);
    expect(backLabel()).toBe('‹ Game flow');
    m.click(m.q('header button')); await m.flush();
    expect(onFront()).toBe(true);
    expect(document.activeElement).toBe(m.q('[data-flow-door]'));
  });
});

describe('item 8 — F5: "This game" needs a known one-day battle (DB-5)', () => {
  it('F5: a battle without its trading-day list and a final tape of day 3 — the counts say "This day"; the tape behind the door says three-day', async () => {
    const t = clone(sep23Tape);
    t.dayNumber = 3;
    await open({ battle: battleOf(t, { ownerId: 'owner-1', timing: undefined }), readers: readersOf({ [D]: t }, sep23Series) });
    expect(onFront()).toBe(true);
    expect(m.q('[data-flow-counts] h2').textContent).toBe('This day');
    m.click(m.q('[data-flow-door]')); await m.flush();
    expect(m.q('[data-header-subtitle]').textContent.toLowerCase()).toContain('three-day');
  });
});

describe('item 8 — DB-5, beside the reproduction: the same rows, three length readings', () => {
  const heading = () => m.q('[data-flow-counts] h2')?.textContent ?? null;
  it('an unknown length — no trading-day list, a tape that records no final dayNumber — "This day"', async () => {
    const t = clone(sep23Tape);
    delete t.dayNumber;
    await open({ battle: battleOf(t, { ownerId: 'owner-1', timing: undefined }), readers: readersOf({ [D]: t }, sep23Series) });
    expect(onFront()).toBe(true);
    expect(m.qa('[data-flow-tile]')).toHaveLength(2);
    expect(heading()).toBe('This day');
  });
  it('a confirmed one-day battle — its timeline names one day — "This game"; the same with no timeline and a final tape of day 1', async () => {
    await open();
    expect(heading()).toBe('This game');
    m.teardown(); m.setup();
    const t = clone(sep23Tape);   // dayNumber 1, isFinalDay true
    await open({ battle: battleOf(t, { ownerId: 'owner-1', timing: undefined }), readers: readersOf({ [D]: t }, sep23Series) });
    expect(heading()).toBe('This game');
  });
  it('a three-day timeline: "This day" on its final day', async () => {
    const t = clone(sep23Tape);
    t.dayNumber = 3;
    await open({ battle: battleOf(t, { ownerId: 'owner-1', timing: { tradingDays: ['2026-09-21', '2026-09-22', D] } }), readers: readersOf({ [D]: t }, sep23Series) });
    expect(heading()).toBe('This day');
  });
});

describe('item 6 — DB-3 on the off path, where the storage throws', () => {
  it("'off', storage that refuses every write: the first paint attempts the one write main attempts — \"Got it\" attempts none more", async () => {
    flags.flow = 'off';
    const set = Storage.prototype.setItem;
    const attempts = [];
    Storage.prototype.setItem = function setItem(k) { if (k === 'ft.filmRoom.v2.firstOpenSeen') attempts.push(k); throw new Error('QuotaExceededError'); };
    try {
      await open();
      expect(notice()).toBeTruthy();
      expect(attempts).toHaveLength(1);
      m.click(m.buttons('Got it')[0]); await m.flush();
      expect(notice()).toBeNull();
      expect(attempts).toHaveLength(1);
    } finally { Storage.prototype.setItem = set; }
  });
});

describe('the review round (fix round) — the shell', () => {
  const press = (el) => { act(() => { el.dispatchEvent(pointer('pointerdown')); }); m.click(el); };
  it("FRA-1 / FRC-3: a press that keeps the tape while the verdict is pending, then the viewer leaves — marked (an irrevocable tape entry is settled)", async () => {
    flags.flow = 'allowlist';
    const h = heldApi();
    await open({ cardsApi: h.api });
    expect(hasSeenFirstOpen('viewer-1')).toBe(false);
    press(m.tab('Study')); await m.flush();
    expect(hasSeenFirstOpen('viewer-1')).toBe(true);
    m.teardown(); m.setup();
    expect(hasSeenFirstOpen('viewer-1')).toBe(true);
  });
  it('FRA-1: a focus move alone onto a tape control while pending — marked; the header back control pressed while pending — marked, and it leaves', async () => {
    flags.flow = 'allowlist';
    let h = heldApi();
    await open({ cardsApi: h.api });
    act(() => { m.tab('Study').focus(); });
    await m.flush();
    expect(hasSeenFirstOpen('viewer-1')).toBe(true);
    m.teardown(); m.setup(); globalThis.localStorage.clear(); resetFilmRoomVerdicts();
    h = heldApi();
    let backs = 0;
    await open({ cardsApi: h.api, onBack: () => { backs += 1; } });
    press(m.q('header button')); await m.flush();
    expect(backs).toBe(1);
    expect(hasSeenFirstOpen('viewer-1')).toBe(true);
  });
  it("FRA-2: under 'allowlist', a battle with no id (never asked about) — the notice marked at the first paint, as on main", async () => {
    flags.flow = 'allowlist';
    const r = api();
    await open({ battle: battleOf(sep23Tape, { id: undefined }), cardsApi: r });
    expect(notice()).toBeTruthy();
    expect(r.calls.verdict).toEqual([]);
    expect(hasSeenFirstOpen('viewer-1')).toBe(true);
  });
  it("FRC-1: after owner A's front, a refresh to owner B (held) — a press on the pending tape keeps it when B is admitted; the gesture's Study opens", async () => {
    flags.flow = 'allowlist';
    let answerB;
    const cardsApi = { ...api(), readVerdict: (id, o) => (o?.ownerId === 'owner-b' ? new Promise((r) => { answerB = r; }) : Promise.resolve(true)) };
    const readers = readersOf({ [D]: sep23Tape }, sep23Series);
    await open({ battle: battleOf(sep23Tape, { ownerId: 'owner-a' }), readers, cardsApi });
    expect(onFront()).toBe(true);
    m.render(screen({ battle: battleOf(sep23Tape, { ownerId: 'owner-b' }), readers, cardsApi }));
    await m.flush();
    expect(onTape()).toBe(true);
    const study = m.tab('Study');
    act(() => { study.dispatchEvent(pointer('pointerdown')); });
    answerB(true); await m.flush();
    expect(onTape()).toBe(true);
    expect(study.isConnected).toBe(true);
    m.click(study); await m.flush();
    expect(m.tab('Study').getAttribute('aria-selected')).toBe('true');
  });
  it("FRC-1's control: the refresh to B with no gesture — B admitted opens B's front", async () => {
    flags.flow = 'allowlist';
    let answerB;
    const cardsApi = { ...api(), readVerdict: (id, o) => (o?.ownerId === 'owner-b' ? new Promise((r) => { answerB = r; }) : Promise.resolve(true)) };
    const readers = readersOf({ [D]: sep23Tape }, sep23Series);
    await open({ battle: battleOf(sep23Tape, { ownerId: 'owner-a' }), readers, cardsApi });
    m.render(screen({ battle: battleOf(sep23Tape, { ownerId: 'owner-b' }), readers, cardsApi }));
    await m.flush();
    answerB(true); await m.flush();
    expect(onFront()).toBe(true);
  });
  it("FRC-2: front → tape, then the owner refreshed and DENIED — the back control is main's, and one press leaves", async () => {
    flags.flow = 'allowlist';
    let answerB;
    let backs = 0;
    const onBack = () => { backs += 1; };
    const cardsApi = { ...api(), readVerdict: (id, o) => (o?.ownerId === 'owner-b' ? new Promise((r) => { answerB = r; }) : Promise.resolve(true)) };
    const readers = readersOf({ [D]: sep23Tape }, sep23Series);
    await open({ battle: battleOf(sep23Tape, { ownerId: 'owner-a' }), readers, cardsApi, onBack });
    m.click(m.q('[data-flow-door]')); await m.flush();
    expect(backLabel()).toBe('‹ Game flow');
    m.render(screen({ battle: battleOf(sep23Tape, { ownerId: 'owner-b' }), readers, cardsApi, onBack }));
    await m.flush();
    expect(backLabel()).toBe('‹ Game flow');   // B's answer still pending: the front may yet be there
    answerB(false); await m.flush();
    expect(backLabel()).toBe('‹ Dashboard');
    m.click(m.q('header button')); await m.flush();
    expect(backs).toBe(1);
  });
  it('FRD-1: through the shell, a tape written before isFinalDay existed, on its battle\'s validated last day — "Won by 46" (the battle reaches the front)', async () => {
    const t = clone(sep23Tape);
    delete t.isFinalDay;
    await open({ battle: battleOf(t, { ownerId: 'owner-1' }), readers: readersOf({ [D]: t }, sep23Series) });
    expect(onFront()).toBe(true);
    expect(m.q('[data-flow-heading]').textContent).toBe('Won by 46');
    m.teardown(); m.setup();
    await open({ battle: battleOf(t, { ownerId: 'owner-1', timing: { tradingDays: [D, '2026-09-24'] } }), readers: readersOf({ [D]: t }, sep23Series) });
    m.click(chips()[0]); await m.flush();   // the battle opens on its last day, Sep 24; Sep 23 is an earlier one
    expect(m.q('[data-flow-heading]').textContent).toBe('Wed, Sep 23, 2026');
  });
});
