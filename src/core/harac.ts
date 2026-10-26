// Köyün haracı: Kara Rıza'yı devirip köyde sözün geçmeye başlayınca, köylüden ve esnaftan düzenli pay almaya başlarsın.
// Bu, "köyün sahibi" olmanın elle tutulur geliridir; korku arttıkça artar ama saygıyı yer ve dikkat çeker.
import type { LedgerLine, World } from './types';
import { chance, clamp, rint } from './rng';
import { log, P, alive } from './people';
import { infl } from './calendar';
import { pushCard } from './cards';
import { nam } from './assets';
import { korku } from './guc';

/** Köyde haraç toplayabilecek güce ulaştın mı? */
export function canTribute(w: World): boolean {
  if (w.city.moved) return false; // köyü bırakıp şehre taşınınca köy haracı anlamsız
  return w.city.net || (!!w.flags.kacakci && w.gang >= 2 && korku(w) >= 35 && nam(w) >= 30);
}

/** Köydeki "haraca bağlanabilir" kapı sayısı: senin olmayan tarlalar + esnaf. */
function kapi(w: World): number {
  const koylu = w.plots.filter((p) => p.o !== 'biz').length;
  return clamp(koylu + 3, 4, 28);
}

/** Bir defa: köyün sahibi olunca haraç toplamaya başlama kartı. */
export function haracCard(w: World): boolean {
  if (w.flags.koyHarac !== undefined) return false;
  if (!canTribute(w)) return false;
  if (!alive(P(w, w.playerId))) return false;
  w.flags.koyHarac = 0; // karar verilene kadar 0; seçimle 1/2 olur
  pushCard(w, {
    id: 'harac_basla',
    text: `Kara Rıza gideli köyün yeraltında tek söz senin. Kahveci, değirmenci, celep, hatta ırgat başı... hepsi kapına bakıyor. Adamların "artık köy bize pay versin ağabey" diyor. Köyden düzenli haraç toplamaya başlar mısın?`,
    opts: [
      { t: 'Topla ama ölçülü ol; köylü küsmesin', k: 'olculu' },
      { t: 'Hepsinden al, kim karşı gelirse görsün', k: 'sert' },
      { t: 'Hayır, köylüden haraç almam', k: 'yok' },
    ],
  });
  return true;
}

export function resolveHarac(w: World, id: string, k: string): boolean {
  if (id !== 'harac_basla') return false;
  if (k === 'yok') {
    w.flags.koyHarac = -1;
    w.flags.hayirPuan = Number(w.flags.hayirPuan || 0) + 3;
    log(w, `Köylüden haraç almayı reddettin. Köyde "insaflı adam" dediler; saygın arttı.`, 'olay');
  } else if (k === 'sert') {
    w.flags.koyHarac = 2;
    w.flags.korku = clamp(korku(w) + 12, 0, 100);
    log(w, `Köyün haracını sert topladın. Herkes kapına pay getiriyor; kimse sesini çıkaramıyor ama arkandan da sevmiyorlar.`, 'olay');
  } else {
    w.flags.koyHarac = 1;
    log(w, `Köyden ölçülü bir haraç almaya başladın. Esnaf homurdandı ama ödedi.`, 'olay');
  }
  return true;
}

/** Aylık köy haracı geliri (kara kasaya). */
export function monthlyHarac(w: World, lines: LedgerLine[]) {
  const mode = Number(w.flags.koyHarac || 0);
  if (mode <= 0) return;
  if (!canTribute(w)) return;
  const sert = mode === 2;
  const base = 70 * infl(w.m) * kapi(w) * (sert ? 1.8 : 1) * (0.6 + korku(w) / 100);
  const gelir = Math.round(base);
  w.dirty += gelir;
  w.heat = clamp(w.heat + (sert ? 1.4 : 0.6), 0, 100);
  // Korku yüksek tutar, saygıyı yavaşça yer
  w.flags.korku = clamp(korku(w) + (sert ? 0.5 : 0.2), 0, 100);
  if (w.flags.saygi !== undefined) w.flags.saygi = clamp(Number(w.flags.saygi) - (sert ? 0.5 : 0.15), 0, 100);
  lines.push({ t: `Köy haracı (${sert ? 'sert' : 'ölçülü'})`, v: 0 });
  void gelir;
  // Ara ara direnç: sert toplarsan biri karşı gelir ya da ihbar eder
  if (sert && chance(w, 0.02)) {
    w.heat = clamp(w.heat + 10, 0, 100);
    log(w, `Köyden biri haracı ödemeyip jandarmaya gitti. "Bu köyde bir ağa türedi" diye şikâyet etmiş; dikkat arttı.`, 'olay');
  }
}

export const haracLabel = (w: World) => {
  const m = Number(w.flags.koyHarac || 0);
  return m === 2 ? 'Köyün haracını sert topluyorsun' : m === 1 ? 'Köyden ölçülü haraç alıyorsun' : m === -1 ? 'Köyden haraç almıyorsun' : '';
};
