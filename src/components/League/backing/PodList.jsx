// src/components/League/backing/PodList.jsx
//
// Backing Beta PR 4 — SURFACE A, the upcoming pods (spec V1.3 §5 "Upcoming
// pods"; Amendment B §B2/§B6 the open-state contract; design brief §2.A, rev2
// §4 "show it populated the way week one will actually look"). Rendered from
// GET /api/tournament/backing-pools and nothing else.
//
// THE OPEN-STATE CONTRACT, rendered exactly and only (Amendment B §B2):
//   · backers n of 3 — the three chairs, from the API's ALREADY-CAPPED
//     `backerProgress` (the endpoint caps; this file never re-derives a count);
//   · team spread met / unmet — the API's boolean;
//   · both frozen once qualified — the BackersCall's frozen state, the API's
//     `met` pair;
//   · the viewer's own stakes — `myStakes`, summed for the §B6 line;
//   · SEALED lockups where the pot and pays × will sit at close.
// A CLOSED / INSUFFICIENT / RESOLVED pool renders the revealed view the
// endpoint returns: the pot, the exact backer count, per-team totals and
// counts, pays × where settlement wrote it.
//
// THE VIEWER'S OWN POD READS AS YOURS, NOT DISABLED (brief §2.A): a "Yours"
// tag on the pod, every seat still opens its card (the card's CTA says the
// pod is yours), nothing greyed out.
//
// NO POT, SHARE, PAYOUT, COUNT ABOVE THREE OR ACTIVITY INDICATOR appears for
// an open pool — the seal test (PodList.test.jsx) renders a pool whose object
// has been given a pot and asserts the figure never reaches the DOM.
//
// The design's `backing-browse.jsx` was not in the attached bundle (the
// landing-door canvas carries the strip, card, parts and data modules); this
// list is built from the briefs' contract with the bundle's parts vocabulary
// (Sealed, Chairs, BackersCall) and the League's PodCard row rhythm.

import React from 'react';
import { POOL_STRIP } from '../../../constants/backing';
import { LTOKENS, LX, alpha } from '../leagueTokens';
import { Eyebrow, Mono, Icon, LIcon, Tag, AgentAvatar, KindMark } from '../LeagueParts';
import { baseGroupName, seatColor } from '../leagueAdapter';
import { BackersCall, MonoAttr, Sealed } from './BackingParts';
import { POD_LIST, bp } from './backingCopy';
import { liveStakeTotal } from './backingStakes';
import { formatEtClose, seatDisplayName } from './backingStripState';

const REVEALED = new Set(['closed', 'insufficient', 'resolving', 'resolved', 'refunded']);

function SeatRow({ pod, team, revealed, onOpenSeat, accent }) {
  const name = seatDisplayName(pod.seatNames, team.odUserId);
  const agent = { kind: team.isCpu ? 'cpu' : 'human', color: seatColor(team.odUserId, team.isCpu), you: team.isOwnSeat };
  const pays = revealed ? POD_LIST.revealed.pays(team.paysX) : null;
  return (
    <div
      className="lg-tap"
      role="button"
      tabIndex={0}
      data-backing="seat"
      onClick={() => onOpenSeat?.(pod, team)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenSeat?.(pod, team); } }}
      style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 2px', cursor: 'pointer' }}
    >
      <AgentAvatar agent={agent} size={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: LTOKENS.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
          {team.isOwnSeat && <Tag color={accent}>You</Tag>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
          {team.isCpu ? <KindMark agent={agent} /> : <Mono style={{ fontSize: 10, color: LTOKENS.ink3 }}>{POD_LIST.humanMark}</Mono>}
        </div>
      </div>
      {revealed && (
        <div style={{ textAlign: 'right' }}>
          <Mono style={{ fontSize: 10.5, color: LTOKENS.ink2, display: 'block' }}>{POD_LIST.revealed.team(team.stakeTotal ?? 0, team.backerCount ?? 0)}</Mono>
          {pays && <Mono style={{ fontSize: 10, color: LTOKENS.gold, display: 'block' }}>{pays}</Mono>}
        </div>
      )}
      <Icon name="chevR" size={14} color={LTOKENS.ink3} />
    </div>
  );
}

