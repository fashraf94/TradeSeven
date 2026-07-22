// src/components/Forge/workshop/ForgeOverview.jsx
//
// The Forge Overview — the calm home base. Build-state only (the Forge does not
// equip or deploy). Reads real watchlist / bundle / trait status and shows the
// "ready to equip / in progress" tallies plus the three bench cards, each with
// a recent-shelf preview and a Build entry. Ported from the design's
// ForgeOverview, wired to live data.

import React from 'react';
import { useFK, alpha, Icon, Mono, Eyebrow, StatusPill } from './forgeKit';
import {
  watchlistShelfStatus, bundleShelfStatus, bundlePillStatus,
  countWatchlists, countBundles, countForgeAggregate,
} from './forgeStatus';
import { bundleHardSoftCounts } from './hardSoftHelper';
import { TOTAL_TRAIT_SLOTS } from '../../../data/dnaGroups';
import { getWatchlistProvenance } from '../../../utils/watchlistProvenance';
import { getArchetypeDisplayName } from '../../../data/archetypeDisplay';
import { getArchetypeIdentity } from '../../../data/archetypeIdentity';
import { RELEASE3_CHARACTER_TAB_ENABLED } from '../../../config/featureFlags';
import { tempoLabel } from '../../../data/characterLeanPresentation';
import { STANDING_LEANS_CAP, acceptedStandingLeans } from '../../../../api/_utils/leanRevalidation.js';
// Mastery P3 obligations: preview counts mirror the M5 kernel (accepted
// pins consume slots, other-archetype/stale pins never do) and the cap
// display mirrors the SERVER's effective cap — level-derived only when
// enforcement is live, baseline otherwise (§9 display-agreement). The
// profile hook is dark (null, zero reads) while MASTERY_SURFACE_ENABLED
// is false, so dark renders are byte-identical.
import { MASTERY_ENFORCEMENT_ENABLED } from '../../../../api/_utils/masteryConfig.js';
import { archetypeLevelFromProfile, leanCapForLevel } from '../../../data/masteryProgression.js';
import useMasteryProfile from '../../../hooks/useMasteryProfile';

function Tally({ ready, draft }) {
  const T = useFK();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.gold, boxShadow: `0 0 6px ${alpha(T.gold, 0.6)}` }} />
        <Mono style={{ fontSize: 11, color: T.ink2 }}><b style={{ color: T.ink }}>{ready}</b> ready</Mono>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'transparent', border: `1.4px solid ${T.ink3}` }} />
        <Mono style={{ fontSize: 11, color: T.ink3 }}><b>{draft}</b> draft{draft !== 1 ? 's' : ''}</Mono>
      </div>
    </div>
  );
}

// Traits have no ready/draft lifecycle — equipped library traits are the agent's
// active identity layer, so the Traits bench reads its real equipped count, never
// "ready / drafts" (which would conflate equipped-and-in-use with ready-to-equip).
function EquippedSummary({ equipped, total }) {
  const T = useFK();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.allocation, boxShadow: `0 0 6px ${alpha(T.allocation, 0.5)}` }} />
      <Mono style={{ fontSize: 11, color: T.ink2 }}><b style={{ color: T.ink }}>{equipped}</b> of {total} equipped</Mono>
    </div>
  );
}

// Per-item shelf dot: ready (gold), equipped (allocation), or draft (hollow).
function previewDotStyle(state, T) {
  if (state === 'ready') return { background: T.gold, border: 'none' };
  if (state === 'equipped') return { background: T.allocation, border: 'none' };
  return { background: 'transparent', border: `1.2px solid ${T.ink3}` };
}

// ── Desktop dashboard primitives (twoCol only) ───────────────────────────────

// The wide "ready | drafts" pill in the desktop overview chrome — reuses the
// corrected Watchlists+Rule-bundles aggregate (traits excluded).
function BridgePill({ ready, draft }) {
  const T = useFK();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 999, background: T.surface, border: `1px solid ${T.hair}` }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.gold, boxShadow: `0 0 6px ${alpha(T.gold, 0.6)}` }} />
        <Mono style={{ fontSize: 11, color: T.ink2 }}><b style={{ color: T.ink }}>{ready}</b> ready</Mono>
      </span>
      <span style={{ width: 1, height: 12, background: T.hair2 }} />
      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'transparent', border: `1.4px solid ${T.ink3}` }} />
        <Mono style={{ fontSize: 11, color: T.ink3 }}><b>{draft}</b> draft{draft !== 1 ? 's' : ''}</Mono>
      </span>
    </div>
  );
}

