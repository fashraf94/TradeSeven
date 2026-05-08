// src/components/SignalDrop/index.js
//
// Sprint 6 Phase 3 barrel for the Signal Drop user-facing surface.
// Phase 3A added the entry modal; 3B added WatchlistChat + PhaseIndicator;
// 3C will add WatchlistAnatomyPanel + AnatomySection. ChatBubble /
// ActionChip / TypingIndicator are presentation primitives consumed only
// by WatchlistChat — they're intentionally not re-exported here.

export { default as SignalDropEntry } from './SignalDropEntry';
export { default as WatchlistChat } from './WatchlistChat';
export { default as PhaseIndicator } from './PhaseIndicator';
