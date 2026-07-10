# LevelStory — Session 1: Data Discovery Report

**Status:** 🟡 DRAFT — IN PROGRESS. Scaffolding committed; live EODHD verification **blocked** pending
API-key availability in this environment (see §0). No assumption verdict is final until the fixtures exist.

**Session type:** Read-only data discovery + fixture capture. No pipeline code. Hard STOP for founder review at the end.

---

## Executive verdict table (A1–A7)

> _The founder is non-technical (BUILD_RULES §8): read this table first. PASS = assumption holds on
> live fixtures; FAIL = it does not; PARTIAL = holds with a caveat. All rows are_ **PENDING** _until the
> live fetch runs — the key is not yet reachable in this container (§0)._

| # | Assumption | Verdict | One-line evidence |
|---|---|---|---|
| A1 | 5-min depth ≥ 36 months per symbol (incl. ETFs) | ⏳ PENDING | — |
| A2 | Daily warmup ≥ 550 sessions before study start | ⏳ PENDING | — |
| A3 | One adjustment basis across daily + 5m; cross-grain invariant (0.1%) | ⏳ PENDING | — |
| A4 | Intraday timestamp semantics (open/close, TZ, session bounds, pre/post) | ⏳ PENDING | — |
| A5 | Synthetic close-print bars + volume quirks; deterministic strip rule | ⏳ PENDING | — |
| A6 | Earnings-calendar coverage + fields (founder cross-checks dates) | ⏳ PENDING | — |
| A7 | API mechanics + revised full-refresh call budget | ⏳ PENDING | — |

**Range recommendation:** ⏳ PENDING — does the 36-month window survive, or what is the verified floor?

---

## 0. Repo / branch confirmation, spec files read, and the key blocker

- **Repository:** `fashraf94/TradeSeven` (`git remote -v`). _Note: the Session-1 prompt §0 anticipated a
  standalone LevelStory research repo; the founder ruled to proceed inside TradeSeven, with all new writes
  confined to `fixtures/`, `discovery/`, and `docs/discovery/`, and zero contact with product code._
- **Branch:** `claude/level-study-session1-data-discovery-sedaip`
- **HEAD at session start:** `caf74a66fdc50ea34bc3eda7cbc1ae2f72c059cb` — clean working tree.
- **Spec files found and read in full (VERIFIED this session):**
  - `docs/LEVEL_INTERACTION_EVENT_STUDY_SPEC_V1_1.md`
  - `docs/LEVEL_STUDY_SPEC_V1_1_ADDENDUM_A_CONTEXT_LAYER_V1_1.md` (Addendum A **v1.1**)
- **Addendum v1.0 cleanup check:** no stale v1.0 copy of the addendum exists in the repo — only v1.1 is present.
  Nothing to flag for cleanup.
- **🔴 Blocker — EODHD key not reachable:** `EODHD_API_KEY` is **not set** in this container's environment,
  no alternately-named market-data key exists (scanned), and no `.env` file is present. `.env` is already
  gitignored, so it is a safe drop point. Live verification of A1–A7 cannot begin until the key is provided.

---

## 1. Method note

Fixture-first: no assumption is marked PASS/FAIL/PARTIAL from vendor documentation — only from the raw
response captured under `fixtures/`. Where the API's behavior differs from its docs, that difference is
itself a finding ("plan-said ≠ code-did applies to vendors too").

Probe set (Session-1 spec §4), 12-symbol stratified probe + context symbols:

- Mega-cap tech: **AAPL, NVDA, MSFT**
- Low-volatility: **KO, PG, JNJ**
- High-beta: **TSLA, AMD, COIN**
- Gap-prone: ⏳ _pending founder naming (3 names from his trading universe — do not guess)_
- Context: **SPY, XLK, XLE, SPHB, SPLV**

---

## 2. A1 — 5-minute depth
> _Pending live fetch._

## 3. A2 — Daily warmup depth
> _Pending live fetch._

## 4. A3 — Adjustment basis + cross-grain invariant
> _Pending live fetch._

## 5. A4 — Timestamp semantics (most important finding of the session)
> _Pending live fetch._

## 6. A5 — Synthetic bars & volume quirks
> _Pending live fetch._

## 7. A6 — Earnings calendar (+ date table for founder cross-check)
> _Pending live fetch._

## 8. A7 — API mechanics & budget
> _Pending live fetch._

---

## 9. Range recommendation
> _Pending — depends on A1/A2 verified depth. If the floor is below 36 months, this section restates the
> parent §13 sample-budget arithmetic at the verified floor and flags any endangered pre-registered question._

## 10. Surprises not covered by A1–A7
> _Pending._

## 11. Open questions for the founder
> _Pending._
