// @vitest-environment jsdom
//
// src/components/CommandCenter/Huddle.jsdom.test.jsx
//
// Huddle S1 — the hub's Huddle surfaces, rendered (Huddle spec Amendment C V1.2 §C4, §C7, §C8, §C15; Command Center spec
// V1.2 Amendment D §D2, §D3, §D5, §D8): the chip (a door, 44 px, no live region), the sheet (a HubSheet: focus to Close,
// Escape; the body never autoplays and stops on a hidden tab and under the ceremony; Confirm sends the base revision and the
// replacement; a 409 / 422 says so), Partnership's states, the Deploy card's reconfirm line, and the record's reader (no poll;
// a visibilitychange read; nothing at all while disabled). The flag itself is off on main: these render the pieces directly.

import React from 'react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({
  fetchHuddleToday: vi.fn(), confirmHuddlePlan: vi.fn(), skipHuddlePlan: vi.fn(),
  issueHuddlePlayback: vi.fn(), sendHuddleEvent: vi.fn(async () => ({ ok: true })), fetchHuddleHistory: vi.fn(async () => []),
}));
vi.mock('../../services/huddleService', () => service);

const { default: HuddleChip } = await import('./HuddleChip');
const { default: HuddleSheet } = await import('./HuddleSheet');
const { default: PartnershipPanel } = await import('./panels/PartnershipPanel');
const { default: DeploySection } = await import('./sections/DeploySection');
const { default: useHuddleToday } = await import('../../hooks/useHuddleToday');
const { HubOverlayProvider } = await import('./hub/HubOverlays');
const { HUB_COPY: COPY } = await import('./hub/hubCopy');
const { deriveHubDeployState } = await import('./hub/selectors/deployState');
const { HUB_S2A_DEPLOY_INPUTS } = await import('./hub/hubModel');
const { mount, click, press, byText } = await import('./__fixtures__/hubTestKit');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let mounted = [];
const keep = (m) => { mounted.push(m); return m; };
afterEach(() => { for (const m of mounted) m.unmount(); mounted = []; vi.clearAllMocks(); });

const ET = '2026-11-09';
const HUDDLE = {
  etDate: ET, status: 'ready', session: { etDate: ET, closeMs: Date.parse('2026-11-09T21:00:00Z') },
  audio: { durationMs: 70_000, hasAudio: true },
  script: { beats: [{ id: 'tape', text: 'The tape was firm.', startMs: 0, endMs: 3000 }, { id: 'plan', text: "Here's what I'd carry in today: hold AAA.", startMs: 3100, endMs: 6000 }] },
  cards: [], evidence: [],
  plan: { status: 'proposed', revision: 'r1', current: { stances: [{ kind: 'HOLD', ticker: 'AAA' }, { kind: 'FADE', ticker: 'BBB', level: 48 }], lines: [{ kind: 'NO_SWAPS_TODAY' }] }, dissent: [], battles: [], eventLabels: {} },
};
const huddleProp = (over = {}) => ({ read: { status: 'ready', huddle: HUDDLE }, confirm: vi.fn(async () => ({ ok: true, status: 200, body: {} })), skip: vi.fn(async () => ({ ok: true, status: 200, body: {} })), needsReconfirm: false, focusPlan: false, ...over });

describe('the chip (C4)', () => {
  it('a 44 px door with the state label, no live region, no badge; none without a record', () => {
    const onOpen = vi.fn();
    const m = keep(mount(<HuddleChip chip={{ state: 'ready', label: 'Huddle · 1:10' }} onOpen={onOpen} />));
    const button = m.host.querySelector('button');
    expect(button.textContent).toBe('Huddle · 1:10');
    expect(button.style.minHeight).toBe('44px');
    expect(m.host.querySelector('[aria-live], [role="status"], [role="alert"]')).toBeNull();
    click(button);
    expect(onOpen).toHaveBeenCalledTimes(1);
    const none = keep(mount(<HuddleChip chip={null} onOpen={onOpen} />));
    expect(none.host.innerHTML).toBe('');
  });
});

