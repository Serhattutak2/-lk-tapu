#!/usr/bin/env python3
# App Store metadata'sını (açıklama, anahtar kelimeler, alt başlık, tanıtım metni) ve
# 6.7" ekran görüntülerini App Store Connect'e API ile basar. Yaş derecesi UI'dan işaretlenir.
# Ortam: KID, ISS, P8, APP_ID (bundle), VER. Görüntüler: store/screens/*.png (ada göre sıralı)
import os, sys, time, json, glob, hashlib, urllib.request, urllib.error
import jwt

KID = os.environ["KID"].strip(); ISS = os.environ["ISS"].strip(); P8 = os.environ["P8"]
BUNDLE = os.environ["APP_ID"].strip(); VER = os.environ.get("VER", "1.0").strip()
BASE = "https://api.appstoreconnect.apple.com"
SCREENS = sorted(glob.glob("store/screens/*.png"))

SUBTITLE = "Köyden şehrin babasına"
PROMO = ("Yoksul bir köy ailesinden başla; nesiller boyunca toprağını, işini ve gücünü "
         "büyüt. Her kararın bir bedeli, her neslin bir mirası var.")
KEYWORDS = "hanedan,köy,mafya,simülasyon,strateji,tapu,aile,şehir,nesil,hayat,ekonomi,türk,iş"
DESC = """İlk Tapu, Anadolu'da geçen; nesiller boyu bir hayat, iş ve hanedan simülasyonudur. 1925'te yoksul bir köy ailesinin reisisin; elinde bir çift öküz ve birkaç dönüm umut var. Hikâye senin soyunla sürer.

• TARLADAN TAPUYA: Ekip biç, toprak al, işletme kur. Un fabrikasından otele, nakliyeden bankaya kendi imparatorluğunu büyüt.
• NESİLLER BOYU: Evlen, çocukların olsun, onları yetiştir. Reis ölünce hanedan varise geçer — soyun sürdükçe oyun sürer.
• GÜÇ VE HUSUMET: Kan davaları, rakip aileler, Konsey ve şehrin babalığı için mücadele. Dost edin, pusu kur ya da masanın başına sen otur.
• HER İŞE AYRI KARAR: İnşaata ihale, otele sezon, bankaya şüpheli havale... her işletme kendi kararlarını getirir.
• YÜKSELİŞ VE DÜŞÜŞ: İhanet, baskın, kriz — servetin bir gecede erisin. Parayı yaşamaya da harca: araba, yarış atı, görkemli düğün, yat.

Sade ve okunaklı bir arayüz, resmî evrak gibi duran olay kartları ve Anadolu toprağından ilham alan bir görsel dil.

Reklamlar ödüllüdür ve isteğe bağlıdır; oyunun akışını bozmaz."""
MKT = "https://serhattutak2.github.io"; SUP = "https://serhattutak2.github.io"

def token():
    now = int(time.time())
    return jwt.encode({"iss": ISS, "iat": now, "exp": now + 1000, "aud": "appstoreconnect-v1"},
                      P8, algorithm="ES256", headers={"kid": KID, "typ": "JWT"})

def api(method, path, body=None, raw=None, headers=None):
    url = path if path.startswith("http") else BASE + path
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(url, data=data, method=method)
    if raw is None:
        req.add_header("Authorization", "Bearer " + token()); req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items(): req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            t = r.read().decode() if raw is None else ""
            return r.status, (json.loads(t) if (raw is None and t.strip()) else {})
    except urllib.error.HTTPError as e:
        t = e.read().decode()
        try: j = json.loads(t)
        except Exception: j = {"raw": t[:1500]}
        return e.code, j

def err(r):
    try: return "; ".join((e.get("title","")+": "+e.get("detail","")) for e in r.get("errors", [])) or json.dumps(r)[:600]
    except Exception: return json.dumps(r)[:600]
def die(m, r=None):
    print("HATA:", m);
    if r is not None: print("  ->", err(r))
    sys.exit(1)

# 1) app
st, r = api("GET", f"/v1/apps?filter[bundleId]={BUNDLE}&limit=1")
if st != 200 or not r.get("data"): die("Uygulama bulunamadı", r)
app_id = r["data"][0]["id"]; print("Uygulama:", r["data"][0]["attributes"].get("name"), app_id)

# 2) düzenlenebilir sürüm
st, r = api("GET", f"/v1/apps/{app_id}/appStoreVersions?filter[versionString]={VER}&filter[platform]=IOS&limit=5")
ver_id = r["data"][0]["id"] if r.get("data") else None
if not ver_id:
    st, r = api("POST", "/v1/appStoreVersions", {"data": {"type": "appStoreVersions",
        "attributes": {"platform": "IOS", "versionString": VER},
        "relationships": {"app": {"data": {"type": "apps", "id": app_id}}}}})
    if st not in (200,201): die("Sürüm oluşturulamadı", r)
    ver_id = r["data"]["id"]
