// Olay kartları: oyuncudan karar isteyen anlar.
// Kartlar World içinde düz veri olarak durur; seçenekleri RESOLVE tablosundan çözülür.
import { resolveSagkol } from './sagkol';
import { konseyCards, resolveKonsey, surgunCards } from './konsey';
import { koyCards, resolveKoy } from './koyhayati';
import { questCards, resolveQuest } from './quests';
import { komsuCards, resolveKomsu } from './komsu';
import { newsCards, resolveNews } from './news';
import type { Card, World } from './types';
import { chance, clamp, gauss, pick, rint } from './rng';
import { FEMALE, MALE, SURNAMES } from './names';
import { age, alive, bloodLiving, fullName, hhMembers, log, makePerson, P, removeFromHH } from './people';
import { dateText, infl, monthOf, year } from './calendar';
import { marry, resolveSuccession } from './life';
import { autoSow, resolveHashas } from './fields';
import { applyRuhsat } from './crime';
import { resolveYear, yearCard } from './yil';
import { agaCards, resolveAga } from './aga';
import { resolveKomutan } from './jandarma';
import { familyCards, resolveFamily } from './family';
import { buyPlot, landBlockers, nam as namOf } from './assets';
import { landBase, PLOTS, plotOwnerName, plotPrice } from './plots';
import { crimeCards, resolveCrime } from './crime';
import { labCards, resolveLab } from './lab';
import { feudCards, resolveFeud, resolveRivalCard, rivalCards } from './feud';
import { homeCards, resolveHome } from './home';
import { crewCards, denizCards, netCards, resolveBaron, resolveDeniz, rizaCards } from './baron';
import { eventCards, resolveEvent } from './events';
import { districtCards, resolveDistrict } from './district';
import { resolveSick, sickCard } from './health';
import { jobCards, resolveJobCard } from './jobcard';
import { historyCards, resolveHistory } from './history';

export function pushCard(w: World, c: Omit<Card, 'uid' | 'm'>) {
  w.flags.kartSay = Number(w.flags.kartSay || 0) + 1;
  w.cards.push({ ...c, uid: w.nextCard++, m: w.m });
}

/** Köy kenarında bir tarlanın bugünkü fiyatı (ilk tapu hedefi için). */
export function landPrice(w: World): number {
  const i = w.plots.findIndex((p) => p.o === 'koy' && p.sale);
  return i >= 0 ? plotPrice(w, i) : Math.round(landBase(w) * 0.95 / 100) * 100;
}

export { landBlockers };

type Resolver = (w: World, c: Card, k: string) => void;

