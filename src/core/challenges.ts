// Görevler (Challenge): sonsuz oyuna yüzlerce küçük hedef ve bir prestij parası (jeton).
// Tamamlanınca jeton + ufak nam verir, bir "görev tamam" kartı düşer. Durum yalnızca flags'te tutulur:
//   flags.ch_<id> = tamamlandığı ay   |   flags.jeton = toplam jeton
import type { World } from './types';
import { log, hhMembers, bloodLiving, age, P } from './people';
import { year, infl } from './calendar';
import { nam } from './assets';
import { underTitle } from './baron';
import { pushCard } from './cards';
import { korku, saygi } from './guc';

export interface Challenge { id: string; grup: string; ad: string; desc: string; jeton: number; ok: (w: World) => boolean; }

const kills = (w: World) => (w.flags.yokEdilen ? String(w.flags.yokEdilen).split(',').filter(Boolean).length : 0);
const temiz = (w: World) => !w.flags.ilkKirliY;              // hiç kayıt dışı işe bulaşmadı mı
const cleanYears = (w: World) => temiz(w) ? year(w.m) - (w.y0 || 1925) : 0;
const facCount = (w: World) => Object.keys(w.city.facs).length;
const hasTech = (w: World, t: string) => !!w.tech[t as keyof typeof w.tech];
const hasDip = (w: World, d: string) => hhMembers(w).some((p) => p.dip === d);
const everCrop = (w: World, c: string) => w.hh.parcels.some((f) => f.hist.some((h) => h.crop === c)) || w.hh.parcels.some((f) => f.crop === c);

