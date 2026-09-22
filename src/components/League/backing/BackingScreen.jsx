// src/components/League/backing/BackingScreen.jsx
//
// Backing Beta PR 4 — THE BACKING SCREEN the landing strip opens into (design
// brief rev2 §1 "it opens into the pod list", rev3 §1 "the strip is the door";
// spec V1.3 §5 the MVP cut: one list, one card, one control, one live card).
// Three views inside one screen: the list (Your Backing above the upcoming
// pods), the team card, the stake control. The header carries the week-state
// line the strip carries (rev3 §1 — kept inside the screen too).
//
// DATA: the pod list (useBackingPods), the viewer's own backing for the
// current week (useMyBacking), the wallet (useBackingWallet), the attestation
// status (useEligibility), the viewer's own pitch (useMyPitch), and the team
// card projection for the seat in view (useTeamCard). Every read is one of
// the rules-granted reads backingService.js names; every write is an
// endpoint. Mounted only while BACKING_BETA_ENABLED (the hosts gate it at
// call time); this component itself assumes it is lit.

import React, { useMemo, useState } from 'react';
import { FINE_PRINT } from '../../../constants/backing';
import { currentBaseLayerWeek } from '../../../constants/leagueTournament';
import { LTOKENS, LX, alpha } from '../leagueTokens';
import { Eyebrow, Mono, Icon, LIcon } from '../LeagueParts';
import useBackingPods from '../../../hooks/useBackingPods';
import useMyBacking from '../../../hooks/useMyBacking';
import useBackingWallet from '../../../hooks/useBackingWallet';
import useEligibility from '../../../hooks/useEligibility';
import useMyPitch from '../../../hooks/useMyPitch';
import useTeamCard from '../../../hooks/useTeamCard';
import { MonoAttr, PointsMeter, SealRule } from './BackingParts';
import PodList from './PodList';
import TeamCard from './TeamCard';
import StakeControl from './StakeControl';
import YourBacking from './YourBacking';
import { POD_LIST, SCREEN, STRIP } from './backingCopy';
import { STRIP_KIND, deriveStripState, formatEtClose } from './backingStripState';

function headerLine(state) {
  switch (state.kind) {
    case STRIP_KIND.OPEN: return `${STRIP.head.open(state.pods)} · ${STRIP.when.closes(formatEtClose(state.closesAt))}`;
    case STRIP_KIND.STAKED: return `${STRIP.head.staked(state.pods)} · ${STRIP.when.closes(formatEtClose(state.closesAt))}`;
    case STRIP_KIND.WEEK: return `${STRIP.head.week(state.day)} · ${STRIP.when.week}`;
    case STRIP_KIND.BETWEEN: return `${STRIP.head.between} · ${state.reopens === 'monday' ? STRIP.when.reopensMonday : STRIP.when.reopensOnFormation}`;
    default: return STRIP.sub.quiet;
  }
}

function TopBar({ label, onBack, accent, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <button type="button" className="lg-tap" data-backing="screen-back" onClick={onBack} style={{ all: 'unset', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: LTOKENS.ink2 }}>
        <LIcon name="arrowL" size={17} color={LTOKENS.ink2} />
        <Mono style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</Mono>
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {right}
        <Eyebrow color={accent}>{SCREEN.eyebrow}</Eyebrow>
      </div>
    </div>
  );
}

