/* eslint-disable react-refresh/only-export-components -- co-located seated-status primitives + small helpers, mirroring the LeagueParts command-bridge precedent */
// src/components/League/liveDraft/SeatedStatusParts.jsx
//
// Seated Status Surface Enrichment — the shared chrome + modules for the two
// seated waiting states a player reaches via "Open my game":
//   • LiveDraftGlimpse   — slot claimed, awaiting the draft (FORMING)
//   • LiveDraftAwaiting   — drafted, awaiting Monday's open (AWAITING_OPEN)
//
// Ported from the revised Claude Design export (tourney-chrome / tourney-page /
// tourney-states). DARK-ONLY: consumes the shared obsidian token map
// (LTOKENS/LX) + the League atoms (Eyebrow/Mono/Icon/LIcon/Tag/AgentAvatar) — no
// useTheme(), no new palette (BUILD_RULES §9 single-source; leagueTokens.js).
//
// HONEST-EMPTY DISCIPLINE (build spec, 2026-07-20; founder-dispositioned):
//   • Rule chips  → OMITTED. The equipped rules live on the agent doc
//     (activeRules/standingLeans), not on the group doc this surface reads, and
//     the stored text is a full sentence, not a terse chip — so the loadout
//     ships name + archetype + watchlist, no chips (Q1).
//   • Agent's six → an HONEST LINE, never fabricated. The six aren't produced
//     until the Monday BATTLE flip (tournamentOrchestrator) and live in a
//     subcollection subscribeMyGroup never reads — so State 2 shows the user's
//     three real picks + an honest line for the rest (Q2).
//   • Watchlist   → NAME ONLY (the tickers need an async read; v1 shows the
//     equipped watchlist name that rides the agentLoadout prop).
// Every value here is derived from a real field or omitted — no seeds, no
// invented counts, no placeholder stats.

import React from 'react';
import '../league.css'; // lg-tap + the lgLiveDot heartbeat keyframe
import { LTOKENS, LX, alpha } from '../leagueTokens';
import { Eyebrow, Mono, Icon, LIcon, Tag, AgentAvatar } from '../LeagueParts';
import AgentOrb from '../../shared/AgentOrb';

const T = LTOKENS;

// ── countdown helpers ───────────────────────────────────────────────────────

// Segment a live-seconds countdown into [value,label] groups for the hero.
// ≥1d → DAYS:HRS:MIN · ≥1h → HRS:MIN:SEC · else MIN:SEC. (design tSegs)
export function tSegs(secs) {
  const s = Math.floor(Math.max(0, secs || 0)); // floor without a 32-bit `|0` overflow

  if (s >= 86400) { const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60); return [[d, 'DAYS'], [h, 'HRS'], [m, 'MIN']]; }
  if (s >= 3600) { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sc = s % 60; return [[h, 'HRS'], [m, 'MIN'], [sc, 'SEC']]; }
  const m = Math.floor(s / 60), sc = s % 60; return [[m, 'MIN'], [sc, 'SEC']];
}

// Live seconds to an ISO target. Returns null when the target is missing (honest
// empty — the hero renders a muted "awaiting schedule" instead of fake digits).
// The initializer computes synchronously so SSR/first paint shows a real value.
export function useCountdownSecs(targetIso) {
  const compute = React.useCallback(() => {
    if (!targetIso) return null;
    const t = new Date(targetIso).getTime();
    if (Number.isNaN(t)) return null;
    return Math.max(0, Math.floor((t - Date.now()) / 1000));
  }, [targetIso]);
  const [secs, setSecs] = React.useState(compute);
  React.useEffect(() => {
    setSecs(compute());
    if (!targetIso) return undefined;
    const id = setInterval(() => setSecs(compute()), 1000);
    return () => clearInterval(id);
  }, [targetIso, compute]);
  return secs;
}

