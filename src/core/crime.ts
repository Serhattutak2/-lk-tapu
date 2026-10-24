// Karanlık taraf: ağa, ruhsat ve yasak, Kara Rıza, Isı (jandarmanın dikkati), baskın, hapis.
// Hepsi soyut oyun sistemleridir; üretim ya da kaçakçılık için gerçek yöntem içermez.
import type { Card, Person, World } from './types';
import { chance, clamp, pick, rint } from './rng';
import { addToHH, age, alive, fullName, hhMembers, log, P, removeFromHH } from './people';
import { dateText, infl, monthOf, year } from './calendar';
import { BAN_FROM, BAN_TO, isBanYear } from './fields';
import { pushCard } from './cards';
import { SITES } from './lab';
import { payDirtyFirst } from './baron';
import { has, policeFactor } from './era';
import { jailYears } from './events';
import { makeSpouseFor, marry } from './life';
import { kmtFactor, monthlyKomutan, raidOpts, resolveRaidSpecial, secretCard } from './jandarma';

/** Ağanın kira evi için üst sınır (temel lira). */
export const RENT_CAP = 110;

export const heatLabel = (h: number) => (h < 15 ? 'Kimse bakmıyor' : h < 35 ? 'Adın geçiyor' : h < 60 ? 'Jandarma soruyor' : 'Gözetim altındasın');

/** Ay başında: Isı azalır, zula Isı üretir, hapistekiler çıkar, tarihsel duyurular. */
export function monthlyCrime(w: World) {
  const mo = monthOf(w.m);
  const yr = year(w.m);
  const illegalGrowing = w.hh.parcels.some((p) => p.illegal && p.crop);
  w.heat = clamp(w.heat - (has(w, 'dinleme') ? 1.0 : 1.5) + (w.hh.stash > 0 ? 0.3 + w.hh.stash * 0.02 : 0) + (illegalGrowing && (mo === 4 || mo === 5) ? 3 : 0), 0, 100);
  if (w.hh.cash > 20000 * infl(w.m) && chance(w, 0.02)) w.heat = clamp(w.heat + 4, 0, 100); // göze batan servet

  // Hapisten çıkış
  for (const p of Object.values(w.people)) {
    if (!alive(p) || p.away !== 'hapis' || (p.awayUntil ?? 0) > w.m) continue;
    p.away = undefined;
    p.awayUntil = undefined;
    p.job = 'yok'; // işini oyuncu seçer
    p.parcel = undefined;
    if (!p.inHH && (p.id === w.playerId || p.blood)) addToHH(w, p);
    p.hp = clamp(p.hp - 8, 5, 100);
    log(w, `${fullName(p)} cezaevinden çıktı. Köyde artık ona başka gözle bakıyorlar.`, 'olay');
  }

  if (yr === BAN_FROM - 1 && mo === 6 && !w.flags.yasakDuyuru) {
    w.flags.yasakDuyuru = true;
    log(w, `Ankara haşhaş ekimini yasakladı. ${BAN_FROM}'den itibaren ruhsat verilmeyecek; tarlalar jandarma tarafından denetlenecek. Kaçak malın fiyatı şimdiden fırladı.`, 'olay');
  }
  if (yr === BAN_TO && mo === 6 && !w.flags.yasakBitti) {
    w.flags.yasakBitti = true;
    log(w, `Haşhaş yasağı kalktı. Ekim yeniden ruhsatla ve sıkı denetimle serbest.`, 'olay');
  }
}

const fmt = (n: number) => n.toLocaleString('tr-TR');

export function bribeCost(w: World) {
  return Math.max(Math.round(600 * infl(w.m)), Math.round(w.hh.cash * 0.25 / 100) * 100);
}

/** Suçu üstlenebilecek yetişkinler (en yaşlı erkekten başlayarak). */
function scapegoats(w: World): Person[] {
  return hhMembers(w)
    .filter((p) => !p.away && p.id !== w.playerId && age(w, p) >= 18 && age(w, p) <= 75)
    .sort((a, b) => (a.sex === b.sex ? a.b - b.b : a.sex === 'E' ? -1 : 1));
}

