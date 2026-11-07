#!/usr/bin/env python3
# App Store sürüm yerelleştirmelerine Pazarlama/Destek URL'si yazar.
import os, time, json, urllib.request, urllib.error
import jwt
KID=os.environ["KID"].strip(); ISS=os.environ["ISS"].strip(); P8=os.environ["P8"]; BUNDLE=os.environ["APP_ID"].strip()
MKT=os.environ.get("MARKETING_URL","").strip(); SUP=os.environ.get("SUPPORT_URL","").strip()
BASE="https://api.appstoreconnect.apple.com"
def tok():
    n=int(time.time()); return jwt.encode({"iss":ISS,"iat":n,"exp":n+900,"aud":"appstoreconnect-v1"},P8,algorithm="ES256",headers={"kid":KID,"typ":"JWT"})
def api(method,path,body=None):
    data=json.dumps(body).encode() if body is not None else None
    req=urllib.request.Request(BASE+path,data=data,method=method)
    req.add_header("Authorization","Bearer "+tok()); req.add_header("Content-Type","application/json")
    try:
        with urllib.request.urlopen(req,timeout=60) as r:
            t=r.read().decode(); return r.status,(json.loads(t) if t.strip() else {})
    except urllib.error.HTTPError as e:
        t=e.read().decode()
        try: j=json.loads(t)
        except Exception: j={"raw":t[:600]}
        return e.code,j
def errtxt(r):
    try: return "; ".join((e.get("title","")+": "+e.get("detail","")) for e in r.get("errors",[])) or json.dumps(r)[:500]
    except Exception: return json.dumps(r)[:500]

st,r=api("GET",f"/v1/apps?filter[bundleId]={BUNDLE}&limit=1")
app_id=r["data"][0]["id"]; print("APP:",r["data"][0]["attributes"].get("name"),app_id)
st,r=api("GET",f"/v1/apps/{app_id}/appStoreVersions?limit=10")
for v in r.get("data",[]):
    vid=v["id"]; va=v["attributes"]; state=va.get("appStoreState")
    # yalnız canlı / düzenlenebilir sürümlerde dene
    locs_s,locs=api("GET",f"/v1/appStoreVersions/{vid}/appStoreVersionLocalizations?limit=50")
    for l in locs.get("data",[]):
        lid=l["id"]; loc=l["attributes"]["locale"]
        attrs={}
        if MKT: attrs["marketingUrl"]=MKT
        if SUP: attrs["supportUrl"]=SUP
        if not attrs: continue
        ps,pr=api("PATCH",f"/v1/appStoreVersionLocalizations/{lid}",
                  {"data":{"type":"appStoreVersionLocalizations","id":lid,"attributes":attrs}})
        print(f"{va.get('versionString')} [{state}] {loc}: {'OK' if ps==200 else 'HATA '+str(ps)+' '+errtxt(pr)}")
