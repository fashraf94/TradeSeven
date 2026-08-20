# Awaiting-the-Open Redesign — Build + BUILD_RULES §2 Review Record

**Arc:** `AWAITING_OPEN_REDESIGN_BUILD_SPEC_V1` (practice-pod awaiting-open surface)
**Branch:** `claude/awaiting-open-redesign-643mx9`, cut fresh from `origin/main` @ `7c70ae6b`
**Date:** 2026-08-19
**Flag:** `AWAITING_OPEN_REDESIGN_ENABLED`, default `false` (dark merge)
**Review trigger:** cumulative branch diff **12 files / 2,315 insertions** — over BOTH §2 thresholds (≥10 files OR ≥1500 lines)

---

## 1. Executive verdict

| Item | Verdict |
|---|---|
| Build complete (spec phases 1–4) | ✅ Yes, on one branch, four phase commits |
| Flag-off byte-identical | ✅ Yes — **after** a review fix; it was genuinely broken (F-D1) |
| Calibration fence (§1) | ✅ **Untouched** — no fenced file read, edited, or called |
| Claim function unchanged | ✅ `placeClaim({groupId, dropSymbol, addSymbol})` called verbatim; two production callers unaffected |
| Ranked `LiveDraftAwaiting` | ✅ Untouched — zero shared code |
| `vite build` | ✅ Green |
| Full suite | ✅ **8,108 passed** / 494 files, 0 failures (+12 new tests, 50 in the surface) |
| eslint | ✅ Clean |
| Review | ✅ 5 independent dimensions + `/code-review` high, every finding refuted-or-confirmed |
| Founder rulings R1–R3 | ✅ R2 + R3 executed here; R1 scoped as §7.0, **blocks the flag flip** |

**Headline:** the redesign is built and green, but the review was not a formality — it found a real dark-merge violation, a claim flow that gave no confirmation and invited a duplicate claim, a lost claim-outcome surface, a symbol-normalisation drift, and a global CSS rule that silently killed the entire button type scale. All fixed. The two product questions it raised were ruled the same day (§6): the submit gate is softened and the sidebar overlap fixed here; the claimable-universe fix is scoped as §7.0 and blocks the flag flip.

---

## 2. What was built

| Phase | Commit | Content |
|---|---|---|
| 1 | `576500a3` | Flag + `?awaitingOpenRedesign=1`, token/copy layer, `WSurf`/`BandHead`/`WChip`, reduced-motion layer, page shell + atmosphere |
| 2 | `dace85bf` | `AwaitCountdownHero`, `AwaitDraftBoard` (seat lanes), `BookSpread`, `TickerPlate`/`TickRail`, `buildSeatLanes`/`sectorSpread` |
| 3 | `6f0298b0` | `AwaitWire` (rows two-up, locked state), `AwaitSwapSheet` (per-row claim), `ClaimsMeter`, `wireWindowLine` |
| 4 | `0f7b0ee4` | Feed placement, research wiring, desktop-gate decoupling, no-picks state |
| Review | `d5014014` | 16 findings fixed (§4) |

**Theming (founder ruling — Option A):** the surface keeps `useTheme()`. The app mounts a single dark-default `ThemeProvider` (`ThemeContext.jsx:7`, never toggled anywhere), and `DARK_TOKENS` already carries the reference palette byte-for-byte — `bgApp #0D0E12`, `bgCard #15171E`, `bgAgent #1C1A27`, `teal #5eead4`, `medalGold #F0C75E`, `warmCopper #E8927C`. The design's names are a rename of live tokens, not a second palette. The one missing value, the ownership blue, comes from `LX.human` (`#5B8DEF`) per ruling 2. **No raw core-palette hex is introduced** — every colour is a token identifier composed through `alpha()`/`readableOn()`, which both fail silently on `var()` strings (BUILD_RULES §10).

---

## 3. Review method

Six independent passes, none sharing context:

