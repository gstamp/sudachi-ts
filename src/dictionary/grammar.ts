import type { CharacterCategory } from './characterCategory.js';
import type { Connection } from './connection.js';
import type { POS } from './pos.js';

export interface Grammar {
	getPartOfSpeechSize(): number;

	getPartOfSpeechString(posId: number): POS;

	getPartOfSpeechId(pos: string[]): number;

	getConnectCost(left: number, right: number): number;

	setConnectCost(left: number, right: number, cost: number): void;

	getBOSParameter(): number[];

	getEOSParameter(): number[];

	getCharacterCategory(): CharacterCategory | null;

	setCharacterCategory(charCategory: CharacterCategory): void;

	readonly INHIBITED_CONNECTION: number;

	getConnection(): Connection;

	isValid(): boolean;

	getStorageSize(): number;
}
