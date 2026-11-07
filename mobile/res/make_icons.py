# İlk Tapu simge ve açılış ekranı (PIL). Çalıştır: python3 res/make_icons.py
# Görsel dil: koyu toprak zemin, buğday altını, kırmızı tapu mührü (resmi evrak).
from PIL import Image, ImageDraw, ImageFont
import math, os
H = os.path.dirname(os.path.abspath(__file__)); IOS = os.path.join(H, '..', 'ios', 'App', 'App', 'Assets.xcassets')
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'
WHEAT, MADDER, STRAW = (214, 169, 78), (178, 59, 46), (232, 220, 191)
BG_TOP, BG_BOT = (39, 36, 48), (20, 19, 24)
def bg(w, h):
    im = Image.new('RGB', (w, h), BG_BOT); d = ImageDraw.Draw(im)
    for i in range(h):
        t = i / h; c = tuple(int(BG_TOP[k] * (1 - t) + BG_BOT[k] * t) for k in range(3))
        d.line([(0, i), (w, i)], fill=c)
    return im
def seal(d, cx, cy, r):
    # dış kırmızı mühür halkası + içte ikinci ince halka + çentikler
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=MADDER, width=max(3, int(r * .10)))
    r2 = r * .80
    d.ellipse([cx - r2, cy - r2, cx + r2, cy + r2], outline=MADDER, width=max(2, int(r * .04)))
    for a in range(36):
        ang = a * math.pi / 18; x1, y1 = cx + math.cos(ang) * r, cy + math.sin(ang) * r
        x2, y2 = cx + math.cos(ang) * r * 1.10, cy + math.sin(ang) * r * 1.10
        d.line([(x1, y1), (x2, y2)], fill=MADDER, width=max(2, int(r * .03)))
def icon(n=1024):
    im = bg(n, n); d = ImageDraw.Draw(im)
    seal(d, n / 2, n / 2, n * .40)
    f = ImageFont.truetype(FONT, int(n * .34)); d.text((n / 2, n * .50), 'İT', font=f, fill=WHEAT, anchor='mm')
    return im
def splash(n=2732):
    im = bg(n, n); d = ImageDraw.Draw(im); c = n / 2
    seal(d, c, c - n * .05, n * .14)
    f = ImageFont.truetype(FONT, int(n * .11)); d.text((c, c - n * .05), 'İT', font=f, fill=WHEAT, anchor='mm')
    f2 = ImageFont.truetype(FONT, int(n * .052)); d.text((c, c + n * .14), 'İLK TAPU', font=f2, fill=WHEAT, anchor='mm')
    f3 = ImageFont.truetype(FONT, int(n * .018)); d.text((c, c + n * .19), 'BİR HANEDAN KUR', font=f3, fill=STRAW, anchor='mm')
    f4 = ImageFont.truetype(FONT, int(n * .013)); d.text((c, c + n * .30), 'SARDUR TECHNOLOGIES  ·  SERHAT TUTAK', font=f4, fill=(168, 156, 130), anchor='mm')
    return im
icon().save(os.path.join(IOS, 'AppIcon.appiconset', 'AppIcon-512@2x.png'))
icon().save(os.path.join(H, 'icon-1024.png'))
sp = splash()
for nm in ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']: sp.save(os.path.join(IOS, 'Splash.imageset', nm))
print('ikon + açılış üretildi')
