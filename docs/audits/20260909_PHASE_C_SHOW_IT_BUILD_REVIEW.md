# Phase C — Show it: cumulative build review (BUILD_RULES §2)

**Date:** September 9, 2026
**Branch:** `claude/magical-wright-gek2gq` · **Base:** `origin/main` @ `47e5604a` · **Reviewed at:** `c0ca95e5` (the §6 commit) + `94be7304`
**Diff at review:** 41 files, +4,264 / −81 — **over the threshold on both counts** (≥10 files, ≥1,500 lines).
**Build:** Opus. **Review:** six subagent lenses on an isolated snapshot, coordinator-adjudicated.
**Fixes:** `84760908`. **Full suite after:** 649 files / 12,223 tests green. **`vite build`:** clean.

---

## 0. Executive verdict

| | |
|---|---|
| Findings raised | **34** across six lenses, plus 1 coordinator finding |
| **CONFIRMED and fixed** | **16** (1 coordinator + 15 lens) |
| **REFUTED** | **3** (one BLOCKER, raised independently by three lenses) |
| Accepted / recorded, not fixed | **7** (each with its reason, §5) |
| Clean categories reported | 30+, listed by each lens |
| Mutation checks run | 18 by Lens F, 5 by Lens C, 3 by Lens D, 8 by the coordinator |
| Verdict | **The dark-merge guarantee holds.** Sol's C-1 and C-2 are fixed and the fixes are now guarded by tests that fail under the defect they name — which, at the time of review, most of them were not. |

**The single most important result of this review is not a defect — it is that three of the build's own test batteries were largely vacuous.** The provenance boundary (Sol's BLOCKER), the cap's five race tests (Sol's MAJOR) and the card's render in the chat all passed with the code that implements them deleted. They do not any more.

---

## 1. Method, and one methodology failure to record

Per BUILD_RULES §2 and the Sep 2 reviewer-isolation ruling: six lenses, each read-only on git and on the working tree, each free to mutate only inside a snapshot.

| Lens | Dimension |
|---|---|
| A | Domain correctness of the card and its data |
| B | The prompt boundary and prose honesty (Sol C-1) |
| C | The cap, the transaction, concurrency (Sol C-2) |
| D | The dark-merge guarantee and the fence |
| E | Security and route hardening of a new authenticated write endpoint |
| F | Test integrity (mutation checks) and UI wiring/lifecycle |

**THE METHODOLOGY FAILURE, recorded because it cost real review time and produced a false BLOCKER three times over.** The coordinator gave all six lenses **one shared snapshot directory**. Reviewers mutating production code for mutation checks therefore mutated each other's tree. One lens flipped `SHOW_IT_ENABLED` to `true` and did not restore it; three subsequent lenses opened with a BLOCKER saying the flag ships lit, and a fourth reported a mid-run false green. Two lenses diagnosed the cross-contamination themselves and re-verified against the committed patch; one built a private copy and re-ran everything in it.

The Sep 2 ruling says reviewers work on *a* snapshot; it should be read as **one snapshot each**. The precedent it was written from — Reviewer B's restore overwriting a coordinator's in-flight fixes — is the same class of failure one level down. **Next review: `git archive` per lens, into per-lens directories.**

---

## 2. REFUTED (3)

