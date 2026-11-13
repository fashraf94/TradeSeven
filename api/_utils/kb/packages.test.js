// api/_utils/kb/packages.test.js
//
// KB-0 — THE COMMITTED PACKAGE, THE IMPORT SCRIPT, THE SHIPPED LIST
// (Shared Research spec V1.2, Amendment A §A2, §A3.1, §A3.4, §A5).
//
//   The pins       the four hashes of §A2 (the export's raw bytes read from
//                  disk; the three texts through the imports), LF and no
//                  byte-order mark, each wrapper its own canonical form.
//   The packages   every row of KB_PACKAGES passes verifyPackage.
//   The script     packageFilesOf over an in-memory release built from the
//                  committed parts reproduces the three committed files byte
//                  for byte, and refuses, returning no files, on each defect.
//   The list       KB_APP_USE is [] — THE PIN A LATER FOUNDER PR MOVES WITH
//                  THE FIRST ENTRY (Amendment A §A6 step 5). The other list
//                  rules are vacuous today and bind from that entry on; each
//                  is proven against a planted list here.

import { describe, it, expect } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, writeFileSync, mkdirSync, readdirSync, cpSync, symlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KB_PACKAGES } from './packages/index.js';
import { KB_APP_USE } from './authorizations.js';
import { verifyPackage, isAuthorizationEntry } from './loader.js';
import { packageFilesOf } from '../../../scripts/kb/import-release.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const PKG_DIR = path.join(HERE, 'packages');
const SCRIPT = path.join(REPO, 'scripts', 'kb', 'import-release.mjs');

const ID = 'KB-IDEA-EVALUATION-001';
const VERSION = '0.1';
const FILES = {
  export: 'KB-IDEA-EVALUATION-001-v0.1.export.json',
  acceptance: 'KB-IDEA-EVALUATION-001-v0.1.acceptance.json',
  register: 'KB-CONTENT-001.source-register.json',
};
const PINS = {
  exportFile: '6287e493ef919402f942ee0e60544b32069f7ff7bb15c9374088a073006b79ac',
  methodText: 'b0688fb33cdd5b16835a5a70f7fcef7ca79d00facced233d1529d26b4e77854e',
  acceptanceText: 'ec709781b80d2deeb325702faccb7a90abaa0c244c96103f0e956f81d26a08ee',
  registerText: '64c9d29e349401b4c597b854a46c74da0701cfea577a2a4810214d609d386fc6',
};
// Paths inside the release (KB-CONTENT-001's RELEASE-INDEX.json row).
const RELEASE_PATHS = {
  export: 'exports/KB-IDEA-EVALUATION-001-v0.1.json',
  acceptance: 'methods/KB-IDEA-EVALUATION-001/v0.1/ACCEPTANCE.json',
  register: 'methods/KB-IDEA-EVALUATION-001/v0.1/SOURCE-REGISTER.txt',
};

const sha = (x) => createHash('sha256').update(x).digest('hex');
const raw = (name) => readFileSync(path.join(PKG_DIR, name));
const REAL = KB_PACKAGES.find((p) => p.id === ID && p.version === VERSION);

