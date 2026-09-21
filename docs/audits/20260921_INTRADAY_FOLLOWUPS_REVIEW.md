# Intraday follow-ups — §2 review (proportionate)

**Date:** 2026-09-21
**Under review:** `claude/ecstatic-bohr-8a0huc` @ `bc894044` — four commits on `0a56fff9`
(`929624ca` F1, `63bcee07` F2, `eb263f36` F3, `bc894044` F4).
**Diff:** 17 files, **+524 / −27**. Seven of the seventeen are golden-suite tests filtering one key.
**Reviewer:** fresh Claude Code session (Opus), not the build session. Read-only on project state; this report is the only change.

## Preamble (BUILD_RULES §3)

| | |
|---|---|
| `git fetch origin` | run first, before any remote comparison. `origin/main` advanced `398c528e..0a56fff9`. |
| Branch / HEAD | report branch `claude/elegant-mccarthy-vwxcog`, cut from `bc894044` as the brief directs. |
| Tree | clean at checkout; `node_modules` absent on arrival, installed with `npm ci` (exit 0). |
| Reviewer isolation (§2) | three path-distinct `git archive bc894044` extractions under the session scratchpad (`treeA` / `treeB` / `treeC`), `node_modules` symlinked. **Every mutation check ran in a snapshot tree**; no mutation ever touched the working tree, and no reviewer wrote to git. |
| Build prompt | `INTRADAY_FOLLOWUPS_1_PROMPT_V1_2.md` is **not in the repo** (confirmed by name search across the tree and the branch). Worked from the build report `docs/audits/20260919_BUILD1_INTRADAY.md` and the four commit messages, as the brief permits. |

---

## 1. Executive verdict

> ### **MERGE WITH ADDENDUM**
>
> The three code fixes are **correct, minimal, and genuinely guarded**. Every test this PR claims
> was mutation-checked in this session, by hand, in an isolated tree — **nine mutations, eight
> went red exactly as claimed**. The ninth went green, and that is finding **A**.
>
> Nothing here is a correctness defect. Every finding is an **accuracy or scope** item: a guard
> that is narrower than the sentence describing it, and three claims stated more firmly than the
> evidence behind them. The **code** can merge as it stands.

| # | Finding | Severity | Kind | Blocks merge? |
|---|---|---|---|---|
| **A** | The new copy census cannot see a reason carried by a **variable**, though its own comment says it can. Proven with a planted defect. | **Moderate** | Guard scope | No — latent, not live |
| **B** | F1 fixes a defect that is **unreachable at HEAD**, but the commit and test header state it in the past tense as something that happened. | **Moderate** | Claim accuracy | No |
| **C** | The revised S7 imports a **74 %** figure measured on a different endpoint against a different denominator. | Low–moderate | Claim accuracy | No |
| **D** | The S7 retraction is **incomplete** — the retracted premise survives, unqualified, in a test comment. | Low–moderate | Stale doc | No |
| **E** | `CUTOFF_FUTURE_TOLERANCE_MS` placement is right, but the **§8.3 → POLICY_VERSION** coupling is written at neither end. | Low | Missing cross-ref | No |
| **F** | Addendum B's measured claims **cannot be re-derived in-repo** — no Live v2 artifact was committed. | Low | Provenance | No |
| **G** | `no_value` is a **dead copy row**. (The brief expected three; I measure one.) | Nit | Dead code | No |
| **H** | B3's `+ 14_400` is the **EDT** offset, stated as the identity with no season caveat. | Nit | Precision | No |

### Gate results — all green, re-run in this session

| Gate | Result |
|---|---|
| Full suite (`npx vitest run`) | **727 files passed, 3 skipped · 13,945 tests passed, 64 skipped · exit 0** (192 s) |
| `npm run lint:gate` | **exit 0** |
| `npx vite build` | **exit 0**, built in 27.25 s (BUILD_RULES §2 — the only check that reads `App.jsx`) |

The F3 commit claims "13945 passed / 64 skipped, exit 0". **Reproduced exactly.**

---

## 2. Mutation ledger — every claimed guard, checked by hand

