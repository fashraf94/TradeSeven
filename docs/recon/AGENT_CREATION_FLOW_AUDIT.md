# Agent Creation & First-Battle Flow Audit

**Branch:** `claude/agent-creation-recon`
**Date:** 2026-05-12
**Scope:** Read-only investigation of the FantasyTrades new-user journey from signup through first agent battle deployment. Picks up where `claude/trade-decision-recon` (trade pipeline) and `claude/forge-laboratory-recon` (Forge/Lab ecosystem) left off.

This audit traces the path **before** the Forge and battle flows: how a brand-new account moves from "I just registered" to "my agent is in a battle." Every concrete claim is anchored to file paths and line numbers. Where the code is ambiguous the answer is marked "unclear from codebase".

The headline finding: there is **no orchestrated onboarding**. Signup completes silently, drops the user onto an empty battle-feed dashboard, and waits for them to discover the Agent tab on their own. Once they do, a 5-question wizard derives an archetype via Claude Haiku and writes a sparse Firestore doc — empty memory, no rules, no bundle, no watchlist. A second 3-question gate (StarterKit) sits inside the Forge for whenever the user finds it. The deploy CTA is always-on the moment the agent exists; the first battle is a 1-day BaggerBomb match against a server-generated CPU opponent, with no tutorial overlay and no first-battle scaffolding.

---

## Q1. Signup → first agent in Firestore

### Auth provider & signup entry point

- **Provider:** Firebase Authentication (email/password + Google OAuth).
- **Auth service:** `src/firebase/authService.js:25-118` (`signUp`), `:127-156` (`signIn`), `:280-338` (Google OAuth).
- **UI:** `src/screens/HomeScreen.jsx` — single screen toggles between `'login' | 'register' | 'forgot'` modes (`HomeScreen.jsx:35`). `handleRegister` (`:62-83`) calls `register(email, password, username)` from `UserContext` then unconditionally `setScreen('dashboard')` (`:76`).
- **User doc:** `signUp` writes a Firestore doc at `users/{uid}` with the schema at `authService.js:52-103` (auth, profile, stats=zeros, settings, achievements=[], metadata, archived). No agent doc is touched.

```js
// authService.js:44-106 (excerpted)
const userCredential = await createUserWithEmailAndPassword(auth, email, password);
const user = userCredential.user;
await updateProfile(user, { displayName: username });
const userData = { _v: 1, auth: {...}, profile: {...}, stats: {xp:0, level:1, ...}, ... };
await setDoc(doc(db, 'users', user.uid), userData);
```

### What happens on first login with zero agents

- After signup, `setScreen('dashboard')` (`HomeScreen.jsx:76`) routes the user to `src/App.jsx:8347` (the dashboard screen). On mobile this renders `DashboardLoop` (`App.jsx:8434-8466`); desktop renders `DashboardDesktop` (`:8472-8501`).
- The dashboard is a battle feed (active / waiting / completed lists). With zero battles the lists are empty — no agent-creation prompt, no welcome modal, no "create your first agent" empty state was found.
- The user must independently tap the `'Agent'` tab in the bottom nav (`src/components/Navigation/BottomNav.jsx:8`) or the `'Agent'` item in the desktop sidebar (`src/components/Navigation/DesktopSidebar.jsx:12`) to reach `screen === 'agent'` (`App.jsx:9472`), which renders `AgentDashboard`.

### Is the user redirected to a creation screen?

**No.** There is no first-login redirect or onboarding router. The dashboard renders for any logged-in user regardless of agent state. The only signal to the user that they should visit the Agent tab is the persistent `Bot` icon in the nav (`BottomNav.jsx:8`, `iconSize: 28` — visibly larger than other tabs).

### Is a default agent created server-side?

**No.** Evidence:

- `authService.signUp` (`:25-118`) only writes to `users/{uid}`. No `agents` write, no `onCreate` Cloud Function trigger in `firestore.rules` or `/api`.
- `firestore.rules:145-152` permits client-side agent creation by the owner but does not auto-create one.
- `useAgent` (`src/hooks/useAgent.js:18-33`) subscribes via `subscribeToUserAgent` — if `snapshot.empty`, the callback is fired with `null` (`agentService.js:22-25`). No fallback creation.

The user must enter the Agent tab to trigger `AgentCreationFlow`. `AgentDashboard.jsx:190-200` mounts it conditionally:

```jsx
{!hasAgent && !loading && (
  <AgentCreationFlow user={user} tokens={tokens} ... onComplete={(agentId) => {
    console.log('[Agent] Created:', agentId);
  }} />
)}
```

---

## Q2. Agent creation surface

### Component & shape

- **File:** `src/components/Agent/AgentCreationFlow.jsx` (679 lines).
- **Mounted by:** `AgentDashboard.jsx:190-200`. The dashboard is the only mount site.
- **Structure:** internal `step` state 0–7. Sub-components: `ProgressDots`, `OptionCard`, `ConfigBar`, `TraitPill` (`AgentCreationFlow.jsx:79-153`).

### Step-by-step walkthrough

