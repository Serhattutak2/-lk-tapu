// Felaketler: oyun hep yukarı gitmesin diye arada gelen büyük, sarsıcı olumsuz olaylar.
// Servet büyüdükçe darbe de büyür; yanlış karar parayı eritebilir. Hepsi soyut oyun olaylarıdır.
import type { World } from './types';
import { chance, clamp, pick, rint } from './rng';
import { log, fullName, P, hhMembers, age } from './people';
import { infl } from './calendar';
import { pushCard } from './cards';
import { FACS, facN, facDown } from './baron';
import type { FacId } from './types';

const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR');
const wealth = (w: World) => Math.max(0, w.hh.cash) + Math.max(0, w.dirty);

/** Servetin bir oranını nakit+kara kasadan sök. */
function drain(w: World, frac: number): number {
  const total = wealth(w);
  let hit = Math.round(total * frac);
  const d = Math.min(w.dirty, hit); w.dirty -= d; hit -= d;
  w.hh.cash = Math.max(0, w.hh.cash - hit);
  return Math.round(total * frac);
}

export function krizCards(w: World): boolean {
  if (w.flags.interregnum || w.over) return false;
  if (Number(w.flags.krizNext || 0) > w.m) return false;
  if (wealth(w) < 40000 * infl(w.m)) return false;
  const pl = P(w, w.playerId);
  if (!pl) return false;
  // Nadir: yılda ortalama bir kez civarı, servet büyüdükçe biraz daha olası
  if (!chance(w, 0.015 + Math.min(0.02, wealth(w) / (6_000_000 * infl(w.m))))) return false;
  w.flags.krizNext = w.m + rint(w, 20, 44);

  const kind = pick(w, buildPool(w));
  if (kind === 'ihanet') {
    const men = hhMembers(w).filter((p) => p.blood && p.sex === 'E' && !p.away && age(w, p) >= 20 && p.id !== w.playerId && p.id !== w.heirId);
    const who = w.flags.rizaOgul === 'sag' ? "sağ kolun Selim" : men.length ? fullName(pick(w, men)) : (w.gang > 0 ? 'en güvendiğin adamın' : 'ortağın');
    const stolen = Math.round(wealth(w) * (0.18 + rint(w, 0, 12) / 100));
    pushCard(w, {
      id: 'kriz_ihanet',
      text: `Bir sabah kasa boştu: ${who}, yıllardır yanındaydı ama gözü yükseldi. Kara kasadan ${fmt(stolen)} lirayı alıp sırra kadem bastı — belki bir rakip aileye sığındı. Ne yapacaksın?`,
      opts: [
        { t: 'Adamlarınla peşine düş (bulursan geri alırsın, bulamazsan daha çok kaybedersin)', k: 'kov' },
        { t: 'Bırak gitsin, bu parayı unut', k: 'birak' },
      ],
      data: { stolen },
    });
    return true;
  }
  if (kind === 'baskin') {
    const seize = drain(w, 0.2 + rint(w, 0, 15) / 100);
    const owned = (Object.keys(FACS) as FacId[]).filter((f) => facN(w, f) > 0 && !facDown(w, f));
    if (owned.length) { const f = pick(w, owned); w.city.facs[f]!.down = w.m + rint(w, 5, 11); }
    w.heat = clamp(w.heat + 25, 0, 100);
    pushCard(w, {
      id: 'kriz_baskin',
      text: `Şafak vakti kapılar kırıldı: büyük bir devlet operasyonu. ${fmt(seize)} liralık mala el konuldu${owned.length ? ', bir tesisin mühürlendi' : ''}, gazeteler adını manşete taşıdı. Avukatlar kapıda.`,
      opts: [
        { t: `Rüşvet ve avukatla dosyayı küçült (${fmt(Math.round(30000 * infl(w.m)))} lira)`, k: 'rusvet' },
        { t: 'Kamuoyu önünde temiz iş adamı rolü yap', k: 'temiz' },
        { t: 'Sineye çek', k: 'cek' },
      ],
    });
    return true;
  }
  if (kind === 'cokus') {
    const loss = drain(w, 0.16 + rint(w, 0, 12) / 100);
    const sebep = pick(w, ['bir devalüasyon', 'bankaların batması', 'ani bir enflasyon dalgası', 'borsanın çöküşü']);
    log(w, `${sebep[0].toLocaleUpperCase('tr-TR') + sebep.slice(1)}: elindeki paranın alım gücü bir gecede eridi. ${fmt(loss)} liralık servet buhar oldu. Zenginin de fakirin de canı yandı.`, 'para');
    pushCard(w, {
      id: 'kriz_cokus',
      text: `${sebep[0].toLocaleUpperCase('tr-TR') + sebep.slice(1)} ülkeyi vurdu; bir gecede ${fmt(loss)} liralık servetin eridi. Böyle zamanlarda kimi batar, kimi fırsatı görür.`,
      opts: [
        { t: `Dibden mal/toprak kap (${fmt(Math.round(25000 * infl(w.m)))} lira — belki kazanç, belki daha çok zarar)`, k: 'firsat' },
        { t: 'Kenara çekil, fırtına geçsin', k: 'bekle' },
      ],
    });
    return true;
  }
  // yangın / sabotaj
  const owned = (Object.keys(FACS) as FacId[]).filter((f) => facN(w, f) > 0 && !facDown(w, f));
  if (owned.length) {
    const f = pick(w, owned);
    w.city.facs[f]!.down = w.m + rint(w, 6, 14);
    const loss = drain(w, 0.08);
    pushCard(w, {
      id: 'kriz_yangin',
      text: `Gece yarısı ${FACS[f].ad.toLowerCase()} alev aldı — kaza mı, sabotaj mı belli değil. Üretim durdu, ${fmt(loss)} liralık zarar. Biri "bu iş rakip ailenin işi" diye fısıldıyor.`,
      opts: [
        { t: 'Rakipleri araştır, hesap sor (riskli)', k: 'hesap' },
        { t: 'Sigortaya ver, sessizce onar', k: 'onar' },
      ],
    });
    return true;
  }
  // mal yoksa dolandırıcılık
  const loss = drain(w, 0.14);
  log(w, `Sana "katlayacağım" diye yaklaşan biri parayı alıp kayboldu: ${fmt(loss)} lira dolandırıldın. Açgözlülük pahalıya patladı.`, 'para');
  w.flags.krizNext = w.m + rint(w, 24, 48);
  return false;
}

