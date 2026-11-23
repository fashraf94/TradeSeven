// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomFlow.d2carried.jsdom.test.jsx
//
// Film Room D2, part 2 — D1's carried fixes in the SHELL (FilmRoomScreenV2.jsx), each a row that FAILED at `56220130`
// (main with #1102, run in an LF git archive before any code change; build report
// docs/audits/20261122_BUILD_FILM_ROOM_D2_WORDS.md), beside its controls (said so in their names):
//   DC-4 (Build D Amendment C)       a click is a fourth trigger: a click inside the tape before the verdict lands keeps it
//   DD-2 (Amendment D; Astra's N2)  a wheel or trackpad scroll of the tape, the document included, is interaction — it
//                                    keeps the tape and marks the notice (the Chromium half: the report's browser checks)
//   DD-3 (Amendment D; Astra's N3, N4)  one identity record — the battle id and the nullable owner, strict equality — for
//                                    the verdict, the front-seen marker and the "Game flow" return

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.setConfig({ testTimeout: 30_000 });
import React, { act } from 'react';

const flags = vi.hoisted(() => ({ flow: 'allowlist', cards: 'off' }));
vi.mock('../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_ROOM_FLOW_MODE() { return flags.flow; },
  get FILM_ROOM_CARDS_MODE() { return flags.cards; },
  // D2: the words are their own suites' (FilmRoomFlow.words.*); these rows are D1's carried fixes alone
  get FILM_ROOM_DEBRIEF_MODE() { return 'off'; },
}));

import FilmRoomScreenV2 from './FilmRoomScreenV2.jsx';
import { resetFilmRoomVerdicts } from '../../utils/filmRoomGate';
import { hasSeenFirstOpen } from './filmRoomSeen';
import { mounter, sep23Tape, sep23Series, clone, battleOf, readersOf, NOW, sweepFlow } from './__fixtures__/filmRoomHarness';

const m = mounter();
beforeEach(() => { flags.flow = 'allowlist'; flags.cards = 'off'; resetFilmRoomVerdicts(); globalThis.localStorage.clear(); m.setup(); });
afterEach(() => m.teardown());

const D = sep23Tape.etDate;
const api = (over = {}) => ({
  readVerdict: async () => over.verdict ?? true,
  readCounter: async () => ({ ok: true, status: 200, body: { cards: [], attributionAgentId: 'agent-1' } }),
  postCard: async () => ({ ok: false, status: 400, body: { error: 'x' } }),
  newOpId: () => 'op_1',
});
/** A verdict held until the row answers it. */
const heldApi = () => {
  const h = {};
  h.api = { ...api(), readVerdict: () => new Promise((res) => { h.answer = res; }) };
  return h;
};
/** Verdicts per owner: `held` owners wait for `answer[owner](v)`; every other owner is answered `true` at once. */
const ownersApi = (held) => {
  const answer = {};
  const calls = [];
  const cardsApi = {
    ...api(),
    readVerdict: (id, o) => {
      calls.push(o?.ownerId);
      return held.includes(o?.ownerId) ? new Promise((r) => { answer[o?.ownerId] = r; }) : Promise.resolve(true);
    },
  };
  return { cardsApi, answer, calls };
};
const screen = ({ battle = battleOf(sep23Tape, { ownerId: 'owner-1' }), readers = readersOf({ [D]: sep23Tape }, sep23Series), cardsApi = api(), onBack = () => {} } = {}) => (
  <FilmRoomScreenV2 battle={battle} onBack={onBack} viewerId="viewer-1" readers={readers} nowMs={NOW} cardsApi={cardsApi} />
);
async function open(props) { m.render(screen(props)); await m.flush(); }
const onFront = () => Boolean(m.q('[data-view="flow"] [data-flow-front]'));
const onTape = () => Boolean(m.q('[role="tablist"]')) && !m.q('[data-flow-front]');
const backLabel = () => m.q('header button').textContent;
const notice = () => m.q('[data-region="first-open"]');
const pointer = (type, init = {}) => (typeof PointerEvent === 'function' ? new PointerEvent(type, { bubbles: true, cancelable: true, ...init }) : new MouseEvent(type, { bubbles: true, cancelable: true, ...init }));
const wheel = () => (typeof WheelEvent === 'function' ? new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 410 }) : new Event('wheel', { bubbles: true, cancelable: true }));

