import type { ProgressCallback } from './progress.js';

class DoubleArrayBuilderUnit {
	unit = 0;

	hasLeaf(): boolean {
		return ((this.unit >>> 8) & 1) === 1;
	}

	setHasLeaf(b: boolean): void {
		if (b) {
			this.unit |= 1 << 8;
		} else {
			this.unit &= ~(1 << 8);
		}
	}

	value(): number {
		return this.unit & ((1 << 31) - 1);
	}

	setValue(value: number): void {
		this.unit = (this.unit & ~((1 << 31) - 1)) | (value & ((1 << 31) - 1));
	}

	label(): number {
		return this.unit & 0xff;
	}

	setLabel(label: number): void {
		this.unit = (this.unit & ~0xff) | (label & 0xff);
	}

	offset(): number {
		return (this.unit >>> 10) << ((this.unit & (1 << 9)) >>> 6);
	}

	setOffset(offset: number): void {
		this.unit = (this.unit & 0x3ff) | ((offset & 0x3ffff) << 10);
	}
}

export class DoubleArray {
	private array: Int32Array | null = null;
	private size = 0;

	private static readonly BLOCK_SIZE = 256;
	private static readonly NUM_EXTRA_BLOCKS = 16;
	private static readonly NUM_EXTRAS =
		DoubleArray.BLOCK_SIZE * DoubleArray.NUM_EXTRA_BLOCKS;
	private static readonly UPPER_MASK = 0xff << 21;
	private static readonly LOWER_MASK = 0xff;

	private units: DoubleArrayBuilderUnit[] = [];
	private extras: {
		prev: number;
		next: number;
		isFixed: boolean;
		isUsed: boolean;
	}[] = [];
	private labels: number[] = [];
	private extrasHead = 0;
	private progressFunction?: ProgressCallback;

	constructor(progress?: ProgressCallback) {
		this.progressFunction = progress;
	}

	setArray(array: Int32Array, size: number): void {
		this.array = array;
		this.size = size;
	}

	getArray(): Int32Array | null {
		return this.array;
	}

	getSize(): number {
		return this.size;
	}

	totalSize(): number {
		return this.size * 4;
	}

	toByteArray(): Uint8Array {
		if (this.array === null) {
			return new Uint8Array(0);
		}
		return new Uint8Array(
			this.array.buffer,
			this.array.byteOffset,
			this.array.byteLength,
		);
	}

	clear(): void {
		this.array = null;
		this.size = 0;
	}

	build(keys: Uint8Array[], values: number[]): void {
		if (keys.length !== values.length) {
			throw new Error('Keys and values arrays must have the same length');
		}

		const keySet = new KeySet(keys, values);

		this.units = [];
		this.extras = [];
		this.labels = [];

		let numUnits = 1;
		while (numUnits < keySet.size()) {
			numUnits <<= 1;
		}

		this.extras = [];
		for (let i = 0; i < DoubleArray.NUM_EXTRAS; i++) {
			this.extras.push({
				prev: 0,
				next: 0,
				isFixed: false,
				isUsed: false,
			});
		}

		this.reserveId(0);
		this.extras[0]!.isUsed = true;
		this.units[0]!.setOffset(1);
		this.units[0]!.setLabel(0);

		if (keySet.size() > 0) {
			this.buildFromKeySet(keySet, 0, keySet.size(), 0, 0);
		}

		this.fixAllBlocks();

		this.extras = [];
		this.labels = [];

		this.array = new Int32Array(this.units.length);
		for (let i = 0; i < this.units.length; i++) {
			this.array[i] = this.units[i]!.unit;
		}
		this.size = this.array.length;
	}

	private buildFromKeySet(
		keySet: KeySet,
		begin: number,
		end: number,
		depth: number,
		dicId: number,
	): void {
		const offset = this.arrangeFromKeySet(keySet, begin, end, depth, dicId);

		while (begin < end) {
			if (keySet.getKeyByte(begin, depth) !== 0) {
				break;
			}
			begin++;
		}
		if (begin === end) {
			return;
		}

		let lastBegin = begin;
		let lastLabel = keySet.getKeyByte(begin, depth);
		while (++begin < end) {
			const label = keySet.getKeyByte(begin, depth);
			if (label !== lastLabel) {
				this.buildFromKeySet(
					keySet,
					lastBegin,
					begin,
					depth + 1,
					offset ^ (lastLabel & 0xff),
				);
				lastBegin = begin;
				lastLabel = keySet.getKeyByte(begin, depth);
			}
		}
		this.buildFromKeySet(
			keySet,
			lastBegin,
			end,
			depth + 1,
			offset ^ (lastLabel & 0xff),
		);
	}

