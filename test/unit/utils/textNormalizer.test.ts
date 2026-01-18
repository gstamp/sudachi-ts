import { describe, test, expect } from 'bun:test';
import { TextNormalizer } from '../../../src/utils/textNormalizer.js';
import { GrammarImpl } from '../../../src/dictionary/grammarImpl.js';
import { CharacterCategory } from '../../../src/dictionary/characterCategory.js';
import { DefaultInputTextPlugin } from '../../../src/plugins/inputText/defaultInputTextPlugin.js';
import type { Grammar } from '../../../src/index.js';
import type { InputTextPlugin } from '../../../src/plugins/inputText/base.js';

function createGrammarWithCharCategory(): Grammar {
	const grammar = new GrammarImpl();
	const charCategory = new CharacterCategory();
	charCategory.readCharacterDefinition(`0x0020 SPACE
0x0041 KATAKANA
0x0061 NUMERIC
0x30A0 KANJI
0x30A1 KANJI
0x30A2 KANJI
0x30A3 KANJI
0x30A4 KANJI
0x30A5 KANJI
0x30A6 KANJI
0x30A7 KANJI
0x30A8 KANJI
0x30A9 KANJI
0x30AA KANJI
0x30AB KANJI`);
	grammar.setCharacterCategory(charCategory);
	return grammar;
}

function createDefaultInputTextPlugin(): DefaultInputTextPlugin {
	const plugin = new DefaultInputTextPlugin();
	plugin.setSettings(Settings.parse('{}'));
	return plugin;
}

import { Settings } from '../../../src/config/settings.js';

describe('TextNormalizer', () => {
	describe('constructor', () => {
		test('should throw error when grammar has no CharacterCategory', () => {
			const grammar = new GrammarImpl();
			const plugins: InputTextPlugin[] = [];

			expect(() => new TextNormalizer(grammar, plugins)).toThrow(
				'grammar for TextNormalizer must have CharacterCategory.',
			);
		});

		test('should accept grammar with CharacterCategory', () => {
			const grammar = createGrammarWithCharCategory();
			const plugin = createDefaultInputTextPlugin();
			plugin.setUp(grammar);

			expect(() => new TextNormalizer(grammar, [plugin])).not.toThrow();
		});
	});

	describe('normalize', () => {
		test('should return original text when no plugins modify it', async () => {
			const grammar = createGrammarWithCharCategory();
			const plugin = createDefaultInputTextPlugin();
			await plugin.setUp(grammar);

			const normalizer = new TextNormalizer(grammar, [plugin]);
			const input = 'こんにちは';
			const result = normalizer.normalize(input);

			expect(result).toBe(input);
		});

		test('should normalize full-width spaces to half-width', async () => {
			const grammar = createGrammarWithCharCategory();
			const plugin = createDefaultInputTextPlugin();
			await plugin.setUp(grammar);

			const normalizer = new TextNormalizer(grammar, [plugin]);
			const input = 'こんにちは　世界';
			const result = normalizer.normalize(input);

			expect(result).not.toContain('　');
		});

		test('should handle empty string', async () => {
			const grammar = createGrammarWithCharCategory();
			const plugin = createDefaultInputTextPlugin();
			await plugin.setUp(grammar);

			const normalizer = new TextNormalizer(grammar, [plugin]);
			const result = normalizer.normalize('');

			expect(result).toBe('');
		});

		test('should handle ASCII text (lowercased by DefaultInputTextPlugin)', async () => {
			const grammar = createGrammarWithCharCategory();
			const plugin = createDefaultInputTextPlugin();
			await plugin.setUp(grammar);

			const normalizer = new TextNormalizer(grammar, [plugin]);
			const input = 'Hello World';
			const result = normalizer.normalize(input);

			expect(result).toBe('hello world');
		});

		test('should handle mixed Japanese and ASCII', async () => {
			const grammar = createGrammarWithCharCategory();
			const plugin = createDefaultInputTextPlugin();
			await plugin.setUp(grammar);

			const normalizer = new TextNormalizer(grammar, [plugin]);
			const input = 'Hello、世界';
			const result = normalizer.normalize(input);

			expect(result).toContain('世界');
		});
	});

	describe('fromDictionary', () => {
		test('should create TextNormalizer from Grammar', async () => {
			const grammar = createGrammarWithCharCategory();
			const normalizer = await TextNormalizer.fromDictionary(grammar);

			expect(normalizer).toBeInstanceOf(TextNormalizer);
		});
	});

	describe('defaultTextNormalizer', () => {
		test('should create default TextNormalizer', async () => {
			const normalizer = await TextNormalizer.defaultTextNormalizer();

			expect(normalizer).toBeInstanceOf(TextNormalizer);
		});

		test('should normalize text with default normalizer', async () => {
			const normalizer = await TextNormalizer.defaultTextNormalizer();
			const input = 'ｋｎｏｗｌｅｄｇｅ';
			const result = normalizer.normalize(input);

			expect(result).not.toContain('ｋ');
		});
	});
});
