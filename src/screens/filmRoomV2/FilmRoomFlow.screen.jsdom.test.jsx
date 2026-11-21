// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomFlow.screen.jsdom.test.jsx
//
// Film Room D1 items 1, 5 and 6 — THE FRONT IN THE SHELL (Build D spec §2, §3, §4, §9, §10):
//   the gate        per battle owner; a verdict for another battle never stands for this one; the flow asks no
//                   second verdict for a battle the cards already asked about (the real cached reader, counted)
//   the opening     the front only when the flow resolves on, the screen was not opened at a moment, and the day has
//                   a written tape; otherwise the screen as before (F-DOOR's moment row)
//   the header      the back control, the day's pills and the day picker — not the title, the subtitle, the depth
//                   control, the legend, the card regions or the first-open notice (§4)
//   F-DOOR          front → tape (Glance, focus on its panel; back reads "Game flow") → front (focus on the door);
//                   a pin's link → Study at the swap or the directives; a change of day; focus after each
//   F-CARDS         the cards line with one moment, several, none, and with cards off (nothing asked of the cards)

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
import { momentAnchor } from './filmRoomCards';
import { hasSeenFirstOpen } from './filmRoomSeen';
import { mounter, sep23Tape, sep23Series, emptyTape, clone, battleOf, readersOf, NOW, sweepFlow, flowCopyDefects, sweepWords, quoteDefects } from './__fixtures__/filmRoomHarness';

const m = mounter();
beforeEach(() => { flags.flow = 'on'; flags.cards = 'off'; resetFilmRoomVerdicts(); globalThis.localStorage.clear(); m.setup(); });
afterEach(() => m.teardown());

const D = sep23Tape.etDate;
const api = (over = {}) => {
  const calls = { verdict: [], counter: 0 };
  return {
    calls,
    readVerdict: async (id, o) => { calls.verdict.push([id, o]); return over.verdict ?? true; },
    readCounter: async () => { calls.counter += 1; return { ok: true, status: 200, body: { cards: [], attributionAgentId: 'agent-1' } }; },
    postCard: async () => ({ ok: false, status: 400, body: { error: 'x' } }),
    newOpId: () => 'op_1',
    ...over.fns,
  };
};
async function open({ battle = battleOf(sep23Tape, { ownerId: 'owner-1' }), tapes = { [D]: sep23Tape }, cardsApi = api(), openAt = null, onBack = () => {} } = {}) {
  const readers = readersOf(tapes, sep23Series);
  m.render(<FilmRoomScreenV2 battle={battle} onBack={onBack} viewerId="viewer-1" readers={readers} nowMs={NOW} cardsApi={cardsApi} openAt={openAt} onOpenAtUsed={() => {}} />);
  await m.flush();
  return { readers, cardsApi };
}
const onFront = () => Boolean(m.q('[data-view="flow"] [data-flow-front]'));
const onTape = () => Boolean(m.q('[role="tablist"]')) && !m.q('[data-flow-front]');
const backLabel = () => m.q('header button').textContent;
const shownPanel = () => m.qa('[role="tabpanel"]').find((p) => !p.hidden);

