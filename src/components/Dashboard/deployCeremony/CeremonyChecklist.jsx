// src/components/Dashboard/deployCeremony/CeremonyChecklist.jsx
//
// Deploy Ceremony · Act 2, reduced-motion variant (spec §9). The theater is
// replaced by a STATIC checklist that checks items off at the real checkpoints —
// no typewriter (the excerpt renders at once), no counter animation, no motion.
// Content is identical in substance to the animated theater; only the motion is
// removed.

import React from 'react';
import { Check, Loader } from 'lucide-react';
import { CMD, alpha, Mono } from '../commandUI';
import { isExcerptTruncated } from './ceremonyData';

const ITEMS = [
  { key: 'loadout', label: 'Loading the loadout' },
  { key: 'scanning', label: 'Scanning the market' },
  { key: 'brief', label: 'Strategy brief' },
  { key: 'portfolio', label: 'Constructing portfolio' },
];

export default function CeremonyChecklist({
  accent, agentName, stageIndex,
  archetype, watchlistName, watchlistSymbols, directiveCount, regime,
  scanCount, briefExcerpt, shortlistCount, fallbackKind, fullBrief, picks,
}) {
  // An item is complete once the display stage has advanced past it (min-floor +
  // real checkpoint). The active item is the first incomplete one.
  const doneCount = stageIndex; // stages 0..3; stageIndex is the current index
  const truncated = isExcerptTruncated(briefExcerpt, fullBrief);

  const briefLine = fallbackKind === 'strategy'
    ? `${agentName} went with its instincts today.`
    : briefExcerpt == null
      ? 'Working through the read…'
      : `${briefExcerpt}${truncated ? '…' : ''}`;

  return (
    <div style={{ width: '100%', maxWidth: 420, margin: '0 auto', padding: '0 22px' }}>
      <Mono style={{ display: 'block', fontSize: 11, letterSpacing: '0.16em', color: accent, textTransform: 'uppercase', fontWeight: 600, marginBottom: 16 }}>
        Deploying {agentName}
      </Mono>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ITEMS.map((item, i) => {
          const complete = i < doneCount;
          const active = i === doneCount;
          return (
            <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 11, opacity: complete || active ? 1 : 0.5 }}>
              <span style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: complete ? alpha(accent, 0.16) : 'transparent',
                border: `1px solid ${complete || active ? alpha(accent, 0.5) : CMD.hair2}`,
              }}>
                {complete ? <Check size={14} color={accent} /> : active ? <Loader size={13} color={accent} /> : null}
              </span>
              <span style={{ fontSize: 14, color: complete ? CMD.ink : active ? CMD.ink : CMD.ink3, fontWeight: active ? 600 : 500 }}>
                {item.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Real content for the active stage — rendered statically, all at once. */}
      <div style={{ marginTop: 18, borderTop: `1px solid ${CMD.hair}`, paddingTop: 14, minHeight: 60 }}>
        {stageIndex === 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              archetype,
              watchlistName && (watchlistSymbols?.length ? `${watchlistName} · ${watchlistSymbols.slice(0, 4).join(' · ')}` : watchlistName),
              directiveCount > 0 && `${directiveCount} directive${directiveCount === 1 ? '' : 's'} active`,
              regime && `Regime: ${regime}`,
            ].filter(Boolean).map((c, i) => (
              <span key={i} style={{ fontSize: 12, color: CMD.ink, padding: '5px 11px', borderRadius: 999, background: alpha(accent, 0.08), border: `1px solid ${alpha(accent, 0.24)}` }}>{c}</span>
            ))}
          </div>
        )}
        {stageIndex === 1 && (
          <Mono style={{ fontSize: 13, color: CMD.ink }}>
            {scanCount != null ? `${scanCount} symbols read` : 'Reading the market…'}
          </Mono>
        )}
        {stageIndex === 2 && (
          <div>
            <div style={{ fontSize: 13.5, lineHeight: 1.6, color: CMD.ink }}>{briefLine}</div>
            {shortlistCount != null && (
              <Mono style={{ fontSize: 12, color: accent, marginTop: 10, display: 'block' }}>{shortlistCount} candidates flagged</Mono>
            )}
          </div>
        )}
        {stageIndex === 3 && (
          <Mono style={{ fontSize: 13, color: CMD.ink }}>
            {picks?.length ? picks.join(' · ') : 'Building the portfolio…'}
          </Mono>
        )}
      </div>
    </div>
  );
}
