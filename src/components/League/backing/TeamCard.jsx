// src/components/League/backing/TeamCard.jsx
//
// Backing Beta PR 4 — SURFACE B, the team card (spec V1.3 §5 "Team Card",
// D-l projection-only; design brief §2.B "this card is the feature", rev2
// §2–§4 the team leads / last week's portfolios / first week is the default,
// rev3 §2 no live standing). Ported from the frozen design's
// `backing-card.jsx` — TeamUnit, KnownStrip, TwoLayerBook, TapeBlock,
// BackButton, the tape-first hierarchy — onto the League's primitives and the
// projection GET /api/tournament/team-card returns.
//
// EVERY FIELD ON THIS CARD IS THE PROJECTION'S. No `agents` read happens on
// the client (the projection-only pin in TeamCard.test.jsx walks this file's
// imports); the agent's name, archetype, approach and LOADOUT COUNTS arrive
// from the server, and the tape — last week's portfolios, both layers, and
// the why in the agent's own recorded words — is real completed data or
// nothing. There is no fixture reasoning here and no placeholder tape: a
// first-week team shows the first-week state, a CPU seat the CPU state.
//
// THE HIERARCHY REWARDS READING (brief §4.2): pod line → the team unit (the
// human and their agent as halves of one team, archetype demoted to a tag) →
// the tape → the known facts (completed history only) → the CTA. The CTA reads
// "your pod" on the viewer's own pod (never disabled), "closed" once the pool
// has closed, and opens the stake control while the pool is open.

import React from 'react';
import { LTOKENS, LX, alpha } from '../leagueTokens';
import { Mono, Icon, LIcon, Tag, AgentAvatar, KindMark } from '../LeagueParts';
import { baseGroupName, seatColor } from '../leagueAdapter';
import { MonoAttr, Stat, TapeHead, TapeList } from './BackingParts';
import PitchEditor from './PitchEditor';
import { stakedOnTeam } from './backingStakes';
import { teamLabelOf } from './backingStripState';
import { CARD, agentPickDid, humanPickDid } from './backingCopy';

