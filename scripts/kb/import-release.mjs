// scripts/kb/import-release.mjs
//
// KB-0 — IMPORT ONE ACCEPTED METHOD FROM AN EXTRACTED KNOWLEDGE-BASE RELEASE
// (Shared Research spec V1.2, Amendment A §A3.1; founder ruling R-KB-3: the
// accepted text is imported byte for byte).
//
//   node scripts/kb/import-release.mjs --release <extracted dir> --id KB-IDEA-EVALUATION-001 --version 0.1 --out api/_utils/kb/packages
//   ... the same, plus --check: compare with the files on disk, write nothing
//
// It reads RELEASE-INDEX.json, finds the method's row and takes three paths
// from it (export.path, acceptance.path, source_register.path). It WRITES
// NOTHING unless all of these hold: the row's status is `accepted`; each
// file's SHA-256 equals the hash the index lists for it; each file decodes as
// UTF-8 and re-encodes to the same bytes; and the loader's verifyParts passes
// on the three parts (the hash chain, Amendment A §A2). Then it writes:
//
//   <id>-v<version>.export.json        the export's bytes, unchanged
//   <id>-v<version>.acceptance.json    JSON.stringify({ path, text }, null, 2) + one newline
//   <release id>.source-register.json  the same wrapper form
//
// where `path` is the file's path inside the release and `text` its exact
// text; the release id is the part of the index's `schema` before the first
// slash. The wrappers carry no hash of their own. It prints the hashes it
// verified and exits non-zero on any refusal (1) or a usage error (2).
//
// The release is data: nothing in it is executed or imported, and every path
// it names is checked to stay inside the release directory.
//
// A NEW PACKAGE: run this first, then add the package's row to
// api/_utils/kb/packages/index.js. The script imports the loader, which
// imports index.js, so index.js may only name files that already exist (the
// first import ran with an empty list).
//
// packageFilesOf is pure (no file access): the tests drive it with an
// in-memory release. The command line runs only when this file is invoked
// directly.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyParts } from '../../api/_utils/kb/loader.js';

const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;
const HEX64 = /^[0-9a-f]{64}$/;

const sha256Hex = (bytes) => createHash('sha256').update(bytes).digest('hex');
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isSafeName = (s) => typeof s === 'string' && SAFE_NAME.test(s) && !s.includes('..');
const isSafeRelativePath = (p) => typeof p === 'string' && p.length > 0
  && p.split('/').every((seg) => SAFE_SEGMENT.test(seg) && seg !== '.' && seg !== '..');

const refuse = (reason, detail) => ({ ok: false, reason, detail });

/** The part's { path, sha256 } from the method's row, or null. */
function partOf(row, key) {
  const part = row?.[key];
  return isObject(part) && isSafeRelativePath(part.path) && typeof part.sha256 === 'string' && HEX64.test(part.sha256)
    ? { path: part.path, sha256: part.sha256 }
    : null;
}

/** Decoded text when the bytes are UTF-8 that re-encodes to the same bytes, else null. */
function stableUtf8(bytes) {
  const buf = Buffer.from(bytes);
  const text = buf.toString('utf8');
  return Buffer.from(text, 'utf8').equals(buf) ? text : null;
}

const wrapperOf = (partPath, text) => Buffer.from(`${JSON.stringify({ path: partPath, text }, null, 2)}\n`, 'utf8');

/**
 * The three package files for one method of a release, or a refusal. Pure.
 *
 * @param {{ index: object, read: (releasePath: string) => Uint8Array, id: string, version: string }} args
 * @returns {{ ok: true, files: { name: string, bytes: Buffer }[], verified: object } | { ok: false, reason: string, detail?: string }}
 */
