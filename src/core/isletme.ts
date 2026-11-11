// İşletmelere TÜRÜNE ÖZEL kararlar. Amaç: her fabrikaya aynı soruyu sormamak —
// inşaata ihale/kaçak kat, otele sezon, bankaya şüpheli havale, gazinoya büyük gece...
// Mevcut para akışını bozmaz; ara sıra gelen seçimlerle derinlik katar.
import type { World, FacId } from './types';
import { chance, clamp, pick, rint } from './rng';
import { log } from './people';
import { infl } from './calendar';
import { pushCard } from './cards';
import { FACS, facN, facDown, facLevel } from './baron';
import { aliveFams } from './aile';

const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR');
const addDirty = (w: World, n: number) => (w.dirty += n);
const addCash = (w: World, n: number) => (w.hh.cash += n);
const addNam = (w: World, n: number) => (w.flags.namBonus = Number(w.flags.namBonus || 0) + n);
const heat = (w: World, n: number) => (w.heat = clamp(w.heat + n, 0, 100));
const spend = (w: World, n: number) => { const c = Math.min(w.hh.cash, n); w.hh.cash -= c; w.dirty = Math.max(0, w.dirty - (n - c)); };

// Her işletme türünü bir karar grubuna eşle (benzer iş, ayrı soru).
type Grup = 'gida' | 'lojistik' | 'insaat' | 'turizm' | 'gazino' | 'tekstil' | 'banka' | 'medya';
function grup(f: FacId): Grup | null {
  if (f === 'un' || f === 'konserve' || f === 'sarap') return 'gida';
  if (f === 'nakliye' || f === 'liman') return 'lojistik';
  if (f === 'insaat' || f === 'cimento') return 'insaat';
  if (f === 'otel') return 'turizm';
  if (f === 'gazino') return 'gazino';
  if (f === 'tekstil') return 'tekstil';
  if (f === 'banka') return 'banka';
  if (f === 'medya') return 'medya';
  return null;
}

