// Komşular: köyün adı bilinen aileleri. Her biriyle ayrı bir hatır var. Hatırı yüksek komşu tarlasını önce sana satar,
// başı sıkışınca kapına gelir, karşılığında iyiliği unutmaz. Kırk yıl sonra yerlerini çocukları alır, hatır aileye geçer.
import type { World } from './types';
import { chance, clamp, pick } from './rng';
import { log } from './people';
import { infl, monthOf, year } from './calendar';
import { pushCard } from './cards';
import { PLOTS } from './plots';

export interface Komsu { id: string; ad: string; kim: string; }
export const KOMSULAR: Komsu[] = [
  { id: 'hamza', ad: 'Deli Hamza', kim: 'Kimsesi yok, dili sivri, kalbi yumuşak. Köy kenarındaki tarlası tek varlığı.' },
  { id: 'osman', ad: 'Topal Osman', kim: 'Kurtuluş Savaşı gazisi. Bacağını cephede bıraktı; gururundan yardım istemez.' },
  { id: 'hatice', ad: 'Dul Hatice', kim: 'Kocası gençken öldü, dört çocuğu tek başına büyütüyor.' },
  { id: 'sami', ad: 'Berber Sami', kim: 'Köyün haber merkezi. Dükkânında söylenen akşam bütün köyde duyulur.' },
  { id: 'omer', ad: 'Hacı Ömer', kim: 'Dindar ve varlıklı. Sözüne güvenilir, borç verir ama faiz almaz.' },
  { id: 'veli', ad: 'Kör Veli', kim: 'Gözleri görmez ama köyün bütün eski hikâyelerini bilir.' },
  { id: 'nuri', ad: 'Bekçi Nuri', kim: 'Gece köyü dolaşır, kimin kapısına kimin geldiğini bilir. Jandarmayla da arası iyidir.' },
  { id: 'rifat', ad: 'Muhtar Rıfat', kim: 'Köyün mührü onda. Seçim, tapu, şikâyet; her işin başı ondan geçer.' },
];
export const KMAP = Object.fromEntries(KOMSULAR.map((k) => [k.id, k]));

const L = (w: World, n: number) => Math.round(n * infl(w.m));
const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR');

export const hatir = (w: World, id: string) => Number(w.flags['kom_' + id] ?? 10);
export const addHatir = (w: World, id: string, d: number) => (w.flags['kom_' + id] = clamp(hatir(w, id) + d, -60, 100));
/** Kırk yıl sonra komşunun yerini ailesi alır */
export const komsuAd = (w: World, k: Komsu) => (year(w.m) - (w.y0 || 1925) >= 38 ? `${k.ad} ailesi` : k.ad);
export const hatirLabel = (h: number) => (h < -20 ? 'Küs' : h < 10 ? 'Mesafeli' : h < 35 ? 'Selamlaşıyorsunuz' : h < 60 ? 'Dost' : 'Can ciğer');

/** Tarla sahibinin komşu kimliği */
export function komsuOfPlot(i: number): string | null {
  const o = PLOTS[i]?.owner;
  const k = KOMSULAR.find((x) => x.ad === o);
  return k ? k.id : null;
}

/** Teklif kabul ihtimaline hatır etkisi */
export function hatirBonus(w: World, i: number): number {
  const k = komsuOfPlot(i);
  if (!k) return 0;
  return clamp(hatir(w, k) / 250, -0.2, 0.35);
}

/** Bu ay ziyaret yapıldı mı? Ayda bir ziyaret. */
export const visitedThisMonth = (w: World) => Number(w.flags.komZiyaret ?? -1) === w.m;

export function visit(w: World, id: string, how: 'hediye' | 'yardim'): { ok: boolean; msg: string } {
  const k = KMAP[id];
  if (!k) return { ok: false, msg: 'Böyle bir komşu yok.' };
  if (visitedThisMonth(w)) return { ok: false, msg: 'Bu ay zaten bir komşuya gittin.' };
  if (how === 'hediye') {
    const c = L(w, 90);
    if (w.hh.cash < c) return { ok: false, msg: 'Elin boş gidilmez; hediye parası yok.' };
    w.hh.cash -= c;
    addHatir(w, id, 9);
  } else {
    const mo = monthOf(w.m);
    if (mo < 3 || mo > 9) return { ok: false, msg: 'Kışın tarlada yardım edilecek iş yok.' };
    addHatir(w, id, 6);
  }
  w.flags.komZiyaret = w.m;
  return { ok: true, msg: `${komsuAd(w, k)} memnun kaldı. Aranız: ${hatirLabel(hatir(w, id))}.` };
}

