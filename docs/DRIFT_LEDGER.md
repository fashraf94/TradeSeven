# Drift Ledger

Pre-existing bugs and display/behaviour drift found **incidentally during builds** and
deferred to **separate tasking** (BUILD_RULES §3: "Found a bug outside your task? Report
it for separate tasking; do not fix it."). Each entry is a report, not a backlog commitment —
it states the drift, the `file:line`, why it wasn't fixed in the finding PR, and the fix seam.

---

## D-1 — Deploy-success toast renders with the RED error style

**Found:** Deploy Ceremony Phase 2 (client) Phase 0 discovery, 2026-07-23.
**Where:** `src/App.jsx:6583` — the deploy-success path calls
`showToast(\`Agent deployed to BaggerBomb! 🤖💣\`)` with **no `type` argument**.
`showToast(message, type = 'error')` (`src/App.jsx:2502-2505`) defaults `type` to `'error'`,
and the toast render (`src/App.jsx:12012-12034`) paints `'error'` with the red background
`#ff4757` (the green success style `#00ff88` is only used when `type === 'success'`). So the
**success** toast renders red.

**Impact:** cosmetic — a successful deploy shows a success message in the error color.
**Why not fixed in the ceremony PR:** this sits on the **flag-OFF** deploy path, which the
Deploy Ceremony smoke checklist (spec §11) requires to remain **byte-identical to `main`**.
Passing `type='success'` would change flag-off behaviour. (Under the flag-ON ceremony this
toast is suppressed entirely — the reveal is the confirmation — so the ceremony sidesteps it.)
**Fix seam (separate task):** pass `type='success'` at `App.jsx:6583`.

---

## D-2 — Deploy-success toast copy hard-codes "BaggerBomb", diverging from `deployText`

**Found:** Deploy Ceremony Phase 2 (client) Phase 0 discovery, 2026-07-23.
**Where:** `src/App.jsx:6583` hard-codes `Agent deployed to BaggerBomb! 🤖💣` regardless of the
agent's maturity, while the deploy button's label `deployText` (`src/hooks/useAgent.js:93-101`)
returns `'Deploy'` (veteran) / `'Deploy — I know the playbook'` (maturing) — neither says
"BaggerBomb". Button and success toast disagree for veteran/maturing agents.

**Impact:** minor copy inconsistency.
**Why not fixed in the ceremony PR:** same flag-OFF byte-identical constraint as D-1 (spec §11).
**Fix seam (separate task):** align the toast copy with `deployText` (or a maturity-aware string)
at `App.jsx:6583`. As with D-1, the flag-ON ceremony suppresses this toast.


## D-3 — Wire A2 remap overwrites correct `subjectRef`s at Kai's `index_move` seam — ✅ RESOLVED (branch `claude/wire-d3-subjectref-remap`, pre-`WIRE_WRITES`)

**Resolution (Jul 31, 2026):** fixed at the **seam** (chosen over the validator — reasoning below).
`api/fantasytimes/generate-pulse.js` now nulls the WIRE `primaryTicker` for cardinality-0 eventTypes
(`EVENT_CONTRACTS[type].tickers[1] === 0`, i.e. `index_move`) before calling `publishStoryWithWire`, so
the A2 remap has no operand and the model's `subjectRef` stands. The validator's A2 remap is **left
intact** — it is correct for any caller passing a genuine single index-ETF `primaryTicker`; the defect
was that the pulse seam fed it a "the market" proxy for a subject-less event, which only the seam has the
context to know. `WIRE_GENERATION_VERSION` 11 → 12 (generate-pulse.js is a manifest member; conservative
file-level bump — the outbound model request is unchanged, M8 intact). A6 regression
(`api/fantasytimes/generatePulse.d3.test.js`): Dow-led→DJI survives, Nasdaq-led→NDX survives, faithful
SPX still passes, genuine QQQ primaryTicker still remaps (validator), seam does not over-null — proven red
under the pre-fix line. Original disposition retained below.

**Found:** FantasyTimes Wire N2 exemplar qualification (N2.1), 2026-07-31. Full disposition:
`docs/audits/20260731_WIRE_N2_EXEMPLAR_QUALIFICATION_AND_EMBED.md` (Defect D-3).
**Where:** the Kai pulse seam sets `storyDoc.primaryTicker` from the model's `storyData.primaryTicker`
— typically **SPY meaning "the market,"** not "the S&P is the subject" (`api/fantasytimes/generate-pulse.js:354,391`).
It is passed as `primaryTickerRaw` to the validator (`api/_utils/wireWriteThrough.js:115`), where the
A2 internal-consistency remap (`api/_utils/wireValidator.js:214-224`) maps `ETF_TO_INDEX['SPY']='SPX'`
and **overwrites** a correctly model-emitted `subjectRef` (e.g. `NDX` on a tech-led pulse) to `SPX`
(`S1_SUBJECT_REMAPPED`). But `index_move` is **cardinality-0** — it has no primary ticker to be
consistent with, so the remap operand is meaningless.

**Impact:** any non-S&P-led pulse (Nasdaq/Dow/Russell) is silently relabeled `SPX` in persisted facts
and the digest. **Harmless while `WIRE_WRITES` is OFF** (nothing persists); **fatal once it flips** — it
contradicts the embedded NDX exemplar (N2) and writes a wrong-subject `index_move`, a period-fatal
Phase-3 gate criterion (N3.4).
**Why not fixed in the N2 PR:** N2 is exemplars-only on its own branch (Spec V1.2 §4 step 2). A2 is a
V1.6 amendment; changing it is validation-behavior work needing its own branch/review and an epoch
input (`WIRE_VALIDATOR_VERSION` or `WIRE_GENERATION_VERSION`) that must settle **before** the baseline
window opens.
**Fix seam (pre-runway task):** honor the cardinality-0 rule — `primaryTicker` is **null on `index_move`**.
Either pass `primaryTicker=null` to `publishStoryWithWire` when the emitted `eventType` is `index_move`
(seam), or skip the A2 `ETF_TO_INDEX` remap for cardinality-0 eventTypes (validator; the remap fires only
for `model_required` subjectRef, i.e. `index_move`, so its premise is always broken). Regression: a
Nasdaq-led pulse keeps `NDX`, a Dow-led pulse keeps `DJI`, a genuine S&P pulse still renders `SPX`.
**Owner:** Wire arc, pre-runway. Recorded Jul 31, 2026.

---

## D-4 — Wire Kim `sector_vs_spy` has no SPY operand at the S7 seam — ✅ RULED (A), post-gate (2026-08-12)

**Ruling (Aug 12, 2026):** founder confirms **Option (A)** — thread a SPY operand into the S7 snapshot
so `sector_vs_spy` is computed and verified — and accepts the decision memo's scope correction: (A) is a
coordinated epoch change (snapshot shape → §1 shape-photograph re-issue + `WIRE_GENERATION_VERSION`;
adapter formula + tolerance → `WIRE_EDITORIAL_ADAPTER_VERSION` + two-period-window reset; sector
entity-resolution reaching the validator → likely `WIRE_VALIDATOR_VERSION`), **not** the single-file
snapshot touch the original one-liner implied. **Deferred post-gate** — both options reset the two-period
window, so the fix waits until the Phase-2 editorial gate has qualified on the current 11-exemplar set; it
then lands as its own arc together with Kim's deferred v2 exemplar embed. First step when unblocked: a
Phase-0 discovery on the entity-resolution fork (sector `subjectRef` enum vs single-sector `primaryTicker`),
which decides whether the validator is in scope. **No code written at ruling — scheduling only.** Decision
memo: `docs/audits/20260812_WIRE_D4_SECTOR_VS_SPY_DECISION_MEMO.md`. Original finding retained below.

**Found:** FantasyTimes Wire N2 exemplar qualification (N2.1), 2026-07-31. Full memo (two options,
recommendation): `docs/audits/20260731_WIRE_N2_EXEMPLAR_QUALIFICATION_AND_EMBED.md` (Defect D-4).
**Where:** Kim's `sector_rotation` magnitude basis is `sector_vs_spy` (a sector's move relative to SPY),
but the S7 sector-column snapshot carries **no SPY operand at rest** — the deterministic adapter returns
NOT_VERIFIABLE and the value a reporter would populate is the sector's **raw daily change**, not a vs-SPY
figure. The basis cannot be truthfully populated at this seam.

