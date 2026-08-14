# The Mandate — Operations Runbook (Spec 1)

**Status:** operational reference of record for the founder-only dark run and beyond. Consolidates the operational knowledge accrued across the four phase audits (`docs/audits/20260812_MANDATE_PHASE2…` through `…PHASE5…`), the spec (`docs/SPEC1_MANDATE_SUBSTRATE_SPEC_V1_4.md`), and the charter (`docs/QUARTERLY_PORTFOLIO_RESTRUCTURE_CHARTER_V1_2.md`).
**Audience:** the founder (non-technical but rigorous), operating a headless, founder-only system. **The Mandate stays founder-only until Spec 2 exists** — nothing here un-flags anything for real users.
**The golden rule:** everything ships **dark**. The whole substrate is inert until a deliberate flag-flip PR after preview smoke. Flag flips are one-line PRs that carry their own pin reconciliation (BUILD_RULES §2/§11). **Pushed ≠ deployed; env change ≠ deployed** — a Vercel redeploy is required after any merge or env-var change.

---

## Activation sequence (the ordered founder operations)

Do these **in order**. Each arrow is "confirm the previous step, then proceed." Crons do not run on Vercel preview — cron behavior is verified by unit tests + the first production run (BUILD_RULES §6).

**Phase 6 Part A — registration (this PR).**
1. Merge the registration PR (`vercel.json` +2 crons, this runbook, the acceptance report). Handlers remain **no-op** while flags are dark — verified empirically (both cron handlers return `{noop:true, reason:'mandate_dark'}` at the master gate before any I/O). Registration is dark: nothing trades.
   - **Coordination note:** `vercel.json` is also touched by the concurrent composition-activation workstream, which temporarily removed 2 crons for its window (37→35) and restores them at its step 9. This PR appends the 2 mandate crons at the **end** of the array (35→37). Steady-state once composition restores its 2 = **39/40** — exactly the O-10 allocation (`37→39`), leaving 1 free slot. If both PRs are open together, resolve the `crons` array by keeping all entries (append-only, no interleave).

**Phase 6 Part C — env + light the substrate + smoke + create.**
2. **Set `MANDATE_FOUNDER_UIDS`** in Vercel env (comma-separated founder uid[s]) → **redeploy**. Until this is set, nobody is a founder and every founder endpoint fails closed. (See *Environment prerequisites*.)
3. Merge **Flip PR #1** (master + eval + close + founder-create light together) → **redeploy**. Now the eval/close crons do real work on their session-relative slots, and the founder create endpoint opens (flag AND allowlisted uid).
4. **Preview / production smoke** per house convention (authed calls on the www domain).
5. **Create the acceptance population** via `POST /api/mandate/create` (Firebase-authed founder uid, body `{archetype}`) — **one per archetype, all six**: `analyst, guardian, contrarian, diversifier, momentum_chaser, degen` (spans all three cadence tiers). Verify per book: `vintageRef` pinned, `portfolio.cash === 10_000_000`, `quarterIndex:1`; an intra-session creation writes a `partial:true` creation-day row at that day's close (I17).

**Phase 6 Part D — the dark run (≥10 market days; the calendar is the critical path).**
6. **Days 1–5+ on `direct` transport.** Daily founder check (see *Daily-check guide*).
7. **Flip to `batch` for ≥5 days** including a **Friday** and a **session followed by a market holiday** — merge **Config PR-D** (`MANDATE_TRANSPORT_MODE='batch'`) → **redeploy**. From Aug 13, 2026 the next holiday is **Labor Day, Mon Sep 7**, so the batch window must include **Fri Sep 4** (which satisfies both conditions in one session). Suggested plan: **direct Aug 17–21, batch Aug 24–Sep 4.**
8. **(Optional, only on a mode flip)** invoke the **drain** endpoint to release books gated on old-mode batches immediately (see *The drain endpoint*). If measurement disappoints, flip back to `direct` (revert Config PR-D) — direct is the permanent, fully-supported fallback (Risk 7).

**Phase 6 Part E — harness acceptance (parallel, dev/emulator).** Already green in-repo (160 mandate harness tests, 0 failed) — see the acceptance report. **Flip PR #2** (`MANDATE_ROLLOVER_ENABLED`) lights only when the accelerated-clock / rollover exercise begins, not day one.

**Phase 6 Part F — acceptance report.** Fill the live-wave rows of `docs/audits/MANDATE_ACCEPTANCE_REPORT_V1.md` as the run produces evidence. **Spec 1 is done when every executive-verdict row is ✅.**

### The registered crons (what fires, when)

Both handlers are calendar-gated and slot-resolving: the cron "fires generously" and the handler decides (no-op outside its windows, on holidays, and while flags are dark).

| Cron | `vercel.json` schedule (UTC, weekdays) | Covers |
|---|---|---|
| `/api/cron/mandate-evaluate` | `*/15 14,15,16,17,18,19,20,21,22 * * 1-5` | the three eval slots (open30 10:00 / midday 12:45 / preClose 15:30 ET) **and** the post-close close-duty window `[16:15,18:00)` ET, across **both** DST regimes and early-close days. Hours 14–22 UTC are the union of the EDT and EST bands; hour 22 gives the EST close window full retry coverage. |
| `/api/cron/mandate-rollover` | `*/15 12,13 * * 1-5` | the pre-market rollover window `[7:30,9:30)` ET. Every fire in 12:30–13:29 UTC lands strictly inside the window in **both** EDT and EST (the intersection); out-of-regime fires no-op. Idempotent (`lastProcessedRolloverKey`) + next-day catch-up backstop. |

*(Both schedules were independently re-derived and adversarially confirmed against every slot × DST regime × regular/early-close day — no coverage gap.)*

---

## Daily-check guide (what to look at each day of the run)

Five things, ~2 minutes. All are Firestore reads + a log grep; none require an endpoint.

