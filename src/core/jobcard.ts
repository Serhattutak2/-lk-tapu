// Meslek kartı: aileden biri çalışma çağına gelince ya da okuldan mezun olunca ne iş yapacağını oyuncu seçer.
// "Otomatik meslek" açıksa (Aile sekmesinden) oyuncu uğraşmaz, en uygun işe yollanır. Bot hep otomatik seçer.
import type { JobId, Person, World } from './types';
import { clamp } from './rng';
import { age, alive, fullName, hhMembers, P, relationTo } from './people';
import { JOBS, jobsFor, defaultJob } from './jobs';

/** Kişinin hangi kilometre taşında olduğu: çocuk, genç, yetişkin, mezun */
function milestone(w: World, p: Person): string {
  if (p.dip && p.job === 'yok') return 'mezun:' + p.dip;
  const a = age(w, p);
  if (a < 12) return 'cocuk';
  if (a < 16) return 'genc';
  return 'yetiskin';
}

/** Karar bekleyen biri var mı? job 'yok' ya da 15 üstü hâlâ 'okul'. */
function needsJob(w: World, p: Person): boolean {
  if (!p.inHH || p.away || !alive(p)) return false;
  if (age(w, p) < 7) return false;
  if (Number(w.flags['isBos' + p.id] || 0) > w.m) return false;
  if (p.job === 'yok') return true;
  if (p.job === 'okul' && age(w, p) > 15) return true;
  return false;
}

/** Oyun başındaki aileyi karttan muaf tut: mevcut kilometre taşını işaretle. */
export function seedJobMilestone(w: World, p: Person) {
  w.flags['ms_' + p.id] = milestone(w, p);
}

export function jobCards(w: World): boolean {
  const cand = hhMembers(w).sort((a, b) => a.b - b.b).find((p) => needsJob(w, p));
  if (!cand) return false;
  const ms = milestone(w, cand);
  w.flags['ms_' + cand.id] = ms;
  if (w.flags.otoMeslek) {
    cand.job = defaultJob(w, cand);
    cand.parcel = undefined;
    return false;
  }
  const opts = jobsFor(w, cand)
    .filter((j) => j.id !== 'yok' && (j.id !== 'kendi' || w.hh.parcels.length > 0))
    .map((j) => ({ t: jobLabel(j.id, cand), k: j.id }));
  if (!opts.length) return false;
  opts.push({ t: 'Şimdilik boşta kalsın (bir yıl sorma)', k: 'yok' });
  const pl = P(w, w.playerId);
  const rel = alive(pl) ? relationTo(w, pl!, cand).toLowerCase() : 'aileden biri';
  const dipText = cand.dip ? ` ${cand.dip === 'tip' ? 'Doktor' : cand.dip === 'hukuk' ? 'Avukat' : cand.dip === 'muh' ? 'Mühendis' : 'Öğretmen'} diploması var.` : '';
  const first = w.m <= 3 && !w.flags.ilkMeslek;
  const text = first
    ? `Mart 1925. Ailenin bu yıl ne iş yapacağına sen karar veriyorsun. ${fullName(cand)} (${cand.id === w.playerId ? 'sen' : rel}, ${age(w, cand)}). Yeteneği: ${skills(cand)}. Ne yapsın?`
    : cand.id === w.playerId
      ? `Sen (${fullName(cand)}, ${age(w, cand)}) bundan sonra ne iş yapacaksın?`
      : ms === 'cocuk'
    ? `${fullName(cand)} (${rel}, ${age(w, cand)}) artık bir işe yarayacak yaşta. Ne yapsın?`
    : ms.startsWith('mezun')
      ? `${fullName(cand)} (${rel}, ${age(w, cand)}) okulu bitirdi.${dipText} Hangi işe girsin?`
      : `${fullName(cand)} (${rel}, ${age(w, cand)}) çalışma çağına geldi. Yeteneği: ${skills(cand)}. Ne iş yapsın?`;
  w.cards.push({ uid: w.nextCard++, id: 'meslek:' + cand.id, m: w.m, pid: cand.id, text, opts });
  w.flags.kartSay = Number(w.flags.kartSay || 0) + 1;
  return true;
}

function skills(p: Person): string {
  const s = (Object.entries(p.sk) as [string, number][]).filter(([, v]) => v >= 10).sort((a, b) => b[1] - a[1])[0];
  const z = p.tr.zeka >= 8 ? 'çok zeki' : p.tr.beden >= 8 ? 'güçlü kuvvetli' : p.tr.hirs >= 8 ? 'hırslı' : 'sakin';
  const ad = s ? ({ tarim: 'tarım', insaat: 'inşaat', zanaat: 'zanaat', ticaret: 'ticaret' } as Record<string, string>)[s[0]] : '';
  return ad ? `${ad}a yatkın, ${z}` : z;
}

export function jobLabel(j: JobId, p?: Person): string {
  const d = JOBS[j];
  const notes: Partial<Record<JobId, string>> = {
    tarla: 'günübirlik, az ama hazır para',
    kendi: 'kendi tarlamızda',
    okul: 'okusun, ileride iyi iş',
    coban: 'sürüye baksın',
    cirak: 'zanaat öğrensin, az kazanır',
    insaat: 'iyi para, kaza riski',
    tuccar: 'alışverişi öğrensin',
    univ: 'üniversiteye gitsin (4 yıl masraf)',
    doktor: 'ailenin sağlığına baksın',
    avukat: 'hapis cezalarını kısaltır',
    muhendis: 'fabrikaları büyütür',
    ogretmen: 'köyde saygın, düzenli maaş',
    ev: 'ev işleri, mutfak gideri azalır',
    lab: 'atölyede',
    isletme: 'işletmenin başına',
    sofor: 'kamyon şoförü',
    usta: 'demirci ustası',
    berber: 'köyün dedikoducu berberi',
    asci: 'düğün aşçısı, mutfak gideri azalır',
    ebe: 'çocuk doğurtur, doğumlar sağlıklı',
    imam: 'köyün imamı, saygı getirir',
    postaci: 'mektup ve havale taşır',
    terzi: 'çeyiz ve elbise diker',
    gazeteci: 'manşeti yumuşatır',
    mimar: 'fabrika ve apartman çizer',
    bankaci: 'para işlerini bilir',
    sarkici: 'gazino sahnesinde yıldız',
  };
  return `${d.ad}${notes[j] ? ` — ${notes[j]}` : ''}`;
}

export function resolveJobCard(w: World, id: string, k: string): boolean {
  if (!id.startsWith('meslek:')) return false;
  const p = P(w, id.slice(7));
  if (!alive(p)) return true;
  const j = k as JobId;
  if (j === 'yok') {
    p.job = 'yok';
    w.flags['isBos' + p.id] = w.m + 12;
    return true;
  }
  if (!JOBS[j]) return true;
  if (j === 'kendi') {
    const best = [...w.hh.parcels].sort((a, b) => a.no - b.no)[0];
    if (best) { p.job = 'kendi'; p.parcel = best.id; return true; }
  }
  p.job = j;
  p.parcel = undefined;
  p.biz = undefined;
  if (j === 'univ') w.flags['okul' + p.id] = w.m;
  p.rel = clamp(p.rel + 4, -100, 100);
  return true;
}
