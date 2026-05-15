// src/components/Forge/Watchlist/UncommitModal.jsx
//
// Sprint 6 Phase 4B — the edit-unlock confirmation. Wraps the shared
// ConfirmationPopup; confirming reopens a committed watchlist for editing.

import React from 'react';
import { Unlock } from 'lucide-react';
import ConfirmationPopup from '../../shared/ConfirmationPopup';

export default function UncommitModal({ show, onConfirm, onClose }) {
  return (
    <ConfirmationPopup
      show={show}
      icon={<Unlock size={32} color="#ffffff" />}
      iconBgColor="#a78bfa"
      title="Unlock for editing"
      subtitle="Unlock this watchlist for editing? You'll need to commit again after changes."
      details={[{ label: 'Status', value: 'Committed → Draft' }]}
      confirmText="Unlock for editing"
      confirmColor="#a78bfa"
      cancelText="Keep as committed"
      onConfirm={onConfirm}
      onClose={onClose}
      hideTutorial
    />
  );
}