describe('item 1 on the screen — the gate per battle owner', () => {
  it("'on': the front, no verdict asked; 'off': the tape, no verdict asked; an unknown value: the tape", async () => {
    let r = await open();
    expect(onFront()).toBe(true);
    expect(r.cardsApi.calls.verdict).toEqual([]);
    m.teardown(); m.setup();
    flags.flow = 'off';
    r = await open();
    expect(onTape()).toBe(true);
    expect(r.cardsApi.calls.verdict).toEqual([]);
    m.teardown(); m.setup();
    flags.flow = 'ALLOWLIST';
    r = await open();
    expect(onTape()).toBe(true);
    expect(r.cardsApi.calls.verdict).toEqual([]);
  });

  it("'allowlist': the verdict asked for the battle with the owner the cards pass — admitted: the front; not admitted: the tape", async () => {
    flags.flow = 'allowlist';
    let r = await open();
    expect(onFront()).toBe(true);
    expect(r.cardsApi.calls.verdict).toEqual([[sep23Tape.battleId, { ownerId: 'owner-1' }]]);
    m.teardown(); m.setup();
    r = await open({ cardsApi: api({ verdict: false }) });
    expect(onTape()).toBe(true);
  });

  it('no second verdict request for a battle the cards already asked about: the real cached reader, one request between the two gates', async () => {
    flags.flow = 'allowlist'; flags.cards = 'allowlist';
    const request = vi.fn(async () => ({ ok: true, allowlisted: true }));
    const cardsApi = { ...api(), readVerdict: (id, o) => readFilmRoomVerdict(id, { ...o, request }) };
    await open({ cardsApi });
    expect(onFront()).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
    m.teardown(); m.setup();
    await open({ cardsApi });   // the next open: the cache answers both
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('a verdict for another battle never stands for this one: battle A admitted, then the screen handed battle B — off until B\'s own answer', async () => {
    flags.flow = 'allowlist';
    let answerB;
    const cardsApi = { ...api(), readVerdict: (id) => (id === 'battle-b' ? new Promise((r) => { answerB = r; }) : Promise.resolve(true)) };
    const tapeB = clone(sep23Tape); tapeB.battleId = 'battle-b';
    const readers = readersOf({ [D]: sep23Tape }, []);
    const readersB = readersOf({ [D]: tapeB }, []);
    m.render(<FilmRoomScreenV2 battle={battleOf(sep23Tape, { ownerId: 'owner-1' })} onBack={() => {}} viewerId="viewer-1" readers={readers} nowMs={NOW} cardsApi={cardsApi} />);
    await m.flush();
    expect(onFront()).toBe(true);
    m.render(<FilmRoomScreenV2 battle={battleOf(tapeB, { ownerId: 'owner-2' })} onBack={() => {}} viewerId="viewer-1" readers={readersB} nowMs={NOW} cardsApi={cardsApi} />);
    await m.flush();
    expect(onFront()).toBe(false);
    answerB(true);
    await m.flush();
    expect(onFront()).toBe(true);
  });
});

describe('§3, §4 — the opening and the front\'s header', () => {
  it('the header holds the back control, the pills and (multi-day) the day picker — never the title, the subtitle, the depth control, the legend, the card regions or the first-open notice', async () => {
    const D1 = '2026-09-22';
    const early = clone(sep23Tape); early.etDate = D1; early.battle = { status: 'active', completedAt: null, final: null, result: { value: null, basis: 'not_completed' }, completionMessage: null };
    flags.cards = 'on';
    await open({ battle: battleOf(sep23Tape, { ownerId: 'owner-1', timing: { tradingDays: [D1, D] } }), tapes: { [D1]: early, [D]: sep23Tape } });
    expect(onFront()).toBe(true);
    const header = m.q('header');
    expect(backLabel()).toBe('‹ Dashboard');
    expect(header.textContent).toContain('Film Room');
    expect(header.textContent).toContain('battle complete');
    expect(m.q('[data-region="day-picker"]')).toBeTruthy();
    expect(header.querySelector('h1, [data-header-subtitle], [role="tablist"], [data-legend="number-kinds"], [data-agent-mark], [data-cards-regions], [data-reserved-region]')).toBeNull();
    expect(m.q('[data-region="first-open"]')).toBeNull();
    expect(m.q('footer')).toBeNull();
    expect(m.q('[data-flow-counts] h2').textContent).toBe('This day');
  });

  it('the first open: the off layout (the tape) until the tape is written and the verdict in; a day with no tape is the no-tape page', async () => {
    await open({ tapes: {} });
    expect(onFront()).toBe(false);
    expect(m.q('[data-state="missing"]')).toBeTruthy();
    expect(m.q('[role="tablist"]')).toBeTruthy();
  });

  it('a screen opened AT A MOMENT opens on the tape, with the back control it always had', async () => {
    const moment = { battleId: sep23Tape.battleId, etDate: D, situationId: 'stalled', symbol: 'MSFT', fromTickSeq: 8, toTickSeq: 9 };
    await open({ openAt: { battleId: sep23Tape.battleId, etDate: D, moment } });
    expect(onFront()).toBe(false);
    expect(onTape()).toBe(true);
    expect(backLabel()).toBe('‹ Dashboard');
    expect(momentAnchor(moment)).toBe('moment-MSFT-8-9');
  });

  it('an openAt for another battle — rejected as on main — still opens on the tape (the screen was opened at a moment)', async () => {
    await open({ openAt: { battleId: 'someone-else', etDate: D, moment: { situationId: 'stalled', symbol: 'X', fromTickSeq: 1, toTickSeq: 2 } } });
    expect(onTape()).toBe(true);
  });

  it('the whole front page sweeps clean, the header included in the word sweep', async () => {
    await open();
    expect(sweepFlow(m.container, { tape: sep23Tape })).toEqual([]);
    expect(flowCopyDefects(m.container)).toEqual([]);
    expect(sweepWords(m.container, { tape: sep23Tape })).toEqual([]);
    expect(quoteDefects(m.container, { tape: sep23Tape })).toEqual([]);
  });
});

describe('F-DOOR — the door, the way back, the pins\' links, a change of day; focus after each', () => {
  it('front → "Open the full tape" → the tape on Glance, focus on its panel, back reads "Game flow" → the front, focus on the door; then back leaves', async () => {
    const left = vi.fn();
    await open({ onBack: left });
    const door = m.q('[data-flow-door]');
    door.focus();
    m.click(door);
    await m.flush();
    expect(onTape()).toBe(true);
    expect(m.tab('Glance').getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(shownPanel());
    expect(backLabel()).toBe('‹ Game flow');
    m.q('header button').focus();
    m.click(m.q('header button'));
    await m.flush();
    expect(onFront()).toBe(true);
    expect(document.activeElement).toBe(m.q('[data-flow-door]'));
    expect(left).not.toHaveBeenCalled();
    expect(backLabel()).toBe('‹ Dashboard');
    m.click(m.q('header button'));
    expect(left).toHaveBeenCalledTimes(1);
  });

  it('the tape behind the door is the tape: its title, depth control, legend, first-open notice and reserved regions, as before', async () => {
    await open();
    m.click(m.q('[data-flow-door]'));
    await m.flush();
    expect(m.q('h1').textContent).toBe('Film Room');
    expect(m.q('[data-legend="number-kinds"]')).toBeTruthy();
    expect(m.q('[data-region="first-open"]')).toBeTruthy();
    expect(m.q('[data-reserved-region="header"]')).toBeTruthy();
    expect(m.q('[data-depth="glance"]')).toBeTruthy();
    m.click(m.tab('Study')); await m.flush();
    m.click(m.tab('Deep dive')); await m.flush();
    expect(onTape()).toBe(true);   // the depth control moves the tape, never back to the front
    expect(backLabel()).toBe('‹ Game flow');
  });

  it('a swap pin\'s link opens Study at that swap\'s card, focused; a directive pin\'s at the directives, focused', async () => {
    await open();
    m.click(m.q('[data-flow-pin-link]'));   // the agent's swap, selected on opening
    await m.flush();
    expect(m.tab('Study').getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(document.getElementById('swap-2'));
    expect(document.activeElement.getAttribute('data-swap-card')).toBe('1');
    m.click(m.q('header button')); await m.flush();
    expect(onFront()).toBe(true);
    // fix round item 4 (DA-11): the 2:20 PM directive is in the agent's group, "3–5" — one step on from the opening pin
    m.click(m.qa('[data-flow-stepper] button').find((b) => b.textContent === 'Next'));
    m.click(m.q('[data-flow-pin-link]'));
    await m.flush();
    expect(document.activeElement).toBe(document.getElementById('directives'));
  });

  it('a change of day on the front shows that day\'s front, or the no-tape page; back from there leaves', async () => {
    const D1 = '2026-09-22';
    const D0 = '2026-09-21';
    const early = clone(sep23Tape); early.etDate = D1; early.battle = { status: 'active', completedAt: null, final: null, result: { value: null, basis: 'not_completed' }, completionMessage: null };
    await open({ battle: battleOf(sep23Tape, { ownerId: 'owner-1', timing: { tradingDays: [D0, D1, D] } }), tapes: { [D1]: early, [D]: sep23Tape } });
    expect(m.q('[data-flow-heading]').textContent).toBe('Won by 46');
    const chips = () => m.qa('[data-region="day-picker"] button');
    m.click(chips()[1]); await m.flush();
    expect(onFront()).toBe(true);
    expect(m.q('[data-flow-heading]').textContent).toBe('Tue, Sep 22, 2026');
    expect(m.q('[data-flow-key="cpu"]').textContent).toBe('CPU −83');
    m.click(chips()[0]); await m.flush();
    expect(onFront()).toBe(false);
    expect(m.q('[data-state="missing"]')).toBeTruthy();
    expect(backLabel()).toBe('‹ Dashboard');
    m.click(chips()[2]); await m.flush();
    expect(onFront()).toBe(true);
  });

  it('a verdict that lands after the player has used the depth control does not take the tape away (it stays the tape, back as before)', async () => {
    flags.flow = 'allowlist';
    let admit;
    const cardsApi = { ...api(), readVerdict: () => new Promise((r) => { admit = r; }) };
    await open({ cardsApi });
    expect(onTape()).toBe(true);
    // a press, as a browser sends one: its pointer-down, then its click (fix round item 6, DB-4: the guard holds from the start)
    act(() => { m.tab('Study').dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true })); });
    m.click(m.tab('Study')); await m.flush();
    admit(true); await m.flush();
    expect(onTape()).toBe(true);
    expect(backLabel()).toBe('‹ Dashboard');
  });
});

describe('F-CARDS — the cards line (§9)', () => {
  const withMoments = (runs) => {
    const t = clone(sep23Tape);
    t.coverage.tags = { status: 'complete', note: null };
    t.tags.items = runs.flatMap(([sym, from, to]) => Array.from({ length: to - from + 1 }, (_, k) => ({ situationId: 'stalled', symbol: sym, tickSeq: from + k, at: sep23Tape.checks[from + k - 1].at, count: 3 })));
    return t;
  };
  it('cards on, one moment: "1 moment to take home, on the full tape"; a tap opens the tape on Glance', async () => {
    flags.cards = 'on';
    const tape = withMoments([['MSFT', 8, 10]]);
    await open({ tapes: { [D]: tape } });
    expect(m.q('[data-flow-cards-line]').textContent).toBe('1 moment to take home, on the full tape');
    expect(sweepFlow(m.container, { tape, moments: 1 })).toEqual([]);
    m.click(m.q('[data-flow-cards-line]')); await m.flush();
    expect(onTape()).toBe(true);
    expect(m.tab('Glance').getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(shownPanel());
    expect(m.q('[data-cards-region="prepared-case"]')).toBeTruthy();   // the card regions are the tape's
  });
  it('several: "3 moments …"; none (the tagger found none, or could not tag): no line', async () => {
    flags.cards = 'on';
    await open({ tapes: { [D]: withMoments([['MSFT', 8, 10], ['ETN', 12, 13], ['DE', 15, 15]]) } });
    expect(m.q('[data-flow-cards-line]').textContent).toBe('3 moments to take home, on the full tape');
    m.teardown(); m.setup();
    await open({ tapes: { [D]: withMoments([]) } });
    expect(m.q('[data-flow-cards-line]')).toBeNull();
    m.teardown(); m.setup();
    await open();   // sep23: the tagger marked the day unavailable
    expect(m.q('[data-flow-cards-line]')).toBeNull();
  });
  it('cards off: no line, and nothing asked of the cards — no verdict, no counter', async () => {
    flags.cards = 'off';
    const r = await open({ tapes: { [D]: withMoments([['MSFT', 8, 10]]) } });
    expect(onFront()).toBe(true);
    expect(m.q('[data-flow-cards-line]')).toBeNull();
    expect(r.cardsApi.calls.counter).toBe(0);
    expect(r.cardsApi.calls.verdict).toEqual([]);
    expect(m.container.textContent).not.toMatch(/moment|Take this home|Since last time|My cards/);
  });
  it('the empty day\'s front: the quiet line, no tiles, no legend — and every sweep clean', async () => {
    const tape = clone(emptyTape);
    await open({ battle: battleOf(tape, { ownerId: 'owner-1' }), tapes: { [tape.etDate]: tape } });
    // written with no check: a completed day whose result was not recorded — "Final 0", the key's own entry alone (the
    // CPU's final is not recorded), the final point alone on the chart, no pin, no tile
    expect(onFront()).toBe(true);
    expect(m.q('[data-flow-heading]').textContent).toBe('Final 0');
    expect(m.qa('[data-flow-key]').map((k) => k.textContent)).toEqual(['You 0']);
    expect(m.q('[data-flow-quiet]').textContent).toBe('Nothing stood out in this game.');
    expect(m.q('[data-flow-tile]')).toBeNull();
    expect(m.q('[data-flow-legend]')).toBeNull();
    expect(m.q('[data-flow-pin]')).toBeNull();
    expect(sweepFlow(m.container, { tape })).toEqual([]);
    expect(flowCopyDefects(m.container)).toEqual([]);
    expect(sweepWords(m.container, { tape })).toEqual([]);
  });
});

describe('the review round — the doors, the focus and the notice', () => {
  const D1 = '2026-09-22';
  const D0 = '2026-09-21';
  const early = () => { const t = clone(sep23Tape); t.etDate = D1; t.isFinalDay = false; t.battle = { status: 'active', completedAt: null, final: null, result: { value: null, basis: 'not_completed' }, completionMessage: null }; return t; };
  /** Readers whose reads of `held` days wait until released; every call recorded. */
  function heldReaders(tapes, held = []) {
    const calls = []; const waiting = {};
    const answer = (d) => (tapes[d] ? { status: 'ready', tape: tapes[d] } : { status: 'missing', tape: null });
    return {
      calls,
      release: (d) => waiting[d]?.(),
      readTape: (b, d) => { calls.push(['tape', d]); return held.includes(d) ? new Promise((r) => { waiting[d] = () => r(answer(d)); }) : Promise.resolve(answer(d)); },
      readSeries: async (b, d) => { calls.push(['series', d]); return { status: 'ready', series: [] }; },
    };
  }
  const mountWith = async (readers, days, cardsApi = api()) => {
    m.render(<FilmRoomScreenV2 battle={battleOf(sep23Tape, { ownerId: 'owner-1', timing: { tradingDays: days } })} onBack={() => {}} viewerId="viewer-1" readers={readers} nowMs={NOW} cardsApi={cardsApi} />);
    await m.flush();
  };
  const chips = () => m.qa('[data-region="day-picker"] button');

  it('DR-1: a day picked on the front, still being read, keeps the front\'s frame — no tape layout painted — and the picked chip keeps the focus; then that day\'s front', async () => {
    const r = heldReaders({ [D1]: early(), [D]: sep23Tape }, [D1]);
    await mountWith(r, [D1, D]);
    expect(onFront()).toBe(true);
    const chip = chips()[0];
    chip.focus();
    m.click(chip);
    await m.flush();
    expect(m.q('[data-view="flow"] [data-flow-loading]')).toBeTruthy();
    expect(m.q('[role="tablist"], h1, [data-region="first-open"], [data-legend="number-kinds"]')).toBeNull();
    expect(chip.isConnected).toBe(true);
    expect(document.activeElement).toBe(chip);
    r.release(D1);
    await m.flush();
    expect(onFront()).toBe(true);
    expect(m.q('[data-flow-heading]').textContent).toBe('Tue, Sep 22, 2026');
    expect(document.activeElement).toBe(chips()[0]);
  });

  it('DR-1, the other ending: a day picked on the front that has NO tape — the frame while it is read, then the no-tape page, and the picked chip keeps the focus through both', async () => {
    const r = heldReaders({ [D]: sep23Tape }, [D0]);
    await mountWith(r, [D0, D]);
    expect(onFront()).toBe(true);
    const chip = chips()[0];
    chip.focus();
    m.click(chip);
    await m.flush();
    expect(m.q('[data-view="flow"] [data-flow-loading]')).toBeTruthy();
    r.release(D0);
    await m.flush();
    expect(m.q('[data-state="missing"]')).toBeTruthy();
    expect(chip.isConnected).toBe(true);
    expect(document.activeElement).toBe(chip);
  });

  it('DR-2: a depth tab on a no-tape page reached from the front does not cost the front — the next taped day is its front', async () => {
    const r = heldReaders({ [D]: sep23Tape }, []);
    await mountWith(r, [D0, D]);
    expect(onFront()).toBe(true);
    m.click(chips()[0]); await m.flush();
    expect(m.q('[data-state="missing"]')).toBeTruthy();
    m.click(m.tab('Study')); await m.flush();
    m.click(chips()[1]); await m.flush();
    expect(onFront()).toBe(true);
  });

  it('DR-3: the first-open notice is not used up by the front — it is marked seen once the tape shows it; with the flow off, at the first paint as before', async () => {
    await open();
    expect(onFront()).toBe(true);
    expect(hasSeenFirstOpen('viewer-1')).toBe(false);
    m.click(m.q('[data-flow-door]')); await m.flush();
    expect(m.q('[data-region="first-open"]')).toBeTruthy();
    expect(hasSeenFirstOpen('viewer-1')).toBe(true);
    m.teardown(); m.setup();
    globalThis.localStorage.clear();
    flags.flow = 'off';
    await open();
    expect(hasSeenFirstOpen('viewer-1')).toBe(true);
  });

  it('DR-4: the series is never read for the front — not after the Deep dive and "Game flow", nor for another day picked there', async () => {
    const r = heldReaders({ [D1]: early(), [D]: sep23Tape }, []);
    await mountWith(r, [D1, D]);
    m.click(m.q('[data-flow-door]')); await m.flush();
    m.click(m.tab('Deep dive')); await m.flush();
    expect(r.calls.filter((c) => c[0] === 'series')).toEqual([['series', D]]);
    m.click(m.q('header button')); await m.flush();   // "Game flow"
    expect(onFront()).toBe(true);
    m.click(chips()[0]); await m.flush();
    expect(onFront()).toBe(true);
    expect(r.calls.filter((c) => c[0] === 'series')).toEqual([['series', D]]);
  });

  it('DR-5: "Game flow" pressed while the tape\'s new day is being read lands the focus on the door once that day\'s front is there', async () => {
    const r = heldReaders({ [D1]: early(), [D]: sep23Tape }, [D1]);
    await mountWith(r, [D1, D]);
    m.click(m.q('[data-flow-door]')); await m.flush();
    m.click(chips()[0]); await m.flush();   // on the tape: the earlier day, its read held
    const back = m.q('header button');
    expect(back.textContent).toBe('‹ Game flow');
    back.focus();
    m.click(back); await m.flush();
    r.release(D1); await m.flush();
    expect(onFront()).toBe(true);
    expect(document.activeElement).toBe(m.q('[data-flow-door]'));
  });

  // fix round item 6 (Amendment B DB-4): the guard holds from the gesture's START — a press is a pointer-down, then its click
  it('DR-7: a press anywhere on the tape before the verdict lands keeps the tape — the verdict landing late takes nothing away', async () => {
    flags.flow = 'allowlist';
    let admit;
    const cardsApi = { ...api(), readVerdict: () => new Promise((res) => { admit = res; }) };
    await open({ cardsApi });
    expect(onTape()).toBe(true);
    const target = m.q('[data-depth="glance"] button');
    act(() => { target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true })); });
    m.click(target);
    admit(true); await m.flush();
    expect(onTape()).toBe(true);
  });
});

