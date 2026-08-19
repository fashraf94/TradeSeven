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
// Pinned by: activeNavigation.shelvedSurfaces.test.jsx (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
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
// Pinned by: activeNavigation.shelvedSurfaces.test.jsx (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
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
export const FORGE_HARDSOFT_AUTHORING_ENABLED = true;

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
 * Per-Battle Loadout + Per-Type Concurrency — Phase 1 (the casual clone).
 * Design lock: docs/../20260805_PER_BATTLE_LOADOUT_CONCURRENCY_DESIGN_LOCK_V1.
 *
 * When TRUE, a Command-Center BaggerBomb deploy runs on a PERSISTENT per-user
 * "casual clone" agent (agents/casual-agent-{odUserId}) — a behavioral clone of
 * the player's ranked agent with its OWN agentId — instead of the real ranked
 * agent. Because the one-active-battle lock in decide.js is agentId-scoped, the
 * clone delivers "one BaggerBomb at a time" for free AND lets BaggerBomb run
 * CONCURRENTLY with a ranked league game, with ZERO fenced edits (the
 * training-clone precedent). UNLIKE training (which isolates), a casual battle is
 * the player's REAL game, so its record + learning are REDIRECTED forward to the
 * parent ranked agent at the settlement/learning layer (attribution redirects),
 * preserving exactly what BaggerBomb contributes today.
 *
 * When FALSE (default), NOTHING creates a casual clone: agentDeploy deploys the
 * real ranked agent exactly as today, no battle ever carries a `casual-agent-`
 * agentId, and every attribution-redirect + ranked-lookup-exclusion branch (all
 * keyed on that prefix) is inert — so flag-off is byte-identical.
 *
 * The flag gates CREATION only (agentDeploy); the redirects key on the id prefix
 * so a mid-pilot rollback still attributes existing casual battles correctly. Do
 * NOT flip it in a build PR (the PR #510 lesson) — only after a Vercel preview.
 */
export const CASUAL_CLONE_CONCURRENCY_ENABLED = false;

/**
 * League Battleview Routing (Spec V1.2, Phase A) — the Command Center live-game
 * card path. When a tapped game is a flat-6 LEAGUE battle
 * (gameMode === 'baggerbomb_tournament'), route it to the League Arena instead of
 * the BaggerBomb AgentBattleScreen.
 *
 * Default OFF (dark): no URL param → false → BattleViewScreen ignores gameMode and
 * league battles fall through to the existing agentDeployed→AgentBattleScreen
 * branch, byte-identical to today (the mis-route stays, but dark). gameMode is
 * still propagated through the card mappers when off (an inert extra field), so
 * enabling this is the only behavior change.
 *
 * PREVIEW SMOKE OVERRIDE (Spec V1.2, Correction 2): `?leagueRouting=1` force-
 * enables it in a Vercel preview WITHOUT flipping the shipped default — the
 * arenaLiveGate.js `?battleArenaLive=1` idiom. The production flip stays a
 * separate one-line PR after smoke (the LEAGUE_BATTLE_VIEW_V2_ENABLED / PR #510
 * precedent): change the base to `true || (…)`, never in the build PR.
 */
export const LEAGUE_BATTLEVIEW_ROUTING_ENABLED = true;
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('leagueRouting') === '1';

/**
 * League Battleview LIVE ORB (Phase B, Option X) — the whole live all-seats orb as
 * ONE unit. When ON, the arena climb goes live for EVERY seat this tick:
 *   • YOUR seat — the per-tick client path (youLiveScore) is allowed in RANKED too
 *     (not only training), keeping every other #572 guard (BATTLE, activation-day,
 *     not-yet-banked, real battle);
 *   • RIVALS — their live composite is sourced from the read-only endpoint
 *     (GET /api/tournament/live-composites), the only place a rival's owner-scoped
 *     agent six can be summed (B1 hard-stop). YOUR seat is NEVER routed through the
 *     endpoint (Option X): it stays on youLiveScore.
 * The two halves flip together so the climb is never your-live-vs-rivals-banked.
 *
 * Default OFF (dark): no URL param → false → the orb is exactly today (training
 * keeps its existing your-seat live orb; ranked stays banked; rivals banked; no
 * endpoint poll). Enabling is the only behavior change — byte-identical when off.
 *
 * PREVIEW SMOKE OVERRIDE: `?leagueLiveOrb=1` force-enables it in a Vercel preview
 * WITHOUT flipping the shipped default (the arenaLiveGate.js `?battleArenaLive=1`
 * idiom). Smoke alongside routing: `?leagueRouting=1&leagueLiveOrb=1`. The
 * production flip stays a separate one-line PR after smoke (the PR #510 precedent).
 */
export const LEAGUE_LIVE_ORB_ENABLED = true;
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('leagueLiveOrb') === '1';

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
export const LEAGUE_CANONICAL_OPEN_CAPTURE = true;

/**
 * League — SCORE HISTORY / recap (Level 1 per-day composite timeline + swap
 * history) in the Film Room.
 *
 * The shipped decomposition strip answers "how is TODAY built" but (a) leaves
 * `BANKED` a single opaque aggregate, and (b) vanishes at the bank (the live
 * path is gated on `!dayBanked`). This flag lights the across-the-battle half:
 * the Film Room (the complete-state "break the seal" overlay, until now an empty
 * placeholder) fills with the per-day composite timeline and the per-day swap
 * ledger, and becomes reachable BOTH during a live battle (a "week so far"
 * entry) and — via a dedicated most-recent-COMPLETED group read that mirrors the
 * voided-card read — after the bank, so the recap survives completion.
 *
 * Every number shown is already persisted or re-derivable (NO new persistence):
 * Level 1 is a pure read of `dailyScores.dayN.closeScores[uid].compositePoints`
 * (buildClimbSeries); swaps are the per-day `agentBattles.trades[]` chain the
 * client already fetches then discards (pickCurrentTournamentBattle). Swap
 * points reconcile with the live strip's SWAPS term BY CONSTRUCTION — both
 * derive from `buildSwapLedger` (BUILD_RULES §9). Per-symbol agent BASE for
 * prior days is NOT persisted (aggregate only) and is labelled unavailable,
 * never approximated.
 *
 * When false (DEFAULT, merge-dark): the Film Room keeps its placeholder, no
 * completed-group read is subscribed, `useMyTournamentBattle`'s chain is unread,
 * and nothing new renders on any surface — flag-off is byte-identical.
 *
 * PREVIEW SMOKE OVERRIDE: `?leagueScoreHistory=1` force-enables it in a Vercel
 * preview WITHOUT flipping the shipped default (the `?leagueLiveOrb=1` /
 * `?battleArenaLive=1` idiom). The production flip stays a separate one-line PR
 * after the founder smokes the preview (the PR #510 precedent).
 */
export const LEAGUE_SCORE_HISTORY_ENABLED = true;

// The resolved gate consumers read (the ARENA_LIVE_ON idiom): the shipped
// default OR the preview param. Evaluated once at module load. Never pin THIS —
// pin LEAGUE_SCORE_HISTORY_ENABLED (the literal) if a suite must assert the dark
// default.
export const LEAGUE_SCORE_HISTORY_ON =
  LEAGUE_SCORE_HISTORY_ENABLED ||
  (typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('leagueScoreHistory') === '1');

/**
 * League — Competitive Live Draft (slot lobbies). The interactive live draft
 * as the competitive entry: a weekly schedule of draft slots (config-driven),
 * a user claims a seat, and a slot with ≥1 human at fire time drafts (CPU fills
 * the empty seats); a slot nobody claims never materializes.
 *
 * When false (DEFAULT, merge-dark), competitive formation behaves EXACTLY as
 * today: a group forms and is resolved single-shot at the Monday lock (the
 * runMondayPipeline FORMING path). The slot schedule is never consulted, the
 * slot-* endpoints 404 (the SCOUTING_BOARD defense-in-depth pattern), no slot
 * group is ever created, and nothing reads `scheduledDraftAt` / `battleStartWeek`
 * / `isLiveDraft` — so flag-off is byte-identical (the standing bar).
 *
 * When true, the slot picker (Phase 4) claims a seat via the slot-* endpoints;
 * the first claim lazily creates a FORMING slot group stamped with its fire
 * instant + Monday battle anchor; a dedicated every-10-minute fire cron (Phase 2)
 * CPU-fills and opens the interactive draft. The `status==='battle'` firewall is
 * untouched — a slot group is invisible to the sweep / banking / scorers until
 * the open, exactly like any other pre-battle group.
 *
 * Built/merged DARK behind this flag across Phases 1–5; flip to ship only after
 * the founder's preview smoke (a real slot claim → draft → battle) — never in a
 * build PR (the PR #510 / LEAGUE_NEXT_ARC_ENABLED precedent).
 */
export const LEAGUE_LIVE_DRAFT = true;

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
export const TRAINING_POD_DRAFT_V2_ENABLED = true;

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
 * League Training — Training Pod Draft V2, DESKTOP layout for the rebuilt
 * AWAITING-OPEN pod (AwaitingOpenPodView). INDEPENDENT of
 * TRAINING_POD_DRAFT_V2_ENABLED (which is LIVE) — this gates ONLY the desktop
 * reflow of the awaiting-open body, and only at/above the ≥1024 desktop
 * breakpoint (useIsMobile({ tabletBreakpoint: 1023 }), matching the lobby's
 * DraftBoardRoom < 1024 split pixel-for-pixel). Presentation only — no data,
 * scoring, decision, or claims-logic change; the same V2 children are
 * re-arranged, never re-wired; the calibration fence is untouched.
 *
 * Flag-off (default) = today's single-column AwaitingOpenPodView at EVERY width,
 * byte-identical (instant rollback). Mobile (< 1024) is byte-identical flag on
 * or off. Flag-on + desktop = the §2 reflow: full-width countdown + draftboard,
 * a 1.7fr/1fr body (best-remaining free agents left, the claims builder as a
 * sticky rail right), full-width feed, the whole view inside one bounded-height
 * scroll frame the rail pins within (the app's overflow-x:hidden #root breaks a
 * document-scroll sticky — Phase-0 discovery).
 *
 * Built/merged DARK; flip in a one-line follow-up PR after a Vercel preview
 * smoke (the TRAINING_POD_DRAFT_V2_ENABLED precedent) — never in the build PR.
 */
export const TRAINING_POD_DESKTOP_ENABLED = true;

/**
 * The ONE home for the desktop gate — the flag OR the `?trainingPodDesktop=1`
 * dev-preview override (the `?trainingPodV2=1` idiom). SSR/Node-safe (guards
 * `window`); a malformed URL degrades to the flag alone.
 */
export function isTrainingPodDesktopOn() {
  if (TRAINING_POD_DESKTOP_ENABLED) return true;
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('trainingPodDesktop') === '1';
  } catch {
    return false;
  }
}