| Step | Component | What the user sees |
|---|---|---|
| 0 | `renderWelcome` (`:296-338`) | Gradient circle with `Bot` icon. Headline **"Build your trading agent"** (`:316`). Subhead: *"Answer 5 quick questions. We'll create an AI agent that matches your trading style and competes on your behalf."* (`:323`). CTA: **"Create Agent"** (`:335`). |
| 1 | `renderQuestion(0)` | Q1 (single-select + freeform): **"The market just dropped 3%. What's your gut reaction?"** (`:12`) |
| 2 | `renderQuestion(1)` | Q2 (single + freeform): **"Your agent just lost a game badly. What should it learn?"** (`:23`) |
| 3 | `renderQuestion(2)` | Q3 (multi-select, no freeform): **"Pick the sectors you want your agent to focus on"** (`:34`) |
| 4 | `renderQuestion(3)` | Q4 (single + freeform): **"How should your agent approach risk?"** (`:48`) |
| 5 | `renderQuestion(4)` | Name input, `maxLength: 20`. Placeholder cycles from `['Viper', 'Apex', 'Shadow', 'Bolt', 'Cipher']` (`:65`). |
| 6 | `renderLoading` (`:490-534`) | Pulsing gradient avatar + `Sparkles` icon. Headline **"Building your agent..."** (`:516`). Typewriter animation of the chosen name (`:171-182`). On entry, `useEffect` calls `deriveProfile()` → POST `/api/agent/create-profile` (`:185-220`). |
| 7 | `renderReveal` (`:536-665`) | Final reveal. Avatar gradient using AI-derived `avatarColors`, the chosen `name`, archetype label (formatted: `archetype.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())`, `:540`), the AI-generated `greeting` in italic, `personality.traits` as pills (`:608-619`), and three `ConfigBar`s for `Risk / Focus / Momentum` (`:633-635`). CTA: **"Go to Dashboard"** (`:661`). |

### Fields the user fills in

- Q1, Q2, Q4: pick one preset option **OR** type up to 100 chars of freeform that overrides the preset (`:424-445`, `:264-280`).
- Q3: multi-select sectors. `'agent_decides'` is mutually exclusive with the others (`:268-275`).
- Name: free text, ≤ 20 chars.

### Archetype picker UX

There is **no archetype picker.** The user never sees the archetype list during creation. The 5 answers are POSTed to Claude Haiku (`/api/agent/create-profile`), which derives the archetype from one of six fixed options:

```js
// api/agent/create-profile.js:66-73 (SYSTEM_PROMPT)
// ARCHETYPES:
// - momentum_chaser: Aggressive, chases trends, high trading frequency, loves breakouts
// - analyst: Data-driven, methodical, waits for high-conviction setups
// - diversifier: Balanced across sectors, steady, avoids concentration
// - contrarian: Goes against the crowd, buys dips, inverted momentum
// - degen: Maximum aggression, concentrated bets, highest frequency
// - guardian: Defensive, capital preservation, lowest frequency
```

The user only sees the resulting archetype as a single badge on the reveal screen (`AgentCreationFlow.jsx:580-592`).

### AI calls during creation

- **One AI call.** `deriveProfile` (`AgentCreationFlow.jsx:192-220`) → `POST /api/agent/create-profile`.
- **Model:** `claude-haiku-4-5-20251001` (`api/agent/create-profile.js:151`).
- **Tool-forced:** uses `submit_agent_profile` tool with `tool_choice: { type: 'tool', name: 'submit_agent_profile' }` (`:155-156`).
- **Rate-limited:** `rateLimit: { limit: 5, windowMs: 60000 }` (`:110`).
- **Output:** `{ archetype, config: {risk, concentration, momentum}, personality: {traits, sectorAffinity, riskPhilosophy, coachingStyle}, avatarColors: [hex, hex], greeting }`.
- **Validation/sanitization** on the response: archetype clamped to `VALID_ARCHETYPES` else falls back to `analyst` (`:169-171`); config sliders clamped 0–100 (`:173-177`); avatarColors hex-validated against `/^#[0-9a-fA-F]{6}$/` else replaced with archetype defaults (`:179-188`).
- **Fallback profile** (`buildFallbackProfile`, `:92-106`) on any Haiku failure returns an `analyst` archetype with a fixed greeting and `traits: ['methodical', 'data-driven']`.

The rest of the flow (questions, validation, navigation, writing the doc) is deterministic JavaScript.

### Submit handler

`handleFinalize` (`AgentCreationFlow.jsx:222-252`) is wired to the **"Go to Dashboard"** button:

```js
const agentId = await createAgent({
  name: answers.name || 'Agent',
  archetype: derivedProfile.archetype,
  config: derivedProfile.config,
  personality: {
    ...derivedProfile.personality,
    creationAnswers: { q1, q2, q3, q4 },  // freeform || preset
  },
  avatarColors: derivedProfile.avatarColors,
});
if (agentId) onComplete(agentId);
```

`createAgent` comes from `useAgent` (`hooks/useAgent.js:140-149`), which calls `agentService.createAgent(ownerId, agentData)` (`services/agentService.js:91-128`).

---

## Q3. StarterKit integration

### When does StarterKit appear?

**Not during creation.** StarterKit is **never** mounted inside `AgentCreationFlow`. Its only mount sites are inside the Forge:

1. `src/components/Forge/ForgeScreen.jsx:308-314, 473-477, 933-934`
2. `src/components/Forge/DiscoverTab.jsx:22, 240, 260, 557-568`

The gating condition in ForgeScreen:

```js
// ForgeScreen.jsx:309-314
const showStarterKit = agentId
  && agent
  && !agent.starterKitCompleted
  && !forge.loading
  && forge.rules.length === 0
  && forge.bundles.length === 0;
```

So a brand-new user only sees StarterKit when they (a) finish AgentCreationFlow, (b) navigate to the Forge via the bottom nav's Forge tab, and (c) have not created any rules or bundles. In `DiscoverTab` the condition is looser: `!agent || agent.starterKitCompleted === false` (`DiscoverTab.jsx:260`).

### The 3 questions (verbatim)

From `StarterKit.jsx:60-91`:

