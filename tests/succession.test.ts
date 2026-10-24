import { describe, expect, it } from 'vitest';
import { newWorld } from '../src/core/world';
import { die } from '../src/core/life';
import { advance, canAdvance, resolveCard, setHeir } from '../src/core/sim';
import { alive, bloodLiving } from '../src/core/people';

describe('veraset', () => {
  it('varis belirlenmişse kontrol ona geçer', () => {
    const w = newWorld({ seed: 11 });
    const sib = bloodLiving(w).find((p) => p.id !== w.playerId && p.inHH && w.people[w.playerId].fa === p.fa)!;
    setHeir(w, sib.id);
    die(w, w.people[w.playerId], 'test');
    expect(w.playerId).toBe(sib.id);
    expect(w.cards.length).toBe(0);
  });

  it('varis yoksa veraset kartı çıkar, seçilen devralır', () => {
    const w = newWorld({ seed: 12 });
    const old = w.playerId;
    die(w, w.people[old], 'test');
    expect(w.flags.interregnum).toBe(true);
    expect(canAdvance(w)).toBe(false);
    const c = w.cards[0];
    expect(c.id).toBe('veraset');
    resolveCard(w, c.uid, c.opts[0].k);
    expect(w.playerId).not.toBe(old);
    expect(alive(w.people[w.playerId])).toBe(true);
    expect(advance(w)).toBe(true);
  });

  it('kan bağı kalmayınca uzak akraba ocağı devralır', () => {
    const w = newWorld({ seed: 13 });
    for (const p of bloodLiving(w)) if (p.id !== w.playerId) die(w, p, 'test');
    const old = w.playerId;
    die(w, w.people[old], 'test');
    // Ocak sönmez: uzak bir akraba gelir
    expect(w.over).toBeNull();
    expect(w.playerId).not.toBe(old);
    expect(alive(w.people[w.playerId])).toBe(true);
    expect(w.people[w.playerId].blood).toBe(true);
  });
});
