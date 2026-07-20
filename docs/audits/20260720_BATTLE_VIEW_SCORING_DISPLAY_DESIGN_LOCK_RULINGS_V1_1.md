<!--
TRANSCRIPTION NOTE: This document is the founder's verbatim design-lock ruling
(Battle View Scoring Display — V1.1 Addendum), delivered as a chat paste on
2026-07-20 and committed to the record byte-faithfully in the same session that
produced the Phase 0 discovery it accepts. It is a founder decision record, not
session-authored analysis. It supersedes by ADDITION (it refines Design Spec V1
and rejects two options the discovery surfaced); the discovery report it accepts
(docs/audits/20260720_BATTLE_VIEW_SCORING_DISPLAY_PHASE0_DISCOVERY.md, HEAD
8f131d7e) is immutable and unchanged. Code file:line references are the founder's
own, carried over from the discovery at HEAD 8f131d7e — re-verify before relying.
This addendum + the discovery report + Design Spec V1 form one §7 review packet.
-->

# Battle View Scoring Display — Design-Lock Rulings (V1.1 Addendum)

**Date:** 2026-07-20
**Re:** `docs/audits/20260720_BATTLE_VIEW_SCORING_DISPLAY_PHASE0_DISCOVERY.md` (HEAD `8f131d7e`)

**Discovery verdict:** accepted in full — no re-discovery. The §2 gap table (report §4.2) is adopted verbatim as acceptance criteria for the §7 scoring-model fix. This addendum + the discovery report + Spec V1 join the §7 adversarial-review packet as one design.

## Ruling 1 — Rival-orb freshness: LABEL, don't flatten (both proposed options rejected)

Neither all-banked nor unseal-rivals ships in this arc.

- Keep the current computation exactly as is — `youLiveScore` gating untouched, no new reads, pinned tests (`buildArenaModel.test.js:200-282`, `ClimbArena` couplings) survive unchanged.
- Make freshness legible: inside the training/activation window, the owner's orb renders a LIVE indicator; every banked orb (all rivals always; the owner outside the window) renders an "at day-N close" caption sourced from the same day snapshot the value comes from. The label must be driven by the same condition that selects the value (one accessor decides both), so label and number cannot disagree.
- Rationale: the confusion was unlabeled asymmetry, not asymmetry. Ranked already sits at all-banked parity; the split exists only in training, where the live orb is the product's one intraday heartbeat and is worth keeping.
- Backlog (post-launch, separate arc): unseal CPU books in training pods and make all four seats live. In training the owner is the only human, so sealing CPU books protects no one; bounded cost (3 extra doc reads). Not this build.

## Ruling 2 — Cell treatment: single hero

One number per cell: total points (`star.points`), signed, color-coded. No banked-vs-live split on the cell face and no `settleState`-mirrored dual treatment. Decomposition is the breakdown's job (R2). `settleState`'s existing muted/est/official rendering for user cells is unchanged — that axis is provisional-vs-official, not banked-vs-live, and stays as is.

## Ruling 3 — Breakdown shape: confirmed, with a self-checking hardening

The extended component per Spec V1 §2 is confirmed: ordered `{label, value}` term rows, per-day sections within the tournament window, departed-leg rows, layer subtotals with the ×1.5 line explicit, window-statement header, all fed from persisted attribution only (no client re-derivation, no live OHLCV dependency for the math; the sparkline may keep its fetch as decoration or be dropped — builder's choice).

**Hardening (new, binding):** the component MUST sum its own rows and compare against the displayed total it was opened from. On mismatch beyond display precision it renders a visible discrepancy state (both numbers + "these should match") instead of silently trusting either. §9 becomes a runtime tripwire on every open. A dev-mode console error accompanies it.

## Adopted from the discovery (binding on the builds)

- **R1 mechanics:** flip `headline` to `'pts'` at the model (`buildArenaModel.js:418`) AND change the hero expression to `star.points` (`StarCell.jsx:258-259`) including sign/color/textShadow conditionals. Do not blanket-swap `star.banked` — `captionFor` uses it intentionally. Add `fmtMult` (−0 collapse) at `StarCell.jsx:262` and `:273`.
- **R2 wiring:** score-hero tap region in `StarCell` (distinct target from the ticker tap), threaded via `onOpenBreakdown(star)` through the docks/mobile to `LeagueBattleArenaLive`, which owns modal state.
- **R3 wiring:** ticker tap → `onOpenResearch(tk)` → `researchAsset` state → `<AssetResearchModal asset={{symbol,name}} onClose showActionButton={false} isGameContext version={2}/>`, asset memoized. Template = the research-only callers (`BaggerBombBattleView.jsx:646`, `AgentBattleScreen.jsx:1057`), not the draft-context acquirer.
- **Multi-day-mode invariant:** any badge display preserves the `AGENT_BATTLE_DURATION_MODE` tripwire (report §4.5 note) — if badges ever bank into a live doc, they surface as an explicit source before summing.

## Handed to the §7 spec (agenda items)

1. The §4.2 persistence list, verbatim, as acceptance criteria (user layer non-fenced; agent doc-shape under the fence gate).
2. Scorer-duplication decision: `calculateAssetScoreServer` (fenced) as a byte-parallel copy of `calculateAssetScoreV3` is the documented local-copy bug class. §7 must put unification into a Node-clean shared module on the table as an explicit founder decision — not assumed, not skipped.
3. Departed-leg persistence: entry & exit price per swap/dropped leg; departed items exposed ungated.
4. Layer-subtotal plumbing (`agentSubtotal`, `userSubtotal`, `k`, `composite`) on the arena model.

## Spun off as independent tasks (do not fold in)

- BaggerBomb constant drift (`BaggerBombBattleView.jsx:674-685` literals vs `AgentBattleScreen.jsx` constants): small, non-fenced, doesn't wait for §7. Own branch, drift-ledger entry.
- CPU-book unseal for training pods (Ruling 1 backlog).

## Sequencing (unchanged from Spec V1 §5)

§7 fix → void poisoned pods + fresh validation pod → this display build (flag-gated dark → smoke on validation pod → flip). No build proceeds until then.
