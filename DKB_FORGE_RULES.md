# Forge Rule Library — DKB Reference
# Auto-extracted from forgeKnowledgeBase.js on 2026-04-14
# Total: 143 rules across 13 categories

## Categories

| ID | Name | Color | Rule Count |
|----|------|-------|------------|
| technical | Technical | #5eead4 | 25 |
| fundamental | Fundamental | #a78bfa | 14 |
| risk | Risk | #f97066 | 12 |
| allocation | Allocation | #f59e0b | 11 |
| mid_battle | Mid-Battle Trading | #6366F1 | 16 |
| game_state | Game State | #94A3B8 | 11 |
| threshold | Threshold Strategy | #f472b6 | 8 |
| tier_strategy | Tier Strategy | #34d399 | 10 |
| institutional | Institutional | #06b6d4 | 10 |
| entry_criteria | Entry Criteria | #F0C75E | 8 |
| exit_stops | Exit & Stops | #E8927C | 7 |
| rebalancing | Rebalancing | #E8927C | 5 |
| season_state | Season State | #F0C75E | 6 |

## Rules by Category

### Technical

| ID | Title | Description | Params |
|----|-------|-------------|--------|
| t-09 | Buy the dip to fair value | Prefer stocks that have pulled back to VWAP in an uptrend — buying at institutional fair value. — Smart money buys the dip to the average price | pct (0.3) |
| t-10 | Avoid overextended stocks | Avoid stocks that have moved more than 2 standard deviations from VWAP. — When a stock moves too far too fast from its average, it almost always comes back | dev (2) |
| t-11 | Follow institutional accumulation | Prioritize stocks outperforming SPY — institutional accumulation signal. — Stocks that hold up when the market drops are being accumulated by institutions | score (15), floor (8) |
| t-12 | Catch the volatility squeeze | Prioritize stocks with extremely narrow Bollinger Bands — about to explode. — Quiet stocks are loading up energy — when the squeeze breaks, it's usually explosive | pct (10), vol (1.5) |
| t-13 | Spot hidden momentum shifts | Flags stocks where price and RSI disagree — momentum fading despite price looking strong. — When momentum fades but price looks strong, a reversal is coming | conviction (moderate) |
| t-14 | Demand volume proof on breakouts | Only trust breakouts with a volume spike — moves without volume are fake. — A breakout without volume is a promise without action — demand proof | mult (1.5) |
| t-15 | Catch the narrowest range breakout | Flag stocks with their narrowest daily range in 7 days — maximum energy compression. — The quietest day in a week is usually followed by one of the loudest | score (70) |
| t-16 | Require multiple green lights | Require multiple indicators to agree before the agent acts — reduces false signals. — One green light could be a fluke — three green lights mean the move is real | count (2 of 3) |
| tech-avoid-declining | Don't catch falling knives | Avoid stocks in a sustained downtrend — wait for a reversal first. | period (200) |
| tech-bollinger-squeeze | Look for volatility breakouts | Target stocks where price is compressed tight — a big move may be coming. | bandwidthThreshold (20), volumeConfirm (false) |
| tech-macd-bullish | Ride momentum shifts | Look for stocks where trend momentum is turning positive. | macdDirection (histogram expanding), rsiFloor (50) |
| tech-moving-average-trend | Follow the trend | Prefer stocks trading above their moving average — the trend is your friend. | period (50), requireAlignment (false) |
| tech-relative-strength | Pick sector leaders | Choose stocks that are outperforming their sector peers. | rank (top quartile) |
| tech-rsi-overbought | Avoid overbought stocks | Skip stocks that have run up too fast and may be due for a pullback. | threshold (70), strictMode (false) |
| tech-rsi-oversold | Buy oversold stocks | Add stocks that have dropped hard and show signs of bouncing back. | threshold (30), volumeConfirm (false) |
| tech-volume-surge | Follow the smart money | Pay attention when trading volume spikes — big players may be moving. | multiplier (2) |
| tv-01 | RSI Momentum Zone | Targets stocks in the RSI sweet spot — strong momentum without overextension. Unlike the oversold b… — The best stocks aren't oversold or overbought — they're in the power zone where momentum is building | low (50), high (70), weak (40), stretched (75) |
| tv-02 | MACD Histogram Acceleration | Focuses on whether the MACD histogram is growing or shrinking. A growing histogram means momentum i… — A positive MACD is good, but a GROWING MACD is better — acceleration beats direction | action (reduce tier) |
| tv-03 | MACD Zero-Line Bounce | In an uptrend, MACD often pulls back toward zero then bounces. This catches the momentum reset befo… — When momentum cools to neutral in an uptrend, the next surge is loading — buy the pause | score (60), minutes (120) |
| tv-04 | VWAP Reclaim Entry | Targets stocks that dipped below VWAP and recovered back above it. The reclaim signals buyers stepp… — A stock that fights its way back above VWAP just proved the buyers are stronger than the sellers | dev (0.3) |
| tv-05 | Squeeze Direction Filter | When a Bollinger Band squeeze is detected, use MACD histogram direction to predict breakout directi… — A squeeze tells you WHEN the move is coming — MACD tells you WHICH WAY | bw (4), direction (positive and growing) |
| tv-06 | Bollinger Lower Band Entry | When price touches or penetrates the lower Bollinger Band, the stock is stretched below its statist… — Stocks that touch the lower band are statistically stretched — the rubber band usually snaps back | percentB (0.1), tierRule (Support or Core only) |
| tv-07 | Intraday Range Position | Stocks that close near the low of their intraday range often bounce the next session. This is the I… — A stock beaten down to its daily low is spring-loaded for a morning bounce — this is one of the most backtested edges in quant trading | pct (20), minutes (90) |
| tv-11 | 52-Week High Breakout Preference | Stocks near their 52-week high are breaking through resistance. This is the Donchian / channel brea… — Stocks making new highs tend to keep making new highs — resistance becomes support once it breaks | score (9), pct (5) |
| tv-13 | Volume Spike Institutional Signal | When volume explodes above 2x average on a bullish candle, institutions are taking a position. This… — When the big money shows up, the volume screams it — a 2x spike on a green candle is the loudest buy signal in the market | mult (2), tier (Core) |

