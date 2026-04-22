// src/components/Season/CompileTransparencyPanel.jsx
//
// Expandable transparency panel rendered on Step 2 of SeasonEntryModal when
// the dimension values were pre-filled from a Workshop Mode compile.
//
// Surfaces the four outputs from /api/forge/compile-dimensions that would
// otherwise be invisible to the user:
//
//   warnings        — gaps the model detected in the user's strategy
//   appliedClamps   — values that were silently bounded (e.g. position size
//                     capped to a safe ceiling)
//   mappingNotes    — how the model translated thesis → sliders
//   confidence      — bucketed self-rated confidence (raw scalar persisted
//                     to the bundle doc by SeasonEntryModal.handleDeploy)
//
// Empty-state behavior: when nothing is worth surfacing (no warnings, no
// clamps, no notes, and confidence is null or >= 0.75), the component
// renders as a plain <div> visually identical to the original static
// "From Your Conversation" banner — no chevron, no badges, no interactivity.
// This keeps the clean-compile case quiet.

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Sliders,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import { HOLO_COLORS } from '../../constants/holoTheme';

const TROPHY_GOLD = '#F0C75E';
const RED = '#EF4444';
const AMBER = '#F59E0B';

const SHELL_STYLE = {
  padding: '10px 12px',
  background: 'rgba(240, 199, 94, 0.08)',
  border: `1px solid ${TROPHY_GOLD}`,
  borderRadius: 8,
  fontSize: 12,
  color: HOLO_COLORS.textSecondary,
  lineHeight: 1.5,
  marginBottom: 12,
};

const HEADLINE_NODES = (
  <>
    <span style={{ fontWeight: 700, color: TROPHY_GOLD }}>
      From Your Conversation
    </span>{' '}
    — these dimensions were pre-filled from your Workshop Mode chat. Review
    and adjust any slider before launching.
  </>
);

function Pill({ color, children }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        color,
        background: `${color}26`,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

function Section({ icon, label, accent, items }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 4,
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          color: accent,
        }}
      >
        {icon}
        <span>{label}</span>
      </div>
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        {items.map((item, idx) => (
          <li
            key={idx}
            style={{
              display: 'flex',
              gap: 6,
              fontSize: 12,
              color: HOLO_COLORS.textSecondary,
              lineHeight: 1.45,
            }}
          >
            <span aria-hidden="true" style={{ color: accent, flex: '0 0 auto' }}>
              •
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function CompileTransparencyPanel({
  confidence = null,
  warnings = [],
  mappingNotes = [],
  appliedClamps = [],
}) {
  const [expanded, setExpanded] = useState(false);

  const safeWarnings = Array.isArray(warnings) ? warnings : [];
  const safeClamps = Array.isArray(appliedClamps) ? appliedClamps : [];
  const safeNotes = Array.isArray(mappingNotes) ? mappingNotes : [];

  const hasWarnings = safeWarnings.length > 0;
  const hasClamps = safeClamps.length > 0;
  const hasNotes = safeNotes.length > 0;

  const confidenceBucket = useMemo(() => {
    if (typeof confidence !== 'number') return null;
    if (confidence >= 0.75) return null;
    if (confidence >= 0.5) return 'medium';
    return 'low';
  }, [confidence]);

  const isExpandable =
    hasWarnings || hasClamps || hasNotes || confidenceBucket != null;

  // Clean-compile case: render the original static banner with no chevron,
  // no badges, no interactive semantics. Visually identical to today.
  if (!isExpandable) {
    return <div style={SHELL_STYLE}>{HEADLINE_NODES}</div>;
  }

  const toggle = () => setExpanded((v) => !v);

  return (
    <div style={SHELL_STYLE}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 10,
          width: '100%',
          padding: 0,
          margin: 0,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
          fontSize: 'inherit',
          lineHeight: 'inherit',
          color: HOLO_COLORS.textSecondary,
        }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>{HEADLINE_NODES}</span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            flex: '0 0 auto',
            paddingTop: 1,
          }}
        >
          {hasWarnings && (
            <Pill color={RED}>
              {safeWarnings.length} {safeWarnings.length === 1 ? 'gap' : 'gaps'}
            </Pill>
          )}
          {hasClamps && <Pill color={AMBER}>{safeClamps.length} adjusted</Pill>}
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'inline-flex' }}
          >
            <ChevronDown size={14} color={HOLO_COLORS.textSecondary} />
          </motion.span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="transparency-detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            {hasWarnings && (
              <Section
                icon={<AlertTriangle size={14} color={RED} />}
                label="Gaps in your strategy"
                accent={RED}
                items={safeWarnings}
              />
            )}
            {hasClamps && (
              <Section
                icon={<Sliders size={14} color={AMBER} />}
                label="What got adjusted"
                accent={AMBER}
                items={safeClamps}
              />
            )}
            {hasNotes && (
              <Section
                icon={
                  <CheckCircle2
                    size={14}
                    color={HOLO_COLORS.textSecondary}
                  />
                }
                label="How your thesis mapped"
                accent={HOLO_COLORS.textSecondary}
                items={safeNotes}
              />
            )}
            {confidenceBucket && (
              <div
                style={{
                  marginTop: 12,
                  fontSize: 11,
                  color: HOLO_COLORS.textMuted,
                  fontStyle: 'italic',
                }}
              >
                {confidenceBucket === 'medium'
                  ? 'Medium confidence — review the sliders before launching.'
                  : 'Low confidence — several elements may not have mapped cleanly.'}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