	private arrangeFromKeySet(
		keySet: KeySet,
		begin: number,
		end: number,
		depth: number,
		dicId: number,
	): number {
		this.labels = [];

		let value = -1;
		for (let i = begin; i < end; i++) {
			const label = keySet.getKeyByte(i, depth);
			if (label === 0) {
				if (depth < keySet.getKey(i).length) {
					throw new Error('invalid null character');
				} else if (keySet.getValue(i) < 0) {
					throw new Error('negative value');
				}

				if (value === -1) {
					value = keySet.getValue(i);
				}
				if (this.progressFunction) {
					this.progressFunction(i + 1, keySet.size() + 1);
				}
			}

			if (this.labels.length === 0) {
				this.labels.push(label);
			} else if (label !== this.labels[this.labels.length - 1]!) {
				if ((label & 0xff) < (this.labels[this.labels.length - 1]! & 0xff)) {
					throw new Error('wrong key order');
				}
				this.labels.push(label);
			}
		}

		const offset = this.findValidOffset(dicId);

		for (const l of this.labels) {
			const dicChildId = offset ^ (l & 0xff);
			this.reserveId(dicChildId);
			if (l === 0) {
				this.units[dicId]!.setHasLeaf(true);
				this.units[dicChildId]!.setValue(value);
			} else {
				this.units[dicChildId]!.setLabel(l);
			}
			this.extras[offset]!.isUsed = true;
		}

		this.units[dicId]!.setOffset(dicId ^ offset);
		this.extras[offset]!.isUsed = true;

		return offset;
	}

	private findValidOffset(id: number): number {
		if (this.extrasHead >= this.units.length) {
			return this.units.length | (id & DoubleArray.LOWER_MASK);
		}

		let unfixedId = this.extrasHead;
		do {
			const offset = unfixedId ^ (this.labels[0]! & 0xff);
			if (this.isValidOffset(id, offset)) {
				return offset;
			}
			unfixedId = this.extras[unfixedId]!.next;
		} while (unfixedId !== this.extrasHead);

		return this.units.length | (id & DoubleArray.LOWER_MASK);
	}

	private isValidOffset(id: number, offset: number): boolean {
		if (this.extras[offset]?.isUsed) {
			return false;
		}

		const relOffset = id ^ offset;
		if (
			(relOffset & DoubleArray.LOWER_MASK) !== 0 &&
			(relOffset & DoubleArray.UPPER_MASK) !== 0
		) {
			return false;
		}

		for (let i = 1; i < this.labels.length; i++) {
			if (this.extras[offset ^ (this.labels[i]! & 0xff)]?.isFixed) {
				return false;
			}
		}

		return true;
	}

	private reserveId(id: number): void {
		if (id >= this.units.length) {
			this.expandUnits();
		}

		if (id === this.extrasHead) {
			this.extrasHead = this.extras[id]!.next;
			if (this.extrasHead === id) {
				this.extrasHead = this.units.length;
			}
		}
		this.extras[this.extras[id]!.prev]!.next = this.extras[id]!.next;
		this.extras[this.extras[id]!.next]!.prev = this.extras[id]!.prev;
		this.extras[id]!.isFixed = true;
	}

	private expandUnits(): void {
		const srcNumUnits = this.units.length;
		const srcNumBlocks = Math.floor(srcNumUnits / DoubleArray.BLOCK_SIZE);

		const destNumUnits = srcNumUnits + DoubleArray.BLOCK_SIZE;
		const destNumBlocks = srcNumBlocks + 1;

		if (destNumBlocks > DoubleArray.NUM_EXTRA_BLOCKS) {
			this.fixBlock(srcNumBlocks - DoubleArray.NUM_EXTRA_BLOCKS);
		}

		for (let i = srcNumUnits; i < destNumUnits; i++) {
			this.units.push(new DoubleArrayBuilderUnit());
		}

		for (let id = srcNumUnits; id < destNumUnits; id++) {
			while (id >= this.extras.length) {
				this.extras.push({
					prev: 0,
					next: 0,
					isFixed: false,
					isUsed: false,
				});
			}
			this.extras[id]!.isUsed = false;
			this.extras[id]!.isFixed = false;
		}

		for (let i = srcNumUnits + 1; i < destNumUnits; i++) {
			this.extras[i - 1]!.next = i;
			this.extras[i]!.prev = i - 1;
		}

		this.extras[srcNumUnits]!.prev = destNumUnits - 1;
		this.extras[destNumUnits - 1]!.next = srcNumUnits;

		this.extras[srcNumUnits]!.prev = this.extras[this.extrasHead]!.prev;
		this.extras[destNumUnits - 1]!.next = this.extrasHead;

		this.extras[this.extras[this.extrasHead]!.prev]!.next = srcNumUnits;
		this.extras[this.extrasHead]!.prev = destNumUnits - 1;
	}

