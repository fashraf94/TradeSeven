// src/components/Season/PitStopChanges.jsx
//
// Pit Stop algorithm-changes section — lets the user queue up to 3 rule
// parameter tweaks for next week. Each change is written to the pitStop
// doc's `changes[]` field as the user adds it. Server-side
// `validatePitStopChanges` (api/_utils/seasonValidation.js) runs at lock-in
// and expects each item shaped as `{ ruleId, field, oldValue, newValue }`.
// No `type` field on input — the validator normalises it to
// `type: 'param_change'` on the validated output.
//
// The stale-write check compares `oldValue` against the live param value at
// lock-in, so we snapshot the value live from `entry.algorithm.rules` at
// add-time (not from a pre-loaded cache).
//
// Props:
//   entryId           - seasonEntry doc id
//   week              - pit stop week number
//   changes           - pitStop.changes[] from parent
//   algorithmRules    - entry.algorithm.rules[] — each item has
//                       { ruleId, category, modes, priority, params, enabled }
//   isOpen            - true when pitStop.status === 'open'
//   onRefreshPitStop  - async () => void; parent refreshes after writes
//
// Read-only mode (isOpen=false): static list, no controls.

import React, { useState, useMemo } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { HOLO_COLORS } from '../../constants/holoTheme';
import { FORGE_RULE_TEMPLATES } from '../../data/forgeKnowledgeBase';

const TROPHY_GOLD = '#F0C75E';
const MAX_CHANGES = 3;

// ─── Schema lookup helpers ───────────────────────────────────

function getRuleTemplate(ruleId) {
  if (!ruleId) return null;
  const lower = String(ruleId).toLowerCase();
  return (
    FORGE_RULE_TEMPLATES.find(
      (t) => String(t.id).toLowerCase() === lower,
    ) || null
  );
}

function getParamSchema(ruleId, field) {
  const tpl = getRuleTemplate(ruleId);
  const params = tpl?.forgeTemplates?.[0]?.params || null;
  if (!params) return null;
  return params[field] || null;
}

function getRuleHeadline(ruleId) {
  return getRuleTemplate(ruleId)?.headline || ruleId;
}

function getParamLabel(ruleId, field) {
  return getParamSchema(ruleId, field)?.label || field;
}

function formatParamValue(value, schema) {
  if (value === null || value === undefined) return '—';
  const unit = schema?.unit || '';
  if (schema?.type === 'toggle') return value ? 'On' : 'Off';
  if (schema?.type === 'select' && Array.isArray(schema.options)) {
    const match = schema.options.find(
      (o) => String(o.value) === String(value),
    );
    if (match) return match.label;
  }
  return unit ? `${value}${unit}` : String(value);
}

// Coerce a string from an <input> into the schema's expected type.
// Preserves the "original type" so oldValue matches the stale-write check.
function coerceNewValue(rawValue, schema, existingOldValue) {
  if (!schema) return rawValue;
  if (schema.type === 'toggle') return Boolean(rawValue);
  if (schema.type === 'number') return Number(rawValue);
  if (schema.type === 'select') {
    // Options may carry numeric or string values — match whichever the
    // live oldValue uses so equality holds server-side.
    if (typeof existingOldValue === 'number') return Number(rawValue);
    return rawValue;
  }
  return rawValue;
}

// ─── Add-change drawer ───────────────────────────────────────

