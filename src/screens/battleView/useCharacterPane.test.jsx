// @vitest-environment jsdom
//
// src/screens/battleView/useCharacterPane.test.jsx
//
// A3.2 (D-93) — the pane's machine. The seed's row list, one for one:
// closed → open (Chat) → section change → collapse → expand restores the
// section; plus the body scroll lock and the disabled reset.
//
// jsdom rather than the pure-node style of useChatSheet.test.js because two of
// the five things this hook owns are effects on a real document.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useCharacterPane, PANE_SECTION, PANE_SECTIONS, isPaneSection } from './useCharacterPane';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
let api;

function Probe({ enabled, lockScroll }) {
  api = useCharacterPane(enabled, { lockScroll });
  return null;
}

const mount = (props = { enabled: true, lockScroll: false }) => act(() => {
  root.render(<Probe {...props} />);
});

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  document.body.style.overflow = '';
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.style.overflow = '';
});

describe('the pane opens, moves and collapses', () => {
  it('starts closed, on Chat', () => {
    mount();
    expect(api.open).toBe(false);
    expect(api.section).toBe(PANE_SECTION.CHAT);
  });

  it('opens on the section a door names', () => {
    mount();
    act(() => api.openPane(PANE_SECTION.BENCH));
    expect(api.open).toBe(true);
    expect(api.section).toBe(PANE_SECTION.BENCH);
  });

  it('changes section without closing', () => {
    mount();
    act(() => api.openPane(PANE_SECTION.CHAT));
    act(() => api.setSection(PANE_SECTION.TAPE));
    expect(api.open).toBe(true);
    expect(api.section).toBe(PANE_SECTION.TAPE);
  });

  it('COLLAPSE REMEMBERS, EXPAND RESTORES — the seed\'s row', () => {
    mount();
    act(() => api.openPane(PANE_SECTION.TAPE));
    act(() => api.close());
    expect(api.open).toBe(false);
    // Collapsing is not leaving: the section survives it.
    expect(api.section).toBe(PANE_SECTION.TAPE);
    // Expanding names no section, so the remembered one wins.
    act(() => api.openPane());
    expect(api.open).toBe(true);
    expect(api.section).toBe(PANE_SECTION.TAPE);
  });

  it('a named section beats the remembered one', () => {
    mount();
    act(() => api.openPane(PANE_SECTION.BENCH));
    act(() => api.close());
    act(() => api.openPane(PANE_SECTION.CHAT));
    expect(api.section).toBe(PANE_SECTION.CHAT);
  });

  it('refuses a section it does not know rather than rendering one', () => {
    mount();
    act(() => api.openPane(PANE_SECTION.BENCH));
    act(() => api.setSection('sideways'));
    expect(api.section).toBe(PANE_SECTION.BENCH);
    act(() => api.openPane('sideways'));
    expect(api.section).toBe(PANE_SECTION.BENCH);
    expect(isPaneSection('sideways')).toBe(false);
    expect(PANE_SECTIONS).toEqual([PANE_SECTION.CHAT, PANE_SECTION.BENCH, PANE_SECTION.TAPE]);
  });
});

describe('the return-focus target', () => {
  it('is recorded on the closed → open edge only', () => {
    mount();
    const first = { focus() {} };
    const second = { focus() {} };
    act(() => api.openPane(PANE_SECTION.CHAT, first));
    expect(api.returnFocusRef.current).toBe(first);
    // A door pressed while the pane is ALREADY open must not overwrite the
    // control the player will be handed back to.
    act(() => api.openPane(PANE_SECTION.BENCH, second));
    expect(api.returnFocusRef.current).toBe(first);
    // …and it is recorded again on the next real open.
    act(() => api.close());
    act(() => api.openPane(PANE_SECTION.CHAT, second));
    expect(api.returnFocusRef.current).toBe(second);
  });
});

describe('the body scroll lock (mobile)', () => {
  it('locks while open and RESTORES THE PREVIOUS VALUE, not empty', () => {
    // The Game Tape's own rule (review L2-F10). Restoring to '' would leave a
    // page that was already locked by something else scrollable.
    document.body.style.overflow = 'clip';
    mount({ enabled: true, lockScroll: true });
    expect(document.body.style.overflow).toBe('clip');
    act(() => api.openPane(PANE_SECTION.CHAT));
    expect(document.body.style.overflow).toBe('hidden');
    act(() => api.close());
    expect(document.body.style.overflow).toBe('clip');
  });

  it('does not lock on the shell where the pane is a column beside the board', () => {
    mount({ enabled: true, lockScroll: false });
    act(() => api.openPane(PANE_SECTION.CHAT));
    expect(api.open).toBe(true);
    expect(document.body.style.overflow).toBe('');
  });

  it('releases the lock on unmount, not only on close', () => {
    mount({ enabled: true, lockScroll: true });
    act(() => api.openPane(PANE_SECTION.CHAT));
    expect(document.body.style.overflow).toBe('hidden');
    act(() => root.unmount());
    expect(document.body.style.overflow).toBe('');
    // Re-create so afterEach's unmount is not a double unmount.
    root = createRoot(container);
  });
});

describe('disabled — the flag-off / pane-off arm', () => {
  it('reads closed on Chat however the machine was left', () => {
    mount();
    act(() => api.openPane(PANE_SECTION.TAPE));
    mount({ enabled: false, lockScroll: false });
    expect(api.open).toBe(false);
    expect(api.section).toBe(PANE_SECTION.CHAT);
  });

  it('cannot be opened while disabled', () => {
    mount({ enabled: false, lockScroll: false });
    act(() => api.openPane(PANE_SECTION.BENCH));
    expect(api.open).toBe(false);
  });

  it('holds no lock while disabled', () => {
    mount({ enabled: false, lockScroll: true });
    act(() => api.openPane(PANE_SECTION.CHAT));
    expect(document.body.style.overflow).toBe('');
  });
});
