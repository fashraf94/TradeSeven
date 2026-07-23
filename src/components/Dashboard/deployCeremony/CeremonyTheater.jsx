// src/components/Dashboard/deployCeremony/CeremonyTheater.jsx
//
// Deploy Ceremony · Act 2 — the animated thinking theater (spec §5). Five display
// stages driven by real checkpoints; every value shown is a real artifact of this
// deploy. HONESTY RULE (§1): nothing here invents content to cover latency — the
// scan counter climbs and settles on the true scanCount (never a literal universe
// size), the brief is the agent's own excerpt (or an honest fallback per §6), and
// the construction slots pulse ambiently then lock to the REAL picks. No fake
// tickers are cycled (the visual reference's samples are deliberately dropped).

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CMD, alpha, Mono, MONO } from '../commandUI';
import { isExcerptTruncated } from './ceremonyData';

const STAGE_LABEL = {
  loadout: 'Loading the loadout',
  scanning: 'Scanning the market',
  brief: 'Strategy brief',
  portfolio: 'Constructing portfolio',
};
const STAGE_ORDER = ['loadout', 'scanning', 'brief', 'portfolio'];

// ── Stage indicator — 4 dots, glow reserved for the active one (spec §5). ──────
function StageDots({ activeIndex, accent }) {
  return (
    <span style={{ display: 'flex', gap: 6 }}>
      {STAGE_ORDER.map((_, i) => {
        const done = i < activeIndex;
        const on = i === activeIndex;
        return (
          <span
            key={i}
            style={{
              width: on ? 7 : 6, height: on ? 7 : 6, borderRadius: '50%',
              background: on || done ? accent : CMD.hair2,
              boxShadow: on ? `0 0 9px ${alpha(accent, 0.75)}` : 'none',
              transition: 'background .3s, box-shadow .3s',
            }}
          />
        );
      })}
    </span>
  );
}

// ── Stage 1 chip — materializes in; best-effort, omitted when data is absent. ──
function Chip({ children, accent, delay }) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999,
        fontSize: 12, color: CMD.ink, background: alpha(accent, 0.08), border: `1px solid ${alpha(accent, 0.24)}`,
      }}
    >
      {children}
    </motion.span>
  );
}

// ── Stage 2 counter — climbs without a hardcoded target, settles on scanCount. ─
function ScanCounter({ scanCount }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const settleFromRef = useRef(null);
  const settleStartRef = useRef(0);

  useEffect(() => {
    startRef.current = performance.now();
    const loop = () => {
      const now = performance.now();
      if (scanCount != null) {
        // Settle: ease from the current climbing value to the true count.
        if (settleFromRef.current == null) {
          settleFromRef.current = display;
          settleStartRef.current = now;
        }
        const p = Math.min(1, (now - settleStartRef.current) / 550);
        const eased = 1 - Math.pow(1 - p, 3);
        const val = Math.round(settleFromRef.current + (scanCount - settleFromRef.current) * eased);
        setDisplay(val);
        if (p < 1) { rafRef.current = requestAnimationFrame(loop); return; }
        setDisplay(scanCount);
        return;
      }
      // Climb: a decelerating curve toward an unknown ceiling (never the real
      // universe size — that only arrives as scanCount).
      const elapsed = now - startRef.current;
      setDisplay(Math.floor((1 - Math.exp(-elapsed / 1600)) * 940));
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanCount]);

  return (
    <div style={{ textAlign: 'center', paddingTop: 12 }}>
      <div style={{ fontFamily: MONO, fontSize: 38, fontWeight: 600, color: CMD.ink, lineHeight: 1 }}>{display}</div>
      <Mono style={{ fontSize: 11.5, color: CMD.ink3, marginTop: 4, display: 'block', letterSpacing: '0.06em' }}>symbols read</Mono>
    </div>
  );
}

// ── Stage 3 typewriter — reveals the real excerpt at ~16ms/char. ───────────────
function Typewriter({ text, speed = 16 }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (!text) return undefined;
    let i = 0;
    const iv = setInterval(() => {
      i += 1;
      setN(i);
      if (i >= text.length) clearInterval(iv);
    }, speed);
    return () => clearInterval(iv);
  }, [text, speed]);
  return <span>{text ? text.slice(0, n) : ''}</span>;
}

function StageBrief({ briefExcerpt, shortlistCount, fallbackKind, fullBrief, agentName, accent }) {
  const done = useTypeDone(briefExcerpt);
  // §6 disambiguation of a null excerpt.
  if (fallbackKind === 'strategy') {
    return (
      <div style={{ paddingTop: 10 }}>
        <div style={{ fontSize: 14, lineHeight: 1.6, color: CMD.ink2, fontStyle: 'italic' }}>
          {agentName} went with its instincts today.
        </div>
        {shortlistCount != null && (
          <Mono style={{ fontSize: 12, color: accent, marginTop: 12, display: 'block' }}>{shortlistCount} candidates flagged</Mono>
        )}
      </div>
    );
  }
  if (briefExcerpt == null) {
    // A real brief exists but no honest excerpt could be taken — neutral beat,
    // NO brief text, and NEVER the instincts copy (the agent did reason). §6.
    return (
      <div style={{ paddingTop: 10 }}>
        <div style={{ fontSize: 14, lineHeight: 1.6, color: CMD.ink2 }}>Working through the read…</div>
        {shortlistCount != null && (
          <Mono style={{ fontSize: 12, color: accent, marginTop: 12, display: 'block' }}>{shortlistCount} candidates flagged</Mono>
        )}
      </div>
    );
  }
  const truncated = isExcerptTruncated(briefExcerpt, fullBrief);
  return (
    <div style={{ paddingTop: 8 }}>
      <div style={{ fontSize: 13.5, lineHeight: 1.6, color: CMD.ink, borderLeft: `2px solid ${alpha(accent, 0.5)}`, paddingLeft: 10, minHeight: 92 }}>
        <Typewriter text={briefExcerpt} />
        {/* Truncation continuation indicator — view layer only (§6 / A.2 §5.3). */}
        {truncated && done && <span style={{ color: CMD.ink3 }}>…</span>}
      </div>
      {shortlistCount != null && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: done ? 1 : 0 }} transition={{ duration: 0.4 }}>
          <Mono style={{ fontSize: 12, color: accent, marginTop: 12, display: 'block' }}>{shortlistCount} candidates flagged</Mono>
        </motion.div>
      )}
    </div>
  );
}

