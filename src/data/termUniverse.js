// src/data/termUniverse.js
//
// Phase 2.5 Voice Layer Rework — frontend term universe with full modal
// content. Read by:
//   - src/components/Agent/AgentChat.jsx (detection — TERM_TOKENS_SET lookup)
//   - src/components/shared/TermResearchModal.jsx (rendering — full content)
//
// Sibling: api/_utils/termUniverse.js carries the thin token list for prompt
// construction. Drift between the two files is caught by TM6 in
// api/scripts/test-voice-layer-phase-2-5.js.
//
// Content was AI-drafted (Claude Sonnet) and human-reviewed before commit per
// FANTASYTRADES_VOICE_LAYER_PHASE_2_5_SPEC §2 Decision 2.
//
// LINTED BY test-voice-layer-phase-2-5.js TM6 — preserve "TOKEN: {" line format

export const TERM_UNIVERSE = {
  VWAP: {
    displayName: 'VWAP',
    category: 'technical',
    definition: {
      whatItIs: "VWAP (Volume-Weighted Average Price) is the average price a stock has traded at throughout the day, weighted by volume — meaning prices with more trading activity count more heavily toward the average than low-volume ticks.",
      whyItMatters: "Large institutional traders use VWAP as a benchmark for execution quality — a buy above VWAP is a below-average fill, a buy below is above-average. When a stock trades persistently above VWAP, institutional buyers are likely supporting the price; persistent trading below it signals that support has weakened.",
      howTradersUse: "Traders treat VWAP as a dynamic line in the sand: stocks holding above it are considered in an intraday uptrend, while sustained drops below it are treated as a warning that momentum is shifting against the move.",
      example: "If CRWD opens at $650 and trades around $652–$655 most of the morning, VWAP might settle near $653. A drop to $649 that holds for several consecutive ticks suggests sellers have taken control and institutional support is fading.",
    },
  },
  RSI: {
    displayName: 'RSI',
    category: 'technical',
    definition: {
      whatItIs: "RSI (Relative Strength Index) is a momentum indicator that measures how fast and how far a stock's price has moved recently, expressed as a number between 0 and 100. Readings above 70 are considered overbought — the stock may have risen too quickly — while readings below 30 are considered oversold.",
      whyItMatters: "RSI doesn't predict direction on its own, but it flags when a move is stretched. An RSI above 70 in a stock that's been rallying for days suggests the near-term upside may be crowded; an RSI under 30 after a sharp selloff can signal exhaustion in the selling pressure.",
      howTradersUse: "Traders use RSI to time entries and exits around mean reversion — buying when a stock is deeply oversold in a broader uptrend, or trimming exposure when a strong stock gets extremely overbought. Many also watch for divergence, where price makes a new high but RSI does not, as a warning of weakening momentum.",
      example: "If NVDA rallies from $900 to $970 in three sessions and its RSI climbs to 78, Gemma might note the reading as a reason to reduce exposure rather than add — not because the rally is wrong, but because the risk of a short-term pullback is elevated.",
    },
  },
  MACD: {
    displayName: 'MACD',
    category: 'technical',
    definition: {
      whatItIs: "MACD (Moving Average Convergence Divergence) tracks whether a stock's momentum is building or fading by comparing two of its moving averages — typically the 12-day and 26-day. When the shorter average rises faster than the longer one, momentum is strengthening; when it falls behind, momentum is weakening.",
      whyItMatters: "When the MACD line crosses above its signal line, momentum is turning positive; when it crosses below, momentum is weakening. The width of the histogram shows how much conviction is behind the move — a rapidly expanding histogram suggests strengthening trend, a contracting one suggests the move is running out of steam.",
      howTradersUse: "Traders use MACD crossovers as entry and exit triggers — buying when MACD crosses above its signal line, selling when it crosses below. The histogram (the gap between the MACD line and its signal line) shows conviction: an expanding histogram suggests strengthening trend, a contracting one suggests the move is running out of steam.",
      example: "If AAPL has been declining for two weeks and its MACD line crosses above the signal line while the histogram turns positive, that crossover would typically prompt Gemma to consider re-entering a long position, treating it as early evidence of a reversal.",
    },
  },
  ATR: {
    displayName: 'ATR',
    category: 'technical',
    definition: {
      whatItIs: "ATR (Average True Range) measures how much a stock typically moves in a single day, expressed in dollars, by averaging the size of its daily price swings over a lookback period (usually 14 days). It captures volatility, not direction.",
      whyItMatters: "A stock with a high ATR is volatile — it can swing several percent in a session even without major news. A low ATR means the stock is in a tight, calm range. During earnings seasons or macro events, ATR often expands sharply, meaning the same position size carries more risk than it did the week before.",
      howTradersUse: "Traders use ATR to size positions and set stop-losses at meaningful levels. A stop placed one ATR below entry on a high-volatility stock gives the trade room to breathe without being stopped out by routine daily noise.",
      example: "If MU has a 14-day ATR of $4.50, Gemma might set a stop-loss $4.50 below her entry price rather than using an arbitrary round-number level — ensuring the stop reflects actual market behavior rather than a guess.",
    },
  },
  SMA: {
    displayName: 'SMA',
    category: 'technical',
    definition: {
      whatItIs: "SMA (Simple Moving Average) is the average closing price of a stock over a set number of days — the 50-day SMA, for instance, is simply the average of the last 50 closes, recalculated each day as new data comes in. It smooths out daily noise to reveal the underlying trend direction.",
      whyItMatters: "The 50-day and 200-day SMAs are widely watched because enough traders and institutions act on them to make them self-reinforcing. A stock that finds support at its 200-day SMA repeatedly often does so partly because buyers are specifically looking for that level.",
      howTradersUse: "Traders use SMAs as dynamic support and resistance levels — buying pullbacks to the 50-day in an uptrend, and treating a break below the 200-day as a meaningful shift in the longer-term trend. A 50-day crossing below the 200-day (called a death cross) is treated as a broadly bearish signal by many institutional desks.",
      example: "If MSFT pulls back after a strong earnings rally but holds above its rising 50-day SMA, Gemma would likely treat that level as support and a potential re-entry point rather than a reason to exit the position.",
    },
  },
  EMA: {
    displayName: 'EMA',
    category: 'technical',
    definition: {
      whatItIs: "EMA (Exponential Moving Average) is a moving average that gives more weight to recent prices than older ones, making it react faster to new price action than a Simple Moving Average of the same length. The most common short-term EMAs traders watch are the 9-day, 21-day, and 50-day.",
      whyItMatters: "Because the EMA responds more quickly to price changes, it can flag momentum shifts earlier than the SMA — but that speed also makes it more prone to false signals in choppy markets. In strong trending stocks, the EMA tends to act as a tighter, more responsive support line.",
      howTradersUse: "Traders use EMAs to define trend structure in fast-moving names. A stock that keeps bouncing off its 21-day EMA on pullbacks is showing consistent institutional accumulation; a break below that level on volume often marks the first sign that the trend is deteriorating.",
      example: "If TSLA is in a sharp uptrend and pulls back to its 21-day EMA three sessions in a row without breaking it, Gemma would likely treat each touch as a potential buying opportunity rather than a warning sign — the EMA is acting as a floor.",
    },
  },
  PCE: {
    displayName: 'PCE',
    category: 'economic',
    definition: {
      whatItIs: "PCE (Personal Consumption Expenditures) is the Federal Reserve's preferred measure of inflation, tracking month-over-month changes in the prices Americans pay for goods and services. The Fed focuses especially on Core PCE, which strips out volatile food and energy prices to show underlying inflation trends.",
      whyItMatters: "Because the Fed sets interest rates based heavily on PCE data, each monthly release directly influences how markets price the odds of rate hikes or cuts. A hotter-than-expected print pushes traders to expect rates to stay higher for longer; a cooler print raises hopes for relief.",
      howTradersUse: "Traders position ahead of PCE releases based on consensus expectations, but the real move comes from the gap between the actual print and what was expected — a print that lands exactly at consensus often produces little reaction, while even a small miss in either direction can move markets sharply.",
      example: "If consensus expects Core PCE at 2.6% year-over-year and the print comes in at 2.9%, markets often sell off as traders price in a higher probability that the Fed delays rate cuts — with rate-sensitive names like growth tech hit hardest.",
    },
  },
  CPI: {
    displayName: 'CPI',
    category: 'economic',
    definition: {
      whatItIs: "CPI (Consumer Price Index) measures inflation by tracking the prices of a fixed basket of consumer goods and services — things like groceries, rent, gas, and medical care — and reporting how much that basket has changed over the past month and year.",
      whyItMatters: "CPI is the most widely covered inflation report and one of the most market-moving monthly data points on the calendar. Because rate decisions hinge on inflation, a surprising CPI print can reprice the entire interest rate path in a matter of minutes — moving bonds, currencies, and equities simultaneously.",
      howTradersUse: "Traders watch both the headline number (all items) and Core CPI (excluding food and energy) since the Fed gives more weight to core. Positioning before the report is common, but many experienced traders wait for the initial reaction to fade before entering, since the first move after a CPI print is often reversed within the same session.",
      example: "When CPI has printed materially above expectations, the S&P 500 has dropped multiple percent in single sessions as traders rapidly reprice the probability of aggressive Fed action — a reminder that even one data point can override weeks of positive price action.",
    },
  },
  FOMC: {
    displayName: 'FOMC',
    category: 'economic',
    definition: {
      whatItIs: "FOMC (Federal Open Market Committee) is the body within the Federal Reserve that sets the federal funds rate — the benchmark interest rate that ripples through the cost of mortgages, corporate borrowing, and virtually every asset class. The committee meets eight times per year, and each meeting is a scheduled market event.",
      whyItMatters: "Interest rates set the price of money. When rates rise, growth stocks (whose value depends on future earnings discounted back to the present) tend to fall hardest; when rates fall, money flows back into risk assets. Even the language in the post-meeting statement can move markets more than the rate decision itself.",
      howTradersUse: "Traders parse every word of the FOMC statement and the Fed Chair's press conference for clues about future policy direction — a process called Fed-watching. The real focus is on language shifts: moving from 'ongoing hikes' to 'pausing' or from 'restrictive' to 'accommodative' signals a regime change long before rates actually move.",
      example: "When the Fed has signaled a pivot toward rate cuts in past cycles, growth-sensitive names like NVDA have rallied sharply even before any actual reduction — markets typically price the expectation weeks ahead of the actual move.",
    },
  },
  NFP: {
    displayName: 'NFP',
    category: 'economic',
    definition: {
      whatItIs: "NFP (Nonfarm Payrolls) is the monthly jobs report published by the Bureau of Labor Statistics, counting how many jobs the U.S. economy added or lost in the previous month outside of the farming sector. It's released on the first Friday of each month and is consistently one of the highest-impact data releases on the calendar.",
      whyItMatters: "Employment is one of the two mandates the Fed is required to balance alongside inflation. A strong jobs number suggests the economy can tolerate higher rates; a weak number raises concerns about growth and increases pressure on the Fed to cut. The report can flip the expected rate path in a single release.",
      howTradersUse: "Traders watch not just the headline payrolls number but also the unemployment rate and average hourly earnings — rising wages can signal inflation pressure even if job growth is moderate. Because NFP is released pre-market on a Friday, the reaction plays out over a compressed window with thin liquidity in early trading.",
      example: "If NFP comes in at 300,000 jobs added when 180,000 were expected, the initial reaction is often a risk-off move — counterintuitively, stronger-than-expected job growth can be a near-term headwind for stocks because it lowers the odds of Fed rate cuts.",
    },
  },
  PPI: {
    displayName: 'PPI',
    category: 'economic',
    definition: {
      whatItIs: "PPI (Producer Price Index) measures inflation at the wholesale level — tracking how much producers are paying for raw materials, inputs, and intermediate goods before those costs reach consumers. It's often described as a leading indicator for CPI, since rising production costs tend to get passed downstream over time.",
      whyItMatters: "When PPI is rising faster than CPI, it signals that margin pressure is building for companies — they're paying more to produce but haven't yet raised consumer prices enough to offset it. Conversely, a falling PPI suggests input cost relief is coming, which can expand margins and support earnings.",
      howTradersUse: "Traders use PPI as a forward-looking read on corporate margins and future CPI direction. If PPI runs hot for several months before an earnings season, analysts will factor in margin compression when setting expectations — making PPI an early input to how stocks are valued before results are even reported.",
      example: "If PPI for final demand rises 0.5% in a month when 0.2% was expected, traders in industrial and consumer staples names like COST would immediately model whether those companies have pricing power to absorb the cost increase or will see margins compress in the next quarter.",
    },
  },
  GDP: {
    displayName: 'GDP',
    category: 'economic',
    definition: {
      whatItIs: "GDP (Gross Domestic Product) is the total value of all goods and services produced in the U.S. economy over a quarter, and is the broadest single measure of economic health. It's reported as an annualized percentage growth rate — the rate at which the economy would grow if the current quarter's pace held for a full year.",
      whyItMatters: "GDP sets the backdrop against which everything else is interpreted. Strong GDP growth supports corporate revenue expectations and risk appetite; two consecutive quarters of negative GDP growth is the classic definition of a recession, which historically triggers broad market repricing and earnings estimate cuts.",
      howTradersUse: "GDP is reported with a significant lag — the initial estimate comes roughly four weeks after the quarter ends, with two subsequent revisions — so markets often anticipate the direction using real-time proxies like PMI surveys and retail sales data. Traders watch the composition of GDP as much as the headline: consumer spending, business investment, and government spending each carry different implications for specific sectors.",
      example: "If Q1 GDP prints at -0.3% annualized when +1.8% was expected — raising recession concerns — the reaction in growth-sensitive names like AMZN and META is typically severe. Lower growth means lower revenue projections, and markets discount those future earnings immediately.",
    },
  },
};

export const TERM_TOKENS_SET = new Set(Object.keys(TERM_UNIVERSE));

export function isKnownTerm(token) {
  if (!token || typeof token !== 'string') return false;
  return TERM_TOKENS_SET.has(token.toUpperCase());
}

export function getTermDefinition(token) {
  if (!token || typeof token !== 'string') return null;
  return TERM_UNIVERSE[token.toUpperCase()] || null;
}
