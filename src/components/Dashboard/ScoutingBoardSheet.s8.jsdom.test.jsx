// @vitest-environment jsdom
//
// src/components/Dashboard/ScoutingBoardSheet.s8.jsdom.test.jsx
//
// The Command Center S8 fix build — the Scouting Board as the legacy shells and the hub both show it:
//
//   R-S8F-6 (the S8 review's S8-8)  the shared sheet it is built on is a dialog. Here with no host around it (the
//           legacy shells' case): role, aria-modal, its title as its name, focus on Close, Tab kept inside, Escape
//           closes, and the sheet itself returns focus to what opened it.
//   R-S8F-12 (the S8 review's S8-5)  "Ranked from today's read" only when the ranking is from today's ET date;
//           otherwise "Ranked from {day}'s read".

import { describe, it, expect, vi, afterEach } from 'vitest';
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';

const fetches = vi.hoisted(() => ({ answer: null }));
vi.mock('../../utils/fetchWithAuth', () => ({ fetchWithAuth: vi.fn(() => fetches.answer ?? new Promise(() => {})) }));

const { default: ScoutingBoardSheet } = await import('./ScoutingBoardSheet');
const { default: EquipSheet } = await import('./EquipSheet');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root;
let host;
let api;
afterEach(() => {
  if (root) act(() => root.unmount());
  host?.remove();
  root = null;
  host = null;
  fetches.answer = null;
  document.body.innerHTML = '';
  vi.useRealTimers();
});

/** A legacy-shell-like host: a button that opens the board, and the board's own close. No overlay stack. */
function LegacyHost({ onClose }) {
  const [open, setOpen] = useState(false);
  api = { open: () => setOpen(true) };
  return (
    <>
      <button type="button" data-opener="" onClick={() => setOpen(true)}>See what it&apos;s eyeing</button>
      <ScoutingBoardSheet
        open={open}
        onClose={() => { onClose(); setOpen(false); }}
        agent={{ archetype: 'momentum_chaser' }}
        accent="#22c55e"
        deploying={false}
        deployDisabled={false}
        isLive={false}
        onDeploy={vi.fn()}
      />
    </>
  );
}

async function renderHost(onClose = vi.fn()) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(<LegacyHost onClose={onClose} />); });
  return onClose;
}
const key = (target, name, init = {}) => {
  const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init });
  act(() => { target.dispatchEvent(event); });
  return event;
};
const TABBABLE = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

