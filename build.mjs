// Build del modulo: src/*.js -> dist/userScript.js (IIFE, ES5, un solo file).
// Uso: node build.mjs
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));

const result = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  target: ['chrome100'],
  outfile: 'dist/userScript.js',
  legalComments: 'inline',
  banner: {
    js: `/* ${pkg.appName} v${pkg.version} — UI TV per il web player di Spotify. Modulo TizenBrew. */`
  },
  logLevel: 'info'
});

console.log('build ok');
