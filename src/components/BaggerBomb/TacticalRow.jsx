// TacticalRow - Sleeper-style side-by-side asset comparison row
// Displays player and opponent assets with ChamberFuse, badges, and proximity

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { HOLO_COLORS } from '../../constants/holoTheme';
import { PCT_SLIDE, THRESHOLD_HEAT } from '../../constants/animationTokens';
import ChamberFuse from './ChamberFuse';
import BadgeRow from './BadgeRow';
import ProximityLabel from './ProximityLabel';
import { computeProximity } from './computeProximity';
import DataStrike from '../shared/DataStrike';
// A2 (D-85): the row's price uses the SAME formatter the Why? panel two lines
// below uses for `Entry $` and `Bagger $ · Bust $` — `formatPrice` drops the
// thousands separator and disagreed above $1,000 (review L5-F6). Importing a
// copy string module from a shipped component is safe: the value is read only
// on the flag path and the module is pure.
import { BATTLE_VIEW_COPY } from '../../screens/battleView/battleViewCopy';
// A3.6 (D-97): the bagger moment's paint. Both are absent flag-off — the props
// below default to off and the row renders exactly as it ships. `cssVar` and
// `motionToken` rather than a hex and a literal: this file is on neither guard
// list, so the RULES (BUILD_RULES §10, §11) are what hold here, not a test.
import { cssVar } from '../../theme/cssTokens';
import { motionToken } from '../../theme/motion';

const DEFAULT_HISTORY = { maxMultiplier: 0, minMultiplier: 0 };

/**
 * The inputs ProximityLabel was always fed for a side, resolved with the same
 * defaults AssetSide destructures — so computing here is the same number the
 * label rendered before Phase A lifted the math (hazard 15: one call, one
 * number, shared by the label and the Why? panel).
 */
function proximityInputs(asset) {
  const priceChange = asset.priceChange === undefined ? 0 : asset.priceChange;
  return {
    priceChange: asset.thresholdPriceChange ?? priceChange,
    baseATR: asset.baseATR === undefined ? 2.5 : asset.baseATR,
    history: asset.history === undefined ? DEFAULT_HISTORY : asset.history,
    dailyLevels: asset.dailyLevels,
    currentPrice: asset.currentPrice,
  };
}

/**
 * AssetSide - One side of the tactical row (player or opponent)
 */
