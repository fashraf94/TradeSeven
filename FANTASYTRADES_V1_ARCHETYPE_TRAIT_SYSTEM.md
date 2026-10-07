# FantasyTrades — V1 Archetype + Trait System (build-ready)

*The stable definition the agent-first UI builds against. Two user-facing concepts only: **Archetype** and **Traits**. Everything else (rules, bundles, collections, the Discover tab, Season dimensions) stays invisible or out of V1.*

---

## The model in one line

**Your agent = 1 Archetype + up to 6 Traits.**

The archetype is derived from the onboarding quiz and ships with a sensible **default trait set** already equipped, so the agent is complete and deployable the moment it's created. The user can swap any default out or add more, up to the trait limit. Rules are written invisibly underneath — the user never touches them.

---

## Two layers: the engine and the driving style

This is the most important thing to hold, because it's how the system actually behaves at runtime:

- **The archetype is the engine.** It sets the *hard mechanics* — stop levels, hurdle rates, the swap circuit breaker, how aggressively the agent rotates. These are enforced deterministically and **cannot be overridden** by traits.
- **The traits are the driving style.** They're advisory instructions to the agent's trading brain about *how to behave within the engine's limits* — which stocks to favor, when to lean toward holding vs. swapping. Traits shape **judgment**, not the hard mechanics.

This is why two agents of the *same* archetype share the same risk envelope but still feel different: the engine is identical, the driving instructions differ. Trait differentiation is real, but it lives in the agent's judgment, not in the hard rules.

---

## 1. The six archetypes

