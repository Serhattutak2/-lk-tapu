// Endgame testi: Konsey aileleri ve Büyük Baba tahtı (devirme + savunma).
import { describe, expect, it } from 'vitest';
import { newWorld } from '../src/core/world';
import { ensureFams, isBaba, tahtHamle, canChallenge, monthlyAile, babaFam, aliveFams, aileGift, ailePress } from '../src/core/aile';
import type { World } from '../src/core/types';

function lateGame(seed = 7): World {
  const w = newWorld({ seed });
  w.city.open = true; w.city.moved = true; w.city.net = true;
  w.flags.kacakci = true;
  w.lab = { lvl: 3, site: 'agil', raw: 0, prod: 0, hap: 0, chem: null, q: 0.8, made: 100 };
  w.gang = 18; w.dirty = 600000;
  w.flags.ceteYok = 1;
  w.city.facs = { un: { since: 0, n: 1 }, sarap: { since: 0, n: 1 } };
  w.city.dist.forEach((d, i) => { if (i < 3) d.o = 'biz'; });
  w.city.turf = 3;
  return w;
}

describe('endgame: Konsey aileleri ve taht', () => {
  it('aileler kurulur ve bir Büyük Baba belirir', () => {
    const w = lateGame();
    const F = ensureFams(w);
    expect(F.length).toBe(5);
    expect(F.every((f) => typeof f.men === 'number' && f.reis.length > 0)).toBe(true);
    expect(babaFam(w)).toBeTruthy();
    expect(isBaba(w)).toBe(false);
    // Zorlaştırılmış endgame: tahta oynamak için ≥16 adam + en az iki dost aile gerekir
    aliveFams(w).filter((f) => f.id !== w.city.baba).slice(0, 2).forEach((f) => (f.bond = 80));
    w.gang = 18;
    expect(canChallenge(w).ok).toBe(true);
  });

  it('zayıf babaya suikastla taht alınır', () => {
    const w = lateGame(11);
    ensureFams(w);
    // iki dost aile + güçlü kadro: devirme koşulları sağlanır
    aliveFams(w).filter((f) => f.id !== w.city.baba).slice(0, 2).forEach((f) => (f.bond = 80));
    babaFam(w)!.men = 2;
    let took = false;
    for (let i = 0; i < 80 && !took; i++) { w.gang = 20; if (tahtHamle(w, 'suikast').ok) took = true; }
    expect(took).toBe(true);
    expect(isBaba(w)).toBe(true);
    expect(w.flags.konsey).toBe('baba');
    expect(w.city.baba).toBe('biz');
  });

  it('dostlarla oylama yoluyla taht alınır', () => {
    const w = lateGame(21);
    ensureFams(w);
    for (const f of aliveFams(w)) f.bond = 85;
    let took = false;
    for (let i = 0; i < 10 && !took; i++) { if (tahtHamle(w, 'oylama').ok) took = true; }
    expect(took).toBe(true);
    expect(isBaba(w)).toBe(true);
  });

  it('taht alındıktan sonra aylık döngü çökmeden işler ve plain JSON kalır', () => {
    const w = lateGame(33);
    ensureFams(w);
    aliveFams(w).filter((f) => f.id !== w.city.baba).slice(0, 2).forEach((f) => (f.bond = 80));
    babaFam(w)!.men = 1;
    for (let i = 0; i < 80 && !isBaba(w); i++) { w.gang = 20; tahtHamle(w, 'suikast'); }
    for (let i = 0; i < 36; i++) monthlyAile(w);
    expect(Number.isFinite(w.hh.cash)).toBe(true);
    expect(w.hh.cash).toBeGreaterThanOrEqual(0);
    // fams düz JSON
    for (const f of w.city.fams!) {
      expect(typeof f.bond).toBe('number');
      expect(Number.isFinite(f.men)).toBe(true);
    }
  });

  it('hediye bağı artırır, pusu düşürür', () => {
    const w = lateGame(44);
    ensureFams(w);
    const f = aliveFams(w).find((x) => x.trait !== 'kan')!;
    const b0 = f.bond;
    aileGift(w, f.id);
    expect(f.bond).toBeGreaterThan(b0);
    const target = aliveFams(w).find((x) => x.id !== f.id)!;
    const m0 = target.men; w.gang = 30;
    for (let i = 0; i < 20; i++) { w.gang = 30; ailePress(w, target.id); if (!target.alive) break; }
    expect(target.men).toBeLessThan(m0);
  });
});
