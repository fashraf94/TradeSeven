// api/_utils/compositionProtectedStoresScan.js
//
// Composition PR 3 — ledger item B3 (TEST FORM): the deny-by-default
// protected-store write scan. Parses every non-test .js under api/ + scripts/
// (acorn, real AST — not a token grep) and finds every Firestore-shaped WRITE
// call (set/update/create/delete/add, incl. tx.*/batch.* variants). A site is
// legal only if its key appears in compositionProtectedStoresAllowlist.json —
// a NEW write site against a protected store (or one the scan cannot resolve)
// fails CI until a human enumerates it. This INVERTS the census ratchet:
// before B3 a writer had to match a known token to be caught; now a write
// site is illegal until allowlisted.
//
// Scope ruling (founder, Aug 6): the test form ONLY — no capability-module
// refactor. The scanner is also the §8 runbook step-0 instrument (re-run at
// the deployed SHA).
//
// B3-EXT (PR 4, ledger row): ONE-LEVEL HELPER-PARAMETER DATA-FLOW. A function
// whose OWN parameter flows into a write method — `function f(ref){ ref.set(…) }`
// (callee-base form) or `function f(tx, r){ tx.set(r, …) }` (handle ref-argument
// form) — is itself a scanned WRITE-HELPER: its definition is a listed site
// (collection `param:<name>`, unless the same call is already visible to the
// direct pass — one site per WRITE through the parameter since T1A-07; before,
// only the first per function, parameter and method was counted), and EVERY
// call site of the helper is scanned — the argument at the flowing param index
// resolves through the same chain logic, and a call passing a protected-store,
// money-store or unresolvable ref must be allowlisted at its per-callsite
// count (`call:<helper>#<idx>` keys). Exactly one hop, per the ruling — NOT
// full data-flow analysis, NOT the capability refactor.
//
// T1A-07 (Practice Field T1a-2a; Astra's finding and her mutant M06): THE MONEY
// STORE. Before this, `mandates` and everything under a book resolved to "a
// non-protected literal" and passed UNLISTED — the money writes were on the
// allowlist only where a transaction handle happened to make them
// 'unresolved'. Now a write needs listing when ANY collection segment of its
// resolved PATH is a money root (MONEY_ROOT_COLLECTIONS: `mandates`) or a
// money subcollection (MONEY_SUBCOLLECTIONS: what is written under a book).
// To see those paths the scan gained a second resolver (below), which also
// follows a transaction handle's ref ARGUMENT, query-derived refs and
// destructured refs.
//
// IS-4 and IS-5 (lens 3 of the T1a-2a review, 13 Nov 2026). The review planted
// writes to `mandates/{id}` that passed the suite. Five forms are sites now —
// each is described where it belongs in the model below, and each has a row in
// the scan test with a control beside it:
//   - a handle handed in under a name the scan does not know, writing a
//     ref-named parameter of the same function — `function apply(t, bookRef)
//     { t.update(bookRef, …) }`, `function f(b, bookRef) { b.update(bookRef,
//     …) }`: the own-parameter pair (V1, V8);
//   - a transaction callback defined separately and passed BY NAME (V2);
//   - a bulk writer (V3);
//   - a write through `.parent` (V4) — the header said such a ref was reported
//     as one the scan could not resolve, and it was not;
//   - `recursiveDelete(ref)` (V7).
// On the tree of 13 Nov 2026 this listed no new site and lost none (old scanner
// against new, site by site): the tree holds no write these five rules list.
// What is still not seen is listed once, under STILL NOT SEEN at the foot of
// this header.
// IS-5: the callers of the idea book's write entry points are a second hop,
// which the scan does not follow; since closeIdeaBook stopped writing through
// its own parameter no allowlist key counts them (the base tree's
// `api/cron/mandate-evaluate.js::runCloseSweep::call:closeIdeaBook#1` is
// gone). They are pinned BY NAME instead: the scan returns `entryPoints`
// (namedEntryPoints, below) and the scan test's IS-5 row pins every caller by
// file, function and count. That row replaces the lost key.
//
// RESOLUTION MODEL (documented so the allowlist reads honestly). There are TWO
// resolvers, and the first is the floor:
//
//   THE FLOOR (unchanged since B3 — `chainInfo`). It follows the callee chain
//   (and, when the callee is not Firestore-shaped, the first argument's chain)
//   looking for the nearest `.collection('<literal>')`. Identifier refs resolve
//   through same-file `const x = <chain>` declarations, by NAME (file-wide,
//   last declaration wins), up to three hops.
//   - Firestore-shaped = the chain contains .collection()/.doc()/.batch()/
//     .runTransaction(), or the base identifier looks like a transaction/
//     batch handle. Map#set etc. never qualify.
//   - A shaped write whose collection is a PROTECTED name, or is not resolved
//     ('unresolved'), must be allowlisted. A shaped write that resolves to a
//     non-protected literal passes without listing — UNLESS that literal, or
//     the path the resolver below finds, holds money.
//   - A site the floor lists is NEVER unlisted by the path resolver. The path
//     resolver can only re-key it (to the store it found) or add sites. Every
//     site carries `legacyListed`; the suite pins that each one is listed.
//
//   THE PATH RESOLVER (T1A-07 — `resolvePath`). Scope-aware (a name resolves
//   to the declaration whose scope encloses the use, innermost first). It
//   returns every collection literal on the path, root to leaf, and follows:
//   - const/let initialisers and plain assignments (`let r = null; r = <ref>`),
//     any number of hops (cycle- and budget-guarded);
//   - `.collection('<lit>')`, `.collectionGroup('<lit>')`, a slash path
//     (`.collection('mandates/x/ideas')`, `db.doc('mandates/x')`), and a
//     collection named by a string CONSTANT declared in the same file or
//     imported (`import { X } from './relative.js'`) from a scanned file;
//   - QUERY-DERIVED refs: `.where/.orderBy/.limit/…/.get()` pass the path on,
//     and so do `.docs`, `[i]`, `.ref`, `.filter/.slice/.sort/.reverse/
//     .concat`, a `for (const d of X)` variable, and the first parameter of a
//     `.forEach/.map/.filter/.find/.some/.every/.flatMap` callback on X;
//   - DESTRUCTURING: `const { ref } = snap`, `const { ref: r } = snap`,
//     `const [first] = snap.docs`, `for (const { ref } of page.docs)`;
//   - ARRAY ACCUMULATION: `const docs = []` + `docs.push(...page)` /
//     `docs.push(x)`, and a `for (const [ref, doc] of pairs)` over literal
//     `[ref, doc]` tuples (the tuple's own element);
//   - REF BUILDERS: a call of a function declared in the same file, or
//     imported by a relative specifier from a scanned file, resolves through
//     its `return` expression(s) (arguments are not substituted);
//   - `a ? x : y`, `a || b`, `a ?? b`: both sides. Wherever several sources
//     meet (these, an array's elements, a builder's returns, an initialiser
//     and its assignments) and disagree, the ones that reach a listed store
//     win — all of them: one call site that writes two stores is keyed
//     `a+b` (over-listing is safe); with no listed store among them the
//     value is unresolved.
//   A transaction/batch handle write (`tx.set(ref, …)`) resolves its first
//   ARGUMENT. The first parameter of a `runTransaction(…)` callback is a
//   handle whatever it is named — the callback written inline, or (IS-4)
//   declared apart and passed by name: `const body = async (t) => {…}` or
//   `function body(t) {…}`, then `db.runTransaction(body)`, in the same file or
//   imported by a relative specifier from a scanned one. A BULK WRITER is a
//   handle too (IS-4): `db.bulkWriter()` inline, a name initialised or assigned
//   from it, or anything named `bulkWriter` — for set/update/create/delete.
//   `.parent` (IS-4): the parent of a ref is a ref at a path the resolver does
//   not compute. A chain that steps through `.parent` with ref evidence beneath
//   it is a ref the scan could not resolve; a `.doc()` above it changes
//   nothing, a `.collection('<lit>')` above it names the leaf again. `.parent`
//   hands evidence on and makes none (`node.parent.set(…)` is not a site).
//
//   WHAT THE PATH RESOLVER DOES WITH A PATH:
//   - money on any segment, or a PROTECTED leaf  → the site is listed, keyed
//     by the nearest literal on the path (`mandates`, `ideas`, `rows`,
//     `practiceFieldCoverage`, `agents`). The key names the leaf; the path
//     decides the listing (`path` on the site carries the whole of it).
//   - anything else on a site the floor already sees → the floor's key and
//     the floor's verdict stand, exactly as before.
//   - a write the floor does NOT see (no .collection()/.doc() step on the
//     chain, no handle name) is now a site when it has REF EVIDENCE: its path
//     resolved (query-derived, destructured, built), or its base is ref-named
//     (/^(ref|doc)$|Ref$|Doc$/, an identifier or a property) or it steps
//     through `.ref`. Resolved to a non-listed literal it passes, as a direct
//     chain would; unresolved it is listed ('unresolved'). A base that is
//     provably not a ref (`new Map()`, an object/array literal) is excluded.
//   - (IS-4) THE OWN-PARAMETER PAIR. A write the floor does not see and whose
//     BASE says nothing is a site when the base is a plain parameter and the
//     first ARGUMENT is a ref-named parameter of the SAME function, plain or
//     destructured (`t.update(bookRef, …)` in `function apply(t, bookRef)`), for
//     set/update/create/delete (`add` takes no ref). The ref is a parameter,
//     so the key reads 'unresolved'; no helper is registered, so the callers
//     of such a function are not followed. The rule is this narrow on purpose
//     (the refuter of lens 3 measured it): "any base, a ref-named first
//     argument" lists Maps — `vintageCache.set(book.vintageRef, …)`,
//     `roleByTemp.set(ref, …)`, `reads.set(d.ref.path, …)` — and the pair lists
//     nothing in the tree. A Map handed in as a parameter beside a ref-named
//     parameter and keyed by it (`function f(seen, docRef) { seen.set(docRef,
//     1) }`) IS listed: the scan cannot tell it from a handle, and over-listing
//     is the safe side.
//   - (IS-4) a write through `.parent` never passes under a literal found
//     beneath the `.parent` step (the floor's nearest `.collection('<lit>')`
//     is the child's, not where the write lands): it is listed under a listed
//     store if the floor or the rest of the chain names one, else 'unresolved'.
//   - (IS-4) `<anything>.recursiveDelete(<ref>)` is always a site, method
//     `recursiveDelete` (the name is Firestore's alone): the store its
//     argument names; a resolved non-listed literal passes; anything else is
//     'unresolved'. It is not one of WRITE_METHODS, so the floor, the helper
//     pass and the extraction detector are as they were.
//
//   - B3-EXT callee-base helper detection requires REF EVIDENCE: the param is
//     ref-named (/^(ref|doc)$|Ref$|Doc$/) or the chain between param and write
//     method steps through .doc()/.collection(). The handle ref-argument form
//     needs no name evidence (tx.set(<param>, …) is Firestore by construction).
//   - Helper call sites resolve by binding: a callee identifier defined in the
//     same file, or bound via an `import { x [as y] }` specifier whose imported
//     name is a registered helper. Namespace-member calls (`mod.helper()`) are
//     not resolved (documented limit). The argument resolves through the floor
//     and then the path resolver, as a write does.
//
// DOCUMENTED LIMITS (adversarial review, PR 3 + B3-EXT + T1A-07; the scan is one
// belt among four — the B8 behavioral suite, the A46 census chokepoints, and
// the firestore.rules layer are the others):
//   - The money inventory is a list of NAMES. A NEW subcollection under a book
//     written through an OPAQUE book ref (`bookRef.collection('newThing')`,
//     `bookRef` a parameter) has no money segment on its path and passes
//     unlisted until its name is added to MONEY_SUBCOLLECTIONS. Rooted at
//     `db.collection('mandates')` it is caught by its ancestor. (Executable
//     row in the scan test.)
//   - The ancestor rule is for the money store only. A PROTECTED collection is
//     matched at the LEAF, as before: `agents/{id}/plays` resolves to `plays`
//     and passes unless it is a handle write (then 'unresolved').
//   - A plain function PARAMETER is opaque: `tx.update(bookRef, …)` with
//     `bookRef` a parameter (plain or destructured) stays 'unresolved' —
//     listed, but not named. Call sites are followed one hop (B3-EXT) for a
//     plain parameter only; a DESTRUCTURED parameter (`f(db, { bookRef })`)
//     registers no helper, so its call sites are not scanned — the writes
//     inside the function are listed where they stand.
//   - A TWO-HOP chain (helper passes its param into a second helper that
//     writes) resolves the first helper's call-site argument to 'unresolved' —
//     visible and listed at the call site, but the intermediate hop is not
//     followed (the one-level fallback only).
//   - A callee-base write with NO ref evidence (base named e.g. `target`, bare
//     `.set()` with no .doc()/.collection() step, no `.ref`, no resolvable
//     path) is invisible — the ref-naming convention is repo-wide, and the
//     census chokepoints cover the known helper surfaces.
//   - A handle BY POSITION (`runTransaction(async (t) => …)`) is listed like
//     `tx.` only where the floor did not already take the write from its ref
//     argument: `t.update(battleRef, …)` with `battleRef` a same-file const
//     chain to a non-listed literal passes, as it did before.
//   - The FLOOR resolves a name FILE-WIDE (the last `const x = …` in the file,
//     whatever function it is in). A write through a PARAMETER that shares its
//     name with such a const takes that const's verdict: named after a const
//     chain to a listed store it is listed (how the Mandate batch transport's
//     health writes are — their `mandateRef` is a parameter); named after one
//     to a non-listed literal it passes, and the scope-aware resolver, which
//     sees only a parameter, does not overrule it.
//   - A resolution that runs out of its step budget is reported as a ref the
//     scan could not resolve (a visible 'unresolved' site), never as nothing.
//     No resolution in the repo comes near the budget today.
//   - Not followed: a destructuring or compound ASSIGNMENT (`({ ref } = x)`,
//     `ref ||= x` — a declaration's initialiser and plain `name = <expr>`
//     assignments are), object properties (`ctx.bookRef` is opaque,
//     ref-named), class fields, re-exports, default and namespace
//     imports, package imports, imports from outside api/ + scripts/ (a
//     constant from src/ stays unresolved), a ref builder's ARGUMENTS, a
//     collection named by a computed expression or by a loop variable over
//     names (`for (const sub of ['rules', 'bundles'])`), and a `let` string.
//     "Not followed" means the value is OPAQUE: the write is still a site
//     when something else gives it away (a `.doc()`/`.collection()` step, a
//     handle, a ref-like name, `.ref`) and INVISIBLE when nothing does — see
//     STILL NOT SEEN.
//   - A DESTRUCTURED/EXTRACTED write method is not invisible (Sol review #10):
//     detectWriteMethodExtractions flags every `const {set} = ref` /
//     `const f = tx.update` pattern as an unresolved site — deny-by-default
//     applies; the repo carries zero occurrences (pinned).
//   - Allowlist keys count SITES per (file, fn, method, collection) — a new
//     write added inside an already-listed tuple changes the pinned COUNT and
//     fails CI (review F3a).
//
// STILL NOT SEEN (lens 3, IS-4; derived by running the review's battery of 81
// planted writes against this scanner, 13 Nov 2026 — each line is a write to
// `mandates/{id}` that passes the suite today, and each is in the scan test's
// LIMITS OF RECORD row unless another row is named):
//   A write is INVISIBLE when nothing about the call says Firestore: its base
//   has no `.doc()`/`.collection()` step, no handle, no resolvable path, no
//   ref-like name and no `.ref`, and the call is not an own-parameter pair.
//   That is what happens to —
//   - a ref under a name that is not ref-like, reached in a way the resolver
//     does not follow: refs mapped out of a query (`const books =
//     page.docs.map((d) => d.ref); books.map((b) => b.update(…))` — V5; the
//     same over a parameter, `Object.values(…)` or `ids.map(…)`); a ref on an
//     object property (`ctx.book.update(…)`, `this.book.update(…)` — V6) or
//     destructured from an object literal or by an assignment; a ref kept in
//     a Map (`m.get('k').update(…)`); a parameter's default value
//     (`book = db.collection('mandates').doc(id)`); a destructured parameter
//     (`{ book }`);
//   - a write helper whose parameter is not ref-named
//     (`function w(target, d) { return target.update(d) }` — V9): neither its
//     definition nor its call sites;
//   - a handle under a name the scan does not know, outside the own-parameter
//     pair: the ref argument is not ref-named (`function f(t, r) { t.update(r,
//     …) }`, `function g(b, book) { b.update(book, …) }`), or it is not a
//     parameter of the same function — a query's document
//     (`w.update(d.ref, …)`), a property (`w.set(ctx.bookRef, …)`), a local
//     const, a parameter of an enclosing function (`(bookRef) => (t) =>
//     t.update(bookRef, …)`) — or the base is not a plain parameter (a local
//     name, a destructured one). Inside the pair the write is listed where it stands,
//     but the CALLERS of such a function are not followed (no helper is
//     registered);
//   - TWO REAL WRITES in the tree, both pass-throughs to `agentBattles` (not
//     the money store, not a protected store), both unchanged from the base
//     tree and found by the refuter of lens 3: a Proxy trap forwarding the
//     transaction's create — `return t.create(r, doc)`, in
//     api/_utils/stockThresholdAdmission.js (the argument `r` is not
//     ref-named and belongs to another function) — and a Proxy trap
//     forwarding a battle ref's update — `target.update(patch)`, in
//     api/cron/agent-evaluate.js (the base is named `target`: the callee-base
//     limit above). Neither is listed, before or after IS-4;
//   - a ref builder reached through a namespace import (`refs.bookRefOf(…)`),
//     a default import, a re-export, an import written without the file's
//     extension, a DYNAMIC import (`const { bookRefOf } = await
//     import('./refs.js')`), or as an object's method — when the result is
//     written directly or held under a name that is not ref-like;
//   - a PRIVATE class field, even a ref-named one (`this.#bookRef.update(…)`):
//     the ref-name rule reads identifiers and public properties only
//     (`this.bookRef.update(…)` IS a site). Both found by the fourth refuter
//     pass; the tree holds no private class field today;
//   - `listDocuments()` results under a name that is not ref-like;
//   - a chain wrapped in a call or a comma (`(() => chain)().update(…)`,
//     `(0, chain).update(…)`); a computed method name (`chain[m](…)`);
//   - a transaction callback that reaches `runTransaction` through a second
//     name (`const again = body`), a call (`runTransaction(make())`), `.bind`
//     or a member (`runTransaction(obj.body)`), when its handle is not
//     tx-named and the write is outside the own-parameter pair;
//   - a batch or a bulk writer returned by a builder function (`const wb =
//     batchOf(db)`, `const w = writerOf(db)`), or handed in under another
//     name and writing outside the own-parameter pair;
//   - `recursiveDelete` taken off its base (`const wipe =
//     db.recursiveDelete.bind(db)`) or called by a computed name;
//   - `.parent` on a base with no ref evidence (`thing.parent.update(…)`).
//   A write is SEEN AND PASSES —
//   - a new subcollection under an opaque book ref, also reached as
//     `x.ref.parent.parent.collection('newThing')` (V10; the first limit
//     above; the BOOK-REF LEAF row and the V4 row);
//   - through a parameter that shares its name with a same-file `const`
//     chain to a non-listed store (the floor's file-wide name rule, above).
//   And a file is NOT WALKED when its name holds `.test.` (a helper named
//   `x.test.helper.js` included) or does not end `.js` / `.mjs` (`.cjs`).

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, posix } from 'node:path';
import { parse } from 'acorn';

