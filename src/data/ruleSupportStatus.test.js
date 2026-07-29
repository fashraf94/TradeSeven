// src/data/ruleSupportStatus.test.js
//
// C-20 honesty gate — the support-status map and the offer-surface filters.
//
// Per BUILD_RULES process rule A6 (Guide): every acceptance-matrix row cites a
// test that FAILS under the defect it guards. Each describe block below names
// the defect it exists to catch.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { FORGE_RULE_TEMPLATES } from './forgeKnowledgeBase.js';
import { FORGE_COLLECTIONS, OFFERED_COLLECTIONS, RETIRED_COLLECTIONS } from './forgeCollections.js';
import {
  RULE_SUPPORT_STATUS,
  SUPPORT_STATUS_VALUES,
  NOT_OFFERED_STATUSES,
  getSupportStatus,
  isSupported,
  filterSupported,
} from './ruleSupportStatus.js';

// The dependency-surface guard (BUILD_RULES §4): this test file's import of
// ruleSupportStatus.js IS the runtime guard that the module stays Node-clean.
// It explodes here if a browser-only dependency ever enters its graph.
// NEVER mock this import.

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('completeness — every template resolves to a legal status', () => {
  // DEFECT GUARDED: a template added to the corpus without a status decision,
  // or a status typo, silently defaulting a rule into visibility.
  it('covers all 143 templates with a legal status value', () => {
    expect(FORGE_RULE_TEMPLATES).toHaveLength(143);
    for (const t of FORGE_RULE_TEMPLATES) {
      expect(
        SUPPORT_STATUS_VALUES,
        `template ${t.id} resolved to an illegal status "${getSupportStatus(t.id)}"`
      ).toContain(getSupportStatus(t.id));
    }
  });

  it('every explicit map key is a real template id (no orphans)', () => {
    const ids = new Set(FORGE_RULE_TEMPLATES.map((t) => t.id));
    for (const id of Object.keys(RULE_SUPPORT_STATUS)) {
      expect(ids.has(id), `status map references unknown rule id "${id}"`).toBe(true);
    }
  });

  it('every explicit map value is a legal, non-supported status', () => {
    for (const [id, status] of Object.entries(RULE_SUPPORT_STATUS)) {
      expect(SUPPORT_STATUS_VALUES, `${id}`).toContain(status);
      expect(NOT_OFFERED_STATUSES, `${id} is in the map but marked offerable`).toContain(status);
    }
  });

  it('holds the ruled tally: 95 supported / 20 absent / 1 unwired / 26 scrapped / 1 deprecated (Fundamental Wire D1/D5)', () => {
    const tally = {};
    for (const t of FORGE_RULE_TEMPLATES) {
      const s = getSupportStatus(t.id);
      tally[s] = (tally[s] || 0) + 1;
    }
    expect(tally).toEqual({
      supported: 95,
      hidden_absent_substrate: 20,
      hidden_unwired: 1,
      mode_scrapped: 26,
      deprecated: 1,
    });
  });

  it('every modes:"season" template is mode_scrapped (C-19)', () => {
    const season = FORGE_RULE_TEMPLATES.filter((t) => t.modes === 'season');
    expect(season).toHaveLength(26);
    for (const t of season) {
      expect(getSupportStatus(t.id), `season template ${t.id}`).toBe('mode_scrapped');
    }
  });

  it('no non-season template is marked mode_scrapped', () => {
    for (const t of FORGE_RULE_TEMPLATES) {
      if (getSupportStatus(t.id) === 'mode_scrapped') {
        expect(t.modes, `${t.id} marked mode_scrapped but modes="${t.modes}"`).toBe('season');
      }
    }
  });
});

