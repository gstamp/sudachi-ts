import { DicBuffer } from './dicBuffer.js';
import { DoubleArray } from './doubleArray.js';
import type { ModelOutput } from './modelOutput.js';
import type { WriteDictionary } from './writeDictionary.js';

export class Index implements WriteDictionary {
	private readonly _elements: Map<string, number[]> = new Map();
	private _count = 0;

	add(key: string, wordId: number): number {
		const entries = this._elements.get(key);
		if (entries === undefined) {
			this._elements.set(key, [wordId]);
		} else {
			if (entries.length >= 255) {
				throw new Error(`Key ${key} has >= 255 entries in dictionary`);
			}
			entries.push(wordId);
		}
		this._count++;
		return new TextEncoder().encode(key).length;
	}

	async writeTo(output: ModelOutput): Promise<void> {
		const keys = Array.from(this._elements.keys()).sort();

		const trie = new DoubleArray((current, total) =>
			output.progress(current, total),
		);

		await output.withSizedPart('WordId table', async () => {
			const trieKeys: Uint8Array[] = [];
			const trieValues: number[] = [];
			const wordIdTable: number[] = [];

			let tableSize = 0;

			for (let i = 0; i < keys.length; i++) {
				const key = keys[i]!;
				const entries = this._elements.get(key)!;
				const keyBytes = new TextEncoder().encode(key);

				trieKeys.push(keyBytes);
				trieValues.push(tableSize);

				wordIdTable.push(entries.length);
				for (const wid of entries) {
					wordIdTable.push(wid);
				}
				tableSize += 1 + entries.length * 4;

				output.progress(i, keys.length);
			}

			trie.build(trieKeys, trieValues);
			return tableSize;
		});

		await output.padTo(4);

		await output.withPart('double array Trie', async () => {
			const size = trie.getSize();
			const buffer = new DicBuffer(4);
			buffer.putInt32(size);
			buffer.consume(async (buf) => await output.write(buf));
			await output.write(trie.toByteArray());
		});

		await output.padTo(4);

		const wordIdTableSize = (this._count * 4 + this._elements.size) as number;
		const wordIdTableBytes = new Uint8Array(wordIdTableSize);
		const view = new DataView(wordIdTableBytes.buffer);
		let offset = 0;

		for (const key of keys) {
			const entries = this._elements.get(key)!;
			view.setUint8(offset++, entries.length);
			for (const wid of entries) {
				view.setInt32(offset, wid, true);
				offset += 4;
			}
		}

		const buffer = new DicBuffer(4);
		buffer.putInt32(offset);
		buffer.consume(async (buf) => await output.write(buf));
		await output.write(wordIdTableBytes);
	}
}
