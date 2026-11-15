// src/screens/battleViewRouting.js
//
// League Battleview Routing (Spec V1.1, Phase A) — the pure routing discriminator,
// kept in its own module (not the BattleViewScreen component file) so it stays
// unit-testable and doesn't trip react-refresh/only-export-components.

// The extension lets api/ import this module under Node ESM (Battle Research's route reads isLeagueBattle).
import { FLAT6_GAME_MODE } from '../constants/agentGameModes.js';

// A flat-6 LEAGUE battle is an agentBattles doc stamped
// gameMode:'baggerbomb_tournament' (FLAT6_GAME_MODE) — the ONE field that cleanly
// separates it from a BaggerBomb agent battle (gameMode:'baggerbomb_agent') at the
// routing layer, present on the doc the card already holds.
export const isLeagueBattle = (battle) => battle?.gameMode === FLAT6_GAME_MODE;
