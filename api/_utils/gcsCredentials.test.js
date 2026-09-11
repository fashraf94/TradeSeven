// api/_utils/gcsCredentials.test.js
//
// The three accepted forms of the GCS service-account credential, and the one
// sentence an operator gets when none of them parses.
//
// Dependency-surface guard (BUILD_RULES §4): this file's import of the module
// under test is the runtime guard that its imports stay Node-clean — the loader
// is pulled into both a serverless writer (shadowLogger.js) and two CLI readers,
// so a browser dep entering its graph must explode here. Never mock it.
//
// Every row drives the SHIPPED loader against an injected env object rather than
// mutating process.env, so the suite is order-independent and leaves no global
// behind. The one row that proves the `process.env` default does mutate it, and
// restores it.

import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadGcsCredentials,
  ACCEPTED_FORMS_MESSAGE,
  CREDENTIALS_ENV,
  CREDENTIALS_FILE_ENV,
} from './gcsCredentials.js';

/** A service account shaped like the real one, minus anything secret. */
const SERVICE_ACCOUNT = {
  type: 'service_account',
  project_id: 'macro-nuance-474602-f5',
  private_key_id: 'test-key-id',
  client_email: 'shadow-writer@macro-nuance-474602-f5.iam.gserviceaccount.com',
};
const AS_JSON = JSON.stringify(SERVICE_ACCOUNT);

const tempDirs = [];
/** Write a service-account file and return its absolute path. */
function writeCredentialFile(contents, name = 'sa.json') {
  const dir = mkdtempSync(join(tmpdir(), 'gcs-creds-'));
  tempDirs.push(dir);
  const abs = join(dir, name);
  writeFileSync(abs, contents, 'utf8');
  return abs;
}

afterEach(() => {
  while (tempDirs.length) rmSync(tempDirs.pop(), { recursive: true, force: true });
});

describe('loadGcsCredentials — form 1: GCS_CREDENTIALS as service-account JSON', () => {
  it('parses the JSON and returns the credential object', () => {
    expect(loadGcsCredentials({ [CREDENTIALS_ENV]: AS_JSON })).toEqual(SERVICE_ACCOUNT);
  });

  it('is returned VERBATIM — the no-behaviour-change guarantee for today’s deployments', () => {
    // Every deployment at HEAD sets exactly this form. Whatever else the loader
    // grew, a valid GCS_CREDENTIALS must still yield `JSON.parse(creds)` and
    // nothing else — same object, same keys, no normalisation, no re-shaping.
    const creds = loadGcsCredentials({ [CREDENTIALS_ENV]: AS_JSON });
    expect(creds).toEqual(JSON.parse(AS_JSON));
    expect(Object.keys(creds)).toEqual(Object.keys(SERVICE_ACCOUNT));
  });

  it('wins over GCS_CREDENTIALS_FILE when both are set, so adding the file form cannot move a working deployment', () => {
    const other = writeCredentialFile(JSON.stringify({ ...SERVICE_ACCOUNT, project_id: 'from-the-file' }));
    const creds = loadGcsCredentials({ [CREDENTIALS_ENV]: AS_JSON, [CREDENTIALS_FILE_ENV]: other });
    expect(creds.project_id).toBe('macro-nuance-474602-f5');
  });

  it('reads process.env when no env is injected', () => {
    const saved = process.env[CREDENTIALS_ENV];
    try {
      process.env[CREDENTIALS_ENV] = AS_JSON;
      expect(loadGcsCredentials()).toEqual(SERVICE_ACCOUNT);
    } finally {
      if (saved === undefined) delete process.env[CREDENTIALS_ENV]; else process.env[CREDENTIALS_ENV] = saved;
    }
  });
});

describe('loadGcsCredentials — form 2: GCS_CREDENTIALS base64-encoded', () => {
  const AS_BASE64 = Buffer.from(AS_JSON, 'utf8').toString('base64');

  it('decodes and parses the same credential the raw JSON yields', () => {
    expect(loadGcsCredentials({ [CREDENTIALS_ENV]: AS_BASE64 })).toEqual(SERVICE_ACCOUNT);
  });

  it('tolerates the newline a wrapped secret picks up', () => {
    expect(loadGcsCredentials({ [CREDENTIALS_ENV]: `\n${AS_BASE64}\n` })).toEqual(SERVICE_ACCOUNT);
  });

  it('REJECTS a decode that is not a JSON object — Buffer.from is lenient, this is the guard', () => {
    // 'MTIz' is not JSON, but base64-decodes to the string '123', which parses
    // as the NUMBER 123. Without the object check that garbage would be handed
    // to Storage as a credential instead of raising the operator error.
    expect(Buffer.from('MTIz', 'base64').toString('utf8')).toBe('123');
    expect(() => loadGcsCredentials({ [CREDENTIALS_ENV]: 'MTIz' })).toThrow(ACCEPTED_FORMS_MESSAGE);
  });

  it('REJECTS base64 of a JSON array', () => {
    const arr = Buffer.from('[{"type":"service_account"}]', 'utf8').toString('base64');
    expect(() => loadGcsCredentials({ [CREDENTIALS_ENV]: arr })).toThrow(ACCEPTED_FORMS_MESSAGE);
  });
});

