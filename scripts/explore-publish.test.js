// scripts/explore-publish.test.js
//
// Explore — the founder's command (scripts/explore-publish.mjs), on the in-memory Firestore harness
// (api/_utils/__testsupport__/mandateFakeFirestore.js) with the real fetcher over committed documents
// (api/_utils/explore/__fixtures__/fixtureFetch.js). Nothing here reads an environment file or a credential, and
// nothing reaches the network: `runCli` is handed the in-memory db, a fixed clock, the files and the fetcher.
//
// What the rows hold:
//   • the command line: every bad line refused, --help touching nothing;
//   • THE GATES: not a founder reads nothing (the database is never opened, nothing is fetched); no contact address
//     fetches nothing; without --go a writing command prints what it would write and writes nothing;
//   • check and match write nothing, and read the collection only for a link outside the files;
//   • draft, publish (K-8's --accept-unmatched required and reported; matched afresh, never from a stored result),
//     the version rule's three cases, the batch, unpublish, publishedAt kept and revisedAt set, a refused story
//     writing nothing, and every write in `exploreStories` alone;
//   • status; and the script's own source: it writes nothing itself and calls no model.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli, parseArgs, idOfFile, EXIT, USAGE, COMMANDS } from './explore-publish.mjs';
import { makeMandateFakeDb } from '../api/_utils/__testsupport__/mandateFakeFirestore.js';
import { fixtureFetcher, allFoundRoutes, TEST_CONTACT } from '../api/_utils/explore/__fixtures__/fixtureFetch.js';
import { CONTACT_ENV } from '../api/_utils/explore/fetchSource.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const PILOT_DIR = path.join(ROOT, 'api', '_utils', 'explore', '__fixtures__', 'pilot');
const UID = 'founder-explore-7';
const OTHER = 'zz-not-a-founder-4410';
const OV = 'ai-buildout';
const DP = 'dominion-data-centers';
const pilot = (id) => JSON.parse(readFileSync(path.join(PILOT_DIR, `${id}.json`), 'utf8'));
const FILE = (id) => `stories/${id}.json`;
const T1 = new Date('2026-11-25T17:00:00.000Z');
const T2 = new Date('2026-12-02T17:00:00.000Z');

let savedFounders;
beforeEach(() => { savedFounders = process.env.MANDATE_FOUNDER_UIDS; process.env.MANDATE_FOUNDER_UIDS = `someone-else,${UID}`; });
afterEach(() => { if (savedFounders === undefined) delete process.env.MANDATE_FOUNDER_UIDS; else process.env.MANDATE_FOUNDER_UIDS = savedFounders; });

/** Every route a pilot link could take: found (all quotes on the page), or refused (403). */
const ALL_FOUND = allFoundRoutes([pilot(OV), pilot(DP)]);
const REFUSED = Object.fromEntries(Object.keys(ALL_FOUND).map((u) => [u, { status: 403 }]));
/** Some found, some refused: the overview's Microsoft and Amazon releases refuse. */
const MIXED = { ...ALL_FOUND, [pilot(OV).sources[3].url]: { status: 403 }, [pilot(OV).sources[4].url]: { status: 403 } };

/**
 * Run the command line. `files`: { id: record } (written as stories/<id>.json); `db`: the harness, or null for a
 * database that must never be opened. Returns the exit code, the printed lines, the parsed JSON (with --json), and
 * what was touched.
 */
async function cli(argv, { db = null, files = {}, routes = ALL_FOUND, now = T1, env = { [CONTACT_ENV]: TEST_CONTACT } } = {}) {
  const lines = [];
  const fetched = [];
  let opened = 0;
  let loaded = 0;
  const texts = Object.fromEntries(Object.entries(files).map(([id, rec]) => [path.resolve(FILE(id)), JSON.stringify(rec)]));
  const code = await runCli(argv, {
    getDb: () => { opened += 1; if (!db) throw new Error('the database was opened'); return db; },
    loadEnv: async () => { loaded += 1; },
    nowIso: () => now.toISOString(),
    print: (s) => lines.push(s),
    readFile: (p) => { if (!Object.hasOwn(texts, p)) throw Object.assign(new Error('missing'), { code: 'ENOENT' }); return texts[p]; },
    fetchDocument: fixtureFetcher(routes, { fetched }),
    serverTime: () => now,
    env,
  });
  const text = lines.join('\n');
  let json = null;
  if (argv.includes('--json')) json = JSON.parse(text);
  return { code, text, json, fetched, opened, loaded };
}
const both = { [OV]: pilot(OV), [DP]: pilot(DP) };
const fileArgs = (...ids) => ids.flatMap((id) => ['--file', FILE(id)]);
const stored = (db, id) => db._get(`exploreStories/${id}`);
const versions = (db) => Object.fromEntries([...db._store.entries()].map(([p, e]) => [p, e.version]));

