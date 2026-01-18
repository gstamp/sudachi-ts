import type { Lexicon } from './lexicon.js';
import type { WordInfo } from './wordInfo.js';

export class LexiconSet implements Lexicon {
	private readonly lexicons: Lexicon[];

	constructor(systemLexicon: Lexicon) {
		this.lexicons = [systemLexicon];
	}

	add(userLexicon: Lexicon): void {
		if (this.lexicons.length >= 16) {
			throw new Error('too many lexicons');
		}
		this.lexicons.push(userLexicon);
	}

	*lookup(
		text: Uint8Array,
		offset: number,
	): IterableIterator<[number, number]> {
		for (let i = 0; i < this.lexicons.length; i++) {
			for (const [wordId, length] of this.lexicons[i]!.lookup(text, offset)) {
				yield [this.encodeId(i, wordId), length];
			}
		}
	}

	getWordId(headword: string, posId: number, readingForm: string): number {
		for (let i = 0; i < this.lexicons.length; i++) {
			const wordId = this.lexicons[i]!.getWordId(headword, posId, readingForm);
			if (wordId >= 0) {
				return this.encodeId(i, wordId);
			}
		}
		return -1;
	}

	getLeftId(wordId: number): number {
		const dictId = this.getDictionaryId(wordId);
		const realWordId = this.getWordIdInternal(wordId);
		return this.lexicons[dictId]!.getLeftId(realWordId);
	}

	getRightId(wordId: number): number {
		const dictId = this.getDictionaryId(wordId);
		const realWordId = this.getWordIdInternal(wordId);
		return this.lexicons[dictId]!.getRightId(realWordId);
	}

	getCost(wordId: number): number {
		const dictId = this.getDictionaryId(wordId);
		const realWordId = this.getWordIdInternal(wordId);
		return this.lexicons[dictId]!.getCost(realWordId);
	}

	getWordInfo(wordId: number): WordInfo {
		const dictId = this.getDictionaryId(wordId);
		const realWordId = this.getWordIdInternal(wordId);
		return this.lexicons[dictId]!.getWordInfo(realWordId);
	}

	size(): number {
		let size = 0;
		for (const lexicon of this.lexicons) {
			size += lexicon.size();
		}
		return size;
	}

	private encodeId(dictId: number, wordId: number): number {
		return (dictId << 28) | wordId;
	}

	private getDictionaryId(wordId: number): number {
		return wordId >>> 28;
	}

	private getWordIdInternal(wordId: number): number {
		return wordId & 0x0fffffff;
	}
}
