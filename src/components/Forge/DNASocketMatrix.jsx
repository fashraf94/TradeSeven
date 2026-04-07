/**
 * DNASocketMatrix — compact pip visualization of equipped trait slots
 * across all 3 DNA groups (Instincts / Strategy / Discipline).
 *
 * Shows colored pips for filled slots and muted pips for empty slots.
 * Hovering a filled pip reveals the trait name in a tooltip.
 */

import React, { useState } from 'react';
import { Eye, Brain, Shield } from 'lucide-react';
import { DNA_GROUPS } from '../../data/dnaGroups';

const ICON_MAP = { Eye, Brain, Shield };

const GROUP_ORDER = ['instincts', 'strategy', 'discipline'];

export default function DNASocketMatrix({ slotUsage, equippedTraits }) {
  const [tooltip, setTooltip] = useState(null); // { groupId, pipIndex }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      width: '100%',
      background: '#0D0E1280',
      borderRadius: 8,
      padding: '8px 12px',
    }}>
      {GROUP_ORDER.map(groupId => {
        const group = DNA_GROUPS[groupId];
        const usage = slotUsage?.[groupId] || { used: 0, max: 2 };
        const Icon = ICON_MAP[group.icon];

        // Find equipped traits for this group
        const groupTraits = (equippedTraits || []).filter(t => t.dnaGroup === groupId);

        return (
          <div key={groupId} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            {Icon && <Icon size={14} color={group.color} style={{ opacity: 0.6 }} />}

            {Array.from({ length: usage.max }, (_, i) => {
              const trait = groupTraits[i];
              const isFilled = i < usage.used && trait;

              return (
                <div
                  key={i}
                  style={{ position: 'relative' }}
                  onMouseEnter={() => isFilled && setTooltip({ groupId, pipIndex: i })}
                  onMouseLeave={() => setTooltip(null)}
                >
                  {/* Pip */}
                  <div style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: isFilled ? group.color : '#2A2D35',
                    boxShadow: isFilled ? `0 0 6px ${group.color}60` : 'none',
                    transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
                  }} />

                  {/* Tooltip */}
                  {tooltip?.groupId === groupId && tooltip?.pipIndex === i && isFilled && (
                    <div style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      marginBottom: 6,
                      padding: '4px 8px',
                      backgroundColor: '#15171E',
                      border: '1px solid #2A2D35',
                      borderRadius: 4,
                      color: '#ffffff',
                      fontSize: 11,
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                      zIndex: 10,
                    }}>
                      {trait.name}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
