// @vitest-environment jsdom
//
// SignalDropEntry — THE PIN of today's modal (Shared Research B2 build prompt K-4; founder ruling P-1, Nov 13, 2026).
// Written BEFORE the two additive props (`ctaLabel`, `zIndex`) existed, and kept unchanged after: with both props
// absent the modal must render and behave exactly as it did — Discover's flow (DiscoverPanel.jsx, its one importer)
// passes neither. What it pins, with the props absent:
//   - the overlay is a fixed child of <body> at z-index 250;
//   - the steps: "Read this signal" (disabled until there is input) → one POST to /api/forge/parse-signal with the
//     typed text and a fresh dropId → the confirm phase with "Try again" and "Start dialogue";
//   - onStartDialogue's arguments: exactly { parseResult, dropId } — the parse answer as received, the request's id;
//   - the bailout footer: only "Try a different signal";
//   - the card's rendered content, phase by phase, as a SHA-256 of its innerHTML (input, typed, confirming, bailout).
// The third block (added after review d1, its hashes measured on main d9b4e3c1's file and on this branch's alike) pins
// more: the whole overlay's outerHTML — the overlay's and the card's own attributes and style included, only
// framer-motion's animated opacity/transform masked — at desktop, at 390 px and in the submitting phase; the phone
// header's back arrow; Escape, the overlay click and Close each closing; the error copy of a failed parse.
// What it still does not pin: the image and URL request bodies, the scroll lock, the close-reset timer, autofocus.
// No network: fetchWithAuth is mocked. The rows for the new props live in the second describe block.

import React from 'react';
import { act } from 'react';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchWithAuth = vi.hoisted(() => vi.fn());
vi.mock('../../utils/fetchWithAuth', () => ({ fetchWithAuth }));

const { default: SignalDropEntry } = await import('./SignalDropEntry');
const { ThemeProvider } = await import('../../contexts/ThemeContext');
const { mount, click } = await import('../CommandCenter/__fixtures__/hubTestKit');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const PARSE = Object.freeze({
  dropId: 'set-by-test',
  contentHash: 'h1',
  parse: {
    extractedText: 'Utilities are adding gas turbines for data centers.',
    topic: 'Gas turbines for data centers',
    tickers: ['GEV'],
    impliedTickers: [],
    confidence: 'medium',
    contentType: 'news_article',
    signalDirection: 'bullish',
    timeHorizon: 'positional',
    referencedDate: '',
    dataPoints: ['Turbine orders rose this year'],
  },
  validation: { validated: [{ symbol: 'GEV', sectorId: 'industrials' }], unsupported: [] },
  shouldBailout: false,
  shouldHardCheckpoint: false,
  cached: false,
});
const BAILOUT = Object.freeze({ ...PARSE, parse: { ...PARSE.parse, topic: '', tickers: [], dataPoints: [] }, validation: { validated: [], unsupported: [] }, shouldBailout: true });

let mounted = [];
afterEach(() => { for (const m of mounted) m.unmount(); mounted = []; vi.clearAllMocks(); vi.useRealTimers(); });
beforeEach(() => {
  let n = 0;
  vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => `00000000-0000-4000-8000-00000000000${++n}`);
});

const sha = (s) => createHash('sha256').update(s).digest('hex');
const overlayOf = () => document.querySelector('[aria-labelledby="signal-drop-title"]')?.parentElement ?? null;
const cardOf = () => document.querySelector('[aria-labelledby="signal-drop-title"]');
const buttons = () => [...cardOf().querySelectorAll('button')];
const buttonNamed = (text) => buttons().find((b) => b.textContent.trim() === text) ?? null;
const footerTexts = () => {
  const all = buttons();
  // The footer is the card's last child; its buttons are the steps the player can take.
  const footer = cardOf().lastElementChild;
  return all.filter((b) => footer.contains(b)).map((b) => b.textContent.trim());
};
function typeInto(el, value) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
const flush = async () => { await act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); }); };

function open(props = {}) {
  const onClose = vi.fn();
  const onStartDialogue = vi.fn();
  const m = mount(<ThemeProvider><SignalDropEntry open onClose={onClose} onStartDialogue={onStartDialogue} {...props} /></ThemeProvider>);
  mounted.push(m);
  return { m, onClose, onStartDialogue };
}
async function readSignal(answer = PARSE) {
  fetchWithAuth.mockResolvedValueOnce({ ok: true, json: async () => answer });
  typeInto(cardOf().querySelector('textarea'), 'Utilities are adding gas turbines for data centers.');
  click(buttonNamed('Read this signal'));
  await flush();
}

