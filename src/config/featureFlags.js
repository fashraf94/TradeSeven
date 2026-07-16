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
 * Release 3 — the Forge's `03 Traits` tab BECOMES `03 Character` (Character/Equip
 * UI). When true (or via the `?release3Character=1` dev-preview param, the
 * `?traitsExploration=1` idiom), the `03` slot's nav label reads "Character" and
 * its body renders the CharacterArea: the archetype identity reading (kept), a
 * read-only "Born with" kit, standing leans (equip/unequip, 2 slots), the tempo
 * dial, and a derived behavior fingerprint — the interactive trait library /
 * SOFT NUDGE / STRENGTH selectors are removed from this surface. The Forge
 * landing "Traits" card likewise becomes a "Character" card.
 *
 * When FALSE (default), the `03` slot renders TODAY's Traits surface byte-for-byte
 * (label "Traits" → TraitsArea → TraitsExploration) — the instant-rollback
 * guarantee (off-state proof). It consumes the already-merged Release 2 lean/dial
 * contracts (equip-lean / unequip-lean / set-tempo-dial), which are LIVE as of
 * 2026-07-12; this flag gates only the UI. Flip to ship in a one-line follow-up
 * PR after a Vercel preview smoke test — the TRAITS_EXPLORATION_ENABLED precedent.
 */
export const RELEASE3_CHARACTER_TAB_ENABLED = true;

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
 * League Training — Training Pod Draft V2 (the Draft Lobby & Awaiting-Open
 * polish; spec 2026-07-16).
 *
 * STACKS ON TOP of the already-shipped TRAINING_BOARD_REDESIGN_ENABLED (which is
 * LIVE — the redesigned DraftBoardRoom). "Flag-off" here means TODAY's
 * DraftBoardRoom + video-based awaiting-open pod, BYTE-IDENTICAL — it does NOT
 * mean the legacy sector board (that is TRAINING_BOARD_REDESIGN_ENABLED's own
 * off-path, a different flag). Do not conflate the two.
 *
 * When true — or with the `?trainingPodV2=1` dev-preview param (the
 * `?trainingBoard=1` idiom) — it delivers L1–L8: a 60s HUMAN pick clock, the
 * board ticker opening AssetResearchModal (row-body still selects), a sticky
 * bottom action bar, and the rebuilt awaiting-open pod (countdown → user
 * draftboard → best-remaining free agents → relocated claims).
 *
 * Client UI + reads only — no new writes, the same applyTrainingPick /
 * place-claim endpoints, the calibration fence untouched. Built/merged DARK; flip
 * in a one-line follow-up PR after a Vercel preview smoke (the
 * TRAINING_BOARD_REDESIGN_ENABLED precedent) — never in the build PR.
 */
export const TRAINING_POD_DRAFT_V2_ENABLED = false;

// The HUMAN pick clock under V2 (L1: 60s; CPU turns unaffected — they resolve
// server-side with no clock). Homed HERE, not in the zero-import, test-locked
// leagueTournament.js, so flag-off stays byte-identical at that module's 20s
// PICK_CLOCK_MS; the single clock consumer (useTrainingDraft) selects between the
// two off isTrainingPodDraftV2On().
export const TRAINING_POD_PICK_CLOCK_MS = 60000;

/**
 * The ONE home for the V2 gate — the flag OR the `?trainingPodV2=1` dev-preview
 * override — so every V2 surface (the lobby clock / ticker-modal / sticky bar and
 * the Phase-2 pod) resolves it identically. SSR/Node-safe (guards `window`); a
 * malformed URL degrades to the flag alone.
 */
export function isTrainingPodDraftV2On() {
  if (TRAINING_POD_DRAFT_V2_ENABLED) return true;
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('trainingPodV2') === '1';
  } catch {
    return false;
  }
}

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
 *
 * ACTIVATION PREREQUISITE (founder ruling, Phase-2 acceptance 2026-07-10):
 * the leanOverrides chat-side confirmation flow still needs its voice copy
 * (flagged since PR-a). Blocks nothing while dark; must be written before
 * this flag flips.
 */
export const STANDING_LEANS_ENABLED = true;

