// Yeni kampanya: Mart 1965, topraksız ve fakir bir köylü ailesi.
import type { World } from './types';
import { gauss, pick, rint, clamp } from './rng';
import { SURNAMES } from './names';
import { log, makePerson, seedSkills } from './people';
import { defaultJob } from './jobs';

export const VERSION = 1;
export const START_M = 2; // Mart 1965

export interface NewGameOpts {
  seed?: number;
  surname?: string;
  first?: string;
  sex?: 'E' | 'K';
}

export function newWorld(o: NewGameOpts = {}): World {
  const seed = (o.seed ?? Math.floor(Math.random() * 2 ** 31)) | 0;
  const w: World = {
    v: VERSION,
    seed,
    rng: seed,
    m: START_M,
    nextId: 1,
    nextCard: 1,
    surname: '',
    people: {},
    hh: { cash: 0, debt: 0, rent: 50, land: 0, members: [] },
    playerId: '',
    heirId: null,
    cards: [],
    chronicle: [],
    flags: {},
    rain: 1,
    lastIncome: 0,
    lastExpense: 0,
    over: null,
  };
  const surname = o.surname?.trim() || pick(w, SURNAMES);
  w.surname = surname;
  const yr = (y: number) => START_M - y * 12 - rint(w, 0, 11);

  // Büyükanne (dul), baba, anne, oyuncu ve iki kardeş
  const nine = makePerson(w, { sex: 'K', b: yr(rint(w, 62, 70)), last: surname, blood: true, inHH: true });
  const baba = makePerson(w, { sex: 'E', b: yr(rint(w, 40, 46)), last: surname, blood: true, inHH: true, mo: nine.id });
  const anne = makePerson(w, { sex: 'K', b: yr(rint(w, 35, 40)), blood: false, inHH: true });
  baba.sp = anne.id;
  anne.sp = baba.id;
  nine.cause = undefined;
  seedSkills(w, nine, 'tarim', 40);
  seedSkills(w, baba, 'tarim', 28);
  seedSkills(w, anne, 'tarim', 20);
  baba.hp = clamp(Math.round(gauss(w, 72, 8)), 55, 90); // yıllarca ağır iş
  nine.hp = clamp(Math.round(gauss(w, 62, 8)), 45, 80);

  const sex = o.sex ?? 'E';
  const oyuncu = makePerson(w, { sex, b: yr(16), last: surname, first: o.first?.trim() || undefined, blood: true, inHH: true, fa: baba.id, mo: anne.id });
  seedSkills(w, oyuncu, 'tarim', 5);
  oyuncu.rel = 100;
  makePerson(w, { b: yr(rint(w, 11, 13)), last: surname, blood: true, inHH: true, fa: baba.id, mo: anne.id });
  makePerson(w, { b: yr(rint(w, 6, 8)), last: surname, blood: true, inHH: true, fa: baba.id, mo: anne.id });

  w.playerId = oyuncu.id;
  w.flags.babaId = baba.id;
  w.hh.cash = rint(w, 120, 220);
  w.hh.debt = rint(w, 300, 600); // ağaya eski borç
  w.rain = 1;

  for (const id of w.hh.members) {
    const p = w.people[id];
    p.job = defaultJob(w, p);
  }
  nine.job = 'ev';

  log(w, `${surname} ailesi, Karaçam köyünde kirada oturdukları eski evde yaşıyor. Kendilerine ait bir karış toprakları yok; ağaya ${w.hh.debt} lira borçlular.`, 'olay');
  return w;
}
