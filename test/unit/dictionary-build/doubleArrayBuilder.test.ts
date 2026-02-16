import { describe, expect, test } from 'vitest';
import { DoubleArray } from '../../../src/dictionary-build/doubleArray.js';

describe('DoubleArrayBuilder', () => {
	test('should build empty trie', () => {
		const builder = new DoubleArray();
		builder.build([], []);
		expect(builder.getSize()).toBeGreaterThanOrEqual(0);
	});

	test('should build simple trie', () => {
		const builder = new DoubleArray();
		const keys = [new Uint8Array([0x61, 0x62, 0x63])];
		const values = [100];
		builder.build(keys, values);
		expect(builder.getSize()).toBeGreaterThan(0);
	});

	test('should build trie with multiple keys', () => {
		const builder = new DoubleArray();
		const keys = [
			new Uint8Array([0x61]),
			new Uint8Array([0x62]),
			new Uint8Array([0x63]),
		];
		const values = [1, 2, 3];
		builder.build(keys, values);
		expect(builder.getSize()).toBeGreaterThan(0);
	});

	test('should convert to byte array', () => {
		const builder = new DoubleArray();
		const keys = [new Uint8Array([0x61])];
		const values = [1];
		builder.build(keys, values);
		const bytes = builder.toByteArray();
		expect(bytes.length).toBeGreaterThan(0);
	});

	test('should throw on mismatched array lengths', () => {
		const builder = new DoubleArray();
		const keys = [new Uint8Array([0x61])];
		const values = [1, 2];
		expect(() => builder.build(keys, values)).toThrow();
	});
});