const box = { borderRadius: 14, padding: '11px 13px', background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` };
const goldBox = { borderRadius: 14, padding: '13px 14px', background: `linear-gradient(160deg, ${alpha(LTOKENS.gold, 0.06)}, ${LTOKENS.surface} 60%)`, border: `1px solid ${alpha(LTOKENS.gold, 0.22)}` };
const body = { fontSize: 12.5, color: LTOKENS.ink2, lineHeight: 1.45 };

// ── one layer row: glyph · name · role · line(s) ────────────────────────────
function LayerRow({ glyph, name, role, mark, children, last }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '38px 1fr', columnGap: 11, padding: last ? '11px 0 2px' : '2px 0 11px', borderBottom: last ? 'none' : `1px solid ${LTOKENS.hair}` }}>
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 1 }}>{glyph}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 5 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.01em' }}>{name}</span>
          <Mono style={{ fontSize: 9.5, color: LTOKENS.ink3, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{role}</Mono>
          {mark}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>{children}</div>
      </div>
    </div>
  );
}

function PitchView({ text }) {
  if (!text) return <span data-backing="pitch-empty" style={{ fontSize: 12.5, color: LTOKENS.ink3, fontStyle: 'italic' }}>{CARD.pitch.noneTheirs}</span>;
  return <span data-backing="pitch" style={{ fontSize: 13.5, color: LTOKENS.ink, lineHeight: 1.45 }}>{CARD.pitch.quote(text)}</span>;
}

// ── the team unit — two layers, one team ────────────────────────────────────
/** A first week: no tape AND no completed week on the record (FAB-13). */
const isFirstWeek = (card) => !card.lastWeek && !(card.known?.weeksPlayed > 0);

export function TeamUnit({ card, agentName, myPitch, accent }) {
  const { team, seat } = card;
  const firstWeek = isFirstWeek(card);
  const isYou = seat.isViewer;
  const color = seatColor(card.odUserId, team.isCpu);
  const kind = team.isCpu ? 'cpu' : 'human';
  const ring = team.isCpu ? LX.cpu : LX.human;
  const agent = team.agent;
  const agentGlyph = (
    <div style={{ width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: alpha(color, 0.14), border: `1px solid ${alpha(color, 0.4)}` }}>
      <div style={{ width: 12, height: 12, borderRadius: '50%', background: color, boxShadow: `0 0 10px ${alpha(color, 0.7)}` }} />
    </div>
  );
  return (
    <div data-backing="team-unit" style={{ borderRadius: 16, padding: '12px 13px 10px', background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair2}`, position: 'relative' }}>
      {/* the bracket that makes two layers one team */}
      <div style={{ position: 'absolute', left: 13 + 19, top: 48, bottom: 40, width: 1, background: `linear-gradient(${alpha(ring, 0.5)}, ${alpha(color, 0.5)})` }} />
      <LayerRow
        glyph={<AgentAvatar agent={{ kind, color, you: isYou }} size={34} />}
        name={team.isCpu ? `${team.displayName}${CARD.houseSuffix}` : team.displayName}
        role={CARD.humanRole}
        mark={isYou ? <Tag color={accent}>You</Tag> : team.isCpu ? <KindMark agent={{ kind: 'cpu' }} /> : null}
      >
        {team.isCpu ? (
          <span style={body}>{CARD.cpuPicks}</span>
        ) : (
          <>
            {isYou && myPitch ? <PitchEditor pitch={myPitch} accent={accent} mode="card" /> : <PitchView text={team.pitch} />}
            {isYou && <Mono style={{ fontSize: 9, color: LTOKENS.ink3, letterSpacing: '0.04em' }}>{CARD.pitch.sameLine}</Mono>}
            {team.derived
              ? <div data-backing="derived" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><LIcon name="pulse" size={11} color={LTOKENS.ink3} /><Mono style={{ fontSize: 10.5, color: LTOKENS.ink2, letterSpacing: '0.01em', lineHeight: 1.4 }}>{team.derived}</Mono></div>
              : firstWeek ? <MonoAttr data-backing="first-week" style={{ fontSize: 10, color: LTOKENS.gold, letterSpacing: '0.08em' }}>{CARD.firstWeek}</MonoAttr> : null}
          </>
        )}
      </LayerRow>
      <LayerRow
        last
        glyph={agentGlyph}
        name={agentName}
        role={CARD.agentRole}
        mark={agent?.archetypeLabel ? <Tag color={LTOKENS.ink3}>{agent.archetypeLabel}</Tag> : null}
      >
        {agent ? (
          <>
            {agent.approach && <span data-backing="approach" style={body}>{agent.approach}</span>}
            {/* The loadout marker is a human agent's: the house's seat carries no
                private loadout to keep private (spec §1; FAB-8). */}
            {!team.isCpu && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="lock" size={10} color={LTOKENS.ink3} stroke={2} />
                <MonoAttr data-backing="loadout" style={{ fontSize: 10, color: LTOKENS.ink3 }}>{CARD.loadout(agent.traitCount, agent.ruleCount)}</MonoAttr>
              </div>
            )}
          </>
        ) : (
          <span style={body}>{CARD.noAgent}</span>
        )}
      </LayerRow>
    </div>
  );
}

// ── the known facts: completed history only. First week shows what's true. ──
export function KnownStrip({ card }) {
  const { team, known } = card;
  const K = CARD.known;
  const items = [];
  if (team.isCpu) {
    items.push([K.career, K.dash, LTOKENS.ink3], [K.tier, K.cpuTier, LTOKENS.ink2], [K.history, K.none, LTOKENS.ink3]);
  } else if (known) {
    items.push([K.career, Number.isFinite(known.rp) ? K.rp(known.rp) : K.dash, Number.isFinite(known.rp) ? LTOKENS.ink : LTOKENS.ink3], [K.tier, known.tierName ?? K.dash, known.tierName ? LTOKENS.ink : LTOKENS.ink3]);
    items.push([K.last, K.finishes(known.priorFinishes ?? []), LTOKENS.ink2], [K.weeks, String(known.weeksPlayed), LTOKENS.ink2]);
  } else {
    items.push([K.career, K.noWeeks, LTOKENS.ink3], [K.tier, K.dash, LTOKENS.ink3], [K.weeks, '0', LTOKENS.ink3]);
  }
  return (
    <div data-backing="known" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, minmax(0,1fr))`, gap: 10, padding: '10px 13px', borderRadius: 12, background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` }}>
      {items.slice(0, 4).map(([k, v, col]) => <Stat key={k} k={k} v={v} color={col || LTOKENS.ink} />)}
    </div>
  );
}

