// Ekransız kampanya testi: bot 100 yıl oynar, tutarlılık kuralları her ay denetlenir.
import { describe, expect, it } from 'vitest';
import { newWorld } from '../src/core/world';
import { advance, botTurn, isPlainJSON } from '../src/core/sim';
import { alive } from '../src/core/people';
import type { World } from '../src/core/types';

function check(w: World) {
  expect(Number.isFinite(w.hh.cash)).toBe(true);
  expect(w.hh.cash).toBeGreaterThanOrEqual(0);
  expect(w.hh.debt).toBeGreaterThanOrEqual(0);
  for (const id of w.hh.members) {
    const p = w.people[id];
    expect(p, `üye ${id} kayıtlı`).toBeDefined();
    expect(alive(p), `üye ${id} yaşıyor`).toBe(true);
    expect(p.inHH).toBe(true);
  }
  expect(new Set(w.hh.members).size).toBe(w.hh.members.length);
  for (const p of Object.values(w.people)) {
    expect(Number.isFinite(p.hp)).toBe(true);
    if (p.sp) expect(w.people[p.sp]?.sp).toBe(p.id);
  }
  if (!w.over && !w.flags.interregnum) expect(alive(w.people[w.playerId])).toBe(true);
  expect(w.heat).toBeGreaterThanOrEqual(0);
  expect(w.heat).toBeLessThanOrEqual(100);
  expect(w.hh.stash).toBeGreaterThanOrEqual(0);
  expect(w.hh.land).toBe(w.hh.parcels.length * 5);
  for (const p of Object.values(w.people)) {
    if (p.job === 'isletme') expect(p.biz && w.hh.biz[p.biz]).toBeTruthy();
    if (p.job === 'kendi') expect(w.hh.parcels.some((f) => f.id === p.parcel), `${p.id} parseli var`).toBe(true);
    if (p.away === 'hapis' && p.d === undefined) expect(p.awayUntil).toBeGreaterThan(w.m - 1);
  }
  expect(w.plots.filter((x) => x.o === 'biz').length).toBe(w.hh.parcels.length);
  for (const f of w.hh.parcels) {
    expect(w.plots.some((x) => x.pid === f.id), `parsel ${f.id} haritada`).toBe(true);
    expect(Number.isFinite(f.careSum)).toBe(true);
    if (f.crop) expect(f.sownM).toBeLessThanOrEqual(w.m);
  }
}

export function runCampaign(seed: number, years = 100) {
  const w = newWorld({ seed });
  const end = w.m + years * 12;
  while (w.m < end && !w.over) {
    botTurn(w);
    if (!advance(w)) botTurn(w);
    check(w);
  }
  return w;
}

describe('100 yıllık otomatik kampanya', () => {
  const seeds = Array.from({ length: 24 }, (_, i) => 1000 + i * 7919);
  it('çökmeden ve tutarlı biter', { timeout: 180000 }, () => {
    for (const s of seeds) {
      const w = runCampaign(s);
      expect(isPlainJSON(w)).toBe(true);
      const back = JSON.parse(JSON.stringify(w));
      expect(back.m).toBe(w.m);
    }
  });

  it('aynı tohum aynı tarihi üretir', { timeout: 60000 }, () => {
    const a = runCampaign(4242, 40);
    const b = runCampaign(4242, 40);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
