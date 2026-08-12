# WIRE D-4 — DECISION MEMO: Kim's `sector_vs_spy` unverifiable basis

**Date:** August 12, 2026 · **Branch:** `claude/d4-sector-vs-spy-memo-u5zbhb` · **HEAD:** `fe4f8668` (= `origin/main`, 0 behind; `git fetch origin` run first per §3) · **Posture:** read-only decision memo — no code, no fix, no fence contact. Advisory input to a founder ruling. · **RULED (A), post-gate (Aug 12, 2026)** — see the Founder Ruling at the end.

**What this answers.** D-4 (`DRIFT_LEDGER.md:84-100`) asks the founder to choose between **(A)** threading a SPY operand into Kim's S7 snapshot so `sector_vs_spy` becomes real, and **(B)** retiring `sector_vs_spy` for an honest raw-sector-move basis. The five questions below are answered against the shipping code at HEAD; every claim carries a `file:line` + **VERIFIED** anchor (appendix).

> **Terminology note.** "C1 shape photograph" is not a formal label in the code or specs (searched — no match). I read it as the **Calibration Addendum §1 "Persisted shapes at HEAD" table** (`PHASE2_CALIBRATION_ADDENDUM_V1_1.md:20-31`) — the only shape photograph in the record, and the thing a snapshot-key change would invalidate. The memo uses that reading throughout; correct me if "C1" means something else to you.

---

## EXECUTIVE VERDICT

| Axis | (A) Seam-fix: thread SPY into S7 | (B) Contract-fix: retire `sector_vs_spy` |
|---|---|---|
| **Snapshot key set** | **Changes** — adds a top-level `spy` operand → re-issues the §1 shape photograph | Unchanged — no snapshot touch |
| **Epoch axes bumped** | `WIRE_EDITORIAL_ADAPTER_VERSION` + `WIRE_GENERATION_VERSION` (+ `WIRE_VALIDATOR_VERSION` for the sector-subject wiring) | `WIRE_VALIDATOR_VERSION` + `WIRE_DIGEST_RENDERER_VERSION` + `WIRE_GENERATION_VERSION` |
| **Two-period window** | **Resets** (tolerance add, §6) | **Resets** (validator/renderer/generation bump → gateEpoch) |
| **Gate class of the basis** | **PROXY** (coverage caveat, 5-of-11 ETFs) — not STRICT | n/a — basis retired |
| **Slots added to the 5-strict/8-proxy map** | **+1 proxy figure slot** → 5-strict / **9**-proxy (magnitude proxy 2→3) | **0** — Kim stays gate-silent |
| **Kim as a §5 contributing shape** | **Yes** — S7 becomes a real contributor (floor redundancy gained) | **No** — S7 contributes zero, permanently |
| **Prose honesty** | Label becomes *true*; gate can now catch a mislabel | Basis rename; validator vocabulary + digest stop asserting "vs SPY" |
| **Hidden cost the D-4 one-liner understates** | Entity resolution: `sector_vs_spy` is `market_scoped` with **no subjectRef** on `sector_rotation` and `primaryTicker` hardcoded null — you must also wire *which* sector, which pulls in the validator + the seam | Reusing `price_vs_prior_close` still won't verify Kim (null-primaryTicker binding fails) — "honest" ≠ "verifiable" without more work |
| **Timing** | **Post-gate** (window-resetting) | **Post-gate** (window-resetting) |

**Recommendation: (A), concurring with your lean — but scope it honestly.** (A) is the only option that converts S7 from a dead shape into a live, *contributing* shape, which is the redundancy you're paying for. The caveat: (A) is **not** the one-file snapshot touch the D-4 summary implies — it is a coordinated change across the snapshot shape, the adapter, the tolerance table, **and** the validator/seam (to resolve which sector the figure is about), and it re-issues the §1 calibration photograph. Both options are **post-gate**; neither may run inside the two-period baseline window because both reset it. Full reasoning in §5.

---

## 1. Cost of (A) — does adding SPY change the S7 key set?

