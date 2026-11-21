// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomFlow.screen.fixround.jsdom.test.jsx
//
// Film Room D1 fix round — the SHELL's rows (build report §11): Astra's D1 review §1 findings in the shell as rows,
// each of which FAILED at the reviewed head 368dc113 (run in an LF git archive before any code change) — F3, F4 (its
// jsdom half; the browser half is §11's browser checks), F5, F10, F11, F12 — the guards that pass at both heads (DA-12's
// control, the untouched admission), said so in their names, and the rulings that closed them (Build D Amendment B).

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
  it("DB-3: \"Got it\" while the verdict is on its way, then ADMITTED — marked at the dismissal; the front, and no notice on a remount", async () => {
    flags.flow = 'allowlist';
    const h = heldApi();
    await open({ cardsApi: h.api });
    m.click(m.buttons('Got it')[0]); await m.flush();
    expect(hasSeenFirstOpen('viewer-1')).toBe(true);
    h.answer(true); await m.flush();
    expect(onFront()).toBe(true);
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
