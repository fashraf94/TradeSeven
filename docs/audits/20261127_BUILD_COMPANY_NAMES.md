# Build report: research universe, Build 3a (company names)

**Date:** Friday 27 Nov 2026 · **Asked by:** the Explore content chat (Fable), for the founder · **Base:** `origin/main` @ `a2e05fa9` (#1122) · **Branch:** `claude/company-names`

**Status: built.**
- The build stopped once, at §2 point 2, because the stored name reaches three LLM prompts (§2.2).
- The founder ruled "go" on Q-1 ("Yes, build it"), and the fix was then applied as drafted. Nothing else changed.

**Preamble.**
- **Fetch first.** `git fetch origin` ran first: `HEAD` = `origin/main` = `a2e05fa97f537ad43b2b77d444748fd1d2dd7b50`, clean tree.
- **Fetched again before the final checks.** `main` had not moved (still `a2e05fa9`, an ancestor of the branch head), so the final checks ran on the branch head, which is the tree that would merge.
- **Commits, in order:**
  1. `d122ef9d`: the §2 point 4 test, committed before anything was fixed.
  2. `3089f6c8`: the research record's name, pinned before the change.
  3. `4697a3a0`: the fix, the golden and the rows that failed first.
  4. The report.
- **Production (read only, §2 points 2 and 3):**
  - Firestore: every `researchWork` document with origin `shared_research`, and `peerRankings` (all 240, plus the 4 names the Work an idea records use, read through the real `readNames`).
  - Cloud Storage: the 48 objects of the shadow log's `conversations` stream for 16 to 27 Nov.
  - **No write anywhere.** No provider call, no model call.
- No secret, uid, email or player text appears in this report, the code or the PR. Counts only.
- **VERIFIED** means read at the line, or measured, in this session. **ASSUMED** marks anything taken from the census subagent without a re-read.

---

## 0. Verdict

| Question | Answer |
|---|---|
| Is the name fixed? | **Yes.** `shapeFundamentals` takes the name from the top-level `"General::Name"` key, then `General.Name`, then the ticker (`api/_utils/stockMeasures.js:51`). From the next rankings run, `peerRankings/{sym}.name` and every leaderboard row hold the company's name ("NVIDIA Corporation", not "NVDA"). |
| Does any number, rank, tier or score change? | **No.** The golden moves in **6 lines, all `name`**, in the 3 cases whose input carries `"General::Name"`. Every other value of every case, the request URLs, the log lines and the failure are unchanged (§3.2). |
| Did a stop condition fire? | **Yes, §2 point 2, and the founder ruled "go".** The stored name reaches three LLM prompts: Work an idea's thesis builder (`stepPrompt.js:329`), "why is it moving" (`why-moving.js:62`, from the Compete tab's sector leaderboard), and the advisor questions' `{COMPANY}` fallback (`AnalysisQATab.jsx:339`). |
| Fenced file or Wire? | **Neither reads the name.** None of the 11 fenced files reads a stored stock name, and none of the 25 Wire generation modules does (§2.2). |
| How big was the effect? | **No company fact in Work an idea carried a company.** Production holds 6 Work an idea records. Their 38 current company facts carried **0** symbols; all 15 company leads were `identity_unresolved`; **0** companies were supported. The step log shows the name check dropping a game stock **76** times, on **14 of 35** completed steps, across **7** different game stocks (§2.3). |
| The research record for GLW, ANET, TSM | **Unchanged.** The name pin committed before the change passes after it (§3.3). |
| Tests | The §2 point 4 test (committed first), the three places in order, the golden with its name-only diff, one home for the research name, and a chain row from the rankings job's own fetch to the step validator. **7 rows failed on the unfixed code. Mutation battery: 8 of 8 killed** (§4). |
| Full suite (Linux) | **exit 0** · `Test Files 1690 passed | 14 skipped (1704)` · 39,376 rows passed, 0 failed, 197 skipped · 570 s (§5) |
| `lint:gate` | **exit 0** |
| First rankings run with real names | **The first scheduled run after the merge is deployed.** The job runs at 11:00 UTC Monday to Friday (`vercel.json:69-70`); today's had already run. If the merge deploys before **Monday 30 Nov, 11:00 UTC (6:00 AM ET)**, that run rewrites all 240 names. Nothing triggers the job. |
| Stopped on a ruling | Q-1 is answered ("go"). Q-2, the `metricSnapshots` copy, is recorded and needs no change (§6). |

