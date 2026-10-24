import { newWorld } from '../src/core/world';
import { advance, botTurn } from '../src/core/sim';
import { year } from '../src/core/calendar';
const keys = ['vasiyet', 'küp', 'Nazmiye', 'mektup', 'Köprü', 'film', 'demiryolu', 'Gazete', 'Radyo', 'Televizyon', 'dost fiyatına', 'Salgın', 'Hacı Ömer', 'berberde'];
const tot: Record<string, number> = {};
for (let i = 0; i < 10; i++) {
  const w = newWorld({ seed: 900 + i * 7777 });
  while (!w.over && year(w.m) < 2060) { botTurn(w); if (!advance(w)) botTurn(w); }
  for (const k of keys) tot[k] = (tot[k] || 0) + w.chronicle.filter((e) => e.t.toLowerCase().includes(k.toLowerCase())).length;
  for (const q of ['vasiyet', 'kup', 'ogretmen', 'mektup', 'kopru', 'film', 'tren']) tot['Q ' + q] = (tot['Q ' + q] || 0) + (w.flags['q_' + q] ? 1 : 0);
}
console.log(tot);