/**
 * League Training — "Awaiting the Open" REDESIGN of the practice pod's
 * awaiting-open body (AwaitingOpenPodView). Visual + structural, presentation
 * only: layered surfaces, atmosphere, a hero countdown, a full-width draftboard
 * panel, and a wire panel whose rows each carry their own Claim — replacing the
 * standalone two-dropdown claims builder with a per-row swap sheet.
 *
 * INDEPENDENT of TRAINING_POD_DRAFT_V2_ENABLED and TRAINING_POD_DESKTOP_ENABLED
 * (both LIVE) — this gates ONLY the redesigned awaiting-open body. Flag-off
 * (default) = today's screen at every width, byte-identical (instant rollback).
 *
 * No data, scoring, decision, or claims-logic change: the same reads, and claims
 * still go through the unchanged placeClaim({ groupId, dropSymbol, addSymbol })
 * — the redesign changes the UI that CALLS it, never the call. The calibration
 * fence is untouched. Ranked (LiveDraftAwaiting) is a separate component and is
 * not touched.
 *
 * Built/merged DARK; flip in a one-line follow-up PR after a Vercel preview
 * smoke (the TRAINING_POD_DESKTOP_ENABLED precedent) — never in the build PR.
 */
export const AWAITING_OPEN_REDESIGN_ENABLED = false;

/**
 * The ONE home for the redesign gate — the flag OR the `?awaitingOpenRedesign=1`
 * dev-preview override (the `?trainingPodDesktop=1` idiom). SSR/Node-safe
 * (guards `window`); a malformed URL degrades to the flag alone.
 */
