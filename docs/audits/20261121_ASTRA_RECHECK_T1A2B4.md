# Astra focused recheck · Practice Field T1a-2b-4

21 November 2026 · PR #1098 · accounting correctness · founder-only switch

**NOT READY.** Three reachable histories meet stop (a). A sold idea posted **$99.97** without the required coverage ruling. A held idea paid **$236.93** from a refused announcement with zero founder decisions. A founder who selected a 5-for-4 split could receive the cash consequence of a 2-for-1 split instead, a **$74.98** difference. The five committed acceptance rows passed. The on-time and quarterly comparisons against `cf35151b` passed.

The fetched branch was `e2223443`. Fetched `origin/main` was still `cf35151b` and the mode in the candidate was `'off'`. I used §12.2’s A-1 through A-5 as written, with the founder’s Q-1 and Q-15 through Q-17 decisions in the brief. The only network step was `git fetch origin` against GitHub. The replays used local exports of the fetched objects, the repository’s in-memory Firestore, synthetic quotes and vendor responses, and its actual parser, daily builder, close and founder dispatcher. The three blocking histories start with normal admission and have no planted accounting or report state.

## Findings

### T2E-R01 · A sold holding misses a rejection committed after its book closes

**Stop (a), C04 / A-4.** Buy 99.970008 AAPL shares on Monday 16 November. A $94 Tuesday close queues the sale, which fills Wednesday. Thursday’s feed lists a $1 Wednesday dividend. Leave its proposal open. At Monday 23 November’s close, two daily builders have started. The winner lists the dividend. The loser also sees a malformed Wednesday split, `3:2`. Let the winner finish and the book close, then let the loser finish its report. The stored Monday report now contains the dated rejection and `observationsDisagree: true`.

Replaying Monday returned `already_closed`. An attempt to rule the rejection `coverage_gap / no_action` returned **404**. Approving the dividend returned **200**. On Tuesday, with the bad row still returned on requests covering Wednesday, the book posted **$99.97** at full quality. Book cash rose from **$89,394.36 to $89,494.33**. There was one dividend approval and zero coverage rulings. Releasing the same loser before the book closed gave a standing doubt, **409** on approval, and **$0** through Tuesday. The failure also reproduced when the loser had already fetched both HTTP bodies and the real parser had rejected the split *before* the winner closed. Only publication of its report was delayed.

A second arm retains C04’s earlier approval and Friday doubt. Monday’s winner closes with a clean backfill. Its loser then records a new `3:2` rejection for the same Wednesday. The founder’s subsequent `no_action` receipt covers only Friday’s `lastSeenOn`. Tuesday still pays $99.97 at full quality. I also reversed the request and the late observation. The founder ruled at 21:25:01 UTC while the Monday report was still clean, then the losing builder returned the new rejection at 21:26. Tuesday paid the same $99.97 without a ruling on that new observation. The report merge retains Monday’s evidence in both arms. The sold ledger reads only the report for the session being closed, and an already-closed session returns before that read. See `caParseReport.js:199`, `close.js:190`, `close.js:202`, `close.js:483`, `close.js:977` and `close.js:1065`.

**One change.** Have the sold-holding coverage check consume durable rejection observations by version, including additions to already-closed sessions, before a founder approval or cash posting can use that holding’s count. A coverage ruling acknowledges precisely the observations it saw. **Replay seed** `R01 sold-report-after-close` in the appendix. Moving the loser before the close is the passing order control.

### T2E-R02 · A held dividend uses an announcement from a day whose final report refuses it

**Stop (a), RF-1.** In the two-book RF-1 history, B sells AAPL on S2 and its sold doubt drives the shared backfill. A still holds AAPL. On S5, A sees a $1 dividend for S7. On S6 the winning builder lists $2.37. A competing builder lists the same $2.37 alongside an unreadable S7 split, `3:2`. B closes first, with a successful AAPL backfill through S6. Let A close before the losing report commits. By S7, S6’s stored report has one rejected row. A still treats $2.37 as the accepted announcement.

S7 pays **$236.93**, takes A’s cash from **$80,000 to $80,236.93**, and reads full quality. A’s founder-ruling list is empty. With the identical reports merged before A closes, S6 retains the $1 announcement. S7 records `conflicting_action`, pays **$0** and reads below full quality. The committed two-book RF-1 row and the independent variant with the malformed row in the winning daily also held. The appendix reproduces the late-merge failure with A alone.

