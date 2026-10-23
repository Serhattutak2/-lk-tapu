// Tohumlu rastgelelik: aynı kayıt hep aynı sonucu verir. Durum World.rng içinde saklanır.
import type { World } from './types';

export function rand(w: World): number {
  let t = (w.rng = (w.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function chance(w: World, p: number): boolean {
  return rand(w) < p;
}

export function rint(w: World, lo: number, hi: number): number {
  return lo + Math.floor(rand(w) * (hi - lo + 1));
}

export function pick<T>(w: World, arr: readonly T[]): T {
  return arr[Math.floor(rand(w) * arr.length)];
}

export function gauss(w: World, mean: number, sd: number): number {
  const u = Math.max(1e-9, rand(w));
  const v = rand(w);
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}
