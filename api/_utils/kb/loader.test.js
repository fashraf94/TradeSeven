// api/_utils/kb/loader.test.js
//
// KB-0 — THE LOADER (Shared Research spec V1.2, Amendment A §A3.2–§A3.4, §A5).
// Each refusal on its own, from a deep copy of the real package with ONE
// defect, asserting the exact reason (so a row fails when an earlier or later
// check answers instead); authorization with injected lists; the two entry
// points; the answer's eight fields; the shipped (empty) list; never throws.
//
// The import of the loader is never mocked: the real package is what it reads.

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
  KB_PACKAGE_SCHEMA,
  KB_AUDIENCES,
  KB_REFUSALS,
  verifyParts,
  verifyPackage,
  isAuthorizationEntry,
  loadAuthorizedMethod,
  authorizedMethodFor,
} from './loader.js';
import { KB_PACKAGES } from './packages/index.js';

const ID = 'KB-IDEA-EVALUATION-001';
const VERSION = '0.1';
const CONSUMER = 'shared_research.observation';
const METHOD_SHA256 = 'b0688fb33cdd5b16835a5a70f7fcef7ca79d00facced233d1529d26b4e77854e';
const ACCEPTANCE_SHA256 = 'ec709781b80d2deeb325702faccb7a90abaa0c244c96103f0e956f81d26a08ee';
const DRIVE_PATH = /[A-Za-z]:\\/;

const sha = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const REAL = KB_PACKAGES.find((p) => p.id === ID && p.version === VERSION);

/** A deep copy of the real package row, free to damage. */
function copyRow() {
  return structuredClone({ id: REAL.id, version: REAL.version, exportJson: REAL.exportJson, acceptance: REAL.acceptance, register: REAL.register });
}

/** Change one character of a string, away from its ends. */
function oneCharChanged(text, at = Math.floor(text.length / 2)) {
  const c = text[at] === 'x' ? 'y' : 'x';
  return text.slice(0, at) + c + text.slice(at + 1);
}

/** Flip the last hex digit. */
const otherHex = (hex) => hex.slice(0, -1) + (hex.endsWith('0') ? '1' : '0');

/** A well-formed entry for the real package (override any field). */
function entry(overrides = {}) {
  return {
    id: ID,
    version: VERSION,
    sha256: METHOD_SHA256,
    acceptanceSha256: ACCEPTANCE_SHA256,
    consumers: [CONSUMER],
    audience: 'allowlist',
    authorizedAt: '2026-11-13T17:00:00Z',
    authorizedBy: 'founder',
    evidenceRef: 'docs/approvals/KB_TEST_ENTRY.md',
    ...overrides,
  };
}

const yes = () => true;
const load = (authorizations, req = {}) => loadAuthorizedMethod({ id: ID, version: VERSION, consumer: CONSUMER, inAudience: yes, ...req }, { authorizations });
const offer = (authorizations, req = {}) => authorizedMethodFor({ consumer: CONSUMER, inAudience: yes, ...req }, { authorizations });
const verifyRow = (row, req = { id: ID, version: VERSION }) => verifyPackage(req, { packages: [row] });

describe('the constants', () => {
  it('the ten refusals, in check order; the schema; the two audiences', () => {
    expect(KB_REFUSALS).toEqual(['missing', 'schema', 'identity', 'not_accepted', 'corrupt', 'acceptance_mismatch', 'register_mismatch', 'not_authorized', 'scope', 'audience']);
    expect(KB_PACKAGE_SCHEMA).toBe('fantasytrades.kb-method-package/1');
    expect(KB_AUDIENCES).toEqual(['allowlist', 'all']);
    expect(Object.isFrozen(KB_REFUSALS) && Object.isFrozen(KB_AUDIENCES)).toBe(true);
  });

  it('the control: the undamaged copy verifies (so every refusal below is its one defect)', () => {
    expect(REAL).toBeDefined();
    const v = verifyRow(copyRow());
    expect(v.ok).toBe(true);
    expect(v.method.sha256).toBe(METHOD_SHA256);
    expect(v.method.acceptanceSha256).toBe(ACCEPTANCE_SHA256);
  });
});