### Fundamental

| ID | Title | Description | Params |
|----|-------|-------------|--------|
| f-07 | Ride the earnings surprise wave | Prefer stocks that consistently beat earnings estimates by large margins. — Companies that keep beating expectations keep surprising the market | beat_pct (75), decile (Top 20%) |
| f-08 | Trust the cash, not the math | Prefer stocks with positive free cash flow — the real measure of financial health. — Earnings can be faked with accounting tricks — cash flow can't | pct (25) |
| f-09 | Avoid over-leveraged companies | Avoid over-leveraged companies using sector-relative debt limits. — A bank with 1.5x debt is normal — a tech company with 1.5x debt is a red flag | mult (1.25), tight_mult (1) |
| f-10 | Use the right valuation yardstick | Uses the right valuation metric for each sector — P/B for banks, P/S for tech, dividend yield for u… — You wouldn't judge a fish by how well it climbs a tree — use the right yardstick | pct (40) |
| f-11 | Chase accelerating growth | Prefer stocks where the growth rate is accelerating, not just high. — Acceleration beats speed — growing 10% after 8% is better than 15% after 20% | bps (200) |
| f-12 | Follow the analyst upgrades | Prefer stocks where analyst consensus has improved recently. — When Wall Street upgrades in unison, they know something the market hasn't priced in | days (30) |
| f-13 | Manage earnings week risk | Adjusts selection priority based on proximity to earnings dates. — Earnings week is like a coin flip on steroids | days (3), action (decrease), beat_pct (80) |
| fund-bank-pb | Value banks the right way | Use P/B ratio instead of P/E for bank stocks — it's a better measure. | threshold (2) |
| fund-earnings-surprise | Bet on earnings winners | Favor companies that consistently beat earnings expectations. | quarters (2) |
| fund-financial-health | Avoid fragile companies | Skip companies with weak balance sheets — they crack under pressure. | level (moderate) |
| fund-market-cap | Pick your weight class | Focus on company size that matches your strategy — big, medium, or small. | size (large) |
| fund-revenue-growth | Find growing companies | Prefer companies with strong revenue growth — the top line matters most. | pct (10) |
| fund-value-pe | Hunt for undervalued stocks | Look for stocks trading at a discount to their sector's average valuation. | level (sector median) |
| tv-10 | Earnings + Technical Confluence | Stocks with both strong earnings history AND bullish technicals have dual confirmation. Fundamental… — Great earnings AND great technicals? That's the market saying "this stock deserves to be here" — double conviction | fund_score (65), tech_score (60), tier (Star) |

