// Bozbey Ağa'nın sonu: yaşlanır, ölür; oğulları mirası bölüşemez. Konak, topraklar ve borç defteri el değiştirir.
// Köyün en güçlüsü olan aile "yeni ağa" olabilir.
import type { World } from './types';
import { chance, clamp, rint } from './rng';
import { log } from './people';
import { infl, year } from './calendar';
import { pushCard } from './cards';
import { nam } from './assets';

const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR');
const L = (w: World, n: number) => Math.round(n * infl(w.m));
export const agaOlu = (w: World) => !!w.flags.agaOldu;
export const konakBizim = (w: World) => !!w.flags.agaKonak;

export function agaCards(w: World): boolean {
  const y = year(w.m);
  if (!w.flags.agaOldu && y >= 1948 && chance(w, y >= 1958 ? 0.04 : 0.008)) {
    w.flags.agaOldu = w.m;
    w.flags.agaKin = 0;
    pushCard(w, {
      id: 'ag_olum',
      text: `Bozbey Ağa öldü. Kırk yıl köyün toprağına, suyuna, borç defterine hükmeden adam, konağının yüklüğünde tespihi elinde bulundu. Cenazede bütün köy var; oğulları daha mezarlıkta birbirine laf atıyor.`,
      opts: [
        { t: 'Cenazede tabutu omuzla, helallik dile', k: 'omuz' },
        { t: 'Cenazeye git ama geride dur', k: 'git' },
        { t: 'Gitme: o adam bize hayat bırakmadı', k: 'gitme' },
      ],
    });
    return true;
  }
  const o = Number(w.flags.agaOldu || 0);
  if (o && !w.flags.agaMiras && w.m - o >= 4) {
    w.flags.agaMiras = true;
    const kp = L(w, 98000 * 0.55);
    w.flags.konakFiyat = kp;
    pushCard(w, {
      id: 'ag_miras',
      text: `Ağanın oğulları mirası bölüşemedi; mahkemelik oldular. Topraklar parça parça satışa çıkıyor, konağın kapısında "satılık" yazıyor: ${fmt(kp)} lira. Ağanın borç defteri ise en büyük oğlun elinde.`,
      opts: [
        { t: `Konağı satın al (${fmt(kp)} lira)`, k: 'konak' },
        ...(w.hh.debt > 0 ? [{ t: `Borç defterini satın al, borcunu sil (${fmt(Math.round(w.hh.debt * 0.4))} lira)`, k: 'defter' }] : []),
        { t: 'Satılan toprakları kolla', k: 'toprak' },
      ],
    });
    return true;
  }
  // Yeni ağa: ağanın topraklarının yarısı bizdeyse ve nam yüksekse
  if (o && !w.flags.yeniAga && nam(w) >= 80 && w.hh.parcels.length >= 8 && chance(w, 0.05)) {
    w.flags.yeniAga = w.m;
    w.flags.namBonus = Number(w.flags.namBonus || 0) + 8;
    pushCard(w, {
      id: 'ag_yeni',
      text: `Köyün ileri gelenleri misafir odanda toplandı. İmam söze girdi: "Bozbey'den sonra bu köyün bir büyüğü olmadı. Artık kapısına gidilen ev sizin evinizdir." Bundan sonra köyde sana "ağa" diyecekler.`,
      opts: [
        { t: 'Ağalık yapacağım: düğünler, kavgalar, su sırası bana sorulsun', k: 'aga' },
        { t: 'Ağa değil, köyün ağabeyi olalım', k: 'abi' },
      ],
    });
    return true;
  }
  return false;
}

export function resolveAga(w: World, id: string, k: string): boolean {
  if (!id.startsWith('ag_')) return false;
  if (id === 'ag_olum') {
    if (k === 'omuz') {
      w.flags.namBonus = Number(w.flags.namBonus || 0) + 3;
      w.hh.debt = Math.round(w.hh.debt * 0.85);
      log(w, `Ağanın tabutu ${w.surname}ların omzunda kabre gitti. Oğulları bunu unutmayacak; borcun bir kısmı helal edildi.`, 'olay');
    } else if (k === 'gitme') {
      w.flags.namBonus = Number(w.flags.namBonus || 0) - 2;
      log(w, `Cenazeye gidilmedi. Köyde kimi "haklılar" dedi, kimi "ölünün arkasından olmaz".`, 'olay');
    }
    // Ağanın toprakları artık satılabilir
    for (const p of w.plots) if (p.o === 'aga' && chance(w, 0.35)) { p.sale = true; p.ask = 0.9; }
    return true;
  }
  if (id === 'ag_miras') {
    if (k === 'konak') {
      const c = Number(w.flags.konakFiyat || 0);
      if (w.hh.cash < c) {
        log(w, `Konak için kasada para yoktu; başka bir alıcı çıktı.`, 'olay');
        return true;
      }
      w.hh.cash -= c;
      w.flags.agaKonak = true;
      w.hh.house = Math.max(w.hh.house, 3);
      w.hh.rent = 0;
      w.flags.namBonus = Number(w.flags.namBonus || 0) + 6;
      log(w, `Bozbey konağı ${fmt(c)} liraya ${w.surname} ailesine geçti. Gündelikçinin torunları, ağanın sedirinde oturuyor.`, 'tapu');
    } else if (k === 'defter') {
      const c = Math.round(w.hh.debt * 0.4);
      w.hh.cash -= c;
      w.hh.debt = 0;
      log(w, `Ağanın borç defteri ${fmt(c)} liraya alındı ve sobada yakıldı. Ailenin kırk yıllık borcu kül oldu.`, 'para');
    }
    for (const p of w.plots) if (p.o === 'aga' && chance(w, k === 'toprak' ? 0.6 : 0.3)) { p.sale = true; p.ask = clamp(0.75 + rint(w, 0, 20) / 100, 0.75, 0.95); }
    return true;
  }
  if (id === 'ag_yeni') {
    if (k === 'aga') {
      w.flags.agalik = 'aga';
      w.flags.namBonus = Number(w.flags.namBonus || 0) + 4;
    } else {
      w.flags.agalik = 'abi';
      w.heat = clamp(w.heat - 10, 0, 100);
    }
    log(w, k === 'aga' ? `${w.surname} ailesi Karaçam'ın yeni ağası.` : `${w.surname} ailesi köyün büyüğü oldu ama "ağa" demelerine izin vermedi.`, 'miras');
    return true;
  }
  return true;
}

/** Aylık: ağalık yapan aile köyden pay alır (düğün, su, kavga hakemliği) */
export function agaIncome(w: World): number {
  if (w.flags.agalik !== 'aga') return 0;
  return Math.round(260 * infl(w.m));
}
