// src/components/Dashboard/EquipStation.jsx
//
// "02 · Equip" loadout bench — the prototype's two-column character-sheet
// layout: a tall identity panel (orb + agent name + record) on the left, three
// compact equipment slot rows on the right (Archetype, Watchlist, the open
// dashed Rules slot). Cold-start = archetype + watchlist filled, one open rules
// slot framed as a positive optional CTA. Tapping the identity panel opens the
// agent's full profile; the archetype slot opens the six-card archetype picker.
//
// VISUAL PASS: layout + styling only. Equip logic, data, the watchlist/rule
// services, the lock (agent.activeBattleId), and the pickers are unchanged.

import React, { useState, useEffect, useMemo } from 'react';
import { Sparkles, Target, Dna, Plus, ChevronRight, Lock } from 'lucide-react';
import AgentOrb from '../shared/AgentOrb';
import EquipSheet from './EquipSheet';
import RuleBundlePicker from './RuleBundlePicker';
import ArchetypePicker from './ArchetypePicker';
import TraitsSheet from './TraitsSheet';
import { CMD, alpha, Mono } from './commandUI';
import { useForge } from '../../hooks/useForge';
import { listWatchlists } from '../../services/forgeWatchlistService';
import { filterWatchlistsByStatus } from '../Forge/Watchlist/filterWatchlistsByStatus';
import { equipWatchlist, unequipWatchlist } from '../../services/agentService';
import { getArchetypeDisplayName } from '../../data/archetypeDisplay';
import { getArchetypeIdentity } from '../../data/archetypeIdentity';
import { TRAIT_BY_ID } from '../../data/traitLibrary';

function tickerLabel(tickers) {
  const syms = (tickers || [])
    .map((t) => (typeof t === 'string' ? t : t?.symbol || t?.ticker))
    .filter(Boolean);
  if (syms.length === 0) return `${(tickers || []).length} tickers`;
  return syms.slice(0, 4).join(' · ') + (syms.length > 4 ? ` +${syms.length - 4}` : '');
}

// ─── A single equipment slot row ─────────────────────────────────────────────

