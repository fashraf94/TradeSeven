// src/components/AgentForm/engine/__mocks__/glPlatform.js
//
// Build S0 — the GPU module's stand-in for tests (vi.mock('…/engine/glPlatform.js') with no factory picks
// this file). The real engine runs on it with renderer stand-ins that record every call; `made` lists what
// it produced, for the wrapper's teardown rows.

import { fakeGlPlatform } from '../../__fixtures__/agentFormKit.js';

const platform = fakeGlPlatform();

export const made = platform.made;
export const createRenderer = (opts) => platform.createRenderer(opts);
export const createEnvironment = (renderer, studio) => platform.createEnvironment(renderer, studio);
export const hasMultiDraw = () => true;
export const gpuName = () => 'fake GPU';