export function isAwaitingOpenRedesignOn() {
  if (AWAITING_OPEN_REDESIGN_ENABLED) return true;
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('awaitingOpenRedesign') === '1';
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
// Pinned by: ruleConflictReconciler.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
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
// Pinned by: ruleConflictReconciler.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
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
export const ARCHETYPE_INTEGRITY_MODE = 'enforce';

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
 *
 * LIVE-STATE PROVENANCE (Sector Cap Activation arc, founder-ruled 2026-07-23):
 * advanced from the malformed 'true' (out-of-vocabulary — it matched neither
 * 'enforce' nor 'observe', so both gates early-returned and the cap behaved as
 * 'off') to 'observe', the first real step of the walk. This activates
 * MEASUREMENT only: every swap the enforce cap would block is recorded as a
 * would_block_swap override in the eval record (durable) plus a [SectorSlot]
 * would_block log line, through the SAME math as enforce — nothing is blocked
 * and no decision changes. Executed as its own deliberate founder-ruled
 * activation step (the PR #600 flip precedent), not bundled with unrelated
 * feature work. 'enforce' remains a LATER, separate founder flip, gated on
 * reading this observe telemetry (runbook Rule 3: the observe read is the
 * go/no-go input).
 */
export const SECTOR_CAP_MODE = 'observe';

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
export const RULE_COMPAT_MODE = 'enforce';

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
 * When FALSE, the capture path is a strict NO-OP: the swap-execution sites in
 * api/cron/agent-evaluate.js never build a receipt, never touch Firestore, and
 * add ZERO latency to the decision path (every call is behind a plain
 * `if (LEARNING_L1_CAPTURE_ENABLED ...)` guard, so the branch is never
 * entered). The decision path is byte-identical to pre-L1 behavior.
 *
 * When TRUE, each executed swap at a flag-enabled capture site emits a RAW
 * receipt to learningReceipts/{battleId}/receipts/{receiptId} via the Admin
 * SDK — raw fields only, no derived metric, no classification, no scoring. All
 * four learning collections are server-write-only (firestore.rules), so the
 * receipt can only be written server-side.
 *
 * LIVE-STATE PROVENANCE (Corpus Capture Patch Phase 0b, corrects a stale
 * comment): flipped false → true in the deliberate founder flip PR #600
 * (commit 400423d8, merged 873d4791, 2026-07-12 — flags-only diff, the
 * CORRELATION_SYNTHESIS precedent). Capture at the original autopilot site is
 * LIVE. Founder ruling (Phase 1 greenlight memo, July 21 2026): the flag stays
 * TRUE — a reset inside a build PR would itself be a flag flip in a build PR,
 * and would open a corpus gap in the only class currently captured. The three
 * W2 expansion classes are additionally gated by
 * LEARNING_L1_CAPTURE_EXPANSION_ENABLED below (false until its own flip PR).
 *
 * This flag gates capture ONLY. No dossier/atom writer ships in L1 (Signal
 * Capture Rider §5: capture only, pre-launch).
 */
export const LEARNING_L1_CAPTURE_ENABLED = true;

/**
 * Corpus Capture Patch W2 — L1 capture EXPANSION to the three swap classes
 * beyond the original autopilot site: risk-manager executed swaps (incl.
 * stagnation forced rotation), gameplan-meeting rotations, and co-pilot
 * proposal execution (approved AND expired-auto-exec — 4 physical sites).
 *
 * AND-gated with the master kill-switch at every new site:
 *   LEARNING_L1_CAPTURE_ENABLED && LEARNING_L1_CAPTURE_EXPANSION_ENABLED
 *     && classifyEvidence(...) === 'live_agent'
 * The master switch still kills everything; this flag only widens CLASS
 * coverage, and has no effect on the original autopilot site.
 *
 * FALSE at merge (founder ruling, Phase 1 greenlight memo July 21 2026):
 * merge dark → preview smoke → deliberate flip PR, flipped together with
 * REGIME_STAMP_ENABLED. The flip date is the corpus E2 full-coverage boundary
 * recorded in that flip PR.
 */
// Pinned by: agent-evaluate.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const LEARNING_L1_CAPTURE_EXPANSION_ENABLED = true;

/**
 * Corpus Capture Patch W3 — write-once `regimeAtStart` stamp on agentBattles
 * docs, applied at each battle's FIRST evaluation tick (never overwritten).
 *
 * Stamps the market-level regime (bull|correction|bear|recovery) from the
 * indexIntelligence/marketContext doc the evaluator ALREADY loads per battle —
 * zero added Firestore reads. Unblocks T3 (regime-conditional) learning and
 * trial conditioning, forward-only from the flip date (Discovery A3 / P1
 * flag #1: the regime source docs are overwrite-in-place singletons, so
 * "regime during battle X" is unrecoverable retroactively).
 *
 * FALSE at merge (Build Spec §5.6): merge dark → preview smoke → deliberate
 * flip PR, flipped together with LEARNING_L1_CAPTURE_EXPANSION_ENABLED above.
 * When FALSE: no battle doc is touched, no stamp field exists — prior
 * behavior exactly. Already-stamped docs are inert data either way.
 */
// Pinned by: agent-evaluate.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const REGIME_STAMP_ENABLED = true;

/**
 * BaggerBomb opener — lazy regeneration + template floor.
 *
 * The deploy-time first-message ("opener") is generated synchronously inside the
 * deploy invocation under a ~15s Gemma abort (api/agent/decide.js
 * generateFirstMessageOnDeploy). When Gemma is slow it aborts mid-stream, the
 * truncated body fails JSON parse, and the try/catch swallows it (non-blocking by
 * design) — so tiered battles intermittently open with a silent timeline.
 *
 * When FALSE (default), behavior is byte-identical to today: the client makes no
 * ensure-opener call and POST /api/agent/ensure-opener no-ops. When TRUE, the
 * Command Center chat (AgentChat) checks on mount whether a first_message exists
 * and, if not, calls the non-fenced POST /api/agent/ensure-opener, which
 * regenerates the opener with a patient (~40s) budget + one deadline-bounded retry
 * and falls back to a deterministic template opener — so a fresh-deploy chat is
 * never silent. Late-open (chat already has content, no opener) is a deliberate
 * no-op. The fenced deploy path is untouched.
 *
 * Built/merged DARK; flip in a one-line follow-up PR after a Vercel preview smoke
 * (the SCOUTING_BOARD_ENABLED precedent) — never in the build PR.
 */
export const OPENER_LAZY_FALLBACK_ENABLED = true;

/**
 * League Tournament — advancement freeze, UNFROZEN 2026-08-07 (was an emergency
 * tourniquet; lifted after adjudication). The functional change here is the single
 * flag value; the rest is truthful history for future readers.
 *
 * HISTORY. The scoring-model anomaly (docs/audits/LEAGUE_SCORING_ANOMALY_* ) let
 * poisoned composites accumulate on in-flight groups, so this flag froze the
 * irreversible consumers of those composites BEFORE the day-5 ingestion: bracket
 * advancement + finalScores, the career-rank ratchet (appliedGroups), and the
 * seasonal-leaderboard week-row upsert for non-training battle groups. Banking was
 * never touched — daily scores kept recording. Guarded call sites: runFridayAdvancement
 * (primary), runWeekSideEffects (defense-in-depth belt), and upsertLeaderboardForGroups
 * (both leaderboard call sites at one knowledge point). When frozen, each logged
 * loudly and returned without writes.
 *
 * UNFREEZE (this change, founder-gated). Adjudicated in
 * docs/audits/20260807_LC_UNFREEZE_ADJUDICATION_CLOSEOUT_V1.md: no scoring-model
 * defect was identified (the §7 pass reduces to "confirm no model change needed"),
 * the poisoned cohort was voided (L-A) and recurrence bounded (L-B Guards 1/2), and
 * the status=='battle' enumeration was empty — re-verified immediately before merge
 * (scripts/lc-fork-adjudication.js Part A), the one time-sensitive precondition. On a
 * zero-BATTLE board the flip is a write no-op (tournamentAdvancement.test.js:281);
 * its first real effect is the next cohort's day-5 Friday close.
 */
export const TOURNAMENT_ADVANCEMENT_FROZEN = false;

/**
 * Agent Presence — the reactive agent FACE (expression rig + mood baseline + event
 * reactions + environment layer). A READ-ONLY display surface: it writes nothing,
 * gates nothing, and is removable without touching any scoring or decision path.
 *
 * When FALSE (default), NOTHING renders it — every mount site is gated on
 * isAgentPresenceOn(), so flag-off is byte-identical to today (the orb/Bot glyph render
 * exactly as before, and the binding hook never runs because the mount wrapper is never
 * mounted). When TRUE — or via the `?agentPresence=1` dev-preview param (the
 * `?trainingPodV2=1` idiom) — the face mounts on the League arena, the 1v1/training
 * battle screen, and the Command Center, each bound to the EXACT standing that surface
 * already renders (league youRank, 1v1 displayPlayerScore vs opponent, Command identity)
 * — never a parallel recompute (§9 display-agreement).
 *
 * Built/merged DARK behind this flag; flip in a one-line follow-up PR after a Vercel
 * preview smoke (the SCOUTING_BOARD_ENABLED precedent) — never in the build PR.
 */
export const AGENT_PRESENCE_ENABLED = true;

/**
 * The ONE home for the Agent Presence gate — the flag OR the `?agentPresence=1`
 * dev-preview override. SSR/Node-safe (guards `window`); a malformed URL degrades to
 * the flag alone.
 */
export function isAgentPresenceOn() {
  if (AGENT_PRESENCE_ENABLED) return true;
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('agentPresence') === '1';
  } catch {
    return false;
  }
}

/**
 * Matchups Backdrop — ports the PvP view's animated particle/constellation
 * canvas (BaggerBombBackground) plus the bolder gradient tier headers into the
 * AgentBattleScreen Matchups tab, recolored to the teal/mint accent. Merged
 * DARK; flip in a one-line follow-up after a Vercel preview smoke (the
 * AGENT_PRESENCE_ENABLED precedent). One shared flag gates BOTH the backdrop
 * and the header/band restyle so flag-off is byte-identical to today.
 */
export const MATCHUPS_BACKDROP_ENABLED = true;

/**
 * The ONE home for the Matchups Backdrop gate — the flag OR the
 * `?matchupsBackdrop=1` dev-preview override. SSR/Node-safe (guards `window`);
 * a malformed URL degrades to the flag alone (the isAgentPresenceOn idiom).
 */
export function isMatchupsBackdropOn() {
  if (MATCHUPS_BACKDROP_ENABLED) return true;
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('matchupsBackdrop') === '1';
  } catch {
    return false;
  }
}

