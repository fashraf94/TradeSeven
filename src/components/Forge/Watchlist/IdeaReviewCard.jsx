// src/components/Forge/Watchlist/IdeaReviewCard.jsx
//
// Pilot P1c — founder ruling E2 (table C V1.2): the review card under the
// Idea panel's review line, for a deployed version whose window has closed
// (review_due, or retired / invalidated after a deploy). It renders exactly
// what the review route returns (GET …/hypothesis-versions/{n}/review —
// api/_utils/hypothesisRecords/review.js), never a re-derivation:
//   · the window — the last close before the idea went live → the window's
//     last close;
//   · ONE row, the list against the market: the FROZEN list's change (equal
//     weight over its names that have data), SPY's change, and the
//     difference — the server's stored numbers (2 decimals) and the
//     difference computed from them (BUILD_RULES §9);
//   · each name, collapsed: its two closes and its change, or "No data";
//   · the battles that carried the idea, each a link to its review (the Film
//     Room), voided ones marked;
//   · the honest line, as the server filled it from the frozen agent name.
// While the evidence is still settling the card shows the window, the
// battles and the line only. Words: table C V1.2 (ideaCopy.js); colors: the
// theme tokens the panel already uses.

import React, { useState } from 'react';
import { REVIEW_CARD_LABELS, formatIdeaDate } from './ideaCopy';

const fmtPct = (x) => `${x > 0 ? '+' : ''}${x.toFixed(2)}%`;
const fmtPts = (x) => `${x > 0 ? '+' : ''}${x.toFixed(2)} ${REVIEW_CARD_LABELS.points}`;
const fmtClose = (x) => x.toFixed(2);
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);

/**
 * @param {{ review: object, tokens: object, onOpenBattle: (battleId: string) => void }} props
 */
export default function IdeaReviewCard({ review, tokens, onOpenBattle }) {
  const [namesOpen, setNamesOpen] = useState(false);
  const evidence = review?.evidence && typeof review.evidence === 'object' ? review.evidence : null;
  const window = review?.window;
  const startDate = formatIdeaDate(window?.start?.closeAt);
  const endDate = formatIdeaDate(window?.end?.closeAt);
  const list = evidence?.list;
  const market = evidence?.market;
  const names = Array.isArray(evidence?.names) ? evidence.names : [];
  const battles = Array.isArray(review?.battles) ? review.battles.filter((b) => b && b.known) : [];
  const listLabel = typeof review?.listName === 'string' && review.listName ? review.listName : null;

  return (
    <div style={box(tokens)} data-testid="idea-review-card">
      {startDate && endDate && (
        <div style={meta(tokens)} data-testid="idea-review-window">{`${startDate} → ${endDate}`}</div>
      )}

      {evidence && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'baseline', fontSize: 13 }} data-testid="idea-review-row">
          <span style={{ color: tokens.textSecondary }} data-testid="idea-review-list">
            {listLabel ? `${listLabel} ` : ''}
            {list?.status === 'ok' && isNum(list.changePct) ? fmtPct(list.changePct) : REVIEW_CARD_LABELS.noData}
          </span>
          <span style={{ color: tokens.textMuted }} data-testid="idea-review-market">
            {`${market?.symbol || 'SPY'} `}
            {market?.status === 'ok' && isNum(market.changePct) ? fmtPct(market.changePct) : REVIEW_CARD_LABELS.noData}
          </span>
          {isNum(review.difference) && (
            <span style={{ color: tokens.textPrimary, fontWeight: 700 }} data-testid="idea-review-difference">
              {`${REVIEW_CARD_LABELS.difference} ${fmtPts(review.difference)}`}
            </span>
          )}
        </div>
      )}

      {evidence && names.length > 0 && (
        <div>
          <button
            type="button"
            aria-expanded={namesOpen}
            onClick={() => setNamesOpen((o) => !o)}
            style={linkBtn(tokens)}
            data-testid="idea-review-names-toggle"
          >
            {`${namesOpen ? '▾' : '▸'} ${REVIEW_CARD_LABELS.names}`}
          </button>
          {namesOpen && (
            <ul style={{ margin: '6px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }} data-testid="idea-review-names">
              {names.map((n) => (
                <li key={n.symbol} style={meta(tokens)} data-testid={`idea-review-name-${n.symbol}`}>
                  {n.status === 'ok' && isNum(n.startClose) && isNum(n.endClose) && isNum(n.changePct)
                    ? `${n.symbol} ${fmtClose(n.startClose)} → ${fmtClose(n.endClose)} · ${fmtPct(n.changePct)}`
                    : `${n.symbol} · ${REVIEW_CARD_LABELS.noData}`}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {battles.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'baseline' }} data-testid="idea-review-battles">
          <span style={meta(tokens)}>{REVIEW_CARD_LABELS.battles}</span>
          {battles.map((b) => (
            <button
              key={b.battleId}
              type="button"
              onClick={() => onOpenBattle?.(b.battleId)}
              style={linkBtn(tokens)}
              data-testid={`idea-review-battle-${b.battleId}`}
            >
              {formatIdeaDate(b.createdAt) || b.battleId}
              {b.voided ? ` · ${REVIEW_CARD_LABELS.voided}` : ''}
            </button>
          ))}
        </div>
      )}

      {typeof review?.honestLine === 'string' && review.honestLine && (
        <p style={{ ...meta(tokens), margin: 0, fontStyle: 'italic' }} data-testid="idea-review-honest">{review.honestLine}</p>
      )}
    </div>
  );
}

function box(tokens) {
  return { display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', borderRadius: 8, border: `1px solid ${tokens.borderDivider}`, background: tokens.bgCard };
}
function meta(tokens) {
  return { fontSize: 12, lineHeight: 1.5, color: tokens.textFaint };
}
function linkBtn(tokens) {
  return {
    padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 12, color: tokens.teal, textDecoration: 'underline', textUnderlineOffset: 2,
  };
}