export const CHALLENGES: Challenge[] = [
  // ---- Toprak ----
  { id: 'ilktapu', grup: 'Toprak', ad: 'İlk Tapu', desc: 'Kendine ait ilk tarlayı al.', jeton: 2, ok: (w) => w.hh.parcels.length >= 1 },
  { id: 'uctarla', grup: 'Toprak', ad: 'Üç tarla', desc: 'Üç tarlayı birden işle.', jeton: 2, ok: (w) => w.hh.parcels.length >= 3 },
  { id: 'onttarla', grup: 'Toprak', ad: 'Geniş topraklar', desc: 'On tarlanın sahibi ol.', jeton: 4, ok: (w) => w.hh.parcels.length >= 10 },
  { id: 'yirmitarla', grup: 'Toprak', ad: 'Çiftlik ağası', desc: 'Yirmi tarlayı elinde tut.', jeton: 6, ok: (w) => w.hh.parcels.length >= 20 },
  { id: 'kerpic', grup: 'Toprak', ad: 'Kendi çatın', desc: 'Kiradan çık, kendi evini al.', jeton: 2, ok: (w) => w.hh.house >= 1 },
  { id: 'tasev', grup: 'Toprak', ad: 'Taş ev', desc: 'Taş eve geç.', jeton: 3, ok: (w) => w.hh.house >= 2 },
  { id: 'konak', grup: 'Toprak', ad: 'Konak', desc: 'Köyün konağında otur.', jeton: 5, ok: (w) => w.hh.house >= 3 },
  { id: 'agil', grup: 'Toprak', ad: 'Dağda ağıl', desc: 'Dağdaki ağılı al.', jeton: 2, ok: (w) => w.hh.agil },
  { id: 'suru', grup: 'Toprak', ad: 'Sürü sahibi', desc: 'Kendi koyun sürünü kur.', jeton: 2, ok: (w) => (w.hh.suru || 0) >= 30 },

  // ---- Para ----
  { id: 'bin', grup: 'Para', ad: 'İlk birikim', desc: 'Kasanda bin lira biriktir.', jeton: 1, ok: (w) => w.hh.cash >= 1000 },
  { id: 'onbin', grup: 'Para', ad: 'Eli para gören', desc: 'On bin lira biriktir.', jeton: 2, ok: (w) => w.hh.cash >= 10_000 },
  { id: 'yuzbin', grup: 'Para', ad: 'Varlıklı', desc: 'Yüz bin lira biriktir.', jeton: 4, ok: (w) => w.hh.cash >= 100_000 },
  { id: 'milyon', grup: 'Para', ad: 'Milyoner', desc: 'Bir milyon lira biriktir.', jeton: 8, ok: (w) => w.hh.cash >= 1_000_000 },
  { id: 'borcsuz', grup: 'Para', ad: 'Borçtan kurtul', desc: 'Ağaya olan borcunu tamamen kapat.', jeton: 2, ok: (w) => w.hh.debt <= 0 && year(w.m) > (w.y0 || 1925) },

  // ---- Nam ve saygı ----
  { id: 'ilerigelen', grup: 'İtibar', ad: 'Köyün ileri geleni', desc: 'Namını 35\'e çıkar.', jeton: 2, ok: (w) => nam(w) >= 35 },
  { id: 'esraf', grup: 'İtibar', ad: 'Eşraftan', desc: 'Namını 60\'a çıkar.', jeton: 4, ok: (w) => nam(w) >= 60 },
  { id: 'aga', grup: 'İtibar', ad: 'Ağa', desc: 'Namını 90\'a çıkar; köyün ağası ol.', jeton: 7, ok: (w) => nam(w) >= 90 },
  { id: 'sevilen', grup: 'İtibar', ad: 'Sevilen adam', desc: 'Saygını korkundan yüksek tut (saygı 55+).', jeton: 3, ok: (w) => saygi(w) >= 55 && saygi(w) > korku(w) },
  { id: 'korkulan', grup: 'İtibar', ad: 'Korkulan adam', desc: 'Korkunu 60\'a çıkar.', jeton: 3, ok: (w) => korku(w) >= 60 },
  { id: 'muhtar', grup: 'İtibar', ad: 'Muhtar', desc: 'Köy muhtarı seçil.', jeton: 3, ok: (w) => w.pol.seat === 'muhtar' || w.flags.exMuhtar === 1 },
  { id: 'belediye', grup: 'İtibar', ad: 'Belediye başkanı', desc: 'Belediye başkanı ol.', jeton: 5, ok: (w) => w.pol.seat === 'belediye' || w.flags.exBelediye === 1 },
  { id: 'vekil', grup: 'İtibar', ad: 'Milletvekili', desc: 'Meclise gir.', jeton: 7, ok: (w) => w.pol.seat === 'vekil' || w.flags.exVekil === 1 },

  // ---- Temiz yol ----
  { id: 'temiztapu', grup: 'Temiz yol', ad: 'Alnı ak toprak sahibi', desc: 'Hiç kayıt dışı işe bulaşmadan tarla sahibi ol.', jeton: 4, ok: (w) => w.hh.parcels.length >= 1 && temiz(w) },
  { id: 'temiz10', grup: 'Temiz yol', ad: 'On yıl lekesiz', desc: 'On yıl boyunca hiç kayıt dışı işe bulaşma.', jeton: 5, ok: (w) => cleanYears(w) >= 10 },
  { id: 'temiz25', grup: 'Temiz yol', ad: 'Çeyrek asır lekesiz', desc: 'Yirmi beş yıl boyunca hiç kayıt dışı işe bulaşma.', jeton: 9, ok: (w) => cleanYears(w) >= 25 },
  { id: 'hayir', grup: 'Temiz yol', ad: 'Hayır sahibi', desc: 'Köye hayır işleriyle değer kat.', jeton: 4, ok: (w) => Number(w.flags.hayirPuan || 0) >= 10 },

  // ---- Aile ----
  { id: 'evlen', grup: 'Aile', ad: 'Ocağı tüttür', desc: 'Evlen ve yuvanı kur.', jeton: 1, ok: (w) => { const pl = P(w, w.playerId); return !!pl?.sp; } },
  { id: 'ilktorun', grup: 'Aile', ad: 'İlk torun', desc: 'Torun sahibi ol.', jeton: 2, ok: (w) => { const pl = P(w, w.playerId); if (!pl) return false; return pl.kids.some((k) => (w.people[k]?.kids.length || 0) > 0); } },
  { id: 'kalabalik', grup: 'Aile', ad: 'Kalabalık hane', desc: 'On canın bir arada yaşadığı bir hane kur.', jeton: 3, ok: (w) => hhMembers(w).filter((p) => !p.away).length >= 10 },
  { id: 'nesil3', grup: 'Aile', ad: 'Üçüncü nesil', desc: 'Hanedanı üçüncü nesle taşı.', jeton: 4, ok: (w) => Number(w.flags.nesil || 1) >= 3 },
  { id: 'nesil5', grup: 'Aile', ad: 'Beşinci nesil', desc: 'Hanedanı beşinci nesle taşı.', jeton: 8, ok: (w) => Number(w.flags.nesil || 1) >= 5 },
  { id: 'universite', grup: 'Aile', ad: 'Okumuş evlat', desc: 'Aileden biri üniversite diploması alsın.', jeton: 4, ok: (w) => hhMembers(w).some((p) => !!p.dip) },
  { id: 'doktor', grup: 'Aile', ad: 'Ailede doktor', desc: 'Aileden biri doktor olsun.', jeton: 5, ok: (w) => hasDip(w, 'tip') },
  { id: 'avukat', grup: 'Aile', ad: 'Ailede avukat', desc: 'Aileden biri hukuk okusun.', jeton: 5, ok: (w) => hasDip(w, 'hukuk') },

  // ---- İşletme ----
  { id: 'bakkal', grup: 'İşletme', ad: 'Bakkal', desc: 'Köy bakkalını al.', jeton: 2, ok: (w) => !!w.hh.biz.bakkal },
  { id: 'kahve', grup: 'İşletme', ad: 'Kahvehane', desc: 'Köy kahvehanesinin sahibi ol.', jeton: 3, ok: (w) => !!w.hh.biz.kahve },
  { id: 'degirmen', grup: 'İşletme', ad: 'Değirmen', desc: 'Derenin değirmenini al.', jeton: 3, ok: (w) => !!w.hh.biz.degirmen },
  { id: 'ucisletme', grup: 'İşletme', ad: 'Köyün esnafı', desc: 'Üç köy işletmesini birden tut.', jeton: 4, ok: (w) => Object.keys(w.hh.biz).length >= 3 },

  // ---- Tarım ----
  { id: 'hashasek', grup: 'Tarım', ad: 'Haşhaş hasadı', desc: 'İlk haşhaş hasadını yap.', jeton: 2, ok: (w) => everCrop(w, 'hashas') },
  { id: 'tutun', grup: 'Tarım', ad: 'Tütün', desc: 'Tütün yetiştir.', jeton: 2, ok: (w) => everCrop(w, 'tutun') },
  { id: 'cesitli', grup: 'Tarım', ad: 'Bereketli toprak', desc: 'Buğday, arpa, nohut, pancar ve ayçiçeğini bir kez olsun ek.', jeton: 4, ok: (w) => ['bugday', 'arpa', 'nohut', 'pancar', 'aycicegi'].every((c) => everCrop(w, c)) },

  // ---- Teknoloji ----
  { id: 'traktor', grup: 'Teknoloji', ad: 'Traktör', desc: 'İlk traktörünü al.', jeton: 2, ok: (w) => (w.hh.veh.traktor || 0) > 0 },
  { id: 'otomobil', grup: 'Teknoloji', ad: 'Otomobil', desc: 'Otomobil sahibi ol.', jeton: 3, ok: (w) => (w.hh.veh.otomobil || 0) > 0 },
  { id: 'elektrik', grup: 'Teknoloji', ad: 'Elektrik', desc: 'Köye elektrik gelsin.', jeton: 2, ok: (w) => hasTech(w, 'elektrik') },
  { id: 'televizyon', grup: 'Teknoloji', ad: 'Televizyon', desc: 'Televizyon gelsin.', jeton: 2, ok: (w) => hasTech(w, 'tv') },
  { id: 'bilgisayar', grup: 'Teknoloji', ad: 'Bilgisayar çağı', desc: 'Bilgisayarla tanış.', jeton: 3, ok: (w) => hasTech(w, 'bilgisayar') },
  { id: 'cep', grup: 'Teknoloji', ad: 'Cep telefonu', desc: 'Cep telefonu çağına ulaş.', jeton: 3, ok: (w) => hasTech(w, 'cep') },

  // ---- Çatışma ----
  { id: 'ilkbaskin', grup: 'Çatışma', ad: 'İlk baskın', desc: 'Rakip aileye ilk baskınını yap.', jeton: 3, ok: (w) => Number(w.flags.baskinSayi || 0) >= 1 },
  { id: 'rakipsil', grup: 'Çatışma', ad: 'Düşman ocağı söndü', desc: 'Bir rakip aileyi köyden tamamen sil.', jeton: 6, ok: (w) => Number(w.flags.silinenAile || 0) >= 1 },
  { id: 'baris', grup: 'Çatışma', ad: 'Barış sofrası', desc: 'Kan davasını barışla bitir.', jeton: 3, ok: (w) => Number(w.flags.barisSayi || 0) >= 1 },

  // ---- Yeraltı ----
  { id: 'riza', grup: 'Yeraltı', ad: 'Kara Rıza', desc: 'Kara Rıza ile tanış, kayıt dışı işin kapısını arala.', jeton: 2, ok: (w) => !!w.flags.kacakci },
  { id: 'fedai', grup: 'Yeraltı', ad: 'Rıza\'nın adamı', desc: 'Kara Rıza\'nın fedaisi ol.', jeton: 3, ok: (w) => !!w.flags.rizaFedai },
  { id: 'atolye', grup: 'Yeraltı', ad: 'İlk atölye', desc: 'Gizli atölyeni kur.', jeton: 4, ok: (w) => (w.lab?.lvl || 0) >= 1 },
  { id: 'sebeke', grup: 'Yeraltı', ad: 'Şebeke senin', desc: 'Kara Rıza\'yı devir, şebekesini al.', jeton: 6, ok: (w) => w.city.net },
  { id: 'sehir', grup: 'Yeraltı', ad: 'Şehrin kapısı', desc: 'Adını şehre duyur.', jeton: 4, ok: (w) => w.city.open },
  { id: 'tasin', grup: 'Yeraltı', ad: 'Şehre taşın', desc: 'Aileyi şehre taşı.', jeton: 4, ok: (w) => w.city.moved },
  { id: 'fabrika', grup: 'Yeraltı', ad: 'Fabrikatör', desc: 'İlk fabrikanı kur.', jeton: 5, ok: (w) => facCount(w) >= 1 },
  { id: 'ucfabrika', grup: 'Yeraltı', ad: 'Sanayici', desc: 'Üç fabrikayı birden işlet.', jeton: 7, ok: (w) => facCount(w) >= 3 },
  { id: 'mahalle', grup: 'Yeraltı', ad: 'Mahalle senin', desc: 'Bir mahalleyi ele geçir.', jeton: 5, ok: (w) => w.city.turf >= 1 },
  { id: 'baron', grup: 'Yeraltı', ad: 'Baron', desc: 'Yeraltında Baron unvanına ulaş.', jeton: 8, ok: (w) => underTitle(w).ad === 'Baron' || underTitle(w).ad.includes('Baba') },
  { id: 'konsey', grup: 'Yeraltı', ad: 'Konsey', desc: 'Büyük ailelerin Konsey\'ine gir.', jeton: 8, ok: (w) => !!w.flags.konsey },
  { id: 'buyukbaba', grup: 'Yeraltı', ad: 'Büyük Baba', desc: 'En tepeye çık: Büyük Baba ol.', jeton: 15, ok: (w) => w.flags.konsey === 'baba' },
];

