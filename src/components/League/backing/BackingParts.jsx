/* eslint-disable react-refresh/only-export-components -- shared backing primitives co-located by design (the LeagueParts precedent) */
// src/components/League/backing/BackingParts.jsx
//
// Backing Beta PR 4 — the Backing vocabulary, ported from the frozen design's
// `backing-parts.jsx` (Sealed, SealRule, Chairs, BackersCall, PointsMeter,
// TapeList, Disclosures, DayTrail, Stat) and the strip's `BKSChairs` /
// `BKSWeekRail` from `backing-strip.jsx`. Composed from the League primitives
// (LeagueParts) and the shared obsidian tokens (leagueTokens) — no new palette,
// no raw hex (BUILD_RULES §10), no inline `transition={{` literals (§11).
//
// THE SEAL IS A RULED ABSENCE (brief §4.1): where a number would sit at close,
// an open pool shows a dashed lockup that says SEALED — nothing moves, nothing
// counts up, nothing animates while a pool is open (§3 hard constraints).
// The reveal's count-up and the seal-break animation the design carries are
// deliberately NOT ported here: they belong to the close/results beat, which
// is PR 5's surface.
//
// THE THREE DISCLOSURE LINES render VERBATIM from src/constants/backing.js
// (§4 — one source each), numbered as the design numbers them, never
// collapsed, never an icon.

import React from 'react';
import { DISCLOSURES, POOL_STRIP } from '../../../constants/backing';
import { LTOKENS, LX, alpha, MONO } from '../leagueTokens';
import { Eyebrow, Mono, Icon } from '../LeagueParts';
import { POD_LIST, SCREEN, bp, ordinal } from './backingCopy';

// ── Mono that carries its DOM attributes. LeagueParts' Mono takes only
// children and style, so a `data-backing` marker on it never reaches the DOM;
// the backing surfaces mark their states with this one instead. ────────────
export function MonoAttr({ children, style, ...rest }) {
  return <span {...rest} style={{ fontFamily: MONO, ...style }}>{children}</span>;
}

// ── the seal — a ruled, deliberate absence. A number lives here at close. ───
export function Sealed({ label, size = 'md', style }) {
  const sm = size === 'sm';
  return (
    <span data-backing="sealed" style={{
      display: 'inline-flex', alignItems: 'center', gap: sm ? 5 : 7, padding: sm ? '2px 7px' : '5px 10px', borderRadius: sm ? 6 : 9,
      border: `1px dashed ${LTOKENS.hair2}`, background: alpha(LTOKENS.bg, 0.45), whiteSpace: 'nowrap', ...style,
    }}>
      {label && <Mono style={{ fontSize: sm ? 9 : 10, color: LTOKENS.ink3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</Mono>}
      <Icon name="lock" size={sm ? 10 : 12} color={LTOKENS.ink3} stroke={2} />
      <Mono style={{ fontSize: sm ? 9 : 10, color: LTOKENS.ink2, letterSpacing: '0.14em', fontWeight: 600 }}>{POD_LIST.sealed}</Mono>
    </span>
  );
}

// ── the rule, stated once per surface ───────────────────────────────────────
export function SealRule({ compact, style }) {
  return (
    <div data-backing="seal-rule" style={{
      display: 'flex', alignItems: 'flex-start', gap: 9, padding: compact ? '9px 11px' : '11px 13px', borderRadius: 12,
      border: `1px dashed ${LTOKENS.hair2}`, background: alpha(LTOKENS.bg, 0.4), ...style,
    }}>
      <Icon name="lock" size={14} color={LTOKENS.ink2} stroke={2} style={{ marginTop: 1 }} />
      <div style={{ fontSize: compact ? 11.5 : 12.5, color: LTOKENS.ink2, lineHeight: 1.45 }}>{SCREEN.sealRule}</div>
    </div>
  );
}

// ── backers · n of 3 — three chairs; the empty one is the one offered to you ─
export function Chairs({ n, color = LX.energy, size = 12 }) {
  const filled = Number.isFinite(n) ? Math.max(0, Math.min(3, n)) : 0;
  return (
    <span data-backing="chairs" data-count={filled} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: size, height: size, borderRadius: '50%', boxSizing: 'border-box',
          background: i < filled ? color : 'transparent',
          border: i < filled ? 'none' : `1.5px dashed ${i === filled ? color : LTOKENS.ink3}`,
          boxShadow: i < filled ? `0 0 6px ${alpha(color, 0.5)}` : 'none',
        }} />
      ))}
    </span>
  );
}

