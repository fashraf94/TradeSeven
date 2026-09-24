// @vitest-environment jsdom
// src/screens/BackingPreviewScreen.test.jsx
//
// The dev-only Backing design preview (PR 4 follow-up) — every promise it makes:
//
//   · NO NETWORK, NO FIRESTORE. The REAL page is mounted and driven: every
//     state the switcher names, every button, seat, checkbox and link in every
//     state pressed. The network boundary is spied, not stubbed out of the
//     page's reach: window.fetch, fetchWithAuth (every service call in the app
//     goes through it — the stake, the attestation, the pitch, the spectator
//     battles, the slot schedule, the lobby actions), XMLHttpRequest,
//     WebSocket, sendBeacon, and every function the Firestore SDK exports.
//     Not one is called. Two positive controls prove the spies catch the
//     surfaces' own calls when nothing is injected.
//   · THE LABEL, plainly, first on the page.
//   · EVERY STATE renders its surface; the local actions (Save, Continue,
//     Confirm) change this page only and say "preview — nothing saved".
//   · THE FLAG, locally: the landing's pod cards read "Predictions" under the
//     page, while the same card outside it follows featureFlags.js exactly.
//   · THE GATE's decision table — never on production — and main.jsx loading
//     the page only behind it.
//   · THE SLOT: the landing's strip slot is byte-equal to what the real mount
//     (BackingLandingStrip) renders for the same inputs, in all four states.
//
// Mocked, and nothing else: the Firebase bootstrap (env-gated at import), the
// flag as a getter (so one file sees both values; the shipped value is pinned
// by src/config/backingBetaFlags.test.js and nothing here asserts it), and the
// real mount's two data hooks — used only by the slot-equivalence row.

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

const net = vi.hoisted(() => ({ fetch: [], fetchWithAuth: [], firestore: [], xhr: [], ws: [], beacon: [] }));
const flag = vi.hoisted(() => ({ on: false }));
const hooked = vi.hoisted(() => ({ pods: null, inPlay: null }));

vi.mock('../firebase/config', () => ({ db: { preview: 'no database' }, auth: { currentUser: null }, default: {} }));
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal();
  const spied = {};
  for (const [name, value] of Object.entries(actual)) {
    spied[name] = typeof value === 'function' && /^[a-z]/.test(name)
      ? (...args) => { net.firestore.push(name); return value(...args); }
      : value;
  }
  return spied;
});
vi.mock('../utils/fetchWithAuth', () => ({
  fetchWithAuth: (url) => { net.fetchWithAuth.push(String(url)); return Promise.reject(Object.assign(new Error('the network is off in this test'), { code: 'network' })); },
}));
vi.mock('../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  get BACKING_BETA_ENABLED() { return flag.on; },
}));
vi.mock('../hooks/useBackingPods', () => ({ default: () => hooked.pods }));
vi.mock('../hooks/useMyBacking', () => ({ default: () => hooked.inPlay }));

const { default: BackingPreviewScreen, PREVIEW_LABEL, NOTHING_SAVED, PREVIEW_STATES, PREVIEW_FIXTURES } = await import('./BackingPreviewScreen');
const { backingPreviewAllowed, backingPreviewRequested, PRODUCTION_VERCEL_HOSTS } = await import('../components/League/backing/backingPreview');
const { PodCard } = await import('../components/League/LeaguePod');
const { leagueState } = await import('../components/League/leagueFixtures');
const { PREDICTIONS_LABEL, REFUSALS, RESULTS, STATS } = await import('../components/League/backing/backingCopy');
const { findForbiddenTerm } = await import('../constants/backingLexicon');
const BackingLandingStrip = (await import('../components/League/backing/BackingLandingStrip')).default;
const StakeControl = (await import('../components/League/backing/StakeControl')).default;
const YourBacking = (await import('../components/League/backing/YourBacking')).default;
const { doc } = await import('firebase/firestore');
const { fetchWithAuth } = await import('../utils/fetchWithAuth');
// The emitter's per-session dedup is reset before every row, so a telemetry
// emit from the page (which must never happen) is seen on every render, not
// only the first (DARK-2, the PR 5 review record).
const { __resetBackingTelemetry } = await import('../services/backingTelemetry');

