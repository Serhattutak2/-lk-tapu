// Ölüm, veraset, evlilik, doğum ve aile kollarının ayrılması.
import type { Person, World } from './types';
import { chance, clamp, gauss, pick, rint } from './rng';
import { FEMALE, MALE, SURNAMES } from './names';
import { addToHH, age, alive, bloodLiving, fullName, hhMembers, log, makePerson, P, removeFromHH } from './people';
import { defaultJob, JOBS } from './jobs';
import { year } from './calendar';
import { pushCard } from './cards';
import { hasDoctor } from './events';
import { eraMortality } from './health';

/** Yıllık ölüm olasılığı (1960'lar Anadolu'su, biraz yumuşatılmış). */
export function yearlyMortality(a: number): number {
  if (a < 1) return 0.06;
  if (a < 5) return 0.008;
  if (a < 15) return 0.0015;
  return Math.min(0.6, 0.00028 * Math.exp(0.088 * a));
}

export function monthlyDeathChance(w: World, p: Person): number {
  const q = yearlyMortality(age(w, p));
  let mult = clamp(1 + (65 - p.hp) / 18, 0.4, 6);
  if (p.sick && p.inHH && (w.hh.veh?.otomobil || 0) > 0) mult *= 0.6;
  if (p.inHH && hasDoctor(w)) mult *= 0.75;
  mult *= eraMortality(w, p);
  return (1 - Math.pow(1 - q, 1 / 12)) * mult;
}

export function die(w: World, p: Person, cause: string) {
  if (!alive(p)) return;
  p.d = w.m;
  p.cause = cause;
  p.sick = undefined;
  const wasPlayer = p.id === w.playerId;
  if (p.inHH) removeFromHH(w, p);
  if (p.blood || p.inHH || p.id === w.playerId) {
    log(w, `${fullName(p)} ${age(w, p)} yaşında öldü (${cause}).`, 'olum');
  }
  if (p.id === w.heirId) {
    w.heirId = null;
    if (!wasPlayer) log(w, `Belirlenen varis artık yok. Yeni bir varis seçilmeli.`, 'miras');
  }
  if (wasPlayer) succeed(w, p);
}

/** Oyuncu karakter öldüğünde kontrol kime geçer? */
export function succeed(w: World, dead: Person) {
  const heirs = bloodLiving(w);
  if (heirs.length === 0) {
    w.over = { m: w.m, reason: `${w.surname} hanedanının yaşayan son ferdi de öldü. Ocak söndü.` };
    log(w, w.over.reason, 'son');
    return;
  }
  const heir = P(w, w.heirId);
  if (alive(heir)) {
    const loss = Math.round(Math.max(0, w.hh.cash) * 0.12);
    w.hh.cash -= loss;
    setPlayer(w, heir);
    log(w, `${fullName(dead)} vasiyetine göre aileyi ${fullName(heir)} devraldı. Diğer mirasçılara ${loss} lira pay verildi.`, 'miras');
    return;
  }
  // Varis yok: veraset krizi
  const cands = successionCandidates(w, dead).slice(0, 3);
  w.flags.interregnum = true;
  pushCard(w, {
    id: 'veraset',
    pid: dead.id,
    text: `${fullName(dead)} varis belirlemeden öldü. Aile kimin etrafında toplanacak? Seçilmeyenler küsebilir, mirasın bir kısmı dağılacak.`,
    opts: cands.map((c) => ({ t: `${fullName(c)} (${age(w, c)}, ${heirLabel(w, dead, c)})`, k: c.id })),
  });
}

function heirLabel(w: World, dead: Person, c: Person): string {
  if (dead.kids.includes(c.id)) return c.sex === 'E' ? 'oğlu' : 'kızı';
  if ((dead.fa && dead.fa === c.fa) || (dead.mo && dead.mo === c.mo)) return 'kardeşi';
  if (dead.kids.some((k) => w.people[k]?.kids.includes(c.id))) return 'torunu';
  return 'akrabası';
}

export function successionCandidates(w: World, dead: Person): Person[] {
  const score = (c: Person) => {
    const a = age(w, c);
    let s = 0;
    if (dead.kids.includes(c.id)) s += 40;
    if (c.inHH) s += 15;
    if (a >= 18) s += 30;
    else if (a >= 14) s += 10;
    s += Math.min(a, 45) * 0.3;
    s += (c.sk.tarim + c.sk.insaat + c.sk.zanaat + c.sk.ticaret) / 10;
    s += c.rel / 5;
    if (c.away) s -= 10;
    return s;
  };
  return bloodLiving(w).sort((a, b) => score(b) - score(a));
}

