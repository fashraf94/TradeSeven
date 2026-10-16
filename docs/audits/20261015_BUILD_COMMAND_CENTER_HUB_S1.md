# Build report — Command Center hub, slice S1

Claude Code (Opus 5.5), October 15, 2026, for Flash. The build prompt was the founder's "FantasyTrades Command Center — implementation kickoff, S1: the approved shell" of October 15, with rulings R-S1-1 … R-S1-5. This report covers S1 only (spec V1.2 §11.2): the approved layout at every width with the larger Shadow still, the area controls and phone tabs with their defaults, the persistent mobile strip in its static states, every section's frame in its loading state, the reserved Partnership copy and the sheet primitive. Everything is behind `COMMAND_CENTER_HUB_ENABLED = false`, which stays false. Nothing reads data, nothing is wired to deployment, nothing is activated or merged.

## Verdict

| Item | Result |
|---|---|
| Starting check | Every S1 seam the prompt names matches the spec and the S0 report at `7d26161f` (§2). No conflict, so the build did not stop. |
| Colour tokens (R-S1-2) | The seven design colours added as they are, with the `-rgb` companions the hub composes, in one founder-cited commit (`e2ede52f`). One more companion, `--ft-ink-2-rgb`, came with a review fix (`6ed9ddf4`, commit message cites R-S1-2) — disclosed in §3. No existing token retuned; nothing outside the hub consumes them. No raw colour under `src/components/CommandCenter/` — no hex, numeric rgb()/hsl() or colour name (guard rows); SVG paints take computed hexes from `readToken()`. |
| Layout (R-S1-3) | The hub composes from App's site and its own ResizeObserver width: phone on the mobile site; desktop ≥ 1080, tablet 700–1079, stacked < 700 on the desktop site. The app's sidebar and BottomNav stay. Measured in headless Edge at 7 shells × 9 states (§5): no horizontal scroll anywhere; the enabled hold sits inside the first viewport at 834 × 1000 and both 1280 × 820 shells in every state (worst 816 of 820). |
| Stacked order (founder question Q1) | Built in the founder's literal order (next action → stage → panel → Deploy → …). At 614 × 1000 that puts the hold at 1114–1204 px whenever a next action shows. The swapped order (Deploy above the panel) fits in every state (746–816; at the narrowest desktop site, 549 × 900, 589–842). S1 production renders no enabled hold, so nothing user-facing is wrong today. §9. |
| Shadow (R-S1-1) | `ShadowStill` is one swappable component with the props `size`, `tier`, `status`, `selectedArea`, `reducedMotion` in a fixed box. The geometry is a port of `ff-shadow.jsx`: a parity check over 252 strands found 0 differences, and its digest is pinned. The connector and status line anchor to the box, never a filament. Phone low tier, wider compositions mid. |
| Static states (R-S1-4) | Every data section renders spec §3's loading state; Partnership renders its reserved line exactly; the hold renders disabled with no `onComplete`. The fixtures module is imported by tests only, and the build branch has no URL, storage or environment override (guard rows). |
| Width changes (R-S1-5) | Crossing App's 768 px split remounts (keyed by site), as accepted. Within the desktop site the three compositions are one CSS grid, so a resize, zoom or rotation remounts nothing: focus, the Brief's open state and (for S2b) a charging hold survive (rows walk the same nodes across 1216 → 960 → 614 → 1060 → 700 → 1216 → 614). |
| Mobile strip | Mobile site only, fixed above BottomNav's measured outer height (ResizeObserver on both, border box), z 40. Measured 63 / 66 / 69 px in every state at 360 and 390, bottom exactly at the nav's top, page content clears it at full scroll on every tab. |
| Sheet primitive | `HubSheet`: dialog on the wide site, bottom sheet on the phone; `role="dialog"`, `aria-modal`, a label, focus to Close, a focus trap that also catches focus outside the dialog, Escape, focus return to the opener (else a fallback, never `<body>`), background inert. Production opens none; the History sheet is its one use, reached by fixtures. |
| Accessibility | Tablists with roving tabindex, Arrow / Home / End (modified keys left to the browser); one live region with phase words only; every phone target ≥ 44 px; active text ≥ 4.5:1 on its real surface; disabled controls keep the secondary ink at full opacity (6.35:1 on the strip); the design's teal focus ring, scoped to the hub. |
| With the flag off | Proved again by the L2 lens and its refuter: the entry holds the same 1,115 modules as `main`, `index.html` is identical apart from hashes (no preload), 41 of 42 chunks are unchanged, the CSS gains only the custom properties. Re-proved at the code head against the merged `main` (both built on Linux): the entry holds the identical 1,115 modules (84 bytes more: the two site attributes and the nav attribute), the same 42 chunks, and only the hub chunk changes (722 B → 57,146 B); `index.html` preloads nothing; CSS +234 B (the 10 new custom properties). |
| Tests | 12 new test files with 283 rows: the shell at every fixture and shell, the L1–L4 review fixes, the L5 test-integrity rows, the sheet, the Shadow still, the copy guard, and the composition, deploy-display, date, clearance and geometry units. Extended: the mount guard (40 rows), the chunk row and the theme guards. All 20 hub-related files: 841 rows on Linux (§6). |
| Mutation | The builder's rounds 1–3 (§7.4): 54 of 55, 33 of 37 and 7 of 10 killed. Every survivor then got a row that kills it, except R8 / Q3 (equivalent, confirmed by L5 and its refuter) and R4 (moot: its code was removed). **The L5 lens found far more:** at `9054a320` 32 of its 52 guard plants and 37 of its 40 behaviour mutants survived, all confirmed by its refuter. **Round 4** re-ran L5's own specs, unchanged, against the fix round: **97 of 97 killed**, each by the row meant for it. |
| `vite build` | Exit 0 at the code head on Linux, and again on the LF archive of the pushed report head (§6). The hub stays its own chunk, `CommandCenterHub-*.js`: 57.15 kB, gzip 16.83 kB (S0 0.72 kB). The entry reaches it only inside the gate's lazy factory, holds none of the hub's copy, and `index.html` preloads nothing. |
| `lint:gate` | Exit 0 (Linux, code head). |
| Full suite (Linux, CI-shaped) | Exit 0 at the code head `d8fe2d4c` (WSL Ubuntu, private clone, Node 20.20.2, `TZ=UTC`, `npm run test:run -- --maxWorkers=2`): `Test Files 999 passed \| 7 skipped (1006)`, 21,430 tests passed, 88 skipped, 0 failed (390 s). |
| §2 review | Five lenses, each with its own refuter on its own snapshot, the mutating lens last: L1 design fidelity, L2 flag-off parity, L3 accessibility and keyboard, L4 layout in a real browser at the four widths plus 614, then L5 test integrity. **59 findings: 46 CONFIRMED, 13 PARTLY, 0 wholly REFUTED.** Each PARTLY verdict refuted part of its claim (§7.2, §7.3). Every CONFIRMED or PARTLY finding that changes S1 code or tests is fixed; the accepted ones are in §8; three go to the founder. No finding was a defect in what users get with the flag off. The MAJORs: L1-1 / L4-3 (the app forces every button to 16 px; fixed), L3-1 (a width change remounted the shell; fixed by one grid), L4-1 (the ClashBot button over the strip; Q2), L5-1 and L5-2 (holes in the hex and copy guards; fixed), and L5-8 (the flag-off guard missed load-time imports, so such an import would have fetched a hub chunk on every page; none exists, and the guard is fixed). |
| Fenced files | None edited (BUILD_RULES §1). Nothing under `api/`; no cron. |
| Smoke preview (NEVER MERGE) | Branch `claude/command-center-hub-s1-smoke` at `7140dc33` (the code head plus the flag on and `?hubFixtures=`). Preview: <https://trade-seven-lbj4gabvo-fais-projects-bc179554.vercel.app>. Scenarios and widths in §10. |
| Founder questions | Q1 the stacked order (above); Q2 the ClashBot bug button covers the strip's right action on phones in production; Q3 the active-season banner would sit over the strip (§9). |
| Blockers | None. |
| Next slice | S2a (pure eligibility/attempt selectors). S3, S5, S6 and S7 depend only on S1 and can proceed alongside it; S4 follows S3; S2b waits for reviewed R1/R2 (spec §11.2). |

