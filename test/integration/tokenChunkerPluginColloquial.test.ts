import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SplitMode } from '../../src/core/tokenizer.js';
import { DictionaryFactory } from '../../src/dictionary/dictionaryFactory.js';
import { systemBuilder } from '../../src/dictionary-build/dicBuilder.js';

const TEST_LEXICON = `僕,0,0,5000,僕,代名詞,*,*,*,*,*,ボク,僕,*,A,*,*,*,*
じゃ,0,0,5000,じゃ,助詞,係助詞,*,*,*,*,ジャ,じゃ,*,A,*,*,*,*
ない,0,0,5000,ない,助動詞,*,*,*,*,*,ナイ,ない,*,A,*,*,*,*
方,0,0,5000,方,名詞,普通名詞,一般,*,*,*,ホウ,方,*,A,*,*,*,*
が,0,0,5000,が,助詞,格助詞,*,*,*,*,ガ,が,*,A,*,*,*,*
いい,0,0,5000,いい,形容詞,一般,*,*,*,*,イイ,いい,*,A,*,*,*,*
悪く,0,0,5000,悪く,形容詞,一般,*,*,*,*,ワルク,悪い,*,A,*,*,*,*
は,0,0,5000,は,助詞,係助詞,*,*,*,*,ハ,は,*,A,*,*,*,*
何,0,0,5000,何,代名詞,*,*,*,*,*,ナニ,何,*,A,*,*,*,*
で,0,0,5000,で,助詞,格助詞,*,*,*,*,デ,で,*,A,*,*,*,*
見,0,0,5000,見,動詞,一般,*,*,*,*,ミ,見る,*,A,*,*,*,*
たい,0,0,5000,たい,助動詞,*,*,*,*,*,タイ,たい,*,A,*,*,*,*
食べ,0,0,5000,食べ,動詞,一般,*,*,*,*,タベ,食べる,*,A,*,*,*,*
て,0,0,5000,て,助詞,接続助詞,*,*,*,*,テ,て,*,A,*,*,*,*
泣い,0,0,5000,泣い,動詞,一般,*,*,*,*,ナイ,泣く,*,A,*,*,*,*
ん,0,0,5000,ん,助詞,終助詞,*,*,*,*,ン,ん,*,A,*,*,*,*
言っ,0,0,5000,言っ,動詞,一般,*,*,*,*,イッ,言う,*,A,*,*,*,*
ちゃう,0,0,5000,ちゃう,動詞,一般,*,*,*,*,チャウ,ちゃう,*,A,*,*,*,*
行か,0,0,5000,行か,動詞,一般,*,*,*,*,イカ,行く,*,A,*,*,*,*
なきゃ,0,0,5000,なきゃ,助詞,*,*,*,*,*,ナキャ,なきゃ,*,A,*,*,*,*
なく,0,0,5000,なく,助動詞,*,*,*,*,*,ナク,なく,*,A,*,*,*,*
ちゃ,0,0,5000,ちゃ,助詞,*,*,*,*,*,チャ,ちゃ,*,A,*,*,*,*
しょ,0,0,5000,しょ,助動詞,*,*,*,*,*,ショ,しょ,*,A,*,*,*,*
もう,0,0,5000,もう,副詞,*,*,*,*,*,モウ,もう,*,A,*,*,*,*
もー,0,0,5000,もー,副詞,*,*,*,*,*,モー,もー,*,A,*,*,*,*
一,0,0,5000,一,名詞,数詞,*,*,*,*,イチ,一,*,A,*,*,*,*
いっ,0,0,5000,いっ,名詞,数詞,*,*,*,*,イッ,いっ,*,A,*,*,*,*
回,0,0,5000,回,名詞,普通名詞,一般,*,*,*,カイ,回,*,A,*,*,*,*
かい,0,0,5000,かい,名詞,普通名詞,一般,*,*,*,カイ,かい,*,A,*,*,*,*
東京,0,0,5000,東京,名詞,普通名詞,一般,*,*,*,トウキョウ,東京,*,A,*,*,*,*
日,0,0,5000,日,名詞,普通名詞,一般,*,*,*,ニチ,日,*,A,*,*,*,*
`;

async function tokenizeSurfaces(
	configPath: string,
	text: string,
): Promise<string[]> {
	const dictionary = await new DictionaryFactory().create(configPath);
	const tokenizer = dictionary.create();
	return [...tokenizer.tokenize(SplitMode.C, text)].map((m) => m.surface());
}