---

## 1. In plain terms

- **The fix.** Every stock's stored name was its ticker, because the rankings job looked for the company name in the wrong place in the data provider's answer. It now looks in the right place first. From the next weekday rankings run on, NVIDIA is stored as "NVIDIA Corporation".
- **Why it mattered.**
  - Work an idea decides which company a fact is about by comparing the name the partner wrote with the stored name.
  - So far, not one of the 38 facts about a company in production's 6 Work an idea records carried its company. Some of those facts may be about companies the game doesn't hold. The rest were lost to the name.
  - The name check threw a game stock away 76 times, across 7 different stocks. From the next run, "NVIDIA" matches NVIDIA.
- **No number, rank, tier or score moves.** The profit-margin and short-interest faults found in Build 2 are untouched; they wait for their own build.
- **Three AI prompts now get the real name**, which the founder approved:
  - Work an idea's thesis builder lists the companies an idea may use by name.
  - "Why is it moving" reads "NVIDIA Corporation (NVDA) is up…" instead of "NVDA (NVDA) is up…".
  - The advisor questions use the name when the company profile has none.

---

## 2. Read first (build prompt §2)

### 2.1 Rules and earlier work

- **Read:** `docs/BUILD_RULES.md`, and the Build 2 report `docs/audits/20261126_BUILD_RESEARCH_NUMBERS.md` §2.4, §5.2, §11 (incl. §11.3), §12 (Q-5, Q-13).
- **The prompt's §1, re-checked at `a2e05fa9` (VERIFIED):**
  - **Production held tickers as names.**
    - `peerRankings` holds 240 documents (228 in the game list, plus 12 others not examined; Build 2 §11.4).
    - The name equals the ticker in **240 of 240**. The same holds for **5,079 of 5,079** leaderboard rows. NVDA read "NVDA" and MSFT read "MSFT".
    - Read straight from Firestore, not through the public endpoint.
  - **The cause.**
    - `shapeFundamentals` read `data.General?.Name || ticker` (`stockMeasures.js:49` at the base).
    - The filter is `…,SharesStats,General::Name` (`rankingConfig.js:814`). Build 2 measured that it returns a top-level `"General::Name"` key.
    - `extractMetrics` passes the name on as `metrics.name` (`stockMeasures.js:445` at the base).
  - **The effect, run against `main`:**
    - `isSameCompany('NVIDIA', {NVDA, 'NVDA'})` → `false`.
    - `isSameCompany('NVIDIA', {NVDA, 'NVIDIA Corporation'})` → `true`.
    - `namesCompany('Microsoft said Azure grew', {MSFT, 'MSFT'})` → `false`, and `true` with 'Microsoft Corporation'.
    - Both functions refuse when the core name equals the symbol (`companies.js:72`, `:92`).
    - The validator drops the symbol at `stepSchema.js:471-478` (`identityOf`, `:466-480`). Its names come from `readNames` (`store.js:317-325`), which reads `peerRankings/{symbol}.name`.
  - **Ticker-named companies still match:** "AMD" keeps AMD with either stored name (a row in the §2.4 test).

### 2.2 Every reader of the stored name

**Where the name is stored.** All three copies come from `metrics.name` (`stockMeasures.js:445`):
- `peerRankings/{sym}.name`: `compute-rankings.js:958`, `stock.metrics?.name || stock.ticker`.
- `peerRankings/{sym}.leaderboard[].name`: `compute-rankings.js:517`, `s.metrics.name || s.ticker`. Every document carries its sector's whole leaderboard.
- **A third copy, not in the prompt's list:** `metricSnapshots/{sym}/daily/{date}.metrics.name`. It comes from `compute-rankings.js:1223` (`metrics: stock.metrics`, the raw object) through `metricSnapshots.js:93-100`. **No code reads it.** `metricSnapshots.test.js` already uses real names in its fixtures (`:91`, `:213`) and passes unchanged.

