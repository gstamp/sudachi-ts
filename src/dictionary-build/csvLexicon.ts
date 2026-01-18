import { POS } from '../dictionary/pos.js';
import { WordInfo } from '../dictionary/wordInfo.js';
import { DicBuffer } from './dicBuffer.js';
import type { ModelOutput } from './modelOutput.js';
import { Parameters } from './parameters.js';
import type { POSTable } from './posTable.js';
import type { WordIdResolver } from './wordIdResolver.js';
import { NoopResolver } from './wordIdResolver.js';
import type { WriteDictionary } from './writeDictionary.js';

const ARRAY_MAX_LENGTH = 127;
const MIN_REQUIRED_NUMBER_OF_COLUMNS = 18;
const UNICODE_LITERAL_PATTERN = /\\u([0-9a-fA-F]{4}|\\{[0-9a-fA-F]+})/g;
const ID_PATTERN = /^U?\d+$/;

export class CsvLexicon implements WriteDictionary {
	private readonly _parameters: Parameters;
	private readonly _posTable: POSTable;
	private readonly _entries: WordEntry[] = [];
	private _wordIdResolver: WordIdResolver = new NoopResolver();

	constructor(posTable: POSTable) {
		this._posTable = posTable;
		this._parameters = new Parameters();
	}

	setResolver(resolver: WordIdResolver): void {
		this._wordIdResolver = resolver;
	}

	static unescape(text: string): string {
		return text.replace(UNICODE_LITERAL_PATTERN, (_match, hex) => {
			if (hex.startsWith('{')) {
				const code = parseInt(hex.slice(1, -1), 16);
				return String.fromCodePoint(code);
			}
			const code = parseInt(hex, 16);
			return String.fromCharCode(code);
		});
	}

	parseLine(cols: string[]): WordEntry {
		if (cols.length < MIN_REQUIRED_NUMBER_OF_COLUMNS) {
			throw new Error(
				`Invalid format: expected at least ${MIN_REQUIRED_NUMBER_OF_COLUMNS} columns, got ${cols.length}`,
			);
		}

		for (let i = 0; i < 15; i++) {}

		const headwordBytes = new TextEncoder().encode(cols[0]!).length;
		const _normalizedFormBytes = new TextEncoder().encode(cols[12]!).length;
		const _readingFormBytes = new TextEncoder().encode(cols[11]!).length;

		if (
			headwordBytes > DicBuffer.MAX_STRING ||
			!DicBuffer.isValidLength(cols[4]!) ||
			!DicBuffer.isValidLength(cols[11]!) ||
			!DicBuffer.isValidLength(cols[12]!)
		) {
			throw new Error('String is too long');
		}

		if (cols[0]?.length === 0) {
			throw new Error('Headword is empty');
		}

		const entry = new WordEntry();

		if (cols[1] !== '-1') {
			entry.headword = cols[0]!;
		}

		this._parameters.add(
			parseInt(cols[1]!, 10),
			parseInt(cols[2]!, 10),
			parseInt(cols[3]!, 10),
		);

		const pos = new POS(
			cols[5]!,
			cols[6]!,
			cols[7]!,
			cols[8]!,
			cols[9]!,
			cols[10]!,
		);
		const posId = this._posTable.getId(pos);

		entry.dictionaryFormString = cols[13]!;
		entry.aUnitSplitString = cols[15]!;
		entry.bUnitSplitString = cols[16]!;
		entry.wordStructureString = cols[17]!;

		this.checkSplitInfoFormat(entry.aUnitSplitString);
		this.checkSplitInfoFormat(entry.bUnitSplitString);
		this.checkSplitInfoFormat(entry.wordStructureString);

		if (
			cols[14] === 'A' &&
			(entry.aUnitSplitString !== '*' || entry.bUnitSplitString !== '*')
		) {
			throw new Error('Invalid splitting');
		}

		let synonymGids: number[] = [];
		if (cols.length > 18) {
			synonymGids = this.parseSynonymGids(cols[18]!);
		}

		entry.wordInfo = new WordInfo(
			cols[4]!,
			headwordBytes,
			posId,
			cols[12]!,
			-1,
			'',
			cols[11]!,
			[],
			[],
			[],
			synonymGids,
		);

		return entry;
	}

	parseDictionaryForm(str: string): number {
		if (str === '*') {
			return -1;
		}

		const idMatch = str.match(/^U?(\d+)$/);
		if (idMatch) {
			const id = parseInt(idMatch[1]!, 10);
			if (idMatch[0]?.startsWith('U') && this._wordIdResolver.isUser()) {
				return (1 << 28) | id;
			}
			return id;
		}

		return this.wordToId(str);
	}

	parseSynonymGids(str: string): number[] {
		if (str === '*') {
			return [];
		}

		const ids = str.split('/');
		if (ids.length > ARRAY_MAX_LENGTH) {
			throw new Error('Too many units');
		}

		const result: number[] = [];
		for (const id of ids) {
			result.push(parseInt(id!, 10));
		}

		return result;
	}

