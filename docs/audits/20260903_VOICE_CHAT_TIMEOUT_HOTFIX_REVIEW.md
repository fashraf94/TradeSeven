# Voice-timeout hotfix — BUILD_RULES §2 cumulative review

**Date:** September 3, 2026 · **Branch:** `claude/voice-chat-timeout-sff86y` · **Base:** `origin/main` @ `bf4bc84f`
**Trigger:** the cumulative branch diff reached **10 files** — the §2 mandatory-review threshold. The file count is driven by the founder's ruling 2a (one test row per sibling caller, one of which had no test file), not by scope creep.

---

## Executive verdict

The review found **four real defects, two of them HIGH, all introduced by this diff or by the contract it published.** Two were user-visible regressions in the change itself. All four are fixed on-branch; every fix is mutation-checked.

The single most important result: **the first fix was incomplete.** It closed the `.json()` body-read window and left the identical defect eleven lines above it on the `.text()` error-body branch — so the incident this PR exists to fix was still live on a second path, and on the most likely production shape (a 429 retry whose deadline expires on attempt 2). Two independent reviewers found it; a third repro was written by the coordinator before accepting it.

| # | Finding | Dimension | Severity | Disposition |
|---|---|---|---|---|
| R1 | The `.text()` error-body read still swallowed the abort — no `AbortError`, no `aborted` flag | classification · blast radius | **HIGH** | **CONFIRMED → fixed** |
| R2 | The first call's abort was relative, not clamped to the absolute deadline — the 15s→20s raise cut the platform-kill margin from 15.1s to 10.1s of prologue | timing | **HIGH** | **CONFIRMED → fixed** |
| R3 | `watchlist-analysis`'s new 504 was thrown away by its client, deleting the user's turn | blast radius | **MEDIUM** | **CONFIRMED → fixed** |
| R4 | Asymmetric abort normalization between the fetch catch and the body catch | classification | MEDIUM (latent) | **CONFIRMED → fixed** |
| R5 | `asAbortError` dropped the original error (no `cause`) | classification | LOW | CONFIRMED → fixed |
| R6 | Retry `console.warn` claimed "retrying" when the signal was already aborted | classification | LOW | CONFIRMED → fixed |
| R7 | Stale comments invalidated by this diff (`directiveGate.js`, `ensure-opener.js`, caller count) | all | LOW | CONFIRMED → fixed |
| R8 | Over-classification (a genuine parse failure reported as a timeout) | classification | — | **REFUTED** — 1,248 race runs, 0 occurrences |
| R9 | The rethrow escaping `directiveGate.attemptRepair` | blast radius | — | **REFUTED** — bare catch swallows it identically |
| R10 | The repair-survival window narrowed by the 20s cap | timing | MEDIUM | **FOUNDER-RULED → fixed at 19s**, see §5 |
| R11 | The flagship abort rows go green **with the defect live** if headers arrive later than the 120ms budget | test integrity | **HIGH** | **CONFIRMED → fixed** |
| R12 | `TURN_DEADLINE_MS` pinned but never proved wired to the gate | test integrity | MEDIUM | **CONFIRMED → fixed** |
| R13 | Over-classification unguarded in `workshop-chat` and `expand-signal` (only the 504 arm pinned) | test integrity | MEDIUM | **CONFIRMED → fixed** |
| R14 | Two branches of the fix itself (`\|\| signal?.aborted`, `asAbortError` fabrication) unreached by any row | test integrity | LOW | **CONFIRMED → fixed** |
| R15 | `chat.test.js`'s "reached the way production reaches it" overclaimed — the Response is still a stub | test integrity | LOW | CONFIRMED → comment corrected |
| R16 | Mock leakage, fake-timer flake (52 runs), cross-file leakage, suite pollution | test integrity | — | **REFUTED — all four clean** |

---

## 1. Method

Four independent adversarial reviewers, one per dimension, each instructed to **refute** rather than approve and to discard any finding without an executed repro:

