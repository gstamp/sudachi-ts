import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { Config } from '../../src/config/config.js';
import { DictionaryFactory } from '../../src/dictionary/dictionaryFactory.js';
import { SplitMode } from '../../src/core/tokenizer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('TargetedConnectionCostPlugin', () => {
	test('can bias いなか + の over the exact いなかの entry', async () => {
		const dictionary = await new DictionaryFactory().create(
			undefined,
			Config.parse(
				JSON.stringify({
					systemDict: join(__dirname, '..', '..', 'resources', 'system.dic'),
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
					editConnectionCostPlugin: [
						{
							class: 'com.worksap.nlp.sudachi.TargetedConnectionCostPlugin',
							rules: [
								{
									left: {
										surface: 'いなか',
										pos: ['名詞', '普通名詞', '一般', '*', '*', '*'],
										reading: 'イナカ',
									},
									right: {
										surface: 'の',
										pos: ['助詞', '格助詞', '*', '*', '*', '*'],
										reading: 'ノ',
									},
									cost: -3000,
								},
							],
						},
					],
				}),
			),
		);

		const tokenizer = dictionary.create();
		const surfaces = [...tokenizer.tokenize(
			SplitMode.C,
			'むかしは、いなかの家に住んでいました。',
		)].map((m) => m.surface());

		expect(surfaces).toEqual([
			'むかし',
			'は',
			'、',
			'いなか',
			'の',
			'家',
			'に',
			'住ん',
			'で',
			'い',
			'まし',
			'た',
			'。',
		]);
	});
});
