import type { CharacterCategory } from './characterCategory.js';
import { Connection } from './connection.js';
import type { Grammar } from './grammar.js';
import { POS } from './pos.js';

const POS_DEPTH = 6;
const BOS_PARAMETER = [0, 0, 0];
const EOS_PARAMETER = [0, 0, 0];

export class GrammarImpl implements Grammar {
	private posList: POS[];
	private originalPosSize: number;
	private isCopiedConnectTable: boolean;
	private matrix: Connection | null;
	private charCategory: CharacterCategory | null;
	private _storageSize: number;

	readonly INHIBITED_CONNECTION = 0x7fff;

	constructor(bytes?: Uint8Array, offset?: number) {
		if (bytes !== undefined && offset !== undefined) {
			const originalOffset = offset;
			this.isCopiedConnectTable = false;

			const posSize = this.readInt16(offset, bytes);
			offset += 2;
			this.posList = [];

			for (let i = 0; i < posSize; i++) {
				const pos: string[] = [];
				for (let j = 0; j < POS_DEPTH; j++) {
					const str = this.readString(offset, bytes);
					pos.push(str);
					offset += 1 + 2 * str.length;
				}
				this.posList.push(new POS(...pos));
			}

			this.originalPosSize = this.posList.length;

			// Ensure 4-byte alignment for connection matrix
			const rem = offset % 4;
			if (rem !== 0) {
				offset += 4 - rem;
			}

			const leftIdSize = this.readInt16(offset, bytes);
			offset += 2;
			const rightIdSize = this.readInt16(offset, bytes);
			offset += 2;

			const matrixSize = leftIdSize * rightIdSize * 2;
			const matrixBytes = new Int16Array(
				bytes.buffer,
				bytes.byteOffset + offset,
				leftIdSize * rightIdSize,
			);
			this.matrix = new Connection(matrixBytes, leftIdSize, rightIdSize);

			this._storageSize = offset - originalOffset + matrixSize;
			this.charCategory = null;
		} else {
			this.posList = [];
			this.originalPosSize = 0;
			this.isCopiedConnectTable = false;
			this.matrix = null;
			this._storageSize = 0;
			this.charCategory = null;
		}
	}

	getPartOfSpeechSize(): number {
		return this.posList.length;
	}

	getSystemPartOfSpeechSize(): number {
		return this.originalPosSize;
	}

	getPartOfSpeechString(posId: number): POS {
		const pos = this.posList[posId];
		if (!pos) {
			throw new Error(`POS ID out of bounds: ${posId}`);
		}
		return pos;
	}

	getPartOfSpeechId(pos: string[]): number {
		for (let i = 0; i < this.posList.length; i++) {
			const currentPos = this.posList[i];
			if (currentPos !== undefined) {
				if (
					currentPos.toList().every((elem, idx) => {
						const posElem = pos[idx];
						return posElem !== undefined && elem === posElem;
					})
				) {
					return i;
				}
			}
		}
		return -1;
	}

	getConnectCost(left: number, right: number): number {
		if (!this.matrix) {
			throw new Error('Connection matrix is not initialized');
		}
		return this.matrix.cost(left, right);
	}

	setConnectCost(left: number, right: number, cost: number): void {
		if (!this.matrix) {
			throw new Error('Connection matrix is not initialized');
		}
		if (!this.isCopiedConnectTable) {
			this.matrix = this.matrix.ownedCopy();
			this.isCopiedConnectTable = true;
		}
		this.matrix.setCost(left, right, cost);
	}

	getBOSParameter(): number[] {
		return [...BOS_PARAMETER];
	}

	getEOSParameter(): number[] {
		return [...EOS_PARAMETER];
	}

	getCharacterCategory(): CharacterCategory | null {
		return this.charCategory;
	}

	setCharacterCategory(charCategory: CharacterCategory): void {
		this.charCategory = charCategory;
	}

	getConnection(): Connection {
		if (!this.matrix) {
			throw new Error('Connection matrix is not initialized');
		}
		return this.matrix;
	}

	invalidate(): void {
		this.matrix = null;
	}

	isValid(): boolean {
		return this.matrix !== null;
	}

	getStorageSize(): number {
		return this._storageSize;
	}

	addPosList(grammar: GrammarImpl): void {
		this.posList.push(...grammar.posList);
	}

	registerPOS(pos: POS): number {
		const index = this.posList.findIndex((p) => p.equals(pos));
		if (index === -1) {
			const len = this.posList.length;
			this.posList.push(pos);
			return len;
		}
		return index;
	}

	private readInt16(offset: number, bytes: Uint8Array): number {
		const b0 = bytes[offset];
		const b1 = bytes[offset + 1];
		if (b0 !== undefined && b1 !== undefined) {
			return (b0 & 0xff) | ((b1 & 0xff) << 8);
		}
		return 0;
	}

	private readString(offset: number, bytes: Uint8Array): string {
		const lenByte = bytes[offset];
		if (lenByte === undefined) {
			return '';
		}
		const length = lenByte & 0xff;
		const chars: string[] = [];
		for (let i = 0; i < length; i++) {
			const charCode = this.readInt16(offset + 1 + i * 2, bytes);
			chars.push(String.fromCharCode(charCode));
		}
		return chars.join('');
	}
}