describe('check 1 — missing', () => {
  it('an unknown id, and an unknown version, of the real list', () => {
    expect(verifyPackage({ id: 'KB-UNKNOWN-001', version: VERSION })).toEqual({ ok: false, reason: 'missing' });
    expect(verifyPackage({ id: ID, version: '0.2' })).toEqual({ ok: false, reason: 'missing' });
  });

  it.each([
    ['the export', (r) => { delete r.exportJson; }],
    ['the acceptance wrapper', (r) => { delete r.acceptance; }],
    ['the register wrapper', (r) => { delete r.register; }],
    ['the acceptance text', (r) => { r.acceptance = { path: r.acceptance.path }; }],
    ['the register text', (r) => { r.register.text = 42; }],
    ['the export as a string', (r) => { r.exportJson = JSON.stringify(r.exportJson); }],
  ])('a part absent: %s', (_label, damage) => {
    const row = copyRow();
    damage(row);
    expect(verifyRow(row)).toEqual({ ok: false, reason: 'missing' });
  });

  it('no package list, an empty one, and verifyParts without a part', () => {
    expect(verifyPackage({ id: ID, version: VERSION }, { packages: 'nope' })).toEqual({ ok: false, reason: 'missing' });
    expect(verifyPackage({ id: ID, version: VERSION }, { packages: [] })).toEqual({ ok: false, reason: 'missing' });
    const row = copyRow();
    expect(verifyParts({ id: ID, version: VERSION, exportJson: row.exportJson, acceptanceText: row.acceptance.text })).toEqual({ ok: false, reason: 'missing' });
  });
});

describe('check 2 — schema', () => {
  it.each([
    ['another schema', (e) => { e.schema = 'fantasytrades.kb-method-package/2'; }],
    ['no schema', (e) => { delete e.schema; }],
    ['no title', (e) => { delete e.title; }],
    ['no acceptance date', (e) => { delete e.acceptance.date; }],
  ])('%s', (_label, damage) => {
    const row = copyRow();
    damage(row.exportJson);
    expect(verifyRow(row)).toEqual({ ok: false, reason: 'schema' });
  });
});

describe('check 3 — identity', () => {
  it.each([
    ['the export names another id', (e) => { e.id = 'KB-OTHER-001'; }],
    ['the export names another version', (e) => { e.version = '0.2'; }],
  ])('%s', (_label, damage) => {
    const row = copyRow();
    damage(row.exportJson);
    expect(verifyRow(row)).toEqual({ ok: false, reason: 'identity' });
  });

  it('verifyParts asked for another method than the export', () => {
    const row = copyRow();
    expect(verifyParts({ id: ID, version: '9.9', exportJson: row.exportJson, acceptanceText: row.acceptance.text, registerText: row.register.text })).toEqual({ ok: false, reason: 'identity' });
  });
});

describe('check 4 — not_accepted', () => {
  it.each([
    ['status reviewed_candidate', (e) => { e.status = 'reviewed_candidate'; }],
    ['test_only: true', (e) => { e.test_only = true; }],
    ['test_only: "true" (any value but false)', (e) => { e.test_only = 'true'; }],
    ['decision reject', (e) => { e.acceptance.decision = 'reject'; }],
  ])('%s', (_label, damage) => {
    const row = copyRow();
    damage(row.exportJson);
    expect(verifyRow(row)).toEqual({ ok: false, reason: 'not_accepted' });
  });

  it('test_only: false is no refusal', () => {
    const row = copyRow();
    row.exportJson.test_only = false;
    expect(verifyRow(row).ok).toBe(true);
  });
});

describe('check 5 — corrupt', () => {
  it.each([
    ['one character of method_text changed', (e) => { e.method_text = oneCharChanged(e.method_text); }],
    ['content_hash.value changed', (e) => { e.content_hash.value = otherHex(e.content_hash.value); }],
    ['acceptance.content_sha256 changed', (e) => { e.acceptance.content_sha256 = otherHex(e.acceptance.content_sha256); }],
    ['the algorithm is not sha256', (e) => { e.content_hash.algorithm = 'sha512'; }],
    ['no content_hash', (e) => { delete e.content_hash; }],
  ])('%s', (_label, damage) => {
    const row = copyRow();
    damage(row.exportJson);
    expect(verifyRow(row)).toEqual({ ok: false, reason: 'corrupt' });
  });
});

