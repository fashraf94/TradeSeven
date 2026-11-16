// api/_utils/compositionProtectedStores.scan.test.js
//
// Composition PR 3 — ledger item B3 (test form): deny-by-default protected-
// store writes. See compositionProtectedStoresScan.js for the resolution
// model. Acceptance (ledger): an unlisted `.set()` on an agents path anywhere
// in api//scripts/ fails; removing a site without pruning its key fails
// stale — the ratchet tightens in both directions.

//
// T1A-07 (Astra; Practice Field T1a-2a): the MONEY store. `mandates` and what is
// written under a book are listed by PATH (any segment), a transaction handle's
// ref argument is followed, and query-derived and destructured refs resolve —
// or are at least visible. The block at the foot of this file proves each form
// on a synthetic repo, with a non-listed control beside it, and kills her M06.
//
// IS-4 / IS-5 (lens 3 of the T1a-2a review, 13 Nov 2026): the nested blocks at
// the foot. IS-4 — a handle handed in under any name beside the ref-named
// parameter it writes, a transaction callback passed by name, a bulk writer, a
// write through `.parent`, and recursiveDelete are sites now; what the scan
// still cannot see is one row of limits, each of which passes today. IS-5 —
// the callers of the idea book's write entry points are pinned by name (they
// are a second hop, which the write scan does not follow, so no key counts them).

import { describe, it, expect } from 'vitest';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import {
  scanProtectedStoreWrites, siteKey, classifyPath,
  PROTECTED_COLLECTIONS, MONEY_ROOT_COLLECTIONS, MONEY_SUBCOLLECTIONS,
  WRITE_METHODS, REF_ARGUMENT_WRITE_METHODS, IDEA_BOOK_WRITE_ENTRY_POINTS,
} from './compositionProtectedStoresScan.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const ALLOWLIST = JSON.parse(readFileSync(resolve(HERE, 'compositionProtectedStoresAllowlist.json'), 'utf8'));

// ONE full-repo scan, shared across every block below. The scan reads and
// AST-parses every non-test .js under api/ + scripts/ — inherently proportional
// to repo size (~1.5s today). It used to be invoked THREE times (once per
// describe, and once INSIDE the #10 test body), so the whole tree was re-read
// and re-parsed 3×; the in-#10-body invocation was the only one bound by
// vitest's 5s per-test timeout, and it intermittently crossed it under full-
// suite CPU contention after the mandate-substrate PR grew the tree. Scanning
// once at module load (collection time, NOT per-test-timeout-bound) removes the
// redundancy AND makes the #10 body a pure in-memory filter. Synthetic-repo
// scans below run on tiny temp dirs and are unaffected.
const SCAN = scanProtectedStoreWrites(REPO);

describe('B3 — deny-by-default protected-store write scan (AST, api/ + scripts/)', () => {
  const { all, needsListing } = SCAN;
  // review F3a: the allowlist pins a SITE COUNT per key — a second write
  // added inside an already-listed (file, fn, method, collection) tuple
  // changes the count and fails CI, not just brand-new tuples.
  const foundCounts = {};
  for (const s of needsListing) foundCounts[siteKey(s)] = (foundCounts[siteKey(s)] ?? 0) + 1;
  const allowedCounts = ALLOWLIST.allowedWriteSites;
  const allowed = new Set(Object.keys(allowedCounts));
  const foundKeys = new Set(Object.keys(foundCounts));

  it('the scan is alive: it sees the known writer surface', () => {
    // Guards against a silent scanner regression scanning nothing — the
    // canonical writers must be visible or the deny-by-default claim is hollow.
    expect(all.length).toBeGreaterThan(100);
    expect(foundKeys.has('api/_utils/agentSettingsTx.js::txUpdateAgentSettings::update::unresolved')).toBe(true);
    expect(foundKeys.has('api/_utils/tournamentCpu.js::ensureCpuAgents::set::agents')).toBe(true);
    expect([...PROTECTED_COLLECTIONS]).toContain('agents');
  });

  it('DENY-BY-DEFAULT: every protected-or-unresolved write site is on the explicit allowlist AT ITS PINNED COUNT', () => {
    const unlisted = [...foundKeys].filter((k) => !allowed.has(k)).sort();
    expect(unlisted, 'new protected-store write site(s) — a human must review the writer and add its key to compositionProtectedStoresAllowlist.json in the same PR').toEqual([]);
    const drifted = [...foundKeys].filter((k) => allowed.has(k) && foundCounts[k] !== allowedCounts[k])
      .map((k) => `${k}: found ${foundCounts[k]}, pinned ${allowedCounts[k]}`).sort();
    expect(drifted, 'write-site COUNT drifted inside an allowlisted tuple — a human must re-review the function and update the pinned count').toEqual([]);
  });

  it('no parse failures anywhere in the scanned tree (a file the scan cannot read is a hole, not a pass)', () => {
    const parseErrors = needsListing.filter((s) => String(s.collection).startsWith('parse_error:'));
    expect(parseErrors).toEqual([]);
  });

  it('the allowlist is not stale: every key still matches a live site (the ratchet only tracks reality)', () => {
    const stale = [...allowed].filter((k) => !foundKeys.has(k)).sort();
    expect(stale, 'allowlisted write site(s) no longer exist — prune the key(s) in the same PR that removed the write').toEqual([]);
  });

  it('THE FLOOR HOLDS (T1A-07): every site the B3 resolver alone would list is still listed — the path resolver re-keys and adds, it never unlists', () => {
    const listed = new Set(needsListing);
    const floor = all.filter((s) => s.legacyListed);
    // 563 when this row was written; a floor that shrank to nothing would pass the row below vacuously.
    expect(floor.length).toBeGreaterThan(500);
    expect(floor.filter((s) => !listed.has(s)).map(siteKey)).toEqual([]);
  });

  it('the money store is on the list: the Practice Field write sites, and the engine\'s, are found under the store each one writes', () => {
    // A scanner regression that stops seeing these (a resolver that no longer follows a transaction's ref
    // argument, a query's documents or a destructured ref) fails here, by name, before the allowlist row does.
    // Each line is file :: function :: store — the last part of the site's key. Not the method (a receipt moved
    // from tx.set to tx.create the day this row was written) and not the count: those are the allowlist's.
    const stores = new Set(needsListing.map((s) => `${s.file}::${s.fn}::${s.collection ?? 'unresolved'}`));
    const PF = 'api/_utils/practiceField';
    const present = [
      // the book and its epoch, the claim and the registry
      `${PF}/ideaBook.js::createIdeaBook::mandates`,
      `${PF}/ideaBook.js::createIdeaBook::epochs`,
      `${PF}/ideaBook.js::createIdeaBook::practiceFieldBooks`,
      // admission and release: the idea, the book's treasury, the coverage
      `${PF}/admission.js::admitIdea::ideas`,
      `${PF}/admission.js::admitIdea::mandates`,
      `${PF}/admission.js::admitIdea::practiceFieldCoverage`,
      `${PF}/admission.js::releaseIdea::ideas`,
      `${PF}/admission.js::releaseIdea::mandates`,
      // the entry: the idea, its inception row, the fills' receipts, the book (a destructured ref: unresolved)
      `${PF}/entry.js::enterIdea::ideas`,
      `${PF}/entry.js::enterIdea::rows`,
      `${PF}/entry.js::enterIdea::decisions`,
      `${PF}/entry.js::enterIdea::unresolved`,
      // METADATA, not money — the idea's lastEntryAttempt, inside the transaction and outside it
      `${PF}/entry.js::deferOrCancel::ideas`,
      `${PF}/entry.js::runIdeaBookEntryPass::ideas`,
      // the sales and the settlement
      `${PF}/exits.js::sellPendingHoldings::ideas`,
      `${PF}/exits.js::sellPendingHoldings::decisions`,
      `${PF}/exits.js::sellPendingHoldings::unresolved`,
      // METADATA — the sweep's within-slot stamp (a query-derived ref)
      `${PF}/sweep.js::runIdeaBookEvalPass::mandates`,
      // the quarterly engine: the sweeps' own stamps (invisible before T1A-07), a decision receipt, the book
      'api/cron/mandate-evaluate.js::runEvalSweep::mandates',
      'api/cron/mandate-evaluate.js::runCloseSweep::mandates',
      'api/cron/mandate-rollover.js::runRolloverSweep::mandates',
      'api/_utils/mandateExecution.js::executeDecision::decisions',
      'api/_utils/mandateCreationService.js::createMandate::mandates',
    ];
    expect(present.filter((k) => !stores.has(k))).toEqual([]);
    // The two metadata sites and the stamp, by their whole keys: these three are the ones the build names.
    expect(foundKeys.has(`${PF}/entry.js::deferOrCancel::update::ideas`)).toBe(true);
    expect(foundKeys.has(`${PF}/entry.js::runIdeaBookEntryPass::update::ideas`)).toBe(true);
    expect(foundKeys.has(`${PF}/sweep.js::runIdeaBookEvalPass::set::mandates`)).toBe(true);
    // The sweep's lease on the book resolves to the book (a query-derived ref handed to a write helper).
    expect(foundKeys.has(`${PF}/sweep.js::runIdeaBookEvalPass::call:acquireLease#1::mandates`)).toBe(true);
    // The close: by file and store (its functions are internal and move).
    const closeStores = new Set(needsListing.filter((s) => s.file === `${PF}/close.js`).map((s) => s.collection ?? 'unresolved'));
    for (const store of ['ideas', 'rows', 'dailyRows', 'corporateActions', 'practiceFieldCoverage', 'unresolved']) expect(closeStores.has(store), `close.js → ${store}`).toBe(true);
    // No write resolves to the book, or to anything under it, and passes: nothing in `all` names a money store
    // without being listed.
    const listed = new Set(needsListing);
    const moneyNames = new Set([...MONEY_ROOT_COLLECTIONS, ...MONEY_SUBCOLLECTIONS]);
    const passing = all.filter((s) => !listed.has(s) && String(s.collection ?? '').split('+').some((c) => moneyNames.has(c)));
    expect(passing.map(siteKey)).toEqual([]);
  });
});

