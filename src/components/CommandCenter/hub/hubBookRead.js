// src/components/CommandCenter/hub/hubBookRead.js
//
// The portfolio hub's slice 1 (spec docs/specs/20261126_COMMAND_CENTER_PORTFOLIO_HUB_BUILD_SPEC_V1.md §3) — THE SHELL'S BOOK
// READ, as a scope. HubBookScope.jsx provides it around the connected shell, with the switch on only: `{ read, refresh, layout }`,
// the idea book's one read, its refresh and the layout decided from it (hub/hubLayout.js). The entry card's hub site
// (sections/ActivitySection.jsx) takes the read from here and hands it to the card as a prop. A scope, not a prop through the
// shells: a new prop on today's elements would change the hub's build while the switch is off. Outside the scope (the switch
// off, or a hub with no App object) the value is null and the card reads for itself, as before.

import { createContext } from 'react';

export const HubBookReadContext = /* @__PURE__ */ createContext(null);
