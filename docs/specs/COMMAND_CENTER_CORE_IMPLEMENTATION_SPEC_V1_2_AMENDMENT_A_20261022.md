# Command Center core implementation spec V1.2 — Amendment A: the completed window across a remount

**Status.** Founder ruling, October 22, 2026: Q-S3-2 of the S3 build report (`docs/audits/20261022_BUILD_COMMAND_CENTER_HUB_S3.md` §12) was answered **A+**. Recorded by Claude Code in the S3 merge round. This amends spec V1.2 (`docs/specs/20261012_COMMAND_CENTER_CORE_IMPLEMENTATION_SPEC_V1_2.md`) §6 in one sentence. The spec file itself is unchanged, and every other line of §6 stands.

## The ruling

The founder's ruling:
- Keep the last successful window — its documents, generation and as-of time — across remounts for the same owner and epoch.
- Show it "as of {time}", and refresh it at the next permitted slot.
- An owner or epoch change still clears it.
- The rate ledger stays per owner and epoch, as built.

## §6, the unmount list

**V1.2 reads:**
> Unmount or actual owner change clears timers, ready caches, dirty work, documents, generations, unfinished queues and result consumers.

**Amended to read:**
> Unmount clears timers, ready caches, dirty work, unfinished queues and result consumers. The last successful completed window of the same owner and auth epoch — its documents, generation and as-of time — is kept across the remount and shown "as of {time}" until it is read again at the next permitted slot. An actual owner or epoch change clears everything above, the kept window included. The rate ledger stays per owner and epoch.

## What follows from it

- **On a return to the hub** (from the Film Room, or a site switch) inside the 120 s window, Games shows the kept rows at once, with "As of {time} · next attempt at {time}" and no Retry: it is not a failure. While that read is out, the note reads "Refreshing · as of {time}". Once the read succeeds, the note is gone and the generation continues from the kept one.
- **Reviews.** Ready caches still clear on unmount, so each kept row's review starts this mount as an unstarted row: "Review check queued", served first at the slot.
- **Failure.** Only a successful read is kept. If a kept window's read fails, Games shows the stale note "As of {time} · couldn't refresh" with Retry, as for any retained window.
- **Unchanged.** §6's rate cap, its 120 s window and the per-owner-and-epoch ledger (S3 review T0-3) are unchanged. The kept window adds no read, timer or listener.

Built in `src/components/CommandCenter/hub/reviewScheduler.js` (`retained`, `carriedWindow`, `carriedState`) and `hub/useHubCompletedBattles.js` (one record per owner and epoch, holding the ledger and the kept window). Pinned by the rows named in the S3 report's section "Merge with S5 and founder rulings".