function ColumnHeader({ n, label, desc, icon, color }) {
  const T = useFK();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: alpha(color, 0.13), color }}>
        <Icon name={icon} size={21} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <Mono style={{ fontSize: 10, letterSpacing: '0.12em', color, fontWeight: 700 }}>{n}</Mono>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, letterSpacing: '-0.01em' }}>{label}</div>
        </div>
        <div style={{ fontSize: 11.5, color: T.ink2, marginTop: 2 }}>{desc}</div>
      </div>
    </div>
  );
}

function ShelfRow({ name, meta, status }) {
  const T = useFK();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', borderRadius: 10, background: T.bg, border: `1px solid ${T.hair}` }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
        {meta && <Mono style={{ fontSize: 9, color: T.ink3, letterSpacing: '0.04em', textTransform: 'uppercase', display: 'block', marginTop: 1 }}>{meta}</Mono>}
      </div>
      {status && <div style={{ flexShrink: 0 }}>{status}</div>}
    </div>
  );
}

// A real shelf column (Watchlists / Rule bundles): header + up to 3 shelf rows +
// a footer tally and a Build CTA. The card and the CTA both wire to the existing
// nav/build handlers — no new routes.
function ShelfColumn({ area, rows, emptyText, footer, onNav, onBuild }) {
  const T = useFK();
  return (
    <div className="fw-tap" onClick={() => onNav(area.id)} style={{ display: 'flex', flexDirection: 'column', minWidth: 0, padding: '18px 16px 14px', borderRadius: 18, position: 'relative', overflow: 'hidden', background: T.surface, border: `1px solid ${T.hair}` }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: area.color, opacity: 0.85 }} />
      <ColumnHeader n={area.n} label={area.label} desc={area.desc} icon={area.icon} color={area.color} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14, minHeight: 132 }}>
        {rows.length > 0 ? rows : <div style={{ padding: '14px 10px', textAlign: 'center', fontSize: 11.5, color: T.ink3 }}>{emptyText}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.hair}` }}>
        {footer}
        <button className="fw-tap" onClick={(e) => { e.stopPropagation(); onBuild(area.id); }} style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: T.gold, padding: '7px 12px', borderRadius: 9, background: alpha(T.copper, 0.1), border: `1px solid ${alpha(T.copper, 0.35)}`, whiteSpace: 'nowrap' }}>
          <Icon name="hammer" size={12} color={T.gold} />{area.buildLabel}
        </button>
      </div>
    </div>
  );
}

// The Traits column — intentionally NOT a buildable shelf (no forged/draft trait
// model exists). It leads with the locked archetype (identity context) and shows
// the agent's REAL equipped library traits; the CTA tunes traits in the area.
function TraitsColumn({ archName, archLine, primary, equippedTraits, onNav }) {
  const T = useFK();
  const equipped = equippedTraits.length;
  return (
    <div className="fw-tap" onClick={() => onNav('traits')} style={{ display: 'flex', flexDirection: 'column', minWidth: 0, padding: '18px 16px 14px', borderRadius: 18, position: 'relative', overflow: 'hidden', background: `linear-gradient(165deg, ${alpha(T.allocation, 0.06)}, ${T.surface})`, border: `1px solid ${T.hair}` }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: T.allocation, opacity: 0.85 }} />
      <ColumnHeader n="03" label="Traits" desc="The disposition that shapes its identity" icon="dna" color={T.allocation} />
      <div style={{ marginTop: 14, padding: '12px 13px', borderRadius: 12, background: T.surface, border: `1px solid ${alpha(primary || T.teal, 0.22)}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <Mono style={{ fontSize: 8.5, letterSpacing: '0.14em', color: T.ink3, textTransform: 'uppercase' }}>Your agent is a</Mono>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--fw-mono)', fontSize: 8, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, color: T.ink3, background: alpha(T.ink2, 0.08), border: `1px solid ${T.hair}`, padding: '3px 7px', borderRadius: 999 }}>
            <Icon name="lock" size={8} color={T.ink3} stroke={2.2} />Set at creation
          </span>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, letterSpacing: '-0.01em', marginTop: 3 }}>{archName}</div>
        <div style={{ fontSize: 11, color: T.ink2, marginTop: 3, lineHeight: 1.4 }}>{archLine}</div>
      </div>
      <div style={{ marginTop: 12, minHeight: 64 }}>
        <Mono style={{ fontSize: 9, letterSpacing: '0.1em', color: T.ink3, textTransform: 'uppercase' }}><b style={{ color: T.ink2 }}>{equipped}</b> of {TOTAL_TRAIT_SLOTS} equipped</Mono>
        {equipped > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {equippedTraits.slice(0, 5).map((t) => (
              <span key={t.traitId || t.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 9px', borderRadius: 8, background: T.bg, border: `1px solid ${T.hair}` }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.allocation }} />
                <span style={{ fontSize: 11, color: T.ink2, fontWeight: 600, whiteSpace: 'nowrap' }}>{t.name}</span>
              </span>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 11.5, color: T.ink3, marginTop: 8 }}>No traits equipped yet.</div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.hair}` }}>
        <button className="fw-tap" onClick={(e) => { e.stopPropagation(); onNav('traits'); }} style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: T.allocation, padding: '7px 12px', borderRadius: 9, background: alpha(T.allocation, 0.1), border: `1px solid ${alpha(T.allocation, 0.35)}`, whiteSpace: 'nowrap' }}>
          <Icon name="dna" size={12} color={T.allocation} />Tune traits
        </button>
      </div>
    </div>
  );
}

// Release 3 — the Character column (leans + tempo), replacing the Traits column
// when RELEASE3_CHARACTER_TAB_ENABLED is on. Same shell grammar; the CTA tunes
// the character in the `03` area.
function CharacterColumn({ archName, archLine, standingLeans, acceptedLeanCount, leanCap, tempo, onNav }) {
  const T = useFK();
  // Slots consumed = kernel-accepted pins (M5 mirror); chips still render
  // the raw desired state below.
  const equipped = acceptedLeanCount;
  return (
    <div className="fw-tap" onClick={() => onNav('traits')} style={{ display: 'flex', flexDirection: 'column', minWidth: 0, padding: '18px 16px 14px', borderRadius: 18, position: 'relative', overflow: 'hidden', background: `linear-gradient(165deg, ${alpha(T.allocation, 0.06)}, ${T.surface})`, border: `1px solid ${T.hair}` }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: T.allocation, opacity: 0.85 }} />
      <ColumnHeader n="03" label="Character" desc="The disposition you read, tune, and explore" icon="dna" color={T.allocation} />
      <div style={{ marginTop: 14, padding: '12px 13px', borderRadius: 12, background: T.surface, border: `1px solid ${alpha(T.allocation, 0.22)}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <Mono style={{ fontSize: 8.5, letterSpacing: '0.14em', color: T.ink3, textTransform: 'uppercase' }}>Your agent is a</Mono>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--fw-mono)', fontSize: 8, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, color: T.ink3, background: alpha(T.ink2, 0.08), border: `1px solid ${T.hair}`, padding: '3px 7px', borderRadius: 999 }}>
            <Icon name="lock" size={8} color={T.ink3} stroke={2.2} />Set at creation
          </span>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, letterSpacing: '-0.01em', marginTop: 3 }}>{archName}</div>
        <div style={{ fontSize: 11, color: T.ink2, marginTop: 3, lineHeight: 1.4 }}>{archLine}</div>
      </div>
      <div style={{ marginTop: 12, minHeight: 64 }}>
        <Mono style={{ fontSize: 9, letterSpacing: '0.1em', color: T.ink3, textTransform: 'uppercase' }}><b style={{ color: T.ink2 }}>{equipped}</b> of {leanCap} standing leans · tempo <b style={{ color: T.ink2 }}>{tempoLabel(tempo)}</b></Mono>
        {equipped > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {standingLeans.slice(0, 3).map((l) => (
              <span key={l.adjustmentId} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 9px', borderRadius: 8, background: T.bg, border: `1px solid ${T.hair}` }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.allocation }} />
                <span style={{ fontFamily: 'var(--fw-mono)', fontSize: 11, color: T.ink2, fontWeight: 600, whiteSpace: 'nowrap' }}>{l.adjustmentId}</span>
              </span>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 11.5, color: T.ink3, marginTop: 8 }}>No standing leans equipped yet.</div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.hair}` }}>
        <button className="fw-tap" onClick={(e) => { e.stopPropagation(); onNav('traits'); }} style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: T.allocation, padding: '7px 12px', borderRadius: 9, background: alpha(T.allocation, 0.1), border: `1px solid ${alpha(T.allocation, 0.35)}`, whiteSpace: 'nowrap' }}>
          <Icon name="dna" size={12} color={T.allocation} />Tune character
        </button>
      </div>
    </div>
  );
}

export default function ForgeOverview({ agentName, primary, watchlists = [], bundles = [], equippedTraits = [], rules = [], agent, twoCol = false, onNav, onBuild, onClose }) {
  const T = useFK();
  const rulesById = React.useMemo(() => new Map((rules || []).map((r) => [r.id, r])), [rules]);

  const wlCounts = countWatchlists(watchlists);
  const bCounts = countBundles(bundles);
  // "Ready to equip / in progress" = Watchlists + Rule bundles only (equipped
  // traits are in-use, not ready-to-equip — surfaced as their own equipped count).
  const { ready: totalReady, draft: totalDraft } = countForgeAggregate(watchlists, bundles);
  const equippedCount = equippedTraits.length;
  // Release 3 — the `03` bench becomes Character when on (leans + tempo); off is
  // byte-identical to the Traits card. `?release3Character=1` force-previews.
  const characterOn =
    RELEASE3_CHARACTER_TAB_ENABLED ||
    (typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('release3Character') === '1');
  const standingLeans = agent?.standingLeans || [];
  const desiredTempo = agent?.dials?.tempo || 'standard';
  const masteryProfile = useMasteryProfile(agent?.ownerId || null);
  const acceptedLeanCount = characterOn
    ? acceptedStandingLeans({ standingLeans, archetypeCodeId: agent?.archetype }).length
    : 0;
  const effectiveLeanCap = MASTERY_ENFORCEMENT_ENABLED && masteryProfile
    ? leanCapForLevel(archetypeLevelFromProfile(masteryProfile, agent?.archetype))
    : STANDING_LEANS_CAP;

  const wlPreview = watchlists.slice(0, 2).map((w) => ({ id: w.watchlistId, name: w.name?.trim() || 'Untitled', state: watchlistShelfStatus(w) === 'ready' ? 'ready' : 'draft' }));
  const bPreview = bundles.slice(0, 2).map((b) => ({ id: b.id, name: b.name || 'Bundle', state: bundleShelfStatus(b) === 'ready' ? 'ready' : 'draft' }));
  const trPreview = equippedTraits.slice(0, 2).map((t) => ({ id: t.traitId || t.id, name: t.name || 'Trait', state: 'equipped' }));
  const leanPreview = standingLeans.slice(0, 2).map((l) => ({ id: l.adjustmentId, name: l.adjustmentId, state: 'equipped' }));

  const characterArea = { id: 'traits', n: '03', label: 'Character', icon: 'dna', color: T.allocation, equipped: acceptedLeanCount, slots: effectiveLeanCap, total: standingLeans.length, preview: leanPreview, desc: `Standing leans + tempo · ${tempoLabel(desiredTempo)}` };
  const traitsArea = { id: 'traits', n: '03', label: 'Traits', icon: 'dna', color: T.allocation, equipped: equippedCount, slots: TOTAL_TRAIT_SLOTS, total: equippedTraits.length, preview: trPreview, desc: 'The disposition that shapes its identity' };

  const areas = [
    { id: 'watchlists', n: '01', label: 'Watchlists', icon: 'target', color: primary || T.teal, counts: wlCounts, total: watchlists.length, preview: wlPreview, desc: 'The universe your agent watches' },
    { id: 'rules', n: '02', label: 'Rule bundles', icon: 'rules', color: T.gold, counts: bCounts, total: bundles.length, preview: bPreview, desc: 'How it decides + the limits it respects' },
    characterOn ? characterArea : traitsArea,
  ];

  // ── Desktop: the three-bench dashboard ─────────────────────────────────────
  if (twoCol) {
    const archName = getArchetypeDisplayName(agent?.archetype);
    const archLine = getArchetypeIdentity(agent?.archetype)?.disposition || '';

    const wlRows = watchlists.slice(0, 3).map((w) => {
      const prov = getWatchlistProvenance(w);
      const meta = `${prov.label ? `${prov.label} · ` : ''}${prov.count} name${prov.count !== 1 ? 's' : ''}`;
      return <ShelfRow key={w.watchlistId} name={w.name?.trim() || 'Untitled'} meta={meta} status={<StatusPill status={watchlistShelfStatus(w)} color={primary || T.teal} />} />;
    });

    const bRows = bundles.slice(0, 3).map((b) => {
      const c = bundleHardSoftCounts(b, rulesById);
      const meta = `${c.total} rule${c.total !== 1 ? 's' : ''} · ${c.hard} hard`;
      return <ShelfRow key={b.id} name={b.name || 'Rule bundle'} meta={meta} status={<StatusPill status={bundlePillStatus(b)} color={T.gold} />} />;
    });

    return (
      <div className="fw-scroll" style={{ height: '100%', overflowY: 'auto', padding: '22px 24px calc(84px + env(safe-area-inset-bottom))' }}>
        {/* header + chrome: intro, the corrected ready|drafts pill, Command bridge → Home */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 20 }}>
          <div style={{ minWidth: 0 }}>
            <Eyebrow color={T.ink3}>The workshop behind the bridge</Eyebrow>
            <div style={{ fontSize: 27, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 6, color: T.ink, lineHeight: 1.2, maxWidth: 640 }}>
              Build, refine, and finalize the gear {agentName || 'your agent'} takes into battle.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <BridgePill ready={totalReady} draft={totalDraft} />
            <button className="fw-tap" onClick={onClose} aria-label="Back to the command bridge" style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, color: T.ink, padding: '9px 14px', borderRadius: 11, background: T.surface, border: `1px solid ${T.hair2}`, whiteSpace: 'nowrap' }}>
              <Icon name="compass" size={14} color={T.copper} />Command bridge
            </button>
          </div>
        </div>

        <Eyebrow color={T.ink2} style={{ marginBottom: 12 }}>Three benches · one workshop</Eyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 18, alignItems: 'start' }}>
          <ShelfColumn
            area={{ id: 'watchlists', n: '01', label: 'Watchlists', desc: 'The universe your agent watches', icon: 'target', color: primary || T.teal, buildLabel: 'Build a watchlist' }}
            rows={wlRows}
            emptyText="No watchlists yet."
            footer={<Tally ready={wlCounts.ready} draft={wlCounts.draft} />}
            onNav={onNav}
            onBuild={onBuild}
          />
          <ShelfColumn
            area={{ id: 'rules', n: '02', label: 'Rule bundles', desc: 'How it decides + the limits it respects', icon: 'rules', color: T.gold, buildLabel: 'Build a bundle' }}
            rows={bRows}
            emptyText="No bundles yet."
            footer={<Tally ready={bCounts.ready} draft={bCounts.draft} />}
            onNav={onNav}
            onBuild={onBuild}
          />
          {characterOn
            ? <CharacterColumn archName={archName} archLine={archLine} standingLeans={standingLeans} acceptedLeanCount={acceptedLeanCount} leanCap={effectiveLeanCap} tempo={desiredTempo} onNav={onNav} />
            : <TraitsColumn archName={archName} archLine={archLine} primary={primary} equippedTraits={equippedTraits} onNav={onNav} />}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 18, padding: '12px 14px', borderRadius: 12, background: alpha(T.copper, 0.04), border: `1px solid ${alpha(T.copper, 0.16)}` }}>
          <Icon name="hammer" size={14} color={T.copper} />
          <div style={{ fontSize: 11.5, color: T.ink2, lineHeight: 1.45 }}>
            Each bench makes the gear for one slot on your command bridge. Forge it <b style={{ color: T.ink }}>ready</b> here — equip it at home.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fw-scroll" style={{ height: '100%', overflowY: 'auto', padding: '22px 18px calc(84px + env(safe-area-inset-bottom))' }}>
      <div className="fw-stagger">
        {/* intro */}
        <div style={{ marginBottom: 18 }}>
          <Eyebrow color={T.ink3}>The workshop behind the bridge</Eyebrow>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 6, color: T.ink, lineHeight: 1.25 }}>
            Build, refine, and finalize the gear {agentName || 'your agent'} takes into battle.
          </div>
        </div>

        {/* forge status — calm, build-state only */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <div style={{ flex: 1, padding: '14px 15px', borderRadius: 15, background: T.surface, border: `1px solid ${alpha(T.copper, 0.25)}`, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -10, right: -10, width: 50, height: 50, borderRadius: '50%', background: alpha(T.copper, 0.12), filter: 'blur(10px)' }} />
            <Mono style={{ fontSize: 30, fontWeight: 700, color: T.ink, lineHeight: 1 }}>{totalReady}</Mono>
            <Mono style={{ fontSize: 9, letterSpacing: '0.12em', color: T.gold, textTransform: 'uppercase', display: 'block', marginTop: 6 }}>Ready to equip</Mono>
          </div>
          <div style={{ flex: 1, padding: '14px 15px', borderRadius: 15, background: T.surface, border: `1px solid ${T.hair}` }}>
            <Mono style={{ fontSize: 30, fontWeight: 700, color: T.ink2, lineHeight: 1 }}>{totalDraft}</Mono>
            <Mono style={{ fontSize: 9, letterSpacing: '0.12em', color: T.ink3, textTransform: 'uppercase', display: 'block', marginTop: 6 }}>In progress</Mono>
          </div>
        </div>

        {/* the three benches */}
        <Eyebrow color={T.ink2} style={{ marginBottom: 12 }}>Three benches · one workshop</Eyebrow>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {areas.map((a) => (
            <div key={a.id} className="fw-tap" onClick={() => onNav(a.id)} style={{ padding: '16px 16px 14px', borderRadius: 18, position: 'relative', overflow: 'hidden', background: T.surface, border: `1px solid ${T.hair}` }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: a.color, opacity: 0.85 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: alpha(a.color, 0.13), color: a.color }}>
                  <Icon name={a.icon} size={21} color={a.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <Mono style={{ fontSize: 10, letterSpacing: '0.12em', color: a.color, fontWeight: 700 }}>{a.n}</Mono>
                    <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, letterSpacing: '-0.01em' }}>{a.label}</div>
                  </div>
                  <div style={{ fontSize: 11.5, color: T.ink2, marginTop: 2 }}>{a.desc}</div>
                </div>
                <Icon name="chevR" size={16} color={T.ink3} />
              </div>

              {a.preview.length > 0 && (
                <div style={{ display: 'flex', gap: 7, marginTop: 13, flexWrap: 'wrap' }}>
                  {a.preview.map((it) => (
                    <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 9px', borderRadius: 8, background: T.bg, border: `1px solid ${T.hair}` }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, ...previewDotStyle(it.state, T) }} />
                      <span style={{ fontSize: 11, color: T.ink2, fontWeight: 600, whiteSpace: 'nowrap' }}>{it.name}</span>
                    </div>
                  ))}
                  {a.total > 2 && <div style={{ display: 'flex', alignItems: 'center', padding: '5px 4px' }}><Mono style={{ fontSize: 10, color: T.ink3 }}>+{a.total - 2}</Mono></div>}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 13, paddingTop: 12, borderTop: `1px solid ${T.hair}` }}>
                {a.id === 'traits'
                  ? <EquippedSummary equipped={a.equipped} total={a.slots} />
                  : <Tally ready={a.counts.ready} draft={a.counts.draft} />}
                <button className="fw-tap" onClick={(e) => { e.stopPropagation(); onBuild(a.id); }} style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: T.gold, padding: '7px 12px', borderRadius: 9, background: alpha(T.copper, 0.1), border: `1px solid ${alpha(T.copper, 0.35)}`, whiteSpace: 'nowrap' }}>
                  <Icon name="hammer" size={12} color={T.gold} />Build
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* mental-model note */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 18, padding: '12px 14px', borderRadius: 12, background: alpha(T.copper, 0.04), border: `1px solid ${alpha(T.copper, 0.16)}` }}>
          <Icon name="hammer" size={14} color={T.copper} />
          <div style={{ fontSize: 11, color: T.ink2, lineHeight: 1.45 }}>
            Each bench makes the gear for one slot on your command bridge. Forge it <b style={{ color: T.ink }}>ready</b> here — equip it at home.
          </div>
        </div>
      </div>
    </div>
  );
}
