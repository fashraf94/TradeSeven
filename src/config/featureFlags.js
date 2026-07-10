// src/config/featureFlags.js
//
// Centralized feature flags. Code constants — flip in a follow-up PR
// when the gated feature is ready to ship.

/**
 * Watch List rail on the Discover tab.
 *
 * Disabled while we build deterministic calendar infrastructure to
 * replace Sonar as the data source. See SPRINT_4_LESSONS.md for context
 * on what's deferred and the open architecture questions.
 */
export const WATCH_LIST_RAIL_ENABLED = false;

/**
 * Command Dashboard — the mobile loop-home (Read → Equip → Deploy → Manage → Review).
 *
 * When false, the mobile home renders the existing DashboardLoop unchanged
 * (instant rollback). When true, it renders the new agent-command surface.
 * Mobile only — desktop (DashboardDesktop) is unaffected either way.
 */
export const COMMAND_DASHBOARD_ENABLED = true;

/**
 * Command Dashboard — Desktop (the 3-column command surface that pairs with the
 * mobile loop-home: Read → Equip → Deploy → Manage → Review).
 *
 * When false, desktop renders the existing DashboardDesktop unchanged (instant
 * rollback). When true (and the viewport is desktop), it renders
 * CommandDashboardDesktop. Built/merged dark; flip to ship after a preview
 * smoke test — the same play used for the mobile flag above.
 */
export const COMMAND_DASHBOARD_DESKTOP_ENABLED = true;

/**
 * Forge — authored per-rule Hard/Soft override (Phase 3).
 *
 * When false (default), the bundle build flow's Hard/Soft stage renders the
 * read-only, category-derived badge — today's behavior, with no way to author
 * an override. When true, it renders the interactive per-rule SOFT/HARD control
 * that writes a `ruleHardness` override onto the bundle doc.
 *
 * GATED OFF until the FENCED prompt-assembly half lands (projectActiveRules
 * carrying `hardness`; agentPromptAssembly + agentEvalPromptAssembly honoring
 * the override) AND a founder sign-off on that fenced commit — so users never
 * get a "must follow" control the agent silently ignores. The non-fenced
 * authoring + persistence + display layer is built and merged dark behind this
 * flag; flip to ship only after the fenced commit is reviewed for prompt parity
 * and signed off. See FORGE_ENFORCEMENT_KEYSTONE_SPEC and the Phase 3 audit.
 */
export const FORGE_HARDSOFT_AUTHORING_ENABLED = false;

/**
 * Forge — Desktop layout for the Forge workshop shell (ForgeWorkshop).
 *
 * When false (default), ForgeWorkshop renders the existing fixed 480px centered
 * column at every viewport — instant rollback; mobile AND desktop unchanged.
 * When true (and the viewport is desktop), the shell widens and the `01 Lists`
 * area unfolds into the two-column Discover + create/manage layout. Built/merged
 * dark; flip to ship after a Vercel preview smoke test — the
 * COMMAND_DASHBOARD_DESKTOP_ENABLED precedent.
 */
export const FORGE_DESKTOP_ENABLED = true;

/**
 * Forge — Traits → Archetype Exploration surface (the `03 Traits` redesign).
 *
 * When false (default), the Traits area renders TODAY's interim surface unchanged
 * at every viewport (read-only archetype banner + DNAGroupCard/TraitCard equip on
 * mobile, the EquippedTraitCard grid + workbench banner on desktop) — instant
 * rollback. When true (or via the `?traitsExploration=1` dev-preview param, the
 * `?forgeDesktop=1` idiom), the area renders the exploration redesign: archetypes
 * as explorable characters (identity + four decision factors), the live equipped
 * loadout with honest per-rule hardness, and a view-only six-archetype roster +
 * trait library.
 *
 * This changes the LIVE mobile Traits surface (not gated by FORGE_DESKTOP_ENABLED),
 * so it is built/merged DARK behind this flag on BOTH viewports. Flip to ship in a
 * one-line follow-up PR after a Vercel preview smoke test — the
 * COMMAND_DASHBOARD_DESKTOP_ENABLED / LEAGUE_REDESIGN_ENABLED precedent.
 */
