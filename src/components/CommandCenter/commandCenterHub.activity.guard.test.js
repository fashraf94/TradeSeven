// src/components/CommandCenter/commandCenterHub.activity.guard.test.js
//
// Command Center hub, slice S3 (S3 review T5-17) — S3's activity, by count.
//
// commandCenterHub.mount.guard.test.js lists S3's allowances by PATTERN:
// hub/useHubCompletedBattles.js may use `setTimeout`, `addEventListener` and
// `useEffect`; hub/useHubReaders.js `useEffect`. A pattern allowed once is
// allowed any number of times, for any event, with any delay — so a second
// effect, another timer, a scroll listener or a polling chain in either hook
// passed that guard. This one pins what each hook actually DOES: its effects,
// timers and listeners, call by call and by event name, from the parsed source
// (acorn, as the other hub guards: a comment or a string never counts). A hook
// that gains one fails here, until the founder's rulings (R-S3-5, R-S3-6) and
// the lists below say it may.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Parser } from 'acorn';
import acornJsx from 'acorn-jsx';
import { describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HUB = path.join(HERE, 'hub');
const read = (name) => readFileSync(path.join(HUB, name), 'utf8').replace(/\r\n/g, '\n');
// Slice S7: a file beside the shells, not under hub/ (ShadowCanvas.jsx).
const readShell = (name) => readFileSync(path.join(HERE, name), 'utf8').replace(/\r\n/g, '\n');
const parse = (code) => Parser.parse(code, { ecmaVersion: 'latest', sourceType: 'module' });
const parseJsx = (code) => Parser.extend(acornJsx()).parse(code, { ecmaVersion: 'latest', sourceType: 'module' });

/** The calls that start something running: an effect, a timer, a listener, a frame, a read. */
const ACTIVITY_CALLS = new Set([
  'useEffect', 'useLayoutEffect', 'useInsertionEffect', 'useSyncExternalStore',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'setTimer', 'clearTimer',
  'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'queueMicrotask',
  'addEventListener', 'removeEventListener', 'fetch', 'getDoc', 'getDocs', 'onSnapshot', 'onAuthStateChanged',
  // Slice S7: an observer's two calls (its construction is counted as `new <Name>`, below).
  'observe', 'disconnect',
]);

function walk(node, visit) {
  if (!node || typeof node.type !== 'string') return;
  visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'start' || key === 'end') continue;
    if (Array.isArray(value)) value.forEach((child) => walk(child, visit));
    else if (value && typeof value.type === 'string') walk(value, visit);
  }
}

/** Every activity call of a module, sorted: `receiver.name` and, for a listener, the event it names. */
function activityOf(code, parser = parse) {
  const found = [];
  walk(parser(code), (node) => {
    // Slice S7: an observer is constructed, not called: `new IntersectionObserver(…)` counts as itself.
    if (node.type === 'NewExpression' && node.callee.type === 'Identifier' && /Observer$/.test(node.callee.name)) {
      found.push(`new ${node.callee.name}`);
      return;
    }
    if (node.type !== 'CallExpression') return;
    const { callee } = node;
    let name = null;
    let receiver = null;
    if (callee.type === 'Identifier') name = callee.name;
    else if (callee.type === 'MemberExpression' && !callee.computed && callee.property.type === 'Identifier') {
      name = callee.property.name;
      receiver = callee.object.type === 'Identifier' ? callee.object.name : '?';
    }
    if (!name || !ACTIVITY_CALLS.has(name)) return;
    const first = node.arguments[0];
    const event = /EventListener$/.test(name) ? (first && first.type === 'Literal' ? ` '${first.value}'` : ' ?') : '';
    found.push(`${receiver ? `${receiver}.` : ''}${name}${event}`);
  });
  return found.sort();
}

