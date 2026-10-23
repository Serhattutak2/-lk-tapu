// Olay kütüphanesi: çağlara, aileye, rakiplere ve şehre göre gelen hikâye kartları.
// Her olay bir tablodur; kart World'de düz veri olarak durur, sonucu bu tablodan çözülür.
import type { DistId, Person, World } from './types';
import { chance, clamp, pick, rint } from './rng';
import { age, alive, fullName, hhMembers, log, P, removeFromHH } from './people';
import { infl, monthOf, year } from './calendar';
import { pushCard } from './cards';
import { die, makeSpouseFor, marry } from './life';
import { has } from './era';
import { payDirtyFirst } from './baron';
import { attackRival, rA, rP } from './feud';
import { nam } from './assets';
import { syncTurf } from './district';

const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR');
const L = (w: World, n: number) => Math.round(n * infl(w.m));

/** Ailede avukat varsa hapis kısalır. */
export function jailYears(w: World, y: number): number {
  const av = hhMembers(w).some((p) => p.job === 'avukat' && !p.away);
  return Math.max(1, Math.round(y * (av ? 0.6 : 1)));
}
export const hasDoctor = (w: World) => hhMembers(w).some((p) => p.job === 'doktor' && !p.away);
export const hasEngineer = (w: World) => hhMembers(w).some((p) => p.job === 'muhendis' && !p.away);

const youngMen = (w: World, lo = 18, hi = 40) => hhMembers(w).filter((p) => p.blood && p.sex === 'E' && !p.away && age(w, p) >= lo && age(w, p) <= hi && p.id !== w.playerId);
const kids = (w: World) => hhMembers(w).filter((p) => p.blood && !p.away && p.id !== w.playerId);

interface Built { text: string; opts: { t: string; k: string }[]; pid?: string; data?: Record<string, unknown> }
interface Ev {
  id: string;
  from?: number;
  to?: number;
  p: number | ((w: World) => number);
  once?: boolean;
  make: (w: World) => Built | null;
  res: (w: World, k: string, pid: string | undefined, data: Record<string, unknown>) => void;
}

