// src/data/ruleSupportStatus.test.js
//
// C-20 honesty gate — the support-status map and the offer-surface filters.
//
// Per BUILD_RULES process rule A6 (Guide): every acceptance-matrix row cites a
// test that FAILS under the defect it guards. Each describe block below names
// the defect it exists to catch.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { FORGE_RULE_TEMPLATES } from './forgeKnowledgeBase.js';
import { FORGE_COLLECTIONS } from './forgeCollections.js';
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

  it('holds the ruled tally: 88 supported / 14 absent / 14 unwired / 26 scrapped / 1 deprecated', () => {
    const tally = {};
    for (const t of FORGE_RULE_TEMPLATES) {
      const s = getSupportStatus(t.id);
      tally[s] = (tally[s] || 0) + 1;
    }
    expect(tally).toEqual({
      supported: 88,
      hidden_absent_substrate: 14,
      hidden_unwired: 14,
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

describe('the specific Phase-0 rulings are encoded', () => {
  // DEFECT GUARDED: a future edit quietly reverting a founder ruling.
  it('r-07 is hidden_unwired, not hidden_absent_substrate (industry taxonomy is 100% covered)', () => {
    expect(getSupportStatus('r-07')).toBe('hidden_unwired');
  });

  it('the whole Class B fundamental family is hidden_unwired', () => {
    for (const id of [
      'fund-earnings-surprise', 'fund-revenue-growth', 'fund-value-pe', 'fund-bank-pb',
      'fund-financial-health', 'fund-market-cap', 'f-07', 'f-08', 'f-09', 'f-10', 'f-11', 'f-12',
    ]) {
      expect(getSupportStatus(id), id).toBe('hidden_unwired');
    }
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

  it('no FORGE_COLLECTIONS preset ships a non-offerable rule', () => {
    const offenders = [];
    for (const c of FORGE_COLLECTIONS) {
      for (const id of c.ruleIds || []) {
        if (notOffered(id)) offenders.push(`${c.id} → ${id} (${getSupportStatus(id)})`);
      }
    }
    expect(offenders, `presets shipping hidden rules:\n${offenders.join('\n')}`).toEqual([]);
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