describe('loadGcsCredentials — form 3: GCS_CREDENTIALS_FILE', () => {
  it('reads the path and parses the file', () => {
    const abs = writeCredentialFile(AS_JSON);
    expect(loadGcsCredentials({ [CREDENTIALS_FILE_ENV]: abs })).toEqual(SERVICE_ACCOUNT);
  });

  it('is used when GCS_CREDENTIALS is absent', () => {
    const abs = writeCredentialFile(AS_JSON);
    expect(loadGcsCredentials({ [CREDENTIALS_ENV]: '', [CREDENTIALS_FILE_ENV]: abs })).toEqual(SERVICE_ACCOUNT);
  });

  it('rescues a mangled GCS_CREDENTIALS — the whole point of the file form', () => {
    // The shell-quoting casualty this form exists to fix: the inline blob got
    // truncated at its first newline, the file beside it is intact.
    const abs = writeCredentialFile(AS_JSON);
    const mangled = AS_JSON.slice(0, 20);
    expect(loadGcsCredentials({ [CREDENTIALS_ENV]: mangled, [CREDENTIALS_FILE_ENV]: abs })).toEqual(SERVICE_ACCOUNT);
  });

  it('a whitespace-only path is treated as unset, not as a path to ""', () => {
    expect(loadGcsCredentials({ [CREDENTIALS_FILE_ENV]: '   ' })).toBeNull();
  });
});

describe('loadGcsCredentials — unset is not an error', () => {
  it('neither variable set → null, and the CALLER decides whether that is fatal', () => {
    expect(loadGcsCredentials({})).toBeNull();
    expect(loadGcsCredentials({ [CREDENTIALS_ENV]: '', [CREDENTIALS_FILE_ENV]: '' })).toBeNull();
  });

  it('does not throw on unset — shadowLogger disables itself, the scripts exit 1', () => {
    expect(() => loadGcsCredentials({})).not.toThrow();
  });
});

describe('loadGcsCredentials — the error when none of the three forms parses', () => {
  const forms = [
    ['GCS_CREDENTIALS set to something that is neither JSON nor base64', { [CREDENTIALS_ENV]: 'not-json' }],
    ['GCS_CREDENTIALS_FILE pointing at a missing file', { [CREDENTIALS_FILE_ENV]: join(tmpdir(), 'gcs-creds-does-not-exist', 'sa.json') }],
    ['both set and both broken', { [CREDENTIALS_ENV]: 'not-json', [CREDENTIALS_FILE_ENV]: join(tmpdir(), 'gcs-creds-does-not-exist', 'sa.json') }],
    ['a whitespace-only GCS_CREDENTIALS — SET but unloadable, never silently ignored', { [CREDENTIALS_ENV]: '   ' }],
  ];

  it.each(forms)('%s throws', (_label, env) => {
    expect(() => loadGcsCredentials(env)).toThrow(Error);
  });

  it.each(forms)('%s — the message names all THREE accepted forms', (_label, env) => {
    let message = '';
    try { loadGcsCredentials(env); } catch (err) { message = err.message; }
    expect(message).toContain(`${CREDENTIALS_ENV} to the service-account JSON`);
    expect(message).toContain(`${CREDENTIALS_ENV} to that JSON base64-encoded`);
    expect(message).toContain(`${CREDENTIALS_FILE_ENV} to a path to the`);
  });

  it.each(forms)('%s — the message is ONE line', (_label, env) => {
    let message = '';
    try { loadGcsCredentials(env); } catch (err) { message = err.message; }
    expect(message).not.toContain('\n');
    expect(message.split('\n')).toHaveLength(1);
  });

  it('a file that exists but holds malformed JSON says so, and is not confused with a missing file', () => {
    const abs = writeCredentialFile('{"type": "service_account",');
    let message = '';
    try { loadGcsCredentials({ [CREDENTIALS_FILE_ENV]: abs }); } catch (err) { message = err.message; }
    expect(message).toContain(ACCEPTED_FORMS_MESSAGE);
    expect(message).toContain(`does not contain valid JSON`);
    expect(message).not.toContain('could not be read');
  });

  it('a missing file names the path, so the operator can see the typo', () => {
    const abs = join(tmpdir(), 'gcs-creds-does-not-exist', 'sa.json');
    expect(() => loadGcsCredentials({ [CREDENTIALS_FILE_ENV]: abs })).toThrow(abs);
    expect(() => loadGcsCredentials({ [CREDENTIALS_FILE_ENV]: abs })).toThrow('could not be read');
  });

  it('is never a raw SyntaxError stack — "set but broken" is an operator sentence', () => {
    expect(() => loadGcsCredentials({ [CREDENTIALS_ENV]: 'not-json' })).not.toThrow(SyntaxError);
  });

  it('reports BOTH configured forms when both are broken, not just the first', () => {
    const abs = writeCredentialFile('nope');
    let message = '';
    try { loadGcsCredentials({ [CREDENTIALS_ENV]: 'not-json', [CREDENTIALS_FILE_ENV]: abs }); } catch (err) { message = err.message; }
    expect(message).toContain(`${CREDENTIALS_ENV} is neither valid JSON nor base64-encoded JSON`);
    expect(message).toContain(abs);
  });
});
