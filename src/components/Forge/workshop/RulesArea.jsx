// src/components/Forge/workshop/RulesArea.jsx
//
// Rules area (02) — the new frame: a Build entry that opens the bundle builder,
// and the "My bundles" shelf rendered in the new shelf-card chrome but wired to
// the real bundle model (useForge). Cold-start reuses the existing StarterKit
// (with its auto-equip stripped — home owns equip). The Forge surfaces only
// "make ready" (forge a draft → forged); equip stays on the Home.

import React, { useMemo } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { useFK, alpha, Icon, Mono, AreaHeader, BuildEntry, ShelfHeader, ShelfCard, StatusPill, InUseBadge, MixMeter } from './forgeKit';
import { bundleShelfStatus, bundlePillStatus } from './forgeStatus';
import { bundleHardSoftCounts } from './hardSoftHelper';
import StarterKit from '../StarterKit';

// Reworded "workbench lands next" banner — the polished desktop build/edit
// workbench is a future task; for now building/editing open the current bench.
function WorkbenchBanner({ text }) {
  const T = useFK();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '0 0 16px', padding: '11px 14px', borderRadius: 12, background: alpha(T.copper, 0.05), border: `1px solid ${alpha(T.copper, 0.18)}` }}>
      <Icon name="hammer" size={14} color={T.copper} />
      <Mono style={{ fontSize: 9.5, letterSpacing: '0.04em', color: T.ink2, lineHeight: 1.45 }}>{text}</Mono>
    </div>
  );
}

function BundleCard({ bundle, rulesById, onForgeReady }) {
  const T = useFK();
  const accent = T.gold;
  const counts = bundleHardSoftCounts(bundle, rulesById);
  const pill = bundlePillStatus(bundle);
  const isDraft = pill === 'draft';
  const isEquipped = pill === 'equipped';
  return (
    <ShelfCard accent={accent} status={bundleShelfStatus(bundle)}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bundle.name || 'Rule bundle'}</div>
          <Mono style={{ fontSize: 10, letterSpacing: '0.06em', color: T.ink3, textTransform: 'uppercase', marginTop: 3, display: 'block' }}>{counts.total} rule{counts.total !== 1 ? 's' : ''}</Mono>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <StatusPill status={pill} color={accent} />
          {isEquipped && <InUseBadge />}
        </div>
      </div>
      <div style={{ marginTop: 12 }}><MixMeter soft={counts.soft} hard={counts.hard} /></div>
      {isDraft && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 13, paddingTop: 12, borderTop: `1px solid ${T.hair}` }}>
          <button className="fw-tap" onClick={() => onForgeReady(bundle.id)} style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: T.gold, fontWeight: 700, padding: '6px 12px', borderRadius: 9, background: alpha(T.copper, 0.12), border: `1px solid ${alpha(T.copper, 0.4)}` }}>
            <Icon name="hammer" size={12} color={T.gold} />Make ready
          </button>
        </div>
      )}
    </ShelfCard>
  );
}

export default function RulesArea({ forge, agent, onBuild, onForgeReady, twoCol = false }) {
  const T = useFK();
  const { tokens } = useTheme();
  const agentId = agent?.id || null;
  const rulesById = useMemo(() => new Map(forge.rules.map((r) => [r.id, r])), [forge.rules]);

  const showStarterKit = agentId && agent && !agent.starterKitCompleted && !forge.loading && forge.rules.length === 0 && forge.bundles.length === 0;

  if (showStarterKit) {
    return (
      <div className="fw-scroll" style={{ height: '100%', overflowY: 'auto', padding: '12px 4px calc(84px + env(safe-area-inset-bottom))' }}>
        <StarterKit
          agentId={agentId}
          agent={agent}
          forge={forge}
          tokens={tokens}
          isMobile
          onComplete={() => forge.reloadData()}
          onSkip={() => forge.reloadData()}
        />
      </div>
    );
  }

  // ── Desktop: a two-column preview grid of the real bundles. View + "Make ready"
  // (drafts) only; building/editing route to the existing bench (no per-card edit,
  // no top-level create CTA — the polished workbench is a future task). ───────────
  if (twoCol) {
    return (
      <div className="fw-scroll" style={{ height: '100%', overflowY: 'auto', padding: '22px 24px calc(84px + env(safe-area-inset-bottom))' }}>
        <AreaHeader n="02" name="Rules" slotLine={`How ${agent?.name || 'your agent'} decides + the limits it respects`} accent={T.gold} />
        <WorkbenchBanner text="The polished desktop rules workbench lands next. For now, building and editing open the current bench." />
        <ShelfHeader label="My bundles" count={`${forge.bundles.length} total`} />
        {forge.bundles.length === 0 ? (
          <div style={{ padding: '28px 20px', textAlign: 'center', fontSize: 12.5, color: T.ink3 }}>No bundles yet.</div>
        ) : (
          <div className="fw-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14, alignItems: 'start' }}>
            {forge.bundles.map((b) => (
              <BundleCard key={b.id} bundle={b} rulesById={rulesById} onForgeReady={onForgeReady} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fw-scroll" style={{ height: '100%', overflowY: 'auto', padding: '22px 18px calc(84px + env(safe-area-inset-bottom))' }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
          <Mono style={{ fontSize: 12, letterSpacing: '0.14em', color: T.gold, fontWeight: 700 }}>02</Mono>
          <div style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.02em', color: T.ink }}>Rules</div>
        </div>
        <div style={{ fontSize: 12, color: T.ink2, marginTop: 5 }}>How {agent?.name || 'your agent'} decides + the limits it respects</div>
      </div>

      <BuildEntry title="Forge a new bundle" sub="Browse the rule library · set the hard / soft mix" onBuild={onBuild} />

      <ShelfHeader label="My bundles" count={`${forge.bundles.length} total`} />
      {forge.bundles.length === 0 ? (
        <div style={{ padding: '28px 20px', textAlign: 'center', fontSize: 12.5, color: T.ink3 }}>No bundles yet — forge your first one above.</div>
      ) : (
        <div className="fw-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {forge.bundles.map((b) => (
            <BundleCard key={b.id} bundle={b} rulesById={rulesById} onForgeReady={onForgeReady} />
          ))}
        </div>
      )}
    </div>
  );
}
