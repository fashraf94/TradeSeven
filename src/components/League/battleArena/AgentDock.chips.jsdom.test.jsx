// @vitest-environment jsdom
//
// src/components/League/battleArena/AgentDock.chips.jsdom.test.jsx
//
// Voice-layer grounding §6.2 / §8 on the League arena: the dock renders the
// server-minted chips beside the fixed strategy chips on the LIVE path only —
// a `directive` chip reads `Files: {canonical text}` and its tap calls the
// filing path with its id (never the ask path); an `ask` chip sends its text
// to the ask path; both are disabled while an ask or a filing is in flight.
// Flag-off (chatReady false / no chips) the dock is the shipped one.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { AgentDock } from './CommandDock';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
}

let container;
let root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const DV02 = 'Widen the spread (target more sectors)';
// The LITERAL label — never derived through filesChip (review R-10).
const FILES_DV02 = `Files: ${DV02}`;
const CHIPS = [{ kind: 'directive', id: 'DV-02', text: DV02 }, { kind: 'ask', text: 'Why the spread?' }];
const ASK = [{ q: "What's your plan from here?" }];
const LINES = [{ kind: 'read', text: 'holding the line', _k: 1 }];

const render = (props = {}) => act(() => {
  root.render(<AgentDock live lines={LINES} archName="Speculator" ask={ASK} onAsk={() => {}} {...props} />);
});
const button = (label) => [...container.querySelectorAll('button')].find((b) => b.textContent === label);
const click = (b) => act(() => { b.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

describe('the arena dock — minted chips', () => {
  it('renders `Files: …` for a directive chip and the question for an ask chip, beside the fixed chips (live path)', () => {
    render({ chatReady: true, askLive: () => {}, chips: CHIPS, fileLive: () => {} });
    expect(button(FILES_DV02)).toBeTruthy();
    expect(button('Why the spread?')).toBeTruthy();
    expect(button("What's your plan from here?")).toBeTruthy();
    expect(button(FILES_DV02).getAttribute('data-chip-kind')).toBe('directive');
  });

  it('a directive chip calls fileLive with its id — never askLive; an ask chip calls askLive with its text', () => {
    const askLive = vi.fn();
    const fileLive = vi.fn();
    render({ chatReady: true, askLive, chips: CHIPS, fileLive });
    click(button(FILES_DV02));
    expect(fileLive).toHaveBeenCalledWith('DV-02');
    expect(askLive).not.toHaveBeenCalled();
    click(button('Why the spread?'));
    expect(askLive).toHaveBeenCalledWith('Why the spread?');
    expect(fileLive).toHaveBeenCalledTimes(1);
  });

  it('is disabled while a filing or an ask is in flight', () => {
    const fileLive = vi.fn();
    render({ chatReady: true, askLive: () => {}, chips: CHIPS, fileLive, filing: true });
    expect(button(FILES_DV02).disabled).toBe(true);
    click(button(FILES_DV02));
    expect(fileLive).not.toHaveBeenCalled();
    render({ chatReady: true, askLive: () => {}, chips: CHIPS, fileLive, asking: true });
    expect(button(FILES_DV02).disabled).toBe(true);
  });

  it('a filing in flight disables the composer, the fixed pills and the minted chips together — a typed question is never dropped (review R-16)', () => {
    const askLive = vi.fn();
    render({ chatReady: true, askLive, chips: CHIPS, fileLive: () => {}, filing: true });
    const input = container.querySelector('input');
    expect(input.disabled).toBe(true);
    expect(input.placeholder).toBe('Filing…');
    expect(button("What's your plan from here?").disabled).toBe(true);
    click(button("What's your plan from here?"));
    expect(askLive).not.toHaveBeenCalled();
    // Not filing, not asking: everything is live again.
    render({ chatReady: true, askLive, chips: CHIPS, fileLive: () => {}, filing: false });
    expect(container.querySelector('input').disabled).toBe(false);
    expect(container.querySelector('input').placeholder).toBe('Ask anything…');
  });

  it('flag-off (the stub dock): no minted chip renders even when handed some', () => {
    render({ chatReady: false, chips: CHIPS });
    expect(button(FILES_DV02)).toBeUndefined();
    expect(container.textContent).not.toContain('Files:');
  });

  it('a chip with no usable label renders nothing', () => {
    render({ chatReady: true, askLive: () => {}, chips: [{ kind: 'directive', id: 'X' }, { kind: 'weather', text: 'sunny' }], fileLive: () => {} });
    expect(container.textContent).not.toContain('Files:');
    expect(container.textContent).not.toContain('sunny');
  });
});
