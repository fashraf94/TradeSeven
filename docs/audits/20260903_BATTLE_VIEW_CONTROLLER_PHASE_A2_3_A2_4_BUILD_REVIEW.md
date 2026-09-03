# Battle View controller — Phase A2 (the rulings addendum, A2.3, A2.4) adversarial build review

**Date:** September 3, 2026
**Branch:** `claude/phase-a2-tape-piece-javcyf`. **Build reviewed at:** `4b32e442`. **Fixes at:** `d4ff893d`. **Refuters at:** the fixed head.
**Threshold:** BUILD_RULES §2 — the cumulative branch diff is 52 files / 7,149 lines, well past *≥10 files OR ≥1500 lines*, so the multi-lens adversarial review is mandatory.
**Process:** the rulings addendum's §2, in force for the first time — **one tree per reviewer**, and **the rulings documents to every lens**.

---

## 1. Executive verdict

| | |
|---|---|
| Lenses | 5, each on its own `git archive` tree at the review HEAD |
| Refuters | 2, on fresh trees at the **fixed** head |
| Findings raised | 40 |
| CONFIRMED and fixed | 27 |
| Recorded, not fixed | see §5 |
| REFUTED | see §4 |
| Mutations executed | 94 by the test lens, plus ~40 across the other four and the coordinator |
| `vite build` | green (the pre-existing chunk-size warning only) |
| Suite at handoff | 584 files, 10,013 passed, 63 skipped, 0 failed |

**Five HIGH defects, three of them found independently by more than one lens.** The two that matter most to a reader of this record:

1. **A ruling was built at half its stated scope, and the repo's own tests had started to encode the contradiction.** D-83 says a check is named by its cron slot *on every surface*; the build applied it inside `deriveTurnLine` only. But the turn line's strings ARE the Desk's, shared deliberately under a D-62 comment that says the two surfaces "cannot disagree" — so one instant had begun to read `Checked 12:47 PM` in `AgentDesk.render.test.jsx` and `Checked 12:45 PM` in `deriveTurnLine.test.js`. Two lenses found it independently. The flooring moved to the shared seam; the Desk now names the slot too, which is a **second unflagged Desk change** and is flagged for the founder in the handover's §4.
2. **Two load-bearing flag gates on SHIPPED surfaces could each be deleted with all 3,701 tests green** — the chat's ticker roster, and the shipped mount's receipts memo — and the one artefact ruling 8 names as the proof of the detector extraction contains not a single entity span. The flag-off guarantee held in the code and did not hold in the suite. It does now.

---

## 2. Method, and its two disclosures

Five lenses, each with its own dimension, each on **its own tree** — a `git archive` extraction of `4b32e442` under the session scratchpad with `node_modules` symlinked, read-only on git and on the working tree. Mutation checks therefore never ran against a shared snapshot: the A2 review's first disclosed process defect, closed by the addendum's §2 and by this run.

Every lens received **all three rulings documents** (the seed, the rulings V1, and the addendum V1.1), not the Phase 0 report: the A2 review's second disclosed process defect, likewise closed.

The dimensions: **L1** ruling fidelity and copy · **L2** wiring and lifecycle · **L3** the dark-merge / flag-off guarantee · **L4** test integrity (mutation) · **L5** cross-phase consistency, hazards and §9.

Then two refuters on fresh trees at the **fixed** head — one pointed at the fixes, one at the whole branch with fresh eyes. The A2 review's worst finding came from a refuter pointed at its fixes, which is why that shape is repeated here.

**One disclosure of this run's own:** the lens trees were cut before D-81 (the eight trigger strings) was committed, so L1 and L4 both reported it missing. It was built; the finding is refuted by timeline in §4, and the refuters were given the fixed head so nothing else falls in that gap.

---

## 3. CONFIRMED findings and their dispositions

### 3.1 HIGH

