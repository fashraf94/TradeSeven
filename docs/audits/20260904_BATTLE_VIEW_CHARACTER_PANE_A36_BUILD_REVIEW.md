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

BUILD_RULES §2: *"Every finding is handed to a reviewer instructed to refute it with a concrete repro. Findings that survive are CONFIRMED; the rest are recorded as REFUTED, with the reasoning — a review that never refutes itself has not been run adversarially."*

Seven claims went to a sixth agent whose only instruction was to **disprove** them. Where a claim concerned a real browser rather than jsdom it worked from the **production bundle** (`vite build` → `dist/assets/index-*.css`) driven in **Chromium 1194** via `playwright-core`, not from jsdom.

**Score: 3 CONFIRMED · 4 AMENDED · 0 fully refuted.** The two it attacked hardest and could not break are A3 and B1 — and **B1 is the one whose severity this review had *understated*.**

**A ceiling on every severity below, recorded once:** the flag ships false (`featureFlags.js:2061`), and every surface here is gated on `isCharacterPaneOn()`. Nothing in this section describes something a player sees today; "on every load" and its cousins are true of the flag-on build.

| # | Claim | Verdict |
|---|---|---|
| A1 | The seed fix is complete | **AMENDED** |
| A2 | The `tierMultiplier` route is live | **AMENDED** |
| A3 | The eyebrow was invisible | **CONFIRMED** |
| A4 | `viewportInsetFrom` was wrong twice | **AMENDED** |
| B1 | F2's ordering is not implemented | **CONFIRMED, and understated** |
| B2 | The arrival fade is nearly never seen | **AMENDED** |
| B3 | The clearance no longer delivers §2.1 | **CONFIRMED** |

### A1 — the bagger seed · AMENDED
The named defect is real and the fix kills it: the pre-fix hook against the screen's true ordering gives `{"burst":["AAPL","NVDA"],"bubble":"AAPL"}`; post-fix, `{"burst":[],"bubble":null}`.

**But the guard is narrower than its comment claims.** Three latent re-announce doors survive — a book that *grows* after the seed, a book that empties and refills (`seenRef` is overwritten with `{}` on the empty pass), and a *different battle* swapped onto the same fiber through the `battle: null` gap, where `if (!battle) return;` preserves battle A's map. None is reachable through the shipped screen (`livePlayerPortfolio` is complete on the seed pass, and every `setCurrentBattle` in `App.jsx` is paired with a `setScreen` that unmounts the view), so they are latent, not live — but the comment presents the condition as complete and it is not: it is *the first non-empty book wins, forever*.

**And the fix suppresses one real crossing**: doc present, book empty, then the book fills on the same tick a piece crosses → nothing announced. `deriveBaggerMoment.js:89-91` states the opposite doctrine in as many words. Narrow (a real swap-in writes a zero-reset entry) but it is two files of one feature disagreeing.

### A2 — the dropped `tierMultiplier` · AMENDED — the defect is real, the route is dead
`tierMultiplier` **is** on the enriched asset (`enrichAsset` returns `{ ...asset }`), and mounted with a stamped star piece the footer renders `1× banked` where the pre-fix expression gave `2` — so the §9 disagreement was genuine and is genuinely closed.

**But a flat6 star piece cannot reach this footer.** The stamp exists only where `flatMultiplier != null`, i.e. `gameMode: 'baggerbomb_tournament'`, and `BattleViewScreen.jsx:30-40` routes exactly those to `LeagueBattleViewConnected` *before* the `agentDeployed` branch, with `LEAGUE_BATTLEVIEW_ROUTING_ENABLED` true. **The headline scenario cannot occur through this screen.** The fix is a correct §9 alignment on an unreachable path.

Two things the refuter surfaced in passing, both recorded as debts (§9):
- `featureFlags.js:257-259` — the routing flag's flip was written `= true;` instead of the `true || (…)` its docstring prescribes, leaving an orphaned expression statement. The value is right; the code no longer says what it means.
- `baggerBombUtils.js:596` — the bagger bonus is **+15 flat, not scaled by conviction**. `tierMultiplier` scales only `basePoints`. So `Bagger hit · 2× banked` names a multiplier that was not applied to the thing the line is about. Ruling 8 rules exactly this wording ("the number the player is playing for"), so it stands as ruled — but it is the same one-row-two-sources family, still open beside the fix.

