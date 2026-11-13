// @vitest-environment jsdom
//
// Shared Research B2 — THE FLOWS (build prompt Tests; K-4, K-6, K-7, K-8, K-9;
// rulings P-1, P-3, P-4): the drop modal inside a REAL HubSheet under
// HubOverlayProvider (registered `within` the stack while open), the three
// corrections, running honesty, the uncertain save, the rate limit, previewRev
// echoed, the server's words for refusals, equip. The body is mounted the way the
// hub amendment's wrapper will mount it: HubSheet → the body, with the stack from
// useHubOverlays() as `overlayStack`. Test files may import the hub (K-2); the
// body never does.

import React from 'react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchWithAuth = vi.hoisted(() => vi.fn());
vi.mock('../../utils/fetchWithAuth', () => ({ fetchWithAuth }));
const transitionHypothesis = vi.hoisted(() => vi.fn());
vi.mock('../../services/hypothesisVersionService', () => ({ transitionHypothesis }));
const equipLoadoutBook = vi.hoisted(() => vi.fn());
vi.mock('../../services/loadoutService', () => ({ equipLoadoutBook }));

const { default: Body } = await import('./SharedResearchSheetBody');
const { SR_COPY: COPY } = await import('./sharedResearchCopy');
const { SR_DROP_LAYER } = await import('./sharedResearchStyle');
const { default: HubSheet } = await import('../CommandCenter/HubSheet');
const { HubOverlayProvider, useHubOverlays } = await import('../CommandCenter/hub/HubOverlays');
const { REVIEW_HONEST_LINE } = await import('../../constants/hypothesisRecords');
const kit = await import('./__fixtures__/srKit');
const { A, IDS, NETWORK, fakeServer, mount, flush, click, typeInto, press, $, $$, buttonNamed, textOf, deferred } = kit;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let mounted = [];
let server;
const keep = (m) => { mounted.push(m); return m; };
beforeEach(() => {
  server = fakeServer({ list: A.list, get: A.getStepped, parse: { status: 200, body: A.parseDrop } });
  fetchWithAuth.mockImplementation(server.fetch);
});
afterEach(() => { for (const m of mounted) m.unmount(); mounted = []; vi.clearAllMocks(); vi.useRealTimers(); });

/** The hub amendment's wrapper, as it will be: a HubSheet with the body inside, the stack handed in. */
function Wrapper(props) {
  const stack = useHubOverlays();
  return (
    <HubSheet title={COPY.title} label={COPY.label} onClose={props.onClose} width={720} reducedMotion>
      <Body {...props} overlayStack={stack} />
    </HubSheet>
  );
}
async function inSheet(props = {}, routes = {}) {
  for (const [k, v] of Object.entries(routes)) server.set(k, v);
  const m = keep(mount(<HubOverlayProvider><Wrapper stories={[]} agentName="Atlas" agentId="agent-fixture-1" onClose={vi.fn()} {...props} /></HubOverlayProvider>));
  await flush();
  return m;
}
async function standalone(props = {}, routes = {}) {
  for (const [k, v] of Object.entries(routes)) server.set(k, v);
  const m = keep(mount(<Body stories={[]} agentName="Atlas" agentId="agent-fixture-1" onClose={vi.fn()} {...props} />));
  await flush();
  return m;
}
const sheetOverlay = () => $('[data-hub-sheet-overlay]');
const dropCard = () => $('[aria-labelledby="signal-drop-title"]');
const dropOverlay = () => dropCard()?.parentElement ?? null;
const dropButton = (text) => (dropCard() ? [...dropCard().querySelectorAll('button')].find((b) => b.textContent.trim() === text) ?? null : null);

