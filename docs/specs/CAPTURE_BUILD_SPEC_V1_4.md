# Capture build — Specification V1.4

**Arc:** BaggerBomb Command Center · **Author:** Fable · **Date:** 2026-09-21 · **Supersedes:** nothing — V1.3 stays in place as the build's specification of record; V1.4 is V1.3 plus the amendments in the closing section.

*The body below is V1.3 verbatim, including its own header block. Read it as written; the only additions are in **V1.4 amendments (founder-approved, Sep 21)** at the end.*

---

# Capture build — Specification V1.3

**Arc:** BaggerBomb Command Center · **Author:** Fable · **Date:** 2026-09-20 · **Supersedes:** V1.2 (same date)
**Grounded in:** Astra's Phase 0, `docs/audits/20260920_PHASE0_TICK_CAPTURE.md` (branch `docs/phase0-tick-capture`, baseline `75b89b9a`). Verdict there: buildable with the changes listed. This version makes those changes.
**Status:** rulings C-1–C-10 approve-by-default except C-3 and C-4, which need Flash.
**Changes from V1.1** (Astra's confirmation read: 7 of 10 resolved, 3 partly, plus 4 conflicts): the admission counter is the one named exception to "unchanged writes"; action ids stay inside the record; both documents are written in one atomic batch, with three coverage figures; the privacy rule becomes an allowlist; all free text moves to the TTL body; capture is the last thing a tick does, and its timing effect is defined.
**Changes from V1.2** (Astra's third read: 8 of 9 resolved): usable pairs are measured only over ticks known to have dispatched a model request, with missing ticks reported as attempt-unknown; the capture serializer enforces the no-free-text rule. **Spec review closed.**

**What changed from V1, in one line:** V1 mixed an observation build with a scoring migration, a risk-model redesign and a privacy promise it couldn't keep. V1.1 is observation only. Everything else is moved to the arc that owns it (§8).

---

## 1. In plain terms

One record per check the agent makes: exactly what was sent to the model, exactly what came back, the controls in force, what the code checked and decided, and what actually traded. It never changes a decision, a score, or what the model sees; it costs a little time, which is measured and capped. If a record fails to write, the gap is visible rather than silent.

---

## 2. Rulings

**C-1 Completeness: best-effort, with gaps you can count.** `cronState.tickSeq` is incremented inside the existing admission transaction (the one permitted change to an existing write, §4) and is the denominator; the highest captured sequence is not, because it cannot reveal a trailing gap. Both documents are written in **one atomic batch**, so a tick is either captured (both exist) or missing, never half-written. The export reports three figures: *coverage* = captured ÷ minted; *usable pairs* = captured ticks whose body holds a complete, untruncated request and response ÷ captured ticks known to have dispatched a model request; missing ticks are reported separately as *attempt unknown*, and no figure is presented as an all-attempts rate; *expired* = bodies removed by TTL, counted separately and never as gaps. A write that times out is `unknown` until the export checks whether it landed. No outbox, no recovery system, no extra write to report a failure.

**C-2 The score leaves this build.** The cumulative locked-points total, the one-writer claim and the reader migration are a scoring change, not an observation: they change long-battle scores and what the next prompt reads. They become their own scoring build, sized by the production count (Q8 script in the Phase 0 report). The capture records each tick's score exactly as written and never recomputes it.

**C-3 Privacy boundary** *(Flash)*. Three rules instead of V1's impossible one: (1) the capture copies only an allowlist: the exact request, the exact response, and a named set of operational facts the code computed (exit reason, stage, verdicts, validation outcomes, action facts, call envelope, control metadata, score fields). Chat history, forensics, and whole battle, receipt, proposal or meeting objects are never copied. (2) The exact request keeps whatever was rendered, including player-authored text already in the prompt: agent name, custom rule text, Vision thesis, legacy directive text. That's a copy of what the model already received, not new exposure. (3) Anything leaving our systems, such as a J1 export to Jev, is redacted in a separate artifact that records what it removed.

**C-4 Retention** *(Flash — the number)*. The record is two documents so deletion needs no sweeper: a small permanent record holding no free text, and a body document holding **every piece of text** (request, response, the model's rationale and hypothesis, controls as rendered, fault messages), deleted whole by a Firestore TTL policy on `expireAt`, set from capture time. Proposed window: **120 days**, long enough for a finished battle to stay reviewable for about three months.

**C-5 Manifest: minimal, never reconstructed.** The exact request *is* what was shown; anything absent from it was not seen. The permanent record keeps a small index — evidence keys and known vintages already available at the handler, `unknown` where they aren't — and stores field *names* only for anything not rendered. The full per-field render manifest from inside the assembler moves to the parity change, which edits that fenced file anyway.

**C-6 Alternatives: only what the handler actually observed.** Record the outcome of every check the tick actually ran — proposed-pair validation, distressed veto, LOCK, hurdle, cap, conviction, reservation — each tagged `evaluated`, `bypassed`, `not_evaluated` or `unknown`. Nothing untouched is labeled "passed". Reasons discarded inside the fenced picker are `unknown`. Full enumeration stays Tier 2, with J2.

**C-7 Armed state: record what ran, don't define a model.** Store the risk verdicts and guardrail evaluations the tick actually computed, with their status. A unified "armed / exit levels" object is new risk-model work; it belongs to the exit-dials arc, whose always-run check phase (G-1) is the natural place to produce it.

**C-8 Exits and admission.** Adopt the Phase 0 exit map: `degraded_quotes`, `cpu_passive`, `proposal_pending`, `gameplan_pending`, `gameplan_created`, `no_trigger`, `tick_error`, plus the shipped failure classes unchanged, HTTP status and error names preserved as-is. Model outcome, guardrail fault and post-decision outcomes (validation, LOCK, distress, hurdle, cap, reservation, execution) are **separate fields**; a HOLD caused by a rejected proposal is never recorded as a model failure. Lease refusal and the outer scheduler's budget deferral are pre-admission, have no `tickSeq`, and belong to the scaling arc's instrumentation; the in-tick `budget_skipped` model outcome is post-admission and stays.

**C-9 Timing and the finalization boundary.** Capture is **the last thing a tick does**. On every non-error exit it is the final statement of the tick's existing `finally`, after the final battle update and after narration and anticipation dispatch. On an error exit the inner catch marks the context `tick_error` and the `finally` skips capture; the outer handler finalizes it after writing its fault receipt. It runs under a bounded deadline and skips itself (a counted gap) when the handler's remaining budget is below a threshold set in the build's gate. **Permitted effect:** capture may cost wall time and so may shift later scheduling (another battle's deferral, anticipation admission); it may never change any trading calculation or authoritative outcome of its own tick. The flag-on build reports per-tick overhead and any change in deferred battles, and the flip requires both within bounds.

**C-10 Identity.** `tickId = ${battleId}:${tickSeq}` sits **alongside** the existing `evalId`, which is prompt-visible history and is never replaced. Actions are identified inside the record only, as `${tickId}:${n}`; trade entries are not changed. A record joins to its trade entry by `(battleId, swappedOutAt, symbolOut, symbolIn)`.

---

## 3. The record

**Paths.** `agentBattles/{battleId}/ticks/{tickId}` (permanent) and `agentBattles/{battleId}/tickBodies/{tickId}` (TTL). Default-deny Firestore rules stay; Admin-only access. Client read access is decided with the Film Room readers. Both documents are written in one atomic batch (C-1).

**Capture context.** A request-local object created right after admission and filled at each stage, finalized once per tick at the boundary C-9 defines. No shared mutable state on the cached model client.

**Body document** (all free text lives here). The original tool result exactly as the model returned it, copied before any deterministic replacement; the controls as rendered, including directive and lean text; guardrail and model fault messages; and the outgoing HTTP entity body as dispatched (UTF-8, auth headers excluded) and the incoming entity body before SDK parsing, including non-2xx and malformed bodies when available, each with a SHA-256, plus status and returned model. The observer must not consume the SDK's response stream, and a failed copy never fails the request: its absence is recorded, and bytes are never reconstructed from the parsed object. A per-document size cap applies; oversize bodies are truncated with an explicit `bodyIncomplete` reason.

**Permanent document** (no free text: ids, enums, numbers, symbols, timestamps, hashes; the capture serializer enforces this, admitting a symbol only if it is in the battle's known universe and an enum only if it is on its list, and sending anything else to the body as text). `tickSeq`, `schemaVersion`, stage reached, exit reason; model outcome class (with `invalidField`, `timeoutKind`); guardrail fault class; post-decision outcomes; the original and final decision and pair as enums and symbols, with conviction; `holdKind`; executed actions in order, collected from the existing executor call sites (no new executor caller); control ids, versions and text hashes, and the frozen config hash when present, never looked up afresh; body status (`written`, `truncated`, `copy_failed`, `skipped`); the minimal manifest; the call envelope (model ids, temperature, ceiling, `buildMs`, `callMs`); the score fields exactly as written this tick; capture timing.

**Indexes.** Single-field exemptions for body and manifest payloads; keep `tickSeq`, time, battle id and schema version queryable.

---

## 4. Must not change, and the guards that prove it

Flag off: byte-identical writes. Flag on: every existing write unchanged **except one named field**: the admission transaction also increments `cronState.tickSeq`. The record lives only in its own documents. The Phase 0 report's Part 3 is binding. In particular: nothing is read or refreshed between prompt build and tick stamps; the decider's eight-key history whitelist is untouched; the frozen entry golden and whole-update golden are never regenerated; no seventh executor call site; any helper imported into a fenced assembler is classified in the honesty registry; skipped stages are never called to fill in missing values; the no-swap golden and the forced-swap score lock stay green.

---

## 5. Fence

Fence-free by construction: handler, a new capture helper, flag and pin, rules, indexes, export script. If Phase 0 of the build finds any item needs an edit to a §1 file (the assembler, executor, risk manager, guardrails or battle service), it **STOPs and reports** rather than proceeding; that item then moves to its owning arc.

---

## 6. Flag and rollout

`TICK_CAPTURE_ENABLED`, false, pinned off, with a dark-runway entry. The flip PR requires: measured per-tick overhead within the C-9 bound, measured record sizes, the TTL policy enabled on `tickBodies`, and coverage reporting working. Flipping starts the collection window.

---

## 7. Acceptance

Every exit in C-8, with the flag off and on. Multi-action ticks; a committed swap followed by a failed refresh; both model and guardrail faults on one tick; malformed and non-2xx response bodies; an oversize body; a capture write that fails or times out, leaving the tick's own results unchanged and a countable gap. The C-3 tests: a sentinel confined to chat and forensics (never rendered) never reaches a record, and a sentinel in a rendered custom rule appears unchanged in the body. The export script writes local JSONL with coverage figures and no Firestore write. Coverage: a trailing gap detected from the persisted counter; a timed-out batch recorded `unknown` and resolved by the export; an expired body counted as expired, not missing; a truncated body counted as captured but not a usable pair. J1 readiness is judged on measured coverage and the experiment's D5 contract, not elapsed days.

---

## 8. Moved out, and where it went

| Item | New owner |
|---|---|
| Cumulative locked-points total, score writers, recomputing readers | New scoring build, sized by the Q8 production count |
| Unified armed state and exit levels | Exit-dials arc, with G-1 |
| Full per-field render manifest | Parity change (fenced assembler) |
| Full alternatives enumeration | Tier 2, with J2 |
| Lease-refusal and deferral records | Scaling arc instrumentation |
| Client read access, tape and grounding readers of the new fields | Film Room readers |

---

## V1.4 amendments (founder-approved, Sep 21)

1. `failed` as C-6's fifth status, meaning an executor or check that was called and threw, with a denied precondition recorded as `bypassed`.
2. Per-tick overhead measured by telemetry, not the in-document field.
3. Received bytes hashed.
4. C-3's allowlist is by path and shape.
5. Request-local means async-chain-local, never a battle id.
