# KB-1 — the BUILD_RULES §2 review record

**Build:** KB-1, Shared Research uses and records the KB method (`docs/audits/20261114_BUILD_KB1_SHARED_RESEARCH_METHOD.md`) · **Reviewed head:** `11e080a7` (branch `claude/shared-research-kb1`, base `main` `c85f7b41`; 15 files, +1,898 / −76 — over the §2 threshold) · **Date:** 2026-11-13/14 · **By:** Claude Code (Opus 5.5), with subagent reviewers and refuters

## 1. How it ran

- **Five independent lenses**, each a subagent on its own `git archive` extraction of the reviewed head (under the session scratchpad, `node_modules` junctioned; read-only on git and on the working tree — BUILD_RULES §2 reviewer isolation): (1) the method's selection, per-turn re-check and audience; (2) the records — stamp, exchanges, retention, adoption, shadow log; (3) the dark guarantee and baseline byte-identity; (4) the three checks' false positives; (5) test integrity (the mutating lens, on its own tree).
- Each lens was given the code, the diff, the build prompt and the spec — and the builder's interpretive choices as points to challenge, not as conclusions.
- **Every finding went to a refuter**: one refuter per lens, on a fresh extraction of its own, told to refute each finding with a concrete repro or a precise reading. The verdicts below are the refuters'.
- Fixes were made in the working tree after the verdicts and re-tested; the fixed tree went through the final checks (the build report §5) and the mutation battery (§6 there).

## 2. The split

