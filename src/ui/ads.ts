// Reklam katmanı — AdMob.
// İlk Tapu yavaş, düşündüren bir sim: bannersız, az ve DEĞERLİ reklam. Reklam yalnızca
// native (Capacitor) kabuğun içinde çalışır; web derlemesinde ve testlerde sessizce devre dışıdır.
//
// Native kabuk @capacitor-community/admob eklentisiyle kurulduğunda eklenti
// window.Capacitor.Plugins.AdMob olarak görünür; burada onu RUNTIME'da yokluyoruz,
// böylece web derlemesi hiçbir pakete bağımlı olmadan kurulabiliyor.
//
// TODO (Serhat'tan gelince): İlk Tapu için ayrı bir AdMob uygulaması aç ve gerçek
// reklam birimi kimliklerini aşağıya yaz. Şu an Google'ın resmî TEST kimlikleri kullanılıyor
// (yayına çıkmadan önce mutlaka gerçekleriyle değiştirilecek, yoksa Google hesabı askıya alır).

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

// Gerçek kimlikler buraya; boşken test kimlikleri kullanılır.
const REAL: { rewarded?: string; interstitial?: string } = {};

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
