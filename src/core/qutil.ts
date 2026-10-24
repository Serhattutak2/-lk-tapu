// Hikâye zincirleri için ortak yardımcılar ve tipler.
import type { World } from './types';
import { infl } from './calendar';

export const L = (w: World, n: number) => Math.round(n * infl(w.m));
export const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR');
export const nb = (w: World, n: number) => (w.flags.namBonus = Number(w.flags.namBonus || 0) + n);
export const step = (w: World, q: string) => Number(w.flags['q_' + q] || 0);
export const setStep = (w: World, q: string, s: number, wait = 0) => {
  w.flags['q_' + q] = s;
  w.flags['q_' + q + '_m'] = w.m + wait;
};
export const due = (w: World, q: string) => step(w, q) > 0 && w.m >= Number(w.flags['q_' + q + '_m'] || 0);

export interface Built { text: string; opts: { t: string; k: string }[]; pid?: string; data?: Record<string, unknown> }
export interface Quest {
  id: string;
  ad: string;
  start: (w: World) => boolean;
  steps: Record<number, (w: World) => Built | null>;
  res: (w: World, s: number, k: string, pid: string | undefined, d: Record<string, unknown>) => void;
}
