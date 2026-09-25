# Backing — the founder smoke (runbook)

**What this is.** A walk through Backing on a **preview** of the site, on a **test pod that only you can see**: attest → back a team → close → settle → results, and a second walk that ends in a refund. Nothing lights up for anyone else, and nothing touches production records. The two code switches (`BACKING_BETA_ENABLED`, `ELIGIBILITY_ATTESTATION_ENABLED`) stay **off** — this smoke works through a separate, preview-only override that you turn on for your own account and off again at the end.

**What you need before you start.**

- Your **user id** (uid). Open the Firebase Console → **Authentication** → **Users**, find your email, and copy the value in the **User UID** column (a 28-character string). Keep it in a note; you will paste it twice.
- The repository folder on your computer, with the `.env.local` file you already use for `node scripts/n1-stranded-precheck.js` (the three `FIREBASE_…` lines). Every command below is typed in a terminal opened in that folder.
- The **preview link** for this branch (`backing/activation-smoke`): Vercel → the project → **Deployments** → the deployment for that branch → **Visit**. It ends in `.vercel.app`.

The script prints what happened after every step and tells you what to do next. If it refuses to do something, it says why and writes nothing.

---

## 1. Turn the override on — for the Preview environment only

1. Vercel → the project → **Settings** → **Environment Variables**.
2. Add a variable: **Key** `BACKING_SMOKE_ENABLED`, **Value** `true`. Under **Environments**, tick **Preview only** — untick Production and Development. Save.
3. Add a second variable: **Key** `BACKING_SMOKE_UIDS`, **Value** your uid (paste it exactly, nothing else). **Preview only** again. Save.
4. Redeploy the preview so it picks the variables up: **Deployments** → the branch's latest deployment → the **⋯** menu → **Redeploy** → confirm. Wait until it says **Ready**.

*What you should see:* two new rows in the variables list, each showing **Preview** as its only environment. If a row shows **Production**, edit it and untick Production — the code ignores the override in production anyway, but the variables should not be there.

## 2. Seed the test pod

In the terminal, in the repository folder:

```
node scripts/backing-smoke.js seed
```

*What you should see:* a block headed **SEED** that names the pod (`tournamentGroups/smk_…`), its pool (`backingPools/dev-smk_…`), the two test seats (**Smoke Rival A**, **Smoke Rival B**) and two CPUs, two test backers who have already backed one team each, and a **NEXT** list. The pod is stamped for the **upcoming** battle week — the week the preview's pod list shows.

*If it refuses:* it says `REFUSED (nothing written)` and the reason. The usual one is `window_too_short`: the backing window closes Sunday 11:59 PM ET and a pool needs a full day, so **run this on a Monday (after 9:30 AM ET) through Saturday** and try again.

Add `--dry-run` to any command to see what it would do without doing it.

## 3. Open the preview and find the pod

1. Open the preview link and sign in with your normal account (the one whose uid you pasted).
2. Go to the **League** tab.

*What you should see:* a strip that reads **"Backing open · 1 pod"** with a close time, and pod rows whose footer reads **"Tap a seat · Predictions"** (instead of "Tap a seat to spectate"). Tap the strip: the Backing screen opens with **one pod** listed — Smoke Rival A, Smoke Rival B, CPU 98, CPU 99. The row shows **"Pool needs support · Backers 2 of 3"** and the two filled chairs of three, with the **SEALED** lockup and no pot figure.

*If you don't:* see **"If something doesn't look right"** at the end.

## 4. Attest

1. Tap a seat (Smoke Rival A, say) to open its team card, then **Back this team**.
2. The attestation step appears: tick **18 or older** and **the beta terms**, then **Continue**.

*What you should see:* the step closes and the stake control appears (100 / 250 / 500 presets, "1,000 BP" allowance, the three disclosure lines). The attestation is written once, as your real consent record; you will not be asked again on the refund walk.

## 5. Back a team, then top it up

1. Choose **100** and **Confirm**.
2. *What you should see:* **"Backed"** with **100 BP** and the team's name. Go back to the list: the row now reads **"Pool qualified · Backers: threshold met · Team spread: threshold met · Your backing: 100 BP"**, all three chairs filled, still **SEALED** — no pot, no per-team figures.
3. Back **the same team** again: choose **150** and **Confirm**.
4. *What you should see:* the control says it **adds to your 100 BP** on that team; after Confirm, **Your backing: 250 BP**.

Optional check from the terminal:

```
node scripts/backing-smoke.js status --founder=<your uid>
```

*What you should see:* your stake (250 BP, `live`, marked "(you)"), the two test stakes, and each backer's **dev** wallet with **✓** after every ledger sum (the ledger entries add up to the balances).

## 6. Advance: close, play the week, settle

```
node scripts/backing-smoke.js advance
```

*What you should see:* `✓ pool closed`, `✓ week banked (day 5 of 5), pod complete`, `✓ settled: winners Smoke Rival A …, pays 1.5×` (the numbers depend on who backed what), then **PAYOUTS** — every stake with WON / LOST and the amount — and **WALLETS** with `ledger OK`. Smoke Rival A wins unless you add `--winner=<seat id>` (the seat ids are printed by `seed` and `status`).

*If it says the pool is not valid yet:* your own stake is missing — do step 5 first.

