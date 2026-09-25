# Backing — the founder smoke (runbook)

**What this is.** A walk through Backing on a **preview** of the site, on a **test pod that only you can see**: attest → back a team → close → settle → results, and a second walk that ends in a refund. Nothing lights up for anyone else, and nothing touches production records. The two code switches (`BACKING_BETA_ENABLED`, `ELIGIBILITY_ATTESTATION_ENABLED`) stay **off** — this smoke works through a separate, preview-only override that you turn on for your own account and off again at the end.

**What you need before you start.**

- Your **user id** (uid). Open the Firebase Console → **Authentication** → **Users**, find your email, and copy the value in the **User UID** column (a 28-character string). Keep it in a note; you will paste it a few times.
- The repository folder on your computer, with the `.env.local` file you already use for `node scripts/n1-stranded-precheck.js` (the three `FIREBASE_…` lines). Every command below is typed in a terminal opened in that folder.
- The **preview link** for this branch (`backing/activation-smoke`): Vercel → the project → **Deployments** → the deployment for that branch → **Visit**. It ends in `.vercel.app`.

**Two deadlines, both Sunday 11:59 PM ET of the week you seed in.**

1. **Back a team before then.** The test pool closes on its own at that instant; with only the two test backers in it, it closes as "did not qualify" and the walk has to start over.
2. **Run `cleanup` before then too.** The preview and the live site share one database. A test pod still in it at **Monday 00:00 ET** shows in every player's League tab as an upcoming pod (with generic names) until you run `cleanup`. Nothing else reacts to it — no job, no payout — but it is visible.

The whole walk, both endings included, takes well under an hour. Do it in one sitting on a **Monday (after 9:30 AM ET) through Saturday**.

The script prints what happened after every step and tells you what to do next. If it refuses to do something, it says why and writes nothing.

---

## 1. Turn the override on — for the Preview environment only

1. Vercel → the project → **Settings** → **Environment Variables**.
2. Add a variable: **Key** `BACKING_SMOKE_ENABLED`, **Value** `true`. Under **Environments**, tick **Preview only** — untick Production and Development. If the form offers a **Git branch** for the Preview scope, type `backing/activation-smoke` so the variable applies to this branch's previews alone. Save.
3. Add a second variable: **Key** `BACKING_SMOKE_UIDS`, **Value** your uid — paste it exactly, with **no spaces and no quotes** around it. **Preview only** (and the same branch) again. Save.
4. On the same page, make sure **Automatically expose System Environment Variables** is on (it usually is): the override reads Vercel's `VERCEL_ENV` to know it is on a preview, and stays dark everywhere if that is off.
5. Redeploy the preview so it picks the variables up: **Deployments** → the branch's latest deployment → the **⋯** menu → **Redeploy** → confirm. Wait until it says **Ready**.

*What you should see:* two new rows in the variables list, each showing **Preview** as its only environment. If a row shows **Production**, edit it and untick Production — the code ignores the override in production anyway, but the variables should not be there.

*Never use **Promote to Production** on this preview deployment.* Production only ever comes from a merge to `main`.

## 2. Seed the test pod

In the terminal, in the repository folder:

```
node scripts/backing-smoke.js seed --founder=<your uid>
```

(`--founder` records your uid on the test pod, so `status` and `cleanup` know your dev wallet even before you back a team. Type your uid in place of `<your uid>`.)

*What you should see:* a block headed **SEED** that names the pod (`tournamentGroups/smk_…`), its pool (`backingPools/dev-smk_…`), the two test seats (**Smoke Rival A**, **Smoke Rival B**) and two CPUs, two test backers who have already backed one team each, a **Deadline** line naming Sunday's close, and a **NEXT** list. The pod is stamped for the **upcoming** battle week — the week the preview's pod list shows.

*If it refuses:* it says `REFUSED (nothing written)` and the reason. The usual one is `window_too_short`: the backing window closes Sunday 11:59 PM ET and a pool needs a full day, so **run this on a Monday (after 9:30 AM ET) through Saturday** and try again.

Add `--dry-run` to any writing command to see what it would do without doing it. A dry run cannot write even by mistake: the database handle it holds throws on any write.

## 3. Open the preview and find the pod

1. Open the preview link and sign in with your normal account (the one whose uid you pasted).
2. Go to the **League** tab.