// ── the network boundary, spied ─────────────────────────────────────────────
const saved = {};
beforeAll(() => {
  saved.fetch = globalThis.fetch;
  saved.xhrOpen = XMLHttpRequest.prototype.open;
  saved.WebSocket = globalThis.WebSocket;
  saved.sendBeacon = navigator.sendBeacon;
  globalThis.fetch = (url) => { net.fetch.push(String(url)); return Promise.reject(new Error('the network is off in this test')); };
  XMLHttpRequest.prototype.open = function open(method, url, ...rest) { net.xhr.push(String(url)); return saved.xhrOpen.call(this, method, url, ...rest); };
  globalThis.WebSocket = class { constructor(url) { net.ws.push(String(url)); throw new Error('the network is off in this test'); } };
  navigator.sendBeacon = (url) => { net.beacon.push(String(url)); return false; };
});
afterAll(() => {
  globalThis.fetch = saved.fetch;
  XMLHttpRequest.prototype.open = saved.xhrOpen;
  globalThis.WebSocket = saved.WebSocket;
  navigator.sendBeacon = saved.sendBeacon;
});
const resetNet = () => { for (const k of Object.keys(net)) net[k].length = 0; };
const expectNoNetwork = () => {
  expect(net.fetch, 'window.fetch').toEqual([]);
  expect(net.fetchWithAuth, `fetchWithAuth — every service call: ${JSON.stringify(net.fetchWithAuth)}`).toEqual([]);
  expect(net.firestore, 'the Firestore SDK').toEqual([]);
  expect(net.xhr, 'XMLHttpRequest').toEqual([]);
  expect(net.ws, 'WebSocket').toEqual([]);
  expect(net.beacon, 'sendBeacon').toEqual([]);
};

// ── mounting and pressing ───────────────────────────────────────────────────
let roots = [];
const settle = async () => { for (let i = 0; i < 6; i += 1) await act(async () => { await Promise.resolve(); }); };
async function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(element); });
  await settle();
  roots.push({ root, container });
  return container;
}
async function press(el) {
  await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
  await settle();
}
const stage = (page) => page.querySelector('[data-preview="stage"]');
const current = (page) => stage(page).getAttribute('data-preview-current');
const noteText = (page) => page.querySelector('[data-preview="note"]')?.textContent ?? null;
async function select(page, stateId) {
  const target = PREVIEW_STATES.find((s) => s.id === stateId);
  await press(page.querySelector(`[data-preview-group="${target.group}"]`));
  await press(page.querySelector(`[data-preview-state="${stateId}"]`));
  expect(current(page)).toBe(stateId);
}
const byText = (root, selector, text) => [...root.querySelectorAll(selector)].find((el) => el.textContent.trim() === text) ?? null;

beforeEach(() => { flag.on = false; resetNet(); __resetBackingTelemetry(); window.history.replaceState(null, '', '/?preview=backing'); });
afterEach(async () => {
  for (const { root, container } of roots) { await act(async () => root.unmount()); container.remove(); }
  roots = [];
  vi.useRealTimers();
});

