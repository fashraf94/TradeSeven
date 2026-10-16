// src/components/CommandCenter/hubCopy.guard.test.js
//
// Command Center hub — the copy guard (spec V1.2 §11.3 "All strings
// centralized and guarded; no learning / improvement / intelligence / earned
// tier, unsupported source counts, fake history or preference authority").
// Covers both of the hub's copy tables, as the S0 report asked (L4-6): the
// hub's (hub/hubCopy.js, lazy chunk) and the gate's (hubGateCopy.js, main
// chunk).
//
//   1. no user-visible string is written anywhere else under
//      src/components/CommandCenter/ — the layout fixtures are illustrative
//      data and exempt. The scan parses each file (acorn with acorn-jsx, the
//      parser four repo guards already use) and judges by position, not by
//      wording (S1 review L5-2): any JSX text with a letter; any string or
//      template literal with a letter that a JSX child or a JSX attribute
//      renders, through `&&`, `?:`, `+` and template parts; and any such
//      literal given to a copy-named property (`label`, `title`, `sub` …) in
//      any file. The never-copy attributes (ids, data-*, classes, styles, roles,
//      SVG geometry and the hub's token-valued props) are listed, and a
//      token-valued prop must still hold a token. Its boundary: a string held
//      in a plain variable and passed by name is not seen;
//   2. the strings the spec fixes are exactly the spec's;
//   3. no string claims growth, counts, history or authority the hub does not
//      hold, and no prototype chrome word or "Tester" survives — checked on
//      every literal the copy tables' source holds, so no branch of a copy
//      function goes unread (S1 review L5-3), and on sampled outputs;
//   4. the hold's "1.3 s" agrees with the shipped hold (display agreement,
//      BUILD_RULES §9) — a tripwire on useHoldToDeploy.js's HOLD_MS.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Parser } from 'acorn';
import acornJsx from 'acorn-jsx';
import { describe, expect, it } from 'vitest';
import { HUB_COPY } from './hub/hubCopy';
import { HUB_GATE_COPY } from './hubGateCopy';