The close calculates `dailyRefused` from the report it reads at that instant. The announcement stores the new payload, and the due close compares the vendor row with that stored payload. The later refusal of the source session never enters the comparison. See `close.js:461`, `close.js:1065`, `ledger.js:1131` and `ledger.js:1367`. The close cron can itself start the daily builder on a day whose earlier windows were missed, before acquiring the close snapshot (`api/cron/mandate-evaluate.js:878`).

**One change.** Validate the source report of an advance listing when the listing is used to authorize money or shares. If its source became refused, use the last covered listing for the comparison, retaining enough payload history to do so. **Replay seed** `R02 refused-announcement-after-close` in the appendix.

### T2E-R03 · A Q-17 row choice can select the other split ratio

**Stop (a), C04 / Q-17.** Use the same Wednesday sale and Thursday approval of the $1 dividend. Friday and Monday both reject the Wednesday split. On Tuesday, the daily window has passed Wednesday. Give the real backfill two syntactically valid Wednesday split rows, 5/4 and 2/1. Both parse and are stored under the same action ID. The sold idea still owes no cash before the coverage ruling.

Send `coverage_gap / row` for `split_AAPL_2026-11-18`. With 5/4 first, the endpoint returns **200**, records ratio 1.25 and the next close pays **$124.96**. With 2/1 first, the same request returns **200**, records ratio 2 and pays **$199.94**. Reversing those two input rows is the only change. I repeated both orders with an explicit `payload: { ratio: 1.25 }` in the request. The endpoint still selected the first row. Respective book cash was **$89,519.32** and **$89,594.30**. Each run posted once. The extra $74.98 comes from a ratio the founder did not select.

The ID contains type, ticker and date. It omits the ratio. The sold-doubt handler calls `rows.find` on that ID and copies the first matching row into the ruling. A parse-clean refetch can contain two different valid payloads even when the idea has never seen a conflict in its own daily window. See `api/_utils/mandateCorporateActions.js:53`, `founderControls.js:161`, `holdRulings.js:407` and `holdRulings.js:635`.

**One change.** Resolve the requested row to one distinct payload in the stored clean refetch. If an ID identifies multiple payloads, require a matching payload selection or refuse the request while the doubt stands. **Replay seed** `R03 refetch-order` in the appendix, in both vendor orders.

## C04 controls and Q-17 release

Each order used the competing daily builders, the real close-time backfill, and S6 after the daily window stopped reaching S2. The acceptance file’s controls were also rerun unchanged.

| S5 order | Outcome through S6 | Founder release and replay |
|---|---|---|
| `natural-dirty-after` · dirty winner, clean loser, clean backfill, second dirty loser before the close commits | Three observations. S2 doubt standing, $0, below full quality | S7 `no_action` releases one $99.97 posting |
| `fresh-backfill` · two dirty observations and a clean loser, then a clean backfill | Same standing doubt and $0 | Same one posting |
| `no-clean` · three dirty builds and a failing backfill, still dirty at S6 | Same standing doubt and $0 | Same one posting |

In each case book cash stayed $89,394.36 through S6. Same-key replay returned the stored success, a new key on the resolved doubt returned 409, and S8 still had one adjustment and $89,494.33. R01 changes which side of the **book commit** receives the loser.

For Q-17, the endpoint returned **422** without a clean refetch, for an absent ID, and for a split actually present in the refetch but dated after the doubt’s upper bound. A unique 5/4 split produced one history-only receipt and the previously approved dividend paid **$124.96 once**. In a separate two-row clean refetch, selecting only a $1.24 dividend created one proposal and paid **$0**. A separate late-adjustment approval then paid **$123.96 once**. The unselected 2/1 split produced no applied receipt. Same-key replay was inert. R03 requires distinct payloads sharing the selected ID.

## A-1 date boundary

Fourteen real-parser histories passed the monetary assertions, seven with AAPL held and seven with a normal line sale completed by the change close. Each listed $1 on the old date, then moved the same $1 to the new date. All dates below are November 2026. Dollar figures are cumulative AAPL income. Where shown, $99.97 already received on the old date stayed paid.

