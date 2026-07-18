# Entry-Flow Consolidation — Vercel Preview Smoke Checklist

**Scope:** the League **entry experience** (Entry-Flow Consolidation P1–P4) —
one entry story. The slot picker IS the no-game League center (desktop + mobile),
the Auto-draft fallback lane sits below the slots, "Open my game" appears only
for a player who actually has a game, the "Enter tournament → Pick your mode"
stub is retired, and the mirror guard blocks a same-battle-week regular entry
while holding a slot seat. Founder-run on a **Vercel preview** deployment.
Ships direct (no new flag — founder ruling): this checklist is the gate;
`git revert` is the rollback.

> The automated battery proves the same behavior against the real modules:
> `src/components/League/LeagueLobbyDesktop.smoke.test.jsx` (no-game center =
> picker + Auto-draft + footnote; no "Enter tournament", no "Pick your mode"),
> `src/components/League/LeagueLobbyHonest.smoke.test.jsx` (honest display +
> picker center under the real adapter), `src/components/League/liveDraft/`
> `liveDraft.smoke.test.jsx` (picker / glimpse / awaiting / AutoDraftFallback —
> never says "training" / SlotCenter), and
> `api/_utils/tournamentLobbyService.test.js` (the mirror guard, five cases).
> This checklist confirms them against a live preview deploy + the real UI.

## 0. Preconditions

- **Flags.** No new flag was added. The build rides the already-true constants
  (`LEAGUE_REDESIGN_ENABLED`, `LEAGUE_NEXT_ARC_ENABLED`, `LEAGUE_LIVE_DRAFT`,
  `LEAGUE_LOBBY_ENABLED` — `src/config/featureFlags.js`). A preview build needs
  no flag work.
- **Accounts.** One signed-in account with **no active competitive group** (and
  no slot seat), plus a second account for the rival-seat check. The training
  pod state is independent — a player with only a training pod counts as
  "no game" for the ranked entry (training never gates the ranked bar).
- **Endpoints in play.** `GET /api/tournament/slot-schedule`, `POST slot-claim`
  / `slot-release` (Bearer ID token), `POST /api/tournament/lobby-quickplay`
  (the Auto-draft lane). All pre-existing; nothing new server-side except the
  guard inside lobby formation.

## 1. The no-game landing — one entry story

Sign in with the no-game account and open the League tab (test desktop ≥1180px
AND a mobile-width viewport — the two lobbies are separate components):

- [ ] The **slot picker is the center**: "Pick a draft slot" with the week's
      slots, ET labels, and live human counts — on desktop it fills the center
      column; on mobile it sits where the bracket hero was.
- [ ] The **Auto-draft lane sits below the slots**: "Can't make a slot?
      Auto-draft — we draft your board Monday." The word **"training" appears
      nowhere** on this surface.
- [ ] The bracket line is a **footnote** under the Auto-draft lane ("The monthly
      bracket opens when the season locks") — one quiet line, not a hero panel.
- [ ] **No "Open my game" bar** anywhere (you have no game to open).
- [ ] **No "Enter tournament" button and no "Pick your mode" modal** anywhere —
      including the top bar on desktop. The Training tab is unchanged and still
      says training (purple, "Solo · Training").

## 2. The claim payoff — arrival, not receipt

From the center picker, click **Claim seat** on a slot:

- [ ] You land **directly in the seated surface** (the full-screen participant
      push): **"Your slot is set"** with the live **"Draft in …" countdown as
      the hero element** (large teal type, ticking), your seat marked **You**,
      the open seats reading **"Open · fills with CPU at draft"**, and a
      **"Leave this slot"** button. You are NOT returned to a quiet lobby page.
- [ ] Press the back affordance ("← League"). The lobby now shows the
      **"Open my game"** bar (the loop closing) — and the center shows the
      in-a-game view (the forthcoming-bracket panel / funnel), NOT the picker.
- [ ] Tap **"Open my game"** → you're back in the seated glimpse with the
      countdown running.
- [ ] From the second account, claim the **same** slot → its seat appears by
      name in the first account's glimpse; the picker (second account) then
      shows the higher human count.
- [ ] **Leave this slot** → you return to the no-game world: the center picker
      is back and "Open my game" disappears.

## 3. The Auto-draft lane — a real group, not a stub

With the no-game account, click **Auto-draft**:

- [ ] A **real** group forms (`POST lobby-quickplay` → a `tournamentGroups` doc:
      `status: FORMING`, you + three CPUs, **no `isTraining` field**) and you
      land in the participant flow (board-commit surface, "your group locks
      Monday" framing) — not a fake "Seat reserved" confirmation.
- [ ] Back on the League tab, **"Open my game"** now shows (the same loop as a
      slot claim).

## 4. The mirror guard — one competitive game per battle week

- [ ] Holding a **slot seat** (claim one for the upcoming week), hit the
      Auto-draft lane (or any lobby path: create/join/matchmake with a 4th-seat
      form) for a group that would play the **same battle week** → the entry is
      **rejected 409 `already_in_competitive`** with the copy "You already have
      a competitive game for that battle week — finish it first, or leave your
      draft slot." No group doc is created.
- [ ] **Wed/Sat/Sun nuance (the load-bearing key):** claim a **Sunday** slot
      (whose battle is NEXT Monday) mid-week, then attempt Auto-draft the same
      day — still **blocked** (the guard keys on the battle week, not the
      formation week).
- [ ] Release the slot seat → the same Auto-draft attempt now **succeeds**.
- [ ] A **training pod** never blocks: with only a training pod active, the
      Auto-draft lane and slot claims both work.

## 5. Spectate — the CTA points at the entry

Open any pod's spectate view (from the field/leaderboard surfaces):

- [ ] The card reads "This is what you'd play." with a **"Claim your seat"**
      button (no "Enter tournament").
- [ ] Clicking it closes Spectate onto the League center — the slot picker for
      a no-game viewer.

## 6. Control — the training surface is untouched

- [ ] The Training tab (mobile) / Training Pod tab (desktop) renders exactly as
      before: the purple "Solo · Training" cold-start (or the re-entry bar /
      climb with an active pod), `quickPlayTraining` still forms a training pod,
      and the training draft room still says "Training Draft · PRACTICE · NO
      STAKES".

## Exit

All boxes checked on preview ⇒ founder sign-off ⇒ the PR opens (the founder
merges manually; pushed ≠ deployed). Rollback is `git revert` of the P1–P4
commits — there is no flag to flip.
