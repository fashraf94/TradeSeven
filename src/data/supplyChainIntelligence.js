// /src/data/supplyChainIntelligence.js
// Scout Research App — Curated supply chain intelligence data
// Source: scout_intelligence_export.json v1.0
// 24 companies, 5 product teardowns, 11 themes, 5 scenarios

// ============================================
// COMPANY INTELLIGENCE — keyed by ticker
// ============================================

export const COMPANY_INTELLIGENCE = {
  TSM: {
    name: 'Taiwan Semiconductor Manufacturing Company',
    shortName: 'TSMC',
    ticker: 'TSM',
    exchange: 'NYSE',
    sector: 'technology',
    industry: 'semiconductors',
    description: "The world's largest dedicated semiconductor foundry, manufacturing chips designed by other companies. TSMC pioneered the pure-play foundry model and leads in advanced process technologies including 3nm and 5nm nodes.",
    tier: 1,
    position: 'leader',
    marketShareNote: '90% market share in advanced nodes (3nm, 5nm)',
    moat: 'Only company capable of manufacturing 3nm chips at scale. 2-3 year technology lead over competitors.',
    vulnerabilities: [
      'Geographic concentration in Taiwan',
      'Geopolitical tensions with China',
      'Extreme capital requirements for new fabs',
    ],
    competitors: [
      { ticker: 'SSNLF', relationship: 'direct', notes: 'Closest competitor, but trailing in yield rates' },
      { ticker: 'INTC', relationship: 'direct', notes: 'Rebuilding foundry business, years behind' },
    ],
    upstreamSuppliers: [
      { ticker: 'ASML', component: 'EUV Lithography Machines', criticality: 'critical', notes: 'Only source for EUV - no alternatives exist' },
      { ticker: 'AMAT', component: 'Deposition & Etching Equipment', criticality: 'critical', notes: 'Essential for chip fabrication' },
      { ticker: 'LRCX', component: 'Etching Equipment', criticality: 'critical', notes: 'Critical for advanced patterning' },
      { ticker: '8035.T', component: 'Coater/Developer Equipment', criticality: 'important', notes: 'Key process equipment' },
      { ticker: 'SNPS', component: 'EDA Design Tools', criticality: 'important', notes: 'Used by TSMC customers to design chips' },
      { ticker: 'CDNS', component: 'EDA Design Tools', criticality: 'important', notes: 'Used by TSMC customers to design chips' },
    ],
    downstreamNote: 'Manufactures chips for Apple, NVIDIA, AMD, Qualcomm, and 500+ customers',
    revenueConcentration: [
      { customer: 'Apple', percentage: 25, ticker: 'AAPL', source: 'SEC 10-K 2023' },
      { customer: 'NVIDIA', percentage: 11, source: 'Industry estimates' },
      { customer: 'AMD', percentage: 7, ticker: 'AMD', source: 'Industry estimates' },
      { customer: 'Qualcomm', percentage: 6, ticker: 'QCOM', source: 'Industry estimates' },
      { customer: 'MediaTek', percentage: 5, ticker: '2454.TW', source: 'Industry estimates' },
      { customer: 'Other', percentage: 46, source: 'Calculated' },
    ],
    concentrationRisk: 'high',
    concentrationNote: 'Apple alone represents ~25% of revenue. Top 5 customers = 54%.',
    themes: ['ai_enabler', 'supply_chain_critical', 'geopolitical_risk', 'mobile_growth'],
    scenarioExposure: [
      { scenarioId: 'taiwan-disruption', impact: 'severe', role: 'affected', reason: 'Headquarters and primary fabs in Taiwan. 90%+ of advanced chips.' },
      { scenarioId: 'china-tech-ban', impact: 'positive', role: 'beneficiary', reason: 'China customers may rush to TSMC while access remains.' },
      { scenarioId: 'ai-chip-shortage', impact: 'positive', role: 'beneficiary', reason: 'Sole manufacturer of advanced AI chips. Pricing power increases.' },
      { scenarioId: 'apple-modem-transition', impact: 'positive', role: 'beneficiary', reason: "Will manufacture Apple's modem. Volume shift from Qualcomm to Apple." },
    ],
  },

  QCOM: {
    name: 'Qualcomm Incorporated',
    shortName: 'Qualcomm',
    ticker: 'QCOM',
    exchange: 'NASDAQ',
    sector: 'technology',
    industry: 'semiconductors',
    description: 'Global leader in wireless technology and semiconductors. Qualcomm invented key technologies behind 3G, 4G, and 5G cellular standards. Their Snapdragon processors power most premium Android devices.',
    position: 'leader',
    marketShareNote: 'Dominant in premium Android smartphones, sole 5G modem supplier for iPhone',
    moat: 'Extensive patent portfolio in wireless technology. Years of R&D in modem design.',
    vulnerabilities: [
      'Apple developing in-house modems',
      'MediaTek gaining share in mid-range',
      'Regulatory scrutiny on licensing practices',
    ],
    competitors: [
      { ticker: '2454.TW', relationship: 'direct', notes: 'Growing in mid-range, not yet competitive in premium' },
      { ticker: 'AAPL', relationship: 'emerging', notes: 'Developing own modem, could drop Qualcomm by 2027' },
    ],
    revenueConcentration: [
      { customer: 'Apple', percentage: 22, ticker: 'AAPL', source: 'SEC 10-K 2023' },
      { customer: 'Samsung', percentage: 10, ticker: 'SSNLF', source: 'Industry estimates' },
      { customer: 'Xiaomi', percentage: 8, source: 'Industry estimates' },
      { customer: 'OPPO/Vivo', percentage: 12, source: 'Industry estimates' },
      { customer: 'Other Android OEMs', percentage: 28, source: 'Calculated' },
      { customer: 'Automotive/IoT', percentage: 20, source: 'SEC 10-K 2023' },
    ],
    concentrationRisk: 'high',
    concentrationNote: 'Apple modem contract at risk - they are developing in-house 5G modems expected 2025-2026.',
    themes: ['5g_connectivity', 'mobile_growth', 'supply_chain_critical'],
    scenarioExposure: [
      { scenarioId: 'taiwan-disruption', impact: 'severe', role: 'affected', reason: 'Primary foundry partner is TSMC for Snapdragon chips.' },
      { scenarioId: 'apple-modem-transition', impact: 'severe', role: 'affected', reason: 'Apple represents ~22% of revenue. Loss would significantly impact earnings.' },
    ],
  },

  SONY: {
    name: 'Sony Group Corporation',
    shortName: 'Sony',
    ticker: 'SONY',
    exchange: 'NYSE',
    sector: 'technology',
    industry: 'consumer_electronics',
    description: 'Japanese multinational with diverse businesses spanning electronics, gaming, entertainment, and financial services. Known for PlayStation, image sensors, cameras, and entertainment properties.',
    position: 'leader',
    marketShareNote: '~50% global image sensor market share',
    moat: 'Decades of imaging expertise. Exclusive partnerships with Apple, major smartphone OEMs.',
    vulnerabilities: [
      'Samsung investing heavily in sensors',
      'Smartphone camera improvements plateauing',
      'Concentration in mobile market',
    ],
    competitors: [
      { ticker: 'SSNLF', relationship: 'direct', notes: 'Strong in own devices, growing third-party sales' },
    ],
    revenueConcentration: [
      { customer: 'Gaming (PlayStation)', percentage: 30, source: 'SEC 10-K 2023' },
      { customer: 'Image Sensors', percentage: 22, source: 'SEC 10-K 2023' },
      { customer: 'Music', percentage: 15, source: 'SEC 10-K 2023' },
      { customer: 'Pictures (Film/TV)', percentage: 13, source: 'SEC 10-K 2023' },
      { customer: 'Electronics', percentage: 12, source: 'SEC 10-K 2023' },
      { customer: 'Financial Services', percentage: 8, source: 'SEC 10-K 2023' },
    ],
    concentrationRisk: 'low',
    concentrationNote: 'Highly diversified conglomerate. No single segment dominates.',
    themes: ['mobile_growth', 'consumer_electronics', 'ai_enabler'],
    scenarioExposure: [
      { scenarioId: 'memory-shortage', impact: 'moderate', role: 'affected', reason: 'PlayStation needs DRAM and NAND. Higher costs impact console margins.' },
    ],
  },

  GLW: {
    name: 'Corning Incorporated',
    shortName: 'Corning',
    ticker: 'GLW',
    exchange: 'NYSE',
    sector: 'technology',
    industry: 'specialty_materials',
    description: 'American materials science company specializing in glass, ceramics, and optical physics. Invented Gorilla Glass for mobile devices and optical fiber for telecommunications. Over 170 years of innovation.',
    position: 'leader',
    marketShareNote: 'Gorilla Glass on 8 billion+ devices',
    moat: 'Proprietary glass formulations. Deep partnerships with Apple, Samsung. No credible alternative for premium devices.',
    vulnerabilities: [
      'Smartphone market maturation',
      'Chinese glass makers improving',
      'Dependent on device upgrade cycles',
    ],
    revenueConcentration: [
      { customer: 'Apple', percentage: 15, ticker: 'AAPL', source: 'Industry estimates' },
      { customer: 'Samsung', percentage: 12, ticker: 'SSNLF', source: 'Industry estimates' },
      { customer: 'Display Makers', percentage: 25, source: 'SEC 10-K 2023' },
      { customer: 'Telecom (Fiber)', percentage: 28, source: 'SEC 10-K 2023' },
      { customer: 'Automotive', percentage: 10, source: 'SEC 10-K 2023' },
      { customer: 'Other', percentage: 10, source: 'Calculated' },
    ],
    concentrationRisk: 'low',
    concentrationNote: 'Well diversified across mobile, telecom fiber, and automotive glass.',
    themes: ['mobile_growth', 'consumer_electronics'],
    scenarioExposure: [],
  },

  SSNLF: {
    name: 'Samsung Electronics Co., Ltd.',
    shortName: 'Samsung',
    ticker: 'SSNLF',
    exchange: 'OTC',
    sector: 'technology',
    industry: 'consumer_electronics',
    description: "South Korean conglomerate and one of the world's largest technology companies. Operates across semiconductors, displays, consumer electronics, and mobile devices. World's largest smartphone manufacturer.",
    tier: 1,
    position: 'leader',
    moat: 'Vertical integration across memory, displays, and consumer devices. Sells components to competitors including Apple.',
    vulnerabilities: [
      'Trailing TSMC in advanced foundry nodes',
      'Behind SK Hynix in HBM for AI',
      'Smartphone market maturity',
    ],
    upstreamSuppliers: [
      { ticker: 'ASML', component: 'EUV Lithography Machines', criticality: 'critical', notes: 'Required for advanced nodes' },
      { ticker: 'AMAT', component: 'Fab Equipment', criticality: 'critical', notes: 'Multiple process steps' },
      { ticker: 'LRCX', component: 'Etching Equipment', criticality: 'important', notes: 'Memory production' },
    ],
    downstreamNote: 'Supplies displays to Apple, memory to everyone, foundry services growing',
    revenueConcentration: [
      { customer: 'Mobile Devices (Own)', percentage: 25, source: 'Industry estimates' },
      { customer: 'Memory (Various)', percentage: 30, source: 'Industry estimates' },
      { customer: 'Display (Apple, etc)', percentage: 20, source: 'Industry estimates' },
      { customer: 'Foundry Services', percentage: 10, source: 'Industry estimates' },
      { customer: 'Consumer Electronics', percentage: 15, source: 'Industry estimates' },
    ],
    concentrationRisk: 'low',
    concentrationNote: 'Massive conglomerate with vertical integration. Sells components to competitors including Apple.',
    themes: ['consumer_electronics', 'mobile_growth'],
    scenarioExposure: [
      { scenarioId: 'taiwan-disruption', impact: 'positive', role: 'beneficiary', reason: 'Korean foundry could absorb some demand, though capacity limited.' },
      { scenarioId: 'memory-shortage', impact: 'positive', role: 'beneficiary', reason: 'Largest memory producer gains pricing power. Memory division profits surge.' },
      { scenarioId: 'china-tech-ban', impact: 'positive', role: 'beneficiary', reason: 'Korean alternative may be viewed as more stable.' },
      { scenarioId: 'ai-chip-shortage', impact: 'positive', role: 'beneficiary', reason: 'HBM and foundry both benefit from AI chip demand.' },
    ],
  },

  SK_HYNIX: {
    name: 'SK Hynix Inc.',
    shortName: 'SK Hynix',
    ticker: null,
    sector: 'technology',
    industry: 'memory_storage',
    description: "South Korean semiconductor company and the world's second-largest memory chipmaker after Samsung. Specializes in DRAM, NAND flash memory, and advanced packaging solutions. Key supplier for AI infrastructure.",
    tier: 1,
    position: 'challenger',
    marketShareNote: '~28% DRAM market share, #2 globally',
    moat: 'Leading in HBM (High Bandwidth Memory) for AI. Strong relationship with NVIDIA.',
    vulnerabilities: [
      'Memory price volatility',
      'Samsung and Micron competition',
      'Heavy capital expenditure requirements',
    ],
    competitors: [
      { ticker: 'SSNLF', relationship: 'direct', notes: 'Market leader but behind in HBM' },
      { ticker: 'MU', relationship: 'direct', notes: '#3 player, US-based alternative' },
    ],
    upstreamSuppliers: [
      { ticker: 'ASML', component: 'Lithography Equipment', criticality: 'critical', notes: 'Advanced memory requires EUV' },
      { ticker: 'AMAT', component: 'Deposition Equipment', criticality: 'critical', notes: 'HBM production' },
      { ticker: 'LRCX', component: 'Etching Equipment', criticality: 'critical', notes: '3D NAND requires advanced etch' },
    ],
    downstreamNote: 'Supplies memory to Apple, NVIDIA (HBM for AI), server makers',
    themes: ['memory_cycle', 'ai_enabler', 'mobile_growth'],
    scenarioExposure: [
      { scenarioId: 'memory-shortage', impact: 'positive', role: 'beneficiary', reason: '#2 memory maker benefits from higher ASPs. HBM leadership amplifies gains.' },
      { scenarioId: 'ai-chip-shortage', impact: 'positive', role: 'beneficiary', reason: 'HBM memory is essential for AI chips. Supply tightness helps margins.' },
    ],
  },

  AVGO: {
    name: 'Broadcom Inc.',
    shortName: 'Broadcom',
    ticker: 'AVGO',
    exchange: 'NASDAQ',
    sector: 'technology',
    industry: 'semiconductors',
    description: 'American global technology company designing semiconductors and infrastructure software solutions. Products include wireless communications chips, networking equipment, storage adapters, and enterprise software.',
    position: 'leader',
    marketShareNote: 'Dominant in networking chips and RF components',
    moat: 'Diversified across networking, broadband, wireless. Sticky enterprise relationships.',
    vulnerabilities: [
      'Customer concentration (Apple significant)',
      'Acquisition-driven growth model',
      'Competition from Marvell in data center',
    ],
    competitors: [
      { ticker: 'QCOM', relationship: 'indirect', notes: 'Overlaps in some RF components' },
    ],
    revenueConcentration: [
      { customer: 'Apple', percentage: 20, ticker: 'AAPL', source: 'SEC 10-K 2023' },
      { customer: 'Enterprise/Cloud', percentage: 35, source: 'SEC 10-K 2023' },
      { customer: 'Broadband', percentage: 15, source: 'SEC 10-K 2023' },
      { customer: 'Wireless OEMs', percentage: 15, source: 'Industry estimates' },
      { customer: 'Other', percentage: 15, source: 'Calculated' },
    ],
    concentrationRisk: 'medium',
    concentrationNote: 'Apple is largest single customer but VMware acquisition adds enterprise software diversification.',
    themes: ['ai_enabler', 'supply_chain_critical'],
    scenarioExposure: [
      { scenarioId: 'taiwan-disruption', impact: 'moderate', role: 'affected', reason: 'Many chips made at TSMC, but some diversity in manufacturing.' },
      { scenarioId: 'apple-modem-transition', impact: 'minor', role: 'affected', reason: 'Some RF components may be replaced, but Apple relationship is broader.' },
    ],
  },

  SWKS: {
    name: 'Skyworks Solutions, Inc.',
    shortName: 'Skyworks',
    ticker: 'SWKS',
    exchange: 'NASDAQ',
    sector: 'technology',
    industry: 'wireless_equipment',
    description: 'American semiconductor company focused on analog and mixed-signal semiconductors for mobile communications. Specializes in RF components including amplifiers, filters, and front-end modules.',
    revenueConcentration: [
      { customer: 'Apple', percentage: 59, ticker: 'AAPL', source: 'SEC 10-K 2023' },
      { customer: 'Samsung', percentage: 10, ticker: 'SSNLF', source: 'Industry estimates' },
      { customer: 'Other Mobile', percentage: 20, source: 'Calculated' },
      { customer: 'Automotive/IoT', percentage: 11, source: 'SEC 10-K 2023' },
    ],
    concentrationRisk: 'high',
    concentrationNote: 'EXTREME: Apple is 59% of revenue. Any reduction in Apple orders would severely impact the business.',
    themes: ['mobile_growth', '5g_connectivity'],
    scenarioExposure: [
      { scenarioId: 'apple-modem-transition', impact: 'minor', role: 'affected', reason: 'RF components exposed, but may retain some design wins.' },
    ],
  },

  QRVO: {
    name: 'Qorvo, Inc.',
    shortName: 'Qorvo',
    ticker: 'QRVO',
    exchange: 'NASDAQ',
    sector: 'technology',
    industry: 'wireless_equipment',
    description: 'American semiconductor company providing RF solutions for mobile devices, wireless infrastructure, and defense applications. Formed through merger of RF Micro Devices and TriQuint.',
    revenueConcentration: [
      { customer: 'Apple', percentage: 33, ticker: 'AAPL', source: 'SEC 10-K 2023' },
      { customer: 'Samsung', percentage: 8, ticker: 'SSNLF', source: 'Industry estimates' },
      { customer: 'Other Mobile', percentage: 25, source: 'Calculated' },
      { customer: 'Infrastructure', percentage: 20, source: 'SEC 10-K 2023' },
      { customer: 'Defense', percentage: 14, source: 'SEC 10-K 2023' },
    ],
    concentrationRisk: 'high',
    concentrationNote: 'Apple at 33% creates significant concentration risk. Defense business provides some diversification.',
    themes: ['mobile_growth', '5g_connectivity'],
    scenarioExposure: [],
  },

  TXN: {
    name: 'Texas Instruments Incorporated',
    shortName: 'Texas Instruments',
    ticker: 'TXN',
    exchange: 'NASDAQ',
    sector: 'technology',
    industry: 'analog_semiconductors',
    description: "American technology company and the world's largest manufacturer of analog semiconductors. Produces analog chips, embedded processors, and digital signal processors.",
    themes: ['consumer_electronics'],
    scenarioExposure: [],
  },

  HNHPF: {
    name: 'Hon Hai Precision Industry Co., Ltd.',
    shortName: 'Foxconn',
    ticker: 'HNHPF',
    exchange: 'OTC',
    sector: 'technology',
    industry: 'contract_manufacturing',
    description: "Taiwanese multinational electronics contract manufacturer and the world's largest technology manufacturer by revenue. Provides design, manufacturing, and assembly services for major technology brands.",
    themes: ['consumer_electronics', 'supply_chain_critical'],
    scenarioExposure: [],
  },

  STM: {
    name: 'STMicroelectronics N.V.',
    shortName: 'STMicro',
    ticker: 'STM',
    exchange: 'NYSE',
    sector: 'technology',
    industry: 'semiconductors',
    description: 'European multinational semiconductor company. Designs and manufactures chips for automotive, industrial, personal electronics. Key products include microcontrollers, sensors, power management, and MEMS devices.',
    themes: ['consumer_electronics', 'mobile_growth'],
    scenarioExposure: [],
  },

  AAPL: {
    name: 'Apple Inc.',
    shortName: 'Apple',
    ticker: 'AAPL',
    exchange: 'NASDAQ',
    sector: 'technology',
    industry: 'consumer_electronics',
    description: "American multinational technology company and one of the world's most valuable corporations. Designs, manufactures, and markets smartphones (iPhone), computers (Mac), tablets (iPad), wearables, and services.",
    position: 'leader',
    moat: 'Ecosystem lock-in (iPhone + iPad + Mac + iCloud), vertical integration of silicon design, premium brand.',
    vulnerabilities: [
      '100% dependent on TSMC for chip manufacturing',
      'China revenue exposure (~20%)',
      'Services growth deceleration',
    ],
    themes: ['consumer_electronics', 'mobile_growth', 'ai_enabler'],
    scenarioExposure: [
      { scenarioId: 'taiwan-disruption', impact: 'severe', role: 'affected', reason: '100% of Apple silicon (A-series, M-series) made by TSMC.' },
      { scenarioId: 'memory-shortage', impact: 'moderate', role: 'affected', reason: 'iPhones and Macs need memory. Higher costs squeeze margins.' },
      { scenarioId: 'ai-chip-shortage', impact: 'minor', role: 'affected', reason: 'May compete with AI chips for TSMC capacity, but has priority.' },
      { scenarioId: 'apple-modem-transition', impact: 'positive', role: 'beneficiary', reason: 'Better margins, tighter integration, reduced supplier dependency.' },
    ],
  },

  LPL: {
    name: 'LG Display Co., Ltd.',
    shortName: 'LG Display',
    ticker: 'LPL',
    exchange: 'NYSE',
    sector: 'technology',
    industry: 'display_technology',
    description: "South Korean display manufacturer and one of the world's largest producers of TFT-LCD and OLED panels. Supplies screens for televisions, monitors, laptops, tablets, and mobile devices.",
    themes: ['display_tech', 'consumer_electronics'],
    scenarioExposure: [],
  },

  AMD: {
    name: 'Advanced Micro Devices, Inc.',
    shortName: 'AMD',
    ticker: 'AMD',
    exchange: 'NASDAQ',
    sector: 'technology',
    industry: 'semiconductors',
    description: 'American multinational semiconductor company developing computer processors and related technologies. Designs CPUs (Ryzen, EPYC), GPUs (Radeon), and custom chips for gaming consoles and data centers.',
    position: 'challenger',
    marketShareNote: 'Growing PC/server CPU share, sole custom chip provider for PS5/Xbox',
    moat: 'Leading-edge chip designs manufactured at TSMC. Strong gaming console partnerships.',
    vulnerabilities: [
      'Dependent on TSMC for manufacturing',
      'Intel fighting back with new architectures',
      'NVIDIA dominates AI/ML chips',
    ],
    competitors: [
      { ticker: 'INTC', relationship: 'direct', notes: 'Historic rival, losing share to AMD' },
    ],
    themes: ['ai_enabler', 'consumer_electronics', 'semiconductor_cycle'],
    scenarioExposure: [
      { scenarioId: 'taiwan-disruption', impact: 'severe', role: 'affected', reason: 'All AMD CPUs and GPUs manufactured exclusively by TSMC.' },
      { scenarioId: 'memory-shortage', impact: 'minor', role: 'affected', reason: 'GPUs often bundled with memory. Supply constraints could limit sales.' },
      { scenarioId: 'ai-chip-shortage', impact: 'moderate', role: 'affected', reason: 'AI GPU supply constrained. Could gain share but capacity limited.' },
    ],
  },

  INTC: {
    name: 'Intel Corporation',
    shortName: 'Intel',
    ticker: 'INTC',
    exchange: 'NASDAQ',
    sector: 'technology',
    industry: 'semiconductors',
    description: 'American semiconductor company and the largest PC chip maker. Rebuilding its foundry business to compete with TSMC.',
    position: 'challenger',
    marketShareNote: 'Dominant in PC/server CPUs, nascent in foundry',
    moat: 'Massive R&D budget, US government support for domestic manufacturing.',
    vulnerabilities: [
      'Years behind TSMC in process technology',
      'Losing data center share to AMD',
      'Foundry business unproven',
    ],
    competitors: [
      { ticker: 'AMD', relationship: 'direct', notes: 'Taking CPU market share' },
      { ticker: 'TSM', relationship: 'direct', notes: 'Competing for foundry customers' },
    ],
    themes: ['semiconductor_cycle', 'supply_chain_critical'],
    scenarioExposure: [
      { scenarioId: 'taiwan-disruption', impact: 'positive', role: 'beneficiary', reason: 'US-based foundry alternative with government support. Could gain customers.' },
      { scenarioId: 'china-tech-ban', impact: 'positive', role: 'beneficiary', reason: 'Could gain share as "safe" US-based supplier.' },
    ],
  },

  '2454.TW': {
    name: 'MediaTek Inc.',
    shortName: 'MediaTek',
    ticker: '2454.TW',
    exchange: 'TWSE',
    sector: 'technology',
    industry: 'semiconductors',
    description: 'Taiwanese semiconductor company specializing in smartphone chips. Leader in mid-range and budget smartphone processors with growing presence in premium segments.',
    position: 'challenger',
    marketShareNote: '#1 smartphone chipset vendor by volume',
    moat: 'Cost-effective designs, strong in emerging markets.',
    vulnerabilities: [
      'Lower margins than Qualcomm',
      'Perception as budget option',
      'Dependent on TSMC',
    ],
    competitors: [
      { ticker: 'QCOM', relationship: 'direct', notes: 'Premium market leader' },
    ],
    themes: ['mobile_growth', 'semiconductor_cycle'],
    scenarioExposure: [
      { scenarioId: 'taiwan-disruption', impact: 'severe', role: 'affected', reason: 'Taiwan-based company, entirely TSMC dependent.' },
    ],
  },

  MU: {
    name: 'Micron Technology',
    shortName: 'Micron',
    ticker: 'MU',
    exchange: 'NASDAQ',
    sector: 'technology',
    industry: 'memory_storage',
    description: 'American memory and storage company. Only US-based DRAM manufacturer, benefiting from domestic chip initiatives and growing AI demand.',
    position: 'challenger',
    marketShareNote: '#3 in DRAM (~23%), #4 in NAND',
    moat: 'Only US DRAM maker, government support, improving technology.',
    vulnerabilities: [
      'Smaller scale than Samsung/SK Hynix',
      'Banned from China market',
      'Cyclical business',
    ],
    competitors: [
      { ticker: 'SSNLF', relationship: 'direct', notes: 'Market leader' },
      { key: 'SK_HYNIX', relationship: 'direct', notes: '#2 player, HBM leader' },
    ],
    themes: ['memory_cycle', 'semiconductor_cycle'],
    scenarioExposure: [
      { scenarioId: 'memory-shortage', impact: 'positive', role: 'beneficiary', reason: 'Only US memory producer. Rising prices boost margins significantly.' },
    ],
  },

  ASML: {
    name: 'ASML Holding',
    shortName: 'ASML',
    ticker: 'ASML',
    exchange: 'NASDAQ',
    sector: 'technology',
    industry: 'semiconductor_equipment',
    description: 'Dutch company that holds a monopoly on extreme ultraviolet (EUV) lithography machines. Without ASML, no one can make advanced chips below 7nm.',
    tier: 2,
    position: 'leader',
    marketShareNote: '100% monopoly on EUV lithography',
    moat: 'Only company capable of making EUV machines. Each machine costs $150M+ and takes years to build. Technology is decades ahead of any potential competitor.',
    vulnerabilities: [
      'Single point of failure for entire chip industry',
      'Geopolitical pressure to restrict China sales',
      'Complex supply chain for machine components',
    ],
    downstreamNote: 'Supplies to TSMC, Samsung, Intel - all advanced chip fabs',
    revenueConcentration: [
      { customer: 'TSMC', percentage: 35, ticker: 'TSM', source: 'Industry estimates' },
      { customer: 'Samsung', percentage: 25, ticker: 'SSNLF', source: 'Industry estimates' },
      { customer: 'Intel', percentage: 20, ticker: 'INTC', source: 'Industry estimates' },
      { customer: 'SK Hynix', percentage: 10, source: 'Industry estimates' },
      { customer: 'Micron', percentage: 5, ticker: 'MU', source: 'Industry estimates' },
      { customer: 'Other', percentage: 5, source: 'Calculated' },
    ],
    concentrationRisk: 'medium',
    concentrationNote: 'Only 5 major customers exist globally (all advanced chip fabs). TSMC is largest but all customers are essential.',
    themes: ['supply_chain_critical'],
    scenarioExposure: [
      { scenarioId: 'china-tech-ban', impact: 'moderate', role: 'affected', reason: 'Already banned from selling EUV to China. DUV restrictions expanding.' },
      { scenarioId: 'ai-chip-shortage', impact: 'positive', role: 'beneficiary', reason: 'More EUV machines needed to expand AI chip capacity.' },
    ],
  },

  AMAT: {
    name: 'Applied Materials',
    shortName: 'Applied Materials',
    ticker: 'AMAT',
    exchange: 'NASDAQ',
    sector: 'technology',
    industry: 'semiconductor_equipment',
    description: 'Largest semiconductor equipment company by revenue. Provides deposition, etching, and inspection equipment used in chip manufacturing.',
    tier: 2,
    position: 'leader',
    marketShareNote: '#1 in semiconductor equipment by revenue',
    moat: 'Broad product portfolio covering most fab processes. Deep customer relationships.',
    vulnerabilities: [
      'Cyclical with chip industry capex',
      'China revenue at risk from export controls',
      'Competition from Lam Research, Tokyo Electron',
    ],
    competitors: [
      { ticker: 'LRCX', relationship: 'direct', notes: 'Strong in etching' },
      { ticker: '8035.T', relationship: 'direct', notes: 'Strong in Asia' },
    ],
    downstreamNote: 'Supplies to TSMC, Samsung, Intel, SK Hynix, Micron',
    revenueConcentration: [
      { customer: 'TSMC', percentage: 15, ticker: 'TSM', source: 'Industry estimates' },
      { customer: 'Samsung', percentage: 18, ticker: 'SSNLF', source: 'Industry estimates' },
      { customer: 'Intel', percentage: 12, ticker: 'INTC', source: 'Industry estimates' },
      { customer: 'SK Hynix', percentage: 10, source: 'Industry estimates' },
      { customer: 'Micron', percentage: 8, ticker: 'MU', source: 'Industry estimates' },
      { customer: 'China Fabs', percentage: 20, source: 'Industry estimates' },
      { customer: 'Other', percentage: 17, source: 'Calculated' },
    ],
    concentrationRisk: 'medium',
    concentrationNote: 'Diversified across all major fabs. China revenue (~20%) at risk from export controls.',
    themes: ['supply_chain_critical'],
    scenarioExposure: [
      { scenarioId: 'china-tech-ban', impact: 'moderate', role: 'affected', reason: '~25% revenue from China at risk from new restrictions.' },
    ],
  },

  LRCX: {
    name: 'Lam Research',
    shortName: 'Lam Research',
    ticker: 'LRCX',
    exchange: 'NASDAQ',
    sector: 'technology',
    industry: 'semiconductor_equipment',
    description: 'Specializes in etching and deposition equipment critical for creating intricate patterns on chips. Essential for advanced memory production.',
    tier: 2,
    position: 'leader',
    marketShareNote: '~50% market share in etching equipment',
    moat: 'Technology leadership in conductor etch. Critical for 3D NAND production.',
    vulnerabilities: [
      'Heavy exposure to memory capex cycles',
      'China export restrictions',
      'Customer concentration',
    ],
    competitors: [
      { ticker: 'AMAT', relationship: 'direct', notes: 'Broader portfolio' },
      { ticker: '8035.T', relationship: 'direct', notes: 'Strong in Japan/Korea' },
    ],
    downstreamNote: 'Supplies to TSMC, Samsung, SK Hynix, Micron',
    themes: ['supply_chain_critical'],
    scenarioExposure: [
      { scenarioId: 'china-tech-ban', impact: 'moderate', role: 'affected', reason: 'Significant China exposure. Memory equipment sales restricted.' },
    ],
  },

  '8035.T': {
    name: 'Tokyo Electron',
    shortName: 'Tokyo Electron',
    ticker: '8035.T',
    exchange: 'TSE',
    sector: 'technology',
    industry: 'semiconductor_equipment',
    description: 'Japanese semiconductor equipment giant. Strong in coater/developers and thermal processing equipment.',
    tier: 2,
    position: 'leader',
    marketShareNote: '#3 semiconductor equipment company globally',
    moat: 'Strong relationships with Japanese and Korean chipmakers. Technology leadership in specific processes.',
    vulnerabilities: [
      'Yen fluctuation exposure',
      'Smaller scale than Applied Materials',
      'Competition in key segments',
    ],
    competitors: [
      { ticker: 'AMAT', relationship: 'direct', notes: 'Larger and more diversified' },
      { ticker: 'LRCX', relationship: 'direct', notes: 'Competes in etching' },
    ],
    downstreamNote: 'Supplies to TSMC, Samsung, Intel, all major fabs',
    themes: ['supply_chain_critical'],
    scenarioExposure: [],
  },

  SNPS: {
    name: 'Synopsys Inc.',
    shortName: 'Synopsys',
    ticker: 'SNPS',
    exchange: 'NASDAQ',
    sector: 'technology',
    industry: 'eda_software',
    description: 'Makes the software tools (EDA) that chip designers use to create new chips. Without EDA tools, no one can design advanced semiconductors.',
    tier: 2,
    position: 'leader',
    marketShareNote: '~32% EDA market share, duopoly with Cadence',
    moat: 'Decades of R&D. Chip designers trained on these tools. Switching costs are enormous.',
    vulnerabilities: [
      'Concentrated customer base',
      'Export controls affecting China sales',
      'Must keep pace with new chip architectures',
    ],
    competitors: [
      { ticker: 'CDNS', relationship: 'direct', notes: 'Primary competitor, similar market share' },
    ],
    downstreamNote: 'Software used by Apple, NVIDIA, AMD, Qualcomm, and all chip designers',
    themes: ['supply_chain_critical'],
    scenarioExposure: [
      { scenarioId: 'china-tech-ban', impact: 'moderate', role: 'affected', reason: 'EDA software already restricted for advanced nodes.' },
    ],
  },

  CDNS: {
    name: 'Cadence Design Systems',
    shortName: 'Cadence',
    ticker: 'CDNS',
    exchange: 'NASDAQ',
    sector: 'technology',
    industry: 'eda_software',
    description: 'EDA software company forming a duopoly with Synopsys. Essential tools for designing and verifying chip designs before manufacturing.',
    tier: 2,
    position: 'leader',
    marketShareNote: '~30% EDA market share, duopoly with Synopsys',
    moat: 'Deep integration into chip design workflows. Engineers spend careers learning these tools.',
    vulnerabilities: [
      'China exposure similar to Synopsys',
      'Must innovate for AI chip design',
      'Customer budget constraints',
    ],
    competitors: [
      { ticker: 'SNPS', relationship: 'direct', notes: 'Primary competitor' },
    ],
    downstreamNote: 'Software used by Apple, NVIDIA, AMD, Qualcomm, all chip designers',
    themes: ['supply_chain_critical'],
    scenarioExposure: [
      { scenarioId: 'china-tech-ban', impact: 'moderate', role: 'affected', reason: 'Similar EDA restrictions as Synopsys.' },
    ],
  },
};