describe('TokenChunkerPlugin colloquial integration', () => {
	let tempDir = '';
	let configWithChunker = '';
	let configWithoutChunker = '';

	beforeAll(async () => {
		tempDir = await mkdtemp(join(tmpdir(), 'sudachi-chunker-colloquial-'));
		const matrix = await readFile(
			`${import.meta.dir}/../fixtures/dict/matrix.def`,
			'utf-8',
		);

		const builder = systemBuilder();
		await builder.matrix(matrix);
		await builder.lexicon(TEST_LEXICON, 'chunker-colloquial-system.csv');
		const { buffer } = await builder.build();
		await writeFile(join(tempDir, 'system.dic'), Buffer.from(buffer));

		configWithChunker = join(tempDir, 'sudachi-with-chunker.json');
		configWithoutChunker = join(tempDir, 'sudachi-no-chunker.json');

		const baseConfig = {
			systemDict: 'system.dic',
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

		await writeFile(
			configWithChunker,
			JSON.stringify(
				{
					...baseConfig,
					pathRewritePlugin: [
						{
							class: 'com.worksap.nlp.sudachi.TokenChunkerPlugin',
							enablePatternRules: true,
							enableCompoundNouns: false,
						},
					],
				},
				null,
				2,
			),
		);
		await writeFile(
			configWithoutChunker,
			JSON.stringify(
				{
					...baseConfig,
					pathRewritePlugin: [],
				},
				null,
				2,
			),
		);
	});

	afterAll(async () => {
		if (tempDir.length > 0) {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test('merges colloquial expressions end-to-end with TokenChunkerPlugin', async () => {
		const cases = [
			{
				text: '僕じゃない',
				baseline: ['僕', 'じゃ', 'ない'],
				merged: ['僕じゃない'],
			},
			{
				text: '方がいい',
				baseline: ['方', 'が', 'いい'],
				merged: ['方がいい'],
			},
			{
				text: '悪くはない',
				baseline: ['悪く', 'は', 'ない'],
				merged: ['悪くはない'],
			},
			{ text: '何で', baseline: ['何', 'で'], merged: ['何で'] },
			{ text: '見たい', baseline: ['見', 'たい'], merged: ['見たい'] },
			{
				text: '食べてない',
				baseline: ['食べ', 'て', 'ない'],
				merged: ['食べてない'],
			},
			{
				text: '泣いてん',
				baseline: ['泣い', 'て', 'ん'],
				merged: ['泣いてん'],
			},
			{
				text: '言っちゃう',
				baseline: ['言っ', 'ちゃう'],
				merged: ['言っちゃう'],
			},
			{
				text: '食べなきゃ',
				baseline: ['食べ', 'なきゃ'],
				merged: ['食べなきゃ'],
			},
			{
				text: '行かなくちゃ',
				baseline: ['行か', 'なく', 'ちゃ'],
				merged: ['行かなくちゃ'],
			},
			{ text: 'でしょ', baseline: ['で', 'しょ'], merged: ['でしょ'] },
			{
				text: 'もう一回',
				baseline: ['もう', '一', '回'],
				merged: ['もう一回'],
			},
			{
				text: 'もーいっかい',
				baseline: ['もー', 'いっ', 'かい'],
				merged: ['もーいっかい'],
			},
		];

		for (const chunkCase of cases) {
			const withoutChunker = await tokenizeSurfaces(
				configWithoutChunker,
				chunkCase.text,
			);
			const withChunker = await tokenizeSurfaces(
				configWithChunker,
				chunkCase.text,
			);
			expect(withoutChunker).toEqual(chunkCase.baseline);
			expect(withChunker).toEqual(chunkCase.merged);
		}
	});

	test('keeps boundaries where colloquial rules should not apply', async () => {
		const cases = [
			{ text: '東京はない', expected: ['東京', 'は', 'ない'] },
			{ text: '東京たい', expected: ['東京', 'たい'] },
			{ text: 'じゃない', expected: ['じゃ', 'ない'] },
			{ text: '東京なくちゃ', expected: ['東京', 'なく', 'ちゃ'] },
		];

		for (const chunkCase of cases) {
			const withChunker = await tokenizeSurfaces(
				configWithChunker,
				chunkCase.text,
			);
			expect(withChunker).toEqual(chunkCase.expected);
		}
	});
});
