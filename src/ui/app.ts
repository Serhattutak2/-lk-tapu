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
import { BASE_CAP, buildRoom, canBuild, capacity, crowded, residents, roomPrice, ROOMS, SLOTS } from '../core/home';
import { AGIL_PRICE, buildLab, buyAgil, buyRaw, cevdetPay, hamPrice, hapPrice, hireCevdet, LAB_LEVELS, labCapacity, labPrice, labSkill, labWorkers, moveStash, paketPrice, sellProduct, siteOk, SITES, unlocked } from '../core/lab';
import { attackRival, feudLabel, gangPay, lockedOut, rP, setLock } from '../core/feud';
import { buyCityHome, buyFac, CITY, FACS, facIncome, facPrice, hire, HOMES, homePrice, launderCap, launderFee, moveToCity, setFacMgr, takeTurf, underTitle } from '../core/baron';
import type { DInv, DistId, FacId, TechId } from '../core/types';
import { buyTech, eraOf, TECHS, techPrice } from '../core/era';
import { DISTS, distIncome, invest, invPrice, INVS, menNeeded, takeDistrict } from '../core/district';
import { doneGoals, GOALS } from '../core/goals';
import type { LabSite, RoomId } from '../core/types';
import { ambarCap, ambarUsed, ambarValue, nextSowText, sellAmbar, setPlan, setPlanAll, STORABLE } from '../core/fields';
import { MK_AD, mk, shockOf, trend } from '../core/market';
import type { MkId } from '../core/market';
import { assignWorker, CROPS, careOf, expectedValue, harvestMonth, hasRuhsat, hireAll, idleWage, irgatWage, isBanYear, kacakPrice, laborNeed, personFieldLabel, qualityOf, recallAll, seedCost, sellStash, setHired, setMode, sow, sowAll, sowableNow, staffAll, workersOf } from '../core/fields';
import { heatLabel, RENT_CAP } from '../core/crime';
import type { CropId, Parcel } from '../core/types';
import { dateText, infl, year } from '../core/calendar';
import { VillageMap } from './map';

