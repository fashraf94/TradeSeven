// src/components/CommandCenter/sections/BookOverview.jsx
//
// The portfolio hub's slice 3 — THE OVERVIEW of the book layout (spec docs/specs/20261126_COMMAND_CENTER_PORTFOLIO_HUB_BUILD_SPEC_V1.md
// §2, §4 slice 3, PH-1, PH-10, PH-12; Amendment A PH-26 to PH-28). Drawn only when the layout decision is 'book' (BookLayout.jsx),
// at both sites, top to bottom:
//   1. the book line — the Idea book's own part (BookLine);
//   2. "Needs you" — today's next action as one slim line: the candidate's own title, its own action (the first deployment's is
//      the deploy provider's hold, as on the card) and today's "Later". Whatever the hub's selector returns, of every kind; nothing
//      when it returns nothing (PH-26). Its why and detail lines are the card's, not this strip's;
//   3. the desk rows — the Idea book's strip (Strip). A tap opens Setups for the archetype's desk and Ideas for the agent's;
//   4. the positions table — the Idea book's own (PosTable), every state it draws today, with the Cash row off (the parts' option,
//      PracticeField/ideaBookPartsOptions.js). A row or a slot header opens its built detail in place under it, at every width
//      (PH-27). One open at a time, as on the screen;
//   5. the marks stamp — the table's own last line ("Marks as of the close …");
//   6. under the table, in today's order: the games rows, reviews available, the Game history row, Recent activity and the daily
//      brief — today's phone Overview list itself (PhoneTabs.jsx PhoneOverview), which in this layout draws no next-action card
//      (the strip above has it) and, on the wide compositions, the wide words and activity limit (PH-1).
// The parts take their layout from the hub (hub/bookTabs.js bookPartsLayoutOf, PH-28), handed in. Nothing here measures, reads,
// waits or listens: the view is the book scope's one read (HubBookScope.jsx), the rest are the shell's sections and actions.

import React, { useState } from 'react';
import { BookLine, PosTable, Strip } from '../../PracticeField/IdeaBookScreen';
import { IdeaBookPartsOptions } from '../../PracticeField/ideaBookPartsOptions';
import { deployDisplay } from '../hub/deployDisplay';
import { HUB_COPY as COPY, PORTFOLIO_HUB_COPY as BOOK } from '../hub/hubCopy';
import { NEXT_ACTION_KINDS } from '../hub/nextAction';
import { C, tint } from '../hub/hubStyle';
import { HubButton } from '../HubParts';
import { PhoneOverview } from '../PhoneTabs';
import HubHold from './HubHold';

/** The table's options in the hub: no Cash row (the design's `cash={false}`, ccp5-parts.jsx). */
const HUB_PARTS = Object.freeze({ cash: false });

/** The card's icons for its actions (NextActionCard.jsx): a game's sword, a review's film; none for the others. */
function ctaIconOf(kind) {
  if (kind === NEXT_ACTION_KINDS.OPEN_GAME) return 'sword';
  if (kind === NEXT_ACTION_KINDS.REVIEW) return 'film';
  return undefined;
}

/**
 * "Needs you" (PH-12, PH-26): the next action the hub's selector returns, as one slim line. The first deployment's action is the
 * deploy provider's hold (`holdWiring` / `holding`, the card's own control id), so its words and its phases are the card's.
 */
export function NeedsYouStrip({ nextAction, deploy, onAct, onLater, holdWiring = null, holding = null }) {
  const candidate = nextAction?.status === 'ready' ? nextAction.candidate : null;
  if (!candidate) return null;
  const isDeploy = candidate.key === NEXT_ACTION_KINDS.DEPLOY;
  return (
    <div
      role="group"
      aria-label={BOOK.needsYou}
      data-hub-needs-you={candidate.key}
      style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 4, minHeight: 44, padding: '4px 4px 4px 12px',
        borderRadius: 10, background: tint('teal', 0.07), border: `1px solid ${tint('teal', 0.3)}`,
      }}
    >
      <span data-hub-needs-you-title="" style={{ flex: '1 1 150px', minWidth: 0, fontSize: 13, fontWeight: 600, color: C.ink, lineHeight: 1.3, textWrap: 'pretty' }}>
        {candidate.title}
      </span>
      <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, marginLeft: 'auto' }}>
        {isDeploy ? (
          <HubHold compact canStart={deployDisplay(deploy).canStart} label={candidate.cta} wiring={holdWiring} holding={holding} />
        ) : (
          <HubButton kind="primary" small icon={ctaIconOf(candidate.key)} onPress={onAct}>{candidate.cta}</HubButton>
        )}
        <HubButton kind="ghost" small onPress={onLater} data-hub-later="">{COPY.nextAction.later}</HubButton>
      </span>
    </div>
  );
}

/**
 * @param {object} props.view     the book's view (the scope's read, `read.book`), as the server built it
 * @param {'p320'|'p390'|'desk'} props.layout  the parts' layout, from the hub's composition (PH-28)
 * @param {object} props.sections the shell's sections (the next action, the deploy state, games, activity, brief, career)
 * @param {object} props.actions  the shell's actions
 * @param {(desk: string) => void} props.onDesk  a desk row's tap: its desk id
 */
export default function BookOverview({ view, layout, sections, actions, onDesk }) {
  const [open, setOpen] = useState(null);
  return (
    <div data-hub-book-overview="" style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <BookLine line={view.line} layout={layout} />
      <NeedsYouStrip
        nextAction={sections.nextAction}
        deploy={sections.deploy}
        onAct={actions.nextAction}
        onLater={actions.laterNextAction}
        holdWiring={actions.nextActionHold}
        holding={actions.nextActionHolding}
      />
      <Strip items={view.strip} onDesk={onDesk} />
      <IdeaBookPartsOptions.Provider value={HUB_PARTS}>
        <PosTable view={view} layout={layout} open={open} setOpen={setOpen} />
      </IdeaBookPartsOptions.Provider>
      <div data-hub-book-under="" style={{ marginTop: 10 }}>
        <PhoneOverview sections={sections} actions={actions} />
      </div>
    </div>
  );
}
