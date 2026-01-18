import type { ModelOutput } from './modelOutput.js';
import type { WriteDictionary } from './writeDictionary.js';

export class ConnectionMatrix implements WriteDictionary {
	private _numLeft = 0;
	private _numRight = 0;
	private _data: Int16Array | null = null;

	get numLeft(): number {
		return this._numLeft;
	}

	get numRight(): number {
		return this._numRight;
	}

	async readEntries(data: string): Promise<number> {
		const lines = data.split('\n');
		if (lines.length === 0) {
			throw new Error('Empty connection matrix data');
		}

		const header = lines[0]?.trim();
		if (!header || header.length === 0) {
			throw new Error('Invalid header format');
		}

		const parts = header.split(/\s+/);
		if (parts.length !== 2) {
			throw new Error(`Invalid header: ${header}, expected two integers`);
		}

		this._numLeft = parseInt(parts[0]!, 10);
		this._numRight = parseInt(parts[1]!, 10);

		if (Number.isNaN(this._numLeft) || Number.isNaN(this._numRight)) {
			throw new Error(`Invalid header: ${header}, expected two integers`);
		}

		const buffer = new Int16Array(2 + this._numLeft * this._numRight);
		buffer[0] = this._numLeft;
		buffer[1] = this._numRight;

		let numLines = 0;
		for (let i = 1; i < lines.length; i++) {
			const line = lines[i]?.trim();
			if (!line || line.length === 0) {
				continue;
			}

			const cols = line.split(/\s+/);
			if (cols.length < 3) {
				throw new Error(`Not enough entries at line ${i}: ${line}`);
			}

			const left = parseInt(cols[0]!, 10);
			const right = parseInt(cols[1]!, 10);
			const cost = parseInt(cols[2]!, 10);

			if (Number.isNaN(left) || Number.isNaN(right) || Number.isNaN(cost)) {
				throw new Error(`Invalid values at line ${i}: ${line}`);
			}

			if (left >= this._numLeft || right >= this._numRight) {
				throw new Error(`Invalid left/right IDs at line ${i}: ${line}`);
			}

			const offset = 2 + right * this._numLeft + left;
			buffer[offset] = cost;
			numLines++;
		}

		this._data = buffer;
		return numLines;
	}

	makeEmpty(): void {
		this._numLeft = 0;
		this._numRight = 0;
		this._data = new Int16Array([0, 0]);
	}

	getCompiled(): Int16Array {
		if (!this._data) {
			throw new Error('Connection matrix not built');
		}
		return this._data;
	}

	async writeTo(output: ModelOutput): Promise<void> {
		if (!this._data) {
			throw new Error('Connection matrix not built');
		}

		const buffer = new Uint8Array(this._data.length * 2);
		const view = new DataView(buffer.buffer);
		for (let i = 0; i < this._data.length; i++) {
			view.setInt16(i * 2, this._data[i]!, true);
		}

		await output.write(buffer);
	}
}