| # | Finding | Disposition |
|---|---|---|
| **L1-F2 / L5-F1** | **D-83 on one surface only.** `deriveTurnLine` floored its posture-string arguments; `AgentDesk.jsx:89-92` passes the raw instants into the same shared strings. One check, two names, up to 14 min 59 s apart — against `deskCopy.js`'s own in-file D-62 guarantee and §9. | **FIXED at the shared seam.** `etSlotTime` beside `etTime` in `deskCopy.js`; all four posture composers floor their check arguments; `slotLabel` (the ruling's name) delegates. Both surfaces agree by construction. The Desk's own expectations flipped in the same commit. |
| **L1-F3 / L2-F3 / L5-F5** | **`In the chat · 0` scoped to nothing.** The seed: zero "opens the unscoped tape at the piece's composer prefill". The build filtered to `[]`, and the chat fell through to its `EmptyState` — the fresh-battle onboarding copy — on a battle with a conversation. Two of the build's own comments asserted the ruled behaviour while the code did the reverse. | **FIXED.** `handleScopeToPiece(symbol, count)` scopes only when `count > 0`; it always prefills and always opens the chat. The mounted row now asserts no chip, a tape still present, and no `Your agent is ready`. |
| **L2-F1 / L5-F7** | **The desktop collapse remounted `AgentChat`.** `{chat}` was rendered in two tree positions, so React unmounted it on every collapse and every expand — taking the typed draft, the optimistic bubbles of a send in flight, the error banner, and the scope's own scroll memory. A4 paid for the draft-survival rule explicitly (F13). | **FIXED.** The column is the chat's one home: collapsed and open are the same element with different chrome and a different flex basis, and the layout row wraps so the board still takes the full width with the strip beneath it. A row asserts the same DOM node and the same draft across both transitions. |
| **L3-F1 / L4-F1** | **The `knownTickers` flag gate was unguarded.** Deleting it left all 3,701 tests green while widening what the SHIPPED chat underlines from the book to the whole battle universe — and an underline is a tappable span that opens a research modal (hazard 27). The goldens are structurally blind: the screen golden is captured on the matchups tab, the chat golden hands `AgentChat` a hardcoded roster. | **FIXED (guard added).** The flag-off composition test's fixture gained all three bench lists and a message that names them; the row asserts the book underlines and the bench does not. Mutation-checked: removing the gate reds it. |
| **L3-F2** | **The detector extraction's stated proof was void.** Ruling 8 and the module both cite the chat golden; its fixture passes no `onSymbolClick`, so the function returns two lines in and neither golden contains one entity span. `TICKER_ACCENT` could be changed to `#ff0000` with the suite green, and the module had no test at all while three Film Room surfaces render through it. | **FIXED (guard added, claim corrected).** A full render test pins the spans, the labels, the accents as literals, the keys, the interleaved prose, both click payloads, the four early returns and every shipped caveat. The two "the golden proves it" comments now name the tests that do. |

### 3.2 MED

| # | Finding | Disposition |
|---|---|---|
| **L2-F2** | On a collapsed desktop the scope door applied the filter but never opened the chat — the gate was `!isDesktop`, an A4-era assumption that A2.4 broke. The comment three lines above states the rule it violated. | **FIXED** — the gate is `!chatOpen`. |
| **L2-F4** | Both desktop controls dropped focus to `document.body`; each lives inside the chrome the other replaces. The mobile sheet has had a return-focus contract for this transition since A4 (CR4). | **FIXED** — focus moves to the control that replaces the one that vanished, with a row for both directions. |
| **L2-F5** | The scroll-restore effect listed `tapeEntries`, which is a fresh array on every Firestore snapshot, so it wrote `scrollTop` on the coarse clock's minute tick and on every price poll — cancelling the smooth auto-scroll two effects above it. | **FIXED** — the dep is the scope alone, and the effect early-returns unless the scope actually transitioned. Guarded on the flag path, where it can fail. |
| **L2-F6** | A session that mounted below 768 px and was then widened arrived on a desktop with **no chat column** — `initialDetent` is read once, and the phone's untouched peek carried over. | **FIXED, asymmetrically and deliberately.** An untouched shell adopts its own default only when that default is OPEN. Ruling 7's two stated cases are both desktop → mobile and are untouched; the reverse needed a rule because the shells' closed states are not the same thing — peek is a usable chat on a phone and an absent one on a desktop. Once the player has moved the sheet the detent is theirs and survives both ways. |
| **L2-F7** | `scopeSymbol` was set in five places and cleared in one; it outlived the piece leaving the board and the battle completing. | **FIXED for the case that matters** — the scope clears when its symbol leaves the roster. The rest is recorded (§5). |
| **L1-F4 / L5-F3** | The peek line stamped a folded run with the run's **first** member — the sort position, not the newest thing that happened — so the strip's own two lines disagreed: `Checked 1:00 PM` above `12:30 PM · 3 checks · no change`. | **FIXED** — the run's line carries no time at all, exactly as the card it stands for does. |
| **L3-F3** | The new layout effect's flag gate was unguarded, and the row whose title promised the guard asserted nothing about scroll. | **FIXED — by moving the guard where it can fail** and saying so. Flag-off the effect's only dep is permanently null, so the claim is unfalsifiable there; the falsifiable half (a re-render with an unchanged scope writes nothing) is now a row on the flag path. A comment in the flag-off file records why there is no row there rather than leaving a row that cannot fail. |
| **L3-F4** | The screen → chat seam was unguarded for `controllerCopy` and for the `receipts` memo: adding the first, or removing the second's flag conjunct, changed what a real flag-off user reads with the whole suite green. | **FIXED (guards added).** Both in the composition test the goldens cannot be; the copy one drives a real failed send, because the string exists nowhere else. |
| **L5-F6** | Two price formatters. `formatPrice` is `$${n.toFixed(2)}` — no thousands separator — so a row read `$1234.50` beside the panel's `Entry $1,234.50` two lines below. | **FIXED** — one formatter, `BATTLE_VIEW_COPY.price`, with a row at four figures. |
| **L4-F2** | The strip's peek line was only ever asserted `toBeTruthy()` / `length > 0` / `toContain(' · ')`; replacing it with a plausible constant survived both suites. | **FIXED** — the row recomputes `derivePeekLine` from the fixture's own document and then moves the tape to prove the strip follows. |
| **L4-F3, F4, F5, F6, F7, F8, F9** | Seven assertions that could not fail: a §9 row whose two sides were byte-identical (`dailyLevels: undefined` makes `computeDollarInfo` return null), a byte-identity row comparing one code path with itself, a truncation row calling the wrong entry point, a `lastIndex` row guarding a defect the loop shape prevents, a `Set(...).size` row about the test's own array, a `?? {}` row that was unconditionally truthy, and a `>= 0` row. | **ALL SEVEN REWRITTEN** to assert the thing they name. One more of the same class was found while fixing them — an accent assertion built from the imported constant, which mutates with its source — and rewritten to the literal. |

