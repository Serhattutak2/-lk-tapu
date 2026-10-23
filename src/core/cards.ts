// Olay kartları: oyuncudan karar isteyen anlar.
// Kartlar World içinde düz veri olarak durur; seçenekleri RESOLVE tablosundan çözülür.
import type { Card, World } from './types';
import { chance, clamp, gauss, pick, rint } from './rng';
import { FEMALE, MALE, SURNAMES } from './names';
import { age, alive, fullName, hhMembers, log, makePerson, P, removeFromHH } from './people';
import { dateText, infl, monthOf, year } from './calendar';
import { marry, resolveSuccession } from './life';
import { newParcel, resolveHashas } from './fields';
import { crimeCards, resolveCrime } from './crime';

export function pushCard(w: World, c: Omit<Card, 'uid' | 'm'>) {
  w.cards.push({ ...c, uid: w.nextCard++, m: w.m });
}

/** Toprak fiyatı: 5 dönüm, yıllar geçtikçe pahalanır. */
export const landPrice = (w: World) => Math.round((11000 * infl(w.m) * (1 + w.hh.parcels.length * 0.08)) / 100) * 100;

/** Toprak almaya ne engel? Boş dizi = alabilir. */
export function landBlockers(w: World): string[] {
  const out: string[] = [];
  if (w.hh.debt > 0) out.push('Ağaya borcun varken kimse sana toprak satmaz; önce borç kapanmalı.');
  if (((w.flags.agaKin as number) || 0) >= year(w.m)) out.push(`Ağa köyde "o aileye toprak satmayın" dedi; ${w.flags.agaKin} yılına kadar kimse satmaya cesaret edemez.`);
  if (w.hh.cash < landPrice(w)) out.push(`Kasada ${(landPrice(w) - w.hh.cash).toLocaleString('tr-TR')} lira eksik.`);
  return out;
}

type Resolver = (w: World, c: Card, k: string) => void;

const RESOLVE: Record<string, Resolver> = {
  veraset: (w, _c, k) => resolveSuccession(w, k),

  gorucu: (w, c, k) => {
    const p = P(w, w.playerId);
    const d = c.data as { first: string; last: string; ageY: number; sex: 'E' | 'K' };
    if (k !== 'evet' || !alive(p)) {
      log(w, `${p ? fullName(p) : 'Aile'}, ${d.first} ${d.last} ile evlilik teklifini geri çevirdi.`, 'evlilik');
      return;
    }
    const s = makePerson(w, { sex: d.sex, b: w.m - d.ageY * 12 - rint(w, 0, 11), first: d.first, last: d.last, blood: false, inHH: false });
    s.sk.tarim = clamp(Math.round(d.ageY * 1.4 + gauss(w, 0, 6)), 0, 70);
    s.rel = clamp(Math.round(gauss(w, 50, 15)), 0, 95);
    marry(w, p, s);
    const cost = 300;
    w.hh.cash -= cost;
    log(w, `${fullName(p)} ile ${fullName(s)} evlendi. Düğün ${cost} liraya mal oldu.`, 'evlilik');
  },

  hastalik: (w, c, k) => {
    const p = P(w, c.pid);
    if (!alive(p)) return;
    if (k === 'doktor') {
      w.hh.cash -= 150;
      p.sick = 0;
      p.hp = clamp(p.hp + 10, 0, 100);
      log(w, `${fullName(p)} ilçedeki doktora götürüldü ve iyileşti (150 lira).`, 'olay');
    } else {
      log(w, `${fullName(p)} evde, ninelerin ilaçlarıyla yatıyor.`, 'olay');
    }
  },

  gurbet: (w, c, k) => {
    const p = P(w, c.pid);
    if (!alive(p)) return;
    if (k !== 'gonder') {
      log(w, `${fullName(p)} gurbete gitmedi.`, 'olay');
      return;
    }
    w.hh.cash -= 250;
    p.away = 'gurbet';
    p.awayUntil = w.m + 12 * rint(w, 4, 9);
    p.job = 'yok';
    p.parcel = undefined;
    log(w, `${fullName(p)} Almanya'ya işçi olarak gitti. Yol parası 250 lira.`, 'olay');
  },

  tuccar: (w, _c, k) => {
    const p = P(w, w.playerId);
    w.flags.tuccar = true;
    if (k === 'calis' && alive(p)) {
      p.job = 'tuccar';
      p.sk.ticaret = Math.max(p.sk.ticaret, 10);
      log(w, `${fullName(p)} hububat tüccarı Hacı Rüştü'nün yanında çalışmaya başladı.`, 'is');
    } else {
      log(w, `Hacı Rüştü ile tanışıklık kuruldu; ailede isteyen yanında çalışabilir.`, 'is');
    }
  },

  tapu: (w, c, k) => {
    const price = (c.data?.price as number) ?? landPrice(w);
    if (k !== 'al') return;
    if (w.hh.cash < price) {
      log(w, `Tarla için para yetmedi.`, 'para');
      return;
    }
    w.hh.cash -= price;
    const first = w.hh.parcels.length === 0;
    newParcel(w, price);
    if (first) {
      w.flags.ilkTapu = w.m;
      log(w, `İLK TAPU: ${w.surname} ailesi ${price} liraya Karaçam'ın kenarında 5 dönüm tarla aldı. Ailenin ilk kendi toprağı.`, 'tapu');
    } else {
      log(w, `${price} liraya 5 dönüm daha tarla alındı. Toplam ${w.hh.land} dönüm.`, 'tapu');
    }
  },

  hashas_hasat: (w, c, k) => resolveHashas(w, c.data!.sacks as number, c.data!.parcel as number, k),
  bilgi: () => {},
};

