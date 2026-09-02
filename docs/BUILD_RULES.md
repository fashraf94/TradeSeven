# BUILD_RULES.md — Operating Rules for Claude Code Sessions

**Status:** rules of record as of June 11, 2026. Updated only by founder-cited PRs.
**Setup:** the repo-root `CLAUDE.md` must contain the line: *"Before any task, read `docs/BUILD_RULES.md` — it is binding."* If `CLAUDE.md` doesn't exist, create it with that line (P0).

These rules encode hard-won lessons. Several were paid for with production bugs. Do not relitigate them mid-task; flag disagreements in your report and STOP.

---

## 1. The calibration fence

These files govern calibrated agent trading behavior. **Reading and calling their exported functions is permitted. Editing them is forbidden** outside the one sanctioned entry (Implementation Spec §1.4 / Phase P4, founder-gated, with the byte-identical tiered-mode invariant):

- `api/agent/decide.js`
- `api/_utils/agentSwapExecution.js`
- `api/_utils/agentScoring.js`
- `api/_utils/agentRiskManager.js`
- `api/_utils/agentArchetypeConfig.js` (contains the hftConfig blocks)
- `api/_utils/agentBattleService.js` (incl. the `createAgentBattle` doc shape)
- `api/_utils/agentPromptAssembly.js`
- `api/_utils/agentEvalPromptAssembly.js` *(added June 10, 2026 — founder decision)*
- `api/_utils/agentGuardrails.js` *(added July 24, 2026 — founder fence-list reconciliation; the DR-4 guardrail-binding compilation target: deterministic risk enforcement — `applyGuardrails` / `checkSectorCap` / stop + trailing firing. The Sector Cap Activation arc, which added the fenced-config read + the derived `DIVERSIFIER_SECTOR_CAP_PCT` here while this file was still non-fenced, is a DELIBERATE GRANDFATHERED EXCEPTION, not a precedent — edits here are now §7-gated fence contact.)*
- `api/_utils/archetypeScoring.js` *(added July 24, 2026 — founder fence-list reconciliation; the "scoring engine" concept named explicitly — `ARCHETYPE_WEIGHTS` / `ARCHETYPE_TEMPERATURES` / `ARCHETYPE_CONSTRAINTS`.)*
- `api/_utils/tournamentUserScoring.js` *(fenced as a scoring-engine concept — it verbatim-ports the fenced `decide.js` threshold math under a source-text tripwire — but OUT OF SCOPE for the archetype-program activation flags; listed for scoring integrity only.)*

The scoring engine and `createAgentBattle` document shape are fenced as concepts, not just files: changes that alter their behavior from non-fenced call sites are fence contact too. If your task seems to require fence contact that isn't in its prompt, **STOP and report** — never improvise it.

**Separate gate — the §2.3 import-boundary ratchet:** reading the fenced `agentArchetypeConfig.js` / `archetypeScoring.js` is §1-permitted, but a *new direct importer* of any legacy archetype table also trips the Spec §2.3 import-boundary ratchet — record the importer in `api/_utils/archetypeImportBoundaryBaseline.json` in the SAME commit. Satisfying this fence does not satisfy that ratchet.

**The flag-split prose rule (founder-ruled Jul 25 2026 — Fundamental Wire PR-A review, finding F2):** the DR-13 flag-split pattern (dark non-fenced render module + a one-import/one-call fenced splice) is the sanctioned way to add prompt content with a minimal fence diff — and it *deliberately moves prompt prose OUT of the fenced assemblers*, and therefore out of the C-20 prose-honesty sweep's original two-file scope. Any module that renders prompt text via the split MUST be added to `PROMPT_CONTRIBUTING_MODULES` (`api/_utils/__fixtures__/promptHonestyRegistry.js`) **in the same commit as the fenced splice**. The sweep's import-classification tripwire (`agentEvalPromptAssembly.honesty.test.js`) fails CI on any fenced-assembler import classified in neither registry list, so the omission cannot be silent.

