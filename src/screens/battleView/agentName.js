// src/screens/battleView/agentName.js
//
// The agent's name as the 2b cockpit's copy shows it: the first letter capitalized, the rest as recorded (a name
// can be stored lowercase, e.g. "shadow"). The view, the bench sheet, the replace line and the research sheet
// (QF-8) take it from here; the 2a feed's copy and every model-visible text are unchanged. Import-free.

export function agentNameOf(name) {
  const s = typeof name === 'string' ? name.trim() : '';
  return s ? s.charAt(0).toLocaleUpperCase('en-US') + s.slice(1) : 'Your Agent';
}