export function packageFilesOf(args) {
  try {
    const { index, read, id, version } = isObject(args) ? args : {};
    if (!isObject(index) || typeof index.schema !== 'string') return refuse('index', 'no schema');
    const releaseId = index.schema.split('/')[0];
    if (!isSafeName(releaseId)) return refuse('index', 'release id');
    if (!isSafeName(id) || !isSafeName(version)) return refuse('request', 'id or version');
    if (typeof read !== 'function') return refuse('request', 'read');

    const rows = Array.isArray(index.methods) ? index.methods.filter((m) => isObject(m) && m.id === id && m.version === version) : [];
    if (rows.length !== 1) return refuse('row', `${rows.length} rows for ${id} ${version}`);
    const row = rows[0];
    if (row.status !== 'accepted') return refuse('not_accepted', String(row.status));

    const parts = { export: partOf(row, 'export'), acceptance: partOf(row, 'acceptance'), register: partOf(row, 'source_register') };
    for (const [key, part] of Object.entries(parts)) if (!part) return refuse('index', `${key} path or hash`);

    const bytes = {};
    for (const [key, part] of Object.entries(parts)) {
      const b = read(part.path);
      if (!(b instanceof Uint8Array)) return refuse('unreadable', key);
      bytes[key] = Buffer.from(b);
    }
    for (const [key, part] of Object.entries(parts)) {
      if (sha256Hex(bytes[key]) !== part.sha256) return refuse('hash', key);
    }
    const text = {};
    for (const key of Object.keys(parts)) {
      text[key] = stableUtf8(bytes[key]);
      if (text[key] === null) return refuse('utf8', key);
    }

    let exportJson;
    try {
      exportJson = JSON.parse(text.export);
    } catch {
      return refuse('verify', 'export is not JSON');
    }
    const verified = verifyParts({ id, version, exportJson, acceptanceText: text.acceptance, registerText: text.register });
    if (!verified.ok) return refuse('verify', verified.reason);

    return {
      ok: true,
      files: [
        { name: `${id}-v${version}.export.json`, bytes: bytes.export },
        { name: `${id}-v${version}.acceptance.json`, bytes: wrapperOf(parts.acceptance.path, text.acceptance) },
        { name: `${releaseId}.source-register.json`, bytes: wrapperOf(parts.register.path, text.register) },
      ],
      verified: {
        releaseId,
        exportSha256: parts.export.sha256,
        methodSha256: verified.method.sha256,
        acceptanceSha256: verified.method.acceptanceSha256,
        registerSha256: parts.register.sha256,
      },
    };
  } catch (err) {
    return refuse('error', err instanceof Error ? err.message : String(err));
  }
}

const USAGE = 'usage: node scripts/kb/import-release.mjs --release <extracted dir> --id <method id> --version <version> --out <dir> (add --check to compare only)';

function parseArgs(argv) {
  const args = { check: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--check') args.check = true;
    else if (['--release', '--id', '--version', '--out'].includes(a) && i + 1 < argv.length) args[a.slice(2)] = argv[(i += 1)];
    else return null;
  }
  return args.release && args.id && args.version && args.out ? args : null;
}

function main(argv) {
  const args = parseArgs(argv);
  if (!args) {
    console.error(USAGE);
    return 2;
  }
  const root = realpathSync(path.resolve(args.release));
  const read = (releasePath) => {
    const abs = path.resolve(root, ...releasePath.split('/'));
    if (!abs.startsWith(root + path.sep)) throw new Error(`path outside the release: ${releasePath}`);
    return readFileSync(abs);
  };
  let index;
  try {
    index = JSON.parse(readFileSync(path.join(root, 'RELEASE-INDEX.json'), 'utf8'));
  } catch (err) {
    console.error(`REFUSED: index (${err instanceof Error ? err.message : String(err)})`);
    return 1;
  }

  const result = packageFilesOf({ index, read, id: args.id, version: args.version });
  if (!result.ok) {
    console.error(`REFUSED: ${result.reason}${result.detail ? ` (${result.detail})` : ''}`);
    return 1;
  }
  const v = result.verified;
  console.log(`release ${v.releaseId}: ${args.id} v${args.version}`);
  console.log(`  export file      sha256 ${v.exportSha256}`);
  console.log(`  method_text      sha256 ${v.methodSha256}`);
  console.log(`  acceptance text  sha256 ${v.acceptanceSha256}`);
  console.log(`  register text    sha256 ${v.registerSha256}`);

  const out = path.resolve(args.out);
  if (args.check) {
    let differs = 0;
    for (const f of result.files) {
      let onDisk = null;
      try {
        onDisk = readFileSync(path.join(out, f.name));
      } catch {
        onDisk = null;
      }
      const same = onDisk !== null && onDisk.equals(f.bytes);
      if (!same) differs += 1;
      console.log(`  ${same ? 'same   ' : 'DIFFERS'} ${f.name}`);
    }
    return differs === 0 ? 0 : 1;
  }
  mkdirSync(out, { recursive: true });
  for (const f of result.files) {
    writeFileSync(path.join(out, f.name), f.bytes);
    console.log(`  wrote ${f.name} (${f.bytes.length} bytes, sha256 ${sha256Hex(f.bytes)})`);
  }
  return 0;
}

const invokedDirectly = (() => {
  try {
    return Boolean(process.argv[1]) && realpathSync(path.resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

if (invokedDirectly) process.exitCode = main(process.argv.slice(2));
