import { beforeEach, describe, expect, test } from 'bun:test';
import {
	CsvLexicon,
	WordEntry,
} from '../../../src/dictionary-build/csvLexicon.js';
import { POSTable } from '../../../src/dictionary-build/posTable.js';

describe('CsvLexicon', () => {
	let lexicon: CsvLexicon;
	let posTable: POSTable;

	beforeEach(() => {
		posTable = new POSTable();
		lexicon = new CsvLexicon(posTable);
	});

	test('should unescape unicode literals', () => {
		expect(CsvLexicon.unescape('hello\\u0041')).toBe('helloA');
		expect(CsvLexicon.unescape('\\u3042\\u3044\\u3046')).toBe('あいう');
	});

	test('should parse basic lexicon line', () => {
		const cols = [
			'テスト',
			'0',
			'0',
			'100',
			'テスト',
			'名詞',
			'普通名詞',
			'一般',
			'*',
			'*',
			'*',
			'テスト',
			'テスト',
			'-1',
			'A',
			'*',
			'*',
			'*',
		];
		const entry = lexicon.parseLine(cols);
		expect(entry.headword).toBe('テスト');
		expect(entry.wordInfo).toBeDefined();
		expect(entry.wordInfo?.getSurface()).toBe('テスト');
	});

	test('should throw on too few columns', () => {
		const cols = ['a', 'b', 'c'];
		expect(() => lexicon.parseLine(cols)).toThrow('Invalid format');
	});

	test('should throw on empty headword', () => {
		const cols = Array(18).fill('*');
		cols[0] = '';
		expect(() => lexicon.parseLine(cols)).toThrow('Headword is empty');
	});

	test('should add entry and get ID', () => {
		const entry = new WordEntry();
		entry.headword = 'test';
		const id = lexicon.addEntry(entry);
		expect(id).toBe(0);
		expect(lexicon.getEntries().length).toBe(1);
	});

	test('should parse synonym GIDs', () => {
		const result = lexicon.parseSynonymGids('1/2/3');
		expect(result).toEqual([1, 2, 3]);
	});

	test('should handle star for synonym GIDs', () => {
		const result = lexicon.parseSynonymGids('*');
		expect(result).toEqual([]);
	});

	test('should throw on too many synonym GIDs', () => {
		const manyIds = Array(256).fill(1).join('/');
		expect(() => lexicon.parseSynonymGids(manyIds)).toThrow('Too many units');
	});
});
