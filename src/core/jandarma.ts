// Karakol komutanı: her birkaç yılda bir tayin gelir. Huyu (rüşvetçi, dürüst, hırslı) baskın ihtimalini ve
// zarfın işe yarayıp yaramayacağını belirler. Nüfuzlu aile tanıdıklarını, parası olan
// avukatını devreye sokar.
import type { World } from './types';
import { chance, clamp, pick, rint } from './rng';
import { log } from './people';
import { infl } from './calendar';
import { pushCard } from './cards';
import { payDirtyFirst } from './baron';
import { nam } from './assets';
import { hhMembers } from './people';

const nufuz = (w: World) => nam(w);
const hasLawyer = (w: World) => hhMembers(w).some((p) => p.job === 'avukat' && !p.away);

export type Huy = 'rusvetci' | 'durust' | 'hirsli';
export const HUY_AD: Record<Huy, string> = { rusvetci: 'zarf seven biri', durust: 'kitabına uygun, dürüst biri', hirsli: 'terfi peşinde, hırslı biri' };
const ADLAR = ['Yüzbaşı Kemal', 'Üsteğmen Nail', 'Yüzbaşı Ferit', 'Binbaşı Sedat', 'Yüzbaşı Orhan', 'Üsteğmen Cahit', 'Yüzbaşı Halis', 'Üsteğmen Necdet', 'Yüzbaşı Tarık', 'Binbaşı Vedat'];

const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR');
const L = (w: World, n: number) => Math.round(n * infl(w.m));

export const kmtAd = (w: World) => String(w.flags.kmtAd || 'Karakol komutanı');
export const kmtHuy = (w: World) => (w.flags.kmtHuy as Huy) || 'rusvetci';
export const kmtDost = (w: World) => Number(w.flags.kmtDost || 0);
export const kmtKnown = (w: World) => !!w.flags.kmtBilinen;
export const kmtSecret = (w: World) => !!w.flags.kmtSir;
export const kmtOurs = (w: World) => Number(w.flags.kmtBizim || 0) > w.m;
export const ozelTim = (w: World) => Number(w.flags.ozelTim || 0) > w.m;

/** Baskın olasılığına komutanın katkısı */
export function kmtFactor(w: World): number {
  if (!w.flags.kmtAd) return 1;
  let f = kmtHuy(w) === 'hirsli' ? 1.25 : kmtHuy(w) === 'durust' ? 1.1 : 0.9;
  f *= 1 - clamp(kmtDost(w), 0, 80) / 200;
  if (kmtOurs(w)) f *= 0.45;
  if (ozelTim(w)) f *= 1.5;
  return f;
}

function newKomutan(w: World, huy?: Huy) {
  const prev = w.flags.kmtAd;
  const pool = ADLAR.filter((a) => a !== prev);
  w.flags.kmtAd = pick(w, pool);
  w.flags.kmtHuy = huy ?? pick(w, ['rusvetci', 'rusvetci', 'durust', 'hirsli'] as Huy[]);
  w.flags.kmtBitis = w.m + rint(w, 36, 72);
  w.flags.kmtDost = 0;
  w.flags.kmtBilinen = false;
  w.flags.kmtSir = false;
  w.flags.kmtBizim = 0;
  return !!prev;
}

/** Aylık: tayinler. Yeni komutan gelince kart (karar). */
export function monthlyKomutan(w: World): boolean {
  if (!w.flags.kmtAd) {
    newKomutan(w);
    return false;
  }
  if (w.m < Number(w.flags.kmtBitis || 0)) return false;
  newKomutan(w);
  log(w, `Karakola yeni komutan atandı: ${kmtAd(w)}.`, 'olay');
  pushCard(w, {
    id: 'kmt_yeni',
    text: `Karakola yeni komutan geldi: ${kmtAd(w)}. Köyde nasıl biri olduğunu henüz kimse bilmiyor. Eskisiyle aranızdaki her şey onunla birlikte gitti.`,
    opts: [
      { t: `Hoş geldin hediyesi götür (${fmt(L(w, 350))} lira)`, k: 'hediye' },
      { t: 'Kahvede adam koy, nasıl biri öğren', k: 'tart' },
      { t: 'Uzak dur, karakola yaklaşma', k: 'uzak' },
    ],
  });
  return true;
}

