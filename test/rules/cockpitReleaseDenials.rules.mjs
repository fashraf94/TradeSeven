// test/rules/cockpitReleaseDenials.rules.mjs
//
// The cockpit's own release switch (build prompt BUILD_PROMPT_COCKPIT_RELEASE_SWITCH;
// docs/audits/20261110_COCKPIT_RELEASE_READINESS.md §10) — Firestore security-rules
// acceptance for cockpitConfig/release, the control document
// api/_utils/callRecords/release.js reads through the Admin SDK:
// `{ shareBp, disabled, salt }`, written by hand in the Console.
//
// THE CLAIM UNDER TEST is that the document is UNREADABLE and UNWRITABLE FROM CLIENTS:
// no client verb for
//
//   · the OWNER of a battle that is in the release cohort (owning a battle grants
//     nothing over the switch that admitted it);
//   · another authenticated user;
//   · a privileged-claims context (the strongest identity the app mints; the Admin
//     SDK bypasses rules and is out of scope for an emulator suite);
//   · an unauthenticated client.
//
// The path rests on the root DEFAULT DENY (`match /{document=**} { allow read, write: if false; }`,
// firestore.rules "Default deny everything else") — the cover masteryConfig/epochRegistry rests on
// (masteryDenials.rules.mjs) — and NO rules change is made or needed: this suite asserts the denial
// and pins that no block names the collection, so a grant added later fails here.
//
// POSITIVE CONTROLS in the same run — the owner reads their own battle and still performs its
// execution-control update — so a misloaded or over-broad ruleset cannot pass by failing everything.
//
// Not part of the default vitest run (no `.test.` in the filename). Run:
//     npm run test:rules

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
// The deployed-ruleset knob every sibling honors (wireDenials.rules.mjs).
const RULES_PATH = process.env.COMPOSITION_RULES_TEXT_PATH
  ? resolve(process.env.COMPOSITION_RULES_TEXT_PATH)
  : resolve(__dirname, '../../firestore.rules');
const RULES_TEXT = readFileSync(RULES_PATH, 'utf8');
const RULES_SHA256 = createHash('sha256').update(RULES_TEXT).digest('hex');

const OWNER_UID = 'release-owner-1';
const OTHER_UID = 'release-intruder-2';
const PRIVILEGED_UID = 'release-admin-3';
const PRIVILEGED_CLAIMS = { admin: true, role: 'service' };

const BATTLE = 'agentBattles/battle-rel-1';
const CONTROL = 'cockpitConfig/release';

const battle = () => ({ ownerId: OWNER_UID, agentId: 'agent-1', status: 'active', gameMode: 'baggerbomb_agent' });
const control = () => ({ shareBp: 500, disabled: false, salt: 'stage-1' });

let testEnv;

async function seed(path, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), path), data); });
}
const asOwner = () => testEnv.authenticatedContext(OWNER_UID).firestore();
const asOther = () => testEnv.authenticatedContext(OTHER_UID).firestore();
const asPrivileged = () => testEnv.authenticatedContext(PRIVILEGED_UID, PRIVILEGED_CLAIMS).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();
const EVERYONE = [
  ['the owner of a battle in the cohort', asOwner],
  ['another user', asOther],
  ['a privileged-claims context', asPrivileged],
  ['an unauthenticated client', asAnon],
];

beforeAll(async () => {
  console.log(`[cockpitReleaseDenials] loaded rules text: ${RULES_PATH}`);
  console.log(`[cockpitReleaseDenials] rules text sha256: ${RULES_SHA256}`);
  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  const [emuHost, emuPort] = host.split(':');
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-tradeseven-rules',
    firestore: { rules: RULES_TEXT, host: emuHost, port: Number(emuPort) },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });
beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(BATTLE, battle());
  await seed(CONTROL, control());
});

describe('the suite can tell a grant from a denial (positive controls)', () => {
  it('the owner reads their own battle', async () => {
    await assertSucceeds(getDoc(doc(asOwner(), BATTLE)));
  });
  it('the owner\'s execution-control update on that battle still works', async () => {
    await assertSucceeds(updateDoc(doc(asOwner(), BATTLE), { executionMode: 'autopilot' }));
  });
});

describe('cockpitConfig/release — server-only: no client verb for anyone', () => {
  for (const [who, ctx] of EVERYONE) {
    it(`${who} cannot READ the control document, by get or by query`, async () => {
      await assertFails(getDoc(doc(ctx(), CONTROL)));
      await assertFails(getDocs(collection(ctx(), 'cockpitConfig')));
    });
    it(`${who} cannot CREATE, UPDATE, MERGE or DELETE the control document (no way to widen the share or turn the switch back on)`, async () => {
      await assertFails(setDoc(doc(ctx(), 'cockpitConfig/other'), control()));
      await assertFails(setDoc(doc(ctx(), CONTROL), { shareBp: 10000, disabled: false, salt: 'x' }));
      await assertFails(updateDoc(doc(ctx(), CONTROL), { shareBp: 10000 }));
      await assertFails(setDoc(doc(ctx(), CONTROL), { disabled: false }, { merge: true }));
      await assertFails(deleteDoc(doc(ctx(), CONTROL)));
    });
  }
});