### Risk

| ID | Title | Description | Params |
|----|-------|-------------|--------|
| r-06 | Cap sector exposure | Limits the number of stocks from any single sector. — When one sector tanks, you don't want half your portfolio going with it | max (2) |
| r-07 | Avoid hidden correlation traps | Avoids holding multiple stocks from the same sub-industry. — Three chip stocks isn't diversification — it's a triple bet on semiconductors | max (1) |
| r-08 | Mix stability with explosiveness | Ensures mix of large-cap stability and small-cap volatility. — Big stocks keep you alive, small stocks make you rich — you need both | anchors (2), sails (2) |
| r-09 | Switch to survival mode | Shifts to defensive mode if total portfolio drops below a threshold. — When the whole portfolio is bleeding, stop trying to be a hero | pct (10) |
| r-10 | De-risk in volatile markets | Reduces high-ATR exposure when the broad market is in a volatile regime. — When the whole market is panicking, even good stocks get dragged down | pct (3) |
| r-11 | Keep crypto on a leash | Manages the mandatory crypto asset to prevent portfolio-destroying volatility. — Crypto can make or break your battle — keep it on a leash | tier (Support) |
| r-12 | Avoid sectors in the news doghouse | Excludes stocks in sectors with negative FantasyTimes sentiment. — Don't fight the news — if FantasyTimes says a sector is in trouble, listen | sentiment (bearish) |
| risk-avoid-declining-trend | Don't fight the trend | Avoid stocks in a long-term downtrend — the momentum is against you. | period (200) |
| risk-exit-atr-stop | Know when to fold | Exit positions that drop too far — cut losses before they get worse. | multiplier (-2) |
| risk-sector-diversification | Spread your bets | Don't put all your picks in one industry — diversify across sectors. | n (3) |
| risk-single-stock-limit | Don't bet the farm | Cap how much of your portfolio goes into any single stock. | pct (40) |
| risk-volatility-avoidance | Stay away from wild swings | Avoid stocks that are moving much more than normal for their sector. | level (2x sector average) |

### Allocation

| ID | Title | Description | Params |
|----|-------|-------------|--------|
| a-05 | Build a barbell portfolio | Split portfolio between high-ATR explosive stocks and low-ATR anchors — avoid the moderate middle. — Safe stocks keep you in the game, explosive stocks win it — need both extremes | anchors (2), rockets (2), low_pct (1.5), high_pct (3.5) |
| a-06 | Lean into market leaders | Overweight stocks with the highest relative strength — lean into the market leaders. — Stocks beating the market today tend to keep beating it tomorrow — lean into leaders | rs_min (15), pct (25) |
| a-07 | Balance defense and offense | Ensure a mix of high-ATR growth engines and high-fundamental-score defensive anchors. — Growth stocks chase thresholds, defensive stocks protect the score — balance your appetite | defensive (2), growth (3), fund_min (70) |
| a-08 | Ride the sentiment tailwinds | Overweight sectors with positive FantasyTimes sentiment — ride the narrative tailwinds. — When the news cycle turns on a sector, the smart money moves first — move with it | sentiment (bullish) |
| a-09 | Build a versatile bench | Build the bench to complement the active roster — different sectors, different styles. — Your bench isn't a backup squad — it's a toolkit for when the market changes | complement (2), high_upside (1) |
| a-10 | Position for economic events | Tilt the portfolio toward event-sensitive sectors ahead of major economic announcements. — Big economic announcements move entire sectors — be positioned before the news drops | days (2) |
| alloc-even-spread | Keep it balanced | Spread allocation evenly across sectors instead of concentrating. | conviction (moderate) |
| alloc-sector-cap | Cap your sector exposure | Limit how much of your portfolio goes into any one sector. | sector (any single), pct (40) |
| alloc-sector-minimum | Guarantee sector exposure | Make sure your portfolio always includes a certain sector. | sector (Technology), pct (20) |
| alloc-tier-preference | Control your Star picks | Decide what kind of stocks deserve your highest-scoring Star tier slot. | attribute (high momentum) |
| tv-14 | Sector Leader Selection | Instead of picking stocks first, identify the strongest sectors then pick the leader within each on… — A great stock in a bad sector is swimming against the current — find the strongest sector first, then pick its champion | max_pct (40), evals (2) |

