// src/components/Dashboard/desktop/EquipBench.jsx
//
// Center column · "02 · Equip" — the desktop loadout bench. Three slots laid out
// as a horizontal row (Archetype · Watchlist · Rules). Identity lives in the
// left IdentityPanel, so this bench carries no orb/name (unlike the mobile
// EquipStation's character-sheet). Wiring is identical to EquipStation: forged
// bundles via useForge, committed watchlists via the watchlist services,
// equip/unequip via the existing agentService + forge paths. The pickers
// center-dock on desktop (EquipSheet/RuleBundlePicker/ArchetypePicker
// dock="center"). The Archetype slot opens the six-card archetype picker.

import React, { useState, useEffect, useMemo } from 'react';
import { Sparkles, Target, Dna, Plus } from 'lucide-react';
import { CMD, alpha, Mono, SectionLabel } from '../commandUI';
import EquipSheet from '../EquipSheet';
import RuleBundlePicker from '../RuleBundlePicker';
import ArchetypePicker from '../ArchetypePicker';
import TraitsSheet from '../TraitsSheet';
import { useForge } from '../../../hooks/useForge';
import { listWatchlists } from '../../../services/forgeWatchlistService';
import { filterWatchlistsByStatus } from '../../Forge/Watchlist/filterWatchlistsByStatus';
import { equipWatchlist, unequipWatchlist } from '../../../services/agentService';
import { getArchetypeDisplayName } from '../../../data/archetypeDisplay';
import { getArchetypeIdentity } from '../../../data/archetypeIdentity';
import { TRAIT_BY_ID } from '../../../data/traitLibrary';

function tickerLabel(tickers) {
  const syms = (tickers || [])
    .map((t) => (typeof t === 'string' ? t : t?.symbol || t?.ticker))
    .filter(Boolean);
  if (syms.length === 0) return `${(tickers || []).length} tickers`;
  return syms.slice(0, 4).join(' · ') + (syms.length > 4 ? ` +${syms.length - 4}` : '');
}

