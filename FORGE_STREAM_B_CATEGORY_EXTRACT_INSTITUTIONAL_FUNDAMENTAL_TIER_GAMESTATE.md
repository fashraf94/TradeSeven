# Forge Stream B — Rule Extraction (Session 2 categories)

**Date:** 2026-05-26
**Auditor:** Claude Code
**Branch audited:** main @ `3b6554c39bf428b61918b7a2de0d91e61a07e973`
**Source file:** `src/data/forgeKnowledgeBase.js`
**Scope:** Read-only extraction of 4 categories (institutional, fundamental, tier_strategy, game_state)

## Summary

- **institutional:** 10 rules extracted (lines 2779–3076)
- **fundamental:** 14 rules extracted (lines 219–351, 1838–2014, 2606–2633)
- **tier_strategy:** 10 rules extracted (lines 1396–1626, 2661–2687)
- **game_state:** 11 rules extracted (lines 925–1206)
- **Total:** 45

**Rule schema fields present on every rule:**
- `id`, `category`, `modes`, `headline`, `description`, `learnMore`, `difficulty`, `forgeTemplates[]`, `relatedIndicator`, `kbEntryId`, `tags[]`, `agentUseDescription`
- `forgeTemplates[]` entries contain: `text`, `params`, `category`
- Some newer rules also include `hook` (a one-line punchy framing line); older rules do not.
- `kbEntryId` is consistently `null` across the 45 rules in scope, with one exception (`fund-bank-pb` → `'sector-playbook-banks'`).
- No `priority` field defined on rules themselves (priority lives on collection-rule references, not on the rule definitions).
- No `triggerConditions` field; required detection primitives are implicit in the rule text and rendered to Haiku as prompt context.

---

## Category 1: institutional

### Rule 1.1 — i-01

**Source location:** `src/data/forgeKnowledgeBase.js:2780-2808`
**Adjacent comment:** `// i-01: Institutional Conviction Filter`

**Name (headline):** Institutional Conviction Filter
**Category:** institutional
**Mode:** both
**Difficulty:** beginner
**Hook:** (none)

**Description:** Prefer stocks where active institutional holders are net accumulating. Filters out passive index fund noise to focus on informed, high-conviction buying.

**learnMore:** Institutional conviction is measured by weighting each holder's quarterly change by their portfolio concentration. A stock showing "strong accumulation" means multiple active fund managers are increasing positions as a significant percentage of their portfolios — not just index funds mechanically rebalancing. Research shows that a manager's most over-weighted positions outperform the market by 1.6-2.1% per quarter.

**Template text:** `Strongly prefer drafting stocks where institutional conviction is {conviction}`

**Params:**
```js
{
  conviction: {
    type: 'select',
    default: 'strong_accumulation',
    options: [
      { value: 'strong_accumulation', label: 'Strong Accumulation' },
      { value: 'mild_accumulation', label: 'Mild Accumulation' },
    ],
    label: 'Minimum Conviction Level',
    hint: 'Strong filters out passive index inflows. Mild is more permissive but noisier.',
  }
}
```

**relatedIndicator:** null
**kbEntryId:** null
**Tags:** `['institutional', 'conviction', 'accumulation', 'smart-money', '13F']`

**agentUseDescription:** Filters the draft universe to stocks where active institutional holders (excluding passive index funds) are net accumulating. Uses the weighted conviction score from 13F filings. This is a soft preference — the agent can still draft stocks without institutional backing if technical signals are strong.

**Detection requirement:**
- Required signal: Weighted institutional conviction score per stock (categorical: `strong_accumulation` / `mild_accumulation` / etc.)
- Data producer: `api/cron/compute-institutional-intelligence.js:105` → `api/_utils/institutionalIntelligence.js` → Firestore `institutionalHoldings.{symbol}.summary.conviction`
- Data consumer: `api/_utils/agentEvalPromptAssembly.js:476-489` (rendered into institutional prompt block)
- Status: ✅ detected today

**Sample usage (Trading Style Collections):** ❌ Not included in any Trading Style Collection or legacy themed collection.

---

### Rule 1.2 — i-02

**Source location:** `src/data/forgeKnowledgeBase.js:2811-2839`
**Adjacent comment:** `// i-02: Distribution Avoidance`

**Name (headline):** Distribution Avoidance
**Category:** institutional
**Mode:** both
**Difficulty:** beginner

**Description:** Strictly avoid stocks where institutions are actively selling. When smart money exits, overhead supply caps intraday upside and increases bust risk.

**learnMore:** Institutional distribution creates a "VWAP ceiling" — when large funds are selling, their algorithms feed sell orders into any price rally, suppressing the momentum needed for ATR threshold crossings. Research shows that sell herding has a more persistent negative impact on returns than buy herding has a positive impact. This asymmetry makes distribution avoidance one of the most effective defensive rules.

**Template text:** `Strictly avoid drafting stocks where institutional conviction is {level} or worse`

**Params:**
```js
{
  level: {
    type: 'select',
    default: 'strong_distribution',
    options: [
      { value: 'strong_distribution', label: 'Strong Distribution' },
      { value: 'mild_distribution', label: 'Mild Distribution' },
    ],
    label: 'Avoidance Threshold',
    hint: 'Strong Distribution filters the bottom ~10-15%. Mild Distribution is more aggressive and removes ~25-30%.',
  }
}
```

**relatedIndicator:** null
**kbEntryId:** null
**Tags:** `['institutional', 'distribution', 'avoidance', 'risk', 'smart-money']`

**agentUseDescription:** Hard filter that excludes stocks from the draftable universe when institutional holders are net selling. This is a defensive rule — stocks under active distribution face overhead selling pressure from institutional VWAP algorithms that cap intraday upside. Applied at draft time as a Level 1 filter.

**Detection requirement:**
- Required signal: Institutional conviction state per stock (categorical, includes `strong_distribution` / `mild_distribution` values)
- Data producer: `api/_utils/institutionalIntelligence.js` (conviction classifier) → Firestore `institutionalHoldings.{symbol}.summary.conviction`
- Data consumer: `api/_utils/agentEvalPromptAssembly.js:476-489` (institutional prompt block)
- Status: ✅ detected today

**Sample usage:** ❌ Not included in any collection.

---

### Rule 1.3 — i-03

**Source location:** `src/data/forgeKnowledgeBase.js:2842-2870`
**Adjacent comment:** `// i-03: Consensus Discovery`

**Name (headline):** Consensus Discovery
**Category:** institutional
**Mode:** both
**Difficulty:** intermediate

**Description:** Prefer stocks where multiple institutions opened brand new positions this quarter. New money entering a stock signals a fresh catalyst that passed rigorous research filters.

**learnMore:** When an institution opens a new position, it means the stock competed for capital against every other opportunity in the manager's universe. When two or more do it independently in the same quarter, it signals a "consensus discovery" — multiple professional research teams found the same opportunity. This cluster buying pattern is one of the strongest alpha signals in 13F data.

**Template text:** `Prefer stocks where at least {count} top-20 institutional holders initiated a completely new position this quarter`

**Params:**
```js
{
  count: { type: 'number', default: 2, min: 1, max: 5, step: 1, unit: '',
           label: 'Minimum New Positions',
           hint: '1 is noise. 2 is consensus. 3+ is a stampede. Higher = stronger signal but fewer qualifying stocks.' }
}
```

**relatedIndicator:** null
**kbEntryId:** null
**Tags:** `['institutional', 'new-position', 'cluster-buy', 'catalyst', 'consensus']`

**agentUseDescription:** Identifies stocks with fresh institutional interest — positions that didn't exist last quarter. Multiple new positions in the same stock signal a consensus discovery among independent research teams. Applied as a preference during portfolio construction.

**Detection requirement:**
- Required signal: New-position count (number of top-20 institutions that opened a brand-new position in the latest quarter)
- Data producer: `api/_utils/institutionalIntelligence.js` `computeSummary()` → `newPositionsCount` field → Firestore `institutionalHoldings.{symbol}.summary.newPositionsCount`
- Data consumer: `api/_utils/agentEvalPromptAssembly.js:485` (newPositionsCount in institutional CSV)
- Status: ✅ detected today

**Sample usage:** ❌ Not included in any collection.

---

### Rule 1.4 — i-04

**Source location:** `src/data/forgeKnowledgeBase.js:2873-2901`
**Adjacent comment:** `// i-04: Whale Concentration Guard`

**Name (headline):** Whale Concentration Guard
**Category:** institutional
**Mode:** both
**Difficulty:** intermediate

**Description:** Avoid stocks where a single institution holds too large a stake. When one whale controls the float, their exit creates outsized price drops and bust risk.

**learnMore:** When a single entity controls 20%+ of outstanding shares, the stock's liquidity becomes dependent on that fund's stability. If the whale faces redemptions, their forced selling overwhelms market depth and triggers cascading price drops. The threshold of 20% accounts for the dominance of passive index providers (Vanguard, BlackRock, State Street), who routinely hold 10-15% of major stocks through mechanical index inclusion.

**Template text:** `Avoid stocks where any single institutional entity holds more than {pct}% of total outstanding shares`

**Params:**
```js
{
  pct: { type: 'number', default: 20, min: 10, max: 35, step: 1, unit: '%',
         label: 'Maximum Single-Holder Stake',
         hint: '20% filters extreme concentration while allowing normal passive index holdings. Lower = stricter but may exclude popular large-caps.' }
}
```

**relatedIndicator:** null
**kbEntryId:** null
**Tags:** `['institutional', 'concentration', 'whale', 'risk', 'liquidity']`

**agentUseDescription:** Tail-risk filter that excludes stocks with extreme ownership concentration by a single entity. Applied at draft time to prevent the agent from holding stocks vulnerable to a single fund's liquidation cascade. The 20% default accounts for passive index fund dominance in modern markets.

**Detection requirement:**
- Required signal: Largest single-holder percentage of float per stock
- Data producer: ❌ no producer found. The institutional intelligence cron does not appear to compute or persist a "maxHolderPercentage" field per stock.
- Data consumer: Rule text-injected into Haiku prompt without supporting data
- Status: ❌ no detection path

**Sample usage:** ❌ Not included in any collection.

---

### Rule 1.5 — i-05

**Source location:** `src/data/forgeKnowledgeBase.js:2904-2932`
**Adjacent comment:** `// i-05: Active Fund Overlap Guard`

**Name (headline):** Active Fund Overlap Guard
**Category:** institutional
**Mode:** both
**Difficulty:** advanced

**Description:** Prevent drafting too many stocks held by the same active mutual fund. High overlap means correlated drawdowns when that fund faces redemptions.

**learnMore:** When multiple stocks in your portfolio are top holdings of the same active mutual fund, they become linked through common flow shocks. During market stress, funds facing redemptions liquidate across their entire portfolio simultaneously — creating correlated crashes in seemingly unrelated stocks. This rule targets active fund overlap specifically because passive index funds (Vanguard, BlackRock) hold everything and carry no informational signal.

**Template text:** `Ensure no more than {max} drafted stocks share the same top-3 active mutual fund holder (excluding passive index providers)`

**Params:**
```js
{
  max: { type: 'number', default: 2, min: 1, max: 4, step: 1, unit: '',
         label: 'Maximum Overlap',
         hint: '2 enforces strict diversification in a 5-stock portfolio. 3 allows moderate clustering. 1 is extremely restrictive.' }
}
```

**relatedIndicator:** null
**kbEntryId:** null
**Tags:** `['institutional', 'overlap', 'diversification', 'correlation', 'fund-risk']`

**agentUseDescription:** Portfolio diversification rule that limits how many drafted stocks can share the same active mutual fund as a top-3 holder. Passive index funds are excluded from the check since they hold everything mechanically. Applied during portfolio construction to prevent correlated liquidation risk.

**Detection requirement:**
- Required signal: Top-3 active fund holder list per stock (with passive providers filtered out), then cross-stock overlap analysis
- Data producer: ❌ no producer found. No cross-stock overlap analysis exists in the codebase.
- Data consumer: Rule text-injected; no supporting data
- Status: ❌ no detection path

**Sample usage:** ❌ Not included in any collection.

---

### Rule 1.6 — i-06

**Source location:** `src/data/forgeKnowledgeBase.js:2935-2963`
**Adjacent comment:** `// i-06: Hedge Fund Favorites`

**Name (headline):** Hedge Fund Favorites
**Category:** institutional
**Mode:** clash
**Difficulty:** intermediate

**Description:** Target stocks widely held by top hedge funds for momentum amplification. Crowded trades provide explosive intraday moves but carry reversal risk.

**learnMore:** Stocks held by multiple top hedge funds benefit from persistent buying pressure during momentum phases — the Goldman Sachs "Hedge Fund VIP" index outperforms the S&P 500 in 60% of quarters. However, these crowded positions are fragile: when market stress hits, highly correlated hedge funds unwind simultaneously, causing violent crashes. Use this rule for BaggerBomb momentum plays but pair it with tight technical swap parameters.

**Template text:** `Target high-momentum setups in stocks held by at least {count} of the top-20 hedge funds, but maintain strict technical swap parameters due to crowded-trade reversal risk`

**Params:**
```js
{
  count: { type: 'number', default: 3, min: 2, max: 10, step: 1, unit: '',
           label: 'Minimum Hedge Fund Holders',
           hint: '3 identifies a crowded trade. 5+ is an extremely popular position with high momentum but severe crash risk.' }
}
```