/** Kayıt dışı işe ilk bulaşma yılını işaretler (temiz yol görevleri için). */
function markDirty(w: World) {
  if (w.flags.ilkKirliY) return;
  const dirty = w.flags.kacakci || (w.lab && w.lab.lvl >= 1) || kills(w) > 0 || w.hh.parcels.some((f) => f.illegal) || w.hh.stash > 0;
  if (dirty) w.flags.ilkKirliY = year(w.m);
}

/** Her ay tamamlanan görevleri saptar, jeton verir, kart düşer. */
export function monthlyChallenges(w: World) {
  markDirty(w);
  void bloodLiving; void age;
  let newJeton = 0;
  const done: string[] = [];
  for (const c of CHALLENGES) {
    const key = 'ch_' + c.id;
    if (w.flags[key]) continue;
    let ok = false;
    try { ok = c.ok(w); } catch { ok = false; }
    if (ok) {
      w.flags[key] = w.m;
      newJeton += c.jeton;
      w.flags.namBonus = Number(w.flags.namBonus || 0) + Math.min(3, Math.ceil(c.jeton / 2));
      done.push(c.ad);
    }
  }
  if (newJeton > 0) {
    w.flags.jeton = Number(w.flags.jeton || 0) + newJeton;
    const liste = done.slice(0, 3).join(', ') + (done.length > 3 ? ` ve ${done.length - 3} görev daha` : '');
    log(w, `Görev tamam: ${liste}. +${newJeton} jeton kazandın (toplam ${w.flags.jeton}).`, 'olay');
    // Oyuncuyu bölmeden, yalnızca kayda düşsün; çok görev aynı anda bitse tek kart.
    if (done.length) pushCard(w, { id: 'gorev', text: `Yeni görev${done.length > 1 ? 'ler' : ''} tamamlandı: ${liste}. Kazandığın jeton: +${newJeton} (toplam ${w.flags.jeton}). Jetonlar hanedanının itibarını ve ileride açılacak ödülleri belirler.`, opts: [{ t: 'Helal olsun', k: 'ok' }] });
  }
}

