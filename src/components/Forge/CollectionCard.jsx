// src/components/Forge/CollectionCard.jsx
// Themed collection card with rule peek, category dots, and add-all CTA.

import React from 'react';
import { Check, Plus } from 'lucide-react';

const DIFFICULTY_COLORS = {
  beginner: '#5eead4',
  intermediate: '#a78bfa',
  advanced: '#f97066',
};

function MiniRuleCard({ rule }) {
  const subtitle = rule.hook || rule.description;
  return (
    <div style={{
      width: 140,
      flexShrink: 0,
      background: '#1C1A27',
      borderRadius: 8,
      padding: '8px 10px',
      border: '1px solid rgba(255,255,255,0.04)',
    }}>
      <div style={{
        fontSize: 12,
        fontWeight: 600,
        color: '#ffffff',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        marginBottom: 3,
      }}>
        {rule.headline}
      </div>
      {subtitle && (
        <div style={{
          fontSize: 11,
          color: rule.hook ? '#A0AEC0' : '#8b949e',
          fontStyle: rule.hook ? 'italic' : 'normal',
          lineHeight: 1.3,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {subtitle}
        </div>
      )}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
      }}>
        <span style={{
          fontSize: 9,
          fontWeight: 600,
          color: DIFFICULTY_COLORS[rule.difficulty] || '#8b949e',
          textTransform: 'uppercase',
          letterSpacing: 0.3,
        }}>
          {rule.difficulty}
        </span>
      </div>
    </div>
  );
}

export default React.memo(function CollectionCard({
  collection,
  collectedSourceRefs,
  onAddAll,
  agentExists,
  isAdding,
}) {
  const { title, subtitle, accentColor, rules, categoryColors, ruleIds } = collection;
  const collectedCount = ruleIds.filter(id => collectedSourceRefs.has(id)).length;
  const allCollected = collectedCount === ruleIds.length;
  const someCollected = collectedCount > 0 && !allCollected;
  const remainingCount = ruleIds.length - collectedCount;

  return (
    <div style={{
      background: '#15171E',
      border: '1px solid rgba(255,255,255,0.06)',
      borderLeft: `4px solid ${accentColor}`,
      borderRadius: 12,
      padding: '16px',
      marginBottom: 12,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 4,
      }}>
        <div style={{
          fontSize: 16,
          fontWeight: 700,
          color: '#ffffff',
        }}>
          {title}
        </div>
        <span style={{
          fontSize: 12,
          color: '#4a5568',
          flexShrink: 0,
          marginLeft: 8,
        }}>
          {ruleIds.length} rules
        </span>
      </div>

      {/* Subtitle */}
      <div style={{
        fontSize: 13,
        color: '#8b949e',
        lineHeight: 1.4,
        marginBottom: 10,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {subtitle}
      </div>

      {/* Category color dots */}
      {categoryColors.length > 0 && (
        <div style={{
          display: 'flex',
          gap: 5,
          marginBottom: 12,
        }}>
          {categoryColors.map((color, i) => (
            <div
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: color,
              }}
            />
          ))}
        </div>
      )}

      {/* Rule peek — horizontal scroll */}
      {rules.length > 0 && (
        <div style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 4,
          marginBottom: 12,
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}>
          {rules.slice(0, 4).map(rule => (
            <MiniRuleCard key={rule.id} rule={rule} />
          ))}
        </div>
      )}

      {/* CTA */}
      {!agentExists ? (
        <button
          disabled
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'none',
            color: '#4a5568',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'not-allowed',
          }}
        >
          Create Agent to Add
        </button>
      ) : allCollected ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '10px',
          borderRadius: 8,
          background: 'rgba(94,234,212,0.12)',
          color: '#5EEAD4',
          fontSize: 12,
          fontWeight: 600,
        }}>
          <Check size={14} /> All Equipped
        </div>
      ) : (
        <button
          onClick={() => onAddAll(collection)}
          disabled={isAdding}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '10px',
            borderRadius: 8,
            border: '1px solid rgba(94,234,212,0.3)',
            background: 'none',
            color: '#5EEAD4',
            fontSize: 12,
            fontWeight: 600,
            cursor: isAdding ? 'not-allowed' : 'pointer',
            opacity: isAdding ? 0.6 : 1,
          }}
        >
          <Plus size={14} />
          {someCollected ? `Add Remaining (${remainingCount})` : 'Add All to Bundle'}
        </button>
      )}
    </div>
  );
});
