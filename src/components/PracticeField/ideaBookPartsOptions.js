// src/components/PracticeField/ideaBookPartsOptions.js
//
// The Idea book parts' options, for the Command Center's book layout (the portfolio hub's slice 3; spec
// docs/specs/20261126_COMMAND_CENTER_PORTFOLIO_HUB_BUILD_SPEC_V1.md PH-10, Amendment A PH-28). The parts (IdeaBookScreen.jsx) are
// drawn by two hosts: the Idea book's own screen, and the hub's Overview. Each option defaults to the screen's behaviour:
//   - `cash`: the positions table's Cash row. Drawn unless a host sets `false` (the hub's Overview does: the design's
//     `cash={false}`, ccp5-parts.jsx Overview5). Read only while COMMAND_CENTER_PORTFOLIO_HUB_ENABLED is on, as a literal ternary
//     at the row, so with the switch off the row is today's element and this module is never reached.
//   - `deskLabel(item)`: a desk row's screen-reader name. The screen's says "… Open Desks"; in the hub a desk row opens Setups or
//     Ideas, so the hub names it (review S3W-4). Read the same way, under the switch.
// The layout is not an option here: every part whose drawing depends on it already takes it as a prop (`layout`), and only the
// screen's default export reads the window for it. The hub hands its own (hub/bookTabs.js bookPartsLayoutOf, PH-28).
// A scope, not a new prop on the parts: a new parameter would change the hub chunk while the switch is off (the card's screen is
// in it). The screen never provides it, so the screen draws exactly what it draws on main.

import { createContext } from 'react';

export const IdeaBookPartsOptions = /* @__PURE__ */ createContext(null);
