// api/_utils/backingSybilWatch.js
//
// Backing Beta PR 5 — THE SYBIL WATCH'S ANALYSIS (spec V1.3 §8 detective
// controls, §10 "admin Sybil watch"; carry-in E1 — the sealed fingerprint).
// PURE: takes the stake documents, their sealed `private/meta` fingerprints
// and (optionally) their pools, and returns a REPORT. It reads nothing,
// writes nothing, and decides nothing — the read-only runner
// (scripts/backing-sybil-watch.js) prints what this returns and an admin
// reads it. "A report, not a product surface" (§8): nothing in the product
// reads this module, no user-facing surface shows its output, and no
// exclusion, refund or settlement is ever derived from it automatically.
//
// WHAT IT LOOKS FOR, at the fingerprint's honest worth (see the header of
// api/_utils/backingFingerprint.js on what the hashes are and are not):
//   · ADDRESS CLUSTERS — two or more accounts whose stakes share one `ipHash`
//     (the salted digest of the first x-forwarded-for hop). A household, an
//     office or a campus shares an address too, so a cluster is a LEAD, never
//     a verdict.
//   · DEVICE CLUSTERS — two or more accounts sharing BOTH `ipHash` and
//     `uaHash`: the stronger lead, though a shared browser build is common.
//   · CONCENTRATION — a cluster's accounts backing the SAME TEAM in the SAME
//     POD: the one pattern that moves a parimutuel pot (§4 the pot pays out
//     of the book; several allowances on one team from one address is what a
//     Sybil ring would do), stated per pod and team with the BP involved.
//   · MANY-ADDRESS ACCOUNTS — one account seen from many addresses or agents
//     across its stakes: informational (mobile networks and VPNs do this),
//     listed so an admin can read a cluster in context.
//   · THE BOOK'S HYGIENE — stakes with no sealed meta (a write that never
//     landed, or a legacy doc), stakes already `excluded`, stakes whose
//     address hashed the `unknown` sentinel, and dev-namespace stakes.
//
// WHAT IT NEVER DOES: it never de-hashes anything (it cannot), never carries
// a full digest — the REPORT OBJECT holds a 12-character prefix of every hash,
// so the text and the `--json` output alike show prefixes (HON-8, the PR 5
// review record) — never ranks accounts, and never touches the `excluded`
// flag: that is an admin's deliberate write elsewhere, which the two stats
// readers honour (api/backing/my-stats.js, api/backing/trainer-stats.js); the
// results card's per-team backer counts are the close's frozen figures and are
// not adjusted by it.

/** The report's shape version — bumped when a field changes meaning. */
export const SYBIL_WATCH_VERSION = 1;

/** The stake statuses the watch counts: everything but a void (a voided stake never moved a pot). */
const COUNTED = new Set(['live', 'won', 'lost']);