export const PROTECTED_COLLECTIONS = new Set([
  'agents', 'rules', 'bundles', 'compiledBuilds',
  'composition', 'compositionCandidateState', 'compositionEpochOverrides',
  'compositionProvisionerLeases', // B2 (PR 4): the provisioner-lease registry — part of the fence surface
  // Huddle S1 (spec V1.1 §3; build report docs/audits/20261107_BUILD_HUDDLE_S1.md): the four new
  // server-written collections, listed so every write site to them is counted against the allowlist.
  'huddles', 'huddleQueue', 'symbolDayEvidence', 'huddleRuns',
  // Practice Field T1a-1 (build report docs/audits/20261113_BUILD_T1A1_T1C_IDEA_BOOK_ACCOUNTING.md §7): the two new
  // server-only collections — the owner's one-open-book claim with the founder-cap registry, and reserved data
  // coverage — listed so every write site to them is counted against the allowlist. Founder sign-off required.
  'practiceFieldBooks', 'practiceFieldCoverage',
]);

// T1A-07 — THE MONEY STORE. The book (`mandates/{bookId}`: the quarterly Mandate book and the Practice Field idea
// book are one collection) and every subcollection the server writes under it. A write is listed when ANY segment
// of its resolved path is one of these — a root by its own name, a subcollection by its leaf name whatever its
// root resolved to (the book ref is usually a parameter or a query result). Every subcollection name below is
// used under `mandates` only in api/ + scripts/ (checked when the list was written, 13 Nov 2026); a name reused
// under another root would be over-listed, never missed.
export const MONEY_ROOT_COLLECTIONS = new Set(['mandates']);
export const MONEY_SUBCOLLECTIONS = new Set([
  'decisions',             // decision receipts — the engine's and the idea book's fills
  'dailyRows',             // the book's daily close rows
  'corporateActions',      // applied corporate actions
  'quarterSummaries',      // the quarterly tenure records (rollover, escape)
  'pendingScoringAppends', // the scoring stream's durable retry markers
  'epochs',                // the idea book's config epochs
  'ideas',                 // the idea book's ideas (contract, ledgers, lines, result)
  'rows',                  // an idea's rows: mandates/{bookId}/ideas/{ideaId}/rows
  'nominations',           // the Film Room's nominations to a book
]);

