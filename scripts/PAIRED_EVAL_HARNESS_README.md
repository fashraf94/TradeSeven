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