/** A digest prefix for printing — never the whole hash. */
export function shortHash(hash, n = 12) {
  return typeof hash === 'string' && hash.length > 0 ? hash.slice(0, n) : '(none)';
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * Analyze the book.
 *
 * @param {Object} input
 * @param {Array<Object>} input.stakes — stake documents `{ id, userId, groupId, teamOdUserId, amount, status, weekKey, placedAt }`
 * @param {Object<string, Object>} input.metaByStakeId — stakeId → the sealed `{ ipHash, uaHash, excluded, at }` (absent when the meta doc is missing)
 * @param {Object<string, Object>} [input.poolsByGroupId] — groupId → the pool document (only `isDev` / `formationPath` are read)
 * @param {Object} [options]
 * @param {number} [options.minAccounts=2] — accounts a cluster needs
 * @param {string|null} [options.unknownIpHash] — the digest of the `unknown` address sentinel, when the runner can compute it
 * @param {Date} [options.now]
 */
export function analyzeSybil({ stakes, metaByStakeId, poolsByGroupId = {} }, { minAccounts = 2, unknownIpHash = null, now = new Date() } = {}) {
  const rows = [];
  const hygiene = { stakes: 0, counted: 0, voided: 0, missingMeta: 0, excluded: 0, unknownAddress: 0, devStakes: 0 };
  const accounts = new Set();
  const pods = new Set();

  for (const stake of Array.isArray(stakes) ? stakes : []) {
    if (!stake || typeof stake.id !== 'string' || typeof stake.userId !== 'string') continue;
    hygiene.stakes += 1;
    if (!COUNTED.has(stake.status)) { hygiene.voided += 1; continue; }
    const meta = metaByStakeId?.[stake.id] ?? null;
    const pool = poolsByGroupId?.[stake.groupId] ?? null;
    const isDev = pool?.isDev === true || (typeof stake.groupId === 'string' && stake.groupId.startsWith('dev-'));
    if (isDev) hygiene.devStakes += 1;
    if (meta == null) { hygiene.missingMeta += 1; hygiene.counted += 1; accounts.add(stake.userId); pods.add(stake.groupId); continue; }
    if (meta.excluded === true) hygiene.excluded += 1;
    if (unknownIpHash && meta.ipHash === unknownIpHash) hygiene.unknownAddress += 1;
    hygiene.counted += 1;
    accounts.add(stake.userId);
    pods.add(stake.groupId);
    rows.push({
      stakeId: stake.id, userId: stake.userId, groupId: stake.groupId, teamOdUserId: stake.teamOdUserId ?? null,
      amount: num(stake.amount), weekKey: stake.weekKey ?? null, status: stake.status,
      ipHash: typeof meta.ipHash === 'string' ? meta.ipHash : null, uaHash: typeof meta.uaHash === 'string' ? meta.uaHash : null,
      excluded: meta.excluded === true, isDev,
    });
  }

  // ── address clusters: ipHash → accounts ────────────────────────────────────
  const byIp = new Map();
  for (const r of rows) {
    if (!r.ipHash) continue;
    const c = byIp.get(r.ipHash) ?? { ipHash: r.ipHash, accounts: new Map(), stakeCount: 0, bp: 0, byPodTeam: new Map() };
    c.stakeCount += 1;
    c.bp += r.amount;
    const a = c.accounts.get(r.userId) ?? { userId: r.userId, stakes: 0, bp: 0, pods: new Set(), excluded: 0 };
    a.stakes += 1; a.bp += r.amount; a.pods.add(r.groupId); if (r.excluded) a.excluded += 1;
    c.accounts.set(r.userId, a);
    const key = `${r.groupId}|${r.teamOdUserId ?? ''}`;
    const pt = c.byPodTeam.get(key) ?? { groupId: r.groupId, teamOdUserId: r.teamOdUserId, accounts: new Set(), bp: 0, isDev: r.isDev };
    pt.accounts.add(r.userId); pt.bp += r.amount;
    c.byPodTeam.set(key, pt);
    byIp.set(r.ipHash, c);
  }
  const addressClusters = [...byIp.values()]
    .filter((c) => c.accounts.size >= minAccounts)
    .map((c) => ({
      ipHash: shortHash(c.ipHash),
      accountCount: c.accounts.size,
      stakeCount: c.stakeCount,
      bp: c.bp,
      accounts: [...c.accounts.values()].map((a) => ({ userId: a.userId, stakes: a.stakes, bp: a.bp, pods: [...a.pods].sort(), excluded: a.excluded })).sort((x, y) => y.bp - x.bp || x.userId.localeCompare(y.userId)),
      // THE CONCENTRATION: this cluster's accounts on ONE team in ONE pod.
      sameTeam: [...c.byPodTeam.values()]
        .filter((pt) => pt.accounts.size >= minAccounts)
        .map((pt) => ({ groupId: pt.groupId, teamOdUserId: pt.teamOdUserId, accountCount: pt.accounts.size, accounts: [...pt.accounts].sort(), bp: pt.bp, isDev: pt.isDev }))
        .sort((x, y) => y.bp - x.bp || x.groupId.localeCompare(y.groupId)),
    }))
    .sort((x, y) => y.accountCount - x.accountCount || y.bp - x.bp || x.ipHash.localeCompare(y.ipHash));

  // ── device clusters: (ipHash, uaHash) → accounts ───────────────────────────
  const byDevice = new Map();
  for (const r of rows) {
    if (!r.ipHash || !r.uaHash) continue;
    const key = `${r.ipHash}|${r.uaHash}`;
    const d = byDevice.get(key) ?? { ipHash: r.ipHash, uaHash: r.uaHash, accounts: new Set(), stakeCount: 0, bp: 0 };
    d.accounts.add(r.userId); d.stakeCount += 1; d.bp += r.amount;
    byDevice.set(key, d);
  }
  const deviceClusters = [...byDevice.values()]
    .filter((d) => d.accounts.size >= minAccounts)
    .map((d) => ({ ipHash: shortHash(d.ipHash), uaHash: shortHash(d.uaHash), accountCount: d.accounts.size, accounts: [...d.accounts].sort(), stakeCount: d.stakeCount, bp: d.bp }))
    .sort((x, y) => y.accountCount - x.accountCount || y.bp - x.bp || x.ipHash.localeCompare(y.ipHash));

  // ── concentration across the book: every (pod, team) backed by a cluster ──
  const concentration = addressClusters.flatMap((c) => c.sameTeam.map((t) => ({ ...t, ipHash: c.ipHash })))
    .sort((x, y) => y.bp - x.bp || x.groupId.localeCompare(y.groupId));

  // ── many-address accounts (informational) ─────────────────────────────────
  const byAccount = new Map();
  for (const r of rows) {
    const a = byAccount.get(r.userId) ?? { userId: r.userId, ips: new Set(), uas: new Set(), stakes: 0 };
    if (r.ipHash) a.ips.add(r.ipHash);
    if (r.uaHash) a.uas.add(r.uaHash);
    a.stakes += 1;
    byAccount.set(r.userId, a);
  }
  const manyAddressAccounts = [...byAccount.values()]
    .filter((a) => a.ips.size >= 3)
    .map((a) => ({ userId: a.userId, addressCount: a.ips.size, agentCount: a.uas.size, stakes: a.stakes }))
    .sort((x, y) => y.addressCount - x.addressCount || x.userId.localeCompare(y.userId));

  return {
    version: SYBIL_WATCH_VERSION,
    generatedAt: new Date(now).toISOString(),
    minAccounts,
    counts: { ...hygiene, accounts: accounts.size, pods: pods.size, addressClusters: addressClusters.length, deviceClusters: deviceClusters.length, concentration: concentration.length },
    addressClusters,
    deviceClusters,
    concentration,
    manyAddressAccounts,
  };
}

/** The report as lines for a terminal — digests as prefixes, never whole. */
export function formatSybilReport(report) {
  const out = [];
  const c = report.counts;
  out.push(`BACKING SYBIL WATCH — report v${report.version} — ${report.generatedAt}`);
  out.push('READ-ONLY. Leads, not verdicts: a shared address is a household as often as a ring. Nothing here changes a stake, a pool or a wallet.');
  out.push('');
  out.push(`Stakes read: ${c.stakes} · counted (live/won/lost): ${c.counted} · voided (skipped): ${c.voided} · accounts: ${c.accounts} · pods: ${c.pods}`);
  out.push(`Hygiene — no sealed meta: ${c.missingMeta} · already excluded: ${c.excluded} · unknown address: ${c.unknownAddress} · dev-namespace: ${c.devStakes}`);
  out.push('');
  out.push(`ADDRESS CLUSTERS (≥${report.minAccounts} accounts on one address): ${report.addressClusters.length}`);
  for (const cl of report.addressClusters) {
    out.push(`  ip ${shortHash(cl.ipHash)}… — ${cl.accountCount} accounts · ${cl.stakeCount} stakes · ${cl.bp} BP`);
    for (const a of cl.accounts) out.push(`    ${a.userId} — ${a.stakes} stakes · ${a.bp} BP · pods ${a.pods.join(', ')}${a.excluded ? ` · ${a.excluded} excluded` : ''}`);
    for (const t of cl.sameTeam) out.push(`    SAME TEAM: pod ${t.groupId} · team ${t.teamOdUserId ?? '?'} · ${t.accountCount} accounts · ${t.bp} BP${t.isDev ? ' · dev' : ''}`);
  }
  out.push('');
  out.push(`DEVICE CLUSTERS (≥${report.minAccounts} accounts on one address AND one user agent): ${report.deviceClusters.length}`);
  for (const d of report.deviceClusters) out.push(`  ip ${shortHash(d.ipHash)}… ua ${shortHash(d.uaHash)}… — ${d.accountCount} accounts (${d.accounts.join(', ')}) · ${d.stakeCount} stakes · ${d.bp} BP`);
  out.push('');
  out.push(`CONCENTRATION (a cluster's accounts on ONE team in ONE pod): ${report.concentration.length}`);
  for (const t of report.concentration) out.push(`  pod ${t.groupId} · team ${t.teamOdUserId ?? '?'} · ${t.accountCount} accounts (${t.accounts.join(', ')}) · ${t.bp} BP · ip ${shortHash(t.ipHash)}…${t.isDev ? ' · dev' : ''}`);
  out.push('');
  out.push(`MANY-ADDRESS ACCOUNTS (≥3 addresses across their stakes — informational): ${report.manyAddressAccounts.length}`);
  for (const a of report.manyAddressAccounts) out.push(`  ${a.userId} — ${a.addressCount} addresses · ${a.agentCount} agents · ${a.stakes} stakes`);
  out.push('');
  out.push('Next step, if any, is an admin\'s: set `excluded: true` on a stake\'s sealed meta (the two private stats readers drop it; the results card\'s backer counts are the close\'s frozen figures; settlement math never changes), or refund a pool through the admin endpoint with a reason. This script does neither.');
  return out.join('\n');
}
