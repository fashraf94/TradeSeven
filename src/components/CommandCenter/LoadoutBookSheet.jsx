// src/components/CommandCenter/LoadoutBookSheet.jsx
//
// Build A2 — the book door (boards 1 and 4; "the book picker sheet's redesign" is not in A2): today's watchlist sheet
// (EquipSheet, reused unchanged, rows and handler as LoadoutSheets.jsx's WatchlistSheet draws them), opened from a
// loadout card's book row with that loadout's context, and writing through the `loadout` field
// (services/loadoutService.js): the BaggerBomb slot's book, or the League loadout's (refused by the server while the
// week holds it; the card offers no door then). The sheet's title names the game; the selected row is that loadout's
// book; "No watchlist" is "No book · open market". As the shipped sheet does, a failure is logged and the sheet closes
// either way; the card then shows what the record holds. LoadoutSheets.jsx mounts this in place of WatchlistSheet with
// both flags on (one literal ternary).

import React, { use, useState } from 'react';
import { equipLoadoutBook, unequipLoadoutBook } from '../../services/loadoutService';
import EquipSheet from '../Dashboard/EquipSheet';
import { readToken } from '../../theme/cssTokens';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { LOADOUT_COPY } from '../../constants/loadoutCopy';
import { LISTS_STATUS, symbolsOf } from './hub/selectors/loadout';
import { HubButton } from './HubParts';
import { PerGameLoadoutContext, cardsOf } from './hub/perGameLoadoutContext';

export default function LoadoutBookSheet({ open, onClose, dock, agent, lists, onOpenForgeLists }) {
  const scope = use(PerGameLoadoutContext);
  const cards = cardsOf(scope);
  const card = cards ? cards[scope.bookKind] : null;
  const [working, setWorking] = useState(false);
  const equippedId = card ? card.book.id : null;

  const equip = async (watchlistId) => {
    if (!agent?.id || !card || working) return;
    setWorking(true);
    try {
      if (watchlistId) await equipLoadoutBook(agent.id, watchlistId, card.kind);
      else await unequipLoadoutBook(agent.id, card.kind);
    } catch (error) {
      console.error('[CommandCenterHub] loadout book equip/unequip failed:', error);
    } finally {
      setWorking(false);
      onClose();
    }
  };

  const rows = [
    { id: '__none__', title: LOADOUT_COPY.noBook, subtitle: COPY.watchlistSheet.noneSub, selected: !equippedId, disabled: working, onClick: () => equip(null) },
    ...lists.committed.map((list) => ({
      id: list.watchlistId,
      title: list.name || COPY.watchlistSheet.untitled,
      subtitle: COPY.watchlistSheet.tickers(symbolsOf(list).length),
      selected: list.watchlistId === equippedId,
      disabled: working,
      onClick: () => equip(list.watchlistId),
    })),
  ];
  const failed = lists.status === LISTS_STATUS.ERROR;

  return (
    <EquipSheet
      open={open}
      onClose={onClose}
      dock={dock}
      title={card ? LOADOUT_COPY.bookTitle(card.game) : COPY.watchlistSheet.title}
      subtitle={COPY.watchlistSheet.subtitle}
      loading={lists.status === LISTS_STATUS.LOADING}
      rows={rows}
      emptyLabel={COPY.watchlistSheet.empty}
      footer={<HubButton kind="accent" full onPress={onOpenForgeLists}>{COPY.watchlistSheet.createInForge}</HubButton>}
      accent={readToken('teal')}
    >
      {failed ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start', padding: '14px 4px' }}>
          <span>{COPY.loadout.listsError}</span>
          <HubButton small onPress={lists.retry}>{COPY.loadout.retry}</HubButton>
        </div>
      ) : null}
    </EquipSheet>
  );
}