// Recorded at the base (main d9b4e3c1), before either prop existed. A change here is a change to Discover's modal.
const PINNED = Object.freeze({
  input: '234e1b9fb149ce33f1ffb8c09187bd906c19fbabe17d07a015e60344f9d8c005',
  typed: '69f78ee07973a8206c63d2955c28a675aba9eaeaf5ac177f277759fa148c447b',
  confirming: 'cf64279133bde87c6c1796e2e87beba761abb4c8abc1b86f65b71152637442a5',
  bailout: '5a7cf7a2cfdbd7ee144dcd817aa4b880f85fa4dc395cb58c502a6d789abc80a7',
});

describe("SignalDropEntry with no ctaLabel and no zIndex: today's modal, exactly (K-4, P-1)", () => {
  it('the overlay is a fixed child of <body> at z-index 250', () => {
    open();
    const overlay = overlayOf();
    expect(overlay.parentElement).toBe(document.body);
    expect(overlay.style.position).toBe('fixed');
    expect(overlay.style.zIndex).toBe('250');
  });

  it('the input step: "Read this signal", disabled until there is input; the card renders as pinned', () => {
    open();
    expect(footerTexts()).toEqual(['Read this signal']);
    expect(buttonNamed('Read this signal').disabled).toBe(true);
    expect(sha(cardOf().innerHTML)).toBe(PINNED.input);
    typeInto(cardOf().querySelector('textarea'), 'Utilities are adding gas turbines for data centers.');
    expect(buttonNamed('Read this signal').disabled).toBe(false);
    expect(sha(cardOf().innerHTML)).toBe(PINNED.typed);
  });

  it('Read this signal → one POST to parse-signal with the text and a fresh dropId → "Try again" and "Start dialogue"', async () => {
    open();
    await readSignal();
    expect(fetchWithAuth).toHaveBeenCalledTimes(1);
    const [url, init] = fetchWithAuth.mock.calls[0];
    expect(url).toBe('/api/forge/parse-signal');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ type: 'text', text: 'Utilities are adding gas turbines for data centers.', dropId: '00000000-0000-4000-8000-000000000001' });
    expect(footerTexts()).toEqual(['Try again', 'Start dialogue']);
    expect(cardOf().textContent).toContain('Gas turbines for data centers');
    expect(sha(cardOf().innerHTML)).toBe(PINNED.confirming);
  });

  it('Start dialogue calls onStartDialogue once with exactly { parseResult, dropId } — the answer as received, the request\'s id', async () => {
    const { onStartDialogue, onClose } = open();
    await readSignal();
    click(buttonNamed('Start dialogue'));
    expect(onStartDialogue).toHaveBeenCalledTimes(1);
    expect(onStartDialogue.mock.calls[0]).toHaveLength(1);
    const arg = onStartDialogue.mock.calls[0][0];
    expect(Object.keys(arg).sort()).toEqual(['dropId', 'parseResult']);
    expect(arg.parseResult).toEqual(PARSE);
    expect(arg.dropId).toBe(JSON.parse(fetchWithAuth.mock.calls[0][1].body).dropId);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('a bailout parse: only "Try a different signal" — no way to the dialogue', async () => {
    const { onStartDialogue } = open();
    await readSignal(BAILOUT);
    expect(footerTexts()).toEqual(['Try a different signal']);
    expect(buttonNamed('Start dialogue')).toBeNull();
    expect(sha(cardOf().innerHTML)).toBe(PINNED.bailout);
    expect(onStartDialogue).not.toHaveBeenCalled();
  });
});