describe('the specific Phase-0 + Fundamental Wire rulings are encoded', () => {
  // DEFECT GUARDED: a future edit quietly reverting a founder ruling.
  it('the Fundamental Wire un-hides EXACTLY the six servable rules + r-07 (D1/D5, Jul 25 2026)', () => {
    for (const id of [
      'fund-value-pe', 'f-07', 'fund-revenue-growth',
      'fund-bank-pb', 'fund-market-cap', 'f-12', 'r-07',
    ]) {
      expect(getSupportStatus(id), id).toBe('supported');
    }
  });

  it('the six UNSERVABLE fundamental rules re-triaged to hidden_absent_substrate (D1 — missing producer work)', () => {
    for (const id of [
      'fund-earnings-surprise', 'fund-financial-health', 'f-08', 'f-09', 'f-10', 'f-11',
    ]) {
      expect(getSupportStatus(id), id).toBe('hidden_absent_substrate');
    }
  });

  it('i-04 is the sole remaining hidden_unwired (derivable, not derived)', () => {
    expect(getSupportStatus('i-04')).toBe('hidden_unwired');
    const unwired = Object.entries(RULE_SUPPORT_STATUS)
      .filter(([, s]) => s === 'hidden_unwired')
      .map(([id]) => id);
    expect(unwired).toEqual(['i-04']);
  });

  it('the re-predicable rules are hidden_absent_substrate pending the copy pass', () => {
    for (const id of ['r-10', 'gs-04', 'gs-05', 'gs-06']) {
      expect(getSupportStatus(id), id).toBe('hidden_absent_substrate');
    }
  });

  it('mb-14 is hidden — every one of its indicator options is a 5-min signal', () => {
    expect(getSupportStatus('mb-14')).toBe('hidden_absent_substrate');
    const tpl = FORGE_RULE_TEMPLATES.find((t) => t.id === 'mb-14');
    const opts = tpl.forgeTemplates[0].params.indicator.options.map((o) => o.value);
    expect(opts).toHaveLength(3);
    for (const o of opts) expect(o).toMatch(/5-min/);
  });

  it('i-08 and tv-10 stay supported (13F leg real; composites verified)', () => {
    expect(getSupportStatus('i-08')).toBe('supported');
    expect(getSupportStatus('tv-10')).toBe('supported');
  });

  it('risk-single-stock-limit is deprecated', () => {
    expect(getSupportStatus('risk-single-stock-limit')).toBe('deprecated');
  });
});

describe('helpers', () => {
  it('isSupported is true only for supported', () => {
    expect(isSupported('tech-rsi-oversold')).toBe(true);
    expect(isSupported('t-09')).toBe(false);
    expect(isSupported('se-01')).toBe(false);
  });

  it('unknown ids default to supported (user-authored / agent-learned rules)', () => {
    expect(getSupportStatus('user-rule-abc123')).toBe('supported');
    expect(isSupported('user-rule-abc123')).toBe(true);
  });

  it('filterSupported accepts objects and bare ids, preserving order', () => {
    expect(filterSupported([{ id: 'tech-rsi-oversold' }, { id: 't-09' }])).toEqual([
      { id: 'tech-rsi-oversold' },
    ]);
    expect(filterSupported(['tech-rsi-oversold', 't-09', 'se-01'])).toEqual(['tech-rsi-oversold']);
    expect(filterSupported(null)).toEqual([]);
  });
});