**Step 1 of 3 — "What's your style?"** (`:63`)
- 📈 *"I chase momentum"* — "Ride trends and breakouts when stocks are moving fast"
- 💎 *"I hunt for value"* — "Find undervalued companies with strong earnings potential"
- 🔄 *"I go against the crowd"* — "Buy when others panic, sell when others get greedy"

**Step 2 of 3 — "How much risk is okay?"** (`:73`)
- 🛡️ *"Keep it safe"* — "Diversify across sectors and limit exposure to any single stock"
- ⚖️ *"Balanced"* — "Spread picks across sectors but don't overthink it"
- 🔥 *"Let it ride"* — "No guardrails — your agent trades with full conviction"

**Step 3 of 3 — "How should your agent allocate?"** (`:83`)
- 📊 *"Spread it evenly"* — "Equal weight across all picks — no favorites"
- 🎯 *"Bet big on the best"* — "Overweight your strongest conviction picks"
- 🔀 *"Mix safe and risky"* — "Balance some safe picks with some volatile ones"

### Question → rule mapping

Hardcoded, no AI. From `StarterKit.jsx:13-50`:

```js
const STYLE_RULES = {
  momentum:  [{id:'tech-moving-average-trend'}, {id:'tech-bollinger-squeeze'}],
  value:     [{id:'fund-value-pe'},             {id:'fund-earnings-surprise'}],
  contrarian:[{id:'tech-rsi-oversold'},         {id:'tech-rsi-overbought'}],
};
const RISK_RULES = {
  safe:     [{id:'risk-sector-diversification'}, {id:'risk-single-stock-limit'}],
  balanced: [{id:'risk-sector-diversification'}],
  yolo:     [],
};
const ALLOC_RULES = {
  even:       [{id:'alloc-even-spread'}],
  conviction: [{id:'alloc-tier-preference'}, {id:'alloc-sector-cap'}],
  mixed:      [{id:'alloc-sector-minimum'}],
};
```

Total rules vary by selection: 3 (momentum + yolo + even) to 5 (value + safe + conviction). Bundle name comes from style (`BUNDLE_NAMES`, `:52-56`): *"Momentum Strategy"*, *"Value Strategy"*, or *"Contrarian Strategy"*.

The submit handler `handleForgeAndEquip` (`StarterKit.jsx:394-460`) performs seven steps in sequence:

1. `createRule(...)` for each selected rule (text resolved from template) (`:401-425`).
2. `createBundle(agentId, { name })` (`:428-429`).
3. `addRuleToBundle(agentId, bundleId, ruleId)` for each rule (`:432-434`).
4. `forgeBundle(agentId, bundleId)` — compile to executable strategy (`:437`).
5. `equipBundle(agentId, bundleId)` — set as active (`:440`).
6. `updateAgent(agentId, { starterKitCompleted: true })` (`:443`).
7. Show success screen *"Your strategy is ready! Your agent will use these rules in its next battle."* (`:486-489`) for 1.8 s then `onComplete()`.

### Is StarterKit skippable?

**Yes.** A persistent skip button **"Skip — I'll explore on my own"** (`:740`) is shown on every question step. `handleSkip` (`:372-379`):

```js
await updateAgent(agentId, { starterKitCompleted: true });
onSkip();
```

Skip flips the same flag the success path uses, so once skipped the kit never returns. The skipped agent keeps `activeRules: []` and `equippedBundleIds: []`.

### State after completion

| Field | After completion | After skip |
|---|---|---|
| `starterKitCompleted` | `true` | `true` |
| `equippedBundleIds` | `[bundleId]` | `[]` |
| `activeRules` | populated via `equipBundle` | `[]` |
| Number of new docs in `agents/{id}/rules` | 3–5 | 0 |
| Number of new docs in `agents/{id}/bundles` | 1 | 0 |

---

## Q4. Initial agent doc shape (archetype state)

### What gets written

`agentService.createAgent` (`src/services/agentService.js:91-128`):

```js
const agentDoc = {
  ownerId,
  name: agentData.name,
  archetype: agentData.archetype,
  archetypeDrift: null,
  config: agentData.config || { risk: 50, concentration: 50, momentum: 50 },
  personality: agentData.personality || {},
  avatarColors: agentData.avatarColors || ['#5eead4', '#a855f7'],
  memory: [],
  consolidatedInsight: '',
  directives: [],
  activeRules: [],
  equippedBundleIds: [],
  starterKitCompleted: false,
  stats: { wins:0, losses:0, gamesPlayed:0, totalScore:0, avgScore:0,
           currentStreak:0, bestStreak:0 },
  evolutionCycle: 0,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  lastDeployedAt: null,
};
const docRef = await addDoc(collection(db, AGENTS_COLLECTION), agentDoc);
```

### Field provenance

