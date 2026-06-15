# League Redesign — Phase 3/4 Guardrail Audit (read-only)

**Type:** Read-only build-guardrail audit (no source edited; no next-arc discovery started).
**Generated:** 2026-06-15, by an automated audit session (not a founder paste).
**Audited target:** the **merged code on `main`** — `origin/main` = `0164659` = the PR #510 merge commit (working tree is byte-identical to it). See git state below.
**Citations:** every `file:line` below was read in this session — all **VERIFIED**.
**Permitted-deepening note (BUILD_RULES §3):** the container shipped without `node_modules`; I ran `npm ci` (gitignored, no tracked-state change) solely to execute `lint`/`test`/`build`. No project state (working tree, branches, commits, remote) was altered by the audit other than adding this report.

---

## Git state

| Fact | Value |
|---|---|
| Current branch | `claude/eloquent-fermat-kiiy0f` |
| HEAD | `0164659` — "Merge pull request #510 from fashraf94/claude/nice-johnson-hgmvun" |
| `origin/main` | `0164659` — **identical to HEAD** (this branch sits exactly on the merge commit) |
| Is `claude/nice-johnson-hgmvun` merged into main? | **YES.** Merge commit **`0164659`** (PR #510), merged 2026-06-14 23:18:47 −0500 (`merged_at` 2026-06-15T04:18:48Z, `merged_by` fashraf94) |
| Merged branch's commits (2nd-parent lineage) | `1d0aa2f` P0–P1 · `aed5256` P2 · `c92ffd0` P3–P4 · `d4b0d99` Update featureFlags.js |
| Branch ref `claude/nice-johnson-hgmvun` | deleted after merge (no longer resolvable); commits live on as merge parents |
| Local `main` | `dd74246` (PR #460) — **stale/behind** origin/main; not used. I audited `origin/main`/HEAD content. |
| Tracked tree | clean (apart from this new report) |

**Which I audited:** the merged code on `main` (= HEAD = working tree). PR #510 changed **15 files, +1732 / −191**.

---

## Executive verdict

| # | Guardrail | Verdict |
|---|---|---|
| 1 | Film Room — reused, not forked (one lock; reasoning never in DOM for live/upcoming) | **PASS** *(fixtures-mirror caveat)* |
| 2 | "Open my game" handoff (own full-screen container; flag-off byte-identical) | **PASS** |
| 3 | Signal seam doesn't pollute the corpus (gated on real-data+real-user; awaited, not fire-and-forget) | **PASS** |
| 4 | No parallel token source / orb (LTOKENS reused; `alpha()` imported; AgentAvatar composes AgentOrb) | **PASS** *(DARK_TOKENS wording nuance)* |
| 5 | Merge-critical companions (no fence imports; fixtures-first+header; reduced-motion; test/lint/build; /code-review) | **PARTIAL** |

**Cross-cutting flag (highest priority):** the redesign was merged with its feature flag **ON** (`LEAGUE_REDESIGN_ENABLED = true`), not dark — see Flagged Question #1.

---

## Guardrail 1 — Film Room: reused, not forked — **PASS** (fixtures-mirror caveat)

**One definition of "locked" (no parallel lock).** `isReasoningLocked(pod)` is defined **exactly once** and used **exactly once**:
- Definition — `src/components/League/leagueFixtures.js:195-197`: `return !pod || pod.status !== 'final';` (locked unless the pod is settled/`final`).
- Use — `src/components/League/LeagueSpectate.jsx:142`: `const locked = isReasoningLocked(pod);` (imported at `:14`).
- Repo-wide grep: 1 definition + 1 use, no second/parallel lock predicate anywhere.

**Reasoning is never in the DOM for a live/upcoming battle (render path gates on completion).** VERIFIED:
- `LeagueSpectate.jsx:219` renders `<FilmRoom player={player} locked={locked} />`.
- `LeagueSpectate.jsx:71-94` — the **locked** branch returns **early** with only skeleton bars + the "private reasoning stays sealed until the group completes" copy (`:90`). It never references `REASONING`.
- `REASONING[player.id]` is read in **exactly one place**, `LeagueSpectate.jsx:109`, which is inside the **unlocked** branch (reached only when `locked === false`, i.e. `pod.status === 'final'`).
- Other `pod.status === 'live'|'final'|'upcoming'` checks (`LeaguePod.jsx:76,78,138,230,251`, `LeagueParts.jsx:96`) drive **status badges / labels only** — they do not gate reasoning and are not a second lock.

**The server WHY-hidden path exists and is the intended real source.** `src/hooks/useSpectatedTournamentBattles.js:3-8` — the battle-view projection "conceals live WHY at the read boundary" (full WHY only for the viewer's own seat or a **completed** battle; WHAT-only for a non-owner's active battle). This is the same gate the fixtures mirror.

**Caveat (by design, flag for the next arc — see Flagged Question #4):** in the current fixtures-first state the lock predicate (`isReasoningLocked`, in `leagueFixtures.js`) and the reasoning text (`REASONING`, local to `LeagueSpectate.jsx:22-39`) are **League fixtures that mirror** the server gate — they are **not yet sourced at runtime** from `useSpectatedTournamentBattles`. That wiring is deferred to the `useLeagueState` real-adapter follow-on. This is **not** a fork and **not** a parallel lock (single predicate, correct gating, no leak), so it does not lower the verdict — but the next arc must route reasoning through the WHY-hidden projection when it wires real data. Separately, the existing `src/components/FilmRoom/*` suite (`FilmRoomBanner.jsx` etc.) is **not** reused; the League film-room card is net-new UI. That is acceptable under the guardrail's "...**and/or** the server-side WHY-hiding..." wording, since `FilmRoom/*` is a different surface (AgentBattleScreen post-battle review) with no reusable lock card.

---

## Guardrail 2 — "Open my game" handoff — **PASS**

**Selector.** `src/screens/LeagueScreen.jsx`:
- Flag/param **OFF** → `:31` `if (!REDESIGN_ON) return <LeagueParticipantView />;` (LeagueParticipantView only).
- **ON** → `:55` `return <LeagueHome onOpenMyGame={() => setView('mygame')} />;`
- `REDESIGN_ON` = `LEAGUE_REDESIGN_ENABLED` **or** `?leagueRedesign=1` (`:23-24`).

**`LeagueParticipantView` is the verbatim extraction of the old `LeagueScreen` body.** `diff (8f148f8:src/screens/LeagueScreen.jsx) ↔ (HEAD:src/screens/LeagueParticipantView.jsx)` shows **only**: the file-path header comment, the doc-comment block, and the function name (`LeagueScreen` → `LeagueParticipantView`, old `:50` → new `:43`). **The entire component body — imports, hooks, effects, JSX — is byte-identical.**

**`onOpenMyGame` mounts the participant view full-screen in its own container (not nested in LeagueHome's column).** `LeagueScreen.jsx:35-53` — when `view === 'mygame'`, LeagueScreen returns **early** with its **own** container (`:37` `minHeight:'100vh'`, full-width, sticky back bar at `:38-49`) wrapping `<LeagueParticipantView />` (`:50`). `LeagueHome` is **not mounted** in this state, so the participant view is never nested inside LeagueHome's centered `maxWidth:448` column (`LeagueHome.jsx:74`).

**Flag-off byte-identical.** Flag-off returns `<LeagueParticipantView />` with **no wrapper** (`:31`); its body equals the pre-redesign LeagueScreen body (above) → rendered DOM is identical to pre-redesign. (Behavior is correct **regardless of the flag value**; the shipped flag value is a separate concern — Flagged Question #1.)

---

## Guardrail 3 — Signal seam doesn't pollute the corpus — **PASS**

`src/services/leagueSignals.js`:
- **Gated on real-data + real-user, not endpoint presence.** `:26` `if (isFixtures || !uid) { ...log-only...; return; }` — persistence requires `isFixtures === false` **and** a real `uid`. In fixtures (`:22` default `isFixtures = true`) or with no signed-in user, it `console.debug`s in dev only (`:27`) and returns.
- **Fixtures/dev-preview never persist.** The live surface passes `{ isFixtures }` from `useLeagueState` (= `true`) and **no `uid`** (`LeagueHome.jsx:60`), so both gate conditions hold → log-only.
- **Real path awaited, never fire-and-forget.** `:33-39` is `try { await persistLeagueSignal(...) } catch { console.error(...) }`. The persist is **awaited** (`:34`, currently a placeholder comment pending endpoint wiring against the §4 catalog), and the catch **surfaces** via `console.error` (`:38`) — it is **not** the forbidden `.catch(() => {})` silent-swallow (BUILD_RULES §5).
- More conservative than required: even the real persist line is presently commented out, so **nothing persists yet** — consistent with "capture-only pre-launch." The async caller in `LeagueHome.jsx:60-66` does not `await`, which is fine: that is a client UI signal, not the server write the rider governs; the write itself (when wired) is awaited + surfaced.

---

## Guardrail 4 — No parallel token source / orb — **PASS** (DARK_TOKENS wording nuance)

- **LTOKENS is reused, not a hardcoded duplicate.** `src/components/League/leagueTokens.js:22` `export const LTOKENS = CMD;` — a reference to the shared command-bridge palette (`:15` `import { CMD, MONO, alpha } from '../Dashboard/commandUI';`). No parallel palette is defined in the League arc. League-only roles (`LX.neg/human/cpu`, `:30-33`) are the only hardcoded hex, explicitly the roles genuinely absent from CMD/DARK_TOKENS (identity rings + warm kept-negative red) — legitimate, not a duplicate.
- **The existing `alpha()` is imported.** `leagueTokens.js:15` imports `alpha` from `commandUI` and re-exports it (`:17`); `LeagueParts.jsx:16` consumes it via `leagueTokens`. No reimplementation in the League arc.
- **AgentAvatar composes the existing AgentOrb (does not reimplement the disc).** `src/components/League/LeagueParts.jsx:14` `import AgentOrb from '../shared/AgentOrb';`; `:41` `<AgentOrb color={agent.color} size={size} state={live ? 'live' : 'ready'} />`, then overlays only the League-specific identity ring (`:43`) + kind badge (`:45-51`). `src/components/shared/AgentOrb.jsx` is the existing orb (framer-motion conic-ring + core).
- **Nuance (Flagged Question #3):** the guardrail says "derives LTOKENS from **DARK_TOKENS**." Precisely, LTOKENS derives from **CMD**, and CMD (`commandUI.jsx:16-33`) is itself a **hardcoded literal "aligned to DARK_TOKENS"** by hand (`commandUI.jsx:9-10`), not imported/derived from `DARK_TOKENS`. The League arc introduces **no new copy** (it reuses CMD), so the "no parallel source" intent is met; but the CMD↔DARK_TOKENS relationship is hand-sync, a **pre-existing Command Dashboard condition** outside this arc's scope.

---

## Guardrail 5 — Merge-critical companions — **PARTIAL**

| Sub-check | Status | Evidence |
|---|---|---|
| No calibration-fence imports from `League/*`, `leagueSignals.js`, `useLeagueState.js` | **PASS** | Grep for `decide`/`agentScoring`/`agentRiskManager`/`createAgentBattle`/`agentBattleService`/`agentSwapExecution`/`agentArchetypeConfig`/`agentPromptAssembly`/`agentEvalPromptAssembly`/`api/` → **none**. Only non-relative imports from `League/*` are: `react`, `../shared/AgentOrb`, `../Dashboard/commandUI`, `../../services/leagueSignals`, `../../hooks/useLeagueState`. |
| `useLeagueState` fixtures-first + header naming the real-adapter follow-on | **PASS** | `src/hooks/useLeagueState.js:8-13` header names the real adapter (`subscribeBracket/subscribeGroup` + `useSpectatedTournamentBattles` → Pod/Seat/BookItem); `:28` returns `isFixtures: true`. |
| Reduced-motion fallback exists | **PASS** | `league.css:4-7` relies on the **global** guard, VERIFIED present at `src/index.css:568-573` (`@media (prefers-reduced-motion: reduce){ *,*::before,*::after{ animation-duration:0.01ms!important; …transition-duration:0.01ms!important } }`) — neutralizes the League keyframes (`lgLiveDot/lgOrbPulse/lgSheetIn/lgFadeIn`) + transitions. *(Minor: AgentOrb's framer-motion JS animation isn't covered by the CSS guard, but AgentOrb is pre-existing/shared, not arc scope.)* |
| Build green | **PASS** | `npm run build` exit 0 — 3654 modules transformed, built in 26.37s. |
| Tests green | **PASS** | `npm run test:run` exit 0 — **135 files / 2866 tests passed** (18.81s). |
| Lint green | **PASS for the arc / PARTIAL repo-wide** | The 14 lintable arc files lint **clean** (`eslint` exit 0 on the changed set). Repo-wide `npm run lint` is **red** (1234 errors / 107 warnings) but **none in the arc** ("no arc file appears in the full lint problem list") — all pre-existing (`no-undef` on `process`/`__dirname` in `api/`, `no-unused-vars`, etc.). See Flagged Question #5. |
| `/code-review` ran on this arc | **NO EVIDENCE — FLAG** | PR #510 = 15 files / ~1923 lines → exceeds **both** §2 thresholds (≥10 files OR ≥1500 lines) ⇒ **mandatory**. Yet: **0 formal reviews**; the single PR comment is the Vercel deploy bot; created→merged in **~8 seconds**; and **no** redesign code-review/phase report exists in `docs/audits/`. See Flagged Question #2. |

**Why PARTIAL:** every structural companion passes and the arc is build/test/arc-lint clean, but two bundled items are not cleanly satisfied — repo-wide `lint` does not exit 0 (pre-existing, out-of-arc), and there is no durable evidence `/code-review` ran on a review-mandatory PR.

---

## Flagged questions (contradictions — reported, NOT fixed)

1. **The redesign shipped with its flag ON, inside the build arc.** `d4b0d99` ("Update featureFlags.js", part of PR #510) flipped `LEAGUE_REDESIGN_ENABLED` **false → true** (`src/config/featureFlags.js:116`). This contradicts (a) the flag's **own contract** (`:106-114`: "When **false (default)** … built/merged **DARK** … **Flip — a one-line follow-up PR** … **only after a Vercel preview smoke test**") and (b) **BUILD_RULES §2** ("Pushed ≠ deployed; Vercel preview is the smoke-test surface"). **Effect:** on production `main`, the League tab now serves the redesigned `LeagueHome` to **all** users, not the byte-identical existing flow. → *Was shipping the redesign ON (not dark) intended in this arc, or should the flag revert to `false` pending a separate post-preview flip?*

2. **No `/code-review` artifact on a review-mandatory PR.** PR #510 (15 files / ~1923 lines) required `/code-review` per §2, but shows 0 reviews, an ~8-second create→merge, only a bot comment, and no redesign review/phase report in `docs/audits/` (which otherwise holds a report per phase). → *Did `/code-review` run in-session (without `--comment`, leaving no durable artifact), or was it skipped?*

3. **"Derives LTOKENS from DARK_TOKENS" is, precisely, "reuses CMD."** `LTOKENS = CMD`, and `CMD` is a hardcoded literal hand-"aligned to DARK_TOKENS" (`commandUI.jsx:9-10,16-33`), not imported from it. No new copy is added by the arc, but the canonical palette stays hand-synced between `DARK_TOKENS` (`src/theme/tokens.js`) and `CMD`. → *Accept as-is (pre-existing, out of arc scope), or schedule a follow-on to make CMD derive from DARK_TOKENS?*

4. **The film-room lock is a fixtures mirror, not yet the wired server path.** Guardrail 1's PASS rests on `isReasoningLocked` (fixtures) faithfully mirroring `useSpectatedTournamentBattles`' server WHY-hiding; real wiring is deferred to the `useLeagueState` adapter. Flagged so it is not mistaken for "already sourced from the server WHY path at runtime," and as a standing constraint the next arc must honor: when wiring real data, route reasoning through the WHY-hidden projection — never surface live reasoning. *(By design, not a defect.)*

5. **Repo-wide lint is pre-existing-red.** `npm run lint` = 1234 errors / 107 warnings, **none in the arc** (all in `api/` and other pre-existing files). Not introduced here; flagged because "lint is green" is not literally true repo-wide. Per §3, report-for-separate-tasking — not fixed here.

6. **Local `main` is stale.** Local `main` = `dd74246` (PR #460), far behind `origin/main` = `0164659`. I audited `origin/main`/HEAD (the merged code). Noted so the state is unambiguous.

---

## STOP

Read-only audit complete. No source files were edited; no fixes were applied; next-arc discovery was **not** started — per the task's hard stop.
