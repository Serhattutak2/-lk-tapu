// Meslekler. Ücretler 1965 Türk lirası, aylık. Denge ayarı otomatik testlerle yapılır.
import type { JobId, Person, SkillId, World } from './types';
import { infl, isWorkSeason } from './calendar';
import { age } from './people';

export interface JobDef {
  id: JobId;
  ad: string;
  skill: SkillId | null;
  minAge: number;
  maxAge: number;
  summer: number;   // iş mevsimi (Nisan–Ekim) temel ücret
  winter: number;   // kış temel ücret
  physical: boolean;
  risk: number;     // aylık iş kazası olasılığı
  gain: number;     // aylık beceri kazancı
  desc: string;
  unlock?: (w: World, p: Person) => boolean;
}

export const JOBS: Record<JobId, JobDef> = {
  tarla: { id: 'tarla', ad: 'Tarla gündelikçisi', skill: 'tarim', minAge: 11, maxAge: 70, summer: 215, winter: 50, physical: true, risk: 0.0004, gain: 1.4, desc: 'Ağanın ve büyük çiftçilerin tarlasında gündelik iş. Yazın bol, kışın yok gibi.' },
  kendi: { id: 'kendi', ad: 'Kendi tarlamızda', skill: 'tarim', minAge: 10, maxAge: 75, summer: 0, winter: 0, physical: true, risk: 0.0003, gain: 0, desc: 'Ailenin kendi parselinde çalışır. Parselde iş yokken başkasının tarlasına gündeliğe gider.', unlock: (w) => w.hh.parcels.length > 0 },
  isletme: { id: 'isletme', ad: 'İşletmenin başında', skill: 'ticaret', minAge: 16, maxAge: 80, summer: 0, winter: 0, physical: false, risk: 0, gain: 0, desc: 'Ailenin bakkalını, kahvehanesini ya da değirmenini yönetir. Kazanç işletmenin hesabına yazılır.', unlock: (w) => Object.values(w.hh.biz).some(Boolean) },
  sofor: { id: 'sofor', ad: 'Kamyon şoförü', skill: 'ticaret', minAge: 18, maxAge: 65, summer: 560, winter: 460, physical: false, risk: 0.0012, gain: 0.8, desc: 'Ailenin kamyonuyla nakliye yapar. Yollarda kaza riski var.', unlock: (w, p) => (w.hh.veh.kamyon || 0) > Object.values(w.people).filter((q) => q.job === 'sofor' && q.inHH && q.id !== p.id).length },
  coban: { id: 'coban', ad: 'Çoban', skill: 'tarim', minAge: 10, maxAge: 70, summer: 130, winter: 110, physical: true, risk: 0.0003, gain: 0.8, desc: 'Köyün sürüsünü otlatır. Az ama her ay kazanç.' },
  insaat: { id: 'insaat', ad: 'İnşaat işçisi', skill: 'insaat', minAge: 15, maxAge: 60, summer: 300, winter: 80, physical: true, risk: 0.0014, gain: 1.6, desc: 'İlçedeki şantiyelerde iş. İyi para, ama kaza riski yüksek.' },
  cirak: { id: 'cirak', ad: 'Demirci çırağı', skill: 'zanaat', minAge: 11, maxAge: 30, summer: 80, winter: 80, physical: false, risk: 0.0002, gain: 2.6, desc: 'Az kazanır ama hızlı öğrenir. Yeterince ustalaşınca usta olur.' },
  usta: { id: 'usta', ad: 'Demirci ustası', skill: 'zanaat', minAge: 18, maxAge: 75, summer: 380, winter: 340, physical: false, risk: 0.0002, gain: 0.6, desc: 'Köyün nalını, sabanını yapar. Yıl boyu düzenli kazanç.', unlock: (_w, p) => p.sk.zanaat >= 55 },
  tuccar: { id: 'tuccar', ad: 'Tüccar yanında', skill: 'ticaret', minAge: 16, maxAge: 70, summer: 270, winter: 230, physical: false, risk: 0.0001, gain: 1.8, desc: 'Hububat tüccarının yanında alım satım öğrenir. Bağlantı kazandırır.', unlock: (w) => !!w.flags.tuccar },
  ev: { id: 'ev', ad: 'Ev işleri', skill: null, minAge: 10, maxAge: 99, summer: 0, winter: 0, physical: false, risk: 0, gain: 0, desc: 'Evi çekip çevirir. Hanenin mutfak giderini azaltır, hastalara bakar.' },
  okul: { id: 'okul', ad: 'Okul', skill: null, minAge: 7, maxAge: 15, summer: 0, winter: 0, physical: false, risk: 0, gain: 0, desc: 'Okuyan çocuk ileride daha hızlı öğrenir ve daha iyi işlere girer.' },
  yok: { id: 'yok', ad: 'Boşta', skill: null, minAge: 0, maxAge: 999, summer: 0, winter: 0, physical: false, risk: 0, gain: 0, desc: 'Çalışmıyor.' },
};

export function jobAllowed(w: World, p: Person, j: JobId): boolean {
  const d = JOBS[j];
  const a = age(w, p);
  if (a < d.minAge || a > d.maxAge) return false;
  if (d.unlock && !d.unlock(w, p)) return false;
  return true;
}

export function jobsFor(w: World, p: Person): JobDef[] {
  return Object.values(JOBS).filter((j) => jobAllowed(w, p, j.id));
}

/** Kişinin bu ayki kazancı. */
export function wage(w: World, p: Person): number {
  const d = JOBS[p.job];
  if (!d || p.away) return 0;
  const base = isWorkSeason(w.m) ? d.summer : d.winter;
  if (!base) return 0;
  const sk = d.skill ? p.sk[d.skill] : 0;
  let f = 0.6 + 0.4 * (sk / 100);
  if (d.physical) f *= 0.8 + 0.04 * p.tr.beden;
  const a = age(w, p);
  if (a < 15) f *= 0.6;
  if (a > 60) f *= 0.75;
  if (p.sick) f *= 0.3;
  return Math.round(base * f * infl(w.m));
}

/** Varsayılan iş seçimi: yeni yetişkinler ve yapay zekâ aile üyeleri için. */
export function defaultJob(w: World, p: Person): JobId {
  const a = age(w, p);
  if (a < 7) return 'yok';
  if (a <= 11) return jobAllowed(w, p, 'okul') && w.hh.cash > 300 ? 'okul' : a >= 10 ? 'coban' : 'yok';
  if (a >= 68) return 'ev';
  if (jobAllowed(w, p, 'usta')) return 'usta';
  if (jobAllowed(w, p, 'tuccar') && p.sk.ticaret >= 20) return 'tuccar';
  if (p.sk.zanaat >= 15 && jobAllowed(w, p, 'cirak')) return 'cirak';
  if (p.tr.beden >= 7 && jobAllowed(w, p, 'insaat') && p.sex === 'E') return 'insaat';
  return 'tarla';
}