export const TRAITS_EXPLORATION_ENABLED = true;

/**
 * Equip bench — the Traits loadout slot (mobile EquipStation + desktop
 * EquipBench) and the TraitsSheet behind it.
 *
 * OFF at launch: the fixed-library trait surface is retired (Scouting Focus
 * Build Spec V1.3 §11 — trait surface off, plumbing seeded silently; Closeout
 * Spec V1.1 §2). When false, both benches render 2 slots (Archetype ·
 * Watchlist) and the slot-count copy follows the rendered slots. Surface-only:
 * equippedTraits seeding, trait persistence, and the projectActiveRules
 * projection are untouched — agents keep their seeded traits invisibly and
 * battle behavior is unchanged. Flip when the slot returns post-launch as the
 * earned-trait perk slot.
 */
export const TRAIT_SLOT_ENABLED = false;

/**
 * League — the provisional tournament tab occupying the retired Agent Hub's
 * nav slot (Closeout Spec V1.1 §6).
 *
 * When false, the slot is hidden entirely (4-item bottom nav, 6-item desktop
 * sidebar) and the 'league' route is gated away — the screen id is unreachable
 * since the nav items are its only setters. When true, a provisional "League"
 * tab (Trophy icon) renders the placeholder LeagueScreen. Flip when the League
 * Tournament surface is real.
 */
export const TOURNAMENT_TAB_ENABLED = true;

/**
 * League — the self-serve lobby (P10): registration · join/create · FIFO
 * matchmaking · CPU-padded formation. The front door that replaces the dead
 * "no active tournament group yet" empty state on the live League tab.
 *
 * When false (default), the League tab renders TODAY's behavior unchanged —
 * `subscribeMyGroup` and the existing forming→battle flow are untouched, and
 * the `!group` branch shows the coming-soon poster (dark-merge safe; the live
 * tournament must not regress). When true, the empty state becomes the lobby
 * front door and the lobby-* endpoints accept self-serve registration.
 *
 * Built/merged DARK behind this flag (P10a = the data layer + the proven
 * CPU-padding-from-base-layer seam; P10b = the surface). Flip — a one-line
 * follow-up PR, the TOURNAMENT_TAB_ENABLED precedent — only after a preview
 * smoke + the new firestore.rules `tournamentLobby` block is deployed in the
 * Firebase Console (else the client lobby read 403s).
 */
export const LEAGUE_LOBBY_ENABLED = true;

/**
 * League — the redesigned spectate-and-enter front end (the bracket-funnel
 * lobby + four-player pod cards + pod sheet + two-layer Spectate). The
 * "front door" landing that sits in front of the live participant flow
 * (LeagueScreen's board-commit / battle / claims / draft views stay intact
 * and are reached from it via a full-screen push).
 *
 * When false (default), the League tab renders TODAY's behavior unchanged —
 * LeagueScreen mounts LeagueParticipantView (the extracted, byte-identical
 * existing flow). The redesign is built/merged DARK behind this flag, and is
 * fixtures-backed for now (a single `useLeagueState()` seam; real Firestore
 * wiring is a scoped follow-on). When true — or with the `?leagueRedesign=1`
 * dev preview (the `?tournamentDev=1` idiom) — the tab renders LeagueHome.
 *
 * Flip — a one-line follow-up PR, the TOURNAMENT_TAB_ENABLED precedent —
 * only after a Vercel preview smoke test.
 */
export const LEAGUE_REDESIGN_ENABLED = true;

