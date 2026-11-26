// @vitest-environment jsdom
//
// Practice Field build B3 — THE SCREEN, in jsdom (B3 "Tests: the screen"). Every view drawn here is the SERVER's: built by
// api/_utils/practiceField/bookView.js from the stored-shape scenes (bookViewScenes.js), never hand-written JSON. Each state
// renders its fixed copy; a tap opens and closes a row with only one open; the tabs switch; a strip line opens Desks at its
// desk; a finished idea opens its five-column result; agent words are text, never markup; and nothing on the page trades.

import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import IdeaBookScreen from './IdeaBookScreen';
import { IDEA_BOOK_COPY, layoutOfWidth, DESK_FROM_PX, PHONE_MAX_PX } from './ideaBookCopy';
import { buildBookView } from '../../../api/_utils/practiceField/bookView.js';
// B5: the scenes as the B5 reader gives them — the epoch, the archetype and the caller's agent, Atlas (B5-3's names).
import { hubSceneInput as sceneInput } from '../../../api/_utils/practiceField/__testsupport__/bookViewScenesHub.js';
import { FAILED_CHECK, BUYS_NEXT_WINDOW, PAPER_MONEY, PAUSED_LINE, BOOK_WAITING, BOOK_WAITING_REASON, ROW_REASON_HELD } from '../../../api/_utils/practiceField/bookViewCopy.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let mounted = [];
afterEach(() => { for (const m of mounted) act(() => m.root.unmount()); mounted = []; document.body.innerHTML = ''; });

/** The server-built view of a scene (cached when unpatched: building History seals packets, which takes a moment). */
const VIEWS = new Map();
const viewOf = (scene, patch = null) => {
  if (!patch && VIEWS.has(scene)) return JSON.parse(VIEWS.get(scene));
  const input = sceneInput(scene);
  if (patch) patch(input);
  const json = JSON.stringify(buildBookView(input));
  if (!patch) VIEWS.set(scene, json);
  return JSON.parse(json);
};
function mount(el) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(el));
  const m = { host, root };
  mounted.push(m);
  return m;
}
const screen = (scene, { width = 390, initial, patch } = {}) => mount(<IdeaBookScreen read={{ status: 'ready', book: viewOf(scene, patch) }} onClose={() => {}} width={width} initial={initial} />);
const text = (m) => m.host.textContent;
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const nameRow = (m, sym) => m.host.querySelector(`[data-ib-name="${sym}"]`);
const header = (m, slot) => m.host.querySelector(`[data-ib-group="${slot}"] > button`);
const expanded = (m) => [...m.host.querySelectorAll('[aria-expanded="true"]')];

