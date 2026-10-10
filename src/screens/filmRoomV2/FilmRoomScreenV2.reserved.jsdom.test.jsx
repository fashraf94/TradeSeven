// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomScreenV2.reserved.jsdom.test.jsx
//
// Film Room A2 item 9 — RESERVED SLOTS (Amendment E BA-47): named, EMPTY
// header and footer regions for the later "Since last time", "Prepared
// case", "Your call" and "Receipt" content, and every swap card addressable
// as #swap-n. No later-release content ships in A2.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Whole-screen mounts: the sibling suites' bound, so a busy machine cannot trip vitest's default 5 s (review A2V4-14).
vi.setConfig({ testTimeout: 30_000 });
import React from 'react';
import FilmRoomScreenV2 from './FilmRoomScreenV2';
import { mounter, sep23Tape, sep23Series, emptyTape, emptySeries, battleOf, readersOf, NOW } from './__fixtures__/filmRoomHarness';

const m = mounter();
beforeEach(() => { globalThis.localStorage.clear(); m.setup(); });
afterEach(() => m.teardown());

async function open(tape, series) {
  m.render(<FilmRoomScreenV2 battle={battleOf(tape)} onBack={() => {}} viewerId="viewer-1" readers={readersOf({ [tape.etDate]: tape }, series)} nowMs={NOW} />);
  await m.flush();
}

describe('BA-47 — the later release has named, empty places and nothing else', () => {
  it.each([['Sep-23', sep23Tape, sep23Series], ['empty', emptyTape, emptySeries]])('%s: a header region (since last time · prepared case) and a footer region (your call · receipt), each empty, at every depth', async (_l, tape, series) => {
    await open(tape, series);
    for (const label of ['Glance', 'Study', 'Deep dive']) {
      m.click(m.tab(label));
      await m.flush();
      const header = m.q('[data-reserved-region="header"]');
      const footer = m.q('[data-reserved-region="footer"]');
      expect(header.closest('header'), label).toBeTruthy();
      expect(footer.closest('footer'), label).toBeTruthy();
      expect([...header.querySelectorAll('[data-reserved-slot]')].map((e) => e.getAttribute('data-reserved-slot'))).toEqual(['since-last-time', 'prepared-case']);
      expect([...footer.querySelectorAll('[data-reserved-slot]')].map((e) => e.getAttribute('data-reserved-slot'))).toEqual(['your-call', 'receipt']);
      for (const slot of m.qa('[data-reserved-slot]')) {
        expect(slot.childNodes.length, slot.getAttribute('data-reserved-slot')).toBe(0);
        expect(slot.textContent).toBe('');
      }
      expect(header.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('no later-release content anywhere: no "Since last time", "Prepared case", "Your call" or "Receipt" region text, no preference controls', async () => {
    await open(sep23Tape, sep23Series);
    for (const label of ['Glance', 'Study', 'Deep dive']) {
      m.click(m.tab(label));
      await m.flush();
      const text = m.container.textContent;
      for (const words of ['Since last time', 'Prepared case', 'Your call', 'Save a preference', 'Track a question', 'Later release']) expect(text, `${label}: ${words}`).not.toContain(words);
    }
  });

  it('every swap card is addressable as #swap-n, in the tape\'s order, and carries its own link', async () => {
    await open(sep23Tape, sep23Series);
    m.click(m.tab('Study'));
    await m.flush();
    const ids = m.qa('article[data-swap-card]').map((a) => a.id);
    expect(ids).toEqual(sep23Tape.actions.map((_, i) => `swap-${i + 1}`));
    for (const id of ids) {
      expect(document.getElementById(id)).toBeTruthy();
      expect(m.q(`#${id} a[href="#${id}"]`).textContent).toBe(`#${id}`);
    }
  });
});
