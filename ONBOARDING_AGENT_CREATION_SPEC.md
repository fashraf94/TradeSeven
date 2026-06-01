# Onboarding & Agent Creation Spec
### "Build your agent" as the new-user experience

**Status:** Design finalized. Reuses the existing conversational creation + Haiku archetype derivation. The genuinely new work is three surfaces — the stock-pick step, the color step, and the reveal — plus routing wiring.
**Prerequisite for:** the Command Dashboard redesign (the dashboard's cold-start depends on this shipping first).

---

## How to use this document

- **Claude Design** — the three surfaces under "New design surfaces" are the design work. Everything else is assembly of existing parts.
- **Future implementation (Claude Code)** — the Reuse / Wire / Build map is the implementation skeleton; this is not itself an implementation spec.
- **Cross-doc** — this reconciles with the Command Dashboard Redesign Brief (see Cross-doc reconciliation). The dashboard brief will be updated once this is locked.

---

## What already exists (from the read-only audit)

Confirmed in code, not just docs:

- **Conversational creation is built and reachable** — `AgentCreationFlow.jsx` (4 preference questions + a name step), rendered when the user has no agent, reached via the Agent nav tab.
- **Archetype is derived, not chosen** — answers POST to `/api/agent/create-profile`, which calls Haiku and returns an archetype constrained to the six valid archetypes, with a server-side fallback. This is the expensive part, and it works.
- **A reveal step already exists** (the final step of the current flow).
- **The agent data model is rich** — the `agents` doc already has both loadout slots: `equippedWatchlistId` (watchlist) and `equippedBundleIds` (rules).
- **The watchlist engine exists** — create / commit / equip, and `decide.js` consumes the equipped watchlist. It lives in the Forge today, not in creation.
- **Color is auto-derived** — a two-hex `avatarColors` gradient from the model; no user choice, and it does not map to the dashboard accent tokens. "Color fusion" exists nowhere in code.
- **New users are never routed into creation** — after auth they're force-routed to the Compete dashboard; the only path to creation is self-navigating to the Agent tab. This is the core gap.

---

## Target flow (end to end)

`signup / auth` → **route: no agent → creation** → Welcome → **Stock pick** → Temperament questions (×3) → Name → **Color** → [Haiku derivation] → **Reveal** → land on Home with the agent equipped.

| Step | New or existing | Job |
|------|-----------------|-----|
| Route to creation | Wire (new) | Agent-less users land in creation, not the dashboard |
| Welcome | Existing | "Let's build your agent" |
| Stock pick | **Build** | Risk-grouped list; picks become a committed, equipped starter watchlist + a sector/risk read for archetype |
| Temperament ×3 | Existing (reordered) | The 3% drop, loss-lesson, and risk-approach questions; primary archetype signal |
| Name | Existing | Name the agent |
| Color | **Build** | Pick a primary color → avatar gradient + dashboard accent |
| Derivation | Existing | Haiku derives the archetype |
| Reveal | Existing step, elevated | Payoff + teaching + bridge to home |
| Land on home | Wire (new) | Agent equipped; ready to deploy |

The existing sector question (Q3) is replaced by the stock-pick step, which now supplies the sector affinity.

---

## Locked decisions

- **Risk-grouped stock list.** Names are grouped by risk tier (e.g. steadier names like LLY/NEE vs. higher-octane names like BE/RKLB). This teaches risk by inspection, gives the starter watchlist a legible character, and supplies a light risk signal. Pick range: **3–8**.
- **Temperament drives the archetype; stocks build the watchlist.** Two users who both pick NVDA/AAPL should be able to end up as different archetypes. The temperament questions are the primary derivation signal; the stock picks contribute only a secondary risk/sector read. The lever is how the `create-profile` prompt weights its inputs — temperament first, holdings second.
- **Color is one primary, chosen from a base palette, and it drives both the avatar and the dashboard accent.** Store a single primary color (deriving the gradient from it) so the future fusion mechanic has a clean thing to combine. The user's pick overrides the auto-derived `avatarColors`.
- **The starter watchlist must be committed (not draft) and equipped to the new agent at completion** — `decide.js` won't fully use a draft.
- **Minimal scaffolding for v1.** No guided tour. Education is inline — the reveal explains the archetype.
- **Onboarding ends at the reveal → home.** The first deploy and the agent introducing itself before the first battle are the dashboard's job, not onboarding's.

---

## New design surfaces (Claude Design)

### 1. Stock-pick step
"Which names do you like?" A curated list grouped into risk tiers, recognizable names plus a few interesting ones per tier. Tap to select, 3–8. Copy frames it as a lean, not a cage ("your agent will lean toward these, not be limited to them"). On completion: build a committed watchlist from the picks, derive sector affinity (and a risk read) from them, and equip the watchlist to the new agent.

### 2. Color step
"Pick your agent's color." A small on-brand base palette. The choice sets a single primary color that drives the avatar gradient and the dashboard accent. Framed as identity. (Future: more colors are earned and fused through play — out of scope here.)

### 3. Reveal screen — the centerpiece
This is the one surface that deserves real design attention; it does three jobs at once:
- **Payoff** — "Meet [Name]," the agent shown in its chosen color.
- **Teaching** — the archetype it was matched to, in plain language (what it means and how it'll behave), since the archetype was derived, not chosen.
- **Bridge** — it shows the loadout the user just built (archetype + starter watchlist + color), which is exactly what the dashboard bench will show, so it teaches the bench implicitly.
The agent can speak its first line here (the Haiku-derived greeting), in its voice. CTA leads into Home with the agent equipped.

---

## Reuse / Wire / Build (implementation map)

**Reuse as-is:** the conversational flow + Haiku archetype derivation, the reveal step, the name step, the archetype→behavior pipeline (`decide.js`), and the watchlist engine + equip slot + consumption.

**Wire (connect existing pieces):**
- Route agent-less users into creation after auth, instead of the dashboard. Wait for the agent subscription to resolve before deciding, so there's no flash of dashboard then redirect.
- `onComplete` currently only logs — it must equip the watchlist, persist the chosen color, and navigate to home.

**Build (new):**
- The stock-pick step: UI + build/commit/equip the starter watchlist (reusing the existing watchlist functions) and derive sector affinity from the picks.
- The color step: base-palette picker → single primary → avatar gradient + dashboard accent.
- Adjust the `create-profile` payload/prompt: sector affinity now comes from the ticker picks (plus a risk read), and the prompt weights temperament over holdings.

---

## Data writes (target state)

- **agent doc:** `name`; `archetype` (derived); `config`; `personality` (incl. `creationAnswers` and `sectorAffinity` derived from picks); a single primary color driving `avatarColors`; `equippedWatchlistId` / `equippedWatchlistName` / `equippedAt` (the starter watchlist); `equippedBundleIds: []` (rules slot stays open).
- **watchlist doc:** committed, tickers from the picks, associated with the user/agent.

---

## Out of scope / future work

- **Color fusion mechanic** and the legibility normalization needed for arbitrary earned colors on the obsidian background (a separate workstream; v1 only uses a fixed base palette).
- **Guided tour / SpotlightTour** repurpose.
- **First-battle scaffolding** (the dashboard's job; keep light).
- **Multi-agent / multi-game.**
- **Agent visual character design (bookmarked):** give the agent a distinctive look beyond the generic robot, built from existing seeds — per-archetype colors and the orb motif. A character/avatar design pass via Claude Design, scheduled after the onboarding and dashboard redesigns ship. Archetype may drive visual variation.

---

## Open questions for design input

- Reveal: how much the agent "performs" (animated entrance, spoken line) vs. a cleaner, quieter introduction.
- Stock list: exact tier labels and which names sit in each tier (a curated-content task).
- Color base palette: how many options and which (teal / gold / copper plus what else).
- Total length: keep the whole flow to a handful of taps; flag if any step balloons it.

---

## Cross-doc reconciliation (apply to the Command Dashboard brief once this is locked)

- **Cold-start:** the agent now arrives with archetype + watchlist equipped, so only the **rules slot is open — one invitation, not two.** Update the brief's cold-start copy accordingly.
- **Dashboard accent:** `t.accent` is sourced from the onboarding color choice, not a fixed token.
