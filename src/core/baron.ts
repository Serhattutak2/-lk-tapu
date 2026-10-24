// Yeraltı imparatorluğu ve şehir: kara para ve aklama, maaşlı adamlar, Kara Rıza'nın şebekesi,
// şehirde fabrikalar, şehre taşınma, rakip çete ve "Baron" unvanı. Hepsi soyut oyun sistemleridir.
import { niyetIs } from './yil';
import type { CrewState, FacId, LedgerLine, World } from './types';
import { chance, clamp, pick, rint } from './rng';
import { age, alive, fullName, hhMembers, log, P } from './people';
import { infl, year } from './calendar';
import { pushCard } from './cards';
import { BIZ } from './assets';
import { gangPay } from './feud';
import { distLaunder, DISTS, syncTurf, takeDistrict } from './district';
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

  // Şebeke: Rıza'nın eski yolları her ay pay getirir; çetenin kalanları haraç öder
  if (w.city.net) {
    const v = Math.round(900 * infl(w.m) * (1 + w.city.turf * 0.15) * (w.flags.rizaOgul === 'ortak' ? 0.7 : 1));
    w.dirty += v;
    lines.push({ t: 'Şebekenin yollarından gelen pay (kara kasaya)', v: 0 });
    w.flags.sebekeAy = v;
  }
  if (Number(w.flags.ceteHarac || 0) > w.m) {
    const v = Math.round(1200 * infl(w.m));
    w.dirty += v;
    lines.push({ t: 'Dağılan çetenin haracı (kara kasaya)', v: 0 });
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
  const baron = w.city.net && lab >= 3 && w.gang >= 10 && w.city.turf >= 2;
  if (baron && Number(w.flags.ceteYok || 0) >= 1 && w.city.turf >= 4) return { ad: `${CITY}'in Babası`, next: '' };
  if (baron) return { ad: 'Baron', next: `${CITY}'in Babası için: bir şehir çetesini dağıt ve dört mahalleyi elinde tut.` };
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

/** Rıza sonrası: kızgın Rıza ve yıllar sonra oğlu Selim */
export function rizaCards(w: World): boolean {
  if (w.flags.rizaKizgin && !w.city.net && chance(w, 0.012)) {
    w.heat = clamp(w.heat + 10, 0, 100);
    pushCard(w, {
      id: 'ce_riza',
      text: `Kara Rıza seni affetmedi: yollarını kesiyor, alıcılarına "o aileyle çalışan benimle çalışmaz" diyor. Bu ay jandarmaya da bir isimsiz mektup gitti.`,
      opts: [{ t: w.gang >= 4 ? `Rıza'yla hesaplaş (${w.gang} adam)` : 'Rıza\'yla hesaplaş (adamın az)', k: 'hesap' }, { t: `Elini öp, ortaklık teklif et (${fmt(15000 * infl(w.m))} lira)`, k: 'ozur' }, { t: 'Aldırma', k: 'yok' }],
    });
    return true;
  }
  const og = String(w.flags.rizaOgul || '');
  if ((og === 'dusman' || og === 'dost') && w.m >= Number(w.flags.rizaOgulM || 0)) {
    w.flags.rizaOgulM = w.m + 9999;
    if (og === 'dusman') {
      pushCard(w, {
        id: 'ce_selim',
        text: `Rıza'nın oğlu Selim büyüdü. Babasının eski adamlarını toplamış, ${CITY}'te senin yollarını kesiyor. Kahvede "babamın defterini geri alacağım" dediği konuşuluyor.`,
        opts: [{ t: w.gang >= 4 ? `Selim'in üstüne git (${w.gang} adam)` : 'Selim\'in üstüne git (adamın az)', k: 'savas' }, { t: `Babasının payını ver (${fmt(40000 * infl(w.m))} lira)`, k: 'pay' }, { t: 'Görmezden gel', k: 'yok' }],
      });
    } else {
      pushCard(w, {
        id: 'ce_selim',
        text: `Rıza'nın oğlu Selim kapına geldi. Babası İzmir'de öldü; son sözü "o aileye sadık kal" olmuş. Selim yanında çalışmak istiyor, babasının eski adamlarını da getirecek.`,
        opts: [{ t: 'Gel, sağ kolum ol', k: 'evet' }, { t: 'Kendi yolunu çiz', k: 'hayir' }],
      });
    }
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
        w.flags.rizaEmekli = w.m;
        log(w, `Kara Rıza emekliye ayrıldı. Şebekesi, adamları ve yolları artık ${w.surname} ailesinin.`, 'olay');
        pushCard(w, {
          id: 'ce_veda',
          text: `Kara Rıza İzmir otobüsüne binmeden seni garajın arkasına çağırdı. Yaşlı elleriyle cebinden yağlı bir defter çıkardı: "Kimin kime borcu var, hangi komutan ne yer, hangi yol nereye çıkar; hepsi burada." Sonra sesini alçalttı: "Bir tek ricam var. Oğlum Selim on yedisinde. Ona dokunmayın."`,
          opts: [
            { t: 'Söz: Selim\'e kimse dokunmayacak', k: 'soz' },
            { t: 'Selim\'i yanıma alırım, işi öğrensin', k: 'yanima' },
            { t: 'Söz veremem, bu işin kuralı belli', k: 'yok' },
          ],
        });
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
  if (id === 'ce_veda') {
    w.flags.kmtSir = true;
    const al = Math.round(18000 * infl(w.m));
    w.dirty += al;
    log(w, `Rıza'nın defteri açıldı: eski alacaklardan ${fmt(al)} lira toplandı, karakol komutanının sırrı da öğrenildi.`, 'olay');
    w.flags.rizaOgul = k === 'soz' ? 'dost' : k === 'yanima' ? 'adam' : 'dusman';
    w.flags.rizaOgulM = w.m + rint(w, 60, 120);
    if (k === 'yanima') {
      w.gang += 1;
      log(w, `Rıza'nın oğlu Selim adamlarının arasına katıldı.`, 'olay');
    }
    return true;
  }
  if (id === 'ce_selim') {
    const mode = String(w.flags.rizaOgul);
    if (mode === 'dusman') {
      if (k === 'savas') {
        const p = clamp(0.35 + w.gang * 0.04, 0.2, 0.85);
        w.heat = clamp(w.heat + 15, 0, 100);
        if (chance(w, p)) {
          w.flags.rizaOgul = 'bitti';
          log(w, `Selim'in adamları dağıtıldı; Selim şehirden kaçtı. Rıza'nın adı artık sadece eski kahvelerde anılıyor.`, 'olay');
        } else {
          w.gang = Math.max(0, w.gang - 2);
          w.flags.rizaOgulM = w.m + 18;
          log(w, `Selim hazırlıklıydı; iki adamın yaralanıp ayrıldı. Bu iş bitmedi.`, 'olay');
        }
      } else if (k === 'pay') {
        payDirtyFirst(w, Math.round(40000 * infl(w.m)));
        w.flags.rizaOgul = 'ortak';
        log(w, `Selim'e babasının payı verildi; şebekenin güney yolları onun. Kan dökülmedi.`, 'olay');
      } else {
        w.heat = clamp(w.heat + 20, 0, 100);
        w.flags.rizaOgulM = w.m + 24;
        log(w, `Selim jandarmaya senin depolarını ihbar etti.`, 'olay');
      }
    } else {
      if (k === 'evet') {
        w.gang += 3;
        w.flags.rizaOgul = 'sag';
        log(w, `Selim sağ kolun oldu; babasının eski adamlarını da getirdi.`, 'olay');
      } else {
        w.flags.rizaOgul = 'bitti';
        log(w, `Selim teşekkür edip kendi yoluna gitti.`, 'olay');
      }
    }
    return true;
  }
  if (id === 'ce_riza') {
    if (k === 'hesap') {
      if (w.gang >= 4 && chance(w, 0.6)) {
        w.city.net = true;
        w.flags.rizaKizgin = false;
        w.gang += 2;
        log(w, `Rıza'yla son hesap görüldü: yaşlı kaçakçı şehri terk etti, şebekesi sana kaldı.`, 'olay');
      } else {
        w.gang = Math.max(0, w.gang - 2);
        w.heat = clamp(w.heat + 15, 0, 100);
        log(w, `Rıza'nın adamları daha kalabalıktı. İki adamın ayrıldı.`, 'olay');
      }
    } else if (k === 'ozur') {
      payDirtyFirst(w, Math.round(15000 * infl(w.m)));
      w.flags.rizaKizgin = false;
      w.flags.rizaOrtak = true;
      log(w, `Rıza'nın elini öpüp ortaklık teklif ettin; yaşlı adam affetti.`, 'olay');
    } else w.heat = clamp(w.heat + 10, 0, 100);
    return true;
  }
  if (id === 'ce_kalan') {
    if (k === 'al') {
      const n = rint(w, 2, 4);
      w.gang += n;
      w.heat = clamp(w.heat + 5, 0, 100);
      log(w, `Dağılan çetenin ${n} adamı sana katıldı.`, 'olay');
    } else if (k === 'harac') {
      w.flags.ceteHarac = w.m + 60;
      log(w, `Eski çetenin kalanları beş yıl boyunca her ay sana haraç ödeyecek.`, 'olay');
    } else {
      w.flags.namBonus = Number(w.flags.namBonus || 0) + 3;
      w.heat = clamp(w.heat - 5, 0, 100);
      log(w, `Çetenin kalanları şehirden sürüldü. Esnaf rahat bir nefes aldı.`, 'olay');
      for (const d of w.city.dist) if (d.o === 'biz') d.loy = clamp(d.loy + 10, 0, 100);
    }
    return true;
  }
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
  return Math.round(FACS[f].income * k * infl(w.m) * (niyetIs(w, 'ticaret') ? 1.12 : 1) * (Number(w.flags.salgin || 0) > w.m ? 0.7 : 1));
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

const CREWS = ['Demirkol çetesi', 'Kuzgun kardeşler', 'Liman çocukları', 'Karadenizli Rüstem\'in adamları', 'Gece kuşları', 'Sarı Zeki\'nin çetesi'];

export function crewCards(w: World): boolean {
  const lab = w.lab?.lvl || 0;
  const again = w.crew?.gone && w.m >= Number(w.flags.nextCrew || 0);
  if ((!w.crew || again) && (w.city.moved || lab >= 2) && w.city.open && chance(w, 0.02)) {
    const used = String(w.flags.ceteler || '');
    const name = CREWS.find((n) => !used.includes(n)) ?? pick(w, CREWS);
    w.flags.ceteler = used + name + ';';
    w.crew = { name, men: rint(w, 8, 14) + Number(w.flags.ceteYok || 0) * 3, feud: again ? 40 : 20, turf: 1, gone: false };
    const free = w.city.dist.find((d) => d.o === 'serbest');
    if (free) {
      free.o = 'cete';
      syncTurf(w);
    }
    log(w, again ? `Boşluğu uzun süre kimse doldurmadı; şimdi ${name} şehre geldi. Senin adını duymuşlar ve korkmuyorlar.` : `${CITY}'in ${name}, yeni bir aile malının piyasayı bozduğunu duydu. Senden haber bekliyorlar.`, 'olay');
    return false;
  }
  const c = w.crew;
  if (!c || c.gone) return false;
  if (c.feud >= 50 && chance(w, 0.03)) {
    const opts = [
      { t: w.gang >= 4 ? `Savaş: adamlarını gönder (${w.gang} adam)` : 'Savaş (adamın az)', k: 'savas' },
      { t: `Haraç öde, sus (${fmt(12000 * infl(w.m))} lira)`, k: 'harac' },
      { t: 'Masaya otur, bölgeleri paylaşın', k: 'masa' },
      ...(w.pol.seat || Number(w.flags.kmtBizim || 0) > w.m ? [{ t: 'Polise sat: emniyetteki dostlara ihbar et', k: 'ihbar' }] : []),
      ...(w.gang >= 6 ? [{ t: 'Liderlerini şehirden sür (gece operasyonu)', k: 'lider' }] : []),
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

/** Çete dağıldı: mahalleleri, adamları ve şehirde yeni bir unvan. Yıllar sonra yenisi gelir. */
export function crewGone(w: World) {
  const c = w.crew;
  if (!c || c.gone) return;
  c.gone = true;
  c.men = 0;
  let n = 0;
  for (const d of w.city.dist) {
    if (d.o === 'cete') {
      d.o = w.city.moved ? 'biz' : 'serbest';
      n++;
    }
  }
  syncTurf(w);
  w.flags.ceteYok = Number(w.flags.ceteYok || 0) + 1;
  w.flags.namBonus = Number(w.flags.namBonus || 0) + 10;
  w.flags.nextCrew = w.m + rint(w, 36, 84);
  log(w, `${c.name} dağıldı. ${n ? `${n} mahalleleri ${w.city.moved ? 'artık senin' : 'sahipsiz kaldı'}. ` : ''}${CITY}'in yeraltında artık tek bir isim var: ${w.surname}.`, 'olay');
  pushCard(w, {
    id: 'ce_kalan',
    text: `${c.name}'nin liderleri şehirden kaçtı. Geride kalan adamları, kahvenin önünde başları önde, ne olacaklarını bekliyor.`,
    opts: [{ t: 'Yanıma alırım, maaşları benden', k: 'al' }, { t: 'Gitsinler ama her ay haraç ödesinler', k: 'harac' }, { t: 'Şehirden sürün, esnaf rahatlasın', k: 'sur' }],
  });
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
      const d = w.city.dist.find((x) => x.o === 'cete');
      if (d) {
        d.o = w.city.moved ? 'biz' : 'serbest';
        syncTurf(w);
      }
      log(w, `${c.name} ile sokak savaşı: onlardan ${k2} kişi saf dışı kaldı${d ? (w.city.moved ? `, ${DISTS[d.id].ad} sana geçti` : `, ${DISTS[d.id].ad} sahipsiz kaldı`) : ''}.`, 'olay');
      if (c.men <= 0) crewGone(w);
    } else {
      const lost = Math.min(w.gang, rint(w, 2, 3));
      w.gang -= lost;
      if (w.lab) {
        w.lab.prod = 0;
        w.lab.hap = 0;
      }
      log(w, `${c.name} ile çatışma kaybedildi: ${lost} adamın saf dışı kaldı, depodaki mal yağmalandı.`, 'olay');
    }
  } else if (k === 'ihbar') {
    if (chance(w, w.pol.seat === 'vekil' ? 0.85 : 0.6)) {
      c.men = Math.max(0, c.men - rint(w, 3, 5));
      log(w, `Emniyet ${c.name}'nin depolarını bastı; adamlarının yarısı içeride.`, 'olay');
      if (c.men <= 0) crewGone(w);
    } else {
      c.feud = clamp(c.feud + 20, 0, 100);
      log(w, `İhbar sızdı; ${c.name} kimin konuştuğunu biliyor.`, 'olay');
    }
  } else if (k === 'lider') {
    w.heat = clamp(w.heat + 20, 0, 100);
    if (chance(w, clamp(0.3 + w.gang * 0.03 - c.men * 0.02, 0.15, 0.75))) {
      c.men = Math.max(0, Math.round(c.men * 0.5));
      log(w, `${c.name}'nin liderleri bir gece şehirden kaçırıldı; geride kalanlar başsız.`, 'olay');
      if (c.men <= 2) crewGone(w);
    } else {
      w.gang = Math.max(0, w.gang - 2);
      log(w, `Operasyon sızdı; iki adamın yakalandı.`, 'olay');
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
