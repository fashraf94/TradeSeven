# Fix — agentBattles liveness poll retains last-known-good on error (defect #2)

**Date:** July 30, 2026
**Ruling:** R-T2-S11 (defect #2 required before the starfield flag flip)
**Branch:** `claude/agentbattles-poll-retain-last-good` (fresh from `main` @ `2d9c2724`)
**Fence status:** NON-FENCED. Client-only, one file changed. Zero `api/` contact.
**Status:** Fix applied, tested, ready for merge.

---

## 1. The defect

`src/App.jsx:3900-3903` — the `activeAgentBattles` liveness poll (the source the "No battle live" card reads, and the source the battle-weather starfield's adapter reads) reset its state to `[]` on **any** fetch error:

```js
} catch (error) {
  console.error('Error fetching agent battles:', error);
  setActiveAgentBattles([]);   // <- the defect
}
```

The poll runs every 120 s. So a single transient Firestore blip mid-battle blanked the live-battle list, flipping the card (and, once shipped, the sky) to "no battle live" / calm for up to two minutes while a battle was genuinely live — then the next successful poll silently corrected it. VERIFIED at HEAD; the anchor matches the Phase 0 discovery (`App.jsx:3902`), and `main` has not touched `App.jsx` since that base.

## 2. The fix

Remove the reset; retain the last-known-good state on error. Keep the house `console.error` log (annotated so an operator reading logs knows the list was *not* cleared).

```js
} catch (error) {
  // RETAIN the last-known-good battles instead of blanking the list. …
  console.error('Error fetching agent battles (retaining last-known-good):', error);
}
```

**Why this is complete and correct:**
- The initial state is `useState([])`, so "empty when no fetch has yet succeeded" falls out for free — no `hasEverSucceeded` flag, no new state shape.
- After any successful poll, an error simply keeps whatever was last good (a live battle stays live; a genuine empty stays empty).
- The next successful poll is the correction path, exactly as before.

**Scope fence honored (R-T2-S11):** no retry, no backoff, no `onSnapshot` conversion, no new state shape. The change is the removal of one setter call plus an explanatory comment — error-handling of the existing poll, nothing more.

**House-idiom check:** sibling `App.jsx` `catch` blocks log via plain `console.error('Error …:', error)` and (for non-poll fetches, e.g. notifications `:2680`, templates `:2762`) log-and-retain. The fix matches that shape.

## 3. Acceptance

The error path is an inline `catch` inside an async closure inside a `useEffect` inside `PortfolioDuel` — not exported, and **no test in the repo mounts `App.jsx`**. Reaching the catch at runtime would require standing up the whole app with firebase/auth mocked (new scaffolding the scope fence rules out).

So the fix is pinned with a **source-text guard** — the repo's established idiom for un-mountable code (`src/theme/cssTokens.test.js`, `tokens.guard.test.js` both `readFileSync` their target): `src/App.agentBattlesPoll.test.js` slices the `fetchAgentBattles` closure and asserts the `catch` (a) does not reset to `[]`, (b) still logs the error, (c) sets state only on the success path. **Mutation-checked:** re-adding `setActiveAgentBattles([])` to the catch fails the guard (2 rows). It pins the regression; it does not (and cannot) prove the runtime behaviour — that was verified by reading, above.

Suite: full run green; production build clean.

## 4. Filed for separate tasking (BUILD_RULES §3 — report, don't fix)

The two **sibling battle pollers in the same file carry the identical reset-on-error pattern**, out of scope for defect #2 (which is specifically the `activeAgentBattles` poll feeding the card/sky):

- `src/App.jsx:3738` — `setActiveDraftBattles([])` (+ `setActiveDraftBanner(null)`) in the `[DraftPoll]` catch.
- `src/App.jsx:3861` — `setActiveTrainingBattles([])` in the training-battles catch.

Both blank their live lists on a transient error the same way. They feed the draft-lobby and training surfaces rather than the starfield, so they are not part of this micro-task — but they are the same latent defect and are worth the same retain-last-known-good fix in a follow-up. Not touched here.

---

*End of fix report. One task, one branch; PR opened for founder merge.*
