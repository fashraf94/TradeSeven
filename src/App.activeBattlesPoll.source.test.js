// src/App.activeBattlesPoll.source.test.js
//
// Command Center slice S3 (rulings R-S3-2, R-S3-3) — where App's active poll
// becomes owner-aware, pinned as source text. A SEPARATE FILE ON PURPOSE:
// App.agentBattlesPoll.test.js is a defect guard (R-T2-S11, D-6) that must keep
// passing untouched, and does; this file sits beside it and guards only what
// S3 added.
//
// Why source text: the parts that need a query ANSWER — a completion captured
// for an earlier identity being dropped, A→B→A — cannot be driven through App
// under vitest here, because App's lazy Firestore imports reach the real SDK
// on some runs (src/App.activeBattlesPoll.owner.jsdom.test.jsx states the limit
// and drives what it can). The rules themselves are pure and tested in
// src/utils/activeBattlesPoll.test.js and src/services/authIdentity.test.js;
// these rows pin that App calls them in the right place.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_RAW = readFileSync(path.join(HERE, 'App.jsx'), 'utf8').replace(/\r\n/g, '\n');

const stripComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
const squash = (s) => s.replace(/\s+/g, ' ');

/** The poll closure, exactly as App.agentBattlesPoll.test.js extracts it. */
function pollBodyOf(app) {
  const start = app.indexOf('const fetchAgentBattles = async () => {');
  const end = app.indexOf('fetchAgentBattles();', start);
  if (start < 0 || end < start) return null;
  return squash(stripComments(app.slice(start, end)));
}

/** The S3 checks, as functions, so each can be shown to bite on a planted variant. */
const checks = {
  captureBeforeFirstAwait(body) {
    const capture = body.indexOf('const capture = readAuthIdentity();');
    const begin = body.indexOf('const flight = agentBattlesFlights.begin(capture);');
    const firstAwait = body.indexOf('await ');
    return capture > -1 && begin > capture && firstAwait > begin;
  },
  queriesOnlyForTheCapture(body) {
    const match = body.indexOf('if (!pollCaptureMatches(capture, queriedUid)) return;');
    const uid = body.indexOf('const queriedUid = auth.currentUser.uid;');
    const query = body.indexOf('query(');
    return uid > -1 && match > uid && query > match && /where\('ownerId', '==', queriedUid\)/.test(body);
  },
  dropsAStaleCompletionBeforeTheList(body) {
    return body.includes('if (!isCurrentIdentity(capture)) return; setActiveAgentBattles(liveBattles); agentBattlesFlights.settle(flight, { ok: true, uid: queriedUid, at: Date.now() });');
  },
  recordsAFailureWithoutTouchingTheList(body) {
    const katch = body.slice(body.indexOf('} catch (error) {'));
    return /\} catch \(error\) \{ console\.error\([^;]*error\); agentBattlesFlights\.settle\(flight, \{ ok: false, error \}\); \} finally \{ agentBattlesFlights\.settle\(flight, null\); \}/.test(katch)
      && !/setActiveAgentBattles\(/.test(katch);
  },
  metadataOnlyThroughTheRuns(body) {
    return !/setActiveAgentBattlesPoll\(/.test(body);
  },
};

const APP = stripComments(APP_RAW);
const BODY = pollBodyOf(APP_RAW);

describe('the poll body (R-S3-3)', () => {
  it('is found where App.agentBattlesPoll.test.js finds it', () => {
    expect(BODY).not.toBeNull();
  });

  it.each(Object.keys(checks))('%s', (name) => {
    expect(checks[name](BODY)).toBe(true);
  });

  it('the checks bite: each fails on its planted defect', () => {
    const planted = {
      captureBeforeFirstAwait: BODY.replace('const capture = readAuthIdentity(); const flight = agentBattlesFlights.begin(capture); try {', 'try { await 0; const capture = readAuthIdentity(); const flight = agentBattlesFlights.begin(capture);'),
      queriesOnlyForTheCapture: BODY.replace('if (!pollCaptureMatches(capture, queriedUid)) return;', ''),
      dropsAStaleCompletionBeforeTheList: BODY.replace('if (!isCurrentIdentity(capture)) return; setActiveAgentBattles(liveBattles);', 'setActiveAgentBattles(liveBattles); if (!isCurrentIdentity(capture)) return;'),
      recordsAFailureWithoutTouchingTheList: BODY.replace('agentBattlesFlights.settle(flight, { ok: false, error });', ''),
      metadataOnlyThroughTheRuns: BODY.replace('try {', 'try { setActiveAgentBattlesPoll(initialActivePoll(0));'),
    };
    for (const [name, body] of Object.entries(planted)) {
      expect(body, name).not.toBe(BODY);
      expect(checks[name](body), name).toBe(false);
    }
  });
});

describe('the poll effect and the explicit refresh (R-S3-3)', () => {
  it('the running poll registers its fetch and unregisters it in cleanup; the deps stay [screen, isPageVisible]', () => {
    const effect = squash(APP.slice(APP.indexOf('const fetchAgentBattles = async () => {')));
    expect(effect).toMatch(/agentBattlesPollRef\.current = fetchAgentBattles; fetchAgentBattles\(\); const refreshInterval = setInterval\(fetchAgentBattles, 120_000\); return \(\) => \{ clearInterval\(refreshInterval\); agentBattlesPollRef\.current = null; \}; \}, \[screen, isPageVisible\]\);/);
  });

  it('refreshActiveBattles joins the run in flight for the current epoch, or starts one, and marks it explicit', () => {
    const at = APP.indexOf('const refreshActiveBattles = useCallback(');
    const refresh = squash(APP.slice(at, APP.indexOf('}, [agentBattlesFlights]);', at)));
    expect(refresh).toContain('let running = agentBattlesFlights.joinable(epoch);');
    expect(refresh).toContain('if (!running && agentBattlesPollRef.current) { agentBattlesPollRef.current(); running = agentBattlesFlights.joinable(epoch); }');
    expect(refresh).toContain('agentBattlesFlights.markExplicit(running); return running.done;');
    expect(refresh).toContain('const epoch = readAuthIdentity().authEpoch;');
  });

  it('the metadata lives in its own state, set only by the runs\' callbacks and the identity reset', () => {
    expect(APP).toContain('const [activeAgentBattlesPoll, setActiveAgentBattlesPoll] = useState(() => initialActivePoll(readAuthIdentity().authEpoch));');
    const setters = APP.match(/setActiveAgentBattlesPoll\(/g) || [];
    // onRefreshStarted, onSettled, and the identity reset.
    expect(setters).toHaveLength(3);
  });
});

