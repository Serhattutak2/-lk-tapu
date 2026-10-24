// Sürgün ve Konsey. Korku saygıyı çok aşarsa köy meclisi seni sürmeye kalkar; güçlendiğinde sen de
// rakibi sürersin. En tepede büyük ailelerin gizli masası Konsey: ya aralarına girersin ya hepsiyle savaşırsın.
import type { World } from './types';
import { chance, clamp, pick, rint } from './rng';
import { log } from './people';
import { infl, year } from './calendar';
import { pushCard } from './cards';
import { nam } from './assets';
import { korku, saygi, addSaygi, kademeNo } from './guc';

const L = (w: World, n: number) => Math.round(n * infl(w.m));
const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR');

export const surgunde = (w: World) => !!w.flags.surgun;

// ---------- Köyden sürgün ----------
export function surgunCards(w: World): boolean {
  if (surgunde(w) || w.city.moved || w.flags.agalik === 'aga') return false;
  const d = korku(w) - saygi(w);
  // Uyarı
  if (d > 40 && korku(w) > 45 && !w.flags.surgunUyari && chance(w, 0.06)) {
    w.flags.surgunUyari = w.m;
    pushCard(w, {
      id: 'it_uyari',
      text: `Köyün ileri gelenleri misafir odanda toplandı; yüzleri asık. İmam söze girdi: "Seni seviyorduk, şimdi senden korkuyoruz. Köy senin baskından bunaldı. Ya yolunu değiştirirsin, ya bu köy ikimize dar gelir."`,
      opts: [
        { t: 'Özür dile, hayır işleriyle gönül al', k: 'gonul' },
        { t: `Herkese ziyafet, borçluların borcunu sil (${fmt(L(w, 8000))} lira)`, k: 'ziyafet' },
        { t: '"Bu köyün sahibi benim" de, korkutma', k: 'korkut' },
      ],
    });
    return true;
  }
  // Oylama
  if (d > 45 && korku(w) > 55 && Number(w.flags.surgunUyari || 0) < w.m - 12 && chance(w, 0.05)) {
    pushCard(w, {
      id: 'it_oylama',
      text: `Köy meclisi gizlice toplanıp oyladı: "${w.surname} ailesi köyü terk etsin." Muhtar kararı eline tutuşturdu. Adamların kapıda, köylüler meydanda; bir kıvılcım yeter.`,
      opts: [
        ...(w.gang >= 4 ? [{ t: 'Adamlarınla meydanı bas, kararı yırt (büyük risk)', k: 'bas' }] : []),
        { t: `Meclise büyük bir bedel öde, kararı geri aldır (${fmt(L(w, 30000))} lira)`, k: 'ode' },
        { t: 'Onurunla çık: ailenle kasabaya göç et', k: 'cik' },
      ],
    });
    return true;
  }
  return false;
}

// ---------- Rakibi sürme ----------
export function surgunEt(w: World): { ok: boolean; msg: string } {
  const r = w.rival;
  if (r.gone) return { ok: false, msg: 'Köyde süreceğin bir rakip aile yok.' };
  if (nam(w) < 60 && saygi(w) < 50) return { ok: false, msg: 'Köyü peşinden sürükleyecek kadar güçlü değilsin daha.' };
  const c = L(w, 12000);
  if (w.hh.cash < c) return { ok: false, msg: `Köyü arkana almak için ${fmt(c - w.hh.cash)} lira eksik.` };
  w.hh.cash -= c;
  const p = clamp(0.35 + nam(w) / 200 + saygi(w) / 200 - r.men * 0.02, 0.2, 0.9);
  if (chance(w, p)) {
    r.men = 0;
    w.flags.baskiPuan = Number(w.flags.baskiPuan || 0) + 10;
    log(w, `Köyü arkana aldın; meclis ${r.name} ailesine "çekip gidin" dedi. Bir gece arabalara yüklenip köyü terk ettiler.`, 'olay');
    return { ok: true, msg: `${r.name} ailesi köyden sürüldü.` };
  }
  r.feud = clamp(r.feud + 20, 0, 100);
  return { ok: false, msg: `${r.name} ailesi direndi; köyü ikna edemedin, husumet büyüdü.` };
}

// ---------- Konsey ----------
const AILELER = ['Karayel', 'Demirhan', 'Tozkoparan', 'Şahinoğlu', 'Akbaba'];

export function konseyCards(w: World): boolean {
  if (w.flags.konsey || kademeNo(w) < 9) return false;
  if (!w.flags.konseyDavet && chance(w, 0.03)) {
    w.flags.konseyDavet = w.m;
    pushCard(w, {
      id: 'it_konsey',
      text: `Siyah camlı arabalar şehrin dışındaki bir çiftlik evinin önünde durdu. İçeride uzun bir masa, beş aile: ${AILELER.join(', ')}. En yaşlıları konuştu: "Şehri biz paylaşırız, kavga etmeden. Masada bir sandalye boş. Ya oturursun, ya karşımızda olursun."`,
      opts: [
        { t: 'Masaya otur: Konsey\'in bir üyesi ol', k: 'otur' },
        { t: `Saygı göster ama bağımsız kal (${fmt(L(w, 200000))} lira "aidat")`, k: 'bagimsiz' },
        { t: 'Masayı devir: "Bu şehir tek babaya yeter"', k: 'devir' },
      ],
    });
    return true;
  }
  return false;
}