// ── the five-day rail: a quiet clock for the week. Filled = the days so far. ─
export function WeekRail({ day, color = LX.energy }) {
  const through = Number.isFinite(day) ? Math.max(0, Math.min(5, day)) : 0;
  return (
    <span data-backing="week-rail" style={{ display: 'inline-flex', gap: 3 }}>
      {['M', 'T', 'W', 'T', 'F'].map((d, i) => (
        <span key={`${d}${i}`} style={{ width: 14, height: 3, borderRadius: 2, background: i < through ? color : LTOKENS.hair2 }} />
      ))}
    </span>
  );
}

// ── the backers call — the three chairs and the §B6 lines, verbatim ─────────
// The open pool says exactly two things about itself (Amendment B §B6): it
// needs support (backers n of the floor, spread met or not), or it has
// qualified and frozen. The words are POOL_STRIP's, filled from the API's own
// capped `backerProgress` and the spread boolean — never re-derived here.
export function BackersCall({ progress, spread, compact = false }) {
  const count = Number.isFinite(progress?.count) ? progress.count : 0;
  const floor = Number.isFinite(progress?.floor) ? progress.floor : 3;
  const backersMet = progress?.met === true;
  const spreadMet = spread?.met === true;
  const frozen = backersMet && spreadMet;
  const block = frozen ? POOL_STRIP.qualified : POOL_STRIP.belowFloor;
  const backers = backersMet ? POOL_STRIP.qualified.backers : POOL_STRIP.belowFloor.backers.replace('{count}', String(count)).replace('{floor}', String(floor));
  const teamSpread = spreadMet ? POOL_STRIP.qualified.teamSpread : POOL_STRIP.belowFloor.teamSpread;
  const copy = { head: block.headline, sub: `${backers} · ${teamSpread}` };
  return (
    <div data-backing="backers-call" data-frozen={frozen ? 'true' : 'false'} style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: compact ? '8px 10px' : '10px 12px', borderRadius: 12,
      background: frozen ? LTOKENS.surface : alpha(LX.energy, 0.07), border: `1px solid ${frozen ? LTOKENS.hair : alpha(LX.energy, 0.26)}`,
    }}>
      {frozen ? <Icon name="check" size={14} color={LTOKENS.ink2} stroke={2.4} /> : <Chairs n={count} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: frozen ? LTOKENS.ink2 : LTOKENS.ink, lineHeight: 1.2 }}>{copy.head}</div>
        <div style={{ fontSize: 11, color: LTOKENS.ink3, lineHeight: 1.35, marginTop: 2 }}>{copy.sub}</div>
      </div>
      {frozen && <Sealed size="sm" />}
    </div>
  );
}