describe('the states draw their fixed copy (the design of record\'s ten, and the undrawn ones)', () => {
  it('the sample day: the book line, the strip, the table\'s columns, the open slot, cash and the timestamp', () => {
    const v = viewOf('sample');
    const m = screen('sample');
    for (const s of [v.line.value, v.line.cash, PAPER_MONEY, 'Positions', 'Desks', 'History', 'Symbol', 'Mark', 'P/L Open', 'P/L Day', 'Long · open · Atlas’s desk looks tonight.', 'Marks as of the close, 27 Nov.', 'Trend Follower’s desk', 'held 2', 'held 3 · passed on 3 drafts']) {
      expect(text(m), s).toContain(s);
    }
    expect(m.host.querySelector('[data-ib="cash"]').textContent).toContain(v.cash);
  });
  it('1 · a full book: three groups, eight names', () => {
    const m = screen('full');
    expect(m.host.querySelectorAll('[data-ib-group]')).toHaveLength(3);
    expect(m.host.querySelectorAll('[data-ib-name]')).toHaveLength(8);
  });
  it('2 · a new book: the buy sentence in place of each mark, Opens, no timestamp', () => {
    const m = screen('newBook');
    expect(m.host.querySelectorAll('[data-ib-name-state="entering"]')).toHaveLength(3);
    expect(text(m)).toContain(BUYS_NEXT_WINDOW);
    expect(text(m)).toContain('Opens');
    expect(m.host.querySelector('[data-ib="stamp"]')).toBeNull();
  });
  it('3 · new today: the NEW tag on each name bought this session, and the strip names them', () => {
    const m = screen('newToday');
    expect(m.host.querySelectorAll('[data-ib="new"]')).toHaveLength(2);
    expect(text(m)).toContain('opened XOM, CVX');
  });
  it('4 · near a line: the distance under the symbol, in weight', () => {
    const m = screen('nearLine');
    expect(nameRow(m, 'XOM').textContent).toContain('0.7% away');
  });
  it('5 · a line hit: "Sold at its line by code", dated, in its group', () => {
    const m = screen('lineHit');
    expect(nameRow(m, 'XOM').textContent).toContain('Sold at its line by code · 27 Nov');
    expect(m.host.querySelector('[data-ib-group="short"]').contains(nameRow(m, 'XOM'))).toBe(true);
  });
  it('6 · an exit called: the header row reads Exit · sells at the next session\'s first window', () => {
    const m = screen('exitCalled');
    expect(header(m, 'short').textContent).toContain('Exit · sells at the next session’s first window');
  });
  it('7 · waiting on data: the row says so in place of its P/L, quietly', () => {
    const m = screen('waiting');
    const bac = nameRow(m, 'BAC');
    expect(bac.textContent).toContain('Waiting on data');
    expect(bac.textContent).not.toContain('$');
  });
  it('8 · a failed check: the strip reads the failed-check sentence', () => {
    const m = screen('failed');
    expect(m.host.querySelector('[data-ib="strip"]').textContent).toContain(`Trend Follower’s desk · ${FAILED_CHECK.strip}`);
  });
  it('9 · paused: the book line says Paused and code still sells; the strip is gone', () => {
    const m = screen('paused');
    expect(text(m)).toContain('Paused');
    expect(text(m)).toContain(PAUSED_LINE);
    expect(m.host.querySelector('[data-ib="strip"]')).toBeNull();
  });
  it('winding down, the agent off, bought today and an unobserved close each draw their own words', () => {
    expect(text(screen('windingDown'))).toContain('Winding down');
    expect(text(screen('agentOff'))).toContain('Long · open');
    expect(text(screen('boughtToday'))).toContain('Bought today · first mark at tonight’s close');
    expect(text(screen('unobserved'))).toContain('No close was recorded for 27 Nov; marks are carried from the last one.');
  });
  it('the fit test at 320: four names, the no-cents form of a five-figure amount, all four columns', () => {
    const v = viewOf('fit');
    const m = screen('fit', { width: 320 });
    expect(m.host.querySelector('[data-ib-layout]').getAttribute('data-ib-layout')).toBe('p320');
    const googl = v.groups.find((g) => g.slot === 'long').names.find((n) => n.symbol === 'GOOGL');
    expect(googl.plOpen.short).not.toBe(googl.plOpen.text);
    expect(nameRow(m, 'GOOGL').textContent).toContain(googl.plOpen.short);
    expect(nameRow(m, 'GOOGL').textContent).not.toContain(googl.plOpen.text);
    // at 390 the same amount keeps its cents
    expect(nameRow(screen('fit', { width: 390 }), 'GOOGL').textContent).toContain(googl.plOpen.text);
  });
});