**Impact:** Kim's only magnitude basis is un-verifiable and, if populated, mislabels a raw move as
vs-SPY. **This is why kim embeds zero exemplars in N2 v1** (honesty rule — no teaching a false basis at a
gate-silent seam). No production corruption today (writes off; Kim's typed facts are gate-silent by design).
**Why not fixed in the N2 PR:** it is a **founder decision**, not a mechanical fix — (A) thread a SPY
operand into the S7 snapshot so the basis becomes real (adapter/generation-surface cost, post-gate), or
(B) retire `sector_vs_spy` for a basis the seam actually has (contract-vocabulary cost). Priority **below
D-3**.
**Owner:** Wire arc, post-gate. Recorded Jul 31, 2026.

---

S5 "News-Catalyst Momentum" — decided dissolved, still live. Regime Revamp dissolved news-as-entry-signal; at HEAD dd28eedf, S5 ships in both game-mode variants of the eval system prompt (agentEvalPromptAssembly.js:154-159, 376-380), directing entries on positive-sentiment FantasyTimes stories and exits on negative. Retirement is scoped into FantasyTimes Wire Phase 3. Until then, live behavior contradicts locked design. Owner: Wire arc. Recorded Jul 24, 2026.

---

## D-5 — `.firebaserc` absent: no committed prod project alias (the deployed-rules gate must name the project)

**Found:** V1.6 A7 deployed-ruleset gate feasibility pass, 2026-08-11. Registered by founder instruction.
**Where:** repo root — **there is no `.firebaserc`**. `firebase.json` declares `firestore.rules` / `firestore.indexes.json` but no project. The only Firestore project ids committed anywhere are the demo/test ones the emulator suites pin in-file (`demo-tradeseven-rules`, `demo-tradeseven-rules-test`, `demo-preview`); the **production** project id is not in the repo.
**Impact:** any `firebase` command that must resolve a project — fetching the **DEPLOYED** ruleset for the A7 run, `deploy`, `firestore:*` — has no default target and must be given one explicitly (`--project <PROD_ID>`, or an authed `firebase use`). This is one of the two reasons the A7 deployed-ruleset run **cannot execute in the CC harness** (the other: no credentials — `firebase login:list` → none; empty configstore; no `FIREBASE_TOKEN` / `GOOGLE_APPLICATION_CREDENTIALS`). The deployed run is therefore the **pre-flip founder action** (FantasyTimes Wire Spec V1.6 A5-1 / A7). The emulator smoke suites are unaffected — they hardcode the demo project id.
**Why not "fixed":** committing a `.firebaserc` binds a specific production project into the repo — a founder/ops decision, and one that may be withheld deliberately. Not created unilaterally.
**Fix seam (founder decision):** either commit `.firebaserc` with the prod alias, or codify `--project <PROD_ID>` as a standing step in the Wire deployed-rules runbook. Until then, the deployed-run command must name the project. Referenced from `test/rules/wireDenials.rules.mjs` (rules-text loader note).
**Owner:** Wire arc / ops. Recorded Aug 11, 2026.

---

## D-6 — A7 deployed-ruleset run is not independently runnable — needs a JVM (founder machine) or a credentialed CI job

**Found:** V1.6 A7 deployed-ruleset gate resolution, 2026-08-11. Registered by founder instruction. Full record: `docs/audits/20260811_WIRE_A7_DEPLOYED_RULESET_GATE_RESOLUTION.md`.
**Where/what:** the deployed-ruleset run — executing `test/rules/wireDenials.rules.mjs` (and its siblings) against the **fetched live** rules text in the Firestore emulator — requires BOTH (a) the Firestore emulator, i.e. a **JVM**, and (b) fetching the deployed text, i.e. **prod credentials + project id**. No single environment currently has both: the CC harness has a JVM but no creds/project (D-5); the founder's Windows machine has console/credential access but no JVM.
**Impact:** A7's deployed run is satisfiable today only by **provenance** (verbatim console publish + repo-ruleset suite run), not by an independent emulator execution of fetched deployed text. That is adequate for a **verbatim** publish (live = repo by construction; the 2026-08-11 gate was resolved this way), but a future deploy whose console text diverged from the repo (hand-edit, transform) could **not** be caught this way.
**Fix seam:** either (a) install a JVM on the founder's machine — then `COMPOSITION_RULES_TEXT_PATH=<fetched> npm run test:rules` runs locally; or (b) stand up a CI job with a service-account credential + project that fetches the deployed rules and runs the suite. The F-1 fix already makes the suite deployed-text-ready and self-proving (it prints the loaded text's sha256); only the **runner** is missing.
**Owner:** Wire arc / ops. Recorded Aug 11, 2026.

