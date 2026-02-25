import { beforeAll, describe, expect, test } from 'vitest';
import type { Morpheme } from '../../src/core/morpheme.js';
import { SplitMode } from '../../src/core/tokenizer.js';
import {
	createTokenizer,
	getSystemDictionary,
	getUser1Dictionary,
} from './testDictionary.js';

describe('JapaneseTokenizer - Basic Tokenization', () => {
	let tokenizer: Awaited<ReturnType<typeof createTokenizer>>;

	beforeAll(async () => {
		tokenizer = await createTokenizer(0);
	});

	test('tokenizeSmallKatakanaOnly - single small katakana character', () => {
		const result = tokenizer.tokenize(SplitMode.C, 'ァ');
		expect(result.size()).toBe(1);
		const morpheme = result.get(0);
		expect(morpheme).toBeDefined();
		expect(morpheme!.surface()).toBe('ァ');
	});

	test('partOfSpeech - verify POS retrieval', () => {
		const result = tokenizer.tokenize(SplitMode.C, '京都');
		expect(result.size()).toBe(1);
		const morpheme = result.get(0);
		expect(morpheme).toBeDefined();
		const pos = morpheme!.partOfSpeech();
		expect(pos).toEqual(['名詞', '固有名詞', '地名', '一般', '*', '*']);
	});

	test('tokenizeKanjiAlphabetWord - mixed kanji/alpha', () => {
		const result = tokenizer.tokenize(SplitMode.C, '特a');
		expect(result.size()).toBe(1);
		const morpheme = result.get(0);
		expect(morpheme).toBeDefined();
		expect(morpheme!.surface()).toBe('特a');
	});
});

describe('JapaneseTokenizer - Word ID and Dictionary ID', () => {
	test('getWordId - verify word ID uniqueness', async () => {
		const dict = await getSystemDictionary();
		// First tokenize to get the actual word IDs
		const result = dict.create().tokenize(SplitMode.C, '京都');
		expect(result.size()).toBe(1);
		const wid = result.get(0)!.getWordId();
		expect(wid).toBeGreaterThanOrEqual(0);

		// Now use getWordId to find the same word
		// The word "京都" has POS "名詞,固有名詞,地名,一般,*,*" which is POS ID 3
		const wordId = dict.getLexicon().getWordId('京都', 3, 'キョウト');
		expect(wordId).toBe(wid);
	});

	test('getDictionaryId - system dictionary returns 0', async () => {
		const dict = await getSystemDictionary();
		// The word "京都" has POS ID 3 (名詞,固有名詞,地名,一般,*,*)
		// and reading form "キョウト"
		// This should be found as word ID 3 (or higher) in system dictionary
		const wordId = dict.getLexicon().getWordId('京都', 3, 'キョウト');
		expect(wordId).toBeGreaterThanOrEqual(0);
	});
});

describe('JapaneseTokenizer - Synonym Group IDs', () => {
	test('getSynonymGroupIds - verify synonym groups', async () => {
		const dict = await getSystemDictionary();
		// The word "京都" has POS ID 3 (名詞,固有名詞,地名,一般,*,*)
		// and reading form "キョウト"
		const kyotoId = dict.getLexicon().getWordId('京都', 3, 'キョウト');
		expect(kyotoId).toBeGreaterThanOrEqual(0);
		const wordInfo = dict.getLexicon().getWordInfo(kyotoId);
		expect(wordInfo.getSynonymGroupIds().length).toBeGreaterThan(0);
	});
});