export const WRITE_METHODS = new Set(['set', 'update', 'create', 'delete', 'add']);
const HANDLE_RE = /^(tx|txn|transaction|batch|writeBatch)$/;
const REF_PARAM_RE = /^(ref|doc)$|Ref$|Doc$/;

// IS-4 (lens 3, 13 Nov 2026). None of the three below is read by the floor, by the write-helper pass or by the
// extraction detector — WRITE_METHODS and HANDLE_RE are theirs and are unchanged.
// The write methods of a HANDLE (a transaction, a batch, a bulk writer): the ref is the first ARGUMENT. `add` is
// not one (`collection.add(data)` takes the data), so `Set#add(doc)` is never read as a handle write.
const HANDLE_WRITE_METHODS = new Set(['set', 'update', 'create', 'delete']);
// A method that takes the ref it writes as its first argument, on any base. The name is Firestore's alone.
export const REF_ARGUMENT_WRITE_METHODS = new Set(['recursiveDelete']);
const BULK_WRITER_NAME_RE = /^bulkWriter$/;

// IS-5 (lens 3). The idea book's write entry points. Each hands the book ref it was given to a function that
// writes, which is a SECOND hop from its own caller — and the scan follows one. Their callers are therefore not
// allowlist keys; they are pinned by name instead (`entryPoints` on the scan's result; the row in the scan test).
export const IDEA_BOOK_WRITE_ENTRY_POINTS = [
  'closeIdeaBook', 'catchUpIdeaBook', 'runIdeaBookSalesPass', 'runIdeaBookEntryPass', 'sellPendingHoldings',
  'enterIdea', 'runIdeaBookWindow', 'runIdeaBookEvalPass', 'runDrainingIdeaBookCloses',
];

// PR-1 transcription FRAGMENTS: bare object-literal data snippets consumed by
// the PR-1 registry-generation pipeline — not parseable JS modules, and they
// contain no executable code. Excluded BY NAME so any NEW unparseable file
// still fails the no-parse-failures row (deny-by-default preserved).
const KNOWN_NON_MODULE_FRAGMENTS = new Set([
  'scripts/composition/cells_C5.js',
  'scripts/composition/cells_C7.js',
]);

const PARSE_OPTIONS = { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true, locations: true };

function walkFiles(repoRoot, rel, out) {
  for (const entry of readdirSync(resolve(repoRoot, rel), { withFileTypes: true })) {
    const p = `${rel}/${entry.name}`;
    if (entry.isDirectory()) {
      // 'scripts/composition/out' is the gitignored report dir; nothing else named 'out' is excluded.
      if (entry.name !== 'node_modules' && p !== 'scripts/composition/out') walkFiles(repoRoot, p, out);
    }
    else if (/\.(js|mjs)$/.test(entry.name) && !entry.name.includes('.test.') && !KNOWN_NON_MODULE_FRAGMENTS.has(p)) out.push(p);
  }
  return out;
}

function* astWalk(node) {
  yield node;
  for (const key of Object.keys(node)) {
    const v = node[key];
    if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === 'string') yield* astWalk(c); }
    else if (v && typeof v.type === 'string') yield* astWalk(v);
  }
}

// THE FLOOR. Descend a callee/argument chain; report {firestoreShaped, collection}.
function chainInfo(node, consts, depth = 0) {
  let shaped = false; let collection = null;
  let cur = node;
  while (cur) {
    if (cur.type === 'CallExpression') {
      const cal = cur.callee;
      if (cal?.type === 'MemberExpression' && !cal.computed && cal.property?.type === 'Identifier') {
        const n = cal.property.name;
        if (n === 'collection' || n === 'doc' || n === 'batch' || n === 'runTransaction') shaped = true;
        if (n === 'collection' && cur.arguments[0]?.type === 'Literal' && typeof cur.arguments[0].value === 'string' && collection === null) {
          collection = cur.arguments[0].value;
        }
        cur = cal.object; continue;
      }
      cur = cal; continue;
    }
    if (cur.type === 'MemberExpression') { cur = cur.object; continue; }
    if (cur.type === 'AwaitExpression' || cur.type === 'ParenthesizedExpression') { cur = cur.argument ?? cur.expression; continue; }
    if (cur.type === 'Identifier') {
      if (HANDLE_RE.test(cur.name)) shaped = true;
      if (collection === null && depth < 3 && consts.has(cur.name)) {
        const sub = chainInfo(consts.get(cur.name), consts, depth + 1);
        shaped = shaped || sub.firestoreShaped;
        collection = sub.collection;
      }
      break;
    }
    break;
  }
  return { firestoreShaped: shaped, collection };
}

// B3-EXT: the terminal base Identifier of a member/call chain (no const hops —
// used to test whether a chain roots at a function PARAMETER).
function chainBaseName(node) {
  let cur = node;
  while (cur) {
    if (cur.type === 'CallExpression') { cur = cur.callee; continue; }
    if (cur.type === 'MemberExpression') { cur = cur.object; continue; }
    if (cur.type === 'AwaitExpression' || cur.type === 'ParenthesizedExpression') { cur = cur.argument ?? cur.expression; continue; }
    if (cur.type === 'Identifier') return cur.name;
    break;
  }
  return null;
}

// B3-EXT: does the chain step through .doc()/.collection() between its base
// and the write method? (Ref evidence for a non-ref-named param.)
function chainHasRefStep(node) {
  let cur = node; let has = false;
  while (cur) {
    if (cur.type === 'CallExpression') {
      const cal = cur.callee;
      if (cal?.type === 'MemberExpression' && !cal.computed
        && (cal.property?.name === 'doc' || cal.property?.name === 'collection')) has = true;
      cur = cal?.type === 'MemberExpression' ? cal.object : cal; continue;
    }
    if (cur.type === 'MemberExpression') { cur = cur.object; continue; }
    if (cur.type === 'AwaitExpression' || cur.type === 'ParenthesizedExpression') { cur = cur.argument ?? cur.expression; continue; }
    break;
  }
  return has;
}

// ── T1A-07: THE PATH RESOLVER ────────────────────────────────────────────────

const QUERY_PASS_THROUGH = new Set([
  'where', 'orderBy', 'limit', 'limitToLast', 'startAfter', 'startAt', 'endAt', 'endBefore', 'offset', 'select',
  'withConverter', 'get',
  // an array of the query's documents is still the query's documents
  'filter', 'slice', 'sort', 'reverse', 'concat',
]);
const ELEMENT_CALLBACK_METHODS = new Set(['forEach', 'map', 'filter', 'find', 'some', 'every', 'flatMap']);
const FUNCTION_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const BLOCK_SCOPE_TYPES = new Set(['BlockStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement', 'SwitchStatement', 'CatchClause', 'StaticBlock']);
const NON_REF_VALUE_TYPES = new Set([
  'NewExpression', 'ObjectExpression', 'Literal', 'TemplateLiteral', 'ArrowFunctionExpression', 'FunctionExpression',
  'ClassExpression', 'BinaryExpression', 'UnaryExpression', 'UpdateExpression',
]);
const RESOLVE_STEP_BUDGET = 600;