---

## D-7 — `compositionProtectedStores.scan.test.js` flakes over its 5 s timeout on a repo-wide AST scan

**Found:** Doug recap surprise-split fix, 2026-08-11 (full-suite run). Registered per §3 (found outside task; **not fixed here**).
**Where:** `api/_utils/compositionProtectedStores.scan.test.js:127-131` — the `#10` row calls `scanProtectedStoreWrites(REPO)` (`compositionProtectedStoresScan.js`), which acorn-parses **every non-test `.js` under `api/` + `scripts/`**. The `it` runs on the default **5000 ms** timeout.
**Impact:** the scan runtime has grown to **~4.6–5.1 s** as `main` accumulated merges, so it now flakes over the 5 s limit **on clean `main` (`d1dff398`) itself** — measured this session (clean tree timed out under sampling; my tree 4.8–5.1 s). The security **assertion** ("ZERO write-method extractions") still PASSES — only the timeout trips. **Not caused by the Doug diff:** test files are excluded from the scan (`compositionProtectedStoresScan.js:97`) and the change adds no write-method surface. It will intermittently red any PR's full-suite CI until the headroom is restored.
**Fix seam (separate task):** give the `#10` row an explicit generous timeout (e.g. `it(name, fn, 20000)`), or memoize the parse so the walk isn't re-run per assertion. A one-line timeout bump is the conservative unblock.
**Owner:** Composition / test-infra. Recorded Aug 11, 2026.

