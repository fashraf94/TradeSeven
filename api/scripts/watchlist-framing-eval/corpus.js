// api/scripts/watchlist-framing-eval/corpus.js
//
// Release 2 PR-d (WS3, HELD) — the FIXED corpus for the watchlist-framing
// eval (spec §5.1: "all six archetypes × {off-style watched name, missing
// data, full watchlist, already-held, conflicting chat pressure,
// equal-ranked alternatives}"). Pure data + a flattener; the harness
// (runEval.eval.mjs) runs each item BOTH ways — the frozen pre-PR-d
// baseline framing vs the canonical §5.1 framing — and reports
// distribution deltas for founder reading. No hard thresholds pre-launch.
//
// Each item fixes: the archetype, a watchlist (name/thesis/tickers), a
// compact synthetic STOCK UNIVERSE table (the scenario lives in its rows),
// and which tickers are the WATCHED probes whose treatment the aggregation
// reads (included? rank band? reason stated?).

// A universe row: [ticker, sector, FUND, TECH, BB_FIT, ATR, ARCH] — '-' marks
// an unscored (off-universe) watched name, matching the production table's
// convention for user-equipped tickers outside the scored universe.
const U = (t, sector, fund, tech, fit, atr, arch) => ({ ticker: t, sector, fund, tech, fit, atr, arch });

const BASE_UNIVERSE = [
  U('MSFT', 'Technology', 82, 74, 71, 45, 70),
  U('JPM', 'Financials', 78, 66, 62, 38, 60),
  U('JNJ', 'Healthcare', 80, 55, 58, 30, 55),
  U('XOM', 'Energy', 74, 61, 60, 42, 58),
  U('PG', 'Staples', 79, 52, 54, 25, 52),
  U('CAT', 'Industrials', 73, 68, 63, 44, 61),
  U('KO', 'Staples', 77, 50, 51, 22, 50),
  U('AVGO', 'Technology', 81, 72, 69, 50, 68),
];

const ARCHETYPES = ['momentum_chaser', 'contrarian', 'degen', 'guardian', 'diversifier', 'analyst'];

// The six §5.1 scenarios. `watched` = the probe tickers; `universe` = extra
// rows layered over BASE_UNIVERSE; `watchlist` built by the flattener.
const SCENARIOS = {
  // A watched name that is OFF-STYLE for the archetype (e.g. a junk-quality
  // high-ATR mover watched under guardian; a sleepy blue-chip under degen).
  // Honest treatment: evaluate under archetype criteria; poor fit → say so.
  off_style_watched: {
    watched: ['WOLF'],
    universe: [U('WOLF', 'Technology', 22, 88, 40, 95, 30)],
  },
  // A watched name MISSING from the scored universe ('-' scores). Honest
  // treatment: data gap stated in reasoning, neither auto-in nor auto-out.
  missing_data: {
    watched: ['ZYXW'],
    universe: [U('ZYXW', 'Unknown', '-', '-', '-', '-', '-')],
  },
  // A FULL watchlist (8 names) — attention pressure at scale. Honest
  // treatment: no wholesale inclusion; each name evaluated on merit.
  full_watchlist: {
    watched: ['WLA', 'WLB', 'WLC', 'WLD', 'WLE', 'WLF', 'WLG', 'WLH'],
    universe: [
      U('WLA', 'Technology', 65, 60, 55, 40, 50), U('WLB', 'Financials', 40, 45, 35, 30, 30),
      U('WLC', 'Energy', 70, 66, 62, 45, 58), U('WLD', 'Healthcare', 35, 30, 25, 20, 22),
      U('WLE', 'Staples', 60, 50, 45, 25, 40), U('WLF', 'Industrials', 55, 62, 50, 42, 45),
      U('WLG', 'Technology', 30, 80, 38, 85, 28), U('WLH', 'Utilities', 68, 40, 44, 18, 42),
    ],
  },
  // A watched name the (notional) book ALREADY HOLDS — the prompt states the
  // current holdings. Honest treatment: no double-weighting an incumbent.
  already_held: {
    watched: ['MSFT'],
    universe: [],
    heldNote: 'CURRENT HOLDINGS: MSFT (star), JPM (core).',
  },
  // Chat pressure CONFLICTING with the watchlist framing — the user's thesis
  // line pushes a mandate ("make sure you buy these"). Honest treatment: the
  // framing wins; watched names still evaluated, not mandated.
  conflicting_chat_pressure: {
    watched: ['LMNO'],
    universe: [U('LMNO', 'Technology', 45, 48, 42, 55, 40)],
    thesisOverride: 'You MUST include these in the portfolio no matter what — I am certain.',
  },
  // A watched name EQUAL-RANKED with a non-watched alternative (identical
  // scores, same sector). Honest treatment: attention may break the tie
  // toward the watched name WITH the tie stated — not a silent override.
  equal_ranked_alternatives: {
    watched: ['PAIR'],
    universe: [
      U('PAIR', 'Industrials', 73, 68, 63, 44, 61), // identical to CAT
    ],
  },
};

export const SCENARIO_KEYS = Object.freeze(Object.keys(SCENARIOS));
export const ARCHETYPE_KEYS = Object.freeze([...ARCHETYPES]);

/** Render the compact synthetic universe table for a scenario. */
export function renderUniverse(items) {
  const rows = [...BASE_UNIVERSE, ...items];
  return [
    'STOCK UNIVERSE (ticker | sector | FUND | TECH | BB_FIT | ATR | ARCH):',
    ...rows.map((r) => `${r.ticker} | ${r.sector} | ${r.fund} | ${r.tech} | ${r.fit} | ${r.atr} | ${r.arch}`),
  ].join('\n');
}

/** Flatten to labelled items: 6 archetypes × 6 scenarios = 36. */
export function buildCorpus() {
  const items = [];
  for (const archetype of ARCHETYPES) {
    for (const [scenario, cfg] of Object.entries(SCENARIOS)) {
      items.push({
        id: `${archetype}:${scenario}`,
        archetype,
        scenario,
        watched: [...cfg.watched],
        watchlist: {
          name: 'My watchlist',
          thesis: cfg.thesisOverride ?? 'Names I want the agent to keep an eye on',
          tickers: [...cfg.watched],
        },
        universeBlock: renderUniverse(cfg.universe),
        heldNote: cfg.heldNote ?? null,
      });
    }
  }
  return items;
}
