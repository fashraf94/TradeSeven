// src/components/League/LeagueAction.jsx
//
// The action layer behind "Enter tournament" — two options only (Quick Play /
// Ranked Play; no private-group option). The Monday-start lifecycle is stated
// plainly at the commit point. Transcribed from the Claude Design prototype
// (league-action.jsx). Overlays are real position:fixed modals.

import React from 'react';
import AgentOrb from '../shared/AgentOrb';
import { LTOKENS, LX, alpha, MONO } from './leagueTokens';
import { Eyebrow, Mono, Icon, LIcon } from './LeagueParts';

function ActionOption({ icon, color, title, kicker, body, honest, onPick }) {
  return (
    <button
      className="lg-tap"
      onClick={onPick}
      style={{
        all: 'unset', boxSizing: 'border-box', width: '100%', cursor: 'pointer', display: 'block',
        padding: '17px 16px', borderRadius: 18, background: `linear-gradient(160deg, ${alpha(color, 0.1)}, ${LTOKENS.surface} 62%)`,
        border: `1px solid ${alpha(color, 0.34)}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: alpha(color, 0.16), border: `1px solid ${alpha(color, 0.4)}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LIcon name={icon} size={20} color={color} stroke={1.9} />
        </div>
        <div style={{ flex: 1 }}>
          <Mono style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: alpha(color, 0.95) }}>{kicker}</Mono>
          <div style={{ fontSize: 18, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.01em', marginTop: 2 }}>{title}</div>
        </div>
        <Icon name="arrowR" size={20} color={color} />
      </div>
      <div style={{ fontSize: 13, color: LTOKENS.ink2, lineHeight: 1.5, marginTop: 12 }}>{body}</div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginTop: 11, padding: '9px 11px', borderRadius: 10, background: LTOKENS.bg, border: `1px solid ${LTOKENS.hair}` }}>
        <LIcon name="cpu" size={13} color={LX.cpu} stroke={2} style={{ marginTop: 1, flexShrink: 0 }} />
        <div style={{ fontSize: 11, color: LTOKENS.ink3, lineHeight: 1.45 }}>{honest}</div>
      </div>
    </button>
  );
}

export function ActionLayer({ accent, onClose, onPick }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, color: LTOKENS.ink }}>
      <div className="lg-tap" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(5,6,9,0.72)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }} />
      <div
        className="lg-scroll"
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, margin: '0 auto', width: '100%', maxWidth: 448,
          background: LTOKENS.bg, borderRadius: '22px 22px 0 0', border: `1px solid ${LTOKENS.hair2}`, borderBottom: 'none',
          padding: '14px 18px calc(env(safe-area-inset-bottom, 0px) + 32px)', boxShadow: '0 -20px 60px rgba(0,0,0,0.5)',
          maxHeight: '92%', overflowY: 'auto', animation: 'lgSheetIn 0.28s ease',
        }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 4, background: LTOKENS.hair2, margin: '0 auto 18px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <Eyebrow color={accent}>Enter tournament</Eyebrow>
          <button className="lg-tap" onClick={onClose} style={{ all: 'unset', cursor: 'pointer', width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` }}>
            <Icon name="x" size={15} color={LTOKENS.ink2} />
          </button>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 16 }}>Pick your mode</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ActionOption
            icon="play" color={LX.energy} kicker="Solo · Training" title="Quick Play"
            body="Jump into a practice group of four against CPU opponents. No stakes, no waiting — start anytime and tune your picks and your agent."
            honest="Every other seat here is a CPU. Great for learning the format before you enter the bracket."
            onPick={() => onPick('quick')}
          />
          <ActionOption
            icon="ranked" color={LX.comp} kicker="Competitive · This month's bracket" title="Ranked Play"
            body="The real bracket. You're drawn into a named group of four — finish top two on combined score and you advance through the funnel toward the Final Four."
            honest="If your group isn't full of humans, empty seats run as CPU — the same pods you just watched. Honest competition either way."
            onPick={() => onPick('ranked')}
          />
        </div>

        {/* the Monday-start truth — stated plainly at the point of commit */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, padding: '12px 14px', borderRadius: 13, background: alpha(accent, 0.07), border: `1px solid ${alpha(accent, 0.22)}` }}>
          <Icon name="clock" size={17} color={accent} />
          <div style={{ fontSize: 12, color: LTOKENS.ink2, lineHeight: 1.45 }}>
            <b style={{ color: LTOKENS.ink }}>Your group locks Monday.</b> That&apos;s when the draft runs and the trading week begins. Join any time before — your seat is held.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Confirmation after picking a mode — closes the loop on "joined". ───────
export function JoinConfirm({ mode, onClose, onWatch }) {
  const quick = mode === 'quick';
  const color = quick ? LX.energy : LX.comp;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1001, color: LTOKENS.ink,
      background: `radial-gradient(circle at 50% 36%, ${alpha(color, 0.16)}, transparent 60%), ${LTOKENS.bg}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 34px',
    }}>
      <AgentOrb state="ready" size={104} color={color} />
      <Mono style={{ fontSize: 10.5, letterSpacing: '0.2em', textTransform: 'uppercase', color, marginTop: 26 }}>
        {quick ? 'Quick Play' : "Ranked · This month's bracket"}
      </Mono>
      <div style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 9 }}>Seat reserved</div>
      <div style={{ fontSize: 13.5, color: LTOKENS.ink2, lineHeight: 1.55, marginTop: 11, maxWidth: 320 }}>
        {quick
          ? <>Your training group is ready against CPU opponents. <b style={{ color: LTOKENS.ink }}>The draft runs Monday</b> — that&apos;s when trading opens. We&apos;ll bring your picks and agent in then.</>
          : <>You&apos;re drawn into a group of four for this month&apos;s bracket. <b style={{ color: LTOKENS.ink }}>Your group locks Monday</b> when the draft runs; empty seats run as CPU until humans arrive.</>}
      </div>
      <button className="lg-tap" onClick={onWatch} style={{ all: 'unset', cursor: 'pointer', marginTop: 26, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, width: '100%', maxWidth: 300, padding: '14px', borderRadius: 13, background: color, color: LTOKENS.bg, fontWeight: 700, fontSize: 14.5, boxShadow: `0 8px 24px ${alpha(color, 0.32)}` }}>
        <LIcon name="eyeR" size={16} color={LTOKENS.bg} /> Watch a live game while you wait
      </button>
      <button className="lg-tap" onClick={onClose} style={{ all: 'unset', cursor: 'pointer', marginTop: 12, color: LTOKENS.ink3, fontFamily: MONO, fontSize: 11.5, letterSpacing: '0.08em' }}>BACK TO LOBBY</button>
    </div>
  );
}
