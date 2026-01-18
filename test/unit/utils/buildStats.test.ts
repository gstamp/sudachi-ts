import { describe, test, expect } from 'bun:test';
import {
	BuildStatsFormatter,
	formatBuildStats,
	type BuildStatsData,
} from '../../../src/utils/buildStats.js';

describe('BuildStatsFormatter', () => {
	const mockStats: BuildStatsData = {
		inputs: [
			{ name: 'lexicon1.csv', time: 100.5, size: 1500 },
			{ name: 'lexicon2.csv', time: 200.75, size: 2500 },
		],
		outputs: [
			{ name: 'POS', time: 10.0, size: 4096 },
			{ name: 'Matrix', time: 50.0, size: 8192 },
			{ name: 'Trie', time: 80.0, size: 16384 },
			{ name: 'Lexicon', time: 120.0, size: 32768 },
		],
	};

	describe('toConsole', () => {
		test('should format statistics to console output', () => {
			const formatter = new BuildStatsFormatter(mockStats);
			const output = formatter.toConsole();

			expect(output).toContain('=== Build Statistics ===');
			expect(output).toContain('Input Files:');
			expect(output).toContain('lexicon1.csv');
			expect(output).toContain('lexicon2.csv');
			expect(output).toContain('Output Parts:');
			expect(output).toContain('POS');
			expect(output).toContain('Matrix');
			expect(output).toContain('Total input time:');
			expect(output).toContain('Total output size:');
		});

		test('should handle empty inputs and outputs', () => {
			const formatter = new BuildStatsFormatter({
				inputs: [],
				outputs: [],
			});
			const output = formatter.toConsole();

			expect(output).toContain('(none)');
			expect(output).toContain('Total input time: 0.00ms');
			expect(output).toContain('Total output size: 0 bytes');
		});
	});

	describe('toJSON', () => {
		test('should format statistics to JSON', () => {
			const formatter = new BuildStatsFormatter(mockStats);
			const output = formatter.toJSON();

			const parsed = JSON.parse(output);
			expect(parsed).toHaveProperty('inputs');
			expect(parsed).toHaveProperty('outputs');
			expect(parsed.inputs).toHaveLength(2);
			expect(parsed.outputs).toHaveLength(4);
			expect(parsed.inputs[0]).toEqual({
				name: 'lexicon1.csv',
				time_ms: 100.5,
				entries: 1500,
			});
		});

		test('should format with proper JSON structure', () => {
			const formatter = new BuildStatsFormatter(mockStats);
			const output = formatter.toJSON();

			expect(() => JSON.parse(output)).not.toThrow();
		});
	});

	describe('toCSV', () => {
		test('should format statistics to CSV', () => {
			const formatter = new BuildStatsFormatter(mockStats);
			const output = formatter.toCSV();

			const lines = output.split('\n');
			expect(lines[0]).toBe('type,name,time_ms,size');
			expect(lines).toHaveLength(7);
			expect(lines[1]).toBe(
				'input,"lexicon1.csv",100.500,1500',
			);
			expect(lines[2]).toBe(
				'input,"lexicon2.csv",200.750,2500',
			);
		});

		test('should handle special characters in names', () => {
			const formatter = new BuildStatsFormatter({
				inputs: [{ name: 'test,with,commas.csv', time: 100, size: 50 }],
				outputs: [],
			});
			const output = formatter.toCSV();

			expect(output).toContain('"test,with,commas.csv"');
		});
	});
});

describe('formatBuildStats', () => {
	const mockStats: BuildStatsData = {
		inputs: [{ name: 'test.csv', time: 100, size: 50 }],
		outputs: [{ name: 'POS', time: 10, size: 100 }],
	};

	test('should format to console by default', () => {
		const output = formatBuildStats(mockStats);
		expect(output).toContain('=== Build Statistics ===');
	});

	test('should format to console explicitly', () => {
		const output = formatBuildStats(mockStats, 'console');
		expect(output).toContain('=== Build Statistics ===');
	});

	test('should format to JSON', () => {
		const output = formatBuildStats(mockStats, 'json');
		expect(() => JSON.parse(output)).not.toThrow();
	});

	test('should format to CSV', () => {
		const output = formatBuildStats(mockStats, 'csv');
		expect(output).toContain('type,name,time_ms,size');
	});

	test('should default to console for unknown format', () => {
		const output = formatBuildStats(mockStats, 'unknown' as never);
		expect(output).toContain('=== Build Statistics ===');
	});
});
