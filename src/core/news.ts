// Kasabadan gelen gazete, sonra radyo, sonra televizyon: ülkenin büyük günleri köye böyle ulaşır.
// Yalnızca olgular, tarafsız bir dille. Bazıları oyuna küçük bir etki bırakır.
import type { World } from './types';
import { clamp } from './rng';
import { hhMembers, log, age } from './people';
import { monthOf, year } from './calendar';
import { pushCard } from './cards';
import { has } from './era';

interface Head { y: number; mo: number; t: string; fx?: (w: World) => void }
const HEADS: Head[] = [
  { y: 1926, mo: 1, t: 'Medeni Kanun kabul edildi. Kahvede "artık kadınlar da mirastan pay alacak" diye konuşuluyor.' },
  { y: 1927, mo: 4, t: 'Ankara\'da radyo yayını başladı. Köyde henüz kimse duymadı; kasabadaki eczacı dinlemiş.' },
  { y: 1934, mo: 11, t: 'Kadınlara seçme ve seçilme hakkı verildi.' },
  { y: 1938, mo: 10, t: 'Atatürk Dolmabahçe\'de vefat etti. Köy meydanında herkes başı önde bekledi; okulda çocuklar ağladı.' },
  { y: 1939, mo: 11, t: 'Erzincan\'da büyük deprem: on binlerce can gitti. Köyden yardım için buğday ve battaniye toplandı.', fx: (w) => (w.flags.namBonus = Number(w.flags.namBonus || 0) + 1) },
  { y: 1945, mo: 4, t: 'Avrupa\'da savaş bitti. Silah altındaki gençlerin yakında döneceği söyleniyor.' },
  { y: 1952, mo: 1, t: 'Türkiye NATO\'ya girdi.' },
  { y: 1966, mo: 7, t: 'Varto\'da deprem. Köyden yine yardım kamyonu gitti.' },
  { y: 1969, mo: 6, t: 'İnsan Ay\'a ayak bastı. Kahvede yarısı inandı, yarısı "film çekmişler" dedi.' },
  { y: 1973, mo: 9, t: 'Boğaziçi Köprüsü açıldı: Asya ile Avrupa artık bir köprüyle bağlı.' },
  { y: 1986, mo: 4, t: 'Çernobil\'de nükleer kaza. Karadeniz çayından korkanlar var.' },
  { y: 1991, mo: 0, t: 'Körfez\'de savaş. Akaryakıt pahalandı; traktörlerin mazotu dert oldu.' },
  { y: 1999, mo: 7, t: 'Marmara\'da büyük deprem: on yedi bin kişi hayatını kaybetti. Bütün ülke yasta; köyden çadır ve erzak gitti.' },
  { y: 2002, mo: 5, t: 'Milli takım Dünya Kupası\'nda üçüncü oldu. Köyde gece yarısı davul zurna çıktı.' },
  { y: 2023, mo: 1, t: 'Kahramanmaraş merkezli iki büyük deprem on bir ili yıktı. Ülke tarihinin en büyük felaketlerinden biri; köyden yardım tırı yola çıktı.' },
  { y: 2023, mo: 9, t: 'Cumhuriyet yüz yaşında. Köy meydanında fener alayı yapıldı.' },
];

const medium = (w: World) => (year(w.m) < 1950 ? 'Kasabadan gelen gazete' : !has(w, 'tv') && year(w.m) < 1975 ? 'Radyo' : 'Televizyon');

export function monthlyNews(w: World) {
  const y = year(w.m);
  const mo = monthOf(w.m);
  for (const h of HEADS) {
    if (h.y !== y || h.mo !== mo || w.flags['haber' + h.y + '_' + h.mo]) continue;
    w.flags['haber' + h.y + '_' + h.mo] = true;
    log(w, `${medium(w)}: ${h.t}`, 'olay');
    h.fx?.(w);
  }
}

/** 2020 salgını: bir karar kartı */
export function newsCards(w: World): boolean {
  if (year(w.m) === 2020 && monthOf(w.m) >= 2 && !w.flags.salginKart) {
    w.flags.salginKart = true;
    w.flags.salgin = w.m + 15;
    pushCard(w, {
      id: 'nw_salgin',
      text: `Dünyayı bir salgın sardı. Okullar kapandı, şehirlerde sokağa çıkma yasağı var, maskesiz kimse dolaşmıyor. Fabrikalar ve dükkânlar yarım çalışıyor. Evdeki yaşlılar için herkes korkuyor.`,
      opts: [
        { t: 'Yaşlıları köydeki eve kapat, kimse yanlarına girmesin', k: 'koru' },
        { t: 'İşçilere maaşını öde, kimseyi çıkarma', k: 'isci' },
        { t: 'Hayat devam ediyor; düğün de bayram da yapılır', k: 'devam' },
      ],
    });
    return true;
  }
  return false;
}

export function resolveNews(w: World, id: string, k: string): boolean {
  if (!id.startsWith('nw_')) return false;
  const old = hhMembers(w).filter((p) => age(w, p) >= 65);
  if (k === 'koru') {
    for (const p of old) p.rel = clamp(p.rel + 5, -100, 100);
    log(w, `Yaşlılar korundu; bayramlarda el öpmek yerine pencereden el sallandı.`, 'olay');
  } else if (k === 'isci') {
    w.flags.namBonus = Number(w.flags.namBonus || 0) + 4;
    w.hh.cash = Math.round(w.hh.cash * 0.9);
    log(w, `Salgında kimse işten çıkarılmadı. Fabrikalarda adın hayırla anılıyor.`, 'olay');
  } else {
    for (const p of old) {
      p.hp = clamp(p.hp - 20, 3, 100);
      p.sick = 3;
    }
    log(w, `Düğünler, cenazeler kalabalık geçti; evdeki yaşlılar ağır hastalandı.`, 'olay');
  }
  return true;
}

export const salginVar = (w: World) => Number(w.flags.salgin || 0) > w.m;
