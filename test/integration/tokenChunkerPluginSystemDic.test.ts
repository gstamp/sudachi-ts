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
					enableCompoundNouns: false,
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
				text: 'それで傷ついた',
				without: ['それ', 'で', '傷つい', 'た'],
				with: ['それで', '傷ついた'],
			},
			{
				text: '優太と言ったら有名だ',
				without: ['優太', 'と', '言っ', 'たら', '有名', 'だ'],
				with: ['優太', 'と言ったら', '有名', 'だ'],
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
});
