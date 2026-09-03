# Battle View controller — Phase A2 (A2.0 → A2.2) adversarial build review

**Date:** September 3, 2026
**Under:** `docs/BUILD_RULES.md` §2 — mandatory at ≥10 files or ≥1500 lines. This branch is **26 files / +2574 −58** at `57824041`, so the review is required, not optional.
**Reviewed HEAD:** `57824041` (A2.2), with the fixes at `a16e6d37` and after.
**Branch:** `claude/phase-a2-tape-piece-javcyf`.
**Prepared by:** Claude Code (coordinator), with five isolated lens reviewers and two refuters.

---

## 1. Executive verdict

| | |
|---|---|
| Lenses run | **5** — domain correctness / C1, wiring & lifecycle, the flag-off guarantee, test integrity, spec & cross-phase consistency |
| Findings raised | **50** — 43 by the lenses, **7 more by the refuters against the fixes** |
| **CONFIRMED** | **35** (7 HIGH, 15 MED, 13 LOW) |
| **REFUTED** | **6** — 2 lens findings and 2 sub-claims by refuter A, 2 fix-defects by refuter B — plus ~40 candidates the lenses dropped themselves before reporting |
| Fixed on this branch | **28** |
| Recorded, not fixed | **7** (§5 — each with a reason) |
| Source mutations executed | **45** by lens 4, **9** by refuter B against the fix commit, plus **11** by the coordinator |
| Mutations NOT caught by the suite | **5** at review time (all now guarded) and **4 more** found by refuter B in the fixes themselves |
| `vite build` | **green** (BUILD_RULES §2 requirement; no test imports `App.jsx`) |
| Full suite | **9819 passed**, 63 skipped, 0 failed (9642 before the review) |
| Flag-off goldens | byte-identical throughout |