/** The property a member expression names: `a.b` → 'b', `a['b']` → 'b', `a[0]` → 0, `a[expr]` → null. */
function memberProp(node) {
  if (!node.computed) return node.property?.type === 'Identifier' ? node.property.name : null;
  if (node.property?.type === 'Literal' && (typeof node.property.value === 'string' || typeof node.property.value === 'number')) return node.property.value;
  return null;
}

/**
 * The scope index of one file: every declaration with the range it is visible in, so a name resolves to the
 * declaration that encloses the use (innermost first) — not to the last same-named one in the file.
 */
function buildScopeIndex(ast) {
  const decls = new Map();          // name → [{ kind, path, start, end, … }]
  const fnCallSite = new WeakMap(); // function node → { call, argIndex } when it is an argument of a call
  const pushes = new Map();         // array name → [`name.push(…)` call nodes]
  const forOfLeft = new WeakMap();  // a for…of's `left` declaration → its `right`
  const forInLeft = new WeakSet();
  const assigns = new Map();        // name → [`name = <expr>` assignment nodes]
  const namedTxCallbacks = [];      // the identifier in `x.runTransaction(<identifier>)` (IS-4: a callback passed by name)
  const add = (name, rec) => { if (!decls.has(name)) decls.set(name, []); decls.get(name).push(rec); };
  // A binding pattern: each bound name with the access path from its source (`{ ref }` → ['ref'], `[a]` → [0]).
  const bind = (pattern, base, scope, path) => {
    if (!pattern) return;
    if (pattern.type === 'Identifier') add(pattern.name, { ...base, path, start: scope.start, end: scope.end });
    else if (pattern.type === 'AssignmentPattern') bind(pattern.left, base, scope, path); // a default value is not read
    else if (pattern.type === 'RestElement') bind(pattern.argument, base, scope, [...path, null]);
    else if (pattern.type === 'ArrayPattern') pattern.elements.forEach((el, i) => bind(el, base, scope, [...path, el?.type === 'RestElement' ? null : i]));
    else if (pattern.type === 'ObjectPattern') {
      for (const p of pattern.properties) {
        if (p.type === 'RestElement') { bind(p.argument, base, scope, [...path, null]); continue; }
        const key = !p.computed && p.key?.type === 'Identifier' ? p.key.name
          : (p.key?.type === 'Literal' && typeof p.key.value === 'string' ? p.key.value : null);
        bind(p.value, base, scope, [...path, key]);
      }
    }
  };
  const visit = (node, fnScope, blockScope) => {
    let fs = fnScope; let bs = blockScope;
    if (FUNCTION_TYPES.has(node.type)) {
      if (node.type === 'FunctionDeclaration' && node.id) add(node.id.name, { kind: 'function', node, path: [], start: blockScope.start, end: blockScope.end });
      fs = node; bs = node;
      node.params.forEach((p, index) => bind(p, { kind: 'param', fn: node, index }, node, []));
    } else if (BLOCK_SCOPE_TYPES.has(node.type)) {
      bs = node;
      if (node.type === 'CatchClause') bind(node.param, { kind: 'other' }, node, []);
      if (node.type === 'ForOfStatement' && node.left?.type === 'VariableDeclaration') forOfLeft.set(node.left, node.right);
      if (node.type === 'ForInStatement' && node.left?.type === 'VariableDeclaration') forInLeft.add(node.left);
    } else if (node.type === 'VariableDeclaration') {
      const scope = node.kind === 'var' ? fnScope : blockScope;
      for (const d of node.declarations) {
        if (forOfLeft.has(node)) bind(d.id, { kind: 'forOf', source: forOfLeft.get(node) }, scope, []);
        else if (forInLeft.has(node)) bind(d.id, { kind: 'other' }, scope, []);
        else bind(d.id, { kind: 'var', init: d.init ?? null, declKind: node.kind }, scope, []);
      }
    } else if (node.type === 'ImportDeclaration') {
      for (const s of node.specifiers) {
        const imported = s.type === 'ImportSpecifier' && s.imported?.type === 'Identifier' ? s.imported.name : null;
        add(s.local.name, { kind: 'import', source: node.source.value, imported, path: [], start: ast.start, end: ast.end });
      }
    } else if (node.type === 'ClassDeclaration' && node.id) {
      add(node.id.name, { kind: 'other', path: [], start: blockScope.start, end: blockScope.end });
    } else if (node.type === 'AssignmentExpression' && node.operator === '=' && node.left?.type === 'Identifier') {
      if (!assigns.has(node.left.name)) assigns.set(node.left.name, []);
      assigns.get(node.left.name).push(node);
    } else if (node.type === 'CallExpression') {
      node.arguments.forEach((a, argIndex) => { if (FUNCTION_TYPES.has(a.type)) fnCallSite.set(a, { call: node, argIndex }); });
      const cal = node.callee;
      if (cal?.type === 'MemberExpression' && cal.object?.type === 'Identifier' && memberProp(cal) === 'push') {
        if (!pushes.has(cal.object.name)) pushes.set(cal.object.name, []);
        pushes.get(cal.object.name).push(node);
      }
      if (cal?.type === 'MemberExpression' && memberProp(cal) === 'runTransaction' && node.arguments[0]?.type === 'Identifier') {
        namedTxCallbacks.push(node.arguments[0]);
      }
    }
    for (const key of Object.keys(node)) {
      const v = node[key];
      if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === 'string') visit(c, fs, bs); }
      else if (v && typeof v.type === 'string') visit(v, fs, bs);
    }
  };
  visit(ast, ast, ast);
  const lookup = (name, pos) => {
    let best = null;
    for (const r of decls.get(name) ?? []) {
      if (pos >= r.start && pos <= r.end && (!best || r.end - r.start <= best.end - best.start)) best = r;
    }
    return best;
  };
  // A module-level declaration by name (what an `import { name }` of this file binds to).
  const lookupTop = (name) => {
    let best = null;
    for (const r of decls.get(name) ?? []) if (r.start === ast.start && r.end === ast.end) best = r;
    return best;
  };
  return { lookup, lookupTop, fnCallSite, pushes, assigns, namedTxCallbacks };
}

/** The collection names of a path literal: 'mandates/x/ideas' → ['mandates', 'ideas'] (every even position). */
const literalCollections = (lit) => lit.split('/').filter((_, i) => i % 2 === 0);

const opaquePath = (ev = false) => ({ segs: [], ev, nonRef: false });
const nonRefPath = () => ({ segs: [], ev: false, nonRef: true });
// IS-4 (V4): the parent of a ref is a ref, at a path this resolver does not compute — "a ref the scan could not
// resolve". `viaParent` marks it, so a write through it is never passed under a literal found beneath the `.parent`
// step. `.parent` hands evidence on; it does not make any (`node.parent.set(…)` on a tree node is not a site).
const parentOf = (inner) => (!inner.nonRef && (inner.ev || inner.segs.length > 0)
  ? { segs: [], ev: true, nonRef: false, viaParent: true } : opaquePath());
const keepViaParent = (...inners) => (inners.some((r) => r.viaParent === true) ? { viaParent: true } : {});

/**
 * What a resolved path means for the listing. `hit` = money on any segment, or a PROTECTED leaf. `key` = the
 * nearest literal on the path (the allowlist key's collection). `resolved` = every segment is a literal.
 */
export function classifyPath(segs) {
  const known = segs.filter((s) => s !== null);
  const leaf = segs.length > 0 ? segs[segs.length - 1] : null;
  const money = known.some((s) => MONEY_ROOT_COLLECTIONS.has(s) || MONEY_SUBCOLLECTIONS.has(s));
  const protectedLeaf = leaf !== null && PROTECTED_COLLECTIONS.has(leaf);
  return {
    hit: money || protectedLeaf,
    money,
    key: known.length > 0 ? known[known.length - 1] : null,
    resolved: segs.length > 0 && known.length === segs.length,
    path: segs.length > 0 ? segs.map((s) => s ?? '?').join('/') : null,
  };
}

/**
 * The verdict on a resolved VALUE. A value whose alternatives (see mergePaths) reach more than one listed store is
 * keyed by all of them, sorted and joined with '+' (`corporateActions+decisions`: one call site, a loop over refs
 * of both).
 */
function classifyResolved(r) {
  if (!r.alts) return classifyPath(r.segs);
  const hits = r.alts.map(classifyPath).filter((c) => c.hit);
  return {
    hit: true,
    money: hits.some((c) => c.money),
    key: [...new Set(hits.map((c) => c.key))].sort().join('+'),
    resolved: false,
    path: [...new Set(hits.map((c) => c.path))].sort().join(' | '),
  };
}

// Several candidate paths for one value (an array's elements, both arms of `a ? x : y`, a builder's returns, a
// `let`'s initialiser and its assignments). Provable non-refs (null, a literal) are ignored. Agreement resolves.
// On disagreement the sides that reach a LISTED store win, all of them (`alts`); with none, the value is opaque.
function mergePaths(list) {
  const live = list.filter((r) => !r.nonRef);
  if (live.length === 0) return nonRefPath();
  const first = live[0].segs.join('/');
  if (live.every((r) => !r.alts && r.segs.length === live[0].segs.length && r.segs.join('/') === first)) {
    return { segs: live[0].segs, ev: live.some((r) => r.ev), nonRef: false, ...keepViaParent(...live) };
  }
  const alts = [];
  for (const r of live) for (const segs of r.alts ?? [r.segs]) if (classifyPath(segs).hit) alts.push(segs);
  if (alts.length === 0) return { ...opaquePath(live.some((r) => r.ev)), ...keepViaParent(...live) };
  const distinct = [...new Map(alts.map((segs) => [segs.map((s) => s ?? '?').join('/'), segs])).values()];
  return distinct.length === 1 ? { segs: distinct[0], ev: true, nonRef: false } : { segs: distinct[0], alts: distinct, ev: true, nonRef: false };
}

