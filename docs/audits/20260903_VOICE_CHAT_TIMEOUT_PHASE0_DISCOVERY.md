# Phase 0 — `/api/agent/chat` 500s in production (voice timeout)

**Date:** September 3, 2026 · **Read-only.** No files written in the repo tree; no commits; no pushes.

> **CORRECTION (filed to the branch Sep 3, 2026, founder-ruled).** This report
> states the shared Gemma client has **six** callers. **The real figure is 13
> non-test importers.** The Phase 0 grep keyed on `callGemmaVoiceWithRetry` and
> `openrouter.ai` and missed seven. Every occurrence below is annotated inline;
> the corrected census, verified caller by caller, is §7 of
> `20260903_VOICE_CHAT_TIMEOUT_HOTFIX_REVIEW.md`. The seven missed callers
> changed nothing in the verdicts — four of them already branch on abort and get
> a *more* accurate label from the fix, three are unaffected — but the count was
> wrong and is corrected here rather than left standing. Nothing else in this
> report is altered.

## Preamble (BUILD_RULES §2 / §3)

| | |
|---|---|
| Branch (actual) | `claude/voice-chat-timeout-sff86y` |
| Branch (task prompt) | `fix/voice-chat-timeout` — **mismatch, see §9** |
| HEAD | `bf4bc84f1ee0ecd8f498aa35c0487c5b747b730d` |
| HEAD == `origin/main` | yes (identical SHA) |
| Working tree | clean |
| `git fetch origin` | **run first**, before any remote comparison (§3) |
| Other state changes | `npm ci` (deps were absent; needed to execute the prompt-size measurement). No repo files touched. |
| Fence contact | **none.** No fenced file read for edit; none edited. |

---

## Executive verdict

**The 15-second timeout is the trigger. It is not the bug.**

The bug is that when that timeout fires — which it does in the common case, *while the response body is still arriving* — the abort is caught by a `catch` intended for malformed JSON and rewritten as a generic `Error`. Every downstream consumer that was built to handle a timeout then fails to recognise one. The handler's `AbortError` branch, the 504, the `gemma_timeout` shadow-log reason, and the client's honest "Agent took too long" string are **all already written, all correct, and all unreachable on this path.**

The founder is not seeing a missing feature. He is seeing four working features that a single mislabelled `catch` routes around.

| # | Question | Verdict | Anchor |
|---|---|---|---|
| 1 | The abort | **CONFIRMED — reproduced byte-exact.** Timeout lives in the caller, not the client. The wrap at `:139` is swallowing an `AbortError` as "Invalid JSON". The log headline is wrong about the cause. | `chat.js:394`, `gemmaClient.js:93-99`, `:139` |
| 2 | Function budget | **NOT the constraint.** `maxDuration: 30`, timeout 15s. ~9s of headroom is unused. | `chat.js:24`, `:394`, `:478` |
| 3 | Retry / fallback | **NONE on this path.** No provider pin, no `models[]`, no `allow_fallbacks`, no alternate model wired. | `gemmaClient.js:71-77`, `:33` |
| 4 | Prompt size | **~7.7k tokens. Not the cause — no growth channel exists.** Every variable block is windowed. | measured, §4 |
| 5 | Upstream health | **NOT MEASURED** — OpenRouter is blocked by this environment's proxy (403 CONNECT). Founder must check the status page. | proxy log, §5 |
| 6 | Budget accounting | **CORRECT.** The charge is strictly after the model call. 0/10 after three failures is right. | `chat.js:665`, `:623` vs `:397` |
| 7 | Client string | **The truthful branch already exists** and is skipped because the server sends 500, not 504. | `AgentChat.jsx:761-763` |

**Recommended hotfix: the error-wrap fix (already sanctioned, unconditional) + Option A.** In that order of importance. The wrap fix alone converts every one of these failures from a 500 with a lie into a 504 with the truth, *without changing a single timing value.* Option A then reduces how often it happens.

---

## 1. The abort — CONFIRMED, reproduced byte-exact

**The timeout is not in `gemmaClient.js`.** That module holds no timeout at all; its stated contract is that "Timeouts and abort handling are the caller's job (pass an AbortSignal)" (`gemmaClient.js:26-28`, VERIFIED). The 15s value lives in the handler:

```js
// api/agent/chat.js:393-394
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 15000);
```

