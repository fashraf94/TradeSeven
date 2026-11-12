// api/_utils/callRecords/mode.release.test.js
//
// THE RESOLVER WITH THE RELEASE COHORT (build prompt BUILD_PROMPT_COCKPIT_RELEASE_SWITCH;
// docs/audits/20261110_COCKPIT_RELEASE_READINESS.md §9, §10): resolveCallRecordsMode(battle)
// returns 'on' when the global mode is 'on' AND (the owner is allowlisted — UNCHANGED, every
// game mode — OR the battle is in the release cohort). With no control document every
// battle resolves exactly as the allowlist-only Build 2a resolver did.
//
// The real resolver, release.js and allowlist.js are never mocked (BUILD_RULES §4 runtime
// guard): the allowlist is driven through the environment variable, the control document
// through a fake Admin handle that ensureReleaseView reads.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const flag = vi.hoisted(() => ({ mode: 'on' }));
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get CALL_RECORDS_MODE() { return flag.mode; },
}));

const ENV = 'COCKPIT_ALLOWLIST_UIDS';
const ENV_BEFORE = process.env[ENV];
const { resolveCallRecordsMode, ensureReleaseView, isReleaseCohortBattle, isCockpitOwnerAllowlisted } = await import('./mode.js');
const { resetReleaseView, getReleaseView, bucketOf, RELEASE_VIEW_TTL_MS, RELEASE_VIEW_MAX_AGE_MS } = await import('./release.js');

const AGENT = 'baggerbomb_agent';
const LEAGUE = 'baggerbomb_tournament';
const SALT = 'salt-a';
const ALLOWED = 'owner-allowed';
const control = { value: undefined, reads: 0, throws: false };
const db = {
  collection: (name) => ({
    doc: (id) => ({
      get: async () => {
        control.reads += 1;
        if (control.throws) throw new Error('down');
        return { exists: control.value !== undefined, data: () => control.value, path: `${name}/${id}` };
      },
    }),
  }),
};
const battleOf = (ownerId, over = {}) => ({ id: `b-${ownerId}`, ownerId, gameMode: AGENT, status: 'active', ...over });
function ownerIn(lo, hi, salt = SALT) {
  for (let i = 0; i < 300000; i += 1) { const id = `member-${i}`; const b = bucketOf(id, salt); if (b >= lo && b < hi) return id; }
  throw new Error('none');
}
const MEMBER = ownerIn(0, 5000);
const OUTSIDER = ownerIn(5000, 10000);

beforeEach(() => {
  flag.mode = 'on';
  process.env[ENV] = ALLOWED;
  control.value = { shareBp: 5000, disabled: false, salt: SALT };
  control.reads = 0;
  control.throws = false;
  resetReleaseView();
});
afterEach(() => {
  vi.useRealTimers();
  resetReleaseView();
  if (ENV_BEFORE === undefined) delete process.env[ENV]; else process.env[ENV] = ENV_BEFORE;
});

