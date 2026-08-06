# Member-Facing Voided Surfacing (L-A Follow-up B) — BUILD_RULES §2 Code Review

**Date:** 2026-08-06 · **Branch:** `claude/member-voided-surfacing` (off `origin/main` @ `d3409f07`) · **Scope:** 14 files (12 modified + 2 new) — a display-only change; no schema changes, no fenced-file edits.

**Why a §2 review:** the cumulative branch diff touches 14 files (> the 10-file threshold). Review method per §2: five independent adversarial reviewers along disjoint dimensions, each instructed to **find and self-refute**; every surviving finding handed to a separate reviewer instructed to **refute it with a concrete repro** (CONFIRMED only if it reproduces). Accompanied by an explicit `vite build` (green) and the **full vitest suite** (7008 passing). Mutation-checked: the arena suppression tests assert the placement/cut are ABSENT when voided AND PRESENT on the same data when not voided.

---

## Executive verdict

| Area | Result |
|---|---|
| **Fence (§1)** | **Intact** — no fenced file edited (all 14 files are `src/`; the void writer `voidGroup` in `api/_utils/tournamentGroupService.js` is non-fenced and was not touched). |
| **Inertness (the L-A census lock)** | **Holds** — `selectMyGroup` / `selectMyTrainingPod` / `selectBaseLayerField` byte-unchanged; the voided-card read is a SEPARATE selector; the `leagueTournament.test.js:1153` census lock stays green; a new complementarity test asserts a void never reaches an active consumer. |
| **§9 display-agreement** | **Holds** — the card reason is the single `voidReasonLabel(voidedReason)` projection; `VOIDED_NO_RESULT_COPY` is one shared constant for the top-strip + card; suppression removes number AND label together (no orphan scaffold). |
| **Change #2 (voided terminal panel)** | Placement/standings fully suppressed — **1 CONFIRMED leak FIXED** (leader emphasis on the hero board). |
| **Change #1 (member voided-card)** | Wiring sound — **1 CONFIRMED lifecycle bug FIXED** (durable auto-expiry). |
| **Flag-off / non-voided parity** | **Byte-identical** — every new branch is gated on `voided` (default false); the full suite (incl. the arena/climb non-voided smokes) stays green. |

**5 dimensions reviewed · 2 CONFIRMED (both medium, both FIXED in this pass) · 3 dimensions clean (empty).** No CONFIRMED finding was deferred.

---

## CONFIRMED → FIXED in this pass

### F1 · Leader emphasis still singled out the contaminated leader on the voided board (change-#2, MED)
The voided suppression gated the crown, the per-orb rank digit, the cut line + "TOP 2 ADVANCE", and the score numbers — and routed voided through the at-rest base-camp layout. But three **leader-only** signifiers keyed off `lead = s.id === leaderId` (`ClimbArena.jsx:174`) were NOT gated on `voided`: the leader **halo ring**, the enlarged leader **orb size** (`lead ? 46 : 40`), and the enlarged leader **head size** (`headSizeFor(you, lead, …)`). Because `leaderId = ranking[0].id` is sorted by the contaminated banked altitude, these re-asserted "who is winning" on an otherwise-flattened base-camp row — the exact standing the crown suppression removed. An internal contradiction within the change.
**Fix:** gate `lead` on `!voided` at its single source (`ClimbArena.jsx:174`): `const lead = s.id === leaderId && !voided;`. This collapses the crown, halo, and orb/head size in one edit; the `you` marker (identity, not placement) is kept. Non-voided path byte-identical (`!voided` true everywhere else). Verified by inspection + the non-voided `ClimbArena.headCollision` and arena smokes staying green.

### F2 · Voided-card auto-expiry was not durable — a stale void resurfaced after a later group completed (change-#1, MED)
The card was only **masked** (not cleared) by an active group: both render gates key on `!activeGroup`, and `activeGroup` comes from `selectMyGroup` (which excludes COMPLETE). The original `selectMyMostRecentVoidedGroup` returned the newest VOIDED doc **unconditionally**. Repro: battle #1 voided → card shows; next group forms → masked; that group later reaches COMPLETE → `selectMyGroup` drops back to null while the old VOIDED doc (member still in `groupMembers` — the writer never clears it) is still selected → the stale "no result recorded" card **resurfaces in every no-active-group interlude, indefinitely**, contradicting the stated "shows until the next group forms."
**Fix:** the selector now anchors on the member's **most-recent ranked group overall**, returning it only when it is VOIDED (`leagueTournament.js`): a newer non-void group (forming OR later completing) shadows the void → the read returns null → the card clears. Inertness-preserving (never touches the active allowlist). The buggy test that pinned `[voidedA, complete] → va` was corrected to `→ null`, and a **durability regression test** was added encoding the reviewer's exact repro (`void1 + newer complete2 → null`).

---

## REFUTED / verified sound (survived refutation)
- **Inertness (Lens 1):** no active selector loosened; `selectMyMostRecentVoidedGroup` admits only ranked groups and returns null unless the most-recent is voided; `subscribeMyMostRecentVoidedGroup` is a separate listener that does not alter `subscribeMyGroup`; no path leaks a void into THE FIELD / arena mount / composite. Empty findings.
- **§9 display-agreement (Lens 2):** the reason is one projection of `voidedReason`; the no-result headline is one shared constant; the suppression removes the ordinal and "of four" together and the crown/rank/cut/score together — no orphaned number/label; the null/unknown-reason fallback is display-only (datum stays `voidedReason`). Empty findings.
- **Fence + test integrity (Lens 5):** no fenced file edited; the arena voided tests are real mutation checks (same DATA asserts placement+cut PRESENT without `voided`, ABSENT with it); assertions are reachable under `renderToString` (no effect-dependent claims); the selector/reason tests pin most-recent-wins, training-exclusion, null-safety, and known/unknown reason. Empty findings.

