// api/_utils/mandateContextBlock.js
//
// Spec 1 — Mandate Substrate — the book-state CONTEXT BLOCK (§3.2). Pure renderer
// (no Firestore, no fetch, no registry read): it turns an already-marked book
// view into the prompt's context section. It renders book state, positions with
// marks and `asOf`, cash, quarter drawdown, days-into-quarter, and regime +
// `regimeAsOf`. NO timer, NO opponent — the mandate manager runs a book, it does
// not fight a battle.
//
// PROVENANCE-HONEST: every position mark carries its `asOf` and whether it is
// FRESH (this tick) or a CARRY-OVER mark (§3.6) — the model is never shown a
// stale price as if it were live. Regime provenance (§6.1) is a P3 field; until
// then regime renders as `unknown` rather than a fabricated label.

function fmtUsd(n) {
  if (!Number.isFinite(n)) return 'n/a';
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtPct(frac) {
  if (!Number.isFinite(frac)) return 'n/a';
  return `${(frac * 100).toFixed(2)}%`;
}

/**
 * Render the context block from a marked book view. All inputs are plain data
 * the assembler already derived — this module reads no live source.
 *
 * @param {object} args
 * @param {object} args.marked            marked positions (from mandateValuation.markBook)
 * @param {number} args.cash
 * @param {number} args.totalValue
 * @param {number} args.initialValue
 * @param {number} args.quarterDrawdown   fraction (book.portfolio.quarterDrawdownFromPeak)
 * @param {number} args.daysIntoQuarter
 * @param {Set<string>} [args.actionableHeld]  held symbols with a fresh mark (I2)
 * @param {string} [args.regime]          §6.1 regime label (P3); 'unknown' until then
 * @param {string} [args.regimeAsOf]
 * @param {boolean} [args.bootstrapping]  below the construction target (F9)
 * @param {number} [args.minPositions]
 * @returns {{ text: string, data: object }}
 */
export function buildContextBlock({
  marked = {}, cash = 0, totalValue = 0, initialValue = 0,
  quarterDrawdown = 0, daysIntoQuarter = 0, actionableHeld = null,
  regime = null, regimeAsOf = null, bootstrapping = false, minPositions = null,
}) {
  const tickers = Object.keys(marked);
  const lines = [];
  lines.push('## Your book');
  lines.push(`Total value: ${fmtUsd(totalValue)} (started at ${fmtUsd(initialValue)})`);
  lines.push(`Cash available: ${fmtUsd(cash)} (${fmtPct(totalValue > 0 ? cash / totalValue : 0)} of book)`);
  lines.push(`Quarter drawdown from peak: ${fmtPct(quarterDrawdown)}`);
  lines.push(`Day ${daysIntoQuarter} of this quarter.`);
  lines.push(`Regime: ${regime || 'unknown'}${regimeAsOf ? ` (as of ${regimeAsOf})` : ''}`);
  if (bootstrapping && minPositions != null) {
    lines.push(`You are building toward the ${minPositions}-position construction target — keep buying quality toward it.`);
  }

  lines.push('');
  lines.push(`## Positions (${tickers.length})`);
  if (tickers.length === 0) {
    lines.push('None yet — this is a fresh book.');
  } else {
    for (const t of tickers) {
      const p = marked[t];
      const weight = totalValue > 0 ? p.marketValue / totalValue : 0;
      const fresh = actionableHeld ? actionableHeld.has(t) : (p.markSource === 'snapshot');
      const freshLabel = fresh ? 'fresh' : `CARRY-OVER (${p.markSource})`;
      lines.push(
        `- ${t}: ${p.shares} sh @ avg ${fmtUsd(p.avgCost)} · mark ${fmtUsd(p.mark)} [${freshLabel}] `
        + `· value ${fmtUsd(p.marketValue)} (${fmtPct(weight)}) · sector ${p.sector || 'unknown'}`,
      );
    }
  }

  const data = {
    totalValue, cash, initialValue, quarterDrawdown, daysIntoQuarter,
    regime: regime || 'unknown', regimeAsOf: regimeAsOf || null, bootstrapping,
    positions: tickers.map((t) => ({
      ticker: t, shares: marked[t].shares, avgCost: marked[t].avgCost, mark: marked[t].mark,
      markSource: marked[t].markSource, sector: marked[t].sector,
      fresh: actionableHeld ? actionableHeld.has(t) : (marked[t].markSource === 'snapshot'),
    })),
  };

  return { text: lines.join('\n'), data };
}
