// @vitest-environment jsdom
//
// src/components/Dashboard/ScoutingBoardSheet.s8.jsdom.test.jsx
//
// The Command Center S8 fix build — the Scouting Board as the legacy shells and the hub both show it:
//
//   R-S8F-6 (the S8 review's S8-8)  the shared sheet it is built on is a dialog. Here with no host around it (the
//           legacy shells' case): role, aria-modal, its title as its name, focus on Close, Tab kept inside, Escape
//           closes, and the sheet itself returns focus to what opened it.

import { describe, it, expect, vi, afterEach } from 'vitest';
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';

const fetches = vi.hoisted(() => ({ answer: null }));
vi.mock('../../utils/fetchWithAuth', () => ({ fetchWithAuth: vi.fn(() => fetches.answer ?? new Promise(() => {})) }));

const { default: ScoutingBoardSheet } = await import('./ScoutingBoardSheet');

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

  it('Escape from a key event that did not start inside the sheet is not the sheet\'s', async () => {
    const onClose = await renderHost();
    await act(async () => { api.open(); });
    key(document.body, 'Escape');
    expect(onClose).not.toHaveBeenCalled();
  });
});