/**
 * League — Next Arc (the second League slice). The "Altitude Climb" five-day
 * pod-standings view now; in later phases the Training/Ranked lobby tabs, the
 * real-data adapter, and the live-pulse. Built/merged DARK behind this flag.
 *
 * When false (default), NOTHING in the League surface reads it — the tab is
 * byte-unchanged. This slice ships the Altitude Climb fixtures-backed and
 * reachable ONLY via the dev preview param `?leagueClimb=1` (with
 * `&m=live|final&c=training|ranked`) — the `?leagueRedesign=1` idiom.
 *
 * Phase 1 (the real-data adapter) also gates on this flag: when true (or with
 * the dev preview param `?leagueRealData=1`, the same idiom), `useLeagueState`
 * swaps fixtures for the real System-1 read-model (your group, the capped
 * base-layer field, the bracket funnel, dailyScores composites, the WHY
 * projection); when false + no param, `useLeagueState` returns byte-identical
 * fixtures. Fixtures remain the cold-start fill.
 *
 * The flag exists so a later phase can wire the real in-app entry and flip it;
 * do NOT flip it in a build PR (the PR #510 lesson), only after a Vercel
 * preview smoke.
 */
export const LEAGUE_NEXT_ARC_ENABLED = true;

/**
 * League — Battle View V2 (the redesigned live battle hero + nine-star command
 * dock). The locked Claude Design rebuild that sits in front of today's
 * Flat6BattleView / Altitude-Climb composition, EXTENDING the existing climb
 * (LEAGUE_NEXT_ARC) rather than forking it.
 *
 * When false (default), NOTHING in the League surface reads it — the tab is
 * byte-unchanged. Phase 1 (this slice) ships the PURE data foundation only (the
 * dailyScores→scores[] climb assembler, the per-holding meter reader + star
 * state, points formatters, beat derivation) with NO UI swap and NO read-site,
 * so flag-off is provably byte-identical. The dev preview `?battleViewV2=1` (the
 * `?leagueClimb=1` / `?leagueRedesign=1` idiom) and the LeagueScreen read-site
 * land with the component phase, not here.
 *
 * The flag exists so a later phase can wire the in-app entry and flip it; do NOT
 * flip it in a build PR (the PR #510 lesson — the LEAGUE_NEXT_ARC_ENABLED
 * precedent), only after a Vercel preview smoke.
 */
export const LEAGUE_BATTLE_VIEW_V2_ENABLED = true;

/**
 * League — Training-tab CLIMB PREVIEW (the second-arc re-entry surface).
 *
 * The active-training-battle state of the League Training tab shows the real
 * five-day Altitude Climb (the Battle-View-V2 hero, `ClimbArena`, fed by the
 * real-data bridge `buildArenaModel` → `buildClimbSeries`) in place of the flat
 * "Return to your training pod" re-entry card; tapping the climb routes into the
 * pod's live battle view via the already-threaded `onOpenTrainingPod`.
 *
 * Reuses the real-data arena path so it renders the ACTUAL pod (never the
 * fixtures-only standalone `LeagueClimb`, which would leak the demo pod onto a
 * real surface). Scoped to `GROUP_STATUS.BATTLE` pods only — a DRAFTING /
 * AWAITING_OPEN pod has no climb yet and keeps its existing re-entry card.
 *
 * When false, NOTHING on the Training tab reads the real-data climb — the
 * re-entry card renders exactly as today (flag-off is byte-unchanged), and the
 * surface stays reachable via the dev param `?trainingClimbPreview=1` (the
 * `?leagueClimb=1` / `?battleViewV2=1` idiom).
 *
 * ENABLED (founder decision, 2026-07-03): flipped ON in the enabling PR rather
 * than a separate follow-on — the PR's own Vercel preview (feature ON) is the
 * smoke surface, and the founder merges manually only after smoking it. Because
 * the read-site swaps a production surface, the climb goes live at merge; smoke
 * the preview (a BATTLE training pod → the Training tab shows the real climb,
 * tap → the battle view) before merging.
 */
export const LEAGUE_TRAINING_CLIMB_PREVIEW_ENABLED = true;

