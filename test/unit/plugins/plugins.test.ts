import { beforeEach, describe, expect, test } from 'bun:test';
import { Settings } from '../../../src/config/settings.js';
import type { InputText } from '../../../src/core/inputText.js';
import type { InputTextBuilder } from '../../../src/core/inputTextBuilder.js';
import type {
	Lattice,
	LatticeNode,
	LatticeNodeImpl,
} from '../../../src/core/lattice.js';
import type { CategoryType } from '../../../src/dictionary/categoryType.js';
import { Connection } from '../../../src/dictionary/connection.js';
import type { Grammar } from '../../../src/dictionary/grammar.js';
import { POS } from '../../../src/dictionary/pos.js';
import { WordInfo } from '../../../src/dictionary/wordInfo.js';
import { EditConnectionCostPlugin } from '../../../src/plugins/connection/base.js';
import { MorphemeFormatterPlugin } from '../../../src/plugins/formatter/base.js';
import { InputTextPlugin } from '../../../src/plugins/inputText/base.js';
import { PluginLoader } from '../../../src/plugins/loader.js';
import { OovProviderPlugin } from '../../../src/plugins/oov/base.js';
import { PathRewritePlugin } from '../../../src/plugins/pathRewrite/base.js';
import { TokenChunkerPlugin } from '../../../src/plugins/pathRewrite/tokenChunkerPlugin.js';

