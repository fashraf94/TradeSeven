# Build T0a — the Mandate's sector cap in the right units, and the Practice Field's documents into the repo

**Date:** 12 Nov 2026 (the founder's follow-up instruction applied the same evening; the second census read falls at 00:25 UTC on 13 Nov) · **Built by:** Claude Code (Opus) · **For:** the founder, and Astra's review of T0a, T0b and T0c as a set
**Base:** `main` at `c37baa0d` (the #1044 merge), fetched at session start and again before each commit and the push; unchanged throughout.
**Branch:** `claude/practice-field-t0a-sector-cap` (pushed from the worktree branch `claude/practice-field-t0a-sector-cap-7a01d1`). **Draft PR:** fashraf94/TradeSeven#1046; not merged, CI not watched.
**Commits:** `b64abfc8` the build and the documents · `985944d0` the review fixes (§5) · `b75ba2b1` the first report · `9506e3c4` exit-only for an unstamped vintage and the addendum's Destination line (the founder's ruling and instruction, §5) · the report commit that carries this text.
**Inputs:** the T0a build prompt; concept V6.1 §3 and ruling 25; Astra's V5 review C5-05 and B5 (the sector-cap finding and its required tests); the founder's ruling on Q1 and follow-up instruction (12 Nov 2026). The prompt also pointed at "Astra's V6 review C6-05 / B5"; C6-05 in the V6 review is about source provenance, so the sector-cap text read was the V5 review's C5-05 / B5 (see §6).

## 1. In plain terms

**The bug.** Each archetype's character sheet says how many of its six battle picks may sit in one sector: 2, 3 or 4. The Mandate engine (the paper-portfolio engine the Practice Field will run on) copied that number into its own rule book unchanged, then read it as a share of the book's value. So "3" meant "300% of the book in one sector", a limit that can never be reached. The sector limit never applied to any book.

**The fix.** When the engine freezes an archetype's rules (a "vintage"), it now translates the count once: 2 of 6 becomes one third of the book, 3 of 6 becomes one half, 4 of 6 becomes two thirds. The frozen rules record the original count, the six it was out of, the resulting share, and a version stamp for the translation. The founder approved this exact translation as concept V6.1 ruling 25.

| Archetype | Count on the character sheet | Sector limit in the book |
|---|---|---|
| Diversifier, Capital Preserver | 2 of 6 | 33.3% |
| Fundamental Investor, Contrarian, Trend Follower | 3 of 6 | 50.0% |
| Speculator | 4 of 6 | 66.7% |

**What else changed.**
- The sector check now refuses any limit that is not a share between 0 and 100% (for example a raw 3), instead of reading it as "no limit".
- Old rules without the translation stamp are never pinned to a book: creating a book, the escape hatch and the quarterly rollover all refuse them (`vintage_uncorrected`).
- A book already pinned to old rules runs **exit-only**, by the founder's ruling of 12 Nov 2026. It may still sell or trim through the existing exit lane; any new buy is refused with the reason `vintage_uncorrected`. The evaluation logs a loud alert for such a book on every run, and the batch harvest follows the same rule.
- The manager's instructions now say "Sector concentration cap: 33.3%" (or 50.0% or 66.7%). They can no longer say 200–400%.
- The character sheet itself (a fenced file) was read, not edited. The battle game's own sector rule is untouched and keeps its meaning.

**What it does not claim.** This is a translation from a rule about equal slots ("at most 2 of 6 picks") into a rule about dollars ("at most a third of the book's value"). The two agree only when holdings are equal in size. With unequal holdings they differ: two large positions can breach a third of the book, and three small ones may not. The book now has a dollar rule that binds; it is not the battle rule restated.

**The census, twice.** Two counts-only reads of production found **0 documents in `archetypeVintages` and 0 in `mandates`** each time:

| Read | Time (UTC) | `archetypeVintages` | `mandates` |
|---|---|---|---|
| During the build | 2026-11-12T23:12:41Z | 0 | 0 |
| After the founder's ruling, at his instruction | 2026-11-13T00:25:18Z | 0 | 0 |

Method: Firestore aggregate `count()` on the two collections, through the growth replay's read-only service-account recipe (`scripts/experiments/growth-replay/README.md:19`, `:22`: read-only calls; `FIREBASE_ADMIN_CREDENTIALS` read from the primary checkout's `.env.local`, never printed), the same path the Phase 0 audit used. The script sat in the session scratchpad and passed an empty write-call grep before each run; it printed the two counts and the read time, nothing else. Nothing had been frozen with the wrong unit, so no migration was needed and none ran. Neither read is B5's inventory at deployment: founder creation stays on (`MANDATE_FOUNDER_CREATE_ENABLED`, `src/config/featureFlags.js:1974`), so a book could still appear before this merges; such a book would run exit-only, not be migrated.

