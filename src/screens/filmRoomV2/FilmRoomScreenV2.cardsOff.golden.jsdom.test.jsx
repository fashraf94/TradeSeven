// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomScreenV2.cardsOff.golden.jsdom.test.jsx
//
// Film Room B2 item 8 / acceptance J — WITH CARDS OFF, OR THE OWNER NOT
// ADMITTED, THE SCREEN IS THE CURRENT v2, BYTE FOR BYTE (Build B spec §7, §8
// criterion 5; Amendment G RG-2, RG-10: "the current v2" is the screen at
// this build's base with FILM_ROOM_V2_MODE 'on'). The twelve goldens under
// src/screens/__golden__/filmRoomV2.*.html were captured from a `git archive`
// of the base commit 7818a1b3 — NOT from this tree — by
// captureFilmRoomV2Golden.jsdom.test.jsx run twice (identical) in a scratch
// extraction; their SHA-256 is pinned below, so the label inside this file
// proves nothing by itself. This suite mounts the CURRENT FilmRoomScreenV2
// under the same harness, fixtures, clock and zone, renumbers React's useId
// values the same way, and asserts string equality:
//   FILM_ROOM_CARDS_MODE 'off'                        → the golden, no request
//   'allowlist', the owner NOT admitted               → the golden, one ask
//   'allowlist', a verdict that fails (500, malformed)→ the golden
// Regenerate the goldens ONLY when the v2 render is meant to change for
// everyone (a screen pass), by the capture harness's procedure — never by
// pasting this tree's output.

process.env.TZ = 'UTC';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.setConfig({ testTimeout: 120_000 });
import React from 'react';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const flags = vi.hoisted(() => ({ cards: 'off' }));
vi.mock('../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_ROOM_CARDS_MODE() { return flags.cards; },
}));
const auth = vi.hoisted(() => ({ user: { uid: 'owner-1', getIdToken: async () => 'token' } }));
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({ currentUser: auth.user })) }));

import FilmRoomScreenV2 from './FilmRoomScreenV2';
import { resetFilmRoomVerdicts } from '../../utils/filmRoomGate';
import { mounter, sep23Tape, sep23Series, emptyTape, emptySeries, battleOf, readersOf, NOW } from './__fixtures__/filmRoomHarness';
import { renumberIds, GOLDEN_DEPTHS, GOLDEN_LAYOUTS, goldenName } from '../__golden__/filmRoomV2Golden.js';

/** The base commit the goldens were captured from. */
export const GOLDEN_SOURCE_COMMIT = '7818a1b315589dd95cffbf3708df685fa3d9eb9d';
/** Each golden's SHA-256 as captured (the review C-9 pattern). */
export const GOLDEN_SHA256 = Object.freeze({
  'filmRoomV2.empty.deep.desktop.html': '9be5322258a2c59a15c8611594a1ba91a118505d9a193aabb96604f4478ab836',
  'filmRoomV2.empty.deep.phone.html': '7f519599fa5f107a2c7d6378537f01b2eaf47d90db69d0af824bec055da826b0',
  'filmRoomV2.empty.glance.desktop.html': 'e118c5e0a4e4fd4268ee579adc03fd49b3edd070ef421ec60d12d00e219b92c1',
  'filmRoomV2.empty.glance.phone.html': '7b65da90c20806e4c69d942e21d3c157433b5103490c198cf0f910109490ed1d',
  'filmRoomV2.empty.study.desktop.html': '3aa485b731fbb93426017efb9f67311f140ff93a89616fa82b624accaae2b17c',
  'filmRoomV2.empty.study.phone.html': 'f720ba842e3b00f68f31f75a6d5b3124e1dcd53bcb3120c0e81352f6b7f12e4f',
  'filmRoomV2.sep23.deep.desktop.html': 'ef6f1b7090937ecfc668171f9077e9859ce1365b7110d4cbe3ecea52a9da8c88',
  'filmRoomV2.sep23.deep.phone.html': 'f4c58da1a83493fb8ddc33191d318333421cee7b51fc2350860eb3d4c3aa9e59',
  'filmRoomV2.sep23.glance.desktop.html': '2c16fda49f04cd4c1c829685027173cf9c985736279af2dba98424b26b358b5c',
  'filmRoomV2.sep23.glance.phone.html': '43dbe719f987a7f66862714bbc85bfdad2971f25b48c73ea4e5541b8b1baed34',
  'filmRoomV2.sep23.study.desktop.html': '935fbe924176e3c85837e077cf3fa46450eb982d8b978d6f58693db29e586e6a',
  'filmRoomV2.sep23.study.phone.html': '1bff4834b76a05f2d6d940bde57ea76a5bdc32b69496615f04804b369be49b0f',
});
const DAYS = [['sep23', sep23Tape, sep23Series], ['empty', emptyTape, emptySeries]];
const CASES = GOLDEN_LAYOUTS.flatMap((layout) => DAYS.flatMap(([day, tape, series]) => GOLDEN_DEPTHS.map(([label, depth]) => ({ layout, day, tape, series, label, depth, file: goldenName(day, depth, layout) }))));
/** The words only the cards release says: none may be in a golden of the current v2. */
const CARDS_WORDS = ['Take this home', 'Since last time', 'Prepared case', 'Your call', 'My cards', 'Retire', 'The Film Room counts each time', 'Practice Field', 'No moments matched'];

// Under jsdom import.meta.url is not a file URL; vitest runs from the repo root.
const goldenBytes = (name) => readFileSync(path.join(process.cwd(), 'src', 'screens', '__golden__', name));
const golden = (name) => goldenBytes(name).toString('utf8');