**relatedIndicator:** null
**kbEntryId:** null
**Tags:** `['institutional', 'hedge-fund', 'crowded-trade', 'momentum', 'VIP']`

**agentUseDescription:** Momentum amplifier that prefers stocks widely held across top hedge funds. These "crowded trades" produce outsized intraday moves ideal for ATR threshold crossings. The agent must pair this with strict technical swap rules — if VWAP or 5-min MACD breaks down, exit immediately to avoid herd liquidation.

**Detection requirement:**
- Required signal: Count of top-20 hedge funds that hold each stock
- Data producer: `api/cron/compute-institutional-intelligence.js:101-148` categorizes funds by archetype (hedge_fund, mutual_fund, etc.) but does NOT persist an explicit "top-20 hedge fund holder count" per stock.
- Data consumer: Rule text-injected; the institutional prompt block doesn't surface a hedge-fund-count field
- Status: 🟠 partially detected (archetype classification exists; the rollup the rule needs does not)

**Sample usage:** ❌ Not included in any collection.

---

### Rule 1.7 — i-07

**Source location:** `src/data/forgeKnowledgeBase.js:2966-2994`
**Adjacent comment:** `// i-07: Sector Institutional Flow`

**Name (headline):** Sector Institutional Flow
**Category:** institutional
**Mode:** both
**Difficulty:** beginner

**Description:** Align stock selection with sectors where institutional money is flowing in. Capital rotation at the sector level creates structural tailwinds for individual stocks.

**learnMore:** Institutions don't just pick stocks — they rotate capital along sector lines. When massive funds rotate into Technology or out of Financials, it creates a rising or falling tide that individual stocks can't fight. Sector-level flow has 71% directional accuracy in high-signal sectors like Energy. This rule stacks well with FantasyTimes news sentiment for double confirmation.

**Template text:** `Prefer drafting stocks in sectors where the aggregate institutional flow sentiment is {sentiment}`

**Params:**
```js
{
  sentiment: {
    type: 'select',
    default: 'bullish',
    options: [
      { value: 'bullish', label: 'Bullish (Net Accumulation)' },
      { value: 'neutral', label: 'Neutral or Better' },
    ],
    label: 'Sector Flow Threshold',
    hint: 'Bullish aligns with the dominant capital rotation. Neutral allows sectors that aren\'t actively distributing.',
  }
}
```

**relatedIndicator:** null
**kbEntryId:** null
**Tags:** `['institutional', 'sector', 'flow', 'rotation', 'macro']`

**agentUseDescription:** Macro-alignment rule that ensures the agent's stock picks are in sectors where institutional capital is flowing in. Acts as a structural tailwind multiplier for technical breakout signals. Stacks with FantasyTimes sector sentiment for dual confirmation. Applied as a Level 2 preference during portfolio construction.

**Detection requirement:**
- Required signal: Sector-level institutional flow sentiment (bullish/neutral/bearish)
- Data producer: `api/cron/compute-institutional-intelligence.js` `computeSectorDrivers()` → Firestore `institutionalAggregates.latest.sectorFlows`
- Data consumer: `api/_utils/agentEvalPromptAssembly.js:492-505` (sector flows table rendered into prompt)
- Status: ✅ detected today

**Sample usage:** ❌ Not included in any collection.

---

### Rule 1.8 — i-08

**Source location:** `src/data/forgeKnowledgeBase.js:2997-3025`
**Adjacent comment:** `// i-08: Insider + Institution Confluence`

**Name (headline):** Insider + Institution Confluence
**Category:** institutional
**Mode:** both
**Difficulty:** advanced

**Description:** The premium signal: prefer stocks where both institutional holders AND company insiders are buying. Dual confirmation from people with the deepest knowledge.

**learnMore:** When corporate insiders (CEOs, CFOs) buy their own stock AND institutional managers are accumulating, it creates the strongest predictive signal in the 13F universe. Insiders know the company's immediate prospects; institutions validate the thesis with external analysis. Research shows this confluence yields 12-18% annualized abnormal returns. The 60-day insider lookback captures post-earnings buying windows while keeping the signal timely.

**Template text:** `Highlight as highest-conviction: Strongly prefer stocks where institutional conviction is accumulating AND insider activity in the past {days} days shows net buying`

**Params:**
```js
{
  days: { type: 'number', default: 60, min: 30, max: 180, step: 15, unit: '',
          label: 'Insider Lookback Window',
          hint: '60 days captures recent post-earnings insider buying. 90 is standard for longer horizons. 30 is aggressive and may miss slower-moving signals.' }
}
```

**relatedIndicator:** null
**kbEntryId:** null
**Tags:** `['institutional', 'insider', 'confluence', 'premium', 'dual-signal', 'highest-conviction']`

**agentUseDescription:** The highest-ranked institutional rule. Combines lagged 13F institutional accumulation with near real-time insider buying (Form 4 filings, required within 2 business days). This confluence neutralizes the primary weakness of quarterly data by demanding a timely insider confirmation. Applied as the top priority during portfolio construction — stocks meeting this criteria get maximum draft preference.

**Detection requirement:**
- Required signal: Recent insider (Form 4) net buying per stock + institutional conviction
- Data producer: ❌ no producer found. No Form 4 / insider transaction ingestion in the codebase. Institutional half is detected; insider half is not.
- Data consumer: Rule text-injected without the insider data
- Status: ❌ no detection path

**Sample usage:** ❌ Not included in any collection.

---

### Rule 1.9 — i-09

**Source location:** `src/data/forgeKnowledgeBase.js:3028-3045`
**Adjacent comment:** `// i-09: Transient Capital Catalyst`

**Name (headline):** Transient Capital Catalyst
**Category:** institutional
**Mode:** clash
**Difficulty:** advanced

**Description:** Prefer stocks where accumulation is driven by high-turnover, short-horizon institutions. These "transient" funds amplify intraday volatility — exactly what BaggerBomb rewards.

**learnMore:** Not all institutional money is equal. "Transient" institutions (high portfolio turnover, short holding periods) create significantly more stock return volatility than "dedicated" long-term holders. Since BaggerBomb rewards ATR threshold crossings, stocks with transient institutional accumulation are structurally more likely to produce the sharp intraday moves needed for Bagger bonuses. Dedicated holders provide stability but suppress the volatility BaggerBomb rewards.

**Template text:** `Prefer stocks where recent institutional accumulation is driven by high-turnover transient institutions rather than long-term dedicated holders`

**Params:** `{}` (empty — toggle-style rule with no tunable parameters)

**relatedIndicator:** null
**kbEntryId:** null
**Tags:** `['institutional', 'transient', 'volatility', 'momentum', 'high-turnover', 'ATR']`

**agentUseDescription:** Volatility amplifier that biases the agent toward stocks with accumulation by high-turnover "transient" institutions (quantitative funds, short-horizon momentum funds) rather than low-turnover "dedicated" holders. Transient capital creates the sharp intraday price movements needed for ATR threshold crossings. This is a toggle rule with no parameters — the agent checks whether the accumulating institutions are classified as high-turnover in the archetype system.

**Detection requirement:**
- Required signal: Per-institution turnover classification (transient vs. dedicated)
- Data producer: 🟠 `compute-institutional-intelligence.js` `getArchetype()` classifies institutions by archetype (hedge_fund / mutual_fund / etc.) but does NOT classify by turnover frequency. The "transient vs. dedicated" axis is not computed.
- Data consumer: Rule text-injected without the turnover taxonomy
- Status: 🟠 partially detected (archetype exists; the specific axis the rule needs does not)

**Sample usage:** ❌ Not included in any collection.

---

### Rule 1.10 — i-10

**Source location:** `src/data/forgeKnowledgeBase.js:3048-3076`
**Adjacent comment:** `// i-10: Institutional Breadth Momentum`

**Name (headline):** Institutional Breadth Momentum
**Category:** institutional
**Mode:** both
**Difficulty:** intermediate

**Description:** Prefer stocks where the number of unique institutional holders is expanding quarter after quarter. A growing investor base often precedes major price re-ratings.

**learnMore:** Breadth of ownership — how many unique funds hold a stock — is often more informative than depth (how much they hold). A stock being adopted by 10-20 new funds each quarter for multiple consecutive quarters experiences a "geometric expansion" in its investor base. This expanding breadth typically precedes significant price re-ratings as the stock graduates from niche to mainstream institutional coverage.

**Template text:** `Prefer stocks where the number of unique institutional holders has increased for at least {quarters} consecutive quarters`

**Params:**
```js
{
  quarters: { type: 'number', default: 2, min: 1, max: 4, step: 1, unit: '',
              label: 'Consecutive Growth Quarters',
              hint: '2 confirms a trend. 3+ is a strong geometric expansion. 1 may be noise.' }
}
```

**relatedIndicator:** null
**kbEntryId:** null
**Tags:** `['institutional', 'breadth', 'momentum', 'ownership-expansion', 'emerging']`

**agentUseDescription:** Identifies stocks with expanding institutional adoption — a growing number of unique fund holders over consecutive quarters. This "breadth momentum" often precedes significant price re-ratings as the stock moves from niche to mainstream institutional coverage. Applied as a preference during portfolio construction, particularly useful for mid-cap Rockets that are gaining institutional traction.

**Detection requirement:**
- Required signal: Historical time-series of unique holder count per stock across consecutive quarters
- Data producer: ❌ no producer found. The institutional intelligence cron writes current-quarter holder data, but there is no time-series accumulation or quarter-over-quarter delta computation.
- Data consumer: Rule text-injected; no time-series surface in the prompt
- Status: ❌ no detection path

**Sample usage:** ❌ Not included in any collection.

---

## Category 2: fundamental

### Rule 2.1 — fund-earnings-surprise

**Source location:** `src/data/forgeKnowledgeBase.js:219-240`

**Name (headline):** Bet on earnings winners
**Category:** fundamental
**Mode:** both
**Difficulty:** beginner

**Description:** Favor companies that consistently beat earnings expectations.

**learnMore:** Companies that beat earnings estimates tend to continue outperforming. A positive earnings surprise signals strong execution and sometimes conservative guidance — both bullish signs.

**Template text:** `Favor companies with positive earnings surprise in the last {quarters} quarters`

**Params:**
```js
{
  quarters: { type: 'select', default: '2',
              options: [{ value: '1', label: '1 quarter' }, { value: '2', label: '2 quarters' }, { value: '3', label: '3 quarters' }],
              label: 'Lookback quarters',
              hint: 'How many recent quarters must show positive surprise. More quarters = stronger signal but fewer matches.' }
}
```

**relatedIndicator:** Earnings Surprise
**kbEntryId:** null
**Tags:** `['earnings', 'surprise', 'momentum']`

**agentUseDescription:** Your agent will check recent earnings reports and prioritize companies that beat analyst estimates, signaling strong execution.

**Detection requirement:**
- Required signal: Quarter-by-quarter earnings beat history (boolean per quarter)
- Data producer: ❌ no producer found. Earnings beat history is not persisted in `peerRankings` or any other Firestore collection.
- Data consumer: Rule text-injected; no supporting data
- Status: ❌ no detection path

**Sample usage:** ✅ `value-investor` (legacy themed collection)

---

### Rule 2.2 — fund-revenue-growth

**Source location:** `src/data/forgeKnowledgeBase.js:241-262`

**Name (headline):** Find growing companies
**Category:** fundamental
**Mode:** both
**Difficulty:** beginner

**Description:** Prefer companies with strong revenue growth — the top line matters most.

**learnMore:** Revenue growth shows whether a company is actually expanding its business. Earnings can be managed through cost-cutting, but revenue growth is harder to fake. Companies growing revenue above 10% are typically in a healthy expansion phase.

**Template text:** `Prefer companies with revenue growth above {pct}%`

**Params:**
```js
{
  pct: { type: 'number', default: 10, min: 5, max: 30, step: 5, unit: '%',
         label: 'Minimum revenue growth',
         hint: 'Year-over-year revenue growth threshold. Growth investors use 15%+, value investors accept 5%.' }
}
```

**relatedIndicator:** Revenue Growth
**kbEntryId:** null
**Tags:** `['revenue', 'growth', 'top-line']`

**agentUseDescription:** Your agent will screen for companies with strong top-line revenue growth, filtering out stagnant businesses.

**Detection requirement:**
- Required signal: YoY revenue growth percentage per stock
- Data producer: 🟠 `api/cron/compute-rankings.js` fetches EODHD fundamentals (which include revenue figures) but does not appear to extract or persist a revenueGrowth field explicitly.
- Data consumer: Rule text-injected; no surfaced revenue-growth value
- Status: 🟠 partially detected

**Sample usage:** ✅ `value-investor` (legacy)

---

### Rule 2.3 — fund-value-pe

**Source location:** `src/data/forgeKnowledgeBase.js:263-284`

**Name (headline):** Hunt for undervalued stocks
**Category:** fundamental
**Mode:** both
**Difficulty:** beginner

**Description:** Look for stocks trading at a discount to their sector's average valuation.

**learnMore:** P/E ratio measures how much you pay per dollar of earnings. A stock with a P/E below its sector median may be undervalued — the market hasn't caught up to its true worth. Be careful though: sometimes stocks are cheap for a reason.

