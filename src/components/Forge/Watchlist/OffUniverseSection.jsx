// src/components/Forge/Watchlist/OffUniverseSection.jsx
//
// Surfaces tickers that were mentioned in a source article but fall outside
// our coverage universe. Extracted from SignalDrop/SignalDropEntry.jsx so
// both the parse-confirmation surface and the watchlist editor share it.
//
// Two copy variants via the `copyVariant` prop:
//   - 'parse'  (default) — the original Signal Drop confirmation copy, with
//     a mix/empty-validated fork driven by `hasValidated`.
//   - 'editor' — a steady-state caveat for the watchlist editor.
//
// Visual treatment is a neutral chip palette (bgIcon + textSecondary) —
// informative, not an alarm.

import React from 'react';
import SectionLabel from './SectionLabel';

export default function OffUniverseSection({
  unsupported,
  hasValidated,
  tokens,
  copyVariant = 'parse',
}) {
  if (!Array.isArray(unsupported) || unsupported.length === 0) return null;

  const symbolList = unsupported.join(', ');

  let header;
  let copy;
  if (copyVariant === 'editor') {
    header = 'NOT IN OUR UNIVERSE';
    copy =
      'These tickers were mentioned in the source article but are outside our coverage universe. They are kept here for reference — we do not trade or track them.';
  } else {
    header = 'FOUND BUT NOT IN OUR UNIVERSE';
    copy = hasValidated
      ? `We also spotted ${symbolList} in this article. We don't trade these directly, but the dialogue can incorporate them as themes.`
      : `We spotted ${symbolList} in this article — these aren't in our coverage universe, but we can still build a watchlist from the underlying theme. Let's explore it together in dialogue.`;
  }

  return (
    <div>
      <SectionLabel tokens={tokens}>{header}</SectionLabel>
      <div
        style={{
          fontSize: 13,
          color: tokens.textSecondary,
          lineHeight: 1.5,
          marginBottom: 8,
        }}
      >
        {copy}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {unsupported.map((sym) => (
          <span
            key={sym}
            title="Not in our coverage universe"
            style={{
              background: tokens.bgIcon,
              border: `1px solid ${tokens.borderDefault}`,
              color: tokens.textSecondary,
              padding: '4px 9px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              letterSpacing: '0.3px',
            }}
          >
            {sym}
          </span>
        ))}
      </div>
    </div>
  );
}
