// api/_utils/tournamentPromptSanitizer.js
//
// P3a — sanitizer PORT for tournament prompt surfaces (founder ruling C-i,
// June 12, 2026). The canonical sanitizeRuleText is module-PRIVATE in fenced
// api/_utils/agentPromptAssembly.js (:245-265 at HEAD 53d892e), with a
// comment-annotated twin in fenced agentEvalPromptAssembly.js (:340). Neither
// is exported, and adding `export` to a fenced file is a fenced edit — so the
// tournament board prompt (rider #2 producer) cannot call it and must carry
// this port instead.
//
// THE PORT IS BYTE-IDENTICAL to the agentPromptAssembly.js function body
// (modulo the `export ` keyword). The co-located test enforces this with a
// SOURCE TRIPWIRE: it extracts the function text from BOTH fenced files and
// fails on any divergence from this port — a security copy that can't
// silently rot (the scoring-copy lesson, BUILD_RULES §4, applied to a
// security function).
//
// P4 CONTRACT (founder ruling, June 12, 2026): P4's fence entry exports
// sanitizeRuleText canonically from agentPromptAssembly.js, and this module
// collapses to a re-export — security copies don't live long here. Keeping
// the port byte-identical makes that collapse a provably-safe one-liner.

export function sanitizeRuleText(text) {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text.slice(0, 200);
  cleaned = cleaned.replace(/==\s*.*?\s*==/g, '');
  cleaned = cleaned.replace(/━+/g, '');
  const injectionPatterns = [
    /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|rules?|constraints?)/gi,
    /disregard\s+(all\s+)?(previous|above|prior)/gi,
    /stop\.?\s*(ignore|forget|disregard)/gi,
    /system\s*prompt/gi,
    /you\s+are\s+now/gi,
    /new\s+instructions?:/gi,
    /override\s+(all|previous|system)/gi,
  ];
  for (const pattern of injectionPatterns) {
    cleaned = cleaned.replace(pattern, '[removed]');
  }
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}
