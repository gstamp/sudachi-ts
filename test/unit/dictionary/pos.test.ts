import { describe, expect, test } from 'bun:test';
import {
	DEPTH,
	MAX_COMPONENT_LENGTH,
	POS,
} from '../../../src/dictionary/pos.js';

describe('POS', () => {
	test('should create POS with 6 elements', () => {
		const pos = new POS('名詞', '一般', '*', '*', '*', '*');
		expect(pos.size()).toBe(DEPTH);
		expect(pos.get(0)).toBe('名詞');
		expect(pos.get(1)).toBe('一般');
	});

	test('should throw error with wrong number of elements', () => {
		expect(() => new POS('名詞', '一般')).toThrow(
			`POS must have exactly ${DEPTH} elements`,
		);
	});

	test('should throw error with null element', () => {
		expect(
			() => new POS('名詞', null as unknown as string, '*', '*', '*', '*'),
		).toThrow("POS components can't be null or undefined");
	});

	test('should throw error with undefined element', () => {
		expect(
			() => new POS('名詞', undefined as unknown as string, '*', '*', '*', '*'),
		).toThrow("POS components can't be null or undefined");
	});

	test('should throw error with component too long', () => {
		const longString = 'a'.repeat(MAX_COMPONENT_LENGTH + 1);
		expect(() => new POS(longString, '*', '*', '*', '*', '*')).toThrow(
			`POS component had length (${MAX_COMPONENT_LENGTH + 1}) > ${MAX_COMPONENT_LENGTH}`,
		);
	});

	test('should throw error when getting index out of bounds', () => {
		const pos = new POS('名詞', '一般', '*', '*', '*', '*');
		expect(() => pos.get(10)).toThrow('POS index out of bounds: 10');
	});

	test('should check equality correctly', () => {
		const pos1 = new POS('名詞', '一般', '*', '*', '*', '*');
		const pos2 = new POS('名詞', '一般', '*', '*', '*', '*');
		const pos3 = new POS('動詞', '一般', '*', '*', '*', '*');

		expect(pos1.equals(pos2)).toBe(true);
		expect(pos1.equals(pos3)).toBe(false);
	});

	test('should convert to list', () => {
		const pos = new POS('名詞', '一般', '*', '*', '*', '*');
		const list = pos.toList();
		expect(list).toEqual(['名詞', '一般', '*', '*', '*', '*']);
	});

	test('should convert to string', () => {
		const pos = new POS('名詞', '一般', '*', '*', '*', '*');
		expect(pos.toString()).toBe('名詞,一般,*,*,*,*');
	});

	test('should get element at valid index', () => {
		const pos = new POS('名詞', '一般', '固有名詞', '人名', '一般', '*');
		expect(pos.get(0)).toBe('名詞');
		expect(pos.get(1)).toBe('一般');
		expect(pos.get(2)).toBe('固有名詞');
		expect(pos.get(3)).toBe('人名');
		expect(pos.get(4)).toBe('一般');
		expect(pos.get(5)).toBe('*');
	});
});
