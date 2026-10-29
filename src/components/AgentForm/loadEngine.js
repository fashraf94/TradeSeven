// src/components/AgentForm/loadEngine.js
//
// The one import() of the agent form engine (and so of three.js). AgentForm.jsx and the lab both load it
// through here; the promise is kept so the chunk is requested once per page.

let pending = null;

export function loadAgentFormEngine() {
  if (!pending) pending = import('./engine/index.js').catch((error) => { pending = null; throw error; });
  return pending;
}
