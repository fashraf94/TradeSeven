// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomFlow.off.golden.jsdom.test.jsx
//
// Film Room D1 — F-OFF (Build D spec §2; exit criterion 1): with FILM_ROOM_FLOW_MODE 'off', and under 'allowlist' for
// an owner the verdict does not admit, the screen is the screen before Build D — the twelve committed goldens
// (src/screens/__golden__/filmRoomV2.*.html, pinned by SHA-256 in FilmRoomScreenV2.cardsOff.golden.jsdom.test.jsx),
// UNEDITED — at every paint, with the verdict pending and after it, and its requests are the ones it sent before:
//   every paint     the HTML after the first render and after every turn of the event loop the mount takes is the
//                   same sequence under 'off', under 'allowlist' with the verdict still on its way, and under
//                   'allowlist' once it has answered no — and its last paint is the golden
//   pending → no    a verdict held on its way through the whole photograph, then answered no on the same mount: the
//                   golden before and after
//   requests        cards 'allowlist' (as shipped): the flow adds no request — the one verdict ask is the cards',
//                   shared through readFilmRoomVerdict's cache; cards 'off': the flow's own ask, the one request a
//                   screen with cards off and the flow 'allowlist' sends (report question Q-1)
// The goldens are compared as the cards-off suite compares them (the same harness, fixtures, clock, zone and useId
// renumbering); nothing here regenerates one.

process.env.TZ = 'UTC';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.setConfig({ testTimeout: 180_000 });
import React, { act } from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const flags = vi.hoisted(() => ({ cards: 'off', flow: 'off' }));
vi.mock('../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_ROOM_CARDS_MODE() { return flags.cards; },
  get FILM_ROOM_FLOW_MODE() { return flags.flow; },
}));
const auth = vi.hoisted(() => ({ user: { uid: 'owner-1', getIdToken: async () => 'token' } }));
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({ currentUser: auth.user })) }));

import FilmRoomScreenV2 from './FilmRoomScreenV2.jsx';
import { resetFilmRoomVerdicts } from '../../utils/filmRoomGate';
import { mounter, sep23Tape, sep23Series, emptyTape, emptySeries, battleOf, readersOf, NOW } from './__fixtures__/filmRoomHarness';
import { renumberIds, GOLDEN_DEPTHS, GOLDEN_LAYOUTS, goldenName } from '../__golden__/filmRoomV2Golden.js';

const DAYS = [['sep23', sep23Tape, sep23Series], ['empty', emptyTape, emptySeries]];
const CASES = GOLDEN_LAYOUTS.flatMap((layout) => DAYS.flatMap(([day, tape, series]) => GOLDEN_DEPTHS.map(([label, depth]) => ({ layout, day, tape, series, label, depth, file: goldenName(day, depth, layout) }))));
const golden = (name) => readFileSync(path.join(process.cwd(), 'src', 'screens', '__golden__', name)).toString('utf8');

const m = mounter();
const realFetch = globalThis.fetch;
let fetches;
let held;   // the answers held on their way
let hadMatchMedia;
beforeEach(() => {
  resetFilmRoomVerdicts();
  flags.cards = 'off';
  flags.flow = 'off';
  auth.user = { uid: 'owner-1', getIdToken: async () => 'token' };
  fetches = [];
  held = [];
  hadMatchMedia = window.matchMedia;
});
afterEach(() => { window.matchMedia = hadMatchMedia; globalThis.fetch = realFetch; });

/** The server's verdict: answered at once (`allowlisted`), or HELD on its way until `release` answers it. */
function verdict(mode) {
  globalThis.fetch = vi.fn((url) => {
    fetches.push(String(url));
    const body = { on: false, allowlisted: false };
    if (mode === 'held') return new Promise((resolve) => { held.push(() => resolve({ ok: true, status: 200, json: async () => body })); });
    return Promise.resolve({ ok: true, status: 200, json: async () => body });
  });
}
const release = async () => { for (const r of held.splice(0)) r(); await m.flush(); };

/** One turn of the event loop, then the HTML as painted. */
const turn = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); return renumberIds(m.container.innerHTML); };

/**
 * Mount the screen at one case as the capture harness did, recording the HTML after the first render and after EVERY
 * turn the mount, the tab and the settling take — every paint. Returns the paints; the mount stays up for `then`.
 */
async function paints(c, then = null) {
  window.matchMedia = c.layout === 'desktop' ? () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }) : hadMatchMedia;
  globalThis.localStorage.clear();
  m.setup();
  const out = [];
  try {
    m.render(<FilmRoomScreenV2 battle={battleOf(c.tape, { ownerId: 'owner-1' })} onBack={() => {}} viewerId="viewer-1" readers={readersOf({ [c.tape.etDate]: c.tape }, c.series)} nowMs={NOW} />);
    out.push(renumberIds(m.container.innerHTML));
    for (let i = 0; i < 6; i += 1) out.push(await turn());
    m.click(m.tab(c.label));
    out.push(renumberIds(m.container.innerHTML));
    for (let i = 0; i < 12; i += 1) out.push(await turn());
    if (then) out.push(...(await then()));
    return out;
  } finally {
    m.teardown();
  }
}
/** Consecutive equal paints collapse to one: the sequence of distinct states the player sees. */
const distinct = (list) => list.filter((h, i) => i === 0 || h !== list[i - 1]);

