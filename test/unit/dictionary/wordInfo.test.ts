import { beforeEach, describe, expect, test } from 'bun:test';
import { WordInfo } from '../../../src/dictionary/wordInfo.js';

describe('WordInfo', () => {
	describe('constructor with full parameters', () => {
		test('should create word info with all parameters', () => {
			const wordInfo = new WordInfo(
				'東京',
				2,
				1,
				'東京',
				-1,
				'東京',
				'トウキョウ',
				[0, 1],
				[0, 1],
				[0, 1],
				[1, 2, 3],
			);

			expect(wordInfo.getSurface()).toBe('東京');
			expect(wordInfo.getLength()).toBe(2);
			expect(wordInfo.getPOSId()).toBe(1);
			expect(wordInfo.getNormalizedForm()).toBe('東京');
			expect(wordInfo.getDictionaryFormWordId()).toBe(-1);
			expect(wordInfo.getDictionaryForm()).toBe('東京');
			expect(wordInfo.getReadingForm()).toBe('トウキョウ');
			expect(wordInfo.getAunitSplit()).toEqual([0, 1]);
			expect(wordInfo.getBunitSplit()).toEqual([0, 1]);
			expect(wordInfo.getWordStructure()).toEqual([0, 1]);
			expect(wordInfo.getSynonymGroupIds()).toEqual([1, 2, 3]);
		});
	});

	describe('constructor with minimal parameters', () => {
		test('should create word info with minimal parameters', () => {
			const wordInfo = new WordInfo('東京', 2, 1, '東京', '東京', 'トウキョウ');

			expect(wordInfo.getSurface()).toBe('東京');
			expect(wordInfo.getLength()).toBe(2);
			expect(wordInfo.getPOSId()).toBe(1);
			expect(wordInfo.getNormalizedForm()).toBe('東京');
			expect(wordInfo.getDictionaryFormWordId()).toBe(-1);
			expect(wordInfo.getDictionaryForm()).toBe('東京');
			expect(wordInfo.getReadingForm()).toBe('トウキョウ');
			expect(wordInfo.getAunitSplit()).toEqual([]);
			expect(wordInfo.getBunitSplit()).toEqual([]);
			expect(wordInfo.getWordStructure()).toEqual([]);
			expect(wordInfo.getSynonymGroupIds()).toEqual([]);
		});
	});

	describe('getters', () => {
		let wordInfo: WordInfo;

		beforeEach(() => {
			wordInfo = new WordInfo(
				'日本語',
				3,
				2,
				'日本語',
				-1,
				'日本語',
				'ニホンゴ',
				[0],
				[0, 1],
				[0, 1, 2],
				[10, 20],
			);
		});

		test('should get surface', () => {
			expect(wordInfo.getSurface()).toBe('日本語');
		});

		test('should get length', () => {
			expect(wordInfo.getLength()).toBe(3);
		});

		test('should get POS id', () => {
			expect(wordInfo.getPOSId()).toBe(2);
		});

		test('should get normalized form', () => {
			expect(wordInfo.getNormalizedForm()).toBe('日本語');
		});

		test('should get dictionary form word id', () => {
			expect(wordInfo.getDictionaryFormWordId()).toBe(-1);
		});

		test('should get dictionary form', () => {
			expect(wordInfo.getDictionaryForm()).toBe('日本語');
		});

		test('should get reading form', () => {
			expect(wordInfo.getReadingForm()).toBe('ニホンゴ');
		});

		test('should get a unit split', () => {
			expect(wordInfo.getAunitSplit()).toEqual([0]);
		});

		test('should get b unit split', () => {
			expect(wordInfo.getBunitSplit()).toEqual([0, 1]);
		});

		test('should get word structure', () => {
			expect(wordInfo.getWordStructure()).toEqual([0, 1, 2]);
		});

		test('should get synonym group ids', () => {
			expect(wordInfo.getSynonymGroupIds()).toEqual([10, 20]);
		});
	});

	describe('setPOSId', () => {
		test('should set POS id', () => {
			const wordInfo = new WordInfo('test', 4, 5, 'test', 'test', 'test');
			expect(wordInfo.getPOSId()).toBe(5);

			wordInfo.setPOSId(10);
			expect(wordInfo.getPOSId()).toBe(10);
		});
	});

	describe('edge cases', () => {
		test('should handle empty string surface', () => {
			const wordInfo = new WordInfo('', 0, 0, '', '', '');
			expect(wordInfo.getSurface()).toBe('');
			expect(wordInfo.getLength()).toBe(0);
		});

		test('should handle zero length', () => {
			const wordInfo = new WordInfo('test', 0, 0, 'test', 'test', 'test');
			expect(wordInfo.getLength()).toBe(0);
		});

		test('should handle large synonym group ids', () => {
			const largeIds = [1000000, 2000000, 3000000];
			const wordInfo = new WordInfo(
				'test',
				4,
				1,
				'test',
				-1,
				'test',
				'test',
				[],
				[],
				[],
				largeIds,
			);
			expect(wordInfo.getSynonymGroupIds()).toEqual(largeIds);
		});

		test('should handle empty split arrays', () => {
			const wordInfo = new WordInfo(
				'test',
				4,
				1,
				'test',
				-1,
				'test',
				'test',
				[],
				[],
				[],
				[],
			);
			expect(wordInfo.getAunitSplit()).toEqual([]);
			expect(wordInfo.getBunitSplit()).toEqual([]);
			expect(wordInfo.getWordStructure()).toEqual([]);
			expect(wordInfo.getSynonymGroupIds()).toEqual([]);
		});

		test('should handle dictionary form word id', () => {
			const wordInfo = new WordInfo(
				'test',
				4,
				1,
				'test',
				123,
				'test',
				'test',
				[],
				[],
				[],
				[],
			);
			expect(wordInfo.getDictionaryFormWordId()).toBe(123);
		});
	});

	describe('different surface and normalized form', () => {
		test('should handle different surface and normalized form', () => {
			const wordInfo = new WordInfo('㍻', 1, 1, '平成', '平成', 'ヘイセイ');

			expect(wordInfo.getSurface()).toBe('㍻');
			expect(wordInfo.getNormalizedForm()).toBe('平成');
		});
	});

	describe('complex word structure', () => {
		test('should handle complex word structure arrays', () => {
			const wordInfo = new WordInfo(
				'東京都',
				3,
				1,
				'東京都',
				-1,
				'東京',
				'トウキョウ',
				[0, 1, 2],
				[0, 2],
				[0, 1, 2, 3],
				[1, 2, 3, 4, 5],
			);

			expect(wordInfo.getAunitSplit()).toEqual([0, 1, 2]);
			expect(wordInfo.getBunitSplit()).toEqual([0, 2]);
			expect(wordInfo.getWordStructure()).toEqual([0, 1, 2, 3]);
			expect(wordInfo.getSynonymGroupIds()).toEqual([1, 2, 3, 4, 5]);
		});
	});
});
