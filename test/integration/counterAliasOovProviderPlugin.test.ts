import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { Config } from '../../src/config/config.js';
import { SplitMode } from '../../src/core/tokenizer.js';
import { DictionaryFactory } from '../../src/dictionary/dictionaryFactory.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SYSTEM_DIC_PATH = join(
	__dirname,
	'..',
	'..',
	'resources',
	'system.dic',
);

const describeIfSystemDic = existsSync(SYSTEM_DIC_PATH)
	? describe
	: describe.skip;

describeIfSystemDic('CounterAliasOovProviderPlugin', () => {
	test('tokenizes numeric kana counters before polite auxiliaries', async () => {
		const config = Config.parse(
			JSON.stringify({
				systemDict: SYSTEM_DIC_PATH,
				oovProviderPlugin: [
					{
						class: 'com.worksap.nlp.sudachi.CounterAliasOovProviderPlugin',
					},
					{
						class: 'com.worksap.nlp.sudachi.SimpleOovProviderPlugin',
						oovPOS: ['名詞', '普通名詞', '一般', '*', '*', '*'],
						leftId: 0,
						rightId: 0,
						cost: 30000,
					},
				],
				pathRewritePlugin: [{ class: 'com.worksap.nlp.sudachi.JoinNumericPlugin' }],
			}),
		);

		const dictionary = await new DictionaryFactory().create(undefined, config);
		const tokenizer = dictionary.create();
		const morphemes = [...tokenizer.tokenize(SplitMode.C, 'りんごを1こください。')];

		expect(morphemes.map((m) => m.surface())).toEqual([
			'りんご',
			'を',
			'1',
			'こ',
			'ください',
			'。',
		]);
		expect(morphemes.map((m) => m.normalizedForm())).toEqual([
			'林檎',
			'を',
			'1',
			'個',
			'下さる',
			'。',
		]);
		expect(morphemes[3]?.partOfSpeech()).toEqual([
			'接尾辞',
			'名詞的',
			'助数詞',
			'*',
			'*',
			'*',
		]);
	});
});
