// Aylık simülasyon adımı ve oyuncu eylemleri.
import { monthlyNews } from './news';
import { monthlyKomsu } from './komsu';
import { monthlyQuests } from './quests';
import type { JobId, LedgerLine, World } from './types';
import { chance, clamp, gauss, rint } from './rng';
import { age, alive, fullName, hhMembers, log, P } from './people';
import { JOBS, jobAllowed, defaultJob, wage } from './jobs';
import { monthlyLife } from './life';
import { generateCards, gurbetReturns, resolveCard, seasonalNotes } from './cards';
import { infl, monthOf, setBase, year } from './calendar';
import { yearlyPrices } from './market';
import { monthlyHealth } from './health';
import { monthlyHistory } from './history';
import { monthlyFamily } from './family';
import { monthlyNiyet } from './yil';
import { buySheep, monthlySuru, sheepPrice, suru, suruCap } from './suru';
import { agaIncome } from './aga';
import { ambarValue, assignWorker, CROPS, hasRuhsat, idleWage, laborNeed, monthlyAmbar, monthlyFields, sellAmbar, sow, sowableNow, staffAll, STORABLE, workersOf } from './fields';
import { monthlyCrime, RENT_CAP } from './crime';
import { monthlyLab } from './lab';
import { attackRival, lockedOut, monthlyFeud, setLock } from './feud';
import { buyCityHome, buyFac, cityEvents, FACS, facPrice, hire, homePrice, monthlyBaron, moveToCity, setFacMgr } from './baron';
import type { FacId, TechId } from './types';
import { monthlyEra, buyTech, techIncome, TECHS, techPrice } from './era';
import { mk } from './market';
import { monthlyHostility, monthlyStories } from './events';
import { monthlyGoals } from './goals';
import { DISTS, menNeeded, monthlyDistricts, takeDistrict } from './district';
import { buildRoom, canBuild, crowded, monthlyHome, roomPrice } from './home';
import { AGIL_PRICE, buildLab, buyAgil, buyRaw, cevdetPay, hamPrice, hireCevdet, labPrice, moveStash, sellProduct, unlocked } from './lab';
import { BIZ, bizManager, buyBiz, buyHouse, buyPlot, buyVehicle, housePrice, monthlyAssets, nam, setManager, vehiclePrice } from './assets';
import { landBase, offerChance, offerPrice, PLOTS, yearlyMarket } from './plots';
import type { BizId } from './types';
import type { CropId } from './types';

export const DEBT_RATE = 0.02; // ağa faizi, aylık

export const canAdvance = (w: World) => !w.over && w.cards.length === 0;

/** Bir ay ilerletir. Bekleyen kart varsa ilerlemez. */
export function advance(w: World): boolean {
  if (!canAdvance(w)) return false;
  setBase(w.y0);
  w.m++;
  if (monthOf(w.m) === 2) w.rain = clamp(gauss(w, 1, 0.2), 0.5, 1.4);

  gurbetReturns(w);
  monthlyEra(w);
  monthlyHistory(w);
  monthlyNews(w);
  monthlyCrime(w);
  monthlyHostility(w);
  if (monthOf(w.m) === 0) {
    yearlyPrices(w);
    yearlyMarket(w, nam(w));
  }
  const harvestBonus = seasonalNotes(w);
  economy(w, harvestBonus);
  growth(w);
  monthlyLife(w);
  monthlyFamily(w);
  monthlyNiyet(w);
  monthlyGoals(w);
  if (w.hh.cash < 0) {
    w.hh.debt += -w.hh.cash;
    w.hh.cash = 0;
  }
  if (w.over) return true;
  generateCards(w);
  return true;
}

const JOBWORD: Partial<Record<JobId, string>> = { tarla: 'gündelik', coban: 'çobanlık', insaat: 'inşaat', cirak: 'çıraklık', usta: 'demircilik', tuccar: 'tüccar yanında' };

