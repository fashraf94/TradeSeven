// src/components/FilmRoom/TrainingReportCard.jsx
//
// Archetype Mastery P3 — the per-battle Training Report (spec §10, E6). Reads
// the battle's masteryAward receipt (already on the Film Room's onSnapshot
// doc — no new fetch) + the owner-read mastery profile threaded from the
// screen. Renders: the XP component breakdown, level progress, the
// band-promotion ceremony (SUPPRESSED permanently for levelProvisional
// receipts — they honestly record interim seam state), the next-unlock
// teaser (shipped/cosmetic unlocks ONLY — reserved items are roadmap
// milestones, never entitlements), and the reserved Lessons panel with its
// honest empty state.
//
// DARK CONTRACT: returns null while MASTERY_SURFACE_ENABLED is false, and
// for battles without a receipt — the Film Room column is byte-identical to
// pre-P3 in both cases (photographed). Zero receipts render the PUBLIC
// reasonCode vocabulary only (§4: the Film Room never renders internals).
//
// Styling: Film Room convention — inline styles off the threaded `tokens`
// (DaySummaryCard sibling), not the Dashboard CMD system.

import React from 'react';
import { MASTERY_SURFACE_ENABLED } from '../../../api/_utils/masteryConfig.js';
import {
  levelProgress,
  bandForLevel,
  nextUnlockTeaser,
} from '../../data/masteryProgression.js';
import { getArchetypeDisplayName } from '../../data/archetypeDisplay';

// §4 public reasonCode enum → user copy. The ONLY vocabulary rendered.
const REASON_COPY = {
  quarantined: 'This battle could not be scored for training.',
  daily_ceiling: 'Daily training ceiling reached — later battles on the same day train at reduced or zero rate.',
  flag_disabled: 'Training progression was paused when this battle settled.',
};

const COMPONENT_ROWS = [
  ['participation', 'Participation'],
  ['performance', 'Performance'],
  ['placement', 'Placement'],
  ['completion', 'Completion'],
];

export default function TrainingReportCard({ battle, masteryProfile, tokens }) {
  if (!MASTERY_SURFACE_ENABLED) return null;
  const award = battle?.masteryAward;
  if (!award) return null;

  const archetype = award.archetype || 'unknown';
  const archName = getArchetypeDisplayName(archetype) || archetype;
  const xpFinal = Number.isFinite(award.xpFinal) ? award.xpFinal : 0;
  const reasonCopy = award.reasonCode ? REASON_COPY[award.reasonCode] : null;
  // Quarantined / flag_disabled receipts carry zeroed components — the
  // breakdown rows would be noise; daily_ceiling keeps its real components
  // (the work happened; the rate multiplier zeroed the payout).
  const showBreakdown = !award.reasonCode || award.reasonCode === 'daily_ceiling';

  // Level progress prefers the LIVE profile stream (moves as later awards
  // land); the receipt's levelAfter is the honest fallback when the
  // profile is missing (§7: empty state, never a lie).
  const streamXp = masteryProfile?.archetypes?.[archetype]?.xp;
  const progress = Number.isFinite(streamXp) ? levelProgress(streamXp) : null;
  const level = progress ? progress.level : (Number.isInteger(award.levelAfter) ? award.levelAfter : 1);
  const band = bandForLevel(level);

  // Ceremony (spec §10/§9): promotion beat only for a real level move on a
  // non-provisional receipt — provisional suppression is PERMANENT.
  const promoted = award.levelProvisional !== true
    && Number.isInteger(award.levelBefore)
    && Number.isInteger(award.levelAfter)
    && award.levelAfter > award.levelBefore;
  const bandBefore = promoted ? bandForLevel(award.levelBefore) : null;
  const bandCeremony = promoted && bandBefore && bandBefore.id !== bandForLevel(award.levelAfter).id
    ? bandForLevel(award.levelAfter)
    : null;

  const teaser = nextUnlockTeaser(level);

  const faint = tokens?.textFaint || '#64748b';
  const text = tokens?.textDefault || '#e2e8f0';
  const accent = tokens?.accent || '#5eead4';
  const row = { display: 'flex', justifyContent: 'space-between', fontSize: 12, color: text, lineHeight: 1.7 };

  return (
    <div
      style={{
        margin: '0 12px',
        padding: '16px',
        borderRadius: 12,
        background: tokens?.bgCard || '#15171E',
        border: `1px solid ${tokens?.borderDefault || 'rgba(255,255,255,0.06)'}`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: faint }}>
          Training Report
        </div>
        <div style={{ fontSize: 11, color: faint }}>{archName}</div>
      </div>

      {promoted && (
        <div style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 8, background: 'rgba(94,234,212,0.08)', border: `1px solid ${accent}33` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: accent }}>
            Level up — Level {award.levelAfter}
          </div>
          {bandCeremony && (
            <div style={{ fontSize: 12, color: text, marginTop: 2 }}>
              {bandCeremony.label} band reached
            </div>
          )}
        </div>
      )}

      {showBreakdown && (
        <div style={{ marginBottom: 10 }}>
          {COMPONENT_ROWS.map(([key, label]) => (
            <div key={key} style={row}>
              <span style={{ color: faint }}>{label}</span>
              <span>{Number.isFinite(award.components?.[key]) ? `+${award.components[key]}` : '—'}</span>
            </div>
          ))}
          <div style={{ ...row, borderTop: `1px solid ${tokens?.borderDefault || 'rgba(255,255,255,0.06)'}`, marginTop: 6, paddingTop: 6 }}>
            <span style={{ color: faint }}>
              XP earned
              {award.multipliers && (
                <span style={{ marginLeft: 6 }}>
                  (×{award.multipliers.mode ?? 1} mode · ×{award.multipliers.rateBand ?? 1} slot rate)
                </span>
              )}
            </span>
            <span style={{ fontWeight: 700, color: xpFinal > 0 ? accent : text }}>+{xpFinal} XP</span>
          </div>
        </div>
      )}

      {reasonCopy && (
        <div style={{ fontSize: 12, color: faint, marginBottom: 10, lineHeight: 1.5 }}>{reasonCopy}</div>
      )}

      {progress ? (
        <div style={{ marginBottom: 10 }}>
          <div style={{ ...row, marginBottom: 4 }}>
            <span style={{ color: faint }}>Level {progress.level} · {band?.label}</span>
            <span style={{ color: faint }}>
              {progress.xpForNext === null ? 'Max level' : `${progress.xpForNext} XP to level ${progress.level + 1}`}
            </span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
            <div style={{ height: 4, borderRadius: 2, width: `${progress.pct}%`, background: accent }} />
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: faint, marginBottom: 10 }}>
          Cumulative progress appears once this archetype&apos;s training profile syncs.
        </div>
      )}

      {teaser && (
        <div style={{ fontSize: 12, color: text, marginBottom: 10 }}>
          <span style={{ color: faint }}>Next unlock · Level {teaser.level}: </span>
          {teaser.unlocks.map((u) => u.label).join(' · ')}
        </div>
      )}

      <div>
        <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: faint, marginBottom: 4 }}>
          Lessons
        </div>
        <div style={{ fontSize: 12, color: faint, lineHeight: 1.5 }}>
          No lessons yet — the Lessons program is a roadmap milestone, reserved but not shipped.
        </div>
      </div>
    </div>
  );
}
