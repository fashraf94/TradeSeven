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
//
// THE DESKTOP DOOR (`wide`, Backing desktop layouts): on the desktop landing
// the strip sits in the centre column directly under the draft slots and must
// read as the most important thing below them (founder ruling, Sept 24). It
// gets louder ONLY with what it may already say: the accent edge, heavier; the
// chairs motif and the close, larger; and — while the window is open — a
// primary-weight "Back a team" action. "The window is open" is the POD
// LIST's fact (`windowOpen`: any listed pool open — backingWindow), not the
// strip's own state, so a returning backer's Monday–Friday strip carries the
// action too; it is a sibling button that opens the window, while the strip
// opens its own section (PLACE-1, the desktop review record). Never a pot, a
// count above three, urgency copy, or motion implying activity: the inputs
// are the same derived state, and nothing on it moves. The mobile strip (not
// `wide`) is the markup main ships (backingMobilePin.test.jsx).

import React from 'react';
import { LTOKENS, LX, alpha } from '../leagueTokens';
import { Mono, Icon, LIcon, Score } from '../LeagueParts';
import { Chairs, WeekRail } from './BackingParts';
import { STRIP, stripLines } from './backingCopy';
import { DESK_SECTION, STRIP_KIND } from './backingStripState';

function DeskStrip({ s, kind, eyebrow, head, when, sub, c, onOpen, windowOpen }) {
  const motif = kind === STRIP_KIND.WEEK
    ? <WeekRail day={s.day} color={c} />
    : kind === STRIP_KIND.BETWEEN
      ? <LIcon name="crown" size={14} color={c} stroke={2.2} />
      : <Chairs n={kind === STRIP_KIND.STAKED ? 1 : 0} color={c} size={11} />;
  // The card holds TWO buttons, siblings (a button never nests in a button):
  // the strip itself, which opens the Backing screen where its own state
  // points (Your Backing Monday–Friday, the results once banked, the window
  // otherwise), and — while the window is open, whatever the strip's own
  // state — the "Back a team" action, which opens the window (PLACE-1).
  return (
    <div
      data-backing="strip-card"
      data-strip-state={kind}
      data-strip-layout="desktop"
      style={{
        boxSizing: 'border-box', position: 'relative', overflow: 'hidden', borderRadius: 16,
        background: `linear-gradient(115deg, ${alpha(c, 0.16)}, ${LTOKENS.surface} 64%)`,
        border: `1px solid ${alpha(c, 0.4)}`, boxShadow: `inset 0 1px 0 ${alpha(LTOKENS.ink, 0.05)}`, color: LTOKENS.ink,
      }}
    >
      <div data-backing="strip-edge" style={{ position: 'absolute', left: 0, top: 12, bottom: 12, width: 3, borderRadius: 3, background: c, boxShadow: `0 0 12px ${alpha(c, 0.75)}` }} />
      <button
        type="button"
        className="lg-tap"
        data-backing="strip"
        data-strip-state={kind}
        data-strip-layout="desktop"
        onClick={() => onOpen?.()}
        aria-label={`${eyebrow} · ${head}`}
        style={{
          all: 'unset', boxSizing: 'border-box', display: 'block', width: '100%', cursor: 'pointer', textAlign: 'left',
          padding: windowOpen ? '16px 18px 10px 21px' : '16px 18px 16px 21px', color: LTOKENS.ink,
        }}
      >
        {/* In a narrow centre column the close drops under the eyebrow rather than clip (PLACE-4). */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', columnGap: 10, rowGap: 4, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
            {motif}
            <Mono style={{ fontSize: 10, color: c, letterSpacing: '0.12em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{eyebrow}</Mono>
          </div>
          <Mono style={{ fontSize: 11, color: LTOKENS.ink2, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Icon name="clock" size={12} color={LTOKENS.ink2} />{when}
          </Mono>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: '1 1 auto', minWidth: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{head}</div>
          <Icon name="arrowR" size={18} color={c} />
        </div>
        {sub && <div style={{ fontSize: 12.5, color: LTOKENS.ink2, lineHeight: 1.45, marginTop: 6 }}>{sub}</div>}

        {kind === STRIP_KIND.STAKED && Array.isArray(s.stakes) && s.stakes.length > 0 && (
          <div data-backing="strip-stakes" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6, marginTop: 12 }}>
            {s.stakes.map((x) => (
              <div key={x.stakeId ?? `${x.groupId}-${x.teamOdUserId}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 9, background: alpha(LTOKENS.bg, 0.5), border: `1px solid ${alpha(c, 0.2)}` }}>
                <span style={{ fontSize: 13, fontWeight: 600, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.teamName}</span>
                <Mono style={{ fontSize: 10, color: LTOKENS.ink3, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.podName}</Mono>
                {x.closed && <Mono style={{ fontSize: 9.5, color: LTOKENS.ink3, letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0 }}>{STRIP.lockedRow}</Mono>}
                <Mono style={{ fontSize: 12, fontWeight: 700, color: c, flexShrink: 0, whiteSpace: 'nowrap' }}>{STRIP.stakeRow(x.amount)}</Mono>
              </div>
            ))}
          </div>
        )}

        {kind === STRIP_KIND.WEEK && Array.isArray(s.teams) && s.teams.length > 0 && (
          <div data-backing="strip-teams" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 6, marginTop: 12 }}>
            {s.teams.map((x) => (
              <div key={`${x.groupId}-${x.teamOdUserId}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, background: alpha(LTOKENS.bg, 0.5), border: `1px solid ${LTOKENS.hair}` }}>
                <Mono style={{ fontSize: 13.5, fontWeight: 700, color: x.rank === 1 ? LTOKENS.gold : LTOKENS.ink }}>{STRIP.standingRank(x.rank)}</Mono>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.teamName}</div>
                  <Mono style={{ fontSize: 9.5, color: LTOKENS.ink3 }}>{x.podName}</Mono>
                </div>
                {Number.isFinite(x.score) && <Score v={x.score} size={12.5} />}
              </div>
            ))}
          </div>
        )}
      </button>
      {windowOpen && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 18px 16px 21px' }}>
          <button
            type="button"
            className="lg-tap"
            data-backing="strip-back"
            onClick={() => onOpen?.(DESK_SECTION.WINDOW)}
            style={{
              all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 12,
              background: c, color: LTOKENS.bg, fontSize: 13.5, fontWeight: 700, letterSpacing: '-0.01em', whiteSpace: 'nowrap',
              boxShadow: `0 6px 18px ${alpha(c, 0.28)}`,
            }}
          >
            {STRIP.backCta}<Icon name="arrowR" size={15} color={LTOKENS.bg} />
          </button>
        </div>
      )}
    </div>
  );
}

