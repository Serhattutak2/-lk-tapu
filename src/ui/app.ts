// Arayüz: açılış, oyun ekranı, paneller, olay kartları, son ekranı.
import type { Card, JobId, Person, World } from '../core/types';
import { migrate, newWorld } from '../core/world';
import { advance, canAdvance, payDebt, resolveCard, setHeir, setJob, isPlainJSON } from '../core/sim';
import { age, alive, bloodLiving, fullName, hhMembers, P, relationTo } from '../core/people';
import { JOBS, jobsFor, wage } from '../core/jobs';
import { landBlockers, landPrice } from '../core/cards';
import { assignWorker, CROPS, careOf, expectedValue, harvestMonth, hasRuhsat, idleWage, irgatWage, isBanYear, kacakPrice, laborNeed, personFieldLabel, seedCost, sellStash, setHired, sow, sowableNow, workersOf } from '../core/fields';
import { heatLabel } from '../core/crime';
import type { CropId, Parcel } from '../core/types';
import { dateText, year } from '../core/calendar';
import { VillageMap } from './map';

const SAVE_KEY = 'ilktapu_v1';
const SPEEDS = [0, 2200, 700];
const KIND: Record<string, string> = { veraset: 'Veraset', gorucu: 'Görücü', hastalik: 'Hastalık', gurbet: 'Gurbet', tuccar: 'Tanışıklık', tapu: 'Tapu', bilgi: 'Haber', hashas_hasat: 'Hasat', ruhsat: 'Ruhsat', kacakci: 'Kahvehane', baskin: 'Jandarma', aga_kira: 'Ağa', aga_kiz: 'Ağa' };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const lira = (n: number) => Math.round(n).toLocaleString('tr-TR') + ' lira';
const $ = <T extends HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T | null;

function load(): World | null {
  try {
    const s = localStorage.getItem(SAVE_KEY);
    return s ? migrate(JSON.parse(s) as World) : null;
  } catch {
    return null;
  }
}
function save(w: World) {
  try {
    if (isPlainJSON(w)) localStorage.setItem(SAVE_KEY, JSON.stringify(w));
  } catch {
    /* depolama yoksa oyun yine çalışır */
  }
}
function wipe() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* yok say */
  }
}

export class App {
  private w: World | null = null;
  private tab: 'aile' | 'tarla' | 'hane' | 'kronik' = 'aile';
  private speed = 0;
  private timer = 0;
  private map: VillageMap | null = null;
  private pendingPanel = false;
  private ceremony: null | { price: number } = null;

  constructor(private root: HTMLElement) {}

  start() {
    this.showStart();
  }

  // ---------- Açılış ----------
  private showStart() {
    this.stop();
    this.map?.destroy();
    this.map = null;
    const saved = load();
    let sex: 'E' | 'K' = 'E';
    this.root.innerHTML = `
      <main class="start"><div class="start-inner">
        <h1>İlk<span>Tapu</span></h1>
        <p class="lede">Mart 1965, Karaçam köyü. Kendine ait bir karış toprağı olmayan bir ailenin on altı yaşındaki çocuğusun. Ailen ağaya borçlu, başkasının tarlasında gündelik çalışıyor.</p>
        ${saved && !saved.over ? `<button class="primary" id="cont">${esc(saved.surname)} ailesiyle devam et, ${dateText(saved.m)}</button><div class="group">ya da yeni bir hayat</div>` : ''}
        <label class="field"><span>Soyadı</span><input id="sur" maxlength="20" placeholder="Boş bırakırsan rastgele seçilir" autocomplete="off"></label>
        <label class="field"><span>Adın</span><input id="first" maxlength="20" placeholder="Boş bırakırsan rastgele seçilir" autocomplete="off"></label>
        <div class="field"><span>Doğduğun cinsiyet</span>
          <div class="seg"><button id="sxE" aria-pressed="true">Erkek</button><button id="sxK" aria-pressed="false">Kız</button></div></div>
        <button class="${saved && !saved.over ? 'ghost' : 'primary'}" id="new">Hayata başla</button>
      </div></main>`;
    const setSex = (s: 'E' | 'K') => {
      sex = s;
      $('#sxE')!.setAttribute('aria-pressed', String(s === 'E'));
      $('#sxK')!.setAttribute('aria-pressed', String(s === 'K'));
    };
    $('#sxE')!.onclick = () => setSex('E');
    $('#sxK')!.onclick = () => setSex('K');
    $('#cont') && ($('#cont')!.onclick = () => this.enter(saved!));
    let armed = !(saved && !saved.over);
    $('#new')!.onclick = () => {
      if (!armed) {
        armed = true;
        $('#new')!.textContent = 'Kayıtlı aile silinsin, yeni hayata başla';
        return;
      }
      wipe();
      const w = newWorld({ surname: $<HTMLInputElement>('#sur')!.value, first: $<HTMLInputElement>('#first')!.value, sex });
      save(w);
      this.enter(w);
    };
  }

