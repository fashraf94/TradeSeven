/* eslint-disable react-refresh/only-export-components -- pure helpers co-located with the surface that consumes them, by design (the LeagueParts precedent) */
// src/components/League/backing/YourBacking.jsx
//
// Backing Beta PR 4 — SURFACE D, Your Backing, Monday–Friday (spec V1.3 §5
// "Your Backing (from close through Friday)", D-r; design brief §2.D "make
// the week you have points on worth watching", rev2 §3 the Monday draft
// reveal). The design's `backing-week.jsx` was not in the attached bundle;
// this surface is built from the briefs' contract with the bundle's DayTrail
// and the League's standing rows.
//
// ONE CARD PER BACKED POD: the team(s) backed, where the pod stands (the
// banked composites through the tournament's own comparator), day N of 5 on
// the design's rail (the team's rank at each banked close), and one tap into
// the tape. THE MONDAY DRAFT REVEAL: once the pod's drafts land, the backed
// team's starting picks, both layers — the human's three from the group doc
// (authed-read, written by Monday's resolution) and the agent's six from the
// spectator projection's public WHAT (`agentContext.initialPortfolio` is on
// the non-owner allowlist). Public WHAT, never WHY.
//
// NO STAKE ACTIONS ANYWHERE ON THIS SURFACE (§5, D-r): backing is closed for
// the week; the test asserts no Confirm, no Back button, no amount input.
//
// EVERY TEAM IS NAMED BY THE SERVER (Amendment C §C1, D-af): the stake rows and
// the standing rows show the team's `label` (its primary agent's name) from
// `inPlay.labelsById` — GET /api/backing/team-labels through useMyBacking —
// and the two-layer reveal names the player and the agent APART from the
// server's `player` / `agent` (RAWID-R-2), never guessed from a lone label.
// Nothing here composes a name from an id; while a pod's names are on their
// way its teams read the pending placeholder, and a team the server's names
// do not carry reads "Unnamed team" (WIRING-5).
//
// THE DESKTOP LAYOUT (`layout="desktop"` — Backing desktop layouts; Monday–
// Friday takes the whole screen, as designed): the same cards, wide, in a
// grid — the backed teams on top, the two-layer reveal beside where the pod
// stands and its day trail. ONE derivation feeds both layouts
// (weekCardModel), so the two can never say two things about one pod
// (BUILD_RULES §9). No stake action on either. Mobile is the markup main ships
// (backingMobilePin.test.jsx).

import React from 'react';
import { GROUP_STATUS, computeComposite } from '../../../constants/leagueTournament';
import { LTOKENS, LX, alpha } from '../leagueTokens';
import { Eyebrow, Mono, Icon, LIcon, Tag, Score } from '../LeagueParts';
import { baseGroupName } from '../leagueAdapter';
import useSpectatedTournamentBattles from '../../../hooks/useSpectatedTournamentBattles';
import { DayTrail } from './BackingParts';
import { CARD, WEEK } from './backingCopy';
import { podDayOfFive, podStanding, podTeamLabel, podTeamLayers, weekDayOfFive } from './backingStripState';