describe('the resolver composition — global on: the allowlist OR the release cohort', () => {
  it('the cohort admits a non-allowlisted, agent-mode, real-owner battle under the share — once the view is loaded', async () => {
    expect(resolveCallRecordsMode(battleOf(MEMBER))).toBe('off'); // not loaded yet: an empty cohort
    await ensureReleaseView(db);
    expect(resolveCallRecordsMode(battleOf(MEMBER))).toBe('on');
    expect(isReleaseCohortBattle(battleOf(MEMBER))).toBe(true);
    expect(isCockpitOwnerAllowlisted(MEMBER)).toBe(false);
  });

  it('an owner at or over the share is off; the allowlist verdict is untouched by the cohort', async () => {
    await ensureReleaseView(db);
    expect(resolveCallRecordsMode(battleOf(OUTSIDER))).toBe('off');
    expect(isCockpitOwnerAllowlisted(MEMBER)).toBe(false);
  });

  it('allowlisted battles are UNCHANGED, League included — with the control document absent, disabled, at share 0 or at 10000', async () => {
    for (const value of [undefined, { shareBp: 5000, disabled: true, salt: SALT }, { shareBp: 0, disabled: false, salt: SALT }, { shareBp: 10000, disabled: false, salt: SALT }, { shareBp: 'bad' }]) {
      resetReleaseView();
      control.value = value;
      await ensureReleaseView(db);
      for (const gameMode of [AGENT, LEAGUE, undefined]) {
        expect(resolveCallRecordsMode(battleOf(ALLOWED, { gameMode })), `${JSON.stringify(value)} ${gameMode}`).toBe('on');
      }
      expect(resolveCallRecordsMode(battleOf(ALLOWED, { isCpu: true }))).toBe('on'); // the allowlist path never looks at isCpu (today's behaviour)
    }
  });

  it('League, a CPU seat and an empty owner are never in the cohort — even at share 10000 and for an owner under every share', async () => {
    control.value = { shareBp: 10000, disabled: false, salt: SALT };
    await ensureReleaseView(db);
    expect(resolveCallRecordsMode(battleOf(MEMBER))).toBe('on'); // the control row
    expect(resolveCallRecordsMode(battleOf(MEMBER, { gameMode: LEAGUE }))).toBe('off');
    expect(resolveCallRecordsMode(battleOf(MEMBER, { isCpu: true }))).toBe('off');
    expect(resolveCallRecordsMode(battleOf(''))).toBe('off');
    expect(resolveCallRecordsMode(battleOf(null))).toBe('off');
    expect(resolveCallRecordsMode(battleOf(MEMBER, { gameMode: undefined }))).toBe('off');
  });

  it('disabled → empty: the kill switch turns every cohort battle off at the next view; allowlisted ones stay on', async () => {
    await ensureReleaseView(db);
    expect(resolveCallRecordsMode(battleOf(MEMBER))).toBe('on');
    control.value = { shareBp: 5000, disabled: true, salt: SALT };
    await ensureReleaseView(db, { force: true });
    expect(resolveCallRecordsMode(battleOf(MEMBER))).toBe('off');
    expect(resolveCallRecordsMode(battleOf(ALLOWED))).toBe('on');
  });

  it('missing, malformed, read-error and timeout → empty (the allowlist alone)', async () => {
    const cases = [
      ['missing', () => { control.value = undefined; }],
      ['malformed', () => { control.value = { shareBp: 99999, disabled: false, salt: SALT }; }],
      ['read error', () => { control.throws = true; }],
    ];
    for (const [why, arrange] of cases) {
      resetReleaseView(); control.value = { shareBp: 10000, disabled: false, salt: SALT }; control.throws = false;
      arrange();
      await ensureReleaseView(db);
      expect(resolveCallRecordsMode(battleOf(MEMBER)), why).toBe('off');
      expect(resolveCallRecordsMode(battleOf(ALLOWED)), why).toBe('on');
    }
    resetReleaseView();
    const hung = { collection: () => ({ doc: () => ({ get: () => new Promise(() => {}) }) }) };
    await ensureReleaseView(hung, { timeoutMs: 20 });
    expect(resolveCallRecordsMode(battleOf(MEMBER))).toBe('off');
  });

  it('raising the share only adds owners, through the resolver', async () => {
    const owners = Array.from({ length: 300 }, (_, i) => `grow-${i}`);
    let prev = new Set();
    for (const bp of [0, 100, 2000, 5000, 9000, 10000]) {
      resetReleaseView();
      control.value = { shareBp: bp, disabled: false, salt: SALT };
      await ensureReleaseView(db);
      const cur = new Set(owners.filter((o) => resolveCallRecordsMode(battleOf(o)) === 'on'));
      for (const o of prev) expect(cur.has(o)).toBe(true);
      prev = cur;
    }
    expect(prev.size).toBe(owners.length);
  });

  it('a salt change re-draws through the resolver', async () => {
    const owners = Array.from({ length: 300 }, (_, i) => `salty-${i}`);
    const on = async (salt) => {
      resetReleaseView(); control.value = { shareBp: 5000, disabled: false, salt }; await ensureReleaseView(db);
      return owners.filter((o) => resolveCallRecordsMode(battleOf(o)) === 'on').join();
    };
    expect(await on('salt-a')).not.toBe(await on('salt-b'));
  });
});

