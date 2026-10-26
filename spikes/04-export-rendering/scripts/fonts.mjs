// Builds fonts/ from an unzipped Pretendard release:
//   node scripts/fonts.mjs <path to Pretendard-1.3.9/public/static>
// Writes the full weights and a KS X 1001 + Latin subset, then prints sizes and script coverage.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import subsetFont from 'subset-font';
import * as fontkit from 'fontkit';

const src = process.argv[2];
if (!src) throw new Error('usage: node scripts/fonts.mjs <Pretendard public/static dir>');
const out = new URL('../fonts/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

// The 2,350 precomposed Hangul syllables of KS X 1001 (EUC-KR rows 0xB0–0xC8, cells 0xA1–0xFE).
const euckr = new TextDecoder('euc-kr');
let hangul = '';
for (let hi = 0xb0; hi <= 0xc8; hi++)
	for (let lo = 0xa1; lo <= 0xfe; lo++) hangul += euckr.decode(new Uint8Array([hi, lo]));

const range = (a, b) => String.fromCodePoint(...Array.from({ length: b - a + 1 }, (_, i) => a + i));
const latin =
	range(0x20, 0x7e) + // Basic Latin
	range(0xa0, 0xff) + // Latin-1
	range(0x100, 0x17f) + // Latin Extended-A
	range(0x2010, 0x2027) + // dashes, quotes, bullets, ellipsis
	range(0x2030, 0x203a) +
	'·×÷−∼～★☆♥♡♪♫→←↑↓№™©®°€₩';
const hangulJamo = range(0x3131, 0x318e); // compatibility jamo, e.g. ㅋㅋ
// Pretendard has kana but no kanji. Keep the kana, so the JP fallback only has to supply kanji.
const kana = range(0x3001, 0x301f) + range(0x3041, 0x3096) + range(0x30a1, 0x30ff);
const text = latin + hangul + hangulJamo + kana;
console.log(`subset text: ${[...text].length} code points (${[...hangul].length} Hangul syllables)`);

const sizes = [];
for (const weight of ['Medium', 'Bold']) {
	const full = readFileSync(join(src, `Pretendard-${weight}.otf`));
	writeFileSync(join(out, `full-${weight}.otf`), full);
	const sub = await subsetFont(full, text, { targetFormat: 'sfnt' });
	writeFileSync(join(out, `subset-${weight}.otf`), sub);
	const woff = await subsetFont(full, text, { targetFormat: 'woff' });
	writeFileSync(join(out, `subset-${weight}.woff`), woff);
	sizes.push({ weight, full: full.length, subset: sub.length, subsetWoff: woff.length });
}
console.table(sizes);

// What does the full font cover? This tells us which titles need a fallback font.
const f = fontkit.openSync(join(src, 'Pretendard-Medium.otf'));
const cover = (s) => {
	const cps = [...s];
	const have = cps.filter((c) => f.hasGlyphForCodePoint(c.codePointAt(0))).length;
	return `${have}/${cps.length}`;
};
console.log('full font glyph count:', f.numGlyphs);
console.log('hiragana  ', cover(range(0x3041, 0x3096)));
console.log('katakana  ', cover(range(0x30a1, 0x30fa)));
console.log('CJK ideo. ', cover(range(0x4e00, 0x9fff)));
console.log('Hangul all', cover(range(0xac00, 0xd7a3)));
console.log('sample JP ', cover('ナイト・オブ・ナイツ'), cover('千本桜'));

// Optional: Noto Sans JP as the fallback for kanji. In the real app the subset text would be every
// code point in the catalog that Pretendard lacks; here it's the sample data's titles.
const noto = process.argv[3];
if (noto) {
	const { tiles } = await import('../src/data.ts');
	const missing = [...new Set(tiles.flatMap((t) => [...t.title]))]
		.filter((c) => !f.hasGlyphForCodePoint(c.codePointAt(0)))
		.join('');
	const full = readFileSync(join(noto, 'NotoSansJP-Bold.otf'));
	writeFileSync(join(out, 'jp-full-Bold.otf'), full);
	const sub = await subsetFont(full, missing, { targetFormat: 'sfnt' });
	writeFileSync(join(out, 'jp-catalog-Bold.otf'), sub);
	console.log(`Noto Sans JP Bold: full ${full.length}, catalog subset (${missing}) ${sub.length}`);
}
