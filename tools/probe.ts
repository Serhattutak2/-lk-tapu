import { newWorld } from '../src/core/world';
import { advance, botTurn } from '../src/core/sim';
import { hhMembers, age } from '../src/core/people';
import { year } from '../src/core/calendar';
import { wage } from '../src/core/jobs';
const w = newWorld({ seed: Number(process.argv[2] ?? 5) });
let inc = 0, exp = 0;
for (let i = 0; i < 12 * 12; i++) {
  botTurn(w); advance(w); inc += w.lastIncome; exp += w.lastExpense;
  if (w.m % 12 === 1) {
    console.log(year(w.m) - 1, 'gelir', inc, 'gider', exp, 'nakit', w.hh.cash, 'borç', w.hh.debt, 'toprak', w.hh.land, 'hane', hhMembers(w).map(p => `${p.first}${age(w,p)}:${p.job}${p.away?'*':''}:${wage(w,p)}`).join(' '));
    inc = 0; exp = 0;
  }
}
