export const DEPTH = 6;
export const MAX_COMPONENT_LENGTH = 127;

export class POS {
	private readonly elems: string[];

	constructor(...elements: string[]) {
		if (elements.length !== DEPTH) {
			throw new Error(
				`POS must have exactly ${DEPTH} elements, got ${elements.length}: ${elements.join(',')}`,
			);
		}
		for (const e of elements) {
			if (e === null || e === undefined) {
				throw new Error("POS components can't be null or undefined");
			}
			if (e.length > MAX_COMPONENT_LENGTH) {
				throw new Error(
					`POS component had length (${e.length}) > ${MAX_COMPONENT_LENGTH}: ${e}`,
				);
			}
		}
		this.elems = [...elements];
	}

	get(index: number): string {
		const value = this.elems[index];
		if (value === undefined) {
			throw new Error(`POS index out of bounds: ${index}`);
		}
		return value;
	}

	size(): number {
		return DEPTH;
	}

	equals(other: POS): boolean {
		return this.elems.every((elem, i) => elem === other.elems[i]);
	}

	toList(): string[] {
		return [...this.elems];
	}

	toString(): string {
		return this.elems.join(',');
	}
}
