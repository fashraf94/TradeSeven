// src/components/Tournament/Flat6BattleView.jsx
//
// P7 — THE tournament battle view (Proposal A): a flat6-NATIVE battle screen,
// its OWN component (founder ruling), so the live tiered BaggerBomb screen
// (AgentBattleScreen) stays 100% untouched. Replaces P6b's honest degrade in
// SpectatorView; mounts in LeagueScreen (participant) + the dev screen.
//
// flat6 facts (P4 doc shape): six holdings in the 2/2/2 star/core/support SLOT
// LABELS (rendered as LINEUP slots, never tiers), each tierMultiplier:1,
// opponent:null (NO opponent column — this is the agent's own battle), agents
// long-only, result:null at completion ("day banked", no W/L). The composite is
// the score of record (P6a) and lives in the standings — this screen shows the
// AGENT battle and links out to the composite, honestly.
//
// Two modes:
//   participant (isOwner) — your agent. WHY is live (innerMonologue + recent
//     evaluation rationale); you-highlight teal.
//   spectator (!isOwner)  — any agent, read-only. WHAT is live (positions,
//     per-asset, statusFeed narration, score); WHY is concealed SERVER-SIDE
//     (the battle arrives already projected — `_whyConcealed`) and unlocks for
//     everyone at completion (the Film Room). V2.1 §9 transparency.
//
// Scoring is the canonical scorer, CALLED via src/utils/flat6BattleEnrichment.js
// (BUILD_RULES §4 — never copied). Motion is the Snake Draft's vocabulary in
// tokens (animated score via DataStrike, reactive borders, the live feed),
// ALL gated on useReducedMotion. Prices are fetched client-side (public market
// data) so the per-asset rows stay lively in both modes.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Bot, Activity, Lock, TrendingUp, ArrowUpRight, Flame } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useWebSocketPrices } from '../../hooks/useWebSocketPrices';
import { stockAPI } from '../../services/eodhdAPI';
import DataStrike from '../shared/DataStrike';
import {
  buildFlat6BattleModel,
  resolveDisplayScore,
  flat6BattleSymbols,
  isFlat6ActivationDay,
} from '../../utils/flat6BattleEnrichment';
import { BAGGER_TIERS } from '../../constants/baggerBombScoring';

const PRICE_POLL_INTERVAL = 60000;
const FEED_LIMIT = 8;
const MAX_BADGE_MULTIPLIER = BAGGER_TIERS[BAGGER_TIERS.length - 1].multiplier; // 2.0 (TenBagger)

const fmtPrice = (n) => (Number.isFinite(n) && n > 0 ? `$${n.toFixed(2)}` : '—');
const fmtPct = (n) => `${n >= 0 ? '+' : ''}${(n || 0).toFixed(2)}%`;
const fmtPts = (n) => `${n >= 0 ? '+' : ''}${Math.round(n || 0)}`;

