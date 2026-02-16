import { describe, expect, test } from 'vitest';
import {
	CategoryType,
	getCategoryTypeById,
} from '../../../src/dictionary/categoryType.js';

describe('CategoryType', () => {
	test('should have correct values for standard categories', () => {
		expect(CategoryType.DEFAULT).toBe(1);
		expect(CategoryType.SPACE).toBe(1 << 1);
		expect(CategoryType.KANJI).toBe(1 << 2);
		expect(CategoryType.SYMBOL).toBe(1 << 3);
		expect(CategoryType.NUMERIC).toBe(1 << 4);
		expect(CategoryType.ALPHA).toBe(1 << 5);
		expect(CategoryType.HIRAGANA).toBe(1 << 6);
		expect(CategoryType.KATAKANA).toBe(1 << 7);
	});

	test('should have correct values for extended categories', () => {
		expect(CategoryType.KANJINUMERIC).toBe(1 << 8);
		expect(CategoryType.GREEK).toBe(1 << 9);
		expect(CategoryType.CYRILLIC).toBe(1 << 10);
	});

	test('should have correct values for user categories', () => {
		expect(CategoryType.USER1).toBe(1 << 11);
		expect(CategoryType.USER2).toBe(1 << 12);
		expect(CategoryType.USER3).toBe(1 << 13);
		expect(CategoryType.USER4).toBe(1 << 14);
	});

	test('should have NOOOVBOW category', () => {
		expect(CategoryType.NOOOVBOW).toBe(1 << 15);
	});

	test('should get category type by valid ID', () => {
		expect(getCategoryTypeById(1)).toBe(CategoryType.DEFAULT);
		expect(getCategoryTypeById(2)).toBe(CategoryType.SPACE);
		expect(getCategoryTypeById(4)).toBe(CategoryType.KANJI);
		expect(getCategoryTypeById(8)).toBe(CategoryType.SYMBOL);
		expect(getCategoryTypeById(16)).toBe(CategoryType.NUMERIC);
	});

	test('should get category type by extended ID', () => {
		expect(getCategoryTypeById(256)).toBe(CategoryType.KANJINUMERIC);
		expect(getCategoryTypeById(512)).toBe(CategoryType.GREEK);
		expect(getCategoryTypeById(1024)).toBe(CategoryType.CYRILLIC);
	});

	test('should get category type by user ID', () => {
		expect(getCategoryTypeById(2048)).toBe(CategoryType.USER1);
		expect(getCategoryTypeById(4096)).toBe(CategoryType.USER2);
		expect(getCategoryTypeById(8192)).toBe(CategoryType.USER3);
		expect(getCategoryTypeById(16384)).toBe(CategoryType.USER4);
	});

	test('should return null for invalid ID', () => {
		expect(getCategoryTypeById(0)).toBeNull();
		expect(getCategoryTypeById(3)).toBeNull();
		expect(getCategoryTypeById(999)).toBeNull();
		expect(getCategoryTypeById(-1)).toBeNull();
	});

	test('should handle bit flag combinations', () => {
		const combined = CategoryType.KANJI | CategoryType.NUMERIC;
		expect(combined).toBe(20);
	});

	test('should check for NOOOVBOW', () => {
		expect(CategoryType.NOOOVBOW).toBe(32768);
	});
});