| Dimension | Focus |
|---|---|
| Abort classification | under/over-classification, retry interaction, `asAbortError` reachability |
| Timing budget & lifecycle | `maxDuration` overrun, repair window, `gemmaLatencyMs` correctness, signal inertness |
| Test integrity | vacuous guards, mock leakage, fake-timer flake, suite pollution |
| Sibling blast radius | per-caller wire behaviour, frontend consumers, state/side-effect divergence |

**Reviewer isolation (§2, the Reviewer-B precedent):** all four worked on a snapshot copy of the working tree under the session scratchpad with `node_modules` symlinked, read-only on git and on the shared tree. Confirmed clean afterwards — `git status` on the repo shows no reviewer artifact. One reviewer left an intentionally-red assertion file **in the snapshot only**; it never touched the repo.

**Coordinator posture:** no finding was accepted on assertion. R1, R2 and R3 were each independently re-derived before any fix was written.

**All four dimensions reported.** The test-integrity pass returned after the first version of this record was written and its findings are folded in as R11–R15 (§4a); the branch was updated accordingly.

---

## 2. R1 — the fix was incomplete (HIGH)

`gemmaClient.js` guarded `response.json()` but not `response.text()`, which is a body read on the `!response.ok` branch and was wrapped in `.catch(() => 'unknown')`. An abort landing there was erased exactly as the original incident erased it.

Coordinator repro, executed before accepting:

```
withRetry result : {"success":false,"error":"OpenRouter 403: unknown","fallbackResponse":null}
signal.aborted   : true
aborted flag     : undefined   <-- the contract at gemmaClient.js:23-25 says this must be true
throwing sig name: Error       <-- chat.js needs AbortError for its 504
```

This **falsified the contract the same commit published** ("An abort ALWAYS throws with `name === 'AbortError'`"). Worse, a reviewer identified the likely production shape: a 429 → retry → deadline expires inside attempt 2. The retry loop's signal guard runs only *before* an attempt, so the final attempt was never re-checked.

**Fixed** at the read itself, plus a last-attempt `signal?.aborted` re-check for the narrow case where the error body completes before the abort lands on a non-transient status. After:

```
withRetry result : {"success":false,"error":"Request aborted","aborted":true,...}
aborted flag     : true
throwing sig name: AbortError
```

Guarded by four rows including the retry shape (which asserts the retry genuinely happened first, `attempts >= 2`). **Mutation check:** reverting the `.text()` branch reddens 2 rows with `expected 'Error' to be 'AbortError'`.

## 3. R2 — the timeout raise had no absolute bound (HIGH)

`GEMMA_TIMEOUT_MS` is *relative* and its timer is armed **after** the prologue (auth + 4 sequential Firestore round trips; 6 on the League ask path), so it fired at `overhead + 20s` — a quantity with no relationship to the absolute `TURN_DEADLINE_MS` the directive gate is held to.

Coordinator arithmetic, derived independently:

```
overhead at which the platform kills the function first:
  15s cap: 15100 ms
  20s cap: 10100 ms   <-- margin lost: 5000 ms
```

Past ~4s of prologue the abort breaches the 24s deadline; past ~10.1s it fires *after* `maxDuration`, i.e. after the platform has already killed the function — producing the bare gateway 504 with no shadow log and no honest client string that the change exists to prevent. The comment shipped in the first commit asserted 20s was safe "inside 24s"; that was an assumption about overhead, not an invariant.

**Fixed** by clamping to the absolute deadline, mirroring `directiveGate.js:105-107` and the same pattern `ensure-opener.js:233-236` already uses ("bounded by the ABSOLUTE deadline … so a slow attempt can never push the commit past maxDuration"). Three behavioural rows drive the handler under an injected slow prologue. **Mutation check:** removing the clamp reddens 2 rows — `expected 28000 to be less than or equal to 24000`.

## 4. R3 — the 504 deleted the user's message (MEDIUM, user-visible)