// Format an ISO instant in Eastern Time. Honest fallbacks on a bad/absent value.
function etParts(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const tz = 'America/New_York';
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long', timeZone: tz });
  const weekdayShort = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: tz }).toUpperCase();
  // "7:00 PM" → "7:00pm". Strip ALL whitespace via \s (matches the U+202F narrow
  // no-break space modern ICU/V8 puts before AM/PM), not just an ASCII space.
  const raw = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });
  const time = raw.replace(/\s+/g, '').replace('AM', 'am').replace('PM', 'pm');
  return { weekday, weekdayShort, time };
}

// ── shared cards ─────────────────────────────────────────────────────────────

export function TCard({ children, accent, glow, pad = 16, style }) {
  return (
    <div style={{
      position: 'relative', borderRadius: 16, padding: pad, minWidth: 0,
      background: accent ? `linear-gradient(158deg, ${alpha(accent, 0.07)}, ${alpha('#0D0E12', 0.45)} 62%)` : T.surface,
      border: `1px solid ${accent ? alpha(accent, 0.3) : T.hair}`,
      boxShadow: glow ? `0 20px 50px -30px ${alpha(accent || T.teal, 0.55)}` : 'none', ...style,
    }}>
      {children}
    </div>
  );
}

function ModHead({ icon, color = T.ink3, label, sub, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 13 }}>
      <span style={{
        width: 26, height: 26, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: alpha(color, 0.13), border: `1px solid ${alpha(color, 0.36)}`,
      }}>
        <LIcon name={icon} size={14} color={color} stroke={2.1} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Eyebrow color={color === T.ink3 ? T.ink3 : color}>{label}</Eyebrow>
        {sub && <Mono style={{ fontSize: 9.5, color: T.ink3, marginTop: 2, display: 'block', letterSpacing: '0.02em' }}>{sub}</Mono>}
      </div>
      {right}
    </div>
  );
}

// ── page chrome — eyebrow · pod name · slot chip · progression rail ─────────

// The three-step progression rail (Awaiting draft → Drafted → Trading). Only the
// first two are designed surfaces; "Trading" shows progression only (the live
// draft room and the battle arena are separate existing surfaces — never linked).
const RAIL_STEPS = [
  { key: 'awaiting', label: 'Awaiting draft', verb: 'Awaiting' },
  { key: 'drafted', label: 'Drafted', verb: 'Drafted' },
  { key: 'trading', label: 'Trading', verb: 'Trading' },
];

