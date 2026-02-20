import { describe, expect, test } from 'vitest';
import { Settings } from '../../../src/config/settings.js';
import type { LatticeNodeImpl } from '../../../src/core/lattice.js';
import { UTF8InputTextBuilder } from '../../../src/core/utf8InputText.js';
import { Connection } from '../../../src/dictionary/connection.js';
import type { Grammar } from '../../../src/dictionary/grammar.js';
import { POS } from '../../../src/dictionary/pos.js';
import { SimpleOovProviderPlugin } from '../../../src/plugins/oov/simpleOovProviderPlugin.js';

function createMockGrammar(): Grammar {
	const matrix = new Int16Array([0]);
	const connection = new Connection(matrix, 1, 1);
	const knownPos = ['名詞', '普通名詞', '一般', '*', '*', '*'];
	const knownPosId = 0;

	return {
		getPartOfSpeechSize: () => 1,
		getPartOfSpeechString: (_posId: number) => new POS(...knownPos),
		getPartOfSpeechId: (pos: string[]) =>
			pos.join(',') === knownPos.join(',') ? knownPosId : -1,
		getConnectCost: (_left: number, _right: number) => 0,
		setConnectCost: (_left: number, _right: number, _cost: number) => {},
		getBOSParameter: () => [0, 0, 0],
		getEOSParameter: () => [0, 0, 0],
		getCharacterCategory: () => null,
		setCharacterCategory: (_charCategory) => {},
		INHIBITED_CONNECTION: 0x7fff,
		getConnection: () => connection,
		isValid: () => true,
		getStorageSize: () => 0,
	};
}

describe('SimpleOovProviderPlugin', () => {
	test('builds OOV from the requested offset', () => {
		const grammar = createMockGrammar();
		const plugin = new SimpleOovProviderPlugin();
		plugin.setSettings(
			new Settings({
				oovPOS: ['名詞', '普通名詞', '一般', '*', '*', '*'],
				leftId: 0,
				rightId: 0,
				cost: 30000,
			}),
		);
		plugin.setUp(grammar);

		const input = new UTF8InputTextBuilder('です\nです', grammar).build();
		const nodes: LatticeNodeImpl[] = [];

		const created = plugin.getOOV(input, 6, 0, nodes);

		expect(created).toBe(1);
		expect(nodes[0]?.getWordInfo().getSurface()).toBe('\n');
		expect(nodes[0]?.getWordInfo().getLength()).toBe(1);
		expect(nodes[0]?.getBegin()).toBe(6);
		expect(nodes[0]?.getEnd()).toBe(7);
	});

	test('does not create OOV when dictionary entries already exist', () => {
		const grammar = createMockGrammar();
		const plugin = new SimpleOovProviderPlugin();
		plugin.setSettings(
			new Settings({
				oovPOS: ['名詞', '普通名詞', '一般', '*', '*', '*'],
				leftId: 0,
				rightId: 0,
				cost: 30000,
			}),
		);
		plugin.setUp(grammar);

		const input = new UTF8InputTextBuilder('です\nです', grammar).build();
		const nodes: LatticeNodeImpl[] = [];

		const created = plugin.getOOV(input, 6, 1, nodes);

		expect(created).toBe(0);
		expect(nodes).toHaveLength(0);
	});
});
