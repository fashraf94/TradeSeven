// src/components/CommandCenter/hub/hubLayout.js
//
// The portfolio hub's slice 1 — THE LAYOUT DECISION (spec docs/specs/20261126_COMMAND_CENTER_PORTFOLIO_HUB_BUILD_SPEC_V1.md
// §3; Phase 0 Part F2). Does this player get the book layout or today's hub? One expression on the idea book's one read:
//
//   COMMAND_CENTER_PORTFOLIO_HUB_ENABLED && read.status === 'ready' && read.book !== null
//
// 'book' only then. Every other case is 'today': not admitted (the route's 404, the read's `off`), no book, a failed read,
// idle and loading. A refresh that fails after a good read keeps `ready` and the book (useIdeaBook.js), so it stays 'book',
// as the entry card keeps drawing it.
//
// Pure: it reads only its arguments and the switch. No clock, no I/O. Called once, in the connected shell's book scope
// (HubBookScope.jsx), which hands the answer down with the read it came from.

import { COMMAND_CENTER_PORTFOLIO_HUB_ENABLED } from '../../../config/commandCenterPortfolioFlags';

export const HUB_LAYOUTS = /* @__PURE__ */ Object.freeze({ BOOK: 'book', TODAY: 'today' });

/**
 * @param {{ read?: { status?: string, book?: object|null }|null, switchOn?: boolean }} [p]
 *   `read`: the idea book's read, as useIdeaBook hands it back; `switchOn`: the portfolio switch (the shipped literal unless
 *   a caller hands one in). Only the boolean `true` is on.
 * @returns {'book'|'today'}
 */
export function hubLayoutOf({ read = null, switchOn = COMMAND_CENTER_PORTFOLIO_HUB_ENABLED } = {}) {
  const ready = switchOn === true && read !== null && typeof read === 'object' && read.status === 'ready';
  return ready && read.book !== null && read.book !== undefined ? HUB_LAYOUTS.BOOK : HUB_LAYOUTS.TODAY;
}
