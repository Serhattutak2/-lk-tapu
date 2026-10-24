// Hikâye zincirleri: yıllara yayılan, adım adım ilerleyen olaylar. Durum düz bayraklarda tutulur:
// q_<id> = adım (0 yok, -1 bitti), q_<id>_m = sonraki adımın en erken ayı.
import type { World } from './types';
import { chance, clamp, pick, rint } from './rng';
import { addToHH, age, alive, bloodLiving, fullName, hhMembers, log, P } from './people';
import { infl, monthOf, year } from './calendar';
import { pushCard } from './cards';
import { newParcel } from './fields';
import { PLOTS, plotPrice } from './plots';
import { addHatir, hatir } from './komsu';

import { due, fmt, L, nb, setStep, step } from './qutil';
import type { Quest } from './qutil';
import { monthlyQuests2, QUESTS2 } from './quests2';

const hamzaPlot = (w: World) => PLOTS.findIndex((p, i) => p.owner === 'Deli Hamza' && w.plots[i]?.o === 'koy' && !w.flags['sahip' + i]);
function giftPlot(w: World, i: number, why: string) {
  const first = w.hh.parcels.length === 0;
  const par = newParcel(w, 0);
  w.plots[i] = { o: 'biz', pid: par.id, ask: 1, sale: false, mad: 0 };
  if (first) w.flags.ilkTapu = w.m;
  log(w, `${first ? 'İLK TAPU: ' : ''}${PLOTS[i].yer} mevkiindeki 5 dönüm ${why}`, 'tapu');
}

