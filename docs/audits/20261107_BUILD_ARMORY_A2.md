# Build A2 — Per-game loadouts (build report)

**Date:** 2026-11-07 (built Nov 6–7). **Branch:** `claude/armory-a2` (a draft PR), cut from `main` @ `7969c350` (contains PR #1024's merge, Armory A1).
**Flags on the PR:** `PER_GAME_LOADOUT_ENABLED = false` (new, `src/config/perGameLoadoutFlags.js`), `AGENT_FORM_ARMORY_ENABLED = false` (unchanged).
**Smoke:** `claude/armory-a2-smoke` @ `06e5ff02`, one SMOKE ONLY commit, both flags on. Preview: https://trade-seven-dl38v18bk-fais-projects-bc179554.vercel.app/?loadoutStates=1
**Diff:** 4,625 code and test lines against `main` (65 files: +4,495 / −130), plus this report and 18 screenshots. That is about three times the 1,500-line threshold: **this PR goes to a review session before merge.**
**Fence:** untouched. `decide.js`, `agentBattleService.js` and `createAgentBattle` have no diff; the end-to-end row runs them as they are.
**Review and fix pass (Nov 7):** the review (`docs/audits/20261107_REVIEW_ARMORY_A2.md`) said MERGE AFTER FIXES. The fix pass applied its three should-fixes and the founder's Q1, Q3 and A2R-3 (b) rulings, and merged `main` @ `d503dd07`. Every check is green: flag-off identity 0 of 55, the full suite, the rules suite, 8 of 8 mutants (§17). The founder's phone check passed (§14). **Founder action after merge: deploy `firestore.rules` in the Console, before the flip.**

---

## §0 Founder rulings

| # | Ruling |
|---|---|
| D1 | **Loadouts are per game.** Two kinds: **BaggerBomb** (deployed from the Command Center, on the casual clone) and **League** (ranked; training pods wear it). They may run at the same time in different archetypes. |
| FD-1 | **A change applies to the next deploy.** A BaggerBomb loadout can change at any time, even while a BaggerBomb game runs; the running game keeps what it deployed with. |
| FD-2 | **The League loadout is the ranked agent record's own fields** (`archetype`, `equippedWatchlistId`, `equippedWatchlistName`). |
| FD-11 | **Those fields are also the default** for any game with no choice of its own. |
| FD-3 | **A League loadout is frozen from registration until the player's ranked group completes** (or expires or is voided). The archetype and the book lock together. It changes only between weeks. This closes Phase 0's R1: no overnight change under Monday's board and draft. |
| FD-4 | **Training reads the League loadout.** `LoadoutChooserSheet` and its two mounts go, and `lobby-quickplay-training`'s `loadoutSpec` becomes the League loadout. |
| FD-10 | The Forge strategy stays on the agent and rides into both games. |
| N1 | **Shadow outside a game is always bare** (built in A1). No surface wears a loadout's archetype on a figure, except game seats, the loadout cards' stills and the armory's preview. |
| Boards | Build boards 1–5 as drawn, with these founder adjustments (A1 report §14): <br>• board 6's premise and decisions #8, #16 and #17 are dropped (N1; no League lobby figure);<br>• decision #6 is reversed: **a loadout with no book reads "No book · open market" and Deploy keeps working**;<br>• the "record facts · later" slot is **not rendered** (A4 fills that space later; leave no dashed pill on screen). |
| A1 carry | AR-5: pass the opener through `LoadoutSheets` → `Armory` → `HubSheet` (the History sheet is the template). AR-6: below 315 CSS px of viewport, the phone ring becomes a 3 × 2 grid of the same stills under the hero, inside the hero's box. Re-measure the phone close (AR-1) with the real loadout cards below the hero. |

**The founder's rulings of Nov 7, 2026** (after the review, `docs/audits/20261107_REVIEW_ARMORY_A2.md`; built in the fix pass, §17):

| # | Ruling |
|---|---|
| Q1 | **Deny `loadouts` on agent create.** It joins the create rule's `hasAny` list (`firestore.rules:283-286`), with a row in the denied-birth table of `test/rules/masteryDenials.rules.mjs`. The founder deploys the rules in the Firebase Console after merge, before the flip. |
| Q3 | **New lock wording:** "Locked until the week is scored, after the close on {day date}." The date is date only ("Fri Nov 6", a date-only `formatLockDay`). It carries through the cards, the League lines, the armory's context and Equip, and the server's `league_locked` message; the eight pinned strings move (review A2R-7). |
| A2R-3 (b) | **With per-game loadouts on, a BaggerBomb deploy never falls back to the ranked agent.** When `ensure-casual-clone` fails, the deploy is refused with an honest retry line ("Couldn't start the BaggerBomb game · try again") and the strip's existing Retry; the fallback telemetry (`markCloneFallback`) is kept. The fallback game would wear the League loadout (breaking D1) and put a battle on the ranked record, which blocks that player's League deploy the next morning. **With the flag off, the fallback stays exactly as today.** |
| Q2, R1–R4, R6–R11, Q8, Q9 | Accepted as built (the review's §0). R5 is carried to A3. |

Where each one lives:

| # | Built in | Proved by |
|---|---|---|
| D1 | the slot `agents/{rankedId}.loadouts.baggerbomb` (§2); the casual clone wears it, the ranked record stays League's | e2e row (§8): one week, BaggerBomb `degen`, League `contrarian` |
| FD-1 | BaggerBomb writes touch only the slot, with no battle lock and no League lock (§3); the clone takes it at the next deploy's resync; GUARD 1 unchanged | writer rows; `casualClone.perGame` GUARD 1 row; e2e step 4 |
| FD-2 / FD-11 | `leagueLoadoutOf` = the ranked fields; with no slot BaggerBomb wears them (`baggerbombLoadoutOf … isDefault`) | `src/constants/perGameLoadout.test.js`; "no slot yet" card row |
| FD-3 | the derived lock (§4), read inside the League writers' transactions and by the client | lock rows per status; e2e step 4; M3, M4, M10, M10b |
| FD-4 | training clones ignore `loadoutSpecByUser`; the lobby endpoint ignores `loadoutSpec`; both lobby mounts of the chooser render nothing; the Training tab carries "Training uses your League loadout" | `trainingClone.test.js`, `lobby-endpoints.test.js`, `LeagueLoadoutLine.jsdom.test.jsx`; M7, M7b |
| FD-10 | the Loadout tab's Forge line: "Your Forge strategy rides into both games." (no Forge data moves) | card rows |
| N1 | the hub hero's read stays the bare read (`armoryHeroRead`); the only dressed figures are 48/40 px stills and the armory's preview | N1 row (every live form bare); M12 |
| Boards | §6 | §6 rows and screenshots |
| A1 carry | §7 | AR-5 row, AR-6 row + 300 px measurement, AR-1 re-measured in headless Edge |

---

## §1 What the PR holds

| Commit | What |
|---|---|
| `2d1cfdb0` | server: the flag, the slot, the three writers by `loadout`, the League lock, the clone's resync and trait seed, training, R3 and R4, and their rows |
| `32df11b5` | client: boards 1–5 behind both flags |
| `6d08fbf8` | the League lines load through a folded `lazy()` slot (flag-off bundle identity: a static import moved hub modules between chunks) |
| `85ececdc` | the model's module constants are plain literals (flag-off bundle identity: a `PURE` initializer that read another binding's property survived tree-shaking) |
| `72eb4073` | the shared pieces out of the hub, every guard registered, the surface rows |
| `66cbaeab` | two rows the mutation check asked for (M10c, M11 survived the first pass) |
| `fb256283` | the League line and its slot under the token and motion guards |
| `a0ffb53e` | this report's draft and its 18 screenshots |
| `406b1a63` | the composition protected-store allowlist: A2's three BaggerBomb slot writes, **for human review** (§11) |
| `ab79a9e6` | the no-book Deploy row cleans up its card when it fails |
| (the last commit) | this report, final |
| fix pass | the review's fixes and the Nov 7 rulings: §17.1 |

`LoadoutChooserSheet.jsx` itself stays in the tree: with the flag off both lobbies still mount it (flag-off identity). With the flag on its two mounts render nothing. Delete the file in the flip PR's cleanup.

---

## §2 The data

```
agents/{rankedId}.loadouts.baggerbomb = {
  archetype: 'degen',                                   // an archetype code id
  book: { ref: { watchlistId: 'wl-…' } | null,          // null = "No book · open market"
          name: 'Energy Movers' | null,                 // the name it was set with
          pin: null },                                  // always null in A2
}
```

- **League** is the ranked record's existing `archetype`, `equippedWatchlistId`, `equippedWatchlistName` (FD-2). No new League field.
- **Default (FD-11).** With no slot, BaggerBomb wears the League fields. `baggerbombSlotOf` reads a slot defensively (no archetype → treated as absent).
- **Materialize on first write.** The first loadout write of either kind writes the slot from the ranked fields *as they were before the write*, in the same transaction (`materializeOnLeagueWrite`, `baggerbombSlotWith`). After that, a League change never moves BaggerBomb (M1 shows the rows that catch it).
- **The clone** (`casual-agent-{uid}`) never holds a slot; a loadout write aimed at a clone is refused `409 not_ranked_agent`.
- **No client write is added.** `firestore.rules`: the client's agent `update` allowlist is `directives`, `lastViewedEvolutionCycle`, `starterKitCompleted`, `updatedAt`, so no client can write `loadouts` on an existing agent. **One gap, see Q1:** the agent `create` rule does not deny a `loadouts` key.

---

## §3 The writers

All three take `loadout: 'baggerbomb' | 'league'` in the body; absent means `'league'` (today's behaviour); anything else is `400 invalid_loadout` before any read. With the flag off the field is ignored and every path is today's (rows in `perGameLoadout.writers.flagOff.test.js`).

| Endpoint | `loadout: 'baggerbomb'` | `loadout: 'league'` (or absent) |
|---|---|---|
| `POST /api/agent/change-archetype` `{ agentId, archetype, loadout }` | writes `loadouts.baggerbomb.archetype` only (slot snapshotted first if absent). No battle lock, no League lock. Same composition legality check as today. Idempotent → 200, no write, no log. Shadow log carries `loadout`. Ranked archetype, traits and `settingsRev` untouched. → `200 { agentId, archetype, idempotent, loadout: 'baggerbomb' }` | as today (archetype + born-with traits in one transaction, dial revalidation), plus: slot snapshotted first; **refused while the League lock holds** → `409`; refused while the ranked record has an active battle → `409 battle_active` (today's) |
| `POST /api/agent/equip-watchlist` `{ agentId, watchlistId, loadout }` | writes `loadouts.baggerbomb.book` only; the same list checks as today (committed, owned); no locks; same list again → no-op | as today, under the League lock; slot snapshotted first |
| `POST /api/agent/unequip-watchlist` `{ agentId, loadout }` | `book: { ref: null, name: null, pin: null }` on the slot ("No book · open market"); no locks | as today, under the League lock; slot snapshotted first |

The lock refusal (typed, names the lock and its end):

```json
409 {
  "error": "league_locked",
  "message": "The League loadout is locked until the week is scored, after the close on Fri Nov 6. It changes between weeks.",
  "lock": { "kind": "league_week", "groupId": "grp-…", "status": "battle", "endsAt": "2026-11-06T21:00:00.000Z" }
}
```

(The message follows ruling Q3 since the fix pass, §17; with no readable end it reads "The League loadout is locked until the week is scored. It changes between weeks.")

The client's thin writers are `src/services/loadoutService.js` (`changeLoadoutArchetype`, `equipLoadoutBook`, `unequipLoadoutBook`, `isLeagueLock`), a module of their own so nothing the flag-off build ships changes.

---

## §4 The League lock (FD-3)

**Rule.** Locked while the player has a ranked group in `forming`, `drafting`, `awaiting_open` or `battle`: the existing `selectMyGroup` allowlist, which already excludes training pods (`isTraining`). `complete`, `expired` and `voided` do not lock. One function, `leagueLockOf(groupDocs)` in `src/constants/perGameLoadout.js`, is the rule for both sides.

**Query.** `tournamentGroups where groupMembers array-contains <uid>`.
- **Server:** `readLeagueLockInTx(tx, db, uid)` runs it with `tx.get(query)` in the read phase of each League write's transaction: the lock is read in the transaction, so a group already written is seen consistently with the agent read. (Reworded in the fix pass, review A2R-2: this section first said a racing registration "is serialized with" the write, which overstated it. The race FD-3 closes, a League write after the board and the draft, is covered because the group then already exists in `forming` or `drafting`. Rows now pin that the query goes through the transaction, §17.)
- **Client:** `src/services/leagueLockService.js` `subscribeLeagueLock` runs the same query with one `onSnapshot` and judges it with the same `leagueLockOf`. It is the same query `tournamentGroupService.subscribeMyGroup` already runs.
- **Index:** none needed. A single-field `array-contains` uses Firestore's automatic index; no composite; `firestore.indexes.json` unchanged.
- **Rules:** `tournamentGroups` already allows authenticated reads; no change.

**The week's end** (what the line shows): the market close of the 5th trading day (`WEEK_DAYS_REQUIRED`) from the pod's first battle day, from `marketCalendar`. The first battle day comes from the pod's own fields, in order: `startAnchor.anchorEtDate`, `dailyScores.day1.recordedDate`, `battleStartWeek.anchorEtDate`, else the formation instant through a read-side twin of `deriveBattleStartWeek` (rows hold the twin and the writer in agreement across a calendar of instants). Shown in ET, date only, since ruling Q3: "Locked until the week is scored, after the close on Fri Nov 6." (A2 showed "Fri Nov 6, 4:00 PM"; the lock opens when the group turns complete, after that close.) If no anchor is readable the lock still holds and the line names no date ("Locked until the week is scored.").

**Training pods** never lock it (their clone copies the loadout once at provisioning). Rows for every status, a training pod in each status, and the in-transaction read.

---

## §5 The readers

- **Casual clone** (`api/_utils/casualClone.js`). Both builders (`buildCasualCloneDoc` at creation, `buildCasualCloneResync` at each deploy) apply the BaggerBomb loadout over the inherited fields: the slot's archetype and book, or the default. When the slot's archetype differs from the ranked record's, `seedBaggerbombTraits` seeds that archetype's born-with traits on the clone, as the training override does, and retires the parent's trait docs on the clone; going back to the parent's archetype takes the parent's traits back. The seed is a write phase, so the lease is re-checked after it. **GUARD 1 unchanged:** a clone mid-battle is never resynced (row + e2e step 4).
- **Character-settings validation** (Phase 0 §3.2): a row confirms the battle snapshot judges the clone's leans against the clone's archetype (the slot's), not the parent's.
- **Training** (`trainingClone.js`, `lobby-quickplay-training.js`): the clone copies the League loadout with no override; `loadoutSpecByUser` is not read (a pod written before the flip included), and the endpoint ignores `loadoutSpec`, valid or not, rather than refusing an old client.
- **League board production and the daily deploy:** unchanged; they read the ranked record, which FD-3 now holds still for the week.
- **R3** (`src/adapters/baggerbombAdapter.js`): with the flag on, the battle's own `agentContext.archetype` wins and the live agent is only the fallback.
- **R4, the plays ledger** (`api/_utils/filmRoom/cardStore.js`, `api/film-room/card.js`). **The Film Room arc owns this file; A2 changes only the predicate, behind the flag:** an entry is active when either loadout wears its archetype (`loadoutArchetypesOf`) and shelved otherwise; a card is refused only when its tape day's archetype differs from that battle's own `agentContext.archetype` (passed in by `card.js`).

---

## §6 The surfaces

All behind `PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED`. Words: `src/constants/loadoutCopy.js` (`LOADOUT_COPY`), a hub copy guard table. Names: `hub/archetypeLines.js` only. Screenshots are from two places: the **real hub** (both flags on, the A1 review's headless-Edge harness, network seams stubbed, the League week Nov 2–6) and the smoke's **`?loadoutStates=1`** page.

### Board 1 — the Loadout tab's two cards

BaggerBomb first, League second; stacked on the phone, side by side on desktop. Each card: the set as a 48 px still, the book (name and count of names), one tag, a door on each half (the whole 60 px row, chevron). States: Next deploy · Game running (a strip in the armor it deployed with) · Locked (lock glyphs; the armor row still opens the armory to look; the book row is no door) · Open · No book · open market · Checking (until the lock read answers, or if it fails: never claims open). Lines: "Locked until the week is scored, after the close on Fri Nov 6." (ruling Q3; A2 read "Locked until the week ends · Fri Nov 6, 4:00 PM. Set when you registered.") / "Locked while a game is running." (the fix pass, A2R-3 (a): a game on the ranked record) / "Open until you register for next week. It locks then." / "The next deploy wears this." The "record facts · later" slot is not rendered. Under the cards: "Your Forge strategy rides into both games. Change in the Forge".

| 390 open | 390 locked | 320 open | 320 locked |
|---|---|---|---|
| ![](assets/armory-a2-hub-phone-390-loadout-open.png) | ![](assets/armory-a2-hub-phone-390-loadout-locked.png) | ![](assets/armory-a2-hub-phone-320-loadout-open.png) | ![](assets/armory-a2-hub-phone-320-loadout-locked.png) |

*The screenshots in this section were taken at the A2 build and show A2's lock words with the time ("… · Fri Nov 6, 4:00 PM"); the fix pass changed the words (ruling Q3, §17) and did not re-shoot them.*

Desktop (1440): ![](assets/armory-a2-hub-desktop-loadout-open.png) ![](assets/armory-a2-hub-desktop-loadout-locked.png)

Every state on fixtures (running, no book, checking included): ![](assets/armory-a2-states-390.png) ![](assets/armory-a2-states-320.png) ![](assets/armory-a2-states-desktop.png)

### Board 2 — the Deploy card's line

"Next deploy carries" with the 40 px still, the set, the book and its count; a running game splits it ("Running now" in the game's armor, then what the next deploy carries); no book reads "Speculator · No book · open market" and the Hold is untouched (row: a ready deploy with a live wiring holds with and without a book; M11). Its door goes to the BaggerBomb card. Visible at the top of the phone Loadout tab shots above and in the desktop shots' Deploy card.

### Board 3 — the League lobby's lines

- **League tab:** "Your League loadout", the still, set · book, and the lock state. Open: a door (to the Command Center, Q8). Locked: "Locked until the week is scored, after the close on Fri Nov 6" (ruling Q3), nothing tappable. Checking (since the fix pass, A2R-1): until the lobby's group read answers, and after a failed read, "Checking your League week" and no door.
- **Training tab:** "Training uses your League loadout", set · book, "Change it on the League tab, between weeks." No door. The Customize loadout button and its sheet are gone (phone and desktop).
- No lobby figure (N1); the S2 climb preview's seats are untouched.
- Loaded through a folded `lazy()` slot (`leagueLoadoutSlot.jsx`) so the League's main-graph files import nothing from the hub chunk.

Shown on the states page (section 3 of each `armory-a2-states-*.png`).

### Board 4 — the armory with a loadout context

Opened from a card's armor row with that loadout's context. Context line: "Choosing armor for BaggerBomb · applies to the next deploy"; "Choosing armor for League · open · locks when you register"; locked: "Choosing armor for League · locked until the week is scored, after the close on Fri Nov 6" (ruling Q3). Equip: "Equip Trend Follower for BaggerBomb" / "… for League", calling the writer with that `loadout`. Locked: previews work, Equip is "Locked until the week is scored" ("Locked while a game is running" for a game on the ranked record) and does nothing; a lock the server reports (the card raced it) shows the lock line with the server's end. Footnote: BaggerBomb "Applies to the next deploy · a game already running keeps the armor it deployed with."; League the lock or open line.

**The copy guard move (recorded as the brief asks):** A1's `/next deploy/` ban stays on `ARMORY_COPY` (still A1's words while per-game loadouts are off). With A2 the phrase is true for BaggerBomb only, so `hubCopy.guard.test.js` now allows "next deploy" in exactly the BaggerBomb strings of `LOADOUT_COPY` and in no League string, and FD-1's exact pin moved to the BaggerBomb footnote; a row plants a League "next deploy" and the guard catches it.

| phone 390, BaggerBomb | phone 390, League locked | phone 320, BaggerBomb | phone 320, League locked |
|---|---|---|---|
| ![](assets/armory-a2-hub-phone-390-armory-baggerbomb.png) | ![](assets/armory-a2-hub-phone-390-armory-league-locked.png) | ![](assets/armory-a2-hub-phone-320-armory-baggerbomb.png) | ![](assets/armory-a2-hub-phone-320-armory-league-locked.png) |

Desktop: ![](assets/armory-a2-hub-desktop-armory-baggerbomb.png) ![](assets/armory-a2-hub-desktop-armory-league-locked.png)

**The book door:** today's watchlist sheet, titled "Choose a book for BaggerBomb" (or League), its book selected, "No book · open market" as the first row, writing through `loadout`. ![](assets/armory-a2-hub-phone-390-book-baggerbomb.png) ![](assets/armory-a2-hub-phone-320-book-baggerbomb.png)

### Board 5 — the flow on the phone

Tap a card's armor row → the hub's scroll box brings the hero into view (measured: `scrollTop` 478 → 8 at 390, 631 → 16 at 320) → the armory opens in the hero's box with the card's context → preview → Equip writes that loadout, closes, the card updates, the hero is bare again (N1) and the armor comes off in view (AR-1, §7).

---

## §7 A1 carries

- **AR-5:** `LoadoutSheets` passes `{ opener, fallbackFocus }` through `ArmorySheetContext` to `Armory` → `HubSheet`, as the History sheet does. Row: closing gives focus back to the card row that opened it.
- **AR-6:** under 315 px of hub width the six sets sit in a 3 × 2 grid under the hero, inside its box (`PHONE_ARMORY_GRID`). Row at 310; measured at 300 in headless Edge: six options at x 70–230, two rows (y 235, 291), all inside the 300 px viewport. ![](assets/armory-a2-hub-phone-300-armory-grid.png)
- **AR-1 re-measured with the real cards below the hero** (real hub, headless Edge, d3d11, opened from the BaggerBomb card's armor row after scrolling to it):

| Viewport · close by | hub `scrollTop` open → 700 ms after close | hero box after close | in view | focus after close | frames drawn in the 600 ms unequip |
|---|---|---|---|---|---|
| 390 · Close | 8 → 8 | 67–317 | yes | "Change BaggerBomb armor" (the row) | 37 |
| 390 · Escape | 8 → 8 | 67–317 | yes | the row | 37 |
| 390 · Equip | 8 → 8 | 67–317 | yes | the row | 37 |
| 390 · tab switch | 8 → 29 | 46–296 | yes | a button (the tab that was clicked) | 35 |
| 320 · Close | 16 → 16 | 67–312 | yes | the row | 37 |
| 320 · Equip | 16 → 16 | 67–312 | yes | the row | 37 |
| 390 · League (locked) Close | 8 → 8 | 67–317 | yes | "League armor, locked. Open the armory to look." | 37 |

The hero never leaves the viewport and the 700 ms unequip draws. Focus lands on the row without scrolling to it (`preventScroll`), so after a close the player is at the hero and the card they tapped sits below (off-screen at 320; Q9).

---

## §8 Rows

264 rows in the 13 files that carry A2 (the targeted set the mutants ran), of which these files are new: `perGameLoadout.e2e` (1), `perGameLoadout.writers` (23), `perGameLoadout.writers.flagOff` (6), `casualClone.perGame` (9), `api/_utils/perGameLoadout` (11), `src/constants/perGameLoadout` (24), `cardStore.perGame` (6), `CommandCenterHub.loadouts.jsdom` (27), `LeagueLoadoutLine.jsdom` (8), `perGameLoadoutModel` (15), `perGameLoadoutFlags` (pins and reads). A2 rows were added to `trainingClone.test.js`, `lobby-endpoints.test.js`, `baggerbombAdapter.test.js`, and the guard files (§11).

The brief's list, each covered: materialization (either kind's first write snapshots BaggerBomb first); each writer by `loadout`, flag on and off; the lock in forming, drafting, awaiting_open, battle, complete, expired, voided (the rule), the writers refusing forming/drafting/battle and admitting complete/expired/voided, and a training pod never locking; a BaggerBomb change during a running game reaching only the next deploy; the resync applying the slot, the default and the trait seed; training reading the League loadout; R3; R4; every card and line state in jsdom (the cards and the Deploy line on the phone at 320, 360 and 390, and on desktop), and every state in real layout at 390, 320 and 1440 (the screenshots in §6); the armory context, its lock line and its Equip; the no-book line with Deploy live; AR-5, AR-6.

**End to end** (`api/agent/perGameLoadout.e2e.test.js`, through the pilot's deploy harness with the real writers, the real casual-clone provisioning and the real fenced `decide.js` / `createAgentBattle`, the model mocked):
1. BaggerBomb set to the Speculator and League to the Contrarian through `change-archetype` with `loadout`: the ranked record is `contrarian`, the slot `degen`.
2. A casual game deploys: the clone is `degen`; `agentContext.archetype` is `degen` with the slot's book.
3. A League deploy that week: `agentContext.archetype` is `contrarian`.
4. A League equip mid-week: `409 league_locked`, `lock.endsAt 2026-11-06T21:00:00.000Z`, nothing written. A BaggerBomb book equip mid-game: 200, on the slot; the running clone and its battle keep the old book (GUARD 1); after the game, the next deploy's battle carries the new book and still `degen`; the ranked record still `contrarian` with its own book.

---

## §9 Mutation table

Each mutant: one edit on a clean head worktree in WSL, the 13 A2 files run (8 workers, `TZ=UTC`), killed = nonzero exit, restored from `git show HEAD:path`. Control (unmutated) exit 0, 264 rows.

| # | Mutant (the brief's wording) | Edit | Result | Rows that caught it |
|---|---|---|---|---|
| M1 | the slot not materialized (a League change moves BaggerBomb) | `materializeOnLeagueWrite` returns `{}` | killed, 5 rows | the League writers' "slot snapshotted from the PRE-change fields first" (×4: absent, explicit, equip, unequip) |
| M2 | the BaggerBomb write landing on the ranked fields | BaggerBomb `tx.update(agentRef, { archetype })` | killed, 3 | "writes the slot's archetype only…", "no battle lock and no League lock", "a later change keeps the slot's book" |
| M3 | the League lock ignored | `readLeagueLockInTx` answers unlocked | killed, 8 | e2e; refused-while-locked; forming/drafting/battle rows |
| M4 | the lock computed from training pods | training pods fed to `selectMyGroup` as ranked | killed, 4 | "a training pod in flight does not lock it" (writer, in-tx read, rule, League line) |
| M5 | the resync ignoring the slot | `buildCasualCloneResync` returns the inherited fields | killed, 7 | e2e; builder rows; resync row |
| M6 | the trait seed skipped | `seedBaggerbombTraits` returns `{}` | killed, 3 | resync seed; return to the parent's traits; creation seed |
| M7 | training using the old override | `trainingClone` reads `loadoutSpecByUser` again | killed, 1 | "a pod's loadoutSpecByUser (one written before the flip included) is not read" |
| M7b | (same, the endpoint) | the lobby validates `loadoutSpec` again | killed, 2 | "a valid loadoutSpec is ignored…", "an invalid loadoutSpec … is ignored too" |
| M8 | R3 reversed | the adapter prefers the live agent | killed, 1 | "A2 (R3) … the battle's own snapshot wins" |
| M9 | R4's predicate back on the ranked record | `shelf: archetype` | killed, 2 | "a BaggerBomb card and a League card are both active…", "a BaggerBomb card can be retired while League wears another" |
| M10 | a League equip allowed while locked (archetype) | `if (false && lock.locked)` in `change-archetype` | killed, 4 | refused-while-locked; forming/drafting/battle |
| M10b | (same, book) | same in `equip-watchlist` | killed, 2 | e2e step 4; "league: as today, refused while the week holds it" |
| M10c | (same, the armory's Equip) | the equip hook's `card.locked` gate removed | **survived the first pass** (the locked button is disabled, so no click reaches the hook); **killed** after `66cbaeab`, 1 | "the equip itself refuses a locked League card, whatever calls it" |
| M11 | the no-book state blocking Deploy | Deploy card `canStart` also requires a BaggerBomb book | **survived the first pass** (that suite's hub has no deploy provider, so its Hold was disabled either way); **killed** after `66cbaeab` | "no book never stops the Deploy card's Hold…". At `66cbaeab` two later rows failed too, only because the failing row left its card mounted; `ab79a9e6` registers the mount for cleanup, and the re-run is in the last line of this table |
| M12 | a figure wearing an archetype outside a game (N1) | the hero's read = `readers.agent` (dressed) | killed, 1 | "every live form is bare (the hero); every dressed form is a still" |
| M13 | the context line naming the wrong game | BaggerBomb context says League | killed, 3 | the hub's BaggerBomb armory row; the model's two context rows |

16 of 16 killed. Re-run on the final code (`ab79a9e6`): control exit 0 (264 rows); M10c fails exactly "the equip itself refuses a locked League card…"; M11 fails exactly "no book never stops the Deploy card's Hold…" (no cascade).

---

## §10 Flag-off proofs

- **Client, byte identity.** Unminified Linux builds (`vite build --minify false`), hashes masked, `main` @ `7969c350` against the head: **0 differing lines, 55 of 55 files**, measured at `2d1cfdb0`, `85ececdc`, `72eb4073` and `406b1a63`, and on the pushed head (§12). Two causes found and fixed on the way (commits `6d08fbf8`, `85ececdc`): a static League → hub import moved modules between chunks (3,021 lines), and module-level initializers that read another binding's property survived tree-shaking (5 lines).
- **Client, bundle rows** (`agentForm.flagOffBundle.test.js`): the flag module is rewritten false like the agent form flags; each A2 module imported and unused bundles to nothing; the shipped hub files that read the flag bundle with nothing of A2; three plants (the loadout context without its `PURE` mark, the League line declared without its flags, a model constant reading another binding's property) each fail it.
- **Server.** `perGameLoadout.writers.flagOff.test.js` runs `change-archetype`, `equip-watchlist`, `unequip-watchlist` with `loadout: 'baggerbomb'` and the flag off: today's ranked writes, today's battle lock, no slot, no lock read. The getter-mocked rows in `trainingClone`, `lobby-endpoints`, `baggerbombAdapter`, `casualClone` and `cardStore` run the flag-off arm against today's expectations, and the existing suites for every changed file run unchanged with the flag at its pinned `false`.
- **The pin.** `perGameLoadoutFlags.test.js` pins `false`, keeps the module a literal outside `featureFlags`, requires the armory flag whenever this one is on, lists every server and client read by line, and fails on any other reader. `flagPinGuard` registers the module; `DARK_BY_DESIGN` names it.

---

## §11 Guards

Registered (none loosened):
- **Token guard:** the 6 hub files, `LoadoutStill.jsx`, `LeagueLoadoutLine.jsx`, `leagueLoadoutSlot.jsx` (zero counts).
- **Motion guard:** the 6 hub files and the 2 League files, each with a zero count and an authority. `LoadoutStill.jsx` is not in the motion guard, as no `AgentForm/` file is (the engine's equip motion is the stated exception). Plants: a core-palette hex and a `transition={{ }}` in each League file fail both guards.
- **Mount guard:** five permitted terminals (the flag, the model, the copy table, the two services); `LoadoutStill.jsx` added to the agent form wrapper list.
- **Activity guard:** `hub/useLeagueLoadoutLock.js` allowed one effect that starts the owner's one subscription (call-by-call rows, and plants that change its list).
- **Copy guard:** `loadoutCopy.js` is a copy table; the "next deploy" move (§6, board 4).
- **flagPinGuard**, **flag-off bundle row**: §10.

- **Composition protected-store scan (B3, full suite only):** it found the three BaggerBomb slot writers as new write sites on `agents/{id}`. Each key is now in `compositionProtectedStoresAllowlist.json` at count 1 with a `_notes_per_game_loadouts_a2` entry. **The guard asks a human to review these writers in this PR; this is for the review session.** What they are: one `tx.update` each, inside the endpoint's one transaction, after the agent read, the write-epoch fence, the owner check and the ranked-record check (plus the composition legality check for an archetype, the committed-and-owned check for a book), writing only `loadouts.baggerbomb` and `updatedAt`. They skip `txUpdateAgentSettings` on purpose: they change no ranked setting and take no battle lock (FD-1).

**Allowances added, named:** the three B3 keys above; `ALLOWED_ACTIVITY['hub/useLeagueLoadoutLock.js'] = [subscribe…(, useEffect]`; `NAMED['/services/loadoutService'] = [changeLoadoutArchetype, equipLoadoutBook, isLeagueLock, unequipLoadoutBook]`; `NAMED['/services/leagueLockService'] = [subscribeLeagueLock]`; the three importer lines (`Armory.jsx`, `LoadoutBookSheet.jsx` → `loadoutService`; `useLeagueLoadoutLock.js` → `leagueLockService`); `"next deploy"` allowed in BaggerBomb strings of `LOADOUT_COPY` only.

---

## §12 Checks

The last code commit is `ab79a9e6`; the pushed head adds only this report's final text on top of it.

- **Full Linux suite** (WSL, `flock /tmp/pd-suite.lock`, `TZ=UTC`, 8 workers) on `ab79a9e6`: **exit 0, 1,313 files, 28,978 rows, 0 failed, 89 skipped, 253 s.** The rows that fail only on Windows on this machine pass here.
  - The first full run, on `fb256283`, failed one row: the composition protected-store scan (B3) found the three BaggerBomb slot writers unlisted (§11). Fixed in `406b1a63` (suite then exit 0, 28,978 rows, 245 s), and `ab79a9e6` is a one-row test cleanup on top.
- **`lint:gate`**: exit 0 on `fb256283` and `406b1a63`; on `ab79a9e6`: exit 0.
- **On the pushed head itself:** flag-off byte identity against `main`: **0 differing lines, 55 of 55 files**; minified build: **exit 0**; the files that read `docs/` (the hub copy guard, the flag pin guard, the archetype registry, the situation registry and questions, the routing wall, the composition runbook gates and A7 lock, the tf-setup guard, the voice-grounding harness, the insight-reset script, the JEV judge): **12 files, 371 rows, exit 0**.
- Smoke (`06e5ff02`, the same tree as the local `49186a1a`, a message change only): minified build in WSL exit 0 (with placeholder Firebase values, for the local screenshots); Vercel built it with the real ones. Its preview serves the smoke bundle (`LoadoutStatesSmoke-*.js` in the main bundle) and, loaded in headless Edge at 390, renders 11 cards in every state, both League lines, the Training line and the three armory contexts, no page errors.

---

## §13 The smoke branch

`claude/armory-a2-smoke` @ `06e5ff02`, parent `72eb4073`. The PR commits after `72eb4073` (`66cbaeab`, `fb256283`, `a0ffb53e`, `406b1a63`, `ab79a9e6` and the final report) change tests, guard baselines, the B3 allowlist and docs only; the app code the preview runs is the PR's. One commit, "SMOKE ONLY, NEVER MERGE": both flags `true`, the hub hero's corner readout (A1's), and `src/screens/LoadoutStatesSmoke.jsx` at `?loadoutStates=1`: the real cards, Deploy lines, League and Training lines and armory context in every state on fixture data (the League week is Nov 2–6, so the lock reads "Fri Nov 6, 4:00 PM"), then a full-width phone frame of the hub's own pieces (the hero's stage, the cards) for board 5's flow. Nothing on the page writes. The pins and guards are red on that branch by design.

**Preview:** https://trade-seven-dl38v18bk-fais-projects-bc179554.vercel.app/?loadoutStates=1 (the Command Center itself is at the same address without the query, signed in).

---

## §14 iPhone checklist (on the smoke preview)

1. **Loadout tab:** sign in, open the Command Center, tap Loadout. You see two cards: BaggerBomb on top, League under it. Each has a small figure in its armor, the set's name, and the book.
2. **Set them to different archetypes:** tap the BaggerBomb card's armor row, pick one set, tap "Equip … for BaggerBomb". Then the League card, a different set. Each card changes alone. The big Command Center figure stays bare after each one closes.
3. **Deploy a casual game:** hold Deploy. Open the game: Shadow plays in the BaggerBomb armor, not the League one.
4. **Change BaggerBomb while that game runs:** back on the Loadout tab, change BaggerBomb's armor. The running game keeps the armor it started with; the card shows the game running in its old armor and says the next deploy wears the new one.
5. **`?loadoutStates=1`:** open the preview link above. Scroll: the League card locked (with the date) and open, the League tab's line locked and open, the Training tab's line, and a BaggerBomb card with no book that still says Deploy works.
6. **The armory from each card:** from each card's armor row, the line above the figure names the game ("Choosing armor for BaggerBomb", "… for League"). On the states page's phone frame the League card is locked: its armory lets you try sets, and its Equip button says "Locked until the week ends" and does nothing.

### The founder's result (Nov 7, 2026)

**Passed.** In the founder's words: the smoke test "passed on all levels. The designs look great."

(The review session had not received it; its §9 records the check as pending, and the fix pass's brief carried the result.)

---

## §15 Founder questions and readings

Questions (each needs a yes/no or a pick):

- **Q1. Close a rules gap before the flip?** The agent *create* rule doesn't deny a `loadouts` key, so a hand-made sign-up request could start an agent with a BaggerBomb slot already set (any archetype string, any list id, even another player's list). Updates are already closed, and nothing reads the slot while the flag is off. Recommended: add `'loadouts'` to the create rule's denied keys (one line, plus a rules row) in the flip PR, deployed with the usual manual Console step. Do it then, or now in this PR?
- **Q2. "From registration".** The lock reads ranked groups from `forming` on. If a player can be signed up for next week before any group document names them (a lobby seat or a pending slot that has not formed a group), they are not locked in that window. Is "registration" the moment a group names them (as built), or earlier?
- **Q3. The lock's date vs. when it opens.** The line names the 5th trading day's close (Fri 4:00 PM ET), but the lock opens when the group turns complete, which is later that evening. Between the two the card still says "Locked until the week ends · Fri Nov 6, 4:00 PM". Keep, or say "opens after the week is scored"?

Readings (built this way; say if any is wrong):

- **R1.** A holiday week's lock ends at the 5th trading day's close, which can be the next Monday.
- **R2.** A BaggerBomb change doesn't bump the ranked record's `settingsRev` (that counts League settings); the clone takes it at the next deploy.
- **R3.** Training pods formed before the flip with a chooser override: after the flip their clones wear the League loadout (the old override is not read).
- **R4.** The armory keeps A1's "Equipped" label for the loadout's own set (not a new "Worn now").
- **R5.** The Film Room card list still shows the ranked archetype as the record's archetype; only the active/shelved predicate reads both loadouts.
- **R6.** A card for a day taped under a set neither loadout now wears can be filed and is shelved at once.
- **R7.** Apart from the archetype, the book and the seeded traits, the clone keeps inheriting the ranked record's fields (`equippedAt`, `archetypeDrift`, `personality`, colours, rules, strategy), as the training override did: `equippedAt` is the League book's time even when the clone's book is the slot's.
- **Q8 (reading).** The League tab's door (open week) goes to the Command Center's Loadout tab, not straight to the League card.
- **Q9 (reading).** After the phone armory closes, the player is at the hero (where it opened) and the card they tapped is below, off-screen at 320; focus is on its row. A scroll back down after the unequip would be a new motion; not built.
- **R10.** At 1440 × 900 the desktop armory's two-line context makes the dialog about 14 px taller than A1's one-line description; it scrolls inside as A1's already did at that height.
- **R11.** The desktop area keeps its name, "Equipped Archetype", over the two cards.

---

## §16 Not in A2, and the flip

Not in A2: per-archetype saves (A3), record facts (A4), a book picker redesign (today's watchlist sheet with a context), the Deploy button's own rules.

**The flip PR's checklist** (updated by the fix pass, §17):

1. **The Console rules deploy comes first.** This PR carries Q1's line (`'loadouts'` in the agent create rule's `hasAny` list, `firestore.rules:286`). After this PR merges, the founder deploys `firestore.rules` in the Firebase Console, before the flip PR merges. Until then, a hand-made sign-up request can still start an agent with a slot (nothing reads it while the flag is off).
2. **Both flags `true`, each with its pins, in one commit** (BUILD_RULES §2):
   - `PER_GAME_LOADOUT_ENABLED` (`src/config/perGameLoadoutFlags.js`): move the pin in `perGameLoadoutFlags.test.js` to `true` and drop its `DARK_BY_DESIGN` entry in `flagPinGuard.test.js`.
   - `AGENT_FORM_ARMORY_ENABLED` (`src/config/agentFormFlags.js`): move its pin rows in `agentFormFlags.test.js` the same way, with its `DARK_BY_DESIGN` entry.
   - The flag-on rows that hold either flag on by mock stay as they are.
3. **Delete `LoadoutChooserSheet.jsx` and the flag-off arms.** The arms are the literal ternaries listed in `perGameLoadoutFlags.test.js` `CLIENT_READS`. They include the fix pass's arms: both lobbies' `subscribeMyGroup` arm, their `seatKnown` arm, the phone lobby's bare `lobby` arm and the desktop lobby's duplicated `<DeskLobby>` arm. Then shrink the read list to what remains. `agentDeploy.js`'s refusal stays (with the flag gone it is unconditional); its two `console.warn` lines that say "deploying the real agent" should then say the deploy is refused.
4. **Refresh the flag-off bundle rows** in `agentForm.flagOffBundle.test.js` that become flag-on rows.
5. **Know what stays outside it:** the BaggerBomb refusal protects only while `CASUAL_CLONE_CONCURRENCY_ENABLED` is on (it is, `featureFlags.js:237`). With it off, every BaggerBomb deploy is a ranked-record deploy in the League loadout, so that flag must not be turned off while per-game loadouts are on. A2R-4 (an abandoned ranked pre-battle group holds the lock forever) is a separate League-lifecycle task (§17).

---

## §17 Review fixes (the fix pass, Nov 7, 2026)

**Brief:** the founder's fix-pass brief of Nov 7, 2026. **Spec:** the review, `docs/audits/20261107_REVIEW_ARMORY_A2.md` (verdict MERGE AFTER FIXES; A2R-1 to A2R-10, §1.3, §6, §7). **Session:** Claude Opus 5.5, worktree branch `claude/armory-a2-review-fixes-a4be88`, pushed by refspec to `claude/armory-a2`. `git fetch origin` first. The PR head was `2f8b4978` as the brief required. **Both flags stay `false`.** The fence is untouched: `decide.js`, `agentBattleService.js` and `createAgentBattle` have no diff; the e2e rows run them as they are.

### Verdict

| Item | Result |
|---|---|
| A2R-1 (the League line claimed Open before it knew) | **Fixed.** Checking, with no door, until the lobby's group read answers, and after a failed read. 12 new lobby rows plus the line's own. |
| A2R-2 (the in-transaction lock read was unpinned) | **Fixed.** The fixture records reads made through the transaction; five League writer rows (seven assertions), one unit row and one e2e row pin it. Mutant R1 is now **killed**. §4 reworded. |
| A2R-3 (a) (the League card did not see a game on the ranked record) | **Fixed.** `activeBattleId` locks League, undated, in A1's words; the week lock wins when both hold. |
| A2R-3 (b) (founder ruling: never fall back to the ranked agent) | **Built as ruled**, behind `PER_GAME_LOADOUT_ENABLED`. Flag off, the fallback is unchanged (its row passes, its telemetry is pinned). |
| Q1 (deny `loadouts` on agent create) | **Built:** one rules line, two denied-birth rows. Rules suite green on Linux: 32 files, 631 rows; the mutant that drops the line fails both new rows. **Founder action: deploy the rules in the Console after merge, before the flip.** |
| Q3 (the lock words) | **Built:** "Locked until the week is scored, after the close on Fri Nov 6." with a date-only formatter, everywhere a lock is shown, the server's message included. The eight pins moved. |
| `main` merged | `d503dd07` (the activation observer flip), clean merge, no conflict. |
| Flag-off identity | **0 of 55 non-map files differ** (raw `diff -rq` of unminified Linux builds, maps excluded) against `d503dd07`. Minified build exit 0. |
| Full Linux suite | **exit 0** on `636b7181`: 1,314 files (1,306 passed, 8 skipped), 29,003 rows (28,914 passed, 89 skipped, 0 failed), 335 s. Rules suite 32 files, 631 rows, exit 0. |
| `lint:gate` | exit 0 |
| Mutation check | **8 of 8 killed** (the brief's seven, the failed-read mutant made in each lobby); controls green (161 rows; rules 631). |

### 17.1 Commits

| Commit | What |
|---|---|
| `a3ecb897` | Q1: `firestore.rules` and the denied-birth rows |
| `dbd3b20f` | A2R-1, A2R-2, A2R-3 (a) and (b), Q3: the code and its rows |
| `f2380897` | merge of `origin/main` @ `d503dd07` |
| `322a1726` | A2R-9 carried into the `COMPILER_ENABLED` and mastery flip notes (comments only) |
| `636b7181` | the armory flag's read census lists the lobbies' new reads (the first full suite caught it) |
| (the last commit) | this report and the review's withdrawn sentences |

### 17.2 The fixes

**A2R-1, the League line never claims Open before it knows.**
- The line takes `groupKnown`, a boolean (`LeagueLoadoutLine.jsx:50-69`). Anything but `true` is Checking. The line then shows "Checking your League week" (`LOADOUT_COPY.lines.checking`), a neutral dot, `aria-busy`, and no door, whatever group it is handed.
  - The line has no tag, so `tags.checking` ("Checking") has nowhere to go. The sentence carries the state.
- The lobbies' readiness reaches the slot through `LeagueGroupKnownContext` (`leagueLoadoutSlot.jsx:26-37`), read with `use()` in the slot. A new prop on `LobbyTabbed` or `DeskLobby` would have changed the flag-off bytes; a context provided in a folded ternary does not.
  - The phone lobby wraps its existing `lobby` element (`LeagueHome.jsx:174`).
  - The desktop lobby's return is duplicated inside the ternary (`LeagueLobbyDesktop.jsx:359-402`); the flip PR deletes the flag-off arm.
  - **The context's default is `false`** (fail closed): a mount with no provider shows Checking. The one such mount is `BackingPreviewScreen.jsx:725` (a design-preview screen), which would show Checking there with both flags on. A forgotten provider can never bring back the bug.
- **A failed read is told apart from "no group".** Under the flags, both lobbies read the group through `subscribeMyGroupOrFailure` (`tournamentGroupService.js:237`). That function is `subscribeMyGroup`'s query and selection with an `onError`; `subscribeMyGroup` itself is unchanged.
  - On an error the lobby sets `activeGroup` to null (as today) and records the failure in its existing `seatFor` state as `{ failedFor: uid }` (`LeagueHome.jsx:106`, `LeagueLobbyDesktop.jsx:299`). No new state hook: a new hook would change the flag-off bytes.
  - `groupKnown = !uid || seatFor === uid`, so a failure stays Checking for good.
  - `seatKnown`, which gates the Backing strip, counts the failure as known (`LeagueHome.jsx:155`, `LeagueLobbyDesktop.jsx:356`). The rest of the lobby therefore behaves exactly as today on a failed read; a row pins the strip mounting.
- **Rows** (`LeagueLoadoutLine.lobbies.jsdom.test.jsx`, new, 12 rows; `LeagueLoadoutLine.jsdom.test.jsx`, updated):
  - kept: `group={null}` with `groupKnown` → Open, with the door;
  - added: `groupKnown={false}` → Checking (with a null group and with a locking group);
  - added: no `groupKnown` at all, and `LobbyTabbed` with no provider → Checking;
  - in each real lobby, phone and desktop, the group read driven by hand:
    - it reads through the failure-aware read, never `subscribeMyGroup`;
    - before the first answer → Checking, no door; "no group" → Open with the door; a ranked group → Locked with the Q3 words;
    - **a failed read → Checking for good**, and the strip mounts as today;
    - a failure after an answer → back to Checking;
  - `LobbyTabbed` under a provider that says known: the group decides.

**A2R-2, the transactional lock read is pinned.**
- `loadoutWriterDb.js` records every read made through the transaction (`tx.get`, `tx.getAll`) as `state.txReads` (`:90-93`); the groups query carries its own description (`__query`, `:71`).
- Each League writer row asserts `LOCK_READ_IN_TX` in `txReads`: `change-archetype` admitted (absent and explicit `loadout`) and refused, `equip-watchlist` refused and admitted, `unequip-watchlist` refused and admitted (`perGameLoadout.writers.test.js:139`, `:157`, `:217`, `:224`, `:243`, `:249`). That pins that all three writers hand the live transaction to the helper.
- The unit stub's query now has a `.get()` that throws "the lock was read outside the transaction" (`api/_utils/perGameLoadout.test.js:36-42`), as a real Admin query has a `.get()`.
- **The refuter's e2e row** (`perGameLoadout.e2e.test.js:162`):
  - a finished group, `tournamentGroups/grp-old` (`complete`), in the player's history;
  - the double's `afterTxBody` collects `readPaths`;
  - an admitted League `change-archetype`;
  - expects `agents/agent-p1b-1` and `tournamentGroups/grp-old` among the paths.
- **§4 reworded:** "read in the transaction, so a group already written is seen consistently with the agent read". The review's own unverified "phantom" sentences (§1.3 and A2R-2) are marked withdrawn in the review file; nothing here carries them.

**A2R-3 (a), the League card sees a game on the ranked record.**
- In `deriveLoadoutCards` (`perGameLoadoutModel.js:62-68`), a non-empty `agent.activeBattleId` makes League LOCKED with `when: null` and `lockKind: 'battle'`.
- The battle lock has its own words, A1's (`LOADOUT_COPY`): "Locked while a game is running." on the card, "locked while a game is running" in the armory's context, "Locked while a game is running" on Equip, and "Try sets on; nothing changes until the game ends." under it.
- **Precedence:** the week lock, then the battle lock, then Checking, then Open.
  - The writers read the week lock before `battle_active`, so during a normal League game the card keeps its dated line (a row pins it).
  - A game on the ranked record locks League even while the week read is checking or failed: the server refuses either way.
- BaggerBomb is never locked by it.
- Rows: the model's two rows (open, checking and failed week reads each with a game; both locks at once), and the hub row (`CommandCenterHub.loadouts.jsdom.test.jsx`: a game on the ranked record, no ranked group: League Locked with the battle line, BaggerBomb still Next deploy, the armory's context, its Equip label and footnote, and the equip refused).
- **`changeAdjustments` stays on `unlocked` (`useHubRuntime.js:179`), on purpose.** Its two neighbours moved to `ready` because the per-game cards now carry their own lock states; the Adjustments (Character settings) are part of neither loadout. They ride both games, like the Forge strategy (FD-10), and no card carries their lock. Today's gate is `lockedInGame`, which with the casual clones on is exactly `Boolean(agent.activeBattleId)` (`commandCenterLiveBattles.js:166`, `selectors/loadout.js:136`). After (a) it agrees with the League card: both lock on the same fact. So the review's inconsistency (Adjustments locked while League said Open) is gone, and A2 does not change the Adjustments' gate.

**A2R-3 (b), the founder's ruling: no fallback to the ranked agent.**
- `agentDeploy.js:228`: `if (PER_GAME_LOADOUT_ENABLED && cloneId === null) return { outcome: REFUSED, success: false, postIssued: false, error: 'casual_clone_unavailable', details: LOADOUT_COPY.deployCloneFailed }`. It runs after the clone ensure and the ownership check, before any POST.
  - The ensure's non-ok answer and its thrown fetch both still call `markCloneFallback` first (the telemetry is kept).
  - The line is "Couldn’t start the BaggerBomb game · try again". The strip reads a REFUSED result as a refusal with its line and its existing **Retry** (`attemptVocabulary.js` `refused()` and `displayForAttempt`); with `postIssued: false` it imposes no cooldown.
- A literal `if` on the flag: with the flag off its test folds to `false` and Rollup drops the statement (the identity build proves it). The flag-off fallback is today's: `ceremonyDeployTarget.test.jsx` "fallback: clone ensure fails → target stays the RANKED agent" passes and now also pins its telemetry.
- Rows (`ceremonyDeployTarget.test.jsx`, the flag as a getter): with the flag on, a non-ok answer and a thrown fetch each refuse before any POST (`decide` never called, the target reported once), with the line, `markCloneFallback` called with `http_500` / `threw`, and the strip's and the ceremony's translations a refusal with that line; a clone that resolves deploys the clone as before.
- **Not changed (flag-off bytes):** the two `console.warn` texts still say "deploying the real agent" on the refused path. The flip PR fixes the words (§16).
- **Outside the ruling, recorded:** the refusal only matters while `CASUAL_CLONE_CONCURRENCY_ENABLED` is on (it is). With it off, every BaggerBomb deploy is a ranked-record deploy (§16).

**Q1:** `'loadouts'` joins the create rule's `hasAny` list (`firestore.rules:286`). The denied-birth table gains two rows (`masteryDenials.rules.mjs`): a BaggerBomb slot naming another player's list, and an empty `loadouts` map. Updates were already closed (the review's §1.7).

**Q3:**
- `formatLockDay` / `formatLockDayIso` (`src/constants/perGameLoadout.js:221-231`) give "Fri Nov 6", in ET.
- The time formatter `formatLockEnd` is removed (it had no other reader).
- The server's `leagueLockedBody` formats the same day (`api/_utils/perGameLoadout.js:54-59`).
- The eight pins moved, and rows were added for the formatter (including an instant after midnight UTC that is still Friday in New York) and for the server's dated and undated messages.

### 17.3 Recorded, not fixed here

- **A2R-4, for separate tasking (a League-lifecycle task for the founder):** an abandoned ranked pre-battle group holds the lock forever. The only writer of `expired` is the training sweep (`expireStaleTrainingPods`, training-only by construction), and `voided` is reachable from `battle` only. A ranked group that forms and never advances stays `forming`. That already blocks a second registration through `selectMyGroup`, and with A2 it also freezes the League loadout, with a line dated to a week that has passed (or undated).
- **A2R-8, accepted:** the resync's soft-delete scans the clone's whole `rules` collection on every deploy.
- **A2R-9, carried:** noted at the two flags' own flip instructions. `COMPILER_ENABLED`'s doc block (`src/config/featureFlags.js`): check a clone deploy compiles against the clone's archetype. `MASTERY_ENFORCEMENT_ENABLED`'s pre-flip list (`api/_utils/masteryConfig.js`): decide whether a BaggerBomb archetype change revalidates the tempo dial.
- **A2R-10, applied:** flag-off identity is cited from now on as the raw `diff -rq` of the two unminified dists, maps excluded (§17.5).

### 17.4 Mutation table

Each mutant is one edit on the mutant tree `~/pd-ci-a2fxx` at `636b7181`. The named files run (`TZ=UTC`, 6 workers); killed means a nonzero exit. The edited file is then restored from `git show HEAD:path` and the tree confirmed clean after each run. **Control (unmutated):** the union of the files, 10 files, 161 rows, exit 0. **Rules control:** `npm run test:rules`, 32 files, 631 rows, exit 0.

| # | Mutant (the brief's wording) | Edit | Files run | Result | Rows that caught it |
|---|---|---|---|---|---|
| R1 | the lock read leaves the transaction | `tx.get(query)` → `query.get()` when the query has one (`api/_utils/perGameLoadout.js:34`) | the six lock files, 85 rows | **killed**, 8 rows (it **survived** the review) | the unit row and the training-pod row (the stub's `.get()` refuses); the e2e A2R-2 row; the League writer rows: change-archetype absent and explicit, refused while locked; equip and unequip league |
| F1 | the League line treating `groupKnown=false` as open | `const checking = false` (`LeagueLoadoutLine.jsx:54`) | the two line files, 20 rows | **killed**, 8 rows | `groupKnown={false}` → Checking; no `groupKnown` fails closed; in both lobbies: before the first answer, a failed read, a failure after an answer |
| F2a | a failed group read reading as open (phone) | the error arm sets `seatFor(uid)` (`LeagueHome.jsx:106`) | the two line files, 20 rows | **killed**, 2 rows | the phone lobby's "a failed read: Checking for good" and "a failure after an answer" |
| F2b | a failed group read reading as open (desktop) | the same (`LeagueLobbyDesktop.jsx:299`) | the two line files, 20 rows | **killed**, 2 rows | the desktop lobby's same two rows |
| F3 | the League card ignoring `activeBattleId` | `const battleLocked = false` (`perGameLoadoutModel.js:66`) | the model and the hub file, 45 rows | **killed**, 2 rows | the model's A2R-3 (a) row; the hub's A2R-3 (a) row |
| F4 | the fallback deploying the ranked agent with the flag on | the refusal's test `PER_GAME_LOADOUT_ENABLED && …` → `false && …` (`agentDeploy.js:228`) | `ceremonyDeployTarget`, 28 rows | **killed**, 2 rows | flag on: "a non-ok answer: refused…" and "a thrown fetch: refused…" |
| F5 | the fallback refusing with the flag off | the refusal without the flag (`agentDeploy.js:228`) | `ceremonyDeployTarget`, 28 rows | **killed**, 1 row | "fallback: clone ensure fails → target stays the RANKED agent (§7.3)" (`ceremonyDeployTarget.test.jsx:118`'s row) |
| F6 | `loadouts` allowed on create, in the rules suite | `'loadouts'` dropped from the `hasAny` list (`firestore.rules:286`) | `npm run test:rules`, 32 files, 631 rows | **killed**, 2 rows | `masteryDenials.rules.mjs`: "CREATE with a per-game loadouts map … is DENIED", "CREATE with an empty loadouts map is DENIED" |

**8 of 8 killed.** F2 is reported per lobby (the brief's one mutant, made in each place it lives).

### 17.5 Checks, on the merged tree

- **`main` merged:** `d503dd07df76ddfb1931935111d158c944f720ae` (PR #1028's merge: the activation observer flip). A clean merge; the one file both sides touched, `src/config/flagPinGuard.test.js`, merged without a conflict. Nothing in it touches this PR's logic.
- **Flag-off identity (A2R-10's method):**
  - Unminified Linux builds (`vite build --minify false`, WSL, Node 20.20.2, lockfile `40382e64edb6` on both) of `main` @ `d503dd07` and the code head `636b7181`, 107 files each.
  - The raw `diff -rq` of the two dists with source maps excluded: **0 of 55 non-map files differ**, content hashes in the names included. The same held at the first fix commit's merge (`f2380897`) on the first build.
  - Of the 49 differing maps, 47 differ only by the tree's directory name. 2 (`CommandCenterHub-CIfDFKLB.js.map`, `index-ok8k4FzL.js.map`) also differ in `sourcesContent`, because the source text changed while the emitted code did not (`vite.config.js` sets `sourcemap: true`), as at the review.
- **Minified build:** `vite build` of `636b7181`, exit 0, 107 files.
- **Flag-off server behaviour, unchanged for every touched path:**
  - `api/_utils/perGameLoadout.js`'s message is built only inside the writers' `if (PER_GAME_LOADOUT_ENABLED && code === LEAGUE_LOCKED)`; the server's read list in `perGameLoadoutFlags.test.js` is unchanged and passes.
  - `perGameLoadout.writers.flagOff.test.js` passes: with the flag off the three writers do today's ranked writes, take today's battle lock, store no slot and read no lock.
  - `masteryConfig.js` changed in comments only.
  - `firestore.rules`'s Q1 line is not flag-gated, by the ruling: it denies a key nothing writes today.
  - On the client: `agentDeploy.js`'s flag-off fallback is pinned by its row, with its telemetry; the lobbies' flag-off arms are today's text (the bundle proves it).
- **`lint:gate`:** exit 0 on `322a1726` (`636b7181` adds a test-file change only, which the full suite's census row covers).
- **Full Linux suite** (WSL, `flock /tmp/pd-suite.lock`, `TZ=UTC`, 8 workers) on `636b7181`: **exit 0, 1,314 files (1,306 passed, 8 skipped), 29,003 rows (28,914 passed, 89 skipped, 0 failed), 335 s.**
  - The first run, on `f2380897`, failed two rows in `src/config/agentFormFlags.test.js`: the armory flag's read census, which did not list the lobbies' new reads. Fixed in `636b7181`.
  - (The same two rows were also red in a Windows targeted run, hidden among the known Windows-only path and CRLF failures. Linux is the record.)
- **Firestore rules suite** (the emulator, WSL, JDK 21, `npm run test:rules`) on `636b7181`: **exit 0, 32 files, 631 rows, all passed**, the two new denied-birth rows included.

### 17.6 Readings for the founder (built this way; say if any is wrong)

- **Q3's other strings.** The ruling gives the dated line; these follow it:
  - the undated line "Locked until the week is scored.";
  - the League lobby's line "Locked until the week is scored, after the close on Fri Nov 6" (no period, a mono label);
  - the armory's context "locked until the week is scored, after the close on Fri Nov 6";
  - Equip "Locked until the week is scored", with "After the close on Fri Nov 6. Try sets on; nothing changes until then." under it;
  - the server's message "The League loadout is locked until the week is scored, after the close on Fri Nov 6. It changes between weeks."
  - A2's "Set when you registered." is dropped from the dated and undated lines.
- **The battle lock's words** are A1's: "Locked while a game is running." (no date: the game's end is not the week's).
- **The refusal's line** uses a typographic apostrophe ("Couldn’t"), as the hub's other copy does.
- **The League lobby with no provider** reads Checking (the context's default is `false`).

### 17.7 What ran, where

- Windows worktree `C:\Users\fashr\portfolio-duel\.claude\worktrees\armory-a2-review-fixes-a4be88`, branch `claude/armory-a2-review-fixes-a4be88`, reset to `2f8b4978` at the start and pushed by refspec to `claude/armory-a2`.
- WSL: `~/pd-ci-a2fx` (the suites), `~/pd-ci-a2fxm` (`main` @ `d503dd07`, the identity base) and `~/pd-ci-a2fxx` (builds, mutants, rules). All were detached worktrees of `~/pd-ci` with `node_modules` linked to `~/pd-af0` (lockfile `40382e64edb6`), and runs went under `~/pd-a2fx-runs`. They were removed after the final checks, with the review's leftovers (`~/pd-ci-a2r`, `~/pd-ci-a2rm`, `~/pd-ci-a2rx`, `~/pd-a2r-runs`), under the suite lock; the session's closing message gives the space freed.
- Scripts in the session scratchpad (not committed): the setup, step, identity, maps, mutant and cleanup runners.
