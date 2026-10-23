// Denge raporu: node tools/sim.mjs [kampanya sayısı] [yıl]
// Tek kampanya dökümü: node tools/sim.mjs probe [tohum]
import { build } from 'esbuild';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const entry = process.argv[2] === 'probe' ? 'probe.ts' : 'simreport.ts';
if (entry === 'probe.ts') process.argv.splice(2, 1);
const out = resolve(root, 'node_modules/.cache/' + entry.replace('.ts', '.mjs'));
await build({ entryPoints: [resolve(root, 'tools', entry)], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
await import(out + '?' + Date.now());