describe('the Scouting Board is a dialog, with no host around it (the S8 review S8-8; ruling R-S8F-6)', () => {
  it('role dialog, aria-modal, named by its title; focus on Close; Tab stays inside; Escape closes; focus returns to the opener once', async () => {
    const onClose = await renderHost();
    const opener = document.querySelector('[data-opener]');
    opener.focus();
    await act(async () => { opener.click(); });
    const dialogs = [...document.querySelectorAll('[role="dialog"]')];
    expect(dialogs).toHaveLength(1);
    const [dialog] = dialogs;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(dialog.getAttribute('aria-labelledby'))?.textContent).toBe('Scouting the board');
    const close = dialog.querySelector('button[aria-label="Close"]');
    expect(document.activeElement).toBe(close);

    const nodes = [...dialog.querySelectorAll(TABBABLE)];
    nodes[nodes.length - 1].focus();
    expect(key(document.activeElement, 'Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(nodes[0]);
    expect(key(document.activeElement, 'Tab', { shiftKey: true }).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(nodes[nodes.length - 1]);

    const restores = vi.spyOn(opener, 'focus');
    key(document.activeElement, 'Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(opener);
    expect(restores).toHaveBeenCalledTimes(1);
  });

  it('a click on the backdrop closes it as before, and focus still returns to the opener', async () => {
    const onClose = await renderHost();
    const opener = document.querySelector('[data-opener]');
    opener.focus();
    await act(async () => { opener.click(); });
    const backdrop = document.querySelector('[role="dialog"]').parentElement;
    await act(async () => { backdrop.click(); });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(opener);
  });

  it('Escape from a control outside the sheet is not the sheet\'s (focus nowhere — <body> — is: review fix L1-1)', async () => {
    const onClose = await renderHost();
    await act(async () => { api.open(); });
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    key(outside, 'Escape');
    expect(onClose).not.toHaveBeenCalled();
    key(document.body, 'Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// The S8 review's S8-5 (ruling R-S8F-12): the board ranks on weekday mornings (compute-rankings, 11:00 UTC), so on a
// weekend and before the run it holds an earlier day's ranking. "Ranked from today's read" only for today's ET date.
describe("the board's read, by its day (S8-5)", () => {
  const board = (asOf) => ({ archetypeLabel: 'Degen', asOf, empty: false, ranked: [{ symbol: 'NVDA', archetypeScore: 81.2 }], watchlist: { inUniverse: [], offUniverse: [] } });
  async function subtitleAt(nowIso, asOf) {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(nowIso));
    fetches.answer = Promise.resolve({ ok: true, status: 200, json: async () => board(asOf) });
    await renderHost();
    await act(async () => { api.open(); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    const dialog = document.querySelector('[role="dialog"]');
    expect(document.getElementById(dialog.getAttribute('aria-labelledby'))?.textContent).toBe('What Degen is eyeing');
    return dialog.textContent;
  }

  it("today's run, read the same ET day: \"Ranked from today's read\"", async () => {
    expect(await subtitleAt('2026-10-27T15:00:00Z', '2026-10-27T11:02:00Z')).toContain("Ranked from today's read");
  });

  it("a Saturday: Friday's ranking is \"Friday's read\", never today's", async () => {
    const text = await subtitleAt('2026-10-24T16:00:00Z', '2026-10-23T11:02:00Z');
    expect(text).toContain("Ranked from Friday's read");
    expect(text).not.toMatch(/today's read/);
  });

  it("a weekday before the 11:00 UTC run: the previous session's ranking (Monday's on Tuesday morning)", async () => {
    expect(await subtitleAt('2026-10-27T10:00:00Z', '2026-10-26T11:02:00Z')).toContain("Ranked from Monday's read");
  });

  it('the day is the ET day: a run at 10 PM ET Monday read on Tuesday is Monday\'s, though UTC calls it Tuesday', async () => {
    expect(await subtitleAt('2026-10-27T19:00:00Z', '2026-10-27T02:00:00Z')).toContain("Ranked from Monday's read");
  });

  it('a ranking a week old or more names its date', async () => {
    expect(await subtitleAt('2026-10-27T15:00:00Z', '2026-10-16T11:02:00Z')).toContain("Ranked from Oct 16's read");
  });
});

// The build's own review, lens L3 (L3-1): a ranking from another year names its year, as the hub's dates do.
describe('review fix L3-1: a ranking from another year', () => {
  const board = (asOf) => ({ archetypeLabel: 'Degen', asOf, empty: false, ranked: [{ symbol: 'NVDA', archetypeScore: 81.2 }], watchlist: { inUniverse: [], offUniverse: [] } });

  // This year's older read ("Oct 16's", no year) is the "a week old or more" row above.
  it('"Ranked from Oct 16, 2025\'s read" a year on', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-27T15:00:00Z'));
    fetches.answer = Promise.resolve({ ok: true, status: 200, json: async () => board('2025-10-16T11:02:00Z') });
    await renderHost();
    await act(async () => { api.open(); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(document.querySelector('[role="dialog"]').textContent).toContain("Ranked from Oct 16, 2025's read");
  });
});

// The build's own review, the mutating lens L4: three of its survivors on the sheet's keys (M25, M31, M32), closed.
describe('review fixes L4 — the sheet\'s keys', () => {
  it('M25: Escape is the sheet\'s alone — it does not also reach a listener on the page, from Close or from <body>', async () => {
    const onClose = await renderHost();
    await act(async () => { api.open(); });
    const pageKeys = vi.fn();
    window.addEventListener('keydown', pageKeys);
    try {
      key(document.querySelector('button[aria-label="Close"]'), 'Escape');
      expect(onClose).toHaveBeenCalledTimes(1);
      await act(async () => { api.open(); });
      document.activeElement.blur();
      key(document.body, 'Escape');
      expect(onClose).toHaveBeenCalledTimes(2);
      expect(pageKeys).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('keydown', pageKeys);
    }
  });

  it('M31: the <body> key listener goes with the sheet: closed and opened again, one Escape closes it once', async () => {
    const onClose = await renderHost();
    await act(async () => { api.open(); });
    await act(async () => { document.querySelector('button[aria-label="Close"]').click(); });
    expect(onClose).toHaveBeenCalledTimes(1);
    key(document.body, 'Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
    await act(async () => { api.open(); });
    document.activeElement.blur();
    key(document.body, 'Escape');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('M32: a key from an overlay rendered among the sheet\'s children (a portal elsewhere in the DOM) is that overlay\'s', async () => {
    const onClose = vi.fn();
    function PortalChild() {
      return createPortal(<button type="button" data-child-portal="">Inner</button>, document.body);
    }
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root.render(<EquipSheet open onClose={onClose} title="Sheet"><PortalChild /></EquipSheet>); });
    const inner = document.querySelector('[data-child-portal]');
    inner.focus();
    key(inner, 'Escape');
    expect(onClose).not.toHaveBeenCalled();
    const tab = key(inner, 'Tab');
    expect(tab.defaultPrevented).toBe(false);
  });
});

// Founder ruling Q-S8F-2 (the build's review, L1-2): the sheet's Close and row buttons show a keyboard-only focus
// outline. jsdom computes no :focus-visible, so this row pins the rule and what it reaches; headless Edge measured the
// outline itself (Tab shows it, a click does not; the S8 fix build report §13).
describe('founder ruling Q-S8F-2 — a keyboard-only focus outline on Close and the rows', () => {
  it('Close and every row carry the marker; the sheet carries one :focus-visible rule, the teal token, !important over the inline all: unset', async () => {
    const rows = [{ id: 'a', title: 'First' }, { id: 'b', title: 'Second' }];
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root.render(
        <EquipSheet open onClose={vi.fn()} title="Equip watchlist" rows={rows} footer={<button type="button">Footer</button>} accent="#22c55e" />,
      );
    });
    const dialog = document.querySelector('[role="dialog"]');
    const css = [...dialog.querySelectorAll('style')].map((s) => s.textContent).join('\n');
    expect(css).toBe('[data-equip-sheet-control]:focus-visible { outline: 2px solid var(--ft-teal) !important; outline-offset: 2px !important; }');
    const marked = [...dialog.querySelectorAll('[data-equip-sheet-control]')];
    expect(marked.map((b) => b.getAttribute('aria-label') || b.textContent)).toEqual(['Close', 'First', 'Second']);
    // Only those: the footer and any child control keep their own styles.
    expect(marked.includes([...dialog.querySelectorAll('button')].find((b) => b.textContent === 'Footer'))).toBe(false);
  });
});

// Founder ruling Q-S8F-4 (the S8 review's own S8-5 row: "the sheet names the day of the read it shows"): the ranked list's
// heading and the watchlist's off-universe line follow the subtitle's day rule.
describe('founder ruling Q-S8F-4 — the heading and the off-universe line say the read\'s day', () => {
  const board = (asOf) => ({
    archetypeLabel: 'Degen', asOf, empty: false,
    ranked: [{ symbol: 'TSLA', sectorName: 'Autos', archetypeScore: 71.2, inWatchlist: false, chip: null }],
    watchlist: { inUniverse: [], offUniverse: [{ symbol: 'ZZZ' }] },
  });
  async function sheetAt(nowIso, asOf) {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(nowIso));
    fetches.answer = Promise.resolve({ ok: true, status: 200, json: async () => board(asOf) });
    await renderHost();
    await act(async () => { api.open(); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    const text = document.querySelector('[role="dialog"]').textContent;
    expect(text).toContain('TSLA');
    expect(text).toContain('ZZZ');
    return text;
  }

  it('a Saturday with Friday\'s ranking: no "today" anywhere in the sheet; every line names Friday', async () => {
    const text = await sheetAt('2026-10-24T16:00:00Z', '2026-10-23T20:00:00.000Z');
    expect(text).not.toMatch(/today/i);
    expect(text).toContain("Ranked from Friday's read");
    expect(text).toContain("In Degen's wheelhouse on Friday's read");
    expect(text).toContain('in your watchlist · outside Friday’s ranked universe');
  });

  it("today's ranking: today, as before", async () => {
    const text = await sheetAt('2026-10-27T15:00:00Z', '2026-10-27T11:02:00Z');
    expect(text).toContain("In Degen's wheelhouse today");
    expect(text).toContain('in your watchlist · outside today’s ranked universe');
  });

  it('a ranking a week old or more: its date, on every line', async () => {
    const text = await sheetAt('2026-10-27T15:00:00Z', '2026-10-16T11:02:00Z');
    expect(text).toContain("In Degen's wheelhouse on Oct 16's read");
    expect(text).toContain('in your watchlist · outside Oct 16’s ranked universe');
  });

  it('a ranking with no time on it: no line names a day, and none says today', async () => {
    const text = await sheetAt('2026-10-27T15:00:00Z', null);
    expect(text).not.toMatch(/today/i);
    expect(text).toContain("In Degen's wheelhouse");
    expect(text).toContain('in your watchlist · outside the ranked universe');
  });
});