function economy(w: World, harvestBonus: number) {
  const mem = hhMembers(w);
  const lines: LedgerLine[] = [];
  const cash0 = w.hh.cash;
  for (const p of mem) {
    if (p.away === 'gurbet') {
      const ist = w.flags['gyer' + p.id] === 'ist';
      const v = Math.round(rint(w, 25, 40) * (ist ? 4 : 10) * infl(w.m)); // her ay gelen mark ya da havale
      w.hh.cash += v;
      lines.push({ t: `${p.first}: ${ist ? 'İstanbul' : 'Almanya'}'dan gelen para`, v });
      continue;
    }
    if (p.away) continue;
    if (lockedOut(w, p)) continue;
    let pay = p.job === 'kendi' ? idleWage(w, p) : wage(w, p);
    if (pay && (p.job === 'tarla' || p.job === 'kendi')) pay += harvestBonus;
    if (pay) {
      w.hh.cash += pay;
      lines.push({ t: `${p.first}: ${p.job === 'kendi' ? 'boş ayda gündelik' : JOBWORD[p.job] ?? JOBS[p.job].ad}`, v: pay });
    }
  }

  monthlyFields(w, lines);
  monthlyAmbar(w);
  monthlySuru(w, lines);
  monthlyKomsu(w, lines);
  monthlyQuests(w, lines);
  {
    const ag = agaIncome(w);
    if (ag) {
      w.hh.cash += ag;
      lines.push({ t: 'Ağalık: düğün, su sırası, hakemlik payı', v: ag });
    }
  }
  techIncome(w, lines);
  monthlyHealth(w);
  monthlyAssets(w, lines);
  monthlyHome(w, lines);
  monthlyLab(w, lines);
  monthlyFeud(w, lines);
  monthlyBaron(w, lines);
  monthlyDistricts(w, lines);
  monthlyStories(w, lines);
  cityEvents(w);

  let food = 0;
  let housework = false;
  let sick = 0;
  let school = 0;
  for (const p of mem) {
    if (p.away) continue;
    const a = age(w, p);
    food += a >= 12 ? 74 : 37;
    if (p.job === 'okul') school += 10;
    if (p.job === 'ev' && a >= 12) housework = true;
    if (p.sick) sick += 15;
  }
  if (housework) food -= 45;
  const k = infl(w.m) * (w.flags.sertKis === year(w.m) && monthOf(w.m) <= 1 ? 1.3 : 1);
  const exp: LedgerLine[] = [
    { t: `Mutfak ve ev (${mem.filter((p) => !p.away).length} boğaz)${housework ? ', ev işleriyle' : ''}`, v: -Math.round(food * k) },
  ];
  if (w.hh.house === 0 && w.hh.rent > 0) exp.push({ t: 'Ağaya ev kirası', v: -Math.round(Math.min(w.hh.rent, RENT_CAP) * infl(w.m)) });
  if (school) exp.push({ t: 'Okul masrafı', v: -Math.round(school * k) });
  if (sick) exp.push({ t: 'Hasta bakımı', v: -Math.round(sick * k) });
  // Borç büyüdükçe ağa haciz yapar; tefeci faizi yine de sonsuz büyümez
  const limit = 9000 * infl(w.m);
  if (w.hh.debt > limit) seize(w);
  const bonded = w.hh.debt > limit && !w.hh.parcels.length && !Object.values(w.hh.veh).some((n) => (n || 0) > 0);
  const interest = bonded ? 0 : Math.round(w.hh.debt * (w.hh.debt > limit ? DEBT_RATE / 2 : DEBT_RATE));
  if (bonded) {
    // Borç köleliği: kazancın üçte biri doğrudan ağaya gider, faiz işlemez
    const g = Math.round(lines.filter((l) => l.v > 0).reduce((a, l) => a + l.v, 0) / 3);
    if (g > 0) {
      w.hh.cash -= g;
      w.hh.debt = Math.max(0, w.hh.debt - g);
      lines.push({ t: 'Ağa kazancın üçte birini borca saydı', v: -g });
    }
  }
  if (interest) {
    w.hh.debt += interest;
    exp.push({ t: 'Borcun faizi (borca eklendi)', v: -interest });
  }
  for (const e of exp) {
    if (e.t.startsWith('Borcun')) continue;
    w.hh.cash += e.v;
  }
  lines.push(...exp);
  w.lines = lines;
  w.lastIncome = lines.filter((l) => l.v > 0).reduce((a, l) => a + l.v, 0);
  w.lastExpense = -lines.filter((l) => l.v < 0).reduce((a, l) => a + l.v, 0);
  void cash0;

  if (w.hh.cash < 0) {
    const need = -w.hh.cash;
    w.hh.debt += need;
    w.hh.cash = 0;
    lines.push({ t: 'Ağadan alınan borç', v: need });
    if (!w.flags.borcUyari || (w.flags.borcUyari as number) < w.m - 12) {
      w.flags.borcUyari = w.m;
      log(w, `Para yetmedi; ağadan ${need} lira daha borç alındı. Toplam borç ${w.hh.debt} lira.`, 'para');
    }
  }
}

