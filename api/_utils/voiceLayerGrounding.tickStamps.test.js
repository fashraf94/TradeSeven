// api/_utils/voiceLayerGrounding.tickStamps.test.js
//
// Phase B (B1 client half, seed §4 / §7) — the tick stamps in the grounded
// narrator's YOUR RECORD block.
//
// The import IS the guard (BUILD_RULES §4): this file imports the module it
// guards, so a browser dependency entering the graph explodes here in the Node
// env. Never mocked.
//
// The block is under the `'on'` / canary flag; these rows exercise the
// builders directly. The rows defend: the record's evidence carries the SAME
// labels the pane uses (one check, one vocabulary — hazard 26), the two Sol
// carve-outs survive into the prompt, the CURRENT DIRECTIVE line gains the
// positive Heard fact and NEVER the negative or a reason, the token budget
// falls back to the newest entry, and an unstamped record is byte-identical to
// what ships today.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { heardLabel } from '../../src/data/decisionRecord.js';
import {
  buildYourRecordBlock,
  renderRecordEntry,
  renderEvidenceLines,
  renderCurrentDirective,
  EVIDENCE_HEADING,
  EVIDENCE_TOKEN_BUDGET,
  GROUNDED_PHASE_RULES,
} from './voiceLayerGrounding.js';

const T1 = '2026-09-01T16:15:00.000Z'; // 12:15 PM ET
const T2 = '2026-09-01T16:30:00.000Z'; // 12:30 PM ET
const T3 = '2026-09-01T16:45:00.000Z'; // 12:45 PM ET

const EVIDENCE = {
  NVDA: {
    px: 123.6, chg: 2.57, atrX: 0.83, vwapDev: 0.95, bbPct: 15, nr7: true,
    regime: 'directional_expansion', risk: { action: 'LOCK', reason: 'threshold_proximity' },
  },
  TSLA: {
    px: 250, chg: -1.2, atrX: null, vwapDev: null, bbPct: null, nr7: false,
    regime: 'choppy', risk: { action: 'HOLD' },
  },
};
const VINTAGES = {
  quote: 'tick', vwap: 'tick',
  techAt: '2026-09-01T18:29:55.000Z', fundAsOf: '2026-09-08', rankingsAt: '2026-09-01T18:30:00.000Z',
};

const entry = (timestamp, over = {}) => ({
  evalId: `e-${timestamp}`, timestamp, decision: 'HOLD',
  rationale: 'Held the book into the afternoon.',
  ...over,
});
const stamped = (timestamp, over = {}) => entry(timestamp, { evidence: EVIDENCE, vintages: VINTAGES, ...over });
const DIRECTIVE = { text: 'Protect the lead', directiveThreadId: 't-1', createdAt: '2026-09-01T15:31:00.000Z' };

describe('the evidence lines — the pane\'s labels, in the prompt', () => {
  it('one compact line per held position, under the heading, plus the provenance triplet', () => {
    const lines = renderEvidenceLines(stamped(T3));
    expect(lines[0]).toBe(`  ${EVIDENCE_HEADING}`);
    expect(lines[1]).toContain('NVDA — Price $123.60 · Gain since entry +2.57% · ATR multiple 0.83×');
    expect(lines[1]).toContain('Bollinger width 15th %ile · NR7 · Regime directional_expansion · Risk LOCK');
    expect(lines[2]).toBe('    TSLA — Price $250.00 · Gain since entry -1.20% · Regime choppy');
    // The provenance triplet rides ONCE per entry, not once per position.
    expect(lines[3]).toBe('    Fundamentals block as of Sep 8 · Latest held technical stamp · 2:29 PM · Rankings as of 2:30 PM');
    expect(lines).toHaveLength(4);
  });

  it('RISK HOLD IS SILENT and the reason CODE never appears (Sol B-1)', () => {
    const text = renderEvidenceLines(stamped(T3)).join('\n');
    expect(text).toContain('Risk LOCK');
    expect(text).not.toContain('Risk HOLD');
    expect(text).not.toContain('threshold_proximity');
  });

  it('`chg` is spelled SINCE ENTRY, never change/move/today (Sol M-3)', () => {
    const text = renderEvidenceLines(stamped(T3)).join('\n');
    expect(text).toContain('Gain since entry +2.57%');
    for (const wrong of ['Change +', 'Move +', 'today']) expect(text).not.toContain(wrong);
  });

  it('the provenance never promises freshness (Sol M-2)', () => {
    const text = renderEvidenceLines(stamped(T3)).join('\n');
    for (const overclaim of ['Technical data as of', 'Technicals updated', 'Data current at']) {
      expect(text).not.toContain(overclaim);
    }
  });

  it('nulls render nothing and there is no rsPct slot (Sol m-1)', () => {
    const lines = renderEvidenceLines(stamped(T3, {
      evidence: { NVDA: { px: null, chg: null, atrX: null, vwapDev: null, bbPct: null, nr7: null, regime: null, risk: null } },
    }));
    expect(lines).toEqual([]);
    const withRs = renderEvidenceLines(stamped(T3, { evidence: { NVDA: { ...EVIDENCE.NVDA, rsPct: 72 } } })).join('\n');
    expect(withRs).not.toContain('72');
    expect(withRs).not.toContain('RS');
  });

  // Review B-4. `promptBuilt` is set after the prompt is built and before the
  // transport call, so a timed-out tick has TRUE stamps and no decision. The
  // pane renders them under `No decision recorded at this check`; the narrator
  // returned early on `haikuError` and rendered none, so one record answered
  // two ways.
  it('AN OUTAGE ENTRY STILL CARRIES ITS EVIDENCE — the pane and the record agree', () => {
    const outage = stamped(T3, { haikuError: { failureClass: 'timeout' }, rationale: 'Haiku call failed — defaulting to HOLD' });
    const lines = renderRecordEntry(outage);
    expect(lines[0]).toContain('No decision recorded at this check');
    expect(lines).toContain(`  ${EVIDENCE_HEADING}`);
    expect(lines.join('\n')).toContain('NVDA — Price $123.60 · Gain since entry +2.57%');
    // The cron's placeholder rationale is still NOT quoted (hazard 25, D-65).
    expect(lines.join('\n')).not.toContain('Haiku call failed');
    // What the check SAW does not depend on whether it decided.
    expect(renderRecordEntry(outage, { withEvidence: false })).toHaveLength(1);
  });

  it('an outage entry with NO stamp is still the bare absence line', () => {
    const lines = renderRecordEntry(entry(T3, { haikuError: { failureClass: 'timeout' } }));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('No decision recorded at this check');
  });

  it('NO STAMP → NO LINES, and the record entry is byte-identical to today', () => {
    expect(renderEvidenceLines(entry(T3))).toEqual([]);
    expect(renderRecordEntry(entry(T3))).toEqual(renderRecordEntry(entry(T3), { withEvidence: false }));
  });
});

