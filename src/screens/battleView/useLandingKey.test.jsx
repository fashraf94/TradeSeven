// @vitest-environment jsdom
//
// src/screens/battleView/useLandingKey.test.jsx
//
// Phase A (A1) — the landing fires on the SNAPSHOT CHANGE of lastScoredAt
// only: never on open (the first stamp seeds the key without playing), once
// per confirmed check, never on a re-render that carries the same stamp, and
// never at all when the controller is off. A timer cannot reach it — there is
// no clock input.
//
// Harness precedent: starfield.depstability.test.jsx (jsdom docblock,
// createRoot + act, per-file mocks, no setupFiles).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useLandingKey } from './landing';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
let seen;

function Probe({ lastScoredAt, enabled }) {
  const key = useLandingKey(lastScoredAt, enabled);
  seen.push(key);
  return null;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  seen = [];
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const renderProbe = (props) => act(() => { root.render(<Probe {...props} />); });
const latest = () => seen[seen.length - 1];

describe('useLandingKey — the landing keys on the completion write, not the clock', () => {
  it('does not play on open: the first stamp seeds the key and stays null', () => {
    renderProbe({ lastScoredAt: '2026-09-01T16:47:00.000Z', enabled: true });
    expect(latest()).toBeNull();
  });

  it('plays once when the stamp changes — the key becomes the new stamp', () => {
    renderProbe({ lastScoredAt: '2026-09-01T16:47:00.000Z', enabled: true });
    renderProbe({ lastScoredAt: '2026-09-01T17:02:00.000Z', enabled: true });
    expect(latest()).toBe('2026-09-01T17:02:00.000Z');
  });

  it('a re-render with the SAME stamp (a price tick, a chat message) does not re-play', () => {
    renderProbe({ lastScoredAt: '2026-09-01T16:47:00.000Z', enabled: true });
    renderProbe({ lastScoredAt: '2026-09-01T17:02:00.000Z', enabled: true });
    const renders = seen.length;
    renderProbe({ lastScoredAt: '2026-09-01T17:02:00.000Z', enabled: true });
    renderProbe({ lastScoredAt: '2026-09-01T17:02:00.000Z', enabled: true });
    expect(latest()).toBe('2026-09-01T17:02:00.000Z');
    // No state update happened on those renders: each act rendered exactly once.
    expect(seen.length).toBe(renders + 2);
  });

  it('a doc that arrives late (null first, then a stamp) still seeds without playing', () => {
    renderProbe({ lastScoredAt: undefined, enabled: true });
    renderProbe({ lastScoredAt: null, enabled: true });
    renderProbe({ lastScoredAt: '2026-09-01T16:47:00.000Z', enabled: true });
    expect(latest()).toBeNull();
    renderProbe({ lastScoredAt: '2026-09-01T17:02:00.000Z', enabled: true });
    expect(latest()).toBe('2026-09-01T17:02:00.000Z');
  });

  it('is inert flag-off: stamps may change all day and the key stays null', () => {
    renderProbe({ lastScoredAt: '2026-09-01T16:47:00.000Z', enabled: false });
    renderProbe({ lastScoredAt: '2026-09-01T17:02:00.000Z', enabled: false });
    renderProbe({ lastScoredAt: '2026-09-01T17:17:00.000Z', enabled: false });
    expect(seen.every((k) => k === null)).toBe(true);
  });

  it('each new check plays again — one landing per confirmed check', () => {
    renderProbe({ lastScoredAt: '2026-09-01T16:47:00.000Z', enabled: true });
    renderProbe({ lastScoredAt: '2026-09-01T17:02:00.000Z', enabled: true });
    renderProbe({ lastScoredAt: '2026-09-01T17:17:00.000Z', enabled: true });
    expect(latest()).toBe('2026-09-01T17:17:00.000Z');
  });
});
