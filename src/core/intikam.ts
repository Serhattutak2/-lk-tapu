// Eski husumetin geç oyunda olgunlaşıp geri dönmesi. Amaç: oyun hep aynı ritimde akmasın,
// erken verdiğin kararlar (bir aileyi ezmen, onların üstüne çıkman) yıllar sonra karşına çıksın.
// Mevcut düşmanlık durumunu (Konsey ailelerinin bağı) okur; yeni bir sistem/denge kurmaz.
import type { World, CityFamily } from './types';
import { chance, clamp, pick, rint } from './rng';
import { log } from './people';
import { infl } from './calendar';
import { pushCard } from './cards';
import { aliveFams, force } from './aile';

const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR');
// Sana en çok kin tutan, ayakta ve Büyük Baba olmayan aile
const kinci = (w: World): CityFamily | null => {
  const al = aliveFams(w).filter((f) => f.id !== w.city.baba && f.bond <= -45);
  return al.length ? al.sort((a, b) => a.bond - b.bond)[0] : null;
};

export function intikamCards(w: World): boolean {
  if (!w.city.open || w.flags.interregnum || w.over) return false;
  if (Number(w.flags.intikamNext || 0) > w.m) return false;
  const f = kinci(w);
  if (!f) return false;
  if (!chance(w, 0.05)) return false;
  w.flags.intikamNext = w.m + rint(w, 18, 34);
  const yil = rint(w, 3, 12);
  const neden = pick(w, [
    'yıllar önce onları ezip geçmen',
    'onların başı eğik dururken senin yükselmen',
    'bir zamanlar adamlarının önünde küçük düşürülmeleri',
    'tahta oynarken onları saf dışı bırakman',
  ]);
  pushCard(w, {
    id: 'intikam_aile',
    text: `${f.reis}, ${neden} yüzünden ${yil} yıldır içinde bir kin büyütüyormuş. Şimdi ${f.ad} ailesi yeniden toparlandı (${f.men} adam) ve "eski defteri kapatma" vakti geldiğini düşünüyor. Haber geldi: ya masaya oturulacak ya da kan akacak.`,
    opts: [
      { t: `Barışa otur, gönlünü al (${fmt(Math.round(18000 * infl(w.m)))} lira)`, k: 'baris' },
      { t: 'Adamlarınla karşılık ver, bu işi bitir', k: 'vur' },
      { t: 'Sineye çekme; umursama, ne yapacaklarsa yapsınlar', k: 'bekle' },
    ],
    data: { fid: f.id },
  });
  return true;
}

export function resolveIntikam(w: World, id: string, k: string, data?: Record<string, unknown>): boolean {
  if (id !== 'intikam_aile') return false;
  const f = aliveFams(w).find((x) => x.id === String(data?.fid || ''));
  if (!f) return true;
  if (k === 'baris') {
    const cost = Math.round(18000 * infl(w.m));
    const pay = Math.min(cost, w.hh.cash + w.dirty);
    const fromCash = Math.min(w.hh.cash, pay); w.hh.cash -= fromCash; w.dirty -= pay - fromCash;
    f.bond = clamp(f.bond + 45, -100, 60);
    log(w, `${f.ad} ailesiyle masaya oturuldu; ${fmt(pay)} liralık jest ve birkaç tatlı söz eski defteri kapattı (bağ ${Math.round(f.bond)}).`, 'olay');
  } else if (k === 'vur') {
    w.heat = clamp(w.heat + 14, 0, 100);
    const p = clamp(0.3 + force(w) * 0.02 - f.men * 0.03, 0.12, 0.85);
    if (chance(w, p)) {
      f.men = Math.max(0, f.men - rint(w, 6, 12));
      f.bond = clamp(f.bond + 10, -100, 40); // korkudan sinerler
      w.flags.namBonus = Number(w.flags.namBonus || 0) + 6;
      w.gang = Math.max(0, w.gang - rint(w, 0, 2));
      log(w, `${f.ad} ailesinin üstüne gidildi; adamları dağıldı, ${f.reis} geri çekildi. Şehir bir kez daha kimin güçlü olduğunu gördü.`, 'olay');
      if (f.men <= 0) { f.alive = false; log(w, `${f.ad} ailesi tükendi; mahalleleri sahipsiz kaldı.`, 'miras'); }
    } else {
      const loss = Math.round((15000 + rint(w, 0, 20000)) * infl(w.m));
      const fromCash = Math.min(w.hh.cash, loss); w.hh.cash -= fromCash; w.dirty = Math.max(0, w.dirty - (loss - fromCash));
      w.gang = Math.max(0, w.gang - rint(w, 2, 5));
      f.bond = clamp(f.bond - 15, -100, 100);
      log(w, `${f.ad} ailesine yapılan baskın ters tepti: adam kaybettin, ${fmt(loss)} liralık zarar, husumet büyüdü.`, 'olay');
    }
  } else {
    // umursamazsan baskınlarını yerler
    const loss = Math.round((10000 + rint(w, 0, 16000)) * infl(w.m));
    const fromCash = Math.min(w.hh.cash, loss); w.hh.cash -= fromCash; w.dirty = Math.max(0, w.dirty - (loss - fromCash));
    w.heat = clamp(w.heat + 6, 0, 100);
    f.bond = clamp(f.bond - 10, -100, 100);
    log(w, `${f.ad} ailesini umursamadın; bir gece dükkânlarını bastılar, ${fmt(loss)} liralık zarar verip çekildiler. Bu iş burada bitmez.`, 'olay');
  }
  return true;
}
