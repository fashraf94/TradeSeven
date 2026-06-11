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

The scoring engine and `createAgentBattle` document shape are fenced as concepts, not just files: changes that alter their behavior from non-fenced call sites are fence contact too. If your task seems to require fence contact that isn't in its prompt, **STOP and report** — never improvise it.

## 2. Branch & merge discipline

- **One task = one branch, cut fresh from current `main`.** Never create branches mid-task; never continue a prior task's session branch (the long-running shared-session-branch pattern is retired — it nearly produced a 76-commit accidental PR).
- The founder checks out the branch before invoking you. **Open every session by reporting: branch name, HEAD SHA, clean-tree status.** If you're not on the expected branch, STOP.
- Protected `main`; PRs only; the founder merges manually. **Pushed ≠ deployed:** Vercel preview is the smoke-test surface; production exists only after the founder confirms merge + deploy.
- PR descriptions cite changes by `file:line`, name any fenced functions *called*, and confirm none were *edited*.
- `/code-review` is mandatory at **≥10 files OR ≥1500 lines** changed.

## 3. Discovery protocol

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

## 7. Tournament-build specifics (quick map)

- **Design of record:** `docs/FANTASYTRADES_LEAGUE_TOURNAMENT_IMPLEMENTATION_SPEC_V1.md` (binding) over V2.1 (rationale).
- **Dual markets, per group of four:** user layer (3 picks, overnight claims, in-battle flips, shorts allowed) and agent layer (6 picks, intraday swaps, long-only V1) never share state; the only cross-layer fact is the per-player double-down. Max two holders of a symbol per group: one user, one agent.
- **Agent exclusivity** is enforced via candidate-pool filtering (non-fenced) + a two-phase reserve/confirm ledger around the five `executeSwapServer` call sites in `agent-evaluate.js` — never inside fenced code.
- **Deploys never self-select in tournament mode:** prescribed-portfolio payloads only (draft resolution Mondays, incumbents Tue–Fri).
- **Layer weighting:** composite = agentScore + **1.5 ×** userScore (founder-set; tuning ledger).
- Citation baseline: `docs/audits/2026-06-10_IMPLEMENTATION_DISCOVERY.md` (@ `f12f852`). Lines drift — re-verify before relying.

## 8. Deliverable conventions

- Specs/reports are Markdown. The founder is non-technical: reports lead with an executive verdict table, then detail.
- Phase prompts define their own scope; growing past it (file count creeping toward the review threshold on a "small" task) is the signal you've left scope — STOP and report rather than continuing.