/**
 * Training-Pod P0 R3 — the rolling stale-pod expiry backstop. Server-only; gates
 * the orchestrator's per-tick `expireStaleTrainingPods` sweep, which retires
 * training pods stranded pre-BATTLE (FORMING orphans, wedged DRAFTING drafts the
 * idle sweep could not complete, AWAITING_OPEN pods whose flip failed past an
 * arrived anchor) to the terminal EXPIRED status — never retro-advancing them
 * (D1 ruling). Founder-gated one-time cleanup runs the SAME core off-tick.
 *
 * When FALSE (DEFAULT, merge-dark), the orchestrator NEVER calls the sweep — the
 * tick is byte-identical to today, no pod is ever expired, and the EXPIRED
 * machinery (R2) stays inert. When TRUE, the sweep runs each weekday-morning tick
 * AFTER the awaiting-open flip (so a pod that legitimately advances this tick is
 * never expired; the expire's state+version precondition closes the residual
 * race). Flip only after a founder smoke — never in a build PR (the
 * LEAGUE_NEXT_ARC_ENABLED / PR #510 precedent).
 */
export const POD_EXPIRY_SWEEP_ENABLED = false;

/**
 * Archetype Architecture Phase 2 (P2.4a) — the equip-time build compiler
 * (PHASE2_BUILD_BRIEF_V1; Spec §4.4 + A-2/A-3). Gates the settings
 * endpoints' in-transaction compile + CompiledBuild write
 * (api/_utils/compileOnSettingsChange.js) to
 * agents/{agentId}/compiledBuilds/{gameMode}.
 *
 * When FALSE (DEFAULT, merge-dark), every settings endpoint is byte-identical
 * to today: the compile helper returns null before any read or write — zero
 * added Firestore I/O, no response-shape change. When TRUE (preview smoke
 * only in Phase 2), each real settings write also compiles the build for the
 * live deploy modes inside the SAME transaction (riding the structural
 * settingsRev increment — A-3: the compile mints the revision) and the
 * response gains a compilePreviews payload.
 *
 * PRODUCTION ACTIVATION IS DOUBLE-GATED: this flag AND the §5.6/A-4 metadata
 * completeness gate (api/_utils/activationGate.js), which FAILS by design
 * until Phases 3-4 author the corpus. Until then enabled compiles record
 * validation.pass=false (truthful pre-authoring state) and the deploy path
 * (P2.4b) refuses them. Flip only via a deliberate founder flag-flip PR with
 * a green activation gate — NEVER in a build PR (Phase 2 exit criteria).
 */
// Pinned by: compileOnSettingsChange.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const COMPILER_ENABLED = false;

/**
 * Archetype Architecture Phase 2 (P2.5, §7-signed fence contact) — the
 * ResolvedAgentManifest block written by createAgentBattle adjacent to the
 * agentContext snapshot (Spec DR-6; built by the non-fenced
 * api/_utils/resolvedAgentManifest.js kernel, the buildCustomizationSnapshot
 * precedent).
 *
 * When FALSE (DEFAULT, merge-dark), createAgentBattle's battle doc is
 * byte-identical to today (the P4 equivalence battery is the lock) — no
 * manifest field exists anywhere. When TRUE (preview smoke only in Phase 2),
 * every new battle doc carries `resolvedAgentManifest` frozen at creation:
 * create-only-after-start holds by construction (the block is born in the
 * single creation write and no updater exists — R1-4).
 *
 * ZERO READERS MIGRATE IN PHASE 2: agentContext remains the runtime
 * authority throughout (brief P2.5); manifest-read migration is a later
 * phase behind the DR-10 two-stage validation. Flip only via a deliberate
 * founder flag-flip PR — never in a build PR.
 */
// Pinned by: agentBattleService.test.js, resolvedAgentManifest.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const MANIFEST_WRITE_ENABLED = true;

