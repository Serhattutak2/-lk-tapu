# İlk Tapu simge ve açılış ekranı (PIL). Çalıştır: python3 res/make_icons.py
# Logo: altın anahtar (mülkiyet/tapu) — koyu toprak zemin.
from PIL import Image, ImageDraw, ImageFont
import os
H = os.path.dirname(os.path.abspath(__file__)); IOS = os.path.join(H, '..', 'ios', 'App', 'App', 'Assets.xcassets')
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'
WHEAT, STRAW = (214, 169, 78), (232, 220, 191)
BG_TOP, BG_BOT = (42, 38, 52), (18, 17, 22)
def bg(w, h):
    im = Image.new('RGB', (w, h), BG_BOT); d = ImageDraw.Draw(im)
    for i in range(h):
        t = i / h; c = tuple(int(BG_TOP[k] * (1 - t) + BG_BOT[k] * t) for k in range(3)); d.line([(0, i), (w, i)], fill=c)
    return im
def drawkey(d, cx, topy, scale):
    # bow (üst halka)
    bowr = scale * 0.17; by = topy + bowr
    d.ellipse([cx - bowr, by - bowr, cx + bowr, by + bowr], outline=WHEAT, width=int(scale * 0.05))
    d.ellipse([cx - bowr * 0.45, by - bowr * 0.45, cx + bowr * 0.45, by + bowr * 0.45], fill=WHEAT)
    # shaft (gövde)
    sh_w = scale * 0.05; shaft_bot = topy + scale * 0.70
    d.rectangle([cx - sh_w / 2, by + bowr * 0.6, cx + sh_w / 2, shaft_bot], fill=WHEAT)
    # teeth (dişler)
    for i, ty in enumerate([0.56, 0.63]):
        yy = topy + scale * ty
        d.rectangle([cx + sh_w / 2, yy, cx + sh_w / 2 + scale * 0.10 * (1 - i * 0.3), yy + scale * 0.032], fill=WHEAT)
def icon(n=1024):
    im = bg(n, n); d = ImageDraw.Draw(im); drawkey(d, n / 2, n * 0.14, n); return im
def splash(nn=2732):
    im = bg(nn, nn); d = ImageDraw.Draw(im); c = nn / 2
    drawkey(d, c, c - nn * 0.26, nn * 0.42)
    f2 = ImageFont.truetype(FONT, int(nn * 0.052)); d.text((c, c + nn * 0.17), 'İLK TAPU', font=f2, fill=WHEAT, anchor='mm')
    f3 = ImageFont.truetype(FONT, int(nn * 0.018)); d.text((c, c + nn * 0.22), 'BİR HANEDAN KUR', font=f3, fill=STRAW, anchor='mm')
    f4 = ImageFont.truetype(FONT, int(nn * 0.013)); d.text((c, c + nn * 0.32), 'SARDUR TECHNOLOGIES  ·  SERHAT TUTAK', font=f4, fill=(168, 156, 130), anchor='mm')
    return im
icon().save(os.path.join(IOS, 'AppIcon.appiconset', 'AppIcon-512@2x.png'))
icon().save(os.path.join(H, 'icon-1024.png'))
sp = splash()
for nm in ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']: sp.save(os.path.join(IOS, 'Splash.imageset', nm))
print('anahtar ikon + açılış üretildi')
