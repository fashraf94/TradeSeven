// HypothesisTicker - Collapsible 24px ticker bar showing latest hypothesis
// Expands on tap to show full hypothesis text + reasoning.

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function extractHypothesis(statusFeed) {
  if (!statusFeed || statusFeed.length === 0) return null;

  // Walk backwards through feed to find latest hypothesis-bearing entry
  for (let i = statusFeed.length - 1; i >= 0; i--) {
    const entry = statusFeed[i];
    if (entry.type === 'hypothesis' && entry.text) return entry;
    if (entry.type === 'evaluation' && entry.hypothesis) {
      return { text: entry.hypothesis, reasoning: entry.reasoning || entry.text, timestamp: entry.timestamp };
    }
    if (entry.hypothesis) {
      return { text: entry.hypothesis, reasoning: entry.reasoning || entry.text, timestamp: entry.timestamp };
    }
  }
  return null;
}

export default function HypothesisTicker({ statusFeed, tokens }) {
  const [expanded, setExpanded] = useState(false);
  const hypothesis = extractHypothesis(statusFeed);

  const displayText = hypothesis?.text || 'Awaiting first analysis...';
  const hasHypothesis = !!hypothesis;

  return (
    <div
      style={{
        padding: '0 16px',
        cursor: 'pointer',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
      onClick={() => hasHypothesis && setExpanded(!expanded)}
    >
      {/* Collapsed bar — always visible */}
      <div
        style={{
          height: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          overflow: 'hidden',
        }}
      >
        <span style={{ fontSize: 12, flexShrink: 0 }}>{'\uD83E\uDDE0'}</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: hasHypothesis ? 'rgba(94,234,212,0.7)' : (tokens.textFaint || '#64748b'),
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: 1,
          }}
        >
          {displayText}
        </span>
        {hasHypothesis && (
          <span style={{
            fontSize: 10,
            color: tokens.textFaint || '#64748b',
            flexShrink: 0,
            transition: 'transform 0.2s ease',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}>
            {'\u25BE'}
          </span>
        )}
      </div>

      {/* Expanded card */}
      <AnimatePresence>
        {expanded && hypothesis && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                marginTop: 6,
                padding: '10px 12px',
                borderRadius: 10,
                background: tokens.bgCard || '#15171E',
                border: `1px solid ${tokens.borderDefault || 'rgba(255,255,255,0.05)'}`,
              }}
            >
              <p style={{
                fontSize: 12,
                lineHeight: 1.5,
                color: tokens.textPrimary || '#e2e8f0',
                margin: 0,
              }}>
                {hypothesis.text}
              </p>
              {hypothesis.reasoning && (
                <p style={{
                  fontSize: 11,
                  lineHeight: 1.4,
                  color: tokens.textMuted || '#94a3b8',
                  margin: '8px 0 0',
                }}>
                  {hypothesis.reasoning}
                </p>
              )}
              {hypothesis.timestamp && (
                <div style={{
                  fontSize: 10,
                  color: tokens.textFaint || '#64748b',
                  marginTop: 6,
                }}>
                  {new Date(hypothesis.timestamp).toLocaleString('en-US', {
                    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
