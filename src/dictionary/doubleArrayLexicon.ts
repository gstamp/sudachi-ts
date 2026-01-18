import { DoubleArrayLookup } from './doubleArrayLookup.js';
import type { Lexicon } from './lexicon.js';
import { WordIdTable } from './wordIdTable.js';
import type { WordInfo } from './wordInfo.js';
import { WordInfoList } from './wordInfoList.js';
import { WordParameterList } from './wordParameterList.js';

export class DoubleArrayLexicon implements Lexicon {
	static readonly USER_DICT_COST_PAR_MORPH = -20;

	private readonly wordIdTable: WordIdTable;
	private readonly wordParams: WordParameterList;
	private readonly wordInfos: WordInfoList;
	private readonly trieLookup: DoubleArrayLookup;

	constructor(bytes: Uint8Array, offset: number, hasSynonymGid: boolean) {
		const sizeView = new DataView(bytes.buffer, bytes.byteOffset + offset, 4);
		const size = sizeView.getInt32(0, true);
		offset += 4;

		// Int32Array requires 4-byte aligned offset
		// If offset is not aligned, use DataView to create the array
		let trieArray: Int32Array;
		if (offset % 4 === 0) {
			trieArray = new Int32Array(
				bytes.buffer,
				bytes.byteOffset + offset,
				size,
			);
		} else {
			// Copy data to a properly aligned buffer
			const tempBuffer = new Int32Array(size);
			const dataView = new DataView(bytes.buffer, bytes.byteOffset + offset, size * 4);
			for (let i = 0; i < size; i++) {
				tempBuffer[i] = dataView.getInt32(i * 4, true);
			}
			trieArray = tempBuffer;
		}

		this.trieLookup = new DoubleArrayLookup(trieArray);
		offset += size * 4;

		this.wordIdTable = new WordIdTable(bytes, offset);
		offset += this.wordIdTable.storageSize();

		this.wordParams = new WordParameterList(bytes, offset);
		offset += this.wordParams.storageSize();

		this.wordInfos = new WordInfoList(
			bytes,
			offset,
			this.wordParams.getSize(),
			hasSynonymGid,
		);
	}

	lookup(text: Uint8Array, offset: number): IterableIterator<[number, number]> {
		this.trieLookup.reset(text, offset, text.length);
		return this.createIterator(offset);
	}

	private *createIterator(
		startOffset: number,
	): IterableIterator<[number, number]> {
		const wordIdsBuffer: number[] = new Array(128);
		while (this.trieLookup.next()) {
			const trieValue = this.trieLookup.getValue();
			const length = this.trieLookup.getOffset() - startOffset;
			const wordIdCount = this.wordIdTable.readWordIds(
				trieValue,
				wordIdsBuffer,
			);
			for (let i = 0; i < wordIdCount; i++) {
				const wid = wordIdsBuffer[i];
				if (wid !== undefined) {
					yield [wid, length];
				}
			}
		}
	}

	getWordId(headword: string, posId: number, readingForm: string): number {
		for (let wid = 0; wid < this.wordInfos.size(); wid++) {
			const info = this.wordInfos.getWordInfo(wid);
			if (
				info.getSurface() === headword &&
				info.getPOSId() === posId &&
				info.getReadingForm() === readingForm
			) {
				return wid;
			}
		}
		return -1;
	}

	getLeftId(wordId: number): number {
		return this.wordParams.getLeftId(wordId);
	}

	getRightId(wordId: number): number {
		return this.wordParams.getRightId(wordId);
	}

	getCost(wordId: number): number {
		return this.wordParams.getCost(wordId);
	}

	getWordInfo(wordId: number): WordInfo {
		return this.wordInfos.getWordInfo(wordId);
	}

	size(): number {
		return this.wordParams.size();
	}

	getTrieArray(): Int32Array | null {
		const lookup = this.trieLookup as unknown as { array: Int32Array | null };
		return lookup.array || null;
	}

	getWordIdTable(): WordIdTable {
		return this.wordIdTable;
	}

	setDictionaryId(id: number): void {
		this.wordIdTable.setDictionaryId(id);
	}
}