**The documents.** Concept V6.1 (adopted), shared contract V2, the Charter's Scope Addendum A, the Spec 1 supersession note, Astra's three reviews (V5, the V5.1 second pass, V6), the withdrawn V5 and V6 concepts (kept because the reviews cite their lines) and the Phase 0 audit report are now in the repo. All are byte-identical to what was attached except the addendum, whose Destination line now names the path where the file actually lives, at the founder's instruction. One-line pointers sit under the titles of the Charter and the three Spec 1 documents. The index (`docs/README.md`) has a row for each.

**Tests.** The full suite passes on Linux (1,404 files, 31,017 tests, exit 0), as do the lint gate and the production build. The new tests drive all six archetypes' real frozen rules through the real sector check, the real gate, the real evaluation and the real instructions, and pin exit-only: a sell and a trim go through, a buy is refused. Each of 28 deliberate re-breakings of the fix, including the original bug and a return to the full stop, turns at least one test red. A two-lens review with refuters found no must-fix; its one founder question (exit-only or full stop) is now ruled and built.

## 2. Changes by `file:line`

All anchors are at `9506e3c4`, the final code head.

**The translation and the consumer check** — `api/_utils/mandateSectorCap.js`
- `:19–29` the units note (count of six picks → share of book value; not equivalent for unequal holdings).
- `:38` `SECTOR_CAP_CONVERSION_VERSION = 1`, with what a future bump must decide (`:31–37`); `:45` `SECTOR_CAP_SLOT_DENOMINATOR = 6` (bound to `AGENT_PICKS_PER_AGENT`, `src/constants/leagueTournament.js:74`, by a test; the module stays import-free); `:48` `VINTAGE_UNCORRECTED = 'vintage_uncorrected'`.
- `:61` `translateSectorCapSlots(slots)`: integer 1–6 → `n/6`; `null` stays `null`; 0, negative, non-integer, above 6 or a non-number throws, so no vintage is built.
- `:78` `isValidSectorCapFraction` (null, or finite in (0, 1]); `:90` `isSectorCapCorrected(gateConfig)` (the stamp equals the current version), with its policy at `:82–89`.
- `:132` `checkSectorCap`: only `cap === null` means "no cap" (a missing cap no longer passes); `:136` any other cap outside (0, 1] → `passed: false, reason: 'malformed_cap'`. The unknown-sector and non-positive-book-value refusals are unchanged.

**Translate once, at construction** — `api/_utils/mandateVintage.js:96–107`: the gate config records `sectorCapSlots`, `sectorCapDenominator`, `sectorConcentrationCap` (the fraction) and `sectorCapConversionVersion`. `archetypeContent.physics.sectorConcentrationCap` still carries the registry's count. The content hash changes for all six archetypes, so a corrected vintage is a new document; `publishVintage` still never overwrites an existing one (`:167–186`, unchanged).

**Never pin an unstamped vintage**
- Creation — `api/_utils/mandateCreationService.js:58–67`: after publishing, read the pinned document back; refuse with `{ ok: false, code: 'vintage_uncorrected' }` before any book or claim is written (a missing document after publish throws, as escape and rollover already did).
- Escape — `api/_utils/mandateEscape.js:85`: the replacement vintage is checked after its existing Risk-3 read; refused before the transaction.
- Rollover — `api/_utils/mandateRollover.js:132–140`: refused with a thrown error carrying `code: 'vintage_uncorrected'`. A throw, not a quiet skip, so the cron's existing durable failure counter and streak alert see it (`api/cron/mandate-rollover.js:117–136`, unchanged).

