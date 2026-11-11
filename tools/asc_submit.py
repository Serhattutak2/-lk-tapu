#!/usr/bin/env python3
# App Store Connect'e herkese açık sürüm gönderimi (yalnız gerekli adımlar).
# Ortam: KID, ISS, P8 (ASC API anahtarı), APP_ID (bundle id), VER, TR_NOTES, EN_NOTES, AUTO_RELEASE
import os, sys, time, json, urllib.request, urllib.error
import jwt  # PyJWT + cryptography (ES256)

KID = os.environ["KID"].strip()
ISS = os.environ["ISS"].strip()
P8  = os.environ["P8"]
BUNDLE = os.environ["APP_ID"].strip()
VER = os.environ["VER"].strip()
TR  = os.environ.get("TR_NOTES", "")
EN  = os.environ.get("EN_NOTES", TR)
AUTO = os.environ.get("AUTO_RELEASE", "1") == "1"
MKT = os.environ.get("MARKETING_URL", "https://serhattutak2.github.io").strip()
SUP = os.environ.get("SUPPORT_URL", "https://serhattutak2.github.io/destek.html").strip()
BASE = "https://api.appstoreconnect.apple.com"

def token():
    now = int(time.time())
    return jwt.encode({"iss": ISS, "iat": now, "exp": now + 1000, "aud": "appstoreconnect-v1"},
                      P8, algorithm="ES256", headers={"kid": KID, "typ": "JWT"})

def api(method, path, body=None):
    url = path if path.startswith("http") else BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", "Bearer " + token())
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            t = r.read().decode()
            return r.status, (json.loads(t) if t.strip() else {})
    except urllib.error.HTTPError as e:
        t = e.read().decode()
        try: j = json.loads(t)
        except Exception: j = {"raw": t[:1500]}
        return e.code, j

def errtxt(r):
    try: return "; ".join((e.get("title","")+": "+e.get("detail","")) for e in r.get("errors", [])) or json.dumps(r)[:800]
    except Exception: return json.dumps(r)[:800]

def die(msg, r=None):
    print("HATA:", msg)
    if r is not None: print("  ->", errtxt(r))
    sys.exit(1)

# 1) App id
st, r = api("GET", f"/v1/apps?filter[bundleId]={BUNDLE}&limit=1")
if st != 200 or not r.get("data"): die("Uygulama bulunamadı (API anahtarı/erişim?)", r)
app_id = r["data"][0]["id"]
print("Uygulama:", r["data"][0]["attributes"].get("name"), app_id)

# 2) Düzenlenebilir 4.3 (IOS) sürümü bul ya da oluştur
st, r = api("GET", f"/v1/apps/{app_id}/appStoreVersions?filter[versionString]={VER}&filter[platform]=IOS&limit=5")
ver_id, state = None, None
for v in r.get("data", []):
    ver_id, state = v["id"], v["attributes"]["appStoreState"]; break
if not ver_id:
    st, r = api("POST", "/v1/appStoreVersions", {"data": {"type": "appStoreVersions",
        "attributes": {"platform": "IOS", "versionString": VER},
        "relationships": {"app": {"data": {"type": "apps", "id": app_id}}}}})
    if st not in (200, 201): die("Sürüm oluşturulamadı", r)
    ver_id, state = r["data"]["id"], r["data"]["attributes"]["appStoreState"]
    print("Sürüm oluşturuldu:", VER, ver_id, state)
else:
    print("Sürüm mevcut:", VER, ver_id, state)

# 3) Yayın tipi: onaylanınca otomatik
rel = "AFTER_APPROVAL" if AUTO else "MANUAL"
st, r = api("PATCH", f"/v1/appStoreVersions/{ver_id}",
            {"data": {"type": "appStoreVersions", "id": ver_id, "attributes": {"releaseType": rel}}})
print("Yayın tipi:", rel, "->", st if st == 200 else errtxt(r))

# 4) "Yenilikler" notu (whatsNew) her yerele
st, r = api("GET", f"/v1/appStoreVersions/{ver_id}/appStoreVersionLocalizations?limit=50")
locs = r.get("data", [])
if not locs:
    # yerel yoksa tr + en-US oluştur
    for loc in ("tr", "en-US"):
        note = TR if loc.lower().startswith("tr") else EN
        api("POST", "/v1/appStoreVersionLocalizations", {"data": {"type": "appStoreVersionLocalizations",
            "attributes": {"locale": loc, "whatsNew": note},
            "relationships": {"appStoreVersion": {"data": {"type": "appStoreVersions", "id": ver_id}}}}})
    st, r = api("GET", f"/v1/appStoreVersions/{ver_id}/appStoreVersionLocalizations?limit=50")
    locs = r.get("data", [])
