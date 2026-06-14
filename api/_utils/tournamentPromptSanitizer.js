// api/_utils/tournamentPromptSanitizer.js
//
// P3a shipped this file as a byte-identical PORT of the then-module-private
// sanitizeRuleText (founder ruling C-i, June 12, 2026), guarded by a source
// tripwire against both fenced originals — a security copy that couldn't
// silently rot.
//
// P4 CONTRACT #6 EXECUTED (founder ruling, June 12, 2026 — amended same day):
// the fence entry exported sanitizeRuleText canonically from
// agentPromptAssembly.js and replaced the agentEvalPromptAssembly.js private
// twin with that import. This module is now the promised RE-EXPORT — zero
// copies remain anywhere. The tripwire test retired with the port (its job —
// keeping three copies in lockstep — no longer exists); the behavioral
// battery in the co-located test lives on against the canonical export.

export { sanitizeRuleText } from './agentPromptAssembly.js';