describe('DC-4 — a click is a fourth trigger (Amendment C)', () => {
  it('DC-4: a synthetic CLICK on Study, with no pointer or key event before it, then the admission — the tape stays, and the click ran once (Study open)', async () => {
    const h = heldApi();
    await open({ cardsApi: h.api });
    const study = m.tab('Study');
    let clicks = 0;
    study.addEventListener('click', () => { clicks += 1; });
    m.click(study);
    h.answer(true); await m.flush();
    expect(onTape()).toBe(true);
    expect(clicks).toBe(1);
    expect(m.tab('Study').getAttribute('aria-selected')).toBe('true');
  });
  it('DC-4: the same click, then the viewer leaves while pending — marked (a held tape is an irrevocable entry)', async () => {
    const h = heldApi();
    await open({ cardsApi: h.api });
    m.click(m.tab('Study')); await m.flush();
    expect(hasSeenFirstOpen('viewer-1')).toBe(true);
  });
  it("DC-4's control (passes at both heads): a click after the front has shown holds nothing — the front stays", async () => {
    const h = heldApi();
    await open({ cardsApi: h.api });
    h.answer(true); await m.flush();
    expect(onFront()).toBe(true);
    m.click(m.q('[data-flow-front]')); await m.flush();
    expect(onFront()).toBe(true);
  });
});

describe('DC-8 — through the shell: the low mark on displayed hundredths (Amendment C)', () => {
  it('DC-8: a day whose two lowest checks display alike ("−5") — the drawn low is the EARLIER one, and the harness\'s sweep agrees', async () => {
    const t = clone(sep23Tape);
    t.battle.status = 'active'; t.isFinalDay = false;
    t.checks = [1, -5.001, 3, -5.004, 2].map((v, i) => ({ at: new Date(Date.parse('2026-09-23T14:00:00.000Z') + i * 900_000).toISOString(), tickSeq: i + 1, state: 'completed', scores: { total: v, opponent: -1 } }));
    await open({ readers: readersOf({ [D]: t }, sep23Series), battle: battleOf(t, { ownerId: 'owner-1', status: 'active' }) });
    expect(onFront()).toBe(true);
    const low = m.q('[data-flow-low] [data-flow-num]');
    expect(low?.getAttribute('data-flow-num')).toBe('checks[1].scores.total');
    expect(sweepFlow(m.container, { tape: t })).toEqual([]);
  });
});

describe('DD-2 — scrolling counts: a wheel or trackpad scroll, the document included (Amendment D; Astra\'s N2)', () => {
  it('DD-2: a WHEEL over the pending tape, then the admission — the tape stays', async () => {
    const h = heldApi();
    await open({ cardsApi: h.api });
    act(() => { m.q('main').dispatchEvent(wheel()); });
    h.answer(true); await m.flush();
    expect(onTape()).toBe(true);
  });
  it('DD-2: a wheel at the DOCUMENT level (outside the screen\'s own element), then the admission — the tape stays', async () => {
    const h = heldApi();
    await open({ cardsApi: h.api });
    act(() => { document.dispatchEvent(wheel()); });
    h.answer(true); await m.flush();
    expect(onTape()).toBe(true);
  });
  it('DD-2: a wheel, then the viewer leaves while pending — marked; a remount of the same viewer shows no notice', async () => {
    const h = heldApi();
    await open({ cardsApi: h.api });
    expect(notice()).toBeTruthy();
    act(() => { m.q('main').dispatchEvent(wheel()); });
    await m.flush();
    expect(hasSeenFirstOpen('viewer-1')).toBe(true);
    m.teardown(); m.setup();
    flags.flow = 'off';
    await open();
    expect(notice()).toBeNull();
  });
  it("DD-2's control (passes at both heads): an untouched page — the admission opens the front", async () => {
    const h = heldApi();
    await open({ cardsApi: h.api });
    h.answer(true); await m.flush();
    expect(onFront()).toBe(true);
  });
  it("DD-2's control (passes at both heads): a SCROLL event alone — a programmatic scroll, or the page re-anchoring under a layout shift, with no wheel — holds nothing: the admission opens the front", async () => {
    const h = heldApi();
    await open({ cardsApi: h.api });
    act(() => { document.dispatchEvent(new Event('scroll', { bubbles: true })); window.dispatchEvent(new Event('scroll')); });
    h.answer(true); await m.flush();
    expect(onFront()).toBe(true);
  });
  it("DD-2's control (passes at both heads): a touch swipe (a touch pointer-down) keeps the tape and marks the notice", async () => {
    const h = heldApi();
    await open({ cardsApi: h.api });
    act(() => { m.q('main').dispatchEvent(pointer('pointerdown', { pointerType: 'touch' })); });
    await m.flush();
    expect(hasSeenFirstOpen('viewer-1')).toBe(true);
    h.answer(true); await m.flush();
    expect(onTape()).toBe(true);
  });
  it("DD-2's control (passes at both heads): a wheel after the front has shown holds nothing — the front stays", async () => {
    const h = heldApi();
    await open({ cardsApi: h.api });
    h.answer(true); await m.flush();
    act(() => { document.dispatchEvent(wheel()); m.q('[data-flow-front]').dispatchEvent(wheel()); });
    await m.flush();
    expect(onFront()).toBe(true);
  });
});

