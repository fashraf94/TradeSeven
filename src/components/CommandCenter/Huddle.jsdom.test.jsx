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
    expect(document.activeElement?.tagName).toBe('BUTTON');
    expect(document.activeElement?.getAttribute('aria-label')).toBe(COPY.sheet.close);
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
    expect(props.confirm).toHaveBeenCalledWith({ baseRevision: 'r1', replacement: { stances: [{ kind: 'FADE', ticker: 'BBB', level: 47.5 }], lines: [{ kind: 'NO_SWAPS_TODAY' }] }, acknowledged: null });
  });

  it('E1: a per-archetype preview is shown line by line, and the next Confirm sends its revisions back as acknowledged', async () => {
    const previews = [
      { archetype: 'diversifier', archetypeName: 'Diversifier', games: 1, revision: 'rv-d', changes: [{ index: 1, kind: 'stance', from: 'FADE', to: 'WATCH', ticker: 'BBB' }] },
      { archetype: 'degen', archetypeName: 'Speculator', games: 0, revision: 'rv-s', changes: [{ index: 1, kind: 'stance', from: 'FADE', to: 'WATCH', ticker: 'BBB' }] },
    ];
    const confirm = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 422, body: { error: 'validation_changed', drops: [], transforms: [], previews } })
      .mockResolvedValueOnce({ ok: true, status: 200, body: {} });
    keep(mount(<HubOverlayProvider><HuddleSheet huddle={huddleProp({ confirm })} onClose={vi.fn()} reducedMotion /></HubOverlayProvider>));
    await act(async () => { click(document.body.querySelector('[data-huddle-confirm]')); });
    expect([...document.body.querySelectorAll('[data-huddle-preview]')].map((p) => p.textContent)).toEqual([
      'For your Diversifier game: Fade BBB becomes Watch BBB',
      'For your Speculator: Fade BBB becomes Watch BBB',
    ]);
    expect(document.body.querySelector('[role="alert"]').textContent).toBe(COPY.huddle.notices.previewedApproaches);
    expect(confirm.mock.calls[0][0].acknowledged).toBeNull();
    await act(async () => { click(document.body.querySelector('[data-huddle-confirm]')); });
    expect(confirm.mock.calls[1][0].acknowledged).toEqual({ diversifier: 'rv-d', degen: 'rv-s' });
    expect(document.body.querySelectorAll('[data-huddle-preview]').length).toBe(0);
  });

  it('a 422 preview and a 409 conflict each say so; the words are the copy table\'s', async () => {
    const confirm = vi.fn(async () => ({ ok: false, status: 422, body: { error: 'validation_changed', drops: [{ kind: 'stance', index: 0, reason: 'level_out_of_range' }], transforms: [] } }));
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

describe('the sheet body\'s stops, resume and answers (review L3-2, L3-4, L3-5, L3-9, L3-10)', () => {
  const AUDIO = { ...HUDDLE, audio: { durationMs: 70_000, hasAudio: true } };
  let pause; let play;
  beforeEach(() => {
    pause = vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    play = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(async () => {});
  });
  afterEach(() => { pause.mockRestore(); play.mockRestore(); delete document.visibilityState; });
  const sheet = (props = {}, extra = {}) => (
    <HubOverlayProvider><HuddleSheet huddle={huddleProp({ read: { status: 'ready', huddle: AUDIO }, ...props })} onClose={vi.fn()} reducedMotion {...extra} /></HubOverlayProvider>
  );
  const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

  it('closing the sheet stops the audio and drops its source (the element\'s ref cleanup)', () => {
    const m = mount(sheet());
    const audio = document.body.querySelector('audio');
    audio.setAttribute('src', '/api/huddle/audio/x');
    m.unmount();
    expect(pause).toHaveBeenCalled();
    expect(audio.hasAttribute('src')).toBe(false);
  });

  it('a Play still waiting for its URL starts nothing once the tab is hidden, or the ceremony covers the page', async () => {
    for (const stop of ['hidden', 'ceremony']) {
      const token = deferred();
      service.issueHuddlePlayback.mockReturnValueOnce(token.promise);
      const m = keep(mount(sheet()));
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      await act(async () => { click(document.body.querySelector('[data-huddle-play]')); });
      if (stop === 'hidden') {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
        await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
      } else {
        m.rerender(sheet({}, { ceremonyActive: true }));
      }
      await act(async () => { token.resolve({ url: '/api/huddle/audio/late' }); await token.promise; });
      expect(document.body.querySelector('audio').hasAttribute('src'), stop).toBe(false);
      expect(play, stop).not.toHaveBeenCalled();
      m.unmount();
      mounted = mounted.filter((x) => x !== m);
      play.mockClear();
    }
  });

  it('Pause then Play resumes the same source: no second token', async () => {
    service.issueHuddlePlayback.mockResolvedValue({ url: '/api/huddle/audio/a' });
    keep(mount(sheet()));
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    await act(async () => { click(document.body.querySelector('[data-huddle-play]')); });
    expect(service.issueHuddlePlayback).toHaveBeenCalledTimes(1);
    await act(async () => { click(document.body.querySelector('[data-huddle-play]')); });
    expect(service.issueHuddlePlayback).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it('a Confirm that throws, or fails with a 500, never leaves the sheet working, and keeps the player\'s edits for the retry', async () => {
    const confirm = vi.fn(async () => { throw new Error('network'); });
    keep(mount(sheet({ confirm })));
    click(document.body.querySelectorAll('[data-huddle-item] button')[0]); // HOLD AAA removed
    await act(async () => { click(document.body.querySelector('[data-huddle-confirm]')); });
    expect(document.body.querySelector('[data-huddle-confirm]').textContent).toBe(COPY.huddle.confirm);
    expect(document.body.querySelector('[data-huddle-confirm]').disabled).toBe(false);
    expect(document.body.querySelector('[role="alert"]').textContent).toBe(COPY.huddle.notices.failed);
    confirm.mockImplementation(async () => ({ ok: false, status: 500, body: { error: 'internal' } }));
    await act(async () => { click(document.body.querySelector('[data-huddle-confirm]')); });
    await act(async () => { click(document.body.querySelector('[data-huddle-confirm]')); });
    const sent = confirm.mock.calls.map(([arg]) => arg.replacement.stances.map((x) => x.ticker));
    expect(sent).toEqual([['BBB'], ['BBB'], ['BBB']]);
  });

  it('a Skip that throws never leaves the sheet working', async () => {
    const skip = vi.fn(async () => { throw new Error('network'); });
    keep(mount(sheet({ skip })));
    await act(async () => { click(document.body.querySelector('[data-huddle-skip]')); });
    expect(document.body.querySelector('[data-huddle-skip]').disabled).toBe(false);
    expect(document.body.querySelector('[role="alert"]').textContent).toBe(COPY.huddle.notices.failed);
  });

  it('a record still being made, or one that could not be made, shows its state and no plan card', () => {
    for (const [status, words] of [['generating', COPY.huddle.preparing], ['failed', COPY.huddle.unavailable]]) {
      const m = mount(sheet({ read: { status: 'ready', huddle: { ...AUDIO, status, plan: null, script: null } } }));
      expect(document.body.querySelector('[data-huddle-empty]').textContent, status).toBe(words);
      expect(document.body.querySelector('[data-huddle-plan]'), status).toBeNull();
      expect(document.body.querySelector('[data-huddle-confirm]'), status).toBeNull();
      m.unmount();
    }
  });

  it('opened from the Deploy card\'s Reconfirm door, the sheet lands on Reconfirm; from any other door, on Close', async () => {
    const confirmedRecord = { ...AUDIO, plan: { ...AUDIO.plan, status: 'confirmed', confirmations: [{ archetype: 'analyst', revision: 'r1' }] } };
    const line = document.createElement('div');
    line.setAttribute('data-hub-huddle-reconfirm', '');
    const door = document.createElement('button');
    line.appendChild(door);
    document.body.appendChild(line);
    const props = { read: { status: 'ready', huddle: confirmedRecord }, needsReconfirm: true, focusPlan: true };
    const m = mount(sheet(props, { opener: door }));
    await act(async () => { await Promise.resolve(); });
    expect(document.activeElement?.hasAttribute('data-huddle-reconfirm')).toBe(true);
    m.unmount();
    const chip = document.createElement('button');
    document.body.appendChild(chip);
    const m2 = mount(sheet(props, { opener: chip }));
    await act(async () => { await Promise.resolve(); });
    expect(document.activeElement?.getAttribute('aria-label')).toBe(COPY.sheet.close);
    m2.unmount();
    line.remove();
    chip.remove();
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

  it('E7: the status route\'s 404 (outside the cohort) is a settled `outside` answer — not an error, no huddle kept', async () => {
    let last = null;
    keep(mount(<Probe enabled onRead={(r) => { last = r; }} />));
    await act(async () => { await Promise.resolve(); });
    expect(last.read.status).toBe('ready');
    service.fetchHuddleToday.mockRejectedValueOnce(Object.assign(new Error('not_found'), { status: 404 }));
    await act(async () => { await last.refresh(); });
    expect(last.read.status).toBe('outside');
    expect(last.read.huddle).toBeNull();
    expect(last.read.stale).toBeUndefined();
  });

  it('E7: any other failure keeps its S1 meaning (an error first time, the last answer kept after)', async () => {
    service.fetchHuddleToday.mockRejectedValueOnce(Object.assign(new Error('status_failed'), { status: 500 }));
    let last = null;
    keep(mount(<Probe enabled onRead={(r) => { last = r; }} />));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(last.read.status).toBe('error');
  });
});

describe('the plan history\'s reader (review L3-12)', () => {
  it('an older read that lands after a newer one is dropped', async () => {
    const { default: useHuddleHistory } = await import('../../hooks/useHuddleHistory');
    let first;
    service.fetchHuddleHistory
      .mockImplementationOnce(() => new Promise((resolve) => { first = resolve; }))
      .mockImplementationOnce(async () => [{ etDate: ET, planStatus: 'confirmed' }]);
    let last = null;
    function Probe() {
      const r = useHuddleHistory({ auth: { signedIn: true, uid: 'u1', authEpoch: 1 }, enabled: true });
      last = r;
      return null;
    }
    keep(mount(<Probe />));
    await act(async () => { await last.refresh(); });
    expect(last.read.plans).toEqual([{ etDate: ET, planStatus: 'confirmed' }]);
    await act(async () => { first([{ etDate: ET, planStatus: 'proposed' }]); await Promise.resolve(); });
    expect(last.read.plans).toEqual([{ etDate: ET, planStatus: 'confirmed' }]);
  });
});