/** The module a relative import names, as a scanned repo-relative path (or null). */
function importedFile(fromFile, source) {
  if (typeof source !== 'string' || !source.startsWith('.')) return null;
  return posix.normalize(posix.join(posix.dirname(fromFile), source));
}

/** A string the scan can read statically: a literal, a plain template, or a string constant (same file / imported). */
function stringValueOf(node, ctx, st) {
  if (!node || st.steps++ > RESOLVE_STEP_BUDGET) return null;
  if (node.type === 'Literal') return typeof node.value === 'string' ? node.value : null;
  if (node.type === 'TemplateLiteral') return node.expressions.length === 0 ? node.quasis[0].value.cooked : null;
  if (node.type !== 'Identifier') return null;
  const b = ctx.scope.lookup(node.name, node.start);
  if (!b || b.path.length > 0) return null;
  if (b.kind === 'var') return b.init && b.declKind === 'const' ? stringValueOf(b.init, ctx, st) : null;
  if (b.kind === 'import' && b.imported) {
    const other = ctx.repo?.get(importedFile(ctx.file, b.source));
    const top = other?.scope.lookupTop(b.imported);
    if (top?.kind === 'var' && top.declKind === 'const' && top.path.length === 0 && top.init) return stringValueOf(top.init, other, st);
  }
  return null;
}

/** The function a called name is bound to — same file, or a relative import from a scanned file. */
function calledFunction(name, pos, ctx) {
  const local = ctx.scope.lookup(name, pos);
  const fnOf = (b, owner) => {
    if (!b || b.path.length > 0) return null;
    if (b.kind === 'function') return { fn: b.node, ctx: owner };
    if (b.kind === 'var' && b.init && FUNCTION_TYPES.has(b.init.type)) return { fn: b.init, ctx: owner };
    return null;
  };
  if (local?.kind === 'import' && local.imported) {
    const other = ctx.repo?.get(importedFile(ctx.file, local.source));
    return other ? fnOf(other.scope.lookupTop(local.imported), other) : null;
  }
  return fnOf(local, ctx);
}

/** The expressions a function returns (its own `return`s, not a nested function's). */
function returnExpressions(fn) {
  if (fn.body.type !== 'BlockStatement') return [fn.body];
  const out = [];
  const visit = (node) => {
    if (FUNCTION_TYPES.has(node.type)) return;
    if (node.type === 'ReturnStatement') { if (node.argument) out.push(node.argument); return; }
    for (const key of Object.keys(node)) {
      const v = node[key];
      if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === 'string') visit(c); }
      else if (v && typeof v.type === 'string') visit(v);
    }
  };
  visit(fn.body);
  return out;
}

/** The statically known elements of an array: a literal's, plus every `name.push(…)` onto a `const name = […]`. */
function arrayElements(node, ctx) {
  const fromLiteral = (arr) => arr.elements.filter(Boolean).map((e) => (e.type === 'SpreadElement' ? { spread: e.argument } : { expr: e }));
  if (node?.type === 'ArrayExpression') return fromLiteral(node);
  if (node?.type !== 'Identifier') return null;
  const b = ctx.scope.lookup(node.name, node.start);
  if (b?.kind !== 'var' || b.path.length > 0 || b.init?.type !== 'ArrayExpression') return null;
  const out = fromLiteral(b.init);
  for (const call of ctx.scope.pushes.get(node.name) ?? []) {
    if (ctx.scope.lookup(node.name, call.start) !== b) continue;
    for (const a of call.arguments) out.push(a.type === 'SpreadElement' ? { spread: a.argument } : { expr: a });
  }
  return out;
}

/**
 * THE PATH RESOLVER: the collection path of a ref-valued (or snapshot-, query-, array-of-documents-valued)
 * expression. Returns { segs, ev, nonRef } — `segs` root to leaf (null = a segment that is not a literal),
 * `ev` = ref evidence (ref-named, `.ref`, a chain step), `nonRef` = provably not a ref.
 */
function resolvePath(node, ctx, st) {
  if (!node) return opaquePath();
  // Out of budget: say "a ref the scan could not resolve" (visible, listed), never "nothing here".
  if (st.steps++ > RESOLVE_STEP_BUDGET) { st.exhausted = true; return opaquePath(true); }
  switch (node.type) {
    case 'AwaitExpression': return resolvePath(node.argument, ctx, st);
    case 'ParenthesizedExpression':
    case 'ChainExpression': return resolvePath(node.expression, ctx, st);
    case 'ConditionalExpression': return mergePaths([resolvePath(node.consequent, ctx, st), resolvePath(node.alternate, ctx, st)]);
    case 'LogicalExpression': return mergePaths([resolvePath(node.left, ctx, st), resolvePath(node.right, ctx, st)]);
    case 'ArrayExpression': return mergePaths(arrayElements(node, ctx).map((e) => resolvePath(e.expr ?? e.spread, ctx, st)));
    case 'Identifier': return resolveIdentifier(node, ctx, st);
    case 'MemberExpression': {
      const prop = memberProp(node);
      if (prop === 'ref') return { ...resolvePath(node.object, ctx, st), ev: true, nonRef: false };
      if (prop === 'parent') return parentOf(resolvePath(node.object, ctx, st));
      if (prop === 'docs' || typeof prop === 'number' || (node.computed && prop === null)) return resolvePath(node.object, ctx, st);
      return opaquePath(typeof prop === 'string' && REF_PARAM_RE.test(prop));
    }
    case 'CallExpression': return resolveCall(node, ctx, st);
    default: return NON_REF_VALUE_TYPES.has(node.type) ? nonRefPath() : opaquePath();
  }
}

function resolveCall(node, ctx, st) {
  const cal = node.callee;
  if (cal?.type === 'MemberExpression') {
    const method = memberProp(cal);
    if (method === 'collection' || method === 'collectionGroup') {
      const inner = method === 'collection' ? resolvePath(cal.object, ctx, st) : opaquePath();
      const lit = stringValueOf(node.arguments[0], ctx, st);
      // a slash path names a collection at every even position: 'mandates/x/ideas' → mandates, ideas
      const added = lit === null ? [null] : literalCollections(lit);
      return { segs: [...inner.segs, ...added], ev: true, nonRef: false };
    }
    if (method === 'doc') {
      // `.doc()` names no collection of its own, so a `.parent` step beneath it still decides nothing (viaParent
      // is kept); a `.collection('<lit>')` above names the leaf again and drops it.
      const inner = resolvePath(cal.object, ctx, st);
      let segs = inner.segs;
      if (node.arguments.length > 0) {
        const lit = stringValueOf(node.arguments[0], ctx, st);
        // db.doc('<path>'): collections at the even positions; a path that is not a literal is one unknown segment
        if (inner.segs.length === 0) segs = lit === null ? [null] : literalCollections(lit);
        // collectionRef.doc('id') adds nothing; collectionRef.doc('id/sub/id2') adds the odd positions
        else segs = [...inner.segs, ...(lit === null ? [] : lit.split('/').filter((_, i) => i % 2 === 1))];
      }
      return { segs, ev: true, nonRef: false, ...keepViaParent(inner) };
    }
    if (typeof method === 'string' && QUERY_PASS_THROUGH.has(method)) return resolvePath(cal.object, ctx, st);
    return opaquePath();
  }
  if (cal?.type === 'Identifier') {
    // A ref builder: resolve through what the function returns.
    const target = calledFunction(cal.name, node.start, ctx);
    if (!target || st.fns.has(target.fn)) return opaquePath();
    st.fns.add(target.fn);
    try {
      return mergePaths(returnExpressions(target.fn).map((e) => resolvePath(e, target.ctx, st)));
    } finally {
      st.fns.delete(target.fn);
    }
  }
  return opaquePath();
}

function resolveIdentifier(node, ctx, st) {
  if (node.name === 'undefined') return nonRefPath();
  const nameEv = REF_PARAM_RE.test(node.name);
  const b = ctx.scope.lookup(node.name, node.start);
  if (!b || st.seen.has(b)) return opaquePath(nameEv);
  st.seen.add(b);
  try {
    let base; let path = b.path;
    if (b.kind === 'var') {
      const elems = b.path.length === 0 ? arrayElements(node, ctx) : null;
      const sources = [];
      if (elems) sources.push(mergePaths(elems.map((e) => resolvePath(e.expr ?? e.spread, ctx, st))));
      else if (b.init) sources.push(resolvePath(b.init, ctx, st));
      // `let r = null; … r = <ref>`: every plain assignment to this binding is one more source.
      if (b.path.length === 0) {
        for (const a of ctx.scope.assigns.get(node.name) ?? []) {
          if (ctx.scope.lookup(node.name, a.start) === b) sources.push(resolvePath(a.right, ctx, st));
        }
      }
      base = sources.length > 0 ? mergePaths(sources) : opaquePath();
      // Only a `const` is provably not a ref by its initialiser; a `let` may be assigned in a way not read here.
      if (base.nonRef && b.declKind !== 'const') base = opaquePath();
    } else if (b.kind === 'forOf') {
      // The loop variable is one ELEMENT of the iterable.
      const elems = arrayElements(b.source, ctx);
      if (elems && typeof path[0] === 'number') {
        // `for (const [ref, doc] of pairs)`: the tuple literal's own element
        base = mergePaths(elems.map((e) => (e.expr?.type === 'ArrayExpression' && e.expr.elements[path[0]]
          ? resolvePath(e.expr.elements[path[0]], ctx, st) : opaquePath())));
        path = path.slice(1);
      } else if (elems) base = mergePaths(elems.map((e) => resolvePath(e.expr ?? e.spread, ctx, st)));
      else base = resolvePath(b.source, ctx, st);
    } else if (b.kind === 'param') {
      // The first parameter of `X.forEach((d) => …)` (and its kin) is one element of X.
      const site = ctx.scope.fnCallSite.get(b.fn);
      const cal = site?.call.callee;
      if (site && site.argIndex === 0 && b.index === 0 && cal?.type === 'MemberExpression' && ELEMENT_CALLBACK_METHODS.has(memberProp(cal))) {
        base = resolvePath(cal.object, ctx, st);
      } else base = opaquePath();
    } else {
      return opaquePath(nameEv); // a function, an import, a class, a catch parameter
    }
    // The destructuring path from the source to this name: `.ref` / `.docs` / an index keep the path.
    for (const step of path) {
      if (step === 'ref') base = { ...base, ev: true, nonRef: false };
      else if (step === 'parent') base = parentOf(base);
      else if (step === 'docs' || typeof step === 'number') continue;
      else base = opaquePath(typeof step === 'string' && REF_PARAM_RE.test(step));
    }
    if (base.nonRef) return base;
    return { ...base, ev: base.ev || nameEv };
  } finally {
    st.seen.delete(b);
  }
}

