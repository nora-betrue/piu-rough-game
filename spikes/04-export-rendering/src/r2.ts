// R2 loading shared by both Workers. Fonts and image data URIs are cached per isolate, so a warm
// request does no R2 reads.
import { tiles } from './data.ts';
import type { Images } from './layout.ts';

export interface Env {
	BUCKET: R2Bucket;
}

const fontCache = new Map<string, Promise<ArrayBuffer | undefined>>();
const get = (env: Env, key: string) => {
	if (!fontCache.has(key))
		fontCache.set(key, env.BUCKET.get(key).then((o) => o?.arrayBuffer()));
	return fontCache.get(key)!;
};

export async function loadFonts(env: Env, font: string, jp: string) {
	const ext = font === 'woff' ? 'woff' : 'otf';
	const name = font === 'woff' ? 'subset' : font;
	const [medium, bold, jpFont] = await Promise.all([
		get(env, `fonts/${name}-Medium.${ext}`),
		get(env, `fonts/${name}-Bold.${ext}`),
		jp === 'none' ? undefined : get(env, `fonts/jp-${jp}-Bold.otf`),
	]);
	if (!medium || !bold) throw new Error(`missing font ${font}`);
	return { medium, bold, jp: jpFont };
}

function base64(bytes: Uint8Array) {
	let s = '';
	for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	return btoa(s);
}

const images = new Map<string, Promise<Map<string, string>>>();
/** prefix: 'img/' for the originals, 'img/1x/' or 'img/2x/' for pre-sized copies. */
export async function imageLoader(env: Env, prefix = 'img/'): Promise<Images> {
	if (!images.has(prefix)) images.set(prefix, (async () => {
		const keys = [
			'avatar',
			...new Set(tiles.flatMap((t) => [`jacket/${t.jacket}`, `grade/${t.grade.replace('+', 'p')}`, `plate/${t.plate}`])),
		];
		const entries = await Promise.all(
			keys.map(async (k) => {
				const o = await env.BUCKET.get(`${prefix}${k}.png`);
				if (!o) throw new Error(`missing image ${k}`);
				return [k, `data:image/png;base64,${base64(new Uint8Array(await o.arrayBuffer()))}`] as const;
			}),
		);
		return new Map(entries);
	})());
	const map = await images.get(prefix)!;
	return (k) => map.get(k)!;
}