The base personality. One per agent, derived from the 5-question quiz (the user doesn't pick from a menu).

| Code id | Display name | In one line | Feel |
|---|---|---|---|
| `momentum_chaser` | Momentum Hunter | Chases trends and breakouts, trades often | Aggressive · trend |
| `degen` | Degen | Maximum aggression on the most volatile names | Max aggressive · volatile |
| `contrarian` | Contrarian | Goes against the crowd, buys what others sell | Aggressive · mean-reversion |
| `analyst` | Analyst | Data-driven and patient, waits for high conviction | Measured · quality |
| `guardian` | Guardian | Protects capital and avoids blow-ups above all | Defensive · preservation |
| `diversifier` | Broad Market Specialist | Spreads across sectors, rotates into strength | Balanced · rotation |

*6 is the V1 roster. The variety you wanted from "10–15" lives in the trait combinations (6 archetypes × trait swaps), not in 15 separate archetypes. Adding archetypes later is trivial — the structure supports it — but V1 ships the clean six.*

---

## 2. The sixteen traits (the building blocks)

A trait is a named behavior bolted onto the archetype. Traits are organized into three DNA groups. **A user can equip up to 2 traits per group — 6 total.**

Each trait has an **intensity** (Subtle / Moderate / Dominant, default Moderate). Intensity controls *how strongly the trait shows up in the agent's thinking* — how emphatically the agent is told to lean that way. It does **not** change the archetype's hard mechanics. (See "What traits actually do at runtime" below.)

### Instincts — what patterns the agent recognizes

| Trait | What it does |
|---|---|
| Trend Rider | Trusts the trend and buys the pullback |
| Bargain Hunter | Targets stocks that have been beaten down too far |
| Squeeze Whisperer | Detects compressed volatility before the explosive move |
| Volume Believer | Only trusts moves that institutional money confirms |
| Breakout Chaser | Wants stocks making new highs with momentum behind them |
| Smart Money Tracker | Follows where institutional capital is flowing |

### Strategy — how the agent makes decisions

| Trait | What it does |
|---|---|
| Threshold Harvester | Banks scoring bonuses and rotates into the next opportunity |
| Dual Conviction | Requires fundamentals and technicals to agree before committing |
| Score Adaptor | Plays differently when winning than when losing |
| Sector Rotator | Rides the sector wave and picks each sector's champion |
| Penalty Dodger | Protects the score from catastrophic damage above all else |

### Discipline — how the agent manages risk and holding

| Trait | What it does |
|---|---|
| Iron Discipline | Leans toward cutting losers quickly and not chasing a falling position |
| Patient Holder | Gives picks time to work instead of reacting to every dip |
| Active Trader | Leans toward rotating into what is working right now |
| Diversifier | Spreads risk across sectors so no single bet sinks the ship |
| Let Winners Run | Leans toward holding the best picks through scoring thresholds |

*Copy note: the Discipline traits are written as leanings, not as enforced thresholds. The UI must not surface specific numbers (e.g. "stops at −1.0 ATR") for these — those numbers are set by the archetype's engine, not the trait. See below.*

---

## 3. The default sets (the core mapping)

Each archetype ships with three traits pre-equipped, chosen to (a) match the archetype's personality, (b) keep the close pair — Guardian and Broad Market Specialist — clearly distinct, and (c) leave 3 of the 6 slots open.

A nice payoff: **every default set's trait pair lands on a built-in combo "Class Title,"** so a brand-new agent has a flavorful RPG-style identity from the first second (e.g. "Guardian — the Risk Fortress").

| Archetype | Default traits (3) | Class Title (auto) | What it does out of the box |
|---|---|---|---|
| **Momentum Hunter** | Trend Rider · Breakout Chaser · Let Winners Run | Momentum Purist | Rides trends, chases breakouts, holds winners through thresholds |
| **Degen** | Squeeze Whisperer · Breakout Chaser · Active Trader | Volatility Harvester | Hunts coiled volatility, chases breakouts, rotates fast |
| **Contrarian** | Bargain Hunter · Iron Discipline · Penalty Dodger | Careful Contrarian | Buys beaten-down bounces with a quick exit lean and trap protection |
| **Analyst** | Dual Conviction · Patient Holder · Iron Discipline | Conviction Fortress | Demands fundamentals + technicals agree, then holds with discipline |
| **Guardian** | Diversifier · Penalty Dodger · Iron Discipline | Risk Fortress | Spreads risk, dodges penalties, leans toward cutting losers — built to avoid blow-ups |
| **Broad Market Specialist** | Smart Money Tracker · Sector Rotator · Score Adaptor | Flow Rider | Follows institutional flow, rotates into leading sectors, adapts to the score |

**Slot usage** (all legal — max 2 per group, 3 slots left open each):

| Archetype | Instincts | Strategy | Discipline |
|---|---|---|---|
| Momentum Hunter | Trend Rider, Breakout Chaser | — | Let Winners Run |
| Degen | Squeeze Whisperer, Breakout Chaser | — | Active Trader |
| Contrarian | Bargain Hunter | Penalty Dodger | Iron Discipline |
| Analyst | — | Dual Conviction | Patient Holder, Iron Discipline |
| Guardian | — | Penalty Dodger | Diversifier, Iron Discipline |
| Broad Market Specialist | Smart Money Tracker | Sector Rotator, Score Adaptor | — |

How Guardian and Broad Market Specialist stay distinct (they were the closest pair): **Guardian** is static defense — spread to *avoid* losses, lean toward cutting fast, don't churn (Risk Fortress). **Broad Market Specialist** is active rotation — follow the flow and chase the leading sector (Flow Rider). Same "spread" instinct, opposite intent.

---

## 4. What traits actually do at runtime (the reality)

Confirmed by execution audit. This is what's actually true in the engine today:

- **Every trait reaches the agent's trading brain** — both at deploy (building the roster) and during the live, mid-battle evaluations. No trait is inert. They are injected as guidance the brain "should follow but may deviate from."
- **The archetype's hard mechanics are enforced separately and cannot be overridden by any trait.** Stops, hurdle rates, the swap circuit breaker, forced rotation, and catastrophic eject all come from the archetype's engine config — never from a trait's numbers.
- **Selection-flavored traits** (Trend Rider, Breakout Chaser, Squeeze Whisperer, Bargain Hunter, Dual Conviction, Diversifier, Sector Rotator) do their primary work at **deploy**, shaping the roster. Mid-battle they remain as soft guidance that can bias the brain's bench picks.
- **Judgment traits** (Let Winners Run, Patient Holder, Active Trader, Score Adaptor, Smart Money Tracker, Penalty Dodger) bias the **live** hold/swap decisions every evaluation tick.
- **The Discipline risk traits** (Iron Discipline especially) reinforce *in the agent's thinking* what the archetype's engine already enforces *mechanically*. They're complementary — the trait nudges the brain, the engine guarantees the floor — which is exactly why their copy is written as leanings, not enforced numbers.
- **Intensity = emphasis, not mechanics.** A higher intensity makes the instruction more emphatic in the prompt the brain reads; it does not retune the engine.

**One-line summary for the team:** traits are a personality/judgment layer; the archetype is the mechanical layer. Both are real; only the archetype is deterministic.

---

## 5. How it works (the whole loop)

1. User answers the 5-question quiz → archetype is derived.
2. The agent is created **with its default trait set already equipped** — complete and battle-ready immediately.
3. The user can swap any default trait out, or add more, up to 2 per group / 6 total. Optionally set intensity (default Moderate).
4. Deploy.
5. **Trait changes apply to the agent's next battle.** While a battle is live, the loadout is locked — the agent's instructions are snapshotted at deploy, so editing them mid-battle would have no effect until redeploy. The UI should reflect this ("changes apply to your next battle").

No raw rules, no bundle-building, no rule library to browse.

---

## 6. Naming (locked)

- **Degen** — kept.
- **Broad Market Specialist** — the sixth archetype's display name (was "Diversifier"). This frees the word "Diversifier" to mean only the trait, removing the exact archetype/trait collision and reading more clearly to newcomers.
- Retire the old collection display names (`momentum-hunter`, `momentum-rider`, Swing/Day Trader collections, etc.) so there aren't multiple "Momentum" things; collections are demoted to the default-set / preset mechanism.

---

## 7. Deliberately out of scope for V1

Exist in the codebase, not part of the V1 experience, none blocks launch:

- **Rule bundles** and user rule-picking / the Discover tab — power-user surface, can return later.
- **Quick Start "collections"** as their own system — they collapse into the default sets above.
- **Season dimension system** — separate game mode, post-launch.
- **Sector / volume tilts (Stream D)** — refine archetype behavior in the backend later, invisibly; the contract leaves room but doesn't wait on them.
- The **StarterKit** 3-question rules quiz — redundant once the archetype seeds a default set; absorb it.

---

## 8. Known follow-ups (post-launch, deliberately deferred)

Surfaced by the execution audit. None blocks V1; all are optional upgrades to fidelity.

- **Make intensity mechanically real.** Wire trait intensity to *modulate* the archetype's engine config (e.g. Iron Discipline Dominant tightens the circuit breaker beyond the archetype default). This makes the dial change behavior, not just language — but it touches the deterministic risk engine, so it's a careful, post-launch change.
- **Voice Layer trait attribution.** Today the narrator can say "risk management forced this" but not "held because of Let Winners Run." Enabling that requires a server-side rule→trait map (the existing map is client-only) plus passing the equipped traits into the Voice Layer prompt.
- **Live re-equip.** If we want trait changes to take effect mid-battle, the evaluation cron must refresh the agent's rule snapshot each tick (it's frozen at deploy today). The V1 answer is simpler: lock the loadout during a live battle (§5).
- **Watch trait differentiation.** Because same-archetype differentiation is advisory (the brain "may deviate"), monitor real battles to confirm trait differences actually surface in behavior. If they don't, tune default sets toward traits orthogonal to each archetype's engine (i.e. things the brain genuinely controls) rather than risk levers the engine already owns.

---

## 9. Status

- **Locked:** the 6-archetype roster; display names; the default sets; and the advisory framing for the engine-overlap traits (intensity and risk-trait copy are leanings, not enforced numbers).
- **Tunable later:** display-copy polish; default-set tuning once real battles give feedback.

This is the complete V1 definition. The UI has everything it needs to build the loadout, and the backend tuning (Stream D sector/volume, physics calibration, the post-launch fidelity upgrades above) can keep evolving behind it without touching any of this.