export function StateRail({ step, compact, style }) {
  const idx = RAIL_STEPS.findIndex((s) => s.key === step);
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: compact ? 6 : 9, ...style }}>
      {RAIL_STEPS.map((s, i) => {
        const done = i < idx, cur = i === idx;
        const c = cur ? T.gold : done ? T.teal : T.ink3;
        return (
          <div key={s.key} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ height: 3, borderRadius: 3, background: cur || done ? c : T.hair2, boxShadow: cur ? `0 0 10px ${alpha(c, 0.7)}` : 'none' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              {cur ? (
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: c, flexShrink: 0, boxShadow: `0 0 0 3px ${alpha(c, 0.18)}`, animation: 'lgLiveDot 1.8s infinite' }} />
              ) : done ? (
                <Icon name="check" size={11} color={c} stroke={2.6} />
              ) : (
                <span style={{ width: 6, height: 6, borderRadius: '50%', border: `1.5px solid ${T.hair2}`, flexShrink: 0 }} />
              )}
              <Mono style={{
                fontSize: compact ? 9 : 10, fontWeight: cur ? 700 : 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                color: cur ? c : done ? T.ink2 : T.ink3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {compact ? s.verb : s.label}
              </Mono>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Page header shared by both states. `slotShort` (the gold slot chip) is shown
// only when a real slot instant is known.
export function SeatedChrome({ eyebrow, title, sub, slotShort, step, compact }) {
  return (
    <div style={{ marginBottom: compact ? 16 : 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: compact ? 7 : 9, flexWrap: 'wrap' }}>
        <Eyebrow color={T.gold}>{eyebrow}</Eyebrow>
        {slotShort && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: alpha(T.gold, 0.1), border: `1px solid ${alpha(T.gold, 0.3)}` }}>
            <Icon name="clock" size={11} color={T.gold} stroke={2} />
            <Mono style={{ fontSize: 9.5, color: T.gold, fontWeight: 600, letterSpacing: '0.1em' }}>{slotShort}</Mono>
          </span>
        )}
      </div>
      <div style={{ fontFamily: 'inherit', fontSize: compact ? 26 : 34, fontWeight: 700, lineHeight: 1.02, color: T.ink, letterSpacing: '-0.02em' }}>
        {title}
      </div>
      {sub && (
        <Mono style={{ fontSize: compact ? 10.5 : 11.5, color: T.ink2, letterSpacing: '0.04em', marginTop: 6, display: 'block' }}>{sub}</Mono>
      )}
      <StateRail step={step} compact={compact} style={{ marginTop: compact ? 15 : 18 }} />
    </div>
  );
}

// ── the anticipation hero — used by BOTH states; only the target/copy changes ─
// `secs` null → honest muted "awaiting schedule", never fabricated digits.
export function Countdown({ secs, cd, compact }) {
  const g = T.gold;
  const segs = secs == null ? null : tSegs(secs);
  return (
    <TCard accent={g} glow pad={compact ? 18 : 24}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 16, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -60, right: -40, width: 220, height: 220, borderRadius: '50%', background: `radial-gradient(circle, ${alpha(g, 0.16)}, transparent 68%)`, filter: 'blur(6px)' }} />
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: compact ? 12 : 15 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: g, animation: 'lgLiveDot 1.8s infinite', boxShadow: `0 0 8px ${g}` }} />
          <Eyebrow color={g}>{cd.eyebrow}</Eyebrow>
          <Mono style={{ marginLeft: 'auto', fontSize: 9.5, color: T.ink3, letterSpacing: '0.08em' }}>{cd.tag}</Mono>
        </div>

        <div style={{ fontSize: compact ? 19 : 24, fontWeight: 600, color: T.ink, lineHeight: 1.12, letterSpacing: '-0.01em', maxWidth: 460 }}>
          {cd.headline}
        </div>

        {segs ? (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: compact ? 8 : 11, marginTop: compact ? 15 : 19 }}>
            {segs.map(([v, lb], i) => (
              <React.Fragment key={lb}>
                {i > 0 && <Mono style={{ fontSize: compact ? 30 : 40, fontWeight: 300, color: alpha(g, 0.4), lineHeight: 1, paddingBottom: compact ? 12 : 16 }}>:</Mono>}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <Mono style={{ fontSize: compact ? 40 : 56, fontWeight: 700, color: g, lineHeight: 0.9, textShadow: `0 0 26px ${alpha(g, 0.45)}`, letterSpacing: '-0.02em' }}>
                    {String(v).padStart(2, '0')}
                  </Mono>
                  <Mono style={{ fontSize: compact ? 8.5 : 9.5, fontWeight: 600, letterSpacing: '0.16em', color: T.ink3 }}>{lb}</Mono>
                </div>
              </React.Fragment>
            ))}
          </div>
        ) : (
          <Mono style={{ display: 'block', marginTop: compact ? 15 : 19, fontSize: 12, color: T.ink3, letterSpacing: '0.04em' }}>Awaiting schedule</Mono>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: compact ? 16 : 20, paddingTop: compact ? 14 : 16, borderTop: `1px solid ${T.hair}` }}>
          <LIcon name="flip" size={13} color={T.ink3} stroke={2} />
          <Mono style={{ fontSize: compact ? 10 : 11, color: T.ink2, lineHeight: 1.5 }}>{cd.foot}</Mono>
        </div>
      </div>
    </TCard>
  );
}

