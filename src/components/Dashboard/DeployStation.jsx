// src/components/Dashboard/DeployStation.jsx
//
// "03 · Deploy" — the prototype's big filled "Deploy agent" CTA + the binding
// line. Reuses the shared deploy path via onDeploy. Rendered only when nothing
// is live (CommandDashboard swaps in Manage when a battle is live).
//
// VISUAL PASS: styling only — onDeploy/binding are unchanged.

import React from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { CMD, alpha, readableOn, Mono } from './commandUI';
import { getArchetypeDisplayName } from '../../data/archetypeDisplay';

export default function DeployStation({ agent, accent, deploying, onDeploy }) {
  const archetype = getArchetypeDisplayName(agent?.archetype);
  const watchlist = agent?.equippedWatchlistName;
  const disabled = deploying || !agent;
  const ink = readableOn(accent);

  return (
    <>
      <motion.button
        type="button"
        onClick={onDeploy}
        disabled={disabled}
        whileTap={disabled ? undefined : { scale: 0.985 }}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11,
          padding: '17px', borderRadius: 16, border: 'none', cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
          background: accent, color: ink, fontWeight: 700, fontSize: 16,
          boxShadow: `0 8px 28px ${alpha(accent, 0.34)}`, opacity: disabled ? 0.6 : 1,
        }}
      >
        <Zap size={19} color={ink} fill={ink} />
        <span style={{ letterSpacing: '-0.01em' }}>{deploying ? 'Deploying…' : 'Deploy agent'}</span>
      </motion.button>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
        <Mono style={{ fontSize: 10.5, letterSpacing: '0.06em', color: CMD.ink3, textTransform: 'uppercase', textAlign: 'center' }}>
          Binds today’s read + {archetype}{watchlist ? ` · ${watchlist}` : ''}
        </Mono>
      </div>
    </>
  );
}