// ── per-asset row ─────────────────────────────────────────────────────────────
function HoldingRow({ asset, tokens, reduceMotion }) {
  const up = asset.priceChange >= 0;
  const accent = up ? tokens.emerald : tokens.red;
  // Threshold progress: how far toward the strongest badge (signed) — the
  // "approaching threshold" anticipation beat from the Snake Draft view.
  const progress = Math.min(1, Math.abs(asset.multiplier || 0) / MAX_BADGE_MULTIPLIER);
  const hasBadge = (asset.badges || []).length > 0;

  // Agents are long-only (V1) — no direction badge here; the user-layer SHORT
  // badge is the claim/flip surface's concern (Proposal B), not the agent view.
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 6,
      padding: '10px 12px', borderRadius: 10,
      background: tokens.bgElevated,
      border: `1px solid ${hasBadge ? accent : tokens.borderDivider}`,
      transition: reduceMotion ? 'none' : 'border-color 0.3s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontWeight: 800, fontSize: 14 }}>{asset.symbol}</span>
        <span style={{ fontSize: 11, color: tokens.textMuted }}>{fmtPrice(asset.currentPrice)}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: accent, fontVariantNumeric: 'tabular-nums' }}>
          {fmtPct(asset.priceChange)}
        </span>
        <span style={{ fontSize: 13, fontWeight: 800, color: accent, fontVariantNumeric: 'tabular-nums', minWidth: 42, textAlign: 'right' }}>
          {fmtPts(asset.points)}
        </span>
      </div>

      {/* threshold progress bar */}
      <div style={{ height: 4, borderRadius: 4, background: tokens.borderDivider, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${progress * 100}%`, background: accent,
          transition: reduceMotion ? 'none' : 'width 0.4s ease-out',
        }} />
      </div>

      {hasBadge && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {asset.badges.map((b) => (
            <span key={b} style={{
              fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 5,
              background: up ? 'rgba(16,185,129,0.14)' : 'rgba(239,68,68,0.14)', color: accent,
              textTransform: 'uppercase', letterSpacing: '0.03em',
            }}>{b}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Flat6BattleView({
  battle,
  isOwner = false,
  compositeContext = null,
  onOpenStandings = null,
}) {
  const { tokens } = useTheme();
  const reduceMotion = useReducedMotion();

  // Key the symbol list on its CONTENT, not the battle object's identity — a
  // new snapshot (participant) or poll (spectator) produces a fresh battle
  // object every tick, and a fresh array each render would churn the WebSocket
  // subscribe/unsubscribe and the price-poll interval needlessly.
  const symbolsKey = useMemo(() => flat6BattleSymbols(battle).join(','), [battle]);
  const symbols = useMemo(() => (symbolsKey ? symbolsKey.split(',') : []), [symbolsKey]);

  // ── live prices (public market data; both modes) ──
  const { prices: wsPrices } = useWebSocketPrices(symbols, { enabled: symbols.length > 0 });
  const [currentPrices, setCurrentPrices] = useState({});
  const [previousClosePrices, setPreviousClosePrices] = useState({});

  const fetchPrices = useCallback(async () => {
    if (symbols.length === 0) return;
    try {
      const data = await stockAPI.getMultipleStockPrices(symbols);
      const prices = {};
      const prevCloses = {};
      Object.entries(data || {}).forEach(([sym, d]) => {
        if (d?.price) prices[sym] = d.price;
        if (d?.previousClose) prevCloses[sym] = d.previousClose;
      });
      if (Object.keys(prices).length) setCurrentPrices((p) => ({ ...p, ...prices }));
      if (Object.keys(prevCloses).length) setPreviousClosePrices((p) => ({ ...p, ...prevCloses }));
    } catch (err) {
      console.warn('[Flat6BattleView] price fetch failed:', err?.message || err);
    }
  }, [symbols]);

  useEffect(() => {
    if (symbols.length === 0) return undefined;
    fetchPrices();
    const interval = setInterval(fetchPrices, PRICE_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchPrices, symbols.length]);

  // Match the live screen (AgentBattleScreen:451-454): when there's no WS data,
  // return currentPrices unchanged so effectivePrices keeps a stable identity
  // and the scorer doesn't recompute on empty WS flushes.
  const effectivePrices = useMemo(() => {
    if (!wsPrices || Object.keys(wsPrices).length === 0) return currentPrices;
    return { ...currentPrices, ...wsPrices };
  }, [currentPrices, wsPrices]);
  const pricesLoaded = Object.keys(effectivePrices).length > 0;

  // Computed per render (cheap) so it's a stable boolean dep — the model
  // recomputes when the ET day actually flips, not on a stale captured `now`.
  const activationDay = isFlat6ActivationDay(battle, Date.now());
  const model = useMemo(
    () => buildFlat6BattleModel(battle, { effectivePrices, previousClosePrices, isActivationDay: activationDay }),
    [battle, effectivePrices, previousClosePrices, activationDay],
  );

  if (!battle || !model) {
    return (
      <div style={{ padding: 16, fontSize: 13, color: tokens.textMuted, textAlign: 'center' }}>
        No active battle for this seat yet.
      </div>
    );
  }

  const ctx = battle.agentContext || {};
  const agentName = ctx.agentName || (battle.isCpu ? 'CPU agent' : 'Agent');
  const archetype = ctx.archetype && ctx.archetype !== 'unknown' ? ctx.archetype : null;
  const isComplete = model.isComplete;
  const displayScore = resolveDisplayScore({
    pricesLoaded,
    isComplete,
    liveAgentScore: model.liveAgentScore,
    persistedScore: model.persistedScore,
  });
  const scorePositive = displayScore >= 0;
  const scoreColor = scorePositive ? tokens.emerald : tokens.red;

  const doubleDowns = ctx.tournament?.doubleDownSymbols || [];
  const feed = (battle.statusFeed || []).slice(-FEED_LIMIT).reverse();

  // WHY visibility: concealed server-side for non-owner active reads
  // (_whyConcealed). Otherwise the reasoning is present (owner live, or anyone
  // at completion = the Film Room unlock).
  const whyConcealed = battle._whyConcealed === true;
  const monologue = ctx.innerMonologue || null;
  const recentWhy = (battle.evaluations || [])
    .filter((e) => e && (e.rationale || e.hypothesis))
    .slice(-3)
    .reverse();

  const card = {
    background: tokens.bgCard, border: `1px solid ${tokens.borderDivider}`,
    borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
  };
  const sectionTitle = { fontSize: 11, fontWeight: 700, color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' };

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0.2 : 0.35 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      {/* ── Header: agent + running agent-layer score (no opponent column) ── */}
      <div style={{ ...card, borderColor: isOwner ? tokens.teal : tokens.borderDivider, boxShadow: isOwner && !reduceMotion ? tokens.glowTealNav : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bot size={16} color={isOwner ? '#14b8a6' : tokens.purpleText} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 800, fontSize: 15, color: isOwner ? '#14b8a6' : tokens.textPrimary }}>
              {agentName}{isOwner && <span style={{ fontSize: 10, fontWeight: 700, color: '#14b8a6' }}> · YOU</span>}
            </span>
            <span style={{ fontSize: 10, color: tokens.textMuted }}>
              {archetype ? `${archetype} · ` : ''}agent layer{battle.isCpu ? ' · CPU' : ''}
            </span>
          </div>
          <span style={{
            marginLeft: 'auto', fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 6,
            textTransform: 'uppercase', letterSpacing: '0.05em',
            color: isComplete ? tokens.textMuted : tokens.emerald,
            background: isComplete ? tokens.bgElevated : 'rgba(16,185,129,0.14)',
          }}>{isComplete ? 'Final' : 'Live'}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <DataStrike value={displayScore} size={40} color={scoreColor} showSign fontWeight={800} />
          <span style={{ fontSize: 12, color: tokens.textMuted }}>agent-layer pts</span>
        </div>

        {/* Composite CONTEXT — honest framing: the big number above is TODAY's
            agent battle; the composite (agent + 1.5× user, the week's score of
            record) lives in the standings. Weekly composite/user shown here,
            not conflated with today's agent score. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: tokens.textMuted, flexWrap: 'wrap' }}>
          {compositeContext
            ? (
              <>
                <span>
                  Week composite (the score of record):{' '}
                  <b style={{ color: compositeContext.composite < 0 ? tokens.red : tokens.textPrimary }}>
                    {compositeContext.composite >= 0 ? '+' : ''}{compositeContext.composite}
                  </b>
                  {Number.isFinite(compositeContext.userPoints) && (
                    <span> · your user layer {compositeContext.userPoints} × 1.5 + agent</span>
                  )}
                </span>
                {onOpenStandings && (
                  <button onClick={onOpenStandings} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', color: tokens.teal, cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: 0 }}>
                    Standings <ArrowUpRight size={12} />
                  </button>
                )}
              </>
            )
            : <span>This is the agent battle — the composite (agent + 1.5× user) is the week's score of record, in the standings.</span>}
        </div>

        {isComplete && (
          <div style={{ fontSize: 11, color: tokens.textMuted, borderTop: `1px solid ${tokens.borderDivider}`, paddingTop: 8 }}>
            Day banked at {fmtPts(displayScore)} pts for the tournament composite. No win/loss — the composite carries the result.
          </div>
        )}

        {doubleDowns.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: tokens.purpleText, background: 'rgba(168,85,247,0.12)', padding: '6px 8px', borderRadius: 8 }}>
            <Flame size={13} color="#a855f7" />
            <span><b>Double-down</b> on {doubleDowns.join(', ')} — conviction earns 2× exposure across the layers.</span>
          </div>
        )}
      </div>

      {/* ── Six holdings, 2/2/2 lineup slots ── */}
      <div style={card}>
        <div style={sectionTitle}>The six · {model.holdingsCount} holdings</div>
        {model.slots.map((slot) => (
          <div key={slot.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: tokens.textFaint, letterSpacing: '0.03em' }}>{slot.label}</div>
            {slot.assets.length === 0
              ? <span style={{ fontSize: 11, color: tokens.textFaint }}>—</span>
              : slot.assets.map((a) => (
                <HoldingRow key={a.symbol} asset={a} tokens={tokens} reduceMotion={reduceMotion} />
              ))}
          </div>
        ))}
      </div>

      {/* ── Live narration feed (WHAT — public to all) ── */}
      <div style={card}>
        <div style={{ ...sectionTitle, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Activity size={12} /> Live feed
        </div>
        {feed.length === 0
          ? <span style={{ fontSize: 11, color: tokens.textFaint }}>No moves yet today.</span>
          : feed.map((e, i) => (
            <div key={e.evalId || e.timestamp || i} style={{ display: 'flex', gap: 8, fontSize: 11, color: tokens.textSecondary, borderLeft: `2px solid ${tokens.borderDivider}`, paddingLeft: 8 }}>
              <span style={{ flex: 1 }}>{e.message || e.action || '—'}</span>
            </div>
          ))}
      </div>

      {/* ── WHY (owner live / everyone at completion; concealed otherwise) ── */}
      <div style={card}>
        <div style={{ ...sectionTitle, display: 'flex', alignItems: 'center', gap: 6 }}>
          <TrendingUp size={12} /> The agent's read
        </div>
        {whyConcealed
          ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: tokens.textMuted }}>
              <Lock size={13} color={tokens.textFaint} />
              <span>The agent's live reasoning is owner-only. It opens to everyone at completion — the Film Room. Open cards then.</span>
            </div>
          )
          : (
            <>
              {monologue?.strategy && (
                <p style={{ fontSize: 12, lineHeight: 1.5, color: tokens.textSecondary, margin: 0 }}>{monologue.strategy}</p>
              )}
              {recentWhy.length > 0 && recentWhy.map((e, i) => (
                <div key={e.evalId || i} style={{ fontSize: 11, color: tokens.textMuted, borderTop: `1px solid ${tokens.borderDivider}`, paddingTop: 6 }}>
                  {e.rationale && <div>{e.rationale}</div>}
                  {e.hypothesis && <div style={{ fontStyle: 'italic', color: tokens.textFaint }}>{e.hypothesis}</div>}
                </div>
              ))}
              {!monologue?.strategy && recentWhy.length === 0 && (
                <span style={{ fontSize: 11, color: tokens.textFaint }}>No reasoning recorded yet.</span>
              )}
            </>
          )}
      </div>
    </motion.div>
  );
}
