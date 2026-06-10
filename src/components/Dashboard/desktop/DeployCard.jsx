// src/components/Dashboard/desktop/DeployCard.jsx
//
// Center column · "03 · Deploy" — the desktop horizontal deploy card: a binding
// summary on the left, the filled accent Deploy CTA on the right (vs the mobile
// DeployStation's full-width button). Reuses the shared deploy path via onDeploy
// — the shell owns the deployAgent call + the `deploying` flag. Rendered only
// when nothing is live.

import React from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { CMD, alpha, readableOn, Mono } from '../commandUI';
import { getArchetypeDisplayName } from '../../../data/archetypeDisplay';

export default function DeployCard({ agent, accent, deploying, onDeploy, agentName, deployText }) {
  const archetype = getArchetypeDisplayName(agent?.archetype);
  const watchlist = agent?.equippedWatchlistName;
  const disabled = deploying || !agent;
  const ink = readableOn(accent);
  const name = agentName || agent?.name || 'your agent';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px', borderRadius: 18,
      background: `linear-gradient(135deg, ${alpha(accent, 0.08)}, ${CMD.surface})`,
      border: `1px solid ${alpha(accent, 0.2)}`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: CMD.ink }}>Send {name} into battle</div>
        <Mono style={{ fontSize: 10.5, letterSpacing: '0.04em', color: CMD.ink3, marginTop: 5, display: 'block' }}>
          Binds today’s read + {archetype}{watchlist ? ` · ${watchlist}` : ''}
        </Mono>
      </div>
      <motion.button
        type="button"
        onClick={onDeploy}
        disabled={disabled}
        whileTap={disabled ? undefined : { scale: 0.985 }}
        style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          padding: '16px 30px', borderRadius: 14, border: 'none', cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
          background: accent, color: ink, fontWeight: 700, fontSize: 16,
          boxShadow: `0 8px 28px ${alpha(accent, 0.34)}`, opacity: disabled ? 0.6 : 1,
        }}
      >
        <Zap size={19} color={ink} fill={ink} />
        <span style={{ letterSpacing: '-0.01em' }}>{deploying ? 'Deploying…' : deployText}</span>
      </motion.button>
    </div>
  );
}