// The coordinator's thin hook (R-S3-5, R-S3-6): the real clock's timers handed to the pure scheduler (setTimeout and
// clearTimeout inside REAL_CLOCK, and the one tick that starts the mount cycle), the page's visibility and focus
// listeners — each removed again — and the one effect that owns the scheduler for an owner and epoch.
const COMPLETED_BATTLES_HOOK = [
  'clearTimeout',
  'clock.clearTimer',
  'clock.setTimer',
  "document.addEventListener 'visibilitychange'",
  "document.removeEventListener 'visibilitychange'",
  'setTimeout',
  'useEffect',
  "window.addEventListener 'focus'",
  "window.removeEventListener 'focus'",
];
// The readers' glue (R-S3-8): the one effect that refreshes the window when a live id leaves a successful poll.
const READERS_HOOK = ['useEffect'];

describe('S3\'s hooks hold exactly the activity they were allowed (S3 review T5-17)', () => {
  it('useHubCompletedBattles: one effect, the real clock\'s one timer pair, one mount tick, and the visibility and focus listeners only', () => {
    expect(activityOf(read('useHubCompletedBattles.js'))).toEqual(COMPLETED_BATTLES_HOOK);
  });

  it('useHubReaders: one effect — the live-left refresh — and no timer, listener or read of its own', () => {
    expect(activityOf(read('useHubReaders.js'))).toEqual(READERS_HOOK);
  });

  it('the scan bites: each activity added to either hook changes its list', () => {
    const plants = {
      'a second page listener': "window.addEventListener('scroll', () => {});",
      'a keydown listener': "document.addEventListener('keydown', () => {});",
      'a listener on another receiver': "document.body.addEventListener('click', () => {});",
      'a second timer': 'setTimeout(() => {}, 1000);',
      'a timer on window': 'window.setTimeout(() => {}, 1000);',
      'a polling chain': 'const poll = () => setTimeout(poll, 1000);',
      'an interval': 'setInterval(() => {}, 1000);',
      'a frame loop': 'requestAnimationFrame(() => {});',
      'a second effect': 'useEffect(() => {}, []);',
      'a layout effect': 'useLayoutEffect(() => {}, []);',
      'a read': 'getDocs(q);',
      'a snapshot listener': 'onSnapshot(q, () => {});',
    };
    const hooks = { 'useHubCompletedBattles.js': COMPLETED_BATTLES_HOOK, 'useHubReaders.js': READERS_HOOK };
    for (const [file, expected] of Object.entries(hooks)) {
      for (const [what, snippet] of Object.entries(plants)) {
        expect(activityOf(`${read(file)}\n${snippet}\n`), `${file}: ${what}`).not.toEqual(expected);
      }
    }
  });

  it('the scan sees only calls: a comment or a string that names an activity is not one', () => {
    const quiet = "// setTimeout(f, 1); useEffect(g)\nconst note = 'window.addEventListener(\"focus\", f)';\n/* getDocs(q) */";
    expect(activityOf(quiet)).toEqual([]);
    expect(activityOf("window.addEventListener('focus', f); document.removeEventListener(name, f);")).toEqual(['document.removeEventListener ?', "window.addEventListener 'focus'"]);
  });

  it('an observer is counted, built and called: `new IntersectionObserver`, observe and disconnect', () => {
    expect(activityOf('const o = new IntersectionObserver(cb); o.observe(el); o.disconnect();'))
      .toEqual(['new IntersectionObserver', 'o.disconnect', 'o.observe']);
  });
});