/** Komşuların kendi dertleri: kapına gelirler */
export function komsuCards(w: World): boolean {
  if (!chance(w, 0.03)) return false;
  const k = pick(w, KOMSULAR);
  const ad = komsuAd(w, k);
  const h = hatir(w, k.id);
  const cards: Record<string, () => { text: string; opts: { t: string; k: string }[] } | null> = {
    hamza: () => ({ text: `${ad} kahvede herkesin önünde sana laf attı: "Bunların parası nereden geliyor, Allah bilir!" Herkes sana bakıyor.`, opts: [{ t: 'Gülüp geç: "Deli\'nin sözü"', k: 'gec' }, { t: 'Karşılık ver', k: 'kavga' }, { t: 'Akşam bir tabak yemekle kapısına git', k: 'gonul' }] }),
    osman: () => ({ text: `${ad}'ın gazi maaşı evrakı ilçede takıldı; aylardır para alamıyor. Okuma yazması kıt, kimseye de diyemiyor.`, opts: [{ t: `İlçeye götür, işini hallet (${fmt(L(w, 120))} lira yol)`, k: 'yardim' }, { t: 'Bizim işimiz değil', k: 'yok' }] }),
    hatice: () => ({ text: `${ad}'nin evinin damı kar altında çöktü. Çocuklar komşuda yatıyor.`, opts: [{ t: `Damını biz aktaralım (${fmt(L(w, 400))} lira)`, k: 'yardim' }, { t: 'Erkekleri imeceye gönder', k: 'imece' }, { t: 'Elimizden gelen yok', k: 'yok' }] }),
    sami: () => ({ text: `${ad} tıraş ederken fısıldadı: "Köyde senin hakkında ne konuşulduğunu bilmek ister misin? Bir kahve parası..."`, opts: [{ t: `Dinle (${fmt(L(w, 60))} lira)`, k: 'dinle' }, { t: 'Dedikoduya kulak vermem', k: 'yok' }] }),
    omer: () => ({ text: `${ad} camiden çıkarken yanına geldi: "Evladım, hasat zor geçti biliyorum. Faizsiz borç lazımsa çekinme."`, opts: [{ t: `Al: ${fmt(L(w, 1500))} lira, hasatta öde`, k: 'borc' }, { t: 'Allah razı olsun, ihtiyacım yok', k: 'yok' }] }),
    veli: () => ({ text: `${ad} kapının önünde seni bekliyordu: "Oğlum, gurbetteki oğlumdan mektup geldi; kimse okumuyor bana."`, opts: [{ t: 'Otur, oku', k: 'oku' }, { t: 'Çocuklardan biri okusun', k: 'cocuk' }, { t: 'Şimdi vaktim yok', k: 'yok' }] }),
    nuri: () => (h >= 30 ? { text: `${ad} gece kapını çaldı: "Komutan yarın sabah buraları arayacakmış. Benden duymadın."`, opts: [{ t: 'Sağ ol Nuri, unutmam', k: 'uyari' }] } : { text: `${ad}'nin oğlu kasabada kavgaya karışmış, karakolda. Babası sana bakıyor.`, opts: [{ t: `Kefil ol, çıkar (${fmt(L(w, 300))} lira)`, k: 'kefil' }, { t: 'Karışmam', k: 'yok' }] }),
    rifat: () => ({ text: `${ad} köy odasına bir soba lazım dedi; bütün köy birer kuruş verecek. Senden de ${fmt(L(w, 250))} lira bekliyor.`, opts: [{ t: 'Ver, hatta fazlasını ver', k: 'ver' }, { t: 'Payımız kadar', k: 'az' }, { t: 'Vermeyiz', k: 'yok' }] }),
  };
  const b = cards[k.id]();
  if (!b) return false;
  pushCard(w, { id: 'km_' + k.id, text: b.text, opts: b.opts });
  return true;
}

