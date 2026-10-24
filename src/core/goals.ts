// Hanedan hedefleri: oyunun sonu yok, hedefler kuşaklar boyu sürer.
import type { World } from './types';
import { year } from './calendar';
import { log } from './people';
import { nam, title } from './assets';
import { underTitle } from './baron';

export interface Goal { id: string; ad: string; grup: string; pts: number; ok: (w: World) => boolean; }

const n = (w: World, k: string) => Number(w.flags[k] || 0);
const kills = (w: World) => (w.flags.yokEdilen ? String(w.flags.yokEdilen).split(',').length : 0);
const dips = (w: World) => Object.values(w.people).filter((p) => p.dip).length;

export const GOALS: Goal[] = [
  { id: 'tapu', ad: 'İlk tapu', grup: 'Toprak', pts: 10, ok: (w) => !!w.flags.ilkTapu },
  { id: 'd25', ad: '25 dönüm toprak', grup: 'Toprak', pts: 10, ok: (w) => w.hh.land >= 25 },
  { id: 'd50', ad: '50 dönüm toprak', grup: 'Toprak', pts: 15, ok: (w) => w.hh.land >= 50 },
  { id: 'd100', ad: '100 dönüm: köyün yarısı', grup: 'Toprak', pts: 25, ok: (w) => w.hh.land >= 100 },
  { id: 'ev1', ad: 'Kendi evimiz', grup: 'Mülk', pts: 8, ok: (w) => w.hh.house >= 1 },
  { id: 'ev3', ad: 'Konak', grup: 'Mülk', pts: 20, ok: (w) => w.hh.house >= 3 },
  { id: 'trak', ad: 'Köyün ilk traktörü', grup: 'Mülk', pts: 8, ok: (w) => (w.hh.veh.traktor || 0) > 0 },
  { id: 'isl3', ad: 'Köyün üç işletmesi', grup: 'Mülk', pts: 15, ok: (w) => Object.keys(w.hh.biz).length >= 3 },
  { id: 'aga', ad: 'Ağa unvanı', grup: 'Nam', pts: 25, ok: (w) => title(w).ad === 'Ağa' },
  { id: 'muhtar', ad: 'Muhtar seçil', grup: 'Siyaset', pts: 10, ok: (w) => n(w, 'g_muhtar') > 0 || w.pol.seat === 'muhtar' },
  { id: 'baskan', ad: 'Belediye başkanı seçil', grup: 'Siyaset', pts: 20, ok: (w) => n(w, 'g_baskan') > 0 || w.pol.seat === 'belediye' },
  { id: 'vekil', ad: 'Milletvekili seçil', grup: 'Siyaset', pts: 30, ok: (w) => n(w, 'g_vekil') > 0 || w.pol.seat === 'vekil' },
  { id: 'okur', ad: 'Ailenin ilk okumuşu', grup: 'Aile', pts: 10, ok: (w) => dips(w) >= 1 },
  { id: 'okur3', ad: 'Üç diplomalı torun', grup: 'Aile', pts: 15, ok: (w) => dips(w) >= 3 },
  { id: 'nesil3', ad: 'Üçüncü nesil', grup: 'Aile', pts: 10, ok: (w) => n(w, 'nesil') >= 3 },
  { id: 'nesil6', ad: 'Altıncı nesil', grup: 'Aile', pts: 30, ok: (w) => n(w, 'nesil') >= 6 },
  { id: 'y2000', ad: '2000 yılını gör', grup: 'Aile', pts: 10, ok: (w) => year(w.m) >= 2000 },
  { id: 'y2065', ad: 'Yüz yıllık ocak', grup: 'Aile', pts: 40, ok: (w) => year(w.m) >= (w.y0 || 1965) + 100 },
  { id: 'y2023', ad: 'Cumhuriyetin yüzüncü yılı', grup: 'Aile', pts: 15, ok: (w) => year(w.m) >= 2023 && (w.y0 || 1965) <= 1925 },
  { id: 'ogret', ad: 'Ailenin öğretmeni', grup: 'Aile', pts: 10, ok: (w) => Object.values(w.people).some((p) => p.dip === 'ogret') },
  { id: 'haci', ad: 'Hacı', grup: 'Nam', pts: 10, ok: (w) => Object.keys(w.flags).some((k) => k.startsWith('haci')) },
  { id: 'kan1', ad: 'Bir rakip aileyi silmek', grup: 'Kan', pts: 15, ok: (w) => kills(w) >= 1 },
  { id: 'kan3', ad: 'Dört aileyi de silmek', grup: 'Kan', pts: 35, ok: (w) => kills(w) >= 4 },
  { id: 'cete', ad: 'Şehir çetesini dağıtmak', grup: 'Kan', pts: 25, ok: (w) => !!w.crew?.gone },
  { id: 'atolye', ad: 'İlk atölye', grup: 'Yeraltı', pts: 10, ok: (w) => !!w.lab || n(w, 'labKazanc') > 0 },
  { id: 'hap', ad: 'Hap imalathanesi', grup: 'Yeraltı', pts: 20, ok: (w) => (w.lab?.lvl || 0) >= 3 },
  { id: 'sebeke', ad: 'Şebekeyi devralmak', grup: 'Yeraltı', pts: 20, ok: (w) => w.city.net },
  { id: 'baron', ad: 'Baron', grup: 'Yeraltı', pts: 50, ok: (w) => underTitle(w).ad === 'Baron' },
  { id: 'sehir', ad: 'Şehre taşınmak', grup: 'Şehir', pts: 15, ok: (w) => w.city.moved },
  { id: 'fab3', ad: 'Üç fabrika', grup: 'Şehir', pts: 20, ok: (w) => Object.keys(w.city.facs).length >= 3 },
  { id: 'mah6', ad: 'Çukurkent\'in bütün mahalleleri', grup: 'Şehir', pts: 40, ok: (w) => w.city.dist.every((d) => d.o === 'biz') },
  { id: 'yeniaga', ad: 'Köyün yeni ağası', grup: 'Nam', pts: 30, ok: (w) => !!w.flags.yeniAga },
  { id: 'konak2', ad: 'Ağanın konağında oturmak', grup: 'Mülk', pts: 20, ok: (w) => !!w.flags.agaKonak },
  { id: 'suru', ad: 'Kırk koyunluk sürü', grup: 'Mülk', pts: 10, ok: (w) => (w.hh.suru || 0) >= 40 },
  { id: 'baba', ad: 'Şehrin Babası', grup: 'Yeraltı', pts: 60, ok: (w) => Number(w.flags.ceteYok || 0) >= 1 && w.city.turf >= 4 && !!w.city.net },
  { id: 'nam200', ad: 'Nam 200', grup: 'Nam', pts: 30, ok: (w) => nam(w) >= 200 },
];

export function monthlyGoals(w: World) {
  if (w.pol.seat === 'muhtar') w.flags.g_muhtar = 1;
  if (w.pol.seat === 'belediye') w.flags.g_baskan = 1;
  if (w.pol.seat === 'vekil') w.flags.g_vekil = 1;
  for (const g of GOALS) {
    if (w.flags['goal_' + g.id]) continue;
    if (g.ok(w)) {
      w.flags['goal_' + g.id] = w.m;
      w.flags.puan = n(w, 'puan') + g.pts;
      log(w, `Hedef: ${g.ad} (+${g.pts} hanedan puanı).`, 'miras');
    }
  }
}

export const doneGoals = (w: World) => GOALS.filter((g) => w.flags['goal_' + g.id]);