1. **Rows complete (zero-gap, criterion #3).** For every active book, a `mandates/{id}/dailyRows/{today}` exists. Slow-tier books (analyst, guardian) must have the same coverage as fast. A missing row is the top-priority signal — investigate the close pass logs (`MANDATE_MISSED_MARKS`, `MANDATE_CLOSE_FAILED_STREAK`).
2. **Agency states (criterion #9).** Each row's `agencyState` ∈ `{full, exit_only, frozen, skipped:<reason>}` and matches what the book should have done. An unexpected `exit_only` means a quarantine — see *Quarantine restore*.
3. **Liveness / streaks (I9, Risk 7).** Read `execState.staleRejectStreak` per book (the **primary** wire) and watch for `MANDATE_STALE_STREAK` / `MANDATE_LIVENESS_LOW` in the logs. A platform of books rejecting everything is the top-risk failure — the streak distinguishes it from healthy HOLD-only books. Read the ratio with the *counter-asymmetry* caveat.
4. **Telemetry (criterion #6).** Skim `costTelemetry.estUsd` / `tokensIn` / `unpricedCalls` per book and `mandateUpstreamCalls/{today}`; on batch days, the `mandateBatchStats/{today}` turnaround. Watch for `MANDATE_RUNRATE_EXCEEDED`, `MANDATE_UNPRICED_SPEND`, `MANDATE_BATCH_UNBILLED_SPEND`.
5. **Alerts quiet.** Grep the Vercel function logs for `MANDATE_` — see the *Alert glossary* for what each token means and whether it needs action. On a healthy day the only mandate lines are the routine "sweep complete" / "batch … harvested" logs.

---

## Environment prerequisites & "pushed ≠ deployed"

**One-line answer:** Two independent switches gate founder mandate ops — the `MANDATE_FOUNDER_UIDS` env var (set in Vercel) and the `MANDATE_FOUNDER_CREATE_ENABLED` code flag (flipped by PR). Both fail closed, neither takes effect until a **redeploy**, and the allowlist must be live **before** you flip the flag. Set UIDS → redeploy → merge flip PR → redeploy → smoke → create.

### 1. `MANDATE_FOUNDER_UIDS` — the founder allowlist (env var)

**One-line:** A comma-separated list of founder uids, set in Vercel env; unset = nobody is a founder (fail-closed). Creation, accelerate, and drain each require BOTH the flag AND a uid in this list.

- **What it is.** `founderAllowlist()` reads `process.env.MANDATE_FOUNDER_UIDS`, splits on comma, trims, and drops empties — `api/mandate/create.js:29–34`. The uid stays out of the repo by design (`create.js:18–20`).
- **BOTH conditions, always.** Authorization is `Boolean(flagEnabled) && Array.isArray(allowlist) && allowlist.includes(uid)` — `create.js:41–43`. A flag alone is inert; an allowlisted uid without the flag is inert. This exact contract gates all three founder endpoints (IMPLEMENTED):
  - create — `create.js:63`
  - accelerate — `api/mandate/accelerate.js:32`
  - drain — `api/mandate/drain.js:44`
- **Unset = fail-closed.** No env var → `''` → `[]` → `.includes(uid)` is always false → **403 for everyone, including you** (`create.js:63–65`). This is the safe default, and it is unit-pinned: `create.test.js:38–39` asserts an unset var yields `[]`.
- **Ordering constraint:** it must be set in Vercel env **before** `MANDATE_FOUNDER_CREATE_ENABLED` is flipped true. If the flag goes live with the allowlist still unset, the endpoints are "on" but authorize nobody — safe, but a dead lever you'll be tempted to hot-fix under pressure (and a hot env edit without a redeploy does nothing — see §3).

### 2. `CRON_SECRET` — cron auth (env var, house convention)

**One-line:** Present per the in-repo pattern; it is the shared secret the mandate crons authenticate with. Setting it does **not** make the crons run anything.

- **How it's used.** Each cron accepts either the Vercel cron header or a bearer token: `req.headers['x-vercel-cron'] === '1'` OR `authorization === 'Bearer ${process.env.CRON_SECRET}'`, else 401 — `api/cron/mandate-evaluate.js:230–234`, `api/cron/mandate-rollover.js:45–49`. Same pattern BUILD_RULES §6 names as house convention (`docs/BUILD_RULES.md:77`).
- **SPEC-ONLY / not wired in Spec 1 — do not assume these crons fire.** Neither mandate cron is registered in `vercel.json` yet; registration is deferred to P6 (`mandate-evaluate.js:7`, `mandate-rollover.js:6–9`). And both no-op behind the master flag `MANAGED_MANDATE_ENABLED` before any I/O (`mandate-evaluate.js:237–239`, `mandate-rollover.js:52–54`). So `CRON_SECRET` being set is a prerequisite for auth, not evidence the crons do work — the schedule entry (P6) and the master flag are separate switches, both still off.

### 3. Deploy discipline — "pushed ≠ deployed"

**One-line:** Merging code and saving an env var are both inert until a **production redeploy**; preview never counts, and crons never run on preview.

- **Pushed ≠ deployed.** Vercel preview is the smoke-test surface only; production exists only after the founder confirms merge + deploy — `docs/BUILD_RULES.md:36` (§2). Claude pushes and stops; the founder merges and deploys (§2, `BUILD_RULES.md:37`).
- **Env var changes require a redeploy.** `MANDATE_FOUNDER_UIDS` is a Vercel env var — editing it in the dashboard changes nothing for the running deployment until you trigger a **redeploy** (Vercel platform behavior; the §2 "pushed ≠ deployed" discipline applies to config, not just code). Note the two levers use two different deploy triggers: the **env var** takes effect on a Vercel redeploy; the **flag** `MANDATE_FOUNDER_CREATE_ENABLED = false` is a code constant (`featureFlags.js:1600`) that only changes when a PR flips it and that merge deploys.
- **Crons don't run on preview.** Verification of cron behavior is unit tests on the guard logic + observation of the **first production run** — `docs/BUILD_RULES.md:76` (§6). Never report the mandate crons as "preview-tested"; they cannot be.

### Pre-flight checklist (ordered — do not reorder)

1. **Set `MANDATE_FOUNDER_UIDS`** in Vercel production env to the founder uid(s), comma-separated.
2. **Redeploy.** The env var is inert until this. Intermediate state is fully safe: allowlist present, flag still `false` → all three endpoints still 403 (`create.js:63`).
3. **Merge flip PR #1** — the PR that sets `MANDATE_FOUNDER_CREATE_ENABLED = true` (`featureFlags.js:1600`). Per §2 the flip PR reconciles its own value pins in the same commit (`BUILD_RULES.md:49`).
4. **Redeploy** (the production deploy of the merge). Only now is the gate open — and only for uids already in the allowlist from step 1.
5. **Smoke** on production: an allowlisted founder uid gets 201/200 from `POST /api/mandate/create`; any other uid gets 403.
6. **Create mandates.**

Rationale for the order: setting the allowlist first (steps 1–2) means the only thing changing at flip time (steps 3–4) is the flag, with the allowlist already proven live — the intermediate state is fail-closed at every step, and there is never a window where the gate is open with an empty or unverified allowlist.

## Quarantine restore (the two-field operation)

**One-line answer:** to bring a quarantined book back to full mode, set two fields on the Firestore doc `mandates/{mandateId}` — `health.quarantined = false` **and** `health.consecutiveEvalFailures = 0` — by hand. There is no endpoint; it is a direct Firestore edit, and you must clear **both** fields or it does not take.

### What quarantine actually is

Quarantine is **exit-only mode**, not a freeze. A quarantined book stays fully in the machine — it stays in the eval sweep (the sweep filters on `status=='active'` only, quarantined books included) and it is still marked every day by the close pass. What changes is that the manager can no longer **open or grow** positions; it can only **sell, trim, or hold**. Its daily rows are stamped `agencyState:'exit_only'` for as long as the flag is set (`api/_utils/mandateClosePass.js:108`).

This is deliberate constitutional behavior (C-21: a book must never be frozen solid while riding losing positions down — spec §6.4, `docs/SPEC1_MANDATE_SUBSTRATE_SPEC_V1_4.md:374-375`). Entries are blocked three times over — defense in depth:

1. **The decision tool itself** is stripped to `SELL | TRIM | HOLD`, so the model literally cannot emit a BUY or ADD (`effectiveVerbs`, `api/_utils/mandateDecisionTool.js`).
2. **The gate** re-blocks any entry that slips through (`api/_utils/mandateGate.js:100-102`).
3. **The exit lane stays open** — SELL/TRIM on a held symbol always passes regardless of quarantine (`api/_utils/mandateGate.js:80-89`), so the manager keeps de-risking.

### What triggers it

Quarantine flips when a book's **consecutive eval failures reach `MANDATE_QUARANTINE_THRESHOLD`, which is 5** (`api/_utils/mandateConfig.js:272`). "Consecutive" is the operative word — one clean eval resets the count to zero.

**Counts as an eval failure** (increments the counter): an unreadable/missing vintage (`MANDATE_NO_VINTAGE`); a failed model call (no usable tool response / malformed decision); a §3.5 execution-invariant abort (`status:'failed'`); any per-book exception during the sweep; and — under batch transport — an **undelivered cycle** (`failed` or `expired` batch result).

**Does NOT count** (resets the counter to 0): a delivered **HOLD**, or any executed / gated decision — a delivered answer is a completed eval. A lifecycle `cancelled` (rollover / escape / drain) touches health neither way.

So quarantine means five failures **in a row** with no completed eval in between — a book that is genuinely broken, not one that keeps choosing to hold.

### The exact restore operation — the two fields

On the Firestore doc `mandates/{mandateId}`:

```
health.quarantined             = false
health.consecutiveEvalFailures = 0
```

The code states this itself, verbatim, in the alert it emits when it quarantines a book (`api/cron/mandate-evaluate.js`, and identically in the batch path `api/_utils/mandateBatchTransport.js:269`):

> `founder restores by clearing BOTH health.quarantined AND health.consecutiveEvalFailures`

### Why BOTH must be cleared

The flip is governed by one condition — `failures >= MANDATE_QUARANTINE_THRESHOLD && !book.health?.quarantined` (`api/cron/mandate-evaluate.js:441`; same test in the batch path `api/_utils/mandateBatchTransport.js:263`). Read it against each half-fix:

- **Clear only `quarantined`, leave the counter at 5+:** the flag is down, but the counter still sits at/above threshold. The **very next per-book failure** takes it to 6, the condition sees `failures >= 5` and `!quarantined` both true, and it **re-quarantines on the spot**. You've bought at most one eval of relief.
- **Clear only the counter, leave `quarantined = true`:** the count is zero but the flag is still up, so the book stays exit-only. Nothing ever sets `quarantined` back to false on its own — you haven't restored anything.

Clearing both puts the book in full mode **and** resets its runway: it now needs a fresh five-in-a-row before it could quarantine again.

### How to do it — a founder operation

There is **no restore endpoint.** The founder-gated mandate endpoints are `create`, `drain`, `escape`, and `accelerate` — none lifts a quarantine. Restore is a **direct edit** to the `mandates/{mandateId}` document via the Admin SDK or the Firebase console. Key nuance: the **counter self-heals** (it resets to 0 on the next successful eval), but the **flag does not** (only your edit clears it). So a quarantined book keeps riding exit-only even after the cause is gone and the counter has drained. That is the tell: **investigate first** — pull the logs for that `mandateId`, find the `MANDATE_QUARANTINED` line and the failure it followed, fix the cause; clearing the flag while the cause persists just resets the countdown.

### Restore recipe

1. **Investigate.** In the logs for `{mandateId}`, find `MANDATE_QUARANTINED` and the failure cause immediately before it; confirm the cause is resolved.
2. **Edit** `mandates/{mandateId}` in Firestore (Admin SDK or Firebase console).
3. **Set both** `health.quarantined = false` and `health.consecutiveEvalFailures = 0` in one write — full mode resumes on the next eval tick.

## Cash-merger handling (founder-inserted delisting with cash-per-share)

**One-line answer:** There is no `merger` action type — a cash merger is entered as a `delisting` action carrying a `cashPerShare` field, written by hand into the universe daily doc; the next close pass force-closes the position at that cash price, sweeps the proceeds to cash, writes a `CORPORATE_CLOSE` receipt, and the symbol disappears from the book. No automated feed detects this class — founder insertion is the documented manual path.

### FR-4 V1 scope: mergers = delist-with-cash

Merger modeling is deliberately collapsed to delisting-with-cash for V1. FR-4: *"splits, cash dividends, stock distributions, ticker changes, delistings (forced close at last good mark). Mergers treated as delist-with-cash. Full merger/spinoff modeling is post-launch."* (`docs/SPEC1_MANDATE_SUBSTRATE_SPEC_V1_4.md:46`). §4.3 restates it: delisting/merger → *"forced close at last good mark, proceeds to cash, decision written `verb:'CORPORATE_CLOSE'`, symbol dropped from the carry-over build set"* (`SPEC1_MANDATE_SUBSTRATE_SPEC_V1_4.md:313`).

There is no `'merger'` value. `CORPORATE_ACTION_TYPES` is exactly `split, reverse_split, cash_dividend, stock_distribution, ticker_change, delisting` (`api/_utils/mandateSchema.js:37-39`) — a cash merger is a `delisting` **with a cash consideration attached**.

### How a corporate action reaches a book: automated feed vs founder insertion

- **Automated (slow layer):** the ONLY CA feed in the account (Q5) is EODHD's splits and dividends endpoints — `fetchCorporateActionsEODHD` fetches `/splits/{sym}.US` and `/div/{sym}.US` only (`api/_utils/mandateUniverseSnapshot.js:305-337`, endpoints at `:317-320`). It returns **splits and cash dividends and nothing else**. Delistings and mergers are not in any feed.
- **Founder insertion is the documented manual path for this class.** IMPLEMENTED: the *applier* fully supports `delisting` (`applyCorporateAction`, `mandateCorporateActions.js:246-271`); the module header states the source explicitly — *"Ticker changes and delistings have NO feed in the account (Q5) — the APPLIER supports them (founder-inserted action docs / a future feed)"* (`mandateCorporateActions.js:12-14`). SPEC-ONLY / not built in Spec 1: there is **no founder UI, no endpoint, no "insert CA" tool** — automated *detection* of delistings/mergers is deliberately omitted so a long halt is never auto-liquidated as a false delisting (review ambiguity #6, `docs/audits/20260812_MANDATE_PHASE3_CUMULATIVE_REVIEW.md:154`). The `cashPerShare` runbook path is ratified as ambiguity #13 (`:161`) and finding C21-5 (`:75`, `:133`).

### The exact shape a founder writes

The close pass reads pending actions from the close snapshot via `caActionsBySymbol`, which reads `snapshot.symbols[SYM].corporateActions[]` (`mandateUniverseSnapshot.js:605-611`). That array is denormalized onto every tick/close snapshot from the **universe daily doc** (`assembleFastEntries` copies `daily.corporateActions`, `:170`; the daily doc's per-symbol `corporateActions` field is written at `:425`). So the founder appends the action to the daily doc.

- **Collection / doc:** `mandateUniverseDaily/{YYYY-MM-DD}` — `DAILY_COLLECTION` (`mandateUniverseSnapshot.js:52`, ref built at `:367`). Use the **session date whose close should execute the merger**.
- **Field path:** `symbols.{TICKER}.corporateActions` — append one element to the array.
- **Element shape:**

```json
{
  "type": "delisting",
  "ticker": "ABCD",
  "effectiveDate": "2026-08-20",
  "cashPerShare": 24.50,
  "source": "founder_manual"
}
```

Field-by-field, exact:
- `type` = `"delisting"` (there is no `"merger"`).
- `ticker` = the held symbol, upper-case (normalized anyway at `mandateCorporateActions.js:45`).
- `effectiveDate` = `"YYYY-MM-DD"`. Gate: it must be **≤ the close-pass session date** or the action is skipped until that session (`pendingActionsFor`, `mandateCorporateActions.js:148`). A `delisting` is NOT date-entitlement-gated — it applies to any current holder regardless of `openedAt` (`DATE_ENTITLEMENT_TYPES` excludes it, `:137-138`; review ambiguity #12, `20260812_MANDATE_PHASE3_CUMULATIVE_REVIEW.md:160`).
- **`cashPerShare`** = the deal consideration per share (number). This is the exact field — VERIFIED at `applyCorporateAction`: `const dealPrice = Number(action.cashPerShare)` (`mandateCorporateActions.js:256`). It is NOT `amount` (that carries dividend-per-share only) and NOT `cashPerShare`-under-another-name. If omitted, the applier falls back to the last-good mark — which for a merger pinned inside a suspected-CA freeze is the **pre-announcement** price, permanently realizing a wrong value (the C21-5 defect the field exists to fix, `:75`).
- `source` = free label (recorded on the applied-log doc; use `"founder_manual"` for the audit trail).

Timing: `ensureDailySnapshot` is skip-if-built (`mandateUniverseSnapshot.js:340-341`), so **merge-update the already-built daily doc** — do not expect a rebuild. Write it before the `${date}_close` snapshot is built (the post-close window) so it denormalizes onto that snapshot.

### What the close pass then does

Ordered, per book, inside one revision-preconditioned transaction (`closeBook`, `api/_utils/mandateClosePass.js`):

1. **Select** — `pendingActionsFor` returns the delisting as pending: held ∩ effective ≤ date ∩ recognized ∩ not-yet-applied (`mandateClosePass.js:214`).
2. **Apply** — `applyCorporateAction` force-closes at the deal price: `mark = cashPerShare` (since `dealPrice > 0`), `proceeds = shares × mark`, position deleted from the book, `realizedPnl = proceeds − costBasisTotal` (`mandateCorporateActions.js:256-271`). Note string reads `delisting: forced close N sh @ cashPerShare $X → $Y` (`:269`).
3. **Cash** — proceeds land in `portfolio.cash` (`applied.cash`, applied at `mandateClosePass.js:262`).
4. **`CORPORATE_CLOSE` receipt** — a decision doc at `mandates/{id}/decisions/corp_close_{actionId}`, `verb:'CORPORATE_CLOSE'`, `status:'executed'`, `executedPrice = cashPerShare`, `executedSizeUsd = proceeds`, `executedShares`, `realizedPnl`, `fillMarkQuality:'carry_over'`, zero labeled friction (`mandateClosePass.js:275-304`).
5. **Symbol drops from carry-over** — the position was `delete`d in step 2, so it is neither marked nor carried over; it simply no longer exists on the book (`mandateCorporateActions.js:264`, comment `mandateClosePass.js:275-278`).

**Honesty caveat worth stating:** `cashPerShare` is consumed transiently — it is NOT persisted as its own field on the applied-CA log doc. `buildCorporateAction` has no `cashPerShare` key; its `amount` field is dividend-per-share and is written `null` here (`mandateSchema.js:347-365`; close-pass write passes `amount: action.amount ?? null`, `mandateClosePass.js:266`). The deal price survives durably in two places: the `CORPORATE_CLOSE` decision's `executedPrice` (`mandateClosePass.js:288`) and the CA log doc's `note` string (`:271`). If you need the number back later, read the decision receipt, not the CA log's `amount`.

### Idempotency (per {mandateId, actionId})

`actionId = delisting_{TICKER}_{effectiveDate}` — e.g. `delisting_ABCD_2026-08-20` (`deriveActionId`, `mandateCorporateActions.js:53-55`). Before applying, the close pass does a create-if-absent read of `mandates/{mandateId}/corporateActions/{actionId}` inside the transaction; if it already exists, the action is skipped (`mandateClosePass.js:250-252`; contract at header `mandateCorporateActions.js:16-17`). So a re-run of the same close, or a later close, never double-closes. The universe-level action reaches **every** book holding `ABCD`, but each book keys its own log doc — each holder force-closes exactly once.

**Related founder op (do not conflate):** if the symbol was already quarantined by a suspected-CA freeze before you insert the delisting, restoring it from quarantine is a **two-field** operation — clear `health.quarantined` AND `health.consecutiveEvalFailures` (C21-6, `20260812_MANDATE_PHASE3_CUMULATIVE_REVIEW.md:161`). Inserting the `delisting` with `cashPerShare` is the clean path and closes the position outright, so a manual quarantine-clear is usually unnecessary.

## The drain endpoint (§3.3 / F26)

**One-line:** POST `/api/mandate/drain` (founder-gated) force-cancels every open provider batch and frees the books gated behind them **now**, instead of waiting the ≤4h auto-expiry — use it only when you flip `MANDATE_TRANSPORT_MODE` mid-run. IMPLEMENTED: `api/mandate/drain.js`, `drainOpenBatches` at `mandateBatchTransport.js:756`.

### What it does
Walks every `mandateBatches/*` doc still `status:'open'` and, per batch (`mandateBatchTransport.js:763-801`):
1. Stamps `drainRequested:true` on the batch doc **before** cancelling (`:768`) — so any `canceled` rows a later harvest streams keep the drain wording instead of flipping to the lifecycle word (`dispositionForResultType`, `:238-247`; audit fix SPEC-P5-3).
2. Cancels the provider batch, best-effort (`:769`; a failed cancel logs and proceeds).
3. Writes every still-undelivered entry's **decision** `rejected_stale` with `failCondition:'drained_transport_change'` (`:779-782`) — a drain is a staleness event by fiat: the mode is changing, results must not be applied (spec §3.3, `SPEC1…:236,248`).
4. When all entries are disposed, finalizes the **batch doc** to `status:'cancelled'` (`:796`), recording any unbilled provider spend.

Word split is deliberate (audit §5 reading 3): the *batch doc* → `cancelled` (the I1 lifecycle word, `SPEC1…:242`); each *decision* → `rejected_stale`. A drain bumps each freed book's stale-reject streak by 1 (I9-honest — the submissions did die undelivered).

### When to use it
**Only on a transport-mode flip** — `batch→direct` or `direct→batch` — to release books whose `execState.openBatchId` is gated on old-mode batches immediately. Sequence: flip `MANDATE_TRANSPORT_MODE` (a separate one-line config PR — SPEC-ONLY in Spec 1; the flag stays `'direct'` pinned and everything ships dark, audit §0/§8, `SPEC1…:384`), then invoke this. Freed books resume under the new mode on their next tick (at most one sweep-stamp slot cost). Mode-agnostic and safe under either transport, so flip-then-drain and drain-then-flip both work (`drain.js:24-26`).

### How it is gated
**Founder flag AND allowlisted uid — the exact create/accelerate contract** (`drain.js:44`, `isFounderAuthorized` from `create.js:41`). Both required:
- Flag: **`MANDATE_FOUNDER_CREATE_ENABLED`** (`drain.js:33` — reused, no new flag; P4 ambiguity-4 precedent).
- Allowlist: uid must be in **`MANDATE_FOUNDER_UIDS`** (env, comma-separated; unset ⇒ nobody, fails closed — `create.js:29-34`).

A flag alone is not authorization, an allowlisted uid without the flag is not either, and a failure returns an opaque `403 forbidden` (`drain.js:45`) that never reveals which condition failed. Rate-limited 5/60s (`drain.js:36`).

### Explicit / invocable only
A mode flip triggers **nothing implicit** — there is no auto-drain on config change (`drain.js:8-11`; audit item 3 proves a `'direct'` fire with open batches neither polls nor executes them). The drain runs if and only if you POST this endpoint.

### Idempotency — re-invoke until `batches: 0`
Already-terminal entries and already-finalized docs no-op (`drain.js:20`). A batch whose entries hit lease contention or errors is left **open** and counted `incomplete` (`mandateBatchTransport.js:797-800`); the pass then logs **`MANDATE_DRAIN_INCOMPLETE`** loudly (`:802-808`). Operational rule: **re-invoke until the response reports `batches: 0`.** The JSON response is `{ success, batches, disposed, leaseSkips, errors, incomplete }` (`drain.js:51`) — a clean finish is `batches` counted with `incomplete: 0` and no remaining open docs.

### The HTTP call
```
POST /api/mandate/drain
Authorization: Bearer <Firebase ID token>
```
POST only (any other method → `405`, `drain.js:37`); no request body; uid is derived from the token, never the body.

### Automatic backstops — the drain is the PROMPT path, not the only one
Books do not depend on the drain to recover; two automatic releases run under **either** transport:
- **In-sweep gate expiry (`MANDATE_GATE_EXPIRED`)** — the eval sweep expires any `openBatchId` older than `MANDATE_RESULT_MAX_AGE_MS` (**4h**, `mandateConfig.js:134`) at the book's next eligible tick, disposing it `expired` and evaluating the book that same fire (`mandate-evaluate.js:125`; transport-independent, audit §2.5). The `MANDATE_OPEN_BATCH_UNDER_DIRECT` alert on a stuck `direct`-mode gate explicitly points here or to the drain (`mandate-evaluate.js:481`).
- **Close-pass expiry** — the once-daily close pass expires stale open submissions to `expired`/`result_age` and clears the gate (`mandateClosePass.js:185-205`).

So the **books** always self-heal within ≤4h + a slot. What the backstops do **not** finish is the **batch doc**: an undrained doc sits `open` until founder action or the 30-day **`MANDATE_BATCH_STUCK_OPEN`** alert (audit §2.2). The drain is the only path that both frees the books immediately *and* closes the batch docs — invoke it when you can't wait 4h, and re-invoke to `batches: 0`.

## MANDATE_VINTAGE_BREAK_GLASS — Break-Glass Vintage Override

**One-line answer: this lever is SPEC-ONLY. `MANDATE_VINTAGE_BREAK_GLASS` is defined in the spec and charter but is NOT built in Spec 1 — there is no env var, no flag, no endpoint, no code path. Do not attempt to invoke it. If a provider outage or model-safety event occurs pre-Spec-2, the real fallback is to pause the mandate eval loop by flipping `MANDATE_EVAL_ENABLED → false` (a one-line flag PR).**

### What break-glass is FOR (the design intent)

An emergency **model substitution across all active books** during a provider outage or a model-safety event — the one sanctioned way to override the model seat that each book's vintage has pinned for the quarter.

The pin is the thing it would override. Every book freezes its manager's model identity (provider, model id, generation params) into a content-addressed, immutable vintage at creation, so a mid-quarter model swap *cannot* reach an active book — model/gate changes propagate only per-user at rollover (charter D-44, `docs/QUARTERLY_PORTFOLIO_RESTRUCTURE_CHARTER_V1_2.md:63`; spec FR-6, `docs/SPEC1_MANDATE_SUBSTRATE_SPEC_V1_4.md:48`). That freeze is real and implemented: the model seat is baked into the vintage payload at `api/_utils/mandateVintage.js:114` (`modelSeat`), sourced from `getModelSeat` in `api/_utils/mandateGenerationConfig.js:63`, and the model seam reads provider/model/params *only* from the pinned vintage, "never a live config read" (`api/_utils/mandateModelCall.js:4-7`).

Break-glass is the deliberate exception to that freeze: the emergency escape valve that reaches *inside* every active pin at once to swap the model seat when the pinned provider/model is down or must be pulled. Per spec, using it is a **logged platform event, stamped on every affected receipt, and reported at the next founder review** (`docs/SPEC1_MANDATE_SUBSTRATE_SPEC_V1_4.md:326`; charter D-44). That receipt-stamp + founder-review reporting is part of the lever's *design*, not code that exists today.

### Implementation status in Spec 1 — plainly

**Spec-defined, not implemented in Spec 1 (deferred).** A full-tree search finds `MANDATE_VINTAGE_BREAK_GLASS` (and every spelling of "break-glass") only in the two design docs — `docs/SPEC1_MANDATE_SUBSTRATE_SPEC_V1_4.md` and `docs/QUARTERLY_PORTFOLIO_RESTRUCTURE_CHARTER_V1_2.md`. There is **zero** occurrence in any `.js`, `.ts`, `.json`, or env file. Concretely:

- No env var and no feature flag by that name exists (`src/config/featureFlags.js` mandate block, lines 1539–1609, has no break-glass entry).
- No override path exists in the seat/vintage code: `mandateVintage.js` freezes the seat with no override input; `getModelSeat` (`mandateGenerationConfig.js:63`) merges only a static per-archetype override map over the default seat — there is no runtime/emergency substitution.
- No endpoint accepts a break-glass invocation.

The lever exists on paper because the pin makes normal model changes deliberately unreachable mid-quarter (D-44); the emergency override to that rule was named but its build was pushed past Spec 1.

### Why this is low-risk in Spec 1 (context the founder needs)

The state break-glass protects against — active books being served by live model calls — is one **Spec 1 does not enter by default**. Spec 1 is headless and every mandate flag ships dark: `MANAGED_MANDATE_ENABLED = false` (`src/config/featureFlags.js:1556`), `MANDATE_EVAL_ENABLED = false` (`:1564`). With eval dark, the evaluation cron no-ops and makes no model call at all — it returns `mandate_eval_dark` and exits (`api/cron/mandate-evaluate.js:255-256`). No production user's book is calling the provider, so a provider outage has nothing live to break.

### The realistic fallback (if mandate eval is ever live pre-Spec-2)

If mandate eval has been switched on for founder/dark testing and the provider then goes down or a model must be pulled:

1. **Pause eval — the primary move.** Flip `MANDATE_EVAL_ENABLED → false` (`src/config/featureFlags.js:1564`). The evaluate cron immediately no-ops (`api/cron/mandate-evaluate.js:255-256`) — no snapshot, no submit, no call to the down provider. This *stops* the harm; it does not substitute a model (substitution is exactly the capability that is unbuilt).
2. **Full stop, if broader.** Flip the master gate `MANAGED_MANDATE_ENABLED → false` (`:1556`) to render the entire substrate inert.
3. **Transport (batch-specific, not an outage fix).** `MANDATE_TRANSPORT_MODE` (`:1609`) is already `'direct'` by default; forcing it to `'direct'` helps only a batch-transport-specific problem, and a mode change takes effect only after open batches drain — it is not a provider-outage remedy.

**Flip mechanics:** each of these is a separate one-line flag PR after a preview smoke — never inside a build PR — and the flip must reconcile the flag's pin in `api/_utils/mandateFlags.test.js` in the same commit (per `BUILD_RULES §2/§11`, noted at `src/config/featureFlags.js:1543-1545`).

**What you cannot do pre-Spec-2:** hot-swap the model into live books. Editing `MANDATE_DEFAULT_MODEL_SEAT` (`mandateGenerationConfig.js:25`) changes the seat only for *newly built* vintages; by the D-44 pin it will not reach any active book until that book's rollover. Pre-Spec-2 the only emergency action is **stop** (pause eval / kill the master gate), not **substitute**.

## Reading the acceptance counters (the counter-asymmetry)

**Operational answer: read the STREAK (`execState.staleRejectStreak`) and the `MANDATE_STALE_STREAK` / `MANDATE_LIVENESS_LOW` alerts as ground truth for liveness. Treat `executedVsSubmitted` as directional only — it is structurally biased toward "healthy" in exactly the failure mode you are watching for.**

### The three counters — what each actually counts

All three live on `execState` and move ONLY through the one shared builder `execStateTerminalPatch` (`mandateExecution.js:328-346`), which every result terminal (`executeDecision`) and every result-less terminal (`disposeSubmission`) routes through — IMPLEMENTED.

| Counter | Bumped when | Anchor | Reads as |
|---|---|---|---|
| `execState.submitted` | +1 on **every** terminal that flows through the shared patch (executed / gated / rejected_stale / expired / failed / cancelled) | `mandateExecution.js:342` | count of *dispositioned terminals*, NOT of submissions — the submit/gate txn is non-incrementing (audit §5.1, line 245) |
| `execState.executed` | +1 only when `status === 'executed'` | `mandateExecution.js:343` | live fills — and **a HOLD is an `executed` terminal** (`mandateExecution.js:169-170`), so a HOLD-only book climbs this counter |
| `execState.staleRejectStreak` | +1 on `rejected_stale` OR `expired`; **reset to 0** on executed / gated / failed / cancelled | `streakAfter`, `mandateExecution.js:304-308`, applied at `:344` | consecutive stale/aged submissions — the liveness wire |

The daily row snapshots the first two as `submittedCum` / `executedCum` at close (`mandateClosePass.js:430-431`; schema `mandateSchema.js:261-262`). The streak is not put on the row — it is read live off the book and off the alert.

### The primary wire is the STREAK; the ratio is a coarse secondary (founder ruling)

Because a HOLD counts as `executed`, a book that correctly decides to hold all day is HEALTHY and its `executed` climbs — so the executed/submitted ratio **cannot** be the liveness test (`mandateExecution.js:302-303`, `:618-623`; config note `mandateConfig.js:275-283`). The unhealthy book is the one that only ever *rejects*. That is what the streak measures, and it is why `MANDATE_STALE_STREAK_ALERT = 3` (`mandateConfig.js:279`) is the primary instrument.

`trailingLivenessRatio` (`mandateClosePass.js:557-567`) is `Δexecuted / Δsubmitted` over the last `MANDATE_LIVENESS_WINDOW_ROWS = 10` rows, floored at `MANDATE_LIVENESS_FLOOR = 0.5` (`mandateConfig.js:284-285`), and returns **null when `dSub < 5`** (`:565`) — "too quiet to judge." It is explicitly the coarse secondary signal (audit §2.5, line 132; §5.13, line 257).

### The documented asymmetry — why the ratio lies precisely in the slow-failure mode

Three disposal paths clear the open-batch gate WITHOUT routing through `execStateTerminalPatch`, so they **do NOT increment `execState.submitted`** (IMPLEMENTED; audit §4.2 #23 line 205, §5.13 line 257):

- **Close-pass open-batch expiry** (`mandateClosePass.js:186-208`): bumps the streak — `staleRejectStreak += 1` at `:206` — and clears the gate at `:459-460`, but writes **no** `submitted` increment. Streak moves, denominator does not.
- **Rollover cancel** (`mandateRollover.js:201-204`, `:213-218`): clears the gate and writes a `cancelled` decision, but its patch (`:180-194`) touches **neither** the streak **nor** `submitted`. A lifecycle event, not a liveness event — counters simply carry forward.
- **Escape cancel** (`mandateEscape.js:134`, `:161-175`): same — gate cleared, no counter of any kind moves.

Contrast the PRIMARY batch-mode path — the harvest age-out through `disposeSubmission` — which DOES bump both (`mandateExecution.js:410` → `execStateTerminalPatch` → `submitted++` at `:342` and streak++ at `:344`).

The consequence you must internalize: in the **slow / never-harvested** failure mode, submissions are not disposed by the harvest lane (nothing harvests them in-session) — they are backstopped once a day by the close-pass expiry. That path moves the streak but leaves `submitted` flat, so `dSub` barely grows (often stays under 5, and the ratio returns **null** and stays silent). The ratio therefore fails to degrade — it is biased toward "healthy" **exactly** when the book is quietly failing to turn its batches around. The streak, on that same path, climbs +1 per night and trips `MANDATE_STALE_STREAK`.

(Two further asymmetry variants exist and are benign: rollover/escape move no counters — do not read a flat ratio around a quarter boundary or a re-assignment as signal; and the in-sweep gate expiry bumps the streak but not `consecutiveEvalFailures` because the book is re-served the same fire — audit D5, line 233.)

Note for this acceptance run: transport ships dark (`MANDATE_TRANSPORT_MODE = 'direct'`, pinned — audit line 6), so the gate is rarely set and these open-batch disposal paths are rarely reachable in direct mode. The asymmetry is a **batch-mode** property you are pre-reading for the P6 flip; the streak-first discipline holds in both modes.

### What healthy looks like vs a batch-turnaround problem (Risk 7)

**Healthy:**
- `staleRejectStreak` sits at 0 or low and *resets often* — every executed/gated/failed terminal zeroes it (`mandateExecution.js:304-308`).
- No `MANDATE_STALE_STREAK` (`mandateBatchTransport.js:277-282`), no `MANDATE_LIVENESS_LOW` (`mandateClosePass.js:572-573`).
- `executedVsSubmitted` near 1 (HOLDs count), or null in genuinely quiet windows — both fine.
- Per-day turnaround samples in `mandateBatchStats/{date}` show submit→harvest completing within the session (audit §1 item 5, line 42).

**Batch-turnaround problem:**
- `staleRejectStreak` **monotonically climbs** — roughly +1 per session as the nightly close-pass expiry backstops each undelivered submission — and reaches 3 → `MANDATE_STALE_STREAK <mandateId> — N consecutive stale-rejected/expired submissions (I9 liveness)`.
- **`executedVsSubmitted` stays flat/healthy-looking or null**, and `MANDATE_LIVENESS_LOW` may never fire — because the close-expiry disposals never grew `submitted`. This silence is the asymmetry working exactly as documented, not an all-clear.
- `mandateBatchStats` turnaround/harvest-lag samples run long or show batches not ended by the session's harvest fires.

The rule for the run: if the streak is climbing or `MANDATE_STALE_STREAK` has fired, you have a liveness problem **even if the ratio looks fine and `MANDATE_LIVENESS_LOW` is quiet**. Never invert that — never let a healthy-looking ratio override a rising streak.

## Orphan-batch reconciliation (manual; build nothing)

**Operational answer: do nothing. An orphaned provider batch self-heals — it costs bounded tokens, expires provider-side in ~24h, and leaves zero dangling state on our side. Reconciling real provider spend against telemetry is OPTIONAL and MANUAL: enumerate batches in the Anthropic console with `messages.batches.list` and eyeball them against `mandateBatchStats`. Spec 1 builds NO tooling for this — there is no in-repo endpoint. Do not go looking for one.**

### What an orphan IS

A provider Message Batch that got created but never got a bookkeeping doc. Submit runs in a fixed order (crash-safety by design): provider create FIRST, then the `mandateBatches/{providerBatchId}` doc, then the per-book gate writes — `api/_utils/mandateBatchTransport.js:162-185`. If the process dies in the gap between `createMandateBatch(...)` (`:166`, the billing moment) and the doc `.set(...)` (`:183`), the batch exists at Anthropic but has **no** `mandateBatches/{id}` doc. It is invisible to our state machine — the harvest only ever queries docs `where('status','==','open')` (`:493-495`), so a batch with no doc can never be enumerated, harvested, or billed by us. Crash-window commentary: `mandateBatchTransport.js:59-62`; P5 audit §2.3 crash table, `docs/audits/20260813_MANDATE_PHASE5_CUMULATIVE_REVIEW.md` (row "after create, before batch doc").

### Why it is bounded and self-healing (no action required)

- **No dangling OUR-side state.** No doc, so nothing to finalize; no gate writes ran, so no book is gated. Every book in that batch was already billing-stamped at enqueue (`execState.lastEvalTickKey`, written under the book's lease in `mandate-evaluate.js`), so the slot skips them and they **re-submit fresh next slot under NEW requestIds** — clean, no double-gate. `mandateBatchTransport.js:55-62`; audit §2.3.
- **The orphan just evaporates.** It is never harvested (no doc to find it) and expires provider-side in ~24h. `mandateBatchTransport.js:61`; audit §7. (This is the same 24h provider expiry the billing give-up horizon is sized against — `MANDATE_BATCH_BILLING_GIVEUP_MS = 26h`, `mandateConfig.js:325`.)
- **Bounded token waste.** One provider batch's worth of prompt tokens, once, per crash — real spend we cannot observe, but capped and rare. `mandateBatchTransport.js:50-52, 61-62`.

### The two loud signals — and why an orphan trips NEITHER

Both signals exist for the ADJACENT failure where a doc *does* exist; an orphan has no doc, so it is silent by design (there is no our-side record to alert from — `mandateBatchTransport.js:61-62`).

- **`MANDATE_BATCH_UNBILLED_SPEND`** — fires when a batch that HAS a doc ends up with observed-but-unbillable spend (the batch never ended within the billing horizon; understatement made loud, never silent). `mandateBatchTransport.js:449-454`, emitted at `finalizeBatch` with an `unbilledRequestCount`. An orphan never reaches `finalizeBatch` (no doc), so it never raises this.
- **`MANDATE_BATCH_STUCK_OPEN`** — fires when a bookkeeping doc is still `'open'` past the 30-day retention window (`MANDATE_BATCH_RETENTION_DAYS`); the doc is NOT deleted (it may hold undisposed submissions, I1) and flagged for founder review. `mandateClosePass.js:636`. Again: an orphan has no doc, so it never raises this either.

Bottom line: absence of these alerts does not mean absence of orphans. The only way to see orphan spend is the manual audit below.

### The MANUAL reconciliation path (optional; provider console only)

**SPEC-ONLY — not built in Spec 1.** If you want to audit real provider spend against our telemetry:

1. In the Anthropic console (or the SDK against the account key), call `messages.batches.list` to enumerate every Message Batch the account created in the window.
2. Compare that list against our record: `mandateBatchStats/{sessionDate}` docs, each carrying a `batches` map keyed by `providerBatchId` (written at `finalizeBatch`, `mandateBatchTransport.js:430-447`; collection name `mandateBatchStats`, `:104`). Any provider batch id absent from that map — and absent from the `mandateBatches` collection — is an orphan: created, never bookkept, unbilled in our figures.

**Explicitly: there is no `batches.list` tooling in this repo.** The only in-repo provider call is `retrieveMandateBatch(id)` — single-id, not account-wide (`mandateBatchTransport.js:558`). Account-wide enumeration is a P6 ops-tooling candidate, deliberately kept out of the money path — P5 audit §7 ("If ops wants them enumerable, a `batches.list` reconciliation belongs in P6 ops tooling, not the money path"). This runbook step is a manual, provider-console operation you run by hand; nothing in the codebase performs or schedules it.

## Alert glossary

Every token below is emitted by a `console.error` in the mandate code. Severity is operational, not the log level (all are `error`): **INFO** = expected, self-heals; **WARN** = degraded-but-backstopped, watch it; **ACTION** = the founder must do something or state stays broken.

### Health / quarantine

| Alert | Severity | Means | Founder action | file:line |
|---|---|---|---|---|
| `MANDATE_QUARANTINED` | ACTION | Book hit the consecutive-eval-failure threshold; locked to exit-only mode (tool restricted to SELL/TRIM/HOLD, entries blocked), still swept and marked daily. | act now: fix the eval-failure cause, then clear BOTH `health.quarantined` and `health.consecutiveEvalFailures` to restore | `api/_utils/mandateBatchTransport.js:267` (also `api/cron/mandate-evaluate.js:450`, `:581`) |
| `MANDATE_NO_VINTAGE` | ACTION | Book's pinned vintage doc is unreadable; the book writes nothing and every miss counts toward quarantine. | act now: repair the `vintageRef` / republish the vintage | `api/cron/mandate-evaluate.js:511` |

### Liveness (I9)

| Alert | Severity | Means | Founder action | file:line |
|---|---|---|---|---|
| `MANDATE_STALE_STREAK` | ACTION | Consecutive stale-rejected/expired submissions — the **primary** liveness wire; the book submits but nothing lands. | investigate: transport/latency path (drain state, gate timing) | `api/cron/mandate-evaluate.js:129` (also `:526`, `api/_utils/mandateBatchTransport.js:279`) |
| `MANDATE_LIVENESS_LOW` | WARN | Trailing executed-vs-submitted ratio below floor — a coarse secondary signal (HOLD counts as executed). | monitor; confirm against the stale-streak wire before acting | `api/_utils/mandateClosePass.js:573` |

### Cost / telemetry

| Alert | Severity | Means | Founder action | file:line |
|---|---|---|---|---|
| `MANDATE_RUNRATE_EXCEEDED` | WARN | Month-to-date `estUsd` for a book crossed the D-22 cost band. | monitor (cost only; no trading impact) | `api/_utils/mandateClosePass.js:576` |
| `MANDATE_UNPRICED_SPEND` | WARN | A day had model calls with no price-table entry — run-rate/`estUsd` understate real spend. | act now: add the model id to `MODEL_PRICES_PER_MTOK` | `api/_utils/mandateClosePass.js:583` |
| `MODEL_PRICE_UNKNOWN` | WARN | No $/MTok entry for a model id; that call's `estUsd` recorded null (never a silent $0). Once per id per process. | act now: add the model id to `MODEL_PRICES_PER_MTOK` | `api/_utils/modelPriceTable.js:70` |
| `MANDATE_PROMPT_BUDGET_TRIM` | INFO | Candidate slate auto-trimmed to fit the input-token budget; proceeds. | none — self-healing | `api/_utils/mandatePromptAssembly.js:187` |
| `MANDATE_PROMPT_BUDGET_EXCEEDED` | WARN | Scaffold + book context alone exceed the token budget with zero candidates; sends anyway (alert, not block). | monitor; recurrence means book context is oversized | `api/_utils/mandatePromptAssembly.js:197` |

### Batch transport

| Alert | Severity | Means | Founder action | file:line |
|---|---|---|---|---|
| `MANDATE_BATCH_ZOMBIE` | INFO | Request(s) in flight without a gate (book moved between eval read and gate write); results converge on the decision-doc claim. | none — self-healing | `api/_utils/mandateBatchTransport.js:222` |
| `MANDATE_BATCH_UNBILLED_SPEND` | WARN | Requests whose provider spend couldn't be observed (batch never ended within the billing horizon); telemetry understates cost. | act now: reconcile against the provider console | `api/_utils/mandateBatchTransport.js:450` |
| `MANDATE_BATCH_STUCK_OPEN` | ACTION | A batch is still open past the retention window and was NOT deleted (I1). | investigate: drain/close it so it can retire | `api/_utils/mandateClosePass.js:636` |
| `MANDATE_GATE_EXPIRED` | INFO | An open submission aged out at the eval sweep; the book returns to submit-eligibility (I1). | none — self-healing | `api/cron/mandate-evaluate.js:125` |
| `MANDATE_OPEN_BATCH_UNDER_DIRECT` | ACTION | An open batch submission gates evals while transport is `direct` (a mid-drain flip left work behind). | act now: run the founder drain (`api/mandate/drain`), or wait ≤4h for gate expiry | `api/cron/mandate-evaluate.js:481` |
| `MANDATE_DRAIN_INCOMPLETE` | WARN | Batches still open after a drain run; books self-heal via gate expiry but the batch docs need the drain to finish. | act now: re-invoke `api/mandate/drain` until batches:0 | `api/_utils/mandateBatchTransport.js:804` |

### Close / marks

| Alert | Severity | Means | Founder action | file:line |
|---|---|---|---|---|
| `MANDATE_MISSED_MARKS` | WARN | ≥2 consecutive missed daily close marks (fully- or partially-missed sessions); fires retroactively for the gap it closed. | investigate: why the close pass isn't marking this book | `api/_utils/mandateClosePass.js:365` |
| `MANDATE_CLOSE_FAILED_STREAK` | ACTION | Consecutive whole-close failures for a book (§6.4). | investigate: the close pass is erroring for this book | `api/cron/mandate-evaluate.js:750` |

### Corporate actions

| Alert | Severity | Means | Founder action | file:line |
|---|---|---|---|---|
| `MANDATE_SUSPECTED_CA` | ACTION | A price gap implies an unrecorded corporate action; the mark is frozen pending resolution. | investigate: identify/record the CA, then unfreeze (see *Cash-merger / corporate-action insertion*) | `api/_utils/mandateClosePass.js:319` |
| `MANDATE_CA_UNRECOGNIZED` | ACTION | A declared CA type isn't recognized; symbol frozen. | investigate: add handling or resolve manually | `api/_utils/mandateClosePass.js:219` |
| `MANDATE_CA_APPLY_FAILED` | ACTION | Applying a recognized CA failed; symbol frozen. | investigate: fix the action inputs, re-apply | `api/_utils/mandateClosePass.js:257` |
| `MANDATE_CA_NO_ENTITLEMENT_DATA` | WARN | Position has no `openedAt`, so a CA was NOT applied (gap detector backstops). | monitor; backstopped | `api/_utils/mandateClosePass.js:245` |
| `MANDATE_CA_FETCH_DEGRADED` | WARN | CA fetch failed for some symbols on the day's slow-layer build (gap detector backstops). | monitor; backstopped | `api/_utils/mandateUniverseSnapshot.js:432` |

### Scoring stream

| Alert | Severity | Means | Founder action | file:line |
|---|---|---|---|---|
| `MANDATE_SCORING_APPEND_DEFERRED` | INFO | Scoring-stream append failed but a durable retry marker was written (I14). | none — self-healing | `api/_utils/mandateClosePass.js:538` |
| `MANDATE_SCORING_APPEND_LOST` | ACTION | Scoring append failed AND the durable marker write also failed — a stream record may be lost. | investigate: reconcile the scoring stream for that book/date | `api/_utils/mandateClosePass.js:542` |

### Universe / snapshot

| Alert | Severity | Means | Founder action | file:line |
|---|---|---|---|---|
| `MANDATE_UNIVERSE_DEGRADED` | WARN | Fewer complete candidate symbols than the floor (I11) at a tick; the snapshot risks sell-only. | investigate if persistent: upstream data thinness | `api/_utils/mandateUniverseSnapshot.js:540` |
| `MANDATE_UPSTREAM_QUOTA_ALERT` | WARN | Daily upstream API calls crossed the configured fraction of the ceiling. | monitor; act if it recurs early in the day | `api/_utils/mandateUniverseSnapshot.js:277` |

### Calendar

| Alert | Severity | Means | Founder action | file:line |
|---|---|---|---|---|
| `MANDATE_CALENDAR_HORIZON` | ACTION | Trading calendar unmaintained within 30 days; past the horizon **all evals + closes stop silently**. | act now: extend `MAINTAINED_HOLIDAY_YEARS` before the horizon | `api/cron/mandate-evaluate.js:780` |

### Rollover

| Alert | Severity | Means | Founder action | file:line |
|---|---|---|---|---|
| `MANDATE_ROLLOVER_FAILED_STREAK` | ACTION | Consecutive rollover failures for a book (§5.3). | investigate: the pre-market rollover is erroring for this book | `api/cron/mandate-rollover.js:131` |

**Where these appear:** all in **Vercel function logs** for the two mandate crons and the utilities they call, tagged `[MandateEvaluate]` / `[MandateRollover]` / `[MandateBatch]` / `[MandateClose]` / `[MandateUniverse]` / `[MandatePrompt]` / `[ModelPriceTable]`. During the dark run, grep the logs for `MANDATE_` daily — **plus `MODEL_PRICE_UNKNOWN`, the one alert that does not carry the `MANDATE_` prefix and a bare `MANDATE_` grep will miss.**

---

## Appendix — the prepared flag-flip / transport PRs (exact diffs)

Each flip is a **one-line-of-behavior PR** that carries its own pin reconciliation in the same commit — flip the value, update the pin assertion in `src/config/mandateFlags.test.js`, and (for the boolean flags) drop the flag's entry from `DARK_BY_DESIGN` in `src/config/flagPinGuard.test.js`. The flag-pin guard fails CI if any of the three moves is missing (BUILD_RULES §2/§11 — "the flip-and-pin-travel-together rule, honored where it was born"). Merge in sequence; **redeploy after each**.

### Flip PR #1 — light the substrate (master + eval + close + founder-create)
*Merged at activation step 3 (after `MANDATE_FOUNDER_UIDS` is set + redeployed). These four light together for the dark run. Rollover stays dark (PR #2); dormancy stays dark (Spec 3).*

- `src/config/featureFlags.js`: set to `true` — `MANAGED_MANDATE_ENABLED` (`:1556`), `MANDATE_EVAL_ENABLED` (`:1564`), `MANDATE_CLOSE_ENABLED` (`:1572`), `MANDATE_FOUNDER_CREATE_ENABLED` (`:1600`).
- `src/config/mandateFlags.test.js`: `MANAGED_MANDATE_ENABLED`→`toBe(true)` (`:23`); split the eval/close/rollover assertion (`:26–30`) so `MANDATE_EVAL_ENABLED` and `MANDATE_CLOSE_ENABLED` assert `true` while **`MANDATE_ROLLOVER_ENABLED` still asserts `false`**; `MANDATE_FOUNDER_CREATE_ENABLED`→`toBe(true)` (`:37`).
- `src/config/flagPinGuard.test.js`: delete the `DARK_BY_DESIGN` entries for `MANAGED_MANDATE_ENABLED`, `MANDATE_EVAL_ENABLED`, `MANDATE_CLOSE_ENABLED`, `MANDATE_FOUNDER_CREATE_ENABLED` (`:79–90`).

### Flip PR #2 — rollover (`MANDATE_ROLLOVER_ENABLED`)
*Cut from `main` **after** PR #1 has merged (it builds on PR #1's split assertion). Lit only when the rollover / accelerated-clock exercise begins — not day one.*

- `src/config/featureFlags.js`: `MANDATE_ROLLOVER_ENABLED = true` (`:1580`).
- `src/config/mandateFlags.test.js`: the `MANDATE_ROLLOVER_ENABLED` assertion (left `false` by PR #1) → `toBe(true)`.
- `src/config/flagPinGuard.test.js`: delete the `MANDATE_ROLLOVER_ENABLED` `DARK_BY_DESIGN` entry (`:85–86`).

### Config PR-D — production transport (`MANDATE_TRANSPORT_MODE='batch'`)
*Cut from `main`, merged mid-run at activation step 7 for the batch window (incl. Fri Sep 4). `MANDATE_TRANSPORT_MODE` is a string enum, not a boolean — it is **not** in `DARK_BY_DESIGN`; only the direct pin moves.*

- `src/config/featureFlags.js`: `MANDATE_TRANSPORT_MODE = 'batch'` (`:1609`).
- `src/config/mandateFlags.test.js`: `expect(MANDATE_TRANSPORT_MODE).toBe('direct')` → `toBe('batch')` (`:41`).
- **Revert PR** (batch→direct): the exact inverse, kept ready — direct is the permanent fallback if the measured turnaround (acceptance #8) disappoints (Risk 7). After flipping either way mid-run, invoke the **drain** so books gated on old-mode batches resume immediately.

### Flags that stay dark through Spec 1
- `MANDATE_DORMANCY_DOWNSHIFT_ENABLED` — dormancy reflection/narration depth is Spec 3; trading and the daily close are never downshifted. Stays `false` (and in `DARK_BY_DESIGN`) for all of Spec 1.
