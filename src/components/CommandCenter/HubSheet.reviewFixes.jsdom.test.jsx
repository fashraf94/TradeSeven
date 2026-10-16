// @vitest-environment jsdom
//
// Command Center hub, slice S1 — rows for the §2 review's sheet fixes (S1
// build report §6): the dialog takes focus so a click on its content keeps
// the keys inside it (L3-2), and focus returns to the opener it was handed,
// else to a fallback (L3-3).

import React, { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import HubSheet from './HubSheet';
import { click, mount, press } from './__fixtures__/hubTestKit';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let mounted = [];
afterEach(() => {
  for (const m of mounted) m.unmount();
  mounted = [];
  document.body.querySelectorAll('[data-test-fallback]').forEach((el) => el.remove());
});

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" data-opener="" onClick={() => setOpen(true)}>open</button>
      {open && (
        <HubSheet title="Completed games" label="Game history" onClose={() => setOpen(false)} reducedMotion>
          <button type="button" data-inside="first">a</button>
          <button type="button" data-inside="last">b</button>
        </HubSheet>
      )}
    </div>
  );
}

describe('HubSheet — review fixes', () => {
  it('L3-2: the dialog itself takes focus, so after a click on its content Tab, Shift+Tab and Escape still work', () => {
    const m = mount(<Harness />);
    mounted.push(m);
    const opener = m.host.querySelector('[data-opener]');
    opener.focus();
    click(opener);
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog.tabIndex).toBe(-1);
    dialog.focus();
    expect(document.activeElement).toBe(dialog);
    press(dialog, 'Tab');
    expect(document.activeElement).toBe(dialog.querySelector('[data-hub-sheet-close]'));
    dialog.focus();
    expect(document.activeElement).toBe(dialog);
    press(dialog, 'Tab', { shiftKey: true });
    expect(document.activeElement).toBe(dialog.querySelector('[data-inside="last"]'));
    dialog.focus();
    expect(document.activeElement).toBe(dialog);
    press(dialog, 'Escape');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it.each(['removed', 'disabled'])('L3-3: with the opener %s by the time the sheet closes, focus goes to the fallback, not <body>', (fate) => {
    const fallback = document.createElement('div');
    fallback.tabIndex = -1;
    fallback.setAttribute('data-test-fallback', '');
    document.body.appendChild(fallback);
    function OpenerHarness() {
      const [open, setOpen] = useState(false);
      const [used, setUsed] = useState(false);
      const [openerEl, setOpenerEl] = useState(null);
      // Once used, the opener stays removed or disabled — so it is gone or disabled when the sheet closes.
      const showOpener = fate !== 'removed' || !used;
      return (
        <div>
          {showOpener && (
            <button type="button" data-opener="" disabled={fate === 'disabled' && used} onClick={(e) => { setOpenerEl(e.currentTarget); setUsed(true); setOpen(true); }}>
              open
            </button>
          )}
          {open && (
            <HubSheet title="t" label="l" onClose={() => setOpen(false)} opener={openerEl} fallbackFocus={fallback} reducedMotion>
              <span>x</span>
            </HubSheet>
          )}
        </div>
      );
    }
    const m = mount(<OpenerHarness />);
    mounted.push(m);
    click(m.host.querySelector('[data-opener]'));
    press(document.querySelector('[role="dialog"]'), 'Escape');
    expect(document.activeElement).toBe(fallback);
  });

  it('L3-3: the opener it was handed wins over whatever had focus at open', () => {
    const decoy = document.createElement('button');
    decoy.setAttribute('data-test-fallback', '');
    document.body.appendChild(decoy);
    function HandedHarness() {
      const [open, setOpen] = useState(false);
      const [openerEl, setOpenerEl] = useState(null);
      return (
        <div>
          <button type="button" data-opener="" onClick={(e) => { setOpenerEl(e.currentTarget); decoy.focus(); setOpen(true); }}>open</button>
          {open && <HubSheet title="t" label="l" onClose={() => setOpen(false)} opener={openerEl} reducedMotion><span>x</span></HubSheet>}
        </div>
      );
    }
    const m = mount(<HandedHarness />);
    mounted.push(m);
    const opener = m.host.querySelector('[data-opener]');
    click(opener);
    press(document.querySelector('[role="dialog"]'), 'Escape');
    expect(document.activeElement).toBe(opener);
  });
});
