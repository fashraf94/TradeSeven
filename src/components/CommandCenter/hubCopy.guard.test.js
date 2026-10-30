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
// Agent form build S1: the armored hero's own three (HubAgentForm.jsx), the engine's vocabulary — `mood` ('idle',
// 'researching'), `bloom` ('css') and `allegiance` ('player') — never shown to the player.
const TOKEN_ATTRIBUTES = new Set(['accent', 'icon', 'kind', 'name', 'tone', 'aria-live', 'aria-orientation', 'role', 'type', 'as', 'mood', 'bloom', 'allegiance']);
const TOKEN = /^[a-z][a-zA-Z0-9-]*$/;
/** Object properties whose string value is shown to the player, in any hub file. */
const COPY_PROPERTIES = new Set([
  'label', 'title', 'text', 'sub', 'subtitle', 'caption', 'heading', 'message', 'placeholder', 'alt', 'ariaLabel', 'aria-label',
  'description', 'summary', 'cta', 'why', 'detail', 'eyebrow', 'hint', 'help', 'empty', 'line', 'line1', 'line2',
  // S2a: the deploy selector's `reason` reaches the strip and the card verbatim (S2a review A5-9).
  'reason',
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

/**
 * Slice S6 (founder rulings R-S6-6 and Q-S6-1): the design note's point 5, in the founder's four wordings — the ONLY strings in the hub that
 * pair the agent with an idea, and the only ones that say "learn", which they DENY. The banned-claim row forbids claiming it; these
 * exact strings are exempt from it and from the pairing fence, and nothing else is.
 */
const HONEST_LINES = Object.freeze([
  "Your agent gives this list's names priority and reads the idea as the list's thesis. It doesn't learn from your ideas or their reviews yet.",
  "Your agent gives this list's names priority and reads the thesis the list was saved with, not later versions of your idea. It doesn't learn from your ideas or their reviews yet.",
  "Your agent gives this list's names priority. It doesn't read or learn from your ideas yet.",
  "Your agent gives this list's names priority and reads only the start of the thesis the list was saved with, not later versions of your idea. It doesn't learn from your ideas or their reviews yet.",
]);
/** The exemption, as one function: the banned-claim row and the pairing row both filter through it, so a loosened match shows in one place. */
const outsideHonest = (s) => !HONEST_LINES.includes(s);

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

  it('the pure selectors hold no words at all: every string literal under hub/selectors/ is a vocabulary token, never a phrase (S2a review A5-9)', () => {
    const selectors = hubSourceFiles().filter((rel) => rel.startsWith(`${DIR}/hub/selectors/`));
    expect(selectors.length, 'no selector found, so this row would be vacuous').toBeGreaterThan(3);
    const phrases = selectors.flatMap((rel) => sourceStrings(read(rel)).filter((s) => /\s/.test(s) && LETTER.test(s)).map((s) => `${rel}: ${clip(s)}`));
    expect(phrases).toEqual([]);
    // ...and the scan sees a returned phrase and a phrase on a non-copy key (PL-13, PL-15).
    expect(sourceStrings("export const f = () => 'Deployment failed';").filter((s) => /\s/.test(s))).toEqual(['Deployment failed']);
    expect(literalCopyIn("export const s = { reason: 'Deploy unavailable right now' };")).not.toEqual([]);
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

describe('S5: the design note\'s labels, exactly, and nothing the hub cannot back about ideas (ruling R-S5-2)', () => {
  it('"Universe · N names" and "Plain watchlist · no idea yet", and the neutral "N names"', () => {
    expect(HUB_COPY.loadout.universe(10)).toBe('Universe · 10 names');
    expect(HUB_COPY.loadout.universe(1)).toBe('Universe · 1 name');
    expect(HUB_COPY.loadout.plainList).toBe('Plain watchlist · no idea yet');
    expect(HUB_COPY.loadout.names(3)).toBe('3 names');
    expect(HUB_COPY.loadout.names(1)).toBe('1 name');
  });

  it('the committed design note says the same two labels (display agreement with its source)', () => {
    const note = read('docs/design/20261016_DESIGN_NOTE_IDEA_FIRST_FORGE.md');
    expect(note).toContain('"Universe · 10 names"');
    expect(note).toContain('"Plain watchlist · no idea yet"');
  });

  it('the Forge doors are named for the areas they open', () => {
    expect([HUB_COPY.loadout.forgeLists, HUB_COPY.loadout.forgeCharacter, HUB_COPY.loadout.forgeTraits]).toEqual(['Forge Lists', 'Forge Character', 'Forge Traits']);
  });

  // The hub rows compare what is on screen with COPY.* — the same string on both sides — so these two words, which the
  // rulings quote, are pinned here (lens E5, E5-6).
  it('the words the rulings quote: "Locked in battle · …" while the loadout is locked (R-S5-1) and the header\'s "Report a bug" (R-S5-7) (E5-6)', () => {
    expect(HUB_COPY.loadout.nextDeployLocked).toMatch(/^Locked in battle · /);
    expect(HUB_COPY.loadout.nextDeployLocked).toBe('Locked in battle · changes apply to your next deploy.');
    expect(HUB_COPY.loadout.nextDeploy).toBe('Changes apply to your next deploy.');
    expect(HUB_COPY.header.reportBug).toBe('Report a bug');
  });

  // Founder ruling Q-S5-4a: the client cannot know whether the server admits this player to idea records. S5 passed "unknown"
  // and every card read the neutral "N names". Slice S6 (ruling R-S6-4) supplies the answer from its gated reader: the word
  // `admitted` is produced in exactly two places — the selector that defines and compares it, and the module that maps the
  // reader's held answer to it (hub/researchView.js researchAccessOf). No other hub source hands the card an admitted player.
  it('the admission comes from the idea reader: IDEA_ACCESS.ADMITTED and the word admitted are written only in the selector that defines them and the reader mapping (Q-S5-4a; R-S6-4)', () => {
    const code = (rel) => read(rel).replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '');
    const users = hubSourceFiles().filter((rel) => /\bIDEA_ACCESS\.ADMITTED\b|['"`]admitted['"`]/.test(code(rel)));
    expect(users).toEqual([`${DIR}/hub/researchView.js`, `${DIR}/hub/selectors/loadout.js`]);
    // what App hands the hub carries no ideaAccess key at all
    expect(code('src/App.jsx')).not.toMatch(/ideaAccess/);
  });

  it('one hub file reads an idea record, and it is the gated reader (S5 fenced every file; slice S6 admits exactly this one)', () => {
    const reach = hubSourceFiles().filter((rel) => /hypothesisVersionService|hypothesisRecords\/|getHypothesis|listHypothes|hypothesisVersions/.test(read(rel).replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '')));
    expect(reach).toEqual([`${DIR}/hub/useHubResearch.js`]);
    // ...and it takes the reader and no writer of the idea service.
    const reader = read(`${DIR}/hub/useHubResearch.js`).replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '');
    expect(reader).toContain("import { listHypothesisVersions } from '../../../services/hypothesisVersionService';");
    for (const writer of ['createHypothesisVersion', 'transitionHypothesis', 'reaffirmHypothesis', 'newOpId']) {
      expect(hubSourceFiles().filter((rel) => read(rel).includes(writer)), writer).toEqual([]);
    }
  });

  // The design note's point 5 asks every idea surface for one honest line about the agent ("the agent does not read or
  // act on ideas yet"). That is a claim about the agent's behaviour, which the hub can neither back nor check, so S5's two
  // labels ship without it and this fence keeps any such sentence out until the idea reader (slice S6) can carry it. The
  // report puts the question to the founder (Q-S5-4).
  const PAIRS = /\b(agent|shadow)\b.*\bidea|\bidea.*\b(agent|shadow)\b/i;
  it('no hub string names the agent and an idea together but the founder\'s four honest lines, which are exactly those four (rulings R-S6-6, Q-S6-1)', () => {
    const words = ALL_COPY.filter((s) => /\bidea/i.test(s));
    expect(words.sort()).toEqual(expect.arrayContaining(['Plain watchlist · no idea yet']));
    const pairing = [...new Set(words.filter((s) => PAIRS.test(s)))].sort();
    // The pairing fence filters through the same exact-string exemption: a string is allowed to pair only by being one of the four.
    expect(words.filter((s) => PAIRS.test(s) && outsideHonest(s))).toEqual([]);
    expect(pairing).toEqual([...HONEST_LINES].sort());
    expect(Object.values(HUB_COPY.research.honest).sort()).toEqual([...HONEST_LINES].sort());
  });

  it('the fence still bites: a claim that the agent learns from, or uses, an idea is not one of the four', () => {
    for (const claim of ['Your agent learns from your ideas.', 'Shadow reads your idea before every game.', 'Your idea improves your agent.', "Your agent reads the idea as the list's thesis. It learns from your ideas.", 'Your agent reads only the start of your idea. It learns from your ideas.']) {
      expect(HONEST_LINES, claim).not.toContain(claim);
      expect(PAIRS.test(claim) || /\blearn/i.test(claim), claim).toBe(true);
    }
  });
});

describe('S6: the research words, exactly (the spec\'s §8.1 table and the hub\'s own)', () => {
  it('the table\'s strings are the spec\'s, and the other words the panel and the stage use are pinned so a row that compares a word with itself cannot hide a change', () => {
    const R = HUB_COPY.research;
    expect([R.gateOff, R.disabled, R.noList, R.noIdea('L'), R.error]).toEqual([
      "Research records aren't part of this release", "Research records aren't available on this account",
      'Equip a watchlist in the Forge to see its idea here', 'No idea yet on L', "Couldn't load your idea",
    ]);
    expect([R.oneIdea('L'), R.retry, R.openForge, R.reviewInForge, R.ideas, R.loading, R.summaryLoading, R.thisList, R.version(3), R.savedOn('D'), R.statusSince('D')]).toEqual([
      '1 idea on L', 'Retry', 'Open in the Forge', 'Review in the Forge', 'Ideas', 'Checking your research', 'Checking your research', 'your equipped list', 'Version 3', 'Saved D', 'Status since D',
    ]);
    expect(R.pointerUnavailable('L')).toBe("The saved idea for L isn't available");
    expect(R.retryAt('T')).toBe('You can try again at T');
    expect(R.asOf('T')).toBe('As of T · couldn’t refresh');
    expect(R.summary).toEqual({
      gateOff: 'Not in this release', disabled: 'Not on this account', noList: 'No list equipped', noIdea: 'No idea yet', pointerUnavailable: 'Unavailable', error: 'Couldn’t load',
    });
    expect(HUB_COPY.deploy.deployingWith('S', '3 names')).toBe('Deploying with: S · 3 names');
    expect([HUB_COPY.activity.ideaSaved, HUB_COPY.activity.ideaState('Ready')]).toEqual(['Idea saved', 'Idea · Ready']);
  });
});

describe('no claim the hub cannot back (spec §8.2, §11.3)', () => {
  const BANNED = [
    /\blearn/i, /\bimprov/i, /\bintelligen/i, /\bsmart(er)?\b/i, /\bearned\b/i, /\btier\b/i, /getting better/i,
    /\bevolv/i, /\bgrow(s|th|ing)?\b/i, /since your last visit/i, /\blevel(s|led)? up\b/i, /\bunlock/i,
    /\bsources?\s*·\s*\d/i, /\bremembers?\b/i, /\bTester\b/, /\bsimulat/i, /\bprototype\b/i, /\billustrative\b/i,
  ];

  it('no string in either copy table matches a banned claim', () => {
    // Slice S6: the founder's four honest lines deny learning; exactly those strings are exempt (HONEST_LINES; Q-S6-6).
    const hits = ALL_COPY.filter(outsideHonest).flatMap((s) => BANNED.filter((re) => re.test(s)).map((re) => `${re.source}: ${s}`));
    expect(hits).toEqual([]);
  });

  it('the exemption matches whole strings only: an honest line with anything added or cut is outside it, and is a banned claim', () => {
    for (const line of HONEST_LINES) {
      expect(outsideHonest(line), line).toBe(false);
      for (const planted of [`${line} Shadow learns your style.`, `Shadow learns your style. ${line}`, line.slice(0, 40), line.slice(0, -1), `${line} `, line.toUpperCase()]) {
        expect(outsideHonest(planted), planted).toBe(true);
      }
    }
    expect(BANNED.some((re) => re.test(`${HONEST_LINES[2]} Shadow learns your style.`))).toBe(true);
  });

  it('the exemption is the four exact strings: each denies learning, and a one-word change to any of them is a banned claim again', () => {
    for (const line of HONEST_LINES) {
      expect(ALL_COPY, line).toContain(line);
      expect(line, line).toMatch(/\b(doesn't|does not)\b[^.]*\blearn\b/);
      const claim = line.replace("doesn't", 'does');
      expect(HONEST_LINES).not.toContain(claim);
      expect(BANNED.some((re) => re.test(claim)), claim).toBe(true);
    }
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

  it('no copy carries a count the hub does not hold: the only numbers written are the spec\'s 1.3 s, 10 games and "1 idea on {list}" (§8.1)', () => {
    const numbers = ALL_COPY.flatMap((s) => s.replace(/ARG\d+/g, '').match(/\d+(\.\d+)?/g) || []);
    expect([...new Set(numbers)].sort()).toEqual(['1', '1.3', '10']);
    expect(HUB_COPY.research.oneIdea('ARG0')).toBe('1 idea on ARG0');
  });
});

describe('display agreement with the shipped hold (BUILD_RULES §9)', () => {
  it('the copy\'s 1.3 s is the shipped useHoldToDeploy HOLD_MS (1,300 ms)', () => {
    const hook = read('src/hooks/useHoldToDeploy.js');
    expect(hook).toMatch(/\nconst HOLD_MS = 1300;\n/);
    expect(HUB_COPY.deploy.pointerHelp).toContain(`${(1300 / 1000).toFixed(1)} s`);
  });
});

// The founder's rulings on the S2b report's questions (S2b report §15). The hub rows compare what is on screen with
// COPY.* — the same string on both sides — so the words the rulings quote are pinned here.
describe('S2b: the words the founder\'s rulings quote, exactly (Q-S2b-2, Q-S2b-4, RL-1)', () => {
  it('every definitive refusal reads "Deployment refused" (before: "Deployment failed"), the review-due strip word included', () => {
    expect(HUB_COPY.deploy.states.failed).toBe('Deployment refused');
    expect(HUB_COPY.deploy.reviewDueStrip).toBe('Deployment refused');
    expect(ALL_COPY).not.toContain('Deployment failed');
  });

  it('the closed ceremony\'s acknowledgment is "Dismiss"', () => {
    expect(HUB_COPY.deploy.dismiss).toBe('Dismiss');
  });

  it('the ceremony says the same words: its refusal eyebrow, its generic refusal headline, its live region, and the in-progress subtext', () => {
    const src = read('src/components/Dashboard/deployCeremony/CeremonyError.jsx');
    expect(src).toContain(`const REFUSED_EYEBROW = '${HUB_COPY.deploy.states.failed}';`);
    expect(src).toContain("const IN_PROGRESS_SUBTEXT = 'Another deploy for your agent is still being set up. If it creates a battle, it will show up with your games.';");
    // RL-1: the generic confirmed headline and the live region say the eyebrow's word (before: "Deployment failed").
    expect(src).toContain(`deploy: () => '${HUB_COPY.deploy.states.failed} — no battle was created.',`);
    expect(src).toContain(`server: () => '${HUB_COPY.deploy.states.failed} — no battle was created.',`);
    const ceremony = read('src/components/Dashboard/deployCeremony/DeployCeremony.jsx');
    expect(ceremony).toContain(`machine.errorTone === 'confirmed' ? '${HUB_COPY.deploy.states.failed}.'`);
    // No string either file renders begins with the old word (the RL-1 review's blind spot: the live region).
    for (const [file, code] of [['CeremonyError.jsx', src], ['DeployCeremony.jsx', ceremony]]) {
      expect(code, file).not.toMatch(/['"`]Deployment failed/);
    }
  });
});

// ── Slice S7: the status line's words (ruling R-S7-7) ──────────────────────────────────────────────────────────────
describe('S7: the status line\'s words, exactly (ruling R-S7-7)', () => {
  it('the words the ruling quotes', () => {
    expect(HUB_COPY.shadow.statusHolding).toBe('Holding to deploy');
    expect(HUB_COPY.shadow.statusLocked).toBe('Locked in');
    expect(HUB_COPY.shadow.statusSubmitting).toBe('Submitting your deployment');
    expect(HUB_COPY.shadow.statusLiveOne).toBe('Live game in progress');
    expect(HUB_COPY.shadow.statusLiveMany(3)).toBe('3 live games in progress');
    expect(HUB_COPY.shadow.statusIdleUnknown).toBe('Idle');
    expect(HUB_COPY.shadow.statusIdle).toBe('Idle · nothing running');
  });

  it('an attempt\'s words are the Deploy card\'s own, said once: the shadow block repeats none of them', () => {
    const card = ['verifying', 'finishing', 'confirmed', 'existing', 'failed', 'uncertain'].map((k) => HUB_COPY.deploy.states[k]);
    card.push(HUB_COPY.deploy.confirmedRecovered);
    expect(card).toEqual(['Verifying deployment…', 'Finishing deployment', 'Deployed', 'Already running', 'Deployment refused', 'Couldn’t confirm the deploy', 'Battle confirmed']);
    for (const s of strings(HUB_COPY.shadow)) expect(card, s).not.toContain(s);
  });

  it('"Locked in" is one word on the line and on the control: the line takes the shipped control’s (review C-6)', () => {
    expect(HUB_COPY.shadow.statusLocked).toBe(HUB_COPY.deploy.holdLocked);
  });

  it('the line carries no percentage, and the image label names the state (ambient, still, processing) and the area', () => {
    expect(HUB_COPY.shadow.states).toEqual({ ambient: 'ambient', still: 'still', processing: 'processing' });
    expect(HUB_COPY.shadow.imageLabel('processing', 'Partnership')).toBe('Shadow — processing; Partnership selected');
    for (const w of [HUB_COPY.shadow.statusLiveOne, HUB_COPY.shadow.statusLiveMany(2), HUB_COPY.shadow.statusIdleUnknown]) expect(w).not.toMatch(/%/);
  });
});