const SETTLED = new Set(['resolved', 'insufficient', 'refunded']);
const card = { borderRadius: 18, padding: '13px 14px', background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` };

/** The team's rank at each banked close so far — the design's five-stop rail. */
export function dayTrailFor(group, odUserId) {
  const trail = [];
  let through = 0;
  const order = (group?.players || []).map((p) => p?.odUserId).filter(Boolean);
  for (let n = 1; n <= 5; n += 1) {
    const entry = group?.dailyScores?.[`day${n}`];
    if (!entry) break;
    through = n;
    const cs = entry.closeScores || {};
    const scored = order
      .filter((id) => cs[id])
      .map((id) => [id, Number.isFinite(cs[id].compositePoints) ? cs[id].compositePoints : computeComposite(cs[id].agentPoints ?? 0, cs[id].totalPoints ?? 0)])
      .sort((a, b) => (b[1] - a[1]) || (order.indexOf(a[0]) - order.indexOf(b[0])));
    const idx = scored.findIndex(([id]) => id === odUserId);
    trail.push(idx >= 0 ? idx + 1 : null);
  }
  return { trail, through };
}

/**
 * The agent's six as they STAND — the projected battle's current book (public
 * WHAT), or the day's opening book until the current one is written. Never
 * labelled as Monday's draft: each weekday's battle opens on the book the
 * prior day closed with (FAB-2 / DOM-5, the PR 4 review record).
 */
export function agentSixFor(battle) {
  const pf = battle?.portfolio ?? battle?.agentContext?.initialPortfolio;
  const out = [];
  for (const tier of ['star', 'core', 'support']) {
    for (const h of Array.isArray(pf?.[tier]) ? pf[tier] : []) {
      const symbol = h && (h.symbol || h.ticker);
      if (symbol) out.push(symbol);
    }
  }
  return out;
}

/** The human's three from the group doc — present once Monday's resolution has written them. */
export function humanPicksFor(group, odUserId) {
  const player = (group?.players || []).find((p) => p?.odUserId === odUserId);
  const picks = Array.isArray(player?.picks) ? player.picks : [];
  return picks
    .filter((p) => p && typeof p.symbol === 'string')
    .map((p) => ({ symbol: p.symbol, direction: p.legs?.[p.legs.length - 1]?.direction === 'short' ? 'short' : 'long' }));
}

function Chips({ symbols }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {symbols.map((s) => (
        <span key={s.symbol ?? s} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 7, background: alpha(LTOKENS.bg, 0.5), border: `1px solid ${LTOKENS.hair}` }}>
          <Mono style={{ fontSize: 11.5, fontWeight: 700, color: s.direction === 'short' ? LX.alert : LTOKENS.ink }}>{s.symbol ?? s}</Mono>
        </span>
      ))}
    </div>
  );
}

/**
 * The facts ONE week card shows, derived once for both layouts: the pod's
 * name, settled / settling, the standing, each backed team's summed amount and
 * stake status, the day trail of the first backed team, the status label, and
 * the two-layer reveal per backed team (the SERVER's `player` / `agent`,
 * never guessed from a lone label — RAWID-R-2). Pure.
 */
export function weekCardModel({ groupId, stakes, pool, group, labelsById, battles }) {
  const podName = baseGroupName(groupId);
  // The server's `{ label, secondary }` for a seat of this pod (D-af).
  const named = (id) => podTeamLabel(labelsById, groupId, id);
  // Settled is the POOL's fact — a complete pod whose pool has not resolved
  // is settling, not settled (FAB-1, the PR 4 review record).
  const settled = SETTLED.has(pool?.status);
  const settling = !settled && group?.status === GROUP_STATUS.COMPLETE;
  const standing = group ? podStanding(group) : [];
  const amounts = new Map();
  const statuses = new Map();
  for (const s of stakes) {
    amounts.set(s.teamOdUserId, (amounts.get(s.teamOdUserId) ?? 0) + (Number.isFinite(s.amount) ? s.amount : 0));
    statuses.set(s.teamOdUserId, [...(statuses.get(s.teamOdUserId) ?? []), typeof s.status === 'string' ? s.status : 'live']);
  }
  // A stake that is no longer live says so beside its amount (DOM-6): any
  // void on the team reads void; a team whose stakes have all resolved reads settled.
  const stakeStatus = (id) => {
    const list = statuses.get(id) ?? [];
    if (list.includes('voided')) return WEEK.stakeStatus.voided;
    if (list.length > 0 && list.every((x) => x === 'won' || x === 'lost')) return WEEK.stakeStatus.won;
    return null;
  };
  const teams = [...amounts.keys()];
  const first = teams[0] ?? null;
  const { trail, through } = group && first ? dayTrailFor(group, first) : { trail: [], through: 0 };
  const statusLabel = settled ? WEEK.settled : settling ? WEEK.status.settling : group?.status === GROUP_STATUS.BATTLE ? WEEK.status.battle : WEEK.status.awaiting;
  const reveal = teams.map((id) => {
    // The two layers, named apart — the SERVER's `player` and `agent`,
    // never guessed from a lone label (RAWID-R-2): a label with no
    // secondary may be either layer. The agent is the server's belted
    // name, not the battle record's raw one (RAWID-2).
    const { player: name, agent } = podTeamLayers(labelsById, groupId, id);
    const battle = battles?.[id] ?? null;
    return { id, name, agentName: agent ?? CARD.agentFallbackName(name), picks: humanPicksFor(group, id), six: agentSixFor(battle) };
  });
  return { podName, named, settled, standing, amounts, stakeStatus, teams, first, trail, through, statusLabel, reveal };
}

/** One backed team's reveal — the human's three and the agent's six, both layers (public WHAT). */
function RevealBlock({ r }) {
  if (r.picks.length === 0 && r.six.length === 0) {
    return <div style={{ fontSize: 12.5, color: LTOKENS.ink3 }}>{WEEK.revealPending}</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: LTOKENS.ink }}>{WEEK.revealSub(r.name, r.agentName)}</div>
      {r.picks.length > 0 ? (
        <div>
          <Mono style={{ fontSize: 9.5, color: LTOKENS.ink2, letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>{WEEK.revealHuman(r.name)}</Mono>
          <Chips symbols={r.picks} />
        </div>
      ) : <Mono style={{ fontSize: 10.5, color: LTOKENS.ink3 }}>{WEEK.humanPending}</Mono>}
      {r.six.length > 0 ? (
        <div>
          <Mono style={{ fontSize: 9.5, color: LTOKENS.ink2, letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>{WEEK.revealAgent(r.agentName)}</Mono>
          <Chips symbols={r.six} />
        </div>
      ) : <Mono style={{ fontSize: 10.5, color: LTOKENS.ink3 }}>{WEEK.agentPending(r.agentName)}</Mono>}
    </div>
  );
}

/** Where the pod stands — the ranked rows, or the plain "after the first close" line. */
function StandingRows({ m, spaced = true }) {
  if (!(m.through > 0 && m.standing.length > 0)) {
    return <Mono style={{ display: 'block', fontSize: 11, color: LTOKENS.ink3, marginBottom: spaced ? 10 : 0 }}>{WEEK.noStanding}</Mono>;
  }
  return (
    <div data-backing="week-standing" style={{ marginBottom: spaced ? 10 : 0 }}>
      {m.standing.map((row) => {
        const backed = m.amounts.has(row.odUserId);
        return (
          <div key={row.odUserId} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 2px', opacity: backed ? 1 : 0.7 }}>
            <Mono style={{ fontSize: 12, fontWeight: 700, width: 14, textAlign: 'center', color: row.rank === 1 ? LTOKENS.gold : LTOKENS.ink3 }}>{row.rank}</Mono>
            <span style={{ flex: 1, fontSize: 12.5, fontWeight: backed ? 700 : 500, color: LTOKENS.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.named(row.odUserId).label}</span>
            <Score v={Number.isFinite(row.score) ? row.score : 0} size={12} />
          </div>
        );
      })}
    </div>
  );
}

function WeekCard({ groupId, stakes, pool, group, labelsById, accent, onOpenTape, injectedBattles = null }) {
  // The live read, unless the host handed this pod's battles in (only the dev
  // preview page does — fixtures, no network): then the hook stays disabled.
  const spectated = useSpectatedTournamentBattles(groupId, injectedBattles == null);
  const battles = injectedBattles ?? spectated.battles;
  const m = weekCardModel({ groupId, stakes, pool, group, labelsById, battles });

  return (
    <div data-backing="week-card" data-group={groupId} style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.01em' }}>{m.podName}</span>
        <Tag color={m.settled ? LTOKENS.gold : accent}>{m.statusLabel}</Tag>
      </div>

      <Mono style={{ fontSize: 9, color: LTOKENS.ink3, letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>{WEEK.backed}</Mono>
      <div data-backing="week-stakes" style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
        {m.teams.map((id) => (
          <Mono key={id} style={{ fontSize: 12, color: LTOKENS.ink }}>{WEEK.stakeRow(m.named(id).label, m.amounts.get(id), m.stakeStatus(id))}</Mono>
        ))}
      </div>

      <Mono style={{ fontSize: 9, color: LTOKENS.ink3, letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>{WEEK.standing}</Mono>
      <StandingRows m={m} />

      <DayTrail trail={m.trail} through={m.through} color={accent} />

      <div data-backing="week-reveal" style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${LTOKENS.hair}` }}>
        <Eyebrow color={accent} style={{ marginBottom: 6 }}>{WEEK.revealTitle}</Eyebrow>
        {m.reveal.map((r) => <RevealBlock key={r.id} r={r} />)}
      </div>

      {onOpenTape && m.first && (
        <button type="button" className="lg-tap" data-backing="week-tape" onClick={() => onOpenTape(groupId, m.first)} style={{ all: 'unset', cursor: 'pointer', marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, color: accent }}>
          <Mono style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em' }}>{WEEK.tape}</Mono><Icon name="arrowR" size={13} color={accent} />
        </button>
      )}
    </div>
  );
}

