export class DoubleArrayLookup {
	private array: Int32Array | null;
	private key: Uint8Array | null;
	private limit: number;
	private startOffset: number;
	private offset: number;
	private nodePos: number;
	private nodeValue: number;

	constructor(array: Int32Array | null = null) {
		this.array = array;
		this.key = null;
		this.limit = 0;
		this.startOffset = 0;
		this.offset = 0;
		this.nodePos = 0;
		this.nodeValue = 0;
	}

	private static hasLeaf(unit: number): boolean {
		return ((unit >>> 8) & 1) === 1;
	}

	private static value(unit: number): number {
		return unit & ((1 << 31) - 1);
	}

	private static label(unit: number): number {
		return unit & ((1 << 31) | 0xff);
	}

	private static offset(unit: number): number {
		const shift = (unit & (1 << 9)) >>> 6;
		return (unit >>> 10) << shift;
	}

	setArray(array: Int32Array): void {
		this.array = array;
		if (this.key) {
			this.reset(this.key, this.startOffset, this.limit);
		}
	}

	reset(key: Uint8Array, offset: number, limit: number): void {
		this.key = key;
		this.offset = offset;
		this.startOffset = offset;
		this.limit = limit;
		this.nodePos = 0;
		if (this.array) {
			const firstUnit = this.array[0];
			if (firstUnit !== undefined) {
				this.nodePos ^= DoubleArrayLookup.offset(firstUnit);
			}
		}
	}

	next(): boolean {
		if (!this.array || !this.key) {
			return false;
		}

		const array = this.array;
		const key = this.key;
		let nodePos = this.nodePos;
		const limit = this.limit;

		for (let offset = this.offset; offset < limit; ++offset) {
			const k = key[offset];
			if (k === undefined) {
				break;
			}
			nodePos ^= k;
			const unit = array[nodePos];
			if (unit === undefined) {
				break;
			}
			const label = DoubleArrayLookup.label(unit);
			if (label !== k) {
				this.offset = limit;
				this.nodePos = nodePos;
				return false;
			}

			nodePos ^= DoubleArrayLookup.offset(unit);
			if (DoubleArrayLookup.hasLeaf(unit)) {
				const nextUnit = array[nodePos];
				if (nextUnit !== undefined) {
					this.nodeValue = DoubleArrayLookup.value(nextUnit);
				}
				this.offset = offset + 1;
				this.nodePos = nodePos;
				return true;
			}
		}

		this.offset = limit;
		return false;
	}

	getValue(): number {
		return this.nodeValue;
	}

	getOffset(): number {
		return this.offset;
	}
}