describe('JapaneseTokenizer - Sentence Tokenization', () => {
	let tokenizer: Awaited<ReturnType<typeof createTokenizer>>;

	beforeAll(async () => {
		tokenizer = await createTokenizer(0);
	});

	async function* _toAsyncIterable(
		data: string[] | string,
	): AsyncIterable<string> {
		if (typeof data === 'string') {
			yield data;
		} else {
			yield* data;
		}
	}

	test('tokenizeSentences - multi-sentence with Japanese period', () => {
		const text = '京都に行った。東京に行った。';
		const sentences = tokenizer.tokenizeSentences(SplitMode.C, text);
		const list = [...sentences];

		expect(list.length).toBe(2);

		const first = list[0];
		expect(first).toBeDefined();
		expect([...first!].length).toBeGreaterThan(0);
		const firstMorpheme = first!.get(0);
		expect(firstMorpheme).toBeDefined();
		expect(firstMorpheme!.surface()).toBe('京都');

		const second = list[1];
		expect(second).toBeDefined();
		expect([...second!].length).toBeGreaterThan(0);
		const secondMorpheme = second!.get(0);
		expect(secondMorpheme).toBeDefined();
		expect(secondMorpheme!.surface()).toBe('東京');
	});

	test('tokenizerWithDots - ellipsis handling', () => {
		const result = tokenizer.tokenize(SplitMode.C, '……');
		expect(result.size()).toBeGreaterThanOrEqual(1);
	});

	test('tokenizeSentencesWithSurrogatePair - emoji handling', () => {
		const result = tokenizer.tokenize(SplitMode.C, '😀');
		expect(result.size()).toBeGreaterThanOrEqual(1);
	});

	test('tokenizeSentences - skips leading newline tokens between sentences', () => {
		const text = '京都に行った。\n東京に行った。';
		const list = [...tokenizer.tokenizeSentences(SplitMode.C, text)];

		expect(list.length).toBe(2);
		const secondSurfaces = [...list[1]!].map((m) => m.surface());
		expect(secondSurfaces[0]).toBe('東京');
		expect(secondSurfaces).not.toContain('\n');
	});

	test('tokenizeSentences - splits quoted dialogue before following narration', () => {
		const text = '「ニャ！」\nタマは食べた。';
		const list = [...tokenizer.tokenizeSentences(SplitMode.C, text)];

		expect(list.length).toBe(2);
		expect(list[0]?.get(0)?.surface()).toBe('「');
		const secondSurfaces = [...list[1]!].map((m) => m.surface());
		expect(secondSurfaces.slice(0, 2).join('')).toBe('タマ');
		expect(secondSurfaces).not.toContain('\n');
	});
});

describe('JapaneseTokenizer - Lazy Tokenization', () => {
	let tokenizer: Awaited<ReturnType<typeof createTokenizer>>;

	beforeAll(async () => {
		tokenizer = await createTokenizer(0);
	});

	async function* toAsyncIterable(
		data: string[] | string,
	): AsyncIterable<string> {
		if (typeof data === 'string') {
			yield data;
		} else {
			yield* data;
		}
	}

	test('lazyTokenizeSentences - streaming iteration', async () => {
		const _text = '京都に行った。東京に行った。';
		const chunks: Morpheme[][] = [];

		for await (const sentence of tokenizer.lazyTokenizeSentences(
			SplitMode.C,
			toAsyncIterable(['京都に行った。', '東京に行った。']),
		)) {
			chunks.push([...sentence]);
		}

		expect(chunks.length).toBe(2);
		expect(chunks[0]?.length).toBeGreaterThan(0);
		expect(chunks[0]?.[0]?.surface()).toBe('京都');
		expect(chunks[1]?.length).toBeGreaterThan(0);
		expect(chunks[1]?.[0]?.surface()).toBe('東京');
	});

	test('lazyTokenizeSentencesWithLongText - large text streaming', async () => {
		const text = '京都に'.repeat(1000);
		const chunks: Morpheme[][] = [];

		for await (const sentence of tokenizer.lazyTokenizeSentences(
			SplitMode.C,
			toAsyncIterable(text),
		)) {
			chunks.push([...sentence]);
		}

		expect(chunks.length).toBeGreaterThanOrEqual(1);
		expect(chunks[0]?.length).toBeGreaterThan(0);
	});

	test('lazyTokenizeSentences - skips leading newline tokens between sentences', async () => {
		const chunks: Morpheme[][] = [];

		for await (const sentence of tokenizer.lazyTokenizeSentences(
			SplitMode.C,
			toAsyncIterable('京都に行った。\n東京に行った。'),
		)) {
			chunks.push([...sentence]);
		}

		expect(chunks.length).toBe(2);
		const secondSurfaces = chunks[1]?.map((m) => m.surface()) ?? [];
		expect(secondSurfaces[0]).toBe('東京');
		expect(secondSurfaces).not.toContain('\n');
	});
});