export function resolveKomutan(w: World, id: string, k: string): boolean {
  if (id === 'kmt_yeni') {
    if (k === 'hediye') {
      w.hh.cash -= L(w, 350);
      w.flags.kmtBilinen = true;
      const h = kmtHuy(w);
      if (h === 'durust') {
        w.heat = clamp(w.heat + 6, 0, 100);
        log(w, `${kmtAd(w)} hediyeyi geri yolladı: "Devletin memuruna hediye götürülmez." Dürüst biri; dikkatli olmak lazım.`, 'olay');
      } else {
        w.flags.kmtDost = kmtDost(w) + (h === 'rusvetci' ? 35 : 15);
        log(w, `${kmtAd(w)} hediyeyi aldı ve gülümsedi. ${h === 'rusvetci' ? 'Zarf seven biri.' : 'Hırslı biri; seni kullanmak isteyebilir.'}`, 'olay');
      }
    } else if (k === 'tart') {
      w.flags.kmtBilinen = true;
      log(w, `Kahvedeki adam haber getirdi: yeni komutan ${HUY_AD[kmtHuy(w)]}.`, 'olay');
    }
    return true;
  }
  if (id === 'kmt_sir') {
    if (k === 'sakla') {
      w.flags.kmtSir = true;
      log(w, `${kmtAd(w)}'in sırrı bir kenara yazıldı; günü gelince kullanılacak.`, 'olay');
    } else if (k === 'ihbar') {
      w.flags.namBonus = Number(w.flags.namBonus || 0) + 2;
      newKomutan(w);
      log(w, `İhbar Ankara'ya ulaştı; komutan görevden alındı. Yerine ${kmtAd(w)} geldi.`, 'olay');
    }
    return true;
  }
  return false;
}

/** Komutanın sırrını öğrenme fırsatı: kahvede kulağa fısıldanan bir söz */
export function secretCard(w: World): boolean {
  if (!w.flags.kmtAd || kmtSecret(w) || w.flags['kmtSirSor' + w.flags.kmtAd]) return false;
  const p = (w.hh.biz.kahve ? 0.006 : 0.002) + (w.gang >= 3 ? 0.002 : 0);
  if (!chance(w, p)) return false;
  w.flags['kmtSirSor' + w.flags.kmtAd] = true;
  const sir = pick(w, ['kasabada büyük bir kumar borcu var', 'el koyduğu malların bir kısmını kendisi satıyor', 'evli olduğu halde ilçede gizli bir ikinci hayatı var', 'askerden kaçan yeğenini saklıyor']);
  pushCard(w, {
    id: 'kmt_sir',
    text: `Kahvede kulağına fısıldadılar: ${kmtAd(w)}'in ${sir}. Kanıtı da bulunur.`,
    opts: [{ t: 'Bir kenara yaz, günü gelince kullan', k: 'sakla' }, { t: "Ankara'ya ihbar et, komutan gitsin", k: 'ihbar' }, { t: 'Duymamış ol', k: 'yok' }],
  });
  return true;
}

