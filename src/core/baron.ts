// Yeraltı imparatorluğu ve şehir: kara para ve aklama, maaşlı adamlar, Kara Rıza'nın şebekesi,
// şehirde fabrikalar, şehre taşınma, rakip çete ve "Baron" unvanı. Hepsi soyut oyun sistemleridir.
import type { CrewState, FacId, LedgerLine, World } from './types';
import { chance, clamp, pick, rint } from './rng';
import { age, alive, fullName, hhMembers, log, P } from './people';
import { infl, year } from './calendar';
import { pushCard } from './cards';
import { BIZ } from './assets';
import { gangPay } from './feud';
import { distLaunder, DISTS, takeDistrict } from './district';
import { has } from './era';
import { hasEngineer } from './events';

const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR');
export const CITY = 'Çukurkent';

// ---------- Kara para ----------

/** Kara para ile ödenebilecek kalemler önce kara kasadan düşer. */
export function payDirtyFirst(w: World, amount: number) {
  const d = Math.min(w.dirty, amount);
  w.dirty -= d;
  w.hh.cash -= amount - d;
}

export const canPay = (w: World, amount: number) => w.dirty + w.hh.cash >= amount;

/** Aylık aklama kapasitesi (1965 lirası × enflasyon) */
export function launderCap(w: World): number {
  let c = 0;
  for (const b of Object.keys(BIZ) as (keyof typeof BIZ)[]) if (w.hh.biz[b]) c += b === 'bakkal' ? 1500 : b === 'kahve' ? 2500 : 4000;
  for (const f of Object.keys(w.city.facs) as FacId[]) c += FACS[f].launder;
  return Math.round((c * infl(w.m) + distLaunder(w)) * (has(w, 'bilgisayar') ? 1.25 : 1));
}
export const launderFee = (w: World) => (w.city.facs.gazino ? 0.08 : 0.14) - (has(w, 'kripto') ? 0.04 : 0);

export function monthlyBaron(w: World, lines: LedgerLine[]) {
  // Aklama
  const cap = launderCap(w);
  if (w.dirty > 0 && cap > 0) {
    const x = Math.min(w.dirty, cap);
    const fee = Math.round(x * launderFee(w));
    w.dirty -= x;
    w.hh.cash += x - fee;
    w.city.laundered += x;
    lines.push({ t: `Aklanan kara para (komisyon ${fmt(fee)} lira)`, v: x - fee });
  }
  if (w.dirty > 60000 * infl(w.m)) w.heat = clamp(w.heat + 0.6, 0, 100);

  // Adamların maaşı
  if (w.gang > 0) {
    const pay = w.gang * gangPay(w);
    if (!canPay(w, pay)) {
      const left = Math.max(1, Math.floor((w.dirty + w.hh.cash) / gangPay(w)));
      log(w, `Maaşları ödenemeyen ${w.gang - left} adam başka kapıya gitti.`, 'olay');
      w.gang = Math.min(w.gang, left);
    }
    payDirtyFirst(w, w.gang * gangPay(w));
    lines.push({ t: `${w.gang} adamın maaşı`, v: -w.gang * gangPay(w) });
  }

  // Fabrikalar
  for (const f of Object.keys(w.city.facs) as FacId[]) {
    const v = facIncome(w, f);
    w.hh.cash += v;
    const st = w.city.facs[f]!;
    const mgr = P(w, st.mgr);
    lines.push({ t: `${FACS[f].ad}${alive(mgr) && mgr.job === 'isletme' ? ` (${mgr.first})` : ''}`, v });
  }


  // Şehir yaşamı pahalı
  if (w.city.moved) {
    const c = Math.round(hhMembers(w).length * 70 * infl(w.m));
    w.hh.cash -= c;
    lines.push({ t: `${CITY}'te şehir hayatı`, v: -c });
  }

  // Şehri açan eşik
  if (!w.city.open && (w.hh.cash + w.dirty >= 90000 * infl(w.m) || w.hh.parcels.length >= 12)) {
    w.city.open = true;
    log(w, `Adın ${CITY}'e kadar ulaştı. Şehrin tüccarları, fabrikatörleri ve karanlık adamları artık seni tanıyor. Şehre açılan kapı aralandı.`, 'olay');
  }
}

// ---------- Unvan ----------
export function underTitle(w: World): { ad: string; next: string } {
  const lab = w.lab?.lvl || 0;
  if (w.city.net && lab >= 3 && w.gang >= 10 && w.city.turf >= 2) return { ad: 'Baron', next: '' };
  if (w.city.net) return { ad: 'Şebeke sahibi', next: 'Baron için: hap imalathanesi, 10 adam ve şehirde iki mahalle.' };
  if (lab >= 1) return { ad: 'İmalatçı', next: 'Şebeke sahibi için: Kara Rıza\'nın şebekesini ele geçir.' };
  if (w.flags.kacakci) return { ad: 'Kaçakçı', next: 'İmalatçı için: gizli bir atölye kur.' };
  return { ad: 'Temiz', next: 'Henüz kayıt dışı bir işin yok.' };
}