| Field | Source | Notes |
|---|---|---|
| `ownerId` | `user.odUserId` (= Firebase UID) via `useAgent.handleCreateAgent` (`hooks/useAgent.js:140-149`) | |
| `name` | User input from Step 5 of creation flow | |
| `archetype` | **Haiku-derived** in `/api/agent/create-profile.js:166`, validated against `VALID_ARCHETYPES` (`:169-171`) | One of 6 |
| `archetypeDrift` | `null` | Computed later as the agent evolves; unclear from codebase exactly when |
| `config` (risk / concentration / momentum) | Haiku-derived, clamped 0-100 (`create-profile.js:173-177`) | All three populated |
| `personality.traits` | Haiku-derived 2–5 phrases (`create-profile.js:42`) | |
| `personality.sectorAffinity` | Haiku, optional | |
| `personality.riskPhilosophy` | Haiku, required string | |
| `personality.coachingStyle` | Haiku, required string | |
| `personality.creationAnswers` | Verbatim Q1-Q4 raw inputs spread by `AgentCreationFlow.jsx:233-238` | |
| `avatarColors` | Haiku-derived hex pair, validated; fallback to archetype defaults (`create-profile.js:179-188`, `agentArchetypeConfig.js`) | |
| `memory` | `[]` | Filled by `/api/agent/reflect` after battles |
| `consolidatedInsight` | `''` | Filled when `evolutionCycle` ticks |
| `directives` | `[]` | User coaching directives |
| `activeRules` | `[]` | Populated by `equipBundle` (via StarterKit or manual Forge work) |
| `equippedBundleIds` | `[]` | Same as above |
| `starterKitCompleted` | `false` | |
| `stats.*` | All zeros | |
| `evolutionCycle` | `0` | |
| `lastDeployedAt` | `null` | Set on first deploy |
| `deployingAt` | not written at creation; set/cleared by `/api/agent/decide.js:77` as a deploy lock | |

### Is the first agent "meaningfully configured"?

It has a real **archetype** (drives strategy selection downstream — see `api/_utils/agentArchetypeConfig.js:6-133` which maps each archetype to `regimePreferences`, `riskOverrides`, `convictionMods`, `sectorConcentrationCap`, `tradeFrequency`, `defaultPreset`), a **config** vector, a **personality**, and **avatarColors**.

But the **execution surface is blank**: no rules, no bundle, no equipped strategy. The agent will deploy successfully — `decide.js` uses the archetype to score and rank stocks (`decide.js:88-90`, see `archetypeScoring.js`) regardless of whether rules exist — but it will *not* use any user-defined rules until StarterKit runs or the user builds a bundle in the Forge.

---

## Q5. First battle path

### Where does the user land after creation?

Nowhere new. `handleFinalize` calls `onComplete(agentId)` (`AgentCreationFlow.jsx:243`), and the `onComplete` handler in the dashboard mount site is:

```js
// AgentDashboard.jsx:196-198
onComplete={(agentId) => { console.log('[Agent] Created:', agentId); }}
```

The callback **only logs**. There is no navigation. The user remains on `screen === 'agent'`. The `useAgent` Firestore subscription (`hooks/useAgent.js:18-33`) picks up the new doc, `hasAgent` becomes true, and the dashboard re-renders with the sidebar + Overview tab visible (`AgentDashboard.jsx:202-377`).

### Deploy CTA

The Deploy button is rendered in `AgentSidebar.jsx`. It is **always visible** the moment `hasAgent === true` — there is no "first deploy" prompt, just a persistent button. Label text comes from `useAgent.deployText` (`hooks/useAgent.js:93-101`):

```js
case 'fresh':    return 'Deploy to BaggerBomb';  // gamesPlayed === 0
case 'growing':  return 'Deploy to BaggerBomb';
case 'maturing': return 'Deploy — I know the playbook';
case 'veteran':  return 'Deploy';
```

So for a new agent the button reads **"Deploy to BaggerBomb"**.

### What is a battle?

A **1-day BaggerBomb match** against a CPU opponent. Confirmed in `api/_utils/agentBattleService.js`:

```js
// agentBattleService.js:12
const AGENT_BATTLE_DURATION_MODE = 'fullday';
// :57-67 (excerpted)
if (AGENT_BATTLE_DURATION_MODE === 'fullday') {
  const fullDay = computeFullDayExpiry(portfolio);
  tradingDays = [fullDay.targetDateStr];
  expiresAt = fullDay.expiresAt;
}
```

Expiry rules (`agentBattleService.js:263-278`):
- Stocks-only portfolio: **4:00 PM ET** the same trading day (or 1:00 PM on early-close days).
- With crypto in the portfolio: **8:00 PM ET** (the "Night Game" extended session).
- If created outside market hours: targets the next trading day.

Other battle modes exist in the codebase (Season, Snake Draft, Draft Training, EarningsGame, OptionsArena/StonkOptions, FreeAgency), each with separate screens and entry points (`src/screens/`). **None of them are reachable from the Agent Dashboard for a new user.** The only first-battle path is BaggerBomb (Agent mode).

Note on "Season": `ForgeScreen.jsx:364` shows a `Proving Ground →` button when `forgeMode === 'season'`, and the Forge has a `SeasonModeToggle` (`src/components/Forge/SeasonModeToggle.jsx`). But the new-user agent dashboard does not route there, and the dashboard's `Deploy` handler always uses BaggerBomb (`AgentDashboard.jsx:101-140` → `/api/agent/decide`).

### First opponent

**CPU, every time.** Generated server-side in `/api/agent/decide.js`:

```js
// decide.js:16
import { generateCPUOpponent } from '../_utils/cpuOpponentGenerator.js';
// :368
const cpuOpponent = generateCPUOpponent(stockUniverse, CRYPTO_ASSETS, agentSymbols);
```

`generateCPUOpponent` (`api/_utils/cpuOpponentGenerator.js`) picks one stock from each of six target sectors (Tech, Finance, Healthcare, Energy, Consumer Discretionary, Industrials) at random from the eligible universe (with `excludeSymbols` to prevent overlap with the agent), fills to 6 if any sector underdelivers, adds one non-stablecoin crypto from `CRYPTO_ASSETS`, and builds a 3-stock-plus-crypto bench. **No real-user matchmaking exists for agent battles.** A separate `api/agent/set-opponent.js` exists but is legacy — the live path is server-side via `decide.js`.

### The full deploy → battle chain

