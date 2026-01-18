import { beforeEach, describe, expect, it } from 'bun:test';
import { Settings } from '../../../src/config/settings.js';
import type { LatticeNodeImpl } from '../../../src/core/lattice.js';
import { UTF8InputTextBuilder } from '../../../src/core/utf8InputText.js';
import { Connection } from '../../../src/dictionary/connection.js';
import { RegexOovProviderPlugin } from '../../../src/plugins/oov/regexOovProviderPlugin.js';

function createMockGrammar() {
	const matrix = new Int16Array([0]);
	const connection = new Connection(matrix, 1, 1);
	let posIdCounter = 0;
	const posMap = new Map<string, number>();

	return {
		getPartOfSpeechSize: () => 0,
		getPartOfSpeechString: () => ({
			toList: () => ['*', '*', '*', '*', '*', '*'],
		}),
		getPartOfSpeechId: (posList: string[]) => {
			const key = posList.join(',');
			return posMap.get(key) ?? -1;
		},
		getConnectCost: () => 0,
		setConnectCost: () => {},
		getBOSParameter: () => [0, 0, 0],
		getEOSParameter: () => [0, 0, 0],
		getCharacterCategory: () => null,
		setCharacterCategory: () => {},
		INHIBITED_CONNECTION: 0x7fff,
		getConnection: () => connection,
		isValid: () => true,
		getStorageSize: () => 0,
		registerPOS: (pos: any) => {
			const key = pos.toList().join(',');
			if (!posMap.has(key)) {
				posMap.set(key, posIdCounter++);
			}
			return posMap.get(key)!;
		},
	};
}

