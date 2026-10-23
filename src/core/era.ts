// Çağlar ve teknoloji: yıllar geçtikçe köye ve şehre yenilikler gelir.
// Bazıları kendiliğinden (elektrik, telefon), bazıları satın alınır (biçerdöver, kamera, cep telefonu).
// Devlet de gelişir: gözetim, telsiz, kamera, dijital takip baskın ihtimalini artırır.
import type { TechId, World } from './types';
import { clamp } from './rng';
import { infl, year } from './calendar';
import { log } from './people';
import { pushCard } from './cards';
import { hhMembers } from './people';
import { age } from './people';

export interface EraDef { from: number; ad: string; desc: string; }
export const ERAS: EraDef[] = [
  { from: 1925, ad: 'Kuruluş Yılları', desc: 'Cumhuriyet yeni kuruldu. Aşar kalktı, okullar açılıyor; ama köyde hâlâ kağnı, kara saban ve ağanın sözü geçiyor.' },
  { from: 1939, ad: 'Savaş Yılları', desc: 'Dünya savaşta. Ülke savaşa girmedi ama erkekler silah altında, ekmek karneyle, karaborsa her yerde.' },
  { from: 1946, ad: 'Toprak Yılları', desc: 'Çok partili hayat başladı. Devlet topraksız köylüye toprak dağıtıyor, köylere yol geliyor, ağaların gücü sarsılıyor.' },
  { from: 1961, ad: 'Gurbet Yılları', desc: 'Almanya işçi istiyor. Trenler köyün gençleriyle dolu; gelen marklar köylerin yüzünü değiştiriyor.' },
  { from: 1975, ad: 'Kargaşa Yılları', desc: 'Sokaklar karışık, kontroller sıkı. Jandarma her yerde; kaçakçılık hem tehlikeli hem kârlı.' },
  { from: 1983, ad: 'Açılım', desc: 'Serbest piyasa, ithal mallar, kredi. Şehirler büyüyor, para el değiştiriyor.' },
  { from: 1995, ad: 'Kriz Yılları', desc: 'Enflasyon, batan bankalar, ucuza düşen mülkler. Nakit olan kral.' },
  { from: 2005, ad: 'Dijital Çağ', desc: 'Kameralar, telefon dinlemeleri, kayıtlı ekonomi. Kara para eskisi kadar kolay saklanmıyor.' },
  { from: 2020, ad: 'Yeni Dünya', desc: 'Dronlar, uydular, uygulamalar. Eski usul aileler ya uyum sağlar ya silinir.' },
];

export function eraOf(w: World): EraDef {
  const y = year(w.m);
  let e = ERAS[0];
  for (const x of ERAS) if (y >= x.from) e = x;
  return e;
}