// ── the pod — exactly four seats, a ROW per seat ────────────────────────────
// `seats`: [{ open }] | [{ name, you, cpu, color, owner }]. State 1 shows open
// seats (fill with CPU at draft); State 2 shows the resolved pod.
function PodSeatRow({ s, n, resolved }) {
  if (s.open) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 11px', borderRadius: 11, border: `1px dashed ${T.hair2}`, background: 'transparent' }}>
        <span style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1.5px dashed ${T.hair2}` }}>
          <Mono style={{ fontSize: 11, fontWeight: 700, color: T.ink3 }}>{n}</Mono>
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.ink2 }}>Open</span>
          <Mono style={{ fontSize: 9.5, color: T.ink3, letterSpacing: '0.02em', marginTop: 2, display: 'block' }}>Fills with CPU at draft</Mono>
        </div>
        <LIcon name="cpu" size={14} color={T.ink3} stroke={2} />
      </div>
    );
  }
  const you = !!s.you, cpu = !!s.cpu;
  const color = you ? T.teal : cpu ? LX.cpu : LX.human;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 11px', borderRadius: 11, background: you ? alpha(color, 0.07) : 'transparent', border: `1px solid ${you ? alpha(color, 0.28) : T.hair}` }}>
      <AgentAvatar agent={{ kind: you ? 'you' : cpu ? 'cpu' : 'human', color, you }} size={30} live={you} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: you ? color : T.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
          {you && <Tag color={color}>You</Tag>}
          {resolved && cpu && <Mono style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: '0.08em', color: LX.cpu, padding: '2px 6px', borderRadius: 5, background: alpha(LX.cpu, 0.12), border: `1px solid ${alpha(LX.cpu, 0.34)}` }}>FILLED</Mono>}
        </div>
      </div>
      {cpu ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 999, background: alpha(LX.cpu, 0.1), border: `1px solid ${alpha(LX.cpu, 0.3)}` }}>
          <LIcon name="cpu" size={11} color={LX.cpu} stroke={2} />
          <Mono style={{ fontSize: 9, fontWeight: 700, color: LX.cpu, letterSpacing: '0.06em' }}>CPU</Mono>
        </span>
      ) : (
        s.owner && <Mono style={{ fontSize: 10.5, color: you ? alpha(color, 0.9) : LX.human, fontWeight: 600 }}>{s.owner}</Mono>
      )}
    </div>
  );
}

export function PodCard({ seats, resolved, slotDay, compact }) {
  const openCount = seats.filter((s) => s.open).length;
  const humans = seats.filter((s) => !s.open && !s.cpu).length;
  const cpus = seats.filter((s) => s.cpu).length;
  const claimed = seats.length - openCount;
  return (
    <TCard>
      <ModHead
        icon="users" color={LX.human} label="Your pod" sub={`Four seats · ${resolved ? 'drafted' : 'forming'}`}
        right={(
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, justifyContent: 'flex-end' }}>
              <Mono style={{ fontSize: 20, fontWeight: 700, color: T.ink, lineHeight: 1 }}>{claimed}</Mono>
              <Mono style={{ fontSize: 12, fontWeight: 600, color: T.ink3 }}>/ 4</Mono>
            </div>
            <Mono style={{ fontSize: 8.5, color: T.ink3, letterSpacing: '0.1em' }}>{resolved ? 'SEATS SET' : 'CLAIMED'}</Mono>
          </div>
        )}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {seats.map((s, i) => <PodSeatRow key={i} s={s} n={i + 1} resolved={resolved} />)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 12, paddingTop: 11, borderTop: `1px solid ${T.hair}` }}>
        <LIcon name="cpu" size={12} color={T.ink3} stroke={2} />
        <Mono style={{ fontSize: compact ? 9.5 : 10.5, color: T.ink2, lineHeight: 1.5 }}>
          {resolved
            ? <>Pod locked — {humans} human, {cpus} CPU. The open seats filled with CPU when the draft ran.</>
            : openCount > 0
              ? <>{openCount} open {openCount === 1 ? 'seat' : 'seats'} — {openCount === 1 ? 'it fills' : 'they fill'} with CPU when the draft runs{slotDay ? ` ${slotDay}` : ''}.</>
              : <>Pod is set — four humans claimed before the draft.</>}
        </Mono>
      </div>
    </TCard>
  );
}

// ── your loadout — summary + Edit-in-Forge. Name + archetype + watchlist NAME.
//    No chips (Q1 honest-empty). Watchlist tickers are a v1 name-only read. ────
export function LoadoutCard({ loadout, phase, onOpenForge, compact }) {
  const sub = phase === 'drafted' ? 'Equipped · tunable until the open' : 'Equipped · editable until the draft runs';
  const name = loadout?.name || loadout?.archetype || 'Your agent';
  const archetype = loadout?.archetype || null;
  const watchlist = loadout?.equippedWatchlistName || null;
  const editBtn = onOpenForge && (
    <button
      type="button" className="lg-tap" onClick={onOpenForge}
      style={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9, background: alpha(T.teal, 0.12), border: `1px solid ${alpha(T.teal, 0.38)}` }}
    >
      <Icon name="pencil" size={12} color={T.teal} stroke={2.2} />
      <Mono style={{ fontSize: 11, fontWeight: 700, color: T.teal }}>Edit in Forge</Mono>
    </button>
  );

  if (!loadout) {
    return (
      <TCard>
        <ModHead icon="bolt" color={T.teal} label="Your loadout" sub="No agent equipped yet" right={editBtn} />
        <Mono style={{ fontSize: 11, color: T.ink3, lineHeight: 1.5, display: 'block' }}>
          Equip an agent in the Forge and it drafts alongside you.
        </Mono>
      </TCard>
    );
  }

  return (
    <TCard>
      <ModHead icon="bolt" color={T.teal} label="Your loadout" sub={sub} right={editBtn} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: watchlist ? 14 : 0 }}>
        <AgentOrb color={T.teal} size={compact ? 40 : 46} state="ready" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: compact ? 17 : 19, fontWeight: 700, color: T.ink }}>{name}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'inherit', fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.gold, background: alpha(T.gold, 0.13), border: `1px solid ${alpha(T.gold, 0.32)}`, padding: '3px 8px 3px 6px', borderRadius: 999, fontWeight: 600 }}>
              <Icon name="lock" size={10} color={T.gold} stroke={2.2} />Equipped
            </span>
          </div>
          {archetype && archetype !== name && <Mono style={{ fontSize: 10.5, color: T.ink3, letterSpacing: '0.03em', marginTop: 3, display: 'block' }}>{archetype}</Mono>}
        </div>
      </div>
      {watchlist && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', borderRadius: 10, background: T.surface, border: `1px solid ${T.hair}` }}>
          <Icon name="layers" size={14} color={T.ink3} />
          <Mono style={{ fontSize: 10.5, color: T.ink2, fontWeight: 600 }}>{watchlist}</Mono>
          <Mono style={{ marginLeft: 'auto', fontSize: 9, color: T.ink3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Watchlist</Mono>
        </div>
      )}
    </TCard>
  );
}

// ── your seat — held / confirmed (State 1) ──────────────────────────────────
// `claimedAgo` is optional: shown only when a real claim time is known.
export function SeatHeldCard({ claimedAgo, compact }) {
  return (
    <TCard accent={T.gold}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: alpha(T.gold, 0.14), border: `1px solid ${alpha(T.gold, 0.4)}` }}>
          <Icon name="check" size={19} color={T.gold} stroke={2.6} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: compact ? 14 : 15, fontWeight: 700, color: T.ink }}>Your seat is held</span>
          <Mono style={{ fontSize: 10, color: T.ink3, letterSpacing: '0.02em', marginTop: 2, display: 'block' }}>
            {claimedAgo ? `Claimed ${claimedAgo} · ` : ''}your pod forms at the draft
          </Mono>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 999, background: alpha(T.teal, 0.1), border: `1px solid ${alpha(T.teal, 0.3)}` }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.teal }} />
          <Mono style={{ fontSize: 9.5, fontWeight: 700, color: T.teal, letterSpacing: '0.08em' }}>CONFIRMED</Mono>
        </span>
      </div>
    </TCard>
  );
}

// ── leave this slot — quiet, secondary. State 1 only ────────────────────────
export function LeaveSlot({ onLeave, leaving, compact }) {
  if (!onLeave) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: compact ? 2 : 4 }}>
      <button
        type="button" className="lg-tap" onClick={leaving ? undefined : onLeave} disabled={leaving}
        style={{ all: 'unset', cursor: leaving ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 9, border: `1px solid ${T.hair}`, opacity: leaving ? 0.6 : 1 }}
      >
        <LIcon name="flip" size={12} color={T.ink3} stroke={2} />
        <Mono style={{ fontSize: 10.5, fontWeight: 600, color: T.ink3, letterSpacing: '0.04em' }}>{leaving ? 'Leaving…' : 'Leave this slot'}</Mono>
      </button>
    </div>
  );
}

// ── your lineup (State 2) — the user's THREE real picks + an HONEST line for
//    the agent's six (not produced until Monday's open; Q2 honest-empty). ─────
export function UserLineupCard({ picks, compact }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 1fr', gap: compact ? 12 : 14 }}>
      <TCard>
        <ModHead
          icon="long" color={LX.human} label="Your three" sub="Your hand-picks · drafted"
          right={<LockChip color={LX.human} />}
        />
        {picks.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {picks.map((tk, i) => (
              <div key={`${tk}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 10, background: alpha(LX.human, 0.06), border: `1px solid ${alpha(LX.human, 0.28)}` }}>
                <Mono style={{ fontSize: 10, fontWeight: 700, color: LX.human, width: 12 }}>{i + 1}</Mono>
                <LIcon name="long" size={14} color={alpha(LX.human, 0.9)} stroke={2.2} />
                <Mono style={{ fontSize: 14.5, color: T.ink, fontWeight: 700 }}>{tk}</Mono>
                <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center' }}>
                  <Icon name="check" size={12} color={LX.human} stroke={2.6} />
                </span>
              </div>
            ))}
          </div>
        ) : (
          <Mono style={{ fontSize: 11, color: T.ink3, lineHeight: 1.5, display: 'block' }}>Your picks lock in at the draft.</Mono>
        )}
      </TCard>
      <TCard>
        <ModHead icon="cpu" color={T.teal} label="Agent's six" sub="Drafts at Monday's open" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, background: alpha(T.teal, 0.1), border: `1px solid ${alpha(T.teal, 0.28)}` }}>
            <Icon name="clock" size={11} color={T.teal} stroke={2} />
            <Mono style={{ fontSize: 9.5, fontWeight: 700, color: T.teal, letterSpacing: '0.06em' }}>PENDING</Mono>
          </span>
          <Mono style={{ fontSize: 10.5, color: T.ink2, lineHeight: 1.5, display: 'block' }}>
            Your agent drafts its six around your three at Monday&rsquo;s open. Tune it in the Forge until then.
          </Mono>
        </div>
      </TCard>
    </div>
  );
}