print("Yereller:", [l["attributes"]["locale"] for l in locs])
for l in locs:
    loc, lid = l["attributes"]["locale"], l["id"]
    note = TR if loc.lower().startswith("tr") else (EN if loc.lower().startswith("en") else TR)
    attrs = {"whatsNew": note}
    if MKT: attrs["marketingUrl"] = MKT      # app-ads.txt doğrulaması için geliştirici sitesi
    if SUP: attrs["supportUrl"] = SUP
    st2, r2 = api("PATCH", f"/v1/appStoreVersionLocalizations/{lid}",
                  {"data": {"type": "appStoreVersionLocalizations", "id": lid, "attributes": attrs}})
    print("  not+URL", loc, "->", st2 if st2 == 200 else errtxt(r2))

# 4b) Yaş derecesi (ageRatingDeclaration) — mafya/şiddet hafif, benzetim kumar var -> 17+
AGE = {
    "violenceCartoonOrFantasy": "NONE",
    "violenceRealistic": "INFREQUENT_OR_MILD",
    "violenceRealisticProlongedGraphicOrSadistic": "NONE",
    "profanityOrCrudeHumor": "NONE",
    "matureOrSuggestiveThemes": "INFREQUENT_OR_MILD",
    "horrorOrFearThemes": "NONE",
    "medicalOrTreatmentInformation": "NONE",
    "alcoholTobaccoOrDrugUseOrReferences": "INFREQUENT_OR_MILD",
    "gamblingSimulated": "NONE",
    "sexualContentOrNudity": "NONE",
    "sexualContentGraphicAndNudity": "NONE",
    "contests": "NONE",
    "gambling": False,
    "unrestrictedWebAccess": False,
    "kidsAgeBand": None,
    # 2025'te eklenen zorunlu alanlar
    "advertising": True,            # AdMob reklamları var
    "socialMedia": False,
    "messagingAndChat": False,
    "userGeneratedContent": False,
    "parentalControls": False,
    "ageAssurance": False,
    "healthOrWellnessTopics": False,
    "lootBox": False,
    "gunsOrOtherWeapons": "INFREQUENT_OR_MILD",
}
ard_id = None
sti, ri = api("GET", f"/v1/apps/{app_id}/appInfos?limit=1")
if sti == 200 and ri.get("data"):
    sta, ra = api("GET", f"/v1/appInfos/{ri['data'][0]['id']}/ageRatingDeclaration")
    if sta == 200 and ra.get("data"): ard_id = ra["data"]["id"]
if not ard_id:
    sta, ra = api("GET", f"/v1/appStoreVersions/{ver_id}/ageRatingDeclaration")
    if sta == 200 and ra.get("data"): ard_id = ra["data"]["id"]
if ard_id:
    st, r = api("PATCH", f"/v1/ageRatingDeclarations/{ard_id}",
                {"data": {"type": "ageRatingDeclarations", "id": ard_id, "attributes": AGE}})
    print("Yaş derecesi ->", st if st == 200 else errtxt(r))
else:
    print("Yaş derecesi bildirimi bulunamadı (UI'dan işaretlenebilir).")

# 4c) İçerik hakları beyanı
st, r = api("PATCH", f"/v1/apps/{app_id}",
            {"data": {"type": "apps", "id": app_id, "attributes": {"contentRightsDeclaration": "DOES_NOT_USE_THIRD_PARTY_CONTENT"}}})
print("İçerik hakları ->", st if st == 200 else errtxt(r))

# 4d) Kategori (Oyun / Simülasyon + Strateji)
sti, ri = api("GET", f"/v1/apps/{app_id}/appInfos?limit=1")
if ri.get("data"):
    info_id = ri["data"][0]["id"]
    rel = {
        "primaryCategory": {"data": {"type": "appCategories", "id": "GAMES"}},
        "primarySubcategoryOne": {"data": {"type": "appCategories", "id": "GAMES_SIMULATION"}},
        "primarySubcategoryTwo": {"data": {"type": "appCategories", "id": "GAMES_STRATEGY"}},
    }
    st, r = api("PATCH", f"/v1/appInfos/{info_id}", {"data": {"type": "appInfos", "id": info_id, "relationships": rel}})
    print("Kategori ->", st if st == 200 else errtxt(r))

# 4e) App Review iletişim + giriş gerekmiyor
CONTACT = {"contactFirstName": "Serhat", "contactLastName": "Tutak", "contactPhone": "+905059954165",
           "contactEmail": "serhattutak2@gmail.com", "demoAccountRequired": False,
           "demoAccountName": "", "demoAccountPassword": "", "notes": ""}
