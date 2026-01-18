import type { Grammar } from '../dictionary/grammar.js';
import type { POS } from '../dictionary/pos.js';
import { DicBuffer } from './dicBuffer.js';
import type { ModelOutput } from './modelOutput.js';
import type { WriteDictionary } from './writeDictionary.js';

export class POSTable implements WriteDictionary {
	private readonly _table: POS[] = [];
	private readonly _lookup: Map<string, number> = new Map();
	private _builtin = 0;

	getId(pos: POS): number {
		const key = pos.toString();
		const existing = this._lookup.get(key);
		if (existing !== undefined) {
			return existing;
		}

		const id = this._table.length;
		if (id >= 32767) {
			throw new Error(`Maximum POS number exceeded: ${pos.toString()}`);
		}
		this._table.push(pos);
		this._lookup.set(key, id);
		return id;
	}

	getPOS(id: number): POS | undefined {
		return this._table[id];
	}

	preloadFrom(grammar: Grammar): void {
		const partOfSpeechSize = grammar.getPartOfSpeechSize();
		for (let i = 0; i < partOfSpeechSize; i++) {
			const pos = grammar.getPartOfSpeechString(i);
			this._table.push(pos);
			this._lookup.set(pos.toString(), i);
		}
		this._builtin = partOfSpeechSize;
	}

	getList(): POS[] {
		return [...this._table];
	}

	size(): number {
		return this._table.length;
	}

	ownedLength(): number {
		return this._table.length - this._builtin;
	}

	async writeTo(output: ModelOutput): Promise<void> {
		await output.withPart('POS table', async () => {
			const buffer = new DicBuffer(128 * 1024);
			const ownedLen = this.ownedLength();
			buffer.putInt16(ownedLen);

			for (let i = this._builtin; i < this._table.length; i++) {
				const pos = this._table[i]!;
				for (let j = 0; j < pos.size(); j++) {
					const elem = pos.get(j);
					if (!buffer.putString(elem)) {
						buffer.consume(async (buf) => await output.write(buf));
						buffer.putString(elem);
					}
				}
			}
			buffer.consume(async (buf) => await output.write(buf));
		});
	}
}