const BASE: Quest[] = [
  {
    id: 'vasiyet',
    ad: 'Deli Hamza\'nın vasiyeti',
    start: (w) => year(w.m) >= 1927 && year(w.m) <= 1965 && hamzaPlot(w) >= 0 && hatir(w, 'hamza') >= 0 && chance(w, 0.012),
    steps: {
      1: () => ({
        text: `Deli Hamza yaşlandı. Kahvede herkesle kavga eden adam artık kapısının önünde güneşleniyor. Bir akşam seni çağırdı: "Kimim kimsem yok. Son günlerimde bana bakan, yemeğimi getiren aileye tarlamı bırakırım. Vasiyetimi muhtara yazdırırım."`,
        opts: [{ t: 'Ona bakalım; her ay yemeği, odunu bizden', k: 'bak' }, { t: 'Bu yük bize ağır', k: 'hayir' }],
      }),
      2: (w) => {
        const i = hamzaPlot(w);
        return {
          data: { i },
          text: i >= 0
            ? `Deli Hamza bu sabah gözlerini açmadı. Muhtar vasiyeti okudu: "Köy kenarındaki tarlam, bana yıllarca bakan ${w.surname} ailesinindir." Ama cenazeye şehirden bir yeğen geldi ve tarlaya göz dikti: "Bu vasiyet geçersiz, mahkemeye gideriz."`
            : `Deli Hamza öldü. Tarlası çoktan elden çıkmıştı; sana bir tespih ve "hakkını helal et" diyen bir mektup bıraktı.`,
          opts: i >= 0
            ? [{ t: `Mahkemeye git (${fmt(L(w, 800))} lira avukat)`, k: 'mahkeme' }, { t: `Yeğene yarı fiyatını ver (${fmt(Math.round(plotPrice(w, i) * 0.45))} lira)`, k: 'pay' }, { t: 'Kavga etmeyelim, yeğenin olsun', k: 'birak' }]
            : [{ t: 'Allah rahmet eylesin', k: 'ok' }],
        };
      },
    },
    res: (w, s, k, _p, d) => {
      if (s === 1) {
        if (k === 'bak') {
          w.flags.hamzaBakim = true;
          addHatir(w, 'hamza', 30);
          setStep(w, 'vasiyet', 2, rint(w, 24, 60));
          log(w, `Deli Hamza'ya bakılmaya başlandı. Köyde "bunlar kimsesize sahip çıktı" deniyor.`, 'olay');
        } else setStep(w, 'vasiyet', -1);
        return;
      }
      w.flags.hamzaBakim = false;
      setStep(w, 'vasiyet', -1);
      const i = Number(d.i ?? -1);
      if (i < 0) return;
      if (k === 'mahkeme') {
        w.hh.cash -= L(w, 800);
        if (chance(w, 0.7)) giftPlot(w, i, `Deli Hamza'nın vasiyetiyle ${w.surname} ailesine geçti. Mahkeme vasiyeti onadı.`);
        else log(w, `Mahkeme vasiyeti geçersiz saydı; tarla yeğene kaldı.`, 'olay');
      } else if (k === 'pay') {
        const c = Math.round(plotPrice(w, i) * 0.45);
        w.hh.cash -= c;
        giftPlot(w, i, `Deli Hamza'nın vasiyetiyle ve yeğene ${fmt(c)} lira verilerek ${w.surname} ailesine geçti.`);
      } else {
        nb(w, 3);
        w.flags['sahip' + i] = 'Hamza\'nın yeğeni';
        w.plots[i].sale = true;
        log(w, `Tarla yeğene bırakıldı. Köyde "hırs göstermediler" dendi; yeğen tarlayı satışa çıkardı.`, 'olay');
      }
    },
  },
  {
    id: 'kup',
    ad: 'Ahlatın dibindeki küp',
    start: (w) => year(w.m) <= 1985 && (!!w.flags.q_kup_ok || chance(w, 0.0015)),
    steps: {
      1: () => ({
        text: `Kör Veli, yıllar önce dağdan inen bir eşkıyanın ağa düzündeki yaşlı ahlat ağacının dibine bir küp gömdüğünü anlattı. "Kimse inanmadı," dedi, "ama ben o gece kürek sesini duydum."`,
        opts: [{ t: 'Ay karanlığında gidip kazalım', k: 'kaz' }, { t: 'Masal bunlar', k: 'yok' }],
      }),
      2: (w) => {
        const r = chance(w, 0.25) ? 'altin' : chance(w, 0.6) ? 'testi' : 'yakalandi';
        return {
          data: { r },
          text: r === 'altin'
            ? `Kürek bir şeye çarptı: ağzı mühürlü bir küp. İçinde fener ışığında parlayan Osmanlı altınları. Kalbin göğsünden çıkacak.`
            : r === 'testi'
              ? `Sabaha kadar kazıldı: kırık bir testi, paslı bir hançer ve birkaç bakır sikke. Kör Veli'nin hikâyesi yarı yarıya doğruymuş.`
              : `Tam küreği vururken fener ışığı yüzüne vurdu: ağanın bekçisi. "Ağanın toprağında ne arıyorsunuz?"`,
          opts: r === 'altin'
            ? [{ t: `Kuyumcuya bozdur (~${fmt(L(w, 9000))} lira)`, k: 'boz' }, { t: 'Yastık altında sakla, kimse bilmesin', k: 'sakla' }, { t: 'Yarısını köy okuluna ver', k: 'hayir' }]
            : r === 'testi'
              ? [{ t: 'Hançeri duvara as', k: 'as' }]
              : [{ t: `Bekçinin ağzını kapat (${fmt(L(w, 300))} lira)`, k: 'rusvet' }, { t: 'Kaç!', k: 'kac' }],
        };
      },
    },
    res: (w, s, k, _p, d) => {
      if (s === 1) {
        if (k === 'kaz') setStep(w, 'kup', 2, 1);
        else setStep(w, 'kup', -1);
        return;
      }
      setStep(w, 'kup', -1);
      if (d.r === 'altin') {
        if (k === 'boz') {
          w.hh.cash += L(w, 9000);
          w.heat = clamp(w.heat + 6, 0, 100);
          log(w, `Küpteki altınlar bozduruldu: ${fmt(L(w, 9000))} lira. Kuyumcu çenesini tutamadı; köyde "define bulmuşlar" deniyor.`, 'para');
        } else if (k === 'sakla') {
          w.dirty += L(w, 9500);
          log(w, `Altınlar yastık altına girdi. Kara kasada ${fmt(L(w, 9500))} lira değerinde sessiz bir servet var.`, 'para');
        } else {
          w.hh.cash += L(w, 4500);
          nb(w, 8);
          log(w, `Altınların yarısıyla köy okuluna yeni bir sınıf yapıldı. Kör Veli'nin hikâyesi artık bir destan.`, 'olay');
        }
        addHatir(w, 'veli', 20);
      } else if (d.r === 'testi') {
        w.hh.cash += L(w, 300);
        nb(w, 1);
      } else if (k === 'rusvet') {
        w.hh.cash -= L(w, 300);
      } else {
        w.heat = clamp(w.heat + 8, 0, 100);
        nb(w, -2);
        log(w, `Ağanın bekçisi yüzleri tanıdı; köyde "define avcısı" diye gülüyorlar.`, 'olay');
      }
    },
  },
  {
    id: 'ogretmen',
    ad: 'Öğretmen Nazmiye',
    start: (w) => year(w.m) >= 1932 && year(w.m) <= 1956 && hhMembers(w).some((p) => age(w, p) >= 6 && age(w, p) <= 13) && chance(w, 0.01),
    steps: {
      1: (w) => ({
        text: `Köye Ankara'dan genç bir öğretmen geldi: Nazmiye Hanım. Okulun tek odası soğuk, kalacak bir yeri yok; muhtar kimseye diyemiyor. Köyde "genç kız tek başına olmaz" diye fısıldayanlar var.`,
        opts: [{ t: `Evimizde misafir edelim (${fmt(L(w, 150))} lira)`, k: 'misafir' }, { t: 'Muhtar baksın', k: 'yok' }],
      }),
      2: (w) => {
        const c = hhMembers(w).filter((p) => age(w, p) >= 7 && age(w, p) <= 15).sort((a, b) => b.tr.zeka - a.tr.zeka)[0];
        if (!c) return null;
        return {
          pid: c.id,
          text: `Nazmiye Hanım akşamları ${c.first}'i (${age(w, c)}) gaz lambasının altında çalıştırıyor. "Bu çocukta bir şey var," diyor, "şehirde okusa doktor olur."`,
          opts: [{ t: `Teşekkür et, ona bir kilim dokut (${fmt(L(w, 200))} lira)`, k: 'kilim' }, { t: 'Çocuk tarlada lazım', k: 'tarla' }],
        };
      },
      3: () => ({
        text: `Nazmiye Hanım'ın doğuya tayini çıktı. Okulun çocukları ağlıyor. Köyde kimi "iyi ki gidiyor" diyor, kimi Ankara'ya dilekçe yazmak istiyor.`,
        opts: [{ t: 'Köyce imza topla, kalsın', k: 'imza' }, { t: 'Hakkını helal et, yolcu et', k: 'yolcu' }],
      }),
    },
    res: (w, s, k, pid) => {
      if (s === 1) {
        if (k === 'misafir') {
          w.hh.cash -= L(w, 150);
          nb(w, 2);
          for (const p of hhMembers(w)) if (age(w, p) < 16) p.rel = clamp(p.rel + 5, -100, 100);
          setStep(w, 'ogretmen', 2, rint(w, 10, 24));
        } else setStep(w, 'ogretmen', -1);
        return;
      }
      if (s === 2) {
        const c = P(w, pid);
        if (k === 'kilim') {
          w.hh.cash -= L(w, 200);
          if (alive(c)) {
            c.tr.zeka = clamp(c.tr.zeka + 1, 1, 10);
            c.sk.ticaret = clamp(c.sk.ticaret + 12, 0, 100);
            c.rel = clamp(c.rel + 10, -100, 100);
          }
          setStep(w, 'ogretmen', 3, rint(w, 24, 48));
        } else {
          if (alive(c)) c.rel = clamp(c.rel - 20, -100, 100);
          setStep(w, 'ogretmen', -1);
        }
        return;
      }
      setStep(w, 'ogretmen', -1);
      if (k === 'imza' && chance(w, 0.55)) {
        w.flags.okulBonus = w.m + 120;
        nb(w, 3);
        addHatir(w, 'rifat', 8);
        log(w, `Dilekçe Ankara'ya ulaştı; Nazmiye Hanım kaldı. Okuldaki çocuklar on yıl boyunca daha hızlı öğrenecek.`, 'olay');
      } else {
        nb(w, 1);
        log(w, `Nazmiye Hanım bavuluyla köyden ayrıldı. Yıllarca bayramlarda mektup geldi.`, 'olay');
      }
    },
  },
  {
    id: 'mektup',
    ad: 'Uzaktaki akraba',
    start: (w) => bloodLiving(w).some((p) => !p.inHH && !p.away && age(w, p) >= 20 && age(w, p) <= 60) && chance(w, 0.004),
    steps: {
      1: (w) => {
        const r = pick(w, bloodLiving(w).filter((p) => !p.inHH && !p.away && age(w, p) >= 20 && age(w, p) <= 60));
        if (!r) return null;
        const yer = pick(w, ['İstanbul', 'Ankara', 'İzmir', 'Adana']);
        return {
          pid: r.id,
          data: { yer },
          text: `${fullName(r)}'den ${yer}'dan mektup geldi. Satırlar eğri büğrü: "İşler kötü gitti, ev sahibi kapıya koyacak. ${fmt(L(w, 1200))} lira gönderebilirseniz çocuklarım sokakta kalmaz."`,
          opts: [{ t: 'Parayı gönder', k: 'gonder' }, { t: 'Gel, köye dön, kapımız açık', k: 'gel' }, { t: 'Herkes kendi yükünü taşır', k: 'yok' }],
        };
      },
      2: (w) => ({
        text: `${String(w.flags.q_mektup_ad || 'Akraban')} yıllar sonra kapına geldi; üstü başı düzgün, elinde hediyeler. "O gün siz olmasaydınız..." Şehirde iş kurmuş, borcunu kat kat ödemek istiyor.`,
        opts: [{ t: 'Kabul et', k: 'al' }, { t: 'Akrabadan para alınmaz; çocuklara harçlık olsun', k: 'hayir' }],
      }),
    },
    res: (w, s, k, pid) => {
      const r = P(w, pid);
      if (s === 1) {
        if (k === 'gonder') {
          w.hh.cash -= L(w, 1200);
          if (r) w.flags.q_mektup_ad = fullName(r);
          setStep(w, 'mektup', chance(w, 0.65) ? 2 : -1, rint(w, 30, 72));
          if (r) r.rel = clamp(r.rel + 30, -100, 100);
        } else if (k === 'gel' && alive(r)) {
          addToHH(w, r);
          r.job = 'tarla';
          r.rel = clamp(r.rel + 25, -100, 100);
          setStep(w, 'mektup', -1);
          log(w, `${fullName(r)} köye, baba ocağına döndü.`, 'olay');
        } else {
          if (r) r.rel = clamp(r.rel - 30, -100, 100);
          setStep(w, 'mektup', -1);
        }
        return;
      }
      setStep(w, 'mektup', -1);
      if (k === 'al') {
        w.hh.cash += L(w, 6000);
        log(w, `Şehirdeki akraba eski borcunu kat kat ödedi: ${fmt(L(w, 6000))} lira.`, 'para');
      } else {
        nb(w, 2);
        for (const p of hhMembers(w)) if (age(w, p) < 16) p.rel = clamp(p.rel + 6, -100, 100);
      }
    },
  },
  {
    id: 'kopru',
    ad: 'Dere köprüsü',
    start: (w) => year(w.m) >= 1930 && year(w.m) <= 2000 && chance(w, 0.003),
    steps: {
      1: (w) => ({
        text: `Bahar selleri dere üstündeki tahta köprüyü götürdü. Pazar yolu kapandı; hasta kasabaya, buğday değirmene gidemiyor. Devlete dilekçe yazıldı ama "sıra gelir" denildi.`,
        opts: [{ t: `Taş köprüyü biz yaptıralım (${fmt(L(w, 6000))} lira)`, k: 'yap' }, { t: 'Köyce para toplansın, payımızı verelim', k: 'pay' }, { t: 'Devlet yapsın', k: 'yok' }],
      }),
      2: (w) => ({
        text: `Taş köprü açıldı. Ustalar son taşa ailenin adını kazıdı; köyde artık herkes ona "${w.surname} Köprüsü" diyor.`,
        opts: [{ t: 'Kurban kes, açılışı yap', k: 'ok' }],
      }),
    },
    res: (w, s, k) => {
      if (s === 1) {
        if (k === 'yap') {
          w.hh.cash -= L(w, 6000);
          setStep(w, 'kopru', 2, 6);
        } else if (k === 'pay') {
          w.hh.cash -= L(w, 900);
          nb(w, 1);
          setStep(w, 'kopru', -1);
        } else setStep(w, 'kopru', -1);
        return;
      }
      setStep(w, 'kopru', -1);
      w.flags.kopru = true;
      nb(w, 7);
      addHatir(w, 'rifat', 10);
    },
  },
  {
    id: 'film',
    ad: 'Köyde film',
    start: (w) => year(w.m) >= 1962 && year(w.m) <= 1982 && chance(w, 0.004),
    steps: {
      1: () => ({
        text: `İstanbul'dan bir film ekibi geldi: siyah beyaz bir köy filmi çekecekler. Jeneratörler, kameralar, beyaz kravatlı bir yönetmen. Senin evini ve avlunu istiyorlar; bir de "köylü genç" rolü için oyuncu arıyorlar.`,
        opts: [{ t: 'Ev de bizden, genç de', k: 'evet' }, { t: 'Sadece evi kiralayalım', k: 'ev' }, { t: 'Bizim evde çalgı çengi olmaz', k: 'yok' }],
      }),
    },
    res: (w, _s, k) => {
      setStep(w, 'film', -1);
      if (k === 'yok') return;
      w.hh.cash += L(w, 2500);
      nb(w, 2);
      if (k === 'evet') {
        const g = hhMembers(w).find((p) => p.blood && age(w, p) >= 16 && age(w, p) <= 26);
        if (g) {
          g.rel = clamp(g.rel + 15, -100, 100);
          w.flags['filmci' + g.id] = true;
          nb(w, 3);
          log(w, `${fullName(g)} filmde oynadı. Film kasabanın sinemasında gösterildi; bütün köy bir kamyona doluşup izlemeye gitti.`, 'olay');
          return;
        }
      }
      log(w, `Film ekibi bir ay avluda çekim yaptı; kira parası iyi geldi.`, 'para');
    },
  },
  {
    id: 'tren',
    ad: 'Demiryolu',
    start: (w) => year(w.m) >= 1930 && year(w.m) <= 1938 && chance(w, 0.02),
    steps: {
      1: () => ({
        text: `Demiryolu köyün iki saat ötesinden geçecek. Mühendisler, çadırlar, dinamit sesleri. İnşaatta amele aranıyor; gündelik tarladakinin iki katı.`,
        opts: [{ t: 'Gençler demiryoluna çalışsın', k: 'evet' }, { t: 'Tarla bekler', k: 'yok' }],
      }),
    },
    res: (w, _s, k) => {
      setStep(w, 'tren', -1);
      if (k !== 'evet') return;
      w.flags.tren = w.m + 18;
      for (const p of hhMembers(w)) if (p.blood && p.sex === 'E' && p.job === 'tarla' && age(w, p) >= 16 && age(w, p) <= 35 && p.id !== w.playerId) p.job = 'insaat';
      log(w, `Ailenin gençleri demiryolu inşaatında çalışıyor. Bir buçuk yıl boyunca inşaat gündeliği iki kat.`, 'is');
    },
  },
];
export const QUESTS: Quest[] = [...BASE, ...QUESTS2];
const QMAP = Object.fromEntries(QUESTS.map((q) => [q.id, q]));

