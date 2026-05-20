# Authority Mode — Post-Launch Backlog

**Decision date:** 2026-05-19
**Status:** Active backlog. Revisit when auto-pilot is complete (see prerequisites).

## The decision

For launch, FantasyTrades ships **auto-pilot only**. Co-pilot and manual modes
are deferred. The infrastructure for all three modes exists in the codebase
(see the authority mode discovery findings) and is preserved as future assets.

## Why

The discovery pass surfaced two truths:

1. The full three-mode infrastructure was built but archived during the V2
   transition, when the product was simplified to auto-pilot-only for faster
   beta delivery.
2. The current auto-pilot experience itself is incomplete. It executes trades
   competently but lacks several capabilities that are prerequisites to
   meaningfully layering veto-based modes on top.

Adding co-pilot and manual back without first completing auto-pilot would
build product complexity on top of product unclarity. The cleaner path is to
make auto-pilot great, then decide whether the additional modes still serve
a real need.

## What "complete auto-pilot" requires

Three workstreams that need to land before this backlog is revisited:

### 1. User-customizable trade-frequency strategy in the Forge

Users need the ability to express trading-style preferences as rules the agent
operates against. Examples:

- "Take profit when a holding gains 5+ points"
- "Cut a holding when it loses 7+ points"
- "Bias toward higher-frequency rotation" vs. "hold longer"

The Forge already has the Custom Rule Builder infrastructure
(`CUSTOM_RULE_BUILDER_TECHNICAL_REFERENCE.md`). This work extends that builder
with trade-frequency and profit-taking primitives, then wires the agent's
evaluation cron to honor those rules.

### 2. Voice Layer research-scout register

The agent should feel like a research scout that surfaces new ideas, not just
an execution engine that runs trades silently. This is a Voice Layer prompt
design problem, not an authority mode problem.

Specifically: trade narration, anticipation, and the mid-battle research
register need to lean into the "here's something I'm watching, and here's why"
pattern. Auto-pilot users should feel like they're watching a curious mind at
work, not just receiving notifications of executed trades.

This is part of the Voice Layer Rework (Phases 2, 3, and 6 of the rework
roadmap). When that work lands, the research-scout problem is mostly solved.

### 3. Profit-taking rule templates

Even before users build custom rules in the Forge, the platform should ship
opinionated profit-taking templates as defaults — sensible starting points
that a user can equip on their agent without writing rules from scratch.
Examples: "momentum-rider," "swing-trader," "buy-and-hold-with-stops."

These should be Forge presets, equippable as a strategy collection.

## When to revisit co-pilot and manual

The criteria for revisiting:

- All three workstreams above are shipped and stable for at least one month
  of live use
- User feedback genuinely surfaces a demand for finer-grained execution
  permission (not just "I want to participate," which the Voice Layer
  solves, but "I want to approve specific trades")
- The product team has a clear answer to: "what does co-pilot give the user
  that the completed auto-pilot doesn't?"

If those three conditions hold, the un-archiving work is relatively cheap.
The infrastructure exists. The components exist. The Firestore rules permit
it. What's required:

- Remount `ExecutionModeToggle` in the live `AgentBattleScreen`
- Mount `ProposalBanner` (or `ProposalCard`, whichever is decided as the
  primary surface) in the live screen
- Add deploy-time mode selection to the battle creation flow
- Reconnect the dropped `pendingProposal` prop into `AgentChat`
- Resolve the copilot expiry semantics question (the current code
  auto-executes on silence; the product stance V1.1 says self-veto on
  silence; this was unresolved at launch because the modes were deferred)
- Update the Voice Layer to handle the proposal-pending state in
  conversational surfaces

## What stays preserved in the codebase

The following code is preserved as production-quality future assets. It is
documented with header comments pointing to this backlog. **Do not delete
during cleanup passes:**

- `src/components/Agent/AgentStrategyTab.ARCHIVED.jsx` — the host tab for
  authority mode UX
- `src/components/Agent/ExecutionModeToggle.jsx` — the mode switcher
- `src/components/Agent/ProposalBanner.jsx` — floating proposal banner with
  countdown and approve/veto
- `src/components/Agent/ProposalCard.jsx` — alternative card-style proposal
  surface
- `api/cron/agent-evaluate.js` proposal logic — the server-side proposal
  lifecycle (now guarded; see Launch Guard comments in that file)
- `api/_utils/agentSwapExecution.js` — the swap execution path used by both
  immediate and proposal-approved flows
- Firestore rules permitting client writes to `executionMode` and
  `pendingProposal` (intentionally left permissive)

## Reference

- `AUTHORITY_MODE_DISCOVERY_FINDINGS.md` — the discovery pass that surfaced
  the current state of the codebase
- `FANTASYTRADES_VOICE_LAYER_PRODUCT_STANCE_V1_1.docx` — original product
  stance referencing three modes (now superseded for launch but preserved
  for future)
- `FANTASYTRADES_VOICE_LAYER_PRODUCT_STANCE_V1_1_ADDENDUM_B.md` — the
  two-sided loop thesis (mode-agnostic; still authoritative)
- `FANTASYTRADES_VOICE_LAYER_REWORK_ROADMAP.md` — the rework roadmap (Phase
  1 onward, scoped to auto-pilot only for launch)