// ── Backing Points — free, weekly, expiring. Never a balance to grow. ───────
export function PointsMeter({ left, total, compact = false }) {
  return (
    <div data-backing="points-meter" style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <Mono style={{ fontSize: compact ? 15 : 18, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{Number.isFinite(left) ? bp(left) : '—'}</Mono>
      <Mono style={{ fontSize: 10, color: LTOKENS.ink3, letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{SCREEN.pointsSuffix(total)}</Mono>
    </div>
  );
}

// ── the compact tape: day · pick · action / one line of why ────────────────
export function TapeLine({ day, symbol, act, why, last }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '34px 52px 1fr', columnGap: 10, rowGap: 3, padding: '9px 0', alignItems: 'baseline',
      borderBottom: last ? 'none' : `1px solid ${LTOKENS.hair}`,
    }}>
      <Mono style={{ fontSize: 9.5, color: LTOKENS.ink3, letterSpacing: '0.1em' }}>{day || '—'}</Mono>
      <Mono style={{ fontSize: 12.5, fontWeight: 700, color: LTOKENS.ink }}>{symbol}</Mono>
      <span style={{ fontSize: 13, fontWeight: 600, color: LTOKENS.ink }}>{act}</span>
      <span /><span />
      {why
        ? <span style={{ fontSize: 12.5, color: LTOKENS.ink2, lineHeight: 1.45 }}>{why}</span>
        : <Mono style={{ fontSize: 10, color: LTOKENS.ink3, letterSpacing: '0.06em' }}>—</Mono>}
    </div>
  );
}

export function TapeList({ entries }) {
  return (
    <div data-backing="tape">
      {entries.map((e, i) => <TapeLine key={`${e.day}-${e.symbol}-${i}`} {...e} last={i === entries.length - 1} />)}
    </div>
  );
}

// ── the three lines. Never collapsed, never an icon. From the constants. ────
export function Disclosures({ style }) {
  const lines = [DISCLOSURES.loadouts, DISCLOSURES.payout, DISCLOSURES.validity];
  return (
    <div data-backing="disclosures" style={{ borderRadius: 12, border: `1px solid ${LTOKENS.hair2}`, background: LTOKENS.surface, padding: '4px 13px', ...style }}>
      {lines.map((t, i) => (
        <div key={t} style={{ display: 'flex', gap: 11, padding: '10px 0', borderBottom: i < lines.length - 1 ? `1px solid ${LTOKENS.hair}` : 'none' }}>
          <Mono style={{ fontSize: 10, color: LTOKENS.gold, fontWeight: 700, letterSpacing: '0.08em', marginTop: 2, flexShrink: 0 }}>0{i + 1}</Mono>
          <span style={{ fontSize: 12.5, color: LTOKENS.ink, lineHeight: 1.45 }}>{t}</span>
        </div>
      ))}
    </div>
  );
}

// ── the week as five stops; the team's rank at each banked close ───────────
export const BK_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
export function DayTrail({ trail = [], through = 0, color = LX.energy }) {
  return (
    <div data-backing="day-trail" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
      {BK_DAYS.map((d, i) => {
        const done = i < through;
        const today = i === through - 1;
        const r = trail[i];
        const hasRank = done && Number.isInteger(r);
        return (
          <div key={d} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '7px 0 6px', borderRadius: 9,
            background: today ? alpha(color, 0.1) : done ? LTOKENS.surface : 'transparent',
            border: `1px ${done ? 'solid' : 'dashed'} ${today ? alpha(color, 0.4) : LTOKENS.hair}`,
          }}>
            <Mono style={{ fontSize: 8.5, color: today ? color : LTOKENS.ink3, letterSpacing: '0.1em' }}>{d}</Mono>
            <Mono style={{ fontSize: 14, fontWeight: 700, color: hasRank ? (r === 1 ? LTOKENS.gold : LTOKENS.ink) : LTOKENS.ink3, fontVariantNumeric: 'tabular-nums' }}>
              {hasRank ? ordinal(r) : '·'}
            </Mono>
          </div>
        );
      })}
    </div>
  );
}

// ── small labeled stat ─────────────────────────────────────────────────────
export function Stat({ k, v, color = LTOKENS.ink }) {
  return (
    <div style={{ minWidth: 0 }}>
      <Mono style={{ fontSize: 9, color: LTOKENS.ink3, letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>{k}</Mono>
      <Mono style={{ fontSize: 13.5, fontWeight: 700, color, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{v}</Mono>
    </div>
  );
}

// ── a section heading for the backing surfaces ──────────────────────────────
export function TapeHead({ title, sub, color, lead }) {
  return (
    <div style={{ marginBottom: 7 }}>
      <Eyebrow color={color || LTOKENS.ink3} style={{ marginBottom: 5 }}>{title}</Eyebrow>
      {sub && <div style={{ fontSize: lead ? 17 : 14.5, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.01em', lineHeight: 1.15 }}>{sub}</div>}
    </div>
  );
}

/** The mono label style the backing surfaces share for small uppercase notes. */
export const noteStyle = { fontFamily: MONO, fontSize: 9.5, color: LTOKENS.ink3, letterSpacing: '0.04em', lineHeight: 1.5 };