/** Komutanı adamlara izletip sırrını bulmak (Yeraltı sekmesi) */
export function kmtFollow(w: World): { ok: boolean; msg: string } {
  if (!w.flags.kmtAd) return { ok: false, msg: 'Karakolda komutan yok.' };
  if (w.gang < 1) return { ok: false, msg: 'Komutanı izletecek bir adamın yok.' };
  if (kmtSecret(w)) return { ok: false, msg: 'Sırrı zaten biliyorsun.' };
  if (w.flags['kmtTakip' + w.flags.kmtAd]) return { ok: false, msg: 'Bu komutan zaten izlendi.' };
  const c = L(w, 1500);
  if (w.hh.cash + w.dirty < c) return { ok: false, msg: `${fmt(c)} lira gerekir.` };
  payDirtyFirst(w, c);
  w.flags['kmtTakip' + w.flags.kmtAd] = true;
  w.flags.kmtBilinen = true;
  if (chance(w, 0.55)) {
    w.flags.kmtSir = true;
    return { ok: true, msg: `Adamların ${kmtAd(w)}'in karanlık bir sırrını buldu. Baskında şantaj seçeneği açıldı.` };
  }
  if (chance(w, 0.3)) {
    w.heat = clamp(w.heat + 10, 0, 100);
    return { ok: false, msg: 'Adamın komutanı izlerken fark edildi. Jandarma huylandı.' };
  }
  return { ok: false, msg: 'Komutan temiz çıktı; bir şey bulunamadı.' };
}

/** Komutanla ilgili oyuncu eylemleri (Yeraltı sekmesi) */
export function kmtGift(w: World): { ok: boolean; msg: string } {
  const c = L(w, 600);
  if (w.hh.cash + w.dirty < c) return { ok: false, msg: 'Zarf için para yok.' };
  payDirtyFirst(w, c);
  const h = kmtHuy(w);
  if (h === 'durust') {
    w.heat = clamp(w.heat + 8, 0, 100);
    w.flags.kmtBilinen = true;
    return { ok: false, msg: `${kmtAd(w)} zarfı geri çevirdi ve tutanağa geçirdi.` };
  }
  w.flags.kmtDost = clamp(kmtDost(w) + (h === 'rusvetci' ? 20 : 10), 0, 100);
  w.heat = clamp(w.heat - 5, 0, 100);
  return { ok: true, msg: `${kmtAd(w)} zarfı aldı. Araya bir yakınlık girdi.` };
}

/** Baskın kartına eklenecek seçenekler */
export function raidOpts(w: World, bc: number, labFound: boolean): { t: string; k: string }[] {
  const o: { t: string; k: string }[] = [];
  const h = kmtHuy(w);
  const z = kmtKnown(w) ? (h === 'rusvetci' ? ' (alır)' : h === 'durust' ? ' (dürüst, riskli)' : ' (belki)') : '';
  if (w.hh.cash + w.dirty >= bc) o.push({ t: `Komutana zarf ver (${fmt(bc)} lira)${z}`, k: 'rusvet' });
  if (w.pol.seat || nufuz(w) >= 40) o.push({ t: `Nüfuzunu kullan: ilçedeki tanıdıkları ara${w.pol.seat ? ' (makamın var)' : ''}`, k: 'nufuz' });
  o.push({ t: `Avukat tut, aramanın usulsüz olduğunu söyle (${fmt(L(w, 1200))} lira)`, k: 'avukat' });
  if (kmtSecret(w)) o.push({ t: 'Şantaj: sırrını bildiğini kulağına fısılda', k: 'santaj' });
  if (w.gang >= 2) o.push({ t: `Gözdağı ver: adamlarınla karakolun önünde bekle (${w.gang} adam)`, k: 'tehdit' });
  return o;
}

export type RaidOutcome = 'kapandi' | 'devam' | 'agir';

