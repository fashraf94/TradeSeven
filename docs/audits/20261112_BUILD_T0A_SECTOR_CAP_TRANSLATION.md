# Build T0a — the Mandate's sector cap in the right units, and the Practice Field's documents into the repo

**Date:** 12 Nov 2026 · **Built by:** Claude Code (Opus) · **For:** the founder, and Astra's review of T0a, T0b and T0c as a set
**Base:** `main` at `c37baa0d` (the #1044 merge), fetched at session start and again before the build commit; unchanged.
**Branch:** `claude/practice-field-t0a-sector-cap` (pushed from the worktree branch `claude/practice-field-t0a-sector-cap-7a01d1`). **Build commit:** `b64abfc8`. **Draft PR:** see the PR's own page; not merged, CI not watched.
**Inputs:** the T0a build prompt; concept V6.1 §3 and ruling 25; Astra's V5 review C5-05 and B5 (the sector-cap finding and its required tests). The prompt also pointed at "Astra's V6 review C6-05 / B5"; C6-05 in the V6 review is about source provenance, so the sector-cap text read was the V5 review's C5-05 / B5 (see §6).

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
- A book whose frozen rules lack the translation stamp is refused, with the reason `vintage_uncorrected` and no trade, everywhere a book loads its rules: creating a book, the escape hatch, the quarterly rollover, the twice-daily evaluation and the batch harvest.
- The manager's instructions now say "Sector concentration cap: 33.3%" (or 50.0% or 66.7%). They can no longer say 200–400%.
- The character sheet itself (a fenced file) was read, not edited. The battle game's own sector rule is untouched and keeps its meaning.

**What it does not claim.** This is a translation from a rule about equal slots ("at most 2 of 6 picks") into a rule about dollars ("at most a third of the book's value"). The two agree only when holdings are equal in size. With unequal holdings they differ: two large positions can breach a third of the book, and three small ones may not. The book now has a dollar rule that binds; it is not the battle rule restated.

**The census.** A counts-only read of production at 2026-11-12T23:12:41Z found **0 documents in `archetypeVintages` and 0 in `mandates`**, matching the Phase 0 audit. Method: Firestore aggregate `count()` on the two collections, through the growth replay's read-only service-account recipe (`scripts/experiments/growth-replay/README.md:19`, `:22`: read-only calls; `FIREBASE_ADMIN_CREDENTIALS` read from the primary checkout's `.env.local`, never printed), the same path the Phase 0 audit used; the script sat in the session scratchpad and passed an empty write-call grep before it ran; it printed the two counts and the read time, nothing else. Nothing had been frozen with the wrong unit, so no migration was needed and none ran. This count is not B5's inventory at deployment: founder creation stays on (`MANDATE_FOUNDER_CREATE_ENABLED`, `src/config/featureFlags.js:1974`), so a book could appear before this merges. Any book pinned to an unstamped vintage then is refused (`vintage_uncorrected`), not migrated.

**The documents.** Concept V6.1 (adopted), shared contract V2, the Charter's Scope Addendum A, the Spec 1 supersession note, Astra's three reviews (V5, the V5.1 second pass, V6), the withdrawn V5 and V6 concepts (kept because the reviews cite their lines) and the Phase 0 audit report are now in the repo, byte-identical. One-line pointers sit under the titles of the Charter and the three Spec 1 documents. The index (`docs/README.md`) has a row for each.

**Tests.** The full suite passes on Linux (1,404 files, 31,009 tests, exit 0), as do the lint gate and the production build. The new tests drive all six archetypes' real frozen rules through the real sector check, the real gate, the real evaluation and the real instructions. Each of 24 deliberate re-breakings of the fix, including the original bug, turns at least one test red. A two-lens review with refuters found no must-fix. It leaves one founder question: should a book with old, unstamped rules still be allowed to sell (§5, Q1)?

## 2. Changes by `file:line`

Two commits: `b64abfc8` (the build and the documents) and `985944d0` (the review fixes, §5). All anchors are at `985944d0`, the final code head.

