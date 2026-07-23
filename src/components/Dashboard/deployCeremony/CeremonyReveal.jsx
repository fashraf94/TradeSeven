// src/components/Dashboard/deployCeremony/CeremonyReveal.jsx
//
// Deploy Ceremony · Act 3 — the reveal (spec §7). "Ready for battle", the picks
// (derived by construction from the one stored lastDecision.portfolio — §9
// display-agreement), one line of the agent's own reasoning, and an explicit CTA.
// The user WALKS in (onEnterBattle) — never teleported. "Back to hub" dismisses;
// the deploy stays live and the Active Deployments card already reflects it.

import React from 'react';
import { motion } from 'framer-motion';
import { Swords, ArrowLeft } from 'lucide-react';
import { CMD, alpha, readableOn, Mono, Eyebrow, MONO } from '../commandUI';

export default function CeremonyReveal({
  accent = CMD.teal, agentName = 'Your agent', picks = [], monologue = null,
  onEnterBattle, onDismiss, reduce = false,
}) {
  const ink = readableOn(accent);

  return (
    <div style={{ width: '100%', maxWidth: 440, margin: '0 auto', padding: '0 22px' }}>
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduce ? 0 : 0.4 }}
      >
        <Eyebrow color={accent} style={{ marginBottom: 8, letterSpacing: '0.24em' }}>Deployment complete</Eyebrow>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: CMD.ink, marginBottom: 18, lineHeight: 1.25 }}>
          {agentName} is ready for battle.
        </div>
      </motion.div>

      {picks.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: monologue ? 18 : 22 }}>
          {picks.map((sym, i) => (
            <motion.div
              key={`${sym}-${i}`}
              initial={reduce ? false : { opacity: 0, scale: 0.8, rotateY: -55 }}
              animate={{ opacity: 1, scale: 1, rotateY: 0 }}
              transition={reduce ? { duration: 0 } : { delay: 0.15 + i * 0.11, type: 'spring', stiffness: 320, damping: 22 }}
              style={{
                height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 11, background: alpha(accent, 0.1), border: `1px solid ${alpha(accent, 0.34)}`,
                fontFamily: MONO, fontSize: 14, fontWeight: 600, color: accent, letterSpacing: '0.02em',
              }}
            >
              {sym}
            </motion.div>
          ))}
        </div>
      )}

      {monologue && (
        <motion.blockquote
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduce ? 0 : 0.15 + picks.length * 0.11 + 0.25, duration: reduce ? 0 : 0.5 }}
          style={{
            margin: '0 0 22px', padding: '2px 0 2px 12px', borderLeft: `2px solid ${alpha(accent, 0.5)}`,
            fontSize: 13.5, lineHeight: 1.55, color: CMD.ink2, fontStyle: 'italic',
          }}
        >
          “{monologue}”
        </motion.blockquote>
      )}

      <motion.button
        type="button"
        onClick={onEnterBattle}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: reduce ? 0 : 0.15 + picks.length * 0.11 + 0.5, duration: reduce ? 0 : 0.4 }}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          padding: '16px', borderRadius: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          background: accent, color: ink, fontWeight: 700, fontSize: 15.5,
          boxShadow: `0 8px 28px ${alpha(accent, 0.34)}`,
        }}
      >
        <Swords size={18} color={ink} /> Enter the battle
      </motion.button>

      <button
        type="button"
        onClick={onDismiss}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
          padding: '13px', marginTop: 10, borderRadius: 13, border: 'none', background: 'transparent',
          color: CMD.ink3, fontFamily: 'inherit', fontWeight: 600, fontSize: 13, cursor: 'pointer',
        }}
      >
        <ArrowLeft size={15} /> Back to hub
      </button>
    </div>
  );
}