export function resolveKomsu(w: World, id: string, k: string): boolean {
  if (!id.startsWith('km_')) return false;
  const kid = id.slice(3);
  const ad = KMAP[kid] ? komsuAd(w, KMAP[kid]) : 'Komşu';
  const nb = (n: number) => (w.flags.namBonus = Number(w.flags.namBonus || 0) + n);
  if (kid === 'hamza') {
    if (k === 'gec') nb(1);
    else if (k === 'kavga') { addHatir(w, kid, -15); nb(-1); }
    else { addHatir(w, kid, 15); log(w, `${ad} yemeği yedi, utandı; ertesi gün selam verdi.`, 'olay'); }
  } else if (kid === 'osman') {
    if (k === 'yardim') { w.hh.cash -= L(w, 120); addHatir(w, kid, 25); nb(1); log(w, `${ad}'ın maaşı bağlandı. Gazi, köyde "o aile insandır" diyor.`, 'olay'); }
    else addHatir(w, kid, -5);
  } else if (kid === 'hatice') {
    if (k === 'yardim') { w.hh.cash -= L(w, 400); addHatir(w, kid, 30); nb(2); }
    else if (k === 'imece') { addHatir(w, kid, 18); nb(1); }
    else addHatir(w, kid, -8);
  } else if (kid === 'sami') {
    if (k === 'dinle') {
      w.hh.cash -= L(w, 60);
      addHatir(w, kid, 5);
      const r = w.rival.gone ? 'köyde sana kafa tutan kalmadı' : `${w.rival.name}lar arkandan iş çeviriyor, husumet ${w.rival.feud > 60 ? 'çok yüksek' : w.rival.feud > 30 ? 'büyüyor' : 'henüz küçük'}`;
      log(w, `Berberde duyulanlar: ${r}; jandarmanın dikkati ${w.heat > 45 ? 'üstünde' : w.heat > 15 ? 'arada bir sana dönüyor' : 'sende değil'}.`, 'olay');
    } else addHatir(w, kid, -3);
  } else if (kid === 'omer') {
    if (k === 'borc') { w.hh.cash += L(w, 1500); w.flags.omerBorc = Number(w.flags.omerBorc || 0) + L(w, 1500); addHatir(w, kid, 3); }
  } else if (kid === 'veli') {
    if (k === 'oku') { addHatir(w, kid, 15); if (chance(w, 0.4)) startQuestFlag(w, 'kup'); }
    else if (k === 'cocuk') addHatir(w, kid, 8);
    else addHatir(w, kid, -6);
  } else if (kid === 'nuri') {
    if (k === 'uyari') { w.heat = clamp(w.heat - 12, 0, 100); if (w.hh.stash) log(w, `Gece zula dere yatağına taşındı; sabahki arama boşa çıktı.`, 'olay'); }
    else if (k === 'kefil') { w.hh.cash -= L(w, 300); addHatir(w, kid, 25); }
    else addHatir(w, kid, -8);
  } else if (kid === 'rifat') {
    if (k === 'ver') { w.hh.cash -= L(w, 500); addHatir(w, kid, 15); nb(2); }
    else if (k === 'az') { w.hh.cash -= L(w, 250); addHatir(w, kid, 4); }
    else { addHatir(w, kid, -12); nb(-1); }
  }
  return true;
}

/** Aylık: Hacı Ömer'in faizsiz borcu hasatta geri ödenir */
export function monthlyKomsu(w: World, lines: { t: string; v: number }[]) {
  const b = Number(w.flags.omerBorc || 0);
  if (b > 0 && monthOf(w.m) === 7) {
    const p = Math.min(b, Math.max(0, w.hh.cash));
    w.hh.cash -= p;
    w.flags.omerBorc = b - p;
    lines.push({ t: 'Hacı Ömer\'e faizsiz borç ödemesi', v: -p });
    addHatir(w, 'omer', p >= b ? 6 : -4);
  }
  // Muhtarla hatır seçimleri, bekçiyle hatır baskınları etkiler (diğer dosyalarda okunur)
}

/** Hikâye zinciri başlatma bayrağı (quests.ts okur) */
export function startQuestFlag(w: World, q: string) {
  if (!w.flags['q_' + q]) w.flags['q_' + q + '_ok'] = true;
}
