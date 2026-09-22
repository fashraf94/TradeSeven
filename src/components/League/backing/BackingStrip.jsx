// src/components/League/backing/BackingStrip.jsx
//
// Backing Beta PR 4 — THE DOOR INTO BACKING, on the League landing (design
// brief rev3 §1; ported from the frozen design's `backing-strip.jsx`
// BackingStrip). One strip, its wording and contents changing with the week;
// a time-bound moment, not a banner. Presentational: it renders the state
// `backingStripState.js` derives from real data and nothing else.
//
// WHAT THE STRIP NEVER SHOWS while a pool is open: a pot, a share, a payout,
// a count above three, an activity indicator — none exist in its inputs (the
// pod list strips them server-side), and the between state names the settled
// week without its numbers (the results reveal is PR 5's card).
//
// THE MOTIF IS NOT A NUMBER. The design's chairs read "2 of 3" on the open
// state as decoration; here the chairs on the strip carry no count: none
// filled while the window is open (the offered seat), one filled once the
// viewer is in, the five-day rail Monday–Friday, the crown for the banked
// week. A count that is not data has no business next to a sealed pool.
//
// Teal while the window is open and through the week; gold once last week is
// banked (the design's rule). Tokens only (BUILD_RULES §10); the tap feedback
// is the League's own `.lg-tap` class (no inline transition literal, §11).

import React from 'react';
import { LTOKENS, LX, alpha } from '../leagueTokens';
import { Mono, Icon, LIcon, Score } from '../LeagueParts';
import { Chairs, WeekRail } from './BackingParts';
import { STRIP } from './backingCopy';
import { STRIP_KIND, formatEtClose } from './backingStripState';

function headFor(state) {
  switch (state.kind) {
    case STRIP_KIND.OPEN: return STRIP.head.open(state.pods);
    case STRIP_KIND.STAKED: return STRIP.head.staked(state.pods);
    case STRIP_KIND.WEEK: return STRIP.head.week(state.day);
    case STRIP_KIND.BETWEEN: return STRIP.head.between;
    default: return STRIP.head.quiet;
  }
}

function whenFor(state) {
  switch (state.kind) {
    case STRIP_KIND.OPEN:
    case STRIP_KIND.STAKED: return STRIP.when.closes(formatEtClose(state.closesAt));
    case STRIP_KIND.WEEK: return STRIP.when.week;
    case STRIP_KIND.BETWEEN: return state.reopens === 'monday' ? STRIP.when.reopensMonday : STRIP.when.reopensOnFormation;
    default: return STRIP.when.reopensOnFormation;
  }
}

function subFor(state) {
  switch (state.kind) {
    case STRIP_KIND.OPEN: return STRIP.sub.open;
    case STRIP_KIND.BETWEEN: return STRIP.sub.between;
    case STRIP_KIND.QUIET: return STRIP.sub.quiet;
    default: return null;
  }
}

export default function BackingStrip({ state, accent = LX.energy, onOpen, wide = false }) {
  const s = state && typeof state === 'object' ? state : { kind: STRIP_KIND.QUIET };
  const kind = Object.values(STRIP_KIND).includes(s.kind) ? s.kind : STRIP_KIND.QUIET;
  const c = kind === STRIP_KIND.BETWEEN ? LTOKENS.gold : accent;
  const eyebrow = STRIP.eyebrow[kind];
  const head = headFor(s);
  const when = whenFor(s);
  const sub = subFor(s);
  const motif = kind === STRIP_KIND.WEEK
    ? <WeekRail day={s.day} color={c} />
    : kind === STRIP_KIND.BETWEEN
      ? <LIcon name="crown" size={12} color={c} stroke={2.2} />
      : <Chairs n={kind === STRIP_KIND.STAKED ? 1 : 0} color={c} size={9} />;

  return (
    <button
      type="button"
      className="lg-tap"
      data-backing="strip"
      data-strip-state={kind}
      onClick={onOpen}
      aria-label={`${eyebrow} · ${head}`}
      style={{
        all: 'unset', boxSizing: 'border-box', display: 'block', width: '100%', cursor: 'pointer', textAlign: 'left',
        position: 'relative', overflow: 'hidden', borderRadius: 16, padding: wide ? '13px 16px' : '12px 14px',
        background: `linear-gradient(115deg, ${alpha(c, 0.13)}, ${LTOKENS.surface} 62%)`,
        border: `1px solid ${alpha(c, 0.3)}`, boxShadow: `inset 0 1px 0 ${alpha(LTOKENS.ink, 0.05)}`, color: LTOKENS.ink,
      }}
    >
      <div style={{ position: 'absolute', left: 0, top: 10, bottom: 10, width: 2, borderRadius: 2, background: c, boxShadow: `0 0 10px ${alpha(c, 0.7)}` }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {motif}
          <Mono style={{ fontSize: 9.5, color: c, letterSpacing: '0.12em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{eyebrow}</Mono>
        </div>
        <Mono style={{ fontSize: 9.5, color: LTOKENS.ink3, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon name="clock" size={10} color={LTOKENS.ink3} />{when}
        </Mono>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.015em', lineHeight: 1.15 }}>{head}</div>
          {sub && <div style={{ fontSize: 12, color: LTOKENS.ink2, lineHeight: 1.45, marginTop: 4 }}>{sub}</div>}
        </div>
        <Icon name="arrowR" size={18} color={c} />
      </div>

      {kind === STRIP_KIND.STAKED && Array.isArray(s.stakes) && s.stakes.length > 0 && (
        <div data-backing="strip-stakes" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6, marginTop: 10 }}>
          {s.stakes.map((x) => (
            <div key={x.stakeId ?? `${x.groupId}-${x.teamOdUserId}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', borderRadius: 9, background: alpha(LTOKENS.bg, 0.5), border: `1px solid ${alpha(c, 0.2)}` }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.teamName}</span>
              <Mono style={{ fontSize: 9.5, color: LTOKENS.ink3, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.podName}</Mono>
              <Mono style={{ fontSize: 11.5, fontWeight: 700, color: c }}>{STRIP.stakeRow(x.amount)}</Mono>
            </div>
          ))}
        </div>
      )}

      {kind === STRIP_KIND.WEEK && Array.isArray(s.teams) && s.teams.length > 0 && (
        <div data-backing="strip-teams" style={{ display: 'grid', gridTemplateColumns: wide ? '1fr' : 'repeat(2, minmax(0,1fr))', gap: 6, marginTop: 10 }}>
          {s.teams.map((x) => (
            <div key={`${x.groupId}-${x.teamOdUserId}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 9, background: alpha(LTOKENS.bg, 0.5), border: `1px solid ${LTOKENS.hair}` }}>
              <Mono style={{ fontSize: 13, fontWeight: 700, color: x.rank === 1 ? LTOKENS.gold : LTOKENS.ink }}>{STRIP.standingRank(x.rank)}</Mono>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.teamName}</div>
                <Mono style={{ fontSize: 9, color: LTOKENS.ink3 }}>{x.podName}</Mono>
              </div>
              {Number.isFinite(x.score) && <Score v={x.score} size={12} />}
            </div>
          ))}
        </div>
      )}
    </button>
  );
}
