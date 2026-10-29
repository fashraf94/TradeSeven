# Review: Agent form S1 (PR #1011)

**Run date:** October 29, 2026 · **Model:** Fable · **Reviewed:** `claude/agent-form-s1` @ `9a7cfdc9` (code head `950104b5`), then the founder's 88 px ruling applied by this session as `c40e0c89` · **Verdict:** **MERGE AFTER FIXES** (0 blocking · 4 should-fix: three guard rows, and one phone layout point before the battle flag turns on · 6 notes · 2 refuted and recorded)

**In two sentences.** The armored agent on the Command Center and the two figures in a BaggerBomb battle are built as the founder ruled, both flags are off, and the shipped app is unchanged except for the one-line face fix; the 88 px ruling is applied and the header re-measured. Three guard rows do not yet catch what they claim to guard (a device-chosen hub rate, an import hidden behind the flag module, and the pure marks the flag-off identity rests on), so those three test rows should be fixed before merge; and one layout point waits for S2 before the battle flag turns on: in the app's font a long gated score on the CPU side now meets the centre column at 320–339 px, as the player's side already does on `main`. Nothing a player sees today changes.

**Finding ids.** This review numbers its findings SR-1… as the brief asks. The S0 review (`20261029_REVIEW_AGENT_FORM_S0.md`) used the same prefix, and the S1 build report cites that series ("review SR-1", "SR-2", "SR-3", "SR-15"). Those citations mean the S0 review's ids; the S1 report never cites this document. A later review should pick an unused prefix.

**Preamble.** `git fetch origin --prune` ran first. `origin/claude/agent-form-s1` = `9a7cfdc9`, the brief's head (no STOP). `origin/main` = `982f6661` (PR #1013, the Film Room cards allowlist flip), three commits past the branch's last merge of `main` (`a5c35ba6`, merged at `30db3685`); it is not merged here (the brief allows two commits), and every build comparison below is against `a5c35ba6`, the branch's own base. The smoke branch `claude/agent-form-s1-smoke` = `d4ca30cb` is out of scope; the PR's `src` diff against `main` carries no `formScale`, no readout and no "SMOKE" text (grep, VERIFIED). Fenced files edited: none, by the branch or by this review. `api/cron/agent-evaluate.js` (not fenced) was read at `:231`, `:941` and `:1214-1215` for the evaluation lock. Nothing under `api/` changes. This session's own edits are the ruling commit (three source files, the report's §11 numbers) and this document with the founder-result fill in the report's §8 and §11.10.

---

## Executive verdict