function Slot({ filled, icon, catColor, label, name, sub, locked, onClick }) {
  const interactive = Boolean(onClick) && !locked;

  if (!filled) {
    // empty = an upgrade invitation, never an error
    return (
      <div
        onClick={interactive ? onClick : undefined}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 14,
          border: `1.4px dashed ${CMD.hair2}`, background: alpha('#FFFFFF', 0.012),
          opacity: locked ? 0.4 : 1, cursor: interactive ? 'pointer' : 'default',
          transition: 'border-color .15s ease, background .15s ease',
        }}
      >
        <div style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `1px dashed ${CMD.hair2}`, color: CMD.ink3,
        }}>
          <Plus size={16} color={CMD.ink2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, color: CMD.ink2, fontWeight: 500 }}>{name}</div>
          <Mono style={{ fontSize: 9.5, letterSpacing: '0.14em', color: CMD.ink3, textTransform: 'uppercase', display: 'block', marginTop: 3 }}>{sub}</Mono>
        </div>
        {interactive && <ChevronRight size={15} color={CMD.ink3} style={{ flexShrink: 0 }} />}
      </div>
    );
  }

  return (
    <div
      onClick={interactive ? onClick : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 14,
        border: `1px solid ${CMD.hair}`, background: CMD.surface, position: 'relative', overflow: 'hidden',
        cursor: interactive ? 'pointer' : 'default',
        transition: 'border-color .15s ease',
      }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: catColor, opacity: 0.85 }} />
      <div style={{
        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: alpha(catColor, 0.13), color: catColor,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Mono style={{ fontSize: 9, letterSpacing: '0.16em', color: CMD.ink3, textTransform: 'uppercase' }}>{label}</Mono>
        <div style={{ fontSize: 13.5, color: CMD.ink, fontWeight: 600, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        {sub != null && (
          <div style={{ fontSize: 11, color: CMD.ink2, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
        )}
      </div>
      {(locked ? false : interactive) && <ChevronRight size={15} color={CMD.ink3} style={{ flexShrink: 0 }} />}
      {locked && <Lock size={14} color={CMD.ink3} style={{ flexShrink: 0 }} />}
    </div>
  );
}

// ─── Equip station ───────────────────────────────────────────────────────────

export default function EquipStation({ agent, accent, onOpenAgent, setShowForge }) {
  const agentId = agent?.id;
  const benchLocked = Boolean(agent?.activeBattleId);

  // Which picker is open: null | 'archetype' | 'watchlist' | 'traits'
  // ('rules' / RuleBundlePicker is retained but dormant — see below.)
  const [sheet, setSheet] = useState(null);
  // Bumped each time the Traits sheet opens so it remounts and reloads current
  // traits + rules fresh. LOAD-BEARING: half of TraitsSheet's orphan-cleanup safety
  // invariant (per-open remount) — don't drop the bump or the key. See TraitsSheet.
  const [traitsEpoch, setTraitsEpoch] = useState(0);

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
        console.error('[EquipStation] watchlist list load failed:', err);
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
  const wins = agent?.stats?.wins ?? 0;
  const losses = agent?.stats?.losses ?? 0;
  const tier = (wins || losses) ? `${wins}W · ${losses}L` : 'New agent';

  // ── Equip handlers ───────────────────────────────────────────────────────
  const handleEquipWatchlist = async (watchlistId) => {
    if (!agentId || wlWorking) return;
    setWlWorking(true);
    try {
      if (watchlistId) await equipWatchlist(agentId, watchlistId);
      else await unequipWatchlist(agentId);
    } catch (err) {
      console.error('[EquipStation] watchlist equip/unequip failed:', err);
    } finally {
      setWlWorking(false);
      setSheet(null);
    }
  };
  const handleEquipBundle = async (bundleId) => { await equipBundleFn(bundleId); setSheet(null); };
  const handleUnequipBundle = async (bundleId) => { await unequipBundleFn(bundleId); setSheet(null); };
  const openForge = () => { setSheet(null); setShowForge?.(true); };

  // ── Watchlist sheet rows ─────────────────────────────────────────────────
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
    <>
      {/* two-column bench: identity panel + stacked slot rows */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}>
        {/* identity panel — tap → agent profile */}
        <div
          onClick={onOpenAgent}
          role={onOpenAgent ? 'button' : undefined}
          aria-label={onOpenAgent ? 'Open agent profile' : undefined}
          style={{
            width: 92, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 9, padding: '14px 6px', borderRadius: 16, background: CMD.surface, border: `1px solid ${CMD.hair}`,
            cursor: onOpenAgent ? 'pointer' : 'default',
          }}
        >
          <AgentOrb state={benchLocked ? 'live' : 'ready'} size={56} color={accent} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: CMD.ink, fontWeight: 700, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 80 }}>{agentName}</div>
            <Mono style={{ fontSize: 8.5, letterSpacing: '0.12em', color: CMD.ink3, textTransform: 'uppercase', display: 'block', marginTop: 2 }}>{tier}</Mono>
          </div>
        </div>

        {/* equipment rows */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Archetype — tap opens the six-card picker (battle-locked like the other slots) */}
          <Slot
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
          <Slot
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
          <Slot
            filled={traitsEquipped}
            icon={<Dna size={17} color={CMD.gold} />}
            catColor={CMD.gold}
            label="Traits"
            name={traitsEquipped ? `${equippedTraitsList.length} trait${equippedTraitsList.length === 1 ? '' : 's'}` : 'Add traits'}
            sub={traitsEquipped ? traitsSummary : 'Optional · shapes your agent'}
            locked={benchLocked}
            onClick={() => { setTraitsEpoch((e) => e + 1); setSheet('traits'); }}
          />
        </div>
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

      {/* watchlist picker */}
      <EquipSheet
        open={sheet === 'watchlist'}
        onClose={() => setSheet(null)}
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

      {/* rules picker */}
      <RuleBundlePicker
        open={sheet === 'rules'}
        onClose={() => setSheet(null)}
        forgedBundles={forgedBundles}
        equippedBundles={equippedBundles}
        onEquip={handleEquipBundle}
        onUnequip={handleUnequipBundle}
        onBuildNew={openForge}
        working={Boolean(equippingBundleId)}
        loading={forgeLoading}
        accent={CMD.allocation}
      />

      {/* archetype picker */}
      <ArchetypePicker
        open={sheet === 'archetype'}
        onClose={() => setSheet(null)}
        agent={agent}
        accent={accent}
      />

      {/* traits picker — equip-only DNA surface. Keyed on traitsEpoch + gated on
          (epoch > 0) so it (re)mounts on each open, reloading current traits/rules
          fresh; the closed instance stays mounted between opens so the exit
          animation still plays. */}
      {traitsEpoch > 0 && (
        <TraitsSheet
          key={traitsEpoch}
          open={sheet === 'traits'}
          onClose={() => setSheet(null)}
          agent={agent}
          accent={accent}
        />
      )}
    </>
  );
}