describe('the command line', () => {
  it.each([
    [['publish-all'], /unknown command/],
    [['check', '--uid', UID], /check needs --file/],
    [['check', ...fileArgs(OV)], /--uid <uid> is required/],
    [['check', ...fileArgs(OV), '--uid', UID, '--go'], /"--go" is not an option of check/],
    [['match', ...fileArgs(OV), '--uid', UID, '--id', OV], /"--id" is not an option of match/],
    [['draft', ...fileArgs(OV), '--uid', UID, '--accept-unmatched'], /"--accept-unmatched" is not an option of draft/],
    [['publish', '--uid', UID], /publish needs --file <story.json> or --id <id>/],
    [['publish', ...fileArgs(OV), '--id', DP, '--uid', UID], /not both/],
    [['publish', '--file', 'stories/My Story.json', '--uid', UID], /is not a document id/],
    [['unpublish', '--id', 'a/b', '--uid', UID], /is not a document id/],
    [['check', '--file', '--uid', UID], /"--file" needs a value/],
    [['draft', ...fileArgs(OV), '--uid', UID, '--go=yes'], /"--go" takes no value/],
    [['status', '--uid', UID, '--uid', UID], /given twice/],
    [['status', '--uid', UID, '--force'], /unknown argument/],
  ])('%j is refused', async (argv, message) => {
    const r = await cli(argv);
    expect(r.code).toBe(EXIT.FAILED);
    expect(r.text).toMatch(message);
    expect([r.opened, r.loaded, r.fetched.length]).toEqual([0, 0, 0]);
  });

  it('--help prints the usage and touches nothing', async () => {
    const r = await cli(['publish', '--help']);
    expect(r.code).toBe(EXIT.DONE);
    expect(r.text).toBe(USAGE);
    expect([r.opened, r.loaded]).toEqual([0, 0]);
  });

  it('a story file\'s name is its document id; --file and --id repeat', () => {
    expect(idOfFile('a/b/ai-buildout.json')).toBe('ai-buildout');
    expect(parseArgs(['publish', '--id', OV, '--id', DP, '--uid', UID]).ids).toEqual([OV, DP]);
    expect(parseArgs(['draft', ...fileArgs(OV, DP), '--uid', UID]).files).toEqual([FILE(OV), FILE(DP)]);
  });
});

describe('the gates', () => {
  it.each(COMMANDS.map((c) => [c]))('%s: a uid not on the founder list reads nothing, fetches nothing, writes nothing', async (command) => {
    const args = command === 'status' ? [] : (command === 'unpublish' ? ['--id', OV] : fileArgs(OV, DP));
    const r = await cli([command, ...args, '--uid', OTHER, '--go'].filter((a) => a !== '--go' || ['draft', 'publish', 'unpublish'].includes(command)), { files: both });
    expect(r.code).toBe(EXIT.REFUSED);
    expect(r.text).toMatch(/REFUSED \(founder\)/);
    expect([r.opened, r.fetched.length]).toEqual([0, 0]);
    expect(r.loaded).toBe(1); // the environment file is loaded first, so the founder list can come from it
  });

  it('an empty founder list admits nobody', async () => {
    process.env.MANDATE_FOUNDER_UIDS = '';
    const r = await cli(['status', '--uid', UID]);
    expect([r.code, r.opened]).toEqual([EXIT.REFUSED, 0]);
  });

  it.each([['match'], ['draft'], ['publish']])('%s without a contact address fetches nothing and reads nothing (SQ-2)', async (command) => {
    const r = await cli([command, ...fileArgs(OV, DP), '--uid', UID], { files: both, env: {} });
    expect(r.code).toBe(EXIT.REFUSED);
    expect(r.text).toMatch(new RegExp(`REFUSED \\(contact\\): ${CONTACT_ENV} is not set`));
    expect([r.opened, r.fetched.length]).toEqual([0, 0]);
  });

  it('check needs no contact address: it fetches nothing', async () => {
    const r = await cli(['check', ...fileArgs(OV, DP), '--uid', UID], { files: both, env: {} });
    expect(r.code).toBe(EXIT.DONE);
    expect(r.fetched).toEqual([]);
  });

  it('the answer prints no uid', async () => {
    const r = await cli(['match', ...fileArgs(OV, DP), '--uid', UID, '--json'], { files: both });
    expect(r.text).not.toContain(UID);
    expect(r.text).not.toContain('someone-else');
  });
});

