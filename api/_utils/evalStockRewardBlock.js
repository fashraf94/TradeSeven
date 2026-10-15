// api/_utils/evalStockRewardBlock.js
//
// BaggerBomb stock thresholds v2, Ruling 10 (docs/approvals/
// BAGGERBOMB_STOCK_THRESHOLDS_V2_PILOT_20261015.md). The tiered eval system
// prompt's reward prose — the threshold rules, the proximity rule, the
// survival-mode bust machinery and the worked monologues — rendered per game.
//
// A corrected (measured-model) game scores each stock against its FROZEN
// MEASURED % (src/utils/stockThresholdModel.js: multiplier = gain% from the
// fill / scoringPct), not baseATR. Its prompt says so, with worked examples in
// that unit. A legacy game gets the exact pre-v2 text: every LEGACY_* string
// below is the fenced template's own prose, byte for byte, so legacy prompts
// and their goldens are unchanged.
//
// THE SPLICE (DR-13 flag-split pattern, BUILD_RULES §1): buildEvalSystemPrompt
// in the fenced agentEvalPromptAssembly.js takes `{ measuredStockReward }` and
// calls these four renderers where the static prose stood. The flat6 template
// never calls them (tournaments are never corrected). Registered in
// PROMPT_CONTRIBUTING_MODULES (__fixtures__/promptHonestyRegistry.js) in the
// same commit as the splice. No imports: pure text.

export const LEGACY_STOCK_REWARD_RULES = 'Threshold bonuses (flat, triggered when ATR multiplier = priceChange% / baseATR crosses level):\n  +1.0x ATR → BaggerBomb: +15 pts\n  +1.5x ATR → DoubleBagger: +30 pts\n  +2.0x ATR → TenBagger: +50 pts\n\nThreshold penalties:\n  -1.0x ATR → Bust: -10 pts\n  -1.5x ATR → Crash: -20 pts\n  -2.0x ATR → Meltdown: -35 pts';

export const MEASURED_STOCK_REWARD_RULES = 'Threshold bonuses (flat). Each stock position has a FROZEN MEASURED %: its 14-day measured ATR as a percent of price, fixed for the life of the position when it is entered (ACTIVE POSITIONS shows it as "frozen X%"). Reward multiple = priceChange% from the position\'s fill / its frozen measured % — the divisor is never baseATR. Crypto positions keep ATR multiplier = priceChange% / baseATR.\n  +1.0x → BaggerBomb: +15 pts\n  +1.5x → DoubleBagger: +30 pts\n  +2.0x → TenBagger: +50 pts\n\nThreshold penalties:\n  -1.0x → Bust: -10 pts\n  -1.5x → Crash: -20 pts\n  -2.0x → Meltdown: -35 pts\n\nWorked example: fill $100.00, frozen 2.000000% → BaggerBomb at $102.00, DoubleBagger at $103.00, TenBagger at $104.00; Bust at $98.00, Crash at $97.00, Meltdown at $96.00. A quote of $101.00 is a +0.50x reward multiple. A quote at or beyond a target crosses it, and an earned tier stays earned for that position\'s life.';

export const LEGACY_STOCK_THRESHOLD_PROXIMITY = '6. THRESHOLD PROXIMITY:\n   - If an active stock is within 0.2x ATR of a bonus (+15/+30/+50), HOLD.\n     Let it earn the bonus.\n   - If an active stock is within 0.2x ATR of a penalty (-10/-20/-35),\n     seriously consider cutting it before the penalty locks in.';

export const MEASURED_STOCK_THRESHOLD_PROXIMITY = '6. THRESHOLD PROXIMITY:\n   - If an active stock is within 0.2x of a bonus (+15/+30/+50) in its own\n     reward multiple (0.2 × its frozen measured %; "lock true" in ACTIVE\n     POSITIONS), HOLD. Let it earn the bonus.\n   - If an active stock is within 0.2x of a penalty (-10/-20/-35) in its own\n     reward multiple, seriously consider cutting it before the penalty locks in.';

export const LEGACY_SURVIVAL_MACHINERY = 'You have explicit permission to OVERRIDE user directives if live data shows a position has breached -1.0x ATR (Bust) or is accelerating toward it with no sign of reversal. If you override a directive, you MUST set ignoredDirectiveIds to the IDs of the directives you are breaking and explain why in your rationale.';

export const MEASURED_SURVIVAL_MACHINERY = 'You have explicit permission to OVERRIDE user directives if live data shows a position has breached its -1.0x Bust level (one frozen measured % below its fill for a stock; -1.0x ATR for crypto) or is accelerating toward it with no sign of reversal. If you override a directive, you MUST set ignoredDirectiveIds to the IDs of the directives you are breaking and explain why in your rationale.';

