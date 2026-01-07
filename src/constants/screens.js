// /src/constants/screens.js

/**
 * Screen name constants to avoid magic strings
 * Use: import { SCREENS } from '../constants/screens';
 *      setScreen(SCREENS.DASHBOARD);
 */

export const SCREENS = {
  // Auth
  HOME: 'home',

  // Main
  DASHBOARD: 'dashboard',
  PROFILE: 'profile',

  // Classic Mode
  BUILDER: 'builder',
  JOIN: 'join',
  BATTLE: 'battle',
  CREATE_BATTLE: 'createBattle',
  TRAINING: 'training',
  PORTFOLIO: 'portfolio',

  // BaggerBomb Mode (TD = Trading Day)
  TD_BUILDER: 'tdBuilder',
  JOIN_TD: 'joinPortfolioBuilderTD',
  TRAINING_TD: 'trainingPortfolioBuilderTD',

  // Snake Draft Mode
  DRAFT_SETUP: 'draftSetup',
  DRAFT_JOIN: 'draftJoin',
  DRAFT_TRAINING: 'draftTraining',
  DRAFT_LOBBY: 'draftLobby',
  DRAFT_ROOM: 'draftRoom',
  DRAFT_BATTLE: 'draftBattle',
  DRAFT_RESULTS: 'draftResults',
  DRAFT_HISTORY: 'draftHistory',
  FREE_AGENCY: 'freeAgency',

  // History
  BATTLE_HISTORY: 'battleHistory',
  PREVIOUS_BATTLES: 'previousBattles',
  WINS: 'wins',
  LOSSES: 'losses',

  // Special
  OPTIONS_ARENA: 'stonkOptionsArena'
};

// Screen groups for navigation logic
export const DRAFT_SCREENS = [
  SCREENS.DRAFT_SETUP,
  SCREENS.DRAFT_JOIN,
  SCREENS.DRAFT_TRAINING,
  SCREENS.DRAFT_LOBBY,
  SCREENS.DRAFT_ROOM,
  SCREENS.DRAFT_BATTLE,
  SCREENS.DRAFT_RESULTS,
  SCREENS.DRAFT_HISTORY,
  SCREENS.FREE_AGENCY
];

export const BATTLE_SCREENS = [
  SCREENS.BATTLE,
  SCREENS.BATTLE_HISTORY,
  SCREENS.PREVIOUS_BATTLES,
  SCREENS.WINS,
  SCREENS.LOSSES
];

export const BUILDER_SCREENS = [
  SCREENS.BUILDER,
  SCREENS.TD_BUILDER,
  SCREENS.JOIN,
  SCREENS.JOIN_TD,
  SCREENS.TRAINING_TD
];

export const MAIN_SCREENS = [
  SCREENS.HOME,
  SCREENS.DASHBOARD,
  SCREENS.PROFILE
];

// Helper to check if a screen belongs to a group
export const isInScreenGroup = (screen, group) => group.includes(screen);

// Helper to get screen display name
export const getScreenDisplayName = (screen) => {
  const displayNames = {
    [SCREENS.HOME]: 'Home',
    [SCREENS.DASHBOARD]: 'Dashboard',
    [SCREENS.PROFILE]: 'Profile',
    [SCREENS.BUILDER]: 'Portfolio Builder',
    [SCREENS.JOIN]: 'Join Battle',
    [SCREENS.BATTLE]: 'Battle',
    [SCREENS.CREATE_BATTLE]: 'Create Battle',
    [SCREENS.TRAINING]: 'Training',
    [SCREENS.PORTFOLIO]: 'Portfolio',
    [SCREENS.TD_BUILDER]: 'BaggerBomb Builder',
    [SCREENS.JOIN_TD]: 'Join BaggerBomb',
    [SCREENS.TRAINING_TD]: 'BaggerBomb Training',
    [SCREENS.DRAFT_SETUP]: 'Draft Setup',
    [SCREENS.DRAFT_JOIN]: 'Join Draft',
    [SCREENS.DRAFT_TRAINING]: 'Draft Training',
    [SCREENS.DRAFT_LOBBY]: 'Draft Lobby',
    [SCREENS.DRAFT_ROOM]: 'Draft Room',
    [SCREENS.DRAFT_BATTLE]: 'Draft Battle',
    [SCREENS.DRAFT_RESULTS]: 'Draft Results',
    [SCREENS.DRAFT_HISTORY]: 'Draft History',
    [SCREENS.FREE_AGENCY]: 'Free Agency',
    [SCREENS.BATTLE_HISTORY]: 'Battle History',
    [SCREENS.PREVIOUS_BATTLES]: 'Previous Battles',
    [SCREENS.WINS]: 'Wins',
    [SCREENS.LOSSES]: 'Losses',
    [SCREENS.OPTIONS_ARENA]: 'Options Arena'
  };
  return displayNames[screen] || screen;
};