describe('the two additive props (Shared Research B2: K-4, P-1)', () => {
  it('ctaLabel="Investigate this" replaces only the confirm CTA\'s text; the steps and onStartDialogue\'s argument are the same', async () => {
    const { onStartDialogue } = open({ ctaLabel: 'Investigate this' });
    expect(footerTexts()).toEqual(['Read this signal']);
    await readSignal();
    expect(footerTexts()).toEqual(['Try again', 'Investigate this']);
    expect(buttonNamed('Start dialogue')).toBeNull();
    // Only the label differs from the pinned confirm render.
    expect(sha(cardOf().innerHTML.replace('Investigate this', 'Start dialogue'))).toBe(PINNED.confirming);
    click(buttonNamed('Investigate this'));
    expect(onStartDialogue).toHaveBeenCalledTimes(1);
    expect(Object.keys(onStartDialogue.mock.calls[0][0]).sort()).toEqual(['dropId', 'parseResult']);
    expect(onStartDialogue.mock.calls[0][0].parseResult).toEqual(PARSE);
  });

  it('ctaLabel leaves the bailout footer unchanged: still only "Try a different signal" (ruling P-3)', async () => {
    open({ ctaLabel: 'Investigate this' });
    await readSignal(BAILOUT);
    expect(footerTexts()).toEqual(['Try a different signal']);
    expect(sha(cardOf().innerHTML)).toBe(PINNED.bailout);
  });

  it('zIndex sets the overlay\'s layer and nothing else', () => {
    open({ zIndex: 1001 });
    expect(overlayOf().style.zIndex).toBe('1001');
    expect(sha(cardOf().innerHTML)).toBe(PINNED.input);
  });
});

// The whole overlay, its own attributes and style included — only framer-motion's animated values masked.
const maskedOverlay = () => {
  const c = overlayOf().cloneNode(true);
  for (const el of [c, c.firstElementChild]) { el.style.removeProperty('opacity'); el.style.removeProperty('transform'); }
  return c.outerHTML;
};
// Measured on main d9b4e3c1's SignalDropEntry.jsx and on this branch's, identical (review d1; the build report).
const PINNED_OVERLAY = Object.freeze({
  desktop: '94c3dafba31b0901031b589d26b96fc669efb5d77ad2c361dd5de95a3091955e',
  submitting: '1c9979ce8e232e76e4a5c6e5b631542ad5a6386f129de1592bbcb19817e0fb76',
  phone: '42c5efdcc27e32b4ba3c0d342da2d1a55b5c13b9385f68e9dca6abbf0d599cbc',
});

describe("SignalDropEntry with no ctaLabel and no zIndex: the whole overlay and the dismissals (review d1)", () => {
  let width;
  beforeEach(() => { width = window.innerWidth; });
  afterEach(() => { window.innerWidth = width; });
  const readButton = () => buttonNamed('Read this signal');

  it('desktop input: the overlay, attributes and style included', () => {
    open();
    expect(sha(maskedOverlay())).toBe(PINNED_OVERLAY.desktop);
  });
  it('submitting (the parse held in flight): "Reading…", as drawn', async () => {
    fetchWithAuth.mockReturnValueOnce(new Promise(() => {}));
    open();
    typeInto(cardOf().querySelector('textarea'), 'Utilities are adding gas turbines for data centers.');
    click(readButton());
    await flush();
    expect(cardOf().textContent).toContain('Reading…');
    expect(sha(maskedOverlay())).toBe(PINNED_OVERLAY.submitting);
  });
  it('phone (390 px) input: the full-screen overlay, as drawn', () => {
    window.innerWidth = 390;
    open();
    expect(sha(maskedOverlay())).toBe(PINNED_OVERLAY.phone);
  });
  it('phone confirm: the header\'s back arrow returns to the input; it does not close', async () => {
    window.innerWidth = 390;
    const { onClose } = open();
    await readSignal();
    click(cardOf().querySelector('button[aria-label="Back"]'));
    await flush();
    expect(onClose).not.toHaveBeenCalled();
    expect(readButton()).not.toBeNull();
  });
  it('Escape closes; Close closes; a click on the desktop overlay closes — and a click inside the card does not', () => {
    const a = open();
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(a.onClose).toHaveBeenCalledTimes(1);
    click(cardOf().querySelector('button[aria-label="Close"]'));
    expect(a.onClose).toHaveBeenCalledTimes(2);
    click(cardOf());
    expect(a.onClose).toHaveBeenCalledTimes(2);
    click(overlayOf());
    expect(a.onClose).toHaveBeenCalledTimes(3);
  });
  it('a failed parse shows the server\'s message, then "Network error. Try again." when nothing answered', async () => {
    open();
    fetchWithAuth.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ message: 'That text is too long.' }) });
    typeInto(cardOf().querySelector('textarea'), 'Utilities are adding gas turbines for data centers.');
    click(readButton());
    await flush();
    expect(cardOf().textContent).toContain('That text is too long.');
    fetchWithAuth.mockRejectedValueOnce(new Error(''));
    click(readButton());
    await flush();
    expect(cardOf().textContent).toContain('Network error. Try again.');
  });
});
