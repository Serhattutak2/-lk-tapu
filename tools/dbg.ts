import { newWorld } from '../src/core/world';
import { advance, resolveCard } from '../src/core/sim';
import { year, dateText } from '../src/core/calendar';
import { newParcel } from '../src/core/fields';
import type { CropId } from '../src/core/types';
const w = newWorld({ seed: 7 });
const plans: CropId[] = ['bugday', 'nohut', 'pancar', 'tutun', 'arpa', 'hashas'];
plans.forEach((c, i) => {
  const f = newParcel(w, 0);
  const j = w.plots.findIndex((p) => p.o !== 'biz');
  w.plots[j] = { o: 'biz', pid: f.id, ask: 1, sale: false, mad: 0 };
  f.plan = c;
});
w.hh.cash = 50000;
const sown: Record<string, number[]> = {};
const empty: Record<string, number> = {};
while (year(w.m) < 1950) {
  for (const f of w.hh.parcels) {
    const was = f.crop;
    void was;
  }
  const before = w.hh.parcels.map((f) => f.crop);
  const n0 = w.hh.parcels.length; const c0 = w.chronicle.length;
  if (!advance(w)) {
    const c = w.cards[0];
    resolveCard(w, c.uid, c.opts[0].k);
    continue;
  }
  w.hh.parcels.forEach((f, i) => {
    if (!before[i] && f.crop) (sown[f.plan!] ??= []).push(year(w.m));
    if (!f.crop) empty[f.plan!] = (empty[f.plan!] || 0) + 1;
  });
  if (w.hh.parcels.length !== n0) console.log(dateText(w.m), 'PARSEL', n0, '->', w.hh.parcels.length, w.chronicle.slice(c0).map((e) => e.t).join(' | '));
  if (w.hh.cash < 5000) w.hh.cash = 50000;
  if (w.hh.debt) { const a = Math.min(w.hh.debt, w.hh.cash); w.hh.debt -= a; w.hh.cash -= a; }
}
for (const k of Object.keys(sown)) console.log(k, sown[k].length, 'ekim', sown[k].slice(0, 30).join(' '), 'boş ay', empty[k]);
console.log(w.hh.parcels.map((f) => `${f.no}:${f.plan}:${f.mode}`).join(' '));