// ============================================
// INVESTMENT THEMES — keyed by theme ID
// ============================================

export const INVESTMENT_THEMES = {
  ai_enabler: {
    name: 'AI Enabler',
    id: 'ai_enabler',
    description: 'Components powering artificial intelligence and machine learning',
    fullDescription: 'The AI revolution requires specialized hardware and software infrastructure. From training chips to inference accelerators, these companies build the physical and digital foundation making artificial intelligence possible.',
    investmentThesis: 'AI workloads require 10-100x more compute than traditional software. Companies providing irreplaceable AI infrastructure have pricing power and growing demand.',
    keyQuestions: [
      'Who manufactures chips that can\'t be substituted?',
      'Which companies have AI revenue growing fastest?',
      'What\'s the total addressable market for AI infrastructure?',
    ],
    trendStatus: 'growing',
    riskLevel: 'medium',
    timeHorizon: 'long',
    relatedThemes: ['supply_chain_critical', 'geopolitical_risk', 'semiconductor_cycle'],
    companies: ['TSM', 'SONY', 'SK_HYNIX'],
  },

  supply_chain_critical: {
    name: 'Supply Chain Critical',
    id: 'supply_chain_critical',
    description: 'Chokepoint with limited alternatives',
    fullDescription: 'Some companies are chokepoints in global supply chains with few or no alternatives. When disruptions occur, these suppliers have pricing power and their customers have no choice but to pay.',
    investmentThesis: 'Supply chain concentration creates moats. Companies that are sole-source suppliers for critical components can maintain margins even during downturns.',
    keyQuestions: [
      'How many alternative suppliers exist?',
      'What would it cost customers to switch?',
      'Are there geopolitical risks to this supply chain?',
    ],
    trendStatus: 'mature',
    riskLevel: 'medium',
    timeHorizon: 'medium',
    relatedThemes: ['geopolitical_risk', 'semiconductor_cycle'],
    companies: ['TSM', 'QCOM', 'ASML', 'AMAT', 'LRCX', '8035.T', 'SNPS', 'CDNS'],
  },

  geopolitical_risk: {
    name: 'Geopolitical Risk',
    id: 'geopolitical_risk',
    description: 'Manufacturing in sensitive regions',
    fullDescription: 'Manufacturing concentrated in geopolitically sensitive regions creates investment risk and opportunity. Taiwan, China, and South Korea produce most of the world\'s advanced semiconductors.',
    investmentThesis: 'Geopolitical tensions can disrupt supply chains overnight. Investors should understand geographic concentration and reshoring trends.',
    keyQuestions: [
      'Where is manufacturing located?',
      'Are there reshoring initiatives?',
      'How would regional conflict affect supply?',
    ],
    trendStatus: 'growing',
    riskLevel: 'high',
    timeHorizon: 'medium',
    relatedThemes: ['supply_chain_critical', 'semiconductor_cycle'],
    companies: ['TSM'],
  },

  mobile_growth: {
    name: 'Mobile Growth',
    id: 'mobile_growth',
    description: 'Benefiting from smartphone adoption worldwide',
    fullDescription: 'Smartphones remain the most personal computing device for billions of people. Companies enabling mobile experiences benefit from device upgrades and emerging market adoption.',
    investmentThesis: 'While smartphone growth has slowed in developed markets, premium devices and emerging markets continue driving component demand.',
    keyQuestions: [
      'Is this company exposed to premium or budget devices?',
      'What\'s their market share trend?',
      'How do upgrade cycles affect revenue?',
    ],
    trendStatus: 'mature',
    riskLevel: 'low',
    timeHorizon: 'medium',
    relatedThemes: ['consumer_electronics', '5g_connectivity'],
    companies: ['TSM', 'QCOM', 'SONY', 'SSNLF', 'SK_HYNIX'],
  },

  memory_cycle: {
    name: 'Memory Cycle',
    id: 'memory_cycle',
    description: 'Subject to memory supply/demand cycles',
    fullDescription: 'Memory chips (DRAM and NAND) follow boom-bust cycles based on supply and demand. Timing matters enormously for memory stock investments.',
    investmentThesis: 'Memory is cyclical but essential. Understanding where we are in the cycle helps identify buying opportunities during downturns.',
    keyQuestions: [
      'Where are we in the memory cycle?',
      'Are prices rising or falling?',
      'What\'s driving demand (AI, mobile, data centers)?',
    ],
    trendStatus: 'growing',
    riskLevel: 'high',
    timeHorizon: 'short',
    relatedThemes: ['ai_enabler', 'semiconductor_cycle'],
    companies: ['SK_HYNIX'],
  },

  ev_revolution: {
    name: 'EV Revolution',
    id: 'ev_revolution',
    description: 'Critical for electric vehicle production',
    fullDescription: 'Electric vehicles are transforming the automotive industry and creating new supply chains. Battery technology, charging infrastructure, and power electronics are key enablers.',
    investmentThesis: 'EV adoption is accelerating globally. Companies providing batteries, charging, and EV-specific components benefit from this transition.',
    keyQuestions: [
      'What\'s the company\'s EV revenue percentage?',
      'Are they winning new EV platform contracts?',
      'How does battery cost reduction affect them?',
    ],
    trendStatus: 'growing',
    riskLevel: 'medium',
    timeHorizon: 'long',
    relatedThemes: ['supply_chain_critical', 'consumer_electronics'],
    companies: [],
  },

  display_tech: {
    name: 'Display Technology',
    id: 'display_tech',
    description: 'OLED, MicroLED, and next-gen display innovations',
    fullDescription: 'Display technology drives user experience in smartphones, TVs, AR/VR, and automotive. Companies leading in OLED, MicroLED, and flexible displays have competitive advantages.',
    investmentThesis: 'Premium displays command higher margins. OLED adoption accelerating across devices. MicroLED emerging for high-end applications.',
    keyQuestions: [
      'What display technologies does this company lead in?',
      'Is OLED adoption accelerating or maturing?',
      'What\'s the competitive landscape for next-gen displays?',
    ],
    trendStatus: 'growing',
    riskLevel: 'medium',
    timeHorizon: 'medium',
    relatedThemes: ['consumer_electronics', 'mobile_growth'],
    companies: [],
  },

  consumer_electronics: {
    name: 'Consumer Electronics',
    id: 'consumer_electronics',
    description: 'Used across consumer devices',
    fullDescription: 'Consumer devices from phones to gaming consoles drive demand for components. These products have predictable upgrade cycles and strong brand loyalty.',
    investmentThesis: 'Consumer electronics create recurring demand through upgrade cycles. Suppliers to multiple brands have diversified revenue streams.',
    keyQuestions: [
      'How many major customers does this supplier have?',
      'What\'s the product upgrade cycle?',
      'Is the company gaining or losing share?',
    ],
    trendStatus: 'mature',
    riskLevel: 'low',
    timeHorizon: 'medium',
    relatedThemes: ['mobile_growth', 'memory_cycle'],
    companies: ['SONY', 'SSNLF'],
  },

  '5g_connectivity': {
    name: '5G Connectivity',
    id: '5g_connectivity',
    description: 'Enabling next-gen wireless',
    fullDescription: '5G networks enable faster mobile data, IoT devices, and new applications. RF components, modems, and network infrastructure benefit from 5G buildout.',
    investmentThesis: '5G deployment continues globally. Companies providing essential RF and connectivity components have multi-year growth drivers.',
    keyQuestions: [
      'Is 5G infrastructure buildout accelerating or slowing?',
      'What\'s the company\'s 5G content per device?',
      'Are they winning design wins for 6G?',
    ],
    trendStatus: 'growing',
    riskLevel: 'medium',
    timeHorizon: 'medium',
    relatedThemes: ['mobile_growth', 'ai_enabler'],
    companies: ['QCOM'],
  },

  semiconductor_cycle: {
    name: 'Semiconductor Cycle',
    id: 'semiconductor_cycle',
    description: 'Follows chip industry cycles',
    fullDescription: 'The semiconductor industry follows cyclical patterns of oversupply and shortage. Understanding these cycles helps investors time entry and exit points.',
    investmentThesis: 'Chips are essential but cyclical. Buying during downturns and understanding inventory cycles creates opportunity.',
    keyQuestions: [
      'Are chip inventories high or low?',
      'Is demand from key end markets growing?',
      'What\'s the capacity utilization rate?',
    ],
    trendStatus: 'mature',
    riskLevel: 'high',
    timeHorizon: 'short',
    relatedThemes: ['memory_cycle', 'ai_enabler', 'supply_chain_critical'],
    companies: [],
  },

  cloud_infrastructure: {
    name: 'Cloud Infrastructure',
    id: 'cloud_infrastructure',
    description: 'Powers data centers and cloud computing',
    fullDescription: 'Cloud computing requires massive data centers filled with servers, storage, and networking equipment. Infrastructure providers benefit from digital transformation.',
    investmentThesis: 'Cloud spending continues growing as enterprises migrate workloads. Data center component suppliers have visibility into long-term demand.',
    keyQuestions: [
      'What percentage of revenue comes from hyperscale customers?',
      'Are cloud capex budgets increasing?',
      'Is the company gaining share in data center?',
    ],
    trendStatus: 'growing',
    riskLevel: 'medium',
    timeHorizon: 'long',
    relatedThemes: ['ai_enabler', 'semiconductor_cycle'],
    companies: [],
  },
};