const freshState = () => ({ steps: 0, seen: new Set(), fns: new Set() });

/**
 * Is this identifier a transaction handle by position — the first parameter of a `runTransaction(…)` callback?
 * The callback is written inline, or (IS-4, V2) passed BY NAME: `const body = async (t) => {…}` or
 * `function body(t) {…}`, then `db.runTransaction(body)` — `ctx.txCallbacks` holds every function so passed, in
 * the same file or imported by a relative specifier from a scanned one.
 */
function isTransactionCallbackParam(node, ctx) {
  if (node?.type !== 'Identifier') return false;
  const b = ctx.scope.lookup(node.name, node.start);
  if (b?.kind !== 'param' || b.index !== 0 || b.path.length > 0) return false;
  const site = ctx.scope.fnCallSite.get(b.fn);
  if (site && site.call.callee?.type === 'MemberExpression' && memberProp(site.call.callee) === 'runTransaction') return true;
  return ctx.txCallbacks?.has(b.fn) === true;
}

/**
 * IS-4 (V1, V8): THE OWN-PARAMETER PAIR. `function apply(t, bookRef) { t.update(bookRef, …) }` and
 * `function f(b, bookRef) { b.update(bookRef, …) }`: the base is a plain parameter and the first argument is a
 * ref-named parameter (plain, or destructured: `{ bookRef }`) OF THE SAME FUNCTION — a handle and the ref it
 * writes, both handed in. Deliberately
 * this narrow: "any base, a ref-named first argument" lists the tree's Maps keyed by a ref or a ref-named path
 * (`vintageCache.set(book.vintageRef, …)`, `roleByTemp.set(ref, …)`, `reads.set(d.ref.path, …)`), which are not
 * Firestore writes (the lens-3 refuter measured both rules on the real tree: 0 new listings for the pair).
 */
function isOwnParameterPair(base, arg, ctx) {
  if (base?.type !== 'Identifier' || arg?.type !== 'Identifier' || !REF_PARAM_RE.test(arg.name)) return false;
  const b = ctx.scope.lookup(base.name, base.start);
  const a = ctx.scope.lookup(arg.name, arg.start);
  return b?.kind === 'param' && a?.kind === 'param' && b.path.length === 0 && b.fn === a.fn;
}

/** IS-4 (V3): `<x>.bulkWriter()` — the call itself, awaited or not. */
function isBulkWriterCall(node) {
  let cur = node;
  while (cur && (cur.type === 'AwaitExpression' || cur.type === 'ParenthesizedExpression')) cur = cur.argument ?? cur.expression;
  return cur?.type === 'CallExpression' && cur.callee?.type === 'MemberExpression' && memberProp(cur.callee) === 'bulkWriter';
}

/**
 * IS-4 (V3): a bulk-writer handle — `db.bulkWriter()` written inline, a name initialised or assigned from it
 * (`const w = db.bulkWriter()`), or anything named `bulkWriter`. Its set/update/create/delete take the ref as
 * their first argument, as a transaction's do.
 */
function isBulkWriterHandle(node, ctx) {
  if (isBulkWriterCall(node)) return true;
  if (node?.type !== 'Identifier') return false;
  if (BULK_WRITER_NAME_RE.test(node.name)) return true;
  const b = ctx.scope.lookup(node.name, node.start);
  if (b?.kind !== 'var' || b.path.length > 0) return false;
  if (isBulkWriterCall(b.init)) return true;
  return (ctx.scope.assigns.get(node.name) ?? []).some((a) => ctx.scope.lookup(node.name, a.start) === b && isBulkWriterCall(a.right));
}

// Sol pre-activation review #10: DESTRUCTURED/EXTRACTED write methods. Any
// pattern that pulls a write method OFF a Firestore-shaped ref/tx/batch —
// `const { set } = ref`, `const f = tx.update`, `run(docRef.delete)` — makes
// the eventual write invisible to the call-site pass. Conservative fail-loud
// rule: every such EXTRACTION is itself a site (`extract:<method>`, always
// collection-unresolved), so it lands in the deny-by-default listing — a
// human allowlists it or the scan fails. The repo carries ZERO occurrences
// today (pinned by the zero-extraction test row).
export function detectWriteMethodExtractions(relPath, ast, consts, enclosing) {
  const out = [];
  const callees = new Set();
  const typeofOperands = new Set();
  for (const n of astWalk(ast)) {
    if (n.type === 'CallExpression' && n.callee) callees.add(n.callee);
    // `typeof ref.delete === 'function'` (the moverCandidates feature-detect
    // precedent): the member value is consumed by typeof and can never
    // produce a write — excluding it is sound, not a rule weakening; the
    // adjacent actual call remains visible to the direct pass.
    if (n.type === 'UnaryExpression' && n.operator === 'typeof' && n.argument) typeofOperands.add(n.argument);
  }
  const shapedSource = (node) => {
    if (!node) return false;
    if (node.type === 'Identifier' && (HANDLE_RE.test(node.name) || REF_PARAM_RE.test(node.name))) return true;
    if (chainInfo(node, consts).firestoreShaped) return true;
    return node.type !== 'Identifier' && chainHasRefStep(node);
  };
  for (const n of astWalk(ast)) {
    // Form 1 — destructuring: const { set, update: u } = <firestore-shaped>
    if (n.type === 'VariableDeclarator' && n.id?.type === 'ObjectPattern' && n.init && shapedSource(n.init)) {
      for (const prop of n.id.properties ?? []) {
        const key = prop.key?.type === 'Identifier' ? prop.key.name
          : (prop.key?.type === 'Literal' && typeof prop.key.value === 'string' ? prop.key.value : null);
        if (key && WRITE_METHODS.has(key)) {
          out.push({ file: relPath, fn: enclosing(n.start), method: `extract:${key}`, collection: null, pos: n.start, line: n.loc?.start.line ?? null, legacyListed: true });
        }
      }
    }
    // Form 2 — method-value extraction: a write member that is NOT the callee
    // of a call (const f = ref.set; fn(tx.update); ref.delete.bind(ref)).
    if (n.type === 'MemberExpression' && !callees.has(n) && !typeofOperands.has(n)) {
      const m = writeMethodOf(n);
      if (m && shapedSource(n.object)) {
        out.push({ file: relPath, fn: enclosing(n.start), method: `extract:${m}`, collection: null, pos: n.start, line: n.loc?.start.line ?? null, legacyListed: true });
      }
    }
  }
  return out;
}

// Unit-testable wrapper: parse a source string and run the #10 detector with
// the same const-hop map the file scan builds.
export function detectExtractionsInSource(relPath, src) {
  const ast = parse(src, PARSE_OPTIONS);
  const consts = new Map();
  for (const n of astWalk(ast)) {
    if (n.type === 'VariableDeclarator' && n.id?.type === 'Identifier' && n.init) consts.set(n.id.name, n.init);
  }
  return detectWriteMethodExtractions(relPath, ast, consts, () => '<unit>');
}

// Shared write-method extraction (review F3(c)/design-F1: ref['set'](...) —
// a computed member whose property is a string literal counts like ref.set()).
function writeMethodOf(cal) {
  if (cal?.type !== 'MemberExpression') return null;
  const method = !cal.computed && cal.property?.type === 'Identifier' ? cal.property.name
    : cal.computed && cal.property?.type === 'Literal' && typeof cal.property.value === 'string' ? cal.property.value
    : null;
  return method && WRITE_METHODS.has(method) ? method : null;
}

/**
 * Parse + per-file analysis: the floor's verdict on every write call, helper defs, import bindings, and the scope
 * index the path resolver reads. The sites themselves are decided in `fileSites`, once every file is parsed (a ref
 * builder or a constant may live in another file).
 */