export function isletmeCards(w: World): boolean {
  if (w.over || w.flags.interregnum) return false;
  if (Number(w.flags.islNext || 0) > w.m) return false;
  const owned = (Object.keys(FACS) as FacId[]).filter((f) => facN(w, f) > 0 && !facDown(w, f) && grup(f));
  if (!owned.length) return false;
  if (!chance(w, 0.06)) return false;
  w.flags.islNext = w.m + rint(w, 10, 22);
  const f = pick(w, owned);
  const g = grup(f)!;
  const lv = facLevel(w, f);
  const birim = Math.round(rint(w, 10, 22) * 1000 * infl(w.m) * lv); // kararın parasal ölçeği
  const ad = FACS[f].ad;
  const mk = (text: string, opts: { t: string; k: string }[]) => pushCard(w, { id: `isl_${g}`, text, opts, data: { f, birim } });

  if (g === 'gida') mk(
    `${ad}nda sezon başlıyor. Kendi tarlalarının ürününü idareli mi işleyelim, yoksa dışarıdan pahalı hammadde alıp tam kapasite mi çalışalım?`,
    [{ t: 'Kendi ürünümüz yeter, idareli çalış', k: 'kendi' }, { t: `Dışarıdan al, tam kapasite (${fmt(birim)} lira)`, k: 'tam' }]);
  else if (g === 'lojistik') mk(
    f === 'liman'
      ? `${ad}ne gece yarısı bir gemi yanaştı: içinde sorulmayan konteynerler var. Geçişine göz yumarsan kasa dolar ama iz kalır.`
      : `${ad}nin kamyonları gündüz un taşıyor. Birileri gece için "ağzı kapalı" bir yük teklif ediyor: iyi para, ama riskli.`,
    [{ t: 'Kaçak yükü al, ağzını açma', k: 'kacak' }, { t: 'Sadece yasal taşı', k: 'temiz' }]);
  else if (g === 'insaat') mk(
    `${ad} belediyeden ihale aldı. Projeye ruhsatsız birkaç kat fazla çıkarsan büyük para var — ama bir gün tepene yıkılabilir.`,
    [{ t: 'Ruhsatsız fazla kat çık (çok para, risk)', k: 'kacak' }, { t: 'Kurallara uy, temiz teslim et', k: 'kural' }]);
  else if (g === 'turizm') mk(
    `${ad}nde yaz sezonu kapıda. Stratejin ne olsun?`,
    [{ t: 'Her şey dahil, kitle turizmi (çok ciro)', k: 'kitle' }, { t: 'Butik lüks otel (az ama itibar)', k: 'butik' }]);
  else if (g === 'gazino') mk(
    `${ad}na ünlü bir ses sanatçısı için büyük bir gece öneriliyor: dolu masalar, pahalı içki, şehrin zenginleri... ama böyle geceler polisin de dikkatini çeker.`,
    [{ t: 'Büyük şov gecesini düzenle (çok nakit)', k: 'buyuk' }, { t: 'Sakin işlet, dikkat çekme', k: 'sakin' }]);
  else if (g === 'tekstil') mk(
    `${ad}na büyük bir ihracat siparişi geldi. Yetiştirmek için işçiyi fazla mesaiye zorlaman gerek.`,
    [{ t: 'Fazla mesaiyle yetiştir (büyük sipariş)', k: 'mesai' }, { t: 'İşçiyi zorlama, normal çalış', k: 'normal' }]);
  else if (g === 'banka') mk(
    `${ad}na şüpheli ama çok büyük bir havale geliyor: aklanmak isteyen kirli para. Komisyonu yüksek, denetim riski de öyle.`,
    [{ t: 'Transferi akla (büyük komisyon)', k: 'akla' }, { t: 'Reddet, temiz kal', k: 'ret' }]);
  else mk( // medya
    `${ad}nda yarının manşetini sen belirliyorsun. Kalemi nereye çevirelim?`,
    [{ t: 'Bir hasmını manşetten vur, karala', k: 'karala' }, { t: 'Kendini akla, itibarını parlat', k: 'parlat' }, { t: 'Tarafsız kal', k: 'tarafsiz' }]);
  return true;
}

