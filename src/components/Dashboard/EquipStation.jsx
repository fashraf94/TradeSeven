// src/components/Dashboard/EquipStation.jsx
//
// The "02 · Equip" loadout bench for the Command Dashboard: the agent's identity
// (archetype) plus the two equip slots (watchlist, rules). Cold-start is
// archetype + watchlist filled with one open rules slot — framed as a positive,
// optional CTA, never a validation error. Deploy works regardless.
//
// Reuse, not rebuild:
//   - watchlist: listWatchlists + filterWatchlistsByStatus('committed') +
//     equipWatchlist/unequipWatchlist (agentService) — the same path
//     EquippedWatchlistCard uses, presented here as a compact bench row.
//   - rules: useForge's forgedBundles / equippedBundles + equipBundleFn /
//     unequipBundleFn (which call forgeService.equipBundle/unequipBundle).
//   - lock: agent.activeBattleId (the established equip-lock signal).

import React, { useState, useEffect, useMemo } from 'react';
import { Fingerprint, Bookmark, ScrollText, Plus, ChevronRight, Lock } from 'lucide-react';
import HoloCard from '../shared/HoloCard';
import EquipSheet from './EquipSheet';
import RuleBundlePicker from './RuleBundlePicker';
import { useForge } from '../../hooks/useForge';
import { listWatchlists } from '../../services/forgeWatchlistService';
import { filterWatchlistsByStatus } from '../Forge/Watchlist/filterWatchlistsByStatus';
import { equipWatchlist, unequipWatchlist } from '../../services/agentService';
import { getArchetypeDisplayName } from '../../data/archetypeDisplay';
import { getArchetypeIdentity } from '../../data/archetypeIdentity';