describe('check and match write nothing', () => {
  it('check on the two pilots: both pass, and the collection is not even opened (every link is among the files)', async () => {
    const r = await cli(['check', ...fileArgs(OV, DP), '--uid', UID, '--json'], { files: both });
    expect(r.code).toBe(EXIT.DONE);
    expect(r.json.stories.map((s) => [s.id, s.refused.length])).toEqual([[OV, 0], [DP, 0]]);
    expect(r.opened).toBe(0);
  });

  it('check on the deep story alone reads its parent from the collection; with no parent there, it is refused', async () => {
    const db = makeMandateFakeDb({ [`exploreStories/${OV}`]: { ...pilot(OV), status: 'draft', publishedAt: null } });
    const ok = await cli(['check', ...fileArgs(DP), '--uid', UID, '--json'], { db, files: both });
    expect([ok.code, ok.json.read]).toEqual([EXIT.DONE, [OV]]);
    const none = await cli(['check', ...fileArgs(DP), '--uid', UID], { db: makeMandateFakeDb(), files: both });
    expect(none.code).toBe(EXIT.REFUSED);
    expect(none.text).toMatch(/REFUSED\s+K-4\(e\)\s+parent\.storyId = "ai-buildout" — names no existing overview/);
  });

  it('match prints every source and figure, and writes nothing', async () => {
    const db = makeMandateFakeDb();
    const r = await cli(['match', ...fileArgs(OV, DP), '--uid', UID, '--json'], { db, files: both, routes: MIXED });
    expect(r.code).toBe(EXIT.DONE);
    const ov = r.json.stories[0];
    expect(ov.sources.map((s) => [s.id, s.by])).toEqual([['s1', 'machine'], ['s2', 'machine'], ['s3', 'machine'], ['s4', 'read'], ['s5', 'read'], ['s6', 'machine'], ['s7', 'machine']]);
    expect(ov.summary).toEqual({ carried: 4, sourced: 2, notChecked: 2, notReported: 0 });
    expect(db._store.size).toBe(0);
    const text = (await cli(['match', ...fileArgs(OV, DP), '--uid', UID], { files: both, routes: MIXED })).text;
    expect(text).toMatch(/summary\s+4 carried figure\(s\): 2 will arrive as sourced, 2 as not checked/);
    expect(text).toMatch(/why: the server answered 403/);
  });
});