/** The desktop card — the same model, wide: the backed teams on top, the reveal beside the standing. */
function WeekCardDesk({ groupId, stakes, pool, group, labelsById, accent, onOpenTape, injectedBattles = null }) {
  const spectated = useSpectatedTournamentBattles(groupId, injectedBattles == null);
  const battles = injectedBattles ?? spectated.battles;
  const m = weekCardModel({ groupId, stakes, pool, group, labelsById, battles });
  const label = { fontSize: 9, color: LTOKENS.ink3, letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 };

  return (
    <div data-backing="week-card" data-group={groupId} data-layout="desktop" style={{ ...card, padding: '16px 18px 14px', display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.01em' }}>{m.podName}</span>
        <Tag color={m.settled ? LTOKENS.gold : accent}>{m.statusLabel}</Tag>
      </div>

      <div style={{ padding: '10px 13px', borderRadius: 13, background: alpha(accent, 0.07), border: `1px solid ${alpha(accent, 0.28)}` }}>
        <Mono style={label}>{WEEK.backed}</Mono>
        <div data-backing="week-stakes" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {m.teams.map((id) => (
            <Mono key={id} style={{ fontSize: 13, fontWeight: 600, color: LTOKENS.ink }}>{WEEK.stakeRow(m.named(id).label, m.amounts.get(id), m.stakeStatus(id))}</Mono>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)', gap: 18 }}>
        <div data-backing="week-reveal" style={{ minWidth: 0 }}>
          <Eyebrow color={accent} style={{ marginBottom: 8 }}>{WEEK.revealTitle}</Eyebrow>
          {m.reveal.map((r) => <RevealBlock key={r.id} r={r} />)}
        </div>
        <div style={{ minWidth: 0 }}>
          <Mono style={label}>{WEEK.standing}</Mono>
          <DayTrail trail={m.trail} through={m.through} color={accent} />
          <div style={{ marginTop: 8 }}><StandingRows m={m} spaced={false} /></div>
        </div>
      </div>

      {onOpenTape && m.first && (
        <button type="button" className="lg-tap" data-backing="week-tape" onClick={() => onOpenTape(groupId, m.first)} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 12, background: LTOKENS.raised, border: `1px solid ${LTOKENS.hair2}`, color: accent }}>
          <LIcon name="play" size={12} color={accent} />
          <Mono style={{ flex: 1, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em' }}>{WEEK.tape}</Mono>
          <Icon name="arrowR" size={14} color={LTOKENS.ink2} />
        </button>
      )}
    </div>
  );
}

/** The backed pods of the current week whose pools are no longer open, in play or settled. */
export function backedPodsFor(inPlay) {
  const byGroup = new Map();
  for (const stake of Array.isArray(inPlay?.stakes) ? inPlay.stakes : []) {
    if (!stake || typeof stake.groupId !== 'string') continue;
    const pool = inPlay?.poolsById?.[stake.groupId] ?? null;
    if (pool?.status === 'open') continue;
    if (pool == null) continue;
    const list = byGroup.get(stake.groupId) ?? [];
    list.push(stake);
    byGroup.set(stake.groupId, list);
  }
  return [...byGroup.entries()].map(([groupId, stakes]) => ({ groupId, stakes }));
}

/**
 * `battlesByGroup` (optional) — { groupId: battlesByOwner } handed in by the
 * host INSTEAD of the live spectator read: when it is passed, every card takes
 * its battles from it (a pod it does not name has none) and no card polls.
 * Only the dev preview page passes it; omitted, every card polls the battle
 * view exactly as before.
 */
export default function YourBacking({ inPlay, accent = LX.energy, onOpenTape, now = new Date(), battlesByGroup = null, layout = 'mobile' }) {
  const pods = backedPodsFor(inPlay);
  if (pods.length === 0) return null;
  const allSettled = pods.every(({ groupId }) => SETTLED.has(inPlay?.poolsById?.[groupId]?.status));
  const allComplete = !allSettled && pods.every(({ groupId }) => SETTLED.has(inPlay?.poolsById?.[groupId]?.status) || inPlay?.groupsById?.[groupId]?.status === GROUP_STATUS.COMPLETE);
  // The day from the pods' own banking record (the League's reading — FAB-9); the calendar only while no pod document has been read.
  const dayOfFive = pods.reduce((best, { groupId }) => { const d = podDayOfFive(inPlay?.groupsById?.[groupId] ?? null, now); return d == null ? best : Math.max(best ?? 0, d); }, null) ?? weekDayOfFive(now);
  // No backed pod has started (every one locked in ahead of its Monday): no battle day to count (R-B-2).
  const noneStarted = pods.every(({ groupId }) => { const st = inPlay?.groupsById?.[groupId]?.status; return st != null && st !== GROUP_STATUS.BATTLE && st !== GROUP_STATUS.COMPLETE; });
  const sub = allSettled ? WEEK.settledSub : allComplete ? WEEK.settlingSub : noneStarted ? WEEK.lockedSub : WEEK.sub(dayOfFive);
  if (layout === 'desktop') {
    return (
      <div data-backing="your-backing-section" data-layout="desktop" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <Eyebrow color={accent} style={{ marginBottom: 5 }}>{WEEK.title}</Eyebrow>
          <Mono style={{ fontSize: 11.5, color: LTOKENS.ink2 }}>{sub}</Mono>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(520px, 1fr))', gap: 20 }}>
          {pods.map(({ groupId, stakes }) => (
            <WeekCardDesk
              key={groupId}
              groupId={groupId}
              stakes={stakes}
              pool={inPlay?.poolsById?.[groupId] ?? null}
              group={inPlay?.groupsById?.[groupId] ?? null}
              labelsById={inPlay?.labelsById ?? null}
              accent={accent}
              onOpenTape={onOpenTape}
              injectedBattles={battlesByGroup ? (battlesByGroup[groupId] ?? {}) : null}
            />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div data-backing="your-backing-section" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <Eyebrow color={accent} style={{ marginBottom: 4 }}>{WEEK.title}</Eyebrow>
        <Mono style={{ fontSize: 10.5, color: LTOKENS.ink3 }}>{sub}</Mono>
      </div>
      {pods.map(({ groupId, stakes }) => (
        <WeekCard
          key={groupId}
          groupId={groupId}
          stakes={stakes}
          pool={inPlay?.poolsById?.[groupId] ?? null}
          group={inPlay?.groupsById?.[groupId] ?? null}
          labelsById={inPlay?.labelsById ?? null}
          accent={accent}
          onOpenTape={onOpenTape}
          injectedBattles={battlesByGroup ? (battlesByGroup[groupId] ?? {}) : null}
        />
      ))}
    </div>
  );
}
