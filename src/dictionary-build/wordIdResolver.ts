import type { Lexicon } from '../dictionary/lexicon.js';

export interface WordIdResolver {
	lookup(headword: string, posId: number, reading: string): number;
	isUser(): boolean;
	validate(wordId: number): void;
}

export class NoopResolver implements WordIdResolver {
	lookup(_headword: string, _posId: number, _reading: string): number {
		return -1;
	}

	isUser(): boolean {
		return false;
	}

	validate(_wordId: number): void {}
}

export class PrebuiltResolver implements WordIdResolver {
	private readonly _lexicon: Lexicon;

	constructor(lexicon: Lexicon) {
		this._lexicon = lexicon;
	}

	lookup(headword: string, posId: number, reading: string): number {
		return this._lexicon.getWordId(headword, posId, reading);
	}

	isUser(): boolean {
		return false;
	}

	validate(_wordId: number): void {}
}

export class CsvResolver implements WordIdResolver {
	private readonly _headwords: Map<string, number>;
	private readonly _isUser: boolean;

	constructor(headwords: Map<string, number> = new Map(), isUser = false) {
		this._headwords = headwords;
		this._isUser = isUser;
	}

	lookup(headword: string, posId: number, reading: string): number {
		const key = this.makeKey(headword, posId, reading);
		return this._headwords.get(key) ?? -1;
	}

	isUser(): boolean {
		return this._isUser;
	}

	validate(wordId: number): void {
		if (wordId < 0) {
			throw new Error(`Invalid word ID: ${wordId}`);
		}
	}

	add(headword: string, posId: number, reading: string, wordId: number): void {
		const key = this.makeKey(headword, posId, reading);
		this._headwords.set(key, wordId);
	}

	private makeKey(headword: string, posId: number, reading: string): string {
		return `${headword},${posId},${reading}`;
	}
}

export class ChainResolver implements WordIdResolver {
	private readonly _resolvers: WordIdResolver[];

	constructor(...resolvers: WordIdResolver[]) {
		this._resolvers = resolvers;
	}

	lookup(headword: string, posId: number, reading: string): number {
		for (const resolver of this._resolvers) {
			const result = resolver.lookup(headword, posId, reading);
			if (result >= 0) {
				return result;
			}
		}
		return -1;
	}

	isUser(): boolean {
		return this._resolvers.some((r) => r.isUser());
	}

	validate(wordId: number): void {
		for (const resolver of this._resolvers) {
			try {
				resolver.validate(wordId);
				return;
			} catch {}
		}
		throw new Error(`Invalid word ID: ${wordId}`);
	}
}