function growth(w: World) {
  const poor = w.hh.debt > 3000;
  for (const p of Object.values(w.people)) {
    if (!alive(p)) continue;
    const a = age(w, p);
    // Sağlık: yaşa göre taban değere doğru yavaşça döner
    const base = a < 35 ? 90 : Math.max(25, 90 - (a - 35) * 1.1);
    p.hp += (base - p.hp) * 0.04;
    if (p.inHH && poor) p.hp -= 0.6;
    if (p.sick) {
      p.hp -= 2.5;
      p.sick--;
      if (p.sick <= 0) p.sick = undefined;
    }
    p.hp = clamp(p.hp, 1, 100);

    if (!p.inHH || p.away) continue;
    const d = JOBS[p.job];
    if (d?.skill && d.gain) {
      const cur = p.sk[d.skill];
      const g = 0.5 * d.gain * (0.55 + p.tr.zeka / 10) * (1 - cur / 110);
      p.sk[d.skill] = clamp(cur + g, 0, 100);
    }
    if (p.job === 'okul') {
      p.sk.ticaret = clamp(p.sk.ticaret + 0.25 * (0.5 + p.tr.zeka / 10) * (Number(w.flags.okulBonus || 0) > w.m ? 1.5 : 1), 0, 30);
      p.sk.zanaat = clamp(p.sk.zanaat + 0.15, 0, 30);
    }
    if (p.job === 'cirak' && p.sk.zanaat >= 55) {
      p.job = 'usta';
      log(w, `${fullName(p)} demircilikte ustalaştı.`, 'is');
    }
  }
}

// ---------- Oyuncu eylemleri ----------

export function setJob(w: World, pid: string, job: JobId): boolean {
  const p = P(w, pid);
  if (!alive(p) || !p.inHH || p.away) return false;
  if (!jobAllowed(w, p, job)) return false;
  if (job === 'isletme') {
    const b = (Object.keys(w.hh.biz) as BizId[]).find((x) => w.hh.biz[x] && !bizManager(w, x));
    if (!b) return false;
    return setManager(w, b, pid);
  }
  if (job === 'kendi') {
    // En çok işçiye ihtiyaç duyan parsele gönder
    const best = [...w.hh.parcels].sort((a, b) => workersOf(w, a).length - workersOf(w, b).length)[0];
    if (!best) return false;
    return assignWorker(w, pid, best.id);
  }
  p.job = job;
  p.parcel = undefined;
  p.biz = undefined;
  return true;
}

export function setHeir(w: World, pid: string | null): boolean {
  if (pid === null) {
    w.heirId = null;
    return true;
  }
  const p = P(w, pid);
  if (!alive(p) || !p.blood || p.id === w.playerId) return false;
  w.heirId = p.id;
  log(w, `${fullName(p)} varis olarak belirlendi.`, 'miras');
  return true;
}

export function payDebt(w: World, amount: number): number {
  const a = Math.max(0, Math.min(Math.floor(amount), w.hh.cash, w.hh.debt));
  w.hh.cash -= a;
  w.hh.debt -= a;
  if (a > 0 && w.hh.debt === 0) log(w, `Ağaya olan bütün borç ödendi.`, 'para');
  return a;
}