// ── what each state must show ───────────────────────────────────────────────
const FUNNEL_MARKERS = ['Round 1 · 16', 'Round 2 · 8', 'YOUR PATH', 'FINAL 4'];
function expectState(page, state) {
  const s = stage(page);
  const text = s.textContent;
  switch (state.group) {
    case 'strip': {
      const strip = s.querySelector('[data-backing="strip-slot"] > [data-backing="strip"]');
      expect(strip, `${state.id}: the strip in its slot`).not.toBeNull();
      expect(strip.getAttribute('data-strip-state')).toBe(state.kind);
      // The flag, forced on locally: every landing pod card reads Predictions.
      expect(text).toContain(PREDICTIONS_LABEL);
      expect(text).not.toContain('Tap a seat to spectate');
      if (state.landing === 'no-bracket') for (const m of FUNNEL_MARKERS) expect(text, `${state.id}: ${m}`).not.toContain(m);
      else expect(text).toContain('Your group ·');
      break;
    }
    case 'pods': {
      const pod = s.querySelector('[data-backing="pod"]');
      expect(pod, state.id).not.toBeNull();
      if (state.pod === 'revealed') { expect(pod.getAttribute('data-pool-status')).toBe('closed'); expect(text).toContain('Pot 1,200 BP'); }
      else { expect(pod.getAttribute('data-pool-status')).toBe('open'); expect(text).toContain('SEALED'); expect(text).not.toContain('1,200'); }
      if (state.pod === 'qualified') expect(s.querySelector('[data-frozen="true"]')).not.toBeNull();
      if (state.pod === 'below-floor') expect(text).toContain('Backers 2 of 3');
      if (state.pod === 'your-pod') expect(text).toContain('Yours');
      break;
    }
    case 'card': {
      expect(s.querySelector('[data-backing="team-card"]'), state.id).not.toBeNull();
      const tape = { 'card-first-week': 'tape-first-week', 'card-veteran': 'tape-last-week', 'card-cpu': 'tape-cpu', 'card-own': 'tape-last-week' }[state.id];
      expect(s.querySelector(`[data-backing="${tape}"]`), `${state.id}: ${tape}`).not.toBeNull();
      if (state.id === 'card-own') { expect(s.querySelector('[data-backing="cta-yours"]')).not.toBeNull(); expect(byText(s, 'button', 'EDIT')).not.toBeNull(); }
      else expect(s.querySelector('[data-backing="cta-back"]')).not.toBeNull();
      break;
    }
    case 'stake': {
      if (state.variant === 'attest') { expect(s.querySelector('[data-backing="attestation"]')).not.toBeNull(); expect(s.querySelector('[data-backing="stake-control"]')).toBeNull(); }
      if (state.variant === 'attested') expect(s.querySelector('[data-backing="stake-control"]')).not.toBeNull();
      if (state.variant === 'refusal') { expect(s.querySelector('[data-backing="stake-error"]')?.textContent).toBe(REFUSALS.pool_closed); expect(s.querySelector('[data-backing="backed"]')).toBeNull(); expect(noteText(page)).toBe(NOTHING_SAVED); }
      if (state.variant === 'backed') { expect(s.querySelector('[data-backing="backed"]')?.textContent).toContain('Backed · 500 BP'); expect(noteText(page)).toBe(NOTHING_SAVED); }
      break;
    }
    case 'results': {
      const card = s.querySelector('[data-backing="results-card"]');
      expect(card, state.id).not.toBeNull();
      expect(card.getAttribute('data-outcome')).toBe({ win: 'settled', loss: 'settled', refunded: 'refunded', insufficient: 'insufficient' }[state.result]);
      // MUTATION CHECK 3's fixture on the page: the stake document's payout, never stake × pays ×.
      if (state.result === 'win') { expect(text).toContain('paid 714 BP'); expect(text).not.toContain('715'); expect(text).toContain('+114 BP net'); expect(text).toContain('70% of BP in this pool backed them'); }
      // The loss: the viewer's stake row says "lost" and no BP was paid to them; the WINNING team's row still shows what the pot paid (×).
      if (state.result === 'loss') { expect(text).toContain('−500 BP net'); expect(text).toContain('lost'); expect(text).not.toMatch(/paid \d/); expect(text).toContain('paid ×3.33'); }
      if (state.result === 'refunded') { expect(text).toContain(RESULTS.reason.group_voided); expect(text).toContain(RESULTS.neutral); expect(text).not.toContain('pays ×'); }
      if (state.result === 'insufficient') { expect(text).toContain(RESULTS.reason.insufficient); expect(text).not.toContain('Winner'); }
      // The tape link rides a SETTLED result only (there is no film room for a pool that never played out).
      if (state.result === 'win' || state.result === 'loss') expect(s.querySelector('[data-backing="results-tape"]'), `${state.id}: the tape link`).not.toBeNull();
      else expect(s.querySelector('[data-backing="results-tape"]'), `${state.id}: no tape link`).toBeNull();
      break;
    }
    case 'stats': {
      expect(s.querySelector(state.stats === 'mine' ? '[data-backing="my-stats"]' : '[data-backing="trainer-stats"]'), state.id).not.toBeNull();
      expect(text).toContain(STATS.eyebrow);
      if (state.stats === 'mine') { expect(text).toContain(STATS.sub); expect(text).toContain('1 of 2 pools'); }
      if (state.stats === 'trainer') { expect(text).toContain(STATS.trainer.uniqueBackers); expect(text).toContain('600 BP'); }
      expect(text).not.toMatch(/leaderboard|percentile/i);
      break;
    }
    default: {
      expect(s.querySelector('[data-backing="your-backing-section"]'), state.id).not.toBeNull();
      if (state.week === 'before-monday') { expect(text).toContain('Locked in · plays Monday'); expect(text).not.toMatch(/Day \d of 5/); }
      if (state.week === 'monday') { expect(text).toContain('Day 1 of 5'); expect(text).toContain('This week · both layers'); expect(text).toContain('Kestrel · 6'); expect(s.querySelector('[data-backing="week-standing"]')).toBeNull(); }
      if (state.week === 'mid-week') { expect(text).toContain('Day 3 of 5'); expect(s.querySelector('[data-backing="week-standing"]')).not.toBeNull(); }
      expect(text).not.toContain('Confirm');
    }
  }
}