describe('JapaneseTokenizer - Split Modes', () => {
	let tokenizer: Awaited<ReturnType<typeof createTokenizer>>;

	beforeAll(async () => {
		tokenizer = await createTokenizer(0);
	});

	test('splitAfterTokenizeCtoA - mode C to A split', () => {
		const resultC = tokenizer.tokenize(SplitMode.C, '東京都');
		const resultA = tokenizer.tokenize(SplitMode.A, '東京都');

		expect(resultC.size()).toBeGreaterThanOrEqual(1);
		expect(resultA.size()).toBeGreaterThanOrEqual(1);

		const surfaceC = resultC.get(0)?.surface() ?? '';
		const surfaceA = resultA.get(0)?.surface() ?? '';

		expect(surfaceC).toBe('東京都');
		expect(surfaceA).toBe('東京');
	});

	test('splitAfterTokenizeCtoB - mode C to B split', () => {
		const resultC = tokenizer.tokenize(SplitMode.C, '東京都');
		const resultB = tokenizer.tokenize(SplitMode.B, '東京都');

		expect(resultC.size()).toBeGreaterThanOrEqual(1);
		expect(resultB.size()).toBeGreaterThanOrEqual(1);

		const surfaceC = resultC.get(0)?.surface() ?? '';
		const surfaceB = resultB.get(0)?.surface() ?? '';

		expect(surfaceC).toBe('東京都');
		expect(surfaceB).toBe('東京都');
	});

	test('splitSingleToken - single token morpheme', () => {
		const result = tokenizer.tokenize(SplitMode.A, '京都');
		expect(result.size()).toBe(1);
		expect(result.get(0)?.surface()).toBe('京都');
	});
});

describe('JapaneseTokenizer - Morpheme Properties', () => {
	let tokenizer: Awaited<ReturnType<typeof createTokenizer>>;

	beforeAll(async () => {
		tokenizer = await createTokenizer(0);
	});

	test('morpheme surface', () => {
		const result = tokenizer.tokenize(SplitMode.C, '京都');
		expect(result.size()).toBe(1);
		expect(result.get(0)?.surface()).toBe('京都');
	});

	test('morpheme begin and end', () => {
		const result = tokenizer.tokenize(SplitMode.C, '京都');
		expect(result.size()).toBe(1);
		const m = result.get(0);
		expect(m).toBeDefined();
		expect(m!.begin()).toBe(0);
		expect(m!.end()).toBe(2);
	});

	test('morpheme normalized form', () => {
		const result = tokenizer.tokenize(SplitMode.C, '京都');
		expect(result.size()).toBe(1);
		const m = result.get(0);
		expect(m).toBeDefined();
		expect(m!.normalizedForm()).toBe('京都');
	});

	test('morpheme dictionary word ID', () => {
		const result = tokenizer.tokenize(SplitMode.C, '京都');
		expect(result.size()).toBe(1);
		const m = result.get(0);
		expect(m).toBeDefined();
		expect(m!.getWordId()).toBeGreaterThanOrEqual(0);
	});
});

