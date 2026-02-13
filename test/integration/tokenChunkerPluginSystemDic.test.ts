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
});

