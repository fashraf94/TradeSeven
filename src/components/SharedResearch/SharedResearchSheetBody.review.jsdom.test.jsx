// @vitest-environment jsdom
//
// Shared Research B2 — the rows for the review's findings (BUILD_RULES §2; the build report's review section).
// Each row names its finding and fails on the code the review read (84a12983).

import React, { StrictMode } from 'react';
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
const { REVIEW_HONEST_LINE } = await import('../../constants/hypothesisRecords');
const { ThemeProvider } = await import('../../contexts/ThemeContext');
const { createRoot } = await import('react-dom/client');
const kit = await import('./__fixtures__/srKit');
const { A, IDS, NETWORK, fakeServer, mount, flush, click, typeInto, $, $$, buttonNamed, textOf, storyOf } = kit;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let mounted = [];
let server;
const keep = (m) => { mounted.push(m); return m; };
beforeEach(() => {
  server = fakeServer({ list: A.list, get: A.getStepped });
  fetchWithAuth.mockImplementation(server.fetch);
});
afterEach(() => { for (const m of mounted) m.unmount(); mounted = []; vi.clearAllMocks(); vi.useRealTimers(); });

async function open(props = {}, routes = {}) {
  for (const [k, v] of Object.entries(routes)) server.set(k, v);
  const m = keep(mount(<Body stories={[storyOf()]} agentName="Atlas" agentId="agent-fixture-1" onClose={vi.fn()} {...props} />));
  await flush();
  return m;
}
const GATED = `${COPY.gated}. ${COPY.gatedSub}`;
async function toAdopt(routes = {}) {
  await open({ mode: 'session', sessionId: IDS.spSid }, { get: A.getShopPay, ...routes });
  click($('[data-sr-adopt]'));
  await flush();
}

describe('a3 / b4: a 404 disabled mid-flow is the gated state, never "did not complete" (P-5)', () => {
  it('a step answered disabled: the gated line, no Try again', async () => {
    await open({ mode: 'session', sessionId: IDS.dcSid }, { step: A.disabled });
    click($('[data-sr-next]'));
    await flush();
    expect($('[data-sr-step-failed]').textContent).toBe(GATED);
    expect($('[data-sr-retry-step]')).toBeNull();
    expect(textOf()).not.toContain(COPY.network);
  });
  it('a session read answered disabled: the gated line, no Try again', async () => {
    await open({ mode: 'session', sessionId: IDS.dcSid }, { get: A.disabled });
    expect(textOf()).toContain(GATED);
    expect(textOf()).not.toContain(COPY.loadFailed);
    expect(buttonNamed(COPY.retry)).toBeNull();
  });
  it('a save answered disabled: the gated line', async () => {
    await toAdopt({ adopt: A.disabled });
    click($('[data-sr-horizon="swing"]'));
    click($('[data-sr-save-button]'));
    await flush();
    expect($('[data-sr-save="failed"]').textContent).toBe(GATED);
  });
});

describe('b1: an unconfirmed save stays unconfirmed until the check, through any navigation (K-8)', () => {
  it('Cancel, then Turn this into an idea again: still only "Check the record" — no second adopt', async () => {
    await toAdopt({ get: [A.getShopPay, A.getShopPay, A.getShopPay, A.getShopPaySaved], adopt: [NETWORK, A.adoptSaved] });
    click($('[data-sr-horizon="positional"]'));
    click($('[data-sr-save-button]'));
    await flush();
    expect($('[data-sr-check]')).not.toBeNull();
    click(buttonNamed(COPY.cancel));
    click($('[data-sr-adopt]'));
    await flush();
    expect($('[data-sr-save="uncertain"]').textContent).toBe(COPY.saveUncertain);
    expect($('[data-sr-save-button]')).toBeNull();
    click($('[data-sr-check]'));
    await flush();
    expect($('[data-sr-recovered]').textContent).toBe(COPY.recovered);
    expect(server.sent('adopt')).toHaveLength(1);
  });
  it('the re-entry read fails: still the check, never "no supported company"', async () => {
    await toAdopt({ get: [A.getShopPay, A.getShopPay, NETWORK, A.getShopPaySaved], adopt: [NETWORK, A.adoptSaved] });
    click($('[data-sr-horizon="positional"]'));
    click($('[data-sr-save-button]'));
    await flush();
    click(buttonNamed(COPY.cancel));
    click($('[data-sr-adopt]'));
    await flush();
    expect(textOf()).not.toContain(COPY.adoptBlocked);
    expect($('[data-sr-check]')).not.toBeNull();
  });
});