/**
 * Archetype Architecture Phase 2 (P2.6) — tick-side shadow assembly +
 * behavior-record envelope plumbing (api/_utils/shadowAssemblyCapture.js,
 * riding the non-fenced agent-evaluate tick; Spec DR-10 stage 1 + A-1 +
 * §6.3/§6.4).
 *
 * When FALSE (DEFAULT, merge-dark), the tick never calls into the capture
 * module — no shadow prompts, no shadowDiffs writes, no gate aggregates, no
 * settlement records, no receiptCoverage stamp: byte-identical ticks and
 * settlements. When TRUE (preview smoke only in Phase 2), each battle-tick
 * with a manifest builds the A-1 envelope once, writes the awaited
 * create-only shadow diff to agentBattles/{id}/shadowDiffs/{tickId}
 * (assembly-only — NO second LLM call; near-free vs the eval budget), rides
 * the §6.3 aggregates on the existing finalUpdate, and completeBattle
 * attaches the §6.4 battleSettlements record post-commit with the
 * receiptCoverage retry marker. Pre-manifest battles are skipped entirely
 * (the envelope is manifest-anchored; no envelope-less record ever exists).
 * Flip only via a deliberate founder flag-flip PR — never in a build PR.
 */
// Pinned by: shadowAssemblyCapture.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const SHADOW_ASSEMBLY_ENABLED = true;

/**
 * Deploy Ceremony Phase 2 (client) — the three-act deploy experience:
 * hold-to-deploy (Act 1), the checkpoint-driven thinking theater (Act 2), and
 * the "ready for battle" reveal (Act 3). Consumes the inert deployProgress
 * telemetry shipped in Phase 1 (api/agent/decide.js).
 *
 * When FALSE (DEFAULT, merge-dark), the deploy flow is byte-identical to today:
 * tap-to-deploy, the "Deploying…" label, the fused auto-navigation to the battle
 * view, and the existing success toast — instant rollback. When TRUE — or via
 * the `?deployCeremony=1` dev-preview override (the isAgentPresenceOn idiom) —
 * every deploy entry point becomes hold-to-arm, the ceremony overlay mounts at
 * the Command Dashboard shell and plays the real pipeline, and navigation defers
 * to an explicit "Enter the battle" CTA (the toast is suppressed — the reveal is
 * the confirmation).
 *
 * Built/merged DARK behind this flag; flip in a one-line follow-up PR after a
 * Vercel preview smoke (the AGENT_PRESENCE_ENABLED / SCOUTING_BOARD_ENABLED
 * precedent) — never in the build PR.
 */
export const DEPLOY_CEREMONY_ENABLED = true;

/**
 * The ONE home for the Deploy Ceremony gate — the flag OR the `?deployCeremony=1`
 * dev-preview override. SSR/Node-safe (guards `window`); a malformed URL degrades
 * to the flag alone. Every ceremony mount/branch site gates on this helper, never
 * on the raw const and never on a locally re-read URL (the isAgentPresenceOn /
 * isTrainingPodDraftV2On precedent).
 */