1. User taps `Deploy` → `AgentSidebar` calls `onDeploy` → `AgentDashboard.handleDeploy` (`AgentDashboard.jsx:101-140`).
2. `POST /api/agent/decide { agentId }`. Rate-limited 3/min (`decide.js:34`).
3. Server (`decide.js`): idempotency lock check (`:51-77`), stock universe fetch (`:80-85`), archetype-specific ranking (`:88-90`), FantasyTimes context (`:92-97`), two-call AI chain (strategy then portfolio — both Claude tool-use), CPU opponent generation, write to `agentBattles` collection via `createAgentBattle` (`agentBattleService.js`).
4. Client gets `{ portfolio, bench, agentBattleId, innerMonologue, strategyBrief, expiresAt, opponent, opponentBench }`.
5. Handler invokes `onCreateAgentBattle` → `handleCreateAgentTrainingBattle` (`App.jsx:6335-6431`). It builds an in-memory `currentBattle` (`_v: 3`, `type: 'baggerbomb'`, `agentDeployed: true`, `isTraining: true`, both creator and `opponent: 'CPU Opponent'`), fires a fire-and-forget price-recapture to overwrite the server's 15-min-delayed prices (`:6400-6422`), then `setScreen('battle')` and `showToast('Agent deployed to BaggerBomb! 🤖💣')` (`:6428`).

### First-battle UI

Routing: when `screen === 'battle'` the dashboard renders `BattleViewScreen` (`App.jsx:9038-9059`), which selects `AgentBattleScreen` for agent-deployed battles. `AgentBattleScreen.jsx` is the standard agent-battle UI (Matchups / Command Center / Game Tape tabs). **No `isFirstBattle`, `gamesPlayed === 0`, or new-user conditionals** were found in the battle render path — the first battle uses the same UI as every subsequent one.

### Tutorial coverage

`App.jsx:1097-1186` defines `TUTORIALS = { draft, training, draftTraining }` — i.e., Snake Draft, BaggerBomb Training (legacy non-agent), and Draft Training. **There is no `agent` or `agentBattle` tutorial entry.** The tutorial modal (`App.jsx:7631-7900+`) is opt-in via help buttons elsewhere in the app and is never auto-fired for a new agent or a first battle.

---

## Q6. First-use friction points (end-to-end)

### Time estimate, signup → battle running

Best-case interactive flow (single, decisive user):

| Phase | Action | Approx time |
|---|---|---|
| Signup | Type email + password + username on HomeScreen, submit | ~30-60 s |
| Land on dashboard | See empty battle feed | ~10-20 s (orientation) |
| Find Agent tab | Tap `Agent` in bottom nav / sidebar | ~5 s |
| AgentCreationFlow welcome | Tap "Create Agent" | ~5 s |
| 5 questions | Q1–Q4 (preset taps + optional freeform) + name | ~60-180 s |
| Loading | Haiku call + typewriter animation; latency ~3-6 s | ~5 s |
| Reveal screen | Read greeting + traits + config bars, tap "Go to Dashboard" | ~10-20 s |
| Tap "Deploy to BaggerBomb" | (button visible immediately) | ~5 s |
| Server work | `/api/agent/decide` does archetype ranking + 2 AI calls + CPU gen | ~10-30 s |
| Battle running | `setScreen('battle')` renders `AgentBattleScreen` | — |

**Total: roughly 2.5 – 5.5 minutes from "submit signup" to "battle is running",** assuming the user finds the Agent tab on their own. The single biggest variable is the 5 creation questions (especially if they use the freeform inputs).

### Screens / interactions touched

1. HomeScreen (login/register form)
2. Dashboard (`screen === 'dashboard'` — empty feed, just orientation)
3. Agent Dashboard / AgentCreationFlow welcome (`step 0`)
4. AgentCreationFlow Q1 (`step 1`)
5. AgentCreationFlow Q2 (`step 2`)
6. AgentCreationFlow Q3 (`step 3`)
7. AgentCreationFlow Q4 (`step 4`)
8. AgentCreationFlow Name (`step 5`)
9. AgentCreationFlow Loading (`step 6`)
10. AgentCreationFlow Reveal (`step 7`)
11. Agent Dashboard with agent (Overview tab) — Deploy button visible
12. AgentBattleScreen

**12 screens / step states**, of which 9 are inside the agent creation wizard.

### Explicit decision points vs automatic transitions

Decisions the user must make:
- HomeScreen: login vs register, fill form
- Find the Agent tab in nav (implicit; no prompt)
- Q1-Q4: pick preset or write freeform
- Q3: pick at least one sector
- Q5: type a name (or accept placeholder)
- "Go to Dashboard" on reveal
- "Deploy to BaggerBomb"

Automatic transitions:
- Signup success → `setScreen('dashboard')` (`HomeScreen.jsx:76`)
- Step 5 → Step 6 happens when "Build Agent" button is tapped (validated step) (`AgentCreationFlow.jsx:462-465`)
- Step 6 → Step 7 fires automatically when Haiku responds (`AgentCreationFlow.jsx:207-213`)
- Battle creation → `setScreen('battle')` (`App.jsx:6427`)

### Gates that could block the first battle

