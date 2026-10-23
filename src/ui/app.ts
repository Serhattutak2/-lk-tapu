// Arayüz: açılış, oyun ekranı, paneller, olay kartları, son ekranı.
import type { Card, JobId, Person, World } from '../core/types';
import { migrate, newWorld } from '../core/world';
import { advance, canAdvance, payDebt, resolveCard, setHeir, setJob, isPlainJSON } from '../core/sim';
import { age, alive, bloodLiving, fullName, hhMembers, P, relationTo } from '../core/people';
import { JOBS, jobsFor, wage } from '../core/jobs';
import { landPrice } from '../core/cards';
import { BIZ, bizAvailable, bizIncome, bizManager, bizPrice, buyBiz, buyHouse, buyPlot, buyVehicle, HOUSES, housePrice, landBlockers, nam, sellVehicle, setManager, title, TRACTOR_POWER, VEHICLES, vehiclePrice } from '../core/assets';
import { offerChance, offerPrice, PLOTS, plotOwnerName, plotPrice } from '../core/plots';
import type { BizId, VehicleId } from '../core/types';
import type { Pick } from './map';
import { assignWorker, CROPS, careOf, expectedValue, harvestMonth, hasRuhsat, hireAll, idleWage, irgatWage, isBanYear, kacakPrice, laborNeed, personFieldLabel, qualityOf, recallAll, seedCost, sellStash, setHired, setMode, sow, sowAll, sowableNow, staffAll, workersOf } from '../core/fields';
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
  private tab: 'aile' | 'tarla' | 'mulk' | 'hane' | 'kronik' = 'aile';
  private pick: Pick | null = null;
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
          <button role="tab" data-tab="mulk">Mülk</button>
          <button role="tab" data-tab="hane">Hane</button>
          <button role="tab" data-tab="kronik">Kronik</button>
        </nav>
        <section class="panel" id="panel"></section>
      </div>
      <div id="sheet"></div>
      <div id="overlay"></div>`;
    this.map = new VillageMap($<HTMLCanvasElement>('#cv')!, () => this.w);
    this.map.onPick = (pk) => {
      this.pick = pk;
      this.renderSheet();
    };
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
    this.renderSheet();
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
    const tt = title(w);
    if (who) who.innerHTML = alive(pl)
      ? `<b>${esc(fullName(pl))}</b>, ${age(w, pl)} yaşında, ${JOBS[pl.job].ad.toLowerCase()}<span class="ttl">${esc(tt.ad)} · nam ${nam(w)}${tt.next ? ` / ${tt.next.min}` : ''}</span>`
      : 'Aile yasta';
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
    else if (this.tab === 'mulk') panel.innerHTML = this.estateHTML();
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
    if (p.job === 'isletme' && p.biz) return `${BIZ[p.biz].ad} başında; işletme bu ay ${lira(bizIncome(w, p.biz))} kazandırıyor`;
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
        <p class="note">Köyde 5 dönüm tarla şu an ${lira(price)} civarında. Toprak her yıl pahalanıyor.</p>
        <div class="meter"><i style="width:${pct}%"></i></div>
        <p class="note">Birikim: ${lira(w.hh.cash)} / ${lira(price)}</p>
        ${blk.length ? `<ul class="blockers">${blk.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
        ${this.marketHTML()}`;
    }
    const now = sowableNow(w);
    const empty = w.hh.parcels.filter((f) => !f.crop && f.mode === 'kendi').length;
    const idle = hhMembers(w).filter((q) => !q.away && q.job === 'tarla' && age(w, q) >= 14).length;
    const short = w.hh.parcels.filter((f) => f.mode === 'kendi' && f.lastNeed > 0 && f.lastGot < f.lastNeed * 0.97).length;
    const trac = w.hh.veh.traktor || 0;
    const rows = w.hh.parcels.map((f) => {
      const i = w.plots.findIndex((x) => x.pid === f.id);
      const ws = workersOf(w, f).length;
      return `<tr data-goto="${f.id}"><td>${f.no}. ${esc(i >= 0 ? PLOTS[i].yer : '')}</td><td>${f.mode === 'yarici' ? 'Yarıcıda' : f.crop ? esc(CROPS[f.crop].ad) + (f.illegal ? ' !' : '') : 'Boş'}</td><td>${f.crop ? '%' + Math.round(careOf(f) * 100) : '–'}</td><td>${f.mode === 'yarici' ? '–' : `${ws}${f.hired ? '+' + f.hired : ''}${f.trac ? '+T' : ''}`}</td></tr>`;
    }).join('');
    return `<div class="bulk">
        <div class="group">Bütün tarlalar</div>
        <table class="ftable"><tr><th>Parsel</th><th>Ekin</th><th>Bakım</th><th>İşçi</th></tr>${rows}</table>
        <p class="note">${w.hh.parcels.length} parsel, ${w.hh.land} dönüm. ${short ? `${short} parselde iş gücü eksik. ` : ''}${trac ? `${trac} traktör, ayda ${fmt1(trac * TRACTOR_POWER)} işçi gücü; eksik parsellere kendiliğinden gider.` : ''}</p>
        ${empty && now.filter((c) => c !== 'hashas' || hasRuhsat(w)).length ? `<div class="btnrow">${now.map((c) => `<button class="small" data-sowall="${c}">Boş ${empty} parsele ${esc(CROPS[c].ad.toLowerCase())} ek</button>`).join('')}</div>` : ''}
        <div class="btnrow">
          <button class="small" data-bulk="staff"${idle ? '' : ' disabled'}>Gündelikçileri tarlalara dağıt (${idle})</button>
          <button class="small" data-bulk="hire1">Her parsele 1 ırgat</button>
          <button class="small" data-bulk="hire0">Irgatları gönder</button>
          <button class="small" data-bulk="recall">Herkesi geri çağır</button>
        </div>
      </div>
      ${w.hh.parcels.map((f) => this.parcelHTML(f, now)).join('')}
      ${this.marketHTML()}
      <p class="note">Ekim ayları: buğday, arpa ve haşhaş Ekim–Kasım; nohut Mart–Nisan; şeker pancarı Nisan. Ruhsat her yıl Ağustos'ta alınır. Haritada bir tarlaya dokunursan sahibini ve fiyatını görürsün.</p>`;
  }

  private marketHTML(): string {
    const w = this.w!;
    const n = nam(w);
    const list = w.plots.map((_, i) => i).filter((i) => w.plots[i].o !== 'biz' && offerChance(w, i, n) > 0).sort((a, b) => offerPrice(w, a) - offerPrice(w, b)).slice(0, 6);
    if (!list.length) return '';
    return `<div class="group">Köyde alınabilecek tarlalar</div>
      <table class="ftable">${list.map((i) => `<tr data-plot="${i}"><td>${esc(PLOTS[i].yer)}<br><span class="note">${esc(plotOwnerName(w, i))}</span></td><td>Verim ${Math.round(PLOTS[i].q * 100)}</td><td>${lira(offerPrice(w, i))}${w.plots[i].sale ? '' : '<br><span class="note">teklif</span>'}</td></tr>`).join('')}</table>`;
  }

  // ---------- Mülk ----------
  private estateHTML(): string {
    const w = this.w!;
    const tt = title(w);
    const n = nam(w);
    const hv = HOUSES[w.hh.house];
    const nh = HOUSES[w.hh.house + 1];
    const yr = year(w.m);
    const veh = (Object.keys(VEHICLES) as VehicleId[]).map((v) => {
      const d = VEHICLES[v];
      const have = w.hh.veh[v] || 0;
      const lock = yr < d.from;
      return `<div class="asset"><div class="prow"><span class="pname">${esc(d.ad)}</span>${have ? `<span class="badge sen">${have} tane</span>` : ''}</div>
        <p class="note">${esc(d.desc)}</p>
        <div class="btnrow">${lock ? `<span class="note">${d.from}'de gelir</span>` : `<button class="small" data-veh="${v}"${w.hh.cash < vehiclePrice(w, v) ? ' disabled' : ''}>Satın al (${lira(vehiclePrice(w, v))})</button>`}
        ${have ? `<button class="small" data-sellveh="${v}">Sat (${lira(vehiclePrice(w, v) * 0.55)})</button>` : ''}</div></div>`;
    }).join('');
    const biz = (Object.keys(BIZ) as BizId[]).map((b) => {
      const d = BIZ[b];
      const own = !!w.hh.biz[b];
      const why = bizAvailable(w, b);
      const mgr = bizManager(w, b);
      const cand = hhMembers(w).filter((q) => !q.away && age(w, q) >= 16);
      return `<div class="asset"><div class="prow"><span class="pname">${esc(d.ad)}</span>${own ? '<span class="badge sen">Bizim</span>' : ''}</div>
        <p class="note">${esc(d.desc)}</p>
        ${own ? `<p class="note">Bu ay kazancı ${lira(bizIncome(w, b))}.</p>
          <select data-mgr="${b}" aria-label="${esc(d.ad)} başına kim geçsin"><option value="">Başında kimse yok</option>${cand.map((q) => `<option value="${q.id}"${mgr?.id === q.id ? ' selected' : ''}>${esc(q.first)}, ticaret ${Math.round(q.sk.ticaret)}</option>`).join('')}</select>`
        : why && why !== 'Zaten senin.' ? `<p class="note">${esc(why)}</p>` : `<button class="small" data-biz="${b}"${w.hh.cash < bizPrice(w, b) ? ' disabled' : ''}>Devral (${lira(bizPrice(w, b))})</button>`}</div>`;
    }).join('');
    const nextT = tt.next ? Math.min(100, Math.round((n / tt.next.min) * 100)) : 100;
    return `<div class="rank"><div class="pname">${esc(tt.ad)}</div>
        <p class="note">Nam ${n}${tt.next ? `. "${esc(tt.next.ad)}" için ${tt.next.min}` : ''}. Toprak, ev, taşıt, işletme ve kasadaki para namı büyütür; borç küçültür.</p>
        <div class="meter"><i style="width:${nextT}%"></i></div></div>
      <div class="group">Ev</div>
      <div class="asset"><div class="prow"><span class="pname">${esc(hv.ad)}</span></div><p class="note">${esc(hv.desc)}</p>
        ${nh ? `<p class="note">Sıradaki: ${esc(nh.ad)}. ${esc(nh.desc)}</p><button class="small" data-house="1"${w.hh.cash < housePrice(w, nh.lvl) ? ' disabled' : ''}>${w.hh.house === 0 ? 'Satın al' : 'Yaptır'} (${lira(housePrice(w, nh.lvl))})</button>` : ''}</div>
      <div class="group">Taşıtlar</div>${veh}
      <div class="group">Köy işletmeleri</div>${biz}`;
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
    const pl = w.plots.findIndex((x) => x.pid === f.id);
    if (f.mode === 'yarici') {
      return `<section class="parcel" id="pc-${f.id}">
      <div class="prow"><span class="pname">${f.no}. parsel</span><span class="prel">${esc(pl >= 0 ? PLOTS[pl].yer : '')}, verim ${Math.round(qualityOf(w, f) * 100)}</span></div>
      <div class="seg mode"><button data-mode="${f.id}:kendi" aria-pressed="false">Kendimiz ekiyoruz</button><button data-mode="${f.id}:yarici" aria-pressed="true">Yarıcıya ver</button></div>
      <p class="note">Köylü bir yarıcı ekip biçiyor; tohum ve emek onun, hasadın %40'ı bizim. Haşhaşa dokunmaz.</p>
      ${f.crop ? `<div class="crop"><b>${CROPS[f.crop].ad}</b>, hasat ${dateText(harvestMonth(f))}, payımız ~${lira(expectedValue(w, f))}</div>` : '<p class="note">Ekim zamanını bekliyor.</p>'}
      ${f.hist.length ? `<div class="hist">Son hasatlar: ${f.hist.slice(0, 3).map((h) => `${year(h.m)} ${CROPS[h.crop].ad.toLowerCase()}, ${esc(h.t)}`).join('; ')}</div>` : ''}
    </section>`;
    }
    const pool = hhMembers(w).filter((q) => !q.away && age(w, q) >= 10 && !(q.job === 'kendi' && q.parcel === f.id));
    const needTxt = need > 0
      ? `<div class="labor"><span>Bu ay gereken iş gücü ${fmt1(need)}, gelen ${fmt1(f.lastGot || 0)}${f.trac ? ` (traktör ${fmt1(f.trac)})` : ''}</span><div class="meter${(f.lastGot || 0) < need * 0.97 ? ' short' : ''}"><i style="width:${Math.min(100, Math.round(((f.lastGot || 0) / need) * 100))}%"></i></div></div>`
      : `<p class="note">Bu ay parselde iş yok. Buradaki işçiler başkasının tarlasına gündeliğe gidiyor.</p>`;
    return `<section class="parcel" id="pc-${f.id}">
      <div class="prow"><span class="pname">${f.no}. parsel</span><span class="prel">${esc(pl >= 0 ? PLOTS[pl].yer : '')}, verim ${Math.round(qualityOf(w, f) * 100)}${f.price ? `, ${year(f.boughtM)}'de ${lira(f.price)}` : ''}</span></div>
      <div class="seg mode"><button data-mode="${f.id}:kendi" aria-pressed="${f.mode === 'kendi'}">Kendimiz ekiyoruz</button><button data-mode="${f.id}:yarici" aria-pressed="false"${f.crop === 'hashas' ? ' disabled' : ''}>Yarıcıya ver</button></div>
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
    const act = (fn: () => void) => () => {
      fn();
      save(w);
      this.renderPanel(true);
    };
    panel.querySelectorAll<HTMLButtonElement>('[data-sowall]').forEach((b) => (b.onclick = act(() => {
      const r = sowAll(w, b.dataset.sowall as CropId);
      this.toast(r.n ? `${r.n} parsele ekildi.` : r.err ?? 'Ekilecek boş parsel yok.');
    })));
    panel.querySelectorAll<HTMLButtonElement>('[data-bulk]').forEach((b) => (b.onclick = act(() => {
      const k = b.dataset.bulk;
      if (k === 'staff') this.toast(`${staffAll(w)} kişi tarlalara gönderildi.`);
      if (k === 'hire1') hireAll(w, 1);
      if (k === 'hire0') hireAll(w, 0);
      if (k === 'recall') recallAll(w);
    })));
    panel.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) => (b.onclick = act(() => {
      const [fid, m] = b.dataset.mode!.split(':');
      setMode(w, fid, m as 'kendi' | 'yarici');
    })));
    panel.querySelectorAll<HTMLElement>('[data-goto]').forEach((r) => (r.onclick = () => document.getElementById('pc-' + r.dataset.goto)?.scrollIntoView({ block: 'start', behavior: 'smooth' })));
    panel.querySelectorAll<HTMLElement>('[data-plot]').forEach((r) => (r.onclick = () => {
      this.pick = { kind: 'plot', i: Number(r.dataset.plot) };
      if (this.map) this.map.selected = this.pick;
      this.renderSheet();
    }));
    panel.querySelectorAll<HTMLButtonElement>('[data-veh]').forEach((b) => (b.onclick = act(() => this.toast(buyVehicle(w, b.dataset.veh as VehicleId).msg))));
    panel.querySelectorAll<HTMLButtonElement>('[data-sellveh]').forEach((b) => (b.onclick = act(() => {
      const v = sellVehicle(w, b.dataset.sellveh as VehicleId);
      this.toast(`Satıldı: ${lira(v)}`);
    })));
    panel.querySelectorAll<HTMLButtonElement>('[data-biz]').forEach((b) => (b.onclick = act(() => this.toast(buyBiz(w, b.dataset.biz as BizId).msg))));
    panel.querySelectorAll<HTMLButtonElement>('[data-house]').forEach((b) => (b.onclick = act(() => this.toast(buyHouse(w).msg))));
    panel.querySelectorAll<HTMLSelectElement>('[data-mgr]').forEach((sel) => {
      sel.onchange = act(() => setManager(w, sel.dataset.mgr as BizId, sel.value || null));
      sel.onblur = () => {
        if (this.pendingPanel) this.renderPanel(false);
      };
    });
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

  // ---------- Harita kartı ----------
  private renderSheet() {
    const el = $('#sheet');
    const w = this.w;
    if (!el || !w) return;
    const pk = this.pick;
    if (!pk) {
      el.innerHTML = '';
      return;
    }
    let body = '';
    if (pk.kind === 'plot') {
      const i = pk.i;
      const d = PLOTS[i];
      const st = w.plots[i];
      if (st.o === 'biz') {
        const f = w.hh.parcels.find((x) => x.id === st.pid)!;
        body = `<h3>${esc(d.yer)}, ${f.no}. parselimiz</h3>
          <p>5 dönüm, verim ${Math.round(d.q * 100)}. ${f.mode === 'yarici' ? 'Yarıcıda.' : f.crop ? `${esc(CROPS[f.crop].ad)}, hasat ${dateText(harvestMonth(f))}, bakım %${Math.round(careOf(f) * 100)}.` : 'Boş.'} Çalışan: ${workersOf(w, f).length} kişi${f.hired ? `, ${f.hired} ırgat` : ''}.</p>
          <div class="btnrow"><button class="primary sm" data-sheet="goto:${f.id}">Tarlayı yönet</button></div>`;
      } else {
        const n = nam(w);
        const ch = offerChance(w, i, n);
        const price = offerPrice(w, i);
        const blk = landBlockers(w);
        const owner = plotOwnerName(w, i);
        let state: string;
        if (st.sale) state = `Satışta: ${lira(price)}.`;
        else if (ch <= 0) state = st.o === 'aga' ? `Ağa toprağını satmıyor. Adın büyüdükçe (nam 40 ve üstü) teklif dinler.` : `${esc(owner)} bu yıl seninle konuşmuyor.`;
        else state = `Satışta değil. Gönlünü yapmak için ${lira(price)} teklif edebilirsin; kabul etme ihtimali aşağı yukarı %${Math.round(ch * 100)}. Reddederse bu yıl bir daha konuşmaz.`;
        const can = ch > 0 && !blk.length && w.hh.cash >= price;
        body = `<h3>${esc(d.yer)} mevkii</h3>
          <p>Sahibi: ${esc(owner)}. 5 dönüm, verim ${Math.round(d.q * 100)}${d.aga ? ', ağanın en iyi toprakları' : ''}. Bugünkü değeri ${lira(plotPrice(w, i))}.</p>
          <p>${state}</p>
          ${blk.length ? `<ul class="blockers">${blk.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
          ${ch > 0 && w.hh.cash < price && !blk.length ? `<p class="note">Kasada ${lira(price - w.hh.cash)} eksik.</p>` : ''}
          ${ch > 0 ? `<div class="btnrow"><button class="primary sm" data-sheet="buy:${i}"${can ? '' : ' disabled'}>${st.sale ? 'Satın al' : 'Teklif ver'} (${lira(price)})</button></div>` : ''}`;
      }
    } else {
      const k = pk.k;
      if (k === 'evOyuncu') {
        const hv = HOUSES[w.hh.house];
        const nh = HOUSES[w.hh.house + 1];
        body = `<h3>${esc(hv.ad)}</h3><p>${esc(hv.desc)}</p>
          ${nh ? `<p>Sıradaki: <b>${esc(nh.ad)}</b>. ${esc(nh.desc)}</p><div class="btnrow"><button class="primary sm" data-sheet="house"${w.hh.cash < housePrice(w, nh.lvl) ? ' disabled' : ''}>${w.hh.house === 0 ? 'Satın al' : 'Yaptır'} (${lira(housePrice(w, nh.lvl))})</button><button class="small" data-sheet="tab:mulk">Bütün mülk</button></div>` : ''}`;
      } else if (k === 'konak') {
        body = `<h3>Bozbey Ağa'nın konağı</h3>
          <p>Köyün en iyi topraklarının, ev kiralarının ve borç defterinin sahibi.${w.hh.debt ? ` Ona ${lira(w.hh.debt)} borcun var; ayda %2 işliyor.` : ' Ona borcun yok.'}${Number(w.flags.agaKin || 0) >= year(w.m) ? ` Sana kızgın: ${w.flags.agaKin} yılına kadar köyde kimse sana toprak satmaz.` : ''}</p>
          <p class="note">Ağanın tarlaları haritanın üst ve sol köşelerinde, biraz daha koyu. Nam 40'ı geçince satmayı düşünür, nam 55'i geçince bazen kendisi satışa çıkarır.</p>
          ${w.hh.debt && w.hh.cash ? `<div class="btnrow"><button class="primary sm" data-sheet="pay">Borcu öde (${lira(Math.min(w.hh.cash, w.hh.debt))})</button></div>` : ''}`;
      } else {
        const b = k as BizId;
        const d = BIZ[b];
        const own = !!w.hh.biz[b];
        const why = bizAvailable(w, b);
        const mgr = bizManager(w, b);
        body = `<h3>${esc(d.ad)}${own ? ', bizim' : ''}</h3><p>${esc(d.desc)}</p>
          ${own ? `<p>Bu ay kazancı ${lira(bizIncome(w, b))}. ${mgr ? `Başında ${esc(mgr.first)} var.` : 'Başında kimse yok; Mülk sekmesinden birini görevlendir.'}</p><div class="btnrow"><button class="small" data-sheet="tab:mulk">Mülk sekmesi</button></div>`
          : why && why !== 'Zaten senin.' ? `<p class="note">${esc(why)}</p>` : `<div class="btnrow"><button class="primary sm" data-sheet="biz:${b}"${w.hh.cash < bizPrice(w, b) ? ' disabled' : ''}>Devral (${lira(bizPrice(w, b))})</button></div>`}`;
      }
    }
    el.innerHTML = `<div class="sheet" role="dialog" aria-label="Seçili yer"><button class="close" data-sheet="close" aria-label="Kapat">Kapat</button>${body}</div>`;
    el.querySelectorAll<HTMLButtonElement>('[data-sheet]').forEach((b) => (b.onclick = () => this.sheetAct(b.dataset.sheet!)));
  }

  private sheetAct(a: string) {
    const w = this.w!;
    const [cmd, arg] = a.split(':');
    if (cmd === 'close') {
      this.pick = null;
      if (this.map) this.map.selected = null;
    } else if (cmd === 'buy') {
      const r = buyPlot(w, Number(arg));
      if (r.ok && r.msg === 'ilk') this.ceremony = { price: w.hh.parcels[0].price };
      else this.toast(r.msg);
    } else if (cmd === 'house') {
      this.toast(buyHouse(w).msg);
    } else if (cmd === 'biz') {
      this.toast(buyBiz(w, arg as BizId).msg);
    } else if (cmd === 'pay') {
      payDebt(w, w.hh.cash);
    } else if (cmd === 'goto' || cmd === 'tab') {
      this.tab = cmd === 'goto' ? 'tarla' : (arg as typeof this.tab);
      this.pick = null;
      if (this.map) this.map.selected = null;
      this.renderPanel(true);
      if (cmd === 'goto') document.getElementById('pc-' + arg)?.scrollIntoView({ block: 'start' });
    }
    save(w);
    this.refresh();
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