| Lane | Focus |
|---|---|
| D1 | Domain correctness — claim path, window logic, countdown/DST, board derivation, cap logic |
| D2 | React wiring & lifecycle — hook rules, effect cleanup, dep arrays, keys, state races |
| D3 | Flag-off / dark-merge guarantee (instructed to *break* the claim) |
| D4 | Test integrity — **36 executed source mutations**, each reverted, tree verified byte-identical |
| D5 | Accessibility, responsive layout, spec compliance — **measured in headless Chromium** against the real compiled CSS |
| D6 | `/code-review` at high effort (founder's explicit instruction) |

Every finding was required to carry a concrete reproduction. Findings that could not be demonstrated were recorded as REFUTED.

---

## 4. Findings — CONFIRMED and fixed (16)

### Dark merge
**F-D1 · HIGH · CONFIRMED.** The 30s claim-window timer sat above the flag branch, so with the flag OFF it re-rendered the classic tree every 30s. `ClaimFlipWindow.jsx:81` recomputes `getClaimWindowDisplay()` during render with no memo, so its countdown line and colour began updating live where `main` leaves them frozen until the next snapshot. Repro executed at 30s steps across the 16:00 ET boundary: `"…opens in 2m"` → `"…opens in 1m"` → `"Open — claims lock in 17h 24m"`. **Fixed:** timer and both window memos gated on the flag.

### Correctness
**F-C1 · MEDIUM · CONFIRMED.** A successful claim produced no confirmation — the sheet closed on the 200 and the action machine's `CONFIRMED` terminal was unreachable. Until the claims snapshot landed (~100–600ms) the meter read the old count and the row still offered a live Claim, so a re-tap placed a second claim on the same name against a different drop (the server's duplicate guard keys the exact pair, `tournamentClaimPlacement.js:117-121`) and burned a second cap slot. **Fixed:** the sheet holds on success with the classic copy ("Claim placed — it resolves at the 9:24 AM ET processing pass.") and a DONE button; `canSubmit` excludes the placed state.

**F-C2 · MEDIUM · CONFIRMED.** Approved/denied claims were surfaced nowhere. The redesign drops `ClaimFlipWindow`, and QUEUED derives from `status === 'pending'` only, so after the processing pass a denied claim (and its `denialReason`) simply vanished and the row reverted to a live Claim. The DROP side of a pending claim was also invisible, so two claims could silently stake the same pick. **Fixed:** a self-scoped `ClaimsLedger` in the wire panel carrying `drop → add`, status and `denialReason` — the same semantics as `ClaimFlipWindow.jsx:200-211`.

**F-C3 · MEDIUM · CONFIRMED (§9 drift).** `myPicks` normalised with `String(x).toUpperCase()` while every board derivation uses `norm()` (**trim** + uppercase). A symbol carrying stray whitespace would key `sectorMap` differently in the sheet than on the board — a display disagreement in the same PR whose headline test asserts the two boards cannot drift. **Fixed:** extracted to a shared, tested `buildMyPicks` in `podBoard.js`.

**F-C4 · MEDIUM · CONFIRMED.** The run strip rendered a fixed `MON TUE WED THU FRI` row with the start day lit. Training anchors are the next market open on **any** weekday (`trainingLifecycle nextMarketOpenAnchor`), so a pod drafted Tuesday evening runs Wed–Thu–Fri–Mon–Tue; the strip stated the wrong five days and implied the chips before the lit one were run days already past. **Fixed:** `runDays()` wraps the weekday cycle from the real start day.

**F-C5 · LOW · CONFIRMED.** A malformed `anchorIso` rendered `NaN : NaN` over a dead rail (`isExpired` is `NaN <= 0` = false, so the opening guard never caught it). Inherited from the classic hero. **Fixed:** a malformed anchor is treated as no target and shows the honest no-target line.