export function isDeployCeremonyOn() {
  if (DEPLOY_CEREMONY_ENABLED) return true;
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('deployCeremony') === '1';
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FANTASYTIMES WIRE — AGENT-FIRST NEWS ARC, Phase 1 (Spec V1.5 §4.8)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Wire timing instrumentation ONLY — per-seam duration samples into the
 * server-only wireMetrics/{date} doc (bounded, cap 500/seam/day). Never
 * touches the model request object or persisted story content; §9 asserts
 * payload equality with metrics on, writes off. Flipped FIRST (≥3 trading
 * days) to capture the p95 baseline the §6.1 gate needs.
 */
// Pinned by: wireFlags.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const WIRE_METRICS_ENABLED = true;

/**
 * The Wire writes machinery: cloned extended tool schema + agentFacts prompt
 * instructions + extraction + validation + digest rendering + the story/
 * envelope batch, Wire transaction, receipts, chainId resolution, replay
 * sweep + raised max_tokens.
 *
 * FLIPPED false→true in the founder flag-flip PR (runway: metrics → 3-day
 * baseline → writes), after the metrics baseline landed. The merge-dark era is
 * over; TRUE is now the default and FALSE is the deliberate-revert path.
 *
 * When TRUE (CURRENT): the write path is live — the cloned schema, agentFacts
 * extraction/validation, digest rendering, and the persisted story/envelope
 * batch all run. When FALSE (revert): byte-identical outbound model request
 * payload vs the pre-Wire build (M8 — dark means dark at the model-request
 * boundary). Continuity/newsline still AND-gate on this flag via getWireFlags,
 * so each stays dark until its own flip. Each flip is its own one-line PR
 * (Pushed ≠ deployed).
 */
// Pinned by: wireFlags.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const WIRE_WRITES_ENABLED = true;

/**
 * Continuity prompt block ONLY (reporter's recent Wire digests + eventTypes
 * + dates — never headlines; P7/M3). Requires WIRE_WRITES_ENABLED — the
 * resolution point (api/_utils/wireFlags.js getWireFlags) enforces the
 * dependency; this raw const is never read directly by call sites.
 */
// Pinned by: wireFlags.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const CONTINUITY_MEMORY_ENABLED = false;

/**
 * Phase 2 N1 — Gemma's voiceLayerCache newsLine (Spec V1.2 N1, V1.5 R4-M2).
 * The first NEW Wire consumer: per portfolio/bench symbol, whole validated
 * digests packed under the exact 240-code-unit ceiling into
 * voiceLayerCache/{battleId}.newsLines, rendered by voiceLayerPrompt's
 * battle fall-through as referenceable context (never instructions).
 *
 * Requires WIRE_WRITES_ENABLED — with writes off there are no Wire entries
 * to read; the resolution point (getWireFlags) enforces the dependency, so
 * no call site can run the newsLine dark-solo. FALSE = the cache doc is
 * field-wise byte-identical (no newsLines field) and the cache tick makes
 * ZERO fantasyTimesWire reads (P2-1). Flips LAST in the §4 sequence (step
 * 7), at founder discretion once dark-solo health is clean. Each flip is
 * its own one-line PR (Pushed ≠ deployed).
 */
// Pinned by: wireFlags.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const WIRE_NEWSLINE_ENABLED = false;

/**
 * Phase 2 N3 — the weekly Wire editorial review (Spec V1.2 N3, D-P2-12).
 * Rides process-pending-reflections.js as the LAST tenant (reflections →
 * Wire sweep → editorial, R4-M5): Sunday-gated, isolated try/catch, hard
 * remaining-budget floor — the sweep's budget is inviolable. One
 * deterministic sample per ISO week; deterministic adapters carry the
 * gate-bearing verdicts; one Sonnet advisory pass (chunked) rides
 * wireModelCall; immutable runs land in wireEditorial/{isoWeek} with a
 * 90-day retention (memos must outlive the Wire's 30-day window).
 *
 * No hard flag dependency (per the V1.2 flag table): with writes off the
 * weekly frame is empty and runs record `insufficient` — harmless but
 * noisy, which is why the §4 sequence flips this AFTER WIRE_WRITES_ENABLED
 * (step 5: first Sunday after writes). Each flip is its own one-line PR
 * (Pushed ≠ deployed).
 */
// Pinned by: wireFlags.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const EDITORIAL_REVIEW_ENABLED = false;

/**
 * Alex Catalyst Confirmation mini-arc (spec V1.1) — F2 EXA supplementary
 * retrieval. When TRUE (CURRENT), the confirmed-mover path fetches EXA /search
 * evidence alongside the existing Sonar/validated-catalyst context and presents
 * both as tagged [ATTRIBUTION]/[CONTEXT] channels. When FALSE (revert): the EXA
 * client is never called and the mover prompt is byte-identical to the
 * Sonar-only path — F1+F3 carry ZERO EXA dependency (C9). DOWNGRADED per the C9
 * ruling: EXA is supplementary context, never a catalyst oracle; the honesty
 * floor is the expected outcome on fast movers.
 *
 * FLIPPED false→true in the founder flag-flip PR after the cost/quality review.
 * TRUE is now the default and FALSE is the deliberate-revert path. Not pinned by
 * any test and not dark-by-design, so the flag-pin guard needs no entry for it;
 * its sole consumer is api/fantasytimes/generate-mover.js. Its own one-line PR
 * (Pushed ≠ deployed).
 */
export const EXA_RETRIEVAL_ENABLED = true;

/**
 * Archetype Architecture Phase 3 — the DR-13 eval-time archetype identity
 * block (api/_utils/evalIdentityBlocks.js): the six constitution golden
 * renders + the shared subordination clause, injected into the Haiku
 * eval/swap system prompt ahead of the first ━━━ banner (both prompt
 * variants) once the Commit-2 fenced splice lands.
 *
 * FLIPPED false→true in the founder flag-flip PR (DR-13 endgame) — after the
 * dark-flag shadow diff and the offline paired-eval harness pass: 840 paired
 * decisions across temperature 0 and 0.4 showed zero decision drift, so the
 * block ships identity-consistent reasoning (conviction + rationale framing),
 * not measurable decision change at current gate settings. The merge-dark era
 * is over; TRUE is now the default and FALSE is the deliberate-revert path.
 *
 * When TRUE (CURRENT), each eval tick's system prompt carries the deciding
 * archetype's identity block — the P4 battery's real-flag eval snapshots are
 * now the ON-state texts of record; unknown keys omit the block and log (never
 * substitute a default identity). When FALSE (revert), renderEvalIdentityBlock
 * returns '' for every key and both eval prompts fall back byte-identical to
 * the pre-DR-13 text — the inert path the injection test's flag-off arm locks.
 */
export const EVAL_IDENTITY_BLOCK_ENABLED = true;

/**
 * Swap Motive Observability (Tier 1) — the Film Room per-swap reason display.
 * DARK by default: when FALSE (CURRENT), the ledger renders exactly as before
 * (no reason label on any row) — flag-off byte-identity. When TRUE, every swap
 * row shows a human-readable reason (declared model motive, deterministic
 * taxonomy, or the graceful legacy fallback). Gates ONLY the display; the
 * swap_type schema field and the swapMotive stamp are additive and inert to all
 * existing readers regardless of this flag.
 */
export const SWAP_MOTIVE_DISPLAY_ENABLED = false;

/**
 * Fundamental Wire arc (Jul 25 2026 founder rulings D1–D7) — the peerRankings→
 * stockRankings fundamentals mirror (Commit 1) + the two prompt render blocks
 * that read it (Commit 2, §7-gated fence contact).
 *
 * FLIPPED false→true Jul 25 2026 (`c45f936c`, founder flag-flip commit after
 * the production-shaped render smoke). The merge-dark era is over; the
 * paragraphs below are the ON contract, and the off-state is now the
 * deliberate-revert path, not the default.
 *
 * When TRUE (CURRENT): each stock entry carries the D3 minimal fundamentals
 * sub-object (trailingPE {value, sectorMedian}, priceBookMRQ,
 * revenueGrowthPct, marketCapClass, earningsRevisions30d, real-only beatRate,
 * surpriseMagPercentile, per-entry peerRankings computedAt provenance), the
 * eval live-context gains the FUNDAMENTALS block (holdings + bench), and the
 * draft/board CSV gains the 3-column fundamentals group — all null-honest
 * (an absent metric renders absent, never a neutral default). The P4 battery
 * file snapshots are the ON-state texts of record (the two
 * buildStrategySystemPrompt goldens + buildPortfolioSystemPrompt carry the
 * PE_VS_SECT|REVG_PCT|MCAP_CLS vocabulary); the on-state FUNDAMENTALS block
 * and market-CSV goldens live under `api/_utils/__fundwire_snapshots__/`.
 *
 * When FALSE (revert path): compute-index-intelligence writes a stockRankings
 * doc with no `fundamentals` key on any stock entry, and every
 * fundamentalsRender.js helper returns ''/null so both prompt assemblers
 * render byte-identically to the pre-Fundamental-Wire text. That inertness
 * stays covered by the call-time flips in fundamentalsRender.flagOn.test.js.
 *
 * Reverting is as deliberate as the flip was: it must edit the ON-state
 * assertions in fundamentalsRender.test.js and regenerate the P4 battery
 * goldens in the SAME commit, exactly as the flip's reconciliation did.
 */
// Pinned by: fundamentalsRender.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const FUNDAMENTAL_MIRROR_ENABLED = true;

/**
 * Delight Layer Task 2 — the BATTLE-WEATHER STARFIELD on the DESKTOP dashboard
 * (spec V2, ruling R-T2-S5). A read-only ambient display layer: it writes
 * nothing, gates nothing, and is removable without touching any scoring or
 * decision path — the AGENT_PRESENCE_ENABLED / MATCHUPS_BACKDROP_ENABLED shape.
 *
 * FLIPPED false→true in the founder flag-flip PR #694 (after the A7 feel
 * sign-off). The merge-dark era is over: TRUE is now the default, and FALSE is
 * the deliberate-revert path.
 *
 * When TRUE (CURRENT): that ONE dashboard mount renders `StarfieldBackground`
 * instead of `DesktopBackground` (`App.jsx:8689`) and that ONE root paint
 * (`CommandDashboardDesktop`) becomes transparent so the field shows through.
 * `DesktopBackground.jsx` is NOT edited and keeps rendering on the other six
 * screens — so the app deliberately runs two ambient systems until the
 * everywhere-swap follow-on (spec V2 §7). The price lines are NOT deleted, which
 * is why the flip did not touch tokenGuardBaseline.json (R-T2-S6).
 *
 * When FALSE (revert path): the desktop dashboard is byte-identical to pre-flip —
 * `App.jsx:8689` mounts `DesktopBackground`, the root keeps its `CMD.bg` paint,
 * no loop is ever scheduled (`resolveLoopPlan` returns flag-off), and
 * `StarfieldBackground` is absent from the render tree.
 *
 * Reverting is as deliberate as the flip was: per BUILD_RULES §2 it MUST, in the
 * SAME commit, update the assertions that now pin the LIVE state — the value
 * pins in starfield.inert.test.jsx and this docstring.
 */
// Pinned by: starfield.inert.test.jsx (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const STARFIELD_BACKGROUND_ENABLED = true;

/**
 * The ONE home for the desktop starfield gate — the flag OR the `?starfield=1`
 * dev-preview override (the `?matchupsBackdrop=1` idiom). SSR/Node-safe (guards
 * `window`); a malformed URL degrades to the flag alone.
 */
export function isStarfieldOn() {
  if (STARFIELD_BACKGROUND_ENABLED) return true;
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('starfield') === '1';
  } catch {
    return false;
  }
}