// ---------- Adamlar ----------
export function hire(w: World, d: number): { ok: boolean; msg: string } {
  if (d > 0 && !w.flags.kacakci) return { ok: false, msg: 'Silahlı adam bulmak için önce yeraltında tanıdık gerekir.' };
  if (d > 0 && !canPay(w, gangPay(w) * 3)) return { ok: false, msg: 'Üç aylık maaşı peşin vermeden kimse gelmez.' };
  w.gang = clamp(w.gang + d, 0, 30);
  return { ok: true, msg: d > 0 ? `Bir adam daha tuttun (${w.gang}).` : `Bir adamı gönderdin (${w.gang}).` };
}

// ---------- Rıza'nın şebekesi ----------
export function netCards(w: World): boolean {
  if (w.city.net || !w.lab || w.lab.lvl < 2 || w.flags.rizaKarar) return false;
  if (w.gang >= 5 && chance(w, 0.04)) {
    w.flags.rizaKarar = true;
    pushCard(w, {
      id: 'riza_taht',
      text: `Kara Rıza yaşlandı ve korkuyor; senin malın onun şebekesinin yarısını taşıyor. Adamları sana bakmaya başladı. Bir akşam Rıza'nın en güvendiği adamı yanına geldi: "Ağabey yorgun. Yerine biri geçmeli."`,
      opts: [
        { t: 'Rıza\'yı emekliye ayır: şebekeyi devral', k: 'devral' },
        { t: 'Ortak ol, kârı paylaş', k: 'ortak' },
        { t: 'Rıza\'ya sadık kal, adamı ona ispiyonla', k: 'sadik' },
      ],
    });
    return true;
  }
  return false;
}

export const netBonus = (w: World) => (w.city.net ? 1.6 : w.flags.rizaOrtak ? 1.25 : 1);

export function resolveBaron(w: World, id: string, k: string): boolean {
  if (id === 'riza_taht') {
    if (k === 'devral') {
      if (chance(w, clamp(0.4 + w.gang * 0.05, 0.4, 0.9))) {
        w.city.net = true;
        w.gang += 3;
        w.heat = clamp(w.heat + 20, 0, 100);
        log(w, `Kara Rıza bir sabah İzmir otobüsüne bindirildi ve bir daha görülmedi. Şebekesi, adamları ve yolları artık ${w.surname} ailesinin.`, 'olay');
      } else {
        w.gang = Math.max(0, w.gang - 2);
        w.flags.rizaKizgin = true;
        w.heat = clamp(w.heat + 25, 0, 100);
        log(w, `Rıza'yı devirme girişimi patladı. İki adamın gitti, Rıza artık sana kan kusuyor.`, 'olay');
      }
    } else if (k === 'ortak') {
      w.flags.rizaOrtak = true;
      log(w, `Kara Rıza ile ortaklık kuruldu: malın artık şebekenin en iyi yollarından gidiyor.`, 'olay');
    } else {
      w.flags.namBonus = Number(w.flags.namBonus || 0) + 3;
      log(w, `Rıza'ya sadık kalındı. Devrilmeye kalkan adam bir daha görülmedi.`, 'olay');
    }
    return true;
  }
  if (id === 'cete') return resolveCrew(w, k);
  return false;
}

// ---------- Şehir: fabrikalar, ev, taşınma ----------
export interface FacDef { id: FacId; ad: string; price: number; income: number; launder: number; desc: string; }
export const FACS: Record<FacId, FacDef> = {
  un: { id: 'un', ad: 'Un fabrikası', price: 130000, income: 2600, launder: 9000, desc: 'Köyün buğdayını alır, ekmek fırınlarına un satar. Kendi tarlalarında buğday ekiyorsan kârı artar.' },
  nakliye: { id: 'nakliye', ad: 'Nakliye şirketi', price: 110000, income: 2100, launder: 7000, desc: 'Otuz kamyonluk filo. Gündüz domates, gece başka şey taşır: kaçak ürün fiyatı %15 artar.' },
  tekstil: { id: 'tekstil', ad: 'Tekstil atölyesi', price: 180000, income: 3700, launder: 12000, desc: 'İki yüz dikiş makinesi. Grev ve sipariş dalgalanması olur ama düzenli para getirir.' },
  gazino: { id: 'gazino', ad: 'Gazino', price: 160000, income: 2400, launder: 26000, desc: 'Sahne, masa, çok nakit. Kara parayı en ucuza aklar; komisyon %14\'ten %8\'e iner. Polis de buraya gelir.' },
  insaat: { id: 'insaat', ad: 'İnşaat şirketi', price: 260000, income: 5200, launder: 32000, desc: 'Belediyeden ihale, kat karşılığı apartmanlar. Kazancı yıla göre çok oynar ama büyük para burada.' },
};
export const facPrice = (w: World, f: FacId) => Math.round((FACS[f].price * infl(w.m)) / 1000) * 1000;

