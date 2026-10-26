// Sağlık: hastalıklar ve tedavi seçenekleri çağa göre değişir.
// 1925'te kasabadaki tek hekime at arabasıyla gidilir; 1961'de sağlık ocağı açılır; 1985'ten sonra özel hastaneler.
// Fiyatlar her hastalıkta yeniden belirlenir: enflasyon, çağın sağlık pahalılığı, mevsim ve yol durumu.
import type { Person, World } from './types';
import { chance, clamp, pick, rand } from './rng';
import { age, fullName, hhMembers, log } from './people';
import { infl, monthOf, year } from './calendar';
import { has } from './era';
import { hasDoctor } from './events';

export interface Cure { k: string; ad: string; cost: number; p: number; }

/** Çağa göre hastalık adı (yalnızca metin). */
export function illness(w: World, p: Person): string {
  const y = year(w.m);
  const a = age(w, p);
  const mo = monthOf(w.m);
  if (a < 6) return pick(w, y < 1960 ? ['kızamık', 'boğmaca', 'ishal', 'yüksek ateş'] : ['yüksek ateş', 'zatürre', 'kızamık']);
  if (y < 1950) {
    if (mo >= 5 && mo <= 8 && !has(w, 'kinin')) return 'sıtma';
    return pick(w, mo >= 5 && mo <= 8 ? ['sıtma', 'tifo', 'dizanteri'] : ['verem', 'zatürre', 'tifüs', 'ağır grip']);
  }
  if (a > 55) return pick(w, y < 1980 ? ['kalp', 'zatürre', 'romatizma'] : ['kalp krizi', 'şeker', 'tansiyon', 'felç']);
  return pick(w, y < 1975 ? ['zatürre', 'sarılık', 'apandisit', 'ağır grip'] : ['apandisit', 'mide kanaması', 'zatürre', 'ağır grip']);
}

/** Çağın sağlık pahalılığı: özel hastaneler ve ilaçlar zamanla pahalanır. */
function eraCost(y: number): number {
  if (y < 1950) return 1;
  if (y < 1985) return 1.1;
  if (y < 2005) return 1.45;
  return 1.7;
}

/** Hasta için bugünkü seçenekler. Fiyatlar rastgele oynar: kış yolu, hekimin keyfi, ilaç bulunup bulunmaması. */
export function cures(w: World, p: Person): Cure[] {
  const y = year(w.m);
  const a = age(w, p);
  const wint = monthOf(w.m) === 11 || monthOf(w.m) <= 1;
  const L = (n: number, spread = 0.25) => Math.round((n * infl(w.m) * eraCost(y) * (1 + (rand(w) * 2 - 1) * spread) * (wint ? 1.15 : 1)) / 5) * 5;
  const car = (w.hh.veh?.otomobil || 0) > 0;
  const cart = (w.hh.veh?.araba || 0) > 0 || (w.hh.veh?.kamyon || 0) > 0;
  const pen = has(w, 'penisilin') ? 0.1 : 0;
  const frail = a > 65 || a < 4 ? -0.1 : 0;
  const out: Cure[] = [];
  if (hasDoctor(w)) out.push({ k: 'aile', ad: 'Ailenin doktoru baksın', cost: 0, p: 0.92 });
  out.push({ k: 'ev', ad: y < 1960 ? 'Evde, ninelerin otlarıyla bak' : 'Evde dinlensin', cost: 0, p: clamp(0.3 + frail + (hhMembers(w).some((q) => q.job === 'ev') ? 0.1 : 0), 0.1, 0.5) });
  if (y < 1970) out.push({ k: 'hoca', ad: 'Hocaya okut, muska yazdır', cost: L(12, 0.4), p: clamp(0.33 + frail, 0.1, 0.5) });
  if (y < 1961) out.push({ k: 'ebe', ad: 'Köyün sağlıkçısını çağır', cost: L(35), p: clamp(0.5 + frail + pen / 2, 0.2, 0.7) });
  else out.push({ k: 'ocak', ad: 'Sağlık ocağına götür', cost: L(30), p: clamp(0.68 + frail, 0.3, 0.8) });
  out.push({
    k: 'hekim',
    ad: y < 1950 ? (cart || car ? 'Arabayla kasabadaki hekime götür' : 'Kasabadaki hekime yaya götür, iki gün yol') : 'İlçe hastanesine götür',
    cost: L(y < 1950 ? 150 : 210, 0.3) + (cart || car ? 0 : L(20)),
    p: clamp(0.7 + pen + frail + (car ? 0.06 : cart ? 0.03 : -0.04), 0.4, 0.92),
  });
  if (y >= 1950) out.push({ k: 'hastane', ad: 'Şehirdeki büyük hastaneye', cost: L(480, 0.3), p: clamp(0.84 + pen / 2 + frail / 2 + (car ? 0.05 : 0), 0.5, 0.96) });
  if (y >= 1985) out.push({ k: 'ozel', ad: 'Özel hastane, en iyi doktor', cost: L(1300, 0.35), p: clamp(0.95 + frail / 3, 0.8, 0.98) });
  return out;
}

