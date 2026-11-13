// api/_utils/kb/audience.test.js
//
// KB-0 — WHO MAY RECEIVE A KB METHOD (Shared Research spec V1.2, Amendment A
// §A3.5; founder ruling R-KB-2). 'all': any non-empty uid. 'allowlist': the
// founder's named test list (COCKPIT_ALLOWLIST_UIDS, read at call time by
// api/_utils/callRecords/allowlist.js — set here through the environment, as
// allowlist.test.js does). Anything else: never. Never throws.
//
// Dependency-surface guard (BUILD_RULES §4): audience.js reaches
// src/config/featureFlags.js (and src/constants/) through
// api/_utils/callRecords/mode.js. THIS FILE'S IMPORT OF audience.js IS THE
// RUNTIME GUARD: it explodes in the Node test environment if a browser
// dependency enters that graph. It must never be mocked.

import { describe, it, expect, afterEach } from 'vitest';
import { inAudienceFor } from './audience.js';
import { KB_AUDIENCES } from './loader.js';

const ENV = 'COCKPIT_ALLOWLIST_UIDS';
const BEFORE = process.env[ENV];
const LISTED = 'uid-kb0-listed';
const OTHER = 'uid-kb0-other';

afterEach(() => {
  if (BEFORE === undefined) delete process.env[ENV];
  else process.env[ENV] = BEFORE;
});

const NON_STRINGS = [undefined, null, 0, 42, true, {}, [], ['uid-kb0-listed'], () => 'uid-kb0-listed'];

describe("'all'", () => {
  it('true for a non-empty uid, whatever the test list', () => {
    delete process.env[ENV];
    expect(inAudienceFor(OTHER)('all')).toBe(true);
    process.env[ENV] = LISTED;
    expect(inAudienceFor(OTHER)('all')).toBe(true);
  });

  it.each([['the empty string', ''], ...NON_STRINGS.map((u) => [String(u), u])])('false for %s', (_label, uid) => {
    process.env[ENV] = `${LISTED},${OTHER}`;
    expect(inAudienceFor(uid)('all')).toBe(false);
  });
});

describe("'allowlist'", () => {
  it('true only for a uid on the test list set through the environment', () => {
    process.env[ENV] = ` ${LISTED} , uid-kb0-second `;
    expect(inAudienceFor(LISTED)('allowlist')).toBe(true);
    expect(inAudienceFor('uid-kb0-second')('allowlist')).toBe(true);
    expect(inAudienceFor(OTHER)('allowlist')).toBe(false);
  });

  it('nobody when the list is unset or empty (the list is read at each call)', () => {
    const ask = inAudienceFor(LISTED);
    delete process.env[ENV];
    expect(ask('allowlist')).toBe(false);
    process.env[ENV] = '';
    expect(ask('allowlist')).toBe(false);
    process.env[ENV] = LISTED;
    expect(ask('allowlist')).toBe(true);
    delete process.env[ENV];
    expect(ask('allowlist')).toBe(false);
  });

  it.each([['the empty string', ''], ...NON_STRINGS.map((u) => [String(u), u])])('false for %s, even with a list', (_label, uid) => {
    process.env[ENV] = `${LISTED},${OTHER}`;
    expect(inAudienceFor(uid)('allowlist')).toBe(false);
  });
});

describe('any other audience', () => {
  it.each(['everyone', 'ALL', 'Allowlist', 'allowlist ', '', undefined, null, 1, {}, ['all']])('%j is never true, for a uid on the list', (audience) => {
    process.env[ENV] = LISTED;
    expect(inAudienceFor(LISTED)(audience)).toBe(false);
  });

  it("the audiences it answers are exactly the loader's KB_AUDIENCES", () => {
    process.env[ENV] = LISTED;
    for (const a of KB_AUDIENCES) expect(inAudienceFor(LISTED)(a)).toBe(true);
    expect(KB_AUDIENCES).toEqual(['allowlist', 'all']);
  });
});

describe('never throws', () => {
  it('hostile uids and audiences', () => {
    process.env[ENV] = LISTED;
    const hostile = new Proxy({}, { get() { throw new Error('boom'); } });
    expect(() => inAudienceFor(hostile)).not.toThrow();
    expect(inAudienceFor(hostile)('all')).toBe(false);
    expect(inAudienceFor(LISTED)(hostile)).toBe(false);
    expect(inAudienceFor(Symbol('s'))('allowlist')).toBe(false);
    expect(typeof inAudienceFor()).toBe('function');
    expect(inAudienceFor()()).toBe(false);
  });
});