export interface TechDef { id: TechId; ad: string; from: number; price: number; auto: boolean; desc: string; }
export const TECHS: Record<TechId, TechDef> = {
  kinin: { id: 'kinin', ad: 'Sıtma savaşı', from: 1926, price: 0, auto: true, desc: 'Devlet köylere kinin dağıtıyor, bataklıklar kurutuluyor. Sıtma eskisi kadar öldürmüyor.' },
  pulluk: { id: 'pulluk', ad: 'Demir pulluk', from: 1928, price: 650, auto: false, desc: 'Kara sabanın yerine demir pulluk: toprak derin sürülür, bütün hasatlar %6 artar.' },
  gramofon: { id: 'gramofon', ad: 'Gramofon', from: 1931, price: 900, auto: false, desc: 'Taş plaklar, İstanbul şarkıları. Akşamları misafir eksik olmaz: nam +2.' },
  dikis: { id: 'dikis', ad: 'Dikiş makinesi', from: 1934, price: 1400, auto: false, desc: 'Evdeki kadınlar köye elbise, çeyiz diker: ev işlerine bakan her kadın aylık ek kazanç getirir.' },
  penisilin: { id: 'penisilin', ad: 'Penisilin', from: 1950, price: 0, auto: true, desc: 'Antibiyotik eczanelere geldi. Ağır hastalıklar artık çoğu zaman iyileşiyor.' },
  bisiklet: { id: 'bisiklet', ad: 'Bisikletler', from: 1952, price: 750, auto: false, desc: 'Gündeliğe gidenler uzak tarlalara da yetişir: gündelikçi ve inşaat kazancı %8 artar.' },
  koyyolu: { id: 'koyyolu', ad: 'Köy yolu', from: 1955, price: 0, auto: true, desc: 'Köye stabilize yol yapıldı. Hasat pazara kolay gider: satışlar %3 artar.' },
  radyo: { id: 'radyo', ad: 'Radyo', from: 1966, price: 300, auto: false, desc: 'Akşam haberleri, türküler. Evdekilerin keyfi yerinde: bağlılık yavaşça artar.' },
  elektrik: { id: 'elektrik', ad: 'Köye elektrik', from: 1969, price: 0, auto: true, desc: 'Direkler dikildi, ampuller yandı. Atölyeler gece de çalışır: kapasite +1.' },
  telefon: { id: 'telefon', ad: 'Ev telefonu', from: 1972, price: 2500, auto: false, desc: 'Santrale bağlı bir hat. Baskın haberi önceden gelir: baskın ihtimali %20 düşer.' },
  buzdolabi: { id: 'buzdolabi', ad: 'Buzdolabı', from: 1974, price: 3000, auto: false, desc: 'Süt bozulmaz, et saklanır. Ahırın kazancı %30 artar.' },
  tv: { id: 'tv', ad: 'Televizyon', from: 1975, price: 6000, auto: false, desc: 'Köyde ilk ekran. Akşamları bütün köy sizin avluda: nam +4.' },
  telsiz: { id: 'telsiz', ad: 'Jandarma telsizi', from: 1978, price: 0, auto: true, desc: 'Karakollar birbirine bağlandı. Baskınlar daha sık ve daha hızlı.' },
  bicer: { id: 'bicer', ad: 'Biçerdöver', from: 1979, price: 60000, auto: false, desc: 'Hasat aylarında tek başına 6 işçi gücü verir; eksik parsellere gider.' },
  asfalt: { id: 'asfalt', ad: 'Asfalt yol', from: 1984, price: 0, auto: true, desc: 'Köy yolu asfaltlandı. Şehir artık iki saat uzakta: hasat satışları %5 artar.' },
  sulama: { id: 'sulama', ad: 'Damla sulama', from: 1987, price: 25000, auto: false, desc: 'Kuraklık eskisi kadar korkutmaz: yağış etkisi yarıya iner.' },
  bilgisayar: { id: 'bilgisayar', ad: 'Bilgisayarlı muhasebe', from: 1991, price: 30000, auto: false, desc: 'Fabrika ve işletme defterleri düzene girer: kazanç %10, aklama kapasitesi %25 artar.' },
  cep: { id: 'cep', ad: 'Cep telefonları', from: 1996, price: 15000, auto: false, desc: 'Adamların her an ulaşılabilir. Baskın ve savaşta başarı artar, pusu azalır.' },
  kamera: { id: 'kamera', ad: 'Güvenlik kameraları', from: 2001, price: 22000, auto: false, desc: 'Atölye, depo ve ev izleniyor. Atölyenin baskında bulunma ihtimali düşer, soygun azalır.' },
  dinleme: { id: 'dinleme', ad: 'Telefon dinlemeleri', from: 2006, price: 0, auto: true, desc: 'Devlet artık konuşmaları dinliyor. Dikkat daha yavaş söner.' },
  kripto: { id: 'kripto', ad: 'Dijital cüzdanlar', from: 2016, price: 90000, auto: false, desc: 'Kara para sınır tanımaz: aklama komisyonu 4 puan düşer.' },
  dron: { id: 'dron', ad: 'Tarım dronu', from: 2019, price: 120000, auto: false, desc: 'İlaçlama, gözetim, keşif. Tarlalarda verim %8 artar, rakip pusuları önceden görülür.' },
  uydu: { id: 'uydu', ad: 'Uydu gözetimi', from: 2021, price: 0, auto: true, desc: 'Devlet tarlaları uydudan izliyor. Ruhsatsız ekim neredeyse her zaman yakalanır.' },
};

