# Phase A3 build review — the Battle View character pane (V1)

**Date:** September 4, 2026
**Branch:** `claude/character-pane-phase-a3-rulings-rq17ta`, reviewed at `4b9a72fb` (A3.0 → A3.5 plus the survivor-probe guard); fixes landed at `2ec25844`.
**Base:** `8e63ea65` = `origin/main`, the merge of PR #815 (`flip/battle-view-controller`).
**Why it exists:** BUILD_RULES §2 — the cumulative branch diff is 44 files / ~5,550 lines, past both thresholds. The rulings §7 asked for it "at handoff", five lenses, one worktree each.
**Precedent for the form:** `docs/audits/20260730_DELIGHT_STARFIELD_CUMULATIVE_CODE_REVIEW.md`.

---

## 1. Executive verdict

The build was **not** clean. Five independent lenses found **eleven confirmed defects**, one of which crashed the Battle View on every mount — including on the pane-OFF path, which is the shipped configuration. All eleven are fixed and each fix is mutation-checked. Twenty-two further candidates were refuted, with reasoning, and are recorded here so the next reader does not re-raise them.

| Lens | Dimension | Confirmed | Refuted | Worst finding |
|---|---|---|---|---|
| 1 | Domain correctness, display agreement (§9/§10) | 9 | 5 | The bubble read a field the builder never emits — masked by the build's own test fixture |
| 2 | Wiring, lifecycle, focus, events | 4 | 5 | **P0:** a conditional hook crashed the screen on every mount |
| 3 | The flag-off / pane-off guarantee | 2 | 7 | Pane-off was not byte-identical once a scope was active |
| 4 | Test integrity and mutation | 13 + 3 | 4 | **27 of its mutations survived** — rows of the build's own that could not fail |
| 5 | Rulings conformance, cross-phase | 10 | 10 | Three ledger rows described code that did not exist |

**The single most important result** is not any one defect. It is that **two of the build's own test rows could not fail under the defects they named** — a trade fixture that hand-built a non-existent field, and an outage fixture that modelled a state the cron never writes. Both are now produced by the real builder. BUILD_RULES §2's "a row that cannot fail is not a guard" was the rule the build broke twice while believing itself guarded.

---

## 2. The survivor probe (run before any kills were trusted)

The rulings asked that the mutation harness be shown able to report a SURVIVOR before a run of kills is believed. `AVATAR_CLEARANCE_PX` 96 → 500 left all 4,156 rows green.

That established two things: the suite is not vacuously red, so the per-phase kills recorded in the build's commit messages mean what they say; **and** the board's bottom reservation — the brief §2.1 promise that the mark never rests over a row's tap targets — was guarded by nothing. Commit `4b9a72fb` adds the row, stated as the promise rather than the literal. Re-probing at 10 now fails.

---

## 3. Confirmed findings and their dispositions