/** Baskın seçeneklerinin çözümü. 'devam' ise suç birine yıkılır (normal yol), 'agir' ise ceza artar. */
export function resolveRaidSpecial(w: World, k: string, bribe: number): RaidOutcome | null {
  const h = kmtHuy(w);
  if (k === 'rusvet') {
    const p = (h === 'rusvetci' ? 0.95 : h === 'hirsli' ? 0.7 : 0.3) + kmtDost(w) / 300;
    payDirtyFirst(w, bribe);
    w.flags.kmtBilinen = true;
    if (chance(w, p)) {
      w.heat = clamp(w.heat * 0.6, 0, 100);
      w.flags.kmtDost = clamp(kmtDost(w) + 10, 0, 100);
      log(w, `Jandarma baskını ${fmt(bribe)} liralık bir zarfla kapandı. ${kmtAd(w)} giderken şapkasını düzeltti.`, 'olay');
      return 'kapandi';
    }
    w.heat = clamp(w.heat + 15, 0, 100);
    log(w, `${kmtAd(w)} zarfı masaya fırlattı: "Bir de rüşvet!" Para gitti, suç ağırlaştı.`, 'olay');
    return 'agir';
  }
  if (k === 'nufuz') {
    const p = clamp((w.pol.seat === 'vekil' ? 0.85 : w.pol.seat === 'belediye' ? 0.7 : w.pol.seat === 'muhtar' ? 0.45 : 0.3) + nufuz(w) / 400 - (h === 'durust' ? 0.15 : 0), 0.1, 0.9);
    if (chance(w, p)) {
      w.heat = clamp(w.heat * 0.7, 0, 100);
      log(w, `İlçeden bir telefon geldi; ${kmtAd(w)} tutanağı katlayıp cebine koydu. Bu iyiliğin bedeli bir gün istenecek.`, 'olay');
      w.flags.borcluIyilik = Number(w.flags.borcluIyilik || 0) + 1;
      return 'kapandi';
    }
    w.heat = clamp(w.heat + 12, 0, 100);
    log(w, `Aranan tanıdıklar telefonu açmadı. ${kmtAd(w)} bunu da dosyaya yazdı.`, 'olay');
    return 'agir';
  }
  if (k === 'santaj') {
    if (chance(w, 0.85)) {
      w.flags.kmtBizim = Number(w.flags.kmtBitis || w.m + 36);
      w.flags.kmtDost = 100;
      w.heat = clamp(w.heat * 0.4, 0, 100);
      log(w, `${kmtAd(w)}'in yüzü bembeyaz oldu. Tutanak yırtıldı. Bundan sonra karakolda senin adamın var.`, 'olay');
      return 'kapandi';
    }
    w.flags.kmtSir = false;
    w.flags.kmtHuy = 'hirsli';
    w.heat = clamp(w.heat + 20, 0, 100);
    log(w, `Şantaj tutmadı: komutan sırrını önceden amirlerine kendisi açmış. Artık sana kişisel kini var.`, 'olay');
    return 'agir';
  }
  if (k === 'tehdit') {
    const p = clamp((h === 'rusvetci' ? 0.6 : h === 'hirsli' ? 0.3 : 0.25) + w.gang * 0.03, 0.1, 0.8);
    if (chance(w, p)) {
      w.heat = clamp(w.heat + 10, 0, 100);
      w.flags.kmtDost = clamp(kmtDost(w) - 20, -100, 100);
      log(w, `${kmtAd(w)} karakolun önündeki kalabalığı görünce geri adım attı. Tutanak "bir şey bulunamadı" diye yazıldı. Ama geri adım atan bir gün öç alır.`, 'olay');
      return 'kapandi';
    }
    w.heat = clamp(w.heat + 30, 0, 100);
    log(w, `Gözdağı ters tepti: komutan ilçeden takviye istedi, dosyana "devlete direnme" de eklendi.`, 'olay');
    return 'agir';
  }
  if (k === 'avukat') {
    w.hh.cash -= L(w, 1200);
    if (chance(w, hasLawyer(w) ? 0.6 : 0.35)) {
      log(w, `Avukat aramanın usulsüz yapıldığını kanıtladı; deliller mahkemede geçersiz sayıldı.`, 'olay');
      w.heat = clamp(w.heat * 0.85, 0, 100);
      return 'kapandi';
    }
    log(w, `Avukat elinden geleni yaptı ama dosya ağırdı.`, 'olay');
    return null;
  }
  return null;
}