export const LEGACY_STOCK_MONOLOGUE_EXAMPLES = 'Example HOLD monologue:\n"AMD is down 1.85% from my entry, sitting at 0.74x ATR. Uncomfortable, but the broader market is getting hammered too — QQQ is down 2.3%, so AMD is actually outperforming its sector. MSFT on my bench looks strong at +1.4% today, but with only 1h 45m left in the trading day, a new position won\'t have time to reach the 1.0x ATR bonus. I\'m holding. **Hypothesis: AMD will recover toward -1.0% by tomorrow\'s open as the sector-wide sell pressure eases overnight.**"\n\nExample SWAP monologue:\n"DIS has been trending down since entry — now at -1.42%, which is 0.71x ATR. The entertainment sector is flat today while DIS keeps sliding, meaning this is stock-specific weakness, not a macro move. Meanwhile MSFT is up 1.42% on a day where QQQ is only up 0.3% — genuine relative strength. With 2 full trading days left, MSFT has plenty of runway. I\'m cutting DIS at Support tier (1.0x multiplier, locking in only -2.1 pts) and riding MSFT\'s momentum. **Hypothesis: MSFT will reach its 1.0x ATR threshold (+1.8%) within the next trading day based on its current momentum relative to the market.**"\n\nExample SURVIVAL MODE monologue:\n"NVDA just broke -3.5%, which is 1.09x its ATR — Bust penalty triggered. It\'s now bleeding -10 base points PLUS the -10 Bust penalty at Star tier (2.0x multiplier on base). I know directive d1 says \'keep NVDA in Star\' but Survival Mode overrides this — the damage per minute at this level is catastrophic. I\'m rotating to GOOG (flat today, tighter 2.4% ATR) to stop the hemorrhaging. **Hypothesis: NVDA will continue declining through end-of-day as momentum sellers pile on, validating the defensive exit.**"';

// Worked arithmetic: 1.85 / 2.5 = 0.74x; 1.42 / 2.0 = 0.71x and -1.42 × 10 ×
// 1.0 = -14.2 base points; 3.5 / 3.21 ≈ 1.09x and -3.5 × 10 × 2.0 = -70.
export const MEASURED_STOCK_MONOLOGUE_EXAMPLES = 'Example HOLD monologue:\n"AMD is down 1.85% from my fill, which is 0.74x its frozen measured 2.5%. Uncomfortable, but the broader market is getting hammered too — QQQ is down 2.3%, so AMD is actually outperforming its sector. MSFT on my bench looks strong at +1.4% today, but with only 1h 45m left in the trading day, a new position won\'t have time to reach its 1.0x BaggerBomb level. I\'m holding. **Hypothesis: AMD will recover toward -1.0% by tomorrow\'s open as the sector-wide sell pressure eases overnight.**"\n\nExample SWAP monologue:\n"DIS has been trending down since entry — now at -1.42% from my fill, which is 0.71x its frozen measured 2.0%. The entertainment sector is flat today while DIS keeps sliding, meaning this is stock-specific weakness, not a macro move. Meanwhile MSFT is up 1.42% on a day where QQQ is only up 0.3% — genuine relative strength. With 2 full trading days left, MSFT has plenty of runway. I\'m cutting DIS at Support tier (1.0x multiplier, locking in -14.2 pts) and riding MSFT\'s momentum. **Hypothesis: MSFT will reach its BaggerBomb level (1.0x its frozen measured %, +1.8% from its fill) within the next trading day based on its current momentum relative to the market.**"\n\nExample SURVIVAL MODE monologue:\n"NVDA just broke -3.5% from my fill, which is 1.09x its frozen measured 3.21% — Bust penalty triggered. It\'s now bleeding -70 base points PLUS the -10 Bust penalty at Star tier (2.0x multiplier on base). I know directive d1 says \'keep NVDA in Star\' but Survival Mode overrides this — the damage per minute at this level is catastrophic. I\'m rotating to GOOG (flat today, measuring a tighter 2.4% daily range) to stop the hemorrhaging. **Hypothesis: NVDA will continue declining through end-of-day as momentum sellers pile on, validating the defensive exit.**"';

export const renderStockRewardRules = (measured = false) => (measured === true ? MEASURED_STOCK_REWARD_RULES : LEGACY_STOCK_REWARD_RULES);
export const renderStockThresholdProximity = (measured = false) => (measured === true ? MEASURED_STOCK_THRESHOLD_PROXIMITY : LEGACY_STOCK_THRESHOLD_PROXIMITY);
export const renderSurvivalMachinery = (measured = false) => (measured === true ? MEASURED_SURVIVAL_MACHINERY : LEGACY_SURVIVAL_MACHINERY);
export const renderStockMonologueExamples = (measured = false) => (measured === true ? MEASURED_STOCK_MONOLOGUE_EXAMPLES : LEGACY_STOCK_MONOLOGUE_EXAMPLES);