export function facIncome(w: World, f: FacId): number {
  const st = w.city.facs[f];
  if (!st) return 0;
  const mgr = P(w, st.mgr);
  const good = alive(mgr) && mgr.job === 'isletme' && mgr.inHH && !mgr.away;
  let k = good ? 0.75 + (mgr!.sk.ticaret / 100) * 0.5 : 0.55;
  if (f === 'un') k *= 1 + Math.min(0.4, w.hh.parcels.filter((p) => p.crop === 'bugday').length * 0.05);
  if (f === 'insaat') k *= 0.6 + ((year(w.m) * 7) % 10) / 10;
  if (f === 'tekstil' && w.flags.grev === year(w.m)) k *= 0.3;
  if (has(w, 'bilgisayar')) k *= 1.1;
  if (hasEngineer(w)) k *= 1.1;
  return Math.round(FACS[f].income * k * infl(w.m));
}

export function buyFac(w: World, f: FacId): { ok: boolean; msg: string } {
  if (!w.city.open) return { ok: false, msg: 'Şehir henüz sana kapılarını açmadı.' };
  if (w.city.facs[f]) return { ok: false, msg: 'Zaten senin.' };
  const p = facPrice(w, f);
  if (w.hh.cash < p) return { ok: false, msg: `Temiz parada ${fmt(p - w.hh.cash)} lira eksik. Kara para tapuya geçmez; önce akla.` };
  w.hh.cash -= p;
  w.city.facs[f] = { since: w.m };
  log(w, `${CITY}'te ${FACS[f].ad.toLowerCase()} satın alındı: ${fmt(p)} lira.`, 'tapu');
  return { ok: true, msg: `${FACS[f].ad} senin.` };
}

export function setFacMgr(w: World, f: FacId, pid: string | null) {
  const st = w.city.facs[f];
  if (!st) return;
  const old = P(w, st.mgr);
  if (alive(old) && old.job === 'isletme') old.job = 'tarla';
  st.mgr = undefined;
  if (!pid) return;
  const p = P(w, pid);
  if (!alive(p) || age(w, p) < 18) return;
  p.job = 'isletme';
  p.biz = undefined;
  p.parcel = undefined;
  st.mgr = p.id;
}

export const HOMES = [
  { lvl: 0, ad: '', price: 0 },
  { lvl: 1, ad: 'Apartman dairesi', price: 55000 },
  { lvl: 2, ad: 'Bahçeli villa', price: 190000 },
];
export const homePrice = (w: World, l: number) => Math.round((HOMES[l].price * infl(w.m)) / 1000) * 1000;

export function buyCityHome(w: World): { ok: boolean; msg: string } {
  const n = w.city.home + 1;
  if (n > 2) return { ok: false, msg: 'Daha iyisi yok.' };
  if (!w.city.open) return { ok: false, msg: 'Şehir henüz açılmadı.' };
  const p = homePrice(w, n);
  if (w.hh.cash < p) return { ok: false, msg: `Temiz parada ${fmt(p - w.hh.cash)} lira eksik.` };
  w.hh.cash -= p;
  w.city.home = n;
  w.flags.namBonus = Number(w.flags.namBonus || 0) + (n === 2 ? 12 : 5);
  log(w, `${CITY}'te ${HOMES[n].ad.toLowerCase()} alındı: ${fmt(p)} lira.`, 'tapu');
  return { ok: true, msg: `${HOMES[n].ad} senin.` };
}

export function moveToCity(w: World, on: boolean): { ok: boolean; msg: string } {
  if (on && !w.city.home) return { ok: false, msg: 'Önce şehirde bir ev al.' };
  w.city.moved = on;
  if (on) {
    for (const f of w.hh.parcels) if (f.mode === 'kendi' && !w.hh.veh.traktor) f.mode = 'yarici';
    log(w, `${w.surname} ailesi ${CITY}'e taşındı. Köydeki tarlalar yarıcılara, ev kâhyaya bırakıldı. Çocuklar şehir okullarına yazıldı.`, 'olay');
  } else log(w, `Aile köye geri döndü.`, 'olay');
  return { ok: true, msg: on ? 'Şehre taşındınız.' : 'Köye döndünüz.' };
}

