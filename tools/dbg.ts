import { newWorld } from '../src/core/world';
import { advance, botTurn } from '../src/core/sim';
import { year } from '../src/core/calendar';
import { QUESTS } from '../src/core/quests';
const tot: Record<string, number> = {};
let kv = 0, cards = 0;
for (let i = 0; i < 10; i++) {
  const w = newWorld({ seed: 300 + i * 7777 });
  while (!w.over && year(w.m) < 2060) { botTurn(w); if (!advance(w)) botTurn(w); }
  for (const q of QUESTS) if (w.flags['q_' + q.id]) tot[q.id] = (tot[q.id] || 0) + 1;
  kv += Object.keys(w.flags).filter((k) => k.startsWith('kv_')).length;
  cards += Number(w.flags.kartSay || 0);
}
console.log(tot, 'köy olayları/kampanya', kv / 10, 'kart/kampanya', cards / 10);
