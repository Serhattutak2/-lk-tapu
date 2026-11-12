#!/usr/bin/env python3
# Mevcut, hazır (READY_FOR_REVIEW) ve içinde sürüm bulunan gönderimi İNCELEMEYE GÖNDERİR.
# Hiçbir şeyi iptal/silme/yeniden oluşturma yapmaz. Ortam: KID, ISS, P8, APP_ID
import os, sys, time, json, urllib.request, urllib.error
import jwt

KID = os.environ["KID"].strip(); ISS = os.environ["ISS"].strip(); P8 = os.environ["P8"]
BUNDLE = os.environ["APP_ID"].strip()
BASE = "https://api.appstoreconnect.apple.com"

def token():
    now = int(time.time())
    return jwt.encode({"iss": ISS, "iat": now, "exp": now + 1000, "aud": "appstoreconnect-v1"},
                      P8, algorithm="ES256", headers={"kid": KID, "typ": "JWT"})

def api(method, path, body=None):
    url = path if path.startswith("http") else BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", "Bearer " + token()); req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            t = r.read().decode()
            return r.status, (json.loads(t) if t.strip() else {})
    except urllib.error.HTTPError as e:
        t = e.read().decode()
        try: j = json.loads(t)
        except Exception: j = {"raw": t[:1200]}
        return e.code, j

def errtxt(r):
    try: return "; ".join((e.get("title", "") + ": " + e.get("detail", "")) for e in r.get("errors", [])) or json.dumps(r)[:500]
    except Exception: return json.dumps(r)[:500]

st, r = api("GET", f"/v1/apps?filter[bundleId]={BUNDLE}&limit=1")
if st != 200 or not r.get("data"): print("Uygulama bulunamadı:", errtxt(r)); sys.exit(1)
app_id = r["data"][0]["id"]; print("Uygulama:", app_id)

st, r = api("GET", f"/v1/reviewSubmissions?filter[app]={app_id}&limit=30")
subs = r.get("data", [])
print("Gönderim sayısı:", len(subs))
target = None
for s in subs:
    sid = s["id"]; state = s["attributes"].get("state")
    it, ir = api("GET", f"/v1/reviewSubmissions/{sid}/items?limit=5")
    n = len(ir.get("data", []))
    print(f"  {sid} state={state} items={n}")
    if state == "READY_FOR_REVIEW" and n > 0 and not target:
        target = sid
if not target:
    print("İçinde sürüm olan hazır gönderim bulunamadı."); sys.exit(1)

print("Gönderiliyor:", target)
st, r = api("PATCH", f"/v1/reviewSubmissions/{target}",
            {"data": {"type": "reviewSubmissions", "id": target, "attributes": {"submitted": True}}})
if st in (200, 201):
    print("GÖNDERİLDİ ✓ Durum:", r.get("data", {}).get("attributes", {}).get("state"))
else:
    print("HATA:", errtxt(r)); sys.exit(1)
