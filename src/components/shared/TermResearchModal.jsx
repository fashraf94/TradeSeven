// src/components/shared/TermResearchModal.jsx
//
// Phase 2.5 Voice Layer Rework — clickable financial-term definition modal.
//
// Opens when the user clicks a highlighted term token in chat (VWAP, RSI,
// PCE, etc.). Renders the four-element educational structure from spec §3.2:
// What it is / Why it matters / How traders use it / Example.
//
// Sibling of AssetResearchModal (which handles ticker clicks). Reuses
// CenteredModal's chrome instead of duplicating AssetResearchModal's
// 1300-line portal pattern — term modals show static text, not live data.

import React from 'react';
import CenteredModal from './CenteredModal';
import { useTheme } from '../../contexts/ThemeContext';
import { getTermDefinition } from '../../data/termUniverse';

const TERM_ACCENT = '#f59e0b';

function Section({ label, body, tokens, italic }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div
        style={{
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: TERM_ACCENT,
          marginBottom: '6px',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: '14px',
          lineHeight: '1.55',
          color: tokens.textPrimary,
          fontStyle: italic ? 'italic' : 'normal',
        }}
      >
        {body}
      </div>
    </div>
  );
}

export default function TermResearchModal({ termToken, isOpen, onClose }) {
  const { tokens } = useTheme();
  const term = termToken ? getTermDefinition(termToken) : null;

  if (!isOpen) return null;

  if (!term) {
    return (
      <CenteredModal isOpen={isOpen} onClose={onClose} title={termToken || 'Term'}>
        <div style={{ padding: '0 20px 24px', color: tokens.textMuted, fontSize: '14px' }}>
          No definition available for this term yet.
        </div>
      </CenteredModal>
    );
  }

  const { displayName, category, definition } = term;

  return (
    <CenteredModal isOpen={isOpen} onClose={onClose} title={displayName}>
      <div
        style={{
          padding: '0 20px 24px',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            display: 'inline-block',
            fontSize: '10px',
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: TERM_ACCENT,
            background: 'rgba(245, 158, 11, 0.12)',
            border: `1px solid rgba(245, 158, 11, 0.35)`,
            borderRadius: '999px',
            padding: '3px 10px',
            marginBottom: '18px',
          }}
        >
          {category}
        </div>

        <Section label="What it is" body={definition.whatItIs} tokens={tokens} />
        <Section label="Why it matters" body={definition.whyItMatters} tokens={tokens} />
        <Section label="How traders use it" body={definition.howTradersUse} tokens={tokens} />
        <Section label="Example" body={definition.example} tokens={tokens} italic />
      </div>
    </CenteredModal>
  );
}
