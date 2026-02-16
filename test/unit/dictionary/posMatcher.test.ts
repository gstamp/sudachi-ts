import { describe, expect, test } from 'vitest';
import { POS } from '../../../src/dictionary/pos.js';
import { PartialPOS, PosMatcher } from '../../../src/dictionary/posMatcher.js';

describe('PartialPOS', () => {
	test('should create partial POS', () => {
		const pos = new PartialPOS(['名詞', '一般']);
		expect(pos.size()).toBe(2);
		expect(pos.get(0)).toBe('名詞');
		expect(pos.get(1)).toBe('一般');
	});

	test('should throw error when created with empty data', () => {
		expect(() => new PartialPOS([])).toThrow(
			'Partial POS must have at least 1 component',
		);
	});

	test('should throw error when created with too many components', () => {
		expect(() => new PartialPOS(['a', 'a', 'a', 'a', 'a', 'a', 'a'])).toThrow(
			'Partial POS can have at most 6 components',
		);
	});

	test('should throw error when component is too long', () => {
		const longString = 'a'.repeat(128);
		expect(() => new PartialPOS([longString])).toThrow(
			"Component length can't be more than 127",
		);
	});

	test('should handle null values in data', () => {
		const pos = new PartialPOS(['名詞', null, '固有名詞']);
		expect(pos.get(0)).toBe('名詞');
		expect(pos.get(1)).toBeNull();
		expect(pos.get(2)).toBe('固有名詞');
	});

	test('should return null for out of bounds index', () => {
		const pos = new PartialPOS(['名詞']);
		expect(pos.get(0)).toBe('名詞');
		expect(pos.get(1)).toBeNull();
		expect(pos.get(10)).toBeNull();
	});

	test('should match POS with matching components', () => {
		const partial = new PartialPOS(['名詞', '一般']);
		const pos = new POS('名詞', '一般', '*', '*', '*', '*');
		expect(partial.matches(pos)).toBe(true);
	});

	test('should not match POS with different components', () => {
		const partial = new PartialPOS(['名詞', '一般']);
		const pos = new POS('動詞', '一般', '*', '*', '*', '*');
		expect(partial.matches(pos)).toBe(false);
	});

	test('should match when partial has null at level', () => {
		const partial = new PartialPOS(['名詞', null]);
		const pos1 = new POS('名詞', '一般', '*', '*', '*', '*');
		const pos2 = new POS('名詞', '固有名詞', '*', '*', '*', '*');
		expect(partial.matches(pos1)).toBe(true);
		expect(partial.matches(pos2)).toBe(true);
	});

	test('should convert to string', () => {
		const partial = new PartialPOS(['名詞', '一般', null]);
		expect(partial.toString()).toBe('名詞,一般,');
	});

	test('should create PartialPOS using static of method', () => {
		const partial = PartialPOS.of('名詞', '一般', '固有名詞');
		expect(partial.size()).toBe(3);
		expect(partial.get(0)).toBe('名詞');
		expect(partial.get(1)).toBe('一般');
		expect(partial.get(2)).toBe('固有名詞');
	});
});

