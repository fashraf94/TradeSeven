# Phase C — Show it: build report and handover

**Date:** September 9, 2026
**Branch:** `claude/magical-wright-gek2gq` (harness-assigned). **Base:** `origin/main` @ `47e5604adf3e2abf4d445ccdf202ecc3a2f739e0`.
**Spec:** `docs/design/PHASE_C_SHOW_IT_SPEC_V1.md` + the binding delta `docs/design/PHASE_C_SHOW_IT_SPEC_V1_1.md` (D-121, D-122).
**Basis:** `docs/audits/20260908_PHASE_C_SHOW_IT_PHASE0_DISCOVERY.md` · `docs/audits/20260909_SOL_PHASE_C_SHORT_PASS.md`.
**Review:** `docs/audits/20260909_PHASE_C_SHOW_IT_BUILD_REVIEW.md` (BUILD_RULES §2, over threshold — six lenses, 16 findings fixed).
**Status:** built, reviewed, pushed. **Merges dark** — `SHOW_IT_ENABLED = false`. **Not deployed** (pushed ≠ deployed).

---

## 0. Executive verdict

| # | Question | Verdict |
|---|---|---|
| 1 | Did §1–§6 build in the spec's order, one commit each? | **YES** — six commits, plus two docs commits ahead of them. |
| 2 | Is Sol's C-1 BLOCKER fixed? | **YES** — the research exchange carries no `groundingVersion`, and `selectHistoryWindow` excludes `messageType: 'research'` structurally and unconditionally. Its one entrance is the typed `PLATFORM RESEARCH` block. |
| 3 | Is Sol's C-2 MAJOR fixed? | **YES** — one shared display function (the ordinal of the next card), the route authoritative under races, five race tests. |
| 4 | Does anything change with the flag dark? | **NO** — the grounded prompt is byte-identical, asserted directly; the route 404s before any read; no door or chip renders. |
| 5 | Was any fenced file edited? | **NO.** `flattenPortfolioServer` is CALLED (§1-permitted), as `debate.js` already does. |
| 6 | Full suite / `vite build`? | **Green** — 649 files, 12,223 tests; `vite build` clean. |
| 7 | Did the review find real defects? | **Yes — 16, and three of the build's own test batteries were largely vacuous.** The card never printed an entry price; the reply lint caught none of the breaches it named while withholding innocent sentences; a withheld turn still filed its directive; the route billed an external call on every tap. All fixed. Read §7. |
| 8 | Anything left undone? | **Five items at the time of writing**, all named in §5: the per-name Equip mechanism, `debate.js`'s guard, D-120's fetch widening, the route's shadow record, and an error surface on the doors. **Two are now closed** (Sep 9, 2026, branch `claude/exciting-maxwell-040mvv`): D-120's fetch widening AND `debate.js`'s `MACD histogram: negative` constant — see §5.3. **Three remain.** |

---

## 1. Git preamble (BUILD_RULES §2 / §3)

| Check | Result |
|---|---|
| `git fetch origin` | **Run first**, before any comparison. |
| Branch at session start | `claude/magical-wright-gek2gq` @ `c8bd17dd` — **12 behind `origin/main`, 0 ahead**. |
| Action taken | Reset to `origin/main` @ `47e5604a` (§2: one task = one branch, cut fresh from current `main`; the branch carried no unique commits). Recorded here as the rule requires. |
| Working tree | Clean at start and at every commit. |
| Environment | `node_modules` absent at start; `npm ci` run (exit 0). No credentials: no Firestore, GCS, EODHD, OpenRouter or Anthropic call was made in this session, and no latency figure below is measured. |
| Fence statement | No §1 file edited. Fenced functions **called**: `flattenPortfolioServer` (`agentScoring.js:36`), from the new route only. |

---

## 2. The eleven commits

| # | Commit | What landed |
|---|---|---|
| 1 | `ba480be1` | **docs** — the Phase 0 discovery, cherry-picked from `claude/phase-c-discovery-audit-xmiltc` (`9c325971`, docs-only; that branch was not merged). |
| 2 | `4f9b6c03` | **docs** — spec V1 verbatim, Sol's pass verbatim, and the V1.1 build contract that resolves C-1/C-2. |
| 3 | `1077806a` | **§1 the trigger** — the flag, the universe module, the research chip kind, the three doors. |
| 4 | `3989182c` | **§2 the route** — `POST /api/agent/research`, the ordered pipeline, the code-composed card. |
| 5 | `f7dc8927` | **§3 the card** — the component, the sections and their provenance, the tape wiring. |
| 6 | `f6ff927b` | **§4 the cap** — the display contract and the five race tests. |
| 7 | `c8ceee59` | **§5 the narrator** — the provenance boundary, the `PLATFORM RESEARCH` block, the reply lint. |
| 8 | `c0ca95e5` | **§6 flag/cost/files** — darkness proved end to end. |
| 9 | `94be7304` | **review fix CO-1** — a research exchange carries its own unique id (`arrayUnion` deduplicates deep-equal elements). |
| 10 | `84760908` | **the §2 review's 15 confirmed findings**, fixed. |
| 11 | `46ae3d0e` | **docs** — the review record. |