The signal is passed to `fetch` at `gemmaClient.js:78` (VERIFIED). A `fetch` signal covers **the whole request, including the body read** — not just the connection. The response is read whole via `response.json()` at `gemmaClient.js:92`, not streamed (VERIFIED).

That creates **two abort windows with completely different outcomes:**

| Abort lands… | `fetch` behaviour | `error.name` | `chat.js:681` sees | Status | Log line | Client string |
|---|---|---|---|---|---|---|
| **before headers** | rejects | `AbortError` | `isAbort = true` | **504** | `[VoiceLayer] Request timed out` | "Agent took too long." ✅ |
| **during body read** | resolves 200, `.json()` throws | `Error` | `isAbort = false` | **500** | `[VoiceLayer] Error:` | "Agent is thinking too hard." ❌ |

The second row is the incident. The `AbortError` is caught by the JSON-parse handler and rewritten:

```js
// api/_utils/gemmaClient.js:93-99  — catch written for malformed JSON, catching an abort
} catch (jsonErr) {
  return { ok: false, status: response.status,
           errorText: `Invalid JSON from OpenRouter: ${jsonErr.message || 'parse failed'}` };
}
// :139 — re-thrown as a plain Error; name is 'Error', not 'AbortError'
throw new Error(`OpenRouter ${result.status ?? 'unknown'}: ${result.errorText}`);
```

**Reproduced in this session** against a local server that sends `200` + headers, writes a partial body, then stalls — aborted at 300ms:

```
error.name              = Error
error.message           = OpenRouter 200: Invalid JSON from OpenRouter: This operation was aborted
chat.js isAbort         = false
→ HTTP status to client = 500
```

That message is **character-for-character the founder's production log line.** The `200` in the log is the tell: it is `response.status` from a response whose headers arrived fine. The model was answering. We hung up on it mid-sentence and then reported that it had spoken gibberish.

### The four features this disables

Everything built to handle a timeout is downstream of `isAbort` at `chat.js:681`, and is therefore dead on this path (VERIFIED):

1. `console.error('[VoiceLayer] Request timed out')` (`:683`) — never fires. Hence `[VoiceLayer] Error:` in the founder's log.
2. `res.status(504)` (`:716`) — never fires. **This is why the incident is titled "500s".**
3. `errorReason: 'gemma_timeout'` (`:711`) — never set; the shadow log records `handler_exception`, so production diagnostics have been mis-filing every one of these.
4. The client's honest string (`AgentChat.jsx:762`) — never selected.

### The existing test guards a scenario production cannot produce

`chat.test.js:309` ("AbortError → 504 + shadow logs gemma_timeout") passes today. It mocks `callGemmaVoice` to throw an error with `name` hand-set to `'AbortError'` (`:313-317`, VERIFIED) — bypassing `_callGemmaOnce`'s `catch` entirely, which is the only thing that matters. The guard asserts a fiction. Baseline run: **40/40 green** across `chat.test.js` + `gemmaClient.test.js`.

This is precisely the "tests that import what they guard" requirement in the task's §3. Any fix must add a test that drives a **real** abort through `_callGemmaOnce`, not a hand-named error object.

### Where the fix belongs: `gemmaClient.js`, not `chat.js`

`_callGemmaOnce` is shared by **six** callers. [CORRECTED: 13 — see the notice above] All five siblings use `callGemmaVoiceWithRetry`, which classifies aborts via `result.aborted` (`gemmaClient.js:181-187`) — a flag that is **also never set on the body-read path**, because `_callGemmaOnce` swallows the abort before it can propagate. Worse: those siblings map a non-aborted failure to **HTTP 200** (`workshop-chat.js:411`, VERIFIED), so the same defect there returns a cheerful "I hit a snag" with a success status.

Classifying the abort inside `_callGemmaOnce` fixes the incident and corrects all callers in one place. [CORRECTED: 13 callers, not six] Patching `chat.js` alone would leave the other callers mislabelling aborts. [CORRECTED: 12 others, not five]

---

## 2. The function budget — not the constraint

| Quantity | Value | Anchor |
|---|---|---|
| `maxDuration` | **30s** (explicit, not the plan default) | `chat.js:24` |
| First Gemma call timeout | 15s | `chat.js:394` |
| Internal turn deadline (gate) | `turnStartMs + 24000` | `chat.js:478` |
| Reserved for post-gate writes | ~6s | `chat.js:149-150` |