export const jeton = (w: World) => Number(w.flags.jeton || 0);
export const challengeDone = (w: World, id: string) => !!w.flags['ch_' + id];
export const challengesDoneCount = (w: World) => CHALLENGES.filter((c) => challengeDone(w, c.id)).length;

// ---------- Jeton ödülleri: biriktirdiğin jetonları kalıcı avantaja çevir ----------
export interface Odul { id: string; ad: string; desc: string; cost: number; }
export const ODULLER: Odul[] = [
  { id: 'servet', ad: 'Servet tohumu', desc: 'Bir çuval altın: kasana tek seferlik büyük bir nakit girer (yaklaşık bir buçuk yıllık gelir).', cost: 5 },
  { id: 'itibar', ad: 'Köklü itibar', desc: 'Köyde adın kalıcı olarak büyür: +12 nam, hiç eksilmez.', cost: 6 },
  { id: 'toprakgozu', ad: 'Toprak gözü', desc: 'Köylüler ve ağa sana toprak satmaya daha yatkın olur; teklif kabul şansın kalıcı artar.', cost: 7 },
  { id: 'usta', ad: 'Usta eli', desc: 'Atölye ve fabrikaların kalıcı olarak %12 daha verimli çalışır.', cost: 9 },
  { id: 'karakutu', ad: 'Kara kutu', desc: 'Aklama kapasiten kalıcı olarak %25 artar: kara paran daha hızlı temizlenir.', cost: 8 },
  { id: 'ocak', ad: 'Sağlam ocak', desc: 'Ailende ölüm riski kalıcı olarak azalır; ocağın kolay sönmez.', cost: 8 },
  { id: 'demir', ad: 'Demir yürek', desc: 'Adamların her baskın ve pusuda daha güçlü; kayıp nadir olur (bir seviye silah gibi).', cost: 10 },
  { id: 'devlet', ad: 'Devlet kapısında dost', desc: 'Jandarmanın dikkati daha hızlı söner, rüşvet pazarlığı kalıcı olarak %20 ucuzlar.', cost: 12 },
];
export const ownsOdul = (w: World, id: string) => !!w.flags['odul_' + id];

