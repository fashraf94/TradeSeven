// src/components/Forge/TraitCard.jsx
// Compact card for a single trait inside a DNA group.

import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, Search, Zap, BarChart3, ArrowUpRight, Compass,
  Target, CheckCheck, Gauge, RefreshCw, ShieldAlert,
  Lock, Clock, Repeat, PieChart, Rocket,
} from 'lucide-react';
import TraitStrengthToggle from './TraitStrengthToggle';
import { FORGE_RULE_TEMPLATES } from '../../data/forgeKnowledgeBase';
import { getTraitFamily, getFamilyMeta, isArchetypeAligned } from '../../data/traitFamilies';

const TRAIT_ICONS = {
  TrendingUp, Search, Zap, BarChart3, ArrowUpRight, Compass,
  Target, CheckCheck, Gauge, RefreshCw, ShieldAlert,
  Lock, Clock, Repeat, PieChart, Rocket,
};

function getIcon(name, props) {
  const Icon = TRAIT_ICONS[name];
  return Icon ? <Icon {...props} /> : null;
}

const STRENGTH_DESCRIPTIONS = {
  'trait-trend-rider': {
    subtle: 'Follows trends loosely — flexible entry points, wide momentum zone',
    moderate: 'Standard trend following — confirmed setups, balanced filters',
    dominant: 'Strongly favors the cleanest aligned setups',
  },
  'trait-bargain-hunter': {
    subtle: 'Light oversold preference — casts a wide net for dip candidates',
    moderate: 'Standard mean reversion — targets clear oversold signals',
    dominant: 'Strongly favors deep-oversold names with tight filters',
  },
  'trait-squeeze-whisperer': {
    subtle: 'Watches for broad volatility compression patterns',
    moderate: 'Targets confirmed squeezes with directional momentum',
    dominant: 'Strongly favors the tightest squeezes with clear momentum',
  },
  'trait-volume-believer': {
    subtle: 'Prefers above-average volume — soft confirmation requirement',
    moderate: 'Leans toward solid volume spikes for participation',
    dominant: 'Strongly favors heavy volume before trusting a move',
  },
  'trait-breakout-chaser': {
    subtle: 'Leans toward stocks near highs — moderate RS requirement',
    moderate: 'Targets breakout leaders near new highs',
    dominant: 'Strongly favors top breakout candidates with elite relative strength',
  },
  'trait-smart-money-tracker': {
    subtle: 'Follows VWAP loosely — broad institutional flow preference',
    moderate: 'Leans toward confirmed VWAP support',
    dominant: 'Strongly favors tight VWAP alignment with sector flow',
  },
  'trait-threshold-harvester': {
    subtle: 'Balanced scoring approach — harvests only after Double Bagger',
    moderate: 'Active harvesting — rotates after every BaggerBomb bonus',
    dominant: 'Maximum harvest rate — rotates after any positive threshold hit',
  },
  'trait-dual-conviction': {
    subtle: 'Both scores a bit above average',
    moderate: 'Solid on fundamentals and technicals',
    dominant: 'Strongly favors names that top both dimensions',
  },
  'trait-score-adaptor': {
    subtle: 'Gentle adaptation — small shifts when winning or losing',
    moderate: 'Standard score awareness — clear mode shifts based on position',
    dominant: 'Aggressive adaptation — sharp pivots between offense and defense',
  },
  'trait-sector-rotator': {
    subtle: 'Gradual sector tilts — slow rotation, broad exposure allowed',
    moderate: 'Active sector rotation — follows FantasyTimes signals promptly',
    dominant: 'Aggressive rotation — concentrates in leading sectors, fast response',
  },
  'trait-penalty-dodger': {
    subtle: 'Mild bust-aversion — leans slightly toward safer placements for volatile names',
    moderate: 'Strong bust-aversion — biases away from putting volatile names in high tiers',
    dominant: 'Strongly leans toward safer tiers for volatile names',
  },
  'trait-iron-discipline': {
    subtle: 'Light discipline lean — a bit quicker to give up on laggards',
    moderate: 'Balanced discipline lean — biases toward cutting losers and not chasing falling names',
    dominant: 'Discipline-first — strongly biases toward cutting losers fast',
  },
  'trait-patient-holder': {
    subtle: 'Light patience lean — slightly slower to react to dips',
    moderate: 'Balanced patience — biases toward giving picks time over reacting to every dip',
    dominant: 'Maximum patience — strongly biases toward holding through the noise',
  },
  'trait-active-trader': {
    subtle: 'Light rotation lean — slightly quicker to move on from stalled names',
    moderate: 'Active rotation — biases toward cycling into what is working now',
    dominant: 'Hyper-active lean — strongly favors rotating out of stagnation',
  },
  'trait-diversifier': {
    subtle: 'Light diversification — minimum sector spread',
    moderate: 'Standard diversification — balanced barbell with sector coverage',
    dominant: 'Maximum diversification — heavy anchors, broad sector spread',
  },
  'trait-let-winners-run': {
    subtle: 'Light hold lean — inclined to hold winners a little longer',
    moderate: 'Holds winners — biases toward riding the best picks through scoring thresholds',
    dominant: 'Maximum conviction hold — strongly favors letting winners run',
  },
};