Correcting the classification changed `watchlist-analysis` from 200 to 504 on a timeout, with a **byte-identical body**. Its client, uniquely among the five surfaces, has no carve-out: `forgeWatchlistService.js` threw on `!response.ok`, so `WatchlistAnalysisView.jsx:154` ran `setTurns(prev => prev.slice(0, -1))` — **deleting the user's own message from the transcript** — and showed "I hit a snag analyzing that" on what is genuinely a timeout, because `err.name` is `'Error'`, never `'AbortError'`.

That is the exact mislabel this PR removes, reintroduced one layer up.

**Fixed** with the house carve-out (`WorkshopChat.jsx:556-573`: a known-shape `error: true` body is consumed, not thrown). Four rows guard it, including two that prove real failures (403, non-JSON body) still throw. **Mutation check:** reverting reddens the first row.

## 5. R10 — accepted, not fixed: the repair window narrowed

Raising to 20s moved the directive-gate repair-survival threshold. The repair runs only while `prologue + firstCallLatency <= TURN_DEADLINE_MS - MIN_REPAIR_MS` (22.5s). Overhead tolerated after a worst-case first call: **7.6s before, 2.6s now**. Measured two independent ways; the boundary is exactly `MIN_REPAIR_MS`:

```
{"headroom":1499,"repairCalls":0,"status":"invalid_id","hasDirective":false}
{"headroom":1500,"repairCalls":1,"status":"committed",  "hasDirective":true}
```

Consequence: on a slow turn, `hasDirective` can flip true→false on identical model output purely from timing, and it fails silently (200 + `directiveStatus:'no_change'` + the canned line, indistinguishable at the client from a deliberate null).

**Raised to the founder rather than decided here. Ruled Sep 3: lower to 19s.**

The budget invariant the reviewer identified — `overhead + GEMMA_TIMEOUT_MS + MIN_REPAIR_MS <= TURN_DEADLINE_MS` — now holds again and is pinned as an executable row rather than a comment:

| cap | 3.0s + cap + 1.5s | vs 24.0s |
|---|---|---|
| 15s (before the incident) | 19.5s | held |
| 20s (first fix) | **24.5s** | **over by 500ms** — the repair was silently un-budgeted |
| **19s (shipped)** | **23.5s** | **holds, 500ms spare** |

Overhead tolerated after a worst-case first call is back above the 3.0s design allowance (3.5s, vs 2.6s at 20s). The invariant row is the one that would have caught the original raise; it fails on any future change that forgets the second model call. **Mutation check:** setting the cap back to 20s reddens it with `expected 24500 to be less than or equal to 24000`, independently of the value pin.

## 4a. R11 — the guards could be green while the defect shipped (HIGH)

The most uncomfortable finding of the review, and the same failure mode this whole task exists to correct.

The flagship rows assert that an abort lands on the **body read**. Nothing asserted it. Which window fires was decided by an unasserted race between a hard-coded 120ms timer and the loopback server's first byte — so if headers were ever slower than the budget, the abort would land pre-headers, on the window that was **never broken**, and the rows would silently re-test the working path.

Coordinator repro — production defect restored **and** headers delayed 300ms:

```
Tests  23 passed (23)          <- the entire file green, defect live
```

That is exactly how the original `chat.test.js` guard passed for months against a live production defect. Measured margin is comfortable today (p50 ~2ms unloaded, max 48ms under 3× CPU oversubscription, vs 120ms), so it was latent rather than imminent — but no assertion would ever have noticed it flip.

**Fixed** by asserting the window itself. The discriminator was free and already emitted: only the body-read path logs `timed out while reading the response body`, and its latency line carries `status: 200` where the pre-headers path carries `status: null`. Both body-read rows now assert the marker is present; the pre-headers row asserts it is **absent**, so it can no longer silently duplicate them.

**Mutation check** — the same experiment, re-run after the fix:

```
× callGemmaVoice: abort DURING BODY READ throws a real AbortError
× callGemmaVoiceWithRetry: abort DURING BODY READ reports aborted:true
  Tests  2 failed | 21 passed (23)
```

R12–R14 were closed the same way, each with its own mutation:

| Finding | Mutation | Result |
|---|---|---|
| R12 `TURN_DEADLINE_MS` wiring | `deadlineMs: turnStartMs + 99_000` | red — `expected 99000 to be 24000` |
| R13 over-classification (2 handlers) | ternary → always-504 | red — `expected 504 to be 200` / `to be 502` |
| R14 the `\|\| signal?.aborted` arm | drop the arm | red — `expected 'Error' to be 'AbortError'` |
| R14 `asAbortError` fabrication | `throw jsonErr` | red — `expected 'SyntaxError' to be 'AbortError'` |

R14 is worth naming precisely: `abort(reason)` makes undici throw the **reason object itself** (`name: 'Error'`, no cause), so the fallback arm is the only thing standing between that and a real timeout being filed as invalid JSON — and no row reached it until now.

## 6. Refuted

- **Over-classification** (a genuine malformed body reported as a timeout because of the `|| signal?.aborted` arm). Attacked three ways across **1,248 race runs** — a complete-but-invalid body with the abort swept ±6ms in 0.25ms steps, and a gzip variant creating a real async gap via zlib's threadpool hop. **0 occurrences.** Structural reason: there is no macrotask boundary between the body completing and the check, so a timer-driven abort can only land before the read completes, where `isAbortError` is already true. Guarded by a dedicated row.
- **The rethrow escaping the directive gate.** `attemptRepair`'s bare `catch { return null }` swallows the new `AbortError` identically to the old generic `Error` — same deterministic null, same fallback line. The only escape route in `chat.js` is a bare `try/finally` that does not catch, so the sole change there is the intended 500→504.

## 7. Caller census correction

The Phase 0 report said **six** callers. The real figure is **13 non-test importers**, found by both the coordinator and the blast-radius reviewer independently. The Phase 0 grep keyed on `callGemmaVoiceWithRetry` and `openrouter.ai` and missed seven.

Wire-level effect, every caller verified:

| Endpoint | Old (body-read abort) | New | Frontend consumer | Breaks? |
|---|---|---|---|---|
| `agent/chat` | **500** | **504** | `AgentChat.jsx:761`, `FilmRoomChat.jsx:294` — both have explicit 504 branches | no — intended |
| `forge/workshop-chat` | 200 | 504 | `WorkshopChat.jsx:558` tests `error === true` first | no |
| `forge/watchlist-analysis` | 200 | 504 | `forgeWatchlistService.js` — no carve-out | **YES → fixed (R3)** |
| `screener/chat` | 200 | 504 | `ScreenerView.jsx:161` exempts `error === true` | no |
| `forge/watchlist-dialogue` | 200 | 504 | `WatchlistChat.jsx:424` falls through | no |
| `forge/expand-signal` | 502 | 504 | no `src/` consumer | no |

Non-endpoint callers, none changing on the wire: `decide.js`, `ensure-opener.js`, `agent-batch-review.js`, `voiceLayerAnticipation.js`, `voiceLayerTradeNarration.js`, `correlation-narrate.js`, `directiveGate.js`. Four of them (`decide.js:1602`, `ensure-opener.js:80`, `voiceLayerAnticipation.js:160`, `voiceLayerTradeNarration.js:166`) already branch on abort and now get the **correct** label where they previously got a misleading one. No regressions.

## 8. Fence position

**No fenced file edited.** `api/agent/decide.js` is a §1-fenced file that *calls* the non-fenced `callGemmaVoice` (`decide.js:1594`) and was read only. Its `errorReason` at `:1602` becomes accurate (`'timeout'` rather than a misleading message string) and terminates in a `logFirstMessage` shadow call inside a block marked *"Intentionally swallowed — deploy must not be blocked by Voice Layer failure"* (`:1697`). No battle-doc write, no `createAgentBattle` shape, no scoring-engine behaviour. Neither the file fence nor the §1 concept-fence is touched. **Flagged to the founder for confirmation rather than assumed.**

`voiceLayerPrompt.js` untouched — no Fable review triggered. `promptHonestyRegistry` and the §2.3 import-boundary ratchet are not implicated.

## 9. Verification

