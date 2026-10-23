import { newWorld } from '../src/core/world';
import { advance, botTurn } from '../src/core/sim';
import { alive, bloodLiving } from '../src/core/people';
import { year } from '../src/core/calendar';
import { nam } from '../src/core/assets';

const N = Number(process.argv[2] ?? 40);
const YEARS = Number(process.argv[3] ?? 100);
const rows: Record<string, number>[] = [];
for (let i = 0; i < N; i++) {
  const w = newWorld({ seed: 77 + i * 104729 });
  const end = w.m + YEARS * 12;
  let peakCash = 0, debtYears = 0, gen = 1;
  const seenPlayers = new Set([w.playerId]);
  while (w.m < end && !w.over) {
    botTurn(w);
    if (!advance(w)) botTurn(w);
    peakCash = Math.max(peakCash, w.hh.cash);
    if (w.m % 12 === 0 && w.hh.debt > 0) debtYears++;
    if (!seenPlayers.has(w.playerId)) { seenPlayers.add(w.playerId); gen++; }
  }
  rows.push({
    sonYil: year(w.m), bitti: w.over ? 1 : 0, nesil: gen, tapuYili: w.flags.ilkTapu ? year(w.flags.ilkTapu as number) : 0,
    donum: w.hh.land, nakit: w.hh.cash, borc: w.hh.debt, borcluYil: debtYears,
    hane: w.hh.members.length, kan: bloodLiving(w).length, kisi: Object.keys(w.people).length,
    olu: Object.values(w.people).filter((p) => !alive(p)).length,
    kacak: (w.flags.kacakToplam as number) || 0, ev: w.hh.house, trak: w.hh.veh.traktor || 0, isl: Object.keys(w.hh.biz).length, nam: nam(w), lab: w.lab?.lvl || 0, labK: Math.round(Number(w.flags.labKazanc || 0) / 1e6), kanOlu: w.rival.dead, feud: Math.round(w.rival.feud), oda: Object.values(w.hh.rooms).reduce((a, b) => a + (b || 0), 0), hapis: w.chronicle.filter((e) => e.t.includes('hapis yattı')).length, baskin: w.chronicle.filter((e) => e.t.includes('aksın')).length, isi: Math.round(w.heat),
  });
}
const avg = (k: string) => (rows.reduce((s, r) => s + r[k], 0) / rows.length).toFixed(1);
console.table(rows.slice(0, 12));
console.log('ORTALAMA', Object.fromEntries(Object.keys(rows[0]).map((k) => [k, avg(k)])));
console.log('Tapu alan kampanya:', rows.filter((r) => r.tapuYili).length, '/', N, ' Hanedanı sönen:', rows.filter((r) => r.bitti).length);
const ty = rows.filter((r) => r.tapuYili).map((r) => r.tapuYili).sort();
console.log('İlk tapu yılları:', ty.join(' '));