export default function BackingScreen({ uid, accent = LX.energy, viewport = 'mobile', onBack, onOpenTape }) {
  const pods = useBackingPods(true);
  const weekKey = useMemo(() => currentBaseLayerWeek(new Date()), []);
  const inPlay = useMyBacking(uid, weekKey, Boolean(uid));
  const upcomingWeek = pods.data?.baseLayerWeek ?? null;
  const wallet = useBackingWallet(uid, upcomingWeek, Boolean(uid));
  const eligibility = useEligibility(uid, Boolean(uid));
  const myPitch = useMyPitch(uid, Boolean(uid));
  const [view, setView] = useState({ kind: 'list', groupId: null, odUserId: null });
  const cardQuery = useTeamCard(view.groupId, view.odUserId, view.kind !== 'list');

  const state = useMemo(() => deriveStripState({
    pods: pods.pods, inPlay, now: new Date(), backingWeekCloses: pods.data?.backingWeekCloses ?? null,
  }), [pods.pods, pods.data, inPlay]);

  const pod = view.groupId ? pods.pods.find((p) => p.groupId === view.groupId) ?? null : null;
  const desktop = viewport === 'desktop';
  const toList = () => setView({ kind: 'list', groupId: null, odUserId: null });
  const toCard = () => setView((v) => ({ ...v, kind: 'card' }));

  return (
    <div data-backing="screen" data-view={view.kind} style={{ position: 'relative', padding: desktop ? '18px 20px 28px' : '16px 18px calc(env(safe-area-inset-bottom, 0px) + 120px)', maxWidth: 720, margin: '0 auto', color: LTOKENS.ink }}>
      {view.kind === 'list' && (
        <>
          <TopBar label={SCREEN.back} onBack={onBack} accent={accent} />
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{SCREEN.title}</div>
            <MonoAttr data-backing="screen-state" style={{ display: 'block', marginTop: 7, fontSize: 10.5, color: LTOKENS.ink2 }}>{pods.loading && !pods.data ? SCREEN.loading : headerLine(state)}</MonoAttr>
          </div>

          <YourBacking inPlay={inPlay} accent={accent} onOpenTape={onOpenTape} />

          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div style={{ fontSize: 12.5, color: LTOKENS.ink2, lineHeight: 1.45 }}>{POD_LIST.sub}</div>
              </div>
              {uid && <PointsMeter left={wallet.left} total={wallet.total} compact />}
            </div>
            <SealRule compact />
            {pods.error && !pods.data
              ? <div role="alert" style={{ fontSize: 12.5, color: LTOKENS.ink2 }}>{SCREEN.unavailable}</div>
              : <PodList pods={pods.pods} accent={accent} onOpenSeat={(p, team) => setView({ kind: 'card', groupId: p.groupId, odUserId: team.odUserId })} />}
          </div>

          <div style={{ marginTop: 22, padding: '11px 13px', borderRadius: 12, background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` }}>
            <Mono style={{ fontSize: 9, color: LTOKENS.ink3, letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{SCREEN.fineprintLabel}</Mono>
            <div data-backing="fine-print" style={{ fontSize: 11.5, color: LTOKENS.ink3, lineHeight: 1.5 }}>{FINE_PRINT}</div>
          </div>
        </>
      )}

      {view.kind === 'card' && (
        <>
          <TopBar label={SCREEN.allPods} onBack={toList} accent={accent} />
          {cardQuery.loading && <Mono style={{ fontSize: 11, color: LTOKENS.ink3 }}>{SCREEN.loading}</Mono>}
          {!cardQuery.loading && !cardQuery.card && <div role="alert" style={{ fontSize: 12.5, color: LTOKENS.ink2 }}>{SCREEN.cardUnavailable}</div>}
          {cardQuery.card && (
            <TeamCard
              card={cardQuery.card}
              pod={pod}
              accent={accent}
              onBack={() => setView((v) => ({ ...v, kind: 'stake' }))}
              onOpenTape={onOpenTape}
              myPitch={cardQuery.card.seat.isViewer ? myPitch : null}
            />
          )}
        </>
      )}

      {view.kind === 'stake' && cardQuery.card && (
        <>
          <TopBar label={SCREEN.toCard} onBack={toCard} accent={accent} />
          <div style={{ borderRadius: 18, padding: '14px 15px', background: `linear-gradient(165deg, ${alpha(accent, 0.06)}, ${LTOKENS.surface} 58%)`, border: `1px solid ${alpha(accent, 0.26)}` }}>
            <StakeControl
              card={cardQuery.card}
              pod={pod}
              wallet={wallet}
              eligibility={eligibility}
              accent={accent}
              onBacked={() => pods.refresh()}
              onClose={toCard}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
            <Icon name="lock" size={11} color={LTOKENS.ink3} />
            <Mono style={{ fontSize: 9.5, color: LTOKENS.ink3 }}>{SCREEN.sealRule}</Mono>
          </div>
        </>
      )}
    </div>
  );
}