describe('B3-EXT — one-level helper-parameter data-flow (PR 4 ledger row)', () => {
  const { needsListing } = SCAN;
  const keys = new Set(needsListing.map(siteKey));

  it('a helper taking a ref param that writes IS detected (definition site + census-chokepoint call sites)', () => {
    // Callee-base form: applyConsolidation(agentRef){ agentRef.update(…) }.
    expect(keys.has('api/_utils/agentConsolidationApply.js::applyConsolidation::update::param:agentRef')).toBe(true);
    // Handle ref-argument form: txUpdateAgentSettings(tx, ref){ tx.update(ref,…) } —
    // the endpoint call sites now resolve the CALLER's agents ref, per-callsite.
    expect(keys.has('api/agent/equip-bundle.js::handler::call:txUpdateAgentSettings#1::agents')).toBe(true);
    expect(keys.has('api/agent/update-agent-settings.js::handler::call:txUpdateAgentSettings#1::agents')).toBe(true);
  });

  it('a NEW call site passing a protected ref into a registered helper fails deny-by-default (synthetic repo)', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const root = mkdtempSync(join(tmpdir(), 'b3ext-'));
    try {
      mkdirSync(join(root, 'api'), { recursive: true });
      mkdirSync(join(root, 'scripts'), { recursive: true });
      writeFileSync(join(root, 'api', 'helper.js'),
        'export function writeThrough(ref, data) { return ref.set(data); }\n');
      writeFileSync(join(root, 'api', 'caller.js'),
        "import { writeThrough } from './helper.js';\n"
        + "export async function save(db, d) { await writeThrough(db.collection('agents').doc('x'), d); }\n"
        + "export async function savePlain(db, d) { await writeThrough(db.collection('shadowLogs').doc('x'), d); }\n");
      const res = scanProtectedStoreWrites(root);
      const found = new Set(res.needsListing.map(siteKey));
      // The helper definition is a listed site (invisible to the direct pass).
      expect(found.has('api/helper.js::writeThrough::set::param:ref')).toBe(true);
      // The call site passing an AGENTS ref needs listing at its count…
      expect(found.has('api/caller.js::save::call:writeThrough#0::agents')).toBe(true);
      // …while the call passing a NON-protected literal ref passes unlisted.
      expect(found.has('api/caller.js::savePlain::call:writeThrough#0::shadowLogs')).toBe(false);
      expect(res.all.some((s) => siteKey(s) === 'api/caller.js::savePlain::call:writeThrough#0::shadowLogs')).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('documented limit, kept executable: a TWO-HOP chain is visible only at the first hop (unresolved), never followed', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const root = mkdtempSync(join(tmpdir(), 'b3ext2-'));
    try {
      mkdirSync(join(root, 'api'), { recursive: true });
      mkdirSync(join(root, 'scripts'), { recursive: true });
      writeFileSync(join(root, 'api', 'twohop.js'),
        'export function inner(ref, d) { return ref.set(d); }\n'
        + 'export function outer(agentRef, d) { return inner(agentRef, d); }\n'
        + "export function top(db, d) { return outer(db.collection('agents').doc('x'), d); }\n");
      const res = scanProtectedStoreWrites(root);
      const found = new Set(res.needsListing.map(siteKey));
      // First hop: outer's call into inner resolves outer's PARAM — unresolved, listed.
      expect(found.has('api/twohop.js::outer::call:inner#0::unresolved')).toBe(true);
      // The outer helper itself is NOT registered (its param never reaches a
      // write method directly) — so top's agents ref is invisible: the two-hop
      // limit of record. If this expectation ever flips, the limit prose in
      // compositionProtectedStoresScan.js must be rewritten in the same PR.
      expect(found.has('api/twohop.js::top::call:outer#0::agents')).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('#10 (Sol pre-activation review) — destructured/extracted write methods fail loud', () => {
  // Explicit timeout: this test re-parses every non-test .js under api/ +
  // scripts/ (a full-repo AST scan by design), which sits right at the 5s
  // default under full-suite worker load as the scanned surface grows — the
  // SPEC1 P3 additions pushed it over intermittently. Long-running on purpose;
  // 20s is headroom, not slack.
  it('the repo carries ZERO write-method extractions (the conservative rule: any occurrence must resolve through the allowlist or fail unresolved)', () => {
    // Reads the SHARED module-load scan (no re-scan in the test body — that
    // in-body full-repo scan was the intermittent 5s timeout). Same data, same
    // assertion: any extract: site anywhere in api/ + scripts/ fails loud.
    const extractions = SCAN.all.filter((s) => s.method.startsWith('extract:'));
    expect(extractions).toEqual([]);
  }, 20000);

  it('the detector catches destructuring, aliases, method-value extraction, and bind — and ignores non-Firestore shapes and ordinary calls', async () => {
    const { detectExtractionsInSource } = await import('./compositionProtectedStoresScan.js');
    const flagged = (src) => detectExtractionsInSource('unit.js', src).map((s) => s.method);
    // Destructured off a tx handle:
    expect(flagged('export function f(tx) { const { set } = tx; set(a, b); }')).toEqual(['extract:set']);
    // Aliased destructure off a ref:
    expect(flagged('export function f(agentRef) { const { update: u } = agentRef; u({}); }')).toEqual(['extract:update']);
    // Destructure off a const-hopped handle:
    expect(flagged('export function f(tx) { const t = tx; const { create } = t; }')).toEqual(['extract:create']);
    // Method-value extraction from a chain:
    expect(flagged("export function f(db) { const del = db.collection('agents').doc('a').delete; del(); }")).toEqual(['extract:delete']);
    // Passed as a value / bound:
    expect(flagged('export function f(docRef, run) { run(docRef.set); }')).toEqual(['extract:set']);
    expect(flagged('export function f(docRef) { return docRef.delete.bind(docRef); }')).toEqual(['extract:delete']);
    // NOT flagged: a Map/store delete (non-Firestore shape), an ordinary called write:
    expect(flagged('export function f(store, k) { store.delete(k); const { add } = someSet; }')).toEqual([]);
    expect(flagged("export function f(tx, ref) { tx.set(ref, {}); ref.update({}); }")).toEqual([]);
    // NOT flagged: a typeof feature-detect — the member value is consumed by
    // typeof and can never write (the moverCandidates precedent); the
    // adjacent actual call stays visible to the direct pass:
    expect(flagged("export function f(ref) { if (typeof ref.delete === 'function') ref.delete(); }")).toEqual([]);
  });
});

describe('T1A-07 — the money store: paths, transaction ref arguments, query-derived and destructured refs', () => {
  /** Scan a synthetic repo ({ 'api/x.js': source lines }) → the listed keys with counts, and every site. */
  const scanSynthetic = (files) => {
    const root = mkdtempSync(join(tmpdir(), 't1a07-'));
    try {
      mkdirSync(join(root, 'api'), { recursive: true });
      mkdirSync(join(root, 'scripts'), { recursive: true });
      for (const [rel, lines] of Object.entries(files)) {
        mkdirSync(dirname(join(root, rel)), { recursive: true });
        writeFileSync(join(root, rel), `${[].concat(lines).join('\n')}\n`);
      }
      const res = scanProtectedStoreWrites(root);
      const counts = {};
      for (const s of res.needsListing) counts[siteKey(s)] = (counts[siteKey(s)] ?? 0) + 1;
      return { counts, listed: new Set(Object.keys(counts)), all: new Set(res.all.map(siteKey)), sites: res.all, entryPoints: res.entryPoints };
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  };
  /** A write that is SEEN and passes unlisted (the control beside each positive). */
  const passes = (r, key) => r.all.has(key) && !r.listed.has(key);

  it('the inventory: the book and what the server writes under it (a removal is a change to this row)', () => {
    expect([...MONEY_ROOT_COLLECTIONS]).toEqual(['mandates']);
    expect([...MONEY_SUBCOLLECTIONS].sort()).toEqual([
      'corporateActions', 'dailyRows', 'decisions', 'epochs', 'ideas', 'nominations', 'pendingScoringAppends', 'quarterSummaries', 'rows',
    ]);
    // Money on ANY segment lists; the key is the nearest literal.
    expect(classifyPath(['mandates'])).toMatchObject({ hit: true, money: true, key: 'mandates' });
    expect(classifyPath(['mandates', 'ideas', 'rows'])).toMatchObject({ hit: true, key: 'rows', path: 'mandates/ideas/rows' });
    expect(classifyPath(['mandates', 'anything'])).toMatchObject({ hit: true, key: 'anything' });
    expect(classifyPath([null, 'rows'])).toMatchObject({ hit: true, key: 'rows', resolved: false });
    expect(classifyPath(['mandates', null])).toMatchObject({ hit: true, key: 'mandates' });
    expect(classifyPath(['shadowLogs', 'anything']).hit).toBe(false);
    // A PROTECTED collection is matched at the leaf only, as before (the documented limit, kept executable).
    expect(classifyPath(['agents', 'rules'])).toMatchObject({ hit: true, money: false, key: 'rules' });
    expect(classifyPath(['agents', 'plays']).hit).toBe(false);
  });

  it("Astra's M06 is KILLED: an otherwise unlisted function that writes mandates/{id} is a site that needs listing", () => {
    const r = scanSynthetic({
      'api/anywhere.js': [
        'export async function m06(db) {',
        "  await db.collection('mandates').doc('synthetic').update({ 'portfolio.cash': 123456 });",
        '}',
      ],
    });
    expect(r.counts).toEqual({ 'api/anywhere.js::m06::update::mandates': 1 });
    // The key is the function's own, so nothing on the allowlist can carry it, in whichever file it is planted…
    for (const file of ['api/_utils/practiceField/sweep.js', 'api/cron/mandate-evaluate.js', 'api/agent/chat.js']) {
      expect(ALLOWLIST.allowedWriteSites[`${file}::m06::update::mandates`]).toBeUndefined();
    }
    // …and planted INSIDE a listed function it drifts that function's pinned count (review F3a).
    const inside = scanSynthetic({
      'api/anywhere.js': [
        'export async function listed(db, id) {',
        "  await db.collection('mandates').doc(id).update({ revision: 2 });",
        "  await db.collection('mandates').doc('synthetic').update({ 'portfolio.cash': 123456 });",
        '}',
      ],
    });
    expect(inside.counts).toEqual({ 'api/anywhere.js::listed::update::mandates': 2 });
  });

  it('DIRECT and CHAINED: the book by its root, a subcollection by its leaf, anything under the book by its ancestor', () => {
    const r = scanSynthetic({
      'api/a.js': [
        "const BOOKS = 'mandates';",
        "export async function direct(db, x) { await db.collection('mandates').doc(x).update({ a: 1 }); }",
        "export async function chained(db, x, y) { await db.collection('mandates').doc(x).collection('ideas').doc(y).set({}); }",
        "export async function ancestor(db, x, y) { await db.collection('mandates').doc(x).collection('anything').doc(y).set({}); }",
        "export async function slashed(db, y) { await db.collection('mandates/book1/rows').doc(y).set({}); }",
        "export async function docPath(db) { await db.doc('mandates/book1').update({}); }",
        'export async function byConstant(db, x) { await db.collection(BOOKS).doc(x).set({}); }',
        "export async function plain(db, x) { await db.collection('shadowLogs').doc(x).update({ a: 1 }); }",
        "export async function plainSub(db, x, y) { await db.collection('shadowLogs').doc(x).collection('anything').doc(y).set({}); }",
      ],
    });
    expect(r.counts).toEqual({
      'api/a.js::direct::update::mandates': 1,
      'api/a.js::chained::set::ideas': 1,
      'api/a.js::ancestor::set::anything': 1, // listed by its ancestor: the path decides, the leaf names the key
      'api/a.js::slashed::set::rows': 1,
      'api/a.js::docPath::update::mandates': 1,
      'api/a.js::byConstant::set::mandates': 1,
    });
    expect(passes(r, 'api/a.js::plain::update::shadowLogs')).toBe(true);
    // The same leaf name under a non-money root is seen and passes.
    expect(r.sites.filter((s) => s.fn === 'plainSub').map((s) => [s.collection, s.mustList === true])).toEqual([['anything', false]]);
    expect(r.sites.filter((s) => s.fn === 'ancestor').map((s) => [s.collection, s.mustList === true, s.path])).toEqual([['anything', true, 'mandates/anything']]);
  });

  it("BOOK-REF LEAF: bookRef.collection('rows').doc(d).set(…) is listed by its leaf — and the documented limits, kept executable", () => {
    const r = scanSynthetic({
      'api/b.js': [
        "export function leaf(bookRef, d) { return bookRef.collection('rows').doc(d).set({}); }",
        "export function unknownLeaf(bookRef, d) { return bookRef.collection('newThing').doc(d).set({}); }",
        "export function rootedUnknownLeaf(db, b, d) { return db.collection('mandates').doc(b).collection('newThing').doc(d).set({}); }",
        "export function protectedAncestor(db, a, p) { return db.collection('agents').doc(a).collection('plays').doc(p).set({}); }",
      ],
    });
    expect(r.counts).toEqual({
      'api/b.js::leaf::set::rows': 1,
      'api/b.js::rootedUnknownLeaf::set::newThing': 1,
    });
    // THE LIMIT OF RECORD: a subcollection whose name is not in MONEY_SUBCOLLECTIONS, written through an opaque
    // book ref, has no money segment on its path and passes. If this ever flips, rewrite the limit prose in
    // compositionProtectedStoresScan.js in the same PR.
    expect(passes(r, 'api/b.js::unknownLeaf::set::newThing')).toBe(true);
    // …and the ancestor rule is the money store's only: agents/{id}/plays resolves to `plays` and passes.
    expect(passes(r, 'api/b.js::protectedAncestor::set::plays')).toBe(true);
  });

  it('TRANSACTION, a const-resolved ref: tx.set(ideaRef, …) is keyed by what ideaRef names; an opaque ref stays unresolved', () => {
    const r = scanSynthetic({
      'api/c.js': [
        'export async function txConst(db, { bookRef, ideaId }) {',
        "  const ideaRef = bookRef.collection('ideas').doc(ideaId);",
        '  return db.runTransaction(async (tx) => { tx.set(ideaRef, {}); tx.update(bookRef, { revision: 2 }); });',
        '}',
        'export async function txRooted(db, b) {',
        "  const mandateRef = db.collection('mandates').doc(b);",
        "  const epochRef = mandateRef.collection('epochs').doc('e1');",
        '  return db.runTransaction(async (tx) => { tx.set(mandateRef, {}); tx.create(epochRef, {}); });',
        '}',
        'export async function txPlain(db) {',
        "  const logRef = db.collection('shadowLogs').doc('x');",
        '  return db.runTransaction(async (tx) => { tx.set(logRef, {}); });',
        '}',
      ],
    });
    expect(r.counts).toEqual({
      'api/c.js::txConst::set::ideas': 1,
      'api/c.js::txConst::update::unresolved': 1, // the book through a destructured parameter: listed, not named
      'api/c.js::txRooted::set::mandates': 1,
      'api/c.js::txRooted::create::epochs': 1,
      'api/c.js::txPlain::set::unresolved': 1, // a handle write to a non-listed store keeps its key, as before
    });
  });

  it('TRANSACTION, an inline chain — and a handle by POSITION, and a batch', () => {
    const r = scanSynthetic({
      'api/d.js': [
        'export async function txInline(db, bookRef, id) {',
        '  return db.runTransaction(async (tx) => {',
        "    tx.set(bookRef.collection('decisions').doc(id), {});",
        "    tx.update(db.collection('mandates').doc(id), {});",
        '  });',
        '}',
        'export async function positional(db, id) {',
        "  return db.runTransaction(async (t) => { t.update(db.collection('mandates').doc(id), {}); t.set(somewhere(db), {}); });",
        '}',
        'export async function batched(db, id) {',
        '  const batch = db.batch();',
        "  batch.set(db.collection('mandates').doc(id).collection('dailyRows').doc('d'), {});",
        "  batch.delete(db.collection('shadowLogs').doc(id));",
        '  await batch.commit();',
        '}',
      ],
    });
    expect(r.counts).toEqual({
      'api/d.js::txInline::set::decisions': 1,
      'api/d.js::txInline::update::mandates': 1,
      'api/d.js::positional::update::mandates': 1,
      'api/d.js::positional::set::unresolved': 1, // `t` is a handle because of where it is declared
      'api/d.js::batched::set::dailyRows': 1,
      'api/d.js::batched::delete::unresolved': 1,
    });
  });

  it("QUERY-DERIVED: a for…of over .docs, via a const, a callback parameter, an index, a builder's return and an accumulated array", () => {
    const r = scanSynthetic({
      'api/e.js': [
        "const MANDATES = 'mandates';",
        'async function booksOf(db, status) {',
        "  const page = await db.collection(MANDATES).where('status', '==', status).limit(10).get();",
        '  return page.docs;',
        '}',
        'export async function loop(db) {',
        "  const page = await db.collection('mandates').where('status', '==', 'active').get();",
        '  for (const d of page.docs) await d.ref.set({ stamp: 1 }, { merge: true });',
        '}',
        'export async function viaConst(db) {',
        "  const page = await db.collection('mandates').get();",
        '  for (const docSnap of page.docs) { const bookRef = docSnap.ref; await bookRef.set({ stamp: 1 }, { merge: true }); }',
        '}',
        'export async function callback(db) {',
        "  const page = await db.collection('mandates').get();",
        '  page.docs.forEach((d) => d.ref.update({ a: 1 }));',
        '  page.forEach((d) => { d.ref.delete(); });',
        '  await page.docs[0].ref.update({ b: 2 });',
        '}',
        'export async function accumulated(db) {',
        '  const docs = [];',
        "  for (const status of ['active', 'draining']) docs.push(...(await booksOf(db, status)));",
        '  for (const docSnap of docs) { const bookRef = docSnap.ref; await bookRef.set({ stamp: 1 }, { merge: true }); }',
        '}',
        'export async function group(db) {',
        "  const snap = await db.collectionGroup('ideas').get();",
        '  for (const d of snap.docs) await d.ref.update({ a: 1 });',
        '}',
        'export async function plainLoop(db) {',
        "  const page = await db.collection('shadowLogs').get();",
        '  for (const d of page.docs) await d.ref.delete();',
        '}',
        'export async function opaque(snaps) { for (const s of snaps) await s.ref.set({ a: 1 }); }',
      ],
    });
    expect(r.counts).toEqual({
      'api/e.js::loop::set::mandates': 1,
      'api/e.js::viaConst::set::mandates': 1,
      'api/e.js::callback::update::mandates': 2,
      'api/e.js::callback::delete::mandates': 1,
      'api/e.js::accumulated::set::mandates': 1,
      'api/e.js::group::update::ideas': 1,
      'api/e.js::opaque::set::unresolved': 1, // a ref-shaped base the scan cannot resolve: VISIBLE now, and listed
    });
    expect(passes(r, 'api/e.js::plainLoop::delete::shadowLogs')).toBe(true);
  });

  it('DESTRUCTURED refs: `const { ref } = snap`, a destructured loop variable, a destructured parameter, a ref-named property — and what is not a ref', () => {
    const r = scanSynthetic({
      'api/f.js': [
        'export async function fromSnap(db) {',
        "  const page = await db.collection('mandates').get();",
        '  for (const docSnap of page.docs) { const { ref } = docSnap; await ref.update({ a: 1 }); }',
        '  for (const { ref: bookRef } of page.docs) await bookRef.update({ b: 2 });',
        '}',
        'export async function param(db, { bookRef, ideaId }) {',
        '  await bookRef.set({ stamp: 1 }, { merge: true });',
        "  await bookRef.collection('ideas').doc(ideaId).update({ lastEntryAttempt: 1 });",
        '  return db.runTransaction(async (tx) => { tx.update(bookRef, { revision: 2 }); });',
        '}',
        'export async function ctxProp(ctx) { await ctx.bookRef.set({ a: 1 }); }',
        'export function notARef(k) { const byRef = new Map(); byRef.set(k, 1); const seenDoc = new Set(); seenDoc.add(k); return byRef; }',
      ],
    });
    expect(r.counts).toEqual({
      'api/f.js::fromSnap::update::mandates': 2,
      'api/f.js::param::set::unresolved': 1,    // visible: the destructured book ref, written directly
      'api/f.js::param::update::ideas': 1,      // by the collection its chain names
      'api/f.js::param::update::unresolved': 1, // through the transaction
      'api/f.js::ctxProp::set::unresolved': 1,
    });
    // A Map and a Set with ref-like names are not sites at all.
    expect(r.sites.filter((s) => s.fn === 'notARef')).toEqual([]);
  });

  it('HELPER forms: the B3-EXT one-hop helper with a money ref at its call site, and a ref BUILDER (same file, and imported)', () => {
    const r = scanSynthetic({
      'api/helper.js': [
        "const BOOKS = 'mandates';",
        "export const NOMINATIONS = 'nominations';",
        'export function writeThrough(ref, data) { return ref.set(data); }',
        "export function coverageRefOf(db) { return db.collection('practiceFieldCoverage').doc('current'); }",
        'export const nominationRefOf = (db, b, n) => db.collection(BOOKS).doc(b).collection(NOMINATIONS).doc(n);',
        "export const logRefOf = (db, id) => db.collection('shadowLogs').doc(id);",
      ],
      'api/caller.js': [
        "import { writeThrough, coverageRefOf, nominationRefOf, logRefOf, NOMINATIONS } from './helper.js';",
        "export async function save(db, d) { await writeThrough(db.collection('mandates').doc('x'), d); }",
        "export async function saveIdea(db, bookRef, d) { await writeThrough(bookRef.collection('ideas').doc('i'), d); }",
        "export async function savePlain(db, d) { await writeThrough(db.collection('shadowLogs').doc('x'), d); }",
        'export async function built(db) {',
        '  const coverageDocRef = coverageRefOf(db);',
        '  return db.runTransaction(async (tx) => {',
        '    tx.set(coverageDocRef, {});',
        "    tx.set(nominationRefOf(db, 'b', 'n'), {});",
        "    tx.set(logRefOf(db, 'l'), {});",
        '  });',
        '}',
        "export async function imported(db, b) { await db.collection('mandates').doc(b).collection(NOMINATIONS).doc('n').delete(); }",
        "export async function builtDirect(db) { await logRefOf(db, 'l').set({}); await coverageRefOf(db).set({}); }",
      ],
    });
    expect(r.counts).toEqual({
      'api/helper.js::writeThrough::set::param:ref': 1,
      'api/caller.js::save::call:writeThrough#0::mandates': 1,
      'api/caller.js::saveIdea::call:writeThrough#0::ideas': 1,
      'api/caller.js::built::set::practiceFieldCoverage': 1, // a PROTECTED store, through an imported builder
      'api/caller.js::built::set::nominations': 1,
      'api/caller.js::built::set::unresolved': 1,            // a handle write to a non-listed store: as before
      'api/caller.js::imported::delete::nominations': 1,     // a collection named by an imported constant
      'api/caller.js::builtDirect::set::practiceFieldCoverage': 1,
    });
    expect(passes(r, 'api/caller.js::savePlain::call:writeThrough#0::shadowLogs')).toBe(true);
    expect(passes(r, 'api/caller.js::builtDirect::set::shadowLogs')).toBe(true);
  });

  it('ONE call site, more than one store; a reassigned ref; and every write through a helper parameter counts', () => {
    const r = scanSynthetic({
      'api/g.js': [
        'export async function closeLike(db, mandateRef) {',
        '  const writes = [];',
        "  writes.push([mandateRef.collection('decisions').doc('d'), {}]);",
        "  writes.push([mandateRef.collection('corporateActions').doc('c'), {}]);",
        '  return db.runTransaction(async (tx) => { for (const [ref, doc] of writes) tx.set(ref, doc); });',
        '}',
        'export async function reassigned(db, id, on) {',
        '  let recordRef = null;',
        "  if (on) recordRef = db.collection('mandates').doc(id).collection('nominations').doc('n');",
        '  return db.runTransaction(async (tx) => { if (recordRef) tx.set(recordRef, {}); });',
        '}',
        'export async function twice(agentRef) { await agentRef.update({ a: 1 }); await agentRef.update({ b: 2 }); }',
      ],
    });
    expect(r.counts).toEqual({
      'api/g.js::closeLike::set::corporateActions+decisions': 1,
      'api/g.js::reassigned::set::nominations': 1,
      'api/g.js::twice::update::param:agentRef': 2, // before T1A-07 the second write did not change the count
    });
  });

  describe('IS-4 (lens 3) — a handle under any name, a callback passed by name, a bulk writer, `.parent`, recursiveDelete', () => {
    /** Every site of one function, as the store it is keyed by: [] = the scan does not see a write there at all. */
    const storesOf = (r, fn) => r.sites.filter((s) => s.fn === fn).map((s) => s.collection ?? 'unresolved');

    it('the floor and the helper pass are untouched: the five write methods are the five, and recursiveDelete is read apart', () => {
      expect([...WRITE_METHODS]).toEqual(['set', 'update', 'create', 'delete', 'add']);
      expect([...REF_ARGUMENT_WRITE_METHODS]).toEqual(['recursiveDelete']);
    });

    it('V1 / V8 — the own-parameter pair: a handle handed in under any name, writing a ref-named parameter of the same function', () => {
      const r = scanSynthetic({
        'api/h.js': [
          'function apply(t, bookRef) { t.update(bookRef, { revision: 2 }); }',
          'export async function v1(db, bookRef) { await db.runTransaction((tx) => apply(tx, bookRef)); }',
          'export function v8(b, bookRef) { b.update(bookRef, {}); b.delete(bookRef); }',
          'export const arrow = (w, ideaDoc) => w.create(ideaDoc, {});',
          'export function destructuredRef(t, { bookRef, n }) { t.set(bookRef, { n }); }',
          // OVER-LISTED, and said so in the header: a Map handed in beside a ref-named parameter and keyed by it
          'export function mapHandedIn(seen, docRef) { seen.set(docRef, 1); }',
          // NOT a pair, and not a Firestore write: a Map the function declares, or one it was handed in a destructured
          // parameter; a first argument that is not a ref-named parameter (a key, a string, a ref's path, a
          // property); `add`; a model client; FieldValue.delete().
          'export function notPairs(m, k, bookRef, list, headers, { cache }) {',
          '  const byRef = new Map(); byRef.set(bookRef, 1); byRef.delete(bookRef);',
          "  m.set(k, bookRef); m.delete(k); headers.set('x-ref', 'a'); list.add(bookRef);",
          '  cache.set(bookRef, 1); m.set(bookRef.path, 1); m.set(k.docRef, 1);',
          "  const params = new URLSearchParams(); params.set('doc', k);",
          '  return [1, 2].concat(k);',
          '}',
          "export async function model(client, FieldValue) { await client.messages.create({ model: 'm' }); return { gone: FieldValue.delete() }; }",
        ],
      });
      expect(r.counts).toEqual({
        'api/h.js::apply::update::unresolved': 1,       // V1: the handle arrives as `t`
        'api/h.js::v8::update::unresolved': 1,          // V8: a batch handed in as `b`
        'api/h.js::v8::delete::unresolved': 1,
        'api/h.js::arrow::create::unresolved': 1,
        'api/h.js::destructuredRef::set::unresolved': 1,
        'api/h.js::mapHandedIn::set::unresolved': 1,    // the scan cannot tell this Map from a handle
      });
      expect(storesOf(r, 'notPairs')).toEqual([]);
      expect(storesOf(r, 'model')).toEqual([]);
      expect(storesOf(r, 'v1')).toEqual([]); // the caller of `apply` is not followed (no helper is registered): a limit
    });

    it('V2 — a transaction callback DEFINED SEPARATELY and passed by name: its first parameter is a handle', () => {
      const r = scanSynthetic({
        'api/body.js': ['export async function importedBody(t) { t.delete(somewhere()); }'],
        'api/i.js': [
          "import { importedBody } from './body.js';",
          'export async function namedConst(db, book) {',
          '  const body = async (t) => { t.update(book, { revision: 2 }); };',
          '  await db.runTransaction(body);',
          '}',
          'export async function namedDeclaration(db) {',
          "  const page = await db.collection('mandates').get();",
          '  async function work(trx) { for (const d of page.docs) trx.update(d.ref, {}); trx.set(somewhere(db), {}); }',
          '  return db.runTransaction(work);',
          '}',
          'export const runImported = (db) => db.runTransaction(importedBody);',
          // the same shape handed to something that is not runTransaction: `t` is nothing, and `x` is not ref-named
          'export async function notATransaction(db, x) {',
          '  const body = async (t) => { t.update(x, {}); };',
          '  await db.withRetries(body);',
          '}',
        ],
      });
      expect(r.counts).toEqual({
        'api/i.js::body::update::unresolved': 1,          // namedConst's `body` only — not notATransaction's
        'api/i.js::work::update::mandates': 1,
        'api/i.js::work::set::unresolved': 1,
        'api/body.js::importedBody::delete::unresolved': 1, // judged in the file that declares it
      });
    });

    it('V3 — a bulk writer: `const w = db.bulkWriter()` (or assigned), the name `bulkWriter`, the call inline', () => {
      const r = scanSynthetic({
        'api/j.js': [
          'export async function drain(db, things) {',
          '  const w = db.bulkWriter();',
          "  const page = await db.collection('mandates').where('status', '==', 'draining').get();",
          '  for (const d of page.docs) w.update(d.ref, { status: 1 });',
          '  for (const thing of things) w.delete(thing);',
          '  await w.close();',
          '}',
          'export async function assigned(db, thing) { let w = null; w = db.bulkWriter(); w.set(thing, {}); await w.flush(); }',
          'export function byName(bulkWriter, thing) { bulkWriter.create(thing, {}); }',
          'export async function inline(db, thing) { await db.bulkWriter().set(thing, {}); }',
          // not a bulk writer; and `add` is not one of a bulk writer's methods
          'export async function notBulk(db, thing) { const w = db.makeWriter(); w.update(thing, {}); w.add(thing); }',
          'export async function bulkAdd(db, thing) { const w = db.bulkWriter(); w.add(thing); await w.close(); }',
        ],
      });
      expect(r.counts).toEqual({
        'api/j.js::drain::update::mandates': 1,
        'api/j.js::drain::delete::unresolved': 1, // a handle write never passes, whatever its argument is called
        'api/j.js::assigned::set::unresolved': 1,
        'api/j.js::byName::create::unresolved': 1,
        'api/j.js::inline::set::unresolved': 1,
      });
      expect(storesOf(r, 'notBulk')).toEqual([]);
      expect(storesOf(r, 'bulkAdd')).toEqual([]);
    });

    it('V4 — a write through `.parent` is a ref the scan could not resolve: listed, never passed under a literal beneath it', () => {
      const r = scanSynthetic({
        'api/k.js': [
          'export async function fromGroup(db) {',
          "  const s = await db.collectionGroup('ideas').get();",
          '  for (const d of s.docs) await d.ref.parent.parent.update({ a: 1 });',
          '}',
          'export async function viaConst(idea) { const book = idea.ref.parent.parent; await book.update({ a: 1 }); }',
          'export async function destructured(snap) { const { parent } = snap.ref; await parent.parent.set({}); }',
          // the floor sees these chains and names `notes` — which is not where they write
          "export async function floorSeen(db, b, d) { await db.collection('shadowLogs').doc(b).collection('notes').doc(d).parent.parent.update({}); }",
          'export async function floorSeenConst(db, b, d) {',
          "  const up = db.collection('shadowLogs').doc(b).collection('notes').doc(d).parent.parent;",
          '  await up.update({});',
          '}',
          'export async function reassigned(db, b, d, on) {',
          "  let up = db.collection('shadowLogs').doc(b).collection('notes').doc(d).parent.parent;",
          "  if (on) up = db.collection('shadowLogs').doc(b);",
          '  await up.update({});',
          '}',
          "export async function sibling(db, x, y) { await db.collection('shadowLogs').doc(x).parent.doc(y).update({}); }",
          "export function handleArgument(w, db, b, d) { w.update(db.collection('shadowLogs').doc(b).collection('notes').doc(d).parent.parent, {}); }",
          // a `.collection('<lit>')` above the `.parent` step names the leaf again: listed by it, or passed by it
          "export async function down(d) { await d.ref.parent.parent.collection('ideas').doc('i').set({}); }",
          "export async function downPlain(d) { await d.ref.parent.parent.collection('notes').doc('n').set({}); }",
          "export async function noParent(db, b, d) { await db.collection('shadowLogs').doc(b).collection('notes').doc(d).update({}); }",
          // `.parent` hands evidence on; it makes none
          "export function tree(node) { node.parent.set('k', 1); node.parent.children.delete(node); }",
        ],
      });
      expect(r.counts).toEqual({
        'api/k.js::fromGroup::update::unresolved': 1,
        'api/k.js::viaConst::update::unresolved': 1,
        'api/k.js::destructured::set::unresolved': 1,
        'api/k.js::floorSeen::update::unresolved': 1,
        'api/k.js::floorSeenConst::update::unresolved': 1,
        'api/k.js::reassigned::update::unresolved': 1,
        'api/k.js::sibling::update::unresolved': 1, // over-listed (it writes shadowLogs): the scan does not count parents
        'api/k.js::handleArgument::update::unresolved': 1, // the floor took the write from its argument, and named `notes`
        'api/k.js::down::set::ideas': 1,
      });
      expect(passes(r, 'api/k.js::downPlain::set::notes')).toBe(true); // the limit of record: an unknown leaf under an opaque book
      expect(passes(r, 'api/k.js::noParent::update::notes')).toBe(true);
      expect(storesOf(r, 'tree')).toEqual([]);
    });

    it('V7 — db.recursiveDelete(ref): a write that takes its ref as an argument, on any base', () => {
      const r = scanSynthetic({
        'api/l.js': [
          "export async function wipeBook(db, id) { await db.recursiveDelete(db.collection('mandates').doc(id)); }",
          "export async function wipeIdeas(db, bookRef) { await db.recursiveDelete(bookRef.collection('ideas')); }",
          'export async function wipeOpaque(admin, thing) { await admin.firestore().recursiveDelete(thing); }',
          "export async function wipeSibling(db, d) { await db.recursiveDelete(d.ref.parent.doc('summary')); }",
          "export async function wipePlain(db, id) { await db.recursiveDelete(db.collection('shadowLogs').doc(id)); }",
        ],
      });
      expect(r.counts).toEqual({
        'api/l.js::wipeBook::recursiveDelete::mandates': 1,
        'api/l.js::wipeIdeas::recursiveDelete::ideas': 1,
        'api/l.js::wipeOpaque::recursiveDelete::unresolved': 1, // always a site: the name is Firestore's alone
        'api/l.js::wipeSibling::recursiveDelete::unresolved': 1,
      });
      expect(passes(r, 'api/l.js::wipePlain::recursiveDelete::shadowLogs')).toBe(true);
    });

    it('LIMITS OF RECORD, kept executable: what the scan still cannot see — every one of these writes the book and passes today', () => {
      // If an expectation here ever flips, rewrite the "STILL NOT SEEN" list in compositionProtectedStoresScan.js
      // in the same PR. (V10 — a new subcollection under an opaque book ref — is the BOOK-REF LEAF row above.)
      const BOOK = "db.collection('mandates').doc(id)";
      const r = scanSynthetic({
        'api/refs.js': [
          `export const bookRefOf = (db, id) => ${BOOK};`,
          `export default (db, id) => ${BOOK};`,
        ],
        'api/index.js': ["export { bookRefOf } from './refs.js';"],
        'api/n.js': [
          "import * as refs from './refs.js';",
          "import bookOf from './refs.js';",
          "import { bookRefOf } from './index.js';",
          "import { bookRefOf as noExtension } from './refs';",
          // V5: refs mapped out of a query, under a name that is not ref-like
          "export async function v5(db) { const page = await db.collection('mandates').get(); const books = page.docs.map((d) => d.ref); await Promise.all(books.map((b) => b.update({}))); }",
          // V6: the ref carried on an object property that is not ref-named
          `export async function v6(db, id) { const ctx = { book: ${BOOK} }; await ctx.book.update({}); }`,
          // V9: a helper whose parameter is not ref-named — its definition, and so its call sites
          'function write(target, d) { return target.update(d); }',
          `export async function v9(db, id) { await write(${BOOK}, 1); }`,
          // V1/V8 outside the own-parameter pair, under a handle name the scan does not know: a ref argument that is
          // not ref-named; one that is not a parameter of the same function (a query's document, a property, a
          // parameter of an enclosing function)
          'function applyTo(t, r) { t.update(r, {}); }',
          `export async function unnamedArgument(db, id) { const held = ${BOOK}; await db.runTransaction((tx) => applyTo(tx, held)); }`,
          "export async function queryArgument(w, db) { const page = await db.collection('mandates').get(); for (const snap of page.docs) w.update(snap.ref, {}); }",
          'export function propertyArgument(w, ctx) { w.set(ctx.bookRef, {}); }',
          'export const enclosingParameter = (bookRef) => (t) => t.update(bookRef, {});',
          // a ref builder reached through a namespace import, a default import, a re-export, an import with no
          // file extension, an object's method
          'export async function namespaceBuilder(db, id) { await refs.bookRefOf(db, id).update({}); }',
          'export async function defaultBuilder(db, id) { await bookOf(db, id).update({}); }',
          'export async function reexportedBuilder(db, id) { await bookRefOf(db, id).update({}); }',
          'export async function noExtensionBuilder(db, id) { await noExtension(db, id).update({}); }',
          `const make = { book: (db, id) => ${BOOK} };`,
          'export async function methodBuilder(db, id) { await make.book(db, id).update({}); }',
          // listDocuments(), a Map of refs, a parameter's default value
          "export async function listed(db) { const found = await db.collection('mandates').listDocuments(); for (const r of found) await r.update({}); }",
          `export async function mapOfRefs(db, id) { const m = new Map(); m.set('k', ${BOOK}); await m.get('k').update({}); }`,
          `export async function defaultValue(db, id, book = ${BOOK}) { await book.update({}); }`,
          // a chain wrapped in a call or a comma, a computed method name
          `export async function iife(db, id) { await (() => ${BOOK})().update({}); }`,
          `export async function comma(db, id) { await (0, ${BOOK}).update({}); }`,
          `export async function computedMethod(db, id) { const m = 'upd' + 'ate'; await ${BOOK}[m]({}); }`,
          // a transaction callback that reaches runTransaction through a second name, a call, or .bind
          'export async function indirectCallback(db, thing) {',
          '  const indirect = async (t) => { t.update(thing, {}); };',
          '  const again = indirect; const give = () => indirect;',
          '  await db.runTransaction(again); await db.runTransaction(give()); await db.runTransaction(indirect.bind(null));',
          '}',
          // a bulk writer or a batch from a builder (the local name is not a parameter: no pair); recursiveDelete
          // taken off its base
          'const writerOf = (db) => db.bulkWriter();',
          'export async function builtWriter(db, thing) { const w = writerOf(db); w.update(thing, {}); await w.close(); }',
          'const batchOf = (db) => db.batch();',
          'export async function builtBatch(db, bookRef) { const wb = batchOf(db); wb.update(bookRef, {}); await wb.commit(); }',
          'export async function extractedRecursiveDelete(db, thing) { const wipe = db.recursiveDelete.bind(db); await wipe(thing); }',
          "export async function computedRecursiveDelete(db, thing) { const m = 'recursive' + 'Delete'; await db[m](thing); }",
          // the rest of the header's list
          'export async function mappedParameter(books) { await Promise.all(books.map((b) => b.update({}))); }',
          `export async function mappedValues(db, id) { const held = { a: ${BOOK} }; await Promise.all(Object.values(held).map((b) => b.update({}))); }`,
          `export async function mappedIds(db, ids) { const books = ids.map((id) => ${BOOK}); await Promise.all(books.map((b) => b.update({}))); }`,
          'export class Store { constructor(r) { this.book = r; } async save() { await this.book.update({}); } }',
          `export async function fromLiteral(db, id) { const { book } = { book: ${BOOK} }; await book.update({}); }`,
          `export async function byAssignment(db, id) { let book; ({ book } = { book: ${BOOK} }); await book.update({}); }`,
          'export async function destructuredParameter({ book }) { await book.update({}); }',
          'export function batchHandedIn(b, book) { b.update(book, {}); }',
          'export function writerHandedIn(writer, thing) { writer.update(thing, {}); }',
          'export async function memberCallback(db, thing) { const jobs = { run: async (t) => { t.update(thing, {}); } }; await db.runTransaction(jobs.run); }',
          'export async function parentOfNothing(thing) { await thing.parent.update({}); }',
          // a ref builder reached through a dynamic import; a ref-named PRIVATE class field (fourth refuter pass)
          "export async function dynamicBuilder(db, id) { const { bookRefOf: viaImport } = await import('./refs.js'); await viaImport(db, id).update({}); }",
          'export class Vault { #bookRef; constructor(r) { this.#bookRef = r; } async save() { await this.#bookRef.update({}); } }',
        ],
        // SEEN, and passes: a parameter that shares its name with a same-file const chain to a non-listed store
        'api/shared.js': [
          "export async function other(db) { const bookRef = db.collection('shadowLogs').doc('x'); await bookRef.set({ a: 1 }); }",
          'export async function sharedName(bookRef) { await bookRef.update({}); }',
        ],
        // files the scan does not walk
        'api/notWalked.test.helper.js': [`export async function m06(db, id) { await ${BOOK}.update({ 'portfolio.cash': 1 }); }`],
        'api/notWalked.cjs': [`module.exports = async function m06(db, id) { await ${BOOK}.update({ 'portfolio.cash': 1 }); };`],
      });
      // nothing needs listing…
      expect(r.counts).toEqual({});
      // …and outside shared.js not one of them is a site at all
      expect(r.sites.filter((s) => s.file !== 'api/shared.js').map(siteKey)).toEqual([]);
      expect(passes(r, 'api/shared.js::sharedName::update::shadowLogs')).toBe(true);
      // (the forms are really there: the file was parsed, and it holds the writes)
      expect(storesOf(r, 'other')).toEqual(['shadowLogs']);
    });
  });

  describe('IS-5 (lens 3) — the callers of the idea book\'s write entry points, pinned by name', () => {
    const tally = (records, keyOf) => {
      const counts = {};
      for (const rec of records) counts[keyOf(rec)] = (counts[keyOf(rec)] ?? 0) + 1;
      return counts;
    };
    const callKey = (c) => `${c.file}::${c.fn}::${c.name}`;

    it('THE REAL TREE: exactly these functions call them, this many times — a new caller anywhere fails here (this row stands in for the lost `call:closeIdeaBook#1` key)', () => {
      // closeIdeaBook, catchUpIdeaBook and the passes hand the book ref they were given to the function that
      // writes: from THEIR callers that is a second hop, which the write scan does not follow, so no allowlist key
      // counts those callers (the base tree had `api/cron/mandate-evaluate.js::runCloseSweep::call:closeIdeaBook#1`;
      // it went when closeIdeaBook stopped writing through its own parameter). The writes themselves are keyed in
      // close.js, exits.js and entry.js. A change below is a new way into the idea book's money: review the caller.
      expect(IDEA_BOOK_WRITE_ENTRY_POINTS).toEqual([
        'closeIdeaBook', 'catchUpIdeaBook', 'runIdeaBookSalesPass', 'runIdeaBookEntryPass', 'sellPendingHoldings',
        'enterIdea', 'runIdeaBookWindow', 'runIdeaBookEvalPass', 'runDrainingIdeaBookCloses',
      ]);
      const { calls, definitions, references, moduleHandles } = SCAN.entryPoints;
      const PF = 'api/_utils/practiceField';
      expect(tally(calls, callKey)).toEqual({
        // the quarterly engine's cron: the eval sweep's idea-book pass; the close sweep's idea book and draining books
        'api/cron/mandate-evaluate.js::runEvalSweep::runIdeaBookEvalPass': 1,
        'api/cron/mandate-evaluate.js::runCloseSweep::closeIdeaBook': 1,
        'api/cron/mandate-evaluate.js::runCloseSweep::runDrainingIdeaBookCloses': 1,
        // the sweep: one book at one window (catch-up, sales, entries), the pass over the books, the draining closes
        [`${PF}/sweep.js::runIdeaBookWindow::catchUpIdeaBook`]: 1,
        [`${PF}/sweep.js::runIdeaBookWindow::runIdeaBookSalesPass`]: 1,
        [`${PF}/sweep.js::runIdeaBookWindow::runIdeaBookEntryPass`]: 1,
        [`${PF}/sweep.js::runIdeaBookEvalPass::runIdeaBookWindow`]: 1,
        [`${PF}/sweep.js::runDrainingIdeaBookCloses::closeIdeaBook`]: 1,
        // each pass and the transaction it runs per idea
        [`${PF}/exits.js::runIdeaBookSalesPass::sellPendingHoldings`]: 1,
        [`${PF}/entry.js::runIdeaBookEntryPass::enterIdea`]: 1,
        // TEST SUPPORT (not a `.test.` file, so it is scanned): the fixtures the Practice Field suites drive
        [`${PF}/__testsupport__/fixtures.js::enterIdeaWith::enterIdea`]: 1,
        [`${PF}/__testsupport__/fixtures.js::entryPassWith::runIdeaBookEntryPass`]: 1,
        [`${PF}/__testsupport__/fixtures.js::enterAt::enterIdea`]: 1,
        [`${PF}/__testsupport__/fixtures.js::windowAt::runIdeaBookWindow`]: 1,
        [`${PF}/__testsupport__/fixtures.js::closeOn::closeIdeaBook`]: 1,
      });
      // where each is defined — close.js calls none of them (closeNextSession, which it does call, is a keyed helper)
      expect(definitions.map((d) => `${d.file}::${d.name}`).sort()).toEqual([
        `${PF}/close.js::catchUpIdeaBook`,
        `${PF}/close.js::closeIdeaBook`,
        `${PF}/entry.js::enterIdea`,
        `${PF}/entry.js::runIdeaBookEntryPass`,
        `${PF}/exits.js::runIdeaBookSalesPass`,
        `${PF}/exits.js::sellPendingHoldings`,
        `${PF}/sweep.js::runDrainingIdeaBookCloses`,
        `${PF}/sweep.js::runIdeaBookEvalPass`,
        `${PF}/sweep.js::runIdeaBookWindow`,
      ]);
      // …and no way to call one without a call of its name appearing
      expect(references.map((x) => `${callKey(x)} (line ${x.line})`)).toEqual([]);
      expect(moduleHandles.map((x) => `${x.file}: ${x.kind} of ${x.module}`)).toEqual([]);
    });

    it('a new caller is reported in every form: by name, through an import alias, as a member call, as a value, through the whole module', () => {
      const CLOSE = 'api/_utils/practiceField/close.js';
      const r = scanSynthetic({
        [CLOSE]: [
          'export async function closeIdeaBook(db, bookRef) { return [db, bookRef]; }',
          'export const catchUpIdeaBook = async (db, bookRef) => [db, bookRef];',
        ],
        'api/cron/newCaller.js': [
          "import { closeIdeaBook as shut, catchUpIdeaBook } from '../_utils/practiceField/close.js';",
          'export async function direct(db, ref) { await catchUpIdeaBook(db, ref); await catchUpIdeaBook(db, ref); }',
          'export async function aliased(db, ref) { return shut(db, ref); }',
          "export async function member(deps, db, ref) { await deps.closeIdeaBook(db, ref); await deps['enterIdea'](db, {}); }",
          'export const asValue = (books) => books.map(shut);',
          'export const inObject = { closeIdeaBook: shut };',
        ],
        'api/cron/wholeModule.js': [
          "import * as close from '../_utils/practiceField/close.js';",
          "import everything from '../_utils/practiceField/close.js';",
          "import * as unrelated from './newCaller.js';",
          "export { catchUpIdeaBook } from '../_utils/practiceField/close.js';",
          "export const lazy = async () => import('../_utils/practiceField/close.js');",
          'export const used = [close, everything, unrelated];',
        ],
        // a comment and a string that name the functions are not calls
        'api/cron/quiet.js': [
          '// closeIdeaBook(db, ref) and enterIdea(db, {}) in a comment',
          "export const note = 'closeIdeaBook: db and bookRef required';",
          'export function other(db) { return db; }',
        ],
      });
      const e = r.entryPoints;
      expect(tally(e.calls, callKey)).toEqual({
        'api/cron/newCaller.js::direct::catchUpIdeaBook': 2,
        'api/cron/newCaller.js::aliased::closeIdeaBook': 1, // `shut(…)` is closeIdeaBook
        'api/cron/newCaller.js::member::closeIdeaBook': 1,
        'api/cron/newCaller.js::member::enterIdea': 1,
      });
      expect(e.definitions.map((d) => `${d.file}::${d.name}`).sort()).toEqual([`${CLOSE}::catchUpIdeaBook`, `${CLOSE}::closeIdeaBook`]);
      expect(tally(e.references, callKey)).toEqual({
        'api/cron/newCaller.js::asValue::closeIdeaBook': 1, // handed to .map
        'api/cron/newCaller.js::<top>::closeIdeaBook': 2,   // an object's key and its value
      });
      expect(e.moduleHandles.map((x) => `${x.file}: ${x.kind} of ${x.module}`).sort()).toEqual([
        `api/cron/wholeModule.js: default import of ${CLOSE}`,
        `api/cron/wholeModule.js: dynamic import of ${CLOSE}`,
        `api/cron/wholeModule.js: namespace import of ${CLOSE}`,
        `api/cron/wholeModule.js: re-export of ${CLOSE}`,
      ]);
    });
  });
});
