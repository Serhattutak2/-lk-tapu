import { newWorld } from '../src/core/world';
import { advance, botTurn } from '../src/core/sim';
import { year, dateText } from '../src/core/calendar';
const i = Number(process.argv[2] ?? 1);
const y1 = Number(process.argv[3] ?? 1940), y2 = Number(process.argv[4] ?? 1950);
const w = newWorld({ seed: 77 + i * 104729 });
let n = 0;
while (!w.over && year(w.m) <= y2) {
  botTurn(w);
  if (!advance(w)) botTurn(w);
  if (year(w.m) >= y1) {
    if (w.m % 12 === 0) console.log('--', year(w.m), 'cash', w.hh.cash, 'debt', w.hh.debt, 'rent', w.hh.rent);
    for (const e of w.chronicle.slice(n)) console.log('  ', dateText(e.m), e.t);
  }
  n = w.chronicle.length;
}