describe('the review round — the requests', () => {
  it("OP-2: a screen opened at a moment under 'allowlist' never asks the verdict for the flow (the front can never show)", async () => {
    flags.flow = 'allowlist';
    const moment = { battleId: sep23Tape.battleId, etDate: D, situationId: 'stalled', symbol: 'MSFT', fromTickSeq: 8, toTickSeq: 9 };
    const r = await open({ openAt: { battleId: sep23Tape.battleId, etDate: D, moment } });
    expect(onTape()).toBe(true);
    expect(r.cardsApi.calls.verdict).toEqual([]);
    m.teardown(); m.setup();
    const r2 = await open();   // the control: opened plainly, it asks once
    expect(r2.cardsApi.calls.verdict).toHaveLength(1);
  });
});

describe("the review round — the tests' gaps in the shell (TI-1, TI-3)", () => {
  it('M12: a tape document whose close pass did not write the day (no checks) is not "written": no front — the page it always showed', async () => {
    const t = clone(sep23Tape);
    delete t.checks;
    t.passes.close.status = 'error';
    await open({ tapes: { [D]: t } });
    expect(onFront()).toBe(false);
    expect(m.q('[data-state="not-written"]')).toBeTruthy();
  });
  it('M48: the door always opens the tape ON GLANCE — after a trip to the Deep dive and "Game flow" too', async () => {
    await open();
    m.click(m.q('[data-flow-door]')); await m.flush();
    m.click(m.tab('Deep dive')); await m.flush();
    m.click(m.q('header button')); await m.flush();
    expect(onFront()).toBe(true);
    m.click(m.q('[data-flow-door]')); await m.flush();
    expect(m.tab('Glance').getAttribute('aria-selected')).toBe('true');
    expect(m.q('[data-depth="glance"]')).toBeTruthy();
  });
  it('M11: a one-day battle\'s counts are "This game" through the shell', async () => {
    await open();
    expect(m.q('[data-flow-counts] h2').textContent).toBe('This game');
  });
});

