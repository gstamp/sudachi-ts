import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Config } from '../../src/config/config.js';
import type { Grammar, Lexicon } from '../../src/index.js';
import { DictionaryFactory, SplitMode } from '../../src/index.js';
import { systemBuilder, userBuilder } from '../../src/dictionary-build/dicBuilder.js';

async function loadFixture(path: string): Promise<string> {
	return await readFile(path, 'utf8');
}

describe('Public dictionary API', () => {
	let tempDir = '';
	let configPath = '';

	beforeAll(async () => {
		tempDir = await mkdtemp(join(tmpdir(), 'sudachi-public-api-'));

		const [lex, matrix, user] = await Promise.all([
			loadFixture('./test/fixtures/dict/lex.csv'),
			loadFixture('./test/fixtures/dict/matrix.def'),
			loadFixture('./test/fixtures/dict/user.csv'),
		]);

		const system = systemBuilder();
		await system.matrix(matrix);
		await system.lexicon(lex, 'lex.csv');
		const { buffer: systemBuffer } = await system.build();
		await writeFile(join(tempDir, 'system.dic'), Buffer.from(systemBuffer));

		const systemDictionary = await new DictionaryFactory().create(
			undefined,
			Config.parse(
				JSON.stringify({
					systemDict: join(tempDir, 'system.dic'),
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
				}),
			),
		);

		const userDictionaryBuilder = userBuilder(systemDictionary);
		await userDictionaryBuilder.lexicon(user, 'user.csv');
		const { buffer: userBuffer } = await userDictionaryBuilder.build();
		await writeFile(join(tempDir, 'user.dic'), Buffer.from(userBuffer));

		configPath = join(tempDir, 'sudachi.json');
		await writeFile(
			configPath,
			JSON.stringify(
				{
					systemDict: 'system.dic',
					userDict: ['user.dic'],
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

	test('DictionaryFactory exposes grammar and lexicon via package root API', async () => {
		const dictionary = await new DictionaryFactory().create(configPath);
		const grammar: Grammar = dictionary.getGrammar();
		const lexicon: Lexicon = dictionary.getLexicon();

		expect(grammar.getPartOfSpeechSize()).toBeGreaterThan(0);

		const kyotoId = lexicon.getWordId('京都', 3, 'キョウト');
		expect(kyotoId).toBeGreaterThanOrEqual(0);

		const wordInfo = lexicon.getWordInfo(kyotoId);
		expect(wordInfo.getReadingForm()).toBe('キョウト');
		expect(wordInfo.getSynonymGroupIds().length).toBeGreaterThan(0);
	});

	test('public lexicon access includes merged user dictionaries', async () => {
		const dictionary = await new DictionaryFactory().create(configPath);
		const tokenizer = dictionary.create();
		const token = tokenizer.tokenize(SplitMode.C, 'ぴらる').get(0);

		expect(token).toBeDefined();

		const wordId = dictionary
			.getLexicon()
			.getWordId('ぴらる', token!.partOfSpeechId(), token!.readingForm());

		expect(token?.surface()).toBe('ぴらる');
		expect(token?.getDictionaryId()).toBe(1);
		expect(wordId).toBeGreaterThanOrEqual(0);
		expect(dictionary.getLexicon().getWordInfo(wordId).getSurface()).toBe(
			'ぴらる',
		);
	});
});