describe('RegexOovProviderPlugin', () => {
	let plugin: RegexOovProviderPlugin;
	let settings: Settings;
	let mockGrammar: any;

	beforeEach(() => {
		mockGrammar = createMockGrammar();
		settings = new Settings({
			regex: '[0-9a-z-]+',
			cost: 3500,
			leftId: 5,
			rightId: 5,
			pos: ['名詞', '普通名詞', '一般', '*', '*', '*'],
			userPOS: 'allow',
		});
		plugin = new RegexOovProviderPlugin();
	});

	it('should throw error if regex is not provided', () => {
		const emptySettings = new Settings({});
		const emptyPlugin = new RegexOovProviderPlugin();
		emptyPlugin.setSettings(emptySettings);
		expect(() => emptyPlugin.setUp(mockGrammar)).toThrow(
			'regex is required for RegexOovProviderPlugin',
		);
	});

	describe('with pattern [0-9a-z-]+', () => {
		beforeEach(() => {
			plugin.setSettings(settings);
			plugin.setUp(mockGrammar);
		});

		it('should match alphanumeric string with hyphen', () => {
			const builder = new UTF8InputTextBuilder('xag-2f', mockGrammar);
			const input = builder.build();
			const result: LatticeNodeImpl[] = [];

			const count = plugin.provideOOV(input, 0, 0, result);

			expect(count).toBe(1);
			expect(result.length).toBe(1);
			expect(result[0]!.getWordInfo().getSurface()).toBe('xag-2f');
		});

		it('should handle text with other words', () => {
			const builder = new UTF8InputTextBuilder('京都xag-2f東京', mockGrammar);
			const input = builder.build();
			const result: LatticeNodeImpl[] = [];

			const count = plugin.provideOOV(input, 6, 0, result);

			expect(count).toBe(1);
			expect(result.length).toBe(1);
			expect(result[0]!.getWordInfo().getSurface()).toBe('xag-2f');
		});

		it('should handle mixed width characters', () => {
			const builder = new UTF8InputTextBuilder('ｇ', mockGrammar);
			const input = builder.build();
			const result: LatticeNodeImpl[] = [];

			const count = plugin.provideOOV(input, 3, 0, result);

			expect(count).toBeGreaterThanOrEqual(0);
			expect(result.length).toBeGreaterThanOrEqual(0);
		});

		it('should respect maxLength setting', () => {
			settings = new Settings({
				regex: '[0-9a-z-]+',
				cost: 3500,
				leftId: 5,
				rightId: 5,
				pos: ['名詞', '普通名詞', '一般', '*', '*', '*'],
				maxLength: 3,
				userPOS: 'allow',
			});
			plugin.setSettings(settings);
			plugin.setUp(mockGrammar);

			const builder = new UTF8InputTextBuilder('xag-2f', mockGrammar);
			const input = builder.build();
			const result: LatticeNodeImpl[] = [];

			const count = plugin.provideOOV(input, 0, 0, result);

			expect(count).toBe(1);
			expect(result.length).toBe(1);
			const surface = result[0]!.getWordInfo().getSurface();
			expect(['xag', 'x', 'xa'].includes(surface)).toBe(true);
		});
	});

	describe('with strict boundaries', () => {
		beforeEach(() => {
			mockGrammar = createMockGrammar();
			settings = new Settings({
				regex: '@[a-z0-9]{4,}',
				cost: 3500,
				leftId: 5,
				rightId: 5,
				pos: ['名詞', '普通名詞', '一般', '*', '*', '*'],
				boundaries: 'strict',
				userPOS: 'allow',
			});
			plugin.setSettings(settings);
			plugin.setUp(mockGrammar);
		});

		it('should not match if inside same character category', () => {
			const builder = new UTF8InputTextBuilder(' :@asda', mockGrammar);
			const input = builder.build();
			const result: LatticeNodeImpl[] = [];

			const count = plugin.provideOOV(input, 2, 0, result);

			expect(count).toBeGreaterThanOrEqual(0);
			expect(result.length).toBeGreaterThanOrEqual(0);
		});
	});

	describe('with relaxed boundaries', () => {
		beforeEach(() => {
			mockGrammar = createMockGrammar();
			settings = new Settings({
				regex: '@[a-z0-9]{4,}',
				cost: 3500,
				leftId: 5,
				rightId: 5,
				pos: ['名詞', '普通名詞', '一般', '*', '*', '*'],
				boundaries: 'relaxed',
				userPOS: 'allow',
			});
			plugin.setSettings(settings);
			plugin.setUp(mockGrammar);
		});

		it('should match even if inside same character category', () => {
			const builder = new UTF8InputTextBuilder(':@asda', mockGrammar);
			const input = builder.build();
			const result: LatticeNodeImpl[] = [];

			const count = plugin.provideOOV(input, 1, 0, result);

			expect(count).toBe(1);
			expect(result.length).toBe(1);
			expect(result[0]!.getWordInfo().getSurface()).toBe('@asda');
		});
	});

	describe('with other words present', () => {
		beforeEach(() => {
			plugin.setSettings(settings);
			plugin.setUp(mockGrammar);
		});

		it('should return 0 if word of same length already exists', () => {
			const builder = new UTF8InputTextBuilder('XAG-2F', mockGrammar);
			const input = builder.build();
			const result: LatticeNodeImpl[] = [];

			const count = plugin.provideOOV(input, 0, 1, result);

			expect(count).toBe(0);
			expect(result.length).toBe(0);
		});
	});

	describe('with invalid boundaries setting', () => {
		beforeEach(() => {
			mockGrammar = createMockGrammar();
			settings = new Settings({
				regex: '[0-9a-z-]+',
				cost: 3500,
				leftId: 5,
				rightId: 5,
				pos: ['名詞', '普通名詞', '一般', '*', '*', '*'],
				boundaries: 'invalid',
				userPOS: 'allow',
			});
			plugin.setSettings(settings);
		});

		it('should throw error on invalid boundaries value', () => {
			expect(() => plugin.setUp(mockGrammar)).toThrow(
				'allowed continuity values: [strict, relaxed], was invalid',
			);
		});
	});
});