describe('draft', () => {
  it('without --go prints exactly what it would write, and writes nothing', async () => {
    const db = makeMandateFakeDb();
    const r = await cli(['draft', ...fileArgs(OV, DP), '--uid', UID, '--json'], { db, files: both });
    expect(r.code).toBe(EXIT.REFUSED);
    expect(r.json.refused).toEqual([{ gate: 'go', message: 'not written: add --go to write it' }]);
    expect(r.json.plans.map((p) => [p.id, p.action])).toEqual([[OV, 'create'], [DP, 'create']]);
    expect(r.json.plans[0].document).toMatchObject({ status: 'draft', publishedAt: null, version: 5, kind: 'overview' });
    expect(db._store.size).toBe(0);
  });

  it('with --go stores both as drafts with this run\'s match results, in exploreStories alone', async () => {
    const db = makeMandateFakeDb();
    const r = await cli(['draft', ...fileArgs(OV, DP), '--uid', UID, '--go'], { db, files: both, routes: MIXED });
    expect(r.code).toBe(EXIT.DONE);
    expect([...db._store.keys()].sort()).toEqual([`exploreStories/${OV}`, `exploreStories/${DP}`]);
    const ov = stored(db, OV);
    expect(ov).toMatchObject({ status: 'draft', publishedAt: null, version: 5 });
    expect('revisedAt' in ov).toBe(false);
    expect(ov.sources[3].match).toEqual({ by: 'read', readAt: null, documentDate: null, textHash: null, rule: 1 });
    expect(ov.sources[0].match).toMatchObject({ by: 'machine', readAt: '2026-11-25T16:00:00.000Z', rule: 1 });
    expect(ov.questions[0].measures[0].cells.map((c) => c.matched)).toEqual([false, false, true, undefined]);
    expect(ov.questions[0].measures[0].cells[3].inputs.map((i) => i.matched)).toEqual([true, true]);
    expect('sample' in ov).toBe(false);
  });

  it('a story the check refuses writes nothing and fetches nothing', async () => {
    const db = makeMandateFakeDb();
    const broken = { ...pilot(DP), sample: false };
    const r = await cli(['draft', ...fileArgs(OV, DP), '--uid', UID, '--go'], { db, files: { [OV]: pilot(OV), [DP]: broken } });
    expect(r.code).toBe(EXIT.REFUSED);
    expect(r.text).toMatch(/REFUSED \(check\)/);
    expect([db._store.size, r.fetched.length]).toEqual([0, 0]);
  });

  it('a draft is never written over a published story', async () => {
    const db = makeMandateFakeDb();
    await cli(['publish', ...fileArgs(OV, DP), '--uid', UID, '--go'], { db, files: both });
    const before = versions(db);
    const r = await cli(['draft', ...fileArgs(OV, DP), '--uid', UID, '--go'], { db, files: both });
    expect(r.code).toBe(EXIT.REFUSED);
    expect(r.text).toMatch(/it is published at version 5: publish a higher version, or unpublish it first/);
    expect(versions(db)).toEqual(before);
  });
});