### 3.3 LOW — fixed

- **L2-F10** the % block remounted (and replayed its slide, and broke its `aria-describedby` target) the moment a live price first arrived, because the wrapper appeared with the price. The wrapper now renders on the whole flag path.
- **L2-F11** `knownTickers` took `agentBattle` as a dependency, so the Set — and the chat's whole timeline behind it — rebuilt on every snapshot **on the shipped path**. Narrowed to the three subtrees the roster reads.
- **L2-F12** `atOf` called `toISOString` on anything `instanceof Date`; an Invalid Date is one, and throws. Guarded.
- **L4-F10** a `typeof` conjunct fully subsumed by `Number.isFinite` — a conjunct that cannot fail. Removed.
- **L1-F5 / L5-F10** the flag-on roster read `agentBattle.portfolio` while the board renders from a prop fallback, so a document without one would have shown seven pieces the detector had never heard of. The roster now starts from the same enriched portfolio the rows render.
- **L5-F8** the A2.1b revert instruction under-specified: D-83's `slotLabel` import lands inside the same conflicted hunk and must also be kept. Corrected in the comment and in the handover.

### 3.4 Claims corrected rather than left standing

Three comments in this session's own code over-claimed, and a review that only fixed code would have left them:

- `scopeTape.js`'s header said the count and the filtered list "cannot disagree". They differ by exactly one input — the chat's optimistic in-flight bubble — and the header now says which, and why that is the honest direction (**L1-F6 / L5-F4**).
- `renderMessageWithEntities.jsx` and `deriveChatMessages.js` each said the chat golden proved the lift. Neither was true; both now name the test that is.

---

## 4. REFUTED

| # | Finding | Why it does not stand |
|---|---|---|
| **L1-F1 / L4-F11** | "D-81, the nine trigger strings, was silently not built." | **Refuted by timeline.** The lens trees were cut at `4b32e442`; D-81 was committed at `f00b8835`, after. All nine strings ship, with the addendum's `near` edit, a row asserting each by name, and a mutation row that an unknown type stays silent. L4 flagged the ambiguity honestly (the addendum's §4 Go list does not name ruling 2) — the coordinator's call was that "Accepted" is a build instruction where rulings 3, 5, 6 and 7 carry explicit no-build dispositions, and that D-81 is one of the ledger rows §3 requires this session to leave behind. |
| **L2 — `readFullCheckTick`'s `reducedMotion` dep steals focus** | Refuted by L2 itself with a repro: framer's `useReducedMotion` reads the preference into `useState` once and never re-subscribes, so the dep cannot change during a mount. Focus stayed on the composer across a live media-query flip. |
| **L2 — `slotLabel` / `buildTape` throw on malformed timestamps** | Refuted by L2 itself: `slotLabel` returns null for every malformed shape tried, including Firestore-Timestamp-alikes; the one throwing input is `±Infinity`, which is not a reachable document shape. |
| **L2 — two `AgentChat` instances, or a desktop with neither chat nor strip** | Refuted: the branches are exhaustive and `qa('textarea').length === 1` holds at mount and on both sides of a crossing in both directions. |
| **L3-F5, L3-F6** | The new `onScroll` listener and the hook's extra mount render are real, and neither changes output. Recorded as observations by L3 itself, not defects. |
| **L4 — four "surviving" mutations** | Provably equivalent mutants: a `typeof` subsumed by `Number.isFinite`; a case-insensitive character class whose case-sensitivity is enforced by the `Set` lookup; a shared regex whose `lastIndex` the loop always resets; and a `peekLine` computed without its flag gate, which is a dead value flag-off. One of the four (the `typeof`) was removed anyway, because a conjunct that cannot fail is the shape §2 names. |