// THE LOBBY RULE THE STRIP BRINGS (PLACE-2, the desktop review record): at the
// desktop lobby's ≤1180px layouts its grid items keep `min-height: 0`, so a
// centre taller than its row paints over the left rail reflowed beneath it —
// and the strip is what makes the centre taller. The rule rides the strip's
// own lit mount, so the flag-off lobby (its markup, its LD_STYLE) is exactly
// today's; the smaller overlap the lobby has without the strip is reported for
// separate tasking.
const DESK_LOBBY_STYLE = '@media (max-width: 1180px) { .ld-grid > .ld-center, .ld-grid > .ld-rail-left, .ld-grid > .ld-rail-right { min-height: auto; } }';

/**
 * The desktop landing's strip slot — ONE composition: BackingLandingStrip's
 * live mount renders it, and so does the dev preview page (its desktop
 * landing), so the slot the preview pictures is this one. `windowOpen` is the
 * pod list's (backingWindow); the strip's "Back a team" action rides it.
 */
export function DeskStripSlot({ state, windowOpen = false, accent, onOpen }) {
  return (
    <div data-backing="strip-slot">
      <BackingStrip state={state} accent={accent} onOpen={onOpen} wide windowOpen={windowOpen} />
      <style>{DESK_LOBBY_STYLE}</style>
    </div>
  );
}

export default function BackingStrip({ state, accent = LX.energy, onOpen, wide = false, windowOpen = false }) {
  const s = state && typeof state === 'object' ? state : { kind: STRIP_KIND.QUIET };
  const { kind, eyebrow, head, when, sub } = stripLines(s);
  const c = kind === STRIP_KIND.BETWEEN ? LTOKENS.gold : accent;
  if (wide) return <DeskStrip s={s} kind={kind} eyebrow={eyebrow} head={head} when={when} sub={sub} c={c} onOpen={onOpen} windowOpen={windowOpen === true} />;
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
        position: 'relative', overflow: 'hidden', borderRadius: 16, padding: '12px 14px',
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
              {x.closed && <Mono style={{ fontSize: 9, color: LTOKENS.ink3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{STRIP.lockedRow}</Mono>}
              <Mono style={{ fontSize: 11.5, fontWeight: 700, color: c }}>{STRIP.stakeRow(x.amount)}</Mono>
            </div>
          ))}
        </div>
      )}

      {kind === STRIP_KIND.WEEK && Array.isArray(s.teams) && s.teams.length > 0 && (
        <div data-backing="strip-teams" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 6, marginTop: 10 }}>
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