**Diff at the §6 commit, which is what the review measured:** 41 files, +4,264 / −81 — 21 code, 16 test, 4 docs. Over the §2 threshold on both counts.

---

## 3. What was built, section by section

### §1 — The trigger
- **`src/data/battleUniverse.js` (new, zero imports).** The universe union — book ∪ bench ∪ hot bench ∪ the equipped watchlist — plus membership, the canonical spelling, and where a name stands. `selectBench.js` now **imports and re-exports** its two shipped selectors from here rather than owning them, so the bench the player reads and the universe the server admits are ONE derivation (§9). It moved rather than being copied because `api/` cannot import `selectBench.js` — its chain reaches `components/Dashboard/desk/deskCopy` (§4's Node-clean condition).
- **The chip.** `normalizeSuggestedActions` gains an options argument; `{ kind: 'research', symbol }` survives only with a battle in hand *and* a symbol in that battle's universe, and carries the **doc's** spelling. `chat.js` hands the battle over only under `SHOW_IT_ENABLED`, read at call time — so while dark a research chip is dropped exactly as any unknown kind is.
- **The prompt's third kind** is an **append** next to `GROUNDED_OUTPUT_FORMAT` (the `ARCHETYPE_PROPOSAL_BLOCK` precedent), never an edit to the shared const.
- **The doors.** The Why? panel's third door; the bench chip, which becomes a button only when handed a handler and is otherwise the shipped `<span>`; the conversation chip on both the Battle View and the League dock. Every tap calls the **research route**, never the chat route.

### §2 — The route
Ordered exactly as the spec lists it: security + rate limit → method → **the flag (404 before any read)** → auth → body → battle + owner → active → agent binding → **the universe check** → the cap pre-check → the two data reads in parallel → the card, composed in code → **one transaction** that re-reads the count and appends. **No model call** on any path; the test's Gemma and Anthropic spies prove it through the whole module graph.

Data: the technicals path `debate.js` uses, with its book-only guard replaced by the universe check; the fundamentals from the cache brief's mirror, falling through to one `stockRankings` read for a name with no brief. **No screener call** — the mirror covers every field the card needs.

### §3 — The card
A pure render of what the server composed. The platform-data label is **a field of the card** and is rendered **inside** it (Sol C-4's condition). Technicals and fundamentals are separate sections with separate provenance lines; a withheld section is absent whole. The Equip door renders only with both the card's own flag and a handler — see §5 below.

### §4 — The cap
`RESEARCH_CAP = 3`, counted off `messageType: 'research'` exchanges. The door prints the **ordinal of the next card**, clamped: `1 of 3` before the first tap, `3 of 3` for both the last enabled state and the exhausted one, distinguished by `enabled`. No client keeps a count at all — two source-reading tripwires enforce that.

### §5 — The narrator
`selectHistoryWindow` drops a research card **first and unconditionally**, ahead of both branches. That position is the whole fix: the `pairs` branch never consults `groundingVersion`, so omitting the marker would not on its own have kept a card out of the history. The card's one entrance is `buildPlatformResearchBlock`, spliced before `EARLIER_MESSAGES` and separate from it.

**One deliberate deviation from §5's letter.** The spec put the research rule in `GROUNDED_SHARED_RULES`; it rides the block instead. That is strictly stronger — the rule is present exactly when a card is, so it can never govern a prompt that has none — and it keeps the dark prompt byte-identical, which a line in the shared rules would not have.

**The reply lint** is applied in code, on the route, only to a turn whose prompt actually carried the block. A breach is **withheld**, not voiced: the reply is replaced by a code-owned line, the chips are dropped, and the exchange is stamped `researchLint: 'withheld'`.

### §6 — Flag, cost, files
`SHOW_IT_ENABLED = false`, pinned by `showItFlags.test.js`, in `flagPinGuard`'s `DARK_BY_DESIGN` with its runway and a FLIP MAP naming every file the flip must touch. `research.dark.test.js` proves the whole dark surface, including that the grounded prompt is **byte-identical** to the same battle with the research exchange removed. No new cron: `vercel.json` still carries 39 of 40.

---

## 4. Three repo guards caught real defects during the build

Recorded because they are the argument for the guards, not incidental:

1. **The api/-graph extensionless-import guard** caught `researchCap.js`'s `'./decisionRecord'` with no `.js`. Node ESM would have failed at runtime; vite and vitest hide it. Fixed in §5's commit.
2. **The deny-by-default protected-store scan** caught the route's `tx.update` as a new, unlisted write site. Now on `compositionProtectedStoresAllowlist.json` with a note saying what it writes (`chatExchanges`, and nothing else) and why it resolves *unresolved*.
3. **`deskHonesty`'s narrator-source scan** caught the research rule using the word `caused`. The rule must name the inference in order to forbid it, exactly as the two existing rule sentences do; it is now registered sentence-scoped, so `caused` stays banned everywhere else in that file.

Two date bugs were caught by the build's own tests before they shipped: EODHD's real-time `timestamp` is UNIX **seconds** (a naive `new Date()` prints a 1970 instant as this afternoon), and a bare `YYYY-MM-DD` candle date parses as UTC midnight, which is the **previous day** in ET.

---

## 5. What is NOT done, and why — the founder's calls

### 5.1 The per-name Equip door has no handler (spec §3)
The card carries its `equip` flag and the component renders the door — **but no caller passes a handler, so the door never appears.** The reason: a per-name Equip mechanism does not exist on this screen. `PaneOverflow.jsx:5-6` says so in as many words ("Read and Equip are not built"), and `/api/agent/equip-watchlist` equips a **watchlist**, not a name. Building one is a new route plus a write into `agentContext.equippedWatchlist` — outside Phase C's scope (BUILD_RULES §8). The door's shape is in place for that build to plug into, and the card never promises a path it cannot open (hazard 7).

### 5.2 `debate.js` is untouched (spec §2's phrase "its own guard widened to the universe")
What Phase C needed from that route was its **data path**, and the research route carries its own universe check instead. Widening the debate route's guard would widen the reach of the very prompt §0 says must never reach a reader — its eleven forecasting lines, its conviction score, its `suggestedAction` — and hazard 8 says never to widen it without a test, of which it has none. Its entry point is also unwired at HEAD. A row in `research.dark.test.js` pins that it stays untouched. **If the founder meant the literal widening, it is a separate task with its own tests.**

### 5.3 The short-window indicators (D-120) — **CLOSED, September 9, 2026**
As shipped in this branch, the card rendered **nothing** for MACD, SMA50, SMA200 and EMA50, because the 30-calendar-day fetch never reached their minimums. That was the null-honest half of D-120, done here. Both remaining halves landed in the follow-up branch `claude/exciting-maxwell-040mvv`:

- **The renderers.** `debate.js` was still printing the constant `MACD histogram: negative` and an `N/A` SMA line (§5.5 filed it); the voice-layer cache's portfolio brief was still publishing `Downtrend. Below major SMAs.` off an *absent* SMA flag, and its prompt block interpolated both summaries unconditionally. All three are null-honest now, matching this card's rule and the bench brief's existing guard.
- **The fetch.** `fetchDailyOHLCV`'s window is now `DAILY_WINDOW_CALENDAR_DAYS = 90` (`api/_utils/marketDataCache.js:242`), read by the one `daily` call site in `getStockAnalysisData` (`:507`, cache key `SYMBOL_daily`). 90 calendar days holds ~64 weekdays; the NYSE closes at most 10 days in a *whole year*, so the window clears MACD's 35-candle minimum — and SMA50's 50 — from every start date in the calendar, with margin. SMA200 needs ~290 calendar days and stays null by design.

**Cost of the widening.** No additional API call: the same single `/eod/` request per symbol per cache miss, with an earlier `from`. What grows is the payload and its cache document — **~21 rows → ~62 rows, about 2.3 KB → 6.8 KB per symbol per fetch (≈ +4.5 KB, ~3×)** at ~110 bytes per mapped row (`{date, open, high, low, close, rawClose, volume}`). The largest single consumer of that increase is `compute-institutional-intelligence.js:213`, which batch-reads the `_daily` document for **all 239 tickers at once**: ~490 KB → ~1.6 MB per run, in a handler already declaring `maxDuration: 120`. Cache TTLs are unchanged, so fetch *frequency* is unchanged. Estimated, not measured: this session has no EODHD credentials, per the same disclosure as §1.

**The widening also MOVES two indicators that were never null — disclose this before the first deploy.** `calculateRSI` and `calculateEMA` seed on the *oldest* bars and smooth forward across the whole series, so their output depends on how many bars precede the recent ones; SMA20, Bollinger and ATR read the newest end only and are unaffected. Measured on identical recent prices with only the window changed: **RSI moved up to ~10 points, enough to cross the 30/70 zone boundary in both directions** (e.g. `67.56 neutral → 73.45 overbought`). The longer warm-up is the *more accurate* reading — at 21 bars roughly 60% of the weight still sat on the seed — but it is a value change, not merely a null-to-value change, and it lands in **persisted research cards** that §5.3's own rule says are "re-read days later". Two cards for the same symbol on consecutive days across the deploy can legitimately disagree on RSI and its zone word with no market move behind it. No card carries a window marker; giving it one is a separate, filed item.

**The cache key is deliberately not versioned.** `SYMBOL_daily` is read directly outside the module (`compute-institutional-intelligence.js:213` takes the newest close off it) and `getCachedData` derives the TTL type from the key's last underscore segment, so the name is a contract. It does not need versioning: there is exactly one window, so every write under the key is that window's payload. The only narrower payloads are this deploy's predecessors, and they age out on the daily TTL (4 h, frozen to the next open while the market is closed).

Two honest limits on that bound, both surfaced by the §2 review and now written at the code: it is **up to two TTL cycles, not one** — `SYMBOL_technicals` is a second unversioned document holding the *derived* indicator set, refreshed independently (a `fields: ['daily']` request refreshes one and not the other, so the two can disagree for a symbol at one instant) — and while a narrow payload is served, MACD/SMA50 are indeed null and the renderers stay silent, but **RSI and EMA come back with different values, not nulls**. Neither is misreported as something it is not; both resolve on the next full refresh.

### 5.4 Two follow-ups the review named
- **The route writes no shadow record**, so a research tap is invisible to telemetry. Hazard 12 warns specifically against reusing `gameMode: 'research'` for it, so it wants its own small design rather than a copy.
- **A failed tap has no error surface on the two Battle View doors.** The in-flight guard removed the damaging case (a double-spend of a scarce read); the remaining gap is that a 409 or a 500 is silent. `AgentChat`'s own chip path already has the three-branch error line to copy from.

### 5.5 Four items the discovery filed for separate tasking
Untouched here, as §3 requires: `debate.js`'s constant `MACD histogram: negative`; `reviewBudgetUsed` written to the battle doc but not declared by `createAgentBattle`; `debate.js`'s `'balanced'` archetype default; the `file-directive.js:157` comment drift. **The first of the four is closed** — see §5.3; the other three still stand.

---

## 6. The flip, when the founder is ready

One commit, and it must carry all of it (BUILD_RULES §2's flip-reconciliation rule):
1. `src/config/featureFlags.js` — `SHOW_IT_ENABLED = true`;
2. `src/config/showItFlags.test.js` — the dark pin row moves to `true`;
3. `src/config/flagPinGuard.test.js` — **drop** `SHOW_IT_ENABLED` from `DARK_BY_DESIGN` (its integrity test reds if a lit flag is left listed).

`api/agent/research.dark.test.js` mocks the flag to an explicit `false` and does **not** move. Vercel preview is the smoke surface; production exists only after the founder merges and deploys.

**Smoke, in order:** tap `Show it` on a bench chip → a card with two dated sections and `Platform data · not what the check saw` on it → the door reads `2 of 3` → ask "what do you think about those numbers?" → the character describes the card and never claims it as the check's or its own → tap twice more → the door reads `3 of 3`, disabled.


---

## 7. What the review changed, in one page

The §2 review is not a formality here — it found sixteen real defects, six of them things the card would have shown a player as fact. The full record is `docs/audits/20260909_PHASE_C_SHOW_IT_BUILD_REVIEW.md`; the four you should know about:

1. **The entry price never printed, for any name.** The standing section read `openPrice`, which is computed on the client and exists on no persisted asset. The tests could not see it because their fixtures invented the field. It now reads what the server canonically reads.
2. **The reply lint was decoration.** It passed *"That's a buy at these levels"*, *"The process will trim it"* and *"I looked it up"* — three of them verbatim the failure Sol's acceptance test names — while withholding *"I'll walk you through the card"*. Rebuilt as three families and verified against 16 breaches and 11 innocent sentences.
3. **A withheld reply still filed its directive.** The user read "that wasn't sent" while a strategic instruction extracted from that same sentence went to the trading process. The whole turn is withheld now.
4. **Every tap billed an external call.** `price` is uncached EODHD, so §6's cost claim and the route's own "a read, not a fetch" were both false. The quote comes from the cache now.

And the thing worth carrying into the next build: **three test batteries — including the two Sol's blockers are guarded by — passed with the code they test deleted.** A fixture that is not adversarial, a Firestore fake that commits every transaction, and a surface with no test at all. §4 of the review record tabulates the before/after mutation counts.

One failure was mine: all six reviewers shared one snapshot, so their mutation checks collided and three of them opened with a false BLOCKER. The isolation ruling should be read as one snapshot each.
