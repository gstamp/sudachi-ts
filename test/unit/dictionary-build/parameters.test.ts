import { beforeEach, describe, expect, test } from 'bun:test';
import { Parameters } from '../../../src/dictionary-build/parameters.js';

describe('Parameters', () => {
	let params: Parameters;

	beforeEach(() => {
		params = new Parameters();
	});

	test('should add parameters', () => {
		params.add(0, 0, 100);
		params.add(1, 1, 200);
		expect(params.size()).toBe(6);
	});

	test('should set limits', () => {
		params.setLimits(10, 10);
		params.add(5, 5, 100);
		expect(params.size()).toBe(3);
	});

	test('should throw on exceeding left limit', () => {
		params.setLimits(5, 10);
		expect(() => params.add(6, 5, 100)).toThrow(
			'Left ID 6 exceeds max value 5',
		);
	});

	test('should throw on exceeding right limit', () => {
		params.setLimits(10, 5);
		expect(() => params.add(5, 6, 100)).toThrow(
			'Right ID 6 exceeds max value 5',
		);
	});

	test('should resize automatically', () => {
		const initialSize = 1024 * 512 * 2;
		for (let i = 0; i < initialSize / 3 + 100; i++) {
			params.add(0, 0, 100);
		}
		expect(params.size()).toBeGreaterThan(initialSize / 3);
	});
});
