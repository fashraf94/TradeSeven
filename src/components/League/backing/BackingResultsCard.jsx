/* eslint-disable react-refresh/only-export-components -- pure helpers co-located with the surface that consumes them, by design (the LeagueParts precedent) */
// src/components/League/backing/BackingResultsCard.jsx
//
// Backing Beta PR 5 — SURFACE E, the results card (spec V1.3 §5 "Results
// card (after settlement), in the Spectate final state"; §3 the reveal and
// the exact-fact labels; §4 the loadout-changed marker; §7 the refund paths;
// §9 honesty; design brief §E). Mobile layout. Pure over the projection
// GET /api/backing/results returns for one pod — no hook, no fetch, no
// Firestore: every number on this card is the pool document's or the stake
// document's, through the server (BUILD_RULES §9):
//   · the winner(s), from the pool's recorded winning set;
//   · the viewer's stakes and the payout PER STAKE — `stake.payout`, never
//     stake × pays × (the two disagree by design; BackingResultsCard.test.jsx
//     pins the document's figure against the product);
//   · now revealed, per team: backers, the share of BP labeled EXACTLY as §3
//     labels it ("62% of BP in this pool backed them" — never a crowd
//     probability), and pays × from §3's own table (`null` for an unbacked
//     team, rendered as "no backers");
//   · the loadout-changed marker on the viewer's own stakes (§4 — disclosure);
//   · a refunded or insufficient pool stated plainly with its reason, and its
//     score-neutrality stated with it.
// EVERY NAME IS THE SERVER'S (Amendment C §C1, D-af): the winner line reads
// the projection's `winnerLabels`, each team row its `label` (the primary
// agent's — after settlement, the agent settlement recorded) with the player
// as `secondary`, each of the viewer's stakes its `teamLabel`. The card never
// maps an id to a name; a name the projection does not carry reads "Unnamed
// team" (the pre-flip card printed the raw uid — HON-17).
// Tokens only (BUILD_RULES §10); no inline transition literal (§11).
//
// THE DESKTOP CARD (BackingResultsCardDesk — Backing desktop layouts; Friday's
// results take the whole screen, as designed): the same facts laid out as a
// table — Team · Backers · Share · Pays × — with §3's exact phrases in the
// cells (the share stays "N% of BP in this pool backed them", never a bare
// percentage). ONE derivation feeds both cards (resultsCardModel), so the two
// layouts cannot disagree about a pool (BUILD_RULES §9). Mobile is the markup
// main ships (backingMobilePin.test.jsx).

import React from 'react';
import { LTOKENS, LX, alpha } from '../leagueTokens';
import { Mono, Icon, Tag, AgentAvatar } from '../LeagueParts';
import { baseGroupName, seatColor } from '../leagueAdapter';
import { MonoAttr } from './BackingParts';
import { DESK, RESULTS, bp } from './backingCopy';
import { teamLabelOf } from './backingStripState';
import { GROUP_STATUS } from '../../../constants/leagueTournament';

/** A pod with nothing left to play: complete, voided, expired — or gone. */
const podDone = (podStatus) => podStatus == null || podStatus === GROUP_STATUS.COMPLETE || podStatus === GROUP_STATUS.VOIDED || podStatus === GROUP_STATUS.EXPIRED;

