import { describe, expect, test } from 'bun:test';
import { Settings } from '../../../src/config/settings.js';
import type { InputText } from '../../../src/core/inputText.js';
import { type Lattice, LatticeNodeImpl } from '../../../src/core/lattice.js';
import { Connection } from '../../../src/dictionary/connection.js';
import type { Grammar } from '../../../src/dictionary/grammar.js';
import { POS } from '../../../src/dictionary/pos.js';
import { WordInfo } from '../../../src/dictionary/wordInfo.js';
import { TokenChunkerPlugin } from '../../../src/plugins/pathRewrite/tokenChunkerPlugin.js';

function createGrammar(): Grammar {
	const connection = new Connection(new Int16Array([0]), 1, 1);
	const posById = new Map<number, POS>([
		[1, new POS('名詞', '普通名詞', '一般', '*', '*', '*')],
		[2, new POS('助詞', '格助詞', '一般', '*', '*', '*')],
		[3, new POS('名詞', '数詞', '*', '*', '*', '*')],
		[4, new POS('助詞', '接続助詞', '*', '*', '*', '*')],
		[5, new POS('動詞', '一般', '*', '*', '*', '*')],
		[6, new POS('動詞', '非自立可能', '*', '*', '*', '*')],
		[7, new POS('助動詞', '*', '*', '*', '*', '*')],
		[8, new POS('代名詞', '*', '*', '*', '*', '*')],
		[9, new POS('副詞', '*', '*', '*', '*', '*')],
		[10, new POS('接続詞', '*', '*', '*', '*', '*')],
		[11, new POS('接頭辞', '*', '*', '*', '*', '*')],
		[12, new POS('形容詞', '一般', '*', '*', '*', '*')],
		[13, new POS('補助記号', '一般', '*', '*', '*', '*')],
	]);

	return {
		getPartOfSpeechSize: () => posById.size,
		getPartOfSpeechString: (posId: number) => {
			const pos = posById.get(posId);
			if (!pos) {
				throw new Error(`unknown pos id: ${posId}`);
			}
			return pos;
		},
		getPartOfSpeechId: () => -1,
		getConnectCost: () => 0,
		setConnectCost: () => {},
		getBOSParameter: () => [0, 0, 0],
		getEOSParameter: () => [0, 0, 0],
		getCharacterCategory: () => null,
		setCharacterCategory: () => {},
		INHIBITED_CONNECTION: 0x7fff,
		getConnection: () => connection,
		isValid: () => true,
		getStorageSize: () => 0,
	};
}

function createLattice(): Lattice {
	return {
		getNodesWithEnd: () => [],
		getNodes: () => [],
		getMinimumNode: () => null,
		insert: () => {},
		remove: () => {},
		createNode: () => new LatticeNodeImpl(null, 0, 0, 0, -1),
		resize: () => {},
		clear: () => {},
		hasPreviousNode: () => false,
		connectEosNode: () => {},
		getBestPath: () => [],
	};
}

function createNode(
	surface: string,
	posId: number,
	begin: number,
	end: number,
): LatticeNodeImpl {
	const node = new LatticeNodeImpl(null, 0, 0, 0, -1);
	node.setRange(begin, end);
	node.setWordInfo(
		new WordInfo(surface, end - begin, posId, surface, surface, surface),
	);
	return node;
}

function createNodeWithDict(
	surface: string,
	dictionaryForm: string,
	posId: number,
	begin: number,
	end: number,
): LatticeNodeImpl {
	const node = new LatticeNodeImpl(null, 0, 0, 0, -1);
	node.setRange(begin, end);
	node.setWordInfo(
		new WordInfo(surface, end - begin, posId, surface, dictionaryForm, surface),
	);
	return node;
}

function createNodeWithForms(
	surface: string,
	dictionaryForm: string,
	reading: string,
	posId: number,
	begin: number,
	end: number,
): LatticeNodeImpl {
	const node = new LatticeNodeImpl(null, 0, 0, 0, -1);
	node.setRange(begin, end);
	node.setWordInfo(
		new WordInfo(surface, end - begin, posId, surface, dictionaryForm, reading),
	);
	return node;
}

function createInputText(): InputText {
	return {} as InputText;
}

type NodeSpec = {
	surface: string;
	posId: number;
	dictionaryForm?: string;
	reading?: string;
};

function createPath(specs: NodeSpec[]): LatticeNodeImpl[] {
	const path: LatticeNodeImpl[] = [];
	let begin = 0;
	for (const spec of specs) {
		const end = begin + spec.surface.length;
		const dictionaryForm = spec.dictionaryForm ?? spec.surface;
		const reading = spec.reading ?? spec.surface;
		path.push(
			createNodeWithForms(
				spec.surface,
				dictionaryForm,
				reading,
				spec.posId,
				begin,
				end,
			),
		);
		begin = end;
	}
	return path;
}

