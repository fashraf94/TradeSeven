// src/components/Tournament/RoundBoundaryView.jsx
//
// P7 (C) — the weekend round-boundary interstitial: your week's result →
// bracket reveal → the branch (advancer / eliminated / champion). Pure
// read-composition over the bracket doc (subscribeBracket) and the rank doc
// (subscribeRank); the advancer's fresh round-N+1 `forming` group is surfaced
// by subscribeMyGroup independently, so "continue" just dismisses this
// interstitial (client-only ack) and LeagueScreen's existing forming →
// BoardCommitFlow route takes over. No writer. Tokens-native,
// reduced-motion-aware.

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Trophy, ArrowUpCircle, Flag, Sparkles } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const ORDINAL = ['', '1st', '2nd', '3rd', '4th'];
const fmtScore = (n) => (Number.isFinite(n) ? `${n >= 0 ? '+' : ''}${Math.round(n)}` : '—');

export default function RoundBoundaryView({ bracket, uid, boundary, rankDoc, onContinue }) {
  const { tokens } = useTheme();
  const reduceMotion = useReducedMotion();
  if (!boundary) return null;

  const { kind, roundNumber, placement, composite, advancers } = boundary;
  const rankWeek = rankDoc?.appliedGroups?.[boundary.gameId] || null;

  const accent = kind === 'eliminated' ? tokens.textMuted : kind === 'champion' ? tokens.medalGold : tokens.emerald;
  const Icon = kind === 'champion' ? Trophy : kind === 'eliminated' ? Flag : ArrowUpCircle;
  const heading = kind === 'champion' ? 'Bracket champion' : kind === 'eliminated' ? 'Your run ended' : 'You advanced';

  const card = { background: tokens.bgCard, border: `1px solid ${accent}`, borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 };
  const line = { fontSize: 12, color: tokens.textMuted };
  const recap = kind === 'champion' ? bracket?.recap : null;

  const continueLabel = kind === 'advancer'
    ? `Set your round ${roundNumber + 1} board`
    : kind === 'champion' ? 'Back to the season' : 'Back to the season';

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: reduceMotion ? 0.2 : 0.4 }}
      style={card}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon size={22} color={accent} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: accent }}>{heading}</span>
          <span style={{ fontSize: 11, color: tokens.textFaint }}>Round {roundNumber}{placement ? ` · finished ${ORDINAL[placement] || `#${placement}`}` : ''}</span>
        </div>
      </div>

      {/* your week's result (composite is the score of record) */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 30, fontWeight: 800, color: composite < 0 ? tokens.red : tokens.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{fmtScore(composite)}</span>
        <span style={line}>week composite</span>
      </div>

      {/* bracket reveal — who advanced */}
      {advancers?.length > 0 && (
        <div style={line}>
          Advancing: <span style={{ fontWeight: 700, color: tokens.emerald }}>{advancers.map(id => (id === uid ? 'You' : id)).join(', ')}</span>
        </div>
      )}

      {/* branch body */}
      {kind === 'advancer' && (
        <div style={line}>Your round {roundNumber + 1} group is set with a fresh draft pool. Commit your board before Monday’s draft.</div>
      )}
      {kind === 'eliminated' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={line}>The run ended here — the season continues. Your career rank carries forward.</div>
          {rankDoc && (
            <div style={{ fontSize: 12 }}>
              <span style={{ fontWeight: 700, color: tokens.purpleText }}>{rankDoc.tier || rankDoc.tierName || 'Rank'}</span>
              <span style={{ color: tokens.textMuted }}> · {Math.round(rankDoc.rp ?? 0)} RP{rankWeek && Number.isFinite(rankWeek.delta) ? ` (this week ${rankWeek.delta >= 0 ? '+' : ''}${Math.round(rankWeek.delta)})` : ''}</span>
            </div>
          )}
        </div>
      )}
      {kind === 'champion' && recap && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: tokens.medalGold }}>
            <Sparkles size={13} /> Final composite {fmtScore(recap.finalComposite)}
          </div>
          {recap.bestWeek && <div style={line}>Best week: round {recap.bestWeek.roundNumber} at {fmtScore(recap.bestWeek.weeklyScore)}.</div>}
          {recap.signatureDoubleDown && (
            <div style={line}>Signature double-down: {recap.signatureDoubleDown.symbol} (round {recap.signatureDoubleDown.roundNumber}).</div>
          )}
        </div>
      )}

      <button
        onClick={onContinue}
        style={{
          marginTop: 4, padding: '10px 12px', borderRadius: 9, border: 'none', cursor: 'pointer',
          background: kind === 'advancer' ? tokens.teal : tokens.bgElevated,
          color: kind === 'advancer' ? '#06201c' : tokens.textPrimary, fontWeight: 800, fontSize: 13,
        }}
      >
        {continueLabel}
      </button>
    </motion.div>
  );
}