export default function TraitCard({
  trait,
  isEquipped,
  currentStrength,
  isCustom,
  onEquip,
  onUnequip,
  onStrengthChange,
  onAdvancedOpen,
  canEquip,
  groupColor,
  locked = false,
  blockedMessage = null,
  ruleControl = null,
}) {
  const [strength, setStrength] = useState(currentStrength || 'moderate');
  const [showDetails, setShowDetails] = useState(false);

  const ruleMap = useMemo(() => {
    const map = {};
    FORGE_RULE_TEMPLATES.forEach(r => { map[r.id] = r; });
    return map;
  }, []);

  // Sync local state when the prop changes (e.g., trait gets equipped externally)
  useEffect(() => {
    if (currentStrength) setStrength(currentStrength);
  }, [currentStrength]);

  const handleStrengthChange = (newStrength) => {
    setStrength(newStrength);
    if (isEquipped) {
      onStrengthChange(trait.id, newStrength);
    }
  };

  const handleEquip = () => {
    onEquip(trait.id, strength);
  };

  return (
    <div style={{
      background: '#15171E',
      border: `1px solid ${isEquipped ? groupColor : '#2A2D35'}`,
      borderRadius: 10,
      padding: '12px 14px',
      boxShadow: isEquipped ? `0 0 8px ${groupColor}40` : 'none',
      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    }}>
      {/* Top row: icon + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        {getIcon(trait.icon, { size: 18, color: groupColor, strokeWidth: 2 })}
        <span style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}>
          {trait.name}
        </span>
      </div>

      {/* Family + alignment chips — presentation overlay (does NOT affect slots/seeding) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
        {(() => {
          const fam = getFamilyMeta(getTraitFamily(trait.id));
          return (
            <span
              title={fam.tagline}
              style={{
                fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                color: fam.accent, background: `${fam.accent}1A`, border: `1px solid ${fam.accent}40`,
                padding: '2px 7px', borderRadius: 999,
              }}
            >
              {fam.short}
            </span>
          );
        })()}
        {isArchetypeAligned(trait.id) && (
          <span
            title="This card's selection lean mirrors an archetype's edge."
            style={{
              fontSize: 9.5, fontWeight: 600, letterSpacing: '0.04em',
              color: '#A0AEC0', background: '#FFFFFF0D', border: '1px solid #2A2D35',
              padding: '2px 7px', borderRadius: 999,
            }}
          >
            Archetype-aligned
          </span>
        )}
      </div>

      {/* Identity statement */}
      <div style={{
        fontSize: 12, color: '#718096', marginBottom: 4,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {trait.identityStatement}
      </div>

      {/* What's inside toggle */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        style={{
          background: 'none', border: 'none', padding: 0, marginTop: 4,
          fontSize: 11, color: '#5EEAD4', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        {showDetails ? '▾' : '▸'} What's inside ({trait.ruleIds.length} rules)
      </button>
      {showDetails && (
        <div style={{
          marginTop: 6, paddingLeft: 12, marginBottom: 6,
          borderLeft: `2px solid ${groupColor}30`,
        }}>
          <div style={{ fontSize: 10.5, color: '#718096', marginBottom: 6, lineHeight: 1.35, fontStyle: 'italic' }}>
            All advisory — your archetype sets the hard limits.
          </div>
          {trait.ruleIds.map(ruleId => {
            const rule = ruleMap[ruleId];
            if (!rule) return null;
            // Shared-rule "controlled by" note (only when this rule is live-contended
            // by another equipped card — presentational, via the isCustom flag).
            const ctrl = ruleControl?.[ruleId];
            const controlNote = ctrl && ctrl.sharerTraitIds.includes(trait.id)
              ? (ctrl.controllerTraitId === trait.id
                  ? ' · controls this shared rule'
                  : ` · controlled by ${ctrl.controllerName}`)
              : '';
            return (
              <div key={ruleId} style={{
                fontSize: 11, color: '#A0AEC0', marginBottom: 3, lineHeight: 1.3,
              }}>
                • {rule.headline}
                {controlNote && <span style={{ color: '#718096', fontStyle: 'italic' }}>{controlNote}</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Strength toggle */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: '#718096', marginBottom: 4 }}>
          Intensity — how strongly this shapes the agent
        </div>
        <TraitStrengthToggle
          value={isCustom ? 'custom' : (isEquipped ? currentStrength : strength)}
          onChange={handleStrengthChange}
          color={groupColor}
          disabled={locked}
          showCustom={isCustom}
          onReset={() => handleStrengthChange('moderate')}
        />
      </div>

      {/* Strength context preview */}
      {STRENGTH_DESCRIPTIONS[trait.id] && (
        <div style={{
          fontSize: 11,
          color: '#718096',
          marginTop: -4,
          marginBottom: 10,
          fontStyle: 'italic',
          lineHeight: 1.3,
          minHeight: 28,
        }}>
          {STRENGTH_DESCRIPTIONS[trait.id][
            (() => {
              const v = isCustom ? 'custom' : (isEquipped ? currentStrength : strength);
              return (v === 'custom' || !v) ? 'moderate' : v;
            })()
          ] || STRENGTH_DESCRIPTIONS[trait.id]['moderate']}
        </div>
      )}

      {/* Bottom row: action */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: isEquipped && locked ? 'space-between' : 'flex-end', gap: 8 }}>
        {/* Equip / Unequip — locked while a battle is live */}
        {locked ? (
          <>
            {isEquipped && (
              <span style={{
                fontSize: 11, fontWeight: 600, color: groupColor,
                background: `${groupColor}15`, padding: '4px 10px',
                borderRadius: 6,
              }}>
                Equipped ✓
              </span>
            )}
            <span style={{ fontSize: 11, color: '#718096', fontStyle: 'italic' }}>
              Changes apply to your next battle.
            </span>
          </>
        ) : isEquipped ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 11, fontWeight: 600, color: groupColor,
              background: `${groupColor}15`, padding: '4px 10px',
              borderRadius: 6,
            }}>
              Equipped ✓
            </span>
            <button
              onClick={() => onUnequip(trait.id)}
              style={{
                background: 'none', border: 'none', color: '#718096',
                fontSize: 11, cursor: 'pointer', padding: 0,
                textDecoration: 'underline',
              }}
            >
              Unequip
            </button>
          </div>
        ) : canEquip ? (
          <button
            onClick={handleEquip}
            style={{
              background: 'none', border: `1px solid ${groupColor}`,
              color: groupColor, fontSize: 12, fontWeight: 600,
              padding: '5px 14px', borderRadius: 6, cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={e => { e.target.style.background = `${groupColor}15`; }}
            onMouseLeave={e => { e.target.style.background = 'none'; }}
          >
            Equip
          </button>
        ) : (
          <span style={{ fontSize: 11, color: '#4A5568', fontStyle: 'italic', lineHeight: 1.35, textAlign: 'right' }}>
            {blockedMessage || 'Unequip a trait to make room (max 2 per group)'}
          </span>
        )}
      </div>
    </div>
  );
}