const card = { borderRadius: 18, padding: '13px 14px', background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` };
const sectionLabel = { fontSize: 9, color: LTOKENS.ink3, letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 5 };

/** The words for ONE stake's outcome — from its status and its own payout. */
export function stakeOutcomeWords(stake) {
  switch (stake?.status) {
    case 'won': return Number.isFinite(stake.payout) ? RESULTS.paid(stake.payout) : RESULTS.paidUnknown;
    case 'lost': return RESULTS.lost;
    case 'voided': return RESULTS.voided;
    default: return RESULTS.pending;
  }
}

/** The outcome's colour: gold once settled, quiet for a void, the accent while settling. */
function outcomeColor(outcome, accent) {
  if (outcome === 'settled') return LTOKENS.gold;
  if (outcome === 'refunded' || outcome === 'insufficient') return LTOKENS.ink3;
  return accent;
}

function LoadoutMark({ changed }) {
  if (changed === true) {
    return (
      <span data-backing="loadout-changed" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Icon name="pulse" size={10} color={LTOKENS.gold} />
        <Mono style={{ fontSize: 9.5, color: LTOKENS.gold, letterSpacing: '0.04em' }}>{RESULTS.loadoutChanged}</Mono>
      </span>
    );
  }
  if (changed === false) return <Mono style={{ fontSize: 9.5, color: LTOKENS.ink3, letterSpacing: '0.04em' }}>{RESULTS.loadoutSame}</Mono>;
  return null;
}

/**
 * The facts ONE results card shows, derived once for both layouts — every one
 * the projection's own (BUILD_RULES §9). Pure.
 */
export function resultsCardModel(pod) {
  const settled = pod.outcome === 'settled';
  const voided = pod.outcome === 'refunded' || pod.outcome === 'insufficient';
  const winners = Array.isArray(pod.winners) ? pod.winners : [];
  // The winner line's names are the server's, one per winner in the winning
  // set's order — a missing one reads the neutral name, never the winner's id.
  const winnerNames = winners.map((_, i) => teamLabelOf(Array.isArray(pod.winnerLabels) ? pod.winnerLabels[i] : null));
  const mine = Array.isArray(pod.myStakes) ? pod.myStakes : [];
  const teams = Array.isArray(pod.teams) ? pod.teams : [];
  const revealed = Number.isFinite(pod.potTotal);
  const reasonKey = pod.outcome === 'insufficient' ? 'insufficient' : pod.refundReason;
  const first = mine[0]?.teamOdUserId ?? winners[0] ?? null;
  // The right-hand figure: before a settlement the team's staked BP; after
  // it, the WINNING set's realized ratio (`pod.paysX`, one figure for every
  // winner — a tie pays every winner the same) and, for every other team,
  // §3's conditional table figure. Never a zero for a figure the document
  // does not carry.
  const paysCell = (t) => {
    const won = t.won === true;
    if (!settled) return Number.isFinite(t.stakeTotal) ? `${bp(t.stakeTotal)} BP` : RESULTS.unknown;
    if (won) return Number.isFinite(pod.paysX) ? RESULTS.paidX(pod.paysX) : RESULTS.paidUnknown;
    return Number.isFinite(t.paysX) ? RESULTS.wouldPay(t.paysX) : RESULTS.noBackers;
  };
  return { settled, voided, winners, winnerNames, mine, teams, revealed, reasonKey, first, paysCell };
}

export default function BackingResultsCard({ pod, accent = LX.energy, onOpenTape = null }) {
  if (!pod || typeof pod !== 'object') return null;
  const { settled, voided, winners, winnerNames, mine, teams, revealed, reasonKey, first, paysCell: paysCellFor } = resultsCardModel(pod);
  const color = outcomeColor(pod.outcome, accent);

  return (
    <div data-backing="results-card" data-outcome={pod.outcome ?? 'unknown'} data-group={pod.groupId} style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.01em' }}>{baseGroupName(pod.groupId)}</span>
        <Tag color={color}>{RESULTS.outcome[pod.outcome] ?? RESULTS.outcome.settling}</Tag>
      </div>

      {settled && (
        <div data-backing="results-winner" style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: LTOKENS.ink, lineHeight: 1.2 }}>{winners.length > 0 ? RESULTS.winner(winnerNames) : RESULTS.noWinner}</div>
          {revealed && <Mono style={{ fontSize: 10.5, color: LTOKENS.ink2, display: 'block', marginTop: 3 }}>{RESULTS.pot(pod.potTotal, pod.uniqueBackers)}</Mono>}
        </div>
      )}
      {voided && (
        <div data-backing="results-reason" style={{ marginBottom: 10, padding: '9px 11px', borderRadius: 11, background: alpha(LTOKENS.bg, 0.5), border: `1px dashed ${LTOKENS.hair2}` }}>
          <div style={{ fontSize: 12.5, color: LTOKENS.ink, lineHeight: 1.45 }}>{RESULTS.reason[reasonKey] ?? RESULTS.reasonFallback}</div>
          <div style={{ fontSize: 11.5, color: LTOKENS.ink3, lineHeight: 1.45, marginTop: 3 }}>{RESULTS.neutral}</div>
        </div>
      )}
      {pod.outcome === 'settling' && (
        <div data-backing="results-settling" style={{ marginBottom: 10, fontSize: 12.5, color: LTOKENS.ink2, lineHeight: 1.45 }}>{pod.holdReason ? RESULTS.held : podDone(pod.podStatus) ? RESULTS.settling : RESULTS.settlingInPlay}</div>
      )}

      <Mono style={sectionLabel}>{RESULTS.yourStakes}</Mono>
      {mine.length === 0 ? (
        <Mono style={{ display: 'block', fontSize: 11, color: LTOKENS.ink3, marginBottom: 10 }}>{RESULTS.noStakes}</Mono>
      ) : (
        <div data-backing="results-stakes" style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
          {mine.map((s) => (
            <div key={s.stakeId ?? `${s.teamOdUserId}-${s.amount}`} data-backing="results-stake" data-status={s.status} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Mono style={{ fontSize: 12, color: LTOKENS.ink }}>{RESULTS.stakeRow(teamLabelOf(s.teamLabel), s.amount)}</Mono>
              <MonoAttr data-backing="results-payout" style={{ fontSize: 12, fontWeight: 700, color: s.status === 'won' ? LTOKENS.gold : LTOKENS.ink3 }}>{stakeOutcomeWords(s)}</MonoAttr>
              {settled && <LoadoutMark changed={s.loadoutChanged} />}
            </div>
          ))}
          {Number.isFinite(pod.myNet) && (
            <MonoAttr data-backing="results-net" style={{ fontSize: 12.5, fontWeight: 700, color: pod.myNet >= 0 ? LTOKENS.gold : LX.neg }}>{RESULTS.net(pod.myNet)}</MonoAttr>
          )}
        </div>
      )}

      {revealed && teams.length > 0 && (
        <div data-backing="results-teams">
          <Mono style={sectionLabel}>{RESULTS.teams}</Mono>
          {teams.map((t) => {
            const name = teamLabelOf(t);
            const secondary = typeof t.secondary === 'string' && t.secondary.length > 0 ? t.secondary : null;
            const won = t.won === true;
            const paysCell = paysCellFor(t);
            return (
              <div key={t.odUserId} data-backing="results-team" data-won={won ? 'true' : 'false'} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0', borderTop: `1px solid ${LTOKENS.hair}` }}>
                <AgentAvatar agent={{ kind: t.isCpu ? 'cpu' : 'human', color: seatColor(t.odUserId, t.isCpu) }} size={26} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12.5, fontWeight: won ? 700 : 600, color: LTOKENS.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                    {secondary && <span data-backing="results-team-secondary" style={{ fontSize: 11, color: LTOKENS.ink3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{secondary}</span>}
                    {won && <Tag color={LTOKENS.gold}>{RESULTS.won}</Tag>}
                  </div>
                  <Mono style={{ fontSize: 9.5, color: LTOKENS.ink3, display: 'block', marginTop: 2 }}>
                    {Number.isFinite(t.backerCount) ? RESULTS.backers(t.backerCount) : RESULTS.unknown}{Number.isFinite(t.sharePct) ? ` · ${RESULTS.share(t.sharePct)}` : ''}
                  </Mono>
                </div>
                <MonoAttr data-backing="results-pays" style={{ fontSize: 10.5, color: settled && won ? LTOKENS.gold : LTOKENS.ink3, whiteSpace: 'nowrap' }}>{paysCell}</MonoAttr>
              </div>
            );
          })}
        </div>
      )}

      {onOpenTape && first && settled && (
        <button type="button" className="lg-tap" data-backing="results-tape" onClick={() => onOpenTape(pod.groupId, first)} style={{ all: 'unset', cursor: 'pointer', marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, color: accent }}>
          <Mono style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em' }}>{RESULTS.tape}</Mono><Icon name="arrowR" size={13} color={accent} />
        </button>
      )}
    </div>
  );
}

/** The desktop card — the same model, as a table (Team · Backers · Share · Pays ×, or BP backed before a settlement). */
export function BackingResultsCardDesk({ pod, accent = LX.energy, onOpenTape = null }) {
  if (!pod || typeof pod !== 'object') return null;
  const { settled, voided, winners, winnerNames, mine, teams, revealed, reasonKey, first, paysCell } = resultsCardModel(pod);
  const color = outcomeColor(pod.outcome, accent);
  // The team column keeps room for a name at the narrowest desktop widths (PLACE-6); the share phrase wraps.
  const cols = 'minmax(140px, 1.4fr) 96px minmax(0, 1.3fr) 128px';
  const head = { fontSize: 9, color: LTOKENS.ink3, letterSpacing: '0.12em', textTransform: 'uppercase' };

  return (
    <div data-backing="results-card" data-layout="desktop" data-outcome={pod.outcome ?? 'unknown'} data-group={pod.groupId} style={{ ...card, padding: '16px 18px 10px', minWidth: 0, background: settled && pod.myWon === true ? `linear-gradient(165deg, ${alpha(LTOKENS.gold, 0.08)}, ${LTOKENS.surface} 60%)` : LTOKENS.surface }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.01em' }}>{baseGroupName(pod.groupId)}</span>
          <Tag color={color}>{RESULTS.outcome[pod.outcome] ?? RESULTS.outcome.settling}</Tag>
        </div>
        {settled && revealed && <Mono style={{ fontSize: 11, color: LTOKENS.ink2 }}>{RESULTS.pot(pod.potTotal, pod.uniqueBackers)}</Mono>}
      </div>

      {settled && (
        <div data-backing="results-winner" style={{ fontSize: 16, fontWeight: 700, color: LTOKENS.ink, lineHeight: 1.25, marginBottom: 12 }}>{winners.length > 0 ? RESULTS.winner(winnerNames) : RESULTS.noWinner}</div>
      )}
      {voided && (
        <div data-backing="results-reason" style={{ marginBottom: 12, padding: '9px 11px', borderRadius: 11, background: alpha(LTOKENS.bg, 0.5), border: `1px dashed ${LTOKENS.hair2}` }}>
          <div style={{ fontSize: 12.5, color: LTOKENS.ink, lineHeight: 1.45 }}>{RESULTS.reason[reasonKey] ?? RESULTS.reasonFallback}</div>
          <div style={{ fontSize: 11.5, color: LTOKENS.ink3, lineHeight: 1.45, marginTop: 3 }}>{RESULTS.neutral}</div>
        </div>
      )}
      {pod.outcome === 'settling' && (
        <div data-backing="results-settling" style={{ marginBottom: 12, fontSize: 12.5, color: LTOKENS.ink2, lineHeight: 1.45 }}>{pod.holdReason ? RESULTS.held : podDone(pod.podStatus) ? RESULTS.settling : RESULTS.settlingInPlay}</div>
      )}

      <Mono style={sectionLabel}>{RESULTS.yourStakes}</Mono>
      {mine.length === 0 ? (
        <Mono style={{ display: 'block', fontSize: 11, color: LTOKENS.ink3, marginBottom: 12 }}>{RESULTS.noStakes}</Mono>
      ) : (
        <div data-backing="results-stakes" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {mine.map((s) => (
            <div key={s.stakeId ?? `${s.teamOdUserId}-${s.amount}`} data-backing="results-stake" data-status={s.status} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Mono style={{ fontSize: 12.5, color: LTOKENS.ink }}>{RESULTS.stakeRow(teamLabelOf(s.teamLabel), s.amount)}</Mono>
              <MonoAttr data-backing="results-payout" style={{ fontSize: 12.5, fontWeight: 700, color: s.status === 'won' ? LTOKENS.gold : LTOKENS.ink3 }}>{stakeOutcomeWords(s)}</MonoAttr>
              {settled && <LoadoutMark changed={s.loadoutChanged} />}
            </div>
          ))}
          {Number.isFinite(pod.myNet) && (
            <MonoAttr data-backing="results-net" style={{ fontSize: 13, fontWeight: 700, color: pod.myNet >= 0 ? LTOKENS.gold : LX.neg }}>{RESULTS.net(pod.myNet)}</MonoAttr>
          )}
        </div>
      )}

      {revealed && teams.length > 0 && (
        <div data-backing="results-teams">
          <Mono style={sectionLabel}>{RESULTS.teams}</Mono>
          <div style={{ display: 'grid', gridTemplateColumns: cols, columnGap: 12, padding: '4px 0 6px', borderBottom: `1px solid ${LTOKENS.hair}` }}>
            <Mono style={head}>{DESK.resultsCols.team}</Mono>
            <Mono style={{ ...head, textAlign: 'right' }}>{DESK.resultsCols.backers}</Mono>
            <Mono style={{ ...head, textAlign: 'right' }}>{DESK.resultsCols.share}</Mono>
            {/* The head names what the cells hold: the ratio once settled, the staked BP before (WIRE-6). */}
            <Mono style={{ ...head, textAlign: 'right' }}>{settled ? DESK.resultsCols.pays : DESK.resultsCols.backed}</Mono>
          </div>
          {teams.map((t, i) => {
            const name = teamLabelOf(t);
            const secondary = typeof t.secondary === 'string' && t.secondary.length > 0 ? t.secondary : null;
            const won = t.won === true;
            return (
              <div key={t.odUserId} data-backing="results-team" data-won={won ? 'true' : 'false'} style={{ display: 'grid', gridTemplateColumns: cols, columnGap: 12, alignItems: 'center', padding: '8px 0', borderBottom: i < teams.length - 1 ? `1px solid ${LTOKENS.hair}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                  <AgentAvatar agent={{ kind: t.isCpu ? 'cpu' : 'human', color: seatColor(t.odUserId, t.isCpu) }} size={26} />
                  <span style={{ fontSize: 13, fontWeight: won ? 700 : 600, color: LTOKENS.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                  {secondary && <span data-backing="results-team-secondary" style={{ fontSize: 11, color: LTOKENS.ink3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{secondary}</span>}
                  {won && <Tag color={LTOKENS.gold}>{RESULTS.won}</Tag>}
                </div>
                <Mono style={{ fontSize: 11, color: LTOKENS.ink2, textAlign: 'right' }}>{Number.isFinite(t.backerCount) ? RESULTS.backers(t.backerCount) : RESULTS.unknown}</Mono>
                <Mono style={{ fontSize: 10.5, color: LTOKENS.ink2, textAlign: 'right', lineHeight: 1.35 }}>{Number.isFinite(t.sharePct) ? RESULTS.share(t.sharePct) : RESULTS.unknown}</Mono>
                <MonoAttr data-backing="results-pays" style={{ fontSize: 11, color: settled && won ? LTOKENS.gold : LTOKENS.ink3, textAlign: 'right', whiteSpace: 'nowrap' }}>{paysCell(t)}</MonoAttr>
              </div>
            );
          })}
        </div>
      )}

      {onOpenTape && first && settled && (
        <button type="button" className="lg-tap" data-backing="results-tape" onClick={() => onOpenTape(pod.groupId, first)} style={{ all: 'unset', cursor: 'pointer', margin: '10px 0 4px', display: 'flex', alignItems: 'center', gap: 6, color: accent }}>
          <Mono style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em' }}>{RESULTS.tape}</Mono><Icon name="arrowR" size={13} color={accent} />
        </button>
      )}
    </div>
  );
}
