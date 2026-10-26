// Spike 1: can a Worker's fetch() reach piugame.com despite the missing intermediate cert?
// GET / fetches each host with redirect: "manual" and reports the outcome as JSON.

const HOSTS = [
	'https://piugame.com/',
	'https://am-pass.net/',
	'https://phoenix.piugame.com/',
	// Controls: a correctly chained site, and a deliberately broken chain.
	'https://example.com/',
	'https://incomplete-chain.badssl.com/',
	// Negative controls: these must fail, or the edge isn't verifying certificates at all.
	'https://self-signed.badssl.com/',
	'https://untrusted-root.badssl.com/',
	'https://expired.badssl.com/',
	'https://wrong.host.badssl.com/'
];

const ASSET = 'https://piugame.com/l_img/p2/grade/sss_p.png';

type Result = {
	url: string;
	ok: boolean;
	status?: number;
	location?: string | null;
	contentType?: string | null;
	bytes?: number;
	sha256?: string;
	ms: number;
	error?: { name: string; message: string };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function probe(url: string, readBody: boolean): Promise<Result> {
	const start = Date.now();
	try {
		const res = await fetch(url, {
			redirect: 'manual',
			headers: { 'User-Agent': 'rg-spike-01 (TLS check; contact via roughgame.ing)' }
		});
		const out: Result = {
			url,
			ok: res.ok,
			status: res.status,
			location: res.headers.get('location'),
			contentType: res.headers.get('content-type'),
			ms: 0
		};
		if (readBody) {
			const buf = await res.arrayBuffer();
			out.bytes = buf.byteLength;
			const digest = await crypto.subtle.digest('SHA-256', buf);
			out.sha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
		} else {
			await res.body?.cancel();
		}
		out.ms = Date.now() - start;
		return out;
	} catch (e) {
		const err = e instanceof Error ? e : new Error(String(e));
		return { url, ok: false, ms: Date.now() - start, error: { name: err.name, message: err.message } };
	}
}

export default {
	async fetch(request: Request): Promise<Response> {
		if (new URL(request.url).pathname !== '/') return new Response('not found', { status: 404 });
		const results: Result[] = [];
		// Sequential and spaced out, to be gentle with piugame.com.
		for (const url of HOSTS) {
			results.push(await probe(url, false));
			await sleep(300);
		}
		results.push(await probe(ASSET, true));
		const cf = (request as Request & { cf?: { colo?: string } }).cf;
		return Response.json({ at: new Date().toISOString(), colo: cf?.colo ?? null, results }, {
			headers: { 'cache-control': 'no-store' }
		});
	}
};