function LockChip({ color }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 999, background: alpha(color, 0.1), border: `1px solid ${alpha(color, 0.3)}` }}>
      <Icon name="check" size={11} color={color} stroke={2.6} />
      <Mono style={{ fontSize: 8.5, fontWeight: 700, color, letterSpacing: '0.08em' }}>LOCKED</Mono>
    </span>
  );
}

// ── the obsidian page shell shared by both states ───────────────────────────
export function SeatedPage({ compact, children }) {
  return (
    <div style={{
      minHeight: '100vh', overflowX: 'hidden', boxSizing: 'border-box',
      background: T.bg, backgroundImage: `radial-gradient(circle at 50% -8%, ${alpha(T.gold, 0.06)}, transparent 46%)`,
      color: T.ink, fontFamily: "'Space Grotesk', system-ui, -apple-system, sans-serif",
    }}>
      <div style={{ padding: compact ? '18px 15px 40px' : '26px 30px 40px', maxWidth: compact ? '100%' : 1080, margin: '0 auto' }}>
        {children}
        <div style={{ textAlign: 'center', marginTop: compact ? 18 : 22 }}>
          <Mono style={{ fontSize: 9.5, color: alpha(T.ink3, 0.8), letterSpacing: '0.04em' }}>
            Weekly pods will feed a monthly bracket — coming soon.
          </Mono>
        </div>
      </div>
    </div>
  );
}

