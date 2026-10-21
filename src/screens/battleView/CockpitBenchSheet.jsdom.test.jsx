// @vitest-environment jsdom
//
// src/screens/battleView/CockpitBenchSheet.jsdom.test.jsx
//
// Cockpit Build 2b — THE BENCH SHEET, MOUNTED (spec
// docs/COCKPIT_BUILD2B_SPEC_V1_0.md §5.7, §11 "the bench sheet: sort, statuses,
// the note only from the selector, pick, the filed bar, the research modal
// over the sheet"). Driven by the REAL row model (benchSheetOf). 2a's modal
// contract: a dialog, focus in on open and back on close, Escape closes.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import CockpitBenchSheet from './CockpitBenchSheet';
import { benchSheetOf } from './cockpit2bModel';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const ROWS = [
  { symbol: 'XOM', name: 'Exxon', sector: 'Energy', rank: 3, price: 112.4, changePct: 1.24, atrPct: 1.83, status: 'available', lockedUntil: null },
  { symbol: 'PSX', name: null, sector: 'Energy', rank: 1, price: 140, changePct: -0.5, atrPct: 2.1, status: 'locked', lockedUntil: '2026-10-21T20:00:00.000Z' },
  { symbol: 'CVX', name: 'Chevron', sector: 'Energy', rank: 2, price: 150, changePct: 2.6, atrPct: 1.4, status: 'not_swappable', lockedUntil: null },
  { symbol: 'MPC', name: null, sector: null, rank: null, price: null, changePct: null, atrPct: null, status: 'no_price', lockedUntil: null },
];
const DATA = { asOf: '2026-10-21T17:15:20.000Z', out: { symbol: 'VLO', slot: 'core' }, rows: ROWS };
const CALL = { callId: 'b:e:call:0', symbol: 'VLO', slot: 'core', direction: 'exit' };
const BENCH_STATE = { cards: [{ text: 'XOM keeps **holding** its range while crude firms.', symbols: ['XOM'] }] };
const sheetOf = (over = {}) => benchSheetOf({ status: 'ready', data: DATA, call: CALL, step: 'on_card', agent: 'Shadow', agentLists: new Set(['XOM']), benchState: BENCH_STATE, ...over });

let container;
let root;
let opener;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  opener = document.createElement('button');
  document.body.appendChild(opener);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  opener.remove();
});
const render = (props) => act(() => { root.render(<CockpitBenchSheet onClose={() => {}} {...props} />); });
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
const q = (sel) => container.querySelector(sel);
const qa = (sel) => [...container.querySelectorAll(sel)];

