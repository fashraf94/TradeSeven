# Seated Status Surface Enrichment — Founder Preview Smoke

**Scope:** the two seated waiting states reached via **"Open my game"** —
`LiveDraftGlimpse` (slot claimed → awaiting the draft, `FORMING`) and
`LiveDraftAwaiting` (drafted → awaiting Monday's open, `AWAITING_OPEN`) — enriched
to the Claude Design's obsidian/gold identity. Client-only; no new endpoint,
subscription, or fenced-file edit. `git revert` is the rollback.

> Automated cover: `src/components/League/liveDraft/liveDraft.smoke.test.jsx`
> renders both states with an injected `group` and asserts the honest copy
> (chrome, countdowns, the user's three real picks, the honest "Agent's six ·
> PENDING" line, the loadout with no chips, the honest no-agent empty-state).
> This checklist confirms the same against a live preview + real UI.

## 0. Preconditions
- Same as the Competitive Live Draft preview (`LEAGUE_LIVE_DRAFT` on in preview;
  `LIVE_DRAFT_PREVIEW_SMOKE.md` §0). Reach the states by claiming a slot, then
  tapping **"Open my game."**
- Have a **primary agent equipped** (name + archetype + a watchlist equipped in
  the Forge) so the loadout module shows real values. With no agent, the module
  must show the honest "No agent equipped yet" state (see §3).

## 1. State 1 — slot claimed (FORMING)
Claim a slot → **Open my game**. Confirm:
- [ ] **Chrome:** eyebrow **My game** + a gold slot chip (e.g. `SUN · 7:00PM`) +
  title **Weekly Pod** + the sub `Live-draft slot · draft runs <day>, <time> ET`.
- [ ] **Progression rail:** `Awaiting draft` (current, gold) → `Drafted` →
  `Trading`. The rail never links anywhere — progression only.
- [ ] **Countdown hero** (gold) counts down to **your slot** (`scheduledDraftAt`),
  not a universal Monday. Digits are days/hrs/min far out, min/sec near.
- [ ] **Pod:** four seat **rows** — **You**, other humans by name, and
  `Open · fills with CPU at draft` for the rest. The `n / 4` claimed count is real.
- [ ] **Loadout module:** agent **name + archetype + watchlist name**, an
  **Equipped** pill, and **Edit in Forge** → opens the Forge and returns here.
  Sub-label: *editable until the draft runs*. **No rule chips.**
- [ ] **Seat held** confirmation card, and a quiet **Leave this slot** at the
  bottom (leaves the slot).

## 2. State 2 — drafted (AWAITING_OPEN)
Fire the draft (manual cron, per `LIVE_DRAFT_PREVIEW_SMOKE.md`). The surface flips
to the drafted state. Confirm:
- [ ] **Chrome:** title **Weekly Pod**, sub `Drafted · trading opens <Monday>,
  9:30am ET`. Rail: `Awaiting draft` (done ✓) → `Drafted` (current) → `Trading`.
- [ ] **Countdown hero** counts down to **Monday's 9:30 open** (derived from
  `battleStartWeek.anchorIso`).
- [ ] **Your lineup:** **Your three** — your real drafted picks (`players[].picks`),
  marked LOCKED. **Agent's six** — an honest **PENDING** line
  (*"Your agent drafts its six around your three at Monday's open."*), **never a
  fabricated six**.
- [ ] **Pod:** the same four rows, now **resolved** — humans + the CPUs that
  filled (CPU chip + FILLED), `4 / 4 seats set`.
- [ ] **Loadout module:** same as State 1, sub-label *tunable until the open*.
  **No leave affordance** (committed state).

## 3. Honesty & no-regression checks
- [ ] **No bracket framing anywhere** — no "16 → 8 → 4", no seed, no advance line,
  no fill beyond 4. The only bracket mention is the quiet footnote *"Weekly pods
  will feed a monthly bracket — coming soon."*
- [ ] **No fabricated numbers** — every seat name, pick, count, and countdown is a
  real field or an honest empty state. No invented rule chips, no invented six.
- [ ] **No-agent path:** with no equipped agent, the loadout shows **"No agent
  equipped yet"** + Edit in Forge (never a blank or fake loadout).
- [ ] **League center + Training tab unchanged** — the redesigned lobby
  (`WhileYouWait`, the slot picker / SlotCenter) and the Training Pod tab render
  exactly as before; only the seated `FORMING`/`AWAITING_OPEN` surfaces changed.
- [ ] **Edits work while seated** — the Forge equip actions are permitted in both
  waiting states (they gate on `agent.activeBattleId`, null until BATTLE), so the
  "tunable until the open" copy is truthful.

## 4. Rollback
Client-only, ships direct (no new flag). If anything is wrong, `git revert` the
enrichment commit — the surfaces return to the prior plain glimpse/awaiting.