describe('a4 / b2: preview_stale reads the record, so the carried evidence is complete', () => {
  it('the new finding the stale preview carries is shown', async () => {
    await toAdopt({ get: [A.getShopPay, A.getShopPay, A.getShopPayMoved], adopt: [A.adoptStale] });
    click($('[data-sr-horizon="swing"]'));
    click($('[data-sr-save-button]'));
    await flush();
    expect($('[data-sr-carried-for="SHOP"] [data-sr-finding="f_0f0f0f0f-0000-4000-8000-000000000018"]')).not.toBeNull();
  });
});

describe('a6: an idempotent answer does not present this screen\'s words as the saved idea', () => {
  it('saved before elsewhere: the "already saved" line, not the typed statement', async () => {
    await toAdopt({ adopt: { status: 200, body: { watchlistId: 'wl-saved-elsewhere', version: 1, researchWorkId: 'sr_x', idempotent: true } } });
    typeInto($('#sr-statement'), 'Words this tab typed and never saved, naming Shopify and Apple.');
    click($('[data-sr-horizon="swing"]'));
    click($('[data-sr-save-button]'));
    await flush();
    expect($('[data-sr-saved-already]').textContent).toBe(COPY.savedAlready);
    expect(textOf()).not.toContain('Words this tab typed');
  });
});

describe('a7: one findings count for one investigation', () => {
  it('the Continue row and the work view say the same number', async () => {
    await open({}, { list: A.list, get: A.getShopPay });
    const n = A.list.body.open[0].findingsCount;
    expect($(`[data-sr-continue="${IDS.spSid}"]`).textContent).toContain(`${n} findings`);
    click($(`[data-sr-continue="${IDS.spSid}"]`));
    await flush();
    expect($('[data-sr-state]').textContent).toContain(`${n} findings`);
  });
});

describe('a8 / a9: the preview carries no review line and no unchecked claim', () => {
  it('the preview shows the design\'s line; the review line only once saved', async () => {
    await toAdopt({ adopt: A.adoptSaved });
    const reviewLine = REVIEW_HONEST_LINE.replace('[AGENT]', 'Atlas');
    expect(textOf()).toContain(COPY.previewHonest);
    expect(textOf()).not.toContain(reviewLine);
    expect(textOf()).not.toMatch(/carries a price/);
    click($('[data-sr-horizon="swing"]'));
    click($('[data-sr-save-button]'));
    await flush();
    expect($('[data-sr-honest]').textContent).toContain(reviewLine);
  });
});

describe('a10 / b11: a refused check says why, in the server\'s words, and Check waits out a 429', () => {
  it('the check answered 429: its line; Check held until Retry-After', async () => {
    await toAdopt({ get: [A.getShopPay, A.getShopPay, A.rateLimited], adopt: [NETWORK] });
    click($('[data-sr-horizon="positional"]'));
    click($('[data-sr-save-button]'));
    await flush();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    click($('[data-sr-check]'));
    await flush();
    expect($('[data-sr-save="uncertain"]').textContent).toBe(A.rateLimited.body.message);
    expect($('[data-sr-check]').disabled).toBe(true);
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect($('[data-sr-check]').disabled).toBe(false);
  });
});