### A3 — the colourless eyebrow · CONFIRMED, measured
The refutation it went looking for was Tailwind Preflight's `button { color: inherit }`, which would have made the eyebrow inherit a legible colour and the finding a non-event. **It is not in the shipped bundle** — Tailwind 4.1.16 with `@tailwind base;` emits no preflight (`grep -c "color:inherit" dist/assets/index-*.css` → `0`). The only button rule repo-wide is the 16px font-size guard, so the UA `button { color: ButtonText }` stands and resolves light.

Real Chromium, production CSS, the actual SSR output:

| | contrast on the bubble |
|---|---|
| pre-fix eyebrow (black on `rgb(2,3,3)`) | **1.02 : 1** |
| post-fix (`#f59e0b`) | 9.62 : 1 |
| the line beside it | 14.01 : 1 |

Invisible is the correct word; the line 20px below it proves the omission was specific to the eyebrow.

### A4 — `viewportInsetFrom` · AMENDED — right in direction, half of it inert
The pinch-zoom half survives and is a large improvement (at `innerHeight 800 / visual 378 / scale 2` the old expression returns **422**, the new one **0**).

**The `offsetTop` half almost never fires, and the docstring is wrong about why.** Per CSSOM-View, `offsetTop` changes fire **`scroll`**, not `resize`, and `useViewportHeight` registers `resize` only — and even adding a scroll listener would not help, because the state is the *height*, so an unchanged height is a React bail-out. The row that pins this tests the **function** at a reading the app can never re-render with.

**And returning 0 at any zoom breaks the chrome case**: at 2× with a 44px toolbar up the mark goes back under the toolbar. Bounded (0 is far better than 422), but the comment's *"a zoomed page has no chrome offset worth correcting for"* is an assertion, not a result. `scale < 1` is reachable (`maximum-scale=5.0, user-scalable=yes`) and disables the helper entirely.

### B1 — F2's ordering · CONFIRMED, and this review understated it
The gate is byte-identical to `3543abc0`; only the comment and the `data-pane-*` attributes changed around it.

**The reachability attack failed decisively.** The breakpoint is **`min-width: 768px`**, not 1024 — so an iPad in portrait is a "desktop" and `openByDefault: isDesktop` opens the pane there. Measured in Chromium with the production CSS: the row has no gap and no horizontal padding, so the pane is exactly **2/5 of the viewport**, and the header's fixed cost is **326.7px** (28 padding + 36 face + 20 gaps + 242.7 controls).

| viewport | pane | identity column | the name | the archetype |
|---|---|---|---|---|
| **768** | 307.2 | **0 px** | **14 lines**, one letter each | paints over the controls; **controls overflow the header by 7.7px** |
| 1022 | 409 | 81.3 px | 2 lines | still overflows onto the controls |
| 1150 | 460 | 132.3 px | 1 line | fits |

So at the width the task named the name wraps while the archetype stays — the inverse of the ruling, as claimed. **At the real breakpoint the failure is worse than "the wrong thing hid":** the identity column is annihilated. `flexShrink: 0` on the controls is what guarantees it — with negative free space the name is the only thing that can give, and it gives everything.

### B2 — the arrival fade · AMENDED — the mechanism is exact, "nearly never" is not
Every structural claim holds, measured on the real screen: all three sections mount whenever the pane does; on mobile the pane renders hidden while closed; a trade landing then fades both copies out of sight; opening the pane re-uses the **same node**.

**But the headline is wrong.** `openByDefault: isDesktop` plus a default section of Chat means the desktop's resting state — the brief's own §5 deliverable 1 — has the Chat section **visible**, and a trade arriving there mounts a fresh card in view and the fade plays. That is the common desktop case, not an edge.

**The claim that survives:** the fade is unseen on mobile whenever the pane is shut, on either shell whenever the reader is on Bench or Tape, and *always* for Tape's duplicate card, which mounts behind Chat and can never be watched arriving.

### B3 — `AVATAR_CLEARANCE_PX` · CONFIRMED, hit-tested
The proposed refutation — `pointerEvents: 'none'` on the container — is true and does not save it: the mark's **button** is `pointerEvents: 'auto'` with a 48×48 minimum, fixed to the viewport.

The refuter dumped the real mobile DOM, loaded it into Chromium at 390×844 with the production CSS, and sampled a 7×7 grid over the mark at nine scroll positions, asking `elementsFromPoint` what sits beneath:

```
scrollY=  0  blocked=['chip:"ORCL"']      scrollY=295  blocked=['chip:"CRM"']
scrollY=118  blocked=['chip:"IBM"']       scrollY=354  blocked=['BUTTON[role=button]']
scrollY=413  blocked=['BUTTON[role=button]']   scrollY=472  blocked=[]   ← the scroll END
```

At **five of nine positions** a real tap target is under the mark and the mark is on top: opponent symbol chips (`onSymbolClick` → the research modal) and a `<button>`. Those taps are **captured, not merely overlapped**. Only at the scroll end is the box clear — which is exactly, and only, what the reservation still buys, and what the amended comment now says it buys.

## 8. NOT DONE, and why — for the founder

Two items are recorded as incomplete rather than quietly shipped.

### 8.1 F2's ordering is not implemented

> **DISPOSITION (founder, after this record): RULED AND BUILT.** The archetype line now hides first, on a second `min-width` query derived from the header's own arithmetic. See the handover, and commit `20524c7c`. The analysis below is left as it stood when the review closed.
> *"on narrow widths the archetype line hides first, then the name wraps"*

The gate is `isDesktop && archetype`, **unchanged since `3543abc0`** — only the comment above it is new. That is a shell split, not a width query: on a genuinely narrow *desktop* pane the archetype line stays and the name wraps, which is the inverse of the ruling. The repo has no container-query idiom and jsdom does no layout, so implementing the real ordering means introducing one and testing it in a browser.

**This needs a line, not a comment.** §7 carries the refuter's arithmetic on how reachable the narrow-desktop case actually is.

### 8.2 The arrival fade is mostly not seen

> **DISPOSITION (founder, after this record): "once per mount" STANDS AS BUILT.** No code change; both consequences are now recorded at the mechanism itself (`TapeCards.jsx`), and §7's B2 amends "nearly never" to the accurate claim. Commit `2d6ee6e3`.
All three pane sections are mounted whenever the pane is mounted, and on mobile the pane renders (hidden) even when closed. So a trade landing while the pane is shut mounts and fades both cards **invisibly**; opening the pane shows the same node with nothing to play.

"Once per mount" is what the ruling says and what was built. If the intent was "once per first sight", that is a different mechanism — and it collides with hazard 45, because making the card fade when its section is selected would remount it.

Also recorded, from the build's own note: a page **load** is a mount, so the cards already on the tape fade in together on arrival at the screen.

---

## 9. Debts, for separate tasking (BUILD_RULES §3)

1. **`AgentBattleScreen.jsx:289`** — the shipped A2 header mounts the presence face **unboxed**, the same defect F2 fixed in the two A3 headers. Flag-off and golden-frozen, so it belongs to a cleanup PR.
2. **`TacticalRow.jsx` is on neither guard list** and now paints `rgba(var(--ft-teal-rgb), …)`, `cssVar('teal')` and `motionToken('smooth')`. Compliant by rule (§10, §11) and verified by hand, but hazard 42's shape one file over: the next such addition has nothing mechanical to stop it.
3. **Pre-existing lint in `TacticalRow.jsx`** — two `react-hooks/rules-of-hooks` errors and an unused `allocationLabel`, all present at `3543abc0`. Not made live by this session's props.
4. **Repo-wide eslint false positive**: `'motion' is defined but never used` fires on every file using `motion.div`. It is a config problem, not a code one, and it buries real findings.
5. **`featureFlags.js:257-259`** — `LEAGUE_BATTLEVIEW_ROUTING_ENABLED`'s flip was written `= true;` where its own docstring prescribes `true || (…)`, leaving an orphaned expression statement below it. The value is correct; the code no longer says what it means. Found by the refuter while proving A2's route dead.
6. **The bagger bonus is flat (+15), not scaled by conviction** (`baggerBombUtils.js:596`) — `tierMultiplier` scales `basePoints` only. `Bagger hit · {mult}× banked` therefore names a multiplier that was not applied to the bonus the line is about. Ruling 8 rules this wording deliberately ("the number the player is playing for"), so it stands — recorded because it is the same one-row-two-sources family as the fix beside it.
7. Phase 0 §8's four debts and the previous handover's five are unchanged.
8. **`useSessionCompositeTrail.test.jsx` fails standalone** — reproduces at `8e63ea65`, predates this branch. A task card is queued.