describe('the page — the label, every state, the local actions', () => {
  it('says plainly, first on the page, what it is', async () => {
    const page = await mount(<BackingPreviewScreen />);
    const label = page.querySelector('[data-preview="label"]');
    expect(PREVIEW_LABEL).toBe('Backing — design preview. Fixture data. Nothing here is real or saved.');
    expect(label.textContent).toBe(PREVIEW_LABEL);
    expect(page.querySelector('[data-preview="header"]').firstElementChild).toBe(label);
    expect(page.textContent.startsWith(PREVIEW_LABEL)).toBe(true);
  });

  it('the switcher names every surface state the build asks for — 23 from PR 4, PR 5\'s four results and two stats states, and the pre-flip cleanup\'s top-up (D-ag)', () => {
    const byGroup = (g) => PREVIEW_STATES.filter((s) => s.group === g).map((s) => s.id);
    expect(byGroup('strip')).toEqual(['open', 'staked', 'week', 'between'].flatMap((k) => [`strip-${k}-no-bracket`, `strip-${k}-bracket`]));
    expect(byGroup('pods')).toEqual(['pods-below-floor', 'pods-qualified', 'pods-revealed', 'pods-your-pod']);
    expect(byGroup('card')).toEqual(['card-first-week', 'card-veteran', 'card-cpu', 'card-own']);
    expect(byGroup('stake')).toEqual(['stake-attest', 'stake-attested', 'stake-refusal', 'stake-backed', 'stake-top-up']);
    expect(byGroup('week')).toEqual(['week-before-monday', 'week-monday', 'week-mid-week']);
    expect(byGroup('results')).toEqual(['results-win', 'results-loss', 'results-refunded', 'results-insufficient']);
    expect(byGroup('stats')).toEqual(['stats-mine', 'stats-trainer']);
    expect(PREVIEW_STATES).toHaveLength(30);
  });

  it('every state renders its surface, from the switcher — and the page speaks no forbidden term', async () => {
    const page = await mount(<BackingPreviewScreen />);
    for (const state of PREVIEW_STATES) {
      await select(page, state.id);
      expectState(page, state);
      const own = [page.querySelector('[data-preview="header"]').textContent,
        ...[...stage(page).querySelectorAll('[data-backing="strip"], [data-backing="pod-list"], [data-backing="team-card"], [data-backing="stake-control"], [data-backing="attestation"], [data-backing="backed"], [data-backing="your-backing-section"], [data-backing="results-card"], [data-backing="my-stats"], [data-backing="trainer-stats"]')].map((el) => el.textContent)].join(' ');
      expect(findForbiddenTerm(own), state.id).toBeNull();
    }
    expectNoNetwork();
  }, 60_000);

  it('D-af: every state\'s teams are AGENT-NAMED, and no backing surface shows a raw account id (Amendment C §C1)', async () => {
    // The raw-id guard's three shapes (src/components/League/backing/
    // backingRawIds.guard.test.jsx walks every endpoint and surface; this row
    // walks this page's own fixture states the same way).
    const RAW_ID = [
      /(?<![A-Za-z0-9])[A-Za-z0-9]{28}(?![A-Za-z0-9])/,
      /(?<![\w-])od-[A-Za-z0-9][\w-]*/,
      /(?<![\w-])cpu-\d+(?![\w-])/,
    ];
    const SURFACES = '[data-backing="strip"], [data-backing="pod-list"], [data-backing="team-card"], [data-backing="stake-control"], [data-backing="attestation"], [data-backing="backed"], [data-backing="your-backing-section"], [data-backing="results-card"], [data-backing="my-stats"], [data-backing="trainer-stats"]';
    // Text node by text node, separated — `textContent` glues adjacent nodes
    // ("6" + "book" + "NVDA" …) into runs no reader ever sees.
    const nodesText = (el) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const out = [];
      for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.nodeValue.trim()) out.push(n.nodeValue);
      return out.join(' \u2016 ');
    };
    const page = await mount(<BackingPreviewScreen />);
    const offenders = [];
    const seen = [];
    for (const state of PREVIEW_STATES) {
      await select(page, state.id);
      for (const el of stage(page).querySelectorAll(SURFACES)) {
        // The surface root's OWN attributes too — `querySelectorAll` searches
        // descendants only (this build's review record, RAWID-4).
        const attrs = [el, ...el.querySelectorAll('[aria-label], [title], [placeholder], [alt]')]
          .flatMap((n) => ['aria-label', 'title', 'placeholder', 'alt'].map((a) => n.getAttribute(a)).filter(Boolean));
        const text = [nodesText(el), ...attrs].join(' \u2016 ');
        seen.push(text);
        for (const re of RAW_ID) {
          const m = text.match(re);
          if (m) offenders.push(`${state.id}: ${JSON.stringify(m[0])}`);
        }
      }
    }
    expect(offenders).toEqual([]);
    // Not vacuous: the fixtures' teams read by their agents, the players beside them.
    const all = seen.join(' ');
    for (const name of ['Kestrel', 'Tarn', 'Orbit', 'Winner: Kestrel', 'Kestrel · 350 BP']) expect(all, name).toContain(name);
    expectNoNetwork();
  }, 60_000);

  it('a state is addressable: ?state=<id> opens it, and the switcher keeps the URL in step', async () => {
    window.history.replaceState(null, '', '/?preview=backing&state=card-cpu');
    const page = await mount(<BackingPreviewScreen />);
    expect(current(page)).toBe('card-cpu');
    await select(page, 'week-monday');
    expect(new URLSearchParams(window.location.search).get('state')).toBe('week-monday');
    expect(new URLSearchParams(window.location.search).get('preview')).toBe('backing');
  });

  it('the pitch editor saves to this page only, and says so', async () => {
    const page = await mount(<BackingPreviewScreen />);
    await select(page, 'card-own');
    await press(byText(stage(page), 'button', 'EDIT'));
    const box = stage(page).querySelector('textarea');
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(box, 'I back breadth, and my agent keeps me honest.');
      box.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await press(byText(stage(page), 'button', 'Save'));
    expect(stage(page).textContent).toContain('“I back breadth, and my agent keeps me honest.”');
    expect(noteText(page)).toBe(NOTHING_SAVED);
    expectNoNetwork();
  });

  it('attestation: both statements, Continue — the control opens, locally, and the page says so', async () => {
    const page = await mount(<BackingPreviewScreen />);
    await select(page, 'stake-attest');
    for (const box of stage(page).querySelectorAll('input[type="checkbox"]')) await press(box);
    await press(byText(stage(page), 'button', 'Continue'));
    expect(stage(page).querySelector('[data-backing="stake-control"]')).not.toBeNull();
    expect(noteText(page)).toBe(NOTHING_SAVED);
    expectNoNetwork();
  });

  it('the surfaces lead into each other: the strip → the pods, a seat → its card, the card → the stake control for that team', async () => {
    const page = await mount(<BackingPreviewScreen />);
    await select(page, 'strip-open-no-bracket');
    await press(stage(page).querySelector('[data-backing="strip"]'));
    expect(current(page)).toBe('pods-below-floor');
    const draco = [...stage(page).querySelectorAll('[data-backing="seat"]')].find((el) => el.textContent.includes('Draco'));
    await press(draco);
    expect(current(page)).toBe('card-first-week');
    await press(stage(page).querySelector('[data-backing="cta-back"]'));
    expect(current(page)).toBe('stake-attested');
    expect(stage(page).textContent).toContain('Back Draco & Tarn');
    expectNoNetwork();
  });

  it('EVERY button, seat, checkbox and link in EVERY state, pressed — zero fetch, zero Firestore', async () => {
    const page = await mount(<BackingPreviewScreen />);
    const CLICKABLE = 'button, [role="button"], input, textarea, .lg-tap, [style*="cursor: pointer"]';
    let pressed = 0;
    for (const state of PREVIEW_STATES) {
      await select(page, state.id);
      for (let i = 0; i < 400; i += 1) {
        if (current(page) !== state.id) await select(page, state.id);
        const targets = [...stage(page).querySelectorAll(CLICKABLE)];
        if (i >= targets.length) break;
        await press(targets[i]);
        pressed += 1;
      }
    }
    expect(pressed).toBeGreaterThan(150);
    expectNoNetwork();
  }, 120_000);
});