**Template text:** `Prefer stocks with P/E ratio below {level}`

**Params:**
```js
{
  level: { type: 'select', default: 'sector median',
           options: [{ value: 'sector median', label: 'Sector median' }, { value: '20', label: 'P/E below 20' }, { value: '15', label: 'P/E below 15 (deep value)' }],
           label: 'Valuation ceiling',
           hint: 'P/E threshold for value screening. Sector median is relative, fixed numbers are absolute targets.' }
}
```

**relatedIndicator:** P/E Ratio
**kbEntryId:** null
**Tags:** `['value', 'PE', 'valuation']`

**agentUseDescription:** Your agent will compare each stock's P/E ratio against its sector median and favor those trading at a discount.

**Detection requirement:**
- Required signal: P/E ratio per stock + sector median P/E (or absolute thresholds 15/20)
- Data producer: 🟠 P/E data is fetched from EODHD fundamentals in compute-rankings.js but is computed inline rather than persisted as a queryable field on `peerRankings`.
- Data consumer: Rule text-injected; no P/E surfaced in the institutional/fundamental prompt blocks
- Status: 🟠 partially detected

**Sample usage:** ✅ `value-investor` (legacy)

---

### Rule 2.4 — fund-bank-pb

**Source location:** `src/data/forgeKnowledgeBase.js:285-306`

**Name (headline):** Value banks the right way
**Category:** fundamental
**Mode:** both
**Difficulty:** intermediate

**Description:** Use P/B ratio instead of P/E for bank stocks — it's a better measure.

**learnMore:** Banks earn money differently than tech companies. P/E is misleading because bank earnings are heavily cyclical. P/B (price-to-book) measures the stock price against the bank's actual asset value — a much better gauge for financials.

**Template text:** `Evaluate bank stocks using P/B ratio; flag banks with P/B above {threshold} as expensive`

**Params:**
```js
{
  threshold: { type: 'number', default: 2.0, min: 1.0, max: 3.0, step: 0.5, unit: 'P/B',
               label: 'P/B expensive threshold',
               hint: 'Price-to-book level above which a bank is considered expensive. Most banks trade between 1.0-2.5x book.' }
}
```

**relatedIndicator:** P/B Ratio
**kbEntryId:** `'sector-playbook-banks'` ⚠ (the only non-null kbEntryId in the extraction scope)
**Tags:** `['banks', 'financials', 'PB', 'sector-specific']`

**agentUseDescription:** Your agent will use P/B ratio instead of P/E when evaluating bank stocks, flagging those trading above book value as expensive.

**Detection requirement:**
- Required signal: P/B ratio per bank stock + sector classification
- Data producer: ❌ no producer found. P/B is not extracted or persisted from EODHD fundamentals.
- Data consumer: Rule text-injected
- Status: ❌ no detection path

**Sample usage:** ❌ Not included in any collection.

---

### Rule 2.5 — fund-financial-health

**Source location:** `src/data/forgeKnowledgeBase.js:307-328`

**Name (headline):** Avoid fragile companies
**Category:** fundamental
**Mode:** both
**Difficulty:** beginner

**Description:** Skip companies with weak balance sheets — they crack under pressure.

**learnMore:** Financial health combines debt levels, cash flow strength, and profit margins into one picture. A company with strong financial health can weather market downturns. A weak one might not survive.

**Template text:** `Prefer companies with financial health score rated {level} or better`

**Params:**
```js
{
  level: { type: 'select', default: 'moderate',
           options: [{ value: 'strong', label: 'Strong only' }, { value: 'moderate', label: 'Moderate or better' }],
           label: 'Minimum health rating',
           hint: 'How strict the financial health filter is. Strong-only is more selective but finds the most resilient companies.' }
}
```

**relatedIndicator:** Financial Health Score
**kbEntryId:** null
**Tags:** `['health', 'balance-sheet', 'quality']`

**agentUseDescription:** Your agent will assess debt levels, cash flow, and margins to avoid companies with weak balance sheets that could crack under pressure.

**Detection requirement:**
- Required signal: Composite financial-health rating (strong / moderate / weak) per stock
- Data producer: 🟠 `api/cron/compute-rankings.js` defines a `financialHealth` ranking pillar; `api/_utils/rankingConfig.js` lists dimensions (debtToEquity, currentRatio, interestCoverage) — but the categorical "strong / moderate / weak" rating the rule expects is not explicitly persisted.
- Data consumer: Rule text-injected; the pillar score exists but the categorical rating does not
- Status: 🟠 partially detected

**Sample usage:** ✅ `value-investor` (legacy)

---

### Rule 2.6 — fund-market-cap

**Source location:** `src/data/forgeKnowledgeBase.js:329-350`

**Name (headline):** Pick your weight class
**Category:** fundamental
**Mode:** both
**Difficulty:** beginner

**Description:** Focus on company size that matches your strategy — big, medium, or small.

**learnMore:** Large caps (>$10B) are stable but move slowly. Mid caps ($2-10B) balance growth and stability. Small caps (<$2B) are volatile but can deliver explosive moves. Your choice depends on your game strategy.

**Template text:** `Prefer {size} cap stocks`

**Params:**
```js
{
  size: { type: 'select', default: 'large',
          options: [{ value: 'large', label: 'Large cap (>$10B)' }, { value: 'mid', label: 'Mid cap ($2-10B)' }, { value: 'small', label: 'Small cap (<$2B)' }],
          label: 'Market cap preference',
          hint: 'Large caps are stable, mid caps balance growth and stability, small caps are volatile but explosive.' }
}
```

**relatedIndicator:** Market Capitalization
**kbEntryId:** `'market-capitalization'` ⚠ (this rule does have a kbEntryId — disagrees with the earlier statement that all 45 except fund-bank-pb are null. Correcting: TWO rules have non-null kbEntryId — fund-bank-pb and fund-market-cap.)
**Tags:** `['market-cap', 'size', 'large-cap', 'small-cap']`

**agentUseDescription:** Your agent will filter stocks by market capitalization, focusing on the size category that best fits your risk tolerance and game strategy.

**Detection requirement:**
- Required signal: Market capitalization per stock
- Data producer: 🟠 Market cap is fetched from EODHD in compute-rankings.js but not explicitly persisted as a queryable categorical field. The agent prompt doesn't surface cap categories.
- Data consumer: Rule text-injected
- Status: 🟠 partially detected

**Sample usage:** ❌ Not included in any active Trading Style Collection. ❌ Not in any legacy collection either.

---

### Rule 2.7 — f-07

**Source location:** `src/data/forgeKnowledgeBase.js:1838-1861`
**Adjacent comment:** (no per-rule comment for f-07; section header `// F-07: Ride the earnings surprise wave` precedes it implicitly via context)

**Name (headline):** Ride the earnings surprise wave
**Category:** fundamental
**Mode:** both
**Difficulty:** intermediate
**Hook:** `Companies that keep beating expectations keep surprising the market`

**Description:** Prefer stocks that consistently beat earnings estimates by large margins.

**learnMore:** Post-Earnings Announcement Drift (PEAD) is one of the most well-documented market anomalies — stocks that beat earnings estimates tend to keep drifting in the surprise direction for weeks. This rule targets consistent big beaters, where the drift effect is strongest.

**Template text:** `Prefer stocks where earnings beat rate exceeds {beat_pct}% and surprise magnitude is in top {decile}`

**Params:**
```js
{
  beat_pct: { type: 'number', default: 75, min: 50, max: 100, step: 5, unit: '%',
              label: 'Earnings beat rate',
              hint: 'Minimum percentage of quarters the company must have beaten estimates. Higher = more consistent beaters.' },
  decile: { type: 'select', default: 'Top 20%',
            options: [{ value: 'Top 10%', label: 'Top 10% (elite)' }, { value: 'Top 20%', label: 'Top 20% (strong)' }, { value: 'Top 30%', label: 'Top 30% (moderate)' }],
            label: 'Surprise magnitude',
            hint: 'How large the earnings beats must be relative to peers. Top 10% finds the biggest upside surprises.' }
}
```

**relatedIndicator:** Earnings Beat Rate
**kbEntryId:** null
**Tags:** `['earnings', 'surprise', 'PEAD', 'momentum']`

**agentUseDescription:** Your agent will prioritize stocks with high earnings beat rates and surprise magnitudes in the specified top percentile, capturing post-earnings announcement drift.

**Detection requirement:**
- Required signal: Earnings beat rate % over historical quarters + magnitude decile across the universe
- Data producer: ❌ no producer found. Earnings beat history is not aggregated or persisted.
- Data consumer: Rule text-injected
- Status: ❌ no detection path

**Sample usage:** ❌ Not included in any collection.

---

### Rule 2.8 — f-08

**Source location:** `src/data/forgeKnowledgeBase.js:1864-1886`
**Adjacent comment:** `// F-08: Free Cash Flow Quality Filter`

**Name (headline):** Trust the cash, not the math
**Category:** fundamental
**Mode:** both
**Difficulty:** beginner
**Hook:** `Earnings can be faked with accounting tricks — cash flow can't`

**Description:** Prefer stocks with positive free cash flow — the real measure of financial health.

**learnMore:** Free cash flow is the cash a company generates after capital expenditures — it's much harder to manipulate than reported earnings. Companies with high FCF yield (FCF divided by market cap) are generating real money relative to their valuation, making them more resilient and less likely to disappoint.

**Template text:** `Prefer stocks where FCF is positive and FCF yield is in top {pct}% of universe`

**Params:**
```js
{
  pct: { type: 'number', default: 25, min: 10, max: 50, step: 5, unit: '%',
         label: 'FCF yield percentile',
         hint: 'Top percentile of FCF yield to target. Lower = more selective, finds the best cash generators.' }
}
```

**relatedIndicator:** Free Cash Flow Yield
**kbEntryId:** null
**Tags:** `['FCF', 'quality', 'cash-flow', 'resilience']`

**agentUseDescription:** Your agent will prioritize stocks with positive free cash flow and FCF yield in the top percentile of the universe, focusing on companies with genuine financial strength.

**Detection requirement:**
- Required signal: FCF yield per stock + cross-universe percentile ranking
- Data producer: ❌ no producer found. Free cash flow data is not fetched or computed in the rankings cron.
- Data consumer: Rule text-injected
- Status: ❌ no detection path

**Sample usage:** ❌ Not included in any collection.

---

### Rule 2.9 — f-09

**Source location:** `src/data/forgeKnowledgeBase.js:1889-1912`
**Adjacent comment:** `// F-09: Sector-Adjusted Leverage Safety`

**Name (headline):** Avoid over-leveraged companies
**Category:** fundamental
**Mode:** both
**Difficulty:** intermediate
**Hook:** `A bank with 1.5x debt is normal — a tech company with 1.5x debt is a red flag`

**Description:** Avoid over-leveraged companies using sector-relative debt limits.

**learnMore:** Different sectors carry different amounts of debt as standard practice — financials are naturally leveraged while tech companies typically are not. This rule compares a company's debt-to-equity against its sector average rather than an absolute number, catching truly over-leveraged companies regardless of industry.

**Template text:** `Avoid stocks where D/E exceeds {mult}x sector average. Tighten to {tight_mult}x when sentiment is bearish`

**Params:**
```js
{
  mult: { type: 'number', default: 1.25, min: 1.0, max: 2.0, step: 0.25, unit: 'x',
          label: 'Normal leverage ceiling',
          hint: 'Maximum D/E as multiple of sector average. Higher = more tolerant of leverage.' },
  tight_mult: { type: 'number', default: 1.0, min: 0.75, max: 1.25, step: 0.25, unit: 'x',
                label: 'Bearish leverage ceiling',
                hint: 'Tighter ceiling during bearish sentiment. Lower = more defensive when markets are nervous.' }
}
```

**relatedIndicator:** Debt-to-Equity Ratio
**kbEntryId:** null
**Tags:** `['leverage', 'debt', 'sector-relative', 'safety']`

**agentUseDescription:** Your agent will avoid stocks with debt-to-equity ratios exceeding the specified multiple of their sector average, tightening the threshold further during bearish sentiment.

**Detection requirement:**
- Required signal: D/E ratio per stock + sector-average D/E + current market sentiment classification
- Data producer: 🟠 D/E is fetched from EODHD fundamentals in compute-rankings.js, but a sector-average D/E rollup is not computed. Sentiment classification comes from the regime brief.
- Data consumer: Rule text-injected
- Status: 🟠 partially detected

**Sample usage:** ❌ Not included in any collection.

---

### Rule 2.10 — f-10

**Source location:** `src/data/forgeKnowledgeBase.js:1915-1937`
**Adjacent comment:** `// F-10: Sector-Specific Valuation Routing`

**Name (headline):** Use the right valuation yardstick
**Category:** fundamental
**Mode:** both
**Difficulty:** advanced
**Hook:** `You wouldn't judge a fish by how well it climbs a tree — use the right yardstick`

**Description:** Uses the right valuation metric for each sector — P/B for banks, P/S for tech, dividend yield for utilities.

**learnMore:** P/E ratios are meaningless for unprofitable growth companies. P/B is the standard for banks. P/S works best for high-growth tech. Dividend yield matters most for utilities. This rule routes each stock to the valuation metric that actually matters for its sector, then selects the cheapest stocks on the correct measure.

