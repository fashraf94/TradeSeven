// src/components/Forge/RuleTextPreview.jsx
// Live interpolated rule text display with teal-highlighted param values.

import React, { useMemo } from 'react';

/**
 * Splits a template string like "Prefer stocks with RSI below {threshold}"
 * into alternating static/dynamic segments and renders param values in teal.
 */
export default function RuleTextPreview({ textTemplate, paramValues, paramDefs }) {
  const segments = useMemo(() => {
    if (!textTemplate) return [{ type: 'static', text: '' }];

    const result = [];
    const regex = /\{(\w+)\}/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(textTemplate)) !== null) {
      // Static text before this placeholder
      if (match.index > lastIndex) {
        result.push({ type: 'static', text: textTemplate.slice(lastIndex, match.index) });
      }

      const key = match[1];
      const def = paramDefs?.[key];
      const rawValue = paramValues?.[key] !== undefined ? paramValues[key] : def?.default;

      // For select params, show the option label instead of raw value
      let displayValue = rawValue;
      if (def?.type === 'select' && def.options && rawValue !== undefined) {
        const opt = def.options.find(o => o.value === rawValue);
        if (opt) displayValue = opt.label;
      }

      // For toggle params, show on/off
      if (def?.type === 'toggle') {
        displayValue = rawValue ? 'on' : 'off';
      }

      result.push({ type: 'param', key, text: String(displayValue ?? '') });
      lastIndex = match.index + match[0].length;
    }

    // Trailing static text
    if (lastIndex < textTemplate.length) {
      result.push({ type: 'static', text: textTemplate.slice(lastIndex) });
    }

    return result;
  }, [textTemplate, paramValues, paramDefs]);

  return (
    <div style={{
      background: '#0D0E12',
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
    }}>
      <span style={{
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
        fontSize: 13,
        lineHeight: 1.5,
        color: '#94A3B8',
      }}>
        {segments.map((seg, i) =>
          seg.type === 'param' ? (
            <span key={i} style={{ color: '#5EEAD4', fontWeight: 600 }}>
              {seg.text}
            </span>
          ) : (
            <span key={i}>{seg.text}</span>
          )
        )}
      </span>
    </div>
  );
}