### Mid-Battle Trading

| ID | Title | Description | Params |
|----|-------|-------------|--------|
| mb-01 | Give your pick time to work | Prevents the agent from swapping a recently acquired stock, giving the original thesis time to play… — Gives your pick time to work — short-term dips are usually noise, not signal | minutes (60) |
| mb-03 | Replace dead money | Forces the agent to replace a stock that is not moving — dead money in a 1-day battle is a liabilit… — A stock that sits still is wasting a roster spot — kick it out and find something alive | atr (0.2), minutes (90) |
| mb-04 | Demand proof before swapping | Requires the bench stock to significantly outperform the active stock before a swap is allowed. — A swap should be a clear upgrade — this rule demands proof, not a guess | atr (0.5) |
| mb-05 | Follow the smart money | Only allows swapping INTO a bench stock trading above its VWAP — ensures institutional momentum sup… — If the smart money isn't buying it, your agent shouldn't either | signal (bullish crossover) |
| mb-06 | Protect your best picks | Makes it progressively harder to swap out higher-tier stocks — Star tier needs overwhelming evidenc… — Your best pick deserves the most protection — Star stocks are harder to give up on | star (2), core (1.5) |
| mb-07 | Stop the churn | Hard timeout if the agent trades too frequently — prevents destructive feedback loops in choppy mar… — Too many swaps in a row means the market is confusing your agent — force a cooldown | swaps (2), window (60), freeze (45) |
| mb-08 | Let winners run | Prevents the agent from swapping a winning stock until it reaches a scoring threshold — counteracts… — Selling a winner early is the #1 mistake in trading — let profits run | threshold (BaggerBomb (+1.0x)) |
| mb-09 | Pull the emergency brake | Hard stop-loss that overrides all holding rules — prevents a position from reaching Crash or Meltdo… — Some losses are worth cutting immediately — pull the emergency brake | atr (-1) |
| mb-10 | Stay quiet at lunch | Blocks swap evaluations during the lowest-volume lunch hour period. — The lunch hour is a graveyard for momentum — keep your agent quiet when the market sleeps | start (11:30 AM), end (1:30 PM) |
| mb-11 | Lean in for the final push | Lowers swap hurdle rates in the final hour to capture end-of-day institutional moves. — The last hour of trading is when the big money moves — let your agent join the party | time (3:00 PM), pct (50) |
| mb-12 | Use it or lose it | Gradually lowers the swap hurdle rate as the day progresses — bench optionality is worth less as ti… — Swaps get cheaper to justify as the clock ticks — your bench is worth less if you never use it | pct (15), start (1:00 PM) |
| mb-13 | Wait for the dust to settle | Delays the agent's reaction to breaking news to avoid trading into overreactions. — First reactions to headlines are usually wrong — wait for the dust to settle | intervals (1) |
| mb-14 | Trust price over headlines | Requires FantasyTimes sentiment to match actual price direction before acting. — Headlines lie sometimes — trust the price, not the story | indicator (5-min VWAP trend) |
| mb-15 | Exit when the thesis breaks | If a stock stays below VWAP for consecutive intervals, the thesis is broken — force an exit. — When a stock can't hold above its average price, the institutions have given up — so should your agent | intervals (3) |
| tv-08 | Low Volume Pullback Hold | In an uptrend, pullbacks on below-average volume are healthy — they show a lack of selling pressure… — If nobody's actually selling, the dip isn't real — low volume pullbacks in uptrends are gifts | score (55), vol (0.8), minutes (90) |
| tv-09 | Smart Money Liquidity Sweep | When a stock drops sharply on a volume spike then immediately recovers, institutional players swept… — That scary drop and instant recovery? That was smart money shaking out weak hands to buy cheaper | atr (0.5), vol (1.5), minutes (60) |

### Game State

