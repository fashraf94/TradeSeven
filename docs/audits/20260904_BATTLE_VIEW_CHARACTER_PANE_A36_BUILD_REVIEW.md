# Phase A3 — the smoke-fix and A3.6 build review (V1)

**Date:** September 4, 2026 (evening)
**Branch:** `claude/character-pane-phase-a3-rulings-rq17ta`
**Range reviewed:** `3543abc0..b145eaea` — this session's twelve commits. A3.0 → A3.5 were reviewed in the previous session's record and are not re-reviewed here.
**Threshold:** BUILD_RULES §2 requires a review at ≥10 files or ≥1500 lines. This session's diff is **37 files / 3,154 insertions**; the cumulative branch diff is **66 files / 9,307 insertions**. Well over, on either measure.
**Companion:** `docs/audits/20260904_BATTLE_VIEW_CHARACTER_PANE_A36_HANDOVER.md` — written *after* this record, per the tasking.

---

## 1. Executive verdict

| # | Item | Verdict |
|---|---|---|
| 1 | The three smoke fixes (F1, F2, F3) | **Built, and every one had a single root cause worth naming.** F2's was a rule the repo already knew and had written down twice. |
| 2 | The Bench shape fix | **Built.** The ruling's own mutation — re-introducing per-symbol duplication — reds two rows. |
| 3 | §3, the bench-organization discovery | **Read-only, both questions answered, nothing built.** Verified by a lens: no `sector` / `archetypeScore` / `fit` token anywhere in the Bench path. |
| 4 | A3.6 (D-97) | **Built — and it shipped three P1 defects that this review caught and nothing else could have.** |
| 5 | Flag-off / pane-off | **Byte-identical, mutation-proven.** Unconditional `position: relative` on the row reds both goldens. |
| 6 | Fence and ratchet | **Zero §1 contact.** The §2.3 ratchet had been RED since A3.2 and is now fixed — see §5. |
| 7 | Guards | Both new modules on both lists with baselines in their creating commit. |
| 8 | Tests | **10,639 pass, 64 skipped, 0 failing, across 606 files.** A FULL-suite figure — see §5 for why that qualifier now appears. |
| 9 | `vite build` | Exit 0. |

**The honest headline:** A3.6's "never on mount" — the guarantee the whole feature rests on and which its module header states in as many words — was broken on *every single page load*. Two lenses found it independently. The footer told League Tournament players they had banked 2× when the engine banked 1×. The bubble's eyebrow had no colour at all and rendered invisibly on the loudest event in the game. And of my own test rows, **twelve could not fail under the defect they named** — including the one guarding Bench's D-80 authorship line, which turned out to have no coverage on either side of the codebase.

Every instrument I built passed the whole time.

---

## 2. Method