**The translation and the consumer check** — `api/_utils/mandateSectorCap.js`
- `:19–29` the units note (count of six picks → share of book value; not equivalent for unequal holdings).
- `:38` `SECTOR_CAP_CONVERSION_VERSION = 1`, with what a future bump must decide (`:31–37`); `:45` `SECTOR_CAP_SLOT_DENOMINATOR = 6` (bound to `AGENT_PICKS_PER_AGENT`, `src/constants/leagueTournament.js:74`, by a test; the module stays import-free); `:48` `VINTAGE_UNCORRECTED = 'vintage_uncorrected'`.
- `:61` `translateSectorCapSlots(slots)`: integer 1–6 → `n/6`; `null` stays `null`; 0, negative, non-integer, above 6 or a non-number throws, so no vintage is built.
- `:78` `isValidSectorCapFraction` (null, or finite in (0, 1]); `:88` `isSectorCapCorrected(gateConfig)` (the stamp equals the current version).
- `:130` `checkSectorCap`: only `cap === null` means "no cap" (a missing cap no longer passes); `:134` any other cap outside (0, 1] → `passed: false, reason: 'malformed_cap'`. The unknown-sector and non-positive-book-value refusals are unchanged.

**Translate once, at construction** — `api/_utils/mandateVintage.js:96–107`: the gate config records `sectorCapSlots`, `sectorCapDenominator`, `sectorConcentrationCap` (the fraction) and `sectorCapConversionVersion`. `archetypeContent.physics.sectorConcentrationCap` still carries the registry's count. The content hash changes for all six archetypes, so a corrected vintage is a new document; `publishVintage` still never overwrites an existing one (`:167–186`, unchanged).

**Admission refuses an unstamped vintage**
- Creation — `api/_utils/mandateCreationService.js:58–67`: after publishing, read the pinned document back; refuse with `{ ok: false, code: 'vintage_uncorrected' }` before any book or claim is written (a missing document after publish throws, as escape and rollover already did).
- Escape — `api/_utils/mandateEscape.js:85`: the replacement vintage is checked after its existing Risk-3 read; refused before the transaction.
- Rollover — `api/_utils/mandateRollover.js:132–140`: refused with a thrown error carrying `code: 'vintage_uncorrected'`. A throw, not a quiet skip, so the cron's existing durable failure counter and streak alert see it (`api/cron/mandate-rollover.js:117–136`, unchanged).
- Evaluation — `api/cron/mandate-evaluate.js:97–100`: refused before the prompt, the model call and any batch enqueue (`outcome: 'skipped', reason: 'vintage_uncorrected'`); the handler logs `MANDATE_VINTAGE_UNCORRECTED` instead of `MANDATE_NO_VINTAGE` (`:508–521`) and counts it as an eval failure like a missing vintage.
- Batch harvest — `api/_utils/mandateBatchTransport.js:336–344`: the submission is disposed `failed` with `failCondition: 'vintage_uncorrected'`, its spend still billed, the gate cleared — the same terminal shape as the existing `no_vintage` branch.

**The prompt** — `api/_utils/mandatePromptAssembly.js:58–66` `sectorCapText`, used at `:94`: a fraction in (0, 1] prints as a percentage (33.3% / 50.0% / 66.7%); `null` prints "none"; anything else prints "unavailable (new entries are refused)". No new import (the closed prompt-input allowlist is untouched) and no new rounding site (the money-path rounding baseline is unchanged).

**Fenced files read, none edited.** `api/_utils/agentArchetypeConfig.js` (the counts at `:66`, `:95`, `:122`, `:151`, `:182`, `:214`; read through `api/_utils/archetypeRegistry.js:148`, as `mandateVintage.js` already did) and `api/_utils/agentGuardrails.js:69–102` (the battle meaning: count ÷ six picks). `git diff c37baa0d b64abfc8` is empty for both, and for `src/config/featureFlags.js`. No fenced function is called by the new code. No new direct importer of a legacy archetype table, so `archetypeImportBoundaryBaseline.json` is unchanged.

