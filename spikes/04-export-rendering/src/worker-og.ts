// rg-spike-04-og: the prebundled @cf-wasm/og package, same layout and R2 data as worker-hand.ts.
// GET /top50.png?font=subset|full&scale=1|2&jp=catalog|full|none|google
import { render } from '@cf-wasm/og';
import { html } from 'satori-html';
import { HEIGHT, WIDTH, top50Html } from './layout.ts';
import { imageLoader, loadFonts, type Env } from './r2.ts';

let isolateRequest = 0; // 0 = first request in this isolate (cold)

export default {
	async fetch(req: Request, env: Env): Promise<Response> {
		const url = new URL(req.url);
		if (url.pathname !== '/top50.png') return new Response('not found', { status: 404 });
		const font = url.searchParams.get('font') ?? 'subset';
		const scale = url.searchParams.get('scale') === '2' ? 2 : 1;
		const jp = url.searchParams.get('jp') ?? 'catalog';

		const fonts = await loadFonts(env, font, jp === 'google' ? 'none' : jp);
		const img = await imageLoader(env);
		const missing: string[] = [];
		// The package always fits resvg to `width` (no scale option), so 2x scales the layout itself.
		const markup =
			scale === 1
				? top50Html(img)
				: `<div style="display:flex;width:${WIDTH * scale}px;height:${HEIGHT * scale}px"><div style="display:flex;transform:scale(${scale});transform-origin:0 0">${top50Html(img)}</div></div>`;
		const out = await render(html([markup] as any) as any, {
			width: WIDTH * scale,
			height: HEIGHT * scale,
			fonts: [
				{ name: 'Pretendard', data: fonts.medium, weight: 500, style: 'normal' },
				{ name: 'Pretendard', data: fonts.bold, weight: 700, style: 'normal' },
			],
			// 'google' keeps the package default: missing glyphs are fetched from Google Fonts.
			loadAdditionalAsset: (code: string, segment: string) => {
				missing.push(`${code}:${segment}`);
				if (jp === 'google') return undefined;
				return fonts.jp ? [{ name: 'Fallback JP', data: fonts.jp, weight: 700, style: 'normal' }] : [];
			},
		} as any).asPng();
		console.log(JSON.stringify({ n: isolateRequest++, font, scale, jp, png: out.image.length, missing }));
		return new Response(out.image, { headers: { 'content-type': 'image/png' } });
	},
};
