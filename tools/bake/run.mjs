// Drives the sprite baker in a headless browser and writes the sheets and
// their index to art/iso/. Run from the repository root:
//   node tools/bake/run.mjs [part ...]
// (parts: buildings villages flora stocks loads animals people; all by default)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

// Playwright from the project, or from wherever PLAYWRIGHT points.
const { chromium } = await import('playwright').catch(() => import(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright/index.mjs'));

const ROOT = new URL('../../', import.meta.url).pathname;
// BAKE_OUT writes somewhere else (to look at a test bake without touching the game's art).
const OUT = process.env.BAKE_OUT || join(ROOT, 'art/iso');
const PORT = 8771;
const parts = process.argv.slice(2);

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  page.on('console', (m) => m.type() === 'error' && console.error('console:', m.text()));
  await page.goto(`http://127.0.0.1:${PORT}/tools/bake/index.html`);
  await page.waitForFunction(() => window.bakeReady, null, { timeout: 60000 });
  const t0 = Date.now();
  const r = await page.evaluate((only) => window.bakeAll(only.length ? only : undefined), parts);
  console.log('baked', r, `${Math.round((Date.now() - t0) / 1000)} s`);
  const baked = await page.evaluate(() => window.baked);
  mkdirSync(OUT, { recursive: true });
  for (const f of readdirSync(OUT)) if (/^sheet-\d+\.webp$/.test(f)) unlinkSync(join(OUT, f));
  baked.sheets.forEach((url, k) => writeFileSync(join(OUT, `sheet-${k}.webp`), Buffer.from(url.split(',')[1], 'base64')));
  writeFileSync(join(OUT, 'sprites.json'), JSON.stringify({ ...baked.meta, sheets: baked.sheets.map((_, k) => `sheet-${k}.webp`), sprites: baked.index }));
  console.log('wrote', baked.sheets.length, 'sheets to', OUT);
} finally {
  await browser.close();
  server.kill();
}
