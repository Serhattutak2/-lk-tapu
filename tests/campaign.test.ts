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
    if (p.job === 'lab' && p.inHH && p.d === undefined && !p.away) expect(w.lab).toBeTruthy();
    if (p.job === 'isletme' && p.inHH && p.d === undefined) expect((p.biz && w.hh.biz[p.biz]) || Object.values(w.city.facs).some((f) => f?.mgr === p.id)).toBeTruthy();
    expect(w.dirty).toBeGreaterThanOrEqual(0);
    expect(w.gang).toBeGreaterThanOrEqual(0);
    if (p.job === 'kendi') expect(w.hh.parcels.some((f) => f.id === p.parcel), `${p.id} parseli var`).toBe(true);
    if (p.away === 'hapis' && p.d === undefined) expect(p.awayUntil).toBeGreaterThan(w.m - 1);
  }
  expect(w.plots.filter((x) => x.o === 'biz').length).toBe(w.hh.parcels.length);
  if (w.lab) {
    expect(w.lab.raw).toBeGreaterThanOrEqual(0);
    expect(w.lab.lvl).toBeGreaterThanOrEqual(1);
    expect(w.lab.lvl).toBeLessThanOrEqual(3);
  }
  expect(w.rival.feud).toBeGreaterThanOrEqual(0);
  expect(w.rival.feud).toBeLessThanOrEqual(100);
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
    if (w.m % 3 === 0) check(w);
  }
  return w;
}

describe('100 yıllık otomatik kampanya', () => {
  const seeds = Array.from({ length: 16 }, (_, i) => 1000 + i * 7919);
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

describe('1925 takvimi, ekim planı, eski kayıt', () => {
  it('yeni oyun Mart 1925, eski kayıt 1965 tabanıyla sürer', async () => {
    const { year, dateText } = await import('../src/core/calendar');
    const { migrate } = await import('../src/core/world');
    const w = newWorld({ seed: 5 });
    expect(dateText(w.m)).toBe('Mart 1925');
    const old = JSON.parse(JSON.stringify(w));
    delete old.y0;
    delete old.mk;
    old.v = 6;
    const m = migrate(old);
    expect(year(m.m)).toBe(1965);
    migrate(w);
    expect(year(w.m)).toBe(1925);
  });

  it('planlı parsel ekim ayında kendiliğinden ekilir', async () => {
    const { newParcel } = await import('../src/core/fields');
    const w = newWorld({ seed: 9 });
    const f = newParcel(w, 0);
    w.plots[0] = { o: 'biz', pid: f.id, ask: 1, sale: false, mad: 0 };
    f.plan = 'bugday';
    w.hh.cash = 5000;
    w.hh.debt = 0;
    let guard = 0;
    while (!f.crop && guard++ < 14) {
      w.cards = [];
      advance(w);
    }
    expect(f.crop).toBe('bugday');
  });
});

describe('ekim planı uzun vadede', () => {
  it('her ürün her yıl kendiliğinden ekilir', async () => {
    const { newParcel } = await import('../src/core/fields');
    const { year } = await import('../src/core/calendar');
    const { resolveCard } = await import('../src/core/sim');
    const w = newWorld({ seed: 7 });
    const plans = ['bugday', 'nohut', 'pancar', 'tutun', 'arpa'] as const;
    for (const c of plans) {
      const f = newParcel(w, 0);
      const j = w.plots.findIndex((p) => p.o !== 'biz');
      w.plots[j] = { o: 'biz', pid: f.id, ask: 1, sale: false, mad: 0 };
      f.plan = c;
    }
    const sown: Record<string, Set<number>> = {};
    while (year(w.m) < 1946) {
      const before = w.hh.parcels.map((f) => f.crop);
      if (!advance(w)) {
        resolveCard(w, w.cards[0].uid, w.cards[0].opts[w.cards[0].opts.length - 1].k);
        continue;
      }
      w.hh.parcels.forEach((f, i) => {
        if (!before[i] && f.crop && f.plan) (sown[f.plan] ??= new Set()).add(year(w.m));
      });
      w.hh.cash = Math.max(w.hh.cash, 30000);
      w.hh.debt = 0;
    }
    for (const c of plans) expect(sown[c]?.size ?? 0, c).toBeGreaterThanOrEqual(20);
  }, 60000);
});

describe('tutarlılık: ölü karakterler', () => {
  it('ekranda bekleyen hiçbir kart ölü birini işaret etmez', async () => {
    const { P, alive } = await import('../src/core/people');
    for (const seed of [111, 222, 333, 444]) {
      const w = newWorld({ seed });
      const end = w.m + 120 * 12;
      while (w.m < end && !w.over) {
        botTurn(w);
        for (const c of w.cards) {
          if (c.pid) expect(alive(P(w, c.pid)), `kart ${c.id} ölü ${c.pid}`).toBe(true);
        }
        if (!advance(w)) botTurn(w);
      }
    }
  }, 60000);
});
