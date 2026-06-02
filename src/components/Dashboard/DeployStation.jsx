// src/components/Dashboard/DeployStation.jsx
//
// "03 · Deploy" — the primary CTA when the agent is equipped and nothing is
// live. Reuses the shared deploy path (via onDeploy → deployAgent). When a
// battle is already live it gives way to Manage (no deploying over a live one).
// Functional wiring only; the cohesive visual pass is a separate end-of-build task.

import React from 'react';
import { motion } from 'framer-motion';
import { Rocket, Activity } from 'lucide-react';
import HoloCard from '../shared/HoloCard';
import { getArchetypeDisplayName } from '../../data/archetypeDisplay';

function hexToRgba(hex, a) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return `rgba(94,234,212,${a})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}
function readableText(hex) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return '#ffffff';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#0a0b10' : '#ffffff';
}

export default function DeployStation({ agent, accent, tokens, isLive, deploying, onDeploy }) {
  const archetype = getArchetypeDisplayName(agent?.archetype);
  const watchlist = agent?.equippedWatchlistName || 'the full board';

  return (
    <HoloCard
      size="lg"
      style={{
        background: tokens.bgCard,
        border: `1px solid ${tokens.borderDefault}`,
        boxShadow: tokens.obsidianShadow,
        borderTop: `2px solid ${hexToRgba(accent, 0.55)}`,
      }}
    >
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase',
        color: accent, marginBottom: 12,
      }}>
        03 · Deploy
      </div>

      {isLive ? (
        // Give way to Manage — no deploying over a live battle.
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: tokens.textMuted, fontSize: 13 }}>
          <Activity size={16} color={tokens.textMuted} />
          A battle is live — manage it below.
        </div>
      ) : (
        <>
          <motion.button
            type="button"
            onClick={onDeploy}
            disabled={deploying || !agent}
            whileTap={deploying || !agent ? undefined : { scale: 0.98 }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '13px 16px', borderRadius: 12, border: 'none',
              cursor: deploying || !agent ? 'default' : 'pointer', fontFamily: 'inherit',
              background: accent, color: readableText(accent), fontSize: 15, fontWeight: 700,
              boxShadow: `0 0 18px ${hexToRgba(accent, 0.32)}`,
              opacity: deploying || !agent ? 0.6 : 1,
            }}
          >
            <Rocket size={17} />
            {deploying ? 'Deploying…' : 'Deploy on this read'}
          </motion.button>
          <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 10, textAlign: 'center', lineHeight: 1.5 }}>
            Binds today’s read + {archetype} · {watchlist}
          </div>
        </>
      )}
    </HoloCard>
  );
}
