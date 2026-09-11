// api/_utils/shadowLogger.credentials.test.js
//
// The shadow stream's WRITER, wired to the same credential loader its readers
// use (api/_utils/gcsCredentials.js). The loader's own forms are exhaustively
// covered in gcsCredentials.test.js; these rows prove shadowLogger is actually
// wired to it — all three forms reach a persisted write, and BOTH failure modes
// stay non-throwing.
//
// The never-throws contract (shadowLogger.js file header, BUILD_RULES §5) is the
// reason the error rows exist at all: the loader THROWS on a set-but-unloadable
// credential, and a throw escaping getGCSBucket would turn the shadow logger's
// documented `false` into a rejected promise at every `.catch(() => {})` call
// site — the silent-data-loss failure mode inverted into a loud one.
//
// getGCSBucket is module-private and memoises its bucket, so every row resets the
// module registry and re-imports: the cache must not carry one row's credential
// into the next.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CREDENTIALS_ENV, CREDENTIALS_FILE_ENV } from './gcsCredentials.js';

const SERVICE_ACCOUNT = {
  type: 'service_account',
  project_id: 'macro-nuance-474602-f5',
  client_email: 'shadow-writer@macro-nuance-474602-f5.iam.gserviceaccount.com',
};
const AS_JSON = JSON.stringify(SERVICE_ACCOUNT);

/** What the mocked Storage was constructed with, and what it was asked to save. */
const spy = { constructedWith: [], saved: [] };

vi.mock('@google-cloud/storage', () => ({
  Storage: class {
    constructor(options) {
      spy.constructedWith.push(options);
    }
    bucket(name) {
      return {
        name,
        file: (path) => ({
          save: async (line) => { spy.saved.push({ path, line }); },
        }),
      };
    }
  },
}));

const saved = { env: process.env[CREDENTIALS_ENV], file: process.env[CREDENTIALS_FILE_ENV] };
const tempDirs = [];

function writeCredentialFile(contents) {
  const dir = mkdtempSync(join(tmpdir(), 'shadow-creds-'));
  tempDirs.push(dir);
  const abs = join(dir, 'sa.json');
  writeFileSync(abs, contents, 'utf8');
  return abs;
}

/** A fresh module instance, so the memoised bucket never leaks across rows. */
async function freshLogger() {
  vi.resetModules();
  return import('./shadowLogger.js');
}

beforeEach(() => {
  spy.constructedWith.length = 0;
  spy.saved.length = 0;
  delete process.env[CREDENTIALS_ENV];
  delete process.env[CREDENTIALS_FILE_ENV];
});

afterEach(() => {
  for (const [key, value] of [[CREDENTIALS_ENV, saved.env], [CREDENTIALS_FILE_ENV, saved.file]]) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  while (tempDirs.length) rmSync(tempDirs.pop(), { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('shadowLogger — the three accepted credential forms all reach a persisted write', () => {
  it('form 1: GCS_CREDENTIALS as service-account JSON (unchanged behaviour)', async () => {
    process.env[CREDENTIALS_ENV] = AS_JSON;
    const { logConversation } = await freshLogger();
    await expect(logConversation({ battleId: 'b1' })).resolves.toBe(true);
    expect(spy.constructedWith[0].credentials).toEqual(SERVICE_ACCOUNT);
    expect(spy.saved).toHaveLength(1);
  });

  it('form 2: GCS_CREDENTIALS base64-encoded yields the SAME credential object', async () => {
    process.env[CREDENTIALS_ENV] = Buffer.from(AS_JSON, 'utf8').toString('base64');
    const { logConversation } = await freshLogger();
    await expect(logConversation({ battleId: 'b1' })).resolves.toBe(true);
    expect(spy.constructedWith[0].credentials).toEqual(SERVICE_ACCOUNT);
  });

  it('form 3: GCS_CREDENTIALS_FILE yields the SAME credential object', async () => {
    process.env[CREDENTIALS_FILE_ENV] = writeCredentialFile(AS_JSON);
    const { logConversation } = await freshLogger();
    await expect(logConversation({ battleId: 'b1' })).resolves.toBe(true);
    expect(spy.constructedWith[0].credentials).toEqual(SERVICE_ACCOUNT);
  });

  it('the projectId and bucket are untouched by which form supplied the credential', async () => {
    process.env[CREDENTIALS_FILE_ENV] = writeCredentialFile(AS_JSON);
    const { logConversation } = await freshLogger();
    await logConversation({ battleId: 'b1' });
    expect(spy.constructedWith[0].projectId).toBe('macro-nuance-474602-f5');
    expect(spy.saved[0].path).toMatch(/^shadow\/conversations\//);
  });
});

describe('shadowLogger — unset and unloadable stay distinct, and neither throws', () => {
  it('unset warns that shadow logging is disabled and names BOTH variables', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { logConversation } = await freshLogger();
    await expect(logConversation({ battleId: 'b1' })).resolves.toBe(false);
    const message = warn.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(message).toContain(CREDENTIALS_ENV);
    expect(message).toContain(CREDENTIALS_FILE_ENV);
    expect(message).toContain('shadow logging disabled');
    expect(spy.constructedWith).toHaveLength(0);
  });

  it('a set-but-unloadable credential reports the three-form sentence as an INIT error, not the disabled warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env[CREDENTIALS_ENV] = 'not-json';
    const { logConversation } = await freshLogger();
    await expect(logConversation({ battleId: 'b1' })).resolves.toBe(false);
    const reported = error.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(reported).toContain('[ShadowLogger] Init failed:');
    expect(reported).toContain(CREDENTIALS_ENV);
    expect(reported).toContain(CREDENTIALS_FILE_ENV);
    // The two operator problems must not look the same: a MISCONFIGURED
    // credential is never reported as "not set".
    expect(warn).not.toHaveBeenCalled();
    expect(spy.constructedWith).toHaveLength(0);
  });

  it('the loader’s throw NEVER escapes — the file-header contract holds on the new error path', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env[CREDENTIALS_ENV] = 'not-json';
    process.env[CREDENTIALS_FILE_ENV] = join(tmpdir(), 'shadow-creds-does-not-exist', 'sa.json');
    const { logConversation, logDecision } = await freshLogger();
    // Two calls: the second proves the failure is re-reported rather than
    // memoised into a throw on the next writer.
    await expect(logConversation({ battleId: 'b1' })).resolves.toBe(false);
    await expect(logDecision({ battleId: 'b1' })).resolves.toBe(false);
  });
});