`vercel.json` declares no `maxDuration` (VERIFIED — only `includeFiles`); the per-file `export const config` governs.

Handler work before the call, in order (VERIFIED): `requireAuth` → `verifyIdToken`, a network round trip (`authMiddleware.js:34`); battle doc (`:191`); agent doc (`:224`); `resolveBudgetDay` (`:260`); `readAgentChatBudget` (`:262`); then a 5-way parallel `Promise.all` (`:294-308`). That is **five sequential round trips plus one parallel batch**, plus cold start. Prompt assembly is synchronous. Estimated 1–3s (ASSUMED — no production instrumentation exists; see §8).

**So on a turn where the repair does not run, ~9 seconds of the 24s deadline go unused.** The model is cut off at 15s while the function has budget to spare.

**⚠ A ceiling Option A must respect.** The 25s used by every sibling is **not safe here** — `chat.js` is the only Gemma caller with a second model call and a 24s internal deadline. A 25s first call would push the turn past `maxDuration: 30` and get the function killed by the platform: a raw gateway 504, **no shadow log, no honest string** — worse than today. The safe ceiling is `24s − overhead`, i.e. **~20s**. Above ~22s the repair path (§3) also silently stops running.

---

## 3. Retry and fallback — nothing wired

- **No retry.** `chat.js:397` calls `callGemmaVoice`, the single-attempt legacy signature. `callGemmaVoiceWithRetry` exists and retries once — but its own header (`gemmaClient.js:14`, `:116-117`) says it is *"Kept for backward compatibility with api/agent/chat.js. Prefer callGemmaVoiceWithRetry for new callers."* **`chat.js` is the last caller not migrated** — and it is the most user-visible one.
- Even the retry path would not help: a body-read abort returns `status: 200`, which is not in `TRANSIENT_STATUSES` (`gemmaClient.js:39`) → `isTransient` false → no retry. Fixing the classification (§1) is a **prerequisite** for Option B doing anything at all.
- **No provider pin, no fallback.** The request body (`gemmaClient.js:71-77`) carries only `model`, `messages`, `temperature`, `max_tokens`, `response_format`. **No `models[]`, no `provider`, no `provider.allow_fallbacks`.** The model is hard-pinned at `gemmaClient.js:33` to `google/gemma-4-26b-a4b-it`. Nothing from the D-40/§10 DeepSeek V4-Flash evaluation is wired anywhere (VERIFIED by grep across `api/`).
- **A second model call exists.** `ARCHETYPE_INTEGRITY_MODE` is live at `'enforce'` (`featureFlags.js:770`), so `chat.js:471` calls `gateDirective`, which may fire a repair call (`directiveGate.js:120`). It is well-behaved: bounded by `min(8s, deadline − now)` (`:105-108`) and it swallows its own errors (`:127` `catch { return null }`), so it degrades to a deterministic null and **cannot cause this 500**. The incident is unambiguously the first call at `chat.js:397`.
- **Minor, pre-existing (not the cause, reporting per §3):** `controller.signal` is passed to the gate at `chat.js:477`, but its timer was cleared at `:404` — so that signal can never fire, and `directiveGate.js:106`'s `signal?.aborted` check is always false. The repair is bounded by its own timer, so behaviour is correct; the parameter is inert. **Filed for separate tasking; not fixed here.**

---

## 4. Prompt size — measured; not the cause

Measured by executing `buildVoiceLayerPrompt` at HEAD with a realistic tournament battle (6 holdings, 10 bench names, 4 scout alerts, 8 trades, 10 chat exchanges, 5 convictions, live flags):

| Configuration | chars | ~tokens |
|---|---|---|
| Static floor (no battle, no snapshot) | 13,265 | 3,316 |
| + battle + agent, archetype block on | 20,010 | 5,003 |
| + full market snapshot | 27,408 | 6,852 |
| **Total request** (+ history, sent separately) | **30,618** | **~7,655** |

Output is capped at `max_tokens: 800` (`gemmaClient.js:35`).

**~7.7k in / 800 out is a modest request.** It does not explain a >15s response from a 26B MoE model under healthy conditions.

**There is no growth channel on the battle doc.** Every variable block is windowed at the assembly site (VERIFIED, cited but **not changed**):

