export type CounterAlias = {
	surface: string;
	reading: string;
};

export type CounterSpec = {
	canonicalSurface: string;
	canonicalReading: string;
	aliases: readonly CounterAlias[];
	phonology?: Readonly<Record<string, string>>;
};

export const COUNTER_SPECS: readonly CounterSpec[] = [
	{
		canonicalSurface: '個',
		canonicalReading: 'コ',
		aliases: [{ surface: 'こ', reading: 'コ' }],
		phonology: {
			イチ: 'イッコ',
			ロク: 'ロッコ',
			ハチ: 'ハッコ',
			ジュウ: 'ジュッコ',
		},
	},
	{
		canonicalSurface: '人',
		canonicalReading: 'ニン',
		aliases: [{ surface: 'にん', reading: 'ニン' }],
	},
	{
		canonicalSurface: '台',
		canonicalReading: 'ダイ',
		aliases: [{ surface: 'だい', reading: 'ダイ' }],
	},
	{
		canonicalSurface: '冊',
		canonicalReading: 'サツ',
		aliases: [{ surface: 'さつ', reading: 'サツ' }],
	},
	{
		canonicalSurface: '杯',
		canonicalReading: 'ハイ',
		aliases: [{ surface: 'はい', reading: 'ハイ' }],
	},
	{
		canonicalSurface: '回',
		canonicalReading: 'カイ',
		aliases: [{ surface: 'かい', reading: 'カイ' }],
		phonology: {
			イチ: 'イッカイ',
			ニ: 'ニカイ',
			サン: 'サンカイ',
			ヨン: 'ヨンカイ',
			ゴ: 'ゴカイ',
			ロク: 'ロッカイ',
			ナナ: 'ナナカイ',
			ハチ: 'ハッカイ',
			キュウ: 'キュウカイ',
		},
	},
	{
		canonicalSurface: '階',
		canonicalReading: 'カイ',
		aliases: [{ surface: 'かい', reading: 'カイ' }],
		phonology: {
			イチ: 'イッカイ',
			ニ: 'ニカイ',
			サン: 'サンガイ',
			ヨン: 'ヨンカイ',
			ゴ: 'ゴカイ',
			ロク: 'ロッカイ',
			ナナ: 'ナナカイ',
			ハチ: 'ハッカイ',
			キュウ: 'キュウカイ',
		},
	},
	{
		canonicalSurface: '円',
		canonicalReading: 'エン',
		aliases: [{ surface: 'えん', reading: 'エン' }],
	},
	{
		canonicalSurface: '年',
		canonicalReading: 'ネン',
		aliases: [{ surface: 'ねん', reading: 'ネン' }],
	},
	{
		canonicalSurface: '週',
		canonicalReading: 'シュウ',
		aliases: [{ surface: 'しゅう', reading: 'シュウ' }],
	},
	{
		canonicalSurface: '秒',
		canonicalReading: 'ビョウ',
		aliases: [{ surface: 'びょう', reading: 'ビョウ' }],
	},
	{
		canonicalSurface: '号',
		canonicalReading: 'ゴウ',
		aliases: [{ surface: 'ごう', reading: 'ゴウ' }],
	},
	{
		canonicalSurface: '番',
		canonicalReading: 'バン',
		aliases: [{ surface: 'ばん', reading: 'バン' }],
	},
	{
		canonicalSurface: '本',
		canonicalReading: 'ホン',
		aliases: [
			{ surface: 'ほん', reading: 'ホン' },
			{ surface: 'ぼん', reading: 'ボン' },
			{ surface: 'ぽん', reading: 'ポン' },
		],
		phonology: {
			イチ: 'イッポン',
			ニ: 'ニホン',
			サン: 'サンボン',
			ヨン: 'ヨンホン',
			ゴ: 'ゴホン',
			ロク: 'ロッポン',
			ナナ: 'ナナホン',
			ハチ: 'ハッポン',
			キュウ: 'キュウホン',
		},
	},
	{
		canonicalSurface: '匹',
		canonicalReading: 'ヒキ',
		aliases: [
			{ surface: 'ひき', reading: 'ヒキ' },
			{ surface: 'びき', reading: 'ビキ' },
			{ surface: 'ぴき', reading: 'ピキ' },
		],
		phonology: {
			イチ: 'イッピキ',
			ニ: 'ニヒキ',
			サン: 'サンピキ',
			ヨン: 'ヨンヒキ',
			ゴ: 'ゴヒキ',
			ロク: 'ロッピキ',
			ナナ: 'ナナヒキ',
			ハチ: 'ハッピキ',
			キュウ: 'キュウヒキ',
		},
	},
	{
		canonicalSurface: '枚',
		canonicalReading: 'マイ',
		aliases: [{ surface: 'まい', reading: 'マイ' }],
	},
	{
		canonicalSurface: '歳',
		canonicalReading: 'サイ',
		aliases: [{ surface: 'さい', reading: 'サイ' }],
	},
	{
		canonicalSurface: '才',
		canonicalReading: 'サイ',
		aliases: [{ surface: 'さい', reading: 'サイ' }],
	},
	{
		canonicalSurface: '月',
		canonicalReading: 'ゲツ',
		aliases: [],
	},
	{
		canonicalSurface: 'ヶ月',
		canonicalReading: 'カゲツ',
		aliases: [],
	},
	{
		canonicalSurface: 'カ月',
		canonicalReading: 'カゲツ',
		aliases: [],
	},
	{
		canonicalSurface: '日',
		canonicalReading: 'ニチ',
		aliases: [],
	},
	{
		canonicalSurface: '時間',
		canonicalReading: 'ジカン',
		aliases: [],
	},
	{
		canonicalSurface: '分',
		canonicalReading: 'フン',
		aliases: [],
		phonology: {
			イチ: 'イップン',
			ニ: 'ニフン',
			サン: 'サンプン',
			ヨン: 'ヨンプン',
			ゴ: 'ゴフン',
			ロク: 'ロップン',
			ナナ: 'ナナフン',
			ハチ: 'ハップン',
			キュウ: 'キュウフン',
		},
	},
	{
		canonicalSurface: 'つ',
		canonicalReading: 'ツ',
		aliases: [{ surface: 'つ', reading: 'ツ' }],
	},
];