---

## D-8 — Neta's S3 econ recap has no same-day operand source (EODHD posts econ actuals with an hours→T+1 lag)

**Found:** S3 CPI `empty_window` diagnosis, 2026-08-12. CPI (July) printed 8:30 ET; the 9:30 ET recap logged `outcome=empty_window fetched=42 tier1=0`, and the founder's capture of the 8/12 window showed **0/35 rows carried an `actual`**.
**Where/what:** `api/_utils/fetchEconomicEventsEODHD.js` — the recap's sole operand source is EODHD `/economic-events`, which lists a scheduled release immediately but backfills `actual` with a multi-hour-to-next-day lag (fixture `api/_utils/__fixtures__/econCapture20260730.json`: that day's 8:30 ET PCE/GDP still `actual: null` at 16:06 ET). The matcher (`selectOperandRow`) is correct — type/comparison/date all match the observed feed; there is simply no number to match on release morning. Matcher/window/settle faults were all ruled out.
**Impact:** Neta rarely produces a **same-day** econ recap. The two-session window (`generate-econ.js:206-208`) recovers the release the **next** trading morning once EODHD posts, and referent dedup prevents a double-write — so S3's R9 liveness floor is still met, a day late. **Founder ruling (2026-08-12): ACCEPT next-morning recovery as the designed norm** — stale-but-accurate is the tradeoff; the same-day expectation was not the design's. (The R9-observability half of that ruling — the `actualsPresent` log token — shipped in the same PR as this entry.)
**Why not fixed here:** this PR is scoped to the observability change; a same-day source is a post-gate enhancement, not a matcher fix.
**Fix seam (separate task, post-gate):** add a same-day econ-actual source keyed to the macroCalendar release — **BLS direct** (the authoritative primary print) is the intended answer. **Sonar is explicitly NOT the source**: R-B1 replaced Sonar on the recap path for exactly this unreliability class, so reintroducing it would reopen the defect the mini-arc closed.
**Owner:** Wire arc / Neta S3. Recorded Aug 12, 2026.

---

## D-9 — `wireFlags.test.js` still pins metrics OFF after the `WIRE_METRICS_ENABLED` flip (reds full-suite CI)

**Found:** S3 R9-observability PR full-suite sweep, 2026-08-12. Registered per §3 (found outside task; **not fixed here** — this PR is scoped to the econ `actualsPresent` log token + its test; the metrics-flag pins are a separate flag-reconciliation concern).
**Where:** `api/_utils/wireFlags.test.js:13` (`all five Wire flags ship FALSE`) and `:22-25` (`getWireFlags reports everything off at HEAD`) both assert `metricsEnabled: false`, but `WIRE_METRICS_ENABLED` is `true` at HEAD (`src/config/featureFlags.js:1159`). The same file at `:73-76` already assumes metrics-ON, so the suite is internally inconsistent: the metrics rollout flip (`wireFlags.js` §4.8 step 1) reconciled some assertions but not these two.
**Impact:** 2 tests fail on **clean `origin/main`** (verified via `git show origin/main:…` — main carries both the `true` flag and the `false` pins), so the full-suite CI reds on every open PR. NOT caused by this diff (it touches none of `wireFlags.js` / `featureFlags.js` / `wireFlags.test.js`). The `flagPinGuard` (§2) missed it because these are `expect(getWireFlags()).toEqual({…})` / array-loop pins, not the guarded `expect(FLAG).toBe(…)` single-flag pattern.
**Fix seam (separate task):** update the two pins to metrics-ON (per the BUILD_RULES §2 flag-flip reconciliation the metrics flip owed), and optionally widen `flagPinGuard` to catch `getWireFlags()` object pins so this class can't drift silently again.
**Owner:** Wire arc / flags. Recorded Aug 12, 2026.