- **Email verification:** **None.** `signUp` (`authService.js:25-118`) does not call `sendEmailVerification`. The user can deploy immediately.
- **Payment:** **None found.** No paywall, no Stripe, no premium tier check before deploy (the user doc has `metadata.premiumTier: null` but it isn't read by the deploy path).
- **Username uniqueness:** **Not enforced.** `authService.js:40-42` has a `// TODO: Check username uniqueness (add this in Phase 2)` comment.
- **Stock rankings availability:** The deploy will 503 if `indexIntelligence/stockRankings` is missing (`decide.js:81-84`). This is an infrastructure dependency — a brand-new user can hit this if the cron hasn't run.
- **Deploy idempotency / cooldown:** `decide.js:60-74` enforces a per-agent 2-minute cooldown between deploys (`429`). Not a first-deploy blocker but is a frustration vector if the user double-taps.
- **Rate limit:** `decide.js:34` allows 3 deploys per minute, `create-profile.js:110` allows 5 calls per minute. Not first-touch blockers.

### Educational moments embedded in the flow

- **AgentCreationFlow:** no tooltips, no "learn more" links, no per-question hints. Just a question and option cards. The freeform input has placeholder text *"Say something else..."* (`:434`).
- **StarterKit (Forge, not creation):** each option carries a short description (e.g., *"Ride trends and breakouts when stocks are moving fast"*, `StarterKit.jsx:66`). This is the only embedded education in the new-user surfaces.
- **Tutorial modal:** exists for Draft, Training, DraftTraining (`App.jsx:1097-1186`); **none for Agent.**
- **SpotlightTour:** a tour framework exists at `src/components/Dashboard/SpotlightTour.jsx` but no agent-onboarding tour configuration was found.
- **Forge "Advanced Rules" info banner** (`ForgeScreen.jsx:452-472`): a small inline tip — *"Advanced Rules — These rules power your Proving Ground simulations."* — but the user must already be past the StarterKit gate to see it.

---

## Q7. Agent identity post-creation

### Visual representation

The post-creation agent is shown via `AgentSidebar.jsx` (`src/components/Agent/AgentSidebar.jsx`). It is **not** the gradient-circle-with-Bot-icon from the creation flow. The sidebar imports and renders `MechSVG` (`AgentSidebar.jsx:4, 43`):

```js
// AgentSidebar.jsx:4
import MechSVG from '../Forge/MechSVG';
// :11
const avatarColors = agent?.avatarColors || ['#5eead4', '#a855f7'];
// :23-24
const mechPrimaryGlow = avatarColors[0] || '#5EEAD4';
const mechVisorColor = avatarColors[1] || mechPrimaryGlow;
// :43 — MechSVG rendered at compact size with state, glow, visor color
```

So the user's first sight of their agent post-creation is a **holographic wireframe mech** (`src/components/Forge/MechSVG.jsx`), colored by the Haiku-derived `avatarColors`. The mech has two states: `'idle'` (full opacity, breathing animation) and `'dormant'` (gray, reduced opacity), driven by whether the agent has equipped bundles. The big gradient `Bot`-icon avatar from creation is **only** visible on the reveal screen.

Sidebar layout (per the recon agent's read of `AgentSidebar.jsx`):
- Mech avatar + name + archetype pill (purple background)
- Optional `archetypeDrift` italic line
- Level badge + games-to-next-level + progress bar (driven by `agentProgression.js`)
- Stats row: Record W-L, Avg score, Evolution cycle
- Deploy button (teal→dark-teal gradient with `Zap` icon, label from `deployText`)
- "AGENT SAYS" speech bubble showing `speech` from `useAgent.js:73-91`

### Does the visual reference DNA / archetype / loadout state?

- **archetype:** yes — shown as a text pill ("Momentum Chaser", etc.) in `AgentSidebar`. The mech colors don't directly map to archetype; they come from `avatarColors` (which the Haiku tool can match to archetype energy but doesn't have to).
- **loadout:** indirectly. In the Forge, `ForgeScreen.jsx:386-420` wraps the mech in `AgentIdentityCard`, passes `slotUsage` (DNA-group usage) to `MechParticles`, and computes `mechColors` from `slotUsage` (`ForgeScreen.jsx:~110`). The Forge mech can show DNA-themed particle effects. The Agent Dashboard sidebar mech does **not** show particles and uses static `avatarColors`.
- **DNA:** the AgentSidebar mech doesn't show DNA sockets; the Forge's `DNASocketMatrix` and `AgentIdentityCard` do.

### Where else does the agent surface?

- **Bottom nav `Agent` tab** (`BottomNav.jsx:8`) — `Bot` icon, slightly larger than other tabs.
- **Desktop sidebar `Agent` item** (`DesktopSidebar.jsx:12`) — same `Bot` icon.
- **Agent Overview tab** content (`AgentOverviewTab.jsx`) — scouting report card, active deployments card, FantasyTimes intel strip, battle log.
- **Forge** (`ForgeScreen.jsx:386-420`) — full mech + DNA sockets + bundle equip controls.
- **Agent Battle Screen** — agent's `name` and `avatarColors` flow into the battle UI's "creator" side (`App.jsx:6367-6374`); the recon agent's read indicates **the mech avatar does not appear during battle**, just text labels. Unclear from codebase whether the agent avatar appears anywhere inside `AgentBattleScreen.jsx` proper.
- **Leaderboard tab** (`AgentLeaderboardTab.jsx`) — agents are listed for ranking; the canonical visual identity surfaces are the sidebar and the Forge.

### Is there an "agent home"?

**Yes — sort of.** `AgentDashboard` *is* the agent home. The sidebar shows the agent's identity, level, stats, and speech; the Overview tab shows scouting + active deployments + news + battle log; the Evolution tab shows evolutionary cycle progress; the Leaderboard tab is reachable via the Overview's "View Rankings →" link (`AgentDashboard.jsx:330`, `:334-364`). The Forge is a separate surface for loadout / DNA work. There is no single "dossier" screen — the agent is composed across the sidebar + tabs + Forge.

### Scouting report text by maturity

`AgentDashboard.buildScoutingReport` (`AgentDashboard.jsx:79-87`):

```js
if (maturityStage === 'fresh')    return "Deploy me first, then I'll start reading FantasyTimes.";
if (maturityStage === 'growing')  return "Still learning. A few more games and I'll start connecting news to strategy.";
if (agent.consolidatedInsight)    return `Based on my experience: ${agent.consolidatedInsight.slice(0, 200)}...`;
```

So a fresh agent's Overview tab greets the user with *"Deploy me first, then I'll start reading FantasyTimes."*

### Agent's speech (sidebar quote)

`useAgent.js:73-91`, maturity-stage gated:
- `fresh` (0 games): *"First time in the arena. I've studied the playbook — let's see what I'm made of."*
- `growing`: pulls from `agent.memory[last].lesson`
- `maturing`: *"I've seen this setup before. Going with my playbook."*
- `veteran`: *"Ready."*

---

## Q8. Anything else (educational content, seed data, half-built features)

### Educational content

- **Academy** (`src/components/Academy/`) — a mock video library (`AcademyFeed.jsx`) with 8 trading-concept videos (IV, BaggerBomb thresholds, sector rotation, earnings surprise, ATR, Snake Draft, IV crush, Fed funds). Mock data, no backend integration. Not promoted in the new-user flow; reachable only via direct navigation. Unclear from codebase whether this is currently linked from any screen the new user touches.
- **CurtainScreen** (`src/components/Curtain/CurtainScreen.jsx:1-2`) — explicitly marked `// DEPRECATED: Replaced by FantasyTimes newsroom`. Not mounted in `App.jsx` (`grep "CurtainScreen" App.jsx` returned no usages). Dead code.
- **Tutorial modal** (`App.jsx:1097-1186, 7631+`) — Draft / Training / DraftTraining only. No agent tutorial.
- **SpotlightTour** (`src/components/Dashboard/SpotlightTour.jsx`) — generic tour framework. No agent tour is configured.
- **FantasyTimes news strip** in Overview tab (`AgentOverviewTab.jsx:133-143`, label `"FANTASY TIMES INTEL"`) — passive context, not tutorial.

### Seed data the agent gets at creation

**Almost nothing.** Per the createAgent dump above (`agentService.js:91-128`):
- `memory: []`
- `consolidatedInsight: ''`
- `directives: []`
- `activeRules: []`
- `equippedBundleIds: []`
- All `stats.*` = 0

No watchlist seed found in the agent creation path. The `watchlistService.js` exists but is not invoked at agent creation. The agent's first deploy uses the archetype's `defaultPreset` (`agentArchetypeConfig.js:9, 33, 53, 73, 93, 114`) — `'aggressive'` / `'balanced'` / `'defensive'` — as a strategy fallback rather than user-defined rules.

### `seedTestAgent` — production or dev?

`agentService.seedTestAgent(ownerId)` (`agentService.js:287-334`) creates a pre-populated "Viper" agent with `momentum_chaser`, 8 games of fake history, prefilled `memory`, `directives`, `consolidatedInsight`, and stats. It's exposed via `useAgent.handleSeedTestAgent` (`hooks/useAgent.js:169-181`). I did not find a UI call site for it via grep — appears to be dev/test-only.

### Half-built or referenced-but-not-shipped onboarding

- **`FORGE_DISCOVER_TAB_SPEC.md`** describes Discover as the surface for "novice users who don't have the vocabulary to start a Workshop conversation cold." It specifies that Discover defaults open when `agent count = 0`. The hook is implemented (`DiscoverTab.jsx:260`: `const showStarterKit = !agent || agent.starterKitCompleted === false;`) but the framing of Discover-as-onboarding-surface is more aspirational than fully realized — the new user doesn't get pushed there.
- **`authService.js:40-42`**: `// TODO: Check username uniqueness (add this in Phase 2)`. Username collisions are silently allowed.
- **`DOSSIER_SYSTEM_ROADMAP.md`** exists in the repo root (25 KB) and references an agent dossier concept. The current Evolution / Overview / Leaderboard tabs are an incomplete realization of this; the unified dossier screen described in the spec does not exist as a single screen.
- **`PHASE_6_*` and `PHASE1_QUALITY_REPORT.md`** docs in root reference ongoing refactor phases but did not surface a specific "onboarding" item in my targeted reads.
- **CurtainScreen** — half-built / fully-deprecated. The intent was clearly an opening "daily briefing" moment for new users on cold launch; it was replaced by FantasyTimes.

### Anything that would shape a User-1-and-2 first impression

- The dashboard is a battle feed, not a welcome surface. For a casual user signing up, the first 30 seconds are visually quiet — empty cards, no "do this next" prompt.
- The Agent tab is the only path to creation, and there is no nudge toward it. Discoverability rests entirely on the user inferring it from the bot icon.
- The 5-question creation flow is short, low-friction, and gives a satisfying reveal screen — but does not explain what an archetype means before deriving one.
- StarterKit is **not** auto-shown after creation. A casual user who skips the Forge entirely will have an agent that deploys with no user-defined rules, relying purely on archetype defaults.
- The Deploy button is one tap away the moment the agent exists, and the battle starts immediately — so the time-to-first-action is fast for users who actively engage.

---

## Summary: the user's first 30 minutes

A reconstruction of what a brand-new user actually experiences, end to end:

**0:00 — Signup (~30-60 s).** User loads the app, sees `HomeScreen` (`src/screens/HomeScreen.jsx`), toggles to register mode, types email + password + confirm + username (≥ 3 chars), taps `Create Account`. Firebase Auth creates the account, `signUp` writes a `users/{uid}` doc (no agent), and the app navigates to `screen === 'dashboard'`.

**0:30 — Dashboard orientation (~10-20 s).** User lands on the battle-feed dashboard (`DashboardLoop` mobile / `DashboardDesktop`). All lists are empty. No welcome modal, no "create your agent" CTA, no spotlight tour. The user has to read the bottom nav to figure out what to do — the `Agent` tab (`BottomNav.jsx:8`) has a slightly oversized `Bot` icon that suggests it's important.

**0:50 — User taps Agent tab.** `screen === 'agent'`, `AgentDashboard` mounts, sees `!hasAgent`, mounts `AgentCreationFlow`. The user sees a centered gradient circle with a `Bot` icon, the headline *"Build your trading agent"*, and the subhead *"Answer 5 quick questions. We'll create an AI agent that matches your trading style and competes on your behalf."* Tap **Create Agent**.

**1:00 — Questions 1-4 (~90-180 s).** Four card-stack questions slide in (`framer-motion` spring). The user picks preset options (or types freeform):
- Q1: market drops 3% — buy the dip / wait / get defensive / depends.
- Q2: agent lost badly — analyze / shake off / be more careful / show me data.
- Q3: pick sectors (multi-select) — Tech / Energy / Healthcare / Finance / Consumer / Industrial / "Let the agent decide".
- Q4: risk approach — aggressive / balanced / conservative / contrarian.

There are no tooltips, no per-question explanations, no archetype hints. The freeform input is a small text field labeled *"Say something else..."*.

**3:00 — Name (~10-20 s).** User types up to 20 chars (placeholder cycles "Viper / Apex / Shadow / Bolt / Cipher"). Taps **Build Agent**.

**3:15 — Loading (~5 s).** Pulsing gradient avatar, *"Building your agent..."*, typewriter animation of the chosen name. Server (`/api/agent/create-profile`) calls Claude Haiku with `tool_choice: 'submit_agent_profile'`, returning `{archetype, config, personality, avatarColors, greeting}`. If Haiku fails, a deterministic `analyst` fallback profile is returned silently.

**3:20 — Reveal (~10-20 s).** Animated stagger: gradient avatar in the AI-derived colors, agent name, archetype label ("Momentum Chaser"), an italicized greeting in character, 2–5 trait pills, three config bars (Risk / Focus / Momentum). CTA: **Go to Dashboard**.

**3:40 — Tap "Go to Dashboard".** `handleFinalize` writes the agent doc via `createAgent` (`agentService.js:91-128`): `archetype`, `config`, `personality.creationAnswers`, `avatarColors`, `starterKitCompleted: false`, empty `memory / directives / activeRules / equippedBundleIds`, all stats zero. `onComplete(agentId)` only `console.log`s — no navigation. The Firestore subscription propagates, `hasAgent` flips true, and `AgentDashboard` re-renders.

**3:45 — Agent home, first time.** User now sees the `AgentSidebar`: a compact holographic `MechSVG` in the AI-chosen colors, the name, the archetype pill, level "Rookie" 0/X games, stats line "0W-0L · 0 · Cycle 0", a teal gradient **Deploy to BaggerBomb** button with a `Zap` icon, and a speech bubble labeled `AGENT SAYS` quoting *"First time in the arena. I've studied the playbook — let's see what I'm made of."* (`useAgent.js:77`). The Overview tab body shows a `SCOUTING REPORT` card with *"Deploy me first, then I'll start reading FantasyTimes."* (`AgentDashboard.jsx:81`), a FantasyTimes Intel strip if there are stories, and an empty Battle Log.

There is no nudge toward the Forge. StarterKit is not mounted.

**4:00 — User taps Deploy.** `handleDeploy` (`AgentDashboard.jsx:101-140`) POSTs to `/api/agent/decide`. Server work (`api/agent/decide.js`): idempotency lock, fetch stock universe, apply archetype-specific ranking (`archetypeScoring.js`), fetch 5 recent FantasyTimes stories for context, run two AI calls (strategy then portfolio), generate CPU opponent (`cpuOpponentGenerator.js`, one stock per of 6 sectors + a non-stable crypto + 3-asset bench), write to `agentBattles` collection, return everything. **Latency: ~10–30 s.** The button shows "Thinking..." with `Zap` icon dimmed.

**4:30 — Battle starts.** `handleCreateAgentTrainingBattle` (`App.jsx:6335-6431`) builds an in-memory `currentBattle`, fires a fire-and-forget price recapture, then `setScreen('battle')` and toasts *"Agent deployed to BaggerBomb! 🤖💣"*. `AgentBattleScreen` renders Matchups / Command Center / Game Tape tabs. **No tutorial overlay, no intro modal, no "this is your first battle!" callout.** The agent vs CPU portfolio is now live; the battle expires at 4 PM ET (stocks-only) or 8 PM ET (with crypto).

**~5 minutes total.** The user has gone from typing an email to watching their first battle. Total interaction surface: ~12 screen states, ~7-9 explicit decisions, 1 AI call during creation, 2 AI calls during first deploy, 1 CPU opponent generated server-side, 1 `agentBattles` doc written.

**What the user *didn't* see:**
- StarterKit (only triggers if they navigate to the Forge while `equippedBundleIds = []`).
- Any explanation of what an archetype does.
- Any tutorial about how a battle works.
- Any prompt to add a watchlist, write a rule, or coach the agent.
- Any indication that they're missing those things.

The first battle will run, the agent will deploy a portfolio derived from the archetype's `defaultPreset` (aggressive / balanced / defensive) plus the AI-derived `config` sliders, and at expiry the agent will accumulate its first `memory` entry via `/api/agent/reflect`. The user can then choose to engage the Forge, the Coach surfaces, or simply tap Deploy again two minutes later (cooldown gate, `decide.js:69-73`).
