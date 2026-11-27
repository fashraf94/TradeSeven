// src/components/CommandCenter/HubBookScope.jsx
//
// The portfolio hub's slice 1 (spec docs/specs/20261126_COMMAND_CENTER_PORTFOLIO_HUB_BUILD_SPEC_V1.md §3, §4 slice 1) — THE
// CONNECTED SHELL'S ONE READ OF THE IDEA BOOK. Rendered only with COMMAND_CENTER_PORTFOLIO_HUB_ENABLED on, around the connected
// shell and nothing else (CommandCenterHub.jsx, the `connected` arm: a literal ternary, so with the switch off it folds to
// today's `<ConnectedHub …/>`). It:
//   - reads the book once, through the card's own hook (useIdeaBook, keyed by owner and auth epoch, no poll; it reads only
//     while the idea book screen's switch is on, as the card does);
//   - decides the layout from that read (hub/hubLayout.js: 'book' or 'today');
//   - hands the read, its refresh and the decision down as a scope (hub/hubBookRead.js), where the entry card's hub site takes
//     the read, so the card makes no read of its own and the card and the layout can never disagree.
// Slice 1 draws nothing from the decision. It is exposed in one inert place for tests: `data-hub-layout` on this wrapper, which
// draws no box (`display: contents`) and exists only with the switch on. Later slices read the decision from the scope.
// Keyed by site where it is rendered, as the shell is (ruling R-S1-5). No effect, timer or listener of its own: the read's
// triggers are the hook's (commandCenterHub.mount.guard.test.js scans this file).

import React, { useMemo } from 'react';
import { IDEA_BOOK_SCREEN_ON, useIdeaBook } from '../PracticeField/IdeaBookEntry';
import { HubBookReadContext } from './hub/hubBookRead';
import { hubLayoutOf } from './hub/hubLayout';

export default function HubBookScope({ children }) {
  const { read, refresh } = useIdeaBook({ enabled: IDEA_BOOK_SCREEN_ON });
  const layout = hubLayoutOf({ read });
  const value = useMemo(() => ({ read, refresh, layout }), [read, refresh, layout]);
  return (
    <HubBookReadContext.Provider value={value}>
      <div data-hub-layout={layout} style={{ display: 'contents' }}>{children}</div>
    </HubBookReadContext.Provider>
  );
}