const RESOLVE: Record<string, Resolver> = {
  veraset: (w, _c, k) => resolveSuccession(w, k),

  gorucu: (w, c, k) => {
    const p = P(w, w.playerId);
    const d = c.data as { first: string; last: string; ageY: number; sex: 'E' | 'K' };
    if (k !== 'evet' || !alive(p)) {
      log(w, `${p ? fullName(p) : 'Aile'}, ${d.first} ${d.last} ile evlilik teklifini geri çevirdi.`, 'evlilik');
      return;
    }
    const s = makePerson(w, { sex: d.sex, b: w.m - d.ageY * 12 - rint(w, 0, 11), first: d.first, last: d.last, blood: false, inHH: false });
    s.sk.tarim = clamp(Math.round(d.ageY * 1.4 + gauss(w, 0, 6)), 0, 70);
    s.rel = clamp(Math.round(gauss(w, 50, 15)), 0, 95);
    marry(w, p, s);
    const cost = Number(c.data?.cost || Math.round(300 * infl(w.m)));
    w.hh.cash -= cost;
    log(w, `${fullName(p)} ile ${fullName(s)} evlendi. Düğün ${cost} liraya mal oldu.`, 'evlilik');
  },

  hastalik: (w, c, k) => {
    const p = P(w, c.pid);
    if (!alive(p)) return;
    if (!c.data?.cures) {
      // 0.6 öncesi kart
      if (k === 'doktor') {
        w.hh.cash -= Math.round(150 * infl(w.m));
        p.sick = 0;
      }
      return;
    }
    resolveSick(w, p, k, c.data);
  },

  gurbet: (w, c, k) => {
    const p = P(w, c.pid);
    if (!alive(p)) return;
    if (k !== 'gonder') {
      log(w, `${fullName(p)} gurbete gitmedi.`, 'olay');
      return;
    }
    const de = year(w.m) >= 1961;
    const yol = Math.round((de ? 250 : 60) * infl(w.m));
    w.hh.cash -= yol;
    p.away = 'gurbet';
    p.awayUntil = w.m + 12 * (de ? rint(w, 4, 9) : rint(w, 2, 5));
    p.job = 'yok';
    p.parcel = undefined;
    w.flags['gyer' + p.id] = de ? 'de' : 'ist';
    log(w, de ? `${fullName(p)} Almanya'ya işçi olarak gitti. Yol parası ${yol} lira.` : `${fullName(p)} İstanbul'a, inşaatlarda çalışmaya gitti. Yol parası ${yol} lira.`, 'olay');
  },

  tuccar: (w, _c, k) => {
    const p = P(w, w.playerId);
    w.flags.tuccar = true;
    if (k === 'calis' && alive(p)) {
      p.job = 'tuccar';
      p.sk.ticaret = Math.max(p.sk.ticaret, 10);
      log(w, `${fullName(p)} hububat tüccarı Hacı Rüştü'nün yanında çalışmaya başladı.`, 'is');
    } else {
      log(w, `Hacı Rüştü ile tanışıklık kuruldu; ailede isteyen yanında çalışabilir.`, 'is');
    }
  },

  tapu: (w, c, k) => {
    if (k !== 'al') return;
    const r = buyPlot(w, c.data!.plot as number);
    if (!r.ok) log(w, r.msg, 'para');
  },

  plan_hashas: (w, _c, k) => {
    const key = 'planRuhsat' + year(w.m);
    if (k === 'ruhsat') {
      const r = applyRuhsat(w);
      log(w, r.msg, 'is');
      if (r.ok) autoSow(w);
      else w.flags[key] = 'bekle';
      return;
    }
    w.flags[key] = k === 'bos' ? 'bos' : k;
    if (k !== 'bos') autoSow(w);
  },
  hashas_hasat: (w, c, k) => resolveHashas(w, c.data!.sacks as number, `${(c.data!.label as string) ?? c.data!.parcel}. parsel`, k),
  bilgi: () => {},
};

/** Sonuç kartı için anlık görüntü */
function snap(w: World) {
  return { cash: w.hh.cash, dirty: w.dirty, nam: namOf(w), heat: w.heat, feud: w.rival.gone ? 0 : w.rival.feud, gang: w.gang, kork: Number(w.flags.korku || 0), sayg: Number(w.flags.saygi || 0), kisi: bloodLiving(w).length, logN: w.chronicle.length };
}
const DECISION = /^(kan|baris|sinir|kacirma|baskin|rk_|ce_|cete|riza_taht|kmt_|aga_kiz|ag_|q:|km_|kv_|fa_|nw_|hashas_hasat|gorucu|hastalik|plan_hashas|ruhsat_red|it_|sk_|sg_)/;