function createPatternOnlyPlugin(): TokenChunkerPlugin {
	const plugin = new TokenChunkerPlugin();
	plugin.setSettings(
		new Settings({
			enablePatternRules: true,
			enableCompoundNouns: false,
		}),
	);
	plugin.setUp(createGrammar());
	return plugin;
}

describe('TokenChunkerPlugin', () => {
	test('merges consecutive nouns into one chunk', () => {
		const plugin = new TokenChunkerPlugin();
		plugin.setSettings(new Settings({}));
		plugin.setUp(createGrammar());

		const path = [createNode('東京', 1, 0, 2), createNode('大学', 1, 2, 4)];
		plugin.rewrite(createInputText(), path, createLattice());

		expect(path.length).toBe(1);
		expect(path[0]?.getWordInfo().getSurface()).toBe('東京大学');
	});

	test('does not merge across non-noun tokens', () => {
		const plugin = new TokenChunkerPlugin();
		plugin.setSettings(new Settings({}));
		plugin.setUp(createGrammar());

		const path = [
			createNode('東京', 1, 0, 2),
			createNode('で', 2, 2, 3),
			createNode('大学', 1, 3, 5),
		];
		plugin.rewrite(createInputText(), path, createLattice());

		expect(path.length).toBe(3);
		expect(path[0]?.getWordInfo().getSurface()).toBe('東京');
		expect(path[2]?.getWordInfo().getSurface()).toBe('大学');
	});

	test('does not merge excluded noun subcategory by default', () => {
		const plugin = new TokenChunkerPlugin();
		plugin.setSettings(new Settings({}));
		plugin.setUp(createGrammar());

		const path = [createNode('番号', 1, 0, 2), createNode('一', 3, 2, 3)];
		plugin.rewrite(createInputText(), path, createLattice());

		expect(path.length).toBe(2);
	});

	test('merges fixed expression わけがない', () => {
		const plugin = new TokenChunkerPlugin();
		plugin.setSettings(new Settings({ enableCompoundNouns: false }));
		plugin.setUp(createGrammar());

		const path = [
			createNode('わけ', 1, 0, 2),
			createNode('が', 2, 2, 3),
			createNode('ない', 7, 3, 5),
		];
		plugin.rewrite(createInputText(), path, createLattice());

		expect(path.length).toBe(1);
		expect(path[0]?.getWordInfo().getSurface()).toBe('わけがない');
	});

	test('merges suru progressive sequence', () => {
		const plugin = new TokenChunkerPlugin();
		plugin.setSettings(new Settings({ enableCompoundNouns: false }));
		plugin.setUp(createGrammar());

		const path = [
			createNode('勉強', 1, 0, 2),
			createNode('し', 6, 2, 3),
			createNode('て', 4, 3, 4),
			createNode('い', 6, 4, 5),
			createNode('る', 7, 5, 6),
		];
		path[1]?.setWordInfo(new WordInfo('し', 1, 6, 'し', 'する', 'シ'));
		path[3]?.setWordInfo(new WordInfo('い', 1, 6, 'い', 'いる', 'イ'));
		plugin.rewrite(createInputText(), path, createLattice());

		expect(path.length).toBe(1);
		expect(path[0]?.getWordInfo().getSurface()).toBe('勉強している');
	});

	test('merges pronoun + の', () => {
		const plugin = new TokenChunkerPlugin();
		plugin.setSettings(new Settings({ enableCompoundNouns: false }));
		plugin.setUp(createGrammar());

		const path = [createNode('私', 8, 0, 1), createNode('の', 2, 1, 2)];
		plugin.rewrite(createInputText(), path, createLattice());

		expect(path.length).toBe(1);
		expect(path[0]?.getWordInfo().getSurface()).toBe('私の');
	});

	test('merges については sequence', () => {
		const plugin = new TokenChunkerPlugin();
		plugin.setSettings(new Settings({ enableCompoundNouns: false }));
		plugin.setUp(createGrammar());

		const path = [
			createNode('に', 2, 0, 1),
			createNodeWithDict('つい', 'つく', 5, 1, 3),
			createNode('て', 4, 3, 4),
			createNode('は', 2, 4, 5),
		];
		plugin.rewrite(createInputText(), path, createLattice());

		expect(path.length).toBe(1);
		expect(path[0]?.getWordInfo().getSurface()).toBe('については');
	});

	test('merges quotative というのは sequence', () => {
		const plugin = new TokenChunkerPlugin();
		plugin.setSettings(new Settings({ enableCompoundNouns: false }));
		plugin.setUp(createGrammar());

		const path = [
			createNode('と', 2, 0, 1),
			createNodeWithDict('いう', 'いう', 5, 1, 3),
			createNode('の', 2, 3, 4),
			createNode('は', 2, 4, 5),
		];
		plugin.rewrite(createInputText(), path, createLattice());

		expect(path.length).toBe(1);
		expect(path[0]?.getWordInfo().getSurface()).toBe('というのは');
	});

	test('merges conjunction だけではなく', () => {
		const plugin = new TokenChunkerPlugin();
		plugin.setSettings(new Settings({ enableCompoundNouns: false }));
		plugin.setUp(createGrammar());

		const path = [
			createNode('だけ', 2, 0, 2),
			createNode('で', 2, 2, 3),
			createNode('は', 2, 3, 4),
			createNode('なく', 7, 4, 6),
		];
		plugin.rewrite(createInputText(), path, createLattice());

		expect(path.length).toBe(1);
		expect(path[0]?.getWordInfo().getSurface()).toBe('だけではなく');
	});

	test('merges verb progressive past sequence', () => {
		const plugin = new TokenChunkerPlugin();
		plugin.setSettings(new Settings({ enableCompoundNouns: false }));
		plugin.setUp(createGrammar());

		const path = [
			createNode('読ん', 5, 0, 2),
			createNode('で', 4, 2, 3),
			createNodeWithDict('い', 'いる', 6, 3, 4),
			createNode('た', 7, 4, 5),
		];
		plugin.rewrite(createInputText(), path, createLattice());

		expect(path.length).toBe(1);
		expect(path[0]?.getWordInfo().getSurface()).toBe('読んでいた');
	});

	test('does not apply broad rules by default', () => {
		const plugin = new TokenChunkerPlugin();
		plugin.setSettings(
			new Settings({ enablePatternRules: true, enableCompoundNouns: false }),
		);
		plugin.setUp(createGrammar());

		const path = [createNode('三人', 1, 0, 2), createNode('で', 2, 2, 3)];
		plugin.rewrite(createInputText(), path, createLattice());

		expect(path.length).toBe(2);
	});

	test('applies broad rules when enabled', () => {
		const plugin = new TokenChunkerPlugin();
		plugin.setSettings(
			new Settings({
				enablePatternRules: true,
				enableBroadRules: true,
				enableCompoundNouns: false,
			}),
		);
		plugin.setUp(createGrammar());

		const path = [createNode('三人', 1, 0, 2), createNode('で', 2, 2, 3)];
		plugin.rewrite(createInputText(), path, createLattice());

		expect(path.length).toBe(1);
		expect(path[0]?.getWordInfo().getSurface()).toBe('三人で');
	});

	test('normalizes counter reading for 本', () => {
		const plugin = new TokenChunkerPlugin();
		plugin.setSettings(
			new Settings({
				enablePatternRules: true,
				enableCompoundNouns: false,
			}),
		);
		plugin.setUp(createGrammar());

		const path = [
			createNodeWithForms('三', '三', 'サン', 3, 0, 1),
			createNodeWithForms('本', '本', 'ホン', 1, 1, 2),
		];
		plugin.rewrite(createInputText(), path, createLattice());

		expect(path.length).toBe(1);
		expect(path[0]?.getWordInfo().getReadingForm()).toBe('サンボン');
	});

	test('normalizes day counter reading for 一日', () => {
		const plugin = new TokenChunkerPlugin();
		plugin.setSettings(
			new Settings({
				enablePatternRules: true,
				enableCompoundNouns: false,
			}),
		);
		plugin.setUp(createGrammar());

		const path = [
			createNodeWithForms('一', '一', 'イチ', 3, 0, 1),
			createNodeWithForms('日', '日', 'ニチ', 1, 1, 2),
		];
		plugin.rewrite(createInputText(), path, createLattice());

		expect(path.length).toBe(1);
		expect(path[0]?.getWordInfo().getReadingForm()).toBe('ツイタチ');
	});

	test('normalizes counter reading for 本 with suffix', () => {
		const plugin = new TokenChunkerPlugin();
		plugin.setSettings(
			new Settings({
				enablePatternRules: true,
				enableCompoundNouns: false,
			}),
		);
		plugin.setUp(createGrammar());

		const path = [
			createNodeWithForms('三', '三', 'サン', 3, 0, 1),
			createNodeWithForms('本', '本', 'ホン', 1, 1, 2),
			createNodeWithForms('目', '目', 'メ', 1, 2, 3),
		];
		plugin.rewrite(createInputText(), path, createLattice());

		expect(path.length).toBe(1);
		expect(path[0]?.getWordInfo().getReadingForm()).toBe('サンボンメ');
	});

	test('normalizes day counter reading for 一日 with suffix', () => {
		const plugin = new TokenChunkerPlugin();
		plugin.setSettings(
			new Settings({
				enablePatternRules: true,
				enableCompoundNouns: false,
			}),
		);
		plugin.setUp(createGrammar());

		const path = [
			createNodeWithForms('一', '一', 'イチ', 3, 0, 1),
			createNodeWithForms('日', '日', 'ニチ', 1, 1, 2),
			createNodeWithForms('後', '後', 'ゴ', 1, 2, 3),
		];
		plugin.rewrite(createInputText(), path, createLattice());

		expect(path.length).toBe(1);
		expect(path[0]?.getWordInfo().getReadingForm()).toBe('ツイタチゴ');
	});

	test('keeps compositional reading for 一日 when followed by another counter phrase', () => {
		const plugin = new TokenChunkerPlugin();
		plugin.setSettings(
			new Settings({
				enablePatternRules: true,
				enableCompoundNouns: false,
			}),
		);
		plugin.setUp(createGrammar());

		const path = [
			createNodeWithForms('一', '一', 'イチ', 3, 0, 1),
			createNodeWithForms('日', '日', 'ニチ', 1, 1, 2),
			createNodeWithForms('三', '三', 'サン', 3, 2, 3),
			createNodeWithForms('回', '回', 'カイ', 1, 3, 4),
		];
		plugin.rewrite(createInputText(), path, createLattice());

		expect(path.length).toBe(2);
		expect(path[0]?.getWordInfo().getReadingForm()).toBe('イチニチ');
		expect(path[1]?.getWordInfo().getReadingForm()).toBe('サンカイ');
	});

	test('merges consecutive numbers into one chunk', () => {
		const plugin = new TokenChunkerPlugin();
		plugin.setSettings(
			new Settings({
				enablePatternRules: true,
				enableCompoundNouns: false,
			}),
		);
		plugin.setUp(createGrammar());

		const path = [
			createNodeWithForms('1', '1', 'イチ', 3, 0, 1),
			createNodeWithForms('5', '5', 'ゴ', 3, 1, 2),
			createNodeWithForms('0', '0', 'ゼロ', 3, 2, 3),
		];
		plugin.rewrite(createInputText(), path, createLattice());

		expect(path.length).toBe(1);
		expect(path[0]?.getWordInfo().getSurface()).toBe('150');
	});

	test('merges comma-separated numbers into one chunk', () => {
		const plugin = new TokenChunkerPlugin();
		plugin.setSettings(
			new Settings({
				enablePatternRules: true,
				enableCompoundNouns: false,
			}),
		);
		plugin.setUp(createGrammar());

		const path = [
			createNodeWithForms('1', '1', 'イチ', 3, 0, 1),
			createNodeWithForms(',', ',', ',', 13, 1, 2),
			createNodeWithForms('000', '000', 'ゼロゼロゼロ', 3, 2, 5),
			createNodeWithForms(',', ',', ',', 13, 5, 6),
			createNodeWithForms('000', '000', 'ゼロゼロゼロ', 3, 6, 9),
		];
		plugin.rewrite(createInputText(), path, createLattice());

		expect(path.length).toBe(1);
		expect(path[0]?.getWordInfo().getSurface()).toBe('1,000,000');
	});

	test('merges signed decimal numbers into one chunk', () => {
		const plugin = new TokenChunkerPlugin();
		plugin.setSettings(
			new Settings({
				enablePatternRules: true,
				enableCompoundNouns: false,
			}),
		);
		plugin.setUp(createGrammar());

		const path = [
			createNodeWithForms('−', '−', '−', 13, 0, 1),
			createNodeWithForms('2', '2', 'ニ', 3, 1, 2),
			createNodeWithForms('.', '.', '.', 13, 2, 3),
			createNodeWithForms('8', '8', 'ハチ', 3, 3, 4),
		];
		plugin.rewrite(createInputText(), path, createLattice());

		expect(path.length).toBe(1);
		expect(path[0]?.getWordInfo().getSurface()).toBe('−2.8');
		expect(path[0]?.getWordInfo().getReadingForm()).toBe('マイナスニテンハチ');
	});

	test('does not partially merge version-like multi-dot number sequences', () => {
		const plugin = new TokenChunkerPlugin();
		plugin.setSettings(
			new Settings({
				enablePatternRules: true,
				enableCompoundNouns: false,
			}),
		);
		plugin.setUp(createGrammar());

		const path = [
			createNodeWithForms('2', '2', 'ニ', 3, 0, 1),
			createNodeWithForms('.', '.', '.', 13, 1, 2),
			createNodeWithForms('1', '1', 'イチ', 3, 2, 3),
			createNodeWithForms('.', '.', '.', 13, 3, 4),
			createNodeWithForms('0', '0', 'ゼロ', 3, 4, 5),
		];
		plugin.rewrite(createInputText(), path, createLattice());

		expect(path.length).toBe(5);
	});

	test('does not merge blocked noun suffix like 以上 in compound stage', () => {
		const plugin = new TokenChunkerPlugin();
		plugin.setSettings(
			new Settings({
				enablePatternRules: false,
				enableCompoundNouns: true,
			}),
		);
		plugin.setUp(createGrammar());

		const path = [createNode('通り', 1, 0, 2), createNode('以上', 1, 2, 4)];
		plugin.rewrite(createInputText(), path, createLattice());

		expect(path.length).toBe(2);
	});

	test('does not merge symbol with following noun in compound stage', () => {
		const plugin = new TokenChunkerPlugin();
		plugin.setSettings(
			new Settings({
				enablePatternRules: false,
				enableCompoundNouns: true,
			}),
		);
		plugin.setUp(createGrammar());

		const path = [createNode('%', 13, 0, 1), createNode('増加', 1, 1, 3)];
		plugin.rewrite(createInputText(), path, createLattice());

		expect(path.length).toBe(2);
	});

	test('does not merge non-single chunks as compound nouns', () => {
		const plugin = new TokenChunkerPlugin();
		plugin.setSettings(
			new Settings({
				enablePatternRules: true,
				enableCompoundNouns: true,
			}),
		);
		plugin.setUp(createGrammar());

		const path = [
			createNodeWithForms('何度', '何度', 'ナンド', 1, 0, 2),
			createNodeWithForms('注意', '注意', 'チュウイ', 1, 2, 4),
			createNodeWithForms('し', 'する', 'シ', 5, 4, 5),
			createNodeWithForms('て', 'て', 'テ', 4, 5, 6),
		];
		plugin.rewrite(createInputText(), path, createLattice());

		expect(path.length).toBe(2);
		expect(path[0]?.getWordInfo().getSurface()).toBe('何度');
		expect(path[1]?.getWordInfo().getSurface()).toBe('注意して');
	});

	test('does not merge まま with following noun as compound noun', () => {
		const plugin = new TokenChunkerPlugin();
		plugin.setSettings(
			new Settings({
				enablePatternRules: false,
				enableCompoundNouns: true,
			}),
		);
		plugin.setUp(createGrammar());

		const path = [
			createNodeWithForms('まま', 'まま', 'ママ', 1, 0, 2),
			createNodeWithForms('エアコン', 'エアコン', 'エアコン', 1, 2, 6),
		];
		plugin.rewrite(createInputText(), path, createLattice());

		expect(path.length).toBe(2);
	});

	test('merges requested colloquial and conversational expressions', () => {
		const cases: Array<{
			name: string;
			expected: string;
			specs: NodeSpec[];
		}> = [
			{
				name: '僕じゃない',
				expected: '僕じゃない',
				specs: [
					{ surface: '僕', posId: 8 },
					{ surface: 'じゃ', posId: 2 },
					{ surface: 'ない', posId: 7 },
				],
			},
			{
				name: 'noun + じゃ + ない (words like 僕じゃない)',
				expected: '嘘じゃない',
				specs: [
					{ surface: '嘘', posId: 1 },
					{ surface: 'じゃ', posId: 2 },
					{ surface: 'ない', posId: 7 },
				],
			},
			{
				name: '方がいい',
				expected: '方がいい',
				specs: [
					{ surface: '方', posId: 1 },
					{ surface: 'が', posId: 2 },
					{ surface: 'いい', posId: 12 },
				],
			},
			{
				name: 'んじゃない',
				expected: 'んじゃない',
				specs: [
					{ surface: 'ん', posId: 1 },
					{ surface: 'じゃ', posId: 2 },
					{ surface: 'ない', posId: 7 },
				],
			},
			{
				name: 'じゃない',
				expected: 'じゃない',
				specs: [
					{ surface: 'じゃ', posId: 2 },
					{ surface: 'ない', posId: 7 },
				],
			},
			{
				name: 'だもん',
				expected: 'だもん',
				specs: [
					{ surface: 'だ', posId: 7 },
					{ surface: 'もん', posId: 1 },
				],
			},
			{
				name: 'なんで',
				expected: 'なんで',
				specs: [
					{ surface: 'なん', posId: 8 },
					{ surface: 'で', posId: 2 },
				],
			},
			{
				name: '何で',
				expected: '何で',
				specs: [
					{ surface: '何', posId: 8 },
					{ surface: 'で', posId: 2 },
				],
			},
			{
				name: '見たい',
				expected: '見たい',
				specs: [
					{ surface: '見', posId: 5, dictionaryForm: '見る', reading: 'ミ' },
					{ surface: 'たい', posId: 7 },
				],
			},
			{
				name: '爆発した',
				expected: '爆発した',
				specs: [
					{ surface: '爆発', posId: 1 },
					{ surface: 'し', posId: 5, dictionaryForm: 'する', reading: 'シ' },
					{ surface: 'た', posId: 7 },
				],
			},
			{
				name: '感動した',
				expected: '感動した',
				specs: [
					{ surface: '感動', posId: 1 },
					{ surface: 'した', posId: 5, dictionaryForm: 'する', reading: 'シタ' },
				],
			},
			{
				name: 'スカっとした',
				expected: 'スカっとした',
				specs: [
					{ surface: 'スカ', posId: 9 },
					{ surface: 'っと', posId: 2 },
					{ surface: 'し', posId: 5, dictionaryForm: 'する', reading: 'シ' },
					{ surface: 'た', posId: 7 },
				],
			},
			{
				name: 'verb + たい (words like 見たい)',
				expected: '食べたい',
				specs: [
					{
						surface: '食べ',
						posId: 5,
						dictionaryForm: '食べる',
						reading: 'タベ',
					},
					{ surface: 'たい', posId: 7 },
				],
			},
			{
				name: '貰えた',
				expected: '貰えた',
				specs: [
					{
						surface: '貰え',
						posId: 5,
						dictionaryForm: '貰う',
						reading: 'モラエ',
					},
					{ surface: 'た', posId: 7 },
				],
			},
			{
				name: 'だって',
				expected: 'だって',
				specs: [
					{ surface: 'だ', posId: 7 },
					{ surface: 'って', posId: 2 },
				],
			},
			{
				name: '惚れてる',
				expected: '惚れてる',
				specs: [
					{
						surface: '惚れ',
						posId: 5,
						dictionaryForm: '惚れる',
						reading: 'ホレ',
					},
					{ surface: 'て', posId: 4 },
					{ surface: 'る', posId: 7 },
				],
			},
			{
				name: 'verb + て + る (words like 惚れてる)',
				expected: '泣いてる',
				specs: [
					{
						surface: '泣い',
						posId: 5,
						dictionaryForm: '泣く',
						reading: 'ナイ',
					},
					{ surface: 'て', posId: 4 },
					{ surface: 'る', posId: 7 },
				],
			},
			{
				name: 'だから',
				expected: 'だから',
				specs: [
					{ surface: 'だ', posId: 7 },
					{ surface: 'から', posId: 2 },
				],
			},
			{
				name: 'それに',
				expected: 'それに',
				specs: [
					{ surface: 'それ', posId: 8 },
					{ surface: 'に', posId: 2 },
				],
			},
			{
				name: '作ったって',
				expected: '作ったって',
				specs: [
					{
						surface: '作っ',
						posId: 5,
						dictionaryForm: '作る',
						reading: 'ツクッ',
					},
					{ surface: 'た', posId: 7 },
					{ surface: 'って', posId: 2 },
				],
			},
			{
				name: 'verb + た + って (words like 作ったって)',
				expected: '言ったって',
				specs: [
					{
						surface: '言っ',
						posId: 5,
						dictionaryForm: '言う',
						reading: 'イッ',
					},
					{ surface: 'た', posId: 7 },
					{ surface: 'って', posId: 2 },
				],
			},
			{
				name: 'にならない',
				expected: 'にならない',
				specs: [
					{ surface: 'に', posId: 2 },
					{
						surface: 'なら',
						posId: 5,
						dictionaryForm: 'なる',
						reading: 'ナラ',
					},
					{ surface: 'ない', posId: 7 },
				],
			},
			{
				name: 'もっかい',
				expected: 'もっかい',
				specs: [
					{ surface: 'もっ', posId: 9 },
					{ surface: 'かい', posId: 1 },
				],
			},
			{
				name: 'もう一回',
				expected: 'もう一回',
				specs: [
					{ surface: 'もう', posId: 9 },
					{ surface: '一', posId: 3 },
					{ surface: '回', posId: 1 },
				],
			},
			{
				name: 'もーいっかい',
				expected: 'もーいっかい',
				specs: [
					{ surface: 'もー', posId: 9 },
					{ surface: 'いっ', posId: 3 },
					{ surface: 'かい', posId: 1 },
				],
			},
			{
				name: 'つまんない',
				expected: 'つまんない',
				specs: [
					{ surface: 'つまん', posId: 12 },
					{ surface: 'ない', posId: 7 },
				],
			},
			{
				name: 'つまらない',
				expected: 'つまらない',
				specs: [
					{ surface: 'つまら', posId: 12 },
					{ surface: 'ない', posId: 7 },
				],
			},
			{
				name: '悪くない',
				expected: '悪くない',
				specs: [
					{
						surface: '悪く',
						posId: 12,
						dictionaryForm: '悪い',
						reading: 'ワルク',
					},
					{ surface: 'ない', posId: 7 },
				],
			},
			{
				name: '悪くはない',
				expected: '悪くはない',
				specs: [
					{
						surface: '悪く',
						posId: 12,
						dictionaryForm: '悪い',
						reading: 'ワルク',
					},
					{ surface: 'は', posId: 2 },
					{ surface: 'ない', posId: 7 },
				],
			},
			{
				name: 'では',
				expected: 'では',
				specs: [
					{ surface: 'で', posId: 2 },
					{ surface: 'は', posId: 2 },
				],
			},
			{
				name: 'adjective + ない (words like 悪くない)',
				expected: '高くない',
				specs: [
					{
						surface: '高く',
						posId: 12,
						dictionaryForm: '高い',
						reading: 'タカク',
					},
					{ surface: 'ない', posId: 7 },
				],
			},
			{
				name: '降参っ',
				expected: '降参っ',
				specs: [
					{ surface: '降参', posId: 1 },
					{ surface: 'っ', posId: 13 },
				],
			},
			{
				name: 'します',
				expected: 'します',
				specs: [
					{ surface: 'し', posId: 5, dictionaryForm: 'する', reading: 'シ' },
					{ surface: 'ます', posId: 7 },
				],
			},
			{
				name: 'ぐちゃぐちゃ',
				expected: 'ぐちゃぐちゃ',
				specs: [
					{ surface: 'ぐちゃ', posId: 9 },
					{ surface: 'ぐちゃ', posId: 9 },
				],
			},
			{
				name: '聞きたかった',
				expected: '聞きたかった',
				specs: [
					{
						surface: '聞き',
						posId: 5,
						dictionaryForm: '聞く',
						reading: 'キキ',
					},
					{ surface: 'たかっ', posId: 7 },
					{ surface: 'た', posId: 7 },
				],
			},
			{
				name: 'verb + たかっ + た (words like 聞きたかった)',
				expected: '知りたかった',
				specs: [
					{
						surface: '知り',
						posId: 5,
						dictionaryForm: '知る',
						reading: 'シリ',
					},
					{ surface: 'たかっ', posId: 7 },
					{ surface: 'た', posId: 7 },
				],
			},
			{
				name: 'verb + た + かっ + た (split variant of 聞きたかった)',
				expected: '聞きたかった',
				specs: [
					{
						surface: '聞き',
						posId: 5,
						dictionaryForm: '聞く',
						reading: 'キキ',
					},
					{ surface: 'た', posId: 7 },
					{ surface: 'かっ', posId: 7 },
					{ surface: 'た', posId: 7 },
				],
			},
			{
				name: '食べてない',
				expected: '食べてない',
				specs: [
					{
						surface: '食べ',
						posId: 5,
						dictionaryForm: '食べる',
						reading: 'タベ',
					},
					{ surface: 'て', posId: 4 },
					{ surface: 'ない', posId: 7 },
				],
			},
			{
				name: '進んでた',
				expected: '進んでた',
				specs: [
					{
						surface: '進ん',
						posId: 5,
						dictionaryForm: '進む',
						reading: 'ススン',
					},
					{ surface: 'で', posId: 4 },
					{ surface: 'た', posId: 7 },
				],
			},
			{
				name: '泣いてん',
				expected: '泣いてん',
				specs: [
					{
						surface: '泣い',
						posId: 5,
						dictionaryForm: '泣く',
						reading: 'ナイ',
					},
					{ surface: 'て', posId: 4 },
					{ surface: 'ん', posId: 2 },
				],
			},
			{
				name: '言っちゃう',
				expected: '言っちゃう',
				specs: [
					{
						surface: '言っ',
						posId: 5,
						dictionaryForm: '言う',
						reading: 'イッ',
					},
					{ surface: 'ちゃう', posId: 7 },
				],
			},
			{
				name: '食べなきゃ',
				expected: '食べなきゃ',
				specs: [
					{
						surface: '食べ',
						posId: 5,
						dictionaryForm: '食べる',
						reading: 'タベ',
					},
					{ surface: 'なきゃ', posId: 2 },
				],
			},
			{
				name: '行かなくちゃ',
				expected: '行かなくちゃ',
				specs: [
					{
						surface: '行か',
						posId: 5,
						dictionaryForm: '行く',
						reading: 'イカ',
					},
					{ surface: 'なく', posId: 7 },
					{ surface: 'ちゃ', posId: 2 },
				],
			},
			{
				name: 'じゃん',
				expected: 'じゃん',
				specs: [
					{ surface: 'じゃ', posId: 2 },
					{ surface: 'ん', posId: 2 },
				],
			},
			{
				name: 'でしょ',
				expected: 'でしょ',
				specs: [
					{ surface: 'で', posId: 7 },
					{ surface: 'しょ', posId: 7 },
				],
			},
			{
				name: 'って言ってる',
				expected: 'って言ってる',
				specs: [
					{ surface: 'って', posId: 2 },
					{
						surface: '言っ',
						posId: 5,
						dictionaryForm: '言う',
						reading: 'イッ',
					},
					{ surface: 'て', posId: 4 },
					{ surface: 'る', posId: 7 },
				],
			},
			{
				name: 'って + 言っ + てる',
				expected: 'って言ってる',
				specs: [
					{ surface: 'って', posId: 2 },
					{
						surface: '言っ',
						posId: 5,
						dictionaryForm: '言う',
						reading: 'イッ',
					},
					{ surface: 'てる', posId: 7 },
				],
			},
			{
				name: 'って + 言ってる',
				expected: 'って言ってる',
				specs: [
					{ surface: 'って', posId: 2 },
					{
						surface: '言ってる',
						posId: 5,
						dictionaryForm: '言う',
						reading: 'イッテル',
					},
				],
			},
			{
				name: 'ですよ',
				expected: 'ですよ',
				specs: [
					{ surface: 'です', posId: 7 },
					{ surface: 'よ', posId: 2 },
				],
			},
			{
				name: 'で + す + よ',
				expected: 'ですよ',
				specs: [
					{ surface: 'で', posId: 7 },
					{ surface: 'す', posId: 7 },
					{ surface: 'よ', posId: 2 },
				],
			},
		];

		for (const chunkCase of cases) {
			const plugin = createPatternOnlyPlugin();
			const path = createPath(chunkCase.specs);
			plugin.rewrite(createInputText(), path, createLattice());

			expect(path.length).toBe(1);
			expect(path[0]?.getWordInfo().getSurface()).toBe(chunkCase.expected);
		}
	});

	test('does not over-merge colloquial rules in unrelated contexts', () => {
		const cases: Array<{
			name: string;
			specs: NodeSpec[];
			expected: string[];
		}> = [
			{
				name: 'noun + は + ない should stay split',
				specs: [
					{ surface: '東京', posId: 1 },
					{ surface: 'は', posId: 2 },
					{ surface: 'ない', posId: 7 },
				],
				expected: ['東京', 'は', 'ない'],
			},
			{
				name: 'noun + たい should stay split',
				specs: [
					{ surface: '東京', posId: 1 },
					{ surface: 'たい', posId: 7 },
				],
				expected: ['東京', 'たい'],
			},
			{
				name: 'もう + 一 + 日 should not match もう一回 rule',
				specs: [
					{ surface: 'もう', posId: 9 },
					{ surface: '一', posId: 3 },
					{ surface: '日', posId: 1 },
				],
				expected: ['もう', '一日'],
			},
			{
				name: 'non-verb + なく + ちゃ should stay split',
				specs: [
					{ surface: '東京', posId: 1 },
					{ surface: 'なく', posId: 7 },
					{ surface: 'ちゃ', posId: 2 },
				],
				expected: ['東京', 'なく', 'ちゃ'],
			},
			{
				name: 'verb + で + ない with non-接続助詞 should stay split',
				specs: [
					{
						surface: '食べ',
						posId: 5,
						dictionaryForm: '食べる',
						reading: 'タベ',
					},
					{ surface: 'で', posId: 2 },
					{ surface: 'ない', posId: 7 },
				],
				expected: ['食べ', 'で', 'ない'],
			},
		];

		for (const chunkCase of cases) {
			const plugin = createPatternOnlyPlugin();
			const path = createPath(chunkCase.specs);
			plugin.rewrite(createInputText(), path, createLattice());

			expect(path.map((node) => node.getWordInfo().getSurface())).toEqual(
				chunkCase.expected,
			);
		}
	});

	test('uses surface as fallback when merged reading part is placeholder', () => {
		const plugin = new TokenChunkerPlugin();
		plugin.setSettings(
			new Settings({
				enablePatternRules: false,
				enableCompoundNouns: true,
			}),
		);
		plugin.setUp(createGrammar());

		const path = [
			createNodeWithForms('再生', '再生', '*', 1, 0, 2),
			createNodeWithForms('回数', '回数', 'カイスウ', 1, 2, 4),
		];
		plugin.rewrite(createInputText(), path, createLattice());

		expect(path.length).toBe(1);
		expect(path[0]?.getWordInfo().getReadingForm()).toBe('再生カイスウ');
	});
});