---

## 5. Recorded, not fixed — for the founder

1. **The Desk now names the slot, unflagged.** Fixing L1-F2 / L5-F1 at the shared seam was the only way to satisfy D-83's "on every surface" and D-62 together, and it means a real dashboard user sees `Checked 12:45 PM` where they saw `Checked 12:47 PM`. That is a **second** unflagged change in A2, beside D-82's. It is more accurate, not less — it names the check the cron actually ran — but it is user-visible before the flip and the founder should know. Handover §4 item 54.
2. **`Read the full check` scrolls against the panel's collapsed box** (L2-F8). The book panel mounts at `height: 0` and animates open, so `block: 'nearest'` is decided on a zero-height insertion point. Left as built after reasoning it through: that point IS the panel's top, which is where the reader must land, and an off-screen one still scrolls. What `nearest` never promised is the panel's *bottom*, and on a phone a long check can still open past the fold. A second scroll after the animation would risk a jump under the reader; recorded rather than guessed at.
3. **On mobile at the FULL detent, `Read the full check` moves focus to a heading underneath the sheet** (L2-F8, second half). Ruling 4 says to keep the sheet's focus rules intact, and lowering the detent from the door would break them. A ruling, not a review call.
4. **The mobile peek sheet grew one or two rows while `SHEET_PEEK_PX` and the board's bottom reserve did not** (L2-F9). `SHEET_PEEK_PX = 172` is a measured sum from the A4 review; peek is `height: auto` so the sheet really does grow, and the board's `SHEET_PEEK_PX + 32` clearance did not. jsdom does no layout, so the occlusion is unmeasurable here — the constant, the two new rows and the unchanged reserve are all that can be stated. **Wants a look in the founder's smoke.**
5. **The scope survives the Why? panel closing and the battle completing** (L2-F7, partly). Only the piece-left-the-roster case is fixed. Clearing on close would make the door useless — the player scopes, then closes the panel to read.
6. **A scoped stream can hide a new message while the unread dot lights** (L2-F7c). Inherent to any filter; recorded so it is a decision.
7. **`This piece today` and `In the chat · n` are not day-scoped** (L1 obs 1). The seed says n counts *today's* entries; the rulings restate the rule by kind and drop the word. Unreachable at HEAD (`AGENT_BATTLE_DURATION_MODE = 'fullday'`), and both over-claim on a legacy multi-day battle.
8. **`{n} checks · no change` can fold across a trading-day boundary** (L1 obs 3) — D-77 has no day conjunct. Same reachability as 7.
9. **"nothing was sent" is unprovable on the thrown-fetch branch** (L1 obs 4). A request that reached the server and wrote before the connection dropped charges the budget while the banner promises it did not. The ruling scopes the string to *a server error*; the shipped code had one string for both branches, so the build is faithful to the ruling's words.
10. **The peek line can render a fabricated time** (L5-F11). `deriveChatMessages` falls back to `Date.now()` for an exchange with no parseable stamp — lifted unchanged, but the peek line is a new consumer, and `deskCopy`'s rule is "never invent a time".

---

## 6. Outside this task — carried forward, not fixed (BUILD_RULES §3)

The four in the A2 handover §6 are unchanged. **One new one**, found by L1 and worth its own tasking: `GameTapeView.jsx` renders `citedForgeRules || citedRules` — raw `_`-joined machinery codes (`swap_window_cap`, `vwap_cascade_guard`, `risk_*`) — and it also renders `entry.action` (`GUARDRAIL_FORCED_SWAP`) as an eyebrow. It is a shipped surface, unchanged by this diff, and it is one header tap away under the controller flag. It is the same class D-80 just closed on the tape.

---

## 7. Disclosure

The adversarial pass ran in full and to the addendum's §2: five isolated lenses on five separate trees, all three rulings documents to every one, two refuters on fresh trees at the fixed head, 130-odd executed mutations, an explicit `vite build`, and this record. One process defect of this run's own is disclosed in §2 — the lens trees predated the D-81 commit, which produced two findings that are refuted by timeline rather than on their merits.

*Prepared September 3, 2026. Build at `4b32e442`; fixes at `d4ff893d`; the refuters' verdicts and any further fixes are appended in §8.*