export function resolveCard(w: World, uid: number, k: string) {
  const i = w.cards.findIndex((c) => c.uid === uid);
  if (i < 0) return;
  const [c] = w.cards.splice(i, 1);
  const decision = (c.opts?.length ?? 0) >= 2 && DECISION.test(c.id) && c.id !== 'yil';
  const before = decision ? snap(w) : null;
  if (RESOLVE[c.id]) RESOLVE[c.id](w, c, k);
  else if (c.id.startsWith('meslek:')) {
    resolveJobCard(w, c.id, k);
    if (!w.cards.length) jobCards(w); // sıradaki kişiyi hemen sor
  }
  else if (!resolveCrime(w, c, k) && !resolveLab(w, c.id, k) && !resolveFeud(w, c.id, c.pid, k, c.data) && !resolveBaron(w, c.id, k) && !resolveDeniz(w, c.id, k) && !resolveEvent(w, c.id, k, c.pid, c.data) && !resolveJobCard(w, c.id, k) && !resolveHistory(w, c.id, k, c.pid, c.data) && !resolveKomutan(w, c.id, k) && !resolveYear(w, c.id, k) && !resolveQuest(w, c.id, k, c.pid, c.data) && !resolveKomsu(w, c.id, k) && !resolveKoy(w, c.id, k, c.pid) && !resolveKonsey(w, c.id, k) && !resolveSagkol(w, c.id, k, c.pid) && !resolveNews(w, c.id, k) && !resolveAga(w, c.id, k) && !resolveRivalCard(w, c.id, k, c.pid) && !resolveFamily(w, c.id, k, c.pid, c.data) && !resolveDistrict(w, c.id, k, c.data)) resolveHome(w, c.id, c.pid, k, c.data);
  if (w.hh.cash < 0) {
    // Kasada olmayan para ağadan borç alınır
    w.hh.debt += -w.hh.cash;
    log(w, `Kasada para yoktu; ${-w.hh.cash} lira ağadan borç alındı.`, 'para');
    w.hh.cash = 0;
  }
  if (before && !w.over && !w.flags.interregnum) pushSonuc(w, before);
}

/** Karardan sonra ne değiştiğini özetleyen sonuç kartı. */
function pushSonuc(w: World, b: ReturnType<typeof snap>) {
  if (w.cards.length) return; // başka bir kart araya girdiyse karıştırma
  const a = snap(w);
  const d: { t: string; up: boolean }[] = [];
  const money = (a.cash + a.dirty) - (b.cash + b.dirty);
  if (Math.abs(money) >= 50) d.push({ t: `${money > 0 ? '+' : '−'}${Math.abs(Math.round(money)).toLocaleString('tr-TR')} lira`, up: money > 0 });
  if (a.nam !== b.nam) d.push({ t: `Nam ${a.nam > b.nam ? '+' : '−'}${Math.abs(a.nam - b.nam)}`, up: a.nam > b.nam });
  if (Math.round(a.kork) !== Math.round(b.kork)) d.push({ t: `Korku ${a.kork > b.kork ? '+' : '−'}${Math.abs(Math.round(a.kork - b.kork))}`, up: a.kork > b.kork });
  if (Math.round(a.sayg) !== Math.round(b.sayg)) d.push({ t: `Saygı ${a.sayg > b.sayg ? '+' : '−'}${Math.abs(Math.round(a.sayg - b.sayg))}`, up: a.sayg > b.sayg });
  if (Math.round(a.heat) !== Math.round(b.heat)) d.push({ t: `Dikkat ${a.heat > b.heat ? '+' : '−'}${Math.abs(Math.round(a.heat - b.heat))}`, up: a.heat < b.heat });
  if (Math.round(a.feud) !== Math.round(b.feud)) d.push({ t: `Husumet ${a.feud > b.feud ? '+' : '−'}${Math.abs(Math.round(a.feud - b.feud))}`, up: a.feud < b.feud });
  if (a.gang !== b.gang) d.push({ t: `Adam ${a.gang > b.gang ? '+' : '−'}${Math.abs(a.gang - b.gang)}`, up: a.gang > b.gang });
  if (a.kisi < b.kisi) d.push({ t: `${b.kisi - a.kisi} can kaybı`, up: false });
  if (!d.length) return;
  // Karar sonrası kronikte eklenen son satırı sahne olarak göster
  const line = w.chronicle.length > b.logN ? w.chronicle[w.chronicle.length - 1].t : '';
  pushCard(w, { id: 'sonuc', text: line || 'Karar verildi.', opts: [{ t: 'Devam', k: 'ok' }], data: { delta: d } });
}