describe('check 6 — acceptance_mismatch', () => {
  it('one character of the acceptance text changed', () => {
    const row = copyRow();
    row.acceptance.text = oneCharChanged(row.acceptance.text);
    expect(verifyRow(row)).toEqual({ ok: false, reason: 'acceptance_mismatch' });
  });

  // The record's fields: the altered text is RE-HASHED into the export's
  // evidence_sha256, so the hash comparison passes and the field comparison
  // is the one that answers. The control row proves the technique.
  const reRecorded = (mutateRecord) => {
    const row = copyRow();
    const record = JSON.parse(row.acceptance.text);
    mutateRecord(record);
    row.acceptance.text = JSON.stringify(record, null, 2);
    row.exportJson.acceptance.evidence_sha256 = sha(row.acceptance.text);
    return row;
  };

  it('control: a re-serialized, unchanged record re-hashed into the export verifies', () => {
    expect(verifyRow(reRecorded(() => {})).ok).toBe(true);
  });

  it.each([
    ['id', (r) => { r.id = 'KB-OTHER-001'; }],
    ['version', (r) => { r.version = '0.2'; }],
    ['decision', (r) => { r.decision = 'reject'; }],
    ['content_sha256', (r) => { r.content_sha256 = otherHex(r.content_sha256); }],
  ])("the record's %s disagrees (hash re-bound)", (_label, mutate) => {
    expect(verifyRow(reRecorded(mutate))).toEqual({ ok: false, reason: 'acceptance_mismatch' });
  });

  it('a record that is not a JSON object (hash re-bound)', () => {
    for (const text of ['not json', '[1,2]', 'null']) {
      const row = copyRow();
      row.acceptance.text = text;
      row.exportJson.acceptance.evidence_sha256 = sha(text);
      expect(verifyRow(row)).toEqual({ ok: false, reason: 'acceptance_mismatch' });
    }
  });
});

describe('check 7 — register_mismatch', () => {
  it('one character of the register text changed', () => {
    const row = copyRow();
    row.register.text = oneCharChanged(row.register.text);
    expect(verifyRow(row)).toEqual({ ok: false, reason: 'register_mismatch' });
  });

  it("the verified record binds another register (record re-bound to the export)", () => {
    const row = copyRow();
    const record = JSON.parse(row.acceptance.text);
    record.source_register.sha256 = otherHex(record.source_register.sha256);
    row.acceptance.text = JSON.stringify(record);
    row.exportJson.acceptance.evidence_sha256 = sha(row.acceptance.text);
    expect(verifyRow(row)).toEqual({ ok: false, reason: 'register_mismatch' });
  });
});

describe('checks 1–7 — an unexpected exception is corrupt', () => {
  it('a throwing getter in the export, in a package row, and in the request', () => {
    const row = copyRow();
    Object.defineProperty(row.exportJson, 'schema', { get() { throw new Error('boom'); } });
    expect(verifyRow(row)).toEqual({ ok: false, reason: 'corrupt' });
    const hostileRow = { get id() { throw new Error('boom'); } };
    expect(verifyPackage({ id: ID, version: VERSION }, { packages: [hostileRow] })).toEqual({ ok: false, reason: 'corrupt' });
    expect(verifyPackage({ get id() { throw new Error('boom'); } })).toEqual({ ok: false, reason: 'corrupt' });
    expect(loadAuthorizedMethod({ get version() { throw new Error('boom'); } }, { authorizations: [entry()] })).toEqual({ ok: false, reason: 'corrupt' });
  });
});

