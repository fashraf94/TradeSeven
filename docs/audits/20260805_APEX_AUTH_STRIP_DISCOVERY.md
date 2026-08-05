# Apex-domain auth strip — discovery / verification report (read-only)

**Date:** 2026-08-05
**Task:** production-hygiene fix for the apex→www 307 Authorization strip
(`docs/audits/20260805_PR2_POST_FLIP_LIVE_VERIFICATION.md:148`).

**Session preamble (BUILD_RULES §2/§3):** `git fetch origin` run first and recorded
(`origin/main...HEAD` = `0 0`). Branch: **`main`** — HEAD `1fdbc9ae`. Tree: `.claude/settings.local.json`
modified + 38 untracked scratch files (pre-existing, none mine). **No task branch was checked out**
— see BLOCKER 1. All citations VERIFIED = read this session.

**Fence statement (BUILD_RULES §1):** nothing edited (read-only phase). Neither
`api/_utils/tournamentOrchestrator.js` nor `api/tournament/training-pick.js` is on the §1 fence list.
The deploy target `api/agent/decide.js` IS fenced — not touched, not proposed for touching.

---

## Executive verdict

| # | Question | Verdict |
|---|---|---|
| 1 | Does `deployBaseUrl()` resolve `TOURNAMENT_DEPLOY_BASE_URL` first? | ✅ **YES** — first branch, unconditional return |
| 1 | Can it "fall through to the apex" once the var is set? | ✅ **NO fall-through** — but see the two caveats below |
| 1 | Is the apex reachable at all from this function? | ⚠️ **YES**, via the line-209 fallback when the var is unset |
| 2 | Would the requested regression test be a real guard? | ❌ **NO as specified** — it cannot fail under the defect it names |
| 3 | Other internal callers constructing a production URL? | **1 in-scope, 3 out-of-scope, 1 filed** (table below) |

**Bottom line:** the env var you're about to set does work — precedence is correct. But the code
does not *enforce* www; it only *relays* whatever string the dashboard holds. The durable fix is
one small normalization in `deployBaseUrl()`, which then makes the item-2 test a guard that can
actually fail.

---

## Founder rulings (2026-08-05, at this STOP)

Recorded here so the audit trail is closed rather than left open:

1. **Branch:** authorized — `claude/apex-auth-strip-deploy-base-url`, cut fresh from `main` @ `1fdbc9ae`.
2. **Scope:** normalization ACCEPTED (trailing slash + apex→www on **both** the `:208` and `:209`
   paths; precedence unchanged), plus a **warning log on any actual rewrite** — founder addition,
   on the reasoning that a silent correction hides a misconfigured dashboard entry.
3. **Test spec:** the originally-specified row was withdrawn by the founder as unable to fail under
   the defect it named; the six-row matrix below replaces it.
4. **`scripts/verify-kb-entries.js:7`** folded into this branch after all — "a copy-paste 401 is
   worse than the diff is risky." It remains a comment-only change.
5. **Order of operations:** merge first, *then* set `TOURNAMENT_DEPLOY_BASE_URL` to the www host and
   redeploy — belt and braces, since the code now handles either value.

---

## 1. `deployBaseUrl()` verification — `api/_utils/tournamentOrchestrator.js:207-211` (VERIFIED)

```js
export function deployBaseUrl() {
  if (process.env.TOURNAMENT_DEPLOY_BASE_URL) return process.env.TOURNAMENT_DEPLOY_BASE_URL;   // :208
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`; // :209
  return null;                                                                                  // :210
}
```

Precedence is correct: `:208` returns unconditionally before `:209` is evaluated. With
`TOURNAMENT_DEPLOY_BASE_URL=https://www.fantasytrades.io` set in Production, `:209` is dead code at
runtime and the apex cannot be reached through it. Already covered by
`api/_utils/tournamentOrchestrator.test.js:306-311` (VERIFIED).

### Caveat A — the line-209 fallback IS the apex hazard (in scope, deployBaseUrl-adjacent)

`VERCEL_PROJECT_PRODUCTION_URL` is a Vercel *system* env var set to the project's assigned production
domain. If that assignment is the apex, `:209` returns `https://fantasytrades.io` — the exact bug —
silently, with no log line. This is the state production has been in. It re-arms the moment
`TOURNAMENT_DEPLOY_BASE_URL` is ever unset, renamed, or missed on a new environment; nothing in code
or CI would notice, because the failure mode is a 401 inside a fire-path that logs and defers.

### Caveat B — the env var is relayed verbatim, never validated

`:208` returns the raw string. Three dashboard values that pass today and break production:

| Value entered | `buildDeployRequest` produces (`:226`) | Result |
|---|---|---|
| `https://www.fantasytrades.io` | `https://www.fantasytrades.io/api/agent/decide` | ✅ correct |
| `https://www.fantasytrades.io/` *(trailing slash)* | `https://www.fantasytrades.io//api/agent/decide` | ⚠️ double slash |
| `https://fantasytrades.io` *(apex typo)* | apex | ❌ **the original bug, re-armed** |

So "never the apex" is currently a property of the dashboard, not of the code.

### Recommended fix (small, in scope)

Normalize inside `deployBaseUrl()`: strip a trailing slash, and rewrite a bare
`fantasytrades.io` host to `www.fantasytrades.io` for both the `:208` and `:209` paths. That makes the
guarantee structural — it holds for the typo'd dashboard value AND for the `:209` fallback — and it is
what makes the item-2 test a real guard. Consumers are unaffected: both call sites concatenate
`${base}/api/...` (`:226`, `training-pick.js:48`).

