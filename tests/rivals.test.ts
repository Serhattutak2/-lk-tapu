import { describe, expect, it } from 'vitest';
import { newWorld } from '../src/core/world';
import { advance, botTurn } from '../src/core/sim';
import { attackRival } from '../src/core/feud';
import { buyFac, launderCap, monthlyBaron } from '../src/core/baron';

describe('rakip aileler ve şehir', () => {
  it('rakip aile yok edilince yerine yenisi gelir', () => {
    const w = newWorld({ seed: 77 });
    w.flags.kacakci = true;
    w.gang = 20;
    w.rival.men = 2;
    let guard = 0;
    while (!w.rival.gone && guard++ < 50) {
      w.gang = 20;
      attackRival(w);
    }
    expect(w.rival.gone).toBe(true);
    expect(String(w.flags.yokEdilen)).toContain('Kocabaş');
    for (let i = 0; i < 60 && w.rival.gone; i++) {
      botTurn(w);
      advance(w);
    }
    expect(w.rival.gone).toBe(false);
    expect(w.rival.name).not.toBe('Kocabaş');
  });

  it('kara para yalnızca işletmeyle aklanır', () => {
    const w = newWorld({ seed: 78 });
    w.dirty = 50000;
    const lines: { t: string; v: number }[] = [];
    monthlyBaron(w, lines);
    expect(w.dirty).toBe(50000);
    w.hh.biz.bakkal = 1;
    expect(launderCap(w)).toBeGreaterThan(0);
    const cash = w.hh.cash;
    monthlyBaron(w, lines);
    expect(w.dirty).toBeLessThan(50000);
    expect(w.hh.cash).toBeGreaterThan(cash);
  });

  it('fabrika kara parayla alınamaz', () => {
    const w = newWorld({ seed: 79 });
    w.m = (1960 - (w.y0 || 1925)) * 12;
    w.city.open = true;
    w.dirty = 10_000_000;
    w.hh.cash = 0;
    expect(buyFac(w, 'un').ok).toBe(false);
    w.hh.cash = 10_000_000;
    expect(buyFac(w, 'un').ok).toBe(true);
  });
});