**Template text:** `Evaluate stocks using the metric appropriate to their sector. Prefer stocks in cheapest {pct}% on correct metric`

**Params:**
```js
{
  pct: { type: 'number', default: 40, min: 20, max: 60, step: 10, unit: '%',
         label: 'Value percentile',
         hint: 'Prefer stocks in cheapest X% on their sector-appropriate metric. Lower = stricter value filter.' }
}
```

**relatedIndicator:** P/E, P/B, P/S, Dividend Yield
**kbEntryId:** null
**Tags:** `['valuation', 'sector-specific', 'P/B', 'P/S', 'dividend']`

**agentUseDescription:** Your agent will evaluate each stock using the valuation metric most appropriate for its sector and prefer stocks ranking in the cheapest percentile on that metric.

**Detection requirement:**
- Required signal: Sector-specific valuation metric values (P/B for financials, P/S for tech, etc.) + sector-relative percentile rankings
- Data producer: 🟠 EODHD fundamentals are fetched but per-sector valuation routing logic is not implemented.
- Data consumer: Rule text-injected
- Status: 🟠 partially detected

**Sample usage:** ❌ Not included in any collection.

---

### Rule 2.11 — f-11

**Source location:** `src/data/forgeKnowledgeBase.js:1940-1962`
**Adjacent comment:** `// F-11: Revenue Growth Acceleration`

**Name (headline):** Chase accelerating growth
**Category:** fundamental
**Mode:** both
**Difficulty:** intermediate
**Hook:** `Acceleration beats speed — growing 10% after 8% is better than 15% after 20%`

**Description:** Prefer stocks where the growth rate is accelerating, not just high.

**learnMore:** A company growing revenue at 10% after growing at 8% last quarter is accelerating — the trend is improving. A company growing at 15% after 20% is decelerating — the trend is worsening. Markets reward acceleration because it signals improving business conditions and often leads to upward estimate revisions.

**Template text:** `Prefer stocks where current revenue growth rate is at least {bps} basis points higher than previous quarter`

**Params:**
```js
{
  bps: { type: 'number', default: 200, min: 50, max: 500, step: 50, unit: 'bps',
         label: 'Acceleration threshold',
         hint: 'Basis points of revenue growth acceleration required. Higher = only the strongest accelerators.' }
}
```

**relatedIndicator:** Revenue Growth Rate
**kbEntryId:** null
**Tags:** `['revenue', 'acceleration', 'growth', 'second-derivative']`

**agentUseDescription:** Your agent will prefer stocks showing revenue growth acceleration — where the current quarter's growth rate exceeds the previous quarter's by the specified number of basis points.

**Detection requirement:**
- Required signal: Current-quarter and prior-quarter revenue growth %, then delta in basis points
- Data producer: ❌ no producer found. Revenue growth quarter-over-quarter delta is not computed or persisted.
- Data consumer: Rule text-injected
- Status: ❌ no detection path

**Sample usage:** ❌ Not included in any collection.

---

### Rule 2.12 — f-12

**Source location:** `src/data/forgeKnowledgeBase.js:1965-1987`
**Adjacent comment:** `// F-12: Analyst Revision Momentum`

**Name (headline):** Follow the analyst upgrades
**Category:** fundamental
**Mode:** both
**Difficulty:** beginner
**Hook:** `When Wall Street upgrades in unison, they know something the market hasn't priced in`

**Description:** Prefer stocks where analyst consensus has improved recently.

**learnMore:** Analyst estimate revisions are one of the strongest predictors of near-term stock performance. When multiple analysts simultaneously raise their estimates, they're responding to new information the market hasn't fully priced. This rule captures the revision momentum signal before the broader market catches up.

**Template text:** `Prefer stocks where analyst consensus has improved over past {days} days. Avoid deteriorating consensus`

**Params:**
```js
{
  days: { type: 'number', default: 30, min: 14, max: 60, step: 7, unit: 'days',
          label: 'Revision lookback',
          hint: 'How far back to check for analyst consensus changes. Shorter = more responsive to recent upgrades.' }
}
```

**relatedIndicator:** Analyst Consensus Rating
**kbEntryId:** null
**Tags:** `['analyst', 'revision', 'consensus', 'institutional']`

**agentUseDescription:** Your agent will prefer stocks with improving analyst consensus over the specified period and avoid stocks where consensus is deteriorating.

**Detection requirement:**
- Required signal: Analyst consensus rating + historical revisions per stock
- Data producer: ❌ no producer found. Analyst consensus tracking is not implemented anywhere in the codebase.
- Data consumer: Rule text-injected
- Status: ❌ no detection path

**Sample usage:** ❌ Not included in any collection.

---

### Rule 2.13 — f-13

**Source location:** `src/data/forgeKnowledgeBase.js:1990-2014`
**Adjacent comment:** `// F-13: Earnings Calendar Risk Management`

**Name (headline):** Manage earnings week risk
**Category:** fundamental
**Mode:** both
**Difficulty:** intermediate
**Hook:** `Earnings week is like a coin flip on steroids`

**Description:** Adjusts selection priority based on proximity to earnings dates.

**learnMore:** Earnings announcements create massive gap risk — stocks can jump or drop 10%+ overnight. This rule lets you control how your agent handles stocks approaching their earnings date. The default is to reduce priority (avoid the coin flip), but you can override for stocks with high historical beat rates.

**Template text:** `Within {days} days of earnings, {action} selection priority. Override if beat rate above {beat_pct}%`

**Params:**
```js
{
  days: { type: 'number', default: 3, min: 1, max: 7, step: 1, unit: 'days',
          label: 'Earnings proximity window',
          hint: 'Days before earnings to adjust priority. Larger window = earlier positioning.' },
  action: { type: 'select', default: 'decrease',
            options: [{ value: 'decrease', label: 'Decrease priority (avoid)' }, { value: 'increase', label: 'Increase priority (lean in)' }, { value: 'neutral', label: 'Neutral (ignore)' }],
            label: 'Default earnings action',
            hint: 'How to handle stocks approaching earnings. Decrease avoids the gap risk, increase bets on the report.' },
  beat_pct: { type: 'number', default: 80, min: 60, max: 100, step: 5, unit: '%',
              label: 'Override beat rate',
              hint: 'Beat rate above which the default action is overridden. Only relevant if default is decrease.' }
}
```

**relatedIndicator:** Earnings Calendar
**kbEntryId:** null
**Tags:** `['earnings', 'calendar', 'gap-risk', 'timing']`

**agentUseDescription:** Your agent will adjust selection priority for stocks approaching earnings dates based on the specified action, with an override for stocks exceeding the beat rate threshold.

**Detection requirement:**
- Required signal: Days-to-earnings per stock + historical earnings beat rate %
- Data producer: 🟠 The earnings ingestion pipeline (`api/cron/ingest-earnings.js`, FantasyTimes earnings reports) writes earnings event data, and `api/_utils/rankingConfig.js` mentions `lastEarningsDate` (referenced as TODO in `compute-index-intelligence.js:122`), but the days-to-earnings and beat-rate fields the rule expects are not persisted as queryable agent-side data.
- Data consumer: Rule text-injected
- Status: 🟠 partially detected

**Sample usage:** ❌ Not included in any collection.

---

### Rule 2.14 — tv-10

**Source location:** `src/data/forgeKnowledgeBase.js:2606-2633`
**Adjacent comment:** `// TV-10: Earnings + Technical Confluence`

**Name (headline):** Earnings + Technical Confluence
**Category:** fundamental
**Mode:** both
**Difficulty:** beginner
**Hook:** `Great earnings AND great technicals? That's the market saying "this stock deserves to be here" — double conviction`

**Description:** Stocks with both strong earnings history AND bullish technicals have dual confirmation. Fundamental quality backs the technical momentum.

**learnMore:** The strongest stock picks have both fundamental quality and technical momentum. A stock with great earnings but weak technicals may be a value trap — the market knows something the numbers don't show. A stock with strong technicals but weak fundamentals may be a speculative bubble. When both signals agree, you have dual confirmation that the stock's price action is backed by real business performance.

**Template text:** `Prefer stocks where the fundamental composite score is above {fund_score} AND the daily technical score is above {tech_score}. Stocks meeting both criteria are eligible for {tier} tier. Stocks meeting only one are restricted to Core or below`

**Params:**
```js
{
  fund_score: { type: 'number', default: 65, min: 40, max: 85, step: 5, unit: '/100',
                label: 'Min fundamental score', hint: 'From peerRankings composite' },
  tech_score: { type: 'number', default: 60, min: 40, max: 80, step: 5, unit: '/100',
                label: 'Min technical score', hint: 'From stockTechnicalScores composite' },
  tier: { type: 'select', default: 'Star',
          options: [{ value: 'Star', label: 'Star eligible' }, { value: 'Core', label: 'Core max' }],
          label: 'Dual-confirm tier', hint: 'What tier can dual-confirmed stocks reach' }
}
```

**relatedIndicator:** null
**kbEntryId:** null
**Tags:** `['earnings', 'technical', 'confluence', 'dual-confirmation', 'tradingview']`

**agentUseDescription:** Your agent will require both strong fundamentals and strong technicals for Star tier eligibility, restricting single-signal stocks to Core or below.

**Detection requirement:**
- Required signal: Composite fundamental score from `peerRankings` + composite technical score from `stockTechnicalScores`
- Data producer: `api/cron/compute-rankings.js` writes peerRankings; `api/_utils/buildTechnicalSnapshot.js` reads stockTechnicalScores
- Data consumer: `api/_utils/agentEvalPromptAssembly.js` (peerRankings + technical snapshot rendered into prompt; Haiku evaluates the rule)
- Status: ✅ detected today

**Sample usage:** ✅ `rs-leader` (Trading Style Collection)

---

## Category 3: tier_strategy

### Rule 3.1 — ts-01

**Source location:** `src/data/forgeKnowledgeBase.js:1397-1420`
**Adjacent comment:** `// TS-01: Volatility-Adjusted Star Cap`

**Name (headline):** Keep wild stocks out of Star
**Category:** tier_strategy
**Mode:** clash
**Difficulty:** intermediate
**Hook:** `The 2x multiplier doubles everything — including losses. Keep wild stocks out of Star`

**Description:** Prevents Star tier from being assigned to erratic, high-volatility stocks.

**learnMore:** The Star tier's 2x multiplier is a double-edged sword — it amplifies gains but also losses. When a stock's intraday ATR spikes well beyond its historical average, it's behaving erratically. This rule caps the maximum tier for such stocks, keeping the powerful multiplier away from unpredictable movers.

**Template text:** `If a stock's current intraday ATR exceeds {pct}% of its 14-day average ATR, restrict its maximum tier to {tier}`

**Params:**
```js
{
  pct: { type: 'number', default: 200, min: 150, max: 300, step: 25, unit: '%',
         label: 'Volatility spike threshold',
         hint: 'Current ATR as % of 14-day average that triggers tier restriction. Lower = more sensitive to volatility spikes.' },
  tier: { type: 'select', default: 'Support',
          options: [{ value: 'Support', label: 'Support (safest)' }, { value: 'Core', label: 'Core (moderate)' }],
          label: 'Maximum tier for volatile stocks',
          hint: 'What tier to restrict erratic stocks to. Support removes the multiplier entirely.' }
}
```

**relatedIndicator:** ATR (Average True Range)
**kbEntryId:** null
**Tags:** `['tier', 'volatility', 'star-cap', 'risk-reduction']`

**agentUseDescription:** Your agent will compare each stock's current intraday ATR to its 14-day average and restrict the maximum tier assignment for stocks whose volatility exceeds the specified threshold.

**Detection requirement:**
- Required signal: Current intraday ATR + 14-day average ATR
- Data producer: `api/_utils/buildTechnicalSnapshot.js:60-64` (atrPercent from stockTechnicalScores.volatility.atrPercent)
- Data consumer: `api/cron/agent-evaluate.js` passes momentumData to Haiku; rule text-injected to prompt
- Status: ✅ detected today

**Sample usage:** ✅ `baggerbomb-native` (Trading Style); ✅ `tier-master` (legacy)

---

### Rule 3.2 — ts-02

**Source location:** `src/data/forgeKnowledgeBase.js:1423-1446`
**Adjacent comment:** `// TS-02: Multi-Timeframe Conviction Gate`

**Name (headline):** Require multi-timeframe agreement
**Category:** tier_strategy
**Mode:** clash
**Difficulty:** advanced
**Hook:** `True conviction means every timeframe agrees — if daily and intraday diverge, demote`

**Description:** Star tier requires both daily trend AND intraday momentum to be bullish.

**learnMore:** A stock can look great on the daily chart but be falling apart intraday, or vice versa. This rule requires both the Daily Technical Score and intraday VWAP position to be bullish before Star tier is allowed. If either timeframe breaks down, the stock is demoted — true conviction demands agreement across timeframes.

**Template text:** `A stock is only eligible for Star tier if its Daily Technical Score is above {score} AND price is above daily VWAP. If either breaks, demote to {tier}`

**Params:**
```js
{
  score: { type: 'number', default: 70, min: 50, max: 90, step: 5, unit: '/100',
           label: 'Technical score minimum',
           hint: 'Daily Technical Score required for Star eligibility. Higher = stricter quality gate.' },
  tier: { type: 'select', default: 'Support',
          options: [{ value: 'Support', label: 'Support (strict)' }, { value: 'Core', label: 'Core (moderate)' }],
          label: 'Demotion tier',
          hint: 'Where to demote when conviction breaks. Support removes the multiplier entirely.' }
}
```