describe('the global gates are untouched', () => {
  it("global 'off' and 'shadow' → that mode for every battle, cohort or not; nothing is read", async () => {
    for (const mode of ['off', 'shadow']) {
      flag.mode = mode;
      resetReleaseView();
      await ensureReleaseView(db);
      expect(control.reads, mode).toBe(0);
      expect(resolveCallRecordsMode(battleOf(MEMBER)), mode).toBe(mode);
      expect(resolveCallRecordsMode(battleOf(ALLOWED)), mode).toBe(mode);
    }
  });
  it('without a battle the resolver returns the GLOBAL value (the sweep\'s global gate)', async () => {
    await ensureReleaseView(db);
    expect(resolveCallRecordsMode()).toBe('on');
    flag.mode = 'shadow';
    expect(resolveCallRecordsMode()).toBe('shadow');
  });
  it('an unknown global value is off (fail closed) even with an active cohort', async () => {
    await ensureReleaseView(db);
    flag.mode = 'banana';
    expect(resolveCallRecordsMode(battleOf(MEMBER))).toBe('off');
  });
});

describe('the cache: 60 s on request paths, and a stale view fails closed', () => {
  it('a second ask inside 60 s does not read the document again; one after it does', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.parse('2026-11-10T20:00:00Z'));
    await ensureReleaseView(db);
    vi.setSystemTime(Date.parse('2026-11-10T20:00:00Z') + RELEASE_VIEW_TTL_MS - 1);
    await ensureReleaseView(db);
    expect(control.reads).toBe(1);
    vi.setSystemTime(Date.parse('2026-11-10T20:00:00Z') + RELEASE_VIEW_TTL_MS);
    await ensureReleaseView(db);
    expect(control.reads).toBe(2);
  });
  it('force: true reads once per call whatever is cached', async () => {
    await ensureReleaseView(db);
    await ensureReleaseView(db, { force: true });
    await ensureReleaseView(db, { force: true });
    expect(control.reads).toBe(3);
  });
  it('a handler that forgot to refresh cannot leave the cohort on for ever: the resolver treats a view older than 10 minutes as empty', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const t0 = Date.parse('2026-11-10T20:00:00Z');
    vi.setSystemTime(t0);
    await ensureReleaseView(db);
    expect(resolveCallRecordsMode(battleOf(MEMBER))).toBe('on');
    vi.setSystemTime(t0 + RELEASE_VIEW_MAX_AGE_MS + 1);
    expect(getReleaseView().active).toBe(false);
    expect(resolveCallRecordsMode(battleOf(MEMBER))).toBe('off');
    expect(resolveCallRecordsMode(battleOf(ALLOWED))).toBe('on');
  });
});

