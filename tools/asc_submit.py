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

# 5) 4.3 build'ini bul ve sürüme bağla
st, r = api("GET", f"/v1/builds?filter[app]={app_id}&filter[preReleaseVersion.version]={VER}&sort=-uploadedDate&limit=10")
builds = [b for b in r.get("data", []) if b["attributes"].get("processingState") == "VALID"] or r.get("data", [])
if not builds: die("4.3 build bulunamadı (hâlâ işleniyor olabilir)", r)
build_id = builds[0]["id"]
print("Build:", builds[0]["attributes"].get("version"), builds[0]["attributes"].get("processingState"), build_id)
st, r = api("PATCH", f"/v1/appStoreVersions/{ver_id}/relationships/build", {"data": {"type": "builds", "id": build_id}})
if st not in (200, 204): die("Build sürüme bağlanamadı", r)
print("Build bağlandı.")

# 6) İncelemeye gönder (reviewSubmissions akışı)
st, r = api("GET", f"/v1/reviewSubmissions?filter[app]={app_id}&limit=20")
sub_id = None
for s in r.get("data", []):
    if s["attributes"].get("state") in ("READY_FOR_REVIEW", "UNRESOLVED_ISSUES"):
        sub_id = s["id"]; print("Mevcut gönderim kullanılıyor:", sub_id, s["attributes"].get("state")); break
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
