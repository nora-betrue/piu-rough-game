// Generates our own placeholder art at the official image sizes (no Andamiro art):
//   grades 300x178, plates 240x72, jackets 300x300, avatar 200x200 → assets/
// Jackets get turbulence noise so their PNGs are photo-like in size and decode cost.
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const out = new URL('../assets/', import.meta.url).pathname;
for (const d of ['grade', 'plate', 'jacket']) mkdirSync(out + d, { recursive: true });
const font = { fontFiles: [new URL('../fonts/full-Bold.otf', import.meta.url).pathname], loadSystemFonts: false };
const png = (svg) => new Resvg(svg, { font }).render().asPng();

const GRADES = ['SSS+', 'SSS', 'SS+', 'SS', 'S+', 'S', 'AAA+', 'AAA', 'AA+', 'AA', 'A+', 'A', 'B', 'C', 'D', 'F'];
for (const g of GRADES) {
	const hue = g.startsWith('S') ? 48 : g.startsWith('A') ? 200 : 0;
	const size = g.length > 3 ? 104 : 128;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="178">
		<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="hsl(${hue},100%,85%)"/><stop offset="1" stop-color="hsl(${hue},90%,45%)"/>
		</linearGradient></defs>
		<text x="150" y="132" text-anchor="middle" font-family="Pretendard" font-weight="700" font-size="${size}"
			fill="url(#g)" stroke="#000" stroke-width="5" paint-order="stroke" font-style="italic">${g}</text>
	</svg>`;
	writeFileSync(`${out}grade/${g.replace('+', 'p')}.png`, png(svg));
}

const PLATES = { PG: '#ffd23f', UG: '#ff8f4f', EG: '#ff6bb5', SG: '#c46bff', MG: '#7d8bff', TG: '#4fb3d9', FG: '#6fbf73', RG: '#8a8a93' };
const PLATE_NAMES = { PG: 'PERFECT', UG: 'ULTIMATE', EG: 'EXTREME', SG: 'SUPERB', MG: 'MARVELOUS', TG: 'TALENTED', FG: 'FAIR', RG: 'ROUGH' };
for (const [p, c] of Object.entries(PLATES)) {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="72">
		<rect x="3" y="3" width="234" height="66" rx="33" fill="#111" stroke="${c}" stroke-width="5"/>
		<text x="120" y="38" text-anchor="middle" font-family="Pretendard" font-weight="700" font-size="26" fill="${c}">${PLATE_NAMES[p]}</text>
		<text x="120" y="60" text-anchor="middle" font-family="Pretendard" font-weight="700" font-size="16" fill="#ddd" letter-spacing="4">GAME</text>
	</svg>`;
	writeFileSync(`${out}plate/${p}.png`, png(svg));
}

for (let i = 0; i < 50; i++) {
	const h1 = (i * 47) % 360, h2 = (h1 + 80) % 360;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">
		<defs>
			<linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h1},70%,45%)"/><stop offset="1" stop-color="hsl(${h2},70%,25%)"/></linearGradient>
			<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${i}"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="0.35"/></feComponentTransfer></filter>
		</defs>
		<rect width="300" height="300" fill="url(#b)"/>
		<circle cx="${80 + (i * 37) % 160}" cy="${90 + (i * 53) % 120}" r="${50 + (i % 5) * 12}" fill="hsl(${(h1 + 180) % 360},80%,60%)" opacity="0.7"/>
		<rect width="300" height="300" filter="url(#n)"/>
		<text x="16" y="284" font-family="Pretendard" font-weight="700" font-size="40" fill="#fff" opacity="0.8">#${i}</text>
	</svg>`;
	writeFileSync(`${out}jacket/${i}.png`, png(svg));
}

writeFileSync(`${out}avatar.png`, png(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
	<rect width="200" height="200" fill="#b6f24f"/><circle cx="100" cy="80" r="40" fill="#0b0b0c"/>
	<ellipse cx="100" cy="190" rx="70" ry="60" fill="#0b0b0c"/></svg>`));
console.log('placeholders written to', out);
