# Drift Ledger

Pre-existing bugs and display/behaviour drift found **incidentally during builds** and
deferred to **separate tasking** (BUILD_RULES §3: "Found a bug outside your task? Report
it for separate tasking; do not fix it."). Each entry is a report, not a backlog commitment —
it states the drift, the `file:line`, why it wasn't fixed in the finding PR, and the fix seam.

---

## D-1 — Deploy-success toast renders with the RED error style

**Found:** Deploy Ceremony Phase 2 (client) Phase 0 discovery, 2026-07-23.
**Where:** `src/App.jsx:6583` — the deploy-success path calls
`showToast(\`Agent deployed to BaggerBomb! 🤖💣\`)` with **no `type` argument**.
`showToast(message, type = 'error')` (`src/App.jsx:2502-2505`) defaults `type` to `'error'`,
and the toast render (`src/App.jsx:12012-12034`) paints `'error'` with the red background
`#ff4757` (the green success style `#00ff88` is only used when `type === 'success'`). So the
**success** toast renders red.

**Impact:** cosmetic — a successful deploy shows a success message in the error color.
**Why not fixed in the ceremony PR:** this sits on the **flag-OFF** deploy path, which the
Deploy Ceremony smoke checklist (spec §11) requires to remain **byte-identical to `main`**.
Passing `type='success'` would change flag-off behaviour. (Under the flag-ON ceremony this
toast is suppressed entirely — the reveal is the confirmation — so the ceremony sidesteps it.)
**Fix seam (separate task):** pass `type='success'` at `App.jsx:6583`.

---

## D-2 — Deploy-success toast copy hard-codes "BaggerBomb", diverging from `deployText`

**Found:** Deploy Ceremony Phase 2 (client) Phase 0 discovery, 2026-07-23.
**Where:** `src/App.jsx:6583` hard-codes `Agent deployed to BaggerBomb! 🤖💣` regardless of the
agent's maturity, while the deploy button's label `deployText` (`src/hooks/useAgent.js:93-101`)
returns `'Deploy'` (veteran) / `'Deploy — I know the playbook'` (maturing) — neither says
"BaggerBomb". Button and success toast disagree for veteran/maturing agents.

**Impact:** minor copy inconsistency.
**Why not fixed in the ceremony PR:** same flag-OFF byte-identical constraint as D-1 (spec §11).
**Fix seam (separate task):** align the toast copy with `deployText` (or a maturity-aware string)
at `App.jsx:6583`. As with D-1, the flag-ON ceremony suppresses this toast.


S5 "News-Catalyst Momentum" — decided dissolved, still live. Regime Revamp dissolved news-as-entry-signal; at HEAD dd28eedf, S5 ships in both game-mode variants of the eval system prompt (agentEvalPromptAssembly.js:154-159, 376-380), directing entries on positive-sentiment FantasyTimes stories and exits on negative. Retirement is scoped into FantasyTimes Wire Phase 3. Until then, live behavior contradicts locked design. Owner: Wire arc. Recorded Jul 24, 2026.
