import React, { useState, useRef, useEffect } from 'react';
import { Eye, Brain, Shield } from 'lucide-react';
import { getRuleRelationships } from '../../data/ruleRelationships';
import { TRAIT_BY_ID } from '../../data/traitLibrary';
import { DNA_GROUPS } from '../../data/dnaGroups';

const DNA_ICONS = {
  instincts: Eye,
  strategy: Brain,
  discipline: Shield,
};

const sectionLabelStyle = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 1,
  color: '#718096',
  marginBottom: 10,
};

const chipStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 10px',
  borderRadius: 6,
  backgroundColor: '#1C1A27',
  fontSize: 12,
  color: '#E2E8F0',
  cursor: 'pointer',
  position: 'relative',
  transition: 'filter 0.15s',
  border: 'none',
  fontFamily: 'inherit',
};

function Popover({ children, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        marginTop: 6,
        backgroundColor: '#15171E',
        border: '1px solid #2A2D35',
        borderRadius: 8,
        padding: '10px 14px',
        zIndex: 20,
        minWidth: 200,
        maxWidth: 280,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      }}
    >
      {children}
    </div>
  );
}

function TraitChip({ trait, onJumpToForge }) {
  const [showPopover, setShowPopover] = useState(false);
  const groupColor = DNA_GROUPS[trait.dnaGroup]?.color || '#5EEAD4';
  const Icon = DNA_ICONS[trait.dnaGroup] || Eye;
  const fullTrait = TRAIT_BY_ID[trait.id];

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={() => setShowPopover(!showPopover)}
        style={{
          ...chipStyle,
          borderLeft: `3px solid ${groupColor}`,
        }}
        onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.2)'; }}
        onMouseLeave={e => { e.currentTarget.style.filter = 'brightness(1)'; }}
      >
        <Icon size={12} color={groupColor} />
        {trait.name}
      </button>

      {showPopover && (
        <Popover onClose={() => setShowPopover(false)}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0', marginBottom: 4 }}>
            {trait.name}
          </div>
          {fullTrait?.identityStatement && (
            <div style={{ fontSize: 12, color: '#A0AEC0', marginBottom: 10, lineHeight: 1.4 }}>
              {fullTrait.identityStatement}
            </div>
          )}
          {onJumpToForge && (
            <button
              onClick={() => {
                onJumpToForge(trait.id);
                setShowPopover(false);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#5EEAD4',
                fontSize: 12,
                cursor: 'pointer',
                padding: 0,
                fontFamily: 'inherit',
              }}
            >
              Jump to Forge to Equip
            </button>
          )}
        </Popover>
      )}
    </div>
  );
}

function CollectionChip({ collection }) {
  const [showPopover, setShowPopover] = useState(false);

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={() => setShowPopover(!showPopover)}
        style={{
          ...chipStyle,
          borderLeft: `3px solid ${collection.accentColor}`,
        }}
        onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.2)'; }}
        onMouseLeave={e => { e.currentTarget.style.filter = 'brightness(1)'; }}
      >
        <span style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: collection.accentColor,
          flexShrink: 0,
        }} />
        {collection.title}
      </button>

      {showPopover && (
        <Popover onClose={() => setShowPopover(false)}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0', marginBottom: 4 }}>
            {collection.title}
          </div>
          <div style={{ fontSize: 12, color: '#718096' }}>
            Collection
          </div>
        </Popover>
      )}
    </div>
  );
}

export default function FoundInChips({ ruleId, onJumpToForge }) {
  const { traits, collections } = getRuleRelationships(ruleId);

  if (traits.length === 0 && collections.length === 0) {
    return (
      <div style={{ marginTop: 20 }}>
        <div style={sectionLabelStyle}>FOUND IN</div>
        <div style={{ fontSize: 12, color: '#718096', fontStyle: 'italic' }}>
          This rule is not part of any trait or collection.
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div style={sectionLabelStyle}>FOUND IN</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {traits.map(trait => (
          <TraitChip key={trait.id} trait={trait} onJumpToForge={onJumpToForge} />
        ))}
        {collections.map(col => (
          <CollectionChip key={col.id} collection={col} />
        ))}
      </div>
    </div>
  );
}
