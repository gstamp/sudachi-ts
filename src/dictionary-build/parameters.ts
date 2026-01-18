import type { ModelOutput } from './modelOutput.js';
import type { WriteDictionary } from './writeDictionary.js';

export class Parameters implements WriteDictionary {
	private _data: Int16Array;
	private _position = 0;
	private _maxLeft = Number.MAX_SAFE_INTEGER;
	private _maxRight = Number.MAX_SAFE_INTEGER;

	constructor(initialSize = 1024 * 512) {
		this._data = new Int16Array(initialSize);
	}

	add(left: number, right: number, cost: number): void {
		this.maybeResize();
		if (left >= this._maxLeft) {
			throw new Error(`Left ID ${left} exceeds max value ${this._maxLeft}`);
		}
		if (right >= this._maxRight) {
			throw new Error(`Right ID ${right} exceeds max value ${this._maxRight}`);
		}
		this._data[this._position++] = left;
		this._data[this._position++] = right;
		this._data[this._position++] = cost;
	}

	setLimits(left: number, right: number): void {
		this._maxLeft = left;
		this._maxRight = right;
	}

	private maybeResize(): void {
		if (this._position + 3 > this._data.length) {
			const newData = new Int16Array(this._data.length * 2);
			newData.set(this._data);
			this._data = newData;
		}
	}

	async writeTo(output: ModelOutput): Promise<void> {
		await output.withPart('word parameters', async () => {
			const buffer = new Uint8Array(this._position * 2);
			const view = new DataView(buffer.buffer);
			for (let i = 0; i < this._position; i++) {
				view.setInt16(i * 2, this._data[i]!, true);
			}
			await output.write(buffer);
		});
	}

	size(): number {
		return this._position;
	}
}
