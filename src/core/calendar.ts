export const START_YEAR = 1965;
export const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

export const year = (m: number) => START_YEAR + Math.floor(m / 12);
export const monthOf = (m: number) => ((m % 12) + 12) % 12; // 0 = Ocak
export const dateText = (m: number) => `${MONTHS[monthOf(m)]} ${year(m)}`;

/** Fiyat endeksi: ücretler, giderler ve toprak yılda %4,5 pahalanır. */
export const infl = (m: number) => Math.pow(1.045, Math.floor(m / 12));

/** Tarlada iş olan aylar: Nisan–Ekim */
export const isWorkSeason = (m: number) => {
  const mo = monthOf(m);
  return mo >= 3 && mo <= 9;
};

export type Season = 'kis' | 'ilkbahar' | 'yaz' | 'sonbahar';
export function season(m: number): Season {
  const mo = monthOf(m);
  if (mo === 11 || mo <= 1) return 'kis';
  if (mo <= 4) return 'ilkbahar';
  if (mo <= 7) return 'yaz';
  return 'sonbahar';
}
