// Piyasa: her Ocak ürün ve hayvan fiyatları değişir. Kuraklık, buhran, savaş ve krizler fiyatı oynatır.
// Çarpanlar 1 civarında gezinir; infl() ile birlikte gerçek fiyatı verir.
import type { CropId, World } from './types';
import { clamp, gauss } from './rng';
import { year } from './calendar';
import { log } from './people';

export type MkId = CropId | 'hayvan';
const KEYS: MkId[] = ['bugday', 'arpa', 'nohut', 'pancar', 'hayvan'];
export const MK_AD: Record<MkId, string> = { bugday: 'Buğday', arpa: 'Arpa', nohut: 'Nohut', pancar: 'Şeker pancarı', hashas: 'Haşhaş', hayvan: 'Kurbanlık ve hayvan' };

/** Tarihî şoklar: yıl aralığı ve ürün başına çarpan */
interface Shock { from: number; to: number; ad: string; f: Partial<Record<MkId, number>>; }
export const SHOCKS: Shock[] = [
  { from: 1929, to: 1933, ad: 'Büyük Buhran: dünyada buğday para etmiyor', f: { bugday: 0.55, arpa: 0.6, nohut: 0.7, hayvan: 0.75 } },
  { from: 1940, to: 1946, ad: 'Savaş yılları: ekmek karneyle, tahıl altın değerinde', f: { bugday: 1.7, arpa: 1.6, nohut: 1.5, hayvan: 1.45 } },
  { from: 1951, to: 1953, ad: 'Dünyada tahıl kıtlığı: ihracat patladı', f: { bugday: 1.3, arpa: 1.2 } },
  { from: 1958, to: 1959, ad: 'Devalüasyon: ithal mal yok, köylü ürünü pahalı', f: { bugday: 1.15, hayvan: 1.2 } },
  { from: 1978, to: 1980, ad: 'Yokluk yılları: kuyruklar, karaborsa', f: { bugday: 1.25, hayvan: 1.3 } },
  { from: 1994, to: 1994, ad: 'Kriz: köylünün eline geçen düştü', f: { bugday: 0.8, pancar: 0.85, hayvan: 0.8 } },
  { from: 2001, to: 2002, ad: 'Kriz: alıcı yok, hayvan ucuz', f: { bugday: 0.85, hayvan: 0.75 } },
];

export function shockOf(y: number): Shock | undefined {
  return SHOCKS.find((s) => y >= s.from && y <= s.to);
}

export function initMarket(w: World) {
  w.mk = {};
  for (const k of KEYS) w.mk[k] = 1;
}

/** Ürünün bugünkü piyasa çarpanı (şok dahil). */
export function mk(w: World, k: MkId): number {
  if (k === 'hashas') return 1;
  const base = w.mk?.[k] ?? 1;
  const s = shockOf(year(w.m));
  return base * (s?.f[k] ?? 1);
}

/** Her Ocak: fiyatlar ortalamaya dönen bir rastgele yürüyüşle değişir. Kuraklıkta hayvan ucuzlar, tahıl pahalanır. */
export function yearlyPrices(w: World) {
  w.mk ??= {};
  const dry = w.rain < 0.85;
  const wet = w.rain > 1.2;
  for (const k of KEYS) {
    const prev = w.mk[k] ?? 1;
    w.flags['mkp_' + k] = Math.round(mk(w, k) * 100);
    const sd = k === 'pancar' ? 0.04 : 0.1;
    let v = prev + (1 - prev) * 0.35 + gauss(w, 0, sd);
    if (dry && k !== 'hayvan' && k !== 'pancar') v += 0.12; // kurak geçen yılın ardından tahıl kıt
    if (wet && k !== 'hayvan') v -= 0.08; // bereket fiyatı düşürür
    if (dry && k === 'hayvan') v -= 0.15; // yem yok, herkes hayvanını satıyor
    w.mk[k] = clamp(v, 0.6, 1.6);
  }
  const s = shockOf(year(w.m));
  if (s && year(w.m) === s.from) log(w, `${s.ad}.`, 'olay');
  const b = Math.round(mk(w, 'bugday') * 100);
  if (b >= 125) log(w, `Bu yıl buğday pahalı (normalin %${b}'i): ambarında buğdayı olan kazanır.`, 'para');
  else if (b <= 78) log(w, `Bu yıl buğday ucuz (normalin %${b}'i): satmak yerine ambarda beklemek akıllıca olabilir.`, 'para');
}

/** Bir önceki yıla göre fiyat yönü: +1 arttı, -1 düştü, 0 aynı */
export function trend(w: World, k: MkId): number {
  const p = Number(w.flags['mkp_' + k] || 0);
  if (!p) return 0;
  const n = Math.round(mk(w, k) * 100);
  return n > p + 3 ? 1 : n < p - 3 ? -1 : 0;
}
