import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '../public/icons');
const sizes = [16, 32, 48, 128];

mkdirSync(outDir, { recursive: true });

const svgPath = join(outDir, 'burning-fox-logo.svg');
const svg = readFileSync(svgPath, 'utf8');

for (const w of sizes) {
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: w } });
  const png = resvg.render();
  const buf = png.asPng();
  const path = join(outDir, `icon-${w}.png`);
  writeFileSync(path, buf);
  console.log('wrote', path);
}
