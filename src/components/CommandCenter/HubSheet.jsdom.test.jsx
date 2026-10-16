// @vitest-environment jsdom
//
// Command Center hub, slice S1 — the sheet primitive (spec V1.2 §10; prompt
// §4.4): role dialog, aria-modal and a label; focus to Close on open; a focus
// trap; Escape; focus back to the control that opened it; the background
// inert while it is open; a dialog on the wider compositions and a bottom
// sheet on the phone; above the strip (40) and BottomNav (50).

import React, { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import HubSheet, { inertSiblings } from './HubSheet';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { HUB_LAYERS } from './hub/hubStyle';
import { click, mount, press } from './__fixtures__/hubTestKit';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let mounted = [];
afterEach(() => {
  for (const m of mounted) m.unmount();
  mounted = [];
  document.body.querySelectorAll('[data-test-sibling]').forEach((el) => el.remove());
});

function Harness({ phone = false }) {
  const [open, setOpen] = useState(false);
  return (
    <div data-test-app="">
      <button type="button" data-opener="" onClick={() => setOpen(true)}>open</button>
      {open && (
        <HubSheet title="Completed games" eyebrow="Game history · 3 completed" label="Game history" phone={phone} onClose={() => setOpen(false)} reducedMotion>
          <button type="button" data-inside="first">a</button>
          <button type="button" data-inside="last">b</button>
        </HubSheet>
      )}
    </div>
  );
}

function openSheet(props) {
  const m = mount(<Harness {...props} />);
  mounted.push(m);
  const opener = m.host.querySelector('[data-opener]');
  opener.focus();
  click(opener);
  const dialog = document.querySelector('[role="dialog"]');
  return { ...m, opener, dialog };
}

describe('HubSheet — the dialog', () => {
  it('is a labelled modal dialog, portalled to body, above the strip and the nav', () => {
    const { dialog, host } = openSheet();
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Game history');
    expect(host.contains(dialog)).toBe(false);
    const overlay = dialog.closest('[data-hub-sheet-overlay]');
    expect(overlay.parentElement).toBe(document.body);
    expect(overlay.style.position).toBe('fixed');
    expect(Number(overlay.style.zIndex)).toBe(HUB_LAYERS.sheet);
    expect(HUB_LAYERS.sheet).toBeGreaterThan(50);
    expect(HUB_LAYERS.sheet).toBeLessThan(1010);
    expect(dialog.querySelector('h2').textContent).toBe('Completed games');
  });

  it('moves focus to Close on open', () => {
    const { dialog } = openSheet();
    const close = dialog.querySelector('[data-hub-sheet-close]');
    expect(close.getAttribute('aria-label')).toBe(COPY.sheet.close);
    expect(document.activeElement).toBe(close);
  });

  it('traps Tab: forward from the last control wraps to Close, backward from Close wraps to the last', () => {
    const { dialog } = openSheet();
    const close = dialog.querySelector('[data-hub-sheet-close]');
    const last = dialog.querySelector('[data-inside="last"]');
    last.focus();
    press(last, 'Tab');
    expect(document.activeElement).toBe(close);
    press(close, 'Tab', { shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('Escape closes it and focus returns to the control that opened it', () => {
    const { dialog, opener } = openSheet();
    press(dialog, 'Escape');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('Close and the backdrop close it too, each returning focus', () => {
    let s = openSheet();
    click(s.dialog.querySelector('[data-hub-sheet-close]'));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(s.opener);
    s.unmount();
    mounted = [];
    s = openSheet();
    click(document.querySelector('[data-hub-sheet-backdrop]'));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(s.opener);
  });

  it('makes the background inert while open — the app root and every other body child — and restores exactly that on close', () => {
    const already = document.createElement('div');
    already.setAttribute('data-test-sibling', 'already');
    already.setAttribute('inert', '');
    const other = document.createElement('div');
    other.setAttribute('data-test-sibling', 'other');
    document.body.append(already, other);
    const { dialog, host } = openSheet();
    const overlay = dialog.closest('[data-hub-sheet-overlay]');
    expect(host.hasAttribute('inert')).toBe(true);
    expect(other.hasAttribute('inert')).toBe(true);
    expect(overlay.hasAttribute('inert')).toBe(false);
    press(dialog, 'Escape');
    expect(host.hasAttribute('inert')).toBe(false);
    expect(other.hasAttribute('inert')).toBe(false);
    // An element that was inert before the sheet opened stays inert after it closes.
    expect(already.hasAttribute('inert')).toBe(true);
  });

  it('is a bottom sheet on the phone and a centred dialog elsewhere', () => {
    let s = openSheet({ phone: true });
    expect(s.dialog.getAttribute('data-hub-sheet')).toBe('bottom');
    expect(s.dialog.closest('[data-hub-sheet-overlay]').style.alignItems).toBe('flex-end');
    press(s.dialog, 'Escape');
    s.unmount();
    mounted = [];
    s = openSheet({ phone: false });
    expect(s.dialog.getAttribute('data-hub-sheet')).toBe('dialog');
    expect(s.dialog.closest('[data-hub-sheet-overlay]').style.alignItems).toBe('center');
  });
});

describe('inertSiblings', () => {
  it('marks every body child but the one kept, and its undo removes only its own marks', () => {
    const keep = document.createElement('div');
    const a = document.createElement('div');
    const b = document.createElement('div');
    b.setAttribute('inert', '');
    for (const el of [keep, a, b]) { el.setAttribute('data-test-sibling', ''); document.body.appendChild(el); }
    const undo = inertSiblings(keep);
    expect(keep.hasAttribute('inert')).toBe(false);
    expect(a.hasAttribute('inert')).toBe(true);
    undo();
    expect(a.hasAttribute('inert')).toBe(false);
    expect(b.hasAttribute('inert')).toBe(true);
  });
});
