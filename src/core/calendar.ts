/** Yeni kampanyalar Mart 1925'te başlar. Eski (0.6 ve öncesi) kayıtlar 1965 tabanıyla sürer. */
export const START_YEAR = 1925;
export const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

// Takvim tabanı: World.y0. Tek oyun aynı anda çalıştığı için modül düzeyinde tutulur;
// advance(), newWorld() ve migrate() her seferinde World'den yeniden ayarlar.
let BASE = START_YEAR;
export const setBase = (y: number | undefined) => {
  BASE = y || 1965;
};
export const baseYear = () => BASE;

export const year = (m: number) => BASE + Math.floor(m / 12);
export const monthOf = (m: number) => ((m % 12) + 12) % 12; // 0 = Ocak
export const dateText = (m: number) => `${MONTHS[monthOf(m)]} ${year(m)}`;
/** Belli bir yılın Ocak ayının indeksi */
export const monthAt = (y: number) => (y - BASE) * 12;

/** Fiyat endeksi: ücretler, giderler ve toprak yılda %4,5 pahalanır (kampanya başına göre). */
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

/** Kurban Bayramı'nın yaklaşık ayı: kameri takvim her yıl ~11 gün geri kayar. */
export function kurbanMonth(y: number): number {
  const doy = (((167 + (2024 - y) * 10.875) % 365.25) + 365.25) % 365.25;
  return Math.min(11, Math.floor(doy / 30.44));
}
