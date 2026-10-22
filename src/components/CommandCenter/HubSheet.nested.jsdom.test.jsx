// @vitest-environment jsdom
//
// Command Center hub, slice S5 — a HubSheet rendered among another HubSheet's React children
// (review E3-4d). Nothing in S5 nests sheets, but S2b registers the Scouting Board and the deploy
// ceremony through the same stack, and React bubbles a synthetic keydown from a portal up through
// its React parents: the OUTER sheet's Tab trap saw the INNER sheet's keys and cancelled Tab in
// the middle of the inner cycle. A sheet traps only the keys that happen inside its own dialog.

import React, { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import HubSheet from './HubSheet';
import { HubOverlayProvider } from './hub/HubOverlays';
import { click, mount, press } from './__fixtures__/hubTestKit';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let mounted = [];
afterEach(() => {
  for (const m of mounted) m.unmount();
  mounted = [];
});

function Nested() {
  const [inner, setInner] = useState(false);
  const [outer, setOuter] = useState(true);
  return (
    <HubOverlayProvider>
      {outer && (
        <HubSheet title="Outer" label="Outer" onClose={() => setOuter(false)} reducedMotion>
          <button id="open-inner" type="button" onClick={() => setInner(true)}>open inner</button>
          <button id="outer-last" type="button">outer last</button>
          {inner && (
            <HubSheet title="Inner" label="Inner" onClose={() => setInner(false)} opener={document.getElementById('open-inner')} reducedMotion>
              <button id="i1" type="button">i1</button>
              <button id="i2" type="button">i2</button>
              <button id="i3" type="button">i3</button>
            </HubSheet>
          )}
        </HubSheet>
      )}
    </HubOverlayProvider>
  );
}

function open() {
  const m = mount(<Nested />);
  mounted.push(m);
  click(document.getElementById('open-inner'));
  return m;
}

describe('nested sheets: each traps only its own keys', () => {
  it('Tab in the MIDDLE of the inner sheet is left to the browser (the outer trap does not cancel it)', () => {
    open();
    const i2 = document.getElementById('i2');
    i2.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    i2.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('the inner sheet still wraps its own cycle: Tab from its last control goes to its Close, Shift+Tab back', () => {
    open();
    const inner = document.querySelectorAll('[role="dialog"]')[1];
    const close = inner.querySelector('[data-hub-sheet-close]');
    const i3 = document.getElementById('i3');
    i3.focus();
    press(i3, 'Tab');
    expect(document.activeElement).toBe(close);
    press(close, 'Tab', { shiftKey: true });
    expect(document.activeElement).toBe(i3);
  });

  it('Escape in the inner sheet closes only the inner one, and focus returns to the control that opened it', () => {
    open();
    const i1 = document.getElementById('i1');
    i1.focus();
    press(i1, 'Escape');
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(document.getElementById('i1')).toBeNull();
  });

  it('the outer sheet keeps its own trap and its own Escape', () => {
    open();
    press(document.getElementById('i1'), 'Escape');
    const outer = document.querySelector('[role="dialog"]');
    const last = document.getElementById('outer-last');
    const close = outer.querySelector('[data-hub-sheet-close]');
    last.focus();
    press(last, 'Tab');
    expect(document.querySelector('[role="dialog"]')).toBe(outer);
    expect(document.activeElement).toBe(close);
    press(close, 'Escape');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