describe('a12: a framing still running is not a failure', () => {
  it('a repeated frame answered "still framing": the neutral line, no frame_failed', async () => {
    await open({}, { frame: [NETWORK, { status: 200, body: { sessionId: IDS.obsSid, status: 'framing', frame: null, quota: A.framed.body.quota } }] });
    typeInto($('#sr-own'), IDS.observation);
    click($('[data-sr-frame]'));
    await flush();
    click($('[data-sr-retry-frame]'));
    await flush();
    expect(textOf()).toContain(COPY.framingStill);
    expect(textOf()).not.toContain(COPY.server.frame_failed);
  });
});

describe('a13: a Continue row with no step yet has no empty "last update"', () => {
  it('lastTurnAt null → "Open · N findings"', async () => {
    const row = { ...A.list.body.open[0], lastTurnAt: null };
    await open({}, { list: { status: 200, body: { ...A.list.body, open: [row] } } });
    expect($(`[data-sr-continue="${IDS.spSid}"]`).textContent).toContain(COPY.continueRow(null, row.findingsCount));
    expect($(`[data-sr-continue="${IDS.spSid}"]`).textContent).not.toContain('last update  ·');
  });
});

describe('b3: the next step stays on offer after a failure', () => {
  it('after a 429 on next, the wait over: Next is back', async () => {
    await open({ mode: 'session', sessionId: IDS.dcSid }, { step: [A.rateLimited, A.stepNext] });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    click($('[data-sr-next]'));
    await flush();
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect($('[data-sr-next]')).not.toBeNull();
    expect($('[data-sr-next]').disabled).toBe(false);
  });
  it('a reopened failed examine (no target to retry): Next is on offer', async () => {
    await open({ mode: 'session', sessionId: IDS.dcSid }, { get: A.getStepFailedExamine });
    expect($('[data-sr-step-failed]').textContent).toBe(COPY.server.step_failed);
    expect($('[data-sr-retry-step]')).toBeNull();
    expect($('[data-sr-next]')).not.toBeNull();
  });
});

describe('b5: a Continue row that does not open says so on the Start view', () => {
  it('no answer: the load line', async () => {
    await open({}, { list: A.list, get: NETWORK });
    click($(`[data-sr-continue="${IDS.spSid}"]`));
    await flush();
    expect($('[data-sr-read-failed]').textContent).toBe(COPY.loadFailed);
  });
  it('a refusal: the server\'s own line', async () => {
    const notFound = { status: 404, body: { error: 'session_not_found', message: 'That investigation could not be found.' } };
    await open({}, { list: A.list, get: notFound });
    click($(`[data-sr-continue="${IDS.spSid}"]`));
    await flush();
    expect($('[data-sr-read-failed]').textContent).toBe('That investigation could not be found.');
  });
});

describe('b6: "Open the earlier one" marks the screen only once the earlier one has loaded', () => {
  it('the read fails: the current investigation stays current, and the failure is said', async () => {
    await open({ mode: 'item', item: storyOf() }, { open: A.openStoryPrevious, get: NETWORK });
    click($('[data-sr-investigate]'));
    await flush();
    click(buttonNamed(COPY.openEarlier));
    await flush();
    expect(textOf()).not.toContain(COPY.earlierNote);
    expect($('[data-sr-read-failed]').textContent).toBe(COPY.loadFailed);
    expect($('[data-sr-state]').dataset.srState).toBe('open');
  });
  it('Back fails: still marked earlier, the back link kept, the failure said', async () => {
    await open({ mode: 'item', item: storyOf() }, { open: A.openStoryPrevious, get: [A.getConcluded, NETWORK] });
    click($('[data-sr-investigate]'));
    await flush();
    click(buttonNamed(COPY.openEarlier));
    await flush();
    click(buttonNamed(COPY.backToCurrent));
    await flush();
    expect(textOf()).toContain(COPY.earlierNote);
    expect(buttonNamed(COPY.backToCurrent)).not.toBeNull();
    expect($('[data-sr-read-failed]')).not.toBeNull();
  });
});

