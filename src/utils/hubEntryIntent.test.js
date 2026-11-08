// src/utils/hubEntryIntent.test.js
//
// The armory flip's LD-1: the League door's one-shot intent. The door marks it and goes to the dashboard; the first take
// answers true and clears it, so every later take (the next ordinary entry) answers false. The hub's rows
// (CommandCenterHub.loadouts.jsdom.test.jsx, "LD-1") show the same on the screen.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openCommandCenterOnLoadout, takeLoadoutEntry } from './hubEntryIntent';

beforeEach(() => { takeLoadoutEntry(); });

describe('hubEntryIntent (LD-1)', () => {
  it('nothing pending: a take answers false', () => {
    expect(takeLoadoutEntry()).toBe(false);
  });

  it('the door marks the intent and goes to the dashboard, once', () => {
    const setScreen = vi.fn();
    openCommandCenterOnLoadout(setScreen);
    expect(setScreen.mock.calls).toEqual([['dashboard']]);
    expect(takeLoadoutEntry()).toBe(true);
  });

  it('one-shot: the take clears it, so the next take answers false', () => {
    openCommandCenterOnLoadout(() => {});
    expect(takeLoadoutEntry()).toBe(true);
    expect(takeLoadoutEntry()).toBe(false);
  });
});