/** Her ay çağrılır: koşullara göre yeni kartlar üretir. */
export function generateCards(w: World) {
  if (w.cards.length || w.flags.interregnum || w.over) return;
  const pl = P(w, w.playerId);
  if (!alive(pl)) return;
  const pa = age(w, pl);
  const yr = year(w.m);
  if (yearCard(w)) return;
  if (crimeCards(w)) return;
  if (agaCards(w)) return;
  if (newsCards(w)) return;
  if (questCards(w)) return;
  if (feudCards(w) || w.over) return;
  if (rivalCards(w)) return;
  if (labCards(w)) return;
  if (netCards(w) || crewCards(w) || rizaCards(w) || denizCards(w)) return;
  if (districtCards(w)) return;
  if (historyCards(w) || w.over) return;
  if (eventCards(w) || w.over) return;
  if (jobCards(w)) return;
  if (homeCards(w)) return;
  if (familyCards(w)) return;
  if (komsuCards(w)) return;
  if (koyCards(w)) return;
  if (surgunCards(w) || konseyCards(w)) return;

  // Görücü
  if (pa >= 17 && pa <= 50 && !alive(P(w, pl.sp)) && (!pl.sp || w.flags.gorucuIste) && chance(w, w.flags.gorucuIste ? 1 : 0.08)) {
    w.flags.gorucuIste = false;
    const sex = pl.sex === 'E' ? 'K' : 'E';
    const ageY = clamp(sex === 'K' ? pa - rint(w, 0, 5) : pa + rint(w, 0, 6), 16, 50);
    const first = pick(w, sex === 'E' ? MALE : FEMALE);
    const last = pick(w, SURNAMES);
    const koy = pick(w, ['Yukarıdere', 'Kızılca', 'Aşağıova', 'Çamlıbel', 'Gökpınar', 'Karaçam']);
    const cost = Math.round((300 * infl(w.m) * (0.75 + rint(w, 0, 50) / 100)) / 10) * 10;
    pushCard(w, {
      id: 'gorucu',
      text: `${koy} köyünden ${last} ailesi görücü yolladı: ${first} (${ageY}) ile evlenmen isteniyor. Düğün, takı ve ${year(w.m) < 1960 ? 'başlık' : 'çeyiz'} derken yaklaşık ${cost.toLocaleString('tr-TR')} liraya mal olur.`,
      opts: [{ t: `Kabul et (${cost.toLocaleString('tr-TR')} lira)`, k: 'evet' }, { t: 'Geri çevir', k: 'hayir' }],
      data: { first, last, ageY, sex, cost },
    });
    return;
  }

  // Satılık tarla haberi
  const sale = w.plots.map((p, i) => (p.o !== 'biz' && p.sale ? i : -1)).filter((i) => i >= 0);
  if (sale.length && landBlockers(w).length === 0 && !w.flags['tapuSor' + yr] && chance(w, w.hh.parcels.length === 0 ? 0.2 : 0.04)) {
    const i = sale.sort((a, b) => plotPrice(w, a) - plotPrice(w, b))[0];
    const price = plotPrice(w, i);
    if (w.hh.cash >= price) {
      w.flags['tapuSor' + yr] = true;
      pushCard(w, {
        id: 'tapu',
        text: w.hh.parcels.length === 0
          ? `${plotOwnerName(w, i)}, ${PLOTS[i].yer} mevkiindeki 5 dönüm tarlasını satıyor: ${price.toLocaleString('tr-TR')} lira. Bu, ailenin ilk kendi toprağı olur. Haritada satılık tarlaların üstünde beyaz bir kazık var; dokunup başka tarlalara da bakabilirsin.`
          : `${plotOwnerName(w, i)}, ${PLOTS[i].yer} mevkiindeki tarlasını ${price.toLocaleString('tr-TR')} liraya satıyor. Verimi ${Math.round(PLOTS[i].q * 100)}.`,
        opts: [{ t: `Satın al (${price.toLocaleString('tr-TR')} lira)`, k: 'al' }, { t: 'Bekle', k: 'bekle' }],
        data: { plot: i, price },
      });
      return;
    }
  }

  // Hastalık
  const mem = hhMembers(w).filter((p) => !p.away && !p.sick);
  if (mem.length && chance(w, 0.03)) {
    const p = pick(w, mem);
    p.sick = rint(w, 2, 4);
    p.hp = clamp(p.hp - rint(w, 10, 20), 5, 100);
    const sc = sickCard(w, p);
    pushCard(w, { id: 'hastalik', pid: p.id, text: sc.text, opts: sc.opts, data: sc.data });
    return;
  }

  // Gurbet: 1961–1975 Almanya; öncesinde İstanbul'un inşaatları
  if (yr <= 1975) {
    const cand = hhMembers(w).filter((p) => p.id !== w.playerId && !p.away && age(w, p) >= 20 && age(w, p) <= 40 && !w.flags['g' + p.id]);
    if (cand.length && chance(w, 0.015)) {
      const p = pick(w, cand);
      w.flags['g' + p.id] = true;
      const de = yr >= 1961;
      const yol = Math.round((de ? 250 : 60) * infl(w.m));
      pushCard(w, {
        id: 'gurbet',
        pid: p.id,
        text: de
          ? `Almanya'ya işçi alınıyor. ${fullName(p)} (${age(w, p)}) gitmek istiyor. Yıllarca uzakta kalır ama her ay mark gönderir; dönerse birikimiyle döner. Ya hiç dönmezse?`
          : `İstanbul'da inşaatlar adam istiyor. ${fullName(p)} (${age(w, p)}) gurbete çıkmak istiyor; birkaç yıl uzakta kalır, ayda bir havale yollar.`,
        opts: [{ t: `Gönder (${yol} lira yol parası)`, k: 'gonder' }, { t: 'Gitmesin', k: 'kalsin' }],
      });
      return;
    }
  }

  // Tüccarla tanışma
  if (!w.flags.tuccar && pa >= 16 && pl.sk.tarim >= 28 && chance(w, 0.03)) {
    pushCard(w, {
      id: 'tuccar',
      text: `Kahvede ilçeden gelen hububat tüccarı Hacı Rüştü ile tanıştın. Tarlaları iyi bilen, güvenilir birini arıyor.`,
      opts: [{ t: 'Yanında çalış', k: 'calis' }, { t: 'Tanışıklık yeter', k: 'tanis' }],
    });
    return;
  }
}

