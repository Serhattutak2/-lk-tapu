// Köyün toprak piyasası: haritadaki her tarla bir parseldir; sahibi, verimi ve fiyatı vardır.
// Geometri burada durur ki hem simülasyon hem harita aynı tabloyu kullansın.
import { hatir, hatirBonus, komsuOfPlot } from './komsu';
import { niyetIs } from './yil';
import type { PlotState, World } from './types';
import { chance, clamp, rand } from './rng';
import { infl, year } from './calendar';
import { log } from './people';

export interface PlotDef {
  x: number;
  y: number;
  owner: string;      // başlangıç sahibinin adı
  aga: boolean;       // ağanın toprağı mı
  q: number;          // verim çarpanı
  yer: string;        // mevki adı
}

const A = (x: number, y: number, q: number, yer: string): PlotDef => ({ x, y, owner: 'Bozbey Ağa', aga: true, q, yer });
const K = (x: number, y: number, owner: string, q: number, yer: string): PlotDef => ({ x, y, owner, aga: false, q, yer });

/** 3×2 karoluk, 5'er dönümlük tarlalar. */
export const PLOTS: PlotDef[] = [
  K(15, 11, 'Deli Hamza', 0.9, 'Köy kenarı'),
  K(15, 13, 'Topal Osman', 0.95, 'Köy kenarı'),
  K(15, 15, 'Dul Hatice', 0.85, 'Taşlık'),
  K(12, 15, 'Berber Sami', 0.9, 'Taşlık'),
  K(12, 11, 'Hacı Ömer', 1.0, 'Çeşme altı'),
  K(9, 15, 'Kör Veli', 0.85, 'Taşlık'),
  K(12, 13, 'Bekçi Nuri', 0.95, 'Çeşme altı'),
  K(9, 11, 'Muhtar Rıfat', 1.05, 'Okul arkası'),
  K(0, 11, 'Hacı Ömer', 1.0, 'Haşhaşlık'),
  A(0, 0, 1.2, 'Ağa düzü'),
  A(3, 0, 1.2, 'Ağa düzü'),
  A(0, 2, 1.15, 'Ağa düzü'),
  A(3, 2, 1.2, 'Ağa düzü'),
  A(0, 4, 1.1, 'Ağa düzü'),
  A(3, 4, 1.15, 'Ağa düzü'),
  A(11, 0, 1.25, 'Dere boyu'),
  A(14, 0, 1.25, 'Dere boyu'),
  A(11, 2, 1.2, 'Dere boyu'),
  A(14, 2, 1.2, 'Dere boyu'),
  A(11, 4, 1.15, 'Dere boyu'),
  A(14, 4, 1.15, 'Dere boyu'),
  A(0, 14, 1.05, 'Aşağı ova'),
  A(3, 14, 1.05, 'Aşağı ova'),
  A(0, 16, 1.0, 'Aşağı ova'),
  A(3, 16, 1.0, 'Aşağı ova'),
];

export function initPlots(w: World) {
  w.plots = PLOTS.map((d): PlotState => ({ o: d.aga ? 'aga' : 'koy', ask: 1, sale: false, mad: 0 }));
  // İlk yıl bir köylü tarlası satışta olur ki hedef görünsün
  const k = w.plots.findIndex((p, i) => p.o === 'koy' && PLOTS[i].owner === 'Deli Hamza');
  if (k >= 0) w.plots[k].sale = true;
}

export const landBase = (w: World) => 12500 * infl(w.m);

export function plotPrice(w: World, i: number): number {
  const d = PLOTS[i];
  const s = w.plots[i];
  return Math.round((landBase(w) * d.q * s.ask * (d.aga ? 1.45 : 1)) / 100) * 100;
}

export function plotOwnerName(w: World, i: number): string {
  const s = w.plots[i];
  if (s.o === 'biz') return `${w.surname} ailesi`;
  if (s.o === 'aga') return 'Bozbey Ağa';
  if (s.o === 'rakip') return 'Kocabaş ailesi';
  return (w.flags['sahip' + i] as string) || PLOTS[i].owner;
}

export const plotOfParcel = (w: World, pid: string) => w.plots.findIndex((p) => p.pid === pid);

/** Her Ocak: köylüler tarla satar ya da vazgeçer, ağa zor günde toprak satar. */
export function yearlyMarket(w: World, nam: number) {
  w.plots.forEach((p, i) => {
    if (p.o === 'koy') {
      const kid = komsuOfPlot(i);
      const dost = kid && !w.flags['sahip' + i] ? hatir(w, kid) >= 50 : false;
      if (!p.sale && chance(w, dost ? 0.16 : 0.1)) {
        p.sale = true;
        p.ask = clamp(0.95 + rand(w) * 0.2 - (dost ? 0.1 : 0), 0.82, 1.2);
        log(w, dost ? `${plotOwnerName(w, i)}, ${PLOTS[i].yer} mevkiindeki tarlasını satmaya karar verdi ve önce sana, dost fiyatına teklif etti.` : `${plotOwnerName(w, i)}, ${PLOTS[i].yer} mevkiindeki tarlasını satışa çıkardı.`, 'tapu');
      } else if (p.sale && chance(w, 0.2)) {
        p.sale = false;
      }
    }
    if (p.o === 'aga') p.sale = w.flags.agaOldu ? chance(w, 0.35) : nam >= 55 && chance(w, 0.25);
  });
  void year;
}

export type OfferResult = 'ok' | 'red' | 'blok' | 'para';

/** Satıştaki tarla: ilan fiyatına alınır. Satışta olmayan: teklif %30 fazlasıyla, kabul şansı sınırlı. */
export function offerChance(w: World, i: number, nam: number): number {
  const s = w.plots[i];
  if (s.o === 'biz') return 0;
  if (s.sale) return 1;
  if ((s.madM ?? -1) > w.m) return 0;
  if (s.o === 'rakip') return w.rival.feud < 10 && nam >= 30 ? 0.2 : 0;
  const gozu = w.flags.odul_toprakgozu ? 0.12 : 0;
  if (s.o === 'aga') return nam >= 40 ? clamp(0.18 + (nam - 40) / 110 + gozu, 0, 0.68) : 0;
  // Köylüler: adın büyüdükçe, muhtarlık sendeyse ya da muhtarın gözündeysen daha kolay satarlar
  const muhtar = w.pol?.seat === 'muhtar' ? 0.12 : w.flags.koyTarafi ? 0.06 : 0;
  return clamp(0.38 + nam / 220 + muhtar + gozu + (niyetIs(w, 'toprak') ? 0.08 : 0) + hatirBonus(w, i), 0.2, 0.92);
}

export function offerPrice(w: World, i: number): number {
  const base = plotPrice(w, i);
  return w.plots[i].sale ? base : Math.round((base * 1.3) / 100) * 100;
}
