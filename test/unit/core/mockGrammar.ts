import type { CharacterCategory } from '../../../src/dictionary/characterCategory.js';
import type { Grammar } from '../../../src/index.js';
import { Connection, POS } from '../../../src/index.js';

export class MockGrammar implements Grammar {
	private readonly posList: string[][];
	private readonly connectCosts: number[][];
	private readonly posCache: Map<number, POS> = new Map();

	constructor() {
		this.posList = [
			['BOS/EOS', '*', '*', '*', '*', '*'],
			['名詞', '一般', '*', '*', '*'],
		];
		this.connectCosts = [
			[0, 100],
			[100, 0],
		];
	}

	readonly INHIBITED_CONNECTION = 0x7fff;

	getPartOfSpeechSize(): number {
		return this.posList.length;
	}

	getPartOfSpeechString(posId: number): POS {
		if (!this.posCache.has(posId)) {
			const posArray = this.posList[posId] ?? ['*', '*', '*', '*', '*', '*'];
			const pos = new POS(
				posArray[0]!,
				posArray[1]!,
				posArray[2]!,
				posArray[3]!,
				posArray[4]!,
				posArray[5]!,
			);
			this.posCache.set(posId, pos);
		}
		return this.posCache.get(posId)!;
	}

	getPartOfSpeechId(_pos: string[]): number {
		return 0;
	}

	getConnectCost(left: number, right: number): number {
		return this.connectCosts[left]?.[right] ?? 0;
	}

	setConnectCost(_left: number, _right: number, _cost: number): void {}

	getBOSParameter(): number[] {
		return [0, 0, 0];
	}

	getEOSParameter(): number[] {
		return [0, 0, 0];
	}

	getCharacterCategory(): CharacterCategory | null {
		return {
			getCategoryTypes: (_codePoint: number) => new Set(),
		} as CharacterCategory;
	}

	setCharacterCategory(_charCategory: CharacterCategory): void {}

	getConnection(): Connection {
		const matrix = new Int16Array([
			this.connectCosts[0]?.[0]!,
			this.connectCosts[0]?.[1]!,
			this.connectCosts[1]?.[0]!,
			this.connectCosts[1]?.[1]!,
		]);
		return new Connection(matrix, 2, 2);
	}

	isValid(): boolean {
		return true;
	}

	getStorageSize(): number {
		return 0;
	}
}
