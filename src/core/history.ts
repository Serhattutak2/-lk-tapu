// Tarih: 1925'ten itibaren köyü sarsan olaylar. Aşar'ın kalkışı, soyadı, buhran, eşkıya, kaçak tütün,
// seferberlik ve karne, köy enstitüleri, toprak dağıtımı, ilk çok partili seçim, makineleşme, gurbet.
// Siyasi olaylar tarafsız anlatılır; parti adı geçmez. Kart kimliği 'hi:<id>'.
import type { CropId, World } from './types';
import { chance, clamp, pick, rint } from './rng';
import { age, alive, fullName, hhMembers, log, P } from './people';
import { infl, monthOf, year } from './calendar';
import { pushCard } from './cards';
import { nam, buyPlot } from './assets';
import { newParcel, STORABLE } from './fields';
import { PLOTS, plotOwnerName, plotPrice } from './plots';
import { jailYears } from './events';

const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR');
const L = (w: World, n: number) => Math.round(n * infl(w.m));
const bonus = (w: World, n: number) => (w.flags.namBonus = Number(w.flags.namBonus || 0) + n);
const men = (w: World, lo: number, hi: number) => hhMembers(w).filter((p) => p.blood && p.sex === 'E' && !p.away && age(w, p) >= lo && age(w, p) <= hi);
const grainParcels = (w: World) => w.hh.parcels.filter((f) => f.crop && STORABLE.includes(f.crop)).length;

interface Built { text: string; opts: { t: string; k: string }[]; pid?: string; data?: Record<string, unknown> }
interface Hi {
  id: string;
  from: number;
  to: number;
  p: number | ((w: World) => number);
  once?: boolean;
  make: (w: World) => Built | null;
  res: (w: World, k: string, pid: string | undefined, d: Record<string, unknown>) => void;
}