export function setPlayer(w: World, p: Person) {
  w.playerId = p.id;
  w.heirId = null;
  w.flags.interregnum = false;
  w.flags.nesil = ((w.flags.nesil as number) || 1) + 1;
  p.rel = 100;
  if (p.away) {
    p.away = undefined;
    p.awayUntil = undefined;
  }
  if (!p.inHH) {
    addToHH(w, p);
    const sp = P(w, p.sp);
    if (alive(sp)) addToHH(w, sp);
    for (const k of p.kids) {
      const c = w.people[k];
      if (alive(c) && age(w, c) < 18) addToHH(w, c);
    }
    log(w, `${fullName(p)} ailesiyle birlikte baba ocağına döndü.`, 'miras');
  }
  if (age(w, p) < 16) log(w, `${fullName(p)} henüz ${age(w, p)} yaşında; büyüyene kadar aileyi büyükleri idare edecek.`, 'miras');
}

export function resolveSuccession(w: World, chosenId: string) {
  const c = P(w, chosenId);
  if (!alive(c)) return;
  const loss = Math.round(Math.max(0, w.hh.cash) * 0.35);
  w.hh.cash -= loss;
  setPlayer(w, c);
  log(w, `Veraset krizi: aile ${fullName(c)} etrafında toplandı ama mirasın ${loss} lirası paylaşım kavgasında dağıldı.`, 'miras');
  // Küsenler
  for (const o of bloodLiving(w)) {
    if (o.id === c.id) continue;
    if (age(w, o) >= 18) o.rel = clamp(o.rel - 25, -100, 100);
  }
  const angry = hhMembers(w).filter((o) => o.blood && o.id !== c.id && age(w, o) >= 20 && o.rel < 10);
  if (angry.length && chance(w, 0.6)) splitBranch(w, angry[0], 'mirastan küsüp');
}

/** Bir aile üyesi kendi evini açar: eşi ve küçük çocuklarıyla haneden ayrılır. */
export function splitBranch(w: World, p: Person, why: string) {
  const take = Math.round(Math.max(0, w.hh.cash) * 0.1);
  w.hh.cash -= take;
  removeFromHH(w, p);
  const sp = P(w, p.sp);
  if (alive(sp) && sp.inHH) removeFromHH(w, sp);
  for (const k of p.kids) {
    const c = w.people[k];
    if (alive(c) && c.inHH && c.id !== w.playerId && c.id !== w.heirId) removeFromHH(w, c);
  }
  log(w, `${fullName(p)} ${why} ayrı ev açtı${take ? `; yanında ${take} lira götürdü` : ''}. Ailenin yeni bir kolu doğdu.`, 'olay');
}

export function marry(w: World, p: Person, spouse: Person) {
  p.sp = spouse.id;
  spouse.sp = p.id;
  // Kadın erkeğin hanesine gelin gider; oyuncu ve varis her zaman evde kalır.
  const keepHome = p.id === w.playerId || p.id === w.heirId || p.sex === 'E';
  if (p.inHH && keepHome) addToHH(w, spouse);
  else if (p.inHH) removeFromHH(w, p);
  if (spouse.inHH && !p.inHH) removeFromHH(w, spouse);
  if (spouse.inHH && spouse.job === 'yok') spouse.job = defaultJob(w, spouse);
}

export function makeSpouseFor(w: World, p: Person, inHH: boolean): Person {
  const sex = p.sex === 'E' ? 'K' : 'E';
  const pa = age(w, p);
  const sa = clamp(sex === 'K' ? pa - rint(w, 0, 6) : pa + rint(w, 0, 6), 16, 70);
  const s = makePerson(w, { sex, b: w.m - sa * 12 - rint(w, 0, 11), blood: false, inHH, first: pick(w, sex === 'E' ? MALE : FEMALE), last: sex === 'E' ? pick(w, SURNAMES) : pick(w, SURNAMES) });
  s.sk.tarim = clamp(Math.round(sa * 1.5 + gauss(w, 0, 6)), 0, 70);
  return s;
}