describe('the sheet (C8): a HubSheet; no autoplay; Confirm sends the base revision and the replacement', () => {
  function open(props) {
    return keep(mount(<HubOverlayProvider><HuddleSheet huddle={huddleProp(props)} onClose={vi.fn()} reducedMotion /></HubOverlayProvider>));
  }

  it('opens with focus on Close; the transcript is shown; nothing plays or asks for a token until Play', () => {
    const m = open();
    expect(document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent).toBeTruthy();
    expect(document.body.textContent).toContain('The tape was firm.');
    const audio = document.body.querySelector('audio');
    expect(audio.getAttribute('preload')).toBe('none');
    expect(audio.hasAttribute('autoplay')).toBe(false);
    expect(service.issueHuddlePlayback).not.toHaveBeenCalled();
    expect(m).toBeTruthy();
  });

  it('removing an item and editing a level: Confirm sends exactly that replacement with the base revision', async () => {
    const props = huddleProp();
    keep(mount(<HubOverlayProvider><HuddleSheet huddle={props} onClose={vi.fn()} reducedMotion /></HubOverlayProvider>));
    const removeButtons = [...document.body.querySelectorAll('[data-huddle-item] button')];
    click(removeButtons[0]); // HOLD AAA removed
    const input = document.body.querySelector('[data-huddle-item] input');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, '47.5');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => { click(document.body.querySelector('[data-huddle-confirm]')); });
    expect(props.confirm).toHaveBeenCalledWith({ baseRevision: 'r1', replacement: { stances: [{ kind: 'FADE', ticker: 'BBB', level: 47.5 }], lines: [{ kind: 'NO_SWAPS_TODAY' }] } });
  });

  it('a 422 preview and a 409 conflict each say so; the words are the copy table\'s', async () => {
    const confirm = vi.fn(async () => ({ ok: false, status: 422, body: { error: 'validation_changed' } }));
    keep(mount(<HubOverlayProvider><HuddleSheet huddle={huddleProp({ confirm })} onClose={vi.fn()} reducedMotion /></HubOverlayProvider>));
    await act(async () => { click(document.body.querySelector('[data-huddle-confirm]')); });
    expect(document.body.querySelector('[role="alert"]').textContent).toBe(COPY.huddle.notices.previewed);
    confirm.mockImplementation(async () => ({ ok: false, status: 409, body: { error: 'revision_mismatch' } }));
    await act(async () => { click(document.body.querySelector('[data-huddle-confirm]')); });
    expect(document.body.querySelector('[role="alert"]').textContent).toBe(COPY.huddle.notices.conflict);
  });

  it('playback stops when the page is hidden and while the deploy ceremony covers the page', async () => {
    const pause = vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const m = keep(mount(<HubOverlayProvider><HuddleSheet huddle={huddleProp()} onClose={vi.fn()} reducedMotion /></HubOverlayProvider>));
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(pause).toHaveBeenCalled();
    pause.mockClear();
    m.rerender(<HubOverlayProvider><HuddleSheet huddle={huddleProp()} onClose={vi.fn()} reducedMotion ceremonyActive /></HubOverlayProvider>);
    expect(pause).toHaveBeenCalled();
    delete document.visibilityState;
    pause.mockRestore();
  });

  it('Escape closes it (the HubSheet\'s own behaviour)', () => {
    const onClose = vi.fn();
    keep(mount(<HubOverlayProvider><HuddleSheet huddle={huddleProp()} onClose={onClose} reducedMotion /></HubOverlayProvider>));
    press(document.activeElement || document.body, 'Escape');
    expect(onClose).toHaveBeenCalled();
  });
});

describe('Partnership (C8) and the Deploy card\'s reconfirm line (C15)', () => {
  it('without a Huddle section it is the reserved line, unchanged; with one, its states', () => {
    const reserved = keep(mount(<PartnershipPanel />));
    expect(reserved.host.textContent).toBe(COPY.partnership.reserved);
    expect(keep(mount(<PartnershipPanel huddle={{ status: 'loading' }} />)).host.textContent).toBe(COPY.huddle.partnershipLoading);
    const error = keep(mount(<PartnershipPanel huddle={{ status: 'error' }} onRetry={vi.fn()} />));
    expect(byText(error.host, COPY.huddle.partnershipRetry)).not.toBeNull();
    const ready = keep(mount(<PartnershipPanel huddle={{ status: 'ready', today: { etDate: ET, items: ['Hold AAA'], line: 'Confirmed', battles: [] }, history: [], asOf: null }} />));
    expect(ready.host.textContent).toContain('Hold AAA');
    expect(ready.host.textContent).toContain(COPY.huddle.partnershipNote);
  });

  it('the Deploy card shows the line and its door only when handed one, and its hold is untouched by it', () => {
    const deploy = deriveHubDeployState(HUB_S2A_DEPLOY_INPUTS);
    const onReconfirm = vi.fn();
    const without = keep(mount(<DeploySection deploy={deploy} loadoutLine="L" />));
    expect(without.host.querySelector('[data-hub-huddle-reconfirm]')).toBeNull();
    const withLine = keep(mount(<DeploySection deploy={deploy} loadoutLine="L" reconfirm={{ onReconfirm }} />));
    const line = withLine.host.querySelector('[data-hub-huddle-reconfirm]');
    expect(line.textContent).toBe(`${COPY.huddle.deployReconfirm}${COPY.sep}${COPY.huddle.deployReconfirmDoor}`);
    click(byText(line, COPY.huddle.deployReconfirmDoor));
    expect(onReconfirm).toHaveBeenCalledTimes(1);
    // the hold control is the same either way
    expect(withLine.host.querySelectorAll('button').length - without.host.querySelectorAll('button').length).toBe(1);
  });
});

describe('the record\'s reader (C7): no poll; mount, visibility and explicit triggers only; nothing while disabled', () => {
  function Probe({ enabled, onRead }) {
    const r = useHuddleToday({ auth: { signedIn: true, uid: 'u1', authEpoch: 1 }, enabled });
    onRead(r);
    return null;
  }
  beforeEach(() => { service.fetchHuddleToday.mockResolvedValue({ asOf: '2026-11-09T13:00:00Z', huddle: HUDDLE }); });

  it('disabled: no read at all, no listener, idle', async () => {
    const add = vi.spyOn(document, 'addEventListener');
    let last = null;
    keep(mount(<Probe enabled={false} onRead={(r) => { last = r; }} />));
    await act(async () => {});
    expect(service.fetchHuddleToday).not.toHaveBeenCalled();
    expect(add.mock.calls.filter(([t]) => t === 'visibilitychange')).toEqual([]);
    expect(last.read.status).toBe('idle');
    add.mockRestore();
  });

  it('enabled: one read on mount, one more when the page becomes visible, and none from the passing of time', async () => {
    vi.useFakeTimers();
    let last = null;
    keep(mount(<Probe enabled onRead={(r) => { last = r; }} />));
    await act(async () => { await Promise.resolve(); });
    expect(service.fetchHuddleToday).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(10 * 60_000); });
    expect(service.fetchHuddleToday).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await Promise.resolve(); });
    expect(service.fetchHuddleToday).toHaveBeenCalledTimes(2);
    expect(last.read.huddle.etDate).toBe(ET);
    delete document.visibilityState;
    vi.useRealTimers();
  });
});