describe('the CURRENT DIRECTIVE line gains the Heard fact', () => {
  it('a heard thread appends `· heard at the {slot} check`', () => {
    const block = buildYourRecordBlock({
      evaluations: [stamped(T3, { heard: { directiveThreadId: 't-1', suppressed: null } })],
      directive: DIRECTIVE,
    });
    expect(block).toContain('"Protect the lead" — filed 11:31 AM · heard at the 12:45 PM check');
  });

  // ── ONE SENTENCE, ONE SOURCE (hazard 26, BUILD_RULES §9) ──────────────────
  //
  // The suffix used to be this module's own `heard at the ${slot} check` — a
  // second copy of the pane's `Heard at the {slot} check`, declared in the
  // module whose reason for importing decisionRecord.js at all is that copying
  // its strings into api/ is the drift class §4 forbids. It reads `heardLabel`
  // now. These two rows are the bytes: the FIRST pins the line as literal text
  // (so the change is proven to have moved nothing), the SECOND derives the
  // same line from `heardLabel` (so a future edit to the label moves the
  // narrator with it instead of leaving the two to disagree). Neither is
  // redundant — drop the literal and a broken label passes; drop the derived
  // one and a re-copied string passes.
  it('the suffix IS `heardLabel`, in this line\'s own sentence position', () => {
    const block = buildYourRecordBlock({
      evaluations: [stamped(T3, { heard: { directiveThreadId: 't-1', suppressed: null } })],
      directive: DIRECTIVE,
    });
    const label = heardLabel('12:45 PM');
    expect(label).toBe('Heard at the 12:45 PM check');
    // Only the FRAME is the narrator's: the ` · ` separator, and the opening
    // letter the mid-line position calls for. Everything after it is the
    // label, byte for byte.
    const suffix = ` · ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
    expect(block).toContain(`"Protect the lead" — filed 11:31 AM${suffix}`);
    // …and the line differs from the card's ONLY by that frame.
    expect(suffix.slice(3)).toBe(label.replace('Heard', 'heard'));
  });

  it('TRIPWIRE: the module declares no sentence of its own for this fact', () => {
    const source = readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), 'voiceLayerGrounding.js'), 'utf8',
    );
    // COMMENTS ARE STRIPPED FIRST, the deskHonesty.test.js rule: the prose
    // above the call quotes the copy it deleted in order to say what was
    // deleted, and a guard that scanned comments would ban the note explaining
    // itself. What ships to the model is string literals and template code.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    // Scoped to an INTERPOLATED copy of the sentence, not to the words. The
    // grounding rules must NAME the line to explain what it claims — `"Heard
    // at the {t} check" means the directive was in front of the process` —
    // and that sentence ships, so banning the words would ban the rule that
    // teaches them. A re-declared copy is the thing being banned, and a copy
    // needs the slot interpolated into it.
    expect(code).not.toMatch(/heard at the \$\{/i);
    expect(code).toContain('heardLabel(heardSlot)');
  });

  it('A SUPPRESSED THREAD LEAVES THE LINE UNCHANGED — no negative, no reason (Sol M-1)', () => {
    // The line is pinned EXACTLY and the bans are CASE-INSENSITIVE (review
    // C-1). The prompt's own register is lowercase, so a negative written to
    // match it — ` · not heard at this check` — slips a case-sensitive
    // `not.toContain('Not heard')`; and any appended clause slips a
    // `toContain` of the prefix. The exact line is the only assertion that
    // catches both.
    const line = (block) => block.split('\n').find((l) => l.includes('Protect the lead'));
    for (const reason of ['malformed', 'mode_not_enforce', 'epoch_killed', 'unknown']) {
      const block = buildYourRecordBlock({
        evaluations: [stamped(T3, { heard: { directiveThreadId: 't-1', suppressed: reason } })],
        directive: DIRECTIVE,
      });
      expect(line(block)).toBe('  "Protect the lead" — filed 11:31 AM');
      expect(block.toLowerCase()).not.toContain('heard');
      expect(block).not.toContain(reason);
    }
  });

  it('a stamp for a DIFFERENT thread adds nothing to this directive\'s line', () => {
    const block = buildYourRecordBlock({
      evaluations: [stamped(T3, { heard: { directiveThreadId: 't-other', suppressed: null } })],
      directive: DIRECTIVE,
    });
    expect(block).not.toContain('heard at the');
  });

  it('LAST ENTRY WINS — heard, then withheld, drops the suffix', () => {
    const block = buildYourRecordBlock({
      evaluations: [
        stamped(T2, { heard: { directiveThreadId: 't-1', suppressed: null } }),
        stamped(T3, { heard: { directiveThreadId: 't-1', suppressed: 'epoch_killed' } }),
      ],
      directive: DIRECTIVE,
    });
    expect(block).not.toContain('heard at the');
  });

  it('no stamp at all → the shipped line, byte for byte', () => {
    // Review V-2: comparing `renderCurrentDirective(D)` with
    // `renderCurrentDirective(D, null)` was a tautology — null is the default.
    // The real comparison is the whole BLOCK with and without a stamped entry.
    const unstamped = buildYourRecordBlock({ evaluations: [stamped(T3)], directive: DIRECTIVE });
    const shipped = buildYourRecordBlock({
      evaluations: [{ ...stamped(T3), heard: undefined }], directive: DIRECTIVE,
    });
    expect(unstamped).toBe(shipped);
    expect(unstamped.toLowerCase()).not.toContain('heard');
    expect(renderCurrentDirective(DIRECTIVE)).toBe(`${renderCurrentDirective(DIRECTIVE, null)}`);
  });
});

describe('the token budget — the evidence rides the newest entry when it costs too much', () => {
  it('three modest entries all keep their evidence', () => {
    const block = buildYourRecordBlock({
      evaluations: [stamped(T1), stamped(T2), stamped(T3)],
      directive: null,
    });
    expect((block.match(new RegExp(EVIDENCE_HEADING, 'g')) || []).length).toBe(3);
  });

  it('a wide book blows the budget and the evidence falls back to the NEWEST entry only', () => {
    // Fourteen held names per entry, three entries: far past 300 tokens.
    const wide = {};
    for (let i = 0; i < 14; i += 1) wide[`SYM${i}`] = EVIDENCE.NVDA;
    const evaluations = [T1, T2, T3].map((t) => stamped(t, { evidence: wide }));
    const block = buildYourRecordBlock({ evaluations, directive: null });
    expect((block.match(new RegExp(EVIDENCE_HEADING, 'g')) || []).length).toBe(1);
    // And it is the NEWEST check that kept it — the block is newest-first.
    const heading = block.indexOf(EVIDENCE_HEADING);
    const secondCheck = block.indexOf('[12:30 PM check]');
    expect(heading).toBeGreaterThan(-1);
    expect(heading).toBeLessThan(secondCheck);
  });

  it('the budget is measured on the EVIDENCE\'s contribution, not the whole body', () => {
    // A very long rationale must not push the evidence off the record.
    const evaluations = [T1, T2, T3].map((t) => stamped(t, { rationale: 'x'.repeat(4000) }));
    const block = buildYourRecordBlock({ evaluations, directive: null });
    expect((block.match(new RegExp(EVIDENCE_HEADING, 'g')) || []).length).toBe(3);
    expect(EVIDENCE_TOKEN_BUDGET).toBe(300);
  });

  it('an empty record is still the truthful absence line', () => {
    const block = buildYourRecordBlock({ evaluations: [], directive: null });
    expect(block).toContain('No check has been recorded yet.');
    expect(block).not.toContain(EVIDENCE_HEADING);
  });
});

describe('the grounded rules name the limit of both verbs', () => {
  it('every phase carries the "what a check saw" rule', () => {
    // Review C-10: a for-of over an empty object passes silently. Pin the
    // count first, the way deskHonesty pins BATTLE_VIEW_SOURCES.length.
    expect(Object.keys(GROUNDED_PHASE_RULES).length).toBeGreaterThanOrEqual(3);
    for (const rules of Object.values(GROUNDED_PHASE_RULES)) {
      expect(rules).toContain('They do not explain the decision; do not say a value caused a hold or a swap.');
      expect(rules).toContain('never that it was considered, used, or acted on');
    }
  });
});
