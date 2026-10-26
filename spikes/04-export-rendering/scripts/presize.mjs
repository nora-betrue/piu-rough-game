// Pre-sizes the placeholder art to the exact pixels the layout draws at each scale
// (assets/<s>x/...). At 1:1, resvg's fast nearest-neighbour image path is lossless.
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const assets = new URL('../assets/', import.meta.url).pathname;
// Display sizes in CSS px: keep in sync with src/layout.ts.
const SIZES = { jacket: [196.8, 104], grade: [64, 38], plate: [96, 29], avatar: [112, 112] };

function resize(file, w, h) {
	const b64 = readFileSync(file).toString('base64');
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><image href="data:image/png;base64,${b64}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/></svg>`;
	return new Resvg(svg).render().asPng();
}

for (const scale of [1, 2]) {
	const out = `${assets}${scale}x/`;
	for (const dir of ['jacket', 'grade', 'plate']) {
		mkdirSync(out + dir, { recursive: true });
		const [w, h] = SIZES[dir].map((v) => Math.round(v * scale));
		for (const f of readdirSync(assets + dir)) writeFileSync(`${out}${dir}/${f}`, resize(`${assets}${dir}/${f}`, w, h));
	}
	const [w, h] = SIZES.avatar.map((v) => v * scale);
	writeFileSync(`${out}avatar.png`, resize(`${assets}avatar.png`, w, h));
}
console.log('pre-sized assets written');
