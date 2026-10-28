// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomScreenV2.cardsOff.golden.jsdom.test.jsx
//
// Film Room B2 item 8 / acceptance J — WITH CARDS OFF, OR THE OWNER NOT
// ADMITTED, THE SCREEN IS THE CURRENT v2, BYTE FOR BYTE (Build B spec §7, §8
// criterion 5; Amendment G RG-2, RG-10: "the current v2" is the screen at
// the goldens' source commit with FILM_ROOM_V2_MODE 'on'). The twelve goldens
// under src/screens/__golden__/filmRoomV2.*.html were captured first from B2's
// base (7818a1b3), then RE-CAPTURED at the head of B2.1, the screen pass
// (Amendment J RJ-9: Part A changes v2 for every player on purpose; every
// difference from B2's goldens maps to a named Part A item, recorded in
// docs/audits/20261022_BUILD_FILM_ROOM_B2_1_SCREEN_PASS.md), then again at the
// code head of the B2.1 rulings round (Amendment K RK-13: only RK-5 and RK-11
// change the cards-off screen; the two Sep-23 Deep dive goldens moved, both
// RK-11, mapped in that report's section 13) — each time from
// a `git archive` of that commit by captureFilmRoomV2Golden.jsdom.test.jsx run
// twice (identical) in a scratch extraction. Their SHA-256 is pinned below, so
// the label inside this file proves nothing by itself. This suite mounts the CURRENT FilmRoomScreenV2
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

/** The commit the goldens were captured from (the B2.1 rulings round's code head; B2.1's 07dc3d58, and B2's base 7818a1b3, before it). */
export const GOLDEN_SOURCE_COMMIT = '004f2c1f9ecec9e1f3f4522224faf50c5caba496';
/** Each golden's SHA-256 as captured (the review C-9 pattern). */
export const GOLDEN_SHA256 = Object.freeze({
  'filmRoomV2.empty.deep.desktop.html': '9be5322258a2c59a15c8611594a1ba91a118505d9a193aabb96604f4478ab836',
  'filmRoomV2.empty.deep.phone.html': '7f519599fa5f107a2c7d6378537f01b2eaf47d90db69d0af824bec055da826b0',
  'filmRoomV2.empty.glance.desktop.html': 'a180e9c23d87ea365269d461a474c797921ca163aae60aed6a2124c4d2092a45',
  'filmRoomV2.empty.glance.phone.html': '5d61ab17b5459828dc89bf3b7a3c2901f4cd01a06c0e174d0ae307d3884762c3',
  'filmRoomV2.empty.study.desktop.html': '2dc16ebe1d6fa2fa5045967514c73dcf5c6164727cfd34ea489c59e80996cc2a',
  'filmRoomV2.empty.study.phone.html': '5f5e7dbe3d8e05b129dd9c94e5fc9763dea318171e141a42184d45d3b268fcb3',
  'filmRoomV2.sep23.deep.desktop.html': 'ffadf417725aeecdf4bc27706999acaa89fbecd4e09a64bc27ed72652c90624e',
  'filmRoomV2.sep23.deep.phone.html': 'e502efb66e9d8c35e2ce5beadc2cfc195388d7feb353c2fb1c0f2d142af0b983',
  'filmRoomV2.sep23.glance.desktop.html': '4639519037dc720c1603bdd45dd5d558a7a7576428376202bd2d4452ef2d566f',
  'filmRoomV2.sep23.glance.phone.html': 'd59c474a5eabafddcf03a8ae712b574ce597d8257af0d19cbf3c6cfe3ce7e17f',
  'filmRoomV2.sep23.study.desktop.html': '093131f510f6a6a661df1f344bc3ab02d811020eca9586acb60afa51d4f2f2e9',
  'filmRoomV2.sep23.study.phone.html': '7cb135976584fe5a74923bc7c41cf9b805ef55add26787238035ef8a95118b5c',
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

describe('the goldens are the source commit\'s photographs (not empty, not pasted from a run, not the cards release)', () => {
  it('every golden file is exactly the one captured from the source commit (SHA-256 pinned), LF only, with every case photographed', () => {
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
