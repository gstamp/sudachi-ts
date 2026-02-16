import { readFile } from 'node:fs/promises';
import { CategoryType } from './categoryType.js';

interface Range {
	low: number;
	high: number;
	categories: Set<CategoryType>;
}

export class CharacterCategory {
	private static readonly PATTERN_SPACES = /\s+/;
	private static readonly PATTERN_EMPTY_OR_SPACES = /\s*/;
	private static readonly PATTERN_DOUBLE_PERIODS = /\.\./;

	private readonly rangeList: Range[] = [];

	getCategoryTypes(codePoint: number): Set<CategoryType> {
		const categories = new Set<CategoryType>();

		for (const range of this.rangeList) {
			if (codePoint >= range.low && codePoint <= range.high) {
				for (const cat of range.categories) {
					categories.add(cat);
				}
			}
		}

		if (categories.size === 0) {
			categories.add(CategoryType.DEFAULT);
		}

		return categories;
	}

	readCharacterDefinition(content: string): void {
		const lines = content.split('\n');

		for (let lineNum = 0; lineNum < lines.length; lineNum++) {
			const line = lines[lineNum]?.trim();

			if (
				!line ||
				line.startsWith('#') ||
				CharacterCategory.PATTERN_EMPTY_OR_SPACES.test(line)
			) {
				continue;
			}

			const cols = line.split(CharacterCategory.PATTERN_SPACES);
			if (cols.length < 2) {
				throw new Error(`invalid format at line ${lineNum + 1}`);
			}

			const col0 = cols[0]!;
			if (col0.startsWith('0x')) {
				const range: Range = {
					low: 0,
					high: 0,
					categories: new Set<CategoryType>(),
				};

				const r = col0.split(CharacterCategory.PATTERN_DOUBLE_PERIODS);
				const r0 = r[0]!;
				range.low = parseInt(r0, 16);
				range.high = range.low;

				if (r.length > 1) {
					const r1 = r[1]!;
					range.high = parseInt(r1, 16);
				}

				if (range.low > range.high) {
					throw new Error(`invalid range at line ${lineNum + 1}`);
				}

				for (let i = 1; i < cols.length; i++) {
					const col = cols[i]!;
					if (col.startsWith('#')) {
						break;
					}

					const type = getCategoryTypeByName(col);
					if (type === null) {
						throw new Error(`${col} is invalid type at line ${lineNum + 1}`);
					}

					range.categories.add(type);
				}

				this.rangeList.push(range);
			}
		}
	}

	static async loadDefault(): Promise<CharacterCategory> {
		const charCategory = new CharacterCategory();
		try {
			const content = await readFile(
				new URL('../resources/char.def', import.meta.url),
				'utf-8',
			);
			charCategory.readCharacterDefinition(content);
		} catch (e) {
			throw new Error(
				`Failed to load default character definition file: ${e instanceof Error ? e.message : e}`,
			);
		}
		return charCategory;
	}
}

function getCategoryTypeByName(name: string): CategoryType | null {
	for (const [key, value] of Object.entries(CategoryType)) {
		if (typeof value === 'number' && key === name) {
			return value as CategoryType;
		}
	}
	return null;
}
