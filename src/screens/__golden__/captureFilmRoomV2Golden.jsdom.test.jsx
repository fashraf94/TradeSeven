// @vitest-environment jsdom
//
// src/screens/__golden__/captureFilmRoomV2Golden.jsdom.test.jsx
//
// THE CAPTURE HARNESS for the Film Room v2 goldens beside this file
// (filmRoomV2.<day>.<depth>.<layout>.html) — Film Room B2 (Build B spec §7,
// §8 criterion 5; Amendment G RG-2, RG-10): with FILM_ROOM_CARDS_MODE off, or
// the owner not admitted, the v2 screen is "the current v2" byte for byte,
// where the current v2 means the screen at the commit the goldens were
// captured from, with FILM_ROOM_V2_MODE 'on' — B2's base (7818a1b3), then,
// after B2.1 the screen pass, that build's head (Amendment J RJ-9: the screen
// pass changes v2 for every player through Part A, and the goldens are
// re-captured at its head), then the B2.1 rulings round's code head
// (Amendment K RK-13: RK-5 and RK-11 change the cards-off screen; the
// photographed Deep dive chart, AMD's, has no swap, so RK-5 is pinned by the
// Deep dive suite instead), then the Amendment L round's code head (RL-3: the
// one-symbol chart section never shows the series section's line, so the
// empty day's Deep dive moves; RL-4's meeting maker is in no photographed
// chart). Committed so a regeneration is reproducible from
// a NAMED commit (the captureFilmRoomGolden precedent).
//
// It is SKIPPED unless FILM_ROOM_V2_GOLDEN_OUT_DIR is set, so the normal suite
// never writes a golden. To regenerate (only when the v2 render is MEANT to
// change — a screen pass that moves v2 for everyone):
//   1. extract the commit whose v2 output is the truth into a scratch tree
//      (`git archive <sha> | tar -x`), with node_modules linked
//   2. copy THIS file and ./filmRoomV2Golden.js into it at the same paths
//   3. FILM_ROOM_V2_GOLDEN_OUT_DIR=/abs/out npx vitest run src/screens/__golden__/captureFilmRoomV2Golden.jsdom.test.jsx
//   4. run it TWICE and cmp the outputs (determinism); copy them over the
//      .html files here and record the source commit and their sha256 in the
//      comparison suite (src/screens/filmRoomV2/FilmRoomScreenV2.cardsOff.golden.jsdom.test.jsx)
//
// The same mounting, fixtures, clock and zone as the v2 screen suites
// (__fixtures__/filmRoomHarness.jsx): both fixture days, every depth, the
// phone layout and the desktop layout. React 19's useId values come from a
// process-wide counter, so they are renumbered by first appearance before the
// photograph is taken; the comparison suite renumbers the same way.

process.env.TZ = 'UTC';

import { describe, it, vi } from 'vitest';
import React from 'react';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import FilmRoomScreenV2 from '../filmRoomV2/FilmRoomScreenV2';
import { mounter, sep23Tape, sep23Series, emptyTape, emptySeries, battleOf, readersOf, NOW } from '../filmRoomV2/__fixtures__/filmRoomHarness';

vi.setConfig({ testTimeout: 120_000 });
const OUT = process.env.FILM_ROOM_V2_GOLDEN_OUT_DIR;

import { renumberIds, GOLDEN_DEPTHS, GOLDEN_LAYOUTS, goldenName } from './filmRoomV2Golden.js';

const GOLDEN_DAYS = [['sep23', sep23Tape, sep23Series], ['empty', emptyTape, emptySeries]];

const m = mounter();

describe.skipIf(!OUT)('capture the Film Room v2 goldens (the named source commit, FILM_ROOM_V2_MODE on)', () => {
  it('writes each fixture day at each depth, phone and desktop', async () => {
    mkdirSync(OUT, { recursive: true });
    const had = window.matchMedia;
    try {
      for (const layout of GOLDEN_LAYOUTS) {
        window.matchMedia = layout === 'desktop' ? () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }) : had;
        for (const [day, tape, series] of GOLDEN_DAYS) {
          for (const [label, depth] of GOLDEN_DEPTHS) {
            globalThis.localStorage.clear();
            m.setup();
            m.render(<FilmRoomScreenV2 battle={battleOf(tape)} onBack={() => {}} viewerId="viewer-1" readers={readersOf({ [tape.etDate]: tape }, series)} nowMs={NOW} />);
            await m.flush();
            m.click(m.tab(label));
            await m.flush();
            writeFileSync(path.join(OUT, goldenName(day, depth, layout)), renumberIds(m.container.innerHTML));
            m.teardown();
          }
        }
      }
    } finally {
      window.matchMedia = had;
    }
  });
});