function scanFile(relPath, src) {
  let ast;
  try {
    ast = parse(src, PARSE_OPTIONS);
  } catch (e) {
    return {
      parseError: { file: relPath, fn: '<parse-error>', method: 'parse', collection: `parse_error:${e.message.slice(0, 60)}`, pos: 0, line: null, legacyListed: true },
      writes: [], refArgWrites: [], paramSites: [], helpers: [], imports: new Map(), ast: null, consts: new Map(), enclosing: () => '<top>', scope: null,
    };
  }
  // Same-file const/let single-assignment map (identifier → init expression) — the floor's, by name.
  const consts = new Map();
  for (const n of astWalk(ast)) {
    if (n.type === 'VariableDeclarator' && n.id?.type === 'Identifier' && n.init) consts.set(n.id.name, n.init);
  }
  // Named function-like nodes: enclosing-fn attribution + B3-EXT param lists.
  const fnRanges = [];
  for (const n of astWalk(ast)) {
    if (n.type === 'FunctionDeclaration' && n.id) fnRanges.push({ start: n.start, end: n.end, name: n.id.name, node: n });
    if (n.type === 'VariableDeclarator' && n.id?.type === 'Identifier'
      && (n.init?.type === 'ArrowFunctionExpression' || n.init?.type === 'FunctionExpression')) {
      fnRanges.push({ start: n.init.start, end: n.init.end, name: n.id.name, node: n.init });
    }
    if (n.type === 'ExportDefaultDeclaration' && (n.declaration?.type === 'FunctionDeclaration' || n.declaration?.type === 'ArrowFunctionExpression')) {
      fnRanges.push({ start: n.declaration.start, end: n.declaration.end, name: n.declaration.id?.name ?? 'default', node: n.declaration });
    }
  }
  const enclosing = (pos) => {
    let best = null;
    for (const r of fnRanges) if (pos >= r.start && pos <= r.end && (!best || r.end - r.start < best.end - best.start)) best = r;
    return best?.name ?? '<top>';
  };

  // Import bindings: local name → imported name (aliases resolved).
  const imports = new Map();
  for (const n of astWalk(ast)) {
    if (n.type !== 'ImportDeclaration') continue;
    for (const s of n.specifiers) {
      if (s.type === 'ImportSpecifier' && s.imported?.type === 'Identifier') imports.set(s.local.name, s.imported.name);
    }
  }

  // Every write call, with the FLOOR's verdict on it (shaped? which collection?) exactly as B3 computed it.
  const writes = [];
  for (const n of astWalk(ast)) {
    if (n.type !== 'CallExpression') continue;
    const method = writeMethodOf(n.callee);
    if (!method) continue;
    const target = chainInfo(n.callee.object, consts);
    const viaArg = !target.firestoreShaped && n.arguments[0] ? chainInfo(n.arguments[0], consts) : null;
    writes.push({
      node: n, method,
      legacyShaped: Boolean(target.firestoreShaped || viaArg?.firestoreShaped),
      legacyCollection: target.collection ?? viaArg?.collection ?? null,
      // the callee itself is shaped but names no collection: a handle (tx / batch), whose ref is the ARGUMENT
      handleForm: Boolean(target.firestoreShaped && target.collection === null),
      viaArgShaped: Boolean(viaArg?.firestoreShaped),
    });
  }

  // IS-4 (V7): `<anything>.recursiveDelete(<ref>)` — a write whose ref is its ARGUMENT. Not a WRITE_METHODS name, so
  // the floor, the helper pass and the extraction detector never see it; `fileSites` decides it from the argument.
  const refArgWrites = [];
  for (const n of astWalk(ast)) {
    if (n.type !== 'CallExpression' || n.callee?.type !== 'MemberExpression') continue;
    const method = memberProp(n.callee);
    if (typeof method === 'string' && REF_ARGUMENT_WRITE_METHODS.has(method)) refArgWrites.push({ node: n, method });
  }

  // B3-EXT: param-write helper detection, per named function-like node. A
  // nested function checks its OWN params on its own row; walking the full
  // subtree can only over-report (deny-by-default: over is safe, under is not).
  const helpers = [];
  const paramSites = [];
  const paramCovered = new Set(); // write calls the helper pass owns (their base, or ref argument, is a parameter)
  const seen = new Set();
  const paramSiteIds = new Set();
  for (const r of fnRanges) {
    const params = (r.node.params || []).map((p) => (p.type === 'Identifier' ? p.name : null));
    if (!params.some(Boolean)) continue;
    for (const n of astWalk(r.node)) {
      if (n.type !== 'CallExpression') continue;
      const method = writeMethodOf(n.callee);
      if (!method) continue;
      const target = chainInfo(n.callee.object, consts);
      const argInfo = n.arguments[0] ? chainInfo(n.arguments[0], consts) : null;
      // When the chain (or ref argument) already resolves a LITERAL collection,
      // the write target is statically known and the direct pass governs — the
      // param supplies only the handle, not the target. Register a helper ONLY
      // when the collection genuinely flows through the param (unresolved here).
      if (target.collection !== null || argInfo?.collection != null) continue;
      let paramIndex = -1; let paramName = null;
      // Callee-base form: <param>[.doc(x)].set(…) with ref evidence.
      const base = chainBaseName(n.callee.object);
      const bi = base === null ? -1 : params.indexOf(base);
      if (bi >= 0 && (REF_PARAM_RE.test(base) || chainHasRefStep(n.callee.object))) {
        paramIndex = bi; paramName = base;
      }
      // Handle ref-argument form: tx.set(<param>, …) — Firestore by construction.
      if (paramIndex === -1 && target.firestoreShaped && n.arguments[0]) {
        const ab = chainBaseName(n.arguments[0]);
        const ai = ab === null ? -1 : params.indexOf(ab);
        if (ai >= 0) { paramIndex = ai; paramName = ab; }
      }
      if (paramIndex === -1) continue;
      paramCovered.add(n);
      const key = `${r.name}#${paramIndex}#${method}`;
      const registered = seen.has(key);
      if (!registered) {
        seen.add(key);
        helpers.push({ file: relPath, name: r.name, paramIndex, paramName, method });
      }
      // The helper's own write is a listed site UNLESS the direct pass above
      // already captured this call (handle-shaped or const-resolved chains).
      // T1A-07: EVERY such write is a site. Before, only the first write per
      // (function, param, method) was — a second `ref.update(…)` through the
      // same parameter was invisible (`legacyListed` false marks those).
      const viaArg = !target.firestoreShaped && n.arguments[0] ? chainInfo(n.arguments[0], consts) : null;
      if (!(target.firestoreShaped || viaArg?.firestoreShaped)) {
        const siteId = `${r.name}@${n.start}`;
        if (paramSiteIds.has(siteId)) continue;
        paramSiteIds.add(siteId);
        paramSites.push({ file: relPath, fn: r.name, method, collection: `param:${paramName}`, pos: n.start, line: n.loc?.start.line ?? null, legacyListed: !registered });
      }
    }
  }

  return { writes, refArgWrites, paramSites, paramCovered, helpers, imports, ast, consts, enclosing, scope: buildScopeIndex(ast) };
}

/** The floor's listing rule, as B3 wrote it: unresolved, or a PROTECTED name. */
const legacyNeedsListing = (collection) => collection === null || PROTECTED_COLLECTIONS.has(collection);

/**
 * The sites of one file: the floor's verdict, then the path resolver's. A site the floor lists stays listed; the
 * path resolver re-keys it when it finds a listed store, lists a shaped write whose path holds money, and makes a
 * ref-evidenced write the floor never saw into a site.
 */
function fileSites(pf, ctx) {
  const sites = [];
  for (const w of pf.writes) {
    const n = w.node;
    const at = { file: pf.file, fn: pf.enclosing(n.start), method: w.method, pos: n.start, line: n.loc?.start.line ?? null };
    const legacyListed = w.legacyShaped && legacyNeedsListing(w.legacyCollection);
    const objPath = resolvePath(n.callee.object, ctx, freshState());
    // A handle the floor does not know by name: the first parameter of a runTransaction callback (inline, or
    // passed by name — IS-4 V2), or a bulk writer (IS-4 V3).
    const txParam = isTransactionCallbackParam(n.callee.object, ctx)
      || (HANDLE_WRITE_METHODS.has(w.method) && isBulkWriterHandle(n.callee.object, ctx));
    const arg0 = n.arguments[0] && n.arguments[0].type !== 'ObjectExpression' ? n.arguments[0] : null;
    // The ref ARGUMENT is read for a handle write (tx/batch — by name, by `.batch()`, or by position in a
    // runTransaction callback — and a bulk writer) and where the floor already took the write from its argument.
    const bareHandle = (w.handleForm && objPath.segs.length === 0) || txParam;
    const argPath = arg0 && (bareHandle || (w.viaArgShaped && !objPath.nonRef)) ? resolvePath(arg0, ctx, freshState()) : null;
    // IS-4 (V4): the chain (or a handle's ref argument) steps through `.parent`.
    const viaParent = objPath.viaParent === true || argPath?.viaParent === true;
    const objClass = classifyResolved(objPath);
    const argClass = argPath ? classifyResolved(argPath) : null;
    // The floor's own collection is judged by the same rule (the floor resolves by NAME, file-wide, and can name
    // a store where the scope-aware resolver sees only a parameter): whichever resolver reaches a listed store, lists.
    const floorClass = w.legacyShaped && w.legacyCollection !== null ? classifyPath(literalCollections(w.legacyCollection)) : null;
    const listed = objClass.hit ? objClass : (argClass?.hit ? argClass : (floorClass?.hit ? floorClass : null));
    if (listed) {
      sites.push({ ...at, collection: listed.key, path: listed.path, money: listed.money, mustList: true, legacyListed });
    } else if (w.legacyShaped) {
      // The floor's nearest literal is not where a `.parent` chain writes: such a write never passes under it.
      sites.push({ ...at, collection: viaParent ? null : w.legacyCollection, legacyListed });
    } else if (txParam) {
      sites.push({ ...at, collection: null, legacyListed: false }); // a handle by position: listed, as `tx.` is
    } else if (!pf.paramCovered.has(n) && !objPath.nonRef) {
      // (a `.parent` chain the floor does not see has no segment and has evidence: it is listed by the `ev` line)
      if (objPath.segs.length > 0) sites.push({ ...at, collection: objClass.resolved ? objClass.key : null, path: objClass.path, legacyListed: false });
      else if (objPath.ev) sites.push({ ...at, collection: null, legacyListed: false });
      else if (HANDLE_WRITE_METHODS.has(w.method) && isOwnParameterPair(n.callee.object, arg0, ctx)) {
        // IS-4 (V1, V8): a handle under a name the scan does not know, writing a ref-named parameter of the same
        // function. The ref is a parameter, so the store cannot be named: listed, 'unresolved'.
        sites.push({ ...at, collection: null, legacyListed: false });
      }
    }
  }
  // IS-4 (V7): `x.recursiveDelete(<ref>)`. Always a site (the name is Firestore's): the store its argument names;
  // a resolved non-listed literal passes; anything else is a ref the scan could not resolve.
  for (const r of pf.refArgWrites) {
    const n = r.node;
    const at = { file: pf.file, fn: pf.enclosing(n.start), method: r.method, pos: n.start, line: n.loc?.start.line ?? null };
    const argPath = n.arguments[0] ? resolvePath(n.arguments[0], ctx, freshState()) : opaquePath();
    const c = classifyResolved(argPath);
    if (c.hit) sites.push({ ...at, collection: c.key, path: c.path, money: c.money, mustList: true, legacyListed: false });
    else sites.push({ ...at, collection: c.resolved && argPath.viaParent !== true ? c.key : null, path: c.path, legacyListed: false });
  }
  return sites;
}