/**
 * Delight Layer Task 2, Amendment A — the starfield on the MOBILE dashboard.
 *
 * DELIBERATELY INDEPENDENT of STARFIELD_BACKGROUND_ENABLED, and that
 * independence is the point: beta testers judge this on phones, so mobile must
 * be able to go dark on its own if a tester's device struggles, without
 * disturbing the desktop verdict. Never AND-gate the two.
 *
 * FLIPPED false→true in the founder flag-flip PR #694, on its own phone smoke
 * and separately from desktop (that independence is why it got its own flip).
 * The merge-dark era is over here too: TRUE is now the default, and FALSE is the
 * deliberate-revert path.
 *
 * When TRUE (CURRENT): `StarfieldBackground` renders on the mobile dashboard in
 * `mode="mobile"` — its own budget tier (fewer particles, DPR capped at 1.5),
 * not a shrunken desktop field — and the `CommandDashboard` root paint becomes
 * transparent so the field shows through. Because this puts NEW surface under
 * existing content rather than swapping an existing layer, card legibility at
 * peak intensity is the hard constraint that gated the mobile feel sign-off (A7).
 *
 * When FALSE (revert path): the mobile dashboard is byte-identical to pre-flip —
 * `App.jsx:8642` mounts `DesktopBackground` (which self-returns null on mobile —
 * mobile has no background layer at all in that state) and the `CommandDashboard`
 * root keeps its opaque `CMD.bg` paint.
 *
 * Reverting is as deliberate as the flip was: per BUILD_RULES §2 it MUST, in the
 * SAME commit, update the assertions that now pin the LIVE state — the mobile
 * value pin in starfield.inert.test.jsx and this docstring.
 */
// Pinned by: starfield.inert.test.jsx (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const STARFIELD_MOBILE_ENABLED = true;

/**
 * The ONE home for the mobile starfield gate — the flag OR `?starfieldMobile=1`.
 * SSR/Node-safe; malformed URL degrades to the flag alone.
 */
export function isStarfieldMobileOn() {
  if (STARFIELD_MOBILE_ENABLED) return true;
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('starfieldMobile') === '1';
  } catch {
    return false;
  }
}

/**
 * Delight Layer Task 2 — the DEV STATE OVERRIDE (ruling R-T2-S4).
 *
 * The feel-tuning instrument: `?warpState=resting|live|endgame` with an optional
 * `?warpClock=<seconds>` for where inside the endgame ramp to sit. Phase 0 found
 * ZERO house precedent for localStorage feature gating (the sole dev key,
 * `mc_api_debug`, toggles a debug monitor), so the spec's original localStorage
 * proposal was ruled dead in favour of this URL-param form — the same shape as
 * the five `isXxxOn()` helpers above.
 *
 * Honored only when the relevant starfield flag already resolves on, and it WINS
 * over live inputs. It does NOT drive a parallel display path: the override is
 * converted into the same `liveGames` shape the live adapter produces
 * (`synthesizeOverrideGames`), so it exercises the real state machine rather
 * than a look-alike that could drift from it.
 *
 * SSR/Node-safe. Returns null when absent or unrecognised — distinct from the
 * `resting` state, which is a real instruction to show the calm sky.
 *
 * @returns {{state: 'resting'|'live'|'endgame', clockSeconds: number|null}|null}
 */
export function getWarpDevOverride() {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('warpState');
    if (!raw) return null;

    const state = String(raw).trim().toLowerCase();
    if (state !== 'resting' && state !== 'live' && state !== 'endgame') return null;

    const rawClock = params.get('warpClock');
    const parsed = rawClock == null ? NaN : Number(rawClock);
    const clockSeconds = Number.isFinite(parsed) && parsed > 0 ? parsed : null;

    return { state, clockSeconds };
  } catch {
    return null;
  }
}

/**
 * Delight Layer Task 4 — the SIGNATURE DEPLOY (hold-to-deploy sky coupling).
 * Spec V1 decision D1. Basis:
 * docs/audits/20260801_DELIGHT_DEPLOY_SKY_COUPLING_PHASE0_DISCOVERY.md
 *
 * The room responds to your intent before you commit: while the user holds a
 * deploy button, the shipped hold gesture (`useHoldToDeploy`) dispatches
 * `ft-deploy-intent` and the starfield leans in — speed rises with hold
 * progress, exhales back on an early release, and (Phase 2) surges at commit.
 *
 * MERGED DARK at false. This is the Task-2 starfield's own merge-dark posture,
 * for the same reason: the whole feature is a FEEL change that only a founder
 * pass on the Vercel preview can judge (acceptance row A7).
 *
 * When FALSE (CURRENT): `useHoldToDeploy` dispatches NOTHING (the guard sits at
 * the dispatch helper, so every one of the six hold sites is covered at once)
 * and `StarfieldBackground` registers NO intent listener. The hold behaves
 * exactly as it shipped this week and the sky is driven by battle state alone —
 * byte-identical to today (acceptance row A1, pinned by
 * starfield.intent.test.jsx).
 *
 * When TRUE (flip path): the coupling is live wherever the hold already exists.
 * NOTE FOR THE FLIP PR (founder ruling R-T4-S1): flipping this ALSO makes the
 * "No battle live" card flip immediately on a successful deploy rather than up
 * to 120s late, because the Phase-2 settle appends the new battle to the shared
 * `activeAgentBattles` state. That is a truthfulness improvement, not a
 * regression — but it is a behaviour change OUTSIDE the sky and must be named
 * in the flip PR so it does not surprise a reviewer reading the diff.
 *
 * Flipping is as deliberate as the merge was: per BUILD_RULES §2/§11 the flip
 * PR MUST, in the SAME commit, update every assertion and docstring that pins
 * the pre-flip state — the value pins in starfield.intent.test.jsx and this
 * docstring.
 */
export const DEPLOY_SKY_COUPLING_ENABLED = true;

