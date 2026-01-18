import { describe, expect, test } from 'bun:test';
import { Index } from '../../../src/dictionary-build/trieIndex.js';

describe('Index', () => {
	test('should add keys', () => {
		const index = new Index();
		const len1 = index.add('hello', 1);
		const len2 = index.add('world', 2);
		expect(len1).toBe(5);
		expect(len2).toBe(5);
	});

	test('should throw on too many entries for same key', () => {
		const index = new Index();
		for (let i = 0; i < 255; i++) {
			index.add('test', i);
		}
		expect(() => index.add('test', 255)).toThrow('has >= 255 entries');
	});

	test('should handle multiple entries per key', () => {
		const index = new Index();
		index.add('test', 1);
		index.add('test', 2);
		index.add('test', 3);
	});
});
