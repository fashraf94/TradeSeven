# WS1 — Pre-Enforce Backlog

Items that **must** be resolved before WS1 rule-compat **enforce** ships to real
users. (Enforce co-ships with `FORGE_HARDSOFT_AUTHORING_ENABLED` and the
bundle-equip UI — flipping enforce before the equip UI ships guards a door nobody
can open; landing the equip UI before enforce opens an unguarded door.)

---

## [MUST-FIX] The `rule_compat` observe stream inherits the shadow logger's silent error-swallow

**Raised:** 2026-07-04 (WS1 observe-walk discovery). **Elevated** from report-not-fix
to **PRE-ENFORCE MUST-FIX** per Flash.

**Problem.** All three compat events (`compat_conflict_equip`,
`compat_promote_blocked`, `compat_archetype_change_rescan`) persist via
`logSignalDrops({ stage:'rule_compat' })` → `appendToStream` (`api/_utils/shadowLogger.js`).
`appendToStream` **catches and swallows** GCS write errors and does **not** rethrow
(`shadowLogger.js:54-56`). `api/agent/log-rule-compat-event.js` awaits it and only
returns 500 on a *thrown* error (`:100-117`) — but the swallow means a failed GCS
write **resolves successfully**, so the endpoint returns **`200` while nothing
persisted**. (The endpoint comment claims "awaited, never silently swallowed"; the
swallow is one layer down, in `appendToStream`.)

**Why this blocks enforce.** The enforce go/no-go rests on the **observe baseline** —
"does the stream show conflicts firing at the expected sites?" A silent GCS failure
makes the stream look **empty**, which is **indistinguishable from "no conflicts."**
An enforce decision made against a silently-empty baseline would read "safe / nothing
firing" when the truth is a telemetry outage. The baseline the enforce decision rests
on is untrustworthy until this is fixed. (Precedent: BUILD_RULES §5 — "the shadow
logger's silent multi-week data loss is the cautionary tale.")

**Fix (options).** On the `rule_compat` write path, distinguish **persisted vs
swallowed** and surface failures — e.g. `appendToStream` returns a success boolean
the endpoint checks (→ real 500 on failure), plus a **failure counter / metric** on
the rule_compat stage; or a dedicated durable write for compat events that does not
swallow. At minimum the observe baseline must be able to prove persistence, not infer
it from a `200`.

**Interim (this walk).** The observe-walk driver confirms landing by **reading back
the GCS `signal_drops` stream** (never the HTTP `200`), and — when the GCS creds are
unavailable locally — via temporary **write-site logging** that reports
persisted-vs-threw. This is a verification workaround, **not** the fix.

**Walk outcome (2026-07-05) — CLOSED, VERIFIED-with-caveat.** The observe-walk
(`scripts/ws1-observe-walk.js`) passed the oracle on every live run against the
deployed stack: `equip_bundle` logged 2 `compat_conflict_equip`, `set_rule_hardness`
logged 1 `compat_promote_blocked`, both `change-archetype` flips logged a
`compat_archetype_change_rescan`, the native rule (`ts-01`/guardian) stayed silent, and
the throwaway test agent reverted clean. **WS1 guard classification is confirmed live.**
The **GCS read-back persistence confirmation was NOT obtained** (local
credential-file formatting) — so "each event lands *exactly once* in the stream"
remains **inferred from the endpoint `200`, not proven from the stream**. That residual
gap is exactly this MUST-FIX: until the write path distinguishes persisted-vs-swallowed,
the observe baseline cannot *prove* persistence. **No further observe-walk runs are
needed to gate enforce — this MUST-FIX is the gate.** The driver already supports
`GCS_CREDENTIALS_PATH` (a gitignored service-account `.json`) for a future one-shot
read-back confirmation if desired, but it is not a precondition to closing the walk.

**Sources:** `api/_utils/shadowLogger.js:54-56`; `api/agent/log-rule-compat-event.js:100-117`; `BUILD_RULES.md §5`; walk driver `scripts/ws1-observe-walk.js`.