**relatedIndicator:** VWAP / Daily Technical Score
**kbEntryId:** null
**Tags:** `['tier', 'multi-timeframe', 'VWAP', 'conviction']`

**agentUseDescription:** Your agent will only assign Star tier to stocks where both the Daily Technical Score exceeds the threshold and price is above VWAP, demoting immediately if either condition breaks.

**Detection requirement:**
- Required signal: Daily Technical Score + intraday VWAP position
- Data producer: `api/cron/compute-rankings.js` (technicalScore) + `api/_utils/technicalCalculations.js:calculateVWAP()`
- Data consumer: `api/_utils/agentEvalPromptAssembly.js:buildBenchTechnicalBlock()` (VWAP in bench context); Haiku evaluates
- Status: ✅ detected today

**Sample usage:** ✅ `trend-surfer`, ✅ `squeeze-hunter` (Trading Style)

---

### Rule 3.3 — ts-03

**Source location:** `src/data/forgeKnowledgeBase.js:1449-1471`
**Adjacent comment:** `// TS-03: Free-Ride Threshold Holder`

**Name (headline):** Park stalled threshold plays in Support
**Category:** tier_strategy
**Mode:** clash
**Difficulty:** advanced
**Hook:** `Threshold bonuses don't care about the multiplier — park stalled stocks in Support and give Star to something moving`

**Description:** Stocks near a threshold with stalled momentum are restricted to Support — the bonus is the same regardless of tier.

**learnMore:** Threshold bonuses are flat point amounts — they don't get multiplied by tier. So a stock sitting near a threshold with neutral momentum (RSI 40-60) doesn't benefit from being in Star or Core. This rule parks those stocks in Support, freeing the multiplier tiers for stocks with real directional momentum.

**Template text:** `If a stock is within {atr} ATR of a positive threshold but its 5-minute RSI is between 40 and 60, restrict to Support tier`

**Params:**
```js
{
  atr: { type: 'number', default: 0.2, min: 0.1, max: 0.4, step: 0.1, unit: 'ATR',
         label: 'Threshold proximity',
         hint: 'ATR distance to threshold that defines "near." Wider = more stocks get parked in Support.' }
}
```

**relatedIndicator:** RSI (5-minute) / ATR
**kbEntryId:** null
**Tags:** `['tier', 'threshold', 'free-ride', 'scoring-asymmetry']`

**agentUseDescription:** Your agent will restrict stocks to Support tier when they are near a positive threshold but showing neutral RSI momentum, preserving multiplier tiers for stocks with directional movement.

**Detection requirement:**
- Required signal: 5-min RSI per stock + ATR proximity to positive thresholds
- Data producer: `api/_utils/agentRiskManager.js:60-72` (atrMultiplier + 0.2x ATR proximity LOCK check); 5-min RSI from `api/_utils/technicalCalculations.js:calculateRSI()`
- Data consumer: `api/cron/agent-evaluate.js` (evaluateRisk called every eval; risk status + RSI passed to Haiku)
- Status: ✅ detected today

**Sample usage:** ❌ Not included in any collection.

---

### Rule 3.4 — ts-04

**Source location:** `src/data/forgeKnowledgeBase.js:1474-1497`
**Adjacent comment:** `// TS-04: Performance-Based Tier Rotation`

**Name (headline):** Star goes to the hottest stock
**Category:** tier_strategy
**Mode:** clash
**Difficulty:** intermediate
**Hook:** `Star tier should go to your hottest stock right now — not the one you liked best this morning`

**Description:** Dynamically promotes the highest-velocity stock to Star — the multiplier is earned, not assumed.

**learnMore:** Your pre-market Star pick may not be the best performer once trading begins. This rule compares P&L velocity across all stocks at regular intervals and promotes the hottest mover to Star. The 2x multiplier is earned through performance, not assumed from overnight analysis.

**Template text:** `Every {interval} minutes, compare P&L velocity. If a Core or Support stock outperforms Star over the last {cycles} cycles, swap their tiers`

**Params:**
```js
{
  interval: { type: 'number', default: 30, min: 15, max: 60, step: 15, unit: 'min',
              label: 'Review interval',
              hint: 'How often to compare P&L velocity across stocks. Faster = more responsive to momentum shifts.' },
  cycles: { type: 'number', default: 2, min: 1, max: 4, step: 1, unit: '',
            label: 'Outperformance cycles',
            hint: 'Consecutive cycles a stock must outperform Star before promotion. Higher = more conviction required.' }
}
```

**relatedIndicator:** null
**kbEntryId:** null
**Tags:** `['tier', 'rotation', 'performance', 'meritocracy']`

**agentUseDescription:** Your agent will compare P&L velocity across all stocks at regular intervals and swap tier assignments when a lower-tier stock consistently outperforms the current Star.

**Detection requirement:**
- Required signal: P&L velocity per stock across evaluation cycles
- Data producer: 🟠 `api/_utils/agentScoring.js:calculateAssetScoreServer()` computes priceChange per stock; consecutive-evaluation velocity tracking is implicit in the evaluation history rather than persisted as a single field.
- Data consumer: `api/cron/agent-evaluate.js:evaluateRisk()` + portfolio CSV shows P&L; Haiku reasons over it
- Status: 🟠 partially detected

**Sample usage:** ✅ `swing-trader`, ✅ `momentum-rider`, ✅ `rs-leader` (Trading Style); ✅ `tier-master` (legacy)

---

### Rule 3.5 — ts-05

**Source location:** `src/data/forgeKnowledgeBase.js:1500-1522`
**Adjacent comment:** `// TS-05: Post-Threshold Exhaustion Scale-Out`

**Name (headline):** Demote tired Star stocks after a bonus
**Category:** tier_strategy
**Mode:** clash
**Difficulty:** intermediate
**Hook:** `Your Star stock earned a bonus but looks tired — demote before the reversal eats your 2x gains`

**Description:** After a Star stock hits a bonus AND shows overbought signals, demotes it to lock in multiplied gains.

**learnMore:** When a Star stock triggers a threshold bonus and simultaneously shows overbought RSI, it may be exhausted. Keeping it in Star means the 2x multiplier will amplify the likely pullback. This rule demotes to Support and promotes the strongest Core stock, capturing the bonus while protecting against a reversal.

**Template text:** `When a Star tier stock triggers a positive threshold AND its 5-minute RSI exceeds {rsi}, demote to Support and promote the Core stock with highest MACD trajectory`

**Params:**
```js
{
  rsi: { type: 'number', default: 75, min: 65, max: 85, step: 5, unit: 'RSI',
         label: 'Overbought RSI trigger',
         hint: 'RSI level that signals exhaustion after a bonus hit. Lower = more aggressive about demoting tired winners.' }
}
```

**relatedIndicator:** RSI (5-minute) / MACD
**kbEntryId:** null
**Tags:** `['tier', 'exhaustion', 'scale-out', 'profit-taking']`

**agentUseDescription:** Your agent will demote Star stocks to Support after they trigger a threshold bonus while showing overbought RSI, promoting the strongest Core stock to Star to protect multiplied gains.

**Detection requirement:**
- Required signal: 5-min RSI + MACD histogram + threshold-hit event per stock
- Data producer: `api/_utils/technicalCalculations.js:calculateRSI()`, `calculateMACD()`; `api/_utils/buildTechnicalSnapshot.js:48-55` (rsi, macdHistogram). Threshold-hit event tracking is implicit in score history.
- Data consumer: snapshot rendered into Haiku prompt; Haiku evaluates trigger conditions
- Status: ✅ detected today

**Sample usage:** ✅ `tier-master` (legacy only)

---

### Rule 3.6 — ts-06

**Source location:** `src/data/forgeKnowledgeBase.js:1525-1548`
**Adjacent comment:** `// TS-06: Stagnation Demotion`

**Name (headline):** Don't waste Star on a flatline
**Category:** tier_strategy
**Mode:** clash
**Difficulty:** beginner
**Hook:** `A 2x multiplier on zero movement is still zero — move the Star to something actually trading`

**Description:** Strips the Star multiplier from stocks that have flatlined — the 2x is wasted on a stock that isn't moving.

**learnMore:** The Star multiplier only matters if the stock is moving. A flatlined stock in Star tier is wasting the most powerful tool in your arsenal. This rule detects stagnation over consecutive evaluation cycles and demotes the stock, promoting the most active alternative to capture the multiplier's potential.

**Template text:** `If a Star stock's price changes less than {pct}% over {cycles} consecutive evaluation cycles, demote to Support`

**Params:**
```js
{
  pct: { type: 'number', default: 0.1, min: 0.05, max: 0.3, step: 0.05, unit: '%',
         label: 'Stagnation threshold',
         hint: 'Maximum price change that counts as flat. Lower = stricter definition of stagnation.' },
  cycles: { type: 'number', default: 3, min: 2, max: 5, step: 1, unit: '',
            label: 'Stagnation cycles',
            hint: 'Consecutive flat cycles before demotion. Lower = faster response to dead multiplier.' }
}
```

**relatedIndicator:** null
**kbEntryId:** null
**Tags:** `['tier', 'stagnation', 'dead-multiplier', 'rotation']`

**agentUseDescription:** Your agent will monitor Star stock price movement across evaluation cycles and demote to Support if the stock flatlines, promoting the most active stock to Star.

**Detection requirement:**
- Required signal: Price change % per stock across N consecutive evaluation cycles
- Data producer: 🟠 `api/_utils/agentScoring.js` computes per-stock priceChange; consecutive-cycle history is in evaluations array but no explicit "stagnation count" field
- Data consumer: Haiku reasons from evaluation history; not deterministically enforced in code
- Status: 🟠 partially detected

**Sample usage:** ❌ Not included in any collection.

---

### Rule 3.7 — ts-07

**Source location:** `src/data/forgeKnowledgeBase.js:1551-1573`
**Adjacent comment:** `// TS-07: Penalty Shielding Demotion`

**Name (headline):** Demote before the penalty hits
**Category:** tier_strategy
**Mode:** clash
**Difficulty:** beginner
**Hook:** `The penalty is the same in any tier, but the damage on the way down is halved in Support — demote before it hurts`

**Description:** When a Star/Core stock approaches a negative threshold, demotes to Support to halve the continuous P&L bleed.

**learnMore:** Negative threshold penalties are flat point deductions regardless of tier, but the continuous P&L bleed on the way down IS multiplied. By demoting to Support before a stock reaches a penalty threshold, you halve the damage from the decline while the penalty itself stays the same. Re-promotion requires the stock to recover significantly.

**Template text:** `When any Star or Core stock comes within {atr} ATR of a negative threshold, demote to Support. Re-promotion requires moving {recovery} ATR away`

**Params:**
```js
{
  atr: { type: 'number', default: 0.3, min: 0.1, max: 0.5, step: 0.1, unit: 'ATR',
         label: 'Demotion trigger distance',
         hint: 'ATR distance to negative threshold that triggers tier demotion. Lower = earlier protection.' },
  recovery: { type: 'number', default: 0.5, min: 0.3, max: 0.8, step: 0.1, unit: 'ATR',
              label: 'Recovery distance for re-promotion',
              hint: 'ATR distance away from threshold needed to restore tier. Higher = prevents dead cat bounce re-promotion.' }
}
```

**relatedIndicator:** ATR (Average True Range)
**kbEntryId:** null
**Tags:** `['tier', 'penalty', 'shielding', 'demotion', 'meltdown-guard']`

**agentUseDescription:** Your agent will demote Star or Core stocks to Support when they approach negative thresholds, halving the multiplied P&L bleed. Re-promotion requires the stock to move the specified ATR distance away from the threshold.

**Detection requirement:**
- Required signal: ATR proximity to negative thresholds (-1.0x / -1.5x / -2.0x ATR)
- Data producer: `api/_utils/agentRiskManager.js:40-49` (atrMultiplier computed; bust check at bustBuffer = -0.85x ATR)
- Data consumer: `api/cron/agent-evaluate.js:evaluateRisk()` returns risk action; Haiku also sees the value in the prompt
- Status: ✅ detected today

**Sample usage:** ✅ `defensive-fortress`, ✅ `oversold-sniper`, ✅ `baggerbomb-native` (Trading Style); ✅ `tier-master` (legacy)

---

### Rule 3.8 — ts-08

**Source location:** `src/data/forgeKnowledgeBase.js:1576-1599`
**Adjacent comment:** `// TS-08: Thesis Drift Sentinel`

**Name (headline):** Catch the hidden divergence
**Category:** tier_strategy
**Mode:** clash
**Difficulty:** advanced
**Hook:** `When the speedometer drops but the car keeps climbing, the hill is about to win`

**Description:** Demotes a stock when price and momentum diverge — new highs with fading MACD is a warning sign.

**learnMore:** Bearish divergence — price making new highs while MACD histogram declines — is one of the most reliable reversal warnings in technical analysis. For a Star stock, this divergence is especially dangerous because the 2x multiplier will amplify the coming reversal. This rule catches the divergence early and demotes before the damage is done.

**Template text:** `If a Star stock's price makes a new intraday high but its 5-minute MACD histogram is declining, demote to {tier}`