export function resolveIsletme(w: World, id: string, k: string, data?: Record<string, unknown>): boolean {
  if (!id.startsWith('isl_')) return false;
  const f = String(data?.f || '') as FacId;
  const birim = Number(data?.birim || 10000);
  const ad = FACS[f]?.ad || 'İşletme';
  const g = id.slice(4) as Grup;

  if (g === 'gida') {
    if (k === 'tam') { spend(w, birim); const sat = Math.round(birim * (1.4 + rint(w, 0, 8) / 10)); addCash(w, sat); log(w, `${ad} tam kapasite çalıştı; dışarıdan alınan hammadde ${fmt(sat)} lira olarak döndü.`, 'para'); }
    else { addCash(w, Math.round(birim * 0.5)); addNam(w, 2); log(w, `${ad} kendi ürününü işledi; köylü memnun, kazanç mütevazı ama temiz.`, 'para'); }
  } else if (g === 'lojistik') {
    if (k === 'kacak') { addDirty(w, Math.round(birim * 1.8)); heat(w, 10); log(w, `${ad} gece yükünü taşıdı; kara kasaya ${fmt(Math.round(birim * 1.8))} lira girdi ama jandarmanın gözü üstünde.`, 'para'); }
    else { addCash(w, Math.round(birim * 0.6)); log(w, `${ad} yalnızca yasal yük taşıdı; az ama sorunsuz kazanç.`, 'para'); }
  } else if (g === 'insaat') {
    if (k === 'kacak') {
      const kar = Math.round(birim * 2.2); addCash(w, kar); heat(w, 12);
      log(w, `${ad} ruhsatsız katları da dikti; ${fmt(kar)} lira kâr. Umulur ki bir gün hesabı sorulmaz.`, 'para');
      if (chance(w, 0.18)) { const ceza = Math.round(kar * 1.1); spend(w, ceza); addNam(w, -8); heat(w, 15); log(w, `Derken bir bina çürük çıktı/çöktü; dava, tazminat, manşet: ${fmt(ceza)} liralık darbe ve lekelenen bir ad.`, 'olay'); }
    } else { addCash(w, Math.round(birim * 1.1)); addNam(w, 4); log(w, `${ad} işi kurallara göre teslim etti; sağlam yapı, sağlam itibar.`, 'para'); }
  } else if (g === 'turizm') {
    if (k === 'kitle') { addCash(w, Math.round(birim * 1.9)); heat(w, 3); log(w, `${ad} tıklım tıklım doldu; ciro ${fmt(Math.round(birim * 1.9))} lira, ama tesis yıprandı.`, 'para'); }
    else { addCash(w, Math.round(birim * 0.9)); addNam(w, 6); log(w, `${ad} butik lüks çizgisine geçti; az misafir, çok itibar.`, 'para'); }
  } else if (g === 'gazino') {
    if (k === 'buyuk') { addDirty(w, Math.round(birim * 1.6)); heat(w, 12); log(w, `${ad}nda büyük şov gecesi: sanatçı sahnedeydi, masalar doldu taştı, kara kasa şişti; polis de not aldı.`, 'para'); }
    else { addCash(w, Math.round(birim * 0.5)); log(w, `${ad} sakin bir gece geçirdi; az kazanç, sıfır dikkat.`, 'para'); }
  } else if (g === 'tekstil') {
    if (k === 'mesai') {
      const kar = Math.round(birim * 1.8); addCash(w, kar);
      log(w, `${ad} büyük ihracat siparişini fazla mesaiyle yetiştirdi: ${fmt(kar)} lira.`, 'para');
      if (chance(w, 0.25)) { heat(w, 4); addNam(w, -5); log(w, `Ama işçiler greve gitti; bir süre üretim aksadı, kapıda pankartlar.`, 'olay'); }
    } else { addCash(w, Math.round(birim * 0.9)); log(w, `${ad} normal temposunda çalıştı; düzenli, huzurlu.`, 'para'); }
  } else if (g === 'banka') {
    if (k === 'akla') {
      const akla = Math.min(w.dirty, Math.round(birim * 3)); w.dirty -= akla; addCash(w, Math.round(akla * 0.88)); heat(w, 8);
      log(w, `${ad} şüpheli havaleyi akladı; ${fmt(akla)} liralık kara para temizlendi (komisyon düşüldü). Denetçiler kıpırdandı.`, 'para');
    } else { addNam(w, 3); log(w, `${ad} şüpheli transferi geri çevirdi; temiz banka imajı korundu.`, 'olay'); }
  } else { // medya
    if (k === 'karala') {
      heat(w, -8);
      const hasim = aliveFams(w).filter((x) => x.id !== w.city.baba && x.bond < 0).sort((a, b) => a.bond - b.bond)[0];
      if (hasim) { hasim.bond = clamp(hasim.bond - 15, -100, 100); log(w, `${ad} ${hasim.ad} ailesini manşetten vurdu; itibarları sarsıldı, sana kinleri büyüdü.`, 'olay'); }
      else log(w, `${ad} bir rakibi manşetten yıprattı; kamuoyu senden yana döndü.`, 'olay');
    } else if (k === 'parlat') { heat(w, -6); addNam(w, 6); log(w, `${ad} senin lehine haberler yaptı; adın hayırla, güçle anıldı.`, 'olay'); }
    else log(w, `${ad} bu kez tarafsız kaldı; herkes "demek ki namuslu" dedi.`, 'olay');
  }
  return true;
}
