// Gücün merdiveni: oyuncunun o anki kademesi, bir sonraki kademe ve oraya ne kadar kaldığı.
// Ayrıca korku/saygı dengesi. Her şey mevcut dünya durumundan okunur; yeni veri tutmaz.
import type { World } from './types';
import { clamp } from './rng';
import { nam } from './assets';
import { hhHasJob } from './people';

export interface Kademe { no: number; ad: string; desc: string; }
const LADDER: Kademe[] = [
  { no: 0, ad: 'Gündelikçi', desc: 'Başkasının tarlasında el emeği. Kendine ait bir karış toprağın yok.' },
  { no: 1, ad: 'Toprak sahibi', desc: 'İlk tapu cebinde. Artık köyde adın geçiyor.' },
  { no: 2, ad: 'Köyün ileri geleni', desc: 'Tarlan, evin, sözün var. Kahvede baş köşe senin.' },
  { no: 3, ad: 'Kabadayı', desc: 'Yanında adamların var. Köyde hesabı sen soruyorsun.' },
  { no: 4, ad: 'Rıza\'nın adamı', desc: 'Kara Rıza\'nın yanındasın; ayak işlerinden yukarı tırmanıyorsun.' },
  { no: 5, ad: 'İmalatçı', desc: 'Kendi atölyen var. Artık kayıt dışı para senin elinde dönüyor.' },
  { no: 6, ad: 'Şebeke sahibi', desc: 'Rıza\'yı devirdin; yollar, alıcılar, adamlar senin.' },
  { no: 7, ad: 'Kasabanın reisi', desc: 'Pazar, nakliye, karakol; kasabada söz sahibisin.' },
  { no: 8, ad: 'Şehrin ağası', desc: 'Mahalleler ve fabrikalar elinde. Şehir seni tanıyor.' },
  { no: 9, ad: 'Şehrin Babası', desc: 'Yeraltında tek isim sensin. Çeteler kapına geliyor.' },
  { no: 10, ad: 'Konsey üyesi', desc: 'Büyük ailelerin masasında bir sandalye senin.' },
  { no: 11, ad: 'Büyük Baba', desc: 'En tepe. Ama tahtı isteyen hep birileri var.' },
];

export function kademeNo(w: World): number {
  const lab = w.lab?.lvl || 0;
  if (w.flags.konsey === 'baba') return 11;
  if (w.flags.konsey === 'uye') return 10;
  if (Number(w.flags.ceteYok || 0) >= 1 && w.city.turf >= 3 && w.city.net) return 9;
  if (w.city.moved && Object.keys(w.city.facs).length >= 2) return 8;
  if (w.city.open && (w.pol.seat === 'belediye' || w.city.turf >= 1 || Object.keys(w.city.facs).length >= 1)) return 7;
  if (w.city.net) return 6;
  if (lab >= 1) return 5;
  if (w.flags.rizaFedai) return 4;
  if (w.gang >= 2 || w.flags.kacakci) return 3;
  if (nam(w) >= 35 && w.hh.parcels.length >= 2) return 2;
  if (w.hh.parcels.length >= 1) return 1;
  return 0;
}

export const kademe = (w: World): Kademe => LADDER[kademeNo(w)];
export const nextKademe = (w: World): Kademe | null => LADDER[kademeNo(w) + 1] ?? null;

/** Bir sonraki kademeye ilerleme yüzdesi (kaba bir tahmin). */
export function kademeProgress(w: World): number {
  const k = kademeNo(w);
  const g = (() => {
    switch (k) {
      case 0: return w.hh.cash / 12000;
      case 1: return (nam(w) / 35 + w.hh.parcels.length / 2) / 2;
      case 2: return (w.gang + (w.flags.kacakci ? 1 : 0)) / 2;
      case 3: return w.flags.rizaFedai ? 1 : (w.flags.kacakci ? 0.6 : 0.2) + w.gang / 10;
      case 4: return (w.lab?.lvl || 0) >= 1 ? 1 : (w.hh.agil ? 0.6 : 0.2);
      case 5: return w.city.net ? 1 : w.gang / 6;
      case 6: return w.city.open ? 1 : (w.hh.cash + w.dirty) / (90000 * Math.pow(1.045, 30));
      case 7: return (Object.keys(w.city.facs).length / 2 + (w.city.moved ? 1 : 0)) / 2;
      case 8: return (w.city.turf / 3 + (w.city.net ? 1 : 0)) / 2;
      case 9: return (Number(w.flags.ceteYok || 0) >= 1 ? 0.5 : 0) + w.city.turf / 8;
      case 10: return w.flags.konsey ? 1 : 0.3;
      default: return 1;
    }
  })();
  return clamp(Math.round(g * 100), 0, 100);
}