function createMockGrammar(): Grammar {
	const matrix = new Int16Array([0]);
	const connection = new Connection(matrix, 1, 1);

	return {
		getPartOfSpeechSize: () => 0,
		getPartOfSpeechString: () => new POS('*', '*', '*', '*', '*', '*'),
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

function createMockInputText(): InputText {
	const self = {
		getText: () => 'test',
		getOriginalText: () => 'test',
		getSubstring: () => '',
		slice: () => self,
		getOriginalIndex: () => 0,
		textIndexToOriginalTextIndex: () => 0,
		getCharCategoryTypes: () => new Set<CategoryType>(),
		getCharCategoryContinuousLength: () => 0,
		getCodePointsOffsetLength: () => 0,
		codePointCount: () => 0,
		canBow: () => true,
		getWordCandidateLength: () => 1,
		getNextInOriginal: () => 0,
		modifiedOffset: () => 0,
		getByteText: () => new Uint8Array(),
	};
	return self;
}

function createMockLatticeNode(): LatticeNode {
	return {
		setParameter: () => {},
		getBegin: () => 0,
		getEnd: () => 0,
		setRange: () => {},
		isOOV: () => false,
		setOOV: () => {},
		getWordInfo: (): WordInfo => {
			return {
				getLength: () => 0,
				getPOSId: () => 0,
				getSurface: () => '',
				getNormalizedForm: () => '',
				getDictionaryFormWordId: () => -1,
				getDictionaryForm: () => '',
				getReadingForm: () => '',
				getAunitSplit: () => [],
				getBunitSplit: () => [],
				getWordStructure: () => [],
				getSynonymGroupIds: () => [],
				setPOSId: () => {},
			} as unknown as WordInfo;
		},
		setWordInfo: () => {},
		getPathCost: () => 0,
		getWordId: () => 0,
		setWordId: () => {},
		getDictionaryId: () => 0,
		setDictionaryId: () => {},
		getTotalCost: () => 0,
		getRightId: () => 0,
		getLeftId: () => 0,
		getCost: () => 0,
		isConnectedToBOS: () => false,
		setConnectedToBOS: () => {},
		getBestPreviousNode: () => null,
		setBestPreviousNode: () => {},
		isDefined: () => true,
		setDefined: () => {},
		appendSplitsTo: () => {},
	};
}

function createMockLattice(): Lattice {
	return {
		getNodesWithEnd: () => [],
		getNodes: () => [],
		getMinimumNode: () => null,
		insert: () => {},
		remove: () => {},
		createNode: () => createMockLatticeNode(),
		resize: () => {},
		clear: () => {},
		hasPreviousNode: () => false,
		connectEosNode: () => {},
		getBestPath: () => [],
	};
}

class TestInputTextPlugin extends InputTextPlugin {
	rewriteCalled = false;
	rewrite(_builder: InputTextBuilder): void {
		this.rewriteCalled = true;
	}
}

class TestOovProviderPlugin extends OovProviderPlugin {
	provideOOVCalled = false;
	provideOOV(
		_inputText: InputText,
		_offset: number,
		_otherWords: number,
		result: LatticeNodeImpl[],
	): number {
		this.provideOOVCalled = true;
		const node = this.createNode();
		const wi = new WordInfo('test', 4, 0, 'test', 'test', '');
		node.setWordInfo(wi);
		result.push(node);
		return 1;
	}
}

class TestPathRewritePlugin extends PathRewritePlugin {
	rewriteCalled = false;
	rewrite(_text: InputText, _path: LatticeNode[], _lattice: Lattice): void {
		this.rewriteCalled = true;
	}
}

class TestEditConnectionCostPlugin extends EditConnectionCostPlugin {
	editCalled = false;
	edit(_grammar: Grammar): void {
		this.editCalled = true;
	}
}

class TestMorphemeFormatterPlugin extends MorphemeFormatterPlugin {
	formatMorpheme(_morpheme: { surface(): string }): string {
		return 'test';
	}
}

describe('Plugin', () => {
	test('should have settings property', () => {
		const plugin = new TestInputTextPlugin();
		const settings = new Settings({ test: 'value' });
		plugin.setSettings(settings);

		expect(plugin.getSettings()).toBe(settings);
	});

	test('should be able to get settings', () => {
		const plugin = new TestInputTextPlugin();
		const settings = new Settings({ test: 'value' });
		plugin.setSettings(settings);

		expect(plugin.getSettings()).toBe(settings);
	});
});

describe('InputTextPlugin', () => {
	let plugin: TestInputTextPlugin;
	let grammar: Grammar;

	beforeEach(() => {
		plugin = new TestInputTextPlugin();
		grammar = createMockGrammar();
	});

	test('should call rewrite', () => {
		plugin.rewriteCalled = false;
		const builder: InputTextBuilder = {
			replace: () => {},
			getOriginalText: () => '',
			getText: () => '',
			build: () => createMockInputText(),
		};
		plugin.rewrite(builder);
		expect(plugin.rewriteCalled).toBe(true);
	});

	test('should have empty setUp implementation', () => {
		expect(() => plugin.setUp(grammar)).not.toThrow();
	});
});

describe('OovProviderPlugin', () => {
	let plugin: TestOovProviderPlugin;
	let _grammar: Grammar;

	beforeEach(() => {
		plugin = new TestOovProviderPlugin();
		_grammar = createMockGrammar();
	});

	test('should create OOV nodes', () => {
		const inputText = createMockInputText();

		const result: LatticeNodeImpl[] = [];
		const count = plugin.getOOV(inputText, 0, 0, result);
		expect(count).toBe(1);
		expect(result.length).toBe(1);
		expect(result[0]?.isOOV()).toBe(true);
	});

	test('should have static constants for user POS modes', () => {
		expect(OovProviderPlugin.USER_POS).toBe('userPOS');
		expect(OovProviderPlugin.USER_POS_FORBID).toBe('forbid');
		expect(OovProviderPlugin.USER_POS_ALLOW).toBe('allow');
	});
});

describe('PathRewritePlugin', () => {
	let plugin: TestPathRewritePlugin;
	let _grammar: Grammar;

	beforeEach(() => {
		plugin = new TestPathRewritePlugin();
		_grammar = createMockGrammar();
	});

	test('should call rewrite', () => {
		const text = createMockInputText();
		const lattice = createMockLattice();
		plugin.rewriteCalled = false;
		plugin.rewrite(text, [], lattice);
		expect(plugin.rewriteCalled).toBe(true);
	});

	test('should throw error when begin >= end in concatenate', () => {
		const path: LatticeNode[] = [];
		const lattice = createMockLattice();
		expect(() => plugin.concatenate(path, 1, 1, lattice)).toThrow(
			'begin >= end',
		);
	});
});

describe('EditConnectionCostPlugin', () => {
	let plugin: TestEditConnectionCostPlugin;
	let grammar: Grammar;

	beforeEach(() => {
		plugin = new TestEditConnectionCostPlugin();
		grammar = createMockGrammar();
	});

	test('should call edit', () => {
		plugin.editCalled = false;
		plugin.edit(grammar);
		expect(plugin.editCalled).toBe(true);
	});

	test('should inhibit connection', () => {
		let setConnectCostCalled = false;
		const testGrammar: Grammar = {
			...grammar,
			setConnectCost: (_left: number, _right: number, cost: number) => {
				setConnectCostCalled = true;
				expect(cost).toBe(0x7fff);
			},
		};
		plugin.inhibitConnection(testGrammar, 0, 0);
		expect(setConnectCostCalled).toBe(true);
	});
});

describe('MorphemeFormatterPlugin', () => {
	let plugin: TestMorphemeFormatterPlugin;

	beforeEach(() => {
		plugin = new TestMorphemeFormatterPlugin();
	});

	test('should format morpheme', () => {
		const morpheme: { surface(): string } = { surface: () => 'test' };
		expect(plugin.formatMorpheme(morpheme)).toBe('test');
	});

	test('should print sentence', () => {
		const morphemes: { surface(): string }[] = [
			{ surface: () => 'word1' },
			{ surface: () => 'word2' },
		];
		const result = plugin.printSentence(morphemes as any);
		expect(result).toBe('test\ntest\nEOS\n');
	});

	test('should set delimiter', () => {
		plugin.setDelimiter('|');
		expect(plugin.getDelimiter()).toBe('|');
	});

	test('should set EOS string', () => {
		plugin.setEosString('END');
		expect(plugin.getEosString()).toBe('END');
	});

	test('should set show details', () => {
		plugin.setShowDetails(true);
		expect(plugin.isShowDetails()).toBe(true);
	});

	test('should show details', () => {
		expect(plugin.isShowDetails()).toBe(false);
		plugin.showDetail();
		expect(plugin.isShowDetails()).toBe(true);
	});
});

describe('PluginLoader', () => {
	test('should load InputTextPlugin with settings', async () => {
		const loader = new PluginLoader();
		const settings = new Settings({ test: 'value' });

		const plugin = await loader.loadInputTextPlugin(
			'../../test/unit/plugins/testInputTextPlugin.ts',
			settings,
		);
		expect(plugin.plugin).toBeInstanceOf(InputTextPlugin);
		expect(plugin.className).toBe(
			'../../test/unit/plugins/testInputTextPlugin.ts',
		);
	});

	test('should load built-in TokenChunkerPlugin', async () => {
		const loader = new PluginLoader();
		const settings = new Settings({});

		const plugin = await loader.loadPathRewritePlugin(
			'TokenChunkerPlugin',
			settings,
		);
		expect(plugin.plugin).toBeInstanceOf(TokenChunkerPlugin);
		expect(plugin.className).toBe('TokenChunkerPlugin');
	});
});
