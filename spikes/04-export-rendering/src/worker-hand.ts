// rg-spike-04: hand-wired satori + resvg-wasm. GET /top50.png?font=subset|full|woff|bundled&scale=1|2&jp=catalog|full|none&opt=1
import './hb-shim.ts';
import yoga from 'satori/layout.wasm';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
import bundledMedium from '../fonts/subset-Medium.otf';
import bundledBold from '../fonts/subset-Bold.otf';
import { init, render, type Fonts } from './render-hand.ts';
import { imageLoader, loadFonts, type Env } from './r2.ts';

let isolateRequest = 0; // 0 = first request in this isolate (cold)

export default {
	async fetch(req: Request, env: Env): Promise<Response> {
		const url = new URL(req.url);
		if (url.pathname !== '/top50.png' && url.pathname !== '/top50.svg') return new Response('not found', { status: 404 });
		const font = url.searchParams.get('font') ?? 'subset';
		const scale = url.searchParams.get('scale') === '2' ? 2 : 1;
		const jp = url.searchParams.get('jp') ?? 'catalog';
		const opt = url.searchParams.get('opt') === '1';

		await init(yoga, resvgWasm);
		const fonts: Fonts =
			font === 'bundled'
				? { medium: bundledMedium, bold: bundledBold, jp: (await loadFonts(env, 'subset', jp)).jp }
				: await loadFonts(env, font, jp);
		const img = await imageLoader(env, opt ? `img/${scale}x/` : 'img/');
		const out = await render(fonts, img, scale, opt);
		console.log(JSON.stringify({ n: isolateRequest++, font, scale, jp, opt, png: out.png.length, svg: out.svg.length, missing: out.missing }));
		return url.pathname.endsWith('.svg')
			? new Response(out.svg, { headers: { 'content-type': 'image/svg+xml' } })
			: new Response(out.png as Uint8Array<ArrayBuffer>, { headers: { 'content-type': 'image/png' } });
	},
};