const HIST: Hi[] = [
  {
    id: 'harf',
    from: 1929,
    to: 1932,
    once: true,
    p: (w) => (monthOf(w.m) === 10 ? 0.6 : 0),
    make: () => ({
      text: `Yeni harfler geldi. Köy kahvesinde Millet Mektebi açıldı; akşamları yaşlı genç herkes tahtanın başında. Okuma bilen köyde bir adım öne geçer.`,
      opts: [{ t: 'Büyükler de gitsin, akşamları ders', k: 'git' }, { t: 'Çocuklar öğrensin yeter', k: 'cocuk' }, { t: 'Tarla bekler, vaktimiz yok', k: 'yok' }],
    }),
    res: (w, k) => {
      if (k === 'git') {
        for (const p of hhMembers(w)) if (age(w, p) >= 14 && age(w, p) <= 50) p.sk.ticaret = clamp(p.sk.ticaret + 6, 0, 100);
        bonus(w, 1);
        log(w, `Ailenin büyükleri yeni harflerle okumayı söktü.`, 'is');
      } else if (k === 'cocuk') {
        for (const p of hhMembers(w)) if (age(w, p) >= 7 && age(w, p) < 14) p.sk.ticaret = clamp(p.sk.ticaret + 8, 0, 100);
      }
    },
  },
  {
    id: 'soyadi',
    from: 1934,
    to: 1935,
    once: true,
    p: 0.15,
    make: (w) => ({
      text: `Soyadı Kanunu çıktı. Nüfus memuru köye geldi, her aile kütüğe bir soyadıyla yazılacak. Köyde size öteden beri "${w.surname}" deniyor. Memur bir de soruyor: "Bu ad nereden gelir?"`,
      opts: [
        { t: `Dedemizin lakabıdır, ${w.surname} kalsın`, k: 'dede' },
        { t: `Memura bahşiş, kütüğe "toprak sahibi" diye geçsin (${fmt(L(w, 80))} lira)`, k: 'bahsis' },
        { t: 'Ağa ne derse o', k: 'aga' },
      ],
    }),
    res: (w, k) => {
      if (k === 'dede') for (const id of w.hh.members) w.people[id].rel = clamp(w.people[id].rel + 6, -100, 100);
      else if (k === 'bahsis') {
        w.hh.cash -= L(w, 80);
        bonus(w, 2);
      } else {
        w.hh.debt = Math.max(0, Math.round(w.hh.debt * 0.9));
        bonus(w, -1);
      }
      log(w, `Aile nüfus kütüğüne ${w.surname} soyadıyla yazıldı.`, 'miras');
    },
  },
  {
    id: 'eskiya',
    from: 1925,
    to: 1938,
    p: (w) => (w.flags.eskiyaBitti ? 0 : 0.012),
    make: (w) => ({
      text: `Dağdaki eşkıya çetesinden haber geldi: köyün her evi bu kış haraç verecek, yoksa ambarlar yanar. Jandarma karakolu iki saat uzakta.`,
      opts: [
        { t: `Haracı öde (${fmt(L(w, 110))} lira)`, k: 'ode' },
        { t: 'Vermeyiz, kapıyı tüfekle bekleriz', k: 'red' },
        { t: `Onlara erzak taşı, yol göster (para iyi)`, k: 'yatak' },
      ],
    }),
    res: (w, k) => {
      if (k === 'ode') w.hh.cash -= L(w, 110);
      else if (k === 'red') {
        if (chance(w, 0.4)) {
          const v = Math.round(w.hh.cash * 0.25);
          w.hh.cash -= v;
          const m = men(w, 16, 60)[0];
          if (m) m.hp = clamp(m.hp - 25, 5, 100);
          log(w, `Eşkıya gece baskın verdi; ${fmt(v)} lira ve erzak gitti${m ? `, ${m.first} yaralandı` : ''}.`, 'olay');
        } else {
          bonus(w, 3);
          log(w, `Eşkıya bizim kapıya gelmedi. Köyde "${w.surname}lar haraç vermedi" diye konuşuluyor.`, 'olay');
        }
      } else {
        w.hh.cash += L(w, 380);
        w.heat = clamp(w.heat + 9, 0, 100);
        w.flags.eskiyaDost = w.m;
        log(w, `Eşkıyaya yataklık edildi. Para iyi, ama jandarma soruşturuyor.`, 'olay');
      }
    },
  },
  {
    id: 'eskiya_son',
    from: 1930,
    to: 1940,
    once: true,
    p: (w) => (w.flags.eskiyaDost ? 0.02 : 0.005),
    make: (w) => {
      w.flags.eskiyaBitti = true;
      if (!w.flags.eskiyaDost) return { text: `Jandarma dağdaki eşkıya çetesini dağıttı. Yollar artık güvenli; kasaba pazarına gece de gidilebilir.`, opts: [{ t: 'Oh be', k: 'ok' }] };
      return {
        text: `Jandarma dağdaki çeteyi çökertti. Yakalanan eşkıyalardan biri, kendilerine erzak taşıyan köylüleri sayıyor. Senin adın da geçebilir.`,
        opts: [{ t: `Karakol komutanına hediye götür (${fmt(L(w, 600))} lira)`, k: 'hediye' }, { t: 'İnkâr et', k: 'inkar' }],
      };
    },
    res: (w, k) => {
      if (k === 'hediye') {
        w.hh.cash -= L(w, 600);
        w.heat = clamp(w.heat - 10, 0, 100);
      } else if (k === 'inkar') {
        const m = men(w, 18, 60).find((p) => p.id !== w.playerId) ?? P(w, w.playerId);
        if (alive(m) && chance(w, 0.45)) {
          m.away = 'hapis';
          m.awayUntil = w.m + 12 * jailYears(w, rint(w, 1, 3));
          m.job = 'yok';
          log(w, `${fullName(m)} eşkıyaya yataklıktan tutuklandı.`, 'olay');
        } else log(w, `İfadeler tutmadı; dosya kapandı.`, 'olay');
      }
    },
  },
  {
    id: 'tutun',
    from: 1925,
    to: 1950,
    p: (w) => (w.flags.tutunRed && w.m - Number(w.flags.tutunRed) < 36 ? 0 : 0.014),
    make: (w) => {
      const m = men(w, 17, 40).filter((p) => p.id !== w.playerId)[0] ?? men(w, 17, 40)[0];
      if (!m) return null;
      return {
        pid: m.id,
        text: `Dağ yolundan şehre kaçak tütün taşıyan katırcılar adam arıyor. Tütün inhisarda; yakalanan hapse girer. ${m.first} gitmek istiyor: üç haftalık yol, ${fmt(L(w, 700))} lira.`,
        opts: [{ t: 'Gitsin', k: 'git' }, { t: 'Bizim işimiz değil', k: 'red' }],
      };
    },
    res: (w, k, pid) => {
      const m = P(w, pid);
      if (k !== 'git' || !alive(m)) {
        w.flags.tutunRed = w.m;
        return;
      }
      w.flags.tutunSefer = Number(w.flags.tutunSefer || 0) + 1;
      if (chance(w, 0.17)) {
        m.away = 'hapis';
        m.awayUntil = w.m + 12 * jailYears(w, rint(w, 1, 2));
        m.job = 'yok';
        w.heat = clamp(w.heat + 8, 0, 100);
        log(w, `${fullName(m)} kaçak tütünle yakalandı; cezaevine girdi.`, 'olay');
      } else {
        w.hh.cash += L(w, 700);
        w.heat = clamp(w.heat + 4, 0, 100);
        m.sk.ticaret = clamp(m.sk.ticaret + 3, 0, 100);
        log(w, `${fullName(m)} kaçak tütün yükünü şehre ulaştırdı: ${fmt(L(w, 700))} lira.`, 'para');
        if (Number(w.flags.tutunSefer) >= 3 && !w.flags.kacakci) {
          w.flags.kacakci = true;
          log(w, `Katırcıların başı Kara Rıza seninle tanışmak istedi: "Sizin aile ağzı sıkı aile." Kayıt dışı bir alıcın var artık.`, 'olay');
        }
      }
    },
  },
  {
    id: 'buhran_tarla',
    from: 1930,
    to: 1934,
    p: (w) => (!w.flags['buhranT' + year(w.m)] ? 0.06 : 0),
    make: (w) => {
      w.flags['buhranT' + year(w.m)] = true;
      const i = w.plots.findIndex((p) => p.o === 'koy' && !p.sale);
      if (i < 0) return null;
      w.plots[i].sale = true;
      w.plots[i].ask = 0.62;
      const price = plotPrice(w, i);
      return {
        data: { plot: i },
        text: `Buhran köyü kasıp kavuruyor: buğday para etmiyor, vergiler ödenemiyor. ${plotOwnerName(w, i)} ${PLOTS[i].yer} mevkiindeki tarlasını yok pahasına satıyor: ${fmt(price)} lira. Kasanda ${fmt(w.hh.cash)} lira var.`,
        opts: [{ t: `Al (${fmt(price)} lira)`, k: 'al' }, { t: 'Komşunun derdinden kâr etmem', k: 'hayir' }],
      };
    },
    res: (w, k, _p, d) => {
      if (k === 'al') {
        const r = buyPlot(w, d.plot as number);
        if (!r.ok) log(w, r.msg, 'para');
      } else bonus(w, 1);
    },
  },
  {
    id: 'seferberlik',
    from: 1939,
    to: 1945,
    p: 0.05,
    make: (w) => {
      const m = men(w, 20, 42).find((p) => !w.flags['sef' + p.id] && p.id !== w.playerId);
      if (!m) return null;
      w.flags['sef' + m.id] = true;
      return {
        pid: m.id,
        text: `Seferberlik. ${fullName(m)} (${age(w, m)}) silah altına çağrıldı; sınırlarda bekleyecek, ne zaman döneceği belli değil. Köyde erkek kalmıyor, gündelikler yükseldi.`,
        opts: [
          { t: 'Vatan borcu, gitsin', k: 'git' },
          { t: `Hekime para ver, çürük raporu (${fmt(L(w, 450))} lira)`, k: 'curuk' },
          { t: 'Dağa kaçsın, asker kaçağı olsun', k: 'kac' },
        ],
      };
    },
    res: (w, k, pid) => {
      const p = P(w, pid);
      if (!alive(p)) return;
      if (k === 'git') {
        p.away = 'asker';
        p.awayUntil = w.m + rint(w, 20, 44);
        p.job = 'yok';
        p.parcel = undefined;
        bonus(w, 1);
        log(w, `${fullName(p)} seferberlikle askere gitti.`, 'olay');
      } else if (k === 'curuk') {
        w.hh.cash -= L(w, 450);
        w.heat = clamp(w.heat + 3, 0, 100);
      } else {
        w.heat = clamp(w.heat + 12, 0, 100);
        bonus(w, -2);
        if (chance(w, 0.3)) {
          p.away = 'hapis';
          p.awayUntil = w.m + 12 * jailYears(w, 2);
          p.job = 'yok';
          log(w, `Jandarma asker kaçağı ${fullName(p)}'i samanlıkta buldu.`, 'olay');
        } else log(w, `${fullName(p)} dağda saklanıyor; geceleri eve ekmek almaya iniyor.`, 'olay');
      }
    },
  },
  {
    id: 'karne',
    from: 1942,
    to: 1945,
    p: (w) => (monthOf(w.m) === 7 && !w.flags['karne' + year(w.m)] ? 0.85 : 0),
    make: (w) => {
      w.flags['karne' + year(w.m)] = true;
      const g = grainParcels(w) + Math.round(Object.values(w.hh.ambar || {}).reduce((a, b) => a + (b || 0), 0) / 1800);
      if (g > 0) {
        return {
          data: { g },
          text: `Toprak Mahsulleri Ofisi'nin memurları köyde: hasadın büyük kısmına devlet fiyatıyla el konacak. Şehirde karaborsada buğday üç katına gidiyor. Ambarı saklayan çok, yakalanan da.`,
          opts: [
            { t: `Teslim et (${fmt(L(w, 260) * g)} lira devlet parası)`, k: 'teslim' },
            { t: `Yarısını sakla, gece karaborsaya sat (~${fmt(L(w, 820) * g)} lira)`, k: 'kara' },
          ],
        };
      }
      return {
        text: `Ekmek karneyle. Fırının önünde kuyruk, çocukların yüzü sarı. Ağanın ambarları ise dolu.`,
        opts: [
          { t: `Karaborsadan un al (${fmt(L(w, 240))} lira)`, k: 'un' },
          { t: 'Karneyle idare et', k: 'idare' },
          { t: 'Gece ağanın ambarından çuval al', k: 'calis' },
        ],
      };
    },
    res: (w, k, _p, d) => {
      const g = Number(d.g || 0);
      if (k === 'teslim') {
        w.hh.cash += L(w, 260) * g;
        for (const c of STORABLE) if (w.hh.ambar?.[c]) w.hh.ambar[c] = (w.hh.ambar[c] || 0) * 0.5;
        for (const f of w.hh.parcels) if (f.crop && STORABLE.includes(f.crop as CropId)) f.careSum *= 0.7;
        bonus(w, 1);
      } else if (k === 'kara') {
        w.heat = clamp(w.heat + 10, 0, 100);
        if (chance(w, 0.25)) {
          const fine = L(w, 900) * g;
          w.hh.cash -= fine;
          log(w, `Karaborsacılıktan yakalandık: ${fmt(fine)} lira ceza, adımız gazeteye çıktı.`, 'olay');
          bonus(w, -3);
        } else {
          w.hh.cash += L(w, 820) * g;
          for (const c of STORABLE) if (w.hh.ambar?.[c]) w.hh.ambar[c] = (w.hh.ambar[c] || 0) * 0.5;
          for (const f of w.hh.parcels) if (f.crop && STORABLE.includes(f.crop as CropId)) f.careSum *= 0.7;
          log(w, `Saklanan buğday gece kamyonla şehre gitti: ${fmt(L(w, 820) * g)} lira.`, 'para');
        }
      } else if (k === 'un') w.hh.cash -= L(w, 240);
      else if (k === 'idare') {
        for (const p of hhMembers(w)) p.hp = clamp(p.hp - 6, 5, 100);
        log(w, `Karneyle geçen bir yıl daha; evde herkes zayıfladı.`, 'olay');
      } else {
        if (chance(w, 0.3)) {
          w.flags.agaKin = Math.max(Number(w.flags.agaKin || 0), year(w.m) + 1);
          w.hh.rent = Math.round(w.hh.rent * 1.2);
          log(w, `Ağanın bekçisi bizi gördü. Ağa kirayı artırdı ve köye "bunlara toprak satmayın" dedi.`, 'olay');
        } else log(w, `Ağanın ambarından iki çuval un eksildi; kimse kimseyi görmedi.`, 'olay');
      }
    },
  },
  {
    id: 'enstitu',
    from: 1940,
    to: 1953,
    p: 0.05,
    make: (w) => {
      const c = hhMembers(w).find((p) => p.blood && !p.away && p.id !== w.playerId && age(w, p) >= 12 && age(w, p) <= 15 && p.tr.zeka >= 6 && !w.flags['ens' + p.id]);
      if (!c) return null;
      w.flags['ens' + c.id] = true;
      return {
        pid: c.id,
        text: `Köy Enstitüsü'ne öğrenci seçiliyor ve öğretmen ${fullName(c)}'i önerdi. Beş yıl yatılı okuyacak: hem öğretmenlik hem marangozluk, tarım, müzik öğrenecek. Sonunda köye öğretmen olarak dönecek.`,
        opts: [{ t: 'Gitsin, okusun', k: 'git' }, { t: 'Tarlada lazım', k: 'hayir' }],
      };
    },
    res: (w, k, pid) => {
      const p = P(w, pid);
      if (!alive(p)) return;
      if (k === 'git') {
        p.away = 'okul';
        p.awayUntil = w.m + 60;
        p.job = 'yok';
        p.parcel = undefined;
        p.rel = clamp(p.rel + 10, -100, 100);
        log(w, `${fullName(p)} Köy Enstitüsü'ne gitti.`, 'is');
      } else {
        p.rel = clamp(p.rel - 12, -100, 100);
      }
    },
  },
  {
    id: 'topraklandirma',
    from: 1947,
    to: 1960,
    p: (w) => (w.hh.parcels.length <= 1 && !w.flags.toprakBasvuru ? 0.03 : 0),
    make: (w) => {
      const i = w.plots.findIndex((p) => p.o === 'aga');
      if (i < 0) return null;
      return {
        data: { plot: i },
        text: `Çiftçiyi Topraklandırma Kanunu: komisyon köye geldi. Topraksız ve az topraklı ailelere hazine arazisi ve büyük toprak sahiplerinin fazla toprağından dağıtılacak. ${PLOTS[i].yer} mevkiinde 5 dönüm sıra bekliyor. Tapu harcı ve masraflar ${fmt(L(w, 900))} lira.`,
        opts: [{ t: 'Başvur', k: 'evet' }, { t: 'Ağayı kızdırmayalım', k: 'hayir' }],
      };
    },
    res: (w, k, _p, d) => {
      w.flags.toprakBasvuru = w.m;
      const i = d.plot as number;
      if (k !== 'evet') {
        w.hh.debt = Math.max(0, Math.round(w.hh.debt * 0.85));
        log(w, `Ağa, başvurmadığımızı duyunca borcun bir kısmını sildi.`, 'para');
        return;
      }
      w.hh.cash -= L(w, 900);
      if (chance(w, 0.7) && w.plots[i]?.o === 'aga') {
        const first = w.hh.parcels.length === 0;
        const par = newParcel(w, L(w, 900));
        w.plots[i] = { o: 'biz', pid: par.id, ask: 1, sale: false, mad: 0 };
        if (first) w.flags.ilkTapu = w.m;
        w.hh.rent = Math.round(w.hh.rent * 1.25);
        w.rival.feud = clamp(w.rival.feud + 6, 0, 100);
        log(w, `${first ? 'İLK TAPU: ' : ''}Toprak dağıtımında ${PLOTS[i].yer} mevkiindeki 5 dönüm ${w.surname} ailesine verildi. Ağa hiddetli; ev kirasını artırdı.`, 'tapu');
      } else log(w, `Komisyon başvuruyu reddetti; listede ağanın adamları vardı. Harç parası gitti.`, 'olay');
    },
  },
  {
    id: 'secim1950',
    from: 1950,
    to: 1950,
    once: true,
    p: (w) => (monthOf(w.m) >= 3 && monthOf(w.m) <= 4 ? 0.5 : 0),
    make: () => ({
      text: `Seçim var ve bu kez gerçekten yarış var. Köyde iki kahve, iki taraf. Ağa kendi tarafına oy istiyor; köylülerin çoğu öbür tarafta. Kapına iki taraftan da adam geldi.`,
      opts: [{ t: 'Ağanın yanında dur', k: 'aga' }, { t: 'Köylülerle birlikte, ağanın karşısında', k: 'koy' }, { t: 'Oy gizlidir; kimseye bir şey söyleme', k: 'gizli' }],
    }),
    res: (w, k) => {
      if (k === 'aga') {
        w.hh.rent = Math.round(w.hh.rent * 0.8);
        bonus(w, -2);
        log(w, `Ağanın tarafını tuttuk; kira düştü ama köylü bize küskün.`, 'olay');
      } else if (k === 'koy') {
        bonus(w, 4);
        w.flags.koyTarafi = true;
        w.flags.agaKin = Math.max(Number(w.flags.agaKin || 0), year(w.m));
        log(w, `Ağanın karşısında durduk. Köylü bizi sayıyor; ağa bu yıl kimseye bize toprak sattırmaz.`, 'olay');
      }
    },
  },
  {
    id: 'makine',
    from: 1950,
    to: 1956,
    once: true,
    p: 0.03,
    make: () => {
      return {
        text: `Ağa, Amerikan yardımıyla gelen kırmızı bir traktörü İstanbul'dan getirtti; köyün ilk traktörü. Bir traktör on gündelikçinin işini yapıyor; ağanın tarlasında iş azaldı. Köylüye traktör bayisi ancak yıllar sonra gelecek. Gençler şehrin inşaatlarına bakıyor.`,
        opts: [{ t: 'Gençler şehre inşaata gitsin', k: 'insaat' }, { t: 'Toprağa tutunacağız', k: 'kal' }],
      };
    },
    res: (w, k) => {
      w.flags.agaTraktor = w.m;
      if (k === 'insaat') for (const p of men(w, 16, 35)) if (p.job === 'tarla' && p.id !== w.playerId) p.job = 'insaat';
    },
  },
  {
    id: 'darbe1960',
    from: 1960,
    to: 1960,
    once: true,
    p: (w) => (monthOf(w.m) >= 4 ? 0.6 : 0),
    make: () => ({
      text: `Radyoda marşlar: ordu yönetime el koydu, sıkıyönetim ilan edildi. Jandarma köy köy dolaşıp ruhsatsız silahları topluyor.`,
      opts: [{ t: 'Silahları teslim et', k: 'teslim' }, { t: 'Tüfekleri samanlığa göm', k: 'gom' }],
    }),
    res: (w, k) => {
      if (k === 'teslim') {
        w.rival.feud = clamp(w.rival.feud - 12, 0, 100);
        w.gang = Math.max(0, w.gang - 1);
      } else {
        w.heat = clamp(w.heat + 6, 0, 100);
        if (chance(w, 0.2)) log(w, `Jandarma samanlıkta iki tüfek buldu; tutanak tutuldu.`, 'olay');
      }
    },
  },
  {
    id: 'almanya',
    from: 1961,
    to: 1962,
    once: true,
    p: 0.15,
    make: () => ({
      text: `Almanya ile işgücü anlaşması imzalandı. İş ve İşçi Bulma Kurumu'nun önünde kuyruk: sağlam, genç erkekler alınıyor. Köyün yarısı gitmek istiyor.`,
      opts: [{ t: 'Ailede kim gitmek isterse', k: 'ok' }],
    }),
    res: (w) => {
      w.flags.almanya = true;
    },
  },
  {
    id: 'hac',
    from: 1925,
    to: 2100,
    p: (w) => {
      const pl = P(w, w.playerId);
      return alive(pl) && age(w, pl) >= 48 && !w.flags['hac' + pl.id] && w.hh.cash > L(w, 14000) ? 0.006 : 0;
    },
    make: (w) => {
      const pl = P(w, w.playerId)!;
      w.flags['hac' + pl.id] = true;
      return {
        text: `${fullName(pl)} hacca gitmeyi düşünüyor. Yol uzun, masraf ${fmt(L(w, 8500))} lira; ama köye "hacı" olarak dönen adamın sözü başka dinlenir.`,
        opts: [{ t: 'Hacca git', k: 'git' }, { t: 'Para tarlaya lazım', k: 'hayir' }],
      };
    },
    res: (w, k) => {
      if (k !== 'git') return;
      const pl = P(w, w.playerId);
      w.hh.cash -= L(w, 8500);
      bonus(w, 6);
      w.heat = clamp(w.heat - 6, 0, 100);
      if (alive(pl)) {
        w.flags['haci' + pl.id] = true;
        log(w, `${fullName(pl)} hacdan döndü; artık köyde "Hacı ${pl.first}" deniyor.`, 'olay');
      }
    },
  },
  {
    id: 'kurt',
    from: 1925,
    to: 1965,
    p: (w) => (w.hh.rooms.ahir && (monthOf(w.m) === 0 || monthOf(w.m) === 1 || monthOf(w.m) === 11) ? 0.03 : 0),
    make: () => ({
      text: `Kar dizi geçti; kurtlar köye indi ve ahırın kapısını zorladı. Bir koyun parçalanmış.`,
      opts: [{ t: 'Erkekler gece nöbet tutsun', k: 'nobet' }, { t: 'Kapıyı demirle, bekle', k: 'bekle' }],
    }),
    res: (w, k) => {
      if (k === 'nobet') {
        const m = men(w, 15, 55)[0];
        if (m && chance(w, 0.15)) {
          m.hp = clamp(m.hp - 15, 5, 100);
          m.sick = 2;
          log(w, `${m.first} nöbette kurtla boğuştu; yaralı ama sürü kurtuldu.`, 'olay');
        } else bonus(w, 1);
      } else {
        w.flags.ahirKapali = Math.max(Number(w.flags.ahirKapali || 0), w.m + 2);
        if ((w.hh.suru || 0) > 0) {
          const n = Math.min(w.hh.suru || 0, rint(w, 2, 5));
          w.hh.suru = (w.hh.suru || 0) - n;
          log(w, `Kurtlar sürüden ${n} koyun götürdü.`, 'olay');
        }
      }
    },
  },
  {
    id: 'yangin',
    from: 1925,
    to: 2100,
    p: (w) => (monthOf(w.m) >= 6 && monthOf(w.m) <= 8 && Object.keys(w.hh.ambar || {}).length ? 0.012 : 0),
    make: (w) => {
      const sus = !w.rival.gone && w.rival.feud >= 35;
      return {
        data: { sus },
        text: `Gece harman yerinde yangın! Ambarın duvarına kadar geldi. ${sus ? `Köyde ${w.rival.name}ların adamlarını kaçarken görenler var.` : 'Kıvılcım nereden geldi, kimse bilmiyor.'}`,
        opts: [{ t: 'Bütün köy kovayla koşsun', k: 'sondur' }, ...(sus ? [{ t: 'Önce söndür, sonra hesap sor', k: 'hesap' }] : [])],
      };
    },
    res: (w, k, _p, d) => {
      const lost = chance(w, 0.5) ? 0.5 : 0.2;
      for (const c of Object.keys(w.hh.ambar || {}) as CropId[]) w.hh.ambar![c] = (w.hh.ambar![c] || 0) * (1 - lost);
      log(w, `Yangın söndürüldü; ambarın %${Math.round(lost * 100)}'i kül oldu.`, 'olay');
      if (k === 'hesap' && d.sus) w.rival.feud = clamp(w.rival.feud + 15, 0, 100);
    },
  },
  {
    id: 'piyango',
    from: 1939,
    to: 2100,
    p: 0.004,
    make: (w) => ({
      text: `Kasabadan dönen ${pick(w, ['Berber Sami', 'Bekçi Nuri', 'Topal Osman'])} yılbaşı piyangosundan bilet getirmiş, "bir tane de siz alın" diyor. Bilet ${fmt(L(w, 25))} lira.`,
      opts: [{ t: 'Bir bilet al', k: 'al' }, { t: 'Kumar haram', k: 'hayir' }],
    }),
    res: (w, k) => {
      if (k !== 'al') return;
      w.hh.cash -= L(w, 25);
      if (chance(w, 0.03)) {
        const v = L(w, 12000);
        w.hh.cash += v;
        log(w, `Piyango çıktı! ${fmt(v)} lira. Bütün köy kapıda.`, 'para');
      } else if (chance(w, 0.15)) {
        w.hh.cash += L(w, 100);
        log(w, `Piyangodan amorti çıktı.`, 'para');
      }
    },
  },
  {
    id: 'muhtar_yardim',
    from: 1925,
    to: 2100,
    p: (w) => (w.hh.parcels.length < 3 && w.hh.debt === 0 && nam(w) >= 8 && !w.plots.some((p) => p.o === 'koy' && p.sale) && !w.flags['mhy' + year(w.m)] ? 0.02 : 0),
    make: (w) => {
      w.flags['mhy' + year(w.m)] = true;
      const i = w.plots.findIndex((p) => p.o === 'koy');
      if (i < 0) return null;
      w.plots[i].sale = true;
      w.plots[i].ask = 0.95;
      const price = plotPrice(w, i);
      return {
        data: { plot: i },
        text: `Muhtar kahvede yanına oturdu: "${plotOwnerName(w, i)} oğlunu everecek, ${PLOTS[i].yer} mevkiindeki tarlasını satacak. Ben senin adını verdim; ${fmt(price)} liraya razı." `,
        opts: [{ t: `Al (${fmt(price)} lira)`, k: 'al' }, { t: 'Şimdi olmaz', k: 'hayir' }],
      };
    },
    res: (w, k, _p, d) => {
      if (k !== 'al') return;
      const r = buyPlot(w, d.plot as number);
      if (!r.ok) log(w, r.msg, 'para');
    },
  },
];