// ---------- Mahalleler ve rakip çete ----------
export function takeTurf(w: World): { ok: boolean; msg: string } {
  const d = w.city.dist.find((x) => x.o !== 'biz' && year(w.m) >= DISTS[x.id].from);
  if (!d) return { ok: false, msg: 'Alınacak mahalle kalmadı.' };
  return takeDistrict(w, d.id);
}

const CREWS = ['Demirkol çetesi', 'Kuzgun kardeşler', 'Liman çocukları'];

export function crewCards(w: World): boolean {
  const lab = w.lab?.lvl || 0;
  if (!w.crew && (w.city.moved || lab >= 2) && w.city.open && chance(w, 0.02)) {
    const used = String(w.flags.ceteler || '');
    const name = CREWS.find((n) => !used.includes(n)) ?? pick(w, CREWS);
    w.flags.ceteler = used + name + ';';
    w.crew = { name, men: rint(w, 8, 14), feud: 20, turf: 3, gone: false };
    log(w, `${CITY}'in ${name}, yeni bir aile malının piyasayı bozduğunu duydu. Senden haber bekliyorlar.`, 'olay');
    return false;
  }
  const c = w.crew;
  if (!c || c.gone) return false;
  if (c.feud >= 50 && chance(w, 0.03)) {
    const opts = [
      { t: w.gang >= 4 ? `Savaş: adamlarını gönder (${w.gang} adam)` : 'Savaş (adamın az)', k: 'savas' },
      { t: `Haraç öde, sus (${fmt(12000 * infl(w.m))} lira)`, k: 'harac' },
      { t: 'Masaya otur, bölgeleri paylaşın', k: 'masa' },
    ];
    pushCard(w, {
      id: 'cete',
      text: `${c.name} mesaj yolladı: ${lab ? 'atölyeden çıkan bir kamyon yolda durduruldu, şoför dövüldü. ' : ''}"Bu şehirde bizim iznimiz olmadan iş dönmez." ${c.men} silahlı adamları var.`,
      opts,
    });
    return true;
  }
  if (chance(w, 0.01)) c.feud = clamp(c.feud + 10, 0, 100);
  return false;
}

function resolveCrew(w: World, k: string): boolean {
  const c = w.crew;
  if (!c) return true;
  if (k === 'savas') {
    const p = clamp(0.25 + w.gang * 0.04 - c.men * 0.025, 0.1, 0.85);
    w.heat = clamp(w.heat + 18, 0, 100);
    if (chance(w, p)) {
      const k2 = rint(w, 2, 4);
      c.men -= k2;
      c.turf = Math.max(0, c.turf - 1);
      w.city.turf += w.city.moved ? 1 : 0;
      log(w, `${c.name} ile sokak savaşı: onlardan ${k2} kişi düştü${w.city.moved ? ', bir mahalleleri sana geçti' : ''}.`, 'olay');
      if (c.men <= 0) {
        c.gone = true;
        w.flags.namBonus = Number(w.flags.namBonus || 0) + 10;
        log(w, `${c.name} dağıldı. ${CITY}'in yeraltında artık bir isim var: ${w.surname}.`, 'olay');
      }
    } else {
      const lost = Math.min(w.gang, rint(w, 2, 3));
      w.gang -= lost;
      if (w.lab) {
        w.lab.prod = 0;
        w.lab.hap = 0;
      }
      log(w, `${c.name} ile çatışma kaybedildi: ${lost} adam öldü, depodaki mal yağmalandı.`, 'olay');
    }
  } else if (k === 'harac') {
    payDirtyFirst(w, Math.round(12000 * infl(w.m)));
    c.feud = clamp(c.feud - 30, 0, 100);
    log(w, `${c.name}'ne haraç ödendi. Şimdilik yollar açık.`, 'olay');
  } else {
    if (chance(w, 0.5)) {
      c.feud = 10;
      log(w, `${c.name} ile bölgeler paylaşıldı: liman onların, iç sanayi senin.`, 'olay');
    } else {
      c.feud = clamp(c.feud + 15, 0, 100);
      log(w, `Masa devrildi; ${c.name} paylaşmaya yanaşmadı.`, 'olay');
    }
  }
  return true;
}

/** Tekstilde grev gibi şehir olayları */
export function cityEvents(w: World) {
  if (w.city.facs.tekstil && w.flags.grev !== year(w.m) && chance(w, 0.008)) {
    w.flags.grev = year(w.m);
    log(w, `Tekstil atölyesinde grev: işçiler zam istiyor. Bu yıl üretim düşük.`, 'olay');
  }
}

export function cityMembers(w: World) {
  return hhMembers(w).filter((p) => p.job === 'isletme');
}

export { fullName };
export type { CrewState };