## 1. Branch, HEAD and preamble

- `git fetch origin` ran first. `origin/main` was `7d26161f` (the merge of S0, PR #969), the branch's base. The tree was clean.
- `origin/main` moved during the build to `83ec3b88` (PR #971, the research modal honesty fixes): 9 files under `src/components/Research/`, `src/components/draft/`, `src/services/levelDetection*` and one audit, none shared with this branch. It was merged at `932611f1` before the L5 fix round and the final checks (a fetch just before the push found `main` still at `83ec3b88`).
- Local branch `claude/fantasy-trades-s1-shell-33f693` (the desktop app's worktree name), pushed as the prompt's `claude/command-center-hub-s1`.
- Commits:

| Commit | What |
|---|---|
| `e2ede52f` | The seven colours and two `-rgb` companions (R-S1-2), the baseline and the pinned counts |
| `d2ec2880` | The shell behind the dark flag |
| `a7836510` | Fixes from headless-Edge measurement (scoped box model, wrapping picker labels, the `rankedLive` fixture) and the S1 test rows |
| `52815740` | Two rows (the hold stays disabled with no handler; the scoped box model) — the SHA lenses L1–L4 reviewed |
| `4a274307` | Mutation round 1 survivor K4 killed (the phone tabs' roving tabindex) |
| `6ed9ddf4` | §2 fix round for L1–L4 |
| `860b7d8f` | One tree for the wide compositions (L3-1, as strengthened by its refuter) |
| `bbc23a86`, `9054a320` | Rows from mutation rounds 2–3 — the SHA L5 reviewed. **No component file changes after this commit**; only tests moved |
| `932611f1` | `origin/main` (`83ec3b88`) merged |
| `dd99b9e2` | §2 fix round for L5: the guards and the test-integrity rows (tests only) |
| `d8fe2d4c` | The L5 refuter's notes on those rows (tests only) — **the code head** |
| (the report commit) | This report and its README row; documentation only |

## 2. Starting check (BUILD_RULES §3)

Every anchor below was read in this session at `7d26161f` (VERIFIED).

| Seam | At `7d26161f` | Status |
|---|---|---|
| Flag | `src/config/featureFlags.js:3306` `COMMAND_CENTER_HUB_ENABLED = false`; `:3309` `isCommandCenterHubOn()` | VERIFIED; untouched |
| Picker | `src/components/CommandCenter/pickDashboardShell.js:32` `DASHBOARD_SHELLS`, `:50` `pickDashboardShell` | VERIFIED; untouched |
| Gate | `CommandCenterHubGate.jsx` (S0's `createCommandCenterHubGate` and default export) | VERIFIED; S1 forwards `site` (§4) |
| Hub module | S0's placeholder `CommandCenterHub.jsx`, `hub/hubCopy.js`, `hubGateCopy.js` | VERIFIED; the placeholder is replaced |
| App sites | `src/App.jsx:8823–8825` mobile gate, `:8893–8901` desktop gate; the mount guard pins both as text | VERIFIED; S1 adds `site="mobile"` / `site="desktop"` and moves the pinned text in the same commit |
| Token bridge | `src/theme/cssTokens.js:168` `cssVar`, `:183` `readToken`, `:212` `readTokenRgb`; `tokens.css`; `tokenBaseline.json`; the `tokens.guard` directory row | VERIFIED |
| Motion | `src/theme/motion.js:155` `motionToken`; the `motion.guard` directory row | VERIFIED |
| Hold | `src/components/Dashboard/deployCeremony/HoldToDeployButton.jsx:26` (`label`, `onComplete`, `disabled`, `enabled`, `ariaLabel`, …); with `enabled` false or `disabled`, `useHoldToDeploy` binds nothing (no handler, no rAF, no timer, no sky) | VERIFIED; reused unchanged |
| BottomNav | `src/components/Navigation/BottomNav.jsx:53–59`: fixed, 64 px, z 50, safe-area padding. Its box is content-box (the app ships no global border-box), so its outer height is 64 + the inset | VERIFIED |
| User | `src/contexts/UserContext.jsx:192` `useUser` (throws outside its provider) | VERIFIED |

## 3. The rulings as applied, and the builder's interpretations

- **R-S1-1.** `ShadowStill` (src/components/CommandCenter/ShadowStill.jsx:34) owns a fixed square box (`data-shadow-box`); everything outside reads the box's rect. The connector (src/components/CommandCenter/ShadowStage.jsx:76) runs from the middle of the box's right edge to the selected control's ring, measured from the overlay's origin (the stage's padding box). The status line sits under the box. Status `processing` draws the same still in S1 (the canvas is S7's).
- **R-S1-2.** Tokens at src/theme/tokens.css:170 onward. Interpretations:
  - Hairlines `rgba(255,255,255,.07/.12)` compose from `--ft-scrim-rgb` (src/components/CommandCenter/hub/hubStyle.js:30): there is no `--ft-white-rgb`, and `tokens.css` reserves `--ft-white` for opaque use. Same channels.
  - The design's `#ECFFFB` core highlight maps to `--ft-white`; the sheet scrim `rgba(5,6,9,.72)` to `--ft-shadow-rgb` at .72.
  - `--ft-gold-rgb` (a companion of the shipped gold) and `--ft-blue-action-rgb` are in the founder-cited commit. `--ft-ink-2-rgb` (the draw chip, review L1-10) landed in `6ed9ddf4`, whose message cites R-S1-2. It is a companion of a ruled token, not a new colour; it was not folded back into `e2ede52f` so that the reviewed history stays intact.
  - `--ft-ink-3` clears 4.5:1 on `bg-card` (4.58) but not on `bg-agent` (4.38) or the teal/blue-tinted surfaces; text there uses `--ft-ink-2` (the strip's second line, the status line, the next action's detail, the ready Deploy card's helper).
- **R-S1-3.** `composeHub({ site, width })` (src/components/CommandCenter/hub/composition.js:53): mobile site → phone at any width; desktop site → by the hub's content width from `useHubWidth` (src/components/CommandCenter/hub/useHubWidth.js:15), never `window.innerWidth`. The hub cannot tell the site from its own width (a 760 px hub exists on both), so App passes each gate its site (src/App.jsx:8824, src/App.jsx:8898) and the gate forwards it (src/components/CommandCenter/CommandCenterHubGate.jsx:244). The order constants are src/components/CommandCenter/hub/composition.js:112-116; tablet and stacked put Deploy above Games, desktop keeps the design's order.
- **R-S1-4.** `HUB_S1_SECTIONS` (src/components/CommandCenter/hub/hubModel.js:31) is loading everywhere and deploy `checking`. The fixtures (src/components/CommandCenter/__fixtures__/hubLayoutFixtures.js:94) are the design's seven scenarios as the hub's own props, plus `rankedLive` (spec §10's ranked-only live case, which the design lacks).
- **R-S1-5.** The default export is keyed by site (src/components/CommandCenter/CommandCenterHub.jsx:351), so crossing 768 px resets to that site's defaults (Overview / Equipped Archetype). Within the desktop site `wideGrid()` (src/components/CommandCenter/CommandCenterHub.jsx:162) changes only CSS.

Further decisions, each recorded in code:
- **Font.** The design's body face is not loaded, and neither is Inter: `index.html` loads only Newsreader and JetBrains Mono, so the hub (like the app) draws in the platform sans — Segoe UI in Edge, SF on iOS, Roboto on Android. Adding a face would add a request with the flag off. Every pixel in §5 is Segoe UI. The narrowest fit is the phone tab "Partnership" in its 85 px cell at 360: at the design's 12.5 px semibold (after the L1-1 fix) it measures 65.1 px in Segoe UI, 65.6 in Roboto and 70.3 in Inter, so it fits in each; before the fix the app's 16 px rule made it 83.3 px. Carry the device faces to S7's checks.
- **Box model.** The app ships no global `box-sizing: border-box` (its Tailwind v4 build ignores `@tailwind base`; the built CSS has none). The hub injects one scoped `<style>` covering its three roots only (src/components/CommandCenter/hub/hubStyle.js:74), plus the design's teal focus ring, inset on full-bleed rows (src/components/CommandCenter/hub/hubStyle.js:84).
- **16 px buttons.** `src/index.css` forces `button { font-size: 16px !important }` (the repo's "hazard 48"). Every hub label sizes an inner span (the FilmRoomKit `Label` pattern, src/components/CommandCenter/HubParts.jsx:31).
- **Disabled look.** With no handler (S1 wires none) every action renders natively disabled, including the hold in "ready" fixtures. Disabled controls keep the secondary ink at full opacity rather than the design's half opacity (review L3-14): strip hold 6.35:1.
- **Not built in S1** (data, deferred contracts, or §8.3): the design's area descriptions, the Research paste intake, the Loadout's permitted controls / recorded outcomes, the brief's "Sources · N", the strip and Deploy pulse.
- **The ranked-only live strip** lays "Open" and "Deploy" in one row (63–66 px), never the design's 113 px column.
- **Wrapping over ellipsis** (review L1-11): area summaries, activity subtitles and the status line wrap instead of ellipsizing, from the prompt's "nothing truncates at 360 px". The collapsed Brief keeps the design's clamp with More.

## 4. What S1 built, by `file:line` (at the code head `d8fe2d4c`)

56 files against `main` (42 added, 14 modified), all under `src/components/CommandCenter/`, `src/theme/`, plus the two `src/App.jsx` attributes and one BottomNav line. Nothing under `src/config/`, `api/` or `docs/` (apart from this report) changed.

**Outside the hub directory**
- `src/App.jsx` — `site="mobile"` on the mobile gate (src/App.jsx:8824) and `site="desktop"` on the desktop gate (src/App.jsx:8898). Nothing else.
- `src/components/Navigation/BottomNav.jsx` — `<nav data-ft-bottom-nav=""` (src/components/Navigation/BottomNav.jsx:51), on the existing line, so no later line moves. Inert: its only reader is the hub's `useNavClearance`.
- `src/theme/tokens.css` (src/theme/tokens.css:162), `tokenBaseline.json`, `cssTokens.test.js` (pinned counts 53 tokens; 30 strict / 12 triplet rows); `tokens.guard.test.js`, `motion.guard.test.js` and their baselines register every new hub file.

**The hub**
- `CommandCenterHubGate.jsx` — takes `site` and renders `<Hub site={site} />` (src/components/CommandCenter/CommandCenterHubGate.jsx:244); the S0 lifecycle is unchanged.
- `CommandCenterHub.jsx` — the root. `useShared` (src/components/CommandCenter/CommandCenterHub.jsx:110) gives both sites the user line, OS reduced motion and the area summaries; `useHubSheet` (src/components/CommandCenter/CommandCenterHub.jsx:138) the one sheet with its opener and fallback; `wideGrid` (src/components/CommandCenter/CommandCenterHub.jsx:162) the one grid; `PhoneHub` (src/components/CommandCenter/CommandCenterHub.jsx:199) the 100dvh pane with sticky tabs, scroll padding and the strip; `WideHub` (src/components/CommandCenter/CommandCenterHub.jsx:261); the default export keyed by site (src/components/CommandCenter/CommandCenterHub.jsx:351).
- `hub/composition.js` — the bands (src/components/CommandCenter/hub/composition.js:46, src/components/CommandCenter/hub/composition.js:47), `composeHub`, the areas and phone tabs with their defaults (src/components/CommandCenter/hub/composition.js:86, src/components/CommandCenter/hub/composition.js:88), `rovingIndex` (src/components/CommandCenter/hub/composition.js:95), the order constants.
- `hub/useHubWidth.js` — a ResizeObserver on the hub's own box (src/components/CommandCenter/hub/useHubWidth.js:15).
- `hub/navClearance.js` (src/components/CommandCenter/hub/navClearance.js:29) and `hub/useNavClearance.js` (src/components/CommandCenter/hub/useNavClearance.js:19) — the strip's `bottom` and the pane's clearance from the measured border boxes; the safe area counted once.
- `hub/shadowGeometry.js` — the port of `ff-shadow.jsx`: tiers (src/components/CommandCenter/hub/shadowGeometry.js:31), the still's frame (src/components/CommandCenter/hub/shadowGeometry.js:38), `stillPaths` (src/components/CommandCenter/hub/shadowGeometry.js:134), `shadowTierFor` (src/components/CommandCenter/hub/shadowGeometry.js:187).
- `ShadowStill.jsx` (src/components/CommandCenter/ShadowStill.jsx:34) — the fixed box and its SVG, paints from `readToken()`.
- `ShadowStage.jsx` — the one live region, `StatusLine` (src/components/CommandCenter/ShadowStage.jsx:30); `connectorPath` (src/components/CommandCenter/ShadowStage.jsx:76); `ShadowStage` (src/components/CommandCenter/ShadowStage.jsx:89) and `PhoneStage` (src/components/CommandCenter/ShadowStage.jsx:155).
- `AreaControls.jsx` — the vertical tablist (src/components/CommandCenter/AreaControls.jsx:41), modified keys left to the browser (src/components/CommandCenter/AreaControls.jsx:28).
- `PhoneTabs.jsx` — the sticky tab row (src/components/CommandCenter/PhoneTabs.jsx:32), Overview (src/components/CommandCenter/PhoneTabs.jsx:84), the panel (src/components/CommandCenter/PhoneTabs.jsx:125).
- `panels/` — `AreaPanel.jsx` (src/components/CommandCenter/panels/AreaPanel.jsx:52), `PartnershipPanel.jsx` (the reserved line only, src/components/CommandCenter/panels/PartnershipPanel.jsx:12), `ResearchPanel.jsx`, `LoadoutPanel.jsx`.
- `sections/` — `NextActionCard.jsx`, `GamesSection.jsx`, `DeploySection.jsx`, `ActivitySection.jsx`, `BriefSection.jsx`, and `HubHold.jsx` (the shipped `HoldToDeployButton`, disabled with no handler, src/components/CommandCenter/sections/HubHold.jsx:34).
- `DeployStrip.jsx` (src/components/CommandCenter/DeployStrip.jsx:28) — fixed, z 40, two lines and the action slot.
- `HubSheet.jsx` (src/components/CommandCenter/HubSheet.jsx:50) with `inertSiblings` (src/components/CommandCenter/HubSheet.jsx:40); `HistorySheet.jsx`; `HubHeader.jsx` (src/components/CommandCenter/HubHeader.jsx:18).
- `HubParts.jsx` — the primitives: `Label` (src/components/CommandCenter/HubParts.jsx:31), `HubButton` (src/components/CommandCenter/HubParts.jsx:120) with the disabled look (src/components/CommandCenter/HubParts.jsx:114), `HubLink`, `Card`, `Section`, `Row`, `EmptyNote`, `LoadingLine`, `RingGlyph`.
- `hub/hubCopy.js` — every string (src/components/CommandCenter/hub/hubCopy.js:25); `hub/hubModel.js` — the S1 sections and the prop shapes (src/components/CommandCenter/hub/hubModel.js:31); `hub/deployDisplay.js` — the display-state table, an unknown state failing closed to "checking" (src/components/CommandCenter/hub/deployDisplay.js:46); `hub/hubStyle.js` — the token map, layers and scoped CSS (src/components/CommandCenter/hub/hubStyle.js:57); `hub/hubDate.js` — the ET date and the header name.
- `__fixtures__/hubLayoutFixtures.js` and `__fixtures__/hubTestKit.js` — test-only. Two guard rows hold that: the hub's import graph never reaches `__fixtures__/` (src/components/CommandCenter/commandCenterHub.mount.guard.test.js:511), and nothing outside the directory imports into it except App → the gate and App → the picker (src/components/CommandCenter/commandCenterHub.mount.guard.test.js:577).

**Tests** (new or extended): `CommandCenterHub.jsdom.test.jsx`, `CommandCenterHub.reviewFixes.jsdom.test.jsx`, `HubSheet.jsdom.test.jsx`, `HubSheet.reviewFixes.jsdom.test.jsx`, `ShadowStill.jsdom.test.jsx`, `hub/{composition, navClearance, shadowGeometry, deployDisplay, hubDate}.test.js`, `hubCopy.guard.test.js`, `CommandCenterHubGate.chunk.jsdom.test.jsx`, `commandCenterHub.mount.guard.test.js`, and the theme guards. Row counts per file are in §6.

## 5. Measured layout (headless Edge, the four widths plus 614)

Harness: an LF snapshot served by Vite with App's container style, both gate sites, the real BottomNav and the sidebar offset; headless Edge via playwright-core at device scale 1; the app's `index.css`, `tokens.css` and `holographic.css` loaded. 7 shells × 9 states (the S1 production state and the eight fixtures). The last full run was made on the one-grid tree (`860b7d8f`). Its 37 non-test sources (the hub directory, `tokens.css`, `BottomNav.jsx`) are byte-identical to the code head's, so the numbers below are the code head's.

| Shell | Composition (hub width) | Hold (top–bottom of viewport height) | Notes |
|---|---|---|---|
| 360 × 640 | phone (360) | strip hold 519–566 of 640 in every state | strip 63 (66 ranked/active live, 69 blocked); bottom = nav top 575; content clears it at full scroll |
| 390 × 844 | phone (390) | 723–770 of 844 | strip 63 (69 blocked); bottom = nav top 779 |
| 834 × 1000, sidebar 64 | tablet (770) | 562–816 of 1000 | worst `rankedLive` / `active` 768–816 |
| 834 × 1000, sidebar 220 | stacked (614) | production 832–880, blocked 931–979; with a next action 1114–1204 | Q1 |
| 1280 × 820, sidebar 64 | desktop (1216) | 258–772 of 820 | side column starts 22 px under the next-action card |
| 1280 × 820, sidebar 220 | tablet (1060) | 562–816 of 820 | worst 816 of 820 |
| 769 × 900, sidebar 220 | stacked (549) | production 877–925 of 900; with a next action 1180–1251 | the narrowest desktop site; Q1 |

In all 63 rows: no horizontal scroll of the document or the hub; no phone target under 44 px; nothing clipped except the collapsed Brief's designed two-line clamp. On the wide site the design's 36 px buttons and inline links are under 44 px; the 44 px rule is the phone's (prompt §4). Q1's swapped order, measured with a temporary edit (restored byte-for-byte): 614 × 1000 holds 562–816, 549 × 900 holds 589–842.

## 6. Checks

| Check | Command / place | Result |
|---|---|---|
| The shell at every fixture × shell | `CommandCenterHub.jsdom.test.jsx`: composition, defaults, the strip only on the mobile site, the orders (Deploy above Games on tablet and stacked), keyboard, the strip's placement from the measured nav, the History sheet, S1's loading states, the hub-side colour and motion rows | 91 / 91 |
| Review-fix rows | `CommandCenterHub.reviewFixes.jsdom.test.jsx` (L1, L3, L4), `HubSheet.reviewFixes.jsdom.test.jsx` (L3-2, L3-3), `CommandCenterHub.testIntegrity.jsdom.test.jsx` (L5) | 32 / 32, 4 / 4, 30 / 30 |
| The sheet primitive | `HubSheet.jsdom.test.jsx`: role, aria-modal, label, focus to Close, the trap, Escape, focus return, inert background | 8 / 8 |
| The Shadow still | `ShadowStill.jsdom.test.jsx` and `hub/shadowGeometry.test.js`: the props, the box, the computed paints, and the digest of a 252-strand parity check against `ff-shadow.jsx` (0 differences) | 14 / 14, 14 / 14 |
| Units | `hub/composition.test.js` (bands, defaults, roving keys, orders), `deployDisplay.test.js` (the display table, fail-closed), `navClearance.test.js` (the clearance math, safe area once), `hubDate.test.js` (the ET date) | 36, 21, 11, 10 — all green |
| Copy | `hubCopy.guard.test.js`: centralization by AST position, the spec's strings exactly, no banned claim and no number but 1.3 s and 10 in either table's source, the 1.3 s tripwire on the shipped `HOLD_MS` | 12 / 12 |
| Flag off, the mount sites, the hub side | `commandCenterHub.mount.guard.test.js`, `CommandCenterHubGate.jsdom.test.jsx`, `CommandCenterHubGate.chunk.jsdom.test.jsx`, `pickDashboardShell.test.js`, `commandCenterHubFlags.test.js` | 40, 26, 3, 28, 8 — all green |
| Colour and motion registration | `src/theme/tokens.guard.test.js`, `motion.guard.test.js`, `cssTokens.test.js` | 192, 182, 79 — all green |
| Mutation | Rounds 1–4 (§7.4) | Round 4: 97 / 97 killed |
| Order and time zone | L5 and its refuter: each hub file alone; `--sequence.shuffle` at several seeds; `--no-isolate`; `TZ` UTC, America/Los_Angeles, Asia/Tokyo, America/New_York (set from PowerShell or Node; Git Bash passes only `TZ=UTC`) | Green, except L5-9's row, now fixed (green unshuffled and at seeds 2, 3, 8, 42, 20261015) |
| The smoke edits, dry run | The two smoke edits against the hub, theme and config suites and the 13 App-reading suites, with an unedited control (1,144 rows) | Exactly 5 rows red, all by design (§10) |
| `vite build` | Linux at the code head; the LF archive of the pushed report head is built once more before the push (result in the PR description) | Exit 0. `CommandCenterHub-CJLVfP-K.js` 57.15 kB (gzip 16.83 kB); entry 4,766.53 kB; 42 JS chunks; `index.html` has 0 `modulepreload` and no hub reference; the entry names the hub chunk only inside the gate's lazy factory and holds none of the hub's copy |
| `lint:gate` | Linux, code head | Exit 0 |
| Full suite, Linux CI shape | WSL Ubuntu, private clone, Node 20.20.2, `TZ=UTC`, `npm run test:run -- --maxWorkers=2` | Exit 0 at `d8fe2d4c`: `Test Files 999 passed \| 7 skipped (1006)`, 21,430 passed, 88 skipped, 0 failed (390 s) |
| Headless Edge, real layout | §5 | 63 rows (7 shells × 9 states), plus the swapped-order measurement for Q1 |

**Windows note.** In this working tree the three `agentReadCensus.guard` path-separator rows fail, as they do on `main`; they are known Windows-only rows and pass on Linux.

## 7. The BUILD_RULES §2 review record

The threshold is met on both measures: against the merged `main` (`83ec3b88`), the branch changes 56 files (42 added, 14 modified; 17 of them tests) and adds 6,178 lines.

### 7.1 How it ran

- Each reviewer worked on its own `git -c core.autocrlf=false archive` extraction with `node_modules` junctioned, read-only on git and on the working tree, returning text only. Briefs, the decoded design modules and the prompt's rulings sat in a shared read-only folder.
- L1 design fidelity, L2 flag-off parity, L3 accessibility and keyboard, and L4 layout in a real browser ran in parallel on `52815740`. Each lens's findings went to a separate refuter on a fresh snapshot, told to disprove them with a concrete repro. Fixes landed in `6ed9ddf4` and `860b7d8f`.
- L5 test integrity, the mutating lens, ran last on `9054a320` (after the fix round), then its refuter on a fresh snapshot of the same commit. Its fixes landed in `dd99b9e2` and `d8fe2d4c`.
- Vite started by reviewers rewrote `node_modules/.vite/deps` (a regenerable cache) through the junction; nothing else there was written.

### 7.2 Findings and dispositions, L1–L4

Verdicts are the refuters'. "Row" names the test that now pins the fix; the rows sit in `CommandCenterHub.reviewFixes.jsdom.test.jsx` and `HubSheet.reviewFixes.jsdom.test.jsx` unless another file is named.

| ID | Finding (short) | Lens sev. | Refuter | Disposition |
|---|---|---|---|---|
| L1-1 | `src/index.css` forces every `<button>` to 16 px `!important`, beating inline sizes: phone tabs, HubButton, HubLink and the holds rendered 14–28 % large | MAJOR | CONFIRMED (narrowed: those four families only; Row labels, area controls, the strip button and the Brief row size their own children) | FIXED: every label sizes an inner span. Rows "L1-1: every label sizes its own span", "L1-1: links size their own span too" |
| L1-2 | The phone's Reviews list repeats the next action's own game; the candidate carried no record id | MINOR | CONFIRMED | FIXED: the candidate carries `id` (spec §8.2's `review:{id}` needs it); Reviews leave it out. Row L1-2 |
| L1-3 | Phone Overview dropped "All activity · N" | MINOR | CONFIRMED | FIXED, disabled until S4 wires ActivitySheet. Row L1-3 |
| L1-4 | The Forge line lost its live variant and its tail | MINOR | PARTLY (REFUTED as a straight restore: the tail's first clause describes a partnership §8.3 reserves) | FIXED: the locked-in-battle variant and "— never rewrites a game in progress."; the partnership clause stays out. Row L1-4 |
| L1-5 | No teal focus-visible ring | MINOR | CONFIRMED | FIXED: the design's ring, scoped to the hub's three roots (`hub/hubStyle.js` HUB_FOCUS_CSS). Row in `CommandCenterHub.jsdom.test.jsx` (the scoped rules) |
| L1-6 | "appears in Games" is the build's wording, not the spec's, but the copy header said every replacement was the spec's | NIT | PARTLY (the reason was recorded in a test title; the header list was incomplete) | FIXED: the header names it as the one build replacement |
| L1-7 | Research's header row (eyebrow + action) missing | NIT | CONFIRMED | FIXED. Row L1-7 |
| L1-8 | No phone empty note | NIT | CONFIRMED | FIXED. Row L1-8 |
| L1-9 | Panel body 16 vs 18, Loadout gap 14 vs 16, phone heading gap 10 vs 9 | NIT | CONFIRMED | FIXED (the design's values) |
| L1-10 | Draw wore the dim tag; live score plain text; no "0 completed" | NIT | PARTLY (the plain score follows the recorded display-ready-row shape) | FIXED: the draw chip (`--ft-ink-2-rgb`) and "0 completed". ACCEPTED: the score stays a display-ready string from S3's selector. Rows "a recorded draw wears the tinted ink-2 chip", L1-10 |
| L1-11 | Wrapping replaced the design's ellipses | NIT | PARTLY (REFUTED for the status line, which the design wraps on the phone and the hub does not wrap at ≥ 700) | ACCEPTED as deliberate (§3, "nothing truncates at 360 px") |
| L1-12 | "Inherits Inter" is wrong: Inter is never loaded | NIT | CONFIRMED | FIXED in the record (§3: platform sans); carried to S7 |
| L1-13 | Small unrecorded deltas: sheet safe-area padding, Deploy icon margin, primary button's transparent border, wrapping section headers, hold gap 10 vs 8 | NIT | CONFIRMED | FIXED: hold gap 8. ACCEPTED and recorded here: the others (the safe-area padding corrects the prototype; the rest are 1–2 px) |
| L2-1 | Only the hub's root module was kept out of the main chunk: `hubGateCopy.js` could import `hub/hubCopy` (+1.5 kB gzip in the entry, 915/915 green) and any main-graph file could import a hub module (F4–F6 green) | MINOR | CONFIRMED (both halves) | FIXED: `commandCenterHub.mount.guard.test.js` rows "the gate's copy table imports nothing" and "the main graph reaches the hub directory only through App → the gate and App → the picker", each with a planted self-check |
| L2-2 | BottomNav's 3-line insertion staled three `BottomNav.jsx:53-63` / `:57` citations (and the frozen spec's `:53-59`, found by the refuter) | NIT | CONFIRMED | FIXED: the attribute rides on the `<nav` line, so no line moves and every citation holds |
| (L2 verdict) | No flag-off parity defect | — | CONFIRMED | — |
| L3-1 | A composition change within the desktop site remounted the stage, tablist, panel and Deploy card; focus fell to `<body>` | MAJOR | CONFIRMED and stronger: every direction, the Brief's open state reset (against R-S1-5) and a charging hold would remount (spec §5.5) | FIXED in `860b7d8f`: one CSS grid, nothing remounts. Rows L3-1 (same nodes in every direction; focus kept; the Brief survives; grid areas from the order constants; the next slot takes no space without a candidate) |
| L3-2 | Escape and the trap worked only with focus inside the dialog | MINOR | CONFIRMED | FIXED: the dialog takes focus (`tabIndex -1`); the trap pulls stray focus back. Row L3-2 |
| L3-3 | Focus return had no fallback | MINOR | PARTLY (the Safari half untested) | FIXED: the opener is handed at the click, then a fallback (the hub root), never `<body>`. Rows L3-3 |
| L3-4 | Tabpanels not focusable while everything in them is disabled | MINOR | CONFIRMED | FIXED: `tabIndex 0`. Row L3-4 |
| L3-5 | Focus can scroll a row under the strip and nav | MINOR | PARTLY (strip/nav half measured; sticky-row half unmeasured) | FIXED: `scrollPaddingTop` 56, `scrollPaddingBottom` = the clearance. Row L3-5 |
| L3-6 | The hold's fixed name contradicts "Submitting…" / "Deployed" | MINOR | PARTLY (does not bite S1) | FIXED: named by its instruction while it offers the hold, by its label once it reports a phase. Row L3-6 |
| L3-7 | Visible "Later", name "Not now" | MINOR | CONFIRMED | FIXED. Row L3-7 |
| L3-8 | Game rows dropped the Review tag and detail from their name; activity rows dropped the time (refuter) | NIT | CONFIRMED (+1 instance) | FIXED both. Rows L3-8 |
| L3-9 | Arrow keys acted with Alt/Ctrl/Meta held | NIT | CONFIRMED for the mechanism; the Back suppression unmeasured headless (counted PARTLY in the refuter's tally) | FIXED: modified keys are left to the browser. Row L3-9 |
| L3-10 | `<div>` inside `<button>` | NIT | CONFIRMED | FIXED: spans. Row L3-10 (every site, width and fixture) |
| L3-11 | The focus ring clipped by `overflow: hidden` | NIT → MINOR | CONFIRMED (2.4.7 once the toggle is live) | FIXED: the inset ring (`data-hub-inset-focus`) |
| L3-12 | Stacked sheets closing out of order un-inert `#root` early | NIT | CONFIRMED | ACCEPTED: S1 opens at most one sheet. A shared modal stack is needed before S2b / S5 open a second (§8) |
| L3-13 | The strip's two-line clamp is the only truncation left at 360 | NIT | PARTLY (REFUTED for S1 and every fixture; latent for long S2a reasons) | ACCEPTED as an S2a acceptance item (§8) |
| L3-14 | Disabled text below 4.5:1 (exempt, but everything is disabled in S1) | NIT | CONFIRMED | FIXED: the secondary ink at full opacity (strip hold 6.35:1). Row L3-14 |
| L3 extra (b) | The strip button's name had a doubled stop | NIT | CONFIRMED | FIXED. Row "the strip's status button names both lines without a doubled stop" |
| L3 extra (a) | The shipped hold's `width 250ms ease` fill ignores reduced motion | NIT | CONFIRMED by code read | Out of S1 scope (shipped code, inert at progress 0). For R2 / S2b (§8) |
| L4-1 | The ClashBot bug button (fixed, z 9999) covers the strip's right action at both phone widths in every state, and the Deploy card hold at 1280 × 820 sb 220 in 7 of 9 states | MAJOR | CONFIRMED (new with the hub as a persistent overlap; visual only in S1, the hold is disabled) | Founder question Q2 — outside the hub (§9) |
| L4-2 | The active-season banner (z 49, bottom 64) sits over the strip | MAJOR (with an entry) | PARTLY: the geometry holds; no UI path can create an entry today, but legacy active entries would show it | Founder question Q3 (§9) |
| L4-3 | = L1-1, measured | MAJOR | CONFIRMED (MINOR from the layout side; the spill holds only for Arial metrics) | FIXED with L1-1 |
| L4-4 | The strip did not follow a nav that grows after load (the observer watched the content box) | MINOR | CONFIRMED; no production trigger (`index.html` has no `viewport-fit=cover`) | FIXED: both observed by their border box. Row L4-4 |
| L4-4a | Contradicting box-model comments | NIT | CONFIRMED | FIXED (`hub/navClearance.js`, `hub/useNavClearance.js`) |
| L4-5 | The Equipped tag clips in the lower tablet band | MINOR | CONFIRMED (fixtures only) | FIXED: both header rows wrap. Row L4-5 |
| L4-6 | The connector drawn 1 px right and low | NIT | CONFIRMED | FIXED: measured from the overlay's origin. Row L4-6 |
| L4-7 | = L1-12 | MINOR | CONFIRMED | FIXED with L1-12 |

Tally for L1–L4: 39 findings (13 + 2 + 16 + 8), 29 CONFIRMED, 10 PARTLY, 0 wholly REFUTED. The PARTLY verdicts refuted a part of each claim: L1-4's straight restore, L1-6's "not recorded", L1-10's score half, L1-11's status line, L3-13 for S1, L4-2's production reach, and the untested or unmeasured halves of L3-3, L3-5, L3-6 and L3-9. Every CONFIRMED or PARTLY finding that changes S1 code or tests is fixed; the accepted ones are in §8; Q2 and Q3 go to the founder.

### 7.3 The mutating lens (L5) and its refuter

L5 ran on `9054a320`. It found the tree itself clean, but its plants and mutants showed that much of it was not pinned. **52 guard plants: 32 survived.** Every kill was one of its controls. **40 behaviour mutants: 37 survived**, and the 3 that died were controls. Two founder-ruled guards had holes that ordinary code passes through: the no-raw-hex row (R-S1-2) and the copy-centralization row. Before the fixes, every hub file passed alone, in three time zones (from PowerShell; Git Bash passes only `TZ=UTC` to Node), and with isolation on, under shuffled order. The exception is one row, L5-9.

The fix round (`dd99b9e2`) changes tests only; no component file moved, so the §5 measurements and L1–L4 evidence still hold. Round 4 (§7.4) re-ran L5's own specs, unchanged, against it.

| ID | Finding (short) | Lens sev. | Refuter | Disposition |
|---|---|---|---|---|
| L5-1 | The hex row stripped quoted `#[a-z]…` ids first, which deleted every lowercase hex starting a–f: `'#ecfffb'` (the design's untokenized highlight) passed all 820 rows | MAJOR | CONFIRMED (the hole is exactly a bare quoted lowercase hex, first digit a–f, not core; it ships: three planted hexes reached the hub chunk in a build) | FIXED: no strip (the ids never had the hex shape); the self-test runs the row's own pipeline with lowercase, uppercase, core and non-core hexes and the id forms |
| L5-2 | The copy guard saw only letter-led single-line JSX text, a bare quoted child and a fixed attribute list: text after `}`, two-line text, dash-led text, `&&` operands, an unlisted copy prop and a `.js` helper's `label:` all passed | MAJOR | CONFIRMED (+2 ordinary forms: a ternary child and a ternary attribute; copy written in place also escaped the banned-claim scan) | FIXED: an AST pass (acorn + acorn-jsx, already in the install; acorn is used by four repo guards): JSX text, any rendered literal in a child or attribute through `&&` `?:` `+` and templates, copy-named properties in any file; never-copy and token-valued attributes listed; every file must parse. Boundary recorded: a string in a plain variable passed by name |
| L5-3 | Copy functions sampled once, so other branches unseen | MINOR | CONFIRMED | FIXED: the banned-word and number rows read every literal in both tables' source |
| L5-4 | Non-hex raw colours unscanned (`rgba(255,…)`, `'white'`) | MINOR | CONFIRMED | FIXED: numeric rgb()/hsl() and colour names in colour properties |
| L5-5 | SVG paint scan syntax-only; the connector never drawn in jsdom (its anchor and stroke unpinned) | MINOR | CONFIRMED | FIXED: the hairlines added to the static scan; a DOM row checks every paint drawn at both sites in every state; the connector drawn with real boxes, its two R-S1-1 anchors and its computed-hex stroke pinned |
| L5-6 | Motion written as a key or in a CSS string passed | MINOR | PARTLY (the guard hole holds for all four forms; only two would ignore reduced motion — the others keep initial={false}) | FIXED: a key scan (`transition…:`, `WebkitTransition:`, `animation…:`) |
| L5-7 | The URL scan skipped the gate and missed `import.meta.env` / `document.URL` | MINOR | PARTLY (GU1 and GU3 are URL forms the guard missed; import.meta.env is a build switch, not a URL override, and none changes anything with the flag off) | FIXED: both forms added; the gate, its copy and the picker scanned, the gate's pinned reload lifted out first |
| L5-8 | Flag-off parity missed dynamic `import()` from the main graph into the hub directory (inherited from S0, which pinned only the root module's literal) | MINOR | PARTLY, raised to MAJOR: a module-level import() in App or BottomNav fetched a hub chunk on every page load with the flag off (shown in a build); the fixtures form tree-shakes | FIXED: load-time edges from every outside file, App included; every literal path into the directory |
| L5-9 | The chunk row passed only when it ran first (819/820 at seeds 42 and 20261015) | MINOR | CONFIRMED (7 of 12 seeds alone; can red falsely, never pass falsely) | FIXED: the count is read in `beforeAll` after `vi.dynamicImportSettled()`; green unshuffled and at seeds 2, 3, 8, 42, 20261015 |
| L5-10 | The hub-side half of focus return (opener from a label click, the root fallback) and the trap over disabled rows untested | MINOR | CONFIRMED | FIXED: rows on the real History sheet |
| L5-11 | Reduced motion tested only for the Shadow | MINOR | CONFIRMED | FIXED: the area panel, the phone panel and the sheet, with a motion-on control |
| L5-12 | Observer cleanup untested | MINOR | CONFIRMED | FIXED: no live observer after unmount, both sites |
| L5-13 | Strip and phone layout contracts pinned only through pure functions | MINOR | CONFIRMED | FIXED: the safe area counted once (both sides), the pane and sticky row, 44 px phone targets, the scoped style on both sites |
| L5-14 | S1's static states not pinned per section and site | MINOR | CONFIRMED | FIXED: desktop Games and Brief loading, the area summaries, the phone highlight, the checking dot, the inert Brief, the Loadout link |
| L5-15 | The ET rows could not tell ET from Central or a fixed −5 | MINOR | CONFIRMED | FIXED: 04:30 UTC on Oct 16 is Friday in New York |
| L5-16 | No re-render with a new `selectedArea` | MINOR | CONFIRMED | FIXED |
| L5-17 | Fixture-only states unpinned | NIT | CONFIRMED | FIXED (cheap rows) |
| L5-18 | Small behaviours with no row | NIT | CONFIRMED (B19 is not equivalent: App binds window-level Escape listeners) | FIXED (cheap rows) |
| L5-19 | Contrived syntax evades the scans (`from"x"`, `fetch?.(`, `.onkeydown =`) | NIT | CONFIRMED | FIXED: the edge and activity patterns |
| L5-20 | The phone fixture rows are thin | NIT | CONFIRMED (informational) | ACCEPTED: the new rows carry the per-tab and strip checks |

**The builder's survivors.** L5 agreed R8 / Q3 is equivalent (§7.4) and that R4 is moot (its code was removed by the one-grid change).

**The L5 refuter** (a fresh snapshot of `9054a320`) re-ran all 92 of L5's plants and mutants rather than a sample: every verdict matched. It added seven checks of its own: three were killed, and four survived — a backtick hex, a ternary child, a ternary attribute, and GT3 against L5's proposed rows (the fixed guards flag all four: the first three are now planted in the guards' self-tests, and the motion-key row killed GT3 in round 4) and found no other test in the repo that catches the surviving plants (64 files, 2,820 rows, with all 32 applied together). It judged none of the 37 surviving behaviour mutants equivalent: 18 visible in S1 now, 6 device- or browser-conditional, 13 latent until a later slice. It confirmed R8 / Q3 equivalent and R4 moot. Tally: **17 CONFIRMED, 3 PARTLY, 0 REFUTED**, with L5-8 raised to MAJOR.

It also reviewed L5's proposed rows: none vacuous or order-dependent (31 of 31 at four shuffle seeds and under `TZ=Asia/Tokyo`), but five brittle — the connector row pinned the whole curve, three rows selected by the tree's shape, one compared literal `var()` strings, and the two-completed row leaned on a fixture count without asserting it. The adopted rows (`dd99b9e2`, then `d8fe2d4c` for the refuter's notes) assert outcomes instead: only the connector's two R-S1-1 anchors, the drawn path set, the `C` map, the fixture's own count, and "nothing under the panel starts at opacity 0". After the refinements, the affected mutants were re-run: 10 of 10 still killed.

### 7.4 Mutation records (builder)

Each mutant is an exact find/replace on an LF snapshot of the stated commit, run against the named suites, and restored byte-for-byte (the runner checks the restore). KILLED = at least one row failed; SURVIVED = all passed; a run where no test ran would count as BROKEN (none did).

| Round | At | Mutants | Result | Survivors and what happened |
|---|---|---|---|---|
| 1 | `52815740` | 55 over the composition bands, defaults, roving keys, orders, clearance math, the strip's placement and z, the deploy display table, the copy guard, the sheet, the Shadow still, the hold wiring, the box model and the colour and motion rows | 54 killed | K4 (the phone tabs' `tabIndex={on ? 0 : -1}` → `0`) survived; `4a274307` adds the row and kills it |
| 2 | `6ed9ddf4` | 37 on the review-fix rows | 33 killed | R1 (modified arrows let through) and R6 (the dialog's `tabIndex` dropped) survived: the rows now check after each press and assert the dialog itself took focus (`860b7d8f`); R4 (in the focus-restoring hook) is moot, the hook was removed by the one-grid change; R8 is equivalent (below) |
| 3 | `bbc23a86` | 10: R1, R6, R8 again, the one-grid structure (keys on the wrappers, the tablet side order, the stacked wrappers, the next slot) and the activity name | 7 killed | Q9 (the grid always given a next-action row) and Q10 (the activity name without its time) survived; `9054a320` adds the rows and kills both (round 3b, 2 of 2). Q3 (= R8) equivalent |
| 4 | `dd99b9e2` | L5's own specs, unchanged (§7.3): its 52 guard plants (round 1's 40, round 2's 6, round 3's 6 controls), its 40 behaviour mutants, its 4 connector mutants and its eager-import mutant against the new chunk row | **97 of 97 killed** | None. Every kill is the row named for it (no timeout or suite error among them): the raw-colour row kills GH1–GH9 (GH4 also red in tokens.guard), the copy guard GC1–GC8 and GN1–GN3, the URL rows GU1–GU4, the edge rows GF1, GF2, GX4 and GA6, the connector row GS1, B14 and B67, and the new behaviour rows B1–B82 |

**The equivalent mutant (R8 / Q3).** It drops `!invoker.disabled` from the sheet's focus-return check. Browsers and jsdom both ignore `focus()` on a disabled button, and the next line already sends focus to the fallback whenever it did not land on the opener, so the result is the same. The guard stays as a statement of intent.

## 8. Accepted items and notes for later slices

- **Accepted in S1** (reasons in §7.2): L1-10's plain live score, L1-11's wrapping, L1-13's 1–2 px deltas and the sheet's safe-area padding.
- **For S2a:** the strip's line 1 keeps a two-line clamp (L3-13). Every S1 string fits at 360, but a 46-character reason clips in the line-1 box, so S2a's reason vocabulary should be measured at 360 (or line 1 unclamped).
- **For S2b:**
  - Within the desktop site a charging hold no longer remounts on a width change (one grid). Crossing App's 768 px split still remounts the shell (R-S1-5), so the attempt must live above the shell, as spec IR-02 already requires.
  - The shipped hold's fill uses `width 250ms ease` without a reduced-motion check (`HoldToDeployButton.jsx`, shipped code; inert in S1 at progress 0). For R2 / S2b.
  - Q2 and Q3 (§9) need answers before the hold is live.
- **Before S2b or S5 opens a second sheet:** `inertSiblings` snapshots `<body>` at open, so two sheets closing out of order un-inert `#root` early (L3-12). A shared modal stack is the fix.
- **For S7's device checks:** the hub draws in the platform sans, so the 360 px margins (the 85 px phone tab cell holding "Partnership") need a check on real iOS and Android faces. Spec §10's "named physical phone" is the founder's, on the smoke preview or in S7.
- **If `viewport-fit=cover` ever ships:** the safe-area inset then arrives after load; the strip already follows it (L4-4's border-box observation), but this is unproven on a device.
- **Flag-off observations, not defects (L2 refuter):** every lazy chunk but one gets new bytes because the entry's export letters were reassigned (cache churn only); BottomNav's inert `data-ft-bottom-nav` attribute is in the DOM on every mobile screen.
- **Review hygiene:** reviewers' Vite and vitest runs wrote the regenerable caches `node_modules/.vite/deps` and `node_modules/.vite/vitest/…/results.json` through their junctions. Nothing else in `node_modules` was written.

## 9. Founder questions

None of these blocks S1: the flag is dark, every section is loading and every action is disabled. Each needs an answer before the hold becomes live (S2b) or before activation.

**Q1 — the stacked order.** R-S1-3 writes the stacked order as next action → stage → area panel → Deploy → Games → Activity → Brief, and gives its purpose as keeping an enabled hold in the first viewport with maximum rows (spec §10). The build follows the order as written (src/components/CommandCenter/hub/composition.js:116). Measured (§5):

| Shell (hub width) | No next action | With a next action |
|---|---|---|
| 834 × 1000, sidebar 220 (614), as written | 832–880 (blocked 931–979) of 1000 | 1114–1204 of 1000 — outside |
| same, Deploy above the panel | 562–610 | 746–816 — inside |
| 769 × 900, sidebar 220 (549), as written | 877–925 of 900 — outside (blocked 997–1045) | 1180–1251 — outside |
| same, Deploy above the panel | 589–637 | 772–842 — inside |

The literal order misses its stated purpose whenever a next action shows at 614, and at the narrowest desktop site even without one. Moving Deploy above the area panel fits every state at both widths. **Asked:** keep the order as written, or put Deploy above the panel in the stacked composition (a one-line change to `STACKED_ORDER` and its rows)? The change was not made, because the ruling's order is explicit.

**Q2 — the ClashBot bug button.** App mounts `ClashBotWidget` for every signed-in user (`src/App.jsx:12522-12532`), fixed at right 16, bottom 80 on mobile, 48 × 48, z 9999 (`src/components/ClashBot/ClashBotWidget.jsx:366-377`). On the hub's mobile site it sits on the strip's rightmost action at 360 and 390 in every state (1,824–1,968 px² of the hold; a tap at 80 % of the hold hits the bug button), and at 1280 × 820 with the 220 px sidebar it covers part of the Deploy card's hold in 7 of 9 states. The legacy mobile dashboard has no fixed element in that band, so the overlap is new with the hub; `src/components/Agent/ProposalBanner.jsx:137` (bottom 84) and `src/components/Forge/ForgeScreen.jsx:1113` (bottom 80) already share the slot elsewhere. Spec §10's layer list does not mention the widget. The fix is App-side, outside S1's files. **Asked:** withhold the button on the hub's mobile site at its mount (the `hidden` precedent at `src/App.jsx:12530`), or lift its bottom above the strip and nav (which would need the strip's measured height)?

**Q3 — the active-season banner.** With an active season entry App renders `ActiveSeasonBanner` on mobile, fixed at bottom 64, z 49 (`src/App.jsx:12439-12440`). Over the hub it covers the strip's second line and both strip buttons' centres (z 49 > 40), and spec §10's stack (page < strip 40 < nav 50) has no slot for it. The L4 refuter found no UI path that can create an entry today (every route into the season screens starts inside them; `ForgeLanding` and `ForgeScreen` are not mounted), but the season reader has no flag, `api/season/create-entry.js` still accepts a POST, and with the crons de-registered (C-19) a legacy active entry never settles. Whether any exist needs one production read, which this build did not make. **Asked:** withhold the banner on the hub's mobile site, or include it in the strip's measured stack?

## 10. The smoke branch — NEVER MERGE

**NEVER MERGE.** No PR is opened for it; delete it once the smoke is done.

- **Branch:** `claude/command-center-hub-s1-smoke` at `7140dc33` = the build branch's code head `d8fe2d4c` plus one commit touching two files:
  - `src/config/featureFlags.js:3306` — `COMMAND_CENTER_HUB_ENABLED = false` → `true` (the S0 precedent);
  - `src/components/CommandCenter/CommandCenterHub.jsx` — `?hubFixtures=<scenario>` (ruling R-S1-4: the smoke branch only, the Cockpit Build 2a precedent). It imports the layout fixtures and reads `URLSearchParams(window.location.search)`. A name that is not a scenario, or no parameter, gives the S1 state.
- **The build branch is untouched by it:** the `false` value, its pins, and the no-URL and no-fixtures guards stay as they are there.
- **Red by design on the smoke branch:** the dry run against the hub, theme and config suites and the 13 App-reading suites (1,144 rows), with an unedited control. Exactly 5 rows go red that the control does not have:
  - the pin row (`commandCenterHubFlags.test.js` "ships DARK");
  - the flag-pin guard's contradiction and integrity rows;
  - the mount guard's "no hub module reaches the layout fixtures" row;
  - its "no URL, history or cookie reaches the hub side (ruling R-S1-4)" row.
  
  `App.xpModal.jsdom`, which renders App at desktop width and so meets the hub, stays green. The control's only failures are the three known Windows path-separator rows of `agentReadCensus.guard` (also red on the smoke run).
- **Preview URL:** <https://trade-seven-lbj4gabvo-fais-projects-bc179554.vercel.app> (Vercel deployment `7109123050`, ready at 02:11 UTC on Oct 16, 10:11 PM ET on Oct 15). Checked on the served preview: `index.html` answers 200 and preloads nothing; the entry's hub flag is compiled `true`; the hub chunk `CommandCenterHub-BRAvH0RC.js` (63.6 kB) carries the `?hubFixtures` reader and the S1 copy.

**What to look at**, signed in, on the dashboard screen. Each scenario is `?hubFixtures=<name>` on the dashboard URL:
- **No parameter — the S1 state:** every section reads its loading line, the strip and the Deploy card read "Checking eligibility…", every action is disabled, Partnership shows only its reserved line.
- **`returning`, `long`, `review`:** the next action (review), Games with completed rows, the History sheet from Games' History link (Escape returns focus).
- **`first`:** the first-deploy next action. **`rankedLive`:** a live ranked game with deploy still ready — the strip shows "Open" and "Deploy" in one row. **`active`:** a live game locked in. **`blocked`:** deploy blocked with a reason. **`checking`:** rows with eligibility still checking.
- **Widths:**
  - Phone (≤ 768): compact stage, tabs Overview · Research · Partnership · Loadout (Overview by default), the strip above the bottom navigation.
  - 834 × 1000 with the sidebar collapsed: tablet (Loadout by default, Deploy above Games). With the sidebar expanded: stacked (614 px). `?hubFixtures=returning` there shows Q1.
  - 1280 × 820: desktop with the sidebar collapsed; tablet (1060) with it expanded.
- **Expect, and do not count as a hub defect:** the ClashBot bug button over the strip's right action on phones (Q2).
- **Unchanged:** the starfield, the sidebar and bottom navigation, every other screen.

## 11. Next slice

**S2a** — the eligibility and attempt pure selectors and their fixtures (spec §11.2; depends on S1 and the approved contract, not on R1/R2). S3 (Games reader), S5 (Loadout), S6 (Research and the reserved Partnership) and S7 (the Shadow canvas and device validation) also depend only on S1 and can proceed alongside it; S4 follows S3; S2b waits for reviewed R1/R2. Each builds behind the same flag, into the frames S1 laid down, replacing `HUB_S1_SECTIONS`' loading states with its reader's states.