**Not stored anywhere else (VERIFIED):**
- `sectorRankings/latest` and `scannerSummary/latest` hold sector names only (`compute-rankings.js:597`, `:860-884`).
- The scanner's in-memory `name: m.name` (`:701`, `:723`) is never persisted.
- `indexIntelligence/stockRankings`, the fundamentals mirror, copies no `name`. The `peerRankings` read in `compute-index-intelligence.js` (`:1300-1330`) takes `sectorName` and the ranks only, so `rankingSnapshots` has none either.

**Readers.** Each is VERIFIED at the line, except where marked.

| Reader | Reads | What it does with it | LLM prompt? |
|---|---|---|---|
| `api/_utils/sharedResearch/stepPrompt.js:329` `renderBuildUser` (via `companiesFor`, `api/forge/shared-research.js:144-147`, `:714`, `:720`) | `peerRankings.name` → `readNames` → `companiesOf().supported[].name` | **The thesis-builder prompt**: `SYM \| Name \| role \| relationship` for each supported company | **YES (stop; ruled go)** |
| `api/why-moving.js:62` (`buildWhyUserPrompt`), `:176`, `:256-257` | request body `name` | **The "why is it moving" prompt**: `${name \|\| symbol} (${symbol}) is up …`. Also the fallback text. | **YES (stop; ruled go)** |
| ↳ how the name gets there: `src/components/draft/CompeteTab.jsx:580` (in `SectorLeaderboard`, `:502`, rendered at `:1319`) → `AssetResearchModal.jsx:312-317` → `:1004` (`WhatsMoving`) and `:2164` → `WhyMovingPopup.jsx:322` | `leaderboard[].name` from `api/stocks/peer-rankings.js:60,85`, which spreads the whole document | Opening a stock from the leaderboard sets `currentAsset.name` to the leaderboard name | (carrier) |
| `src/components/Research/AnalysisQATab.jsx:339` (from `AssetResearchModal.jsx:1024,1636,2003`, ASSUMED) | `currentAsset.name`, the same chain | `{COMPANY}` in the question sent to `/api/ai-advisor`, used only when `profile?.Name` is missing | **YES, fallback only (stop; ruled go)** |
| `api/_utils/sharedResearch/stepSchema.js:466-480` (`identityOf`); `thesisSchema.js:381-386` | `names[symbol]` from `readNames` | Checks the model's output: keeps or drops the symbol (`identity_mismatch` / `identity_unnamed`) | validates a model's output; no prompt text |
| `api/_utils/sharedResearch/companies.js:68-75` `namesCompany`, `:88-96` `isSameCompany`, `:135`, `:151` `companiesOf` | the `names` map | Matching; `supported[].name` and `leads[].name` in every route answer | no |
| `thesisSchema.js:548-552` `unsourcedLineOf` | `names[s]` when it differs from `s` | Partner reply text: "No Source-backed reason was found for NVIDIA Corporation (NVDA) yet…" | no (reply text shown to the player) |
| `adoptPreview.js:90-93` `fragmentOf`; `thesis.js:421`; `store.js:753` | `supported[].name` | Draft statement text; a save check; the confirm line "Saved as an idea · {names} · …" | no |
| `store.js:303-311` `readRankingRows` → `opening.js:206-209` `storedRowsOf` → `src/components/SharedResearch/screens/Work.jsx:41` | `peerRankings.name` | The opening's stored rows: "Name · SYM" when the name differs from the symbol | no |
| `src/components/SharedResearch/sharedResearchView.js:244-247` (and `:216`, `:222`, `:254`, ASSUMED) | the preview's `c.name` | Client-side matching and Save gating, the mirror of `namesCompany` | no |
| `CompeteTab.jsx:607` | `leaderboard[].name` | Display label in the sector leaderboard row | no |
| `CompeteTab.jsx:297` | the endpoint's `data.name` | `TICKER · Name` when they differ. Dead code: `CompositeRankCard` is never rendered (census; ASSUMED). | no |
| `src/components/draft/SectorTab.jsx:114` | the endpoint's `peerData.name` | "{name} is #{rank} of {total} peers" | no |
| Other SharedResearch screens (`parts.jsx`, `builderParts.jsx`, `screens/Adopt.jsx`): ASSUMED (census) | `supported/leads[].name` | Display and aria labels | no |

