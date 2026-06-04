// src/components/Forge/workshop/ForgeOverview.jsx
//
// The Forge Overview — the calm home base. Build-state only (the Forge does not
// equip or deploy). Reads real watchlist / bundle / trait status and shows the
// "ready to equip / in progress" tallies plus the three bench cards, each with
// a recent-shelf preview and a Build entry. Ported from the design's
// ForgeOverview, wired to live data.

import React from 'react';
import { useFK, alpha, Icon, Mono, Eyebrow } from './forgeKit';
import {
  watchlistShelfStatus, bundleShelfStatus,
  countWatchlists, countBundles, countTraits,
} from './forgeStatus';

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

export default function ForgeOverview({ agentName, primary, watchlists = [], bundles = [], equippedTraits = [], onNav, onBuild }) {
  const T = useFK();

  const wlCounts = countWatchlists(watchlists);
  const bCounts = countBundles(bundles);
  const trCounts = countTraits(equippedTraits);
  const totalReady = wlCounts.ready + bCounts.ready + trCounts.ready;
  const totalDraft = wlCounts.draft + bCounts.draft + trCounts.draft;

  const wlPreview = watchlists.slice(0, 2).map((w) => ({ id: w.watchlistId, name: w.name?.trim() || 'Untitled', ready: watchlistShelfStatus(w) === 'ready' }));
  const bPreview = bundles.slice(0, 2).map((b) => ({ id: b.id, name: b.name || 'Bundle', ready: bundleShelfStatus(b) === 'ready' }));
  const trPreview = equippedTraits.slice(0, 2).map((t) => ({ id: t.traitId || t.id, name: t.name || 'Trait', ready: true }));

  const areas = [
    { id: 'watchlists', n: '01', label: 'Watchlists', icon: 'target', color: primary || T.teal, counts: wlCounts, total: watchlists.length, preview: wlPreview, desc: 'The universe your agent watches' },
    { id: 'rules', n: '02', label: 'Rule bundles', icon: 'rules', color: T.gold, counts: bCounts, total: bundles.length, preview: bPreview, desc: 'How it decides + the limits it respects' },
    { id: 'traits', n: '03', label: 'Traits', icon: 'dna', color: T.allocation, counts: trCounts, total: equippedTraits.length, preview: trPreview, desc: 'The disposition that shapes its identity' },
  ];

  return (
    <div className="fw-scroll" style={{ height: '100%', overflowY: 'auto', padding: '22px 18px 30px' }}>
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
                      <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: it.ready ? T.gold : 'transparent', border: it.ready ? 'none' : `1.2px solid ${T.ink3}` }} />
                      <span style={{ fontSize: 11, color: T.ink2, fontWeight: 600, whiteSpace: 'nowrap' }}>{it.name}</span>
                    </div>
                  ))}
                  {a.total > 2 && <div style={{ display: 'flex', alignItems: 'center', padding: '5px 4px' }}><Mono style={{ fontSize: 10, color: T.ink3 }}>+{a.total - 2}</Mono></div>}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 13, paddingTop: 12, borderTop: `1px solid ${T.hair}` }}>
                <Tally ready={a.counts.ready} draft={a.counts.draft} />
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