**Yes — if SPY is added as its own operand (the form a clean relative figure needs).** Today the S7 snapshot is exactly three keys (`generate-column.js:376-384`):

```
dataSnapshot: { columnType, topSectors, sectorPerformance:[{symbol,price,changePercent}] }
```

`SECTOR_ETFS` is eleven `XL*` funds with **no SPY** (`generate-column.js:32`), and only the first five are fetched (`:202` `slice(0,5)`) — this is the addendum's "5 of 11 ETFs." To compute `sector − SPY` you need SPY's `changePercent` at rest. The natural form mirrors Kai's S1 leg — a top-level `spy:{price,change,changePercent}` — which **adds a fourth top-level key**. That is a key-set change, and it re-photographs the S7 row of `PHASE2_CALIBRATION_ADDENDUM_V1_1.md:30`.

(Smuggling SPY *inside* `sectorPerformance` as a row avoids a new top-level key, but still changes the §1 photograph's recorded operand set — "5 of 11 sector ETFs" would become "5 sectors + a benchmark" — and still needs a new adapter path to *subtract*, so it buys nothing. The honest accounting is: the photograph changes either way.)

**Shape-detection is safe but fragile.** `detectSnapshotShape` returns S1 only when `spy && qqq && dia && iwm` are all present (`wireEditorialAdapters.js:164`) and S7 on `Array.isArray(sectorPerformance)` (`:170`). Adding **only** `spy` does not trip S1 → S7 still detects. Worth recording as a live coupling: if a later change also added `qqq/dia/iwm` to S7 it would silently reclassify as S1.

**The coordinated amendment (A) requires — all in one epoch:**

1. **Snapshot shape** (`generate-column.js:376-384`): add the `spy` operand. This file is a GENERATION_SURFACE manifest member (`wireGenerationSurface.js:95`) → the content-hash lock **forces `WIRE_GENERATION_VERSION` 18 → 19** (`wireContracts.js:139`).
2. **Adapter recomputation** (`wireEditorialAdapters.js:379-380`): `sector_vs_spy` is presently a dead `missing_operand` return. Implement `expected = sector.changePercent − spy.changePercent`. New recomputation formula = **`WIRE_EDITORIAL_ADAPTER_VERSION` 1.0.0 → next** (`wireContracts.js:154`).
3. **Tolerance** (`wireEditorialAdapters.js:68-81`): add a closed-table entry for `sector_vs_spy × pct`. Per §6 (`PHASE2_CALIBRATION_ADDENDUM_V1_1.md:93-95`; `wireContracts.js:151`) **any tolerance change bumps `adapterVersion` and resets the two-period window** — so this is the line that resets the clock.
4. **Entity resolution — the understated cost.** `sector_vs_spy` is `market_scoped` (`wireContracts.js:453`), so it does **not** bind through `primaryTicker`; it needs a subject leg the way `index_vs_prior_close` uses `subjectRef` (`wireEditorialAdapters.js:208`). But `sector_rotation` has **no subjectRef** in its contract (`wireContracts.js:395-401`) and Kim's seam sets `primaryTicker: null` (`generate-column.js:370`) while the row allows 0-5 tickers. So a rotation story naming three sectors gives the adapter no way to know which sector the single magnitude value is about. Closing that gap means either adding a sector `subjectRef` enum to the contract (a validator change — `wireValidator.js:203,225-229` today drops any non-`index_move` subjectRef → **`WIRE_VALIDATOR_VERSION` bump**) or wiring `primaryTicker` to the lead sector ETF at the seam and reclassifying. Both are real work beyond "add SPY."
5. **Version coupling.** Because the editorial version constants live in `wireContracts.js` (a manifest member, `wireGenerationSurface.js:86`), the adapter bump **also** dirties the generation manifest → the `WIRE_GENERATION_VERSION` bump is forced a second way (`wireContracts.js:38-44`). Epoch-consistent by design.
6. **Re-issue the §1 photograph.** Calibration records are immutable (README maintenance rules) — the S7-row change ships as a **new versioned addendum**, not an edit to V1.1.

**Two-period window: resets — yes** (step 3, the tolerance add; and independently the generation bump resets gateEpoch, `wireEditorialRun.js:154-162`).

---

## 2. Cost of (B) — what the contract change touches

(B) retires `sector_vs_spy` for an honest raw basis. Surface:

1. **`EVENT_CONTRACTS`** (`wireContracts.js:395-401`): swap `sector_rotation.magnitudeBases` and `directionBases` off `sector_vs_spy` onto the honest basis (either the existing shared `price_vs_prior_close`, or a new `sector_change`).
2. **Basis-scope classification** (`wireContracts.js:440-454`): drop the `sector_vs_spy` entry; add/scope the replacement.
3. **Digest templates** (`wireDigest.js:25-39`): the `sector_vs_spy: {suffix:' vs SPY'}` clause (`:37`) must be removed/replaced so the renderer stops asserting a vs-SPY relationship → **`WIRE_DIGEST_RENDERER_VERSION` 1.0.0 → next** (`wireContracts.js:140`), and the new version added to `RECOGNIZED_WIRE_DIGEST_RENDERER_VERSIONS` (`:183`).
4. **Validator closed vocabulary**: the validator does **not** re-literal the basis list — it derives it (`wireValidator.js:252` `contract.magnitudeBases.includes`; `:289` `figureBasesFor`). So the vocabulary change *flows automatically* — but the resulting behavior change (a model declaring `sector_vs_spy` now SALVAGE-drops; the new basis now passes) **is validation behavior**.
5. **Generation manifest**: `wireContracts.js` is a manifest member → **`WIRE_GENERATION_VERSION` bump** forced.

**Does retiring a basis require a `WIRE_VALIDATOR_VERSION` bump? Yes.** Changing the closed vocabulary changes what the validator accepts and rejects — the FINAL-LOCK §7.4 caveat is the governing precedent: *"a … content change is a validation-behavior change — bump `WIRE_VALIDATOR_VERSION` … so each stamp is truthful about its own axis"* (`PHASE2_CALIBRATION_ADDENDUM_V1_1.md:129-133`). `WIRE_VALIDATOR_VERSION` is `1.6.0` at HEAD (`wireContracts.js:15`) → next.

**Net for (B): three epoch axes** — `WIRE_VALIDATOR_VERSION` + `WIRE_DIGEST_RENDERER_VERSION` + `WIRE_GENERATION_VERSION` — plus in-commit reconciliation of the contract/digest/exemplar tests that pin the vocabulary.

**Trap in (B):** if the "honest raw basis" is the existing `price_vs_prior_close`, Kim **still won't verify.** That basis is `ticker_scoped` and its S7 path requires `bindsToPrimaryTicker` to succeed — exactly one entity equal to `primaryTicker` (`wireEditorialAdapters.js:150-157,283-286`). Kim's `primaryTicker` is null and the row carries up to five tickers, so it returns `unbindable` every time. So "honest" does not buy "verifiable" unless (B) *also* fixes the null-primaryTicker binding — which is extra work (B)'s framing hides.

---

## 3. Gate impact of each

**How the gate counts.** The floor is `verifiedCount ≥ 5 AND contributingShapes ≥ 2` (`wireEditorialRun.js:61-62,226-227`). A **contributing shape** is a distinct snapshot shape (S1–S7) among stories the adapter returned VERIFIED_CORRECT/WRONG for (`:175,197`). A NOT_VERIFIABLE story contributes nothing. So "contributing" is per-shape, not per-slot — this is the number that matters more than the strict/proxy map.

**Under (A): PROXY, not STRICT; +1 proxy slot; S7 becomes a contributing shape.**
- **PROXY.** The subtraction of two server-sourced quotes is exact, but the operative caveat is **coverage** — only 5 of 11 sectors are stored (`generate-column.js:202`), the same caveat that already makes S7's `price_vs_prior_close` **PROXY-e** in the map (`PHASE2_CALIBRATION_ADDENDUM_V1_1.md:53`; adapter caveat `proxy_e_coverage`, `wireEditorialAdapters.js:295`). It would only reach STRICT if the seam also stored all 11 sectors (a bigger snapshot change).
- **Slots.** `sector_vs_spy` is one cell — Kim's sector_rotation own-basis slot, currently `UNAVAILABLE` (`PHASE2_CALIBRATION_ADDENDUM_V1_1.md:53`). It flips to PROXY: the figure map **5-strict/8-proxy → 5-strict/9-proxy** (`:58,110`), and the magnitude map proxy **2 → 3** (`:59`). So **+1 proxy verification slot**, not more (`sector_vs_spy` is not in the shared figure bases, so it appears on no other row).
- **Floor.** The real prize: S7 joins the contributing-shape pool. As a `directionBasis` (`wireContracts.js:398`) it also arms the adapter's `direction_inversion` critical (`wireEditorialAdapters.js:122-127`), so Kim's stories become gate-bearing.

**Under (B): Kim contributes zero verification slots, permanently — confirmed.** `sector_vs_spy` retired to a raw basis that (per §2's trap) either has no operand or won't bind. S7 never yields a VERIFIED story → never a contributing shape. Kim adds **0** to the 5-strict/8-proxy map.

**What that means for the ≥2-contributing-shapes clause.** The floor needs two distinct shapes to *each* land a VERIFIED story every qualifying period. Today the dependable pair is **S2 (Alex mover) + S3 (Neta econ print)** — the exact pair the addendum's own reachability argument rests on (`PHASE2_CALIBRATION_ADDENDUM_V1_1.md:91`). **S5 (Doug earnings) is seasonal** — legitimately zero in an earnings blackout — so it cannot be relied on as the second shape. (S1/Kai is nominally PROXY-capable but the addendum leans on S2+S3, not S1, so I won't over-credit it.) With Kim permanently out under (B), the reliable set stays at **exactly two**, and a week where Alex is quiet *and* Doug is in blackout has no slack — the floor fails and the two-period window extends (which is correct behavior, but it's fragile). **(A) turns that two into a three**: S7 becomes a standing, non-seasonal contributor, giving the ≥2 clause a genuine backup. That redundancy is the concrete thing (A) buys and (B) does not.

---

## 4. Prose honesty — what stops the raw-move-labeled-`sector_vs_spy` mislabel

All four qualified Kim companions labeled a raw sector move as `sector_vs_spy` (`audits/20260731_WIRE_N2_EXEMPLAR_QUALIFICATION_AND_EMBED.md:53,77`). The mislabel is **baked into the contract vocabulary**, not just the prompt: the tool schema offers `sector_vs_spy` as Kim's only magnitude basis (`wireContracts.js:397`), the model fills it with the only number it has (the raw move), and the digest renderer then prints `"… +1.2% vs SPY"` from the `sector_vs_spy` clause (`wireDigest.js:37`) — asserting a relationship the data never computed. (Latent today: writes are off and Kim embeds zero exemplars, so nothing reaches production.)

- **A pure prompt rule is insufficient.** Telling Kim "only use `sector_vs_spy` when truly relative" doesn't help while the schema still offers the basis and no SPY operand exists to make it true.
- **(A) makes the label true.** With a SPY operand and the adapter path, the figure genuinely is sector − SPY, the digest's "vs SPY" is accurate, and the adapter now *catches* a mislabel (recompute vs declared → VERIFIED_WRONG / `direction_inversion`). The honesty fix is "make the basis real," enforced by the gate.
- **(B) removes the false relationship by rename.** Retiring `sector_vs_spy` from the closed vocabulary makes it structurally undeclarable — the derived validator SALVAGE-drops it (`wireValidator.js:252-259`) — and the digest clause changes so the renderer stops saying "vs SPY." The honest lever is a **basis rename backed by the validator constraint** (they're the same act here, because the validator derives from the contract), plus the digest-template change.

Either way the mechanism is structural (operand or vocabulary), not a soft prompt instruction.

---

## 5. Recommendation, and pre-flip vs post-gate

**I concur with your lean toward (A) — with one honest correction to its price tag.**

**Why (A):**
- It is the *only* option that makes Kim a **contributing shape**. Given S5's seasonality leaves S2+S3 as the sole reliable pair (§3), a standing third contributor is real gate resilience — exactly the "gate redundancy is worth real cost" you named.
- It preserves the semantic that *is* the column: a sector-rotation story is about **relative** strength. (B) demotes Kim's typed facts to raw moves — the same number Alex already reports per-ticker — which is a semantic downgrade, not just a cheaper fix.
- It fixes the digest honesty for free — no renderer change, the "vs SPY" clause simply becomes true — and upgrades the gate from blind to catching Kim's mislabels.

**The correction:** (A) is **not** the single-file snapshot touch the D-4 one-liner implies. Honestly scoped it is a coordinated, three-lever epoch change — snapshot shape (`+spy`, re-photographs §1), adapter formula + tolerance (`adapterVersion` + window reset), **and** sector entity-resolution (a `subjectRef`/`primaryTicker` decision that reaches the validator). Budget it as a small arc, not a patch. If your only goal were "stop teaching a false basis at minimum cost," (B) does that and nothing more — but it buys no redundancy and, as written, doesn't even make Kim verifiable (the null-primaryTicker trap). Since your goal is the redundancy, (A) is right; just fund it correctly.

**Pre-flip or post-gate: unambiguously post-gate — for both options.**
- D-4 itself is filed post-gate, below D-3 (`DRIFT_LEDGER.md:96-100`): there is **no production corruption today** — writes are off and Kim's typed facts are gate-silent by design — so there is none of D-3's pre-runway urgency (D-3 must merge *before* `WIRE_WRITES` because it corrupts persisted facts once writes flip; D-4 does not).
- Both options **reset the two-period window / gateEpoch** (A via the §6 tolerance rule + generation bump; B via the validator/renderer/generation bumps, all of which are gateEpoch axes — `wireEditorialRun.js:154-162`). Running either *inside* the baseline window would reset the qualification clock. So the sequence is: **let the gate qualify on today's 11-exemplar set first, then land the Kim fix as a post-gate arc** — which also lets Kim's deferred exemplars come back in the v2 embed (the exemplar deployment is itself a gateEpoch input, `wireExemplars.js:55`, `wireContracts.js:92`). That ordering is consistent with how D-4 was filed and with the register note that the deferred types return "for their v2 embed."

**STOP.** This is the memo. No code, no fence contact, no PR. Ruling is yours — if you pick (A), the natural first step is a Phase-0 discovery scoped to the sector entity-resolution question (subjectRef enum vs single-sector primaryTicker), since that is the fork that decides whether the validator is in scope.

---

## Appendix — citation ledger (all VERIFIED at HEAD `fe4f8668` this session)

| Claim | Anchor |
|---|---|
| D-4 registered, post-gate, below D-3 | `docs/DRIFT_LEDGER.md:84-100` |
| Kim embeds 0; all four mislabel raw move as `sector_vs_spy` | `docs/audits/20260731_WIRE_N2_EXEMPLAR_QUALIFICATION_AND_EMBED.md:18,53,77` |
| S7 snapshot key set `{columnType,topSectors,sectorPerformance}` | `api/fantasytimes/generate-column.js:376-384` |
| `SECTOR_ETFS` has no SPY; 5-of-11 via `slice(0,5)`; `primaryTicker:null` | `api/fantasytimes/generate-column.js:32,202,370` |
| `sector_vs_spy` is a dead adapter path (`missing_operand`) | `api/_utils/wireEditorialAdapters.js:379-380` |
| S7 `price_vs_prior_close` PROXY-e path; coverage caveat; binding rule | `api/_utils/wireEditorialAdapters.js:150-157,283-296` |
| Shape detection S1 (spy+qqq+dia+iwm) / S7 (sectorPerformance) | `api/_utils/wireEditorialAdapters.js:164,170` |
| `sector_rotation` contract: bases `['sector_vs_spy']`, tickers `[0,5]`, no subjectRef | `api/_utils/wireContracts.js:395-401` |
| `BASIS_SCOPE.sector_vs_spy = market_scoped` | `api/_utils/wireContracts.js:453` |
| Digest clause `sector_vs_spy → ' vs SPY'` | `api/_utils/wireDigest.js:37` |
| Validator derives basis from contract; drops non-`index_move` subjectRef | `api/_utils/wireValidator.js:203,225-229,252,289` |
| Versions: VALIDATOR 1.6.0 · GENERATION 18 · DIGEST_RENDERER 1.0.0 · ADAPTER 1.0.0 | `api/_utils/wireContracts.js:15,139,140,154` |
| Tolerance change bumps adapterVersion + resets two-period window | `api/_utils/wireContracts.js:151`; `api/_utils/wireEditorialAdapters.js:68-81`; `docs/PHASE2_CALIBRATION_ADDENDUM_V1_1.md:93-95` |
| Manifest members: `generate-column.js`, `wireContracts.js`; version coupling | `api/_utils/wireGenerationSurface.js:86,95`; `api/_utils/wireContracts.js:38-44` |
| §7.4 caveat: validation-behavior change bumps `WIRE_VALIDATOR_VERSION` | `docs/PHASE2_CALIBRATION_ADDENDUM_V1_1.md:129-133` |
| §1 shape photograph (S7 row); §2 5-strict/8-proxy totals; §5 floor; §7.1 | `docs/PHASE2_CALIBRATION_ADDENDUM_V1_1.md:20-31,58-59,84-91,110` |
| Floor code: ≥5 verified + ≥2 shapes; contributing = distinct shape among VERIFIED | `api/_utils/wireEditorialRun.js:61-62,175,197,226-227` |
| gateEpoch axes (generation/validator/renderer) reset the window | `api/_utils/wireEditorialRun.js:154-162`; `api/_utils/wireContracts.js:38-44` |
| Exemplar deployment is a gateEpoch input | `api/_utils/wireExemplars.js:55`; `api/_utils/wireContracts.js:92` |

---

## FOUNDER RULING (August 12, 2026)

**Option (A) confirmed — seam-fix: thread a SPY operand into the S7 snapshot so `sector_vs_spy` is computed and verified.** The memo's scope correction is **accepted**: (A) is a coordinated epoch change, not a single-file snapshot touch —

- snapshot shape (`+spy`) → re-issues the §1 shape photograph + forces `WIRE_GENERATION_VERSION`;
- adapter formula + tolerance → `WIRE_EDITORIAL_ADAPTER_VERSION` + **two-period-window reset**;
- sector entity-resolution (which sector the figure is about) → reaches the validator, likely `WIRE_VALIDATOR_VERSION`.

**Deferred post-gate — no code at ruling.** This is a scheduling decision only. Because (A) resets the two-period window, it must **not** run inside the Phase-2 editorial baseline window; it waits until the gate has qualified on the current 11-exemplar set, then lands as its own arc together with Kim's deferred **v2 exemplar embed** (the embed is itself a gateEpoch input).

**First step when unblocked:** a Phase-0 read-only discovery scoped to the entity-resolution fork — **sector `subjectRef` enum vs single-sector `primaryTicker`** — since that fork decides whether the validator is in scope (and therefore whether this is a two-axis or three-axis epoch change). That discovery is a new task on a fresh branch (BUILD_RULES §2), cut when the gate window is clear.

*Ruling recorded on the D-4 memo branch; DRIFT_LEDGER D-4 updated to RULED (A), post-gate.*

---

*20260812_WIRE_D4_SECTOR_VS_SPY_DECISION_MEMO.md — advisory; founder ruled (A), post-gate. Dark; no code.*
