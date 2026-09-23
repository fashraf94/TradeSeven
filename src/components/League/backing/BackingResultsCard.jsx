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
// Tokens only (BUILD_RULES §10); no inline transition literal (§11).

import React from 'react';
import { LTOKENS, LX, alpha } from '../leagueTokens';
import { Mono, Icon, Tag, AgentAvatar } from '../LeagueParts';
import { baseGroupName, seatColor } from '../leagueAdapter';
import { MonoAttr } from './BackingParts';
import { RESULTS, bp } from './backingCopy';
import { seatDisplayName } from './backingStripState';

const card = { borderRadius: 18, padding: '13px 14px', background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` };
const sectionLabel = { fontSize: 9, color: LTOKENS.ink3, letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 5 };

/** The words for ONE stake's outcome — from its status and its own payout. */
export function stakeOutcomeWords(stake) {
  switch (stake?.status) {
    case 'won': return RESULTS.paid(stake.payout ?? 0);
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

export default function BackingResultsCard({ pod, accent = LX.energy, onOpenTape = null }) {
  if (!pod || typeof pod !== 'object') return null;
  const names = (id) => seatDisplayName(pod.seatNames, id);
  const settled = pod.outcome === 'settled';
  const voided = pod.outcome === 'refunded' || pod.outcome === 'insufficient';
  const winners = Array.isArray(pod.winners) ? pod.winners : [];
  const mine = Array.isArray(pod.myStakes) ? pod.myStakes : [];
  const teams = Array.isArray(pod.teams) ? pod.teams : [];
  const revealed = Number.isFinite(pod.potTotal);
  const color = outcomeColor(pod.outcome, accent);
  const reasonKey = pod.outcome === 'insufficient' ? 'insufficient' : pod.refundReason;
  const first = mine[0]?.teamOdUserId ?? winners[0] ?? null;

  return (
    <div data-backing="results-card" data-outcome={pod.outcome ?? 'unknown'} data-group={pod.groupId} style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.01em' }}>{baseGroupName(pod.groupId)}</span>
        <Tag color={color}>{RESULTS.outcome[pod.outcome] ?? RESULTS.outcome.settling}</Tag>
      </div>

      {settled && (
        <div data-backing="results-winner" style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: LTOKENS.ink, lineHeight: 1.2 }}>{winners.length > 0 ? RESULTS.winner(winners.map(names)) : RESULTS.noWinner}</div>
          {revealed && <Mono style={{ fontSize: 10.5, color: LTOKENS.ink2, display: 'block', marginTop: 3 }}>{RESULTS.pot(pod.potTotal, pod.uniqueBackers ?? 0)}</Mono>}
        </div>
      )}
      {voided && (
        <div data-backing="results-reason" style={{ marginBottom: 10, padding: '9px 11px', borderRadius: 11, background: alpha(LTOKENS.bg, 0.5), border: `1px dashed ${LTOKENS.hair2}` }}>
          <div style={{ fontSize: 12.5, color: LTOKENS.ink, lineHeight: 1.45 }}>{RESULTS.reason[reasonKey] ?? RESULTS.reasonFallback}</div>
          <div style={{ fontSize: 11.5, color: LTOKENS.ink3, lineHeight: 1.45, marginTop: 3 }}>{RESULTS.neutral}</div>
        </div>
      )}
      {pod.outcome === 'settling' && (
        <div data-backing="results-settling" style={{ marginBottom: 10, fontSize: 12.5, color: LTOKENS.ink2, lineHeight: 1.45 }}>{pod.holdReason ? RESULTS.held : RESULTS.settling}</div>
      )}

      <Mono style={sectionLabel}>{RESULTS.yourStakes}</Mono>
      {mine.length === 0 ? (
        <Mono style={{ display: 'block', fontSize: 11, color: LTOKENS.ink3, marginBottom: 10 }}>{RESULTS.noStakes}</Mono>
      ) : (
        <div data-backing="results-stakes" style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
          {mine.map((s) => (
            <div key={s.stakeId ?? `${s.teamOdUserId}-${s.amount}`} data-backing="results-stake" data-status={s.status} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Mono style={{ fontSize: 12, color: LTOKENS.ink }}>{RESULTS.stakeRow(names(s.teamOdUserId), s.amount)}</Mono>
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
            const name = names(t.odUserId);
            const won = t.won === true;
            return (
              <div key={t.odUserId} data-backing="results-team" data-won={won ? 'true' : 'false'} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0', borderTop: `1px solid ${LTOKENS.hair}` }}>
                <AgentAvatar agent={{ kind: t.isCpu ? 'cpu' : 'human', color: seatColor(t.odUserId, t.isCpu) }} size={26} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12.5, fontWeight: won ? 700 : 600, color: LTOKENS.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                    {won && <Tag color={LTOKENS.gold}>{RESULTS.won}</Tag>}
                  </div>
                  <Mono style={{ fontSize: 9.5, color: LTOKENS.ink3, display: 'block', marginTop: 2 }}>
                    {RESULTS.backers(t.backerCount ?? 0)}{Number.isFinite(t.sharePct) ? ` · ${RESULTS.share(t.sharePct)}` : ''}
                  </Mono>
                </div>
                <MonoAttr data-backing="results-pays" style={{ fontSize: 10.5, color: Number.isFinite(t.paysX) ? LTOKENS.gold : LTOKENS.ink3, whiteSpace: 'nowrap' }}>{settled ? RESULTS.pays(t.paysX) : bp(t.stakeTotal ?? 0) + ' BP'}</MonoAttr>
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