| ID | Title | Description | Params |
|----|-------|-------------|--------|
| gs-01 | Survive the opening chaos | Restricts offensive swaps in the EARLY phase — agent trusts its initial portfolio. — The morning is chaos — survive the noise before making moves | atr (-1) |
| gs-02 | Scale risk by time of day | Widens or tightens stop-loss thresholds based on the current time phase. — Morning volatility needs a wide leash, but final hour needs a tight one | early (2), mid (1.5), late (1.2), final (1) |
| gs-03 | Use the bench before it expires | Makes swaps easier to justify as the day progresses. — An unused bench at the closing bell is a wasted resource | pct (20) |
| gs-04 | Set your scoring target | Sets an internal score benchmark that triggers strategy shifts between aggressive and defensive. — Define what winning means for your agent — everything else adjusts around this number | points (80) |
| gs-05 | Protect the lead | When score exceeds par target, shifts to capital preservation. — When you're ahead, protect the lead — like running out the clock in football | pct (20), atr (-1.2) |
| gs-06 | Play to win from behind | When score falls below par target, increases risk appetite. — When you're behind with time running out, play to win — not to lose slowly | pct (80), reduction (50) |
| gs-07 | Lock in a great score | When score exceeds a high ceiling, completely disables offensive swaps. — Sometimes good enough is the smartest play — lock in a great score and stop gambling | ceiling (150), atr (0.2) |
| gs-08 | Don't fix what isn't broken | When the portfolio is on a winning streak, locks it to prevent over-managing success. — Don't fix what isn't broken — if your portfolio is hitting thresholds, leave it alone | thresholds (2), cycles (4), mult (3) |
| gs-09 | Break the losing streak | If the portfolio bleeds slowly over consecutive cycles, forces a change. — A slow bleed is worse than a quick cut — break the losing pattern | cycles (4) |
| gs-10 | Don't chase afternoon runners | In FINAL_HOUR, prevents swapping INTO stocks that have already run up massively. — Stocks that ran all day often reverse in the last hour — don't chase yesterday's winner at 3pm | atr (1.5) |
| gs-12 | Position for after-hours moves | In the final evaluation, prioritizes stocks with scheduled post-market catalysts. — Scoring continues after the bell — position for after-hours earnings moves | pct (2) |

### Threshold Strategy

| ID | Title | Description | Params |
|----|-------|-------------|--------|
| th-01 | Hold near the bonus line | The closer a stock is to a positive threshold, the harder it becomes to swap out. — When your stock is inches from a bonus, hold your nerve — the payoff is worth the wait | atr (0.25), mult (2), drawdown (0.3) |
| th-04 | Chase the next bonus | After hitting a threshold, widens stops to chase the next tier — treats locked-in points as a cushi… — You already banked the bonus — now play with house money and go for the bigger prize | threshold (BaggerBomb), atr (0.5) |
| th-05 | Lock in the win | After hitting a threshold, tightens stops to lock in base P&L — especially in high-multiplier tiers. — A guaranteed win beats a maybe — lock in your gains before the market takes them back | tier (Star), atr (0.2) |
| th-07 | Fear losses more than you love gains | Makes the agent treat negative thresholds as closer than they are — fear of loss should outweigh ex… — Losing 35 points hurts way more than gaining 15 feels good — be properly scared of penalties | mult (1.5) |
| th-08 | Know when to give up waiting | If a stock hovers near a threshold without crossing it, the agent resets and treats it as swappable. — Just because a stock is close doesn't mean it'll get there — know when to give up waiting | atr (0.15), minutes (45) |
| th-09 | Replace the weakest link | When swapping, always eject the stock furthest from any positive threshold. — Every portfolio has a weakest link — make sure that's the one that gets replaced | exempt_tiers (None) |
| th-10 | Choose your scoring personality | Sets the agent's global philosophy — harvest many small bonuses or hunt rare big ones. — Do you want lots of +15s or one epic +50? This defines your agent's scoring personality | posture (Balanced) |
| tv-15 | Threshold Harvest Swap | After a stock hits a BaggerBomb threshold bonus, immediately evaluate whether to swap it for a fres… — You already got the +15. The stock doesn't know it owes you another one — swap for a fresh rocket | threshold (BaggerBomb (+1.0x)), evals (2), rsi (50) |

### Tier Strategy