describe('F-OFF — every paint: the flow off, and the flow allowlisted for an owner not admitted, are the screen before Build D', () => {
  it("cards 'off' (the goldens' own mode): 'off', 'allowlist' pending and 'allowlist' answered no paint the same sequence at every case, ending at the golden", async () => {
    for (const c of CASES) {
      flags.cards = 'off';
      flags.flow = 'off'; resetFilmRoomVerdicts(); verdict('now');
      const off = await paints(c);
      expect(off.at(-1), `${c.file} off`).toBe(golden(c.file));
      flags.flow = 'allowlist'; resetFilmRoomVerdicts(); verdict('held');
      const pending = await paints(c, async () => [await (async () => { await release(); return renumberIds(m.container.innerHTML); })()]);
      expect(pending, `${c.file} pending, then no`).toEqual([...off, off.at(-1)]);
      flags.flow = 'allowlist'; resetFilmRoomVerdicts(); verdict('now');
      const answered = await paints(c);
      expect(answered, `${c.file} answered no`).toEqual(off);
    }
  });

  it("cards 'allowlist' as shipped, the owner not admitted: the same, at every case — and the requests are the cards' alone", async () => {
    for (const c of CASES.filter((x) => x.depth === 'glance' || x.layout === 'phone')) {
      flags.cards = 'allowlist';
      flags.flow = 'off'; resetFilmRoomVerdicts(); verdict('now'); fetches = [];
      const off = await paints(c);
      const offRequests = [...fetches];
      expect(off.at(-1), `${c.file} off`).toBe(golden(c.file));
      flags.flow = 'allowlist'; resetFilmRoomVerdicts(); verdict('now'); fetches = [];
      const on = await paints(c);
      expect(on, `${c.file} allowlist`).toEqual(off);
      expect(fetches, `${c.file}: the flow adds no request`).toEqual(offRequests);
      expect(fetches).toHaveLength(1);
      flags.flow = 'allowlist'; resetFilmRoomVerdicts(); verdict('held'); fetches = [];
      const pending = await paints(c);
      expect(pending, `${c.file} pending`).toEqual(off);
      expect(fetches).toHaveLength(1);
      await release();
    }
  });

  it("the off layout is ONE layout at every paint — no front, no flow markup, ever, while the verdict is pending", async () => {
    flags.cards = 'allowlist'; flags.flow = 'allowlist';
    const c = CASES.find((x) => x.day === 'sep23' && x.depth === 'glance' && x.layout === 'phone');
    resetFilmRoomVerdicts(); verdict('held');
    const all = await paints(c);
    for (const html of all) expect(html).not.toMatch(/data-flow-|data-view="flow"|Open the full tape|Game flow/);
    expect(distinct(all).length).toBeGreaterThan(1);   // the sequence holds real paints (loading, then the tape)
    await release();
  });

  it("cards 'off', the flow 'allowlist': the golden holds, and the one request is the flow's own ask (Q-1)", async () => {
    flags.cards = 'off'; flags.flow = 'allowlist';
    const c = CASES.find((x) => x.day === 'sep23' && x.depth === 'study' && x.layout === 'phone');
    resetFilmRoomVerdicts(); verdict('now'); fetches = [];
    expect((await paints(c)).at(-1)).toBe(golden(c.file));
    expect(fetches).toEqual([`/api/agent/cockpit-status?battleId=${encodeURIComponent(sep23Tape.battleId)}`]);
    flags.flow = 'off'; resetFilmRoomVerdicts(); verdict('now'); fetches = [];
    await paints(c);
    expect(fetches).toEqual([]);
  });

  it('the control: an ADMITTED owner under \'allowlist\' is not the golden — the comparison can fail', async () => {
    flags.cards = 'off'; flags.flow = 'allowlist';
    const c = CASES.find((x) => x.day === 'sep23' && x.depth === 'glance' && x.layout === 'phone');
    resetFilmRoomVerdicts();
    globalThis.fetch = vi.fn(async (url) => { fetches.push(String(url)); return { ok: true, status: 200, json: async () => ({ on: false, allowlisted: true }) }; });
    window.matchMedia = hadMatchMedia;
    m.setup();
    try {
      m.render(<FilmRoomScreenV2 battle={battleOf(c.tape, { ownerId: 'owner-1' })} onBack={() => {}} viewerId="viewer-1" readers={readersOf({ [c.tape.etDate]: c.tape }, c.series)} nowMs={NOW} />);
      await m.flush();
      const html = renumberIds(m.container.innerHTML);
      expect(html).not.toBe(golden(c.file));
      expect(html).toContain('data-view="flow"');
    } finally {
      m.teardown();
    }
  });
});
