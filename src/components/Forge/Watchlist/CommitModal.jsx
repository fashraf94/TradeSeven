// src/components/Forge/Watchlist/CommitModal.jsx
//
// Sprint 6 Phase 4B — the commit ceremony. Wraps the shared ConfirmationPopup
// with a summary of what is being locked in.

import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import ConfirmationPopup from '../../shared/ConfirmationPopup';

export default function CommitModal({ show, watchlist, onConfirm, onClose }) {
  const tickers = Array.isArray(watchlist?.tickers) ? watchlist.tickers : [];
  const activation = Array.isArray(watchlist?.activationConditions)
    ? watchlist.activationConditions
    : [];
  const invalidation = Array.isArray(watchlist?.invalidationConditions)
    ? watchlist.invalidationConditions
    : [];

  const details = [
    { label: 'Tickers', value: String(tickers.length) },
    { label: 'Activation conditions', value: String(activation.length) },
    { label: 'Invalidation conditions', value: String(invalidation.length) },
  ];

  return (
    <ConfirmationPopup
      show={show}
      icon={<CheckCircle2 size={32} color="#ffffff" />}
      iconBgColor="#5eead4"
      title="Commit watchlist"
      subtitle="Lock this watchlist in. You can unlock it later if you need to make changes."
      details={details}
      confirmText="Commit watchlist"
      confirmColor="#5eead4"
      cancelText="Keep editing"
      onConfirm={onConfirm}
      onClose={onClose}
      hideTutorial
    />
  );
}