**One indirect path into a fenced file (not a read of the name).**
- The ledger's default statement is drafted by `fragmentOf`, which can write "{name}: …".
- If the player saves it, the statement is stored on the hypothesis version (`store.js:783-794`, ASSUMED).
- The fenced `agentBattleService.js:222` then copies `equippedHypothesis.statement` into the battle document (VERIFIED). This build calls it nowhere and edits nothing in it.
- **Nothing reads that field (VERIFIED by search).** The only read of `equippedHypothesis.statement` in `api/` and `src/` is that copy.
  - The fenced evaluation prompt does read a `statement` in two places (`agentEvalPromptAssembly.js:1008`, `:1051-1088`). Those are a constraint's carve-out and the Vision thesis, not the saved idea.
  - The battle's other readers of `equippedHypothesis` take ids only (`activationEvidence/pointer.js:64`, `callRecords/candidate.js:216`, `hypothesisRecords/review.js:107`).
- The text is fixed when the player saves it.

**Longer names in the partner's reply (checked, harmless).**
- `unsourcedLineOf` (`thesisSchema.js:548-552`) names the companies, and the partner's reply is cut to make room for it (`:525-526`).
- Measured with four long names (the card holds at most four): the line grows from 109 to 221 characters. The reply limit is 600 (`src/constants/sharedResearch.js:158`), and the model's own reply is already capped at 320 (`thesisSchema.js:56`).
- So 320 + 1 + 221 = 542 fits, and no reply is cut further.

