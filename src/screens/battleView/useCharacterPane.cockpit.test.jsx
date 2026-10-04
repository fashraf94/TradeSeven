// @vitest-environment jsdom
//
// src/screens/battleView/useCharacterPane.cockpit.test.jsx
//
// Cockpit Build 2a (spec docs/COCKPIT_BUILD2A_SPEC_V1_0.md §5) — the pane's
// sections COMPUTED from shell × cockpit-on; Cockpit the default while the
// desktop is cockpit-on; the four "open Chat" doors still open Chat; a
// remembered section missing from the current list REPAIRED to the list's
// first entry. The shipped machine's own rows stay in useCharacterPane.test.jsx,
// unchanged — this file never edits them (the off path is the same machine).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import {
  useCharacterPane, PANE_SECTION, PANE_SECTIONS, COCKPIT_PANE_SECTIONS, paneSectionsFor, isPaneSection, effectiveSection,
} from './useCharacterPane';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
let api;
function Probe({ enabled = true, isDesktop = true, cockpitOn = false }) {
  const sections = paneSectionsFor({ isDesktop, cockpitOn });
  api = useCharacterPane(enabled, {
    openByDefault: isDesktop,
    sections,
    defaultSection: cockpitOn && isDesktop ? PANE_SECTION.COCKPIT : PANE_SECTION.CHAT,
  });
  return null;
}
const mount = (props) => act(() => { root.render(<Probe {...props} />); });

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('the computed list — shell × cockpit-on', () => {
  it('desktop + on → Cockpit · Chat · Bench · Tape; every other cell → the shipped Chat · Bench · Tape', () => {
    expect(paneSectionsFor({ isDesktop: true, cockpitOn: true })).toEqual(['cockpit', 'chat', 'bench', 'tape']);
    expect(paneSectionsFor({ isDesktop: true, cockpitOn: false })).toBe(PANE_SECTIONS);
    expect(paneSectionsFor({ isDesktop: false, cockpitOn: true })).toBe(PANE_SECTIONS);
    expect(paneSectionsFor({ isDesktop: false, cockpitOn: false })).toBe(PANE_SECTIONS);
    expect(paneSectionsFor()).toBe(PANE_SECTIONS);
    expect(PANE_SECTIONS).toEqual(['chat', 'bench', 'tape']);
    expect(COCKPIT_PANE_SECTIONS).toEqual(['cockpit', 'chat', 'bench', 'tape']);
  });
  it('isPaneSection answers for the list it is given; the shipped list by default', () => {
    expect(isPaneSection('cockpit')).toBe(false);
    expect(isPaneSection('cockpit', COCKPIT_PANE_SECTIONS)).toBe(true);
    expect(isPaneSection('nope', COCKPIT_PANE_SECTIONS)).toBe(false);
  });
  it('effectiveSection: remembered while listed; repaired to the FIRST entry when not; the default until one is named', () => {
    expect(effectiveSection('bench', COCKPIT_PANE_SECTIONS, 'cockpit')).toBe('bench');
    expect(effectiveSection('cockpit', PANE_SECTIONS, 'chat')).toBe('chat');
    expect(effectiveSection(null, COCKPIT_PANE_SECTIONS, 'cockpit')).toBe('cockpit');
    expect(effectiveSection(null, PANE_SECTIONS, 'cockpit')).toBe('chat');
  });
});

describe('the hook — default, doors, repair', () => {
  it('desktop cockpit-on OPENS ON COCKPIT', () => {
    mount({ isDesktop: true, cockpitOn: true });
    expect(api.open).toBe(true);
    expect(api.section).toBe('cockpit');
  });

  it('the "open Chat" doors still open Chat', () => {
    mount({ isDesktop: true, cockpitOn: true });
    act(() => api.openPane(PANE_SECTION.CHAT));
    expect(api.section).toBe('chat');
  });

  it('a section not in the current list cannot be chosen (the phone has no Cockpit section)', () => {
    mount({ isDesktop: false, cockpitOn: true });
    act(() => api.openPane(PANE_SECTION.COCKPIT));
    expect(api.section).toBe('chat');
    act(() => api.setSection(PANE_SECTION.COCKPIT));
    expect(api.section).toBe('chat');
  });

  it('effectiveSection: the repair is the list\'s FIRST entry (§5), not its default, where the two differ (mutation battery C37)', () => {
    // Every shipped list puts its default first (Cockpit · … while on, Chat · …
    // otherwise), so at the screen the two rules agree; this row is what
    // separates them and pins the spec's wording.
    expect(effectiveSection(PANE_SECTION.COCKPIT, [PANE_SECTION.BENCH, PANE_SECTION.CHAT, PANE_SECTION.TAPE], PANE_SECTION.CHAT)).toBe(PANE_SECTION.BENCH);
    expect(effectiveSection('not-a-section', [PANE_SECTION.TAPE, PANE_SECTION.CHAT], PANE_SECTION.CHAT)).toBe(PANE_SECTION.TAPE);
  });

  it('REPAIR: a remembered Cockpit, once the battle is no longer cockpit-on, shows the list\'s first entry — and comes back with the cockpit', () => {
    mount({ isDesktop: true, cockpitOn: true });
    act(() => api.setSection(PANE_SECTION.COCKPIT));
    mount({ isDesktop: true, cockpitOn: false });
    expect(api.section).toBe('chat');
    mount({ isDesktop: true, cockpitOn: true });
    expect(api.section).toBe('cockpit');
  });

  it('a remembered section that IS in both lists survives the cockpit going off', () => {
    mount({ isDesktop: true, cockpitOn: true });
    act(() => api.setSection(PANE_SECTION.BENCH));
    mount({ isDesktop: true, cockpitOn: false });
    expect(api.section).toBe('bench');
  });

  it('cockpit off: the shipped default (Chat) on both shells', () => {
    mount({ isDesktop: true, cockpitOn: false });
    expect(api.section).toBe('chat');
    mount({ isDesktop: false, cockpitOn: false });
    expect(api.section).toBe('chat');
  });

  it('disabled → Chat and closed, and the remembered section is forgotten', () => {
    mount({ isDesktop: true, cockpitOn: true });
    act(() => api.setSection(PANE_SECTION.TAPE));
    mount({ enabled: false, isDesktop: true, cockpitOn: true });
    expect(api.section).toBe('chat');
    expect(api.open).toBe(false);
    mount({ enabled: true, isDesktop: true, cockpitOn: true });
    expect(api.section).toBe('cockpit');
  });
});