export { resolveCard };

/** Kayıt için: World düz JSON mu? */
export function isPlainJSON(x: unknown): boolean {
  if (x === null) return true;
  const t = typeof x;
  if (t === 'number') return Number.isFinite(x as number);
  if (t === 'string' || t === 'boolean') return true;
  if (t === 'undefined') return true;
  if (Array.isArray(x)) return x.every(isPlainJSON);
  if (t === 'object') return Object.getPrototypeOf(x) === Object.prototype && Object.values(x as object).every(isPlainJSON);
  return false;
}

/** Ekransız testler ve otomatik oyun için basit karar verici. */
export function botTurn(w: World) {
  let guard = 0;
  while (w.cards.length && guard++ < 10) {
    const c = w.cards[0];
    let k = c.opts[0].k;
    if (c.id === 'hastalik' && c.data?.cures) {
      const cs = (c.data.cures as [string, number, number][]).filter((x) => x[1] <= Math.max(0, w.hh.cash) * 0.4).sort((a, b) => b[2] - a[2]);
      k = cs[0]?.[0] ?? 'ev';
    }
    if (c.id === 'gurbet') k = chance(w, 0.5) ? 'gonder' : 'kalsin';
    if (c.id === 'kacakci') k = chance(w, 0.5) ? 'evet' : 'hayir';
    if (c.id === 'hashas_hasat') k = c.opts[Math.min(c.opts.length - 1, chance(w, 0.6) ? 0 : 1)].k;
    if (c.id === 'aga_kiz') k = chance(w, 0.5) ? 'ver' : 'ret';
    if (c.id.startsWith('meslek:')) {
      const want = defaultJob(w, P(w, c.pid)!);
      k = (c.opts.find((o) => o.k === want) ?? c.opts[0]).k;
    }
    if (c.id.startsWith('ev:') || c.id.startsWith('hi:') || c.id.startsWith('q:') || c.id.startsWith('km_') || c.id.startsWith('nw_') || c.id.startsWith('fa_') || c.id.startsWith('kmt') || c.id.startsWith('rk_') || c.id.startsWith('ce_') || c.id === 'plan_hashas' || c.id === 'ruhsat_red') {
      const cheap = c.opts.filter((o) => !/\(\d/.test(o.t) && !/lira\)/.test(o.t));
      const pool = w.hh.cash > 20000 * infl(w.m) ? c.opts : cheap.length ? cheap : c.opts;
      k = pool[Math.floor(rint(w, 0, pool.length - 1))].k;
    } else if (c.id === 'mah_esnaf' || c.id === 'donusum' || c.id === 'cete' || c.id === 'riza_taht' || c.id === 'kan' || c.id === 'kacirma' || c.id === 'sinir' || c.id === 'ayri_ev' || c.id === 'cevdet_ihanet') k = c.opts[Math.floor(rint(w, 0, c.opts.length - 1))].k;
    resolveCard(w, c.uid, k);
  }
  botFields(w);
  botEstate(w);
  const pl = P(w, w.playerId);
  if (alive(pl) && age(w, pl) >= 38 && !alive(P(w, w.heirId))) {
    const kid = pl.kids.map((k) => w.people[k]).filter(alive).sort((a, b) => a.b - b.b)[0];
    if (kid) w.heirId = kid.id;
  }
  if (w.hh.debt > 0 && w.hh.cash > 500) payDebt(w, w.hh.cash - 400);
}