const EVENTS: Ev[] = [
  {
    id: 'borc_iste',
    p: 0.012,
    make: (w) => ({
      text: `Komşu ${pick(w, ['Topal Osman', 'Dul Hatice', 'Berber Sami', 'Bekçi Nuri'])} kapıya geldi: kızını evlendirecek, ${fmt(L(w, 1500))} lira borç istiyor. "Hasatta öderim" diyor.`,
      opts: [{ t: 'Ver', k: 'ver' }, { t: 'Elimde yok de', k: 'yok' }],
    }),
    res: (w, k) => {
      if (k !== 'ver') return;
      w.hh.cash -= L(w, 1500);
      if (chance(w, 0.7)) {
        w.flags.alacak = Number(w.flags.alacak || 0) + L(w, 1650);
        w.flags.namBonus = Number(w.flags.namBonus || 0) + 1;
        log(w, `Komşuya borç verildi; köyde "eli açık aile" dendi.`, 'olay');
      } else log(w, `Komşuya verilen borç bir daha geri gelmedi.`, 'olay');
    },
  },
  {
    id: 'dugun',
    p: 0.012,
    make: (w) => ({
      text: `${pick(w, ['Muhtarın oğlu', 'Ağanın yeğeni', 'Hacı Ömer\'in kızı', 'Köyün öğretmeni'])} evleniyor; bütün köy düğünde. Takı takmak lazım.`,
      opts: [{ t: `Altın tak (${fmt(L(w, 900))} lira)`, k: 'altin' }, { t: 'Gidip halay çek, yeter', k: 'git' }, { t: 'Gitme', k: 'gitme' }],
    }),
    res: (w, k) => {
      if (k === 'altin') {
        w.hh.cash -= L(w, 900);
        w.flags.namBonus = Number(w.flags.namBonus || 0) + 1;
      } else if (k === 'gitme') w.flags.namBonus = Number(w.flags.namBonus || 0) - 1;
    },
  },
  {
    id: 'kurban',
    p: (w) => (monthOf(w.m) === 6 && !w.flags['kurban' + year(w.m)] ? 0.5 : 0),
    make: (w) => {
      w.flags['kurban' + year(w.m)] = true;
      return {
        text: `Kurban Bayramı. Köyde kimin ne kestiğine bakılır.`,
        opts: [{ t: `Dana kes, etini dağıt (${fmt(L(w, 2200))} lira)`, k: 'dana' }, { t: `Koç kes (${fmt(L(w, 600))} lira)`, k: 'koc' }, { t: 'Bu yıl gücümüz yok', k: 'yok' }],
      };
    },
    res: (w, k) => {
      if (k === 'dana') {
        w.hh.cash -= L(w, 2200);
        w.flags.namBonus = Number(w.flags.namBonus || 0) + 2;
        for (const id of w.hh.members) w.people[id].rel = clamp(w.people[id].rel + 3, -100, 100);
      } else if (k === 'koc') w.hh.cash -= L(w, 600);
    },
  },
  {
    id: 'cocuk_kavga',
    p: 0.01,
    make: (w) => {
      const c = kids(w).find((p) => age(w, p) >= 8 && age(w, p) <= 15);
      if (!c) return null;
      return {
        pid: c.id,
        text: `${fullName(c)} okulda kavga etmiş; karşı çocuğun burnu kırık. Çocuğun babası kapıda, bağırıyor.`,
        opts: [{ t: 'Özür dile, doktor parasını öde', k: 'ozur' }, { t: 'Oğlumu kimse azarlayamaz', k: 'arka' }, { t: 'Çocuğa sopa', k: 'sopa' }],
      };
    },
    res: (w, k, pid) => {
      const c = P(w, pid);
      if (!alive(c)) return;
      if (k === 'ozur') w.hh.cash -= L(w, 300);
      else if (k === 'arka') {
        c.tr.hirs = clamp(c.tr.hirs + 1, 1, 10);
        c.rel = clamp(c.rel + 10, -100, 100);
        if (!w.rival.gone && chance(w, 0.3)) w.rival.feud = clamp(w.rival.feud + 8, 0, 100);
      } else {
        c.tr.uyum = clamp(c.tr.uyum + 1, 1, 10);
        c.rel = clamp(c.rel - 10, -100, 100);
      }
    },
  },
  {
    id: 'tuccar_teklif',
    p: (w) => (w.hh.parcels.some((f) => f.crop === 'bugday' || f.crop === 'pancar') ? 0.012 : 0),
    make: (w) => ({
      text: `Şehirden bir tüccar geldi: gelecek hasadını şimdiden, peşin ve ucuza almak istiyor. Peşin ${fmt(L(w, 2500))} lira; ama hasat iyi olursa zararına satmış olursun.`,
      opts: [{ t: 'Peşin parayı al', k: 'al' }, { t: 'Hasadı bekle', k: 'bekle' }],
    }),
    res: (w, k) => {
      if (k !== 'al') return;
      w.hh.cash += L(w, 2500);
      w.flags.pesin = w.m;
      for (const f of w.hh.parcels) if (f.crop === 'bugday' || f.crop === 'pancar') f.careSum *= 0.8;
      log(w, `Hasat peşin satıldı.`, 'para');
    },
  },
  {
    id: 'imece',
    p: 0.008,
    make: () => ({
      text: `Köyde imece var: yolun taşları dizilecek, okulun damı aktarılacak. Her ev bir adam gönderiyor.`,
      opts: [{ t: 'İki adam gönder', k: 'iki' }, { t: 'Para ver, adam gönderme', k: 'para' }, { t: 'İşimiz var', k: 'yok' }],
    }),
    res: (w, k) => {
      if (k === 'iki') w.flags.namBonus = Number(w.flags.namBonus || 0) + 2;
      else if (k === 'para') w.hh.cash -= L(w, 500);
      else w.flags.namBonus = Number(w.flags.namBonus || 0) - 2;
    },
  },
  {
    id: 'kiz_iste',
    p: 0.012,
    make: (w) => {
      const c = kids(w).find((p) => p.sex === 'K' && !p.sp && age(w, p) >= 18 && age(w, p) <= 26);
      if (!c) return null;
      const fam = pick(w, ['Yıldız', 'Aydın', 'Özkan', 'Tekin', 'Korkmaz', 'Şimşek']);
      const rich = chance(w, 0.4);
      return {
        pid: c.id,
        data: { fam, rich },
        text: `${fam} ailesi ${c.first}'i istemeye geldi. ${rich ? 'Varlıklı bir aile; başlık parası da veriyorlar.' : 'Fakir ama dürüst bir aile.'} ${c.first} sessiz, gözleri yerde.`,
        opts: [{ t: 'Verelim', k: 'ver' }, { t: 'Kızın fikrini sor', k: 'sor' }, { t: 'Vermeyiz', k: 'ret' }],
      };
    },
    res: (w, k, pid, d) => {
      const c = P(w, pid);
      if (!alive(c)) return;
      const give = () => {
        const s = makeSpouseFor(w, c, false);
        s.last = d.fam as string;
        marry(w, c, s);
        if (c.inHH) removeFromHH(w, c);
        if (d.rich) w.hh.cash += L(w, 2000);
        log(w, `${c.first}, ${s.first} ${s.last} ile evlendi.`, 'evlilik');
      };
      if (k === 'ver') {
        give();
        c.rel = clamp(c.rel - 10, -100, 100);
      } else if (k === 'sor') {
        if (chance(w, 0.55)) give();
        else log(w, `${c.first} "istemem" dedi; aile saygı gösterdi.`, 'olay');
        c.rel = clamp(c.rel + 15, -100, 100);
      }
    },
  },
  {
    id: 'alacak',
    p: (w) => (Number(w.flags.alacak || 0) > 0 && monthOf(w.m) === 8 ? 0.6 : 0),
    make: (w) => {
      const v = Number(w.flags.alacak);
      w.flags.alacak = 0;
      w.hh.cash += v;
      return { text: `Hasattan sonra borç verdiğin komşular geldi; ${fmt(v)} lira borcunu faiziyle ödediler.`, opts: [{ t: 'Hayırlı olsun', k: 'ok' }] };
    },
    res: () => {},
  },
  {
    id: 'asker',
    p: 0.05,
    make: (w) => {
      const c = youngMen(w, 20, 21).find((p) => !w.flags['asker' + p.id]);
      if (!c) return null;
      w.flags['asker' + c.id] = true;
      return {
        pid: c.id,
        text: `${fullName(c)} askerlik yaşına geldi; şubeden celp geldi. İki yıl evden uzak kalacak, tarlada bir çift el eksilecek.`,
        opts: [
          { t: 'Vatan borcu, gitsin', k: 'git' },
          { t: `Doktora para ver, çürük raporu al (${fmt(L(w, 2500))} lira)`, k: 'curuk' },
          { t: 'Saklayın, asker kaçağı olsun', k: 'kacak' },
        ],
      };
    },
    res: (w, k, pid) => {
      const p = P(w, pid);
      if (!alive(p)) return;
      if (k === 'git') {
        p.away = 'asker';
        p.awayUntil = w.m + 20;
        p.job = 'yok';
        p.parcel = undefined;
        p.rel = clamp(p.rel + 10, -100, 100);
        log(w, `${fullName(p)} askere uğurlandı; davullu zurnalı.`, 'olay');
      } else if (k === 'curuk') {
        payDirtyFirst(w, L(w, 2500));
        w.heat = clamp(w.heat + 3, 0, 100);
        log(w, `${fullName(p)} için çürük raporu alındı. Köyde laf oldu.`, 'olay');
      } else {
        w.heat = clamp(w.heat + 10, 0, 100);
        w.flags['kacakAsker' + p.id] = true;
        log(w, `${fullName(p)} asker kaçağı oldu; jandarma kapıya iki kez geldi.`, 'olay');
      }
    },
  },
  {
    id: 'univ',
    from: 1967,
    p: 0.04,
    make: (w) => {
      const c = kids(w).find((p) => age(w, p) >= 16 && age(w, p) <= 18 && p.tr.zeka >= 7 && !p.dip && !w.flags['univ' + p.id]);
      if (!c) return null;
      w.flags['univ' + c.id] = true;
      return {
        pid: c.id,
        text: `${fullName(c)}'in öğretmeni eve geldi: "Bu çocuk okumalı. Üniversiteyi kazanır, avukat da olur, doktor da." Şehirde dört yıl yurt ve harç parası demek.`,
        opts: [{ t: 'Okusun', k: 'evet' }, { t: 'Tarlada lazım', k: 'hayir' }],
      };
    },
    res: (w, k, pid) => {
      const p = P(w, pid);
      if (!alive(p)) return;
      if (k === 'evet') {
        p.job = 'univ';
        p.parcel = undefined;
        w.flags['okul' + p.id] = w.m;
        log(w, `${fullName(p)} üniversiteye gitti. Ailenin ilk okumuşu olacak.`, 'is');
      } else {
        p.rel = clamp(p.rel - 15, -100, 100);
        log(w, `${fullName(p)} okutulmadı; içine attı.`, 'olay');
      }
    },
  },
  {
    id: 'sel',
    p: 0.006,
    make: (w) => {
      const f = w.hh.parcels.filter((x) => x.crop);
      if (!f.length || has(w, 'sulama')) return null;
      const lost = f.slice(0, Math.max(1, Math.ceil(f.length / 3)));
      for (const x of lost) x.crop = null;
      return { text: `Dere taştı. Gece gelen sel ${lost.map((x) => x.no + '.').join(', ')} parseldeki ekini götürdü.`, opts: [{ t: 'Toprağa yeniden başla', k: 'ok' }] };
    },
    res: () => {},
  },
  {
    id: 'cekirge',
    to: 1985,
    p: 0.006,
    make: (w) => {
      if (!w.hh.parcels.some((x) => x.crop)) return null;
      return {
        text: `Ufukta kara bir bulut: çekirge sürüsü geliyor. Tarım müdürlüğünün ilacı var ama parası senden.`,
        opts: [{ t: `İlaç al (${fmt(L(w, 1200))} lira)`, k: 'ilac' }, { t: 'Dua et', k: 'dua' }],
      };
    },
    res: (w, k) => {
      if (k === 'ilac') {
        w.hh.cash -= L(w, 1200);
        log(w, `Çekirgeye karşı ilaçlama yapıldı; ekin kurtuldu.`, 'olay');
      } else {
        for (const f of w.hh.parcels) if (f.crop) f.careSum = Math.max(0, f.careSum - f.careN * 0.35);
        log(w, `Çekirge sürüsü tarlalardan geçti; ekin yarı yarıya gitti.`, 'olay');
      }
    },
  },
  {
    id: 'hirsiz',
    p: (w) => (w.hh.cash > L(w, 15000) && !has(w, 'kamera') && w.gang < 2 ? 0.01 : 0),
    make: (w) => {
      const v = Math.round(w.hh.cash * 0.12);
      w.hh.cash -= v;
      return { text: `Gece eve hırsız girdi; yüklükteki paranın ${fmt(v)} lirası gitti. Köyde kimin yaptığına dair fısıltılar var.`, opts: [{ t: 'Kapılara kilit', k: 'ok' }] };
    },
    res: () => {},
  },
  {
    id: 'secim_muhtar',
    p: (w) => (!w.city.moved && !w.pol.seat && w.m - w.pol.tried > 48 && monthOf(w.m) === 9 && year(w.m) % 5 === 0 ? 0.9 : 0),
    make: (w) => ({
      text: `Muhtarlık seçimi yaklaşıyor. Köyde "${w.surname} olsun" diyenler var. Kahve masraflarıyla, düğünlere giderek, söz vererek kampanya ${fmt(L(w, 6000))} lira tutar. Nam: ${nam(w)}.`,
      opts: [{ t: 'Aday ol', k: 'evet' }, { t: 'Bu iş bize göre değil', k: 'hayir' }],
    }),
    res: (w, k) => {
      w.pol.tried = w.m;
      if (k !== 'evet') return;
      w.hh.cash -= L(w, 6000);
      if (chance(w, clamp(0.2 + nam(w) / 100, 0.2, 0.85))) {
        w.pol.seat = 'muhtar';
        w.pol.until = w.m + 60;
        w.flags.namBonus = Number(w.flags.namBonus || 0) + 5;
        log(w, `${w.surname} ailesinden muhtar seçildi. Köyün mührü artık bizim evde.`, 'olay');
      } else log(w, `Muhtarlık seçimi kaybedildi.`, 'olay');
    },
  },
  {
    id: 'secim_belediye',
    from: 1975,
    p: (w) => (w.city.moved && w.pol.seat !== 'belediye' && w.pol.seat !== 'vekil' && w.m - w.pol.tried > 48 && monthOf(w.m) === 2 && year(w.m) % 5 === 4 ? 0.9 : 0),
    make: (w) => ({
      text: `Çukurkent belediye başkanlığı seçimi geliyor. Bir parti seni listesine almak istiyor; afiş, miting, bağış derken ${fmt(L(w, 90000))} lira gider. Kazanırsan ihaleler ve polis müdürü seninle konuşur.`,
      opts: [{ t: 'Aday ol', k: 'evet' }, { t: 'Perde arkasında kal', k: 'hayir' }],
    }),
    res: (w, k) => {
      w.pol.tried = w.m;
      if (k !== 'evet') return;
      payDirtyFirst(w, L(w, 90000));
      if (chance(w, clamp(0.15 + nam(w) / 300 + w.city.turf * 0.05, 0.15, 0.8))) {
        w.pol.seat = 'belediye';
        w.pol.until = w.m + 60;
        log(w, `Belediye başkanı seçildin. Çukurkent'in anahtarları artık senin cebinde.`, 'olay');
      } else log(w, `Belediye seçimini kaybettin.`, 'olay');
    },
  },
  {
    id: 'secim_vekil',
    from: 1983,
    p: (w) => (nam(w) >= 120 && w.pol.seat !== 'vekil' && w.m - w.pol.tried > 48 && monthOf(w.m) === 4 && year(w.m) % 4 === 3 ? 0.9 : 0),
    make: (w) => ({
      text: `Ankara'dan telefon: genel seçimde milletvekili adayı olur musun? Dokunulmazlık, bakanlarla yemek, açılan kapılar. Bedeli ${fmt(L(w, 250000))} lira ve bütün gözlerin üstünde olması.`,
      opts: [{ t: 'Aday ol', k: 'evet' }, { t: 'Siyaset bana göre değil', k: 'hayir' }],
    }),
    res: (w, k) => {
      w.pol.tried = w.m;
      if (k !== 'evet') return;
      payDirtyFirst(w, L(w, 250000));
      w.heat = clamp(w.heat + 10, 0, 100);
      if (chance(w, clamp(0.2 + nam(w) / 600, 0.2, 0.7))) {
        w.pol.seat = 'vekil';
        w.pol.until = w.m + 48;
        log(w, `Milletvekili seçildin. Artık meclis kürsüsünden konuşuyorsun; dokunulmazlık kalkanın var.`, 'olay');
      } else log(w, `Milletvekilliği seçimi kaybedildi; para Ankara'da kaldı.`, 'olay');
    },
  },
  {
    id: 'gazeteci',
    from: 1975,
    p: (w) => (w.heat >= 35 ? 0.012 : 0),
    make: (w) => ({
      text: `Bir gazeteci senin aileni araştırıyor: tapular, atölye söylentileri, kayıp adamlar. Yarın manşet olabilirsin.`,
      opts: [
        { t: `Gazetenin patronuna reklam ver (${fmt(L(w, 20000))} lira)`, k: 'para' },
        { t: 'Adamlarınla gözdağı ver', k: 'tehdit' },
        { t: 'Aldırma', k: 'yok' },
      ],
    }),
    res: (w, k) => {
      if (k === 'para') {
        payDirtyFirst(w, L(w, 20000));
        log(w, `Haber hiç çıkmadı; gazete bir sonraki sayısında senin un fabrikanı övdü.`, 'olay');
      } else if (k === 'tehdit') {
        w.heat = clamp(w.heat + 10, 0, 100);
        if (chance(w, 0.5)) log(w, `Gazeteci şehirden ayrıldı. Ama dosyası bir avukatın kasasında duruyor.`, 'olay');
        else {
          w.heat = clamp(w.heat + 15, 0, 100);
          log(w, `Tehdit haberi büyüttü: "Haşhaş ağası gazeteciyi tehdit etti" manşeti bütün ülkede okundu.`, 'olay');
        }
      } else {
        w.heat = clamp(w.heat + 15, 0, 100);
        w.flags.namBonus = Number(w.flags.namBonus || 0) - 3;
        log(w, `Gazetede ailenin adı karanlık işlerle anıldı.`, 'olay');
      }
    },
  },
  {
    id: 'kredi',
    from: 1983,
    p: (w) => (!w.flags.kredi && w.hh.parcels.length >= 2 ? 0.01 : 0),
    make: (w) => ({
      text: `Ziraat Bankası çiftçilere ucuz kredi dağıtıyor. Tarlaların teminat olursa ${fmt(L(w, 40000))} lira hemen gelir; beş yıl boyunca her ay ${fmt(L(w, 820))} lira ödersin.`,
      opts: [{ t: 'Krediyi çek', k: 'evet' }, { t: 'Borçla iş olmaz', k: 'hayir' }],
    }),
    res: (w, k) => {
      if (k !== 'evet') return;
      w.hh.cash += L(w, 40000);
      w.flags.kredi = L(w, 820);
      w.flags.krediBitis = w.m + 60;
      log(w, `Bankadan kredi çekildi.`, 'para');
    },
  },
  {
    id: 'kriz',
    p: (w) => ((year(w.m) === 1994 || year(w.m) === 2001) && !w.flags['kriz' + year(w.m)] ? 0.3 : 0),
    make: (w) => {
      w.flags['kriz' + year(w.m)] = true;
      const loss = Math.round(w.hh.cash * 0.25);
      w.hh.cash -= loss;
      w.plots.forEach((p) => {
        if (p.o === 'koy' || p.o === 'aga') {
          p.ask = 0.6;
          if (p.o === 'koy' && chance(w, 0.4)) p.sale = true;
        }
      });
      return {
        text: `Ekonomik kriz: lira bir gecede değer kaybetti, bankalar kapılarını kapattı. Kasandaki paranın ${fmt(loss)} lirası eridi. Ama borçlu köylüler tarlalarını yarı fiyatına satıyor.`,
        opts: [{ t: 'Fırsatları kolla', k: 'ok' }],
      };
    },
    res: () => {},
  },
  {
    id: 'deprem',
    p: (w) => (year(w.m) === 1999 && !w.flags.deprem ? 0.15 : 0.0004),
    make: (w) => {
      w.flags.deprem = true;
      const old = hhMembers(w).filter((p) => age(w, p) > 65 && !p.away);
      const v = old.length && chance(w, 0.4) ? pick(w, old) : undefined;
      if (v) die(w, v, 'deprem');
      const cost = L(w, 15000 * Math.max(1, w.hh.house));
      return {
        text: `Gece yer sallandı. Evin duvarları çatladı${v ? `; ${fullName(v)} enkazdan çıkarılamadı` : ''}. Onarım ${fmt(cost)} lira tutar.`,
        opts: [{ t: 'Onart', k: 'onar' }, { t: 'Böyle kalsın', k: 'kalsin' }],
        data: { cost },
      };
    },
    res: (w, k, _p, d) => {
      if (k === 'onar') w.hh.cash -= d.cost as number;
      else if (w.hh.house > 1) {
        w.hh.house--;
        log(w, `Onarılmayan ev bir kat küçüldü.`, 'olay');
      }
    },
  },
  {
    id: 'turist',
    from: 1985,
    p: (w) => (w.hh.house >= 2 && !w.flags.pansiyon ? 0.01 : 0),
    make: (w) => ({
      text: `Köye sırt çantalı Alman turistler gelmeye başladı. Taş evin bir katını pansiyon yaparsan her yaz para getirir.`,
      opts: [{ t: `Pansiyon yap (${fmt(L(w, 12000))} lira)`, k: 'evet' }, { t: 'Yabancı istemem', k: 'hayir' }],
    }),
    res: (w, k) => {
      if (k !== 'evet') return;
      w.hh.cash -= L(w, 12000);
      w.flags.pansiyon = true;
      log(w, `Evin üst katı pansiyon oldu.`, 'tapu');
    },
  },
  {
    id: 'kumar',
    from: 1975,
    p: 0.004,
    make: (w) => {
      const c = youngMen(w, 18, 45)[0];
      if (!c) return null;
      return {
        pid: c.id,
        text: `${fullName(c)} şehirde kumara dalmış; ${fmt(L(w, 18000))} lira borç takmış. Alacaklılar kapıda, "ya para ya da çocuk" diyorlar.`,
        opts: [{ t: 'Borcu öde', k: 'ode' }, { t: 'Kendi yapsın, kendi çeksin', k: 'birak' }, { t: 'Adamlarla alacaklıları sustur', k: 'sustur' }],
      };
    },
    res: (w, k, pid) => {
      const c = P(w, pid);
      if (!alive(c)) return;
      if (k === 'ode') {
        payDirtyFirst(w, L(w, 18000));
        c.rel = clamp(c.rel + 15, -100, 100);
        log(w, `${fullName(c)}'in kumar borcu ödendi.`, 'para');
      } else if (k === 'sustur' && w.gang >= 2) {
        w.heat = clamp(w.heat + 8, 0, 100);
        log(w, `Alacaklılar bir gece ziyaret edildi; bir daha kapıya gelmediler.`, 'olay');
      } else {
        if (chance(w, 0.35)) die(w, c, 'kumar borcu yüzünden');
        else {
          c.hp = clamp(c.hp - 35, 5, 100);
          c.rel = clamp(c.rel - 30, -100, 100);
          log(w, `${fullName(c)} alacaklılar tarafından dövüldü.`, 'olay');
        }
      }
    },
  },
  {
    id: 'sevda',
    p: (w) => (!w.rival.gone && w.rival.feud >= 25 ? 0.006 : 0),
    make: (w) => {
      const c = kids(w).find((p) => !p.sp && age(w, p) >= 17 && age(w, p) <= 25);
      if (!c) return null;
      return {
        pid: c.id,
        text: `${fullName(c)} gizlice ${rA(w)} biriyle sevişiyormuş. İkisi de kaçmaya hazır; iki aile arasında ya barış olacak ya kan.`,
        opts: [{ t: 'Evlensinler, barış olsun', k: 'evlen' }, { t: 'Asla, bu evlilik olmaz', k: 'yasak' }],
      };
    },
    res: (w, k, pid) => {
      const c = P(w, pid);
      if (!alive(c)) return;
      if (k === 'evlen') {
        const s = makeSpouseFor(w, c, c.sex === 'K' ? false : true);
        s.last = w.rival.name;
        marry(w, c, s);
        if (c.sex === 'K' && c.inHH) removeFromHH(w, c);
        w.rival.feud = clamp(w.rival.feud - 45, 0, 100);
        w.rival.peaceM = w.m;
        log(w, `${fullName(c)} ile ${rA(w)} ${s.first} evlendi. Düğünde iki aile aynı halayda.`, 'evlilik');
      } else {
        c.rel = clamp(c.rel - 35, -100, 100);
        w.rival.feud = clamp(w.rival.feud + 10, 0, 100);
        if (chance(w, 0.4)) {
          removeFromHH(w, c);
          log(w, `${fullName(c)} sevdiğiyle kaçtı ve bir daha eve dönmedi.`, 'olay');
        } else log(w, `${fullName(c)} sevdiğinden ayrıldı; evde sessizlik.`, 'olay');
      }
    },
  },
  {
    id: 'muhbir',
    p: (w) => (w.gang >= 5 ? 0.008 : 0),
    make: () => ({
      text: `Adamlarından biri polise bilgi taşıyor. Kim olduğunu biliyorsun; o henüz bildiğini bilmiyor.`,
      opts: [{ t: 'Ortadan kaldır', k: 'kaldir' }, { t: 'Para ver, şehirden gitsin', k: 'para' }, { t: 'Ona yanlış bilgi ver', k: 'oyun' }],
    }),
    res: (w, k) => {
      w.gang = Math.max(0, w.gang - 1);
      if (k === 'kaldir') {
        w.heat = clamp(w.heat + 12, 0, 100);
        log(w, `Muhbir bir daha görülmedi.`, 'olay');
      } else if (k === 'para') {
        payDirtyFirst(w, L(w, 15000));
        log(w, `Muhbir parasını alıp gitti; ne kadar konuştuğunu kimse bilmiyor.`, 'olay');
      } else if (chance(w, 0.5)) {
        w.heat = clamp(w.heat - 15, 0, 100);
        log(w, `Yanlış bilgiyle polis boş bir depoyu bastı; dikkat dağıldı.`, 'olay');
      } else {
        w.heat = clamp(w.heat + 20, 0, 100);
        log(w, `Oyun anlaşıldı; muhbir kaçtı ve polis daha da hırslandı.`, 'olay');
      }
    },
  },
  {
    id: 'rehine',
    p: (w) => ((w.crew && !w.crew.gone && w.crew.feud >= 40) || (!w.rival.gone && w.rival.feud >= 50) ? 0.01 : 0),
    make: (w) => {
      const pool = hhMembers(w).filter((p) => !p.away && p.id !== w.playerId && age(w, p) >= 8);
      if (!pool.length) return null;
      const v = pick(w, pool);
      const by = w.crew && !w.crew.gone && w.crew.feud >= 40 ? w.crew.name : rP(w);
      v.away = 'rehin';
      v.awayUntil = w.m + 999;
      return {
        pid: v.id,
        data: { by },
        text: `${fullName(v)} okul yolunda kaçırıldı. ${by} haber yolladı: ${fmt(L(w, 60000))} lira, yoksa bir daha göremezsin.`,
        opts: [
          { t: 'Fidyeyi öde', k: 'ode' },
          { t: w.gang >= 5 ? `Adamlarınla kurtar (${w.gang} adam)` : 'Kurtarma operasyonu (adamın az)', k: 'kurtar' },
          { t: 'Polise git', k: 'polis' },
        ],
      };
    },
    res: (w, k, pid, d) => {
      const v = P(w, pid);
      if (!alive(v)) return;
      const back = () => {
        v.away = undefined;
        v.awayUntil = undefined;
        v.job = 'yok';
      };
      if (k === 'ode') {
        payDirtyFirst(w, L(w, 60000));
        back();
        log(w, `Fidye ödendi; ${fullName(v)} bir gece köprünün altında bırakıldı.`, 'olay');
      } else if (k === 'kurtar') {
        const p = clamp(0.2 + w.gang * 0.05 + (has(w, 'cep') ? 0.1 : 0), 0.1, 0.85);
        w.heat = clamp(w.heat + 10, 0, 100);
        if (chance(w, p)) {
          back();
          w.gang = Math.max(0, w.gang - rint(w, 0, 1));
          if (w.crew && !w.crew.gone && d.by === w.crew.name) w.crew.men = Math.max(0, w.crew.men - 2);
          else w.rival.men = Math.max(0, w.rival.men - 1);
          log(w, `Gece baskınıyla ${fullName(v)} kurtarıldı. Kaçıranlar bedelini ödedi.`, 'olay');
        } else {
          die(w, v, 'rehineyken');
          log(w, `Kurtarma operasyonu başarısız oldu.`, 'olay');
        }
      } else {
        w.heat = clamp(w.heat + 15, 0, 100);
        if (chance(w, 0.45)) {
          back();
          log(w, `Polis ${fullName(v)}'i buldu. Ama artık ailenin bütün işleri de polisin dosyasında.`, 'olay');
        } else die(w, v, 'rehineyken');
      }
    },
  },
  {
    id: 'kursun',
    p: (w) => (!w.rival.gone && w.rival.feud >= 40 ? 0.012 * (w.rival.feud / 60) / (1 + w.gang * 0.15) : 0),
    make: (w) => {
      const pool = hhMembers(w).filter((p) => !p.away);
      const v = pool.length && chance(w, 0.5) ? pick(w, pool) : undefined;
      if (v) {
        v.hp = clamp(v.hp - 30, 5, 100);
        v.sick = 3;
      }
      return {
        text: `Gece evin camları kurşunlandı.${v ? ` ${fullName(v)} yaralandı.` : ' Allahtan kimse yaralanmadı.'} Duvara "${rP(w)} unutmaz" yazılmış.`,
        opts: [{ t: w.gang >= 2 ? 'Karşılığını ver' : 'Karşılık ver (adam yok)', k: 'karsilik' }, { t: 'Erkekleri eve kapat', k: 'kapat' }, { t: 'Jandarmaya şikâyet et', k: 'sikayet' }],
      };
    },
    res: (w, k) => {
      if (k === 'karsilik' && w.gang >= 2) attackRival(w);
      else if (k === 'kapat') w.rival.lock = true;
      else {
        w.heat = clamp(w.heat + 5, 0, 100);
        w.rival.feud = clamp(w.rival.feud + 5, 0, 100);
        log(w, `Şikâyet tutanağa geçti; jandarma iki aileyi de sorguladı.`, 'olay');
      }
    },
  },
  {
    id: 'zehir',
    p: (w) => (!w.rival.gone && w.rival.feud >= 30 && w.hh.rooms.ahir ? 0.008 : 0),
    make: (w) => {
      w.flags.ahirKapali = w.m + 8;
      return { text: `Ahırdaki hayvanlar bir sabah ölü bulundu; yemlerine zehir katılmış. ${rP(w)} köyde bıyık altından gülüyor.`, opts: [{ t: 'Yeni hayvan al, bekle', k: 'ok' }] };
    },
    res: () => {},
  },
  {
    id: 'soygun',
    p: (w) => (w.crew && !w.crew.gone && w.crew.feud >= 30 && w.lab && w.lab.prod + w.lab.hap > 0 ? 0.03 / (has(w, 'kamera') ? 2 : 1) : 0),
    make: (w) => {
      const n = w.lab!.prod + w.lab!.hap;
      w.lab!.prod = 0;
      w.lab!.hap = 0;
      return { text: `${w.crew!.name} atölyeden çıkan kamyonu yolda kesti; ${n} birim mal gitti, şoför hastanede.`, opts: [{ t: 'Bunun hesabını soracağız', k: 'ok' }] };
    },
    res: (w) => {
      if (w.crew) w.crew.feud = clamp(w.crew.feud + 10, 0, 100);
    },
  },
  {
    id: 'narkotik',
    from: 2005,
    p: (w) => (w.lab && w.heat >= 45 ? 0.015 : 0),
    make: (w) => ({
      text: `Narkotik şubesi aylardır seni dinliyormuş. Dosya savcılıkta; sabaha karşı geniş çaplı operasyon bekleniyor. ${w.pol.seat ? 'Makamın sana bir gece kazandırdı.' : ''}`,
      opts: [
        { t: 'Atölyeyi söküp her şeyi yok et', k: 'yok' },
        ...(w.pol.seat ? [{ t: 'Ankara\'daki dostlarını ara', k: 'dost' }] : []),
        { t: 'Hiçbir şey yapma', k: 'bekle' },
      ],
    }),
    res: (w, k) => {
      if (k === 'yok') {
        w.lab = null;
        w.heat = clamp(w.heat * 0.4, 0, 100);
        log(w, `Operasyon boşa düştü: atölye bir gecede yok edildi.`, 'olay');
      } else if (k === 'dost' && chance(w, 0.7)) {
        w.heat = clamp(w.heat * 0.5, 0, 100);
        log(w, `Bir telefonla dosya rafa kaldırıldı.`, 'olay');
      } else {
        w.heat = clamp(w.heat + 25, 0, 100);
        w.flags.operasyon = w.m;
        log(w, `Operasyon kapıda: dikkat tavan yaptı.`, 'olay');
      }
    },
  },
  {
    id: 'hayir',
    p: (w) => (nam(w) >= 30 ? 0.006 : 0),
    make: (w) => ({
      text: `Köyün imamı ve muhtarı geldi: köye ${pick(w, ['bir okul', 'bir çeşme', 'bir cami minaresi', 'bir sağlık ocağı'])} lazım. Bütün köy senden bekliyor.`,
      opts: [{ t: `Yaptır (${fmt(L(w, 25000))} lira)`, k: 'evet' }, { t: 'Devlet yapsın', k: 'hayir' }],
    }),
    res: (w, k) => {
      if (k === 'evet') {
        w.hh.cash -= L(w, 25000);
        w.flags.namBonus = Number(w.flags.namBonus || 0) + 6;
        w.heat = clamp(w.heat - 8, 0, 100);
        log(w, `Köye hayır işi yapıldı; kapısına ailenin adı yazıldı.`, 'olay');
      } else w.flags.namBonus = Number(w.flags.namBonus || 0) - 2;
    },
  },
  {
    id: 'maden',
    from: 1990,
    p: (w) => (w.hh.parcels.length >= 3 && !w.flags.maden ? 0.004 : 0),
    make: (w) => {
      w.flags.maden = true;
      const v = L(w, 14500 * 2.2);
      return { text: `Bir maden şirketi Taşlık mevkiinde mermer bulmuş. Senin bir parselin için ${fmt(v)} lira veriyorlar; piyasanın iki katı.`, opts: [{ t: 'Sat', k: 'sat' }, { t: 'Toprak satılmaz', k: 'hayir' }], data: { v } };
    },
    res: (w, k, _p, d) => {
      if (k !== 'sat') return;
      const f = w.hh.parcels[w.hh.parcels.length - 1];
      const i = w.plots.findIndex((x) => x.pid === f.id);
      for (const q of Object.values(w.people)) if (q.job === 'kendi' && q.parcel === f.id) { q.job = 'tarla'; q.parcel = undefined; }
      w.hh.parcels = w.hh.parcels.filter((x) => x.id !== f.id);
      w.hh.parcels.forEach((x, n) => (x.no = n + 1));
      w.hh.land = w.hh.parcels.length * 5;
      if (i >= 0) w.plots[i] = { o: 'koy', ask: 1, sale: false, mad: 0 };
      w.hh.cash += d.v as number;
      log(w, `Bir parsel maden şirketine satıldı: ${fmt(d.v as number)} lira.`, 'para');
    },
  },
  {
    id: 'aga_yardim',
    p: (w) => (Number(w.flags.agaKin || 0) >= year(w.m) && w.gang >= 3 ? 0.01 : 0),
    make: () => ({
      text: `Bozbey Ağa'nın küçük oğlu dağda eşkıyaların eline düşmüş. Ağa, gururunu yutup sana adam gönderdi: "Oğlumu getir, aramızdaki her şeyi unuturum."`,
      opts: [{ t: 'Adamlarını gönder', k: 'evet' }, { t: 'Ağa kendi başının çaresine baksın', k: 'hayir' }],
    }),
    res: (w, k) => {
      if (k !== 'evet') return;
      if (chance(w, 0.65)) {
        w.flags.agaKin = 0;
        w.flags.namBonus = Number(w.flags.namBonus || 0) + 8;
        w.plots.forEach((p) => {
          if (p.o === 'aga' && chance(w, 0.25)) p.sale = true;
        });
        log(w, `Ağanın oğlu kurtarıldı. Bozbey Ağa artık sana toprak satıyor ve köyde "${w.surname}'ın sözü benim sözümdür" diyor.`, 'olay');
      } else {
        w.gang = Math.max(0, w.gang - 2);
        log(w, `Dağdaki çatışmada iki adamın gitti; ağanın oğlu da kurtarılamadı.`, 'olay');
      }
    },
  },
  {
    id: 'viral',
    from: 2012,
    p: 0.005,
    make: (w) => {
      const c = kids(w).find((p) => age(w, p) >= 14 && age(w, p) <= 28);
      if (!c) return null;
      return { pid: c.id, text: `${fullName(c)} köydeki hayatı telefonla çekip internete koymuş: milyonlarca kişi izledi. Herkes ailenin konağını ve tarlalarını konuşuyor.`, opts: [{ t: 'Gurur duy', k: 'gurur' }, { t: 'Videoyu sildir, göz önünde olmayalım', k: 'sil' }] };
    },
    res: (w, k) => {
      if (k === 'gurur') {
        w.flags.namBonus = Number(w.flags.namBonus || 0) + 5;
        w.heat = clamp(w.heat + (w.lab ? 12 : 2), 0, 100);
      } else log(w, `Video silindi.`, 'olay');
    },
  },
];

