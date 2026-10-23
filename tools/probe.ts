import { newWorld } from '../src/core/world';
import { advance, botTurn } from '../src/core/sim';
import { year } from '../src/core/calendar';
import { hhMembers, age } from '../src/core/people';
let found = 0;
for (let i = 0; i < 30 && found < 1; i++) {
  const w = newWorld({ seed: 77 + i * 104729 });
  for (let k = 0; k < 12 * 15; k++) { botTurn(w); advance(w); }
  if (w.hh.parcels.length) continue;
  found++;
  const w2 = newWorld({ seed: 77 + i * 104729 });
  for (let k = 0; k < 12 * 15; k++) {
    botTurn(w2); advance(w2);
    if (w2.m % 12 === 0) {
      console.log(year(w2.m), 'nakit', w2.hh.cash, 'borç', w2.hh.debt, 'feud', Math.round(w2.rival.feud), 'lock', w2.rival.lock, 'hane', hhMembers(w2).map(p => `${p.first}${age(w2,p)}:${p.job}${p.away?'/'+p.away:''}`).join(' '));
      console.log('   ', w2.lines.map(l => `${l.t}:${l.v}`).join(' | '));
    }
  }
  console.log(w2.chronicle.slice(-40).map(c => year(c.m) + ' ' + c.t).join('\n'));
}
