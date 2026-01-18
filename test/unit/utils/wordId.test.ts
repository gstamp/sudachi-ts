import { expect, test } from 'bun:test';
import {
	applyMask,
	dic,
	dicIdMask,
	MAX_WORD_ID,
	make,
	word,
} from '../../../src/index.js';

test('WordId: should create word id', () => {
	const wordId = make(0, 12345);
	expect(wordId).toBe(12345);
});

test('WordId: should create word id with dictionary', () => {
	const wordId = make(1, 12345);
	expect(wordId).toBe(268447801);
});

test('WordId: should extract dictionary id', () => {
	const wordId = 268447801;
	expect(dic(wordId)).toBe(1);
});

test('WordId: should extract word id', () => {
	const wordId = 268447801;
	expect(word(wordId)).toBe(12345);
});

test('WordId: should throw error for word id too large', () => {
	expect(() => make(0, MAX_WORD_ID + 1)).toThrow('wordId is too large');
});

test('WordId: should throw error for dictionary id too large', () => {
	expect(() => make(15, 0)).toThrow('dictionaryId is too large');
});

test('WordId: should create dic id mask', () => {
	const mask = dicIdMask(2);
	expect(mask).toBe(0x20000000);
});

test('WordId: should apply mask', () => {
	const wordId = 74565;
	const mask = dicIdMask(1);
	const result = applyMask(wordId, mask);
	expect(result).toBe(268510021);
});
