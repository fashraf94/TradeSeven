# Build B2 — the agent drafts and checks the idea book (T1b + T1d, launch scope)

**Date:** 23 Nov 2026 · **Branch:** `claude/practice-field-b2-agent` · **Final commit:** `df782278` (code frozen at `f9478053`; the two commits after it are a test allowlist's counts and one test row) · **Base:** `main` `e505f3bb` · **PR:** the draft PR opened from this branch (this report is its last commit; every check below ran on `df782278`, the commit before it)

**State:** built, reviewed (three lenses, every finding refuted or confirmed), battery run, final checks green. **Both new switches ship off.** Not merged; CI not watched.

| Rule | Held |
|---|---|
| No real model, Firestore or EODHD call | Yes: a fake transport and the in-memory harness throughout. One outside read: Anthropic's pricing page (B2-5). No `.env` file or credential read. |
| No fenced file edited (BUILD_RULES §1); no edit to the quarterly Mandate's modules | Yes. No fenced function is called. The shared cron's 21-line hook is R-1 / Q-1. |
| `PRACTICE_FIELD_MODE` stays `'allowlist'`; the two sub-switches ship off | Yes: `PRACTICE_FIELD_AGENT_ENABLED = false`, `PRACTICE_FIELD_AGENT_THESES_ENABLED = false`. |
| No rules or index change | Yes: `firestore.rules` and `firestore.indexes.json` untouched. |
| Both switches off: every fire byte-identical to `main` | Yes: 92 traced fires, 0 differ (§4.3). |
| Nothing from the idea book reaches the deployed trading agent's prompts, memory or consolidation | Yes: the import guard walks every deployed agent entry, both ways (§4.2). |
| One draft PR; no merge; no CI watching | Yes. |
| Another user's ids never printed | Yes: the fixtures' ids only. |

## 1. In plain terms

**What it does.** Your idea book now has a team of two that looks at it once a day, after the close:

- **The Shadow desk** runs the medium and long slots. It is your Command Center agent under a fixed brief: research-led, holds a thesis for weeks, judges an idea against its own comparison rather than the day's swing.
- **The archetype desk** runs the short slot, as your book's archetype. It is short-term and technical, and it says plainly that it has no chart evidence yet.

Each desk that has something to do makes **one** call to Claude Sonnet 5.5 and answers through one form:

- **a note on the book** (at most 600 characters);
- **for each of its own ideas: hold, or exit**, with a one-line reason;
- **up to three drafts** for its own empty slots.

**Code still does everything with money.** The agent never names a dollar figure. Code:

- refuses anything outside the rails (names per idea, line distances), a name nobody priced at the close, or a slot that is not the desk's;
- sizes each idea at the most its slot allows under the caps and the 10% cash floor, and admits at most one per empty slot;
- enters it at the next session's first window;
- settles an **exit** the way a due date settles an idea: the idea is valued at the close the agent judged, and the existing settlement sale sells it at the next session's first window. Its result reads "settled early by the manager".

**What it writes.** Each desk's note, its actions and reasons, every draft it considered and why each was or was not admitted, and what each call cost, on that session's close row — the row you can already read. `status` prints it.

**What it costs.** Each call reserves its most possible cost first ($0.1625) and is charged what it actually cost after. On the test prompts a desk's input is 9–12 KB, about 2,650–3,750 tokens. A full month at two calls a session should cost about **$0.70–$1.50** against the $3 bound; if every answer used its whole 6,000-token cap, about **$2.77** (§6).

**What it does not do yet.** No trims or adds, no risk budget, no reports or cards, no Film Room or Forge, no five-window schedule. It reads no game memory, no lessons and no chat.

**What you need to do.** Nothing, to merge: both switches ship **off**, so merging spends nothing and your live book runs exactly as today. To turn it on, follow §7.

## 2. What changed, by file

41 files, +3,863 / −108 against `main` (`e505f3bb`), this report aside. Nine commits: the build (`4bd4234c`), the advisor round (`96c56718`), my own row's fix (`74873fcb`), the Linux censuses (`3099dbca`), the review fixes (`cd99da7c`, `4502037a`), the refuter fix (`f9478053`), and the battery round (`0a4609c9`, `df782278`). **No fenced file was edited** (BUILD_RULES §1), and no fenced function is called: the agent calls the Mandate model seam `callMandateModelDirect` (`api/_utils/mandateModelCall.js`, not fenced), unedited. **No rules or index change.** No edit to the quarterly Mandate's modules (prompt assembly, gate, execution, close, model seam); the shared cron's hook is R-1.

### 2.1 New modules (`api/_utils/practiceField/`)

| File | What it holds |
|---|---|
| `agentConfig.js` | The one model constant `PRACTICE_FIELD_AGENT_MODEL = 'claude-sonnet-5-5'` (:31); the call's ceilings: output 6,000 tokens (:37), input 40,000 bytes + 1,000 tokens = 41,000 reserved (:40–46), timeout 110 s (:55), 2 attempts (:58); note 600 / reason 280 code points (:61–62); the code-built note (:79); the note sources `model` / `code_fallback` / `no_work` (:82); the banned result words (:85); `hold` / `exit` (:88); the two desks and their slots (:94–107); the Shadow desk's fixed brief, version 1 (:117–118). |
| `agentTool.js` | The one tool `submit_book_check` (:34), built per desk (:51; the slot enum is the desk's own slots; no money field); `tool_choice` auto with parallel calls off (:130); `extractAgentToolInput` (:143: refuses a refusal, a cut-off answer, any other block, zero or several tool calls, an unknown tool); `validateAgentAnswer` (:224: unknown fields, unknown / duplicate / missing ideas, the actions, the text bounds, lone surrogates, the banned words, more than 3 drafts, each draft's shape). |
| `agentPrompt.js` | The identity: the archetype's at the epoch's frozen identity version (:54), the Shadow brief (:73); `assembleAgentRequest` (:169): the system text (rails B1–B5, what the desk does not have, no memory, the banned words, the saved theses as untrusted quoted text), the message (book, the desk's open ideas, the other desk's for context, the last 3 notes, candidates, theses), the tool; trims candidates, then theses, then notes to the 40,000-byte ceiling; returns the manifest. |
| `agentSources.js` | The price-list candidates (:58: house universe, priced at this close, not already held; none from a snapshot built without the universe, :61), the last 3 notes (:106), and the saved theses (:183): the owner's 5 most recent carded lists, each checked PF-1 (:120), PF-3 (:133) and PF-2 (:152) and skipped, never repaired, if it fails. `thesisCard` is named once (:43) and read only. |
| `agentDrafting.js` | Drafting (:95): one draft per empty slot at most, admitted through `normalizeIdeaContract` and `admitIdea` at this close's snapshot and one server instant; `close_owed` and `admission_marks_unavailable` leave the slot's attempt unspent (:39); a deterministic opId per draft (:45), so a replay never admits twice. |
| `managerExit.js` | `exitIdeaByManager` (:82): the close the agent judged becomes the idea's endpoint, through the close's own shared step, and the existing settlement sale sells it at the next session's first window with reason `manager_exit`. Ignored for an idea already selling, settling or not yet entered; idempotent on replay. |
| `agentRun.js` | The pass (`runIdeaBookAgentPass`, :485): each active idea book closed on time today, each desk with work (:137), one call: reserve (`reserveSpend`) → call the seam with a timeout (:86) → settle (`settleSpend`) → at most one retry, only for a timeout, network error, 408, 409, 429 or 5xx (:149) → actions → drafting → the desk's part on the close row. Every failure writes the code-built note. A replay never calls twice: what each attempt settled decides. |
| `__testsupport__/agentFixtures.js` | The fake transport and session runner the tests share. |

### 2.2 Changed files

| File:line | Change |
|---|---|
| `src/config/practiceFieldFlags.js:55`, `:64` | `PRACTICE_FIELD_AGENT_ENABLED = false`, `PRACTICE_FIELD_AGENT_THESES_ENABLED = false` (PF-4, PF-5). |
| `src/config/practiceFieldFlags.test.js`, `src/config/flagPinGuard.test.js` | Pins for both; the flags module registered with the flag-pin guard, both flags dark by design. |
| `api/_utils/practiceField/mode.js:61`, `:71`, `:98` | The only readers of the two switches (the theses switch reads off whenever the agent's is off), and the tests' setter. |
| `src/data/practiceFieldSlots.js:14`, `:59` | `PRACTICE_FIELD_SLOTS_VERSION` 1 → 2; origin `market_scan` (B2-4). |
| `api/_utils/modelPriceTable.js:33`, `:47` | Table version 3; `claude-sonnet-5-5` at $2 / $10 per MTok, with its source and date (B2-5). |
| `api/_utils/practiceField/constants.js:145` | `PRACTICE_FIELD_MIN_CALL_MAX_CHARGE_USD` 0.05 → 0.1625, the real maximum (41,000 × $2.50/M + 6,000 × $10/M; the input is reserved at the 5-minute cache-write rate, as spend.js already did). |
| `api/_utils/practiceField/contract.js:133–138` | Optional `desk`, which must be the slot's desk; absent on a founder's idea. |
| `api/_utils/practiceField/admission.js:77–78`, `:468`, `:501` | The fingerprint includes `desk` only when present (a founder's contract fingerprints as before); `previewAdmission`, the read-only sizing probe. |
| `api/_utils/practiceField/settlement.js:59` | `ENDPOINT_KIND.MANAGER_EXIT`. |
| `api/_utils/practiceField/close.js:831`, `:872` | Two steps of the close lifted out unchanged, so the exit shares them: `settleIdeaAtEndpoint` and `readIdeaEvidenceRows` (called at :795 and :1356). The traced fires and the end-to-end dump are unchanged by it. |
| `api/_utils/practiceField/windowLedger.js:139–151`, `:182`, `:249` | T2C-02: a served window row's counts are reconciled with its receipts. |
| `api/_utils/practiceField/sweep.js:127–147`, `:177–216` | The candidate universe is kept on the close snapshot only when the agent is on and a book may draft at this close. |
| `api/cron/mandate-evaluate.js` (21 lines) | The close sweep passes `closeTick` and the idea books to the snapshot inputs, and calls the agent pass after the closes drain, behind `practiceFieldAgentOn()` (R-1). |
| `scripts/practice-field-founder.mjs:397`, `:424`, `:473–479` | `status` prints each desk's note, actions, drafts considered, and the month's spend. |
| `api/_utils/sharedResearch/thesisRecord.census.test.js` | The census admits the one new reader of `thesisCard`, and pins that it writes nothing (R-12). |
| `api/_utils/compositionProtectedStoresAllowlist.json`, `compositionProtectedStores.scan.test.js`, `mandateMoneyRounding.scan.test.js` | The new writes and rounding sites, listed and counted. |
| `endToEnd.test.js`, `admission.test.js`, `ideaBook.test.js`, `spend.test.js`, `modelPriceTable.test.js`, `practiceFieldSlots.test.js` | Pins moved by B2-4 and the new minimum charge only (R-14). |

## 3. Rulings and readings, with questions for the founder

### 3.1 How each ruling landed

| Ruling | As built |
|---|---|
| **PF-3** one check per book per session at the close | One check **per desk** per session (B2-7 replaces "per book"), after the book's close for the session has committed. Code still sells at lines and review dates at every window; the five-window schedule is not built. |
| **PF-4** its own sub-switch, off on merge | `PRACTICE_FIELD_AGENT_ENABLED = false` (and `PRACTICE_FIELD_AGENT_THESES_ENABLED = false`), read only through `mode.js`, registered dark in the flag-pin guard. With it off, nothing is read. |
| **PF-5** sources at launch | The shared price list (the close snapshot's candidates), and the owner's saved theses behind their own switch. No Film Room input. |
| **PF-6** out of scope | No risk budget, trims, adds, reports, cards, nominations or Forge offers. |
| **B2-1** `hold` and `exit` | Both built. `exit` reuses the settlement path whole: the endpoint of the close the agent judged (the close's own shared step), then the existing settlement sale at the next session's first window, reason `manager_exit`. A differential row proves the exit's endpoint, result and packet equal the due-session close's at the same session. |
| **B2-2** one call per book, ≤ 3 drafts, 1 refill attempt per slot | One call per desk (B2-7). At most 3 drafts per call; at most one admitted per empty slot; one refill attempt per slot per session. |
| **B2-3** code sizes and clamps | The tool has no money field. A read-only probe (`previewAdmission`) reads the slot's permitted maximum; `admitIdea` admits at exactly that capital, at the same instant. B3 and B5 are refused by `normalizeIdeaContract`. |
| **B2-4** `market_scan`, slots version 2 | Added. A price-list draft: origin `market_scan`, source ref the close snapshot's key. A saved-thesis draft: origin `research`, source ref the saved list's id. |
| **B2-5** `claude-sonnet-5-5`, official prices | One constant. Rates read 23 Nov 2026 from Anthropic's pricing page, https://platform.claude.com/docs/en/about-claude/pricing (docs.claude.com redirects there): $2 / MTok input, $2.50 5-minute cache write, $10 output. Price table version 2 → 3. |
| **B2-6** notes on the close row | `mandates/{bookId}/windows/{session}_close`, field `agent.desks.{shadow|archetype}`. No rules or index change. |
| **B2-7** two desks | Built as specified; each desk's part sits under its own name on the close row. |

### 3.2 Readings — what I decided where the brief was silent (each stands unless you object)

| # | Reading | Why |
|---|---|---|
| R-1 | **The hook sits in the engine's cron**, `api/cron/mandate-evaluate.js` (21 lines): the close sweep passes `closeTick: true` to its snapshot inputs, and calls the agent pass after the draining closes. Rule 2 says no edit to the quarterly Mandate's modules. I read that as the quarterly product's modules (prompt assembly, gate, execution, close, model seam), not the shared cron that already dispatches each book by kind: T1a-1, T1a-2a and T1a-2b-4 each added their Practice Field hooks there. Every added line is behind `practiceFieldAgentOn()` or passes a value only that path reads. The 92 traced fires are identical to `main` (§4.3). | The agent must run after the close commits and must have the fire's deadline; the sweep is the only caller that has both. |
| R-2 | **Only the on-time close gets a check.** A session closed late by a catch-up gets none: its information is old by the time it is valued. | The brief places the check "at the close window". |
| R-3 | **A paused book, or one winding down, makes no call for either desk** (shared contract V2 §3.2: "Paused stops drafting and model spend"). Each desk writes `source: 'no_work'` with `stoppedBy`. Code still sells and settles. | The contract's own words. |
| R-4 | **The whole answer is refused** for any shape problem: an over-long note, an unknown idea, a missing action, an unknown field, more than three drafts. **A draft's market problems are refused draft by draft** (another desk's slot, an unpriced name, a line outside its band) and listed as considered. | The brief's "validate everything by code; reject unknown idea ids and fields" for the answer, and "every draft not admitted goes on the considered list" for drafts. |
| R-5 | **Retry only what may pass on a second try**: a timeout, a network error, or HTTP 408, 409, 429 or 5xx. A 4xx (the request itself refused) falls back at once, with its status recorded. | "One retry on a transport error": a 400 would fail the same way and cost a second reservation. |
| R-6 | **A failed or timed-out call is charged its whole reservation** (spend.js's existing rule: its usage cannot be read). | Never understate spend. An error response probably bills no tokens (not tested here), so this can overstate it. |
| R-7 | **The refill attempt is left unspent** for `close_owed` and for any `admission_marks_unavailable` (a held name's mark or corporate-action data at that instant — the ex-dividend case is one of its reasons). Its drafts wait on the close row and the next close fire tries them again, with no model call. | The carried condition names close_owed and ex-dividend. After the close, the close has already credited the day's dividend, so the ex-dividend refusal cannot arise there; the row exercises the same branch through a missing daily entry. |
| R-8 | **Two new outcome words**: a draft that `waiting`s on a transient refusal, and a desk's `no_work`. B2-6 named only `model` and `code_fallback`. | Both states exist and B3 needs to show them. |
| R-9 | **Sizing**: the capital is the slot's permitted maximum exactly — whatever binds (slot cap, cash floor, single-name cap, sector cap). I added no floor below which a draft is refused, beyond the existing $1 minimum leg. | B2-3 says "the slot's permitted maximum". |
| R-10 | **A saved card that fails a requirement is skipped**, not repaired: PF-1 (schema 1, its own list, version 1, its session and save time, the owner's committed list), PF-2 (every finding id resolves on its research record to a finding with its text and source), PF-3 (the provenance stamp on the list). The five most recent are taken first, then checked; a skipped one is not replaced by an older one. | The reply's three requirements; "skip any card that fails them". |
| R-11 | **The saved theses' query** is two equality filters (`userId`, `thesisCard.schemaVersion`) with a limit of 50, sorted in memory: no composite index is needed (Firestore merges single-field indexes for equality filters). It has never run against production. If it fails, the Shadow desk drafts without theses and records `theses_read_failed`. | "No rules or index change." |
| R-12 | **Shared Research's census now admits one reader.** `thesisRecord.census.test.js` pinned that only `thesis.js` names `thesisCard`. The Practice Field's reader (`agentSources.js`) names it once and writes nothing; the census now pins both. The Shared Research review W-9 named the Practice Field as a reader of this name and shape. | The card's one-writer rule is unchanged. |
| R-13 | **T2C-02 changes a rare fire even with the switches off**: a served window row whose receipts show more fills than it counts is now rewritten with the receipts' counts. On every normal path the row is the same object and nothing is written (the end-to-end dump is unchanged by it). | It is a carried T1b condition; it is not behind the agent's switch because it is about code's own records. |
| R-14 | **The end-to-end dump moved, only because of B2-4.** `PRACTICE_FIELD_SLOTS_VERSION` 1 → 2 changes one character in each admitted idea's contract and admission packet. With the constant set back to 1 on this tree, the run reproduces `main`'s pinned SHA exactly (§4.3). Your live book's documents keep version 1; nothing reads the field. | B2-4. |
| R-15 | **The Mandate seam cannot send effort, thinking settings, `fallbacks` or `strict`** (its content allowlist is system, messages, tools, tool_choice). So Sonnet 5.5 runs its default adaptive thinking at its default effort, billed as output inside the 6,000-token cap; a refusal has no server-side fallback; and the schema is enforced by code, not by the API. | "Call, not edit" the seam. If the first live closes show long thinking or cut-off answers, the remedy is a seam change: a founder question, not a B2 change. |
| R-16 | **The Shadow desk's brief is fixed text** (`agentConfig.js` `SHADOW_BRIEF`, version 1). The archetype desk's identity is read from the archetype registry at the epoch's own `archetypeIdentityVersion` — the frozen identity, never the player's deployed agent. | B2-7. |
| R-17 | **The prompt is not in the Mandate honesty registry.** V6.1 §9 says the drafting assembler joins "the Mandate honesty registry and its sweep". That registry (`__fixtures__/mandatePromptRegistry.js`) is the quarterly assemblers' and forbids the archetype registry as a live source. I gave the agent its own guards instead: the import guard both ways (`agentIsolation.imports.test.js`), the identity read at the epoch's version, the honesty words refused in every answer field, and the manifest. | See Q-4. |

### 3.3 Questions for you

| # | Question | My lean |
|---|---|---|
| Q-1 | Rule 2 and the cron hook (R-1): is the 21-line, switch-gated hook in `mandate-evaluate.js` acceptable, as the earlier Practice Field builds' were? | Yes. |
| Q-2 | A failed call is charged its whole reservation ($0.1625), even an error that probably billed nothing (R-6, review A-4). A 529 storm costs $0.65 a close. A missing API key sends no request but is retried and charged $0.325 per desk, so it would use the $3 bound in about 5 closes of phantom spend before the bound refuses. Keep it? | Keep: it never understates. Errors should be rare, and §7 step 2 checks the key before the flip. A narrower rule (a configuration error neither retried nor charged) can come with Q-6's seam change. |
| Q-3 | `max_tokens` 6,000 and a 110-second timeout (§6.2): thinking and answer share the cap. Keep, until the first live closes show how much thinking Sonnet 5.5 uses here? | Keep, and read the first attempts (§7 step 4). |
| Q-4 | Register the agent's prompt in the Mandate honesty registry (R-17), or keep its own guards? | Keep its own; a registry entry would need an exception for the archetype registry. |
| Q-5 | Should a paused book still get a free, code-only note each session (no model call)? Today it gets none. | No: the screen can say "paused". |
| Q-6 | The seam's SDK client retries on its own (2 retries by default), and the module's 110-s timeout does not abort the request (review A-3). So one attempt can send up to 3 HTTP requests, and an abandoned call can keep retrying. Spend is still never understated: a failed attempt is charged its whole reservation. Make a seam change in a later build (a per-call `maxRetries: 0` and an abort signal on the seam's options)? | Yes, in a small seam PR before the five-window schedule. It is not needed for one check a day. |

## 4. Tests and checks

**No real model, Firestore or EODHD call was made.** Every row runs on a fake transport and the in-memory Firestore harness. The one outside read was Anthropic's pricing page (B2-5).

### 4.1 Final checks on the final commit `df782278` (`main` is still `e505f3bb`, the branch's base: nothing to merge)

| Check | Where | Exit | Result |
|---|---|---|---|
| Full suite (`TZ=UTC`, `--maxWorkers=8`, under the suite lock) | WSL, Linux (Node 20.20.2) | **0** | 1,629 files passed, 14 skipped (1,643); **37,595 rows passed, 0 failed**, 197 skipped (37,792); 354 s. Includes the Linux-only censuses (`mandateMoneyRounding.scan`, the protected-store scan, `thesisRecord.census`) |
| `npm run lint:gate` | WSL (Node 20.20.2) | **0** | `eslint . --config eslint.gate.config.js --max-warnings 0`: no finding |
| `npx vite build` | WSL | **0** | `✓ built in 23.66s`; only the existing chunk-size notice |
| `npm run test:rules` (the Firestore emulator suite) | WSL (JDK 21) | **0** | 47 files, **876 rows passed** (876); 180 s |
| Base-against-head trace digest (92 fires; §4.3) | Windows, LF archive trees of `main` and `f9478053` (the code of `df782278`: the two later commits touch only tests) | 0 | 0 of 92 fires differ; all-fires digest `877a4b7eb4db…` on both; the harness file's own 45 rows pass in the head tree |

### 4.2 The rows the brief asked for

| Brief | Where | Rows |
|---|---|---|
| Fake transport: a good answer | `agentRun.test.js` | the seat and request (Sonnet 5.5, no temperature, no cache marker, auto tool choice, the declared cap); reserved before, settled after at its usage; the answer stored; the note under the desk's name |
| …malformed | `agentRun.test.js` | no actions list, no tool call, a refusal, an answer cut off at `max_tokens`, an unknown field, a result word: each the code-built note, nothing changed, no retry |
| …an unknown idea | `agentRun.test.js` | refused whole; nothing changed |
| …an over-long note | `agentRun.test.js` | a 601-code-point note refused whole (and, in `agentPrompt.test.js`, a 281-code-point reason) |
| …a draft outside the rails | `agentRun.test.js` | refused draft by draft, listed as considered |
| …an unpriced name | `agentRun.test.js` | refused `name_not_a_candidate`, listed as considered; the slot's next draft is tried |
| …a timeout then success | `agentRun.test.js` | two reservations, one charged at its maximum, the second answer used |
| …two timeouts | `agentRun.test.js` | the code-built note; both charged their maximum; no third call |
| …a replay | `agentRun.test.js`, `managerExit.test.js` | a second fire makes no call, admits nothing twice, exits nothing twice; a crash mid-call and a crash after the answer each replay without calling again |
| End-to-end, ≥ 12 sessions | `agentEndToEnd.test.js` | 13 sessions, 16 Nov – 3 Dec: drafts admitted and entered, an exit sold at the next session's first window, two timeouts, an early close (27 Nov), theses on and off; its dump pinned by SHA-256 |
| Isolation, switches off | `agentIsolation.test.js`, `agentIsolation.imports.test.js`, §4.3 | with both off the pass reads nothing and every fire is byte-identical to `main`; the deployed trading agent's entries import nothing of the agent's, both ways |
| T2C-02 | `windowLedger.t2c02.test.js` | a served row reconciles its receipts; a delayed attempt is not counted twice |
| A result reader checks the parts | `agentEndToEnd.test.js` | the exited idea's packet passes both `verifyPacket` (the hash) and `resultPacketPartProblems` (the parts) |
| `close_owed` and ex-dividend do not spend the attempt | `agentRun.test.js` | both leave the attempt unspent and the drafts waiting; the next fire admits with no call |
| Admission at its own snapshot, with server time | `agentRun.test.js` | the probe and the admission share one server instant; the snapshot is this close's |
| Early-close sessions | `agentEndToEnd.test.js` | 27 Nov (the 13:00 close) checks once, at its own close |
| Measurements | `agentPrompt.test.js`, `agentIsolation.test.js` "MEASURED" | §6 |

### 4.3 Byte identity with the switches off

- **92 traced fires**, base against head: the T1a-2a trace harness (`practiceFieldNoBook.trace.test.js`) run on a `main` tree and on this branch — the engine's twenty quarterly scenarios with the founder-cap registry missing or empty, at mode off and on (80 fires), and three hold and close scenarios with an active idea book, and with an active and a draining one, at off and on (12 fires). Each fire's every database operation in order, stored document, log line and upstream or model call, digested: **0 of 92 differ** (the slots version character masked, R-14). The digest of all 92 is `877a4b7e…` on both.
- **The end-to-end dump** (`endToEnd.test.js`): with `PRACTICE_FIELD_SLOTS_VERSION` set back to 1 on this tree, it reproduces `main`'s pinned SHA exactly; at 2 the only change is that one character in each admitted idea (R-14).
- **The pass reads nothing** with the agent off: not even its query — zero collections asked for, no transport call (`agentIsolation.test.js`); and a pass over an existing book with the agent off changes not one byte.

## 5. The review and the battery

### 5.1 How it ran (BUILD_RULES §2)

- **Three lenses**, each a separate reviewer on its own read-only `git archive` snapshot of the review commit `96c56718` (node_modules by junction), with probe tests run in its own tree: (a) the model call and spend; (b) drafting, sources and admission; (c) actions, notes and isolation.
- **Every finding to a refuter**, on a fresh snapshot of the fixed commit: it was asked to refute each finding at the review commit with a concrete repro, and to check each fix.
- **Before the lenses**, an advisor pass (no code read by a reviewer yet) found six things the tests could not see; all six were fixed first (`96c56718`): a paused book still spent; every error was retried (a 400 too) and a full-length answer could outlast the timeout; one desk's failure stopped the other; probe and admission read the clock twice; B4 was missing from the prompt; the end-to-end run had no fallback or refusal in it.
- **My own test** caught one defect before the lenses reported it: a crash between an admission and the desk's final write made the replay record the admitted draft as refused (fixed `74873fcb`; lens B found it independently as B-2).

### 5.2 Findings and dispositions

The refuter worked on fresh snapshots: the review commit `96c56718` to test each finding, and the fixed commit `4502037a` to test each fix. It re-ran every reviewer's probe and its own, and ran the fixed tree's rows (20 files: 462 passed; the 2 failures are `mandateMoneyRounding.scan`'s known Windows path walk, which fails the same way at `96c56718`, and it passes in the Linux suite, §4.1).

| Id | Lens | Severity | Finding | Refuter (finding / fix) | Disposition |
|---|---|---|---|---|---|
| **B-1** (= A-5) | b, a | **blocker** | The close snapshot's candidate gate read the slots before the close ran. So a slot freed AT the close (an entry timing out, a line-exited idea resolving) was offered for drafting from a snapshot built without the universe. | **CONFIRMED, worse than reported**: the list was not empty but held only the freed idea's own name (XOM), and a desk drafting it re-bought the name that had just hit its line. The "attempt spent" part does not hold (a refused name never marks the attempt), so the cost was one paid call. / **Gate HOLDS** (the same flow now keeps the universe: 12 candidates, CVX admitted). **Safety net INCOMPLETE**: it tested "any candidate", and a coverage-only snapshot still prices the book's own names. | **Fixed** `cd99da7c` (the gate also counts a slot that may free at this close: `ideaBookMayDraftAtClose`) and **`f9478053`** (the net: a snapshot built without the universe — `candidateUniverseOmitted` — lists no candidate at all, so a gate miss offers no slot; one row, battery mutant B19). The one gate miss the refuter found is a holding idea whose last holding is delisted for cash at the close; the net now covers it. |
| B-2 | b | minor | A replay after a crash between an admission and the final write recorded the admitted draft as refused; the transient-retry path could leave it waiting for good. | CONFIRMED (both parts) / HOLDS | **Fixed** `74873fcb` (found by my own row first) and `cd99da7c` (the retry path). |
| B-3 | b | later | Saved-thesis labels the prompt dropped still resolved. | CONFIRMED / HOLDS (the kept labels are exactly T1…Tn, and the replay stores the same) | **Fixed** `cd99da7c` (`thesisRefsKept`). |
| B-4 | b | later | The saved-list query has no order: an owner with more than 50 carded lists may lose the newest. | CONFIRMED by reading | Not fixed: an order needs a composite index ("no index change"). Recorded. |
| B-5 | b | later | A candidate trimmed from the prompt (only past the byte ceiling) still passes the drafting check. | CONFIRMED by reading | Not fixed by design: the brief defines candidates by the snapshot, not the prompt. Only near the 40,000-byte ceiling (the prompts measure 9–12 KB). |
| A-1 | a | minor | "No further call" after an invalid answer or a crashed call was written only by the fallback write; if that write was lost, the next fire called again. | CONFIRMED (2 calls) / HOLDS (1 call, then the fallback) | **Fixed** `4502037a`: the settled attempts decide. |
| A-2 | a | minor | A desk left mid-way could call on a book paused meanwhile. | CONFIRMED / HOLDS (`spend_stopped:drafting_paused`, nothing reserved) | **Fixed** `4502037a`. |
| A-3 | a | minor | The seam's SDK client keeps its default 2 retries, so one attempt can send 3 HTTP requests; the module's timeout does not abort the request. | CONFIRMED (a 529 storm: 6 requests for 2 attempts; an abandoned call sent 2 more after the timeout) | Not fixable in B2: the seam is called, not edited. Each attempt is still charged its whole reservation when it fails, so spend is never understated. **Q-6.** |
| A-4 | a | question | A failed call is charged its whole $0.1625, though no tokens may have been billed. A 529 storm costs $0.65 a close. A missing API key sends no request, yet is retried and charged $0.325 per desk. | CONFIRMED (the charging) | spend.js's existing rule (never understate); **Q-2**. A missing key would use the $3 bound in about 5 closes of phantom spend and then refuse — §7 step 2 checks the key before the flip. |
| A-6 | a | later | A death mid-call on the close window's last fire is never settled: the reservation stays at its maximum, and no note is written. | CONFIRMED | Recorded: it overstates spend, never understates it. |
| A-7 | a | later | A reservation answered as a replay was treated as permission to call. | CONFIRMED (in code; only if the row loses its record) / **INCOMPLETE, and a regression: RF-1** | Fixed `4502037a`; completed **`f9478053`** (RF-1, below). |
| **RF-1** (the refuter's "R-1") | refuter | minor | **New, from the A-7 fix.** Firestore's SDK re-runs a transaction whose commit outcome is unknown, even when that commit landed. The re-run of the reservation then reads as a replay, so the A-7 fix fell back with no call. That left the reservation open at its maximum for good and erased the attempt from the row. | CONFIRMED (its probe: 0 calls, the operation `reserved` at $0.1625, row `attempts: []`) | **Fixed `f9478053`**. A replay whose row already holds this attempt, reserved at this instant, is the transaction's own commit: the call goes ahead, once. A record the row truly lost is written back as an interrupted attempt, and a reservation still open is settled at its maximum. Two new rows and the A-7 row extended; battery mutants A15–A17. |
| U-1 | a | unverified | Thinking shares the 6,000-token cap, so answers may be cut off or come near the cap. | Premise CONFIRMED (no `thinking` on the wire, so adaptive at the default effort); effect UNVERIFIED (needs a live call) | The prompt asks for brief thinking (`4502037a`). A cut-off answer is the code-built note, with no retry. Measured at the first live close (§7 step 4); **Q-3**. |
| C-1, C-2 | c | minor | The import guard did not walk the deployed agent's crons, nor name its prompt renderers. | CONFIRMED / HOLDS (each plant passes at `96c56718`, red at the fix) | **Fixed** `cd99da7c`. |
| C-3 | c | minor | The import guard's regex comment stripper could drop an import. | CONFIRMED / HOLDS | **Fixed** `cd99da7c` (the repo's parser). |
| C-4 | c | minor | `status` read the close row's agent block with the agent off. | CONFIRMED / HOLDS (0 reads) | **Fixed** `cd99da7c`. |
| C-5 | c | later | An idea the desk cannot act on counted as work: a call paid for nothing. | CONFIRMED / HOLDS | **Fixed** `cd99da7c` (`actionableIdea`). |

**Bar check (the refuter's, and mine):** nothing left open is a blocker. B-1 was the one plausible month-one issue; its gate holds on the likely paths and its net is now exact. The code froze at `f9478053` after this round. I ran only the agent's rows on that fix; the battery's baseline then caught what they could not: the deny-by-default protected-store scan, whose pinned counts for `runDeskCheck` had to move with RF-1's two new sites (`0a4609c9`, the allowlist and its notes only). The refuter round changed no money path: only `agentRun.js`'s reservation handling and `agentSources.js`'s candidates.

### 5.3 The battery

`scripts/practice-field/battery/run-battery.mjs`, tiered, 2 trees × 4 workers (another session's mutation run shared the machine), on LF `git archive` trees of `0a4609c9`. The row set is the idea book's folder, `api/practice-field`, the two cron isolation and trace files, the protected-store scan, the founder CLI's tests and the Shared Research census: **1,704 rows in 51 files, baseline green**. 55 mutants were planted, one per guarded behaviour, across all three lenses and every review fix. They cover the T2C-02 fold, the transient codes, the desk checks, the replay guard, the crash path, the build-input gate, the import guard and the census no-write row.

**Result: 55 defined, 55 ran, 0 broken, 54 killed, 1 survived, 0 errored, 0 timed out (17.0 min).** The survivor, `B9-thesis-ref-unchecked`, removes the check that a saved-thesis draft's label names a list the prompt carried. No row drafted from an unknown label. It is not equivalent: without the check the contract normalizer still refuses, but with other codes, after a sizing probe, and with the slot's attempt spent. A new row (`df782278`, agentRun.test.js, "a draft citing a saved thesis the prompt did not carry…") kills it: with the mutation applied it fails, and the battery re-run for B9 at `df782278` reads **killed** (by the quick tier, 3.6 min; its baseline green, 1,705 rows in 51 files).

| Mutant | Guards | Verdict (stage) |
|---|---|---|
| `A1-retry-any-error` | retry policy | killed (quick) |
| `A2-429-not-retryable` | retry policy | killed (quick) |
| `A3-done-desk-runs-again` | replay never calls twice | killed (first) |
| `A4-crash-recovery-off` | crash mid-call | killed (first) |
| `A5-answer-not-stored` | stored answer before acting | killed (first) |
| `A6-pause-spends` | contract §3.2 | killed (first) |
| `A7-cache-5m` | no cache write reserved | killed (first) |
| `A8-unpriced-as-zero` | unpriced charged its maximum | killed (first) |
| `A9-desk-fence-off` | a fence per desk | killed (first) |
| `A10-theses-fence-off` | theses read fenced | killed (first) |
| `A11-deadline-ignored` | deadline guard | killed (first) |
| `A12-invalid-answer-recalled` | review A-1 | killed (first) |
| `A13-paused-midway-calls` | review A-2 | killed (first) |
| `A14-replayed-op-called` | review A-7 | killed (first) |
| `A15-own-commit-refused` | refuter R-1 | killed (first) |
| `A16-lost-reservation-unsettled` | refuter R-1 (A-7 open op) | killed (first) |
| `A17-lost-attempt-dropped` | refuter R-1 (attempt kept) | killed (first) |
| `T1-unknown-idea-accepted` | unknown idea | killed (first) |
| `T2-missing-action-accepted` | one action per open idea | killed (first) |
| `T3-banned-words-allowed` | honesty words | killed (first) |
| `T4-note-bound-off-by-one` | B11 | killed (first) |
| `T5-unknown-field-accepted` | deny unknown | killed (first) |
| `T6-refusal-accepted` | refusal stop | killed (first) |
| `B1-other-desk-slot` | B2-7 | killed (first) |
| `B2-unpriced-name` | candidates | killed (first) |
| `B3-transient-spends` | carried: ex-dividend | killed (first) |
| `B4-close-owed-spends` | carried: close_owed | killed (first) |
| `B5-second-draft-admitted` | one per slot | killed (first) |
| `B6-replay-check-off` | replay idempotency | killed (first) |
| `B7-placeholder-capital-admitted` | B2-3 sizing | killed (first) |
| `B8-origin-wrong` | B2-4 | killed (first) |
| `B9-thesis-ref-unchecked` | saved theses | **survived** (full) |
| `B10-desk-mismatch-allowed` | contract desk | killed (first) |
| `B11-provenance-unchecked` | PF-3 | killed (first) |
| `B12-findings-unchecked` | PF-2 | killed (first) |
| `B13-reader-writes` | census: one reader, no write | killed (quick) |
| `B14-gate-ignores-agent` | build input gated | killed (first) |
| `B15-gate-ignores-slots` | build input gated | killed (first) |
| `B16-gate-misses-freeing-slot` | review B-1 | killed (first) |
| `B17-no-candidates-still-offered` | review B-1 net | killed (first) |
| `B18-dropped-labels-resolve` | review B-3 | killed (first) |
| `B19-omitted-snapshot-candidates` | refuter on B-1 (net) | killed (first) |
| `C1-exit-stale-session` | exit guard | killed (quick) |
| `C2-exit-while-selling` | §4 ignore | killed (first) |
| `C3-exit-other-desk` | B2-7 | killed (first) |
| `C4-settlement-reason-dropped` | B2-1 reason | killed (first) |
| `C5-close-records-reason` | byte identity | killed (first) |
| `C6-exit-kind-wrong` | manager_exit kind | killed (first) |
| `C7-served-row-not-reconciled` | T2C-02 | killed (quick) |
| `C8-delayed-attempt-double` | T2C-02 | killed (quick) |
| `C9-served-write-always` | normal path unchanged | killed (first) |
| `C10-import-guard` | rule 5 | killed (quick) |
| `C11-row-valuation-carried-lost` | exit valuation | killed (first) |
| `C12-settling-idea-is-work` | review C-5 | killed (first) |
| `C13-status-reads-when-off` | review C-4 | killed (quick) |

## 6. The measurements

**No live call was made** (rule 3). Every figure below is measured on the fixtures in bytes, or derived from Anthropic's published prices; real token counts and thinking length are unknown until the first live close (§7 step 4).

### 6.1 Tokens and cost per call

| | Shadow desk | Shadow desk, 5 saved theses | Archetype desk |
|---|---|---|---|
| Whole input, measured (system + message + tool JSON, UTF-8 bytes; `agentPrompt.test.js` "MEASURED") | 9,432 | 12,097 | 10,018 |
| Input tokens, estimated (≈ 3.5–4 bytes a token, plus the 286-token tool prompt Anthropic adds) | ≈ 2,650–3,000 | ≈ 3,300–3,750 | ≈ 2,800–3,150 |
| Input tokens, RESERVED (the ceiling: 40,000 bytes + 1,000) | 41,000 | 41,000 | 41,000 |
| Output tokens, cap (thinking + answer) | 6,000 | 6,000 | 6,000 |

| Per call | Figure |
|---|---|
| Reserved before the call (the most it can cost) | 41,000 × $2.50/M + 6,000 × $10/M = **$0.1625** |
| Expected charge (≈ 3,000 input, 1,000–3,000 output) | ≈ **$0.016–$0.036** |
| Charge if the answer uses its whole output cap | ≈ **$0.066** |
| A timeout or other failure (charged its whole reservation, §3 R-6) | $0.1625 |

### 6.2 The month against B9 ($3)

Two desks, about 21 sessions: at most 42 calls (fewer: a desk with no work makes none).

| Case | Month |
|---|---|
| Expected | ≈ **$0.70–$1.50** |
| Every answer at its 6,000-token cap | ≈ **$2.77** — inside $3, with little room for retries |
| Every call times out (charged its maximum) | the bound refuses after about 18 calls; the rest of the month's notes are code-built, and code still manages the money |

**Verdict on B9:** two calls a session fit comfortably if answers are typical. They do not fit comfortably if Sonnet 5.5's default adaptive thinking routinely fills the cap. The first live closes will say which (§7 step 4). The bound is not raised.

**The timeout and the cap together.** 6,000 output tokens in 110 s needs about 55 tokens a second. A full-length answer at a slower rate times out, is charged $0.1625 and is retried once. Two desks of one call each fit one 290-s fire; a retry pushes the second desk to the next close fire, fifteen minutes later, inside the 300-s lease.

### 6.3 The EODHD calls a drafting close adds

Measured with a counting quote fetcher on the real snapshot builder (`agentIsolation.test.js` "MEASURED"):

| Close snapshot | Symbols | Quote calls (batches of 100) |
|---|---|---|
| Idea book only, not drafting | 5 | 1 |
| A drafting close (the 136-name candidate universe kept) | 138 | 2 |

So a drafting close adds **one** quote call. The daily build is unchanged: **zero** fundamentals or corporate-action calls are added (candidates need only a price; sectors come from the sector bridge). A book drafts at most once a day, so at most about 21 extra calls a month.

## 7. Your steps to turn the agent on

Nothing here is done by this PR. Merging it spends nothing: both switches ship `false`.

1. **Merge this PR** and let it deploy. Your live book runs exactly as today (§4.3).
2. **Check two production settings in Vercel** (Project → Settings → Environment Variables, Production):
   - `CLAUDE_API_KEY` is set. The Mandate seam reads it (`mandateModelCall.js`).
   - `COCKPIT_ALLOWLIST_UIDS` still holds your uid. At `'allowlist'`, admission admits only that list: without your uid every draft is refused `mode_not_admitted`, and that refusal spends the slot's attempt for the day.
3. **Open the flip PR** (one commit, one line each, BUILD_RULES §2):
   - `src/config/practiceFieldFlags.js`: `PRACTICE_FIELD_AGENT_ENABLED = true`;
   - `src/config/practiceFieldFlags.test.js`: its pin row to `true`;
   - `src/config/flagPinGuard.test.js`: remove the `PRACTICE_FIELD_AGENT_ENABLED` entry from `DARK_BY_DESIGN`.
   Leave `PRACTICE_FIELD_AGENT_THESES_ENABLED` off at first. Flip it the same way, later, in its own PR.
4. **The first close after the deploy** (about 16:15–18:00 Eastern): run
   ```
   node scripts/practice-field-founder.mjs status --uid <your uid>
   ```
   and read the `agent` block before trusting anything else:
   - each desk's source should be `model`. If it is `code_fallback`, the reason is printed beside it;
   - on the close row (`mandates/{bookId}/windows/{session}_close`, field `agent.desks.*.attempts`), read for each attempt: `stopReason` (it should be `tool_use`), `usage.outputTokens` (how much of the 6,000 cap it used), the time from `reservedAt` to `settledAt` (how close to the 110-s timeout), and any `error` or `httpStatus`;
   - `spend`: the month's charged and committed figures against $3.
   **The first live call is unprobed.** No test can show how Sonnet 5.5 answers `auto` tool choice with adaptive thinking on this prompt. If the first closes fall back, the attempts say why; send them to the Practice Field chat before changing anything.
5. **To stop it**, revert the flip PR's one commit. Nothing is deleted; ideas the agent admitted keep running under code.

## 8. What B3 (the screen) reads, by field name

All of it on the session's close row, `mandates/{bookId}/windows/{session}_close`, which the owner can already read. One block per desk under `agent.desks.shadow` and `agent.desks.archetype`; `agent.version` (1) and `agent.model` beside them.

| Field | What it is |
|---|---|
| `deskName` | "The Shadow desk" / "The archetype desk" — the heading |
| `slots` | the desk's slots |
| `status` | `done` (or `in_progress` while a fire is mid-way) |
| `source` | `model` (the agent wrote the note), `code_fallback` (code wrote it: the check did not complete), `no_work` (no idea and no slot to fill, or the book paused: no call) |
| `note` | the desk's note, ≤ 600 code points, or null for `no_work` |
| `fallbackReason` | why code wrote the note (`transport_failed`, `transport_refused`, `answer_invalid:…`, `spend_refused:…`, `spend_stopped:drafting_paused` / `spend_stopped:wind_down` (the book was paused while a desk was mid-way), `attempts_spent`, `attempt_already_reserved`, `interrupted_call`, `input_over_ceiling`, `identity_unavailable`) |
| `draftingSkipped` | `no_candidates` when the close priced no candidate, so no slot was offered (its attempt stays unspent) |
| `stoppedBy` | `drafting_paused` or `wind_down` when the book's spend is stopped |
| `actions[]` | per open idea: `ideaId`, `action` (`hold` / `exit`), `reason` (≤ 280), `outcome` (`held`, `exit_settled`, `ignored_already_selling`, `ignored_already_settling`, `ignored_not_entered`, `refused:…`) |
| `considered[]` | every draft: `index`, `slot`, `names`, `thesis`, `comparison`, `lines`, `source` (`price_list` / `saved_thesis` with its label), `outcome` (`admitted`, `refused`, `not_chosen`, `waiting`), `refusals[]` (`code` and a small detail), and for an admitted draft `ideaId`, `capitalUsd`, `binding` |
| `refill.{slot}` | the slot's attempt: `attempted`, `spent`, `admittedIdeaId`, `waitingOn` |
| `work` | `openIdeaIds`, `emptySlots` at the check |
| `attempts[]` | each model call: `n`, `opId`, `state`, `reservedAt`, `maxChargeUsd`, `settledAt`, `chargedUsd`, `unpriced`, `outcome` (`answered`, `invalid_answer` with `invalidReason`, `transport_error` with `error`, `httpStatus` and `retryable`, `interrupted`, with `recordLost` when the row had lost it), `usage`, `stopReason` |
| `manifest` | what went in, never the text: `inputHash`, `inputBytes`, `counts`, `identity`, `model`, ceilings, `offeredSlots` (the empty slots the prompt offered), `inputTokens`, `outputTokens`, `chargedUsd`, `trimmed` |
| `thesesSkipped[]` | saved lists not used, with the reason |

The idea itself: `contract.desk`, `contract.origin`, `contract.sources`; after an exit, `managerExit` and `result.managerExit` (`session`, `desk`, `reason`, `decidedAt`), `result.endpointKind: 'manager_exit'`, `endpoint.kind`. "Settled early by the manager" is `endpointKind === 'manager_exit'`.

A result reader must check the packet's parts (`resultPacketPartProblems`) as well as its hash (`verifyPacket`). The end-to-end row does both on the exited idea's packet; no production result reader exists yet.

## 9. Fix round, Astra's review

**Date:** 23 Nov 2026 · **Branch:** `claude/practice-field-b2-fixes` · **Base:** `main` `190b5e63` (PR #1108 merged; fetched first) · **Code head:** `bb224b40` · **Review:** `docs/audits/20261123_ASTRA_REVIEW_B2.md`, committed byte-identical first (`da4c3a61`, SHA-256 `b73d2249…07690`, with its `docs/README.md` row).

| Item | Verdict |
|---|---|
| B2-A01: a name quoted only at an earlier session is offered and admitted | **Fixed** as Astra said |
| B2-A02: an explicit `null` on an optional field is read as omitted | **Ruled (R-18), made explicit** in the validator |
| B2-A03: after a paid call and an admission the row still reads `modelCalled: false`, `no_model_action` | **Fixed** as Astra said |
| B2-A04 (hardening): unreadable usage priced at $0 | **Fixed**: charged the whole reservation |
| B2-A06 (hardening): a `price_list` draft's thesis label reaches the considered list | **Fixed**, and widened by the refuter's F1 |
| Both sub-switches off; no fenced file, rules or index change; offline | **Held** |
| Switches off: every fire byte-identical to `main` | **Held**: the 92-fire trace and the end-to-end dump pass unchanged |
| Battery | **47 distinct mutants, every one killed** (59 runs: 43 at `c673b1d8`, whose one survivor a new row killed; 16 re-run or new at `bb224b40`) |
| Refuter | **No blocker.** Two minor findings, both CONFIRMED and fixed (`bb224b40`) |

### 9.1 In plain terms

- **A01.** The agent can now only pick a stock that was priced at **today's** close. Before, a stock whose last price was from Friday could still be offered on Monday and bought with $34,979.04 of your cash. The book already had a check that knows the difference (it is what marks your holdings); the agent's list and its drafting check now both use it, through one shared selector.
- **A02.** Your ruling R-18 is now written into the code that checks the agent's answer. A model that writes `null` for a field it means to leave out is fine; a field of the **wrong kind** throws out the whole answer, so nothing moves on a bad answer. A draft that is then incomplete (a sector-fund comparison with no fund) is refused on its own, and the rest of the answer still stands.
- **A03.** The close row's headline now says what happened: whether the agent was called, and whether something it proposed was executed (`model_action`), it paid for a call that fell back to code (`model_fallback`), or it was called and nothing changed (`model_no_change`). It is worked out from both desks' records every time either desk writes, so the second desk can't erase the first desk's work, and a replay writes the same thing.
- **A04.** If a reply ever comes back without readable token counts, it is charged its full reservation ($0.1625), never $0.
- **A06.** A thesis label on a price-list draft is dropped before anything is stored, and none of the result words ("validated", "proven", "supported") can reach the row through any text the agent wrote.

### 9.2 Ruling R-18, verbatim

> **The founder's ruling, R-18: `null` on an optional field means "omitted"**
>
> - Models often write `null` for a field they mean to leave out. Refusing the whole answer for that would turn ordinary days into fallback days.
> - **So an explicit `null` on an optional field is read as omitted, by rule.** State it in the tool's validator and in the report.
> - **Every other wrong type is refused whole,** as R-4 says: a string where an array belongs, a number where a string belongs, an array of the wrong element type.
> - **After reading `null` as omitted, the draft must still be valid on its own.**
>   - A `same_stock_held` comparison needs no symbols.
>   - A `sector_fund` comparison with `symbols: null` is refused **as that draft**, and listed as considered.

It is stated in the validator's header (`agentTool.js:23`).

**What R-18 changed in behaviour: nothing, on its own.** The B2 validator already read `null` as omitted on both optional fields and refused other wrong types (the nine A02 rows pass on the base too — VERIFIED by running them there). Astra's A02 finding is therefore closed by the ruling; the code change makes the rule one named function (`optionalOf`) that every optional property goes through, and the battery proves the rows guard it (F02a, F02b below).

### 9.3 Each fix, by `file:line` (at `bb224b40`; all VERIFIED)

**B2-A01 — one selector, this session's close only.**
- `api/_utils/practiceField/agentSources.js:67` `candidatesOf(snapshot, taken, { session })`: `:69` a snapshot of another session (or no session) lists nothing; `:79` a name is listed only when `marks.js closeMarkQuality(entry, session)` reads `vendor_time`. So a carried-forward print (Astra's case), a pre-open print and a quote with no vendor time (which cannot show its session) are not candidates.
- `api/_utils/practiceField/agentRun.js:534` `closeCandidatesOf` — THE one selector. The prompt's list (`:344`, via `closeSnapshotKeyOf` `:528`) and drafting's `name_not_a_candidate` check (`draftFromAnswer`, both its main and its `drafts_retried` calls) read it over the same snapshot key. Before, the prompt read `row.closeSnapshotKey` and drafting read `${session}_close`.
- Reading (stands unless you object): the bar is `vendor_time`, the only full-quality close mark, not merely "not `carried_forward`". A pre-open print or a receipt-time quote cannot prove it is this session's close.
- Astra cited `admission.js:446` beside the selector: that is admission's general mark set, which runs with the switches off. It is **not** changed; the candidate gate before it now holds the line.

**B2-A02 — R-18.**
- `api/_utils/practiceField/agentTool.js:202` `optionalOf(obj, key, check, at)`: absent or `null` → omitted; any other value must pass its declared type, or the whole answer is refused. Used for `comparison.symbols` (`:229`) and `source.thesisRef` (`:242`) — the tool's only two optional properties.
- Per-draft refusals after R-18 come from the contract's own codes at drafting: `sector_fund` with no fund → `comparison_fund_unknown`; `saved_thesis` with no label → `thesis_source_unknown`.

**B2-A03 — the window-level summary.**
- `api/_utils/practiceField/agentRun.js:121` `agentWindowSummaryOf(row, desks)`, derived (never incremented) from the row's code block and **both** desks' parts:
  - `modelCalled`: some desk recorded an attempt (`:132`; after the refuter's F2 it reads the attempts, the same source as the counts);
  - `outcome`: `model_action` (an exit settled or a draft admitted from a model answer) › `model_fallback` (a paid call fell back to code) › `code_action` (code acted at the close) › `model_no_change` (called, nothing executed) › `no_model_action`;
  - `agent.summary`: `calls` per desk, `callsTotal`, `exits`, `admissions`, `paidFallbacks`, `codeActed` — what the one word cannot say.
- `agentRun.js:150` `partPatch(desk, part, rowData)` writes it with the desk's part. All five close-row writes go through it, each with the row its own transaction read: the part's write, the crash settlement, the lost-attempt record, the reservation and the settlement. No new write site.
- `api/_utils/practiceField/windowLedger.js:320` `closeCodeActed(code)`: the one "code acted at the close" test, now read by both the close row's own outcome (`:347`, byte-identical result) and the summary. `WINDOW_OUTCOME` gains the three model words (`:64`), documented at `:56`.
- Nothing else writes a close row after it is created (`close.js:1460` and `windowLedger.js` create it once; the refuter re-checked `reconcileServedRow`, which leaves a close row alone).

**B2-A04.** `agentRun.js:217` `readableUsage(u)`: input and output counts whole numbers (input above zero), any cache count present a whole number. Otherwise the attempt is `unpriced` (charged its reservation) and records `usageUnreadable: true` (`:462`); the answer is still acted on (`:442`). `modelPriceTable.js` is shared and is not touched.

**B2-A06.**
- `agentTool.js:245`: `thesisRef` is kept only on a `saved_thesis` draft; on any other source it is checked for its type (R-18) and then dropped, so it reaches neither the stored answer nor the considered list.
- `agentTool.js:220`, `:228`, `:247`–`:250`: the result-word check on every text of a draft the row stores — the slot and the comparison's type (refuter F1), each name, each comparison symbol, each line symbol, a kept label. A hit refuses the whole answer, as the note and the reasons already did.
- `agentTool.js:158` (refuter F1): an unknown field's name is repeated in a refusal reason only when it is a plain identifier with no result word, else `?`.

### 9.4 The rows

New file `api/_utils/practiceField/agentFixRound.test.js` (27 rows), on the in-memory harness with the fake transport. **Run against the unfixed base, 17 of them fail** (A01 2 of 3 — its positive control passes, A03 6/6, A04 7/7, A06 2/2) and the 9 A02 rows pass (§9.2).

| Fix | Rows |
|---|---|
| A01 | Astra's failing test as written: MSFT at Friday 13 Nov 16:00 ET, the other standard quotes, Monday's close — absent from the prompt's candidates, a long draft refused `name_not_a_candidate`, the treasury, the long slot and the open ideas unchanged. Positive control: MSFT at this session's close is offered and admitted. Pure: a carried, a pre-open and a receipt-time print are not candidates; a snapshot of another session, a mislabelled one and no session list nothing. |
| A02 | The exit plus a `same_stock_held` draft with `symbols: null`: **accepted**, the exit settles (`manager_exit`), the draft admitted, the stored comparison without symbols. Refused **whole** — one call charged $0.03, `code_fallback`, no manager endpoint, the portfolio byte-identical: `symbols: "MSFT"`, `symbols: [1]`, `thesisRef: 7`, `thesisRef: ["T1"]` on a price-list draft. `sector_fund` with `symbols: null`: refused as that draft (`comparison_fund_unknown`), listed as considered, the exit stands. `saved_thesis` with `thesisRef: null`: `thesis_source_unknown`, the exit stands. `price_list` with `thesisRef: null`: admitted. A pure table over both fields. |
| A03 | Astra's test: hold plus admit — the row reads `modelCalled: true`, `model_action`, Shadow 1 call, 1 admission; the archetype desk then finishes with no work and the row keeps it all (archetype 0 calls); a replay of the whole pass makes no call and leaves the row byte-identical. Both desks answering: 2 calls, the admission kept, a replay byte-identical. A paid fallback: `model_fallback`. A held answer: `model_no_change`. Paused control: zero calls, `no_model_action`. A pure table of all 162 combinations of code acting × each desk's state (incl. the refuter's stale-flag case). |
| A04 | `usage: {}`, no usage, string counts, a negative count, zero input, a fractional cache count: each `unpriced`, charged $0.1625, `usageUnreadable`, the answer acted on. Pure: the fixture's real usage, output 0 and null cache counts read. |
| A06 | A `price_list` draft with `thesisRef: "proven"`: admitted, its label `null` in the answer and the considered list, and **the whole close row** holds no `/proven/i`. Pure: a result word in a kept label, a name, a comparison symbol, a line symbol, the slot, the comparison type, or an unknown key's name refuses (or is masked); plain controls pass. |

Changed existing rows: `agentPrompt.test.js` (three calls pass the session to `candidatesOf`); `agentRun.test.js` (two crash rows find the final write by its source text, now `partPatch(desk, part, snap.data())`); `agentEndToEnd.test.js` (the re-pin below). No assertion was loosened.

**The 13-session run, re-pinned (A03).** The dump moved from `d43681cb…` (828,454 bytes) to **`c1fca0d6…` (830,894 bytes)**. The base commit reproduced the old pin exactly; a recursive leaf comparison of the two dumps found **26 changed leaves and 91 added, none removed**: on each of the 13 close rows, `modelCalled` false → true and `outcome` no_model_action → `model_action` (3), `model_no_change` (9) or `model_fallback` (1, the session whose calls failed), plus the seven `agent.summary` leaves. Nothing else moved. (The refuter's F2 change reads the attempts instead of the flag; the run's desks agree on both, and the pin passes unchanged at `bb224b40`.)

**Isolation, switches off.** `api/cron/practiceFieldNoBook.trace.test.js` (92 fires against `main`'s pins) and `api/_utils/practiceField/endToEnd.test.js` (the 443,533-byte dump) pass **unchanged**. The one shared change on that path, `closeCodeActed` in `buildCloseWindowRow`, returns the same boolean for every row the close builds (its arrays are always arrays and `bookClosed` always a boolean — the refuter re-checked it).

### 9.5 The battery

`scripts/practice-field/battery/run-battery.mjs`, tiered, 4 trees × 4 workers, LF `git archive` trees; the row set is the idea book's folder, `api/practice-field`, the two cron isolation and trace files, the protected-store scan, the founder CLI's tests and the Shared Research census — **1,732 rows in 52 files, baseline green** each time. `--prior` was the build's battery (`0a4609c9`).

| Run | Mutants | Result |
|---|---|---|
| `c673b1d8` | 34 of the build's: the 33 whose anchors are in a changed file (`agentRun.js`, `agentTool.js`, `agentSources.js`, `windowLedger.js`) plus `B2-unpriced-name`; 9 new: F01a (any close quality is a candidate), F01b (another session's snapshot lists), F02a (a wrong type read as omitted), F02b (null refused whole), F03a (the row-level fields not written), F03b (the summary from this desk only), F04 (unreadable usage priced), F06a (a price-list draft keeps its label), F06b (names unchecked) | **43 defined, 43 ran, 0 broken, 42 killed, 1 survived** (4.7 min) |
| `46a0534b` (`--only`) | F01b, after a new row (a snapshot labelled for another session, carrying this session's prints, lists nothing) | **killed** (1.3 min) |
| `bb224b40` | the 12 whose code the refuter fix touched (T1–T6, F02a/b, F03a/b, F06a/b) plus 4 new: R1a (slot unchecked), R1b (comparison type unchecked), R1c (an unknown key repeated), R2 (`modelCalled` from the flag) | **16 defined, 16 ran, 0 broken, 16 killed** (3.5 min) |

The survivor F01b was not equivalent: the mark check also rejects the other session's prints in the first row's cases, so only a snapshot labelled for one session that carries another's close prints tells the guard apart. The new row does.

### 9.6 The refuter

One adversarial refuter on its own `git archive` tree of `c673b1d8`, read-only on the repo, told to refute with a run repro. **No blocker; the hard constraints hold.**

| ID | Finding | Verdict | Disposition |
|---|---|---|---|
| F1 | A06 was incomplete: a draft's `slot` (any string ≤ 20) and `comparison.type` (any string) reach the row — `slot: 'proven'` and `type: 'validated'` were accepted and stored; an unknown key's name (`proven: 1`) is written into the fallback reason | minor, **CONFIRMED** (probe) | **Fixed `bb224b40`**: both pass the result-word check; a key's name is repeated only as a plain identifier with no result word. Rows and mutants R1a–R1c |
| F2 | A03 could write `modelCalled: false` beside a paid call: a later fire's `identity_unavailable` or prompt-ceiling fallback passes `calledModel: false` over an earlier paid attempt | minor, **CONFIRMED** (traced; the pure output run) | **Fixed `bb224b40`**: the row reads the attempts. The desk-level flag on that rare path is older than this round and is left as it was (it is not what the row reads now) |
| — | Five other candidates (a write skipping the summary; another path undoing it; a replay mislabelling; another route for a carried name; R-18 ordering; A04 misreading real SDK usage; a switches-off difference) | **REFUTED** with the lines read | — |

It also mutated four places in its own tree (drafting's selector loosened, the summary from one desk, the old usage handling, the label kept); each was killed by the rows it targets.

### 9.7 Checks, with their result lines

All on the code head `bb224b40` (this report is the next commit; it changes no code). Linux runs are in WSL, on a private worktree of `~/pd-ci` at the exact commit, `TZ=UTC`, under `flock /tmp/pd-suite.lock`.

| Check | Result line |
|---|---|
| Full suite, Linux, `--maxWorkers=8` | `Test Files  1648 passed \| 14 skipped (1662)` · `Tests  38041 passed \| 197 skipped (38238)` · exit 0 (316.8 s). The same totals at `46a0534b`, before the refuter fix. |
| `npm run lint:gate` (Linux) | exit 0, no output. Also exit 0 on Windows at `c673b1d8`. |
| `npm run test:rules` (Linux, Firestore emulator, Temurin 21) | `Test Files  48 passed (48)` · `Tests  889 passed (889)` · exit 0. No rules or index file changed. |
| `npm run build` (Linux) | `✓ built in 16.61s`, exit 0. Its three `css-syntax-error` warnings come from CSS this round does not touch (the diff has no `src/` or CSS file). |
| Practice Field rows, Windows | 49 files, 1,643 rows green at `c673b1d8` (the idea book's folder, the 92-fire trace, the founder CLI, the flags). At `bb224b40` the same folder is green but for one row, `agentIsolation.imports.test.js` "every deployed-agent entry point…", which timed out at 5 s twice while the folder ran beside the Linux suite and passes alone in 0.54 s (twice); the Linux suite above ran it green. |
| Byte identity, switches off | `practiceFieldNoBook.trace.test.js` and `endToEnd.test.js` pass unchanged (their pins are `main`'s). |
| Re-pin, the 13-session run | `PF_AGENT_E2E_EVIDENCE {"sha256":"c1fca0d65138eee123fe85cdb91372b9e48c31e715e273d3d5c17de820f0a9f5","bytes":830894}` (§9.4). |

**Scope.** 10 files, +661 / −48 against `main` `190b5e63` (this report aside): four source files (`agentSources.js`, `agentRun.js`, `agentTool.js`, `windowLedger.js`), one new test file, three existing test files, Astra's review and its README row. **No fenced file was edited** and no fenced function is called (BUILD_RULES §1). **No rules or index change.** `src/config/practiceFieldFlags.js` is untouched: both sub-switches still ship `false`. Offline throughout: a fake transport and the in-memory harness; `git fetch` and `git push` the only network calls.

### 9.8 Recorded for later, not built

- **B2-A05** (sweep call count): a fallback after a refused retry reports zero calls for the fire despite one transport call. Home: the agent's telemetry.
- **B2-A07** (replay audit): a replay after an interruption between the admission and the final write writes empty `work` lists while the stored answer still holds the exit and the draft. Home: the screen (B3).
- **B2-A08** (import-guard coverage): the checked-in walk stops outside `api/`, skips aliases and stops at the model seam. Home: a future import change.
- **B2-A09** (saved-card integrity): an empty `source` object satisfies the reader's finding check. Home: the theses switch's turn-on.

The earlier cases keep their homes (B-4, B-5, A-6, Q-6; §3.3 and §5). The offline calls still do not show how the live model answers or how many tokens it uses.
