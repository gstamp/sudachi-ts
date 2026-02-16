import { describe, expect, test } from 'vitest';
import {
	ChainResolver,
	CsvResolver,
	NoopResolver,
} from '../../../src/dictionary-build/wordIdResolver.js';

describe('WordIdResolver', () => {
	describe('NoopResolver', () => {
		test('should return -1 for all lookups', () => {
			const resolver = new NoopResolver();
			expect(resolver.lookup('test', 0, 'reading')).toBe(-1);
		});

		test('should not be user', () => {
			const resolver = new NoopResolver();
			expect(resolver.isUser()).toBe(false);
		});
	});

	describe('CsvResolver', () => {
		test('should lookup added words', () => {
			const resolver = new CsvResolver();
			resolver.add('test', 0, 'reading', 5);
			expect(resolver.lookup('test', 0, 'reading')).toBe(5);
		});

		test('should return -1 for missing words', () => {
			const resolver = new CsvResolver();
			expect(resolver.lookup('test', 0, 'reading')).toBe(-1);
		});

		test('should be user when specified', () => {
			const resolver = new CsvResolver(new Map(), true);
			expect(resolver.isUser()).toBe(true);
		});
	});

	describe('ChainResolver', () => {
		test('should lookup from first resolver', () => {
			const resolver1 = new CsvResolver();
			resolver1.add('test', 0, 'reading', 1);
			const resolver2 = new CsvResolver();
			resolver2.add('test', 0, 'reading', 2);

			const chain = new ChainResolver(resolver1, resolver2);
			expect(chain.lookup('test', 0, 'reading')).toBe(1);
		});

		test('should fallback to second resolver', () => {
			const resolver1 = new CsvResolver();
			const resolver2 = new CsvResolver();
			resolver2.add('test', 0, 'reading', 2);

			const chain = new ChainResolver(resolver1, resolver2);
			expect(chain.lookup('test', 0, 'reading')).toBe(2);
		});
	});
});