/** Kart gerektirmeyen mevsimlik olaylar (yalnızca kronik). */
export function seasonalNotes(w: World): number {
  const mo = monthOf(w.m);
  let bonus = 0;
  if (mo === 5) {
    bonus = 50;
    if (chance(w, 0.25)) log(w, `Lisanslı haşhaş tarlalarında hasat başladı; gündelikçilere ek iş çıktı.`, 'olay');
  }
  if (mo === 11 && chance(w, 0.2)) {
    w.flags.sertKis = year(w.m) + 1;
    log(w, `Sert bir kış geliyor; odun ve erzak pahalandı.`, 'olay');
  }
  return bonus;
}

/** Gurbetteki aile üyeleri: dönüş ya da kalış. */
export function gurbetReturns(w: World) {
  for (const p of Object.values(w.people)) {
    if (!alive(p) || p.away !== 'gurbet' || (p.awayUntil ?? 0) > w.m) continue;
    p.away = undefined;
    p.awayUntil = undefined;
    const ist = w.flags['gyer' + p.id] === 'ist';
    const fut = w.flags['gyer' + p.id] === 'fut';
    if (fut) {
      const sav = Math.round(rint(w, 60, 120) * 200 * infl(w.m));
      w.hh.cash += sav;
      p.job = 'yok';
      w.flags.namBonus = Number(w.flags.namBonus || 0) + 4;
      log(w, `${fullName(p)} futbolu bıraktı ve köye döndü; yanında ${sav} lira birikim ve bir dolap dolusu kupa getirdi.`, 'para');
      continue;
    }
    if (chance(w, ist ? 0.93 : 0.85)) {
      const sav = Math.round(rint(w, 30, 60) * (ist ? 35 : 100) * infl(w.m));
      w.hh.cash += sav;
      p.job = 'yok';
      p.parcel = undefined;
      log(w, `${fullName(p)} ${ist ? 'İstanbul' : 'Almanya'}'dan döndü; yanında ${sav} lira birikim getirdi.`, 'para');
    } else {
      removeFromHH(w, p);
      const sp = P(w, p.sp);
      if (alive(sp) && sp.inHH && sp.id !== w.playerId) removeFromHH(w, sp);
      log(w, `${fullName(p)} ${ist ? 'İstanbul' : 'Almanya'}'da kalmaya karar verdi. Ailenin gurbette bir kolu oluştu.`, 'olay');
    }
  }
}
