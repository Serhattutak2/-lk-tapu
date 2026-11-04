// Lüks ve eğlence: biriken parayı harcamanın keyifli yolu. Markalı arabalar (hangisini alacağına sen karar ver),
// ziyafet, tatil, yarış atı, kulüp başkanlığı... Hepsi para emer, karşılığında nam, saygı ve aile bağı verir.
import type { World } from './types';
import { clamp, chance, rint } from './rng';
import { infl, year } from './calendar';
import { log } from './people';

const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR');

export interface CarDef { id: string; brand: string; model: string; from: number; price: number; nam: number; }
/** Çağına göre açılan markalı arabalar; hangisini alacağını sen seçersin. */
export const CARS: CarDef[] = [
  { id: 'ford_a', brand: 'Ford', model: 'Model A', from: 1929, price: 9000, nam: 6 },
  { id: 'chevrolet', brand: 'Chevrolet', model: '', from: 1936, price: 15000, nam: 9 },
  { id: 'dodge', brand: 'Dodge', model: '', from: 1950, price: 22000, nam: 12 },
  { id: 'mb180', brand: 'Mercedes', model: '180 "Ponton"', from: 1955, price: 36000, nam: 16 },
  { id: 'anadol', brand: 'Anadol', model: '— ilk yerli otomobil', from: 1966, price: 26000, nam: 12 },
  { id: 'murat124', brand: 'Tofaş', model: 'Murat 124', from: 1971, price: 30000, nam: 13 },
  { id: 'reno12', brand: 'Renault', model: '12', from: 1971, price: 32000, nam: 13 },
  { id: 'mb200', brand: 'Mercedes', model: '200', from: 1968, price: 54000, nam: 20 },
  { id: 'sahin', brand: 'Tofaş', model: 'Şahin', from: 1981, price: 34000, nam: 12 },
  { id: 'mb280', brand: 'Mercedes', model: '280 SE', from: 1980, price: 82000, nam: 26 },
  { id: 'bmw5', brand: 'BMW', model: '5.20', from: 1983, price: 92000, nam: 26 },
  { id: 'mbS', brand: 'Mercedes', model: 'S Serisi', from: 1992, price: 190000, nam: 40 },
  { id: 'bmw7', brand: 'BMW', model: '7 Serisi', from: 1995, price: 210000, nam: 40 },
  { id: 'jaguar', brand: 'Jaguar', model: 'XJ', from: 1995, price: 240000, nam: 42 },
  { id: 'range', brand: 'Land Rover', model: 'Range Rover', from: 1998, price: 270000, nam: 46 },
];

export const carLabel = (c: CarDef) => `${c.brand}${c.model ? ' ' + c.model : ''}`;
export const carsOwned = (w: World): string[] => String(w.flags.luxCars || '').split(',').filter(Boolean);
export const ownsCar = (w: World, id: string) => carsOwned(w).includes(id);
export const carPrice = (w: World, c: CarDef) => Math.round((c.price * infl(w.m)) / 100) * 100;
export const carsAvailable = (w: World) => CARS.filter((c) => year(w.m) >= c.from);

/** Markalı araba al: temiz parayla. İstediğin markayı sen seçersin. */
export function buyCar(w: World, id: string): { ok: boolean; msg: string } {
  const c = CARS.find((x) => x.id === id);
  if (!c) return { ok: false, msg: 'Böyle bir araba yok.' };
  if (year(w.m) < c.from) return { ok: false, msg: `${carLabel(c)} ancak ${c.from}'den sonra alınır.` };
  if (ownsCar(w, id)) return { ok: false, msg: `Garajında zaten bir ${carLabel(c)} var.` };
  const p = carPrice(w, c);
  if (w.hh.cash < p) return { ok: false, msg: `Temiz parada ${fmt(p - w.hh.cash)} lira eksik.` };
  w.hh.cash -= p;
  w.flags.luxCars = [...carsOwned(w), id].join(',');
  w.flags.namBonus = Number(w.flags.namBonus || 0) + c.nam;
  log(w, `Garaja bir ${carLabel(c)} girdi: ${fmt(p)} lira. Köyde/şehirde herkes kimin geçtiğini bakışlarıyla takip ediyor.`, 'tapu');
  return { ok: true, msg: `${carLabel(c)} senin.` };
}

