# Phase A3 handover — the Battle View character pane, A3.0 → A3.5 (V1)

**Date:** September 4, 2026
**Branch:** `claude/character-pane-phase-a3-rulings-rq17ta`
**Base:** `8e63ea65` = `origin/main`, the merge of PR #815 (`flip/battle-view-controller`)
**Status:** A3.0 → A3.5 built, reviewed, fixed, pushed. **STOPPED for the founder's smoke**, as the rulings §7 direct. A3.6 (event motion, D-97) is the next session.
**Companion record:** `docs/audits/20260904_BATTLE_VIEW_CHARACTER_PANE_PHASE_A3_BUILD_REVIEW.md` — read that one for the review's own findings.

> ### ⚠ CORRECTION OF RECORD — appended September 4, 2026 (evening)
>
> **Two rows of §1's verdict table below are WRONG as written, and the next
> session's review found them.** They are left in place rather than edited, so
> the error and its correction both stand:
>
> - **Row 4 ("No new archetype-table importer")** is false.
>   `CharacterPane.jsx:54` imports `getArchetypeDisplayName` from
>   `src/data/archetypeDisplay`, a legacy archetype table, and BUILD_RULES §1's
>   separate §2.3 gate required it to be recorded in
>   `api/_utils/archetypeImportBoundaryBaseline.json` in its own commit. It was
>   not. The branch was RED on `api/_utils/archetypeRegistry.test.js` from
>   `5ee4f86b` (A3.2) until `0705c073`.
> - **Row 6 ("4,196 pass, 2 skipped, 0 failing")** is a `src/`-only figure and
>   was reported as if it were the suite. The ratchet lives in `api/`, which is
>   why the red above was invisible for a whole session. The full suite is
>   10,673 tests.
>
> **The lesson, for whoever reads this next:** a scoped run is not a suite, and
> a verdict table must say which it is. Every claim about the tests from here on
> is a full-suite claim or it names its scope.
>
> Superseded in full by
> `docs/audits/20260904_BATTLE_VIEW_CHARACTER_PANE_A36_HANDOVER.md`.

---

## 1. Executive verdict

| # | Item | Verdict |
|---|---|---|
| 1 | The twelve rulings | **All twelve honoured.** Rulings 7–10 govern A3.6 and are recorded in D-97; nothing in this branch pre-empts them. |
| 2 | Flag-off (the shipped tabbed screen) | **Byte-identical.** Both goldens unchanged and passing. |
| 3 | Pane-off (the A2 controller render) | **Byte-identical**, against a NEW golden photographed from `8e63ea65` — and now also pinned in the scoped state, which the first paint cannot photograph. |
| 4 | Fence and ratchet | **No `api/` contact of any kind.** No new archetype-table importer. |
| 5 | Guards | Every new file on both theme and motion lists with baselines in its creating commit (hazard 34). |
| 6 | Tests | **4,196 pass, 2 skipped, 0 failing.** Explicit `vite build` exits 0. |
| 7 | Review (BUILD_RULES §2) | **Run in full, five lenses.** Eleven code defects — one a P0 that crashed the screen — and **twenty-seven surviving mutations**, each a row of mine that could not fail. All fixed, all re-mutated. See the review record. |
| 8 | What is not settled | Five copy / ruling questions, deliberately not decided here (§6). |

**The honest headline:** the build shipped a conditional hook that crashed the Battle View on every mount, including on the pane-off path; five of its domain selectors were wrong; and twenty-seven of its own test rows could not fail under the defects they named — including the seed's own "a timer alone does nothing" row and the row meant to prove the three doors work. Every one of those was found by the review, none by the instruments the build put in place. That is the argument for the review, not against the instruments: the sixteen kills the build DID claim all reproduce.

---

## 2. Preamble — git verification (BUILD_RULES §3)

| Item | Value |
|---|---|
| `git fetch origin` | Run first, at session start. `origin/main` did not move from `8e63ea65`. |
| Branch | `claude/character-pane-phase-a3-rulings-rq17ta`, checked out by the harness. **Discrepancy recorded:** the rulings name `claude/character-pane-phase-a3-s4krjn`. I stayed on the branch that was checked out and pushed only there. |
| HEAD at start | `8e63ea65`, clean tree, no commits of its own. |
| `node_modules` | Absent on arrival; `npm ci` run once. Tests are invoked as `./node_modules/.bin/vitest` — a bare `npx vitest` tries to fetch from the registry and hangs. |
| Two input gaps | The seed and the brief were not attached at first. The build stopped after the two docs commits and asked; both arrived and the build proceeded from them. **No work was done on a reconstruction.** |