/** Kart üretimi: önce yasal düzen, sonra karanlık olaylar. Kart üretildiyse true. */
export function crimeCards(w: World): boolean {
  const mo = monthOf(w.m);
  const yr = year(w.m);
  const pl = P(w, w.playerId);
  if (!alive(pl)) return false;
  const pa = age(w, pl);
  // Samanlık zulayı, uzak atölye kendini gizler: baskında bulunma ihtimali
  const stashFound = w.hh.stash > 0 && chance(w, w.hh.rooms?.samanlik ? 0.45 : 0.9);
  const labFound = !!w.lab && chance(w, SITES[w.lab.site].find * (has(w, 'kamera') ? 0.6 : 1));
  const fieldFound = w.hh.parcels.some((p) => p.illegal && p.crop);
  const evidence = stashFound || labFound || fieldFound;

  // Jandarma baskını
  if (monthlyKomutan(w)) return true;
  if (secretCard(w)) return true;
  const raidP = (Math.max(0, w.heat - 12) / 100 * 0.09 + (evidence ? 0.004 : 0)) * policeFactor(w) * kmtFactor(w) * (w.pol.seat === 'vekil' ? 0.5 : 1) * (Number(w.flags.kom_nuri ?? 10) >= 40 ? 0.85 : 1);
  if (w.heat > 12 && chance(w, raidP)) {
    if (!evidence) {
      w.heat = clamp(w.heat - 12, 0, 100);
      pushCard(w, { id: 'bilgi', text: `Gece yarısı jandarma kapıya dayandı. Ahırı, samanlığı, yüklüğü aradılar. Bir şey bulamadılar ama komutan giderken "Gözümüz üstünde" dedi.`, opts: [{ t: 'Kapıyı kapat', k: 'ok' }] });
      return true;
    }
    const bc = bribeCost(w) * (labFound ? 2 : 1);
    const sg = scapegoats(w)[0];
    const opts: { t: string; k: string }[] = raidOpts(w, bc, labFound);
    if (sg) opts.push({ t: `Suçu ${sg.first} üstlensin`, k: 'ustlen:' + sg.id });
    opts.push({ t: 'Suçu ben üstleneyim', k: 'ustlen:' + pl.id });
    pushCard(w, {
      id: 'baskin',
      text: `Jandarma baskını. ${stashFound ? `Zulada ${w.hh.stash} çuval mal bulundu. ` : ''}${labFound ? `${SITES[w.lab!.site].ad} basıldı: atölye, kazanlar ve ${w.lab!.prod + w.lab!.hap} birim ürün tutanağa geçti. ` : ''}${fieldFound ? 'Ruhsatsız tarla tutanağa geçti. ' : ''}${String(w.flags.kmtAd || 'Komutan')} birinin götürüleceğini söylüyor.${labFound ? ' Atölye için zarf da kalın olmalı.' : ''}`,
      opts,
      data: { bribe: bc, stash: stashFound, lab: labFound },
    });
    return true;
  }

  // Ruhsat başvurusu (Ağustos; kaçarsa Eylül–Ekim'de de gelir)
  if (mo >= 7 && mo <= 9 && w.hh.parcels.length && w.ruhsat !== yr && w.flags.ruhsatSor !== yr) {
    w.flags.ruhsatSor = yr;
    if (isBanYear(yr)) {
      pushCard(w, { id: 'bilgi', text: `Yasak sürüyor: bu yıl haşhaş ruhsatı verilmiyor. Ruhsatsız eken jandarmanın kara listesine girer. Kaçak malın fiyatı ise hiç bu kadar yüksek olmamıştı.`, opts: [{ t: 'Anlaşıldı', k: 'ok' }] });
      return true;
    }
    const fee = Math.round(80 * infl(w.m));
    pushCard(w, {
      id: 'ruhsat',
      text: `Tarım Müdürlüğü haşhaş ekim ruhsatı başvurularını alıyor. Harç ${fee} lira. Ruhsatla ekilen haşhaşın hasadı devlete teslim edilir.`,
      opts: [{ t: `Başvur (${fee} lira)`, k: 'evet' }, { t: 'Bu yıl istemem', k: 'hayir' }],
      data: { fee },
    });
    return true;
  }

  // Kara Rıza ile tanışma
  if (!w.flags.kacakci && !w.flags.rizaRet && pa >= 18 && (w.hh.parcels.length > 0 || w.heat > 0) && chance(w, w.hh.parcels.some((p) => p.crop === 'hashas') ? 0.06 : 0.015)) {
    pushCard(w, {
      id: 'kacakci',
      text: `Kahvehanenin arka masasında, ilçeden gelen Kara Rıza seni yanına çağırdı. "Devlet sana çuvalına üç kuruş veriyor. Ben üç katını veririm. Yeter ki hasadın bir kısmı kâğıda geçmesin." Masada başka kimse yok.`,
      opts: [{ t: 'Elini sık', k: 'evet' }, { t: 'Kalk, uzak dur', k: 'hayir' }],
    });
    return true;
  }

  // Ağa kirayı artırıyor
  if (w.hh.parcels.length === 0 && w.hh.house === 0 && w.hh.rent < RENT_CAP && mo === 9 && chance(w, 0.15)) {
    const nr = Math.min(RENT_CAP, Math.round(w.hh.rent * 1.2));
    pushCard(w, {
      id: 'aga_kira',
      text: `Ağa, oturduğunuz evin kirasını ${fmt(Math.round(w.hh.rent * infl(w.m)))} liradan ${fmt(Math.round(nr * infl(w.m)))} liraya çıkarıyor. "Beğenmeyen başka köye gitsin" diye haber yolladı.`,
      opts: [{ t: 'Boyun eğ', k: 'kabul' }, { t: 'Muhtarla birlikte itiraz et', k: 'itiraz' }],
      data: { nr },
    });
    return true;
  }

  // Ağanın oğlu evdeki kızı istiyor
  const girl = hhMembers(w).find((p) => p.blood && p.sex === 'K' && !p.sp && !p.away && p.id !== w.playerId && p.id !== w.heirId && age(w, p) >= 16 && age(w, p) <= 22);
  if (girl && w.hh.debt > 0 && !w.flags['agaIstedi' + girl.id] && chance(w, 0.02)) {
    w.flags['agaIstedi' + girl.id] = true;
    pushCard(w, {
      id: 'aga_kiz',
      pid: girl.id,
      text: `Ağa, oğlu için ${girl.first}'i (${age(w, girl)}) istiyor. Kabul ederseniz borcun yarısını sileceğini söylüyor. ${girl.first} kapının arkasından dinliyor.`,
      opts: [{ t: 'Ver', k: 'ver' }, { t: 'Kızımızı satmayız', k: 'ret' }],
    });
    return true;
  }

  // Dolu
  if ((mo === 4 || mo === 5) && w.hh.parcels.some((p) => p.crop) && chance(w, 0.03)) {
    const p = pick(w, w.hh.parcels.filter((x) => x.crop));
    w.flags.dolu = p.id;
    log(w, `${dateText(w.m)}: Ceviz büyüklüğünde dolu yağdı. ${p.no}. parselin ekini yarı yarıya yattı.`, 'olay');
  }
  void yr;
  return false;
}

