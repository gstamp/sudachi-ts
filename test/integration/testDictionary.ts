import { readFile } from 'node:fs/promises';

import { Settings } from '../../src/config/settings.js';
import { BinaryDictionary } from '../../src/dictionary/binaryDictionary.js';
import type { Grammar } from '../../src/dictionary/grammar.js';
import type { Lexicon } from '../../src/dictionary/lexicon.js';
import { LexiconSet } from '../../src/dictionary/lexiconSet.js';
import {
	systemBuilder,
	userBuilder,
} from '../../src/dictionary-build/dicBuilder.js';
import type { MorphemeList } from '../../src/index.js';
import { JapaneseTokenizer, SplitMode } from '../../src/index.js';
import { SimpleOovProviderPlugin } from '../../src/plugins/oov/simpleOovProviderPlugin.js';

export interface JapaneseDictionary {
	create(): JapaneseTokenizer;
	getGrammar(): Grammar;
	getLexicon(): Lexicon;
}

class SystemDictionary {
	private readonly _grammar: Grammar;
	private readonly _lexicon: Lexicon;
	private readonly _binary: BinaryDictionary;

	constructor(buffer: Uint8Array) {
		this._binary = new BinaryDictionary(buffer);
		this._grammar = this._binary.getGrammar();
		this._lexicon = this._binary.getLexicon();
	}

	create(): JapaneseTokenizer {
		const settings = new Settings({
			oovPOS: ['名詞', '普通名詞', '一般', '*', '*', '*'],
			leftId: 0,
			rightId: 0,
			cost: 30000,
		});

		const oovPlugin = new SimpleOovProviderPlugin();
		oovPlugin.setSettings(settings);
		oovPlugin.setUp(this._grammar);

		return new JapaneseTokenizer(
			this._grammar,
			this._lexicon,
			[],
			[oovPlugin],
			[],
		);
	}

	getGrammar(): Grammar {
		return this._grammar;
	}

	getLexicon(): Lexicon {
		return this._lexicon;
	}
}

class UserDictionary {
	private readonly _grammar: Grammar;
	private readonly _lexicon: Lexicon;
	private readonly _binary: BinaryDictionary;

	constructor(buffer: Uint8Array, system: SystemDictionary) {
		this._binary = new BinaryDictionary(buffer);
		this._grammar = system.getGrammar();
		const lexicons = new LexiconSet(system.getLexicon());
		lexicons.add(this._binary.getLexicon());
		this._lexicon = lexicons;
	}

	create(): JapaneseTokenizer {
		const settings = new Settings({
			oovPOS: ['名詞', '普通名詞', '一般', '*', '*', '*'],
			leftId: 0,
			rightId: 0,
			cost: 30000,
		});

		const oovPlugin = new SimpleOovProviderPlugin();
		oovPlugin.setSettings(settings);
		oovPlugin.setUp(this._grammar);

		return new JapaneseTokenizer(
			this._grammar,
			this._lexicon,
			[],
			[oovPlugin],
			[],
		);
	}

	getGrammar(): Grammar {
		return this._grammar;
	}

	getLexicon(): Lexicon {
		return this._lexicon;
	}
}

async function loadFixture(path: string): Promise<string> {
	try {
		return await readFile(path, 'utf8');
	} catch {
		throw new Error(`Fixture not found: ${path}`);
	}
}

let _systemDictionary: SystemDictionary | null = null;
let _user1Dictionary: UserDictionary | null = null;
let _user2Dictionary: UserDictionary | null = null;

async function buildSystemDictionary(): Promise<SystemDictionary> {
	const lex = await loadFixture('./test/fixtures/dict/lex.csv');
	const matrix = await loadFixture('./test/fixtures/dict/matrix.def');

	const builder = systemBuilder();
	await builder.matrix(matrix);
	await builder.lexicon(lex, 'lex.csv');

	const { buffer } = await builder.build();
	return new SystemDictionary(buffer);
}

async function buildUserDictionary(
	system: SystemDictionary,
	userCsv: string,
): Promise<UserDictionary> {
	const builder = userBuilder(system);
	await builder.lexicon(userCsv, 'user.csv');

	const { buffer } = await builder.build();
	return new UserDictionary(buffer, system);
}

async function initializeDictionaries(): Promise<{
	system: SystemDictionary;
	user1: UserDictionary;
	user2: UserDictionary;
}> {
	const system = await buildSystemDictionary();
	const user1 = await buildUserDictionary(
		system,
		await loadFixture('./test/fixtures/dict/user.csv'),
	);
	const user2 = await buildUserDictionary(
		system,
		await loadFixture('./test/fixtures/dict/user2.csv'),
	);

	return { system, user1, user2 };
}

export async function getSystemDictionary(): Promise<SystemDictionary> {
	if (!_systemDictionary) {
		const dicts = await initializeDictionaries();
		_systemDictionary = dicts.system;
		_user1Dictionary = dicts.user1;
		_user2Dictionary = dicts.user2;
	}
	return _systemDictionary;
}

export async function getUser1Dictionary(): Promise<UserDictionary> {
	if (!_user1Dictionary) {
		await getSystemDictionary();
	}
	return _user1Dictionary!;
}

export async function getUser2Dictionary(): Promise<UserDictionary> {
	if (!_user2Dictionary) {
		await getSystemDictionary();
	}
	return _user2Dictionary!;
}

export async function createTokenizer(
	user: 0 | 1 | 2 = 0,
): Promise<JapaneseTokenizer> {
	const dict =
		user === 0
			? await getSystemDictionary()
			: user === 1
				? await getUser1Dictionary()
				: await getUser2Dictionary();
	return dict.create();
}

export async function withUser0<R>(
	fn: (tokenizer: JapaneseTokenizer) => R,
): Promise<R> {
	const tokenizer = await createTokenizer(0);
	return fn(tokenizer);
}

export async function withUser1<R>(
	fn: (dict: JapaneseDictionary) => R,
): Promise<R> {
	const dict = await getUser1Dictionary();
	return fn(dict);
}

export async function withUser2<R>(
	fn: (dict: JapaneseDictionary) => R,
): Promise<R> {
	const dict = await getUser2Dictionary();
	return fn(dict);
}

export async function tokenizeWithUser0(
	text: string,
	mode: SplitMode = SplitMode.C,
): Promise<MorphemeList> {
	const tokenizer = await createTokenizer(0);
	return tokenizer.tokenize(mode, text);
}

export async function tokenizeWithUser1(
	text: string,
	mode: SplitMode = SplitMode.C,
): Promise<MorphemeList> {
	const dict = await getUser1Dictionary();
	return dict.create().tokenize(mode, text);
}