const EVMAP = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

/** Her ay bir olay şansı. Kart üretildiyse true. */
export function eventCards(w: World): boolean {
  const y = year(w.m);
  for (const e of EVENTS) {
    if (e.from && y < e.from) continue;
    if (e.to && y > e.to) continue;
    if (e.once && w.flags['ev_' + e.id]) continue;
    const p = typeof e.p === 'number' ? e.p : e.p(w);
    if (p <= 0 || !chance(w, p)) continue;
    const b = e.make(w);
    if (!b) continue;
    if (e.once) w.flags['ev_' + e.id] = true;
    pushCard(w, { id: 'ev:' + e.id, pid: b.pid, text: b.text, opts: b.opts, data: b.data });
    return true;
  }
  return false;
}

export function resolveEvent(w: World, id: string, k: string, pid: string | undefined, data: Record<string, unknown> | undefined): boolean {
  if (!id.startsWith('ev:')) return false;
  const e = EVMAP[id.slice(3)];
  e?.res(w, k, pid, data ?? {});
  return true;
}

/** Aylık: askerden dönüş, üniversite, kredi taksiti, görev süreleri, ahır, pansiyon. */
export function monthlyStories(w: World, lines: { t: string; v: number }[]) {
  for (const p of Object.values(w.people)) {
    if (!alive(p)) continue;
    if (p.away === 'asker' && (p.awayUntil ?? 0) <= w.m) {
      p.away = undefined;
      p.awayUntil = undefined;
      p.job = 'tarla';
      log(w, `${fullName(p)} askerden döndü; bıyıklanmış, büyümüş.`, 'olay');
    }
    if (p.job === 'univ' && p.inHH) {
      const since = Number(w.flags['okul' + p.id] || w.m);
      if (w.m - since >= 48) {
        p.dip = p.tr.zeka >= 9 ? 'tip' : p.tr.hirs >= 6 ? 'hukuk' : 'muh';
        p.job = p.dip === 'tip' ? 'doktor' : p.dip === 'hukuk' ? 'avukat' : 'muhendis';
        w.flags.namBonus = Number(w.flags.namBonus || 0) + 3;
        log(w, `${fullName(p)} üniversiteyi bitirdi: ailenin ilk ${p.dip === 'tip' ? 'doktoru' : p.dip === 'hukuk' ? 'avukatı' : 'mühendisi'}.`, 'is');
      }
    }
  }
  const uni = hhMembers(w).filter((p) => p.job === 'univ').length;
  if (uni) {
    const c = L(w, 260) * uni;
    w.hh.cash -= c;
    lines.push({ t: `Üniversite harcı ve yurt (${uni} kişi)`, v: -c });
  }
  if (w.flags.kredi && w.m <= Number(w.flags.krediBitis || 0)) {
    const c = Number(w.flags.kredi);
    w.hh.cash -= c;
    lines.push({ t: 'Banka kredisi taksiti', v: -c });
  } else if (w.flags.kredi) w.flags.kredi = 0;
  if (w.pol.seat && w.m >= w.pol.until) {
    log(w, `${w.pol.seat === 'muhtar' ? 'Muhtarlık' : w.pol.seat === 'belediye' ? 'Belediye başkanlığı' : 'Milletvekilliği'} görevi sona erdi.`, 'olay');
    w.pol.seat = null;
  }
  if (w.flags.pansiyon && monthOf(w.m) >= 5 && monthOf(w.m) <= 8) {
    const v = L(w, 900);
    w.hh.cash += v;
    lines.push({ t: 'Pansiyon: yaz misafirleri', v });
  }
  if (w.pol.seat === 'belediye' && w.city.facs.insaat) {
    const v = L(w, 2500);
    w.hh.cash += v;
    lines.push({ t: 'Belediye ihaleleri', v });
  }
}