/**
 * League — user-layer CANONICAL-OPEN baseline capture.
 *
 * When false (default), the user 3-pick layer keeps today's behavior: each
 * leg baseline is created null and settled at the next open by the nightly
 * banking pass (Spec §1.1), so held picks read 0× intraday on Day-0.
 *
 * When true, a League round is stamped `baselinePolicy: 'canonical_open'` at
 * creation, and a post-open capture sweep (a later phase) settles each leg's
 * baseline to the round's canonical session open — sourced from the SAME
 * `fetchBatchQuotes(...).open` (EODHD /real-time/ item.open) that banking
 * settles from — so the user layer scores live intraday, consistent with the
 * banked score of record.
 *
 * Phase 1 ships the INERT primitives only (this flag, the capture util, the
 * snapshot-storage shape + policy stamp, the leg provenance fields). Nothing
 * reads the stamp or the fields yet, so flag-off is behavior-identical. The
 * cron sweep + banking consumption land in later phases. Do NOT flip in a
 * build PR (the PR #510 / LEAGUE_NEXT_ARC_ENABLED precedent) — flip only after
 * a Vercel preview smoke.
 */
export const LEAGUE_CANONICAL_OPEN_CAPTURE = false;

/**
 * League Training — the redesigned Training Draft Board (the agent-fit spine).
 *
 * When false (default), `TrainingDraftRoomScreen` renders TODAY's behavior
 * unchanged — the sector-grouped board + star-highlight overlay (the Slice 2
 * monolith), byte-identical (instant rollback). When true — or with the
 * `?trainingBoard=1` dev-preview param (the `?trainingDraft=` idiom) — it
 * renders the redesigned board: one fit-ranked, tiered "best available" board
 * keyed to the practice agent's archetype (`arch_scores[humanArchetype]`, a
 * direct read), plain-language reason lines, sector lens chips, search, and
 * scale handling, composed from the reusable League draft atoms in
 * `src/components/League/draft/`.
 *
 * Client UI + reads only — no new writes, the same `applyTrainingPick` endpoint,
 * the calibration fence untouched. Built/merged DARK behind this flag; flip in a
 * one-line follow-up PR after a Vercel preview smoke (the LEAGUE_REDESIGN_ENABLED
 * precedent). The opponent-reveal animation (Phase 2) and the entry-fold merge
 * (Phase 3) layer on behind this same flag.
 */
export const TRAINING_BOARD_REDESIGN_ENABLED = true;

/**
 * Rule Conflict Reconciler — equip-time DETECTION (shadow-safe half).
 *
 * The agent (BaggerBomb) path has no conflict resolution: contradictory hard
 * constraints (e.g. "Cap Tech 40%" + "≥50% Tech") are both classified
 * "must obey" and the reserved `conflictCheckResult` field is hard-coded null.
 * This flag turns on the canonical reconciler's DETECTION at equip time only:
 * it computes and persists `conflictCheckResult` on the bundle and powers the
 * equip-time warning toast. It does NOT change anything the agent sees at
 * deploy — it is pure shadow/transparency (no prompt-path change).
 *
 * OFF by default. Built/merged DARK; flip after a preview smoke once the
 * reconciler has been observed against real equipped loadouts. The runtime
 * INJECT half (below) is a separate, fence-gated flag and implies this one.
 * See the Rule Conflict Reconciler build spec + RULES_LAUNCHBLOCKER findings.
 */
export const CONFLICT_RECONCILER_DETECT_ENABLED = true;

/**
 * Rule Conflict Reconciler — runtime INJECTION into the cognition prompts.
 *
 * When true, the deploy-time resolve (in the fenced `api/agent/decide.js`
 * call-site) replaces the raw projected `activeRules` with the reconciler's
 * `resolvedRules` before they are frozen into the battle snapshot — so the
 * losing side of a contradiction never reaches the strategy or intraday-eval
 * prompt. This CHANGES what the agent sees; it is the fence-touching half and
 * is gated behind the §7 founder-reviewed commit.
 *
 * INJECT implies DETECT — injection without detection is meaningless. On
 * reconciler error or with this flag off, the path falls back to the raw
 * projected rules (deploy never blocked). OFF by default; flip only after the
 * fenced commit is reviewed for prompt parity and signed off, and after a
 * preview calibration smoke. See the Rule Conflict Reconciler build spec.
 */
