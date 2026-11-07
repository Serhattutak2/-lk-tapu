#!/usr/bin/env python3
# App Store Connect: uygulamanın Pazarlama/Destek URL'lerini ve sürüm durumlarını OKUR (salt okunur).
import os, time, json, urllib.request, urllib.error
import jwt
KID=os.environ["KID"].strip(); ISS=os.environ["ISS"].strip(); P8=os.environ["P8"]; BUNDLE=os.environ["APP_ID"].strip()
BASE="https://api.appstoreconnect.apple.com"
def tok():
    n=int(time.time()); return jwt.encode({"iss":ISS,"iat":n,"exp":n+900,"aud":"appstoreconnect-v1"},P8,algorithm="ES256",headers={"kid":KID,"typ":"JWT"})
def api(path):
    req=urllib.request.Request(BASE+path); req.add_header("Authorization","Bearer "+tok())
    try:
        with urllib.request.urlopen(req,timeout=60) as r: return json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e: return {"_err":e.code,"_body":e.read().decode()[:600]}
a=api(f"/v1/apps?filter[bundleId]={BUNDLE}&limit=1")
app=a["data"][0]; app_id=app["id"]
print("APP:", app["attributes"].get("name"), app_id, "| primaryLocale:", app["attributes"].get("primaryLocale"))
# App-level info localizations (bazı hesaplarda marketingUrl burada)
# Sürümler
vs=api(f"/v1/apps/{app_id}/appStoreVersions?limit=10")
for v in vs.get("data",[]):
    va=v["attributes"]; vid=v["id"]
    print(f"\nSÜRÜM {va.get('versionString')} [{va.get('platform')}] durum={va.get('appStoreState')} id={vid}")
    locs=api(f"/v1/appStoreVersions/{vid}/appStoreVersionLocalizations?limit=50")
    for l in locs.get("data",[]):
        la=l["attributes"]
        print(f"  locale={la.get('locale')} marketingUrl={la.get('marketingUrl')!r} supportUrl={la.get('supportUrl')!r}")