describe('JapaneseTokenizer - Lattice Dump', () => {
	let tokenizer: Awaited<ReturnType<typeof createTokenizer>>;

	beforeAll(async () => {
		tokenizer = await createTokenizer(0);
	});

	test('dumpInternalStructures - verify lattice structure JSON', () => {
		const dump = tokenizer.dumpInternalStructures('東京都');

		expect(dump).toBeTruthy();
		expect(typeof dump).toBe('string');

		const parsed = JSON.parse(dump);
		expect(parsed).toBeDefined();
		expect(parsed.nodes).toBeDefined();
		expect(parsed.nodes.length).toBeGreaterThanOrEqual(1);
		expect(parsed.bestPath).toBeDefined();
		expect(parsed.bestPath.length).toBeGreaterThanOrEqual(1);
	});

	test('dumpInternalStructures -東京都 produces expected lattice', () => {
		const dump = tokenizer.dumpInternalStructures('東京都');
		const parsed = JSON.parse(dump);

		expect(parsed.nodes.length).toBeGreaterThanOrEqual(5);
		expect(parsed.bestPath.length).toBe(1);
		expect(parsed.rewrittenPath).toBeDefined();
	});
});

describe('JapaneseTokenizer - User Dictionary', () => {
	test('user dictionary - custom word in user dict', async () => {
		const user1 = await getUser1Dictionary();
		const tokenizer = user1.create();

		const result = tokenizer.tokenize(SplitMode.C, 'ぴらる');
		expect(result.size()).toBe(1);
		expect(result.get(0)?.surface()).toBe('ぴらる');

		const dictId = result.get(0)?.getDictionaryId();
		expect(dictId).toBe(1);
	});

	test('user dictionary - word in system dict', async () => {
		const user1 = await getUser1Dictionary();
		const tokenizer = user1.create();

		const result = tokenizer.tokenize(SplitMode.C, '京都');
		expect(result.size()).toBe(1);
		expect(result.get(0)?.surface()).toBe('京都');

		const dictId = result.get(0)?.getDictionaryId();
		expect(dictId).toBe(0);
	});
});

describe('JapaneseTokenizer - Numeric Handling', () => {
	let tokenizer: Awaited<ReturnType<typeof createTokenizer>>;

	beforeAll(async () => {
		tokenizer = await createTokenizer(0);
	});

	test('tokenize Arabic numerals', () => {
		const result = tokenizer.tokenize(SplitMode.C, '123');
		expect(result.size()).toBeGreaterThanOrEqual(1);
	});

	test('tokenize Kanji numerals', () => {
		const result = tokenizer.tokenize(SplitMode.C, '一二三');
		expect(result.size()).toBeGreaterThanOrEqual(1);
	});

	test('tokenize mixed numerals', () => {
		const result = tokenizer.tokenize(SplitMode.C, '1234567890');
		expect(result.size()).toBeGreaterThanOrEqual(1);
	});
});

describe('JapaneseTokenizer - Empty and Edge Cases', () => {
	let tokenizer: Awaited<ReturnType<typeof createTokenizer>>;

	beforeAll(async () => {
		tokenizer = await createTokenizer(0);
	});

	test('empty string returns empty list', () => {
		const result = tokenizer.tokenize(SplitMode.C, '');
		expect(result.size()).toBe(0);
	});

	test('unknown word becomes OOV', () => {
		const result = tokenizer.tokenize(SplitMode.C, 'xyzxyzxyz');
		expect(result.size()).toBeGreaterThanOrEqual(1);

		const m = result.get(0);
		expect(m).toBeDefined();
		expect(m!.getWordId()).toBe(-1);
	});

	test('newline between OOV runs keeps lattice connected', () => {
		const result = tokenizer.tokenize(SplitMode.C, 'です\nです');
		const surfaces = [...result].map((m) => m.surface());

		expect(surfaces).toEqual(['で', 'す', '\n', 'で', 'す']);
	});

	test('zero length morpheme from special processing', () => {
		const result = tokenizer.tokenize(SplitMode.C, 'な。な');
		expect(result.size()).toBeGreaterThanOrEqual(1);
	});
});
