# FantasyTrades — Archetype Identity Contract (V1)

**Date:** June 1, 2026
**Status:** Locked. Ready to feed onboarding and the agent dashboard.
**Scope:** Identity layer only — user-facing names, one-line dispositions, reveal copy, voice lines, and the onboarding derivation (question set + mapping). This does **not** touch calibration (scoring weights, sector tilts, swap physics, randomness). Calibration is decoupled and stays exactly as built; identity only describes behavior that already exists.

---

## 1. The Six Archetypes

Each archetype has a permanent internal code-id (never changes) and a user-facing display name (the descriptive set, chosen so a new user reads the name and immediately pictures how the agent operates). Names render through `src/data/archetypeDisplay.js`.

| Code-id (internal) | Display name |
|---|---|
| `momentum_chaser` | Trend Follower |
| `contrarian` | Contrarian |
| `diversifier` | Diversifier |
| `degen` | Speculator |
| `analyst` | Fundamental Investor |
| `guardian` | Capital Preserver |

**Implementation note — resolver update required.** The currently-merged resolver holds the prior (gamey) names: Momentum Hunter, Degen, Contrarian, Analyst, Guardian, Broad Market Specialist. Adopting this contract means updating the display-name values in `archetypeDisplay.js` to the set above. Code-ids do **not** change, so nothing downstream of the resolver (scoring, prompts, telemetry) is affected — it is a contained edit to one file.

**Class titles retired at onboarding.** The prior gamey build-titles (Momentum Purist, Volatility Harvester, Careful Contrarian, Conviction Fortress, Risk Fortress, Flow Rider) are **not** surfaced in the reveal. The descriptive archetype name now carries the identity; the reveal leads with the name plus the agent's actual default traits ("here's how it's built") rather than a build-name. (The class-title strings can remain in code as internal/legacy; they simply aren't shown in the onboarding reveal.)

---

## 2. Identity Contract — per archetype

For each archetype: a one-line **disposition** (the essence), the **reveal** copy ("what you are / how it trades", shown on the reveal screen and the dashboard), and the agent's first-person **voice** line. Every reveal names the tradeoff, not just the upside — the honest register.

### Trend Follower — `momentum_chaser`
- **Disposition:** Goes where the momentum is — and leaves the moment it fades.
- **Reveal:** You buy strength, not bargains. When a name or sector is clearly trending up on real volume, you pile in; when the trend breaks, you cut it without sentiment. You'll concentrate in whatever's hot rather than spread thin — and you'd rather miss the exact bottom than sit in a loser.
- **Voice:** "I trade what's working. Show me a clean uptrend and I'm in — but the second momentum rolls over, I'm out."

### Contrarian — `contrarian`
- **Disposition:** Buys what everyone else is giving up on.
- **Reveal:** You move against the crowd. A name that's beaten down and out of favor is exactly what interests you, and when everyone's piling into the obvious winner you stay away. It takes patience — you're betting the market overreacted and will come back, which doesn't always happen on your schedule.
- **Voice:** "I go where the crowd isn't. If everyone's selling it, that's usually when I start looking."

### Diversifier — `diversifier`
- **Disposition:** Spreads the bets so no single one can sink you.
- **Reveal:** You don't bet the house on any one idea. Your edge is staying spread across many sectors, so when one blows up the rest carry you. You trade breadth over depth — smaller positions across a wider field — which smooths the ride but means you rarely land a single huge winner.
- **Voice:** "I don't put it all in one basket. I'd rather own a bit of everything and let the spread do the work."

### Speculator — `degen`
- **Disposition:** Chases the biggest swings and wears the risk.
- **Reveal:** You're here for the big moves. Volatility is the point, not the problem — you chase the names with the widest swings and mostly ignore what the fundamentals say. The upside is explosive; the cost is that you'll take some hard hits, and you're fine with that.
- **Voice:** "I'm not here to play it safe. Give me the names that actually move — I'll take the swings, good and bad."

### Fundamental Investor — `analyst`
- **Disposition:** Buys quality companies and lets the fundamentals do the work.
- **Reveal:** You buy good businesses, not lottery tickets. Strong balance sheets, real earnings, blue-chip quality — that's what gets your money, and you're slow and deliberate about it. You won't catch every hot run, but you're rarely left holding something that was never worth owning.
- **Voice:** "I buy companies I'd be comfortable holding. Show me the fundamentals and I'll tell you if it's worth it."

### Capital Preserver — `guardian`
- **Disposition:** Protects the downside before chasing any upside.
- **Reveal:** Your first job is not losing money. You move slowly, trade rarely, and lean defensive — built to come through a bad stretch intact rather than to top the leaderboard in a good one. You'll give up some upside for that safety, and that's a trade you're happy to make.
- **Voice:** "Rule one is don't lose it. I'd rather protect what we've got than reach for a risky win."

---

## 3. Onboarding Derivation — Question Set

**Purpose:** place a new user into one of the six from a few preference questions, so the result feels *discovered* rather than picked off a menu. **Question-only** — the user's stock picks do **not** feed the archetype (cleaner, avoids muddying the result).

**Why three questions:** four archetypes are separated by *what buy-signal you trust* (Trend Follower / Contrarian / Fundamental Investor / Speculator); the other two are *portfolio philosophy* (Diversifier = spread, Capital Preserver = protect). A buy-signal-only quiz structurally can't reach the latter two — which is why the prior quiz reached only four. This set probes both facets.

### Q1 — Risk posture. *"How should your agent treat risk?"*
- **A.** Swing big — biggest gains, can stomach big losses  *(aggressive)*
- **B.** Balanced — grow steadily, measured risk  *(balanced)*
- **C.** Protect first — avoid big losses even if I miss gains  → **Capital Preserver**

### Q2 — Buy signal. *"What makes a stock worth buying?"*
- **A.** It's clearly trending up  → **Trend Follower**
- **B.** It's beaten down and out of favor  → **Contrarian**
- **C.** The company's underlying health is strong  → **Fundamental Investor**
- **D.** It's volatile enough to move big  → **Speculator**
- **E.** Doesn't matter — I'd rather own a broad mix  → **Diversifier**

### Q3 — Concentration. *"How do you want our positions spread?"*
- **A.** Go big on a few strong ideas  *(concentrate)*
- **B.** Spread wide so no single bet matters  *(spread)*

### Mapping (precedence)
The deterministic default and fallback. Haiku performs the final mapping from the full answer set; this precedence is what it defaults to.

1. **Q1 = C (Protect first) → Capital Preserver.** Protect-first is the dominant signal and overrides the buy-signal answer. (This is also the anchor that separates the defensive Capital Preserver from the merely-spread Diversifier.)
2. **Else if Q2 = E (broad mix) OR Q3 = B (spread wide) → Diversifier.**
3. **Else route by Q2 buy-signal:** A → Trend Follower · B → Contrarian · C → Fundamental Investor · D → Speculator.
4. **Q1 (A vs B) and Q3 are secondary signals.** Haiku uses them to set conviction/intensity and to resolve contradictory combinations (e.g., "swing big" + "broad mix"). Clean combinations don't require them.

All six are reachable.

**Presentation is out of scope here.** Whether these are asked conversationally (Gemma) or as tappable cards is an onboarding-build decision; the derivation logic is identical either way.

---

## 4. What this unblocks

- **Onboarding redesign** — the reveal copy (§2) and the derivation (§3) are the two things onboarding needed and was previously blocked on.
- **Agent dashboard** — renders the display name + disposition + reveal from §2.

**Carried as the one implementation prerequisite:** update the display names in `archetypeDisplay.js` (per §1) before onboarding/dashboard render against this contract.
