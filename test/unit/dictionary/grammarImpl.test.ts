import { beforeEach, describe, expect, test } from 'vitest';
import { Connection } from '../../../src/dictionary/connection.js';
import { GrammarImpl } from '../../../src/dictionary/grammarImpl.js';
import { POS } from '../../../src/dictionary/pos.js';

describe('GrammarImpl', () => {
	describe('empty constructor', () => {
		let grammar: GrammarImpl;

		beforeEach(() => {
			grammar = new GrammarImpl();
		});

		test('should create empty grammar', () => {
			expect(grammar.getPartOfSpeechSize()).toBe(0);
			expect(grammar.getSystemPartOfSpeechSize()).toBe(0);
			expect(grammar.getStorageSize()).toBe(0);
			expect(grammar.isValid()).toBe(false);
		});

		test('should register POS', () => {
			const pos = new POS('名詞', '一般', '*', '*', '*', '*');
			const id = grammar.registerPOS(pos);
			expect(id).toBe(0);
			expect(grammar.getPartOfSpeechSize()).toBe(1);
		});

		test('should return existing POS id when registering duplicate', () => {
			const pos1 = new POS('名詞', '一般', '*', '*', '*', '*');
			const pos2 = new POS('名詞', '一般', '*', '*', '*', '*');

			const id1 = grammar.registerPOS(pos1);
			const id2 = grammar.registerPOS(pos2);

			expect(id1).toBe(0);
			expect(id2).toBe(0);
			expect(grammar.getPartOfSpeechSize()).toBe(1);
		});

		test('should get POS string by id', () => {
			const pos = new POS('名詞', '一般', '*', '*', '*', '*');
			grammar.registerPOS(pos);

			const retrieved = grammar.getPartOfSpeechString(0);
			expect(retrieved.equals(pos)).toBe(true);
		});

		test('should throw error when getting non-existent POS id', () => {
			expect(() => grammar.getPartOfSpeechString(0)).toThrow(
				'POS ID out of bounds: 0',
			);
		});

		test('should add POS list from another grammar', () => {
			const pos = new POS('名詞', '一般', '*', '*', '*', '*');
			grammar.registerPOS(pos);

			const otherGrammar = new GrammarImpl();
			const pos2 = new POS('動詞', '一般', '*', '*', '*', '*');
			otherGrammar.registerPOS(pos2);

			grammar.addPosList(otherGrammar);

			expect(grammar.getPartOfSpeechSize()).toBe(2);
			expect(grammar.getSystemPartOfSpeechSize()).toBe(0);
		});

		test('should set and get character category', () => {
			const charCategory = { test: 'category' } as any;
			grammar.setCharacterCategory(charCategory);

			expect(grammar.getCharacterCategory()).toBe(charCategory);
		});

		test('should get BOS parameter', () => {
			const param = grammar.getBOSParameter();
			expect(param).toEqual([0, 0, 0]);
		});

		test('should get EOS parameter', () => {
			const param = grammar.getEOSParameter();
			expect(param).toEqual([0, 0, 0]);
		});

		test('should check INHIBITED_CONNECTION constant', () => {
			expect(grammar.INHIBITED_CONNECTION).toBe(0x7fff);
		});

		test('should invalidate grammar', () => {
			grammar.invalidate();
			expect(grammar.isValid()).toBe(false);
		});

		test('should throw error when getting connection cost from invalid grammar', () => {
			expect(() => grammar.getConnectCost(0, 0)).toThrow(
				'Connection matrix is not initialized',
			);
		});

		test('should throw error when setting connection cost on invalid grammar', () => {
			expect(() => grammar.setConnectCost(0, 0, 100)).toThrow(
				'Connection matrix is not initialized',
			);
		});

		test('should throw error when getting connection from invalid grammar', () => {
			expect(() => grammar.getConnection()).toThrow(
				'Connection matrix is not initialized',
			);
		});
	});

	describe('constructor with binary data', () => {
		function createGrammarBytes(
			posList: string[][],
			leftIdSize: number,
			rightIdSize: number,
			costs: number[],
		): Uint8Array {
			const bytes: number[] = [];

			bytes.push(posList.length & 0xff, (posList.length >> 8) & 0xff);

			for (const pos of posList) {
				for (let i = 0; i < 6; i++) {
					const str = pos[i]!;
					bytes.push(str.length);
					for (let j = 0; j < str.length; j++) {
						const code = str.charCodeAt(j);
						bytes.push(code & 0xff);
						bytes.push((code >> 8) & 0xff);
					}
				}
			}

			while (bytes.length % 4 !== 0) {
				bytes.push(0);
			}

			bytes.push(leftIdSize & 0xff, (leftIdSize >> 8) & 0xff);
			bytes.push(rightIdSize & 0xff, (rightIdSize >> 8) & 0xff);

			const numCosts = leftIdSize * rightIdSize;

			for (let i = 0; i < numCosts; i++) {
				const cost = costs[i] ?? 0;
				bytes.push(cost & 0xff);
				bytes.push((cost >> 8) & 0xff);
			}

			return new Uint8Array(bytes);
		}

		test('should create grammar from binary data', () => {
			const posList = [
				['名詞', '一般', '*', '*', '*', '*'],
				['動詞', '一般', '*', '*', '*', '*'],
			];
			const leftIdSize = 2;
			const rightIdSize = 2;
			const costs = [10, 20, 30, 40];
			const bytes = createGrammarBytes(posList, leftIdSize, rightIdSize, costs);

			const grammar = new GrammarImpl(bytes, 0);

			expect(grammar.getPartOfSpeechSize()).toBe(2);
			expect(grammar.getSystemPartOfSpeechSize()).toBe(2);
			expect(grammar.isValid()).toBe(true);
		});

		test('should get POS by id from binary data', () => {
			const posList = [
				['名詞', '一般', '*', '*', '*', '*'],
				['動詞', '一般', '*', '*', '*', '*'],
			];
			const leftIdSize = 2;
			const rightIdSize = 2;
			const costs = [10, 20, 30, 40];
			const bytes = createGrammarBytes(posList, leftIdSize, rightIdSize, costs);

			const grammar = new GrammarImpl(bytes, 0);

			const pos0 = grammar.getPartOfSpeechString(0);
			expect(pos0.get(0)).toBe('名詞');
			expect(pos0.get(1)).toBe('一般');

			const pos1 = grammar.getPartOfSpeechString(1);
			expect(pos1.get(0)).toBe('動詞');
		});

		test('should get connection cost from binary data', () => {
			const posList = [['名詞', '一般', '*', '*', '*', '*']];
			const leftIdSize = 1;
			const rightIdSize = 2;
			const costs = [100, 200];
			const bytes = createGrammarBytes(posList, leftIdSize, rightIdSize, costs);

			const grammar = new GrammarImpl(bytes, 0);

			expect(grammar.getConnectCost(0, 0)).toBe(100);
			expect(grammar.getConnectCost(0, 1)).toBe(200);
		});

		test('should set connection cost on grammar from binary data', () => {
			const posList = [['名詞', '一般', '*', '*', '*', '*']];
			const leftIdSize = 1;
			const rightIdSize = 2;
			const costs = [100, 200];
			const bytes = createGrammarBytes(posList, leftIdSize, rightIdSize, costs);

			const grammar = new GrammarImpl(bytes, 0);

			grammar.setConnectCost(0, 0, 999);
			expect(grammar.getConnectCost(0, 0)).toBe(999);
			expect(grammar.getConnectCost(0, 1)).toBe(200);
		});

		test('should throw error for invalid POS id from binary data', () => {
			const posList = [['名詞', '一般', '*', '*', '*', '*']];
			const leftIdSize = 1;
			const rightIdSize = 1;
			const costs = [100];
			const bytes = createGrammarBytes(posList, leftIdSize, rightIdSize, costs);

			const grammar = new GrammarImpl(bytes, 0);

			expect(() => grammar.getPartOfSpeechString(1)).toThrow(
				'POS ID out of bounds: 1',
			);
		});

		test('should get connection object', () => {
			const posList = [['名詞', '一般', '*', '*', '*', '*']];
			const costs = [100, 200, 300, 400];
			const bytes = createGrammarBytes(posList, 2, 2, costs);

			const grammar = new GrammarImpl(bytes, 0);
			const conn = grammar.getConnection();

			expect(conn).toBeInstanceOf(Connection);
			expect(conn.getLeftSize()).toBe(2);
			expect(conn.getRightSize()).toBe(2);
		});

		test('should handle UTF-16 characters in POS strings', () => {
			const posList = [['名詞', '一般', '*', '*', '*', '*']];
			const leftIdSize = 1;
			const rightIdSize = 1;
			const costs = [100];
			const bytes = createGrammarBytes(posList, leftIdSize, rightIdSize, costs);

			const grammar = new GrammarImpl(bytes, 0);
			const pos = grammar.getPartOfSpeechString(0);

			expect(pos.get(0)).toBe('名詞');
		});

		test('should calculate storage size correctly', () => {
			const posList = [['名詞', '一般', '*', '*', '*', '*']];
			const leftIdSize = 2;
			const rightIdSize = 2;
			const costs = [100, 200, 300, 400];
			const bytes = createGrammarBytes(posList, leftIdSize, rightIdSize, costs);

			const grammar = new GrammarImpl(bytes, 0);
			const storageSize = grammar.getStorageSize();

			expect(storageSize).toBeGreaterThan(0);
		});

		test('should find POS id by string', () => {
			const posList = [['名詞', '一般', '*', '*', '*', '*']];
			const leftIdSize = 1;
			const rightIdSize = 1;
			const costs = [100];
			const bytes = createGrammarBytes(posList, leftIdSize, rightIdSize, costs);

			const grammar = new GrammarImpl(bytes, 0);

			const id = grammar.getPartOfSpeechId([
				'名詞',
				'一般',
				'*',
				'*',
				'*',
				'*',
			]);
			expect(id).toBe(0);

			const id2 = grammar.getPartOfSpeechId([
				'動詞',
				'一般',
				'*',
				'*',
				'*',
				'*',
			]);
			expect(id2).toBe(-1);
		});

		test('should return -1 for non-existent POS string', () => {
			const posList = [['名詞', '一般', '*', '*', '*', '*']];
			const leftIdSize = 1;
			const rightIdSize = 1;
			const costs = [100];
			const bytes = createGrammarBytes(posList, leftIdSize, rightIdSize, costs);

			const grammar = new GrammarImpl(bytes, 0);

			const id = grammar.getPartOfSpeechId([
				'動詞',
				'一般',
				'*',
				'*',
				'*',
				'*',
			]);
			expect(id).toBe(-1);
		});

		test('should add POS list and maintain system size', () => {
			const posList = [['名詞', '一般', '*', '*', '*', '*']];
			const leftIdSize = 1;
			const rightIdSize = 1;
			const costs = [100];
			const bytes = createGrammarBytes(posList, leftIdSize, rightIdSize, costs);

			const grammar = new GrammarImpl(bytes, 0);
			const otherGrammar = new GrammarImpl();
			const pos2 = new POS('動詞', '一般', '*', '*', '*', '*');
			otherGrammar.registerPOS(pos2);

			grammar.addPosList(otherGrammar);

			expect(grammar.getPartOfSpeechSize()).toBe(2);
			expect(grammar.getSystemPartOfSpeechSize()).toBe(1);
		});

		test('should register new POS on grammar from binary data', () => {
			const posList = [['名詞', '一般', '*', '*', '*', '*']];
			const leftIdSize = 1;
			const rightIdSize = 1;
			const costs = [100];
			const bytes = createGrammarBytes(posList, leftIdSize, rightIdSize, costs);

			const grammar = new GrammarImpl(bytes, 0);
			const pos2 = new POS('動詞', '一般', '*', '*', '*', '*');
			const id = grammar.registerPOS(pos2);

			expect(id).toBe(1);
			expect(grammar.getPartOfSpeechSize()).toBe(2);
		});

		test('should throw error for connection cost out of bounds', () => {
			const posList = [['名詞', '一般', '*', '*', '*', '*']];
			const leftIdSize = 1;
			const rightIdSize = 1;
			const costs = [100];
			const bytes = createGrammarBytes(posList, leftIdSize, rightIdSize, costs);

			const grammar = new GrammarImpl(bytes, 0);

			expect(() => grammar.getConnectCost(0, 1)).toThrow();
		});
	});
});