export function questCards(w: World): boolean {
  for (const q of QUESTS) {
    const s = step(w, q.id);
    if (s < 0) continue;
    if (s === 0) {
      if (!q.start(w)) continue;
      const b = q.steps[1](w);
      if (!b) continue;
      setStep(w, q.id, 1);
      pushCard(w, { id: `q:${q.id}:1`, pid: b.pid, text: b.text, opts: b.opts, data: b.data });
      return true;
    }
    if (due(w, q.id) && q.steps[s]) {
      const b = q.steps[s](w);
      if (!b) {
        setStep(w, q.id, -1);
        continue;
      }
      w.flags['q_' + q.id + '_m'] = w.m + 9999; // kart çözülene kadar tekrar gelmesin
      pushCard(w, { id: `q:${q.id}:${s}`, pid: b.pid, text: b.text, opts: b.opts, data: b.data });
      return true;
    }
  }
  return false;
}

export function resolveQuest(w: World, id: string, k: string, pid: string | undefined, d: Record<string, unknown> | undefined): boolean {
  if (!id.startsWith('q:')) return false;
  const [, qid, s] = id.split(':');
  QMAP[qid]?.res(w, Number(s), k, pid, d ?? {});
  return true;
}

/** Süren hikâyeler (Kronik sekmesi için) */
export const activeQuests = (w: World) => QUESTS.filter((q) => step(w, q.id) > 0).map((q) => q.ad);
export const doneQuests = (w: World) => QUESTS.filter((q) => step(w, q.id) < 0).map((q) => q.ad);

/** Aylık: Deli Hamza'nın bakımı, demiryolu gündeliği */
export function monthlyQuests(w: World, lines: { t: string; v: number }[]) {
  monthlyQuests2(w, lines);
  if (w.flags.hamzaBakim) {
    const c = L(w, 35);
    w.hh.cash -= c;
    lines.push({ t: 'Deli Hamza\'nın yemeği ve odunu', v: -c });
  }
  void monthOf;
}