// ── portfolios, both layers ─────────────────────────────────────────────────
function BookRow({ symbol, direction, did, last }) {
  const short = direction === 'short';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr', columnGap: 8, alignItems: 'center', padding: '6px 0', borderBottom: last ? 'none' : `1px solid ${LTOKENS.hair}` }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <LIcon name={short ? 'short' : 'long'} size={10} color={short ? LX.alert : LTOKENS.ink3} stroke={2.2} />
        <Mono style={{ fontSize: 12, fontWeight: 700, color: LTOKENS.ink }}>{symbol}</Mono>
      </span>
      <span style={{ fontSize: 11.5, color: LTOKENS.ink2, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{did}</span>
    </div>
  );
}

export function TwoLayerBook({ humanLabel, agentLabel, humanRows, agentRows }) {
  const col = (label, sub, rows) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
        <Mono style={{ fontSize: 9.5, color: LTOKENS.ink2, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</Mono>
        <Mono style={{ fontSize: 9.5, color: LTOKENS.ink3 }}>{sub}</Mono>
      </div>
      {rows.map((r, i) => <BookRow key={r.symbol} {...r} last={i === rows.length - 1} />)}
    </div>
  );
  return (
    <div data-backing="two-layer-book" className="bk-book" style={{ ...box, padding: '11px 13px' }}>
      {col(humanLabel, CARD.tape.pickLayer, humanRows)}
      {col(agentLabel, CARD.tape.book, agentRows)}
    </div>
  );
}

// ── the tape block ──────────────────────────────────────────────────────────
export function TapeBlock({ card, pod, agentName, onOpenTape }) {
  const { team, lastWeek } = card;
  const agent = team.agent;
  if (team.isCpu) {
    return (
      <div data-backing="tape-cpu">
        <TapeHead color={LTOKENS.gold} lead title={CARD.tape.cpuTitle} sub={CARD.tape.cpuSub(agent?.archetypeLabel ?? CARD.known.cpuTier)} />
        <div style={goldBox}><div style={body}>{CARD.tape.cpuBody}</div></div>
      </div>
    );
  }
  if (!lastWeek && !isFirstWeek(card)) {
    return (
      <div data-backing="tape-none">
        <TapeHead color={LTOKENS.ink3} lead title={CARD.tape.noTapeTitle} sub={CARD.tape.noTapeSub} />
        <div style={box}><div style={body}>{CARD.tape.noTapeBody}</div></div>
      </div>
    );
  }
  if (!lastWeek) {
    return (
      <div data-backing="tape-first-week">
        <TapeHead color={LTOKENS.gold} lead title={CARD.tape.firstWeekTitle} sub={CARD.tape.firstWeekSub} />
        <div style={goldBox}>
          <div style={body}>{CARD.tape.firstWeekBody({ hasPitch: Boolean(team.pitch), agentName, traits: agent?.traitCount, rules: agent?.ruleCount, formationPath: pod?.formationPath ?? null, poolOpen: pod?.pool?.status === 'open' })}</div>
        </div>
      </div>
    );
  }
  const humanRows = (lastWeek.human?.picks ?? []).map((p) => ({ symbol: p.symbol, direction: p.direction, did: humanPickDid(p) }));
  const agentRows = (lastWeek.agent?.picks ?? []).map((p) => ({ symbol: p.symbol, direction: 'long', did: agentPickDid(p) }));
  const trades = lastWeek.agent?.trades ?? [];
  return (
    <div data-backing="tape-last-week" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <TapeHead lead title={CARD.tape.lastWeekTitle} sub={CARD.tape.lastWeekSub(lastWeek.placement, lastWeek.seatCount, lastWeek.composite)} />
        <TwoLayerBook
          humanLabel={CARD.tape.humanCol(team.displayName)}
          agentLabel={CARD.tape.agentCol(lastWeek.agent?.agentName ?? agentName)}
          humanRows={humanRows}
          agentRows={agentRows}
        />
      </div>
      <div>
        <TapeHead title={CARD.tape.whyTitle} />
        <div style={{ ...box, padding: '2px 13px' }}>
          {trades.length > 0
            ? <TapeList entries={trades.map((t) => ({ day: t.day, symbol: t.symbolIn, act: CARD.tape.tradeAct(t.symbolOut), why: t.rationale }))} />
            : <Mono style={{ display: 'block', padding: '10px 0', fontSize: 11, color: LTOKENS.ink3 }}>{CARD.tape.noSwaps}</Mono>}
        </div>
        {onOpenTape && (
          <button type="button" className="lg-tap" data-backing="film-room" onClick={() => onOpenTape(lastWeek.tape.groupId, lastWeek.tape.focusId)} style={{ all: 'unset', cursor: 'pointer', marginTop: 9, display: 'flex', alignItems: 'center', gap: 6, color: LTOKENS.ink2 }}>
            <Mono style={{ fontSize: 10.5, letterSpacing: '0.06em' }}>{CARD.tape.filmRoom}</Mono><Icon name="arrowR" size={13} color={LTOKENS.ink2} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── CTA ─────────────────────────────────────────────────────────────────────
export function BackButton({ card, pod, agentName, accent, onBack }) {
  const { seat, team } = card;
  const open = pod?.pool?.status === 'open';
  const myStake = stakedOnTeam(pod, card.odUserId);
  if (seat.viewerSeated) {
    return (
      <div data-backing="cta-yours" style={{ padding: '12px 14px', borderRadius: 13, textAlign: 'center', border: `1px solid ${alpha(accent, 0.24)}`, background: alpha(accent, 0.06) }}>
        <span style={{ fontSize: 13, color: LTOKENS.ink2 }}>{seat.isViewer ? CARD.cta.yoursTeam : CARD.cta.yoursPod}</span>
      </div>
    );
  }
  if (!open) {
    return (
      <div data-backing="cta-closed" style={{ padding: '12px 14px', borderRadius: 13, textAlign: 'center', border: `1px solid ${LTOKENS.hair2}`, background: LTOKENS.surface }}>
        <Mono style={{ fontSize: 11, color: LTOKENS.ink2, letterSpacing: '0.06em' }}>{`${myStake > 0 ? CARD.cta.backedPrefix(myStake) : ''}${CARD.cta.closed}`}</Mono>
      </div>
    );
  }
  // A top-up names the team by its single label (D-af — Amendment C §C1); the
  // first stake keeps the card's human-and-agent unit.
  const label = myStake > 0 ? CARD.cta.addTo(myStake, teamLabelOf(team.label)) : CARD.cta.back(team.displayName, agentName);
  return (
    <button
      type="button"
      className="lg-tap"
      data-backing="cta-back"
      onClick={onBack}
      style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', width: '100%', padding: 14, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, fontWeight: 700, fontSize: 14.5, background: accent, color: LTOKENS.bg, boxShadow: `0 8px 24px ${alpha(accent, 0.3)}` }}
    >
      {label}<Icon name="arrowR" size={15} color={LTOKENS.bg} />
    </button>
  );
}

// ── the card ────────────────────────────────────────────────────────────────
export default function TeamCard({ card, pod, accent = LX.energy, onBack, onOpenTape, myPitch = null }) {
  const agentName = card.team.agent?.name ?? CARD.agentFallbackName(card.team.displayName);
  const podName = baseGroupName(card.groupId);
  return (
    <div data-backing="team-card" data-seat={card.odUserId} style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: 'inherit' }}>
      <Mono style={{ fontSize: 10, color: LTOKENS.ink3, letterSpacing: '0.1em', textTransform: 'uppercase', paddingRight: 36 }}>{CARD.podLine(podName, card.seat.index, card.seat.count)}</Mono>
      <TeamUnit card={card} agentName={agentName} myPitch={card.seat.isViewer ? myPitch : null} accent={accent} />
      <TapeBlock card={card} pod={pod} agentName={agentName} onOpenTape={onOpenTape} />
      <KnownStrip card={card} />
      <BackButton card={card} pod={pod} agentName={agentName} accent={accent} onBack={onBack} />
    </div>
  );
}
