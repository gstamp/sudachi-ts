import { describe, expect, test } from 'vitest';
import { CSVParser } from '../../../src/dictionary-build/csvParser.js';

describe('CSVParser', () => {
	test('should parse simple CSV record', () => {
		const parser = new CSVParser('a,b,c');
		const record = parser.getNextRecord();
		expect(record).toEqual(['a', 'b', 'c']);
	});

	test('should parse quoted fields', () => {
		const parser = new CSVParser('"hello, world",foo,bar');
		const record = parser.getNextRecord();
		expect(record).toEqual(['hello, world', 'foo', 'bar']);
	});

	test('should parse escaped quotes', () => {
		const parser = new CSVParser('"a""b","c""d"');
		const record = parser.getNextRecord();
		expect(record).toEqual(['a"b', 'c"d']);
	});

	test('should parse multiple records', () => {
		const parser = new CSVParser('a,b\nc,d\ne,f');
		expect(parser.getNextRecord()).toEqual(['a', 'b']);
		expect(parser.getNextRecord()).toEqual(['c', 'd']);
		expect(parser.getNextRecord()).toEqual(['e', 'f']);
		expect(parser.getNextRecord()).toBeNull();
	});

	test('should track line numbers', () => {
		const parser = new CSVParser('a,b\nc,d\ne,f');
		expect(parser.getLineNumber()).toBe(1);
		parser.getNextRecord();
		expect(parser.getLineNumber()).toBe(2);
		parser.getNextRecord();
		expect(parser.getLineNumber()).toBe(3);
	});

	test('should handle empty records', () => {
		const parser = new CSVParser('a,b\n\nc,d');
		expect(parser.getNextRecord()).toEqual(['a', 'b']);
		expect(parser.getNextRecord()).toEqual(['']);
		expect(parser.getNextRecord()).toEqual(['c', 'd']);
	});

	test('should handle CRLF line endings', () => {
		const parser = new CSVParser('a,b\r\nc,d');
		expect(parser.getNextRecord()).toEqual(['a', 'b']);
		expect(parser.getNextRecord()).toEqual(['c', 'd']);
	});
});