**Tests changed or added**
- New: `api/_utils/mandateSectorCapUnits.test.js` (129 rows) and `api/_utils/mandateVintage.malformedCap.test.js` (10 rows; the builder throws on a malformed count, with the registry mocked).
- `api/cron/mandate-evaluate.test.js:294` pins today's exit behaviour (a SELL on an uncorrected book is refused; the stamped control executes; founder question Q1), and `:335` runs a real Diversifier vintage through the eval (a BUY past a third of the book is gated by `sector_cap`; a smaller one executes).
- Refusal rows added beside each harness: `mandateCreationService.test.js`, `mandateEscape.test.js`, `mandateRollover.test.js`, `mandateBatchTransport.test.js`, `api/cron/mandate-evaluate.test.js`, `api/cron/mandateIntegrationHarness.test.js` (a sweep-level row).
- `api/_utils/mandateVintage.test.js:70–84`: the row that pinned the bug (`gateConfig` cap equal to the physics count) now pins the translation.
- Four existing eval and batch fixtures gain `sectorCapConversionVersion: 1` so they still pass admission (`mandate-evaluate.test.js:53`, `mandateBatchInterleavings.test.js:75`, `mandateIntegrationHarness.test.js:173`, `mandateBatchTransport.test.js:57`). Their cap value (0.30) is unchanged.

## 3. Tests