describe('isAuthorizationEntry — the shape (§A3.4)', () => {
  it('a well-formed entry, with and without newSessions, with an offset instant', () => {
    expect(isAuthorizationEntry(entry())).toBe(true);
    expect(isAuthorizationEntry(entry({ newSessions: false }))).toBe(true);
    expect(isAuthorizationEntry(entry({ newSessions: true, audience: 'all' }))).toBe(true);
    expect(isAuthorizationEntry(entry({ authorizedAt: '2026-11-13T11:00:00.123-06:00' }))).toBe(true);
  });

  const without = (key) => { const e = entry(); delete e[key]; return e; };
  it.each([
    ['no id', without('id')],
    ['an empty version', entry({ version: '' })],
    ['sha256 in capitals', entry({ sha256: METHOD_SHA256.toUpperCase() })],
    ['sha256 of 63 digits', entry({ sha256: METHOD_SHA256.slice(1) })],
    ['no acceptanceSha256', without('acceptanceSha256')],
    ['consumers empty', entry({ consumers: [] })],
    ['a consumer empty', entry({ consumers: [CONSUMER, ''] })],
    ['consumers a string', entry({ consumers: CONSUMER })],
    ['an unknown audience', entry({ audience: 'everyone' })],
    ['newSessions not a boolean', entry({ newSessions: 'no' })],
    ['authorizedAt not an instant', entry({ authorizedAt: 'yesterday' })],
    ['authorizedAt a date only', entry({ authorizedAt: '2026-11-13' })],
    ['authorizedAt month 13', entry({ authorizedAt: '2026-13-01T00:00:00Z' })],
    ['no authorizedBy', without('authorizedBy')],
    ['an empty evidenceRef', entry({ evidenceRef: '' })],
    ['an unknown key (a misspelt newSessions)', entry({ newSession: false })],
    ['null', null],
    ['an array', [entry()]],
  ])('malformed: %s', (_label, e) => {
    expect(isAuthorizationEntry(e)).toBe(false);
  });
});

describe('check 8 — not_authorized', () => {
  it.each([
    ['no entry', []],
    ['an entry with another sha256', [entry({ sha256: otherHex(METHOD_SHA256) })]],
    ['an entry with another acceptanceSha256', [entry({ acceptanceSha256: otherHex(ACCEPTANCE_SHA256) })]],
    ['an entry for another version', [entry({ version: '0.2' })]],
    ['a malformed entry (otherwise right)', [entry({ authorizedAt: 'yesterday' })]],
    ['a list that is not a list', 'nope'],
  ])('loadAuthorizedMethod: %s', (_label, list) => {
    expect(load(list)).toEqual({ ok: false, reason: 'not_authorized' });
  });

  it('authorizedMethodFor: no entry, wrong hashes, a malformed entry', () => {
    expect(offer([])).toEqual({ ok: false, reason: 'not_authorized' });
    expect(offer([entry({ sha256: otherHex(METHOD_SHA256) })])).toEqual({ ok: false, reason: 'not_authorized' });
    expect(offer([entry({ acceptanceSha256: otherHex(ACCEPTANCE_SHA256) })])).toEqual({ ok: false, reason: 'not_authorized' });
    expect(offer([entry({ newSession: false })])).toEqual({ ok: false, reason: 'not_authorized' });
  });

  it('a malformed entry is IGNORED, not counted: beside a good one for the same consumer, the good one serves', () => {
    const list = [entry({ authorizedBy: '' }), entry()];
    expect(load(list).ok).toBe(true);
    expect(offer(list).ok).toBe(true);
  });

  it('an unexpected exception in check 8 is not_authorized', () => {
    const hostile = new Proxy([entry()], { get(t, k) { if (k === 'length') throw new Error('boom'); return Reflect.get(t, k); } });
    expect(load(hostile)).toEqual({ ok: false, reason: 'not_authorized' });
    expect(offer(hostile)).toEqual({ ok: false, reason: 'not_authorized' });
  });
});

describe('check 9 — scope', () => {
  it("the entry's consumers do not include the caller's", () => {
    expect(load([entry({ consumers: ['research_modal.analysis'] })])).toEqual({ ok: false, reason: 'scope' });
    expect(load([entry()], { consumer: 'research_modal.analysis' })).toEqual({ ok: false, reason: 'scope' });
    expect(load([entry()], { consumer: undefined })).toEqual({ ok: false, reason: 'scope' });
  });

  it('two entries for this version and consumer are ambiguous: not_authorized', () => {
    expect(load([entry(), entry({ audience: 'all' })])).toEqual({ ok: false, reason: 'not_authorized' });
  });

  it('an unexpected exception in check 9 is scope', () => {
    const req = { id: ID, version: VERSION, inAudience: yes, get consumer() { throw new Error('boom'); } };
    expect(loadAuthorizedMethod(req, { authorizations: [entry()] })).toEqual({ ok: false, reason: 'scope' });
  });
});