BUILD_RULES §2: *"A row that cannot fail under the defect it names is not a guard."* I did not take
the build report's word for any of these. Each ran in its own snapshot tree.

| # | Tree | Mutation | Expected | Observed |
|---|---|---|---|---|
| M1 | A | `evalSeq` reverted to `evaluations.length + 1` | red | **RED** — `expected 'eval_151' to be 'eval_152'` (`evalSeq.test.js:157`) |
| M2a | A | `'cronState.evalSeq'` removed from the finalUpdate | red | **RED** — `expected [] to deeply equal [ 'cronState.evalSeq' ]`; the anti-vacuous pin fires |
| M2b | A | an extra key `'cronState.sneakyNewKey'` added to the finalUpdate | red | **RED** in **both** golden suites — **nothing can hide behind the lift** |
| M3a | B | `VOLUME_CUTOFF_FIELD = 'snapshotTs'` | red | **RED** — 3 rows (permitted set, `snapshotTs` trap, calcVersion pin) |
| M3b | B | `VOLUME_CUTOFF_FIELD = 'lastTradeTime'`, `HL_CUTOFF_FIELD = 'someOtherKey'` | red | **RED** — 4 rows; an **arbitrary** value fails the permitted set too |
| M4a | C | the `cutoff_future` guard deleted | red | **RED** — 3 rows, including the `display_only` escape |
| M4b | C | the guard **moved** below the `cutoff === null` branch | red | **RED** — `expected { state: 'display_only' } to match { state: 'ineligible' }`. The ordering row is a real guard, not decoration. |
| M5a | C | a new reason **literal** (`'planted_new_reason'`) with no copy row | red | **RED** — `reasons emitted by eligibility.js with no copy row: planted_new_reason` |
| M5b | C | a reason carried by a **variable** (`facts.js:39`), no copy row | red | **GREEN — 7/7 passed. See finding A.** |

---

## 3. Lens 1 — F1, the id sequence

### What holds

**One append site, and the counter cannot detach from it.** `evaluations` is written in exactly one
place: `api/cron/agent-evaluate.js:3504` composes `[...(battle.evaluations || []), evaluation].slice(-150)`
and `:3515` places it on the finalUpdate. `'cronState.evalSeq': evalSeq` sits at `:3552` — **a key of
the same object literal**. They are not two writes that must be kept in step; they are one write.
No early-return path between the derivation (`:2515`) and the finalUpdate can advance the sequence,
because the sequence is only ever persisted *as part of* the append.

I checked repo-wide for a second writer, including the fenced files: `agentBattleService.js:248`
(`evaluations: []`, the fenced `createAgentBattle` init) is a creation, not an append;
`agentReflectionUtils.js:232` returns a truncated copy for prompt assembly and writes nothing; no
`arrayUnion` touches `evaluations`. **Confirmed: one append site.**

**The failed-tick case behaves as the brief requires.** If the finalUpdate fails, neither the entry
nor the counter persists, so the next tick reads the same `battle.cronState.evalSeq` and issues **the
same id** — it does not skip one. This also matches the pre-fix behaviour, so the
`intradayViews/{evalId}` set-merge re-writes the orphan rather than stranding it. No regression.

**Ids below the cap are identical to today.** `(battle.cronState?.evalSeq ?? battle.evaluations?.length ?? 0) + 1`:
for a fresh battle both derivations give 1; for a legacy battle with no counter the fallback *is* the
old rule; and while the array is uncapped the counter and the length are equal by construction. Every
`evalId` consumer named in the build-1 review — the tape/statusFeed rows, the `heard` stamps, the
receipts, and `intradayViews/{evalId}` (`:3307`) — therefore sees byte-identical ids below 150.
Verified directly by the suite, which is green, and by M1's own anti-vacuous rows.