**Params:**
```js
{
  tier: { type: 'select', default: 'Core',
          options: [{ value: 'Core', label: 'Core (moderate demotion)' }, { value: 'Support', label: 'Support (full demotion)' }],
          label: 'Divergence demotion tier',
          hint: 'Where to send a Star stock showing bearish divergence. Support removes the multiplier entirely.' }
}
```

**relatedIndicator:** MACD (5-minute)
**kbEntryId:** null
**Tags:** `['tier', 'divergence', 'thesis-drift', 'MACD']`

**agentUseDescription:** Your agent will monitor for bearish divergence between price and MACD histogram on Star stocks, demoting immediately when price makes a new high but MACD histogram is declining.

**Detection requirement:**
- Required signal: Intraday new-high event + 5-min MACD histogram trajectory
- Data producer: 🟠 5-min MACD histogram available via `stockTechnicalScores`; intraday new-high tracking is not explicitly persisted per evaluation
- Data consumer: Haiku reasons over MACD snapshot; divergence detection is LLM-side
- Status: 🟠 partially detected

**Sample usage:** ❌ Not included in any collection.

---

### Rule 3.9 — ts-09

**Source location:** `src/data/forgeKnowledgeBase.js:1602-1625`
**Adjacent comment:** `// TS-09: Early-Session Discovery Cap`

**Name (headline):** Cap tiers during the morning open
**Category:** tier_strategy
**Mode:** clash
**Difficulty:** beginner
**Hook:** `The morning open is a guessing game — don't let 2x amplify a wrong guess`

**Description:** Restricts the Star tier during the first 30-45 minutes to prevent morning whipsaw at 2x.

**learnMore:** The first 30-45 minutes of trading are the most volatile and unpredictable period of the day. Assigning Star tier during this window means amplifying the noise at 2x. This rule caps all stocks at a lower tier during the discovery period, then promotes the top performer to Star once the dust settles.

**Template text:** `During the first {minutes} minutes of EARLY phase, restrict maximum tier to {tier}. Promote top performer to Star after`

**Params:**
```js
{
  minutes: { type: 'number', default: 45, min: 15, max: 60, step: 15, unit: 'min',
             label: 'Discovery period',
             hint: 'How long to restrict Star tier at the open. Longer = more data before committing the 2x multiplier.' },
  tier: { type: 'select', default: 'Core',
          options: [{ value: 'Core', label: 'Core (moderate cap)' }, { value: 'Support', label: 'Support (strict cap)' }],
          label: 'Morning max tier',
          hint: 'Maximum tier during the discovery period. Core still provides some multiplier benefit.' }
}
```

**relatedIndicator:** null
**kbEntryId:** null
**Tags:** `['tier', 'early-session', 'discovery', 'morning-cap']`

**agentUseDescription:** Your agent will restrict the maximum tier during the first minutes of the EARLY phase, then promote the top-performing stock to Star once the restriction period ends.

**Detection requirement:**
- Required signal: Minutes into trading day / phase position (EARLY phase + minutes within it)
- Data producer: `api/_utils/agentEvalPromptAssembly.js:786-819` (computeBattlePhase, getCurrentTradingDayServer, computeTimeRemaining)
- Data consumer: `api/_utils/agentEvalPromptAssembly.js:649-656` (phase rendered into live context block)
- Status: ✅ detected today

**Sample usage:** ✅ `defensive-fortress` (Trading Style); ✅ `tier-master` (legacy)

---

### Rule 3.10 — tv-12

**Source location:** `src/data/forgeKnowledgeBase.js:2662-2687`
**Adjacent comment:** `// TV-12: Multi-Factor Tier Assignment`

**Name (headline):** Multi-Factor Tier Assignment
**Category:** tier_strategy
**Mode:** clash
**Difficulty:** intermediate
**Hook:** `One green light is a suggestion. Three green lights is conviction — let the evidence decide your tier`

**Description:** Assigns tiers based on how many independent signals agree. More confirmations = higher tier. Stocks that only pass one check get the lowest tier.

**learnMore:** Alexander Elder's Triple Screen system and the MACD+RSI+Volume "Trinity" are among the most recommended indicator combinations on TradingView. The insight: no single indicator is reliable alone, but when three independent signals agree, the probability of a winning trade increases dramatically. This rule checks three factors — daily technical score, RSI momentum zone, and volume — and assigns tiers based on how many pass.

**Template text:** `Check each stock against three factors: (1) Daily technical score above {tech}, (2) RSI in momentum zone {rsi_low}-{rsi_high}, (3) Volume above {vol}x average. Assign Star to stocks passing all 3. Core to stocks passing 2. Support to stocks passing 1 or 0`

**Params:**
```js
{
  tech: { type: 'number', default: 60, min: 40, max: 80, step: 5, unit: '/100',
          label: 'Technical threshold', hint: 'Daily composite score requirement' },
  rsi_low: { type: 'number', default: 45, min: 30, max: 55, step: 5, unit: '',
             label: 'RSI floor', hint: 'Bottom of the momentum zone' },
  rsi_high: { type: 'number', default: 70, min: 60, max: 80, step: 5, unit: '',
              label: 'RSI ceiling', hint: 'Top of the momentum zone' },
  vol: { type: 'number', default: 1.2, min: 1.0, max: 2.0, step: 0.1, unit: 'x',
         label: 'Volume multiplier', hint: 'Volume vs 20-day average' }
}
```

**relatedIndicator:** null
**kbEntryId:** null
**Tags:** `['multi-factor', 'tier', 'trinity', 'triple-screen', 'confirmation', 'tradingview']`

**agentUseDescription:** Your agent will assign tiers based on how many of three independent factors each stock passes — daily technical score, RSI momentum zone, and volume confirmation.

**Detection requirement:**
- Required signal: Daily technical score + RSI value + volume vs 20-day average
- Data producer: `api/cron/compute-rankings.js` (technicalScore) + `api/_utils/technicalCalculations.js` (RSI) + `api/_utils/buildTechnicalSnapshot.js:66` (volumeProfile.ratio)
- Data consumer: `api/_utils/agentEvalPromptAssembly.js:buildBenchTechnicalBlock()` (volume, RSI, tech score rendered); Haiku evaluates
- Status: ✅ detected today

**Sample usage:** ✅ `triple-threat` (Trading Style)

---

## Category 4: game_state

### Rule 4.1 — gs-01

**Source location:** `src/data/forgeKnowledgeBase.js:926-948`
**Adjacent comment:** `// GS-01: Early Phase Bench Preservation`

**Name (headline):** Survive the opening chaos
**Category:** game_state
**Mode:** clash
**Difficulty:** beginner
**Hook:** `The morning is chaos — survive the noise before making moves`

**Description:** Restricts offensive swaps in the EARLY phase — agent trusts its initial portfolio.

**learnMore:** The first phase of a trading day is dominated by volatile opening prints and erratic price swings. Most of these moves reverse within minutes. This rule tells your agent to trust its initial picks and avoid knee-jerk swaps during the EARLY phase, unless a stock is in serious trouble.

**Template text:** `In the EARLY phase, disable swap evaluations unless a stock drops below {atr} ATR`

**Params:**
```js
{
  atr: { type: 'number', default: -1.0, min: -1.5, max: -0.5, step: 0.1, unit: 'ATR',
         label: 'Emergency swap threshold',
         hint: 'ATR drop that overrides the early-phase hold. More negative = more patience in the opening.' }
}
```

**relatedIndicator:** ATR (Average True Range)
**kbEntryId:** null
**Tags:** `['phase', 'early', 'preservation', 'patience']`

**agentUseDescription:** Your agent will disable swap evaluations during the EARLY phase, only allowing swaps if a stock drops below the specified ATR threshold — preserving your initial portfolio through the noisy opening.

**Detection requirement:**
- Required signal: Current battle phase (EARLY/MID/LATE/FINAL_HOUR) + ATR P&L per stock
- Data producer: `api/_utils/agentEvalPromptAssembly.js:786-819` (computeBattlePhase); ATR from `api/_utils/agentScoring.js`
- Data consumer: `api/_utils/agentEvalPromptAssembly.js:649-656` (phase + ATR in live context); Haiku evaluates
- Status: ✅ detected today

**Sample usage:** ✅ `game-clock-plays` (legacy only)

---

### Rule 4.2 — gs-02

**Source location:** `src/data/forgeKnowledgeBase.js:951-975`
**Adjacent comment:** `// GS-02: Phase-Scaled Risk Tolerance`

**Name (headline):** Scale risk by time of day
**Category:** game_state
**Mode:** clash
**Difficulty:** advanced
**Hook:** `Morning volatility needs a wide leash, but final hour needs a tight one`

**Description:** Widens or tightens stop-loss thresholds based on the current time phase.

**learnMore:** Volatility is not constant throughout the day — it spikes at the open, settles midday, and surges again at the close. This rule adjusts stop-loss thresholds by phase so your agent gives stocks more room to breathe in the volatile morning and tightens up as the day ends and every point counts.

**Template text:** `Scale ATR-based stop thresholds by phase: EARLY {early}x, MID {mid}x, LATE {late}x, FINAL_HOUR {final}x`

**Params:**
```js
{
  early: { type: 'number', default: 2.0, min: 1.5, max: 3.0, step: 0.5, unit: 'x',
           label: 'EARLY phase multiplier',
           hint: 'Stop-loss multiplier during volatile opening. Higher = more room to breathe.' },
  mid: { type: 'number', default: 1.5, min: 1.0, max: 2.0, step: 0.5, unit: 'x',
         label: 'MID phase multiplier',
         hint: 'Stop-loss multiplier during midday. Moderate room as volatility settles.' },
  late: { type: 'number', default: 1.2, min: 1.0, max: 1.5, step: 0.1, unit: 'x',
          label: 'LATE phase multiplier',
          hint: 'Stop-loss multiplier as day progresses. Tighter to protect gains.' },
  final: { type: 'number', default: 1.0, min: 0.5, max: 1.5, step: 0.1, unit: 'x',
           label: 'FINAL_HOUR multiplier',
           hint: 'Stop-loss multiplier in the last hour. Tightest to lock in the final score.' }
}
```

**relatedIndicator:** ATR (Average True Range)
**kbEntryId:** null
**Tags:** `['phase', 'risk-scaling', 'stop-loss', 'time-aware']`

**agentUseDescription:** Your agent will multiply ATR-based stop thresholds by phase-specific scaling factors, giving stocks more breathing room early in the day and tightening stops as the battle progresses.

**Detection requirement:**
- Required signal: Current phase + ATR
- Data producer: phase from agentEvalPromptAssembly.js:786-819; ATR from agentScoring.js
- Data consumer: 🟠 Phase-scaling logic is NOT deterministically applied in code (e.g., `agentRiskManager.js` uses fixed -0.85x bust buffer regardless of phase). The rule text is injected to Haiku, but the engine itself doesn't scale by phase.
- Status: 🟠 partially detected (primitives exist; scaling enforcement does not)

**Sample usage:** ✅ `game-clock-plays` (legacy only)

---

### Rule 4.3 — gs-03

**Source location:** `src/data/forgeKnowledgeBase.js:980-1000`
**Adjacent comment:** `// GS-03: Bench Optionality Time Decay`

**Name (headline):** Use the bench before it expires
**Category:** game_state
**Mode:** clash
**Difficulty:** intermediate
**Hook:** `An unused bench at the closing bell is a wasted resource`

**Description:** Makes swaps easier to justify as the day progresses.

**learnMore:** Your bench stocks are like options — they lose value as time passes. Early in the day there's plenty of time for your current picks to work, so swaps should be rare. But as phase transitions tick by, an unused bench becomes a liability. This rule lowers hurdle rates with each phase to encourage timely use of your bench.

**Template text:** `Reduce swap hurdle rates by {pct}% for each phase transition (EARLY → MID → LATE → FINAL_HOUR)`

**Params:**
```js
{
  pct: { type: 'number', default: 20, min: 10, max: 40, step: 5, unit: '%',
         label: 'Phase decay rate',
         hint: 'How much to reduce hurdle rates per phase transition. Higher = faster unlocking of bench optionality.' }
}
```

**relatedIndicator:** null
**kbEntryId:** null
**Tags:** `['phase', 'time-decay', 'optionality', 'bench']`

**agentUseDescription:** Your agent will reduce swap hurdle rates by the specified percentage at each phase transition, making it progressively easier to justify using bench stocks as the day progresses.

**Detection requirement:**
- Required signal: Phase transition counter (number of phase boundaries crossed since battle start)
- Data producer: 🟠 Phase is computed per-eval but transition counter is not persisted as an explicit field
- Data consumer: Haiku reasons from current phase + history; not deterministic
- Status: 🟠 partially detected

**Sample usage:** ❌ Not included in any collection.

---

### Rule 4.4 — gs-04

**Source location:** `src/data/forgeKnowledgeBase.js:1004-1026`
**Adjacent comment:** `// GS-04: Par Score Target`

**Name (headline):** Set your scoring target
**Category:** game_state
**Mode:** clash
**Difficulty:** beginner
**Hook:** `Define what winning means for your agent — everything else adjusts around this number`

**Description:** Sets an internal score benchmark that triggers strategy shifts between aggressive and defensive.

