export enum CategoryType {
	DEFAULT = 1,
	SPACE = 1 << 1,
	KANJI = 1 << 2,
	SYMBOL = 1 << 3,
	NUMERIC = 1 << 4,
	ALPHA = 1 << 5,
	HIRAGANA = 1 << 6,
	KATAKANA = 1 << 7,
	KANJINUMERIC = 1 << 8,
	GREEK = 1 << 9,
	CYRILLIC = 1 << 10,
	USER1 = 1 << 11,
	USER2 = 1 << 12,
	USER3 = 1 << 13,
	USER4 = 1 << 14,
	NOOOVBOW = 1 << 15,
}

export function getCategoryTypeById(id: number): CategoryType | null {
	for (const type of Object.values(CategoryType)) {
		if (typeof type === 'number' && type === id) {
			return type as CategoryType;
		}
	}
	return null;
}