// ============================================
// WHAT-IF SCENARIOS — keyed by scenario ID
// ============================================

export const WHAT_IF_SCENARIOS = {
  'taiwan-disruption': {
    name: 'Taiwan Semiconductor Disruption',
    id: 'taiwan-disruption',
    description: "A scenario where Taiwan-based chip manufacturing is disrupted due to geopolitical tensions, natural disaster, or conflict. Taiwan produces over 90% of the world's most advanced semiconductors.",
    probability: 'low',
    affectedCompanies: [
      { ticker: 'TSM', impact: 'severe', reason: 'Headquarters and primary fabs in Taiwan. 90%+ of advanced chips.' },
      { ticker: 'AAPL', impact: 'severe', reason: '100% of Apple silicon (A-series, M-series) made by TSMC.' },
      { ticker: 'AMD', impact: 'severe', reason: 'All AMD CPUs and GPUs manufactured exclusively by TSMC.' },
      { ticker: 'QCOM', impact: 'severe', reason: 'Primary foundry partner is TSMC for Snapdragon chips.' },
      { ticker: '2454.TW', impact: 'severe', reason: 'Taiwan-based company, entirely TSMC dependent.' },
      { ticker: 'AVGO', impact: 'moderate', reason: 'Many chips made at TSMC, but some diversity in manufacturing.' },
    ],
    beneficiaries: [
      { ticker: 'INTC', reason: 'US-based foundry alternative with government support. Could gain customers.' },
      { ticker: 'SSNLF', reason: 'Korean foundry could absorb some demand, though capacity limited.' },
    ],
    investmentImplications: [
      'Geographic diversification of chip supply is years away - no quick alternatives',
      'Intel and Samsung foundries would benefit but cannot replace TSMC capacity',
      'Equipment suppliers (ASML, Applied Materials) may see orders shift to new fabs',
      'End products (iPhones, GPUs, cars) would face severe shortages for 2+ years',
      'Memory (Samsung, SK Hynix) less affected as production is in Korea',
    ],
  },

  'memory-shortage': {
    name: 'Memory Chip Shortage',
    id: 'memory-shortage',
    description: 'A scenario where DRAM/NAND supply tightens due to fab issues, AI demand surge, or coordinated production cuts. Memory is notoriously cyclical.',
    probability: 'medium',
    affectedCompanies: [
      { ticker: 'AAPL', impact: 'moderate', reason: 'iPhones and Macs need memory. Higher costs squeeze margins.' },
      { ticker: 'AMD', impact: 'minor', reason: 'GPUs often bundled with memory. Supply constraints could limit sales.' },
      { ticker: 'SONY', impact: 'moderate', reason: 'PlayStation needs DRAM and NAND. Higher costs impact console margins.' },
    ],
    beneficiaries: [
      { ticker: 'SSNLF', reason: 'Largest memory producer gains pricing power. Memory division profits surge.' },
      { key: 'SK_HYNIX', reason: '#2 memory maker benefits from higher ASPs. HBM leadership amplifies gains.' },
      { ticker: 'MU', reason: 'Only US memory producer. Rising prices boost margins significantly.' },
    ],
    investmentImplications: [
      'Memory stocks are cyclical - shortage = higher prices = higher profits for makers',
      'AI demand for HBM (High Bandwidth Memory) could extend the upcycle',
      'Device makers face margin pressure when memory prices rise',
      'Data center capex may slow if memory costs spike',
      'SK Hynix HBM leadership makes it best positioned for AI-driven demand',
    ],
  },

  'china-tech-ban': {
    name: 'Expanded China Tech Restrictions',
    id: 'china-tech-ban',
    description: 'US expands export controls, banning more chip equipment, EDA software, and technology sales to China.',
    probability: 'high',
    affectedCompanies: [
      { ticker: 'ASML', impact: 'moderate', reason: 'Already banned from selling EUV to China. DUV restrictions expanding.' },
      { ticker: 'AMAT', impact: 'moderate', reason: '~25% revenue from China at risk from new restrictions.' },
      { ticker: 'LRCX', impact: 'moderate', reason: 'Significant China exposure. Memory equipment sales restricted.' },
      { ticker: 'SNPS', impact: 'moderate', reason: 'EDA software already restricted for advanced nodes.' },
      { ticker: 'CDNS', impact: 'moderate', reason: 'Similar EDA restrictions as Synopsys.' },
    ],
    beneficiaries: [
      { ticker: 'TSM', reason: 'China customers may rush to TSMC while access remains.' },
      { ticker: 'INTC', reason: 'Could gain share as "safe" US-based supplier.' },
      { ticker: 'SSNLF', reason: 'Korean alternative may be viewed as more stable.' },
    ],
    investmentImplications: [
      'Equipment makers face revenue headwinds from China restrictions',
      'Long-term: China develops domestic alternatives, reducing total addressable market',
      'Short-term: Non-China fabs may accelerate orders, partially offsetting losses',
      'US government subsidies (CHIPS Act) help offset China revenue declines',
      'Watch for retaliatory restrictions on rare earths or other materials',
    ],
  },

  'ai-chip-shortage': {
    name: 'AI Chip Supply Crunch',
    id: 'ai-chip-shortage',
    description: 'Demand for AI accelerators (GPUs, TPUs, custom AI chips) outstrips supply. NVIDIA H100/B100 lead times extend to 6+ months.',
    probability: 'high',
    affectedCompanies: [
      { ticker: 'AAPL', impact: 'minor', reason: 'May compete with AI chips for TSMC capacity, but has priority.' },
      { ticker: 'AMD', impact: 'moderate', reason: 'AI GPU supply constrained. Could gain share but capacity limited.' },
    ],
    beneficiaries: [
      { ticker: 'TSM', reason: 'Sole manufacturer of advanced AI chips. Pricing power increases.' },
      { key: 'SK_HYNIX', reason: 'HBM memory is essential for AI chips. Supply tightness helps margins.' },
      { ticker: 'SSNLF', reason: 'HBM and foundry both benefit from AI chip demand.' },
      { ticker: 'ASML', reason: 'More EUV machines needed to expand AI chip capacity.' },
    ],
    investmentImplications: [
      'AI chip suppliers have multi-year backlog and pricing power',
      'HBM memory makers (SK Hynix leading) benefit from packaging with AI chips',
      'Cloud providers may vertically integrate, designing custom chips',
      'Equipment suppliers see sustained demand for capacity expansion',
      'Competition emerging from AMD, Intel, and custom chips (Google TPU, Amazon Trainium)',
    ],
  },

  'apple-modem-transition': {
    name: 'Apple In-House Modem Launch',
    id: 'apple-modem-transition',
    description: 'Apple successfully launches its own 5G modem, reducing or eliminating dependence on Qualcomm. Expected around 2025-2027.',
    probability: 'medium',
    affectedCompanies: [
      { ticker: 'QCOM', impact: 'severe', reason: 'Apple represents ~22% of revenue. Loss would significantly impact earnings.' },
      { ticker: 'AVGO', impact: 'minor', reason: 'Some RF components may be replaced, but Apple relationship is broader.' },
      { ticker: 'SWKS', impact: 'minor', reason: 'RF components exposed, but may retain some design wins.' },
    ],
    beneficiaries: [
      { ticker: 'AAPL', reason: 'Better margins, tighter integration, reduced supplier dependency.' },
      { ticker: 'TSM', reason: "Will manufacture Apple's modem. Volume shift from Qualcomm to Apple." },
    ],
    investmentImplications: [
      'Qualcomm must diversify beyond mobile (automotive, IoT, XR) to offset Apple loss',
      "Apple's vertical integration strategy continues - watch for more in-house chips",
      "Qualcomm's licensing business provides some cushion (royalties on all 5G phones)",
      'Transition may be gradual - some iPhones may keep Qualcomm for years',
      "MediaTek unlikely to benefit as Apple wouldn't use competitor chips",
    ],
  },
};


