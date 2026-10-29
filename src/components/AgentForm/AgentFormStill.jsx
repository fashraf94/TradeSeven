// src/components/AgentForm/AgentFormStill.jsx
//
// The agent form's fallback still, for when there is no engine frame to show: no WebGL in this browser, the
// engine chunk failed or is still loading, or the context was lost before the form's own still was cached.
// A soft core of light in the allegiance colour — Shadow's centre, without the threads or the armor. SVG,
// so it needs no canvas and no GPU. Colours are tokens through `style` (BUILD_RULES §10, ruling R-H8: never
// a var() in a presentation attribute).

import { useId } from 'react';
import { cssVar } from '../../theme/cssTokens';

export default function AgentFormStill({ size, opponent = false }) {
  const id = useId().replace(/:/g, '');
  const near = cssVar(opponent ? 'copper' : 'teal'), core = cssVar(opponent ? 'agent-copper-core' : 'agent-teal-core');
  return (
    <svg data-agent-form-placeholder="" aria-hidden="true" width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, display: 'block' }}>
      <defs>
        <radialGradient id={`afg-${id}`}>
          <stop offset="0" style={{ stopColor: core, stopOpacity: 1 }} />
          <stop offset=".18" style={{ stopColor: near, stopOpacity: .55 }} />
          <stop offset=".5" style={{ stopColor: near, stopOpacity: .14 }} />
          <stop offset="1" style={{ stopColor: near, stopOpacity: 0 }} />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="34" style={{ fill: `url(#afg-${id})` }} />
    </svg>
  );
}