| Check | Result |
|---|---|
| Full suite | **9,654 passing**, 572 files, 63 skipped |
| `vite build` | green (26s) |
| `eslint` on touched files | clean — the one `process` no-undef in `gemmaClient.js` is **pre-existing** (proved by linting the HEAD version: same error at its line 66) |
| Mutation checks | 5 fixes, each reverted individually and confirmed to redden its own guard |

Mutation-check ledger:

| Fix | Mutation | Result |
|---|---|---|
| `.json()` abort branch | `if (false)` | 2 rows red — `expected 'Error' to be 'AbortError'` |
| `.json()` abort branch | `if (false)` | `chat.test.js` red — `expected 500 to be 504` |
| `.text()` abort branch | `if (false)` | 2 rows red — `expected 'Error' to be 'AbortError'` |
| Absolute clamp | unclamped | 2 rows red — `expected 28000 to be less than or equal to 24000` |
| Client carve-out | bare throw | 1 row red — rejected instead of resolving |
| `GEMMA_TIMEOUT_MS` at the call site | bare literal `15000` | wiring row red — catches constant drift |
| `.json()` abort branch + slow headers | defect restored, headers +300ms | 2 rows red (was 23/23 GREEN before R11's fix) |
| `TURN_DEADLINE_MS` at the gate | `turnStartMs + 99_000` | wiring row red — `expected 99000 to be 24000` |
| `workshop-chat` / `expand-signal` ternary | always-504 | companion rows red |
| `\|\| signal?.aborted` / `asAbortError` | dropped / bypassed | fallback-arm row red |

## 10. Filed for separate tasking (§3 — reported, not fixed)

1. **`controller.signal` is inert when passed to the directive gate** (`chat.js:518`): the timer is cleared in the `finally` before the gate is entered, so `directiveGate.js:106`'s `signal?.aborted` is unreachable-true and the listener pair at `:118`/`:131` is dead wiring that reads as a safety net. Proven positively — a repair survived 3.0s past the moment the parent timer would have fired.
2. **No shadow log on the newly-504 path** for `watchlist-analysis.js:475-489` and `screener/chat.js:229-237` — both return their failure with no `logConversation`, so for those two surfaces the timeout files nothing at all. Pre-existing; caps the observability this change buys.
3. **`gemmaLatencyMs` covers the first call only.** On a gated turn, total model time can exceed it by up to `REPAIR_TIMEOUT_MS` (8s). Correct for verifying *this* fix; the comment was corrected to say so rather than widening scope. A `repairLatencyMs` would close it.
4. **`callGemmaVoiceWithRetry` JSDoc claims malformed JSON is retried** (`gemmaClient.js:19-20`) — it is not: the `invalid_json` return carries status 200, which is not in `TRANSIENT_STATUSES`. Pre-existing.
5. ~~**Phase 0 report caller census** (`six` → `13`).~~ **CLOSED Sep 3** — the report is now filed on this branch as `20260903_VOICE_CHAT_TIMEOUT_PHASE0_DISCOVERY.md` with a correction notice in its preamble and every occurrence annotated inline.
6. **`watchlist-dialogue`'s sibling row duplicates a pre-existing row** at `:1561` (same fixture, same 504 + `gemma_timeout` assertions). Harmless, but it is redundant coverage rather than new.
7. **Pre-existing intra-file order dependence**: a `--sequence.shuffle` run surfaced 15 failures across 6 files (`correlation-scan.boundary`, `correlation.boundary`, `voiceLayerPrompt`, `wireGenerationConfig`, `wireFlags`, `starfield.depstability`). **None in this change's blast radius** — all eight touched files pass under shuffle — but the suite is not order-independent.

## 11. Founder decisions outstanding

All three resolved Sep 3, 2026:

1. **R10** — ruled: **lower to 19s.** Shipped; see §5.
2. **§8** — the `decide.js` fence reading is **confirmed: not an edit.**
3. **§10** — items 1-4, 6 and 7 stand as separate tasks; item 5 is closed.
4. The `src/` change for R3 is **sanctioned as shipped.**