export function siteKey(s) {
  return `${s.file}::${s.fn}::${s.method}::${s.collection ?? 'unresolved'}`;
}

function needsListingFilter(s) {
  return s.collection === null
    || s.mustList === true
    || PROTECTED_COLLECTIONS.has(s.collection)
    || String(s.collection).startsWith('parse_error:')
    || String(s.collection).startsWith('param:');
}

/**
 * The full scan: every Firestore-shaped write site under api/ + scripts/,
 * PLUS (B3-EXT) every param-write helper definition and every call site of a
 * registered helper. `needsListing` = protected-, money- or unresolved sites
 * (the deny-by-default set). Each site carries `pos` / `line` (where the call
 * is), `path` (the resolved collection path, when the path resolver decided
 * it) and `legacyListed` (the floor alone would have listed it).
 * `entryPoints` (IS-5) = where the idea book's write entry points are defined,
 * called and otherwise used — see namedEntryPoints.
 */
export function scanProtectedStoreWrites(repoRoot) {
  const files = [...walkFiles(repoRoot, 'api', []), ...walkFiles(repoRoot, 'scripts', [])];
  const perFile = files.map((f) => ({ file: f, ...scanFile(f, readFileSync(resolve(repoRoot, f), 'utf8')) }));
  // The path resolver's view of the repo: file → { file, scope, repo } (a builder or a constant may be imported).
  const repo = new Map();
  // IS-4 (V2): every function passed BY NAME to `runTransaction(…)`, repo-wide — built before any site is decided,
  // because an imported callback's writes are judged in the file that declares it.
  const txCallbacks = new WeakSet();
  for (const pf of perFile) if (pf.ast) repo.set(pf.file, { file: pf.file, scope: pf.scope, repo, txCallbacks });
  for (const ctx of repo.values()) {
    for (const id of ctx.scope.namedTxCallbacks) {
      const target = calledFunction(id.name, id.start, ctx);
      if (target) txCallbacks.add(target.fn);
    }
  }

  // Global helper registry: name → merged param indexes (cross-file by name,
  // bound at call sites through import specifiers or same-file definition).
  const registry = new Map();
  for (const pf of perFile) {
    for (const h of pf.helpers) {
      if (!registry.has(h.name)) registry.set(h.name, new Set());
      registry.get(h.name).add(h.paramIndex);
    }
  }

  const all = [];
  for (const pf of perFile) {
    if (!pf.ast) { all.push(pf.parseError); continue; }
    const ctx = repo.get(pf.file);
    all.push(...fileSites(pf, ctx), ...pf.paramSites);
    // #10: extracted write methods are sites too (always unresolved).
    all.push(...detectWriteMethodExtractions(pf.file, pf.ast, pf.consts, pf.enclosing));
    const localNames = new Set(pf.helpers.map((h) => h.name));
    for (const n of astWalk(pf.ast)) {
      if (n.type !== 'CallExpression' || n.callee?.type !== 'Identifier') continue;
      const local = n.callee.name;
      const bound = localNames.has(local) ? local
        : (pf.imports.has(local) && registry.has(pf.imports.get(local)) ? pf.imports.get(local) : null);
      if (!bound || !registry.has(bound)) continue;
      for (const paramIndex of registry.get(bound)) {
        const arg = n.arguments[paramIndex];
        const info = arg ? chainInfo(arg, pf.consts) : { collection: null };
        const at = { file: pf.file, fn: pf.enclosing(n.start), method: `call:${bound}#${paramIndex}`, pos: n.start, line: n.loc?.start.line ?? null };
        const legacyListed = legacyNeedsListing(info.collection);
        // The argument's path: a call passing a money (or protected) ref is listed under that store.
        const argClass = arg ? classifyResolved(resolvePath(arg, ctx, freshState())) : null;
        const floorClass = info.collection !== null ? classifyPath(literalCollections(info.collection)) : null;
        const cls = argClass?.hit ? argClass : (floorClass?.hit ? floorClass : null);
        if (cls) all.push({ ...at, collection: cls.key, path: cls.path, money: cls.money, mustList: true, legacyListed });
        else all.push({ ...at, collection: info.collection, legacyListed });
      }
    }
  }

  const needsListing = all.filter(needsListingFilter);
  return { all, needsListing, entryPoints: namedEntryPoints(perFile, IDEA_BOOK_WRITE_ENTRY_POINTS) };
}

/**
 * IS-5: where a set of function NAMES is defined, called and otherwise used, across the scanned files. The callers
 * of the idea book's write entry points are a second hop the write scan does not follow, so they are pinned by
 * name: `calls` (one record per call), `definitions`, and three lists a pin keeps EMPTY because each is a way to
 * call a function without a call of its name appearing —
 *   `references`    the name used as a value: `const f = closeIdeaBook`, `.map(closeIdeaBook)`, `{ closeIdeaBook }`,
 *                   `obj.closeIdeaBook` not called, a parameter or a property of that name;
 *   `moduleHandles` a module that defines one of the names taken whole: a namespace or default import, a dynamic
 *                   `import()` of it, or a re-export from it (`export … from`).
 * A call is `name(…)` — through an import alias too (`import { closeIdeaBook as c }` … `c(…)` counts as
 * closeIdeaBook) — or `anything.name(…)` (a member call, whatever the object: over-counting is safe).
 * NOT seen: a call through a computed name (`mod[n]()`), `require()`, an import written without the file's
 * extension (Node's ESM loader would not load it either), a file the scan does not walk.
 */
function namedEntryPoints(perFile, names) {
  const wanted = new Set(names);
  const out = { calls: [], definitions: [], references: [], moduleHandles: [] };
  const moduleUses = []; // { file, fn, line, kind, target } — judged once the defining files are known
  for (const pf of perFile) {
    if (!pf.ast) continue;
    const nameOf = (local) => (wanted.has(pf.imports.get(local)) ? pf.imports.get(local) : (wanted.has(local) ? local : null));
    const rec = (node, name) => ({ file: pf.file, fn: pf.enclosing(node.start), name, line: node.loc?.start.line ?? null });
    const visit = (node, parent, key, grand) => {
      if (node.type === 'Identifier') {
        const viaMember = parent?.type === 'MemberExpression' && key === 'property' && !parent.computed;
        const name = viaMember ? (wanted.has(node.name) ? node.name : null) : nameOf(node.name);
        if (name !== null) {
          const calledMember = viaMember && grand?.type === 'CallExpression' && grand.callee === parent;
          if (parent?.type === 'CallExpression' && key === 'callee') out.calls.push(rec(node, name));
          else if (calledMember) out.calls.push(rec(node, name));
          else if ((parent?.type === 'FunctionDeclaration' || parent?.type === 'FunctionExpression' || parent?.type === 'VariableDeclarator') && key === 'id') out.definitions.push(rec(node, name));
          else if (parent?.type === 'ImportSpecifier') { /* a named import: its calls are counted under the imported name */ }
          else if (parent?.type === 'ExportSpecifier' && !grand?.source) { /* `export { name }` of a local definition */ }
          else if (parent?.type === 'ExportSpecifier') { /* a re-export: recorded below, from the declaration's source */ }
          else out.references.push(rec(node, name));
        }
      } else if (node.type === 'Literal' && typeof node.value === 'string' && wanted.has(node.value)
        && parent?.type === 'MemberExpression' && key === 'property' && parent.computed) {
        // `x['closeIdeaBook'](…)` is a call; `x['closeIdeaBook']` alone is a reference
        if (grand?.type === 'CallExpression' && grand.callee === parent) out.calls.push(rec(node, node.value));
        else out.references.push(rec(node, node.value));
      } else if (node.type === 'ImportDeclaration') {
        for (const s of node.specifiers) {
          if (s.type !== 'ImportSpecifier') moduleUses.push({ ...rec(node, null), kind: s.type === 'ImportNamespaceSpecifier' ? 'namespace import' : 'default import', target: importedFile(pf.file, node.source.value) });
        }
      } else if (node.type === 'ImportExpression') {
        const src = node.source?.type === 'Literal' ? node.source.value : null;
        moduleUses.push({ ...rec(node, null), kind: 'dynamic import', target: importedFile(pf.file, src) });
      } else if ((node.type === 'ExportAllDeclaration' || node.type === 'ExportNamedDeclaration') && node.source) {
        moduleUses.push({ ...rec(node, null), kind: 're-export', target: importedFile(pf.file, node.source.value) });
      }
      for (const k of Object.keys(node)) {
        const v = node[k];
        if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === 'string') visit(c, node, k, parent); }
        else if (v && typeof v.type === 'string') visit(v, node, k, parent);
      }
    };
    visit(pf.ast, null, null, null);
  }
  const definingFiles = new Set(out.definitions.map((d) => d.file));
  for (const u of moduleUses) {
    if (u.target !== null && definingFiles.has(u.target)) out.moduleHandles.push({ file: u.file, fn: u.fn, line: u.line, kind: u.kind, module: u.target });
  }
  return out;
}