	wordToId(text: string): number {
		const cols = text.split(',', 8);
		if (cols.length < 8) {
			throw new Error('Too few columns');
		}

		const headword = CsvLexicon.unescape(cols[0]!);
		const pos = new POS(
			cols[1]!,
			cols[2]!,
			cols[3]!,
			cols[4]!,
			cols[5]!,
			cols[6]!,
		);
		const posId = this._posTable.getId(pos);
		const reading = CsvLexicon.unescape(cols[7]!);

		return this._wordIdResolver.lookup(headword, posId, reading);
	}

	checkSplitInfoFormat(info: string): void {
		if (info === '*') {
			return;
		}
		const count = info.split('/').length;
		if (count > ARRAY_MAX_LENGTH) {
			throw new Error('Too many units');
		}
	}

	parseSplitInfo(info: string): number[] {
		if (info === '*') {
			return [];
		}

		const words = info.split('/');
		if (words.length > ARRAY_MAX_LENGTH) {
			throw new Error('Too many units');
		}

		const result: number[] = [];
		for (const ref of words) {
			if (ref === '') {
				continue;
			}
			if (ID_PATTERN.test(ref!)) {
				result.push(this.parseId(ref!));
			} else if (ref === 'A' || ref === 'B' || ref === 'C') {
			} else {
				const wordId = this.wordToId(ref!);
				if (wordId < 0) {
					throw new Error(`Couldn't find ${ref} in the dictionaries`);
				}
				result.push(wordId);
			}
		}

		return result;
	}

	parseId(text: string): number {
		let id = 0;
		if (text.startsWith('U')) {
			id = parseInt(text.substring(1), 10);
			if (this._wordIdResolver.isUser()) {
				id = (1 << 28) | id;
			}
		} else {
			id = parseInt(text, 10);
		}
		this._wordIdResolver.validate(id);
		return id;
	}

	addEntry(entry: WordEntry): number {
		const id = this._entries.length;
		this._entries.push(entry);
		return id;
	}

	getEntries(): WordEntry[] {
		return [...this._entries];
	}

	setLimits(left: number, right: number): void {
		this._parameters.setLimits(left, right);
	}

	async writeTo(output: ModelOutput): Promise<void> {
		const countBuffer = new Uint8Array(4);
		const view = new DataView(countBuffer.buffer);
		view.setInt32(0, this._entries.length, true);
		await output.write(countBuffer);

		await this._parameters.writeTo(output);

		// Calculate the position where the offset table will be written
		const offsetsPosition = output.position;
		const offsetsSize = 4 * this._entries.length;
		// Calculate the position where word data will start (after the offset table)
		const wordDataStartPosition = offsetsPosition + offsetsSize;

		// First pass: Accumulate all word entries and track their relative offsets
		// We use a growable approach since we don't know the total size upfront
		const entryOffsets: number[] = [];
		const wordDataChunks: Uint8Array[] = [];
		let currentRelativeOffset = 0;

		await output.withPart('word entries', async () => {
			const buffer = new DicBuffer(128 * 1024);
			const numEntries = this._entries.length;

			for (let i = 0; i < numEntries; i++) {
				const entry = this._entries[i]!;

				// Flush buffer if it's getting full, and track accumulated size
				if (buffer.wontFit(16 * 1024)) {
					const chunk = buffer.flip();
					wordDataChunks.push(new Uint8Array(chunk));
					currentRelativeOffset += chunk.length;
					buffer.clear();
				}

				// Store the offset for this entry (relative to word data start)
				entryOffsets.push(currentRelativeOffset + buffer.position());

				const wi = entry.wordInfo;
				if (!wi) {
					throw new Error('WordInfo is required');
				}
				buffer.putString(wi.getSurface());
				buffer.putLength(wi.getLength());
				buffer.putInt16(wi.getPOSId());
				buffer.putEmptyIfEqual(wi.getNormalizedForm(), wi.getSurface());
				buffer.putInt32(this.parseDictionaryForm(entry.dictionaryFormString));
				buffer.putEmptyIfEqual(wi.getReadingForm(), wi.getSurface());
				buffer.putInts(this.parseSplitInfo(entry.aUnitSplitString));
				buffer.putInts(this.parseSplitInfo(entry.bUnitSplitString));
				buffer.putInts(this.parseSplitInfo(entry.wordStructureString));
				buffer.putInts(wi.getSynonymGroupIds());

				output.progress(i, numEntries);
			}

			// Flush any remaining data in the buffer
			if (buffer.position() > 0) {
				const chunk = buffer.flip();
				wordDataChunks.push(new Uint8Array(chunk));
			}
		});

		// Second pass: Write the offset table with absolute positions
		await output.withPart('WordInfo offsets', async () => {
			const offsets = new DicBuffer(offsetsSize);
			for (const relativeOffset of entryOffsets) {
				// Convert relative offset to absolute position
				offsets.putInt32(wordDataStartPosition + relativeOffset);
			}
			await offsets.consumeAsync(async (buf) => await output.write(buf));
		});

		// Write all the accumulated word data chunks
		for (const chunk of wordDataChunks) {
			await output.write(chunk);
		}

		await output.padTo(4);
	}
}

export class WordEntry {
	headword?: string;
	wordInfo?: WordInfo;
	dictionaryFormString = '*';
	aUnitSplitString = '*';
	bUnitSplitString = '*';
	wordStructureString = '*';
}
