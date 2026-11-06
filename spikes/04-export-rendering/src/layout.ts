// The top-50 layout as an HTML string (for satori-html / @cf-wasm/og). Colours are the
// dark-theme tokens from apps/web/src/routes/layout.css. Image sizes go in `style`: satori-html passes
// width/height attributes as strings, which satori 0.32 (in @cf-wasm/og) turns into 0x0 images.
import { player, tiles, type Tile } from './data.ts';

export const WIDTH = 1080;
const PAD = 24;
const GAP = 12;
const COLS = 5;
const TILE_W = (WIDTH - 2 * PAD - (COLS - 1) * GAP) / COLS; // 196.8
const JACKET_H = 104;
const TILE_H = 226;
const HEADER_H = 168;
const FOOTER_H = 36;
export const HEIGHT = PAD + HEADER_H + GAP + 10 * TILE_H + 9 * GAP + GAP + FOOTER_H + PAD;

/** Position of the tile at 0-based index i, in CSS px (for cropping samples). */
export const tileRect = (i: number) => ({
	x: PAD + (i % COLS) * (TILE_W + GAP),
	y: PAD + HEADER_H + GAP + Math.floor(i / COLS) * (TILE_H + GAP),
	w: TILE_W,
	h: TILE_H,
});

const C = {
	bg: '#0b0b0c', surface: '#151516', raised: '#1e1e20', line: '#2a2a2d', fg: '#f5f5f3', muted: '#8d8d93',
	green: '#b6f24f', cyan: '#2ee6d6', yellow: '#ffd23f', pink: '#ff4fa3',
};

/** Image sources by key (`jacket/3`, `grade/SSSp`, `plate/PG`, `avatar`) → URL or data URI. */
export type Images = (key: string) => string;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (n: number) => n.toLocaleString('en-US');

/** lean: no overflow:hidden on tiles (satori masks every descendant of a clipped box; resvg pays per mask). */
function tile(t: Tile, img: Images, lean: boolean) {
	const ball = t.type === 'S' ? '#e8414b' : '#3fbf5a';
	return `<div style="display:flex;flex-direction:column;width:${TILE_W}px;height:${TILE_H}px;background:${C.surface};border:1px solid ${C.line};border-radius:16px${lean ? '' : ';overflow:hidden'}">
	<div style="display:flex;position:relative;width:${TILE_W}px;height:${JACKET_H}px">
		<img src="${img(`jacket/${t.jacket}`)}" style="width:${TILE_W}px;height:${JACKET_H}px;object-fit:cover${lean ? ';border-radius:15px 15px 0 0' : ''}" />
		<div style="display:flex;position:absolute;left:8px;top:8px;width:44px;height:44px;border-radius:22px;background:${ball};border:3px solid #fff;align-items:center;justify-content:center;color:#fff;font-size:16px;font-weight:700">${t.type}${t.level}</div>
		<div style="display:flex;position:absolute;right:8px;top:8px;padding:2px 8px;border-radius:10px;background:rgba(0,0,0,0.65);color:${C.fg};font-size:13px;font-weight:700">#${t.rank}</div>
	</div>
	<div style="display:flex;flex-direction:column;padding:8px 10px 0 10px;flex-grow:1">
		<div style="display:block;height:38px;color:${C.fg};font-size:15px;font-weight:700;line-height:1.25;lineClamp:2">${esc(t.title)}</div>
		<div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px">
			<img src="${img(`grade/${t.grade.replace('+', 'p')}`)}" style="width:64px;height:38px" />
			<img src="${img(`plate/${t.plate}`)}" style="width:96px;height:29px" />
		</div>
		<div style="display:flex;align-items:flex-end;justify-content:space-between;margin-top:2px">
			<div style="display:flex;color:${C.fg};font-size:19px;font-weight:700">${fmt(t.score)}</div>
			<div style="display:flex;color:${C.green};font-size:14px;font-weight:500">${t.rating.toFixed(1)}</div>
		</div>
	</div>
</div>`;
}

// Satori defaults to content-box (padding and borders widen boxes), so make every element border-box.
const borderBox = (markup: string) => markup.replaceAll('style="', 'style="box-sizing:border-box;');

export function top50Html(img: Images, lean = false) {
	const rows: string[] = [];
	for (let r = 0; r < 10; r++)
		rows.push(
			`<div style="display:flex;gap:${GAP}px">${tiles.slice(r * COLS, r * COLS + COLS).map((t) => tile(t, img, lean)).join('')}</div>`,
		);
	return borderBox(`<div style="display:flex;flex-direction:column;width:${WIDTH}px;height:${HEIGHT}px;padding:${PAD}px;gap:${GAP}px;background:${C.bg};font-family:Pretendard">
	<div style="display:flex;align-items:center;width:${WIDTH - 2 * PAD}px;height:${HEADER_H}px;padding:0 28px;border-radius:24px;background:linear-gradient(135deg, ${C.raised}, ${C.surface});border:1px solid ${C.line}">
		<img src="${img('avatar')}" style="width:112px;height:112px;border-radius:56px;border:3px solid ${C.green}" />
		<div style="display:flex;flex-direction:column;margin-left:24px;flex-grow:1">
			<div style="display:flex;color:${C.muted};font-size:18px;font-weight:500">${esc(player.title)}</div>
			<div style="display:flex;color:${C.fg};font-size:44px;font-weight:700">${esc(player.name)}</div>
			<div style="display:flex;color:${C.muted};font-size:16px;font-weight:500">Phoenix 2 · Top 50 · ${player.date}</div>
		</div>
		<div style="display:flex;flex-direction:column;align-items:flex-end">
			<div style="display:flex;color:${C.muted};font-size:16px;font-weight:500;letter-spacing:3px">PUMBILITY</div>
			<div style="display:flex;color:${C.green};font-size:64px;font-weight:700">${fmt(player.pumbility)}</div>
			<div style="display:flex;width:220px;height:6px;border-radius:3px;background:linear-gradient(90deg, ${C.pink}, ${C.yellow}, ${C.green}, ${C.cyan})"></div>
		</div>
	</div>
	${rows.join('\n')}
	<div style="display:flex;justify-content:space-between;width:${WIDTH - 2 * PAD}px;height:${FOOTER_H}px;align-items:center;color:${C.muted};font-size:14px;font-weight:500">
		<div style="display:flex">roughgame.ing</div>
		<div style="display:flex">Placeholder art · 테스트 이미지</div>
	</div>
</div>`);
}
