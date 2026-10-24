// Arayüz duman testi: gerçek tarayıcıda oyunu açar, farklı dönemlerden kayıtlarla her sekmedeki her düğmeye basar,
// her seçim kutusunu değiştirir, zamanı hızlı akıtıp kartları çözer. Tek bir sayfa hatası ya da donma testi düşürür.
// Çalıştır: npm run build && node tools/ui-smoke.mjs
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const gen = resolve(root, 'node_modules/.cache/uisave.mjs');
await build({
  stdin: {
    contents: `
      import { newWorld } from './src/core/world';
      import { advance, botTurn } from './src/core/sim';
      import { year } from './src/core/calendar';
      import { newParcel } from './src/core/fields';
      export function make(seed, until, rich) {
        const w = newWorld({ seed });
        while (year(w.m) < until && !w.over) { botTurn(w); if (!advance(w)) botTurn(w); }
        botTurn(w);
        w.cards = [];
        if (rich) {
          w.hh.cash += 3e6; w.dirty += 1e6; w.city.open = true; w.gang = 8; w.flags.kacakci = true;
          w.hh.agil = true; w.hh.rooms.ahir = 1; w.hh.rooms.samanlik = 1; w.hh.suru = 12; w.hh.house = Math.max(1, w.hh.house);
          w.flags.kmtSir = true;
        }
        if (rich === 'tarla') {
          for (let i = 0; i < 2; i++) {
            const f = newParcel(w, 0);
            const j = w.plots.findIndex((p) => p.o !== 'biz');
            w.plots[j] = { o: 'biz', pid: f.id, ask: 1, sale: false, mad: 0 };
            f.plan = null;
          }
          w.hh.cash += 20000;
        }
        const pl = w.people[w.playerId];
        if (rich === 'bekar' && pl.sp) { const s = w.people[pl.sp]; if (s) { s.d = w.m; s.cause = 'test'; } pl.sp = undefined; }
        return JSON.stringify(w);
      }`,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true, format: 'esm', platform: 'node', outfile: gen, logLevel: 'error',
});
const { make } = await import(gen + '?' + Date.now());

const exe = ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', process.env.CHROME_PATH].find((p) => p && existsSync(p));
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const SAVES = [
  ['yeni oyun', null],
  ['1926 bekâr', make(11, 1926, 'bekar')],
  ['1950', make(12, 1950, false)],
  ['1972 zengin', make(13, 1972, true)],
  ['2005 zengin bekâr', make(14, 2005, 'bekar')],
];
let fail = 0;
for (const [name, save] of SAVES) {
  const pg = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  pg.on('pageerror', (e) => errs.push(String(e.stack || e)));
  await pg.goto('file://' + resolve(root, 'dist/index.html'));
  await pg.evaluate((s) => { localStorage.clear(); if (s) localStorage.setItem('ilktapu_v1', s); }, save);
  await pg.reload();
  await pg.waitForTimeout(200);
  await pg.click(save ? '#cont' : '#new');
  await pg.waitForTimeout(300);
  const ok = await pg.$('#newsok');
  if (ok) await ok.click();
  let clicks = 0;
  const clearCards = async () => {
    for (let i = 0; i < 6; i++) {
      const o = (await pg.$('[data-opt]')) || (await pg.$('#overlay button')) || (await pg.$('#newsbox button'));
      if (!o) break;
      await o.click().catch(() => {});
      await pg.waitForTimeout(30);
    }
  };
  for (const tab of ['aile', 'tarla', 'mulk', 'yeralti', 'sehir', 'hane', 'kronik']) {
    const t = await pg.$(`[data-tab="${tab}"]`);
    if (!t || !(await t.isVisible())) continue;
    await clearCards();
    await t.click({ timeout: 2000 }).catch(() => {});
    await pg.waitForTimeout(80);
    // Seçim kutuları
    const nSel = await pg.$$eval('#panel select', (a) => a.length);
    for (let i = 0; i < nSel; i++) {
      const sels = await pg.$$('#panel select');
      if (!sels[i]) break;
      const vals = await sels[i].$$eval('option', (o) => o.map((x) => x.value));
      const v = vals[Math.min(vals.length - 1, 1)];
      if (v !== undefined) await sels[i].selectOption(v).catch(() => {});
      clicks++;
      await clearCards();
    }
    // Düğmeler (yıkıcı olmayanlar)
    for (let i = 0; i < 120; i++) {
      await pg.evaluate(() => document.querySelectorAll('#panel details').forEach((d) => (d.open = true)));
      const bs = await pg.$$('#panel button:not([disabled])');
      if (i >= bs.length) break;
      const b = bs[i];
      if (!(await b.isVisible())) continue;
      await b.click({ timeout: 1500 }).catch(() => {});
      clicks++;
      await pg.waitForTimeout(20);
      await clearCards();
      const t2 = await pg.$(`[data-tab="${tab}"]`);
      if (t2) await t2.click({ timeout: 1500 }).catch(() => {});
    }
  }
  // Zaman akışı: donma var mı?
  const d0 = await pg.innerText('.date');
  await clearCards();
  await pg.evaluate(() => document.querySelector('[data-sp="3"]').click());
  for (let i = 0; i < 40; i++) {
    await pg.waitForTimeout(120);
    const o = await pg.$$('[data-opt]');
    if (o.length) await o[Math.floor(Math.random() * o.length)].click().catch(() => {});
    else await clearCards();
  }
  await pg.evaluate(() => document.querySelector('[data-sp="0"]').click());
  const d1 = await pg.innerText('.date');
  const frozen = d0 === d1;
  console.log(`${errs.length || frozen ? 'HATA' : 'tamam'}  ${name}: ${clicks} etkileşim, ${d0.split('\n')[0]} → ${d1.split('\n')[0]}`);
  if (errs.length) console.log('  ' + errs.slice(0, 3).join('\n  '));
  if (frozen) console.log('  zaman ilerlemedi (donma)');
  if (errs.length || frozen) fail++;
  await pg.close();
}
// Ekim planı arayüzden seçilir, oyun kendi eker mi?
{
  const save = make(21, 1931, 'tarla');
  const w0 = JSON.parse(save);
  const pg = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  pg.on('pageerror', (e) => errs.push(String(e)));
  await pg.goto('file://' + resolve(root, 'dist/index.html'));
  await pg.evaluate((s) => { localStorage.clear(); localStorage.setItem('ilktapu_v1', s); localStorage.setItem('ilktapu_haber', '9'); }, save);
  await pg.reload();
  await pg.click('#cont');
  await pg.waitForTimeout(200);
  const nb = await pg.$('#newsok');
  if (nb) await nb.click();
  await pg.click('[data-tab="tarla"]');
  const has = await pg.$('[data-planall]');
  let msg = 'parsel yok, atlandı';
  if (has && w0.hh.parcels.length) {
    await pg.selectOption('[data-planall]', 'arpa');
    await pg.evaluate(() => document.querySelector('[data-sp="3"]').click());
    let sown = 0;
    for (let i = 0; i < 80 && !sown; i++) {
      await pg.waitForTimeout(150);
      const o = await pg.$('[data-opt]');
      if (o) await o.click().catch(() => {});
      sown = await pg.evaluate(() => JSON.parse(localStorage.getItem('ilktapu_v1')).hh.parcels.filter((f) => f.plan === 'arpa' && f.crop === 'arpa').length);
    }
    msg = sown ? `${sown} parsel arpa ekildi` : 'ARPA EKİLMEDİ';
    if (!sown) fail++;
  }
  if (errs.length) { fail++; console.log('  ' + errs.join('\n  ')); }
  console.log(`${msg.includes('EKİLMEDİ') || errs.length ? 'HATA' : 'tamam'}  ekim planı: ${msg}`);
  await pg.close();
}
await browser.close();
if (fail) {
  console.log(`${fail} senaryo başarısız.`);
  process.exit(1);
}
console.log('Arayüz duman testi geçti.');
