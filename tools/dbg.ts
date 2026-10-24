import { newWorld } from '../src/core/world';
import { advance, botTurn } from '../src/core/sim';
import { year } from '../src/core/calendar';
const keys = ['Ağa öldü', 'Bozbey konağı', 'niyet', 'kuzu', 'sana küstü', 'barışıldı', 'üç gün düğün', 'amcazade', 'yeni komutan', 'Rıza emekli', 'dağıldı', 'Selim', 'tütün', 'ayçiçeği', 'yeni ağası', 'ek ev', '. ev yapıldı'];
const tot: Record<string, number> = {};
let cards = 0;
for (let i = 0; i < 10; i++) {
  const w = newWorld({ seed: 500 + i * 7777 });
  while (!w.over && year(w.m) < 2060) { botTurn(w); if (!advance(w)) botTurn(w); }
  cards += Number(w.flags.kartSay || 0);
  for (const k of keys) tot[k] = (tot[k] || 0) + w.chronicle.filter((e) => e.t.toLowerCase().includes(k.toLowerCase())).length;
}
console.log(tot, 'kart/kampanya', cards / 10);