export function resolveCrime(w: World, c: Card, k: string): boolean {
  switch (c.id) {
    case 'ruhsat': {
      if (k === 'evet') applyRuhsat(w, c.data!.fee as number);
      return true;
    }
    case 'ruhsat_red': {
      if (k === 'zarf') {
        payDirtyFirst(w, c.data!.zarf as number);
        if (chance(w, 0.75)) {
          w.ruhsat = year(w.m);
          log(w, `Tarım memuru dosyanın üstüne bir zarf koydu, ruhsat çıktı.`, 'is');
        } else {
          w.heat = clamp(w.heat + 10, 0, 100);
          log(w, `Memur zarfı aldı ama ruhsatı vermedi: "Şikâyet Ankara'dan." Para gitti.`, 'olay');
        }
      } else if (k === 'muhtar') {
        if (chance(w, w.pol.seat === 'muhtar' ? 0.85 : 0.45)) {
          w.ruhsat = year(w.m);
          log(w, `Muhtarın kefaletiyle ruhsat çıktı.`, 'is');
        } else log(w, `Muhtarın sözü de yetmedi; bu yıl ruhsat yok.`, 'olay');
      }
      return true;
    }
    case 'kacakci': {
      if (k === 'evet') {
        w.flags.kacakci = true;
        w.heat = clamp(w.heat + 4, 0, 100);
        log(w, `Kara Rıza ile el sıkışıldı. Ailenin adı artık başka defterlerde de geçiyor.`, 'olay');
      } else {
        w.flags.rizaRet = true;
        log(w, `Kara Rıza'nın teklifi geri çevrildi.`, 'olay');
      }
      return true;
    }
    case 'baskin': {
      const sp = resolveRaidSpecial(w, k, c.data!.bribe as number);
      if (sp === 'kapandi') return true;
      const extra = sp === 'agir' ? 3 : 0;
      const pid = sp ? (scapegoats(w)[0]?.id ?? w.playerId) : k.split(':')[1];
      const p = P(w, pid);
      const seized = c.data?.stash ? w.hh.stash : 0;
      if (c.data?.stash) w.hh.stash = 0;
      const labHit = !!c.data?.lab && !!w.lab;
      if (labHit) {
        log(w, `Atölye mühürlendi, içindeki her şeye el konuldu.`, 'olay');
        w.lab = null;
      }
      for (const f of w.hh.parcels) {
        if (f.illegal && f.crop) {
          f.crop = null;
          f.illegal = false;
        }
      }
      w.ruhsat = 0;
      w.heat = clamp(w.heat * 0.35, 0, 100);
      if (alive(p)) {
        const yrs = jailYears(w, rint(w, 2, 4) + (seized > 20 ? 2 : 0) + (labHit ? 4 : 0) + extra);
        p.away = 'hapis';
        p.awayUntil = w.m + yrs * 12;
        p.job = 'yok';
        p.parcel = undefined;
        if (p.id !== w.playerId) p.rel = clamp(p.rel + (p.tr.uyum >= 6 ? 15 : -20), -100, 100);
        log(w, `Baskın: ${seized ? `${seized} çuval mala el konuldu, ` : ''}ruhsatsız ekin söküldü. Suçu ${fullName(p)} üstlendi ve ${yrs} yıl hapis yattı.`, 'olay');
      }
      return true;
    }
    case 'aga_kira': {
      const nr = c.data!.nr as number;
      if (k === 'kabul') {
        w.hh.rent = nr;
        log(w, `Ağa kirayı ${fmt(Math.round(nr * infl(w.m)))} liraya çıkardı.`, 'para');
      } else if (chance(w, w.pol.seat === 'muhtar' ? 0.9 : 0.65)) {
        w.flags.namBonus = Number(w.flags.namBonus || 0) + 1;
        log(w, `Muhtarın araya girmesiyle kira aynı kaldı. Köyde "ağaya kafa tuttular" deniyor.`, 'olay');
      } else {
        w.hh.rent = Math.min(RENT_CAP, Math.round(nr * 1.05));
        w.flags.agaKin = Math.max(Number(w.flags.agaKin || 0), year(w.m));
        log(w, `İtiraz tutmadı; kira ${fmt(Math.round(w.hh.rent * infl(w.m)))} liraya çıktı. Ağa bu yılın sonuna kadar köyde kimseye sana toprak sattırmayacak.`, 'olay');
      }
      return true;
    }
    case 'aga_kiz': {
      const g = P(w, c.pid);
      if (!alive(g)) return true;
      if (k === 'ver') {
        const s = makeSpouseFor(w, g, false);
        s.last = 'Bozbey';
        marry(w, g, s);
        if (g.inHH) removeFromHH(w, g);
        const cut = Math.round(w.hh.debt / 2);
        w.hh.debt -= cut;
        g.rel = clamp(g.rel - 40, -100, 100);
        log(w, `${g.first}, ağanın oğlu ${s.first} Bozbey ile evlendirildi. Borcun ${fmt(cut)} lirası silindi. ${g.first} gelin giderken kimseye bakmadı.`, 'evlilik');
      } else {
        w.hh.rent = Math.round(w.hh.rent * 1.3);
        w.flags.agaKin = year(w.m) + 2;
        g.rel = clamp(g.rel + 25, -100, 100);
        log(w, `Ağanın isteği geri çevrildi. Ertesi hafta kira ${fmt(Math.round(w.hh.rent * infl(w.m)))} liraya çıktı.`, 'olay');
      }
      return true;
    }
  }
  return false;
}

