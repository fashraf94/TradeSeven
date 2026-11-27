// scripts/research-directory-corrections.mjs
//
// Research universe, Build 2 (PR A): THE NAMED CORRECTIONS LIST for the research directory (founder rulings RU-6, RU-7,
// RU-8, RU-11 and RU-13 of Nov 26, 2026). Data only: no imports, no code that runs.
//
// scripts/build-research-directory.mjs applies it on every run and lists, in its run report, every correction it
// applied, every correction that named a symbol the fetch did not hold (stale), and every correction that had no
// effect (and why). A monthly rebuild reviews the list: a stale correction is removed there, by hand.
//
// Kinds:
//   leaveOut   a row the filters keep that is not an operating company's common stock, or a second share class of a
//              game stock (RU-13). It is dropped with the reason 'correction_leave_out'.
//   sectorFix  a vendor sector or industry that is wrong; the house sector id and the industry it gets instead.
//   restore    a common share the vendor types "Preferred Stock". The type filter lets it through; every other filter
//              still applies, so a restored symbol still needs a name and a sector that maps to a house sector.
//   venues     a listing venue besides NYSE, NASDAQ and NYSE American whose common stock is kept. Every other filter
//              still applies (an ETF on BATS is still dropped by type). Every row it lets in is named in the run report.
//
// Every entry carries the ruling it rests on and a one-line reason.

export const DIRECTORY_CORRECTIONS = Object.freeze({
  leaveOut: Object.freeze([
    // RU-6: investment funds are left out, including those the vendor labels as ordinary stocks. Business development
    // companies stay (they are listed operating companies).
    { symbol: 'BCAT', kind: 'closed_end_fund', ruling: 'RU-6', reason: 'BlackRock Capital Allocation Trust: a closed-end fund typed Common Stock' },
    { symbol: 'BTT', kind: 'closed_end_fund', ruling: 'RU-6', reason: 'BlackRock Municipal Target Term Trust: a closed-end fund typed Common Stock' },
    { symbol: 'CET', kind: 'closed_end_fund', ruling: 'RU-6', reason: 'Central Securities Corporation: a closed-end fund typed Common Stock' },
    { symbol: 'DXYZ', kind: 'closed_end_fund', ruling: 'RU-6', reason: 'Destiny Tech100: a closed-end fund typed Common Stock' },
    { symbol: 'ECAT', kind: 'closed_end_fund', ruling: 'RU-6', reason: 'BlackRock ESG Capital Allocation Trust: a closed-end fund typed Common Stock' },
    { symbol: 'FSCO', kind: 'closed_end_fund', ruling: 'RU-6', reason: 'FS Credit Opportunities: a closed-end fund typed Common Stock' },
    { symbol: 'GAM', kind: 'closed_end_fund', ruling: 'RU-6', reason: 'General American Investors: a closed-end fund typed Common Stock' },
    { symbol: 'HQH', kind: 'closed_end_fund', ruling: 'RU-6', reason: 'Tekla Healthcare Investors: a closed-end fund typed Common Stock' },
    { symbol: 'NBXG', kind: 'closed_end_fund', ruling: 'RU-6', reason: 'Neuberger Berman Next Generation Connectivity Fund: a closed-end fund typed Common Stock' },
    { symbol: 'PDO', kind: 'closed_end_fund', ruling: 'RU-6', reason: 'PIMCO Dynamic Income Opportunities Fund: a closed-end fund typed Common Stock' },
    { symbol: 'PSUS', kind: 'closed_end_fund', ruling: 'RU-6', reason: 'Pershing Square USA: a closed-end fund typed Common Stock' },
    { symbol: 'RVT', kind: 'closed_end_fund', ruling: 'RU-6', reason: 'Royce Value Trust: a closed-end fund typed Common Stock' },
    { symbol: 'STEW', kind: 'closed_end_fund', ruling: 'RU-6', reason: 'SRH Total Return Fund: a closed-end fund typed Common Stock' },
    { symbol: 'TY', kind: 'closed_end_fund', ruling: 'RU-6', reason: 'Tri-Continental Corporation: a closed-end fund typed Common Stock' },
    // RU-7: vendor errors.
    { symbol: 'DTW', kind: 'debt', ruling: 'RU-7', reason: 'a DTE Energy debenture the vendor types Common Stock (filed as a residential REIT)' },
    { symbol: 'AFGE', kind: 'debt', ruling: 'RU-7', reason: 'an American Financial Group debenture the vendor types Common Stock' },
    { symbol: 'VYLR', kind: 'shell', ruling: 'RU-7', reason: 'Vylor Inc.: a shell company with no trading history' },
    // RU-13: second share classes of game stocks are left out.
    { symbol: 'BRK-A', kind: 'game_share_class', ruling: 'RU-13', reason: 'Berkshire Hathaway class A: the game holds BRK-B' },
    { symbol: 'FOX', kind: 'game_share_class', ruling: 'RU-13', reason: 'Fox Corp class B: the game holds FOXA' },
    { symbol: 'LEN-B', kind: 'game_share_class', ruling: 'RU-13', reason: 'Lennar class B: the game holds LEN' },
    { symbol: 'NWSA', kind: 'game_share_class', ruling: 'RU-13', reason: 'News Corp class A: the game holds NWS' },
  ].map((e) => Object.freeze(e))),

  sectorFix: Object.freeze([
    { symbol: 'LION', sector: 'XLC', industry: 'Entertainment', ruling: 'RU-7', reason: 'Lionsgate Studios is a film and television studio; the vendor files it under Shell Companies' },
    { symbol: 'XXI', sector: 'XLF', industry: 'Capital Markets', ruling: 'RU-7', reason: 'Twenty One Capital is a bitcoin treasury company; the vendor files it under Education & Training Services' },
  ].map((e) => Object.freeze(e))),

  restore: Object.freeze([
    { symbol: 'MOG-B', ruling: 'RU-11', reason: 'Moog class B common shares, which the vendor types Preferred Stock' },
    { symbol: 'AGM-A', ruling: 'RU-11', reason: 'Farmer Mac class A common shares, which the vendor types Preferred Stock' },
  ].map((e) => Object.freeze(e))),

  venues: Object.freeze([
    { exchange: 'BATS', ruling: 'RU-8', reason: 'common stock listed on BATS is kept (brings in Cboe Global Markets)' },
  ].map((e) => Object.freeze(e))),
});
