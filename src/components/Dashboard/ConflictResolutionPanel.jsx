// src/components/Dashboard/ConflictResolutionPanel.jsx
//
// "Rule check" — runtime transparency for the Rule Conflict Reconciler (Phase 3,
// Surface 2). Reads agent.lastConflictReport (populated at deploy ONLY when the
// INJECT flag is on) and renders the plain-English resolution lines. ALL copy
// comes from the pure buildConflictSurface view-model (conflictSurfaceCopy.js) so
// the copy rules live in one tested place; this file is presentation only.
//
// Invisibility invariant: with the flags off there is no report, buildConflictSurface
// returns null, and this renders nothing — no empty panel, no phantom all-clear.

import React, { useState } from 'react';
import { AlertTriangle, GitMerge, ShieldAlert, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { CMD, alpha, Mono } from './commandUI';
import { buildConflictSurface } from '../../utils/conflictSurfaceCopy';

export default function ConflictResolutionPanel({ report, accent = CMD.gold }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const surface = buildConflictSurface(report);
  if (!surface) return null; // no report → render nothing (invisibility)

  // Rule 6 — degraded state: copper (a recoverable hiccup; red is reserved for
  // downside), never a green/all-clear.
  if (surface.degraded) {
    return (
      <div
        role="status"
        style={{
          display: 'flex', gap: 10, alignItems: 'flex-start',
          padding: '11px 13px', borderRadius: 12,
          background: alpha(CMD.copper, 0.1), border: `1px solid ${alpha(CMD.copper, 0.32)}`,
        }}
      >
        <ShieldAlert size={15} color={CMD.copper} style={{ flexShrink: 0, marginTop: 1 }} />
        <span style={{ fontSize: 12.5, color: CMD.copper, lineHeight: 1.45 }}>{surface.degradedText}</span>
      </div>
    );
  }

  const { prominent, quiet, coverageText, unchecked } = surface;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Contradictions / recency tie-breaks — prominent. */}
      {prominent.map((c, i) => (
        <div
          key={`c${i}`}
          style={{
            display: 'flex', gap: 11, alignItems: 'flex-start',
            padding: '12px 14px', borderRadius: 12,
            background: CMD.surface,
            border: `1px solid ${alpha(accent, 0.28)}`,
            borderLeft: `3px solid ${accent}`,
          }}
        >
          <AlertTriangle size={15} color={accent} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13, color: CMD.ink, lineHeight: 1.5, margin: 0 }}>{c.text}</p>
            {c.note && (
              <p style={{ fontSize: 11.5, color: CMD.ink2, lineHeight: 1.45, margin: '7px 0 0' }}>{c.note}</p>
            )}
          </div>
        </div>
      ))}

      {/* Consolidations — quiet / informational (a merge, not a loss). */}
      {quiet.map((c, i) => (
        <div
          key={`m${i}`}
          style={{
            display: 'flex', gap: 9, alignItems: 'flex-start',
            padding: '9px 12px', borderRadius: 10,
            background: alpha(CMD.ink3, 0.06), border: `1px solid ${CMD.hair}`,
          }}
        >
          <GitMerge size={13} color={CMD.ink3} style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: 12, color: CMD.ink2, lineHeight: 1.45 }}>{c.text}</span>
        </div>
      ))}

      {/* Coverage-honest summary line. */}
      {coverageText && (
        <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
          <Info size={12} color={CMD.ink3} style={{ flexShrink: 0, marginTop: 2 }} />
          <Mono style={{ fontSize: 11, color: CMD.ink3, lineHeight: 1.45 }}>{coverageText}</Mono>
        </div>
      )}

      {/* Advanced view — the unchecked-rules list lives here, not in the glance. */}
      {unchecked.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            aria-expanded={showAdvanced}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '2px 0', fontFamily: 'inherit', color: CMD.ink3, fontSize: 11,
            }}
          >
            {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {showAdvanced ? 'Hide' : 'Show'} unchecked rules ({unchecked.length})
          </button>
          {showAdvanced && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6, paddingLeft: 17 }}>
              {unchecked.map((id) => (
                <Mono key={id} style={{ fontSize: 10.5, color: CMD.ink3 }}>{id}</Mono>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
