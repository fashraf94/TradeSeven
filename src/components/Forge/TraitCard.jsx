// src/components/Forge/TraitCard.jsx
// Compact card for a single trait inside a DNA group.

import React, { useState, useEffect } from 'react';
import {
  TrendingUp, Search, Zap, BarChart3, ArrowUpRight, Compass,
  Target, CheckCheck, Gauge, RefreshCw, ShieldAlert,
  Lock, Clock, Repeat, PieChart, Rocket,
} from 'lucide-react';
import TraitStrengthToggle from './TraitStrengthToggle';

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
    dominant: 'Strict trend adherence — only the strongest aligned setups',
  },
  'trait-bargain-hunter': {
    subtle: 'Light oversold preference — casts a wide net for dip candidates',
    moderate: 'Standard mean reversion — targets clear oversold signals',
    dominant: 'Aggressive dip buying — deep oversold only, tight filters',
  },
  'trait-squeeze-whisperer': {
    subtle: 'Watches for broad volatility compression patterns',
    moderate: 'Targets confirmed squeezes with directional momentum',
    dominant: 'Only the tightest squeezes with strong breakout signals',
  },
  'trait-volume-believer': {
    subtle: 'Prefers above-average volume — soft confirmation requirement',
    moderate: 'Requires solid volume spikes — institutional participation',
    dominant: 'Demands extreme volume — only the clearest institutional signals',
  },
  'trait-breakout-chaser': {
    subtle: 'Leans toward stocks near highs — moderate RS requirement',
    moderate: 'Targets breakout leaders — strong RS and proximity filters',
    dominant: 'Only the top breakout candidates — elite RS scores required',
  },
  'trait-smart-money-tracker': {
    subtle: 'Follows VWAP loosely — broad institutional flow preference',
    moderate: 'Strict VWAP adherence — confirmed institutional support required',
    dominant: 'Aggressive institutional tracking — tight VWAP with sector rotation',
  },
  'trait-threshold-harvester': {
    subtle: 'Balanced scoring approach — harvests only after Double Bagger',
    moderate: 'Active harvesting — rotates after every BaggerBomb bonus',
    dominant: 'Maximum harvest rate — rotates after any positive threshold hit',
  },
  'trait-dual-conviction': {
    subtle: 'Moderate dual-check — both scores above average',
    moderate: 'Standard conviction gate — solid fundamentals AND technicals',
    dominant: 'Elite dual filter — only top-tier stocks on both dimensions',
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
    subtle: 'Moderate protection — caps volatile stocks at Core tier',
    moderate: 'Strong protection — restricts volatile stocks to Support tier',
    dominant: 'Maximum protection — tight volatility limits, aggressive demotion',
  },
  'trait-iron-discipline': {
    subtle: 'Relaxed stops — wider eject threshold, patient with swaps',
    moderate: 'Standard discipline — balanced stops and swap hurdles',
    dominant: 'Tight discipline — aggressive stops, high hurdle for every swap',
  },
  'trait-patient-holder': {
    subtle: 'Some patience — short hold period, exits at Double Bagger',
    moderate: 'Standard patience — 90 min holds, exits at BaggerBomb',
    dominant: 'Maximum patience — long holds, trusts the thesis fully',
  },
  'trait-active-trader': {
    subtle: 'Moderate activity — swaps stagnant stocks after 2 hours',
    moderate: 'Active rotation — swaps stagnant stocks after 90 minutes',
    dominant: 'Hyper-active — swaps quickly, low tolerance for stagnation',
  },
  'trait-diversifier': {
    subtle: 'Light diversification — minimum sector spread',
    moderate: 'Standard diversification — balanced barbell with sector coverage',
    dominant: 'Maximum diversification — heavy anchors, broad sector spread',
  },
  'trait-let-winners-run': {
    subtle: 'Holds winners to Double Bagger threshold before considering exit',
    moderate: 'Holds winners through BaggerBomb — lets scoring thresholds decide',
    dominant: 'Maximum conviction hold — rides winners through all thresholds',
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
}) {
  const [strength, setStrength] = useState(currentStrength || 'moderate');

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

      {/* Identity statement */}
      <div style={{
        fontSize: 12, color: '#718096', marginBottom: 10,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {trait.identityStatement}
      </div>

      {/* Strength toggle */}
      <div style={{ marginBottom: 10 }}>
        <TraitStrengthToggle
          value={isCustom ? 'custom' : (isEquipped ? currentStrength : strength)}
          onChange={handleStrengthChange}
          color={groupColor}
          disabled={false}
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        {/* Equip / Unequip */}
        {isEquipped ? (
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
          <span style={{ fontSize: 11, color: '#4A5568', fontStyle: 'italic' }}>
            Unequip a trait to make room (max 2 per group)
          </span>
        )}
      </div>
    </div>
  );
}