**`EXA_RETRIEVAL_ENABLED` flips are fenced-review changes (FOUNDER DECISION 1 — `EXA_RETRIEVAL_INTEGRATION_SPEC_V1_4.md` §3 / §11, adopted at lock; codified 2026-08-19):** `EXA_RETRIEVAL_ENABLED` gates a fully assembled path from EXA-influenced mover generation into trading-agent prompts via `fantasyTimesStories` → `decide.js` → `agentPromptAssembly.js`. **Any flip of this flag is a §7-class agent-channel change requiring fenced-file review, regardless of which surface motivates the flip.** The flag itself lives in the non-fenced `featureFlags.js`, but the flip changes what reaches the §1-fenced assemblers (`decide.js`, `agentPromptAssembly.js`), so the ordinary "flag flips are one-line PRs" convenience (§2) does NOT apply — treat the flip as fence contact, with the fenced-file review that entails. The seam anchors are in the spec §3 and the Phase 0 audit; re-verify them at your HEAD before relying (lines drift).

## 2. Branch & merge discipline

- **One task = one branch, cut fresh from current `main`.** Never create branches mid-task; never continue a prior task's session branch (the long-running shared-session-branch pattern is retired — it nearly produced a 76-commit accidental PR).
- The founder checks out the branch before invoking you. **Open every session by reporting: branch name, HEAD SHA, clean-tree status.** If you're not on the expected branch, STOP.
- Protected `main`; PRs only; the founder merges manually. **Pushed ≠ deployed:** Vercel preview is the smoke-test surface; production exists only after the founder confirms merge + deploy.
- **Claude never drives a PR toward merge — it pushes, reports, and STOPS.** No subscribing to PR activity, no watching or polling CI, no auto-fixing a red check, no requesting reviews, no enabling auto-merge, no merging. Delivery ends at *pushed*, not at *green* — this is the active, Claude-side half of "the founder merges manually" above: the founder reads CI, decides, and merges. The remote-execution harness these sessions run in actively invites the opposite (it advertises PR-activity subscription and CI-autofix as first-class features and will prompt you toward them); **a harness affordance is not a founder instruction, and this rule overrides it.** (Codified Aug 11, 2026 — founder ruling, in the same flag-pin-guard session whose flip-reconciliation amendment closes this section: that session offered to watch the PR's CI and auto-fix it. §2 stated only the positive "the founder merges manually" and never forbade the watching/driving the harness pushes, so the offer slipped the letter of the rule. Now written where it binds.)
- PR descriptions cite changes by `file:line`, name any fenced functions *called*, and confirm none were *edited*.
- **Review is mandatory at ≥10 files OR ≥1500 lines changed** (measured on the cumulative branch diff, not the latest commit). *(Amended Aug 1, 2026 — founder ruling at the Task 4 Phase 3 kickoff. The rule previously named the `/code-review` command, which does not exist in the Claude Code environment these sessions run in; it had been silently unmeetable twice — the Task 2 cumulative review and the Task 4 Phase 2 diff — and a rule that cannot be followed literally erodes the ones that can. The requirement is now stated operationally, so it can be met and audited.)*

  At the threshold, the review MUST be:
  - **Multi-lens and adversarial.** Cover the diff along several independent dimensions (e.g. domain correctness, wiring/lifecycle, the dark-merge or flag-off guarantee, test integrity, cross-phase consistency) rather than one linear read.
  - **Independently verified.** Every finding is handed to a reviewer instructed to **refute** it with a concrete repro. Findings that survive are CONFIRMED; the rest are recorded as REFUTED, with the reasoning — a review that never refutes itself has not been run adversarially. Precedent: `docs/audits/20260730_DELIGHT_STARFIELD_CUMULATIVE_CODE_REVIEW.md` (6 dimensions, 22 agents, 13 CONFIRMED / 3 REFUTED).
  - **Accompanied by an explicit `vite build`.** No test in the repo imports `App.jsx`, so a syntax error there passes the entire suite. The build is the only check that catches it.
  - **Mutation-checked where it adds tests.** A row that cannot fail under the defect it names is not a guard.
  - **Written down** — findings, dispositions, and the CONFIRMED/REFUTED split go in a `docs/audits/` record, cited from the PR.

  If the environment offers a review tool, use it *and* meet the above; the tool is a means, not the requirement. If the reviewing session cannot run the adversarial pass (e.g. subagents unavailable), say so explicitly in the PR rather than reporting the review as done — the Task 4 Phase 2 report is the precedent for that disclosure.

  **Reviewer isolation (founder ruling Sep 2, 2026 — Ask 2 rescoped build):** subagent reviewers work on a **snapshot tree** — a `git archive <sha>` extraction or a copy of the working tree under the session scratchpad, `node_modules` symlinked — and are **read-only on git and on the shared working tree**: no writes to repo files (mutation checks run in the snapshot), no `git checkout --`, stash, commit, or push. Precedent: Reviewer B's byte-exact restore of a stale backup overwrote three fixes the coordinator had applied in flight, and the prescribed `git checkout -- <file>` revert would have restored the base tree and erased the whole unstaged build (`docs/audits/20260902_EXIT_BEHAVIOR_ASK2_BUILD_REVIEW.md` §10).
- **A flag-flip PR reconciles its own pins in the SAME commit.** When a PR flips a feature flag's default (true↔false), it MUST, in that same commit, update every test assertion and docstring that pins the pre-flip state — the value pins that assert the constant, and any docstring that calls the old value the "DEFAULT". A flip that leaves those behind reddens CI on every *other* open PR into `main` until someone else reconciles them. Precedent: `FUNDAMENTAL_MIRROR_ENABLED`'s flip reconciled its ON-state assertions and P4 goldens in-commit (featureFlags.js:1165–1167); the starfield flip PR #694 did not, which reddened the inert test on every downstream PR — the second occurrence in a week that prompted this rule (codified Jul 31 2026). **Now mechanically enforced (Aug 11 2026, after the third occurrence — `LEARNING_L1_CAPTURE_EXPANSION_ENABLED` + `REGIME_STAMP_ENABLED` flipped true while `agent-evaluate.test.js` still pinned false):** `src/config/flagPinGuard.test.js` walks the flag-source modules (`featureFlags.js`, `compositionConfig.js`, `tournamentOrchestrator.js`) and every test file, and fails with an actionable `file:line` whenever a flag's live value contradicts a hardcoded `expect(FLAG).toBe(…)` pin — so a flip can no longer red `main` silently. The message is intent-aware: for a live-state flag it says *update the assertion in the flip commit (or behavior-branch it)*; for a deliberately-dark flag (the guard's `DARK_BY_DESIGN` set — the Wire runway, the composition activation fence, the compiler gate) it prints the runway and says *if the flip is deliberate, update the pin and drop the `DARK_BY_DESIGN` entry in the same commit; if not, revert the flag*. Every pinned flag also carries a `// Pinned by:` pointer at its definition that the guard keeps honest, and a new flag-source module must be registered in the guard's `FLAG_SOURCE_MODULES` or its pins are unguarded.

## 3. Discovery protocol

- **`git fetch origin` is the FIRST step of every session — before any `git` comparison against a remote.** A stale remote-tracking ref (a container cloned once and never re-fetched) once showed `origin/main` 72 commits behind reality and lacking a doc that was already merged; the phantom gap briefly drove a real build decision. Never compare against `origin/main` / `@{upstream}` without fetching first, and record the fetch in the report preamble. (Codified July 12, 2026 — L1-foundation stale-ref incident; founder-cited.)
- Every implementation task begins with a **read-only discovery/verification phase**, then a **hard STOP** for founder review before any writes.
- Every factual claim about the codebase carries a `path/file.js:line` citation and a **VERIFIED / ASSUMED** marker. VERIFIED means you read the code at that line in this session. Re-verify inherited anchors — they drift.
- **"Read-only" refers to project state** — working tree, branches, commits, remote. Fetching or deepening git history (`git fetch --unshallow`) for investigation **is permitted** and must be recorded in your report preamble. (Founder ruling, June 10, 2026.)
- Found a bug outside your task? **Report it for separate tasking; do not fix it.** (This rule has produced three production fixes — DST claims, DRB logger, V4 scorer — precisely because triage stayed separate from discovery.)
- **Reports are files, not just chat output.** Every discovery/triage/audit report must also be written to a file **outside the repo tree** (e.g., the session's home or temp directory) and offered for download, so a byte-exact artifact exists for `docs/audits/`. Chat-only delivery created a recoverable-but-avoidable gap once; never again.

## 4. The import rule (revised June 2026)

The old rule "`api/` cannot import from `src/`" is **retired** — it caused copy-proliferation of scoring logic, which caused real scoring bugs.

**Rule of record:** `api/` MAY import `src/` modules **whose transitive imports are Node-clean** (no React, no client-only SDKs), and every such import must be protected by a **dependency-surface guard**: the test file's import of the consuming module *is* the runtime guard (it explodes in the Node test env if a browser dep enters the graph) — it must carry a comment saying so and must **never be mocked**.

**Scoring source of truth:** `calculateAssetScoreV3` + the canonical constants in `src/constants/baggerBombScoring.js`. **Never create a local copy of scoring math.** The local-copy pattern produced the Snake Draft cron bug (fixed `018f909c`) and the V4 cron bug (fixed June 2026, commit `5432c7f6`). If you find yourself copying a scorer, you are recreating a documented bug class — STOP.

## 5. Signal Capture Rider (binding on all tournament surfaces)

Every catalog event (see `VISION_PROGRAM_POST_LAUNCH_PLACEMENT_ADDENDUM_A` §4 + Implementation Spec §2) persists via **awaited in-request writes** or the **queue-flag pattern** (`pendingReflection` precedent). **Fire-and-forget writes (`.catch(() => {})`) are forbidden for catalog events** — the shadow logger's silent multi-week data loss is the cautionary tale. No dossier writers ship pre-launch; capture only.

## 6. Cron constraints

- **Budget:** 37/40 schedule entries used (assumed Pro ceiling). The tournament build may add **at most 2**. Prefer branching inside existing handlers over new entries.
- **Vercel crons are UTC-only.** Any job whose correctness depends on a specific Eastern-Time minute uses the DST pattern: dual-hour schedule entry + ET-aware guard (`Intl` with `America/New_York` — never hand-rolled offsets) + per-day idempotency. Template: `process-draft-claims.js` (`getClaimProcessingWindow`, `isAlreadyProcessedForDay` — exported, importable).
- **Crons do not run on Vercel preview.** Verification = unit tests on guard logic + observation of the first production run. Say this in your PR rather than claiming preview-tested.
- Cron auth = vercel-cron header / `CRON_SECRET` (in-repo pattern). Internal service-to-service calls use the same secret pattern.
- **Season mode is scrapped (founder ruling C-19) and its crons are de-registered.** `api/cron/season-daily-evaluate.js` and `api/cron/season-pit-stop-manage.js` are **retained un-scheduled** — they are the only two handlers in `api/cron/` with no `vercel.json` entry (19 of 21 are registered). Their three entries were removed Jun 4, 2026 by `d80aee25` ("Forge redesign Phase 1"), taking the count 40 → 37; the schedules named in their headers are historical and are now marked as such. **Do not treat a header comment as evidence a handler runs** — verify against `vercel.json`. Restoring all three would take 37 → 40 and leave nothing for the §6 tournament allowance, so any restoration folds the two pit-stop actions into one handler (cost 2, not 3). *(Codified July 25, 2026 — C-20 honesty-hygiene arc; the stale header nearly drove a wrong conclusion during the signal-inventory read.)*

## 7. Tournament-build specifics (quick map)

- **Design of record:** `docs/FANTASYTRADES_LEAGUE_TOURNAMENT_IMPLEMENTATION_SPEC_V1.md` (binding) over V2.1 (rationale).
- **Dual markets, per group of four:** user layer (3 picks, overnight claims, in-battle flips, shorts allowed) and agent layer (6 picks, intraday swaps, long-only V1) never share state; the only cross-layer fact is the per-player double-down. Max two holders of a symbol per group: one user, one agent.
- **Agent exclusivity** is enforced via candidate-pool filtering (non-fenced) + a two-phase reserve/confirm ledger around the six `executeSwapServer` call sites in `agent-evaluate.js` — never inside fenced code. *(Count updated Aug 19, 2026 — the Exit-Behavior Tier 2 Ask 3 kickoff sanctioned a sixth site: the R11 suppression-path deterministic pass, carrying the same reserve → confirm → compensating-release wrapper; Addendum V1.1 R11.)*
- **Deploys never self-select in tournament mode:** prescribed-portfolio payloads only (draft resolution Mondays, incumbents Tue–Fri).
- **Layer weighting:** composite = agentScore + **1.5 ×** userScore (founder-set; tuning ledger).
- Citation baseline: `docs/audits/2026-06-10_IMPLEMENTATION_DISCOVERY.md` (@ `f12f852`). Lines drift — re-verify before relying.

## 8. Deliverable conventions

- Specs/reports are Markdown. The founder is non-technical: reports lead with an executive verdict table, then detail.
- Phase prompts define their own scope; growing past it (file count creeping toward the review threshold on a "small" task) is the signal you've left scope — STOP and report rather than continuing.

## 9. Display-agreement rule

Every displayed decision or label must be derived from **exactly what the user sees**, never from a parallel source that can drift. A verdict, zone word, strength band, chip, or driver label is computed from the same rounded number, the same payload field, or the same rendered response value — never from a raw pre-rounding value, a live input, or a re-derived copy. This one rule underlies the whole display-disagreement bug family (scan tier, RSI zone words, `strengthBand`, the conditional verdict, and now the result-area driver labels and RSI-rounds-before-zoning): when a label and its number come from two sources they eventually disagree in production, so bind them to one source *by construction*. (Codified July 4, 2026 — Correlation-Lab display-integrity fast-follow; founder-cited.)

## 10. Color tokens (added July 29, 2026 — Delight Layer arc Task 1, spec V2 rulings R-S1–R-S10 / R-A2w / R-H8 / R-#fff)

**All new color usage consumes the `--ft-*` tokens** declared on `:root` in `src/theme/tokens.css` — the canonical color source (ruling R-S5) — via the bridge in `src/theme/cssTokens.js`: `cssVar(name)` for inline styles and CSS strings, `readToken(name)` for canvas / WebGL / Framer Motion, `readTokenRgb(name)` for rgba composition. `src/theme/tokenBaseline.json` is the published, auditable value list. **Raw core-palette hexes introduced in a guarded file fail `src/theme/tokens.guard.test.js`**; the guarded-file list expands as more files migrate.

Five constraints, each paid for by a measured finding in `docs/audits/20260729_DELIGHT_THEMING_FOUNDATION_PHASE0_DISCOVERY.md`:

- **Never author tokens inside a cascade layer.** jsdom parses `@layer` into a rule it never cascades, so every custom property inside one reads back as `""` — which is why the legacy `index.css` block was untestable, and why a layered token block would make its own acceptance tests pass vacuously. A layered block also cannot override the unlayered `:root` in `holographic.css`. Guarded by `tokens.guard.test.js` (A4b).
- **No hex → `var()` inside the values of `holoTheme.js` or `theme/tokens.js`** until helper consolidation lands. Three helper families parse hex and fail *silently* on a `var()` string: `alpha()` returns teal (`commandUI.jsx:38-45`), `readableOn()` returns near-black (`:48-56`), and the 26 `hexToRgba()` copies have seven different fallbacks between them. No throw, no warning, no test failure. Helper call sites keep their hex (R-S9).
- **Framer Motion values take a computed hex from `readToken`, never a `var()` string** (hazard H2) — Motion interpolates color channels numerically and cannot parse `var()`.
- **SVG presentation attributes (`stroke=""`, `fill=""`) keep their hex literal** (hazard H8, ruling R-H8) — `var()` is not reliably substituted there, and a failure silently drops the shape. Converting them to `style`-based CSS is a deliberate change for the consolidation arc, not a migration.
- **`tailwind.config.js`'s `colors` key stays empty** until the dedicated Tailwind-wiring task (R-S10). It ships `{}` today while 45 shadcn-style color utilities sit in live JSX emitting no CSS; populating the scale activates all 45 in one commit. Guarded by A4c.

Migration operates on **raw hex literals only, never on identifiers** — 12 sites across 11 files declare a local `const colors` with conflicting values, so an identifier-keyed codemod on `colors.background` repaints every BaggerBomb screen. The four legacy JS token systems (`HOLO_COLORS`, `DARK_TOKENS`, `CMD`, the `App.jsx` `colors` object) are mutually disjoint — no file uses two — and are re-pointed opportunistically via the `LTOKENS = CMD` re-export pattern (`src/components/League/leagueTokens.js:22`), never by copying values.

**`docs/DESIGN_TOKENS.md` is DEPRECATED** and must not be used as migration input: it is stale by 7½ months, both of its cited line ranges are wrong, and it publishes a wrong value for `cardBg`.

*Numbering note: this section was appended as §10 deliberately. The display-agreement rule keeps §9 because ~20 in-code comments across `src/` and `docs/` cite it as "§9 display-agreement"; renumbering it would silently invalidate every one of those citations.*

## 11. Motion tokens (added July 31, 2026 — Delight Layer arc Task 3, spec V1 + founder STOP rulings)

**All new motion consumes the named vocabulary in `src/theme/motion.js`** — the six locked tokens (`snappy` spring 300/25, `fade` tween 0.2, `smooth` tween 0.3/easeOut, `bouncy` spring 300/20, `gesture` spring 300/30, `instant` tween 0) and the reduced-motion accessor `motionToken(name, { reducedMotion })`. Use `transition={snappy}` (or the accessor) rather than inlining a fresh `transition={{ ... }}` literal. Basis: `docs/audits/20260731_DELIGHT_MOTION_TOKENS_PHASE0_DISCOVERY.md`.

- **Raw transition literals introduced in a guarded file fail `src/theme/motion.guard.test.js`** (acceptance A5). The guard is COUNT-based: it matches the JSX opener `transition={{` per file and diffs against `src/theme/motionGuardBaseline.json`. The guarded-file list **expands as surfaces migrate** (regen: `GENERATE_MOTION_GUARD_BASELINE=1 npx vitest run src/theme/motion.guard.test.js`, committed in the same commit).
- **Known guard blind spot, stated on purpose:** the opener anchor is reliable and false-positive-free (it excludes CSS `transition:'…'` strings and identifier refs), but it is structurally blind to a raw config embedded as a `transition:` KEY inside a variants object — 51 such keys exist in `src/` today. The guard proves "no new inline `transition={{` literal in guarded files," NOT "motion is tokenized." Catching the variants channel needs an AST/lint rule (a separate task). The limit is asserted as executable documentation in the guard's `documented limits` describe block, and must not be papered over.
- **Adoption is gated per-surface (D3), never opportunistic.** Unlike Task 1's colours (which aliased exact existing hex, so migration was parity), most motion inherits framer library defaults — so pointing an existing surface at a token is a **feel change** requiring founder sign-off on preview. New code consuming a token is fine; retrofitting an existing surface is a per-surface decision, not a sweep. Phase 1 adopted the vocabulary nowhere; Phase 2 piloted exactly one surface (`ParamToggle`).
- **`instant` stays `{ duration: 0 }`** — never a spring. It is the reduced-motion swap and is valid at both spring and tween call sites; a spring reintroduces settle time, the exact thing reduced motion removes.
- **VALUES are tuning-exempt (D5)** — the founder may tune any value without a spec re-version, but a tune MUST move the frozen `LOCKED` table in `src/theme/motion.test.js` in the same commit (A2 fails otherwise). The NAMES are locked. The non-Framer `faceEngineCore.js` rAF easing engine is out of scope (spec §8 non-goal).