export function resolveCard(w: World, uid: number, k: string) {
  const i = w.cards.findIndex((c) => c.uid === uid);
  if (i < 0) return;
  const [c] = w.cards.splice(i, 1);
  if (RESOLVE[c.id]) RESOLVE[c.id](w, c, k);
  else resolveCrime(w, c, k);
  if (w.hh.cash < 0) {
    // Kasada olmayan para ağadan borç alınır
    w.hh.debt += -w.hh.cash;
    log(w, `Kasada para yoktu; ${-w.hh.cash} lira ağadan borç alındı.`, 'para');
    w.hh.cash = 0;
  }
}

/** Her ay çağrılır: koşullara göre yeni kartlar üretir. */
export function generateCards(w: World) {
  if (w.cards.length || w.flags.interregnum || w.over) return;
  const pl = P(w, w.playerId);
  if (!alive(pl)) return;
  const pa = age(w, pl);
  const yr = year(w.m);
  if (crimeCards(w)) return;

  // Görücü
  if (pa >= 18 && pa <= 45 && !alive(P(w, pl.sp)) && !pl.sp && chance(w, 0.08)) {
    const sex = pl.sex === 'E' ? 'K' : 'E';
    const ageY = clamp(sex === 'K' ? pa - rint(w, 0, 5) : pa + rint(w, 0, 6), 16, 50);
    const first = pick(w, sex === 'E' ? MALE : FEMALE);
    const last = pick(w, SURNAMES);
    const koy = pick(w, ['Yukarıdere', 'Kızılca', 'Aşağıova', 'Çamlıbel', 'Gökpınar', 'Karaçam']);
    pushCard(w, {
      id: 'gorucu',
      text: `${koy} köyünden ${last} ailesi görücü yolladı: ${first} (${ageY}) ile evlenmen isteniyor. Düğün yaklaşık 300 liraya mal olur.`,
      opts: [{ t: 'Kabul et', k: 'evet' }, { t: 'Geri çevir', k: 'hayir' }],
      data: { first, last, ageY, sex },
    });
    return;
  }

  // İlk tapu ya da yeni tarla
  const price = landPrice(w);
  if (landBlockers(w).length === 0 && w.hh.parcels.length < 8 && (w.hh.parcels.length === 0 ? chance(w, 0.25) : chance(w, 0.03))) {
    pushCard(w, {
      id: 'tapu',
      text: w.hh.parcels.length === 0
        ? `Gurbete giden Deli Hamza'nın köy kenarındaki 5 dönüm tarlası satılık: ${price.toLocaleString('tr-TR')} lira. Bu, ailenin ilk kendi toprağı olur. Ne ekeceğine, kimi çalıştıracağına sen karar verirsin.`
        : `Komşu parsel satılık: 5 dönüm, ${price.toLocaleString('tr-TR')} lira. Toprağın büyür, ama işçisini de bulman gerekir.`,
      opts: [{ t: `Satın al (${price} lira)`, k: 'al' }, { t: 'Bekle', k: 'bekle' }],
      data: { price },
    });
    return;
  }

  // Hastalık
  const mem = hhMembers(w).filter((p) => !p.away && !p.sick);
  if (mem.length && chance(w, 0.03)) {
    const p = pick(w, mem);
    p.sick = rint(w, 2, 4);
    p.hp = clamp(p.hp - rint(w, 10, 20), 5, 100);
    pushCard(w, {
      id: 'hastalik',
      pid: p.id,
      text: `${fullName(p)} (${age(w, p)}) ağır hastalandı. İlçedeki doktora götürmek 150 liraya mal olur.`,
      opts: [{ t: 'Doktora götür (150 lira)', k: 'doktor' }, { t: 'Evde bakalım', k: 'bekle' }],
    });
    return;
  }

  // Gurbet: 1965–1975 arası Almanya'ya işçi göçü
  if (yr <= 1975) {
    const cand = hhMembers(w).filter((p) => p.id !== w.playerId && !p.away && age(w, p) >= 20 && age(w, p) <= 40 && !w.flags['g' + p.id]);
    if (cand.length && chance(w, 0.015)) {
      const p = pick(w, cand);
      w.flags['g' + p.id] = true;
      pushCard(w, {
        id: 'gurbet',
        pid: p.id,
        text: `Almanya'ya işçi alınıyor. ${fullName(p)} (${age(w, p)}) gitmek istiyor. Yıllarca uzakta kalır ama her ay mark gönderir; dönerse birikimiyle döner. Ya hiç dönmezse?`,
        opts: [{ t: 'Gönder (250 lira yol parası)', k: 'gonder' }, { t: 'Gitmesin', k: 'kalsin' }],
      });
      return;
    }
  }

  // Tüccarla tanışma
  if (!w.flags.tuccar && pa >= 16 && pl.sk.tarim >= 28 && chance(w, 0.03)) {
    pushCard(w, {
      id: 'tuccar',
      text: `Kahvede ilçeden gelen hububat tüccarı Hacı Rüştü ile tanıştın. Tarlaları iyi bilen, güvenilir birini arıyor.`,
      opts: [{ t: 'Yanında çalış', k: 'calis' }, { t: 'Tanışıklık yeter', k: 'tanis' }],
    });
    return;
  }
}