  // ---------- Oyun ekranı ----------
  private enter(w: World) {
    this.w = w;
    if (w.over) return this.showEnd();
    this.root.innerHTML = `
      <div class="game">
        <header class="top" id="top"></header>
        <section class="mapwrap"><canvas id="cv" aria-label="Karaçam köyü"></canvas>
          <div class="who" id="who"></div>
          <div class="clock" role="group" aria-label="Zaman">
            <button data-sp="0" aria-label="Durdur">❚❚</button>
            <button data-sp="1" aria-label="Oynat">▶</button>
            <button data-sp="2" aria-label="Hızlı">▶▶</button>
          </div>
        </section>
        <nav class="tabs" role="tablist">
          <button role="tab" data-tab="aile">Aile</button>
          <button role="tab" data-tab="tarla">Tarla</button>
          <button role="tab" data-tab="hane">Hane</button>
          <button role="tab" data-tab="kronik">Kronik</button>
        </nav>
        <section class="panel" id="panel"></section>
      </div>
      <div id="overlay"></div>`;
    this.map = new VillageMap($<HTMLCanvasElement>('#cv')!, () => this.w);
    this.root.querySelectorAll<HTMLButtonElement>('[data-sp]').forEach((b) => (b.onclick = () => this.setSpeed(Number(b.dataset.sp))));
    this.root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => (b.onclick = () => {
      this.tab = b.dataset.tab as typeof this.tab;
      this.renderPanel(true);
    }));
    this.setSpeed(0);
    this.refresh();
  }

  private setSpeed(s: number) {
    this.speed = s;
    this.root.querySelectorAll<HTMLButtonElement>('[data-sp]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.sp) === s)));
    this.stop();
    if (s > 0) this.timer = window.setInterval(() => this.step(), SPEEDS[s]);
  }

  private stop() {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = 0;
  }

  private step() {
    const w = this.w;
    if (!w || !canAdvance(w) || this.ceremony) return;
    advance(w);
    save(w);
    if (w.over) {
      this.stop();
      return this.showEnd();
    }
    this.refresh();
  }

  private refresh() {
    this.renderTop();
    this.renderPanel(false);
    this.renderOverlay();
  }

  private renderTop() {
    const w = this.w!;
    const top = $('#top');
    if (!top) return;
    top.innerHTML = `
      <span class="date">${dateText(w.m)}</span>
      <button class="small" id="menu">Menü</button>
      <div class="stats">
        <span class="stat money">Kasa <b>${lira(w.hh.cash)}</b></span>
        ${w.hh.debt > 0 ? `<span class="stat debt">Borç <b>${lira(w.hh.debt)}</b></span>` : ''}
        <span class="stat">Toprak <b>${w.hh.land} dönüm</b></span>
        ${w.heat >= 15 ? `<span class="stat heat">Dikkat <b>${esc(heatLabel(w.heat))}</b></span>` : ''}
      </div>`;
    $('#menu')!.onclick = () => this.showStart();
    const pl = P(w, w.playerId);
    const who = $('#who');
    if (who) who.innerHTML = alive(pl) ? `<b>${esc(fullName(pl))}</b>, ${age(w, pl)} yaşında, ${JOBS[pl.job].ad.toLowerCase()}` : 'Aile yasta';
    this.root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === this.tab)));
  }

  private renderPanel(force: boolean) {
    const panel = $('#panel');
    if (!panel || !this.w) return;
    if (!force && document.activeElement?.tagName === 'SELECT') {
      this.pendingPanel = true;
      return;
    }
    this.pendingPanel = false;
    const keep = force ? 0 : panel.scrollTop;
    if (this.tab === 'aile') panel.innerHTML = this.familyHTML();
    else if (this.tab === 'tarla') panel.innerHTML = this.fieldsHTML();
    else if (this.tab === 'hane') panel.innerHTML = this.householdHTML();
    else panel.innerHTML = this.chronicleHTML();
    panel.scrollTop = keep;
    this.bindPanel(panel);
    this.renderTop();
  }

  // ---------- Aile ----------
  private personHTML(p: Person, inHouse: boolean): string {
    const w = this.w!;
    const pl = P(w, w.playerId);
    const isMe = p.id === w.playerId;
    const rel = alive(pl) ? relationTo(w, pl, p) : '';
    const badges = [
      isMe ? '<span class="badge sen">Sen</span>' : '',
      p.id === w.heirId ? '<span class="badge varis">Varis</span>' : '',
      p.away === 'gurbet' ? '<span class="badge gurbet">Gurbette</span>' : '',
      p.away === 'hapis' ? '<span class="badge hasta">Cezaevinde</span>' : '',
      p.sick ? '<span class="badge hasta">Hasta</span>' : '',
    ].join('');
    const hp = Math.round(p.hp);
    const a = age(w, p);
    let jobCtl = '';
    if (inHouse && !p.away && a >= 7) {
      const opts = jobsFor(w, p).filter((j) => j.id !== 'yok' || p.job === 'yok');
      jobCtl = `<select data-job="${p.id}" aria-label="${esc(p.first)} ne iş yapsın">${opts.map((j) => `<option value="${j.id}"${j.id === p.job ? ' selected' : ''}>${j.ad}</option>`).join('')}</select>`;
    } else if (p.away === 'gurbet') {
      jobCtl = `<span>Almanya'da işçi</span>`;
    } else if (p.away === 'hapis') {
      jobCtl = `<span>Çıkışı ${dateText(p.awayUntil ?? w.m)}</span>`;
    } else if (!inHouse) {
      jobCtl = `<span>Kendi evinde</span>`;
    }
    const canHeir = p.blood && !isMe && p.id !== w.heirId && a < 60;
    const sk = (Object.entries(p.sk) as [keyof Person['sk'], number][])
      .filter(([, v]) => v >= 5)
      .sort((x, y) => y[1] - x[1])
      .map(([k, v]) => `${({ tarim: 'Tarım', insaat: 'İnşaat', zanaat: 'Zanaat', ticaret: 'Ticaret' })[k]} ${Math.round(v)}`)
      .join(', ');
    return `<div class="person">
      <div class="prow"><span class="pname">${esc(fullName(p))}</span>${badges}</div>
      <div class="prow"><span class="prel">${isMe ? '' : esc(rel) + ', '}${a} yaşında</span></div>
      <div class="pmeta"><span class="hp${hp < 40 ? ' low' : ''}" title="Sağlık ${hp}"><i style="width:${hp}%"></i></span>${jobCtl}
        ${canHeir ? `<button class="small" data-heir="${p.id}">Varis yap</button>` : ''}</div>
      ${sk ? `<div class="skills">${sk}</div>` : ''}
      ${inHouse && !p.away ? `<div class="earn">${this.earnText(p)}</div>` : ''}
    </div>`;
  }

  private earnText(p: Person): string {
    const w = this.w!;
    if (p.job === 'kendi') {
      const f = w.hh.parcels.find((x) => x.id === p.parcel);
      const idle = idleWage(w, p);
      return f && laborNeed(w, f) > 0 ? `${f.no}. parselde çalışıyor; kazancı hasatta gelir` : `Parselde iş yok; gündeliğe gidiyor, ayda ${lira(idle)}`;
    }
    const v = wage(w, p);
    return v > 0 ? `Bu ay kazancı ${lira(v)}` : JOBS[p.job].id === 'okul' ? 'Okuyor' : JOBS[p.job].id === 'ev' ? 'Evi çekip çeviriyor' : 'Kazancı yok';
  }

  // ---------- Tarla ----------
  private fieldsHTML(): string {
    const w = this.w!;
    if (!w.hh.parcels.length) {
      const price = landPrice(w);
      const blk = landBlockers(w);
      const pct = Math.min(100, Math.round((w.hh.cash / price) * 100));
      return `<div class="group">Henüz kendi toprağın yok</div>
        <p class="note">Ailenin ilk tapusu için köy kenarında 5 dönüm tarla ${lira(price)}. Toprak fiyatı her yıl artıyor.</p>
        <div class="meter"><i style="width:${pct}%"></i></div>
        <p class="note">Birikim: ${lira(w.hh.cash)} / ${lira(price)}</p>
        ${blk.length ? `<ul class="blockers">${blk.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : `<p class="note good">Her şey hazır. Satılık tarla çıktığında haber gelecek.</p>`}`;
    }
    const now = sowableNow(w);
    return `${w.hh.parcels.map((f) => this.parcelHTML(f, now)).join('')}
      <p class="note">Ekim ayları: buğday, arpa ve haşhaş Ekim–Kasım; nohut Mart–Nisan; şeker pancarı Nisan. Ruhsat her yıl Ağustos'ta alınır.</p>`;
  }

  private parcelHTML(f: Parcel, now: CropId[]): string {
    const w = this.w!;
    const ws = workersOf(w, f);
    const need = laborNeed(w, f);
    let status: string;
    if (f.crop) {
      const d = CROPS[f.crop];
      const left = harvestMonth(f) - w.m;
      status = `<div class="crop"><b>${d.ad}</b>${f.illegal ? ' <span class="badge hasta">Ruhsatsız</span>' : ''}<br>
        Ekim ${dateText(f.sownM)}, hasat ${dateText(harvestMonth(f))}${left > 0 ? ` (${left} ay sonra)` : ''}<br>
        Bakım %${Math.round(careOf(f) * 100)}, ${f.crop === 'hashas' ? 'tahmini ' + Math.round(12 * Math.pow(careOf(f), 1.2)) + ' çuval' : 'beklenen hasat ~' + lira(expectedValue(w, f))}</div>`;
    } else if (now.length) {
      status = `<div class="crop">Tarla boş. Bu ay ekilebilecekler:</div><div class="sowgrid">${now.map((c) => {
        const d = CROPS[c];
        const ill = c === 'hashas' && !hasRuhsat(w);
        const note = c === 'hashas' ? (ill ? (isBanYear(year(w.m)) ? 'Yasak! Ruhsatsız ekilir' : 'Ruhsatın yok, ruhsatsız ekilir') : 'Ruhsatlı') : `${d.need} işçi ister`;
        return `<button class="sow${ill ? ' risky' : ''}" data-sow="${f.id}:${c}"><b>${d.ad}</b><span>Tohum ${lira(seedCost(w, c))}</span><span>${esc(note)}</span></button>`;
      }).join('')}</div>`;
    } else {
      const next = monthsUntilSow(w.m);
      status = `<div class="crop">Tarla nadasta. Sonraki ekim ${next}.</div>`;
    }
    const pool = hhMembers(w).filter((q) => !q.away && age(w, q) >= 10 && !(q.job === 'kendi' && q.parcel === f.id));
    const needTxt = need > 0
      ? `<div class="labor"><span>Bu ay gereken iş gücü ${fmt1(need)}, gelen ${fmt1(f.lastGot || 0)}</span><div class="meter${(f.lastGot || 0) < need * 0.97 ? ' short' : ''}"><i style="width:${Math.min(100, Math.round(((f.lastGot || 0) / need) * 100))}%"></i></div></div>`
      : `<p class="note">Bu ay parselde iş yok. Buradaki işçiler başkasının tarlasına gündeliğe gidiyor.</p>`;
    return `<section class="parcel">
      <div class="prow"><span class="pname">${f.no}. parsel</span><span class="prel">5 dönüm${f.price ? `, ${year(f.boughtM)}'de ${lira(f.price)}` : ''}</span></div>
      ${status}
      ${f.crop ? needTxt : ''}
      <div class="group">Çalışanlar</div>
      <div class="chips">${ws.map((q) => `<span class="chip">${esc(q.first)} (${age(w, q)}), tarım ${Math.round(q.sk.tarim)} <button class="x" data-unassign="${q.id}" aria-label="${esc(q.first)} geri çağır">Geri çağır</button></span>`).join('') || '<span class="note">Kimse yok</span>'}</div>
      <div class="btnrow">
        ${pool.length ? `<select data-assign="${f.id}" aria-label="Aileden işçi gönder"><option value="">Aileden birini gönder…</option>${pool.map((q) => `<option value="${q.id}">${esc(q.first)}, ${age(w, q)} yaşında, şu an ${esc(q.job === 'kendi' ? personFieldLabel(w, q) : JOBS[q.job].ad.toLowerCase())}</option>`).join('')}</select>` : ''}
      </div>
      <div class="hire"><span>Irgat ${f.hired} kişi, iş aylarında kişi başı ${lira(irgatWage(w))}</span>
        <button class="small" data-hire="${f.id}:-1"${f.hired <= 0 ? ' disabled' : ''} aria-label="Bir ırgat az">−</button>
        <button class="small" data-hire="${f.id}:1"${f.hired >= 4 ? ' disabled' : ''} aria-label="Bir ırgat fazla">+</button></div>
      ${f.hist.length ? `<div class="hist">Son hasatlar: ${f.hist.slice(0, 4).map((h) => `${year(h.m)} ${CROPS[h.crop].ad.toLowerCase()}, ${esc(h.t)}`).join('; ')}</div>` : ''}
    </section>`;
  }

  private familyHTML(): string {
    const w = this.w!;
    const house = hhMembers(w).sort((a, b) => (a.id === w.playerId ? -1 : b.id === w.playerId ? 1 : a.b - b.b));
    const out = bloodLiving(w).filter((p) => !p.inHH).sort((a, b) => a.b - b.b);
    const dead = Object.values(w.people).filter((p) => p.d !== undefined && (p.blood || p.id === w.flags.babaId)).sort((a, b) => (b.d ?? 0) - (a.d ?? 0));
    const heir = P(w, w.heirId);
    const warn = !alive(heir)
      ? `<div class="warn">Varis belirlemedin. Ölürsen aile veraset kavgasına düşer ve mirasın üçte biri dağılır.</div>`
      : '';
    return `${warn}
      <div class="group">Hanede ${house.length} kişi</div>
      ${house.map((p) => this.personHTML(p, true)).join('')}
      ${out.length ? `<div class="group">Ayrı evde yaşayan akrabalar</div>${out.map((p) => this.personHTML(p, false)).join('')}` : ''}
      ${dead.length ? `<details><summary class="group">Rahmetliler (${dead.length})</summary>${dead.map((p) => `<div class="person"><span class="pname dead">${esc(fullName(p))}</span> <span class="prel">${year(p.b)}–${year(p.d!)}, ${esc(p.cause ?? '')}</span></div>`).join('')}</details>` : ''}`;
  }

  // ---------- Hane ----------
  private householdHTML(): string {
    const w = this.w!;
    const inc = w.lines.filter((l) => l.v > 0);
    const out = w.lines.filter((l) => l.v < 0);
    const net = w.lines.reduce((a, l) => a + l.v, 0);
    const row = (l: { t: string; v: number }) => `<tr><td>${esc(l.t)}</td><td class="${l.v < 0 ? 'neg' : 'pos'}">${l.v < 0 ? '−' : '+'}${lira(Math.abs(l.v))}</td></tr>`;
    const heatPct = Math.round(w.heat);
    return `
      <div class="group">Geçen ayın hesabı</div>
      <table class="ledger">${inc.map(row).join('')}${out.map(row).join('')}
        <tr class="sum"><td>Net</td><td class="${net < 0 ? 'neg' : 'pos'}">${net < 0 ? '−' : '+'}${lira(Math.abs(net))}</td></tr></table>
      <div class="group">Varlık</div>
      <table class="ledger">
        <tr><td>Kasa</td><td>${lira(w.hh.cash)}</td></tr>
        <tr><td>Ağaya borç (aylık %2 faiz)</td><td class="${w.hh.debt ? 'neg' : ''}">${lira(w.hh.debt)}</td></tr>
        <tr><td>Kendi toprağı</td><td>${w.hh.land} dönüm</td></tr>
        <tr><td>Ev kirası</td><td>${lira(w.hh.rent * Math.pow(1.045, year(w.m) - 1965))}</td></tr>
        <tr><td>Haşhaş ruhsatı</td><td>${hasRuhsat(w) ? year(w.m) + ' için var' : isBanYear(year(w.m)) ? 'Yasak' : 'Yok'}</td></tr>
      </table>
      ${w.hh.debt > 0 ? `<div class="group">Borç öde</div><div class="btnrow">
        <button class="small" data-pay="100"${w.hh.cash < 1 ? ' disabled' : ''}>100 lira</button>
        <button class="small" data-pay="1000"${w.hh.cash < 1 ? ' disabled' : ''}>1.000 lira</button>
        <button class="small" data-pay="all"${w.hh.cash < 1 ? ' disabled' : ''}>Ödeyebildiğim kadar</button></div>
        <p class="note">Borç kapanmadan kimse sana toprak satmaz. 3.000 lirayı aşarsa hanede yokluk başlar.</p>` : ''}
      <div class="group">Karanlık defter</div>
      <div class="labor"><span>Jandarmanın dikkati: ${esc(heatLabel(w.heat))}</span><div class="meter heat"><i style="width:${heatPct}%"></i></div></div>
      <p class="note">${w.hh.stash > 0 ? `Samanlığın altındaki zulada ${w.hh.stash} çuval mal var. Durdukça dikkat çeker.` : 'Zula boş.'}
        ${w.flags.kacakci ? ` Kara Rıza çuvalı ${lira(kacakPrice(w))} liradan alıyor.` : ' Kayıt dışı bir alıcı tanımıyorsun.'}</p>
      ${w.hh.stash > 0 && w.flags.kacakci ? `<div class="btnrow"><button class="small danger" data-stash="sell">Zulayı Kara Rıza'ya sat (${lira(w.hh.stash * kacakPrice(w))})</button></div>` : ''}
      ${(w.flags.kacakToplam as number) ? `<p class="note">Bugüne kadar kayıt dışına çıkan: ${w.flags.kacakToplam} çuval.</p>` : ''}`;
  }

  // ---------- Kronik ----------
  private chronicleHTML(): string {
    const w = this.w!;
    const items = w.chronicle.slice(-250).reverse();
    return `<ul class="chron">${items.map((e) => `<li class="${e.k}"><time>${dateText(e.m)}</time>${esc(e.t)}</li>`).join('')}</ul>`;
  }

  private bindPanel(panel: HTMLElement) {
    const w = this.w!;
    panel.querySelectorAll<HTMLSelectElement>('[data-job]').forEach((s) => {
      s.onchange = () => {
        setJob(w, s.dataset.job!, s.value as JobId);
        save(w);
        this.renderPanel(true);
      };
      s.onblur = () => {
        if (this.pendingPanel) this.renderPanel(false);
      };
    });
    panel.querySelectorAll<HTMLButtonElement>('[data-heir]').forEach((b) => (b.onclick = () => {
      setHeir(w, b.dataset.heir!);
      save(w);
      this.renderPanel(true);
    }));
    panel.querySelectorAll<HTMLButtonElement>('[data-sow]').forEach((b) => (b.onclick = () => {
      const [fid, c] = b.dataset.sow!.split(':');
      const err = sow(w, fid, c as CropId);
      if (err) this.toast(err);
      save(w);
      this.renderPanel(true);
    }));
    panel.querySelectorAll<HTMLSelectElement>('[data-assign]').forEach((sel) => {
      sel.onchange = () => {
        if (sel.value) assignWorker(w, sel.value, sel.dataset.assign!);
        save(w);
        this.renderPanel(true);
      };
      sel.onblur = () => {
        if (this.pendingPanel) this.renderPanel(false);
      };
    });
    panel.querySelectorAll<HTMLButtonElement>('[data-unassign]').forEach((b) => (b.onclick = () => {
      assignWorker(w, b.dataset.unassign!, null);
      save(w);
      this.renderPanel(true);
    }));
    panel.querySelectorAll<HTMLButtonElement>('[data-hire]').forEach((b) => (b.onclick = () => {
      const [fid, d] = b.dataset.hire!.split(':');
      const f = w.hh.parcels.find((x) => x.id === fid);
      if (f) setHired(w, fid, f.hired + Number(d));
      save(w);
      this.renderPanel(true);
    }));
    panel.querySelectorAll<HTMLButtonElement>('[data-stash]').forEach((b) => (b.onclick = () => {
      const v = sellStash(w);
      if (v) this.toast(`Zula satıldı: ${lira(v)}`);
      save(w);
      this.renderPanel(true);
    }));
    panel.querySelectorAll<HTMLButtonElement>('[data-pay]').forEach((b) => (b.onclick = () => {
      const v = b.dataset.pay === 'all' ? w.hh.cash : Number(b.dataset.pay);
      payDebt(w, v);
      save(w);
      this.renderPanel(true);
    }));
  }

  private toast(msg: string) {
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.setAttribute('role', 'status');
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = 'show';
    window.setTimeout(() => t && (t.className = ''), 2600);
  }

  // ---------- Olay kartı ----------
  private renderOverlay() {
    const ov = $('#overlay');
    const w = this.w;
    if (!ov || !w) return;
    if (this.ceremony) {
      const pl = P(w, w.playerId);
      ov.innerHTML = `<div class="veil"><article class="doc" role="dialog" aria-label="Tapu senedi">
        <div class="kilim"></div>
        <div class="stamp">İLK<br>TAPU</div>
        <div class="head">Tapu senedi, ${dateText(w.m)}</div>
        <p>Karaçam köyü, köy kenarı mevkii.<br>5 dönüm tarla.<br>Malik: ${esc(pl ? fullName(pl) : w.surname)}.<br>Bedeli: ${lira(this.ceremony.price)}.</p>
        <p style="font-size:16px;color:#6a5a43">${esc(w.surname)} ailesinin ilk kendi toprağı.</p>
        <div class="opts"><button id="okTapu">Tarlaya git</button></div></article></div>`;
      $('#okTapu')!.onclick = () => {
        this.ceremony = null;
        this.refresh();
      };
      return;
    }
    const c = w.cards[0];
    if (!c) {
      ov.innerHTML = '';
      return;
    }
    ov.innerHTML = `<div class="veil"><article class="doc" role="dialog" aria-labelledby="ct">
      <div class="kilim"></div>
      <div class="head">${KIND[c.id] ?? 'Haber'}, ${dateText(c.m)}</div>
      <p id="ct">${esc(c.text)}</p>
      <div class="opts">${c.opts.map((o) => `<button data-opt="${esc(o.k)}">${esc(o.t)}</button>`).join('')}</div>
    </article></div>`;
    ov.querySelectorAll<HTMLButtonElement>('[data-opt]').forEach((b) => (b.onclick = () => this.choose(c, b.dataset.opt!)));
    (ov.querySelector('button') as HTMLButtonElement | null)?.focus();
  }

  private choose(c: Card, k: string) {
    const w = this.w!;
    const hadLand = w.hh.land;
    resolveCard(w, c.uid, k);
    if (c.id === 'tapu' && hadLand === 0 && w.hh.land > 0) this.ceremony = { price: (c.data?.price as number) ?? 0 };
    save(w);
    if (w.over) return this.showEnd();
    this.refresh();
  }

  // ---------- Son ----------
  private showEnd() {
    this.stop();
    this.map?.destroy();
    this.map = null;
    const w = this.w!;
    const first = Object.values(w.people).find((p) => p.blood && p.fa === w.flags.babaId);
    const highlights = w.chronicle.filter((e) => e.k === 'tapu' || e.k === 'miras' || e.k === 'son');
    this.root.innerHTML = `<main class="end">
      <h1>Ocak söndü</h1>
      <p class="lede">${esc(w.over?.reason ?? '')} ${esc(w.surname)} ailesi ${year(w.m) - 1965} yıl boyunca ${w.flags.nesil ?? 1} nesil sürdü${first ? `, ilk adım ${esc(first.first)} ile atıldı` : ''}.</p>
      <ul class="chron">${highlights.map((e) => `<li class="${e.k}"><time>${dateText(e.m)}</time>${esc(e.t)}</li>`).join('')}</ul>
      <button class="primary" id="again">Yeni bir hayata başla</button></main>`;
    $('#again')!.onclick = () => {
      wipe();
      this.showStart();
    };
  }
}

const fmt1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('tr-TR');

function monthsUntilSow(m: number): string {
  const mo = ((m % 12) + 12) % 12;
  if (mo < 2) return 'Mart ayında (nohut)';
  if (mo < 9) return mo <= 3 ? 'bu ay' : 'Ekim ayında (buğday, arpa, haşhaş)';
  return 'Mart ayında (nohut)';
}