**F-C6 · LOW · CONFIRMED.** `useCountdown` seeds `timeRemaining` at 0 and corrects it only in a post-paint effect, so `opening` was true on the first render and the hero painted the full "Opening…" takeover for one frame on every mount, with a bell 20 hours away. Inherited bug class, amplified from a 26px line to a whole-hero swap. **Fixed:** first render uses a synchronous seed of the same `target − now` the hook computes; one displayed value, not two sources.

**F-C7 · LOW · CONFIRMED.** At the pending cap the Claim button greyed out but still read "Claim", and with no picks the head read "Open" while every row read LOCKED. **Fixed:** the label names the actual reason — QUEUED / LOCKED / CAP FULL / NO PICKS.

**F-C8 · LOW · CONFIRMED.** An empty `userPool` returned `null` for the entire wire panel, removing the window line, reopen time, claims meter and every claim affordance with no explanation. **Fixed:** an explicit empty state; the panel chrome stays.

### Accessibility
**F-A1 · HIGH · CONFIRMED.** `role="dialog" aria-modal="true"` with **no focus trap** — Tab from the confirm button walked into the wire's Claim buttons behind the scrim and then the fixed bottom nav. **Fixed:** Tab cycles within the panel.

**F-A2 · HIGH · CONFIRMED.** Focus was never restored on close; all four close paths dropped it to `<body>`. Worst on the success path, where the triggering Claim button becomes disabled and unreachable. **Fixed:** the opener is remembered and refocused.

**F-A3 · HIGH · CONFIRMED.** The focus effect keyed on the parent's inline `onClose`, which is recreated every render, so the 30s timer yanked focus back to the dialog container every 30 seconds indefinitely. Repro executed in jsdom + React. **Fixed:** re-keyed to the ticker; Escape/Tab read through a ref.

**F-A4 · MEDIUM · CONFIRMED.** Submit errors rendered in a plain `<div>` — a rejected claim (e.g. 403 `window_closed`) was never announced. **Fixed:** `role="alert"` on the error, `role="status"` on the success line.

**F-A5 · MEDIUM · CONFIRMED (WCAG 2.5.3).** The gated Claim button's visible text was `LOCKED`/`QUEUED` while its `aria-label` was a different sentence, so voice control could not match it. **Fixed:** the accessible name now contains the visible label.

**F-A6 · LOW · CONFIRMED.** `aria-hidden` was passed to `Mono`, which forwards only `children` + `style` (`draftPrimitives.jsx:12-14`), so the countdown colons were read aloud. **Fixed:** wrapped in a real `aria-hidden` span. Also added a body-scroll lock, a scrim press-origin check, and the `WebkitBackdropFilter` twin.

### Layout
**F-L1 · HIGH · CONFIRMED.** `src/index.css:6-11` ships an **unlayered** `input, select, textarea, button { font-size: 16px !important; }` (the iOS auto-zoom guard). It beats inline styles, so **every button in the surface rendered at 16px**. Measured at 360px: the Claim button took 111px (37% of the row), the content column collapsed to 93px, the reason wrapped to 3 lines and the row grew to 201px; the sheet's confirm label wrapped to two lines. **Fixed** scoped to `.aw-btn` via a custom property so each call site keeps its own size — no global CSS touched.

**F-L2 · LOW · CONFIRMED.** `NAV_CLEARANCE` was 1px short (the nav has a 1px `borderTop` and the app ships no `box-sizing` reset). **Fixed:** 65px. Also `useAwaitCSS` now removes its injected `<style>` on unmount.

### Honesty
**F-H1 · MEDIUM · CONFIRMED.** The glow-discipline comments claimed a reserve the code does not keep — `TickerPlate` carries spine/text/plate glow on every ticker, CPU lanes included, by design. A false comment is worse than the design choice. **Fixed:** the comments now state what is actually reserved (the ownership wash and the panel bloom).