---

## 2. The regression test — as specified it is not a guard

BUILD_RULES §2 (review clause): *"Mutation-checked where it adds tests. A row that cannot fail under
the defect it names is not a guard."*

A test that stubs `TOURNAMENT_DEPLOY_BASE_URL=https://www.fantasytrades.io` and asserts the output
`!== 'https://fantasytrades.io'` passes trivially: it re-asserts the precedence already covered at
`tournamentOrchestrator.test.js:306-311`, and it cannot fail under the named defect, because the
named defect (a wrong or absent dashboard value) lives outside the code under test.

**Proposed rows that can actually fail** — each maps to a live defect, all under the normalization above:

1. apex value in the env var → output is `https://www.fantasytrades.io` (fails today)
2. apex in `VERCEL_PROJECT_PRODUCTION_URL` with the override unset → www (fails today; Caveat A)
3. trailing slash → no trailing slash (fails today; Caveat B)
4. precedence: override wins over `VERCEL_PROJECT_PRODUCTION_URL` (passes today; pins current behavior)
5. `buildDeployRequest().url` never matches `/^https:\/\/fantasytrades\.io/` under any of the above
6. unrelated hosts (`override.example`, `tradeseven.vercel.app`, preview URLs) pass through untouched —
   the rewrite must not generalize beyond the one production host

---

## 3. Census — every internal site constructing a production URL

Greps run over the repo (excl. `node_modules`): `fantasytrades\.io`,
`VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_URL`, `TOURNAMENT_DEPLOY_BASE_URL`,
`Bearer \$\{process\.env\.CRON_SECRET\}`, `https://\$\{`, `BASE_URL|SITE_URL|APP_URL|PUBLIC_URL`.

### In scope this branch (deployBaseUrl-adjacent)

| file:line | What | Disposition |
|---|---|---|
| `api/_utils/tournamentOrchestrator.js:207-211` | `deployBaseUrl()` — the definition | **FIX** (normalize; Caveats A+B) |
| `api/_utils/tournamentOrchestrator.js:226` | `buildDeployRequest` → `${base}/api/agent/decide`, `Authorization: Bearer CRON_SECRET` at `:229` | Inherits the fix; add assertion row 5 |
| `api/tournament/training-pick.js:42-52` | 2nd consumer — `${base}/api/tournament/activate-training-pod`, `Authorization: Bearer CRON_SECRET` at `:50` | Inherits the fix; no edit needed |
| `api/_utils/tournamentOrchestrator.js:48` | Header comment names the `:209` fallback as the primary target | Update to match new behavior |

Both consumers send `Authorization: Bearer CRON_SECRET`, so both were exposed to the strip.

### Out of scope — inspected, NOT the bug

| file:line | What | Why not |
|---|---|---|
| `api/_utils/security.js:28-29` | CORS allowlist contains both apex and www | Inbound browser-origin allowlist, not a caller. Both entries are correct and should stay. |
| `api/_utils/gemmaClient.js:68` | `'HTTP-Referer': 'https://fantasytrades.io'` | Outbound attribution header to OpenRouter; never fetched, no redirect, no Authorization of ours. |
| `api/season/pit-stop-reply.js:47` | same `HTTP-Referer` | Same. Also a de-registered season handler (BUILD_RULES §6). |

### Filed for separate tasking (BUILD_RULES §3 — reported, not fixed)

| file:line | What | Why filed |
|---|---|---|
| `scripts/verify-kb-entries.js:7` | Documented invocation `--api-url https://fantasytrades.io`; the script sends `Authorization: Bearer ${secret}` at `:158` to `${apiUrl}/api/academy/pull-chart-data` (`:150`) | **Same bug class, live.** Anyone copy-pasting the documented command gets a silent 401. Not deployBaseUrl-adjacent (manual dev script, own CLI arg), so not fixed on this branch — though it is a one-word doc-comment change if you want it folded in. |

### Supporting precedent (no action)

`scripts/ws1-observe-walk.js:292-336` already carries explicit 307 / cross-origin handling and tells
the operator to point `WS1_WALK_BASE_URL` at the *final canonical origin*. The repo has hit this
before in the WS1 walk; the tournament deploy path never got the same treatment.

---

## Blockers — both require a founder decision before any write

**BLOCKER 1 — branch (BUILD_RULES §2).** HEAD is `main` at `1fdbc9ae`. The rule is
"one task = one branch, cut fresh from current `main`", and the founder checks the branch out before
invoking; "if you're not on the expected branch, STOP." `main` is clean relative to `origin/main`, so
it is a valid cut point — but I have not created the branch. Say the word (or check one out) and I
proceed. Suggested: `claude/apex-auth-strip-deploy-base-url`.

**BLOCKER 2 — mandatory discovery STOP (BUILD_RULES §3).** "Every implementation task begins with a
read-only discovery/verification phase, then a hard STOP for founder review before any writes."
This report is that STOP.

**Also needs a ruling:** whether to take the normalization (recommended) or ship the
precedence-only test as originally specified. The task as written asks for a test whose row cannot
fail; the normalization is what turns it into a guard. Small diff either way — ~2 files, well under
the §2 review threshold.