const SAVE_KEY = 'ilktapu_v1';
const NEWS_KEY = 'ilktapu_haber';
export const NEWS = {
  v: '0.7',
  items: [
    ['Oyun artık 1925\'te başlıyor', 'Cumhuriyetin ilk yıllarından başlıyorsun: kara saban, gaz lambası, eşkıya, kaçak tütün. Teknolojiler yine kendi yıllarında gelir; ama ailen onlara kadar kırk yıl büyür, ilk tapuyu, ilk evi, ilk dükkânı çok önceden alır.'],
    ['Dört yeni çağ', 'Kuruluş Yılları (1925), Savaş Yılları (1939), Toprak Yılları (1946), Gurbet Yılları (1961). Yeni eski teknolojiler: demir pulluk, gramofon, dikiş makinesi, bisiklet; kendiliğinden gelen sıtma savaşı, penisilin, köy yolu.'],
    ['Tarihin içinden 18 yeni olay', 'Yeni harfler, Soyadı Kanunu, eşkıya haracı, kaçak tütün katırcıları, Büyük Buhran\'da yok pahasına satılan tarlalar, seferberlik, ekmek karnesi ve karaborsa, Köy Enstitüsü, Çiftçiyi Topraklandırma, ilk gerçek seçim, ağanın traktörü, 1960, Almanya anlaşması, hac, kurtlar, harman yangını, piyango.'],
    ['Ekim planı', 'Her tarlaya bir kez ne ekeceğini söyle; sen değiştirmedikçe her yıl o ay kendiliğinden ekilir. İstersen işçileri de her ay kendiliğinden dağıtır.'],
    ['Değişen fiyatlar ve ambar', 'Buğday, arpa, nohut, pancar ve hayvan fiyatı her yıl değişir: kuraklık, buhran, savaş, kriz. Tahılı ambara koyup fiyat yükselince satabilirsin.'],
    ['Sağlık çağa göre', 'Hastalık artık adıyla gelir: sıtma, verem, tifo, kalp. 1925\'te ninelerin otu, hoca, sağlıkçı ya da kasabadaki hekim; sonra sağlık ocağı, devlet hastanesi, özel hastane. Fiyat her seferinde değişir, iyileşme garanti değildir.'],
    ['Kurban, düğün, borç', 'Kurban Bayramı her yıl takvimde kayar; kurbanlık fiyatı hayvan piyasasına göre oynar, ahırın varsa kendi koçunu kesersin. Düğün takısı ve komşunun istediği borç da her seferinde farklı.'],
    ['Muhtar artık yardım ediyor', 'Köylüler tarlalarını daha kolay satıyor, reddeden üç ay sonra yeniden dinliyor. Muhtar satılık tarla haberini sana getiriyor; muhtarlık seçimi de daha ucuz ve kazanması daha kolay.'],
  ] as [string, string][],
};
const SPEEDS = [0, 3000, 1100, 380];
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
  private tab: 'aile' | 'tarla' | 'mulk' | 'yeralti' | 'sehir' | 'hane' | 'kronik' = 'aile';
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
        <p class="lede">Mart 1925, Karaçam köyü. Savaşlar bitti, Cumhuriyet yeni kuruldu. Kendine ait bir karış toprağı olmayan bir ailenin on altı yaşındaki çocuğusun. Ailen ağaya borçlu, başkasının tarlasında gündelik çalışıyor. Önünde yüz yıl var: kara sabandan drona.</p>
        ${saved && !saved.over ? `<button class="primary" id="cont">${esc(saved.surname)} ailesiyle devam et, ${dateText(saved.m)}</button><div class="group">ya da yeni bir hayat</div>` : ''}
        <label class="field"><span>Soyadı</span><input id="sur" maxlength="20" placeholder="Boş bırakırsan rastgele seçilir" autocomplete="off"></label>
        <label class="field"><span>Adın</span><input id="first" maxlength="20" placeholder="Boş bırakırsan rastgele seçilir" autocomplete="off"></label>
        <div class="field"><span>Doğduğun cinsiyet</span>
          <div class="seg"><button id="sxE" aria-pressed="true">Erkek</button><button id="sxK" aria-pressed="false">Kız</button></div></div>
        <button class="${saved && !saved.over ? 'ghost' : 'primary'}" id="new">Hayata başla</button>
        <button class="linkish" id="news">Sürüm ${NEWS.v}: yenilikleri gör</button>
      </div></main>`;
    const setSex = (s: 'E' | 'K') => {
      sex = s;
      $('#sxE')!.setAttribute('aria-pressed', String(s === 'E'));
      $('#sxK')!.setAttribute('aria-pressed', String(s === 'K'));
    };
    $('#news')!.onclick = () => this.showNews(true);
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
          <div class="maptog" id="maptog" role="group" aria-label="Harita"><button data-map="koy">Köy</button><button data-map="sehir">Şehir</button></div>
          <div class="clock" role="group" aria-label="Zaman">
            <button data-sp="0" aria-label="Durdur">❚❚</button>
            <button data-sp="1" aria-label="Oynat">▶</button>
            <button data-sp="2" aria-label="Hızlı">▶▶</button>
            <button data-sp="3" aria-label="Çok hızlı">▶▶▶</button>
          </div>
        </section>
        <nav class="tabs" role="tablist">
          <button role="tab" data-tab="aile">Aile</button>
          <button role="tab" data-tab="tarla">Tarla</button>
          <button role="tab" data-tab="mulk">Mülk</button>
          <button role="tab" data-tab="yeralti">Yeraltı</button>
          <button role="tab" data-tab="sehir" id="tabSehir">Şehir</button>
          <button role="tab" data-tab="hane">Hane</button>
          <button role="tab" data-tab="kronik">Kronik</button>
        </nav>
        <section class="panel" id="panel"></section>
      </div>
      <div id="sheet"></div>
      <div id="overlay"></div>
      <div id="newsbox"></div>`;
    this.map = new VillageMap($<HTMLCanvasElement>('#cv')!, () => this.w);
    if (w.city.moved) this.map.mode = 'sehir';
    this.root.querySelectorAll<HTMLButtonElement>('[data-map]').forEach((b) => (b.onclick = () => {
      if (!this.map) return;
      this.map.mode = b.dataset.map as 'koy' | 'sehir';
      this.map.selected = null;
      this.pick = null;
      this.renderSheet();
      this.renderTop();
    }));
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
    this.showNews(false);
  }

  private showNews(force: boolean) {
    let seen = '';
    try {
      seen = localStorage.getItem(NEWS_KEY) || '';
    } catch {
      /* yok say */
    }
    if (!force && seen === NEWS.v) return;
    let box = document.getElementById('newsbox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'newsbox';
      document.body.appendChild(box);
    }
    box.innerHTML = `<div class="veil"><article class="doc news" role="dialog" aria-labelledby="nt"><div class="kilim"></div>
      <div class="head">Sürüm ${NEWS.v}</div><h2 id="nt">Köyde neler değişti</h2>
      <ul>${NEWS.items.map(([a, b]) => `<li><b>${esc(a)}.</b> ${esc(b)}</li>`).join('')}</ul>
      <div class="opts"><button id="newsok">Oyuna dön</button></div></article></div>`;
    $('#newsok')!.onclick = () => {
      try {
        localStorage.setItem(NEWS_KEY, NEWS.v);
      } catch {
        /* yok say */
      }
      box!.innerHTML = '';
    };
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
      <span class="date">${dateText(w.m)}<small class="era">${esc(eraOf(w).ad)}</small></span>
      <button class="small" id="menu">Menü</button>
      <div class="stats">
        <span class="stat money">Kasa <b>${lira(w.hh.cash)}</b></span>
        ${w.hh.debt > 0 ? `<span class="stat debt">Borç <b>${lira(w.hh.debt)}</b></span>` : ''}
        <span class="stat">Toprak <b>${w.hh.land} dönüm</b></span>
        ${w.dirty > 0 ? `<span class="stat dirty">Kara kasa <b>${lira(w.dirty)}</b></span>` : ''}
        ${w.heat >= 15 ? `<span class="stat heat">Dikkat <b>${esc(heatLabel(w.heat))}</b></span>` : ''}
      </div>`;
    $('#menu')!.onclick = () => this.showStart();
    const pl = P(w, w.playerId);
    const who = $('#who');
    const tt = title(w);
    if (who) who.innerHTML = alive(pl)
      ? `<b>${esc(fullName(pl))}</b>, ${age(w, pl)} yaşında, ${JOBS[pl.job].ad.toLowerCase()}<span class="ttl">${esc(tt.ad)} · nam ${nam(w)}${tt.next ? ` / ${tt.next.min}` : ''}${underTitle(w).ad !== 'Temiz' ? ` · ${esc(underTitle(w).ad)}` : ''}${w.pol.seat ? ` · ${w.pol.seat === 'muhtar' ? 'Muhtar' : w.pol.seat === 'belediye' ? 'Belediye başkanı' : 'Milletvekili'}` : ''}</span>`
      : 'Aile yasta';
    this.root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === this.tab)));
    const ts = document.getElementById('tabSehir');
    if (ts) ts.hidden = !w.city.open;
    const mt = document.getElementById('maptog');
    if (mt) {
      mt.hidden = !w.city.open;
      mt.querySelectorAll<HTMLButtonElement>('[data-map]').forEach((b) => b.setAttribute('aria-pressed', String(this.map?.mode === b.dataset.map)));
    }
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
    else if (this.tab === 'yeralti') panel.innerHTML = this.underHTML();
    else if (this.tab === 'sehir') panel.innerHTML = this.cityHTML();
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
      p.away === 'asker' ? '<span class="badge gurbet">Askerde</span>' : '',
      p.away === 'rehin' ? '<span class="badge hasta">Rehin</span>' : '',
      p.away === 'okul' ? '<span class="badge gurbet">Yatılı okulda</span>' : '',
      w.flags['haci' + p.id] ? '<span class="badge sen">Hacı</span>' : '',
      p.dip ? `<span class="badge varis">${p.dip === 'tip' ? 'Doktor' : p.dip === 'hukuk' ? 'Avukat' : p.dip === 'ogret' ? 'Öğretmen' : 'Mühendis'}</span>` : '',
      p.sick ? '<span class="badge hasta">Hasta</span>' : '',
    ].join('');
    const hp = Math.round(p.hp);
    const a = age(w, p);
    let jobCtl = '';
    if (inHouse && !p.away && a >= 7) {
      const opts = jobsFor(w, p).filter((j) => j.id !== 'yok' || p.job === 'yok');
      jobCtl = `<select data-job="${p.id}" aria-label="${esc(p.first)} ne iş yapsın">${opts.map((j) => `<option value="${j.id}"${j.id === p.job ? ' selected' : ''}>${j.ad}</option>`).join('')}</select>`;
    } else if (p.away === 'gurbet') {
      jobCtl = `<span>${w.flags['gyer' + p.id] === 'ist' ? "İstanbul'da inşaatta" : "Almanya'da işçi"}, dönüşü ${dateText(p.awayUntil ?? w.m)}</span>`;
    } else if (p.away === 'okul') {
      jobCtl = `<span>Köy Enstitüsü'nde, mezuniyet ${dateText(p.awayUntil ?? w.m)}</span>`;
    } else if (p.away === 'asker') {
      jobCtl = `<span>Askerde, dönüşü ${dateText(p.awayUntil ?? w.m)}</span>`;
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
    if (lockedOut(w, p)) return 'Kan davası yüzünden evden çıkmıyor';
    if (p.job === 'lab') return 'Atölyede; kazancı ürün satılınca gelir';
    if (p.job === 'univ') return `Üniversitede; ${Math.max(0, 48 - (w.m - Number(w.flags['okul' + p.id] || w.m)))} ay sonra mezun`;
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
        ${this.marketHTML()}
        ${this.pricesHTML()}`;
    }
    const now = sowableNow(w);
    const empty = w.hh.parcels.filter((f) => !f.crop && f.mode === 'kendi').length;
    const idle = hhMembers(w).filter((q) => !q.away && q.job === 'tarla' && age(w, q) >= 14).length;
    const short = w.hh.parcels.filter((f) => f.mode === 'kendi' && f.lastNeed > 0 && f.lastGot < f.lastNeed * 0.97).length;
    const trac = w.hh.veh.traktor || 0;
    const rows = w.hh.parcels.map((f) => {
      const i = w.plots.findIndex((x) => x.pid === f.id);
      const ws = workersOf(w, f).length;
      return `<tr data-goto="${f.id}"><td>${f.no}. ${esc(i >= 0 ? PLOTS[i].yer : '')}</td><td>${f.mode === 'yarici' ? 'Yarıcıda' : f.crop ? esc(CROPS[f.crop].ad) + (f.illegal ? ' !' : '') : 'Boş'}${f.mode === 'kendi' ? `<br><span class="note">plan: ${f.plan ? esc(CROPS[f.plan].ad.toLowerCase()) : 'yok'}</span>` : ''}</td><td>${f.crop ? '%' + Math.round(careOf(f) * 100) : '–'}</td><td>${f.mode === 'yarici' ? '–' : `${ws}${f.hired ? '+' + f.hired : ''}${f.trac ? '+T' : ''}`}</td></tr>`;
    }).join('');
    return `<div class="bulk">
        <div class="group">Bütün tarlalar</div>
        <table class="ftable"><tr><th>Parsel</th><th>Ekin</th><th>Bakım</th><th>İşçi</th></tr>${rows}</table>
        <p class="note">${w.hh.parcels.length} parsel, ${w.hh.land} dönüm. ${short ? `${short} parselde iş gücü eksik. ` : ''}${trac ? `${trac} traktör, ayda ${fmt1(trac * TRACTOR_POWER)} işçi gücü; eksik parsellere kendiliğinden gider.` : ''}</p>
        <div class="planrow"><label>Bütün tarlaların ekim planı <select data-planall="1" aria-label="Bütün tarlaların ekim planı"><option value="">Seç…</option>${(Object.keys(CROPS) as CropId[]).map((c) => `<option value="${c}">${esc(CROPS[c].ad)} (${nextSowText(c)})</option>`).join('')}<option value="-">Plan yok, elle ekeceğim</option></select></label></div>
        <p class="note">Planlı tarlalar ekim ayı gelince kendiliğinden ekilir; sen değiştirmedikçe her yıl aynı ekin. Haşhaş planı yalnızca ruhsat varsa ekilir.</p>
        <div class="btnrow">
          <button class="small${w.flags.autoStaff ? ' on' : ''}" data-toggle="autoStaff" aria-pressed="${!!w.flags.autoStaff}">İşçileri her ay kendiliğinden dağıt: ${w.flags.autoStaff ? 'açık' : 'kapalı'}</button>
          <button class="small${w.flags.ambarla ? ' on' : ''}" data-toggle="ambarla" aria-pressed="${!!w.flags.ambarla}">Tahılı satma, ambara koy: ${w.flags.ambarla ? 'açık' : 'kapalı'}</button>
        </div>
        ${empty && now.filter((c) => c !== 'hashas' || hasRuhsat(w)).length ? `<div class="btnrow">${now.map((c) => `<button class="small" data-sowall="${c}">Boş ${empty} parsele ${esc(CROPS[c].ad.toLowerCase())} ek</button>`).join('')}</div>` : ''}
        <div class="btnrow">
          <button class="small" data-bulk="staff"${idle ? '' : ' disabled'}>Gündelikçileri tarlalara dağıt (${idle})</button>
          <button class="small" data-bulk="hire1">Her parsele 1 ırgat</button>
          <button class="small" data-bulk="hire0">Irgatları gönder</button>
          <button class="small" data-bulk="recall">Herkesi geri çağır</button>
        </div>
      </div>
      ${this.pricesHTML()}
      ${w.hh.parcels.map((f) => this.parcelHTML(f, now)).join('')}
      ${this.marketHTML()}
      <p class="note">Ekim ayları: buğday, arpa ve haşhaş Ekim–Kasım; nohut Mart–Nisan; şeker pancarı Nisan. Ruhsat her yıl Ağustos'ta alınır. Haritada bir tarlaya dokunursan sahibini ve fiyatını görürsün.</p>`;
  }

  private pricesHTML(): string {
    const w = this.w!;
    const ks: MkId[] = ['bugday', 'arpa', 'nohut', 'pancar', 'hayvan'];
    const sh = shockOf(year(w.m));
    const arrow = (k: MkId) => (trend(w, k) > 0 ? '▲' : trend(w, k) < 0 ? '▼' : '•');
    const used = ambarUsed(w);
    const amb = STORABLE.filter((c) => (w.hh.ambar?.[c] || 0) > 0);
    return `<div class="group">${year(w.m)} piyasası</div>
      ${sh ? `<p class="note warnline">${esc(sh.ad)}.</p>` : ''}
      <table class="ftable prices">${ks.map((k) => `<tr><td>${esc(MK_AD[k])}</td><td class="${mk(w, k) >= 1.1 ? 'pos' : mk(w, k) <= 0.9 ? 'neg' : ''}">%${Math.round(mk(w, k) * 100)} ${arrow(k)}</td></tr>`).join('')}</table>
      <p class="note">Normal fiyata göre. Fiyatlar her Ocak değişir: kurak yılın ardından tahıl pahalanır, hayvan ucuzlar.</p>
      ${w.hh.parcels.length || amb.length ? `<div class="group">Ambar: %${Math.round((used / ambarCap(w)) * 100)} dolu</div>
      ${amb.length ? amb.map((c) => `<div class="prow"><span class="pname">${esc(CROPS[c].ad)}</span><span class="prel">bugün ${lira(ambarValue(w, c))}</span><button class="small" data-sellamb="${c}">Sat</button><button class="small" data-sellamb="${c}:h">Yarısını sat</button></div>`).join('') : '<p class="note">Ambar boş. "Ambara koy" açıkken buğday, arpa ve nohut hasadı satılmaz, burada bekler; ayda %0,7 fireyle. Samanlık ve taş ev ambarı büyütür.</p>'}` : ''}`;
  }

  private marketHTML(): string {
    const w = this.w!;
    const n = nam(w);
    const list = w.plots.map((_, i) => i).filter((i) => w.plots[i].o !== 'biz' && offerChance(w, i, n) > 0).sort((a, b) => offerPrice(w, a) - offerPrice(w, b)).slice(0, 6);
    if (!list.length) return '';
    return `<div class="group">Köyde alınabilecek tarlalar</div>
      <table class="ftable">${list.map((i) => `<tr data-plot="${i}"><td>${esc(PLOTS[i].yer)}<br><span class="note">${esc(plotOwnerName(w, i))}</span></td><td>Verim ${Math.round(PLOTS[i].q * 100)}</td><td>${lira(offerPrice(w, i))}${w.plots[i].sale ? '' : '<br><span class="note">teklif</span>'}</td></tr>`).join('')}</table>`;
  }

  private floorHTML(): string {
    const w = this.w!;
    const slots = SLOTS[w.hh.house];
    const built = (Object.keys(ROOMS) as RoomId[]).flatMap((r) => Array.from({ length: w.hh.rooms[r] || 0 }, () => r));
    const cells: string[] = [`<div class="room core"><b>${w.hh.house === 0 ? 'Tek göz oda' : 'Ana ev'}</b><span>${BASE_CAP[w.hh.house]} kişi</span></div>`];
    for (const r of built) cells.push(`<div class="room built r-${r}"><b>${esc(ROOMS[r].ad)}</b><span>${r === 'oda' ? '+3 kişi' : ''}</span></div>`);
    const free = Math.max(0, slots - built.length);
    for (let i = 0; i < free; i++) cells.push(`<div class="room empty"><b>Boş yer</b><span>Oda yapılabilir</span></div>`);
    const opts = (Object.keys(ROOMS) as RoomId[]).map((r) => {
      const why = canBuild(w, r);
      return `<div class="asset"><div class="prow"><span class="pname">${esc(ROOMS[r].ad)}</span>${w.hh.rooms[r] ? `<span class="badge sen">${w.hh.rooms[r]}</span>` : ''}</div><p class="note">${esc(ROOMS[r].desc)}</p>
        ${why ? `<p class="note">${esc(why)}</p>` : `<button class="small" data-room="${r}"${w.hh.cash < roomPrice(w, r) ? ' disabled' : ''}>Yap (${lira(roomPrice(w, r))})</button>`}</div>`;
    }).join('');
    return `<div class="floor">${cells.join('')}</div>${w.hh.house === 0 ? '<p class="note">Kira evine oda eklenmez. Kendi evin olunca odalar, ahır, samanlık ve gizli bodrum yapılabilir.</p>' : `<details><summary class="group">Oda yap (${built.length}/${slots} yer dolu)</summary>${opts}</details>`}`;
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
      <div class="group">Ev: ${residents(w)} kişi, ${capacity(w)} kişilik${crowded(w) ? ' (kalabalık!)' : ''}</div>
      ${this.floorHTML()}
      <div class="asset"><div class="prow"><span class="pname">${esc(hv.ad)}</span></div><p class="note">${esc(hv.desc)}</p>
        ${nh ? `<p class="note">Sıradaki: ${esc(nh.ad)}. ${esc(nh.desc)}</p><button class="small" data-house="1"${w.hh.cash < housePrice(w, nh.lvl) ? ' disabled' : ''}>${w.hh.house === 0 ? 'Satın al' : 'Yaptır'} (${lira(housePrice(w, nh.lvl))})</button>` : ''}</div>
      <div class="group">Taşıtlar</div>${veh}
      <div class="group">Teknoloji: ${esc(eraOf(w).ad)}</div>
      <p class="note">${esc(eraOf(w).desc)}</p>
      ${this.techHTML()}
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
      const next = f.plan ? `${nextSowText(f.plan)} (${CROPS[f.plan].ad.toLowerCase()}, kendiliğinden)` : monthsUntilSow(w.m);
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
      <div class="planrow"><label>Ekim planı <select data-plan="${f.id}" aria-label="${f.no}. parselin ekim planı">${(Object.keys(CROPS) as CropId[]).map((c) => `<option value="${c}"${f.plan === c ? ' selected' : ''}>${esc(CROPS[c].ad)} (${nextSowText(c)})</option>`).join('')}<option value="-"${!f.plan ? ' selected' : ''}>Plan yok</option></select></label></div>
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
        <tr><td>Ev kirası</td><td>${w.hh.house ? 'Yok, ev bizim' : lira(Math.min(w.hh.rent, RENT_CAP) * infl(w.m))}</td></tr>
        <tr><td>Haşhaş ruhsatı</td><td>${hasRuhsat(w) ? year(w.m) + ' için var' : isBanYear(year(w.m)) ? 'Yasak' : 'Yok'}</td></tr>
      </table>
      ${w.hh.debt > 0 ? `<div class="group">Borç öde</div><div class="btnrow">
        <button class="small" data-pay="100"${w.hh.cash < 1 ? ' disabled' : ''}>100 lira</button>
        <button class="small" data-pay="1000"${w.hh.cash < 1 ? ' disabled' : ''}>1.000 lira</button>
        <button class="small" data-pay="all"${w.hh.cash < 1 ? ' disabled' : ''}>Ödeyebildiğim kadar</button></div>
        <p class="note">Borç kapanmadan kimse sana toprak satmaz. 3.000 lirayı aşarsa hanede yokluk başlar.</p>` : ''}
      <p class="note">Zula, atölye ve kan davası Yeraltı sekmesinde.</p>`;
  }

  private techHTML(): string {
    const w = this.w!;
    const y = year(w.m);
    return (Object.keys(TECHS) as TechId[]).filter((t) => TECHS[t].from <= y + 6).map((t) => {
      const d = TECHS[t];
      const got = !!w.tech[t];
      const soon = y < d.from;
      return `<div class="asset tech${got ? ' got' : ''}"><div class="prow"><span class="pname">${esc(d.ad)}</span><span class="prel">${d.from}</span>${got ? '<span class="badge sen">Var</span>' : ''}</div><p class="note">${esc(d.desc)}</p>
        ${got ? '' : soon ? `<p class="note">${d.from}'de gelecek.</p>` : d.auto ? '' : `<button class="small" data-tech="${t}"${w.hh.cash < techPrice(w, t) ? ' disabled' : ''}>Al (${lira(techPrice(w, t))})</button>`}</div>`;
    }).join('');
  }

  private distHTML(): string {
    const w = this.w!;
    return w.city.dist.map((d) => {
      const dd = DISTS[d.id];
      const open = year(w.m) >= dd.from;
      const owner = d.o === 'biz' ? 'Bizim' : d.o === 'cete' ? (w.crew && !w.crew.gone ? w.crew.name : 'Liman çetesi') : 'Kimsenin değil';
      const invs = (Object.keys(INVS) as DInv[]).map((i) => `<button class="small" data-inv="${d.id}:${i}"${w.hh.cash < invPrice(w, i) ? ' disabled' : ''}>${esc(INVS[i].ad)}${d.inv[i] ? ` (${d.inv[i]})` : ''}, ${lira(invPrice(w, i))}</button>`).join('');
      return `<div class="asset dist ${d.o}"><div class="prow"><span class="pname">${esc(dd.ad)}</span><span class="badge ${d.o === 'biz' ? 'sen' : d.o === 'cete' ? 'hasta' : 'gurbet'}">${esc(owner)}</span></div>
        <p class="note">${esc(dd.desc)}${open ? '' : ` ${dd.from}'de kurulacak.`}</p>
        ${open ? `<div class="bars"><span>Esnaf <i style="width:${Math.round(d.loy)}%"></i></span><span>Polis <i class="pol" style="width:${Math.round(d.pol)}%"></i></span></div>` : ''}
        ${d.o === 'biz' ? `<p class="note">Aylık getiri ${lira(distIncome(w, d))}.</p><details><summary class="note">Yatırım yap</summary><div class="btnrow">${invs}</div></details>` : open ? `<button class="small danger" data-dist="${d.id}"${w.city.moved ? '' : ' disabled'}>Mahalleyi al (${menNeeded(w, d)} adam gerekir)</button>` : ''}</div>`;
    }).join('');
  }

  // ---------- Şehir ----------
  private cityHTML(): string {
    const w = this.w!;
    if (!w.city.open) return `<p class="note">${CITY} henüz kapılarını açmadı. Kasanla kara kasan birlikte büyük bir servete ulaşınca ya da on iki tarlaya sahip olunca şehir seni tanır.</p>`;
    const nh = HOMES[w.city.home + 1];
    const cand = hhMembers(w).filter((q) => !q.away && age(w, q) >= 18);
    const facs = (Object.keys(FACS) as FacId[]).map((f) => {
      const d = FACS[f];
      const st = w.city.facs[f];
      return `<div class="asset"><div class="prow"><span class="pname">${esc(d.ad)}</span>${st ? '<span class="badge sen">Bizim</span>' : ''}</div><p class="note">${esc(d.desc)}</p>
        ${st ? `<p class="note">Bu ay kazancı ${lira(facIncome(w, f))}.</p><select data-facmgr="${f}" aria-label="${esc(d.ad)} müdürü"><option value="">Müdür yok (kazanç düşük)</option>${cand.map((q) => `<option value="${q.id}"${st.mgr === q.id ? ' selected' : ''}>${esc(q.first)}, ticaret ${Math.round(q.sk.ticaret)}</option>`).join('')}</select>`
        : `<button class="small" data-fac="${f}"${w.hh.cash < facPrice(w, f) ? ' disabled' : ''}>Satın al (${lira(facPrice(w, f))})</button>`}</div>`;
    }).join('');
    return `<div class="rank"><div class="pname">${CITY}</div><p class="note">Fabrikalar temiz parayla alınır; kara parayı da aklarlar. Şehre taşınırsan köydeki tarlalar yarıcıya geçer, hayat pahalanır ama mahalle tutup haraç toplayabilirsin.</p></div>
      <div class="group">Ev</div>
      <p class="note">${w.city.home ? `${esc(HOMES[w.city.home].ad)} senin. ${w.city.moved ? 'Aile şehirde yaşıyor.' : 'Aile hâlâ köyde.'}` : 'Şehirde evin yok.'}</p>
      <div class="btnrow">${nh ? `<button class="small" data-chome="1"${w.hh.cash < homePrice(w, nh.lvl) ? ' disabled' : ''}>${esc(nh.ad)} al (${lira(homePrice(w, nh.lvl))})</button>` : ''}
        ${w.city.home ? `<button class="small" data-move="${w.city.moved ? 0 : 1}">${w.city.moved ? 'Köye geri dön' : 'Şehre taşın'}</button>` : ''}</div>
      <div class="group">Fabrikalar ve şirketler</div>${facs}
      <div class="group">Mahalleler: ${w.city.turf} / ${w.city.dist.length}</div>
      <p class="note">Mahallelerden gelen haraç ve kazanç kara kasaya girer. Esnafın bağlılığı düşerse isyan çıkar; polis varlığı arttıkça hem almak hem tutmak zorlaşır. Yatırımlar kazancı ve aklama kapasitesini büyütür.</p>
      ${this.distHTML()}`;
  }

  // ---------- Yeraltı ----------
  private underHTML(): string {
    const w = this.w!;
    const heatPct = Math.round(w.heat);
    const r = w.rival;
    const lab = w.lab;
    const lk = unlocked(w);
    const sitesHtml = (Object.keys(SITES) as LabSite[]).map((st) => {
      const ok = siteOk(w, st);
      return `<button class="sow${ok ? '' : ' off'}" data-lab="${st}"${ok ? '' : ' disabled'}><b>${esc(SITES[st].ad)}</b><span>${ok ? `Dikkat ×${SITES[st].heat}, baskında bulunma %${Math.round(SITES[st].find * 100)}` : esc(SITES[st].need)}</span></button>`;
    }).join('');
    const nextL = LAB_LEVELS[(lab?.lvl || 0) + 1];
    const workers = labWorkers(w);
    const pool = hhMembers(w).filter((q) => !q.away && age(w, q) >= 16 && q.job !== 'lab');
    const labHtml = lk && !lab
      ? `<p class="note">${esc(lk)}</p>`
      : `${lab ? `<div class="asset"><div class="prow"><span class="pname">${esc(LAB_LEVELS[lab.lvl].ad)}</span><span class="prel">${esc(SITES[lab.site].ad)}</span></div>
          <table class="ledger">
            <tr><td>Bekleyen ham mal</td><td>${lab.raw} çuval</td></tr>
            <tr><td>Aylık kapasite</td><td>${labCapacity(w)} çuval</td></tr>
            <tr><td>Hazır ürün</td><td>${lab.prod} paket${lab.hap ? `, ${lab.hap} koli hap` : ''}</td></tr>
            <tr><td>Son partinin kalitesi</td><td>%${Math.round(lab.q * 100)}</td></tr>
            <tr><td>Ustalık</td><td>${Math.round(labSkill(w))}</td></tr>
          </table>
          <div class="group">Atölyede çalışanlar</div>
          <div class="chips">${workers.map((q) => `<span class="chip">${esc(q.first)}, zanaat ${Math.round(q.sk.zanaat)} <button class="x" data-labout="${q.id}">Çıkar</button></span>`).join('') || '<span class="note">Aileden kimse yok.</span>'}
          ${lab.chem ? `<span class="chip">Kimyager Cevdet <button class="x" data-cevdet="0">Kov</button></span>` : ''}</div>
          <div class="btnrow">${pool.length ? `<select data-labin="1" aria-label="Atölyeye aileden birini al"><option value="">Aileden birini al…</option>${pool.map((q) => `<option value="${q.id}">${esc(q.first)}, ${age(w, q)}, zanaat ${Math.round(q.sk.zanaat)}</option>`).join('')}</select>` : ''}
            ${!lab.chem ? `<button class="small" data-cevdet="1">Cevdet'i tut (ayda ${lira(cevdetPay(w))})</button>` : ''}</div>
          <div class="btnrow">
            ${w.hh.stash ? `<button class="small" data-labact="stash">Zuladaki ${w.hh.stash} çuvalı atölyeye taşı</button>` : ''}
            <button class="small" data-labact="buy3"${w.hh.cash < hamPrice(w) * 3 ? ' disabled' : ''}>Rıza'dan 3 çuval ham mal al (${lira(hamPrice(w) * 3)})</button>
            ${lab.prod + lab.hap ? `<button class="small danger" data-labact="sell">Ürünü Rıza'ya teslim et (~${lira((lab.prod * paketPrice(w) + lab.hap * hapPrice(w)) * (0.7 + lab.q * 0.6))})</button>` : ''}
          </div>
          <p class="note">Paket ${lira(paketPrice(w))}, hap kolisi ${lira(hapPrice(w))} civarı; kalite fiyatı oynatır. Ustalık düşükse kaza riski artar.</p></div>` : ''}
        ${nextL ? `<div class="group">${lab ? 'Büyüt: ' : 'Kur: '}${esc(nextL.ad)} (${lira(labPrice(w, nextL.lvl))}${year(w.m) < nextL.from ? `, ${nextL.from}'den sonra` : ''})</div><p class="note">${esc(nextL.desc)}</p><div class="sowgrid">${sitesHtml}</div>` : ''}
        ${!w.hh.agil ? `<div class="btnrow"><button class="small" data-agil="1">Dağdaki ağılı satın al (${lira(AGIL_PRICE * infl(w.m))})</button></div>` : ''}`;
    return `<div class="group">Jandarmanın dikkati</div>
      <div class="labor"><span>${esc(heatLabel(w.heat))}</span><div class="meter heat"><i style="width:${heatPct}%"></i></div></div>
      <div class="group">Zula ve Kara Rıza</div>
      <p class="note">${w.hh.stash > 0 ? `Zulada ${w.hh.stash} çuval mal var${w.hh.rooms.samanlik ? ', samanlığın çift dibinde' : '; durdukça dikkat çeker'}.` : 'Zula boş.'}
        ${w.flags.kacakci ? ` Kara Rıza çuvalı ${lira(kacakPrice(w))} liradan alıyor.` : ' Kayıt dışı bir alıcı tanımıyorsun.'}</p>
      ${w.hh.stash > 0 && w.flags.kacakci ? `<div class="btnrow"><button class="small danger" data-stash="sell">Zulayı Kara Rıza'ya sat (${lira(w.hh.stash * kacakPrice(w))})</button></div>` : ''}
      ${(w.flags.kacakToplam as number) ? `<p class="note">Bugüne kadar kayıt dışına çıkan: ${w.flags.kacakToplam} çuval.${w.flags.labKazanc ? ` Atölyeden kazanılan: ${lira(Number(w.flags.labKazanc))}.` : ''}</p>` : ''}
      <div class="group">Gizli atölye</div>
      ${labHtml}
      <div class="group">Kara kasa ve adamlar</div>
      <table class="ledger">
        <tr><td>Kara kasa</td><td>${lira(w.dirty)}</td></tr>
        <tr><td>Aylık aklama kapasitesi</td><td>${lira(launderCap(w))}</td></tr>
        <tr><td>Aklama komisyonu</td><td>%${Math.round(launderFee(w) * 100)}</td></tr>
        <tr><td>Bugüne kadar aklanan</td><td>${lira(w.city.laundered)}</td></tr>
        <tr><td>Maaşlı adamlar</td><td>${w.gang} kişi, ayda ${lira(w.gang * gangPay(w))}</td></tr>
      </table>
      <p class="note">Kaçak satış ve atölyenin parası kara kasaya girer. Atölye, rüşvet, adam maaşı kara parayla ödenir; toprak, ev, fabrika için para önce bakkal, kahvehane, değirmen ve şehirdeki işletmelerden aklanmalı.</p>
      <div class="btnrow"><button class="small" data-gang="1">Adam tut (ayda ${lira(gangPay(w))})</button><button class="small" data-gang="-1"${w.gang ? '' : ' disabled'}>Bir adamı gönder</button></div>
      <div class="group">Yeraltı unvanı: ${esc(underTitle(w).ad)}</div>
      <p class="note">${esc(underTitle(w).next)}${w.city.net ? ' Kara Rıza\'nın şebekesi senin: kaçak fiyatlar %60 yüksek.' : w.flags.rizaOrtak ? ' Rıza ile ortaksın: fiyatlar %25 yüksek.' : ''}</p>
      <div class="group">${r.gone ? 'Köyde rakip aile yok' : esc(rP(w))}</div>
      ${r.gone ? `<p class="note">${esc(String(w.flags.yokEdilen || ''))} köyden silindi. Boşluk uzun sürmez; yeni bir aile gelecek.</p>` : `
      <div class="labor"><span>${esc(feudLabel(r.feud))}</span><div class="meter heat"><i style="width:${Math.round(r.feud)}%"></i></div></div>
      <p class="note">Silah tutacak ${r.men} erkekleri var. Toprakları: ${w.plots.filter((x) => x.o === 'rakip').length} tarla. ${r.dead || r.theirDead ? `Kan davasında bizden ${r.dead}, onlardan ${r.theirDead} kişi öldü.` : 'Henüz kan dökülmedi.'} ${r.blood < 0 ? 'Onların kanı bizde.' : r.blood > 0 ? 'Bizim kanımız onlarda.' : ''}</p>
      <div class="btnrow"><button class="small${r.lock ? ' danger' : ''}" data-lock="${r.lock ? 0 : 1}">${r.lock ? 'Erkekler yeniden dışarı çıksın' : 'Erkekler evden çıkmasın'}</button>
        <button class="small danger" data-attack="1"${w.gang >= 2 ? '' : ' disabled'}>Adamlarını gönder (${w.gang} adam)</button></div>
      <p class="note">Evden çıkmayan erkekler pusuya düşmez ama çalışamaz da. Korumalar pusuyu zorlaştırır. Baskın için en az iki adam gerekir; başarı adam sayısına bağlı, başarısız olursa adam kaybedersin. Erkekleri tükenen aile köyü terk eder.</p>`}
      ${w.crew && !w.crew.gone ? `<div class="group">${esc(w.crew.name)}</div><div class="labor"><span>Husumet</span><div class="meter heat"><i style="width:${Math.round(w.crew.feud)}%"></i></div></div><p class="note">${CITY}'te ${w.crew.men} silahlı adamları ve ${w.crew.turf} mahalleleri var.</p>` : ''}`;
  }

  // ---------- Kronik ----------
  private chronicleHTML(): string {
    const w = this.w!;
    const items = w.chronicle.slice(-250).reverse();
    const done = doneGoals(w);
    const groups = [...new Set(GOALS.map((g) => g.grup))];
    return `<details class="goals"><summary class="group">Hanedan hedefleri: ${done.length} / ${GOALS.length}, ${Number(w.flags.puan || 0)} puan</summary>
      ${groups.map((gr) => `<div class="ggrp"><b>${esc(gr)}</b>${GOALS.filter((g) => g.grup === gr).map((g) => `<span class="goal${w.flags['goal_' + g.id] ? ' ok' : ''}">${esc(g.ad)}<i>${g.pts}</i></span>`).join('')}</div>`).join('')}
      </details>
      <ul class="chron">${items.map((e) => `<li class="${e.k}"><time>${dateText(e.m)}</time>${esc(e.t)}</li>`).join('')}</ul>`;
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
    panel.querySelectorAll<HTMLSelectElement>('[data-plan]').forEach((s) => (s.onchange = act(() => {
      setPlan(w, s.dataset.plan!, s.value === '-' ? null : (s.value as CropId));
    })));
    panel.querySelectorAll<HTMLSelectElement>('[data-planall]').forEach((s) => (s.onchange = act(() => {
      if (!s.value) return;
      setPlanAll(w, s.value === '-' ? null : (s.value as CropId));
      this.toast(s.value === '-' ? 'Planlar kaldırıldı.' : `Bütün tarlalar: ${CROPS[s.value as CropId].ad.toLowerCase()}.`);
    })));
    panel.querySelectorAll<HTMLButtonElement>('[data-toggle]').forEach((b) => (b.onclick = act(() => {
      const k = b.dataset.toggle!;
      w.flags[k] = !w.flags[k];
    })));
    panel.querySelectorAll<HTMLButtonElement>('[data-sellamb]').forEach((b) => (b.onclick = act(() => {
      const [c, h] = b.dataset.sellamb!.split(':');
      const v = sellAmbar(w, c as CropId, h ? 0.5 : 1);
      this.toast(`${lira(v)} kasaya girdi.`);
    })));
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
    panel.querySelectorAll<HTMLButtonElement>('[data-room]').forEach((b) => (b.onclick = act(() => this.toast(buildRoom(w, b.dataset.room as RoomId).msg))));
    panel.querySelectorAll<HTMLButtonElement>('[data-lab]').forEach((b) => (b.onclick = act(() => this.toast(buildLab(w, b.dataset.lab as LabSite).msg))));
    panel.querySelectorAll<HTMLButtonElement>('[data-agil]').forEach((b) => (b.onclick = act(() => this.toast(buyAgil(w).msg))));
    panel.querySelectorAll<HTMLButtonElement>('[data-cevdet]').forEach((b) => (b.onclick = act(() => hireCevdet(w, b.dataset.cevdet === '1'))));
    panel.querySelectorAll<HTMLButtonElement>('[data-labout]').forEach((b) => (b.onclick = act(() => setJob(w, b.dataset.labout!, 'tarla'))));
    panel.querySelectorAll<HTMLSelectElement>('[data-labin]').forEach((sel) => {
      sel.onchange = act(() => {
        if (sel.value) setJob(w, sel.value, 'lab');
      });
    });
    panel.querySelectorAll<HTMLButtonElement>('[data-labact]').forEach((b) => (b.onclick = act(() => {
      const a = b.dataset.labact;
      if (a === 'stash') this.toast(`${moveStash(w)} çuval atölyeye taşındı.`);
      if (a === 'buy3') this.toast(buyRaw(w, 3).msg);
      if (a === 'sell') this.toast(`Teslim edildi: ${lira(sellProduct(w))}`);
    })));
    panel.querySelectorAll<HTMLButtonElement>('[data-gang]').forEach((b) => (b.onclick = act(() => this.toast(hire(w, Number(b.dataset.gang)).msg))));
    panel.querySelectorAll<HTMLButtonElement>('[data-attack]').forEach((b) => (b.onclick = act(() => this.toast(attackRival(w).msg))));
    panel.querySelectorAll<HTMLButtonElement>('[data-fac]').forEach((b) => (b.onclick = act(() => this.toast(buyFac(w, b.dataset.fac as FacId).msg))));
    panel.querySelectorAll<HTMLSelectElement>('[data-facmgr]').forEach((sel) => {
      sel.onchange = act(() => setFacMgr(w, sel.dataset.facmgr as FacId, sel.value || null));
    });
    panel.querySelectorAll<HTMLButtonElement>('[data-chome]').forEach((b) => (b.onclick = act(() => this.toast(buyCityHome(w).msg))));
    panel.querySelectorAll<HTMLButtonElement>('[data-move]').forEach((b) => (b.onclick = act(() => {
      this.toast(moveToCity(w, b.dataset.move === '1').msg);
      if (this.map) this.map.mode = w.city.moved ? 'sehir' : 'koy';
    })));
    panel.querySelectorAll<HTMLButtonElement>('[data-tech]').forEach((b) => (b.onclick = act(() => this.toast(buyTech(w, b.dataset.tech as TechId).msg))));
    panel.querySelectorAll<HTMLButtonElement>('[data-dist]').forEach((b) => (b.onclick = act(() => this.toast(takeDistrict(w, b.dataset.dist as DistId).msg))));
    panel.querySelectorAll<HTMLButtonElement>('[data-inv]').forEach((b) => (b.onclick = act(() => {
      const [d, i] = b.dataset.inv!.split(':');
      this.toast(invest(w, d as DistId, i as DInv).msg);
    })));
    panel.querySelectorAll<HTMLButtonElement>('[data-turf]').forEach((b) => (b.onclick = act(() => this.toast(takeTurf(w).msg))));
    panel.querySelectorAll<HTMLButtonElement>('[data-lock]').forEach((b) => (b.onclick = act(() => setLock(w, b.dataset.lock === '1'))));
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
    } else if (pk.kind === 'fac') {
      const f = pk.f;
      const d = FACS[f];
      const own = !!w.city.facs[f];
      body = `<h3>${esc(d.ad)}${own ? ', bizim' : ''}</h3><p>${esc(d.desc)}</p>
        <p>${own ? `Bu ay kazancı ${lira(facIncome(w, f))}. Ayda ${lira(d.launder * infl(w.m))} kara parayı aklayabilir.` : `Fiyatı ${lira(facPrice(w, f))}. Kara para tapuya geçmez; temiz parayla alınır.`}</p>
        <div class="btnrow">${own ? '' : `<button class="primary sm" data-sheet="fac:${f}"${w.city.open && w.hh.cash >= facPrice(w, f) ? '' : ' disabled'}>Satın al</button>`}<button class="small" data-sheet="tab:sehir">Şehir sekmesi</button></div>`;
    } else if (pk.kind === 'cityhome') {
      body = `<h3>${w.city.home ? esc(HOMES[w.city.home].ad) : 'Şehirde ev'}</h3>
        <p>${w.city.home ? (w.city.moved ? 'Aile burada yaşıyor.' : 'Ev hazır; aile hâlâ köyde.') : `${esc(CITY)}'te henüz evin yok.`}</p>
        <div class="btnrow"><button class="small" data-sheet="tab:sehir">Şehir sekmesi</button></div>`;
    } else {
      const k = pk.k;
      if (k === 'evOyuncu') {
        const hv = HOUSES[w.hh.house];
        const nh = HOUSES[w.hh.house + 1];
        body = `<h3>${esc(hv.ad)}</h3><p>${esc(hv.desc)}</p>
          ${nh ? `<p>Sıradaki: <b>${esc(nh.ad)}</b>. ${esc(nh.desc)}</p><div class="btnrow"><button class="primary sm" data-sheet="house"${w.hh.cash < housePrice(w, nh.lvl) ? ' disabled' : ''}>${w.hh.house === 0 ? 'Satın al' : 'Yaptır'} (${lira(housePrice(w, nh.lvl))})</button><button class="small" data-sheet="tab:mulk">Bütün mülk</button></div>` : ''}`;
      } else if (k === 'agil') {
        body = `<h3>Dağdaki ağıl</h3><p>Köyden görünmeyen, yıkık bir taş ağıl. ${w.hh.agil ? 'Artık senin.' : 'Sahibi gurbette; ucuza satar.'} ${w.lab?.site === 'agil' ? `İçinde ${esc(LAB_LEVELS[w.lab.lvl].ad.toLowerCase())} çalışıyor.` : 'Gizli bir atölye için köydeki en güvenli yer.'}</p>
          <div class="btnrow">${!w.hh.agil ? `<button class="primary sm" data-sheet="agil">Satın al (${lira(AGIL_PRICE * infl(w.m))})</button>` : ''}<button class="small" data-sheet="tab:yeralti">Yeraltı sekmesi</button></div>`;
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
    } else if (cmd === 'fac') {
      this.toast(buyFac(w, arg as FacId).msg);
    } else if (cmd === 'agil') {
      this.toast(buyAgil(w).msg);
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
      <div class="head">${KIND[c.id] ?? (c.id.startsWith('hi:') ? 'Tarih' : c.id.startsWith('ev:') ? 'Köyden' : 'Haber')}, ${dateText(c.m)}</div>
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
      <p class="lede">${esc(w.over?.reason ?? '')} ${esc(w.surname)} ailesi ${year(w.m) - (w.y0 || 1965)} yıl boyunca ${w.flags.nesil ?? 1} nesil sürdü${first ? `, ilk adım ${esc(first.first)} ile atıldı` : ''}.</p>
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