/**
 * Release 2 (Fenced Customization Bundle V1.1) — TEMPO DIAL activation.
 *
 * Gates the tempo-dial surface: the set-tempo-dial endpoint 404s while false,
 * and the clamp layer (api/_utils/tempoDialClamp.js) resolves EFFECTIVE tempo
 * to 'standard' whenever this is false OR the band table's
 * forKnobConfigVersion mismatches the deployed KNOB_CONFIG_VERSION
 * (version-bound fail-closed, spec changelog #13) — desired state is kept and
 * the divergence is visible via the structured provenance object
 * (suppressionReason), never silent.
 *
 * Boolean by founder ruling D1 (2026-07-10; the spec's TEMPO_DIAL_MODE
 * 'off'|'on' resolved to the house *_ENABLED shape). OFF at merge
 * (DARK-INERT). Flip is a Release-4 staged-activation-walk step,
 * founder-executed in its own watch window — never in a build PR (the PR
 * #510 lesson). The band table itself is PROVISIONAL until promoted from the
 * B4 acceptance report's real-data cross-check.
 */
export const TEMPO_DIAL_ENABLED = true;

/**
 * Archetype Integrity / "Third Path" — tri-state rollout mode.
 *
 * Gates the CHAT-DIRECTIVE half of archetype integrity (the deterministic
 * directive gate, the voice-layer four-zone + third-path injection, and the
 * legacy `directives[]` sanitize) so there is exactly one
 * byte-identical-off regression surface for directives. Three states:
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
 * directives, 0 "claimed-a-change-but-wrote-null").
 * See docs/audits/20260625_ARCHETYPE_INTEGRITY_BUILD_PLAN_V2.md.
 *
 * Release 2 PR-e (Phase-0 ruling, decoupled 2026-07-10): the Diversifier
 * swap-time sector cap NO LONGER rides this flag — it fires under its own
 * SECTOR_CAP_MODE (below), so the directive walk and the cap walk are
 * independent Release-4 steps. This flag governs chat directives only
 * (master spec V1.2 errata #1).
 *
 * ROLLBACK RULE (founder-adopted 2026-07-10; docs/RELEASE2_ACTIVATION_RUNBOOK.md):
 * while any battle carries an active directive, roll back to 'observe',
 * NEVER 'off'. Know what a rollback does either way: LEAVING 'enforce'
 * permanently retires every in-flight directive (the next tick's epoch
 * record kills it; directives never resurrect — PR-c design), whichever
 * state you land in. There is no "pause" state. The reason 'observe' is
 * still the only correct target: its write path mints NOTHING, while
 * 'off' runs the un-gated legacy normalizeDirective line — directives
 * minted under 'off' would render un-screened on a later re-enforce.
 *
 * Release 2 PR-c (read-side guard): the PROMPT surfaces render a persisted
 * battle.directive ONLY under 'enforce' — under 'off'/'observe' a directive
 * at rest is suppressed (data kept, epoch-logged) so a flip-back is clean on
 * the next eval, and a directive suppressed by a mode flip never resurrects
 * for that battle. The 'off' write path stays the legacy normalizeDirective
 * line verbatim; what changed is that its output no longer REACHES a prompt
 * (master spec §3.6, founder-accepted).
 */
export const ARCHETYPE_INTEGRITY_MODE = 'observe';

