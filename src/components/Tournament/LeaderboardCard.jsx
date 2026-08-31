// src/components/Tournament/LeaderboardCard.jsx
//
// P6b — the seasonal leaderboard surface (Spec §1.5; dev-screen mounted now,
// League home at P9). Month nav by doc key (chevrons over 'YYYY-MM',
// boundary-clamped via monthNavState), signed rows sorted where they fall
// (negatives red — the cautionary-learning ruling, honest not shameful), CPU
// chips, you-row teal highlight, row → tier-2 spectator entry via
// currentGroupId. The consensus/contrarian cards read the C-1 derived feeds.
// Tokens-native; static (reduced-motion-safe by construction).

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Trophy } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { subscribeLeaderboard } from '../../services/tournamentGroupService';
import { leaderboardDocId, shiftMonthKey } from '../../constants/leagueTournament';
import { etMonthKey, monthNavState, rankLeaderboardEntries, decomposeEntryWeeks } from '../../utils/tournamentSurfaces';
import { WEEKLY_LADDER_PLACEMENT_ENABLED } from '../../config/featureFlags';

export default function LeaderboardCard({ uid, dev = false, initialMonthKey, onOpenGroup }) {
  const { tokens } = useTheme();
  const currentMonthKey = useMemo(() => etMonthKey(), []);
  const [monthKey, setMonthKey] = useState(initialMonthKey || currentMonthKey);
  const [doc, setDoc] = useState(null);
  const [loaded, setLoaded] = useState(false);
  // Which row is showing its week decomposition (§9). Dark-flag only.
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    setLoaded(false);
    return subscribeLeaderboard(leaderboardDocId(monthKey, { dev }), (d) => { setDoc(d); setLoaded(true); });
  }, [monthKey, dev]);

  const { canNewer, canOlder } = monthNavState({ monthKey, currentMonthKey, docExists: !!doc });
  // THE ONE ORDERING HOME (tournamentSurfaces.rankLeaderboardEntries) — never a
  // local comparator, so this view and any other board surface cannot drift (§9).
  const rows = useMemo(
    () => rankLeaderboardEntries(doc?.entries, { placementEnabled: WEEKLY_LADDER_PLACEMENT_ENABLED }),
    [doc],
  );

  const card = { background: tokens.bgCard, border: `1px solid ${tokens.borderDivider}`, borderRadius: 10, padding: 14 };
  const chev = (enabled) => ({
    background: 'none', border: 'none', cursor: enabled ? 'pointer' : 'default',
    color: enabled ? tokens.textPrimary : tokens.textFaint, padding: 4, opacity: enabled ? 1 : 0.4,
    display: 'inline-flex', alignItems: 'center',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Trophy size={16} color={tokens.medalGold} />
          <div style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>Leaderboard{dev ? ' (dev)' : ''}</div>
          <button style={chev(canOlder)} disabled={!canOlder}
            onClick={() => canOlder && setMonthKey(shiftMonthKey(monthKey, -1))} aria-label="Previous month">
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 700, minWidth: 64, textAlign: 'center' }}>
            {monthKey}
          </span>
          <button style={chev(canNewer)} disabled={!canNewer}
            onClick={() => canNewer && setMonthKey(shiftMonthKey(monthKey, 1))} aria-label="Next month">
            <ChevronRight size={16} />
          </button>
        </div>

        {!loaded ? (
          <div style={{ fontSize: 12, color: tokens.textMuted }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ fontSize: 12, color: tokens.textMuted }}>No board for {monthKey} yet.</div>
        ) : rows.map((entry, i) => (
          WEEKLY_LADDER_PLACEMENT_ENABLED
            ? <SeasonEntryRow key={entry.odUserId} entry={entry} rank={i + 1} mine={entry.odUserId === uid}
                expanded={expandedId === entry.odUserId}
                onToggle={() => setExpandedId(expandedId === entry.odUserId ? null : entry.odUserId)}
                onOpenGroup={onOpenGroup} />
            : <LegacyEntryRow key={entry.odUserId} entry={entry} rank={i + 1} mine={entry.odUserId === uid}
                onOpenGroup={onOpenGroup} />
        ))}
      </div>

      {doc?.feeds && <LeaderboardFeeds feeds={doc.feeds} />}
    </div>
  );
}

/**
 * FLAG-OFF row — byte-identical to the board's shipping markup. Extracted
 * verbatim so the dark path cannot alter it; do not "tidy" this into the
 * season row (acceptance 7).
 */
function LegacyEntryRow({ entry, rank, mine, onOpenGroup }) {
  const { tokens } = useTheme();
  const clickable = !!entry.currentGroupId && !!onOpenGroup;
  return (
    <button disabled={!clickable}
      onClick={() => clickable && onOpenGroup(entry.currentGroupId)}
      style={{
        display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 12, padding: '4px 8px',
        borderRadius: 6, border: 'none', textAlign: 'left', width: '100%',
        cursor: clickable ? 'pointer' : 'default',
        background: mine ? 'rgba(20,184,166,0.12)' : 'transparent',
      }}>
      <span style={{ color: tokens.textFaint, fontVariantNumeric: 'tabular-nums', width: 22 }}>#{rank}</span>
      <span style={{ flex: 1, fontWeight: mine ? 800 : 500, color: mine ? '#14b8a6' : tokens.textPrimary }}>
        {mine ? 'You' : entry.displayName}
        {entry.isCpu && <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8' }}> CPU</span>}
      </span>
      <span style={{ fontSize: 10, color: tokens.textFaint }}>{Object.keys(entry.weeks || {}).length} wk</span>
      <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: (entry.points ?? 0) < 0 ? '#ef4444' : tokens.textPrimary }}>
        {(entry.points ?? 0) >= 0 ? '+' : ''}{entry.points}
      </span>
    </button>
  );
}