	private fixAllBlocks(): void {
		let begin = 0;
		const numBlocks = Math.floor(this.units.length / DoubleArray.BLOCK_SIZE);
		if (numBlocks > DoubleArray.NUM_EXTRA_BLOCKS) {
			begin = numBlocks - DoubleArray.NUM_EXTRA_BLOCKS;
		}
		const end = numBlocks;

		for (let blockId = begin; blockId !== end; blockId++) {
			this.fixBlock(blockId);
		}
	}

	private fixBlock(blockId: number): void {
		const begin = blockId * DoubleArray.BLOCK_SIZE;
		const end = begin + DoubleArray.BLOCK_SIZE;

		let unusedOffset = 0;
		for (let offset = begin; offset !== end; offset++) {
			if (!this.extras[offset]!.isUsed) {
				unusedOffset = offset;
				break;
			}
		}

		for (let id = begin; id !== end; id++) {
			if (!this.extras[id]!.isFixed) {
				this.reserveId(id);
				this.units[id]!.setLabel(id ^ unusedOffset);
			}
		}
	}

	exactMatchSearch(key: Uint8Array): number[] {
		const result: number[] = [-1, 0];
		if (this.array === null) {
			return result;
		}

		let nodePos = 0;
		let unit = this.array[nodePos]!;

		for (const k of key) {
			nodePos ^= DoubleArray.offset(unit) ^ (k & 0xff);
			unit = this.array[nodePos]!;
			if (DoubleArray.label(unit) !== (k & 0xff)) {
				return result;
			}
		}
		if (!DoubleArray.hasLeaf(unit)) {
			return result;
		}
		unit = this.array[nodePos ^ DoubleArray.offset(unit)]!;
		result[0] = DoubleArray.value(unit);
		result[1] = key.length;
		return result;
	}

	commonPrefixSearch(key: Uint8Array, offset = 0): IterableIterator<number[]> {
		return new CommonPrefixSearchIterator(this, key, offset);
	}

	static hasLeaf(unit: number): boolean {
		return ((unit >>> 8) & 1) === 1;
	}

	static value(unit: number): number {
		return unit & ((1 << 31) - 1);
	}

	static label(unit: number): number {
		return unit & ((1 << 31) | 0xff);
	}

	static offset(unit: number): number {
		return (unit >>> 10) << ((unit & (1 << 9)) >>> 6);
	}
}

class KeySet {
	private keys: Uint8Array[];
	private values: number[] | null;

	constructor(keys: Uint8Array[], values: number[] | null) {
		this.keys = keys;
		this.values = values;
	}

	size(): number {
		return this.keys.length;
	}

	getKey(id: number): Uint8Array {
		return this.keys[id]!;
	}

	getKeyByte(keyId: number, byteId: number): number {
		if (byteId >= this.keys[keyId]!.length) {
			return 0;
		}
		return this.keys[keyId]![byteId]!;
	}

	hasValues(): boolean {
		return this.values !== null;
	}

	getValue(id: number): number {
		if (this.hasValues()) {
			return this.values![id]!;
		}
		return id;
	}
}

class CommonPrefixSearchIterator implements IterableIterator<number[]> {
	private doubleArray: DoubleArray;
	private key: Uint8Array;
	private offset: number;
	private nodePos: number;
	private nextResult: number[] | null = null;

	constructor(doubleArray: DoubleArray, key: Uint8Array, offset: number) {
		this.doubleArray = doubleArray;
		this.key = key;
		this.offset = offset;
		this.nodePos = 0;
		const array = doubleArray.getArray();
		if (array) {
			const unit = array[0];
			if (unit !== undefined) {
				this.nodePos ^= DoubleArray.offset(unit);
			}
		}
		this.nextResult = null;
	}

	[Symbol.iterator](): IterableIterator<number[]> {
		return this;
	}

	next(): IteratorResult<number[]> {
		const result = this.nextResult !== null ? this.nextResult : this.getNext();
		this.nextResult = null;
		if (result === null) {
			return { done: true, value: undefined };
		}
		return { done: false, value: result };
	}

	private getNext(): number[] | null {
		const array = this.doubleArray.getArray();
		if (array === null) {
			return null;
		}

		for (; this.offset < this.key.length; this.offset++) {
			const k = this.key[this.offset]!;
			this.nodePos ^= k & 0xff;
			const unit = array[this.nodePos];
			if (unit === undefined) {
				this.offset = this.key.length;
				return null;
			}
			if (DoubleArray.label(unit) !== (k & 0xff)) {
				this.offset = this.key.length;
				return null;
			}

			this.nodePos ^= DoubleArray.offset(unit);
			if (DoubleArray.hasLeaf(unit)) {
				const r: number[] = [
					DoubleArray.value(array[this.nodePos]!),
					++this.offset,
				];
				return r;
			}
		}
		return null;
	}
}
