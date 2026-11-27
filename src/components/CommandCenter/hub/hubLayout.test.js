// src/components/CommandCenter/hub/hubLayout.test.js
//
// The portfolio hub's slice 1 — THE LAYOUT DECISION, row by row (spec docs/specs/20261126_COMMAND_CENTER_PORTFOLIO_HUB_BUILD_SPEC_V1.md
// §3): 'book' only when the switch is on, the idea book's one read is `ready` and it carries a book. Every other case is
// 'today': not admitted (the route's 404, the read's `off`), no book, a failed read, idle and loading. The reads below are the
// shapes src/components/PracticeField/useIdeaBook.js hands back ({ key, status, book, error }).

import { describe, expect, it } from 'vitest';
import { HUB_LAYOUTS, hubLayoutOf } from './hubLayout';
import { COMMAND_CENTER_PORTFOLIO_HUB_ENABLED } from '../../../config/commandCenterPortfolioFlags';

const BOOK = Object.freeze({ version: 3, line: { value: '$99,502.35' } });
const KEY = 'owner-1:1';
const READS = Object.freeze({
  idle: { key: null, status: 'idle', book: null, error: null },
  loading: { key: KEY, status: 'loading', book: null, error: null },
  readyWithBook: { key: KEY, status: 'ready', book: BOOK, error: null },
  readyNoBook: { key: KEY, status: 'ready', book: null, error: null },
  notAdmitted: { key: KEY, status: 'off', book: null, error: null },
  failedRead: { key: KEY, status: 'error', book: null, error: 'status_500' },
  // useIdeaBook.js keeps the last good answer when a later read fails: still `ready`, the book, and the error beside it.
  failedRefreshAfterBook: { key: KEY, status: 'ready', book: BOOK, error: 'status_500' },
});

describe('the layout decision (spec §3)', () => {
  it('names two layouts, and only two', () => {
    expect(HUB_LAYOUTS).toEqual({ BOOK: 'book', TODAY: 'today' });
    expect(Object.isFrozen(HUB_LAYOUTS)).toBe(true);
  });

  it.each(Object.keys(READS))('switch off, %s read: today', (name) => {
    expect(hubLayoutOf({ read: READS[name], switchOn: false })).toBe('today');
  });

  it('switch on, a ready read with a book: book', () => {
    expect(hubLayoutOf({ read: READS.readyWithBook, switchOn: true })).toBe('book');
  });

  it.each([
    ['a ready read with no book', 'readyNoBook'],
    ['the route\'s 404 (not admitted)', 'notAdmitted'],
    ['a failed read', 'failedRead'],
    ['an idle read', 'idle'],
    ['a read still loading', 'loading'],
  ])('switch on, %s: today', (_label, name) => {
    expect(hubLayoutOf({ read: READS[name], switchOn: true })).toBe('today');
  });

  it('switch on, a refresh that failed after a good read: book (the read keeps its last good answer, so the card keeps it too)', () => {
    expect(hubLayoutOf({ read: READS.failedRefreshAfterBook, switchOn: true })).toBe('book');
  });

  it('switch on, no read or a malformed one: today', () => {
    for (const read of [undefined, null, {}, { status: 'ready' }, { status: 'ready', book: undefined }, { status: 'READY', book: BOOK }, 'ready']) {
      expect(hubLayoutOf({ read, switchOn: true }), JSON.stringify(read) ?? 'undefined').toBe('today');
    }
  });

  it('the switch must be the boolean true: any other value handed in is off', () => {
    // (Not `undefined`: that is "no switch handed in", which decides on the shipped switch — the value-neutral row below.)
    for (const switchOn of [1, 'true', {}, null, false]) {
      expect(hubLayoutOf({ read: READS.readyWithBook, switchOn }), String(switchOn)).toBe('today');
    }
  });

  it('with no switch handed in, it decides on the shipped switch (value-neutral: a flip moves no row here)', () => {
    for (const read of Object.values(READS)) {
      expect(hubLayoutOf({ read })).toBe(hubLayoutOf({ read, switchOn: COMMAND_CENTER_PORTFOLIO_HUB_ENABLED }));
    }
  });

  it('called with nothing, it is today', () => {
    expect(hubLayoutOf()).toBe('today');
  });
});
