# Four-item build — cumulative code review (BUILD_RULES §2)

**Date:** September 10, 2026
**Branch:** `claude/amazing-cray-ytatzz` · **Base:** `origin/main` @ `73a785b8` · **Reviewed at:** `6f649d27`
**Diff at review:** 16 files, +839 / −121 — **over the file threshold (≥10), under the line threshold (≥1,500).**
**Build:** Opus. **Review:** three lenses + one refuter, each on its own `git archive` extraction.
**Fixes:** `db245356`. **Full suite after:** 651 files / 12,282 tests green, 3 files / 64 tests skipped. **`vite build`:** clean.

---

## 0. Executive verdict

| | |
|---|---|
| Findings raised | **27** across three lenses |
| **CONFIRMED** (survived a refutation attempt) | **12** |
| **CONFIRMED-DOWNGRADED** (real, severity wrong) | **5** |
| **PARTIAL** (one half died) | **3** |
| **REFUTED outright** | **0** — but 6 lost their headline claim and 4 collapsed into other findings |
| Mutations run | 36 by Lens C, 5 by the refuter's own harness, 17 by the coordinator |
| Fixed | 15 findings, in `db245356` |
| Filed for separate tasking (§3) | 2 |
| Recorded, not fixed | 4 |

**The two results that matter.**

