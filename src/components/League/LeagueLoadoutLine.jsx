// src/components/League/LeagueLoadoutLine.jsx
//
// Build A2 — board 3, the League lobby's loadout lines (rulings FD-2, FD-3, FD-4), behind PER_GAME_LOADOUT_ENABLED and
// AGENT_FORM_ARMORY_ENABLED:
//   - LeagueLoadoutLine (the League tab): the set as a 40 px still, the book, and the lock state from the player's
//     ranked group (the same rule the writers refuse by: leagueLockOfGroup over subscribeMyGroup's answer). A door only
//     while the loadout is open; it opens the Command Center, whose Loadout tab holds the League card and the armory.
//     Locked, the line shows the lock and the week's end and nothing on it is tappable. No lobby figure (N1).
//   - TrainingLoadoutLine (the Training tab): "Training uses your League loadout", the same line with no door, and where
//     to change it. The "Customize loadout" button and its sheet are gone (FD-4).
// The League loadout is the ranked record's own fields (FD-2), which App already hands the lobby as `agentLoadout`;
// `agentLoadout.openLoadout` is the door (App, flag on). The words are LOADOUT_COPY's; names come through
// hub/archetypeLines.js.

import React from 'react';
import { LTOKENS, alpha } from './leagueTokens';
import { Mono, LIcon } from './LeagueParts';
import { leagueLockOfGroup } from '../../constants/perGameLoadout';
import { archetypeLines } from '../CommandCenter/hub/archetypeLines';
import { HUB_COPY, LOADOUT_COPY } from '../CommandCenter/hub/hubCopy';
import { lockWhenOf } from '../CommandCenter/hub/perGameLoadoutModel';
import { LoadoutStill, STILL_PX } from '../CommandCenter/LoadoutCards';

/** The League loadout as a line shows it: the set's name, the book's name (or the open market). */
function leagueLineOf(agentLoadout) {
  const name = archetypeLines(agentLoadout?.archetype ?? null).name;
  const book = agentLoadout?.equippedWatchlistId ? (agentLoadout.equippedWatchlistName || HUB_COPY.loadout.watchlistFallback) : LOADOUT_COPY.noBook;
  return { name, book, hasBook: Boolean(agentLoadout?.equippedWatchlistId) };
}

function LineText({ eyebrow, line, sub }) {
  return (
    <span style={{ flex: 1, minWidth: 0 }}>
      {eyebrow ? <Mono style={{ display: 'block', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: LTOKENS.ink3, marginBottom: 3 }}>{eyebrow}</Mono> : null}
      <span style={{ display: 'block', fontSize: 14, lineHeight: 1.3, color: LTOKENS.ink }}>
        <span style={{ fontWeight: 700 }}>{line.name}</span>
        <span style={{ color: LTOKENS.ink2 }}>{HUB_COPY.sep}{line.book}</span>
      </span>
      {sub}
    </span>
  );
}

/** The League tab's line: the lock state from the player's group, a door only while it is open. */
export function LeagueLoadoutLine({ agentLoadout, group, accent }) {
  if (!agentLoadout) return null;
  const line = leagueLineOf(agentLoadout);
  const lock = leagueLockOfGroup(group);
  const when = lock.locked ? lockWhenOf(lock.endsAtMs) : null;
  const subText = lock.locked ? (when ? LOADOUT_COPY.leagueLocked(when) : LOADOUT_COPY.leagueLockedUndated) : LOADOUT_COPY.leagueOpen;
  const sub = (
    <span data-league-loadout-state={lock.locked ? 'locked' : 'open'} style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, color: lock.locked ? LTOKENS.ink3 : accent }}>
      {lock.locked ? <LIcon name="lock" size={12} color={LTOKENS.ink3} /> : <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 3, background: accent, flexShrink: 0 }} />}
      <Mono style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: lock.locked ? LTOKENS.ink3 : LTOKENS.ink2 }}>{subText}</Mono>
    </span>
  );
  const door = !lock.locked && typeof agentLoadout.openLoadout === 'function';
  const body = (
    <>
      <LoadoutStill archetype={agentLoadout.archetype} size={STILL_PX.line} />
      <LineText eyebrow={LOADOUT_COPY.leagueEyebrow} line={line} sub={sub} />
      {door ? <LIcon name="chevR" size={16} color={LTOKENS.ink2} /> : null}
    </>
  );
  const frame = { display: 'flex', alignItems: 'center', gap: 12, minHeight: 52, padding: '8px 14px', borderRadius: 16, background: LTOKENS.surface, border: `1px solid ${lock.locked ? LTOKENS.hair : alpha(accent, 0.3)}`, margin: '0 0 12px', width: '100%', boxSizing: 'border-box', textAlign: 'left', color: LTOKENS.ink, font: 'inherit' };
  return door ? (
    <button type="button" className="lg-tap" data-league-loadout="" aria-label={LOADOUT_COPY.leagueDoor} onClick={agentLoadout.openLoadout} style={{ ...frame, appearance: 'none', cursor: 'pointer' }}>{body}</button>
  ) : (
    <section data-league-loadout="" aria-label={LOADOUT_COPY.leagueEyebrow} style={frame}>{body}</section>
  );
}

/** The Training tab's line: the League loadout, no door, and where to change it (FD-4). */
export function TrainingLoadoutLine({ agentLoadout }) {
  if (!agentLoadout) return null;
  const line = leagueLineOf(agentLoadout);
  return (
    <section data-training-loadout="" aria-label={LOADOUT_COPY.trainingTitle} style={{ marginTop: 16, textAlign: 'left', padding: '12px 14px 10px', borderRadius: 14, background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` }}>
      <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.3, color: LTOKENS.ink }}>{LOADOUT_COPY.trainingTitle}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 52, marginTop: 4 }}>
        <LoadoutStill archetype={agentLoadout.archetype} size={STILL_PX.line} />
        <LineText eyebrow={null} line={line} sub={null} />
      </div>
      <div style={{ fontSize: 12.5, color: LTOKENS.ink3, lineHeight: 1.4, paddingBottom: 4 }}>{LOADOUT_COPY.trainingWhere}</div>
    </section>
  );
}