// Small helper: has the typewriter for `text` finished? (approximate, time-based)
function useTypeDone(text) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    setDone(false);
    if (!text) { setDone(true); return undefined; }
    const t = setTimeout(() => setDone(true), text.length * 16 + 60);
    return () => clearTimeout(t);
  }, [text]);
  return done;
}

// ── Stage 4 — ambient slots that lock to the REAL picks once they arrive. ──────
function StagePortfolio({ picks, accent }) {
  const hasPicks = picks && picks.length > 0;
  const slots = hasPicks ? picks : Array.from({ length: 6 }, () => null);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, paddingTop: 10 }}>
      {slots.map((sym, i) => (
        <motion.div
          key={i}
          initial={false}
          animate={sym
            ? { borderColor: alpha(accent, 0.5), color: accent }
            : { borderColor: CMD.hair2, color: CMD.ink3 }}
          transition={{ delay: sym ? i * 0.09 : 0, duration: 0.3 }}
          style={{
            height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10,
            border: `1px solid ${CMD.hair2}`, background: sym ? alpha(accent, 0.08) : CMD.surface,
            fontFamily: MONO, fontSize: 13, fontWeight: 600,
          }}
        >
          {sym ? (
            <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.09 }}>{sym}</motion.span>
          ) : (
            <motion.span
              aria-hidden
              animate={{ opacity: [0.25, 0.6, 0.25] }}
              transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.12 }}
            >
              ·
            </motion.span>
          )}
        </motion.div>
      ))}
    </div>
  );
}

export default function CeremonyTheater({
  accent, agentName, stageKey, stageIndex, slow, canSkip, onSkip,
  // stage 1
  archetype, watchlistName, watchlistSymbols, directiveCount, regime,
  // stage 2
  scanCount,
  // stage 3
  briefExcerpt, shortlistCount, fallbackKind, fullBrief,
  // stage 4
  picks,
}) {
  const chips = [];
  if (archetype) chips.push(<Chip key="a" accent={accent} delay={0.1}>{archetype}</Chip>);
  if (watchlistName) {
    const symLine = watchlistSymbols && watchlistSymbols.length
      ? `${watchlistName} · ${watchlistSymbols.slice(0, 4).join(' · ')}`
      : watchlistName;
    chips.push(<Chip key="w" accent={accent} delay={0.3}>{symLine}</Chip>);
  }
  if (directiveCount > 0) chips.push(<Chip key="d" accent={accent} delay={0.5}>{directiveCount} directive{directiveCount === 1 ? '' : 's'} active</Chip>);
  if (regime) chips.push(<Chip key="r" accent={accent} delay={0.7}>Regime: {regime}</Chip>);

  return (
    <div style={{ width: '100%', maxWidth: 420, margin: '0 auto', padding: '0 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Mono style={{ fontSize: 11, letterSpacing: '0.16em', color: accent, textTransform: 'uppercase', fontWeight: 600 }}>
          {STAGE_LABEL[stageKey]}
        </Mono>
        <StageDots activeIndex={stageIndex} accent={accent} />
      </div>

      <div style={{ minHeight: 200 }}>
        {stageKey === 'loadout' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 6 }}>
            {chips.length > 0
              ? chips
              : <Mono style={{ fontSize: 12.5, color: CMD.ink3 }}>Reading your loadout…</Mono>}
          </div>
        )}
        {stageKey === 'scanning' && <ScanCounter scanCount={scanCount} />}
        {stageKey === 'brief' && (
          <StageBrief
            briefExcerpt={briefExcerpt}
            shortlistCount={shortlistCount}
            fallbackKind={fallbackKind}
            fullBrief={fullBrief}
            agentName={agentName}
            accent={accent}
          />
        )}
        {stageKey === 'portfolio' && <StagePortfolio picks={picks} accent={accent} />}
      </div>

      {/* Slow state — quiet status line after 45s (spec §5.2). */}
      {slow && (
        <Mono style={{ display: 'block', textAlign: 'center', fontSize: 11.5, color: CMD.ink3, marginTop: 18, lineHeight: 1.5 }}>
          Taking longer than usual — still thinking.
        </Mono>
      )}

      {/* Skip — appears only after strategy_complete; still gates the reveal on
          the dual signal (spec §5.2). */}
      {canSkip && (
        <button
          type="button"
          onClick={onSkip}
          style={{
            display: 'block', margin: '18px auto 0', padding: '4px 10px', background: 'transparent', border: 'none',
            cursor: 'pointer', fontFamily: 'inherit', color: CMD.ink3, fontSize: 12, fontWeight: 600,
            textDecoration: 'underline', textUnderlineOffset: 3,
          }}
        >
          Skip to reveal
        </button>
      )}
    </div>
  );
}
