// src/components/League/draft/DraftForming.jsx
//
// The forming state — the room assembling, then "Enter the board". Ported from
// the design (DeskForming / MobileForming), collapsed onto the board itself
// (spec §3): it covers the entry latency (the draft-state subscription + the
// universe read; formation itself completed in the lobby) and gives the first
// pick its moment. Shown only on a fresh pod (pick #1); a resumed mid-draft pod
// skips straight to the board. Resume / Customize-loadout live in the lobby
// (LeagueLobbyRedesign · TrainingShell), which routes here — honored upstream.

import React, { useState, useEffect } from 'react';
import { TOKENS, DX, alpha } from './draftTokens';
import { Icon } from './draftIcons';
import { Mono, Eyebrow, SeatAvatar } from './draftPrimitives';
import { archMeta } from './boardModel';

const STEP_MS = [450, 850, 1250, 1700, 2300];

// seats: [{ isCpu, isYou, label }] (length GROUP_SIZE). ready = data loaded.
// `mode` ('training' | 'competitive') selects the eyebrow title + the intro copy;
// default 'training' → byte-identical to before the Phase-4 genericization.
export function DraftForming({ archKey, seats = [], ready = false, onEnter, narrow = false, mode = 'training' }) {
  const a = archMeta(archKey);
  const competitive = mode === 'competitive';
  const [step, setStep] = useState(0);
  useEffect(() => {
    const ts = STEP_MS.map((ms, i) => setTimeout(() => setStep(i + 1), ms));
    return () => ts.forEach(clearTimeout);
  }, []);
  const animDone = step >= STEP_MS.length;
  const canEnter = ready && animDone;
  const avatar = narrow ? 46 : 56;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: narrow ? '0 26px' : '0 60px', textAlign: 'center',
      background: `radial-gradient(circle at 50% 28%, ${alpha(DX.you, 0.07)}, transparent 60%)` }}>
      <Eyebrow color={DX.you} style={{ marginBottom: narrow ? 20 : 22 }}>{competitive ? 'Live Draft' : 'Training Draft'} · {canEnter ? 'Table ready' : 'Forming'}</Eyebrow>

      {/* the seats assembling */}
      <div style={{ display: narrow ? 'grid' : 'flex', gridTemplateColumns: narrow ? '1fr 1fr' : undefined,
        gap: narrow ? '20px 30px' : 30, alignItems: 'center', marginBottom: narrow ? 26 : 34 }}>
        {seats.map((s, i) => {
          const on = step > i;
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, opacity: on ? 1 : 0.28,
              transform: on ? 'none' : 'translateY(8px)', transition: 'all .5s cubic-bezier(.22,1,.36,1)' }}>
              <SeatAvatar isCpu={s.isCpu} size={avatar} live={on} />
              <div>
                <div style={{ fontSize: narrow ? 13 : 14, fontWeight: 700, color: s.isYou ? DX.you : TOKENS.ink }}>{s.label}</div>
                <Mono style={{ fontSize: 9.5, color: on ? (s.isCpu ? DX.cpu : DX.you) : TOKENS.ink3, letterSpacing: '0.06em' }}>
                  {on ? (s.isCpu ? 'CPU' : a.name) : 'connecting…'}
                </Mono>
              </div>
            </div>
          );
        })}
      </div>

      {/* progress */}
      <div style={{ width: narrow ? 200 : 320, height: 2, borderRadius: 2, background: TOKENS.surface, overflow: 'hidden', marginBottom: narrow ? 24 : 30 }}>
        <div style={{ height: '100%', width: `${(Math.min(step, STEP_MS.length) / STEP_MS.length) * 100}%`, background: DX.you, transition: 'width .5s ease', boxShadow: `0 0 8px ${alpha(DX.you, 0.7)}` }} />
      </div>

      <div style={{ fontSize: narrow ? 26 : 34, fontWeight: 700, color: TOKENS.ink, letterSpacing: '-0.02em', marginBottom: 12,
        opacity: canEnter ? 1 : 0.4, transition: 'opacity .4s ease' }}>
        {canEnter ? 'You have the first pick' : 'Seating the table…'}
      </div>
      <div style={{ fontSize: narrow ? 13.5 : 15, color: TOKENS.ink2, lineHeight: 1.55, maxWidth: 560, marginBottom: narrow ? 24 : 28 }}>
        {competitive ? (
          <>Draft a three-stock lineup against your pod, snake-style — empty seats fill with CPUs when the draft fires.{' '}
          Your board is ranked for a <span style={{ color: a.tint, fontWeight: 600 }}>{a.name}</span> — take from the top and you draft well, every time.</>
        ) : (
          <>This is <b style={{ color: TOKENS.ink }}>practice — no stakes.</b> Draft a three-stock lineup against three CPU agents, snake-style.{' '}
          Your board is ranked for a <span style={{ color: a.tint, fontWeight: 600 }}>{a.name}</span> — take from the top and you draft well, every time.</>
        )}
      </div>

      <button className="ld-tap" onClick={canEnter ? onEnter : undefined} disabled={!canEnter} style={{ all: 'unset', boxSizing: 'border-box',
        cursor: canEnter ? 'pointer' : 'default', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        padding: narrow ? '15px 24px' : '15px 30px', borderRadius: 13, background: canEnter ? DX.you : TOKENS.surface,
        color: canEnter ? TOKENS.bg : TOKENS.ink3, fontWeight: 700, fontSize: narrow ? 15.5 : 16,
        boxShadow: canEnter ? `0 10px 30px ${alpha(DX.you, 0.3)}` : 'none', border: canEnter ? 'none' : `1px solid ${TOKENS.hair}`, transition: 'all .3s ease' }}>
        {canEnter ? 'Enter the board' : 'Seating the table…'} {canEnter && <Icon name="arrowR" size={18} color={TOKENS.bg} />}
      </button>
    </div>
  );
}

export default DraftForming;