describe('DD-3 — one identity record (Amendment D; Astra\'s N3 and N4)', () => {
  it('N3: admit A, open the full tape, refresh the owner to B (held) — the back control is main\'s at B\'s first pending paint, and its first press leaves', async () => {
    const o = ownersApi(['owner-b']);
    const readers = readersOf({ [D]: sep23Tape }, sep23Series);
    let backs = 0;
    const onBack = () => { backs += 1; };
    await open({ battle: battleOf(sep23Tape, { ownerId: 'owner-a' }), readers, cardsApi: o.cardsApi, onBack });
    expect(onFront()).toBe(true);
    m.click(m.q('[data-flow-door]')); await m.flush();
    expect(backLabel()).toBe('‹ Game flow');
    m.render(screen({ battle: battleOf(sep23Tape, { ownerId: 'owner-b' }), readers, cardsApi: o.cardsApi, onBack }));
    expect(backLabel()).toBe('‹ Dashboard');          // the first paint after the refresh
    await m.flush();
    expect(backLabel()).toBe('‹ Dashboard');          // B's verdict still pending
    m.click(m.q('header button')); await m.flush();
    expect(backs).toBe(1);
  });
  it('N3\'s control (passes at both heads): … and B then answered no — main\'s back control, and one press leaves', async () => {
    const o = ownersApi(['owner-b']);
    const readers = readersOf({ [D]: sep23Tape }, sep23Series);
    let backs = 0;
    const onBack = () => { backs += 1; };
    await open({ battle: battleOf(sep23Tape, { ownerId: 'owner-a' }), readers, cardsApi: o.cardsApi, onBack });
    m.click(m.q('[data-flow-door]')); await m.flush();
    m.render(screen({ battle: battleOf(sep23Tape, { ownerId: 'owner-b' }), readers, cardsApi: o.cardsApi, onBack }));
    await m.flush();
    o.answer['owner-b'](false); await m.flush();
    expect(backLabel()).toBe('‹ Dashboard');
    m.click(m.q('header button')); await m.flush();
    expect(backs).toBe(1);
  });
  it("N3: … and B then ADMITTED — the return was A's entry, never B's: main's back control (the front is a door away)", async () => {
    const o = ownersApi(['owner-b']);
    const readers = readersOf({ [D]: sep23Tape }, sep23Series);
    await open({ battle: battleOf(sep23Tape, { ownerId: 'owner-a' }), readers, cardsApi: o.cardsApi });
    m.click(m.q('[data-flow-door]')); await m.flush();
    m.render(screen({ battle: battleOf(sep23Tape, { ownerId: 'owner-b' }), readers, cardsApi: o.cardsApi }));
    await m.flush();
    o.answer['owner-b'](true); await m.flush();
    expect(onTape()).toBe(true);
    expect(backLabel()).toBe('‹ Dashboard');
  });
  it("N3's control (passes at both heads): the same owner, front → tape — \"Game flow\", and it returns to the front", async () => {
    await open({ battle: battleOf(sep23Tape, { ownerId: 'owner-a' }) });
    m.click(m.q('[data-flow-door]')); await m.flush();
    expect(backLabel()).toBe('‹ Game flow');
    m.click(m.q('header button')); await m.flush();
    expect(onFront()).toBe(true);
  });
  it('N4: admitted with NO owner, then refreshed to the owner string "null" (held) — a pointer-down on the pending tape keeps it when "null" is admitted', async () => {
    const o = ownersApi(['null']);
    const readers = readersOf({ [D]: sep23Tape }, sep23Series);
    await open({ battle: battleOf(sep23Tape), readers, cardsApi: o.cardsApi });
    expect(onFront()).toBe(true);
    m.render(screen({ battle: battleOf(sep23Tape, { ownerId: 'null' }), readers, cardsApi: o.cardsApi }));
    expect(onTape()).toBe(true);                       // its first pending paint
    await m.flush();
    expect(o.calls).toContain('null');
    const study = m.tab('Study');
    act(() => { study.dispatchEvent(pointer('pointerdown')); });
    o.answer.null(true); await m.flush();
    expect(onTape()).toBe(true);
    expect(study.isConnected).toBe(true);
  });
  it("N4's control (passes at both heads): the same refresh with no gesture — \"null\" admitted opens its front", async () => {
    const o = ownersApi(['null']);
    const readers = readersOf({ [D]: sep23Tape }, sep23Series);
    await open({ battle: battleOf(sep23Tape), readers, cardsApi: o.cardsApi });
    m.render(screen({ battle: battleOf(sep23Tape, { ownerId: 'null' }), readers, cardsApi: o.cardsApi }));
    await m.flush();
    o.answer.null(true); await m.flush();
    expect(onFront()).toBe(true);
  });
});