/**
 * Release 2 PR-e — the sector-SLOT rule: tri-state rollout mode.
 *
 * Gates the Diversifier tournament sector-position cap (the ONE mechanical
 * archetype-integrity piece), decoupled from ARCHETYPE_INTEGRITY_MODE by
 * founder ruling (Phase 0, 2026-07-10) so the directive walk and the cap walk
 * are independent Release-4 steps. House tri-state (the
 * ARCHETYPE_INTEGRITY_MODE / RULE_COMPAT_MODE shape, per ruling D1):
 *
 *   'off'     — the flag's own machinery is fully dark: no injection, no
 *               measurement, the guardrails array untouched. (One
 *               flag-INDEPENDENT fix rode PR-e per spec §6: tournament
 *               checkSectorCap divides by the mode's 6-slot book instead of
 *               the momentary held count. Identical on a full book — which
 *               is every known reachable state, since deploys validate
 *               exactly 6 and forced exits defer without a bench — it
 *               differs only on a partial book, where the old math
 *               over-blocked.)
 *   'observe' — measurement mode. Nothing is blocked and the guardrails array
 *               is untouched, but every swap the ENFORCE cap would have
 *               blocked is logged as a `would_block_swap` override (riding
 *               the eval record's guardrailOverrides telemetry) through the
 *               SAME checkSectorCap math and the SAME preconditions as the
 *               enforce path — the measured volume is exactly what enforce
 *               would do, never a drifted parallel rule. Vehicle for reading
 *               real would-block volume before the flip.
 *   'enforce' — full behavior: the min(user, 35%) slot cap is injected at the
 *               cron call site and blocks the 3rd-in-sector swap (2 of 6
 *               allowed, 3 of 6 blocked on the flat6 book).
 *
 * Default 'off' (DARK-INERT at merge). Scope: TOURNAMENT (flat6) Diversifier
 * battles only (founder Option A); user-authored maxSectorWeight guardrails
 * are live Phase-4B behavior and fire under EVERY state of this flag. Walk
 * 'off' → 'observe' → 'enforce' as a Release-4 staged-activation step,
 * founder-executed — never in a build PR (the PR #510 lesson). See
 * api/_utils/agentGuardrails.js (the sector-SLOT rule block).
 */
export const SECTOR_CAP_MODE = 'off';

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

/**
 * Correlation Intelligence V3 Phase 1, Sub-build 1 — the "relationship-quality"
 * bundle (member contribution, SPY-adjusted partial correlation, self-percentile,
 * down/up beta-capture asymmetry, tail co-movement, past stability, driver-side
 * context). Additive-only: pure math over data already fetched.
 *
 * Built/merged DARK (FALSE). While FALSE the two research endpoints compute the
 * new `relationshipQuality` / `rq` blocks NOWHERE and skip the extra SPY fetch in
 * the deep dive, so the payload is byte-identical to today; the Lab renders no new
 * cards. Nested under CORRELATION_LAB_ENABLED — meaningless when the Lab is off.
 *
 * Flip in a one-line follow-up PR after a founder Vercel-preview smoke (the
 * SCOUTING_BOARD_ENABLED precedent) — never in the build PR.
 */
export const CORRELATION_RELATIONSHIP_QUALITY_ENABLED = true;

/**
 * Correlation Intelligence V3 Phase 1, Sub-build 2 — the "synthesis + summary
 * contract" bundle: the server-computed read-quality evidence checklist (a §9
 * checklist of displayed facts, never a score), the honest "since your last
 * scan" comparison + change events, and THE SUMMARY CONTRACT — a versioned,
 * facts-only, presentation-scoped object written beside the payload at cache
 * time (the object Phase-2 voice narration and future agent consumption both
 * read — "one engine, two surfaces").
 *
 * Built/merged DARK (FALSE). Dependency rule enforced at every read site:
 * synthesis features compute/serialize/render ONLY when
 * CORRELATION_SYNTHESIS_ENABLED && CORRELATION_RELATIONSHIP_QUALITY_ENABLED
 * (see synthesisActive() in api/research/summaryContract.js — the on/off
 * misconfiguration short-circuits dark with a single console.warn). While
 * FALSE the two research endpoints add NO summaryContract / evidence /
 * comparison / dataAsOf fields, so the payload is byte-identical to today and
 * the Lab renders no new panels. Nested under CORRELATION_LAB_ENABLED and
 * sibling to CORRELATION_RELATIONSHIP_QUALITY_ENABLED — meaningless when either
 * is off.
 *
 * Flip in a one-line follow-up PR after a founder Vercel-preview smoke (the
 * CORRELATION_RELATIONSHIP_QUALITY_ENABLED precedent) — never in the build PR.
 */
export const CORRELATION_SYNTHESIS_ENABLED = true;