describe('publish', () => {
  it('an unmatched story is refused without --accept-unmatched: every unmatched quote listed, nothing written', async () => {
    const db = makeMandateFakeDb();
    const r = await cli(['publish', ...fileArgs(OV, DP), '--uid', UID, '--go', '--json'], { db, files: both, routes: MIXED });
    expect(r.code).toBe(EXIT.REFUSED);
    expect(r.json.refused[0]).toMatchObject({ gate: 'unmatched' });
    expect(r.json.stories[0].unmatched.map((f) => f.field)).toEqual([
      'sources[3]', 'sources[4]', 'questions[0].measures[0].cells[0].matched', 'questions[0].measures[0].cells[1].matched',
    ]);
    expect(db._store.size).toBe(0);
  });

  it('with --accept-unmatched it publishes, and says each unmatched figure arrives as not checked; the flag is never stored', async () => {
    const db = makeMandateFakeDb();
    const r = await cli(['publish', ...fileArgs(OV, DP), '--uid', UID, '--go', '--accept-unmatched', '--json'], { db, files: both, routes: MIXED });
    expect(r.code).toBe(EXIT.DONE);
    expect(r.json.written).toEqual([OV, DP]);
    expect(r.json.acceptance.map((a) => [a.id, a.symbol])).toEqual([[OV, 'MSFT'], [OV, 'AMZN']]);
    expect(r.json.acceptance[0].message).toMatch(/will arrive in an investigation as not checked/);
    const ov = stored(db, OV);
    expect(ov).toMatchObject({ status: 'published', publishedAt: T1 });
    expect(JSON.stringify(ov)).not.toMatch(/accept/i);
    expect(r.json.dates).toEqual([
      { id: OV, status: 'published', publishedAt: T1.toISOString(), revisedAt: null },
      { id: DP, status: 'published', publishedAt: T1.toISOString(), revisedAt: null },
    ]);
  });

  it('a story every quote of which a machine confirmed needs no flag', async () => {
    const db = makeMandateFakeDb();
    const r = await cli(['publish', ...fileArgs(OV, DP), '--uid', UID, '--go'], { db, files: both, routes: ALL_FOUND });
    expect(r.code).toBe(EXIT.DONE);
    expect(stored(db, DP).sources.every((s) => s.match.by === 'machine')).toBe(true);
  });

  it('a deep story whose overview is only a draft is refused: they go out together', async () => {
    const db = makeMandateFakeDb();
    await cli(['draft', ...fileArgs(OV, DP), '--uid', UID, '--go'], { db, files: both });
    const before = versions(db);
    const alone = await cli(['publish', ...fileArgs(DP), '--uid', UID, '--go'], { db, files: both });
    expect(alone.code).toBe(EXIT.REFUSED);
    expect(alone.text).toMatch(/"ai-buildout" is a draft story — publish them together/);
    expect(versions(db)).toEqual(before);
  });

  it('publish --id matches the stored story AFRESH: a stored match is never reused', async () => {
    const db = makeMandateFakeDb();
    await cli(['draft', ...fileArgs(OV, DP), '--uid', UID, '--go'], { db, files: both, routes: ALL_FOUND });
    expect(stored(db, DP).sources[0].match.by).toBe('machine');
    const refusedNow = await cli(['publish', '--id', OV, '--id', DP, '--uid', UID, '--go'], { db, routes: REFUSED });
    expect(refusedNow.code).toBe(EXIT.REFUSED); // every quote is unmatched in THIS run
    expect(refusedNow.fetched.length).toBeGreaterThan(0);
    const accepted = await cli(['publish', '--id', OV, '--id', DP, '--uid', UID, '--go', '--accept-unmatched'], { db, routes: REFUSED });
    expect(accepted.code).toBe(EXIT.DONE);
    expect(stored(db, DP).sources.map((s) => s.match.by)).toEqual(['read', 'read', 'read', 'read', 'read']);
    expect(stored(db, DP).status).toBe('published');
  });

  it('every write lands in exploreStories, and nowhere else', async () => {
    const db = makeMandateFakeDb();
    await cli(['draft', ...fileArgs(OV, DP), '--uid', UID, '--go'], { db, files: both });
    await cli(['publish', '--id', OV, '--id', DP, '--uid', UID, '--go', '--accept-unmatched'], { db });
    await cli(['unpublish', '--id', DP, '--uid', UID, '--go'], { db });
    expect([...db._store.keys()].every((p) => /^exploreStories\/[A-Za-z0-9_-]+$/.test(p))).toBe(true);
    expect(db._store.size).toBe(2);
  });
});

