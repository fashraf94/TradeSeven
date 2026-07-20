// src/components/League/liveDraft/LiveDraftGlimpse.jsx
//
// Competitive Live Draft — STATE 1: the seated waiting room for a FORMING slot
// pod the player has claimed. Reached via "Open my game" between claiming a slot
// and the draft firing. Enriched to the Claude Design (Seated Status Surface):
// shared chrome + progression rail, the promoted slot countdown hero, the four-
// seat pod (humans by name + open→CPU rows), the loadout module (Edit-in-Forge),
// the seat-held confirmation, and a quiet leave-slot line.
//
// DARK-ONLY obsidian identity via LTOKENS/LX (no useTheme). All data is real or
// honest-empty: the countdown targets group.scheduledDraftAt; the pod reads
// group.groupMembers/seatNames; the loadout is the agentLoadout prop (name +
// archetype + watchlist name, NO fabricated rule chips — Q1).

import React from 'react';
import { GROUP_SIZE } from '../../../constants/leagueTournament';
import {
  SeatedPage, SeatedChrome, Countdown, PodCard, LoadoutCard, SeatHeldCard, LeaveSlot,
  useCountdownSecs, slotCountdownCopy, formingSeats,
} from './SeatedStatusParts';

export default function LiveDraftGlimpse({
  group, currentUserId, agentLoadout = null, onOpenForge = null,
  onLeave = null, leaving = false, compact = false,
}) {
  const scheduledDraftAt = group?.scheduledDraftAt || null;
  const secs = useCountdownSecs(scheduledDraftAt);
  const cd = slotCountdownCopy(scheduledDraftAt);
  const seats = formingSeats({
    groupMembers: group?.groupMembers, seatNames: group?.seatNames, currentUserId, groupSize: GROUP_SIZE,
  });

  const chrome = (
    <SeatedChrome
      eyebrow="My game"
      title="Weekly Pod"
      sub={cd.slotDay ? `Live-draft slot · draft runs ${cd.slotDay}, ${cd.slotTime} ET` : 'Live-draft slot · awaiting the draft'}
      slotShort={cd.slotShort}
      step="awaiting"
      compact={compact}
    />
  );

  const countdown = <Countdown secs={secs} cd={cd} compact={compact} />;
  const loadout = <LoadoutCard loadout={agentLoadout} phase="awaiting" onOpenForge={onOpenForge} compact={compact} />;
  const pod = <PodCard seats={seats} resolved={false} slotDay={cd.slotDay} compact={compact} />;
  const seatHeld = <SeatHeldCard compact={compact} />;
  const leave = <LeaveSlot onLeave={onLeave} leaving={leaving} compact={compact} />;

  return (
    <SeatedPage compact={compact}>
      {chrome}
      {compact ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {countdown}
          {pod}
          {loadout}
          {seatHeld}
          {leave}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.28fr 1fr', gap: 16, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {countdown}
              {loadout}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {seatHeld}
              {pod}
            </div>
          </div>
          {leave}
        </div>
      )}
    </SeatedPage>
  );
}