| # | Claim | Why it fails |
|---|---|---|
| **R-1** | **BLOCKER — `SHOW_IT_ENABLED` ships lit; both flag pins are red** (Lens A #1, Lens C #1, noted by B, E and F) | The flag is `false` in the working tree, `false` at HEAD (`git show HEAD:src/config/featureFlags.js`), `false` in the branch patch, and `showItFlags.test.js` + `flagPinGuard.test.js` pass (9 tests). The snapshot's `true` was a concurrent reviewer's un-restored mutation (§1). Lenses B and E independently reached the same conclusion. **The pin guard was doing its job** — it reddened exactly as designed on a flag that contradicted its `DARK_BY_DESIGN` entry. |
| **R-2** | Lens A #1's corollary: "the working tree diverges from the committed diff — an unstaged flip" | The working tree never diverged. Verified directly. |
| **R-3** | Lens F's baseline redness in `showItFlags` / `research.dark` | Same cause. Lens F reached this itself and re-ran in a private copy. |

A refutation is not a dismissal: R-1 was the right thing for a reviewer to raise from what it could see, and the fault is the coordinator's.

---

## 3. CONFIRMED and fixed (16)

### 3.1 The card was printing things that were not true (6)

| # | Finding | Failure it caused |
|---|---|---|
| **A-2** | `composeStanding` read `position.openPrice` | `openPrice` is a CLIENT-side derivation (`enrichAsset`) and exists on **no persisted asset**. The one number the standing section exists to carry — the entry price — **never printed, for any name, ever**. Now `asset.swapPrice ?? battle.portfolio.startingPrices[symbol]`, the canonical server derivation. |
| **A-3** | The quote time was `etTime` — a bare `4:00 PM` | The card is persisted and re-read days later; a Friday close read as "this afternoon" on a Sunday. Now `etStamp` — `Fri 4:00 PM ET`. |
| **A-5** | Zone/regime/tier words came from the RAW value, the number from the ROUNDED one | §9's own named family. A raw RSI of 69.9997 prints `RSI 70 · neutral` — the overbought threshold beside the neutral word. Re-derived from the printed number; upstream thresholds copied exactly. |
| **A-6** | `EPS revisions 30d 47.2` — no unit, no sign | The field is a percent; both other renderers print `+47.2%`. A bare number reads as a count. |
| **A-7a** | `money(0)` rendered `Last $0.00` | `0` is `marketDataCache`'s own no-data sentinel — a default rendered as data, the hazard-1 class one level down. |
| **B-4** | The standing sat under "NOT what the check saw" with no provenance | An entry price **is** the trading process's own execution fact. It now carries `From the record · the board's own numbers`, and the PROMPT block drops the section entirely rather than assert a false provenance over it. |

### 3.2 The cost claim was false (1)

| # | Finding |
|---|---|
| **A-7b / E-2** | `readTechnicals` requested `fields: ['daily','price']`, and the `price` field is **uncached EODHD on every call**. So spec §6's *"no EODHD call unless the cache is cold"* and the route header's *"A READ, NOT A FETCH"* were both false, discovery **hazard 2** was live, and every request that cleared the pre-check burned a billed external call whether or not it won the cap. Now `daily` only; the quote is the cache brief's 15-minute price at the cache doc's vintage, falling back to the newest daily close **labelled as a close**. Two sources, never mixed, each with its own date. |

### 3.3 The withheld turn was still acting (3)

| # | Finding |
|---|---|
| **B-1** | A lint-withheld reply **still filed the directive extracted from the withheld sentence**. The user read "that wasn't sent" while a strategic instruction sourced from that same sentence went to the process, with a filed-directive status beside it. The whole turn is withheld now — directive, thread id, battle slot, status line and chips. |
| **B-2 / B-3** | The lint **caught none of the breaches it exists for** and **withheld innocent narration**. Verified: `That's a buy at these levels`, `The process will trim it`, `I looked it up`, `Expect a bounce`, `It'll get rotated out` all passed; `I'll walk you through the card` and `Should I show you the fundamentals?` were withheld — and the replacement line then asserted something untrue about them. Rebuilt as three families (verdict / forecast / attribution), each from a bullet of the rule, none a bare modal. Verified against 16 breaches and 11 innocent sentences. The withheld line was reworded to be true on any turn it can fire on. |
| **B-6** | The shadow record wrote the **code-authored** line as `agentMessage`, attributing a platform sentence to the model and discarding the one artefact a breach is worth recording. It now keeps the model's own text and stamps `researchLint` + the line that was sent instead. |

### 3.4 The boundary had a second door (2)

| # | Finding |
|---|---|
| **B-8** | The **legacy** history builder — the one every caller is on while `VOICE_GROUNDING_MODE` is `'shadow'`, i.e. the shipping configuration — excluded a card only **incidentally**, because the route happens to write no `userMessage`. D-121 part 3 asks for structural. It is structural now, keyed on the same constant as the grounded builder. |
| **B-7** | Each excluded card consumed one of the ten conversational-history slots. Cards come out before the slice now. |

### 3.5 Races, auth, and a verb the arena could not honour (5)

| # | Finding |
|---|---|
| **C-5 / E-1** | The transaction re-read **only the cap**. Owner, active, agent-binding and the universe were evaluated on a pre-read separated from the commit by the data fetch — so a tap racing the close cron appended a card to a **settled battle**, the exact state `file-directive`'s in-transaction check exists to forbid. All five gates are re-checked in-transaction now. |
| **E-3 / E-4 / E-5** | Auth now precedes the flag 404 (the flag-first order was a free rollout oracle for anonymous callers); `agentId`/`battleId` are format-validated before they reach Firestore (a `/` threw uncaught or pointed the read *and the write* at an arbitrary nested document); `symbol` is length-capped and charset-checked before it can reach an outbound URL. |
| **F-3** | **The League arena could spend a read it has no code path to display.** Its transcript is `eng.lines`; it never reads `chatExchanges`. A research chip there burned one of three scarce reads and showed the player nothing, ever. The arena no longer labels or taps a research chip — the same rule the Equip door follows. |
| **C-3 / F-2** | The Battle View door had **no in-flight guard**: a second tap during the route's own 2–15 s window passed the `disabled` check (which cannot move until Firestore delivers) and spent a second read on a duplicate card, with nothing on screen to say a request was out. One tap at a time now, with both doors disabled while it is out — through the `disabled` contract they already carried. |
| **D-1 / D-2** | **The flag's FLIP MAP was wrong.** `isShowItOn` is defined inside `featureFlags.js` and closes over the module binding, so the darkness suite's `SHOW_IT_ENABLED: false` override never reached it — the suite **would have reddened on the founder's one-line flip PR**, on a file the map does not name, which is the three-times-repeated failure the flag-pin guard was built to stop. Made hermetic; verified by flipping the flag and re-running (12/12 green). |

### 3.6 Smaller, and the coordinator's own (4)

| # | Finding |
|---|---|
| **D-3** | `researchUsed` was the one line doing work while dark — an O(n) scan per render of a screen that re-renders on price ticks. Gated. |
| **F-8** | The exhausted door's reason was unreachable for keyboard, AT and touch users: `aria-label` wins the name computation, a `disabled` button is out of the tab order, and `title` never appears on touch. It rides the accessible name now. |
| **F-7** | A dead `tapeKindEyebrow` line that could not fail under its own deletion. Removed; the ruling stays as a comment, the `auto_debrief` precedent. |
| **CO-1** | *(coordinator, found before the reports)* `FieldValue.arrayUnion` **deduplicates deep-equal elements**, and nothing distinguished two cards for the same symbol beyond a millisecond timestamp — so two concurrent taps could collapse into one array element while the route reported two spent. `researchId: randomUUID()`, as `file-directive` does by construction. Lens C reached the same finding independently (its #6). |

Also fixed from Lens B's closing notes: the chip block's prose said "book or bench" where the universe is wider, and neither the block nor the normalizer was **cap-aware** — the model kept offering `Show it` after the third card and the tap answered 409. A chip is never a promise the route will refuse.

---

## 4. Test integrity — the part that matters most

BUILD_RULES §2: *"A row that cannot fail under the defect it names is not a guard."* Three batteries failed that test.

| Battery | Before | After |
|---|---|---|
| **The provenance boundary** (Sol's BLOCKER) — delete the D-121 exclusion | **1 of 9** rows fail | **7 of 30** rows fail |
| **The cap's five race tests** (Sol's MAJOR) — make the transaction trust the pre-check | **1 of 9** rows fail | **3 of 10** rows fail |
| **The card's render in the chat** — skip the card, or un-skip the empty bubble | **0 of 2** mutations caught | **both** caught |

**Why they were vacuous, and what changed:**

- **The provenance fixture was not adversarial.** The route writes a card with no `userMessage`, an empty `agentResponse` and no marker — which `selectHistoryWindow` drops *incidentally*, on the empty-text and missing-marker branches, whether or not the exclusion exists. The fixture now carries all three properties that **would** admit it, so only `messageType` keeps it out. And the **second channel** is asserted: the model receives a messages array as well as a prompt, and a card admitted to `pairs` rides that one — invisibly to any assertion on the prompt string.
- **The race battery did not race.** Its posts were sequential and the fake committed every transaction body unconditionally, so the losing tap was refused by the *pre-check* — which the route's own header says is not authorization. The fake now models Firestore's **read-set precondition** and takes its snapshot **at read time** (the first draft spread the live doc inside `data()`, so a parked transaction still saw writes that landed while it was parked). Two rows are now genuinely concurrent, one via a barrier inside the transaction.
- **The chat's render had no test at all.** A new integration suite renders `AgentChat` with a research exchange and **counts bubbles**, so the empty-bubble mutation — which an assertion on the card's own markup cannot see — fails.

Lens F additionally confirmed 15 mutations that were **properly killed** by the existing guards: the grounding marker on the exchange, MACD null-honesty, the route's flag 404, the prompt block's flag gate, the platform-data label server-side and in the DOM, the door ordinal, both disabled states, the universe check, the reply lint, the scope short-circuit, the bare-date UTC shift, undated fundamentals, and the seconds-as-milliseconds quote.

---

## 5. Accepted, not fixed — each with its reason (7)

| # | Finding | Disposition |
|---|---|---|
| **B-5** | The C-1 machinery is inert while `VOICE_GROUNDING_MODE` is `'shadow'` — the block, the rule and the lint all ride the grounded prompt | **Recorded in the flag's own docstring as a FLIP ORDER constraint.** With B-8 fixed the card cannot enter the legacy prompt either, so the character honestly says it has no data on the name; it simply cannot discuss the card until the voice walk reaches `'on'`. A product limitation, not a dishonesty. Gating the route on the voice mode would block the founder's own smoke of the card. |
| **B-6b** | The route writes **no shadow record at all**, so a research tap is invisible to telemetry | Out of this build's scope, and hazard 12 warns specifically against reusing `gameMode: 'research'` for it. **A named follow-up.** |
| **B-7b** | A card leaves the prompt after ten later exchanges while staying on screen forever | Inherent to a fixed history window; the rule leaves with the card, so nothing ungoverned is left behind. Recorded. |
| **E-2b** | The rate limiter is per-IP, in-memory, per-instance | Pre-existing platform-wide property of `applySecurityMiddleware`, not introduced here. The cap bounds writes; with C-3 fixed, accidental amplification is gone. |
| **E-7** | The cap is an economy control, not a confidentiality one — the fundamentals half is world-readable from `indexIntelligence` | True, pre-existing, and **stated here so no document ever calls three reads a data boundary**. |
| **F-2b** | A failed research tap still has no error surface on the Battle View doors | The in-flight guard removes the damaging case (a double-spend). Inventing an error surface under review pressure is how scope creeps; **a named follow-up.** |
| **D-4** | `CommandDock` dragged a copy-module subtree in for a label that could not resolve while dark | **Fixed incidentally** by F-3 — that import came out with the arena's research chip. |

---

## 6. What the review could not break

Stated plainly, because a review that only reports failures is not calibrated:

- **The fence (BUILD_RULES §1).** All eleven fenced paths checked against the diff's `diff --git` headers: **none edited**. `createAgentBattle`'s doc shape untouched — the cap is derived, no new key. **Fenced function called:** `flattenPortfolioServer` (`agentScoring.js`), one new call site, read-and-flatten only, as `debate.js` already does.
- **The §2.3 import-boundary ratchet.** No new importer of `agentArchetypeConfig.js` or `archetypeScoring.js`; the baseline is correctly untouched.
- **The dark-merge guarantee.** Lens D walked every non-test hunk and could not find an observable difference. Full suite green with the flag lit *and* dark; `vite build` green.
- **The leak claim itself.** Lens B swept every `chatExchanges` consumer in `api/`: the decider, the eval assembler, the prompt assembler, the anticipation writer, the opener, film room and workshop chat. **No channel reaches a card.** `firestore.rules` does not admit `chatExchanges` to the client's update allowlist, so a card cannot be forged or deleted from a browser — which is also what makes the derived cap untamperable.
- **The universe union**, the `selectBench` refactor (byte-identical, cross-checked by identity), `decisionRecord.js`'s zero-import property, the `PaneBench` span/button swap (proved by an innerHTML diff), the normalizer's arity, the bare-factory `vi.mock` hazard (15 such suites, none reaches a module reading the flag), and BUILD_RULES §4 mock discipline (no suite mocks the module it guards).

---

## 7. Ledger note

No new ledger row. The review changed no ruling: D-116 → D-122 all stand as written, and every fix above brings the code closer to what they already say.
