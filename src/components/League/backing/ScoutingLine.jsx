// src/components/League/backing/ScoutingLine.jsx
//
// Backing Beta PR 4 — THE SCOUTING LINE'S PROFILE HOME (design brief rev2 §2,
// rev3 §3; ported from the frozen design's `backing-strip.jsx` ProfilePitch).
// One sentence in the player's own words, editable in two places that edit
// the SAME line: here, in the player's agent/profile area (IdentityPanel on
// desktop, EquipStation on mobile), and inline on the player's own team card
// (TeamCard.jsx) — both through the shared PitchEditor. Gated at call time on
// BACKING_BETA_ENABLED so the flag-off area is byte-identical and runs no
// subscription.
//
// Both homes call POST /api/team/pitch through useMyPitch; neither writes
// Firestore (the rules block is `write: if false`). The subscription in the
// hook is what makes an edit in one home appear in the other.

import React from 'react';
import { BACKING_BETA_ENABLED } from '../../../config/featureFlags';
import { LTOKENS, LX } from '../leagueTokens';
import { Eyebrow, Mono, Icon } from '../LeagueParts';
import useMyPitch from '../../../hooks/useMyPitch';
import PitchEditor from './PitchEditor';
import { CARD, PROFILE } from './backingCopy';

/**
 * The line's home, pure over the pitch (useMyPitch's return) — the live mount
 * below feeds it; the dev preview page feeds it a local pitch (Backing desktop
 * layouts: the profile home's desktop state), so the preview shows THIS view.
 */
export function ScoutingLineView({ pitch, agentName, accent = LX.energy, compact = false }) {
  return (
    // The compact home (EquipStation's fragment) spaces its sections with their
    // own margins; the framed home sits in a flex column with a gap. The margin
    // lives HERE, on the lit element, so the host mounts the line bare and the
    // dark render leaves nothing behind.
    <div data-backing="scouting-line" style={{ marginTop: compact ? 12 : 0, borderRadius: 14, padding: compact ? '11px 13px' : '13px 15px', background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair2}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 7 }}>
        <Eyebrow color={LTOKENS.ink3}>{PROFILE.eyebrow}</Eyebrow>
      </div>
      <PitchEditor pitch={pitch} accent={accent} mode="profile" />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginTop: 9 }}>
        <Icon name="eye" size={11} color={LTOKENS.ink3} style={{ marginTop: 2 }} />
        <Mono style={{ fontSize: 9.5, color: LTOKENS.ink3, lineHeight: 1.5 }}>{PROFILE.note(agentName || CARD.agentFallbackName('your team'))}</Mono>
      </div>
    </div>
  );
}

function ScoutingLineLive({ uid, agentName, accent, compact }) {
  const pitch = useMyPitch(uid, Boolean(uid));
  return <ScoutingLineView pitch={pitch} agentName={agentName} accent={accent} compact={compact} />;
}

/** The profile home. Renders nothing — and runs nothing — while the flag is dark. */
export default function ScoutingLine({ uid, agentName, accent = LX.energy, compact = false }) {
  if (!BACKING_BETA_ENABLED) return null;
  if (!uid) return null;
  return <ScoutingLineLive uid={uid} agentName={agentName} accent={accent} compact={compact} />;
}