export function resolveKonsey(w: World, id: string, k: string): boolean {
  if (id === 'it_uyari') {
    if (k === 'gonul') {
      w.flags.hayirPuan = Number(w.flags.hayirPuan || 0) + 8;
      addSaygi(w, 15);
      log(w, `Köye su, okul, cami yardımı yapıldı; "demek ki kalbi varmış" dediler.`, 'olay');
    } else if (k === 'ziyafet') {
      w.hh.cash -= L(w, 8000);
      w.flags.hayirPuan = Number(w.flags.hayirPuan || 0) + 12;
      addSaygi(w, 22);
      log(w, `Üç gün köye ziyafet verildi, borç defterleri yakıldı. Meydanda adın alkışlandı.`, 'olay');
    } else {
      w.flags.baskiPuan = Number(w.flags.baskiPuan || 0) + 12;
      log(w, `Meclise kafa tutuldu. Korkudan sustular ama defteri kapatmadılar.`, 'olay');
    }
    return true;
  }
  if (id === 'it_oylama') {
    if (k === 'bas') {
      w.heat = clamp(w.heat + 30, 0, 100);
      if (chance(w, clamp(0.3 + w.gang * 0.04, 0.3, 0.8))) {
        w.flags.baskiPuan = Number(w.flags.baskiPuan || 0) + 20;
        w.flags.surgunUyari = w.m;
        log(w, `Meydan basıldı, karar yırtıldı. Köy sindi; artık kimse "sürgün" kelimesini ağzına almıyor. Ama bu korku sonsuza kadar sürmez.`, 'olay');
      } else {
        startSurgun(w);
        log(w, `Baskın geri tepti; jandarma geldi, köy ayağa kalktı. ${w.surname} ailesi zorla köyden çıkarıldı.`, 'olay');
      }
    } else if (k === 'ode') {
      w.hh.cash -= L(w, 30000);
      addSaygi(w, 10);
      w.flags.surgunUyari = w.m;
      log(w, `Meclise ağır bir bedel ödendi; karar şimdilik rafa kalktı.`, 'olay');
    } else {
      startSurgun(w);
      log(w, `${w.surname} ailesi onuruyla köyü terk etti; kağnıya yüklenen eşyaların ardından kadınlar ağıt yaktı.`, 'olay');
    }
    return true;
  }
  if (id === 'it_konsey') {
    if (k === 'otur') {
      w.flags.konsey = 'uye';
      addSaygi(w, 10);
      log(w, `${w.surname} ailesi Konsey'in masasında bir sandalye sahibi oldu. Şehrin kaderi artık o masada çiziliyor.`, 'miras');
    } else if (k === 'bagimsiz') {
      w.hh.cash -= L(w, 200000);
      w.flags.konsey = 'bagimsiz';
      log(w, `Konsey'e saygı gösterildi ama bağımsız kalındı. Aidat ödendikçe rahat bırakırlar.`, 'olay');
    } else {
      w.flags.konsey = 'dusman';
      w.flags.konseyFeud = 30;
      w.heat = clamp(w.heat + 20, 0, 100);
      log(w, `Konsey'e savaş açıldı. Beş aile artık tek düşmanda birleşti: sen. Bundan sonra kolay uyumayacaksın.`, 'olay');
    }
    return true;
  }
  return false;
}

function startSurgun(w: World) {
  w.flags.surgun = w.m;
  w.city.open = true;
  w.flags.korku = 0;
  w.flags.baskiPuan = 0;
  // Köydeki itibar sıfırlanır; şehirde yeniden kurulacak
}

/** Konsey düşmansa aylık baskı: fabrika, mahalle, aile hedefte. */
export function monthlyKonsey(w: World) {
  if (w.flags.konsey !== 'dusman') return;
  w.flags.konseyFeud = clamp(Number(w.flags.konseyFeud || 30) + 0.5, 0, 100);
  if (chance(w, 0.015)) {
    const f = Number(w.flags.konseyFeud || 30);
    if (w.gang >= 6 && chance(w, clamp(w.gang / 20, 0.2, 0.7))) {
      w.flags.konseyFeud = clamp(f - 15, 0, 100);
      log(w, `Konsey'in ailelerinden biri üstüne geldi ama adamların püskürttü. Masada bir sandalye daha boşaldı.`, 'olay');
    } else {
      w.heat = clamp(w.heat + 10, 0, 100);
      const loss = Math.round(w.hh.cash * 0.1);
      w.hh.cash -= loss;
      log(w, `Konsey bir hamle yaptı: ${fmt(loss)} liralık malına çökküler, bir işin sekteye uğradı.`, 'olay');
    }
  }
  // Konsey'i tek tek kırıp dağıtmak: yüksek güçle
  if (Number(w.flags.konseyFeud || 0) <= 0 && !w.flags.konseyYenildi) {
    w.flags.konseyYenildi = true;
    w.flags.konsey = 'baba';
    log(w, `Konsey'in beş ailesi birer birer çekildi. Masanın başında artık tek bir isim var. Büyük Baba sensin.`, 'miras');
  }
}

export const konseyLabel = (w: World) =>
  w.flags.konsey === 'baba' ? 'Büyük Baba' : w.flags.konsey === 'uye' ? 'Konsey üyesi' : w.flags.konsey === 'bagimsiz' ? 'Konsey\'den bağımsız' : w.flags.konsey === 'dusman' ? 'Konsey\'in düşmanı' : '';