## 7. See the results and Your Backing

1. Refresh the preview and open the **League** tab.
2. *What you should see:* the strip now reads the between-weeks line (**"Last week's result …"**). Tap it: the **results card** shows the winner, **pays ×**, your stake and your payout, **"N of 3 backers picked them"** and **"…% of BP backed them"**. **Your Backing** shows the week's card for the pod. Open the pod's spectate view: its final state carries the same results card.
3. **My Backing stats** (the private record under the pitch) stays at zero: dev pools are excluded from the stats by design.

## 8. The refund walk

1. Clean up the first pod, then seed a fresh one:

   ```
   node scripts/backing-smoke.js cleanup
   node scripts/backing-smoke.js seed
   ```

2. On the preview: League → the strip → the new pod → back a team (no attestation step this time — it remembers you).
3. Refund it:

   ```
   node scripts/backing-smoke.js refund
   ```

   *What you should see:* `✓ pool closed`, `✓ pod voided`, `✓ refunded: 3 stakes voided (group_voided)`, then **REFUNDS** — every stake `VOIDED (group_voided)` — and **WALLETS** with `careerNet 0 BP` for everyone and `ledger OK`.

4. On the preview: **Your Backing** shows the pod as **cancelled**, with your stake returned; nothing you did counts against you.

## 9. Clean up

```
node scripts/backing-smoke.js cleanup
```

*What you should see:* the list of documents to delete — the pod, its pool, the stakes, the dev wallets (yours included), the smoke's telemetry — and `✓ deleted N document(s)`. Your attestation (`eligibility/<your uid>`) is never on the list: it is your real consent record and stays.

*If it says `REFUSED — nothing deleted`:* a document it found is outside the dev namespace or not this run's. Do not force it. Copy the printed lines into the PR thread.

## 10. Turn the override off

Vercel → **Settings** → **Environment Variables** → delete **`BACKING_SMOKE_ENABLED`** and **`BACKING_SMOKE_UIDS`**, then **Redeploy** the preview once more. From then on the preview is as dark as production.

---

## If something doesn't look right

| You see | Most likely reason | What to do |
| --- | --- | --- |
| No strip on the League tab; pod footers still say "Tap a seat to spectate" | The override is not reaching you: a variable is missing or not on **Preview**; the preview was not redeployed after adding them; the uid in `BACKING_SMOKE_UIDS` is not the account you signed in with; or you opened the production site instead of the preview link | Check both variables show **Preview**; redeploy; compare the uid with the Firebase Console; sign out and in; use the `.vercel.app` link |
| The strip is there but says there are no pods, or "Nothing to back yet" | The seed refused (see its message) or ran for a different week; or it is Monday before 9:30 AM ET, when the list still shows last week | `node scripts/backing-smoke.js status`; if there is no pod, seed again after 9:30 AM ET Monday |
| Confirm answers "eligibility required" | The attestation was not recorded, or the terms version changed | Tick both boxes and Continue again |
| Confirm answers that a completed battle is needed | Your account has never finished a battle (the beta's speed bump) | Play one battle to completion with this account, then back the team |
| `advance` says the pool is not valid yet | Your stake is not in | Do step 5, then run it again |
| `advance` says the settlement is HELD | The synthetic week did not bank as expected | `cleanup`, then `seed` again and repeat from step 3 |
| The results card does not appear after `advance` | The page still shows the old state | Refresh; open Backing from the strip; the results read on open |
| `cleanup` says REFUSED | A target is outside the dev namespace or not this run's — a guard, not a fault | Don't force it; paste the printed lines into the PR thread |
| Any command says CREDENTIALS NOT READY | `.env.local` is missing one of the three `FIREBASE_…` lines | Fix the file as the message says and run the same command again |

## What the smoke writes, and where

Everything a run writes lives in the **dev namespace**, and `cleanup` removes it:

- the pod `tournamentGroups/smk_…` (marked `isDev`, ignored by every production job);
- its pool `backingPools/dev-smk_…` and the sealed totals under it;
- the stakes on that pod (their ids are hashes; each names the dev pod) and their sealed meta;
- every backer's **dev** wallet `backingWallets/dev-<uid>` and its ledger — including yours;
- the smoke's telemetry, marked dev.

The **one** document outside that list is `eligibility/<your uid>` — your attestation, written when you tick the two boxes. It is your real consent record; the script never writes it and never deletes it.

## The commands

| Command | Does | Writes |
| --- | --- | --- |
| `seed` | Creates the dev pod for the upcoming week, opens its pool, places the two test backers' stakes through the real stake code | yes (dev namespace) |
| `advance` | Closes the pool, banks a test week, completes the pod, settles through the real settlement code, prints every payout | yes (dev namespace) |
| `refund` | Closes the pool, cancels the pod, refunds through the real refund code, prints every refund | yes (dev namespace) |
| `status` | Prints the pod, the pool, every stake, every dev wallet and whether its ledger adds up | no |
| `cleanup` | Deletes everything the runs created; refuses if anything is outside the dev namespace | deletes (dev namespace only) |

Every command takes `--pod=<pod id>` (default: the latest seeded pod) and `--dry-run` (show, don't do). `advance` takes `--winner=<seat id>`; `status` takes `--founder=<your uid>` to mark your own stake.
