import { WordInfo } from './wordInfo.js';

export class WordInfoList {
	private readonly bytes: Uint8Array;
	private readonly offset: number;
	private readonly wordSize: number;
	private readonly hasSynonymGid: boolean;

	constructor(
		bytes: Uint8Array,
		offset: number,
		wordSize: number,
		hasSynonymGid: boolean,
	) {
		this.bytes = bytes;
		this.offset = offset;
		this.wordSize = wordSize;
		this.hasSynonymGid = hasSynonymGid;
	}

	getWordInfo(wordId: number): WordInfo {
		if (wordId < 0) {
			throw new Error(`Invalid word ID: ${wordId}`);
		}
		const offset = this.wordIdToOffset(wordId);
		let currentOffset = offset;

		const surface = this.readString(currentOffset);
		currentOffset +=
			this.getStringLengthBytes(currentOffset) + surface.length * 2;

		const headwordLength = this.readStringLength(currentOffset);
		currentOffset += this.getStringLengthBytes(currentOffset);

		const posId = this.readInt16(currentOffset);
		currentOffset += 2;

		const normalizedForm = this.readString(currentOffset);
		currentOffset +=
			this.getStringLengthBytes(currentOffset) + normalizedForm.length * 2;
		const finalNormalizedForm =
			normalizedForm.length === 0 ? surface : normalizedForm;

		const dictionaryFormWordId = this.readInt32(currentOffset);
		currentOffset += 4;

		const readingForm = this.readString(currentOffset);
		currentOffset +=
			this.getStringLengthBytes(currentOffset) + readingForm.length * 2;
		const finalReadingForm = readingForm.length === 0 ? surface : readingForm;

		const aUnitSplit = this.readIntArray(currentOffset);
		currentOffset += 1 + aUnitSplit.length * 4;

		const bUnitSplit = this.readIntArray(currentOffset);
		currentOffset += 1 + bUnitSplit.length * 4;

		const wordStructure = this.readIntArray(currentOffset);
		currentOffset += 1 + wordStructure.length * 4;

		let synonymGids: number[] = [];
		if (this.hasSynonymGid) {
			synonymGids = this.readIntArray(currentOffset);
		}

		let dictionaryForm = surface;
		if (dictionaryFormWordId >= 0 && dictionaryFormWordId !== wordId) {
			const wi = this.getWordInfo(dictionaryFormWordId);
			dictionaryForm = wi.getSurface();
		}

		return new WordInfo(
			surface,
			headwordLength,
			posId,
			finalNormalizedForm,
			dictionaryFormWordId,
			dictionaryForm,
			finalReadingForm,
			aUnitSplit,
			bUnitSplit,
			wordStructure,
			synonymGids,
		);
	}

	size(): number {
		return this.wordSize;
	}

	private wordIdToOffset(wordId: number): number {
		return this.readInt32(this.offset + 4 * wordId);
	}

	private readInt32(offset: number): number {
		return (
			(this.bytes[offset]! & 0xff) |
			((this.bytes[offset + 1]! & 0xff) << 8) |
			((this.bytes[offset + 2]! & 0xff) << 16) |
			((this.bytes[offset + 3]! & 0xff) << 24)
		);
	}

	private readInt16(offset: number): number {
		return (
			(this.bytes[offset]! & 0xff) | ((this.bytes[offset + 1]! & 0xff) << 8)
		);
	}

	private readStringLength(offset: number): number {
		const length = this.bytes[offset]!;
		if ((length & 0x80) !== 0) {
			const high = (length & 0x7f) << 8;
			const low = this.bytes[offset + 1]! & 0xff;
			return high | low;
		}
		return length & 0xff;
	}

	private getStringLengthBytes(offset: number): number {
		const length = this.bytes[offset]!;
		if ((length & 0x80) !== 0) {
			return 2;
		}
		return 1;
	}

	private readString(offset: number): string {
		const length = this.readStringLength(offset);
		const chars: string[] = [];
		const startOffset = this.getStringLengthBytes(offset);
		for (let i = 0; i < length; i++) {
			const charCode = this.readInt16(offset + startOffset + i * 2);
			chars.push(String.fromCharCode(charCode));
		}
		return chars.join('');
	}

	private readIntArray(offset: number): number[] {
		const length = this.bytes[offset]! & 0xff;
		const array: number[] = new Array(length);
		for (let i = 0; i < length; i++) {
			array[i] = this.readInt32(offset + 1 + i * 4);
		}
		return array;
	}
}
