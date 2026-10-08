# Growth Replay

An offline experiment: does what an agent has learned change the trading calls it makes?

It takes Trading Brain requests that production already sent (the tick capture:
`agentBattles/{battleId}/ticks` and `tickBodies`) and sends them to the Anthropic API again:

| Arm | What is sent | Question |
|---|---|---|
| 1 — noise floor | the recorded request, unchanged, on the production model, repeated | how often does the brain repeat itself? |
| 2 — memory | the same request with the agent's learned section emptied (`strip`), replaced by another agent's (`swap`), or with the player's equipped sections emptied (`loadout`) | do those edits move decisions more than the noise does? |
| 3 — model ladder | the recorded request with only the model changed | would another model decide differently, and at what cost? |

It measures whether decisions change, not whether they improve. The report is
`docs/audits/20261008_GROWTH_REPLAY_EXPERIMENT.md`.

## Safety properties

- **Read-only on Firestore.** Only `.get()`, `.select()` and `getAll()` are called. There is no write call in the file.
- **No product code is imported.** Nothing that initializes Firebase or reads a feature flag. The facts it needs (section headers, the decision tool's validation order) are re-derived and cited in the report.
- **Model calls never touch a product handler.** Plain `fetch` to `api.anthropic.com`, so no capture record, cron state or battle document is written.
- **Secrets.** `CLAUDE_API_KEY` (the variable the production brain reads) and `FIREBASE_ADMIN_CREDENTIALS` are read from the environment, then this tree's `.env.local`, then the primary checkout's `.env.local`. Nothing is copied, printed or written.
- **Player text stays local.** Request bodies, responses and the exhibits file are written only to `%USERPROFILE%/growth-replay-runs/<runId>/`, outside the repo.
- **Spend is capped in code** at submit time: planned ≤ $150, worst case ≤ $185, and no batch is created after 2026-10-10T23:00:00Z.

## Commands (from the repo root, Windows PowerShell or any shell)

```
node scripts/experiments/growth-replay/growthReplay.js plan          # gate, corpus counts, seeded sample (no spend)
node scripts/experiments/growth-replay/growthReplay.js pilot         # ≤10 billable synchronous calls; prints the run plan and its cost
node scripts/experiments/growth-replay/growthReplay.js submit --go   # creates the batches (after the founder's "go")
node scripts/experiments/growth-replay/growthReplay.js status --wait # polls every 5 minutes for up to 2 hours
node scripts/experiments/growth-replay/growthReplay.js collect       # saves results, retries server errors once, deletes the batches
node scripts/experiments/growth-replay/growthReplay.js analyze       # runs the selftest first, then the measures
node scripts/experiments/growth-replay/growthReplay.js selftest      # synthetic: noise → no effect; planted 30% shift → moves decisions
```

Every command except `plan` and `selftest` acts on the newest run; pass `--run <runId>` for another.