/** Hastalık kartı metni ve seçenekleri */
export function sickCard(w: World, p: Person) {
  const ill = illness(w, p);
  const cs = cures(w, p);
  const fmt = (n: number) => n.toLocaleString('tr-TR');
  return {
    text: `${fullName(p)} (${age(w, p)}) ağır hastalandı: ${ill}. ${year(w.m) < 1950 ? 'Köyde doktor yok; en yakın hekim kasabada.' : year(w.m) < 1961 ? 'İlçede hastane açıldı ama yol uzun.' : 'Ne yapılacak?'}`,
    opts: cs.map((c) => ({ t: `${c.ad}${c.cost ? ` (${fmt(c.cost)} lira)` : ''}, iyileşme %${Math.round(c.p * 100)}`, k: c.k })),
    data: { cures: cs.map((c) => [c.k, c.cost, c.p]), ill },
  };
}

export function resolveSick(w: World, p: Person, k: string, data: Record<string, unknown> | undefined) {
  const list = (data?.cures as [string, number, number][]) || [];
  const c = list.find((x) => x[0] === k) ?? ['ev', 0, 0.3];
  const ill = (data?.ill as string) || 'hastalık';
  w.hh.cash -= c[1];
  w.flags.saglikHarcama = Number(w.flags.saglikHarcama || 0) + c[1];
  if (chance(w, c[2])) {
    p.sick = 0;
    p.hp = clamp(p.hp + 10, 0, 100);
    log(w, `${fullName(p)} ${ill} hastalığını atlattı${c[1] ? ` (${c[1].toLocaleString('tr-TR')} lira)` : ''}.`, 'olay');
  } else {
    p.sick = (p.sick || 0) + 2;
    p.hp = clamp(p.hp - 10, 3, 100);
    log(w, `${fullName(p)} iyileşmedi; ${ill} ağırlaştı.${c[1] ? ` Giden para ${c[1].toLocaleString('tr-TR')} lira.` : ''}`, 'olay');
  }
}

/** Çağın ölüm çarpanı: antibiyotik öncesi yıllar daha acımasız. */
export function eraMortality(w: World, p: Person): number {
  const y = year(w.m);
  const a = age(w, p);
  const od = (w.flags.odul_ocak ? 0.82 : 1) * (w.flags.hekim ? 0.9 : 1);
  if (!has(w, 'penisilin')) return (a < 5 ? 1.5 : p.sick ? 1.3 : 1.05) * od;
  if (y >= 1985) return 0.85 * od;
  return 1 * od;
}

/** Aylık: yazın sıtma, kışın salgın (yalnızca antibiyotik ve sıtma savaşı öncesi daha sık). */
export function monthlyHealth(w: World) {
  const mo = monthOf(w.m);
  if (mo >= 6 && mo <= 8 && year(w.m) < 1950 && chance(w, has(w, 'kinin') ? 0.012 : 0.04)) {
    const pool = hhMembers(w).filter((q) => !q.away && !q.sick);
    if (pool.length) {
      const q = pick(w, pool);
      q.sick = 2;
      q.hp = clamp(q.hp - 8, 5, 100);
      log(w, `${fullName(q)} sıtmaya yakalandı; titreme nöbetleriyle yatıyor.`, 'olay');
    }
  }
}