function hexToRgba(hex, a) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return `rgba(94,234,212,${a})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function tickerLabel(tickers) {
  const syms = (tickers || [])
    .map((t) => (typeof t === 'string' ? t : t?.symbol || t?.ticker))
    .filter(Boolean);
  if (syms.length === 0) return `${(tickers || []).length} tickers`;
  return syms.slice(0, 4).join(' · ') + (syms.length > 4 ? ` +${syms.length - 4}` : '');
}

// ─── Slot card ───────────────────────────────────────────────────────────────

function SlotCard({ icon, slotAccent, eyebrow, title, subtitle, onClick, locked, dashed, tokens }) {
  const interactive = Boolean(onClick) && !locked;
  return (
    <HoloCard
      as={interactive ? 'button' : 'div'}
      onClick={interactive ? onClick : undefined}
      size="lg"
      style={{
        width: '100%', textAlign: 'left', fontFamily: 'inherit',
        background: tokens.bgCard,
        border: dashed
          ? `1px dashed ${hexToRgba(slotAccent, 0.5)}`
          : `1px solid ${tokens.borderDefault}`,
        borderLeft: `3px solid ${slotAccent}`,
        boxShadow: tokens.obsidianShadow,
        cursor: interactive ? 'pointer' : 'default',
        opacity: locked ? 0.75 : 1,
        display: 'flex', alignItems: 'center', gap: 12,
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: hexToRgba(slotAccent, 0.12), border: `1px solid ${hexToRgba(slotAccent, 0.28)}`,
        color: slotAccent,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {eyebrow && (
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: tokens.textFaint, marginBottom: 3 }}>
            {eyebrow}
          </div>
        )}
        <div style={{ fontSize: 14, fontWeight: 700, color: tokens.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 12, color: tokens.textMuted, marginTop: 2, lineHeight: 1.4 }}>{subtitle}</div>
        )}
      </div>
      {locked ? (
        <Lock size={15} color={tokens.textFaint} style={{ flexShrink: 0 }} />
      ) : interactive ? (
        <ChevronRight size={18} color={tokens.textFaint} style={{ flexShrink: 0 }} />
      ) : null}
    </HoloCard>
  );
}

// ─── Equip station ───────────────────────────────────────────────────────────

export default function EquipStation({ agent, accent, tokens, setShowForge, onOpenAgent }) {
  const agentId = agent?.id;
  const benchLocked = Boolean(agent?.activeBattleId);

  // Which picker is open: null | 'watchlist' | 'rules'
  const [sheet, setSheet] = useState(null);

  // ── Rules (bundles) via the existing Forge hook ──────────────────────────
  const { forgedBundles, equippedBundles, equipBundleFn, unequipBundleFn, equippingBundleId, loading: forgeLoading } = useForge(agentId);
  // Single canonical source (useForge's equippedBundles) for the rules slot so
  // the filled/open state and the count can't disagree mid-equip.
  const rulesEquipped = equippedBundles.length > 0;

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

  // ── Identity (archetype) ─────────────────────────────────────────────────
  const archetypeName = getArchetypeDisplayName(agent?.archetype);
  const disposition = getArchetypeIdentity(agent?.archetype).disposition;

  // ── Slot fill count ──────────────────────────────────────────────────────
  const filled = 1 + (equippedWatchlistId ? 1 : 0) + (rulesEquipped ? 1 : 0);

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

  const handleEquipBundle = async (bundleId) => {
    await equipBundleFn(bundleId);
    setSheet(null);
  };
  const handleUnequipBundle = async (bundleId) => {
    await unequipBundleFn(bundleId);
    setSheet(null);
  };
  const openForge = () => { setSheet(null); setShowForge?.(true); };

  // ── Watchlist sheet rows ─────────────────────────────────────────────────
  const watchlistRows = [
    { id: '__none__', title: 'No watchlist', subtitle: 'Let the agent pick from the full board', selected: !equippedWatchlistId, disabled: wlWorking, onClick: () => handleEquipWatchlist(null) },
    ...committed.map((w) => ({
      id: w.watchlistId,
      title: w.name || 'Untitled watchlist',
      subtitle: `${(w.tickers || []).length} tickers`,
      selected: w.watchlistId === equippedWatchlistId,
      disabled: wlWorking,
      onClick: () => handleEquipWatchlist(w.watchlistId),
    })),
  ];
  const watchlistFooter = (
    <button
      type="button"
      onClick={openForge}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '12px 14px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
        background: 'transparent', border: `1px solid ${hexToRgba(tokens.teal, 0.4)}`,
        color: tokens.teal, fontSize: 14, fontWeight: 700,
      }}
    >
      <Plus size={16} />
      Create a watchlist in Forge
    </button>
  );

  return (
    <div>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '0 2px' }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: accent }}>
          02 · Equip
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700, color: tokens.textMuted,
          background: tokens.bgIcon, border: `1px solid ${tokens.borderDefault}`,
          padding: '2px 8px', borderRadius: 20,
        }}>
          {filled}/3 slots
        </span>
        {benchLocked && (
          <span style={{ fontSize: 11, color: tokens.textFaint, marginLeft: 'auto' }}>
            Locked — battle live
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Identity — archetype (filled, non-swappable); tap to open the agent's profile */}
        <SlotCard
          icon={<Fingerprint size={18} />}
          slotAccent={accent}
          eyebrow="Identity"
          title={archetypeName}
          subtitle={disposition}
          onClick={onOpenAgent}
          tokens={tokens}
        />

        {/* Watchlist */}
        <SlotCard
          icon={<Bookmark size={18} />}
          slotAccent={tokens.teal}
          eyebrow="Watchlist"
          title={watchlistName ? `${watchlistName}${watchlistUnavailable ? ' (unavailable)' : ''}` : 'Choose a watchlist'}
          subtitle={
            equippedWatchlistId && equippedWatchlist
              ? tickerLabel(equippedWatchlist.tickers)
              : 'Give your agent priority opportunities'
          }
          onClick={() => setSheet('watchlist')}
          locked={benchLocked}
          tokens={tokens}
        />

        {/* Rules */}
        {rulesEquipped ? (
          <SlotCard
            icon={<ScrollText size={18} />}
            slotAccent={tokens.emerald}
            eyebrow="Rules"
            title={
              equippedBundles.length === 1
                ? (equippedBundles[0].name || 'Strategy equipped')
                : `${equippedBundles.length} strategies equipped`
            }
            subtitle="Tap to change your agent's playbook"
            onClick={() => setSheet('rules')}
            locked={benchLocked}
            tokens={tokens}
          />
        ) : (
          <SlotCard
            icon={<Plus size={18} />}
            slotAccent={tokens.amber}
            eyebrow="Rules · optional"
            title="Add rules"
            subtitle="Optional — sharpens your agent"
            onClick={() => setSheet('rules')}
            locked={benchLocked}
            dashed
            tokens={tokens}
          />
        )}
      </div>

      {/* Reassurance — never a requirement */}
      {!rulesEquipped && !benchLocked && (
        <div style={{ fontSize: 11, color: tokens.textFaint, marginTop: 10, padding: '0 2px', lineHeight: 1.5 }}>
          One open slot — not a requirement. Deploy works now.
        </div>
      )}
      {benchLocked && (
        <div style={{ fontSize: 11, color: tokens.textFaint, marginTop: 10, padding: '0 2px', lineHeight: 1.5 }}>
          Changes apply to your next battle.
        </div>
      )}

      {/* Watchlist picker */}
      <EquipSheet
        open={sheet === 'watchlist'}
        onClose={() => setSheet(null)}
        title="Equip watchlist"
        subtitle="Point your agent at a committed watchlist, or let it range the full board."
        loading={!listLoaded}
        rows={watchlistRows}
        emptyLabel="No committed watchlists yet. Create one in Forge to focus your agent."
        footer={watchlistFooter}
        accent={tokens.teal}
        tokens={tokens}
      />

      {/* Rules picker */}
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
        accent={tokens.emerald}
        tokens={tokens}
      />
    </div>
  );
}
