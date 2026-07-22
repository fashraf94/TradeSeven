// src/components/League/liveDraft/LiveDraftAwaiting.jsx
//
// Competitive Live Draft — STATE 2: the drafted, AWAITING_OPEN holding state.
// After a slot pod's draft completes it waits for the next Monday open (its
// battleStartWeek anchor). Enriched to the Claude Design (Seated Status Surface):
// shared chrome + progression rail, a PROMOTED live countdown to Monday's 9:30
// open (newly derived from battleStartWeek.anchorIso — present on the group doc,
// previously unused), the drafted lineup (the user's THREE real picks + an
// honest line for the agent's six), the resolved four-seat pod, and the loadout
// module. Committed state — no leave affordance.
//
// HONEST-EMPTY (Q2): the agent's six are NOT produced until the Monday BATTLE
// flip and live in a subcollection this surface never reads — so State 2 shows
// the user's three real picks and an honest "drafts at Monday's open" line for
// the rest, never a fabricated six. DARK-ONLY via LTOKENS/LX (no useTheme).

import React from 'react';
import { GROUP_SIZE } from '../../../constants/leagueTournament';
import {
  SeatedPage, SeatedChrome, Countdown, PodCard, LoadoutCard, UserLineupCard,
  useCountdownSecs, openCountdownCopy, resolvedSeats, userPickSymbols,
} from './SeatedStatusParts';

/** 'YYYY-MM-DD' → "Monday, Jul 20" (the pod's first-trading-day anchor; usually a
 *  Monday, a Tuesday on a holiday-Monday week). UTC-noon parse → no TZ drift. */
function fmtAnchorDay(etDate) {
  if (typeof etDate !== 'string') return null;
  const [y, m, d] = etDate.split('-').map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export default function LiveDraftAwaiting({ group, currentUserId, agentLoadout = null, onOpenForge = null, compact = false }) {
  const anchorEtDate = group?.battleStartWeek?.anchorEtDate || group?.startAnchor?.anchorEtDate || null;
  const anchorIso = group?.battleStartWeek?.anchorIso || group?.startAnchor?.anchorIso || null;
  const anchorDayLabel = fmtAnchorDay(anchorEtDate);

  const secs = useCountdownSecs(anchorIso);
  const cd = openCountdownCopy({ anchorIso, anchorDayLabel });

  const picks = userPickSymbols({ players: group?.players, currentUserId });
  const seats = resolvedSeats({
    players: group?.players, seatNames: group?.seatNames, currentUserId, groupSize: GROUP_SIZE,
  });

  const chrome = (
    <SeatedChrome
      eyebrow="My game"
      title="Weekly Pod"
      sub={anchorDayLabel ? `Drafted · trading opens ${anchorDayLabel}, 9:30am ET` : 'Drafted · trading opens at the next open'}
      slotShort={null}
      step="drafted"
      compact={compact}
    />
  );

  const countdown = <Countdown secs={secs} cd={cd} compact={compact} />;
  const lineup = <UserLineupCard picks={picks} compact={compact} />;
  const pod = <PodCard seats={seats} resolved slotDay={anchorDayLabel} compact={compact} />;
  const loadout = <LoadoutCard loadout={agentLoadout} phase="drafted" onOpenForge={onOpenForge} compact={compact} />;

  return (
    <SeatedPage compact={compact}>
      {chrome}
      {compact ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {countdown}
          {lineup}
          {pod}
          {loadout}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {countdown}
          {lineup}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
            {pod}
            {loadout}
          </div>
        </div>
      )}
    </SeatedPage>
  );
}
