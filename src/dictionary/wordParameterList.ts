export class WordParameterList {
	private static readonly ELEMENT_SIZE = 6;

	private bytes: Uint8Array | Int16Array;
	private readonly _size: number;
	private offset: number;
	private isCopied: boolean;

	constructor(bytes: Uint8Array, offset: number) {
		this.bytes = bytes;
		this._size =
			(bytes[offset]! & 0xff) |
			((bytes[offset + 1]! & 0xff) << 8) |
			((bytes[offset + 2]! & 0xff) << 16) |
			((bytes[offset + 3]! & 0xff) << 24);
		this.offset = offset + 4;
		this.isCopied = false;
	}

	storageSize(): number {
		return 4 + WordParameterList.ELEMENT_SIZE * this._size;
	}

	size(): number {
		return this._size;
	}

	getSize(): number {
		return this._size;
	}

	getLeftId(wordId: number): number {
		return this.readInt16(
			this.offset + WordParameterList.ELEMENT_SIZE * wordId,
		);
	}

	getRightId(wordId: number): number {
		return this.readInt16(
			this.offset + WordParameterList.ELEMENT_SIZE * wordId + 2,
		);
	}

	getCost(wordId: number): number {
		return this.readInt16(
			this.offset + WordParameterList.ELEMENT_SIZE * wordId + 4,
		);
	}

	setCost(wordId: number, cost: number): void {
		if (!this.isCopied) {
			this.copyBuffer();
		}
		this.writeInt16(
			this.offset + WordParameterList.ELEMENT_SIZE * wordId + 4,
			cost,
		);
	}

	endOffset(): number {
		return this.offset + 4 + WordParameterList.ELEMENT_SIZE * this._size;
	}

	private copyBuffer(): void {
		const newSize = WordParameterList.ELEMENT_SIZE * this._size;
		const newBuffer = new Int16Array(newSize);
		const oldBytes = this.bytes as Uint8Array;
		for (let i = 0; i < newSize; i++) {
			const byteOffset = this.offset + i;
			if (byteOffset < oldBytes.length) {
				newBuffer[i] = this.readInt16(byteOffset);
			}
		}
		this.bytes = newBuffer;
		this.offset = 0;
		this.isCopied = true;
	}

	private readInt16(offset: number): number {
		if (this.bytes instanceof Int16Array) {
			return this.bytes[offset]!;
		}
		const bytes = this.bytes as Uint8Array;
		return (bytes[offset]! & 0xff) | ((bytes[offset + 1]! & 0xff) << 8);
	}

	private writeInt16(offset: number, value: number): void {
		if (this.bytes instanceof Int16Array) {
			this.bytes[offset] = value;
		} else {
			const bytes = this.bytes as Uint8Array;
			bytes[offset]! = value & 0xff;
			bytes[offset + 1]! = (value >>> 8) & 0xff;
		}
	}
}
