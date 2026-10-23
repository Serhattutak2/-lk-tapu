// Kişi yardımcıları: oluşturma, yaş, akrabalık, kronik.
import type { ChronicleEntry, Person, Sex, World } from './types';
import { clamp, gauss, pick, rint } from './rng';
import { FEMALE, MALE, SURNAMES } from './names';

export const P = (w: World, id: string | undefined | null): Person | undefined => (id ? w.people[id] : undefined);
export const alive = (p: Person | undefined): p is Person => !!p && p.d === undefined;
export const age = (w: World, p: Person) => Math.floor((w.m - p.b) / 12);
export const fullName = (p: Person) => `${p.first} ${p.last}`;

export function log(w: World, t: string, k: ChronicleEntry['k']) {
  w.chronicle.push({ m: w.m, t, k });
  if (w.chronicle.length > 3000) w.chronicle.splice(0, w.chronicle.length - 3000);
}

const trait = (w: World) => clamp(Math.round(gauss(w, 5.5, 1.8)), 1, 10);

export interface NewPerson {
  sex?: Sex;
  b: number;
  last?: string;
  first?: string;
  blood: boolean;
  inHH: boolean;
  fa?: string;
  mo?: string;
}

export function makePerson(w: World, o: NewPerson): Person {
  const sex: Sex = o.sex ?? (rint(w, 0, 1) ? 'E' : 'K');
  const fa = P(w, o.fa);
  const mo = P(w, o.mo);
  const tr = { zeka: trait(w), beden: trait(w), hirs: trait(w), uyum: trait(w) };
  // Kalıtım: ebeveynlerin ortalamasına doğru çekilir
  if (fa && mo) {
    for (const k of ['zeka', 'beden', 'hirs', 'uyum'] as const) {
      tr[k] = clamp(Math.round((tr[k] + (fa.tr[k] + mo.tr[k]) / 2) / 2 + gauss(w, 0, 0.8)), 1, 10);
    }
  }
  const id = 'p' + w.nextId++;
  const p: Person = {
    id,
    first: o.first ?? pick(w, sex === 'E' ? MALE : FEMALE),
    last: o.last ?? pick(w, SURNAMES),
    sex,
    b: o.b,
    fa: o.fa,
    mo: o.mo,
    kids: [],
    blood: o.blood,
    inHH: o.inHH,
    hp: clamp(Math.round(gauss(w, 85, 8)), 50, 100),
    tr,
    sk: { tarim: 0, insaat: 0, zanaat: 0, ticaret: 0 },
    job: 'yok',
    rel: clamp(Math.round(gauss(w, 30, 20)), -40, 90),
  };
  w.people[id] = p;
  if (fa) fa.kids.push(id);
  if (mo) mo.kids.push(id);
  if (o.inHH) w.hh.members.push(id);
  return p;
}

/** Kişiye yaşına göre birikmiş beceri verir (oyun başındaki yetişkinler için). */
export function seedSkills(w: World, p: Person, main: keyof Person['sk'], years: number) {
  p.sk[main] = clamp(Math.round(years * 3 + gauss(w, 0, 6)), 0, 75);
  for (const k of Object.keys(p.sk) as (keyof Person['sk'])[]) {
    if (k !== main) p.sk[k] = clamp(Math.round(years * 0.6 + gauss(w, 0, 3)), 0, 30);
  }
}

export function hhMembers(w: World): Person[] {
  return w.hh.members.map((id) => w.people[id]).filter(alive);
}

export function removeFromHH(w: World, p: Person) {
  p.inHH = false;
  w.hh.members = w.hh.members.filter((x) => x !== p.id);
}

export function addToHH(w: World, p: Person) {
  if (!p.inHH) {
    p.inHH = true;
    w.hh.members.push(p.id);
  }
}

/** Oyuncunun kontrol edebileceği yaşayan kan bağı akrabalar. */
export function bloodLiving(w: World): Person[] {
  return Object.values(w.people).filter((p) => p.blood && alive(p));
}

export function relationTo(w: World, from: Person, to: Person): string {
  if (from.id === to.id) return 'Kendisi';
  if (from.sp === to.id) return to.sex === 'E' ? 'Eşi' : 'Eşi';
  if (from.fa === to.id) return 'Babası';
  if (from.mo === to.id) return 'Annesi';
  if (from.kids.includes(to.id)) return to.sex === 'E' ? 'Oğlu' : 'Kızı';
  const sameParent = (from.fa && from.fa === to.fa) || (from.mo && from.mo === to.mo);
  if (sameParent) return to.sex === 'E' ? 'Erkek kardeşi' : 'Kız kardeşi';
  const grand = [P(w, from.fa), P(w, from.mo)].filter(Boolean) as Person[];
  if (grand.some((g) => g.fa === to.id || g.mo === to.id)) return to.sex === 'E' ? 'Dedesi' : 'Ninesi';
  if (from.kids.some((k) => w.people[k]?.kids.includes(to.id))) return 'Torunu';
  if (from.kids.some((k) => w.people[k]?.sp === to.id)) return to.sex === 'E' ? 'Damadı' : 'Gelini';
  const sib = Object.values(w.people).filter(
    (s) => s.id !== from.id && ((from.fa && s.fa === from.fa) || (from.mo && s.mo === from.mo)),
  );
  if (sib.some((s) => s.kids.includes(to.id))) return 'Yeğeni';
  if (sib.some((s) => s.sp === to.id)) return to.sex === 'E' ? 'Eniştesi' : 'Yengesi';
  const sp = P(w, from.sp);
  if (sp && (sp.fa === to.id || sp.mo === to.id)) return to.sex === 'E' ? 'Kayınpederi' : 'Kayınvalidesi';
  return to.blood ? 'Akrabası' : 'Hısımı';
}
