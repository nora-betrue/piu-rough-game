// Renders the committed sample PNGs into samples/ with the recommended setup (subset fonts,
// catalog JP fallback, opt), plus a font-fallback comparison strip.
//   node scripts/samples.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { init, render } from '../src/render-hand.ts';
import { tileRect, WIDTH } from '../src/layout.ts';
import { tiles } from '../src/data.ts';

const here = (p) => new URL(`../${p}`, import.meta.url).pathname;
const buf = (p) => {
	const b = readFileSync(here(p));
	return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};
await init(readFileSync(here('node_modules/satori/layout.wasm')), readFileSync(here('node_modules/@resvg/resvg-wasm/index_bg.wasm')));
const images = (dir) => (key) => `data:image/png;base64,${readFileSync(here(`assets/${dir}${key}.png`)).toString('base64')}`;
const subset = { medium: buf('fonts/subset-Medium.otf'), bold: buf('fonts/subset-Bold.otf') };
const full = { medium: buf('fonts/full-Medium.otf'), bold: buf('fonts/full-Bold.otf') };
const jp = buf('fonts/jp-catalog-Bold.otf');
const label = { fontFiles: [here('fonts/full-Bold.otf')], loadSystemFonts: false, defaultFontFamily: 'Pretendard' };

// Cuts rectangles (in CSS px) out of rendered PNGs and lays them out side by side, with captions.
function strip(parts, scale, file) {
	const gap = 16, cap = 28;
	const w = parts.reduce((s, p) => s + p.w * scale + gap, gap), h = Math.max(...parts.map((p) => p.h * scale)) + cap + gap * 2;
	let x = gap, body = '';
	for (const p of parts) {
		const b64 = Buffer.from(p.png).toString('base64');
		body += `<svg x="${x}" y="${gap + cap}" width="${p.w * scale}" height="${p.h * scale}" viewBox="${p.x * scale} ${p.y * scale} ${p.w * scale} ${p.h * scale}"><image href="data:image/png;base64,${b64}"/></svg>
			<text x="${x}" y="${gap + 18}" font-size="16" fill="#f5f5f3">${p.caption}</text>`;
		x += p.w * scale + gap;
	}
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#0b0b0c"/>${body}</svg>`;
	writeFileSync(here(`samples/${file}`), new Resvg(svg, { font: label }).render().asPng());
}

mkdirSync(here('samples'), { recursive: true });
const one = await render({ ...subset, jp }, images('1x/'), 1, true);
writeFileSync(here('samples/top50-1x.png'), one.png);

// 2x: header + first row, to check the grade/plate art stays sharp.
const two = await render({ ...subset, jp }, images('2x/'), 2, true);
const r = tileRect(5);
strip([{ png: two.png, x: 0, y: 0, w: WIDTH, h: r.y, caption: '2x (opt): header + first row' }], 2, 'top50-2x-crop.png');

// Font fallback: the tile with the Japanese test title, rendered four ways.
const jpTile = tileRect(tiles.findIndex((t) => /[぀-ヿ]/.test(t.title)));
// Fresh buffer copies per variant: satori caches fallback fonts per font buffer, so reusing the
// buffers from the renders above would leak the JP glyphs into the "no fallback" variants.
const fresh = (f) => ({ medium: f.medium.slice(0), bold: f.bold.slice(0) });
const variants = [
	['subset, no fallback', fresh(subset)],
	['full Pretendard, no fallback', fresh(full)],
	['subset + JP catalog subset', { ...fresh(subset), jp }],
	['full + JP catalog subset', { ...fresh(full), jp }],
];
const parts = [];
for (const [caption, fonts] of variants) {
	const out = await render(fonts, images('1x/'), 1, true);
	parts.push({ png: out.png, ...jpTile, caption });
}
strip(parts, 1, 'font-fallback.png');
console.log('samples written');