describe('10 · tap to expand: one row open at a time, in place on the phone, announced', () => {
  it('a name opens its line track, shares, position value, the thesis, the chip and the call; tapping it again closes it', () => {
    const m = screen('sample');
    const jpm = nameRow(m, 'JPM');
    expect(jpm.getAttribute('aria-expanded')).toBe('false');
    click(jpm);
    expect(jpm.getAttribute('aria-expanded')).toBe('true');
    const panel = m.host.querySelector('[role="region"][aria-label="JPM detail"]');
    for (const s of ['Entry', 'Now', 'Line', '11.1% away', 'Shares', 'Position value', 'Entered by the founder', 'Today’s call', 'Hold']) expect(panel.textContent, s).toContain(s);
    click(jpm);
    expect(m.host.querySelector('[role="region"]')).toBeNull();
  });
  it('an idea header opens the whole idea: every name, both gaps, sessions left and the call', () => {
    const m = screen('sample');
    click(header(m, 'medium'));
    const panel = m.host.querySelector('[role="region"][aria-label="Medium idea detail"]');
    for (const s of ['JPM', 'BAC', 'GS', 'Gap', 'vs XLF', 'vs SPY', '26 sessions left']) expect(panel.textContent, s).toContain(s);
  });
  it('opening another row closes the first: only one open', () => {
    const m = screen('sample');
    click(nameRow(m, 'JPM'));
    click(nameRow(m, 'XOM'));
    expect(expanded(m).map((b) => b.getAttribute('data-ib-name'))).toEqual(['XOM']);
    click(header(m, 'short'));
    expect(expanded(m)).toHaveLength(1);
    expect(m.host.querySelectorAll('[role="region"]')).toHaveLength(1);
  });
  it('on the desktop the open row shows in the side panel, not in place', () => {
    const m = screen('full', { width: 1236 });
    click(header(m, 'medium'));
    const panel = m.host.querySelector('[role="region"][aria-label="Medium idea detail"]');
    expect(panel.closest('aside')).not.toBeNull();
    expect(text(m)).toContain('To its line');
  });
});