### Test integrity (mutation-checked — §2 "a row that cannot fail under the defect it names is not a guard")
**F-T1 · CONFIRMED VACUOUS.** `runStartDay` › "honours the DST offset rather than a hand-rolled one" could not fail under the defect it names: `2026-01-05T14:30:00Z` is Monday in every plausible zone, and **both** hand-rolled offsets (fixed −5 and fixed −4) return `MON`. **Fixed:** replaced with an ET-midnight-boundary pair — `2026-08-24T04:30:00Z` → `MON` (fixed −5 says SUN) and `2026-01-05T04:30:00Z` → `SUN` (fixed −4 and UTC both say MON).

**F-T2 · CONFIRMED WEAK.** The OPEN-window row used `/^Open — claims lock in .* \(9:24 AM ET\)\.$/`; a transposed duration (`54h 16m` for `16h 54m`) passed. **Fixed:** exact-text assertion.

**F-T3 · CONFIRMED ENVIRONMENT-VACUOUS.** `etWeekday`'s ET-ness was untested: the runner resolves to UTC and ET Friday daytime never crosses the UTC date line, so deleting `timeZone: 'America/New_York'` passed all 28 tests (and fails 2 under `TZ=Asia/Tokyo`). **Fixed:** a direct row at `2026-08-22T02:00:00Z`, which is Saturday in UTC and Friday in ET.

Also added: `runDays` (5 rows) and `buildMyPicks` (5 rows, including the F-C3 trim drift).

**Mutation results after fixes:** 36 mutations executed; the surviving unguarded cases are recorded in §7.

---

## 5. REFUTED / probed-and-clean

A review that never refutes itself has not been run adversarially. These were attacked and held:

- **`researchSym && (…)` extraction is byte-identical.** The same expression value lands in the same child slot; `''`, `0`, `false`, `null` all render exactly as before.
- **Classic return tree.** Diffed element-by-element against `origin/main`: same types, positional children, props, `desktop` ternary, `claimsRef` placement, `FONT_VARS` spread.
- **No extra Firestore reads.** Both subscriptions are keyed `[podId]`; the universe `getDoc` is keyed `[]`. A re-render cannot re-fire them.
- **No child state reset from the tick.** `AssetResearchModal` keys every effect on `asset?.symbol` primitives, so the new object literal per render causes no refetch.
- **Host `desktopPod` change** is exactly equivalent with the flag off (and `isTrainingPodDesktopOn()` short-circuits before the new call today).
- **Hook rules: CLEAN.** Every hook in all 14 new components is unconditional and precedes every early return; `rules-of-hooks` reports zero.
- **Dep arrays: CLEAN.** `exhaustive-deps` reports zero across the new files, and the rule was proven active.
- **`sectorMap` is stable** — memoised over a state value that settles after the one-shot `getDoc`.
- **Keys: CLEAN.** No duplicate or index-unstable keys; undrafted-slot keys are disambiguated per lane and round.
- **Effect cleanup: CLEAN** on the universe read, both subscriptions, the interval, the keydown listener and both matchMedia branches.
- **`placeClaim` call shape.** Matches both shipped callers exactly; `groupId` is genuinely `pod.id`; the synchronous `inFlight` ref does block a same-tick double POST; success is never claimed before the 200.
- **`wireWindowLine` branch matrix.** Every branch walked against the real `getClaimWindowDisplay`, including the boundaries: 16:00 exactly → open; 9:24 exactly → open, `0m`; 9:25 → closed, `6h 35m`. `isOpen` is always taken from the mirror, never invented.
- **`buildSeatLanes` agreement.** No data could be constructed where the classic and redesigned boards show different picks. Mutation M30 (seat 1 reads seat 0's column) is caught by the agreement row and nothing else — it is load-bearing.
- **Cap sourcing.** One value (`TOURNAMENT_TUNING.CLAIM_PENDING_CAP_PER_CYCLE`) threaded to the wire, the meter and the sheet; no divergence.
- **No fixed-overlay escape hazard.** Nothing in the diff sets transform/filter/contain/will-change/perspective on a non-leaf; the hero's glow is a `background-image`, not a `filter`. `AssetResearchModal` is a portal.
- **Bottom-nav clearance works** — measured at 360×780: the dialog's border box ends exactly 64px above the viewport bottom (now 65px after F-L2).
- **No horizontal overflow** at 320 / 360 / 1024 / 1180; no ticker clipping down to 320px.
- **Module-level side effects: none.** Style injection is inside an effect; the redesign modules evaluate only literals.

---

## 6. Founder rulings on the review (2026-08-19, post-review)

Both questions raised in review were ruled the same day; both are executed in this branch.

**R1 — Claimable universe: accepted as a real regression, fix deferred to its own task.**
Founder: *"it's my spec's fault, not your build's… going from ~100 names to 12 removes a capability. That's a narrowing of the game, not a UI simplification."*

- **Do NOT raise `topN`.** The wire's value is that twelve names are the twelve best fits; inflating it "stops being a recommendation and becomes a list."
- **Direction:** a search affordance *inside the claim sheet* — the wire stays at twelve, and a "Claim a different name" control opens a ticker search over the full `userPool`. Preserves the recommendation surface and the capability.
- **Scope:** its own task. **Merge dark now; ship search before the flag flips.** Recorded as §7.0 below.

**R2 — Submit gating: softened. EXECUTED in this branch.**
Founder: *"Treat the ClaimFlipWindow header as authoritative… the arena prior art matching your implementation doesn't override it — it may simply mean the arena carries the same defect."*

The window mirror reads a **device clock**, so a slow client silently blocked a claim the server would accept — a user losing a move they were entitled to. Now:

- The **locked visual stays** (§6.1 is correct — no live button on a wire that looks shut): dimmed treatment, lock glyph, `LOCKED` label, reopen time legible in the head and repeated in the sheet.
- The button still **opens** and the sheet still **submits**. `canSubmit` no longer includes the window; the sheet's closed banner now reads "You can still place it — the server has the final say."
- A rejection surfaces as mapped copy (`window_closed` / `claims_closed_during_market_hours`, `tournamentActions.js:106-109`) in the `role="alert"` line.
- The genuine client-side blocks **stay** — duplicate pending claim, the 3-pending cap, no picks to drop. Those derive from the authoritative claims subscription and the roster, not from a clock, and `ClaimFlipWindow` gates on the cap too.

**R3 — `App.jsx:9231` sidebar offset: fixed in this branch.**
Founder: *"shipping a redesign whose headline element sits under the sidebar isn't defensible on a technicality."* One-line wrapper matching its siblings (`:9394`, `:9643`), committed separately from the feature and labelled pre-existing. Verified: `getScreenContent` spans `8550–9922`, so the `trainingBattle` early return feeds `screenContent` (`:9949`, rendered `:9989`) and `DesktopSidebar` (`:9993`) **does** render alongside it — `trainingBattle` is absent from `GAMEPLAY_SCREENS` (`:1082-1089`). eslint on `App.jsx` reports 147 problems before and after the change, none in the edited range.

---

## 7. Separate-tasking register

**7.0 — NAMED FOLLOW-UP, BLOCKS THE FLAG FLIP (founder ruling R1).**
Add a ticker-search affordance inside the claim sheet, over the full `userPool`
(`pod.userPool` minus held symbols — the same list `ClaimFlipWindow.jsx:75-78`
builds). The wire stays at `topN: 12`. Until this ships, the redesign can only
claim the twelve ranked names, where today's dropdown reaches ~100+. Merge dark
is fine; **do not flip the flag before this lands.**

---

Pre-existing, NOT fixed here (BUILD_RULES §3):

1. ~~**Desktop sidebar overlaps the training-battle column.**~~ **FIXED in this branch per ruling R3** — retained here for the record. `App.jsx:9231-9241` returns `LeagueTrainingBattleView` with **no** `marginLeft: sidebarCollapsed ? '64px' : '220px'` wrapper, unlike sibling screens (`:9394`, `:9643`), and `trainingBattle` is absent from `GAMEPLAY_SCREENS` (`:1082-1089`) so the sidebar renders. Measured at 1024px: the board's round-spine labels and the top wire row's FIT number sit under the collapsed sidebar. **Affects today's classic screen too**, but the redesign's full-width board is the first layout to put load-bearing content there. **This will be visible in the preview smoke.**
2. **`src/index.css:6-11` global `!important` button font-size** defeats every inline button size app-wide, not just here. Worked around scoped to `.aw-btn`; the global rule deserves a proper layered fix.
3. **"the wire opens Monday at 4:00 PM ET" understates the reopen by ~16h** — the window is also open Mon 00:00–09:24 ET. Copy is verbatim from the shipped `ClaimFlipWindow.jsx:44-45`; kept consistent rather than diverging the two surfaces.
4. **No cancel path for a tournament claim.** `placeClaim` is the only claim mutation; the `cancelClaim` in `claimFreeAgencyService.js:319` belongs to the separate BaggerBomb subsystem. This is why spec §5's "undo" is not built.
5. **Eager bundle cost.** The redesign adds ~+35.8kB raw / +9kB gzip to the eagerly-loaded main chunk while dark. Acceptable given the flag flips within days; a lazy boundary would remove it.
6. **`AWAITING_OPEN_REDESIGN_ENABLED` has no tripwire pin** — per founder ruling 4 (unpinned, no `DARK_BY_DESIGN`, since it flips within days). `flagPinGuard` stays green; an accidental `= true` reds nothing.
7. **`GroupFeed` is visually foreign** inside the redesigned shell (flat `bgCard`, radius 10, among radius-18 `WSurf` panels). Preserved deliberately — it has five importers and §6.4 says keep it.

---

## 8. Fence statement (BUILD_RULES §1)

**No fenced file was edited, and none was read or called.** The diff is client UI plus one pure derivation module (`podBoard.js`, already non-fenced and unit-tested). No scoring math was copied (§4): fit ranking runs through the existing `buildFitBoard`, and the displayed layer weighting reads `TOURNAMENT_TUNING.USER_LAYER_K` rather than restating 1.5. No new writes: claims go through the unchanged `place-claim` endpoint. No cron entries added (§6). No catalog events (§5).

---

## 9. Preview smoke checklist (spec §11)

- [ ] Flag off: screen identical to main (incl. the claims countdown staying frozen, per F-D1)
- [ ] Flag on, desktop: board full width, wire rows two-up, claims inline, no dead space, and **nothing under the sidebar at 1024** (ruling R3)
- [ ] Flag on, mobile: everything reachable; nothing under the bottom nav; the swap sheet clears it
- [ ] Claim flow: tap Claim → sheet opens pre-filled → pick a drop → confirm → confirmation shown → row shows QUEUED, meter increments, ledger lists `drop → add`
- [ ] Wire closed: Claim buttons show the LOCKED treatment but still OPEN the sheet; the sheet says "you can still place it"; reopen time shown; research still works
- [ ] Wire closed + submit anyway: the server's rejection appears as mapped copy in the sheet (not a silent failure)
- [ ] **Friday afternoon: the wire shows the Monday reopen, never a countdown**
- [ ] Ticker tap opens `AssetResearchModal` from both board and wire
- [ ] Countdown ticks, legible at both breakpoints, no "Opening…" flash on load
- [ ] Reduced motion: no animation, layout intact
- [ ] Keyboard: Tab stays inside the swap sheet; Escape closes; focus returns to the row
- [ ] Ranked awaiting-open (`LiveDraftAwaiting`) untouched

Delivery ends at *pushed* (BUILD_RULES §2). CI, merge and deploy are the founder's.