describe('check 10 — audience', () => {
  it.each([
    ['the function answers false', [entry()], { inAudience: () => false }],
    ['the function answers a truthy non-true', [entry()], { inAudience: () => 'yes' }],
    ['the function is missing', [entry()], { inAudience: undefined }],
    ['the function throws', [entry()], { inAudience: () => { throw new Error('boom'); } }],
    ["the entry's audience is unknown", [entry({ audience: 'everyone' })], { inAudience: yes }],
    ["the entry has no audience", [(() => { const e = entry(); delete e.audience; return e; })()], { inAudience: yes }],
  ])('loadAuthorizedMethod: %s', (_label, list, req) => {
    expect(load(list, req)).toEqual({ ok: false, reason: 'audience' });
  });

  it('authorizedMethodFor answers the same (an unknown audience included)', () => {
    expect(offer([entry()], { inAudience: () => false })).toEqual({ ok: false, reason: 'audience' });
    expect(offer([entry({ audience: 'everyone' })])).toEqual({ ok: false, reason: 'audience' });
  });

  it("the function is asked about the entry's audience", () => {
    const asked = [];
    const r = load([entry({ audience: 'all' })], { inAudience: (a) => { asked.push(a); return a === 'all'; } });
    expect(r.ok).toBe(true);
    expect(asked).toEqual(['all']);
  });

  it('a throwing inAudience getter is audience', () => {
    const req = { id: ID, version: VERSION, consumer: CONSUMER, get inAudience() { throw new Error('boom'); } };
    expect(loadAuthorizedMethod(req, { authorizations: [entry()] })).toEqual({ ok: false, reason: 'audience' });
  });
});

describe('the two entry points', () => {
  it('a newSessions: false entry loads through loadAuthorizedMethod and is not offered by authorizedMethodFor', () => {
    const list = [entry({ newSessions: false })];
    expect(load(list).ok).toBe(true);
    expect(offer(list)).toEqual({ ok: false, reason: 'not_authorized' });
  });

  it('two entries taking new sessions for one consumer → not_authorized', () => {
    const list = [entry(), entry({ version: '0.2', sha256: otherHex(METHOD_SHA256) })];
    expect(offer(list)).toEqual({ ok: false, reason: 'not_authorized' });
  });

  it('authorizedMethodFor runs checks 1–10 on the offered entry: an uncommitted version is missing', () => {
    expect(offer([entry({ version: '0.2' })])).toEqual({ ok: false, reason: 'missing' });
  });

  it("an entry for another consumer is not offered to this one", () => {
    expect(offer([entry({ consumers: ['research_modal.analysis'] })])).toEqual({ ok: false, reason: 'not_authorized' });
  });
});

