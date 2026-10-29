// src/components/AgentForm/agentFormTokens.js
//
// Every colour the agent engine draws with, read from the --ft-* tokens (src/theme/tokens.css) through
// readToken, the canvas/WebGL route of BUILD_RULES §10. Read when an engine view mounts (readToken reads
// lazily, so a rebind is picked up by the next mount) and handed to the engine as an argument.

import { readToken } from '../../theme/cssTokens';

/** The engine's theme: four palettes ({ near, far, core }), the plate, the studio, the lights and the fog. */
export function readAgentFormTheme() {
  const t = readToken;
  return {
    palettes: {
      teal: { near: t('teal'), far: t('teal-2'), core: t('agent-teal-core') },
      copper: { near: t('copper'), far: t('agent-copper-far'), core: t('agent-copper-core') },
      mono: { near: t('agent-mono-near'), far: t('agent-mono-far'), core: t('white') },
      unlit: { near: t('agent-unlit-near'), far: t('agent-unlit-far'), core: t('agent-unlit-core') },
    },
    plate: t('agent-plate'),
    fog: t('bg-card'),
    studio: { box: t('agent-studio-box'), key: t('agent-studio-key'), fill: t('agent-studio-fill'), top: t('white'), under: t('agent-studio-under') },
    lights: { key: t('agent-light-key'), rim: t('agent-light-rim'), sky: t('agent-light-sky'), ground: t('agent-light-ground') },
  };
}