/** Rakiplerin kendiliğinden kızışması: büyüdükçe düşman da büyür. */
export function monthlyHostility(w: World) {
  const r = w.rival;
  if (!r.gone) {
    const grow = 0.07 + Math.min(10, w.hh.parcels.length) * 0.015 + (w.lab ? 0.12 : 0) + (nam(w) > 40 ? 0.06 : 0);
    if (w.m - r.peaceM > 24) r.feud = clamp(r.feud + grow, 0, 100);
  }
  const c = w.crew;
  if (c && !c.gone) {
    c.feud = clamp(c.feud + 0.1 + w.city.turf * 0.12 + ((w.lab?.lvl || 0) >= 2 ? 0.15 : 0), 0, 100);
    if (c.men < 6 && chance(w, 0.03)) c.men++;
    // Çete mahalle geri almaya çalışır
    if (c.feud >= 60 && chance(w, 0.01)) {
      const mine = w.city.dist.filter((d) => d.o === 'biz');
      if (mine.length) {
        const d = pick(w, mine);
        if (w.gang < 4 + c.men / 3) {
          d.o = 'cete';
          syncTurf(w);
          log(w, `${c.name} bir gece ${d.id === 'liman' ? 'Liman' : 'bir mahalleni'} geri aldı; adamların kaçmak zorunda kaldı.`, 'olay');
        } else {
          c.men = Math.max(0, c.men - 1);
          log(w, `${c.name} mahallelerinden birine saldırdı ama adamların geri püskürttü.`, 'olay');
        }
      }
    }
  }
}

export type { DistId, Person };