function botFields(w: World) {
  if (w.hh.parcels.length >= 2) w.flags.ambarla = true;
  for (const c of STORABLE) {
    const v = ambarValue(w, c);
    if (v > 0 && (mk(w, c) >= 1.1 || w.hh.cash < 300 * infl(w.m) || monthOf(w.m) === 11 && mk(w, c) >= 0.95)) sellAmbar(w, c);
  }
  const now = sowableNow(w);
  for (const f of w.hh.parcels) {
    if (!f.crop && now.length) {
      const pref: CropId[] = hasRuhsat(w) ? ['hashas', 'pancar', 'bugday', 'nohut', 'arpa'] : ['pancar', 'bugday', 'nohut', 'arpa'];
      const c = pref.find((x) => now.includes(x) && CROPS[x].seed * infl(w.m) < w.hh.cash);
      if (c) sow(w, f.id, c);
    }
    if (f.crop && workersOf(w, f).length < CROPS[f.crop].need) {
      const cand = hhMembers(w).filter((q) => !q.away && q.job === 'tarla' && age(w, q) >= 14 && age(w, q) <= 60)[0];
      if (cand) assignWorker(w, cand.id, f.id);
    }
    if (!f.crop && laborNeed(w, f) === 0) {
      for (const q of Object.values(w.people)) {
      if (q.job === 'kendi' && q.parcel === f.id) {
        q.job = 'tarla';
        q.parcel = undefined;
      }
    }
    }
  }
}

function botEstate(w: World) {
  const reserve = 1500 * infl(w.m);
  if (w.hh.debt === 0) {
    const n = nam(w);
    const opts = w.plots.map((_, i) => i).filter((i) => w.plots[i].o !== 'biz' && offerChance(w, i, n) >= 0.99);
    opts.sort((a, b) => offerPrice(w, a) - offerPrice(w, b));
    if (opts.length && w.hh.cash > offerPrice(w, opts[0]) + reserve && chance(w, 0.3)) buyPlot(w, opts[0]);
  }
  if (w.hh.house < 3 && w.hh.parcels.length >= 1 && w.hh.cash > housePrice(w, w.hh.house + 1) * 1.5 + reserve) buyHouse(w);
  if (w.hh.parcels.length >= 3 && year(w.m) >= 1967 && (w.hh.veh.traktor || 0) * 3 < w.hh.parcels.length && w.hh.cash > vehiclePrice(w, 'traktor') * 1.3) buyVehicle(w, 'traktor');
  for (const b of Object.keys(BIZ) as BizId[]) {
    if (!w.hh.biz[b] && w.hh.cash > 3 * BIZ[b].price * infl(w.m)) {
      if (buyBiz(w, b).ok) {
        const m = hhMembers(w).find((q) => !q.away && q.job === 'tarla' && age(w, q) >= 18 && q.id !== w.playerId);
        if (m) setManager(w, b, m.id);
      }
    }
  }
  // Odalar
  for (const r of ['oda', 'ahir', 'samanlik', 'misafir', 'bodrum'] as const) {
    if (canBuild(w, r) === null && w.hh.cash > roomPrice(w, r) * 3 + reserve && (r !== 'oda' || crowded(w))) buildRoom(w, r);
  }
  // Kan davası: husumet çok yüksekse erkekleri eve kapat
  if (w.rival.feud >= 92 && !w.rival.lock) {
    setLock(w, true);
    w.flags.lockM = w.m;
  }
  if (w.rival.lock && (w.rival.feud < 70 || w.m - Number(w.flags.lockM || 0) > 10)) setLock(w, false);
  // Atölye
  if (!unlocked(w) && chance(w, 0.5)) {
    if (!w.hh.agil && w.hh.cash > 4 * AGIL_PRICE * infl(w.m)) buyAgil(w);
    const lvl = w.lab?.lvl || 0;
    if (w.hh.agil && lvl < 3 && w.hh.cash + w.dirty > labPrice(w, lvl + 1) * 2) buildLab(w, 'agil');
  }
  // Adamlar ve kan davası
  if (w.flags.kacakci && w.dirty > 40000 * infl(w.m) && w.gang < 12) hire(w, 1);
  if (w.rival.feud >= 80 && w.gang >= 3 && chance(w, 0.1)) attackRival(w);
  // Şehir
  if (w.city.open) {
    for (const f of Object.keys(FACS) as FacId[]) {
      if (!w.city.facs[f] && w.hh.cash > facPrice(w, f) * 1.5) {
        if (buyFac(w, f).ok) {
          const m = hhMembers(w).find((q) => !q.away && q.job === 'tarla' && age(w, q) >= 20 && q.id !== w.playerId);
          if (m) setFacMgr(w, f, m.id);
        }
      }
    }
    if (w.city.home < 2 && w.hh.cash > homePrice(w, w.city.home + 1) * 2) buyCityHome(w);
    if (w.city.home && !w.city.moved && Object.keys(w.city.facs).length >= 2) moveToCity(w, true);
    if (w.city.moved && chance(w, 0.05)) {
      const d = w.city.dist.find((x) => x.o !== 'biz' && year(w.m) >= DISTS[x.id].from && w.gang >= menNeeded(w, x));
      if (d) takeDistrict(w, d.id);
    }
  }
  if (w.lab) {
    if (!w.lab.chem && w.hh.cash + w.dirty > cevdetPay(w) * 12) hireCevdet(w, true);
    moveStash(w);
    if (w.lab.raw < 2 && w.hh.cash + w.dirty > hamPrice(w) * 6 + reserve) buyRaw(w, 3);
    if (w.lab.prod + w.lab.hap >= 4 && w.heat < 70) sellProduct(w);
  }
  for (const t of Object.keys(TECHS) as TechId[]) {
    if (!TECHS[t].auto && !w.tech[t] && year(w.m) >= TECHS[t].from && w.hh.cash > techPrice(w, t) * 5) buyTech(w, t);
  }
  if (suruCap(w) > suru(w) + 5 && w.hh.cash > sheepPrice(w) * 20 + reserve) buySheep(w, 5);
  staffAll(w);
}

