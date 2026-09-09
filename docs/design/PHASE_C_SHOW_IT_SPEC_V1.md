# Phase C — Show It, the research path: Spec V1 (for Sol's short pass)

**Date:** September 9, 2026
**Status:** Spec V1, pre-build. Founder rulings 1–6 (Sep 8). **Sol's targets are §7.** Build: Opus; review: Fable.
**Basis:** `docs/audits/20260908_PHASE_C_SHOW_IT_PHASE0_DISCOVERY.md` (every `file:line` below; on branch `claude/phase-c-discovery-audit-xmiltc` until the build cherry-picks `9c325971`) · D-43, D-44, D-54, D-101 → D-115.
**Suggested commit location:** `docs/design/PHASE_C_SHOW_IT_SPEC_V1.md`

---

## 0. The one paragraph
**Show it** is the second verb. Tap a name and the platform shows you what it knows — the technicals it already computes and the fundamentals already on the rankings mirror — as a dated, attributed card in the conversation. It is a read, not a fetch, wherever the data already sits; a chip, not a classifier, decides that you asked; a count of research cards, not a new field, enforces the cap. **In V1 the character does not narrate the card.** The platform's numbers appear as platform data, labelled as such, and the character speaks about them only if you ask a follow-up — through the grounded prompt, with the card in its history. Forward path is Equip (D-54). `debate.js`'s eleven forecasting lines never reach a reader.

---

## 1. The trigger — a structured request, never a model's guess
- **The research chip:** `suggestedActions` gains `{ kind: 'research', symbol }` beside `directive` and `ask` (`normalizeSuggestedActions`); the server validates `symbol` against the battle's universe (book ∪ bench ∪ hot bench ∪ the equipped watchlist) exactly as a directive id is validated, and drops any other. The client renders it `Show it · MPC` and its tap calls the research route — never the chat route. The four drop points the discovery found (item 7) each become a pass-through.
- **The Why? door:** the panel's third door, `Show it · 1 of 3` (D-31's cost-before-tap), calls the same route with the piece's symbol. **A Bench chip** carries the same door.
- `research_only` (the post-call model label the gate nulls) stays as it is; a typed question with no data still gets the honest "I don't have that" today, and the chips are how the character offers the card.

## 2. The route — `POST /api/agent/research`
Body `{ agentId, battleId, symbol }`. In order: auth; owner; agent-belongs-to-battle (the shared predicate); **the universe check**; **the cap** (§4) read inside the transaction; the technicals from the warm data cache (`getStockAnalysisData` + `calculateAllIndicators`, the path `debate.js` uses — its own guard widened to the universe, `flattenBenchServer` read only; nothing fenced edited); the fundamentals from the rankings mirror the cache brief already holds — **no screener call** (item 4: the mirror covers every field the card needs); the card composed by code; one transaction writing a `research` exchange and returning it. **No model call.** `maxDuration` sized to the technicals fetch's cold path (the discovery's latency table) with the same clamp discipline as `chat.js`.

## 3. The card — a tape entry
`messageType: 'research'`, `groundingVersion: 1`, eyebrow `Research`, scoped to the symbol, persisted as an exchange (so a follow-up sees it in history under the §3.4 rule). Sections, each with its provenance:
- **Technicals** — the indicator set `calculateAllIndicators` returns, **null-honest**: an indicator whose window is short renders nothing (the MACD constant the discovery found is a separate fix and never a line here). Label: `Technicals · last quote {time} · daily indicators as of {date}`.
- **Fundamentals** — the mirror's fields (`trailingPE {value, sectorMedian}`, `revenueGrowthPct`, `marketCapClass`, `earningsRevisions30d`, `beatRate`), null-honest. Label: `Fundamentals · as of {computedAt}` (a date; never a cadence word).
- **The standing** — the row's own scoreboard facts when the name is held (the same numbers the row shows; never recomputed), or `On the bench` / `On the watchlist`.
- **The first on-screen platform-data label** — `Platform data · not what the check saw` — in `decisionRecord.js`, so the card can sit on the same screen as Phase B's evidence (`What the check saw`) and never be confused with it (E14).
- **No archetype lens** (there is no field), no recommendation, no forecast, no `suggestedAction` — `debate.js`'s defence framing, counter-argument, conviction, stances and first-person directives are not inputs to the card.
- The card's door: `Equip` (the shipped mechanism), when the name is not already equipped.

## 4. The cap — derived, not stored
The cap is **the count of `research` exchanges on the battle doc** — three per battle — enforced inside the route's transaction (an in-transaction read of `chatExchanges`) and shown on the doors as `1 of 3` from the same count. No new battle-doc key (no fence contact), no new collection, **no message charged** — the message budget is for influence (D-31); research is not influence. A fourth tap returns a `research_exhausted` status and the door reads `3 of 3`.

## 5. The narrator
No narration call in V1. When the user asks a follow-up, the card is in the grounded history as a `research` exchange; the grounded rules gain one line in `GROUNDED_SHARED_RULES`: *"A research card is the platform's data at its labelled date. You may describe it. You do not recommend, forecast, or state what the trading process will do with it."* The reply lint applies to that reply as to any grounded reply (the discovery's item 13 makes applying the lint to chat replies a build item here, scoped to research follow-ups).

## 6. Flag, cost, files
`SHOW_IT_ENABLED = false` (pinned, `DARK_BY_DESIGN`, read at call time); the route 404s until it resolves on; chips and doors render only when it does. Cost per tap: one warm cache read, one doc transaction; no EODHD call unless the cache is cold. Files: the route, `normalizeSuggestedActions`, `debate.js`'s guard, the card component, the Why? door, the Bench chip, `decisionRecord.js` (four strings), the grounded rule, tests — over the review threshold. No new cron (39/40).

## 7. For Sol — two targets
1. **The cap's honesty.** "Show it · 1 of 3" counts persisted research cards. Attack: can a failed transaction leave the door's count and the server's count disagreeing? Is "not a message" the right economics when the same tap could have been typed as a question that *would* cost one?
2. **The card as platform data on a screen that also shows the decider's evidence.** Two labels — `What the check saw` (Phase B) and `Platform data · not what the check saw` (Phase C) — on one screen. Attack: is the distinction legible to a player, or does a fundamentals number beside a check's evidence read as the same thing? Does putting the card in the narrator's history invite it to treat platform data as its own evidence — and is the §5 rule enough?

## 8. Ledger (append after D-115)
| # | Ruling |
|---|---|
| **D-116** | Show it is a research chip or a door — a structured request validated against the battle's universe; never a model's classification of a typed question. |
| **D-117** | The research card is code-composed from the warm technicals path and the fundamentals mirror; no screener call; no narration in V1; null-honest with a date on every section. |
| **D-118** | The cap is the count of research exchanges, three per battle, enforced in the route's transaction; no new key, no message charged. |
| **D-119** | `Platform data · not what the check saw` is the label for anything the platform knows that the decider did not see at a check; `What the check saw` is Phase B's; the two never share a section. |
| **D-120** | The MACD constant in `debate.js` and the cached technicals is a live honesty bug fixed separately: render nothing on a short window, then widen the fetch. |

*Show it: the platform's own numbers, dated and attributed — never a forecast, never a recommendation, never a decision.*
