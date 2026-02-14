import { beforeAll, describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Config } from '../../src/config/config.js';
import type { Dictionary } from '../../src/core/dictionary.js';
import { SplitMode } from '../../src/core/tokenizer.js';
import { DictionaryFactory } from '../../src/dictionary/dictionaryFactory.js';

const SYSTEM_DIC_PATH = join(import.meta.dir, '..', '..', 'resources', 'system.dic');

const describeIfSystemDic = existsSync(SYSTEM_DIC_PATH) ? describe : describe.skip;

function createBaseConfig() {
	return {
		systemDict: SYSTEM_DIC_PATH,
		enableDefaultCompoundParticles: false,
		oovProviderPlugin: [
			{
				class: 'com.worksap.nlp.sudachi.SimpleOovProviderPlugin',
				oovPOS: ['名詞', '普通名詞', '一般', '*', '*', '*'],
				leftId: 0,
				rightId: 0,
				cost: 30000,
			},
		],
	};
}

function createWithChunkerConfig() {
	return Config.parse(
		JSON.stringify({
			...createBaseConfig(),
			pathRewritePlugin: [
				{
					class: 'com.worksap.nlp.sudachi.TokenChunkerPlugin',
					enablePatternRules: true,
				},
			],
		}),
	);
}

function createWithoutChunkerConfig() {
	return Config.parse(
		JSON.stringify({
			...createBaseConfig(),
			pathRewritePlugin: [],
		}),
	);
}

function tokenizeSurfaces(dictionary: Dictionary, text: string): string[] {
	const tokenizer = dictionary.create();
	return [...tokenizer.tokenize(SplitMode.C, text)].map((m) => m.surface());
}

type ObligationSentencePattern = {
	naiToIkenai: string;
	nakerebaNaranai: string;
	nakerebaIkenai: string;
	nakutewaIkenai: string;
	nakutemoIi: string;
	temoIi: string;
	nakyaIkenai: string;
	nakyaNaranai: string;
	nakuchaIkenai: string;
	nakuchaNaranai: string;
};

type AdversarialChunkCase = {
	text: string;
	expectedChunk: string;
};