export function PodEntry({ pod, onOpenSeat, accent = LX.energy }) {
  const pool = pod.pool ?? null;
  const open = pool?.status === 'open';
  const revealed = pool != null && REVEALED.has(pool.status);
  const yours = pod.teams.some((t) => t.isOwnSeat);
  const myTotal = liveStakeTotal(pod);
  const humans = pod.teams.filter((t) => !t.isCpu).length;
  const cpus = pod.teams.length - humans;
  const closeLabel = formatEtClose(pool?.closesAt);

  return (
    <div
      data-backing="pod"
      data-pool-status={pool?.status ?? 'none'}
      style={{
        borderRadius: 18, padding: '13px 14px',
        background: yours ? `linear-gradient(165deg, ${alpha(accent, 0.06)}, ${LTOKENS.surface} 58%)` : LTOKENS.surface,
        border: `1px solid ${yours ? alpha(accent, 0.26) : LTOKENS.hair}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.01em' }}>{baseGroupName(pod.groupId)}</span>
          <Tag color={pod.formationPath === 'slot' ? LX.cpu : LTOKENS.ink3}>{pod.formationPath === 'slot' ? POD_LIST.slot : POD_LIST.lobby}</Tag>
          {yours && <Tag color={accent}>{POD_LIST.yours}</Tag>}
        </div>
        <Mono style={{ fontSize: 9.5, color: LTOKENS.ink3, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon name="clock" size={10} color={LTOKENS.ink3} />
          {open ? POD_LIST.closes(closeLabel) : revealed ? POD_LIST.status[pool.status] : POD_LIST.noPool}
        </Mono>
      </div>

      <Mono style={{ fontSize: 9.5, color: LTOKENS.ink3, letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>{POD_LIST.seats(humans, cpus)}</Mono>

      <div>
        {pod.teams.map((team) => (
          <SeatRow key={team.odUserId} pod={pod} team={team} revealed={revealed} onOpenSeat={onOpenSeat} accent={accent} />
        ))}
      </div>

      <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${LTOKENS.hair}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {open && (
          <>
            <BackersCall progress={pool.backerProgress} spread={pool.teamSpread} youBacked={myTotal > 0} compact />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Sealed label={POD_LIST.sealedPot} size="sm" />
              <Sealed label={POD_LIST.sealedPays} size="sm" />
              {myTotal > 0 && (
                <MonoAttr data-backing="your-backing" style={{ marginLeft: 'auto', fontSize: 10.5, color: accent, fontWeight: 600 }}>
                  {POOL_STRIP.yourBacking.replace('{amount}', bp(myTotal))}
                </MonoAttr>
              )}
            </div>
          </>
        )}
        {revealed && (
          <div data-backing="revealed" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Mono style={{ fontSize: 11.5, fontWeight: 700, color: LTOKENS.ink }}>{POD_LIST.revealed.pot(pool.potTotal ?? 0)}</Mono>
            <Mono style={{ fontSize: 10.5, color: LTOKENS.ink2 }}>{POD_LIST.revealed.backers(pool.uniqueBackers ?? 0)}</Mono>
            {myTotal > 0 && (
              <MonoAttr data-backing="your-backing" style={{ marginLeft: 'auto', fontSize: 10.5, color: accent, fontWeight: 600 }}>
                {POOL_STRIP.yourBacking.replace('{amount}', bp(myTotal))}
              </MonoAttr>
            )}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <LIcon name="eyeR" size={13} color={accent} />
          <Mono style={{ fontSize: 10.5, color: accent, fontWeight: 600, letterSpacing: '0.04em' }}>{POD_LIST.tapSeat}</Mono>
        </div>
      </div>
    </div>
  );
}

export default function PodList({ pods, onOpenSeat, accent = LX.energy }) {
  const list = Array.isArray(pods) ? pods : [];
  if (list.length === 0) {
    return (
      <div data-backing="pod-list-empty" style={{ padding: '15px 14px', borderRadius: 13, background: LTOKENS.surface, border: `1px dashed ${LTOKENS.hair2}`, textAlign: 'center' }}>
        <Mono style={{ fontSize: 11, color: LTOKENS.ink3, lineHeight: 1.5 }}>{POD_LIST.empty}</Mono>
      </div>
    );
  }
  return (
    <div data-backing="pod-list" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Eyebrow color={LTOKENS.ink3}>{POD_LIST.title}</Eyebrow>
      {list.map((pod) => <PodEntry key={pod.groupId} pod={pod} onOpenSeat={onOpenSeat} accent={accent} />)}
    </div>
  );
}
