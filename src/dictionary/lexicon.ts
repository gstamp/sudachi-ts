import type { WordInfo } from './wordInfo.js';

export interface Lexicon {
	lookup(text: Uint8Array, offset: number): IterableIterator<[number, number]>;

	getWordId(headword: string, posId: number, readingForm: string): number;

	getLeftId(wordId: number): number;

	getRightId(wordId: number): number;

	getCost(wordId: number): number;

	getWordInfo(wordId: number): WordInfo;

	size(): number;
}
