// Hand-wired renderer: satori (standalone, yoga passed in) + satori-html + @resvg/resvg-wasm.
// Shared by the Worker (src/worker-hand.ts) and the local benchmark (scripts/bench.mjs).
import satori, { init as initYoga } from 'satori/standalone';
import { html } from 'satori-html';
import { Resvg, initWasm as initResvg } from '@resvg/resvg-wasm';
import { HEIGHT, WIDTH, top50Html, type Images } from './layout.ts';

type WasmInput = WebAssembly.Module | ArrayBuffer | Uint8Array;
export interface Fonts {
	medium: ArrayBuffer;
	bold: ArrayBuffer;
	/** Used for code points Pretendard lacks (kanji). Undefined = no fallback. */
	jp?: ArrayBuffer;
}

let ready: Promise<void> | undefined;
export function init(yoga: WasmInput, resvg: WasmInput) {
	return (ready ??= Promise.all([initYoga(yoga as any), initResvg(resvg as any)]).then(() => {}));
}

export interface Timings {
	satori: number;
	resvg: number;
	encode: number;
}

/** opt: lean layout + nearest-neighbour image sampling (only lossless with images pre-sized for `scale`). */
export async function render(fonts: Fonts, img: Images, scale: 1 | 2, opt = false, now: () => number = () => performance.now()) {
	const t0 = now();
	const missing: string[] = [];
	// html() is a tagged-template function: a plain string is iterated per character (O(n²),
	// minutes for this layout). Wrap the markup in a one-element array instead.
	const svg = await satori(html([top50Html(img, opt)] as any) as any, {
		width: WIDTH,
		height: HEIGHT,
		fonts: [
			{ name: 'Pretendard', data: fonts.medium, weight: 500, style: 'normal' },
			{ name: 'Pretendard', data: fonts.bold, weight: 700, style: 'normal' },
		],
		loadAdditionalAsset: async (code, segment) => {
			missing.push(`${code}:${segment}`);
			if (fonts.jp && code !== 'emoji') return [{ name: 'Fallback JP', data: fonts.jp, weight: 700, style: 'normal' }];
			return [];
		},
	});
	const t1 = now();
	const resvg = new Resvg(svg, {
		fitTo: { mode: 'width', value: WIDTH * scale },
		font: { loadSystemFonts: false },
		...(opt && { imageRendering: 1 }), // optimizeSpeed
	});
	const rendered = resvg.render();
	const t2 = now();
	const png = rendered.asPng();
	const t3 = now();
	const out = { svg, png, width: rendered.width, height: rendered.height, missing };
	rendered.free();
	resvg.free();
	return { ...out, timings: { satori: t1 - t0, resvg: t2 - t1, encode: t3 - t2 } as Timings };
}