**The single most severe finding was L1-F3** (refuter A's judgement and mine): a user-set stop-loss that fires *and executes* leaves `downgraded` false, so the cron's own `Guardrail override (…): …` sentence took the ordinary SWAP branch — which had no author line — and was rendered as **the agent's words** on the row and the check card, while the trade card for that same swap labelled the identical string `The system's reason`. One tape, one tick, opposite attribution. It is routine rather than anomalous, it does not self-heal, and it is a direct C1 violation. Fixed.

**The review changed a founder ruling's implementation back toward the ruling — and then a refuter caught the correction over-rotating.** A2.2 discriminated the motive's author on the persisted `trades[].source`; ruling 5 named the **rationale**. Two independent findings (L1-F3, L1-F4) proved the ruling right and the implementation wrong in both directions. The first fix therefore used the text *alone* — and refuter B showed that inverted the C1-safe default: the gameplan-rotation writer composes a template with no fixed prefix (`{sym} down {pct}%, {sym2} ({sector}) has tech score {n}.`) under `source: 'gameplan_meeting'`, so a system sentence was labelled **the agent's own words**, which the pre-fix rule had got right. The rule that shipped uses both signals in one function: the text leads, and `source` rules out the writers whose sentence matches no prefix, with only `haiku` and `guardrail` letting the text decide alone — those two being the ones where the text genuinely is the only answer. Listing the two *exceptions* rather than the engine sources keeps the default safe for any writer added to the cron after today.

**That sequence is the case for the refutation step existing.** The first fix was wrong in a way no lens could have caught, because no lens saw it; it took a second adversary pointed at the correction.

---

## 2. Method

Five lenses ran **concurrently and independently**, each on a snapshot tree, each told to report only defects it could state as `inputs → wrong output` and to drop anything it could not reproduce. Findings then went to refuters instructed to **break** them; a finding was recorded CONFIRMED only after the refuter executed a repro.

**Reviewer isolation (BUILD_RULES §2, the Ask 2 ruling).** Reviewers worked on `git archive` extractions with `node_modules` symlinked, read-only on git and on the shared working tree. **This was violated in practice and it cost us**: the first snapshot was shared by all five lenses, which mutation-check by editing source. Lens 5 reported (L5-F9) a **false red** and two *mutually contradictory* failures from concurrent edits, and re-verified everything from a private extraction; lens 3 did the same unprompted. **Ruling for the next review: one snapshot per reviewer, not one per review.** The precedent that produced the isolation rule was a reviewer overwriting a coordinator's fixes; this is the same failure one level down.

**A second process defect, recorded honestly.** The rulings document was attached to the build session as chat text, and the file the coordinator copied into the reviewers' scratchpad under that name was byte-identical to the Phase 0 report. Lenses 1, 3, 4 and 5 therefore had the Phase 0 report where they expected the rulings; lens 5 noticed, said so first, and reconstructed the binding text from the ledger rows D-69 → D-79 and the seed. The build itself was written against the correct document. No finding is known to depend on the wrong input, and lens 5's string table — reconstructed independently — matched every ruled string. Next time: write the binding document to the scratchpad from the conversation, and have the first reviewer echo a distinctive line back before the others start.

---

## 3. CONFIRMED findings and their dispositions

### 3.1 HIGH

| # | Finding | Disposition |
|---|---|---|
| **L1-F3** | A guardrail-forced swap that **executes** renders the cron's sentence as the agent's words; the trade card one row away calls the same string the system's. Refuter A: routine — every user stop-loss that fires and executes; `EMERGENCY_BYPASS_REASONS` means neither the hurdle floor nor the circuit breaker blocks it. | **FIXED.** `isEngineAuthoredMotive` — one rule over the text, shared by the panel, the check card and the trade card. |
| **L1-F4** | `reinforced_haiku`: the guardrail agrees with the model's swap, leaves its rationale untouched, and the cron still stamps `source: 'guardrail'` — so the agent's own first-person prose was labelled the system's. Refuter A sharpened it to a §9 disagreement: `selectWhyState`'s own comment asserts the opposite about the same tick. | **FIXED** by the same rule. |
| **L1-F2** | A **third** system-authored brief (`Automated selection based on archetype fitness scores.`, written when Sonnet does not use the strategy tool) had no gate — gate (b) inspects `innerMonologue.strategy` and never `strategyBrief`. The repo already refuses to quote it in the deploy ceremony. | **FIXED.** Gate (c) suppresses the brief; the tier rationales on that deploy are genuinely the model's and still render. |
| **L1-F1 / L3-F1** | `deriveDueAt`'s close clamp compares ET minutes-past-midnight and is blind to the **date**, so a prior-session stamp at/after (close − 15 min) also yields null: both surfaces — including the **unflagged Desk** — read `Checked 3:50 PM · last check today` about yesterday. Found independently by two lenses, both with repros; L3 verified the fix under four timezones. | **FIXED** (calendar-day conjunct). Refuter A re-rated **LOW** on reachability: `AGENT_BATTLE_DURATION_MODE = 'fullday'` is hardcoded, so multi-day battles are dead at HEAD, and the two routes that could strand a battle overnight are closed. The residual route is a missed expiry sweep. Fix kept — it costs nothing and the ruling's stated equivalence was simply false. |
| **L3-F2** | The flag-off goldens **cannot see a tape leak**: the screen golden is captured on the `matchups` tab (no chat), the chat golden renders `AgentChat` directly (bypassing the screen). Removing both flag gates leaked the whole tape into the shipped Command Center tab with 3506 tests green. | **FIXED.** New `AgentBattleScreen.flagOff.tape.jsdom.test.jsx` mounts the real screen flag-off and opens the tab that holds the chat. Mutation-checked against L3-F2's exact mutation: two rows red, goldens green. |
| **L5-F1** | **A2.1b was not revertible in isolation** — the reason D-76 gave for the separate commit. A2.1b introduced `TIER_LABEL`; A2.2 consumed it; reverting A2.1b deleted the declaration and left every trade card throwing. Proved by reverting in a scratch worktree. | **FIXED.** `tierLabel()`, a shape neither commit's diff resembles. Re-verified by revert. |

### 3.2 MED

| # | Finding | Disposition |
|---|---|---|
| **L1-F8 / L2-F1 / L2-F2** | The empty-state guard tested `tradeEvents`, which the flag no longer feeds the timeline: a battle with N check cards and no chat yet rendered `EmptyState` and dropped the whole tape; the inverse (feed swaps, no `trades[]`) rendered a blank region. Found by **two lenses independently**; refuter A showed the reachable path (`ensure-opener` is one-shot and client-side). | **FIXED** — `combinedTimeline.length === 0`, which is byte-identical flag-off by construction. |
| **L1-F5** | `↳ from directive` — D-51's `Acted` — was stamped on a guardrail-forced swap, because the feed's `swap` entry keeps the model's pre-override `directiveThreadId` while the pair is the guardrail's. Refuter A proved the answer is decided by feed push order. | **FIXED** — the echo is withheld when the engine wrote the motive. |
| **L1-F6 (trigger half)** | Two adjacent quiet checks whose **cards render differently** (one `Woken by a price drop`, one nothing) collapsed into one `no change` line. Refuter A: the **normal** case — every entry carries a trigger and exactly one type has a ruled string. | **FIXED** — the run key now carries the rendered `Woken by …` line as well as D-77's data conjuncts. Two checks may only become one line when they would have rendered the same line. |
| **L5-F2** | The author label reached **one of the three** surfaces that render a motive: the check card carried no footer, and `This piece today` rendered `trades[].rationale` unlabelled. | **FIXED** — all three consume the one rule. |
| **L4-F1** | Neither C1 gate in `selectDeployPlan` was enforced **at its call site**: replacing it with a raw ungated read kept 2245 tests green. | **FIXED** — the mounted suite now varies the subscribed document and asserts a tournament battle and a fallback deploy render no plan. Mutation-checked. |
| **L4-F4** | `receipts` / `chatExchanges` could be dropped from `buildTape` with 2173 tests green, making D-77's disposition conjunct inert in production. | **FIXED** — a mounted row proves a directive filed between two quiet checks breaks their run. |
| **L4-F5** | The `Read the full check` door could be nulled with 2163 tests green. | **FIXED** — a mounted row taps it and asserts the book panel opens. |
| **L4-F6** | A row could be widened to its whole tier rationale with 2163 tests green. | **FIXED** — a mounted row asserts the other piece's sentence in the same rationale does not appear. |
| **L4-F3** | The receipt-state half of the run key was untested and `receipts` was read nowhere else in the module. | **FIXED** — a row pins the composition; the comment records that the half is near-inert in practice (a state change with the same current thread means a completion, which lands on every check at once). |
| **L2-F4** | `hasMore` compared an untrimmed rationale to a trimmed first sentence, so a one-sentence HOLD ending in whitespace — the commonest check on the tape — showed a `Read more` that revealed nothing. | **FIXED** (`cleanText` trims at source; the card compares trimmed). |
| **L5-F4** | Hazards 32/33 (a `hold` feed line and a `trade_narration` twin render nothing) held only because `buildTape` never reads `entry.action` — nothing named them. | **FIXED** — a row feeds seven non-swap actions and asserts an empty tape. |
| **L5-F3** | The cron embeds a machinery-provenance code (`guardrail_stopLoss`) in the rationale rendered verbatim, and the guards forbidding that class were asserted against fixtures that could never contain it. | **PARTLY FIXED** — the guard is re-asserted against the string the cron actually writes, so it can now fail. The token itself is **recorded as a founder copy question** (§5), not silently edited: C1 renders a motive verbatim, and altering persisted text is a ruling, not a build decision. |
| **L5-F9** | Reviewer isolation was violated (one shared snapshot), producing a false red and contradictory failures. | **RECORDED** — §2 above, with a ruling for the next review. |

### 3.3 LOW — fixed

`L5-F6` an undated `The plan at deploy` shipped against D-76's own "every label carries `activatedAt`" (the section is now absent whole) · `L5-F7` an absence check card said "check" three times (the time alone now prefixes those two labels) · `L5-F8` hazard 34 was convention-only (both theme guards now assert every `src/screens/battleView/` file is on their list) · `L2-F7` a new tape entry never scrolled into view (the effect's dep is null flag-off, so shipped behaviour is unchanged).

### 3.4 REFUTED

| Claim | Why it fell |
|---|---|
| **L1-F6, the scoring-tier half** — a tier crossing collapses into `no change`. | Refuter A: it does, and that is the module's **stated design**. `scores.active` moves with price on nearly every tick, which is exactly why D-77 excludes the live total, and the board already shows it. Now pinned by a row so the exclusion is a decision on the record rather than an accident. |
| **L1-F6, "`banked` is a dead discriminator"** — because any trade that moves it is already a card that breaks adjacency. | Refuter A disproved it with a repro: `banked` is the sum over a 50-capped array, so it also moves on **eviction**, which produces no card. That is precisely what makes L1-F7 far narrower than stated. |

The five lenses additionally dropped roughly forty candidates before reporting, each with a stated reason — among them: the memo dependency arrays (complete, and none recompute on a price tick), TDZ and hook order, React key collisions, non-Date timestamps sorting to the epoch, the review-mode injection indices desyncing after the fold, the `aria-labelledby` switch losing an accessible name, the `deriveReceipts` refactor changing behaviour (differential-proven identical over the full cross product), the `thresholdBaseline` lift affecting flag-off, and `deriveTierPrices` disagreeing with the row's percent on any `enrichAsset` path.

---

## 4. The mutation record

Lens 4 applied **45 mutations to the source** (not the tests), ran the suite, and reverted each. **40 were caught.** The five that were not are L4-F1, F3, F4, F5, F6 above — every one a **call-site** gap: the selectors were well guarded, the wiring was not. All five are now guarded and each fix was mutation-checked.

Representative rows that behaved: deleting the D-70 branch, weakening it to the sourceNote alone, dropping the `downgraded` gate, collapsing D-69's two labels, bare-splitting sentences on `[.!?]`, returning a value for a short, wrong tier arithmetic, removing either deploy gate, returning a whole tier rationale, folding across non-check entries, reintroducing the feed action filter, building cards from announced-but-unexecuted swaps, calling `selectWhyState` with the latest stamp, last-wins feed joining, carrying `exitReason` onto a card, ignoring the phase or the last check in the D-71 derivation, reverting the Desk branch, rendering the full paragraph on a row again, and leaking the flag-on render into the flag-off path (which reds the chat golden).

---

## 5. Recorded, not fixed — for the founder

1. **L5-F3, the provenance code.** `Guardrail override (guardrail_stopLoss): …` reaches the screen inside a verbatim engine sentence, correctly labelled `The system's reason`. C1 renders a motive verbatim; hazard 29 keeps provenance codes off the screen. Those two rules meet here and only a ruling can separate them. **Copy question:** may the parenthetical be dropped when rendering an engine motive?
2. **L2-F3, `Read the full check`.** It opens the book panel but does not scroll to it or move focus, so on mobile it can mount off-screen above the reader; and when the book panel is already open the tap is a no-op. Handover item 38.
3. **L2-F5, the expanded card's key.** `CheckCard`'s `expanded` state is keyed by array position, so an insertion above it collapses it. Refuter-confirmed as **loss, not corruption** — the key also carries `item.id`, so state cannot land on the wrong card. Dropping `idx` risks duplicate keys on the shipped path; left alone deliberately.
4. **L2-F6, tap targets in a trade card.** Under the flag, tickers inside a trade card are not tappable while tickers in the message above are. The Phase A precedent (A4 item 22, the row's inner targets) is to defer tap-target work rather than grow a phase's scope.
5. **L1-F7, the trades-cap eviction.** Two quiet checks flanking an *evicted* swap can collapse — but only when the appended and evicted trades bank identical points to 2 dp, on a >50-swap day. Refuter A re-rated LOW.
6. **L5-F10, two symbol rules.** `symbolPattern` (this phase) and the shipped `renderMessageWithEntities` detector both answer "does this text name NVDA". Reconciling them is **A2.3's first move** under ruling 8; recorded so it is not lost.
7. **L3-F4 / handover item 40, the unflagged Desk line.** D-71 is a shared Desk string by ruling, so `Checked 3:46 PM · last check today` reaches dashboard users at merge, not at the flip. Measured window: the day's final eval until the market flips closed. Ruled — but flagged for the founder because it is the one user-visible change in A2 that does not wait.

---

## 5b. Refuter B — attacking the fixes

The fix commit was itself handed to an adversary, on a fresh snapshot at the fixed HEAD, with instructions to find what the fixes broke. It ran 9 mutations against the new guards and 4 landed.

| # | Finding | Disposition |
|---|---|---|
| **FIX-1** | **HIGH (C1).** `isEngineAuthoredMotive`, text-only, missed the gameplan-rotation writer and thereby **inverted the safe default** from "unknown ⇒ the system's" to "unknown ⇒ the agent's" — and deleted the two rows that used to pin that default. Traced live and unflagged end to end (cron trigger → the Approve control on the Game Tape tab → `handleGameplanMeeting` → `trades[]`). | **FIXED.** The rule now takes `source` as a second signal, structured so both L1-F3 and L1-F4 stay fixed. Refuter B's own suggested "text OR source ≠ haiku" would have re-broken L1-F4 (`reinforced_haiku` carries `source: 'guardrail'` over the model's words); the shipped rule lists the two text-decides sources instead. Three new rows, including a source tripwire on the template and its source. |
| **FIX-3** | **LOW, and precisely the disagreement the fix claims to prevent.** `cleanText` began trimming in `selectWhyState` but not in `buildTape`, so one `trades[].rationale` rendered as two different strings under `white-space: pre-wrap` on the panel and the tape. | **FIXED** — both trim. |
| **FIX-5** | **MED.** Four of the five new mounted mutation rows kill the guard they name; **the fifth does not**. The row titled "the tape receives the RECEIPTS input" guards neither `receipts` nor `chatExchanges` nor the run key: its two runs of 2 come from message adjacency, because a directive filing *is* a chat exchange and therefore a message between the checks. | **FIXED by correcting the claim, not by faking a guard.** The row now says what it proves; the disposition conjunct is guarded where it is composed, in `buildTape.test.js`, and the reason a mounted render *cannot* guard it is recorded in both files. |
| **FIX-6** | **MED.** The source comment and the handover both claimed the A2.1b revert "leaves them alone. Verified by reverting in a scratch worktree." Refuter B executed it: five conflicted files, and `tierLabel` still falls inside a hunk git groups with the A2.1b helpers. | **FIXED by correcting the claim.** What the rewrite bought is measured rather than asserted: the revert now **conflicts** where it previously auto-merged the declaration away and left the trade card throwing (7 of 14 rows red, reproduced at `57824041`). Loud and correct beats silent and broken; it is not clean, and the comment now says so and names the resolution. |
| **FIX-2** | **REFUTED.** The D-71 day conjunct attacked across 7 timezones, both 2026 DST switches and the early close, against the real `getMarketState()` composition — correct everywhere. One nit accepted: the "ET, not the runner's zone" row was **vacuous** (every in-session ET instant shares its UTC day) and its comment was factually wrong. | Row rewritten around `2026-09-02T01:00Z` — Sep 1 in ET, Sep 2 in UTC — which fails under a UTC comparison in both directions. |
| **FIX-4** | **REFUTED.** The empty-state change is byte-identical flag-off *by arithmetic*, not by sampling: `sort` preserves length, so `combinedTimeline.length === 0` ⟺ the old predicate, with optimistic messages and the typing indicator counted on both sides. | No action. |
| **FIX-7** | The new flag-off wiring test is **not vacuous** (killing `tradeEvents` reds its anti-vacuity row, so `MU` really does come from the shipped slim line) and not flaky (green at settle 0 ms). One caveat recorded: it fails only when **both** flag gates are removed — correct behaviour, since either gate alone still yields `null`. | Recorded. |

Refuter B also **refuted two lens findings outright**: **L3-F5** (an empty `tapeEntries` would delete the shipped trade lines — mechanism real, state unreachable through both gates) and **L5-F10** (the two symbol rules disagree on 75 of 2401 differential inputs, *all* underscore-adjacent, never on prose, and they read disjoint corpora). **L4-F8/F9** it confirmed on the facts but judged acceptable: every unfalsifiable `not.toContain` sits inside an `it` that also carries a real positive assertion, and D-78/D-79 having *struck* those strings makes a forward-only tripwire the right instrument. One row is genuinely dead — `not.toContain('the agent&#x27;s rule')` guards the HTML-escaped form of a string no module contains in any form.

---

## 6. Disclosure

The adversarial pass ran in full: five isolated lenses, two refuters — one of them pointed at the fixes rather than the build, which is where the worst remaining defect was found — 65 executed source mutations, an explicit `vite build`, and this record. Two process defects are disclosed in §2 rather than smoothed over — a shared snapshot that produced a false red, and a wrong input file handed to four of the five lenses. Neither is known to have changed a finding; both are stated so the next reviewer can avoid them.

*Prepared September 3, 2026. Fixes at `a16e6d37` and the commit that carries this record.*
