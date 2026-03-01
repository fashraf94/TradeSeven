// scripts/refresh-helpers.js
// Utility functions for the earnings refresh pipeline
// No external API calls — pure data parsing and transformation

import { STOCK_DATA } from '../src/data/stockIntelligenceData.js';

// =============================================================================
// STOCK_META — duplicated from buildStockData.js (which is CJS, can't import)
// =============================================================================

export const STOCK_META = {
  NVDA: {
    name: 'NVIDIA Corporation', shortName: 'NVIDIA', sector: 'Semiconductors', fyEnd: 'Late January',
    // Fiscal year ends late January: Jan=Q4, Apr=Q1, Jul=Q2, Oct=Q3
    fiscalQMap: { 1: { q: 'Q4', fyOffset: 0 }, 2: { q: 'Q4', fyOffset: 0 }, 4: { q: 'Q1', fyOffset: 1 }, 5: { q: 'Q1', fyOffset: 1 }, 7: { q: 'Q2', fyOffset: 1 }, 8: { q: 'Q2', fyOffset: 1 }, 10: { q: 'Q3', fyOffset: 1 }, 11: { q: 'Q3', fyOffset: 1 } },
  },
  AAPL: {
    name: 'Apple Inc.', shortName: 'Apple', sector: 'Consumer Electronics', fyEnd: 'Late September',
    // Fiscal year ends late Sep: Sep=Q4, Dec=Q1, Mar=Q2, Jun=Q3
    fiscalQMap: { 9: { q: 'Q4', fyOffset: 0 }, 10: { q: 'Q4', fyOffset: 0 }, 12: { q: 'Q1', fyOffset: 1 }, 1: { q: 'Q1', fyOffset: 0 }, 3: { q: 'Q2', fyOffset: 0 }, 4: { q: 'Q2', fyOffset: 0 }, 6: { q: 'Q3', fyOffset: 0 }, 7: { q: 'Q3', fyOffset: 0 } },
  },
  MSFT: {
    name: 'Microsoft Corporation', shortName: 'Microsoft', sector: 'Software / Cloud', fyEnd: 'June 30',
    // Fiscal year ends Jun 30: Jun=Q4, Sep=Q1, Dec=Q2, Mar=Q3
    fiscalQMap: { 6: { q: 'Q4', fyOffset: 0 }, 9: { q: 'Q1', fyOffset: 1 }, 10: { q: 'Q1', fyOffset: 1 }, 12: { q: 'Q2', fyOffset: 1 }, 1: { q: 'Q2', fyOffset: 0 }, 3: { q: 'Q3', fyOffset: 0 }, 4: { q: 'Q3', fyOffset: 0 } },
  },
  AMZN: {
    name: 'Amazon.com Inc.', shortName: 'Amazon', sector: 'E-Commerce / Cloud', fyEnd: 'December 31',
    fiscalQMap: { 3: { q: 'Q1', fyOffset: 0 }, 6: { q: 'Q2', fyOffset: 0 }, 9: { q: 'Q3', fyOffset: 0 }, 12: { q: 'Q4', fyOffset: 0 } },
  },
  META: {
    name: 'Meta Platforms Inc.', shortName: 'Meta', sector: 'Social Media / Advertising', fyEnd: 'December 31',
    fiscalQMap: { 3: { q: 'Q1', fyOffset: 0 }, 6: { q: 'Q2', fyOffset: 0 }, 9: { q: 'Q3', fyOffset: 0 }, 12: { q: 'Q4', fyOffset: 0 } },
  },
  GOOGL: {
    name: 'Alphabet Inc.', shortName: 'Alphabet', sector: 'Search / Cloud', fyEnd: 'December 31',
    fiscalQMap: { 3: { q: 'Q1', fyOffset: 0 }, 6: { q: 'Q2', fyOffset: 0 }, 9: { q: 'Q3', fyOffset: 0 }, 12: { q: 'Q4', fyOffset: 0 } },
  },
  TSLA: {
    name: 'Tesla Inc.', shortName: 'Tesla', sector: 'Automotive / Energy', fyEnd: 'December 31',
    fiscalQMap: { 3: { q: 'Q1', fyOffset: 0 }, 6: { q: 'Q2', fyOffset: 0 }, 9: { q: 'Q3', fyOffset: 0 }, 12: { q: 'Q4', fyOffset: 0 } },
  },
  AMD: {
    name: 'Advanced Micro Devices Inc.', shortName: 'AMD', sector: 'Semiconductors', fyEnd: 'Late December',
    fiscalQMap: { 3: { q: 'Q1', fyOffset: 0 }, 6: { q: 'Q2', fyOffset: 0 }, 9: { q: 'Q3', fyOffset: 0 }, 12: { q: 'Q4', fyOffset: 0 } },
  },
  AVGO: {
    name: 'Broadcom Inc.', shortName: 'Broadcom', sector: 'Semiconductors / Software', fyEnd: 'Early November',
    // Fiscal year ends early Nov: Nov=Q4, Feb=Q1, May=Q2, Aug=Q3
    fiscalQMap: { 11: { q: 'Q4', fyOffset: 0 }, 2: { q: 'Q1', fyOffset: 0 }, 3: { q: 'Q1', fyOffset: 0 }, 5: { q: 'Q2', fyOffset: 0 }, 6: { q: 'Q2', fyOffset: 0 }, 8: { q: 'Q3', fyOffset: 0 }, 9: { q: 'Q3', fyOffset: 0 } },
  },
  SNOW: {
    name: 'Snowflake Inc.', shortName: 'Snowflake', sector: 'Cloud Data Platform', fyEnd: 'January 31',
    // Fiscal year ends Jan 31: Jan=Q4, Apr=Q1, Jul=Q2, Oct=Q3
    fiscalQMap: { 1: { q: 'Q4', fyOffset: 0 }, 2: { q: 'Q4', fyOffset: 0 }, 4: { q: 'Q1', fyOffset: 1 }, 5: { q: 'Q1', fyOffset: 1 }, 7: { q: 'Q2', fyOffset: 1 }, 8: { q: 'Q2', fyOffset: 1 }, 10: { q: 'Q3', fyOffset: 1 }, 11: { q: 'Q3', fyOffset: 1 } },
  },
};