export function buyOdul(w: World, id: string): { ok: boolean; msg: string } {
  const d = ODULLER.find((x) => x.id === id);
  if (!d) return { ok: false, msg: 'Böyle bir ödül yok.' };
  if (ownsOdul(w, id)) return { ok: false, msg: 'Bu ödülü zaten aldın.' };
  if (jeton(w) < d.cost) return { ok: false, msg: `${d.cost - jeton(w)} jeton daha gerekiyor.` };
  w.flags.jeton = jeton(w) - d.cost;
  w.flags['odul_' + id] = 1;
  if (id === 'itibar') w.flags.namBonus = Number(w.flags.namBonus || 0) + 12;
  if (id === 'servet') {
    const yillik = Math.max((w.lastIncome || 0) * 12, 3000 * infl(w.m) * (1 + w.hh.parcels.length * 0.4));
    const amt = Math.round(yillik * 1.5 / 500) * 500;
    w.hh.cash += amt;
    log(w, `Jeton ödülü: Servet tohumu — kasaya ${amt.toLocaleString('tr-TR')} lira girdi (-${d.cost} jeton).`, 'para');
  } else {
    log(w, `Jeton ödülü alındı: ${d.ad} (-${d.cost} jeton).`, 'olay');
  }
  return { ok: true, msg: `${d.ad} alındı.` };
}