**Full suite, Linux (the record).** WSL Ubuntu, a fresh detached worktree (Node 20.20.2, the install for main's lockfile `40382e64edb6`), `TZ=UTC`, under `flock /tmp/pd-suite.lock`:

```
npx vitest run --maxWorkers=8 --reporter=default --reporter=json --outputFile.json=<run dir>/vitest.json
```

At the final code head `985944d0`: exit code **0**. Read directly from the log (ANSI stripped, not piped through `tail`):

```
 Test Files  1404 passed | 9 skipped (1413)
      Tests  31009 passed | 107 skipped (31116)
   Duration  281.51s
```

At the build commit `b64abfc8`, before the review fixes: exit 0, `Test Files  1403 passed | 9 skipped (1412)`, `Tests  30997 passed | 107 skipped (31104)`. `npm run lint:gate` exit 0 at both commits. `npx vite build` exit 0 at `b64abfc8` and at the pushed head (the report commit, docs only on top of `985944d0`). `main` did not move during the session (`origin/main` = `c37baa0d` at the last fetch), so the branch alone is the merge result. The emulator rules suite was not run: no rules file, flag or rules-read path changed.

**Targeted, Windows.** `node <repo>/node_modules/vitest/vitest.mjs run api/_utils/mandate api/cron/mandate api/mandate`: every Mandate file passes except three structural tests (10 rows: `mandateModelCall.imports`, `mandateUniverseSnapshot.imports`, `mandateMoneyRounding.scan`, `mandateNativeEsm.smoke`). Those 10 rows fail identically on a snapshot of untouched `main` under Windows (the closure walker builds `api\…` paths with `path.relative`, and `import()` refuses a bare `C:` path); they pass in the Linux run above.

**New and changed rows.**

| Required by the prompt | Rows |
|---|---|
| All six archetypes produce the expected fractions and a changed content hash | `mandateSectorCapUnits.test.js` "the translation table": six rows on the real `buildVintagePayload` output (count, denominator 6, fraction, stamp) and six rows comparing the content hash against the rebuilt pre-T0a payload |
| Exactly at the limit passes; above fails; existing exposure and spend both count | per archetype, on a $123,456.78 book (a sixth is exactly $20,576.13, so every limit is a whole cent): at the limit passes, one cent over fails, a sector already at the limit refuses one more cent, the whole limit from an empty sector passes and a cent more fails, other sectors do not count |
| Unequal positions, absent sector, zero book value, malformed cap, null policy | unequal Technology holdings through the real `evaluateGate` with each archetype's real gate config: a dollar under the headroom is admitted, a dollar over is refused by `sector_cap` (asserted by rule name, not just `passed: false`); `NOSECTOR` → `unknown_sector`; zero and negative book value → `no_total_value`; caps 2, 3, 4, 0, −0.1, 1.0000001, NaN, ±Infinity, `'0.5'`, `undefined`, `{}` → `malformed_cap`; the raw count through the gate → `malformed_cap`; `null` → `no_cap` and a 65%-Technology book still admits a buy |
| The prompt prints the three percentages, never above 100% | each archetype's real vintage through `assembleMandatePrompt`: the exact line, every percentage in the prompt ≤ 100, the printed set is exactly {33.3%, 50.0%, 66.7%}; caps 2, 3, 4 and `undefined` print "unavailable (new entries are refused)"; `null` prints "none" |
| An unstamped vintage is refused at every resolution point | creation (no book, no claim, stored doc untouched; plus a control), escape (old book and once-ever flag untouched), rollover (typed throw, book un-rolled), `runBookEval` direct and batch (no model call, no enqueue, no money; plus a control), the eval sweep (`MANDATE_VINTAGE_UNCORRECTED` logged, failure counted, frontier advanced, model never reached), the batch harvest (disposed `failed/vintage_uncorrected`, no trade, still billed, gate cleared) |
| The fenced table is byte-identical | SHA-256 of `agentArchetypeConfig.js` (CRLF normalised to LF) pinned to the blob at `c37baa0d` |

Also: translation rows for 1–6 and twelve malformed counts; the admission predicate against seven unstamped or foreign-version gate configs; the denominator equal to `AGENT_PICKS_PER_AGENT`.

**Mutation check** (BUILD_RULES §2), on its own snapshot tree, the 11 Mandate files that carry the rows (263 tests; control green): 23 mutants, each re-breaking one piece of the fix — the raw count copied (the original bug), the stamp dropped, the wrong denominator, the range guard off, counts above 6 accepted, `== null` in the check, the malformed check removed, 1 rejected, 0 accepted, existing exposure ignored, spend ignored, the predicate always true, each of the six refusals removed, the wrong alert, the prompt printing any finite cap, the prompt printing a missing cap as "none", the version bumped, one byte added to the fenced table, the tolerance loosened to 1e-3. **23 of 23 killed** (one anchor first failed to match because the snapshot is CRLF; re-anchored and killed).

## 4. The documents

**Byte-identical copies.** SHA-256 of each attachment before copying (in `Downloads`) and of each committed blob after (`git cat-file blob b64abfc8:<path> | sha256sum`). The attachments carry no CR bytes, so the LF blob is the attachment exactly.

| File | Lands at | Before (attachment) | After (committed blob) |
|---|---|---|---|
| `20261112_PRACTICE_FIELD_CONCEPT_V6_1.md` | `docs/design/` | `69e658b1cff1c71167f945c8b284d1093ac9bfe968598b3343917f3bb55a8913` | identical |
| `20261112_PRACTICE_FIELD_SHARED_CONTRACT_V2.md` | `docs/design/` | `1f4eadd6162c8b66d1d20772bf55716b52f535f745a5d2da74f79bcdcc68310f` | identical |
| `20261112_AGENT_LEARNING_CHARTER_SCOPE_ADDENDUM_A.md` | `docs/` | `65d41eedd85d0c4c770e7536b96c82faabbe5b1c091dfb0ee7f0eac54159edd0` | identical |
| `20261112_MANDATE_SPEC1_SUPERSESSION_NOTE.md` | `docs/` | `7c94d18e276c2937282ffdc28b7975dfd5d4a2c07af850a50dc16426ff714b5b` | identical |
| `20261112_ASTRA_REVIEW_PRACTICE_FIELD_CONCEPT_V5.md` | `docs/audits/` | `44a4d399008c3e4fc601d56bcd466a15c7d57be6a0fbb56f9060d547a8bf8ce1` | identical |
| `20261112_ASTRA_REVIEW_PRACTICE_FIELD_CONCEPT_V6.md` | `docs/audits/` | `9e99c6ad73d7e5e2da787d2cfa3ba798d7eefc0c2d30da8ee35ee871e8231971` | identical |
| `20261112_ASTRA_REVIEW_PRACTICE_FIELD_CONCEPT_V5_1_SECOND_PASS.md` | `docs/audits/` | `9ce0ba8772eff823f354af269d755c9dcf2bda6c118986af15c326667d7a12c0` | identical |
| `20261112_PRACTICE_FIELD_CONCEPT_V5.md` (withdrawn) | `docs/design/` | `aaf732aab6a29ccf34ae9606e911981ec0604d3042f447d6bf58bc86c50e3d3f` | identical |
| `20261112_PRACTICE_FIELD_CONCEPT_V6.md` (withdrawn) | `docs/design/` | `086ff0b7a0e943816ba057d1d558633db77ac5b6127495f065058660ca65a3ad` | identical |

The prompt's table listed eight files. The two Astra reviews were not in the first attachment set (only their briefs, whose hashes differ); the founder supplied them during the session, together with a ninth file, Astra's second pass on V5.1, which concept V6.1 counts among "Astra's three reviews". It lands beside the other two.

**The audit report from its branch.** `docs/audits/20261112_PHASE0_TEST_PORTFOLIO_AUDIT.md` taken with `git show origin/claude/practice-field-test-portfolio-phase0:<path>` (branch at `a59601c5`); git blob `55856bae6a787d1833175836c24b814ef2c77a28` on that branch and at `b64abfc8` (SHA-256 `d9ecfdf0abeb8ec37d2277675a7b6538c58d0ae4ff4c0d7e1ed876a026c86d69`). The branch was not merged; its README row text was reused as this file's row.

**The four pointer lines,** each inserted directly under the title line; `git diff --numstat c37baa0d b64abfc8` shows `1 0` for each file and nothing else changed:
- `docs/AGENT_LEARNING_CHARTER_V1.md:2` — `> Scope Addendum A (12 Nov 2026): docs/20261112_AGENT_LEARNING_CHARTER_SCOPE_ADDENDUM_A.md — the Practice Field's idea book under this Charter. Addition only; no clause loosened.`
- `docs/SPEC1_MANDATE_SUBSTRATE_SPEC_V1_4.md:2`, `docs/MANDATE_RUNBOOK.md:2`, `docs/audits/MANDATE_ACCEPTANCE_REPORT_V1.md:2` — `> Supersession note (12 Nov 2026): docs/20261112_MANDATE_SPEC1_SUPERSESSION_NOTE.md — the quarterly product is retired; the engine stays as the Practice Field's substrate. This document's text is kept as recorded.`

**`docs/README.md` rows** (Contents table, after the Practice Field ruling sheet, `:111–121`): one row each for the audit report, V5 (withdrawn before adoption; kept because Astra's review cites its lines), Astra's V5 review, Astra's V5.1 second pass, V6 (withdrawn, same reason), Astra's V6 review, V6.1 (adopted by founder, 12 Nov 2026, rulings 1–26), shared contract V2, Scope Addendum A, the supersession note, and this report. The contract, the addendum and the note are described with the status their own text gives ("awaiting the founder's adoption"); the prompt calls them adopted documents, and their adoption lines are blank.

## 5. BUILD_RULES §2 review

**Why it was mandatory.** The branch changes 34 files and about 3,000 lines (most of them the carried documents), over both thresholds.

**How it ran.**
- Two independent lenses, each a subagent on its own `git archive` snapshot of `b64abfc8` under the session scratchpad (`node_modules` linked, read-only, no git writes): **A**, domain correctness and wiring; **B**, test integrity and the documents.
- Every finding went to a refuter told to disprove it with a concrete repro, in three batches: the correctness findings, the document findings, the notes. The refuters read the lens trees and a snapshot of untouched `main` (for "pre-existing?" questions), and wrote only scratch files.
- The mutation lens ran on its own tree (§3).
- `vite build` ran on the build commit and again on the pushed head.

**Findings, verdicts, dispositions.** Severity is as raised. CONFIRMED means the refuter could not disprove the finding; PARTIAL means part of it held.

| Id | Raised as | Finding | Refuter | Disposition |
|---|---|---|---|---|
| A-1 = B-3 | should-fix + ruling | The eval and harvest refusal blocks exits as well as entries. The gate alone would let a SELL through the exit lane and refuse entries with `malformed_cap`. Nothing re-pins such a book (rollover is off; escape only covers a first book's first 14 days), so the stop is indefinite, against Spec 1 §3.4's "no exit-suppressing state may be indefinite". After five failures the quarantine alert announces an "exit-only mode" the book is not in. | **PARTIAL.** The facts hold (repro: SELL refused, the stamped control executes). The build follows the prompt's letter ("refused … and no trade"). The mechanism and the false alert already exist for a missing vintage on `main`; the trigger is new. It bites only a book pinned to a pre-T0a vintage: 0 at the census, but founder creation stays on until this merges. | **Founder question Q1.** Today's behaviour is pinned by a test (`mandate-evaluate.test.js`, "AS BUILT"). If exit-only is ruled, the eval and harvest refusals narrow to entries; the gate's `malformed_cap` already refuses entries. |
| A-2 | should-fix (latent) | `isSectorCapCorrected` requires exact equality, so a future version bump would refuse every book pinned at version 1. | **PARTIAL.** Real but latent. The suggested fix (accept any stamp) is unsafe: after a rollback, old code would accept a stamp it does not understand. Narrowest correct rule: an explicit list of understood versions at eval and harvest, equality where a vintage is pinned. Identical to today's behaviour while only version 1 exists. | No code change. The constant's comment now states the rule for whoever bumps it (`mandateSectorCap.js:31–38`). |
| A-3 = B-6 | note | The creation, escape and rollover refusals cannot fire without an out-of-band write: they read back the document at the content address of a freshly built, stamped payload, and only `publishVintage` writes there. | CONFIRMED | Kept as defence in depth. The live risk, a book already pinned to an old address, is covered by the eval, sweep and harvest rows. |
| A-4 | note | `vintage_uncorrected` maps to HTTP 400 in the create and escape endpoints, a client error, though the cause is server-side. | CONFIRMED (unreachable, per A-3) | Reported, §6. |
| A-5 | note | Same as the missing-vintage path: the refusal runs before the open-batch age-out; a batch in flight across the deploy can count one failure twice; billing happens once. | CONFIRMED, identical to `no_vintage` on `main` | Reported only. |
| A-6 | note | Rollover sets `err.code` and the cron logs only the message. | PARTIAL: the message carries `vintage_uncorrected` | No change. |
| A-7 | note | The prompt's `sectorCapText` re-implements `isValidSectorCapFraction`, because importing it would mean classifying `mandateSectorCap.js` in the prompt registry. | CONFIRMED, equivalent today | Reported only. |
| B-1 | should-fix | The README row for this report points at a file missing at `b64abfc8`. | **REFUTED** as a defect of the PR: this report's commit adds the file and both commits are pushed together. No check reads intermediate commits. | No change. |
| B-2 | should-fix | The Astra V5 row says T0a implements B5, but B5 also asks for an inventory at deployment. | **PARTIAL.** The census is recorded, but a build-time count is not B5's deploy-time inventory. | Fixed: the row now says what the build does. §1 names the collections, the time and the method, and says the count is not the deployment inventory. |
| B-4 | note | The units file's header said every row fails pre-fix; 33 behaviour rows pass against `main`'s code. | CONFIRMED (64 pass, 65 fail on base) | Fixed: the header lists which rows discriminate and which are controls. |
| B-5 | note | The boundary comment implied an exact limit; in floating point the 1/3 and 2/3 at-limit rows pass through the 1e-9 tolerance. | CONFIRMED (+5.6e-17, +1.1e-16) | Fixed: the comment says so; the one-cent rows stay sharp. |
| B-7 | note | The rollover row's title claims the cron counter; the batch row's title claims "no model call", which batch never makes. | (i) PARTIAL (true by composition), (ii) CONFIRMED | Both titles fixed. |
| B-8 | note | (i) The four stamped fixtures (0.30 plus a stamp) are an impossible shape. (ii) No test ran a real vintage through the eval. (iii) No test proved the builder throws on a malformed count; a catch-and-fall-back builder would pass. | All CONFIRMED | (i) Reported only (nothing reads the missing fields). (ii) Fixed: a real Diversifier vintage gates a BUY past a third of the book by `sector_cap`, and a smaller BUY executes. (iii) Fixed: `mandateVintage.malformedCap.test.js` (mocked registry; seven bad counts throw; two controls). |
| B-9 | note | The local denominator's comment cited a retired import rule; the test called its `src` import a §4 guard. | PARTIAL: the local constant is a legitimate choice | Both comments fixed. |
| B-10 | note | The V6.1 row says adopted while V6.1's own status line says the rulings await approval. | CONFIRMED (an inconsistency in the sources) | The row keeps the prompt's wording and adds a status-as-written note. Shared contract V2 records the approval. |
| B-11 | note | The addendum's Destination line names a different path. | CONFIRMED | README row note; §6. |
| B-12 | note | The four pointer lines shift by one every line anchor that other documents cite into those files. | CONFIRMED: 44 anchors (25 in documents this branch adds, 19 already in `docs/`; none in code) | Reported, §6. The placement is the prompt's instruction. |
| — | note | A test title rendered "n of 6 → NaN/6". | CONFIRMED | Fixed. |

**Mutation re-check after the fixes.** On a fresh snapshot of `985944d0`, over the 12 Mandate files that now carry the rows (275 tests; control green), the 23 mutants of §3 plus M24 (the builder catches a malformed count and falls back to "no cap", B-8 iii): **24 of 24 killed**. The original bug (M01) now turns 65 rows red, including the real-vintage eval row.

### Founder questions

1. **Exit-only, or a full stop, for a book pinned to a vintage without the stamp?** As built: a full stop. Such a book is refused at every check, exits included, matching the prompt's "no trade". The alternative, which Spec 1 §3.4's exit rule points to, is exit-only: entries refused (the gate already does this), exits allowed. No such book existed at the census.
2. **A fresh counts-only census just before merge** would be B5's inventory at deployment, since founder creation stays on until then. A book created by the current code would carry an unstamped vintage and be refused after the merge (see Q1).

## 6. Found outside the task (reported, not fixed)

1. **The prompt's Astra anchor.** It said "Astra's V6 review C6-05 / B5". In the V6 review, C6-05 is about source provenance; the sector-cap finding and its tests are the **V5** review's C5-05 and B5, which this build followed.
2. **The attachment set.** The prompt's table listed eight files, but the two Astra reviews were not attached at first; the founder supplied them during the session, together with the V5.1 second pass (§4).
3. **The addendum's own Destination line** names `docs/AGENT_LEARNING_CHARTER_V1_SCOPE_ADDENDUM_A.md`. The file is committed at the prompt's dated path, and its text is untouched (byte identity).
4. **Line anchors shifted by the pointers.** 44 anchors in `docs/` cite line numbers in the Charter (32), Spec 1 (7), the acceptance report (4) and the runbook (1). All are now one line off. 25 sit in documents this branch adds; for example, Astra's V6 review cites `MANDATE_ACCEPTANCE_REPORT_V1.md:3`, which now holds a blank line.
5. **The missing-vintage path's alert and agency state.** On `main`, a book whose vintage is missing is quarantined after five failures with an alert announcing "exit-only mode", and its daily rows record `agencyState: 'exit_only'`. Neither is true for a book that cannot evaluate at all (`api/cron/mandate-evaluate.js:455–456`, `api/_utils/mandateClosePass.js:109`). T0a's refusal inherits both (A-1).
6. **An absent count reads as "no cap".** The registry turns a missing `sectorConcentrationCap` key into `null` (`api/_utils/archetypeRegistry.js:148`), so removing a count from the fenced table would yield a stamped "no sector cap" vintage rather than an error. Today all six counts are present, and the units file pins each one, so such a removal turns a test red.
7. **HTTP status for `vintage_uncorrected`** is 400 in `api/mandate/create.js:93` and by default in `api/mandate/escape.js`; a server-side cause would better be 409 or 500. Unreachable today (A-3/A-4).
8. **Windows-only test failures.** 10 rows in four Mandate structural tests (`mandateModelCall.imports`, `mandateUniverseSnapshot.imports`, `mandateMoneyRounding.scan`, `mandateNativeEsm.smoke`) fail on Windows on untouched `main`. The cause is the closure walker's `path.relative` returning `api\…` paths, and `import()` refusing a bare `C:` path. All pass on Linux.