---

## Decisions stated (founder-decidable, per the task)
- **Dismissal/expiry (Change #1):** **durable auto-expiry**, no dismiss control, no persisted state. The card surfaces only while the void is the member's most-recent ranked group and clears the moment any newer group appears. Rationale: purely informational, low-frequency, self-clearing — a dismiss/persistence surface isn't warranted.
- **Film Room (Change #2):** **kept, reframed "review only"** (button "Open the Film Room"). `FilmRoomOverlay` is a static placeholder that needs no result, so reviewing the tape stays legitimate; only the *placement* is illegitimate for a void.
- **Hero board scope (Change #2):** the founder's "no standings … computed from the contaminated Day-8 numbers" was read to include the ClimbArena hero board (crown/rank/cut/score are a de-facto standings), so the board is neutralized for voided (base-camp layout + signifier suppression), not just the verdict card. Stated for the smoke: seat positions are collapsed to base camp rather than left at contaminated altitudes; if a different treatment is wanted, it is a one-line change to the `voided⇒atRest` route.
- **Render surfaces (Change #1):** the card renders on BOTH no-active-group surfaces a member can land on — `LeagueParticipantView`'s null-group region (the poster the founder named; does not pre-empt the elimination boundary) AND `LeagueHome`'s lobby (the default landing, `LEAGUE_REDESIGN_ENABLED = true`).

---

## Addendum (2026-08-06) — Command Center live-card void propagation

A post-smoke follow-up: the Command Center "04 · Manage" card showed a battle as LIVE after the ranked group was voided.

**Diagnosis (founder-confirmed):** the *currently displayed* card ("2h 20m left") was NOT the voided group's battle — a battle from the voided group `lds_wed-1900_2026-07-22` has a past `expiresAt`, which `timeLeft()` renders as "ending," never "2h 20m left" (`ManageStation.jsx:17-26`). "vs CPU" is a hardcoded literal (`ManageStation.jsx:65`), not an opponent signal, and `expiresAt` is full-day for all agent battles (`agentBattleService.js:31`), so neither distinguishes ranked from casual. The card was a different, currently-live full-day battle (the `liveBattles[0]` ambiguity — left for Phase 1.5 as scoped).

**But the LATENT propagation gap was real and founder-ruled to close now:** the poll (`App.jsx:3890-3943`) filtered `agentBattles` on `status=='active'` + the training-clone prefix only — never the group status. A group voided *mid-day* (future `expiresAt`) would therefore read as LIVE on the card. That is the same propagation class the L-A void exists to fix, and independent of 1.5 (which is *which* live battle to show, not *whether* a battle is eligible).

**Fix (read-time group lookup; no fenced-shape contact):** the void lives only on the group doc (`voidGroup` never writes the battle doc — the `createAgentBattle` shape is fenced), so the poll now does a **read-time** `getDoc(tournamentGroups/{groupId})` for each battle's group and drops battles whose group is voided, via a pure helper `excludeVoidedGroupBattles(battles, groupsById)` (`src/utils/commandCenterLiveBattles.js`). The voided decision reuses the arena's single-source `deriveArenaTerminalKind` predicate — literally matching the arena's treatment. Only tournament battles carry a `groupId`; casual vs-CPU battles have none and are untouched. Fail-open per group (a transient group-read miss keeps the battle rather than blanking a live card — consistent with the poll's retain-last-known-good posture). Read cost is ≤1 group read per 120 s poll. The exclusion sits upstream of `liveBattles[0]` AND `starfieldLiveGames`, so the card and the battle-weather sky both honor the void.

**Test:** `commandCenterLiveBattles.test.js` — a VOIDED group's battle is excluded **even with a future `expiresAt`** (the mid-day operator case that fails today), the same battle is kept when its group is still BATTLE (mutation check), casual/no-group battles are kept, and an unresolved group fails open. Poll source guards added to `App.agentBattlesPoll.test.js` (read-time `tournamentGroups` lookup; helper applied; no battle-doc write). `liveBattles[0]` disambiguation remains scoped for Phase 1.5.

## Verification posture
- **Preview smoke (founder):** verify against the real voided group `tournamentGroups/lds_wed-1900_2026-07-22` on the Vercel preview — the emulator/unit layer cannot reach live Firestore, and per BUILD_RULES §2 "pushed ≠ deployed." The card's reason maps the `voidedReason` code (`poisoned_cohort_l_a` → "The cohort was quarantined — its scores were compromised, so no result stands.") with a safe fallback for a null/unknown code. For the Command Center: the definitive check is a group voided **mid-day** (future `expiresAt`) — its card must not read LIVE.

*`vite build` green; full suite 7018 passing; 0 new lint (App.jsx's pre-existing dead-import baseline unchanged). No fenced file edited. Both original CONFIRMED findings + the Command Center void-propagation gap fixed on-branch.*
