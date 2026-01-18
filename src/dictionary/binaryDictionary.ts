import { readFileSync } from 'node:fs';
import { DictionaryHeader } from './dictionaryHeader.js';
import { DictionaryVersion } from './dictionaryVersion.js';
import { DoubleArrayLexicon } from './doubleArrayLexicon.js';
import { GrammarImpl } from './grammarImpl.js';

export class BinaryDictionary {
	private readonly header: DictionaryHeader;
	private readonly grammar: GrammarImpl;
	private readonly lexicon: DoubleArrayLexicon;

	constructor(bytes: Uint8Array) {
		let offset = 0;
		this.header = new DictionaryHeader(bytes, offset);
		offset += this.header.storageSize();

		const version = this.header.getVersion();

		if (DictionaryVersion.hasGrammar(version)) {
			this.grammar = new GrammarImpl(bytes, offset);
			offset += this.grammar.getStorageSize();
		} else if (this.header.isUserDictionary()) {
			this.grammar = new GrammarImpl();
		} else {
			throw new Error('invalid dictionary');
		}

		// The trie follows immediately after grammar
		// No explicit alignment needed - Java version doesn't do this
		// GrammarImpl's getStorageSize() already accounts for internal alignment
		const trieOffset = offset;

		this.lexicon = new DoubleArrayLexicon(
			bytes,
			trieOffset,
			DictionaryVersion.hasSynonymGroupIds(version),
		);
	}

	static async loadSystem(path: string): Promise<BinaryDictionary> {
		const bytes = await BinaryDictionary.readFile(path);
		const dict = new BinaryDictionary(bytes);
		if (!dict.getDictionaryHeader().isSystemDictionary()) {
			throw new Error('invalid system dictionary');
		}
		return dict;
	}

	static async loadUser(path: string): Promise<BinaryDictionary> {
		const bytes = await BinaryDictionary.readFile(path);
		const dict = new BinaryDictionary(bytes);
		if (!dict.getDictionaryHeader().isUserDictionary()) {
			throw new Error('invalid user dictionary');
		}
		return dict;
	}

	static async loadSystemBytes(bytes: Uint8Array): Promise<BinaryDictionary> {
		const dict = new BinaryDictionary(bytes);
		if (!dict.getDictionaryHeader().isSystemDictionary()) {
			throw new Error('invalid system dictionary');
		}
		return dict;
	}

	static async loadUserBytes(bytes: Uint8Array): Promise<BinaryDictionary> {
		const dict = new BinaryDictionary(bytes);
		if (!dict.getDictionaryHeader().isUserDictionary()) {
			throw new Error('invalid user dictionary');
		}
		return dict;
	}

	static async readFile(path: string): Promise<Uint8Array> {
		try {
			const buffer = readFileSync(path);
			return new Uint8Array(buffer);
		} catch (_error) {
			throw new Error(`Dictionary file not found: ${path}`);
		}
	}

	getDictionaryHeader(): DictionaryHeader {
		return this.header;
	}

	getGrammar(): GrammarImpl {
		return this.grammar;
	}

	getLexicon(): DoubleArrayLexicon {
		return this.lexicon;
	}

	close(): void {}
}
