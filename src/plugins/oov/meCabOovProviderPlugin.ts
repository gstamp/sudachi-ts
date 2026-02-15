import type { InputText } from '../../core/inputText.js';
import type { LatticeNodeImpl } from '../../core/lattice.js';
import { CategoryType } from '../../dictionary/categoryType.js';
import type { Grammar } from '../../dictionary/grammar.js';
import { POS } from '../../dictionary/pos.js';
import { WordInfo } from '../../dictionary/wordInfo.js';
import { readFully } from '../../utils/stringUtil.js';
import { OovProviderPlugin } from './base.js';

interface CategoryInfo {
	type: CategoryType;
	isInvoke: boolean;
	isGroup: boolean;
	length: number;
}

interface OOV {
	leftId: number;
	rightId: number;
	cost: number;
	posId: number;
}

export class MeCabOovProviderPlugin extends OovProviderPlugin {
	private categories: Map<CategoryType, CategoryInfo> = new Map();
	private oovList: Map<CategoryType, OOV[]> = new Map();
	private initialized: boolean = false;

	override async setUp(grammar: Grammar): Promise<void> {
		if (this.initialized) {
			return;
		}

		const charDefPath = await this.settings.getPath('charDef');
		if (charDefPath) {
			const content = await readFully(charDefPath);
			this.readCharacterProperty(content);
		}

		const unkDefPath = await this.settings.getPath('unkDef');
		const userPosMode =
			this.settings.getString(
				OovProviderPlugin.USER_POS,
				OovProviderPlugin.USER_POS_FORBID,
			) ?? OovProviderPlugin.USER_POS_FORBID;

		if (unkDefPath) {
			const content = await readFully(unkDefPath);
			this.readOOV(content, grammar, userPosMode);
		}

		this.initialized = true;
	}

	provideOOV(
		inputText: InputText,
		offset: number,
		otherWords: number,
		result: LatticeNodeImpl[],
	): number {
		const length = inputText.getCharCategoryContinuousLength(offset);
		let added = 0;

		if (length > 0) {
			const types = inputText.getCharCategoryTypes(offset);

			for (const type of types) {
				const cinfo = this.categories.get(type);
				if (!cinfo) {
					continue;
				}

				let llength = length;
				const oovs = this.oovList.get(cinfo.type);
				if (!oovs) {
					continue;
				}

				if (cinfo.isGroup && (cinfo.isInvoke || otherWords === 0)) {
					const s = inputText.getSubstring(offset, offset + length);
					for (const oov of oovs) {
						result.push(this.getOOVNode(s, oov, length));
						added++;
					}
					llength -= 1;
				}

				if (cinfo.isInvoke || otherWords === 0) {
					for (let i = 1; i <= cinfo.length; i++) {
						const sublength = inputText.getCodePointsOffsetLength(offset, i);
						if (sublength > llength) {
							break;
						}
						const s = inputText.getSubstring(offset, offset + sublength);
						for (const oov of oovs) {
							result.push(this.getOOVNode(s, oov, sublength));
							added++;
						}
					}
				}
			}
		}

		return added;
	}

	private getOOVNode(text: string, oov: OOV, length: number): LatticeNodeImpl {
		const node = this.createNode();
		node.setParameter(oov.leftId, oov.rightId, oov.cost);
		const info = new WordInfo(text, length, oov.posId, text, text, '');
		node.setWordInfo(info);
		return node;
	}

	private readCharacterProperty(content: string): void {
		const lines = content.split('\n');

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]?.trim();
			const lineNumber = i + 1;

			if (
				!line ||
				line.startsWith('#') ||
				line.startsWith('0x') ||
				line === ''
			) {
				continue;
			}

			const cols = line.split(/\s+/);
			if (cols.length < 4) {
				throw new Error(`invalid format at line ${lineNumber}`);
			}

			const type = CategoryType[cols[0]! as keyof typeof CategoryType] as
				| CategoryType
				| undefined;
			if (type === undefined) {
				throw new Error(`${cols[0]} is invalid type at line ${lineNumber}`);
			}

			if (this.categories.has(type)) {
				throw new Error(`${cols[0]} is already defined at line ${lineNumber}`);
			}

			const info: CategoryInfo = {
				type,
				isInvoke: cols[1] !== '0',
				isGroup: cols[2] !== '0',
				length: parseInt(cols[3]!, 10),
			};

			this.categories.set(type, info);
		}
	}

	private readOOV(
		content: string,
		grammar: Grammar,
		userPosMode: string,
	): void {
		const lines = content.split('\n');

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]?.trim();
			const lineNumber = i + 1;

			if (!line) continue;

			const cols = line.split(',');
			if (cols.length < 10) {
				throw new Error(`invalid format at line ${lineNumber}`);
			}

			const type = CategoryType[cols[0]! as keyof typeof CategoryType] as
				| CategoryType
				| undefined;
			if (type === undefined) {
				throw new Error(`${cols[0]} is invalid type at line ${lineNumber}`);
			}

			if (!this.categories.has(type)) {
				throw new Error(`${cols[0]} is undefined at line ${lineNumber}`);
			}

			const oov: OOV = {
				leftId: parseInt(cols[1]!, 10),
				rightId: parseInt(cols[2]!, 10),
				cost: parseInt(cols[3]!, 10),
				posId: 0,
			};

			const pos = new POS(
				cols[4] ?? '',
				cols[5] ?? '',
				cols[6] ?? '',
				cols[7] ?? '',
				cols[8] ?? '',
				cols[9] ?? '',
			);
			oov.posId = this.posIdOf(
				grammar,
				pos,
				userPosMode ?? OovProviderPlugin.USER_POS_FORBID,
			);

			const list = this.oovList.get(type) ?? [];
			list.push(oov);
			this.oovList.set(type, list);
		}
	}
}