/** Kart gerektirmeyen mevsimlik olaylar (yalnızca kronik). */
export function seasonalNotes(w: World): number {
  const mo = monthOf(w.m);
  let bonus = 0;
  if (mo === 5) {
    bonus = 50;
    if (chance(w, 0.25)) log(w, `Lisanslı haşhaş tarlalarında hasat başladı; gündelikçilere ek iş çıktı.`, 'olay');
  }
  if (mo === 11 && chance(w, 0.2)) {
    w.flags.sertKis = year(w.m) + 1;
    log(w, `Sert bir kış geliyor; odun ve erzak pahalandı.`, 'olay');
  }
  return bonus;
}

/** Gurbetteki aile üyeleri: dönüş ya da kalış. */
export function gurbetReturns(w: World) {
  for (const p of Object.values(w.people)) {
    if (!alive(p) || p.away !== 'gurbet' || (p.awayUntil ?? 0) > w.m) continue;
    p.away = undefined;
    p.awayUntil = undefined;
    if (chance(w, 0.7)) {
      const sav = Math.round(rint(w, 30, 60) * 100 * infl(w.m));
      w.hh.cash += sav;
      p.job = 'tarla';
      p.parcel = undefined;
      log(w, `${fullName(p)} Almanya'dan döndü; yanında ${sav} lira birikim getirdi.`, 'para');
    } else {
      removeFromHH(w, p);
      const sp = P(w, p.sp);
      if (alive(sp) && sp.inHH && sp.id !== w.playerId) removeFromHH(w, sp);
      log(w, `${fullName(p)} Almanya'da kalmaya karar verdi. Ailenin gurbette bir kolu oluştu.`, 'olay');
    }
  }
}
