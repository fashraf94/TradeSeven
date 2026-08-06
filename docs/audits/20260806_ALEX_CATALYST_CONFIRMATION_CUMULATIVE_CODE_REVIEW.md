# Alex Catalyst Confirmation mini-arc — Cumulative Code Review (BUILD_RULES §2)

**Arc:** Alex Catalyst Confirmation, spec V1.1 (C9-downgraded) · **Branch:** `claude/catalyst-confirmation-spec-v1-w2kxzs`
**Reviewed HEAD:** `855e4d51` (base `origin/main`) · **Date:** Aug 6, 2026

## Why this review ran

The cumulative branch diff spans ~16 files / ~620 lines — over the BUILD_RULES §2 threshold (≥10 files OR ≥1500 lines), so a **multi-lens, independently-verified, build-checked, mutation-checked, written-down** review was mandatory.

- **Multi-lens & adversarial:** a 7-lens read-only workflow (F1 CAS correctness · F1 wiring · F3 units · F2/flag-dark · C1 structural · test integrity · version/fence).
- **Independently verified:** every finding was handed to a separate adversarial verifier instructed to **refute it with a concrete repro** (default REFUTED when uncertain). 12 agents total (7 finders + 5 verifiers), 0 errors.
- **Build:** explicit `vite build` — green (only the pre-existing chunk-size warning).
- **Mutation-checked:** the version gate was shown red-then-green; the units mutation guards were themselves found vacuous and rewritten (finding U-4).
- **Result:** **8 findings, all 8 CONFIRMED, 0 REFUTED. All 8 fixed on-branch.**

## Verdict table

| # | Sev | Lens | Finding | Verdict | Disposition |
|---|-----|------|---------|---------|-------------|
| U-1 | HIGH | F3 units | `CURRENCY_ATTACHED_POINTS` false-positives on "$X … point" idioms ("price point", "at one point", hyphenated "basis-points") → silently holds legit prose | CONFIRMED | **Fixed** — replaced the 40-char-window+lookbehind pattern with an adjacency pattern (`unitsLint.js`) |
| U-2 | MED | F3 units | Belt didn't lint the model-authored `pullquote` field → an invented "$20 BaggerBomb Points" pullquote publishes | CONFIRMED | **Fixed** — `lintStoryUnits` covers pullquote; call site passes it (`generate-mover.js`) |
| U-3 | MED | version/fence | `exaCatalystFetch.js` renders prompt text unconditionally but was absent from `GENERATION_SURFACE` (ingestedClaims false-negative class) | CONFIRMED | **Fixed** — added to the manifest; `WIRE_GENERATION_VERSION` 14→15 + baseline regen |
| U-4 | MED | test integrity | The "percentage points" mutation guard was vacuous (the negative row's 41-char gap exceeded the window, so the lookbehind was never exercised) | CONFIRMED | **Fixed** — U-1 rewrite removes the lookbehind; R5 rows now defend the adjacency boundary with real mutation guards |
| U-5 | LOW | F1 CAS | An overlapping invocation seconds after arming could confirm a candidate born the same tick, collapsing the two-tick persistence window | CONFIRMED | **Fixed** — `armedAtMs` + a `minConfirmAgeMs` (5 min) guard; candidate must be armed on an earlier pass to confirm |
| U-6 | LOW | F1 wiring | `runMoverScan` lost the old handler's per-symbol fault isolation → one transient DB error aborts the whole tick | CONFIRMED | **Fixed** — per-symbol try/catch in both loops; errors collected, loop continues |
| U-7 | LOW | F3 units | `NUMERAL_BAGGERBOMB_POINTS` was case-sensitive → "20 BAGGERBOMB POINTS" slipped | CONFIRMED | **Fixed** — `i` flag on both patterns |
| U-8 | LOW | test integrity | scan-movers dedup test carried dead setup (lines exercised by nothing) | CONFIRMED | **Fixed** — dead block removed; test drives the real path |

No CRITICAL findings. F2/flag-dark and C1 structural lenses returned **zero findings** (the flag-off zero-dependency guarantee, the degrade chain, and the prose-channel-only boundary all held under adversarial probing).

## Fix detail + repro-that-was-closed

- **U-1 / U-4 (units false-positives, the load-bearing one).** Verifier repro: `lintUnits('Shares were up $12 at one point during the session.')` → `held:true` (wrong); `'GOOGL defended its $2,910 price point'` → held; `'…25 basis-points move'` → held (a hyphen defeats the whitespace lookbehind). Root cause: a wide "$…points within 40 chars + exclusions" pattern is unsafe in financial prose (full of "price point", "at one point", "300 points", "percentage/basis points"). **Fix:** detect the collision by **adjacency** — a currency figure directly labeled points (`/\$\s?\d[\d.,]*\s+(?:BaggerBomb\s+)?points?\b/i`) — which is airtight (dollars are never points) and needs no idiom denylist. The R5 negatives now include the exact false-positive rows and pass; the mutation guards prove adjacency is load-bearing. **Deviation from spec F3 recorded in the register** (the spec sketched the wide pattern; it false-positives, and a hold is expensive).
- **U-2 (pullquote).** `pullquote` is a free-text field the prompt asks the model to make dramatic — the exact place an invented figure lands — and it is persisted + rendered. Now linted.
- **U-3 (surface membership).** `renderRetrievalChannelsBlock` splices into `userMessage` even when `EXA_RETRIEVAL_ENABLED` is false, so its template shapes the reporter prompt. Listed; the transport (`exaClient.js`) and runtime results stay off-manifest (the sonar.js runtime-data precedent).
- **U-5 (two-tick persistence under overlap).** `createdAt` was written but never read. Repro: arm at 14:00:00, an out-of-band invocation at 14:00:05 confirmed immediately. **Fix:** confirmation is gated on `armedAtMs` being ≥ 5 min old (well below the 15-min cadence, well above any double-invocation). New regression test asserts the overlap leaves the candidate pending and a real next tick confirms.
- **U-6 (fault isolation).** Repro: a `DEADLINE_EXCEEDED` from `hasRecentStory` for one symbol aborted the entire pass (500), arming no other symbol. **Fix:** per-symbol try/catch; new test asserts a healthy sibling still confirms.

## Evidence

- Full `api/` suite: **264 files, 4898 passed, 2 skipped, 0 failed** (post-fix; +6 tests vs. pre-review).
- `vite build`: green.
- Version gate (R6): surface lock shown **red** before the bump, **green** after (13→14→15).
- New/changed tests: `moverCandidates.test.js` (13), `scan-movers.test.js` (9 incl. persistence + fault isolation), `unitsLint.test.js` (16 incl. false-positive negatives + case + pullquote), `moverTypedFacts.boundary.test.js` (6), `exaCatalystFetch.test.js` (9).

## Register additions (report-don't-fix)

- **F3 pattern deviation** — the spec's wide pattern-1 + lookbehind design false-positives on financial idioms; implemented the tighter adjacency belt instead. Semantic collisions no regex sees remain the editorial rubric's job.
- **EXCLUDED_DOMAINS** in `exaCatalystFetch.js` is a starter denylist; extend from production observation.
- **Last-tick candidates** armed in the final scan of the day never get a T+1 within the cron window; they expire next-day via flush — inherent to two-tick on a bounded window.

---
*Written per BUILD_RULES §2. Precedent: `docs/audits/20260730_DELIGHT_STARFIELD_CUMULATIVE_CODE_REVIEW.md`.*
