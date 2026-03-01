// /src/components/Research/MoneyMap/HeatmapView.jsx
// D3 treemap heatmap visualization for Money Map sectors

import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { treemap, hierarchy, treemapSquarify } from 'd3-hierarchy';
import { scaleLinear } from 'd3-scale';
import { HOLO_COLORS } from '../../../constants/holoTheme';

// Color scale: red (bearish) → neutral → green (bullish)
const colorScale = scaleLinear()
  .domain([-5, -2, 0, 2, 5])
  .range(['#ff1744', '#ff5252', '#1a2332', '#4caf50', '#00e676'])
  .clamp(true);

/**
 * HeatmapView — D3 treemap showing sector/stock tiles colored by performance
 *
 * @param {Object}   props.sectors    - Object keyed by sectorId
 * @param {Object}   props.global     - Global market data
 * @param {function} props.onSectorTap - (sectorId) => void
 * @param {function} props.onStockTap  - (symbol) => void
 * @param {boolean}  props.compact     - Use compact height (mobile)
 */
const HeatmapView = ({ sectors, global, onSectorTap, onStockTap, compact }) => {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredTile, setHoveredTile] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Count total stock tiles for dynamic height
  const totalTiles = useMemo(() => {
    return Object.values(sectors || {}).reduce(
      (sum, s) => sum + (s.leaders?.length || 0), 0
    );
  }, [sectors]);

  // Measure container width, compute height dynamically
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.floor(rect.width);
      // Each tile needs ~40x40px minimum area (1600px²) plus ~20px header per sector
      const sectorCount = Object.values(sectors || {}).filter(s => s.leaders?.length > 0).length;
      const tileArea = totalTiles * 1600;
      const headerArea = sectorCount * 20 * w;
      const rawHeight = (tileArea + headerArea) / Math.max(w, 1);
      // Clamp between reasonable bounds
      const minH = compact ? 280 : 350;
      const maxH = compact ? 500 : 650;
      const h = Math.round(Math.max(minH, Math.min(maxH, rawHeight)));
      setDimensions({ width: w, height: h });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [compact, totalTiles, sectors]);

  // Build hierarchy data from sectors object
  const treeData = useMemo(() => {
    const sectorArray = Object.entries(sectors || {}).map(([id, s]) => ({
      ...s,
      sectorId: id,
    }));

    return {
      name: 'market',
      children: sectorArray
        .map(sector => ({
          name: sector.name,
          sectorId: sector.sectorId,
          sectorColor: sector.sectorColor,
          quadrant: sector.quadrant?.quadrant,
          gildedCage: sector.gildedCage?.detected,
          children: (sector.leaders || []).map(leader => ({
            name: leader.symbol,
            symbol: leader.symbol,
            sectorId: sector.sectorId,
            sectorName: sector.name,
            value: 1, // Equal weight
            // Use sector-level 1W performance for color (MVP)
            change: sector.performance?.week1 || 0,
          })),
        }))
        .filter(s => s.children.length > 0),
    };
  }, [sectors]);

  // Compute treemap layout
  const layoutNodes = useMemo(() => {
    const { width, height } = dimensions;
    if (!width || !height || !treeData.children?.length) return null;

    const root = hierarchy(treeData)
      .sum(d => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    treemap()
      .size([width, height])
      .tile(treemapSquarify)
      .paddingOuter(3)
      .paddingInner(2)
      .paddingTop(20)(root);

    return root;
  }, [treeData, dimensions]);

  const handleTileHover = useCallback((e, node) => {
    if (!node.data.symbol) return;
    const svgRect = containerRef.current?.getBoundingClientRect();
    if (!svgRect) return;
    setHoveredTile(node.data);
    setTooltipPos({
      x: e.clientX - svgRect.left,
      y: e.clientY - svgRect.top - 10,
    });
  }, []);

  const handleTileLeave = useCallback(() => {
    setHoveredTile(null);
  }, []);

  const handleTileClick = useCallback((e, node) => {
    e.stopPropagation();
    if (node.data.symbol) {
      onStockTap?.(node.data.symbol);
    }
  }, [onStockTap]);

  const handleSectorClick = useCallback((e, node) => {
    e.stopPropagation();
    if (node.data.sectorId) {
      onSectorTap?.(node.data.sectorId);
    }
  }, [onSectorTap]);

  if (!dimensions.width) {
    return (
      <div ref={containerRef} style={{ width: '100%', minHeight: compact ? 280 : 350 }} />
    );
  }

  if (!layoutNodes || !layoutNodes.children?.length) {
    return (
      <div ref={containerRef} style={{
        width: '100%',
        height: compact ? 280 : 350,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: HOLO_COLORS.bgCard,
        borderRadius: '12px',
        border: `1px solid ${HOLO_COLORS.borderSubtle}`,
      }}>
        <span style={{ color: HOLO_COLORS.textSecondary, fontSize: '13px' }}>
          No sector data for heatmap
        </span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        position: 'relative',
        borderRadius: '12px',
        overflow: 'hidden',
        border: `1px solid ${HOLO_COLORS.borderSubtle}`,
        background: HOLO_COLORS.bgDeep,
      }}
    >
      <svg
        width={dimensions.width}
        height={dimensions.height}
        style={{ display: 'block' }}
      >
        {/* Sector groups */}
        {layoutNodes.children.map(sectorNode => {
          const sx = sectorNode.x0;
          const sy = sectorNode.y0;
          const sw = sectorNode.x1 - sectorNode.x0;
          const sh = sectorNode.y1 - sectorNode.y0;
          const showSectorLabel = sw > 50 && sh > 24;

          return (
            <g key={sectorNode.data.sectorId}>
              {/* Sector background */}
              <rect
                x={sx}
                y={sy}
                width={sw}
                height={sh}
                fill={HOLO_COLORS.bgCard}
                rx={4}
                style={{ cursor: 'pointer' }}
                onClick={(e) => handleSectorClick(e, sectorNode)}
              />

              {/* Sector label */}
              {showSectorLabel && (
                <text
                  x={sx + 6}
                  y={sy + 14}
                  fill={sectorNode.data.sectorColor || HOLO_COLORS.textSecondary}
                  fontSize="10"
                  fontWeight="700"
                  fontFamily="inherit"
                  style={{ pointerEvents: 'none', textTransform: 'uppercase' }}
                >
                  {sectorNode.data.name}
                  {sectorNode.data.gildedCage && ' \u26A0'}
                </text>
              )}

              {/* Stock tiles within sector */}
              {(sectorNode.children || []).map(stockNode => {
                const x = stockNode.x0;
                const y = stockNode.y0;
                const w = stockNode.x1 - stockNode.x0;
                const h = stockNode.y1 - stockNode.y0;
                const change = stockNode.data.change || 0;
                const color = colorScale(change);
                const showLabel = w > 35 && h > 20;
                const showChange = w > 45 && h > 32;
                const isHovered = hoveredTile?.symbol === stockNode.data.symbol;

                return (
                  <g
                    key={stockNode.data.symbol}
                    onClick={(e) => handleTileClick(e, stockNode)}
                    onMouseEnter={(e) => handleTileHover(e, stockNode)}
                    onMouseMove={(e) => handleTileHover(e, stockNode)}
                    onMouseLeave={handleTileLeave}
                    style={{ cursor: 'pointer' }}
                  >
                    <rect
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      fill={color}
                      rx={2}
                      stroke={isHovered ? HOLO_COLORS.cyan : 'transparent'}
                      strokeWidth={isHovered ? 1.5 : 0}
                      opacity={isHovered ? 1 : 0.85}
                    />
                    {showLabel && (
                      <text
                        x={x + w / 2}
                        y={y + (showChange ? h / 2 - 3 : h / 2 + 1)}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#ffffff"
                        fontSize={w > 55 ? '11' : '9'}
                        fontWeight="700"
                        fontFamily="inherit"
                        style={{ pointerEvents: 'none' }}
                      >
                        {stockNode.data.symbol}
                      </text>
                    )}
                    {showChange && (
                      <text
                        x={x + w / 2}
                        y={y + h / 2 + 11}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="rgba(255,255,255,0.7)"
                        fontSize="8"
                        fontFamily="inherit"
                        style={{ pointerEvents: 'none' }}
                      >
                        {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoveredTile && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(tooltipPos.x, dimensions.width - 140),
            top: Math.max(tooltipPos.y - 40, 0),
            background: 'rgba(13, 17, 23, 0.95)',
            border: `1px solid ${HOLO_COLORS.borderGlow}`,
            borderRadius: '6px',
            padding: '6px 10px',
            pointerEvents: 'none',
            zIndex: 10,
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: '700',
          }}>
            {hoveredTile.symbol}
          </div>
          <div style={{
            color: hoveredTile.change >= 0 ? '#4caf50' : '#ff5252',
            fontSize: '11px',
          }}>
            {hoveredTile.change >= 0 ? '+' : ''}{hoveredTile.change.toFixed(1)}% (1W)
          </div>
          <div style={{
            color: HOLO_COLORS.textMuted,
            fontSize: '10px',
          }}>
            {hoveredTile.sectorName}
          </div>
        </div>
      )}

    </div>
  );
};

export default HeatmapView;
