// Local render benchmark (Node, same code path as the Worker). PNGs go to out/ (git-ignored).
//   node scripts/bench.mjs [runs]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { init, render } from '../src/render-hand.ts';

const here = (p) => new URL(`../${p}`, import.meta.url).pathname;
const buf = (p) => {
	const b = readFileSync(here(p));
	return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};
const runs = Number(process.argv[2] ?? 5);

await init(readFileSync(here('node_modules/satori/layout.wasm')), readFileSync(here('node_modules/@resvg/resvg-wasm/index_bg.wasm')));

const uris = new Map();
const images = (dir) => (key) => {
	const p = `assets/${dir}${key}.png`;
	if (!uris.has(p)) uris.set(p, `data:image/png;base64,${readFileSync(here(p)).toString('base64')}`);
	return uris.get(p);
};

const fonts = {
	full: { medium: buf('fonts/full-Medium.otf'), bold: buf('fonts/full-Bold.otf') },
	subset: { medium: buf('fonts/subset-Medium.otf'), bold: buf('fonts/subset-Bold.otf') },
	woff: { medium: buf('fonts/subset-Medium.woff'), bold: buf('fonts/subset-Bold.woff') },
};
const jp = { catalog: buf('fonts/jp-catalog-Bold.otf'), full: buf('fonts/jp-full-Bold.otf') };

// [font, scale, jp fallback, opt]
const configs = [
	['subset', 1, 'catalog', false],
	['subset', 2, 'catalog', false],
	['full', 1, 'catalog', false],
	['woff', 1, 'catalog', false],
	['full', 1, 'full', false],
	['subset', 1, 'catalog', true],
	['subset', 2, 'catalog', true],
];
mkdirSync(here('out'), { recursive: true });
const rows = [];
for (const [font, scale, fb, opt] of configs) {
	const f = { ...fonts[font], jp: fb && jp[fb] };
	const times = [];
	let last;
	for (let i = 0; i < runs; i++) {
		const t = performance.now();
		last = await render(f, images(opt ? `${scale}x/` : ''), scale, opt);
		times.push({ total: performance.now() - t, ...last.timings });
	}
	const name = `${font}-${scale}x-jp-${fb}${opt ? '-opt' : ''}`;
	writeFileSync(here(`out/${name}.png`), last.png);
	const med = (k) => times.map((x) => x[k]).sort((a, b) => a - b)[Math.floor(times.length / 2)].toFixed(0);
	rows.push({
		name, first: times[0].total.toFixed(0), median: med('total'), satori: med('satori'), resvg: med('resvg'),
		encode: med('encode'), px: `${last.width}x${last.height}`, png_kb: (last.png.length / 1024).toFixed(0),
		svg_kb: (last.svg.length / 1024).toFixed(0), missing: [...new Set(last.missing)].join(' ').slice(0, 40),
	});
	console.error('done', name);
}
console.table(rows);
console.log('rss MB', (process.memoryUsage().rss / 2 ** 20).toFixed(0));
