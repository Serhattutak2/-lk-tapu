// Aylık simülasyon adımı ve oyuncu eylemleri.
import type { JobId, LedgerLine, World } from './types';
import { chance, clamp, gauss, rint } from './rng';
import { age, alive, fullName, hhMembers, log, P } from './people';
import { JOBS, jobAllowed, wage } from './jobs';
import { monthlyLife } from './life';
import { generateCards, gurbetReturns, resolveCard, seasonalNotes } from './cards';
import { infl, monthOf, year } from './calendar';
import { assignWorker, CROPS, hasRuhsat, idleWage, laborNeed, monthlyFields, sow, sowableNow, workersOf } from './fields';
import { monthlyCrime } from './crime';
import type { CropId } from './types';

export const DEBT_RATE = 0.02; // ağa faizi, aylık

export const canAdvance = (w: World) => !w.over && w.cards.length === 0;

/** Bir ay ilerletir. Bekleyen kart varsa ilerlemez. */
export function advance(w: World): boolean {
  if (!canAdvance(w)) return false;
  w.m++;
  if (monthOf(w.m) === 2) w.rain = clamp(gauss(w, 1, 0.2), 0.5, 1.4);

  gurbetReturns(w);
  monthlyCrime(w);
  const harvestBonus = seasonalNotes(w);
  economy(w, harvestBonus);
  growth(w);
  monthlyLife(w);
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
      const v = Math.round(rint(w, 25, 40) * 10 * infl(w.m)); // her ay gelen mark
      w.hh.cash += v;
      lines.push({ t: `${p.first}: Almanya'dan gelen para`, v });
      continue;
    }
    if (p.away) continue;
    let pay = p.job === 'kendi' ? idleWage(w, p) : wage(w, p);
    if (pay && (p.job === 'tarla' || p.job === 'kendi')) pay += harvestBonus;
    if (pay) {
      w.hh.cash += pay;
      lines.push({ t: `${p.first}: ${p.job === 'kendi' ? 'boş ayda gündelik' : JOBWORD[p.job] ?? JOBS[p.job].ad}`, v: pay });
    }
  }

  monthlyFields(w, lines);

  let food = 0;
  let housework = false;
  let sick = 0;
  let school = 0;
  for (const p of mem) {
    if (p.away) continue;
    const a = age(w, p);
    food += a >= 12 ? 70 : 35;
    if (p.job === 'okul') school += 10;
    if (p.job === 'ev' && a >= 12) housework = true;
    if (p.sick) sick += 15;
  }
  if (housework) food -= 45;
  const k = infl(w.m) * (w.flags.sertKis === year(w.m) && monthOf(w.m) <= 1 ? 1.3 : 1);
  const exp: LedgerLine[] = [
    { t: `Mutfak ve ev (${mem.filter((p) => !p.away).length} boğaz)${housework ? ', ev işleriyle' : ''}`, v: -Math.round(food * k) },
    { t: 'Ağaya ev kirası', v: -Math.round(w.hh.rent * infl(w.m)) },
  ];
  if (school) exp.push({ t: 'Okul masrafı', v: -Math.round(school * k) });
  if (sick) exp.push({ t: 'Hasta bakımı', v: -Math.round(sick * k) });
  const interest = Math.round(w.hh.debt * DEBT_RATE);
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
      p.sk.ticaret = clamp(p.sk.ticaret + 0.25 * (0.5 + p.tr.zeka / 10), 0, 30);
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
  if (job === 'kendi') {
    // En çok işçiye ihtiyaç duyan parsele gönder
    const best = [...w.hh.parcels].sort((a, b) => workersOf(w, a).length - workersOf(w, b).length)[0];
    if (!best) return false;
    return assignWorker(w, pid, best.id);
  }
  p.job = job;
  p.parcel = undefined;
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
    if (c.id === 'hastalik') k = w.hh.cash > 250 ? 'doktor' : 'bekle';
    if (c.id === 'gurbet') k = chance(w, 0.5) ? 'gonder' : 'kalsin';
    if (c.id === 'kacakci') k = chance(w, 0.5) ? 'evet' : 'hayir';
    if (c.id === 'hashas_hasat') k = c.opts[Math.min(c.opts.length - 1, chance(w, 0.6) ? 0 : 1)].k;
    if (c.id === 'aga_kiz') k = chance(w, 0.5) ? 'ver' : 'ret';
    resolveCard(w, c.uid, k);
  }
  botFields(w);
  const pl = P(w, w.playerId);
  if (alive(pl) && age(w, pl) >= 38 && !alive(P(w, w.heirId))) {
    const kid = pl.kids.map((k) => w.people[k]).filter(alive).sort((a, b) => a.b - b.b)[0];
    if (kid) w.heirId = kid.id;
  }
  if (w.hh.debt > 0 && w.hh.cash > 500) payDebt(w, w.hh.cash - 400);
}

function botFields(w: World) {
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
      for (const q of workersOf(w, f)) assignWorker(w, q.id, null);
    }
  }
}
