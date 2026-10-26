// Sample top-50 for the export. Titles are test strings (some real PIU titles, one Japanese
// string to exercise the font fallback); scores and plates are made up. Ratings use the
// Phoenix 2 formula from docs/DOMAIN.md.

export type Grade =
	| 'SSS+' | 'SSS' | 'SS+' | 'SS' | 'S+' | 'S' | 'AAA+' | 'AAA' | 'AA+' | 'AA' | 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
export type Plate = 'PG' | 'UG' | 'EG' | 'SG' | 'MG' | 'TG' | 'FG' | 'RG';

export interface Tile {
	rank: number;
	title: string;
	type: 'S' | 'D';
	level: number;
	score: number;
	grade: Grade;
	plate: Plate;
	rating: number;
	jacket: number; // index into the placeholder jackets
}

// Phoenix 2 constants (docs/DOMAIN.md, "Rating: PUMBILITY").
const P2_FLOORS: [Grade, number][] = [
	['SSS+', 995000], ['SSS', 990000], ['SS+', 985000], ['SS', 980000], ['S+', 975000], ['S', 970000],
	['AAA+', 960000], ['AAA', 950000], ['AA+', 940000], ['AA', 920000], ['A+', 900000], ['A', 800000],
	['B', 700000], ['C', 600000], ['D', 500000], ['F', 0],
];
const P2_GRADE: Record<Grade, [d: number, s: number]> = {
	'SSS+': [1.5, 1.5], SSS: [1.49, 1.49], 'SS+': [1.48, 1.48], SS: [1.47, 1.47], 'S+': [1.46, 1.46],
	S: [1.45, 1.45], 'AAA+': [1.43, 1.43], AAA: [1.41, 1.41], 'AA+': [1.39, 1.39], AA: [1.37, 1.36],
	'A+': [1.35, 1.33], A: [1.3, 1.28], B: [1.25, 1.2], C: [1.2, 1.1], D: [1.1, 1.0], F: [1.0, 0.9],
};
const P2_PLATE: Record<Plate, [d: number, s: number]> = {
	RG: [0, 0], FG: [0.002, 0.002], TG: [0.004, 0.004], MG: [0.006, 0.006], SG: [0.008, 0.008],
	EG: [0.012, 0.014], UG: [0.016, 0.017], PG: [0.02, 0.02],
};
const base = (l: number) => 130 + 5 * l + 5 * Math.max(0, l - 24);
const gradeOf = (score: number) => P2_FLOORS.find(([, f]) => score >= f)![0];
const rate = (type: 'S' | 'D', level: number, grade: Grade, plate: Plate) => {
	const i = type === 'S' ? 1 : 0;
	return base(type === 'S' ? level + 1 : level) * (P2_GRADE[grade][i] + P2_PLATE[plate][i]);
};

const TITLES = [
	'비상 ~Flying~',
	'고독이라는 이름의 열차',
	'소리꾼',
	'세상에 뿌려진 사랑만큼',
	'残酷な天使のテーゼ', // Japanese test string: kana (in Pretendard) + kanji (not in Pretendard)
	'Imprinting', 'Paved Garden', 'Gargoyle - FULL SONG -', 'Destr0yer', 'Conflict',
	'Phantom -Intermezzo-', 'Vanish', 'Altale', 'Leather', 'Prime Time', 'Ignis Fatuus (DM Ashura Mix)',
	'Moonlight', 'Pirate', 'Uh-Heung', 'Hyperion', 'Cross Ray', 'Life is PIANO', 'Scorpion King',
	'Imperium', 'Rock the house - SHORT CUT -', 'Bee', 'Love is a Danger Zone pt.2', 'Further',
	'Nemesis', 'BBoom BBoom', 'Mopemope', 'Brain Power', 'Final Audition 2', 'Sugar Free', 'Chimera',
	'Sorceress Elise', 'Dement ~After Legend~', 'Wi-Ex-Doc-Va', 'Baroque Virus - FULL SONG -',
	'Yog-Sothoth', 'Witch Doctor #1', 'Red Swan', 'Bad Apple!! feat. Nomico', 'Elysium', 'Tepris',
	'Utsushiyo No Kaze feat. Kana', 'Arcana Force', 'Hellfire', 'Monolith', 'Ugly Dee',
];
const PLATES: Plate[] = ['PG', 'UG', 'EG', 'SG', 'MG', 'TG', 'FG', 'RG'];

// Deterministic pseudo-random so every render (and every sample PNG) is identical.
let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);

const raw = TITLES.map((title, i) => {
	const type: 'S' | 'D' = rnd() < 0.5 ? 'S' : 'D';
	const level = type === 'S' ? 20 + Math.floor(rnd() * 6) : 21 + Math.floor(rnd() * 6);
	const score = Math.min(1_000_000, 940_000 + Math.floor(rnd() * 60_000));
	const grade = gradeOf(score);
	const plate = PLATES[Math.min(7, Math.floor(rnd() * rnd() * 8) + (score > 990_000 ? 0 : 2))];
	return { title, type, level, score, grade, plate, rating: rate(type, level, grade, plate), jacket: i };
});

export const tiles: Tile[] = raw
	.sort((a, b) => b.rating - a.rating)
	.map((t, i) => ({ ...t, rank: i + 1 }));

export const player = {
	name: 'ROUGHGAMER',
	title: '[S] Expert Lv.10',
	pumbility: Math.round(tiles.reduce((s, t) => s + t.rating, 0)),
	date: '2026-10-26',
};