*What you should see:* a strip that reads **"Backing open · 1 pod"** with **"Closes Sun 11:59 PM ET"**, and pod rows whose footer reads **"Tap a seat · Predictions"** (instead of "Tap a seat to spectate"). Tap the strip: the Backing screen opens with **one pod** listed — **Smoke Rival A**, **Smoke Rival B**, **CPU — Contrarian**, **CPU — Diversifier**. The row reads **"Pool needs support"** and **"Backers 2 of 3 · Team spread: threshold met"**, with two of the three chairs filled, the **SEALED** lockup and no pot figure.

*If the strip says more than 1 pod:* an earlier test pod was not cleaned up. Run `node scripts/backing-smoke.js status` and `cleanup --pod=<that pod's id>` first.

*If you don't see the strip at all:* see **"If something doesn't look right"** at the end.

## 4. Attest

1. Tap a seat — **Smoke Rival A**, say. Its team card opens. Tap the button at the bottom: **"Back Smoke Rival A & Smoke Rival A’s agent"**.
2. The stake screen opens under the heading **"Back this team"**. The first time, the attestation step is shown instead of the amounts: two statements — **"I confirm that I am 18 years of age or older."** and **"I have read and accept the FantasyTrades Backing Beta terms."** Tick both, then **Continue**.

*What you should see:* the step closes and the stake control appears: the **100 / 250 / 500** presets, the points meter reading **1,000 BP** with **"of 1,000 BP · resets Monday"**, and the three disclosure lines. You will not be asked again on the refund walk.

*What you just recorded, plainly:* the attestation is written once, to your account, as your real consent record. The step says **"Draft terms · pending counsel review"** because the terms it shows are the **draft** ones (version `beta-2026-09-draft`). When counsel's final terms land, the site will ask you to accept those too, and your record keeps the draft acceptance in its history. That is by design — it is not a fault.

## 5. Back a team, then top it up

1. Choose **100**, then **"Confirm 100 BP"**.
2. *What you should see:* **"Backed · 100 BP on Smoke Rival A"**. Go back to the list: the row now reads **"Pool qualified"**, **"Backers: threshold met · Team spread: threshold met"** and **"Your backing: 100 BP"**; the chairs have given way to a check mark; still **SEALED** — no pot, no per-team figures. The points meter now reads **900 BP** (during the smoke it reads your **dev** wallet, the one the test stakes draw from).
3. Back **the same team** again: tap Smoke Rival A's seat, then its **"Back …"** button. The control says **"Adds to your 100 BP on Smoke Rival A."** — **150** is not a preset, so type **150** into **"Custom amount"**, then **"Confirm 150 BP"**.
4. *What you should see:* **"Your backing: 250 BP"** on the row, and the points meter at **750 BP**.

Optional check from the terminal:

```
node scripts/backing-smoke.js status --founder=<your uid>
```

*What you should see:* your stake (250 BP, `live`, marked "(you)"), the two test stakes, and each backer's **dev** wallet with **✓** after every ledger sum (the ledger entries add up to the balances). `status` can only read: its database handle throws on any write.

## 6. Advance: close, play the week, settle

```
node scripts/backing-smoke.js advance
```

*What you should see:* `✓ pool closed: closed (0 voided)`, `✓ week banked (day 5 of 5), pod complete — the composite names Smoke Rival A`, `✓ settled: winners Smoke Rival A, pot 600 BP, winning stakes 450 BP, pays 1.33×, burned 1 BP` (the numbers depend on who backed what), then **PAYOUTS** — every stake with `WON +… BP` or `LOST` — and **WALLETS** with `ledger OK`. Smoke Rival A wins unless you add `--winner=<seat id>` (the seat ids, the two CPUs included, are printed by `seed` and `status`).

*If it says the pool is not valid yet:* your own stake is missing — do step 5 first.

*If it says the pool is `insufficient`, so there is nothing to settle:* Sunday 11:59 PM ET passed before your stake was in and the pool closed on its own. Run `cleanup`, `seed` again, and back a team the same week.

## 7. See the results and Your Backing