const HMAP = Object.fromEntries(HIST.map((e) => [e.id, e]));

export function historyCards(w: World): boolean {
  const y = year(w.m);
  for (const e of HIST) {
    if (y < e.from || y > e.to) continue;
    if (e.once && w.flags['hi_' + e.id]) continue;
    const p = typeof e.p === 'number' ? e.p : e.p(w);
    if (p <= 0 || !chance(w, p)) continue;
    const b = e.make(w);
    if (!b) continue;
    if (e.once) w.flags['hi_' + e.id] = true;
    pushCard(w, { id: 'hi:' + e.id, pid: b.pid, text: b.text, opts: b.opts, data: b.data });
    return true;
  }
  return false;
}

export function resolveHistory(w: World, id: string, k: string, pid: string | undefined, data: Record<string, unknown> | undefined): boolean {
  if (!id.startsWith('hi:')) return false;
  HMAP[id.slice(3)]?.res(w, k, pid, data ?? {});
  return true;
}

/** Aylık: yatılı okuldan dönüş. */
export function monthlyHistory(w: World) {
  for (const p of Object.values(w.people)) {
    if (!alive(p) || p.away !== 'okul' || (p.awayUntil ?? 0) > w.m) continue;
    p.away = undefined;
    p.awayUntil = undefined;
    p.dip = 'ogret';
    p.job = p.inHH ? 'yok' : 'ogretmen';
    p.sk.ticaret = clamp(p.sk.ticaret + 25, 0, 100);
    p.sk.zanaat = clamp(p.sk.zanaat + 15, 0, 100);
    bonus(w, 3);
    log(w, `${fullName(p)} Köy Enstitüsü'nü bitirdi ve öğretmen olarak köye döndü.`, 'is');
  }
}