function createObligationSentencePatterns(): ObligationSentencePattern[] {
	return [
		{
			naiToIkenai: '食べないといけない',
			nakerebaNaranai: '食べなければならない',
			nakerebaIkenai: '食べなければいけない',
			nakutewaIkenai: '食べなくてはいけない',
			nakutemoIi: '食べなくてもいい',
			temoIi: '食べてもいい',
			nakyaIkenai: '食べなきゃいけない',
			nakyaNaranai: '食べなきゃならない',
			nakuchaIkenai: '食べなくちゃいけない',
			nakuchaNaranai: '食べなくちゃならない',
		},
		{
			naiToIkenai: '飲まないといけない',
			nakerebaNaranai: '飲まなければならない',
			nakerebaIkenai: '飲まなければいけない',
			nakutewaIkenai: '飲まなくてはいけない',
			nakutemoIi: '飲まなくてもいい',
			temoIi: '飲んでもいい',
			nakyaIkenai: '飲まなきゃいけない',
			nakyaNaranai: '飲まなきゃならない',
			nakuchaIkenai: '飲まなくちゃいけない',
			nakuchaNaranai: '飲まなくちゃならない',
		},
		{
			naiToIkenai: '行かないといけない',
			nakerebaNaranai: '行かなければならない',
			nakerebaIkenai: '行かなければいけない',
			nakutewaIkenai: '行かなくてはいけない',
			nakutemoIi: '行かなくてもいい',
			temoIi: '行ってもいい',
			nakyaIkenai: '行かなきゃいけない',
			nakyaNaranai: '行かなきゃならない',
			nakuchaIkenai: '行かなくちゃいけない',
			nakuchaNaranai: '行かなくちゃならない',
		},
		{
			naiToIkenai: '読まないといけない',
			nakerebaNaranai: '読まなければならない',
			nakerebaIkenai: '読まなければいけない',
			nakutewaIkenai: '読まなくてはいけない',
			nakutemoIi: '読まなくてもいい',
			temoIi: '読んでもいい',
			nakyaIkenai: '読まなきゃいけない',
			nakyaNaranai: '読まなきゃならない',
			nakuchaIkenai: '読まなくちゃいけない',
			nakuchaNaranai: '読まなくちゃならない',
		},
		{
			naiToIkenai: '書かないといけない',
			nakerebaNaranai: '書かなければならない',
			nakerebaIkenai: '書かなければいけない',
			nakutewaIkenai: '書かなくてはいけない',
			nakutemoIi: '書かなくてもいい',
			temoIi: '書いてもいい',
			nakyaIkenai: '書かなきゃいけない',
			nakyaNaranai: '書かなきゃならない',
			nakuchaIkenai: '書かなくちゃいけない',
			nakuchaNaranai: '書かなくちゃならない',
		},
		{
			naiToIkenai: '見ないといけない',
			nakerebaNaranai: '見なければならない',
			nakerebaIkenai: '見なければいけない',
			nakutewaIkenai: '見なくてはいけない',
			nakutemoIi: '見なくてもいい',
			temoIi: '見てもいい',
			nakyaIkenai: '見なきゃいけない',
			nakyaNaranai: '見なきゃならない',
			nakuchaIkenai: '見なくちゃいけない',
			nakuchaNaranai: '見なくちゃならない',
		},
		{
			naiToIkenai: '聞かないといけない',
			nakerebaNaranai: '聞かなければならない',
			nakerebaIkenai: '聞かなければいけない',
			nakutewaIkenai: '聞かなくてはいけない',
			nakutemoIi: '聞かなくてもいい',
			temoIi: '聞いてもいい',
			nakyaIkenai: '聞かなきゃいけない',
			nakyaNaranai: '聞かなきゃならない',
			nakuchaIkenai: '聞かなくちゃいけない',
			nakuchaNaranai: '聞かなくちゃならない',
		},
		{
			naiToIkenai: '作らないといけない',
			nakerebaNaranai: '作らなければならない',
			nakerebaIkenai: '作らなければいけない',
			nakutewaIkenai: '作らなくてはいけない',
			nakutemoIi: '作らなくてもいい',
			temoIi: '作ってもいい',
			nakyaIkenai: '作らなきゃいけない',
			nakyaNaranai: '作らなきゃならない',
			nakuchaIkenai: '作らなくちゃいけない',
			nakuchaNaranai: '作らなくちゃならない',
		},
		{
			naiToIkenai: '話さないといけない',
			nakerebaNaranai: '話さなければならない',
			nakerebaIkenai: '話さなければいけない',
			nakutewaIkenai: '話さなくてはいけない',
			nakutemoIi: '話さなくてもいい',
			temoIi: '話してもいい',
			nakyaIkenai: '話さなきゃいけない',
			nakyaNaranai: '話さなきゃならない',
			nakuchaIkenai: '話さなくちゃいけない',
			nakuchaNaranai: '話さなくちゃならない',
		},
		{
			naiToIkenai: '遊ばないといけない',
			nakerebaNaranai: '遊ばなければならない',
			nakerebaIkenai: '遊ばなければいけない',
			nakutewaIkenai: '遊ばなくてはいけない',
			nakutemoIi: '遊ばなくてもいい',
			temoIi: '遊んでもいい',
			nakyaIkenai: '遊ばなきゃいけない',
			nakyaNaranai: '遊ばなきゃならない',
			nakuchaIkenai: '遊ばなくちゃいけない',
			nakuchaNaranai: '遊ばなくちゃならない',
		},
		{
			naiToIkenai: '待たないといけない',
			nakerebaNaranai: '待たなければならない',
			nakerebaIkenai: '待たなければいけない',
			nakutewaIkenai: '待たなくてはいけない',
			nakutemoIi: '待たなくてもいい',
			temoIi: '待ってもいい',
			nakyaIkenai: '待たなきゃいけない',
			nakyaNaranai: '待たなきゃならない',
			nakuchaIkenai: '待たなくちゃいけない',
			nakuchaNaranai: '待たなくちゃならない',
		},
		{
			naiToIkenai: '使わないといけない',
			nakerebaNaranai: '使わなければならない',
			nakerebaIkenai: '使わなければいけない',
			nakutewaIkenai: '使わなくてはいけない',
			nakutemoIi: '使わなくてもいい',
			temoIi: '使ってもいい',
			nakyaIkenai: '使わなきゃいけない',
			nakyaNaranai: '使わなきゃならない',
			nakuchaIkenai: '使わなくちゃいけない',
			nakuchaNaranai: '使わなくちゃならない',
		},
		{
			naiToIkenai: '住まないといけない',
			nakerebaNaranai: '住まなければならない',
			nakerebaIkenai: '住まなければいけない',
			nakutewaIkenai: '住まなくてはいけない',
			nakutemoIi: '住まなくてもいい',
			temoIi: '住んでもいい',
			nakyaIkenai: '住まなきゃいけない',
			nakyaNaranai: '住まなきゃならない',
			nakuchaIkenai: '住まなくちゃいけない',
			nakuchaNaranai: '住まなくちゃならない',
		},
		{
			naiToIkenai: '学ばないといけない',
			nakerebaNaranai: '学ばなければならない',
			nakerebaIkenai: '学ばなければいけない',
			nakutewaIkenai: '学ばなくてはいけない',
			nakutemoIi: '学ばなくてもいい',
			temoIi: '学んでもいい',
			nakyaIkenai: '学ばなきゃいけない',
			nakyaNaranai: '学ばなきゃならない',
			nakuchaIkenai: '学ばなくちゃいけない',
			nakuchaNaranai: '学ばなくちゃならない',
		},
		{
			naiToIkenai: '歩かないといけない',
			nakerebaNaranai: '歩かなければならない',
			nakerebaIkenai: '歩かなければいけない',
			nakutewaIkenai: '歩かなくてはいけない',
			nakutemoIi: '歩かなくてもいい',
			temoIi: '歩いてもいい',
			nakyaIkenai: '歩かなきゃいけない',
			nakyaNaranai: '歩かなきゃならない',
			nakuchaIkenai: '歩かなくちゃいけない',
			nakuchaNaranai: '歩かなくちゃならない',
		},
		{
			naiToIkenai: '泳がないといけない',
			nakerebaNaranai: '泳がなければならない',
			nakerebaIkenai: '泳がなければいけない',
			nakutewaIkenai: '泳がなくてはいけない',
			nakutemoIi: '泳がなくてもいい',
			temoIi: '泳いでもいい',
			nakyaIkenai: '泳がなきゃいけない',
			nakyaNaranai: '泳がなきゃならない',
			nakuchaIkenai: '泳がなくちゃいけない',
			nakuchaNaranai: '泳がなくちゃならない',
		},
		{
			naiToIkenai: '買わないといけない',
			nakerebaNaranai: '買わなければならない',
			nakerebaIkenai: '買わなければいけない',
			nakutewaIkenai: '買わなくてはいけない',
			nakutemoIi: '買わなくてもいい',
			temoIi: '買ってもいい',
			nakyaIkenai: '買わなきゃいけない',
			nakyaNaranai: '買わなきゃならない',
			nakuchaIkenai: '買わなくちゃいけない',
			nakuchaNaranai: '買わなくちゃならない',
		},
		{
			naiToIkenai: '売らないといけない',
			nakerebaNaranai: '売らなければならない',
			nakerebaIkenai: '売らなければいけない',
			nakutewaIkenai: '売らなくてはいけない',
			nakutemoIi: '売らなくてもいい',
			temoIi: '売ってもいい',
			nakyaIkenai: '売らなきゃいけない',
			nakyaNaranai: '売らなきゃならない',
			nakuchaIkenai: '売らなくちゃいけない',
			nakuchaNaranai: '売らなくちゃならない',
		},
		{
			naiToIkenai: '休まないといけない',
			nakerebaNaranai: '休まなければならない',
			nakerebaIkenai: '休まなければいけない',
			nakutewaIkenai: '休まなくてはいけない',
			nakutemoIi: '休まなくてもいい',
			temoIi: '休んでもいい',
			nakyaIkenai: '休まなきゃいけない',
			nakyaNaranai: '休まなきゃならない',
			nakuchaIkenai: '休まなくちゃいけない',
			nakuchaNaranai: '休まなくちゃならない',
		},
		{
			naiToIkenai: '急がないといけない',
			nakerebaNaranai: '急がなければならない',
			nakerebaIkenai: '急がなければいけない',
			nakutewaIkenai: '急がなくてはいけない',
			nakutemoIi: '急がなくてもいい',
			temoIi: '急いでもいい',
			nakyaIkenai: '急がなきゃいけない',
			nakyaNaranai: '急がなきゃならない',
			nakuchaIkenai: '急がなくちゃいけない',
			nakuchaNaranai: '急がなくちゃならない',
		},
	];
}

