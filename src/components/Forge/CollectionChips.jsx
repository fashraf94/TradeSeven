// src/components/Forge/CollectionChips.jsx
// Compact horizontal scroll row of collection pills for quick-start browsing.

import React from 'react';
import { Check } from 'lucide-react';

export default React.memo(function CollectionChips({
  collections,
  collectedSourceRefs,
  onSelectCollection,
  agentExists,
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      {/* Section header */}
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        color: '#718096',
        textTransform: 'uppercase',
        letterSpacing: '0.15em',
        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
        marginBottom: 8,
      }}>
        QUICK START
      </div>

      {/* Chip row */}
      <div style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        paddingBottom: 4,
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
      }}>
        {collections.map(collection => {
          const ids = collection.ruleIds || [];
          const collectedCount = ids.filter(id => collectedSourceRefs.has(id)).length;
          const allCollected = ids.length > 0 && collectedCount === ids.length;

          return (
            <button
              key={collection.id}
              onClick={() => onSelectCollection(collection)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                height: 36,
                padding: '0 14px',
                borderRadius: 18,
                background: allCollected ? 'rgba(94,234,212,0.08)' : '#15171E',
                border: allCollected
                  ? '1px solid rgba(94,234,212,0.25)'
                  : collectedCount > 0
                    ? `1px solid ${collection.accentColor}66`
                    : '1px solid rgba(255,255,255,0.08)',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'border-color 0.2s',
              }}
            >
              {/* Accent indicator */}
              {allCollected ? (
                <Check size={12} color="#5EEAD4" />
              ) : (
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: collection.accentColor,
                  flexShrink: 0,
                }} />
              )}

              {/* Title */}
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                color: allCollected ? '#5EEAD4' : '#ffffff',
                whiteSpace: 'nowrap',
              }}>
                {collection.title}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});