describe("the refuter's round — the keyboard and the notice", () => {
  it('N-2: the depth control moved BY KEYBOARD before the verdict lands keeps the tape too (and the focus on its tab)', async () => {
    flags.flow = 'allowlist';
    let admit;
    const cardsApi = { ...api(), readVerdict: () => new Promise((res) => { admit = res; }) };
    await open({ cardsApi });
    const glance = m.tab('Glance');
    glance.focus();
    act(() => { glance.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })); });
    await m.flush();
    expect(m.tab('Study').getAttribute('aria-selected')).toBe('true');
    admit(true); await m.flush();
    expect(onTape()).toBe(true);
    expect(document.activeElement).toBe(m.tab('Study'));
  });
  it("N-1b: under 'allowlist' answered no, the notice is marked seen on the first paint it shows on, as before Build D — the day's read still on its way", async () => {
    flags.flow = 'allowlist';
    const readers = { readTape: () => new Promise(() => {}), readSeries: async () => ({ status: 'ready', series: [] }) };
    m.render(<FilmRoomScreenV2 battle={battleOf(sep23Tape, { ownerId: 'owner-1' })} onBack={() => {}} viewerId="viewer-1" readers={readers} nowMs={NOW} cardsApi={api({ verdict: false })} />);
    await m.flush();
    expect(m.q('[data-region="first-open"]')).toBeTruthy();
    expect(hasSeenFirstOpen('viewer-1')).toBe(true);
  });
});