| Lens | Findings | CONFIRMED | PARTLY | REFUTED | Fixed in code or rows | Left as a note or a founder question |
|---|---|---|---|---|---|---|
| 1 Selection, re-check, audience (SEL) | 7 | 2 | 3 | 2 | 2 (SEL-4, SEL-7) | 3 (SEL-1, SEL-3, SEL-5 → FQ-2, FQ-3, FQ-1) |
| 2 The records (REC) | 8 | 3 | 3 | 2 | 4 (REC-1 rows and wording, REC-2 rows and wording, REC-4, REC-5) | REC-1, REC-2, REC-3 → FQ-6, FQ-5, FQ-2; REC-8 a note |
| 3 Dark and byte-identity (DARK) | 5 | 3 | 2 | 0 | 1 (DARK-4, with REC-2) | none is a defect; DARK-2, DARK-3 recorded |
| 4 The three checks (CHK) | 16 | 12 | 3 | 1 | 8 (CHK-1 to CHK-5, CHK-6's numerals, CHK-11's "30%", CHK-12's exemption) | CHK-7 to CHK-10, CHK-13, CHK-14, CHK-16 → FQ-1, FQ-7 to FQ-10 |
| 5 Test integrity (TST) | 18 | 15 | 3 (one sub-point refuted) | 0 | 14 (every surviving mutant now has a killing row) | TST-2 (B1, FQ-5), TST-14, TST-15, TST-16 notes |

Severity before refutation: 3 must-fix (CHK-1, TST-1, TST-3); after refutation, no must-fix survived unfixed. Every CONFIRMED or PARTLY finding with a remedy inside the build prompt's letter is fixed; every one whose remedy needs a reading beyond the letter is a founder question (§4) and its row pins the letter, so a ruling moves that row.

## 3. Every finding, its verdict and its disposition

### Lens 1 — selection, the per-turn re-check, the audience

| # | Finding (the reviewer's) | Refuter | Disposition |
|---|---|---|---|
| SEL-1 | A KB-stamped session whose FIRST partner turn falls back to the baseline (a retried framing after a revocation; an own-words session opened after a failed framing) records the refusal nowhere — no `methodChange` (no previous partner turn), no `fallbackReason` (the stamp is never rewritten), no log field | PARTLY — the build follows the letter (Part 3: `methodChange` only against the previous partner turn; Part 2: the stamp never rewritten; Part 3's four log fields); the change itself is not silent (the exchange's `method` differs from the stamp); only the reason is lost. Reachable after activation only through a retry across a deploy | **Founder question FQ-2.** A fix comparing the first turn against the stamp was built, then reverted to the letter on the verdict; `session.kb1.test.js` and the route row pin the letter |
| SEL-2 | An own-words session opened with no frame exchange cites `baseline@v0` | REFUTED — the prompt governs ("the method its frame exchange ran on"); with no frame the next action is B1's own baseline line | none |
| SEL-3 | `effectiveMethodFor` accepts an ok answer without comparing its id, version and sha256 to the stamp | PARTLY — id/version refuted (the loader's check 3 pins them); other bytes under the same version need a deliberate re-commit plus a matching entry, and are recorded (the exchange's hash differs; `methodChange` compares hashes). The letter: "ok → that method" | **Founder question FQ-3.** A refusal on mismatch was built, then reverted to the letter; a row pins it |
| SEL-4 | `exchangeMethodOf` read any non-KB exchange as the CURRENT baseline, discarding a recorded hash | CONFIRMED (latent; wider: a version bump too) — within the letter | **Fixed**: a whole recorded method is read as recorded; the baseline only when absent or not whole (`session.js` `exchangeMethodOf`); row + mutant X13 |
| SEL-5 | A KB frame turn runs none of the three checks; its `check` becomes the opening next action's fact | PARTLY — the letter scopes the checks to steps ("fails the step"; §A4.6 "a step that trips one"); the strongest finding | **Founder question FQ-1** |
| SEL-6 | `selectMethod` runs on every frame request, retries included | REFUTED — Part 2 requires the selection before `beginFraming`; it is pure and discarded for a prior session | none |
| SEL-7 | `selectMethod(null)`, `effectiveMethodFor(null)`, `citedSourceOf(null)` threw | CONFIRMED (unreachable from the route) | **Fixed**: each reads its request inside the try; rows for null, numbers, strings, a hostile proxy; mutant X14 |

### Lens 2 — the records

| # | Finding | Refuter | Disposition |
|---|---|---|---|
| REC-1 | The retained title/highlights are the strings before the prompt's rendering (whitespace collapsed, tickers outside the universe masked), so "as shown" is not literal; row 5's "the text retained is the text the prompt rendered" could not fail | PARTLY — the code follows a declared reading (R1): a rendered (masked) string breaks B1's 300/600 bounds and the size pin (a 300-character title can render to 3,399); the comments overclaimed and row 5 pinned neither reading | **Fixed** the overclaims (the test comment; the report says "as given to the prompt"); row 5 now holds a title with a stray ticker, a double space and a newline, retained raw while the prompt shows it masked. **Founder question FQ-6** on R1 itself |
| REC-2 | The 400 KB worst case kept urls ASCII; a raw non-ASCII url path is accepted (3 bytes a unit): 468,651 B. Plus failed direction steps | PARTLY (part 1) — the true byte worst case, a 3-byte path behind a short host, is about 480 KB; the 3-byte row's wording overclaimed. Part 2 REFUTED as KB-1's (B1's `beginStep`/`failStep`, untouched) | **Fixed** the rows and wording: ASCII 197,111 B and 3-byte text with ASCII urls 392,551 B, both under 400,000; the byte worst case (3-byte text and url path, short host) pinned over 400 KB and under 1 MiB. **Founder question FQ-5** (the pin's unit). Part 2 → found outside the task (build report §8) |
| REC-3 | = SEL-1 | PARTLY — a gap in the letter, not a defect; "reads like an upgrade" refuted | FQ-2 |
| REC-4 | `methodsUsed`'s "first-seen order" followed the kept findings (the player's symbol order), not the turns | CONFIRMED (note; the letter reads more naturally as turn order) | **Fixed**: first seen walking the partner turns in order; rows; mutant X19 |
| REC-5 | = SEL-4 | CONFIRMED | Fixed (SEL-4) |
| REC-6 | The retained `publishedDate` nulls a provider date later than the read | REFUTED — spec §16 FQ-2 (a founder ruling) treats such a date as absent; keeping it would contradict what the partner was shown | none. (A switch to the provider's value was built and reverted on the verdict; row 5 pins null) |
| REC-7 | Two items with one url both list every finding citing that url | REFUTED as a defect — the letter defines `findingIds` by url, and a finding records no item index | none |
| REC-8 | The session document grows and is read whole by several paths | CONFIRMED as a cost note (partly overstated); by design ("No new store") | note |

### Lens 3 — the dark guarantee and baseline byte-identity

The lens found **no must-fix or should-fix**: all 310 baseline prompt comparisons (14 partner names × 12 method shapes × step and frame) equal `main`'s, computed from `main`'s own source; 133 baseline validator calls identical to `main`'s, finding-id order included; 173 route answers with key sets identical to `main`'s; every JS, CSS and HTML output of `vite build` byte-identical.

| # | Note | Refuter | Disposition |
|---|---|---|---|
| DARK-1 | `methodBlockOf` picks the KB wrapper on `source === 'kb'` alone (a malformed method prints "undefined") | PARTLY — not a defect: the builders take the effective method, which is BASELINE or a whitelisted, checked KB method; a baseline fallback would make the prompt disagree with the exchange | none |
| DARK-2 | The new fields sit in the owner-readable session document | CONFIRMED as fact; not a defect — §A4.4: "owner-readable and server-written, as today" | recorded (build report §8: the provider's titles and highlights are now readable to their owner through the client SDK) |
| DARK-3 | Two `src/` TESTS and `scripts/sharedResearch/probe.mjs` now reach the loader transitively (through `stepSchema.js` → `method.js`) | CONFIRMED; not a defect — Rule 5 governs use and calls; no production `src/` file reaches it (the PERMANENT row) | recorded |
| DARK-4 | The size pin's urls are ASCII | CONFIRMED and understated (481,101 B with a 4-character host; an IDN host's punycode can exceed 253 — invalid DNS — up to 631,111 B; all under 1 MiB) | Fixed with REC-2; FQ-5 |
| DARK-5 | `methodsUsed` is always written, by a spread | PARTLY — `exchangeOf` would write `[]` too; the spread keeps the pre-minted exchangeId | none |

### Lens 4 — the three checks' false positives and negatives

| # | Finding | Refuter | Disposition |
|---|---|---|---|
| CHK-1 | A partner named "Will" (also "Test", "Track", "Monitor", "Going", "Be") switched the promise check off: B1's `withPartnerToken` swaps the name into the sentence case-insensitively first | CONFIRMED (a) — must-fix before any authorization | **Fixed**: the name, read like the text, is one more subject matched whole-word in place (`promiseReOf`); B1's `forbiddenIn` has the same root and is untouched (Rule 4) → found outside the task; rows; mutant X15 |
| CHK-2 | The name was not read like the text (curly apostrophe, NFD, fullwidth, zero-width) | CONFIRMED (a) | **Fixed** with CHK-1; rows |
| CHK-3 | The worked example's sentence split broke at "U.S.", "p.m.", "vs.", "Inc.", "approx." | CONFIRMED (a) | **Fixed**: a sentence ends at . ! ? before a capital, digit or quote, never at an abbreviation; rows; mutant X16 |
| CHK-4 | A group "(M1, V1, and T2)", "(T1–T6)", "(T1-T3)", "(M1 or V1)" passed | CONFIRMED (a) | **Fixed** (", and", dashes, "or", "to"); rows; mutant X17 |
| CHK-5 | Words between "will" and the verb ("be closely", "continue", "start to", "keep on", ", of course,", "both") let a promise pass | PARTLY — the seven filler rows (a); "your investment idea" (b, the letter says "your idea"); prime/reversed apostrophes (c) | **Fixed** the (a) rows; mutant X18. The others pinned as the letter |
| CHK-6 | Subjects beyond the letter fail ("research partner", "our partner"); "I" numerals beyond the list | CONFIRMED (c) — B1's partner words follow the founder's ruling (spec §17 FQ-9) | the numeral list extended ("Phase-I", "Fund I", "Basel I" …); the partner words kept (a narrowing was built, then reverted on the verdict); rows pin both |
| CHK-7 | The worked-example check fires on the player's own observation (own words is the only KB consumer): a reply restating it, a next action "Find a dated source for NVDA's October 30 move", an honest negative | CONFIRMED (b) | **Founder question FQ-7** |
| CHK-8 | The promise needs no object: "Next I will test whether…", quoted management "we will monitor pricing" | CONFIRMED (c) | **Founder question FQ-8** |
| CHK-9 | The service names match in any case ("a practice field"); joined or hyphenated forms and "the Forge" pass | PARTLY (b)/(c) | the letter kept (a case-sensitive narrowing was built, then reverted); rows pin both ways; **FQ-9** |
| CHK-10 | Citation collateral ("Narrow money supply (M1)", "from M1 Macs") and misses ("(cf. M1)", "According to M1", verbatim method sentences) | CONFIRMED (b)/(c) | **Founder question FQ-10** |
| CHK-11 | The date ignores the year; "2026-10-30", "30 October" pass; "October 30%" failed | CONFIRMED (b)/(c) | "30%" and "30-day" no longer read as the date; the rest → FQ-10 |
| CHK-12 | The exemption's breadth; the pass row depended on `symbolCandidate` | PARTLY (c) | the company's own name ("Nvidia") counts on the exemption side only (reading R9); mutants X22–X24 prove the exemption's three conditions; the refusal side's "Nvidia" → FQ-10 |
| CHK-13 | = SEL-5 | CONFIRMED (c) | FQ-1 |
| CHK-14 | `method_as_source` is findings-only (a summary resting on a kb-sourced marker passes) | CONFIRMED (c) — the prompt narrows the spec to findings, and governs; the "compares id, not kind" point REFUTED | note |
| CHK-15 | A next action discarded by NS-1 and unsupported claims are not checked | REFUTED — never built, stored or shown | none |
| CHK-16 | A partner's name colliding with a company's ("Company", "Apple") | CONFIRMED (b) — B1 has the same collision | note (FQ-8) |

### Lens 5 — test integrity

The lens confirmed the committed baseline fixture is `main`'s own output (all six prompts rebuilt from `main` `c85f7b41`'s source, byte-equal), and that `boundary.test.js` outside the one moved hunk, all PERMANENT rows included, is byte-identical to `main`. Its findings are mutants that survived; the refuter re-applied each in its own snapshot (controls: a no-op run passed, a certain kill failed; the snapshot's 1,642-file hash manifest unchanged afterwards).

| # | Finding (a mutant that survived) | Refuter | Disposition (row added; the mutant in the build's battery) |
|---|---|---|---|
| TST-1 | The 400 KB worst case kept urls ASCII (468,651 B with 3-byte url paths) | CONFIRMED, must-fix | Rows made honest and the byte worst case pinned under 1 MiB (with REC-2); the threshold's unit → **FQ-5** |
| TST-2 | Failed direction steps add exchanges beyond the 10-step case (up to 30 calls a day, every day: no session expiry) | PARTLY — B1's behaviour; Part 4 defines the case as "10 steps" | Found outside the task (build report §8); FQ-5 |
| TST-3 | The example exemption with its date condition dropped | CONFIRMED, must-fix | Row; X22 |
| TST-4 | Its name condition dropped; name+date tested over the whole text; `!isUndated` dropped | CONFIRMED (all three) | Rows; X23, X24, and the two-sentence pass row |
| TST-5 | The promise checked in the reply only | CONFIRMED | Rows (summary, a fact, the next action); X25 |
| TST-6 | A refusal on an unchanged method writes a `methodChange` | CONFIRMED | Row; X26 |
| TST-7 | `methodsUsed` over every record finding, or the stamp's method | CONFIRMED | Route row: a KB step, a revoked baseline step, adopting the baseline step's company → `[baseline]` while the stamp is KB; X27 |
| TST-8 | The method dropped from the failure call records (frame model failure, frame persist_failed, the step's `failed()`, prompt_too_large) | CONFIRMED (all four sites) | Rows for all four; X28, X32, X33, X34 |
| TST-9 | The route sending a baseline prompt one space longer | CONFIRMED, raised to must-fix (Rule 4) | Route rows compare the prompts the route SENDS with `main`'s fixture, byte for byte; X29 |
| TST-10 | A step or close answer gaining a method field | CONFIRMED (the close half must-fix; close is exercised in B1's route test, its keys were not pinned) | Every answer's keys pinned to `main`'s (frame, open, step, replay, failed step, list, close, adopt, GET); X30 |
| TST-11 | The route importing a Practice Field module | CONFIRMED | The route file added to the scan's roots; X31 |
| TST-12 | A test importing the real loader through `vi.importActual` / `vi.importMock` | CONFIRMED | The moved row refuses them; planted rows |
| TST-13 | `method.js` re-exporting an entry point, another module calling it | CONFIRMED | The moved row enforces Rule 5's "one file": no other production file names an entry point; `method.js` hands none on; planted rows; X11/X12 |
| TST-14 | `new URL('../kb/…')`, `import.meta.glob('../kb/*')` in a Shared Research module escape the `_utils/kb` text belt | CONFIRMED, note — inherited from KB-0's belt | note (a KB-0 row; not moved) |
| TST-15 | A mock factory could expose `real.verifyPackage` | CONFIRMED, note | note |
| TST-16 | Retaining the pre-fit items survives | CONFIRMED, note — equivalent today (the soft cap never drops an item: worst 10,191 tokens < 12,000) | note |
| TST-17 | Row 5's `not.toContain('"undefined"')` cannot catch an undefined field | PARTLY — a string 'undefined' is caught; an undefined value is not | Row 5 now walks the session for undefined values |
| TST-18 | The version check; `not.toBe('passes')`; `toThrow()`; the newSessions:false skip; the exact size pin; the markers comment | Mixed — the version check REFUTED (a reversed kept order is killed by B1's route row); the rest notes | Fixed: each baseline contrast row names its rule; the exact pin removed (the +10% bound is the pin); the comment corrected |

## 4. Founder questions raised by the review

These appear in the build report §4 too; none blocks this PR — the list is empty, so no KB turn runs until the activation PR, and each can be ruled before it.

| FQ | Question | Built (the letter) |
|---|---|---|
| FQ-1 | Should a KB **frame** turn run the citation and service-promise checks on its question, check and not-established texts (its `check` becomes the opening next action's fact)? | No: the checks run on step turns |
| FQ-2 | Should a KB stamp whose **first** partner turn falls back record the reason — e.g. a `methodChange` against the stamp? | No: `methodChange` only against a previous partner turn |
| FQ-3 | Should an ok answer whose bytes differ from the stamp's hash be refused? | No: "ok → that method"; recorded by hash |
| FQ-4 | Confirm the build's readings R1–R16 (build report §4) | As listed there |
| FQ-5 | Is the 400 KB pin in characters or UTF-8 bytes? The byte worst case (3-byte text and url path) is about 480 KB, under 1 MiB | Pinned: the length-max case and the 3-byte-text case under 400,000 bytes; the byte worst case under 1 MiB |
| FQ-6 | "As shown": the item's text before rendering (built), or the masked rendering? | Before rendering |
| FQ-7 | Exempt the worked-example check when the player's own words name NVDA and October 30? | No exemption |
| FQ-8 | Should the promise need "it"/the idea as its object (research narration "Next I will test whether…" and quoted management fail today)? | Any object |
| FQ-9 | The service names: any case (built, the letter), or only as names; add "the Forge" (§A4.6's own list)? | Any case; the prompt's three |
| FQ-10 | The citation and date forms beyond the letter's ("(cf. M1)", "2026-10-30"), a year condition, "Nvidia" on the refusal side | The letter's forms |