| ID | Title | Description | Params |
|----|-------|-------------|--------|
| ts-01 | Keep wild stocks out of Star | Prevents Star tier from being assigned to erratic, high-volatility stocks. — The 2x multiplier doubles everything — including losses. Keep wild stocks out of Star | pct (200), tier (Support) |
| ts-02 | Require multi-timeframe agreement | Star tier requires both daily trend AND intraday momentum to be bullish. — True conviction means every timeframe agrees — if daily and intraday diverge, demote | score (70), tier (Support) |
| ts-03 | Park stalled threshold plays in Support | Stocks near a threshold with stalled momentum are restricted to Support — the bonus is the same reg… — Threshold bonuses don't care about the multiplier — park stalled stocks in Support and give Star to something moving | atr (0.2) |
| ts-04 | Star goes to the hottest stock | Dynamically promotes the highest-velocity stock to Star — the multiplier is earned, not assumed. — Star tier should go to your hottest stock right now — not the one you liked best this morning | interval (30), cycles (2) |
| ts-05 | Demote tired Star stocks after a bonus | After a Star stock hits a bonus AND shows overbought signals, demotes it to lock in multiplied gain… — Your Star stock earned a bonus but looks tired — demote before the reversal eats your 2x gains | rsi (75) |
| ts-06 | Don't waste Star on a flatline | Strips the Star multiplier from stocks that have flatlined — the 2x is wasted on a stock that isn't… — A 2x multiplier on zero movement is still zero — move the Star to something actually trading | pct (0.1), cycles (3) |
| ts-07 | Demote before the penalty hits | When a Star/Core stock approaches a negative threshold, demotes to Support to halve the continuous… — The penalty is the same in any tier, but the damage on the way down is halved in Support — demote before it hurts | atr (0.3), recovery (0.5) |
| ts-08 | Catch the hidden divergence | Demotes a stock when price and momentum diverge — new highs with fading MACD is a warning sign. — When the speedometer drops but the car keeps climbing, the hill is about to win | tier (Core) |
| ts-09 | Cap tiers during the morning open | Restricts the Star tier during the first 30-45 minutes to prevent morning whipsaw at 2x. — The morning open is a guessing game — don't let 2x amplify a wrong guess | minutes (45), tier (Core) |
| tv-12 | Multi-Factor Tier Assignment | Assigns tiers based on how many independent signals agree. More confirmations = higher tier. Stocks… — One green light is a suggestion. Three green lights is conviction — let the evidence decide your tier | tech (60), rsi_low (45), rsi_high (70), vol (1.2) |

### Institutional

| ID | Title | Description | Params |
|----|-------|-------------|--------|
| i-01 | Institutional Conviction Filter | Prefer stocks where active institutional holders are net accumulating. Filters out passive index fu… | conviction (strong_accumulation) |
| i-02 | Distribution Avoidance | Strictly avoid stocks where institutions are actively selling. When smart money exits, overhead sup… | level (strong_distribution) |
| i-03 | Consensus Discovery | Prefer stocks where multiple institutions opened brand new positions this quarter. New money enteri… | count (2) |
| i-04 | Whale Concentration Guard | Avoid stocks where a single institution holds too large a stake. When one whale controls the float,… | pct (20) |
| i-05 | Active Fund Overlap Guard | Prevent drafting too many stocks held by the same active mutual fund. High overlap means correlated… | max (2) |
| i-06 | Hedge Fund Favorites | Target stocks widely held by top hedge funds for momentum amplification. Crowded trades provide exp… | count (3) |
| i-07 | Sector Institutional Flow | Align stock selection with sectors where institutional money is flowing in. Capital rotation at the… | sentiment (bullish) |
| i-08 | Insider + Institution Confluence | The premium signal: prefer stocks where both institutional holders AND company insiders are buying.… | days (60) |
| i-09 | Transient Capital Catalyst | Prefer stocks where accumulation is driven by high-turnover, short-horizon institutions. These "tra… | — |
| i-10 | Institutional Breadth Momentum | Prefer stocks where the number of unique institutional holders is expanding quarter after quarter.… | quarters (2) |

### Entry Criteria

