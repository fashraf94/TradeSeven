# Call Record — Field Contract V1.0

**Date:** 2026-09-23 · **Author:** Fable (Command Center arc) · **Status:** confirmed by the framework-review chat (§9 of V0.1 both confirmed; three additions folded in) · **Supersedes:** V0.1.
**Consumers:** the cockpit spec (tiles, sheets, answer endpoint, chat chip) and the pilot spec (called-vs-happened review). One shape, both arcs. Commit with the cockpit spec.

---

## 1. Home and rules

- `agentBattles/{battleId}/calls/{callId}` — one family, `kind ∈ {called_shot, confirmation, pick}`. No record kind is called "shot"; `called_shot` keeps the product word where it belongs.
- `firestore.rules`: owner-readable, **no client write path**, mirroring `intradayViews`. Independently subscribable (sidesteps PLC-008).
- Server-only writers: the evaluation cron (mint; state flips on encounter), the close-of-day sweep (expiry backstop), the answer endpoint (§6). The capture writer never writes here; the tick carries `callId` as a reference.
- Retention: the battle-record lifecycle, not the capture bodies' TTL.

## 2. Source — born structured or not at all (all six tile kinds)

The model's evaluation output gains one typed `declarations` block, reviewed once. Prose is never scraped for any tile.

```
declarations: {
  calledShots: [{ symbol, direction: 'entry'|'exit', slot, counterpart, condition: { side: 'above'|'below', level }, horizonPhrase, defaultAction: 'act'|'hold', said }],
  watching:    [symbol],                                                 // → Monitoring tile
  playerAsk:   { question, options: [string], symbol? } | null,          // → Research-objective tile
  fork:        { slot, swapOut, options: [{ symbol, why }], said } | null // → Two-way tile
}
```

**Authority line:** the typed fields govern; `said` is presentation. A `said` that claims beyond its typed fields is a loggable divergence (a future J1-shaped check), never a second source of truth. A malformed declaration is not born. A well-formed one citing a level or evidence absent from what the check was shown is **minted as `invalidated`** — recorded, typed, never hidden.

## 3. Fields

| Field | Type | Authority / note |
|---|---|---|
| `callId` | string, stable | minted once; the tile, the chat chip and the player's answer reference it, never an evaluation index |
| `kind` | `called_shot` · `confirmation` · `pick` | confirmation = an exit shot whose `defaultAction` is `act` |
| `battleId`, `tickId`, `evalId`, `evalSeq` | refs | the utterance's check; `tickId` is the join to capture |
| `mintedAt` | ms | |
| `symbol`, `direction`, `slot`, `counterpart` | | for `pick`: `options[]` instead of `symbol` |
| `condition` | `{ side, level }` | typed; numeric level in the symbol's price |
| `horizon` | `{ expiresAt, basis }` | **wall-clock, market time**, computed at mint from `horizonPhrase` via R6's translation table; never a check count |
| `defaultAction` | `act` · `hold` | what the agent does if the player says nothing; the divergence baseline for §6 |
| `said` | string | the agent's own sentence, verbatim from the declaration; presentation only (§2) |
| `evidence` | `{ tickId, intradaySweepId?, priceAsOf }` | cutoff authority is the capture record via `tickId`, referenced never duplicated; `intradaySweepId` only when intraday facts were shown; `priceAsOf` is derived display data, labeled so |
| `hypothesisRef` | `{ watchlistId, equippedConfigHash, battleId }` \| null | v1 join; upgrades to the versioned hypothesis ref when the pilot contract lands (R7) |
| `origin` | `equipped` · `agent_initiative` | null ref ⇒ `agent_initiative`; absence typed, never fabricated |
| `state` | see §4 | |
| `stateChangedAt`, `stateSource` | ms; `mint` · `check` · `close_sweep` | |
| `playerResponse` | `{ answer, kind: 'directive'\|'ack', directiveId?, exchangeId, filedAt, heardTickId? }` \| null | enum plus references only, never copied text; written only by the answer endpoint |
| `directiveId` | ref | for `pick`, and for any divergent answer: the directive filed through the canonical gate — the call carries it, never replaces it |
| `outcome` | `{ actedTickId?, receiptRef?, heldOff?, reasked? }` \| null | after `hit` |
| `render` | `{ chatExchangeId }` | the chat line rendered from this record (the "→ cockpit" chip); the tile's reverse deep link target |