print("Sürüm:", VER, ver_id)

# 3) alt başlık (appInfoLocalizations)
st, r = api("GET", f"/v1/apps/{app_id}/appInfos?limit=5")
if r.get("data"):
    info_id = r["data"][0]["id"]
    st, r = api("GET", f"/v1/appInfos/{info_id}/appInfoLocalizations?limit=50")
    for l in r.get("data", []):
        if l["attributes"]["locale"].lower().startswith("tr"):
            st2, r2 = api("PATCH", f"/v1/appInfoLocalizations/{l['id']}",
                {"data": {"type": "appInfoLocalizations", "id": l["id"], "attributes": {"subtitle": SUBTITLE}}})
            print("Alt başlık ->", st2 if st2 == 200 else err(r2))

# 4) sürüm yerelleştirmesi (açıklama/keywords/promo/url)
st, r = api("GET", f"/v1/appStoreVersions/{ver_id}/appStoreVersionLocalizations?limit=50")
locs = r.get("data", [])
tr = next((l for l in locs if l["attributes"]["locale"].lower().startswith("tr")), None)
if not tr:
    st, r = api("POST", "/v1/appStoreVersionLocalizations", {"data": {"type":"appStoreVersionLocalizations",
        "attributes": {"locale":"tr"}, "relationships":{"appStoreVersion":{"data":{"type":"appStoreVersions","id":ver_id}}}}})
    tr = r.get("data")
tr_id = tr["id"]
attrs = {"description": DESC, "keywords": KEYWORDS, "promotionalText": PROMO, "marketingUrl": MKT, "supportUrl": SUP}
st, r = api("PATCH", f"/v1/appStoreVersionLocalizations/{tr_id}",
            {"data": {"type":"appStoreVersionLocalizations","id":tr_id,"attributes":attrs}})
print("Açıklama/keywords/promo ->", st if st == 200 else err(r))

# 5) 6.7" ekran görüntüleri
if SCREENS:
    # set bul/oluştur
    st, r = api("GET", f"/v1/appStoreVersionLocalizations/{tr_id}/appScreenshotSets?limit=50")
    sset = next((s for s in r.get("data", []) if s["attributes"]["screenshotDisplayType"] == "APP_IPHONE_67"), None)
    if not sset:
        st, r = api("POST", "/v1/appScreenshotSets", {"data": {"type":"appScreenshotSets",
            "attributes": {"screenshotDisplayType":"APP_IPHONE_67"},
            "relationships": {"appStoreVersionLocalization":{"data":{"type":"appStoreVersionLocalizations","id":tr_id}}}}})
        if st not in (200,201): die("Ekran görüntüsü seti oluşturulamadı", r)
        sset = r["data"]
    set_id = sset["id"]
    # mevcut görselleri temizle (tekrar koşumda çoğalmasın)
    st, r = api("GET", f"/v1/appScreenshotSets/{set_id}/appScreenshots?limit=50")
    for sc in r.get("data", []): api("DELETE", f"/v1/appScreenshots/{sc['id']}")
    ok_ids = []
    for path in SCREENS:
        blob = open(path, "rb").read(); fn = os.path.basename(path)
        st, r = api("POST", "/v1/appScreenshots", {"data": {"type":"appScreenshots",
            "attributes": {"fileName": fn, "fileSize": len(blob)},
            "relationships": {"appScreenshotSet":{"data":{"type":"appScreenshotSets","id":set_id}}}}})
        if st not in (200,201): print("  görsel rezerve edilemedi", fn, err(r)); continue
        sc = r["data"]; scid = sc["id"]
        for op in sc["attributes"]["uploadOperations"]:
            hdr = {h["name"]: h["value"] for h in op.get("requestHeaders", [])}
            chunk = blob[op["offset"]: op["offset"] + op["length"]]
            s2, _ = api(op["method"], op["url"], raw=chunk, headers=hdr)
            if s2 not in (200, 201, 204): print("  PUT başarısız", fn, s2)
        md5 = hashlib.md5(blob).hexdigest()
        s3, r3 = api("PATCH", f"/v1/appScreenshots/{scid}",
            {"data": {"type":"appScreenshots","id":scid,"attributes":{"uploaded":True,"sourceFileChecksum":md5}}})
        print("  görsel", fn, "->", s3 if s3 == 200 else err(r3))
        if s3 == 200: ok_ids.append(scid)
    # sıralama
    if ok_ids:
        api("PATCH", f"/v1/appScreenshotSets/{set_id}/relationships/appScreenshots",
            {"data": [{"type":"appScreenshots","id":i} for i in ok_ids]})
    print("Yüklenen görsel:", len(ok_ids))
print("METADATA TAMAM ✓")
