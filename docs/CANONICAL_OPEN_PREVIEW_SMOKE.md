# Canonical-Open — Vercel Preview Smoke Checklist

**Scope:** the League user-layer *canonical-open capture* feature (Phases 1–6).
Founder-run on a **Vercel preview** deployment. Proves the lifecycle end-to-end
against a live preview before the prod flag flip. Crons do **not** run on
preview, so every tick is driven manually through the admin-gated endpoints
below.

> The automated capstone (`api/_utils/canonicalOpenLifecycle.e2e.test.js`) proves
> the same invariants against the real modules with simulated time. This
> checklist confirms them against a live preview deploy + the real UI.

## 0. Preconditions

- **Admin secret.** Every trigger below is admin-gated. Send the secret in the
  `X-Admin-Secret` header (value = the preview env's `ADMIN_SECRET`).
- **Flag ON in preview only.** `LEAGUE_CANONICAL_OPEN_CAPTURE` is a code constant
  (`src/config/featureFlags.js`), default `false`. Deploy a **preview** build
  with it set `true`. Do **not** flip it in prod here — that is a separate
  post-merge action.
- **The stamp resolves at round creation.** A round is canonical only if
  `baselinePolicy === 'canonical_open'` was stamped when the doc was created
  (`tournamentLobbyService.js:316` formation / `tournamentAdvancement.js:763`
  advancement). **Flipping the flag does NOT convert existing rounds** — you must
  create a **fresh** round with the flag already on.
  - ⚠️ The dev seeder `POST /api/admin/seed-tournament-group` goes through
    `createGroup`, which stamps **only if the caller passes `baselinePolicy`** —
    it does not read the flag. So either (a) drive a fresh round through the real
    **lobby formation** flow (which stamps from the flag), or (b) if seeding,
    confirm the seeded doc shows `baselinePolicy: 'canonical_open'` before
    proceeding — if it's absent, you have a **legacy** round (good for the
    control case in step 7, not the canonical walk).

## 1. Create a fresh canonical round

1. With the flag ON, form a fresh round through the normal lobby/formation path
   so it stamps `baselinePolicy: 'canonical_open'`.
2. Resolve the user drafts so each player holds three picks. Confirm in the group
   doc: each `players[].picks[].legs[0]` has `baselinePrice: null`,
   `captureState: null` (or `PENDING_OPEN` after the first sweep arm),
   `baselineSource: 'draft_resolution'`, and the round doc carries
   `baselinePolicy: 'canonical_open'` and `canonicalOpens: {}`.

## 2. Pre-open — cards read `pending`

Before 9:30 AM ET (or simply before any sweep has run):

- [ ] Each user card on the arena "Your three" reads **"settles at the open"**
      with an **em-dash** (no `+0.0×`), a subtle pulse, and an inactive meter.
- [ ] The **"N pick(s) pending"** marker shows on the "Your three" header
      (desktop `DockYourThree`, mobile `MYourPanel`).
- [ ] No crashes; the agent six render normally alongside.

## 3. Post-open sweep — cards flip to `estimated`

The sweep is hosted on `api/cron/agent-evaluate.js` and captures the **real**
session open (its clock is the real market session, by design — not simulated).
On preview, trigger it manually **during real US market hours**:

- Trigger the agent-evaluate handler (cron/admin-gated). Its response includes a
  `canonicalOpenSweep` summary: expect `{ captured: N, pending: M, snapshots: N }`.
- [ ] The round doc now has `canonicalOpens.{SYM} = { open, capturedAt, … }` for
      each captured symbol, and the captured legs show `baselinePrice = open`,
      `baselineSource: 'canonical_open_capture'`, `captureState: 'CAPTURED'`.
- [ ] Those cards flip to **estimated**: the live multiplier with a **dashed
      underline + "est" tag** and the caption **"estimate until banked."** The
      meter animates live.
- [ ] Re-trigger the sweep → it is idempotent: `captured: 0, snapshots: 0`, and
      the snapshot `open` is unchanged (immutable).

## 4. Bank the day — cards read `official`, standings from banked values

```
POST /api/tournament/bank-daily-scores
  X-Admin-Secret: <secret>
  { "groupId": "<id>", "simulatedNow": "<ISO instant after today's close>" }
```

- [ ] Response banks the day; the group's `dailyScores.day{N}` appears with
      `closeScores` and per-player `compositePoints`.
- [ ] After banking, once today's ET date is banked, the captured cards read
      **official**: **solid** multiplier + a **"banked"** check + **"official ·
      counts in standings."** (Per the shipped Flag-1 decision, the card shows the
      live/frozen multiplier styled as official; the authoritative banked figure
      lives in the standings.)
- [ ] **`banked == captured`:** the banked leg's `baselinePrice` equals the frozen
      `canonicalOpens.{SYM}.open` — even though live quotes moved since capture.
- [ ] **Standings** update from the **banked** composite, not the live estimate:
      the leaderboard / climb reflect `closeScores`, and the live "estimate"
      number is **not** shown as a ranked standing.
- [ ] Re-POST the same `simulatedNow` → the per-ET-day **idempotency skip**
      (`already_recorded`); no double-bank.

## 5. Void path — a deliberately un-capturable symbol

Set up a pick on a symbol the vendor never returns an eligible open for (e.g. an
invalid / non-trading ticker), so every sweep arm sees no open:

- [ ] Through the session that leg stays **pending** (`captureState:
      'PENDING_OPEN'`, with a matching `canonicalCaptureLog` audit entry —
      fail-closed is never fail-invisible).
- [ ] At banking it becomes **void** (`captureState: 'NO_ELIGIBLE_OPEN'`,
      `baselinePrice` stays null).
- [ ] The card reads **void**: a **grey em-dash** (never coral) + **"no open ·
      didn't count · no penalty."**
- [ ] It contributes **nothing** and the composite is **`agent + 1.5 ×
      sum-of-settled`** with **no re-weight** — the void slot costs only its own
      upside; the other picks' contributions are unchanged.
- [ ] No group block: the round banks and advances normally with the void present.

## 6. Claims — close-only in-hours

- [ ] **In-hours** (during market hours), the arena claim control is disabled and
      reads **"CLAIMS OPEN AFTER CLOSE"** (not a bare "WIRE CLOSED") for the
      canonical round.
- [ ] A direct in-hours `POST /api/tournament/place-claim` on the canonical round
      is rejected **403 `claims_closed_during_market_hours`** and writes no leg.
      (Because the ET claim window is already shut during market hours, use
      `devBypassWindow: true` + `X-Admin-Secret` to reach the exposure guard —
      it must still reject.)
- [ ] **After the close** (claim window open, market closed), the claim control
      works and a claim is accepted normally.

## 7. Control case — a legacy round renders as today

In the same preview, view a **legacy** round (one whose `baselinePolicy` is
absent — created with the flag off, or the seeded control from step 0):

- [ ] User cards render **byte-identically to today** — no pending/estimated/
      official/void chrome, no "N pending" marker, the claim UI unchanged.
- [ ] This confirms the new states are strictly opt-in per the round's stamp
      (anti-cohort-mixing): the two policies coexist without interfering.

## Exit

All boxes checked on preview ⇒ ready for review reconciliation and the PR
(merge-dark, flag `false`). The prod flag walk (OFF in prod → verify
byte-identical → flip ON → observe the first real canonical round) follows on
sign-off — a separate action, not part of this checklist.
