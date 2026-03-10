/**
 * Shared JSON extraction utility.
 *
 * Parses a raw string (typically an LLM response) into a JavaScript object,
 * handling markdown code fences and extraneous surrounding text.
 */

export function extractJSON(raw) {
  if (!raw || typeof raw !== 'string') return null;

  // Step 0: Strip markdown fences (```json ... ``` or ``` ... ```)
  const stripped = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  // Strategy 1: Direct parse
  try {
    return JSON.parse(stripped);
  } catch (e) { /* continue */ }

  // Strategy 2: Brace boundaries
  const firstBrace = stripped.indexOf('{');
  const lastBrace = stripped.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(stripped.slice(firstBrace, lastBrace + 1));
    } catch (e) { /* continue */ }
  }

  return null;
}
