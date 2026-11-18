# Review — setup frequency count (BUILD_RULES §2)

**Date:** 17–18 Nov 2026 · **Reviewed:** branch `claude/setup-frequency-count` at `6631fd5c` (8 files, 1,519 lines against `main`, past the 1,500-line threshold) · **Report:** `docs/audits/20261117_SETUP_FREQUENCY_COUNT.md` · **Prompt:** the setup-frequency experiment prompt V1.1, 17 Nov 2026.

## In plain terms

The count's scripts and report were checked by three independent reviewers, each looking for a different kind of mistake. Every mistake they raised was then handed to a second reviewer told to prove it wrong. Nothing they found changes a headline number. Two sentences were wrong and three battle rows were read one session early; those are fixed. Two places where the work went beyond the prompt's letter are now questions for the founder.

| Item | Verdict |
|---|---|
| Lenses | 3: replay fidelity (L1), counts and report numbers (L2), read-only safety, privacy, cap and rules (L3) |
| Refuters | 3, one per lens, each told to refute every finding with a reproduction |
| Findings | 24: **13 confirmed, 10 partly confirmed, 1 refuted** |
| High after refutation | 3: SF-L1-1 (= reading R-2), SF-L3-2 (= reading R-1), SF-L2-2 (a false verdict-table row, fixed) |
| Numbers moved | No headline number. Three battle rows re-read at their creation session; the battle shares below 3 moved by 2.5–3.3 points (SF-L2-3) |
| Independent confirmations | The replay matches the store on all 456 records, re-derived three ways (L1). Every number in the report was re-derived from scratch, except those the findings name (L2). The bench inversion was checked against a forward simulation: 40 of 40 (L2). The cap held and the request log is consistent: 241 of 241 (L3). No id or player text appears in any output (L3) |
| Mutation check | No test was added. The one test edit is two allowlist lines, and the control is below: the guard fails without them, on exactly those two files |
| `vite build` | Exit 0 on the final head (the PR's checks section) |

## Method

- **Isolation (the Sep 2 ruling).** Each reviewer and refuter had its own `git archive` extraction of `6631fd5c` and its own copy of the run data, all under the session scratchpad, with `node_modules` linked. All were read-only on git and on the working tree. None ran the production export or the provider fetch; L3 and R3 tested those paths with fakes only. Mutating checks (planted records, planted write forms, a fake provider) ran in each reviewer's own copy.
- **Refutation.** Each refuter received its lens's findings as claims with their evidence, and the instruction to refute each one with a reproduction, to correct its severity, and to name the minimal fix.

## Findings and dispositions

Severity is the refuter's.

| Id | Claim (short) | Refuter | Severity | Disposition |
|---|---|---|---|---|
| SF-L1-1 | The first replay (at `fe15255a`) called `acquireOnce`, against rule 5; the report called it "a cross-check" | CONFIRMED | high | **Disclosed as reading R-2** (report Preamble and §1). That replay always injected a local slice provider (`storeReplay.mjs:40` at `fe15255a`), so it made no provider request and read or wrote no store |
| SF-L3-1 | Same as L1-1, plus: it may have made uncounted provider requests | PARTLY (the add-on REFUTED: the injection was unconditional) | high, as L1-1 | As L1-1 |
| SF-L1-2 | The 28,920 cross-check rests on a file no script at HEAD writes, and is silently omitted when that file is absent | PARTLY | low | `analyze.mjs` records `chainCheck.skipped` when the file is absent; report §9 names the producer (`replay.mjs` and `storeReplay.mjs` at `fe15255a`) |
| SF-L1-3 | The stored-records tables take every export record unfiltered; a duplicate would overwrite | CONFIRMED (latent; shown with a planted record) | low | `analyze.mjs` keeps only in-window records under the current rule set with contemporaneous bars, counts the rest apart, and stops on a duplicate. On this data 0 are set apart |
| SF-L1-4 | "Only the provider is replaced" understates the substitutions | CONFIRMED (wording) | low | Report §1 and the `storeReplay.mjs` header list them: the clock, the bars class, two unexported steps, the pre-gates |
| SF-L1-5 | The stored extension limit differs from the replay's on 66 records | REFUTED as a defect (the numbers are right; the cause, ATR and SMA drift, was already disclosed) | info | One clause added in §1: at most 0.006%, and no next-open result changes |
| SF-L2-1 | The Fundamental Investor "would have 0 names on every morning" | CONFIRMED | medium | It is 0 on 101 of 120 mornings and 1 on 19 (MU or NEM). Fixed in the bullets, §4 and §8 |
| SF-L2-2 | The verdict row "below seven … for every overlaid archetype" is false for the Diversifier | CONFIRMED | high | Row rewritten: the four name filters, plus the Diversifier's 69% |
| SF-L2-3 | Battles 023, 067 and 144 were read one session early | CONFIRMED | medium | The list is now read at `lastCompletedSessionAt(createdAt)`, the store's own activation-to-session rule. Those three were created after the close for that evening (before the 25 Oct change) and never traded. The rows and battle shares are updated. This reverses a pre-review change that read every list at the session before its first trading day; the refuter showed that rule is wrong in both directions |
| SF-L2-4 | The SPY-regime split omits Max, the separate breakout and pullback rows, and the class tallies | CONFIRMED | medium | `analyze.mjs` adds `both` and `classMedians` per regime; report §2 has both tables |
| SF-L2-5 | A reconstructed SPY column sits in a contemporaneous table, and the 16 Nov next-open check used run-day opens | PARTLY | low | Column labelled "SPY (reconstructed)". The 16 Nov check now uses the 17 Nov records' own stored opens: 14 of 14, contemporaneous end to end |
| SF-L2-6 | Pooling 1,250 of 24,970 hides per-capture rates | PARTLY (the count is right) | low | Per-capture rates added (9.5% / 0.5%), with capture ages |
| SF-L2-7 | The stored Uptrend column is a count, while §2 gives a share | CONFIRMED | low | "87 (38.2%)", "70 (30.7%)" |
| SF-L2-8 | "As many as in its uptrend": 20 against 21 | CONFIRMED | low | "about as many as in its uptrend (21)" |
| SF-L2-9 | "Today's scores" is put on overlays that use no scores; "a split inside the window" | PARTLY (the second half REFUTED: that is the code's own wording, and the cell said 55-bar window) | low | The label is limited to the Speculator, Fundamental Investor and Capital Preserver in the bullets, §4 and §6. The refused row names the 55-bar window, the spin-off and BKNG's April event |
| SF-L2-10 | Equipped lists silently drop a name with no replay | PARTLY | low | Every name now counts; one with no replay is not valid. 0 such names here |
| SF-L3-2 | The `exportProduction.mjs` guard listing is outside rule 2's wording (it reads the collection; it imports no store module directly); the Preamble said "imports none" | CONFIRMED | high (mitigated) | **Reading R-1 for the founder.** The Preamble wording is corrected: its one store import, `lastCompletedSessionAt`, comes through `storeReplay.mjs`'s re-export, which the guard does not see. Building to the letter would drop the listing and leave the guard red until a ruling. Moving the read into the already-listed `storeReplay.mjs` would be a whole-file exemption by the back door, so it was not done |
| SF-L3-3 | "The handle exists only inside main()" is false process-wide | PARTLY | low | Header reworded (`exportProduction.mjs:4–10`): one Admin app per process, write functions in loaded modules (`marketDataCache.js`), none called here |
| SF-L3-4 | The write-verb grep is lexical and folder-local; 16 forms evade it | PARTLY, with a correction: imported modules do load the provider module and the Admin SDK, though no call reaches them | low | Header and report §6 state the grep's scope and that the restricted reader is the structural guard |
| SF-L3-5 | A non-array payload is saved, so it is never retried | CONFIRMED | low | `fetchBars.mjs` writes a series only when it is an array. Tested with a fake provider: no file, retried and counted on the next run |
| SF-L3-6 | The cap has no lock: two runs on one folder overwrite each other's counter | CONFIRMED | low | Exclusive lock file per run folder. Tested: a second concurrent run is refused, and the lock is released at the end |
| SF-L3-7 | The privacy scan's reach is overstated (snapshot ids, short ids, 28-character shape only, `sweepState` copied whole) | PARTLY (no exposure: every skipped id is a system key) | low | Header and Preamble state the scan's reach exactly |
| SF-L3-8 | "One batched getAll": there are two per export | CONFIRMED (that line only; the rule-4 sub-claim is weak) | low | Report wording fixed |
| SF-L3-9 | Market hours are checked once, not per request | CONFIRMED | low | Checked before every request; the run stops admitting if a session opens |

## Readings for the founder

- **R-1 (rule 2).** `exportProduction.mjs` is listed in the store's import guard because it reads the `setupEvidence` collection by name. The exception's wording covers a script that *imports* a store module. Keep the listing, or rule it a STOP?
- **R-2 (rule 5).** The first replay called `acquireOnce` with an injected local provider. It touched no store and made no request, and its results are identical to the replay of record on all 28,920 symbol-sessions. Accept as disclosed, or rule it a STOP?

## The refuters' independent re-derivations (kept in the session scratchpad)

- **R1:** recomputed the 456 records from their own stored bars through the pure chain, all fields equal; planted a second-rule-set record; diffed every compact field of the two replays (0 differences).
- **R2:** re-read the three battles under both session rules with `analyze.mjs`'s own functions; re-checked the overlays and the regime medians.
- **R3:** ran the guard line by line; raced two fake-provider fetches on one folder; tested the market-hours boundaries to the millisecond in EST and EDT.
