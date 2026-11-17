# Direction note "BaggerBomb as the trading game" — Amendment A

**Date:** 15 Nov 2026 · **Author:** Fable (the BaggerBomb revamp chat) · **Status:** adopted by the founder, 15 Nov 2026 ("Yes to all"), except BB-24, which is proposed
**Amends:** `DIRECTION_NOTE_BAGGERBOMB_TRADER_GAME_NOV13_2026.md` (BB-1 to BB-22)
**Destination:** this project. Committed to `docs/design/` by the league-hide build, with the direction note and the ruling sheet. No docs-only PR.

## 1. What was adopted

The ruling sheet `BAGGERBOMB_TRADER_GAME_RULING_SHEET_POST_PHASE0_NOV15_2026.md`, as revised on the evening of 15 Nov, is adopted in full: rulings R-A to R-G, the cockpit chat's C-1 to C-6 with Fable's two changes, and the answers to the discovery's 31 questions. Its header still reads "proposed"; this amendment is the record.

## 2. Changes to the BB rulings

- **BB-3, amended.** One ranked length at launch: 3 trading days, Agent vs Agent, starting at the next open. A one-day game stays as Agent vs CPU practice. Both run trader v1. The 5-day format comes after launch.
- **BB-7, amended.** Every battle gets its stop and target check every round, whether or not the model is called. Prices are read through one seam: the evaluator's own quote today, the shared price when the capacity lane's market-data plan lands. Exits sell to cash.
- **BB-21, amended.** The cockpit's launch set gains the close tasks (hold overnight, flatten). Opening the beta to 25 players waits on the capacity lane; building does not.
- **BB-23, new, measured before adopted.** With code running stops and targets, the agent's scheduled check moves from every 15 minutes to every 30, plus event checks (a fill, a big move, a cockpit command). Measured from stored checks with no model call, by the replay pack.
- **BB-24, new, proposed, measured before adopted.** The trading brain moves from Claude Haiku 4.5 to Claude Haiku 5.5. Measured by the replay pack's model comparison, which runs only on the founder's word and inside a $5 cap.

## 3. Cost, corrected (replaces §4 of the direction note)

Measured by the capacity lane: about 20 model calls per battle-day at about 2.5 cents each on Haiku 4.5. That is about $0.50 per player per trading day, about $10 a month per player always in a battle, about $250 a month at 25 players, for the trading agent alone.

List prices checked on 15 Nov 2026, per million tokens:

| | Input | Output | Cache read | 1-hour cache write | Batch |
|---|---|---|---|---|---|
| Haiku 4.5 | $1.00 | $5.00 | $0.10 | $2.00 | half price |
| Haiku 5.5 (prompts up to 100,000 tokens) | $0.10 | $0.50 | $0.01 | $0.20 | half price |

Levers, in order of size. None is adopted until measured.

1. **The model (BB-24).** At list price Haiku 5.5 is a tenth of Haiku 4.5. The same 20 calls would cost about $25 a month at 25 players.
2. **Fewer calls (BB-23).** Stops and targets move to code, so the model is called on a schedule and on events, not on most checks.
3. **Caching.** The part of the prompt that repeats is put first and read from the cache.
4. **Batch.** Reflection, the daily review and notes, where nobody is waiting.

## 4. First tasks (three, in parallel)

| Task | Prompt | Session |
|---|---|---|
| Hide the league, the BaggerBomb page | `BUILD_PROMPT_LEAGUE_HIDE_BAGGERBOMB_PAGE_NOV15_2026.md` | Sonnet 5.5 with the Opus advisor |
| Security fix pack | `FIX_PROMPT_SECURITY_PACK_LEAGUE_VIEW_NOV15_2026.md` | Opus |
| Replay pack | `EXPERIMENT_PROMPT_TRADER_GAME_REPLAY_PACK_NOV15_2026.md` | Opus, local |