/**
 * Correlation Intelligence V3 Phase 1, Sub-build 3 — the EXTENDED DRIVER TIER
 * (Bucket A): five two-gate-verified drivers (SMH, CPER, FXY, TIP, EMLC) added
 * to the registry as `tier: 'extended'`, admitted as an OPT-IN tier under the
 * comparison-tax rule (more drivers dim existing signals, so the default scan
 * stays at the 25 core drivers).
 *
 * Built/merged DARK (FALSE). While FALSE the extended drivers enter NO scan and
 * NO deep dive: the scan's effective driver universe is core-only (so its docId
 * salt + driverUniverseHash are byte-identical to the pre-build 25-driver
 * values — the dark merge orphans no cached scans and manufactures zero
 * not_comparable days), the deep-dive endpoint treats an extended driver key as
 * invalid_driver, and the Lab hides the "Include extended drivers (5)" scan
 * toggle + the "Extended" driver-select optgroup. When TRUE, the extended
 * drivers are scannable ONLY when the user ALSO opts in via the toggle
 * (includeExtended in the scan body); the deep-dive optgroup becomes selectable.
 *
 * The permanent driver-audit tool (api/research/driver-audit.js, reachable via
 * the Lab's `?driverAudit=1` dev param) is gated by CORRELATION_LAB_ENABLED
 * ONLY — NOT this flag — so the two-gate verification runs on the Vercel preview
 * while this tier is still dark. Nested under CORRELATION_LAB_ENABLED —
 * meaningless when the Lab is off.
 *
 * Flip in a one-line follow-up PR after the founder two-gate smoke (the
 * CORRELATION_SYNTHESIS_ENABLED precedent) — never in the build PR.
 */
export const CORRELATION_EXTENDED_DRIVERS_ENABLED = true;

/**
 * Correlation Intelligence V3 Phase 2 — THE NARRATED LAB: the deep-dive
 * "Explain this read" voice. A pure deterministic plan builder selects/orders
 * the claims and renders every value/date/name/band into exact display spans;
 * the Gemma voice layer RENDERS (picks one approved sentence frame per claim +
 * a connective — it does not author); a conformance validator proves the output
 * is exactly the approved frames with the exact server spans and nothing else.
 * On any plan/model/validation failure the endpoint falls to the deterministic
 * verdict sentence (the "standard summary"). Narration is strictly downstream of
 * an existing cached deep-dive contract — the endpoint never recomputes.
 *
 * Built/merged DARK (FALSE). Dependency rule enforced at the endpoint guard via
 * narrationActive() (mirrors summaryContract.js:synthesisActive): narration
 * computes/serves ONLY when CORRELATION_NARRATION_ENABLED &&
 * CORRELATION_LAB_ENABLED && CORRELATION_SYNTHESIS_ENABLED (the summary contract
 * only exists when synthesis is active, so narration must require it). While
 * FALSE the /api/research/correlation-narrate endpoint returns 404 (dark =
 * invisible: no reads, no model call, no cache writes) and the Lab renders no
 * "Explain this read" button — byte-identical to today. Nested under
 * CORRELATION_LAB_ENABLED and sibling to CORRELATION_SYNTHESIS_ENABLED —
 * meaningless when either is off.
 *
 * Flip in a one-line follow-up PR after a founder Vercel-preview smoke (the
 * CORRELATION_SYNTHESIS_ENABLED precedent) — never in the build PR.
 */
export const CORRELATION_NARRATION_ENABLED = true;

/**
 * Agent Learning System — L1 Foundation (Phase A) raw capture.
 *
 * THE MASTER KILL-SWITCH for the entire L1 capture path. Release classification
 * DARK-INERT: nothing user-visible, nothing reaching the trading brain, no
 * scoring change. Architecture V1.3 (FROZEN).
 *
 * When FALSE (default, and the value at merge), the capture path is a strict
 * NO-OP: the swap-execution site in api/cron/agent-evaluate.js never builds a
 * receipt, never touches Firestore, and adds ZERO latency to the decision path
 * (the call is behind a plain `if (LEARNING_L1_CAPTURE_ENABLED)` guard, so the
 * branch is never entered). The decision path is byte-identical to before this
 * build.
 *
 * When TRUE (a preview-only experiment; NEVER flipped in a build PR), each
 * executed autopilot swap emits a RAW receipt to learningReceipts/{battleId}/
 * receipts/{receiptId} via the Admin SDK — raw fields only, no derived metric,
 * no classification, no scoring. All four learning collections are server-write-
 * only (firestore.rules), so the receipt can only be written server-side.
 *
 * This flag gates capture ONLY. No dossier/atom writer ships in L1 (Signal
 * Capture Rider §5: capture only, pre-launch). Flip is a Phase-B concern.
 */
export const LEARNING_L1_CAPTURE_ENABLED = true;