describe('the version rule, the batch, and the dates', () => {
  async function published() {
    const db = makeMandateFakeDb();
    const r = await cli(['publish', ...fileArgs(OV, DP), '--uid', UID, '--go'], { db, files: both, now: T1 });
    expect(r.code).toBe(EXIT.DONE);
    return db;
  }

  it('the same version with the same content is a no-op that says so', async () => {
    const db = await published();
    const before = versions(db);
    const r = await cli(['publish', ...fileArgs(OV, DP), '--uid', UID, '--go'], { db, files: both, now: T2 });
    expect(r.code).toBe(EXIT.DONE);
    expect(r.text).toMatch(/NO CHANGE\s+ai-buildout\s+noop: already published at version 5 with this content: nothing is written/);
    expect(versions(db)).toEqual(before);
  });

  it('the same version with different content is refused ("raise the version"), and nothing in the set is written', async () => {
    const db = await published();
    const before = versions(db);
    const changed = { ...pilot(OV), deck: 'A new deck.' };
    const r = await cli(['publish', ...fileArgs(OV, DP), '--uid', UID, '--go'], { db, files: { [OV]: changed, [DP]: { ...pilot(DP), version: 2 } }, now: T2 });
    expect(r.code).toBe(EXIT.REFUSED);
    expect(r.text).toMatch(/version 5 is already published with other content: raise the version/);
    expect(versions(db)).toEqual(before); // the deep story's valid new version is not written either: one transaction
    expect(stored(db, DP).version).toBe(1);
  });

  it('a higher version is written: publishedAt kept from the first publish, revisedAt set now', async () => {
    const db = await published();
    const r = await cli(['publish', ...fileArgs(OV, DP), '--uid', UID, '--go'], { db, files: { [OV]: { ...pilot(OV), version: 6, deck: 'A new deck.' }, [DP]: pilot(DP) }, now: T2 });
    expect(r.code).toBe(EXIT.DONE);
    expect(stored(db, OV)).toMatchObject({ version: 6, deck: 'A new deck.', publishedAt: T1, revisedAt: T2 });
    expect(stored(db, DP)).toMatchObject({ version: 1, publishedAt: T1 });
    expect('revisedAt' in stored(db, DP)).toBe(false);
  });

  it('a lower version is refused', async () => {
    const db = await published();
    const r = await cli(['publish', ...fileArgs(OV, DP), '--uid', UID, '--go'], { db, files: { [OV]: { ...pilot(OV), version: 4 }, [DP]: pilot(DP) }, now: T2 });
    expect(r.code).toBe(EXIT.REFUSED);
    expect(r.text).toMatch(/the stored version is 5; a new one is higher, not 4/);
  });

  it('review A4: unpublish, then a draft of OTHER content at the same version, is refused — the rule cannot be walked round', async () => {
    const db = await published();
    await cli(['unpublish', '--id', DP, '--uid', UID, '--go'], { db });
    const before = versions(db);
    const other = { [OV]: pilot(OV), [DP]: { ...pilot(DP), deck: 'Another deck.' } };
    const draft = await cli(['draft', ...fileArgs(DP), '--uid', UID, '--go'], { db, files: other, now: T2 });
    expect(draft.code).toBe(EXIT.REFUSED);
    expect(draft.text).toMatch(/version 1 was published with other content: raise the version/);
    expect(versions(db)).toEqual(before);
    const same = await cli(['draft', ...fileArgs(DP), '--uid', UID, '--go'], { db, files: both, now: T2 });
    expect(same.code).toBe(EXIT.DONE); // the same content at the same version may be drafted again
    const raised = await cli(['draft', ...fileArgs(DP), '--uid', UID, '--go'], { db, files: { [DP]: { ...other[DP], version: 2 } }, now: T2 });
    expect(raised.code).toBe(EXIT.DONE);
    expect(stored(db, DP)).toMatchObject({ status: 'draft', version: 2, deck: 'Another deck.', publishedAt: T1 });
  });

  it('review H4: a no-op keeps the stored story and its match, and says so — no "will arrive as not checked" for it', async () => {
    const db = await published(); // every quote found, stored by machine
    const before = versions(db);
    const r = await cli(['publish', ...fileArgs(OV, DP), '--uid', UID, '--go', '--accept-unmatched', '--json'], { db, files: both, routes: REFUSED, now: T2 });
    expect(r.code).toBe(EXIT.DONE);
    expect(r.json.written).toEqual([]);
    expect(r.json.acceptance).toEqual([]);
    expect(r.json.kept.map((k) => k.id)).toEqual([OV, DP]);
    expect(r.json.kept[0].message).toMatch(/this run's match above is shown for information and is NOT recorded/);
    expect(versions(db)).toEqual(before);
    expect(stored(db, OV).sources.every((s) => s.match.by === 'machine')).toBe(true);
  });

  it('unpublish: the one-step way back; publishedAt kept; published again later at the same version, revisedAt set', async () => {
    const db = await published();
    const dry = await cli(['unpublish', '--id', DP, '--uid', UID], { db });
    expect([dry.code, stored(db, DP).status]).toEqual([EXIT.REFUSED, 'published']);
    const r = await cli(['unpublish', '--id', DP, '--uid', UID, '--go'], { db });
    expect(r.code).toBe(EXIT.DONE);
    expect(stored(db, DP)).toMatchObject({ status: 'draft', version: 1, publishedAt: T1 });
    expect(stored(db, DP).sources[0].match.by).toBe('machine'); // everything else kept
    const again = await cli(['unpublish', '--id', DP, '--uid', UID, '--go'], { db });
    expect(again.text).toMatch(/it is already draft: nothing is written/);
    const unknown = await cli(['unpublish', '--id', 'no-such-story', '--uid', UID, '--go'], { db });
    expect(unknown.code).toBe(EXIT.REFUSED);
    const back = await cli(['publish', '--id', DP, '--uid', UID, '--go'], { db, now: T2 });
    expect(back.code).toBe(EXIT.DONE);
    expect(stored(db, DP)).toMatchObject({ status: 'published', publishedAt: T1, revisedAt: T2 });
  });

  it('unpublishing an overview notes the published deep story that links to it, and still works', async () => {
    const db = await published();
    const r = await cli(['unpublish', '--id', OV, '--uid', UID, '--go'], { db });
    expect(r.code).toBe(EXIT.DONE);
    expect(r.text).toMatch(/"dominion-data-centers" is published and links to a story being unpublished; it stays published/);
  });
});

describe('status', () => {
  it('an empty collection, then the stories as stored', async () => {
    const db = makeMandateFakeDb();
    expect((await cli(['status', '--uid', UID], { db })).text).toMatch(/collection\s+exploreStories: 0 stories/);
    await cli(['draft', ...fileArgs(OV, DP), '--uid', UID, '--go'], { db, files: both, routes: MIXED });
    const r = await cli(['status', '--uid', UID, '--json'], { db });
    expect(r.json.stories.map((s) => [s.id, s.kind, s.status, s.version])).toEqual([[OV, 'overview', 'draft', 5], [DP, 'deep', 'draft', 1]]);
    expect(r.json.stories[0].doors).toEqual([{ connectionId: 'power', leadsToStory: DP }]);
    expect(r.json.stories[1].parent).toEqual({ storyId: OV, connectionId: 'power' });
    expect(r.json.stories[0].match).toEqual({ sources: 7, machine: 5, read: 2, none: 0, figures: { carried: 4, sourced: 2, notReported: 0, notChecked: 2 } });
    const one = await cli(['status', '--id', DP, '--id', 'missing-one', '--uid', UID, '--json'], { db });
    expect([one.json.stories.map((s) => s.id), one.json.missing]).toEqual([[DP], ['missing-one']]);
  });
});

describe('the code itself', () => {
  const src = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');
  const explore = readdirSync(path.join(ROOT, 'api', '_utils', 'explore')).filter((f) => f.endsWith('.js') && !f.includes('.test.')).map((f) => `api/_utils/explore/${f}`);

  it('the script writes nothing itself: no write call, no transaction, no batch', () => {
    expect(src('scripts/explore-publish.mjs')).not.toMatch(/\.(set|update|delete|create|batch)\(|runTransaction/);
  });

  it('the writer names one collection, the page\'s own, and every other module names none', () => {
    expect(src('api/_utils/explore/storyWriter.js').match(/\.collection\(([^)]*)\)/g)).toEqual(['.collection(COLLECTION)', '.collection(COLLECTION)']);
    for (const f of explore.filter((x) => !x.endsWith('storyWriter.js'))) expect(src(f)).not.toMatch(/\.collection\(/);
  });

  it('no model and no provider is called anywhere in this build', () => {
    for (const f of [...explore, 'scripts/explore-publish.mjs']) {
      expect(src(f)).not.toMatch(/anthropic|openai|callModel|messages\.create|eodhd|EODHD|\bfetch\(/i);
    }
  });

  // A synchronous walk of all of src/: under a loaded machine it took up to 10 s (reviews H/A26), so its own limit.
  it('nothing under src/ imports this code or the PDF library (the client bundle never holds them)', { timeout: 60_000 }, () => {
    const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));
    // An import specifier naming the PDF library, this build's server code or the script (static, re-export, dynamic).
    const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"`][^'"`]*(?:unpdf|_utils\/explore\/|explore-publish\.mjs)/;
    const offenders = walk(path.join(ROOT, 'src')).filter((f) => /\.(js|jsx|mjs|ts|tsx)$/.test(f)).filter((f) => SPECIFIER.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
