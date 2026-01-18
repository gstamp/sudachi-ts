export class DicBuffer {
	static readonly MAX_STRING = 32767;
	private readonly _buffer: Uint8Array;
	private _position = 0;
	private _dataView: DataView;

	constructor(size: number) {
		this._buffer = new Uint8Array(size);
		this._dataView = new DataView(this._buffer.buffer);
	}

	static isValidLength(text: string): boolean {
		return text.length <= DicBuffer.MAX_STRING;
	}

	putString(text: string): boolean {
		const length = text.length;
		if (!this.putLength(length)) {
			return false;
		}
		for (let i = 0; i < length; i++) {
			const code = text.charCodeAt(i);
			this._dataView.setUint16(this._position, code, true);
			this._position += 2;
		}
		return true;
	}

	putEmptyIfEqual(field: string, surface: string): void {
		if (field === surface) {
			this.putString('');
		} else {
			this.putString(field);
		}
	}

	putLength(length: number): boolean {
		if (length >= DicBuffer.MAX_STRING) {
			throw new Error(
				`String length ${length} exceeds MAX_STRING ${DicBuffer.MAX_STRING}`,
			);
		}
		const addLen = length > 127 ? 2 : 1;
		if (this.wontFit(length * 2 + addLen)) {
			return false;
		}
		if (length <= 127) {
			this._buffer[this._position++] = length;
		} else {
			this._buffer[this._position++] = (length >> 8) | 0x80;
			this._buffer[this._position++] = length & 0xff;
		}
		return true;
	}

	putInt16(value: number): void {
		this._dataView.setInt16(this._position, value, true);
		this._position += 2;
	}

	putInt32(value: number): void {
		this._dataView.setInt32(this._position, value, true);
		this._position += 4;
	}

	putInts(data: number[]): void {
		const length = data.length;
		if (length > 255) {
			throw new Error('Too many values in array');
		}
		this._buffer[this._position++] = length;
		for (let i = 0; i < length; i++) {
			this.putInt32(data[i]!);
		}
	}

	wontFit(space: number): boolean {
		return this._position + space > this._buffer.length;
	}

	position(): number {
		return this._position;
	}

	consume(callback: (buffer: Uint8Array) => void): number {
		const slice = this._buffer.slice(0, this._position);
		callback(slice);
		const bytesWritten = this._position;
		this._position = 0;
		return bytesWritten;
	}

	async consumeAsync(
		callback: (buffer: Uint8Array) => Promise<void>,
	): Promise<number> {
		const slice = this._buffer.slice(0, this._position);
		await callback(slice);
		const bytesWritten = this._position;
		this._position = 0;
		return bytesWritten;
	}

	flip(): Uint8Array {
		return this._buffer.slice(0, this._position);
	}

	clear(): void {
		this._position = 0;
	}
}
