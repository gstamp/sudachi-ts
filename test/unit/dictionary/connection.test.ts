import { describe, expect, test } from 'bun:test';
import { Connection } from '../../../src/dictionary/connection.js';

describe('Connection', () => {
	test('should create connection matrix', () => {
		const matrix = new Int16Array([10, 20, 30, 40]);
		const conn = new Connection(matrix, 2, 2);
		expect(conn.getLeftSize()).toBe(2);
		expect(conn.getRightSize()).toBe(2);
	});

	test('should get connection cost', () => {
		const matrix = new Int16Array([10, 20, 30, 40]);
		const conn = new Connection(matrix, 2, 2);
		expect(conn.cost(0, 0)).toBe(10);
		expect(conn.cost(1, 0)).toBe(20);
		expect(conn.cost(0, 1)).toBe(30);
		expect(conn.cost(1, 1)).toBe(40);
	});

	test('should throw error when leftId is out of bounds', () => {
		const matrix = new Int16Array([10, 20, 30, 40]);
		const conn = new Connection(matrix, 2, 2);
		expect(() => conn.cost(2, 0)).toThrow('leftId < leftSize: (2, 2)');
	});

	test('should throw error when rightId is out of bounds', () => {
		const matrix = new Int16Array([10, 20, 30, 40]);
		const conn = new Connection(matrix, 2, 2);
		expect(() => conn.cost(0, 2)).toThrow('rightId < rightSize: (2, 2)');
	});

	test('should set connection cost', () => {
		const matrix = new Int16Array([10, 20, 30, 40]);
		const conn = new Connection(matrix, 2, 2);
		conn.setCost(0, 0, 100);
		expect(conn.cost(0, 0)).toBe(100);
	});

	test('should create owned copy', () => {
		const matrix = new Int16Array([10, 20, 30, 40]);
		const conn = new Connection(matrix, 2, 2);
		const copy = conn.ownedCopy();

		expect(copy.getLeftSize()).toBe(2);
		expect(copy.getRightSize()).toBe(2);
		expect(copy.cost(0, 0)).toBe(10);

		copy.setCost(0, 0, 999);
		expect(conn.cost(0, 0)).toBe(10);
		expect(copy.cost(0, 0)).toBe(999);
	});

	test('should validate leftId', () => {
		const matrix = new Int16Array([10, 20, 30, 40]);
		const conn = new Connection(matrix, 2, 2);
		conn.validate(0);
		conn.validate(1);
		expect(() => conn.validate(2)).toThrow('leftId < leftSize: (2, 2)');
	});

	test('should handle large matrix', () => {
		const size = 100;
		const matrix = new Int16Array(size * size);
		for (let i = 0; i < matrix.length; i++) {
			matrix[i] = i;
		}
		const conn = new Connection(matrix, size, size);
		expect(conn.cost(0, 0)).toBe(0);
		expect(conn.cost(99, 99)).toBe(9999);
	});

	test('should handle negative costs', () => {
		const matrix = new Int16Array([-10, -20, -30, -40]);
		const conn = new Connection(matrix, 2, 2);
		expect(conn.cost(0, 0)).toBe(-10);
		expect(conn.cost(1, 1)).toBe(-40);
	});

	test('should handle maximum int16 values', () => {
		const matrix = new Int16Array([32767, -32768, 0, 100]);
		const conn = new Connection(matrix, 2, 2);
		expect(conn.cost(0, 0)).toBe(32767);
		expect(conn.cost(1, 0)).toBe(-32768);
	});
});
