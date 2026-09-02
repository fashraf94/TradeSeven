// src/components/Dashboard/desk/AgentDesk.jsx
//
// The Agent Desk (Pass 1 spec §8) — what the Dashboard shows while a battle is
// live. It measures the SCOREBOARD, not the agent's mind.
//
// WHAT THAT MEANS IN PRACTICE. The one persisted, comparable proximity object
// measures distance to the next bonus/bust SCORING threshold — not distance to
// a risk trigger. A position can sit 0.2 ATR from a bonus tier and the agent
// may hold straight through it. So "PLTR · 0.4 ATR from next bonus tier" is an
// observable game fact and ships; "PLTR is close to a trade" is a causal
// promise the system cannot keep and does not. The single action-relevant leg,
// the swap lock, is rendered as a CONSTRAINT ("locked · 1.2% from unlock") —
// a fact about what cannot happen, not a forecast of what will.
//
// The posture line is DISCRETE for the same reason: everything runs at 15
// minutes, so a verb implying attention between checks would be a fabrication
// by another route. "Checked 9:47 · next ~10:02", with the ~ required.
//
// EVERY string comes from deskCopy.js. No inline copy here — that is what
// makes the honesty rules testable rather than remembered (spec §9).
//
// Renders from the adapter prop ONLY. No document field is read here.
// Styling goes through CMD / the commandUI primitives: this tree ships beside
// a hard-zero hex baseline in tokens.guard.test.js, and raw core-palette hex
// is exactly what that guard exists to reject.

import React from 'react';
import { CMD, alpha, Eyebrow, Mono } from '../commandUI';
// P-5 added the named export so this imports the alert rather than forking it
// (spec §8.5). Before that commit the file exported only its default.
import { BreakthroughAlerts } from '../../Agent/LiveActivityPanel';
import { DESK_COPY } from './deskCopy';

/** One row of the score-proximity block. */
function ProximityRow({ row, accent }) {
  // ATR distance is rounded for display, and the SAME rounded number is what
  // the copy renders — never a label computed from one value and a number from
  // another (BUILD_RULES §9).
  const atrAway = DESK_COPY.distance1dp(Math.abs(row.targetMultiple - row.currentMultiplier));
  const pct = typeof row.zoneProgressPercent === 'number' ? row.zoneProgressPercent : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ fontSize: 12.5, color: CMD.ink2, lineHeight: 1.35 }}>
        {DESK_COPY.proximityRow(row.symbol, atrAway, row.direction)}
      </div>
      {pct != null && (
        <div style={{ height: 3, borderRadius: 2, background: CMD.hair, overflow: 'hidden' }}>
          <div style={{
            width: `${Math.max(0, Math.min(100, pct))}%`,
            height: '100%',
            background: alpha(accent, 0.65),
          }} />
        </div>
      )}
    </div>
  );
}

function Block({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Eyebrow>{label}</Eyebrow>
      {children}
    </div>
  );
}

/**
 * @param {object} sync   the adapter object (never a raw document)
 * @param {string} accent the agent's colour, resolved by the shell
 */
export default function AgentDesk({ sync, accent = CMD.teal }) {
  if (!sync) return null;

  const { phase, lastCheckedAt, nextDecisionAt, scoreProximity, swapLock, statusFeedLatest } = sync;

  // ── 0. Identity ────────────────────────────────────────────────────────────
  // Both halves come from the adapter, never from the Manage card beside it.
  const eyebrow = DESK_COPY.deskEyebrow(sync.game?.agentName, sync.game?.label);

  // ── 1. Posture line ────────────────────────────────────────────────────────
  // Never a fabricated time: LIVE with no eval landed says a check is coming
  // rather than inventing when.
  const posture = phase === 'LIVE'
    ? DESK_COPY.postureLive(lastCheckedAt, nextDecisionAt)
    : phase === 'LIVE_CLOSED'
      ? DESK_COPY.postureClosed(sync.nextOpenEt, lastCheckedAt)
      : phase === 'PRE_OPEN'
        ? DESK_COPY.posturePreOpen
        : DESK_COPY.postureComplete;

  // ── 2/3. Proximity + locks ─────────────────────────────────────────────────
  // Staleness gates LIVE only. Off-hours prices are frozen with the market, so
  // the last computed proximity is legitimately current-as-of-close and the
  // as-of stamp carries the honesty. Blanking it there would empty the dormant
  // Desk every evening, weekend and holiday, because the cache cron does not
  // run then.
  const hasProximity = scoreProximity?.length > 0;
  const hasLocks = swapLock?.length > 0;
  const asOf = phase !== 'LIVE' ? DESK_COPY.proximityAsOf(sync.proximityAsOf) : null;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 16,
      padding: '15px 16px', borderRadius: 18,
      background: CMD.surface, border: `1px solid ${CMD.hair}`,
    }}>
      {/* Identity — which battle this Desk is describing (F-1) */}
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}

      {/* Posture */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <Mono style={{ fontSize: 11.5, color: CMD.ink2 }}>{posture}</Mono>
        {asOf && <Mono style={{ fontSize: 10.5, color: CMD.ink3 }}>{asOf}</Mono>}
      </div>

      {/* Score proximity — or an honest reason it is absent */}
      {sync.proximityStale ? (
        <Mono style={{ fontSize: 11, color: CMD.ink3 }}>{DESK_COPY.proximityUpdating}</Mono>
      ) : hasProximity ? (
        <Block label={DESK_COPY.proximityHeading}>
          {/* No placeholder rows: a position with no threshold data is simply
              absent, which the adapter already guarantees. */}
          {scoreProximity.map((row) => (
            <ProximityRow key={row.symbol} row={row} accent={accent} />
          ))}
        </Block>
      ) : null}

      {/* Swap locks — a constraint, not a forecast */}
      {hasLocks && (
        <Block label={DESK_COPY.swapLockHeading}>
          {swapLock.map((lock) => (
            <Mono key={lock.symbol} style={{ fontSize: 12, color: CMD.ink2 }}>
              {DESK_COPY.swapLockRow(
                lock.symbol,
                DESK_COPY.distance1dp(lock.distancePercent),
              )}
            </Mono>
          ))}
        </Block>
      )}

      {/* Latest feed line — engine text, verbatim. Never a paraphrase. */}
      {statusFeedLatest?.message && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{
            fontSize: 12.5, color: CMD.ink, lineHeight: 1.4,
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {statusFeedLatest.message}
          </div>
          {statusFeedLatest.timestamp && (
            <Mono style={{ fontSize: 10.5, color: CMD.ink3 }}>
              {DESK_COPY.feedStamp(statusFeedLatest.timestamp)}
            </Mono>
          )}
        </div>
      )}

      {/* Breakthrough alerts — gameplan_meeting only, post-P-5. Imported, not
          forked; the panel's own admission gate drops anything unmapped. */}
      {sync.statusFeed?.length > 0 && <BreakthroughAlerts statusFeed={sync.statusFeed} />}
    </div>
  );
}