// ── seat derivations (pure) ──────────────────────────────────────────────────

// State 1 (FORMING): humans by id/name + open seats up to GROUP_SIZE.
export function formingSeats({ groupMembers, seatNames, currentUserId, groupSize }) {
  // No handle data on the group doc — humans show their seat name only (owner
  // handle omitted rather than echoing the name).
  const humans = (groupMembers || []).map((id) => ({
    name: id === currentUserId ? 'You' : (seatNames?.[id] || 'Rival'),
    you: id === currentUserId,
    cpu: false,
  }));
  const openCount = Math.max(0, groupSize - humans.length);
  return [...humans, ...Array.from({ length: openCount }, () => ({ open: true }))];
}

// State 2 (AWAITING_OPEN): the resolved pod from players[] (humans + CPU fills).
export function resolvedSeats({ players, seatNames, currentUserId, groupSize }) {
  const rows = (players || []).map((p) => {
    const id = p.odUserId;
    const you = id === currentUserId;
    const cpu = !!p.isCpu;
    return {
      name: you ? 'You' : (seatNames?.[id] || (cpu ? 'CPU' : 'Rival')),
      you,
      cpu,
    };
  });
  // Never fabricate identities: if the doc somehow carries fewer than the pod
  // size, pad with honest CPU-fill rows (the open seats fill with CPU at draft).
  const pad = Math.max(0, groupSize - rows.length);
  return [...rows, ...Array.from({ length: pad }, () => ({ name: 'CPU', cpu: true }))];
}