| Block | Bound | Anchor |
|---|---|---|
| `chatExchanges` | last **10**, and only exchanges with a non-empty `userMessage` | `chat.js:371-373` |
| `trades` | last **5** of N | `voiceLayerPrompt.js:974` |
| `evaluations[]` | **never reaches the prompt** | grep: absent |
| `strategyBrief` | **never reaches the prompt** | grep: absent |
| Watchlist / scout alerts | bounded by the cache doc, not the battle doc | `:1754-1762` |
| Wire news lines | absent — `WIRE_NEWSLINE_ENABLED = false` | `featureFlags.js:1443` |

So a long Day-1 `rationale` is bounded by the 5-trade window; the 10 equipped names and the bench are the intended payload, not growth. **A battle doc cannot grow its way into this failure.**

One standing load worth naming: the archetype block adds **~7.4k chars (~1,850 tokens, +37%)** to every battle turn. It has been live since **Aug 12** (`625d4cbc`, PR #745) — three weeks before the incident, so it is **not what changed**, but it is why the prompt sits at 7.7k rather than ~5.8k, and it is the single largest trimmable block if Option D is ever ruled.

---

## 5. Upstream health — NOT MEASURED

**This environment cannot reach OpenRouter.** The agent proxy denies it:

```
{ "kind": "connect_rejected",
  "detail": "gateway answered 403 to CONNECT (policy denial or upstream failure)",
  "host": "openrouter.ai:443" }
```

So: no model availability check, no provider list, no live latency probe. **The founder must check the status page.** No response headers are captured on a failing call either — `gemmaClient.js` reads no `x-` headers and logs no provider or latency (VERIFIED), so nothing is recoverable from existing logs.

**What the code evidence does say.** The founder's own two observations are the strongest signal available:

- The preview branch `claude/phase-a2-tape-piece-javcyf` fails identically — and `git diff --stat origin/main...origin/claude/phase-a2-tape-piece-javcyf -- api/` is **empty** (VERIFIED). Zero `api/` changes.
- No commit touching the voice path in the last two days changes timing, prompt size, or the model.

**Conclusion: the code did not change; the latency did.** The 15s threshold was always too tight for its own budget — it simply had not been crossed until now. That makes this an upstream-latency event landing on a pre-existing presentation defect, and it means **fixing the wrap is correct regardless of what the status page says.**

---

## 6. Budget accounting — CORRECT, no fix needed

The 0/10 the founder saw after three failures is right, and it is right **by construction**, not by luck. Both counters are strictly downstream of the model call at `chat.js:397`:

- Per-battle: `FieldValue.increment(1)` at `:623`, inside the post-success write.
- League per-day: `chargeAgentChatBudget` at `:665`, guarded by the comment at `:658` — *"failed calls don't charge."*

A throw at `:397` jumps to the `catch` at `:680`, skipping both. **Verified by test:** `chat.test.js:495` ("no-charge-on-failure: a timed-out ask returns 504 and NEVER charges") — passing.

Caveat, stated for honesty: that test drives the *pre-headers* abort window (the mocked `AbortError`). On the real body-read path the status is 500, not 504 — but **the no-charge property holds either way**, because both counters sit after the same throw. P-1c non-atomicity is unrelated and untouched here.

---

## 7. The user-facing string — the honest branch already exists

```jsx
// src/components/Agent/AgentChat.jsx:761-763
} else if (res.status === 504) {
  setError('Agent took too long. Try again.');      // ← truthful, and never reached
} else {
  setError('Agent is thinking too hard. Try again.'); // ← what the founder sees
}
```

The client is **already correct.** It is being fed a 500 by a server that knows the call timed out. Fixing the wrap (§1) makes the existing 504 branch fire and the lie stops — **with no client change at all.**

**Does the error body carry a usable class?** On the 500 path, no: `{ error: 'Agent unavailable. Try again in a moment.' }` (`:718`) — prose only. The 502 parse path already does it properly — `{ error: 'gemma_invalid_shape', errorReason }` (`:445-449`) — so there is an in-file precedent for adding a machine-readable class to the timeout response, should the founder want the client keyed on class rather than status.

---

## 8. Measurability — p50/p95 cannot be reported

The task asks for p50/p95 after the fix. **This is not currently possible, before or after.** There is no latency instrumentation anywhere on the path: `gemmaClient.js` records no timing, and `shadowLogger.js` has no `latencyMs`/`durationMs` field (VERIFIED by grep). Existing shadow logs cannot yield a percentile.

Making the fix verifiable needs one small addition — a `gemmaLatencyMs` on the shadow-log payload, written on both success and failure. It is a few lines on a non-fenced file and would let the founder answer "did this work?" from data rather than from absence of complaints. **Flagged for the founder's ruling; not implemented.**

---

## 9. Two items needing a founder ruling before any code

**a. Branch-name mismatch (BUILD_RULES §2).** The task prompt says the branch is `fix/voice-chat-timeout`, cut from `main`, and that "the harness name is not used." The session was opened on **`claude/voice-chat-timeout-sff86y`**, and the harness instructs never to push elsewhere without explicit permission. §2 says to STOP when not on the expected branch. Content-wise it is moot — both sit on `origin/main` at `bf4bc84f` — but the two instructions name different branches, so **the founder should say which name to push.** No push will happen until he does.

**b. Fable review.** None of the recommended work touches `voiceLayerPrompt.js`, so on the recommended path **no Fable review is triggered.** Only Option D would trip it.

---

## 10. The four options, named

Sanctioned regardless of A–D, and recommended first:

> **The error-wrap fix.** Classify the abort inside `_callGemmaOnce` (`gemmaClient.js:93-99`) so an `AbortError` is reported as a timeout rather than "Invalid JSON" — which alone restores the 504, the `gemma_timeout` shadow reason, and the client's already-written honest string across all callers [CORRECTED: 13, not six], **without changing any timing value.**
>
> **The honest client string.** `The character couldn't answer just now · nothing was sent` — already ruled under the A2 addendum item 11; ships flag-off as a copy fix on a failing path. Note it is only *reachable* once the wrap fix lands.

| | Option | One-sentence recommendation |
|---|---|---|
| **A** | Raise the client timeout | **Recommend — 20s, not the 25s the siblings use:** the 15s cutoff sits ~9s inside a 24s deadline it never uses, but `chat.js` is the only caller with a second model call, so 25s would overrun `maxDuration: 30` and hand the user a platform-killed 504 with no log at all. |
| **B** | Retry once on abort | **Recommend only with A, and only after the wrap fix** — the retry path currently cannot see this abort at all (status 200 is not transient, `gemmaClient.js:39`), and at 2×20s it must be bounded by the 24s deadline or it will overrun the budget; migrating `chat.js` to `callGemmaVoiceWithRetry` also closes the last un-migrated caller. |
| **C** | Provider or model fallback | **Defer** — nothing is wired (no `provider`, no `models[]`, no `allow_fallbacks` at `gemmaClient.js:71-77`), and while adding `provider.allow_fallbacks` for the *same* model is a contained non-fenced change worth considering if the status page shows one degraded provider, any *model* change is a Fable review and a separate ruling. |
| **D** | Trim the prompt | **Do not take** — measurement refutes the premise: ~7.7k tokens with every variable block windowed (10 exchanges, 5 trades, no `evaluations[]`, no `strategyBrief`), so there is no growth to trim; it would touch `voiceLayerPrompt.js`, trigger a Fable review, and pre-empt the grounding arc for no measured gain. |

---

## 11. Filed for separate tasking (§3 — reported, not fixed)

1. The five sibling callers mislabel a body-read abort as a **non-aborted** failure and return **HTTP 200** with "I hit a snag" (`workshop-chat.js:411`; same shape in `watchlist-analysis.js`, `screener/chat.js`, `watchlist-dialogue.js`, `expand-signal.js`). Corrected as a side effect if the wrap fix lands in `gemmaClient.js`; listed so the blast radius is on the record.
2. `controller.signal` is inert when passed to the gate at `chat.js:477` (timer cleared at `:404`), making `directiveGate.js:106`'s abort check dead. Behaviour is correct; the parameter misleads.
3. No latency instrumentation on any Gemma call path (§8).

---

## STOP

Phase 0 complete. Nothing implemented, no repo file written, nothing pushed. Awaiting the founder's ruling on §10 (which options) and §9a (which branch name).

*The character being unable to answer is the one failure a player cannot forgive. Today it also lies about why — and that half is fixable without touching a single timing value.*
