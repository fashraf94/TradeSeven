import { computeArchetypeRankings } from '../../api/_utils/archetypeScoring.js';
import screenStocks from '../../api/_utils/screenStocks.js';
import { genUniverse } from './universe.mjs';
import { FOCUSES } from './focuses.mjs';

const U = genUniverse('tech_led_bull', 1);
const arch = 'momentum_chaser';
const ranked = computeArchetypeRankings(U, arch);
const N = ranked.length;
console.log(`universe=${N}  archetype=${arch}`);
console.log('archetypeScore: max', ranked[0].archetypeScore, ' decile', ranked[Math.round(0.1*N)].archetypeScore,
  ' median', ranked[Math.round(0.5*N)].archetypeScore, ' rank36', ranked[35].archetypeScore, ' rank96', ranked[95].archetypeScore, ' min', ranked[N-1].archetypeScore);
const spread = ranked[Math.round(0.1*N)].archetypeScore - ranked[Math.round(0.5*N)].archetypeScore;
console.log('spread(decile-median)=', spread.toFixed(2), ' bonus@1x=', (spread*0.6).toFixed(2));

const wl = (key) => screenStocks(U, FOCUSES[key](U, 15)).results.map(r => r.symbol);
const cw = wl('chaseWinners'), slr = wl('sectorLeadersRaw'), sl = wl('sectorLeadersRel');
console.log('\nChaseWinners WL   :', cw.join(' '));
console.log('SectorLeadRaw WL  :', slr.join(' '));
console.log('SectorLeadRel WL  :', sl.join(' '));

const preRank = new Map(ranked.map((s,i)=>[s.symbol,i+1]));
const inBand = (sym) => (preRank.get(sym)||1e9) <= Math.round(0.4*N);
console.log('\nChaseWinners pre-ranks :', cw.map(s=>`${s}:${preRank.get(s)}`).join(' '));
console.log('SectorLeadRel pre-ranks:', sl.map(s=>`${s}:${preRank.get(s)}`).join(' '));
console.log('eligible(in band top40%): CW', cw.filter(inBand).length, ' SLrel', sl.filter(inBand).length);

console.log('\nbaseline top6 by archetypeScore:', ranked.slice(0,6).map(s=>s.symbol).join(' '));
console.log('baseline top6 baggerBombFit   :', ranked.slice(0,6).map(s=>s.baggerBombFit).join(' '));