/**
 * The ONE home for the deploy-sky-coupling gate — the flag OR the
 * `?deploySkyCoupling=1` dev-preview override (the `?starfield=1` idiom).
 * SSR/Node-safe (guards `window`); a malformed URL degrades to the flag alone.
 *
 * This is the URL param the Phase-1 SOFT-STOP feel pass runs behind.
 *
 * Called per dispatch rather than latched at mount, deliberately: it is the
 * most direct guarantee that flag-off dispatches nothing (A1), with no window
 * where a cached value could disagree with the flag. Once the constant is true
 * the function returns on its first line, so the URL parse only ever runs in
 * the dark/preview state.
 */
export function isDeploySkyCouplingOn() {
  if (DEPLOY_SKY_COUPLING_ENABLED) return true;
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('deploySkyCoupling') === '1';
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPOSITION EVENT — PR 2: the one CLIENT-consumed flag. The three
// server-side composition flags live in api/_utils/compositionConfig.js (the
// masteryConfig.js precedent — endpoint test suites mock this file with
// explicit export lists). Table of record: docs/composition/PR2_FLAG_OWNERSHIP.md.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * D2 display: candidate greyed-with-reason on the compat copy surfaces
 * (compositionDisplay.js through compatSurfaceCopy). false — DEFAULT:
 * copy builders return their legacy output byte-identically (A23 test).
 */
// Pinned by: composition.acceptance.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const COMPOSITION_DISPLAY_ENABLED = false;

// ═══════════════════════════════════════════════════════════════════════════
// SPEC 1 — THE MANDATE (§7). All default false / safest, MERGE DARK.
// Spec 1 is HEADLESS (§1): in Phase 1 these gate server crons (registered in
// P6, no-op'ing while false) and the founder create endpoint; no client surface
// consumes them yet (MANAGED_MANDATE_ENABLED anticipates Spec 2+ client use).
// Flips are separate one-line PRs after a preview smoke — NEVER in a build PR;
// per BUILD_RULES §2/§11 a flip PR reconciles its pin (mandateFlags.test.js)
// and drops the flag's DARK_BY_DESIGN entry in the same commit.
// Spec: docs/SPEC1_MANDATE_SUBSTRATE_SPEC_V1_4.md §7.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * MASTER gate for The Mandate. When FALSE (DEFAULT, merge-dark) nothing
 * mandate-related runs: the eval/close/rollover crons no-op and the founder
 * create endpoint is closed regardless of the sub-flags below. The one switch
 * that keeps the whole substrate inert while it is built dark across Phases 1–6.
 */
// Pinned by: mandateFlags.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const MANAGED_MANDATE_ENABLED = true;

/**
 * The scheduled evaluation loop (§3.1). When FALSE (DEFAULT), the
 * mandate-evaluate handler no-ops — no snapshot, no harvest, no submit. Built
 * P2; registered P6.
 */
// Pinned by: mandateFlags.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const MANDATE_EVAL_ENABLED = true;

/**
 * The authoritative daily close pass (§3.6). When FALSE (DEFAULT), no book is
 * marked and no dailyRow is written by the close duty. Built P3. Close is the
 * sole writer of high-water marks / drawdown peaks (I6).
 */
// Pinned by: mandateFlags.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const MANDATE_CLOSE_ENABLED = true;

/**
 * The rolling per-user rollover sweep (§5.3). When FALSE (DEFAULT), no book
 * crosses a quarter boundary. Built P4. Capital carries forward at rollover
 * (FR-1); the transaction asserts totalValue unchanged (I15).
 */
// Pinned by: mandateFlags.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const MANDATE_ROLLOVER_ENABLED = false;

/**
 * Dormancy downshift (§6.5 / D-21). When FALSE (DEFAULT), no downshift derives.
 * Trading cadence and the daily close are NEVER downshifted — only future
 * reflection/narration depth (Spec 3). Built later.
 */
// Pinned by: mandateFlags.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const MANDATE_DORMANCY_DOWNSHIFT_ENABLED = false;

/**
 * The founder-gated creation endpoint (api/mandate/create.js, §7). When FALSE
 * (DEFAULT), the endpoint returns 403 for everyone — even an allowlisted
 * founder uid — because a flag alone is not authorization AND authorization
 * alone is not the flag: creation requires BOTH this flag true AND the caller's
 * uid in MANDATE_FOUNDER_UIDS. This is the Phase 1 dark-testing switch. Also
 * gates the P4 accelerate and P5 drain founder-ops endpoints (the ambiguity-4
 * precedent: founder machinery, no new flag).
 */
// Pinned by: mandateFlags.test.js, drain.test.js (flagPinGuard: this value and the pins move together — BUILD_RULES §2).
export const MANDATE_FOUNDER_CREATE_ENABLED = true;

/**
 * Transport mode for mandate model calls (§3.3). 'direct' (DEFAULT, safest) or
 * 'batch' (production transport, built P5). A STRING enum, not a boolean gate,
 * so the flag-pin guard (which matches `*_ENABLED = true|false`) does not track
 * it — it is pinned directly in mandateFlags.test.js. A mode change takes effect
 * only after open batches drain (§3.3 drain protocol).
 */
export const MANDATE_TRANSPORT_MODE = 'direct';


/**
 * Exit-Behavior Rebalance Tier 2, Ask 3 — the profitTarget deterministic
 * executor (Founder Rulings V1 R1-R3/R10 + Addendum V1.1 R11). When FALSE
 * (DEFAULT, merge-dark): profitTarget stays a soft advisory note in
 * applyGuardrails, stays OUT of compileBuild's SUPPORTED_GUARDRAIL_SHAPES,
 * and the R11 suppression-path deterministic pass in agent-evaluate.js is a
 * no-op — byte-identical engine behavior. When TRUE, ONE flag lights all
 * three together (F11: compiler acceptance and executor registration can
 * never drift apart), and user-directive deterministic orders (equipped
 * stops + the profit target) fire through gameplan suppression (R11).
 * Flips WITH Ask 1's enforcement-true prompt copy per R10 — never alone,
 * never in a build PR.
 */
// Pinned by: agentGuardrails.pairing.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const PROFIT_TARGET_EXECUTOR_ENABLED = false;

/**
 * Metric History Snapshot Substrate (EXA_RETRIEVAL_INTEGRATION_SPEC_V1_4 §6.0 —
 * FOUNDER DECISION 2). ENABLED. After the ranking cron
 * (api/cron/compute-rankings.js) persists its ranking documents, it additionally
 * writes the daily per-ticker metric history (metricSnapshots/{ticker}/daily/{date})
 * and retains the raw quarterly series it already fetches transiently
 * (quarterlySeries/{ticker}) — detection substrate for Workstream B's decomposition
 * gate. Nothing reads this data yet; it is a failure-isolated, additive co-tenant
 * write (no new EODHD fetch, no new cron slot). Flipped true after the substrate
 * merge + Vercel preview smoke; instant rollback is set-false (which re-pins the
 * metricSnapshots.test.js off-state and restores this flag's DARK_BY_DESIGN entry).
 */
// Pinned by: metricSnapshots.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const METRIC_HISTORY_SNAPSHOT_ENABLED = true;
