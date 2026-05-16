// src/components/Forge/Watchlist/DeleteWatchlistModal.jsx
//
// Sprint 6 Phase 4D — delete confirmation. Wraps the shared ConfirmationPopup,
// mirroring CommitModal / UncommitModal. ConfirmationPopup maps over `details`
// unconditionally, so a `details` array is always passed.

import React from 'react';
import { Trash2 } from 'lucide-react';
import ConfirmationPopup from '../../shared/ConfirmationPopup';

export default function DeleteWatchlistModal({ show, watchlist, onConfirm, onClose }) {
  const tickerCount = Array.isArray(watchlist?.tickers) ? watchlist.tickers.length : 0;

  return (
    <ConfirmationPopup
      show={show}
      icon={<Trash2 size={32} color="#ffffff" />}
      iconBgColor="#ef4444"
      title="Delete watchlist"
      subtitle="This removes the watchlist from your list. You can't undo this from here."
      details={[
        { label: 'Name', value: watchlist?.name?.trim() || 'Untitled watchlist' },
        { label: 'Tickers', value: String(tickerCount) },
      ]}
      confirmText="Delete watchlist"
      confirmColor="#ef4444"
      cancelText="Keep watchlist"
      onConfirm={onConfirm}
      onClose={onClose}
      hideTutorial
    />
  );
}