describe('the bench sheet', () => {
  it('nothing without a sheet', () => {
    render({ sheet: null });
    expect(container.innerHTML).toBe('');
  });

  it('a modal dialog titled "Who comes in for VLO?", the sub, Rank pressed; every status row, Pick ·● on the available', () => {
    render({ sheet: sheetOf() });
    const dialog = q('[data-cockpit-bench-sheet]');
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')).textContent).toBe('Who comes in for VLO?');
    expect(q('[data-cockpit-bench-sub]').textContent).toBe('4 names · 1 available · prices as of 1:15 PM');
    expect(q('[data-cockpit-bench-sort="rank"]').getAttribute('aria-pressed')).toBe('true');
    expect(qa('[data-cockpit-bench-row]').map((r) => [r.getAttribute('data-cockpit-bench-row'), r.getAttribute('data-cockpit-bench-row-status')])).toEqual([
      ['PSX', 'locked'], ['CVX', 'not_swappable'], ['XOM', 'pick'], ['MPC', 'no_price'],
    ]);
    expect(q('[data-cockpit-bench-row="PSX"] [data-cockpit-bench-status]').textContent).toBe('locked until 4:00 PM');
    const pick = q('[data-cockpit-bench-pick="XOM"]');
    expect(pick.getAttribute('aria-label')).toBe('Pick XOM · 1 command');
    expect(pick.querySelector('[data-cockpit-bullet]')).not.toBeNull();
    expect(q('[data-cockpit-bench-row="XOM"] [data-cockpit-bench-agent-list]').textContent).toBe('On Shadow\'s list');
  });

  it('the note is the selector\'s own sentence, emphasis kept, two lines until tapped; a row with none shows nothing', () => {
    render({ sheet: sheetOf() });
    const note = q('[data-cockpit-bench-row="XOM"] [data-cockpit-bench-note]');
    expect(note.textContent).toBe('XOM keeps holding its range while crude firms.');
    expect(note.querySelector('strong').textContent).toBe('holding');
    expect(note.getAttribute('aria-expanded')).toBe('false');
    click(note);
    expect(q('[data-cockpit-bench-row="XOM"] [data-cockpit-bench-note]').getAttribute('aria-expanded')).toBe('true');
    expect(q('[data-cockpit-bench-row="CVX"] [data-cockpit-bench-note]')).toBeNull();
  });

  it('a sort asks the screen; a Pick files through the screen; a waiting Pick sends nothing', () => {
    const onSort = vi.fn();
    const onPick = vi.fn();
    render({ sheet: sheetOf(), onSort, onPick });
    click(q('[data-cockpit-bench-sort="move"]'));
    expect(onSort).toHaveBeenCalledWith('move');
    click(q('[data-cockpit-bench-pick="XOM"]'));
    expect(onPick).toHaveBeenCalledWith('XOM');
    render({ sheet: sheetOf({ pending: { callId: CALL.callId, answer: 'replace', pickSymbol: 'XOM' } }), onSort, onPick });
    click(q('[data-cockpit-bench-pick="XOM"]'));
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it('tapping the symbol opens the EXISTING research door (the screen\'s handler)', () => {
    const onResearch = vi.fn();
    render({ sheet: sheetOf(), onResearch });
    const door = q('[data-cockpit-bench-research="XOM"]');
    expect(door.getAttribute('aria-label')).toBe('Research XOM');
    click(door);
    expect(onResearch).toHaveBeenCalledWith('XOM');
  });

  it('after filing: the bar "✓ Filed · {canonical text}" with Done (it closes); every Pick waits', () => {
    const onClose = vi.fn();
    render({ sheet: sheetOf({ filedText: 'If you exit VLO by today\'s close, bring in XOM.' }), onClose });
    expect(q('[data-cockpit-bench-filed]').textContent).toContain('✓ Filed · If you exit VLO by today\'s close, bring in XOM.');
    expect(q('[data-cockpit-bench-pick="XOM"]').getAttribute('aria-disabled')).toBe('true');
    click(q('[data-cockpit-bench-done]'));
    expect(onClose).toHaveBeenCalled();
  });

  it('review L7 (C15 at the sheet): a waiting or sending Pick keeps its symbol in its name — at zero commands, after filing, in flight', () => {
    render({ sheet: sheetOf({ meter: { zero: true } }) });
    expect(q('[data-cockpit-bench-pick="XOM"]').getAttribute('aria-label')).toBe('Pick XOM');
    render({ sheet: sheetOf({ filedText: 'If you exit VLO by today\'s close, bring in XOM.' }) });
    expect(q('[data-cockpit-bench-pick="XOM"]').getAttribute('aria-label')).toBe('Pick XOM');
    render({ sheet: sheetOf({ pending: { callId: CALL.callId, answer: 'replace', pickSymbol: 'XOM' } }) });
    expect(q('[data-cockpit-bench-pick="XOM"]').getAttribute('aria-label')).toBe('XOM · Sending…');
    expect(q('[data-cockpit-bench-pick="XOM"]').textContent).toContain('Sending…');
  });

  it('browse: "The bench", "available", no Pick anywhere', () => {
    render({ sheet: sheetOf({ call: null, step: null }) });
    expect(q('h2').textContent).toBe('The bench');
    expect(q('[data-cockpit-bench-pick]')).toBeNull();
    expect(q('[data-cockpit-bench-row="XOM"] [data-cockpit-bench-status]').textContent).toBe('available');
  });

  it('the replace confirmation shows in the sheet when a pick here asked first', () => {
    const onConfirmReplace = vi.fn();
    render({ sheet: sheetOf(), confirmLine: 'This replaces your command on ZS — "Hold ZS.". Shadow stops hearing it at its next check.', onConfirmReplace });
    expect(q('[data-cockpit-replace-confirm]')).not.toBeNull();
    click(q('[data-cockpit-replace]'));
    expect(onConfirmReplace).toHaveBeenCalled();
  });

  it('2a\'s modal contract: focus moves in on open and back to the opener on close; Escape closes', () => {
    const onClose = vi.fn();
    opener.focus();
    render({ sheet: sheetOf(), onClose });
    expect(q('[data-cockpit-bench-sheet]').contains(document.activeElement)).toBe(true);
    act(() => { document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(onClose).toHaveBeenCalled();
    render({ sheet: null, onClose });
    expect(document.activeElement).toBe(opener);
  });

  it('loading and error say so and draw no rows', () => {
    render({ sheet: sheetOf({ status: 'loading', data: null }) });
    expect(q('[data-cockpit-bench-loading]').textContent).toBe('Reading the bench…');
    expect(q('[data-cockpit-bench-row]')).toBeNull();
    render({ sheet: sheetOf({ status: 'error', data: null }) });
    expect(q('[data-cockpit-bench-error]').textContent).toBe('Couldn\'t read the bench right now.');
  });
});

// ---------------------------------------------------------------------------
// The review's fix round (CB4-9/CB5-1, CB4-11/CB6-7, CB5-7, CB5-8).
describe('review fixes — the bench sheet', () => {
  it('CB4-9/CB5-1: under the research modal the sheet is suspended — inert, not modal, Escape closes the MODAL, not the sheet', () => {
    const onClose = vi.fn();
    const onSuspendedEscape = vi.fn();
    render({ sheet: sheetOf(), onClose, suspended: true, onSuspendedEscape });
    expect(q('[data-cockpit-bench-layer]').hasAttribute('inert')).toBe(true);
    expect(q('[data-cockpit-bench-sheet]').hasAttribute('aria-modal')).toBe(false);
    act(() => { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(onSuspendedEscape).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    // Lifted: modal again, and Escape closes the sheet.
    render({ sheet: sheetOf(), onClose, suspended: false, onSuspendedEscape });
    expect(q('[data-cockpit-bench-sheet]').getAttribute('aria-modal')).toBe('true');
    act(() => { document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(onClose).toHaveBeenCalled();
  });

  it('CB4-11/CB6-7: a refused pick says why ON the sheet, in a live region', () => {
    render({ sheet: sheetOf({ refusalLine: 'XOM can\'t come in right now — nothing was filed.' }) });
    const line = q('[data-cockpit-bench-refusal]');
    expect(line.getAttribute('data-cockpit-bench-refusal')).toBe('1');
    expect(line.getAttribute('role')).toBe('status');
    expect(line.textContent).toBe('XOM can\'t come in right now — nothing was filed.');
  });

  it('CB5-7: rank and status labels use the secondary token (≥ 4.5:1), and a locked row is not faded', () => {
    render({ sheet: sheetOf() });
    const locked = q('[data-cockpit-bench-row="PSX"]');
    expect(locked.style.opacity).toBe('');
    expect(locked.querySelector('[data-cockpit-bench-status]').style.color).toBe('var(--ft-text-secondary)');
  });

  it('CB5-8: the note\'s text stays block-level when expanded (no 16px-button line height)', () => {
    render({ sheet: sheetOf() });
    const note = q('[data-cockpit-bench-row="XOM"] [data-cockpit-bench-note]');
    click(note);
    expect(q('[data-cockpit-bench-row="XOM"] [data-cockpit-bench-note] > span').style.display).toBe('block');
  });
});
