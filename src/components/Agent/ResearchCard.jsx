// src/components/Agent/ResearchCard.jsx
//
// THE RESEARCH CARD — Phase C §3 (D-117, D-119). A PURE RENDER.
//
// The platform's own numbers, dated and attributed. Every string on this card
// was composed by the server and persisted on the exchange (api/_utils/
// researchCard.js); this component computes NOTHING — no re-derivation, no
// second rounding, no label built beside a number it did not come with
// (BUILD_RULES §9). Handed a card, it draws it; handed nothing, it draws
// nothing.
//
// THE PLATFORM-DATA LABEL SITS INSIDE THE CARD (Sol C-4, D-119). Phase B's
// evidence section is footed `What this check saw`; this card is what the
// platform knows and the decider did not necessarily see. The two can appear on
// one screen, so the label has to travel with the numbers it governs rather than
// live in a header a player has to reconstruct. It is a field of the card, and
// it is rendered here, above the sections it covers.
//
// EACH SECTION CARRIES ITS OWN PROVENANCE, and the two data classes never share
// one. That is the enforceable claim, and the one the tests assert; "never be
// confused with it" is stronger than the build can prove.
//
// NO NARRATION IN V1. The character does not speak this card. If the player
// asks a follow-up, the card reaches the grounded prompt as a typed PLATFORM
// RESEARCH block (§5), never as the character's own earlier words (D-121).

import React from 'react';
import { cssVar } from '../../theme/cssTokens';
import { BATTLE_VIEW_COPY } from '../../screens/battleView/battleViewCopy';

const mono = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontVariantNumeric: 'tabular-nums',
};

const provenance = {
  fontSize: 10.5,
  color: cssVar('text-muted'),
  letterSpacing: '0.02em',
};

/** One section: its facts, then the line that says where they came from. */
function Section({ name, facts, label }) {
  if (!Array.isArray(facts) || facts.length === 0) return null;
  return (
    <div data-research-section={name} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ ...mono, fontSize: 11.5, color: cssVar('text-secondary'), display: 'flex', flexWrap: 'wrap', gap: '3px 10px' }}>
        {facts.map((fact) => <span key={fact}>{fact}</span>)}
      </div>
      {/* The section's OWN provenance. A section without one does not render a
          bare line in its place — the composer already refuses to emit an
          undated section, so this is the second half of the same rule. */}
      {label ? <div data-research-provenance={name} style={provenance}>{label}</div> : null}
    </div>
  );
}

/**
 * @param {object|null} card     the persisted, server-composed card
 * @param {function|null} onEquip  D-54's forward path. The door renders ONLY
 *   with a handler AND with the card's own `equip` flag — the per-name equip
 *   mechanism is not built on this screen yet (PaneOverflow.jsx: "Read and
 *   Equip are not built"), so no caller passes one today and the door is absent.
 *   The card does not promise a path it cannot open (hazard 7).
 */
export default function ResearchCard({ card = null, onEquip = null }) {
  if (!card || typeof card !== 'object') return null;
  const { symbol, eyebrow, platformDataLabel, technicals, fundamentals, standing, equip } = card;

  return (
    <div
      data-research-card={symbol || ''}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        maxWidth: '85%',
        padding: '10px 14px',
        borderRadius: '0 12px 12px 12px',
        background: `rgba(var(--ft-scrim-rgb), 0.06)`,
        borderLeft: `3px solid ${cssVar('text-muted')}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        {eyebrow ? (
          <span
            data-research-eyebrow="1"
            style={{
              ...mono,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: cssVar('text-muted'),
            }}
          >
            {eyebrow}
          </span>
        ) : null}
        {symbol ? (
          <span style={{ ...mono, fontSize: 13, fontWeight: 700, color: cssVar('text-primary') }}>{symbol}</span>
        ) : null}
      </div>

      {/* THE LABEL, ON THE CARD (Sol C-4). Never a page-level legend. */}
      {platformDataLabel ? (
        <div data-research-platform-label="1" style={provenance}>{platformDataLabel}</div>
      ) : null}

      <Section name="technicals" facts={technicals?.facts} label={technicals?.label} />
      <Section name="fundamentals" facts={fundamentals?.facts} label={fundamentals?.label} />

      {/* The standing: the row's own numbers when the name is held, or the one
          ruled absence line. It carries no provenance line of its own — its
          provenance is the board, which is on the same screen. */}
      {standing ? (
        <div data-research-section="standing" style={{ ...mono, fontSize: 11.5, color: cssVar('text-secondary') }}>
          {standing.line || standing.facts.join(' · ')}
        </div>
      ) : null}

      {equip && typeof onEquip === 'function' ? (
        <div>
          <button
            type="button"
            data-research-equip={symbol}
            onClick={() => onEquip(symbol)}
            style={{
              background: 'transparent',
              border: `1px solid ${cssVar('teal')}`,
              color: cssVar('teal'),
              borderRadius: 16,
              padding: '5px 11px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {BATTLE_VIEW_COPY.showItEquip}
          </button>
        </div>
      ) : null}
    </div>
  );
}