const JsxParser = Parser.extend(acornJsx());
/** Parse a module, JSX included. A file that does not parse fails its row; none is skipped. */
const parseModule = (code) => JsxParser.parse(code, { ecmaVersion: 'latest', sourceType: 'module' });

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const read = (rel) => readFileSync(path.join(REPO_ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

const DIR = 'src/components/CommandCenter';
const COPY_TABLES = [`${DIR}/hub/hubCopy.js`, `${DIR}/hubGateCopy.js`];

function hubSourceFiles() {
  const out = [];
  const walk = (abs) => {
    for (const ent of readdirSync(abs, { withFileTypes: true })) {
      const child = path.join(abs, ent.name);
      if (ent.isDirectory()) { if (ent.name !== '__fixtures__') walk(child); continue; }
      if (/\.[mc]?jsx?$/.test(ent.name) && !/\.test\.[mc]?jsx?$/.test(ent.name)) out.push(path.relative(REPO_ROOT, child).split(path.sep).join('/'));
    }
  };
  walk(path.join(REPO_ROOT, DIR));
  return out.filter((rel) => !COPY_TABLES.includes(rel));
}

// A user-visible string written in place, judged by where it sits (S1 review L5-2).
const LETTER = /[A-Za-z]/;
/** Attributes that never carry copy: identity, wiring, styling, ARIA state, and SVG geometry and paint. */
const NEVER_COPY_ATTRIBUTES = new Set([
  'id', 'key', 'ref', 'className', 'style', 'role', 'type', 'tabIndex', 'htmlFor', 'xmlns', 'as',
  'aria-hidden', 'aria-live', 'aria-modal', 'aria-orientation', 'aria-controls', 'aria-labelledby', 'aria-describedby',
  'aria-selected', 'aria-expanded', 'aria-disabled', 'aria-current', 'aria-atomic', 'aria-haspopup',
  'd', 'viewBox', 'fill', 'stroke', 'strokeWidth', 'strokeLinecap', 'strokeLinejoin', 'strokeDasharray', 'stopColor', 'stopOpacity',
  'offset', 'gradientUnits', 'transform', 'points', 'preserveAspectRatio', 'fillRule', 'clipRule', 'vectorEffect',
]);
/** The hub's own token-valued props: never copy, but each value must still be a token (`bolt`, `secondary`, `ink-2`, `chevR`). */
const TOKEN_ATTRIBUTES = new Set(['accent', 'icon', 'kind', 'name', 'tone', 'aria-live', 'aria-orientation', 'role', 'type', 'as']);
const TOKEN = /^[a-z][a-zA-Z0-9-]*$/;
/** Object properties whose string value is shown to the player, in any hub file. */
const COPY_PROPERTIES = new Set([
  'label', 'title', 'text', 'sub', 'caption', 'heading', 'message', 'placeholder', 'alt', 'ariaLabel', 'aria-label',
  'description', 'summary', 'cta', 'why', 'detail', 'eyebrow', 'hint', 'help', 'empty', 'line', 'line1', 'line2',
]);

/** The string pieces an expression renders: literals, template parts, and both sides of `&&`, `||`, `??`, `?:` and `+`. */
function renderedStrings(node, out = []) {
  if (!node) return out;
  switch (node.type) {
    case 'Literal': if (typeof node.value === 'string') out.push(node.value); break;
    case 'TemplateLiteral': node.quasis.forEach((q) => out.push(q.value.cooked ?? q.value.raw)); node.expressions.forEach((e) => renderedStrings(e, out)); break;
    case 'LogicalExpression': renderedStrings(node.left, out); renderedStrings(node.right, out); break;
    case 'ConditionalExpression': renderedStrings(node.consequent, out); renderedStrings(node.alternate, out); break;
    case 'BinaryExpression': if (node.operator === '+') { renderedStrings(node.left, out); renderedStrings(node.right, out); } break;
    case 'SequenceExpression': renderedStrings(node.expressions[node.expressions.length - 1], out); break;
    case 'ArrayExpression': node.elements.forEach((e) => renderedStrings(e, out)); break;
    default: break;
  }
  return out;
}

const attributeName = (n) => (n.type === 'JSXNamespacedName' ? `${n.namespace.name}:${n.name.name}` : n.name);
const clip = (s) => s.replace(/\s+/g, ' ').trim().slice(0, 60);

function literalCopyIn(code) {
  const hits = [];
  const visit = (node, parent) => {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'JSXText' && LETTER.test(node.value)) hits.push(`JSX text: ${clip(node.value)}`);
    if (node.type === 'JSXExpressionContainer' && (parent?.type === 'JSXElement' || parent?.type === 'JSXFragment')) {
      for (const s of renderedStrings(node.expression)) if (LETTER.test(s)) hits.push(`JSX child: ${clip(s)}`);
    }
    if (node.type === 'JSXAttribute' && node.value) {
      const name = attributeName(node.name);
      const values = node.value.type === 'Literal' ? [String(node.value.value)]
        : node.value.type === 'JSXExpressionContainer' ? renderedStrings(node.value.expression) : [];
      const lettered = values.filter((s) => LETTER.test(s));
      if (TOKEN_ATTRIBUTES.has(name)) {
        for (const s of lettered) if (!TOKEN.test(s)) hits.push(`attribute ${name}: ${clip(s)}`);
      } else if (!NEVER_COPY_ATTRIBUTES.has(name) && !name.startsWith('data-')) {
        for (const s of lettered) hits.push(`attribute ${name}: ${clip(s)}`);
      }
    }
    if (node.type === 'Property' && !node.computed) {
      const key = node.key.type === 'Identifier' ? node.key.name : String(node.key.value);
      if (COPY_PROPERTIES.has(key)) for (const s of renderedStrings(node.value)) if (LETTER.test(s)) hits.push(`property ${key}: ${clip(s)}`);
    }
    for (const [k, v] of Object.entries(node)) {
      if (k === 'start' || k === 'end') continue;
      if (Array.isArray(v)) v.forEach((child) => visit(child, node));
      else if (v && typeof v.type === 'string') visit(v, node);
    }
  };
  visit(parseModule(code), null);
  return hits;
}

/** Every string literal and template part in a module's source. */
function sourceStrings(code) {
  const out = [];
  const visit = (node) => {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'Literal' && typeof node.value === 'string') out.push(node.value);
    if (node.type === 'TemplateElement') out.push(node.value.cooked ?? node.value.raw);
    for (const [k, v] of Object.entries(node)) {
      if (k === 'start' || k === 'end') continue;
      if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v.type === 'string') visit(v);
    }
  };
  visit(parseModule(code));
  return out;
}