describe('the SignalDrop door, inside a real HubSheet (spec §4.1; K-4; P-1)', () => {
  it('Use a SignalDrop opens the modal over the sheet (layer 1001), registered within the stack: the sheet goes inert, the modal does not', async () => {
    await inSheet();
    expect(sheetOverlay().hasAttribute('inert')).toBe(false);
    click($('[data-sr-use-drop]'));
    await flush();
    expect(dropCard()).not.toBeNull();
    expect(dropOverlay().parentElement).toBe(document.body);
    expect(dropOverlay().style.zIndex).toBe(String(SR_DROP_LAYER));
    expect(Number(dropOverlay().style.zIndex)).toBeGreaterThan(Number(sheetOverlay().style.zIndex));
    expect(sheetOverlay().hasAttribute('inert')).toBe(true);
    expect(dropOverlay().closest('[inert]')).toBeNull();
  });

  it('the modal\'s CTA reads "Investigate this"; its result reaches the drop preview, which opens with kind signaldrop and the dropId', async () => {
    await inSheet({}, { open: A.openDrop });
    click($('[data-sr-use-drop]'));
    await flush();
    typeInto(dropCard().querySelector('textarea'), 'Utilities say gas turbines for new data centers are sold out into 2028.');
    click(dropButton('Read this signal'));
    await flush();
    expect(dropButton('Start dialogue')).toBeNull();
    const cta = dropButton('Investigate this');
    expect(cta).not.toBeNull();
    const parseDropId = server.sent('parse')[0].body.dropId;
    click(cta);
    await flush();
    expect(sheetOverlay().hasAttribute('inert')).toBe(false); // released
    expect($('[data-screen-label="Drop preview"]')).not.toBeNull();
    expect(textOf()).toContain('Gas turbines for data centers');
    expect($('[data-sr-drop-names]').textContent).toContain('ETN');
    expect($('#sr-drop-q').value).toBe(COPY.dropQuestion('Gas turbines for data centers'));
    expect(document.activeElement).toBe($('#sr-drop-q'));
    expect(server.sent('open')).toHaveLength(0); // nothing written before Investigate
    click($('[data-sr-investigate]'));
    await flush();
    const { entry } = server.sent('open')[0].body;
    expect(entry).toEqual({ kind: 'signaldrop', itemRef: { recordKind: 'signalDrops', recordId: parseDropId }, question: COPY.dropQuestion('Gas turbines for data centers') });
    expect($('[data-screen-label="Work · open"]')).not.toBeNull();
  });

  it('Escape closes the modal only: the stack is released, the sheet stays open, focus returns to the door', async () => {
    await inSheet();
    const door = $('[data-sr-use-drop]');
    door.focus();
    click(door);
    await flush();
    press(dropCard(), 'Escape');
    await flush();
    expect(sheetOverlay()).not.toBeNull();
    expect(sheetOverlay().hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe($('[data-sr-use-drop]'));
  });

  it('closed and opened again at once (its DOM still leaving): the modal is usable, the sheet inert — `within`, never "every body child"', async () => {
    await inSheet();
    click($('[data-sr-use-drop]'));
    await flush();
    press(dropCard(), 'Escape');
    // no wait: the exit animation keeps the modal's node in <body>, and the same node comes back on the re-open
    click($('[data-sr-use-drop]'));
    await flush();
    expect(dropCard()).not.toBeNull();
    expect(dropOverlay().closest('[inert]')).toBeNull();
    expect(sheetOverlay().hasAttribute('inert')).toBe(true);
  });

  it('mode signaldrop opens the modal at once (the later hub shortcut)', async () => {
    await inSheet({ mode: 'signaldrop' });
    expect(dropCard()).not.toBeNull();
    expect(sheetOverlay().hasAttribute('inert')).toBe(true);
  });

  it('c2: opened at once (mode signaldrop), closed with Escape: focus is back in the sheet, not on <body>', async () => {
    await inSheet({ mode: 'signaldrop' });
    await flush();
    expect(dropCard()).not.toBeNull();
    press(dropCard(), 'Escape');
    await flush();
    expect(sheetOverlay().hasAttribute('inert')).toBe(false);
    expect(document.activeElement).not.toBe(document.body);
    expect(sheetOverlay().contains(document.activeElement)).toBe(true);
  });

  it('unmounting with the modal open releases its hold on the stack', async () => {
    const m = await inSheet({ mode: 'signaldrop' });
    const host = m.host;
    m.unmount();
    mounted = mounted.filter((x) => x !== m);
    expect(host.isConnected).toBe(false);
    expect($$('[inert]').filter((el) => el.isConnected)).toEqual([]);
  });

  it('gated: no door into the modal', async () => {
    await inSheet({ gated: true });
    expect($('[data-sr-use-drop]').disabled).toBe(true);
  });
});

describe('Correction B: each card examines ITS OWN connection (spec §9)', () => {
  it('two cards send two different targets { symbol, relationshipFindingId, openFindingId }', async () => {
    // the step answers the same two-company record (its companies unchanged), so both cards stay on screen
    const same = { status: 200, body: { ...A.getShopPay.body, changed: { summary: false, findings: 0, summaryWithheld: false } } };
    await standalone({ mode: 'session', sessionId: IDS.spSid }, { get: A.getShopPay, step: same });
    const supported = A.getShopPay.body.companies.supported;
    expect(supported.map((c) => c.symbol).sort()).toEqual(['AAPL', 'SHOP']);
    click($('[data-sr-examine="SHOP"]'));
    await flush();
    click($('[data-sr-examine="AAPL"]'));
    await flush();
    const targets = server.sent('step').map((c) => c.body.target);
    const shop = supported.find((c) => c.symbol === 'SHOP');
    const aapl = supported.find((c) => c.symbol === 'AAPL');
    expect(targets).toEqual([
      { symbol: 'SHOP', relationshipFindingId: shop.relationshipFindingId, openFindingId: shop.openQuestion?.findingId ?? null },
      { symbol: 'AAPL', relationshipFindingId: aapl.relationshipFindingId, openFindingId: aapl.openQuestion?.findingId ?? null },
    ]);
    expect(targets[0]).not.toEqual(targets[1]);
    expect(server.sent('step').every((c) => c.body.intent === 'examine')).toBe(true);
  });
});

describe('Correction A: companies are the server\'s, never derived (spec §9)', () => {
  it('a refresh answer with unchanged companies renders the same cards and leads', async () => {
    await standalone({ mode: 'session', sessionId: IDS.dcSid }, { get: A.getStepped, step: A.stepRefreshSame });
    const before = [$$('[data-sr-company]').map((e) => e.dataset.srCompany), $$('[data-sr-lead]').map((e) => e.dataset.srLead)];
    const beforeHtml = $('[data-sr-company="ETN"]').outerHTML;
    click(buttonNamed(COPY.refresh) ?? $('[data-sr-next]'));
    await flush();
    expect([$$('[data-sr-company]').map((e) => e.dataset.srCompany), $$('[data-sr-lead]').map((e) => e.dataset.srLead)]).toEqual(before);
    expect($('[data-sr-company="ETN"]').outerHTML).toBe(beforeHtml);
  });

  it('the cards are exactly the answer\'s companies: drop one from the answer and its card goes', async () => {
    const body = { ...A.getShopPay.body, companies: { ...A.getShopPay.body.companies, supported: A.getShopPay.body.companies.supported.filter((c) => c.symbol === 'SHOP') } };
    await standalone({ mode: 'session', sessionId: IDS.spSid }, { get: { status: 200, body } });
    expect($$('[data-sr-company]').map((e) => e.dataset.srCompany)).toEqual(['SHOP']);
  });
});

async function toAdopt(routes = {}) {
  await standalone({ mode: 'session', sessionId: IDS.spSid }, { get: A.getShopPay, ...routes });
  click($('[data-sr-adopt]'));
  await flush();
}
const pick = (symbol) => $(`[data-sr-pick="${symbol}"] input`);
const statement = () => $('#sr-statement');
const preview = A.getShopPay.body.adoptPreview;
const fragment = (symbol) => preview.companies.find((c) => c.symbol === symbol).fragment;

describe('Correction C: adoption from the server\'s preview (spec §9; K-7)', () => {
  it('the draft is the picked fragments; dropping a name regenerates it with no request', async () => {
    await toAdopt();
    expect(statement().value).toBe(preview.draft);
    const before = server.calls.length;
    click(pick('AAPL'));
    expect(statement().value).toBe(fragment('SHOP'));
    expect(server.calls.length).toBe(before);
    click(pick('AAPL'));
    expect(statement().value).toBe(preview.companies.map((c) => c.fragment).join(' '));
  });

  it('a deselected company still named blocks Save', async () => {
    await toAdopt();
    click(pick('AAPL'));
    typeInto(statement(), `${fragment('SHOP')} Apple Pay competes at the same checkouts.`);
    click($('[data-sr-horizon="positional"]'));
    expect($('[data-sr-stray]').textContent).toBe(COPY.stray(['Apple Inc.']));
    expect($('[data-sr-save-button]').disabled).toBe(true);
    typeInto(statement(), fragment('SHOP'));
    expect($('[data-sr-stray]')).toBeNull();
    expect($('[data-sr-save-button]').disabled).toBe(false);
  });

  it('over 1,000 characters: the count says so and Save is held', async () => {
    await toAdopt();
    click($('[data-sr-horizon="swing"]'));
    typeInto(statement(), `${fragment('SHOP')} ${'x'.repeat(1000)}`);
    expect($('[data-sr-count]').textContent).toContain(COPY.over);
    expect($('[data-sr-save-button]').disabled).toBe(true);
  });

  it('Save sends the picks, the horizon, the conditions and previewRev EXACTLY as received (byte for byte)', async () => {
    await toAdopt({ adopt: A.adoptSaved });
    click(pick('AAPL'));
    click($('[data-sr-horizon="positional"]'));
    typeInto($('[aria-label="SHOP · Live above $ — Shopify Inc., on a daily close"]'), '150');
    click($('[data-sr-save-button]'));
    await flush();
    const sent = server.sent('adopt')[0];
    expect(sent.body).toEqual({
      action: 'adopt', sessionId: IDS.spSid, statement: fragment('SHOP'), horizonEnum: 'positional', symbols: ['SHOP'],
      activation: [{ symbol: 'SHOP', side: 'above', level: 150, basis: 'daily_close' }], invalidation: [], previewRev: preview.previewRev,
    });
    expect(sent.raw).toContain(`"previewRev":"${preview.previewRev}"`);
    expect(Object.keys(sent.body)).not.toContain('keptFindingIds');
  });

  it('preview_stale: the new preview, the player\'s edits kept where the companies still exist, and confirm again with the new rev', async () => {
    // the record moved under the preview: the sheet reads it again with the new preview (review a4/b2)
    await toAdopt({ get: [A.getShopPay, A.getShopPay, A.getShopPayMoved], adopt: [A.adoptStale, A.adoptSaved] });
    click(pick('AAPL'));
    typeInto(statement(), `${fragment('SHOP')} My own words.`);
    click($('[data-sr-horizon="longterm"]'));
    click($('[data-sr-save-button]'));
    await flush();
    expect($('[data-sr-save="stale"]').textContent).toBe(A.adoptStale.body.message);
    expect(statement().value).toBe(`${fragment('SHOP')} My own words.`);
    expect(pick('SHOP').checked).toBe(true);
    expect(pick('AAPL').checked).toBe(false);
    // every id the new preview carries for SHOP is shown, the new finding included — none silently dropped
    const shopCarried = A.adoptStale.body.adoptPreview.companies.find((c) => c.symbol === 'SHOP').carried;
    expect($$('[data-sr-carried-for="SHOP"] [data-sr-finding]').map((e) => e.dataset.srFinding)).toEqual(shopCarried);
    click($('[data-sr-save-button]'));
    await flush();
    const [first, second] = server.sent('adopt').map((c) => c.body.previewRev);
    expect(first).toBe(preview.previewRev);
    expect(second).toBe(A.adoptStale.body.adoptPreview.previewRev);
  });

  it('preview_stale without a preview in the answer: the sheet reads the record for it', async () => {
    await toAdopt({ adopt: A.adoptStaleBare });
    click($('[data-sr-horizon="swing"]'));
    const reads = server.sent('get').length;
    click($('[data-sr-save-button]'));
    await flush();
    expect(server.sent('get').length).toBe(reads + 1);
  });
});

describe('K-5: a refusal shows the server\'s words', () => {
  it('a typed refusal shows the answer\'s message, whatever it says', async () => {
    const custom = { status: 400, body: { error: 'unsupported_assertion', message: 'The server line, exactly as sent.', detail: '71' } };
    await toAdopt({ adopt: custom });
    click($('[data-sr-horizon="swing"]'));
    click($('[data-sr-save-button]'));
    await flush();
    expect($('[data-sr-save="failed"]').textContent).toBe('The server line, exactly as sent.');
  });

  it('a step refusal shows its message too (step_in_flight)', async () => {
    await standalone({ mode: 'session', sessionId: IDS.dcSid }, { step: A.step_in_flight });
    click($('[data-sr-next]'));
    await flush();
    expect($('[data-sr-step-failed]').textContent).toBe(A.step_in_flight.body.message);
  });
});

describe('K-8: running only with a request in flight', () => {
  it('a step shows running while its request is pending, and not after', async () => {
    const held = deferred();
    await standalone({ mode: 'session', sessionId: IDS.dcSid }, { step: held.promise });
    expect($('[data-sr-running]')).toBeNull();
    click($('[data-sr-next]'));
    await flush();
    expect($('[data-sr-running]').getAttribute('role')).toBe('status');
    expect($('[data-sr-running]').textContent).toBe(COPY.running.next);
    held.resolve(A.stepNext);
    await flush();
    expect($('[data-sr-running]')).toBeNull();
  });

  it('a reopened sheet never shows running: a stored running step reads "A step was in progress · Try again"', async () => {
    await standalone({ mode: 'session', sessionId: IDS.dcSid }, { get: A.getWasRunning, step: A.stepRefreshSame });
    expect($('[data-sr-running]')).toBeNull();
    expect($('[data-sr-was-running]').textContent).toContain(COPY.wasRunning);
    click(buttonNamed(COPY.retry, $('[data-sr-was-running]')));
    await flush();
    expect(server.sent('step')[0].body).toMatchObject({ stepId: A.getWasRunning.body.session.lastStep.stepId, intent: 'refresh' });
  });

  it('one request at a time: a double tap sends one step', async () => {
    const held = deferred();
    await standalone({ mode: 'session', sessionId: IDS.dcSid }, { step: held.promise });
    const next = $('[data-sr-next]');
    click(next);
    click(next);
    await flush();
    expect(server.sent('step')).toHaveLength(1);
    held.resolve(A.stepNext);
    await flush();
  });

  it('a network failure on a step: Try again re-sends the same stepId (the server answers a replay)', async () => {
    await standalone({ mode: 'session', sessionId: IDS.dcSid }, { step: [NETWORK, A.stepNext] });
    click($('[data-sr-next]'));
    await flush();
    expect($('[data-sr-step-failed]').textContent).toBe(COPY.network);
    click($('[data-sr-retry-step]'));
    await flush();
    const [a, b] = server.sent('step').map((c) => c.body.stepId);
    expect(b).toBe(a);
  });
});

describe('K-8: the uncertain save', () => {
  async function saveInto(answer, check) {
    await toAdopt({ adopt: [answer, A.adoptSaved] });
    click($('[data-sr-horizon="positional"]'));
    click($('[data-sr-save-button]'));
    await flush();
    if (check) server.set('get', check);
  }

  it('no answer: "Check the record" only — no Save, no retry before the check', async () => {
    await saveInto(NETWORK);
    expect($('[data-sr-save="uncertain"]').textContent).toBe(COPY.saveUncertain);
    expect($('[data-sr-check]')).not.toBeNull();
    expect($('[data-sr-save-button]')).toBeNull();
    expect(server.sent('adopt')).toHaveLength(1);
  });

  it('a 5xx is uncertain too', async () => {
    await saveInto(A.server_error);
    expect($('[data-sr-save="uncertain"]')).not.toBeNull();
  });

  it('Check the record → saved_to_list: "Found it: your idea was saved on the first attempt." — one adopt, ever', async () => {
    await saveInto(NETWORK, A.getShopPaySaved);
    const reads = server.sent('get').length;
    click($('[data-sr-check]'));
    await flush();
    expect(server.sent('get').length).toBe(reads + 1);
    expect($('[data-sr-recovered]').textContent).toBe(COPY.recovered);
    expect(textOf()).toContain(COPY.saved);
    expect(server.sent('adopt')).toHaveLength(1);
  });

  it('Check the record → still open: "Checked: nothing was created. You can try again." — and only then Save runs again', async () => {
    await saveInto(NETWORK, A.getShopPay);
    click($('[data-sr-check]'));
    await flush();
    expect($('[data-sr-save="notsaved"]').textContent).toBe(COPY.notSaved);
    expect(server.sent('adopt')).toHaveLength(1);
    click($('[data-sr-horizon="positional"]'));
    click($('[data-sr-save-button]'));
    await flush();
    expect(server.sent('adopt')).toHaveLength(2);
    expect(textOf()).toContain(COPY.saved);
  });
});

describe('K-6 (e): a 429 holds the action until Retry-After', () => {
  it('rate_limited: the server\'s line; the step re-enabled after Retry-After', async () => {
    await standalone({ mode: 'session', sessionId: IDS.dcSid }, { step: [A.rateLimited, A.stepNext] });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    click($('[data-sr-next]'));
    await flush();
    expect($('[data-sr-step-failed]').textContent).toBe(A.rateLimited.body.message);
    const send = $('[data-sr-send]');
    typeInto($('#sr-direction'), 'Look at suppliers');
    expect($('#sr-direction').disabled).toBe(true);
    expect(send.disabled).toBe(true);
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect($('#sr-direction').disabled).toBe(false);
  });

  it('the IP limiter\'s 429 (its own message, Retry-After) holds it the same way', async () => {
    await standalone({ mode: 'session', sessionId: IDS.dcSid }, { step: A.ipRateLimited });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    click($('[data-sr-next]'));
    await flush();
    expect($('[data-sr-step-failed]').textContent).toBe(A.ipRateLimited.body.message);
    expect($('#sr-direction').disabled).toBe(true);
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect($('#sr-direction').disabled).toBe(false);
  });
});

describe('the saved idea and equip (K-9; ruling P-4)', () => {
  async function saved(props = {}) {
    await toAdopt({ adopt: A.adoptSaved });
    click($('[data-sr-horizon="positional"]'));
    click($('[data-sr-save-button]'));
    await flush();
    return props;
  }

  it('the saved view carries REVIEW_HONEST_LINE with the agent\'s name, and the research-to-game line', async () => {
    await saved();
    const line = REVIEW_HONEST_LINE.replace('[AGENT]', 'Atlas');
    expect($('[data-sr-honest]').textContent).toBe(`${line} A link between research and a game is shown only once the game records it.`);
  });

  it('Use it in my next game: the ready transition, then equip, on the agent the hub named', async () => {
    transitionHypothesis.mockResolvedValue({ ok: true });
    equipLoadoutBook.mockResolvedValue({ equippedWatchlistId: 'wl-fixture-1' });
    await saved();
    click($('[data-sr-equip]'));
    await flush();
    expect(transitionHypothesis).toHaveBeenCalledWith('wl-fixture-1', { version: 1, action: 'ready', expectedStatus: 'researched' });
    expect(equipLoadoutBook).toHaveBeenCalledWith('agent-fixture-1', 'wl-fixture-1', 'baggerbomb');
    expect($('[data-sr-equipped]').textContent).toContain(COPY.equipped);
  });

  it('a ready that already happened (409 status_conflict) proceeds to equip', async () => {
    transitionHypothesis.mockRejectedValue(Object.assign(new Error('x'), { status: 409, code: 'status_conflict' }));
    equipLoadoutBook.mockResolvedValue({});
    await saved();
    click($('[data-sr-equip]'));
    await flush();
    expect(equipLoadoutBook).toHaveBeenCalledTimes(1);
    expect($('[data-sr-equipped]')).not.toBeNull();
  });

  it('a failed equip: "Saved, not equipped." — the idea is kept', async () => {
    transitionHypothesis.mockResolvedValue({});
    equipLoadoutBook.mockRejectedValue(Object.assign(new Error('x'), { status: 409, code: 'league_locked' }));
    await saved();
    click($('[data-sr-equip]'));
    await flush();
    expect($('[data-sr-equip-failed]').textContent).toBe(COPY.equipFailed);
    expect(textOf()).toContain(COPY.saved);
  });

  it('Not now: saved, not equipped', async () => {
    await saved();
    click(buttonNamed(COPY.notNow));
    expect(textOf()).toContain(COPY.declined);
    expect(equipLoadoutBook).not.toHaveBeenCalled();
  });

  it('no agentId: "Use it in my next game" is not offered', async () => {
    await standalone({ mode: 'session', sessionId: IDS.spSid, agentId: null }, { get: A.getShopPay, adopt: A.adoptSaved });
    click($('[data-sr-adopt]'));
    await flush();
    click($('[data-sr-horizon="positional"]'));
    click($('[data-sr-save-button]'));
    await flush();
    expect(textOf()).toContain(COPY.saved);
    expect($('[data-sr-equip]')).toBeNull();
  });
});

describe('endings (spec §4.5)', () => {
  it('This answered my question → close concluded', async () => {
    await standalone({ mode: 'session', sessionId: IDS.dcSid }, { close: A.closeConcluded });
    click($('[data-sr-conclude]'));
    await flush();
    expect(server.sent('close')[0].body).toEqual({ action: 'close', sessionId: IDS.dcSid, reason: 'concluded' });
    expect($('[data-screen-label="Work · completed"]')).not.toBeNull();
  });

  it('Discard → confirm → close abandoned; Keep it writes nothing', async () => {
    await standalone({ mode: 'session', sessionId: IDS.dcSid }, { close: A.closeConcluded });
    click(buttonNamed(COPY.discard));
    click(buttonNamed(COPY.keep));
    expect(server.sent('close')).toHaveLength(0);
    click(buttonNamed(COPY.discard));
    click($('[data-sr-discard-yes]'));
    await flush();
    expect(server.sent('close')[0].body.reason).toBe('abandoned');
  });
});
