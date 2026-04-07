/**
 * LoadoutDropdown — Destiny-style loadout selector showing the active bundle
 * with LED slot pips and a dropdown for swapping between bundles.
 *
 * Replaces the old BundleStrip with a more compact, visual design.
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';

export default function LoadoutDropdown({
  bundles,
  activeBundleId,
  onEquipBundle,
  onCreateBundle,
  maxBundles = 5,
  bundleCount = 0,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const activeBundle = bundles?.find(b => b.id === activeBundleId);
  const Chevron = isOpen ? ChevronUp : ChevronDown;

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Cartridge (closed state) */}
      <div
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#15171E',
          border: '1px solid',
          borderColor: isOpen ? '#5EEAD440' : '#2A2D35',
          borderRadius: 8,
          padding: '10px 14px',
          cursor: 'pointer',
          transition: 'border-color 0.2s ease',
        }}
        onMouseEnter={e => { if (!isOpen) e.currentTarget.style.borderColor = '#5EEAD440'; }}
        onMouseLeave={e => { if (!isOpen) e.currentTarget.style.borderColor = '#2A2D35'; }}
      >
        {/* Bundle name */}
        <div style={{
          flex: 1,
          fontSize: 14,
          fontWeight: 600,
          color: activeBundle ? '#ffffff' : '#718096',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '20ch',
        }}>
          {activeBundle?.name || 'No Strategy Equipped'}
        </div>

        {/* LED pips */}
        <div style={{ display: 'flex', gap: 4, marginRight: 10, alignItems: 'center' }}>
          {Array.from({ length: maxBundles }, (_, i) => (
            <div
              key={i}
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                backgroundColor: i < bundleCount ? '#5EEAD4' : '#2A2D35',
                transition: 'background-color 0.2s ease',
              }}
            />
          ))}
        </div>

        {/* Chevron */}
        <Chevron size={14} color="#718096" />
      </div>

      {/* Dropdown (open state) */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: 4,
          backgroundColor: '#15171E',
          border: '1px solid #2A2D35',
          borderRadius: 8,
          maxHeight: 280,
          overflowY: 'auto',
          zIndex: 20,
        }}>
          {/* Bundle rows */}
          {(bundles || [])
            .filter(b => b.status !== 'archived')
            .map(bundle => {
              const isEquipped = bundle.status === 'equipped';
              return (
                <div
                  key={bundle.id}
                  onClick={() => {
                    onEquipBundle(bundle.id);
                    setIsOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 14px',
                    cursor: 'pointer',
                    borderLeft: isEquipped ? '3px solid #5EEAD4' : '3px solid transparent',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#1C1A27'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <span style={{ color: '#ffffff', fontSize: 13 }}>
                    {bundle.name}
                  </span>
                  {isEquipped && (
                    <span style={{ color: '#5EEAD4', fontSize: 11, marginLeft: 8 }}>
                      (equipped)
                    </span>
                  )}
                </div>
              );
            })}

          {/* Create new bundle */}
          {bundleCount < maxBundles && (
            <>
              <div style={{ borderTop: '1px solid #2A2D35' }} />
              <div
                onClick={() => {
                  onCreateBundle();
                  setIsOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  cursor: 'pointer',
                  color: '#5EEAD4',
                  fontSize: 13,
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#1C1A27'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <Plus size={14} />
                <span>Create New Bundle</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