| # | Lens | Finding | Severity | Fix |
|---|---|---|---|---|
| 1 | 2 | `benchState`'s `useMemo` sat below the `loading` early return — a conditional hook. Every real mount renders loading then loaded on one fiber, so React threw "Rendered more hooks than during the previous render" (prod 310) and the ErrorBoundary replaced the screen. **Flag-independent: it crashed pane-off too.** | **P0** | Hoisted above the return. `eslint --rule react-hooks/rules-of-hooks` is clean on every file A3 touches. |
| 2 | 2, 5 | The pane — and the `AgentChat` inside it — was UNMOUNTED on desktop collapse and mobile close. Hazard 45 names "collapse / expand" first; the build honoured only the section half. A half-typed message, an in-flight send and the scroll went on every fold, on a path where the A2 column kept them. | High | Hidden, never unmounted, on both shells, by the same `display: none` idiom the sections use. |
| 3 | 2, 5 | Focus stranded on three of four transitions. The return target was the mark the player pressed — which unmounts while the pane is open (ruling 4) — so focusing it was a no-op on a detached node; the desktop handlers returned before A2.4's `pendingChatFocus` hand-off; and `wasOpenRef`'s CR6 guard was tautological. | Medium-High | Focus-in keys on the false → true EDGE of `open`; focus-out goes through `pendingChatFocus` to the mark that comes BACK. |
| 4 | 1 | `deriveBubble` read `item.firstSentence` on a TRADE entry. `buildTape` writes `motiveFirstSentence` for trades and `firstSentence` only for checks, so every executed swap fell through and printed the pair twice. **The shipped row could not fail under it** — the fixture invented the field. | High | The field corrected; both fixtures now produced by `buildTape` itself. |
| 5 | 1 | The Bench scan-back accepted an outage tick's words. The cron writes the PLACEHOLDER `Haiku call failed — defaulting to HOLD` with `haikuError` beside it, not `rationale: null`; the build's test modelled the state production never produces. Bench would have quoted the system's sentence as the agent's on the exact tick ruling 11 exists for. | High | Both go through `selectWhyState`, which already classifies an outage as ABSENT. |
| 6 | 1 | Bench split the RAW rationale. Every other surface renders `renderMotive` (D-80) and labels authorship; a guardrail-forced exit carries `guardrail_stopLoss`, and a forced-out symbol RETURNS TO THE BENCH. | Medium | Same fix as #5; Bench now carries the whose-words footer the cards carry. |
| 7 | 1 | The bubble read the UNFOLDED tape while the stream and the strip fold. On a quiet run the stream said `3 checks · no change` and the character named the newest check alone — A2.4 confirmed and fixed this class for the strip; the bubble regressed it. | Medium | Folds with the same call and the same pin. A growing run re-keys on its count, so a fourth quiet check fades once rather than changing the text silently. |
| 8 | 1 | Both new presence mounts read `scoreState.currentScore` while the arena renders the live pair — presenceBinding's Gate 1 forbids exactly that. Two marks on one page could read different numbers, in sign. | Medium | Both take the displayed pair. |
| 9 | 3, 5 | The hoisted scope chip carried `flex-shrink: 0` into the A2 position, so pane-off stopped being byte-identical the moment a scope was active — a state the first-paint golden cannot photograph. | Low | Applied only in the composer; the scoped state is now its own row. |
| 10 | 5 | Only the REMOVE half of the bookmark control moved. `onBookmark={undefined}` left the feed's `Add bookmark` button rendered and dead, so under the pane a player could not add a bookmark anywhere. | Medium | Both halves moved. |
| 11 | 1 | The pane's bookmark text rule was invented (`message ‖ text ‖ action`); the shipped one is `message ‖ rationale ‖ 'No details available'`, so a legal swap read as the bare machinery word `swap`. | Low | Aligned with the shipped rule, with the string in copy. |

**Also corrected, below the finding bar but worth the record:** the desktop board reserved no clearance for the mark (lens 5 F6); four suites mocked the controller but not `isCharacterPaneOn`, which calls the controller *inside* `featureFlags` so the mock never reaches it — on flip day they would have seen an impossible state (lens 3 F2); `characterPaneFlags.test.js` pinned the controller's live value from a second file, invisible to `flagPinGuard` (lens 3 F2); `TradeCard` now reads the `TRADE_EYEBROW_COLOR` it sits beside; the desktop pane opens WITH the pane showing, which is the brief's §5 deliverable 1 and the A2 column's own default; the bubble opens on Chat rather than the remembered section.

---

## 4. The ledger corrected

Three rows described code that did not exist. Lens 5 caught all three.

| Row | Over-claim | Now says |
|---|---|---|
| D-93 | "pane-off renders A2 byte for byte" and "one tree position across collapse / expand and sections" | That byte-identity was tested in states the golden cannot photograph and needed one correction; and that COLLAPSE, not only a section change, keeps the chat mounted. |
| D-94 | "the shipped add / remove bookmark control" | That both halves moved — the first build moved only `remove`. |
| D-98 | "a gated change in `AgentChat.jsx`" | That the agreement is STRUCTURAL: `TapeCards` exports its four eyebrow colours and `deriveBubble` imports them. The ruled gated change would have been a no-op, because the chat's kind eyebrow renders only on speech and is already `text-muted`. Lens 5 verified that premise independently before the substitution was accepted. |

---

