// src/components/Forge/BundleStrip.jsx
// Inline bundle management bar between the mech and the rule browser.

import React, { useState } from 'react';
import { Hammer } from 'lucide-react';

export default function BundleStrip({
  activeBundleId,
  bundles,
  capacity,
  isEquipped,
  onForgeBundle,
  onSwitchBundle,
  onRenameBundle,
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [showSelector, setShowSelector] = useState(false);

  const activeBundle = bundles.find(b => b.id === activeBundleId);
  const bundleName = activeBundle?.name || 'No Bundle';
  const hasBundles = bundles.length > 0;

  const handleStartRename = () => {
    if (!activeBundle || activeBundle.status !== 'draft') return;
    setNameValue(bundleName);
    setIsRenaming(true);
  };

  const handleFinishRename = () => {
    if (nameValue.trim() && nameValue.trim() !== bundleName) {
      onRenameBundle(activeBundleId, nameValue.trim());
    }
    setIsRenaming(false);
  };

  const capacityPct = capacity.max > 0 ? (capacity.current / capacity.max) * 100 : 0;

  return (
    <div style={{
      height: 56,
      background: '#15171E',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: 12,
    }}>
      {/* Bundle name */}
      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        {isRenaming ? (
          <input
            autoFocus
            value={nameValue}
            onChange={e => setNameValue(e.target.value)}
            onBlur={handleFinishRename}
            onKeyDown={e => { if (e.key === 'Enter') handleFinishRename(); }}
            style={{
              background: 'none',
              border: '1px solid rgba(94,234,212,0.3)',
              borderRadius: 6,
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 700,
              padding: '4px 8px',
              width: '100%',
              outline: 'none',
            }}
          />
        ) : (
          <button
            onClick={hasBundles && bundles.length > 1 ? () => setShowSelector(!showSelector) : handleStartRename}
            style={{
              background: 'none',
              border: 'none',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              padding: 0,
              textAlign: 'left',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
              display: 'block',
            }}
          >
            {hasBundles ? bundleName : 'No Bundle'}
          </button>
        )}

        {/* Bundle selector dropdown */}
        {showSelector && bundles.length > 1 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            background: '#1C1A27',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            padding: 4,
            zIndex: 60,
            minWidth: 180,
          }}>
            {bundles.map(b => (
              <button
                key={b.id}
                onClick={() => { onSwitchBundle(b.id); setShowSelector(false); }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  background: b.id === activeBundleId ? 'rgba(94,234,212,0.08)' : 'none',
                  border: 'none',
                  borderRadius: 6,
                  color: b.id === activeBundleId ? '#5EEAD4' : '#e6edf3',
                  fontSize: 13,
                  fontWeight: b.id === activeBundleId ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                {b.name} <span style={{ color: '#4a5568', fontSize: 11 }}>({b.status})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Capacity bar */}
      {hasBundles && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{
            width: 60,
            height: 4,
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 2,
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${Math.min(capacityPct, 100)}%`,
              height: '100%',
              background: '#5EEAD4',
              borderRadius: 2,
              transition: 'width 0.3s ease',
            }} />
          </div>
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#5EEAD4',
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          }}>
            {capacity.current}/{capacity.max}
          </span>
        </div>
      )}

      {/* Status / CTA */}
      {hasBundles && (
        isEquipped ? (
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            color: '#5EEAD4',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            flexShrink: 0,
          }}>
            EQUIPPED
          </span>
        ) : (
          <button
            onClick={onForgeBundle}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 12px',
              background: 'rgba(94,234,212,0.12)',
              border: '1px solid rgba(94,234,212,0.3)',
              borderRadius: 8,
              color: '#5EEAD4',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <Hammer size={12} /> FORGE
          </button>
        )
      )}
    </div>
  );
}
