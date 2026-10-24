// Hikâye kitabı, ikinci cilt: futbolcu torun, türkücü kız, höyükteki mühür, kooperatif, kuraklık kuyusu,
// Balkan göçmenleri, cephe arkadaşı, Almanya'dan gelin, üniversite sınavı, internetten köy ürünü,
// Pamuk adlı kuzu, köy çeşmesi, aile yadigârı.
import type { Person, World } from './types';
import { chance, clamp, pick, rint } from './rng';
import { age, alive, fullName, hhMembers, log, makePerson, P } from './people';
import { monthOf, year } from './calendar';
import { marry } from './life';
import { addHatir, KOMSULAR } from './komsu';
import { fmt, L, nb, setStep } from './qutil';
import type { Quest } from './qutil';

const kid = (w: World, lo: number, hi: number, f?: (p: Person) => boolean) =>
  hhMembers(w).filter((p) => p.blood && !p.away && p.id !== w.playerId && age(w, p) >= lo && age(w, p) <= hi && (!f || f(p)));
const bumpAll = (w: World, d: number) => KOMSULAR.forEach((k) => addHatir(w, k.id, d));

export const QUESTS2: Quest[] = [
  {
    id: 'futbol',
    ad: 'Kasaba takımının yıldızı',
    start: (w) => year(w.m) >= 1958 && year(w.m) <= 2030 && kid(w, 14, 18, (p) => p.sex === 'E' && p.tr.beden >= 6).length > 0 && chance(w, 0.008),
    steps: {
      1: (w) => {
        const p = pick(w, kid(w, 14, 18, (q) => q.sex === 'E' && q.tr.beden >= 6));
        return {
          pid: p.id,
          text: `${fullName(p)} (${age(w, p)}) harman yerinde top koşturuyor; kasaba takımının hocası maçını izlemiş. "Bu çocuğun ayağında şeytan var, takıma versenize," diyor. Hafta sonları tarlada bir el eksik olur.`,
          opts: [{ t: 'Oynasın', k: 'evet' }, { t: 'Top karın doyurmaz, tarla bekler', k: 'hayir' }],
        };
      },
      2: (w) => {
        const p = P(w, String(w.flags.q_futbol_p || ''));
        if (!alive(p) || p.away) return null;
        return {
          pid: p.id,
          text: `${p.first} kasaba takımını il şampiyonu yaptı. İstanbul'dan bir kulübün adamları kapıda: "Altyapıya alalım, maaş veririz. Tutarsa milli takıma kadar gider."`,
          opts: [{ t: 'Gitsin, şansını denesin', k: 'git' }, { t: 'İstanbul uzak, köyde kalsın', k: 'kal' }],
        };
      },
    },
    res: (w, s, k, pid) => {
      const p = P(w, pid);
      if (s === 1) {
        if (k === 'evet' && alive(p)) {
          w.flags.q_futbol_p = p.id;
          p.rel = clamp(p.rel + 15, -100, 100);
          setStep(w, 'futbol', 2, rint(w, 18, 36));
        } else {
          if (alive(p)) p.rel = clamp(p.rel - 15, -100, 100);
          setStep(w, 'futbol', -1);
        }
        return;
      }
      setStep(w, 'futbol', -1);
      if (!alive(p)) return;
      if (k === 'git') {
        if (chance(w, 0.7)) {
          p.away = 'gurbet';
          p.awayUntil = w.m + 12 * rint(w, 7, 11);
          p.job = 'yok';
          p.parcel = undefined;
          w.flags['gyer' + p.id] = 'fut';
          w.flags.futbolcu = p.id;
          nb(w, 6);
          log(w, `${fullName(p)} İstanbul'da profesyonel futbolcu oldu. Köy kahvesinde maçları radyodan dinleniyor; her golünde davul çalıyor.`, 'olay');
        } else {
          p.hp = clamp(p.hp - 15, 5, 100);
          log(w, `${p.first} denemelerde dizini sakatladı ve köye döndü. Topu bıraktı ama kasabada hâlâ "ah o diz" diye anılıyor.`, 'olay');
        }
      } else p.rel = clamp(p.rel - 25, -100, 100);
    },
  },
  {
    id: 'ses',
    ad: 'Türkücü kız',
    start: (w) => year(w.m) >= 1960 && year(w.m) <= 2005 && kid(w, 15, 22, (p) => p.sex === 'K' && !p.sp).length > 0 && chance(w, 0.006),
    steps: {
      1: (w) => {
        const p = pick(w, kid(w, 15, 22, (q) => q.sex === 'K' && !q.sp));
        return {
          pid: p.id,
          text: `Komşu köyün düğününde ${fullName(p)} (${age(w, p)}) bir uzun hava okudu; davulcu bile durdu. Düğünde bulunan bir plak şirketi adamı kartvizitini bıraktı: "İstanbul'a getirin, plak dolduralım."`,
          opts: [{ t: 'Sesi Allah vergisi; gitsin, söylesin', k: 'izin' }, { t: 'Kızımızı sahnede kimse görmez', k: 'yasak' }],
        };
      },
      2: (w) => ({
        pid: String(w.flags.q_ses_p || ''),
        text: `${String(w.flags.q_ses_ad || 'Kızın')}ın ilk plağı çıktı. Radyoda çalıyor, kasabanın plakçısında kuyruk var. Şimdi bir de Almanya'daki gurbetçilere konser turnesi teklif ediliyor.`,
        opts: [{ t: 'Turneye çıksın', k: 'turne' }, { t: 'Bir plak yeter, artık evlensin', k: 'evlen' }],
      }),
    },
    res: (w, s, k, pid) => {
      const p = P(w, pid);
      if (s === 1) {
        if (k === 'izin' && alive(p)) {
          w.flags.q_ses_p = p.id;
          w.flags.q_ses_ad = p.first;
          p.rel = clamp(p.rel + 25, -100, 100);
          setStep(w, 'ses', 2, rint(w, 10, 20));
        } else {
          if (alive(p)) p.rel = clamp(p.rel - 35, -100, 100);
          setStep(w, 'ses', -1);
        }
        return;
      }
      setStep(w, 'ses', -1);
      w.hh.cash += L(w, 3500);
      nb(w, 5);
      w.flags.sanatci = true;
      if (k === 'turne') {
        w.hh.cash += L(w, 6000);
        nb(w, 3);
        log(w, `${String(w.flags.q_ses_ad)} Almanya turnesinden döndü; salonlar dolmuş, gurbetçiler ağlamış. Ailenin adı artık plak kapaklarında.`, 'para');
      } else {
        if (alive(p)) p.rel = clamp(p.rel - 10, -100, 100);
        log(w, `${String(w.flags.q_ses_ad)} tek plakla kaldı ama o plak hâlâ her düğünde çalınıyor.`, 'olay');
      }
    },
  },
  {
    id: 'hoyuk',
    ad: 'Tarladaki höyük',
    start: (w) => year(w.m) >= 1950 && year(w.m) <= 1995 && w.hh.parcels.length >= 2 && chance(w, 0.004),
    steps: {
      1: (w) => ({
        text: `Sabanın ucu yontulmuş bir taşa takıldı. Öğretmen bakıp "bu höyük, binlerce yıllık" dedi. Ankara'dan arkeologlar geldi: tarlanın bir köşesinde iki yıl kazı yapmak istiyorlar. Devlet kira öder ama o parsel ekilemez.`,
        opts: [{ t: 'Kazıya izin ver', k: 'izin' }, { t: 'Toprağımız ekmeğimiz, olmaz', k: 'hayir' }],
      }),
      2: (w) => ({
        text: `Kazı bitti. Höyükten bir tunç çağı mührü ve sağlam bir küp çıktı; müzede "${w.surname} ailesinin tarlasında bulunmuştur" yazıyor. Profesör aileye teşekkür mektubu yolladı.`,
        opts: [{ t: 'Çocukları müzeye götür', k: 'ok' }],
      }),
    },
    res: (w, s, k) => {
      if (s === 1) {
        if (k === 'izin') {
          const f = w.hh.parcels[w.hh.parcels.length - 1];
          f.crop = null;
          f.plan = null;
          w.flags.kaziKira = w.m + 24;
          setStep(w, 'hoyuk', 2, 24);
        } else setStep(w, 'hoyuk', -1);
        return;
      }
      setStep(w, 'hoyuk', -1);
      nb(w, 7);
      w.flags.muze = true;
      w.hh.cash += L(w, 2000);
      for (const p of hhMembers(w)) if (age(w, p) < 18) p.sk.ticaret = clamp(p.sk.ticaret + 4, 0, 100);
    },
  },
  {
    id: 'koop',
    ad: 'Köy kooperatifi',
    start: (w) => year(w.m) >= 1962 && year(w.m) <= 1995 && chance(w, 0.006),
    steps: {
      1: (w) => ({
        text: `Köy Kalkınma Kooperatifi kuruluyor: ortak traktör, süt toplama, toplu satış. Köylüler başkanlığı senin üstlenmeni istiyor. Kuruluş masrafı ${fmt(L(w, 1000))} lira.`,
        opts: [{ t: 'Başkan ol', k: 'baskan' }, { t: 'Sadece üye olalım', k: 'uye' }, { t: 'Bu işler yürümez', k: 'yok' }],
      }),
      2: () => ({
        text: `Kooperatifin ilk yılı iyi geçti: süt kamyonu her sabah köye geliyor, ortak traktör tarlaları sırayla sürüyor. Şimdi kasada biriken parayla ne yapılsın?`,
        opts: [{ t: 'Soğuk hava deposu kuralım', k: 'depo' }, { t: 'Ortaklara kâr payı dağıt', k: 'dagit' }],
      }),
      3: () => ({
        text: `Kahvede fısıltılar: "Kooperatifin hesabını kimse görmüyor, başkan kendi ambarını dolduruyor." Hesaplar temiz ama söz bir kere çıktı.`,
        opts: [{ t: 'Defterleri köy meydanında herkese aç', k: 'ac' }, { t: 'Söylenti çıkaranı bul, hesap sor', k: 'hesap' }, { t: 'Başkanlığı bırak', k: 'birak' }],
      }),
    },
    res: (w, s, k) => {
      if (s === 1) {
        if (k === 'baskan') {
          w.hh.cash -= L(w, 1000);
          nb(w, 3);
          w.flags.koop = 'baskan';
          setStep(w, 'koop', 2, rint(w, 12, 20));
        } else {
          if (k === 'uye') w.flags.koop = 'uye';
          setStep(w, 'koop', -1);
        }
        return;
      }
      if (s === 2) {
        if (k === 'depo') {
          w.flags.koopDepo = true;
          log(w, `Kooperatifin soğuk hava deposu açıldı: köyün sütü, meyvesi artık bozulmadan şehre gidiyor.`, 'olay');
        } else {
          bumpAll(w, 6);
          log(w, `Kooperatif kârı ortaklara dağıtıldı; köyde bayram havası.`, 'olay');
        }
        setStep(w, 'koop', 3, rint(w, 30, 60));
        return;
      }
      setStep(w, 'koop', -1);
      if (k === 'ac') {
        nb(w, 4);
        bumpAll(w, 5);
        log(w, `Defterler meydanda okundu; tek kuruş eksik çıkmadı. Söylentiyi çıkaran köyü terk etmek zorunda kaldı.`, 'olay');
      } else if (k === 'hesap') {
        nb(w, -3);
        bumpAll(w, -4);
      } else {
        w.flags.koop = 'uye';
        log(w, `Kooperatif başkanlığı bırakıldı.`, 'olay');
      }
    },
  },
  {
    id: 'kuyu',
    ad: 'Kuraklık kuyusu',
    start: (w) => year(w.m) <= 1990 && w.rain < 0.85 && w.hh.parcels.length >= 1 && monthOf(w.m) >= 4 && monthOf(w.m) <= 7 && !w.flags.kuyu && chance(w, 0.06),
    steps: {
      1: (w) => ({
        text: `Gökte bir bulut yok; dere bir ip gibi akıyor. Kasabadan bir su arayıcısı geldi, elindeki çatal değnek tarlanın kenarında titredi: "Burada derinde su var. Kuyu açarsanız kuraklık sizi bir daha korkutmaz." Kazı ${fmt(L(w, 2500))} lira.`,
        opts: [{ t: 'Kazdır', k: 'kaz' }, { t: 'Yağmur yağar elbet', k: 'yok' }],
      }),
      2: () => ({
        text: `Kuyudan su çıktı ve kuraklığın ortasında bütün köy kova kova kapına geldi. Komşuların tarlası da yanıyor.`,
        opts: [{ t: 'Su Allah\'ın, herkes alsın', k: 'ver' }, { t: 'Sırayla, ücretiyle alsınlar', k: 'sat' }, { t: 'Önce kendi tarlamız', k: 'yok' }],
      }),
    },
    res: (w, s, k) => {
      if (s === 1) {
        if (k === 'kaz') {
          w.hh.cash -= L(w, 2500);
          if (chance(w, 0.65)) {
            w.flags.kuyu = true;
            log(w, `Kırk metrede su fışkırdı. Tarlaların artık kuraklığa yarı yarıya dayanıklı.`, 'is');
            setStep(w, 'kuyu', 2, 1);
          } else {
            log(w, `Kuyu kuru çıktı; para toprağa gömüldü.`, 'olay');
            setStep(w, 'kuyu', -1);
          }
        } else setStep(w, 'kuyu', -1);
        return;
      }
      setStep(w, 'kuyu', -1);
      if (k === 'ver') {
        bumpAll(w, 12);
        nb(w, 4);
      } else if (k === 'sat') {
        w.flags.kuyuSat = w.m + 60;
        bumpAll(w, -3);
      } else bumpAll(w, -10);
    },
  },
  {
    id: 'gocmen',
    ad: 'Balkan göçmenleri',
    start: (w) => ((year(w.m) >= 1950 && year(w.m) <= 1952) || (year(w.m) >= 1989 && year(w.m) <= 1990)) && chance(w, 0.06),
    steps: {
      1: (w) => ({
        text: `${year(w.m) < 1960 ? 'Bulgaristan\'dan' : 'Bulgaristan sınırından yeni gelen'} göçmen bir aile köye yerleştirildi: Rumeli şivesiyle konuşuyorlar, ellerinde bohçalar, çocukların ayağı çıplak. Devletin verdiği ev daha yapılmadı.`,
        opts: [{ t: 'Boş odamızı verelim, kış geçene kadar', k: 'oda' }, { t: `Erzak ve battaniye gönder (${fmt(L(w, 300))} lira)`, k: 'erzak' }, { t: 'Devlet baksın', k: 'yok' }],
      }),
      2: () => ({
        text: `Göçmen aile ayağa kalktı: kasabada bir börek ve boza dükkânı açtılar. "O kış bizi siz yaşattınız," diyorlar; dükkâna ortak olmanızı istiyorlar. Bir de oğulları senin ailenden bir kıza göz koymuş.`,
        opts: [{ t: 'Dükkâna ortak ol', k: 'ortak' }, { t: 'Dünür olalım', k: 'dunur' }, { t: 'Hayırlı olsun, karşılık beklemedik', k: 'yok' }],
      }),
    },
    res: (w, s, k) => {
      if (s === 1) {
        if (k === 'oda' || k === 'erzak') {
          if (k === 'erzak') w.hh.cash -= L(w, 300);
          nb(w, k === 'oda' ? 3 : 1);
          setStep(w, 'gocmen', 2, rint(w, 24, 60));
        } else setStep(w, 'gocmen', -1);
        return;
      }
      setStep(w, 'gocmen', -1);
      if (k === 'ortak') {
        w.flags.gocOrtak = true;
        log(w, `Göçmen ailenin börekçi dükkânına ortak olundu.`, 'para');
      } else if (k === 'dunur') {
        const g = kid(w, 17, 26, (p) => p.sex === 'K' && !p.sp)[0];
        if (g) {
          const s2 = makePerson(w, { sex: 'E', b: w.m - (age(w, g) + 2) * 12, first: pick(w, ['Hüseyin', 'Ahmet', 'İsmail', 'Recep']), last: 'Rumelili', blood: false, inHH: false });
          marry(w, g, s2);
          log(w, `${g.first} ile göçmen ailenin oğlu ${s2.first} evlendi; düğünde Rumeli havaları çalındı.`, 'evlilik');
        } else nb(w, 2);
      } else nb(w, 2);
    },
  },
  {
    id: 'cephe',
    ad: 'Cephe arkadaşı',
    start: (w) => year(w.m) >= 1926 && year(w.m) <= 1945 && chance(w, 0.006),
    steps: {
      1: () => ({
        text: `Köye bastonlu, madalyalı yaşlı bir adam geldi: emekli Binbaşı Şevket. "Babanla Sakarya'da aynı siperde yattık," dedi, gözleri doldu. Bir gece misafir olmak istiyor.`,
        opts: [{ t: 'Kuzu kes, köyün ileri gelenlerini çağır', k: 'buyuk' }, { t: 'Sade bir sofra, bol sohbet', k: 'sade' }],
      }),
      2: () => ({
        text: `Ankara'dan bir mektup: Binbaşı Şevket'in oğlu milletvekili olmuş. "Babam o geceyi hep anlatırdı. Bir işiniz düşerse kapım açık."`,
        opts: [{ t: 'Mektubu çerçevelet', k: 'ok' }],
      }),
    },
    res: (w, s, k) => {
      if (s === 1) {
        if (k === 'buyuk') {
          w.hh.cash -= L(w, 250);
          nb(w, 3);
        } else nb(w, 1);
        setStep(w, 'cephe', 2, rint(w, 120, 240));
        return;
      }
      setStep(w, 'cephe', -1);
      w.flags.ankaraDost = true;
      nb(w, 4);
      log(w, `Ankara'da bir dost: seçimlerde ve resmî işlerde kapılar daha kolay açılacak.`, 'olay');
    },
  },
  {
    id: 'gelin',
    ad: 'Almanya\'dan gelin',
    start: (w) => year(w.m) >= 1968 && year(w.m) <= 1998 && Object.values(w.people).some((p) => alive(p) && p.blood && p.away === 'gurbet' && w.flags['gyer' + p.id] === 'de' && p.sex === 'E' && !p.sp) && chance(w, 0.01),
    steps: {
      1: (w) => {
        const p = Object.values(w.people).find((q) => alive(q) && q.blood && q.away === 'gurbet' && w.flags['gyer' + q.id] === 'de' && q.sex === 'E' && !q.sp)!;
        return {
          pid: p.id,
          text: `${fullName(p)}'den mektup ve bir fotoğraf: yanında sarışın bir kız, Ingrid. "Fabrikada tanıştık, evlenmek istiyoruz. Babamın elini öpmeye köye getireceğim." Köy şimdiden dedikodu kazanı.`,
          opts: [{ t: 'Gelinimiz başımızın üstünde', k: 'evet' }, { t: 'Gâvur gelin olmaz', k: 'hayir' }],
        };
      },
    },
    res: (w, _s, k, pid) => {
      setStep(w, 'gelin', -1);
      const p = P(w, pid);
      if (!alive(p)) return;
      if (k === 'evet') {
        const s2 = makePerson(w, { sex: 'K', b: w.m - (age(w, p) - 2) * 12, first: 'Ingrid', last: 'Schneider', blood: false, inHH: false });
        marry(w, p, s2);
        p.rel = clamp(p.rel + 25, -100, 100);
        nb(w, 2);
        log(w, `${p.first} ile Ingrid köyde düğün yaptı. Ingrid halaya ilk denemesinde dizildi; köy kadınları onu bir yılda yufka açmayı öğretti.`, 'evlilik');
      } else {
        p.rel = clamp(p.rel - 40, -100, 100);
        log(w, `${p.first} Almanya'da Ingrid'le evlendi ve yıllarca köye gelmedi.`, 'olay');
      }
    },
  },
  {
    id: 'sinav',
    ad: 'Üniversite sınavı',
    start: (w) => year(w.m) >= 1975 && kid(w, 16, 18, (p) => p.tr.zeka >= 7 && !p.dip && p.job !== 'univ').length > 0 && chance(w, 0.01),
    steps: {
      1: (w) => {
        const p = pick(w, kid(w, 16, 18, (q) => q.tr.zeka >= 7 && !q.dip && q.job !== 'univ'));
        return {
          pid: p.id,
          text: `${fullName(p)} (${age(w, p)}) üniversite sınavına hazırlanıyor; geceleri lambanın altında test çözüyor. Kasabadaki dershane bir yıllık ${fmt(L(w, 2000))} lira istiyor.`,
          opts: [{ t: 'Dershaneye yazdır', k: 'dershane' }, { t: 'Kendi çalışsın, kitaplarını alalım', k: 'kendi' }, { t: 'Okuyup ne olacak, tarlada lazım', k: 'yok' }],
        };
      },
      2: (w) => ({
        pid: String(w.flags.q_sinav_p || ''),
        text: `Sınav sonuçları açıklandı. Bütün köy gazeteyi postacının elinden kaptı: ${String(w.flags.q_sinav_ad || '')}'ın adı listede ${w.flags.q_sinav_ok ? 'var! Şehirde bir üniversite kazandı.' : 'yok. Bu yıl olmadı.'}`,
        opts: w.flags.q_sinav_ok ? [{ t: 'Kurbanlar kesilsin, okusun', k: 'oku' }] : [{ t: 'Seneye tekrar dene', k: 'tekrar' }, { t: 'Kısmet değilmiş', k: 'yok' }],
      }),
    },
    res: (w, s, k, pid) => {
      const p = P(w, pid);
      if (s === 1) {
        if (k === 'yok' || !alive(p)) {
          if (alive(p)) p.rel = clamp(p.rel - 25, -100, 100);
          setStep(w, 'sinav', -1);
          return;
        }
        if (k === 'dershane') w.hh.cash -= L(w, 2000);
        else w.hh.cash -= L(w, 200);
        w.flags.q_sinav_p = p.id;
        w.flags.q_sinav_ad = p.first;
        w.flags.q_sinav_ok = chance(w, (k === 'dershane' ? 0.7 : 0.4) + (p.tr.zeka - 7) * 0.08);
        setStep(w, 'sinav', 2, rint(w, 8, 11));
        return;
      }
      setStep(w, 'sinav', -1);
      if (!alive(p)) return;
      if (k === 'oku') {
        p.job = 'univ';
        p.parcel = undefined;
        w.flags['okul' + p.id] = w.m;
        nb(w, 3);
        p.rel = clamp(p.rel + 20, -100, 100);
      } else if (k === 'tekrar') setStep(w, 'sinav', 0);
      else p.rel = clamp(p.rel - 10, -100, 100);
    },
  },
  {
    id: 'internet',
    ad: 'İnternetten köy ürünü',
    start: (w) => year(w.m) >= 2004 && kid(w, 17, 32).length > 0 && chance(w, 0.008),
    steps: {
      1: (w) => {
        const p = pick(w, kid(w, 17, 32));
        return {
          pid: p.id,
          text: `${fullName(p)} (${age(w, p)}) telefonunu uzattı: "Köyün tarhanasını, peynirini, kuru domatesini internetten satalım. Şehirli bayılıyor." Sermaye, paketleme ve fotoğraf için ${fmt(L(w, 3000))} lira lazım.`,
          opts: [{ t: 'Yap bakalım', k: 'evet' }, { t: 'Bilgisayardan ekmek çıkmaz', k: 'hayir' }],
        };
      },
      2: (w) => ({
        text: `${String(w.flags.q_net_ad || 'Torunun')}ın internet dükkânı ${w.flags.q_net_ok ? 'patladı: her gün kargo arabası köye geliyor, köyün kadınları tarhana yetiştiremiyor.' : 'tutmadı: siparişler azdı, paketler geri döndü.'}`,
        opts: [{ t: w.flags.q_net_ok ? 'Köyün kadınlarına da iş verelim' : 'Denemek de bir şey', k: 'ok' }],
      }),
    },
    res: (w, s, k, pid) => {
      const p = P(w, pid);
      if (s === 1) {
        if (k === 'evet' && alive(p)) {
          w.hh.cash -= L(w, 3000);
          w.flags.q_net_ad = p.first;
          w.flags.q_net_ok = chance(w, 0.6);
          p.rel = clamp(p.rel + 15, -100, 100);
          setStep(w, 'internet', 2, rint(w, 8, 14));
        } else {
          if (alive(p)) p.rel = clamp(p.rel - 15, -100, 100);
          setStep(w, 'internet', -1);
        }
        return;
      }
      setStep(w, 'internet', -1);
      if (w.flags.q_net_ok) {
        w.flags.eticaret = true;
        bumpAll(w, 6);
        nb(w, 3);
      }
    },
  },
  {
    id: 'kuzu',
    ad: 'Pamuk adlı kuzu',
    start: (w) => ((w.hh.suru || 0) > 0 || !!w.hh.rooms.ahir) && kid(w, 5, 11).length > 0 && chance(w, 0.004),
    steps: {
      1: (w) => {
        const p = pick(w, kid(w, 5, 11));
        return {
          pid: p.id,
          text: `${fullName(p)} (${age(w, p)}) ahırdaki kuzulardan birine "Pamuk" adını koymuş; peşinden köpek gibi geziyor, gece yatağının yanında uyuyor. Kurbanlık o kuzuydu. Çocuk gözyaşları içinde sana bakıyor.`,
          opts: [{ t: 'Pamuk kesilmez, yerine başka kurbanlık alırız', k: 'koru' }, { t: 'Adet adettir; çocuğa anlat', k: 'adet' }],
        };
      },
    },
    res: (w, _s, k, pid) => {
      setStep(w, 'kuzu', -1);
      const p = P(w, pid);
      if (!alive(p)) return;
      if (k === 'koru') {
        w.hh.cash -= L(w, 450);
        p.rel = clamp(p.rel + 25, -100, 100);
        log(w, `Pamuk kurtuldu. Yıllar sonra sürünün en yaşlı koyunu oldu; ${p.first} onu hiç unutmadı.`, 'olay');
      } else {
        p.rel = clamp(p.rel - 15, -100, 100);
        p.tr.uyum = clamp(p.tr.uyum + 1, 1, 10);
      }
    },
  },
  {
    id: 'cesme',
    ad: 'Köy çeşmesi',
    start: (w) => year(w.m) <= 2000 && chance(w, 0.003),
    steps: {
      1: (w) => ({
        text: `Meydandaki eski çeşmenin suyu kesildi; kadınlar dereye kadar testiyle iniyor. Usta, taş bir çeşme ve kaynaktan yeni bir boru hattı için ${fmt(L(w, 3200))} lira istiyor.`,
        opts: [{ t: 'Çeşmeyi biz yaptıralım, kitabesine dedemizin adı yazılsın', k: 'yap' }, { t: 'Köyce para toplansın', k: 'topla' }],
      }),
      2: (w) => ({
        text: `Yıllar geçti; ${w.surname} çeşmesinin başı köyün buluşma yeri oldu. Gelinler oradan su taşıyor, düğün alayları önünde duruyor. Bir şair onun için bir türkü bile yazmış.`,
        opts: [{ t: 'Türküyü düğünde çaldır', k: 'ok' }],
      }),
    },
    res: (w, s, k) => {
      if (s === 1) {
        if (k === 'yap') {
          w.hh.cash -= L(w, 3200);
          nb(w, 5);
          bumpAll(w, 6);
          setStep(w, 'cesme', 2, rint(w, 96, 180));
        } else {
          w.hh.cash -= L(w, 400);
          setStep(w, 'cesme', -1);
        }
        return;
      }
      setStep(w, 'cesme', -1);
      nb(w, 3);
    },
  },
  {
    id: 'yadigar',
    ad: 'Aile yadigârı',
    start: (w) => w.m >= Number(w.flags.q_yadigar_m || 0) && hhMembers(w).some((p) => p.id !== w.playerId && age(w, p) >= 74 && p.hp < 55) && chance(w, 0.02),
    steps: {
      1: (w) => {
        const e = hhMembers(w).filter((p) => p.id !== w.playerId && age(w, p) >= 74).sort((a, b) => a.hp - b.hp)[0];
        if (!e) return null;
        const kids = kid(w, 8, 30).slice(0, 3);
        return {
          pid: e.id,
          data: { kids: kids.map((k) => k.id) },
          text: `${fullName(e)} (${age(w, e)}) yatağa düştü ve seni çağırdı. Sandığın dibinden bir bohça çıkardı: içinde birkaç Reşat altını ve dedesinden kalma gümüş bir kuşak. "Altınlar ocağa. Kuşağı ise içinizde en çok kimi seviyorsam ona verin; sen seç."`,
          opts: [...kids.map((k) => ({ t: `Kuşak ${k.first}'in olsun (${age(w, k)})`, k: 'v:' + k.id })), { t: 'Kuşak sandıkta kalsın, ailenin olsun', k: 'sandik' }],
        };
      },
    },
    res: (w, _s, k, pid) => {
      setStep(w, 'yadigar', 0); // başka bir büyükte yeniden olabilir
      w.flags['q_yadigar_m'] = w.m + 120;
      const e = P(w, pid);
      w.hh.cash += L(w, 1600);
      if (k.startsWith('v:')) {
        const c = P(w, k.slice(2));
        if (alive(c)) {
          c.rel = clamp(c.rel + 25, -100, 100);
          for (const o of kid(w, 8, 30)) if (o.id !== c.id) o.rel = clamp(o.rel - 6, -100, 100);
          log(w, `${e ? e.first : 'Büyük'}'in gümüş kuşağı ${c.first}'e geçti. Sandıktan çıkan altınlar ocağa kaldı.`, 'miras');
        }
      } else {
        for (const o of kid(w, 8, 30)) o.rel = clamp(o.rel + 3, -100, 100);
        log(w, `Gümüş kuşak aile sandığına kondu; düğünlerde gelinler takacak.`, 'miras');
      }
    },
  },
  {
    id: 'asik',
    ad: 'Âşığın destanı',
    start: (w) => year(w.m) <= 1990 && chance(w, 0.004),
    steps: {
      1: (w) => ({
        text: `Sırtında sazıyla gezgin bir âşık köye geldi: Âşık Garip Ömer. Kahvede üç gece çalıp söyleyecek; dediğine göre köyün en ünlü ailesi için bir destan yakacak. Kahveci kulağına fısıldadı: "Bahşişi bol olanın destanı güzel olur."`,
        opts: [{ t: `Âşığı evinde ağırla, bahşişi bol olsun (${fmt(L(w, 300))} lira)`, k: 'bahsis' }, { t: 'Ne biliyorsa onu söylesin', k: 'yok' }],
      }),
    },
    res: (w, _s, k) => {
      setStep(w, 'asik', -1);
      const n = Number(w.flags.namBonus || 0);
      if (k === 'bahsis') {
        w.hh.cash -= L(w, 300);
        nb(w, 4);
        log(w, `Âşık Garip Ömer "${w.surname}ların Destanı"nı yaktı: gündelikçilikten toprağa, kara günlerden bugüne. Destan yıllarca düğünlerde söylendi.`, 'olay');
      } else if (n >= 5) {
        nb(w, 2);
        log(w, `Âşık bahşiş istemeden ailenin hikâyesini söyledi: "Alnının teriyle toprak alan aile." Köy dinledi, gururlandı.`, 'olay');
      } else {
        nb(w, -2);
        log(w, `Âşık kahvede taşlama söyledi: "Kesesi dolu, gönlü dar aile." Köyde günlerce güldüler.`, 'olay');
      }
    },
  },
  {
    id: 'istanbul',
    ad: 'İstanbul hayali',
    start: (w) => year(w.m) >= 1950 && year(w.m) <= 1990 && kid(w, 18, 28, (p) => p.sex === 'E' && p.id !== w.heirId).length > 0 && chance(w, 0.006),
    steps: {
      1: (w) => {
        const p = pick(w, kid(w, 18, 28, (q) => q.sex === 'E' && q.id !== w.heirId));
        return {
          pid: p.id,
          text: `${fullName(p)} (${age(w, p)}) bir akşam yemeğinde patladı: "Bu köyde ömrüm geçmeyecek. İstanbul'a gideceğim; gecekondu yaparım, fabrikada çalışırım, bir gün dükkân açarım." Herkes sana bakıyor.`,
          opts: [{ t: `Hayır duayla gönder, eline harçlık ver (${fmt(L(w, 800))} lira)`, k: 'git' }, { t: 'Baba ocağı terk edilmez', k: 'yasak' }],
        };
      },
      2: (w) => ({
        text: `İstanbul'dan haber: ${String(w.flags.q_ist_ad || 'Oğlun')} gecekondusunu yaptı, şimdi Kasımpaşa'da küçük bir tamirci dükkânı var. Köyden İstanbul'a giden herkes artık onun kapısını çalıyor; köyle şehir arasında bir köprü oldu.`,
        opts: [{ t: 'Ona köyden bir çuval bulgur, bir teneke yağ gönder', k: 'ok' }],
      }),
    },
    res: (w, s, k, pid) => {
      const p = P(w, pid);
      if (s === 1) {
        if (k === 'git' && alive(p)) {
          w.hh.cash -= L(w, 800);
          w.flags.q_ist_ad = p.first;
          p.rel = clamp(p.rel + 25, -100, 100);
          p.away = 'gurbet';
          p.awayUntil = w.m + 12 * rint(w, 6, 12);
          p.job = 'yok';
          p.parcel = undefined;
          w.flags['gyer' + p.id] = 'ist';
          setStep(w, 'istanbul', 2, rint(w, 36, 72));
        } else {
          if (alive(p)) p.rel = clamp(p.rel - 35, -100, 100);
          setStep(w, 'istanbul', -1);
        }
        return;
      }
      setStep(w, 'istanbul', -1);
      w.flags.istanbulKopru = true;
      nb(w, 2);
    },
  },
  {
    id: 'evlat',
    ad: 'Kimsesiz çocuk',
    start: (w) => chance(w, 0.003) && hhMembers(w).length >= 3,
    steps: {
      1: (w) => ({
        text: `${pick(w, ['Komşu köyde bir yangında', 'Geçen kışın salgınında', 'Yaylada bir selde'])} anası babası ölen yedi yaşında bir çocuk, Yetim Ali, köy odasında kalıyor. Muhtar "bir aile sahip çıksın, yoksa yetimhaneye gidecek" diyor.`,
        opts: [{ t: 'Evlat edinelim; bizim soyadımızı taşısın', k: 'evlat' }, { t: `Bakımına para verelim (${fmt(L(w, 600))} lira)`, k: 'para' }, { t: 'Devlet baksın', k: 'yok' }],
      }),
    },
    res: (w, _s, k) => {
      setStep(w, 'evlat', -1);
      if (k === 'evlat') {
        const c = makePerson(w, { sex: 'E', b: w.m - 7 * 12, first: 'Ali', last: w.surname, blood: true, inHH: true });
        c.rel = 60;
        c.tr.uyum = clamp(c.tr.uyum + 2, 1, 10);
        nb(w, 5);
        KOMSULAR.forEach((x) => addHatir(w, x.id, 4));
        log(w, `Yetim Ali ${w.surname} ailesinin evladı oldu; nüfusa ${fullName(c)} olarak yazıldı.`, 'dogum');
      } else if (k === 'para') {
        w.hh.cash -= L(w, 600);
        nb(w, 2);
      } else nb(w, -1);
    },
  },
  {
    id: 'yarisma',
    ad: 'Televizyon yarışması',
    start: (w) => year(w.m) >= 1990 && kid(w, 18, 40, (p) => p.tr.zeka >= 7).length > 0 && chance(w, 0.004),
    steps: {
      1: (w) => {
        const p = pick(w, kid(w, 18, 40, (q) => q.tr.zeka >= 7));
        return {
          pid: p.id,
          text: `${fullName(p)} (${age(w, p)}) bilgi yarışmasına seçildi! Bütün köy kahvedeki televizyonun başında. Son soruya geldi: büyük ödül ya da elindekini alıp çekilmek.`,
          opts: [{ t: 'Son soruya cevap ver', k: 'risk' }, { t: 'Elindekini al, çekil', k: 'cekil' }],
        };
      },
    },
    res: (w, _s, k, pid) => {
      setStep(w, 'yarisma', -1);
      const p = P(w, pid);
      if (k === 'cekil') {
        w.hh.cash += L(w, 4000);
        nb(w, 2);
        log(w, `${p ? p.first : 'Yarışmacı'} elindekini alıp çekildi; köye bir televizyon ve buzdolabı parası getirdi.`, 'para');
      } else if (chance(w, 0.45 + ((p?.tr.zeka || 7) - 7) * 0.08)) {
        w.hh.cash += L(w, 25000);
        nb(w, 6);
        log(w, `${p ? p.first : 'Yarışmacı'} son soruyu bildi ve büyük ödülü kazandı! Köy meydanında gece yarısı havai fişek atıldı.`, 'para');
      } else {
        nb(w, 1);
        log(w, `Son soru yanlış çıktı; ama ${p ? p.first : 'yarışmacı'} köyün ünlüsü oldu.`, 'olay');
      }
    },
  },
  {
    id: 'yayla',
    ad: 'Yayla göçü',
    start: (w) => (w.hh.suru || 0) >= 10 && monthOf(w.m) === 4 && chance(w, 0.3),
    steps: {
      1: (w) => ({
        text: `Mayıs geldi; obalar yaylaya çıkıyor. ${w.hh.suru} koyunluk sürüyü dağın serin çayırlarına çıkarırsan kuzular gürbüz olur, süt bollaşır; ama kurt da, fırtına da yaylada.`,
        opts: [{ t: 'Sürü yaylaya çıksın, gençler başında olsun', k: 'cik' }, { t: 'Köyün merasında kalsın', k: 'kal' }],
      }),
    },
    res: (w, _s, k) => {
      setStep(w, 'yayla', 0);
      if (k !== 'cik') return;
      if (chance(w, 0.8)) {
        const n = Math.max(1, Math.round((w.hh.suru || 0) * 0.15));
        w.hh.suru = (w.hh.suru || 0) + n;
        w.hh.cash += L(w, 15 * (w.hh.suru || 0));
        for (const p of hhMembers(w)) if (age(w, p) >= 12 && age(w, p) <= 25) p.rel = clamp(p.rel + 4, -100, 100);
        log(w, `Yayladan bereketle dönüldü: ${n} kuzu fazla, tulumlar peynirle dolu.`, 'is');
      } else {
        const n = Math.min(w.hh.suru || 0, rint(w, 2, 6));
        w.hh.suru = (w.hh.suru || 0) - n;
        log(w, `Yaylada dolu fırtınası: ${n} koyun kayboldu.`, 'olay');
      }
    },
  },
];

/** Aylık: kooperatif, kuyu suyu, göçmen dükkânı, kazı kirası, internet satışı, futbolcu */
export function monthlyQuests2(w: World, lines: { t: string; v: number }[]) {
  const add = (t: string, n: number) => {
    const v = L(w, n);
    w.hh.cash += v;
    lines.push({ t, v });
  };
  if (w.flags.koop === 'baskan') add(w.flags.koopDepo ? 'Kooperatif: başkanlık payı ve soğuk hava deposu' : 'Kooperatif: başkanlık payı', w.flags.koopDepo ? 260 : 150);
  else if (w.flags.koop === 'uye') add('Kooperatif ortaklık payı', 60);
  if (Number(w.flags.kuyuSat || 0) > w.m && monthOf(w.m) >= 4 && monthOf(w.m) <= 8) add('Kuyudan su satışı', 120);
  if (w.flags.gocOrtak) add('Göçmen ortağın börek dükkânı', 140);
  if (Number(w.flags.kaziKira || 0) > w.m) add('Arkeoloji kazısı kirası', 90);
  if (w.flags.eticaret) add('İnternetten köy ürünü satışı', 650);
}
