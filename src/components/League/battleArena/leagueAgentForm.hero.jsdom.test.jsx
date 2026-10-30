// @vitest-environment jsdom
//
// src/components/League/battleArena/leagueAgentForm.hero.jsdom.test.jsx
//
// Agent form build S2, arena fit — the phone hero and the lobby preview with AGENT_FORM_LEAGUE_ENABLED on. The hero's
// height is inline, because a rule in battleArena.css would ship with the flag off; the two lobby sites hand the preview
// the archetype they already hold (founder ruling 2 of Oct 30, 2026). The stylesheet's own rule, flag off, stays pinned by
// mobileHeroHeight.test.js.

import React, { useContext } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const seen = vi.hoisted(() => ({ previews: [] }));
vi.mock('../../../config/agentFormFlags', async (importOriginal) => ({ ...(await importOriginal()), AGENT_FORM_LEAGUE_ENABLED: true }));
vi.mock('../trainingClimbPreviewGate', async (importOriginal) => ({ ...(await importOriginal()), shouldPreviewClimb: () => true }));
vi.mock('../../../services/tournamentLobbyActions', () => ({ quickPlay: () => Promise.resolve({}), quickPlayTraining: () => {}, mapLobbyError: () => 'error' }));
vi.mock('../../../services/liveDraftActions', () => ({
  fetchSlotSchedule: () => Promise.resolve({ slots: [] }), claimSlot: () => Promise.resolve({}), releaseSlot: () => Promise.resolve({}), mapSlotActionError: () => 'error',
}));
vi.mock('../LoadoutChooserSheet', () => ({ default: () => null }));
vi.mock('../TrainingClimbPreview', async () => {
  const { LeagueAgentFormContext } = await vi.importActual('./leagueAgentFormSlot');
  return { default: function PreviewProbe({ viewport }) { seen.previews.push({ viewport, scope: useContext(LeagueAgentFormContext) }); return <i data-preview="" />; } };
});

const { ArenaMobile } = await import('./ArenaMobile');
const { FUSE_HERO_ON } = await import('./fuseHeroGate');
const { fuseFormHeroMin, FUSE_FORM_HERO_MAX, FUSE_FORM_HERO_RESERVE } = await import('./fuseFormLayout');
const { DeskTrainingPanel } = await import('../LeagueDeskParts');
const { LobbyTabbed } = await import('../LeagueLobbyRedesign');
const { leagueState } = await import('../leagueFixtures');
const { GROUP_STATUS } = await import('../../../constants/leagueTournament');

beforeEach(() => { seen.previews = []; });

describe('the phone hero with the forms on', () => {
  const html = () => renderToString(<ArenaMobile state="live" mode="ranked" />);
  const heroStyle = () => /class="bv2-fuse-hero-m" style="([^"]*)"/.exec(html())?.[1] ?? '';

  it('the fuse hero is the arm in use', () => {
    expect(FUSE_HERO_ON).toBe(true);
  });

  it('the height is inline: the floor, the screen less the reserve, the ceiling', () => {
    expect(heroStyle()).toContain(`height:clamp(${fuseFormHeroMin()}px, calc(100svh - ${FUSE_FORM_HERO_RESERVE}px), ${FUSE_FORM_HERO_MAX}px)`);
  });

  it('the floor is a plain min-height too, so an engine with no svh still fits four figures', () => {
    expect(heroStyle()).toContain(`min-height:${fuseFormHeroMin()}px`);
  });
});

describe('the lobby hands the preview your archetype (founder ruling 2)', () => {
  const pod = { id: 'p1', status: GROUP_STATUS.BATTLE, players: [] };
  const desk = (agentLoadout) => renderToString(<DeskTrainingPanel activeTrainingPod={pod} hasAgent agentLoadout={agentLoadout} uid="me" onOpenTrainingPod={() => {}} />);
  const phone = (agentLoadout) => renderToString(<LobbyTabbed st={leagueState('open')} accent="#5EEAD4" tab="training" onSwitchTab={() => {}} activeTrainingPod={pod} hasAgent agentLoadout={agentLoadout} uid="me" onOpenTrainingPod={() => {}} />);

  it.each([['the desktop panel', desk, 'desktop'], ['the phone lobby', phone, 'mobile']])('%s', (_, site, viewport) => {
    site({ archetype: 'guardian' });
    expect(seen.previews.at(-1)).toMatchObject({ viewport, scope: { youArchetype: 'guardian', battle: null, groupId: null } });
    site(null);
    expect(seen.previews.at(-1).scope.youArchetype).toBeNull();
  });
});