describe('the tabs, the strip and History', () => {
  it('the tabs switch, and only Positions draws the table', () => {
    const m = screen('sample');
    const tab = (k) => m.host.querySelector(`#ib-tab-${k}`);
    click(tab('desks'));
    expect(tab('desks').getAttribute('aria-selected')).toBe('true');
    expect(m.host.querySelector('[data-ib="positions"]')).toBeNull();
    expect(text(m)).toContain('Ideas the desk passed on');
    click(tab('history'));
    expect(text(m)).toContain('No finished ideas yet.');
    click(tab('pos'));
    expect(m.host.querySelector('[data-ib="positions"]')).not.toBeNull();
  });
  it('a strip line opens Desks with that desk first', () => {
    const m = screen('sample');
    const shadowLine = [...m.host.querySelectorAll('[data-ib="strip"] button')].find((b) => b.textContent.includes('Atlas’s desk'));
    click(shadowLine);
    expect(m.host.querySelector('#ib-tab-desks').getAttribute('aria-selected')).toBe('true');
    expect(m.host.querySelector('[data-ib-desk]').getAttribute('data-ib-desk')).toBe('shadow');
  });
  it('Desks: the note quoted and dated, the calls, the drafts with their outcome and reason', () => {
    const m = screen('desksAdmit', { initial: { tab: 'desks', desk: 'archetype' } });
    for (const s of ['Trend Follower’s desk', 'Trend Follower · Short', 'written after the close, 24 Nov', '3 drafts · 1 admitted · 1 not chosen · 1 refused', 'Not chosen', 'Refused: the name is not on the price list']) {
      expect(text(m), s).toContain(s);
    }
  });
  it('History: a finished idea opens its five-column result; Close and Escape close it', () => {
    const m = screen('history', { initial: { tab: 'history' } });
    expect(text(m)).toContain('Not measurable');
    const row = [...m.host.querySelectorAll('button[aria-haspopup="dialog"]')].find((b) => b.textContent.includes('KO · PEP · PG'));
    click(row);
    const dialog = m.host.querySelector('[role="dialog"]');
    const cols = dialog.querySelector('[data-ib="result-columns"]');
    for (const s of ['Lines', 'Held', 'Result', 'Ahead', 'Process', 'Followed the plan', 'Evidence', 'One run', 'Adoption', 'No offer']) expect(cols.textContent, s).toContain(s);
    click(dialog.querySelector('button[aria-label="Close"]'));
    expect(m.host.querySelector('[role="dialog"]')).toBeNull();
    click(row);
    act(() => { m.host.querySelector('[role="dialog"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(m.host.querySelector('[role="dialog"]')).toBeNull();
  });
});

describe('the review\'s fixes on the screen, each pinned', () => {
  it('C1: the desktop table starts at 1120 px; below it the phone table, centred and no wider than 640', () => {
    expect(layoutOfWidth(1119)).toBe('p390');
    expect(layoutOfWidth(DESK_FROM_PX)).toBe('desk');
    const m = screen('full', { width: 1000 });
    const root = m.host.querySelector('.ib-root');
    expect(root.getAttribute('data-ib-layout')).toBe('p390');
    expect(root.style.maxWidth).toBe(`${PHONE_MAX_PX}px`);
  });
  it('C3: while the result sheet is open the page behind it is inert', () => {
    const m = screen('history', { initial: { tab: 'history' } });
    expect(m.host.querySelector('[data-ib="page"]').hasAttribute('inert')).toBe(false);
    click([...m.host.querySelectorAll('button[aria-haspopup="dialog"]')][1]);
    expect(m.host.querySelector('[data-ib="page"]').hasAttribute('inert')).toBe(true);
    expect(m.host.querySelector('[role="dialog"]').getAttribute('tabindex')).toBe('-1');
  });
  it('C16: an open sheet stays on its idea when the list above it changes', () => {
    const v = viewOf('history');
    const read = { status: 'ready', book: v };
    const m = mount(<IdeaBookScreen read={read} onClose={() => {}} width={390} initial={{ tab: 'history' }} />);
    click([...m.host.querySelectorAll('button[aria-haspopup="dialog"]')].find((b) => b.textContent.includes('KO · PEP · PG')));
    const moved = { ...v, history: { ...v.history, items: [{ ...v.history.items[2], namesText: 'NEW · IDEA', endedOn: '18 Dec' }, ...v.history.items] } };
    act(() => m.root.render(<IdeaBookScreen read={{ status: 'ready', book: moved }} onClose={() => {}} width={390} initial={{ tab: 'history' }} />));
    expect(m.host.querySelector('[role="dialog"] h2').textContent).toBe('KO · PEP · PG');
  });
  it('C13: the arrow keys move between the tabs, and only the selected tab is in the Tab order', () => {
    const m = screen('sample');
    const list = m.host.querySelector('[role="tablist"]');
    expect([...list.querySelectorAll('[role="tab"]')].map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
    act(() => { list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); });
    expect(m.host.querySelector('#ib-tab-desks').getAttribute('aria-selected')).toBe('true');
    act(() => { list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); });
    expect(m.host.querySelector('#ib-tab-pos').getAttribute('aria-selected')).toBe('true');
  });
  it('C4: a settled-today group says "Last call", never "Today\'s call"', () => {
    const m = screen('settledToday', { initial: { open: 'long' } });
    const panel = m.host.querySelector('[role="region"][aria-label="Long idea detail"]');
    expect(panel.textContent).toContain('Last call');
    expect(panel.textContent).not.toContain('Today’s call');
  });
  it('B5: an Exit code did not carry out is said under the call', () => {
    const m = screen('sample', { initial: { open: 'short' }, patch: (input) => { input.closeRow.agent.desks.archetype.actions = [{ ideaId: 'i_energy', action: 'exit', reason: 'Energy stopped leading.', outcome: 'refused:x' }]; } });
    expect(m.host.querySelector('[data-ib="not-carried-out"]').textContent).toBe('Code did not carry it out; the idea is unchanged.');
  });
  it('C12: near a line lifts the row with weight, never red; a sold name is dimmed; a waiting idea says so in its header', () => {
    const near = nameRow(screen('nearLine'), 'XOM');
    expect(near.style.background).toContain('--ft-bg-agent');
    for (const el of near.querySelectorAll('span')) if (el.textContent === '0.7% away') expect(el.style.color).toBe('var(--ft-ink)');
    const sold = nameRow(screen('lineHit'), 'XOM').querySelector('span span span');
    expect(sold.style.color).toBe('var(--ft-ink-3)');
    expect(header(screen('waiting'), 'medium').textContent).toContain('Waiting on data');
  });
});

describe("the fix round for Astra's review (docs/audits/20261124_ASTRA_REVIEW_B3.md), on the screen", () => {
  it('B3-11 (B3-A02): the last close below full quality — the headline reads "Waiting on data" with its reason; no figure for today, since open or SPY; cash shows', () => {
    const v = viewOf('waiting');
    const m = screen('waiting');
    const line = m.host.querySelector('[data-ib="book-line"]');
    const value = line.querySelector('[data-ib="value"]');
    expect(value.textContent).toBe(`${BOOK_WAITING}${BOOK_WAITING_REASON}`);
    expect(value.textContent).not.toMatch(/\$/);
    expect(line.querySelector('[data-ib="today"]')).toBeNull();
    expect(line.textContent).toContain('Since 20 Nov—');
    expect(line.textContent).toContain('SPY—');
    expect(line.textContent).toContain(`Cash${v.line.cash}`);
    // The only dollar figure on the line is cash.
    expect((line.textContent.match(/\$[0-9]/g) || []).length).toBe(1);
  });
  it('B3-A01: an idea held by its ledger — every name reads "Waiting on data", with a dash for its mark and no P/L', () => {
    const m = screen('ledgerHold');
    for (const sym of ['JPM', 'BAC', 'GS']) {
      const row = nameRow(m, sym);
      expect(row.textContent, sym).toContain('Waiting on data');
      expect(row.textContent, sym).not.toMatch(/\$/);
    }
    // The other idea is not held: its names keep their figures.
    expect(nameRow(m, 'XOM').textContent).toMatch(/\$/);
    click(nameRow(m, 'BAC'));
    expect(m.host.querySelector('[role="region"][aria-label="BAC detail"]').textContent).toContain(ROW_REASON_HELD);
  });
  it('B3-12 (B3-A06): the thesis of the founder is signed "The founder" in Positions, its idea managed by the Shadow desk', () => {
    const m = screen('sample');
    expect(header(m, 'medium').getAttribute('aria-label')).toContain('Atlas’s desk');
    click(nameRow(m, 'JPM'));
    const caps = [...m.host.querySelectorAll('[role="region"][aria-label="JPM detail"] figcaption')].map((c) => c.textContent);
    expect(caps).toContain('The founder · 19 Nov');
    expect(caps.some((c) => c.startsWith('Atlas’s desk · after the close'))).toBe(true); // the desk's own call keeps its desk
  });
  it('B3-12 (B3-A06): History — a founder-authored finished idea is signed "The founder"; an unknown author shows no byline, never "null"', () => {
    const founder = (input) => { input.finished[1].idea.contract.thesis.author = 'founder_fixture'; };
    const m = mount(<IdeaBookScreen read={{ status: 'ready', book: viewOf('history', founder) }} onClose={() => {}} width={390} initial={{ tab: 'history', sheet: 1 }} />);
    const caps = [...m.host.querySelectorAll('[role="dialog"] figcaption')].map((c) => c.textContent);
    expect(caps[0]).toMatch(/^The founder · /);
    expect(m.host.querySelector('[role="dialog"]').textContent).toContain('KO · PEP · PG');
    const unknown = (input) => { input.finished[1].idea.contract.thesis.author = 'player'; };
    const n = mount(<IdeaBookScreen read={{ status: 'ready', book: viewOf('history', unknown) }} onClose={() => {}} width={390} initial={{ tab: 'history', sheet: 1 }} />);
    const cap = n.host.querySelector('[role="dialog"] figcaption').textContent;
    expect(cap).not.toMatch(/null|undefined|desk/i);
    expect(cap).toMatch(/^\d{1,2} [A-Z][a-z]{2}$/);
  });
  it('B3-A08: the entry close reads "Entered today · N sessions" in place of "Day 0 of N"', () => {
    const m = screen('newToday');
    expect(text(m)).toContain('Entered today · 10 sessions');
    expect(text(m)).not.toContain('Day 0 of');
  });
});

describe('what the screen never does', () => {
  it('no control that trades: every button on every tab and in the result sheet opens, closes or switches', () => {
    const check = (m, where) => {
      for (const b of m.host.querySelectorAll('button')) expect(b.textContent + (b.getAttribute('aria-label') || ''), where).not.toMatch(/\b(buy|sell|trade|approve|trim|add)\b/i);
    };
    for (const scene of ['full', 'exitCalled', 'history', 'desksAdmit']) {
      for (const tab of ['pos', 'desks', 'history']) check(screen(scene, { initial: { tab } }), `${scene}/${tab}`);
    }
    check(screen('history', { initial: { tab: 'history', sheet: 1 } }), 'sheet');
    check(screen('full', { width: 1236, initial: { open: 'medium/JPM' } }), 'desktop panel');
  }, 15_000);
  it('agent words are text, never markup', () => {
    const m = screen('sample', { initial: { tab: 'desks' }, patch: (input) => { input.closeRow.agent.desks.shadow.note = '<img src=x onerror="window.__ib_pwned=1"><b>bold</b>'; } });
    expect(m.host.querySelector('img')).toBeNull();
    expect(m.host.querySelector('b')).toBeNull();
    expect(text(m)).toContain('<img src=x');
    expect(window.__ib_pwned).toBeUndefined();
  });
  it('B5-3: the agent\'s given name with markup in it is drawn as text — in the strip, the headers\' labels and the Desks tab', () => {
    const agentName = '<b>A</b><img src=x>';
    const pos = screen('sample', { patch: (input) => { input.agentName = agentName; } });
    expect(pos.host.querySelector('b, img')).toBeNull();
    expect(text(pos)).toContain('<b>A</b><img src=x>’s desk');
    expect(header(pos, 'medium').getAttribute('aria-label')).toContain('<b>A</b><img src=x>’s desk');
    const desks = screen('sample', { initial: { tab: 'desks', desk: 'shadow' }, patch: (input) => { input.agentName = agentName; } });
    expect(desks.host.querySelector('b, img')).toBeNull();
    expect(text(desks)).toContain('Open. <b>A</b><img src=x>’s desk looks for an idea at tonight’s close.');
  });
  it('up and down are never colour alone: every signed figure carries its sign', () => {
    const v = viewOf('full');
    for (const g of v.groups) for (const n of g.names) for (const a of [n.plOpen, n.plDay].filter(Boolean)) if (a.dir !== 0) expect(a.text).toMatch(/^[+−]/);
  });
});

describe('loading, empty and error: quiet, in the page\'s own voice', () => {
  it('loading', () => {
    const m = mount(<IdeaBookScreen read={{ status: 'loading', book: null }} onClose={() => {}} width={390} />);
    expect(text(m)).toContain(IDEA_BOOK_COPY.loading);
  });
  it('no book: "No idea book yet."', () => {
    const m = mount(<IdeaBookScreen read={{ status: 'ready', book: null }} onClose={() => {}} width={390} />);
    expect(text(m)).toContain('No idea book yet.');
  });
  it('a failed read: its own words, not the title again (review C14)', () => {
    const m = mount(<IdeaBookScreen read={{ status: 'error', book: null }} onClose={() => {}} width={390} />);
    expect(m.host.querySelector('[role="status"]').textContent).toBe(`${IDEA_BOOK_COPY.error}${IDEA_BOOK_COPY.errorSub}`);
  });
  it('the heading takes focus when the page opens', () => {
    const m = mount(<IdeaBookScreen read={{ status: 'ready', book: viewOf('sample') }} onClose={() => {}} width={390} />);
    expect(document.activeElement).toBe(m.host.querySelector('h1'));
  });
  it('Back closes the page', () => {
    let closed = 0;
    const m = mount(<IdeaBookScreen read={{ status: 'ready', book: viewOf('sample') }} onClose={() => { closed += 1; }} width={390} />);
    click(m.host.querySelector(`button[aria-label="${IDEA_BOOK_COPY.back}"]`));
    expect(closed).toBe(1);
  });
});