export const CONFLICT_RECONCILER_INJECT_ENABLED = true;

/**
 * Release 2 (Fenced Customization Bundle V1.1) — STANDING LEANS activation.
 *
 * Gates the standing-leans surface: the equip/unequip endpoints 404 while
 * false (the scouting-board defense-in-depth pattern), and — once the Phase-2
 * fenced edits land — the shared control renderer refuses to render persisted
 * leans into any prompt while false (read-side guard; data kept, suppression
 * logged per battle+mode-epoch). "No UI" is never the activation control.
 *
 * Boolean by founder ruling D1 (2026-07-10; the spec's STANDING_LEANS_MODE
 * 'off'|'on' resolved to the house *_ENABLED shape — leans have no observe
 * half). OFF at merge (DARK-INERT). Flip is a Release-4 staged-activation-walk
 * step, founder-executed in its own watch window — never in a build PR (the
 * PR #510 lesson).
 */
export const STANDING_LEANS_ENABLED = false;

/**
 * Archetype Integrity / "Third Path" — tri-state rollout mode.
 *
 * Gates the whole archetype-integrity feature together (the deterministic
 * directive gate, the voice-layer four-zone + third-path injection, the
 * Diversifier swap-time sector cap, and the legacy `directives[]` sanitize) so
 * there is exactly one byte-identical-off regression surface. Three states:
 *
 *   'off'     — byte-identical to today. No archetype-aware gating; the directive
 *               path runs the legacy `normalizeDirective` line verbatim.
 *   'observe' — measurement mode. The model emits the proposal block and the gate
 *               EVALUATES + awaited-logs the outcome, but writes NO directive
 *               (no behavior change persists). Vehicle for the pre-flip reliability
 *               eval; NOT a permanent behavioral tier.
 *   'enforce' — full behavior: the gate mints only core-safe allowlist directives.
 *
 * Default 'off'. Built/merged DARK; advance 'off' → 'observe' → 'enforce' only
 * after the pre-flip reliability eval clears the hard zeros (0 core-reversing
 * directives, 0 "claimed-a-change-but-wrote-null"). One master flag — no per-cap
 * sub-flag (the Diversifier cap is independently safe and rides this flag).
 * See docs/audits/20260625_ARCHETYPE_INTEGRITY_BUILD_PLAN_V2.md.
 */
export const ARCHETYPE_INTEGRITY_MODE = 'observe';

/**
 * WS1 — Rule-library archetype scoping: tri-state rollout mode.
 *
 * Gates the whole rule-vs-archetype compatibility feature together (the
 * write-path guard in forgeService, the equip warnings + badges, the observe
 * event stream, and the change-archetype rescan event) so there is exactly one
 * byte-identical-off regression surface. Three states:
 *
 *   'off'     — byte-identical to today. No classification is computed
 *               anywhere; the guard early-returns before touching the map.
 *   'observe' — measurement mode. Every conflict-equip and every
 *               would-be-blocked promotion is classified + logged
 *               (blocked:false), but NOTHING is blocked and no warning UI
 *               renders. Vehicle for reading real conflict-equip volume.
 *   'enforce' — full behavior: soft warning when equipping a core_conflict
 *               rule; hard block on any write that would make a core_conflict
 *               rule must-obey (create-as-hard, promote-to-hard, category
 *               flip, reforge carry-forward — the fence-lite-approved paths).
 *
 * Default 'off'. Built/merged DARK; walk 'off' → 'observe' → 'enforce' only
 * after observing conflict-equip volume (WS1 spec §8.4). INDEPENDENT of
 * ARCHETYPE_INTEGRITY_MODE — the two flags walk separately. The one-time
 * pre-launch cleanup script (WS1 Phase 4) live-runs at or before the enforce
 * step. Classification source: src/data/archetypeRuleCompatibility.js.
 */
