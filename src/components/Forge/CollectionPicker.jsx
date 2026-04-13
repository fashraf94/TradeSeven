// src/components/Forge/CollectionPicker.jsx
//
// Horizontal scroll row of Trading Style Collection chips used as the
// starting point for the Strategy Dimensions UI. Switching collections
// replaces every dimension slider via onSelect — if the user has made
// manual adjustments (isDirty), we show an inline confirmation bar
// before applying.
//
// Props:
//   selected     — string | null collection id
//   onSelect     — (collectionId) => void (caller applies preset)
//   isDirty      — boolean, true if the user edited anything since
//                  the last preset apply

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { COLLECTION_DEFS } from '../../utils/dimensionMapper';

const PAGE_BG = '#0D0E12';
const CARD_BG = '#15171E';
const SURFACE_BG = '#1C1A27';
const TROPHY_GOLD = '#F0C75E';
const BORDER_SUBTLE = '#21262D';
const TEXT_PRIMARY = '#E6EDF3';
const TEXT_MUTED = '#8B949E';

export default function CollectionPicker({ selected, onSelect, isDirty }) {
  const [pending, setPending] = useState(null); // collection id awaiting confirm

  // If the user changes selection cleanly (no dirty state), any pending
  // confirmation is stale — clear it.
  useEffect(() => {
    if (!isDirty) setPending(null);
  }, [isDirty]);

  function requestSelect(id) {
    if (id === selected) return;
    if (isDirty) {
      setPending(id);
      return;
    }
    onSelect(id);
  }

  function confirmSwitch() {
    if (pending) onSelect(pending);
    setPending(null);
  }

  function cancelSwitch() {
    setPending(null);
  }

  const pendingDef = pending
    ? COLLECTION_DEFS.find((c) => c.id === pending)
    : null;

  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: TEXT_MUTED,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: 8,
        }}
      >
        Trading Style
      </div>

      {/* Chip row */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 4,
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin',
        }}
      >
        {COLLECTION_DEFS.map((c) => {
          const isSelected = c.id === selected;
          const isPending = c.id === pending;
          return (
            <button
              key={c.id}
              onClick={() => requestSelect(c.id)}
              style={{
                flex: '0 0 auto',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                background: isSelected ? SURFACE_BG : CARD_BG,
                border: `1px solid ${
                  isSelected ? TROPHY_GOLD : isPending ? c.accentColor : BORDER_SUBTLE
                }`,
                borderRadius: 10,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
              title={c.tagline}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: c.accentColor,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: isSelected ? TROPHY_GOLD : TEXT_PRIMARY,
                }}
              >
                {c.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Inline confirmation bar (slides in when a switch would discard edits) */}
      <AnimatePresence>
        {pendingDef && (
          <motion.div
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.18 }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                marginTop: 10,
                padding: '10px 12px',
                background: SURFACE_BG,
                border: `1px solid ${pendingDef.accentColor}`,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  flex: 1,
                  minWidth: 200,
                  fontSize: 12,
                  color: TEXT_PRIMARY,
                  lineHeight: 1.4,
                }}
              >
                Switch to{' '}
                <span style={{ color: pendingDef.accentColor, fontWeight: 600 }}>
                  {pendingDef.label}
                </span>
                ? Your manual adjustments will be reset.
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={cancelSwitch}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: TEXT_MUTED,
                    background: 'transparent',
                    border: `1px solid ${BORDER_SUBTLE}`,
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmSwitch}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 700,
                    color: PAGE_BG,
                    background: pendingDef.accentColor,
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  Switch
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
