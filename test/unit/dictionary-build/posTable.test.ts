import { beforeEach, describe, expect, test } from 'vitest';
import { POS } from '../../../src/dictionary/pos.js';
import { POSTable } from '../../../src/dictionary-build/posTable.js';

describe('POSTable', () => {
	let posTable: POSTable;

	beforeEach(() => {
		posTable = new POSTable();
	});

	test('should add and retrieve POS', () => {
		const pos = new POS('名詞', '普通名詞', '一般', '*', '*', '*');
		const id = posTable.getId(pos);
		expect(id).toBe(0);
		expect(posTable.getPOS(id)).toEqual(pos);
	});

	test('should return same ID for duplicate POS', () => {
		const pos1 = new POS('名詞', '普通名詞', '一般', '*', '*', '*');
		const pos2 = new POS('名詞', '普通名詞', '一般', '*', '*', '*');
		const id1 = posTable.getId(pos1);
		const id2 = posTable.getId(pos2);
		expect(id1).toBe(id2);
		expect(id1).toBe(0);
	});

	test('should increment ID for different POS', () => {
		const pos1 = new POS('名詞', '普通名詞', '一般', '*', '*', '*');
		const pos2 = new POS('動詞', '一般', '*', '*', '*', '*');
		const id1 = posTable.getId(pos1);
		const id2 = posTable.getId(pos2);
		expect(id2).toBe(id1 + 1);
	});

	test('should track size correctly', () => {
		expect(posTable.size()).toBe(0);
		posTable.getId(new POS('名詞', '普通名詞', '一般', '*', '*', '*'));
		expect(posTable.size()).toBe(1);
	});

	test('should get POS list', () => {
		const pos1 = new POS('名詞', '普通名詞', '一般', '*', '*', '*');
		const pos2 = new POS('動詞', '一般', '*', '*', '*', '*');
		posTable.getId(pos1);
		posTable.getId(pos2);
		const list = posTable.getList();
		expect(list.length).toBe(2);
	});
});