Five lenses, each in its own `git archive` snapshot tree under the session scratchpad with `node_modules` symlinked, read-only on git and on the shared working tree (BUILD_RULES §2's reviewer-isolation ruling). Then a sixth agent whose only job was to **refute** the findings.

**The harness was proven able to report a survivor before any run of kills was trusted:**

| Probe | Result |
|---|---|
| `BAGGER_BURST_MS` 700 → 5000 | **SURVIVED** — 749 green. Correct: hazard 47 forbids timing assertions, so nothing should pin this. |
| Delete the crossing line in `deriveBaggerCrossings` | **KILLED** — 13 red. |

A green result after a mutation is therefore evidence, not a broken harness.

**Lens coverage:** 1 domain correctness · 2 wiring and lifecycle · 3 the flag-off/pane-off guarantee and guard integrity · 4 test integrity (52 mutations) · 5 cross-phase consistency and the rulings.

---

## 3. CONFIRMED — code defects

### P1-1 · "Never on mount" was broken on every load
`useBaggerMoment.js` · found independently by lens 1 and lens 2 · **FIXED** `41020b08`

The hook is called above the screen's `loading` early return — it has to be, hooks are unconditional — so its first run sees `{battle: null, loading: true}`. It seeded `0` for every piece, while the book was *already full* because `playerPortfolioSource` falls back to the navigation prop's portfolio. The next render, where the doc lands, compared `0` against a peak that had been in Firestore for hours and announced it.

Every already-banked piece burst, and the character spoke a line about a crossing from before the player opened the app — on every load, reload and navigation in. `deriveBaggerMoment.js` asserted the opposite: *"A reload therefore cannot re-fire: it re-seeds from a doc that already reads ≥ 1.0."*

The seed now waits for a doc **and** for something to remember. The empty-book ordering (doc first, portfolio a render later) is the same door and is shut too.

**Why no instrument saw it:** every screen harness mocks `useAgentBattle` with the doc already present and `loading: false`, so seed and first real doc are the same render. `useBaggerMoment.js` had no test file at all.

### P1-2 · The footer dropped the per-asset `tierMultiplier`
`deriveBaggerMoment.js` · lens 1, independently reached by lens 5 · **FIXED** `41020b08`

`agentScoring.js:267` resolves `asset.tierMultiplier ?? (CONVICTION_MULTIPLIERS[asset.tier] || support)`, because P4 flat6 stamps a per-asset override on League Tournament docs at creation (`agentBattleService.js:103-105`) and swap-in (`agentSwapExecution.js:297-298`). `baggerMomentFacts` re-derived from the tier key alone.

On a tournament doc the engine banks 1× and the footer said 1.5×/2× — with the row's own allocation label reading `📈 1x` directly above it. BUILD_RULES §9's named bug family, on one row, from two sources. `enrichAsset` spreads the whole asset into the scorer *precisely* so the stamp rides through; the fix reads the same field off the same object.

### P1-3 · The bagger bubble's eyebrow had no colour
`AgentBattleScreen.jsx` (inline construction) · lens 5 · **FIXED** `41020b08`

`deriveBubble` is the guarded factory — every branch sets `eyebrowColor` from `TapeCards`' exported map, and `deriveBubble.test.js` asserts every bubble's colour matches `/^var\(--ft-/`. The bagger bubble was a **second construction site** for the same rendered object and omitted the field, so `CharacterAvatar` wrote `color: undefined`.

Hazard 43 exists for exactly this. The bubble is now built in `deriveBubble` — one construction site — where the existing colour guard reaches it, and `TapeCards` owns `BAGGER_EYEBROW_COLOR` beside its three siblings.

### P2-1 · `viewportInsetFrom` measured the wrong thing, twice
`useChatSheet.js` · lens 1 · **FIXED** `41020b08`

`layout − visual` is the bottom gap only when the visual viewport is flush with the top. `offsetTop` was never read, so anything above it (iOS scrolling a focused input into view, a pinch-pan) was counted a second time at the bottom. And a pinch-zoom shrinks the visual viewport while `innerHeight` stays put, so a 2× zoom on an 800px page read as 400px of chrome and threw the mark into the middle of the screen.

### P3-1 · A second crossing cut the first burst short
`useBaggerMoment.js` · lens 1 and lens 2 · **FIXED** `41020b08`

`setBurst({symbols: crossed})` replaced rather than merged, so a crossing landing inside an open window ended the previous symbol's wash immediately — the opposite of what the timer's own `seq` comment claimed to protect. That guard is also unreachable (the effect's cleanup already disposes the superseded timer), and the code now says so instead of claiming otherwise.

### P3-2 · A short would have been told `+{baseATR}%`
`deriveBaggerMoment.js` · lens 5 · **FIXED** `41020b08`

`deriveTierPrices` refuses a short (`selectWhyState.js:497-504`) because a short's bagger is a price *decrease*. `baggerMomentFacts` did not. Latent under BUILD_RULES §7's long-only V1 — but two readings of one field that disagree by construction is how the family starts.

### P3-3 · `+3%` where the rest of the view says `3.0%`
`battleViewCopy.js` · lens 5 · **FIXED** `41020b08`

---

## 4. CONFIRMED — test rows that could not fail

BUILD_RULES §2: *"A row that cannot fail under the defect it names is not a guard."* **Twelve of mine were not.**

| # | Row | Why it could not fail | Fix |
|---|---|---|---|
| 1 | `carries the line that says WHOSE words they are (D-80)` | Asserted `typeof footer === 'string' \|\| footer === null` — which `null` satisfies — and on its own fixture the footer **was** null. `data-bench-footer` was asserted by **no test in the repo**. D-80 authorship in Bench had zero coverage on either side. | Real rows both sides, on a downgraded check that produces a real footer |
| 2 | `the ROW's badge is untouched (ruling 7)` | Never looked at a badge. Making the badge and the burst read one source — the exact defect its comment describes — left the file green, because with no live price the two clocks cannot disagree. | The harness now drives a live price; the row exercises both clocks |
| 3 | `none of it renders while the pane is OFF` | The file mocks the pane **on** for every row; the body asserted the footer **was** present. Title and body were opposites. | Replaced by the row that was missing: the eyebrow is painted a token colour |
| 4 | `A RE-RENDER DOES NOT RE-FIRE` | Asserted only the footer — a pure function of the doc, identical whether or not a second announcement fired. | Bubble node identity across the extra renders |
| 5 | `is absent while the Game Tape is up` | `gameTapeOpen` is unreachable under the pane (no door renders), so the gate is never exercised. | Now a source row, which is what it always was |
| 6 | The `!paneOpen` bubble gate | No row at all — deleting it left 178 green. | Two rows in the new hook file |
| 7 | The `paneOpen` bubble *clear* | No row at all. | Row in the new hook file |
| 8 | `BAGGER_LINE` is the canonical constant | Compared **values**, so a local copy carrying the same literal passes — exactly the copying §4 forbids. | Moves the canonical constant and watches the module follow |
| 9 | `viewportInsetFrom` `setLayout(0)` | Proved by the negative clamp, not the guard. | `NaN` — the reading that reaches the style as `bottom: NaNpx` |
| 10 | The reduced-motion file | Guarded the burst, not the **bubble** — in the one file whose whole purpose is that contract. Also carried four pane helpers and two imports no row used. | Bubble row added; dead weight removed |
| 11 | `chatVisible` staying on `chatOpen` | Moving it to `rightColumnOpen` passed 168 rows while silently marking an agent's answer read because the player sat on Bench. | Two rows, mutation-confirmed |
| 12 | `says nothing for a piece no longer held` (mounted) | The screen defends this twice, so the map-walk is invisible in the DOM. The unit row is the real guard. | Retitled to what it actually guards |

`useBaggerMoment.js` had **no test file** while every other hook in its directory has one — and it is the half that carried both P1s. It now has eleven rows.

**Mutation totals:** lens 4 ran 52; every kill the build claimed was independently verified and every one holds. Sixteen mutations on the fixes themselves (9 + 7), all killed.

---

## 5. CONFIRMED — the process failure

**The branch had been CI-red since A3.2 (`5ee4f86b`) and the previous handover said it was green.**

`CharacterPane.jsx:54` imports `getArchetypeDisplayName` from `src/data/archetypeDisplay`, a legacy archetype table. BUILD_RULES §1's **separate** §2.3 gate requires a new direct importer to be recorded in `api/_utils/archetypeImportBoundaryBaseline.json` in the same commit. It was not, so `api/_utils/archetypeRegistry.test.js` failed.

It was invisible because **every verification run on this branch had been scoped to `src/`** — including the "4,196 pass" and "4,204 pass" figures the previous handover published as if they were the suite. The ratchet lives in `api/`. CI runs everything, so the founder's first sight of this would have been a red check on a branch reported as green.

Fixed in `0705c073` (one baseline line — 52 `src/` modules are already recorded there; the test's "import through archetypeRegistry" remedy is for `api/` consumers). The previous handover carries a correction of record. **Every test claim in this session is a full-suite claim.**

---

## 6. REFUTED and AMENDED

*(§7 below carries the refuter's verdicts in full.)*

Findings the lenses themselves refuted before reporting:

- **Lens 3** hypothesised that `AgentChat`'s new `reducedMotion` prop was left unwired, then disproved its own finding: it is wired from `Boolean(prefersReducedMotion)`.
- **Lens 1** suspected the `!gameTapeOpen` gate on the phone mark was a live gap; it proved instead that `gameTapeOpen` cannot become true under the pane (the header link is `controllerOn && !paneOn`, and the chat's trade cards take the `TradeCard` branch rather than the `TradeTickerCard` one carrying `onTradeClick`). The gate is deliberate belt-and-braces, and its row is now a source row that says so.
- **Lens 4** recorded `A6l` (the history-map walk) as surviving at the mounted level and correctly attributed the coverage to the unit seam rather than calling it a hole.

One finding was **investigated and deliberately not "fixed"**: `selectBench`'s `WHY_KIND.ABSENT` skip is redundant with the blank-rationale check beside it, because every `ABSENT` state spreads a base with `rationale: null` (`selectWhyState.js:239, :254, :279`). The docstring called it *"the whole correctness of this function"* — an overclaim, now corrected. The line stays as belt-and-braces (it is what would keep Bench honest if the cron's placeholder ever reached the display field) and **the invariant it rests on is now pinned where it can break**, rather than assumed.

---

## 7. The refutation pass

**STATUS: RUNNING at the time this file was committed.** BUILD_RULES §2 requires
every finding to be handed to a reviewer instructed to refute it with a concrete
repro; that agent is working now, and its verdicts land in the next commit to
this file. The record is committed at this point rather than held because the
session's container has already restarted once mid-run and taken background work
with it.

The claims put to it, each with an instruction to DISPROVE rather than confirm:

| # | Claim under attack |
|---|---|
| A1 | The seed fix is complete — no false announcement survives, and no real crossing is suppressed |
| A2 | `tierMultiplier` is genuinely present on the enriched asset, and the tournament route into this screen is live |
| A3 | The colourless eyebrow was genuinely *invisible*, not merely unstyled |
| A4 | The `offsetTop` reasoning matches how iOS reports the visual viewport, and returning 0 at any zoom is right |
| B1 | F2's narrow-desktop case is reachable in practice — with the pane's real width at 1024px computed, not asserted |
| B2 | The arrival fade is unseen in the common case, including on the desktop where the pane opens by default |
| B3 | A viewport-fixed mark genuinely costs brief §2.1's promise, rather than merely overlapping visually |

---

## 8. NOT DONE, and why — for the founder

Two items are recorded as incomplete rather than quietly shipped.

### 8.1 F2's ordering is not implemented
> *"on narrow widths the archetype line hides first, then the name wraps"*

The gate is `isDesktop && archetype`, **unchanged since `3543abc0`** — only the comment above it is new. That is a shell split, not a width query: on a genuinely narrow *desktop* pane the archetype line stays and the name wraps, which is the inverse of the ruling. The repo has no container-query idiom and jsdom does no layout, so implementing the real ordering means introducing one and testing it in a browser.

**This needs a line, not a comment.** §7 carries the refuter's arithmetic on how reachable the narrow-desktop case actually is.

### 8.2 The arrival fade is mostly not seen
All three pane sections are mounted whenever the pane is mounted, and on mobile the pane renders (hidden) even when closed. So a trade landing while the pane is shut mounts and fades both cards **invisibly**; opening the pane shows the same node with nothing to play.

"Once per mount" is what the ruling says and what was built. If the intent was "once per first sight", that is a different mechanism — and it collides with hazard 45, because making the card fade when its section is selected would remount it.

Also recorded, from the build's own note: a page **load** is a mount, so the cards already on the tape fade in together on arrival at the screen.

---

## 9. Debts, for separate tasking (BUILD_RULES §3)

1. **`AgentBattleScreen.jsx:289`** — the shipped A2 header mounts the presence face **unboxed**, the same defect F2 fixed in the two A3 headers. Flag-off and golden-frozen, so it belongs to a cleanup PR.
2. **`TacticalRow.jsx` is on neither guard list** and now paints `rgba(var(--ft-teal-rgb), …)`, `cssVar('teal')` and `motionToken('smooth')`. Compliant by rule (§10, §11) and verified by hand, but hazard 42's shape one file over: the next such addition has nothing mechanical to stop it.
3. **Pre-existing lint in `TacticalRow.jsx`** — two `react-hooks/rules-of-hooks` errors and an unused `allocationLabel`, all present at `3543abc0`. Not made live by this session's props.
4. **Repo-wide eslint false positive**: `'motion' is defined but never used` fires on every file using `motion.div`. It is a config problem, not a code one, and it buries real findings.
5. Phase 0 §8's four debts and the previous handover's five are unchanged.
6. **`useSessionCompositeTrail.test.jsx` fails standalone** — reproduces at `8e63ea65`, predates this branch. A task card is queued.