// ---------- Korku ve saygı ----------
export const korku = (w: World): number => clamp(Number(w.flags.korku || 0), 0, 100);
export const saygi = (w: World): number => clamp(Number(w.flags.saygi || 0), 0, 100);
export const addKorku = (w: World, d: number) => (w.flags.korku = clamp(korku(w) + d, 0, 100));
export const addSaygi = (w: World, d: number) => (w.flags.saygi = clamp(saygi(w) + d, 0, 100));

/** Aylık: korku ve saygı duruma göre bir hedefe doğru kayar. */
export function monthlyGuc(w: World) {
  const kills = w.flags.yokEdilen ? String(w.flags.yokEdilen).split(',').length : 0;
  const hatirlar = Object.keys(w.flags).filter((k) => k.startsWith('kom_')).map((k) => Number(w.flags[k] || 0));
  const hatirOrt = hatirlar.length ? hatirlar.reduce((a, b) => a + b, 0) / hatirlar.length : 10;
  // Korku: adamlar, dikkat, kan davası, silinen aileler, baskı hamleleri
  const korkuHedef = clamp(w.gang * 3 + w.heat * 0.4 + kills * 8 + (!w.rival.gone && w.rival.feud > 50 ? 15 : 0) + Number(w.flags.baskiPuan || 0), 0, 100);
  // Saygı: nam, komşu hatırı, hayır işleri, siyasi makam
  const saygiHedef = clamp(nam(w) * 0.5 + hatirOrt * 0.8 + Number(w.flags.hayirPuan || 0) + (w.pol.seat ? 12 : 0) + (hhHasJob(w, 'imam') ? 8 : 0), 0, 100);
  w.flags.korku = clamp(korku(w) + (korkuHedef - korku(w)) * 0.12, 0, 100);
  w.flags.saygi = clamp(saygi(w) + (saygiHedef - saygi(w)) * 0.12, 0, 100);
}

export const korkuLabel = (w: World) => {
  const d = korku(w) - saygi(w);
  if (d > 35) return 'Korkuyla hükmediyorsun';
  if (d > 12) return 'Senden çekiniyorlar';
  if (d < -35) return 'Seviliyorsun';
  if (d < -12) return 'Sayılıyorsun';
  return 'Korku ile saygı dengede';
};

export const KADEME_SAYISI = LADDER.length;

/** Oyuncuya yol gösteren, o anki duruma göre tek cümlelik hedef. */
export function nextObjective(w: World): string {
  if (w.over) return '';
  if (w.hh.debt > 0 && w.hh.parcels.length === 0) return 'Ağaya olan borcunu kapat; borçluyken kimse sana toprak satmaz.';
  if (w.hh.parcels.length === 0) return 'İlk tapunu al: Tarla sekmesinden ya da haritadan bir tarla satın al.';
  if (w.hh.house === 0) return 'Kendi evini al, ağaya kira ödemekten kurtul (Mülk sekmesi).';
  if (!w.flags.kacakci && w.hh.parcels.length >= 1) return 'Kahvede Kara Rıza ile tanış; kayıt dışı işin kapısı oradan açılır.';
  if (w.flags.kacakci && !w.flags.rizaFedai) return 'Rıza\'ya mal taşı, güvenini kazan; adamı ol.';
  if (w.flags.rizaFedai && !w.lab && !w.hh.agil) return 'Dağdaki ağılı al; ilk atölyeni kurabileceğin yer orası (Yeraltı).';
  if (w.hh.agil && (w.lab?.lvl || 0) < 1) return 'Gizli atölyeni kur ve ilk malını çıkar (Yeraltı).';
  if ((w.lab?.lvl || 0) >= 1 && !w.city.net) return 'Adam topla, Kara Rıza\'yı devir; şebeke senin olsun.';
  if (w.city.net && !w.city.open) return 'Servetini büyüt; şehir kapıları adın duyulunca açılır.';
  if (w.city.open && !w.city.moved) return 'Şehirde ev al ve aileyi taşı; fabrika ve mahalle işleri orada döner.';
  if (w.city.moved && Object.keys(w.city.facs).length < 2) return 'Şehirde fabrika kur; kara paranı aklayacak temiz bir vitrin lazım.';
  if (w.city.turf < 3) return 'Mahalleleri ele geçir; şehrin yeraltında tek isim ol.';
  if (!w.flags.konsey) return 'Büyük ailelerin masası Konsey seni bekliyor; ya katıl ya karşılarına geç.';
  if (w.flags.konsey === 'dusman') return 'Konsey\'in beş ailesini tek tek dağıt; güçlü bir adam kadrosu tut.';
  if (w.flags.konsey !== 'baba') return 'Tahtı al: Büyük Baba olmanın yolu Konsey\'i dağıtmaktan geçer.';
  return 'En tepedesin. Şimdi orada kalmak için kan davalarını, ihanetleri ve yeni nesil düşmanları yönet.';
}