// ── Slice S7 (rulings R-S7-1, R-S7-5): Shadow, moving — call by call ─────────
//
// commandCenterHub.mount.guard.test.js allows ShadowCanvas.jsx five PATTERNS (a frame request, an observer, a listener,
// a timeout, an effect); a pattern allowed once is allowed any number of times. This pins what the canvas actually
// DOES, from the parsed source: every frame it requests and cancels, the one observer it builds and disconnects, the one
// listener it adds and removes (by event name), the one timeout it sets and clears, and its four effects — the
// canvas's lifetime, the pause that follows the ceremony, the response, and the still's flash timer. A fourth effect, a second listener, a
// timer in the loop or a second observer fails here until a ruling says it may. The pure modules hold none.
const SHADOW_CANVAS = [
  'cancelAnimationFrame',
  'clearTimeout',
  "document.addEventListener 'visibilitychange'",
  "document.removeEventListener 'visibilitychange'",
  'new IntersectionObserver',
  'observer.disconnect',
  'observer.observe',
  'requestAnimationFrame',
  'requestAnimationFrame',
  'setTimeout',
  'useEffect',
  'useEffect',
  'useEffect',
  'useEffect',
];
const SHADOW_PURE = ['shadowCanvas.js', 'shadowBloom.js', 'shadowStatus.js'];

// ── Agent form build S1 (founder ruling R6c): the armored hero, call by call ─────────────────────────────────────────
//
// With AGENT_FORM_HUB_ENABLED on, the hub's stage renders HubAgentForm.jsx, which renders the agent form's wrapper
// (src/components/AgentForm/AgentForm.jsx). The mount guard allows the wrapper two PATTERNS (an effect, a listener);
// this pins what it DOES: six effects — the pixel ratio's resize listener, the engine view's mount, its spec
// updates (a change of archetype there is the swap), its options, its equip and the response (build S2, ruling R19) — and
// the one window 'resize' listener, removed again. The hub view holds none: the response's timing is the engine's. The engine's loop, observer, visibility and context listeners are
// behind the one lazy edge (ruling R6a), in engine.lifecycle.jsdom.test.js's census.
const readAgentForm = (name) => readFileSync(path.join(HERE, '..', 'AgentForm', name), 'utf8').replace(/\r\n/g, '\n');
const AGENT_FORM_WRAPPER_CALLS = [
  'useEffect',
  'useEffect',
  'useEffect',
  'useEffect',
  'useEffect',
  'useEffect',
  "window.addEventListener 'resize'",
  "window.removeEventListener 'resize'",
].sort();

describe('agent form build S1: the armored hero holds exactly the activity it was allowed (ruling R6c)', () => {
  it('AgentForm.jsx: six effects and one window resize listener (removed again) — no frame, timer, observer or read of its own', () => {
    expect(activityOf(readAgentForm('AgentForm.jsx'), parseJsx)).toEqual(AGENT_FORM_WRAPPER_CALLS);
  });

  it('HubAgentForm.jsx: none at all', () => {
    expect(activityOf(readShell('HubAgentForm.jsx'), parseJsx)).toEqual([]);
  });

  it('the scan bites: each activity added to the wrapper or the hub view changes its list', () => {
    const plants = {
      'a second resize listener': "window.addEventListener('resize', () => {});",
      'a media-query listener': "mq.addEventListener('change', () => {});",
      'a visibility listener': "document.addEventListener('visibilitychange', () => {});",
      'an observer': 'const io = new IntersectionObserver(() => {});',
      'a timer': 'setTimeout(() => {}, 1000);',
      'a frame loop': 'requestAnimationFrame(() => {});',
      'a sixth effect': 'useEffect(() => {}, []);',
      'a layout effect': 'useLayoutEffect(() => {}, []);',
    };
    for (const [what, snippet] of Object.entries(plants)) {
      expect(activityOf(`${readAgentForm('AgentForm.jsx')}\n${snippet}\n`, parseJsx), `AgentForm.jsx: ${what}`).not.toEqual(AGENT_FORM_WRAPPER_CALLS);
      expect(activityOf(`${readShell('HubAgentForm.jsx')}\n${snippet}\n`, parseJsx), `HubAgentForm.jsx: ${what}`).not.toEqual([]);
    }
  });
});