export { scapegoats };

/** Ruhsat başvurusu: kart ya da Tarla sekmesindeki düğmeden. Dikkat yüksekse reddedilebilir; o zaman zarf ya da muhtar. */
export function applyRuhsat(w: World, fee = Math.round(80 * infl(w.m))): { ok: boolean; msg: string } {
  const yr = year(w.m);
  if (isBanYear(yr)) return { ok: false, msg: 'Yasak yıllarında ruhsat verilmiyor.' };
  if (w.ruhsat === yr) return { ok: false, msg: 'Bu yılın ruhsatı zaten var.' };
  if (w.hh.cash < fee) return { ok: false, msg: `Harç için ${fee} lira gerekiyor.` };
  w.hh.cash -= fee;
  w.flags.ruhsatSor = yr;
  if (w.heat >= 45 && chance(w, 0.6)) {
    const zarf = Math.round(900 * infl(w.m));
    pushCard(w, {
      id: 'ruhsat_red',
      text: `Ruhsat başvurusu reddedildi: "Hakkınızda şikâyet var." Tarım memuru yine de kapıyı tam kapatmadı.`,
      opts: [
        { t: `Memura zarf (${fmt(zarf)} lira)`, k: 'zarf' },
        { t: 'Muhtarı kefil göster', k: 'muhtar' },
        { t: 'Bu yıl ruhsatsız kalalım', k: 'yok' },
      ],
      data: { zarf },
    });
    return { ok: false, msg: 'Başvuru reddedildi; bir yolu var mı bak.' };
  }
  w.ruhsat = yr;
  log(w, `${yr} yılı için haşhaş ekim ruhsatı alındı.`, 'is');
  return { ok: true, msg: `${yr} ruhsatı alındı. Ekim–Kasım'da haşhaş ekebilirsin.` };
}