export function monthlyLife(w: World) {
  const people = Object.values(w.people).filter(alive);

  // Ölümler
  for (const p of people) {
    if (!alive(p)) continue;
    if (chance(w, monthlyDeathChance(w, p))) {
      const a = age(w, p);
      const cause = a < 5 ? 'çocuk hastalığı' : p.sick ? 'hastalık' : a >= 65 ? 'yaşlılık' : pick(w, ['hastalık', 'kalp', 'verem', 'hastalık']);
      die(w, p, cause);
      if (w.over) return;
      continue;
    }
    const risk = p.inHH && !p.away ? jobRisk(p) : 0;
    if (risk && chance(w, risk)) {
      if (chance(w, 0.35)) {
        die(w, p, 'iş kazası');
        if (w.over) return;
      } else {
        p.hp = clamp(p.hp - rint(w, 15, 30), 5, 100);
        p.sick = rint(w, 2, 4);
        log(w, `${fullName(p)} işte kaza geçirdi, bir süre çalışamayacak.`, 'olay');
      }
    }
  }

  // Evlilikler (oyuncu dışındaki kan bağı akrabalar; oyuncunun evliliği karttan gelir)
  for (const p of Object.values(w.people)) {
    if (!alive(p) || !p.blood || p.id === w.playerId || p.away) continue;
    if (alive(P(w, p.sp))) continue;
    if (!isNear(w, p)) continue;
    if (p.sp) continue; // dullar şimdilik yeniden evlenmez
    const a = age(w, p);
    const lo = p.sex === 'K' ? 17 : 19;
    if (a < lo || a > 35) continue;
    if (chance(w, 0.022)) {
      const s = makeSpouseFor(w, p, false);
      const wasIn = p.inHH;
      marry(w, p, s);
      if (wasIn || p.inHH) {
        log(w, `${fullName(p)}, ${fullName(s)} ile evlendi.${!p.inHH ? ' Gelin gitti.' : ''}`, 'evlilik');
        const cost = rint(w, 150, 300);
        if (wasIn) {
          w.hh.cash -= cost;
        }
      }
    }
  }

  // Doğumlar
  for (const mo of Object.values(w.people)) {
    if (!alive(mo) || mo.sex !== 'K') continue;
    const fa = P(w, mo.sp);
    if (!alive(fa)) continue;
    if (!mo.blood && !fa.blood) continue;
    if (!isNear(w, mo) && !isNear(w, fa)) continue;
    if (mo.away || fa.away) continue;
    const a = age(w, mo);
    if (a < 17 || a > 42) continue;
    const living = mo.kids.filter((k) => alive(w.people[k])).length;
    const youngest = mo.kids.map((k) => w.people[k]).filter(Boolean).reduce((mx, c) => Math.max(mx, c.b), -9999);
    if (w.m - youngest < 15) continue;
    const pr = living >= 5 ? 0.006 : living >= 3 ? 0.014 : 0.024;
    if (chance(w, pr)) {
      const c = makePerson(w, { b: w.m, last: fa.last, blood: true, inHH: mo.inHH, fa: fa.id, mo: mo.id });
      c.hp = clamp(c.hp, 60, 95);
      if (mo.inHH || fa.id === w.playerId) log(w, `${fullName(mo)} ile ${fullName(fa)}'nın ${c.sex === 'E' ? 'bir oğlu' : 'bir kızı'} oldu: ${c.first}.`, 'dogum');
    }
  }

  // Aile kolları artık kendiliğinden ayrılmaz; ayrılmak isteyen kart ile sorar (home.ts).

  // Büyüyen çocuklar işe başlar
  for (const p of hhMembers(w)) {
    const a = age(w, p);
    if (p.job === 'okul' && a > 15) p.job = defaultJob(w, p);
    if (p.job === 'yok' && a >= 7 && a <= 66 && !p.sick) p.job = defaultJob(w, p);
  }
}

/** a, b'nin atası mı? */
export function isAncestor(w: World, a: Person, b: Person, depth = 0): boolean {
  if (depth > 8) return false;
  for (const id of [b.fa, b.mo]) {
    if (!id) continue;
    if (id === a.id) return true;
    const q = w.people[id];
    if (q && isAncestor(w, a, q, depth + 1)) return true;
  }
  return false;
}

/** Ayrıntılı simüle edilen yakın çevre: hanedekiler, onların çocukları ve oyuncunun kardeşleri. */
export function isNear(w: World, p: Person): boolean {
  if (p.inHH || p.id === w.playerId) return true;
  const fa = w.people[p.fa ?? ''];
  const mo = w.people[p.mo ?? ''];
  if ((fa && (fa.inHH || fa.id === w.playerId)) || (mo && (mo.inHH || mo.id === w.playerId))) return true;
  const sp = w.people[p.sp ?? ''];
  return !!sp && sp.inHH;
}

function jobRisk(p: Person): number {
  return JOBS[p.job]?.risk ?? 0;
}

export const yearsOf = (w: World) => year(w.m);