describe('b7: the adoption view says WHY there is no preview', () => {
  it('its read failed: the load line and Try again — not "no supported company"', async () => {
    // a step answer carries no preview, so the adoption view must read one — and that read fails
    await open({ mode: 'session', sessionId: IDS.dcSid }, { get: [A.getStepped, NETWORK, A.getStepped], step: A.stepNext });
    click($('[data-sr-next]'));
    await flush();
    click($('[data-sr-adopt]'));
    await flush();
    expect(textOf()).not.toContain(COPY.adoptBlocked);
    expect($('[data-sr-read-failed]').textContent).toBe(COPY.loadFailed);
    click(buttonNamed(COPY.retry));
    await flush();
    expect($('#sr-statement')).not.toBeNull();
  });
  it('closed elsewhere: the closed line', async () => {
    await open({ mode: 'session', sessionId: IDS.dcSid }, { get: [A.getStepped, A.getConcluded] });
    click($('[data-sr-adopt]'));
    await flush();
    expect($('[data-sr-adopt-closed]').textContent).toBe(COPY.investigationClosed);
  });
});

describe('b8: under the app\'s root StrictMode the sheet still hears its answers (dev effect replay)', () => {
  it('mode session loads and shows the work', async () => {
    server.set('get', A.getStepped);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => { root.render(<StrictMode><ThemeProvider><Body mode="session" sessionId={IDS.dcSid} stories={[]} onClose={() => {}} /></ThemeProvider></StrictMode>); });
    await flush();
    try {
      expect($('[data-screen-label="Work · open"]')).not.toBeNull();
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });
});

describe('b9: the budget spent, the card\'s "Turn this into an idea" still works', () => {
  it('both doors enabled; Examine gone', async () => {
    await open({ mode: 'session', sessionId: IDS.dcSid }, { get: A.getSpent });
    expect($('[data-sr-adopt]').disabled).toBe(false);
    expect($('[data-sr-adopt-from="ETN"]').disabled).toBe(false);
    expect($('[data-sr-examine]')).toBeNull();
  });
});

describe('b10: a direction step that lands empties the box, on Send or on its Try again', () => {
  it('Try again lands: the words are gone, so Send cannot send them twice', async () => {
    await open({ mode: 'session', sessionId: IDS.dcSid }, { step: [NETWORK, A.stepNext] });
    typeInto($('#sr-direction'), 'Look at suppliers');
    click($('[data-sr-send]'));
    await flush();
    expect($('#sr-direction').value).toBe('Look at suppliers');
    click($('[data-sr-retry-step]'));
    await flush();
    expect($('#sr-direction').value).toBe('');
    expect(server.sent('step').map((c) => c.body.direction)).toEqual(['Look at suppliers', 'Look at suppliers']);
  });
});

describe('a5 / a16: a lead with a symbol wears no status of its own', () => {
  it('an identified lead whose best finding is Source-backed: "Lead" beside its name; the finding keeps its label below', async () => {
    const body = JSON.parse(JSON.stringify(A.getStepped.body));
    const f = body.record.findings.find((x) => x.kind === 'product' && x.status === 'verified');
    f.symbol = 'VRT';
    body.companies.leads = [{ name: 'Vertiv Holdings Co', symbol: 'VRT', findingIds: [f.findingId], status: 'verified', statusReason: null }];
    await open({ mode: 'session', sessionId: IDS.dcSid }, { get: { status: 200, body } });
    const lead = $('[data-sr-lead="Vertiv Holdings Co"]');
    expect(lead.firstElementChild.textContent).toBe(`Vertiv Holdings Co${COPY.lead}VRT`);
    expect(lead.firstElementChild.textContent).not.toContain('Source-backed');
    expect(lead.querySelector('[data-sr-finding]').textContent).toContain('Source-backed');
  });
});