**A book already pinned to one is exit-only** (founder ruling, 12 Nov 2026)
- The gate — `api/_utils/mandateGate.js:60` adds `vintageUncorrected`; `:105–113` refuses an entry with rule `sector_cap`, reason `vintage_uncorrected`. It sits after the exit lane (`:81–90`), so a SELL or TRIM on a held name always passes (C-21), and after the quarantine check, which keeps its own reason.
- Evaluation — `api/cron/mandate-evaluate.js:207–213` passes the flag to the gate. The book evaluates as usual; there is no refusal before the model call and no failure count. `:424–429` logs `MANDATE_VINTAGE_UNCORRECTED … exits allowed, entries refused` once per book per fire. The missing-vintage branch is back to `main`'s text.
- Batch harvest — `api/_utils/mandateBatchTransport.js:366` passes the flag to the gate: an entry result is gated (`failCondition: 'vintage_uncorrected'`), an exit result executes, and billing and gate clearing are unchanged.
- The quarantine alert's wording (`api/cron/mandate-evaluate.js:460`, "exit-only mode (tool restricted to SELL/TRIM/HOLD; …)") is now true for such a book. It can be quarantined only by real eval failures, and once quarantined it evaluates with SELL/TRIM/HOLD and its exits execute. A test pins this (§3).

**The prompt** — `api/_utils/mandatePromptAssembly.js:58–66` `sectorCapText`, used at `:94`: a fraction in (0, 1] prints as a percentage (33.3% / 50.0% / 66.7%); `null` prints "none"; anything else prints "unavailable (new entries are refused)", which is what the gate now does. No new import (the closed prompt-input allowlist is untouched) and no new rounding site (the money-path rounding baseline is unchanged).

**Fenced files read, none edited.** `api/_utils/agentArchetypeConfig.js` (the counts at `:66`, `:95`, `:122`, `:151`, `:182`, `:214`; read through `api/_utils/archetypeRegistry.js:148`, as `mandateVintage.js` already did) and `api/_utils/agentGuardrails.js:69–102` (the battle meaning: count ÷ six picks). `git diff c37baa0d 9506e3c4` is empty for both, and for `src/config/featureFlags.js`. No fenced function is called by the new code. No new direct importer of a legacy archetype table, so `archetypeImportBoundaryBaseline.json` is unchanged.