const m = mounter();
const realFetch = globalThis.fetch;
let fetches;
let hadMatchMedia;
beforeEach(() => {
  resetFilmRoomVerdicts();
  flags.cards = 'off';
  auth.user = { uid: 'owner-1', getIdToken: async () => 'token' };
  fetches = [];
  globalThis.fetch = vi.fn(async (url) => { fetches.push(String(url)); return { ok: true, status: 200, json: async () => ({ on: false, allowlisted: false }) }; });
  hadMatchMedia = window.matchMedia;
});
afterEach(() => { window.matchMedia = hadMatchMedia; globalThis.fetch = realFetch; });

/** Mount the current screen as the capture harness did, at one case; the renumbered HTML. */
async function photograph(c) {
  window.matchMedia = c.layout === 'desktop' ? () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }) : hadMatchMedia;
  globalThis.localStorage.clear();
  m.setup();
  try {
    m.render(<FilmRoomScreenV2 battle={battleOf(c.tape)} onBack={() => {}} viewerId="viewer-1" readers={readersOf({ [c.tape.etDate]: c.tape }, c.series)} nowMs={NOW} />);
    await m.flush();
    m.click(m.tab(c.label));
    await m.flush();
    await m.flush();
    return renumberIds(m.container.innerHTML);
  } finally {
    m.teardown();
  }
}
const answer = (body, status = 200) => { globalThis.fetch = vi.fn(async (url) => { fetches.push(String(url)); return { ok: status === 200, status, json: async () => body }; }); };

describe('the goldens are the base\'s photographs (not empty, not this tree\'s, not the cards release)', () => {
  it('every golden file is exactly the one captured from the base commit (SHA-256 pinned), LF only, with every case photographed', () => {
    expect(CASES.map((c) => c.file).sort()).toEqual(Object.keys(GOLDEN_SHA256).sort());
    for (const [name, sha] of Object.entries(GOLDEN_SHA256)) {
      const bytes = goldenBytes(name);
      expect(createHash('sha256').update(bytes).digest('hex'), name).toBe(sha);
      expect(bytes.includes(0x0d), name).toBe(false);
      expect(bytes.length, name).toBeGreaterThan(5000);
    }
  });
  it('each golden is the v2 screen with its four reserved slots EMPTY and none of the cards release\'s words — the mutant: a golden of something other than the current v2', () => {
    for (const name of Object.keys(GOLDEN_SHA256)) {
      const html = golden(name);
      expect(html, name).toContain('data-screen="film-room-v2"');
      for (const slot of ['since-last-time', 'prepared-case', 'your-call', 'receipt']) expect(html, `${name} ${slot}`).toContain(`<div data-reserved-slot="${slot}"></div>`);
      expect(html, name).toContain('data-reserved-region="header" aria-hidden="true"');
      for (const w of CARDS_WORDS) expect(html, `${name}: ${w}`).not.toContain(w);
      expect(html, name).not.toMatch(/data-cards-region|data-moment-row|data-card-form|data-card-receipt|data-my-cards|data-recurrence-row|data-check-tag/);
    }
  });
});

describe('acceptance J — cards off, or the owner not admitted: the current v2, byte for byte', () => {
  it("FILM_ROOM_CARDS_MODE 'off': every day, depth and layout equals its golden, and no request is sent", async () => {
    flags.cards = 'off';
    for (const c of CASES) {
      expect(await photograph(c), c.file).toBe(golden(c.file));
    }
    expect(fetches).toEqual([]);
  });

  it("'allowlist', an owner the server does not admit: the golden at every case — the verdict asked once per owner, never more", async () => {
    flags.cards = 'allowlist';
    answer({ on: false, allowlisted: false });
    for (const c of CASES) {
      expect(await photograph(c), c.file).toBe(golden(c.file));
    }
    // the sep23 battle names its owner; the empty day's battle does too (the harness's battleOf): one ask per owner, cached —
    // and at least one: the verdict IS asked under 'allowlist' (review L4-11b: the bound has a floor)
    expect(fetches.length).toBeGreaterThanOrEqual(1);
    expect(fetches.length).toBeLessThanOrEqual(2);
    for (const url of fetches) expect(url).toMatch(/^\/api\/agent\/cockpit-status\?battleId=/);
  });

  it("'on' (and 'allowlist' with the owner admitted): NOT the golden — the regions carry the cards release, so the comparison can fail", async () => {
    const c = CASES.find((x) => x.day === 'sep23' && x.depth === 'glance' && x.layout === 'phone');
    flags.cards = 'on';
    const on = await photograph(c);
    expect(on).not.toBe(golden(c.file));
    expect(on).toContain('data-cards-region="prepared-case"');
    expect(on).not.toContain('<div data-reserved-slot="prepared-case"></div>');
    flags.cards = 'allowlist';
    resetFilmRoomVerdicts();
    answer({ on: false, allowlisted: true });
    const admitted = await photograph(c);
    expect(admitted).not.toBe(golden(c.file));
    expect(admitted).toContain('data-cards-region="since-last-time"');
  });

  it("'allowlist', a verdict that fails (500, a malformed body, no user): the golden", async () => {
    flags.cards = 'allowlist';
    const c = CASES.find((x) => x.day === 'sep23' && x.depth === 'study' && x.layout === 'phone');
    for (const [label, body, status, user] of [['500', {}, 500, true], ['malformed', { on: true }, 200, true], ['no user', { allowlisted: true }, 200, false]]) {
      resetFilmRoomVerdicts();
      auth.user = user ? { uid: 'owner-1', getIdToken: async () => 'token' } : null;
      answer(body, status);
      expect(await photograph(c), label).toBe(golden(c.file));
    }
  });
});