1. Refresh the preview and open the **League** tab.
2. *What you should see:* the strip now reads the between-weeks line, **"Last week’s result …"**. Tap it: the **results card** shows the winner's block with **"Pot 600 BP · 3 backers"**, the winning team's **"paid ×1.33"**, and for the others **"×4.00 had they won"** or **"no backers"**; each backed team's line reads like **"2 backers · 75% of BP in this pool backed them"**. **Your Backing** tags the pod **"Settled"** and lists your stake as **"Smoke Rival A · 250 BP · settled"**. Tap **"Open the tape"** on either card: the pod's spectate view opens, and its final state carries the same results card (the two test seats read as generic players there — they have no profile).
3. Your private record: open the **Dashboard**, your agent's panel (on a desktop window the Backing screen's results section shows the same block). **"Your backing · beta stats"** stays at zero — dev pools are excluded from the stats by design. The one-line scouting pitch editor sits beside it and is live for you too. **Leave it alone during the smoke**: it is not part of the walk, and a saved line is a real record on your account (see "What the smoke writes").

## 8. The refund walk

1. Clean up the first pod, then seed a fresh one:

   ```
   node scripts/backing-smoke.js cleanup --founder=<your uid>
   node scripts/backing-smoke.js seed --founder=<your uid>
   ```

2. On the preview: League → the strip → the new pod → back a team (no attestation step this time — it remembers you).
3. Refund it:

   ```
   node scripts/backing-smoke.js refund
   ```

   *What you should see:* `✓ pool closed: closed`, `✓ pod voided`, `✓ refunded: 3 stakes voided (group_voided)`, then **REFUNDS** — every stake `VOIDED (group_voided)` — and **WALLETS** with `careerNet 0 BP` for everyone and `ledger OK`.

4. On the preview: **Your Backing** tags the pod **"Refunded · stakes void"**, explains **"This pod was voided during its week, so every stake was refunded."**, and lists your stake as **"… · 100 BP · void"**. Nothing you did counts against you.

## 9. Clean up

```
node scripts/backing-smoke.js cleanup --founder=<your uid>
```

*What you should see:* the list of documents to delete — the pod, its pool, the stakes, the dev wallets (yours included), the smoke's telemetry — and `✓ deleted N document(s)`. Your attestation (`eligibility/<your uid>`) is never on the list: it is your real consent record and stays.

*If a line starts with `· kept:`:* another test pod is still seeded and names the same wallet (yours), so this run leaves the wallet and the events that do not name this pod alone; the last pod's `cleanup` sweeps them. Clean that pod up too (`cleanup --pod=<its id>`, or plain `cleanup` for every pod in the list).

*If it says `REFUSED — nothing deleted`:* a document it found is outside the dev namespace or not this run's. Do not force it. Copy the printed lines into the PR thread.

Do this **before Sunday 11:59 PM ET** (see the two deadlines at the top).

## 10. Turn the override off

Vercel → **Settings** → **Environment Variables** → delete **`BACKING_SMOKE_ENABLED`** and **`BACKING_SMOKE_UIDS`**, then **Redeploy** the preview once more. From then on the preview is as dark as production.

---

## If something doesn't look right