// ── Huddle S1 (Huddle spec Amendment C V1.2 §C7, §C8; Command Center spec V1.2 Amendment D §D3, §D4): the Huddle's two
// readers and the sheet's body, call by call. They live outside this directory (permitted terminals the mount guard's walk stops
// at), so their activity is pinned HERE, as C7 and C8 require: every listener in the manifest, no poll anywhere.
const readSrc = (rel) => readFileSync(path.join(HERE, '..', '..', rel), 'utf8').replace(/\r\n/g, '\n');
// The record's reader: its read on mount / owner or epoch change, and the one visibility listener (removed again). No timer.
const HUDDLE_TODAY = ["document.addEventListener 'visibilitychange'", "document.removeEventListener 'visibilitychange'", 'useEffect'];
// The history's reader: one read per owner and epoch. No timer, no listener.
const HUDDLE_HISTORY = ['useEffect'];
// The sheet's body: the hidden-tab stop (one visibility listener, removed again) with the unmount stop and the reconfirm scroll in
// one effect, and the ceremony stop in a second. The audio element's own listeners are React props (onPlay, onTimeUpdate, …), never
// addEventListener; playback never starts on its own (no .play() outside the Play handler — the row below).
// Review L3-4 / L3-9: the unmount stop is the audio element's own ref cleanup (not an effect: a useEffect cleanup finds the
// ref already cleared); three effects — the hidden-tab stop (one visibility listener, removed again), the ceremony stop, and
// the Reconfirm door's landing on the plan, which runs in ONE microtask so it comes after the HubSheet's focus to Close.
const HUDDLE_BODY = ["document.addEventListener 'visibilitychange'", "document.removeEventListener 'visibilitychange'", 'queueMicrotask', 'useEffect', 'useEffect', 'useEffect'];

describe('Huddle S1: the readers and the sheet body hold exactly the activity they were allowed (Huddle C §C7, §C8)', () => {
  it('useHuddleToday: one effect and one visibility listener (removed again) — no timer, no interval, no poll', () => {
    expect(activityOf(readSrc('hooks/useHuddleToday.js'))).toEqual(HUDDLE_TODAY);
  });

  it('useHuddleHistory: one effect — no listener, no timer', () => {
    expect(activityOf(readSrc('hooks/useHuddleHistory.js'))).toEqual(HUDDLE_HISTORY);
  });

  it('HuddleSheetBody: three effects, one microtask and one visibility listener (removed again); audio plays only from the Play handler (no autoplay)', () => {
    const code = readSrc('components/Huddle/HuddleSheetBody.jsx');
    expect(activityOf(code, parseJsx)).toEqual(HUDDLE_BODY);
    expect(code).not.toMatch(/\bautoPlay\b|\bautoplay\b/);
    // every .play() sits inside the Play handler (resume, or a fresh URL): nothing else starts playback
    const handler = code.slice(code.indexOf('const play = async () => {'), code.indexOf('const onConfirm = async () => {'));
    expect(handler.length).toBeGreaterThan(0);
    expect(code.match(/\.play\(\)/g)).toHaveLength(2);
    expect(handler.match(/\.play\(\)/g)).toHaveLength(2);
    // The stops themselves (unmount, hidden tab, ceremony, and a Play still waiting for its URL) are behaviour rows in
    // Huddle.jsdom.test.jsx, not text matches here.
  });

  it('the scan bites: a poll, a second listener or an autoplay changes what the rows see', () => {
    const plants = { 'a poll': 'setInterval(() => {}, 60000);', 'a timer': 'setTimeout(() => {}, 1000);', 'a focus listener': "window.addEventListener('focus', () => {});", 'an effect': 'useEffect(() => {}, []);' };
    for (const [what, snippet] of Object.entries(plants)) {
      expect(activityOf(`${readSrc('hooks/useHuddleToday.js')}\n${snippet}\n`), what).not.toEqual(HUDDLE_TODAY);
      expect(activityOf(`${readSrc('hooks/useHuddleHistory.js')}\n${snippet}\n`), what).not.toEqual(HUDDLE_HISTORY);
      expect(activityOf(`${readSrc('components/Huddle/HuddleSheetBody.jsx')}\n${snippet}\n`, parseJsx), what).not.toEqual(HUDDLE_BODY);
    }
  });
});

