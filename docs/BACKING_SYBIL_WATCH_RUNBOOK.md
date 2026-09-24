# Backing Beta — the admin Sybil watch (runbook)

**Script:** `scripts/backing-sybil-watch.js` · **Analysis:** `api/_utils/backingSybilWatch.js` · **Spec:** Backing Beta V1.3 §8 (detective controls), §10 (admin Sybil watch); carry-in E1 (the sealed fingerprint) · **Landed:** PR 5.

## What it is

A **read-only report** an admin runs by hand. It reads the backing book — the `backingStakes` documents, each stake's sealed `backingStakes/{id}/private/meta` fingerprint (`ipHash`, `uaHash`, `excluded`) and the pools the stakes name — and prints:

- **Address clusters** — two or more accounts whose stakes share one `ipHash`.
- **Device clusters** — two or more accounts sharing both `ipHash` and `uaHash` (the stronger lead).
- **Concentration** — a cluster's accounts backing the **same team in the same pod**: the one pattern that moves a parimutuel pot.
- **Many-address accounts** — one account seen from three or more addresses (informational; mobile networks and VPNs do this).
- **Hygiene** — stakes with no sealed meta, stakes already `excluded`, stakes whose address hashed the `unknown` sentinel, dev-namespace stakes.

**Leads, not verdicts.** A household, an office or a campus shares an address. The fingerprint is a salted digest of a client-supplied header (see the header of `api/_utils/backingFingerprint.js` for its two binding limits); nothing here is identity, and nothing here is proof.

## What it never does

- It **never writes**. The Firestore handle is wrapped in a proxy that throws on every mutator (`set`, `update`, `delete`, `create`, `add`, `batch`, `runTransaction`, `commit`, …) and on the write-capable escape hatches (`parent`, `firestore`, `ref`). It imports no writer, no settlement module and no apply script.
- It **never de-hashes** anything (it cannot) and never carries a whole digest — the report object holds a 12-character prefix of every hash, so the text and the `--json` output alike show prefixes.
- It **never ranks** accounts and **never sets** `excluded`. Nothing in the product reads its output.

## Running it

Needs the serverless functions' credentials — `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` — from `.env.local` in the repo root (loaded by `scripts/loadLocalEnv.js`; that file documents the format). `CRON_SECRET` (or `BACKING_FINGERPRINT_SALT`) should match the deployment's so the `unknown` address sentinel is recognised; a mismatch only leaves that one count at zero.

```
node scripts/backing-sybil-watch.js                     # the whole book, newest 2000 stakes
node scripts/backing-sybil-watch.js --week=2026-W40     # one backing week
node scripts/backing-sybil-watch.js --since=2026-09-01  # stakes FIRST placed on or after a day
node scripts/backing-sybil-watch.js --limit=500 --min-accounts=3
node scripts/backing-sybil-watch.js --json > report.json
```

Reads: one query over `backingStakes` (bounded by `--limit`, max 10 000), one `private/meta` read per stake in chunks of 50, one pool read per distinct pod. Each query uses **one** server-side dimension so no composite index is needed: `--week` is an equality on `weekKey` (sorted and bounded in memory), `--since` is a single-field range on `placedAt`, the default is the newest by `placedAt`; with both flags the week is the query and the instant is applied in memory. If the report says the limit was **REACHED**, narrow the scope rather than raising the limit.

**`--since` and the default scope on a stake's FIRST placement.** Since the pre-flip cleanup (Amendment C §C2) a backer holds one stake per team per pod, and backing the same team again tops up that stake — its `placedAt` stays the first placement's. A stake opened before `--since` and topped up after it is out of scope, top-up and all. Each top-up's address and agent are in the stake's sealed meta (`topUps[]`) and the report reads every placement of every stake in scope, so use `--week` when a late top-up's address matters.

## Reading the report

1. Start with **CONCENTRATION**. Several allowances from one address on one team in one pod is what a ring would do; a cluster whose accounts back *different* teams, or different pods, is more often a household.
2. Read the **DEVICE CLUSTERS** next — the same address *and* user agent is the stronger lead, though a shared browser build is common.
3. Use **MANY-ADDRESS ACCOUNTS** for context, not as a finding.
4. Check **Hygiene**: a non-zero "no sealed meta" count means a meta write that never landed (or a legacy document) — worth a look on its own; "unknown address" means the platform passed no client address for those requests.

## What follows, if anything — an admin's deliberate act, never this script's

- **Exclude a stake from the stats:** set `excluded: true` on `backingStakes/{id}/private/meta`. The two private stats readers (`GET /api/backing/my-stats`, `GET /api/backing/trainer-stats`) drop excluded stakes from their counts and their net; **settlement math never changes** (§8) — the pot, the pays × and the payouts stand. Known limit: the results card's per-team backer counts and the pool's unique-backer count are the close's frozen figures and are not adjusted by the flag.
- **Refund a pool** (every live stake returned, the pool `refunded`, net BP zero per stake): `POST /api/tournament/backing-settle` with `{ "groupId": "…", "action": "refund", "reason": "…" }` and the admin secret. The reason is logged, never written to the pool document.
- The excluded flag and the refund are the two levers. There is no ban, no rank, and no automatic action from this report.

## Tests

- `api/_utils/backingSybilWatch.test.js` — the analysis, pure: clusters, concentration, hygiene counts, `minAccounts`, malformed input, the printed report's prefixes-only rule and lexicon.
- The script itself is exercised by hand (it needs credentials); its read-only proxy is the `scripts/n1-stranded-precheck.js` pattern, verified in that script's own acceptance.