/** Every string value in a copy table, functions sampled with placeholder arguments. */
function strings(table) {
  const out = [];
  const visit = (v) => {
    if (typeof v === 'string') out.push(v);
    else if (typeof v === 'function') out.push(String(v(...Array.from({ length: Math.max(1, v.length) }, (_, i) => `ARG${i}`))));
    else if (v && typeof v === 'object') Object.values(v).forEach(visit);
  };
  visit(table);
  return out;
}
/** Every literal the two tables' source holds, whichever branch of a copy function it sits in (S1 review L5-3). */
const SOURCE_COPY = COPY_TABLES.flatMap((rel) => sourceStrings(read(rel)));
const ALL_COPY = [...strings(HUB_COPY), ...strings(HUB_GATE_COPY), ...SOURCE_COPY];

describe('copy centralization — every user-visible string is in a copy table', () => {
  it('no file under src/components/CommandCenter/ writes copy in place', () => {
    const files = hubSourceFiles();
    expect(files.length, 'the walk found nothing, so this row would be vacuous').toBeGreaterThan(20);
    // Comments are not stripped first: the parser skips them, and a regex strip could cut code.
    const hits = files.flatMap((rel) => literalCopyIn(read(rel)).map((h) => `${rel} — ${h}`));
    expect(hits).toEqual([]);
  });

  it('the scan is not vacuous: it flags each way copy can be written in place', () => {
    const asModule = (jsx) => `export const X = () => (\n${jsx}\n);`;
    for (const planted of [
      '<p>Checking your games</p>',
      '<span>Ready to deploy<Icon name="x" /></span>',
      "<span>{'Hold to deploy'}</span>",
      '<button aria-label="Close" />',
      '<HubButton ariaLabel={"Not now"} />',
      '<HubSheet title={`Completed games`} />',
      '<Row label="Game history" />',
      // S1 review L5-2: text after an expression (GC1), text over two lines (GC2), text led by a dash (GC6),
      // a string behind `&&` in an attribute (GC4) and in a child (GC5), a copy prop not on any list (GC8).
      '<span>{completed.length} completed</span>',
      '<span>\n  Checking the\n  ideas list\n</span>',
      '<span> — never rewrites a game in progress.</span>',
      "<section aria-label={rootRef && 'Command Center'} />",
      "<p>{COPY.loading && 'Loading the Command Center…'}</p>",
      '<EmptyNote icon="sword" sub="Your first BaggerBomb game starts from Deploy." />',
      '<Icon name="Partnership" />',
      '<span>{ready ? COPY.a : `Checking ${what}`}</span>',
      // The L5 refuter's two: a ternary child and a ternary attribute.
      "<HubLink>{open ? 'Less' : 'More'}</HubLink>",
      "<section aria-label={desktop ? 'Command Center' : COPY.regionLabel} />",
    ]) {
      expect(literalCopyIn(asModule(planted)), planted).not.toEqual([]);
    }
    // A copy-named property in a plain .js helper (GC3).
    expect(literalCopyIn("export const strip = { hold: { label: 'Deploy', secondary: false } };")).not.toEqual([]);
    // ...and leaves alone what is not copy.
    for (const fine of [
      '<span>{COPY.games.loading}</span>', "<span>{' '}</span>", '<div data-hub="shell" />', '<span>{a > b && c < d}</span>',
      '<>{ready && rows.length > limit && (\n<div><HubLink /></div>)}</>', '<stop id={`h${uid}`} />', '<circle fill={`url(#h${uid})`} />',
      '<Icon name="chevR" />', '<HubButton kind="secondary" icon="hammer" />', '<Tag tone="ink-2" />', '<div role="tablist" aria-orientation="vertical" />',
      "<div style={{ display: 'flex', border: `1px solid ${HAIR}` }} />", '<path d="M9 5l7 7-7 7" strokeLinecap="round" />',
    ]) {
      expect(literalCopyIn(asModule(fine)), fine).toEqual([]);
    }
    expect(literalCopyIn("export const ORDER = Object.freeze({ display: 'flex', status: 'loading' });")).toEqual([]);
  });

  it('every hub source file parses, so none is skipped by the scan', () => {
    for (const rel of hubSourceFiles()) expect(() => parseModule(read(rel)), rel).not.toThrow();
    for (const rel of COPY_TABLES) expect(() => parseModule(read(rel)), rel).not.toThrow();
  });
});