**Tests changed or added**
- New: `api/_utils/mandateSectorCapUnits.test.js` (134 rows, including the gate's exit-only rows at `:254`) and `api/_utils/mandateVintage.malformedCap.test.js` (10 rows; the builder throws on a malformed count, with the registry mocked).
- `api/cron/mandate-evaluate.test.js`: exit-only on an unstamped book, with the stamped control kept. A BUY is gated with `vintage_uncorrected` (`:285`); a SELL executes through the exit lane (`:296`, the row first written as "AS BUILT"); a TRIM executes (`:309`); a quarantined unstamped book gets SELL/TRIM/HOLD and its SELL executes (`:316`); batch transport enqueues with the full tool (`:330`). At `:353`, a real Diversifier vintage runs through the eval: a BUY past a third of the book is gated by `sector_cap`, and a smaller one executes.
- `api/cron/mandateIntegrationHarness.test.js:247` (the sweep): an unstamped book logs `MANDATE_VINTAGE_UNCORRECTED`, reaches the model, executes a SELL, and counts no failure.
- `api/_utils/mandateBatchTransport.test.js:454` (harvest: a BUY is gated, not failed, still billed, gate cleared) and `:473` (harvest: a SELL executes).
- Refusal rows for pinning: `mandateCreationService.test.js`, `mandateEscape.test.js`, `mandateRollover.test.js`.
- `api/_utils/mandateVintage.test.js:70–84`: the row that pinned the bug (`gateConfig` cap equal to the physics count) now pins the translation.
- Four existing eval and batch fixtures gain `sectorCapConversionVersion: 1` (`mandate-evaluate.test.js:53`, `mandateBatchInterleavings.test.js:75`, `mandateIntegrationHarness.test.js:173`, `mandateBatchTransport.test.js:57`). Their cap value (0.30) is unchanged.

## 3. Tests

**Full suite, Linux (the record).** WSL Ubuntu, a fresh detached worktree (Node 20.20.2, the install for main's lockfile `40382e64edb6`), `TZ=UTC`, under `flock /tmp/pd-suite.lock`:

```
npx vitest run --maxWorkers=8 --reporter=default --reporter=json --outputFile.json=<run dir>/vitest.json
```

At the final code head `9506e3c4`: exit code **0**. Read directly from the log (ANSI stripped, not piped through `tail`):

```
 Test Files  1404 passed | 9 skipped (1413)
      Tests  31017 passed | 107 skipped (31124)
   Duration  335.45s
```

Earlier runs, all exit 0:

| Commit | Test Files | Tests |
|---|---|---|
| `b64abfc8` (the build) | 1403 passed, 9 skipped (1412) | 30997 passed, 107 skipped (31104) |
| `985944d0` (review fixes) | 1404 passed, 9 skipped (1413) | 31009 passed, 107 skipped (31116) |

`npm run lint:gate` exit 0 at all three commits. `npx vite build` exit 0 at `b64abfc8`, at `b75ba2b1` (the first pushed head) and at the final pushed head. `main` did not move during the session (`origin/main` = `c37baa0d` at the last fetch), so the branch alone is the merge result. The emulator rules suite was not run: no rules file, flag or rules-read path changed.

**Targeted, Windows.** `node <repo>/node_modules/vitest/vitest.mjs run api/_utils/mandate api/cron/mandate api/mandate` at `9506e3c4`: 568 rows pass, and 10 rows fail in four structural tests (`mandateModelCall.imports`, `mandateUniverseSnapshot.imports`, `mandateMoneyRounding.scan`, `mandateNativeEsm.smoke`). Those 10 rows fail identically on a snapshot of untouched `main` under Windows (the closure walker builds `api\…` paths with `path.relative`, and `import()` refuses a bare `C:` path); they pass in the Linux run above.

**New and changed rows.**

| Required | Rows |
|---|---|
| All six archetypes produce the expected fractions and a changed content hash | `mandateSectorCapUnits.test.js` "the translation table": six rows on the real `buildVintagePayload` output (count, denominator 6, fraction, stamp) and six rows comparing the content hash against the rebuilt pre-T0a payload |
| Exactly at the limit passes; above fails; existing exposure and spend both count | per archetype, on a $123,456.78 book (a sixth is exactly $20,576.13, so every limit is a whole cent): at the limit passes, one cent over fails, a sector already at the limit refuses one more cent, the whole limit from an empty sector passes and a cent more fails, other sectors do not count |
| Unequal positions, absent sector, zero book value, malformed cap, null policy | unequal Technology holdings through the real `evaluateGate` with each archetype's real gate config: a dollar under the headroom is admitted, a dollar over is refused by `sector_cap` (asserted by rule name, not just `passed: false`); `NOSECTOR` → `unknown_sector`; zero and negative book value → `no_total_value`; caps 2, 3, 4, 0, −0.1, 1.0000001, NaN, ±Infinity, `'0.5'`, `undefined`, `{}` → `malformed_cap`; the raw count through the gate → `malformed_cap`; `null` → `no_cap` and a 65%-Technology book still admits a buy |
| The prompt prints the three percentages, never above 100% | each archetype's real vintage through `assembleMandatePrompt`: the exact line, every percentage in the prompt ≤ 100, the printed set is exactly {33.3%, 50.0%, 66.7%}; caps 2, 3, 4 and `undefined` print "unavailable (new entries are refused)"; `null` prints "none" |
| Creation, escape and rollover never pin an unstamped vintage | creation (no book, no claim, stored doc untouched; plus a control), escape (old book and once-ever flag untouched), rollover (typed throw, book un-rolled) |
| A book already pinned to one is exit-only (founder ruling) | the gate (BUY and ADD refused with `vintage_uncorrected`, each with a stamped control; SELL and TRIM through the exit lane; HOLD passes); the eval (BUY gated, SELL and TRIM executed, the stamped control executed, a quarantined book restricted to SELL/TRIM/HOLD with its SELL executed, batch enqueued with the full tool); the sweep (alert logged, model reached, SELL executed, no failure counted); the harvest (BUY gated and billed, SELL executed) |
| The fenced table is byte-identical | SHA-256 of `agentArchetypeConfig.js` (CRLF normalised to LF) pinned to the blob at `c37baa0d` |

Also: translation rows for 1–6 and twelve malformed counts; the builder throwing on seven malformed registry counts (mocked registry, two controls); the admission predicate against seven unstamped or foreign-version gate configs; the denominator equal to `AGENT_PICKS_PER_AGENT`.

**Mutation checks** (BUILD_RULES §2). Each battery ran on its own snapshot tree, with a green control first, over the Mandate files that carry the rows.

| Commit | Rows | Mutants | Killed |
|---|---|---|---|
| `b64abfc8` | 263 | 23 | 23 |
| `985944d0` | 275 | 24 | 24 |
| `9506e3c4` | 283 | 28 | 28 |

What the mutants re-break:
- **The translation:** the raw count copied (the original bug), the stamp dropped, the wrong denominator, the range guard off, counts above 6 accepted, the builder swallowing a malformed count.
- **The cap check:** `== null`, the malformed check removed, 1 rejected, 0 accepted, existing exposure ignored, spend ignored, the tolerance loosened to 1e-3.
- **The stamp:** the predicate always true, the version bumped.
- **Pinning:** the creation, escape and rollover refusals removed.
- **Exit-only:**
  - the eval or the harvest not passing the flag;
  - the gate ignoring the flag;
  - the gate refusing exits too;
  - the eval reinstating the superseded full stop;
  - quarantine not restricting the tool for an unstamped book;
  - the sweep alert removed.
- **The prompt:** printing any finite cap; printing a missing cap as "none".
- **The fence:** one byte added to the fenced table.

## 4. The documents

**Copies.** SHA-256 of each attachment before copying (in `Downloads`) and of each committed blob after (`git cat-file blob <commit>:<path> | sha256sum`). The attachments carry no CR bytes, so the LF blob is the attachment exactly, except where the table says otherwise.

| File | Lands at | Before (attachment) | After (committed blob) |
|---|---|---|---|
| `20261112_PRACTICE_FIELD_CONCEPT_V6_1.md` | `docs/design/` | `69e658b1cff1c71167f945c8b284d1093ac9bfe968598b3343917f3bb55a8913` | identical |
| `20261112_PRACTICE_FIELD_SHARED_CONTRACT_V2.md` | `docs/design/` | `1f4eadd6162c8b66d1d20772bf55716b52f535f745a5d2da74f79bcdcc68310f` | identical |
| `20261112_AGENT_LEARNING_CHARTER_SCOPE_ADDENDUM_A.md` | `docs/` | `65d41eedd85d0c4c770e7536b96c82faabbe5b1c091dfb0ee7f0eac54159edd0` | identical at `b64abfc8`; at `9506e3c4`, after the Destination fix: `a4d316eca4753a42170a1e3a5aa3e63930d7b19645ec8399f3ba4f7a0c5f517c` (3,584 bytes) |
| `20261112_MANDATE_SPEC1_SUPERSESSION_NOTE.md` | `docs/` | `7c94d18e276c2937282ffdc28b7975dfd5d4a2c07af850a50dc16426ff714b5b` | identical |
| `20261112_ASTRA_REVIEW_PRACTICE_FIELD_CONCEPT_V5.md` | `docs/audits/` | `44a4d399008c3e4fc601d56bcd466a15c7d57be6a0fbb56f9060d547a8bf8ce1` | identical |
| `20261112_ASTRA_REVIEW_PRACTICE_FIELD_CONCEPT_V6.md` | `docs/audits/` | `9e99c6ad73d7e5e2da787d2cfa3ba798d7eefc0c2d30da8ee35ee871e8231971` | identical |
| `20261112_ASTRA_REVIEW_PRACTICE_FIELD_CONCEPT_V5_1_SECOND_PASS.md` | `docs/audits/` | `9ce0ba8772eff823f354af269d755c9dcf2bda6c118986af15c326667d7a12c0` | identical |
| `20261112_PRACTICE_FIELD_CONCEPT_V5.md` (withdrawn) | `docs/design/` | `aaf732aab6a29ccf34ae9606e911981ec0604d3042f447d6bf58bc86c50e3d3f` | identical |
| `20261112_PRACTICE_FIELD_CONCEPT_V6.md` (withdrawn) | `docs/design/` | `086ff0b7a0e943816ba057d1d558633db77ac5b6127495f065058660ca65a3ad` | identical |

**The addendum's Destination line** (founder instruction, 12 Nov 2026). The original read ``**Destination:** `docs/AGENT_LEARNING_CHARTER_V1_SCOPE_ADDENDUM_A.md`, carried by …``; it now names `docs/20261112_AGENT_LEARNING_CHARTER_SCOPE_ADDENDUM_A.md`, where the file lives. That one path is the only change (`git diff --numstat`: `1 1`); the README row records both hashes.

The prompt's table listed eight files. The two Astra reviews were not in the first attachment set (only their briefs, whose hashes differ); the founder supplied them during the session, together with a ninth file, Astra's second pass on V5.1, which concept V6.1 counts among "Astra's three reviews". It lands beside the other two.

**The audit report from its branch.** `docs/audits/20261112_PHASE0_TEST_PORTFOLIO_AUDIT.md` taken with `git show origin/claude/practice-field-test-portfolio-phase0:<path>` (branch at `a59601c5`); git blob `55856bae6a787d1833175836c24b814ef2c77a28` on that branch and on this one (SHA-256 `d9ecfdf0abeb8ec37d2277675a7b6538c58d0ae4ff4c0d7e1ed876a026c86d69`). The branch was not merged; its README row text was reused as this file's row.

**The four pointer lines,** each inserted directly under the title line; `git diff --numstat c37baa0d` shows `1 0` for each file and nothing else changed:
- `docs/AGENT_LEARNING_CHARTER_V1.md:2` — `> Scope Addendum A (12 Nov 2026): docs/20261112_AGENT_LEARNING_CHARTER_SCOPE_ADDENDUM_A.md — the Practice Field's idea book under this Charter. Addition only; no clause loosened.`
- `docs/SPEC1_MANDATE_SUBSTRATE_SPEC_V1_4.md:2`, `docs/MANDATE_RUNBOOK.md:2`, `docs/audits/MANDATE_ACCEPTANCE_REPORT_V1.md:2` — `> Supersession note (12 Nov 2026): docs/20261112_MANDATE_SPEC1_SUPERSESSION_NOTE.md — the quarterly product is retired; the engine stays as the Practice Field's substrate. This document's text is kept as recorded.`

**`docs/README.md` rows** (Contents table, after the Practice Field ruling sheet, `:111–121`): one row each for the audit report, V5 (withdrawn before adoption; kept because Astra's review cites its lines), Astra's V5 review, Astra's V5.1 second pass, V6 (withdrawn, same reason), Astra's V6 review, V6.1 (adopted by founder, 12 Nov 2026, rulings 1–26), shared contract V2, Scope Addendum A (both hashes and the Destination fix), the supersession note, and this report. The contract, the addendum and the note are described with the status their own text gives ("awaiting the founder's adoption"); the prompt calls them adopted documents, and their adoption lines are blank.

## 5. BUILD_RULES §2 review

**Why it was mandatory.** The branch changes 35 files and about 3,300 lines (most of them the carried documents), over both thresholds.

**How it ran.**
- Two independent lenses, each a subagent on its own `git archive` snapshot of `b64abfc8` under the session scratchpad (`node_modules` linked, read-only, no git writes): **A**, domain correctness and wiring; **B**, test integrity and the documents.
- Every finding went to a refuter told to disprove it with a concrete repro, in three batches: the correctness findings, the document findings, the notes. The refuters read the lens trees and a snapshot of untouched `main` (for "pre-existing?" questions), and wrote only scratch files.
- The mutation lens ran on its own tree, again after each round of changes (§3).
- `vite build` ran on the build commit and on each pushed head.

**Findings, verdicts, dispositions.** Severity is as raised. CONFIRMED means the refuter could not disprove the finding; PARTIAL means part of it held.

| Id | Raised as | Finding | Refuter | Disposition |
|---|---|---|---|---|
| A-1 = B-3 | should-fix + ruling | As first built, the eval and harvest refusal blocked exits as well as entries; nothing re-pins such a book, so the stop would be indefinite (Spec 1 §3.4: "no exit-suppressing state may be indefinite"), and after five failures the quarantine alert would announce an "exit-only mode" the book was not in. | **PARTIAL.** The facts held; the build followed the prompt's letter ("refused … and no trade"); the mechanism already exists for a missing vintage on `main`; the trigger was new. | **Founder ruling (12 Nov 2026): exit-only.** Built in `9506e3c4`: the refusal moved into the gate after the exit lane; entries refused (`vintage_uncorrected`), SELL/TRIM executed; no failure counting, so the quarantine alert is reached only through real failures and is then true (pinned by test). |
| A-2 | should-fix (latent) | `isSectorCapCorrected` requires exact equality, so a future version bump would treat every book pinned at version 1 as unstamped. | **PARTIAL.** Real but latent. The suggested fix (accept any stamp) is unsafe: after a rollback, old code would accept a stamp it does not understand. Narrowest correct rule: an explicit list of understood versions at eval and harvest, equality where a vintage is pinned. | No code change. The constant's comment states the rule for whoever bumps it (`mandateSectorCap.js:31–37`). Under exit-only, a bump now costs pinned books their entries, not their exits. |
| A-3 = B-6 | note | The creation, escape and rollover refusals cannot fire without an out-of-band write: they read back the document at the content address of a freshly built, stamped payload, and only `publishVintage` writes there. | CONFIRMED | Kept as defence in depth. |
| A-4 | note | `vintage_uncorrected` maps to HTTP 400 in the create and escape endpoints, a client error, though the cause is server-side. | CONFIRMED (unreachable, per A-3) | Reported, §6. |
| A-5 | note | As first built: the refusal ran before the open-batch age-out, and a batch in flight across the deploy could count one failure twice. | CONFIRMED, identical to `no_vintage` on `main` | Moot after the ruling: an unstamped book now evaluates normally and counts no failure. |
| A-6 | note | Rollover sets `err.code` and the cron logs only the message. | PARTIAL: the message carries `vintage_uncorrected` | No change. |
| A-7 | note | The prompt's `sectorCapText` re-implements `isValidSectorCapFraction`, because importing it would mean classifying `mandateSectorCap.js` in the prompt registry. | CONFIRMED, equivalent today | Reported only. |
| B-1 | should-fix | The README row for this report pointed at a file missing at `b64abfc8`. | **REFUTED** as a defect of the PR: the report commit added the file and both commits were pushed together. | No change. |
| B-2 | should-fix | The Astra V5 row said T0a implements B5, but B5 also asks for an inventory at deployment. | **PARTIAL.** A build-time count is not B5's deploy-time inventory. | Fixed: the row says what the build does; §1 records both censuses and says neither is the deployment inventory. |
| B-4 | note | The units file's header said every row fails pre-fix; 33 behaviour rows pass against `main`'s code. | CONFIRMED (64 pass, 65 fail on base) | Fixed: the header lists which rows discriminate and which are controls. |
| B-5 | note | The boundary comment implied an exact limit; in floating point the 1/3 and 2/3 at-limit rows pass through the 1e-9 tolerance. | CONFIRMED (+5.6e-17, +1.1e-16) | Fixed: the comment says so; the one-cent rows stay sharp. |
| B-7 | note | Two refusal-row titles claimed more than they asserted. | (i) PARTIAL, (ii) CONFIRMED | Both titles fixed; the eval rows were later rewritten for exit-only. |
| B-8 | note | (i) The four stamped fixtures (0.30 plus a stamp) are an impossible shape. (ii) No test ran a real vintage through the eval. (iii) No test proved the builder throws on a malformed count. | All CONFIRMED | (i) Reported only (nothing reads the missing fields). (ii) Fixed: a real Diversifier vintage through the eval. (iii) Fixed: `mandateVintage.malformedCap.test.js`. |
| B-9 | note | The local denominator's comment cited a retired import rule; the test called its `src` import a §4 guard. | PARTIAL | Both comments fixed. |
| B-10 | note | The V6.1 row says adopted while V6.1's own status line says the rulings await approval. | CONFIRMED (an inconsistency in the sources) | The row keeps the prompt's wording and adds a status-as-written note. Shared contract V2 records the approval. |
| B-11 | note | The addendum's Destination line named a different path. | CONFIRMED | **Fixed at the founder's instruction** in `9506e3c4`; both hashes recorded (§4). |
| B-12 | note | The four pointer lines shift by one every line anchor that other documents cite into those files. | CONFIRMED: 44 anchors (25 in documents this branch adds, 19 already in `docs/`; none in code) | Reported, §6. The placement is the prompt's instruction. |
| — | note | A test title rendered "n of 6 → NaN/6". | CONFIRMED | Fixed. |

The exit-only change (`9506e3c4`) was made after the two lenses had reported; it was checked by the full Linux suite, the targeted Windows run, and the third mutation battery with seven mutants aimed at it (§3). It did not get a fresh pair of review lenses.

### Founder questions

1. **Exit-only, or a full stop, for a book pinned to a vintage without the stamp?** **Ruled 12 Nov 2026: exit-only.** Built as §2 describes.
2. **A fresh counts-only census just before merge** would be B5's inventory at deployment. Two reads this session found none (§1); founder creation stays on until merge, and any book created meanwhile would run exit-only after it.

## 6. Found outside the task (reported, not fixed)

1. **The prompt's Astra anchor.** It said "Astra's V6 review C6-05 / B5". In the V6 review, C6-05 is about source provenance; the sector-cap finding and its tests are the **V5** review's C5-05 and B5, which this build followed.
2. **The attachment set.** The prompt's table listed eight files, but the two Astra reviews were not attached at first; the founder supplied them during the session, together with the V5.1 second pass (§4).
3. **Line anchors shifted by the pointers.** 44 anchors in `docs/` cite line numbers in the Charter (32), Spec 1 (7), the acceptance report (4) and the runbook (1). All are now one line off. 25 sit in documents this branch adds; for example, Astra's V6 review cites `MANDATE_ACCEPTANCE_REPORT_V1.md:3`, which now holds a blank line.
4. **The missing-vintage path's alert and agency state.** On `main`, a book whose vintage is missing is quarantined after five failures with an alert announcing "exit-only mode", and its daily rows record `agencyState: 'exit_only'`. Neither is true for a book that cannot evaluate at all (`api/cron/mandate-evaluate.js:460`, `api/_utils/mandateClosePass.js:109`). After the ruling, T0a no longer feeds this path; the missing-vintage case itself is unchanged.
5. **An absent count reads as "no cap".** The registry turns a missing `sectorConcentrationCap` key into `null` (`api/_utils/archetypeRegistry.js:148`), so removing a count from the fenced table would yield a stamped "no sector cap" vintage rather than an error. Today all six counts are present, and the units file pins each one, so such a removal turns a test red.
6. **HTTP status for `vintage_uncorrected`** is 400 in `api/mandate/create.js:93` and by default in `api/mandate/escape.js`; a server-side cause would better be 409 or 500. Unreachable today (A-3/A-4).
7. **Windows-only test failures.** 10 rows in four Mandate structural tests (`mandateModelCall.imports`, `mandateUniverseSnapshot.imports`, `mandateMoneyRounding.scan`, `mandateNativeEsm.smoke`) fail on Windows on untouched `main`. The cause is the closure walker's `path.relative` returning `api\…` paths, and `import()` refusing a bare `C:` path. All pass on Linux.
