// src/components/Forge/ForgeRuleCard.jsx
// Compact rule card (260×88px) used in collection carousels and full library.

import React from 'react';
import { Plus, Check, Activity, TrendingUp, Shield, PieChart, Swords, Clock, Target, Layers } from 'lucide-react';

const CATEGORY_COLORS = {
  technical: '#5eead4',
  fundamental: '#f59e0b',
  risk: '#ef4444',
  allocation: '#8b5cf6',
  mid_battle: '#6366F1',
  game_state: '#94A3B8',
  threshold: '#e879f9',
  tier_strategy: '#fbbf24',
};

const CATEGORY_ICONS = {
  technical: Activity,
  fundamental: TrendingUp,
  risk: Shield,
  allocation: PieChart,
  mid_battle: Swords,
  game_state: Clock,
  threshold: Target,
  tier_strategy: Layers,
};

export default function ForgeRuleCard({ rule, isCollected, onAdd, onLearnMore, isAdding, style }) {
  const catColor = CATEGORY_COLORS[rule.category] || '#5eead4';
  const CatIcon = CATEGORY_ICONS[rule.category] || Activity;

  return (
    <div
      onClick={() => onLearnMore(rule)}
      style={{
        width: 260,
        height: 88,
        background: '#15171E',
        border: '1px solid #21262d',
        borderLeft: `4px solid ${catColor}`,
        borderRadius: 12,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        padding: 12,
        cursor: 'pointer',
        opacity: isCollected ? 0.5 : 1,
        transition: 'opacity 0.3s ease',
        flexShrink: 0,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* Category Icon */}
      <div style={{
        width: 36,
        height: 36,
        flexShrink: 0,
        borderRadius: 8,
        background: '#1C1A27',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <CatIcon size={18} color={catColor} />
      </div>

      {/* Text Stack */}
      <div style={{
        flex: 1,
        margin: '0 12px',
        minWidth: 0,
      }}>
        <div style={{
          fontSize: 13,
          color: '#ffffff',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {rule.headline}
        </div>
        <div style={{
          fontSize: 10,
          color: '#8b949e',
          marginTop: 2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {rule.description}
        </div>
        <div style={{
          fontSize: 9,
          color: '#8b949e',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginTop: 3,
        }}>
          {rule.category} · {rule.difficulty}
        </div>
      </div>

      {/* Action Button */}
      {isCollected ? (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 32,
            height: 32,
            padding: 6,
            boxSizing: 'content-box',
            flexShrink: 0,
            borderRadius: 9999,
            background: 'rgba(34, 197, 94, 0.15)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Check size={16} color="#22c55e" />
        </div>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isAdding) return;
            onAdd(rule);
          }}
          disabled={isAdding}
          style={{
            width: 32,
            height: 32,
            padding: 6,
            boxSizing: 'content-box',
            flexShrink: 0,
            borderRadius: 9999,
            border: '1px solid #21262d',
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isAdding ? 'not-allowed' : 'pointer',
            opacity: isAdding ? 0.5 : 1,
            transition: 'opacity 0.2s ease',
          }}
        >
          <Plus size={16} color="#5eead4" />
        </button>
      )}
    </div>
  );
}
