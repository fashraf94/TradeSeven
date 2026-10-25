# Command Center core implementation spec V1.2 — Amendment B: a late first read, and the ready review answers, across a remount

**Status.** Founder rulings, October 23, 2026: Q-S3-9 and Q-S3-10 of the S3 build report (`docs/audits/20261022_BUILD_COMMAND_CENTER_HUB_S3.md` §15.10), ruled in the S4 build prompt as R-S4-6 and R-S4-7. Recorded by Claude Code in the S4 build. This amends spec V1.2 (`docs/specs/20261012_COMMAND_CENTER_CORE_IMPLEMENTATION_SPEC_V1_2.md`) §6 as Amendment A (`COMMAND_CENTER_CORE_IMPLEMENTATION_SPEC_V1_2_AMENDMENT_A_20261022.md`) left it, in two clauses. The spec file itself is unchanged, and every other line of §6 stands.

## The rulings

The founder's rulings:
- **Q-S3-9 (R-S4-6).** A first completed read that succeeds after the hub unmounted is recorded in that owner and epoch's kept window. It is never recorded for a different owner or epoch. A quick return then shows it "as of" its read instead of no rows.
- **Q-S3-10 (R-S4-7).** The kept window also keeps its rows' ready review answers, for the same owner and epoch, so "Open battle tape" works straight away on a return. Pending, unavailable, timed-out and queued answers are not kept; they are asked again, as now.

## §6, the unmount list

**As Amendment A leaves it:**
> Unmount clears timers, ready caches, dirty work, unfinished queues and result consumers. The last successful completed window of the same owner and auth epoch — its documents, generation and as-of time — is kept across the remount and shown "as of {time}" until it is read again at the next permitted slot. An actual owner or epoch change clears everything above, the kept window included. The rate ledger stays per owner and epoch.

**Amended to read:**
> Unmount clears timers, dirty work, unfinished queues and result consumers, and ready review answers other than those of the kept window's rows. The last successful completed window of the same owner and auth epoch — its documents, generation and as-of time, with the ready review answers of its rows — is kept across the remount and shown "as of {time}" until it is read again at the next permitted slot. A first completed read that succeeds after the unmount is kept the same way, for the owner and epoch it was started for and no other, when a mounted hub would have accepted it. An actual owner or epoch change clears everything above, the kept window included. The rate ledger stays per owner and epoch.

## What follows from it

- **On a return** inside the 120 s window, the kept rows show at once, "As of {time}" (Amendment A). A row whose review was ready shows "Open battle tape" at once and opens the Film Room; every other kept row reads "Review check queued", as before, and is served first at the slot.
- **A late first read, precisely.**
  - *Which read.* Only the owner's first: a hub that had a window (its own or a kept one) when it unmounted keeps no later read. The paid-for read this lets through is the one a quick bounce used to lose (S3 review MR-4).
  - *Accepted as a mounted hub would.* It must be a list, and arrive inside the query's own 8 s and the cycle's 42 s; past either it is a failed read, kept or not. Its documents are the owner's own (the same filter as any read), and it is kept once.
  - *Owner and epoch.* It is filed under the owner and epoch it was started for. If the hub has since rendered for another owner or epoch, or signed out, that record no longer exists and the answer is dropped. An identity's epoch only grows, so a key never comes back.
  - *Never backwards.* It replaces a kept window only if it is not older: the generation decides first, then the time (S3 review MR-11).
  - *A return before it lands.* The remounted hub's own scheduler has no window yet, and spends no slot while it waits for the owner's budget. A window that lands for the owner in the meantime shows "as of" its read at the hub's next render, in place of the wait; the scheduler's own first read, when it comes, supersedes it.
- **Ready answers, precisely.**
  - *What is kept.* The helper's own answer, `ready` with its target, for a row that is in the kept window. A kept answer stays for as long as its row is in the window, across later reads, as the scheduler's own ready cache does within a mount.
  - *What is not.* Anything the helper did not say was ready — pending, unavailable, a timed-out or queued check — is dropped with the unmount and asked again.
  - *Opening.* "Open battle tape" opens through the same guard as ever: the helper's answer ready and its target the Film Room route.
- **Unchanged.** §6's rate cap, its 120 s window, the per-owner-and-epoch ledger (S3 review T0-3), and Amendment A's clearing rules (an owner or epoch change, and sign-out). The kept window adds no read, timer, listener or effect; a late answer is delivered through a callback the scheduler is given, and the scheduler stays free of imports and globals.

Built in `src/components/CommandCenter/hub/reviewScheduler.js` (`onLate`, `retained.ready`, `carriedWindow`, `carriedState`) and `hub/useHubCompletedBattles.js` (`keepWindow`, the record's `ready`, the render fallback). Pinned by the rows named in the S4 build report (`docs/audits/20261023_BUILD_COMMAND_CENTER_HUB_S4.md`).
