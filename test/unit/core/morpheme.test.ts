import { expect, test } from 'bun:test';
import { LatticeNodeImpl } from '../../../src/core/lattice.js';
import { MorphemeImpl } from '../../../src/core/morpheme.js';
import { MorphemeList } from '../../../src/core/morphemeList.js';
import { SplitMode } from '../../../src/core/tokenizer.js';
import { WordInfo } from '../../../src/dictionary/wordInfo.js';

test('Morpheme: should create morpheme', () => {
	const wordInfo = new WordInfo('test', 4, 0, 'test', 'test', 'test');

	const morpheme = new MorphemeImpl(0, 4, 'test', wordInfo, 10, 0);

	expect(morpheme.begin()).toBe(0);
	expect(morpheme.end()).toBe(4);
	expect(morpheme.surface()).toBe('test');
	expect(morpheme.getWordId()).toBe(10);
	expect(morpheme.getDictionaryId()).toBe(0);
});

test('Morpheme: should get word info', () => {
	const wordInfo = new WordInfo('test', 4, 0, 'test', 'test', 'test');

	const morpheme = new MorphemeImpl(0, 4, 'test', wordInfo, 10, 0);

	expect(morpheme.partOfSpeechId()).toBe(0);
	expect(morpheme.dictionaryForm()).toBe('test');
	expect(morpheme.normalizedForm()).toBe('test');
	expect(morpheme.readingForm()).toBe('test');
	expect(morpheme.getSynonymGroupIds()).toEqual([]);
});

test('Morpheme: should check OOV', () => {
	const wordInfo = new WordInfo('test', 4, 0, 'test', 'test', 'test');

	const morpheme1 = new MorphemeImpl(0, 4, 'test', wordInfo, 10, 0);
	expect(morpheme1.isOOV()).toBe(false);

	const morpheme2 = new MorphemeImpl(0, 4, 'test', wordInfo, 10, -1);
	expect(morpheme2.isOOV()).toBe(true);
});

test('Morpheme: should split', () => {
	const wordInfo = new WordInfo('test', 4, 0, 'test', 'test', 'test');

	const morpheme = new MorphemeImpl(0, 4, 'test', wordInfo, 10, 0);
	const result = morpheme.split(SplitMode.A);

	expect(result.length).toBe(1);
	expect(result[0]).toBe(morpheme);
});

test('MorphemeList: should create empty list', () => {
	const mockInput = { getOriginalIndex: (i: number) => i } as any;
	const list = new MorphemeList(mockInput, [], SplitMode.C, true);

	expect(list.size()).toBe(0);
	expect([...list]).toEqual([]);
});

test('MorphemeList: should create list with nodes', () => {
	const wordInfo = new WordInfo('test', 4, 0, 'test', 'test', 'test');

	const node = new LatticeNodeImpl(null, 1, 2, 100, 10);
	node.setWordInfo(wordInfo);
	node.setRange(0, 4);
	node.totalCost = 100;

	const mockInput = { getOriginalIndex: (i: number) => i } as any;
	const list = new MorphemeList(mockInput, [node], SplitMode.C, true);

	expect(list.size()).toBe(1);
});

test('MorphemeList: should get morpheme', () => {
	const wordInfo = new WordInfo('test', 4, 0, 'test', 'test', 'test');

	const node = new LatticeNodeImpl(null, 1, 2, 100, 10);
	node.setWordInfo(wordInfo);
	node.setRange(0, 4);
	node.totalCost = 100;

	const mockInput = { getOriginalIndex: (i: number) => i } as any;
	const list = new MorphemeList(mockInput, [node], SplitMode.C, true);
	const morpheme = list.get(0);

	expect(morpheme.begin()).toBe(0);
	expect(morpheme.end()).toBe(4);
	expect(morpheme.surface()).toBe('test');
});

test('MorphemeList: should iterate', () => {
	const wordInfo = new WordInfo('test', 4, 0, 'test', 'test', 'test');

	const node = new LatticeNodeImpl(null, 1, 2, 100, 10);
	node.setWordInfo(wordInfo);
	node.setRange(0, 4);
	node.totalCost = 100;

	const mockInput = { getOriginalIndex: (i: number) => i } as any;
	const list = new MorphemeList(mockInput, [node], SplitMode.C, true);
	const morphemes = [...list];

	expect(morphemes.length).toBe(1);
	expect(morphemes[0]?.surface()).toBe('test');
});

test('MorphemeList: should calculate internal cost', () => {
	const wordInfo = new WordInfo('test', 4, 0, 'test', 'test', 'test');

	const node1 = new LatticeNodeImpl(null, 1, 2, 100, 10);
	node1.setWordInfo(wordInfo);
	node1.setRange(0, 4);
	node1.totalCost = 100;

	const node2 = new LatticeNodeImpl(null, 3, 4, 100, 20);
	node2.setWordInfo(wordInfo);
	node2.setRange(4, 8);
	node2.totalCost = 300;

	const mockInput = { getOriginalIndex: (i: number) => i } as any;
	const list = new MorphemeList(mockInput, [node1, node2], SplitMode.C, true);
	const cost = list.getInternalCost();

	expect(cost).toBe(200);
});

test('MorphemeList: should split', () => {
	const wordInfo = new WordInfo('test', 4, 0, 'test', 'test', 'test');

	const node = new LatticeNodeImpl(null, 1, 2, 100, 10);
	node.setWordInfo(wordInfo);
	node.setRange(0, 4);
	node.totalCost = 100;

	const mockInput = { getOriginalIndex: (i: number) => i } as any;
	const list = new MorphemeList(mockInput, [node], SplitMode.C, true);
	const splitList = list.split(SplitMode.A);

	expect(splitList.size()).toBe(1);
});