| You see | Most likely reason | What to do |
| --- | --- | --- |
| No strip on the League tab; pod footers still say "Tap a seat to spectate" | The override is not reaching you: a variable is missing, not on **Preview**, or typed with spaces or quotes; the preview was not redeployed after adding them; the uid in `BACKING_SMOKE_UIDS` is not the account you signed in with; the project does not expose system variables (`VERCEL_ENV`) to its functions; or you opened the production site instead of the preview link | Check both variables show **Preview** and carry no spaces or quotes; check **Automatically expose System Environment Variables** is on; redeploy; compare the uid with the Firebase Console; sign out and in; use the `.vercel.app` link |
| The strip reads **"No pods to back yet — they show here as next week’s pods form."**, or the list **"No pods to back yet."** | The seed refused (see its message) or was cleaned up; or it is Monday before 9:30 AM ET, when last week's pod list is still the one shown | `node scripts/backing-smoke.js status`; if there is no pod, seed again (Monday after 9:30 AM ET through Saturday) |
| The strip says **2 pods** or more | An earlier test pod was not cleaned up | `status`, then `cleanup --pod=<that pod's id>` |
| Confirm answers **"Confirm your eligibility first."** | The attestation was not recorded, or the terms version changed | Tick both statements and Continue again |
| Confirm answers **"Complete one battle of your own before backing a team."** | Your account has never finished a battle (the beta's speed bump) | Play one battle to completion with this account, then back the team |
| Confirm answers **"This pool has closed."** | Sunday 11:59 PM ET has passed for this pod | `cleanup`, `seed` again, and back a team before Sunday |
| The points meter still reads **1,000 BP** after you backed a team | The page is showing the pod list it loaded before your stake | Refresh; the meter reads the dev wallet the list names |
| `advance` says the pool is not valid yet | Your stake is not in | Do step 5, then run it again |
| `advance` says the pool is `insufficient`, so there is nothing to settle | The pool closed on its own (Sunday 11:59 PM ET) before your stake was in | `cleanup`, `seed` again, back a team before Sunday, then `advance` |
| `advance` says the settlement is HELD | The synthetic week did not bank as expected | `cleanup`, then `seed` again and repeat from step 3 |
| The results card does not appear after `advance` | The page still shows the old state | Refresh; open Backing from the strip; the results read on open |
| `cleanup` says REFUSED | A target is outside the dev namespace or not this run's — a guard, not a fault | Don't force it; paste the printed lines into the PR thread |
| `cleanup --pod=…` says the pod is not in the manifest and not a live pod this script seeded | The id is wrong, or the pod is already gone | `status` lists what the manifest knows; a pod seeded from another computer is reachable by its id as long as it still exists |
| `advance` or `refund` fails with `wallet_missing` | A dev wallet the run's stakes draw on was deleted (an older version of the script cleaning up a different run) | `cleanup` this pod, `seed` again, back a team again |
| `advance` or `refund` says the pod is not `forming` | The pod already advanced or was refunded — each pod takes one ending | `cleanup`, then `seed` again |
| Any command says CREDENTIALS NOT READY | `.env.local` is missing one of the three `FIREBASE_…` lines | Fix the file as the message says and run the same command again |

## What the smoke writes, and where

Everything a run writes lives in the **dev namespace**, and `cleanup` removes it:

- the pod `tournamentGroups/smk_…` (marked `isDev`, ignored by every production job);
- its pool `backingPools/dev-smk_…` and the sealed totals under it;
- the stakes on that pod (their ids are hashes; each names the dev pod and its dev pool) and their sealed meta;
- every backer's **dev** wallet `backingWallets/dev-<uid>` and its ledger — including yours;
- the smoke's telemetry, marked dev.

Two documents can be written outside that list, both **yours** and both **real**; the script never writes them and never deletes them:

- `eligibility/<your uid>` — your attestation, written when you tick the two statements (to the draft terms, as step 4 explains). The walk always writes this one.
- `teamPitches/<your uid>` — **only if you save a scouting line** on the preview (the editor on your Dashboard is live for you during the smoke). The walk never asks you to. If you do save one, it is your real pitch and stays; save an empty line to clear it.

Nothing else: the production pod list, pools, wallets and events are never touched, and the two code switches stay off.

**While a test pod exists, do not press the dev-duty buttons** (the admin surface that drives the tournament pipeline over dev pods, `run-duty`). The scheduled jobs ignore the test pod; that surface would not. Run `cleanup` first.

## The commands

| Command | Does | Writes |
| --- | --- | --- |
| `seed` | Creates the dev pod for the upcoming week, opens its pool, places the two test backers' stakes through the real stake code | yes (dev namespace) |
| `advance` | Closes the pool, banks a test week, completes the pod, settles through the real settlement code, prints every payout | yes (dev namespace) |
| `refund` | Closes the pool, cancels the pod, refunds through the real refund code, prints every refund | yes (dev namespace) |
| `status` | Prints the pod, the pool, every stake, every dev wallet and whether its ledger adds up | no — its database handle throws on any write |
| `cleanup` | Deletes everything the runs created; refuses if anything is outside the dev namespace; keeps a wallet another seeded run still names | deletes (dev namespace only) |

**One test pod at a time.** Run `cleanup` before you `seed` again: every run draws on the same dev wallet of yours, and the script keeps the walk simple by assuming one live pod. (If two are ever live, `cleanup` keeps the shared wallet until the last one is cleaned, and says so.)

Every command **but `seed`** takes `--pod=<pod id>` (default: the latest seeded pod; a pod seeded from another computer works by id). Every writing command takes `--dry-run` (show, don't do — the handle throws on any write). `advance` takes `--winner=<seat id>`; `seed`, `status` and `cleanup` take `--founder=<your uid>` (`seed` records it on the pod; `status` marks your stake; `cleanup` sweeps your dev wallet and events even if you never backed a team in that run).
