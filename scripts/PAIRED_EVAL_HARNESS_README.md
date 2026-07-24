# Paired-Evaluation Harness (P2.7 — Spec DR-10 stage 2)

The offline half of the two-stage shadow validation. Stage 1 (the P2.6
assembly shadow, `SHADOW_ASSEMBLY_ENABLED`) accumulates structural prompt
diffs per battle-tick in `agentBattles/{battleId}/shadowDiffs/{tickId}` —
assembly-only, no LLM calls. This harness is stage 2: it replays the
**captured live contexts** through the **candidate (manifest-derived)
prompts** via the API, off-tick, and reports the measures the Spec requires
before any behavior-affecting flip (manifest-read migration, DR-13 identity
block, preset freeze — R1 finding 28):

| Measure | Where it lands in the report |
|---|---|
| Input size | `inputSizes` (chars per prompt part, live + candidate) + per-call `inputTokens` |
| Truncation | `live.truncated` / `candidate.truncated` (`stop_reason === 'max_tokens'`) |
| Latency | `live.latencyMs` / `candidate.latencyMs` |
| Citation | `citation.citedCount` + `citedOutsideRendered` per side |
| Refusal compliance | `refusalCompliance` (tool_use produced vs refused) |
| Action divergence | `actionDivergence.decision` / `.symbols` (live vs candidate tool output) |

## No production wiring

This is a script, not a cron (BUILD_RULES §6: no new schedule entries). It
reads the shadowDiffs corpus, writes a **local JSONL report only**, and
spends API tokens only when a human runs it. It never writes to any
production collection.

## Prerequisites

1. A shadow corpus: preview/smoke with `COMPILER_ENABLED`,
   `MANIFEST_WRITE_ENABLED`, `SHADOW_ASSEMBLY_ENABLED` on (Phase 2 exit
   criterion 4) long enough that **divergent** diffs exist — identical-tick
   docs carry hashes only (the founder-ruled payload discipline) and cannot
   be replayed; divergent docs carry all six full prompt-part texts.
2. `GOOGLE_APPLICATION_CREDENTIALS` for the Admin SDK (same as other
   `scripts/`).
3. `ANTHROPIC_API_KEY` (not needed for `--dry-run`).

## Usage

```bash
# Measure-only pass over up to 10 divergent diffs (no API calls):
node scripts/paired-eval-harness.js --dry-run

# Replay 25 divergent diffs for one battle:
node scripts/paired-eval-harness.js --battle <battleId> --limit 25

# Full options:
node scripts/paired-eval-harness.js \
  [--battle <battleId>]   # per-battle read (avoids the collection-group index)
  [--limit 10]            # divergent pairs to replay
  [--model claude-haiku-4-5-20251001]  # the live tick's model (default)
  [--dry-run]             # assemble + measure inputs only
  [--out report.jsonl]    # report path (default: timestamped in CWD)
```

## DR-13 mode (`--dr13`) — identity-block pre-flip validation

Added for the DR-13 arc (founder Flag F ruling, 2026-07-24). Pairs the SAME
eval input under two system prompts — flag-off (production today) and
flag-on (the archetype identity block spliced in via
`spliceEvalIdentityBlock`, which the injection test locks byte-equal to the
real fenced flag-on output, all six archetypes × both variants). Emits per
pair: prompt-part sizes, the char/token delta, a byte-level proof the diff
is **exactly** the identity block, and — when an API key is present — paired
Haiku decisions at `temperature: 0` for decision-drift review.

Input sources (real corpus preferred, synthetic floor):

```bash
# Synthetic floor — six archetypes × both variants, no Firestore, no key:
node scripts/paired-eval-harness.js --dr13 --synthetic --dry-run

# Synthetic with paired decisions (needs ANTHROPIC_API_KEY):
node scripts/paired-eval-harness.js --dr13 --synthetic

# Real corpus (preferred once the SHADOW_ASSEMBLY_ENABLED flip, PR #671,
# has accumulated divergent shadowDiffs) — up to --n inputs per archetype;
# the archetype code-id is read from the parent battle doc:
node scripts/paired-eval-harness.js --dr13 [--battle <battleId>] [--n 10]
```

DR-13-mode caveats:

- Only **divergent** shadowDiffs docs carry replayable texts (identical
  ticks are hash-only — the payload discipline), so the corpus mode's usable
  sample is the divergent subset; `--synthetic` is always available.
- The synthetic mode replays each of its 12 pairs **once** — repeating one
  fixture at `temperature: 0` adds nothing. The "N≥10 identical inputs per
  archetype" leg of the DR-13 validation needs the real corpus.
- A post-flip run is handled honestly: if the checked-out flag already
  renders the block, the ON form is taken as-built and the OFF form is
  recovered by excising the block's exact bytes.

Notes:

- Replays run at `temperature: 0` (the live tick uses 0.4) — divergence must
  be attributable to the **prompts**, not sampling noise. Report it as such.
- Without `--battle`, the script uses a `collectionGroup('shadowDiffs')`
  query; if Firestore asks for a collection-group index, either create it in
  the console or use `--battle` per battle (no index needed).
- The replay sends the same three-part message shape and
  `TRADE_DECISION_TOOL` schema as the live tick (imported from the same
  module — one source).
- Each JSONL row carries the A-1 envelope identifiers (`tickId`,
  `manifestId`) so results join back to the shadow corpus and the manifest.
