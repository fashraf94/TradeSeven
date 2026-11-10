# Command Center core implementation spec V1.2 — Amendment D (the Huddle on the hub)

**Date:** Nov 1, 2026 (rulings); committed Nov 7, 2026 by the Huddle S1 build.
**Amends:** `docs/specs/20261012_COMMAND_CENTER_CORE_IMPLEMENTATION_SPEC_V1_2.md`, which is **unchanged** (Huddle S1 spec Amendment C V1.2 §C6).
**Carries:** the hub-side rulings of `docs/specs/20261107_HUDDLE_S1_BUILD_SPEC_V1_1_AMENDMENT_C_V1_2.md` — §C4, §C6, §C7, §C8, §C14 and §C15's Deploy card line — as they bind the hub. Where this amendment and spec V1.2 differ, this amendment wins for the Huddle's surfaces and changes nothing else.
**Flag:** every surface below renders only while `DRB_HUDDLE_ENABLED` is on (`src/config/huddleFlags.js`), read as a literal so the off state folds away.

---

## D1. Attention order (next action) — adds a rule to spec §8.2

The next-action card's order becomes, top first:

1. **a game in session** (an owned live game that has opened);
2. **Huddle ready** — today's huddle is ready and its plan is still proposed, before the session's close. It sits above a game that is deployed and waiting for the open ("deployed, starts 9:30");
3. a game that is deployed and waiting for the open;
4. **a review ready**;
5. *research awaiting your direction* (named in the agreed order; no such rule exists at HEAD, and S1 adds none);
6. **the first deployment**.

The Huddle rule has its own Later key, **`huddle:{etDate}`**. After the plan is confirmed or skipped (or it expires at the close), the card falls through. With no huddle candidate, the order is byte-identical to the HEAD rules (a game, a review, the first deployment), so no existing row moves.

## D2. The chip — adds to spec §8 (the stage)

A state label and a door, never an announcement: no badge, pulse, toast, count or live region. Shadow's status line stays the hub's only live region. The chip sits **outside Shadow's fixed box** and leaves its size alone; it is a **44 px** target and fits at **360 px** wide. Its label comes from the huddle record's status; tapping it opens the Huddle sheet.

## D3. The Huddle sheet — adds to spec §8 (sheets)

A **HubSheet** on the hub's overlay stack: the background inert, focus to Close, Escape closes, focus returns to the door that opened it. Its audio element, its listeners and its playback-token call live in a module outside the hub directory, statically imported and recorded as a permitted terminal (the hub graph keeps its one lazy edge).

**Audio:** never autoplays; playback stops on unmount, when the page is hidden, and while the deploy ceremony covers the page. Every listener is registered in the hub's activity guard manifest (`commandCenterHub.activity.guard.test.js`).

## D4. The readers — replaces the Huddle's share of spec §6

One reader per record, keyed by uid and auth epoch, living in the hub chunk: `src/hooks/useHuddleToday.js` (the huddle record, through the status route) and `src/hooks/useHuddleHistory.js` (plan history for Partnership), each with a **single service import** (`src/services/huddleService.js`), each pinned by the mount guard's permitted map and NAMED list. **No read per tab switch. No status poll:** plan status refreshes on sheet open, on confirm or skip, and on `visibilitychange`, each listener registered in the activity guard manifest. The entry chunk is checked by sourcemap attribution before and after the build.

**Nothing the root deploy provider imports may import the Huddle service** (Huddle C §C7); the client post-deploy hook is not built.

## D5. The Partnership panel — replaces spec V1.2's reserved Partnership text

Replacing the reserved "Not in this release" text moves its copy-guard pins under this ruling. The panel shows today's plan and the plan history as **a trading-control record for one session** — not partnership memory, not a research preference, not proof of learning — with the Research panel's states: **loading, none, error**, and an **as-of note** on a kept answer.

## D6. Words — adds to spec §9 (copy)

Every Huddle string lives in `hub/hubCopy.js` under the copy guard and passes, unloosened: the no-learning list; the numeral rule (durations and clock times render from data); the pairing fence (Huddle copy speaks of the plan, never of ideas). Plan status words come from receipts only. A conflict between a needed string and a guard is a finding in the build report, never a loosened guard.

## D7. Activity — adds to spec §8 (Recent activity)

"Plan confirmed" / "Plan skipped" rows come from huddle records, with kind-specific ids `huddle-plan:{uid}:{etDate}`, and the same cutoff as every other row.

## D8. The Deploy card's reconfirm line (Huddle C §C15)

When the archetype the hub's existing agent reader shows differs from the newest confirmation's `archetype`, the Deploy card shows one line asking for reconfirmation and a **"Reconfirm"** door that opens the Huddle sheet at the plan card. It is a pure derivation from readers the hub already has (the agent reader and `useHuddleToday`); the card makes no service call itself, so D4's deploy-provider rule holds. The line never blocks or delays a deploy.