describe('never throws', () => {
  it('a hostile battle, a missing battle field and a db that is not a database leave the resolver and the loader answering', async () => {
    await expect(ensureReleaseView(undefined)).resolves.toMatchObject({ active: false });
    await expect(ensureReleaseView({ collection: () => { throw new Error('x'); } })).resolves.toMatchObject({ active: false });
    expect(() => resolveCallRecordsMode({ get ownerId() { throw new Error('x'); } })).not.toThrow();
    expect(resolveCallRecordsMode({ get ownerId() { throw new Error('x'); } })).toBe('off');
    expect(resolveCallRecordsMode(null)).toBe('off');
    expect(resolveCallRecordsMode({})).toBe('off');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// THE DARK PROOF, differentially: with an EMPTY cohort view — never loaded, absent, disabled, malformed,
// a read error, a timeout, a stale view — the resolver is, for every battle, exactly the allowlist-only
// resolver this build replaced (global gate, then isCockpitOwnerAllowlisted, else 'off').
describe('with an empty cohort view the resolver is the pre-switch resolver, for every battle', () => {
  const legacy = (battle) => {
    const g = flag.mode;
    const global = ['off', 'shadow', 'on'].includes(g) ? g : 'off';
    if (battle === undefined) return global;
    if (global !== 'on') return global;
    return isCockpitOwnerAllowlisted(battle?.ownerId) ? 'on' : 'off';
  };
  const OWNERS = [ALLOWED, 'owner-other', MEMBER, OUTSIDER, '', null, 42, 'cpu-1'];
  const MODES = [AGENT, LEAGUE, undefined, 'baggerbomb_other'];
  const CPUS = [undefined, true, false];
  const EMPTY_VIEWS = {
    unread: async () => {},
    absent: async () => { control.value = undefined; await ensureReleaseView(db); },
    disabled: async () => { control.value = { shareBp: 10000, disabled: true, salt: SALT }; await ensureReleaseView(db); },
    malformed: async () => { control.value = { shareBp: 12345, disabled: false, salt: SALT }; await ensureReleaseView(db); },
    'read error': async () => { control.throws = true; await ensureReleaseView(db); },
    timeout: async () => { await ensureReleaseView({ collection: () => ({ doc: () => ({ get: () => new Promise(() => {}) }) }) }, { timeoutMs: 15 }); },
    shareZero: async () => { control.value = { shareBp: 0, disabled: false, salt: SALT }; await ensureReleaseView(db); },
  };
  for (const [viewName, arrange] of Object.entries(EMPTY_VIEWS)) {
    it(`${viewName}: global off / shadow / on / unknown × owners × game modes × isCpu — identical to the allowlist-only resolver`, async () => {
      await arrange();
      let compared = 0;
      for (const g of ['off', 'shadow', 'on', 'banana']) {
        flag.mode = g;
        for (const ownerId of OWNERS) for (const gameMode of MODES) for (const isCpu of CPUS) {
          const battle = { id: 'b', ownerId, gameMode, isCpu, status: 'active' };
          expect(resolveCallRecordsMode(battle), `${viewName} ${g} ${String(ownerId)} ${gameMode} ${isCpu}`).toBe(legacy(battle));
          compared += 1;
        }
        expect(resolveCallRecordsMode(), `${viewName} ${g} (no battle)`).toBe(legacy(undefined));
      }
      expect(compared).toBe(4 * OWNERS.length * MODES.length * CPUS.length);
    });
  }
  it('a stale view (older than 10 minutes) is the same: the allowlist alone', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const t0 = Date.parse('2026-11-12T15:00:00Z');
    vi.setSystemTime(t0);
    control.value = { shareBp: 10000, disabled: false, salt: SALT };
    await ensureReleaseView(db);
    vi.setSystemTime(t0 + RELEASE_VIEW_MAX_AGE_MS + 1);
    for (const ownerId of OWNERS) for (const gameMode of MODES) {
      const battle = { id: 'b', ownerId, gameMode, status: 'active' };
      expect(resolveCallRecordsMode(battle)).toBe(legacy(battle));
    }
  });
  it('the control row: the SAME battles ARE admitted by an active cohort — so the differential above is not vacuous', async () => {
    control.value = { shareBp: 10000, disabled: false, salt: SALT };
    await ensureReleaseView(db);
    const diff = OWNERS.flatMap((ownerId) => MODES.flatMap((gameMode) => CPUS.map((isCpu) => ({ id: 'b', ownerId, gameMode, isCpu, status: 'active' }))))
      .filter((b) => resolveCallRecordsMode(b) !== legacy(b));
    expect(diff.length).toBeGreaterThan(0);
    for (const b of diff) expect(b).toMatchObject({ gameMode: AGENT });
  });
});
