export class WordIdTable {
	private readonly bytes: Uint8Array;
	private readonly size: number;
	private readonly offset: number;
	private dicIdMask: number;

	constructor(bytes: Uint8Array, offset: number) {
		this.bytes = bytes;
		this.size = this.readInt32(offset);
		this.offset = offset + 4;
		this.dicIdMask = 0;
	}

	storageSize(): number {
		return 4 + this.size;
	}

	get(index: number): number[] {
		let idx = index;
		const lengthByte = this.bytes[this.offset + idx];
		if (lengthByte === undefined) {
			return [];
		}
		const length = lengthByte & 0xff;
		const result: number[] = new Array(length);
		for (let i = 0; i < length; i++) {
			result[i] = this.readInt32(this.offset + idx + 1);
			idx += 4;
		}
		return result;
	}

	readWordIds(index: number, output: number[]): number {
		let idx = this.offset + index;
		const lengthByte = this.bytes[idx];
		if (lengthByte === undefined) {
			return 0;
		}
		idx++;
		const length = lengthByte & 0xff;
		for (let i = 0; i < length; i++) {
			const wordId = this.readInt32(idx);
			output[i] = wordId | (this.dicIdMask << 28);
			idx += 4;
		}
		return length;
	}

	setDictionaryId(id: number): void {
		this.dicIdMask = id & 0x0f;
	}

	private readInt32(offset: number): number {
		const b0 = this.bytes[offset];
		const b1 = this.bytes[offset + 1];
		const b2 = this.bytes[offset + 2];
		const b3 = this.bytes[offset + 3];
		if (
			b0 !== undefined &&
			b1 !== undefined &&
			b2 !== undefined &&
			b3 !== undefined
		) {
			return (
				(b0 & 0xff) |
				((b1 & 0xff) << 8) |
				((b2 & 0xff) << 16) |
				((b3 & 0xff) << 24)
			);
		}
		return 0;
	}
}