| # | Item | Result |
|---|---|---|
| 1 | Verdict | **MERGE AFTER FIXES.** Three of the four should-fixes are test rows (two guard pins, one new guard); the fourth is a phone layout point for S2 before the battle flag turns on (SR-5). No product code changes before merge. Merged as is, the flags are off and the flag-off build is proven identical to `main` but for the face fix, so the risk to players is nil; the fixes close guard gaps the next edit could walk through unseen. |
| 2 | Step 0: the 88 px ruling | Applied as `c40e0c89`: `BATTLE_FORM_PX.arena.desktop` box 88, 8 px over each side, the same 12 / 6 px vertical overhang (`battleAgentFormSlot.jsx:59-63`), its rows and the report's §11 numbers. Re-measured in headless Edge at 1280 px by the report's own method (no app font loaded): **134 px with short scores, 153 with long gated ones** (+14; was 136 / 155 at 90), phone 101 / 118; with the app's font stack applied: 134 / 156 on the desktop (+13 over `main`'s 121 / 143), and the phone header does not grow at all (101 / 121 on `main` and now) because its text column already fills the form's 48 px footprint (§3.6). Box clearances 2 px to the header's top and the bar in both, no overflow. |
| 3 | Flag-off identity (lens 1) | Rebuilt on Linux, LF trees, unminified, hashes masked: **`main` `a5c35ba6` → `c40e0c89`: one file (the entry), one line, the face fix. `9a7cfdc9` → `c40e0c89`: no file differs, even unmasked** (44 chunks, CSS, `index.html`). The two leak fixes are load-bearing and only one is guarded: a static `gameOutcome` import re-leaks three chunks and reddens the main-graph row (RV-C killed); the pure marks' removal re-leaks the hub chunk and reddens **nothing** (RV-P, RV-P2 survived; SR-3). |
| 4 | The bug fix (lens 2) | Every caller checked (§3.2): the four battle sites and the Film Room v2 mark pass a battle document (`agentContext.archetype`), the two command surfaces pass an agent document (`archetype`). No shipped battle document carries a top-level `archetype`, so the hook's field order is moot today; it is the reverse of the Film Room header's (SR-8, note). |
| 5 | The hub hero's suit-up (lens 3) | The key scheme (`pending` → `agent:<id>`) is sound: the read stays `ready` across snapshots and goes back to `loading` only on an identity change or retry (`hooks/useAgent.js:39`, `readerInputs.js:61`), so a remount happens exactly on the first answer, a switch or a failure. Six races traced (§3.3); one corner is a note (a swap requested while the ceremony pauses the hero settles without playing, SR-9). |
| 6 | Guards (lens 4) | R6a–d, the Q1 edge, `PERMITTED_TERMINALS` and the `deskHonesty` exemption each still catch what they caught, and the loosening is as stated. Five mutants of this review's own: RV-C killed; **RV-A, RV-B, RV-P, RV-P2 survived** every row the build names (§3.4) — three should-fixes (SR-1, SR-2, SR-3). |
| 7 | Moods (lens 5) | `deriveAgentMood` matches R8 and R9 on its pure inputs (every precedence pair, the sign flip, completed lost or tied → idle). Inputs traced: `cronState.evaluatingAt` comes from the battle's `onSnapshot` subscription; the 120 s is pinned to `EVALUATING_LOCK_TIMEOUT_MS` by a tripwire; `nowMs` is the screen's 60 s coarse clock, which ticks only while the controller flag is on (true; SR-7 note); the parity row holds the projection equal to the hub's on nine fixtures, and the two `finalEvidence` helpers are the same expression. |
| 8 | Sizes and framing (lens 6) | Header measured at 312, 320, 339, 360, 390 and 1280 px, short and long gated scores, flags off and on, twice: by the report's method and with the app's font stack (§3.6). In the app's font a long gated score on the CPU side meets the centre column at 312, 320 and 339 px (15 / 11 / 1 px), where `main` cleared it by 33 px or more; the player's side already overlaps on `main` at 312–360 (30 / 26 / 17 / 6 px). SR-5, should-fix before the battle flag turns on. Pane header and floating mark as the report says. The tight framing is asked for by the battle form alone (a source scan proves it); R12 holds at every site (every battle box ≥ 50 px, the hub ≥ 196). |
| 9 | Battle performance and loading (lens 7) | At most three live views (header player + CPU, then the mark or the pane's header), one shared renderer; a hidden pane (`display: none`) is skipped by the IntersectionObserver, a hidden tab stops the loop, leaving the battle unmounts every view and tears the engine down. First entry with the battle flag on costs the engine chunk **612.90 kB / 162.13 kB gzip** plus 1.96 + 1.73 kB (the form, the outcome module), with the SVG still showing meanwhile. Flags off, nothing loads: 44 chunks, byte-identical. |
| 10 | Failure paths (lens 8) | The slot's boundary keeps the still and the screen on a failed chunk; a failed outcome module leaves the form running and a completed battle idle (both rows real); a lost context shows each view's cached still (the S0 path, the still drawn at the settled form); no WebGL at all never loads the engine and shows the SVG still. One note: the outcome module is a one-shot promise (SR-10). |
| 11 | Tests (lens 9) | 8 new files, rows in 4 others; none vacuous or order-dependent that I could find (§3.9). The lazy-form waits are real-time, but the refuter timed them at 0.2–0.8 s under heavy load against a 5 s row, so that risk is refuted and recorded (SR-4). The flags-on red census on the full suite: 97 rows in 9 files, the report's list exactly (§3.9). |
| 12 | Accessibility (lens 10) | Battle forms decorative (`label={null}` → no role, no name, `aria-hidden`); the still `aria-hidden`. Reduce Motion: the screen's one `useReducedMotion()` reaches all three battle sites and the hub's one source reaches the hero. The hub name is "Shadow wearing <archetype> — <state>", names from `hub/archetypeLines.js` only (R10, Q2). |
| 13 | Rules (lens 11) | §10 and §11: the four new files registered at zero literals; the equip tween recorded as the §11 exception with a row. No package changes; `three` pinned `0.184.0`. `lint:gate` exit 0 at `c40e0c89`. Full Linux suite at `c40e0c89`, flags off: **27,387 rows, 27,298 pass, 0 fail, 89 skipped** (6,637 files). Both flags on: 97 red in 9 files, every one expected (§3.9). |
| 14 | Founder results | Recorded in the report (§8, §11.10): the first iPhone run looked fantastic everywhere, the one issue the figures' size. **Nothing was pasted for the size check or the `60 s:` line**, so the line was not kept (recorded as such), and the `?formScale=` value the founder liked is not on record. |

---

## 1. The founder's rulings, checked against the code

Every anchor VERIFIED in this session at `c40e0c89`.

| # | Ruling | Where | Holds |
|---|---|---|---|
| R1 | Phone rate `AGENT_FORM_PHONE = 'live'`; `'half'` and `'still'` reachable through the constant | `hub/hubFlags.js:58`; `HubAgentForm.jsx:37-39` `hubFormRate`; pinned `hub/hubFlags.test.js:100-116` | Yes |
| R2 | Batched plates everywhere | `HubAgentForm.jsx:75`, `BattleAgentForm.jsx:48` (`batched`) | Yes |
| R3 | The CSS-blurred glow, isolated; `contain: paint` where it spills | `HubAgentForm.jsx:74,78` (`bloom="css"`, `clip`); `AgentForm.jsx:112` (`isolation: isolate`, `contain: 'paint'`); the battle forms are not clipped (nothing adjoins their box edge) | Yes |
| R4 | The design's equip timing; late at half rate = over 50 ms | `engine/vocab.js:65-66` (900 ms / 700 ms keys); the "late" rule lives in the smoke readout only, out of scope | Yes |
| R5 | The bare → armored size step smoothed across the tween | `engine/vocab.js:43,112-121` (`FRAME_SCALE`, `swapScale`), `engine/engine.js:429-453` (`swap`), `engine/form.js:59`; rows in `engine.lifecycle.jsdom.test.js` (no step > .02 per frame, monotone, ends exact) | Yes |
| R6a | One pinned lazy edge to the engine | `commandCenterHub.mount.guard.test.js:694,820-828` | Yes (SR-2 for the terminal it adds at `:624`) |
| R6b | `three` only behind it | `:830-839` | Yes |
| R6c | The wrapper in the activity guards | `:685-693,776-780`; `commandCenterHub.activity.guard.test.js:173-208` | Yes |
| R6d | No frame-cost self-downgrade | `:841-852` | Yes, but the row pins the helper, not its call (SR-1) |
| R7 | Stage 1 through `getAgentGrowth` | `HubAgentForm.jsx:56`, `BattleAgentForm.jsx:37` | Yes |
| R8 | Battle moods from real signals, in that order; completed lost or tied is idle | `battleView/agentMood.js:69-81`; rows `agentMood.test.js` | Yes |
| R9 | The CPU a bare copper core, mirrored, sign-flipped standing only | `BattleAgentForm.jsx:40,44` (no archetype, `allegiance 'opponent'` → copper, `face −1` in `agentFormSpec.js`); `agentMood.js:72` | Yes |
| R10 | Labels unchanged; hub name "Shadow wearing <archetype>" from `archetypeLines` only | `ArenaHeader.jsx` keeps the name and "CPU"; `HubAgentForm.jsx:62`, `hub/hubCopy.js:517-520`, `hub/archetypeLines.js:27` | Yes |
| R11 | Fixed teal / copper | `HubAgentForm.jsx:71`, `BattleAgentForm.jsx:44` | Yes |
| R12 | Under 40 px a still | `agentFormSpec.js:74-79` (`LIVE_MIN_PX`, `rateForSize`), `AgentForm.jsx:62`; the R6d row also pins the call | Yes |
| Q1 | The lazy edge to `gameOutcome.js` approved | `BattleAgentForm.jsx:30`; pinned `mount.guard:925-927` as `-> lazy` | Yes (a static edge reddens the row: RV-C) |
| Q2 | The state tail kept | `hubCopy.js:519` `imageLabel` | Yes |
| Q3 | Any lead counts | `agentMood.js:80` via `standingFromDuel` (no dead band) | Yes |
| Q4 | The CPU keeps its final standing | `agentMood.js:72` returns before the completed check | Yes |
| Q5 | The response brighten deferred; hub flag off for players | report §9; `AGENT_FORM_HUB_ENABLED = false` | Yes |
| Q6 | The `deskHonesty` exemption as scoped | `deskHonesty.test.js:204-205` (one statement), the earned row `:230-237` | Yes |
| Size | Battle boxes ×1.25 with battle-only framing; header +12 phone / +16 desktop at most | `BATTLE_FORM_PX` (60 / 88 / 50 / 50 / 55); `TIGHT_ZOOM` asked for by `BattleAgentForm.jsx:49` alone (the source-scan row in `AgentForm.s1.jsdom.test.jsx`); measured +5 / +14 | Yes |
| 88 px | The desktop arena form 88, not 90 | `c40e0c89`: `battleAgentFormSlot.jsx:59` `desktop: { box: 88, outer: 8, inner: 8, top: 12, bottom: 6 }`; `battleAgentForm.sites.render.test.jsx:49-52` | Yes; 88 < 90 keeps `small` true in `engine/form.js:56,67,70` and `engine/engine.js:234` |

---

## 2. Findings

Severity: blocking · should-fix · note. Each with file:line, evidence, and the smallest fix. The adversarial pass (§4) gives each its CONFIRMED / REFUTED mark.

### Should-fix

**SR-1 — The R6d guard pins the rate helper, not the line that picks the rate.**
`src/components/CommandCenter/commandCenterHub.mount.guard.test.js:841-852` pins `hubFormRate`'s body (`:843-844`), the one `rate={rate}` prop (`:845`), and a `FRAME_READ` regex over the hub view and the wrapper (`:849-851`). It does not pin `const rate = hubFormRate(phone);` (`HubAgentForm.jsx:54`). Mutant RV-B, `const rate = typeof navigator !== 'undefined' && navigator.hardwareConcurrency < 4 ? 'half' : hubFormRate(phone);`, a device-derived rate, **survived 103 rows in 5 files** (the mount guard, the activity guard, `HubAgentForm.jsdom`, `hubFlags.test`, `ShadowStage.agentForm.jsdom`; Linux). The refuter's correction (§4): four behavioural rows do pin the rate's value (`HubAgentForm.jsdom.test.jsx:89,98`, `ShadowStage.agentForm.jsdom.test.jsx:47,56`), and RV-B passes them only because jsdom's `navigator.hardwareConcurrency` is the host's core count (20 on this machine, many on the Linux run); the same line with `< 999` reddens all four, so on a 2-vCPU CI runner RV-B itself would fail. The source-level gap is real all the same: R-S7-2 and R6d are about the hub never choosing a rate from the device, the R6d row guards the helper's text while the choice can move one line up, and a wide device hides the choice from the behavioural rows. Smallest fix: in the R6d row, ban the device-reading tokens over the stripped hub view and the wrapper list, as `ShadowCanvas.contract.jsdom.test.jsx:202` does for the canvas — `\b(?:navigator|hardwareConcurrency|deviceMemory|matchMedia|Date)\b`, which the pristine files are clean of — with a plant in the "R6 rows bite" row (`:854`). A pin of the call line alone (`/const rate = hubFormRate\(phone\);/`) kills RV-B but is evaded by computing `phone` from the device one line earlier.

**SR-2 — The flag module is a terminal the hub walk never looks inside.**
`commandCenterHub.mount.guard.test.js:624` adds `src/config/agentFormFlags.js` to `PERMITTED_TERMINALS` with "It imports nothing", and `graph()` stops at a terminal without reading its imports (`:643`). Nothing pins "imports nothing": `src/config/agentFormFlags.test.js` checks that `featureFlags.js` does not mention `AGENT_FORM`, not the reverse. Mutant RV-A adds `import { isAgentPresenceOn } from './featureFlags';` (and an export using it) to the flag module; it **survived 95 rows in 4 files** (the mount guard, `agentFormFlags.test`, `agentFormLabFlags.test`, `agentForm.guard`). `featureFlags.js` holds about 22 reads of `localStorage`, `import.meta.env`, `window` and `document`, exactly what the hub guard exists to keep out of the hub graph, and after RV-A the hub's static graph reaches them unseen. The refuter (§4) re-ran RV-A on 159 files and 4,330 rows (every CommandCenter, config, theme guard, AgentForm and App lab test, plus every guard, census and boundary test under `src/` and `api/`): nothing red because of the mutant, and the only rows that pin a module's exact imports (`:894-900`, `:988`) name other modules. Smallest fix (the refuter's): a single-module pin in the mount guard beside the claim it backs, `expect(importsOf('src/config/agentFormFlags.js')).toEqual([])` (the precedent at `:900` for `hubGateCopy.js`; `importsOf` also sees `export … from` and spaced forms a line regex misses). A blanket "walk every terminal and require no imports" row would be unsound, since most of the ~40 terminals legitimately import; the same one-liner in `agentFormFlags.test.js` is a belt, not a replacement.

**SR-3 — The pure marks are load-bearing and unguarded.**
The flag-off identity rests on `/* @__PURE__ */` marks (`agentFormSpec.js:15,24,31,32,47`; `HubAgentForm.jsx:34`; `battleAgentFormSlot.jsx:23`) and on `hub/selectors/gameOutcome.js` being loaded one `import()` deeper (`BattleAgentForm.jsx:30`). The second is guarded: a static import there changes the main-graph edge from `-> lazy` and reddens `mount.guard:925-927` (RV-C killed), and its build re-leaks three chunks (`AgentBattleScreen`, `CommandCenterHub`, the entry). The first is not: RV-P (the two marks off `agentFormSpec.js:24`) and RV-P2 (the mark off `HubAgentForm.jsx:34`) **survived every row** (102 in 4 files; 82 in 3), and a Linux flag-off build of RV-P puts this into the otherwise byte-identical `CommandCenterHub` chunk:
```
const FORM_BY_CODE_ID = /* @__PURE__ */ Object.freeze({ momentum_chaser: "trend", … });
Object.freeze(Object.keys(FORM_BY_CODE_ID));
```
`hub/hubCopy.js:517` `AGENT_FORM_COPY = Object.freeze({…})` is unmarked and is dropped today only because Rollup knows `Object.freeze`; a computed member in that literal would leak the same way. Only a Linux build diff notices any of this, and no CI step runs one. The refuter (§4) re-ran both mutants on 193 files and 5,111 rows (every CommandCenter, config, theme-guard, battleView and non-engine AgentForm test, and every `src/` test named guard, bundle, chunk or identity): nothing red because of them, no test file in the repo contains `__PURE__`, and a Windows in-memory Rollup of the two modules reproduces both leaks. I first proposed a source-scan row requiring the marks on every module-level call; the refuter shows it would be evadable (`let X; X = Object.freeze(…)`, a destructured `const [a] = Object.keys(…)`, or an inner-only mark all survive Rollup and pass the scan) and over-broad (`battleAgentFormSlot.jsx`'s `FLAG ? lazy(…) : null` is correctly unmarked, and `AGENT_FORM_COPY`'s `Object.freeze` is dropped by Rollup's own knowledge, so marking it would be a mark for the scan). Smallest sound fix, about the same size: a Node test row that Rollup-bundles each flag-off-reached module exactly as the flag-off graph reaches it (`HubAgentForm.jsx` and `battleAgentFormSlot.jsx` imported and unused; `agentFormSpec.js` with only `formForArchetype` and `hasWebGL` used; `hubCopy.js` with `HUB_COPY` used), everything else external, and asserts the output holds nothing but the used functions — about a second, it catches both mutants and every shape above whatever the marks say. It does not cover the chunk-order technique (b), which the mount guard's main-graph row already pins.

**SR-5 — With the app's font, a long gated CPU score meets the centre column at 320–339 px.**
The report's header harness (and my first run of it) loads only `tokens.css`, so headless Edge laid the scores out in Times New Roman; the app's body stack is `index.css:54` (`'Inter', -apple-system, …, 'Segoe UI', …`; the app never loads Inter, so a phone draws SF Pro and a Windows desktop Segoe UI). Re-measured with that stack applied to the built harness (this machine resolves it to a locally installed Inter; the refuter's GDI measurement puts Segoe UI Bold within a pixel of it; SF Pro is unmeasured): with the flags on and long gated scores (−123.45 vs −98.76) the CPU score's box overlaps the centre column ("DAY 3 OF 5") by **14.8 px at 312, 10.8 at 320 and 1.3 at 339**, clearing it by 9 at 360 and 24 at 390; flags off it clears by 33 px or more at every width. Cause: the CPU cell now holds the form's 40 px footprint plus an 8 px gap beside the score (`ArenaHeader.jsx:334-363`), 48 px the score had to itself before. The player's side already overlaps on `main`, more (30 / 26 / 17 / 6 px at 312 / 320 / 339 / 360), unchanged by the PR; in the serif measurement both collisions looked smaller, and the report's §4 and §11.3 "no overlap at 320" rest on it. The flag is off, so nothing shows today. Before `AGENT_FORM_BATTLE_ENABLED` turns on, S2 should let the gated two-decimal scores shrink under about 360 px (`minWidth: 0` and a smaller size with `tabular-nums`, or one decimal) rather than the figure, and re-measure with the app's stylesheet loaded, on the phone.

### Notes

**SR-4 — The lazy-form waits are real-time — REFUTED as a risk, recorded.** `src/screens/battleView/BattleAgentForm.jsdom.test.jsx:37-39` (`until`: 300 × `setTimeout` 10 ms inside `act`) and `BattleAgentForm.failure.jsdom.test.jsx:26-28,64` (`turns(600, …)`: 600 × 5 ms) wait in wall time for `lazy(() => import('./BattleAgentForm'))` and the module-level `import(gameOutcome)` to resolve, under vitest's default 5 s row timeout (neither file sets one); the build lengthened the first from 100 ms after one red (§11.7). I claimed a slow first import plus a WSL clock step (+0.8–1.75 s, charged to the row's 5 s because vitest checks `Date.now`) could red it. The refuter (§4) timed the rows: alone 3–230 ms (the first row carries the chunk load, 75–133 ms), inside a 150-file 8-worker run 95 ms, and on a deliberately oversubscribed box (20 workers plus 20 CPU burners, with 11 other rows timing out) 236–686 ms, worst 0.5 s. A red needs about 4.9 s, or 3.2 s with a step inside the row, 6–10× above anything observed, and a step lands inside a 0.5 s row about 1.5 % of the time. The build's one red came from the original 100 ms budget, which was marginal even alone (5–8 turns), not from load; and the loop's real cap is about 4.5 s, not the comment's 3 s (a turn costs ~15 ms). Optional hygiene, not counted: warm the chunk in `beforeAll` and poll a bounded count of turns (tried in a scratch copy: the row resolves in two turns and still fails a slot that renders no form); the failure file's `vi.resetModules()` in `beforeEach` discards a `beforeAll` warm, so there the bounded event poll alone is the change.

**SR-6 — The mark's clearance comment is stale.** `AgentBattleScreen.jsx:614-619` derives `AVATAR_CLEARANCE_PX = 96` from "the avatar's own hit target (48) plus its inset (14) plus a row's breathing room". The mark is now 50 px on the phone (inset 14 → 64) and 55 on the desktop (inset 16 → 71), measured; 96 still clears both with 32 / 25 px of room (was 34 / 32), so the board's last row stays above the mark at the end of the scroll. The refuter (§4) confirms the four uses are `paddingBottom` only (`:3726,3750,3751,3764`), that `TAP_MIN` is a floor the button grows past, and that `SHEET_PEEK_PX` carries no 48; the same stale derivation sits in `AgentBattleScreen.pane.jsdom.test.jsx:291,298` (a `48 + 14` floor). Comment-only fix in both: name 55 + 16 and 50 + 14.

**SR-7 — The mood's clock is the cockpit's — REFUTED as a hazard, recorded.** `AgentBattleScreen.jsx:1035` `useCoarseNow(controllerOn)`; `useCoarseNow.js:21` returns the mount-time `Date` and never ticks when disabled; `battleAgentFormSlot.jsx:29` hands its `getTime()` to the forms. `BATTLE_VIEW_CONTROLLER_ENABLED` is `true` (`featureFlags.js:2154`), so it ticks every 60 s and on visibility, and a stale `evaluatingAt` (a crashed tick leaves it until the server takes the lock over after 120 s, `agent-evaluate.js:941,1214-1215`) ages out of "researching" within 120–180 s; a normal tick clears the stamp at its end (`:1215`), so the pose shows for the evaluation only. I claimed that with the flag off `nowMs` would freeze at mount and a stale stamp would read "researching" for the session. The refuter (§4) shows the coupling is structural, not accidental: every form site sits under `paneOn` (`AgentBattleScreen.jsx:3246,3268,3537`), and `paneOn` is `isBattleViewControllerOn() && BATTLE_VIEW_CHARACTER_PANE_ENABLED` (`featureFlags.js:2226`), so with the controller off there are no forms to read the frozen clock. The cron also clears the stamp on degraded quotes, on any thrown error and at completion (`agent-evaluate.js:544,1215,4926,7149`), so only a hard kill leaves one. Residual, worth a comment line: `evaluationInFlight` treats a non-finite `nowMs` as in flight (`agentMood.js:51-52`), so a slot ever rendered outside `BattleAgentFormScope` would read a stale stamp as researching for good; today every slot has the scope. Not counted.

**SR-8 — The hook reads the live field first; the Film Room reads the snapshot first.** `useAgentPresence.js:42` is `agent?.archetype ?? agent?.agentContext?.archetype ?? …`; `FilmRoomScreenV2.jsx:119` is `[battle?.agentContext?.archetype, battle?.archetype, tape?.archetype].find(…)`. No shipped battle document carries a top-level `archetype` (`agentBattleService.js:193` writes `agentContext.archetype`; no `battleRef.update/set` under `api/` writes a top-level one; the tournament projection exposes `agentContext.archetype`, `tournamentBattleView.js:45`), so the two orders agree today and the fix is right for every caller: the four battle sites and the Film Room v2 mark get the snapshot, `IdentityPanel` and `EquipStation` the live agent document. The refuter adds: the League surfaces use `AgentPresence` directly (`ClimbArena.jsx:225`, `FuseHero.jsx:94`), not the mount, and `api/agent/change-archetype.js:138-145` refuses a change while the agent has an active battle, so even a future mirror could only diverge after completion. A battle surface should still prefer the snapshot (it is what the battle was fought as, and what the Film Room header shows); smallest fix for S2: `surface === 'duel'` reads `agentContext.archetype` first. A nit.

**SR-9 — A swap while paused settles without playing.** `engine.js:429-433`: `swap()` falls back to `update()` on `!v.ctx || !animates(v) || target === headed`; `animates` (`:178`) ignores `paused`, and `kick()` (`:324`) requests no frame for a paused view. A swap requested while the deploy ceremony pauses the hero (`CommandCenterHub.jsx:361,458` → `paused={coverOpen}`) starts a time-based tween no frame advances; on un-pause the first `frameSpec` finds it elapsed, `settleSwap` runs, and the new form appears at once at its own scale (the R5 step, in this corner). The archetype cannot change from this device under the pause (the hero is keyed by agent id, `HubAgentForm.jsx:45,66`, so only the same agent's archetype changing swaps, and the change-archetype rider refuses during an active battle), so it takes another tab or device; but `overlayOpen` also covers the due-idea screen (`DeployAttemptContext.jsx:202`), which can stay open indefinitely, so the window is wider than the ceremony (the refuter, §4). The lifecycle suite covers pause and resume, never a swap while paused. A note. Smallest fix, if wanted: start the tween from the un-pause instant (store the swap's progress, not its start time, while paused), with a row.

**SR-10 — The outcome module is a one-shot promise.** `BattleAgentForm.jsx:30` creates `outcomesLoaded` once per page; a failed load (`.catch(() => null)`) stays `null` for the page's life, so a battle the player won shows idle, never a claimed win, until a reload. The design accepts the direction of the error; the boundary row covers the behaviour. I proposed recreating the promise on the next mount; the refuter (§4) shows that would not work: browsers memoise a failed module fetch in the document's module map, so re-importing the same URL rejects without a network attempt, recovery is a reload (Vite's documented pattern; the repo has no `vite:preloadError` handler), and the slot's own chunk fails for good the same way (`battleAgentFormSlot.jsx:72-77`), so the design is consistent. No fix proposed.

**SR-11 — The smoke branch's desktop box is 90.** `claude/agent-form-s1-smoke` (`d4ca30cb`, out of scope) carries the `?formScale=` dial on a 60 / 90 base; #1011 is now 60 / 88. A founder reading of the dial on that preview is 2 px larger on the desktop than this branch at `formScale 1`. Rebuild the smoke on `c40e0c89` before the next size reading.

**SR-12 — A citation in the report.** The report's §1 cites `useHubRuntime.js:104-107` for the Loadout's agent read; the file is `src/components/CommandCenter/hub/useHubRuntime.js` (`:103-107`, `archetypeLines(agent?.archetype)`). Docs only.

### Recorded, not findings

- **The clipped sets (§11.8):** the Trend Follower cut at the left edge in five of six moods, the Diversifier at both sides when celebrating, at every size including the hub's 340 px hero. Carried from S0; to S2.
- **Also later:** the response brighten and "brighten by area" (S2, ruling 5; `AGENT_FORM_HUB_ENABLED` stays off for players until then), League battles (S2; the league dock still takes `youSeatArch(model)` and draws the robot head), the armory and small sizes, and the S0 list of unbuilt design pieces (seam flash, ring burst, unworn sets at 70 % light, trailing streams at 40 px).
- **The `60 s:` line** was not kept (twice); recorded in the report.
- **`origin/main` has moved** (PR #1013) since the branch merged `a5c35ba6`. Not merged here; the merge is the founder's, and the final checks (`final-checks-on-merged-tree`) will want `main` merged first.
- **The entry chunk** is 4,838 kB minified / 1,306 kB gzip with the flags on and the same without; that is the app's size, not this build's.

---

## 3. Lens notes

### 3.1 Flag-off identity

Method as the report's §3: `vite build --minify false` on Linux (WSL, Node 20.20.2), in a worktree of `~/pd-ci` with `~/pd-ci-af1`'s `node_modules` (which has `three`), LF trees fetched by full SHA, every `-[8 chars].js/.css` masked in names and contents, `diff -r` with source maps excluded.

| Pair | Masked | Unmasked |
|---|---|---|
| `main` `a5c35ba6` → `c40e0c89` | 1 of 44 chunks differs: the entry, by one line (`useAgentPresence`'s read: `agent?.archetype ?? agent?.agentContext?.archetype ?? …`) | — |
| `9a7cfdc9` → `c40e0c89` | no file differs | **no file differs** (the 88 px table change is inside the folded branch) |
| `c40e0c89` → RV-P (pure marks off) | `CommandCenterHub` chunk differs (the hunk under SR-3) | — |
| `c40e0c89` → RV-C (static `gameOutcome` import) | `AgentBattleScreen`, `CommandCenterHub` and the entry differ | — |

Robustness: technique (b), the deeper `import()`, is held by the mount guard's main-graph row (a static edge is a different string). Technique (a), the pure marks, is held by nothing (SR-3). The literal-ternary reads are held by `agentFormFlags.test.js` line-pins at every site (five in the screen, three in the sites, two stage sites and the scope), which is sound as far as it goes: a bare `{FLAG && <X/>}` fails its regex.

### 3.2 The bug fix

Callers of `useAgentPresence` (through `AgentPresenceMount`, the only caller of the hook): `ArenaHeader.jsx:251-253`, `CharacterPane.jsx:354-356`, `CharacterAvatar.jsx:282-284` and the legacy `ScoreHeader` (`AgentBattleScreen.jsx:758-760`) pass `agentBattle`, the battle document (`agentContext.archetype`); `FilmRoomScreenV2.jsx:174` passes `battle`, a battle document; `IdentityPanel.jsx:90` and `EquipStation.jsx:230` pass `agent`, the live agent document (`archetype`, no `agentContext`). The league surface has no document and takes `youSeatArch(model)`, unchanged. So the fix changes exactly the five battle faces (four battle sites, the Film Room mark) and nothing else; the Film Room v2 mark now agrees with its own header, which already named the snapshot's archetype (`:119`). "Both fields" never occurs on a shipped document (SR-8).

### 3.3 The hub hero's suit-up

Key: `hubFormRead` (`HubAgentForm.jsx:42-46`) gives `pending` until `status === 'ready'`, then `agent:<id>` (`agentService.js:34` attaches `id: docSnap.id`; `agent:none` for a signed-out ready read). `useAgent` sets `loading` only on `[userId, ownerEpoch, retryKey]` (`hooks/useAgent.js:39,63`) and stays `ready` through later snapshots; `loadoutAgentOf` returns `loading` when the read's owner or epoch is not the signed-in identity's (`readerInputs.js:60-61`). So:
- a change during chunk load: `AgentForm`'s update effect returns before the view exists (`AgentForm.jsx:94-95`), `kindRef` stays null, and the mount reads the latest spec (`:79-81`) → drawn at once, no swap (row "a change while the engine chunk is still loading");
- an account switch mid-swap: the key changes → the old `AgentForm` unmounts (`view.unmount()`, `:87`), the new one mounts at once;
- a remount mid-tween: same path; `unmountView` releases the form and the 2D backing stores (`engine.js:465-483`);
- the pause: `paused` reaches `setOptions` (`AgentForm.jsx:100`); the loop skips the view (`engine.js:305,324`); a swap requested meanwhile is SR-9;
- a context loss after a swap: the still is drawn at `settledSpec` (`engine.js:214-218`; row "the cached still is drawn where the view is headed");
- Reduce Motion: `swap()` → `update()` → `drawNow` (`:432-433`; row "under reduced motion … a swap is update()").
`onStatus` reports carry the key they were rendered under (`HubAgentForm.jsx:52-53,81`), so a stale report after a re-key is ignored (row "a re-keyed form starts again from still").

### 3.4 Guards and this review's mutants

Each mutant one exact replacement in the WSL worktree, the named files run, the file restored from `git show HEAD:` and checked clean (`rv-mutants.json`).

| Mutant | What | Rows run | Result |
|---|---|---|---|
| RV-A | `agentFormFlags.js` imports `featureFlags.js` (a terminal grows an import) | 95 in 4 files | **survived** → SR-2 |
| RV-B | `HubAgentForm.jsx` picks `'half'` from `navigator.hardwareConcurrency` | 103 in 5 files | **survived** → SR-1 |
| RV-C | `BattleAgentForm.jsx` imports `gameOutcome.js` statically | 89 in 3 files | killed by the main-graph row (`mount.guard:925`) |
| RV-P | the two pure marks off `agentFormSpec.js:24` | 102 in 4 files | **survived** → SR-3 (and leaks: §3.1) |
| RV-P2 | the pure mark off `HubAgentForm.jsx:34` | 82 in 3 files | **survived** → SR-3 |

The amendments are loosened by no more than stated: R6a pins the one edge by path (`:694`) and the wrapper's six modules by path (`:685-693`), so a seventh module or a second `import()` is a different list; R6b checks `bare` for `three` and `PERMITTED_PACKAGES` verbatim; R6c lists the wrapper's calls one by one (`activity.guard:173-181`) with eight plants (`:192-205`); the Q1 edge is pinned as `-> lazy` with its literal (`:925-942`); the `deskHonesty` exemption is one statement, split out of the scan and required to exist once (`deskHonesty.test.js:204-205,230-237`). The adversarial pass (§4) re-ran the surviving mutants against a far broader set on Windows.

### 3.5 Moods

Pure function: `deriveAgentMood` (`agentMood.js:69-81`) — opponent first (`:72`, so Q4), then completed (won through `deriveGameOutcome` on `outcomeInputOf(b)`, else idle, `:73-76`), waiting (`needsYouCount > 0`, `:77-78`), researching (`:79`), the standing (`:80`). The rows cover each pair.
Inputs: `agentBattle` is `useAgentBattle`'s `onSnapshot` document (`hooks/useAgentBattle.js:2,71`), so `cronState.evaluatingAt` is live; the server stamps it at the tick's start (`agent-evaluate.js:965`), clears it at the end (`:1215`, `:4926`) and takes a stale one over after `EVALUATING_LOCK_TIMEOUT_MS = 120_000` (`:231,941`), which `agentMood.test.js:81-86` pins to `EVALUATION_LOCK_MS` by reading the cron's literal. `nowMs` is the coarse clock (SR-7). `scores` are `duelScores(…)` at each site, the pair the robot head is fed, held equal by the parity row over 3 comparisons × 3 score shapes. The outcome projection: `agentMood.js:35-45` and `hub/gamesDisplay.js:41-50` are the same six fields, and `finalEvidence` is the same expression in both (`gamesDisplay.js:35-38` `hasFinalEvidence`); the parity row runs nine fixtures including a feed with a null entry and a tournament-banked record.

### 3.6 Sizes and framing (measured)

Headless Edge 156 (ANGLE D3D11), 2×, reduced motion, the real `ArenaHeader` in fixed-width frames from a harness build of `c40e0c89` with the flags off (today's face) and on; fixture Speculator, scores 12.4 vs 8.1 or long gated −123.45 vs −98.76.

| Width | Height, short: off → on | Height, long gated: off → on | Form box (footprint) | Overflow | Overlaps (long) |
|---|---|---|---|---|---|
| 312 | 96 → 101 | 113 → 118 | 60 (40 × 48) | none | score×centre 16.6 px (on `main` too); **cpuScore×centre 3.4 px, new** |
| 320 | 96 → 101 | 113 → 118 | 60 (40 × 48) | none | score×centre 12.6 px (on `main` too); CPU score clears by 0.6 px |
| 339 | 96 → 101 | 113 → 118 | 60 (40 × 48) | none | score×centre 3.1 px (on `main` too) |
| 360 | 96 → 101 | 113 → 118 | 60 (40 × 48) | none | none |
| 390 | 96 → 101 | 113 → 118 | 60 (40 × 48) | none | none |
| 1280 | 120 → **134** | 139 → **153** | **88 (72 × 70)** | none | none |

312 and 339 stand in for "larger text": the header uses px throughout (only `letterSpacing` is in em), so iOS page zoom at 125 % / 115 % is a 312 / 339 px viewport. Box clearances flags on: 2 px to the header's top and to the bar at every width; on the phone the drawn figure's left edge sits 12.5–14 px in, the CPU's right 9–14 px; on the desktop 31.5–33.5 and 26–33.5.

**With the app's font stack applied** (`index.css:54`, which the harness page had not loaded; resolved on this machine to a locally installed Inter, and the app itself never loads Inter, so a phone draws SF Pro and a Windows desktop Segoe UI — the refuter found Segoe UI's widths within a pixel of these; SF Pro is unmeasured). The serif numbers above are the report's own method, kept to compare with it; these are the closer ones:

| Width | Height, short: off → on | Height, long gated: off → on | Overlaps, long gated, flags on (`main` in brackets) |
|---|---|---|---|
| 312 | 101 → 101 | 121 → 121 | score×centre 30.3 (30.3); **cpuScore×centre 14.8** (clear 33.2) |
| 320 | 101 → 101 | 121 → 121 | score×centre 26.3 (26.3); **cpuScore×centre 10.8** (clear 37.2) |
| 339 | 101 → 101 | 121 → 121 | score×centre 16.8 (16.8); **cpuScore×centre 1.3** (clear 46.7) |
| 360 | 101 → 101 | 121 → 121 | score×centre 6.3 (6.3); CPU clear 9.2 (57.2) |
| 390 | 101 → 101 | 121 → 121 | none (none) |
| 1280 | 121 → **134** | 143 → **156** | none (none) |

In this font the phone's text column is already 48 px tall, the same as the form's footprint, so the header does not grow on the phone at all; the desktop grows 13 (the 70 px footprint over a 57 px column). On a device the growth is the footprint less the font's text column, so it lies between 0 and the serif numbers (5 / 14); the 2 px clearances to the header's top and the bar hold in both fonts, and the short-score rows never overlap.
Pane header (phone sheet 320 / 360 / 390; desktop pane 307 / 468 / 512): heights 57 (104 at 307 where the name wraps on `main` too), the form 50 over the 36 px footprint, 5 / 7 px from the pane's edge, 3 px to the name, 3 / 4 px to the header's top and bottom, no overlap, no overflow. Mark: 50 × 50 at 12 / 14 px (phone), 55 × 55 at 16 / 16 (desktop), the unread badge at the button's top right (24, 2). `AVATAR_CLEARANCE_PX` 96 clears both (SR-6).
Framing: `TIGHT_ZOOM` applies only with `framing === 'tight'` (`agentFormSpec.js:64`); the wrapper sends `zoom: spec.zoom ?? 1` with every patch (`AgentForm.jsx:92-96`); only `BattleAgentForm.jsx:49` asks (the source-scan row walks every file under `src/`). The hub and the lab therefore draw at the engine's own 1; the report's pixel comparison (56 hub frames, 56 stills, with a control) is the measurement of record. R12: every battle size is 50 or more, the hub's 196 or more, and `rateForSize` floors at 40.

### 3.7 Battle performance and loading, flags on

Views: the arena header mounts two slots (`ArenaHeader.jsx:247,358`); the desktop column mounts the mark while the pane is closed (`AgentBattleScreen.jsx:3787`) and the pane's header while open (`:3818`, the wrapper `display: none` when closed); the phone mounts the mark at the root unless the pane or the tape is open (`:4042`) and the pane in its sheet (`:4063`). So at most three live views at once, all on the shared path (one renderer; `drawPath` defaults to `'shared'`). A `display: none` pane is not intersecting, so its view is skipped (`engine.js:305,331`); a hidden tab stops the loop (`visibilitychange`, `:339`); leaving the battle unmounts the slots → `unmountView` → `teardown()` at zero views (`:465-483`). Cost on first entry, from the flags-on minified Linux build of `c40e0c89`: the engine chunk 612.90 kB / 162.13 kB gzip (unchanged from S0), `BattleAgentForm` 1.96 / 1.03, `gameOutcome` 1.73 / 0.99; the hub chunk 140.92 / 42.48 with the hub flag on. On a phone that is roughly 165 kB over the air and one parse of a 613 kB script before the first form draws (ASSUMED timing: a second or two on LTE), with the SVG still in place meanwhile; once cached it is free, and a hub with its flag on warms it. Flags off: nothing is loaded and nothing is in the bundle (§3.1).

### 3.8 Failure paths

`SlotBoundary` (`battleAgentFormSlot.jsx:73-77`) catches the lazy chunk's rejection at render and keeps the still (row "the form's chunk fails"); React caches a rejected `lazy`, so the still stays. `outcomesLoaded` catches to `null` (`BattleAgentForm.jsx:30`) and `use()` yields it; `deriveAgentMood` without `outcomes` makes a completed battle idle (row "the outcome module fails"). A thrown frame drops that view to `unavailable` and the wrapper shows its cached still (S0's SR-2 path). A lost context shows each view's still, drawn at the settled form; no WebGL at all (`hasWebGL()` false) never starts the engine load (`AgentForm.jsx:75`) and shows `AgentFormStill`. `deriveAgentMood` guards every input shape it reads (`Array.isArray`, `typeof`, `Number.isFinite`).

### 3.9 Tests

New files and rows read in full. Real, not vacuous: the counted-mounts row (`HubAgentForm.jsdom`), the swap rows on a hand-driven clock (`engine.lifecycle.jsdom`, deterministic by construction, including the frame-43 settle), the source-scan rows with plants (`AgentForm.s1.jsdom`, `agentFormFlags.test`, the activity guard), the parity rows (`agentMood.test`, `battleAgentForm.sites.render`), the growth bound (an upper bound, stated as such). No order dependence found: each jsdom file resets its recorders in `beforeEach`, the failure file resets modules per row and unmocks in `afterEach`. The real-time waits: SR-4. The flags-on red census of this review, on the FULL Linux suite at `c40e0c89` with both flags flipped true in the worktree (flags only, no readout): 27,201 pass, **97 fail in 9 files**, and every one pins what the flags replace:

| File | Red | What the rows pin |
|---|---|---|
| `CommandCenter/CommandCenterHub.s7.jsdom.test.jsx` | 52 | `ShadowCanvas` / `ShadowStill` themselves |
| `screens/AgentBattleScreen.quoteAvailability.jsdom.test.jsx` | 15 | flag-off captured references (`44d0c63e`) |
| `battleView/ArenaHeader.render.test.jsx` | 13 | the robot face and its props |
| `screens/AgentBattleScreen.paneHeader.jsdom.test.jsx` | 4 | the boxed arena and pane faces |
| `config/agentFormFlags.test.js` | 3 | the two pins and the literal row |
| `battleView/CharacterAvatar.render.test.jsx` | 3 | the robot face |
| `CommandCenter/CommandCenterHub.jsdom.test.jsx` | 3 | the S1 rows asserting `ShadowCanvas` |
| `config/flagPinGuard.test.js` | 2 | the pin contradiction, `DARK_BY_DESIGN` integrity |
| `battleView/CharacterPane.comparison.render.test.jsx` | 2 | the robot face |

No throw, no missing provider, no other row: the same files and counts the report measured in four directories (§8), now on the whole suite.

### 3.10 Accessibility

`AgentForm.jsx:110-112`: `label === null` → no `role`, no `aria-label`, `aria-hidden="true"`; the slot's still is wrapped `aria-hidden` (`battleAgentFormSlot.jsx:82`), and `AgentFormStill` is `aria-hidden` itself. Reduce Motion in the battle: one source, framer's `useReducedMotion()` (`AgentBattleScreen.jsx:1031-1032`), passed to `ArenaHeader` (both slots, `:247,358`), `CharacterPane` (`:343`) and `CharacterAvatar` (`:280`); the wrapper reads no media query (R-S7-1). The hub: the stage's `reducedMotion` prop into `HubAgentForm` into `AgentForm`. Label: `AGENT_FORM_COPY.imageLabel(name, state, areaName)` (`hubCopy.js:519`) = "Shadow wearing <name> — <state>; <area> selected", the name from `archetypeLines(archetype).name` (`archetypeLines.js:27-30`); bare Shadow keeps `HUB_COPY.shadow.imageLabel` (R10, Q2; rows in `HubAgentForm.jsdom`).

### 3.11 Rules

§10: the four new files are in `tokens.guard.test.js`'s list with `{}` baselines; no hex in them. §11: `motion.guard.test.js` registers them at count 0; the equip tween is recorded as the stated exception (`mount.guard:1054-1061`) with the row at `:1096`. §2: the diff is 47 files over the threshold, this review is the required one; the fenced list is untouched. No new packages (`package.json`, `package-lock.json` unchanged by the branch); `three` is `"0.184.0"`, exact. `lint:gate` exit 0 at `c40e0c89` (Linux). The full Linux suite at `c40e0c89` (WSL, `TZ=UTC`, 8 workers, Node 20.20.2, under `flock /tmp/pd-suite.lock`): **6,637 files, 27,387 rows, 27,298 pass, 0 fail, 89 skipped** — the same counts as the build's run at `950104b5`, so the 88 px change moved no row. The flags-on run is in §3.9.

---

## 4. The adversarial pass (BUILD_RULES §2)

Six refuters, each handed one or more findings with the claim, the anchors and the mutant text, and told to refute with a concrete repro. Three worked on their own LF `git archive` trees of `c40e0c89` (node_modules junctioned to the parent checkout), read-only on git and the shared worktree; three were read-only throughout.

| Finding | Refuter's method | Verdict | What changed in the finding |
|---|---|---|---|
| SR-1 (rate call line) | RV-B applied in `snap-1`; 128 files, 4,807 rows (every CommandCenter test, config, theme guards, the non-engine AgentForm tests, `deskHonesty`); the 4 reds were 5 s walk timeouts that pass alone, identical on the pristine tree; grep of every test that names `hubFormRate` or `HubAgentForm.jsx` | **CONFIRMED**, claim narrowed | Four behavioural rows pin the rate's value and RV-B passes them only because jsdom reports the host's core count (`< 999` reddens them; a 2-vCPU CI runner would fail RV-B). The fix became a device-token ban on the `ShadowCanvas.contract` precedent; a call-line pin alone is evadable. |
| SR-2 (terminal imports) | RV-A applied in `snap-2`; 159 files, 4,330 rows (all of the above plus every guard, census and boundary test under `src/` and `api/`); 9 reds were load timeouts green alone or the known Windows path-separator rows, identical unmutated; `graph()` and every `importsOf` caller read | **CONFIRMED** | A terminal's imports are never read by any row; the only exact-import pins name other modules. The fix became a single-module `importsOf` pin in the mount guard (precedent `:900`); a blanket terminal walk would be unsound. |
| SR-3 (pure marks) | RV-P and RV-P2 applied together in `snap-3`; 193 files, 5,111 rows (all of the above plus every battleView test and every `src/` test named guard, bundle, chunk or identity); 10 reds were walk timeouts green alone or the Windows path rows; grep for `__PURE__` in tests (none); the two leaks reproduced with an in-memory Rollup on Windows | **CONFIRMED**, fix replaced | My scan row was evadable (`let`/assignment, destructuring, an inner-only mark) and over-broad (the folded `lazy()` ternary; `AGENT_FORM_COPY`, which Rollup drops by its own knowledge). The fix became a one-second Rollup test row over the flag-off-reached modules. |
| SR-4 (real-time wait) | Both files read and run alone three times and under two loads (a 150-file 8-worker run; an oversubscribed 20-worker run with 20 CPU burners); the wait instrumented in a scratch copy; the proposed fix tried in a scratch copy against a mutant slot | **REFUTED as a risk**, recorded | Worst observed first-row time 0.5 s against a red at 3.2 s or more with a clock step; the build's one red was the original 100 ms budget, not load. The fix is sound for the first file; the failure file's `vi.resetModules()` leaves only the bounded poll. Dropped to a note. |
| SR-5 (header overlap) | The overlaps recomputed from both measurement files for every width and pair; the harness's fidelity checked against `ArenaHeader.jsx` (inline px, no media query), `useIsDesktop` (`>= 768`) and the screen's wrapper (no side padding); 312 px shown reachable (no minimum width; iOS page zoom; a Fold's cover) | **CONFIRMED in its numbers; its "zoom-only" qualifier REFUTED** | The harness page (the build's and this review's) loaded only `tokens.css`, so headless Edge laid the scores out in Times New Roman; the app's stack (`index.css:54`) renders Segoe UI or SF Pro, whose gated two-decimal scores are 12–14 px wider. Re-measured with the app's stack: the CPU score overlaps the centre column by 14.8 / 10.8 / 1.3 px at 312 / 320 / 339 with long gated scores, and the phone header's growth is 0 rather than 5 (§3.6). SR-5 raised from note to should-fix before the battle flag turns on. |
| SR-6 (clearance comment) | `AVATAR_CLEARANCE_PX`'s four uses, `TAP_MIN`, `SHEET_PEEK_PX` and the mark's measured boxes | **CONFIRMED** | The same stale `48 + 14` sits in `AgentBattleScreen.pane.jsdom.test.jsx:291,298`. |
| SR-7 (the mood's clock) | The form sites' gates traced to `paneOn` and the controller flag; the cron's lock-clearing sites listed | **REFUTED as a hazard** | With the controller off there are no forms to read the frozen clock; the coupling is structural. Kept as a comment-line residual (`evaluationInFlight` with a non-finite `nowMs`), not counted. |
| SR-8 (field order) | Every writer of `archetype` under `api/`, the tournament projection, the League surfaces, every mount caller, and the change-archetype rider | **CONFIRMED** (hypothetical) | The rider refuses a change during an active battle, so a future mirror could only diverge after completion. A nit. |
| SR-9 (swap while paused) | `animates`, `swap`, `startTween`, `kick`, `frame`, `setOptions` and `frameSpec` traced; the lifecycle suite's pause rows read; `overlayOpen`'s sources read | **CONFIRMED** | The window is wider than the ceremony: `overlayOpen` also covers the due-idea screen, which can stay open; it still takes another tab or device to change the archetype meanwhile. |
| SR-10 (one-shot outcome promise) | `React.lazy`'s memoisation, Vite's `preloadError` handling (none in the repo), the browser module map's treatment of a failed fetch | **CONFIRMED; the proposed retry REFUTED** | A re-import of a failed module URL rejects without a network attempt, so only a reload recovers, as for the slot's own chunk. No fix proposed. |
| SR-11, SR-12 | Not handed out: the smoke branch's table value and a path citation are facts checked by `git show` and `grep` in this session. | — | — |

Ten findings handed out: seven CONFIRMED (three with their claim narrowed or their fix replaced), one CONFIRMED in its numbers with its qualifier refuted and raised after a re-measurement (SR-5), two REFUTED as hazards and recorded (SR-4, SR-7). The refuters worked on three LF `git archive` trees of `c40e0c89` under the session scratchpad (`snap-1`, `snap-2`, `snap-3`, `node_modules` junctioned to the parent checkout) or read-only; none wrote to git or the shared worktree.

---

## 5. Carry into S2

1. **Fix the three guard rows before merge** (SR-1 to SR-3): the device-token ban in the R6d row; the `importsOf` pin for the flag module in the mount guard; the Rollup test row over the flag-off-reached modules. The warmed, bounded lazy-form wait (SR-4) is optional hygiene.
2. **Rebuild the smoke branch on the 88 px head** before any further dial reading (SR-11), and ask for the `60 s:` line a third time with it.
3. **Gated scores under 360 px** (SR-5, before the battle flag turns on): let the score column shrink before the figure; the player's side already overlaps on `main`, more. Re-measure with the app's stylesheet loaded, on the phone.
4. **The mood's clock** (SR-7): give the forms a clock that ticks whether or not the cockpit controller is on.
5. **The battle surface reads the snapshot first** (SR-8), as the Film Room header does.
6. **The clipped sets** (§11.8): Trend Follower and the Diversifier at the design's framing, a design decision.
7. **The response brighten and "brighten by area"** (ruling 5), before `AGENT_FORM_HUB_ENABLED` turns on for players.
8. **League battles**: the dock's `surface === 'league'` path still draws the robot head from `youSeatArch(model)`; the League CPUs carry an archetype (`tournamentCpu.js:70`) and could wear it.
9. **Corners to decide, not bugs:** a swap under the ceremony's pause (SR-9); the one-shot outcome module (SR-10); the mark's clearance comment (SR-6).
10. **The citation** (SR-12); and the report's §4 and §11.3 overlap lines rest on a serif measurement — in the app's font the player's score meets the centre column from 360 px down on `main` and the CPU's from 339 px down with the flags on (§3.6).

---

## 6. Commits and artifacts

On `claude/agent-form-s1`:
- `c40e0c89` — "founder ruling: desktop arena form 88 px": `battleAgentFormSlot.jsx`, `ArenaHeader.jsx` (comment), `battleAgentForm.sites.render.test.jsx`, and the report's §11 numbers.
- the commit after it (the branch head this session reports) — this review, the founder-result fill (the report's §8 and §11.10) and the font caveat in the report's §11.3.

Not committed (this session's scratchpad): the WSL step script (`rv.sh`), the mask and mutant runners and their specs, the harness (the figures session's `arena.jsx` with the measurement runners `run-sites.mjs`, `run-pane-mark.mjs`), the measurement JSON (`sites-new-off.json`, `sites-new-on.json`, `pm-new-on.json`) and the Linux builds under `~/rv-builds`. The WSL worktree `~/pd-ci-rv` (node_modules → `~/pd-ci-af1`) can be removed with `unlink ~/pd-ci-rv/node_modules` then `git -C ~/pd-ci worktree remove --force ~/pd-ci-rv`. A copy of this review is at `C:/Users/fashr/Documents/FantasyTrades/AgentForm/20261029_REVIEW_AGENT_FORM_S1.md` (BUILD_RULES §3).