describe('the spies are not vacuous — the surfaces call the network when nothing is injected', () => {
  it('the spied Firestore SDK and fetchWithAuth record a call', async () => {
    try { doc({ not: 'a database' }, 'x/y'); } catch { /* the fake database refuses; the call is what counts */ }
    await fetchWithAuth('/api/probe').catch(() => {});
    expect(net.firestore).toContain('doc');
    expect(net.fetchWithAuth).toEqual(['/api/probe']);
  });

  it('Your Backing without the injected battles polls the battle view — the page’s injection is what keeps it quiet', async () => {
    const inPlay = { stakes: [{ id: 's1', groupId: 'g-play', teamOdUserId: 'od-a', amount: 250, status: 'live', weekKey: '2026-W39' }], poolsById: { 'g-play': { status: 'closed' } }, groupsById: { 'g-play': { status: 'battle', seatNames: { 'od-a': 'Mira' }, players: [{ odUserId: 'od-a', picks: [] }], dailyScores: {} } } };
    await mount(<YourBacking inPlay={inPlay} now={PREVIEW_FIXTURES.now} />);
    expect(net.fetchWithAuth).toEqual(['/api/tournament/battle-view?groupId=g-play']);
  });

  it('the stake control without injected services sends the stake to the real endpoint — the page’s injection is what keeps it local', async () => {
    const card = { groupId: 'g1', odUserId: 'od-a', seat: { index: 1, count: 4, isCpu: false, isViewer: false, viewerSeated: false }, team: { displayName: 'Mira', isCpu: false, agent: { name: 'Kestrel' } } };
    const control = await mount(<StakeControl card={card} pod={{ groupId: 'g1', pool: { status: 'open' }, myStakes: [] }} wallet={{ known: true, left: 1000, total: 1000 }} eligibility={{ status: 'attested', refresh: () => {} }} />);
    await press(control.querySelector('[data-backing="confirm"]'));
    expect(net.fetchWithAuth).toEqual(['/api/tournament/backing-stake']);
  });
});

