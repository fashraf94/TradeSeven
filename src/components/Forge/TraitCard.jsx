// src/components/Forge/TraitCard.jsx
// Compact card for a single trait inside a DNA group.

import React, { useState } from 'react';
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

      {/* Bottom row: advanced link + action */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Advanced Firmware link */}
        <button
          onClick={() => onAdvancedOpen(trait.id)}
          style={{
            background: 'none', border: 'none', color: '#718096',
            fontSize: 11, cursor: 'pointer', padding: 0,
            textDecoration: 'none',
          }}
        >
          Advanced Firmware &rarr;
        </button>

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
            Slots full
          </span>
        )}
      </div>
    </div>
  );
}