1. **The branch's central claim was false.** `Couldn't load the card · no use spent` was gated on `!res.ok`, and a non-2xx can reach the client with a card already written. The clause is now gated on an attestation the *route* issues, because the route is the only party that can know.
2. **The screen half of items 4–5 had no behavioural test at all.** Three source-text greps stood in for it. Two plausible defects — a stray `setResearchError(null)` in a `finally`, and a prop moved onto a component where it is dead — were each silent across the entire 12,266-test suite. Both now redden 12 and 9 rows.

**And one result in the branch's favour.** Item 1 (`notHeardLabel`) is the best-guarded change on the branch: reverting it reddens 13 rows across 5 files, a deictic fallback 3, an appended clause 7, reading the receipt's instant instead of the stamp's 8. Item 3's byte-identity claim was independently re-derived by two lenses over 15 and 23 probes and holds on every input.

---

## 1. Method

Per §2 and the Sep 2 reviewer-isolation ruling, **as amended by the last review's own methodology failure** (`20260909_PHASE_C_SHOW_IT_BUILD_REVIEW.md` §1: six lenses shared one snapshot, a reviewer's un-restored flag flip produced a false BLOCKER three times over, and that record's closing instruction was *"Next review: `git archive` per lens, into per-lens directories"*).

That instruction was followed. Four `git archive` extractions at `6f649d27`, path-distinct, `node_modules` symlinked, no `.git` in any of them, none with access to the shared working tree. The mutating lens ran last. **No cross-contamination occurred**; the shared tree was verified clean at `6f649d27` after each lens returned.

| Lens | Dimension | Tree |
|---|---|---|
| A | Domain correctness and claims honesty | `lensA` |
| B | Wiring and blast radius | `lensB` |
| C | Test integrity, by mutation (ran last) | `lensC` |
| R | Refutation — instructed to break all 27 | `refuter` |

**One caveat on the baselines.** Lens C recorded a clean whole-tree baseline (650 files / 12,266 passed, EXIT=0). The refuter could not reproduce it: `src/components/League/battleArena/useSessionCompositeTrail.test.jsx` fails 2/21 when run alone in its tree, passes inside a wider run. Order-dependent, unrelated to this branch, and it did not affect any verdict. **Filed below.**

---

## 2. What the refutation actually killed

A review whose refuter confirms everything has not been run. Six headline claims died:

| Claim | What killed it |
|---|---|
| A1's own 500 repro | Lens A's mock threw **before** applying the write buffer, so it proved nothing about a throw after a landed commit. The refuter rebuilt the harness — commit applies, then throws a real gRPC-coded error, retry gated by a transcription of the library's own predicate — and produced a **stronger** repro. The finding survived; its evidence did not. |
| A1 as CRITICAL | Nothing is reachable pre-flip (`SHOW_IT_ENABLED = false`), and the 409 arm additionally needs the last slot. → HIGH. |
| A5(a) "an assertive region is not announced on insertion" | That is the documented failure mode of a **polite** region created with its content. `role="alert"` announcing on insertion is the ARIA APG's own alert pattern. No source was cited and none exists in-repo. → REFUTED. |
| C4's consequence ("the drift guard is defeated") | With the concatenated re-copy in place, changing `heardLabel` still reddens the derived row immediately. Only the tripwire's *name* overstated. → HIGH to LOW, PARTIAL. |
| C6's repro | Swapping the two cards' whole receipts reddens `paneOff.golden`. The finding survives on a tighter mutation (swap the **stamps** only), which the refuter supplied. |
| C7's repro | `const failed = door` reddens two rows, including the one it names. The observation survives only under a disciplined restructure. → MEDIUM to LOW, PARTIAL. |
| C10 | The `!isBook` gate has **no live call site**: the book panel is mounted without `onShowIt`, so the existing gate already refuses. No behaviour for a guard to protect. → informational. |

Four findings collapsed into others: A6(i) ≡ B9, C3 ≡ A7, C5 shares A3/B3's cause, B2 is a third instance of A1.

---

## 3. CONFIRMED and fixed (15)

### 3.1 The cost clause was not attestable — A1 / B2, with A7 and C3 (HIGH)

The docstring enumerated statuses and concluded that any refusal proves no write. Three counter-mechanisms, all re-derived from primary sources:

- **`runTransaction` retries.** `@google-cloud/firestore/build/src/transaction.js:396-420` re-runs the update function on a retryable commit error; `:581-604` retries codes 14/4/13/2/1/10/16/8 — the ambiguous-commit set. A commit that **lands** whose reply is lost re-runs against a fresh read that now holds its own card → on the last slot, `{kind:'exhausted'}` → **HTTP 409, slot spent**.
- **The 200 sits inside the `try` whose `catch` answers 500.** Anything throwing after the commit answers 500 with the card written. *This repo has already paid for that exact shape*: `battleViewCopy.js:669-676` records it for `api/agent/chat.js`, where it caused the `· nothing was sent` clause to be **deleted** (A2 review RB-F4). The branch reintroduced the same clause shape ~300 lines above that note.
- **A platform 502/504** at the route's `maxDuration: 15` is a response the route never authored.

The branch's own cited precedent contradicted it: `decisionRecord.js` says *"a network failure **or a 5xx** cannot make that claim"*, and `filingFailureLine` sends every 5xx to the claimless line.

**Fix.** The route attests. `NO_CARD_WRITTEN` (`api/agent/research.js`) rides every refusal answered from before `db.runTransaction` is opened, and **none** answered from inside or after it. The client reads the body, never the status; anything unattested takes the claimless line. The gate **fails closed**: a refusal path added without the field gets the claimless line by default. Pinned by `research.dark.test.js` — which walks the source, asserts every pre-transaction refusal attests and nothing below the transaction does. Mutation-checked three ways (attest the transaction's 409 → 1 red; attest the catch-500 → 1 red; drop one pre-transaction attestation → 1 red).

### 3.2 The screen half had no behavioural test — B6 / C1 / C2 (CONFIRMED; C2 the most damning in the set)

No test anywhere mocked `isShowItOn` true and mounted the screen. Everything rested on three greps of `AgentBattleScreen.jsx` as a string.

| Mutation | Before | After |
|---|---|---|
| `setResearchError(null)` in the handler's `finally` (React batches set+clear; no render ever paints the line) | **0 red / 12,266** | **12 red** |
| `researchError={researchError}` moved onto a component where it is dead (grep count still 2) | **0 red / 12,266** | **9 red** |
| Infer the attestation from `!res.ok` again | n/a | **2 red** |
| Drop the record-clears-it effect | n/a | **2 red** |

**Fix.** `src/screens/AgentBattleScreen.showIt.jsdom.test.jsx` — 12 rows that mount the screen, tap both doors and stub the route by URL. The three source greps are replaced by the one thing a source read is honestly good for (no client keeps a research count), with a note saying so.

### 3.3 The failure line outlived the fact that refutes it — A4 / B8 (HIGH)

Cleared only at the start of the next tap. In A1's states the card arrives and the count advances beneath a line saying it did not; on a third-read failure the line is permanent, because the exhausted door forbids the tap that would clear it.

**Fix.** The subscribed record retires it: an effect on `[researchUsed, agentBattle?.id]`. The count moving *is* the proof a card landed, and it is the only thing that can refute either sentence.

### 3.4 One tap, several alerts, and a chip that lost focus — A3 / B3, B4, B5, half of C5 (CONFIRMED)

`selectBench` emits one card per **sentence**, so a name mentioned twice renders two chips — and the failure line lived inside `Chip`, so one tap printed and announced it twice. The same placement changed the chip's root element from `button` to a wrapping `span`, unmounting the button and dumping a keyboard user's focus to `<body>` at the instant `role="alert"` fired; and on a flagged name it spliced the line between the symbol and its badge.

**Fix.** The line leaves `Chip` and is said **once**, at the group where the failed name first appears. The chips point at it with `aria-describedby`, which is also the first time a keyboard user got the failure at all. All three findings fall to one change.

### 3.5 The regime name sat where ARIA prohibits naming — A5 / B7 (CONFIRMED, main claim)

`aria-label` on a bare `<span>` maps to `role=generic`, where name-from-author is **prohibited**; the name may be dropped outright, which would have delivered nothing to the touch/keyboard/AT readers commit 2 was written for. No axe, no `eslint-plugin-jsx-a11y` in the repo, and every assertion checked only the serialized attribute. The repo's own counter-pattern is three sites deep (`ResultCard.jsx:71`, `EntrySelector.jsx:297`, `CorrelationLab.jsx:679`), and `WhyPanel.jsx:253` already puts `aria-label` on `role="region"`.

**Fix.** `role="img"` on the named span only. A5(b) — the door had no `aria-describedby` to its failure — fixed alongside.

### 3.6 Guard hygiene — C4, C6, C8, C9, C11 (CONFIRMED)

| # | The guard's weakness | Fix, and the mutation that now bites |
|---|---|---|
| C4 | The narrator tripwire banned an **interpolated** copy. A concatenated one was silent across 646 files / 12,168 tests. | Bans the sentence however assembled, with the grounding-rule literal removed first (the `NARRATOR_EXEMPT_SENTENCES` pattern). Concatenated re-copy → 1 red. |
| C6 | The card-state rows asserted co-occurrence, not containment: swapping two cards' stamps kept every assertion true while printing a scrollback thread's verdict on the current card. | Rows slice the card by its own `data-receipt` boundary — no production markup added (an added attribute broke both byte-identity goldens, correctly). Stamp swap → 2 red. |
| C8 | The bench's `attested` attribute was pinned nowhere; the panel's twin was. | Pinned. Freeze → 1 red. |
| C9 | `ROSTER`'s three names shared no substring, so `includes` and `===` were indistinguishable. | `MP` beside `MPC`, **both directions** asserted — the first draft of this row tested the harmless one. Either mutation → 1 red. |
| C11 | A tautology: `suffix` was built from `label` two lines above. | Deleted. |
| C5 | Every bench fixture had `cards: []` and `flagged: []`, so two of three chip sites were unguarded. | Fixtures carry sentence cards, a flagged name and overlapping symbols. Stripping the door from the first two sites → 2 red. |

---

## 4. Recorded, not fixed (4)

| # | Finding | Disposition |
|---|---|---|
| **A2** | Last-entry-wins makes the widened negative the thread's verdict, not one check's fact. | **CONFIRMED-DOWNGRADED to LOW.** The rendered sentence is *true* — it names the check it is about — and last-entry-wins already governed the positive **before this branch**, so the property is pre-existing, not introduced. Reachability needs `ARCHETYPE_INTEGRITY_MODE` to leave `'enforce'`. |
| **A6 / B1** | A third surface (`AgentChat.showIt`) answers the same statuses differently. | **CONFIRMED-DOWNGRADED to MEDIUM, docs-honesty.** No behaviour on this branch changed — `showItFailed` is byte-identical and the diff's only `AgentChat.jsx` hunk is comments. What the branch added was a docstring claiming one function governs. **The docstring now says plainly that the chat chip is not on the selector, and why.** |
| **C7** | `NO FAILURE, NO WRAPPER` compared the container against itself. | **PARTIAL / LOW.** The row is rewritten to assert what it can actually prove — the **chip node and its markup** are unchanged across the failure transition, which is B4's real content. A cosmetic wrapper present on both renders remains outside what this row claims. |
| **C10** | The `!isBook` gate is unguarded. | **Informational.** No live call site can exercise it; the `typeof onShowIt === 'function'` half already refuses. Gate retained as defence in depth. |

---

## 5. Filed for separate tasking (§3 — found outside the task, not fixed)

1. **The chat chip's 409 collision.** `api/agent/research.js` returns 409 for both `exhausted` and `"Battle is not active"`; `AgentChat.jsx:1130` maps every 409 to `All 3 reads used in this battle.` So a chat tap on a battle that just closed tells the player they spent three reads they never spent. Pre-existing — neither file appears in this branch's diff. (B9 / A6i.)
2. **A retried transaction can write two cards for one tap.** `researchId` is generated *inside* the transaction body, so a retry after an ambiguous commit produces a different id and `arrayUnion` appends a **second** card on a non-last slot — answering 200 while spending two of three reads. Fixing it means hoisting the id and making the transaction idempotent on it; that changes the route's write semantics and is its own task. (Refuter, out-of-scope note on A1.)
3. **An order-dependent test.** `src/components/League/battleArena/useSessionCompositeTrail.test.jsx` fails 2/21 run alone, passes in a wider run. Unrelated to this branch.

---

## 6. What this review did not cover

- **Preview or production.** `SHOW_IT_ENABLED` is dark; nothing here has production exposure today. Every Show-it finding goes live at the founder's flip, which is the moment to re-read §5 and §3.1.
- **Real AT behaviour.** The refuter could not test whether a given browser/AT engine drops a name on `role=generic`. What is certain is that the spec prohibits it and the repo has no tooling to assert it; `role="img"` makes the name valid by construction rather than by hope.
- **The fenced files.** None read for edit, none edited. `api/agent/research.js` is not on the §1 fence list; it was edited, and that is recorded in §3.1.