**The golden lift is exact and cannot be widened silently.** `POST_GOLDEN_UPDATE_KEYS` contains one
string (`tickStampsHarness.js:104`). The four suites filter by exact string membership, so any other
new key survives the filter and breaks `.toEqual` — **M2b proved this in both suites**. The flag-off
suite carries the anti-vacuous pin (`cronState.evalSeq === 1` beside a one-entry append) — **M2a
proved it fires**. Regeneration now derives `finalUpdateKeys` from the *lifted* object, so the lift is
applied to both sides and to any future capture.

**The golden file is byte-unchanged.** `api/_utils/__fixtures__/tickStampsEntryGolden.flagOff.json`
does not appear in the branch diff at all. Its provenance (`origin/main @ 4a8ae54a`) is intact —
which is the whole point of lifting rather than regenerating.

### Finding B — the defect F1 fixes is unreachable at HEAD *(Moderate, claim accuracy)*

`api/_utils/agentBattleService.js:35` hardcodes `const AGENT_BATTLE_DURATION_MODE = 'fullday';`, so
`:119` sets `tradingDays = [fullDay.targetDateStr]` — **every battle created at HEAD is single-day**.
The cron runs `*/15 13,14,...,21 * * 1-5` (`vercel.json:157-158`) — at most 36 ticks in a day, ~26
inside market hours. **A battle cannot reach 150 entries.** The legacy multi-day branch (`:124`) is
unreachable while that constant is `'fullday'`.

`api/cron/agent-evaluate.js:2593-2596` already records exactly this, as a *refutation*:

> "the review justified this by the evaluations[] 150-cap making `evalId` collide, and the refutation
> overturned that — battles are single-day at ~26 ticks"

That comment is **left untouched by this PR**, and it contradicts how F1 describes itself. The commit
message for `929624ca` and the header of `agent-evaluate.evalSeq.test.js:1-12` both use the past
indicative — "every later entry **was** stamped `eval_151`", "statusFeed rows, cronErrors, the
anticipation queue and the `intradayViews/{evalId}` subcollection document **all pointed at** a name
shared by dozens of ticks". Under `fullday` mode, none of that ever happened. The build report's §7
item 1 (`20260919_BUILD1_INTRADAY.md:182`) now reads "**Fixed 2026-09-21**" without recording that the
item was unreachable.

**This is not an argument against the fix.** The fix is correct, costs one field, and is exactly the
hardening you want if `AGENT_BATTLE_DURATION_MODE` ever returns to multi-day — at which point the cap
becomes reachable in about six trading days. The objection is only to the tense. A build that says a
collision *occurred* when the same file says it could not is the kind of drift BUILD_RULES §3 exists
to prevent.

**Bounded remedy.** Reword to the conditional in three places — the commit body (history, so realistically
the report instead), `agent-evaluate.evalSeq.test.js:1-12`, and `20260919_BUILD1_INTRADAY.md:182` —
and add the reachability condition: *"unreachable while `agentBattleService.js:35` pins `'fullday'`;
fixed now so the cap is not a latent trap if that changes."* Optionally reconcile
`agent-evaluate.js:2593-2596`, which now reads as if the collision were still open.

---

## 4. Lens 2 — F2 and F3

### F2, the configuration guard — holds

`priceAsOf` **is** the Observation key carrying the vendor's `lastTradeTime`: `observation.js:95`
reads `const asOf = toMs(q.lastTradeTime)` and `:113` assigns `priceAsOf: asOf.ms`. VERIFIED.

The permitted set is genuinely enforced, not merely described. **M3a** (`'snapshotTs'`) reddens three
rows; **M3b** shows the `'lastTradeTime'` trap fires *and* that an arbitrary key (`'someOtherKey'`)
fails the permitted-set row — so the guard is a whitelist, not two named traps.

**No module passes a cutoff field except through these constants.** `resolveCutoff` is defined at
`accumulator.js:248` and called from exactly two places, both in `facts.js` (`:88`, `:89`), both
reading `cfg.VOLUME_CUTOFF_FIELD` / `cfg.HL_CUTOFF_FIELD`. There is no third call site and no literal
field name anywhere else. VERIFIED.