// ============================================
// PRODUCT TEARDOWNS — keyed by product ID
// ============================================

export const PRODUCT_TEARDOWNS = {
  'iphone-15-pro': {
    name: 'iPhone 15 Pro',
    id: 'iphone-15-pro',
    manufacturer: 'AAPL',
    manufacturerName: 'Apple',
    category: 'electronics',
    description: "Apple's flagship smartphone featuring the A17 Pro chip, titanium design, and advanced camera system. A marvel of global supply chain coordination with 200+ suppliers worldwide.",
    components: [
      { name: 'A17 Pro Chip', category: 'semiconductor', supplierTicker: 'TSM', supplierName: 'TSMC', importance: 'critical', description: 'Industry-first 3nm process technology with 19 billion transistors.' },
      { name: 'Super Retina XDR Display', category: 'display', supplierTicker: 'SSNLF', supplierName: 'Samsung Display', importance: 'critical', description: '6.1" ProMotion OLED display with 120Hz adaptive refresh rate.' },
      { name: 'OLED Display (Secondary)', category: 'display', supplierTicker: 'LPL', supplierName: 'LG Display', importance: 'medium', description: 'Secondary display supplier to reduce Samsung dependency.' },
      { name: 'Image Sensors (48MP + 12MP)', category: 'semiconductor', supplierTicker: 'SONY', supplierName: 'Sony', importance: 'critical', description: '48MP main sensor with quad-pixel technology. Sony dominates with ~50% market share.' },
      { name: 'Ceramic Shield Front Glass', category: 'materials', supplierTicker: 'GLW', supplierName: 'Corning', importance: 'medium', description: 'Nano-ceramic crystals for 4x better drop performance. Exclusive to Apple.' },
      { name: 'LPDDR5 RAM (8GB)', category: 'semiconductor', supplierTicker: null, supplierName: 'SK Hynix', supplierKey: 'SK_HYNIX', importance: 'high', description: '8GB LPDDR5 memory enabling advanced multitasking and on-device AI.' },
      { name: '5G Modem (Snapdragon X70)', category: 'semiconductor', supplierTicker: 'QCOM', supplierName: 'Qualcomm', importance: 'critical', description: "Qualcomm's 5G modem with AI-powered signal optimization. Apple developing in-house alternative." },
      { name: 'Wi-Fi 6E & Bluetooth Chip', category: 'semiconductor', supplierTicker: 'AVGO', supplierName: 'Broadcom', importance: 'high', description: 'Broadcom BCM4388 providing Wi-Fi 6E and Bluetooth 5.3 connectivity.' },
      { name: 'RF Front-End Module', category: 'semiconductor', supplierTicker: 'SWKS', supplierName: 'Skyworks', importance: 'high', description: 'RF filtering and amplification for cellular connectivity.' },
      { name: 'RF Components', category: 'semiconductor', supplierTicker: 'QRVO', supplierName: 'Qorvo', importance: 'high', description: 'RF filters, switches, and amplifiers. Apple splits RF supply between Skyworks and Qorvo.' },
      { name: 'Power Management ICs', category: 'semiconductor', supplierTicker: 'TXN', supplierName: 'Texas Instruments', importance: 'medium', description: 'Voltage and power distribution throughout the device.' },
      { name: 'Face ID Sensors', category: 'semiconductor', supplierTicker: 'STM', supplierName: 'STMicroelectronics', importance: 'high', description: 'Flood illuminator and proximity sensor for TrueDepth camera / Face ID.' },
      { name: 'Final Assembly', category: 'manufacturing', supplierTicker: 'HNHPF', supplierName: 'Foxconn', importance: 'critical', description: 'Foxconn assembles the majority of iPhone 15 Pro units in China and India.' },
    ],
    investmentAngles: [
      'TSMC has a near-monopoly on cutting-edge chip manufacturing - every iPhone sold generates TSMC revenue',
      'Qualcomm earns ~$8-9 per iPhone in modem royalties until Apple develops in-house 5G (expected 2025-2026)',
      'Sony controls ~50% of smartphone image sensors - benefits from camera improvements across all brands',
      "Corning's Ceramic Shield is exclusive to Apple - premium pricing power on specialty glass",
      'Broadcom and RF suppliers (Skyworks/Qorvo) depend heavily on Apple - watch for Apple in-sourcing risk',
      'Memory prices are cyclical - SK Hynix profits surge when supply tightens',
      'Foxconn margins are thin but volume is massive - 200M+ iPhones annually',
    ],
  },

  'tesla-model-3': {
    name: 'Tesla Model 3',
    id: 'tesla-model-3',
    manufacturer: 'TSLA',
    manufacturerName: 'Tesla',
    category: 'automotive',
    description: "The world's best-selling electric vehicle. A rolling computer with a massive battery, representing the future of transportation.",
    components: [
      { name: 'Battery Cells (US)', category: 'battery', supplierTicker: 'PCRFY', supplierName: 'Panasonic', importance: 'critical', description: "Panasonic supplies 2170 cells for Tesla's Nevada Gigafactory. Battery is ~30% of car cost." },
      { name: 'Battery Cells (China)', category: 'battery', supplierTicker: 'CATL', supplierName: 'CATL', importance: 'critical', description: "CATL supplies LFP batteries for Shanghai-made Model 3s. World's largest EV battery maker." },
      { name: 'FSD Computer & MCU', category: 'semiconductor', supplierTicker: 'AMD', supplierName: 'Samsung / AMD', importance: 'critical', description: 'Custom AI chips for Full Self-Driving, manufactured by Samsung. Infotainment from AMD.' },
      { name: 'Glass Roof & Windows', category: 'materials', supplierTicker: null, supplierName: 'AGC / Fuyao', importance: 'medium', description: "Large glass roof panels. Tesla's glass roofs use more glass per vehicle than traditional cars." },
      { name: 'Aluminum Body Panels', category: 'materials', supplierTicker: 'HNDL.NS', supplierName: 'Novelis', importance: 'high', description: 'Lightweight aluminum helps extend EV range by reducing weight.' },
      { name: 'Electric Motors', category: 'other', supplierTicker: null, supplierName: 'Tesla (In-house)', importance: 'critical', description: 'Permanent magnet motors using rare earth materials, often sourced from China.' },
    ],
    investmentAngles: [
      'Battery suppliers like CATL and Panasonic benefit from ALL EV growth, not just Tesla',
      'Rare earth materials for motors are a potential supply chain bottleneck',
      "AMD's automotive chip business is growing rapidly with EV adoption",
      'Aluminum demand is surging as EVs prioritize lightweight materials',
      'Battery chemistry is evolving - LFP vs NMC has different supplier implications',
    ],
  },

  'nike-air-max': {
    name: 'Nike Air Max',
    id: 'nike-air-max',
    manufacturer: 'NKE',
    manufacturerName: 'Nike',
    category: 'apparel',
    description: 'Iconic sneaker with visible Air cushioning. Behind the swoosh is a complex global manufacturing network spanning Asia.',
    components: [
      { name: 'Rubber Outsole', category: 'materials', supplierTicker: 'STA.BK', supplierName: 'Sri Trang', importance: 'high', description: "Natural and synthetic rubber from Southeast Asian suppliers. Sri Trang is one of the world's largest rubber producers." },
      { name: 'Foam Midsole', category: 'materials', supplierTicker: 'DOW', supplierName: 'BASF / Dow', importance: 'high', description: 'EVA and specialized foams. BASF and Dow supply raw materials for performance foams.' },
      { name: 'Upper Materials', category: 'materials', supplierTicker: '2313.HK', supplierName: 'Shenzhou International', importance: 'high', description: 'Mesh, Flyknit, and synthetic materials. Major supplier of knitted shoe uppers.' },
      { name: 'Manufacturing (Vietnam)', category: 'manufacturing', supplierTicker: '9904.TW', supplierName: 'Pou Chen / Feng Tay', importance: 'critical', description: 'Vietnam produces ~50% of Nike shoes. Pou Chen and Feng Tay are key manufacturing partners.' },
      { name: 'Air-Sole Unit', category: 'other', supplierTicker: null, supplierName: 'Nike (Proprietary)', importance: 'critical', description: 'Proprietary pressurized air cushioning technology - Nike guards this tech closely.' },
    ],
    investmentAngles: [
      "Vietnam manufacturing exposure - wage inflation and trade policy affect Nike's margins",
      'Pou Chen makes shoes for Nike, Adidas, and others - diversified athletic footwear exposure',
      'Raw material costs (rubber, petroleum-based synthetics) impact the entire footwear industry',
      'Automation in shoe manufacturing could shift supplier dynamics significantly',
      'ESG focus is pushing Nike toward recycled materials, creating new supplier opportunities',
    ],
  },

  'playstation-5': {
    name: 'PlayStation 5',
    id: 'playstation-5',
    manufacturer: 'SONY',
    manufacturerName: 'Sony',
    category: 'gaming',
    description: 'Sony\'s flagship gaming console powered by custom AMD silicon. Sold at a loss initially, with money made on games and services.',
    components: [
      { name: 'Custom AMD APU', category: 'semiconductor', supplierTicker: 'AMD', supplierName: 'AMD / TSMC', importance: 'critical', description: 'Zen 2 CPU + RDNA 2 GPU in a custom SoC. AMD designs it, TSMC manufactures on 7nm.' },
      { name: 'Custom SSD', category: 'semiconductor', supplierTicker: 'WDC', supplierName: 'Western Digital', importance: 'critical', description: '825GB ultra-fast NVMe SSD. Controllers and NAND from various suppliers.' },
      { name: 'GDDR6 Memory', category: 'semiconductor', supplierTicker: 'MU', supplierName: 'Samsung / Micron', importance: 'critical', description: '16GB of high-speed GDDR6 RAM for graphics.' },
      { name: 'Power Supply Unit', category: 'other', supplierTicker: '2308.TW', supplierName: 'Delta Electronics', importance: 'high', description: 'Delta Electronics supplies PSUs for many gaming consoles. Critical for 350W power demands.' },
      { name: 'Blu-ray Drive', category: 'other', supplierTicker: 'APELY', supplierName: 'Alps Alpine', importance: 'medium', description: "Ultra HD Blu-ray optical drive. Sony's own optical division and Alps Alpine." },
      { name: 'Cooling System', category: 'other', supplierTicker: 'NJDCY', supplierName: 'Nidec', importance: 'high', description: 'Large custom fan and heatsink. Nidec supplies cooling fans for many consumer electronics.' },
    ],
    investmentAngles: [
      "AMD's semi-custom business provides steady revenue from Sony and Microsoft console deals",
      'Console launches drive demand for GDDR6 memory - Micron benefits from gaming cycles',
      'TSMC manufactures chips for PS5, Xbox, and Nintendo - gaming is a key customer segment',
      'SSD demand from gaming is pushing storage innovation and benefiting WDC, Seagate',
      'Console generations are 6-7 year cycles - supplier relationships span long periods',
    ],
  },

  'starbucks-latte': {
    name: 'Starbucks Latte',
    id: 'starbucks-latte',
    manufacturer: 'SBUX',
    manufacturerName: 'Starbucks',
    category: 'food_beverage',
    description: "The world's most recognized coffee drink. From farm to cup, involving global commodity markets and packaging giants.",
    components: [
      { name: 'Coffee Beans', category: 'materials', supplierTicker: null, supplierName: 'Global Commodity', importance: 'critical', description: 'Arabica beans sourced globally. Traded on ICE futures. Brazil, Vietnam, Colombia are top producers.' },
      { name: 'Milk & Dairy', category: 'materials', supplierTicker: 'OTLY', supplierName: 'Various / Oatly', importance: 'critical', description: 'Regional dairy suppliers. Oat milk from Oatly growing fast.' },
      { name: 'Paper Cups', category: 'materials', supplierTicker: 'IP', supplierName: 'International Paper', importance: 'high', description: 'Billions of cups annually. International Paper and Georgia-Pacific are major suppliers.' },
      { name: 'Plastic Lids & Straws', category: 'materials', supplierTicker: 'BERY', supplierName: 'Berry Global', importance: 'medium', description: 'Transitioning to recyclable materials.' },
      { name: 'Espresso Machines', category: 'manufacturing', supplierTicker: null, supplierName: 'Thermoplan', importance: 'critical', description: 'Custom Mastrena machines. Equipment standardization ensures consistent quality globally.' },
      { name: 'POS & Mobile Systems', category: 'software', supplierTicker: 'XYZ', supplierName: 'Block / Oracle', importance: 'high', description: 'Square/Block processes many payments. Starbucks app is one of the most-used mobile payment platforms.' },
    ],
    investmentAngles: [
      'Coffee commodity prices directly impact Starbucks margins - watch ICE coffee futures',
      'Plant-based milk trend benefits Oatly but pressures traditional dairy',
      'Packaging sustainability push creates opportunities for innovative materials companies',
      'Payment processing volume through Starbucks app benefits digital payment companies',
      'International Paper has exposure to the entire food service packaging industry',
    ],
  },
};


