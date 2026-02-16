import { beforeAll, describe, expect, test } from 'vitest';
import { SentenceSplittingAnalysis } from '../../../src/core/sentenceSplittingAnalysis.js';
import { SplitMode } from '../../../src/core/tokenizer.js';
import { getSystemDictionary } from '../../integration/testDictionary.js';

describe('SentenceSplittingAnalysis', () => {
	let dict: Awaited<ReturnType<typeof getSystemDictionary>>;

	beforeAll(async () => {
		dict = await getSystemDictionary();
	});

	test('tokenizeBuffer - single sentence', () => {
		const tokenizer = dict.create();
		const analysis = new SentenceSplittingAnalysis(
			SplitMode.C,
			dict.getGrammar(),
			dict.getLexicon(),
			(m, input) => tokenizer.tokenize(m, input.getText()),
		);
		const result = analysis.tokenizeBuffer('京都に行った。');
		expect(result).toBe(0);
		expect(analysis.result.length).toBe(1);
		expect(analysis.result[0]!.size()).toBeGreaterThan(0);
	});

	test('tokenizeBuffer - multiple sentences', () => {
		const tokenizer = dict.create();
		const analysis = new SentenceSplittingAnalysis(
			SplitMode.C,
			dict.getGrammar(),
			dict.getLexicon(),
			(m, input) => tokenizer.tokenize(m, input.getText()),
		);
		const result = analysis.tokenizeBuffer('京都に行った。東京に行った。');
		expect(result).toBe(0);
		expect(analysis.result.length).toBe(2);
	});

	test('tokenizeBuffer - no sentence break', () => {
		const tokenizer = dict.create();
		const analysis = new SentenceSplittingAnalysis(
			SplitMode.C,
			dict.getGrammar(),
			dict.getLexicon(),
			(m, input) => tokenizer.tokenize(m, input.getText()),
		);
		const result = analysis.tokenizeBuffer('京都に行った');
		expect(result).toBe(6);
		expect(analysis.result.length).toBe(1);
	});

	test('tokenizeBuffer - empty string', () => {
		const tokenizer = dict.create();
		const analysis = new SentenceSplittingAnalysis(
			SplitMode.C,
			dict.getGrammar(),
			dict.getLexicon(),
			(m, input) => tokenizer.tokenize(m, input.getText()),
		);
		const result = analysis.tokenizeBuffer('');
		expect(result).toBe(0);
		expect(analysis.result.length).toBe(0);
	});

	test('tokenizeBuffer - sentence with question mark', () => {
		const tokenizer = dict.create();
		const analysis = new SentenceSplittingAnalysis(
			SplitMode.C,
			dict.getGrammar(),
			dict.getLexicon(),
			(m, input) => tokenizer.tokenize(m, input.getText()),
		);
		const result = analysis.tokenizeBuffer('京都に行った？東京に行った。');
		expect(result).toBe(0);
		expect(analysis.result.length).toBe(2);
	});

	test('bosPosition - returns correct position during processing', () => {
		const tokenizer = dict.create();
		const analysis = new SentenceSplittingAnalysis(
			SplitMode.C,
			dict.getGrammar(),
			dict.getLexicon(),
			(m, input) => tokenizer.tokenize(m, input.getText()),
		);
		analysis.tokenizeBuffer('京都に行った。');
		expect(analysis.bosPosition()).toBe(7);
	});

	test('hasNonBreakWord - checks for non-break words', () => {
		const tokenizer = dict.create();
		const analysis = new SentenceSplittingAnalysis(
			SplitMode.C,
			dict.getGrammar(),
			dict.getLexicon(),
			(m, input) => tokenizer.tokenize(m, input.getText()),
		);
		analysis.tokenizeBuffer('京都');
		expect(analysis.hasNonBreakWord(2)).toBe(true);
		expect(analysis.hasNonBreakWord(0)).toBe(false);
	});

	test('result - contains tokenized morphemes', () => {
		const tokenizer = dict.create();
		const analysis = new SentenceSplittingAnalysis(
			SplitMode.C,
			dict.getGrammar(),
			dict.getLexicon(),
			(m, input) => tokenizer.tokenize(m, input.getText()),
		);
		analysis.tokenizeBuffer('京都');
		expect(analysis.result.length).toBe(1);
		const morphemeList = analysis.result[0]!;
		expect(morphemeList.size()).toBeGreaterThan(0);
		const morpheme = morphemeList.get(0)!;
		expect(morpheme.surface()).toBe('京都');
	});
});