// ── Command Center Amendment E V1.1 §1, §3.2: the research door — the admission hook and the two readers, call by call (they live
// outside this directory, permitted terminals the mount guard's walk stops at, so their activity is pinned HERE), the readers'
// one query, and the sheet's wrapper and loader, which hold none. No reader polls, listens or re-reads on focus.
// The admission hook: one effect, the one verdict ask per owner and epoch (readFilmRoomVerdict, cached per owner). No timer.
const RESEARCH_ADMISSION = ['useEffect'];
// The stories reader: one effect, fetchFeed() once per owner and epoch. No listener, no timer.
const RESEARCH_STORIES = ['useEffect'];
// The research reader: one effect, the researchWork query once per owner and epoch. No listener, no timer.
const RESEARCH_RECORDS = ['useEffect'];
// The research reader's service: the one read.
const RESEARCH_RECORDS_SERVICE = ['getDocs'];

describe('Amendment E §1, §3.2: the research door\'s hooks hold exactly the activity they were allowed, and the sheet\'s wrapper and loader none', () => {
  it('useHubResearchAdmission: one effect — the one ask — no timer, no listener, no poll', () => {
    expect(activityOf(readSrc('hooks/useHubResearchAdmission.js'))).toEqual(RESEARCH_ADMISSION);
  });

  it('useHubStories: one effect — no listener, no timer, no poll', () => {
    expect(activityOf(readSrc('hooks/useHubStories.js'))).toEqual(RESEARCH_STORIES);
  });

  it('useHubSharedResearch: one effect — no listener, no timer, no poll', () => {
    expect(activityOf(readSrc('hooks/useHubSharedResearch.js'))).toEqual(RESEARCH_RECORDS);
  });

  it('the research reader\'s service: one read (getDocs), no snapshot listener', () => {
    expect(activityOf(readSrc('services/sharedResearchRecords.js'))).toEqual(RESEARCH_RECORDS_SERVICE);
  });

  it('the sheet\'s wrapper, its loader, the door view and the selector hold no activity at all', () => {
    expect(activityOf(readShell('SharedResearchSheet.jsx'), parseJsx)).toEqual([]);
    expect(activityOf(read('loadSharedResearch.js'))).toEqual([]);
    expect(activityOf(read('researchDoorView.js'))).toEqual([]);
    expect(activityOf(readSrc('selectors/storySelection.js'))).toEqual([]);
  });

  it('the scan bites: a poll, a second listener or an effect planted in any of them changes what the rows see', () => {
    const plants = {
      'a poll': 'setInterval(() => {}, 60000);',
      'a timer': 'setTimeout(() => {}, 1000);',
      'a focus listener': "window.addEventListener('focus', () => {});",
      'a visibility listener': "document.addEventListener('visibilitychange', () => {});",
      'an effect': 'useEffect(() => {}, []);',
      'a snapshot listener': 'onSnapshot(q, () => {});',
    };
    const files = {
      'hooks/useHubResearchAdmission.js': RESEARCH_ADMISSION,
      'hooks/useHubStories.js': RESEARCH_STORIES,
      'hooks/useHubSharedResearch.js': RESEARCH_RECORDS,
      'services/sharedResearchRecords.js': RESEARCH_RECORDS_SERVICE,
      'selectors/storySelection.js': [],
    };
    for (const [what, snippet] of Object.entries(plants)) {
      for (const [file, expected] of Object.entries(files)) {
        expect(activityOf(`${readSrc(file)}\n${snippet}\n`), `${file}: ${what}`).not.toEqual(expected);
      }
      expect(activityOf(`${readShell('SharedResearchSheet.jsx')}\n${snippet}\n`, parseJsx), `SharedResearchSheet.jsx: ${what}`).not.toEqual([]);
      expect(activityOf(`${read('loadSharedResearch.js')}\n${snippet}\n`), `loadSharedResearch.js: ${what}`).not.toEqual([]);
    }
  });
});