export const has = (w: World, t: TechId) => !!w.tech?.[t];
export const techPrice = (w: World, t: TechId) => Math.round((TECHS[t].price * infl(w.m)) / 100) * 100;

export function buyTech(w: World, t: TechId): { ok: boolean; msg: string } {
  const d = TECHS[t];
  if (d.auto) return { ok: false, msg: 'Bu satın alınmaz; zamanı gelince kendiliğinden gelir.' };
  if (has(w, t)) return { ok: false, msg: 'Zaten var.' };
  if (year(w.m) < d.from) return { ok: false, msg: `${d.from}'den önce bulunmaz.` };
  const p = techPrice(w, t);
  if (w.hh.cash < p) return { ok: false, msg: `${(p - w.hh.cash).toLocaleString('tr-TR')} lira eksik.` };
  w.hh.cash -= p;
  w.tech[t] = w.m;
  if (t === 'tv') w.flags.namBonus = Number(w.flags.namBonus || 0) + 4;
  if (t === 'gramofon') w.flags.namBonus = Number(w.flags.namBonus || 0) + 2;
  log(w, `${d.ad} alındı (${p.toLocaleString('tr-TR')} lira).`, 'tapu');
  return { ok: true, msg: `${d.ad} geldi.` };
}

/** Her ay: yeni çağ ve kendiliğinden gelen teknolojiler. */
export function monthlyEra(w: World) {
  const y = year(w.m);
  const e = eraOf(w);
  if (w.flags.era !== e.ad) {
    const first = !w.flags.era;
    w.flags.era = e.ad;
    if (!first) {
      log(w, `Yeni bir çağ: ${e.ad}. ${e.desc}`, 'olay');
      pushCard(w, { id: 'bilgi', text: `${y}: ${e.ad} başladı. ${e.desc}`, opts: [{ t: 'Zaman değişiyor', k: 'ok' }] });
    }
  }
  for (const d of Object.values(TECHS)) {
    if (!d.auto || has(w, d.id) || y < d.from) continue;
    w.tech[d.id] = w.m;
    log(w, `${d.ad}: ${d.desc}`, 'olay');
  }
  for (const d of Object.values(TECHS)) {
    if (d.auto || has(w, d.id) || y !== d.from || w.flags['yeni' + d.id]) continue;
    w.flags['yeni' + d.id] = true;
    log(w, `Yenilik: ${d.ad} artık bulunuyor. ${d.desc}`, 'is');
  }
  if (has(w, 'radyo')) for (const id of w.hh.members) w.people[id].rel = clamp(w.people[id].rel + 0.05, -100, 100);
}

/** Devletin gözetim gücü: baskın olasılığı çarpanı */
export function policeFactor(w: World): number {
  let f = 1;
  const y = year(w.m);
  if (y >= 1975 && y < 1983) f *= 1.35;
  if (y >= 1940 && y <= 1946) f *= 1.15; // karaborsaya karşı sıkı denetim
  if (has(w, 'telsiz')) f *= 1.15;
  if (has(w, 'dinleme')) f *= 1.2;
  if (has(w, 'telefon')) f *= 0.8;
  if (w.pol?.seat === 'vekil') f *= 0.5;
  else if (w.pol?.seat === 'belediye') f *= 0.75;
  else if (w.pol?.seat === 'muhtar') f *= 0.9;
  return f;
}

/** Aylık: teknolojilerin getirdiği ek kazanç (dikiş makinesi). */
export function techIncome(w: World, lines: { t: string; v: number }[]) {
  if (has(w, 'dikis')) {
    const n = hhMembers(w).filter((p) => p.sex === 'K' && p.job === 'ev' && !p.away && age(w, p) >= 14 && age(w, p) <= 65).length;
    if (n) {
      const v = Math.round(n * 48 * infl(w.m));
      w.hh.cash += v;
      lines.push({ t: `Dikiş makinesi (${n} kadın dikiyor)`, v });
    }
  }
}