**learnMore:** A par score is your agent's internal definition of "winning." Once set, other game-state rules can use it to decide when to play aggressively (below par) or defensively (above par). It's the foundation for adaptive strategy — without a target, your agent has no way to know if it's ahead or behind.

**Template text:** `Set a par score target of {points} points. Use this to determine whether to play aggressively or defensively`

**Params:**
```js
{
  points: { type: 'number', default: 80, min: 30, max: 200, step: 10, unit: 'pts',
            label: 'Par score target',
            hint: 'Your scoring benchmark. Other game-state rules reference this to decide aggressive vs. defensive play.' }
}
```

**relatedIndicator:** null
**kbEntryId:** null
**Tags:** `['score', 'par', 'benchmark', 'foundation']`

**agentUseDescription:** Your agent will use the par score target as a benchmark to determine whether it should play aggressively or defensively, informing other game-state rules.

**Detection requirement:**
- Required signal: Pure configuration parameter — no detection needed at runtime; the rule injects the par score into Haiku's prompt as a reference number
- Data producer: rule param `points` (config-only)
- Data consumer: Rule text-injected; Haiku stores and references par score
- Status: ✅ detected today (trivially — it's just a number from the user)

**Sample usage:** ✅ `game-clock-plays` (legacy only)

---

### Rule 4.5 — gs-05

**Source location:** `src/data/forgeKnowledgeBase.js:1030-1052`
**Adjacent comment:** `// GS-05: Leading — Defensive Posture`

**Name (headline):** Protect the lead
**Category:** game_state
**Mode:** clash
**Difficulty:** intermediate
**Hook:** `When you're ahead, protect the lead — like running out the clock in football`

**Description:** When score exceeds par target, shifts to capital preservation.

**learnMore:** When your score is well above par, the smart play is to protect what you've earned rather than risk it chasing more. This rule widens loss tolerance (so minor dips don't trigger panicked swaps) and restricts swaps to emergencies only — like running out the clock when you're winning.

**Template text:** `When score exceeds par target by {pct}%, widen loss tolerance to {atr} ATR and restrict swaps to emergency exits only`

**Params:**
```js
{
  pct: { type: 'number', default: 20, min: 10, max: 50, step: 5, unit: '%',
         label: 'Lead margin',
         hint: 'How far above par triggers defensive mode. Higher = only shift when solidly ahead.' },
  atr: { type: 'number', default: -1.2, min: -1.5, max: -0.8, step: 0.1, unit: 'ATR',
         label: 'Widened loss tolerance',
         hint: 'Relaxed stop-loss for leading positions. More negative = more breathing room.' }
}
```

**relatedIndicator:** null
**kbEntryId:** null
**Tags:** `['score', 'leading', 'defensive', 'clock-management']`

**agentUseDescription:** Your agent will shift to defensive mode when score exceeds the par target by the specified percentage, widening loss tolerance and restricting swaps to emergency exits only.

**Detection requirement:**
- Required signal: Current score vs par target (delta as % above par)
- Data producer: `battle.scoreState.currentScore` written by agent-evaluate.js; par target from rule param
- Data consumer: `api/_utils/agentEvalPromptAssembly.js:650-651` (currentScore in live context); Haiku compares to par
- Status: ✅ detected today

**Sample usage:** ✅ `baggerbomb-native` (Trading Style); ✅ `game-clock-plays` (legacy)

---

### Rule 4.6 — gs-06

**Source location:** `src/data/forgeKnowledgeBase.js:1056-1078`
**Adjacent comment:** `// GS-06: Trailing — Aggressive Posture`

**Name (headline):** Play to win from behind
**Category:** game_state
**Mode:** clash
**Difficulty:** intermediate
**Hook:** `When you're behind with time running out, play to win — not to lose slowly`

**Description:** When score falls below par target, increases risk appetite.

**learnMore:** When your score is significantly below par and time is running out, playing it safe guarantees a loss. This rule increases risk appetite in the LATE and FINAL_HOUR phases — lowering swap hurdles and prioritizing high-ATR bench stocks that have the explosive potential to close the gap.

**Template text:** `When score falls below {pct}% of par target and phase is LATE or FINAL_HOUR, reduce all swap hurdle rates by {reduction}% and prioritize high-ATR bench stocks`

**Params:**
```js
{
  pct: { type: 'number', default: 80, min: 50, max: 90, step: 5, unit: '%',
         label: 'Trailing threshold',
         hint: 'Score as percentage of par that triggers aggressive mode. Lower = activate sooner.' },
  reduction: { type: 'number', default: 50, min: 25, max: 75, step: 25, unit: '%',
               label: 'Hurdle rate reduction',
               hint: 'How much to reduce swap hurdle rates. Higher = more aggressive comeback attempt.' }
}
```

**relatedIndicator:** null
**kbEntryId:** null
**Tags:** `['score', 'trailing', 'aggressive', 'hail-mary']`

**agentUseDescription:** Your agent will shift to aggressive mode when trailing the par target in late phases, reducing swap hurdle rates and prioritizing high-ATR bench stocks to maximize comeback potential.

**Detection requirement:**
- Required signal: Current score vs par target (% of par) + current phase
- Data producer: scoreState (agent-evaluate.js) + phase (agentEvalPromptAssembly.js:786-819)
- Data consumer: `api/_utils/agentEvalPromptAssembly.js:649-656` (score + phase in context); Haiku evaluates
- Status: ✅ detected today

**Sample usage:** ✅ `rs-leader`, ✅ `baggerbomb-native` (Trading Style); ✅ `game-clock-plays` (legacy)

---

### Rule 4.7 — gs-07

**Source location:** `src/data/forgeKnowledgeBase.js:1082-1104`
**Adjacent comment:** `// GS-07: Satisficer's Lock`

**Name (headline):** Lock in a great score
**Category:** game_state
**Mode:** clash
**Difficulty:** advanced
**Hook:** `Sometimes good enough is the smartest play — lock in a great score and stop gambling`

**Description:** When score exceeds a high ceiling, completely disables offensive swaps.

**learnMore:** There comes a point where your score is so good that any additional swap is more likely to hurt than help. This rule sets a ceiling score at which your agent stops all offensive trading and only acts to prevent catastrophic losses. It's the ultimate "quit while you're ahead" rule.

**Template text:** `When score exceeds {ceiling} points, disable all offensive swaps. Only swap if a stock falls within {atr} ATR of a Crash threshold`

**Params:**
```js
{
  ceiling: { type: 'number', default: 150, min: 80, max: 300, step: 10, unit: 'pts',
             label: 'Lock-in ceiling',
             hint: 'Score at which all offensive swaps stop. Higher = more ambitious before locking in.' },
  atr: { type: 'number', default: 0.2, min: 0.1, max: 0.5, step: 0.1, unit: 'ATR',
         label: 'Crash protection distance',
         hint: 'Only swap if stock is this close to a Crash threshold. Lower = tighter emergency detection.' }
}
```

**relatedIndicator:** null
**kbEntryId:** null
**Tags:** `['score', 'aspiration', 'lock', 'capital-preservation']`

**agentUseDescription:** Your agent will completely disable offensive swaps when the score exceeds the ceiling, only allowing emergency swaps to prevent stocks from reaching Crash thresholds.

**Detection requirement:**
- Required signal: Current score (absolute value) + ATR proximity to negative thresholds
- Data producer: `battle.scoreState.currentScore`; ATR proximity from agentRiskManager.js
- Data consumer: `api/_utils/agentEvalPromptAssembly.js:650` (current score in prompt); Haiku enforces ceiling rule
- Status: ✅ detected today

**Sample usage:** ❌ Not included in any collection.

---

### Rule 4.8 — gs-08

**Source location:** `src/data/forgeKnowledgeBase.js:1108-1131`
**Adjacent comment:** `// GS-08: Hot Hand Swap Freeze`

**Name (headline):** Don't fix what isn't broken
**Category:** game_state
**Mode:** clash
**Difficulty:** intermediate
**Hook:** `Don't fix what isn't broken — if your portfolio is hitting thresholds, leave it alone`

**Description:** When the portfolio is on a winning streak, locks it to prevent over-managing success.

**learnMore:** When your portfolio is on a hot streak — multiple positive thresholds hit in a short window — the worst thing your agent can do is tinker. This rule dramatically increases swap hurdle rates during winning streaks, effectively freezing the portfolio to let the momentum play out.

**Template text:** `If {thresholds} or more positive thresholds have been hit in the last {cycles} evaluation cycles, increase swap hurdle rates by {mult}x`

**Params:**
```js
{
  thresholds: { type: 'number', default: 2, min: 1, max: 4, step: 1, unit: '',
                label: 'Threshold hit count',
                hint: 'How many positive thresholds define a hot streak. Lower = triggers freeze more easily.' },
  cycles: { type: 'number', default: 4, min: 2, max: 8, step: 1, unit: '',
            label: 'Lookback cycles',
            hint: 'Evaluation cycles to look back for threshold hits. Shorter = more reactive to recent streaks.' },
  mult: { type: 'number', default: 3.0, min: 2.0, max: 5.0, step: 0.5, unit: 'x',
          label: 'Hurdle rate multiplier',
          hint: 'How much to increase swap hurdle rates during a hot streak. Higher = harder to break the streak.' }
}
```

**relatedIndicator:** null
**kbEntryId:** null
**Tags:** `['momentum', 'hot-hand', 'freeze', 'winning-streak']`

**agentUseDescription:** Your agent will track positive threshold hits across evaluation cycles and dramatically increase swap hurdle rates during winning streaks, preventing unnecessary trades when the portfolio is performing well.

**Detection requirement:**
- Required signal: Count of positive thresholds hit per evaluation cycle, accumulated over lookback window
- Data producer: 🟠 No explicit threshold-hit-count accumulator. Evaluations carry decisions/results but `battle.scoreState` does not persist a "threshold_hit_count" field. Haiku would need to infer from evaluation history.
- Data consumer: Rule text-injected; Haiku reasons from history
- Status: 🟠 partially detected

**Sample usage:** ❌ Not included in any collection.

---

### Rule 4.9 — gs-09

**Source location:** `src/data/forgeKnowledgeBase.js:1135-1156`
**Adjacent comment:** `// GS-09: Drawdown Regime Breaker`

**Name (headline):** Break the losing streak
**Category:** game_state
**Mode:** clash
**Difficulty:** intermediate
**Hook:** `A slow bleed is worse than a quick cut — break the losing pattern`

**Description:** If the portfolio bleeds slowly over consecutive cycles, forces a change.

**learnMore:** A slow, steady decline is harder to detect than a sudden crash, but just as damaging. When portfolio P&L has been negative for several consecutive cycles, the current strategy clearly isn't working. This rule forces a swap of the worst performer to break the losing pattern.

**Template text:** `If portfolio P&L has been negative for {cycles} consecutive evaluation cycles, force a swap of the worst-performing stock`

**Params:**
```js
{
  cycles: { type: 'number', default: 4, min: 3, max: 6, step: 1, unit: '',
            label: 'Consecutive loss cycles',
            hint: 'How many negative cycles before forcing a swap. Lower = faster pattern-breaking.' }
}
```

**relatedIndicator:** null
**kbEntryId:** null
**Tags:** `['drawdown', 'regime-break', 'forced-swap', 'losing-streak']`

**agentUseDescription:** Your agent will track consecutive negative P&L cycles and force a swap of the worst-performing stock when the specified threshold is reached, breaking destructive losing patterns.

**Detection requirement:**
- Required signal: Consecutive negative P&L cycles
- Data producer: 🟠 Evaluations array carries P&L deltas; no explicit "consecutive_negative_count" field
- Data consumer: Haiku must infer from evaluation history; not deterministic in code
- Status: 🟠 partially detected

**Sample usage:** ❌ Not included in any collection.

---

### Rule 4.10 — gs-10

**Source location:** `src/data/forgeKnowledgeBase.js:1160-1181`
**Adjacent comment:** `// GS-10: End-of-Day Reversal Fade`

**Name (headline):** Don't chase afternoon runners
**Category:** game_state
**Mode:** clash
**Difficulty:** intermediate
**Hook:** `Stocks that ran all day often reverse in the last hour — don't chase yesterday's winner at 3pm`

**Description:** In FINAL_HOUR, prevents swapping INTO stocks that have already run up massively.

**learnMore:** Stocks that have already made large intraday moves are statistically more likely to reverse in the final hour as traders take profits. Swapping into a stock that's already up big is chasing — you're buying at the top. This rule blocks your agent from swapping into overextended stocks during FINAL_HOUR.

**Template text:** `In FINAL_HOUR, prohibit swapping into any bench stock with intraday P&L exceeding {atr} ATR`

**Params:**
```js
{
  atr: { type: 'number', default: 1.5, min: 1.0, max: 2.0, step: 0.5, unit: 'ATR',
         label: 'Overextension threshold',
         hint: 'Maximum intraday ATR gain before a stock is considered too extended to buy in FINAL_HOUR.' }
}
```

**relatedIndicator:** ATR (Average True Range)
**kbEntryId:** null
**Tags:** `['phase', 'final-hour', 'reversal', 'institutional']` ⚠ (note "institutional" tag on a game_state rule — likely a tagging mistake from authoring)
**agentUseDescription:** Your agent will block swaps into bench stocks that have already moved beyond the specified ATR threshold during FINAL_HOUR, preventing chasing of overextended stocks.