describe('the answer', () => {
  const EIGHT = ['id', 'version', 'sha256', 'title', 'text', 'acceptedAt', 'consumer', 'audience'];

  it.each([
    ['loadAuthorizedMethod', () => load([entry()])],
    ['authorizedMethodFor', () => offer([entry()])],
  ])('%s answers exactly the eight fields, with the verified values', (_label, call) => {
    const r = call();
    expect(Object.keys(r)).toEqual(['ok', 'method']);
    expect(r.ok).toBe(true);
    expect(Object.keys(r.method).sort()).toEqual([...EIGHT].sort());
    expect(r.method).toEqual({
      id: ID,
      version: VERSION,
      sha256: METHOD_SHA256,
      title: 'Evaluating an Idea',
      text: REAL.exportJson.method_text,
      acceptedAt: REAL.exportJson.acceptance.date,
      consumer: CONSUMER,
      audience: 'allowlist',
    });
    expect(Object.isFrozen(r) && Object.isFrozen(r.method)).toBe(true);
  });

  it('verifyPackage and verifyParts answer the six plus acceptanceSha256, nothing else', () => {
    const SEVEN = ['id', 'version', 'sha256', 'acceptanceSha256', 'title', 'text', 'acceptedAt'].sort();
    const p = verifyPackage({ id: ID, version: VERSION });
    expect(Object.keys(p.method).sort()).toEqual(SEVEN);
    const row = copyRow();
    const q = verifyParts({ id: ID, version: VERSION, exportJson: row.exportJson, acceptanceText: row.acceptance.text, registerText: row.register.text });
    expect(Object.keys(q.method).sort()).toEqual(SEVEN);
    expect(q.method).toEqual(p.method);
  });

  it('no value is a local path, and no provenance block leaves (the package itself does hold local paths)', () => {
    expect(JSON.stringify(REAL.exportJson.source)).toMatch(DRIVE_PATH);
    for (const r of [load([entry()]), offer([entry()]), verifyPackage({ id: ID, version: VERSION })]) {
      for (const value of Object.values(r.method)) {
        // Strings only: no block (source, review, acceptance, exporter, the record, the register) can ride along.
        expect(typeof value).toBe('string');
        expect(value).not.toMatch(DRIVE_PATH);
      }
      expect(JSON.stringify(r)).not.toContain(REAL.exportJson.exporter);
      expect(JSON.stringify(r)).not.toContain(REAL.register.text.slice(0, 200));
    }
  });
});

describe('the shipped list (empty)', () => {
  it('both entry points answer not_authorized for the real package, whatever the audience', () => {
    expect(loadAuthorizedMethod({ id: ID, version: VERSION, consumer: CONSUMER, inAudience: yes })).toEqual({ ok: false, reason: 'not_authorized' });
    expect(authorizedMethodFor({ consumer: CONSUMER, inAudience: yes })).toEqual({ ok: false, reason: 'not_authorized' });
    expect(verifyPackage({ id: ID, version: VERSION }).ok).toBe(true);
  });
});

describe('never throws', () => {
  const hostile = new Proxy({}, {
    get() { throw new Error('boom'); },
    has() { throw new Error('boom'); },
    ownKeys() { throw new Error('boom'); },
    getOwnPropertyDescriptor() { throw new Error('boom'); },
  });
  const GARBAGE = [undefined, null, 0, 42, '', 'x', true, [], {}, [1, 2], () => {}, Symbol('s'), hostile];
  const label = (g) => (typeof g === 'symbol' ? 'symbol' : g === hostile ? 'a hostile proxy' : JSON.stringify(g) ?? String(g));

  it.each(GARBAGE.map((g) => [label(g), g]))('every entry point, given %s, answers a refusal', (_label, g) => {
    // As deps, anything but an object reads as none given: the real list, which verifies.
    const asDeps = verifyPackage({ id: ID, version: VERSION }, g);
    if (g === hostile) expect(asDeps).toEqual({ ok: false, reason: 'corrupt' });
    else expect(asDeps.ok).toBe(true);
    for (const r of [
      verifyParts(g),
      verifyPackage(g),
      loadAuthorizedMethod(g),
      loadAuthorizedMethod({ id: ID, version: VERSION, consumer: CONSUMER, inAudience: yes }, g),
      authorizedMethodFor(g),
      authorizedMethodFor({ consumer: CONSUMER, inAudience: yes }, g),
    ]) {
      expect(r.ok).toBe(false);
      expect(KB_REFUSALS).toContain(r.reason);
    }
    expect(isAuthorizationEntry(g)).toBe(false);
  });

  it('hostile deps: throwing getters for packages and authorizations', () => {
    const deps = { get packages() { throw new Error('boom'); }, get authorizations() { throw new Error('boom'); } };
    expect(verifyPackage({ id: ID, version: VERSION }, deps)).toEqual({ ok: false, reason: 'corrupt' });
    expect(authorizedMethodFor({ consumer: CONSUMER, inAudience: yes }, deps)).toEqual({ ok: false, reason: 'not_authorized' });
    const authOnly = { get authorizations() { throw new Error('boom'); } };
    expect(loadAuthorizedMethod({ id: ID, version: VERSION, consumer: CONSUMER, inAudience: yes }, authOnly)).toEqual({ ok: false, reason: 'not_authorized' });
  });
});
