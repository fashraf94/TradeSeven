# Command Center core implementation spec V1.2 — Amendment C: the S8 review's two questions, the shared sheet, and the status line past a game's end

**Status.** Founder rulings in the S8 fix build prompt, October 26, 2026, on the independent S8 cumulative review (`docs/audits/20261026_FABLE_REVIEW_S8_CUMULATIVE.md`): its questions Q-S8-1 and Q-S8-2, the lift of Q-S5-7 for one file (ruling R-S8F-6) and the status line's words past a game's end (ruling R-S8F-7). Recorded by Claude Code in the S8 fix build (ruling R-S8F-13). This amends spec V1.2 (`docs/specs/20261012_COMMAND_CENTER_CORE_IMPLEMENTATION_SPEC_V1_2.md`) §6 in one sentence and records three readings. The spec file itself is unchanged; Amendments A and B stand; every other line of §6, §8.2 and §10 stands.

## The rulings

- **Q-S8-1 — the active poll, as built.** An existing or recovered battle is live, not completed. The provider's reconciliation that finds one refreshes App's active poll, which the Games live rows, the strip and the gate read; it does not refresh the completed coordinator. §6's sentence is amended below. No new trigger is built.
- **Q-S8-2 — Later stays keyed by uid, as §8.2 writes it.** A dismissal is the same person's choice and shows no other account's data. It clears when the tab closes, and on an actual uid change, as §8.2 says. A new auth epoch of the same uid is not, by itself, a reason to clear it.
- **R-S8F-6 — Q-S5-7's "no legacy-sheet edits" is lifted for `src/components/Dashboard/EquipSheet.jsx` only.** The shared sheet primitive itself carries spec §10's dialog semantics, so every sheet built on it has them, in the hub and in the legacy shells alike (an accepted live change). No other shipped sheet file is edited.
- **R-S8F-7 — the status line past a game's end.** When every opened game is past its end time, the status line uses the strip's own words for that phase, "Live · ending", rather than "Live game in progress". No new string.

## §6, the completed coordinator's refresh triggers

**As spec V1.2 writes it:**
> One `useHubCompletedBattles(10)` coordinator drives History, Activity and review availability. Refresh triggers: mount/current owner; successful active-poll transition where an id leaves live; provider existing or recovered reconciliation; explicit History/Review Retry or Refresh; return from Film Room; focus or becoming visible when the last cycle is at least 120 seconds old; scheduled refresh for pending reviews.

**Amended to read:**
> One `useHubCompletedBattles(10)` coordinator drives History, Activity and review availability. Refresh triggers: mount/current owner; successful active-poll transition where an id leaves live; explicit History/Review Retry or Refresh; return from Film Room; focus or becoming visible when the last cycle is at least 120 seconds old; scheduled refresh for pending reviews. The provider's existing or recovered reconciliation refreshes the active poll, not this coordinator: the battle it finds is live, not completed. When that battle later ends, its id leaving a successful poll is the trigger above.

The rest of the paragraph (coalescing, one cycle in flight, one dirty follow-up, what a successful and a failed cycle do) and §6's rate cap are unchanged.

## What follows from it

- **Q-S8-1.** As built since S2b (its §16, RF-2; the S2b review's FRB-8): the provider's created and existing answers, and a reconciliation that finds the owner's battle (existing or recovered), call App's poll refresh (`src/contexts/DeployAttemptContext.jsx`, `refreshActive`). `REVIEW_TRIGGERS` (`src/components/CommandCenter/hub/reviewScheduler.js`) keeps MOUNT, MANUAL, LIVE_LEFT, FOCUS, VISIBLE and HISTORY. The S8 review's validation clause 5.7 ("completed-history refresh obeys its 120 s cap after an existing/recovered answer") is graded against this amendment: there is no such refresh to cap.
- **Q-S8-2.** `cc.later.{uid}` in `sessionStorage` (`src/components/CommandCenter/hub/useHubLater.js`) is unchanged, as built: a sign-out the mounted hub sees starts the set empty, even for the same uid; App's own logout leaves the dashboard first, so a same-uid sign-in in the same tab finds its Laters, and another account finds none. The S8 review's exit criterion 3 (owned results only for the current uid and epoch) is read, for Later, as §8.2 writes it: a dismissal holds no owned data of any account, so a new epoch of the same uid is no reason to clear it.
- **R-S8F-6.** The shared sheet: `role="dialog"`, `aria-modal="true"`, a label from its title (`aria-labelledby`), focus on Close when it opens, Escape closes it, Tab and Shift+Tab stay inside, and focus returns to the opener on close — exactly once: when the host has already moved focus out of the sheet (the hub's overlay stack returns it to the opener), the sheet does not move it again. The sheets on the primitive are the agent record, the archetype picker, the traits sheet, the watchlist sheet (EquipStation, EquipBench and the hub's), the Scouting Board, the rule-bundle picker and the League's loadout chooser.
- **R-S8F-7.** The status line's rule 5 and the Games header read one count of the live games (`liveCountsOf`, `src/components/CommandCenter/hub/hubModel.js`): "N live" counts the games that have opened; a list all waiting for the open shows the waiting phrase, as the rows do; the line says "Live · ending" (the strip's `COPY.strip.live(COPY.games.ending)`) only when every opened game is past its end time, and "in progress" otherwise.

Built and pinned by the rows named in the S8 fix build report (`docs/audits/20261028_BUILD_COMMAND_CENTER_HUB_S8_FIXES.md`).