## 4. State machine

`open` → `hit` (condition met at a check; the player's response decides what the check did) · `invalidated` (at mint, or when the cited hypothesis or evidence is withdrawn) · `expired_unresolved` (horizon passed, condition never met — flipped by the check on encounter, or by the close sweep) · `ended_with_battle`. Terminal states are honest outcomes.

`playerResponse.answer ∈ { go, hold, ask, go_now, keep, pick, agree, disagree }`.

## 5. Tile vocabulary ↔ record

| Tile | Record |
|---|---|
| Watching | `open`, no `playerResponse` |
| Your call filed | `open`, `playerResponse` set, `heardTickId` null |
| Acted | `hit`, `outcome.actedTickId` set |
| Held off | `hit`, answer `hold`/`keep`, heard |
| Asking you | `hit`, answer `ask`, `outcome.reasked`, no re-ask answer yet |
| Expired | `expired_unresolved` · `ended_with_battle` |
| Dropped | `invalidated` — "cited evidence the check didn't have" |

## 6. The answer endpoint and the directive rule

`POST /api/agent-battle/call-response` (name per discovery; mirrors the shipped directive write path, which discovery must establish — B2 never merged). Authenticates the owner; verifies the call is `open` (or `hit` awaiting a re-ask answer) and the answer is legal for its `kind` and state; then:

- **Divergent answers file a directive through the canonical gate** — `hold` or `ask` against an `act` default, `go_now` against a `hold` default, `disagree`, `pick` (the symbol-scoped kind, with its four-layer mismatch fixture in the acceptance set). `playerResponse.kind = 'directive'`, `directiveId` set.
- **Endorsing answers are recorded acknowledgments** — `go` against an `act` default, `keep`, `agree`. `playerResponse.kind = 'ack'`, no directive.

One transaction; typed rejections; nothing written on rejection.

## 7. The chat reads the record (second consumer)

The agent's chat prompt gains a **bounded calls block** — open calls, `hit` awaiting an answer, and the last N resolved, each with `playerResponse` and heard status — sourced from the records. When the player opens chat about a tile, the agent answers from the record, not from recollection. The block's size and its place in the Voice Layer prompt are spec items; the change rides the same fenced review as the evaluation schema.

**The join runs both ways:** the chat line carries the "→ cockpit" chip (record → chat); tapping a tile opens chat scrolled to `render.chatExchangeId` (tile → chat).

## 8. Flags, shadow, dependencies, retirements

- `CALL_RECORDS_MODE ∈ { off, shadow, on }`. **shadow**: declarations minted, states flipped, nothing rendered — a week of records before any tile exists. **on**: the chat renders anticipation lines from the record with the chip; tiles read the subcollection; the chat prompt gains the calls block. Independent of `TICK_CAPTURE_ENABLED` by construction.
- Dependencies: the deferred-beat PR (the close sweep cannot be trusted while deferred battles are skipped silently); the tick-side `callId` reference (capture-writer extension, §2-reviewed, rides this build); `firestore.rules` for `calls`; the pick directive kind at the gate.
- **Retired, superseded by contract (record on the arc ledger):** the `ANTICIPATION_THRESHOLD_LINT_MODE` flip; the drop receipt (an `invalidated` record is the receipt).

## 9. Skin ruling for the spec

The V4 mockup contributes structure, behavior and vocabulary only. The skin is the shipped Battle View's design tokens, **referenced by name, never by hex**. Any genuinely new state accent is defined as a token derived from the existing palette. The mockup bundle's own palette is excluded; discovery verifies which of its `CMD` names are real tokens in `commandUI.jsx`.

## 10. Ownership and sequence

Cockpit arc builds: `declarations` schema + call writer (fenced, founder-reviewed; shadow first) → rules + tick reference + close sweep → answer endpoint + pick directive kind + chat calls block → cockpit UI (gated per Brief §8). Dials: the exit-dials arc. The pilot spec consumes this shape unchanged.