/** Haciz: ağa önce taşıtı, sonra tarlayı alır; hiçbiri yoksa aile ağanın tarlasında borç için çalışır. */
function seize(w: World) {
  const ve = (['kamyon', 'otomobil', 'traktor', 'araba', 'esek'] as const).find((v) => (w.hh.veh[v] || 0) > 0);
  if (ve) {
    const val = Math.round(vehiclePrice(w, ve) * 0.5);
    w.hh.veh[ve] = (w.hh.veh[ve] || 0) - 1;
    w.hh.debt = Math.max(0, w.hh.debt - val);
    log(w, `Haciz: ağanın adamları ${ve === 'esek' ? 'eşeği' : ve === 'araba' ? 'at arabasını' : ve === 'traktor' ? 'traktörü' : ve === 'otomobil' ? 'otomobili' : 'kamyonu'} götürdü; borçtan ${val} lira düşüldü.`, 'para');
    return;
  }
  const f = [...w.hh.parcels].sort((a, b) => a.price - b.price)[0];
  if (f) {
    const i = w.plots.findIndex((x) => x.pid === f.id);
    const val = Math.round(landBase(w) * 0.6);
    for (const q of Object.values(w.people)) {
      if (q.job === 'kendi' && q.parcel === f.id) {
        q.job = 'tarla';
        q.parcel = undefined;
      }
    }
    w.hh.parcels = w.hh.parcels.filter((x) => x.id !== f.id);
    w.hh.parcels.forEach((x, k) => (x.no = k + 1));
    w.hh.land = w.hh.parcels.length * 5;
    if (i >= 0) w.plots[i] = { o: 'aga', ask: 1, sale: false, mad: 0 };
    w.hh.debt = Math.max(0, w.hh.debt - val);
    log(w, `Haciz: borç ödenemedi, ağa ${i >= 0 ? PLOTS[i].yer + ' mevkiindeki ' : ''}tarlaya el koydu. Borçtan ${val} lira düşüldü. Tapu artık ağanın.`, 'tapu');
    return;
  }
  if (!w.flags.irgatlik || Number(w.flags.irgatlik) < w.m - 24) {
    w.flags.irgatlik = w.m;
    log(w, `Borç o kadar büyüdü ki aile artık ağanın tarlasında yalnızca borcuna çalışıyor.`, 'para');
  }
}