function AddChangeForm({ algorithmRules, onCancel, onSubmit, disabled }) {
  const equippedRules = useMemo(
    () =>
      (Array.isArray(algorithmRules) ? algorithmRules : []).filter(
        (r) => r && r.enabled !== false && r.ruleId,
      ),
    [algorithmRules],
  );

  const [selectedRuleId, setSelectedRuleId] = useState('');
  const [selectedField, setSelectedField] = useState('');
  const [newValueRaw, setNewValueRaw] = useState('');
  const [validationError, setValidationError] = useState(null);

  const selectedRule = useMemo(
    () => equippedRules.find((r) => r.ruleId === selectedRuleId) || null,
    [equippedRules, selectedRuleId],
  );

  const template = useMemo(
    () => (selectedRuleId ? getRuleTemplate(selectedRuleId) : null),
    [selectedRuleId],
  );

  const paramEntries = useMemo(() => {
    const params = template?.forgeTemplates?.[0]?.params || {};
    return Object.entries(params); // [[field, schema], ...]
  }, [template]);

  const selectedSchema = useMemo(
    () => (selectedField ? getParamSchema(selectedRuleId, selectedField) : null),
    [selectedRuleId, selectedField],
  );

  const liveOldValue = useMemo(() => {
    if (!selectedRule || !selectedField) return undefined;
    const params = selectedRule.params || {};
    return params[selectedField];
  }, [selectedRule, selectedField]);

  // Reset the field + new value whenever the rule changes.
  const handleRuleChange = (ruleId) => {
    setSelectedRuleId(ruleId);
    setSelectedField('');
    setNewValueRaw('');
    setValidationError(null);
  };

  const handleFieldChange = (field) => {
    setSelectedField(field);
    setValidationError(null);
    // Seed new-value input with the current value as a starting point.
    const schema = getParamSchema(selectedRuleId, field);
    const current = selectedRule?.params?.[field];
    if (schema?.type === 'toggle') {
      setNewValueRaw(Boolean(current));
    } else if (current !== undefined && current !== null) {
      setNewValueRaw(String(current));
    } else {
      setNewValueRaw('');
    }
  };

  const handleAdd = () => {
    setValidationError(null);
    if (!selectedRuleId || !selectedField) {
      setValidationError('Select a rule and a field');
      return;
    }
    if (liveOldValue === undefined) {
      setValidationError('Live parameter value could not be read');
      return;
    }

    const coerced = coerceNewValue(newValueRaw, selectedSchema, liveOldValue);

    // Client-side bounds check (the server re-validates on lock-in).
    if (selectedSchema?.type === 'number') {
      if (!Number.isFinite(coerced)) {
        setValidationError('Enter a valid number');
        return;
      }
      if (
        typeof selectedSchema.min === 'number' &&
        coerced < selectedSchema.min
      ) {
        setValidationError(
          `Must be at least ${selectedSchema.min}${selectedSchema.unit || ''}`,
        );
        return;
      }
      if (
        typeof selectedSchema.max === 'number' &&
        coerced > selectedSchema.max
      ) {
        setValidationError(
          `Must be at most ${selectedSchema.max}${selectedSchema.unit || ''}`,
        );
        return;
      }
    }

    if (coerced === liveOldValue) {
      setValidationError('New value matches current value');
      return;
    }

    onSubmit({
      ruleId: selectedRuleId,
      field: selectedField,
      oldValue: liveOldValue,
      newValue: coerced,
    });
  };

  const inputStyleBase = {
    width: '100%',
    boxSizing: 'border-box',
    background: '#1C1A27',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '8px 12px',
    color: HOLO_COLORS.textPrimary,
    fontSize: 13,
    outline: 'none',
    fontFamily: 'inherit',
  };

  const labelStyle = {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    color: HOLO_COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  };

  return (
    <div
      style={{
        background: '#15171E',
        border: `1px solid rgba(240, 199, 94, 0.3)`,
        borderRadius: 10,
        padding: 14,
        marginBottom: 12,
      }}
    >
      {/* Rule picker */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Rule</label>
        <select
          value={selectedRuleId}
          onChange={(e) => handleRuleChange(e.target.value)}
          disabled={disabled}
          style={inputStyleBase}
        >
          <option value="">— Select a rule —</option>
          {equippedRules.map((r) => (
            <option key={r.ruleId} value={r.ruleId}>
              {String(r.ruleId).toUpperCase()}: {getRuleHeadline(r.ruleId)}
            </option>
          ))}
        </select>
      </div>

      {/* Field picker */}
      {selectedRuleId && (
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Parameter</label>
          {paramEntries.length === 0 ? (
            <div
              style={{
                fontSize: 12,
                color: HOLO_COLORS.textMuted,
                fontStyle: 'italic',
              }}
            >
              No tunable parameters on this rule.
            </div>
          ) : (
            <select
              value={selectedField}
              onChange={(e) => handleFieldChange(e.target.value)}
              disabled={disabled}
              style={inputStyleBase}
            >
              <option value="">— Select a parameter —</option>
              {paramEntries.map(([field, schema]) => (
                <option key={field} value={field}>
                  {schema.label || field}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Current value + new value */}
      {selectedRuleId && selectedField && selectedSchema && (
        <>
          <div
            style={{
              display: 'flex',
              gap: 12,
              marginBottom: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: '1 1 140px', minWidth: 0 }}>
              <label style={labelStyle}>Current</label>
              <div
                style={{
                  fontSize: 13,
                  color: HOLO_COLORS.textPrimary,
                  padding: '8px 12px',
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {formatParamValue(liveOldValue, selectedSchema)}
              </div>
            </div>
            <div style={{ flex: '1 1 140px', minWidth: 0 }}>
              <label style={labelStyle}>New</label>
              {selectedSchema.type === 'toggle' ? (
                <button
                  onClick={() => setNewValueRaw((v) => !v)}
                  disabled={disabled}
                  style={{
                    ...inputStyleBase,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    background: newValueRaw
                      ? 'rgba(240, 199, 94, 0.15)'
                      : '#1C1A27',
                    borderColor: newValueRaw
                      ? 'rgba(240, 199, 94, 0.4)'
                      : 'rgba(255,255,255,0.1)',
                  }}
                >
                  {newValueRaw ? 'On' : 'Off'}
                </button>
              ) : selectedSchema.type === 'select' ? (
                <select
                  value={newValueRaw}
                  onChange={(e) => setNewValueRaw(e.target.value)}
                  disabled={disabled}
                  style={inputStyleBase}
                >
                  <option value="">— Pick —</option>
                  {(selectedSchema.options || []).map((opt) => (
                    <option key={String(opt.value)} value={String(opt.value)}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  value={newValueRaw}
                  onChange={(e) => setNewValueRaw(e.target.value)}
                  min={selectedSchema.min}
                  max={selectedSchema.max}
                  step={selectedSchema.step || 1}
                  disabled={disabled}
                  style={inputStyleBase}
                />
              )}
              {selectedSchema.type === 'number' &&
                (selectedSchema.min !== undefined ||
                  selectedSchema.max !== undefined) && (
                  <div
                    style={{
                      fontSize: 10,
                      color: HOLO_COLORS.textMuted,
                      marginTop: 4,
                    }}
                  >
                    Range: {selectedSchema.min ?? '—'} to{' '}
                    {selectedSchema.max ?? '—'}
                    {selectedSchema.unit || ''}
                  </div>
                )}
            </div>
          </div>

          {selectedSchema.hint && (
            <div
              style={{
                fontSize: 11,
                color: HOLO_COLORS.textMuted,
                lineHeight: 1.4,
                marginBottom: 12,
                fontStyle: 'italic',
              }}
            >
              {selectedSchema.hint}
            </div>
          )}
        </>
      )}

      {validationError && (
        <div
          style={{
            fontSize: 11,
            color: HOLO_COLORS.red,
            marginBottom: 10,
          }}
        >
          {validationError}
        </div>
      )}

      {/* Actions */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          justifyContent: 'flex-end',
        }}
      >
        <button
          onClick={onCancel}
          disabled={disabled}
          style={{
            padding: '8px 14px',
            background: 'transparent',
            border: `1px solid ${HOLO_COLORS.borderSubtle}`,
            borderRadius: 8,
            color: HOLO_COLORS.textSecondary,
            fontSize: 12,
            fontWeight: 600,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleAdd}
          disabled={disabled || !selectedRuleId || !selectedField}
          style={{
            padding: '8px 14px',
            background:
              disabled || !selectedRuleId || !selectedField
                ? 'rgba(240, 199, 94, 0.2)'
                : TROPHY_GOLD,
            border: 'none',
            borderRadius: 8,
            color:
              disabled || !selectedRuleId || !selectedField
                ? TROPHY_GOLD
                : '#1a1200',
            fontSize: 12,
            fontWeight: 700,
            cursor:
              disabled || !selectedRuleId || !selectedField
                ? 'not-allowed'
                : 'pointer',
          }}
        >
          Add Change
        </button>
      </div>
    </div>
  );
}

// ─── Change row (read or edit) ───────────────────────────────

function ChangeRow({ change, index, onRemove, isOpen, disabled }) {
  const schema = getParamSchema(change.ruleId, change.field);
  const headline = getRuleHeadline(change.ruleId);
  const paramLabel = getParamLabel(change.ruleId, change.field);

  return (
    <div
      style={{
        background: 'rgba(240, 199, 94, 0.05)',
        border: `1px solid rgba(240, 199, 94, 0.25)`,
        borderRadius: 10,
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 8,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 10,
            color: HOLO_COLORS.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            marginBottom: 2,
          }}
        >
          Change {index + 1}
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: HOLO_COLORS.textPrimary,
          }}
        >
          <span
            style={{
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              color: TROPHY_GOLD,
            }}
          >
            {String(change.ruleId).toUpperCase()}
          </span>{' '}
          · {headline}
        </div>
        <div
          style={{
            fontSize: 12,
            color: HOLO_COLORS.textSecondary,
            marginTop: 2,
          }}
        >
          {paramLabel}:{' '}
          <span style={{ color: HOLO_COLORS.textPrimary }}>
            {formatParamValue(change.oldValue, schema)}
          </span>{' '}
          →{' '}
          <span style={{ color: TROPHY_GOLD, fontWeight: 700 }}>
            {formatParamValue(change.newValue, schema)}
          </span>
        </div>
      </div>
      {isOpen && (
        <button
          onClick={() => onRemove(index)}
          disabled={disabled}
          style={{
            padding: '6px 10px',
            background: 'transparent',
            border: `1px solid ${HOLO_COLORS.borderSubtle}`,
            borderRadius: 8,
            color: HOLO_COLORS.textSecondary,
            fontSize: 11,
            fontWeight: 600,
            cursor: disabled ? 'not-allowed' : 'pointer',
            flexShrink: 0,
          }}
        >
          Remove
        </button>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────

export default function PitStopChanges({
  entryId,
  week,
  changes,
  algorithmRules,
  isOpen,
  onRefreshPitStop,
}) {
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const list = Array.isArray(changes) ? changes : [];
  const atCap = list.length >= MAX_CHANGES;

  const writeChanges = async (nextList) => {
    setSaving(true);
    setError(null);
    try {
      const pitStopRef = doc(
        db,
        'seasonEntries',
        entryId,
        'pitStops',
        String(week),
      );
      await updateDoc(pitStopRef, {
        changes: nextList,
        changeCount: nextList.length,
        updatedAt: new Date().toISOString(),
      });
      if (onRefreshPitStop) {
        await onRefreshPitStop();
      }
    } catch (err) {
      console.error('[PitStopChanges] write failed', err);
      setError(err.message || 'Failed to update changes');
    } finally {
      setSaving(false);
    }
  };

  const handleAddChange = async (change) => {
    if (atCap) return;
    setAdding(false);
    await writeChanges([...list, change]);
  };

  const handleRemoveChange = async (index) => {
    const next = list.filter((_, i) => i !== index);
    await writeChanges(next);
  };

  return (
    <section
      style={{
        background: HOLO_COLORS.bgElevated,
        border: `1px solid ${HOLO_COLORS.borderSubtle}`,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 1,
            color: TROPHY_GOLD,
          }}
        >
          Algorithm Changes
        </span>
        <span
          style={{
            fontSize: 11,
            color: HOLO_COLORS.textSecondary,
          }}
        >
          {list.length} / {MAX_CHANGES}
        </span>
      </div>

      <p
        style={{
          fontSize: 12,
          color: HOLO_COLORS.textSecondary,
          lineHeight: 1.5,
          margin: '0 0 12px 0',
        }}
      >
        {isOpen
          ? `Tune up to ${MAX_CHANGES} rule parameters. Changes are validated and applied at lock-in.`
          : 'Changes queued for next week at lock-in.'}
      </p>

      {/* Existing changes */}
      {list.length === 0 && !adding && (
        <div
          style={{
            fontSize: 12,
            color: HOLO_COLORS.textMuted,
            fontStyle: 'italic',
            marginBottom: isOpen ? 12 : 0,
          }}
        >
          No changes queued.
        </div>
      )}

      {list.map((change, i) => (
        <ChangeRow
          key={`${change.ruleId}-${change.field}-${i}`}
          change={change}
          index={i}
          onRemove={handleRemoveChange}
          isOpen={isOpen}
          disabled={saving}
        />
      ))}

      {/* Add-change form */}
      {isOpen && adding && (
        <AddChangeForm
          algorithmRules={algorithmRules}
          onCancel={() => setAdding(false)}
          onSubmit={handleAddChange}
          disabled={saving}
        />
      )}

      {/* Add button */}
      {isOpen && !adding && !atCap && (
        <button
          onClick={() => setAdding(true)}
          disabled={saving}
          style={{
            marginTop: list.length > 0 ? 4 : 0,
            padding: '10px 14px',
            width: '100%',
            background: 'transparent',
            border: `1px dashed rgba(240, 199, 94, 0.4)`,
            borderRadius: 10,
            color: TROPHY_GOLD,
            fontSize: 12,
            fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer',
            letterSpacing: 0.3,
          }}
        >
          + Add Change
        </button>
      )}

      {isOpen && !adding && atCap && (
        <div
          style={{
            fontSize: 11,
            color: HOLO_COLORS.textMuted,
            fontStyle: 'italic',
            marginTop: 4,
          }}
        >
          Change limit reached. Remove one to queue another.
        </div>
      )}

      {error && (
        <div
          style={{
            fontSize: 11,
            color: HOLO_COLORS.red,
            marginTop: 10,
          }}
        >
          {error}
        </div>
      )}
    </section>
  );
}