describe('the spec\'s own strings, exactly', () => {
  it('Partnership\'s reserved line (spec §8.3)', () => {
    expect(HUB_COPY.partnership.reserved).toBe("Partnership isn't part of this release. A preference will only ever stand once you confirm it.");
  });

  it('the hold helper lines (spec §5.5)', () => {
    expect(HUB_COPY.deploy.pointerHelp).toBe('Hold for 1.3 s. Release before the hold completes to cancel.');
    expect(HUB_COPY.deploy.keyboardHelp).toBe('Or press Enter or Space to deploy now.');
  });

  it('the initial lines (spec §3) and the activity heading (§8.2) and the career caption (§7)', () => {
    expect(HUB_COPY.games.loading).toBe('Checking your games');
    expect(HUB_COPY.deploy.states.checking).toBe('Checking eligibility…');
    expect(HUB_COPY.activity.label).toBe('Recent activity · your last 10 games and current loadout');
    expect(HUB_COPY.history.careerCaption).toBe('career · BaggerBomb vs CPU · as recorded');
  });

  it('the design\'s words where the spec keeps them: the areas, the tabs, Shadow\'s name line, the idle status', () => {
    expect(HUB_COPY.areas.names).toEqual(['Partnership', 'Shared Research', 'Equipped Archetype']);
    expect([HUB_COPY.phoneTabs.overview, HUB_COPY.phoneTabs.research, HUB_COPY.phoneTabs.partnership, HUB_COPY.phoneTabs.loadout])
      .toEqual(['Overview', 'Research', 'Partnership', 'Loadout']);
    expect(`${HUB_COPY.shadow.name} · ${HUB_COPY.shadow.role}`).toBe('Shadow · your research partner');
    expect(HUB_COPY.shadow.statusIdle).toBe('Idle · nothing running');
    expect(HUB_COPY.header.title).toBe('Command Center');
  });
});

describe('no claim the hub cannot back (spec §8.2, §11.3)', () => {
  const BANNED = [
    /\blearn/i, /\bimprov/i, /\bintelligen/i, /\bsmart(er)?\b/i, /\bearned\b/i, /\btier\b/i, /getting better/i,
    /\bevolv/i, /\bgrow(s|th|ing)?\b/i, /since your last visit/i, /\blevel(s|led)? up\b/i, /\bunlock/i,
    /\bsources?\s*·\s*\d/i, /\bremembers?\b/i, /\bTester\b/, /\bsimulat/i, /\bprototype\b/i, /\billustrative\b/i,
  ];

  it('no string in either copy table matches a banned claim', () => {
    const hits = ALL_COPY.flatMap((s) => BANNED.filter((re) => re.test(s)).map((re) => `${re.source}: ${s}`));
    expect(hits).toEqual([]);
  });

  it('the banned list catches what it names', () => {
    for (const s of ['Shadow learned your style', 'Shadow is improving', 'Since your last visit', 'Sources · 4', 'Tuesday, October 7 · Tester', 'Simulated sequence']) {
      expect(BANNED.some((re) => re.test(s)), s).toBe(true);
    }
  });

  it('a branch the sampled call never takes is still read: the scan reads every literal in the source (S1 review L5-3)', () => {
    const seen = sourceStrings("export const T = { names: (n) => (n === 1 ? ' Shadow learned' : 's'), live: (n) => (n === 1 ? '1 live game' : `${n} live games`) };");
    expect(seen).toEqual(expect.arrayContaining([' Shadow learned', '1 live game', ' live games']));
    expect(seen.some((s) => BANNED.some((re) => re.test(s)))).toBe(true);
    expect(seen.flatMap((s) => s.match(/\d+(\.\d+)?/g) || [])).toEqual(['1']);
  });

  it('no copy carries a count the hub does not hold: the only numbers written are the spec\'s 1.3 s and 10 games', () => {
    const numbers = ALL_COPY.flatMap((s) => s.replace(/ARG\d+/g, '').match(/\d+(\.\d+)?/g) || []);
    expect([...new Set(numbers)].sort()).toEqual(['1.3', '10']);
  });
});

describe('display agreement with the shipped hold (BUILD_RULES §9)', () => {
  it('the copy\'s 1.3 s is the shipped useHoldToDeploy HOLD_MS (1,300 ms)', () => {
    const hook = read('src/hooks/useHoldToDeploy.js');
    expect(hook).toMatch(/\nconst HOLD_MS = 1300;\n/);
    expect(HUB_COPY.deploy.pointerHelp).toContain(`${(1300 / 1000).toFixed(1)} s`);
  });
});
