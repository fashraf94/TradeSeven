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
// this pins what it DOES: five effects — the pixel ratio's resize listener, the engine view's mount, its spec
// updates (a change of archetype there is the swap), its options and its equip — and the one window 'resize'
// listener, removed again. The hub view holds none. The engine's loop, observer, visibility and context listeners are
// behind the one lazy edge (ruling R6a), in engine.lifecycle.jsdom.test.js's census.
const readAgentForm = (name) => readFileSync(path.join(HERE, '..', 'AgentForm', name), 'utf8').replace(/\r\n/g, '\n');
const AGENT_FORM_WRAPPER_CALLS = [
  'useEffect',
  'useEffect',
  'useEffect',
  'useEffect',
  'useEffect',
  "window.addEventListener 'resize'",
  "window.removeEventListener 'resize'",
].sort();

describe('agent form build S1: the armored hero holds exactly the activity it was allowed (ruling R6c)', () => {
  it('AgentForm.jsx: five effects and one window resize listener (removed again) — no frame, timer, observer or read of its own', () => {
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