function buildPool(w: World): string[] {
  const pool: string[] = ['cokus'];
  if (w.gang >= 4 || w.flags.rizaOgul === 'sag') pool.push('ihanet');
  if (w.dirty > 30000 * infl(w.m) || w.city.open) pool.push('baskin');
  if ((Object.keys(FACS) as FacId[]).some((f) => facN(w, f) > 0)) pool.push('yangin', 'yangin');
  return pool;
}

export function resolveKriz(w: World, id: string, k: string, data?: Record<string, unknown>): boolean {
  if (id === 'kriz_ihanet') {
    const stolen = Number(data?.stolen || 0);
    if (k === 'kov') {
      w.heat = clamp(w.heat + 10, 0, 100);
      if (w.gang >= 5 && chance(w, clamp(0.3 + w.gang * 0.03, 0.3, 0.75))) {
        w.dirty += stolen;
        log(w, `Adamların haini bir kenar mahallede kıstırdı; para geri alındı, bir daha kimse ihanete yeltenmeyecek.`, 'para');
      } else {
        const extra = Math.round(stolen * 0.5);
        w.dirty = Math.max(0, w.dirty - extra);
        w.gang = Math.max(0, w.gang - rint(w, 1, 2));
        log(w, `Haini bulamadın; peşine taktığın adamlardan biri de tuzağa düştü. Hem para gitti hem ${fmt(extra)} lira daha masraf.`, 'olay');
      }
    } else log(w, `Haini bırakıp parayı unuttun. Adamların "demek ki kaçana dokunulmuyor" diye düşündü.`, 'olay');
    return true;
  }
  if (id === 'kriz_baskin') {
    if (k === 'rusvet') { w.hh.cash = Math.max(0, w.hh.cash - Math.round(30000 * infl(w.m))); w.heat = clamp(w.heat - 20, 0, 100); log(w, `Doğru kapılara zarflar gitti; dosya küçüldü, en ağır suçlamalar düştü.`, 'para'); }
    else if (k === 'temiz') { w.flags.namBonus = Number(w.flags.namBonus || 0) + 6; w.heat = clamp(w.heat - 8, 0, 100); log(w, `Basına "ben namuslu bir tüccarım" dedin; kimi inandı kimi gülüp geçti.`, 'olay'); }
    else { w.heat = clamp(w.heat + 6, 0, 100); log(w, `Operasyonu sineye çektin; bu yara bir süre kapanmaz.`, 'olay'); }
    return true;
  }
  if (id === 'kriz_cokus') {
    if (k === 'firsat') {
      const bet = Math.round(25000 * infl(w.m));
      if (w.hh.cash < bet && w.dirty < bet) { log(w, `Fırsata atlayacak nakdin yoktu.`, 'para'); return true; }
      (w.hh.cash >= bet ? (w.hh.cash -= bet) : (w.dirty -= bet));
      if (chance(w, 0.5)) { const win = Math.round(bet * (1.5 + rint(w, 0, 10) / 10)); w.hh.cash += win; log(w, `Dipten kaptığın mallar toparlandı; ${fmt(win)} lira kazandın. Kriz cesur olana yarar.`, 'para'); }
      else log(w, `Dip sandığın yer daha da dibe gitti; koyduğun ${fmt(bet)} lira da buhar oldu. Kumar bu.`, 'para');
    } else log(w, `Fırtınayı kenardan izledin; batmadın ama fırsat da kaçtı.`, 'olay');
    return true;
  }
  if (id === 'kriz_yangin') {
    if (k === 'hesap') {
      w.heat = clamp(w.heat + 12, 0, 100);
      if (w.gang >= 4 && chance(w, 0.5)) { w.flags.korku = clamp(Number(w.flags.korku || 0) + 10, 0, 100); log(w, `Sabotajın arkasındakileri bulup hesap sordun; artık kimse malına el uzatmaya cesaret edemiyor.`, 'olay'); }
      else { w.gang = Math.max(0, w.gang - 1); log(w, `Yanlış kapı çaldın; boş yere bir adamını kaybettin, husumet büyüdü.`, 'olay'); }
    } else log(w, `Sessizce onarıma verdin; kimseyle uğraşmadın ama hesabı da soramadın.`, 'olay');
    return true;
  }
  return false;
}