---

## 3. The commits

| # | SHA | What |
|---|---|---|
| 1 | `ff3ab3c3` | docs: the Phase 0 report (the branch's first commit, D-58) |
| 2 | `a1fe5bab` | docs: ledger **D-91 → D-98** |
| 3 | `02dfd325` | docs: the design brief, which Phase 0 found on no branch |
| 4 | `8c82e604` | **the flag** — dark, nested on the controller |
| 5 | `710130a2` | **the golden** — controller-on / pane-off, captured at `8e63ea65` |
| 6 | `b171c537` | **A3.0** the arena header (D-96) |
| 7 | `5ff152a3` | **A3.1** the character and its one line (D-91, D-98) |
| 8 | `5ee4f86b` | **A3.2** the pane (D-91, D-93) |
| 9 | `7217084c` | **A3.3** Bench (D-92) |
| 10 | `e3215bef` | **A3.4** Tape (D-94) |
| 11 | `e17784e0` | **A3.5** the declutter (D-94, D-95) |
| 12 | `4b9a72fb` | review: the survivor probe's one finding, guarded |
| 13 | `2ec25844` | **review fixes** — eleven confirmed code findings |
| 14 | `a797fc6a` | docs: the build review record |
| 15 | `c4d14433` | docs: this handover |
| 16 | `76f6cd9a` | **review fixes, second pass** — the rows that could not fail |

---

## 4. Two deviations from the seed, both deliberate

**(a) The `···` overflow landed in A3.5, not A3.2.** The one thing it holds — `Report a bug` — arrives with A3.5's widget seam, so building the control in A3.2 would have shipped a button that opens an empty menu for two commits. `CharacterPane` takes an `overflow` slot from A3.2 and A3.5 fills it. End state identical.

**(b) Hazard 43's second half is structural, not a gated `AgentChat.jsx` change.** The ruled change would have been a **no-op**: the chat's kind eyebrow is only ever rendered on agent SPEECH and is already `text-muted`, which is what the speech rule assigns it; the stream's records are `TapeCards`, which owns `LABEL_COLOR`. Instead `TapeCards` exports its four eyebrow colours and `deriveBubble` imports them, so the two cannot disagree by construction rather than by two matching values. **This was the build's most load-bearing judgement call and was put to the review's fifth lens explicitly; it verified the premise and confirmed the mechanism.** D-98 has been corrected to describe what the code does.

---

## 5. The founder's smoke — how to see it

**There is no query override.** The controller's `?battleViewController=1` was deleted in the same commit that flipped it (flip, pin and override travel together), and this runway did not re-open that door. The smoke needs a preview branch with the flag lit — three lines, which are exactly what the eventual flip PR will contain:

1. `src/config/featureFlags.js` — `BATTLE_VIEW_CHARACTER_PANE_ENABLED = false` → `true`
2. `src/config/characterPaneFlags.test.js` — `expect(BATTLE_VIEW_CHARACTER_PANE_ENABLED).toBe(false)` → `toBe(true)`
3. `src/config/flagPinGuard.test.js` — drop the `BATTLE_VIEW_CHARACTER_PANE_ENABLED` entry from `DARK_BY_DESIGN`

All three move together or CI reds — the flag-pin guard enforces exactly that coupling, in both directions, and names each file in its failure message. **That branch was not created here:** BUILD_RULES §2 forbids creating branches mid-task, and the flip is its own one-line PR after the smoke.

### What to look at (the seed's §7 script)
1. **The arena header**, both shells: the teal side, the copper side, the seam, and the numbers readable before the chrome. The starfield should now show THROUGH the header.
2. **Desktop:** the pane opens WITH the board (the brief's resting working state). Tap CRM → `In the chat · n` → scoped. **Collapse** → the board takes the full width and the mark floats bottom-right. Wait for a check → a bubble appears once and sits still. Tap it → the conversation, count cleared. **Type half a message, collapse, expand — the draft must still be there** (that one was broken until the review).
3. **Mobile:** the board with the mark; tap → the pane over the dimmed board; close → back to the mark, **with focus on it**.
4. **Bench:** the names the check named with the decider's own sentences; the rest with `Not named at the …`; the watchlist's name as the subtitle.
5. **Tape:** trades as cards, no filters; no `Game Tape` in the header; no bug button on the board; `Report a bug` in the `···`.

**The one thing no test can settle:** whether the arena reads as the loudest thing on the page *and* still reads its numbers first (the brief's quality bar).

---

## 6. The five open questions — RULED (founder, September 4)

All five came back ruled the same day; three changed code, two are recorded.

| # | Question | Ruling | Where it landed |
|---|---|---|---|
| 1 | Is "today" day-blind across the surface family? | **A D-14 prerequisite — recorded, not built.** Under fullday it is unreachable. When 3-day battles are specced, the WHOLE family (Bench, the check cards, the book panel, the quiet-check runs) groups entries by ET calendar day and labels prior days. Bench keeps its scan-back. | The ledger's D-14 backlog row, beside the budget reset already scoped there; noted on D-92. |
| 2 | `Named at the last check` under the scan-back? | **The heading becomes `Named at the {t} check`** — the slot of the check actually used. One string. | `battleViewCopy.benchNamed` is now a function of the slot; the separate `At the {t} check` line beneath it is gone, so the section says "check" once. |
| 3 | The four unrequested strings? | **Accepted, all four.** | `No trades yet`, `Remove this bookmark`, `Show the activity log`, `Hide the activity log` stay as they are. |
| 4 | `Tap for the book` desktop-only? | **Sustained** (the mock). On mobile the header's accessible name carries the door. | No code change; a row now asserts the phone keeps the `Why? · the whole book` name, the role and the tab stop even without the visible hint. |
| 5 | Does `{n} new` count your own messages? | **Exclude them:** count the agent half of an exchange when a reply exists; the player's half never. | `paneUnread` filters the new tail by author. One reply landing while the pane sat on Bench read `2 new` for one event; it reads `1`. |

Each of the three code rulings is mutation-checked: reverting the heading to "the last check", restoring the second slot line, and counting the player's halves again each red their own row.

## 7. What is NOT built

**A3.6 (event motion, D-97) is the next session** — the bagger burst, the `BAGGER` tag, `Bagger hit · {mult}× banked`, `Bagger · {sym} hit {pct}`, and a trade card's arrival fade. Nothing pre-empts it: the row's badges are untouched and the two A3.6 strings are deliberately absent from copy.

**Three things the next session must know**, from the review's fifth lens:
- The pane is now hidden rather than unmounted on collapse, which is what makes a mount-keyed one-shot inside it safe. Before the fix, the ruled trade-card arrival fade would have replayed on every expand.
- `TradeCard` now renders in **two** places (the Chat stream and Tape), so one arrival must not fade twice.
- The bubble is a pure function of the recorded tape and shows only while the count is positive. `Bagger · {sym} hit {pct}` is not a tape entry and carries no unread count — it needs a second source keyed on the persisted crossing, seeded silently (the `useLandingKey` idiom). Nothing is in the way.

**From the mocks, superseded and confirmed absent:** the avatar's 420 ms brighten and badge pop; the `New` divider, `Today ·` header and `{sym} · n entries`; the dashed Assignments placeholder; the Chat tab's count pill; bench `%`; `Read · Equip`; the `Command Center` back label; the mock's seam arithmetic; the `+` sign and glow; lower-case `vs`.

---

## 8. Debts, for separate tasking (BUILD_RULES §3)

1. **`useSessionCompositeTrail.test.jsx` fails standalone** — `AssertionError: Target cannot be null or undefined` at `:239`. It reproduces in a worktree of `8e63ea65`, so it predates this branch; it passes inside some full runs, which points at ordering or a wall-clock dependence. **Not touched.** A task card is queued.
2. Phase 0 §8's four debts are unchanged: the local `THRESHOLDS` copy; `ChamberFuse.onThresholdCross` dead wiring; the presence face reading raw `statusFeed` on the duel surface (moot under the pane, where events are withheld); the watchlist chip's raw hex.
3. **`AgentChat.jsx:130` renders a raw `#5EEAD4`** for the directive card's eyebrow — the same value `--ft-teal` carries. `TapeCards.DIRECTIVE_EYEBROW_COLOR` names the token; re-pointing the literal is a flag-off change for a cleanup PR.
4. **The Game Tape's overlay and its door are not gated on `!paneOn`** — they are unreachable under the pane today only because no door renders, not by construction, and the overlay's `z-index: 30` sits under the pane's `40`. Recorded by the review's second lens as latent hygiene.
5. **The A3 rulings document is not committed.** The Phase A precedent (`docs/design/PHASE_A_RULINGS_AND_AMENDMENTS_V1.md`) suggests it should be; the rulings only instructed the BRIEF to be committed, so no uninstructed docs commit was made.