| ID | Title | Description | Params |
|----|-------|-------------|--------|
| se-01 | RSI Entry Gate | Only enter positions where RSI indicates the stock isn't overbought — prevents chasing stocks that… — Stops you from buying at the top — if everyone's already in, you're late | upper (65) |
| se-02 | Volume Confirmation | Require meaningful trading volume before entering — ensures the stock has active interest, not a de… — Volume is conviction — if nobody's trading it, why are you buying it? | multiplier (1.2) |
| se-03 | Trend Alignment Filter | Only buy stocks trading above their moving average — the simplest trend-following filter. Below the… — Don't fight the trend — if it's below the average, the market is telling you something | period (50) |
| se-04 | Earnings Avoidance Window | Don't enter positions right before earnings — overnight gap risk can destroy a position. Huge strat… — Earnings are coin flips — great companies miss, bad companies surprise. Avoid the casino. | days (3) |
| se-05 | Fundamental Floor | Require a minimum fundamental quality score — prevents chasing technically attractive junk. — Charts lie, fundamentals don't — make sure the company is actually solid | minScore (50) |
| se-06 | Momentum Entry Threshold | Require recent price momentum before entering — no dead money. Creates natural tension with the RSI… — Money in motion stays in motion — flat stocks waste your limited season runway | period (10), pct (2) |
| se-07 | Sector Freshness Check | Prevents sector concentration at entry time — if you already have 30% tech, don't add more tech. — Diversification happens at the door, not after the house is on fire | maxPct (30) |
| se-08 | Institutional Sentiment Check | Only enter stocks where big institutions are buying, not selling. Leverages 13F data as a leading i… — Follow the smart money — if BlackRock is buying, they probably know something | direction (stable_or_increased), quarters (2) |

### Exit & Stops