describe('the identity source and the owner-change clear (R-S3-2, R-S3-3)', () => {
  it('App reads the one identity source, once', () => {
    expect(APP).toContain("import { useAuthIdentity, readAuthIdentity, isCurrentIdentity } from './services/authIdentity';");
    expect(APP.match(/\buseAuthIdentity\(\)/g)).toHaveLength(1);
    expect(APP).not.toMatch(/\bonAuthStateChanged\b/);
  });

  it('on an actual identity change: a layout effect clears the list (outside the poll body), resets the metadata and runs the poll at once', () => {
    const at = APP.indexOf('const authIdentity = useAuthIdentity();');
    const effect = squash(APP.slice(at, APP.indexOf('}, [authIdentity]);', at) + '}, [authIdentity]);'.length));
    expect(effect).toBe(
      'const authIdentity = useAuthIdentity(); const seenAuthIdentityRef = useRef(authIdentity); useLayoutEffect(() => { '
      + 'const previous = seenAuthIdentityRef.current; seenAuthIdentityRef.current = authIdentity; '
      + 'if (previous.authEpoch === authIdentity.authEpoch) return; '
      + 'if (previous.resolved) setActiveAgentBattles((list) => (list.length ? [] : list)); '
      + 'setActiveAgentBattlesPoll(initialActivePoll(authIdentity.authEpoch)); '
      + 'agentBattlesPollRef.current?.(); }, [authIdentity]);',
    );
    // ...and the clear is not in the poll body, whose guard keeps the body from ever blanking the list.
    expect(BODY).not.toContain('list.length ? [] : list');
  });
});