const COUNTER_SPECS_BY_CANONICAL = new Map(
	COUNTER_SPECS.map((spec) => [spec.canonicalSurface, spec]),
);

const COUNTER_SPECS_BY_SURFACE = new Map<string, CounterSpec[]>();
for (const spec of COUNTER_SPECS) {
	const values = COUNTER_SPECS_BY_SURFACE.get(spec.canonicalSurface) ?? [];
	values.push(spec);
	COUNTER_SPECS_BY_SURFACE.set(spec.canonicalSurface, values);

	for (const alias of spec.aliases) {
		const aliasValues = COUNTER_SPECS_BY_SURFACE.get(alias.surface) ?? [];
		aliasValues.push(spec);
		COUNTER_SPECS_BY_SURFACE.set(alias.surface, aliasValues);
	}
}

export const COUNTER_SUFFIXES = new Set([
	'後',
	'間',
	'目',
	'以内',
	'以上',
	'未満',
	'程度',
	'くらい',
	'頃',
	'前',
]);

export const DAY_COUNTER_RULES: ReadonlyArray<readonly [string, string]> = [
	['イチ', 'ツイタチ'],
	['ニ', 'フツカ'],
	['サン', 'ミッカ'],
	['ヨン', 'ヨッカ'],
	['ゴ', 'イツカ'],
	['ロク', 'ムイカ'],
	['ナナ', 'ナノカ'],
	['ハチ', 'ヨウカ'],
	['キュウ', 'ココノカ'],
	['ジュウ', 'トウカ'],
	['ニジュウ', 'ハツカ'],
];

export function getCounterSpecsForSurface(
	surface: string,
): readonly CounterSpec[] {
	return COUNTER_SPECS_BY_SURFACE.get(surface) ?? [];
}

export function getCounterSpecByCanonicalSurface(
	surface: string,
): CounterSpec | undefined {
	return COUNTER_SPECS_BY_CANONICAL.get(surface);
}

export function resolveCounterSpec(
	surface: string,
	normalizedForm?: string,
	dictionaryForm?: string,
): CounterSpec | undefined {
	if (normalizedForm) {
		const normalized = COUNTER_SPECS_BY_CANONICAL.get(normalizedForm);
		if (normalized) {
			return normalized;
		}
	}

	if (dictionaryForm) {
		const dictionary = COUNTER_SPECS_BY_CANONICAL.get(dictionaryForm);
		if (dictionary) {
			return dictionary;
		}
	}

	const candidates = COUNTER_SPECS_BY_SURFACE.get(surface);
	return candidates?.[0];
}
