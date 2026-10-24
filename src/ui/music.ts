// Oyunun içinde üretilen müzik: bağlamayı andıran tel sesi, altta uzun bir dem ve hafif darbuka.
// Telif yok; her nota WebAudio ile anlık üretilir. Ruh haline göre makam ve tempo değişir.
// Hiçbir dış dosya yüklenmez; ses kapalıyken hiç çalmaz.

type Mood = 'koy' | 'gergin' | 'sehir' | 'yas';

// Makam dizileri (Hz cinsinden değil; A'ya göre yarım ton adımları). Dem notası 0.
const SCALES: Record<Mood, number[]> = {
  koy: [0, 2, 3, 5, 7, 8, 10, 12], // uşşak benzeri, dingin
  gergin: [0, 1, 4, 5, 7, 8, 11, 12], // hicaz benzeri, gergin
  sehir: [0, 2, 3, 5, 7, 9, 10, 12], // kürdi benzeri, ağır
  yas: [0, 2, 3, 5, 6, 8, 10, 12], // hüzünlü
};

const BASE: Record<Mood, number> = { koy: 146.83, gergin: 138.59, sehir: 110, yas: 130.81 };
const TEMPO: Record<Mood, number> = { koy: 0.52, gergin: 0.34, sehir: 0.6, yas: 0.78 };

export class Muzik {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer = 0;
  private drone: { osc: OscillatorNode; g: GainNode }[] = [];
  private mood: Mood = 'koy';
  private on = false;
  private step = 0;
  private vol = 0.5;

  get playing() {
    return this.on;
  }

  toggle(): boolean {
    if (this.on) this.stop();
    else this.start();
    return this.on;
  }

  setVolume(v: number) {
    this.vol = Math.max(0, Math.min(1, v));
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.vol * 0.5, this.ctx.currentTime, 0.1);
  }

  setMood(m: Mood) {
    if (m === this.mood) return;
    this.mood = m;
    if (this.on) this.retuneDrone();
  }

  private start() {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.vol * 0.5;
      const rev = this.makeReverb();
      this.master.connect(rev);
      rev.connect(this.ctx.destination);
      this.master.connect(this.ctx.destination);
      this.on = true;
      this.startDrone();
      this.loop();
    } catch {
      this.on = false;
    }
  }

  private stop() {
    this.on = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = 0;
    for (const d of this.drone) {
      try {
        d.g.gain.setTargetAtTime(0, this.ctx!.currentTime, 0.3);
        d.osc.stop(this.ctx!.currentTime + 0.6);
      } catch { /* yok say */ }
    }
    this.drone = [];
    if (this.ctx) {
      const c = this.ctx;
      setTimeout(() => c.close().catch(() => {}), 800);
    }
    this.ctx = null;
    this.master = null;
  }

  private makeReverb(): ConvolverNode {
    const ctx = this.ctx!;
    const rev = ctx.createConvolver();
    const len = ctx.sampleRate * 1.6;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
    }
    rev.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = 0.25;
    rev.connect(g);
    return rev;
  }

  private startDrone() {
    const ctx = this.ctx!;
    const base = BASE[this.mood];
    for (const mult of [0.5, 1, 1.5]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = base * mult;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.setTargetAtTime(0.05, ctx.currentTime, 1.2);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 420;
      osc.connect(lp);
      lp.connect(g);
      g.connect(this.master!);
      osc.start();
      this.drone.push({ osc, g });
    }
  }

  private retuneDrone() {
    if (!this.ctx) return;
    const base = BASE[this.mood];
    const mults = [0.5, 1, 1.5];
    this.drone.forEach((d, i) => d.osc.frequency.setTargetAtTime(base * mults[i], this.ctx!.currentTime, 0.8));
  }

  // Bağlama benzeri çekilmiş tel: kısa, parlak, hızla sönen
  private pluck(freq: number, t: number, vel = 1) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.value = freq * 2.01;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18 * vel, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    const g2 = ctx.createGain();
    g2.gain.value = 0.3;
    const bp = ctx.createBiquadFilter();
    bp.type = 'lowpass';
    bp.frequency.setValueAtTime(3200, t);
    bp.frequency.exponentialRampToValueAtTime(700, t + 0.5);
    osc.connect(g);
    osc2.connect(g2);
    g2.connect(g);
    g.connect(bp);
    bp.connect(this.master!);
    osc.start(t);
    osc2.start(t);
    osc.stop(t + 0.95);
    osc2.stop(t + 0.95);
  }

  // Darbuka benzeri vuruş
  private hit(t: number, deep: boolean) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(deep ? 180 : 320, t);
    osc.frequency.exponentialRampToValueAtTime(deep ? 55 : 160, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(g);
    g.connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.2);
    if (!deep) {
      const n = ctx.createBufferSource();
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
      n.buffer = buf;
      const ng = ctx.createGain();
      ng.gain.value = 0.08;
      n.connect(ng);
      ng.connect(this.master!);
      n.start(t);
    }
  }

  private noteFreq(deg: number, oct = 0): number {
    const scale = SCALES[this.mood];
    const base = BASE[this.mood] * 2;
    const idx = ((deg % scale.length) + scale.length) % scale.length;
    const semis = scale[idx] + 12 * (oct + Math.floor(deg / scale.length));
    return base * Math.pow(2, semis / 12);
  }

  private loop() {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime + 0.05;
    const dt = TEMPO[this.mood];
    const s = this.step++;
    // Ezgi: makamda gezinen bir melodi çizgisi
    if (s % 1 === 0) {
      const contour = [0, 2, 1, 3, 2, 4, 3, 1, 0, 2, 4, 5, 4, 2, 1, 0];
      const deg = contour[s % contour.length] + (Math.random() < 0.2 ? 1 : 0);
      this.pluck(this.noteFreq(deg, Math.random() < 0.3 ? 1 : 0), t, 0.7 + Math.random() * 0.3);
      if (Math.random() < 0.4) this.pluck(this.noteFreq(deg + 2), t + dt * 0.5, 0.4);
    }
    // Ritim
    this.hit(t, s % 4 === 0);
    if (this.mood !== 'yas' && s % 4 === 2) this.hit(t + dt * 0.5, false);
    this.timer = window.setTimeout(() => this.loop(), dt * 1000);
  }
}