// =============================================================================
// findKnowledgePackage
// =============================================================================

export function findKnowledgePackage(ticker) {
  return STOCK_DATA[ticker]?.knowledgePackage || null;
}

// =============================================================================
// parseKnowledgePackage
// =============================================================================

export function parseKnowledgePackage(markdownContent) {
  if (!markdownContent) return null;

  const result = {
    header: '',
    lastUpdated: null,
    dataThroughQuarter: null,
    dataThroughDate: null,
    sections: {},
    dataTable: null,
    trendDynamics: '',
  };

  // Parse header metadata: "## Last Updated: February 2026 | Data Through: Q3 FY2026 (ended October 26, 2025)"
  const headerMatch = markdownContent.match(/## Last Updated:\s*(.+?)\s*\|\s*Data Through:\s*(.+?)(?:\s*\(ended\s*(.+?)\))?\s*\n/);
  if (headerMatch) {
    result.lastUpdated = headerMatch[1].trim();
    result.dataThroughQuarter = headerMatch[2].trim();
    result.dataThroughDate = headerMatch[3]?.trim() || null;
  }

  // Split into sections on ## headers
  const sectionBlocks = markdownContent.split(/\n## /);
  result.header = sectionBlocks[0] || '';

  const sectionNameMap = {
    'COMPANY IDENTITY': 'companyIdentity',
    'REVENUE ARCHITECTURE': 'revenueArchitecture',
    'GEOGRAPHIC EXPOSURE': 'geographicExposure',
    'FINANCIAL HEALTH': 'financialHealth',
    'COMPETITIVE POSITION': 'competitivePosition',
    'MANAGEMENT SIGNALS': 'managementSignals',
    'QUALITATIVE INTELLIGENCE': 'qualitativeIntelligence',
    'CROSS-COMPANY CONNECTIONS': 'crossCompanyConnections',
    '8-QUARTER FINANCIAL TRENDS': 'financialTrends',
  };

  for (let i = 1; i < sectionBlocks.length; i++) {
    const block = sectionBlocks[i];
    const firstLine = block.split('\n')[0].trim();

    for (const [key, field] of Object.entries(sectionNameMap)) {
      if (firstLine.toUpperCase().includes(key)) {
        result.sections[field] = block;
        break;
      }
    }
  }

  // Extract data table and trend dynamics from financialTrends section
  if (result.sections.financialTrends) {
    result.dataTable = extractDataTable(markdownContent);

    const trendMatch = result.sections.financialTrends.match(/### Key Trend Dynamics\s*\n([\s\S]*)/);
    if (trendMatch) {
      result.trendDynamics = trendMatch[1].trim();
    }
  }

  return result;
}

// =============================================================================
// extractDataTable
// =============================================================================

export function extractDataTable(markdownContent) {
  if (!markdownContent) return null;

  // Find the table section
  const tableStart = markdownContent.indexOf('### Quarterly Data Table');
  if (tableStart === -1) return null;

  const afterHeader = markdownContent.slice(tableStart);
  const lines = afterHeader.split('\n').filter(l => l.trim());

  // Find the pipe-delimited table rows
  const tableLines = [];
  let foundTable = false;
  for (const line of lines) {
    if (line.trim().startsWith('|')) {
      foundTable = true;
      tableLines.push(line.trim());
    } else if (foundTable) {
      break; // End of table
    }
  }

  if (tableLines.length < 3) return null; // Need header + separator + at least 1 row

  // Parse header row
  const headers = tableLines[0]
    .split('|')
    .map(h => h.trim())
    .filter(h => h.length > 0);

  // Skip separator row (index 1), parse data rows
  const rows = [];
  for (let i = 2; i < tableLines.length; i++) {
    const cells = tableLines[i]
      .split('|')
      .map(c => c.trim())
      .filter(c => c.length > 0);

    if (cells.length >= 2) {
      rows.push({
        metric: cells[0],
        values: cells.slice(1),
      });
    }
  }

  return { headers, rows };
}

// =============================================================================
// diffMetrics
// =============================================================================

function parseNumeric(val) {
  if (!val || val === 'N/D' || val === 'Pending') return null;
  // Remove commas, %, $ signs and parse
  const cleaned = val.replace(/[,%$]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

const SIGNIFICANT_METRICS = [
  'total revenue', 'revenue', 'gross margin', 'operating margin',
  'data center revenue', 'net income', 'eps', 'fcf', 'free cash flow',
  'guidance', 'r&d',
];

export function diffMetrics(oldTable, newTable) {
  if (!oldTable || !newTable) return { changes: [] };

  const changes = [];

  // Compare the last column of each table (most recent quarter)
  for (const newRow of newTable.rows) {
    const oldRow = oldTable.rows.find(r =>
      r.metric.toLowerCase().trim() === newRow.metric.toLowerCase().trim()
    );

    if (!oldRow) {
      changes.push({
        metric: newRow.metric,
        oldValue: 'N/A (new metric)',
        newValue: newRow.values[newRow.values.length - 1],
        pctChange: null,
        significant: true,
      });
      continue;
    }

    const oldVal = parseNumeric(oldRow.values[oldRow.values.length - 1]);
    const newVal = parseNumeric(newRow.values[newRow.values.length - 1]);

    if (oldVal === null || newVal === null) continue;
    if (oldVal === 0 && newVal === 0) continue;

    const pctChange = oldVal !== 0
      ? ((newVal - oldVal) / Math.abs(oldVal)) * 100
      : (newVal !== 0 ? 100 : 0);

    const isSignificantMetric = SIGNIFICANT_METRICS.some(m =>
      newRow.metric.toLowerCase().includes(m)
    );
    const significant = Math.abs(pctChange) > 5 || isSignificantMetric;

    if (Math.abs(pctChange) > 0.1) { // Skip negligible changes
      changes.push({
        metric: newRow.metric,
        oldValue: oldRow.values[oldRow.values.length - 1],
        newValue: newRow.values[newRow.values.length - 1],
        pctChange: Math.round(pctChange * 10) / 10,
        significant,
      });
    }
  }

  return { changes };
}

// =============================================================================
// calendarDateToFiscalQuarter
// =============================================================================

export function calendarDateToFiscalQuarter(dateStr, ticker) {
  const meta = STOCK_META[ticker];
  if (!meta?.fiscalQMap) return dateStr;

  const d = new Date(dateStr);
  const month = d.getMonth() + 1; // 1-based
  const calendarYear = d.getFullYear();

  // Find the closest matching month in fiscalQMap
  const mapping = meta.fiscalQMap[month];
  if (!mapping) {
    // Try nearby months (EODHD dates may not land exactly on fiscal quarter end months)
    for (let offset = -1; offset <= 1; offset++) {
      const tryMonth = ((month - 1 + offset + 12) % 12) + 1;
      if (meta.fiscalQMap[tryMonth]) {
        const m = meta.fiscalQMap[tryMonth];
        const fy = calendarYear + m.fyOffset;
        return `${m.q} FY${String(fy).slice(-2)}`;
      }
    }
    return `${dateStr}`;
  }

  const fy = calendarYear + mapping.fyOffset;
  return `${mapping.q} FY${String(fy).slice(-2)}`;
}

// =============================================================================
// formatEodhdToTable
// =============================================================================

export function formatEodhdToTable(eodhdData, ticker) {
  if (!eodhdData?.Financials) return { table: null, markdown: '*EODHD data unavailable*' };

  const incomeQ = eodhdData.Financials?.Income_Statement?.quarterly || {};
  const cashFlowQ = eodhdData.Financials?.Cash_Flow?.quarterly || {};
  const balanceQ = eodhdData.Financials?.Balance_Sheet?.quarterly || {};

  // Get sorted quarterly dates (most recent first), take 8
  const incomeDates = Object.keys(incomeQ).sort((a, b) => new Date(b) - new Date(a)).slice(0, 8).reverse();
  if (incomeDates.length === 0) return { table: null, markdown: '*No EODHD quarterly data found*' };

  const fmt = (val) => {
    if (val === null || val === undefined || val === 'None') return 'N/D';
    const num = parseFloat(val);
    if (isNaN(num)) return 'N/D';
    return Math.round(num / 1_000_000).toLocaleString();
  };

  const pct = (num, denom) => {
    const n = parseFloat(num);
    const d = parseFloat(denom);
    if (isNaN(n) || isNaN(d) || d === 0) return 'N/D';
    return `${(n / d * 100).toFixed(1)}%`;
  };

  // Build headers with fiscal quarter labels
  const headers = ['Metric', ...incomeDates.map(d => calendarDateToFiscalQuarter(d, ticker))];

  // Build metric rows
  const metrics = [
    {
      name: 'Total Revenue ($M)',
      values: incomeDates.map(d => fmt(incomeQ[d]?.totalRevenue)),
    },
    {
      name: 'Gross Profit ($M)',
      values: incomeDates.map(d => fmt(incomeQ[d]?.grossProfit)),
    },
    {
      name: 'GAAP Gross Margin (%)',
      values: incomeDates.map(d => pct(incomeQ[d]?.grossProfit, incomeQ[d]?.totalRevenue)),
    },
    {
      name: 'Operating Income ($M)',
      values: incomeDates.map(d => fmt(incomeQ[d]?.operatingIncome)),
    },
    {
      name: 'Net Income ($M)',
      values: incomeDates.map(d => fmt(incomeQ[d]?.netIncome)),
    },
    {
      name: 'R&D Spending ($M)',
      values: incomeDates.map(d => fmt(incomeQ[d]?.researchDevelopment)),
    },
    {
      name: 'R&D as % of Revenue (%)',
      values: incomeDates.map(d => pct(incomeQ[d]?.researchDevelopment, incomeQ[d]?.totalRevenue)),
    },
    {
      name: 'OCF ($M)',
      values: incomeDates.map(d => {
        const cf = cashFlowQ[d];
        return cf ? fmt(cf.totalCashFromOperatingActivities) : 'N/D';
      }),
    },
    {
      name: 'CapEx ($M)',
      values: incomeDates.map(d => {
        const cf = cashFlowQ[d];
        if (!cf || cf.capitalExpenditures === null || cf.capitalExpenditures === undefined) return 'N/D';
        const val = parseFloat(cf.capitalExpenditures);
        if (isNaN(val)) return 'N/D';
        // EODHD reports CapEx as negative; show as positive
        return Math.round(Math.abs(val) / 1_000_000).toLocaleString();
      }),
    },
    {
      name: 'FCF ($M)',
      values: incomeDates.map(d => {
        const cf = cashFlowQ[d];
        if (!cf) return 'N/D';
        const ocf = parseFloat(cf.totalCashFromOperatingActivities);
        const capex = parseFloat(cf.capitalExpenditures);
        if (isNaN(ocf) || isNaN(capex)) return 'N/D';
        return Math.round((ocf - Math.abs(capex)) / 1_000_000).toLocaleString();
      }),
    },
    {
      name: 'Cash & Equivalents ($M)',
      values: incomeDates.map(d => {
        const bs = balanceQ[d];
        return bs ? fmt(bs.cash) : 'N/D';
      }),
    },
    {
      name: 'Total Debt ($M)',
      values: incomeDates.map(d => {
        const bs = balanceQ[d];
        if (!bs) return 'N/D';
        const longDebt = parseFloat(bs.longTermDebt || 0);
        const shortDebt = parseFloat(bs.shortTermDebt || bs.shortLongTermDebt || 0);
        if (isNaN(longDebt) && isNaN(shortDebt)) return 'N/D';
        return Math.round(((longDebt || 0) + (shortDebt || 0)) / 1_000_000).toLocaleString();
      }),
    },
  ];

  // Build markdown table
  const headerRow = `| ${headers.join(' | ')} |`;
  const sepRow = `|${headers.map(() => '--------').join('|')}|`;
  const dataRows = metrics.map(m => `| ${m.name} | ${m.values.join(' | ')} |`);
  const markdown = [headerRow, sepRow, ...dataRows].join('\n');

  // Build structured table for diffMetrics
  const table = {
    headers,
    rows: metrics.map(m => ({ metric: m.name, values: m.values })),
  };

  return { table, markdown };
}

// =============================================================================
// flagNarrativeChanges
// =============================================================================

export function flagNarrativeChanges(existingNarrative, freshNarrative) {
  const result = { guidanceChanges: [], toneShifts: [], newQuotes: [] };
  if (!freshNarrative) return result;

  // Extract dollar amounts and percentages from both narratives
  const extractNumbers = (text) => {
    if (!text) return [];
    const matches = text.match(/\$[\d,.]+\s*(?:billion|million|trillion|B|M|T)?|\d+\.?\d*%/gi) || [];
    return matches.map(m => m.trim());
  };

  const oldNumbers = new Set(extractNumbers(existingNarrative));
  const newNumbers = extractNumbers(freshNarrative);

  for (const num of newNumbers) {
    if (!oldNumbers.has(num)) {
      result.guidanceChanges.push(num);
    }
  }

  // Extract quoted text from fresh narrative
  const quotePattern = /[""]([^""]{10,})[""]/g;
  let match;
  while ((match = quotePattern.exec(freshNarrative)) !== null) {
    result.newQuotes.push(match[1].trim());
  }
  // Also try straight quotes
  const straightQuotePattern = /"([^"]{10,})"/g;
  while ((match = straightQuotePattern.exec(freshNarrative)) !== null) {
    if (!result.newQuotes.includes(match[1].trim())) {
      result.newQuotes.push(match[1].trim());
    }
  }

  // Simple tone shift detection: look for keywords
  const bullishWords = ['beat', 'exceeded', 'record', 'strong', 'accelerat', 'raised guidance', 'upside'];
  const bearishWords = ['miss', 'below', 'weak', 'decelerat', 'lowered guidance', 'downside', 'concern', 'headwind'];

  const freshLower = freshNarrative.toLowerCase();
  const bullishCount = bullishWords.filter(w => freshLower.includes(w)).length;
  const bearishCount = bearishWords.filter(w => freshLower.includes(w)).length;

  if (bullishCount > bearishCount + 2) {
    result.toneShifts.push('Predominantly bullish tone in fresh narrative');
  } else if (bearishCount > bullishCount + 2) {
    result.toneShifts.push('Predominantly cautious/bearish tone in fresh narrative');
  } else if (bullishCount > 0 && bearishCount > 0) {
    result.toneShifts.push('Mixed tone — both bullish and bearish signals present');
  }

  return result;
}

// =============================================================================
// generateRefreshReport
// =============================================================================

export function generateRefreshReport(ticker, {
  existingPackage,
  sonarEarnings,
  sonarNarrative,
  eodhdResult,
  deltas,
  narrativeDeltas,
  newQuarter,
}) {
  const meta = STOCK_META[ticker];
  const dateStr = new Date().toISOString().split('T')[0];
  const oldQuarter = existingPackage?.dataThroughQuarter || 'Unknown';

  let report = `# ${ticker} Earnings Refresh Report
## Generated: ${dateStr}
## New Quarter: ${newQuarter || 'TBD'} | Previous Coverage: ${oldQuarter}

---

`;

  // ─── Section 9 Update ──────────────────────────────────
  report += `## SECTION 9 UPDATE (Data Table)\n\n`;

  if (eodhdResult?.markdown) {
    report += `### New 8-Quarter Table (from EODHD)\n\n${eodhdResult.markdown}\n\n`;
  } else {
    report += `### New 8-Quarter Table\n\n*EODHD data unavailable — manual table update required*\n\n`;
  }

  if (deltas?.changes?.length > 0) {
    report += `### Key Changes from Previous Table\n\n`;
    const significantChanges = deltas.changes.filter(c => c.significant);
    const otherChanges = deltas.changes.filter(c => !c.significant);

    if (significantChanges.length > 0) {
      report += `**Significant Changes (>5% or key metrics):**\n`;
      for (const c of significantChanges) {
        const arrow = c.pctChange > 0 ? '↑' : '↓';
        report += `- **${c.metric}**: ${c.oldValue} → ${c.newValue} (${arrow}${Math.abs(c.pctChange)}%)\n`;
      }
      report += `\n`;
    }

    if (otherChanges.length > 0) {
      report += `**Other Changes:**\n`;
      for (const c of otherChanges) {
        report += `- ${c.metric}: ${c.oldValue} → ${c.newValue} (${c.pctChange > 0 ? '+' : ''}${c.pctChange}%)\n`;
      }
      report += `\n`;
    }
  } else {
    report += `### Key Changes\n\n*No prior table data available for comparison, or no changes detected*\n\n`;
  }

  report += `---\n\n`;

  // ─── Narrative Deltas ──────────────────────────────────
  report += `## NARRATIVE DELTAS (Sections 1-8)\n\n`;

  if (sonarEarnings) {
    report += `### Revenue Architecture Changes (from Sonar)\n\n`;

    if (sonarEarnings.revenue) {
      const rev = sonarEarnings.revenue;
      report += `- **Total Revenue**: $${rev.total?.toLocaleString() || '?'}M (YoY: ${rev.yoyGrowth || '?'}, QoQ: ${rev.qoqGrowth || '?'})\n`;
    }

    if (sonarEarnings.grossMargin) {
      report += `- **Gross Margin**: GAAP ${sonarEarnings.grossMargin.gaap || '?'}, Non-GAAP ${sonarEarnings.grossMargin.nonGaap || '?'}\n`;
    }

    if (sonarEarnings.segments?.length > 0) {
      report += `\n**Segment Breakdown:**\n`;
      for (const seg of sonarEarnings.segments) {
        report += `- ${seg.name}: $${seg.revenue?.toLocaleString() || '?'}M (${seg.growth || 'growth N/A'})\n`;
      }
    }

    if (sonarEarnings.guidance) {
      report += `\n**Forward Guidance:**\n`;
      if (sonarEarnings.guidance.nextQuarterRevenue) {
        report += `- Next Quarter Revenue: ${sonarEarnings.guidance.nextQuarterRevenue}\n`;
      }
      if (sonarEarnings.guidance.nextQuarterMargin) {
        report += `- Next Quarter Margin: ${sonarEarnings.guidance.nextQuarterMargin}\n`;
      }
      if (sonarEarnings.guidance.other) {
        report += `- Other: ${sonarEarnings.guidance.other}\n`;
      }
    }

    report += `\n`;
  } else {
    report += `### Revenue Architecture Changes\n\n*Sonar earnings data unavailable*\n\n`;
  }

  // Management Signals
  report += `### Management Signals Update\n\n`;
  if (narrativeDeltas?.newQuotes?.length > 0) {
    for (const quote of narrativeDeltas.newQuotes) {
      report += `- NEW QUOTE: "${quote}"\n`;
    }
    report += `\n`;
  }
  if (narrativeDeltas?.guidanceChanges?.length > 0) {
    report += `**New numbers mentioned in narrative:**\n`;
    for (const num of narrativeDeltas.guidanceChanges) {
      report += `- ${num}\n`;
    }
    report += `\n`;
  }
  if (narrativeDeltas?.toneShifts?.length > 0) {
    report += `**Tone Assessment:** ${narrativeDeltas.toneShifts.join('. ')}\n\n`;
  }

  // Full Sonar narrative
  if (sonarNarrative) {
    report += `### Full Narrative Intelligence (Sonar)\n\n${sonarNarrative}\n\n`;
  }

  report += `---\n\n`;

  // ─── EODHD Raw Data ────────────────────────────────────
  report += `## EODHD RAW DATA (for validation)\n\n`;
  if (eodhdResult?.markdown) {
    report += `${eodhdResult.markdown}\n\n`;
    report += `*Use this table to cross-validate Sonar-reported numbers. Flag any significant discrepancies.*\n\n`;
  } else {
    report += `*EODHD data unavailable*\n\n`;
  }

  // Cross-validation
  if (sonarEarnings?.revenue?.total && eodhdResult?.table) {
    const lastEodhdRev = eodhdResult.table.rows.find(r =>
      r.metric.toLowerCase().includes('total revenue')
    );
    if (lastEodhdRev) {
      const eodhdVal = parseNumeric(lastEodhdRev.values[lastEodhdRev.values.length - 1]);
      const sonarVal = sonarEarnings.revenue.total;
      if (eodhdVal && sonarVal) {
        const diff = Math.abs(eodhdVal - sonarVal) / Math.max(eodhdVal, sonarVal) * 100;
        if (diff > 5) {
          report += `\n**⚠ REVENUE DISCREPANCY**: Sonar reports $${sonarVal.toLocaleString()}M vs EODHD $${eodhdVal.toLocaleString()}M (${diff.toFixed(1)}% divergence). EODHD may not have updated yet or Sonar may have preliminary figures.\n\n`;
        } else {
          report += `\n**✓ Revenue validated**: Sonar $${sonarVal.toLocaleString()}M vs EODHD $${eodhdVal.toLocaleString()}M (${diff.toFixed(1)}% difference — within tolerance)\n\n`;
        }
      }
    }
  }

  report += `---\n\n`;

  // ─── Recommended Actions ───────────────────────────────
  report += `## RECOMMENDED ACTIONS\n\n`;
  report += `- [ ] Update Section 9 table with new quarter\n`;
  report += `- [ ] Update header line: "Data Through: ${newQuarter || '[new quarter]'}"\n`;
  report += `- [ ] Review and update Section 2 (Revenue Architecture) if segments changed\n`;
  report += `- [ ] Review and update Section 4 (Financial Health) with new margins/cash flow\n`;
  report += `- [ ] Review and update Section 6 (Management Signals) with new quotes/guidance\n`;
  report += `- [ ] Review and update Section 7 (Qualitative Intelligence) if narrative shifted\n`;
  report += `- [ ] Update Section 8 (Cross-Company Connections) if dynamics changed\n`;
  report += `- [ ] Update ledger extract if cross-company dynamics changed\n`;
  report += `- [ ] Rebuild stockIntelligenceData.js bundle\n`;

  return report;
}
