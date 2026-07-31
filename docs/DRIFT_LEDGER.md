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


## D-3 — Wire A2 remap overwrites correct `subjectRef`s at Kai's `index_move` seam — 🚩 PRE-RUNWAY (must merge before `WIRE_WRITES_ENABLED`)

**Found:** FantasyTimes Wire N2 exemplar qualification (N2.1), 2026-07-31. Full disposition:
`docs/audits/20260731_WIRE_N2_EXEMPLAR_QUALIFICATION_AND_EMBED.md` (Defect D-3).
**Where:** the Kai pulse seam sets `storyDoc.primaryTicker` from the model's `storyData.primaryTicker`
— typically **SPY meaning "the market,"** not "the S&P is the subject" (`api/fantasytimes/generate-pulse.js:354,391`).
It is passed as `primaryTickerRaw` to the validator (`api/_utils/wireWriteThrough.js:115`), where the
A2 internal-consistency remap (`api/_utils/wireValidator.js:214-224`) maps `ETF_TO_INDEX['SPY']='SPX'`
and **overwrites** a correctly model-emitted `subjectRef` (e.g. `NDX` on a tech-led pulse) to `SPX`
(`S1_SUBJECT_REMAPPED`). But `index_move` is **cardinality-0** — it has no primary ticker to be
consistent with, so the remap operand is meaningless.

**Impact:** any non-S&P-led pulse (Nasdaq/Dow/Russell) is silently relabeled `SPX` in persisted facts
and the digest. **Harmless while `WIRE_WRITES` is OFF** (nothing persists); **fatal once it flips** — it
contradicts the embedded NDX exemplar (N2) and writes a wrong-subject `index_move`, a period-fatal
Phase-3 gate criterion (N3.4).
**Why not fixed in the N2 PR:** N2 is exemplars-only on its own branch (Spec V1.2 §4 step 2). A2 is a
V1.6 amendment; changing it is validation-behavior work needing its own branch/review and an epoch
input (`WIRE_VALIDATOR_VERSION` or `WIRE_GENERATION_VERSION`) that must settle **before** the baseline
window opens.
**Fix seam (pre-runway task):** honor the cardinality-0 rule — `primaryTicker` is **null on `index_move`**.
Either pass `primaryTicker=null` to `publishStoryWithWire` when the emitted `eventType` is `index_move`
(seam), or skip the A2 `ETF_TO_INDEX` remap for cardinality-0 eventTypes (validator; the remap fires only
for `model_required` subjectRef, i.e. `index_move`, so its premise is always broken). Regression: a
Nasdaq-led pulse keeps `NDX`, a Dow-led pulse keeps `DJI`, a genuine S&P pulse still renders `SPX`.
**Owner:** Wire arc, pre-runway. Recorded Jul 31, 2026.

---

## D-4 — Wire Kim `sector_vs_spy` has no SPY operand at the S7 seam (founder decision memo)

**Found:** FantasyTimes Wire N2 exemplar qualification (N2.1), 2026-07-31. Full memo (two options,
recommendation): `docs/audits/20260731_WIRE_N2_EXEMPLAR_QUALIFICATION_AND_EMBED.md` (Defect D-4).
**Where:** Kim's `sector_rotation` magnitude basis is `sector_vs_spy` (a sector's move relative to SPY),
but the S7 sector-column snapshot carries **no SPY operand at rest** — the deterministic adapter returns
NOT_VERIFIABLE and the value a reporter would populate is the sector's **raw daily change**, not a vs-SPY
figure. The basis cannot be truthfully populated at this seam.

**Impact:** Kim's only magnitude basis is un-verifiable and, if populated, mislabels a raw move as
vs-SPY. **This is why kim embeds zero exemplars in N2 v1** (honesty rule — no teaching a false basis at a
gate-silent seam). No production corruption today (writes off; Kim's typed facts are gate-silent by design).
**Why not fixed in the N2 PR:** it is a **founder decision**, not a mechanical fix — (A) thread a SPY
operand into the S7 snapshot so the basis becomes real (adapter/generation-surface cost, post-gate), or
(B) retire `sector_vs_spy` for a basis the seam actually has (contract-vocabulary cost). Priority **below
D-3**.
**Owner:** Wire arc, post-gate. Recorded Jul 31, 2026.

---

S5 "News-Catalyst Momentum" — decided dissolved, still live. Regime Revamp dissolved news-as-entry-signal; at HEAD dd28eedf, S5 ships in both game-mode variants of the eval system prompt (agentEvalPromptAssembly.js:154-159, 376-380), directing entries on positive-sentiment FantasyTimes stories and exits on negative. Retirement is scoped into FantasyTimes Wire Phase 3. Until then, live behavior contradicts locked design. Owner: Wire arc. Recorded Jul 24, 2026.