describe('PosMatcher', () => {
	const getPOSString = (id: number): string[] => {
		const posList = [
			['名詞', '一般', '*', '*', '*', '*'],
			['名詞', '固有名詞', '*', '*', '*', '*'],
			['動詞', '一般', '*', '*', '*', '*'],
			['形容詞', '一般', '*', '*', '*', '*'],
		];
		return posList[id]!;
	};

	test('should create pos matcher with ids', () => {
		const matcher = new PosMatcher([0, 2], getPOSString);
		expect(matcher.matches(0)).toBe(true);
		expect(matcher.matches(2)).toBe(true);
		expect(matcher.matches(1)).toBe(false);
		expect(matcher.matches(3)).toBe(false);
	});

	test('should create pos matcher with empty ids', () => {
		const matcher = new PosMatcher([], getPOSString);
		expect(matcher.matches(0)).toBe(false);
	});

	test('should union two matchers', () => {
		const matcher1 = new PosMatcher([0, 1], getPOSString);
		const matcher2 = new PosMatcher([2, 3], getPOSString);
		const union = matcher1.union(matcher2);

		expect(union.matches(0)).toBe(true);
		expect(union.matches(1)).toBe(true);
		expect(union.matches(2)).toBe(true);
		expect(union.matches(3)).toBe(true);
	});

	test('should union matchers with overlapping ids', () => {
		const matcher1 = new PosMatcher([0, 1, 2], getPOSString);
		const matcher2 = new PosMatcher([2, 3], getPOSString);
		const union = matcher1.union(matcher2);

		expect(union.matches(0)).toBe(true);
		expect(union.matches(1)).toBe(true);
		expect(union.matches(2)).toBe(true);
		expect(union.matches(3)).toBe(true);
	});

	test('should intersect two matchers', () => {
		const matcher1 = new PosMatcher([0, 1, 2], getPOSString);
		const matcher2 = new PosMatcher([1, 2, 3], getPOSString);
		const intersection = matcher1.intersection(matcher2);

		expect(intersection.matches(0)).toBe(false);
		expect(intersection.matches(1)).toBe(true);
		expect(intersection.matches(2)).toBe(true);
		expect(intersection.matches(3)).toBe(false);
	});

	test('should intersect matchers with no overlap', () => {
		const matcher1 = new PosMatcher([0, 1], getPOSString);
		const matcher2 = new PosMatcher([2, 3], getPOSString);
		const intersection = matcher1.intersection(matcher2);

		expect(intersection.matches(0)).toBe(false);
		expect(intersection.matches(1)).toBe(false);
		expect(intersection.matches(2)).toBe(false);
		expect(intersection.matches(3)).toBe(false);
	});

	test('should invert matcher', () => {
		const matcher = new PosMatcher([1, 2], getPOSString);
		const inverted = matcher.invert(4);

		expect(inverted.matches(0)).toBe(true);
		expect(inverted.matches(1)).toBe(false);
		expect(inverted.matches(2)).toBe(false);
		expect(inverted.matches(3)).toBe(true);
	});

	test('should invert empty matcher', () => {
		const matcher = new PosMatcher([], getPOSString);
		const inverted = matcher.invert(4);

		expect(inverted.matches(0)).toBe(true);
		expect(inverted.matches(1)).toBe(true);
		expect(inverted.matches(2)).toBe(true);
		expect(inverted.matches(3)).toBe(true);
	});

	test('should iterate over matching POS strings', () => {
		const matcher = new PosMatcher([2, 0], getPOSString);
		const results: string[][] = [];

		for (const posString of matcher) {
			results.push(posString);
		}

		expect(results).toEqual([
			['名詞', '一般', '*', '*', '*', '*'],
			['動詞', '一般', '*', '*', '*', '*'],
		]);
	});

	test('should iterate over empty matcher', () => {
		const matcher = new PosMatcher([], getPOSString);
		const results: string[][] = [];

		for (const posString of matcher) {
			results.push(posString);
		}

		expect(results).toEqual([]);
	});

	test('should iterate in sorted order', () => {
		const matcher = new PosMatcher([3, 1, 0, 2], getPOSString);
		const ids: number[] = [];

		for (let i = 0; i < 4; i++) {
			if (matcher.matches(i)) {
				ids.push(i);
			}
		}

		expect(ids).toEqual([0, 1, 2, 3]);
	});

	test('should be iterable multiple times', () => {
		const matcher = new PosMatcher([0, 2], getPOSString);

		const results1: string[][] = [];
		for (const posString of matcher) {
			results1.push(posString);
		}

		const results2: string[][] = [];
		for (const posString of matcher) {
			results2.push(posString);
		}

		expect(results1).toEqual(results2);
	});
});