function AssetSide({
  asset,
  isRight = false,
  onThresholdCross,
  onSymbolClick,
  onPointsClick,
  highlighted = false,
  dimmed = false,
  onAssetSelect,
  // Phase A (Battle View controller): the precomputed proximity for this
  // side, and the Why? tap — LEFT side only, flag-gated by the screen (absent
  // flag-off, so nothing below renders differently).
  proximity = null,
  onWhy = null,
  whyOpen = false,
  whyLabel = null,
  // A4.3 (review F16): the button's accessible NAME (`Why? {symbol}`) and the
  // id root for the facts it is DESCRIBED by — the price change and the
  // proximity text keep reaching assistive tech as the description, while
  // the name stays short. Both absent flag-off.
  whyName = null,
  whyId = null,
  // Phase A2 (D-85): the piece's CURRENT PRICE beside its % change. Absent
  // flag-off and never passed to the opponent's side, so both the shipped
  // markup and the CPU column are untouched.
  showCurrentPrice = false,
}) {
  // Computed once per side when the row did not hand one down (the standalone
  // AssetSide path). Placed before the early returns so the hook order is the
  // same for every render of this side.
  // Keyed on the VALUES the label renders from — never on the asset object's
  // identity (A4 review, refuter C): the pre-lift label memoised on its
  // primitives, so a caller that mutates an asset in place must still see the
  // same number the row's % shows (BUILD_RULES §9). No in-repo caller mutates
  // an asset today; the contract is kept equal to the shipped one regardless.
  const ownProximity = useMemo(() => {
    if (proximity || !asset || asset.isCash) return null;
    return computeProximity(proximityInputs(asset));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proximity, !!asset, asset?.isCash, asset?.priceChange, asset?.thresholdPriceChange, asset?.baseATR, asset?.history, asset?.dailyLevels, asset?.currentPrice]);
  const resolvedProximity = proximity ?? ownProximity;

  if (!asset) {
    // Empty slot placeholder
    return (
      <div
        style={{
          flex: 1,
          padding: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: HOLO_COLORS.textMuted,
          fontSize: '12px',
          opacity: dimmed ? 0.4 : 1,
        }}
      >
        —
      </div>
    );
  }

  // V5: Cash position — dormant slot rendering
  if (asset.isCash) {
    return (
      <div
        onClick={() => {
          if (highlighted && onAssetSelect) onAssetSelect(asset);
        }}
        style={{
          flex: 1,
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          textAlign: isRight ? 'right' : 'left',
          opacity: 0.5,
          borderStyle: 'dashed',
          borderColor: HOLO_COLORS.borderSubtle,
          borderWidth: '1px',
          borderRadius: '8px',
          ...(highlighted ? {
            opacity: 0.8,
            borderColor: 'rgba(0, 217, 255, 0.4)',
            background: 'rgba(0, 217, 255, 0.05)',
            cursor: 'pointer',
          } : {}),
        }}
      >
        <div style={{ fontSize: '20px', textAlign: 'center' }}>💵</div>
        <div style={{
          fontSize: '13px',
          fontWeight: 700,
          color: HOLO_COLORS.textMuted,
          textAlign: 'center',
        }}>
          CASH
        </div>
        <div style={{
          fontSize: '11px',
          color: HOLO_COLORS.textMuted,
          textAlign: 'center',
        }}>
          0 pts
        </div>
        {asset.previousAsset && (
          <div style={{
            fontSize: '9px',
            color: HOLO_COLORS.textMuted,
            textAlign: 'center',
            fontStyle: 'italic',
          }}>
            Was: {asset.previousAsset}
          </div>
        )}
      </div>
    );
  }

  const {
    symbol,
    priceChange = 0,
    thresholdPriceChange,
    baseATR = 2.5,
    history = { maxMultiplier: 0, minMultiplier: 0 },
    points = 0,
    badges = [],
  } = asset;

  // Threshold heat: compute proximity ratio for radiance + text warming
  const thresholdHeat = useMemo(() => {
    const multiplier = baseATR > 0 ? priceChange / baseATR : 0;
    // Neutral zone: no heat when near zero
    if (Math.abs(multiplier) < THRESHOLD_HEAT.neutralZone) {
      return { proximityRatio: 1, direction: 'neutral' };
    }

    const positiveThresholds = [1.0, 1.5, 2.0];
    const negativeThresholds = [-1.0, -1.5, -2.0];
    const maxReached = history?.maxMultiplier || 0;
    const minReached = history?.minMultiplier || 0;

    if (multiplier > 0) {
      // Find nearest uncrossed positive threshold
      const target = positiveThresholds.find(t => maxReached < t);
      if (!target) return { proximityRatio: 1, direction: 'positive' }; // all crossed
      const distanceRemaining = target - multiplier;
      if (distanceRemaining <= 0) return { proximityRatio: 0, direction: 'positive' };
      const proximityRatio = distanceRemaining / target;
      return { proximityRatio, direction: 'positive' };
    } else {
      // Find nearest uncrossed negative threshold (more negative)
      const target = negativeThresholds.find(t => minReached > t);
      if (!target) return { proximityRatio: 1, direction: 'negative' }; // all crossed
      const distanceRemaining = multiplier - target; // both negative, result is positive
      if (distanceRemaining <= 0) return { proximityRatio: 0, direction: 'negative' };
      const proximityRatio = distanceRemaining / Math.abs(target);
      return { proximityRatio, direction: 'negative' };
    }
  }, [priceChange, baseATR, history]);

  // Compute radiance opacity from proximity ratio
  const radianceOpacity = useMemo(() => {
    const { proximityRatio } = thresholdHeat;
    if (proximityRatio > THRESHOLD_HEAT.triggerProximity) return 0;
    if (proximityRatio < THRESHOLD_HEAT.breathingProximity) return 1.0;
    // Linear interpolation: 0.25→0.10 maps to 0→0.8
    const range = THRESHOLD_HEAT.triggerProximity - THRESHOLD_HEAT.breathingProximity;
    return ((THRESHOLD_HEAT.triggerProximity - proximityRatio) / range) * 0.8;
  }, [thresholdHeat]);

  const isPositive = priceChange >= 0;
  const priceColor = priceChange === 0
    ? HOLO_COLORS.textMuted
    : isPositive
      ? HOLO_COLORS.green
      : HOLO_COLORS.red;

  // Why? — the left side is a piece the player can ask about (design brief
  // §5.1); the CPU side never opens. The symbol and points taps keep stopping
  // propagation, so they still open research / breakdown, not Why?.
  const whyEnabled = !isRight && typeof onWhy === 'function';

  // D-85's gate: under the flag, the PLAYER's side, and only when a real
  // price exists. The opponent's side never receives the prop (the screen
  // passes it to the left AssetSide alone) and the `!isRight` conjunct keeps
  // that true even if a future caller passes it to both.
  // `Number.isFinite` does not coerce, so it subsumes a `typeof` test — a
  // conjunct that cannot fail is not a guard (review L4-F10).
  const showPrice = showCurrentPrice
    && !isRight
    && Number.isFinite(asset.currentPrice)
    && asset.currentPrice > 0;

  const handleAssetClick = () => {
    if (highlighted && onAssetSelect) {
      onAssetSelect(asset);
      return;
    }
    if (whyEnabled) onWhy(asset, resolvedProximity);
  };

  const handleWhyKeyDown = whyEnabled ? (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onWhy(asset, resolvedProximity);
    }
  } : undefined;

  // A4.3: the inner symbol / points targets are pre-existing MOUSE-ONLY
  // divs (they stop propagation and stay out of the tab order); promoting
  // them to real buttons is a flag-off markup change that belongs to the
  // rows PR, not here. The row button is named for its verb and its piece,
  // and described by the facts it shows.
  const pctId = whyEnabled && whyId ? `${whyId}-pct` : undefined;
  const proximityId = whyEnabled && whyId ? `${whyId}-proximity` : undefined;
  const describedBy = pctId && proximityId ? `${pctId} ${proximityId}` : undefined;

  // One label element; under the flag it is wrapped so the row button can
  // be described by it (flag-off: the bare label, exactly as shipped).
  const proximityLabel = (
    <ProximityLabel
      priceChange={thresholdPriceChange ?? priceChange}
      baseATR={baseATR}
      history={history}
      dailyLevels={asset.dailyLevels}
      currentPrice={asset.currentPrice}
      size="small"
      align={isRight ? 'right' : 'left'}
      proximityRatio={thresholdHeat.proximityRatio}
      heatDirection={thresholdHeat.direction}
      proximity={resolvedProximity}
    />
  );

  return (
    <div
      onClick={handleAssetClick}
      {...(whyEnabled ? {
        role: 'button',
        tabIndex: 0,
        'aria-expanded': whyOpen ? 'true' : 'false',
        ...(whyName ? { 'aria-label': whyName } : {}),
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
        onKeyDown: handleWhyKeyDown,
      } : {})}
      style={{
        flex: 1,
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        textAlign: isRight ? 'right' : 'left',
        ...(whyEnabled ? { cursor: 'pointer' } : {}),
        ...(highlighted ? {
          border: '1px solid rgba(0, 217, 255, 0.4)',
          borderRadius: '8px',
          background: 'rgba(0, 217, 255, 0.05)',
          cursor: 'pointer',
        } : {}),
        ...(dimmed ? {
          opacity: 0.4,
          filter: 'grayscale(30%)',
          pointerEvents: 'none',
        } : {}),
      }}
    >
      {/* Top Row: Symbol + Points */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexDirection: isRight ? 'row-reverse' : 'row',
        }}
      >
        {/* Symbol and Price Change */}
        <div>
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (onSymbolClick) onSymbolClick(asset);
            }}
            style={{
              fontWeight: 700,
              fontSize: '14px',
              color: onSymbolClick ? '#14b8a6' : HOLO_COLORS.textPrimary,
              cursor: onSymbolClick ? 'pointer' : 'default',
              display: 'inline-block',
              padding: '2px 6px',
              margin: '-2px -6px',
              borderRadius: '4px',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (onSymbolClick) e.target.style.background = 'rgba(13, 148, 136, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'transparent';
            }}
          >
            {symbol}
            {/* V5: Direction badge for crypto */}
            {asset.isCrypto && asset.direction && (
              <span style={{
                fontSize: '9px',
                fontWeight: 700,
                color: asset.direction === 'short' ? HOLO_COLORS.red : HOLO_COLORS.green,
                backgroundColor: asset.direction === 'short'
                  ? `${HOLO_COLORS.red}15`
                  : `${HOLO_COLORS.green}15`,
                padding: '1px 5px',
                borderRadius: '4px',
                marginLeft: '4px',
                verticalAlign: 'middle',
                letterSpacing: '0.5px',
              }}>
                {asset.direction === 'short' ? 'SHORT ↓' : 'LONG ↑'}
              </span>
            )}
          </div>
          {(() => {
            const pctBlock = (
              <div {...(pctId ? { id: pctId } : {})} style={{ position: 'relative', height: '20px', overflow: 'hidden' }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${priceChange.toFixed(2)}`}
                    initial={{ opacity: 0, y: PCT_SLIDE.enterY }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: PCT_SLIDE.exitY }}
                    transition={{ duration: PCT_SLIDE.duration }}
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: priceColor,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {isPositive ? '▲' : '▼'} {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                  </motion.div>
                </AnimatePresence>
              </div>
            );
            // D-85 — the piece's current price, beside the percent that is
            // measured FROM it. Read off `asset.currentPrice`, the same field
            // `proximityInputs` hands `computeProximity` two lines above, so
            // `Bagger $ · Bust $` in the Why? panel and this number cannot
            // come from two prices (BUILD_RULES §9). No fetch, no second
            // source, no re-derivation.
            //
            // Absent when there is no live price to show — never `$0.00`,
            // which `formatPrice` would produce from a missing one.
            // The wrapper renders on the FLAG path whether or not a price is
            // ready (review L2-F10): a live price arriving turned the bare
            // block into a wrapped one, which remounts the AnimatePresence
            // percent and momentarily breaks the `aria-describedby` target.
            if (!showCurrentPrice || isRight) return pctBlock;
            return (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                {pctBlock}
                {showPrice && <span
                  data-row-price={asset.symbol}
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: HOLO_COLORS.textMuted,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {BATTLE_VIEW_COPY.price(asset.currentPrice)}
                </span>}
              </div>
            );
          })()}
        </div>

        {/* Points and Badges */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: isRight ? 'flex-start' : 'flex-end',
            gap: '4px',
          }}
        >
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (onPointsClick) onPointsClick(asset);
            }}
            style={{
              cursor: onPointsClick ? 'pointer' : 'default',
              padding: '4px 8px',
              margin: '-4px -8px',
              borderRadius: '6px',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              if (onPointsClick) e.target.style.background = 'rgba(255,255,255,0.1)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'transparent';
            }}
          >
            <DataStrike
              value={Math.round(points)}
              showSign
              size={20}
              color={HOLO_COLORS.textPrimary}
            />
          </div>
          <BadgeRow
            badges={badges}
            size="small"
            maxDisplay={3}
            align={isRight ? 'left' : 'right'}
          />
        </div>
      </div>

      {/* ChamberFuse + Leading-Edge Radiance */}
      <div style={{ position: 'relative' }}>
        <ChamberFuse
          priceChange={thresholdPriceChange ?? priceChange}
          baseATR={baseATR}
          history={history}
          compact
          showLabels={false}
          onThresholdCross={onThresholdCross}
        />
        {/* Leading-edge radiance — glows when approaching threshold */}
        {radianceOpacity > 0 && (
          <motion.div
            animate={{ opacity: radianceOpacity }}
            transition={{ duration: 0.5 }}
            style={{
              position: 'absolute',
              top: 0,
              [thresholdHeat.direction === 'negative' ? 'left' : 'right']: 0,
              width: `${THRESHOLD_HEAT.radianceWidth}px`,
              height: '100%',
              background: thresholdHeat.direction === 'negative'
                ? THRESHOLD_HEAT.radialGradientBust
                : THRESHOLD_HEAT.radialGradientBagger,
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
        )}
      </div>

      {/* Proximity Label — uses daily-relative threshold progress. Under the
          flag the label is wrapped once, so the row button can be described
          by it (A4.3); flag-off renders the bare label as before. */}
      {proximityId ? <div id={proximityId}>{proximityLabel}</div> : proximityLabel}

      {/* Why? — the piece's verb, visible and part of the button's name.
          Rendered only when the screen hands the label down (the controller
          flag); the string itself lives in the guarded copy module. */}
      {whyEnabled && whyLabel && (
        <span
          data-why-label="1"
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: '#14b8a6',
            opacity: whyOpen ? 1 : 0.8,
          }}
        >
          {whyLabel}
        </span>
      )}
    </div>
  );
}

AssetSide.propTypes = {
  asset: PropTypes.shape({
    symbol: PropTypes.string.isRequired,
    priceChange: PropTypes.number,
    baseATR: PropTypes.number,
    history: PropTypes.shape({
      maxMultiplier: PropTypes.number,
      minMultiplier: PropTypes.number,
    }),
    points: PropTypes.number,
    badges: PropTypes.arrayOf(PropTypes.string),
  }),
  isRight: PropTypes.bool,
  onThresholdCross: PropTypes.func,
  onSymbolClick: PropTypes.func,
  onPointsClick: PropTypes.func,
  highlighted: PropTypes.bool,
  dimmed: PropTypes.bool,
  onAssetSelect: PropTypes.func,
  proximity: PropTypes.object,
  onWhy: PropTypes.func,
  whyOpen: PropTypes.bool,
  whyLabel: PropTypes.string,
  whyName: PropTypes.string,
  whyId: PropTypes.string,
  showCurrentPrice: PropTypes.bool,
};

// Tier-specific badge colors
const TIER_BADGE_STYLES = {
  star:    { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.12)', label: '2×' },
  core:    { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', label: '1.5×' },
  support: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', label: '1×' },
};

/**
 * AllocationBadge - Center allocation indicator with tier-specific colors
 */
function AllocationBadge({ tier = 'support', isCrypto = false }) {
  const tierStyle = TIER_BADGE_STYLES[tier] || TIER_BADGE_STYLES.support;

  return (
    <div
      style={{
        width: '44px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          padding: '4px 8px',
          borderRadius: '8px',
          backgroundColor: tierStyle.bg,
          border: `1px solid ${tierStyle.color}40`,
          fontSize: '13px',
          fontWeight: 700,
          color: tierStyle.color,
          whiteSpace: 'nowrap',
        }}
      >
        {tierStyle.label}
      </div>
      {isCrypto && (
        <span style={{ fontSize: '10px', marginTop: '2px' }}>🔮</span>
      )}
    </div>
  );
}

AllocationBadge.propTypes = {
  tier: PropTypes.oneOf(['star', 'core', 'support']),
  isCrypto: PropTypes.bool,
};

/**
 * TacticalRow - Sleeper-style side-by-side asset comparison
 */
export default function TacticalRow({
  leftAsset,
  rightAsset,
  tier,
  allocationLabel = '10%',
  isCryptoSlot = false,
  onLeftThresholdCross,
  onRightThresholdCross,
  onSymbolClick,
  onPointsClick,
  // Swap target mode props
  swapTargetMode = false,
  onLeftAssetSelect,
  opponentDimmed = false,
  leftDisabled = false,
  // Phase A (Battle View controller) — Why? on the player's piece. All three
  // are absent flag-off, and the row then renders exactly as before.
  onWhy = null,
  whyOpen = false,
  renderWhy = null,
  whyLabel = null,
  whyName = null,
  whyId = null,
  // A2 (D-85): the player's current price on the row. Absent flag-off.
  showCurrentPrice = false,
  // A3.6 (D-97) — THE BAGGER MOMENT. Both absent flag-off.
  //
  // `baggerBurst` is an EVENT: true only for the moment's window, and the
  // screen never sets it under reduced motion, so "reduced motion renders the
  // footer with no burst" needs no branch here.
  //
  // `baggerFooter` is a FACT about persisted scoring, so it does not come and
  // go with the burst — a line that says `banked` must not depend on whether
  // this tab was open when the tick landed.
  baggerBurst = false,
  baggerFooter = null,
  reducedMotion = false,
}) {
  // The left side's proximity, computed ONCE here and handed to both the
  // label (through AssetSide) and the Why? panel — never derived twice beside
  // a rendered number (hazard 15). The right side computes its own in
  // AssetSide, once.
  const leftProximity = useMemo(() => {
    if (!leftAsset || leftAsset.isCash) return null;
    return computeProximity(proximityInputs(leftAsset));
  // Value-keyed, like the pre-lift label (see AssetSide's memo above).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!leftAsset, leftAsset?.isCash, leftAsset?.priceChange, leftAsset?.thresholdPriceChange, leftAsset?.baseATR, leftAsset?.history, leftAsset?.dailyLevels, leftAsset?.currentPrice]);

  return (
    <>
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        backgroundColor: 'rgba(22, 27, 34, 0.25)',
        borderBottom: `1px solid ${HOLO_COLORS.borderSubtle}`,
        minHeight: '120px',
        // The wash below needs a containing block, and ONLY while it exists:
        // adding this unconditionally would change the shipped row's inline
        // style, which the flag-off goldens photograph byte for byte.
        ...(baggerBurst ? { position: 'relative' } : {}),
      }}
    >
      {/* THE BURST (A3.6, D-97). One shot: a wash in the player's accent that
          fades to nothing and is then gone. It is `aria-hidden` and
          `pointer-events: none` — the news is in the footer and the bubble,
          both of which are text; this is only the thing that catches the eye.
          The seed's ceiling is 700 ms and the screen holds the window that
          long; the PAINT is `smooth` (300 ms) inside it, after which the wash
          sits at zero until the window closes. */}
      {baggerBurst && (
        <motion.div
          data-bagger-burst="1"
          aria-hidden="true"
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 0 }}
          transition={motionToken('smooth', { reducedMotion })}
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: `rgba(var(--ft-teal-rgb), 0.35)`,
          }}
        />
      )}
      {/* Left Asset (Player) */}
      <AssetSide
        asset={leftAsset}
        isRight={false}
        onThresholdCross={onLeftThresholdCross}
        onSymbolClick={onSymbolClick}
        onPointsClick={onPointsClick}
        highlighted={swapTargetMode && !leftDisabled}
        dimmed={leftDisabled}
        onAssetSelect={onLeftAssetSelect}
        proximity={leftProximity}
        onWhy={onWhy}
        whyOpen={whyOpen}
        whyLabel={whyLabel}
        whyName={whyName}
        whyId={whyId}
        showCurrentPrice={showCurrentPrice}
      />

      {/* Center Allocation Badge */}
      <AllocationBadge
        tier={tier}
        isCrypto={isCryptoSlot}
      />

      {/* Right Asset (Opponent) */}
      <AssetSide
        asset={rightAsset}
        isRight={true}
        onThresholdCross={onRightThresholdCross}
        onSymbolClick={onSymbolClick}
        onPointsClick={onPointsClick}
        dimmed={opponentDimmed}
      />
    </motion.div>
    {/* THE FOOTER (A3.6, D-97). Persisted scoring, so it stays — the burst is
        the event, this is the record of it. Beneath the row rather than inside
        a side, because it is about the player's piece and the row is where the
        player's piece is. */}
    {baggerFooter ? (
      <div
        data-bagger-footer="1"
        style={{
          padding: '5px 12px',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.06em',
          color: cssVar('teal'),
          background: `rgba(var(--ft-teal-rgb), 0.08)`,
          borderBottom: `1px solid ${HOLO_COLORS.borderSubtle}`,
        }}
      >
        {baggerFooter}
      </div>
    ) : null}
    {/* Why? — expands in place beneath the row, inside the tier map, with the
        SAME proximity the row just rendered. Absent flag-off. */}
    {renderWhy ? (
      <AnimatePresence initial={false}>
        {whyOpen ? renderWhy(leftProximity) : null}
      </AnimatePresence>
    ) : null}
    </>
  );
}

TacticalRow.propTypes = {
  leftAsset: PropTypes.shape({
    symbol: PropTypes.string.isRequired,
    priceChange: PropTypes.number,
    baseATR: PropTypes.number,
    history: PropTypes.shape({
      maxMultiplier: PropTypes.number,
      minMultiplier: PropTypes.number,
    }),
    points: PropTypes.number,
    badges: PropTypes.arrayOf(PropTypes.string),
  }),
  rightAsset: PropTypes.shape({
    symbol: PropTypes.string.isRequired,
    priceChange: PropTypes.number,
    baseATR: PropTypes.number,
    history: PropTypes.shape({
      maxMultiplier: PropTypes.number,
      minMultiplier: PropTypes.number,
    }),
    points: PropTypes.number,
    badges: PropTypes.arrayOf(PropTypes.string),
  }),
  tier: PropTypes.oneOf(['star', 'core', 'support']),
  allocationLabel: PropTypes.string,
  isCryptoSlot: PropTypes.bool,
  onLeftThresholdCross: PropTypes.func,
  onRightThresholdCross: PropTypes.func,
  onSymbolClick: PropTypes.func,
  onPointsClick: PropTypes.func,
  swapTargetMode: PropTypes.bool,
  onLeftAssetSelect: PropTypes.func,
  opponentDimmed: PropTypes.bool,
  leftDisabled: PropTypes.bool,
  onWhy: PropTypes.func,
  whyOpen: PropTypes.bool,
  renderWhy: PropTypes.func,
  whyLabel: PropTypes.string,
  whyName: PropTypes.string,
  whyId: PropTypes.string,
  showCurrentPrice: PropTypes.bool,
  baggerBurst: PropTypes.bool,
  baggerFooter: PropTypes.string,
  reducedMotion: PropTypes.bool,
};

TacticalRow.defaultProps = {
  leftAsset: null,
  rightAsset: null,
  tier: 'support',
  allocationLabel: '10%',
  isCryptoSlot: false,
  onLeftThresholdCross: null,
  onRightThresholdCross: null,
  onSymbolClick: null,
  onPointsClick: null,
  swapTargetMode: false,
  onLeftAssetSelect: null,
  opponentDimmed: false,
  leftDisabled: false,
};

// Export sub-components for flexibility
export { AssetSide, AllocationBadge };
