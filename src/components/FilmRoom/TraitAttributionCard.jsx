// src/components/FilmRoom/TraitAttributionCard.jsx
//
// Phase 1B step 3 — post-battle attribution tags. Rolls the battle's cited forge
// rules up to the trait CARD that owns them ("Your Iron Discipline shaped N
// decisions this battle"). Honest + partial: shared rules (th-01/mb-08) and
// manually-bundled rules are NOT attributed (see computeBattleTraitAttribution).
// Battle-level (not per-day); renders nothing when there's nothing certain to show.

import React, { useMemo } from 'react';
import { computeBattleTraitAttribution } from '../../services/forgeStatsService';

export default function TraitAttributionCard({ battle, tokens = {}, onEngage }) {
  const attribution = useMemo(() => computeBattleTraitAttribution(battle), [battle]);
  if (!attribution.length) return null;

  const ink = tokens.textPrimary || '#e6e9ef';
  const muted = tokens.textMuted || '#94a3b8';
  const faint = tokens.textFaint || '#64748b';
  const accent = '#5EEAD4';

  return (
    <div
      style={{
        margin: '0 14px', padding: '13px 15px', borderRadius: 14,
        background: '#15171E', border: '1px solid #2A2D35',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: muted, marginBottom: 9 }}>
        How your cards shaped this battle
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {attribution.map((a) => (
          <button
            key={a.traitId}
            type="button"
            onClick={onEngage ? () => onEngage(a.traitId) : undefined}
            style={{
              all: 'unset', cursor: onEngage ? 'pointer' : 'default',
              display: 'flex', alignItems: 'baseline', gap: 8,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent, flexShrink: 0, transform: 'translateY(-1px)' }} />
            <span style={{ fontSize: 13, color: ink, lineHeight: 1.4 }}>
              <strong style={{ fontWeight: 700 }}>{a.traitName}</strong> shaped{' '}
              <strong style={{ fontWeight: 700, color: accent }}>{a.decisions}</strong>{' '}
              decision{a.decisions === 1 ? '' : 's'} this battle
            </span>
          </button>
        ))}
      </div>

      <div style={{ fontSize: 10.5, color: faint, marginTop: 9, lineHeight: 1.4 }}>
        Only decisions a single card clearly drove are counted. Shared rules and manually-added rules aren’t attributed.
      </div>
    </div>
  );
}