export const RULE_COMPAT_MODE = 'observe';

/**
 * League — Desktop Training Pod tab + Active Training Game card (the desktop
 * League redesign's training addition; see LEAGUE_DESKTOP_TRAINING_POD_BUILD_SPEC).
 *
 ... (rest of the League comment) ...
 * instant one-line rollback.
 */
export const LEAGUE_TRAINING_POD_ENABLED = true;

/**
 * League — Battle Arena "Ask your agent" two-way chat (see the League Agent
 * Chat build spec). When FALSE (default), the arena ask box stays today's
 * local-echo stub — decorative "Ask anything…" placeholder + canned chip
 * echoes, no network — byte-identical to before this build.
 *
 * When TRUE, the ask box becomes a real free-text input + strategy chips that
 * POST to /api/agent/chat (leagueAsk:true) for a grounded in-voice answer,
 * under a per-day question budget (agentChatBudget/{groupId}_{uid}_{dayN}) with
 * a persistent "N left today" counter, an in-voice zero state, and an in-voice
 * failure/retry state.
 *
 * THIS FLAG IS THE COST KILL-SWITCH — every paid ask is behind it. It is
 * independent of the arena flag (LEAGUE_BATTLE_VIEW_V2_ENABLED); flipping it
 * off instantly stops all paid asks and reverts the box to the stub. Built and
 * merged DARK; flip only after a Vercel preview smoke (the TOURNAMENT_TAB_ENABLED
 * precedent).
 */
export const LEAGUE_AGENT_CHAT_ENABLED = true;

/**
 * Command Center — Scouting Board (the READ-section "See what it's eyeing"
 * pre-deploy preview).
 *
 * When FALSE (default), the READ section is byte-identical to today: the primary
 * CTA is "Deploy on this read" (mobile CommandDashboard, desktop ReadColumn) and
 * the deferred "Talk it over · Soon" stub renders unchanged. Nothing calls the
 * read-only GET /api/agent/scouting-board endpoint (which itself 404s while this
 * is false).
 *
 * When TRUE, the primary CTA becomes "See what it's eyeing" → opens the
 * ScoutingBoardSheet (the top-10 archetype-ranked board + the equipped watchlist
 * as a marked group, rendered read-only from the deterministic
 * computeArchetypeRankings). Deploy becomes an action taken FROM the board via
 * the UNCHANGED deployAgent path, with a subtle direct-deploy escape hatch kept
 * in the READ section so deploy is always reachable without opening the board.
 *
 * Built/merged DARK; flip in a one-line follow-up PR after a Vercel preview smoke
 * (the COMMAND_DASHBOARD_DESKTOP_ENABLED precedent) — never in the build PR.
 */
export const SCOUTING_BOARD_ENABLED = true;

/**
 * Correlation Lab — the Correlation Intelligence research surface
 * (rolling group-vs-driver correlations, rolling-40 beta, lead-lag, and
 * correlation-regime inflections with episode-first forward-return base rates).
 *
 * LIVE (TRUE) as of the V1.1 exposure PR. When TRUE, the surface is reachable
 * two ways — the `?correlationDev=1` dev screen (src/components/Research/
 * CorrelationLab.jsx) AND the Discover "Correlations" tab (embedded) — and
 * POST /api/research/correlation serves authenticated requests. This exposure
 * PR ships the flag ON by design (V1.1 spec), after a founder Vercel-preview
 * smoke; it is not the merge-dark build PR.
 *
 * When FALSE (rollback), the app is byte-identical to the pre-V0 state: the
 * Discover tab renders nothing, the `?correlationDev=1` mount effect sets a
 * screen id that never renders, and the endpoint 404s (the scouting-board
 * defense-in-depth pattern) — nothing reachable or callable. Kept as the
 * instant-rollback lever.
 */
export const CORRELATION_LAB_ENABLED = true;