## 5. Refuted candidates (recorded so they are not re-raised)

**Lens 1:** the directive branch is dead (no — directives ride the agent half); `AnimatedScore`'s `${c}99` shadow template is an H2 hazard (no — it runs only while `flash` is set, when the colour is a hex default); `LABEL_COLOR`'s fallbacks differ (unreachable — all six kinds are mapped); a stale bubble when the newest entry is silent (needs an exchange persisted with an empty response, which the chat never writes).

**Lens 2:** two overlapping body locks strand the document (no reachable path at HEAD — recorded as latent hygiene, since the Game Tape's overlay and its door are not gated on `!paneOn`); a breakpoint crossing remounts the chat (true, but INHERITED — pane-off crosses identically); a `paneOn` flip mid-session remounts it (test-only; the flag is a build-time constant); the widget's render-time ref write, listener leak and double-answer (all refuted; two mounted widgets do both answer, which is why the single App mount is load-bearing); incomplete `useCallback` deps (nothing found).

**Lens 3:** the explicit `reactivityLevel="reactive"` changes flag-off presence surfaces (no — that is the default); a new trailing `false` slot shifts `useId` under the scroller (no `useId` there; recorded as fragility); the global `clashbot:open` listener changes flag-off (DOM byte-identical); the pane-off golden photographs this tree (refuted by re-capture from a fresh `git archive 8e63ea65` — `cmp`-identical, sha256 matches); a mobile jsdom probe difference (a rAF wall-clock frame inside the presence SVG, same in both trees); `--ft-copper` widens `CORE_PALETTE` and could red an existing guarded file (no — and the widening CLOSES hazard 42: a raw `#e8927c` in a guarded file now reds the guard, which the Phase 0 report expected only review could catch).

**Lens 5:** the radius literal appears twice (ruling #5 scopes "once" to the bubble); opening onto a remembered section leaves the count uncleared (honest under brief §4.3, and the count is not visible while open — the bubble's door was changed anyway); the `ACTIVE` pill survives in the header (never asked to be removed); the `hidden` seam on a league battle (App mirrors the field `BattleViewScreen` routes on); the golden captured from this tree (refuted by re-capture); A3.6 strings missing (deferred by D-97).

---

## 6. Lens 4 — test integrity

This lens ran a mutation campaign rather than a read, and its result is the sharpest thing in the review.

**Every one of the build's sixteen claimed kills reproduces.** Nothing in the commit messages over-claimed a kill.

**But twenty-seven of its own adversarial mutations SURVIVED** — all twenty-seven through a 975-row broad set, and one (doors doing nothing at all under the pane) through 10,469 attributable rows of the whole repository. Each survivor is a row of mine that could not fail under the defect its title named. The worst:

| # | The row | What survived it |
|---|---|---|
| F1 | "a row door opens the pane on CHAT" | It clicked the **book toggle** — which opens the WhyPanel and is not a pane door — and asserted `[data-why-open-check] \|\| [data-why-book-toggle]`, the second being the control it had just clicked. All three doors' pane arms were guarded by nothing: doors opening the *remembered* section, and doors doing **nothing at all**, both passed. |
| F2 | "a TIMER alone creates no bubble" (the seed's own named row) | The SSR row runs no effects; the mounted row fakes only `Date`. A `useEffect` + `setTimeout` composing a `Thinking…` bubble — the exact thing brief §4.2 forbids — survived both. |
| F6 | "mounts the presence face static, with its events withheld" | It asserts on a **mock** of `AgentPresenceMount`, so it proves the caller passes the right props and nothing about the mount. `events={events}` for a static face — hazard 41 itself — survived, because that file had no test at all. |
| F7 | "has ONE seam" | It reads `data-seam-pct` and the wash; the bar's width is a framer `animate` value SSR does not paint, so a second derivation used **only for the bar** survived. Its sibling "player on teal, CPU on copper" only checked both tokens appear somewhere — swapping the sides survived. |
| F4/F5 | reduced motion; "nothing idle" | No row passed `reducedMotion` at all. "Nothing idle" matched CSS `animation` only, so a framer loop with the transition as an identifier was invisible to it, to the motion guard (its own documented blind spot) and to the broad set. |
| F8/F9/F10 | the substring row; "unsubscribes on unmount"; the clearance row | The substring fixture contained a genuine mention too, so `includes()` gave the same answer; `dispatchEvent` cannot throw whether or not a listener leaked; the clearance row's comment claimed more than its assertion. |
| F11 | hazard 43's chat half | The structural agreement bound TapeCards↔deriveBubble only — `AgentChat` kept its own literal, so a **gated** drift, the precise change the ruling's wording describes, survived every suite but the pane-off byte golden (the wrong instrument for a pane-on agreement). |
| F12 | the negative space | Ten ruled behaviours with no row: the mark in the pane header, the scope chip in the composer, the body lock's shell, the overflow's Escape, the disabled reset, Tape's card kind, bookmark order, the count's source, and more. |

**All of it is fixed.** Fifteen of the survivors are now killed by rows added in `76f6cd9a`, each re-mutated to confirm; `AgentPresenceMount` gained the test it never had; and the timer and idle-loop rules are now **source** rows, because the claim is a property of the file rather than of one render — the same instrument the flag suite already uses for its deleted query override.

Lens 4 also independently confirmed both fixture-shape findings (the trade field, the outage placeholder) and named one the other lenses missed: `pane.jsdom` used the same impossible `rationale: null` outage. That is fixed too.

**Recorded, not fixed:** lens 4 reviewed `4b9a72fb` and did not re-check which of its findings the earlier fix commit had already addressed — F3 (focus) and F13 (the chat unmounting) were already fixed by `2ec25844` before its report landed, and its independent probes of both agree with lenses 2 and 5.

---

## 7. Open questions for the founder — NOT decided here

These are copy or ruling calls, not defects. The build did not resolve them unilaterally.

1. **"Today" in ruling 11.** `evaluations[]` is never reset by day, so on day 2 of a multi-day battle the scan-back can reach yesterday's check and label it `At the {t} check`, and `No check yet today` can never render again. A day-aware Bench alone would DISAGREE with the check card above it, which is equally day-blind — so this is a ruling for the whole surface family, not a Bench fix. (lens 5 F5)
2. **`Named at the last check`** sits above `At the {t} check`. Under ruling 11 the words may be from a check that is not the last one. (lens 1 F8)
3. **Four strings nobody requested:** `No trades yet`, `Remove this bookmark`, `Show the activity log`, `Hide the activity log`. All honest and copy-guard clean; the seed says every string is a request. Ratify or retire. (lens 5 F7)
4. **`Tap for the book` is desktop-only.** The seed's A3.0 sentence is prefaced "Both shells:"; the arena mock draws it desktop-only. Resolved toward the mock without a recorded ruling. (lens 5 F9)
5. **`{n} new` counts the player's own messages**, because an exchange is written whole. One reply landing while the pane is closed reads `2 new`. Arguably correct by the seed's own definition. (lens 1 F7)

---

## 8. Method, and its limits

Five lenses, each in its own `git archive` snapshot under the session scratchpad with `node_modules` symlinked, **read-only on git and on the shared working tree** (the reviewer-isolation rule, founder ruling Sep 2 — the precedent is a reviewer's byte-exact restore that overwrote three in-flight fixes). Every mutation ran inside a snapshot and was restored there; the shared tree was verified clean between lenses. Each lens was given the rulings, the seed, the brief, the Phase 0 report and BUILD_RULES, and was instructed to refute its own findings before reporting them.

**What this review did not cover.** The presence face and the matchups backdrop are mocked off in all four screen suites, so their behaviour on the battle screen is clean by direct comparison but has no standing guard. `App.jsx` is imported by no test and is covered by `vite build` alone. The goldens are the MOBILE first paint and can only ever be that (hazard 46); the desktop shell's guarantees rest on the jsdom suites. No lens executed the app in a browser — the founder's smoke is still the only thing that can judge whether the arena reads as the loudest thing on the page while still reading its numbers first.

---

*Prepared September 4, 2026. Findings fixed at `2ec25844`; every fix mutation-checked, seven mutations and seven kills.*