// User's own drafted symbols from group.players[].picks (pick-state objects or
// bare strings), matched by odUserId. Pure — the confirmed State-2 read path.
export function userPickSymbols({ players, currentUserId }) {
  const mine = (players || []).find((p) => p.odUserId === currentUserId)?.picks || [];
  return mine.map((pk) => (typeof pk === 'string' ? pk : pk?.symbol)).filter(Boolean);
}

// The countdown copy per state (headline/eyebrow/tag/foot), derived from the
// real slot/open instant — no fabricated day/time.
export function slotCountdownCopy(scheduledDraftAt) {
  const et = etParts(scheduledDraftAt);
  return {
    eyebrow: 'Draft countdown',
    tag: 'YOUR SLOT',
    headline: et ? `Draft runs ${et.weekday}, ${et.time} ET` : 'Draft runs at your slot time',
    foot: 'Your loadout locks the moment the draft runs — tune it until then.',
    slotShort: et ? `${et.weekdayShort} · ${et.time.toUpperCase()}` : null,
    slotDay: et ? et.weekday : null,
    slotTime: et ? et.time : null,
  };
}

export function openCountdownCopy({ anchorIso, anchorDayLabel }) {
  return {
    eyebrow: 'Trading opens',
    tag: 'MONDAY OPEN',
    headline: anchorDayLabel ? `Trading starts ${anchorDayLabel} at the open` : 'Trading starts at the open',
    foot: '9:30am ET · your agent can still be tuned right up to the open.',
    hasCountdown: !!anchorIso,
  };
}