function createAdversarialChunkCases(): AdversarialChunkCase[] {
	const subjects = [
		'私は',
		'彼は',
		'彼女は',
		'先生は',
		'学生は',
		'友達は',
		'母は',
		'父は',
		'先輩は',
		'後輩は',
	];
	const patterns = createObligationSentencePatterns();
	const cases: AdversarialChunkCase[] = [];
	for (const subject of subjects) {
		for (const pattern of patterns) {
			const expectedChunks = [
				pattern.naiToIkenai,
				pattern.nakerebaNaranai,
				pattern.nakerebaIkenai,
				pattern.nakutewaIkenai,
				pattern.nakutemoIi,
				pattern.temoIi,
				pattern.nakyaIkenai,
				pattern.nakyaNaranai,
				pattern.nakuchaIkenai,
				pattern.nakuchaNaranai,
			];
			for (const expectedChunk of expectedChunks) {
				cases.push({
					text: `${subject}${expectedChunk}。`,
					expectedChunk,
				});
			}
		}
	}
	return cases;
}

describeIfSystemDic('TokenChunkerPlugin system.dic validation', () => {
	let withChunker: Dictionary;
	let withoutChunker: Dictionary;

	beforeAll(async () => {
		const factory = new DictionaryFactory();
		withChunker = await factory.create(undefined, createWithChunkerConfig());
		withoutChunker = await factory.create(undefined, createWithoutChunkerConfig());
	});

	test('merges added grammar chunks with real dictionary tokenization', () => {
		const cases: Array<{
			text: string;
			without: string[];
			with: string[];
		}> = [
			{
				text: '私だったら話す',
				without: ['私', 'だっ', 'たら', '話す'],
				with: ['私だったら', '話す'],
			},
			{
				text: '優太だった',
				without: ['優太', 'だっ', 'た'],
				with: ['優太だった'],
			},
			{
				text: '一番魅力的だったのは誰？',
				without: ['一番', '魅力的', 'だっ', 'た', 'の', 'は', '誰', '?'],
				with: ['一番', '魅力的だった', 'のは', '誰', '?'],
			},
			{
				text: '事じゃなくて気持ちだ',
				without: ['事', 'じゃ', 'なく', 'て', '気持ち', 'だ'],
				with: ['事じゃなくて', '気持ち', 'だ'],
			},
			{
				text: '映画をバカにされた事じゃなくて',
				without: ['映画', 'を', 'バカ', 'に', 'さ', 'れ', 'た', '事', 'じゃ', 'なく', 'て'],
				with: ['映画', 'を', 'バカにされた', '事じゃなくて'],
			},
			{
				text: 'キリンと話してたよ',
				without: ['キリン', 'と', '話し', 'て', 'た', 'よ'],
				with: ['キリン', 'と', '話してた', 'よ'],
			},
			{
				text: '病院で自殺しようと決意する',
				without: ['病院', 'で', '自殺', 'しよう', 'と', '決意', 'する'],
				with: ['病院', 'で', '自殺しよう', 'と', '決意', 'する'],
			},
			{
				text: '死ぬまで撮る',
				without: ['死ぬ', 'まで', '撮る'],
				with: ['死ぬまで', '撮る'],
			},
			{
				text: 'みんなに言われる',
				without: ['みんな', 'に', '言わ', 'れる'],
				with: ['みんな', 'に', '言われる'],
			},
			{
				text: 'みんなに言われた',
				without: ['みんな', 'に', '言わ', 'れ', 'た'],
				with: ['みんな', 'に', '言われた'],
			},
			{
				text: '母親の映像とか僕がボロクソ言われたシーンも',
				without: [
					'母親',
					'の',
					'映像',
					'と',
					'か',
					'僕',
					'が',
					'ボロクソ',
					'言わ',
					'れ',
					'た',
					'シーン',
					'も',
				],
				with: [
					'母親',
					'の',
					'映像',
					'と',
					'か',
					'僕',
					'が',
					'ボロクソ',
					'言われた',
					'シーン',
					'も',
				],
			},
			{
				text: 'それで傷ついた',
				without: ['それ', 'で', '傷つい', 'た'],
				with: ['それで', '傷ついた'],
			},
			{
				text: '優太と言ったら有名だ',
				without: ['優太', 'と', '言っ', 'たら', '有名', 'だ'],
				with: ['優太', 'と言ったら', '有名', 'だ'],
			},
			{
				text: '撮って欲しかったんだ',
				without: ['撮っ', 'て', '欲しかっ', 'た', 'ん', 'だ'],
				with: ['撮って', '欲しかったんだ'],
			},
			{
				text: 'だけど吸血鬼はだんだん弱っていって',
				without: ['だ', 'けど', '吸血鬼', 'は', 'だんだん', '弱っ', 'て', 'いっ', 'て'],
				with: ['だけど', '吸血鬼', 'は', 'だんだん', '弱っていって'],
			},
			{
				text: '半分自伝的映画だから',
				without: ['半分', '自伝', '的', '映画', 'だ', 'から'],
				with: ['半分', '自伝的', '映画', 'だから'],
			},
			{
				text: '感謝してもしきれない',
				without: ['感謝', 'し', 'て', 'も', 'し', 'きれ', 'ない'],
				with: ['感謝しても', 'しきれない'],
			},
			{
				text: '傷ついたら',
				without: ['傷つい', 'たら'],
				with: ['傷ついたら'],
			},
			{
				text: 'かもしれない',
				without: ['か', 'も', 'しれ', 'ない'],
				with: ['かもしれない'],
			},
			{
				text: '進めなくなってしまう',
				without: ['進め', 'なく', 'なっ', 'て', 'しまう'],
				with: ['進めなくなってしまう'],
			},
			{
				text: 'なんかお礼したいな',
				without: ['なん', 'か', 'お礼', 'し', 'たい', 'な'],
				with: ['なんか', 'お礼', 'したい', 'な'],
			},
			{
				text: 'わかってた事なんだけどね',
				without: ['わかっ', 'て', 'た', '事', 'な', 'ん', 'だ', 'けど', 'ね'],
				with: ['わかってた', '事', 'なんだけど', 'ね'],
			},
			{
				text: '普通にやだ．．．',
				without: ['普通', 'に', 'や', 'だ', '.', '.', '.'],
				with: ['普通', 'に', 'やだ', '.', '.', '.'],
			},
			{
				text: 'えーお父さんが撮影してます．．．',
				without: ['えー', 'お父さん', 'が', '撮影', 'し', 'て', 'ます', '.', '.', '.'],
				with: ['えー', 'お父さん', 'が', '撮影してます', '.', '.', '.'],
			},
			{
				text: 'お母さんね死んじゃうかもしれないんだよ？',
				without: ['お母さん', 'ね', '死ん', 'じゃう', 'か', 'も', 'しれ', 'ない', 'ん', 'だ', 'よ', '?'],
				with: ['お母さん', 'ね', '死んじゃう', 'かもしれない', 'んだよ', '?'],
			},
			{
				text: 'それでお父さんは仕事で日中いないから優太に動画撮らせてたんだ',
				without: [
					'それ',
					'で',
					'お父さん',
					'は',
					'仕事',
					'で',
					'日',
					'中',
					'い',
					'ない',
					'から',
					'優太',
					'に',
					'動画',
					'撮ら',
					'せ',
					'て',
					'た',
					'ん',
					'だ',
				],
				with: [
					'それで',
					'お父さん',
					'は',
					'仕事',
					'で',
					'日中',
					'いない',
					'から',
					'優太',
					'に',
					'動画',
					'撮らせてたんだ',
				],
			},
			{
				text: '血い',
				without: ['血', 'い'],
				with: ['血い'],
			},
			{
				text: 'お見舞いに来ました',
				without: ['お見舞い', 'に', '来', 'まし', 'た'],
				with: ['お見舞い', 'に', '来ました'],
			},
			{
				text: 'あるわけないじゃん汚いっ！',
				without: ['ある', 'わけ', 'ない', 'じゃん', '汚', 'いっ', '!'],
				with: ['ある', 'わけない', 'じゃん', '汚いっ', '!'],
			},
		];

		for (const chunkCase of cases) {
			const without = tokenizeSurfaces(withoutChunker, chunkCase.text);
			const withChunkerResult = tokenizeSurfaces(withChunker, chunkCase.text);
			expect(without).toEqual(chunkCase.without);
			expect(withChunkerResult).toEqual(chunkCase.with);
		}
	});

	test('does not over-merge selected negative controls with real dictionary tokenization', () => {
		const cases: Array<{
			text: string;
			expected: string[];
		}> = [
			{
				text: '東京たい',
				expected: ['東京', 'たい'],
			},
			{
				text: '東京はない',
				expected: ['東京', 'は', 'ない'],
			},
			{
				text: '東京たら',
				expected: ['東京', 'たら'],
			},
			{
				text: '問題がある',
				expected: ['問題', 'が', 'ある'],
			},
		];

		for (const chunkCase of cases) {
			const without = tokenizeSurfaces(withoutChunker, chunkCase.text);
			const withChunkerResult = tokenizeSurfaces(withChunker, chunkCase.text);
			expect(without).toEqual(chunkCase.expected);
			expect(withChunkerResult).toEqual(chunkCase.expected);
		}
	});

	test('prefers learner-friendly grammar chunks over dictionary-fragmented tokens', () => {
		const cases: Array<{
			text: string;
			expectedWithChunker: string[];
		}> = [
			{ text: 'かもしれない', expectedWithChunker: ['かもしれない'] },
			{
				text: '進めなくなってしまう',
				expectedWithChunker: ['進めなくなってしまう'],
			},
			{ text: '食べてない', expectedWithChunker: ['食べてない'] },
			{ text: '行かなくちゃ', expectedWithChunker: ['行かなくちゃ'] },
			{ text: '食べなきゃいけない', expectedWithChunker: ['食べなきゃいけない'] },
			{ text: '食べなきゃ行けない', expectedWithChunker: ['食べなきゃ行けない'] },
			{ text: '食べなきゃならない', expectedWithChunker: ['食べなきゃならない'] },
			{ text: '食べなくちゃいけない', expectedWithChunker: ['食べなくちゃいけない'] },
			{ text: '食べなくちゃ行けない', expectedWithChunker: ['食べなくちゃ行けない'] },
			{ text: '食べなくちゃならない', expectedWithChunker: ['食べなくちゃならない'] },
			{
				text: '感謝してもしきれない',
				expectedWithChunker: ['感謝しても', 'しきれない'],
			},
			{ text: 'マトモじゃいれない', expectedWithChunker: ['マトモじゃいれない'] },
			{
				text: 'やらなくてはいけない',
				expectedWithChunker: ['やらなくてはいけない'],
			},
			{
				text: 'やらなければならない',
				expectedWithChunker: ['やらなければならない'],
			},
			{ text: '見ていられない', expectedWithChunker: ['見ていられない'] },
			{ text: 'やってられない', expectedWithChunker: ['やってられない'] },
			{ text: 'やらざるを得ない', expectedWithChunker: ['やらざるを得ない'] },
			{ text: '食べないといけない', expectedWithChunker: ['食べないといけない'] },
			{ text: 'それは仕方がない', expectedWithChunker: ['それ', 'は', '仕方がない'] },
			{ text: '行かなければいけない', expectedWithChunker: ['行かなければいけない'] },
			{ text: '飲んでもいい', expectedWithChunker: ['飲んでもいい'] },
			{ text: '見てはいけない', expectedWithChunker: ['見てはいけない'] },
			{ text: '何もできない', expectedWithChunker: ['何も', 'できない'] },
			{ text: 'できるようになる', expectedWithChunker: ['できるようになる'] },
			{ text: '雨で行けない', expectedWithChunker: ['雨', 'で', '行けない'] },
			{
				text: '時間がなくてできない',
				expectedWithChunker: ['時間', 'が', 'なく', 'て', 'できない'],
			},
			{ text: '大丈夫ではない', expectedWithChunker: ['大丈夫', 'ではない'] },
			{ text: 'できればいい', expectedWithChunker: ['できればいい'] },
			{ text: '行かなくてもいい', expectedWithChunker: ['行かなくてもいい'] },
			{
				text: '面白おもしろくないの作つくったらホントに馬鹿ばかにされてオモチャにされますよ',
				expectedWithChunker: [
					'面白おもしろくない',
					'の',
					'作つくったら',
					'ホントに',
					'馬鹿ばかにされて',
					'オモチャにされますよ',
				],
			},
		];

		for (const chunkCase of cases) {
			const without = tokenizeSurfaces(withoutChunker, chunkCase.text);
			const withChunkerResult = tokenizeSurfaces(withChunker, chunkCase.text);
			expect(withChunkerResult).toEqual(chunkCase.expectedWithChunker);
			expect(withChunkerResult.length).toBeLessThan(without.length);
		}
	});

	test('handles 2000 adversarial obligation/chunking sentences with system.dic', () => {
		const cases = createAdversarialChunkCases();
		expect(cases.length).toBe(2000);

		const failures: string[] = [];
		for (const chunkCase of cases) {
			const without = tokenizeSurfaces(withoutChunker, chunkCase.text);
			const withChunkerResult = tokenizeSurfaces(withChunker, chunkCase.text);
			if (!withChunkerResult.includes(chunkCase.expectedChunk)) {
				failures.push(
					`missing chunk "${chunkCase.expectedChunk}" for "${chunkCase.text}" ` +
						`with=${JSON.stringify(withChunkerResult)} without=${JSON.stringify(without)}`,
				);
			}
			if (withChunkerResult.length > without.length) {
				failures.push(
					`token count regression for "${chunkCase.text}" ` +
						`with=${withChunkerResult.length} without=${without.length}`,
				);
			}
			if (failures.length >= 20) {
				break;
			}
		}

		expect(failures).toEqual([]);
	});
});