describe('the pins (Amendment A §A2)', () => {
  it("the committed export file's bytes, read from disk", () => {
    expect(sha(raw(FILES.export))).toBe(PINS.exportFile);
  });

  it('its method_text (UTF-8), through the import', () => {
    expect(sha(REAL.exportJson.method_text)).toBe(PINS.methodText);
  });

  it("the acceptance wrapper's text, through the import", () => {
    expect(sha(REAL.acceptance.text)).toBe(PINS.acceptanceText);
  });

  it("the register wrapper's text, through the import", () => {
    expect(sha(REAL.register.text)).toBe(PINS.registerText);
  });

  it.each(Object.values(FILES))('%s is LF with no byte-order mark, ending in one newline', (name) => {
    const bytes = raw(name);
    expect(bytes.includes(0x0d)).toBe(false);
    expect(bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(false);
    expect(bytes[bytes.length - 1]).toBe(0x0a);
    expect(bytes[bytes.length - 2]).not.toBe(0x0a);
  });

  it.each([
    ['acceptance', FILES.acceptance, RELEASE_PATHS.acceptance],
    ['register', FILES.register, RELEASE_PATHS.register],
  ])('the %s wrapper is exactly { path, text } in its canonical serialization, and the import reads it', (key, name, releasePath) => {
    const text = raw(name).toString('utf8');
    const wrapper = JSON.parse(text);
    expect(Object.keys(wrapper)).toEqual(['path', 'text']);
    expect(wrapper.path).toBe(releasePath);
    expect(text).toBe(`${JSON.stringify({ path: wrapper.path, text: wrapper.text }, null, 2)}\n`);
    expect(REAL[key]).toEqual(wrapper);
  });

  it.each([
    ['method_text', () => REAL.exportJson.method_text],
    ['the acceptance text', () => REAL.acceptance.text],
    ['the register text', () => REAL.register.text],
  ])('%s itself is LF with no byte-order mark (the files escape a CR as \\r; review KL1-6)', (_label, textOf) => {
    const text = textOf();
    expect(text.includes('\r')).toBe(false);
    expect(text.includes('﻿')).toBe(false);
  });

  it('the imported export is the committed file', () => {
    expect(REAL.exportJson).toEqual(JSON.parse(raw(FILES.export).toString('utf8')));
  });

  it('the package directory holds exactly the three files and index.js', () => {
    expect(readdirSync(PKG_DIR).sort()).toEqual([...Object.values(FILES), 'index.js'].sort());
  });
});

describe('KB_PACKAGES', () => {
  it('a frozen list of frozen rows, one per id and version, the real package among them', () => {
    expect(REAL).toBeDefined();
    expect(Object.isFrozen(KB_PACKAGES)).toBe(true);
    for (const row of KB_PACKAGES) expect(Object.isFrozen(row)).toBe(true);
    const keys = KB_PACKAGES.map((p) => `${p.id}@${p.version}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each(KB_PACKAGES.map((p) => [`${p.id} v${p.version}`, p]))('%s passes verifyPackage (checks 1–7)', (_label, p) => {
    const v = verifyPackage({ id: p.id, version: p.version });
    expect(v.ok).toBe(true);
    expect(v.method.id).toBe(p.id);
    expect(v.method.version).toBe(p.version);
  });
});

/** An in-memory release built from the committed parts. */
function memoryRelease() {
  const files = new Map([
    [RELEASE_PATHS.export, Buffer.from(raw(FILES.export))],
    [RELEASE_PATHS.acceptance, Buffer.from(REAL.acceptance.text, 'utf8')],
    [RELEASE_PATHS.register, Buffer.from(REAL.register.text, 'utf8')],
  ]);
  const part = (p) => ({ path: p, sha256: sha(files.get(p)) });
  const index = {
    schema: 'KB-CONTENT-001/accepted-release/1',
    methods: [
      { id: 'KB-APP-EVIDENCE-001', version: '0.1', status: 'accepted' },
      {
        id: ID,
        version: VERSION,
        status: 'accepted',
        content_sha256: PINS.methodText,
        export: part(RELEASE_PATHS.export),
        acceptance: part(RELEASE_PATHS.acceptance),
        source_register: part(RELEASE_PATHS.register),
      },
    ],
  };
  return { index, files, read: (p) => files.get(p) };
}

const KEY_OF = { export: 'export', acceptance: 'acceptance', register: 'source_register' };
const run = (rel) => packageFilesOf({ index: rel.index, read: rel.read, id: ID, version: VERSION });
const row = (rel) => rel.index.methods[1];

describe('the import script — packageFilesOf', () => {
  it('reproduces the three committed files byte for byte, and reports the pinned hashes', () => {
    const r = run(memoryRelease());
    expect(r.ok).toBe(true);
    expect(r.files.map((f) => f.name)).toEqual([FILES.export, FILES.acceptance, FILES.register]);
    for (const f of r.files) expect(f.bytes.equals(raw(f.name))).toBe(true);
    expect(r.verified).toEqual({
      releaseId: 'KB-CONTENT-001',
      exportSha256: PINS.exportFile,
      methodSha256: PINS.methodText,
      acceptanceSha256: PINS.acceptanceText,
      registerSha256: PINS.registerText,
    });
  });

  it.each(Object.keys(KEY_OF))("refuses, with no files, when the index's %s hash is off", (part) => {
    const rel = memoryRelease();
    const listed = row(rel)[KEY_OF[part]];
    listed.sha256 = listed.sha256.slice(0, -1) + (listed.sha256.endsWith('0') ? '1' : '0');
    const r = run(rel);
    expect(r).toMatchObject({ ok: false, reason: 'hash', detail: part });
    expect(r.files).toBeUndefined();
  });

  // The bad bytes are RE-HASHED into the index, so the hash comparison passes
  // and the UTF-8 check is the one that answers.
  it.each(Object.keys(KEY_OF))('refuses, with no files, when the %s is not UTF-8-stable (index hash re-bound)', (part) => {
    const rel = memoryRelease();
    const p = RELEASE_PATHS[part];
    const bad = Buffer.concat([rel.files.get(p), Buffer.from([0xff])]);
    rel.files.set(p, bad);
    row(rel)[KEY_OF[part]].sha256 = sha(bad);
    const r = run(rel);
    expect(r).toMatchObject({ ok: false, reason: 'utf8', detail: part });
    expect(r.files).toBeUndefined();
  });

  it.each([
    ['acceptance', RELEASE_PATHS.acceptance, 'acceptance_mismatch'],
    ['register', RELEASE_PATHS.register, 'register_mismatch'],
  ])('refuses, with no files, when verifyParts fails: one character of the %s changed (index hash re-bound)', (part, p, reason) => {
    const rel = memoryRelease();
    const text = rel.files.get(p).toString('utf8');
    const at = Math.floor(text.length / 2);
    const changed = Buffer.from(text.slice(0, at) + (text[at] === 'x' ? 'y' : 'x') + text.slice(at + 1), 'utf8');
    rel.files.set(p, changed);
    row(rel)[KEY_OF[part]].sha256 = sha(changed);
    const r = run(rel);
    expect(r).toMatchObject({ ok: false, reason: 'verify', detail: reason });
    expect(r.files).toBeUndefined();
  });

  it.each([
    ['the row is not accepted', (rel) => { row(rel).status = 'reviewed_candidate'; }, 'not_accepted'],
    ['no row for the method', (rel) => { rel.index.methods.pop(); }, 'row'],
    ['two rows for the method', (rel) => { rel.index.methods.push(structuredClone(row(rel))); }, 'row'],
    ['a path leaving the release', (rel) => { row(rel).export.path = '../outside.json'; }, 'index'],
    ['an absolute path', (rel) => { row(rel).export.path = '/etc/passwd'; }, 'index'],
    ['a release id that is not a plain name', (rel) => { rel.index.schema = '../x/accepted-release/1'; }, 'index'],
    ['an index of another schema (review KL1-7)', (rel) => { rel.index.schema = 'KB-CONTENT-001/accepted-release/2'; }, 'index'],
    ["the row's content_sha256 is not the verified method hash (review KL1-7)", (rel) => { row(rel).content_sha256 = '0'.repeat(64); }, 'index'],
    ['a file the release does not have', (rel) => { rel.files.delete(RELEASE_PATHS.register); }, 'unreadable'],
  ])('refuses, with no files: %s', (_label, damage, reason) => {
    const rel = memoryRelease();
    damage(rel);
    const r = run(rel);
    expect(r).toMatchObject({ ok: false, reason });
    expect(r.files).toBeUndefined();
  });

  it('never throws (garbage arguments, a throwing reader)', () => {
    for (const args of [undefined, null, 42, {}, { index: 'x' }, { index: memoryRelease().index, read: () => { throw new Error('boom'); }, id: ID, version: VERSION }]) {
      const r = packageFilesOf(args);
      expect(r.ok).toBe(false);
      expect(r.files).toBeUndefined();
    }
  });
});

describe('the import script — the command line (writes nothing on a refusal; --check)', () => {
  /** Write the in-memory release to a temporary directory. */
  function onDisk(rel) {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'kb0-release-'));
    writeFileSync(path.join(dir, 'RELEASE-INDEX.json'), JSON.stringify(rel.index));
    for (const [p, bytes] of rel.files) {
      mkdirSync(path.dirname(path.join(dir, ...p.split('/'))), { recursive: true });
      writeFileSync(path.join(dir, ...p.split('/')), bytes);
    }
    return dir;
  }
  const cli = (args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });

  it('--check against the committed files exits 0; a run writes the same three files; a refusal writes nothing', () => {
    const release = onDisk(memoryRelease());
    const out = mkdtempSync(path.join(os.tmpdir(), 'kb0-out-'));
    try {
      const base = ['--release', release, '--id', ID, '--version', VERSION];
      expect(cli([...base, '--out', PKG_DIR, '--check']).status).toBe(0);
      expect(cli([...base, '--out', out, '--check']).status).toBe(1);

      const wrote = cli([...base, '--out', out]);
      expect(wrote.status).toBe(0);
      for (const name of Object.values(FILES)) expect(readFileSync(path.join(out, name)).equals(raw(name))).toBe(true);

      const bad = memoryRelease();
      row(bad).status = 'reviewed_candidate';
      const badRelease = onDisk(bad);
      const empty = mkdtempSync(path.join(os.tmpdir(), 'kb0-empty-'));
      try {
        const refused = cli(['--release', badRelease, '--id', ID, '--version', VERSION, '--out', empty]);
        expect(refused.status).toBe(1);
        expect(refused.stderr).toContain('REFUSED: not_accepted');
        expect(readdirSync(empty)).toEqual([]);
      } finally {
        rmSync(badRelease, { recursive: true, force: true });
        rmSync(empty, { recursive: true, force: true });
      }
      expect(cli(['--release', release]).status).toBe(2);
    } finally {
      rmSync(release, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    }
  }, 30_000);

  it('never replaces a file with other bytes: all three checked before anything is written (review KL1-2)', () => {
    const release = onDisk(memoryRelease());
    const out = mkdtempSync(path.join(os.tmpdir(), 'kb0-out-'));
    try {
      const other = Buffer.from('{ "path": "methods/KB-OTHER-001/v0.1/SOURCE-REGISTER.txt", "text": "x" }\n');
      writeFileSync(path.join(out, FILES.register), other);
      const r = cli(['--release', release, '--id', ID, '--version', VERSION, '--out', out]);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain(`REFUSED: overwrite (${FILES.register}`);
      expect(readdirSync(out)).toEqual([FILES.register]);
      expect(readFileSync(path.join(out, FILES.register)).equals(other)).toBe(true);
      // The same bytes are no overwrite: a re-import of identical files succeeds.
      writeFileSync(path.join(out, FILES.register), raw(FILES.register));
      expect(cli(['--release', release, '--id', ID, '--version', VERSION, '--out', out]).status).toBe(0);
    } finally {
      rmSync(release, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    }
  }, 30_000);

  it('a link inside the release cannot lead out of it, and no refusal prints a local path (reviews KL3-4, KL3-5)', () => {
    const rel = memoryRelease();
    const release = onDisk(rel);
    const outside = mkdtempSync(path.join(os.tmpdir(), 'kb0-outside-'));
    const out = mkdtempSync(path.join(os.tmpdir(), 'kb0-out-'));
    try {
      // Move `methods/` out of the release and leave a directory link in its place.
      const methods = path.join(release, 'methods');
      cpSync(methods, path.join(outside, 'methods'), { recursive: true });
      rmSync(methods, { recursive: true, force: true });
      symlinkSync(path.join(outside, 'methods'), methods, 'junction');
      const linked = cli(['--release', release, '--id', ID, '--version', VERSION, '--out', out]);
      expect(linked.status).toBe(1);
      expect(linked.stderr).toContain('REFUSED: unreadable');
      expect(linked.stderr).toContain('leaves the release through a link');
      expect(readdirSync(out)).toEqual([]);

      const missingRelease = cli(['--release', path.join(outside, 'nope'), '--id', ID, '--version', VERSION, '--out', out]);
      expect(missingRelease.status).toBe(1);
      expect(missingRelease.stderr.trim()).toBe('REFUSED: release (not a readable directory)');
      const noIndex = cli(['--release', outside, '--id', ID, '--version', VERSION, '--out', out]);
      expect(noIndex.status).toBe(1);
      expect(noIndex.stderr.trim()).toBe('REFUSED: index (RELEASE-INDEX.json unreadable or not JSON)');
      for (const r of [linked, missingRelease, noIndex]) {
        expect(r.stderr).not.toContain(os.tmpdir());
        expect(r.stderr).not.toContain(path.basename(outside));
      }
    } finally {
      rmSync(path.join(release, 'methods'), { recursive: true, force: true });
      rmSync(release, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    }
  }, 30_000);
});

/**
 * The shipped-list rules (Amendment A §A3.4), as a function so each is proven
 * against a planted list: every entry well-formed; every entry names a
 * committed package whose hashes it carries; no two entries taking new
 * sessions share a consumer; no two entries for one version share a consumer.
 */
function shippedListProblems(list) {
  if (!Array.isArray(list)) return ['not a list'];
  const problems = [];
  list.forEach((e, i) => {
    if (!isAuthorizationEntry(e)) { problems.push(`entry ${i} is malformed`); return; }
    const v = verifyPackage({ id: e.id, version: e.version });
    if (!v.ok) problems.push(`entry ${i} names no verified package (${v.reason})`);
    else if (v.method.sha256 !== e.sha256 || v.method.acceptanceSha256 !== e.acceptanceSha256) problems.push(`entry ${i} carries other hashes`);
  });
  const good = list.filter(isAuthorizationEntry);
  const newSessionConsumers = new Set();
  const versionConsumers = new Set();
  for (const e of good) {
    for (const c of e.consumers) {
      if (e.newSessions !== false) {
        if (newSessionConsumers.has(c)) problems.push(`two entries take new sessions for ${c}`);
        newSessionConsumers.add(c);
      }
      const key = `${e.id}@${e.version}#${c}`;
      if (versionConsumers.has(key)) problems.push(`two entries for ${key}`);
      versionConsumers.add(key);
    }
  }
  return problems;
}

describe('the shipped authorization list', () => {
  it('KB_APP_USE is [] and frozen — THE PIN: the first entry moves this row in the same founder-merged commit', () => {
    expect(KB_APP_USE).toEqual([]);
    expect(Object.isFrozen(KB_APP_USE)).toBe(true);
  });

  it('the shipped list breaks no list rule (vacuous today, binding from the first entry)', () => {
    expect(shippedListProblems(KB_APP_USE)).toEqual([]);
  });

  const good = {
    id: ID, version: VERSION, sha256: PINS.methodText, acceptanceSha256: PINS.acceptanceText,
    consumers: ['shared_research.observation'], audience: 'allowlist',
    authorizedAt: '2026-11-13T17:00:00Z', authorizedBy: 'founder', evidenceRef: 'docs/approvals/KB_TEST_ENTRY.md',
  };

  it('the rules accept the amendment\'s first entry (§A6), alone and beside a superseded one', () => {
    expect(shippedListProblems([good])).toEqual([]);
    expect(shippedListProblems([{ ...good, newSessions: false, consumers: ['research_modal.analysis'] }, good])).toEqual([]);
  });

  it.each([
    ['a malformed entry', [{ ...good, audience: 'everyone' }], /malformed/],
    ['an entry naming a package that is not committed', [{ ...good, version: '0.2' }], /no verified package \(missing\)/],
    ['an entry whose method hash differs', [{ ...good, sha256: '0'.repeat(64) }], /other hashes/],
    ['an entry whose acceptance hash differs', [{ ...good, acceptanceSha256: '0'.repeat(64) }], /other hashes/],
    ['two entries taking new sessions for one consumer', [good, { ...good, audience: 'all' }], /take new sessions/],
    ['two entries for one version and consumer, one superseded', [good, { ...good, newSessions: false }], /two entries for/],
  ])('the rules catch a planted list: %s', (_label, list, problem) => {
    expect(shippedListProblems(list).join(' | ')).toMatch(problem);
  });
});
