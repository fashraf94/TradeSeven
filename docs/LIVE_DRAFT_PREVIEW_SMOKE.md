# Competitive Live Draft (slot lobbies) — Vercel Preview Smoke Checklist

**Scope:** the League **Competitive Live Draft** feature (Phases 1–4) — the
weekly slot picker, the interactive live draft (one room, both modes), the
server-side autopick driver, and the AWAITING_OPEN → BATTLE handoff.
Founder-run on a **Vercel preview** deployment. Proves the lifecycle end-to-end
against a live preview before any prod flag flip. Crons do **not** run on
preview, so the fire/drive tick is driven manually through the cron endpoint
below.

> The automated battery proves the same invariants against the real modules with
> simulated time: `api/_utils/liveDraftFormation.test.js` (derivations, DST,
> transactional claim/release), `api/_utils/liveDraftLifecycle.test.js` (fire →
> CPU-fill → DRAFTING, one-pass autopick completion, stale-anchor re-derivation,
> human pick), `api/tournament/slot-endpoints.test.js` (method/flag/auth/error
> map), and the client render smoke
> (`src/components/League/liveDraft/liveDraft.smoke.test.jsx`,
> `src/components/League/draft/DraftBoardRoom.smoke.test.jsx`). This checklist
> confirms them against a live preview deploy + the real UI.

## 0. Preconditions

- **Flag ON in preview only.** `LEAGUE_LIVE_DRAFT` is a code constant
  (`src/config/featureFlags.js`), default `false`. Deploy a **preview** build
  with it set `true`. Do **not** flip it in prod here — that is a separate
  post-merge action. The picker, the `slot-*`/`live-draft-pick` endpoints, and
  the fire cron all read this same const, so surface and server light up
  together; off, all inert (byte-identical bar).
- **User auth.** The `slot-*` and `live-draft-pick` endpoints take a **Bearer
  ID token** (the signed-in user's, the place-claim pattern) — not an admin
  secret. Drive them from the UI, or with an ID token in the
  `Authorization: Bearer <token>` header.
- **Cron auth (manual fire).** `api/cron/live-draft-fire.js` is the
  `*/10 * * * *` fire/drive cron. On preview it never runs itself; trigger the
  handler by hand with either `x-vercel-cron: 1` **or**
  `Authorization: Bearer <CRON_SECRET>`.
- **The slots.** Wed 7:00pm / Sat 12:00pm / Sun 7:00pm / Mon 8:45am ET
  (`src/config/liveDraftSlots.js`, founder-editable). A claim creates the
  occurrence's FORMING group lazily and stamps `scheduledDraftAt` (that slot's
  next fire instant, DST-safe) + `battleStartWeek` (the next Monday-open anchor).
- **On-demand fire (no waiting for slot time).** `findDueSlotGroups` fires a
  group only once `scheduledDraftAt <= now`. To fire on demand rather than
  waiting for the real slot instant, edit the claimed group doc's
  `scheduledDraftAt` to a **past** ISO instant in the Firestore console, then
  trigger the fire cron (this is the live-draft equivalent of the canonical-open
  `simulatedNow`; no per-group admin fire endpoint exists — the cron is the only
  writer).

## 1. Claim a slot — the picker + live human count

1. Sign in as a player with **no active group**. The League view's no-group
   "Enter tournament" surface now shows **"Pick a draft slot"** (the
   `LiveDraftPicker`, flag-gated) above the existing lobby.
   - [ ] The week's four slots render with their ET labels and a per-slot count
         (**"No one yet — be the first"** or **"N humans waiting"**);
         `GET /api/tournament/slot-schedule` returns `{ slots: [...] }`.
2. Click **Claim seat** on one slot.
   - [ ] The seat is taken (`POST /api/tournament/slot-claim { slotId }` → the
         group doc appears: `isLiveDraft: true`, `status: FORMING`,
         `scheduledDraftAt` set, `battleStartWeek: { mondayEtDate, anchorEtDate,
         anchorIso }`, your uid in `groupMembers`, `players.length` = humans so
         far).
   - [ ] The League view flips to **"Your slot is set"** (`LiveDraftGlimpse`):
         your seat reads **You** (gold), any rivals by name, the remaining seats
         **"Open · fills with CPU at draft"**, a live **"Draft in …"** countdown,
         and a **"Leave this slot"** button.
3. Claim the **same** slot from a second signed-in account.
   - [ ] The count rises; both humans appear as seats; the schedule feed shows
         the higher `humanCount`. (Up to four humans; a fifth `slot-claim`
         returns **409 `slot_full`**.)
4. Press **Leave this slot** on one account
   (`POST /api/tournament/slot-release { groupId }`).
   - [ ] That seat frees and the view returns to the picker. When the **last**
         human leaves, the FORMING group doc is deleted (no empty ghost pods).

## 2. Fire the slot → CPU-fill → DRAFTING

Leave at least one human seated. Fire the slot (either at the real slot instant,
or via the backdated-`scheduledDraftAt` path from §0):

```
POST /api/cron/live-draft-fire
  Authorization: Bearer <CRON_SECRET>      # or header  x-vercel-cron: 1
```

