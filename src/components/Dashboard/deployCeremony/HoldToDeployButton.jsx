// src/components/Dashboard/deployCeremony/HoldToDeployButton.jsx
//
// Deploy Ceremony · Act 1 — the hold-to-arm button, rendered ONLY when the
// ceremony flag is on (each deploy site keeps its byte-identical tap button
// flag-off, so this never touches the flag-off render — spec §11).
//
// Two variants, both accent-only (no new color — spec §4 / discovery Q3):
//   - 'filled'  the primary CTAs (DeployStation, DeployCard, ReadColumn primary,
//               the mobile Read-station button). Resting is an accent TRACK; a
//               full-opacity accent fill sweeps left→right; the label + icon flip
//               to the dark on-accent value past ~45% fill.
//   - 'muted'   the "Deploy without previewing" underline (founder ruling #5):
//               a thin accent progress rule grows beneath the text instead of a
//               charge-fill, matching the element's restrained weight.
//
// The maturity-derived label (deployText) is PRESERVED — the hold never replaces
// the copy (spec §4). On completion the label becomes "Locked in" for the ~450ms
// beat before the overlay mounts.

import React from 'react';
import { motion } from 'framer-motion';
import { CMD, alpha, readableOn } from '../commandUI';
import useHoldToDeploy from '../../../hooks/useHoldToDeploy';

export default function HoldToDeployButton({
  variant = 'filled',
  accent = CMD.teal,
  label,
  Icon = null,
  iconSize = 18,
  iconFill = false,
  onComplete,
  disabled = false,
  enabled = true,
  style,
  ariaLabel,
}) {
  const { phase, progress, bind, locked } = useHoldToDeploy({ enabled, disabled, onComplete });
  const charging = phase === 'charging';
  const flipped = locked || progress > 0.45;
  const ink = readableOn(accent);
  const shownLabel = locked ? 'Locked in' : label;
  // Fill snaps per-frame while charging; drains/settles with a transition otherwise
  // (early-release drain ~250ms per spec §4; settle-to-full on lock).
  const fillTransition = charging ? 'none' : 'width 250ms ease';

  const holdAria = ariaLabel || `Hold to deploy${label ? ` — ${label}` : ''}. Press and hold, or press Enter to deploy immediately.`;

  if (variant === 'muted') {
    // The "Deploy without previewing" escape hatch — restrained: a thin accent
    // rule beneath the text, never the full charge-fill.
    return (
      <button
        type="button"
        {...bind}
        disabled={disabled}
        aria-label={holdAria}
        style={{
          position: 'relative', display: 'block', margin: '9px auto 0', padding: '4px 8px 7px',
          background: 'transparent', border: 'none', cursor: disabled ? 'default' : 'pointer',
          fontFamily: 'inherit', color: locked ? accent : CMD.ink3, fontSize: 12, fontWeight: 600,
          opacity: disabled ? 0.5 : 1, touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
          ...style,
        }}
      >
        <span style={{ position: 'relative' }}>{shownLabel}</span>
        <span
          aria-hidden
          style={{
            position: 'absolute', left: 8, right: 8, bottom: 2, height: 2, borderRadius: 2,
            background: alpha(accent, 0.28), overflow: 'hidden',
          }}
        >
          <span
            style={{
              position: 'absolute', left: 0, top: 0, bottom: 0, width: `${progress * 100}%`,
              background: accent, transition: fillTransition,
            }}
          />
        </span>
      </button>
    );
  }

  // 'filled' — the primary CTA. Accent track + sweeping accent fill.
  return (
    <motion.button
      type="button"
      {...bind}
      disabled={disabled}
      aria-label={holdAria}
      style={{
        position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        border: `1px solid ${alpha(accent, 0.5)}`, cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'inherit', background: alpha(accent, 0.16), color: flipped ? ink : accent,
        fontWeight: 700, opacity: disabled ? 0.6 : 1,
        touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
        ...style,
      }}
    >
      {/* accent fill sweep — the same accent at full opacity over the track */}
      <span
        aria-hidden
        style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: `${progress * 100}%`,
          background: accent, transition: fillTransition,
        }}
      />
      {Icon && (
        <Icon
          size={iconSize}
          color={flipped ? ink : accent}
          fill={iconFill ? (flipped ? ink : accent) : 'none'}
          style={{ position: 'relative', zIndex: 1, flexShrink: 0 }}
        />
      )}
      <span style={{ position: 'relative', zIndex: 1, letterSpacing: '-0.01em' }}>{shownLabel}</span>
    </motion.button>
  );
}
