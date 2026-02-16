import { beforeEach, describe, expect, test } from 'vitest';
import { DicBuffer } from '../../../src/dictionary-build/dicBuffer.js';

describe('DicBuffer', () => {
	let buffer: DicBuffer;

	beforeEach(() => {
		buffer = new DicBuffer(1024);
	});

	test('should put and read string', () => {
		const success = buffer.putString('hello');
		expect(success).toBe(true);
		expect(buffer.position()).toBe(1 + 10);
	});

	test('should put length correctly for short strings', () => {
		buffer.putString('hi');
		const slice = buffer.flip();
		expect(slice[0]).toBe(2);
	});

	test('should handle string buffer overflow', () => {
		const tinyBuffer = new DicBuffer(5);
		const success = tinyBuffer.putString('hello world');
		expect(success).toBe(false);
	});

	test('should put empty string if equal', () => {
		buffer.putEmptyIfEqual('surface', 'surface');
		const slice = buffer.flip();
		expect(slice[0]).toBe(0);
	});

	test('should put different string', () => {
		buffer.putEmptyIfEqual('normalized', 'surface');
		const slice = buffer.flip();
		expect(slice[0]).toBeGreaterThan(0);
	});

	test('should validate string length', () => {
		expect(DicBuffer.isValidLength('hello')).toBe(true);
		expect(DicBuffer.isValidLength('a'.repeat(DicBuffer.MAX_STRING))).toBe(
			true,
		);
		expect(DicBuffer.isValidLength('a'.repeat(DicBuffer.MAX_STRING + 1))).toBe(
			false,
		);
	});

	test('should put int16 values', () => {
		buffer.putInt16(1000);
		buffer.putInt16(-500);
		const slice = buffer.flip();
		const view = new DataView(slice.buffer);
		expect(view.getInt16(0, true)).toBe(1000);
		expect(view.getInt16(2, true)).toBe(-500);
	});

	test('should put int32 values', () => {
		buffer.putInt32(100000);
		buffer.putInt32(-50000);
		const slice = buffer.flip();
		const view = new DataView(slice.buffer);
		expect(view.getInt32(0, true)).toBe(100000);
		expect(view.getInt32(4, true)).toBe(-50000);
	});

	test('should put int array', () => {
		buffer.putInts([1, 2, 3]);
		const slice = buffer.flip();
		expect(slice[0]).toBe(3);
		const view = new DataView(slice.buffer);
		expect(view.getInt32(1, true)).toBe(1);
		expect(view.getInt32(5, true)).toBe(2);
		expect(view.getInt32(9, true)).toBe(3);
	});

	test('should throw on too many int array values', () => {
		const largeArray = new Array(256).fill(1);
		expect(() => buffer.putInts(largeArray)).toThrow('Too many values');
	});

	test('should check wontFit correctly', () => {
		const tinyBuffer = new DicBuffer(5);
		expect(tinyBuffer.wontFit(5)).toBe(false);
		expect(tinyBuffer.wontFit(6)).toBe(true);
	});

	test('should consume buffer with callback', () => {
		buffer.putString('test');
		let consumedBytes: Uint8Array | null = null;
		buffer.consume((bytes) => {
			consumedBytes = bytes;
		});
		expect(consumedBytes).not.toBeNull();
		expect(consumedBytes!.length).toBe(9); // 1 length byte + 4 chars * 2 bytes
		expect(buffer.position()).toBe(0);
	});
});