// ============================================
// REVERSE LOOKUP: TICKER → PRODUCTS
// Built automatically from PRODUCT_TEARDOWNS
// ============================================

export const TICKER_TO_PRODUCTS = {};

// Build the reverse index at module init
for (const [productId, product] of Object.entries(PRODUCT_TEARDOWNS)) {
  for (const comp of product.components) {
    const ticker = comp.supplierTicker;
    if (!ticker) continue;
    if (!TICKER_TO_PRODUCTS[ticker]) {
      TICKER_TO_PRODUCTS[ticker] = [];
    }
    TICKER_TO_PRODUCTS[ticker].push({
      product: product.name,
      productId,
      component: comp.name,
      category: comp.category,
    });
  }
}

// Also build reverse index for SK_HYNIX (no ticker, uses supplierKey)
for (const [productId, product] of Object.entries(PRODUCT_TEARDOWNS)) {
  for (const comp of product.components) {
    if (comp.supplierKey === 'SK_HYNIX') {
      if (!TICKER_TO_PRODUCTS.SK_HYNIX) {
        TICKER_TO_PRODUCTS.SK_HYNIX = [];
      }
      TICKER_TO_PRODUCTS.SK_HYNIX.push({
        product: product.name,
        productId,
        component: comp.name,
        category: comp.category,
      });
    }
  }
}
