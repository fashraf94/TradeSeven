// src/components/AgentPresence/index.js
//
// Agent Presence — public surface. The presence is a READ-ONLY display element: it
// writes nothing, gates nothing, and is removable without touching any scoring or
// decision path. Mount <AgentPresence> and feed it via useAgentPresence().

export { default } from './AgentPresence';
export { default as AgentPresence } from './AgentPresence';
export { default as AgentPresenceMount } from './AgentPresenceMount';
export { useAgentPresence } from './useAgentPresence';
export * from './presenceBinding';