- [ ] The response summarizes the pass:
      `{ ok: true, checkedForming: ≥1, fired: 1, checkedDrafting, autopicked,
      completed, … }`.
- [ ] The group doc is now `status: DRAFTING`: the empty seats are filled with
      CPU agents (four seats total), the snake order + per-turn deadline are
      initialized, and the draft-state doc exists.
- [ ] **A slot with at least one human always drafts** — an all-but-one-CPU pod
      still fires and plays.

## 3. The live room — ranked route, human pick + autopick

As a seated human, open the League view. The DRAFTING slot pod routes to the
**genericized `DraftBoardRoom` in `mode="competitive"`** (the same room the
training draft uses — one room, both modes):

- [ ] The room title reads **"Live Draft"** (not "Training Draft"); there is
      **no** "PRACTICE · NO STAKES" badge and **no** "practice — no stakes /
      three CPU agents" copy anywhere on the ranked surface (the D3 label sweep).
      A human rival's seat shows their **name** (not "CPU").
- [ ] On your turn, pick a name → `POST /api/tournament/live-draft-pick
      { groupId, symbol }` is accepted; the pick lands and the clock advances to
      the next seat (a fresh per-turn clock).
- [ ] Let a turn's clock expire (or send `{ groupId, autopick: true }`) → the
      pick autopicks from the top of the board.
- [ ] **Abandon the draft** (stop picking) and re-trigger the fire cron from
      §2. In a **single** drive pass the driver autopicks **every** overdue turn
      to completion (the S3 one-pass guarantee): the response shows
      `autopicked: N, completed: 1` and the pod leaves DRAFTING.

## 4. Completion → AWAITING_OPEN holding (the right Monday)

Once every pick is in, the pod completes. Because it sits **in front of** the
`status === 'battle'` firewall, it does not enter scoring/banking yet:

- [ ] The group doc reads `status: AWAITING_OPEN` (not BATTLE), with the drafted
      lineups on `players[].picks` and `battleStartWeek` intact.
- [ ] The League view shows **"Your pod is set"** (`LiveDraftAwaiting`): the
      lineup chips and **"Trading starts <Monday, Mon DD> at the 9:30 open —
      nothing to do until then"**, where the date is the pod's
      `battleStartWeek.anchorEtDate` rendered as a weekday.
- [ ] **Stale-anchor re-derivation (Addition 2).** If the pod is fired/completed
      in a week **later** than the one its `battleStartWeek` was stamped in (a
      slot claimed, then fired days late), the anchor is **re-derived** to the
      correct next Monday-open at fire/completion — the holding card names the
      right Monday, never a past one. (To exercise: backdate both
      `scheduledDraftAt` **and** the stamped `battleStartWeek.anchorEtDate` to a
      prior week, then fire — the completed pod's anchor advances.)

## 5. Monday flip → BATTLE

The AWAITING_OPEN → BATTLE flip is the **existing** Monday-open pipeline (the
orchestrator / bank-flip triggers), not new code — the pod joins the ranked
population at its `battleStartWeek` Monday open:

- [ ] Drive the existing Monday-open flip (the same trigger a normal ranked pod
      uses) with the pod's anchor Monday. The pod becomes `status: BATTLE`.
- [ ] The League view now renders the **existing** battle arena (untouched) —
      the live-draft chrome is gone; from here the pod scores, banks, and
      advances exactly like any ranked pod.
- [ ] **Monday 8:45am slot margin.** For the `mon-0845` slot, confirm a fully
      abandoned draft still completes (one drive pass) **before** the 9:30 open —
      slot time + max draft duration + one fire-cron cadence < 9:30 by
      construction.

## 6. Control — the training pod is byte-identical

In the same preview, run a **training** draft (the practice pod) through the
same room:

- [ ] The training draft opens `DraftBoardRoom` in its default `mode="training"`:
      the title reads **"Training Draft"**, the **"PRACTICE · NO STAKES"** badge
      shows, and the forming copy reads **"practice — no stakes … three CPU
      agents"** — unchanged from today. The room genericization did **not** alter
      the training surface.

## 7. Control — flag OFF renders as today

Redeploy (or view a build) with `LEAGUE_LIVE_DRAFT` **false**:

- [ ] The no-group surface shows the existing lobby only — **no** slot picker.
- [ ] `GET /api/tournament/slot-schedule`, `slot-claim`, `slot-release`,
      `live-draft-pick`, and the fire cron all return **dark** (the endpoints
      **404 `live_draft_disabled`**; the cron **200 `skipped: flag_off`**,
      touching no group).
- [ ] A regular ranked pod is **never** `isLiveDraft`, so the participant-view
      routing block is inert: the DRAFTING/FORMING/AWAITING_OPEN branches are
      never entered and the view renders byte-identically to today.

## Exit

All boxes checked on preview ⇒ ready for review reconciliation and the PR
(merge-dark, flag `false`). The prod flag walk (OFF in prod → verify
byte-identical → flip ON → observe the first real slot fire) follows on
sign-off — a separate action, not part of this checklist.
