// İlk Tapu derleyici: src/ altındaki TypeScript'i tek dosyalık index.html'e paketler.
// Kullanım: node tools/build.mjs                    -> dist/index.html
//           node tools/build.mjs --artifact X       -> X (Claude Artifact için iskeletsiz sürüm)
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const res = await build({
  entryPoints: [resolve(root, 'src/main.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify: true,
  write: false,
  legalComments: 'none',
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync(resolve(root, 'src/ui/styles.css'), 'utf8');
const shell = readFileSync(resolve(root, 'src/ui/shell.html'), 'utf8');
const html = shell.replace('/*CSS*/', () => css).replace('/*JS*/', () => js);

const ai = process.argv.indexOf('--artifact');
if (ai >= 0) {
  const out = resolve(root, process.argv[ai + 1]);
  mkdirSync(dirname(out), { recursive: true });
  let [head, body] = html.split('</head><body>');
  head = head.slice(head.indexOf('<title>'));
  body = body.replace('</body></html>', '');
  const art = head.replace('</title>', '</title><meta name="claude:viewport-fit-sides" content="cover">') + '\n' + body;
  writeFileSync(out, art);
  console.log('artifact ->', out, art.length);
} else {
  mkdirSync(resolve(root, 'dist'), { recursive: true });
  writeFileSync(resolve(root, 'dist/index.html'), html);
  console.log('dist/index.html', html.length);
}