st, r = api("GET", f"/v1/appStoreVersions/{ver_id}/appStoreReviewDetail")
if st == 200 and r.get("data"):
    rid = r["data"]["id"]
    st, r = api("PATCH", f"/v1/appStoreReviewDetails/{rid}",
                {"data": {"type": "appStoreReviewDetails", "id": rid, "attributes": CONTACT}})
else:
    st, r = api("POST", "/v1/appStoreReviewDetails",
                {"data": {"type": "appStoreReviewDetails", "attributes": CONTACT,
                          "relationships": {"appStoreVersion": {"data": {"type": "appStoreVersions", "id": ver_id}}}}})
print("Review iletişim ->", st if st in (200, 201) else errtxt(r))

# 4f) Telif hakkı (zorunlu alan)
st, r = api("PATCH", f"/v1/appStoreVersions/{ver_id}",
            {"data": {"type": "appStoreVersions", "id": ver_id, "attributes": {"copyright": "2026 Serhat Tutak"}}})
print("Telif hakkı ->", st if st == 200 else errtxt(r))

# 5) 4.3 build'ini bul ve sürüme bağla
st, r = api("GET", f"/v1/builds?filter[app]={app_id}&filter[preReleaseVersion.version]={VER}&sort=-uploadedDate&limit=10")
builds = [b for b in r.get("data", []) if b["attributes"].get("processingState") == "VALID"] or r.get("data", [])
if not builds: die("4.3 build bulunamadı (hâlâ işleniyor olabilir)", r)
build_id = builds[0]["id"]
print("Build:", builds[0]["attributes"].get("version"), builds[0]["attributes"].get("processingState"), build_id)
MIN_BUILD = int(os.environ.get("MIN_BUILD", "0"))
try: _bn = int(builds[0]["attributes"].get("version") or "0")
except Exception: _bn = 0
if MIN_BUILD and _bn <= MIN_BUILD:
    die(f"En yeni VALID build ({_bn}); yeni build ({MIN_BUILD} üstü) henüz işlenmedi. Birazdan tekrar.")
st, r = api("PATCH", f"/v1/appStoreVersions/{ver_id}/relationships/build", {"data": {"type": "builds", "id": build_id}})
if st not in (200, 204): die("Build sürüme bağlanamadı", r)
print("Build bağlandı.")

# 6) İncelemeye gönder (reviewSubmissions akışı)
st, r = api("GET", f"/v1/reviewSubmissions?filter[app]={app_id}&limit=20")
sub_id = None
# Eski/reddedilmiş gönderimleri İPTAL et (sürümü kilitten kurtarmak için; DELETE 403 veriyor)
for s in r.get("data", []):
    stt = s["attributes"].get("state")
    if stt in ("READY_FOR_REVIEW", "UNRESOLVED_ISSUES", "COMPLETING"):
        cst, cr = api("PATCH", f"/v1/reviewSubmissions/{s['id']}",
                      {"data": {"type": "reviewSubmissions", "id": s["id"], "attributes": {"canceled": True}}})
        print("Eski gönderim iptal:", s["id"], stt, "->", cst if cst == 200 else errtxt(cr))
        if cst != 200:
            api("DELETE", f"/v1/reviewSubmissions/{s['id']}")  # yedek deneme
if not sub_id:
    st, r = api("POST", "/v1/reviewSubmissions", {"data": {"type": "reviewSubmissions",
        "attributes": {"platform": "IOS"},
        "relationships": {"app": {"data": {"type": "apps", "id": app_id}}}}})
    if st not in (200, 201): die("reviewSubmission oluşturulamadı", r)
    sub_id = r["data"]["id"]; print("Gönderim oluşturuldu:", sub_id)

# item ekli mi?
st, r = api("GET", f"/v1/reviewSubmissions/{sub_id}/items?limit=50")
has = any(it.get("relationships", {}).get("appStoreVersion", {}).get("data", {}).get("id") == ver_id for it in r.get("data", []))
if not has:
    st, r = api("POST", "/v1/reviewSubmissionItems", {"data": {"type": "reviewSubmissionItems",
        "relationships": {"reviewSubmission": {"data": {"type": "reviewSubmissions", "id": sub_id}},
                          "appStoreVersion": {"data": {"type": "appStoreVersions", "id": ver_id}}}}})
    if st not in (200, 201): die("Sürüm gönderime eklenemedi", r)
    print("Sürüm gönderime eklendi.")
else:
    print("Sürüm zaten gönderimde.")

# gönder
st, r = api("PATCH", f"/v1/reviewSubmissions/{sub_id}",
            {"data": {"type": "reviewSubmissions", "id": sub_id, "attributes": {"submitted": True}}})
if st != 200: die("Gönderim onaylanamadı", r)
print("GÖNDERİLDİ ✓  Durum:", r["data"]["attributes"].get("state"))