**Detection requirement:**
- Required signal: Current phase = FINAL_HOUR + intraday ATR P&L per bench stock
- Data producer: phase from agentEvalPromptAssembly.js:786-819; per-stock daily % change from agentScoring.js
- Data consumer: `api/_utils/agentEvalPromptAssembly.js:682` (bench CSV includes daily % change); Haiku filters candidates
- Status: 🟠 partially detected (primitives available; deterministic blocking not enforced in code)

**Sample usage:** ❌ Not included in any collection.

---

### Rule 4.11 — gs-12

**Source location:** `src/data/forgeKnowledgeBase.js:1185-1206`
**Adjacent comment:** `// GS-12: After-Hours Catalyst Positioning`

⚠ Note: The rule sequence skips `gs-11`. The next rule after `gs-10` is `gs-12`. There is no `gs-11` rule defined in this category.

**Name (headline):** Position for after-hours moves
**Category:** game_state
**Mode:** clash
**Difficulty:** advanced
**Hook:** `Scoring continues after the bell — position for after-hours earnings moves`

**Description:** In the final evaluation, prioritizes stocks with scheduled post-market catalysts.

**learnMore:** If scoring continues after market close, stocks with scheduled after-hours catalysts (like earnings reports) can deliver massive moves. This rule tells your agent to prioritize those stocks in its final evaluation, but only if they have enough volatility (ATR) to actually capture the move.

**Template text:** `In the final evaluation before market close, prioritize bench stocks with scheduled after-hours catalysts if their ATR exceeds {pct}% of price`

**Params:**
```js
{
  pct: { type: 'number', default: 2.0, min: 1.0, max: 4.0, step: 0.5, unit: '%',
         label: 'Minimum ATR % of price',
         hint: 'ATR percentage threshold for after-hours candidates. Higher = only volatile stocks with big move potential.' }
}
```

**relatedIndicator:** ATR (Average True Range)
**kbEntryId:** null
**Tags:** `['after-hours', 'earnings', 'catalyst', 'final-swap']`

**agentUseDescription:** Your agent will prioritize bench stocks with after-hours catalysts in its final evaluation, but only if their ATR exceeds the specified percentage of price.

**Detection requirement:**
- Required signal: Current phase = pre-close + after-hours catalyst flag per stock + ATR as % of price
- Data producer: ❌ no producer found. After-hours catalyst flags are not persisted as a queryable per-stock field. The earnings ingestion writes events but does not surface a per-stock "has_after_hours_catalyst" flag for the agent eval prompt.
- Data consumer: Rule text-injected
- Status: ❌ no detection path

**Sample usage:** ❌ Not included in any collection.

---

## Cross-cutting findings

### Coverage in Trading Style Collections is extremely uneven

Of the 45 rules in scope:

| Category | Rules in scope | In ≥1 Trading Style Collection | In ≥1 legacy themed collection | In neither |
|---|---|---|---|---|
| institutional | 10 | 0 | 0 | 10 |
| fundamental | 14 | 1 (tv-10) | 4 (fund-* basics) | 9 |
| tier_strategy | 10 | 6 | 5 | 2 (ts-03, ts-06, ts-08) |
| game_state | 11 | 2 (gs-05, gs-06) | 5 | 4 (gs-03, gs-07, gs-08, gs-09, gs-10, gs-12) |

**The most striking finding:** ALL 10 institutional rules are completely absent from any collection — neither the 12 active Trading Style Collections nor the 9 legacy themed collections reference any `i-*` rule. They exist in the rule library but are not load-bearing for any archetype.

### Detection-data coverage is also uneven

From the detection-data analysis:

| Status | institutional | fundamental | tier_strategy | game_state | Total |
|---|---|---|---|---|---|
| ✅ Detected today | 4 | 1 | 6 | 6 | 17 |
| 🟠 Partially detected | 2 | 6 | 3 | 4 | 15 |
| ❌ No detection path | 4 | 7 | 1 | 1 | 13 |

The fundamental category has the worst data coverage: 7 of 14 rules require data primitives that have no producer in the codebase (FCF yield, analyst consensus, earnings beat rate, revenue acceleration, P/B, etc.). Most fundamental rules are pure prompt-text injection with no underlying queryable data.

### Shared detection primitives (relevant for "duplicate intent" analysis)

- **Institutional conviction** (categorical accumulation/distribution score) underpins i-01, i-02, i-07, and is referenced by i-03 (new positions), i-08 (insider confluence), i-10 (breadth momentum). Six rules cluster around one primitive — variants differ on threshold tuning or what they cross-reference.
- **ATR proximity to thresholds** is required by ts-03 (positive threshold proximity), ts-07 (negative threshold proximity), gs-01 (EARLY emergency swap), gs-05 (lead protection ATR widening), gs-07 (Crash distance), gs-10 (overextension cap). The agentRiskManager produces these proximity calculations but multiple rules slice them differently.
- **Battle phase (EARLY/MID/LATE/FINAL_HOUR)** is required by gs-01, gs-02, gs-03, gs-06, gs-10, gs-12, ts-09. Seven rules consume one primitive (`computeBattlePhase()`).
- **5-min RSI** is required by ts-03 (40-60 zone), ts-05 (>75 overbought), tv-12 (45-70 momentum zone). Three rules consume RSI but apply different zone definitions.
- **5-min MACD** is required by ts-05 (trajectory after threshold) and ts-08 (histogram divergence on new high). Both rules consume the same MACD snapshot but check for different patterns.
- **Daily Technical Score from peerRankings** is required by ts-02, tv-10, tv-12.

### Duplicate-intent candidates (flagged only, no recommendation)

- **fund-earnings-surprise vs f-07** — Both target stocks that beat earnings consistently. `fund-earnings-surprise` (lines 219-240) uses a coarser "last N quarters positive surprise" filter; `f-07` (lines 1838-1861) is more granular with a beat-rate % plus surprise-magnitude decile. Different generations of the same idea.
- **fund-revenue-growth vs f-11** — Both target revenue growth. `fund-revenue-growth` filters on absolute growth rate %; `f-11` filters on second-derivative acceleration (basis points QoQ delta). Adjacent ideas, possibly complementary.
- **fund-value-pe vs f-10** — Both about valuation. `fund-value-pe` uses P/E with sector-median or absolute threshold; `f-10` routes to sector-appropriate metric (P/B for banks, P/S for tech). f-10 is the more sophisticated successor.
- **fund-bank-pb vs f-10** — `fund-bank-pb` is a special-case P/B-for-banks rule; `f-10` generalizes the same idea to all sectors.
- **fund-financial-health vs f-09** — Both about balance-sheet quality. `fund-financial-health` uses a composite categorical rating (strong/moderate); `f-09` is specifically about leverage with sector-relative D/E.
- **i-01 (conviction filter) vs i-02 (distribution avoidance)** — Symmetric pair on the same axis (accumulation positive, distribution negative). Different parameters of the same conviction score.

### Category boundary edge cases

- **f-13 (Earnings Calendar Risk Management)** is tagged `fundamental` but conceptually overlaps with `risk` (it's about avoiding earnings gap risk). The params include "decrease/increase/neutral" priority which is closer to a risk management dial than a fundamental selection criterion.
- **gs-10 (End-of-Day Reversal Fade)** has the tag `'institutional'` in its tag list — this looks like an authoring mistake; the rule is purely about phase-aware bench selection with no institutional component. Likely a copy-paste residue.
- **i-06 (Hedge Fund Favorites)** is mode `clash` because it specifically pairs with BaggerBomb mechanics. The other institutional rules are mode `both` or `clash`. The mode distinction is consistent with the rule's intent.
- **i-09 (Transient Capital Catalyst)** is also `clash`-only for the same reason (BaggerBomb-aligned volatility amplification).

### Rule shape inconsistencies

- **`hook` field** is present on all 14 fundamental rules in the second batch (f-07 through f-13, plus tv-10) and on most tier_strategy rules — but absent on the original 6 fundamental rules (fund-earnings-surprise through fund-market-cap). This is generational: older rules predate the `hook` field.
- **`kbEntryId` non-null** appears on only 2 of the 45 rules: `fund-bank-pb` (`'sector-playbook-banks'`) and `fund-market-cap` (`'market-capitalization'`). The other 43 have `kbEntryId: null`. Likely vestigial from an early knowledge-base linkage scheme.
- **`relatedIndicator` non-null** is more common on technical/risk/threshold-adjacent rules; many institutional rules have `relatedIndicator: null` because they don't map to a single technical indicator.
- **Empty params object** (`params: {}`) appears on i-09 only — a "toggle-style" rule with no tunable parameter. All other 44 rules have at least one param.
- **gs-11 is missing.** The game_state sequence runs gs-01 through gs-10 then jumps to gs-12. There is no gs-11 in the file. Either an intentional skip or a deleted rule that was never renumbered.

### Same rule ID, different definitions

None found within the four categories in scope. Each `id` appears exactly once in `forgeKnowledgeBase.js`. (A separate check would be needed to confirm no rules in `forgeCollections.js` reference an id that doesn't exist in `forgeKnowledgeBase.js`, but that is out of scope for this extraction.)

---

## Appendix

### File structure of forgeKnowledgeBase.js (3,798 lines total)

- Lines 1–4: header comment
- Lines 5–19: `FORGE_CATEGORIES` (13 category definitions)
- Lines 21–28: `SEASON_CONFLICT_PAIRS` (6 hardcoded rule-pair conflict warnings for Season mode)
- Lines 30+: `FORGE_RULE_TEMPLATES` array begins. Rules grouped roughly by category in this order:
  1. Technical (initial 8 rules)
  2. **Fundamental (initial 6 rules: fund-*) — lines 218–351**
  3. Risk (5 rules)
  4. Allocation (4 rules)
  5. Mid-Battle (14 rules)
  6. **Game State (11 rules: gs-01 … gs-12, no gs-11) — lines 925–1206**
  7. Threshold (7 rules)
  8. **Tier Strategy (9 rules: ts-01 … ts-09) — lines 1395–1626**
  9. Technical expansion (8 rules: t-09 … t-16)
  10. **Fundamental expansion (7 rules: f-07 … f-13) — lines 1838–2014**
  11. Risk expansion (7 rules)
  12. Allocation expansion (6 rules)
  13. TradingView rules (15 rules: tv-01 … tv-15), interleaved with one more **fundamental (tv-10) at line 2606**, one more **tier_strategy (tv-12) at line 2661**
  14. **Institutional (10 rules: i-01 … i-10) — lines 2779–3076**
  15. Season-mode categories: entry_criteria (8), exit_stops (7), rebalancing (5), season_state (6)

The category groupings are mostly contiguous, but not strictly so — Phase 2 expansions of Technical, Fundamental, Risk, Allocation appear later in the file, and the TradingView batch interleaves a few rules into other categories.

### Related files referenced

- `src/data/forgeCollections.js` — 1,120 lines. Defines `TRADING_STYLE_COLLECTIONS` (12 active style archetypes, each a curated 7–9 rule bundle with `paramOverrides` and `rationale` per rule) and `FORGE_COLLECTIONS` which spreads them with 9 additional legacy themed collections (defensive-playbook, momentum-hunter, value-investor, contrarian-edge, conviction-plays, battle-tactics, game-clock-plays, threshold-hunters, tier-master).
- `src/services/forgeService.js:17` — defines `VALID_CATEGORIES` enum and validates rule writes.
- `api/_utils/agentEvalPromptAssembly.js:283-323` — injects active rules into Haiku's system prompt under `CONSTRAINTS (must obey)` / `STRATEGY PREFERENCES (should follow)` headers.
- `api/_utils/agentEvalPromptAssembly.js:476-505` — institutional intelligence prompt block (renders summary, sector flows table).
- `api/_utils/agentEvalPromptAssembly.js:649-656` — live context block (phase, score, time remaining).
- `api/_utils/agentEvalPromptAssembly.js:786-819` — `computeBattlePhase`, `getCurrentTradingDayServer`, `computeTimeRemaining`.
- `api/cron/compute-institutional-intelligence.js` — producer for institutional conviction, sector flows, archetype classification.
- `api/cron/compute-rankings.js` — producer for peerRankings (technical + fundamental composite scores).
- `api/_utils/buildTechnicalSnapshot.js` — producer for per-stock RSI, MACD, ATR%, volume profile.
- `api/_utils/agentRiskManager.js` — producer for ATR multiplier and proximity-based actions.
- `api/_utils/agentScoring.js` — per-stock priceChange / score.

### Extraction caveats

- Line numbers refer to `main @ 3b6554c39bf428b61918b7a2de0d91e61a07e973`.
- Adjacent code comments were captured where they preceded each rule. Most comments are simply `// XX-NN: Rule Name` headers; no extended authorial-intent commentary was found inline.
- No rule in the four categories had inline TODO/FIXME comments suggesting incomplete authoring.
- Detection-data status (✅/🟠/❌) reflects what exists in the codebase **as a queryable data primitive surfaced to the prompt or available deterministically**. Because most Forge rules are evaluated by Haiku reasoning over prompt text rather than by JavaScript code, a "🟠 partially detected" status typically means the underlying numbers exist somewhere but are not rolled up into a form the rule's threshold language matches.

---

**End of Forge Stream B Rule Extraction — Session 2 Categories.**