export interface LuxDef { id: string; ad: string; from: number; price: number; desc: string; once?: boolean; }
/** Tek seferlik eğlence/lüks harcamaları. */
export const LUX: LuxDef[] = [
  { id: 'ziyafet', ad: 'Köye/mahalleye ziyafet', from: 1925, price: 6000, desc: 'Üç gün süren bir şölen; kazanlar kaynar, herkes adını hayırla anar.' },
  { id: 'dugun', ad: 'Görkemli düğün', from: 1925, price: 20000, desc: 'Yıllarca konuşulacak bir düğün: sanatçı, ikram, davul zurna.' },
  { id: 'tatil', ad: 'Ailece tatil', from: 1955, price: 14000, desc: 'Deniz, otel, dinlenme. Ailenin morali ve birbirine bağlılığı artar.' },
  { id: 'at', ad: 'Yarış atı', from: 1935, price: 50000, desc: 'Hipodromda koşan safkan bir at: büyük statü, bazen de ikramiye.', once: true },
  { id: 'kulup', ad: 'Futbol kulübüne başkanlık', from: 1960, price: 140000, desc: 'Şehrin takımının başına geçmek: koca bir nam, koca bir gider; şehir seni tanır.', once: true },
  { id: 'yat', ad: 'Yat', from: 1985, price: 400000, desc: 'Boğazda ya da sahilde demirli bir yat. Servetin zirvesinin simgesi.', once: true },
];

export const luxOwned = (w: World, id: string) => String(w.flags.luxHas || '').split(',').includes(id);

export function doLux(w: World, id: string): { ok: boolean; msg: string } {
  const d = LUX.find((x) => x.id === id);
  if (!d) return { ok: false, msg: 'Böyle bir şey yok.' };
  if (year(w.m) < d.from) return { ok: false, msg: `${d.ad} ancak ${d.from}'den sonra.` };
  if (d.once && luxOwned(w, id)) return { ok: false, msg: `${d.ad} zaten var.` };
  const p = Math.round(d.price * infl(w.m));
  if (w.hh.cash < p) return { ok: false, msg: `Temiz parada ${fmt(p - w.hh.cash)} lira eksik.` };
  w.hh.cash -= p;
  if (d.once) w.flags.luxHas = String(w.flags.luxHas || '').split(',').filter(Boolean).concat(id).join(',');
  const addNam = (n: number) => (w.flags.namBonus = Number(w.flags.namBonus || 0) + n);
  const addSaygi = (n: number) => (w.flags.saygi = clamp(Number(w.flags.saygi || 0) + n, 0, 100));
  if (id === 'ziyafet') { addNam(6); addSaygi(10); log(w, `Üç gün ziyafet verildi; borç defterleri unutuldu, adın alkışlandı.`, 'olay'); }
  else if (id === 'dugun') { addNam(10); addSaygi(8); log(w, `Görkemli bir düğün yapıldı; yıllarca anlatıldı.`, 'evlilik'); }
  else if (id === 'tatil') { for (const m of Object.values(w.people)) if (m.inHH && !m.away && m.d === undefined) { m.rel = clamp(m.rel + 8, -100, 100); m.hp = clamp(m.hp + 4, 0, 100); } log(w, `Ailece tatile çıkıldı; herkes dinlenip döndü, aradaki bağ tazelendi.`, 'olay'); }
  else if (id === 'at') { addNam(16); log(w, `Ahıra safkan bir yarış atı alındı; hipodromda ${w.surname} ailesinin renkleri koşuyor.`, 'tapu'); }
  else if (id === 'kulup') { addNam(32); addSaygi(14); log(w, `Şehrin futbol kulübünün başına geçtin; tribünler adını haykırıyor.`, 'miras'); }
  else if (id === 'yat') { addNam(50); log(w, `Sahile bir yat demirledi; bacasında ${w.surname} ailesinin baş harfi. Servetin zirvesi.`, 'tapu'); }
  return { ok: true, msg: `${d.ad}: oldu.` };
}

/** Yarış atı varsa ara sıra ikramiye (keyifli küçük gelir). */
export function monthlyLux(w: World) {
  if (luxOwned(w, 'at') && chance(w, 0.04)) {
    const win = Math.round(rint(w, 8, 30) * 1000 * infl(w.m));
    w.hh.cash += win;
    log(w, `Yarış atın ${['koşuyu', 'derbiyi', 'kupayı'][rint(w, 0, 2)]} kazandı: ${fmt(win)} lira ikramiye ve bir dolu alkış.`, 'para');
  }
}