| Old → new | Change observed | Held | Sold |
|---|---|---:|---:|
| 19 → 20 | 18, before both | $99.97 on the 20th | $0, sold on the 18th |
| 19 → 20 | 19, on old date | $0 | $0 |
| 19 → 18 | 19, on old date | $0 | $0, approval 404 |
| 20 → 19 | 19, on new date | $0 | $0 |
| 18 → 20 | 20, on new date | $99.97 already paid | $99.97 already paid |
| 20 → 18 | 19, day before old, after new | $0 | $0, approval 404 |
| 18 → 20 | 19, day before new, after old | $99.97 already paid | $99.97 already paid |

Only the switch before both dates produced a fresh automatic dividend. The held ledger recorded a re-date in every other row. On sold histories where the moved dividend fell inside the holding, the new ID was recorded and could not be approved as an ordinary late entitlement. In the four remaining on/after-boundary sold cases, the new date was outside the holding, cash did not increase from it, and the sold ledger had no open re-date receipt. This last observation is nonblocking under the stated verdict rule. The committed same-ID amount controls also passed, including the founder’s **$199.94** for `H-revise`. See `ledger.js:312` and `astraConfirmation.test.js:216`.

## Once per ledger

The three committed correction seeds `2161123005`, `2140002387` and `2140002610` passed, as did the committed late 2/1 split variant. I changed that split to **3/2** in seed `2161123005` and adjusted its quotes accordingly. The comparison posted the correction once for **$62.98**. The new count opened a **$46.99** late-basis proposal for the S1 dividend. Without another decision the comparison never posted that difference. The idea’s own correction stayed deferred behind its sold doubt. With a founder `no_action` on that doubt, the same correction request `fixed-5` posted **$109.97** on the idea on 27 November. The comparison retained its single 24 November posting. See `adjustments.js:754` and `corporateActionSequences.ahead.test.js`.

## Acceptance and baseline evidence

| Check | Independent result |
|---|---|
| Five rows in `astraConfirmation.test.js` | **5/5**. C01 paid $199.94. C02 stayed at $99.97 already paid. C03 stayed at $0. C04 kept the pre-commit race at $0 through S6. C05 accepted `conflict / none` and completed the queued sale by S4. The full file passed 44/44. |
| Other committed checks in this run | RF-1/refuter file 5/5, advance-listing/correction file 7/7, end-to-end 4/4 on each revision. |
| End-to-end bytes | Direct buffer equality. The head validated **28** parse reports before excluding that signed-off collection. The remaining **191 documents** on each side were **443,533 bytes**. SHA-256 `abcf842026a3d5c4ce4f2c3a858dbd5fcabad2a3388df6c73b3f944ce7c24ed9`. |
| Clean on-time money | Both six-close histories matched `cf35151b` at every close on book cash, quality, and all three ledgers’ cash, dividends and shares. Sector-fund and same-stock arms both ended with **199.940015 AAPL shares**, **$578.62** own income and **$80,578.62** book cash. Inputs were on-time 4/5 and 2/1 splits, a $3.23 dividend, a 5/4 split and a $0.31 dividend. |
| Quarterly differential | **36/36**, comprising 17 scenarios in each of two modes, a 4,000-case build-set group and prompt-byte checks. All **40/40** instrumented cron traces matched. The four planted/vendor control outcomes across two tests were 100 versus 200 shares and $90,000 cash in both modes. Planted inputs were confined to controls for purposes of the verdict. |

## Executable blocking seeds

Append this block to a disposable copy of `api/_utils/practiceField/astraConfirmation.test.js` at the review head. Run the installed Vitest runner on that file with `-t 'R0[123] '`. It uses the file’s existing builders, vendor, gate and founder helpers. I ran these four assertions against the frozen code. R01 failed at $99.97, R02 at $236.93, and R03 with 2/1 first at ratio 2. The 5/4-first R03 control passed.