// horizontal (row) slot — tall card, icon top, label/name/sub below
function RowSlot({ filled, icon, catColor, label, name, sub, locked, onClick }) {
  const interactive = Boolean(onClick) && !locked;

  if (!filled) {
    return (
      <div
        onClick={interactive ? onClick : undefined}
        style={{
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10,
          padding: '14px 13px', borderRadius: 14, minHeight: 116,
          border: `1.4px dashed ${CMD.hair2}`, background: alpha('#FFFFFF', 0.012),
          opacity: locked ? 0.4 : 1, cursor: interactive ? 'pointer' : 'default',
        }}
      >
        <div style={{ width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px dashed ${CMD.hair2}`, color: CMD.ink3 }}>
          <Plus size={16} color={CMD.ink2} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, color: CMD.ink2, fontWeight: 500 }}>{name}</div>
          <Mono style={{ fontSize: 9.5, letterSpacing: '0.14em', color: CMD.ink3, textTransform: 'uppercase', display: 'block', marginTop: 3 }}>{sub}</Mono>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={interactive ? onClick : undefined}
      style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10,
        padding: '14px 13px', borderRadius: 14, minHeight: 116, position: 'relative', overflow: 'hidden',
        border: `1px solid ${CMD.hair}`, background: CMD.surface, cursor: interactive ? 'pointer' : 'default',
      }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: catColor, opacity: 0.85 }} />
      <div style={{ width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: alpha(catColor, 0.13), color: catColor }}>
        {icon}
      </div>
      <div style={{ minWidth: 0, width: '100%' }}>
        <Mono style={{ fontSize: 9, letterSpacing: '0.16em', color: CMD.ink3, textTransform: 'uppercase' }}>{label}</Mono>
        <div style={{ fontSize: 13.5, color: CMD.ink, fontWeight: 600, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        {sub != null && <div style={{ fontSize: 11, color: CMD.ink2, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
      </div>
    </div>
  );
}

export default function EquipBench({ agent, accent, setShowForge, isLive }) {
  const agentId = agent?.id;
  const benchLocked = Boolean(agent?.activeBattleId);

  // Which picker is open: null | 'archetype' | 'watchlist' | 'traits'
  // ('rules' / RuleBundlePicker is retained but dormant — see below.)
  const [sheet, setSheet] = useState(null);

  // ── Forge hook — full object: feeds the dormant RuleBundlePicker AND useTraits
  // (passed into TraitsSheet) so both share one Firestore load. ─────────────
  const forge = useForge(agentId);
  const { forgedBundles, equippedBundles, equipBundleFn, unequipBundleFn, equippingBundleId, loading: forgeLoading } = forge;

  // ── Traits slot display — from the real-time agent doc (equippedTraits). ──
  const equippedTraitsList = agent?.equippedTraits || [];
  const traitsEquipped = equippedTraitsList.length > 0;
  const traitNames = equippedTraitsList.map((t) => TRAIT_BY_ID[t.traitId]?.name).filter(Boolean);
  const traitsSummary = traitNames.slice(0, 2).join(' · ') + (traitNames.length > 2 ? ` +${traitNames.length - 2}` : '');

  // ── Watchlist via the existing watchlist services ────────────────────────
  const [committed, setCommitted] = useState([]);
  const [listLoaded, setListLoaded] = useState(false);
  const [wlWorking, setWlWorking] = useState(false);
  const equippedWatchlistId = agent?.equippedWatchlistId || null;

  useEffect(() => {
    let cancelled = false;
    listWatchlists()
      .then((list) => {
        if (cancelled) return;
        setCommitted(filterWatchlistsByStatus(list, 'committed'));
        setListLoaded(true);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[EquipBench] watchlist list load failed:', err);
        setListLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  const equippedWatchlist = useMemo(
    () => committed.find((w) => w.watchlistId === equippedWatchlistId) || null,
    [committed, equippedWatchlistId]
  );
  const watchlistName = equippedWatchlist?.name || agent?.equippedWatchlistName || null;
  const watchlistUnavailable = Boolean(equippedWatchlistId) && listLoaded && !equippedWatchlist;

  // ── Identity ─────────────────────────────────────────────────────────────
  const agentName = agent?.name || 'Your agent';
  const archetypeName = getArchetypeDisplayName(agent?.archetype);
  const disposition = getArchetypeIdentity(agent?.archetype).disposition;
  // Count slots from the agent doc — byte-for-byte the mobile CommandDashboard
  // equippedCount formula (the third slot now counts equipped traits, not bundles),
  // so the "n/3 slots" reads identically on desktop and mobile.
  const equippedCount = 1
    + (agent?.equippedWatchlistId ? 1 : 0)
    + ((agent?.equippedTraits?.length || 0) > 0 ? 1 : 0);

  // ── Equip handlers ───────────────────────────────────────────────────────
  const handleEquipWatchlist = async (watchlistId) => {
    if (!agentId || wlWorking) return;
    setWlWorking(true);
    try {
      if (watchlistId) await equipWatchlist(agentId, watchlistId);
      else await unequipWatchlist(agentId);
    } catch (err) {
      console.error('[EquipBench] watchlist equip/unequip failed:', err);
    } finally {
      setWlWorking(false);
      setSheet(null);
    }
  };
  const handleEquipBundle = async (bundleId) => { await equipBundleFn(bundleId); setSheet(null); };
  const handleUnequipBundle = async (bundleId) => { await unequipBundleFn(bundleId); setSheet(null); };
  const openForge = () => { setSheet(null); setShowForge?.(true); };

  const watchlistRows = [
    { id: '__none__', title: 'No watchlist', subtitle: 'Let the agent range the full board', selected: !equippedWatchlistId, disabled: wlWorking, onClick: () => handleEquipWatchlist(null) },
    ...committed.map((w) => ({
      id: w.watchlistId,
      title: w.name || 'Untitled watchlist',
      subtitle: `${(w.tickers || []).length} tickers`,
      selected: w.watchlistId === equippedWatchlistId,
      disabled: wlWorking,
      onClick: () => handleEquipWatchlist(w.watchlistId),
    })),
  ];

  return (
    <div>
      <SectionLabel
        n="02"
        label={isLive ? 'Equip · locked in battle' : 'Equip · loadout bench'}
        color={isLive ? CMD.ink3 : accent}
        right={<Mono style={{ fontSize: 10.5, color: CMD.ink3 }}>{equippedCount}/3 slots</Mono>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 9 }}>
        {/* Archetype — tap opens the six-card picker (battle-locked like the other slots) */}
        <RowSlot
          filled
          icon={<Sparkles size={17} color={accent} />}
          catColor={accent}
          label="Archetype"
          name={archetypeName}
          sub={disposition}
          locked={benchLocked}
          onClick={() => setSheet('archetype')}
        />
        {/* Watchlist */}
        <RowSlot
          filled={Boolean(equippedWatchlistId)}
          icon={<Target size={17} color={CMD.teal} />}
          catColor={CMD.teal}
          label="Watchlist"
          name={equippedWatchlistId
            ? `${watchlistName || 'Watchlist'}${watchlistUnavailable ? ' (unavailable)' : ''}`
            : 'Add watchlist'}
          sub={equippedWatchlistId && equippedWatchlist ? tickerLabel(equippedWatchlist.tickers) : 'Optional · priority opportunities'}
          locked={benchLocked}
          onClick={() => setSheet('watchlist')}
        />
        {/* Traits — equip-only DNA surface (replaces the old rule-bundle slot) */}
        <RowSlot
          filled={traitsEquipped}
          icon={<Dna size={17} color={CMD.gold} />}
          catColor={CMD.gold}
          label="Traits"
          name={traitsEquipped ? `${equippedTraitsList.length} trait${equippedTraitsList.length === 1 ? '' : 's'}` : 'Add traits'}
          sub={traitsEquipped ? traitsSummary : 'Optional · shapes your agent'}
          locked={benchLocked}
          onClick={() => setSheet('traits')}
        />
      </div>

      {/* reassurance — never a requirement */}
      {!traitsEquipped && !benchLocked && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10 }}>
          <Sparkles size={12} color={accent} />
          <div style={{ fontSize: 11.5, color: CMD.ink3 }}>One open slot — a chance to arm {agentName}, not a requirement. Deploy works now.</div>
        </div>
      )}
      {benchLocked && (
        <div style={{ fontSize: 11.5, color: CMD.ink3, marginTop: 10 }}>Locked in battle · changes apply to your next deploy.</div>
      )}

      {/* watchlist picker — center-docked on desktop */}
      <EquipSheet
        open={sheet === 'watchlist'}
        onClose={() => setSheet(null)}
        dock="center"
        title="Equip watchlist"
        subtitle="Point your agent at a committed watchlist, or let it range the full board."
        loading={!listLoaded}
        rows={watchlistRows}
        emptyLabel="No committed watchlists yet. Create one in Forge to focus your agent."
        footer={(
          <button type="button" onClick={openForge} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '12px 14px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
            background: 'transparent', border: `1px solid ${alpha(CMD.teal, 0.4)}`, color: CMD.teal, fontSize: 14, fontWeight: 700,
          }}>
            <Plus size={16} /> Create a watchlist in Forge
          </button>
        )}
        accent={CMD.teal}
      />

      {/* rules picker — center-docked on desktop */}
      <RuleBundlePicker
        open={sheet === 'rules'}
        onClose={() => setSheet(null)}
        dock="center"
        forgedBundles={forgedBundles}
        equippedBundles={equippedBundles}
        onEquip={handleEquipBundle}
        onUnequip={handleUnequipBundle}
        onBuildNew={openForge}
        working={Boolean(equippingBundleId)}
        loading={forgeLoading}
        accent={CMD.allocation}
      />

      {/* archetype picker — center-docked on desktop */}
      <ArchetypePicker
        open={sheet === 'archetype'}
        onClose={() => setSheet(null)}
        agent={agent}
        accent={accent}
        dock="center"
      />

      {/* traits picker — equip-only DNA surface, center-docked on desktop */}
      <TraitsSheet
        open={sheet === 'traits'}
        onClose={() => setSheet(null)}
        agent={agent}
        accent={accent}
        forge={forge}
        dock="center"
      />
    </div>
  );
}