| ID | Title | Description | Params |
|----|-------|-------------|--------|
| sx-01 | Fixed Stop-Loss | The most fundamental risk rule. Sell any position that drops a set percentage from entry. Tight sto… — The #1 rule in trading: cut your losses. The only question is where. | pct (8) |
| sx-02 | Trailing Stop | Sell if position drops from its highest price since entry — protects gains by measuring from the pe… — Lock in gains automatically — you'll never give back your entire rally | pct (10) |
| sx-03 | Time-Based Exit | Close positions that aren't working within a time window. Dead money in a 4-week season wastes 25%… — Time is money — literally. A flat stock in a 20-day season is an expensive do-nothing. | days (5), pct (1) |
| sx-04 | Profit Target | Sell when a position hits a gain target — birds in the hand. Natural tension with Trailing Stop (lo… — Nobody went broke taking profits — but leaving money on the table hurts too | pct (15) |
| sx-05 | Technical Exit Signal | Sell on technical breakdown — RSI overbought, MACD crossover, or price dropping below its moving av… — Let the charts tell you when the party's over, not your gut | trigger (rsi_overbought), rsiThreshold (75), smaPeriod (20) |
| sx-06 | Earnings Exit | Sell positions before earnings to avoid overnight gap risk. The toggle is the key decision: protect… — Take profits before the dice roll — or hold through and hope for the best | days (2), onlyIfProfitable (true) |
| sx-07 | Correlation-Based Exit | If two holdings move together too closely, sell the weaker one. Sector diversity ≠ correlation dive… — Owning 3 tech stocks that move in lockstep isn't diversification — it's triple exposure | days (10), threshold (0.85) |

### Rebalancing

| ID | Title | Description | Params |
|----|-------|-------------|--------|
| sr-01 | Position Size Cap | Trim any position that grows too large — classic rebalancing. The gap between max and target determ… — No single stock should hold your portfolio hostage — cap the concentration | maxPct (15), targetPct (12) |
| sr-02 | Cash Deployment Trigger | If cash builds up past a threshold, prioritize finding new entries. Prevents accidentally becoming… — Cash earns zero in a 4-week sprint — deploy it or lose the race | pct (15) |
| sr-03 | Sector Drift Rebalance | If market moves push one sector too far from your starting allocation, rebalance back. Strategic as… — Markets will drift your portfolio into concentration — this rule fights back | tolerance (10) |
| sr-04 | Add to Winners | Increase positions that are working. Direct tension with Position Size Cap — combined strategy: add… — Double down on what's working — momentum is real, ride it | threshold (10), addPct (2) |
| sr-05 | Underperformer Reduction | Gradually reduce holdings that are lagging the S&P — softer than a hard stop-loss. Winners grow, lo… — Don't wait for a stop-loss — start trimming losers before they become catastrophes | threshold (5), days (5), reducePct (3) |

### Season State

| ID | Title | Description | Params |
|----|-------|-------------|--------|
| ss-01 | Benchmark Gap Aggression | If you're losing the race against the S&P after a certain week, shift to higher-beta entries to cat… — Losing by 3% in Week 3? Time to swing harder or accept defeat. | pct (3), week (2) |
| ss-02 | Lead Protection Mode | When you're ahead of the S&P, automatically tighten risk controls — protect the lead. The strategy… — You've built a lead — don't blow it. Shift from offense to defense. | pct (5), tightPct (5), maxBeta (1.2) |
| ss-03 | Final Week Lockdown | In the last week of the season, block all new entries. Prevents desperation plays. Conflicts with G… — The last week isn't for gambling — protect what you've built | enabled (true) |
| ss-04 | FOMC/CPI Defensive Rotation | Reduce high-beta exposure before major macro events — Fed meetings and CPI reports. Connects Fantas… — The Fed moves markets more than any earnings report — don't get caught flat-footed | reducePct (10), days (2) |
| ss-05 | Weekly Momentum Shift | After each week, automatically tilt toward sectors that are outperforming. Automated sector rotatio… — Ride the wave — if energy is ripping and tech is lagging, lean into energy | shiftPct (3) |
| ss-06 | Pit Stop Suggestion Priority | Controls how much weight your weekend stock suggestions get during entry scans. Meta-strategic: how… — Your agent works for you — but should it listen to your stock picks, or trust its own analysis? | priority (first_in_line) |

## Trading Style Collections

| ID | Name | Difficulty | Rule Count |
|----|------|------------|------------|
| swing-trader | Swing Trader | intermediate | 9 |
| day-trader | Day Trader | intermediate | 9 |
| momentum-rider | Momentum Rider | advanced | 9 |
| defensive-fortress | Defensive Fortress | intermediate | 9 |
| trend-surfer | Trend Surfer | intermediate | 9 |
| vwap-warrior | VWAP Warrior | intermediate | 7 |
| squeeze-hunter | Squeeze Hunter | intermediate | 7 |
| oversold-sniper | Oversold Sniper | intermediate | 7 |
| volume-detective | Volume Detective | beginner | 7 |
| rs-leader | RS Leader | beginner | 8 |
| triple-threat | Triple Threat | advanced | 8 |
| baggerbomb-native | BaggerBomb Native | advanced | 9 |

## Conflict Pairs

| Rule A | Rule B | Reason |
|--------|--------|--------|
| sx-01 | sx-02 | Fixed Stop-Loss and Trailing Stop can both trigger sells. The tighter one fires first. |
| sx-04 | sx-02 | Profit Target sells at a fixed gain. Trailing Stop would let it run further. Opposite philosophies. |
| sr-01 | sr-04 | Position Size Cap trims winners. Add to Winners adds to them. Check thresholds don't fight. |
| ss-01 | ss-03 | Benchmark Gap Aggression wants new entries. Final Week Lockdown blocks them. Lockdown wins in Week 4. |
| ss-02 | ss-01 | Lead Protection and Gap Aggression are opposite postures. Verify thresholds don't overlap. |
| se-06 | se-01 | Momentum Entry requires stocks moving up. RSI Gate may reject overbought. Ensure thresholds allow a sweet spot. |
| th-04 | th-05 | House Money Pursuit and Bird-in-the-Hand Lock are opposite strategies. Choose one. |
| gs-05 | gs-06 | Leading Defensive and Trailing Aggressive trigger at opposite score levels. Set your Par Score Target correctly. |
| gs-07 | th-10 | Satisficer's Lock disables trading, but Scoring Posture may want swaps. Choose your endgame. |
| th-10 | th-04 | Harvest posture swaps after BaggerBomb, but House Money holds. Mutually exclusive. |
| mb-01 | mb-09 | Signal Maturation Hold vs Catastrophic Loss Eject. Eject should always override. |
| mb-10 | mb-09 | Midday Lull blocks swaps, but Catastrophic Eject is an emergency. Eject should win. |
| mb-08 | mb-15 | Disposition Override protects winners, but VWAP Invalidation forces exits. VWAP overrides reversing winners. |
| th-01 | th-08 | Proximity Persistence holds near thresholds, Sunk-Cost Timeout gives up. Timeout should eventually override. |
| ts-01 | ts-04 | Volatility Cap may restrict a stock that Performance Rotation wants to promote. Cap takes precedence. |
| gs-10 | mb-11 | Reversal Fade avoids afternoon runners, Power Hour increases sensitivity. Choose your final-hour philosophy. |
| ts-07 | th-04 | Penalty Shielding demotes near penalties, House Money widens stops. If reversing toward Bust, shielding wins. |