**A detail worth crediting:** F2 and F3 interlock. `snapshotTs` is `timestamp × 1000`, and B3's identity
makes that the trade minute **plus four hours** — i.e. a cutoff roughly four hours *in the future*. Had
`VOLUME_CUTOFF_FIELD` ever been set to `'snapshotTs'`, F3's guard would have refused every resulting
verdict at runtime with `cutoff_future`. The config lock and the runtime guard cover the same mistake
from two directions. Neither commit says so; it is a real strength of the pair.

### F3, the eligibility guard — holds

The guard sits at `eligibility.js:127`, after `const ageMs = nowMs - ageBasis` (`:118`) and **before**
the stale check (`:128`), the `cutoff === null` block (`:130-139`), the `experimental` branch (`:140`)
and everything below. Every age-derived branch, including both `display_only` escapes, is downstream.
**M4b confirms the ordering is load-bearing**: moving the guard below the null-cutoff block turns a
future-stamped aggregate back into `display_only` and reddens the row.

Boundary: exactly `+60 s` is unaffected, `+60 s + 1 ms` is refused, for both consumers — the test
asserts `TOL` is `60_000` and pins `ageMs === -(TOL + 1)`, so the sign is carried, not just the state.
The null-cutoff `availableAt` stand-in is covered (`eligibility.test.js`, the "runs BEFORE the age
check" row), and **M4a** shows all three rows die without the guard.

### Finding E — where the constant lives *(Low, missing cross-reference)*

**The placement is right.** `CUTOFF_FUTURE_TOLERANCE_MS` belongs in `eligibility.js:45`, beside the
policy it bounds, not in `intradayConfig.js` — whose vendor-pending block is for values *the vendor
answers*, which this is not. Keeping it away from `PRICE_AS_OF_FUTURE_TOLERANCE_MS` (a §5.5
collection-time reject rule and a **calcVersion** tunable) is the correct call, and the docstring at
`:38-43` says so explicitly. Two constants of equal magnitude that bump different versions should not
share a home. **No change wanted.**

**What bumps when it changes: `POLICY_VERSION`** — `intradayConfig.js:55-56` is unambiguous
(`/** §10.7 — covers §8.3. */`), and F3's own docstring calls the constant "an §8.3 policy bound".
This matters because `view.js:147` re-evaluates a **stored** view under `view.policyVersion`: a
receipt replayed under new §8.3 semantics while still labelled policy v1 would silently disagree with
what the player was shown.

The commit's reasoning for not bumping is **correct and I verified it**:
`INTRADAY_DIAGNOSTIC_ENABLED = false` at `src/config/featureFlags.js:2605`, and it gates both view
read (`agent-evaluate.js:342`) and write (`:3317`) — **no verdict has ever been persisted**, so there
is nothing to contradict. Sound today.

**The gap is that this reasoning exists only in a commit message.** Neither end states the coupling:
`eligibility.js:28-45` names §8.3 but never `POLICY_VERSION`; `intradayConfig.js:55-56` names §8.3 but
never the constant. Once `INTRADAY_DIAGNOSTIC_ENABLED` flips, the next tune of this tolerance **must**
bump `POLICY_VERSION`, and `view.js:147` is what breaks if it does not.

**Bounded remedy.** One line in each docstring — at `eligibility.js:45`, *"tuning this bumps
`POLICY_VERSION` (§10.7); stored views replay under their own, `view.js:147`"*; at
`intradayConfig.js:56`, a pointer to `CUTOFF_FUTURE_TOLERANCE_MS` as an §8.3 bound that lives outside
this file.

### Finding A — the copy census is narrower than its own comment *(Moderate, guard scope)*

**This is the one claimed guard that did not fire.**

`src/data/intradayDiagnosticCopy.test.js:68-91` scans the reason slot of every `v(state, reason, …)`
call in `eligibility.js` and requires a copy row for each **literal** it finds. Against literals it is
a real guard: **M5a** planted `'planted_new_reason'` and the census went red with a clean message.

But `eligibility.js` emits reasons two ways. Lines `:89` and `:90` pass **`f.reason`** — a value
stamped upstream by `facts.js` and `accumulator.js` — with a literal only as the `||` fallback. The
regex captures the fallback literal; it never sees what `f.reason` can hold.

The test's own comment (`:73-77`) claims otherwise:

> "Scoped to eligibility.js on purpose — the reasons facts.js and accumulator.js stamp reach a verdict
> only through its `f.reason || …` fallbacks, **which this same scan picks up**."

It does not pick them up. It picks up the fallback.

**Proven, not asserted.** In `treeC` I changed `facts.js:39` to stamp `'planted_variable_reason'` and
re-ran the census: **7/7 passed, green.** Then I drove the real chain:

```
verdict reason emitted by eligibility.js : {"state":"ineligible","reason":"planted_variable_reason","consumer":"display"}
has a copy row?                          : false
phrase a player would read               : unavailable
```

Exactly the silent degradation the test was written to prevent, past the test.

**Corroborating tell — the allowlist gives the gap away.** `SILENT_IN_COPY` (`:19`) holds three names,
but only `ineligible_by_definition` is an `eligibility.js` literal. `not_actionable` and `no_buckets`
are stamped by `facts.js:117` and `:84` — **the scan can never see either**, so two of the three
entries are inert. The author's mental model included upstream reasons; the scan's reach did not.

**Severity is bounded — this is latent, not live.** I censused the full emitter set. Every reason that
can actually land on an indicator today (`facts.js` and `computeVolumePace`: `no_state`, `warmup`,
`no_session_anchor`, `hl_invalid`, `volume_invalid`, `no_volume_yet`, `cutoff_unconfirmed`,
`insufficient_elapsed`, `no_reference_volume`, plus the two allowlisted) **has a copy row**. The
accumulator's rejection reasons (`price_as_of_future`, `prior_session_quote`, …) live on the
observation result and never reach an indicator's `reason`, so they are correctly out of scope. **No
player sees "unavailable" today.** The defect is that the next reason added to `facts.js` will not be
caught, while the comment promises it would be.

**Bounded remedy** (either is cheap):
1. **Correct the comment** to state the real scope — literals in `eligibility.js` only — and drop the two
   inert allowlist entries, or note they are defensive. *Honest, zero coverage gained.*
2. **Extend the scan** to `reason:` literals in `facts.js` and the `computeVolumePace` returns in
   `accumulator.js`, keeping the allowlist for the two structural silences. M5b becomes the
   anti-vacuous row. *Closes it; the census already showed both files stay green under the current
   copy table, so this lands without churn.*

I'd take (2), with M5b's planted reason as the mutation row.

---

## 5. Lens 3 — F4 and the close claims

### What I could verify

| Claim | Check | Result |
|---|---|---|
| `39e5c48a` flipped `INTRADAY_COLLECT_ENABLED` | commit exists, is an **ancestor of the base** `0a56fff9`, flips the flag and moves the pin in-commit (BUILD_RULES §2) | **VERIFIED** — the past-tensed docstring (`featureFlags.js:2581-2584`) is accurate |
| Ratio direction in the revised S7 | `validator.js:9-10` — `Σ(bar volume) / the last accepted quote's cumulative session volume` | **VERIFIED** — S7's "near 1.0 / below 1.0 / above 1.0" reading matches the arithmetic |
| B4 implies the revised S7 | poller collects over `[open, close + 30 min)` (`intraday-poll.js:5-7`); a post-close quote is **accepted** (`accumulator.js:135-141` rejects only a later *ET date*); per B4 `volume` holds the session total after 16:00 | **VERIFIED** — the last accepted quote of the day does carry the session total, so ~1.0 is the right expectation. **The correction's direction is sound.** |
| AMAT arithmetic | `444.92 − 444.57 = +0.35` | **Arithmetic checks.** Source not in repo — see F |
| 21-of-21 `timestamp`, EBAY nulls, B9 bar geometry | searched the tree for any committed Live v2 response | **NOT RE-DERIVABLE** — see F |

### Finding C — the 74 % is a cross-endpoint transplant *(Low–moderate, claim accuracy)*

The revised S7 (`20260919_BUILD1_INTRADAY.md:174`) supports "below 1.0 means the bars undercount" with
"the in-repo 5-minute sample ran at a median **74 %**".

The figure is real, and sourced: `20260918_PHASE0_INTRADAY_ADDENDA.md:29` and `:205` — median 74.27 %
over 21 AAPL sessions. But it measures **Σ(5-minute bar volume) / EOD volume**, and
`quoteCumulativeVolumeRatio` is **Σ(1-minute bar volume) / last-accepted-quote cumulative volume**.
Different endpoint, different denominator.

The same source says why the difference matters: the 5-minute endpoint's 16:00 row carries
`volume: null` on **all 21 sessions** (`:205`) — it is missing the closing auction outright — whereas
"the founder's 1-minute fixture's 16:00 row carries 19.1 M real volume"
(`INTRADAY_DATA_BUILD_1_CONTRACT_V1_1.md:21`, which also states "Validator uses 1-minute bars"). Much
of the 74 % undercount is an artifact the validator's endpoint does not share.

S7 does label it "the 5-minute sample", so it is not a misquote — but it is placed as an indication of
what the validator's ratio will read on day 2, which the source does not support. Given S7 is a
retraction of an over-confident band, replacing it with a figure from a different measurement invites
the same problem.

**Bounded remedy.** Keep the figure, add the clause: *"— on the 5-minute endpoint, against EOD volume,
and that endpoint's 16:00 row is `volume: null`; the validator's 1-minute bars carry the auction, so
this is a lower bound on a different quantity, not a forecast."*

### Finding D — the retraction is incomplete *(Low–moderate, stale doc)*

S7's old band was retracted in the report, but **the premise behind it survives verbatim in a test
comment**. `api/_utils/intraday/validator.test.js:53-55`:

> "**The realistic shape**: a 15-minute delayed feed's last accepted quote carries cumulative volume to
> ~15:44, while the bar series runs to the 16:00 closing auction. The denominator structurally omits it."

That construction is what produces ~1.97: the test builds its denominator by summing `FIXTURE_BARS`
**truncated at 15:44** (`:56-57`), so the numerator covers the session and the denominator covers 3/4
of it. As a *fixture* that is fine. As "the realistic shape" it is now wrong — collection runs to
close + 30 min, so the last accepted quote is post-close and carries the session total.

The A5 register row was given a parenthetical ("a measurement of that fixture, not a norm" — `:224`),
which is the right instinct, but the sentence that actually asserts the retracted claim was not
touched. Anyone reading the test next will re-learn the retracted model. Worse, ~1.97 is precisely the
"above 1.0 … wants investigating" case under the new S7, and nothing at the test site reconciles that.

**Bounded remedy.** Retitle the premise at `validator.test.js:53-55`: *"A constructed worst case — a
denominator truncated at 15:44 against a full-session numerator. Not the production shape: collection
runs to close + 30 min, so the last accepted quote carries the session total (B4). Retained because it
pins that a short denominator must not make the session partial."*

### Finding F — Addendum B's evidence is not in the tree *(Low, provenance)*

Addendum B discharges an ASSUMED marker — B1: *"§6a's ASSUMED marker on the field names is discharged"* —
on evidence that was never committed. I searched the tree for any Live v2 response artifact; the only
`AMAT` / `EBAY` / `444.57` hits are the stock universe, sector tables, daily EOD fixtures, voice
fixtures, and the Addendum B text itself. The 21-of-21 `timestamp` identity, the EBAY nulls, the B8
`size` table and the B9 bar geometry rest entirely on the founder's pasted responses.

BUILD_RULES §3 asks that a VERIFIED claim carry a citation someone can re-check. Moving ASSUMED →
VERIFIED on an artifact outside the repo leaves the strongest claims in the addendum the only ones
that cannot be re-derived. The vendor answers (B4–B9) are inherently external and that is fine — it is
the **observational** rows (B1, B2, B3, B6's figures, B7, B8) that should be reproducible.

**Bounded remedy.** Commit the two redacted Live v2 payloads (2 symbols, 20 symbols) as a fixture under
`api/_utils/__fixtures__/`, cite it from B1–B3, and — ideally — pin B3's identity as an assertion over
that fixture. That converts the strongest claim in the addendum into a guard. If the payloads cannot
be committed, mark B1/B2/B3/B7/B8 **MEASURED (founder session, artifact not in repo)** rather than
leaving them reading as VERIFIED.

### Finding G — one dead copy row *(Nit)*

`no_value: 'no reading'` (`src/data/intradayDiagnosticCopy.js:42`) is emitted by nothing in `api/` or
`src/` — the only occurrence in the tree is its own declaration. Harmless (`reasonPhrase` just never
reaches it), and pre-existing, not introduced here.

*Note on the brief:* it anticipated "three table rows nothing emits". Measuring the full emitter set —
`eligibility.js` literals ∪ `facts.js` stamps ∪ `computeVolumePace` stamps — I find **one**. If the
count is taken against the census's own narrow scan (literals only), it is eight, which is itself a
restatement of finding A. Reporting what I measured rather than the expected number.

### Finding H — `+ 14_400` is the EDT offset *(Nit)*

B3 and the two comments that carry it (`observation.js:96-99`, `intradayConfig.js:33-37`,
report `:267`) state the identity as `floor(lastTradeTime / 60_000) × 60 + 14_400`. 14 400 s is four
hours — the **EDT** offset. Observed in September; under EST it would be 18 000. The prose says "the
Eastern offset", which is season-neutral, but the formula beside it is pinned to one season and will
read as wrong to anyone checking it in January. No code depends on it — `snapshotTs` is identity-only,
which is the whole point of F2 — so this is precision, not correctness. Suggest "+ the Eastern offset
in seconds (14 400 observed in September; 18 000 under EST)".

---

## 6. What this review did not do

- **The build prompt was unavailable.** `INTRADAY_FOLLOWUPS_1_PROMPT_V1_2.md` is not in the repo, so I
  could not check the four commits against their original scope — only against the build report, the
  commit messages, and the code. If the prompt asked for something absent here, this review would not
  see it. (The F3 commit does note one prompt/reality divergence it handled: *"The prompt assumed an
  every-reason-has-copy test; none existed"* — which is the test finding A concerns.)
- **No subagent fan-out.** At 17 files / +524 lines this is below the BUILD_RULES §2 mandatory-review
  threshold (≥10 files **and** the brief's proportionate framing), and the brief narrowed the lenses
  deliberately. The adversarial requirement was met differently and, for this size, more strictly: **every
  claimed guard was attacked directly with a planted defect** rather than argued about. Nine mutations,
  one survivor — finding A — which is the refutation this review owed itself.
- **No production observation.** Crons do not run on Vercel preview (BUILD_RULES §6). The revised S7
  is a day-2 reading; nothing here confirms what it will actually show. My verification of the
  correction is analytic (poll window + B4 + the ratio's definition), not measured.

---

## 7. Recommendation

**Merge with addendum.** The code is sound and the guards are real — I tried to break eight of them
and could not. Ship it.

The addendum items are all documentation or test-comment edits, none of which touch behaviour, and
they can ride the next commit into this branch or follow separately:

1. **A** — correct the census comment, and (preferred) extend the scan to upstream `reason:` literals.
   *The only item where a future change could go wrong silently.*
2. **B** — put F1's defect in the conditional and record that it is unreachable under `'fullday'`.
3. **D** — retitle the retracted premise at `validator.test.js:53-55`.
4. **C** — qualify the 74 % as a different endpoint and denominator.
5. **E** — one cross-reference line at each end of the §8.3 ↔ `POLICY_VERSION` coupling.
6. **F** — commit the Live v2 fixture, or downgrade B1/B2/B3/B7/B8 to MEASURED-not-in-repo.
7. **G**, **H** — nits; take or leave.

None of these block the merge, and none of them require re-running the gates.

---

*Review performed read-only on project state. Mutations ran exclusively in three path-distinct
`git archive` snapshot trees under the session scratchpad, per the BUILD_RULES §2 reviewer-isolation
ruling; the working tree was never mutated and no reviewer wrote to git.*