describe('the flag, forced on LOCALLY — featureFlags.js decides everywhere else', () => {
  it('the same pod card outside the page follows the flag, both ways', () => {
    const pod = leagueState('open').baseGames[0];
    flag.on = false;
    expect(renderToString(<PodCard pod={pod} accent="#5EEAD4" onSpectate={() => {}} />)).toContain('>Tap a seat to spectate<');
    flag.on = true;
    expect(renderToString(<PodCard pod={pod} accent="#5EEAD4" onSpectate={() => {}} />)).toContain(`>${PREDICTIONS_LABEL}<`);
  });
});

describe('the landing slot — byte-equal to what the real mount renders', () => {
  for (const kind of ['open', 'staked', 'week', 'between']) {
    it(`the “${kind}” strip in the page’s landing is BackingLandingStrip’s output for the same inputs`, () => {
      const inputs = PREVIEW_FIXTURES.strip[kind];
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(PREVIEW_FIXTURES.now);
      flag.on = true;
      hooked.pods = { data: { baseLayerWeek: '2026-W40', backingWeekCloses: PREVIEW_FIXTURES.backingWeekCloses, pods: inputs.pods }, pods: inputs.pods, loading: false, error: null, refresh: () => {} };
      hooked.inPlay = inputs.inPlay;
      const real = renderToString(<BackingLandingStrip uid="u1" onOpen={() => {}} />);
      window.history.replaceState(null, '', `/?preview=backing&state=strip-${kind}-no-bracket`);
      const html = renderToString(<BackingPreviewScreen />);
      const slot = html.match(/<div data-backing="strip-slot"[\s\S]*?<\/button><\/div>/)?.[0];
      expect(real).toMatch(/^<div data-backing="strip-slot"/);
      expect(slot).toBe(real);
    });
  }
});

