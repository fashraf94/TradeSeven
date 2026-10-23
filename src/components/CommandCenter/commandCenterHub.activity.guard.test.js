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
import { describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HUB = path.join(HERE, 'hub');
const read = (name) => readFileSync(path.join(HUB, name), 'utf8').replace(/\r\n/g, '\n');
const parse = (code) => Parser.parse(code, { ecmaVersion: 'latest', sourceType: 'module' });

/** The calls that start something running: an effect, a timer, a listener, a frame, a read. */
const ACTIVITY_CALLS = new Set([
  'useEffect', 'useLayoutEffect', 'useInsertionEffect', 'useSyncExternalStore',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'setTimer', 'clearTimer',
  'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'queueMicrotask',
  'addEventListener', 'removeEventListener', 'fetch', 'getDoc', 'getDocs', 'onSnapshot', 'onAuthStateChanged',
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
function activityOf(code) {
  const found = [];
  walk(parse(code), (node) => {
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
});