/** The statements of every `match <path> {` block whose path matches `pathRe`, comments stripped, nested blocks included. */
function ruleBlocks(text, pathRe) {
  const blocks = [];
  const re = new RegExp(`match ${pathRe.source} \\{`, 'g');
  while (re.exec(text) !== null) {
    let depth = 1;
    let i = re.lastIndex;
    for (; i < text.length && depth > 0; i += 1) {
      if (text[i] === '{') depth += 1;
      else if (text[i] === '}') depth -= 1;
    }
    blocks.push(text.slice(re.lastIndex, i - 1).split('\n').map((l) => l.replace(/\/\/.*$/, '').trim()).filter(Boolean));
  }
  return blocks;
}

describe('the posture is written down, not only inherited', () => {
  it('NO GRANT: no block that names the collection may allow anything — today none exists (the root default-deny covers it); an explicit `allow read, write: if false;` block (what the sibling cockpit collections carry) would also pass; a grant fails here', () => {
    // Every spelling of a match block for the path: `/cockpitConfig/{doc}`, `/cockpitConfig/release`, a bare `/cockpitConfig/{doc=**}`,
    // and the collection-group form `/{path=**}/cockpitConfig/{doc}`.
    const named = [
      ...ruleBlocks(RULES_TEXT, /\/cockpitConfig\/(?:\{[^}]*\}|[^\s{]+)/),
      ...ruleBlocks(RULES_TEXT, /\/\{[^}]*=\*\*\}\/cockpitConfig\/(?:\{[^}]*\}|[^\s{]+)/),
    ];
    for (const statements of named) expect(statements).toEqual(['allow read, write: if false;']);
    expect(RULES_TEXT).not.toMatch(/cockpitConfig[^\n]*\n[^}]*allow\s+(read|write|get|list|create|update|delete)[^;]*if\s+(?!false)/);
  });
  it('planted: the pin is not blind — a one-line, multi-line, literal-document and collection-group grant each produce a block that is not `allow read, write: if false;`', () => {
    const pins = [/\/cockpitConfig\/(?:\{[^}]*\}|[^\s{]+)/, /\/\{[^}]*=\*\*\}\/cockpitConfig\/(?:\{[^}]*\}|[^\s{]+)/];
    const found = (rules) => pins.flatMap((re) => ruleBlocks(rules, re));
    for (const grant of [
      'match /cockpitConfig/{docId} { allow read: if true; }',
      'match /cockpitConfig/{docId} {\n  allow read: if true;\n}',
      'match /cockpitConfig/release {\n  allow write: if request.auth != null;\n}',
      'match /{path=**}/cockpitConfig/{docId} {\n  allow read: if true;\n}',
    ]) {
      const blocks = found(grant);
      expect(blocks.length, grant).toBe(1);
      expect(blocks[0], grant).not.toEqual(['allow read, write: if false;']);
    }
    expect(found('match /cockpitConfig/{docId} {\n  allow read, write: if false;\n}')).toEqual([['allow read, write: if false;']]);
  });
  it('no match block opens on a WILDCARD first segment except the two that exist today (the root default-deny and the `hypothesisVersions` collection group): a `match /{col}/{id}` grant would cover the control document without naming it (RS-L4-11)', () => {
    const wildcardFirst = (rules) => {
      const text = rules.split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
      const re = /match\s+(\/(?:[^\s{}]+|\{[^}]*\})(?:\/(?:[^\s{}]+|\{[^}]*\}))*)\s*\{/g;
      return [...text.matchAll(re)].map((m) => m[1]).filter((p) => p.startsWith('/{'));
    };
    const KNOWN = [/^\/\{path=\*\*\}\/hypothesisVersions\//, /^\/\{document=\*\*\}$/];
    const unknown = (rules) => wildcardFirst(rules).filter((p) => !KNOWN.some((k) => k.test(p)));
    expect(unknown(RULES_TEXT)).toEqual([]);
    // planted: a grant on any wildcard collection, with or without a condition, is seen
    expect(unknown('match /{col}/{id} { allow read; }')).toEqual(['/{col}/{id}']);
    expect(unknown('match /{col}/release {\n  allow read: if true;\n}')).toEqual(['/{col}/release']);
    expect(unknown('match /{path=**}/cockpitConfig/{docId} {\n  allow read: if true;\n}')).toHaveLength(1);
  });
  it('the root default-deny is the cover, and says exactly `allow read, write: if false;`', () => {
    const m = RULES_TEXT.match(/match \/\{document=\*\*\} \{([^}]*)\}/);
    expect(m, 'the root default-deny block').not.toBeNull();
    expect(m[1].split('\n').map((l) => l.replace(/\/\/.*$/, '').trim()).filter(Boolean)).toEqual(['allow read, write: if false;']);
  });
});