describe('S7: Shadow\'s canvas holds exactly the activity it was allowed (R-S7-1, R-S7-5)', () => {
  it('ShadowCanvas.jsx: four effects, one frame loop (two requests, one cancel), one observer, one visibility listener (removed again) and one timeout (cleared)', () => {
    expect(activityOf(readShell('ShadowCanvas.jsx'), parseJsx)).toEqual(SHADOW_CANVAS);
  });

  it('the pure modules (the drawing and its effects state, the response rule, the status words) hold no activity at all', () => {
    for (const file of SHADOW_PURE) expect(activityOf(read(file)), file).toEqual([]);
  });

  it('the scan bites: each activity added to the canvas changes its list', () => {
    const plants = {
      'a second listener': "window.addEventListener('resize', () => {});",
      'a keydown listener': "document.addEventListener('keydown', () => {});",
      'a media-query listener': "mq.addEventListener('change', () => {});",
      'a second observer': 'const second = new ResizeObserver(() => {});',
      'an observer built elsewhere': 'const io = new IntersectionObserver(() => {});',
      'a second timer': 'setTimeout(() => {}, 1000);',
      'an interval': 'setInterval(() => {}, 1000);',
      'a third frame request': 'requestAnimationFrame(() => {});',
      'a fourth effect': 'useEffect(() => {}, []);',
      'a layout effect': 'useLayoutEffect(() => {}, []);',
      'a read': 'getDocs(q);',
    };
    for (const [what, snippet] of Object.entries(plants)) {
      expect(activityOf(`${readShell('ShadowCanvas.jsx')}\n${snippet}\n`, parseJsx), `ShadowCanvas.jsx: ${what}`).not.toEqual(SHADOW_CANVAS);
      for (const file of SHADOW_PURE) expect(activityOf(`${read(file)}\n${snippet}\n`), `${file}: ${what}`).not.toEqual([]);
    }
  });
});

// ── Build A2 (FD-3): the League lock's one subscription, call by call ───────────────────────────────────────────────
//
// The mount guard allows hub/useLeagueLoadoutLock.js two PATTERNS (an effect, a subscribe call). This pins what it DOES:
// one effect, whose body starts the owner's one subscription through the client read and returns its unsubscribe as
// the cleanup. The client read itself (src/services/leagueLockService.js) is a permitted terminal: one onSnapshot.
describe('A2: the League lock holds exactly the activity it was allowed (FD-3)', () => {
  const LOCK_HOOK = read('useLeagueLoadoutLock.js');

  it('one effect, nothing else the scan counts', () => {
    expect(activityOf(LOCK_HOOK)).toEqual(['useEffect']);
  });

  it('the effect starts one subscription, for the owner, and its cleanup is that subscription\'s unsubscribe', () => {
    const code = LOCK_HOOK.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code.match(/\bsubscribeLeagueLock\(/g)).toHaveLength(1);
    expect(code).toMatch(/return subscribeLeagueLock\(uid, /);
    expect(code).toMatch(/\}, \[uid\]\);/);
  });

  it('the client read: one live query, the writers\' own, judged by the shared rule', () => {
    const service = readFileSync(path.join(HERE, '..', '..', 'services', 'leagueLockService.js'), 'utf8').replace(/\r\n/g, '\n');
    expect(activityOf(service)).toEqual(['onSnapshot']);
    expect(service).toMatch(/where\('groupMembers', 'array-contains', uid\)/);
    expect(service).toMatch(/onLock\(leagueLockOf\(/);
  });

  it('the scan bites: a second effect or a listener planted in the hook changes its list', () => {
    for (const snippet of ['useEffect(() => {}, []);', "window.addEventListener('focus', () => {});", 'setInterval(() => {}, 1000);']) {
      expect(activityOf(`${LOCK_HOOK}\n${snippet}\n`), snippet).not.toEqual(['useEffect']);
    }
  });
});