**Checked, and found not to read a stock name:**
- `decide.js:1266` reads `stock.name || symbol` from `stockRankings` entries, which have no `name`, so it always gets the ticker.
- `agentSwapExecution.js` gets its asset names from the same place (census).
- The ledger step prompt and the frame prompt (`stepPrompt.js`: only `:329` renders a stored name).
- `api/stocks/analysis.js`, `api/agent/research.js`, `voice-layer-cache.js`, `screener/chat.js`, `generate-column.js` (sector names only), `fundamentalsRender.js`, `cockpit-bench.js`, `scouting-board.js` (census; ASSUMED except `generate-column`'s sector read).
- The Wire surface's 25 modules (`wireGenerationSurface.js:61-104`): none reads `peerRankings`, a leaderboard, `readNames` or `companiesOf` (VERIFIED by search).

### 2.3 How big the effect was (production, read only, before the fix)

All Work an idea records were read: there are only **6** (origin `shared_research`, created 16 to 25 Nov), so "at most 50" took all of them.

| Count | |
|---|---|
| Current findings (superseded ones left out) | 173 (222 counting superseded) |
| Current findings that carry a symbol | **10**: 4 coverage, 6 earnings facts |
| Current company facts (relationship and product findings) | **38**, of which **0** carry a symbol |
| Supported companies (`companiesOf`) | **0** |
| Company leads | **15**, all **15** `identity_unresolved` (the flag is computed when the record is read, `companies.js:159`, by the real `companiesOf`) |
| Stored names read for these records | 4, all 4 equal to the ticker |

**Step notes.**
- The stored step outcome does not keep the validator's notes. `recordStep` (`store.js:579-604`) keeps only `summaryWithheld`.
- The notes are kept in one place only: `validationNotes` on each model-call record in the Cloud Storage shadow log (`shared-research.js:117-127`, the `conversations` stream).
- All 48 objects for 16 to 27 Nov were read, and counts were taken. That stream also carries other chat routes; nothing from them was printed.

| Count | |
|---|---|
| Work an idea model calls / completed steps (all 6 records) | 43 / 35 |
| Completed steps with any validator note | 19 |
| Completed steps with an `identity_mismatch` | **14**, holding **76** `identity_mismatch` notes in all |
| ... distinct game stocks among them / distinct record-and-stock pairs / records affected | **7** / 8 / 3 of 6 |
| `identity_unnamed` notes | **0** |

**In plain words.**
- Of the 38 recent facts about a company, **none carries its company**.
  - Some may be about companies outside the 228, which never could.
  - The rest lost it to the name check.
- The name check threw a game stock away **76 times**, across 7 different game stocks.
- A note does not say whether it came from a finding or from a company entry (both run the check, `stepSchema.js:499`, `:507`), so 76 counts checks, not facts.
- The log keeps the ticker, not the name the partner wrote. So it can't show whether every one of the 7 matches a real name; a partner who wrote "Google" for Alphabet would still miss.

### 2.4 The effect, proved in a test before any fix (committed first: `d122ef9d`)

`api/_utils/sharedResearch/storedName.identity.test.js`, 6 rows, passing on `main` and after the fix. Each row stores a `peerRankings/{symbol}` document in the in-memory store, then runs the real `readNames` → `validateStepTurn` → `companiesOf`:

- **"NVIDIA", candidate NVDA:**
  - stored "NVIDIA Corporation" → a verified relationship with symbol NVDA, no identity note, and NVIDIA supported;
  - stored "NVDA" → symbol null, `identity_mismatch:NVDA`, and NVIDIA only an `identity_unresolved` lead.
- **"Microsoft said Azure grew", no company named:** kept with "Microsoft Corporation"; with "MSFT", dropped as `identity_unnamed:MSFT`.
- **"AMD":** kept with either stored name.

---

## 3. What was built (build prompt §3)

Every change, by `file:line` at the branch head:

| File | Change |
|---|---|
| `api/_utils/stockMeasures.js:51` | **The fix.** `name: [data['General::Name'], data.General?.Name].map((v) => (typeof v === 'string' ? v.trim() : '')).find(Boolean) \|\| ticker,` |
| `api/_utils/stockMeasures.js:15-19`, `:35-37` | Comments only. The header sentence and the JSDoc that called the name "always the ticker" and the return statement "unchanged" would be false now, so they say what changed. |
| `api/_utils/researchMeasures.js:177-178` | **One home.** `name: shaped.name !== symbol ? shaped.name : (researchNameOf(symbol) ?? symbol),`. `fundamentalsNameOf` is deleted (it was `:164-168`). |
| `api/_utils/__fixtures__/stockMeasures.golden.json` | 6 lines, the `name` of three cases (§3.2) |
| `api/cron/compute-rankings.measuresGolden.test.js:12-16`, `:65-67` | A header note on the regeneration, and two branch rows: the name from `"General::Name"` in the three cases, and from `General.Name` in `full-xlk` |
| `api/_utils/stockMeasures.test.js:81-112` | The name from the three places, in order |
| `api/_utils/researchMeasures.test.js:114-155` | The pin before the change (`3089f6c8`) and one home |
| `api/_utils/sharedResearch/storedName.identity.test.js` | The §2.4 test (`d122ef9d`) and the chain row (`:117-144`) |

Fenced functions called: none. Fenced files edited: none. Nothing outside the rankings job's shaping and the research record changes.

### 3.1 The fix

- **The order is the prompt's:** the top-level `"General::Name"` key, then `General.Name`, then the ticker.
- **A name must be a non-blank string, and it is trimmed.** A bare `||` (the plainest reading of the prompt) would store a blank or non-string value as the name. That is mutant M5 in §4, and the rows kill it.
- **The one difference from what `researchMeasures.js` accepted before.** The old `??` stopped at a top-level key that was present but blank or not a string; the new line goes on to `General.Name`. They differ only when the key holds no name **and** `General.Name` holds one, a shape the filter never returns.

### 3.2 The golden: `name` is the only field that moved

- **The control.** The regenerator runs every case through the rankings job's own path (`fetchSingleFundamental` with `fetch` stubbed, then `extractMetrics`) and writes the file in its committed format. Run on the unchanged tree, it reproduced the committed golden **byte for byte**.
- **After the fix, a field-by-field comparison of the decoded goldens finds exactly 6 differing values:**

| Case | Field | Before | After |
|---|---|---|---|
| `financial-no-history` (JPM) | `shaped.name`, `metrics.name` | `"JPM"` | `"JPMorgan Chase & Co"` |
| `research-stock-short-history` (GLW) | `shaped.name`, `metrics.name` | `"GLW"` | `"Corning Incorporated"` |
| `no-history-unknown-sector` (ANET) | `shaped.name`, `metrics.name` | `"ANET"` | `"Arista Networks Inc"` |

- **Nothing else moved.** That includes every number, every request URL, every log line, the 12 other cases, and the failure.
- `full-xlk`, which carries `General.Name` ("Apple Inc"), did not move. That proves the order.
- `capturedFrom` is unchanged. The git diff of the file is the same 6 lines.

### 3.3 One home for the name

- **What changed.** Before, `researchMeasures.js` read the name itself, because the shaper's was always the ticker (Build 2, Q-5). The record now takes the shaper's name, and the directory's name when the shaper returns the ticker.
- **The pin.** Committed before the change and passing after it (`3089f6c8`): for GLW, ANET and TSM, the record's name is the response name as given or trimmed. It is the directory name when the response name is absent, empty, blank or not a string. It is `General.Name` when the top-level key is absent, and the top-level key when both are present.
- **So the stored research record does not change for GLW, ANET or TSM.**
- **The one deliberate difference.** A response whose name *is* the ticker now gets the directory's name, as the prompt asks. Before, the record would have kept the ticker. None of the three has such a name: GLW is stored as "Corning Incorporated" (Build 2 §7.2), and the directory holds "Arista Networks" and "Taiwan Semiconductor Manufacturing".

### 3.4 Left alone

- **The stale wording.** "~220 S&P 500 stocks" in `api/stocks/peer-rankings.js` and `src/components/draft/CompeteTab.jsx` is left, as the prompt says.
- **No fallback name for the 228** while production still holds tickers. The next weekday rankings run rewrites every name.
- **Out of scope and untouched:** `ProfitMarginTTM`, `ShortPercentOfFloat`, ranking, scoring, the scanner, any cron schedule, `rankingConfig.js`, and every fenced file.

---

## 4. Tests (build prompt §4)

**Rows that failed on the unfixed code** (run at `3089f6c8` with the rows in place, before the fix):

| Row | File | Failure on the unfixed code |
|---|---|---|
| The top-level key first, and it wins over `General.Name` | `stockMeasures.test.js` | name was the ticker |
| Then the ticker when neither place holds a name | `stockMeasures.test.js` | a blank or non-string `General.Name` came through |
| A name is trimmed | `stockMeasures.test.js` | not trimmed |
| The record name is the name the shaping returns | `researchMeasures.test.js` | the shaper returned the ticker |
| The directory's name when the shaping returns the ticker | `researchMeasures.test.js` | a ticker-as-name response stored the ticker |
| `researchMeasures.js` reads no name from the response itself | `researchMeasures.test.js` | it read `General::Name` |
| The rankings job's own name reaches the step validator | `storedName.identity.test.js` | `expected 'NVDA' to be 'NVIDIA Corporation'` |

**Rows that pass both before and after, by design:**
- the §2.4 test (6 rows);
- the GLW/ANET/TSM pin (3 rows);
- "then `General.Name`" and "only the name reads either place" (`stockMeasures.test.js`);
- the stored-name expressions of the rankings job (`storedName.identity.test.js`, a text pin on `compute-rankings.js:517` and `:958`).

**Mutation battery** (`stockMeasures.js` and `researchMeasures.js`). Each mutant ran the four test files; each file was restored from `HEAD` and checked byte-identical afterwards. **8 of 8 killed**, judged by exit code and failing rows:

| Mutant | Rows that failed |
|---|---|
| M1 the old line (`General.Name` only) | 14: the three golden cases (×2 files), the GLW/ANET/TSM pin, the three places, the chain row, one home |
| M2 `General.Name` before the top-level key | 4: "the top-level key wins", the pin |
| M3 no trim | 6 |
| M4 no string check | 5 |
| M5 a bare `\|\|` | 6 |
| M6 the record has no directory fallback | 5 |
| M7 the record ignores the shaper | 4 |
| M8 the record reads the response itself again | 5: including the source row |

**Named pins, unchanged and passing:**
- `rankingConfig.test.js`
- `compute-rankings.beatRateSource.test.js`
- `compute-index-intelligence.fundamentalsMirror.test.js`
- `metricSnapshots.test.js`
- `wireGenerationSurface.test.js` (on Linux; §5)
- the research-universe tests: `researchUniverse*.test.js`, `researchDirectory.test.js`, `researchMeasures*.test.js`, `scripts/research-stock.test.js`, `scripts/build-research-directory.test.js`, `scripts/research-directory-corrections.test.js`
- the boundary test, `researchUniverse.boundary.test.js`, with no new allowance. No new file names the per-stock math module.

No test calls the provider or Firestore.

---

## 5. Verification

- **Full suite (Linux, WSL):** exit code **0**, asserted. `Test Files  1690 passed | 14 skipped (1704)`, `Tests  39376 passed | 197 skipped (39573)`, 570 s. Run with `npm run test:run -- --maxWorkers=8`, `TZ=UTC`, under the shared suite lock, in a fresh WSL worktree at `4697a3a0` (Node 20.20.2, an install matching the lockfile). `wireGenerationSurface.test.js` passed 19 of 19 there; the boundary test passed 30 of 30.
- **`lint:gate`:** exit 0, in the same tree.
- **Windows:** the targeted run (46 files, 1,357 rows) passed except the two content-lock rows of `wireGenerationSurface.test.js`. That is the known CRLF-checkout class (Build 2 §11.7). None of its files changed, and it passes on Linux.
- **Size:** 8 files (7 code and test files, plus this report), 244 insertions and 18 deletions in code and tests. That is under the review threshold of BUILD_RULES §2 (10 files or 1,500 lines), so no multi-lens review was required. The change has no `src/` file, so no `vite build` was run.
- **Crons do not run on Vercel preview.** The name is proven by the golden and the chain row. The first real proof is the first scheduled production run after deploy: reading `peerRankings/NVDA.name` then should give "NVIDIA Corporation".

---

## 6. Stopped on a ruling

| # | Question | Ruling / as built |
|---|---|---|
| **Q-1** | **The stored name reaches three LLM prompts** (§2.2): Work an idea's thesis builder (`stepPrompt.js:329`), "why is it moving" (`why-moving.js:62`), and the advisor questions' `{COMPANY}` fallback (`AnalysisQATab.jsx:339`). The fix changes the text all three send, from the ticker to the company's name. | **Founder: "Yes, build it."** Built as drafted; none of the three is edited. |
| Q-2 | **`metricSnapshots` keeps a copy of the name** (`compute-rankings.js:1223`). It is not in the prompt's list, and nothing reads it. | Left as it is. From the first run after deploy it holds the real name, like `peerRankings`. |

---

## 7. Found outside the task (reported, not fixed; BUILD_RULES §3)

1. **Work an idea's stored rows never show a sector.**
   - `readRankingRows` reads `peerRankings/{sym}.sector` (`store.js:310`).
   - The rankings job writes `sectorId` and `sectorName`, never `sector` (`compute-rankings.js:956-1012`).
   - So `storedRows[].peer.sector` is always null, and `Work.jsx:41` never shows one.
2. **`readRankingRows` also reads a top-level `stockRankings/{sym}` collection** (`store.js:306`). The census found no writer for it (ASSUMED), so its ranking part is likely always empty.
3. **The validator's identity notes don't say which check dropped a symbol:** the finding or the company entry (`stepSchema.js:499`, `:507`, `:624`). So the log can't count lost facts exactly (§2.3).
4. **A pre-existing lint error** in a full `eslint` run (not `lint:gate`): `stockMeasures.js` `extractBalanceSheetMetrics`' unused `sectorId` parameter. Build 2 §2.2 recorded it. This build only moved its line number.

---

*Report path: `docs/audits/20261127_BUILD_COMPANY_NAMES.md`. A copy is in the session scratchpad.*
