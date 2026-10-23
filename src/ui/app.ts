// Arayüz: açılış, oyun ekranı, paneller, olay kartları, son ekranı.
import type { Card, JobId, Person, World } from '../core/types';
import { newWorld } from '../core/world';
import { advance, canAdvance, payDebt, resolveCard, setHeir, setJob, isPlainJSON } from '../core/sim';
import { age, alive, bloodLiving, fullName, hhMembers, P, relationTo } from '../core/people';
import { JOBS, jobsFor } from '../core/jobs';
import { landPrice } from '../core/cards';
import { dateText, year } from '../core/calendar';
import { VillageMap } from './map';

const SAVE_KEY = 'ilktapu_v1';
const SPEEDS = [0, 2200, 700];
const KIND: Record<string, string> = { veraset: 'Veraset', gorucu: 'Görücü', hastalik: 'Hastalık', gurbet: 'Gurbet', tuccar: 'Tanışıklık', tapu: 'Tapu', bilgi: 'Haber' };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const lira = (n: number) => Math.round(n).toLocaleString('tr-TR') + ' lira';
const $ = <T extends HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T | null;

function load(): World | null {
  try {
    const s = localStorage.getItem(SAVE_KEY);
    return s ? (JSON.parse(s) as World) : null;
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
  private tab: 'aile' | 'hane' | 'kronik' = 'aile';
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
      p.away ? '<span class="badge gurbet">Gurbette</span>' : '',
      p.sick ? '<span class="badge hasta">Hasta</span>' : '',
    ].join('');
    const hp = Math.round(p.hp);
    const a = age(w, p);
    let jobCtl = '';
    if (inHouse && !p.away && a >= 7) {
      const opts = jobsFor(w, p).filter((j) => j.id !== 'yok' || p.job === 'yok');
      jobCtl = `<select data-job="${p.id}" aria-label="${esc(p.first)} ne iş yapsın">${opts.map((j) => `<option value="${j.id}"${j.id === p.job ? ' selected' : ''}>${j.ad}</option>`).join('')}</select>`;
    } else if (p.away) {
      jobCtl = `<span>Almanya'da işçi</span>`;
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
    </div>`;
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
    const price = landPrice(w);
    const goal = w.hh.land === 0
      ? `<p class="note">İlk tapuya ${lira(price)} gerekiyor. ${w.hh.cash >= price ? 'Para hazır; satılık tarla çıkınca haber gelir.' : `${lira(price - w.hh.cash)} daha biriktirmelisin.`}</p>`
      : `<p class="note">Kendi tarlanın hasadı her yıl Eylül'de kasaya girer. Tarımı en iyi bilen aile üyesi verimi artırır.</p>`;
    return `
      <table class="ledger">
        <tr><td>Geçen ay gelir</td><td>${lira(w.lastIncome)}</td></tr>
        <tr><td>Geçen ay gider (faiz dahil)</td><td>${lira(w.lastExpense)}</td></tr>
        <tr><td>Kasa</td><td>${lira(w.hh.cash)}</td></tr>
        <tr><td>Ağaya borç (aylık %2 faiz)</td><td>${lira(w.hh.debt)}</td></tr>
        <tr><td>Kendi toprağı</td><td>${w.hh.land} dönüm</td></tr>
        <tr><td>5 dönüm tarla fiyatı</td><td>${lira(price)}</td></tr>
      </table>
      ${goal}
      ${w.hh.debt > 0 ? `<div class="group">Borç öde</div><div class="btnrow">
        <button class="small" data-pay="100"${w.hh.cash < 1 ? ' disabled' : ''}>100 lira</button>
        <button class="small" data-pay="500"${w.hh.cash < 1 ? ' disabled' : ''}>500 lira</button>
        <button class="small" data-pay="all"${w.hh.cash < 1 ? ' disabled' : ''}>Ödeyebildiğim kadar</button></div>
        <p class="note">Borç beklerse faiz büyür; 3.000 lirayı aşınca hanede yokluk başlar ve sağlıklar bozulur.</p>` : ''}`;
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
    panel.querySelectorAll<HTMLButtonElement>('[data-pay]').forEach((b) => (b.onclick = () => {
      const v = b.dataset.pay === 'all' ? w.hh.cash : Number(b.dataset.pay);
      payDebt(w, v);
      save(w);
      this.renderPanel(true);
    }));
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