```js
async function reviewClose(ctx, i, doc, price, backfillRows) {
  await snapshot(ctx, i, 'close', price, doc);
  const result = await closeIdeaBook(ctx.db, ctx.bookRef, {
    date: S[i], now: closeNowOf(S[i]), fetchCorporateActions: parse,
    caFetchImpl: vendor(backfillRows),
  });
  expect(result.closed).toBe(true);
}

async function reviewLateReport(ctx, i, clean, dirty, price) {
  const paused = gate();
  const loser = daily(ctx, i, dirty, '21:25', paused);
  await paused.ready;
  try {
    const winner = await daily(ctx, i, clean, '21:25');
    await reviewClose(ctx, i, winner, price, clean);
  } finally {
    paused.release();
    await loser;
  }
  const report = ctx.db._get('practiceFieldCaParseReports/' + S[i]);
  expect(report.symbols.AAPL).toMatchObject({ rowsRejected: 1, observationsDisagree: true });
}

async function reviewSale() {
  const ctx = await openIdea();
  await session(ctx, 0);
  await session(ctx, 1, [], 94);
  const sold = await session(ctx, 2, [], 94);
  expect(sold.saleReceipts[0]).toMatchObject({ sessionDate: S[2], shares: 99.970008 });
  await session(ctx, 3, [dividend(2, 1)], 94);
  return ctx;
}

it('R01 sold-report-after-close', async () => {
  const ctx = await reviewSale();
  const clean = [dividend(2, 1)], dirty = [...clean, split(2, '3:2')];
  await session(ctx, 4, clean, 94);
  await reviewLateReport(ctx, 5, clean, dirty, 94);
  const answer = await approve(ctx, 2);
  const next = await session(ctx, 6, dirty, 94);
  expect(next.dividendsUsd).toBe(0);
  expect(answer.status).toBe(409);
});

it('R02 refused-announcement-after-close', async () => {
  const ctx = await openIdea();
  for (let i = 0; i <= 4; i++) await session(ctx, i);
  await session(ctx, 5, [dividend(7, 1)]);
  const revised = [dividend(7, 2.37)];
  await reviewLateReport(ctx, 6, revised, [...revised, split(7, '3:2')], 100);
  const due = await session(ctx, 7, revised);
  expect(due.dividendsUsd).toBe(0);
});

it.each([['5/4','2/1'], ['2/1','5/4']])('R03 refetch-order %s then %s', async (a, b) => {
  const ctx = await reviewSale();
  expect((await approve(ctx, 2)).status).toBe(200);
  const bad = [dividend(2, 1), split(2, '5:4')];
  await session(ctx, 4, bad, 94);
  await session(ctx, 5, bad, 94);
  const doc = await daily(ctx, 6, []);
  await reviewClose(ctx, 6, doc, 94, [split(2, a), split(2, b), dividend(2, 1)]);
  const stored = ctx.db._get('practiceFieldCaBackfill/AAPL');
  expect(stored.failed).toBe(false);
  expect(stored.actions.filter(r => r.type === 'split')).toHaveLength(2);
  const body = {
    kind: 'coverage_gap', recordId: 'ca_closed_doubt_AAPL_' + S[2],
    decision: 'row', actionId: 'split_AAPL_' + S[2], payload: { ratio: 1.25 },
  };
  const answer = await ask(ctx, body, 'refetch-choice');
  const next = await session(ctx, 7, [], 94);
  if (answer.status === 200) {
    expect(idea(ctx).founderRulings.at(-1).row.ratio).toBe(1.25);
    expect(next.dividendsUsd).toBe(124.96);
  } else {
    expect([409, 422]).toContain(answer.status);
    expect(next.dividendsUsd).toBe(0);
  }
});
```

## Closing record

| Revision read | Git object |
|---|---|
| Fetched review head | `e222344374ad534eec4836a6550a31e4fa31609c` |
| Frozen product | `90e2b220f5263a45237b89e7bd759148fbf46efb` |
| Previous confirmation | `5fa632719a1598cdf1d21fa72d1cee2b1e6db75f` |
| Fetched main and differential baseline | `cf35151b9528cbdf32a6452b7ffec29c7b058f2f` |

Only the build report and docs index differed between frozen product and review head. Acceptance **5/5**. A-1 monetary boundaries **14/14**. End-to-end bytes equal. Quarterly **36/36**, cron traces **40/40**. **Founder-only switch — NOT READY** on T2E-R01, R02 and R03 under (a).

**Report path** · `C:\Users\fashr\OneDrive\Documents\CodexLocalTest\20261121_ASTRA_RECHECK_T1A2B4.md`
