// src/components/League/battleArena/ArenaOverlays.jsx
//
// League Battle View V2 — the arena's modal overlays:
//   • FreeAgencyDoorway — the "Claim a name" doorway. Per Phase-0 Gate 4, claiming
//     happens on its OWN surface (you pick up a free agent AND choose which pick to
//     drop there); the battle view is only the doorway. In this preview the CTA is
//     inert (the real nav lands with the live-wiring phase).
//   • OpponentSnapshot — tap a rival on the climb: a WHAT-only, SEALED snapshot.
//     Their book + reasoning stay sealed until the battle completes (the Film
//     Room). The full ticker book renders with the Film Room phase.
//   • FilmRoomOverlay — the complete-state "break the seal" entry. A faithful
//     placeholder here; the dossier room is a later phase.
//
// Translated from the locked Claude Design (battle-arena-desktop / battle-kit).

import React from 'react';
import { Mono, Eyebrow, LIcon, Icon } from '../LeagueParts';
import { LTOKENS, alpha } from '../leagueTokens';
import { ArenaCount } from './ArenaPrimitives';
import { OWN_AGENT } from './arenaTheme';
import { prefersReducedMotion } from './arenaEngineCore';

// a centred modal frame with a dimmed, click-to-close backdrop
export function AFocus({ children, onClose, width = 440 }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="bv2-tap bv2-fadein" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(5,6,9,0.74)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} />
      <div className="bv2-scroll" style={{ position: 'relative', width, maxHeight: '86%', overflowY: 'auto', borderRadius: 22, padding: '20px 22px',
        background: LTOKENS.bg, border: `1px solid ${LTOKENS.hair2}`, boxShadow: '0 30px 90px rgba(0,0,0,0.6)' }}>
        <button className="bv2-tap" onClick={onClose} style={{ all: 'unset', position: 'absolute', top: 16, right: 16, cursor: 'pointer', width: 28, height: 28, borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center', background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` }}>
          <Icon name="x" size={15} color={LTOKENS.ink2} />
        </button>
        {children}
      </div>
    </div>
  );
}

export function FreeAgencyDoorway({ onClose }) {
  const c = OWN_AGENT;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 82, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="bv2-tap bv2-fadein" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(5,6,9,0.78)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)' }} />
      <div className={prefersReducedMotion() ? '' : 'bv2-rise'} style={{ position: 'relative', width: 460, borderRadius: 22, padding: '26px 26px 24px', textAlign: 'center',
        background: `linear-gradient(160deg, ${alpha(c, 0.12)}, ${LTOKENS.bg} 62%)`, border: `1px solid ${alpha(c, 0.34)}`, boxShadow: '0 30px 90px rgba(0,0,0,0.6)' }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: alpha(c, 0.14), border: `1px solid ${alpha(c, 0.4)}` }}>
          <LIcon name="arrowUpRight" size={26} color={c} stroke={2} />
        </div>
        <Eyebrow color={c}>Leaving the battle · Free Agency</Eyebrow>
        <div style={{ fontSize: 21, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.01em', marginTop: 8 }}>Open the Free Agency board</div>
        <div style={{ fontSize: 13, color: LTOKENS.ink2, lineHeight: 1.6, marginTop: 10 }}>
          Claiming happens on its own surface. There you pick up a free-agent name <b style={{ color: LTOKENS.ink }}>and</b> choose which of your three to drop — a claim is one move, finalized there. The battle view is only the doorway.
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button className="bv2-tap" onClick={onClose} style={{ all: 'unset', flex: 1, textAlign: 'center', cursor: 'pointer', padding: '11px', borderRadius: 11,
            background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair2}`, color: LTOKENS.ink2, fontWeight: 600, fontSize: 12.5 }}>Stay in the battle</button>
          <button className="bv2-tap" onClick={onClose} style={{ all: 'unset', flex: 1.4, textAlign: 'center', cursor: 'pointer', padding: '11px', borderRadius: 11,
            background: c, color: LTOKENS.bg, fontWeight: 700, fontSize: 12.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            Go to Free Agency <LIcon name="arrowUpRight" size={13} color={LTOKENS.bg} stroke={2.4} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function OpponentSnapshot({ seat, composite, onClose }) {
  return (
    <AFocus onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
          background: `radial-gradient(circle at 38% 32%, ${alpha(seat.color, 0.95)}, ${alpha(seat.color, 0.28)} 68%, ${alpha(seat.color, 0.1)})`,
          border: `1.5px solid ${alpha(seat.color, 0.7)}` }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: LTOKENS.ink }}>{seat.name}</div>
          <Mono style={{ fontSize: 10.5, color: LTOKENS.ink3 }}>{seat.arch} · {seat.kind === 'cpu' ? 'CPU agent' : seat.owner}</Mono>
        </div>
        <div style={{ textAlign: 'right' }}>
          <ArenaCount value={composite} size={20} showSign={false} />
          <Mono style={{ fontSize: 8, color: LTOKENS.ink3, display: 'block', marginTop: 2, letterSpacing: '0.1em' }}>COMPOSITE</Mono>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '13px 14px', borderRadius: 12, background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` }}>
        <Icon name="lock" size={15} color={LTOKENS.ink3} style={{ marginTop: 1 }} />
        <div style={{ fontSize: 11.5, color: LTOKENS.ink2, lineHeight: 1.5 }}>
          A sealed snapshot — <b style={{ color: LTOKENS.ink }}>what</b> {seat.name} is climbing, not why. Their six-stock book, their three picks, their points and their agent&rsquo;s reasoning stay <b style={{ color: LTOKENS.ink }}>sealed until the battle completes</b> — then the Film Room opens.
        </div>
      </div>
    </AFocus>
  );
}

export function FilmRoomOverlay({ onClose }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', background: 'rgba(8,9,13,0.9)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} className="bv2-fadein">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 26px', flexShrink: 0 }}>
        <LIcon name="crown" size={22} color={LTOKENS.gold} stroke={2} />
        <div>
          <Eyebrow color={LTOKENS.gold}>The Film Room</Eyebrow>
          <div style={{ fontSize: 18, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.01em', marginTop: 2 }}>Everything sealed, now open</div>
        </div>
        <button className="bv2-tap" onClick={onClose} style={{ all: 'unset', marginLeft: 'auto', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '9px 14px', borderRadius: 10, background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair2}`, color: LTOKENS.ink2 }}>
          <LIcon name="arrowL" size={14} color={LTOKENS.ink2} /> <Mono style={{ fontSize: 11 }}>Back to the arena</Mono>
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 26px 28px' }}>
        <div style={{ maxWidth: 460, textAlign: 'center' }}>
          <Mono style={{ fontSize: 12.5, color: LTOKENS.ink2, lineHeight: 1.6 }}>
            The seal breaks here — every rival&rsquo;s full book, their points, and their agent&rsquo;s reasoning, unrolled across the week. The dossier room lands in the next phase of this build.
          </Mono>
        </div>
      </div>
    </div>
  );
}