const ORDINAL = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th' };

/**
 * SEASON row (dark flag) — cumulative PLACEMENT POINTS as the headline number,
 * expanding into the weeks that produced it.
 *
 * §9 DISPLAY-AGREEMENT: the total and every week beneath it are read from the
 * SAME stored `entry.weeks` map the writer summed — the rows are never
 * re-derived from composites here, so the parts cannot disagree with the whole.
 *
 * CPU seats (ruling §4) are archetype-named by the writer (`cpuAgentName` →
 * "CPU — Capital Preserver"); a raw `cpu-40` id is never rendered. They carry a
 * visible BOT chip and a muted name so a player can see at a glance how much of
 * the field is bots — marked, never hidden, and never excluded from any
 * position including first.
 */
function SeasonEntryRow({ entry, rank, mine, expanded, onToggle, onOpenGroup }) {
  const { tokens } = useTheme();
  const weeks = decomposeEntryWeeks(entry);
  const clickable = !!entry.currentGroupId && !!onOpenGroup;
  const isCpu = entry.isCpu === true;
  const total = entry.placementPoints ?? 0;

  return (
    <div style={{
      borderRadius: 6, background: mine ? 'rgba(20,184,166,0.12)' : 'transparent',
      border: `1px solid ${expanded ? tokens.borderDivider : 'transparent'}`,
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 12, padding: '4px 8px' }}>
        <span style={{ color: tokens.textFaint, fontVariantNumeric: 'tabular-nums', width: 22 }}>#{rank}</span>
        <button
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={`${mine ? 'You' : entry.displayName} — ${total} placement points across ${weeks.length} weeks`}
          style={{
            flex: 1, display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0,
            background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer',
            fontSize: 12, fontWeight: mine ? 800 : 500,
            color: mine ? '#14b8a6' : isCpu ? tokens.textMuted : tokens.textPrimary,
          }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {mine ? 'You' : entry.displayName}
          </span>
          {isCpu && (
            <span style={{
              flexShrink: 0, fontSize: 8.5, fontWeight: 800, letterSpacing: '0.06em',
              color: tokens.textFaint, border: `1px solid ${tokens.borderDivider}`,
              borderRadius: 3, padding: '0 3px', lineHeight: 1.5,
            }}>BOT</span>
          )}
        </button>
        <span style={{ fontSize: 10, color: tokens.textFaint }}>{weeks.length} wk</span>
        <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: tokens.textPrimary, minWidth: 28, textAlign: 'right' }}>
          {total}
        </span>
      </div>

      {expanded && (
        <div style={{ padding: '2px 8px 8px 30px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {weeks.length === 0 && (
            <span style={{ fontSize: 10.5, color: tokens.textFaint }}>No weeks on the board yet.</span>
          )}
          {weeks.map(w => (
            <div key={w.groupId} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 10.5, color: tokens.textMuted }}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.label}</span>
              <span style={{ color: tokens.textFaint, minWidth: 52 }}>
                {w.final ? (ORDINAL[w.placement] ?? '—') : 'in progress'}
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums', color: tokens.textFaint, minWidth: 46, textAlign: 'right' }}>
                {w.final ? `${w.compositeMargin >= 0 ? '+' : ''}${w.compositeMargin}` : ''}
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, minWidth: 28, textAlign: 'right' }}>
                {w.placementPoints}
              </span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, fontSize: 10, color: tokens.textFaint, paddingTop: 3, borderTop: `1px solid ${tokens.borderDivider}` }}>
            <span style={{ flex: 1 }}>Margin over group average · tiebreak</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {(entry.compositeMargin ?? 0) >= 0 ? '+' : ''}{entry.compositeMargin ?? 0}
            </span>
          </div>
          {clickable && (
            <button onClick={() => onOpenGroup(entry.currentGroupId)}
              style={{
                alignSelf: 'flex-start', marginTop: 4, background: 'none', cursor: 'pointer',
                border: `1px solid ${tokens.borderDivider}`, borderRadius: 5, padding: '2px 7px',
                fontSize: 10, color: tokens.textMuted,
              }}>Open current pod</button>
          )}
        </div>
      )}
    </div>
  );
}

/** The C-1 consensus + contrarian cards (open cards — named). */
function LeaderboardFeeds({ feeds }) {
  const { tokens } = useTheme();
  const consensus = feeds.consensus || [];
  const contrarian = feeds.contrarian || [];
  if (consensus.length === 0 && contrarian.length === 0) return null;
  const card = { background: tokens.bgCard, border: `1px solid ${tokens.borderDivider}`, borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 4 };
  const row = { display: 'flex', gap: 8, fontSize: 12, color: tokens.textMuted, padding: '2px 0' };

  return (
    <>
      {consensus.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>Consensus · the crowd's favorites</div>
          {consensus.map(c => (
            <div key={c.symbol} style={row}>
              <span style={{ flex: 1, fontWeight: 700, color: tokens.textPrimary }}>{c.symbol}</span>
              <span>{c.userHolders} user{c.userHolders === 1 ? '' : 's'} · {c.agentHolders} agent{c.agentHolders === 1 ? '' : 's'}</span>
            </div>
          ))}
        </div>
      )}
      {contrarian.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>Contrarian · the lonely winners</div>
          {contrarian.map(c => (
            <div key={c.symbol} style={row}>
              <span style={{ fontWeight: 700, color: tokens.textPrimary }}>{c.symbol}</span>
              <span style={{ flex: 1, color: tokens.textFaint }}>{(c.names || []).join(', ')}</span>
              <span style={{ fontWeight: 700, color: '#10b981' }}>+{c.bestComposite}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