describe('offer surfaces are filtered (C-20)', () => {
  // DEFECT GUARDED: the exact leak the Phase 0 brief warned about — a rule
  // hidden in the shop but still reachable via search, or actively recommended.
  const read = (rel) => readFileSync(path.join(REPO_ROOT, rel), 'utf8');

  it('RuleDirectory derives browse AND search from a filtered list', () => {
    const src = read('src/components/Forge/RuleDirectory.jsx');
    expect(src).toContain("from '../../data/ruleSupportStatus'");
    expect(src).toMatch(/offerableTemplates\s*=\s*useMemo\(\s*\(\)\s*=>\s*filterSupported\(FORGE_RULE_TEMPLATES\)/);
    // rulesByCategory — which search filters — must read the filtered list.
    expect(src).toMatch(/rulesByCategory[\s\S]{0,200}offerableTemplates\.forEach/);
    // the visible count must agree with the browsable list (§9).
    expect(src).toContain('const libraryCount = offerableTemplates.length;');
    expect(src).not.toContain('const libraryCount = FORGE_RULE_TEMPLATES.length;');
  });

  it('StarterKit.getAlternatives cannot offer a hidden rule', () => {
    const src = read('src/components/Forge/StarterKit.jsx');
    expect(src).toContain("from '../../data/ruleSupportStatus'");
    expect(src).toMatch(/function getAlternatives[\s\S]{0,900}isSupported\(t\.id\)/);
  });

  it('compatSurfaceCopy.nativeAlternatives cannot recommend a hidden rule', () => {
    const src = read('src/utils/compatSurfaceCopy.js');
    expect(src).toContain("from '../data/ruleSupportStatus.js'");
    expect(src).toMatch(/export function nativeAlternatives[\s\S]{0,900}isSupported\(t\.id\)/);
  });
});

describe('legacy resolvability — an equipped rule never strands', () => {
  // DEFECT GUARDED: over-filtering. If a lookup-by-id path were filtered, a
  // user with an equipped hidden rule would see their build silently break.
  const read = (rel) => readFileSync(path.join(REPO_ROOT, rel), 'utf8');

  it('every hidden rule still resolves by id from the corpus', () => {
    const ids = new Set(FORGE_RULE_TEMPLATES.map((t) => t.id));
    for (const id of Object.keys(RULE_SUPPORT_STATUS)) {
      expect(ids.has(id), `${id} must remain resolvable`).toBe(true);
      const tpl = FORGE_RULE_TEMPLATES.find((t) => t.id === id);
      expect(tpl, `${id} template object`).toBeTruthy();
      expect(tpl.headline, `${id} must keep display copy for existing equips`).toBeTruthy();
    }
  });

  it('lookup-by-id call sites are NOT filtered', () => {
    // These resolve an ALREADY-equipped or already-selected rule. Filtering any
    // of them would strand a live build.
    const sites = [
      ['src/components/Forge/ForgeScreen.jsx', /FORGE_RULE_TEMPLATES\.find\(t => t\.id === templateId\)/],
      ['src/components/Forge/BundlePresetModal.jsx', /FORGE_RULE_TEMPLATES\.find\(t => t\.id === ruleId\)/],
      ['src/components/Forge/StarterKit.jsx', /function getTemplate\(templateId\)[\s\S]{0,120}FORGE_RULE_TEMPLATES\.find\(t => t\.id === templateId\)/],
      ['src/data/traitEquip.js', /new Map\(FORGE_RULE_TEMPLATES\.map\(\(t\) => \[t\.id, t\]\)\)/],
    ];
    for (const [rel, re] of sites) {
      expect(read(rel), `${rel} lookup-by-id must stay unfiltered`).toMatch(re);
    }
  });

  it('the activation-gate denominator is untouched by display filtering', () => {
    // activationGate.js computes the equippable denominator from t.modes only.
    // Display filtering must not silently change gate math (Phase 0 §2).
    const src = read('api/_utils/activationGate.js');
    expect(src).toContain('templates.filter((t) => launchAdmissible.has(t.modes))');
    expect(src).not.toContain('ruleSupportStatus');
  });
});

describe('preset integrity — new users must not start stranded', () => {
  // DEFECT GUARDED: a cold-start preset handing a brand-new user a rule the
  // C-20 gate says must not be offered.
  const notOffered = (id) => NOT_OFFERED_STATUSES.includes(getSupportStatus(id));

  it('no OFFERED collection ships a non-offerable rule', () => {
    const offenders = [];
    for (const c of OFFERED_COLLECTIONS) {
      const ids = c.isStyleCollection
        ? (c.rules || []).map((r) => r.ruleId)
        : (c.ruleIds || []);
      for (const id of ids) {
        if (notOffered(id)) offenders.push(`${c.id} → ${id} (${getSupportStatus(id)})`);
      }
    }
    expect(offenders, `offered collections shipping hidden rules:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('retired collections are excluded from the offered set but keep their record', () => {
    const retiredIds = RETIRED_COLLECTIONS.map((c) => c.id).sort();
    expect(retiredIds).toEqual(['day-trader', 'value-investor', 'vwap-warrior']);
    // Excluded from display...
    const offeredIds = new Set(OFFERED_COLLECTIONS.map((c) => c.id));
    for (const id of retiredIds) expect(offeredIds.has(id)).toBe(false);
    // ...but retained in full, with a record, so existing equips resolve and
    // the reason travels with the data.
    for (const c of RETIRED_COLLECTIONS) {
      expect(c.retiredReason, `${c.id} must state why`).toBeTruthy();
      expect(c.returnsWith, `${c.id} must state what un-retires it`).toBeTruthy();
      const ids = c.isStyleCollection ? (c.rules || []).map((r) => r.ruleId) : (c.ruleIds || []);
      expect(ids.length, `${c.id} must keep its rule list`).toBeGreaterThan(0);
    }
    expect(OFFERED_COLLECTIONS.length + RETIRED_COLLECTIONS.length).toBe(FORGE_COLLECTIONS.length);
  });

  it('"Found In" chips never point at a retired collection', () => {
    const src = readFileSync(path.join(REPO_ROOT, 'src/data/ruleRelationships.js'), 'utf8');
    expect(src).toContain('OFFERED_COLLECTIONS.forEach');
    expect(src).not.toMatch(/^import \{ FORGE_COLLECTIONS \}/m);
  });

  it('the StarterKit cold-start preset ships no non-offerable rule', () => {
    const src = readFileSync(path.join(REPO_ROOT, 'src/components/Forge/StarterKit.jsx'), 'utf8');
    const head = src.slice(0, src.indexOf('// ── Helpers'));
    const ids = [...head.matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1]);
    const known = new Set(FORGE_RULE_TEMPLATES.map((t) => t.id));
    const offenders = ids.filter((id) => known.has(id) && notOffered(id));
    expect(offenders, `StarterKit ships hidden rules: ${offenders.join(', ')}`).toEqual([]);
  });
});

describe('offer-gate completion — the three hook-fed surfaces (C-20)', () => {
  // DEFECT GUARDED: the Discover-tab leak. Before this arc, useForge's two
  // display projections (filteredTemplates, templatesByCategory) enumerated the
  // RAW corpus, so all 48 non-offerable rules were browsable AND addable from
  // three surfaces that draw from the hook: DiscoverTab FullLibraryView,
  // ForgeScreen's Advanced-Firmware CategoryAccordion, and BundleBuildFlow's
  // Browse stage. The fix filters ONCE, centrally, in useForge.
  const read = (rel) => readFileSync(path.join(REPO_ROOT, rel), 'utf8');

  it('useForge filters the corpus ONCE (offerableTemplates) and both projections derive from it', () => {
    const src = read('src/hooks/useForge.js');
    expect(src).toContain("from '../data/ruleSupportStatus'");
    // the single filtered base
    expect(src).toMatch(/offerableTemplates\s*=\s*useMemo\(\s*\(\)\s*=>\s*filterSupported\(FORGE_RULE_TEMPLATES\)/);
    // filteredTemplates derives from offerableTemplates, NOT the raw corpus
    expect(src).toMatch(/filteredTemplates\s*=\s*useMemo\([\s\S]{0,220}offerableTemplates/);
    expect(src).not.toMatch(/filteredTemplates\s*=\s*useMemo\([\s\S]{0,160}FORGE_RULE_TEMPLATES\.filter/);
    // templatesByCategory derives from offerableTemplates too
    expect(src).toMatch(/templatesByCategory\s*=\s*useMemo\([\s\S]{0,260}offerableTemplates\.forEach/);
    expect(src).not.toMatch(/templatesByCategory\s*=\s*useMemo\([\s\S]{0,260}FORGE_RULE_TEMPLATES\.forEach/);
    // and the filtered base is exposed for count labels
    expect(src).toMatch(/return\s*\{[\s\S]*\bofferableTemplates\b[\s\S]*\}/);
  });

  it('DiscoverTab browses the filtered feed and its count agrees with it (§9)', () => {
    const src = read('src/components/Forge/DiscoverTab.jsx');
    // FullLibraryView renders forge.filteredTemplates (now filtered centrally)
    expect(src).toMatch(/const\s*\{\s*filteredTemplates[\s\S]{0,200}\}\s*=\s*forge/);
    expect(src).toMatch(/filteredTemplates\.map\(/);
    // the "Browse All N Rules" count is bound to the SAME offerable source, not
    // the raw corpus length — the exact count-agreement leak this arc closes.
    expect(src).toMatch(/Browse All \{forge\.offerableTemplates\.length\} Rules/);
    expect(src).not.toContain('Browse All {FORGE_RULE_TEMPLATES.length} Rules');
  });

  it('ForgeScreen accordion + BundleBuildFlow Browse both draw from forge.templatesByCategory', () => {
    for (const rel of [
      'src/components/Forge/ForgeScreen.jsx',
      'src/components/Forge/workshop/BundleBuildFlow.jsx',
    ]) {
      const src = read(rel);
      expect(src, `${rel} must consume the filtered hook projection`).toMatch(/forge\.templatesByCategory\[/);
    }
  });

  it('the filtered feed the hook builds contains EVERY offerable rule and NO hidden rule (behavioral)', () => {
    const feed = filterSupported(FORGE_RULE_TEMPLATES);
    const supported = FORGE_RULE_TEMPLATES.filter((t) => isSupported(t.id));
    // exact content: only supported, all supported, order preserved
    expect(feed).toEqual(supported);
    expect(feed.every((t) => isSupported(t.id))).toBe(true);
    expect(feed.some((t) => NOT_OFFERED_STATUSES.includes(getSupportStatus(t.id)))).toBe(false);
    // and grouping the feed by category (as templatesByCategory does) never
    // reintroduces a hidden rule.
    const grouped = feed.flatMap((t) => t);
    expect(grouped.some((t) => !isSupported(t.id))).toBe(false);
  });

  it('legacy non-strand: an equipped hidden rule stays removable via the bundle rule list, not the filtered browse', () => {
    // Filtering templatesByCategory correctly drops a hidden rule from the
    // Browse accordion, but the bundle's OWN rule list (Assemble stage / My
    // Bundles) resolves and removes from forge.rules — unfiltered — so an
    // already-equipped hidden rule is never stranded or made unremovable.
    const src = read('src/components/Forge/workshop/BundleBuildFlow.jsx');
    // bundleRules + the template→doc map are built from forge.rules, not the feed
    expect(src).toMatch(/bundleRules\s*=\s*useMemo\([\s\S]{0,200}forge\.rules\.find/);
    expect(src).toMatch(/ruleDocByTemplate[\s\S]{0,200}forge\.rules\.forEach/);
    // the Assemble-stage remove path resolves through that unfiltered doc map
    expect(src).toMatch(/handleRemoveRule\s*=\s*async[\s\S]{0,200}ruleDocByTemplate\.get/);
  });
});

describe('C-20 corpus-read TRIPWIRE — no new unfiltered browse/offer surface may read the raw corpus', () => {
  // DEFECT GUARDED: the NEXT offer surface. A brand-new pickable list or
  // browsable count built directly from FORGE_RULE_TEMPLATES (bypassing
  // filterSupported / isSupported / the filtered hook) re-opens the exact leak
  // this arc closed. STRATEGY: a per-occurrence SHAPE classifier over the
  // frontend offer layer (src/, minus *.test.*). Only three shapes are
  // generic-safe — a single lookup-by-id (.find), the honesty gate itself
  // (filterSupported(FORGE_RULE_TEMPLATES)), and an inline honesty-gated
  // .filter(... isSupported ...). Every BULK reduction (the id→object/id→category
  // maps + the radar denominator) is PINNED to its specific file, because an
  // id-map over the raw corpus is the whole corpus re-keyed — a new file could
  // launder a browse list through `[...map.values()].map(<Card/>)`. Pinning
  // means a new bulk read lands OUTSIDE the allowlist and fails HERE at birth,
  // forcing a conscious classification. (Scope is src/; api/ registry-hash and
  // the activation-gate denominator are guarded separately at :226-232.)
  //
  // RESIDUAL (documented, source-scan limits): a value laundered THROUGH an
  // already-pinned file (e.g. adding `[...TEMPLATE_MAP.values()].map(<Card/>)`
  // inside DiscoverTab), or a contrived OR-predicate `t.cat===c || isSupported`,
  // cannot be caught by a text scan and is left to code review.
  const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  // BULK reductions permitted ONLY in these exact files (id-maps + denominators):
  const MAP_PAIR = /^FORGE_RULE_TEMPLATES\s*\.\s*map\(\s*(\(?\s*\w+\s*\)?|\(\s*\{[^}]*\}\s*\))\s*=>\s*\[/;
  const PINNED = {
    'src/hooks/useForge.js': /^FORGE_RULE_TEMPLATES\s*\.\s*forEach\(/,          // categoryTotals radar denominator
    'src/components/Forge/TraitCard.jsx': /^FORGE_RULE_TEMPLATES\s*\.\s*forEach\(/, // id→object ruleMap
    'src/hooks/useTraits.js': MAP_PAIR,                                          // id→object TEMPLATE_MAP
    'src/data/traitEquip.js': MAP_PAIR,                                          // id→object TEMPLATE_MAP
    'src/utils/traitEnforcement.js': MAP_PAIR,                                   // id→category map
    'src/components/Forge/DiscoverTab.jsx': MAP_PAIR,                            // id→object TEMPLATE_MAP
  };
  // Generic-safe shapes: a single lookup-by-id, and an inline honesty-gated filter.
  const SAFE_TAIL = [
    /^FORGE_RULE_TEMPLATES\s*\.\s*find\(/,
    /^FORGE_RULE_TEMPLATES\s*\.\s*filter\([\s\S]{0,240}?isSupported\(/,
  ];
  const FILTER_SUPPORTED_HEAD = /filterSupported\(\s*$/;

  const walk = (dir, out = []) => {
    for (const e of readdirSync(path.join(REPO_ROOT, dir), { withFileTypes: true })) {
      const rel = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules') continue;
        walk(rel, out);
      } else if (/\.jsx?$/.test(e.name) && !/\.test\.jsx?$/.test(e.name)) {
        out.push(rel);
      }
    }
    return out;
  };

  it('no src/ file derives a rule COUNT from the raw corpus length (count labels bind to the filtered list)', () => {
    const offenders = [];
    for (const rel of walk('src')) {
      const code = stripComments(readFileSync(path.join(REPO_ROOT, rel), 'utf8'));
      if (/FORGE_RULE_TEMPLATES\s*\.\s*length\b/.test(code)) offenders.push(rel);
    }
    expect(
      offenders,
      `raw-corpus count label(s) found — derive the count from the filtered/offerable list instead:\n${offenders.join('\n')}`
    ).toEqual([]);
  });

  it('every raw FORGE_RULE_TEMPLATES read in src/ is a lookup / honesty-gated / pinned-reduction shape — never a new bulk list', () => {
    const offenders = [];
    for (const rel of walk('src')) {
      const code = stripComments(readFileSync(path.join(REPO_ROOT, rel), 'utf8'));
      for (const m of code.matchAll(/FORGE_RULE_TEMPLATES/g)) {
        const i = m.index;
        const head = code.slice(0, i);
        const tail = code.slice(i);
        const lineStart = head.lastIndexOf('\n') + 1;
        const nl = code.indexOf('\n', i);
        const lineText = code.slice(lineStart, nl === -1 ? code.length : nl);
        const isDecl = /^\s*import\b/.test(lineText)
          || /^\s*export\s+const\s+FORGE_RULE_TEMPLATES\b/.test(lineText);
        const ok = isDecl
          || FILTER_SUPPORTED_HEAD.test(head)
          || SAFE_TAIL.some((re) => re.test(tail))
          || (PINNED[rel] && PINNED[rel].test(tail));
        if (!ok) offenders.push(`${rel}:${head.split('\n').length} -> ${tail.slice(0, 60).replace(/\n/g, ' ')}`);
      }
    }
    expect(
      offenders,
      'New unfiltered corpus read(s). Route the list through filterSupported()/isSupported(), draw it from '
      + 'the useForge offerable projections, or — if this is a genuine non-offer read (lookup map, denominator) — '
      + `pin the file in this test with justification:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
