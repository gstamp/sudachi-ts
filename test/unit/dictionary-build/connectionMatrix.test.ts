import { describe, expect, test } from 'bun:test';
import { ConnectionMatrix } from '../../../src/dictionary-build/connectionMatrix.js';

describe('ConnectionMatrix', () => {
	test('should parse connection matrix header', async () => {
		const matrix = new ConnectionMatrix();
		const data = '2 2\n0 0 100\n0 1 200\n1 0 300\n1 1 400';
		await matrix.readEntries(data);
		expect(matrix.numLeft).toBe(2);
		expect(matrix.numRight).toBe(2);
	});

	test('should make empty matrix', () => {
		const matrix = new ConnectionMatrix();
		matrix.makeEmpty();
		expect(matrix.numLeft).toBe(0);
		expect(matrix.numRight).toBe(0);
	});

	test('should throw on invalid header format', async () => {
		const matrix = new ConnectionMatrix();
		await expect(matrix.readEntries('invalid')).rejects.toThrow();
	});

	test('should throw on insufficient columns', async () => {
		const matrix = new ConnectionMatrix();
		await expect(matrix.readEntries('2 2\n0 0')).rejects.toThrow(
			'Not enough entries',
		);
	});

	test('should throw on invalid left/right IDs', async () => {
		const matrix = new ConnectionMatrix();
		const data = '2 2\n0 0 100\n5 5 200';
		await expect(matrix.readEntries(data)).rejects.toThrow(
			'Invalid left/right IDs',
		);
	});
});
