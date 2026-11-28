// Reklam katmanı — AdMob (İlk Tapu).
// Bannersız, oyunu bloklamayan reklam. Reklam yalnızca native (Capacitor) kabuğun içinde
// çalışır; web derlemesinde ve testlerde sessizce devre dışıdır. Eklenti
// window.Capacitor.Plugins.AdMob olarak RUNTIME'da yoklanır, böylece web derlemesi hiçbir
// pakete bağımlı olmadan kurulabilir.
//
// SIKLIK (Dengeli): geçiş reklamı devir anında + her ~6 oyun yılında bir denenir; ama
// iki reklam arası en az MIN_GAP_MS, oturumun ilk WARMUP_MS'inde hiç. Bu kurallar
// maybeInterstitial() içinde; çağıran taraf sadece "uygun an geldi" der. Ödüllü reklamlar
// her zaman isteğe bağlıdır (oyuncu butona basar).

interface AdMobPlugin {
  initialize(opts?: unknown): Promise<void>;
  prepareRewardVideoAd(opts: { adId: string }): Promise<void>;
  showRewardVideoAd(): Promise<{ type?: string; amount?: number }>;
  prepareInterstitial(opts: { adId: string }): Promise<void>;
  showInterstitial(): Promise<void>;
}

const TEST = {
  // iOS test birimleri (Google resmî)
  rewarded: 'ca-app-pub-3940256099942544/1712485313',
  interstitial: 'ca-app-pub-3940256099942544/4411468910',
};

// Gerçek kimlikler (İlk Tapu AdMob uygulaması). iOS Info.plist'teki GADApplicationIdentifier:
//   ca-app-pub-4873666267587702~6214552881
export const ADMOB_APP_ID = 'ca-app-pub-4873666267587702~6214552881';
const REAL: { rewarded?: string; interstitial?: string } = {
  rewarded: 'ca-app-pub-4873666267587702/5677310929',
  interstitial: 'ca-app-pub-4873666267587702/2254080391',
};

const unit = (k: 'rewarded' | 'interstitial') => REAL[k] || TEST[k];

function plugin(): AdMobPlugin | null {
  const cap = (globalThis as unknown as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { AdMob?: AdMobPlugin } } }).Capacitor;
  if (!cap?.isNativePlatform?.()) return null; // web / test → reklam yok
  return cap.Plugins?.AdMob || null;
}

let inited = false;
export async function adsInit(): Promise<void> {
  const ad = plugin();
  if (!ad || inited) return;
  try {
    await ad.initialize();
    inited = true;
  } catch {
    /* sessiz */
  }
}

/** Reklam bu ortamda hiç gösterilebilir mi (native kabuk var mı)? UI düğmeyi buna göre gösterir. */
export const adsAvailable = (): boolean => !!plugin();

/**
 * Ödüllü video göster. Ödül HAK EDİLİRSE true döner; kullanıcı yarıda bırakır,
 * reklam dolmazsa ya da ortam web ise false döner. Çağıran taraf false'ta ödül VERMEZ.
 */
export async function showRewarded(): Promise<boolean> {
  const ad = plugin();
  if (!ad) return false;
  try {
    await adsInit();
    await ad.prepareRewardVideoAd({ adId: unit('rewarded') });
    const r = await ad.showRewardVideoAd();
    return !!r && (r.type !== undefined || r.amount !== undefined || true);
  } catch {
    return false;
  }
}

/** Tam ekran geçiş reklamı. Hata/boşlukta sessizce geçer; oyunu asla bloklamaz. */
export async function showInterstitial(): Promise<void> {
  const ad = plugin();
  if (!ad) return;
  try {
    await adsInit();
    await ad.prepareInterstitial({ adId: unit('interstitial') });
    await ad.showInterstitial();
  } catch {
    /* sessiz */
  }
}

// ---- Geçiş reklamı sıklık kapısı (Dengeli) ----
const MIN_GAP_MS = 90_000; // iki geçiş reklamı arası en az 90 sn
const WARMUP_MS = 60_000; // oturumun ilk 60 sn'sinde geçiş reklamı yok
let adSessionStart = Date.now();
let lastInterAt = 0;

/** Yeni oyun/oturum başında sıklık sayaçlarını sıfırla. */
export function adsResetSession(): void {
  adSessionStart = Date.now();
  lastInterAt = 0;
}

/**
 * Sıklık kurallarına uyarak geçiş reklamı DENER. Gösterdiyse (ya da göstermeyi denediyse)
 * true, kural gereği atladıysa false döner. Reklam dolmazsa sessizce geçer, oyun bloklanmaz.
 */
export async function maybeInterstitial(): Promise<boolean> {
  const ad = plugin();
  if (!ad) return false;
  const now = Date.now();
  if (now - adSessionStart < WARMUP_MS) return false; // oturum ısınması
  if (now - lastInterAt < MIN_GAP_MS) return false; // çok sık olmasın
  lastInterAt = now;
  await showInterstitial();
  return true;
}
