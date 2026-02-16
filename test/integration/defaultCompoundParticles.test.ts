import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { SplitMode } from '../../src/core/tokenizer.js';
import { DictionaryFactory } from '../../src/dictionary/dictionaryFactory.js';
import { systemBuilder } from '../../src/dictionary-build/dicBuilder.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TEST_LEXICON = `もう,0,0,5000,もう,副詞,*,*,*,*,*,モウ,もう,*,A,*,*,*,*
死ぬ,0,0,5000,死ぬ,動詞,一般,*,*,*,*,シヌ,死ぬ,*,A,*,*,*,*
まで,0,0,5000,まで,助詞,副助詞,*,*,*,*,マデ,まで,*,A,*,*,*,*
良く,0,0,5000,良く,副詞,*,*,*,*,*,ヨク,良く,*,A,*,*,*,*
ならない,0,0,5000,ならない,動詞,一般,*,*,*,*,ナラナイ,ならない,*,A,*,*,*,*
か,0,0,5000,か,助詞,終助詞,*,*,*,*,カ,か,*,A,*,*,*,*
も,0,0,5000,も,助詞,係助詞,*,*,*,*,モ,も,*,A,*,*,*,*
って,0,0,5000,って,助詞,格助詞,*,*,*,*,ッテ,って,*,A,*,*,*,*
感じ,0,0,5000,感じ,名詞,普通名詞,一般,*,*,*,カンジ,感じ,*,A,*,*,*,*
私,0,0,5000,私,代名詞,*,*,*,*,*,ワタシ,私,*,A,*,*,*,*
の,0,0,5000,の,助詞,格助詞,*,*,*,*,ノ,の,*,A,*,*,*,*
舌,0,0,5000,舌,名詞,普通名詞,一般,*,*,*,シタ,舌,*,A,*,*,*,*
が,0,0,5000,が,助詞,格助詞,*,*,*,*,ガ,が,*,A,*,*,*,*
おかしい,0,0,5000,おかしい,形容詞,一般,*,*,*,*,オカシイ,おかしい,*,A,*,*,*,*
味,0,0,5000,味,名詞,普通名詞,一般,*,*,*,アジ,味,*,A,*,*,*,*
しない,0,0,5000,しない,動詞,一般,*,*,*,*,シナイ,しない,*,A,*,*,*,*
最後,0,0,5000,最後,名詞,普通名詞,一般,*,*,*,サイゴ,最後,*,A,*,*,*,*
だ,0,0,5000,だ,助動詞,*,*,*,*,*,ダ,だ,*,A,*,*,*,*
から,0,0,5000,から,助詞,接続助詞,*,*,*,*,カラ,から,*,A,*,*,*,*
`;

describe('Default compound particles in DictionaryFactory', () => {
	let tempDir = '';
	let configWithCompounds = '';
	let configWithoutCompounds = '';

	beforeAll(async () => {
		tempDir = await mkdtemp(join(tmpdir(), 'sudachi-compounds-'));
		const matrix = await readFile(
			join(__dirname, '..', 'fixtures', 'dict', 'matrix.def'),
			'utf-8',
		);

		const builder = systemBuilder();
		await builder.matrix(matrix);
		await builder.lexicon(TEST_LEXICON, 'default-compound-system.csv');
		const { buffer } = await builder.build();
		await writeFile(join(tempDir, 'system.dic'), Buffer.from(buffer));

		configWithCompounds = join(tempDir, 'sudachi-with-compounds.json');
		configWithoutCompounds = join(tempDir, 'sudachi-no-compounds.json');

		const baseConfig = {
			systemDict: 'system.dic',
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
			configWithCompounds,
			JSON.stringify(
				{ ...baseConfig, enableDefaultCompoundParticles: true },
				null,
				2,
			),
		);
		await writeFile(
			configWithoutCompounds,
			JSON.stringify(
				{ ...baseConfig, enableDefaultCompoundParticles: false },
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

	test('tokenizes かも and のか as single words in context', async () => {
		const dictionary = await new DictionaryFactory().create(configWithCompounds);
		const tokenizer = dictionary.create();

		const maybeTokens = [...tokenizer.tokenize(SplitMode.C, 'もう死ぬまで良くならないかもって感じ')].map(
			(m) => m.surface(),
		);
		expect(maybeTokens).toContain('かも');

		const nokaTokens = [...tokenizer.tokenize(SplitMode.C, '私の舌がおかしいのか味がしない')].map(
			(m) => m.surface(),
		);
		expect(nokaTokens).toContain('のか');
	});

	test('tokenizes だから as a single word in context', async () => {
		const dictionary = await new DictionaryFactory().create(configWithCompounds);
		const tokenizer = dictionary.create();

		const surfaces = [...tokenizer.tokenize(SplitMode.C, '最後だから')].map((m) =>
			m.surface(),
		);
		expect(surfaces).toEqual(['最後', 'だから']);
	});

	test('does not over-merge trailing tokens around かも', async () => {
		const dictionary = await new DictionaryFactory().create(configWithCompounds);
		const tokenizer = dictionary.create();
		const surfaces = [...tokenizer.tokenize(SplitMode.C, 'かもって')].map((m) =>
			m.surface(),
		);
		expect(surfaces).toEqual(['かも', 'って']);
	});

	test('keeps compounds as single tokens in A/B/C modes', async () => {
		const dictionary = await new DictionaryFactory().create(configWithCompounds);
		const tokenizer = dictionary.create();

		for (const mode of [SplitMode.A, SplitMode.B, SplitMode.C]) {
			expect(
				[...tokenizer.tokenize(mode, 'かも')].map((m) => m.surface()),
			).toEqual(['かも']);
			expect(
				[...tokenizer.tokenize(mode, 'のか')].map((m) => m.surface()),
			).toEqual(['のか']);
			expect(
				[...tokenizer.tokenize(mode, 'だから')].map((m) => m.surface()),
			).toEqual(['だから']);
		}
	});

	test('respects config toggle and falls back to baseline splitting', async () => {
		const dictionary = await new DictionaryFactory().create(configWithoutCompounds);
		const tokenizer = dictionary.create();

		const surfaces = [...tokenizer.tokenize(SplitMode.C, '最後だから')].map((m) =>
			m.surface(),
		);
		expect(surfaces).toEqual(['最後', 'だ', 'から']);
	});
});