describe('the gate — reachable under the dev server or on a Vercel preview, never on production', () => {
  const allowed = (hostname, extra = {}) => backingPreviewAllowed({ hostname, ...extra });

  it('the Vite dev server: allowed', () => {
    expect(allowed('localhost', { isDev: true })).toBe(true);
    expect(allowed('127.0.0.1', { isDev: true })).toBe(true);
  });

  it('a Vercel preview host: allowed — the branch alias and a per-deployment URL', () => {
    expect(allowed('trade-seven-git-backing-pr4-dev-preview-fais-projects-bc179554.vercel.app')).toBe(true);
    expect(allowed('trade-seven-4mfxz9bkb-fais-projects-bc179554.vercel.app')).toBe(true);
    expect(allowed('Trade-Seven-Git-Backing-Pr4-Dev-Preview-Fais-Projects-Bc179554.Vercel.App')).toBe(true);
    expect(allowed('trade-seven-git-x-fais-projects-bc179554.vercel.app', { vercelEnv: 'preview' })).toBe(true);
  });

  it('production: refused — the production domain and every production .vercel.app alias, the production branch alias included', () => {
    for (const host of ['fantasytrades.io', 'www.fantasytrades.io', ...PRODUCTION_VERCEL_HOSTS]) expect(allowed(host), host).toBe(false);
    expect(PRODUCTION_VERCEL_HOSTS).toContain('trade-seven-git-main-fais-projects-bc179554.vercel.app');
  });

  it('a production BUILD is refused on every host, a per-deployment .vercel.app URL included, when the build says so', () => {
    expect(allowed('trade-seven-4mfxz9bkb-fais-projects-bc179554.vercel.app', { vercelEnv: 'production' })).toBe(false);
  });

  it('anything else: refused — a local production build, look-alike hosts, no host', () => {
    for (const host of ['localhost', '127.0.0.1', 'vercel.app', 'notvercel.app', 'evil.com', 'trade-seven-git-x.vercel.app.evil.com', '', null, undefined]) {
      expect(allowed(host), String(host)).toBe(false);
    }
  });

  it('asks for ?preview=backing and nothing else, then applies the gate', () => {
    const at = (search, hostname = 'trade-seven-git-x-fais-projects-bc179554.vercel.app') => ({ search, hostname });
    expect(backingPreviewRequested(at('?preview=backing'))).toBe(true);
    expect(backingPreviewRequested(at('?preview=backing&state=card-cpu'))).toBe(true);
    expect(backingPreviewRequested(at('?preview=baggerbomb'))).toBe(false);
    expect(backingPreviewRequested(at(''))).toBe(false);
    expect(backingPreviewRequested(at('?preview=backing', 'www.fantasytrades.io'))).toBe(false);
    expect(backingPreviewRequested(at('?preview=backing', 'localhost'), { DEV: true })).toBe(true);
    expect(backingPreviewRequested(at('?preview=backing', 'localhost'), { DEV: false })).toBe(false);
    expect(backingPreviewRequested(at('?preview=backing'), { VITE_VERCEL_ENV: 'production' })).toBe(false);
  });

  it('main.jsx loads the page ONLY behind the gate, lazily, with the app untouched in the other branch — and nothing else imports it', () => {
    const main = readFileSync(path.join(REPO, 'src/main.jsx'), 'utf8');
    expect(main).toMatch(/if \(backingPreviewRequested\(window\.location, \{ DEV: import\.meta\.env\.DEV, VITE_VERCEL_ENV: import\.meta\.env\.VITE_VERCEL_ENV \}\)\) \{\s*import\('\.\/screens\/BackingPreviewScreen'\)/);
    const elseAt = main.indexOf('} else {');
    expect(elseAt).toBeGreaterThan(main.indexOf("import('./screens/BackingPreviewScreen')"));
    expect(main.indexOf('<App />')).toBeGreaterThan(elseAt);
    expect(main).not.toMatch(/from ['"]\.\/screens\/BackingPreviewScreen/);
    const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
    const importers = walk(path.join(REPO, 'src'))
      .filter((f) => /\.(js|jsx)$/.test(f) && !/\.test\./.test(f))
      .filter((f) => /BackingPreviewScreen['"]/.test(readFileSync(f, 'utf8')))
      .map((f) => path.relative(REPO, f).split(path.sep).join('/'));
    expect(importers).toEqual(['src/main.jsx']);
  });
});
